import assert from "node:assert/strict";
import {
  SLP_BACKSTAGE_SECTIONS,
  SLP_LEGACY_SETTINGS_DESTINATION,
  isSlpBackstageSection,
  isSlpBackstageTarget,
  slpBackstageSectionFor,
  targetBelongsToSection,
} from "../packages/slurp2/src/engine/packages/client/src/slp/base/navigation/slp-backstage-target";
import { SLP_BACKSTAGE_SETTING_PLACEMENT } from "../packages/slurp2/src/engine/packages/client/src/slp/features/backstage/slp-backstage-placement";
import { SLURP_SETTINGS_SECTION_KEYS } from "../packages/slurp2/src/engine/packages/client/src/slp/features/settings/slp-settings-defaults";
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

// Configurator slice 1: Basic, then the pages every player needs, then one section per extension.
assert.deepEqual(SLP_BACKSTAGE_SECTIONS, [
  "overview",
  "basic",
  "creators",
  // 7b-spice: Backstage › Spice (user plan: "Backstage › Spice › Your taste").
  "spice",
  "prompts",
  "ads",
  "content",
  "world",
  // 0.3.5: Settings › Stir, now labelled Support desk; polyamory and drama moved to Storylines.
  "stir",
  "live",
  "engine",
]);
// A page shows under the section that holds it, whatever section an older caller or saved state names.
assert.equal(slpBackstageSectionFor("prompts", "connections"), "basic");
assert.equal(slpBackstageSectionFor("creators", "images"), "basic");
assert.equal(slpBackstageSectionFor("world", "audience"), "basic");
assert.equal(slpBackstageSectionFor("content", "events"), "world");
assert.equal(slpBackstageSectionFor("content", "storylines"), "content");
assert.equal(slpBackstageSectionFor("stir", "drama"), "content");
// Overview is the only hub: the Posting, Stories and World landing pages and the Backup page are gone.
for (const removed of ["automation", "content", "world", "advanced"])
  assert.equal(isSlpBackstageTarget(removed), false);
assert.equal(SLP_LEGACY_SETTINGS_DESTINATION.advanced.target, "autopurge", "old Backup links land on Storage");
// The four sections slice 1 folded into Basic still open a page.
for (const old of ["models", "automation", "fans", "maintenance"] as const) {
  assert.equal(isSlpBackstageSection(old), false);
  assert.equal(SLP_LEGACY_SETTINGS_DESTINATION[old].section, "basic");
}
for (const [setting, placement] of Object.entries(SLP_BACKSTAGE_SETTING_PLACEMENT)) {
  assert.ok(
    targetBelongsToSection(placement.section, placement.target),
    `${setting} is placed under its page's section`,
  );
}
assert.equal(SLP_BACKSTAGE_SETTING_PLACEMENT.inlineAdsEnabled.section, "ads");
// "Reset page" only resets the settings that page shows.
for (const [page, keys] of Object.entries(SLURP_SETTINGS_SECTION_KEYS)) {
  for (const key of keys) {
    assert.equal(SLP_BACKSTAGE_SETTING_PLACEMENT[key].target, page, `${key} resets with the page it is on`);
  }
}
assert.equal(SLP_BACKSTAGE_SETTING_PLACEMENT.imageWidth.section, "basic");
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
  "automation",
  "autopurge",
  "creators",
  "fans",
  "general",
  "images",
  "maintenance",
  "messaging",
  "models",
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
