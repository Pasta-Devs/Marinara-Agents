import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const panel = readFileSync(
  join(root, "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpOnboardingPanel.tsx"),
  "utf8",
);
const home = readFileSync(
  join(root, "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx"),
  "utf8",
);
const settings = readFileSync(
  join(root, "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpSettings.tsx"),
  "utf8",
);
const storage = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts"),
  "utf8",
);
const routes = readFileSync(join(root, "packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts"), "utf8");

assert.match(
  panel,
  /\.\.\.\(selectionOnly\s*\? \{\}\s*:\s*\{[\s\S]*?onboarding:/u,
  "Adding creators must not change the completed onboarding state",
);
assert.match(
  panel,
  /const finish = async \(\) => \{[\s\S]*?bulkCreate\.mutateAsync\([\s\S]*?\} catch \(error\) \{[\s\S]*?if \(error instanceof Error\) setCreationError\(error\.message\);/u,
  "Bulk-create failures must preserve the caught error",
);
assert.doesNotMatch(
  panel,
  /setSettingsFailed\(!settingsSaved\);\s*if \(settingsSaved\) onComplete/u,
  "Completion must not be reported before first-post generation",
);
assert.match(
  panel,
  /finalizeOutcomes\([\s\S]*?settingsSaved,[\s\S]*?\);\s*if \(settingsSaved\) onComplete/u,
  "Completion must be reported after first-post generation reaches a result",
);
assert.match(
  panel,
  /bulkCreate\.isPending \|\|\s*updateSlurpSettings\.isPending \|\|\s*refreshTargeted\.isPending/u,
  "The modal must stay locked while settings are saved",
);
assert.match(
  home,
  /selectionOnly=\{onboardingMode === "add-creators"\}[\s\S]*?onComplete=\{\(\) => \{\s*if \(onboardingMode === "first-run"\) \{\s*setOnboardingState\("completed"\);\s*setOnboardingMode\(null\);\s*\}\s*\}\}/u,
  "The settings callback must close only full onboarding after completion",
);
assert.match(
  settings,
  /section === "creators" && <div className="flex justify-end"><button[^>]+onClick=\{onAddCreators\}/u,
  "Add creators must be shown in the Creators settings section",
);
assert.doesNotMatch(
  settings,
  /<header[\s\S]*?onClick=\{onAddCreators\}[\s\S]*?<\/header>/u,
  "Add creators must not be shown in the shared settings header",
);
assert.match(
  panel,
  /setImagesEnabled\(settings\.autoPostingImagesEnabled\)/u,
  "The wizard must restore the saved image-post preference",
);
assert.match(panel, /autoPostingImagesEnabled: imagesEnabled/u, "The wizard must save the image-post preference");
assert.doesNotMatch(
  panel,
  /imageGenerationUseAvatarReferences: imagesEnabled/u,
  "The image-post switch must not overwrite avatar-reference settings",
);
assert.match(storage, /autoPostingImagesEnabled: z\.boolean\(\)/u);
assert.match(storage, /autoPostingImagesEnabled: false/u);
assert.match(
  routes,
  /settings\.generationConnectionId[\s\S]*?connections\.getWithKey\(settings\.generationConnectionId\)[\s\S]*?: await connections\.getDefaultForAgents\(\)/u,
  "Creator creation must inherit the Engine agent connection when Slurp has no override",
);
assert.match(
  home,
  /function StageProfileView\(\{[\s\S]*?viewerAccount,\s*slurpSettings,\s*postCardCtx,/u,
  "Creator profile pages must receive their Slurp settings prop",
);

console.log("Slurp onboarding regressions passed.");
