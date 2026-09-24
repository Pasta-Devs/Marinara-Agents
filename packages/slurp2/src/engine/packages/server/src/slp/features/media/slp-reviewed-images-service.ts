import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { newId } from "../../../utils/id-generator.js";
import { slpIsAdmissionFailure } from "../../base/host/slp-admission.js";
import { slpCreatorPostMediaUrl } from "../../base/media/slp-media.js";
import { resolveCreatorImageConnectionId } from "../../base/media/slp-image-connections.js";
import {
  SLP_CREATOR_POST_IMAGE_RETRY_LIMIT,
  slpCreatorPostImageRetryAttempts,
  slpImageAuthFailure,
} from "../../base/media/slp-image-retry.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { slurpDeepDetailsImageRunRecorder } from "../../data/feed/slp-post-deep-details-storage.js";
import { getErrorMessage } from "../../modules/creators/slp-public-support.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { createPromptOverridesStorage } from "../../../services/storage/prompt-overrides.storage.js";
import { type ConnectionAdmissionMode } from "../../../services/generation/connection-admission.js";
import { generateCreatorPostImage } from "./slp-images-service.js";
import type { ReviewedSlpImagePrompt } from "./slp-public-images-service.js";

/**
 * Reviewed and retried Creator post images: claim a post that is waiting for its picture, draw it
 * through generateCreatorPostImage, and finalize or release the claim.
 */
const REVIEWED_IMAGE_CLAIM_LEASE_MS = 2 * 60 * 1000;
const REVIEWED_IMAGE_CLAIM_RENEW_MS = 30 * 1000;

function imageClaimLeaseUntil() {
  return new Date(Date.now() + REVIEWED_IMAGE_CLAIM_LEASE_MS).toISOString();
}

export function createCreatorSlpImagesService(db: DB) {
  const noodle = createSlurpStorage(db);
  const characters = createCharactersStorage(db);
  const connections = createConnectionsStorage(db);
  const promptOverrides = createPromptOverridesStorage(db);

  const generateReviewedImages = async (input: {
    prompts: ReviewedSlpImagePrompt[];
    debugMode: boolean;
    /** Set when the prompts are stored drafts being retried rather than prompts a human approved. */
    retryStoredPrompt?: boolean;
    admissionMode?: ConnectionAdmissionMode;
  }): Promise<
    { ok: true; finalized: number; deferred: number } | { ok: false; error: "missing_connection"; message: string }
  > => {
    const settings = await noodle.getSettings();
    let finalized = 0;
    // Branches where no provider call was made: a claim we could not take, a missing connection,
    // a busy connection. The caller must not read these as a provider failure, or a healthy
    // system backs its own polling off while the user is simply using the connection.
    let deferred = 0;
    for (const promptOverride of input.prompts) {
      const claimToken = newId();
      // Reuses the shared post-image claim; the NoodleR-account check below rejects any
      // non-NoodleR post so a public post id can never be finalized through this route.
      const claimed = await noodle.claimPostImage(promptOverride.id, claimToken, imageClaimLeaseUntil());
      if (!claimed) {
        deferred += 1;
        continue;
      }
      const account = await noodle.getNoodlerAccountById(claimed.authorAccountId);
      if (!account) {
        await noodle.releasePostImageClaim(claimed.id, claimToken);
        continue;
      }
      const imageConnectionId = await resolveCreatorImageConnectionId(db, account.id);
      // Fall back to the default image connection when a creator's mapped
      // override was deleted (getWithKey returns null), instead of silently
      // disabling image generation for that creator.
      const imageConnection =
        (imageConnectionId ? await connections.getWithKey(imageConnectionId) : null) ??
        (await connections.getDefaultForImageGeneration());
      if (!imageConnection) {
        await noodle.releasePostImageClaim(claimed.id, claimToken);
        deferred += 1;
        continue;
      }
      if (!claimed.imagePrompt) {
        await noodle.releasePostImageClaim(claimed.id, claimToken);
        continue;
      }
      const disclosureMode = account.settings.privacy.identityDisclosure ?? "open";
      const linkedPublicAccount = await noodle.resolveAccountSource(account);

      let claimOwned = true;
      const renewClaim = async () => {
        if (!claimOwned) return;
        try {
          claimOwned = await noodle.renewPostImageClaim(claimed.id, claimToken, imageClaimLeaseUntil());
        } catch (error) {
          claimOwned = false;
          logger.warn(error, "[slurp] Failed to renew reviewed image claim for post %s", claimed.id);
        }
      };
      const renewalTimer = setInterval(() => void renewClaim(), REVIEWED_IMAGE_CLAIM_RENEW_MS);
      renewalTimer.unref?.();

      let image: Awaited<ReturnType<typeof generateCreatorPostImage>>;
      try {
        image = await generateCreatorPostImage({
          account,
          linkedPublicAccount,
          disclosureMode,
          postContent: claimed.content,
          draftPrompt: claimed.imagePrompt,
          settings,
          characters,
          promptOverrides,
          imageConnection,
          db,
          debugMode: input.debugMode,
          promptOverride,
          retryStoredPrompt: input.retryStoredPrompt,
          admissionMode: input.admissionMode,
          onImageRun: slurpDeepDetailsImageRunRecorder(
            db,
            claimed.metadata.deepDetailsId,
            input.retryStoredPrompt ? "retry" : "reviewed",
          ),
        });
      } catch (error) {
        clearInterval(renewalTimer);
        // A busy connection sent nothing, so it is not an attempt: hand the post back
        // untouched and let a later pass draw it.
        if (slpIsAdmissionFailure(error)) {
          await noodle.releasePostImageClaim(claimed.id, claimToken);
          deferred += 1;
          continue;
        }
        logger.warn(error, "[slurp] Failed to generate reviewed image for %s", account.displayName);
        await renewClaim();
        if (claimOwned) {
          const attempts = slpImageAuthFailure(error)
            ? SLP_CREATOR_POST_IMAGE_RETRY_LIMIT
            : slpCreatorPostImageRetryAttempts(claimed.metadata) + 1;
          await noodle.finalizePostImageClaim(claimed.id, claimToken, {
            imageUrl: null,
            // The prompt survives a provider failure *and* a spent budget. Spending the budget
            // used to delete it, which left the post with no record of what the picture was meant
            // to be and nothing for the user to redraw from — exactly when they most want it,
            // after three failures. The automatic pass is already stopped by the attempt counter
            // in listNoodlerPostsAwaitingImageRetry, so nulling the prompt only destroyed data.
            metadata: {
              imageGenerationFailed: true,
              imageRetryAttempts: attempts,
              imageGenerationError: getErrorMessage(error).slice(0, 500),
            },
          });
        }
        continue;
      }

      clearInterval(renewalTimer);
      await renewClaim();
      if (!claimOwned) {
        image.stagedMedia?.compensate();
        continue;
      }

      // Re-read the profile before finalizing: if disclosure or the linked public identity
      // changed during the (potentially long) provider call, the staged image was built from a
      // now-stale appearance policy, so discard it and finalize as failed rather than publish it.
      const fresh = await noodle.getNoodlerAccountById(claimed.authorAccountId);
      const freshDisclosure = fresh?.settings.privacy.identityDisclosure ?? "open";
      if (
        !fresh ||
        freshDisclosure !== disclosureMode ||
        fresh.sourceKind !== account.sourceKind ||
        fresh.sourceEntityId !== account.sourceEntityId
      ) {
        image.stagedMedia?.compensate();
        await noodle.finalizePostImageClaim(claimed.id, claimToken, {
          imageUrl: null,
          imagePrompt: null,
          metadata: {
            imageGenerationFailed: true,
            imageGenerationError: "Stage profile identity changed during image generation.",
          },
        });
        continue;
      }
      try {
        image.stagedMedia?.promote();
        const ok = await noodle.finalizePostImageClaim(claimed.id, claimToken, {
          imageUrl: slpCreatorPostMediaUrl(claimed.id),
          metadata: image.metadata,
        });
        if (!ok) {
          image.stagedMedia?.compensate();
          continue;
        }
        finalized += 1;
      } catch (error) {
        image.stagedMedia?.compensate();
        try {
          await noodle.releasePostImageClaim(claimed.id, claimToken);
        } catch (releaseError) {
          logger.warn(releaseError, "[slurp] Failed to release reviewed image claim for post %s", claimed.id);
        }
        throw error;
      }
    }
    return { ok: true, finalized, deferred };
  };

  return {
    generateReviewedImages,

    /**
     * Redraw one post that published without its picture. Runs on the reserve poll, so it takes
     * a single post per pass and yields the image connection to anything the user started.
     */
    async retryNextFailedPostImage(): Promise<"idle" | "retried" | "failed"> {
      const [post] = await noodle.listNoodlerPostsAwaitingImageRetry(1);
      if (!post?.imagePrompt) return "idle";
      const result = await generateReviewedImages({
        prompts: [{ id: post.id, prompt: post.imagePrompt }],
        debugMode: false,
        // The stored prompt is our own draft from the failed attempt, not a reviewed one.
        retryStoredPrompt: true,
        admissionMode: { kind: "background" },
      });
      // A missing image connection is a deferral, not a provider failure: nothing was sent, and
      // the poll must keep its normal cadence for the posting work that does not need images.
      if (!result.ok) return "idle";
      if (result.finalized > 0) return "retried";
      return result.deferred > 0 ? "idle" : "failed";
    },
  };
}
