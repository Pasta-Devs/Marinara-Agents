import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  slurpFanTypesDefault,
  slurpFanTypesSchema,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-fan-types.js";
import { slurpModelBudgetSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-model-budget.js";
import { slurpSimulationTuningSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-tuning.js";

const exported = JSON.stringify({
  version: 1,
  tuning: slurpSimulationTuningSchema.parse({ pulse: { maxPerTick: 11 } }),
  fanTypes: slurpFanTypesDefault(),
  budget: slurpModelBudgetSchema.parse({ mode: "background", callsPerDay: 9 }),
});
const raw = JSON.parse(exported) as Record<string, unknown>;
assert.equal(raw.version, 1);
assert.equal(slurpSimulationTuningSchema.parse(raw.tuning).pulse.maxPerTick, 11);
assert.equal(slurpFanTypesSchema.parse(raw.fanTypes).length, 8);
assert.equal(slurpModelBudgetSchema.parse(raw.budget).callsPerDay, 9);
assert.throws(() => slurpFanTypesSchema.parse([]), "an import cannot erase every fan type");

const component = slurp2Source(
  join(
    import.meta.dirname,
    "..",
    "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpAudienceConfigSettings.tsx",
  ),
);
assert.match(component, /SLURP_MODEL_JOB_KINDS\.map/u, "each model job has editable policy controls");
assert.match(component, /slurp-audience-config\.json/u, "the portable format has a stable filename");
assert.match(component, /slurpSimulationTuningSchema\.parse\(raw\.tuning\)/u, "imports validate tuning");
assert.match(component, /slurpFanTypesSchema\.parse\(raw\.fanTypes\)/u, "imports validate fan types");
assert.match(component, /slurpModelBudgetSchema\.parse\(raw\.budget\)/u, "imports validate model limits");
assert.match(component, /onBlur=\{\(\) => draft !== value/u, "long prompts save at a deliberate boundary");

console.log("slurp2 audience configuration regression passed");
