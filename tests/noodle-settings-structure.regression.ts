import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  NOODLER_ACTIVITY_PRESETS,
  NOODLER_ACTIVITY_PRESET_POSTS_PER_DAY,
  NOODLER_DEFAULT_ACTIVITY_PRESET,
  NOODLER_QUIETER_ACTIVITY_PRESET,
  noodlerActivityPresetForSettings,
  noodlerActivityPresetPatch,
  noodlerPostsPerDayForPreset,
} from "../packages/noodle/src/engine/packages/client/src/components/noodle/noodler-activity-presets";

// How busy NoodleR is was described three different ways — named presets in onboarding, a raw
// number in settings, and a one-way button on the feed — with nothing telling a player they were
// the same value. One table now backs all three. If a surface stops importing it, the vocabularies
// drift apart again silently.

const wizard = readFileSync(
  "packages/noodle/src/engine/packages/client/src/components/noodle/NoodlerBulkCreatePanel.tsx",
  "utf8",
);
const settings = readFileSync(
  "packages/noodle/src/engine/packages/client/src/components/noodle/NoodlerPublishingSettings.tsx",
  "utf8",
);
const feed = readFileSync(
  "packages/noodle/src/engine/packages/client/src/components/noodle/NoodlerHome.tsx",
  "utf8",
);

for (const [name, source] of [
  ["wizard", wizard],
  ["settings", settings],
  ["feed", feed],
] as const) {
  assert.match(source, /from "\.\/noodler-activity-presets"/u, `${name} must use the shared preset table`);
}
// No surface may hardcode a pace next to the preset names again.
assert.doesNotMatch(wizard, /choice === "occasional" \? 2/u);
assert.doesNotMatch(feed, /const NOODLER_\w*POSTS_PER_DAY = \d/u);

// The confirmed pace is four a day across the whole cast, and quieter is one step down.
assert.equal(NOODLER_DEFAULT_ACTIVITY_PRESET, "lively");
assert.equal(noodlerPostsPerDayForPreset("lively"), 4);
assert.equal(NOODLER_QUIETER_ACTIVITY_PRESET, "occasional");
assert.equal(noodlerPostsPerDayForPreset("occasional"), 2);
assert.ok(
  noodlerPostsPerDayForPreset(NOODLER_QUIETER_ACTIVITY_PRESET) <
    noodlerPostsPerDayForPreset("lively"),
  "quieter must actually be quieter than the default",
);

// Every preset maps inside the schema's own bounds, so no preset can write a value the server
// rejects. NOODLER_POSTS_PER_DAY_MAX is the shared ceiling; 1 is the schema minimum.
for (const [preset, pace] of Object.entries(NOODLER_ACTIVITY_PRESET_POSTS_PER_DAY)) {
  assert.ok(Number.isInteger(pace) && pace >= 1 && pace <= 24, `${preset} pace ${pace} out of range`);
}

// Manual is the absence of a rate, not a rate of zero: it turns the scheduler off and leaves
// postsPerDay alone, so switching back restores the previous pace instead of a stored 0.
const manual = noodlerActivityPresetPatch("manual");
assert.deepEqual(manual, { autoPostingScheduleEnabled: false });
assert.equal("postsPerDay" in manual, false);
assert.deepEqual(noodlerActivityPresetPatch("occasional"), {
  autoPostingScheduleEnabled: true,
  postsPerDay: 2,
});

// Reading back: a stored pace resolves to its preset, and a hand-typed in-between value resolves
// to none rather than being silently rounded to the nearest preset.
assert.equal(
  noodlerActivityPresetForSettings({ autoPostingScheduleEnabled: true, postsPerDay: 4 }),
  "lively",
);
assert.equal(
  noodlerActivityPresetForSettings({ autoPostingScheduleEnabled: true, postsPerDay: 5 }),
  null,
);
assert.equal(
  noodlerActivityPresetForSettings({ autoPostingScheduleEnabled: false, postsPerDay: 4 }),
  "manual",
);

// Every preset has the label pair the wizard and settings both render.
const enLocale = JSON.parse(
  readFileSync(
    "packages/noodle/src/engine/packages/client/src/localization/locales/en.json",
    "utf8",
  ),
) as Record<string, string>;
for (const preset of NOODLER_ACTIVITY_PRESETS) {
  assert.equal(
    typeof enLocale[`ui.noodle.noodlerwizard.activityChoice.${preset}.title`],
    "string",
    `${preset} needs a title`,
  );
}

// --- S1: one home per topic -------------------------------------------------
const home = readFileSync(
  "packages/noodle/src/engine/packages/client/src/components/noodle/NoodleHome.tsx",
  "utf8",
);
const nav = readFileSync(
  "packages/noodle/src/engine/packages/client/src/components/noodle/noodle-navigation.types.ts",
  "utf8",
);

// The Images section must exist in the navigation type, or a deep link to it cannot type-check.
assert.match(nav, /"general" \| "timeline" \| "images" \| "participants" \| "creators" \| "advanced"/u);
assert.match(home, /\{ id: "images", labelKey: "ui\.noodle\.socialsettings\.images" \}/u);
assert.equal(typeof enLocale["ui.noodle.socialsettings.images"], "string");

// Both image blocks live there now, and neither is left behind in Timeline or Advanced.
const imageSections = home.match(/settingsTab === "noodle" && settingsSection === "images"/gu) ?? [];
assert.equal(imageSections.length, 2, "both image Sections belong to Images");
for (const marker of ["noodleAndNoodlerImageGeneration", "imageUnderstanding"]) {
  const at = home.indexOf(marker);
  assert.ok(at > 0, `${marker} section still exists`);
  const sectionStart = home.lastIndexOf('settingsSection === "', at);
  assert.match(
    home.slice(sectionStart, sectionStart + 40),
    /settingsSection === "images"/u,
    `${marker} must sit in the Images section`,
  );
}

// --- S3: a setting must say what it resolves to -----------------------------
const noodlerHome = readFileSync(
  "packages/noodle/src/engine/packages/client/src/components/noodle/NoodlerHome.tsx",
  "utf8",
);

// "Use global defaults" without showing the resolved value forces a trip to another screen.
assert.match(noodlerHome, /ui\.noodle\.noodlerfanactivity\.inheritResolved/u);
assert.match(enLocale["ui.noodle.noodlerfanactivity.inheritResolved"], /\{\{value\}\}/u);

// An inherited weight and a deliberate override that happens to match must not look identical.
assert.match(noodlerHome, /const override = profile\.fanActivity\?\.archetypeWeights\?\.\[archetype\];/u);
assert.match(noodlerHome, /override === undefined && \(/u);
assert.equal(typeof enLocale["ui.noodle.noodlerfanactivity.inheritedValue"], "string");

// The text connection is edited in both tabs on purpose and is one value; the NoodleR copy says so.
assert.match(home, /ui\.noodle\.socialsettings\.sharedWithNoodle/u);
assert.match(enLocale["ui.noodle.socialsettings.sharedWithNoodle"], /changes it there too/iu);
const connectionEdits = home.match(/generationConnectionId: event\.target\.value \|\| null,/gu) ?? [];
assert.equal(connectionEdits.length, 2, "both tabs still edit the shared connection");

// --- S4: changed-from-default, and reset ------------------------------------
// The key map is the only place that enumerates settings. If it falls behind the schema, a new
// setting silently escapes both the changed-count and the reset, which is exactly the drift this
// check exists to catch. Neither file can be imported for real (@marinara-engine/shared is not
// installed at the repo root), so both are read as source.
// The Engine checkout is not part of this repository, so its absence must not fail the suite —
// it only means the schema half of this check is skipped. MARINARA_ENGINE_ROOT matches the
// builder's own environment variable.
const engineRoot = process.env.MARINARA_ENGINE_ROOT ?? "../Marinara-Engine";
const schemaPath = `${engineRoot}/packages/shared/src/schemas/noodle.schema.ts`;
const schemaSource = existsSync(schemaPath) ? readFileSync(schemaPath, "utf8") : null;
const defaultsModule = readFileSync(
  "packages/noodle/src/engine/packages/client/src/components/noodle/noodle-settings-defaults.ts",
  "utf8",
);

const schemaKeys = schemaSource
  ? (schemaSource
      .slice(schemaSource.indexOf("export const noodleSettingsSchema = z.object({"))
      .split("\n});")[0]!
      .match(/^  (\w+):/gmu) ?? []
    ).map((line) => line.trim().replace(":", ""))
  : null;
if (schemaKeys) assert.ok(schemaKeys.length > 40, "schema keys should have parsed");
else console.warn("  (skipped schema completeness: set MARINARA_ENGINE_ROOT to enable)");

// Sliced on the declarations themselves rather than on comment prose, which moves.
const mapBlock = defaultsModule.slice(
  defaultsModule.indexOf("export const NOODLE_SETTINGS_SECTION_KEYS"),
  defaultsModule.indexOf("const NOODLE_SETTINGS_RESET_EXCLUDED"),
);
const mappedKeys = (mapBlock.match(/"(\w+)"/gu) ?? []).map((q) => q.replaceAll('"', ""));

if (schemaKeys) {
  assert.deepEqual(
    schemaKeys.filter((key) => !mappedKeys.includes(key)),
    [],
    "every setting must belong to a section",
  );
  assert.deepEqual(
    mappedKeys.filter((key) => !schemaKeys.includes(key)),
    [],
    "the map must not list settings the schema does not have",
  );
}
assert.deepEqual(
  mappedKeys.filter((key, index) => mappedKeys.indexOf(key) !== index),
  [],
  "a setting must belong to exactly one section",
);

// Setup keys are excluded from both the count and the patch. Their defaults describe an
// unconfigured profile, not a chosen behaviour, so counting them lit a permanent badge on both
// General tabs — and resetting Images would have cleared the image connections it needs.
const excluded = defaultsModule.slice(
  defaultsModule.indexOf("const NOODLE_SETTINGS_RESET_EXCLUDED"),
  defaultsModule.indexOf("function isDefault"),
);
for (const key of [
  "generationConnectionId",
  "imageGenerationConnectionId",
  "imageCaptioningConnectionId",
  "enableNoodler",
  "noodlerOnboardingComplete",
  "noodlerOnboardingState",
]) {
  assert.match(excluded, new RegExp(`"${key}"`, "u"), `${key} must be excluded from count and reset`);
}
// Genuine preferences must stay counted, or the badge and reset become useless.
for (const key of ["refreshesPerDay", "theme", "postsPerDay", "noodlerGenerationGuidance"]) {
  assert.doesNotMatch(excluded, new RegExp(`"${key}"`, "u"), `${key} is a preference, not setup`);
}
// Both the count and the patch must honour the exclusions, not just one of them.
assert.match(
  defaultsModule,
  /return NOODLE_SETTINGS_SECTION_KEYS\[section\]\.filter\(\s*\(key\) => !NOODLE_SETTINGS_RESET_EXCLUDED\.has\(key\) && !isDefault\(settings, key\),\s*\);/u,
);

// Object-valued settings need a value comparison, or every load reports them as changed.
assert.match(defaultsModule, /JSON\.stringify\(current\) === JSON\.stringify\(shipped\)/u);

// A reset writes only keys that actually differ, so pressing it with nothing changed is a no-op.
assert.match(defaultsModule, /for \(const key of changedNoodleSettingKeys\(settings, section\)\)/u);
assert.match(home, /if \(keys\.length === 0\) return;/u);
assert.match(home, /const patch = noodleSettingsResetPatch\(settings, group\);/u);

// It is confirmed before it runs, and the section badge is what reveals a section needs one.
assert.match(home, /await showConfirmDialog\(\{[\s\S]{0,200}resetSectionConfirm/u);
assert.match(home, /changedCountFor\(settingsTab, section\.id\) > 0 && \(/u);
for (const key of [
  "ui.noodle.socialsettings.changedFromDefault",
  "ui.noodle.socialsettings.resetSection",
  "ui.noodle.socialsettings.resetSectionConfirm",
  "ui.noodle.socialsettings.resetSectionDone",
]) {
  assert.equal(typeof enLocale[key], "string", `${key} must exist`);
}
assert.match(enLocale["ui.noodle.socialsettings.resetSectionConfirm"], /not touched/iu);

console.log("Noodle settings structure regressions passed.");
