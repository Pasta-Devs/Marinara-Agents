import assert from "node:assert/strict";

import { slurpCreatorReach } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-reach.js";
import {
  planSlurpWorldPulse,
  slurpPulseBudget,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world-pulse.js";
import {
  planSlurpWorldTick,
  slurpCommissionChancePerDay,
  slurpMessageChancePerDay,
  slurpQuestionChancePerDay,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world.js";
import {
  SLURP_REALISTIC_TUNING,
  SLURP_TUNING_ACTIONS_PER_TICK_CEILING,
  slurpSimulationTuningSchema,
  slurpTuningForPreset,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-tuning.js";

const realistic = slurpTuningForPreset("realistic");
const lively = slurpTuningForPreset("lively");
const at = new Date("2026-03-01T00:00:00Z");

// Realistic reproduces the constants the rules shipped with.
const creator = { accountId: "creator-a", createdAt: "2026-01-01T00:00:00Z", realFollowers: 7 };
const born = Date.parse(creator.createdAt);
const spread = slurpCreatorReach({ ...creator, realFollowers: 0 }, new Date(born)) - 240;
assert.equal(spread, 0, "a creator is born at the realistic floor of 240");
assert.equal(slurpCreatorReach(creator, at, realistic.reach), slurpCreatorReach(creator, at));
assert.equal(slurpCreatorReach(creator, new Date(born)) - 240, 7 * 25, "real followers weigh 25");
for (const followers of [0, 9, 10, 40, 60, 240, 5_000, 10_000_000]) {
  assert.equal(
    slurpCommissionChancePerDay(followers),
    Math.min(0.5, followers < 40 ? 0 : Math.log10(followers / 40) * 0.09),
  );
  assert.equal(
    slurpMessageChancePerDay(followers),
    Math.min(0.3, followers < 60 ? 0 : Math.log10(followers / 60) * 0.07),
  );
  assert.equal(
    slurpQuestionChancePerDay(followers),
    Math.min(2.5, followers < 10 ? 0 : Math.log10(followers / 10) * 0.45),
  );
}
for (const [minutes, reach] of [
  [15, 3_000],
  [30, 12_000],
  [60 * 24, 3_000],
] as const) {
  assert.equal(
    slurpPulseBudget(minutes, reach),
    Math.min(6, Math.floor((minutes / 3) * Math.sqrt(reach / 3_000))),
    `pulse budget ${minutes}m at ${reach}`,
  );
}

// Lively produces more than realistic.
assert.ok(slurpPulseBudget(60 * 24, 3_000, lively.pulse) > slurpPulseBudget(60 * 24, 3_000, realistic.pulse));
assert.ok(slurpPulseBudget(15, 3_000, lively.pulse) > slurpPulseBudget(15, 3_000, realistic.pulse));
assert.ok(slurpCommissionChancePerDay(5_000, lively.world.commission) > slurpCommissionChancePerDay(5_000));
const targets = [{ creatorAccountId: "c1", postId: "p1", ageHours: 1, creatorReach: 3_000 }];
const audience = Array.from({ length: 40 }, (_, index) => `fan-${index}`);
const pulseInput = { elapsedMinutes: 600, targets, audience, seed: "tuning" };
assert.ok(planSlurpWorldPulse(pulseInput, lively.pulse).length > planSlurpWorldPulse(pulseInput).length);
const roster = Array.from({ length: 30 }, (_, index) => ({
  id: `c${index}`,
  followers: 50_000,
  recentPostIds: ["p"],
  openRequests: 0,
}));
const tick = { since: new Date(at.getTime() - 3 * 86_400_000), until: at, creators: roster, audience };
assert.ok(planSlurpWorldTick(tick, lively.world).length > planSlurpWorldTick(tick).length);

// The schema clamps out-of-range values instead of rejecting them, and never beyond the ceiling.
const clamped = slurpSimulationTuningSchema.parse({
  pulse: { maxPerTick: 10_000, minutesPerReaction: -5 },
  world: { maxActionsPerTick: 999 },
});
assert.equal(clamped.world.maxActionsPerTick, SLURP_TUNING_ACTIONS_PER_TICK_CEILING);
assert.ok(clamped.pulse.maxPerTick <= 40);
assert.ok(clamped.pulse.minutesPerReaction > 0);
assert.equal(slurpSimulationTuningSchema.safeParse({ pulse: { maxPerTick: "lots" } }).success, false);

// A partial stored object fills the rest from realistic.
const partial = slurpSimulationTuningSchema.parse({ reach: { floor: 500 }, prompts: { replyMaxChars: 90 } });
assert.equal(partial.reach.floor, 500);
assert.equal(partial.reach.ceiling, 34_000);
assert.equal(partial.prompts.replyMaxChars, 90);
assert.deepEqual({ ...partial, reach: realistic.reach, prompts: realistic.prompts }, SLURP_REALISTIC_TUNING);
assert.deepEqual(slurpSimulationTuningSchema.parse({}), SLURP_REALISTIC_TUNING);
assert.notEqual(slurpTuningForPreset("realistic"), slurpTuningForPreset("realistic"), "presets are copies");

console.log("slurp2 simulation tuning regression passed");
