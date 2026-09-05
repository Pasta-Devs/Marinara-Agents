import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  planSlurpWorldTick,
  slurpCommissionChancePerDay,
  slurpQuestionChancePerDay,
  slurpWorldElapsedDays,
  SLURP_WORLD_MAX_ACTIONS,
  SLURP_WORLD_MAX_CATCHUP_DAYS,
  SLURP_WORLD_MAX_OPEN_REQUESTS,
  type SlurpWorldCreator,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-world.js";
import {
  slurpAudienceQuestion,
  slurpCommissionBrief,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-world-copy.js";

const day = (n: number) => new Date(Date.parse("2026-09-01T00:00:00.000Z") + n * 86_400_000);
const creator = (over: Partial<SlurpWorldCreator> = {}): SlurpWorldCreator => ({
  id: "c1",
  followers: 5_000,
  recentPostIds: ["p1"],
  openRequests: 0,
  ...over,
});

// ── Elapsed time is capped ──────────────────────────────────────────────────
// Coming back after a month must not produce a month of backlog. An inbox that cannot be cleared
// is the failure mode the readable-handful rule exists to prevent.
assert.equal(slurpWorldElapsedDays(null, day(1)), 0, "a first ever tick simulates nothing");
assert.equal(slurpWorldElapsedDays(day(1), day(1)), 0);
assert.equal(slurpWorldElapsedDays(day(2), day(1)), 0, "a clock that went backwards does nothing");
assert.equal(slurpWorldElapsedDays(day(0), day(1)), 1);
assert.equal(slurpWorldElapsedDays(day(0), day(365)), SLURP_WORLD_MAX_CATCHUP_DAYS);

// ── Rates scale with audience, but sublinearly ──────────────────────────────
// A Creator with ten times the followers gets more requests, not ten times as many: the player's
// time to answer them did not scale at all.
assert.equal(slurpCommissionChancePerDay(50), 0, "a tiny Creator gets no commission requests");
assert.ok(slurpCommissionChancePerDay(10_000) > slurpCommissionChancePerDay(500));
assert.ok(slurpCommissionChancePerDay(50_000) < slurpCommissionChancePerDay(5_000) * 3);
assert.ok(slurpCommissionChancePerDay(10_000_000) <= 0.5, "the rate is capped");
assert.ok(slurpQuestionChancePerDay(5_000) > slurpCommissionChancePerDay(5_000), "questions are commoner");
for (const bad of [-1, Number.NaN]) {
  assert.ok(Number.isFinite(slurpCommissionChancePerDay(bad)), `rate was not finite for ${bad}`);
  assert.ok(Number.isFinite(slurpQuestionChancePerDay(bad)), `rate was not finite for ${bad}`);
}

// ── Silence when there is nobody to act ─────────────────────────────────────
assert.deepEqual(planSlurpWorldTick({ since: day(0), until: day(1), creators: [creator()], audience: [] }), []);
assert.deepEqual(planSlurpWorldTick({ since: day(0), until: day(1), creators: [], audience: ["a"] }), []);
assert.deepEqual(planSlurpWorldTick({ since: null, until: day(1), creators: [creator()], audience: ["a"] }), []);

// ── Deterministic ───────────────────────────────────────────────────────────
const input = { since: day(0), until: day(1), creators: [creator()], audience: ["a", "b"] };
assert.deepEqual(planSlurpWorldTick(input), planSlurpWorldTick(input));

// ── A queue nobody answered gets no more ────────────────────────────────────
// Asking again while requests sit unread is how an obligation layer turns into a chore.
const swamped = planSlurpWorldTick({
  since: day(0),
  until: day(30),
  audience: ["a"],
  creators: [creator({ followers: 500_000, openRequests: SLURP_WORLD_MAX_OPEN_REQUESTS })],
});
assert.deepEqual(swamped, [], "a Creator with a full queue is left alone");

// ── The ceiling holds, and a long absence does not flood ────────────────────
const roster = Array.from({ length: 30 }, (_, index) => creator({ id: `c${index}`, followers: 500_000 }));
const flood = planSlurpWorldTick({ since: day(0), until: day(365), creators: roster, audience: ["a"] });
assert.ok(flood.length <= SLURP_WORLD_MAX_ACTIONS, `expected at most ${SLURP_WORLD_MAX_ACTIONS}, got ${flood.length}`);

// One heavy ask per Creator per tick: two at once reads as a glitch, not as popularity.
const perCreator = new Map<string, number>();
for (const action of flood) perCreator.set(action.creatorAccountId, (perCreator.get(action.creatorAccountId) ?? 0) + 1);
assert.ok([...perCreator.values()].every((count) => count === 1));

// ── Every Creator eventually gets served ────────────────────────────────────
// The ceiling is reached by walking creators in order, so without a shuffle the budget would go
// to whichever Creators sort first and the rest of a large roster would stay permanently silent.
const served = new Set<string>();
for (let index = 0; index < 300; index += 1) {
  for (const action of planSlurpWorldTick({
    since: day(index),
    until: day(index + 1),
    creators: roster,
    audience: ["a"],
  })) {
    served.add(action.creatorAccountId);
  }
}
assert.equal(served.size, roster.length, `only ${served.size} of ${roster.length} Creators were ever served`);

// A question needs something to ask about.
const noPosts = planSlurpWorldTick({
  since: day(0),
  until: day(30),
  audience: ["a"],
  creators: [creator({ followers: 200, recentPostIds: [] })],
});
assert.ok(noPosts.every((action) => action.kind !== "question"));

// ── Copy is deterministic and varied ────────────────────────────────────────
assert.equal(slurpCommissionBrief("seed-1"), slurpCommissionBrief("seed-1"));
const briefs = new Set(Array.from({ length: 200 }, (_, index) => slurpCommissionBrief(`seed-${index}`)));
assert.ok(briefs.size > 60, `commission briefs must vary, got ${briefs.size} of 200`);
const questions = new Set(Array.from({ length: 100 }, (_, index) => slurpAudienceQuestion(`post-${index}`)));
assert.ok(questions.size > 5, `questions must vary, got ${questions.size}`);

// ── Wiring ──────────────────────────────────────────────────────────────────
const root = join(import.meta.dirname, "..", "packages/slurp/src/engine/packages/server/src");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const operation = read("services/slurp/slurp-world.operation.ts");
// One function, two callers. Writing the logic twice is what the plan forbids.
assert.match(operation, /export async function advanceSlurpWorld/u);
// A failed action must never stop the mark being written, or the same stretch replays forever.
assert.match(operation, /await writeLastTick\(db, until\);\s*return \{\s*status: applied \+ pulsed > 0/u);
assert.match(operation, /tryNoodleOperation\("slurp-world-tick"/u, "concurrent ticks must not double-apply");

const routes = read("routes/slurp.routes.ts");
assert.match(routes, /await advanceSlurpWorld\(app\.db\)\.catch\(/u, "catch-up must not cost the player their feed");

const entry = read("services/slurp/server-entry.ts");
assert.match(entry, /startSlurpWorldScheduler\(app, addTeardown\)/u);

const scheduler = read("services/slurp/slurp-world-scheduler.service.ts");
assert.match(scheduler, /slurpPollBackoffMs\(POLL_MS, consecutiveFailures\)/u);

console.log("slurp world regression passed");
