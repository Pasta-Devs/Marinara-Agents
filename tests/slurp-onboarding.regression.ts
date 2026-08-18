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
assert.doesNotMatch(panel, /showConfirmDialog/u, "onboarding must not wait on the disconnected host dialog store");
assert.match(panel, /open=\{providerConfirmationOpen\}[\s\S]*?void performFinish\(\)/u);
assert.match(panel, /open=\{providerConfirmationOpen\}[\s\S]*?panelStyle=\{getNoodleAccentStyle\(NOODLE_PINK/u);
assert.match(
  panel,
  /const performFinish = async \(\) => \{[\s\S]*?bulkCreate\.mutateAsync\([\s\S]*?\} catch \(error\) \{[\s\S]*?if \(error instanceof Error\) setCreationError\(error\.message\);/u,
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
  /selectionOnly=\{onboardingMode === "add-creators"\}[\s\S]*?onComplete=\{\(\) => \{\s*if \(onboardingMode === "first-run"\) \{\s*setOnboardingState\("completed"\);\s*\}\s*\}\}/u,
  "The settings callback must keep the completion result visible",
);
assert.match(
  settings,
  /section === "creators"[\s\S]*?onAddCreators/u,
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
  /connectionId[\s\S]*?settings\.generationConnectionId[\s\S]*?connections\.getWithKey\(selectedConnectionId\)[\s\S]*?: await connections\.getDefaultForAgents\(\)/u,
  "Creator creation must use the selected or Engine default agent connection",
);
assert.match(
  routes,
  /noodleBulkNoodlerAccountCreateSchema\.extend\(\{[\s\S]*?connectionId: z\.string\(\)\.min\(1\)\.nullable\(\)\.optional\(\)/u,
  "Creator creation must accept the wizard connection override",
);
assert.match(
  panel,
  /step === 5 && completion === "creationFailed"[\s\S]*?if \(step === 5\) returnToSetup\(\)/u,
  "A failed creator setup must allow the user to return to the review step",
);
assert.match(
  home,
  /function StageProfileView\(\{[\s\S]*?viewerAccount,\s*slurpSettings,\s*postCardCtx,/u,
  "Creator profile pages must receive their Slurp settings prop",
);
assert.match(
  home,
  /const closeOnboarding = \(\) => \{[\s\S]*?onboardingMode === "first-run"[\s\S]*?setOnboardingState\("completed"\)[\s\S]*?setOnboardingMode\(null\)/u,
  "Closing first-run setup must persist completion",
);
assert.match(
  home,
  /const viewingOwnCreator = profile\.sourceAccountId === viewerAccount\?\.entityId/u,
  "Profile ownership must follow the active persona",
);
assert.match(
  home,
  /onRefresh=\{\(\) =>[\s\S]*?viewerQuery\.refetch\(\)[\s\S]*?noodleTimelineRefreshed/u,
  "The timeline refresh action must refetch and report completion",
);

console.log("Slurp onboarding regressions passed.");
