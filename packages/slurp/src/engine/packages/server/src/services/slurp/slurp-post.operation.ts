import {
  createNoodlePoll,
  type NoodlerGenerationRequest,
  type NoodlerPostCreateInput,
  type NoodlerPostUpdateInput,
  type NoodlerManagedPost,
  type NoodlePostAccess,
  type NoodlerRefreshNowOutcome,
} from "@marinara-engine/shared";
import type { NoodleImagePromptReviewItem } from "./slurp-public-images.service.js";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { newId } from "../../utils/id-generator.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { noodlerUnlockPriceMetadata } from "./slurp-prices.js";
import { generateNoodlerPost } from "./slurp-generation.service.js";
import type { NoodlerContentFormat } from "./slurp-generation.service.js";
import type { ConnectionAdmissionMode } from "../generation/connection-admission.js";
import {
  persistNoodlerPostWithUploadedMedia,
  readNoodlerMediaPath,
  unlinkNoodlerMedia,
  type NoodlerPostMediaUpload,
} from "./slurp-media.js";
import { tryNoodlerAccountOperation } from "./slurp-account-operation-lock.js";
import { resolveNoodlerSourceSnapshot } from "./slurp-source-resolve.js";
import { settleAgentJobsWithConcurrencyLimit } from "../agents/agent-concurrency.js";

export type GenerateAndApplyNoodlerPostResult =
  | {
      status: "generated";
      post: NoodlerManagedPost;
      imagePromptReview: NoodleImagePromptReviewItem | null;
    }
  | { status: "disabled" }
  | { status: "busy" }
  | { status: "connection_required" }
  | { status: "connection_not_found" }
  | { status: "noodler_account_not_found" };

export type CreateNoodlerPostResult =
  | { status: "created"; post: NoodlerManagedPost }
  | { status: "disabled" }
  | { status: "busy" }
  | { status: "noodler_account_not_found" };

export type UpdateNoodlerPostResult =
  | { status: "updated"; post: NoodlerManagedPost }
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
    logger.warn(error, "[noodler] Could not invalidate the reserve after posting for %s", accountId);
  }
}

/**
 * Reusable generated-post application seam for HTTP now and Slice 8 scheduling later.
 * Provider and persistence failures intentionally throw for the caller to handle.
 */
export async function generateAndApplyNoodlerPost(
  db: DB,
  request: NoodlerGenerationRequest & { format?: NoodlerContentFormat },
  media?: NoodlerPostMediaUpload,
  admissionMode?: ConnectionAdmissionMode,
): Promise<GenerateAndApplyNoodlerPostResult> {
  const noodle = createSlurpStorage(db);

  const locked = await tryNoodlerAccountOperation(request.targetAccountId, async () => {
    const account = await noodle.getNoodlerAccountById(request.targetAccountId);
    if (!account) {
      return { status: "noodler_account_not_found" } as const;
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
    if (!(await resolveNoodlerSourceSnapshot(db, publicAccount))) {
      return { status: "noodler_account_not_found" } as const;
    }
    const settings = await noodle.getSettings();
    const connections = createConnectionsStorage(db);
    const connectionId = request.connectionId ?? settings.generationConnectionId;
    const connection = connectionId
      ? await connections.getWithKey(connectionId)
      : await connections.getDefaultForAgents();
    if (!connection) return { status: "connection_not_found" } as const;
    const generated = await generateNoodlerPost(db, {
      account,
      request,
      connection,
      media,
      admissionMode,
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

export type NoodlerRefreshNowResult = { status: "disabled" } | { status: "ok"; outcomes: NoodlerRefreshNowOutcome[] };

/**
 * Global "Refresh NoodleR now": explicit user-authorized work, separate from the automatic
 * reserve budget and publication clock.
 */
export async function refreshAllNoodlerCreatorsNow(db: DB): Promise<NoodlerRefreshNowResult> {
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
    async (account): Promise<NoodlerRefreshNowOutcome> => {
      const result = await generateAndApplyNoodlerPost(db, {
        mode: "noodler",
        targetAccountId: account.id,
        format: "caption",
        access: "locked",
      });
      // "disabled"/"busy" are no-op refreshes, not failures; surface them as skipped so the
      // client doesn't lump a busy creator in with a real generation/connection failure.
      const status = result.status === "disabled" || result.status === "busy" ? "skipped" : result.status;
      return { accountId: account.id, status };
    },
  );

  const outcomes = settled.map((entry, index): NoodlerRefreshNowOutcome => {
    if (entry.status === "fulfilled") return entry.value;
    logger.error(entry.reason, "[noodler] Global refresh failed for creator %s", prioritized[index]!.id);
    return { accountId: prioritized[index]!.id, status: "error" };
  });
  return { status: "ok", outcomes };
}

export async function refreshTargetedNoodlerCreatorsNow(
  db: DB,
  accountIds: string[],
  executionId?: string,
  access: NoodlePostAccess = "locked",
): Promise<NoodlerRefreshNowResult> {
  const noodle = createSlurpStorage(db);

  // One creator named twice is one refresh, not two: the per-account lock already serializes the
  // work, but without this the response reports that creator twice.
  const targetAccountIds = [...new Set(accountIds)];
  const settled = await settleAgentJobsWithConcurrencyLimit(
    targetAccountIds,
    MAX_CONCURRENT_MANUAL_REFRESH,
    async (accountId): Promise<NoodlerRefreshNowOutcome> => {
      const result = await generateAndApplyNoodlerPost(db, {
        mode: "noodler",
        targetAccountId: accountId,
        format: "caption",
        access,
        executionId,
      });
      const status = result.status === "disabled" || result.status === "busy" ? "skipped" : result.status;
      return { accountId, status };
    },
  );
  const outcomes = settled.map((entry, index): NoodlerRefreshNowOutcome => {
    if (entry.status === "fulfilled") return entry.value;
    logger.error(entry.reason, "[noodler] Targeted refresh failed for creator %s", targetAccountIds[index]!);
    return { accountId: targetAccountIds[index]!, status: "error" };
  });
  return { status: "ok", outcomes };
}

export async function createNoodlerPost(
  db: DB,
  input: NoodlerPostCreateInput & {
    format?: NoodlerContentFormat;
    lockedFollowUpPostId?: string;
    lockedFollowUp?: { title: string; content: string };
  },
  media?: NoodlerPostMediaUpload,
): Promise<CreateNoodlerPostResult> {
  const noodle = createSlurpStorage(db);
  const locked = await tryNoodlerAccountOperation(input.targetAccountId, async () => {
    const postId = media ? newId() : undefined;
    let lockedFollowUpPostId = input.lockedFollowUpPostId;
    const pendingLockedFollowUp = input.lockedFollowUp;
    if (lockedFollowUpPostId) {
      const followUp = await noodle.getNoodlerPostById(lockedFollowUpPostId);
      if (!followUp || followUp.authorAccountId !== input.targetAccountId || followUp.access !== "locked") {
        return { status: "noodler_account_not_found" } as const;
      }
    } else if (pendingLockedFollowUp) lockedFollowUpPostId = newId();
    const persist = (persistedMedia?: { imageUrl: string; noodlerMediaPath: string }) => {
      const create = async () => {
        let createdFollowUp = false;
        try {
          if (pendingLockedFollowUp && lockedFollowUpPostId) {
            const followUp = await noodle.createNoodlerPost({
              id: lockedFollowUpPostId,
              authorAccountId: input.targetAccountId,
              title: pendingLockedFollowUp.title,
              content: pendingLockedFollowUp.content,
              source: "manual",
              access: "locked",
              metadata: {
                noodlerContentFormat: "long_form",
                ...noodlerUnlockPriceMetadata(),
              },
            });
            if (!followUp) return null;
            createdFollowUp = true;
          }
          const post = await noodle.createNoodlerPost({
            id: postId,
            authorAccountId: input.targetAccountId,
            title: input.title,
            content: input.content,
            source: "manual",
            access: input.access,
            imageUrl: persistedMedia?.imageUrl ?? null,
            metadata: {
              noodlerContentFormat: input.format ?? "caption",
              // Stored at creation so an unlock price stays put across refreshes and edits.
              ...(input.access === "locked" ? noodlerUnlockPriceMetadata() : {}),
              ...(lockedFollowUpPostId ? { noodlerLockedFollowUpPostId: lockedFollowUpPostId } : {}),
              ...(input.poll ? { poll: createNoodlePoll(input.poll) } : {}),
              ...(input.imageCrop ? { imageCrop: input.imageCrop } : {}),
              ...(persistedMedia ? { noodlerMediaPath: persistedMedia.noodlerMediaPath } : {}),
            },
          });
          if (!post && createdFollowUp && lockedFollowUpPostId) await noodle.deleteNoodlerPost(lockedFollowUpPostId);
          return post;
        } catch (error) {
          if (createdFollowUp && lockedFollowUpPostId) await noodle.deleteNoodlerPost(lockedFollowUpPostId);
          throw error;
        }
      };
      return create();
    };
    const post =
      media && postId
        ? await persistNoodlerPostWithUploadedMedia(input.targetAccountId, postId, media, persist)
        : await persist();
    if (!post) return { status: "noodler_account_not_found" } as const;
    // The post is already persisted. Failing the request over cleanup would report a successful
    // create as an error and invite a retry that posts twice; a stale prepared post is the
    // cheaper problem, and the next reconciliation pass drops it anyway.
    try {
      await noodle.discardPreparedPostsAfterManualPost(input.targetAccountId, post.createdAt);
    } catch (error) {
      logger.warn(
        error,
        "[noodler] Failed to discard prepared posts after a manual post for %s",
        input.targetAccountId,
      );
    }
    return { status: "created", post } as const;
  });
  return locked.acquired ? locked.value : { status: "busy" };
}

export async function updateNoodlerPostWithMedia(
  db: DB,
  id: string,
  accountId: string,
  input: NoodlerPostUpdateInput,
  media: NoodlerPostMediaUpload,
): Promise<UpdateNoodlerPostResult> {
  const noodle = createSlurpStorage(db);
  const existing = await noodle.getNoodlerPostById(id);
  if (!existing) return { status: "noodler_post_not_found" };
  if (existing.authorAccountId !== accountId) return { status: "forbidden" };

  const locked = await tryNoodlerAccountOperation(existing.authorAccountId, async () => {
    const current = await noodle.getNoodlerPostById(id);
    if (!current) return { status: "noodler_post_not_found" } as const;
    if (current.authorAccountId !== accountId) return { status: "forbidden" } as const;
    const oldPath = readNoodlerMediaPath(current);
    const post = await persistNoodlerPostWithUploadedMedia(current.authorAccountId, id, media, (persistedMedia) =>
      noodle.updateNoodlerPost(id, input, persistedMedia),
    );
    if (!post) return { status: "noodler_post_not_found" } as const;
    const nextPath = readNoodlerMediaPath(post);
    if (oldPath !== nextPath) unlinkNoodlerMedia(oldPath);
    return { status: "updated", post } as const;
  });
  return locked.acquired ? locked.value : { status: "busy" };
}
