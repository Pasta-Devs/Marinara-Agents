import { and, eq, like, or } from "../../../db/file-query.js";
import { AvatarCrop } from "@marinara-engine/shared";
import {
  SlpAccountProfileUpdateInput,
  SlpAccountSettingsPatchInput,
  SlpAccountUpdateInput,
} from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import {
  SlpAccount,
  SlpAccountKind,
  SlpAccountSettings,
  SlpCreatorSourceSnapshot,
} from "../../../../../shared/src/slp/slp-social.types.js";
import { withoutCreatorSelfHiddenAccountId } from "../../base/identity/slp-access.js";
import { slpAccounts, slpPosts, slpCreatorPreparedPosts } from "../../../db/schema/slurp.js";
import { newId, now } from "../../../utils/id-generator.js";
import { resolveCreatorSourceSnapshot } from "./slp-source-resolve.js";
import {
  emptySlpAccountSettings,
  defaultAutoPostingSettings,
  normalizeSlpAccountSettings,
  normalizeHandle,
  nextAvailablePublicHandle,
} from "../../modules/records/slp-storage-model.js";
import { mapAccount } from "../host/slp-storage-mappers.js";
import type { SlurpStorageContext } from "../host/slp-storage-context.js";

export function createCreatorsStorage4(context: SlurpStorageContext) {
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
    async updateNoodlerSourceSnapshot(
      id: string,
      sourceSnapshot: SlpCreatorSourceSnapshot,
    ): Promise<SlpAccount | null> {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slpAccounts).where(eq(slpAccounts.id, id)))[0];
        if (!row || row.platform !== "slurp") return null;
        const settings = normalizeSlpAccountSettings(row.settings);
        // The snapshot is re-minimised and handed back on every stage-profile save, almost always
        // byte-identical to the stored one. Writing it anyway churned the row and moved updatedAt,
        // which made a save with no source change look like a source change to everything reading
        // that timestamp.
        if (JSON.stringify(settings.profile.noodlerSourceSnapshot ?? null) === JSON.stringify(sourceSnapshot)) {
          return mapAccount(row);
        }
        await tx
          .update(slpAccounts)
          .set({
            settings: JSON.stringify({
              ...settings,
              profile: { ...settings.profile, noodlerSourceSnapshot: sourceSnapshot },
            } satisfies SlpAccountSettings),
            updatedAt: now(),
          })
          .where(eq(slpAccounts.id, id));
        const updated = (await tx.select().from(slpAccounts).where(eq(slpAccounts.id, id)))[0];
        return updated ? mapAccount(updated) : null;
      });
    },
    async adoptNoodlerPublicIdentity(id: string, currentSource: SlpCreatorSourceSnapshot): Promise<SlpAccount | null> {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(slpAccounts).where(eq(slpAccounts.id, id)))[0];
        if (!row || row.platform !== "slurp") return null;
        const settings = normalizeSlpAccountSettings(row.settings);
        if (settings.privacy.identityDisclosure !== "open") return null;
        const baseline = settings.profile.noodlerSourceSnapshot ?? currentSource;
        await tx
          .update(slpAccounts)
          .set({
            displayName: currentSource.publicDisplayName,
            handle: normalizeHandle(currentSource.publicHandle, row.entityId),
            settings: JSON.stringify({
              ...settings,
              profile: {
                ...settings.profile,
                noodlerSourceSnapshot: {
                  ...baseline,
                  publicDisplayName: currentSource.publicDisplayName,
                  publicHandle: currentSource.publicHandle,
                },
              },
            } satisfies SlpAccountSettings),
            updatedAt: now(),
          })
          .where(eq(slpAccounts.id, id));
        const updated = (await tx.select().from(slpAccounts).where(eq(slpAccounts.id, id)))[0];
        return updated ? mapAccount(updated) : null;
      });
    },
    async upsertAccountFromProfile(input: {
      kind: SlpAccountKind;
      entityId: string;
      displayName: string;
      avatarUrl?: string | null;
      avatarCrop?: AvatarCrop | null;
      bio?: string | null;
      invited?: boolean;
      /** Keep entity-owned identity fields current without replacing generated profile copy. */
      syncIdentity?: boolean;
    }): Promise<SlpAccount> {
      await reconcilePublicHandles();
      const existing = await this.getSlurpAccountForEntity(
        input.kind,
        input.entityId,
        input.kind === "persona" && input.invited !== false ? "viewer" : "creator",
      );
      if (existing) {
        return db.transaction(async (tx) => {
          const rows = await tx.select().from(slpAccounts).where(eq(slpAccounts.id, existing.id));
          const row = rows[0];
          if (!row) return existing;
          const settings = normalizeSlpAccountSettings(row.settings);
          const profileManuallyEdited = settings.profile.profileManuallyEdited === true;
          const updates: Record<string, unknown> = { updatedAt: now() };
          if (input.syncIdentity && !profileManuallyEdited) {
            updates.displayName = input.displayName.trim().slice(0, 120) || row.handle;
            if (input.avatarUrl !== undefined) updates.avatarUrl = input.avatarUrl;
          } else if (!String(row.displayName ?? "").trim()) {
            updates.displayName = input.displayName || row.handle;
          }
          if (!profileManuallyEdited && !String(row.bio ?? "").trim() && input.bio) updates.bio = input.bio;
          if (!input.syncIdentity && !row.avatarUrl && input.avatarUrl) updates.avatarUrl = input.avatarUrl;
          if (input.invited !== undefined) updates.invited = String(input.invited);
          if (input.avatarCrop !== undefined && !profileManuallyEdited) {
            updates.settings = JSON.stringify({
              ...settings,
              profile: { ...settings.profile, avatarCrop: input.avatarCrop },
            });
          }
          await tx.update(slpAccounts).set(updates).where(eq(slpAccounts.id, existing.id));
          const updatedRows = await tx.select().from(slpAccounts).where(eq(slpAccounts.id, existing.id));
          return updatedRows[0] ? mapAccount(updatedRows[0]) : existing;
        });
      }

      const id = await db.transaction(async (tx) => {
        const timestamp = now();
        const accountId = newId();
        const displayName = input.displayName.trim() || (input.kind === "persona" ? "User" : "Character");
        const publicRows = await tx.select().from(slpAccounts).where(eq(slpAccounts.platform, "slurp"));
        const reserved = new Set(publicRows.map((row) => normalizeHandle(row.handle, row.entityId)));
        const handle = nextAvailablePublicHandle(normalizeHandle(displayName, input.entityId), reserved);
        await tx.insert(slpAccounts).values({
          id: accountId,
          kind: input.kind,
          entityId: input.entityId,
          handle,
          displayName,
          bio: input.bio?.trim() ?? "",
          avatarUrl: input.avatarUrl ?? null,
          invited: String(input.invited ?? input.kind === "persona"),
          settings: JSON.stringify({
            ...emptySlpAccountSettings(),
            profile: input.avatarCrop !== undefined ? { avatarCrop: input.avatarCrop } : {},
          }),
          platform: "slurp",
          sourceKind: input.kind === "random_user" ? null : input.kind,
          sourceEntityId: input.kind === "random_user" ? null : input.entityId,
          slurpSourceAccountId: null,
          // Keep source identity mirrors for persisted Slurp rows.
          visibility: "public",
          publicAccountId: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        return accountId;
      });
      return (await this.getAccountById(id, { includeHidden: true }))!;
    },
    async updateAccount(id: string, input: SlpAccountUpdateInput): Promise<SlpAccount | null> {
      await reconcilePublicHandles();
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(slpAccounts)
          .where(and(eq(slpAccounts.id, id), eq(slpAccounts.platform, "slurp")));
        const row = rows[0];
        if (!row) return null;
        await tx
          .update(slpAccounts)
          .set({
            ...(input.handle !== undefined && { handle: normalizeHandle(input.handle, row.entityId) }),
            ...(input.displayName !== undefined && { displayName: input.displayName.trim().slice(0, 120) }),
            ...(input.bio !== undefined && { bio: input.bio.slice(0, 500) }),
            ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
            ...(input.invited !== undefined && { invited: String(input.invited) }),
            updatedAt: now(),
          })
          .where(eq(slpAccounts.id, id));
        const updatedRows = await tx.select().from(slpAccounts).where(eq(slpAccounts.id, id));
        return updatedRows[0] ? mapAccount(updatedRows[0]) : null;
      });
    },
    async updateAccountProfile(id: string, input: SlpAccountProfileUpdateInput): Promise<SlpAccount | null> {
      await reconcilePublicHandles();
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(slpAccounts)
          .where(and(eq(slpAccounts.id, id), eq(slpAccounts.platform, "slurp")));
        const row = rows[0];
        if (!row) return null;
        const settings = normalizeSlpAccountSettings(row.settings);
        const nextSettings: SlpAccountSettings = {
          ...settings,
          profile: { ...settings.profile, ...input.profile },
        };
        await tx
          .update(slpAccounts)
          .set({
            ...(input.handle !== undefined && { handle: normalizeHandle(input.handle, row.entityId) }),
            ...(input.displayName !== undefined && { displayName: input.displayName.trim().slice(0, 120) }),
            ...(input.bio !== undefined && { bio: input.bio.slice(0, 500) }),
            ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
            settings: JSON.stringify(nextSettings),
            updatedAt: now(),
          })
          .where(eq(slpAccounts.id, id));
        const updatedRows = await tx.select().from(slpAccounts).where(eq(slpAccounts.id, id));
        return updatedRows[0] ? mapAccount(updatedRows[0]) : null;
      });
    },
    async patchAccountSettings(id: string, input: SlpAccountSettingsPatchInput): Promise<SlpAccount | null> {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(slpAccounts).where(eq(slpAccounts.id, id));
        const row = rows[0];
        if (!row) return null;
        if (row.platform !== "slurp") return null;
        if (input.subtree !== "privacy" && input.subtree !== "scheduler" && input.subtree !== "social") return null;
        if (
          row.platform === "slurp" &&
          input.subtree === "privacy" &&
          (input.patch.identityDisclosure !== undefined || input.patch.stagePersonality !== undefined)
        ) {
          return null;
        }
        const current = normalizeSlpAccountSettings(row.settings);
        let next: SlpAccountSettings;
        if (input.subtree === "social") {
          // Feed-visit timestamps only ever move forward. Two visits can be in flight at once
          // (both surfaces record on mount), and the later request is not always the later
          // timestamp — an out-of-order write would resurrect an already-cleared counter.
          const social = { ...current.social, ...input.patch };
          for (const field of ["noodleFeedSeenAt", "noodlerFeedSeenAt"] as const) {
            const stored = current.social[field];
            if (stored && social[field] && !(Date.parse(social[field]) > (Date.parse(stored) || 0))) {
              social[field] = stored;
            }
          }
          next = { ...current, social };
        } else if (input.subtree === "scheduler") {
          if (row.sourceKind === "persona" && row.kind === "persona" && input.patch.autoPosting?.enabled === true) {
            return null;
          }
          const currentAuto = current.scheduler.autoPosting ?? defaultAutoPostingSettings();
          const patchAuto = input.patch.autoPosting;
          const patchFan = input.patch.fanActivity;
          const config = patchAuto
            ? {
                enabled: patchAuto.enabled ?? currentAuto.enabled,
                imagesEnabled: patchAuto.imagesEnabled ?? currentAuto.imagesEnabled,
              }
            : currentAuto;
          next = {
            ...current,
            scheduler: {
              ...current.scheduler,
              autoPosting: config,
              ...(patchFan === null
                ? { fanActivity: undefined }
                : patchFan
                  ? {
                      fanActivity: {
                        ...current.scheduler.fanActivity,
                        ...patchFan,
                        ...(patchFan.archetypeWeights && { archetypeWeights: patchFan.archetypeWeights }),
                      },
                    }
                  : {}),
            },
          };
        } else {
          const access = { ...current.privacy.access, ...input.patch.access };
          next = {
            ...current,
            privacy: {
              ...current.privacy,
              ...input.patch,
              access: {
                ...access,
                hiddenFromAccountIds: withoutCreatorSelfHiddenAccountId(
                  access.hiddenFromAccountIds,
                  row.sourceEntityId ?? row.entityId,
                ),
              },
            },
          };
        }
        await tx
          .update(slpAccounts)
          .set({ settings: JSON.stringify(next), updatedAt: now() })
          .where(eq(slpAccounts.id, id));
        const updatedRows = await tx.select().from(slpAccounts).where(eq(slpAccounts.id, id));
        return updatedRows[0] ? mapAccount(updatedRows[0]) : null;
      });
    },
    /** Every NoodleR creator account with automatic posting enabled, settings attached. */
    async listAutoPostEnabledAccounts(): Promise<SlpAccount[]> {
      const rows = await db.select().from(slpAccounts).where(eq(slpAccounts.platform, "slurp"));
      const enabled = rows
        .map(mapAccount)
        .filter((account) => account.settings.scheduler.autoPosting?.enabled === true);
      const checked = await Promise.all(
        enabled.map(async (account) => {
          if (account.sourceKind === "persona" && account.kind === "persona") {
            await this.patchAccountSettings(account.id, {
              subtree: "scheduler",
              patch: { autoPosting: { enabled: false } },
            });
            return null;
          }
          const publicAccount = await this.resolveAccountSource(account);
          if (publicAccount && (await resolveCreatorSourceSnapshot(db, publicAccount))) return account;
          await this.patchAccountSettings(account.id, {
            subtree: "scheduler",
            patch: { autoPosting: { enabled: false } },
          });
          return null;
        }),
      );
      return checked.filter((account): account is SlpAccount => account !== null);
    },
    /**
     * Latest real posting activity per creator: the newest published post or prepared slot.
     * Account `updatedAt` moves on profile edits, which is not activity, so scheduling order
     * must come from this instead.
     */
    async getNoodlerCreatorActivityTimes(): Promise<Map<string, string>> {
      const [posts, prepared] = await Promise.all([
        db.select().from(slpPosts),
        db.select().from(slpCreatorPreparedPosts),
      ]);
      const latest = new Map<string, string>();
      const observe = (accountId: string, at: string) => {
        const current = latest.get(accountId);
        if (!current || at > current) latest.set(accountId, at);
      };
      for (const post of posts) observe(post.authorAccountId, post.createdAt);
      for (const item of prepared) {
        if (item.state !== "discarded") observe(item.creatorAccountId, item.publishAt);
      }
      return latest;
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
