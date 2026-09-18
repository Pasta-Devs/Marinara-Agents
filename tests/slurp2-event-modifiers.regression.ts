/**
 * The cross-feature modifier seam: World produces, Economy consumes, and nothing is stored.
 *
 * The synthetic `0.5` event here is the only modifier Slurp ships. It exists to prove the seam;
 * no default platform event carries one, which the last block below asserts.
 */
import assert from "node:assert/strict";

import {
  createSlpActiveModifierProvider,
  SLP_NO_ACTIVE_MODIFIERS,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/modifiers/slp-active-modifier-provider.ts";
import {
  slpApplyModifiers,
  slpModifiersForTarget,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/modifiers/slp-modifier-resolver.ts";
import {
  slpModifierDraftSchema,
  slpNormalizeModifierDrafts,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/modifiers/slp-modifier-schema.ts";
import type { SlpModifier } from "../packages/slurp2/src/engine/packages/server/src/slp/base/modifiers/slp-modifier.types.ts";
import {
  slurpActivePlatformEventModifiers,
  slurpActivePlatformEvents,
  slurpNormalizePlatformEvents,
  slurpPlatformEventModifierSource,
  slurpPlatformEventsDefault,
  slurpPlatformEventSchema,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-platform-events.ts";
import {
  SLURP_SUBSCRIPTION_PRICE_MAX,
  slurpSubscriptionCharge,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/economy/slp-creator-pricing.ts";
import {
  emptySlurpWallet,
  renewSubscriptions,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/economy/slp-wallet.ts";
import { slurp2Source } from "./slurp2-source";

const TARGET = "economy.subscription-price";

// A synthetic half-price sale, running 1-3 March. Not a default event; this test owns it.
const saleEvent = slurpPlatformEventSchema.parse({
  id: "regression-half-price",
  name: "Regression half-price sale",
  month: 3,
  day: 1,
  durationDays: 3,
  guidance: "A site-wide half-price sale is running.",
  modifiers: [{ target: TARGET, operation: "multiply", value: 0.5 }],
});
const events = [saleEvent];
const during = new Date("2026-03-02T12:00:00Z");
const outside = new Date("2026-06-02T12:00:00Z");

const providerAt = (list: readonly (typeof saleEvent)[]) =>
  createSlpActiveModifierProvider([slurpPlatformEventModifierSource(list)]);

// --- An active 0.5 multiplier halves a new subscription charge; inactive changes nothing. ---
assert.equal(slurpSubscriptionCharge(100, providerAt(events), during), 50);
assert.equal(slurpSubscriptionCharge(100, providerAt(events), outside), 100);
// A disabled event never applies, even on its own dates.
assert.equal(slurpSubscriptionCharge(100, providerAt([{ ...saleEvent, enabled: false }]), during), 100);
// No sources at all is the same as nothing running.
assert.equal(slurpSubscriptionCharge(100, SLP_NO_ACTIVE_MODIFIERS, during), 100);

// --- The kind dispatch table did not change calendar activation. ---
assert.deepEqual(
  slurpActivePlatformEvents(events, during).map((item) => item.id),
  ["regression-half-price"],
);
assert.deepEqual(slurpActivePlatformEvents(events, outside), []);
assert.equal(saleEvent.kind, "calendar");

// --- Rounding happens once, and the result is clamped to the existing price range. ---
assert.equal(slurpSubscriptionCharge(7, providerAt(events), during), 4, "7 * 0.5 = 3.5 rounds once to 4");
const bigAdd = [{ ...saleEvent, modifiers: [{ target: TARGET, operation: "add" as const, value: 9999 }] }];
assert.equal(slurpSubscriptionCharge(9000, providerAt(bigAdd), during), SLURP_SUBSCRIPTION_PRICE_MAX);
const bigSubtract = [{ ...saleEvent, modifiers: [{ target: TARGET, operation: "add" as const, value: -9999 }] }];
assert.equal(slurpSubscriptionCharge(10, providerAt(bigSubtract), during), 0, "a charge never goes negative");
// A zero multiplier is a legal free week, not an error.
const freeWeek = [{ ...saleEvent, modifiers: [{ target: TARGET, operation: "multiply" as const, value: 0 }] }];
assert.equal(slurpSubscriptionCharge(100, providerAt(freeWeek), during), 0);

// --- Multiplies run before adds, and overlapping events resolve in deterministic source order. ---
const overlapA = { ...saleEvent, id: "aaa", modifiers: [{ target: TARGET, operation: "add" as const, value: 10 }] };
const overlapB = {
  ...saleEvent,
  id: "bbb",
  modifiers: [{ target: TARGET, operation: "multiply" as const, value: 0.5 }],
};
// 100 * 0.5 = 50, then + 10 = 60, whichever order the events are saved in.
assert.equal(slurpSubscriptionCharge(100, providerAt([overlapA, overlapB]), during), 60);
assert.equal(slurpSubscriptionCharge(100, providerAt([overlapB, overlapA]), during), 60);
// The producer emits in event order; the provider is what imposes the deterministic order.
assert.deepEqual(
  slurpActivePlatformEventModifiers([overlapB, overlapA], during).map((item) => item.source.id),
  ["bbb", "aaa"],
);
assert.deepEqual(
  providerAt([overlapB, overlapA])
    .modifiersFor(TARGET, during)
    .map((item) => item.source.id),
  ["aaa", "bbb"],
  "the provider sorts by source id regardless of save order",
);
// Sorting is stable across two sources holding the same modifier list.
const mixed: SlpModifier[] = [
  { target: TARGET, operation: "add", value: 1, source: { kind: "platform-event", id: "z" } },
  { target: TARGET, operation: "add", value: 1, source: { kind: "platform-event", id: "a" } },
];
assert.deepEqual(
  slpModifiersForTarget(mixed, TARGET).map((item) => item.source.id),
  ["a", "z"],
);

// --- Each modifier is stamped with the event that owns it. ---
assert.deepEqual(slurpActivePlatformEventModifiers(events, during), [
  {
    target: TARGET,
    operation: "multiply",
    value: 0.5,
    source: { kind: "platform-event", id: "regression-half-price" },
  },
]);
assert.deepEqual(slurpActivePlatformEventModifiers(events, outside), []);

// --- Evaluation mutates nothing: not the base price, the settings, or the event definitions. ---
const frozen = JSON.stringify(events);
const base = 100;
slurpSubscriptionCharge(base, providerAt(events), during);
assert.equal(base, 100);
assert.equal(JSON.stringify(events), frozen, "resolving must not touch the event definitions");
// The resolver leaves an untargeted base untouched, by identity of value.
assert.equal(slpApplyModifiers(37, [], TARGET), 37);

// --- Restart safety: the same timestamp gives the same answer after a settings round-trip. ---
const storedJson = JSON.stringify({ platformEvents: events });
const reloaded = slurpNormalizePlatformEvents(JSON.parse(storedJson).platformEvents);
assert.deepEqual(reloaded, events, "an event with a modifier survives a save/load round-trip unchanged");
assert.equal(
  slurpSubscriptionCharge(100, providerAt(reloaded), during),
  slurpSubscriptionCharge(100, providerAt(events), during),
);
// And twice in a row at the same instant.
const provider = providerAt(events);
assert.equal(slurpSubscriptionCharge(100, provider, during), slurpSubscriptionCharge(100, provider, during));

// --- Schema rejects what it must; saved lists drop the bad entry and keep the rest. ---
const rejects: unknown[] = [
  { target: "economy.nope", operation: "multiply", value: 1 },
  { target: TARGET, operation: "divide", value: 1 },
  { target: TARGET, operation: "multiply", value: Number.NaN },
  { target: TARGET, operation: "multiply", value: Number.POSITIVE_INFINITY },
  { target: TARGET, operation: "multiply", value: -1 },
  { target: TARGET, operation: "multiply", value: 11 },
  { target: TARGET, operation: "add", value: 10_000 },
  { target: TARGET, operation: "add", value: -10_000 },
];
for (const bad of rejects) assert.equal(slpModifierDraftSchema.safeParse(bad).success, false, JSON.stringify(bad));
assert.equal(slpModifierDraftSchema.safeParse({ target: TARGET, operation: "multiply", value: 0.5 }).success, true);
// A bad modifier is dropped on its own; the good one and the event both survive.
const messy = slurpNormalizePlatformEvents([
  { ...saleEvent, modifiers: [{ target: TARGET, operation: "multiply", value: 0.5 }, { target: "nope" }] },
]);
assert.equal(messy.length, 1, "a broken modifier must not drop its event");
assert.equal(messy[0]!.modifiers.length, 1);
// A broken event is still dropped whole, and a non-array still falls back to the defaults.
assert.equal(slurpNormalizePlatformEvents([saleEvent, { id: "x" }]).length, 1);
assert.equal(slurpNormalizePlatformEvents(undefined).length, slurpPlatformEventsDefault().length);
// At most eight modifiers survive one event.
assert.equal(
  slpNormalizeModifierDrafts(Array.from({ length: 12 }, () => ({ target: TARGET, operation: "add", value: 1 }))).length,
  8,
);

// --- Existing subscriptions keep their agreed price and renew at it. ---
const wallet = {
  ...emptySlurpWallet(),
  coins: 500,
  subscriptions: { "creator-a": { paidThroughAt: "2026-03-01T00:00:00.000Z", price: 100 } },
};
const renewal = renewSubscriptions(wallet, during);
assert.deepEqual(
  renewal.renewed.map((item) => item.price),
  [100],
  "a renewal charges the stored agreed price, never a re-derived one",
);
// The subscribe path is the only place the modified charge is applied, and only for a new charge.
const subscribeSource = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/data/economy/slp-economy-storage-1.ts",
);
assert.match(
  subscribeSource,
  /const basePrice = settings\.walletEnabled \? await this\.getCreatorSubscriptionPrice\(creatorAccountId\) : 0;/u,
  "the Creator's own price must be read once, with no modifier applied",
);
// A modifier may move exactly one charge: a genuinely new subscription.
assert.equal(
  (subscribeSource.match(/slurpSubscriptionCharge\(/gu) ?? []).length,
  1,
  "only the new-subscription charge may go through the modifier seam",
);
assert.match(
  subscribeSource,
  /slurpSubscriptionCharge\(\s*basePrice,/u,
  "the new-subscription charge must start from the Creator's own price",
);
// The renewal branch — an existing subscription whose paid period ran out — must charge the
// unmodified base price, so a running event never changes what an existing subscription costs.
const renewalBranch = subscribeSource.slice(
  subscribeSource.indexOf("if (existing[0] && settings.walletEnabled && existingWallet)"),
  subscribeSource.indexOf("// A genuinely new subscription"),
);
assert.ok(renewalBranch.length > 0, "the renewal branch must still be present");
assert.doesNotMatch(renewalBranch, /slurpSubscriptionCharge/u, "renewal must not re-price through an event");
assert.match(renewalBranch, /spend\(existingWallet, "subscribe", basePrice, at, creatorAccountId\)/u);
assert.match(renewalBranch, /price: basePrice,/u, "renewal must store the unmodified agreed price");
assert.doesNotMatch(
  subscribeSource,
  /setCreatorSubscriptionPrice/u,
  "an event must never rewrite a Creator's stored price",
);

// --- Slurp ships no default modifier and no default sale. ---
for (const item of slurpPlatformEventsDefault()) {
  assert.deepEqual(item.modifiers, [], `default event ${item.id} must carry no modifier`);
  assert.equal(item.kind, "calendar");
}

console.log("slurp2 event modifier regression passed");
