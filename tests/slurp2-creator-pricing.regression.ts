import assert from "node:assert/strict";
import {
  SLURP_COMMISSION_MAX_HAGGLE_ROUNDS,
  slurpCommissionQuote,
  slurpCreatorHaggle,
  slurpDynamicPriceTarget,
  slurpFanHaggle,
  slurpStepPrice,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-creator-pricing.ts";

const pricing = { commissionBase: 40, commissionMin: 10, commissionMax: 400 };

// The quote follows the brief.
const sketch = slurpCommissionQuote("a quick sketch, nothing polished", pricing);
const plain = slurpCommissionQuote("something in your usual style, but just for me", pricing);
const scene = slurpCommissionQuote("the two of us together in one detailed scene with a background", pricing);
const set = slurpCommissionQuote("a small set of three detailed full-body pieces, asap", pricing);
assert.ok(sketch < plain, `a sketch (${sketch}) must cost less than a plain brief (${plain})`);
assert.ok(plain < scene, `a detailed two-person scene (${scene}) must cost more than a plain brief (${plain})`);
assert.ok(scene < set, `a rushed set (${set}) must cost more than one scene (${scene})`);
assert.equal(
  slurpCommissionQuote("a huge detailed series of group scenes asap", { ...pricing, commissionMax: 60 }),
  60,
);
assert.equal(slurpCommissionQuote("quick sketch", { ...pricing, commissionMin: 35 }), 35);

// A Creator takes a close offer, meets a middling one, and holds against a lowball or a last round.
assert.deepEqual(slurpCreatorHaggle({ quote: 100, offer: 92, floor: 10, round: 1 }), { kind: "accept" });
// A close offer under the minimum is met at the minimum, never accepted below it.
assert.deepEqual(slurpCreatorHaggle({ quote: 100, offer: 95, floor: 100, round: 1 }), { kind: "meet", price: 100 });
assert.deepEqual(slurpCreatorHaggle({ quote: 100, offer: 60, floor: 10, round: 1 }), { kind: "meet", price: 80 });
assert.deepEqual(slurpCreatorHaggle({ quote: 100, offer: 60, floor: 90, round: 1 }), { kind: "hold" });
assert.deepEqual(slurpCreatorHaggle({ quote: 100, offer: 60, floor: 10, round: SLURP_COMMISSION_MAX_HAGGLE_ROUNDS }), {
  kind: "hold",
});
assert.deepEqual(slurpCreatorHaggle({ quote: 100, offer: 50, floor: 70, round: 1 }), { kind: "hold" });
assert.deepEqual(slurpCreatorHaggle({ quote: 100, offer: 70, floor: 90, round: 1 }), { kind: "meet", price: 90 });

// A fan pays what fits, counters within its budget, and walks from what is far out of reach.
assert.deepEqual(slurpFanHaggle({ quote: 40, budget: 50, round: 0 }), { kind: "accept" });
const counter = slurpFanHaggle({ quote: 70, budget: 50, round: 0 });
assert.equal(counter.kind, "counter");
assert.ok(counter.kind === "counter" && counter.price <= 50, "a counter must stay within the budget");
assert.deepEqual(slurpFanHaggle({ quote: 200, budget: 50, round: 0 }), { kind: "decline" });
assert.deepEqual(slurpFanHaggle({ quote: 70, budget: 50, round: SLURP_COMMISSION_MAX_HAGGLE_ROUNDS }), {
  kind: "decline",
});
assert.deepEqual(slurpFanHaggle({ quote: 10, budget: 0, round: 0 }), { kind: "decline" });

// Popularity lifts prices inside a bounded band, and one week moves them only so far.
assert.ok(slurpDynamicPriceTarget(12, { followers: 0, subscribers: 0 }) < 12);
assert.ok(slurpDynamicPriceTarget(12, { followers: 5000, subscribers: 1000 }) > 12);
assert.equal(slurpDynamicPriceTarget(12, { followers: 10 ** 9, subscribers: 10 ** 9 }), 36);
assert.equal(slurpStepPrice(100, 200, 15), 115);
assert.equal(slurpStepPrice(100, 90, 15), 90);
assert.equal(slurpStepPrice(100, 200, 0), 100);
assert.equal(slurpStepPrice(3, 10, 15), 4, "a small price still moves by at least one coin");

console.log("slurp2 creator pricing regression passed");
