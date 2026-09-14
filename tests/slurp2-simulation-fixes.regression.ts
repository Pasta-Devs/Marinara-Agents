import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  slurpAudienceConversionChance,
  slurpAudiencePaidThrough,
  slurpAudienceRollKey,
  slurpAudienceSubscriptionDecision,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-audience-subscription.js";
import {
  planSlurpWorldPulse,
  slurpPulseTieAdvance,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world-pulse.js";
import {
  slurpQuestionPostIds,
  slurpWorldElapsedDays,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world.js";
import { SLURP_REALISTIC_TUNING } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-tuning.js";

const R = SLURP_REALISTIC_TUNING;

// ── A follow after a like still makes a follower ────────────────────────────
// The follow writes a like row; when that row already exists the tie must still advance.
assert.deepEqual(slurpPulseTieAdvance("follow", false), { stage: "follower", interactions: 0 });
assert.deepEqual(slurpPulseTieAdvance("follow", true), { stage: "follower", interactions: 1 });
assert.equal(slurpPulseTieAdvance("like", false), null, "a repeated like is not news");
assert.deepEqual(slurpPulseTieAdvance("like", true), { stage: "liker", interactions: 1 });

// ── Subscriptions: every tick, never billed twice inside a paid period ──────
const at = new Date("2026-09-14T10:00:00.000Z");
const whale = {
  memberId: "m1",
  creatorAccountId: "c1",
  stage: "follower" as const,
  spendTier: "whale" as const,
  price: 12,
  paidThroughAt: null,
};
const paid = { ...whale, stage: "subscriber" as const, paidThroughAt: slurpAudiencePaidThrough(at) };
for (let hour = 0; hour < 24 * 7; hour += 1) {
  const later = new Date(at.getTime() + hour * 3_600_000);
  assert.equal(slurpAudienceSubscriptionDecision(paid, later, { ...R.funnel, rollCadence: "hourly" }), "none");
}
assert.equal(slurpAudienceSubscriptionDecision(paid, new Date(at.getTime() + 7 * 86_400_000)), "renew");

// Daily keys hold for the day; hourly keys change each hour.
const sameDay = new Date("2026-09-14T23:00:00.000Z");
assert.equal(slurpAudienceRollKey(at, "daily"), slurpAudienceRollKey(sameDay, "daily"));
assert.notEqual(slurpAudienceRollKey(at, "hourly"), slurpAudienceRollKey(sameDay, "hourly"));
assert.equal(slurpAudienceRollKey(at, "hourly"), slurpAudienceRollKey(new Date("2026-09-14T10:59:00.000Z"), "hourly"));

// Hourly rolls more often, so over a month more followers convert than on a daily roll.
const conversions = (cadence: "daily" | "hourly") => {
  let count = 0;
  for (let index = 0; index < 400; index += 1) {
    const subject = { ...whale, memberId: `m${index}` };
    for (let hour = 0; hour < 24 * 3; hour += 1) {
      const when = new Date(at.getTime() + hour * 3_600_000);
      if (slurpAudienceSubscriptionDecision(subject, when, { ...R.funnel, rollCadence: cadence }) === "subscribe") {
        count += 1;
        break;
      }
    }
  }
  return count;
};
assert.ok(conversions("hourly") > conversions("daily"));

// ── Conversion growth ───────────────────────────────────────────────────────
const base = slurpAudienceConversionChance("regular", 0, 50, 60);
assert.equal(base, slurpAudienceConversionChance("regular", 0, 0, 0), "growth 0 is unchanged");
assert.ok(slurpAudienceConversionChance("regular", 1, 10, 10) > base, "engagement raises the chance");
assert.ok(slurpAudienceConversionChance("regular", 10, 1000, 1000) <= base * 3 + 1e-9, "capped at 3x");
assert.ok(slurpAudienceConversionChance("whale", 10, 1000, 1000) <= 0.95);
assert.equal(slurpAudienceConversionChance("none", 10, 1000, 1000), 0);

// ── Like budget ─────────────────────────────────────────────────────────────
const targets = [
  { creatorAccountId: "c1", postId: "p1", ageHours: 1, creatorReach: 30_000 },
  { creatorAccountId: "c1", postId: "p2", ageHours: 5, creatorReach: 30_000 },
];
const audience = Array.from({ length: 40 }, (_, index) => `a${index}`);
const pulse = (tuning = R.pulse, input: Partial<Parameters<typeof planSlurpWorldPulse>[0]> = {}) =>
  planSlurpWorldPulse({ elapsedMinutes: 60, targets, audience, seed: "s", ...input }, tuning);
const count = (actions: ReturnType<typeof pulse>, kind: string) => actions.filter((a) => a.kind === kind).length;
const realistic = pulse();
assert.deepEqual(pulse({ ...R.pulse, likeBudgetScale: 1 }), realistic, "scale 1 is today's plan exactly");
const scaled = pulse({ ...R.pulse, likeBudgetScale: 4 });
assert.ok(count(scaled, "like") > count(realistic, "like"), "a bigger like budget adds likes");
assert.ok(count(scaled, "follow") + count(scaled, "comment") <= R.pulse.maxPerTick, "follows stay capped");
assert.ok(scaled.length <= 40, "the hard ceiling holds");
assert.equal(count(pulse({ ...R.pulse, likeBudgetScale: 0 }), "like"), 0, "scale 0 drops likes");

// ── Old post trickle ────────────────────────────────────────────────────────
const old = [{ creatorAccountId: "c1", postId: "old", ageHours: 200, creatorReach: 30_000 }];
assert.deepEqual(pulse(R.pulse, { targets: old }), [], "trickle 0 leaves old posts silent");
assert.ok(pulse({ ...R.pulse, oldPostTrickle: 0.5 }, { targets: old }).length > 0, "trickle reaches old posts");
const mixed = pulse(
  { ...R.pulse, oldPostTrickle: 0.2, maxPerTick: 40 },
  { targets: [...targets, ...old], elapsedMinutes: 600 },
);
assert.ok(
  mixed.filter((a) => a.postId === "old").length < mixed.filter((a) => a.postId !== "old").length,
  "old posts get less",
);

// ── Question gate ───────────────────────────────────────────────────────────
const posts = [
  { id: "new", createdAt: "2026-09-13T00:00:00.000Z", access: "public" },
  { id: "old", createdAt: "2026-01-01T00:00:00.000Z", access: "public" },
  { id: "draft", createdAt: "2026-09-13T00:00:00.000Z", access: "draft" },
];
const cutoff = "2026-09-07T00:00:00.000Z";
assert.deepEqual(slurpQuestionPostIds(posts, cutoff, true), ["new"]);
assert.deepEqual(slurpQuestionPostIds(posts.slice(1), cutoff, true), []);
assert.deepEqual(slurpQuestionPostIds(posts.slice(1), cutoff, false), ["old"]);
assert.deepEqual(slurpQuestionPostIds([], cutoff, false), []);

// ── Catch-up reads its hours ────────────────────────────────────────────────
const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000);
assert.equal(slurpWorldElapsedDays(day(0), day(365)), R.clock.catchUpHours / 24);
assert.equal(slurpWorldElapsedDays(day(0), day(365), 24), 1);

// ── Wiring ──────────────────────────────────────────────────────────────────
const world = readFileSync(
  join(
    import.meta.dirname,
    "..",
    "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world.operation.ts",
  ),
  "utf8",
);
assert.doesNotMatch(world, /maintenanceDue \? accounts : \[\]\) \{\s*const price/u, "subscriptions run every tick");
assert.match(world, /slurpPulseTieAdvance\(action\.kind, result\.created\)/u);

console.log("slurp2 simulation fixes regression passed");
