import { and, eq, like, or } from "../../../db/file-query.js";
import { PROFESSOR_MARI_ID, NoodleAccount } from "@marinara-engine/shared";
import {
  replaceSlurpDiscoveryTag,
  SlurpDiscoveryGender,
  normalizeSlurpDiscoveryTag,
  normalizeSlurpDiscoveryTags,
} from "../../../services/slurp/slurp-discovery-profile.js";
import { SLURP_ARC_LIBRARY_SEED } from "../../../services/slurp/slurp-project.js";
import {
  noodleAccounts,
  noodleAccountSubscriptions,
  noodleInteractions,
  noodlePostUnlocks,
  slurpEvents,
  slurpMessageClaims,
  slurpMessages,
  slurpReplyBubbles,
  slurpThreads,
  slurpCommissions,
} from "../../../db/schema/slurp.js";
import { appSettings } from "../../../db/schema/app-settings.js";
import { now } from "../../../utils/id-generator.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import {
  addSlurpModifier,
  applySlurpCreatorStateDelta,
  creatorStateDeltaForSignal,
  decaySlurpCreatorState,
  readSlurpCreatorState,
  SlurpCreatorState,
  SlurpCreatorStateSignal,
  SlurpModifierKind,
  SlurpStateDelta,
} from "../../../services/slurp/slurp-creator-state.js";
import {
  SLURP_SETTINGS_KEY,
  SLURP_CREATOR_STATE_KEY,
  slurpViewerSettingsKey,
  SLURP_BACKUP_TABLES,
  SLURP_BACKUP_TABLE_ORDER,
  SLURP_SETTINGS_NAMESPACE,
} from "../../base/host/slp-storage-constants.js";
import {
  emptyNoodleAccountSettings,
  defaultAutoPostingSettings,
  normalizeNoodleAccountSettings,
} from "../../base/host/slp-storage-model.js";
import type { SlurpSourceKind, SlurpNoodleAccountSettings, SlurpAccount } from "../../base/host/slp-storage-model.js";
import { isSlurpViewerActorAccount, normalizeSlurpSettings } from "../../base/settings/slp-settings.js";
import type { SlurpSettings, SlurpSettingsUpdateInput } from "../../base/settings/slp-settings.js";
import { mapViewer, sourceAccountFromEntity } from "../../base/host/slp-storage-mappers.js";
import type { SlurpStorageContext } from "../../base/host/slp-storage-context.js";

export function createCreatorsStorage1(context: SlurpStorageContext) {
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
    async resolveSource(sourceKind: SlurpSourceKind, sourceEntityId: string): Promise<NoodleAccount | null> {
      const source =
        sourceKind === "character"
          ? await characters.getById(sourceEntityId)
          : await characters.getPersona(sourceEntityId);
      return source
        ? sourceAccountFromEntity(sourceKind, sourceEntityId, source as unknown as Record<string, unknown>)
        : null;
    },
    async resolveSourceByEntityId(sourceEntityId: string): Promise<NoodleAccount | null> {
      // Every new Creator and every stage-profile draft resolves its source here, so this is the one
      // gate for Professor Mari. An existing Mari Creator resolves through `resolveAccountSource`.
      if (sourceEntityId === PROFESSOR_MARI_ID && !(await this.getSettings()).professorMariCreatorSource) return null;
      const character = await characters.getById(sourceEntityId);
      const persona = await characters.getPersona(sourceEntityId);
      if (character && persona) return null;
      if (character) {
        return sourceAccountFromEntity("character", sourceEntityId, character as unknown as Record<string, unknown>);
      }
      return persona
        ? sourceAccountFromEntity("persona", sourceEntityId, persona as unknown as Record<string, unknown>)
        : null;
    },
    async listEligibleSources(): Promise<NoodleAccount[]> {
      const [characterRows, personaRows, settings] = await Promise.all([
        characters.list(),
        characters.listPersonas(),
        this.getSettings(),
      ]);
      return [
        ...characterRows
          .filter((row) => row.id !== PROFESSOR_MARI_ID || settings.professorMariCreatorSource)
          .map((row) => sourceAccountFromEntity("character", row.id, row as unknown as Record<string, unknown>)),
        ...personaRows.map((row) =>
          sourceAccountFromEntity("persona", row.id, row as unknown as Record<string, unknown>),
        ),
      ];
    },
    async resolveAccountSource(account: Pick<SlurpAccount, "sourceKind" | "sourceEntityId">) {
      return this.resolveSource(account.sourceKind, account.sourceEntityId);
    },
    async getViewer(personaId: string): Promise<NoodleAccount | null> {
      const persona = await characters.getPersona(personaId);
      if (!persona) return null;
      const raw = await settingsStore.get(slurpViewerSettingsKey(personaId));
      return mapViewer(personaId, raw ? normalizeNoodleAccountSettings(raw) : emptyNoodleAccountSettings(), persona);
    },
    async listViewerWallets(personaIds: string[]): Promise<Record<string, { coins: number }>> {
      const wallets = await Promise.all(
        [...new Set(personaIds)].map(async (personaId) => {
          const viewer = await this.getViewer(personaId);
          // `settings.wallet.coins` is the Engine's own field, which defaults to 999_999 and is
          // only mirrored once Slurp first writes a wallet. Reading it showed a brand-new persona
          // as having 999,999 coins in the switcher while the Wallet page showed the real balance.
          return viewer ? ([personaId, { coins: (await getWalletNow(personaId)).coins }] as const) : null;
        }),
      );
      return Object.fromEntries(
        wallets.filter((wallet): wallet is readonly [string, { coins: number }] => wallet !== null),
      );
    },
    async cleanupRetiredViewer(personaId: string): Promise<void> {
      const authored = await db
        .select()
        .from(noodleInteractions)
        .where(eq(noodleInteractions.actorAccountId, personaId));
      for (const interaction of authored) await this.deleteInteractionById(interaction.id);
      await db.transaction(async (tx) => {
        const threads = await tx.select().from(slurpThreads).where(eq(slurpThreads.viewerAccountId, personaId));
        for (const thread of threads) {
          await tx.delete(slurpMessageClaims).where(eq(slurpMessageClaims.threadId, thread.id));
          await tx.delete(slurpMessages).where(eq(slurpMessages.threadId, thread.id));
          await tx.delete(slurpReplyBubbles).where(eq(slurpReplyBubbles.threadId, thread.id));
          await tx.delete(slurpThreads).where(eq(slurpThreads.id, thread.id));
        }
        await tx.delete(noodleAccountSubscriptions).where(eq(noodleAccountSubscriptions.viewerAccountId, personaId));
        await tx.delete(noodlePostUnlocks).where(eq(noodlePostUnlocks.viewerAccountId, personaId));
        await tx.delete(slurpCommissions).where(eq(slurpCommissions.viewerAccountId, personaId));
        await tx.delete(slurpEvents).where(eq(slurpEvents.recipientPersonaId, personaId));
        await createAppSettingsStorage(tx).remove(slurpViewerSettingsKey(personaId));
        await tx._fileStore.flush();
      });
    },
    async getSettings(): Promise<SlurpSettings> {
      const raw = await settingsStore.get(SLURP_SETTINGS_KEY);
      return normalizeSlurpSettings(raw);
    },
    async getCreatorState(creatorAccountId: string): Promise<SlurpCreatorState> {
      const raw = await settingsStore.get(`${SLURP_CREATOR_STATE_KEY}.${creatorAccountId}`);
      const fallback = new Date().toISOString();
      const state = readSlurpCreatorState(raw, fallback);
      const parsedUpdatedAt = Date.parse(state.updatedAt);
      const elapsedHours = Number.isFinite(parsedUpdatedAt)
        ? Math.max(0, (Date.now() - parsedUpdatedAt) / 3_600_000)
        : 0;
      if (elapsedHours <= 0) return state;
      const recovered = decaySlurpCreatorState(state, elapsedHours, fallback);
      await settingsStore.set(`${SLURP_CREATOR_STATE_KEY}.${creatorAccountId}`, JSON.stringify(recovered));
      return recovered;
    },
    /**
     * Move one Creator's shared state by a bounded delta.
     *
     * Separate from `recordCreatorStateSignals` because these callers are not reporting what a
     * fan did: they are the cost of work the Creator actually performed, and the world owns them.
     */
    async adjustCreatorState(creatorAccountId: string, changes: SlurpStateDelta): Promise<SlurpCreatorState> {
      const current = await this.getCreatorState(creatorAccountId);
      const next = applySlurpCreatorStateDelta(current, changes, new Date().toISOString());
      await settingsStore.set(`${SLURP_CREATOR_STATE_KEY}.${creatorAccountId}`, JSON.stringify(next));
      return next;
    },
    /**
     * Record that something happened to this Creator that will be true for a while.
     *
     * The one-off numeric change rides along inside `addSlurpModifier`, so callers never have to
     * know which dials a feeling moves — they say what happened and the table decides.
     */
    async addCreatorModifier(
      creatorAccountId: string,
      kind: SlurpModifierKind,
      source: string,
    ): Promise<SlurpCreatorState> {
      const current = await this.getCreatorState(creatorAccountId);
      const next = addSlurpModifier(current, kind, source);
      await settingsStore.set(`${SLURP_CREATOR_STATE_KEY}.${creatorAccountId}`, JSON.stringify(next));
      return next;
    },
    async recordCreatorStateSignals(
      creatorAccountId: string,
      signals: SlurpCreatorStateSignal[],
    ): Promise<SlurpCreatorState> {
      const current = await this.getCreatorState(creatorAccountId);
      const next = signals.reduce(
        (state, signal) =>
          applySlurpCreatorStateDelta(state, creatorStateDeltaForSignal(signal), new Date().toISOString()),
        current,
      );
      await settingsStore.set(`${SLURP_CREATOR_STATE_KEY}.${creatorAccountId}`, JSON.stringify(next));
      return next;
    },
    async getSlurpSettings() {
      return this.getSettings();
    },
    /**
     * Dump every table and setting this package owns.
     *
     * Unlike legacy Slurp, which had to filter its rows by creator and persona because it shared
     * tables with the public Noodle timeline, every `slurp2_*` table belongs to this package
     * alone. So the export is a wholesale dump: simpler, and it cannot silently drop the ambient
     * audience rows that a filtered export missed.
     *
     * Settings are collected by prefix rather than from a hand-written key list, so a new
     * `slurp2.*` key is included the day it is added instead of the day someone remembers it.
     * `garnish.ads.*` is deliberately excluded: the ad pool is shared with legacy Slurp by design.
     */
    async exportSlurpBackup() {
      const tables: Record<string, unknown[]> = {};
      for (const [name, table] of Object.entries(SLURP_BACKUP_TABLES)) {
        tables[name] = await db.select().from(table);
      }
      const settingRows = await db
        .select()
        .from(appSettings)
        .where(like(appSettings.key, `${SLURP_SETTINGS_NAMESPACE}%`));
      const settings: Record<string, string> = {};
      for (const row of settingRows) settings[String(row.key)] = String(row.value ?? "");
      return { settings, tables };
    },
    /**
     * Replace this package's data with the contents of a backup export.
     *
     * Restore is destructive and total: partial merges would collide on primary keys and leave
     * half-linked rows, so every owned table is cleared first and the whole write runs in one
     * transaction. Legacy Slurp's own data is never touched — a legacy install beside this one
     * keeps working, which is the entire point of the split.
     *
     * Unknown table names and unknown columns are skipped rather than rejected, so a backup taken
     * by a newer or older build still restores what both sides understand.
     */
    async importSlurpBackup(backup: {
      settings?: Record<string, string>;
      tables?: Record<string, unknown[]>;
      /** Settings are replaced only on explicit opt-in, and only when the archive carries some. */
      importSettings?: boolean;
    }): Promise<{ tables: Record<string, number>; settings: number; skipped: string[] }> {
      const skipped: string[] = [];
      const replaceSettings =
        backup.importSettings === true &&
        Object.keys(backup.settings ?? {}).some((key) => key.startsWith(SLURP_SETTINGS_NAMESPACE));
      const written: Record<string, number> = {};
      const incoming = backup.tables ?? {};
      for (const name of Object.keys(incoming)) {
        if (!(name in SLURP_BACKUP_TABLES)) skipped.push(name);
      }
      await db.transaction(async (tx) => {
        // Clear children before parents so a cascade cannot delete a row this restore just wrote.
        for (const name of [...SLURP_BACKUP_TABLE_ORDER].reverse()) {
          await tx.delete(SLURP_BACKUP_TABLES[name]);
        }
        for (const name of SLURP_BACKUP_TABLE_ORDER) {
          const rows = incoming[name];
          if (!Array.isArray(rows) || rows.length === 0) continue;
          const table = SLURP_BACKUP_TABLES[name];
          const columns = new Set(Object.keys(table));
          const values = rows
            .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
            .map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => columns.has(key))));
          for (const value of values) await tx.insert(table).values(value);
          written[name] = values.length;
        }
        if (replaceSettings) {
          const settingsTx = createAppSettingsStorage(tx);
          const stale = await tx
            .select()
            .from(appSettings)
            .where(like(appSettings.key, `${SLURP_SETTINGS_NAMESPACE}%`));
          for (const row of stale) await settingsTx.remove(String(row.key));
          for (const [key, value] of Object.entries(backup.settings ?? {})) {
            // A backup must never reach outside this package's own settings namespace.
            if (!key.startsWith(SLURP_SETTINGS_NAMESPACE)) {
              skipped.push(key);
              continue;
            }
            await settingsTx.set(key, value);
          }
        }
        await tx._fileStore.flush();
      });
      const settingsCount = replaceSettings
        ? Object.keys(backup.settings ?? {}).filter((key) => key.startsWith(SLURP_SETTINGS_NAMESPACE)).length
        : 0;
      return { tables: written, settings: settingsCount, skipped };
    },
    async updateSlurpSettings(input: SlurpSettingsUpdateInput) {
      return this.updateSettings(input);
    },
    /** How many Creators and arc types carry each tag, keyed by lower-cased tag. */
    async countDiscoveryTagUsage(): Promise<{ creators: Record<string, number>; arcTypes: Record<string, number> }> {
      const count = (counts: Record<string, number>, tags: readonly string[]) => {
        for (const tag of tags) counts[tag.toLocaleLowerCase()] = (counts[tag.toLocaleLowerCase()] ?? 0) + 1;
      };
      const creators: Record<string, number> = {};
      for (const account of await this.listNoodlerAccounts()) {
        if (!isSlurpViewerActorAccount(account)) count(creators, account.settings.profile.tags ?? []);
      }
      const arcTypes: Record<string, number> = {};
      for (const type of (await this.getSettings()).arcLibrary) count(arcTypes, type.tags);
      return { creators, arcTypes };
    },
    /**
     * Rename (`to` set) or delete (`to` null) a tag in the setting, on every arc type, and on every Creator profile.
     * A rename onto an existing tag merges the two.
     */
    /** Put a built-in arc type back to its shipped state, visible and enabled. */
    async resetArcType(id: string): Promise<SlurpSettings | null> {
      const seed = SLURP_ARC_LIBRARY_SEED.find((type) => type.id === id);
      const current = await this.getSettings();
      if (!seed || !current.arcLibrary.some((type) => type.id === id)) return null;
      return this.updateSettings({
        arcLibrary: current.arcLibrary.map((type) => (type.id === id ? structuredClone(seed) : type)),
      });
    },
    async replaceDiscoveryTag(from: string, to: string | null): Promise<SlurpSettings> {
      const key = from.toLocaleLowerCase();
      const current = await this.getSettings();
      const seen = new Set<string>();
      const discoveryTags = current.discoveryTags.flatMap((entry) => {
        const tag = entry.tag.toLocaleLowerCase() === key ? to : entry.tag;
        if (!tag || seen.has(tag.toLocaleLowerCase())) return [];
        seen.add(tag.toLocaleLowerCase());
        return [{ ...entry, tag }];
      });
      const arcLibrary = current.arcLibrary.map((type) =>
        type.tags.some((tag) => tag.toLocaleLowerCase() === key)
          ? { ...type, tags: replaceSlurpDiscoveryTag(type.tags, from, to) }
          : type,
      );
      const settings = await this.updateSettings({ discoveryTags, arcLibrary });
      await db.transaction(async (tx) => {
        const rows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.platform, "slurp"));
        for (const row of rows) {
          const accountSettings = normalizeNoodleAccountSettings(row.settings);
          const tags = accountSettings.profile.tags ?? [];
          if (!tags.some((tag) => tag.toLocaleLowerCase() === key)) continue;
          await tx
            .update(noodleAccounts)
            .set({
              settings: JSON.stringify({
                ...accountSettings,
                profile: { ...accountSettings.profile, tags: replaceSlurpDiscoveryTag(tags, from, to) },
              } satisfies SlurpNoodleAccountSettings),
              updatedAt: now(),
            })
            .where(eq(noodleAccounts.id, row.id));
        }
      });
      return settings;
    },
    /**
     * One edit applied to many Creators in one transaction: gender, tags (replace, add, remove), auto-post and images.
     * Viewer actors are never touched. A persona Creator cannot be switched to auto-post; that part is skipped.
     */
    // ponytail: no per-account operation lock, unlike the full stage-profile save; take the locks if bulk edits race generation.
    async bulkUpdateCreatorProfiles(
      ids: readonly string[],
      patch: {
        gender?: SlurpDiscoveryGender | null;
        tags?: string[];
        addTags?: string[];
        removeTags?: string[];
        autoPosting?: boolean;
        imagesEnabled?: boolean;
      },
    ): Promise<{ updated: number; skipped: number; tagLimitReached: number }> {
      const key = (tag: string) => normalizeSlurpDiscoveryTag(tag).toLocaleLowerCase();
      const creatorIds = new Set(
        (await this.listNoodlerAccounts())
          .filter((account) => ids.includes(account.id) && !isSlurpViewerActorAccount(account))
          .map((account) => account.id),
      );
      const remove = new Set((patch.removeTags ?? []).map(key));
      let updated = 0;
      let skipped = 0;
      let tagLimitReached = 0;
      await db.transaction(async (tx) => {
        const rows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.platform, "slurp"));
        for (const row of rows) {
          if (!creatorIds.has(row.id)) continue;
          const current = normalizeNoodleAccountSettings(row.settings);
          const candidate = [...(patch.tags ?? current.profile.tags ?? []), ...(patch.addTags ?? [])].filter(
            (tag) => !remove.has(key(tag)),
          );
          const tags = normalizeSlurpDiscoveryTags(candidate);
          if (new Set(candidate.map(key)).size > tags.length) tagLimitReached += 1;
          const auto = current.scheduler.autoPosting ?? defaultAutoPostingSettings();
          const blocked = patch.autoPosting === true && row.sourceKind === "persona" && row.kind === "persona";
          if (blocked) skipped += 1;
          await tx
            .update(noodleAccounts)
            .set({
              settings: JSON.stringify({
                ...current,
                profile: { ...current.profile, ...(patch.gender !== undefined && { gender: patch.gender }), tags },
                scheduler: {
                  ...current.scheduler,
                  autoPosting: {
                    enabled: patch.autoPosting !== undefined && !blocked ? patch.autoPosting : auto.enabled,
                    imagesEnabled: patch.imagesEnabled ?? auto.imagesEnabled,
                  },
                },
              } satisfies SlurpNoodleAccountSettings),
              updatedAt: now(),
            })
            .where(eq(noodleAccounts.id, row.id));
          updated += 1;
        }
      });
      return { updated, skipped: skipped + (ids.length - creatorIds.size), tagLimitReached };
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
