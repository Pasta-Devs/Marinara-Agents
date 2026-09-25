import assert from "node:assert/strict";
import {
  SLP_BACKSTAGE_SECTIONS,
  SLP_LEGACY_SETTINGS_DESTINATION,
  slpBackstageSectionFor,
  targetBelongsToSection,
} from "../packages/slurp2/src/engine/packages/client/src/slp/base/navigation/slp-backstage-target";
import { SLP_BACKSTAGE_SETTING_PLACEMENT } from "../packages/slurp2/src/engine/packages/client/src/slp/features/backstage/slp-backstage-placement";
import { slurp2BackstageSource } from "./slurp2-backstage-source";
import { slurp2Source } from "./slurp2-source";

const read = (path: string) => slurp2Source(path);
const hooks = read("packages/slurp2/src/engine/packages/client/src/hooks/use-slurp.ts");
const settingsStart = hooks.indexOf("export type SlurpSettings = {");
const settingsEnd = hooks.indexOf("\n};", settingsStart);
assert.ok(settingsStart >= 0 && settingsEnd > settingsStart, "SlurpSettings type must be readable");
const settingKeys = [...hooks.slice(settingsStart, settingsEnd).matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):/gmu)].map(
  (match) => match[1],
);

assert.deepEqual(SLP_BACKSTAGE_SECTIONS, [
  "overview",
  "models",
  "creators",
  "automation",
  "content",
  "world",
  "fans",
  "prompts",
  "maintenance",
]);
// A page shows under the section that holds it, whatever section an older caller or saved state names.
assert.equal(slpBackstageSectionFor("automation", "connections"), "models");
assert.equal(slpBackstageSectionFor("automation", "images"), "models");
assert.equal(slpBackstageSectionFor("world", "audience"), "fans");
assert.equal(slpBackstageSectionFor("content", "events"), "world");
assert.equal(slpBackstageSectionFor("content", "content"), "content", "a section's own overview page stays");
assert.equal(slpBackstageSectionFor("content", "storylines"), "content");
assert.ok(targetBelongsToSection("content", "content"));
for (const [setting, placement] of Object.entries(SLP_BACKSTAGE_SETTING_PLACEMENT)) {
  assert.ok(
    targetBelongsToSection(placement.section, placement.target),
    `${setting} is placed under its page's section`,
  );
}
assert.equal(SLP_BACKSTAGE_SETTING_PLACEMENT.inlineAdsEnabled.section, "fans");
assert.equal(SLP_BACKSTAGE_SETTING_PLACEMENT.imageWidth.section, "models");
const packageStore = read("packages/slurp2/src/engine/packages/client/src/slp/base/state/slp-package-store.ts");
assert.match(
  packageStore,
  /section: slpBackstageSectionFor\(next\.section, next\.target\)/u,
  "live navigation fixes the section",
);
assert.match(
  packageStore,
  /section: slpBackstageSectionFor\(value\.section, target\)/u,
  "saved navigation fixes the section",
);
assert.deepEqual(
  Object.keys(SLP_BACKSTAGE_SETTING_PLACEMENT).sort(),
  settingKeys.sort(),
  "every Slurp setting has exactly one canonical Backstage placement",
);
assert.deepEqual(Object.keys(SLP_LEGACY_SETTINGS_DESTINATION).sort(), [
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
assert.match(client, /\{ target: "improve", Component: SlpCreatorImprovePanel \}/u);
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
