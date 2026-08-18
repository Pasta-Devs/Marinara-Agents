import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Creator activity presets belong to Slurp. The onboarding wizard resolves each selection through
// one shared preset table before it writes Creator settings.

const wizard = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpOnboardingPanel.tsx",
  "utf8",
);
const hooks = readFileSync("packages/slurp/src/engine/packages/client/src/hooks/use-slurp.ts", "utf8");
const settings = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpSettings.tsx",
  "utf8",
);

// The preset table stays in Slurp, and the wizard applies the complete Creator settings patch.
assert.match(wizard, /from "\.\/slurp-activity-presets"/u);
assert.match(wizard, /const patch = slurpActivityPresetPatch\(choice\);/u);
assert.match(wizard, /setAutoPostingEnabled\(patch\.autoPostingScheduleEnabled\);/u);
assert.match(wizard, /setPostsPerDay\(patch\.postsPerDay\);/u);
assert.match(wizard, /useUpdateSlurpSettings/u);
assert.match(hooks, /api\.patch<SlurpSettings>\("\/slurp\/settings", patch\)/u);
assert.match(settings, /Extract<SlurpNavigationState, \{ mode: "creator-settings" \}>/u);
assert.doesNotMatch(settings, /NoodleHome|\/noodle\//u);

console.log("NoodleR quieter-action regressions passed.");
