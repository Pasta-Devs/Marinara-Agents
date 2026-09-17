import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SLURP_BACKSTAGE_SECTIONS,
  SLURP_BACKSTAGE_SETTING_PLACEMENT,
  SLURP_LEGACY_SETTINGS_DESTINATION,
} from "../packages/slurp2/src/engine/packages/client/src/components/slurp/slurp-backstage";
import { slurp2BackstageSource } from "./slurp2-backstage-source";

const read = (path: string) => readFileSync(path, "utf8");
const hooks = read("packages/slurp2/src/engine/packages/client/src/hooks/use-slurp.ts");
const settingsStart = hooks.indexOf("export type SlurpSettings = {");
const settingsEnd = hooks.indexOf("\n};", settingsStart);
assert.ok(settingsStart >= 0 && settingsEnd > settingsStart, "SlurpSettings type must be readable");
const settingKeys = [...hooks.slice(settingsStart, settingsEnd).matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):/gmu)].map(
  (match) => match[1],
);

assert.deepEqual(SLURP_BACKSTAGE_SECTIONS, ["overview", "creators", "world", "automation", "prompts", "maintenance"]);
assert.deepEqual(
  Object.keys(SLURP_BACKSTAGE_SETTING_PLACEMENT).sort(),
  settingKeys.sort(),
  "every Slurp setting has exactly one canonical Backstage placement",
);
assert.deepEqual(Object.keys(SLURP_LEGACY_SETTINGS_DESTINATION).sort(), [
  "ads",
  "advanced",
  "arcs",
  "audience",
  "autopurge",
  "creators",
  "general",
  "images",
  "messaging",
  "overview",
  "tags",
  "wallet",
]);

const client = slurp2BackstageSource();
const improver = read("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpCreatorImprover.tsx");
const routes = read("packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts");
const autopurge = read("packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-autopurge.ts");

assert.match(client, /<SlurpBackstageSearch/u);
assert.doesNotMatch(client, /<SlurpBackstagePreview/u);
assert.match(client, /<SlurpBackstageApplyBar/u);
assert.match(client, /target === "improve"/u);
assert.match(improver, /Free checkup/u);
assert.match(improver, /useCreateSlurpImprovementJob/u);
assert.match(improver, /Apply selected/u);

for (const route of [
  "/maintenance/summary",
  "/autopurge/preview",
  "/restore/inspections",
  "/backstage/readiness",
  "/backstage/improvement-jobs",
]) {
  assert.ok(routes.includes(route), `${route} must be registered`);
}
assert.equal((autopurge.match(/planSlurpAutopurge\(db, settings\)/gu) ?? []).length, 2);
assert.match(routes, /sourceFingerprint/u);
assert.match(routes, /setProposalStatus\(plan\.stale, "stale"\)/u);
assert.match(routes, /Never change disclosure, pricing, ownership, or the Engine source identity/u);

console.log("slurp2 Backstage regressions passed");
