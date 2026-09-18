import { and, eq, or } from "../../../db/file-query.js";
import { NoodleAccount, NoodleAccountSettings } from "@marinara-engine/shared";
import { noodleAccounts } from "../../../db/schema/slurp.js";
import { now } from "../../../utils/id-generator.js";
import {
  resolveSlurpAudienceCharacterIds,
  slurpCharacterFanEntityId,
  slurpCharacterIdFromFanEntityId,
  SlurpAudienceCharacterGroup,
} from "../../../services/slurp/slurp-audience-characters.js";
import { normalizeNoodleAccountSettings } from "../../base/host/slp-storage-model.js";
import type { SlurpAccount } from "../../base/host/slp-storage-model.js";
import { mapAccount, sourceAccountFromEntity } from "../../base/host/slp-storage-mappers.js";
import type { SlurpStorageContext } from "../../base/host/slp-storage-context.js";

export function createAudienceStorage1(context: SlurpStorageContext) {
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
    async updateAccountFollow(
      id: string,
      targetAccountId: string,
      followed: boolean,
      followedAt = new Date().toISOString(),
    ): Promise<{ account: NoodleAccount; changed: boolean } | null> {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "slurp")));
        const row = rows[0];
        if (!row) return null;
        const current = normalizeNoodleAccountSettings(row.settings);
        const followingAccountIds = current.social.followingAccountIds ?? [];
        const isFollowing = followingAccountIds.includes(targetAccountId);
        const followingAccountTimestamps = { ...current.social.followingAccountTimestamps };
        const hasFollowTimestamp = typeof followingAccountTimestamps[targetAccountId] === "string";
        if (isFollowing === followed && (!followed || hasFollowTimestamp)) {
          return { account: mapAccount(row), changed: false };
        }
        if (followed) followingAccountTimestamps[targetAccountId] = followedAt;
        else delete followingAccountTimestamps[targetAccountId];
        const next: NoodleAccountSettings = {
          ...current,
          social: {
            ...current.social,
            followingAccountIds: followed
              ? [...followingAccountIds, targetAccountId]
              : followingAccountIds.filter((accountId) => accountId !== targetAccountId),
            followingAccountTimestamps,
          },
        };
        await tx
          .update(noodleAccounts)
          .set({ settings: JSON.stringify(next), updatedAt: now() })
          .where(eq(noodleAccounts.id, id));
        const updatedRows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id));
        return updatedRows[0] ? { account: mapAccount(updatedRows[0]), changed: true } : null;
      });
    },
    async setCharacterInvited(characterId: string, invited: boolean): Promise<NoodleAccount | null> {
      const existing = await this.getSlurpAccountForEntity("character", characterId);
      if (!existing) return null;
      return this.updateAccount(existing.id, { invited });
    },
    /**
     * Put a character in the audience, or take it out.
     *
     * `true` invites and lets the Fan Type be derived; a string pins that Fan Type; `false` is an
     * explicit removal that outranks group membership, so a group can be invited and one of its
     * members dropped. `null` forgets the character entirely and lets its group decide again.
     *
     * The account row is never deleted here. A removed character keeps its handle, its ties, and
     * its history, exactly as a dismissed ambient profile does, so re-inviting is not a new person.
     */
    async setAudienceCharacter(characterId: string, value: string | boolean | null): Promise<void> {
      const settings = await this.getSettings();
      const next = { ...settings.audienceCharacters };
      if (value === null) delete next[characterId];
      else next[characterId] = value;
      await this.updateSettings({ audienceCharacters: next });
    },
    /** Characters eligible to stand in the audience, in priority order. Uncapped; see the module. */
    async listAudienceCharacterIds(): Promise<string[]> {
      const [settings, groups] = await Promise.all([this.getSettings(), characters.listGroups().catch(() => [])]);
      return resolveSlurpAudienceCharacterIds(settings, groups as SlurpAudienceCharacterGroup[]);
    },
    /**
     * Create the missing audience rows and refresh the identity of the rest.
     *
     * The `ensureAmbientNoodleAccounts` shape, for the same reasons: provision what is missing,
     * never delete, and leave a profile the user edited by hand alone. `syncIdentity` is what makes
     * a renamed or re-avatared character catch up, since a `random_user` row has null source columns
     * and so cannot be resolved back to its character by `resolveAccountSource`.
     *
     * A character with no card left is skipped rather than provisioned, so deleting a character
     * quietly retires its fan instead of leaving a nameless account behind.
     */
    async ensureAudienceCharacterAccounts(): Promise<NoodleAccount[]> {
      const characterIds = await this.listAudienceCharacterIds();
      const accounts: NoodleAccount[] = [];
      for (const characterId of characterIds) {
        const source = await characters.getById(characterId).catch(() => null);
        if (!source) continue;
        const identity = sourceAccountFromEntity(
          "character",
          characterId,
          source as unknown as Record<string, unknown>,
        );
        accounts.push(
          await this.upsertAccountFromProfile({
            kind: "random_user",
            entityId: slurpCharacterFanEntityId(characterId),
            displayName: identity.displayName,
            bio: identity.bio,
            avatarUrl: identity.avatarUrl,
            avatarCrop: identity.avatarCrop,
            invited: true,
            syncIdentity: true,
          }),
        );
      }
      return accounts;
    },
    /**
     * The provisioned audience rows, paired with the character behind each.
     *
     * Reads rows rather than settings, so a character removed from the audience drops out here
     * even though its row survives.
     */
    async listAudienceCharacterAccounts(): Promise<Array<{ account: SlurpAccount; characterId: string }>> {
      const invitedIds = new Set(await this.listAudienceCharacterIds());
      if (invitedIds.size === 0) return [];
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(and(eq(noodleAccounts.kind, "random_user"), eq(noodleAccounts.platform, "slurp")));
      const accounts: SlurpAccount[] = rows.map(mapAccount);
      return accounts.flatMap((account) => {
        const characterId = slurpCharacterIdFromFanEntityId(account.entityId);
        return characterId && invitedIds.has(characterId) ? [{ account, characterId }] : [];
      });
    },
    /** Mark every currently invited character account as uninvited. */
    async clearCharacterInvites(): Promise<void> {
      await db
        .update(noodleAccounts)
        .set({ invited: "false", updatedAt: now() })
        .where(
          and(
            eq(noodleAccounts.kind, "character"),
            eq(noodleAccounts.invited, "true"),
            eq(noodleAccounts.platform, "slurp"),
          ),
        );
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
