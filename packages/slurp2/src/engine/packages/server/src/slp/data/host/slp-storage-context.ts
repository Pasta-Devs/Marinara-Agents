import { and, eq, inArray, isNull, or } from "../../../db/file-query.js";
import { readNoodlePollFromMetadata, NoodleAccount, NoodleInteraction, NoodlePlatform } from "@marinara-engine/shared";
import type { DB } from "../../../db/connection.js";
import { isSlurpFileUniqueConstraintError } from "../../base/host/slp-file-errors.js";
import {
  readSlurpWallet,
  slurpWalletKey,
  SLURP_DEFAULT_ECONOMY,
  SlurpEconomy,
  SlurpWallet,
} from "../../modules/economy/slp-wallet.js";
import { readSlurpGoal, slurpGoalKey, slurpGoalProgress } from "../../modules/projects/slp-goal.js";
import {
  readSlurpProject,
  readSlurpProjects,
  slurpProjectsKey,
  SlurpProject,
} from "../../modules/projects/slp-project.js";
import { slurpArcEffectMultiplier } from "../../modules/projects/slp-arc-progress.js";
import { isSlurpCrossover } from "../../modules/projects/slp-project.js";
import {
  readSlurpCrossoverRef,
  slurpCrossoverMerge,
  slurpCrossoverView,
} from "../../modules/projects/slp-arc-crossover.js";
import {
  earn as earnCreatorIncome,
  readSlurpEarnings,
  slurpEarningsKey,
  SlurpEarnings,
  SlurpEarningsEntryKind,
} from "../../modules/economy/slp-earnings.js";
import { logger } from "../../../lib/logger.js";
import { canViewNoodlerPost, isNoodlerHiddenFromViewer } from "../../base/identity/slp-access.js";
import {
  noodleAccounts,
  noodleAccountSubscriptions,
  noodleActivityDigests,
  noodleInteractions,
  noodlePosts,
  noodlePostUnlocks,
  noodleRefreshRuns,
  noodlerCreatorReplyClaims,
} from "../../../db/schema/slurp.js";
import { newId, now } from "../../../utils/id-generator.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import { pruneNoodleRefreshRuns } from "../../base/host/slp-refresh-run-retention.js";
import { enqueueSlurpFinancial } from "../../base/host/slp-financial-queue.js";
import {
  addSlurpModifier,
  readSlurpCreatorState,
  SLURP_PAID_WELL_COINS,
  SlurpCreatorState,
} from "../../modules/creators/slp-creator-state.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { SLURP_SETTINGS_KEY, SLURP_CREATOR_STATE_KEY, slurpViewerSettingsKey } from "./slp-storage-constants.js";
import {
  parseRecord,
  normalizeNoodleAccountSettings,
  parseStringArray,
  normalizeHandle,
  nextAvailablePublicHandle,
  isToggleInteractionType,
} from "../../modules/records/slp-storage-model.js";
import type {
  AccountRow,
  DeleteStoredInteractionCommand,
  InsertInteractionCommand,
} from "../../modules/records/slp-storage-model.js";
import { normalizeSlurpSettings } from "../../modules/settings/slp-settings.js";
import type { SlurpSettings } from "../../modules/settings/slp-settings.js";
import { mapAccount, snapshotForAccount, mapPost, mapInteraction } from "./slp-storage-mappers.js";

export function createSlurpStorageContext(db: DB) {
  const settingsStore = createAppSettingsStorage(db);

  const characters = createCharactersStorage(db);

  let publicHandleReconciliation: Promise<void> | null = null;

  /** One Creator's stored projects list as raw entries: projects and crossover references. */
  const readProjectEntries = async (creatorAccountId: string): Promise<unknown[]> => {
    try {
      const parsed = JSON.parse((await settingsStore.get(slurpProjectsKey(creatorAccountId))) ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const isProjectEntry = (entry: unknown, projectId: string) =>
    readSlurpCrossoverRef(entry)?.projectId === projectId || readSlurpProject(entry)?.id === projectId;

  const loadProjects = async (creatorAccountId: string): Promise<SlurpProject[]> => {
    const out: SlurpProject[] = [];
    for (const entry of await readProjectEntries(creatorAccountId)) {
      const ref = readSlurpCrossoverRef(entry);
      const project = ref
        ? readSlurpProjects(await settingsStore.get(slurpProjectsKey(ref.ownerCreatorId))).find(
            (stored) => stored.id === ref.projectId && stored.creatorIds.includes(creatorAccountId),
          )
        : readSlurpProject(entry);
      if (project) out.push(slurpCrossoverView(project, creatorAccountId));
    }
    return out;
  };

  const writeProjects = async (creatorAccountId: string, projects: readonly SlurpProject[], at = new Date()) => {
    const entries: unknown[] = [];
    for (const project of projects) {
      const { partnerNames: _names, ...plain } = project;
      if (!isSlurpCrossover(plain)) {
        entries.push(plain);
        continue;
      }
      const ownerId = plain.creatorIds[0]!;
      const ownerEntries = ownerId === creatorAccountId ? null : await readProjectEntries(ownerId);
      const stored = readSlurpProjects(await settingsStore.get(slurpProjectsKey(ownerId))).find(
        (entry) => entry.id === plain.id,
      );
      const merged = stored ? slurpCrossoverMerge(stored, plain, creatorAccountId, at) : plain;
      if (!ownerEntries) {
        entries.push(merged);
        continue;
      }
      if (!stored) continue;
      entries.push({ crossoverOf: { ownerCreatorId: ownerId, projectId: plain.id } });
      await settingsStore.set(
        slurpProjectsKey(ownerId),
        JSON.stringify(ownerEntries.map((entry) => (readSlurpProject(entry)?.id === plain.id ? merged : entry))),
      );
    }
    await settingsStore.set(slurpProjectsKey(creatorAccountId), JSON.stringify(entries));
  };

  /**
   * Per-creator subscription prices, as one `creatorAccountId -> coins` blob. A creator that sets
   * no price of its own is billed at the Slurp-wide default, so this map stays small and no
   * backfill is ever needed.
   */
  const CREATOR_PRICES_KEY = "slurp2.creator-prices";

  const readCreatorPrices = async (): Promise<Record<string, number>> => {
    try {
      const parsed = JSON.parse((await settingsStore.get(CREATOR_PRICES_KEY)) ?? "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === "number" && Number.isInteger(entry[1]) && entry[1] >= 0,
        ),
      );
    } catch {
      return {};
    }
  };

  /** The economy the current Slurp settings describe, for the pure rules in `slurp-wallet.ts`. */
  const economyFrom = (settings: SlurpSettings): SlurpEconomy => ({
    ...SLURP_DEFAULT_ECONOMY,
    unlockCost: settings.walletUnlockCost,
    subscriptionCost: settings.walletSubscriptionCost,
    stipendFloor: settings.walletStipendFloor,
    dayStartHour: settings.walletDayStartHour,
    adReward: settings.walletAdReward,
    adDailyCap: settings.walletAdDailyCap,
    engagementReward: settings.walletEngagementReward,
    engagementDailyCap: settings.walletEngagementDailyCap,
    creatorRevenueSharePercent: settings.walletCreatorRevenueSharePercent,
  });

  const compensate = async (
    originalError: unknown,
    operations: Array<() => Promise<void>>,
    label: string,
  ): Promise<void> => {
    for (const operation of operations) {
      try {
        await operation();
      } catch (error) {
        logger.error(error, "[slurp] %s compensation failed; preserving original failure", label);
      }
    }
    logger.error(originalError, "[slurp] %s failed", label);
  };

  /**
   * Write the wallet, mirroring the balance onto `NoodleAccountSettings.wallet.coins` so the
   * balance the sidebar and header already read stays the authoritative number.
   */
  const writeWallet = async (viewerAccountId: string, wallet: SlurpWallet) => {
    const walletKey = slurpWalletKey(viewerAccountId);
    const viewerSettingsKey = slurpViewerSettingsKey(viewerAccountId);
    const previousWallet = await settingsStore.get(walletKey);
    const previousViewerSettings = await settingsStore.get(viewerSettingsKey);
    try {
      await settingsStore.set(walletKey, JSON.stringify(wallet));
      const stored = normalizeNoodleAccountSettings(previousViewerSettings);
      await settingsStore.set(viewerSettingsKey, JSON.stringify({ ...stored, wallet: { coins: wallet.coins } }));
    } catch (error) {
      await compensate(
        error,
        [
          () => restoreSetting(walletKey, previousWallet),
          () => restoreSetting(viewerSettingsKey, previousViewerSettings),
        ],
        "wallet write",
      );
      throw error;
    }
    return wallet;
  };

  const restoreSetting = async (key: string, value: string | null): Promise<void> => {
    if (value === null) await settingsStore.remove(key);
    else await settingsStore.set(key, value);
  };

  const restoreWallet = async (
    viewerAccountId: string,
    walletValue: string | null,
    viewerSettingsValue: string | null,
  ): Promise<void> => {
    const failures: unknown[] = [];
    for (const restore of [
      () => restoreSetting(slurpWalletKey(viewerAccountId), walletValue),
      () => restoreSetting(slurpViewerSettingsKey(viewerAccountId), viewerSettingsValue),
    ]) {
      try {
        await restore();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures[0]) throw failures[0];
  };

  const enqueueFinancial = <T>(operation: () => Promise<T>): Promise<T> => {
    return enqueueSlurpFinancial(db, operation);
  };

  const writeEarnings = async (creatorAccountId: string, earnings: SlurpEarnings) => {
    await settingsStore.set(slurpEarningsKey(creatorAccountId), JSON.stringify(earnings));
    return earnings;
  };

  const mutateCreatorStateNow = async (
    creatorAccountId: string,
    mutate: (state: SlurpCreatorState) => SlurpCreatorState,
  ): Promise<void> => {
    const key = `${SLURP_CREATOR_STATE_KEY}.${creatorAccountId}`;
    const state = readSlurpCreatorState(await settingsStore.get(key), new Date().toISOString());
    await settingsStore.set(key, JSON.stringify(mutate(state)));
  };

  const creditEarningsNow = async (
    creatorAccountId: string,
    kind: Exclude<SlurpEarningsEntryKind, "payout" | "reversal">,
    amount: number,
    note?: string,
    id?: string,
  ) => {
    const settings = normalizeSlurpSettings(await settingsStore.get(SLURP_SETTINGS_KEY));
    amount = Math.floor(
      amount * slurpArcEffectMultiplier(await loadProjects(creatorAccountId), "earnings", settings.arcStatEffects),
    );
    const current = readSlurpEarnings(await settingsStore.get(slurpEarningsKey(creatorAccountId)));
    const next = earnCreatorIncome(current, kind, amount, new Date(), note, id);
    if (next === current) return;
    await writeEarnings(creatorAccountId, next);
    try {
      if (amount >= SLURP_PAID_WELL_COINS) {
        await mutateCreatorStateNow(creatorAccountId, (state) => addSlurpModifier(state, "paid_well", note ?? kind));
      }
      const goal = readSlurpGoal(await settingsStore.get(slurpGoalKey(creatorAccountId)));
      if (goal && !slurpGoalProgress(goal, current.lifetime).met && slurpGoalProgress(goal, next.lifetime).met) {
        await mutateCreatorStateNow(creatorAccountId, (state) => addSlurpModifier(state, "goal_hit", goal.label));
      }
    } catch (error) {
      logger.warn(error, "[slurp] Could not record how earnings felt for %s", creatorAccountId);
    }
  };

  const getWalletNow = async (viewerAccountId: string): Promise<SlurpWallet> => {
    const settings = normalizeSlurpSettings(await settingsStore.get(SLURP_SETTINGS_KEY));
    return readSlurpWallet(await settingsStore.get(slurpWalletKey(viewerAccountId)), economyFrom(settings));
  };

  const pruneFinishedRefreshRuns = async () => {
    await db.transaction(async (tx) => {
      await pruneNoodleRefreshRuns({
        list: () => tx.select().from(noodleRefreshRuns),
        replace: async (rows) => {
          await tx.delete(noodleRefreshRuns);
          if (rows.length > 0) await tx.insert(noodleRefreshRuns).values(rows);
        },
        touch: async (row) => {
          await tx.update(noodleRefreshRuns).set({ updatedAt: row.updatedAt }).where(eq(noodleRefreshRuns.id, row.id));
        },
        flush: () => tx._fileStore.flush(),
      });
    });
  };

  const reconcilePublicHandles = () => {
    if (publicHandleReconciliation) return publicHandleReconciliation;
    publicHandleReconciliation = db
      .transaction(async (tx) => {
        const rows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.platform, "slurp"));
        const groups = new Map<string, AccountRow[]>();
        for (const row of rows) {
          const normalized = normalizeHandle(row.handle, row.entityId);
          const group = groups.get(normalized);
          if (group) group.push(row);
          else groups.set(normalized, [row]);
        }

        const reserved = new Set(groups.keys());
        for (const [base, group] of groups) {
          group.sort(
            (left, right) =>
              String(left.createdAt).localeCompare(String(right.createdAt)) || left.id.localeCompare(right.id),
          );
          const keeper = group.find((row) => row.handle === base) ?? group[0]!;
          for (const duplicate of group) {
            if (duplicate.id === keeper.id) continue;
            const handle = nextAvailablePublicHandle(base, reserved);
            reserved.add(handle);
            await tx
              .update(noodleAccounts)
              .set({ handle, updatedAt: now() })
              .where(eq(noodleAccounts.id, duplicate.id));
          }
          if (keeper.handle !== base) {
            await tx
              .update(noodleAccounts)
              .set({ handle: base, updatedAt: now() })
              .where(eq(noodleAccounts.id, keeper.id));
          }
        }
      })
      .catch((error) => {
        publicHandleReconciliation = null;
        throw error;
      });
    return publicHandleReconciliation;
  };

  const insertInteraction = async (
    postId: string,
    input: InsertInteractionCommand,
  ): Promise<NoodleInteraction | null> => {
    const readExistingToggleInteraction = async () => {
      if (!isToggleInteractionType(input.type)) return null;
      const existing = await db
        .select()
        .from(noodleInteractions)
        .where(
          and(
            eq(noodleInteractions.postId, postId),
            eq(noodleInteractions.actorAccountId, input.actor.id),
            eq(noodleInteractions.type, input.type),
            input.parentInteractionId
              ? eq(noodleInteractions.parentInteractionId, input.parentInteractionId)
              : isNull(noodleInteractions.parentInteractionId),
          ),
        );
      return existing[0] ? mapInteraction(existing[0]) : null;
    };

    const existingToggleInteraction = await readExistingToggleInteraction();
    if (existingToggleInteraction) return existingToggleInteraction;

    const id = newId();
    try {
      await db.insert(noodleInteractions).values({
        id,
        postId,
        parentInteractionId: input.parentInteractionId,
        actorAccountId: input.actor.id,
        type: input.type,
        content: input.content?.trim() || null,
        imageUrl: input.imageUrl?.trim() || null,
        actorSnapshot: JSON.stringify(snapshotForAccount(input.actor)),
        createdAt: now(),
      });
    } catch (error) {
      const toggleKeys = ["postId", "actorAccountId", "type", "parentInteractionId"];
      if (
        isToggleInteractionType(input.type) &&
        isSlurpFileUniqueConstraintError(error, "slurp2_interactions", toggleKeys)
      ) {
        const existing = await readExistingToggleInteraction();
        if (existing) return existing;
      }
      throw error;
    }
    const rows = await db.select().from(noodleInteractions).where(eq(noodleInteractions.id, id));
    return rows[0] ? mapInteraction(rows[0]) : null;
  };

  const normalizeLegacyNoodlerToggleInteraction = async (
    tx: Parameters<Parameters<DB["transaction"]>[0]>[0],
    input: {
      postId: string;
      actorAccountId: string;
      viewerPersonaId: string;
      type: "like" | "repost" | "vote";
      parentInteractionId: string | null;
      actor: NoodleAccount;
    },
  ) => {
    if (input.actorAccountId === input.viewerPersonaId) return;
    const actorWhere = and(
      eq(noodleInteractions.postId, input.postId),
      eq(noodleInteractions.type, input.type),
      input.parentInteractionId
        ? eq(noodleInteractions.parentInteractionId, input.parentInteractionId)
        : isNull(noodleInteractions.parentInteractionId),
    );
    const [legacyRows, actorRows] = await Promise.all([
      tx
        .select()
        .from(noodleInteractions)
        .where(and(actorWhere, eq(noodleInteractions.actorAccountId, input.viewerPersonaId))),
      tx
        .select()
        .from(noodleInteractions)
        .where(and(actorWhere, eq(noodleInteractions.actorAccountId, input.actorAccountId))),
    ]);
    if (legacyRows.length === 0) return;
    const legacyIds = legacyRows.map((row) => row.id);
    if (actorRows.length > 0) {
      await tx.delete(noodleInteractions).where(inArray(noodleInteractions.id, legacyIds));
      return;
    }
    const [keeper, ...duplicates] = legacyRows;
    await tx
      .update(noodleInteractions)
      .set({ actorAccountId: input.actorAccountId, actorSnapshot: JSON.stringify(snapshotForAccount(input.actor)) })
      .where(eq(noodleInteractions.id, keeper!.id));
    if (duplicates.length > 0) {
      await tx.delete(noodleInteractions).where(
        inArray(
          noodleInteractions.id,
          duplicates.map((row) => row.id),
        ),
      );
    }
  };

  const upsertPollVote = async (
    postId: string,
    actor: NoodleAccount,
    viewerPersonaId: string,
    optionId: string,
    authorPlatform: NoodlePlatform,
    imageUrl: string | null,
  ): Promise<NoodleInteraction | null> => {
    return db.transaction(async (tx) => {
      const [postRows, actorRows] = await Promise.all([
        tx.select().from(noodlePosts).where(eq(noodlePosts.id, postId)),
        tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, actor.id), eq(noodleAccounts.platform, "slurp"))),
      ]);
      const currentPost = postRows[0];
      if (!currentPost || !actorRows[0]) return null;
      const authorRows = await tx
        .select()
        .from(noodleAccounts)
        .where(and(eq(noodleAccounts.id, currentPost.authorAccountId), eq(noodleAccounts.platform, authorPlatform)));
      const currentPoll = readNoodlePollFromMetadata(parseRecord(currentPost.metadata));
      if (!authorRows[0] || !currentPoll?.options.some((option) => option.id === optionId)) return null;

      const currentActor = actorRows[0] ? mapAccount(actorRows[0]) : actor;
      if (authorPlatform === "noodler") {
        const currentAuthor = mapAccount(authorRows[0]);
        if (currentActor.kind !== "persona" || isNoodlerHiddenFromViewer(currentAuthor, viewerPersonaId)) {
          return null;
        }
        const currentPostView = mapPost(currentPost);
        const ownsAuthor = currentAuthor.sourceKind === "persona" && currentAuthor.sourceEntityId === viewerPersonaId;
        const subscriptionRows =
          currentPostView.access === "public"
            ? []
            : await tx
                .select()
                .from(noodleAccountSubscriptions)
                .where(
                  and(
                    eq(noodleAccountSubscriptions.viewerAccountId, viewerPersonaId),
                    eq(noodleAccountSubscriptions.creatorAccountId, currentAuthor.id),
                  ),
                );
        const unlockRows =
          currentPostView.access === "locked"
            ? await tx
                .select()
                .from(noodlePostUnlocks)
                .where(
                  and(
                    eq(noodlePostUnlocks.viewerAccountId, viewerPersonaId),
                    eq(noodlePostUnlocks.postId, currentPostView.id),
                  ),
                )
            : [];
        if (
          !ownsAuthor &&
          !canViewNoodlerPost({
            post: currentPostView,
            subscribed: subscriptionRows.length > 0,
            unlockedPostIds: new Set(unlockRows.map((unlock) => unlock.postId)),
          })
        ) {
          return null;
        }
      }
      await normalizeLegacyNoodlerToggleInteraction(tx, {
        postId,
        actorAccountId: currentActor.id,
        viewerPersonaId,
        type: "vote",
        parentInteractionId: null,
        actor: currentActor,
      });
      const existingVotes = await tx
        .select()
        .from(noodleInteractions)
        .where(
          and(
            eq(noodleInteractions.postId, postId),
            eq(noodleInteractions.actorAccountId, currentActor.id),
            eq(noodleInteractions.type, "vote"),
            isNull(noodleInteractions.parentInteractionId),
          ),
        );
      const existingVote = existingVotes[0];
      const voteId = existingVote?.id ?? newId();
      if (existingVotes.length > 1) {
        await tx.delete(noodleInteractions).where(
          inArray(
            noodleInteractions.id,
            existingVotes.slice(1).map((vote) => vote.id),
          ),
        );
      }
      if (existingVote) {
        await tx
          .update(noodleInteractions)
          .set({
            content: optionId,
            actorSnapshot: JSON.stringify(snapshotForAccount(currentActor)),
          })
          .where(eq(noodleInteractions.id, voteId));
      } else {
        await tx.insert(noodleInteractions).values({
          id: voteId,
          postId,
          parentInteractionId: null,
          actorAccountId: currentActor.id,
          type: "vote",
          content: optionId,
          imageUrl,
          actorSnapshot: JSON.stringify(snapshotForAccount(currentActor)),
          createdAt: now(),
        });
      }
      const updated = await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, voteId));
      return updated[0] ? mapInteraction(updated[0]) : null;
    });
  };

  /**
   * Deleting a comment must take its creator reply with it: the reply is unreadable once its
   * parent is gone, and the permanent claim row would keep consuming the rolling allowance
   * and block the comment slot forever.
   */
  const deleteInteractionChildren = async (
    tx: Parameters<Parameters<DB["transaction"]>[0]>[0],
    parentId: string,
  ): Promise<void> => {
    const parent = (await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, parentId)))[0];
    const rows = parent
      ? await tx.select().from(noodleInteractions).where(eq(noodleInteractions.postId, parent.postId))
      : [];
    // The whole descendant subtree goes, not just the direct children (same closure as
    // deleteInteractionById): a reply to a creator reply would otherwise survive its thread.
    const removed = new Set([parentId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const row of rows) {
        if (removed.has(row.id) || !row.parentInteractionId || !removed.has(row.parentInteractionId)) continue;
        removed.add(row.id);
        changed = true;
      }
    }
    const removedIds = [...removed];
    // Claims are keyed by either end of the pair, so a claim whose reply is going away must go
    // too or it keeps consuming the rolling allowance forever.
    await tx
      .delete(noodlerCreatorReplyClaims)
      .where(
        or(
          inArray(noodlerCreatorReplyClaims.parentInteractionId, removedIds),
          inArray(noodlerCreatorReplyClaims.replyInteractionId, removedIds),
        ),
      );
    const childIds = removedIds.filter((id) => id !== parentId);
    if (childIds.length === 0) return;
    await tx.delete(noodleActivityDigests).where(inArray(noodleActivityDigests.sourceInteractionId, childIds));
    await tx.delete(noodleInteractions).where(inArray(noodleInteractions.id, childIds));
  };

  const deleteStoredInteraction = async (
    postId: string,
    input: DeleteStoredInteractionCommand,
    digestDeletionPolicy: "protect-public-digests" | "delete-directly",
  ): Promise<NoodleInteraction | null> => {
    const parentInteractionId = input.parentInteractionId ?? null;
    const rows = await db
      .select()
      .from(noodleInteractions)
      .where(
        and(
          eq(noodleInteractions.postId, postId),
          eq(noodleInteractions.actorAccountId, input.actorAccountId),
          eq(noodleInteractions.type, input.type),
          parentInteractionId
            ? eq(noodleInteractions.parentInteractionId, parentInteractionId)
            : isNull(noodleInteractions.parentInteractionId),
        ),
      );
    const existing = rows[0];
    if (!existing) return null;

    if (digestDeletionPolicy === "delete-directly") {
      await db.transaction(async (tx) => {
        await deleteInteractionChildren(tx, existing.id);
        await tx.delete(noodleInteractions).where(eq(noodleInteractions.id, existing.id));
      });
      return mapInteraction(existing);
    }

    const relatedDigests = await db
      .select()
      .from(noodleActivityDigests)
      .where(eq(noodleActivityDigests.sourceInteractionId, existing.id));
    const slurpSourceAccountIds = new Set(
      (await db.select().from(noodleAccounts).where(eq(noodleAccounts.platform, "slurp"))).map((row) => row.id),
    );
    if (
      relatedDigests.some(
        (digest) => !parseStringArray(digest.accountIds).every((accountId) => slurpSourceAccountIds.has(accountId)),
      )
    ) {
      return null;
    }
    await db.transaction(async (tx) => {
      await deleteInteractionChildren(tx, existing.id);
      await tx.delete(noodleActivityDigests).where(eq(noodleActivityDigests.sourceInteractionId, existing.id));
      await tx.delete(noodleInteractions).where(eq(noodleInteractions.id, existing.id));
    });
    return mapInteraction(existing);
  };
  return {
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
  };
}

export type SlurpStorageContext = ReturnType<typeof createSlurpStorageContext>;
