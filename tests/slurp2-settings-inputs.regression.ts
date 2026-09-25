import assert from "node:assert/strict";

import { slurp2Source } from "./slurp2-source";

const root = "packages/slurp2/src/engine/packages/client/src/slp/";
const inputs = slurp2Source(`${root}modules/settings/SlpSettingsInputs.tsx`);
const storylines = slurp2Source(`${root}features/projects/SlpStorylinesPanel.tsx`);
const audience = slurp2Source(`${root}features/audience/SlpAudiencePanel.tsx`);
const kit = slurp2Source(`${root}modules/settings/SlpBackstageKit.tsx`);
const arcConfig = slurp2Source(`${root}features/projects/SlpArcConfigSection.tsx`);
const en = JSON.parse(slurp2Source(`${root}locales/en.json`)) as Record<string, string>;

// Fixed choices are one native radio group: arrow keys and "1 of 3" come from the browser.
assert.match(inputs, /<fieldset disabled=\{off\}/u);
assert.match(inputs, /<legend/u);
assert.match(inputs, /type="radio"[\s\S]*name=\{name\}[\s\S]*checked=\{checked\}/u);
assert.match(inputs, /settingKey \? <SettingAnchor settingKey=\{settingKey\}>/u, "search can still find the setting");

// The Storylines page shows every fixed choice; no dropdown hides three short answers.
assert.doesNotMatch(storylines, /<select/u);
assert.match(storylines, /<ChoiceSetting\s+variant="cards"/u, "story activity presets are cards");
for (const key of ["storyAutomation", "arcAutoMode", "projectRate", "arcPace", "arcSource", "arcStatEffects"]) {
  assert.match(
    storylines,
    new RegExp(`settingKey="${key}"[\\s\\S]*?onChange=\\{\\(value: SlurpSettings\\["${key}"\\]\\)`, "u"),
  );
}
assert.match(storylines, /settingKey="arcSource"[\s\S]*?disabledReason=\{settings\.arcAutoMode === "off"/u);

// One control, not three: the old pill row is gone.
assert.doesNotMatch(kit, /ChoiceRow/u);
assert.doesNotMatch(audience, /ChoiceRow/u);
assert.match(audience, /value=\{audiencePreset === "custom" \? null : audiencePreset\}/u);

// "Own value": off shows the Slurp-wide value, on shows the control; off deletes the override.
assert.match(inputs, /role="switch"[\s\S]*event\.target\.checked \? onOverride\(\) : onReset\(\)/u);
assert.match(inputs, /\{overridden && children\}/u);
for (const key of ["own", "usesSlurp", "slurpValue"]) assert.ok(en[`ui.slurp.settings.override.${key}`]);

// The Creator Storylines tab has no "Global (x)" dropdown options and no tiny controls.
assert.doesNotMatch(arcConfig, /<select|<option|projects\.config\.global|text-\[0\.7rem\]/u);
assert.equal(en["ui.slurp.projects.config.global"], undefined);
assert.match(arcConfig, /onOverride=\{\(\) => setField\(key, inherited\)\}/u, "own value starts at the Slurp value");
assert.match(arcConfig, /onReset=\{\(\) => setField\(key, undefined\)\}/u, "own value off deletes the field");
assert.match(arcConfig, /if \(value === undefined\) delete next\[key\]/u);
for (const key of ["autoMode", "source", "cooldownWeeks", "pace", "maxActive", "crossovers", "allowedTypeIds"]) {
  assert.match(arcConfig, new RegExp(`override\\(\\s*"${key}"`, "u"), `${key} is an override row`);
}

// Chips: Enter adds (entries may contain commas), Backspace on empty removes, 44 px remove target.
assert.match(inputs, /event\.key === "Enter"/u);
assert.doesNotMatch(inputs, /event\.key === ","/u);
assert.match(inputs, /event\.key === "Backspace" && !draft && values\.length > 0/u);
assert.match(inputs, /size-11 shrink-0/u);

// Memory: search stays visible, the rest of the filters fold.
const continuity = slurp2Source(`${root}features/creators/SlpContinuityPanel.tsx`);
assert.match(
  continuity,
  /type="search"[\s\S]*<AdvancedGroup[\s\S]*type="range"[\s\S]*type="date"[\s\S]*<\/AdvancedGroup>/u,
);
assert.match(continuity, /\{lifeDetails\}\s*<SettingsGroup title=\{t\("ui\.slurp\.continuity\.factsGroup"/u);

// Fixed-choice settings on the other pages are button rows, not dropdowns.
const panels = {
  publishing: slurp2Source(`${root}features/feed/SlpPublishingPanel.tsx`),
  images: slurp2Source(`${root}features/media/SlpImagesPanel.tsx`),
  ads: slurp2Source(`${root}features/ads/SlpAdsPanel.tsx`),
  messaging: slurp2Source(`${root}features/messages/SlpMessagingPanel.tsx`),
};
for (const [panel, keys] of [
  ["publishing", ["storyRate", "postPlanner", "teaserRate", "autoPostGenerationMode"]],
  ["images", ["imageContextMode", "appearanceProfileMode"]],
  ["ads", ["inlineAdsFrequency", "inlineAdsSteering", "inlineAdsContentCeiling", "inlineAdsEra"]],
  ["messaging", ["messagesDefaultDmPolicy"]],
] as const) {
  for (const key of keys) {
    assert.match(
      panels[panel],
      new RegExp(`<ChoiceSetting\\s+settingKey="${key}"`, "u"),
      `${panel}: ${key} is a ChoiceSetting`,
    );
  }
}

// One fold control; the Publishing pace wizard repeated the preset cards and is gone.
const settingsKit = slurp2Source(`${root}modules/settings/SlpSettingsKit.tsx`);
assert.doesNotMatch(settingsKit, /export function FineTune/u);
for (const source of Object.values(panels)) assert.doesNotMatch(source, /<details|<FineTune/u);
assert.doesNotMatch(panels.publishing, /BackstageWizard|paceWizardOpen/u);
assert.doesNotMatch(slurp2Source(`${root}features/feed/slp-feed-backstage-contract.ts`), /paceWizardOpen|paceDraft/u);

console.log("slurp2 settings inputs ok");
