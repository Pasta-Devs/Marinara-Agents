import { and, desc, eq, lt, or } from "../../../db/file-query.js";
import { NoodleAccountSettings, NoodleAccountSubscription } from "@marinara-engine/shared";
import { isSlurpFileUniqueConstraintError } from "../../base/host/slp-file-errors.js";
import { readSlurpWallet, slurpWalletKey, spend, subscriptionPaidThrough } from "../../modules/economy/slp-wallet.js";
import { createSlpActiveModifierProvider } from "../../base/modifiers/slp-active-modifier-provider.js";
import { slurpSubscriptionCharge } from "../../modules/economy/slp-creator-pricing.js";
import { slurpPlatformEventModifierSource } from "../../modules/world/events/slp-platform-events.js";
import { createSlurpPopulationStorage } from "../audience/slp-audience-storage-funnel.js";
import { slurpEarningsKey } from "../../modules/economy/slp-earnings.js";
import { isNoodlerHiddenFromViewer } from "../../base/identity/slp-access.js";
import {
  noodleAccounts,
  noodleAccountSubscriptions,
  noodlePosts,
  noodlePostUnlocks,
} from "../../../db/schema/slurp.js";
import { newId, now } from "../../../utils/id-generator.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import { slurpViewerSettingsKey } from "../host/slp-storage-constants.js";
import type { NoodlerPostPageCursor } from "../host/slp-storage-constants.js";
import { normalizeNoodleAccountSettings } from "../../modules/records/slp-storage-model.js";
import { mapAccount, mapSubscription } from "../host/slp-storage-mappers.js";
import type { SlurpStorageContext } from "../host/slp-storage-context.js";

export function createEconomyStorage1(context: SlurpStorageContext) {
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
    /**
     * Subscribe a viewer to a creator for one paid period.
     *
     * Returns `null` when the viewer cannot afford the creator's price, alongside the existing
     * "no" for a hidden or self-owned creator. Re-subscribing to a creator that is already paid
     * up charges nothing, so the route stays idempotent.
     */
    async subscribe(viewerAccountId: string, creatorAccountId: string): Promise<NoodleAccountSubscription | null> {
      if (viewerAccountId === creatorAccountId) return null;
      const settings = await this.getSettings();
      return enqueueFinancial(async () => {
        const viewer = await this.getViewer(viewerAccountId);
        if (!viewer) return null;
        const creatorRows = await db
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, creatorAccountId), eq(noodleAccounts.platform, "slurp")));
        const creator = creatorRows[0] ? mapAccount(creatorRows[0]) : null;
        if (
          !creator ||
          (creator.sourceKind === "persona" && creator.sourceEntityId === viewerAccountId) ||
          isNoodlerHiddenFromViewer(creator, viewerAccountId)
        )
          return null;
        const existing = await db
          .select()
          .from(noodleAccountSubscriptions)
          .where(
            and(
              eq(noodleAccountSubscriptions.viewerAccountId, viewerAccountId),
              eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId),
            ),
          );
        // `now()` returns an ISO string. Every use below wants a Date — `at.getTime()`, `spend`,
        // and `subscriptionPaidThrough` — so the string made the first subscribe for a viewer fail
        // with "toISOString is not a function" and return a 500.
        const at = new Date();
        // The charge for a *new* subscription, with whatever is running right now applied. The
        // provider is built from the settings snapshot this transaction already read, so a
        // Backstage edit to the event list takes effect on the next subscribe with no restart, and
        // the price stays derived rather than stored-and-patched. An existing subscription is not
        // re-priced: it renews at the price captured in the wallet below.
        const price = settings.walletEnabled
          ? slurpSubscriptionCharge(
              await this.getCreatorSubscriptionPrice(creatorAccountId),
              createSlpActiveModifierProvider([slurpPlatformEventModifierSource(settings.platformEvents)]),
              at,
            )
          : 0;
        const existingWallet = settings.walletEnabled ? await getWalletNow(viewerAccountId) : null;
        const existingPayment = existingWallet?.subscriptions[creatorAccountId];
        const existingPaymentIsValid =
          !settings.walletEnabled ||
          (existingPayment !== undefined &&
            Number.isFinite(Date.parse(existingPayment.paidThroughAt)) &&
            Date.parse(existingPayment.paidThroughAt) > at.getTime());
        if (existing[0] && existingPaymentIsValid) {
          const followingAccountIds = viewer.settings.social.followingAccountIds ?? [];
          if (!followingAccountIds.includes(creatorAccountId)) {
            const followingAccountTimestamps = { ...viewer.settings.social.followingAccountTimestamps };
            followingAccountTimestamps[creatorAccountId] ??= existing[0].createdAt;
            const currentSettings = normalizeNoodleAccountSettings(
              await settingsStore.get(slurpViewerSettingsKey(viewerAccountId)),
            );
            await createAppSettingsStorage(db).set(
              slurpViewerSettingsKey(viewerAccountId),
              JSON.stringify({
                ...currentSettings,
                wallet: existingWallet ? { coins: existingWallet.coins } : currentSettings.wallet,
                social: {
                  ...currentSettings.social,
                  followingAccountIds: [...followingAccountIds, creatorAccountId],
                  followingAccountTimestamps,
                },
              }),
            );
          }
          await this.advanceAudienceTie(viewerAccountId, creatorAccountId, {
            stage: "subscriber",
            hasSubscription: true,
          });
          return mapSubscription(existing[0]);
        }

        if (existing[0] && settings.walletEnabled && existingWallet) {
          const charged = spend(existingWallet, "subscribe", price, at, creatorAccountId);
          if (!charged) {
            await this.unsubscribe(viewerAccountId, creatorAccountId, true);
            return null;
          }
          const walletAfterCharge = {
            ...charged,
            subscriptions: {
              ...charged.subscriptions,
              [creatorAccountId]: { paidThroughAt: subscriptionPaidThrough(at, economyFrom(settings)), price },
            },
          };
          const previousWalletValue = await settingsStore.get(slurpWalletKey(viewerAccountId));
          const previousViewerSettingsValue = await settingsStore.get(slurpViewerSettingsKey(viewerAccountId));
          const earningsKey = slurpEarningsKey(creatorAccountId);
          const previousEarnings = await settingsStore.get(earningsKey);
          try {
            await writeWallet(viewerAccountId, walletAfterCharge);
            const followingAccountIds = viewer.settings.social.followingAccountIds ?? [];
            const followingAccountTimestamps = { ...viewer.settings.social.followingAccountTimestamps };
            followingAccountTimestamps[creatorAccountId] ??= existing[0].createdAt;
            await createAppSettingsStorage(db).set(
              slurpViewerSettingsKey(viewerAccountId),
              JSON.stringify({
                ...viewer.settings,
                wallet: { coins: walletAfterCharge.coins },
                social: {
                  ...viewer.settings.social,
                  followingAccountIds: followingAccountIds.includes(creatorAccountId)
                    ? followingAccountIds
                    : [...followingAccountIds, creatorAccountId],
                  followingAccountTimestamps,
                },
              }),
            );
            await creditEarningsNow(
              creatorAccountId,
              "subscribe",
              Math.floor((price * settings.walletCreatorRevenueSharePercent) / 100),
              `subscribe: ${creatorAccountId}`,
            );
            await this.notifyCreatorIncome(creatorAccountId, "subscribe", price, viewerAccountId);
            await this.advanceAudienceTie(viewerAccountId, creatorAccountId, {
              stage: "subscriber",
              spent: price,
              hasSubscription: true,
            });
          } catch (error) {
            await compensate(
              error,
              [
                () => restoreWallet(viewerAccountId, previousWalletValue, previousViewerSettingsValue),
                () => restoreSetting(earningsKey, previousEarnings),
              ],
              "subscription renewal",
            );
            throw error;
          }
          return mapSubscription(existing[0]);
        }

        const previousWallet = existingWallet ?? (await getWalletNow(viewerAccountId));
        const charged = settings.walletEnabled
          ? spend(previousWallet, "subscribe", price, at, creatorAccountId)
          : previousWallet;
        if (!charged) return null;
        const walletAfterCharge = settings.walletEnabled
          ? {
              ...charged,
              subscriptions: {
                ...charged.subscriptions,
                [creatorAccountId]: { paidThroughAt: subscriptionPaidThrough(at, economyFrom(settings)), price },
              },
            }
          : charged;
        const subscriptionId = newId();
        const earningsKey = slurpEarningsKey(creatorAccountId);
        const previousEarnings = await settingsStore.get(earningsKey);
        try {
          if (settings.walletEnabled) await writeWallet(viewerAccountId, walletAfterCharge);
          const subscription = await db.transaction(async (tx) => {
            const timestamp = now();
            const followingAccountIds = viewer.settings.social.followingAccountIds ?? [];
            const followingAccountTimestamps = { ...viewer.settings.social.followingAccountTimestamps };
            followingAccountTimestamps[creatorAccountId] ??= timestamp;
            const nextViewerSettings: NoodleAccountSettings = {
              ...viewer.settings,
              ...(settings.walletEnabled ? { wallet: { coins: walletAfterCharge.coins } } : {}),
              social: {
                ...viewer.settings.social,
                followingAccountIds: followingAccountIds.includes(creatorAccountId)
                  ? followingAccountIds
                  : [...followingAccountIds, creatorAccountId],
                followingAccountTimestamps,
              },
            };
            await tx.insert(noodleAccountSubscriptions).values({
              id: subscriptionId,
              viewerAccountId,
              creatorAccountId,
              createdAt: timestamp,
            });
            await createAppSettingsStorage(tx).set(
              slurpViewerSettingsKey(viewerAccountId),
              JSON.stringify(nextViewerSettings),
            );
            return { id: subscriptionId, viewerAccountId, creatorAccountId, createdAt: timestamp };
          });
          if (settings.walletEnabled) {
            await creditEarningsNow(
              creatorAccountId,
              "subscribe",
              Math.floor((price * settings.walletCreatorRevenueSharePercent) / 100),
              `subscribe: ${creatorAccountId}`,
            );
            await this.notifyCreatorIncome(creatorAccountId, "subscribe", price, viewerAccountId);
            await this.advanceAudienceTie(viewerAccountId, creatorAccountId, {
              stage: "subscriber",
              spent: price,
              hasSubscription: true,
            });
          }
          if (!settings.walletEnabled) {
            await this.advanceAudienceTie(viewerAccountId, creatorAccountId, {
              stage: "subscriber",
              hasSubscription: true,
            });
          }
          return subscription;
        } catch (error) {
          await compensate(
            error,
            [
              () => (settings.walletEnabled ? writeWallet(viewerAccountId, previousWallet) : Promise.resolve()),
              () => restoreSetting(earningsKey, previousEarnings),
              () => db.delete(noodleAccountSubscriptions).where(eq(noodleAccountSubscriptions.id, subscriptionId)),
              () =>
                createAppSettingsStorage(db).set(
                  slurpViewerSettingsKey(viewerAccountId),
                  JSON.stringify(viewer.settings),
                ),
            ],
            "subscription",
          );
          throw error;
        }
      });
    },
    async unsubscribe(
      viewerAccountId: string,
      creatorAccountId: string,
      internal = false,
      expire = false,
    ): Promise<void> {
      if (!internal) {
        await enqueueFinancial(() => this.unsubscribe(viewerAccountId, creatorAccountId, true, expire));
        return;
      }
      // Cancelling stops the renewal, it does not take back the week already paid for. Access runs
      // to `paidThroughAt`; the renewal sweep then ends the subscription for real (`expire`).
      const wallet = readSlurpWallet(await settingsStore.get(slurpWalletKey(viewerAccountId)));
      const current = wallet.subscriptions[creatorAccountId];
      if (!expire && current && Date.parse(current.paidThroughAt) > Date.now()) {
        if (current.cancelled) return;
        await writeWallet(viewerAccountId, {
          ...wallet,
          subscriptions: { ...wallet.subscriptions, [creatorAccountId]: { ...current, cancelled: true } },
        });
        return;
      }
      if (current) {
        const subscriptions = { ...wallet.subscriptions };
        delete subscriptions[creatorAccountId];
        await writeWallet(viewerAccountId, { ...wallet, subscriptions });
      }
      await db
        .delete(noodleAccountSubscriptions)
        .where(
          and(
            eq(noodleAccountSubscriptions.viewerAccountId, viewerAccountId),
            eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId),
          ),
        );
      // Losing a subscriber is news. A world that only reports good outcomes has no stakes.
      await this.recordCreatorEvent(creatorAccountId, "lapsed", { actorLabel: viewerAccountId });
      // Ending a subscription is not an unfollow: a viewer still in Following stays a follower.
      const stillFollowing = (await this.getViewer(viewerAccountId))?.settings.social.followingAccountIds?.includes(
        creatorAccountId,
      );
      await createSlurpPopulationStorage(db)
        .lapseTie(viewerAccountId, creatorAccountId, stillFollowing ? "follower" : "lapsed")
        .catch(() => undefined);
    },
    async listSubscriptionsForViewer(viewerAccountId: string): Promise<NoodleAccountSubscription[]> {
      const rows = await db
        .select()
        .from(noodleAccountSubscriptions)
        .where(eq(noodleAccountSubscriptions.viewerAccountId, viewerAccountId));
      return rows.map(mapSubscription);
    },
    async listSubscriptionsForCreator(creatorAccountId: string): Promise<NoodleAccountSubscription[]> {
      const rows = await db
        .select()
        .from(noodleAccountSubscriptions)
        .where(eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId))
        .orderBy(desc(noodleAccountSubscriptions.createdAt));
      return rows.map(mapSubscription);
    },
    async listSubscriptionsForCreatorPage(
      creatorAccountId: string,
      cursor: NoodlerPostPageCursor | null,
      limit: number,
    ) {
      const boundedLimit = Math.max(1, Math.min(20, Math.floor(limit)));
      const base = eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId);
      const rows = await db
        .select()
        .from(noodleAccountSubscriptions)
        .where(
          and(
            base,
            cursor
              ? or(
                  lt(noodleAccountSubscriptions.createdAt, cursor.createdAt),
                  and(
                    eq(noodleAccountSubscriptions.createdAt, cursor.createdAt),
                    lt(noodleAccountSubscriptions.id, cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(noodleAccountSubscriptions.createdAt), desc(noodleAccountSubscriptions.id))
        .limit(boundedLimit + 1);
      const items = rows.slice(0, boundedLimit).map(mapSubscription);
      const last = rows.slice(0, boundedLimit).at(-1);
      return {
        items,
        total: db.count(noodleAccountSubscriptions, base),
        nextCursor: rows.length > boundedLimit && last ? { createdAt: last.createdAt, id: last.id } : null,
      };
    },
    /**
     * Record a generated audience member buying a locked post without inventing a spendable
     * viewer wallet. The world operation owns payment and tie accounting; this unique row makes
     * the purchase visible in counts and prevents charging twice.
     */
    async recordAudiencePostUnlock(
      viewerAccountId: string,
      creatorAccountId: string,
      postId: string,
    ): Promise<boolean> {
      const rows = await db.select().from(noodlePosts).where(eq(noodlePosts.id, postId));
      const post = rows[0];
      if (!post || post.authorAccountId !== creatorAccountId || post.access !== "locked") return false;
      try {
        await db.insert(noodlePostUnlocks).values({ id: newId(), viewerAccountId, postId, createdAt: now() });
        return true;
      } catch (error) {
        if (isSlurpFileUniqueConstraintError(error, "slurp2_post_unlocks", ["viewerAccountId", "postId"])) return false;
        throw error;
      }
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
