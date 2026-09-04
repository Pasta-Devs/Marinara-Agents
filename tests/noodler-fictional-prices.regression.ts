import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NOODLER_SUBSCRIPTION_COST,
  NOODLER_UNLOCK_COST,
  noodlerUnlockPriceFromMetadata,
  noodlerUnlockPriceMetadata,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-prices";

// Prices became real in the coin economy, but only when the player turns it on. Until 1.0.12 the
// old wallet gated access unconditionally, so an imported, restored, or hand-edited wallet could
// silently break access. That is why the gate is now behind `walletEnabled`, defaults to off, and
// must stay that way: an install that never opted in behaves exactly as it always has.

assert.equal(NOODLER_UNLOCK_COST, 1);
assert.equal(NOODLER_SUBSCRIPTION_COST, 5);

// Stored on the post, so an explicit price survives refreshes and beats the shipped default.
assert.deepEqual(noodlerUnlockPriceMetadata(), { noodlerUnlockPrice: 1 });
assert.deepEqual(noodlerUnlockPriceMetadata(7), { noodlerUnlockPrice: 7 });
assert.equal(noodlerUnlockPriceFromMetadata({ noodlerUnlockPrice: 7 }), 7);
assert.equal(noodlerUnlockPriceFromMetadata({ noodlerUnlockPrice: 0 }), 0);

// Posts written before the field existed read the default, so no backfill pass is needed.
assert.equal(noodlerUnlockPriceFromMetadata({}), NOODLER_UNLOCK_COST);
assert.equal(noodlerUnlockPriceFromMetadata(null), NOODLER_UNLOCK_COST);
assert.equal(noodlerUnlockPriceFromMetadata(undefined), NOODLER_UNLOCK_COST);
// Hand-edited or imported junk must not produce NaN prices or negative ones.
for (const junk of [
  { noodlerUnlockPrice: "3" },
  { noodlerUnlockPrice: -1 },
  { noodlerUnlockPrice: 1.5 },
  { noodlerUnlockPrice: null },
]) {
  assert.equal(noodlerUnlockPriceFromMetadata(junk), NOODLER_UNLOCK_COST);
}

const storage = readFileSync("packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts", "utf8");
const fanInteraction = storage.slice(
  storage.indexOf("async createNoodlerFanInteraction("),
  storage.indexOf("async deleteNoodlerInteraction("),
);
assert.match(fanInteraction, /postRow\.access !== "public" && postRow\.access !== "locked"/u);

// Every funds check and every debit sits behind the opt-in flag, which ships off.
assert.match(storage, /walletEnabled: false/u, "the economy must stay off for an install that never opted in");
for (const gate of [
  /if \(settings\.walletEnabled\) \{\n\s+const target/u,
  /if \(settings\.walletEnabled\) \{\n\s+price = await this\.getCreatorSubscriptionPrice/u,
]) {
  assert.match(storage, gate, "a funds check must never run unless the economy is switched on");
}
assert.match(storage, /if \(unlock && created && settings\.walletEnabled\)/u, "unlocks debit only when enabled");
assert.match(storage, /if \(subscription && settings\.walletEnabled\)/u, "subscriptions debit only when enabled");
// The old unconditional gate read the raw settings blob. It must not come back in any form.
assert.doesNotMatch(storage, /wallet\.coins < NOODLER_(UNLOCK|SUBSCRIPTION)_COST/u);
assert.doesNotMatch(storage, /wallet: \{ coins: viewer\.settings\.wallet\.coins - /u);

// Subscribing still follows the Creator; that is unrelated to price and must survive.
const subscribe = storage.slice(storage.indexOf("async subscribe("), storage.indexOf("async unsubscribe("));
assert.ok(subscribe.length > 0);
assert.match(subscribe, /followingAccountIds\.includes\(creatorAccountId\)/u);

const routes = readFileSync("packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts", "utf8");
// A locked post withholds its metadata, so the price has to travel as its own field.
assert.match(routes, /metadata: locked \? null : post\.metadata,/u);
assert.match(routes, /unlockPrice: locked \? noodlerUnlockPriceFromMetadata\(post\.metadata\) : null,/u);
// A creator with its own weekly price shows that price; the constant is only the fallback.
assert.match(routes, /subscriptionPrice: context\.subscriptionPrices\[account\.id\] \?\? NOODLER_SUBSCRIPTION_COST,/u);
// An unaffordable unlock is a different answer from a missing one, so the client can offer a
// top-up instead of an error. The storage layer, not the route, decides whether to charge.
const unlockRoute = routes.slice(routes.indexOf('"/noodler/posts/:id/unlock"'));
assert.match(unlockRoute.slice(0, 2000), /reply\.code\(402\)\.send\(\{ error: "Not enough coins"/u);

const card = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpCreatorPostCard.tsx",
  "utf8",
);
const enLocale = JSON.parse(
  readFileSync("packages/slurp/src/engine/packages/client/src/localization/locales/en.json", "utf8"),
) as Record<string, string>;

// Both actions show a price, and the hint says plainly what it does and does not cost.
assert.match(card, /<NoodlerFictionalPrice amount=\{noodlerUnlockPriceOf\(post\)\} \/>/u);
assert.match(card, /<NoodlerFictionalPrice amount=\{noodlerSubscriptionPriceOf\(profile\)\} \/>/u);
assert.match(card, /title=\{localizeUi\("ui\.noodle\.unlocksheet\.priceHint"\)\}/u);
assert.match(enLocale["ui.noodle.unlocksheet.price"], /\{\{amount\}\}/u);
assert.match(enLocale["ui.noodle.unlocksheet.priceHint"], /fictional Slurp roleplay points/iu);
// "never blocked by a balance" stopped being true once the economy could be switched on. The
// promise that survives is the one that matters: no real money, ever.
assert.match(enLocale["ui.noodle.unlocksheet.priceHint"], /no money is charged/iu);

// No wallet balance is surfaced anywhere in the viewer UI. Comments may discuss the wallet;
// what must not exist is code that reads or renders one.
assert.doesNotMatch(card, /wallet\.coins|walletCoins|settings\.wallet/u);

console.log("NoodleR fictional-price regressions passed.");
