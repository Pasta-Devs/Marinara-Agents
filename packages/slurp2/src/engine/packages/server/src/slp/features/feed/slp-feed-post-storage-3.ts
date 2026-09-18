import { inArray } from "../../../db/file-query.js";
import { noodleActivityDigests, noodleInteractions, noodlePosts, noodleRefreshRuns } from "../../../db/schema/slurp.js";
import { parseStringArray } from "../../base/host/slp-storage-model.js";
import type { SlurpStorageContext } from "../../base/host/slp-storage-context.js";

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
          ? await db.select().from(noodlePosts).where(inArray(noodlePosts.authorAccountId, slurpSourceAccountIds))
          : [];
      const publicPostIds = publicPosts.map((post) => post.id);
      const publicInteractions = await db
        .select()
        .from(noodleInteractions)
        .where(inArray(noodleInteractions.postId, publicPostIds));
      const slurpSourceAccountIdSet = new Set(slurpSourceAccountIds);
      const protectedPostIds = new Set(
        publicInteractions
          .filter((interaction) => !slurpSourceAccountIdSet.has(interaction.actorAccountId))
          .map((interaction) => interaction.postId),
      );
      const interactionPostById = new Map(
        publicInteractions.map((interaction) => [interaction.id, interaction.postId]),
      );
      const digests = await db.select().from(noodleActivityDigests);
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
            .delete(noodleActivityDigests)
            .where(inArray(noodleActivityDigests.sourceInteractionId, deletableInteractionIds));
        }
        if (deletablePostIds.length > 0) {
          await tx.delete(noodleActivityDigests).where(inArray(noodleActivityDigests.sourcePostId, deletablePostIds));
          await tx.delete(noodleInteractions).where(inArray(noodleInteractions.postId, deletablePostIds));
          await tx.delete(noodlePosts).where(inArray(noodlePosts.id, deletablePostIds));
        }
        await tx.delete(noodleRefreshRuns);
      });
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
