import type { DB } from "../../db/connection.js";
import { and, eq, inArray, lt } from "../../db/file-query.js";
import {
  noodleAccounts,
  noodleActivityDigests,
  noodleInteractions,
  noodlePosts,
  noodlePostUnlocks,
  noodlerCreatorReplyClaims,
  noodlerPreparedPosts,
  slurpCommissions,
  slurpMessages,
} from "../../db/schema/slurp.js";
import { now } from "../../utils/id-generator.js";
import { createSlurpStorage, type SlurpSettings } from "../storage/slurp.storage.js";
import { trySlurpDataDeletion } from "./slurp-operation-lock.js";
import { selectSlurpAutopurge } from "./slurp-autopurge-plan.js";
import { estimateNoodlerMediaRemovalBytes, NOODLER_MEDIA_PREFIX, unlinkNoodlerMedia } from "./slurp-media.js";
import { moveSlurpAutopurgeDate, nextSlurpAutopurgeRunAt } from "../../../../shared/src/slurp-autopurge-time.js";

export { moveSlurpAutopurgeDate, nextSlurpAutopurgeRunAt } from "../../../../shared/src/slurp-autopurge-time.js";

export type SlurpAutopurgeResult = {
  cutoff: string;
  deletedPosts: number;
  removedPostMedia: number;
  removedMessageMedia: number;
  nextRunAt: string | null;
};

export type SlurpAutopurgePreview = {
  cutoff: string;
  affectedPosts: number;
  postsToDelete: number;
  postMediaFiles: number;
  messageMediaFiles: number;
  estimatedReclaimableBytes: number;
};

function record(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function ownedMediaPath(metadata: unknown): string | null {
  const value = record(metadata).noodlerMediaPath;
  return typeof value === "string" && value.startsWith(NOODLER_MEDIA_PREFIX) ? value : null;
}

function withoutMediaMetadata(metadata: unknown): Record<string, unknown> {
  const next = { ...record(metadata) };
  for (const key of [
    "noodlerMediaPath",
    "imageCrop",
    "imageGenerated",
    "imageProvider",
    "imageModel",
    "imageStyleProfileId",
    "imageGenerationFailed",
    "imageGenerationError",
    "imagePendingReview",
  ]) {
    delete next[key];
  }
  return next;
}

async function planSlurpAutopurge(db: DB, settings: SlurpSettings) {
  const cutoff = moveSlurpAutopurgeDate(
    new Date(),
    settings.autopurgeRetentionValue,
    settings.autopurgeRetentionUnit,
    -1,
  ).toISOString();
  const creatorIds = (await db.select().from(noodleAccounts)).map((account) => account.id);
  const selection = selectSlurpAutopurge({
    cutoff,
    creatorIds,
    posts: creatorIds.length
      ? await db
          .select()
          .from(noodlePosts)
          .where(and(inArray(noodlePosts.authorAccountId, creatorIds), lt(noodlePosts.createdAt, cutoff)))
      : [],
    messages: settings.autopurgeIncludeMessageMedia
      ? await db.select().from(slurpMessages).where(lt(slurpMessages.createdAt, cutoff))
      : [],
    keepPosts: settings.autopurgeKeepPosts,
    includeMessageMedia: settings.autopurgeIncludeMessageMedia,
    mediaPathOf: ownedMediaPath,
  });
  const { oldPosts, postMedia, messageMedia, mediaPaths } = selection;
  return {
    cutoff,
    ...selection,
    preview: {
      cutoff,
      affectedPosts: oldPosts.length,
      postsToDelete: selection.postsToDelete.length,
      postMediaFiles: new Set(postMedia).size,
      messageMediaFiles: new Set(messageMedia).size,
      estimatedReclaimableBytes: mediaPaths.reduce(
        (total, mediaPath) => total + estimateNoodlerMediaRemovalBytes(mediaPath),
        0,
      ),
    } satisfies SlurpAutopurgePreview,
  };
}

export async function previewSlurpAutopurge(db: DB, settings: SlurpSettings): Promise<SlurpAutopurgePreview> {
  return (await planSlurpAutopurge(db, settings)).preview;
}

async function purgeUnlocked(db: DB, settings: SlurpSettings): Promise<Omit<SlurpAutopurgeResult, "nextRunAt">> {
  const plan = await planSlurpAutopurge(db, settings);
  const { cutoff, oldPosts, oldMessages, postMedia, messageMedia } = plan;
  const removedMediaPaths = new Set<string>();
  for (const path of plan.mediaPaths) {
    if (unlinkNoodlerMedia(path)) removedMediaPaths.add(path);
  }
  const mediaRemovalSucceeded = (metadata: unknown): boolean => {
    const path = ownedMediaPath(metadata);
    return !path || removedMediaPaths.has(path);
  };
  // Retain a failed path's database reference so the next purge selects and retries it.
  const postsToDelete = plan.postsToDelete.filter((post) => mediaRemovalSucceeded(post.metadata));
  const postsToStrip = settings.autopurgeKeepPosts
    ? oldPosts.filter((post) => {
        const path = ownedMediaPath(post.metadata);
        return path ? removedMediaPaths.has(path) : false;
      })
    : [];
  const messagesToStrip = oldMessages.filter((message) => {
    const path = ownedMediaPath(message.metadata);
    return path ? removedMediaPaths.has(path) : false;
  });
  const deletedPostIds = postsToDelete.map((post) => post.id);
  const deletedInteractionIds = deletedPostIds.length
    ? (await db.select().from(noodleInteractions).where(inArray(noodleInteractions.postId, deletedPostIds))).map(
        (interaction) => interaction.id,
      )
    : [];

  await db.transaction(async (tx) => {
    for (const post of postsToStrip) {
      await tx
        .update(noodlePosts)
        .set({
          imageUrl: null,
          imageClaimToken: null,
          imageClaimLeaseUntil: null,
          metadata: JSON.stringify(withoutMediaMetadata(post.metadata)),
          updatedAt: now(),
        })
        .where(eq(noodlePosts.id, post.id));
    }
    for (const message of messagesToStrip) {
      await tx
        .update(slurpMessages)
        .set({
          imageUrl: null,
          imageClaimToken: null,
          imageClaimLeaseUntil: null,
          metadata: JSON.stringify(withoutMediaMetadata(message.metadata)),
        })
        .where(eq(slurpMessages.id, message.id));
      await tx
        .update(slurpCommissions)
        .set({ mediaPath: null, updatedAt: now() })
        .where(eq(slurpCommissions.deliveryMessageId, message.id));
    }
    if (deletedPostIds.length > 0) {
      await tx.update(noodlePosts).set({ parentPostId: null }).where(inArray(noodlePosts.parentPostId, deletedPostIds));
      await tx.update(noodlePosts).set({ quotePostId: null }).where(inArray(noodlePosts.quotePostId, deletedPostIds));
      await tx
        .update(noodlerPreparedPosts)
        .set({ publishedPostId: null, updatedAt: now() })
        .where(inArray(noodlerPreparedPosts.publishedPostId, deletedPostIds));
      await tx.delete(noodlePostUnlocks).where(inArray(noodlePostUnlocks.postId, deletedPostIds));
      await tx.delete(noodlerCreatorReplyClaims).where(inArray(noodlerCreatorReplyClaims.postId, deletedPostIds));
      await tx.delete(noodleInteractions).where(inArray(noodleInteractions.postId, deletedPostIds));
      await tx.delete(noodleActivityDigests).where(inArray(noodleActivityDigests.sourcePostId, deletedPostIds));
      if (deletedInteractionIds.length > 0) {
        await tx
          .delete(noodleActivityDigests)
          .where(inArray(noodleActivityDigests.sourceInteractionId, deletedInteractionIds));
      }
      await tx.delete(noodlePosts).where(inArray(noodlePosts.id, deletedPostIds));
    }
    await tx._fileStore.flush();
  });

  return {
    cutoff,
    deletedPosts: postsToDelete.length,
    removedPostMedia: new Set(postMedia.filter((path) => removedMediaPaths.has(path))).size,
    removedMessageMedia: new Set(messageMedia.filter((path) => removedMediaPaths.has(path))).size,
  };
}

/** Manual and scheduled purges share this operation, including the global destructive-work lock. */
export async function runSlurpAutopurge(
  db: DB,
  { reschedule = true }: { reschedule?: boolean } = {},
): Promise<{ status: "completed"; result: SlurpAutopurgeResult } | { status: "busy" }> {
  const storage = createSlurpStorage(db);
  const locked = await trySlurpDataDeletion(async () => {
    const settings = await storage.getSettings();
    const result = await purgeUnlocked(db, settings);
    // Manual runs keep a user-chosen future date; only scheduled runs (or a stale date) advance it.
    const existing = settings.autopurgeNextRunAt;
    const keep = !reschedule && existing && Date.parse(existing) > Date.now();
    const nextRunAt = !settings.autopurgeEnabled ? null : keep ? existing : nextSlurpAutopurgeRunAt(settings);
    if (nextRunAt !== existing) await storage.updateSettings({ autopurgeNextRunAt: nextRunAt });
    return { ...result, nextRunAt };
  });
  return locked.acquired ? { status: "completed", result: locked.value } : { status: "busy" };
}
