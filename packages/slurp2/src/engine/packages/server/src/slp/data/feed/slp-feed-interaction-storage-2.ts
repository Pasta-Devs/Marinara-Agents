import { and, eq, gt } from "../../../db/file-query.js";
import { DEFAULT_SLP_CREATOR_REPLIES_PER_24_HOURS } from "../../../../../shared/src/slp/slp-social.schema.js";
import { SlpAccount, SlpCreatorManagedPost, SlpInteraction } from "../../../../../shared/src/slp/slp-social.types.js";
import { spend } from "../../modules/economy/slp-wallet.js";
import { canViewCreatorPost, isCreatorHiddenFromViewer } from "../../base/identity/slp-access.js";
import {
  slpAccounts,
  slpAccountSubscriptions,
  slpInteractions,
  slpPosts,
  slpPostUnlocks,
  slpCreatorCreatorReplyClaims,
  slurpPopulation,
} from "../../../db/schema/slurp.js";
import { newId, now } from "../../../utils/id-generator.js";
import { ROLLING_DAY_MS } from "../host/slp-storage-constants.js";
import { mapAccount, snapshotForAccount, mapManagedPost, mapInteraction } from "../host/slp-storage-mappers.js";
import type { SlurpStorageContext } from "../host/slp-storage-context.js";

export function createFeedInteractionStorage2(context: SlurpStorageContext) {
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
    /**
     * Claim a creator reply to a comment from the generated audience.
     *
     * Deliberately *not* a relaxation of `claimNoodlerCreatorReply`. That function's access checks
     * — hidden-creator, subscription, unlock — exist because the player is asking for a reply to
     * their own comment, and without them the endpoint would hand back text about a locked post
     * they never paid for. Loosening it to let a synthetic fan through would weaken a gate that
     * protects a real person, to serve a caller that is not one.
     *
     * So this is a second, narrower door. The commenter must be a generated population member on
     * the creator's own post, and there is no viewer to protect content from. It shares the parts
     * that actually matter — the one-reply-per-comment dedupe and the 24-hour spend ceiling — so
     * audience replies and player replies draw on the same budget and cannot double-answer.
     */
    async claimNoodlerAudienceReply(
      creatorAccountId: string,
      parentInteractionId: string,
      at = now(),
      ceiling = DEFAULT_SLP_CREATOR_REPLIES_PER_24_HOURS,
    ): Promise<
      | {
          status: "claimed";
          claimId: string;
          creator: SlpAccount;
          post: SlpCreatorManagedPost;
          parent: SlpInteraction;
          commenter: { id: string; handle: string; displayName: string };
        }
      | { status: "ineligible" }
      | { status: "duplicate" }
      | { status: "exhausted" }
    > {
      return db.transaction(async (tx) => {
        const parentRow = (
          await tx.select().from(slpInteractions).where(eq(slpInteractions.id, parentInteractionId))
        )[0];
        if (!parentRow || parentRow.type !== "reply" || !parentRow.content?.trim()) return { status: "ineligible" };
        if (parentRow.actorAccountId === creatorAccountId) return { status: "ineligible" };
        // Only somebody the world invented. A real persona's comment belongs to the player-facing
        // path, with its access checks intact.
        const commenterRow = (
          await tx.select().from(slurpPopulation).where(eq(slurpPopulation.id, parentRow.actorAccountId))
        )[0];
        if (!commenterRow) return { status: "ineligible" };
        const creatorRow = (
          await tx
            .select()
            .from(slpAccounts)
            .where(and(eq(slpAccounts.id, creatorAccountId), eq(slpAccounts.platform, "slurp")))
        )[0];
        if (!creatorRow) return { status: "ineligible" };
        const postRow = (
          await tx
            .select()
            .from(slpPosts)
            .where(and(eq(slpPosts.id, String(parentRow.postId)), eq(slpPosts.authorAccountId, creatorAccountId)))
        )[0];
        if (!postRow) return { status: "ineligible" };

        const cutoff = new Date(Date.parse(at) - ROLLING_DAY_MS).toISOString();
        const existing = (
          await tx
            .select()
            .from(slpCreatorCreatorReplyClaims)
            .where(
              and(
                eq(slpCreatorCreatorReplyClaims.parentInteractionId, parentInteractionId),
                eq(slpCreatorCreatorReplyClaims.creatorAccountId, creatorAccountId),
              ),
            )
        )[0];
        if (existing) return { status: "duplicate" };
        // The free tier may already have answered this comment from the bank. One reply per
        // comment, whichever tier wrote it.
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
        if (strandedReply) return { status: "duplicate" };

        const recentClaims = await tx
          .select()
          .from(slpCreatorCreatorReplyClaims)
          .where(gt(slpCreatorCreatorReplyClaims.claimedAt, cutoff));
        if (recentClaims.length >= ceiling) return { status: "exhausted" };

        const claimId = newId();
        await tx.insert(slpCreatorCreatorReplyClaims).values({
          id: claimId,
          postId: String(postRow.id),
          parentInteractionId,
          creatorAccountId,
          replyInteractionId: null,
          claimedAt: at,
        });
        return {
          status: "claimed",
          claimId,
          creator: mapAccount(creatorRow),
          post: mapManagedPost(postRow),
          parent: mapInteraction(parentRow),
          commenter: {
            id: String(commenterRow.id),
            handle: String(commenterRow.handle),
            displayName: String(commenterRow.displayName),
          },
        };
      });
    },
    /**
     * Release a claim whose generation never produced a reply. The claim is the dedupe key
     * for "this comment already has a creator reply", so keeping it after a failure would
     * block that comment forever; no provider call succeeded, so nothing is billed twice.
     */
    async releaseNoodlerCreatorReplyClaim(claimId: string): Promise<void> {
      await db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(slpCreatorCreatorReplyClaims)
          .where(eq(slpCreatorCreatorReplyClaims.id, claimId));
        if (!rows[0] || rows[0].replyInteractionId) return;
        await tx.delete(slpCreatorCreatorReplyClaims).where(eq(slpCreatorCreatorReplyClaims.id, claimId));
      });
    },
    async finalizeNoodlerCreatorReplyClaim(claimId: string, content: string): Promise<SlpInteraction | null> {
      return db.transaction(async (tx) => {
        const claimRows = await tx
          .select()
          .from(slpCreatorCreatorReplyClaims)
          .where(eq(slpCreatorCreatorReplyClaims.id, claimId));
        const claim = claimRows[0];
        if (!claim) return null;
        if (claim.replyInteractionId) {
          const existing = await tx
            .select()
            .from(slpInteractions)
            .where(eq(slpInteractions.id, claim.replyInteractionId));
          return existing[0] ? mapInteraction(existing[0]) : null;
        }
        const [creatorRows, parentRows, postRows] = await Promise.all([
          tx
            .select()
            .from(slpAccounts)
            .where(and(eq(slpAccounts.id, claim.creatorAccountId), eq(slpAccounts.platform, "slurp"))),
          tx.select().from(slpInteractions).where(eq(slpInteractions.id, claim.parentInteractionId)),
          tx.select().from(slpPosts).where(eq(slpPosts.id, claim.postId)),
        ]);
        const creatorRow = creatorRows[0];
        const parentRow = parentRows[0];
        const postRow = postRows[0];
        if (
          !creatorRow ||
          !parentRow ||
          !postRow ||
          parentRow.type !== "reply" ||
          parentRow.postId !== postRow.id ||
          postRow.authorAccountId !== creatorRow.id
        ) {
          return null;
        }
        const creator = mapAccount(creatorRow);
        const parentActorRows = await tx
          .select()
          .from(slpAccounts)
          .where(and(eq(slpAccounts.id, parentRow.actorAccountId), eq(slpAccounts.platform, "slurp")));
        const viewerPersonaId =
          parentActorRows[0]?.sourceKind === "persona"
            ? (parentActorRows[0].sourceEntityId ?? parentRow.actorAccountId)
            : parentRow.actorAccountId;
        if (isCreatorHiddenFromViewer(creator, viewerPersonaId)) return null;
        const post = mapManagedPost(postRow);
        const [subscriptions, unlocks] = await Promise.all([
          tx
            .select()
            .from(slpAccountSubscriptions)
            .where(
              and(
                eq(slpAccountSubscriptions.viewerAccountId, viewerPersonaId),
                eq(slpAccountSubscriptions.creatorAccountId, creatorRow.id),
              ),
            ),
          tx
            .select()
            .from(slpPostUnlocks)
            .where(and(eq(slpPostUnlocks.viewerAccountId, viewerPersonaId), eq(slpPostUnlocks.postId, postRow.id))),
        ]);
        if (
          !canViewCreatorPost({
            post,
            subscribed: subscriptions.length > 0,
            unlockedPostIds: new Set(unlocks.map((unlock) => unlock.postId)),
          })
        ) {
          return null;
        }
        // Crash recovery: the reply row and the claim link are separate durable writes, so a
        // crash between them leaves a reply whose claim is still unlinked. Adopt that reply
        // instead of writing a second one — one reply per parent comment per creator.
        const orphanedReply = (
          await tx
            .select()
            .from(slpInteractions)
            .where(
              and(
                eq(slpInteractions.parentInteractionId, parentRow.id),
                eq(slpInteractions.actorAccountId, creatorRow.id),
                eq(slpInteractions.type, "reply"),
              ),
            )
        )[0];
        if (orphanedReply) {
          await tx
            .update(slpCreatorCreatorReplyClaims)
            .set({ replyInteractionId: orphanedReply.id })
            .where(eq(slpCreatorCreatorReplyClaims.id, claimId));
          return mapInteraction(orphanedReply);
        }
        const replyId = newId();
        await tx.insert(slpInteractions).values({
          id: replyId,
          postId: postRow.id,
          parentInteractionId: parentRow.id,
          actorAccountId: creatorRow.id,
          type: "reply",
          content: content.trim(),
          imageUrl: null,
          actorSnapshot: JSON.stringify(snapshotForAccount(creator)),
          createdAt: now(),
        });
        await tx
          .update(slpCreatorCreatorReplyClaims)
          .set({ replyInteractionId: replyId })
          .where(eq(slpCreatorCreatorReplyClaims.id, claimId));
        const rows = await tx.select().from(slpInteractions).where(eq(slpInteractions.id, replyId));
        return rows[0] ? mapInteraction(rows[0]) : null;
      });
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
