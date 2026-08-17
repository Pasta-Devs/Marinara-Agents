import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NOODLER_SUBSCRIPTION_COST,
  NOODLER_UNLOCK_COST,
  noodlerUnlockPriceFromMetadata,
  noodlerUnlockPriceMetadata,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-prices";

// Prices are roleplay flavour. The confirmed direction is that they never gate access: no
// affordability check, no debit, no visible balance. Until 1.0.12 both unlock and subscribe
// checked the stored wallet and returned null when it ran dry, which would silently break access
// for an imported, restored, or hand-edited wallet. That gate must not come back.

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

// No affordability gate and no debit on either path.
assert.doesNotMatch(
  storage,
  /wallet\.coins < NOODLER_(UNLOCK|SUBSCRIPTION)_COST/u,
  "access must never be gated on funds",
);
assert.doesNotMatch(storage, /wallet: \{ coins: viewer\.settings\.wallet\.coins - /u, "nothing may be debited");

// Subscribing still follows the Creator; that is unrelated to price and must survive.
const subscribe = storage.slice(storage.indexOf("async subscribe("), storage.indexOf("async unsubscribe("));
assert.ok(subscribe.length > 0);
assert.match(subscribe, /followingAccountIds\.includes\(creatorAccountId\)/u);

const routes = readFileSync("packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts", "utf8");
// A locked post withholds its metadata, so the price has to travel as its own field.
assert.match(routes, /metadata: locked \? null : post\.metadata,/u);
assert.match(routes, /unlockPrice: locked \? noodlerUnlockPriceFromMetadata\(post\.metadata\) : null,/u);
assert.match(routes, /subscriptionPrice: NOODLER_SUBSCRIPTION_COST,/u);
// The unlock route must not start reading the price back and re-deriving a check from it.
const unlockRoute = routes.slice(routes.indexOf('"/noodler/posts/:id/unlock"'));
assert.doesNotMatch(unlockRoute.slice(0, 1500), /unlockPrice|wallet/u);

const card = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpCreatorPostCard.tsx",
  "utf8",
);
const enLocale = JSON.parse(
  readFileSync("packages/slurp/src/engine/packages/client/src/localization/locales/en.json", "utf8"),
) as Record<string, string>;

// Both actions show a price, and the hint says plainly that it buys nothing.
assert.match(card, /<NoodlerFictionalPrice amount=\{noodlerUnlockPriceOf\(post\)\} \/>/u);
assert.match(card, /<NoodlerFictionalPrice amount=\{noodlerSubscriptionPriceOf\(profile\)\} \/>/u);
assert.match(card, /title=\{localizeUi\("ui\.noodle\.unlocksheet\.priceHint"\)\}/u);
assert.match(enLocale["ui.noodle.unlocksheet.price"], /\{\{amount\}\}/u);
assert.match(enLocale["ui.noodle.unlocksheet.priceHint"], /fictional Slurp roleplay points/iu);
assert.match(enLocale["ui.noodle.unlocksheet.priceHint"], /never blocked/iu);

// No wallet balance is surfaced anywhere in the viewer UI. Comments may discuss the wallet;
// what must not exist is code that reads or renders one.
assert.doesNotMatch(card, /wallet\.coins|walletCoins|settings\.wallet/u);

console.log("NoodleR fictional-price regressions passed.");
