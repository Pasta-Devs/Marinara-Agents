import assert from "node:assert/strict";

import { slurp2Source } from "./slurp2-source";
import { SLURP_CONTENT_DELIVERIES } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-content-axes";
import {
  SLURP_AUDIENCE_SCOPES,
  SLURP_CONTINUITY_EVENT_TYPES,
  SLURP_CONTINUITY_FACT_TYPES,
  SLURP_CONTINUITY_SOURCES,
  SLURP_CONTINUITY_STATUSES,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-continuity";

const root = "packages/slurp2/src/engine/packages/client/src/slp/";
const en = JSON.parse(slurp2Source(`${root}locales/en.json`)) as Record<string, string>;
const panel = slurp2Source(`${root}features/creators/SlpContinuityPanel.tsx`);
const signals = slurp2Source(`${root}features/creators/SlpCreatorSignalsList.tsx`);

// Every stored value the Memory tab can show has a human label.
for (const [prefix, values] of [
  ["ui.slurp.composer.delivery", SLURP_CONTENT_DELIVERIES],
  ["ui.slurp.continuity.factType", SLURP_CONTINUITY_FACT_TYPES],
  ["ui.slurp.continuity.eventType", SLURP_CONTINUITY_EVENT_TYPES],
  ["ui.slurp.continuity.scope", SLURP_AUDIENCE_SCOPES],
  ["ui.slurp.continuity.status", SLURP_CONTINUITY_STATUSES],
  ["ui.slurp.continuity.source", SLURP_CONTINUITY_SOURCES],
] as const) {
  for (const value of values) assert.ok(en[`${prefix}.${value}`], `missing label ${prefix}.${value}`);
}

// No raw ids reach the screen.
assert.doesNotMatch(panel, /plan\.delivery \?\? ""/u, "Recent plans labels the delivery");
assert.doesNotMatch(panel, /replaceAll\("_", " "\)\}/u, "filter options use labels");
assert.match(panel, /continuityLabel\(t, "delivery", plan\.delivery\)/u);
assert.match(panel, /continuityLabel\(t, "factType", String\(proposal\.candidate\.factType/u);
assert.doesNotMatch(signals, /audienceScope\.replace/u, "signals label the scope");

console.log("slurp2 continuity labels ok");
