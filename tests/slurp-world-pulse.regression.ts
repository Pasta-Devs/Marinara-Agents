import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  planSlurpWorldPulse,
  slurpPulseBudget,
  SLURP_PULSE_MAX_PER_TICK,
  SLURP_PULSE_POST_MAX_AGE_HOURS,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-world-pulse.js";

const targets = [
  { creatorAccountId: "c1", postId: "fresh", ageHours: 0.5, creatorReach: 3_000 },
  { creatorAccountId: "c1", postId: "day", ageHours: 24, creatorReach: 3_000 },
];
const audience = ["a", "b", "c", "d", "e"];

// ── Refreshing the page must not farm reactions ─────────────────────────────
// The catch-up runs on every notifications read, so a player tapping refresh would otherwise mint
// a like each time.
assert.equal(slurpPulseBudget(0.5, 3_000), 0);
assert.equal(slurpPulseBudget(2, 3_000), 0);
assert.ok(slurpPulseBudget(15, 3_000) > 0, "a session-length gap must produce something");

// ── A long absence must not dump a hundred at once ──────────────────────────
assert.equal(slurpPulseBudget(60 * 24 * 7, 3_000), SLURP_PULSE_MAX_PER_TICK);
assert.equal(slurpPulseBudget(20, 10_000_000), SLURP_PULSE_MAX_PER_TICK, "reach is capped too");

// Audience size raises the rate sub-linearly: a large Creator feels busier without making the feed
// unreadable, because the number a player can absorb did not scale with their follower count.
assert.ok(slurpPulseBudget(15, 30_000) > slurpPulseBudget(15, 3_000));
assert.ok(slurpPulseBudget(15, 300_000) < slurpPulseBudget(15, 3_000) * 10);
assert.equal(slurpPulseBudget(15, 0), 0, "no audience, no reactions");

// Nonsense inputs must not produce a budget.
for (const bad of [Number.NaN, -10]) {
  assert.equal(slurpPulseBudget(bad, 3_000), 0, `budget for elapsed ${bad}`);
  assert.equal(slurpPulseBudget(15, bad), 0, `budget for reach ${bad}`);
}

// ── Reactions land on what was just posted ──────────────────────────────────
// A reaction on something published minutes ago is the point; one on a two-day-old post is noise.
const landed = new Map<string, number>();
for (let index = 0; index < 300; index += 1) {
  for (const action of planSlurpWorldPulse({ elapsedMinutes: 20, targets, audience, seed: `s${index}` })) {
    landed.set(action.postId, (landed.get(action.postId) ?? 0) + 1);
  }
}
assert.ok((landed.get("fresh") ?? 0) > (landed.get("day") ?? 0) * 3, "fresh posts must dominate");

// A finished post collects nothing.
assert.deepEqual(
  planSlurpWorldPulse({
    elapsedMinutes: 120,
    audience,
    seed: "old",
    targets: [
      { creatorAccountId: "c1", postId: "stale", ageHours: SLURP_PULSE_POST_MAX_AGE_HOURS + 1, creatorReach: 9_000 },
    ],
  }),
  [],
);

// Nobody to act, or nothing to act on.
assert.deepEqual(planSlurpWorldPulse({ elapsedMinutes: 120, targets, audience: [], seed: "x" }), []);
assert.deepEqual(planSlurpWorldPulse({ elapsedMinutes: 120, targets: [], audience, seed: "x" }), []);

// ── One person does not react to one post twice in a pulse ──────────────────
for (let index = 0; index < 200; index += 1) {
  const plan = planSlurpWorldPulse({ elapsedMinutes: 90, targets, audience, seed: `dup${index}` });
  const keys = plan.map((action) => `${action.postId}:${action.actorAccountId}`);
  assert.equal(new Set(keys).size, keys.length, "a pulse repeated an actor on one post");
  assert.ok(plan.length <= SLURP_PULSE_MAX_PER_TICK);
}

// Mostly likes, with follows rare enough to mean something.
const kinds = new Map<string, number>();
for (let index = 0; index < 300; index += 1) {
  for (const action of planSlurpWorldPulse({ elapsedMinutes: 20, targets, audience, seed: `k${index}` })) {
    kinds.set(action.kind, (kinds.get(action.kind) ?? 0) + 1);
  }
}
const total = [...kinds.values()].reduce((sum, value) => sum + value, 0);
assert.ok((kinds.get("like") ?? 0) / total > 0.7, "most reactions are just a like");
assert.ok((kinds.get("follow") ?? 0) > 0, "some are somebody deciding to follow");

// ── Wiring ──────────────────────────────────────────────────────────────────
const world = readFileSync(
  join(
    import.meta.dirname,
    "..",
    "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-world.operation.ts",
  ),
  "utf8",
);
// Driven by minutes, not days. The day-scale plan cannot fire inside a session, which is exactly
// where a roleplay product needs the world to move.
assert.match(world, /elapsedMinutes: \(until\.getTime\(\) - since\.getTime\(\)\) \/ 60_000/u);
assert.match(world, /async function applyPulse/u);
// Free tier only: a like carries no text, so no model call.
assert.match(world, /type: "like",\s*content: null,/u);

console.log("slurp world pulse regression passed");
