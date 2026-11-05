/**
 * Support's extras offers (docs/CONFIGURATOR.md, slice 4): after the first posts, the first unlock and a
 * few days, at most one a day, none while paused, the next extension that is still off and not declined.
 */
import assert from "node:assert/strict";
import {
  slpExtrasOfferAnswered,
  slpExtrasOfferNow,
  slpExtrasReached,
  type SlpExtrasOfferState,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-extras-offer.ts";
import { slurp2Source } from "./slurp2-source.ts";

const day0 = new Date("2026-10-21T10:00:00Z");
const later = (hours: number) => new Date(day0.getTime() + hours * 3_600_000);
const off = {};

// Nothing reached yet: no offer, but the first visit is recorded.
let step = slpExtrasOfferNow({}, off, day0, false);
assert.equal(step.offer, null);
assert.equal(step.state.firstSeenAt, day0.toISOString());
let state: SlpExtrasOfferState = step.state;

// The first posts: Storylines first; it stays the offer until answered.
state = slpExtrasReached(state, "posts")!;
assert.equal(slpExtrasReached(state, "posts"), null, "recorded once");
assert.equal(slpExtrasOfferNow(state, off, later(1), true).offer, null, "none while paused");
step = slpExtrasOfferNow(state, off, later(1), false);
assert.deepEqual(step.offer, { id: "storylines", trigger: "posts" });
state = step.state;
assert.deepEqual(slpExtrasOfferNow(state, off, later(2), false).offer, step.offer, "pending stays");

// "Not now": declined; the next trigger within a day waits.
assert.equal(slpExtrasOfferAnswered(state, "ads", false), null, "a stale card changes nothing");
state = slpExtrasOfferAnswered(state, "storylines", false)!;
state = slpExtrasReached(state, "unlock")!;
assert.equal(slpExtrasOfferNow(state, off, later(5), false).offer, null, "at most one a day");
step = slpExtrasOfferNow(state, off, later(26), false);
assert.deepEqual(step.offer, { id: "world", trigger: "unlock" }, "Storylines was declined");
state = step.state;

// Switched on elsewhere: the pending offer goes away.
assert.equal(slpExtrasOfferNow(state, { extWorld: true }, later(27), false).offer, null);

// "Add": accepted, not declined; the days trigger offers the next one that is still off.
state = slpExtrasOfferAnswered(state, "world", true)!;
assert.deepEqual(state.declined, ["storylines"]);
assert.equal(slpExtrasOfferNow(state, { extWorld: true }, later(60), false).offer, null, "three days not yet");
step = slpExtrasOfferNow(state, { extWorld: true }, later(73), false);
assert.deepEqual(step.offer, { id: "stir", trigger: "days" });
state = slpExtrasOfferAnswered(step.state, "stir", true)!;

// Every trigger fired: no more offers.
assert.equal(slpExtrasOfferNow(state, { extWorld: true, extStir: true }, later(200), false).offer, null);
// Everything on: no offer, and the trigger is kept for later.
const allOn = { extStorylines: true, extWorld: true, extStir: true, extSupportDesk: true, extAds: true };
const none = slpExtrasOfferNow(slpExtrasReached({}, "posts")!, allOn, day0, false);
assert.equal(none.offer, null);
assert.equal(none.state.fired, undefined);

// Wiring: the triggers, the routes and the card on the feed.
const server = "packages/slurp2/src/engine/packages/server/src/slp/";
assert.match(
  slurp2Source(`${server}features/onboarding/slp-first-post-queue-service.ts`),
  /result\.status === "generated"\) \{\s*markSlurpExtrasReached\(db, "posts"\);/u,
);
const wallet = slurp2Source(`${server}features/economy/slp-wallet-routes.ts`);
assert.equal(
  wallet.match(/if \(result\.created && result\.chargedAmount > 0\) markSlurpExtrasReached\(app\.db, "unlock"\);/gu)
    ?.length,
  2,
  "paid unlocks only, plain and gamble",
);
const routes = slurp2Source(`${server}features/settings/slp-settings-routes.ts`);
assert.match(routes, /app\.get\("\/extras\/offer"/u);
assert.match(routes, /app\.post\("\/extras\/offer\/answer"/u);
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/app/screens/SlpHubTopCards.tsx"),
  /<SlpExtrasOfferCard \/>/u,
);

console.log("slurp2 extras offer: ok");
