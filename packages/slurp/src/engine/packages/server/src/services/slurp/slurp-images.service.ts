import type { NoodleAccount, NoodleIdentityDisclosure } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger, logDebugOverride } from "../../lib/logger.js";
import { newId } from "../../utils/id-generator.js";
import { createSlurpStorage, type SlurpSettings } from "../storage/slurp.storage.js";
import { getErrorMessage } from "./slurp-public-support.js";
import { NOODLER_MEDIA_PREFIX, noodlerPostMediaUrl } from "./slurp-media.js";
import { resolveImageConnectionFallback } from "../generation/media-connection-fallback.js";
import { generateImage, stageImageToDisk, type StagedGalleryImage } from "../image/image-generation.js";
import { resolveConnectionImageDefaults } from "../image/image-generation-defaults.js";
import { compileImagePrompt, resolveImageStyleGuidanceText } from "../image/image-prompt-compiler.js";
import { resolveImagePromptReviewSize } from "../image/image-prompt-review.js";
import { loadImageGenerationUserSettings } from "../image/image-generation-settings.js";
import { resolveIllustratorCharacterReferences } from "../image/illustrator-references.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createPromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { resolveNoodlerImageConnectionId } from "./slurp-image-connections.js";
import { loadPrompt, NOODLE_IMAGE_POST } from "../prompt-overrides/index.js";
import {
  generateNoodleImageWithRetry,
  noodlerPostImageRetryAttempts,
  NOODLER_POST_IMAGE_RETRY_LIMIT,
} from "./slurp-image-retry.js";
import { rewriteNoodleImagePrompt } from "./slurp-image-prompt-rewrite.js";
import { isConnectionAdmissionFailure, type ConnectionAdmissionMode } from "../generation/connection-admission.js";
import { characterAppearanceFromRow, characterNoodleImageContextFromRow } from "./slurp-public-images.service.js";
import type { NoodleImagePromptReviewItem, ReviewedNoodleImagePrompt } from "./slurp-public-images.service.js";
import { characterNameFromRow } from "./slurp-public-support.js";
import { selectNoodleImageProviderPrompt } from "./slurp-image-prompt.js";

const REVIEWED_IMAGE_CLAIM_LEASE_MS = 2 * 60 * 1000;
const REVIEWED_IMAGE_CLAIM_RENEW_MS = 30 * 1000;

function imageClaimLeaseUntil() {
  return new Date(Date.now() + REVIEWED_IMAGE_CLAIM_LEASE_MS).toISOString();
}

type ImageConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

/**
 * NoodleR analog of generateNoodlePostImage. The deliberate difference from public
 * Noodle: bytes stage into a NoodleR-owned media namespace and never touch the
 * public gallery or character gallery, so subscriber/PPV output can be served only
 * through the access-checked media endpoint. The staged file's on-disk path is persisted in
 * `metadata.noodlerMediaPath`; callers finalize via `stagedMedia` and derive the access-checked
 * URL from the persisted post id.
 */
export async function generateNoodlerPostImage(input: {
  account: NoodleAccount;
  linkedPublicAccount: NoodleAccount | null;
  disclosureMode: NoodleIdentityDisclosure;
  postContent: string;
  draftPrompt: string;
  settings: Pick<
    SlurpSettings,
    | "imageGenerationPrompt"
    | "imagePromptInterpretation"
    | "imageGenerationUseAvatarReferences"
    | "imageGenerationIncludeDescriptions"
    | "enableImageInterpretation"
    | "imageWidth"
    | "imageHeight"
  >;
  characters: ReturnType<typeof createCharactersStorage>;
  promptOverrides: ReturnType<typeof createPromptOverridesStorage>;
  imageConnection: ImageConnection;
  db: DB;
  debugMode: boolean;
  previewOnly?: boolean;
  promptOverride?: { prompt: string; negativePrompt?: string };
  beforeProviderAttempt?: (attempt: number) => Promise<void>;
  onProviderAttemptFailure?: (attempt: number) => Promise<void>;
  admissionMode?: ConnectionAdmissionMode;
  width?: number;
  height?: number;
  compositionGuard?: string;
  negativePromptAdditions?: string;
}): Promise<{
  metadata: Record<string, unknown>;
  preview: Omit<NoodleImagePromptReviewItem, "id"> | null;
  stagedMedia: StagedGalleryImage | null;
}> {
  const imageSettings = await loadImageGenerationUserSettings(input.db);
  const redactIdentity = (value: string) => {
    if (input.disclosureMode === "open" || !input.linkedPublicAccount) return value;
    const terms = [
      input.linkedPublicAccount.displayName,
      input.linkedPublicAccount.handle,
      input.linkedPublicAccount.entityId,
    ].filter((term) => term.trim().length > 0);
    return terms.reduce(
      (text, term) => text.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "giu"), "[redacted]"),
      value,
    );
  };
  const imageDefaults = resolveConnectionImageDefaults(input.imageConnection);
  const imageModel = input.imageConnection.model || "";
  const imageBaseUrl = input.imageConnection.baseUrl || "https://image.pollinations.ai";
  const imageSource = input.imageConnection.imageGenerationSource || imageModel;
  const imageServiceHint = input.imageConnection.imageService || imageSource;
  const imageFallback = await resolveImageConnectionFallback(
    createConnectionsStorage(input.db),
    input.imageConnection.id,
  );

  let characterDescription = "";
  let characterImageInstructions = "";
  let characterPersonality = "";
  let referenceImages: string[] | undefined;
  // Identity protection applies to reference selection and appearance text. A SECRET creator gets
  // no source image references or identifying physical description.
  // A HINTED creator also keeps image references: the same body, tattoos, and rooms can show up
  // while the source name and handle stay protected.
  const referenceCharacter =
    input.disclosureMode !== "secret" && input.linkedPublicAccount?.kind === "character"
      ? input.linkedPublicAccount
      : null;
  const sourceCharacter =
    input.linkedPublicAccount?.kind === "character"
      ? await input.characters.getById(input.linkedPublicAccount.entityId)
      : null;
  const sourcePersona =
    input.linkedPublicAccount?.kind === "persona"
      ? await input.characters.getPersona(input.linkedPublicAccount.entityId)
      : null;
  const sourceAppearance = sourceCharacter
    ? characterAppearanceFromRow(sourceCharacter)
    : sourcePersona?.appearance?.trim() || "";
  // Every mode shows the same body — it is the page. Reducing a concealed creator to a handful of
  // approved tokens made them shapeless without hiding anything linkable, since a build and a hair
  // colour identify nobody. Secret withholds the face and one-of-a-kind markers through the
  // composition guard below instead.
  if (sourceAppearance && input.settings.imageGenerationIncludeDescriptions) {
    characterDescription = sourceAppearance;
  }
  if (referenceCharacter) {
    const row = sourceCharacter;
    if (row) {
      const imageContext = characterNoodleImageContextFromRow(row);
      characterPersonality = imageContext.personality;
      characterImageInstructions = imageContext.imageInstructions;

      if (input.settings.imageGenerationIncludeDescriptions || input.settings.imageGenerationUseAvatarReferences) {
        const referenceResolution = await resolveIllustratorCharacterReferences({
          charactersStore: input.characters,
          chatCharacters: [
            {
              id: row.id,
              name: referenceCharacter.displayName || characterNameFromRow(row),
              avatarPath: row.avatarPath ?? null,
              appearance: characterAppearanceFromRow(row),
            },
          ],
          persona: null,
          requestedNames: [input.account.displayName],
          promptText: [input.account.displayName, input.postContent, input.draftPrompt].join("\n"),
          maxReferences: 6,
        });
        if (input.settings.imageGenerationIncludeDescriptions && referenceResolution.appearanceBlock) {
          characterDescription = referenceResolution.appearanceBlock;
        }
        if (input.settings.imageGenerationUseAvatarReferences && referenceResolution.referenceImages.length > 0) {
          referenceImages = Array.from(new Set(referenceResolution.referenceImages)).slice(0, 6);
        }
      }
    }
  }

  const postPrompt = await loadPrompt(input.promptOverrides, NOODLE_IMAGE_POST, {
    authorName: input.account.displayName,
    postContent: input.postContent,
    draftPrompt: input.draftPrompt,
    userInstructions: input.settings.imageGenerationPrompt,
    characterDescription,
    characterImageInstructions,
    characterPersonality,
  });
  const compiledPrompt = compileImagePrompt({
    kind: "illustration",
    prompt: postPrompt,
    styleProfiles: imageSettings.styleProfiles,
    imageDefaults,
  });
  const styleGuidance = resolveImageStyleGuidanceText(imageSettings.styleProfiles, compiledPrompt.profile.id);
  // A reviewed prompt replaces the generated wording, but the style profile is composition rather
  // than wording, so recompile the approved text instead of sending it bare. The compiler omits
  // style values the prompt already carries, so an approved prompt is never double-styled.
  const overridePrompt = input.promptOverride?.prompt.trim();
  const compiledOverride = overridePrompt
    ? compileImagePrompt({
        kind: "illustration",
        prompt: overridePrompt,
        styleProfiles: imageSettings.styleProfiles,
        imageDefaults,
      })
    : null;
  // The rewrite is skipped when interpretation is off and discarded when it leaks, and both land on
  // this fallback. Sending the bare draft there dropped the style profile exactly like the review
  // path did, so the draft is compiled too.
  const draftPrompt = input.draftPrompt.trim();
  const compiledDraft = draftPrompt
    ? compileImagePrompt({
        kind: "illustration",
        prompt: draftPrompt,
        styleProfiles: imageSettings.styleProfiles,
        imageDefaults,
      })
    : null;
  const rawFinalPrompt = redactIdentity(compiledOverride?.prompt || compiledPrompt.prompt);
  const rawProviderPrompt = redactIdentity(compiledOverride?.prompt || compiledDraft?.prompt || draftPrompt);
  // Custom prompt templates may omit `userInstructions`, so restore configured instructions only
  // when the rendered prompt does not already contain them.
  const configuredImageInstructions = input.settings.imageGenerationPrompt.trim();
  const connectionImageInstructions = input.imageConnection.imagePromptInstructions?.trim() ?? "";
  const imagePromptInstructions = [
    configuredImageInstructions && !postPrompt.includes(configuredImageInstructions) ? configuredImageInstructions : "",
    connectionImageInstructions,
  ]
    .filter(Boolean)
    .join("\n");
  const characterContext = [
    characterDescription ? `Appearance:\n${characterDescription}` : "",
    characterPersonality ? `Personality:\n${characterPersonality}` : "",
    characterImageInstructions ? `Character image preferences:\n${characterImageInstructions}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const rewrittenPrompt =
    (imagePromptInstructions || characterContext || styleGuidance) &&
    input.settings.enableImageInterpretation !== false &&
    !input.promptOverride
      ? await rewriteNoodleImagePrompt({
          db: input.db,
          prompt: rawFinalPrompt,
          interpretationInstruction: input.settings.imagePromptInterpretation,
          instructions: imagePromptInstructions,
          characterContext,
          styleGuidance,
        })
      : null;
  const finalPromptBase = redactIdentity(
    selectNoodleImageProviderPrompt({
      rewrittenPrompt,
      rawPrompt: rawProviderPrompt,
      // Art style and the character's image habits are meant to reach the provider, so a rewrite
      // that applies them is doing its job. Personality never belongs in a visual prompt at any
      // length; the instruction fields are guidance and only leak as a copied block.
      privateContext: [characterPersonality],
      guidanceContext: [configuredImageInstructions, connectionImageInstructions],
    }),
  );
  // A creator hiding their identity still posts their body — that is the page. What they actually
  // withhold is the face and any one-of-a-kind marker, and they withhold it through framing rather
  // than by describing themselves vaguely.
  const anonymityGuard =
    input.disclosureMode === "secret"
      ? "Compose so the face cannot be identified: crop above the chin, turn away from the camera, or obscure the face with hair, a hand, an object, or shadow. Do not depict one-of-a-kind identifying marks such as a signature scar, tattoo, species trait, or unusual anatomy."
      : "";
  const finalPrompt = [finalPromptBase, anonymityGuard, input.compositionGuard].filter(Boolean).join("\n\n");
  // A reviewer who cleared the negative prompt still gets the style profile's own negatives back,
  // for the same reason the positive prompt is recompiled above.
  const baseNegativePrompt = input.promptOverride
    ? redactIdentity(input.promptOverride.negativePrompt?.trim() || "") || compiledOverride?.negativePrompt || undefined
    : compiledPrompt.negativePrompt || undefined;
  const finalNegativePrompt =
    [baseNegativePrompt, input.negativePromptAdditions].filter(Boolean).join(", ") || undefined;
  const outputWidth = input.width ?? input.settings.imageWidth;
  const outputHeight = input.height ?? input.settings.imageHeight;
  logDebugOverride(
    input.debugMode,
    "[debug/noodler/image] final image prompt for %s:\n%s",
    input.account.displayName,
    finalPrompt,
  );

  if (input.previewOnly) {
    const previewSize = resolveImagePromptReviewSize({
      connection: input.imageConnection,
      prompt: finalPrompt,
      width: outputWidth,
      height: outputHeight,
      imageDefaults,
    });
    return {
      metadata: {},
      preview: {
        kind: "illustration",
        title: `${input.account.displayName} NoodleR image`,
        prompt: finalPrompt,
        negativePrompt: finalNegativePrompt,
        width: previewSize.width,
        height: previewSize.height,
      },
      stagedMedia: null,
    };
  }

  const image = await generateNoodleImageWithRetry(
    async (attempt) => {
      await input.beforeProviderAttempt?.(attempt);
      return generateImage(imageSource, imageBaseUrl, input.imageConnection.apiKey || "", imageServiceHint, {
        prompt: finalPrompt,
        negativePrompt: finalNegativePrompt,
        model: imageModel,
        width: outputWidth,
        height: outputHeight,
        imageEndpointId: input.imageConnection.imageEndpointId || undefined,
        comfyWorkflow: input.imageConnection.comfyuiWorkflow || undefined,
        imageDefaults,
        referenceImages,
        debugMode: input.debugMode,
        admissionMode: input.admissionMode,
        fallback: imageFallback,
      });
    },
    async (error, attempt, maxAttempts) => {
      await input.onProviderAttemptFailure?.(attempt);
      logger.warn(
        error,
        "[noodler] Image generation attempt %d/%d failed for %s",
        attempt,
        maxAttempts,
        input.account.displayName,
      );
    },
  );
  const provider = input.imageConnection.provider ?? "image_generation";
  const file = stageImageToDisk(`${NOODLER_MEDIA_PREFIX}${input.account.id}`, image.base64, image.ext);
  return {
    metadata: {
      imageGenerated: true,
      imageProvider: provider,
      imageModel: imageModel || "unknown",
      imageStyleProfileId: compiledPrompt.profile.id,
      noodlerMediaPath: file.filePath,
    },
    preview: null,
    stagedMedia: file,
  };
}

export function createNoodlerNoodleImagesService(db: DB) {
  const noodle = createSlurpStorage(db);
  const characters = createCharactersStorage(db);
  const connections = createConnectionsStorage(db);
  const promptOverrides = createPromptOverridesStorage(db);

  const generateReviewedImages = async (input: {
    prompts: ReviewedNoodleImagePrompt[];
    debugMode: boolean;
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
      const imageConnectionId = await resolveNoodlerImageConnectionId(db, account.id);
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
      const disclosureMode = account.settings.privacy.identityDisclosure ?? "secret";
      const linkedPublicAccount = await noodle.resolveAccountSource(account);

      let claimOwned = true;
      const renewClaim = async () => {
        if (!claimOwned) return;
        try {
          claimOwned = await noodle.renewPostImageClaim(claimed.id, claimToken, imageClaimLeaseUntil());
        } catch (error) {
          claimOwned = false;
          logger.warn(error, "[noodler] Failed to renew reviewed image claim for post %s", claimed.id);
        }
      };
      const renewalTimer = setInterval(() => void renewClaim(), REVIEWED_IMAGE_CLAIM_RENEW_MS);
      renewalTimer.unref?.();

      let image: Awaited<ReturnType<typeof generateNoodlerPostImage>>;
      try {
        image = await generateNoodlerPostImage({
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
          admissionMode: input.admissionMode,
        });
      } catch (error) {
        clearInterval(renewalTimer);
        // A busy connection sent nothing, so it is not an attempt: hand the post back
        // untouched and let a later pass draw it.
        if (isConnectionAdmissionFailure(error)) {
          await noodle.releasePostImageClaim(claimed.id, claimToken);
          deferred += 1;
          continue;
        }
        logger.warn(error, "[noodler] Failed to generate reviewed image for %s", account.displayName);
        await renewClaim();
        if (claimOwned) {
          const attempts = noodlerPostImageRetryAttempts(claimed.metadata) + 1;
          await noodle.finalizePostImageClaim(claimed.id, claimToken, {
            imageUrl: null,
            // The prompt survives a provider failure: it is what a later retry (automatic or
            // one the user asks for) regenerates from. Only the attempt budget ends it.
            imagePrompt: attempts >= NOODLER_POST_IMAGE_RETRY_LIMIT ? null : undefined,
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
      const freshDisclosure = fresh?.settings.privacy.identityDisclosure ?? "secret";
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
          imageUrl: noodlerPostMediaUrl(claimed.id),
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
          logger.warn(releaseError, "[noodler] Failed to release reviewed image claim for post %s", claimed.id);
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
