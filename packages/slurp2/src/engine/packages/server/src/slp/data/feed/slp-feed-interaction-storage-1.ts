import { and, desc, eq, gt, inArray, or } from "../../../db/file-query.js";
import { DEFAULT_SLP_CREATOR_REPLIES_PER_24_HOURS } from "../../../../../shared/src/slp/slp-social.schema.js";
import { SlpInteraction, SlpPost } from "../../../../../shared/src/slp/slp-social.types.js";
import { NOODLER_FAN_IDENTITY_PREFIX } from "../../modules/audience/slp-fan-identity-provider.js";
import { canViewCreatorPost, isCreatorHiddenFromViewer } from "../../base/identity/slp-access.js";
import {
  slpAccounts,
  slpAccountSubscriptions,
  slpActivityDigests,
  slpInteractions,
  slpPosts,
  slpPostUnlocks,
  slpCreatorCreatorReplyClaims,
} from "../../../db/schema/slurp.js";
import { newId, now } from "../../../utils/id-generator.js";
import { ROLLING_DAY_MS } from "../host/slp-storage-constants.js";
import { parseStringArray } from "../../modules/records/slp-storage-model.js";
import type {
  PublicCreateInteractionCommand,
  PublicRemoveInteractionCommand,
  SlpCreatorReplyClaimResult,
} from "../../modules/records/slp-storage-model.js";
import { mapAccount, mapManagedPost, mapInteraction } from "../host/slp-storage-mappers.js";
import type { SlurpStorageContext } from "../host/slp-storage-context.js";

export function createFeedInteractionStorage1(context: SlurpStorageContext) {
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
    async listInteractions(postIds: string[] = []): Promise<SlpInteraction[]> {
      if (postIds.length === 0) return [];
      const publicPostIds = new Set(
        (await Promise.all(postIds.map((postId) => this.getPostById(postId))))
          .filter((post): post is SlpPost => post !== null)
          .map((post) => post.id),
      );
      if (publicPostIds.size === 0) return [];
      const slurpSourceAccountIds = new Set((await this.listAccounts()).map((account) => account.id));
      const rows = await db
        .select()
        .from(slpInteractions)
        .where(inArray(slpInteractions.postId, [...publicPostIds]))
        .orderBy(slpInteractions.createdAt);
      return rows.filter((row) => slurpSourceAccountIds.has(row.actorAccountId)).map(mapInteraction);
    },
    async listRepliesByActorSince(actorAccountId: string, since: string, limit = 100): Promise<SlpInteraction[]> {
      if (!(await this.getAccountById(actorAccountId))) return [];
      const slurpSourceAccountIds = (await this.listAccounts()).map((account) => account.id);
      if (slurpSourceAccountIds.length === 0) return [];
      const publicPostIds = new Set(
        (
          await db
            .select({ id: slpPosts.id })
            .from(slpPosts)
            .where(inArray(slpPosts.authorAccountId, slurpSourceAccountIds))
        ).map((post) => post.id),
      );
      const rows = await db
        .select()
        .from(slpInteractions)
        .where(
          and(
            eq(slpInteractions.actorAccountId, actorAccountId),
            eq(slpInteractions.type, "reply"),
            gt(slpInteractions.createdAt, since),
          ),
        )
        .orderBy(desc(slpInteractions.createdAt))
        .limit(Math.max(1, Math.min(200, Math.floor(limit))));
      return rows.filter((row) => publicPostIds.has(row.postId)).map(mapInteraction);
    },
    async getInteractionById(id: string): Promise<SlpInteraction | null> {
      const rows = await db.select().from(slpInteractions).where(eq(slpInteractions.id, id));
      const row = rows[0];
      if (!row) return null;
      const [post, actor] = await Promise.all([this.getPostById(row.postId), this.getAccountById(row.actorAccountId)]);
      return post && actor ? mapInteraction(row) : null;
    },
    async updateInteraction(
      id: string,
      input: { content?: string | null; imageUrl?: string | null },
    ): Promise<SlpInteraction | null> {
      const existing = await this.getInteractionById(id);
      if (!existing) return null;
      await db
        .update(slpInteractions)
        .set({
          ...(input.content !== undefined && { content: input.content?.trim() || null }),
          ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl?.trim() || null }),
        })
        .where(eq(slpInteractions.id, id));
      return this.getInteractionById(id);
    },
    async deleteInteractionById(id: string): Promise<SlpInteraction[]> {
      const existing = await this.getInteractionById(id);
      if (!existing) return [];
      const rows = await db.select().from(slpInteractions).where(eq(slpInteractions.postId, existing.postId));
      const deletedIds = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const row of rows) {
          if (deletedIds.has(row.id) || !row.parentInteractionId || !deletedIds.has(row.parentInteractionId)) continue;
          deletedIds.add(row.id);
          changed = true;
        }
      }
      const deletedRows = rows.filter((row) => deletedIds.has(row.id));
      // The guard is "every actor in this subtree is an account this installation owns". A
      // creator reply is authored by a NoodleR stage account, so leaving those out made a
      // comment undeletable as soon as its creator answered it.
      const slurpSourceAccountIds = new Set(
        (await this.listAccounts({ includeHidden: true })).map((account) => account.id),
      );
      const knownAccountIds = new Set([
        ...slurpSourceAccountIds,
        ...(await this.listNoodlerAccounts({ includeHidden: true })).map((account) => account.id),
      ]);
      if (
        deletedRows.some(
          (row) =>
            !knownAccountIds.has(row.actorAccountId) && !row.actorAccountId.startsWith(NOODLER_FAN_IDENTITY_PREFIX),
        )
      ) {
        return [];
      }
      const relatedDigests = await db
        .select()
        .from(slpActivityDigests)
        .where(inArray(slpActivityDigests.sourceInteractionId, [...deletedIds]));
      if (
        relatedDigests.some(
          (digest) => !parseStringArray(digest.accountIds).every((accountId) => slurpSourceAccountIds.has(accountId)),
        )
      ) {
        return [];
      }
      await db.transaction(async (tx) => {
        await tx.delete(slpActivityDigests).where(inArray(slpActivityDigests.sourceInteractionId, [...deletedIds]));
        // This is the route comment deletion actually takes, and the subtree it removes can
        // contain both a comment that owns a creator-reply claim and the reply that claim
        // points at. Either one left behind keeps consuming the rolling allowance forever.
        await tx
          .delete(slpCreatorCreatorReplyClaims)
          .where(inArray(slpCreatorCreatorReplyClaims.parentInteractionId, [...deletedIds]));
        await tx
          .delete(slpCreatorCreatorReplyClaims)
          .where(inArray(slpCreatorCreatorReplyClaims.replyInteractionId, [...deletedIds]));
        await tx.delete(slpInteractions).where(inArray(slpInteractions.id, [...deletedIds]));
      });
      return deletedRows.map(mapInteraction);
    },
    async createInteraction(postId: string, input: PublicCreateInteractionCommand): Promise<SlpInteraction | null> {
      const parentInteractionId = input.parentInteractionId ?? null;
      if (input.type === "vote") {
        if (parentInteractionId) return null;
        const actor = await this.getAccountById(input.actorAccountId);
        if (!actor) return null;
        return upsertPollVote(
          postId,
          actor,
          actor.id,
          input.content?.trim() ?? "",
          "noodle",
          input.imageUrl?.trim() || null,
        );
      }

      const [post, actor] = await Promise.all([this.getPostById(postId), this.getAccountById(input.actorAccountId)]);
      if (!post || !actor) return null;

      if (parentInteractionId) {
        const parent = await this.getInteractionById(parentInteractionId);
        if (!parent || parent.postId !== postId || parent.type !== "reply") return null;
      }

      return insertInteraction(postId, {
        actor,
        type: input.type,
        content: input.content,
        imageUrl: input.imageUrl,
        parentInteractionId,
      });
    },
    async deleteInteraction(postId: string, input: PublicRemoveInteractionCommand): Promise<SlpInteraction | null> {
      const post = await this.getPostById(postId);
      if (!post) return null;
      return deleteStoredInteraction(postId, input, "protect-public-digests");
    },
    // Callers pass post IDs already resolved from NoodleR-account queries
    // (listNoodlerPostsByAccounts), so this trusts them and issues a single bulk
    // read instead of re-validating each ID with getNoodlerPostById (2N reads).
    async getNoodlerInteractionById(id: string): Promise<SlpInteraction | null> {
      const rows = await db.select().from(slpInteractions).where(eq(slpInteractions.id, id));
      return rows[0] ? mapInteraction(rows[0]) : null;
    },
    /** Replace a placeholder comment with the model's rewrite. Text only. */
    async rewriteNoodlerInteractionContent(id: string, content: string): Promise<void> {
      await db.update(slpInteractions).set({ content }).where(eq(slpInteractions.id, id));
    },
    async listNoodlerInteractions(noodlerPostIds: string[] = []): Promise<SlpInteraction[]> {
      if (noodlerPostIds.length === 0) return [];
      const rows = await db
        .select()
        .from(slpInteractions)
        .where(inArray(slpInteractions.postId, noodlerPostIds))
        .orderBy(slpInteractions.createdAt);
      const visibleIds = new Set((await this.listAccounts()).map((account) => account.id));
      const hiddenIds = new Set(
        (await this.listAccounts({ includeHidden: true }))
          .filter((account) => !visibleIds.has(account.id))
          .map((account) => account.id),
      );
      return rows.filter((row) => !hiddenIds.has(row.actorAccountId)).map(mapInteraction);
    },
    async claimNoodlerCreatorReply(
      creatorAccountId: string,
      postId: string,
      parentInteractionId: string,
      viewerPersonaId: string,
      viewerActorAccountId: string,
      at = now(),
      ceiling = DEFAULT_SLP_CREATOR_REPLIES_PER_24_HOURS,
    ): Promise<SlpCreatorReplyClaimResult> {
      const viewer = await this.getViewer(viewerPersonaId);
      if (!viewer) return { status: "ineligible" };
      const viewerActor =
        (await this.getNoodlerAccountById(viewerActorAccountId)) ??
        (viewerActorAccountId === viewerPersonaId ? viewer : null);
      if (!viewerActor) return { status: "ineligible" };
      return db.transaction(async (tx) => {
        const [creatorRows, parentRows] = await Promise.all([
          tx
            .select()
            .from(slpAccounts)
            .where(and(eq(slpAccounts.id, creatorAccountId), eq(slpAccounts.platform, "slurp"))),
          tx.select().from(slpInteractions).where(eq(slpInteractions.id, parentInteractionId)),
        ]);
        const creatorRow = creatorRows[0];
        const parentRow = parentRows[0];
        if (
          !creatorRow ||
          !parentRow ||
          parentRow.type !== "reply" ||
          (!parentRow.content?.trim() && !parentRow.imageUrl?.trim()) ||
          parentRow.postId !== postId ||
          ![viewerActor.id, viewerPersonaId].includes(parentRow.actorAccountId) ||
          (creatorRow.sourceKind === "persona" && creatorRow.sourceEntityId === viewerPersonaId) ||
          parentRow.actorAccountId === creatorAccountId
        ) {
          return { status: "ineligible" };
        }
        const postRows = await tx
          .select()
          .from(slpPosts)
          .where(and(eq(slpPosts.id, postId), eq(slpPosts.authorAccountId, creatorAccountId)));
        const postRow = postRows[0];
        if (!postRow) return { status: "ineligible" };

        const creator = mapAccount(creatorRow);
        if (isCreatorHiddenFromViewer(creator, viewerPersonaId)) return { status: "ineligible" };
        const post = mapManagedPost(postRow);
        const [subscriptions, unlocks] = await Promise.all([
          tx
            .select()
            .from(slpAccountSubscriptions)
            .where(
              and(
                eq(slpAccountSubscriptions.viewerAccountId, viewerPersonaId),
                eq(slpAccountSubscriptions.creatorAccountId, creatorAccountId),
              ),
            ),
          tx
            .select()
            .from(slpPostUnlocks)
            .where(and(eq(slpPostUnlocks.viewerAccountId, viewerPersonaId), eq(slpPostUnlocks.postId, post.id))),
        ]);
        if (
          !canViewCreatorPost({
            post,
            subscribed: subscriptions.length > 0,
            unlockedPostIds: new Set(unlocks.map((unlock) => unlock.postId)),
          })
        ) {
          return { status: "ineligible" };
        }

        const cutoff = new Date(Date.parse(at) - ROLLING_DAY_MS).toISOString();
        // Prune only expired claims that never produced a reply. A claim that did is the
        // permanent "this comment already has a creator reply" key and must outlive the
        // budget window; an orphan one gates nothing once it leaves it.
        // Budget membership is `claimedAt > cutoff`, so anything not greater is outside the
        // window: pruning must use the exact complement or a claim sitting on the boundary is
        // neither counted nor released, and blocks its comment forever.
        const expiredOrphans = (await tx.select().from(slpCreatorCreatorReplyClaims)).filter(
          (row) => !row.replyInteractionId && !(row.claimedAt > cutoff),
        );
        if (expiredOrphans.length > 0) {
          await tx.delete(slpCreatorCreatorReplyClaims).where(
            inArray(
              slpCreatorCreatorReplyClaims.id,
              expiredOrphans.map((row) => row.id),
            ),
          );
        }
        // Duplicate detection runs after the eligibility and access checks above so a caller
        // replaying known IDs cannot read back a stored reply it is no longer entitled to,
        // and after the prune so an expired orphan claim does not block the same comment forever.
        const existingClaims = await tx
          .select()
          .from(slpCreatorCreatorReplyClaims)
          .where(
            and(
              eq(slpCreatorCreatorReplyClaims.parentInteractionId, parentInteractionId),
              eq(slpCreatorCreatorReplyClaims.creatorAccountId, creatorAccountId),
            ),
          );
        const existing = existingClaims[0];
        if (existing) {
          const replyRows = existing.replyInteractionId
            ? await tx.select().from(slpInteractions).where(eq(slpInteractions.id, existing.replyInteractionId))
            : [];
          return { status: "duplicate", interaction: replyRows[0] ? mapInteraction(replyRows[0]) : null };
        }
        // The reply can also outlive its claim if a crash lost the claim write. Reconcile against
        // the replies themselves so the comment cannot collect a second creator reply.
        const strandedReply = (
          await tx
            .select()
            .from(slpInteractions)
            .where(
              and(
                eq(slpInteractions.parentInteractionId, parentInteractionId),
                eq(slpInteractions.actorAccountId, creatorAccountId),
                eq(slpInteractions.type, "reply"),
              ),
            )
        )[0];
        if (strandedReply) {
          await tx.insert(slpCreatorCreatorReplyClaims).values({
            id: newId(),
            postId: post.id,
            parentInteractionId,
            creatorAccountId,
            replyInteractionId: strandedReply.id,
            claimedAt: at,
          });
          return { status: "duplicate", interaction: mapInteraction(strandedReply) };
        }

        const recentClaims = await tx
          .select()
          .from(slpCreatorCreatorReplyClaims)
          .where(gt(slpCreatorCreatorReplyClaims.claimedAt, cutoff));
        if (recentClaims.length >= ceiling) return { status: "exhausted" };

        const claimId = newId();
        await tx.insert(slpCreatorCreatorReplyClaims).values({
          id: claimId,
          postId: post.id,
          parentInteractionId,
          creatorAccountId,
          replyInteractionId: null,
          claimedAt: at,
        });
        return {
          status: "claimed",
          claimId,
          creator,
          post,
          parent: mapInteraction(parentRow),
          viewer: viewerActor,
        };
      });
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
