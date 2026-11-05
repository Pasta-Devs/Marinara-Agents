import assert from "node:assert/strict";
import { z } from "zod";
import { z as z4 } from "zod/v4";

import { slpFilledDefault } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-schema-defaults.js";
import { slpSettingsUpdateSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-social.schema.js";
import { slurpFanTypesSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-fan-types.js";
import { slurpModelBudgetSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-model-budget.js";
import { slpPartialInput } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-schema-defaults.js";
import { slurp2Source } from "./slurp2-source.js";

import { slurpCreatorReach } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-reach.js";
import {
  planSlurpWorldPulse,
  slurpPulseBudget,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-world-pulse.js";
import {
  planSlurpWorldTick,
  slurpCommissionChancePerDay,
  slurpMessageChancePerDay,
  slurpQuestionChancePerDay,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-world.js";
import {
  SLURP_REALISTIC_TUNING,
  SLURP_TUNING_ACTIONS_PER_TICK_CEILING,
  slurpSimulationTuningSchema,
  slurpTuningForPreset,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-tuning.js";

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

// Zod 4 returns a `.default({})` value unparsed, so nested defaults stayed unset and the
// server crashed at load reading `world.commission.curve`. The helper fills them on zod 3 and 4.
assert.equal(typeof SLURP_REALISTIC_TUNING.world.commission.curve, "number");
const nested = z4.object({ inner: slpFilledDefault(z4.object({ a: z4.number().default(1) }) as never) });
assert.deepEqual(nested.parse({}), { inner: { a: 1 } }, "zod 4 fills nested defaults");
// Zod 4 `.partial()` would fill every unsent settings field with its default and reset it on save.
assert.deepEqual(slpSettingsUpdateSchema.parse({}), {}, "a settings update leaves unsent fields out");
// The PATCH /settings body: modelBudget and fanTypes carry filled defaults, which a plain
// `.partial()` would add to every save on zod 4.
const settingsPatch = slpPartialInput(z.object({ modelBudget: slurpModelBudgetSchema, fanTypes: slurpFanTypesSchema }));
assert.deepEqual(settingsPatch.parse({}), {}, "a settings PATCH leaves unsent fields out");
const settingsSource = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/modules/settings/slp-settings.ts",
);
assert.match(settingsSource, /slurpSettingsPatchSchema = slpPartialInput\(slurpSettingsSchema\)/u);
const routesSource = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/settings/slp-settings-routes.ts",
);
assert.match(routesSource, /slurpSettingsPatchSchema\.safeParse\(req\.body/u);
assert.doesNotMatch(routesSource, /slurpSettingsSchema\.partial\(\)/u);

console.log("slurp2 simulation tuning regression passed");
