import { createSlpPoll } from "../../../../../shared/src/slp/slp-polls.js";
import {
  type SlpCreatorGenerationRequest,
  type SlpCreatorPostCreateInput,
  type SlpCreatorPostUpdateInput,
} from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import {
  type SlpCreatorManagedPost,
  type SlpCreatorRefreshNowOutcome,
  type SlpPostAccess,
} from "../../../../../shared/src/slp/slp-social.types.js";
import { createSlurpMessagesStorage } from "../../data/slp-storage.js";
import type { SlpImagePromptReviewItem } from "../media/slp-media-contract.js";
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { newId } from "../../../utils/id-generator.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { slpCreatorUnlockPriceMetadata } from "../../modules/economy/slp-prices.js";
import { generateCreatorPost } from "./slp-generation-service.js";
import { resolveSlurpAutomaticPostAccess } from "./slp-automatic-post-access.js";
import type { SlpCreatorContentFormat } from "./slp-generation-service.js";
import type { ConnectionAdmissionMode } from "../../../services/generation/connection-admission.js";
import {
  persistCreatorPostWithUploadedMedia,
  readCreatorMediaPath,
  unlinkCreatorMedia,
  type SlpCreatorPostMediaUpload,
} from "../../base/media/slp-media.js";
import { tryCreatorAccountOperation } from "../../base/locking/slp-account-operation-lock.js";
import { resolveCreatorSourceSnapshot } from "../../data/creators/slp-source-resolve.js";
import { settleAgentJobsWithConcurrencyLimit } from "../../../services/agents/agent-concurrency.js";

export type GenerateAndApplyCreatorPostResult =
  | {
      status: "generated";
      post: SlpCreatorManagedPost;
      imagePromptReview: SlpImagePromptReviewItem | null;
    }
  | { status: "disabled" }
  | { status: "busy" }
  | { status: "connection_required" }
  | { status: "connection_not_found" }
  | { status: "noodler_account_not_found" };

export type CreateCreatorPostResult =
  | { status: "created"; post: SlpCreatorManagedPost }
  | { status: "disabled" }
  | { status: "busy" }
  | { status: "noodler_account_not_found" };

export type UpdateCreatorPostResult =
  | { status: "updated"; post: SlpCreatorManagedPost }
  | { status: "disabled" }
  | { status: "busy" }
  | { status: "forbidden" }
  | { status: "noodler_post_not_found" };

/**
 * A foreground post invalidates the near-future reserve the same way a manual one does, or the
 * creator posts now and again from reserve within the hour. The post is already persisted by the
 * time this runs, so a cleanup failure is logged and swallowed: reporting it as a failed
 * generation would invite a retry that creates a second post.
 */
async function invalidateNearFutureReserve(
  noodle: ReturnType<typeof createSlurpStorage>,
  accountId: string,
  postedAt: string,
): Promise<void> {
  try {
    await noodle.discardPreparedPostsAfterManualPost(accountId, postedAt);
  } catch (error) {
    logger.warn(error, "[slurp] Could not invalidate the reserve after posting for %s", accountId);
  }
}

/**
 * Reusable generated-post application seam for HTTP now and Slice 8 scheduling later.
 * Provider and persistence failures intentionally throw for the caller to handle.
 */
export async function generateAndApplyCreatorPost(
  db: DB,
  request: SlpCreatorGenerationRequest & { format?: SlpCreatorContentFormat },
  media?: SlpCreatorPostMediaUpload,
  admissionMode?: ConnectionAdmissionMode,
  options: { allowStory?: boolean } = {},
): Promise<GenerateAndApplyCreatorPostResult> {
  const noodle = createSlurpStorage(db);

  const locked = await tryCreatorAccountOperation(request.targetAccountId, async () => {
    const account = await noodle.getNoodlerAccountById(request.targetAccountId);
    if (!account) {
      return { status: "noodler_account_not_found" } as const;
    }
    // A persona-sourced Creator is the player: nothing writes for it unattended. An explicit
    // request from its owner — the composer's Guide button — is a different thing and is allowed,
    // which is what gives these Creators the same drafting tools as character Creators.
    // Only a foreground request carries an owner behind it. Every unattended caller (the scheduler,
    // the first-post worker, run-now, bulk refresh) passes background or no mode at all, and stays blocked.
    if (account.kind === "persona" && account.sourceKind === "persona" && admissionMode?.kind !== "foreground") {
      return { status: "disabled" } as const;
    }
    const publicAccount = await noodle.resolveAccountSource(account);
    if (!publicAccount) {
      return { status: "noodler_account_not_found" } as const;
    }
    if (request.executionId) {
      const existing = await noodle.getNoodlerPostByWizardExecution(account.id, request.executionId);
      if (existing) {
        // A replay returns the post the first attempt created; the reserve it displaced still
        // has to be invalidated, because the first attempt may have died before doing so.
        await invalidateNearFutureReserve(noodle, account.id, existing.createdAt);
        return {
          status: "generated",
          post: existing,
          imagePromptReview: null,
        } as const;
      }
    }
    if (!(await resolveCreatorSourceSnapshot(db, publicAccount))) {
      return { status: "noodler_account_not_found" } as const;
    }
    const settings = await noodle.getSettings();
    const connection = await resolveSlurpTextConnection(
      createConnectionsStorage(db),
      request.connectionId ?? settings.generationConnectionId,
    );
    if (!connection) return { status: "connection_not_found" } as const;
    const generated = await generateCreatorPost(db, {
      account,
      request,
      connection,
      media,
      admissionMode,
      allowStory: options.allowStory,
    });
    await invalidateNearFutureReserve(noodle, account.id, generated.post.createdAt);
    return {
      status: "generated",
      post: generated.post,
      imagePromptReview: generated.imagePromptReview,
    } as const;
  });
  return locked.acquired ? locked.value : { status: "busy" };
}

const MAX_CONCURRENT_MANUAL_REFRESH = 3;
/** How long a player-requested post waits for a Creator that is busy with another run. */
const MANUAL_REFRESH_BUSY_WAIT_MS = 180_000;
const MANUAL_REFRESH_BUSY_POLL_MS = 2_000;

export type SlpCreatorRefreshNowResult =
  { status: "disabled" } | { status: "ok"; outcomes: SlpCreatorRefreshNowOutcome[] };

/**
 * Global "Refresh NoodleR now": explicit user-authorized work, separate from the automatic
 * reserve budget and publication clock.
 */
export async function refreshAllCreatorsNow(db: DB): Promise<SlpCreatorRefreshNowResult> {
  const noodle = createSlurpStorage(db);

  const accounts = await noodle.listAutoPostEnabledAccounts();
  // Least-recently active creator first, so limited provider capacity goes to the quiet ones.
  // Profile edits move `updatedAt` without being activity, so they must not reorder this.
  const activity = await noodle.getNoodlerCreatorActivityTimes();
  const activityOf = (accountId: string) => activity.get(accountId) ?? "";
  const prioritized = [...accounts].sort(
    (a, b) => activityOf(a.id).localeCompare(activityOf(b.id)) || a.id.localeCompare(b.id),
  );
  const settled = await settleAgentJobsWithConcurrencyLimit(
    prioritized,
    MAX_CONCURRENT_MANUAL_REFRESH,
    async (account): Promise<SlpCreatorRefreshNowOutcome> => {
      const result = await generateAndApplyCreatorPost(db, {
        mode: "noodler",
        targetAccountId: account.id,
        format: "caption",
        access: await resolveSlurpAutomaticPostAccess(noodle, account.id),
      });
      // "disabled"/"busy" are no-op refreshes, not failures; surface them as skipped so the
      // client doesn't lump a busy creator in with a real generation/connection failure.
      const status = result.status === "disabled" || result.status === "busy" ? "skipped" : result.status;
      return { accountId: account.id, status };
    },
  );

  const outcomes = settled.map((entry, index): SlpCreatorRefreshNowOutcome => {
    if (entry.status === "fulfilled") return entry.value;
    logger.error(entry.reason, "[slurp] Global refresh failed for creator %s", prioritized[index]!.id);
    return { accountId: prioritized[index]!.id, status: "error" };
  });
  return { status: "ok", outcomes };
}

export async function refreshTargetedCreatorsNow(
  db: DB,
  accountIds: string[],
  executionId?: string,
  access: SlpPostAccess = "locked",
): Promise<SlpCreatorRefreshNowResult> {
  const noodle = createSlurpStorage(db);

  // One creator named twice is one refresh, not two: the per-account lock already serializes the
  // work, but without this the response reports that creator twice.
  const targetAccountIds = [...new Set(accountIds)];
  const eligibleAccounts = new Set(
    (await noodle.listNoodlerAccounts())
      .filter((account) => !(account.kind === "persona" && account.sourceKind === "persona"))
      .map((account) => account.id),
  );
  const eligibleTargetAccountIds = targetAccountIds.filter((accountId) => eligibleAccounts.has(accountId));
  const settled = await settleAgentJobsWithConcurrencyLimit(
    eligibleTargetAccountIds,
    MAX_CONCURRENT_MANUAL_REFRESH,
    async (accountId): Promise<SlpCreatorRefreshNowOutcome & { postId?: string }> => {
      const run = () =>
        generateAndApplyCreatorPost(
          db,
          { mode: "noodler", targetAccountId: accountId, format: "caption", access, executionId },
          undefined,
          undefined,
          // The player pressed "Create posts now" and counts feed posts. A Story never reaches the feed,
          // so a batch that landed on a Story slot looked like one post had gone missing.
          { allowStory: false },
        );
      // A Creator busy with the scheduler or another run used to be skipped at once, and the batch
      // still read as done. An explicit request waits for that run to finish instead.
      const startedAt = Date.now();
      let result = await run();
      while (result.status === "busy" && Date.now() - startedAt < MANUAL_REFRESH_BUSY_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, MANUAL_REFRESH_BUSY_POLL_MS));
        result = await run();
      }
      const status = result.status === "disabled" || result.status === "busy" ? "skipped" : result.status;
      logger.info(
        "[slurp] Create posts now: %s -> %s%s",
        accountId,
        result.status,
        result.status === "generated" ? ` (post ${result.post.id})` : "",
      );
      return { accountId, status, ...(result.status === "generated" ? { postId: result.post.id } : {}) };
    },
  );
  const outcomes = settled.map((entry, index): SlpCreatorRefreshNowOutcome => {
    const accountId = eligibleTargetAccountIds[index]!;
    if (entry.status === "fulfilled") return entry.value;
    logger.error(entry.reason, "[slurp] Targeted refresh failed for creator %s", accountId);
    return { accountId, status: "error" };
  });
  for (const accountId of targetAccountIds) {
    if (!eligibleAccounts.has(accountId)) outcomes.push({ accountId, status: "skipped" });
  }
  return { status: "ok", outcomes };
}

export async function createCreatorPost(
  db: DB,
  input: SlpCreatorPostCreateInput & {
    format?: SlpCreatorContentFormat;
    postType?: "post" | "story";
    linkedPostId?: string | null;
    /** This post's own unlock price. Absent uses the Creator's price, then Settings. */
    unlockPrice?: number | null;
    /** Image directions kept on a manual post, so its image can be rendered afterwards. */
    imagePrompt?: string | null;
  },
  media?: SlpCreatorPostMediaUpload,
): Promise<CreateCreatorPostResult> {
  const noodle = createSlurpStorage(db);
  const locked = await tryCreatorAccountOperation(input.targetAccountId, async () => {
    const postId = media ? newId() : undefined;
    // Settings → Wallet → "Unlock a post" is the default price a locked post is stamped with.
    // Calling the helper with no argument stamped the shipped 1 instead, so the setting did
    // nothing and every locked post cost one coin whatever the player configured.
    const unlockPrice =
      input.unlockPrice ??
      (await createSlurpMessagesStorage(db).getCreatorMessaging(input.targetAccountId)).unlockPrice ??
      (await noodle.getSettings()).walletUnlockCost;
    const persist = (persistedMedia?: { imageUrl: string; noodlerMediaPath: string }) => {
      const create = async () => {
        return noodle.createNoodlerPost({
          id: postId,
          authorAccountId: input.targetAccountId,
          title: input.title,
          content: input.content,
          source: "manual",
          access: input.access,
          imagePrompt: input.imagePrompt?.trim() || null,
          imageUrl: persistedMedia?.imageUrl ?? null,
          metadata: {
            noodlerContentFormat: input.format ?? "caption",
            noodlerPostType: input.postType ?? "post",
            ...(input.postType === "story" && input.linkedPostId ? { noodlerLinkedPostId: input.linkedPostId } : {}),
            // Stored at creation so an unlock price stays put across refreshes and edits.
            ...(input.access === "locked" ? slpCreatorUnlockPriceMetadata(unlockPrice) : {}),
            ...(input.poll ? { poll: createSlpPoll(input.poll) } : {}),
            ...(input.imageCrop ? { imageCrop: input.imageCrop } : {}),
            ...(persistedMedia ? { noodlerMediaPath: persistedMedia.noodlerMediaPath } : {}),
          },
        });
      };
      return create();
    };
    const post =
      media && postId
        ? await persistCreatorPostWithUploadedMedia(input.targetAccountId, postId, media, persist)
        : await persist();
    if (!post) return { status: "noodler_account_not_found" } as const;
    // The post is already persisted. Failing the request over cleanup would report a successful
    // create as an error and invite a retry that posts twice; a stale prepared post is the
    // cheaper problem, and the next reconciliation pass drops it anyway.
    try {
      await noodle.discardPreparedPostsAfterManualPost(input.targetAccountId, post.createdAt);
    } catch (error) {
      logger.warn(error, "[slurp] Failed to discard prepared posts after a manual post for %s", input.targetAccountId);
    }
    return { status: "created", post } as const;
  });
  return locked.acquired ? locked.value : { status: "busy" };
}

export async function updateCreatorPostWithMedia(
  db: DB,
  id: string,
  accountId: string,
  input: SlpCreatorPostUpdateInput,
  media: SlpCreatorPostMediaUpload,
): Promise<UpdateCreatorPostResult> {
  const noodle = createSlurpStorage(db);
  const existing = await noodle.getNoodlerPostById(id);
  if (!existing) return { status: "noodler_post_not_found" };
  if (existing.authorAccountId !== accountId) return { status: "forbidden" };

  const locked = await tryCreatorAccountOperation(existing.authorAccountId, async () => {
    const current = await noodle.getNoodlerPostById(id);
    if (!current) return { status: "noodler_post_not_found" } as const;
    if (current.authorAccountId !== accountId) return { status: "forbidden" } as const;
    const oldPath = readCreatorMediaPath(current);
    const post = await persistCreatorPostWithUploadedMedia(current.authorAccountId, id, media, (persistedMedia) =>
      noodle.updateNoodlerPost(id, input, persistedMedia),
    );
    if (!post) return { status: "noodler_post_not_found" } as const;
    const nextPath = readCreatorMediaPath(post);
    if (oldPath !== nextPath) unlinkCreatorMedia(oldPath);
    return { status: "updated", post } as const;
  });
  return locked.acquired ? locked.value : { status: "busy" };
}
