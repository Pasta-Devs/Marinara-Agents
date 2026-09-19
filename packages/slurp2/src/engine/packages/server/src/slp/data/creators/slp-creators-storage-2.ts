import { and, desc, eq, inArray, or } from "../../../db/file-query.js";
import { SlpAccount, SlpAccountKind } from "../../../../../shared/src/slp/slp-social.types.js";
import { slurpProjectsKey } from "../../modules/projects/slp-project.js";
import { slurpArcAutoKey, slurpArcConfigKey } from "../../modules/projects/slp-arc-library.js";
import { unlinkCreatorMedia } from "../../base/media/slp-media.js";
import {
  slpAccounts,
  slpAccountSubscriptions,
  slpActivityDigests,
  slpInteractions,
  slpPosts,
  slpPostUnlocks,
  slpRefreshRuns,
  slpCreatorCreatorReplyClaims,
  slpCreatorAutomaticAttempts,
  slpCreatorPreparedPosts,
  slpCreatorReserveState,
  slpCreatorFanActivityState,
  slurpPopulation,
  slurpAudienceTies,
  slurpEvents,
  slurpPendingText,
  slpCreatorFirstPostJobs,
  slurpMessageClaims,
  slurpMessages,
  slurpReplyBubbles,
  slurpThreads,
  slurpCommissions,
  slurpImprovementJobs,
  slurpImprovementProposals,
} from "../../../db/schema/slurp.js";
import { SLURP_CREATOR_MESSAGING_KEY } from "../../modules/messages/slp-messaging.js";
import { now } from "../../../utils/id-generator.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import {
  parsePersistedSlpRefreshSchedule,
  reconcileSlpRefreshSchedule,
  PersistedSlpRefreshSchedule,
} from "../../modules/feed/slp-refresh-schedule.js";
import { withoutHiddenAmbientAccounts } from "../audience/slp-ambient-profiles.js";
import {
  SLURP_SETTINGS_KEY,
  SLURP_CREATOR_STATE_KEY,
  SLP_REFRESH_SCHEDULE_KEY,
  slurpViewerSettingsKey,
  slurpSettingsUpdateQueue,
  planUnusedSlurpData,
} from "../host/slp-storage-constants.js";
import { parseRecord } from "../../modules/records/slp-storage-model.js";
import type { SlurpAccount, SlurpAccountRole } from "../../modules/records/slp-storage-model.js";
import { isSlurpViewerActorAccount, normalizeSlurpSettings } from "../../modules/settings/slp-settings.js";
import type { SlurpSettings, SlurpSettingsUpdateInput } from "../../modules/settings/slp-settings.js";
import { mapAccount } from "../host/slp-storage-mappers.js";
import type { SlurpStorageContext } from "../host/slp-storage-context.js";

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
      const accounts = await db.select().from(slpAccounts).where(eq(slpAccounts.platform, "slurp"));
      const accountIds = accounts.map((account) => account.id);
      const personaIds = (await characters.listPersonas()).map((persona) => persona.id);
      const posts = accountIds.length
        ? await db.select().from(slpPosts).where(inArray(slpPosts.authorAccountId, accountIds))
        : [];
      const postIds = posts.map((post) => post.id);
      await db.transaction(async (tx) => {
        for (const table of [
          slpActivityDigests,
          slpRefreshRuns,
          slpCreatorFanActivityState,
          slpCreatorAutomaticAttempts,
          slpCreatorReserveState,
          slpCreatorPreparedPosts,
          slpCreatorCreatorReplyClaims,
          // Direct messages are Slurp data too. Left out, "delete all Slurp data" would keep
          // every thread and leave the next install reading someone else's conversations.
          slurpMessageClaims,
          slurpMessages,
          slurpReplyBubbles,
          slurpCommissions,
          slurpThreads,
          // Everything below had no deletion path at all, not even in this full reset. A fresh
          // install inherited the previous one's audience, world events, and queued work.
          slpCreatorFirstPostJobs,
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
          await tx.delete(slpInteractions).where(inArray(slpInteractions.postId, postIds));
          await tx.delete(slpPostUnlocks).where(inArray(slpPostUnlocks.postId, postIds));
          await tx.delete(slpPosts).where(inArray(slpPosts.id, postIds));
        }
        if (accountIds.length) {
          await tx.delete(slpInteractions).where(inArray(slpInteractions.actorAccountId, accountIds));
          await tx
            .delete(slpAccountSubscriptions)
            .where(
              or(
                inArray(slpAccountSubscriptions.viewerAccountId, accountIds),
                inArray(slpAccountSubscriptions.creatorAccountId, accountIds),
              ),
            );
          await tx.delete(slpAccounts).where(inArray(slpAccounts.id, accountIds));
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
        await settings.remove(SLP_REFRESH_SCHEDULE_KEY);
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
          await tx.delete(slpCreatorPreparedPosts).where(inArray(slpCreatorPreparedPosts.id, plan.preparedIds));
          deletedPreparedPosts = plan.preparedIds.length;
        }
        if (plan.attemptIds.length) {
          await tx.delete(slpCreatorAutomaticAttempts).where(inArray(slpCreatorAutomaticAttempts.id, plan.attemptIds));
          deletedAttempts = plan.attemptIds.length;
        }
        if (plan.runIds.length) {
          await tx.delete(slpRefreshRuns).where(inArray(slpRefreshRuns.id, plan.runIds));
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
          const rows = await db.select().from(slpCreatorPreparedPosts);
          const expired = rows.filter(
            (row) => row.state === "prepared" && Date.parse(row.publishAt) <= Date.parse(timestamp),
          );
          if (expired.length > 0) {
            await db.transaction(async (tx) =>
              tx
                .update(slpCreatorPreparedPosts)
                .set({ state: "discarded", updatedAt: timestamp })
                .where(
                  inArray(
                    slpCreatorPreparedPosts.id,
                    expired.map((row) => row.id),
                  ),
                ),
            );
            for (const row of expired) {
              unlinkCreatorMedia(String(parseRecord(parseRecord(row.payload).metadata).noodlerMediaPath ?? "") || null);
            }
          }
        }
        return next;
      });
      slurpSettingsUpdateQueue.current = run.catch(() => undefined);
      return run;
    },
    async getRefreshSchedule(): Promise<PersistedSlpRefreshSchedule | null> {
      const raw = await settingsStore.get(SLP_REFRESH_SCHEDULE_KEY);
      if (!raw) return null;
      try {
        return parsePersistedSlpRefreshSchedule(JSON.parse(raw));
      } catch {
        return null;
      }
    },
    async saveRefreshSchedule(schedule: PersistedSlpRefreshSchedule): Promise<void> {
      await settingsStore.set(SLP_REFRESH_SCHEDULE_KEY, JSON.stringify(schedule));
    },
    async ensureRefreshSchedule(
      at = new Date(),
      settingsOverride?: SlurpSettings,
    ): Promise<PersistedSlpRefreshSchedule> {
      const settings = settingsOverride ?? (await this.getSettings());
      const current = await this.getRefreshSchedule();
      const reconciled = reconcileSlpRefreshSchedule(current, 0, at);
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
    async withoutHiddenAmbientAccounts<T extends SlpAccount>(accounts: T[], includeHidden = false): Promise<T[]> {
      if (includeHidden) return accounts;
      return withoutHiddenAmbientAccounts(accounts, (await this.getSettings()).allowRandomUsers);
    },
    async listAccounts(options: { includeHidden?: boolean } = {}): Promise<SlpAccount[]> {
      await reconcilePublicHandles();
      const rows = await db
        .select()
        .from(slpAccounts)
        .where(eq(slpAccounts.platform, "slurp"))
        .orderBy(desc(slpAccounts.updatedAt));
      return this.withoutHiddenAmbientAccounts(rows.map(mapAccount), options.includeHidden);
    },
    /** Single-row sibling of `withoutHiddenAmbientAccounts`, so id reads hide what lists hide. */
    async withoutHiddenAmbientAccount<T extends SlpAccount>(
      account: T | null,
      includeHidden = false,
    ): Promise<T | null> {
      if (!account) return null;
      return (await this.withoutHiddenAmbientAccounts([account], includeHidden))[0] ?? null;
    },
    async getAccountById(id: string, options: { includeHidden?: boolean } = {}): Promise<SlpAccount | null> {
      const rows = await db
        .select()
        .from(slpAccounts)
        .where(and(eq(slpAccounts.id, id), eq(slpAccounts.platform, "slurp")));
      return this.withoutHiddenAmbientAccount(rows[0] ? mapAccount(rows[0]) : null, options.includeHidden);
    },
    /**
     * Delete the noodle account for a deleted entity (e.g. a character) along with its
     * posts/interactions/subscriptions. Dependent rows go via the file-store cascade;
     * activity digests have no cascade, so they are cleared explicitly.
     */
    async deleteAccountByEntity(kind: SlpAccountKind, entityId: string): Promise<SlpAccount | null> {
      const existing = await this.getSlurpAccountForEntity(kind, entityId);
      if (!existing) return null;
      const postIds = (await db.select().from(slpPosts).where(eq(slpPosts.authorAccountId, existing.id))).map(
        (post) => post.id,
      );
      // Interactions on the account's own posts die with the posts via cascade, but the
      // account's interactions on *other* posts have no cascade — delete those explicitly.
      const ownInteractionIds =
        postIds.length > 0
          ? (await db.select().from(slpInteractions).where(inArray(slpInteractions.postId, postIds))).map(
              (interaction) => interaction.id,
            )
          : [];
      const authoredRows = await db
        .select()
        .from(slpInteractions)
        .where(eq(slpInteractions.actorAccountId, existing.id));
      // Replies to an authored interaction would keep a dangling parentInteractionId, so
      // take the whole descendant subtree (same closure as deleteInteractionById).
      const authoredPostIds = Array.from(new Set(authoredRows.map((row) => row.postId)));
      const siblingRows =
        authoredPostIds.length > 0
          ? await db.select().from(slpInteractions).where(inArray(slpInteractions.postId, authoredPostIds))
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
          await tx.delete(slpActivityDigests).where(inArray(slpActivityDigests.sourcePostId, postIds));
        }
        if (interactionIds.length > 0) {
          await tx.delete(slpActivityDigests).where(inArray(slpActivityDigests.sourceInteractionId, interactionIds));
        }
        if (authoredInteractionIds.length > 0) {
          await tx.delete(slpInteractions).where(inArray(slpInteractions.id, authoredInteractionIds));
        }
        await tx
          .delete(slpPostUnlocks)
          .where(
            or(
              eq(slpPostUnlocks.viewerAccountId, existing.id),
              postIds.length > 0 ? inArray(slpPostUnlocks.postId, postIds) : eq(slpPostUnlocks.postId, "__none__"),
            ),
          );
        await tx
          .delete(slpAccountSubscriptions)
          .where(
            or(
              eq(slpAccountSubscriptions.viewerAccountId, existing.id),
              eq(slpAccountSubscriptions.creatorAccountId, existing.id),
            ),
          );
        await tx
          .delete(slpCreatorCreatorReplyClaims)
          .where(
            or(
              eq(slpCreatorCreatorReplyClaims.creatorAccountId, existing.id),
              postIds.length > 0
                ? inArray(slpCreatorCreatorReplyClaims.postId, postIds)
                : eq(slpCreatorCreatorReplyClaims.postId, "__none__"),
            ),
          );
        await tx.delete(slpCreatorPreparedPosts).where(eq(slpCreatorPreparedPosts.creatorAccountId, existing.id));
        // Same Creator-keyed rows deleteNoodlerAccount cascades. Both entry points must agree, or
        // which one the caller happened to use decides what survives.
        await tx.delete(slurpCommissions).where(eq(slurpCommissions.creatorAccountId, existing.id));
        await tx.delete(slurpAudienceTies).where(eq(slurpAudienceTies.creatorAccountId, existing.id));
        await tx.delete(slurpPendingText).where(eq(slurpPendingText.creatorAccountId, existing.id));
        await tx.delete(slurpEvents).where(eq(slurpEvents.creatorAccountId, existing.id));
        await tx.delete(slpCreatorFirstPostJobs).where(eq(slpCreatorFirstPostJobs.creatorAccountId, existing.id));
        await tx.delete(slurpImprovementProposals).where(eq(slurpImprovementProposals.accountId, existing.id));
        await tx.delete(slpPosts).where(inArray(slpPosts.id, postIds));
        await tx.delete(slpAccounts).where(eq(slpAccounts.id, existing.id));
        await tx._fileStore.flush();
      });
      return existing;
    },
    async getSlurpAccountForEntity(
      kind: SlpAccountKind,
      entityId: string,
      role: SlurpAccountRole = "creator",
    ): Promise<SlurpAccount | null> {
      const rows = await db
        .select()
        .from(slpAccounts)
        .where(and(eq(slpAccounts.kind, kind), eq(slpAccounts.entityId, entityId), eq(slpAccounts.platform, "slurp")));
      return (
        rows
          .map(mapAccount)
          .find((account) =>
            role === "viewer" ? isSlurpViewerActorAccount(account) : !isSlurpViewerActorAccount(account),
          ) ?? null
      );
    },
    async getAccountsByEntities(kind: SlpAccountKind, entityIds: string[]): Promise<SlurpAccount[]> {
      if (entityIds.length === 0) return [];
      const rows = await db
        .select()
        .from(slpAccounts)
        .where(
          and(eq(slpAccounts.kind, kind), inArray(slpAccounts.entityId, entityIds), eq(slpAccounts.platform, "slurp")),
        );
      return rows.map(mapAccount);
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
