import { and, eq, inArray, isNotNull, isNull, lt, or } from "../../../db/file-query.js";
import {
  SlpCreatePostInput,
  SlpCreatorPostUpdateInput,
  SlpPostUpdateInput,
} from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import { SlpCreatorManagedPost, SlpPost, SlpPostSource } from "../../../../../shared/src/slp/slp-social.types.js";
import {
  slpAccounts,
  slpActivityDigests,
  slpInteractions,
  slpPosts,
  slpPostMedia,
  slpPostUnlocks,
  slpCreatorCreatorReplyClaims,
} from "../../../db/schema/slurp.js";
import { NOODLER_CONTENT_HARD_MAX_LENGTH } from "../../base/prompting/slp-content-format.js";
import { newId, now } from "../../../utils/id-generator.js";
import { parseRecord, parseStringArray } from "../../modules/records/slp-storage-model.js";
import {
  snapshotForAccount,
  mapPost,
  mapManagedPost,
  updatePollMetadata,
  imageClaimIsAvailable,
} from "../host/slp-storage-mappers.js";
import type { SlurpStorageContext } from "../host/slp-storage-context.js";

export function createFeedPostStorage2(context: SlurpStorageContext) {
  const {
    db,
    settingsStore,
    characters,
    readProjectEntries,
    isProjectEntry,
    loadProjects,
    writeProjects,
    readCreatorPrices,
    economyFrom,
    compensate,
    writeWallet,
    restoreSetting,
    restoreWallet,
    enqueueFinancial,
    writeEarnings,
    mutateCreatorStateNow,
    creditEarningsNow,
    getWalletNow,
    pruneFinishedRefreshRuns,
    reconcilePublicHandles,
    insertInteraction,
    normalizeLegacyNoodlerToggleInteraction,
    upsertPollVote,
    deleteInteractionChildren,
    deleteStoredInteraction,
  } = context;
  const storage = {
    async createPost(
      input: Omit<SlpCreatePostInput, "authorKind" | "authorEntityId"> & {
        authorAccountId: string;
        source?: SlpPostSource;
        metadata?: Record<string, unknown>;
      },
    ): Promise<SlpPost | null> {
      const account = await this.getAccountById(input.authorAccountId);
      if (!account) return null;
      const timestamp = now();
      const id = newId();
      await db.insert(slpPosts).values({
        id,
        authorAccountId: input.authorAccountId,
        title: null,
        content: input.content,
        imageUrl: input.imageUrl ?? null,
        imagePrompt: input.imagePrompt ?? null,
        parentPostId: input.parentPostId ?? null,
        quotePostId: input.quotePostId ?? null,
        source: input.source ?? "manual",
        access: "public",
        metadata: JSON.stringify(input.metadata ?? {}),
        authorSnapshot: JSON.stringify(snapshotForAccount(account)),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return (await this.getPostById(id))!;
    },
    async getPostById(id: string): Promise<SlpPost | null> {
      const rows = await db.select().from(slpPosts).where(eq(slpPosts.id, id));
      const row = rows[0];
      if (!row || !(await this.getAccountById(row.authorAccountId))) return null;
      return mapPost(row);
    },
    async updatePostMedia(
      id: string,
      input: { imageUrl?: string | null; imagePrompt?: string | null; metadata?: Record<string, unknown> },
    ): Promise<SlpPost | null> {
      const existing = await this.getPostById(id);
      if (!existing) return null;
      await db
        .update(slpPosts)
        .set({
          ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
          ...(input.imagePrompt !== undefined && { imagePrompt: input.imagePrompt }),
          ...((input.imageUrl !== undefined || input.imagePrompt !== undefined) && {
            imageClaimToken: null,
            imageClaimLeaseUntil: null,
          }),
          ...(input.metadata !== undefined && {
            metadata: JSON.stringify({ ...existing.metadata, ...input.metadata }),
          }),
          updatedAt: now(),
        })
        .where(eq(slpPosts.id, id));
      return this.getPostById(id);
    },
    async claimPostImage(id: string, token: string, leaseUntil: string, at = now()): Promise<SlpPost | null> {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(slpPosts).where(eq(slpPosts.id, id));
        const row = rows[0];
        if (!row || !imageClaimIsAvailable(row, at)) return null;
        await tx
          .update(slpPosts)
          .set({ imageClaimToken: token, imageClaimLeaseUntil: leaseUntil })
          .where(
            and(
              eq(slpPosts.id, id),
              isNull(slpPosts.imageUrl),
              isNotNull(slpPosts.imagePrompt),
              or(
                isNull(slpPosts.imageClaimToken),
                isNull(slpPosts.imageClaimLeaseUntil),
                lt(slpPosts.imageClaimLeaseUntil, at),
              ),
            ),
          );
        const claimedRows = await tx
          .select()
          .from(slpPosts)
          .where(and(eq(slpPosts.id, id), eq(slpPosts.imageClaimToken, token)));
        if (!claimedRows[0]) return null;
        return mapPost(row);
      });
    },
    async renewPostImageClaim(id: string, token: string, leaseUntil: string, at = now()): Promise<boolean> {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(slpPosts).where(eq(slpPosts.id, id));
        const row = rows[0];
        if (
          !row ||
          row.imageClaimToken !== token ||
          !row.imageClaimLeaseUntil ||
          row.imageClaimLeaseUntil <= at ||
          !row.imagePrompt ||
          row.imageUrl
        ) {
          return false;
        }
        await tx
          .update(slpPosts)
          .set({ imageClaimLeaseUntil: leaseUntil })
          .where(and(eq(slpPosts.id, id), eq(slpPosts.imageClaimToken, token)));
        return true;
      });
    },
    async releasePostImageClaim(id: string, token: string): Promise<boolean> {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(slpPosts).where(eq(slpPosts.id, id));
        if (rows[0]?.imageClaimToken !== token) return false;
        await tx
          .update(slpPosts)
          .set({ imageClaimToken: null, imageClaimLeaseUntil: null })
          .where(and(eq(slpPosts.id, id), eq(slpPosts.imageClaimToken, token)));
        return true;
      });
    },
    /** Give a post back its previous picture unless another request now holds its image claim. */
    async restorePostImageIfUnclaimed(id: string, imageUrl: string, at = now()): Promise<boolean> {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(slpPosts).where(eq(slpPosts.id, id));
        const row = rows[0];
        if (!row || row.imageUrl) return false;
        if (row.imageClaimToken && row.imageClaimLeaseUntil && row.imageClaimLeaseUntil > at) return false;
        await tx.update(slpPosts).set({ imageUrl, updatedAt: at }).where(eq(slpPosts.id, id));
        return true;
      });
    },
    async finalizePostImageClaim(
      id: string,
      token: string,
      input: { imageUrl: string | null; imagePrompt?: string | null; metadata: Record<string, unknown> },
      at = now(),
    ): Promise<boolean> {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(slpPosts).where(eq(slpPosts.id, id));
        const row = rows[0];
        if (
          !row ||
          row.imageClaimToken !== token ||
          !row.imageClaimLeaseUntil ||
          row.imageClaimLeaseUntil <= at ||
          !row.imagePrompt ||
          row.imageUrl
        ) {
          return false;
        }
        // Finalization owns the terminal transition: drop the pending-review marker so a
        // finalized (success or failed) row never keeps contradictory pending lifecycle state.
        const mergedMetadata = { ...parseRecord(row.metadata), ...input.metadata };
        delete mergedMetadata.imagePendingReview;
        if (input.imageUrl) {
          delete mergedMetadata.imageGenerationFailed;
          delete mergedMetadata.imageGenerationError;
          delete mergedMetadata.imageRetryPrompt;
          delete mergedMetadata.imageRetryNegativePrompt;
        }
        await tx
          .update(slpPosts)
          .set({
            imageUrl: input.imageUrl,
            ...(input.imagePrompt !== undefined && { imagePrompt: input.imagePrompt }),
            metadata: JSON.stringify(mergedMetadata),
            imageClaimToken: null,
            imageClaimLeaseUntil: null,
            updatedAt: now(),
          })
          .where(and(eq(slpPosts.id, id), eq(slpPosts.imageClaimToken, token)));
        return true;
      });
    },
    async updatePost(id: string, input: SlpPostUpdateInput): Promise<SlpPost | null> {
      const updated = await db.transaction(async (tx) => {
        const postRows = await tx.select().from(slpPosts).where(eq(slpPosts.id, id));
        const existing = postRows[0];
        if (!existing) return false;
        const authorRows = await tx
          .select()
          .from(slpAccounts)
          .where(and(eq(slpAccounts.id, existing.authorAccountId), eq(slpAccounts.platform, "slurp")));
        if (!authorRows[0]) return false;
        const nextMetadata = updatePollMetadata(mapPost(existing).metadata, input.poll);
        if (input.imageCrop === null) delete nextMetadata.imageCrop;
        else if (input.imageCrop !== undefined) nextMetadata.imageCrop = input.imageCrop;
        await tx
          .update(slpPosts)
          .set({
            ...(input.content !== undefined && {
              content: input.content.trim().slice(0, NOODLER_CONTENT_HARD_MAX_LENGTH),
            }),
            ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
            ...(input.imagePrompt !== undefined && { imagePrompt: input.imagePrompt }),
            ...((input.imageUrl !== undefined || input.imagePrompt !== undefined) && {
              imageClaimToken: null,
              imageClaimLeaseUntil: null,
            }),
            ...((input.imageCrop !== undefined || input.poll !== undefined) && {
              metadata: JSON.stringify(nextMetadata),
            }),
            updatedAt: now(),
          })
          .where(eq(slpPosts.id, id));
        return true;
      });
      if (!updated) return null;
      return this.getPostById(id);
    },
    async deletePost(id: string): Promise<SlpPost | null> {
      const existing = await this.getPostById(id);
      if (!existing) return null;
      const interactions = await db.select().from(slpInteractions).where(eq(slpInteractions.postId, id));
      const slurpSourceAccountIds = new Set(
        (await this.listAccounts({ includeHidden: true })).map((account) => account.id),
      );
      if (interactions.some((interaction) => !slurpSourceAccountIds.has(interaction.actorAccountId))) return null;
      const interactionIds = interactions.map((interaction) => interaction.id);
      const digests = await db.select().from(slpActivityDigests);
      const relatedDigests = digests.filter(
        (digest) =>
          digest.sourcePostId === id ||
          (digest.sourceInteractionId !== null && interactionIds.includes(digest.sourceInteractionId)),
      );
      if (
        relatedDigests.some(
          (digest) => !parseStringArray(digest.accountIds).every((accountId) => slurpSourceAccountIds.has(accountId)),
        )
      ) {
        return null;
      }
      await db.transaction(async (tx) => {
        await tx.delete(slpPostUnlocks).where(eq(slpPostUnlocks.postId, id));
        await tx.delete(slpInteractions).where(eq(slpInteractions.postId, id));
        await tx.delete(slpPostMedia).where(eq(slpPostMedia.postId, id));
        await tx.delete(slpActivityDigests).where(eq(slpActivityDigests.sourcePostId, id));
        await tx.delete(slpPosts).where(eq(slpPosts.id, id));
      });
      return existing;
    },
    /** Keep a vision description of a post picture, tied to the picture it describes. */
    async setNoodlerPostImageDescription(id: string, description: string, source: string): Promise<void> {
      await db.transaction(async (tx) => {
        const row = (await tx.select().from(slpPosts).where(eq(slpPosts.id, id)))[0];
        if (!row) return;
        const metadata = {
          ...parseRecord(row.metadata),
          imageDescription: description,
          imageDescriptionSource: source,
        };
        await tx
          .update(slpPosts)
          .set({ metadata: JSON.stringify(metadata) })
          .where(eq(slpPosts.id, id));
      });
    },
    async updateNoodlerPost(
      id: string,
      input: SlpCreatorPostUpdateInput,
      media?: { imageUrl: string; noodlerMediaPath: string },
    ): Promise<SlpCreatorManagedPost | null> {
      const imageChanged = Boolean(media || input.removeImage);
      const updated = await db.transaction(async (tx) => {
        const postRows = await tx.select().from(slpPosts).where(eq(slpPosts.id, id));
        const existing = postRows[0];
        if (!existing) return false;
        const authorRows = await tx
          .select()
          .from(slpAccounts)
          .where(and(eq(slpAccounts.id, existing.authorAccountId), eq(slpAccounts.platform, "slurp")));
        if (!authorRows[0]) return false;
        const nextMetadata = updatePollMetadata(mapManagedPost(existing).metadata, input.poll);
        if (imageChanged) {
          for (const key of [
            "noodlerMediaPath",
            "imageGenerated",
            "imageProvider",
            "imageModel",
            "imageStyleProfileId",
            "imageGenerationFailed",
            "imageGenerationError",
            "imagePendingReview",
          ]) {
            delete nextMetadata[key];
          }
        }
        if (media) nextMetadata.noodlerMediaPath = media.noodlerMediaPath;
        if (input.removeImage || input.imageCrop === null) delete nextMetadata.imageCrop;
        else if (input.imageCrop !== undefined) nextMetadata.imageCrop = input.imageCrop;
        await tx
          .update(slpPosts)
          .set({
            ...(input.title !== undefined && { title: input.title }),
            ...(input.content !== undefined && {
              content: input.content.trim().slice(0, NOODLER_CONTENT_HARD_MAX_LENGTH),
            }),
            ...(imageChanged && {
              imageUrl: media?.imageUrl ?? null,
              imagePrompt: null,
              imageClaimToken: null,
              imageClaimLeaseUntil: null,
            }),
            ...((imageChanged || input.imageCrop !== undefined || input.poll !== undefined) && {
              metadata: JSON.stringify(nextMetadata),
            }),
            updatedAt: now(),
          })
          .where(eq(slpPosts.id, id));
        return true;
      });
      if (!updated) return null;
      return this.getNoodlerPostById(id);
    },
    async deleteNoodlerPost(id: string): Promise<SlpCreatorManagedPost | null> {
      const existing = await this.getNoodlerPostById(id);
      if (!existing) return null;
      const interactionRows = await db.select().from(slpInteractions).where(eq(slpInteractions.postId, id));
      const interactionIds = interactionRows.map((interaction) => interaction.id);
      await db.transaction(async (tx) => {
        await tx.delete(slpActivityDigests).where(eq(slpActivityDigests.sourcePostId, id));
        if (interactionIds.length > 0) {
          await tx.delete(slpActivityDigests).where(inArray(slpActivityDigests.sourceInteractionId, interactionIds));
        }
        await tx.delete(slpPostUnlocks).where(eq(slpPostUnlocks.postId, id));
        await tx.delete(slpCreatorCreatorReplyClaims).where(eq(slpCreatorCreatorReplyClaims.postId, id));
        await tx.delete(slpInteractions).where(eq(slpInteractions.postId, id));
        await tx.delete(slpPosts).where(eq(slpPosts.id, id));
        await tx._fileStore.flush();
      });
      return existing;
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
