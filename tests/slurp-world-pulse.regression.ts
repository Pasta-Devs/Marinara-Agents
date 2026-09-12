import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  planSlurpWorldPulse,
  slurpPulseBudget,
  SLURP_PULSE_MAX_PER_TICK,
  SLURP_PULSE_POST_MAX_AGE_HOURS,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world-pulse.js";

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
assert.ok((kinds.get("like") ?? 0) / total > 0.6, "most reactions are still just a like");
assert.ok((kinds.get("follow") ?? 0) > 0, "some are somebody deciding to follow");
// Comments were one in ten, which at this budget is one free comment every two and a half hours.
// The comment section is the part a player reads, and it was the rarest thing the free tier made.
// Pinned at both ends: too few is the bug this fixes, too many turns every post into a wall.
const commentShare = (kinds.get("comment") ?? 0) / total;
assert.ok(
  commentShare > 0.12 && commentShare < 0.25,
  `free comments must stay a meaningful minority, got ${(commentShare * 100).toFixed(0)}%`,
);

// ── Wiring ──────────────────────────────────────────────────────────────────
const world = readFileSync(
  join(
    import.meta.dirname,
    "..",
    "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world.operation.ts",
  ),
  "utf8",
);
// Driven by minutes, not days. The day-scale plan cannot fire inside a session, which is exactly
// where a roleplay product needs the world to move.
assert.match(world, /elapsedMinutes: \(until\.getTime\(\) - pulseSince\.getTime\(\)\) \/ 60_000/u);
// Measured from the pulse's own mark, not the tick's. The tick advances on every notifications
// read — a 30-second client poll — so measuring from it gave the pulse ~0.5 elapsed minutes,
// floored the budget to zero at every audience size, and then consumed the time regardless.
assert.match(world, /const pulseSince = \(await readPulseMark\(db\)\) \?\? since;/u);
assert.match(world, /async function applyPulse/u);
assert.match(
  world,
  /postsByAccount\.get\(creator\.id\) \?\? \[\]\)\s*\.filter\(\(post\) => post\.access !== "draft"\)/u,
  "draft posts must not receive world pulse reactions",
);
// Free tier only: the pulse runs unattended, so it must never call the model. A pulse comment
// carries text, but that text comes from the Tier 1 combinatorial bank — most comments on a real
// post are three words, and paying a model for the highest-volume, least-readable text on the
// platform is the worst trade available.
assert.match(world, /type: isComment \? "reply" : "like"/u);
assert.match(world, /content: isComment \? slurpAudienceReaction\(/u);
const applyPulseBody = world.slice(world.indexOf("async function applyPulse"));
assert.doesNotMatch(applyPulseBody.slice(0, 1500), /generate|Generation|connection/u, "the pulse must stay free");

// Likes must stay the overwhelming majority. `slurp-reach.ts` already claims roughly that ratio
// in the counts it displays, and readable rows that contradict the displayed counts read as broken.
const pulseKinds = new Map<string, number>();
for (let index = 0; index < 400; index += 1) {
  for (const action of planSlurpWorldPulse({ elapsedMinutes: 30, targets, audience, seed: `r${index}` })) {
    pulseKinds.set(action.kind, (pulseKinds.get(action.kind) ?? 0) + 1);
  }
}
const pulseTotal = [...pulseKinds.values()].reduce((sum, value) => sum + value, 0);
assert.ok((pulseKinds.get("comment") ?? 0) > 0, "the free tier has to produce some comments");
assert.ok(
  (pulseKinds.get("comment") ?? 0) / pulseTotal < 0.25,
  "a comment section where everybody comments is not a comment section",
);
// Three to one, not four. The free tier's comment share was raised deliberately — at the old one
// in ten a new install collected one free comment every two and a half hours — so this pins the
// new ratio rather than the old one. Likes are still what most people leave.
assert.ok((pulseKinds.get("like") ?? 0) > (pulseKinds.get("comment") ?? 0) * 3, "likes must dominate comments");
const storage = readFileSync(
  join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts"),
  "utf8",
);
assert.match(
  storage,
  /for \(const row of rows\) \{\s*if \(row\.access === "draft"\) continue;\s*const post = mapManagedPost\(row\);/u,
  "draft posts must be removed before managed-post mapping",
);
assert.match(
  storage,
  /function noodlerPostPageCondition[\s\S]*?ne\(noodlePosts\.access, "draft"\)/u,
  "draft posts must be excluded before feed pagination",
);
assert.match(
  storage,
  /\.where\(and\(inArray\(noodlePosts\.authorAccountId, visibleAccountIds\), ne\(noodlePosts\.access, "draft"\)\)\)/u,
  "draft posts must be excluded from unseen signals",
);
assert.match(world, /createNoodlerWorldInteraction\(action\.postId/u, "world actions use internal storage");
assert.match(storage, /async createNoodlerWorldInteraction\(/u, "world interactions have a separate internal method");
assert.doesNotMatch(storage, /trustedWorldRun/u, "world-shaped run IDs must not bypass fan validation");
assert.doesNotMatch(world, /createNoodlerFanInteraction/u, "world actions must not call the persisted fan method");
assert.doesNotMatch(world, /runId:/u, "world actions must not supply a trust token");
assert.match(storage, /run\?\.status !== "applying"/u, "fan interactions require an applying persisted run");

console.log("slurp world pulse regression passed");
