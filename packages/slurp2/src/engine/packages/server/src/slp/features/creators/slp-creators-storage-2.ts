import { and, desc, eq, inArray, or } from "../../../db/file-query.js";
import { NoodleAccount, NoodleAccountKind } from "@marinara-engine/shared";
import { slurpProjectsKey, slurpArcAutoKey, slurpArcConfigKey } from "../../../services/slurp/slurp-project.js";
import { unlinkNoodlerMedia } from "../../../services/slurp/slurp-media.js";
import {
  noodleAccounts,
  noodleAccountSubscriptions,
  noodleActivityDigests,
  noodleInteractions,
  noodlePosts,
  noodlePostUnlocks,
  noodleRefreshRuns,
  noodlerCreatorReplyClaims,
  noodlerAutomaticAttempts,
  noodlerPreparedPosts,
  noodlerReserveState,
  noodlerFanActivityState,
  slurpPopulation,
  slurpAudienceTies,
  slurpEvents,
  slurpPendingText,
  noodlerFirstPostJobs,
  slurpMessageClaims,
  slurpMessages,
  slurpReplyBubbles,
  slurpThreads,
  slurpCommissions,
  slurpImprovementJobs,
  slurpImprovementProposals,
} from "../../../db/schema/slurp.js";
import { SLURP_CREATOR_MESSAGING_KEY } from "../../../services/slurp/slurp-messaging.js";
import { now } from "../../../utils/id-generator.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import {
  parsePersistedNoodleRefreshSchedule,
  reconcileNoodleRefreshSchedule,
  PersistedNoodleRefreshSchedule,
} from "../../../services/slurp/slurp-refresh-schedule.js";
import { withoutHiddenAmbientAccounts } from "../../../services/slurp/slurp-ambient-profiles.js";
import {
  SLURP_SETTINGS_KEY,
  SLURP_CREATOR_STATE_KEY,
  NOODLE_REFRESH_SCHEDULE_KEY,
  slurpViewerSettingsKey,
  slurpSettingsUpdateQueue,
  planUnusedSlurpData,
} from "../../base/host/slp-storage-constants.js";
import { parseRecord } from "../../base/host/slp-storage-model.js";
import type { SlurpAccount, SlurpAccountRole } from "../../base/host/slp-storage-model.js";
import { isSlurpViewerActorAccount, normalizeSlurpSettings } from "../../base/settings/slp-settings.js";
import type { SlurpSettings, SlurpSettingsUpdateInput } from "../../base/settings/slp-settings.js";
import { mapAccount } from "../../base/host/slp-storage-mappers.js";
import type { SlurpStorageContext } from "../../base/host/slp-storage-context.js";

export function createCreatorsStorage2(context: SlurpStorageContext) {
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
    async deleteAllSlurpData(): Promise<{ deletedCreators: number; deletedPosts: number }> {
      const accounts = await db.select().from(noodleAccounts).where(eq(noodleAccounts.platform, "slurp"));
      const accountIds = accounts.map((account) => account.id);
      const personaIds = (await characters.listPersonas()).map((persona) => persona.id);
      const posts = accountIds.length
        ? await db.select().from(noodlePosts).where(inArray(noodlePosts.authorAccountId, accountIds))
        : [];
      const postIds = posts.map((post) => post.id);
      await db.transaction(async (tx) => {
        for (const table of [
          noodleActivityDigests,
          noodleRefreshRuns,
          noodlerFanActivityState,
          noodlerAutomaticAttempts,
          noodlerReserveState,
          noodlerPreparedPosts,
          noodlerCreatorReplyClaims,
          // Direct messages are Slurp data too. Left out, "delete all Slurp data" would keep
          // every thread and leave the next install reading someone else's conversations.
          slurpMessageClaims,
          slurpMessages,
          slurpReplyBubbles,
          slurpCommissions,
          slurpThreads,
          // Everything below had no deletion path at all, not even in this full reset. A fresh
          // install inherited the previous one's audience, world events, and queued work.
          noodlerFirstPostJobs,
          slurpEvents,
          slurpAudienceTies,
          slurpPopulation,
          slurpPendingText,
          slurpImprovementProposals,
          slurpImprovementJobs,
        ]) {
          await tx.delete(table);
        }
        if (postIds.length) {
          await tx.delete(noodleInteractions).where(inArray(noodleInteractions.postId, postIds));
          await tx.delete(noodlePostUnlocks).where(inArray(noodlePostUnlocks.postId, postIds));
          await tx.delete(noodlePosts).where(inArray(noodlePosts.id, postIds));
        }
        if (accountIds.length) {
          await tx.delete(noodleInteractions).where(inArray(noodleInteractions.actorAccountId, accountIds));
          await tx
            .delete(noodleAccountSubscriptions)
            .where(
              or(
                inArray(noodleAccountSubscriptions.viewerAccountId, accountIds),
                inArray(noodleAccountSubscriptions.creatorAccountId, accountIds),
              ),
            );
          await tx.delete(noodleAccounts).where(inArray(noodleAccounts.id, accountIds));
        }
        const settings = createAppSettingsStorage(tx);
        for (const accountId of accountIds) {
          await settings.remove(`${SLURP_CREATOR_STATE_KEY}.${accountId}`);
          await settings.remove(slurpProjectsKey(accountId));
          await settings.remove(slurpArcAutoKey(accountId));
          await settings.remove(slurpArcConfigKey(accountId));
        }
        for (const personaId of personaIds) await settings.remove(slurpViewerSettingsKey(personaId));
        await settings.remove(SLURP_SETTINGS_KEY);
        await settings.remove(NOODLE_REFRESH_SCHEDULE_KEY);
        await settings.remove(SLURP_CREATOR_MESSAGING_KEY);
        await tx._fileStore.flush();
      });
      return { deletedCreators: accounts.length, deletedPosts: posts.length };
    },
    async previewUnusedSlurpData(): Promise<{
      preparedPosts: number;
      attempts: number;
      runs: number;
      improvementJobs: number;
      improvementProposals: number;
    }> {
      const plan = await planUnusedSlurpData(db);
      return {
        preparedPosts: plan.preparedIds.length,
        attempts: plan.attemptIds.length,
        runs: plan.runIds.length,
        improvementJobs: plan.improvementJobIds.length,
        improvementProposals: plan.improvementProposalIds.length,
      };
    },
    async deleteUnusedSlurpData(): Promise<{
      deletedPreparedPosts: number;
      deletedAttempts: number;
      deletedRuns: number;
      deletedImprovementJobs: number;
      deletedImprovementProposals: number;
    }> {
      let deletedPreparedPosts = 0;
      let deletedAttempts = 0;
      let deletedRuns = 0;
      let deletedImprovementJobs = 0;
      let deletedImprovementProposals = 0;
      const plan = await planUnusedSlurpData(db);
      await db.transaction(async (tx) => {
        if (plan.preparedIds.length) {
          await tx.delete(noodlerPreparedPosts).where(inArray(noodlerPreparedPosts.id, plan.preparedIds));
          deletedPreparedPosts = plan.preparedIds.length;
        }
        if (plan.attemptIds.length) {
          await tx.delete(noodlerAutomaticAttempts).where(inArray(noodlerAutomaticAttempts.id, plan.attemptIds));
          deletedAttempts = plan.attemptIds.length;
        }
        if (plan.runIds.length) {
          await tx.delete(noodleRefreshRuns).where(inArray(noodleRefreshRuns.id, plan.runIds));
          deletedRuns = plan.runIds.length;
        }
        if (plan.improvementProposalIds.length) {
          await tx
            .delete(slurpImprovementProposals)
            .where(inArray(slurpImprovementProposals.id, plan.improvementProposalIds));
          deletedImprovementProposals = plan.improvementProposalIds.length;
        }
        if (plan.improvementJobIds.length) {
          await tx.delete(slurpImprovementJobs).where(inArray(slurpImprovementJobs.id, plan.improvementJobIds));
          deletedImprovementJobs = plan.improvementJobIds.length;
        }
        await tx._fileStore.flush();
      });
      return {
        deletedPreparedPosts,
        deletedAttempts,
        deletedRuns,
        deletedImprovementJobs,
        deletedImprovementProposals,
      };
    },
    async updateSettings(input: SlurpSettingsUpdateInput): Promise<SlurpSettings> {
      const run = slurpSettingsUpdateQueue.current.then(async () => {
        const current = await this.getSettings();
        const next = normalizeSlurpSettings({ ...current, ...input });
        await settingsStore.set(SLURP_SETTINGS_KEY, JSON.stringify(next));
        if (!current.autoPostingScheduleEnabled && next.autoPostingScheduleEnabled) {
          const timestamp = now();
          const rows = await db.select().from(noodlerPreparedPosts);
          const expired = rows.filter(
            (row) => row.state === "prepared" && Date.parse(row.publishAt) <= Date.parse(timestamp),
          );
          if (expired.length > 0) {
            await db.transaction(async (tx) =>
              tx
                .update(noodlerPreparedPosts)
                .set({ state: "discarded", updatedAt: timestamp })
                .where(
                  inArray(
                    noodlerPreparedPosts.id,
                    expired.map((row) => row.id),
                  ),
                ),
            );
            for (const row of expired) {
              unlinkNoodlerMedia(String(parseRecord(parseRecord(row.payload).metadata).noodlerMediaPath ?? "") || null);
            }
          }
        }
        return next;
      });
      slurpSettingsUpdateQueue.current = run.catch(() => undefined);
      return run;
    },
    async getRefreshSchedule(): Promise<PersistedNoodleRefreshSchedule | null> {
      const raw = await settingsStore.get(NOODLE_REFRESH_SCHEDULE_KEY);
      if (!raw) return null;
      try {
        return parsePersistedNoodleRefreshSchedule(JSON.parse(raw));
      } catch {
        return null;
      }
    },
    async saveRefreshSchedule(schedule: PersistedNoodleRefreshSchedule): Promise<void> {
      await settingsStore.set(NOODLE_REFRESH_SCHEDULE_KEY, JSON.stringify(schedule));
    },
    async ensureRefreshSchedule(
      at = new Date(),
      settingsOverride?: SlurpSettings,
    ): Promise<PersistedNoodleRefreshSchedule> {
      const settings = settingsOverride ?? (await this.getSettings());
      const current = await this.getRefreshSchedule();
      const reconciled = reconcileNoodleRefreshSchedule(current, 0, at);
      if (!current || JSON.stringify(current) !== JSON.stringify(reconciled)) {
        await this.saveRefreshSchedule(reconciled);
      }
      return reconciled;
    },
    /**
     * Ambient roster accounts are hidden, not deleted, while `allowRandomUsers` is off. Every read
     * path lists accounts through here, so feeds, search and activity drop them in one place.
     * `includeHidden` is for integrity guards and handle allocation, which must still see them.
     */
    async withoutHiddenAmbientAccounts<T extends NoodleAccount>(accounts: T[], includeHidden = false): Promise<T[]> {
      if (includeHidden) return accounts;
      return withoutHiddenAmbientAccounts(accounts, (await this.getSettings()).allowRandomUsers);
    },
    async listAccounts(options: { includeHidden?: boolean } = {}): Promise<NoodleAccount[]> {
      await reconcilePublicHandles();
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(eq(noodleAccounts.platform, "slurp"))
        .orderBy(desc(noodleAccounts.updatedAt));
      return this.withoutHiddenAmbientAccounts(rows.map(mapAccount), options.includeHidden);
    },
    /** Single-row sibling of `withoutHiddenAmbientAccounts`, so id reads hide what lists hide. */
    async withoutHiddenAmbientAccount<T extends NoodleAccount>(
      account: T | null,
      includeHidden = false,
    ): Promise<T | null> {
      if (!account) return null;
      return (await this.withoutHiddenAmbientAccounts([account], includeHidden))[0] ?? null;
    },
    async getAccountById(id: string, options: { includeHidden?: boolean } = {}): Promise<NoodleAccount | null> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "slurp")));
      return this.withoutHiddenAmbientAccount(rows[0] ? mapAccount(rows[0]) : null, options.includeHidden);
    },
    /**
     * Delete the noodle account for a deleted entity (e.g. a character) along with its
     * posts/interactions/subscriptions. Dependent rows go via the file-store cascade;
     * activity digests have no cascade, so they are cleared explicitly.
     */
    async deleteAccountByEntity(kind: NoodleAccountKind, entityId: string): Promise<NoodleAccount | null> {
      const existing = await this.getSlurpAccountForEntity(kind, entityId);
      if (!existing) return null;
      const postIds = (await db.select().from(noodlePosts).where(eq(noodlePosts.authorAccountId, existing.id))).map(
        (post) => post.id,
      );
      // Interactions on the account's own posts die with the posts via cascade, but the
      // account's interactions on *other* posts have no cascade — delete those explicitly.
      const ownInteractionIds =
        postIds.length > 0
          ? (await db.select().from(noodleInteractions).where(inArray(noodleInteractions.postId, postIds))).map(
              (interaction) => interaction.id,
            )
          : [];
      const authoredRows = await db
        .select()
        .from(noodleInteractions)
        .where(eq(noodleInteractions.actorAccountId, existing.id));
      // Replies to an authored interaction would keep a dangling parentInteractionId, so
      // take the whole descendant subtree (same closure as deleteInteractionById).
      const authoredPostIds = Array.from(new Set(authoredRows.map((row) => row.postId)));
      const siblingRows =
        authoredPostIds.length > 0
          ? await db.select().from(noodleInteractions).where(inArray(noodleInteractions.postId, authoredPostIds))
          : [];
      const doomed = new Set(authoredRows.map((row) => row.id));
      let changed = true;
      while (changed) {
        changed = false;
        for (const row of siblingRows) {
          if (doomed.has(row.id) || !row.parentInteractionId || !doomed.has(row.parentInteractionId)) continue;
          doomed.add(row.id);
          changed = true;
        }
      }
      const authoredInteractionIds = [...doomed];
      const interactionIds = Array.from(new Set([...ownInteractionIds, ...authoredInteractionIds]));
      await db.transaction(async (tx) => {
        if (postIds.length > 0) {
          await tx.delete(noodleActivityDigests).where(inArray(noodleActivityDigests.sourcePostId, postIds));
        }
        if (interactionIds.length > 0) {
          await tx
            .delete(noodleActivityDigests)
            .where(inArray(noodleActivityDigests.sourceInteractionId, interactionIds));
        }
        if (authoredInteractionIds.length > 0) {
          await tx.delete(noodleInteractions).where(inArray(noodleInteractions.id, authoredInteractionIds));
        }
        await tx
          .delete(noodlePostUnlocks)
          .where(
            or(
              eq(noodlePostUnlocks.viewerAccountId, existing.id),
              postIds.length > 0
                ? inArray(noodlePostUnlocks.postId, postIds)
                : eq(noodlePostUnlocks.postId, "__none__"),
            ),
          );
        await tx
          .delete(noodleAccountSubscriptions)
          .where(
            or(
              eq(noodleAccountSubscriptions.viewerAccountId, existing.id),
              eq(noodleAccountSubscriptions.creatorAccountId, existing.id),
            ),
          );
        await tx
          .delete(noodlerCreatorReplyClaims)
          .where(
            or(
              eq(noodlerCreatorReplyClaims.creatorAccountId, existing.id),
              postIds.length > 0
                ? inArray(noodlerCreatorReplyClaims.postId, postIds)
                : eq(noodlerCreatorReplyClaims.postId, "__none__"),
            ),
          );
        await tx.delete(noodlerPreparedPosts).where(eq(noodlerPreparedPosts.creatorAccountId, existing.id));
        // Same Creator-keyed rows deleteNoodlerAccount cascades. Both entry points must agree, or
        // which one the caller happened to use decides what survives.
        await tx.delete(slurpCommissions).where(eq(slurpCommissions.creatorAccountId, existing.id));
        await tx.delete(slurpAudienceTies).where(eq(slurpAudienceTies.creatorAccountId, existing.id));
        await tx.delete(slurpPendingText).where(eq(slurpPendingText.creatorAccountId, existing.id));
        await tx.delete(slurpEvents).where(eq(slurpEvents.creatorAccountId, existing.id));
        await tx.delete(noodlerFirstPostJobs).where(eq(noodlerFirstPostJobs.creatorAccountId, existing.id));
        await tx.delete(slurpImprovementProposals).where(eq(slurpImprovementProposals.accountId, existing.id));
        await tx.delete(noodlePosts).where(inArray(noodlePosts.id, postIds));
        await tx.delete(noodleAccounts).where(eq(noodleAccounts.id, existing.id));
        await tx._fileStore.flush();
      });
      return existing;
    },
    async getSlurpAccountForEntity(
      kind: NoodleAccountKind,
      entityId: string,
      role: SlurpAccountRole = "creator",
    ): Promise<SlurpAccount | null> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(
          and(
            eq(noodleAccounts.kind, kind),
            eq(noodleAccounts.entityId, entityId),
            eq(noodleAccounts.platform, "slurp"),
          ),
        );
      return (
        rows
          .map(mapAccount)
          .find((account) =>
            role === "viewer" ? isSlurpViewerActorAccount(account) : !isSlurpViewerActorAccount(account),
          ) ?? null
      );
    },
    async getAccountsByEntities(kind: NoodleAccountKind, entityIds: string[]): Promise<SlurpAccount[]> {
      if (entityIds.length === 0) return [];
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(
          and(
            eq(noodleAccounts.kind, kind),
            inArray(noodleAccounts.entityId, entityIds),
            eq(noodleAccounts.platform, "slurp"),
          ),
        );
      return rows.map(mapAccount);
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
