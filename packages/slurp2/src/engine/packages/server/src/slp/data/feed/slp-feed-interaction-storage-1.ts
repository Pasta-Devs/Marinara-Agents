import { and, desc, eq, gt, inArray, or } from "../../../db/file-query.js";
import { DEFAULT_NOODLER_CREATOR_REPLIES_PER_24_HOURS, NoodleInteraction, NoodlePost } from "@marinara-engine/shared";
import { NOODLER_FAN_IDENTITY_PREFIX } from "../../modules/audience/slp-fan-identity-provider.js";
import { canViewNoodlerPost, isNoodlerHiddenFromViewer } from "../../base/identity/slp-access.js";
import {
  noodleAccounts,
  noodleAccountSubscriptions,
  noodleActivityDigests,
  noodleInteractions,
  noodlePosts,
  noodlePostUnlocks,
  noodlerCreatorReplyClaims,
} from "../../../db/schema/slurp.js";
import { newId, now } from "../../../utils/id-generator.js";
import { ROLLING_DAY_MS } from "../host/slp-storage-constants.js";
import { parseStringArray } from "../../modules/records/slp-storage-model.js";
import type {
  PublicCreateInteractionCommand,
  PublicRemoveInteractionCommand,
  NoodlerCreatorReplyClaimResult,
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
    async listInteractions(postIds: string[] = []): Promise<NoodleInteraction[]> {
      if (postIds.length === 0) return [];
      const publicPostIds = new Set(
        (await Promise.all(postIds.map((postId) => this.getPostById(postId))))
          .filter((post): post is NoodlePost => post !== null)
          .map((post) => post.id),
      );
      if (publicPostIds.size === 0) return [];
      const slurpSourceAccountIds = new Set((await this.listAccounts()).map((account) => account.id));
      const rows = await db
        .select()
        .from(noodleInteractions)
        .where(inArray(noodleInteractions.postId, [...publicPostIds]))
        .orderBy(noodleInteractions.createdAt);
      return rows.filter((row) => slurpSourceAccountIds.has(row.actorAccountId)).map(mapInteraction);
    },
    async listRepliesByActorSince(actorAccountId: string, since: string, limit = 100): Promise<NoodleInteraction[]> {
      if (!(await this.getAccountById(actorAccountId))) return [];
      const slurpSourceAccountIds = (await this.listAccounts()).map((account) => account.id);
      if (slurpSourceAccountIds.length === 0) return [];
      const publicPostIds = new Set(
        (
          await db
            .select({ id: noodlePosts.id })
            .from(noodlePosts)
            .where(inArray(noodlePosts.authorAccountId, slurpSourceAccountIds))
        ).map((post) => post.id),
      );
      const rows = await db
        .select()
        .from(noodleInteractions)
        .where(
          and(
            eq(noodleInteractions.actorAccountId, actorAccountId),
            eq(noodleInteractions.type, "reply"),
            gt(noodleInteractions.createdAt, since),
          ),
        )
        .orderBy(desc(noodleInteractions.createdAt))
        .limit(Math.max(1, Math.min(200, Math.floor(limit))));
      return rows.filter((row) => publicPostIds.has(row.postId)).map(mapInteraction);
    },
    async getInteractionById(id: string): Promise<NoodleInteraction | null> {
      const rows = await db.select().from(noodleInteractions).where(eq(noodleInteractions.id, id));
      const row = rows[0];
      if (!row) return null;
      const [post, actor] = await Promise.all([this.getPostById(row.postId), this.getAccountById(row.actorAccountId)]);
      return post && actor ? mapInteraction(row) : null;
    },
    async updateInteraction(
      id: string,
      input: { content?: string | null; imageUrl?: string | null },
    ): Promise<NoodleInteraction | null> {
      const existing = await this.getInteractionById(id);
      if (!existing) return null;
      await db
        .update(noodleInteractions)
        .set({
          ...(input.content !== undefined && { content: input.content?.trim() || null }),
          ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl?.trim() || null }),
        })
        .where(eq(noodleInteractions.id, id));
      return this.getInteractionById(id);
    },
    async deleteInteractionById(id: string): Promise<NoodleInteraction[]> {
      const existing = await this.getInteractionById(id);
      if (!existing) return [];
      const rows = await db.select().from(noodleInteractions).where(eq(noodleInteractions.postId, existing.postId));
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
        .from(noodleActivityDigests)
        .where(inArray(noodleActivityDigests.sourceInteractionId, [...deletedIds]));
      if (
        relatedDigests.some(
          (digest) => !parseStringArray(digest.accountIds).every((accountId) => slurpSourceAccountIds.has(accountId)),
        )
      ) {
        return [];
      }
      await db.transaction(async (tx) => {
        await tx
          .delete(noodleActivityDigests)
          .where(inArray(noodleActivityDigests.sourceInteractionId, [...deletedIds]));
        // This is the route comment deletion actually takes, and the subtree it removes can
        // contain both a comment that owns a creator-reply claim and the reply that claim
        // points at. Either one left behind keeps consuming the rolling allowance forever.
        await tx
          .delete(noodlerCreatorReplyClaims)
          .where(inArray(noodlerCreatorReplyClaims.parentInteractionId, [...deletedIds]));
        await tx
          .delete(noodlerCreatorReplyClaims)
          .where(inArray(noodlerCreatorReplyClaims.replyInteractionId, [...deletedIds]));
        await tx.delete(noodleInteractions).where(inArray(noodleInteractions.id, [...deletedIds]));
      });
      return deletedRows.map(mapInteraction);
    },
    async createInteraction(postId: string, input: PublicCreateInteractionCommand): Promise<NoodleInteraction | null> {
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
    async deleteInteraction(postId: string, input: PublicRemoveInteractionCommand): Promise<NoodleInteraction | null> {
      const post = await this.getPostById(postId);
      if (!post) return null;
      return deleteStoredInteraction(postId, input, "protect-public-digests");
    },
    // Callers pass post IDs already resolved from NoodleR-account queries
    // (listNoodlerPostsByAccounts), so this trusts them and issues a single bulk
    // read instead of re-validating each ID with getNoodlerPostById (2N reads).
    async getNoodlerInteractionById(id: string): Promise<NoodleInteraction | null> {
      const rows = await db.select().from(noodleInteractions).where(eq(noodleInteractions.id, id));
      return rows[0] ? mapInteraction(rows[0]) : null;
    },
    /** Replace a placeholder comment with the model's rewrite. Text only. */
    async rewriteNoodlerInteractionContent(id: string, content: string): Promise<void> {
      await db.update(noodleInteractions).set({ content }).where(eq(noodleInteractions.id, id));
    },
    async listNoodlerInteractions(noodlerPostIds: string[] = []): Promise<NoodleInteraction[]> {
      if (noodlerPostIds.length === 0) return [];
      const rows = await db
        .select()
        .from(noodleInteractions)
        .where(inArray(noodleInteractions.postId, noodlerPostIds))
        .orderBy(noodleInteractions.createdAt);
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
      ceiling = DEFAULT_NOODLER_CREATOR_REPLIES_PER_24_HOURS,
    ): Promise<NoodlerCreatorReplyClaimResult> {
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
            .from(noodleAccounts)
            .where(and(eq(noodleAccounts.id, creatorAccountId), eq(noodleAccounts.platform, "slurp"))),
          tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, parentInteractionId)),
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
          .from(noodlePosts)
          .where(and(eq(noodlePosts.id, postId), eq(noodlePosts.authorAccountId, creatorAccountId)));
        const postRow = postRows[0];
        if (!postRow) return { status: "ineligible" };

        const creator = mapAccount(creatorRow);
        if (isNoodlerHiddenFromViewer(creator, viewerPersonaId)) return { status: "ineligible" };
        const post = mapManagedPost(postRow);
        const [subscriptions, unlocks] = await Promise.all([
          tx
            .select()
            .from(noodleAccountSubscriptions)
            .where(
              and(
                eq(noodleAccountSubscriptions.viewerAccountId, viewerPersonaId),
                eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId),
              ),
            ),
          tx
            .select()
            .from(noodlePostUnlocks)
            .where(and(eq(noodlePostUnlocks.viewerAccountId, viewerPersonaId), eq(noodlePostUnlocks.postId, post.id))),
        ]);
        if (
          !canViewNoodlerPost({
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
        const expiredOrphans = (await tx.select().from(noodlerCreatorReplyClaims)).filter(
          (row) => !row.replyInteractionId && !(row.claimedAt > cutoff),
        );
        if (expiredOrphans.length > 0) {
          await tx.delete(noodlerCreatorReplyClaims).where(
            inArray(
              noodlerCreatorReplyClaims.id,
              expiredOrphans.map((row) => row.id),
            ),
          );
        }
        // Duplicate detection runs after the eligibility and access checks above so a caller
        // replaying known IDs cannot read back a stored reply it is no longer entitled to,
        // and after the prune so an expired orphan claim does not block the same comment forever.
        const existingClaims = await tx
          .select()
          .from(noodlerCreatorReplyClaims)
          .where(
            and(
              eq(noodlerCreatorReplyClaims.parentInteractionId, parentInteractionId),
              eq(noodlerCreatorReplyClaims.creatorAccountId, creatorAccountId),
            ),
          );
        const existing = existingClaims[0];
        if (existing) {
          const replyRows = existing.replyInteractionId
            ? await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, existing.replyInteractionId))
            : [];
          return { status: "duplicate", interaction: replyRows[0] ? mapInteraction(replyRows[0]) : null };
        }
        // The reply can also outlive its claim if a crash lost the claim write. Reconcile against
        // the replies themselves so the comment cannot collect a second creator reply.
        const strandedReply = (
          await tx
            .select()
            .from(noodleInteractions)
            .where(
              and(
                eq(noodleInteractions.parentInteractionId, parentInteractionId),
                eq(noodleInteractions.actorAccountId, creatorAccountId),
                eq(noodleInteractions.type, "reply"),
              ),
            )
        )[0];
        if (strandedReply) {
          await tx.insert(noodlerCreatorReplyClaims).values({
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
          .from(noodlerCreatorReplyClaims)
          .where(gt(noodlerCreatorReplyClaims.claimedAt, cutoff));
        if (recentClaims.length >= ceiling) return { status: "exhausted" };

        const claimId = newId();
        await tx.insert(noodlerCreatorReplyClaims).values({
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
