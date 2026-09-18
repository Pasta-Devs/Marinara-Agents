import { and, desc, eq, inArray, or } from "../../../db/file-query.js";
import {
  NoodleAccount,
  NoodleAccountSettings,
  NoodleAccountSettingsPatchInput,
  NoodlerSourceSnapshot,
} from "@marinara-engine/shared";
import { SlurpStageProfileInput } from "../../../services/slurp/slurp-discovery-profile.js";
import { resolveSlurpCreatorScheduleStatus } from "../../../services/slurp/slurp-creator-schedule-context.js";
import {
  noodleAccounts,
  noodleAccountSubscriptions,
  noodleActivityDigests,
  noodleInteractions,
  noodlePosts,
  noodlePostUnlocks,
  noodlerCreatorReplyClaims,
  noodlerPreparedPosts,
  slurpAudienceTies,
  slurpEvents,
  slurpPendingText,
  noodlerFirstPostJobs,
  slurpMessageClaims,
  slurpMessages,
  slurpReplyBubbles,
  slurpThreads,
  slurpCommissions,
  slurpImprovementProposals,
} from "../../../db/schema/slurp.js";
import { readNoodlerAccountMediaPath, readNoodlerAvatarMediaPath } from "../../../services/slurp/slurp-avatar.js";
import { newId, now } from "../../../utils/id-generator.js";
import {
  compareMinimizedNoodlerSourceSnapshot,
  minimizeNoodlerSourceSnapshot,
} from "../../../services/slurp/slurp-source.js";
import { resolveNoodlerSourceSnapshot } from "../../../services/slurp/slurp-source-resolve.js";
import { withoutHiddenAmbientAccounts } from "../../../services/slurp/slurp-ambient-profiles.js";
import { slurpViewerSettingsKey } from "../../base/host/slp-storage-constants.js";
import {
  emptyNoodleAccountSettings,
  defaultAutoPostingSettings,
  normalizeNoodleAccountSettings,
  normalizeHandle,
} from "../../base/host/slp-storage-model.js";
import type {
  SlurpSourceKind,
  SlurpNoodleAccountSettings,
  SlurpManagedStageProfile,
  SlurpAccount,
} from "../../base/host/slp-storage-model.js";
import { isSlurpViewerActorAccount } from "../../base/settings/slp-settings.js";
import { mapAccount } from "../../base/host/slp-storage-mappers.js";
import type { SlurpStorageContext } from "../../base/host/slp-storage-context.js";

export function createCreatorsStorage3(context: SlurpStorageContext) {
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
    async listNoodlerAccounts(options: { includeHidden?: boolean } = {}): Promise<SlurpAccount[]> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(eq(noodleAccounts.platform, "slurp"))
        .orderBy(desc(noodleAccounts.updatedAt));
      return this.withoutHiddenAmbientAccounts(rows.map(mapAccount), options.includeHidden);
    },
    async getNoodlerAccountById(id: string, options: { includeHidden?: boolean } = {}): Promise<SlurpAccount | null> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "slurp")));
      return this.withoutHiddenAmbientAccount(rows[0] ? mapAccount(rows[0]) : null, options.includeHidden);
    },
    async getNoodlerAccountForSource(
      sourceKind: SlurpSourceKind,
      sourceEntityId: string,
    ): Promise<SlurpAccount | null> {
      return this.getSlurpAccountForEntity(sourceKind, sourceEntityId, "creator");
    },
    async patchViewerSettings(
      personaId: string,
      input: NoodleAccountSettingsPatchInput,
    ): Promise<NoodleAccount | null> {
      return enqueueFinancial(async () => {
        if (input.subtree !== "social") return null;
        const viewer = await this.getViewer(personaId);
        if (!viewer) return null;
        const social = { ...viewer.settings.social, ...input.patch };
        for (const field of ["noodleFeedSeenAt", "noodlerFeedSeenAt"] as const) {
          const stored = viewer.settings.social[field];
          if (stored && social[field] && !(Date.parse(social[field]) > (Date.parse(stored) || 0)))
            social[field] = stored;
        }
        await settingsStore.set(slurpViewerSettingsKey(personaId), JSON.stringify({ ...viewer.settings, social }));
        return this.getViewer(personaId);
      });
    },
    async updateViewerFollow(
      personaId: string,
      targetAccountId: string,
      followed: boolean,
      followedAt = now(),
    ): Promise<{ account: NoodleAccount; changed: boolean } | null> {
      return enqueueFinancial(async () => {
        const viewer = await this.getViewer(personaId);
        if (!viewer) return null;
        const followingAccountIds = viewer.settings.social.followingAccountIds ?? [];
        const isFollowing = followingAccountIds.includes(targetAccountId);
        const followingAccountTimestamps = { ...viewer.settings.social.followingAccountTimestamps };
        if (isFollowing === followed && (!followed || followingAccountTimestamps[targetAccountId]))
          return { account: viewer, changed: false };
        if (followed) followingAccountTimestamps[targetAccountId] = followedAt;
        else delete followingAccountTimestamps[targetAccountId];
        const next: NoodleAccountSettings = {
          ...viewer.settings,
          social: {
            ...viewer.settings.social,
            followingAccountIds: followed
              ? [...followingAccountIds, targetAccountId]
              : followingAccountIds.filter((accountId) => accountId !== targetAccountId),
            followingAccountTimestamps,
          },
        };
        await settingsStore.set(slurpViewerSettingsKey(personaId), JSON.stringify(next));
        return { account: (await this.getViewer(personaId))!, changed: true };
      });
    },
    async deleteNoodlerAccount(id: string): Promise<NoodleAccount | null> {
      const existing = await this.getNoodlerAccountById(id, { includeHidden: true });
      if (!existing) return null;
      await this.leaveCrossovers(id);
      const postRows = await db.select().from(noodlePosts).where(eq(noodlePosts.authorAccountId, id));
      const postIds = postRows.map((post) => post.id);
      const interactionRows =
        postIds.length > 0
          ? await db.select().from(noodleInteractions).where(inArray(noodleInteractions.postId, postIds))
          : [];
      const interactionIds = interactionRows.map((interaction) => interaction.id);
      await db.transaction(async (tx) => {
        if (postIds.length > 0) {
          await tx.delete(noodleActivityDigests).where(inArray(noodleActivityDigests.sourcePostId, postIds));
        }
        if (interactionIds.length > 0) {
          await tx
            .delete(noodleActivityDigests)
            .where(inArray(noodleActivityDigests.sourceInteractionId, interactionIds));
        }
        await tx
          .delete(noodlePostUnlocks)
          .where(
            or(
              eq(noodlePostUnlocks.viewerAccountId, id),
              postIds.length > 0
                ? inArray(noodlePostUnlocks.postId, postIds)
                : eq(noodlePostUnlocks.postId, "__none__"),
            ),
          );
        await tx
          .delete(noodleAccountSubscriptions)
          .where(
            or(eq(noodleAccountSubscriptions.viewerAccountId, id), eq(noodleAccountSubscriptions.creatorAccountId, id)),
          );
        await tx
          .delete(noodlerCreatorReplyClaims)
          .where(
            or(
              eq(noodlerCreatorReplyClaims.creatorAccountId, id),
              postIds.length > 0
                ? inArray(noodlerCreatorReplyClaims.postId, postIds)
                : eq(noodlerCreatorReplyClaims.postId, "__none__"),
            ),
          );
        await tx.delete(noodlerPreparedPosts).where(eq(noodlerPreparedPosts.creatorAccountId, id));
        // Threads on either side of the deleted account, and their messages. Left behind, the
        // inbox would keep listing a creator that no longer exists.
        const threadRows = await tx
          .select()
          .from(slurpThreads)
          .where(or(eq(slurpThreads.viewerAccountId, id), eq(slurpThreads.creatorAccountId, id)));
        const threadIds = threadRows.map((row) => row.id);
        if (threadIds.length > 0) {
          await tx.delete(slurpMessages).where(inArray(slurpMessages.threadId, threadIds));
          await tx.delete(slurpReplyBubbles).where(inArray(slurpReplyBubbles.threadId, threadIds));
          await tx.delete(slurpMessageClaims).where(inArray(slurpMessageClaims.threadId, threadIds));
          await tx.delete(slurpThreads).where(inArray(slurpThreads.id, threadIds));
        }
        await tx
          .delete(noodleInteractions)
          .where(
            or(
              eq(noodleInteractions.actorAccountId, id),
              postIds.length > 0
                ? inArray(noodleInteractions.postId, postIds)
                : eq(noodleInteractions.postId, "__none__"),
            ),
          );
        // Rows keyed to this Creator that nothing else cleans up. Left behind, a deleted Creator
        // kept an audience, a commission history, and queued work that could still fire.
        await tx.delete(slurpCommissions).where(eq(slurpCommissions.creatorAccountId, id));
        await tx.delete(slurpAudienceTies).where(eq(slurpAudienceTies.creatorAccountId, id));
        await tx.delete(slurpPendingText).where(eq(slurpPendingText.creatorAccountId, id));
        await tx.delete(slurpEvents).where(eq(slurpEvents.creatorAccountId, id));
        await tx.delete(noodlerFirstPostJobs).where(eq(noodlerFirstPostJobs.creatorAccountId, id));
        await tx.delete(slurpImprovementProposals).where(eq(slurpImprovementProposals.accountId, id));
        await tx.delete(noodleAccounts).where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "slurp")));
        await tx._fileStore.flush();
      });
      return existing;
    },
    async listNoodlerStageProfiles(): Promise<SlurpManagedStageProfile[]> {
      const accounts = (await this.listNoodlerAccounts()).filter((account) => !isSlurpViewerActorAccount(account));
      return Promise.all(
        accounts.map(async (account) => {
          const disclosureMode = account.settings.privacy.identityDisclosure ?? null;
          const publicAccount = await this.resolveAccountSource(account);
          const currentSource = publicAccount ? await resolveNoodlerSourceSnapshot(db, publicAccount) : null;
          const baseline = account.settings.profile.noodlerSourceSnapshot;
          return {
            id: account.id,
            sourceAccountId: account.sourceEntityId,
            handle: account.handle,
            displayName: account.displayName,
            bio: account.bio,
            location: account.settings.profile.location ?? "",
            avatarUrl: account.avatarUrl,
            avatarCrop: account.avatarCrop,
            bannerUrl: account.settings.profile.bannerUrl ?? null,
            gender: account.settings.profile.gender,
            tags: account.settings.profile.tags,
            disclosureMode,
            stagePersonality: account.settings.privacy.stagePersonality ?? "",
            access: account.settings.privacy.access,
            autoPosting:
              currentSource && !(account.kind === "persona" && account.sourceKind === "persona")
                ? (account.settings.scheduler.autoPosting ?? defaultAutoPostingSettings())
                : { ...(account.settings.scheduler.autoPosting ?? defaultAutoPostingSettings()), enabled: false },
            fanActivity: account.settings.scheduler.fanActivity ?? null,
            // Reported so a stale schedule is visible. Engine schedules expire weekly, and until
            // now one that lapsed simply stopped applying with no signal anywhere.
            scheduleStatus: publicAccount
              ? await resolveSlurpCreatorScheduleStatus(characters, {
                  kind: publicAccount.kind,
                  entityId: publicAccount.entityId,
                  displayName: publicAccount.displayName,
                })
              : { state: "not-applicable" as const },
            sourceStatus: !currentSource
              ? { state: "missing" as const }
              : compareMinimizedNoodlerSourceSnapshot(
                  baseline ?? minimizeNoodlerSourceSnapshot(currentSource, disclosureMode ?? "open"),
                  currentSource,
                  disclosureMode ?? "open",
                ),
            publicIdentity:
              publicAccount && (disclosureMode === "open" || disclosureMode === "hinted")
                ? { displayName: publicAccount.displayName, handle: publicAccount.handle }
                : null,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
          };
        }),
      );
    },
    async createNoodlerAccount(
      sourceKind: SlurpSourceKind,
      sourceEntityId: string,
      stageProfile: SlurpStageProfileInput,
      wizardExecutionId?: string,
      sourceSnapshot?: NoodlerSourceSnapshot,
      avatarUrl?: string | null,
      bannerUrl?: string | null,
    ): Promise<NoodleAccount | null> {
      const publicAccount = await this.resolveSource(sourceKind, sourceEntityId);
      if (!publicAccount) return null;
      const timestamp = now();
      const id = newId();
      const base = emptyNoodleAccountSettings();
      const accountSettings: SlurpNoodleAccountSettings = {
        ...base,
        profile: {
          ...(wizardExecutionId && { noodlerWizardExecutionId: wizardExecutionId }),
          ...(sourceSnapshot && { noodlerSourceSnapshot: sourceSnapshot }),
          // Only an OPEN creator may hold the literal source banner (see
          // resolveNoodlerCreatorArtwork); callers already gate the value on that, this is
          // belt-and-suspenders against a future caller passing one for hinted/secret.
          ...(stageProfile.disclosureMode === "open" && bannerUrl ? { bannerUrl } : {}),
          gender: stageProfile.gender,
          tags: stageProfile.tags,
        },
        scheduler: { autoPosting: defaultAutoPostingSettings() },
        privacy: {
          identityDisclosure: stageProfile.disclosureMode,
          stagePersonality: stageProfile.stagePersonality,
          access: { hiddenFromAccountIds: [] },
        },
      };
      await db.insert(noodleAccounts).values({
        id,
        kind: publicAccount.kind,
        entityId: publicAccount.entityId,
        handle: normalizeHandle(stageProfile.handle, publicAccount.entityId),
        displayName: stageProfile.displayName,
        bio: stageProfile.bio,
        avatarUrl: stageProfile.disclosureMode === "open" ? (avatarUrl ?? null) : null,
        invited: "false",
        settings: JSON.stringify(accountSettings),
        platform: "slurp",
        sourceKind,
        sourceEntityId,
        slurpSourceAccountId: null,
        // Keep source identity mirrors for persisted Slurp rows.
        visibility: "private",
        publicAccountId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getNoodlerAccountById(id);
    },
    async updateNoodlerStageProfile(
      id: string,
      stageProfile: SlurpStageProfileInput,
      sourceSnapshot?: NoodlerSourceSnapshot,
      location?: string,
    ): Promise<NoodleAccount | null> {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "slurp")));
        const row = rows[0];
        if (!row) return null;
        const settings = normalizeNoodleAccountSettings(row.settings);
        // Only OPEN may hold the literal source photo (see resolveNoodlerCreatorArtwork). A
        // downgrade away from open drops an inherited avatar/banner outright, the same way a
        // hinted or secret creator never gets one at creation. A NoodleR-owned generated image
        // (readNoodler*MediaPath resolves it) survives the downgrade — it was never the source's
        // literal photo, so it carries no identity to strip.
        const droppingOpen = stageProfile.disclosureMode !== "open";
        const profile = { ...settings.profile };
        if (droppingOpen && !readNoodlerAccountMediaPath(id, profile.bannerUrl ?? null)) {
          delete profile.bannerUrl;
        }
        await tx
          .update(noodleAccounts)
          .set({
            handle: normalizeHandle(stageProfile.handle, row.entityId),
            displayName: stageProfile.displayName,
            bio: stageProfile.bio,
            ...(droppingOpen && !readNoodlerAvatarMediaPath(id, row.avatarUrl) ? { avatarUrl: null } : {}),
            settings: JSON.stringify({
              ...settings,
              profile: {
                ...profile,
                ...(location !== undefined && { location: location.trim().slice(0, 120) }),
                ...(sourceSnapshot && { noodlerSourceSnapshot: sourceSnapshot }),
                gender: stageProfile.gender,
                tags: stageProfile.tags,
              },
              privacy: {
                ...settings.privacy,
                identityDisclosure: stageProfile.disclosureMode,
                stagePersonality: stageProfile.stagePersonality,
              },
            } satisfies SlurpNoodleAccountSettings),
            updatedAt: now(),
          })
          .where(eq(noodleAccounts.id, id));
        const updatedRows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id));
        return updatedRows[0] ? mapAccount(updatedRows[0]) : null;
      });
    },
    async updateNoodlerAvatar(id: string, avatarUrl: string | null): Promise<NoodleAccount | null> {
      await db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "slurp")));
        const row = rows[0];
        if (!row) return;
        const settings = normalizeNoodleAccountSettings(row.settings);
        await tx
          .update(noodleAccounts)
          .set({
            avatarUrl,
            settings: JSON.stringify({
              ...settings,
              profile: { ...settings.profile, avatarCrop: null },
            } satisfies NoodleAccountSettings),
            updatedAt: now(),
          })
          .where(eq(noodleAccounts.id, id));
      });
      return this.getNoodlerAccountById(id);
    },
    /** Creator banner lives in settings.profile, which patchAccountSettings keeps closed for noodler rows. */
    async updateNoodlerBanner(id: string, bannerUrl: string | null): Promise<NoodleAccount | null> {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id)))[0];
        if (!row || row.platform !== "slurp") return null;
        const settings = normalizeNoodleAccountSettings(row.settings);
        const profile = { ...settings.profile };
        if (bannerUrl) profile.bannerUrl = bannerUrl;
        else delete profile.bannerUrl;
        await tx
          .update(noodleAccounts)
          .set({
            settings: JSON.stringify({ ...settings, profile } satisfies NoodleAccountSettings),
            updatedAt: now(),
          })
          .where(eq(noodleAccounts.id, id));
        return this.getNoodlerAccountById(id);
      });
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
