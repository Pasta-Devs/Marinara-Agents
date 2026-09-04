import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyStipend,
  credit,
  earn,
  emptySlurpWallet,
  readSlurpWallet,
  renewSubscriptions,
  SLURP_DEFAULT_ECONOMY,
  spend,
  subscriptionPaidThrough,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-wallet.ts";

const day1 = new Date("2026-01-01T10:00:00.000Z");
const day2 = new Date("2026-01-02T10:00:00.000Z");

// A wallet with less than the floor is topped up to it, and never past it.
const poor = { ...emptySlurpWallet(), coins: 5 };
const stipended = applyStipend(poor, day1);
assert.equal(stipended.coins, SLURP_DEFAULT_ECONOMY.stipendFloor);
assert.equal(stipended.ledger[0]?.kind, "stipend");

// The stipend pays once per day, and pays nothing to a wallet already above the floor.
assert.equal(applyStipend(stipended, day1).coins, SLURP_DEFAULT_ECONOMY.stipendFloor);
const rich = applyStipend({ ...emptySlurpWallet(), coins: 5_000 }, day1);
assert.equal(rich.coins, 5_000, "the stipend tops up to the floor, it never adds to a full wallet");
assert.equal(rich.ledger.length, 0, "a stipend that paid nothing writes no ledger line");

// Earning is capped per day, and the cap resets when the day rolls over.
let earner = { ...emptySlurpWallet(), coins: 0, stipendOn: "2026-01-01" };
for (let index = 0; index < 100; index += 1) earner = earn(earner, "ad", day1);
assert.equal(earner.coins, SLURP_DEFAULT_ECONOMY.adDailyCap, "ad earning stops at the daily cap");
assert.equal(earn(earner, "engagement", day1).coins, SLURP_DEFAULT_ECONOMY.adDailyCap + 1, "caps are per kind");
assert.equal(earn(earner, "ad", day2).coins, SLURP_DEFAULT_ECONOMY.adDailyCap + SLURP_DEFAULT_ECONOMY.adReward);

// Spending refuses rather than going negative. This is the whole point of a real balance.
const spender = { ...emptySlurpWallet(), coins: 10 };
assert.equal(spend(spender, "unlock", 20, day1), null, "an unspendable balance returns null");
assert.equal(spend(spender, "unlock", 10, day1)?.coins, 0, "spending the exact balance is allowed");
assert.equal(spend(spender, "unlock", 3, day1)?.ledger[0]?.amount, -3, "spends are recorded as negative");

// A due subscription renews and charges; an unaffordable one lapses and is dropped.
const subscribed = {
  ...emptySlurpWallet(),
  coins: 20,
  subscriptions: {
    affordable: { paidThroughAt: "2025-12-01T00:00:00.000Z", price: 12 },
    unaffordable: { paidThroughAt: "2025-12-01T00:00:00.000Z", price: 500 },
  },
};
const renewal = renewSubscriptions(subscribed, day1);
assert.deepEqual(
  renewal.renewed.map((entry) => entry.creatorAccountId),
  ["affordable"],
);
assert.deepEqual(renewal.lapsed, ["unaffordable"]);
assert.equal(renewal.wallet.coins, 8);
assert.equal(renewal.wallet.subscriptions.unaffordable, undefined, "a lapsed subscription is dropped");
assert.equal(renewal.wallet.subscriptions.affordable?.paidThroughAt, subscriptionPaidThrough(day1));

// A subscription still inside its paid period is not charged again.
assert.equal(renewSubscriptions(renewal.wallet, day1).wallet, renewal.wallet);

// One period is a week.
assert.equal(Date.parse(subscriptionPaidThrough(day1)) - day1.getTime(), 7 * 86_400_000);

// Credits ignore nonsense amounts rather than corrupting the balance.
assert.equal(credit(spender, "topUp", 0, day1), spender);
assert.equal(credit(spender, "topUp", -5, day1), spender);
assert.equal(credit(spender, "topUp", 1.5, day1), spender);

// Corrupt or hand-edited stored state falls back instead of throwing.
assert.equal(readSlurpWallet("not json").coins, SLURP_DEFAULT_ECONOMY.startingCoins);
assert.equal(readSlurpWallet('{"coins":-4}').coins, SLURP_DEFAULT_ECONOMY.startingCoins);
assert.deepEqual(readSlurpWallet('{"subscriptions":{"a":{"price":"free"}}}').subscriptions, {});

// The storage layer must actually gate on the wallet, not just carry it.
const storage = readFileSync("packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts", "utf8");
assert.match(storage, /spend\(wallet, "unlock", price/u, "unlocking must debit the wallet");
assert.match(storage, /spend\(wallet, "subscribe", price/u, "subscribing must debit the wallet");
assert.match(storage, /creditCreatorIncome/u, "a paid creator's owner must be credited");
assert.match(storage, /walletEnabled: false/u, "the economy stays off for existing installs");

console.log("slurp-wallet regression passed");
