import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  estimateSlurpSimulation,
  SLURP_ESTIMATE_SAMPLE,
} from "../packages/slurp2/src/engine/packages/client/src/components/slurp/slurp-simulation-estimate.js";
import { slurpTuningForPreset } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-tuning.js";
import * as pulseRules from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world-pulse.js";
import * as worldRules from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world.js";
import { slurp2BackstageSource } from "./slurp2-backstage-source";
import { slurp2Source } from "./slurp2-source";

// The estimate must be the simulation, not a model of it. A settings screen that predicts one
// thing while the tick does another is worse than no estimate at all, so the panel calls the same
// pure rule functions the world tick calls.
const estimateSource = readFileSync(
  "packages/slurp2/src/engine/packages/client/src/components/slurp/slurp-simulation-estimate.ts",
  "utf8",
);
for (const fn of [
  "planSlurpWorldPulse",
  "planSlurpWorldTick",
  "slurpCreatorReach",
  "slurpAudienceSubscriptionDecision",
  "slurpWorldTimerDue",
]) {
  assert.match(estimateSource, new RegExp(`\\b${fn}\\b`, "u"), `the estimate must run ${fn}`);
}
assert.doesNotMatch(estimateSource, /Math\.log10|mulberry32/u, "the estimate must not reimplement a rule");
assert.equal(
  typeof pulseRules.planSlurpWorldPulse,
  "function",
  "the pulse planner the estimate imports must still exist",
);
assert.equal(typeof worldRules.planSlurpWorldTick, "function", "the world planner must still exist");

// Deterministic: the same settings and the same start produce the same week, every time.
const realistic = estimateSlurpSimulation(slurpTuningForPreset("realistic"));
assert.deepEqual(estimateSlurpSimulation(slurpTuningForPreset("realistic")), realistic);

const quiet = estimateSlurpSimulation(slurpTuningForPreset("quiet"));
const lively = estimateSlurpSimulation(slurpTuningForPreset("lively"));
const generous = estimateSlurpSimulation(slurpTuningForPreset("generous"));

// The presets have to be distinguishable, or the picker is decoration.
assert.ok(lively.likes > realistic.likes, "lively likes more than realistic");
assert.ok(realistic.likes > quiet.likes, "realistic likes more than quiet");
assert.ok(lively.follows > realistic.follows, "lively follows more than realistic");
assert.ok(realistic.follows > quiet.follows, "realistic follows more than quiet");
assert.ok(generous.subscriptions > realistic.subscriptions, "generous converts more than realistic");
assert.ok(generous.income > lively.income, "generous earns more than lively");
assert.ok(realistic.followers > SLURP_ESTIMATE_SAMPLE.realFollowers, "the sample creator has an audience");

// The panel exists, lives in its own file, and is mounted. `SlurpSettings.tsx` is already about
// five thousand lines; the plan's rule is that new settings surfaces do not land inside it.
const panel = readFileSync(
  "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpSimulationSettings.tsx",
  "utf8",
);
assert.match(panel, /export function SlurpSimulationSettings/u, "the simulation panel must be its own component");
assert.match(panel, /slurpSimulationTuningSchema/u, "inputs must take their range from the stored schema");
const settings = slurp2BackstageSource();
assert.match(settings, /<SlurpSimulationSettings\b/u, "settings must mount the simulation panel");
assert.match(settings, /update\("simulationTuning", next\)/u, "saving must send the whole tuning object");

// Every static key the panel renders must exist in English.
const en = JSON.parse(
  slurp2Source("packages/slurp2/src/engine/packages/client/src/localization/locales/en.json"),
) as Record<string, string>;
for (const [, key] of panel.matchAll(/\bt\(\s*"([^"]+)"/gu)) {
  assert.ok(key in en, `missing English localization for ${key}`);
}

console.log("slurp2 simulation estimate regression passed");
