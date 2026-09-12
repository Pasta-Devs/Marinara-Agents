import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  earn,
  emptySlurpEarnings,
  payout,
  readSlurpEarnings,
  slurpPayoutAllowance,
  reverse,
  slurpEarningsKey,
  slurpCreatorRevenueShare,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-earnings.js";

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
// money is meant to be scarce, because a purchase you can always afford is not a choice. If a
// successful Creator could move their whole balance across, the fan economy would end the moment
// the first audience arrived.
{
  const small = earn(emptySlurpEarnings(), "tip", 500, at);
  const large = earn(emptySlurpEarnings(), "tip", 50_000, at);
  assert.ok(slurpPayoutAllowance(small, at) >= 60, "withdrawing must never be worse than the daily stipend");
  assert.ok(slurpPayoutAllowance(large, at) > slurpPayoutAllowance(small, at), "success must be felt");
  // Roughly four times the stipend at the top, not an escape from the economy.
  assert.ok(slurpPayoutAllowance(large, at) <= 260);
  assert.ok(
    slurpPayoutAllowance(large, at) < slurpPayoutAllowance(small, at) * 4,
    "the curve must flatten rather than run away",
  );
  // Never more than is actually there.
  const broke = earn(emptySlurpEarnings(), "tip", 5, at);
  assert.equal(slurpPayoutAllowance(broke, at), 5);
}

// The allowance is spent down within a day and resets the next.
{
  const rich = earn(emptySlurpEarnings(), "tip", 5_000, at);
  const allowance = slurpPayoutAllowance(rich, at);
  const paidOut = payout(rich, allowance, at);
  assert.ok(paidOut);
  assert.equal(slurpPayoutAllowance(paidOut, at), 0, "the day's allowance is used up");
  const tomorrow = new Date("2026-09-06T12:00:00.000Z");
  assert.ok(slurpPayoutAllowance(paidOut, tomorrow) > 0, "a new day restores it");
  // Refused rather than clamped: a caller asking for more has misread the state, and silently
  // paying less would leave the player believing they moved more.
  assert.equal(payout(rich, allowance + 1, at), null);
}

// ── A payout moves money out but never lowers the score ─────────────────────
// Withdrawing what you earned does not mean you earned less. `lifetime` is what the Creator home
// shows as the score, so a payout must leave it alone.
const paid = payout(earned, 40, at);
assert.ok(paid);
assert.equal(paid.coins, 22);
assert.equal(paid.lifetime, 62, "a payout must not reduce lifetime earnings");
assert.equal(paid.ledger[0]?.amount, -40);

// A payout larger than the balance is refused, so callers must handle it.
assert.equal(payout(earned, 999, at), null);
assert.equal(payout(earned, 0, at), null);

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
assert.equal(readSlurpEarnings('{"coins":100,"lifetime":5}').lifetime, 100);
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
assert.equal(slurpEarningsKey("creator-1"), "slurp.creator.creator-1.earnings");
assert.equal(slurpCreatorRevenueShare(99, 37), 36, "reversals must use the configured floored Creator share");
assert.equal(slurpCreatorRevenueShare(99, 0), 0);

const storage = readFileSync(
  join(import.meta.dirname, "..", "packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts"),
  "utf8",
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
const slurpStorage = readFileSync(
  join(import.meta.dirname, "..", "packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts"),
  "utf8",
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
  /await writeWallet\(viewerAccountId, charged\);[\s\S]*?restoreWallet\(viewerAccountId, previousWalletValue, previousViewerSettingsValue\)[\s\S]*?await db\.delete\(noodlePostUnlocks\)\.where\(eq\(noodlePostUnlocks\.id, unlock\.id\)/u,
  "an unlock failure restores both wallet keys and removes only its unlock row",
);
assert.match(
  slurpStorage,
  /if \(!paymentCompleted\)[\s\S]*?\/\/ Never leave a newly-created row[\s\S]*?await db\.delete\(noodlePostUnlocks\)/u,
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
  /if \(settings\.walletEnabled\) await writeWallet\(viewerAccountId, walletAfterCharge\);[\s\S]*?await tx\.insert\(noodleAccountSubscriptions\)/u,
  "a new subscription must charge before inserting its row",
);
assert.match(
  slurpStorage,
  /where\(eq\(noodleAccountSubscriptions\.id, subscriptionId\)\)/u,
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

const payoutRoutes = readFileSync(
  join(import.meta.dirname, "..", "packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts"),
  "utf8",
);
assert.match(payoutRoutes, /app\.post\("\/noodler\/accounts\/:id\/payout"/u);
assert.match(payoutRoutes, /Only the Creator's owner can withdraw\./u);

console.log("slurp earnings regression passed");
