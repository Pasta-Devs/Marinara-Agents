import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// "Make NoodleR quieter" is the one-click calm-down. Its whole value is that a player never has
// to meet the scheduler, so the risks are that it silently stops automatic posting, that it
// drifts away from the Occasional preset the wizard teaches, or that it stays offered once the
// feed is already quiet and does nothing when pressed.

const home = readFileSync(
  "packages/noodle/src/engine/packages/client/src/components/noodle/NoodlerHome.tsx",
  "utf8",
);
const wizard = readFileSync(
  "packages/noodle/src/engine/packages/client/src/components/noodle/NoodlerBulkCreatePanel.tsx",
  "utf8",
);
const enLocale = JSON.parse(
  readFileSync(
    "packages/noodle/src/engine/packages/client/src/localization/locales/en.json",
    "utf8",
  ),
) as Record<string, string>;

// One definition of "quieter", and it matches the wizard's Occasional preset.
assert.match(home, /const NOODLER_OCCASIONAL_POSTS_PER_DAY = 2;/u);
assert.match(
  wizard,
  /const pace = choice === "occasional" \? 2 : choice === "veryActive" \? 8 : 4;/u,
  "the wizard's Occasional pace must still be 2",
);

// It only ever steps down to Occasional. It must never write postsPerDay 0 or disable posting.
assert.match(home, /\{ postsPerDay: NOODLER_OCCASIONAL_POSTS_PER_DAY \}/u);
const quieterBlock = home.slice(
  home.indexOf("const makeQuieter ="),
  home.indexOf("const beginCreate ="),
);
assert.doesNotMatch(quieterBlock, /autoPosting|enableNoodler|postsPerDay: 0/u);

// Hidden once the feed is already Occasional or quieter, so it never no-ops.
assert.match(home, /const canQuieten = \(data\?\.settings\.postsPerDay \?\? 0\) > NOODLER_OCCASIONAL_POSTS_PER_DAY;/u);
assert.match(home, /\{canQuieten && \(\s*<button/u);

// A pending save disables it, and a failed one says so rather than pretending it worked.
assert.match(home, /disabled=\{quieterPending\}/u);
assert.match(quieterBlock, /onError:[\s\S]{0,120}couldNotMakeNoodlerQuieter/u);

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
