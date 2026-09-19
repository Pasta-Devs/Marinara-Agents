import { and, desc, eq, lt, or } from "../../../db/file-query.js";
import { SlpAccountSettings, SlpAccountSubscription } from "../../../../../shared/src/slp/slp-social.types.js";
import { isSlurpFileUniqueConstraintError } from "../../base/host/slp-file-errors.js";
import { readSlurpWallet, slurpWalletKey, spend, subscriptionPaidThrough } from "../../modules/economy/slp-wallet.js";
import { createSlpActiveModifierProvider } from "../../base/modifiers/slp-active-modifier-provider.js";
import { slurpSubscriptionCharge } from "../../modules/economy/slp-creator-pricing.js";
import { slurpPlatformEventModifierSource } from "../../../../../shared/src/slp/slp-platform-events.js";
import { createSlurpPopulationStorage } from "../audience/slp-audience-storage-funnel.js";
import { slurpEarningsKey } from "../../modules/economy/slp-earnings.js";
import { isCreatorHiddenFromViewer } from "../../base/identity/slp-access.js";
import { slpAccounts, slpAccountSubscriptions, slpPosts, slpPostUnlocks } from "../../../db/schema/slurp.js";
import { newId, now } from "../../../utils/id-generator.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import { slurpViewerSettingsKey } from "../host/slp-storage-constants.js";
import type { SlpCreatorPostPageCursor } from "../host/slp-storage-constants.js";
import { normalizeSlpAccountSettings } from "../../modules/records/slp-storage-model.js";
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
    async subscribe(viewerAccountId: string, creatorAccountId: string): Promise<SlpAccountSubscription | null> {
      if (viewerAccountId === creatorAccountId) return null;
      const settings = await this.getSettings();
      return enqueueFinancial(async () => {
        const viewer = await this.getViewer(viewerAccountId);
        if (!viewer) return null;
        const creatorRows = await db
          .select()
          .from(slpAccounts)
          .where(and(eq(slpAccounts.id, creatorAccountId), eq(slpAccounts.platform, "slurp")));
        const creator = creatorRows[0] ? mapAccount(creatorRows[0]) : null;
        if (
          !creator ||
          (creator.sourceKind === "persona" && creator.sourceEntityId === viewerAccountId) ||
          isCreatorHiddenFromViewer(creator, viewerAccountId)
        )
          return null;
        const existing = await db
          .select()
          .from(slpAccountSubscriptions)
          .where(
            and(
              eq(slpAccountSubscriptions.viewerAccountId, viewerAccountId),
              eq(slpAccountSubscriptions.creatorAccountId, creatorAccountId),
            ),
          );
        // `now()` returns an ISO string. Every use below wants a Date — `at.getTime()`, `spend`,
        // and `subscriptionPaidThrough` — so the string made the first subscribe for a viewer fail
        // with "toISOString is not a function" and return a 500.
        const at = new Date();
        // The Creator's own price, with no event applied. Renewing an existing subscription below
        // charges exactly this, as it did before platform events could move a price at all.
        const basePrice = settings.walletEnabled ? await this.getCreatorSubscriptionPrice(creatorAccountId) : 0;
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
            const currentSettings = normalizeSlpAccountSettings(
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

        // Renewing an existing subscription whose paid period has run out. A running event must
        // not change what an existing subscription costs, so this path never sees a modifier:
        // plan §1 keeps a subscription renewing at its agreed price.
        if (existing[0] && settings.walletEnabled && existingWallet) {
          const charged = spend(existingWallet, "subscribe", basePrice, at, creatorAccountId);
          if (!charged) {
            await this.unsubscribe(viewerAccountId, creatorAccountId, true);
            return null;
          }
          const walletAfterCharge = {
            ...charged,
            subscriptions: {
              ...charged.subscriptions,
              [creatorAccountId]: {
                paidThroughAt: subscriptionPaidThrough(at, economyFrom(settings)),
                price: basePrice,
              },
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
              Math.floor((basePrice * settings.walletCreatorRevenueSharePercent) / 100),
              `subscribe: ${creatorAccountId}`,
            );
            await this.notifyCreatorIncome(creatorAccountId, "subscribe", basePrice, viewerAccountId);
            await this.advanceAudienceTie(viewerAccountId, creatorAccountId, {
              stage: "subscriber",
              spent: basePrice,
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

        // A genuinely new subscription: the only charge an active platform event may move. The
        // provider is built from the settings snapshot this transaction already read, so a
        // Backstage edit to the event list takes effect on the next subscribe with no restart.
        // The charge is captured in the wallet below and every later renewal reuses it.
        const price = settings.walletEnabled
          ? slurpSubscriptionCharge(
              basePrice,
              createSlpActiveModifierProvider([slurpPlatformEventModifierSource(settings.platformEvents)]),
              at,
            )
          : 0;
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
            const nextViewerSettings: SlpAccountSettings = {
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
            await tx.insert(slpAccountSubscriptions).values({
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
              () => db.delete(slpAccountSubscriptions).where(eq(slpAccountSubscriptions.id, subscriptionId)),
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
        .delete(slpAccountSubscriptions)
        .where(
          and(
            eq(slpAccountSubscriptions.viewerAccountId, viewerAccountId),
            eq(slpAccountSubscriptions.creatorAccountId, creatorAccountId),
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
    async listSubscriptionsForViewer(viewerAccountId: string): Promise<SlpAccountSubscription[]> {
      const rows = await db
        .select()
        .from(slpAccountSubscriptions)
        .where(eq(slpAccountSubscriptions.viewerAccountId, viewerAccountId));
      return rows.map(mapSubscription);
    },
    async listSubscriptionsForCreator(creatorAccountId: string): Promise<SlpAccountSubscription[]> {
      const rows = await db
        .select()
        .from(slpAccountSubscriptions)
        .where(eq(slpAccountSubscriptions.creatorAccountId, creatorAccountId))
        .orderBy(desc(slpAccountSubscriptions.createdAt));
      return rows.map(mapSubscription);
    },
    async listSubscriptionsForCreatorPage(
      creatorAccountId: string,
      cursor: SlpCreatorPostPageCursor | null,
      limit: number,
    ) {
      const boundedLimit = Math.max(1, Math.min(20, Math.floor(limit)));
      const base = eq(slpAccountSubscriptions.creatorAccountId, creatorAccountId);
      const rows = await db
        .select()
        .from(slpAccountSubscriptions)
        .where(
          and(
            base,
            cursor
              ? or(
                  lt(slpAccountSubscriptions.createdAt, cursor.createdAt),
                  and(
                    eq(slpAccountSubscriptions.createdAt, cursor.createdAt),
                    lt(slpAccountSubscriptions.id, cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(slpAccountSubscriptions.createdAt), desc(slpAccountSubscriptions.id))
        .limit(boundedLimit + 1);
      const items = rows.slice(0, boundedLimit).map(mapSubscription);
      const last = rows.slice(0, boundedLimit).at(-1);
      return {
        items,
        total: db.count(slpAccountSubscriptions, base),
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
      const rows = await db.select().from(slpPosts).where(eq(slpPosts.id, postId));
      const post = rows[0];
      if (!post || post.authorAccountId !== creatorAccountId || post.access !== "locked") return false;
      try {
        await db.insert(slpPostUnlocks).values({ id: newId(), viewerAccountId, postId, createdAt: now() });
        return true;
      } catch (error) {
        if (isSlurpFileUniqueConstraintError(error, "slurp2_post_unlocks", ["viewerAccountId", "postId"])) return false;
        throw error;
      }
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
