import assert from "node:assert/strict";

import { slurp2Source } from "./slurp2-source";

const root = "packages/slurp2/src/engine/packages/client/src/slp/";
const inputs = slurp2Source(`${root}modules/settings/SlpSettingsInputs.tsx`);
const storylines = slurp2Source(`${root}features/projects/SlpStorylinesPanel.tsx`);
const audience = slurp2Source(`${root}features/audience/SlpAudiencePanel.tsx`);
const kit = slurp2Source(`${root}modules/settings/SlpBackstageKit.tsx`);

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

console.log("slurp2 settings inputs ok");
