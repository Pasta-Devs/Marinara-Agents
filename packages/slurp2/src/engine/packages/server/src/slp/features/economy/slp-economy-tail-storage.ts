import { and, desc, eq } from "../../../db/file-query.js";
import { NoodlePostUnlock, NoodlerManagedPost } from "@marinara-engine/shared";
import {
  earn as earnCreatorIncome,
  readSlurpEarnings,
  slurpEarningsKey,
  SlurpEarnings,
  SlurpEarningsEntryKind,
} from "../../../services/slurp/slurp-earnings.js";
import { noodlePosts, noodlePostUnlocks } from "../../../db/schema/slurp.js";
import { noodleRefreshSchedulerStatus } from "../../../services/slurp/slurp-refresh-schedule.js";
import type { SlurpBootstrap } from "../../base/settings/slp-settings.js";
import { mapManagedPost, mapPostUnlock } from "../../base/host/slp-storage-mappers.js";
import type { SlurpStorageContext } from "../../base/host/slp-storage-context.js";

export function createEconomyTailStorage1(context: SlurpStorageContext) {
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
    /** One project's own posts, newest first, for the Studio and for generation continuity. */
    async listPostsByProject(projectId: string, limit = 8): Promise<NoodlerManagedPost[]> {
      const rows = await db
        .select()
        .from(noodlePosts)
        .where(eq(noodlePosts.projectId, projectId))
        .orderBy(desc(noodlePosts.createdAt))
        .limit(Math.max(1, Math.min(50, Math.floor(limit))));
      return rows.map(mapManagedPost);
    },
    async getEarnings(creatorAccountId: string): Promise<SlurpEarnings> {
      return readSlurpEarnings(await settingsStore.get(slurpEarningsKey(creatorAccountId)));
    },
    async creditEarnings(
      creatorAccountId: string,
      kind: Exclude<SlurpEarningsEntryKind, "payout" | "reversal">,
      amount: number,
      note?: string,
    ): Promise<void> {
      const run = enqueueFinancial(async () => {
        const current = await this.getEarnings(creatorAccountId);
        const next = earnCreatorIncome(current, kind, amount, new Date(), note);
        if (next !== current) await writeEarnings(creatorAccountId, next);
      });
      await run;
    },
    async listPostUnlocksForViewer(viewerAccountId: string): Promise<NoodlePostUnlock[]> {
      const rows = await db
        .select()
        .from(noodlePostUnlocks)
        .where(eq(noodlePostUnlocks.viewerAccountId, viewerAccountId));
      return rows.map(mapPostUnlock);
    },
    async bootstrap(): Promise<SlurpBootstrap> {
      const posts = await this.listPosts({ limit: 160 });
      const scheduler = noodleRefreshSchedulerStatus(await this.ensureRefreshSchedule(new Date()), new Date());
      return {
        settings: await this.getSettings(),
        scheduler,
        accounts: await this.listAccounts(),
        posts,
        interactions: await this.listInteractions(posts.map((post) => post.id)),
        digests: await this.listDigests({ limit: 80 }),
      };
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
