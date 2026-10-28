import assert from "node:assert/strict";
import { join } from "node:path";
import { slurp2BackstageSource } from "./slurp2-backstage-source";
import { slurp2Source } from "./slurp2-source";

const root = join(import.meta.dirname, "..", "packages", "slurp2", "src", "engine", "packages");
const read = (path: string) => slurp2Source(join(root, path));
const component = read("client/src/components/slurp/SlurpFanTypesSettings.tsx");
const settings = slurp2BackstageSource();
const routes = read("server/src/routes/slurp.routes.ts");

assert.match(settings, /<SlurpFanTypesSettings/u, "the audience settings surface mounts the editor");
for (const field of [
  "voice",
  "traits",
  "activeHours",
  "behavior",
  "weeklyBudget",
  "commissionBudget",
  "funnel",
  "targetSize",
]) {
  assert.match(component, new RegExp(field, "u"), `${field} is not editable`);
}
assert.match(component, /type="button"/u, "actions use native buttons");
assert.match(component, /role="status"/u, "save and preview results are announced");
assert.match(component, /min-h-11/u, "controls keep a touch-sized target");
assert.match(component, /previewRebalance/u);
assert.match(component, /applyRebalance/u);
assert.match(routes, /\/fan-types\/rebalance\/preview/u);
assert.match(routes, /\/fan-types\/rebalance"/u);

console.log("slurp2 fan types UI regression passed");
