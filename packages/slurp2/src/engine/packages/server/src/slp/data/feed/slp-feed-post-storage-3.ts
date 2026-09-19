import { inArray } from "../../../db/file-query.js";
import { slpActivityDigests, slpInteractions, slpPosts, slpRefreshRuns } from "../../../db/schema/slurp.js";
import { parseStringArray } from "../../modules/records/slp-storage-model.js";
import type { SlurpStorageContext } from "../host/slp-storage-context.js";

export function createFeedPostStorage3(context: SlurpStorageContext) {
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
    async resetTimeline(): Promise<void> {
      const slurpSourceAccountIds = (await this.listAccounts({ includeHidden: true })).map((account) => account.id);
      const publicPosts =
        slurpSourceAccountIds.length > 0
          ? await db.select().from(slpPosts).where(inArray(slpPosts.authorAccountId, slurpSourceAccountIds))
          : [];
      const publicPostIds = publicPosts.map((post) => post.id);
      const publicInteractions = await db
        .select()
        .from(slpInteractions)
        .where(inArray(slpInteractions.postId, publicPostIds));
      const slurpSourceAccountIdSet = new Set(slurpSourceAccountIds);
      const protectedPostIds = new Set(
        publicInteractions
          .filter((interaction) => !slurpSourceAccountIdSet.has(interaction.actorAccountId))
          .map((interaction) => interaction.postId),
      );
      const interactionPostById = new Map(
        publicInteractions.map((interaction) => [interaction.id, interaction.postId]),
      );
      const digests = await db.select().from(slpActivityDigests);
      for (const digest of digests) {
        if (parseStringArray(digest.accountIds).every((accountId) => slurpSourceAccountIdSet.has(accountId))) continue;
        if (digest.sourcePostId && publicPostIds.includes(digest.sourcePostId)) {
          protectedPostIds.add(digest.sourcePostId);
        }
        if (digest.sourceInteractionId) {
          const postId = interactionPostById.get(digest.sourceInteractionId);
          if (postId) protectedPostIds.add(postId);
        }
      }
      const deletablePostIds = publicPostIds.filter((postId) => !protectedPostIds.has(postId));
      const deletableInteractionIds = publicInteractions
        .filter((interaction) => deletablePostIds.includes(interaction.postId))
        .map((interaction) => interaction.id);
      await db.transaction(async (tx) => {
        if (deletableInteractionIds.length > 0) {
          await tx
            .delete(slpActivityDigests)
            .where(inArray(slpActivityDigests.sourceInteractionId, deletableInteractionIds));
        }
        if (deletablePostIds.length > 0) {
          await tx.delete(slpActivityDigests).where(inArray(slpActivityDigests.sourcePostId, deletablePostIds));
          await tx.delete(slpInteractions).where(inArray(slpInteractions.postId, deletablePostIds));
          await tx.delete(slpPosts).where(inArray(slpPosts.id, deletablePostIds));
        }
        await tx.delete(slpRefreshRuns);
      });
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
