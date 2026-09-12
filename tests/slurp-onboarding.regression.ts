import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const panel = readFileSync(
  join(root, "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpOnboardingPanel.tsx"),
  "utf8",
);
const home = readFileSync(
  join(root, "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpHome.tsx"),
  "utf8",
);
const settings = readFileSync(
  join(root, "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpSettings.tsx"),
  "utf8",
);
const storage = readFileSync(
  join(root, "packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts"),
  "utf8",
);
const routes = readFileSync(
  join(root, "packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts"),
  "utf8",
);
const creatorCard = readFileSync(
  join(root, "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpCreatorPostCard.tsx"),
  "utf8",
);
const postCard = readFileSync(
  join(root, "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpPostCard.tsx"),
  "utf8",
);
const fanActivity = readFileSync(
  join(root, "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-fan-activity.service.ts"),
  "utf8",
);
const responseFormat = readFileSync(
  join(root, "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-response-format.ts"),
  "utf8",
);

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
assert.match(
  panel,
  /type Intro = 0 \| 1 \| 2 \| 3 \| 4 \| null[\s\S]*?const LAST_INTRO = 4[\s\S]*?intro === 0[\s\S]*?intro === 1[\s\S]*?intro === 2[\s\S]*?intro === 3[\s\S]*?intro === 4/u,
  "First-run onboarding must show info, attention, identity, locked-post, and activity screens in order",
);
assert.match(
  panel,
  /key: "cost"[\s\S]*?key: "images"[\s\S]*?key: "context"/u,
  "The attention screen must disclose cost, image generation, and local-model limits",
);
assert.doesNotMatch(
  panel,
  /imageGenerationUseAvatarReferences: imagesEnabled/u,
  "The image-post switch must not overwrite avatar-reference settings",
);
assert.match(storage, /autoPostingImagesEnabled: z\.boolean\(\)/u);
assert.match(storage, /autoPostingImagesEnabled: false/u);
assert.match(
  routes,
  /resolveSlurpTextConnection\(\s*connections,\s*connectionId === undefined \? settings\.generationConnectionId : connectionId,\s*\)/u,
  "Creator creation must use the selected connection, then the shared Slurp fallback ladder",
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
  /function StageProfileView\(\{[\s\S]*?viewerAccount,[\s\S]*?viewerActorAccount,[\s\S]*?slurpSettings,[\s\S]*?postCardCtx,/u,
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
  /onRefresh=\{\(\) =>[\s\S]*?viewerQuery\.refetch\(\)[\s\S]*?ui\.slurp\.feed\.refreshed/u,
  "The timeline refresh action must refetch and report completion",
);
assert.doesNotMatch(creatorCard, /repost|Repeat2/iu, "Slurp creator cards must not expose repost actions");
assert.doesNotMatch(postCard, /repost|Repeat2/iu, "Slurp post cards must not expose repost actions");
assert.doesNotMatch(fanActivity, /fanRepostsPerRefresh|repost/iu, "Synthetic Slurp audience activity must not repost");
assert.doesNotMatch(responseFormat, /enum: \[[^\]]*repost/iu, "Slurp model output must not request reposts");
assert.match(routes, /parsed\.data\.type === "repost"[\s\S]*?Reposts are not available in Slurp/u);

console.log("Slurp onboarding regressions passed.");
