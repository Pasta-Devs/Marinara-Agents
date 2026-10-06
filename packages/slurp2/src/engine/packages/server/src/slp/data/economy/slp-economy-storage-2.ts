import { and, eq, or } from "../../../db/file-query.js";
import { SlpPostUnlock } from "../../../../../shared/src/slp/slp-social.types.js";
import { isSlurpFileUniqueConstraintError } from "../../base/host/slp-file-errors.js";
import { slpCreatorUnlockPriceFromMetadata } from "../../modules/economy/slp-prices.js";
import { createSlpActiveModifierProvider } from "../../base/modifiers/slp-active-modifier-provider.js";
import { slurpSubscriptionCharge } from "../../modules/economy/slp-creator-pricing.js";
import { slurpPlatformEventModifierSource } from "../../../../../shared/src/slp/slp-platform-events.js";
import {
  applyStipend,
  credit,
  earn,
  readSlurpWallet,
  recordWalletActivity,
  renewSubscriptions,
  slurpWalletKey,
  spend,
  SlurpWallet,
  SlurpWalletSpendKind,
  SlurpWalletSpendBinding,
} from "../../modules/economy/slp-wallet.js";
import { reverse as reverseEarnings, slurpEarningsKey } from "../../modules/economy/slp-earnings.js";
import { logger } from "../../../lib/logger.js";
import { slurpPostIncomeParts } from "../../modules/projects/slp-creator-ties.js";
import { parseRecord } from "../../modules/creators/slp-public-support.js";
import { slpAccounts, slpPosts, slpPostUnlocks } from "../../../db/schema/slurp.js";
import { newId, now } from "../../../utils/id-generator.js";
import { slurpViewerSettingsKey } from "../host/slp-storage-constants.js";
import { mapAccount, mapPost, mapPostUnlock } from "../host/slp-storage-mappers.js";
import type { SlurpStorageContext } from "../host/slp-storage-context.js";
import { CREATOR_PRICES_KEY } from "../host/slp-storage-constants.js";

export function createEconomyStorage2(context: SlurpStorageContext) {
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
     * Unlock a locked post for a viewer.
     *
     * Returns `null` when the viewer cannot afford it, which is the same "no" the caller already
     * handles for a missing or hidden post. The price comes from the post, so an edited price
     * survives a refresh.
     *
     */
    async unlockPost(
      viewerAccountId: string,
      postId: string,
      requestedPrice?: number,
      freeOnUnaffordable = false,
    ): Promise<{ unlock: SlpPostUnlock; chargedAmount: number; created: boolean } | null> {
      return enqueueFinancial(async () => {
        const viewer = await this.getViewer(viewerAccountId);
        if (!viewer) return null;
        const settings = await this.getSettings();
        let price = 0;
        if (settings.walletEnabled) {
          const target = (await db.select().from(slpPosts).where(eq(slpPosts.id, postId)))[0];
          if (!target) return null;
          price = requestedPrice ?? slpCreatorUnlockPriceFromMetadata(mapPost(target).metadata);
        }
        let created = false;
        const unlock = await db.transaction(async (tx) => {
          const postRows = await tx.select().from(slpPosts).where(eq(slpPosts.id, postId));
          const postRow = postRows[0];
          if (!postRow || mapPost(postRow).access !== "locked") {
            return null;
          }
          const authorRows = await tx
            .select()
            .from(slpAccounts)
            .where(and(eq(slpAccounts.id, postRow.authorAccountId), eq(slpAccounts.platform, "slurp")));
          const author = authorRows[0] ? mapAccount(authorRows[0]) : null;
          if (!author || (author.sourceKind === "persona" && author.sourceEntityId === viewerAccountId)) {
            return null;
          }
          const existing = await tx
            .select()
            .from(slpPostUnlocks)
            .where(and(eq(slpPostUnlocks.viewerAccountId, viewerAccountId), eq(slpPostUnlocks.postId, postId)));
          if (existing[0]) return mapPostUnlock(existing[0]);
          const timestamp = now();
          // An already-unlocked post stays idempotent.
          try {
            await tx.insert(slpPostUnlocks).values({ id: newId(), viewerAccountId, postId, createdAt: timestamp });
            created = true;
          } catch (error) {
            if (!isSlurpFileUniqueConstraintError(error, "slurp2_post_unlocks", ["viewerAccountId", "postId"]))
              throw error;
            const duplicate = await tx
              .select()
              .from(slpPostUnlocks)
              .where(and(eq(slpPostUnlocks.viewerAccountId, viewerAccountId), eq(slpPostUnlocks.postId, postId)));
            return duplicate[0] ? mapPostUnlock(duplicate[0]) : null;
          }
          const rows = await tx
            .select()
            .from(slpPostUnlocks)
            .where(and(eq(slpPostUnlocks.viewerAccountId, viewerAccountId), eq(slpPostUnlocks.postId, postId)));
          return rows[0] ? mapPostUnlock(rows[0]) : null;
        });
        if (!unlock) return null;
        let chargedAmount = 0;
        if (!created && settings.walletEnabled) {
          const wallet = await getWalletNow(viewerAccountId);
          chargedAmount = Math.abs(wallet.receipts[postId]?.amount ?? 0);
        }
        if (created && settings.walletEnabled) {
          const walletKey = slurpWalletKey(viewerAccountId);
          const viewerSettingsKey = slurpViewerSettingsKey(viewerAccountId);
          const previousWalletValue = await settingsStore.get(walletKey);
          const previousViewerSettingsValue = await settingsStore.get(viewerSettingsKey);
          const wallet = readSlurpWallet(previousWalletValue);
          const earningsBefore = new Map<string, string | null>();
          let paymentCompleted = false;
          try {
            // Only the gamble passes `freeOnUnaffordable`; its note says so, so the wallet ledger can
            // show the outcome ("Gamble unlock · Free" / "−75") after the toast is gone.
            const note = freeOnUnaffordable ? `gamble: ${postId}` : postId;
            const charged =
              spend(wallet, "unlock", price, new Date(), note) ??
              (freeOnUnaffordable ? spend(wallet, "unlock", 0, new Date(), note) : null);
            if (!charged) return null;
            // The spend carries no receipt id, so `receipts[postId]` was always empty and every unlock
            // reported 0: no Creator share, no income note, and a paid gamble told the fan "free".
            chargedAmount = wallet.coins - charged.coins;
            const post = (await db.select().from(slpPosts).where(eq(slpPosts.id, postId)))[0];
            // A collab post pays both pages (7b-c); every other post pays its author.
            const parts = post
              ? slurpPostIncomeParts(
                  { authorAccountId: post.authorAccountId, metadata: parseRecord(post.metadata) },
                  Math.floor((chargedAmount * settings.walletCreatorRevenueSharePercent) / 100),
                )
              : [];
            for (const part of parts)
              earningsBefore.set(part.creatorId, await settingsStore.get(slurpEarningsKey(part.creatorId)));
            await writeWallet(viewerAccountId, charged);
            if (post) {
              for (const part of parts)
                if (part.amount > 0)
                  await creditEarningsNow(part.creatorId, "unlock", part.amount, `unlock: ${post.authorAccountId}`);
              if (chargedAmount > 0)
                await this.notifyCreatorIncome(post.authorAccountId, "unlock", chargedAmount, viewerAccountId, post.id);
              await this.advanceAudienceTie(viewerAccountId, post.authorAccountId, {
                stage: "liker",
                spent: chargedAmount,
                unlocked: chargedAmount,
              });
            }
            paymentCompleted = true;
          } catch (error) {
            await compensate(
              error,
              [
                () => restoreWallet(viewerAccountId, previousWalletValue, previousViewerSettingsValue),
                ...[...earningsBefore].map(
                  ([creatorId, value]) =>
                    () =>
                      restoreSetting(slurpEarningsKey(creatorId), value),
                ),
              ],
              "unlock",
            );
            throw error;
          } finally {
            if (!paymentCompleted) {
              // Never leave a newly-created row that a retry could mistake for a paid unlock.
              try {
                await db.delete(slpPostUnlocks).where(eq(slpPostUnlocks.id, unlock.id));
              } catch (error) {
                logger.error(error, "[slurp] unlock cleanup failed for %s", unlock.id);
              }
            }
          }
        }
        return { unlock, chargedAmount: created && settings.walletEnabled ? chargedAmount : 0, created };
      });
    },
    /**
     * The viewer's wallet, with any due subscription renewals charged. The daily refill stays an
     * explicit action, so opening Wallet never claims it before the player can see it.
     *
     * A creator the viewer could not pay for is unsubscribed here, which is the whole consequence
     * of running out of coins.
     */
    /**
     * A generated audience member is not a player, so they never receive a daily stipend.
     *
     * They still hold a balance — they need one to pay a request fee — but only a real persona can
     * claim the daily refill route.
     */
    isSyntheticWalletHolder(accountId: string): boolean {
      return accountId.startsWith("slurp-fan:");
    },
    async getWallet(viewerAccountId: string): Promise<SlurpWallet> {
      return enqueueFinancial(async () => {
        const settings = await this.getSettings();
        const stored = await getWalletNow(viewerAccountId);
        if (!settings.walletEnabled || this.isSyntheticWalletHolder(viewerAccountId)) return stored;
        const previousWalletValue = await settingsStore.get(slurpWalletKey(viewerAccountId));
        const previousViewerSettingsValue = await settingsStore.get(slurpViewerSettingsKey(viewerAccountId));
        const at = new Date();
        const gone = new Set<string>();
        for (const creatorAccountId of Object.keys(stored.subscriptions))
          if (!(await this.getNoodlerAccountById(creatorAccountId, { includeHidden: true })))
            gone.add(creatorAccountId);
        const renewal = renewSubscriptions(stored, at, gone, viewerAccountId);
        if (renewal.wallet === stored) return stored;
        const walletAfterRenewal = renewal.lapsed.reduce(
          (wallet, creatorAccountId) => recordWalletActivity(wallet, "renew", 0, at, creatorAccountId),
          renewal.wallet,
        );
        const previousEarnings = new Map<string, string | null>();
        try {
          // Persist the charge before crediting income. A failed income write can then restore this
          // exact wallet and retry the renewal without charging or crediting it twice.
          await writeWallet(viewerAccountId, walletAfterRenewal);
          for (const renewed of renewal.renewed) {
            const creator = await this.getNoodlerAccountById(renewed.creatorAccountId);
            if (creator && settings.walletCreatorRevenueSharePercent > 0) {
              previousEarnings.set(creator.id, await settingsStore.get(slurpEarningsKey(creator.id)));
              await creditEarningsNow(
                creator.id,
                "renew",
                Math.floor((renewed.price * settings.walletCreatorRevenueSharePercent) / 100),
                `renew: ${creator.handle}`,
              );
            }
            await this.notifyCreatorIncome(renewed.creatorAccountId, "renew", renewed.price, viewerAccountId);
          }
        } catch (error) {
          await compensate(
            error,
            [
              ...[...previousEarnings].map(
                ([creatorId, earningsValue]) =>
                  () =>
                    restoreSetting(slurpEarningsKey(creatorId), earningsValue),
              ),
              () => restoreWallet(viewerAccountId, previousWalletValue, previousViewerSettingsValue),
            ],
            "subscription renewal",
          );
          throw error;
        }
        try {
          for (const creatorAccountId of renewal.lapsed)
            await this.unsubscribe(viewerAccountId, creatorAccountId, true, true);
        } catch (error) {
          await compensate(
            error,
            [
              ...[...previousEarnings].map(
                ([creatorId, earningsValue]) =>
                  () =>
                    restoreSetting(slurpEarningsKey(creatorId), earningsValue),
              ),
              () => restoreWallet(viewerAccountId, previousWalletValue, previousViewerSettingsValue),
            ],
            "lapsed subscription cleanup",
          );
          throw error;
        }
        return walletAfterRenewal;
      });
    },
    /** Subscription price for one creator: its own price when it has set one, else the default. */
    async getCreatorSubscriptionPrice(creatorAccountId: string): Promise<number> {
      const [prices, settings] = await Promise.all([readCreatorPrices(), this.getSettings()]);
      return prices[creatorAccountId] ?? settings.walletSubscriptionCost;
    },
    /**
     * What a new subscription costs right now: the weekly price moved by any running platform event,
     * exactly as `subscribe` charges it. Buttons, the 402 check and the price filter read this (R1-066).
     */
    async getCreatorSubscriptionCharge(creatorAccountId: string, at: Date = new Date()): Promise<number> {
      const [base, settings] = await Promise.all([
        this.getCreatorSubscriptionPrice(creatorAccountId),
        this.getSettings(),
      ]);
      // SlurpCoins off: everything is on the house, and the buttons say no price (R1-077).
      if (!settings.walletEnabled) return 0;
      return slurpSubscriptionCharge(
        base,
        createSlpActiveModifierProvider([
          slurpPlatformEventModifierSource(
            settings.platformEvents,
            await this.platformInfluenceStory(creatorAccountId),
          ),
        ]),
        at,
      );
    },
    /**
     * `getCreatorSubscriptionCharge` for every shown Creator at once. Every feed and profile page
     * priced each Creator separately: two settings clones, a price parse, an occurrence parse and an
     * account scan per row. Here those are read once and the Creator's tags come from the account.
     */
    async getCreatorSubscriptionCharges(
      creators: readonly { id: string; settings: { profile: { tags?: string[] } } }[],
      at: Date = new Date(),
    ): Promise<Record<string, number>> {
      const [prices, settings, occurrences] = await Promise.all([
        readCreatorPrices(),
        this.getSettings(),
        this.listStoryOccurrences().catch(() => []),
      ]);
      return Object.fromEntries(
        creators.map((creator) => [
          creator.id,
          settings.walletEnabled
            ? slurpSubscriptionCharge(
                prices[creator.id] ?? settings.walletSubscriptionCost,
                createSlpActiveModifierProvider([
                  slurpPlatformEventModifierSource(settings.platformEvents, {
                    occurrences,
                    creator: { id: creator.id, tags: creator.settings.profile.tags ?? [] },
                  }),
                ]),
                at,
              )
            : 0,
        ]),
      );
    },
    /** Set a creator's own weekly price, or clear it back to the Slurp-wide default with `null`. */
    async setCreatorSubscriptionPrice(creatorAccountId: string, price: number | null): Promise<void> {
      const prices = await readCreatorPrices();
      if (price === null) delete prices[creatorAccountId];
      else if (Number.isInteger(price) && price >= 0) prices[creatorAccountId] = price;
      else return;
      await settingsStore.set(CREATOR_PRICES_KEY, JSON.stringify(prices));
    },
    /** Credit capped earnings for acting on an ad or for the viewer's own engagement. */
    async earnCoins(viewerAccountId: string, kind: "ad" | "engagement", note?: string): Promise<SlurpWallet> {
      const settings = await this.getSettings();
      return enqueueFinancial(async () => {
        const wallet = await getWalletNow(viewerAccountId);
        if (!settings.walletEnabled) return wallet;
        const next = earn(wallet, kind, new Date(), note, economyFrom(settings));
        return next === wallet ? wallet : writeWallet(viewerAccountId, next);
      });
    },
    /** Claim the configured daily refill. The refill raises a low balance to its floor. */
    async claimWalletRefill(viewerAccountId: string): Promise<SlurpWallet> {
      const settings = await this.getSettings();
      return enqueueFinancial(async () => {
        const wallet = await getWalletNow(viewerAccountId);
        if (!settings.walletEnabled) return wallet;
        const next = applyStipend(wallet, new Date(), economyFrom(settings));
        return next === wallet ? wallet : writeWallet(viewerAccountId, next);
      });
    },
    async setWalletCoinsForDevelopment(viewerAccountId: string, coins: number): Promise<SlurpWallet> {
      if (!Number.isInteger(coins) || coins < 0) throw new Error("Wallet coins must be a non-negative integer.");
      const settings = await this.getSettings();
      return enqueueFinancial(async () => {
        const wallet = await getWalletNow(viewerAccountId);
        if (!settings.walletEnabled) return wallet;
        return writeWallet(viewerAccountId, { ...wallet, coins });
      });
    },
    /** Move a tip immediately from one persona wallet to one creator wallet. */
    async tipCreator(
      viewerAccountId: string,
      creatorAccountId: string,
      amount: number,
      operationId?: string,
    ): Promise<SlurpWallet | null> {
      if (viewerAccountId === creatorAccountId || !Number.isInteger(amount) || amount <= 0) return null;
      const settings = await this.getSettings();
      if (!settings.walletEnabled) return null;
      const run = enqueueFinancial(async () => {
        const creator = await this.getNoodlerAccountById(creatorAccountId);
        if (!creator || (creator.sourceKind === "persona" && creator.sourceEntityId === viewerAccountId)) return null;
        const sender = await getWalletNow(viewerAccountId);
        const binding: SlurpWalletSpendBinding = { viewerAccountId, creatorAccountId: creator.id };
        const charged = spend(sender, "tip", amount, new Date(), creator.handle, operationId, binding);
        if (!charged) return null;
        if (charged === sender) return sender;
        await writeWallet(viewerAccountId, charged);
        await creditEarningsNow(
          creator.id,
          "tip",
          Math.floor((amount * settings.walletCreatorRevenueSharePercent) / 100),
          `tip: ${creator.handle}`,
          operationId,
        );
        return charged;
      });
      return run;
    },
    /**
     * Debit a viewer for anything that is not a tip or a subscription, returning `null` when the
     * funds are not there. The direct-message paths route every charge through here so a locked
     * message, a request fee, and a commission all land in the one ledger the wallet page reads.
     */
    async spendCoins(
      viewerAccountId: string,
      kind: SlurpWalletSpendKind,
      amount: number,
      note?: string,
      operationId?: string,
    ): Promise<SlurpWallet | null> {
      const settings = await this.getSettings();
      if (!settings.walletEnabled || amount <= 0) return this.getWallet(viewerAccountId);
      const run = enqueueFinancial(async () => {
        const wallet = await getWalletNow(viewerAccountId);
        const charged = spend(wallet, kind, amount, new Date(), note, operationId);
        return charged ? writeWallet(viewerAccountId, charged) : null;
      });
      return run;
    },
    async hasWalletSpendOperation(viewerAccountId: string, operationId: string): Promise<boolean> {
      const wallet = await this.getWallet(viewerAccountId);
      return (wallet.receipts[operationId]?.amount ?? 0) < 0;
    },
    async refundCoins(viewerAccountId: string, amount: number, note: string, id?: string): Promise<SlurpWallet> {
      const run = enqueueFinancial(async () => {
        const wallet = await getWalletNow(viewerAccountId);
        return writeWallet(viewerAccountId, credit(wallet, "income", amount, new Date(), `refund: ${note}`, id));
      });
      return run;
    },
    /** Coins a Creator gives the player in a drama (an allowance, a gift). `id` is its receipt: never twice. */
    async creditGift(viewerAccountId: string, amount: number, note: string, id: string): Promise<SlurpWallet> {
      const settings = await this.getSettings();
      return enqueueFinancial(async () => {
        const wallet = await getWalletNow(viewerAccountId);
        // SlurpCoins off: everything is on the house, so no balance moves.
        if (!settings.walletEnabled) return wallet;
        return writeWallet(viewerAccountId, credit(wallet, "income", amount, new Date(), note, id));
      });
    },
    async reverseCreatorIncome(creatorAccountId: string, amount: number, note: string, id?: string): Promise<boolean> {
      const creator = await this.getNoodlerAccountById(creatorAccountId);
      if (!creator) return false;
      const run = enqueueFinancial(async () => {
        const current = await this.getEarnings(creator.id);
        const next = reverseEarnings(current, amount, new Date(), `reversal: ${note}`, id);
        if (next === current) return Boolean(id && current.receipts[id]?.kind === "reversal");
        await writeEarnings(creator.id, next);
        return true;
      });
      return run;
    },
    async hasCreatorIncomeOperation(creatorAccountId: string, id: string): Promise<boolean> {
      return (await this.getCreatorIncomeOperationAmount(creatorAccountId, id)) !== null;
    },
    async getCreatorIncomeOperationAmount(creatorAccountId: string, id: string): Promise<number | null> {
      const earnings = await this.getEarnings(creatorAccountId);
      const receipt = earnings.receipts[id];
      return receipt && receipt.kind !== "payout" && receipt.kind !== "reversal" && receipt.amount > 0
        ? receipt.amount
        : null;
    },
    /** A brand's fee for a sponsored post, paid once per deal (the receipt id). No platform share. */
    async creditSponsorFee(creatorAccountId: string, fee: number, brand: string, receiptId: string) {
      await enqueueFinancial(() => creditEarningsNow(creatorAccountId, "sponsor", fee, `sponsor: ${brand}`, receiptId));
    },
    /** A fan paid for a post: a collab post's income is split with the partner (7b-c). */
    async creditPostIncome(
      postId: string,
      creatorAccountId: string,
      price: number,
      reason: "unlock" | "tip",
      operationId?: string,
    ) {
      const post = (await db.select().from(slpPosts).where(eq(slpPosts.id, postId)))[0];
      const parts = post
        ? slurpPostIncomeParts({ authorAccountId: post.authorAccountId, metadata: parseRecord(post.metadata) }, price)
        : [{ creatorId: creatorAccountId, amount: price }];
      for (const part of parts) await this.creditCreatorIncome(part.creatorId, part.amount, reason, operationId);
    },
    /**
     * Pay a creator's owner when a fan pays that creator. Only a creator backed by one of this
     * install's personas pays that persona wallet. Other creators keep their own wallet.
     */
    async creditCreatorIncome(
      creatorAccountId: string,
      price: number,
      reason: "unlock" | "subscribe" | "renew" | "tip" | "messageRequest" | "ppv" | "commission",
      operationId?: string,
    ) {
      const settings = await this.getSettings();
      if (!settings.walletEnabled || settings.walletCreatorRevenueSharePercent <= 0) return;
      const creator = await this.getNoodlerAccountById(creatorAccountId);
      if (!creator) return;
      const share = Math.floor((price * settings.walletCreatorRevenueSharePercent) / 100);
      if (share <= 0) return;
      // Earnings belong to the Creator, not to the persona operating it. Paying into the
      // operator's spending wallet made income and spending money the same balance, so a real
      // audience would have ended every purchasing decision in the game. See slurp-earnings.ts.
      await enqueueFinancial(() =>
        creditEarningsNow(creator.id, reason, share, `${reason}: ${creator.handle}`, operationId),
      );
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
