import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

console.log("Noodle settings structure regressions passed.");
