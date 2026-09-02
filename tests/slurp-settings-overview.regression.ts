import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  slurpActivityPresetForSettings,
  slurpActivityPresetPatch,
} from "../packages/slurp/src/engine/packages/client/src/components/slurp/slurp-activity-presets";

assert.equal(slurpActivityPresetForSettings({ autoPostingScheduleEnabled: false, postsPerDay: 7 }), "manual");
assert.equal(slurpActivityPresetForSettings({ autoPostingScheduleEnabled: true, postsPerDay: 4 }), "lively");
assert.equal(slurpActivityPresetForSettings({ autoPostingScheduleEnabled: true, postsPerDay: 3 }), null);
assert.deepEqual(slurpActivityPresetPatch("manual"), { autoPostingScheduleEnabled: false });
assert.deepEqual(slurpActivityPresetPatch("veryActive"), {
  autoPostingScheduleEnabled: true,
  postsPerDay: 8,
});

async function main() {
  const [settings, navigation, store, home, shell, english] = await Promise.all([
    readFile("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpSettings.tsx", "utf8"),
    readFile("packages/slurp/src/engine/packages/client/src/components/slurp/slurp-navigation.types.ts", "utf8"),
    readFile("packages/slurp/src/engine/packages/client/src/stores/slurp-package.store.ts", "utf8"),
    readFile("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8"),
    readFile("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpShell.tsx", "utf8"),
    readFile("packages/slurp/src/engine/packages/client/src/localization/locales/en.json", "utf8"),
  ]);

  assert.match(navigation, /section\?: "overview" \| "general"/u);
  assert.match(store, /\["overview", "general", "creators", "images", "audience", "advanced"\]/u);
  assert.match(home, /section: "overview"/u);
  assert.match(
    settings,
    /const settingsSections = \["overview", "general", "creators", "images", "audience", "advanced"\]/u,
  );
  assert.match(settings, /section === "overview"/u);
  assert.match(settings, /const imagesReady = imageConnections\.length > 0 && imageEnabledCreators\.length > 0/u);
  assert.match(settings, /save\(\{ autoPostingScheduleEnabled: true, postsPerDay: value \}\)/u);
  assert.match(settings, /settings\.fanActivityEnabled \? \(/u);
  assert.match(settings, /<OverviewActivity/u);
  assert.match(settings, /section === "overview" \|\| section === "audience"/u);
  assert.match(english, /"ui\.slurp\.settings\.overview\.activity\.title": "Activity"/u);
  assert.match(settings, /ui\.slurp\.settings\.audience\.feedExperience/u);
  assert.match(shell, /"--slurp-hero"/u);
  assert.match(shell, /"--slurp-nav-active"/u);
  assert.match(english, /"ui\.slurp\.settings\.tabs\.overview": "Overview"/u);

  console.log("Slurp settings overview regressions passed.");
}

void main();
