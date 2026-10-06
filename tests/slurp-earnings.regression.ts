import assert from "node:assert/strict";
import { join } from "node:path";

import {
  earn,
  emptySlurpEarnings,
  payout,
  readSlurpEarnings,
  slurpPayoutAllowance,
  slurpPayoutCoins,
  slurpPlatformEarnings,
  reverse,
  slurpEarningsKey,
  slurpCreatorRevenueShare,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/economy/slp-earnings.js";
import { readSlurpGoal } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-goal.js";
import { slurpShownSubscribers } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-reach.js";
import { slurp2Source } from "./slurp2-source";

const at = new Date("2026-09-05T12:00:00.000Z");

// ── Earning raises both the balance and the score ───────────────────────────
const earned = earn(earn(emptySlurpEarnings(), "subscribe", 12, at, "@fan"), "tip", 50, at);
assert.equal(earned.coins, 62);
assert.equal(earned.lifetime, 62);
assert.equal(earned.ledger[0]?.kind, "tip");
assert.equal(earned.ledger[1]?.note, "@fan");

const creditedOnce = earn(emptySlurpEarnings(), "subscribe", 12, at, "@fan", "subscription-1");
const creditedTwice = earn(creditedOnce, "subscribe", 12, at, "@fan", "subscription-1");
assert.equal(creditedTwice.coins, 12);
assert.equal(creditedTwice.lifetime, 12);
assert.equal(creditedTwice.ledger.length, 1);

// Durable receipts outlive the 60-line display feed, so old credits and reversals remain
// idempotent and keep their exact historical amount after unrelated activity.
let durableCredit = earn(emptySlurpEarnings(), "tip", 37, at, "old", "old-credit");
for (let index = 0; index < 65; index += 1)
  durableCredit = earn(durableCredit, "tip", 1, at, undefined, `later-credit:${index}`);
assert.equal(
  durableCredit.ledger.some((entry) => entry.id === "old-credit"),
  false,
);
assert.equal(earn(durableCredit, "tip", 37, at, "old", "old-credit"), durableCredit);
assert.deepEqual(durableCredit.receipts["old-credit"], { kind: "tip", amount: 37 });

let durableReversal = reverse(durableCredit, 10, at, "old", "old-reversal");
for (let index = 0; index < 65; index += 1)
  durableReversal = earn(durableReversal, "tip", 1, at, undefined, `post-reversal:${index}`);
assert.equal(
  durableReversal.ledger.some((entry) => entry.id === "old-reversal"),
  false,
);
assert.equal(reverse(durableReversal, 10, at, "old", "old-reversal"), durableReversal);
assert.deepEqual(readSlurpEarnings(JSON.stringify(durableReversal)).receipts["old-reversal"], {
  kind: "reversal",
  amount: -10,
});

// Nothing is credited for a bad amount.
assert.equal(earn(earned, "tip", 0, at), earned);
assert.equal(earn(earned, "tip", -5, at), earned);
assert.equal(earn(earned, "tip", 1.5, at), earned);

// ── The daily allowance protects the fan economy ────────────────────────────
// This is the whole reason the two balances are separate. Earnings are meant to be large; spending
// money is meant to be scarce, because a purchase you can always afford is not a choice. 0.3.7:
// earnings are platform dollars and the allowance is counted in coins (15 to 60 a day) at
// `crowdWeight` dollars per coin, shared by every Creator one persona runs.
const W = 5;
{
  const small = earn(emptySlurpEarnings(), "tip", 500, at);
  const large = earn(emptySlurpEarnings(), "tip", 500_000, at);
  assert.ok(slurpPayoutAllowance(small, at, W) >= 75, "never worse than the daily refill: 15 coins");
  assert.ok(slurpPayoutAllowance(large, at, W) > slurpPayoutAllowance(small, at, W), "success must be felt");
  assert.equal(slurpPayoutAllowance(large, at, W), 300, "at most 60 coins a day, not an escape");
  // Whole coins only, and never more than is there.
  const broke = earn(emptySlurpEarnings(), "tip", 12, at);
  assert.equal(slurpPayoutAllowance(broke, at, W), 10);
  assert.equal(slurpPayoutCoins(10, W), 2);
  // The limit is shared: what another Creator of the same persona took today counts.
  const fresh = earn(emptySlurpEarnings(), "tip", 100, at);
  assert.equal(slurpPayoutAllowance(fresh, at, W), 85, "17 coins at 100 dollars of lifetime earnings");
  assert.equal(slurpPayoutAllowance(fresh, at, W, 10), 35, "10 coins taken elsewhere today");
  assert.equal(slurpPayoutAllowance(fresh, at, W, 17), 0);
}

// The allowance is spent down within a day and resets the next.
{
  const rich = earn(emptySlurpEarnings(), "tip", 5_000, at);
  const allowance = slurpPayoutAllowance(rich, at, W);
  const paidOut = payout(rich, allowance, at, W);
  assert.ok(paidOut);
  assert.equal(slurpPayoutAllowance(paidOut, at, W), 0, "the day's allowance is used up");
  const tomorrow = new Date("2026-09-06T12:00:00.000Z");
  assert.ok(slurpPayoutAllowance(paidOut, tomorrow, W) > 0, "a new day restores it");
  // R5: with the daily limit off, Collect moves every whole coin, also after a payout today.
  assert.equal(slurpPayoutAllowance(paidOut, at, W, 0, false), paidOut.coins - (paidOut.coins % W));
  assert.equal(slurpPayoutAllowance(rich, at, W, 60, false), 5_000, "other Creators' payouts do not count");
  assert.ok(payout(paidOut, 4_000, at, W, 0, false), "no daily allowance to refuse against");
  assert.equal(payout(paidOut, 4_000, at, W), null, "the default keeps the limit");
  // Refused rather than clamped: a caller asking for more has misread the state, and silently
  // paying less would leave the player believing they moved more.
  assert.equal(payout(rich, allowance + W, at, W), null);
  assert.equal(payout(rich, W + 1, at, W), null, "only whole coins' worth");
  // Counted in coins, so raising the weight later that day does not open more coins.
  assert.equal(slurpPayoutAllowance(paidOut, at, 20), 0);
}

// ── Fan money is platform money ─────────────────────────────────────────────
// A real 12-coin payment stands for five people, less Slurp's 20%: 48 dollars, which pays out 9 coins.
assert.equal(slurpPlatformEarnings(12, W), 48);
assert.equal(slurpPayoutCoins(slurpPlatformEarnings(12, W), W), 9);

// The shown subscriber count uses the same weight; a player's own subscription counts once.
assert.equal(slurpShownSubscribers(17, 1, W), 86);
// A tip goal opened before 0.3.7 counted coins: both ends scale, so its progress does not jump.
const oldGoal = readSlurpGoal('{"label":"Set","target":100,"startLifetime":40,"startedAt":"2026-09-01T00:00:00.000Z"}');
assert.deepEqual([oldGoal?.target, oldGoal?.startLifetime, oldGoal?.platform], [500, 200, true]);
const bigGoal = readSlurpGoal(
  '{"label":"Car","target":500000,"startLifetime":0,"startedAt":"2026-09-01T00:00:00.000Z"}',
);
assert.equal(bigGoal?.target, 2_500_000, "a converted goal keeps its full target");
assert.equal(readSlurpGoal(JSON.stringify(bigGoal))?.target, 2_500_000, "and reads back after it is stored");

// ── A payout moves money out but never lowers the score ─────────────────────
// Withdrawing what you earned does not mean you earned less. `lifetime` is what the Creator home
// shows as the score, so a payout must leave it alone.
const paid = payout(earned, 40, at, W);
assert.ok(paid);
assert.equal(paid.coins, 22);
assert.equal(paid.lifetime, 62, "a payout must not reduce lifetime earnings");
assert.equal(paid.ledger[0]?.amount, -40);

// A payout larger than the balance is refused, so callers must handle it.
assert.equal(payout(earned, 999, at, W), null);
assert.equal(payout(earned, 0, at, W), null);

// ── A reversal undoes money that was never really earned ────────────────────
// Unlike a payout, this does lower the score: the charge failed, so it was not income.
const reversed = reverse(earned, 12, at, "failed unlock");
assert.equal(reversed.coins, 50);
assert.equal(reversed.lifetime, 50, "a reversal must lower lifetime earnings");
assert.equal(reverse(earned, 999, at), earned, "a reversal beyond the balance does nothing");

// ── Reading back tolerates anything ─────────────────────────────────────────
assert.deepEqual(readSlurpEarnings(null), emptySlurpEarnings());
assert.deepEqual(readSlurpEarnings("not json"), emptySlurpEarnings());
assert.deepEqual(readSlurpEarnings("[]"), emptySlurpEarnings());
assert.equal(readSlurpEarnings('{"coins":-4}').coins, 0);
// Lifetime can never sit below the balance: every coin held was earned at some point.
assert.equal(readSlurpEarnings('{"coins":100,"lifetime":5,"platform":true}').lifetime, 100);
// A record from before 0.3.7 held coins: it reads as dollars at the legacy weight, so it pays out the same coins.
const legacy = readSlurpEarnings('{"coins":100,"lifetime":300,"receipts":{"r1":{"kind":"tip","amount":12}}}');
assert.equal(legacy.coins, 500);
assert.equal(legacy.lifetime, 1500);
assert.equal(legacy.receipts.r1?.amount, 60, "a later reversal matches the scaled credit");
assert.equal(legacy.platform, true);
// Same ledger validation as the wallet, for the same reason: the UI reads kind, amount, and at
// unconditionally, so a hand-edited blob must not reach it.
{
  const ledger = readSlurpEarnings(
    JSON.stringify({
      coins: 10,
      lifetime: 10,
      ledger: [
        { kind: "tip", amount: 5, at: "2026-01-02T03:04:05.000Z", note: "@someone" },
        { kind: "not-a-kind", amount: 5, at: "2026-01-02T03:04:05.000Z" },
        { kind: "tip", amount: "five", at: "2026-01-02T03:04:05.000Z" },
        { kind: "tip", amount: 5, at: "whenever" },
        null,
        { kind: "payout", amount: -5, at: "2026-01-02T03:04:05.000Z" },
      ],
    }),
  ).ledger;
  assert.deepEqual(
    ledger.map((entry) => entry.kind),
    ["tip", "payout"],
    "only renderable ledger lines survive a corrupt blob",
  );
}

// ── Earnings are keyed by Creator, not by persona ───────────────────────────
// This is the whole point. Income used to land in the operating persona's spending wallet, which
// made scarcity impossible once an audience existed. A character-backed Creator has no operating
// persona at all, so the account id is the only correct key.
assert.equal(slurpEarningsKey("creator-1"), "slurp2.creator.creator-1.earnings");
assert.equal(slurpCreatorRevenueShare(99, 37), 36, "reversals must use the configured floored Creator share");
assert.equal(slurpCreatorRevenueShare(99, 0), 0);

const storage = slurp2Source(
  join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts"),
);
assert.match(storage, /creditEarningsNow\(creator\.id, reason, share/u);
assert.doesNotMatch(
  storage,
  /const recipientId = creator\.sourceKind === "persona" \? creator\.sourceEntityId : creator\.id;/u,
  "creator income must not be redirected into a persona spending wallet",
);

// ── The circuit closes ──────────────────────────────────────────────────────
// Without a payout, earnings are a scoreboard attached to nothing and being a successful Creator
// does not change your life as a fan.
const slurpStorage = slurp2Source(
  join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts"),
);
assert.match(slurpStorage, /async payOutEarnings\(/u);
// Only a persona-backed Creator can pay out: a character-backed one has nobody to pay.
assert.match(
  slurpStorage,
  /creator\.sourceKind !== "persona" \|\| !creator\.sourceEntityId\) return \{ status: "refused" \}/u,
);
assert.match(slurpStorage, /enqueueSlurpFinancial\(db, operation\)/u, "financial serialization must be shared per DB");
assert.match(slurpStorage, /creditEarningsNow/u, "nested earnings writes must bypass the outer queue");
assert.match(
  slurpStorage,
  /await writeWallet\(viewerAccountId, charged\);[\s\S]*?restoreWallet\(viewerAccountId, previousWalletValue, previousViewerSettingsValue\)[\s\S]*?await db\.delete\(slpPostUnlocks\)\.where\(eq\(slpPostUnlocks\.id, unlock\.id\)/u,
  "an unlock failure restores both wallet keys and removes only its unlock row",
);
assert.match(
  slurpStorage,
  /if \(!paymentCompleted\)[\s\S]*?\/\/ Never leave a newly-created row[\s\S]*?await db\.delete\(slpPostUnlocks\)/u,
  "unlock cleanup runs even when compensation fails",
);
assert.match(
  slurpStorage,
  /await writeWallet\(viewerAccountId, walletAfterRenewal\);[\s\S]*?await creditEarningsNow\([\s\S]*?restoreWallet\(viewerAccountId, previousWalletValue, previousViewerSettingsValue\)/u,
  "renewal persists the wallet before crediting earnings and restores it on failure",
);
assert.match(
  slurpStorage,
  /for \(const creatorAccountId of renewal\.lapsed\)[\s\S]*?"lapsed subscription cleanup"/u,
  "lapsed subscription cleanup has a compensation path",
);
assert.match(
  slurpStorage,
  /"payout"[\s\S]*?restoreWallet\(recipientId, previousWalletValue, previousViewerSettingsValue\)[\s\S]*?writeEarnings\(creatorAccountId, current\)/u,
  "payout restores both wallet keys before restoring earnings",
);
assert.match(
  slurpStorage,
  /if \(settings\.walletEnabled\) await writeWallet\(viewerAccountId, walletAfterCharge\);[\s\S]*?await tx\.insert\(slpAccountSubscriptions\)/u,
  "a new subscription must charge before inserting its row",
);
assert.match(
  slurpStorage,
  /where\(eq\(slpAccountSubscriptions\.id, subscriptionId\)\)/u,
  "subscription rollback must remove only the new row",
);
assert.match(
  slurpStorage,
  /existing\[0\] && settings\.walletEnabled && existingWallet[\s\S]*?subscriptionPaidThrough\(at, economyFrom\(settings\)\)[\s\S]*?creditEarningsNow[\s\S]*?notifyCreatorIncome[\s\S]*?hasSubscription: true/u,
  "an expired existing subscription starts a new paid period",
);
assert.match(
  slurpStorage,
  /for \(const operation of operations\)[\s\S]*?logger\.error\(error, "\[slurp\] %s compensation failed/u,
  "compensation attempts every independent restore",
);
// Earnings are debited first, so a failure puts them back rather than minting spending money.
assert.match(slurpStorage, /writeEarnings\(creatorAccountId, current\)/u);

const payoutRoutes = slurp2Source(
  join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts"),
);
assert.match(payoutRoutes, /app\.post\("\/slurp\/accounts\/:id\/payout"/u);

// 0.3.7 wiring: fan money is credited at the platform scale (a brand's fee is not scaled twice), and
// the wallet gets coins at the weight, under one limit per persona.
const context = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/data/host/slp-storage-context.ts");
assert.match(
  context,
  /if \(kind !== "sponsor"\) amount = slurpPlatformEarnings\(amount, settings\.simulationTuning\.economy\.crowdWeight\)/u,
);
const payouts = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/data/economy/slp-economy-storage-3.ts",
);
assert.match(payouts, /credit\(wallet, "topUp", slurpPayoutCoins\(amount, crowdWeight\)/u);
assert.match(payouts, /sibling\.sourceEntityId === creator\.sourceEntityId/u);

console.log("slurp earnings regression passed");
