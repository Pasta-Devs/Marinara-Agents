import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// "Make NoodleR quieter" is the one-click calm-down. Its whole value is that a player never has
// to meet the scheduler, so the risks are that it silently stops automatic posting, that it
// drifts away from the Occasional preset the wizard teaches, or that it stays offered once the
// feed is already quiet and does nothing when pressed.

const home = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/NoodlerHome.tsx",
  "utf8",
);
const wizard = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/NoodlerBulkCreatePanel.tsx",
  "utf8",
);
const enLocale = JSON.parse(
  readFileSync(
    "packages/slurp/src/engine/packages/client/src/localization/locales/en.json",
    "utf8",
  ),
) as Record<string, string>;

// One definition of "quieter": the pace is resolved from the shared preset table rather than
// restated here, so this file and the wizard cannot drift apart. The table's own contents are
// covered by noodle-settings-structure.regression.ts.
assert.match(home, /from "\.\/noodler-activity-presets"/u);
assert.match(
  home,
  /const NOODLER_QUIETER_POSTS_PER_DAY = noodlerPostsPerDayForPreset\(\s*NOODLER_QUIETER_ACTIVITY_PRESET,\s*\);/u,
);
assert.match(wizard, /const patch = noodlerActivityPresetPatch\(choice\);/u);
assert.match(wizard, /setAutoPostingEnabled\(patch\.autoPostingScheduleEnabled\);/u);
assert.match(wizard, /setPostsPerDay\(patch\.postsPerDay\);/u);

// It only ever steps down to Occasional. It must never write postsPerDay 0 or disable posting.
assert.match(home, /\{ postsPerDay: NOODLER_QUIETER_POSTS_PER_DAY \}/u);
const quieterBlock = home.slice(
  home.indexOf("const makeQuieter ="),
  home.indexOf("const beginCreate ="),
);
assert.doesNotMatch(quieterBlock, /autoPosting|enableNoodler|postsPerDay: 0/u);

// Hidden once the feed is already Occasional or quieter, so it never no-ops.
assert.match(
  home,
  /const canQuieten =\s*\(data\?\.settings\.postsPerDay \?\? 0\) > NOODLER_QUIETER_POSTS_PER_DAY;/u,
);
assert.match(home, /\{canQuieten && \(\s*<button/u);

// A pending save disables it, and a failed one says so rather than pretending it worked.
assert.match(home, /disabled=\{quieterPending\}/u);
assert.match(quieterBlock, /onError:[\s\S]{0,240}couldNotMakeNoodlerQuieter/u);

// The confirmation states the resulting pace, including that the ceiling is global.
for (const key of [
  "ui.noodle.noodlerhome.makeNoodlerQuieter",
  "ui.noodle.noodlerhome.makeNoodlerQuieterDetail",
  "ui.noodle.noodlerhome.quieterApplied",
  "ui.noodle.noodlerhome.couldNotMakeNoodlerQuieter",
]) {
  assert.equal(typeof enLocale[key], "string", `${key} must exist in the English catalog`);
}
assert.match(enLocale["ui.noodle.noodlerhome.quieterApplied"], /\{\{count\}\}[\s\S]*across all Creators/u);
assert.match(enLocale["ui.noodle.noodlerhome.makeNoodlerQuieterDetail"], /NoodleR settings/u);

console.log("NoodleR quieter-action regressions passed.");
