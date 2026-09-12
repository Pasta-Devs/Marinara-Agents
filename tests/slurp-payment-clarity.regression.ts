import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  readSlurpWallet,
  renewSubscriptions,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-wallet.js";

const read = (path: string) => readFileSync(path, "utf8");

// 5.4 — cancelling stops the renewal and keeps the paid week.
const paid = readSlurpWallet(
  JSON.stringify({
    coins: 100,
    subscriptions: {
      c1: { paidThroughAt: new Date(Date.now() + 86_400_000).toISOString(), price: 5, cancelled: true },
    },
  }),
);
assert.equal(paid.subscriptions.c1.cancelled, true);
const early = renewSubscriptions(paid, new Date());
assert.equal(early.wallet, paid, "a cancelled subscription inside its paid period is untouched");
const due = readSlurpWallet(
  JSON.stringify({
    coins: 100,
    subscriptions: { c1: { paidThroughAt: new Date(Date.now() - 1_000).toISOString(), price: 5, cancelled: true } },
  }),
);
const ended = renewSubscriptions(due, new Date());
assert.deepEqual(ended.lapsed, ["c1"]);
assert.deepEqual(ended.renewed, []);
assert.equal(ended.wallet.coins, 100, "an ended cancellation must not charge another period");
assert.equal(ended.wallet.subscriptions.c1, undefined);

const storage = read("packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts");
assert.match(storage, /!expire && current && Date\.parse\(current\.paidThroughAt\) > Date\.now\(\)/u);
assert.match(storage, /unsubscribe\(viewerAccountId, creatorAccountId, true, true\)/u);

// 5.1 / 5.3 / 5.4 copy and the cancel confirmation.
const home = read("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx");
assert.match(home, /ui\.slurp\.profile\.offer\.title/u);
assert.match(home, /ui\.slurp\.profile\.cancelSubscriptionConfirm/u);
const messages = read("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpMessages.tsx");
assert.match(messages, /ui\.slurp\.messages\.requestFeeHint/u);
assert.match(messages, /ui\.slurp\.messages\.commissionRefundHint/u);
const locales = JSON.parse(read("packages/slurp/src/engine/packages/client/src/localization/locales/en.json"));
for (const key of [
  "ui.slurp.profile.offer.title",
  "ui.slurp.profile.offer.tip",
  "ui.slurp.profile.cancelSubscriptionDetail",
  "ui.slurp.messages.commissionRefundHint",
  "ui.slurp.messages.requestFeeHint",
  "ui.slurp.messages.commissionCancel",
]) {
  assert.ok(locales[key], `missing locale key ${key}`);
}

console.log("slurp payment clarity regression: ok");
