import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const component = (name: string) =>
  readFileSync(join(root, "packages/slurp2/src/engine/packages/client/src/components/slurp", name), "utf8");

const settings = component("SlurpSettings.tsx");
const automation = component("SlurpBackstageAutomation.tsx");
const world = component("SlurpBackstageWorld.tsx");
const overview = component("SlurpBackstageOverview.tsx");
const workflow = component("SlurpBackstageWorkflow.tsx");
const creators = component("SlurpBackstageCreators.tsx");

for (const wizard of ["imageWizardOpen", "audienceWizardOpen", "messagingWizardOpen"]) {
  assert.match(`${automation}\n${world}`, new RegExp(`\\b${wizard}\\b`), `${wizard} must remain reachable`);
}

assert.match(automation, /<BackstageWizard[\s\S]*patch=\{imageDraft\}/u, "the image wizard must apply one patch");
assert.match(world, /audienceWizardOpen[\s\S]*<BackstageWizard/u, "audience must expose a reviewed wizard");
assert.match(world, /messagingWizardOpen[\s\S]*<BackstageWizard/u, "messaging must expose a reviewed wizard");

assert.doesNotMatch(settings, /<SlurpBackstagePreview/u, "Backstage must not reserve space for a live preview pane");
assert.doesNotMatch(
  settings,
  /xl:grid-cols-\[minmax\(0,1\.5fr\)_minmax\(17rem,0\.72fr\)\]/u,
  "settings workflows must use the full canvas",
);

assert.doesNotMatch(
  settings,
  /md:grid-cols-\[12rem_minmax\(0,1fr\)\]/u,
  "Backstage content must not render a second desktop destination rail",
);
assert.match(settings, /export function SlurpSettingsSidebar/u, "the shell-owned desktop rail must remain available");
assert.match(
  overview,
  /avatars=\{autoPostingCreators\.slice\(0, 4\)\}[\s\S]*avatarTotal=\{autoPostingCreators\.length\}/u,
  "the Overview avatar stack must show auto-posting Creators and preserve the full count",
);
assert.match(workflow, /\+\{\(avatarTotal/u, "a compact avatar stack must expose the remaining Creator count");
assert.match(
  creators,
  /setSelectedCreatorId\(creator\.id\);[\s\S]*setTab\("profile"\);/u,
  "selecting a Creator must return to the safe Profile tab",
);

console.log("Slurp2 Backstage completion regression passed");
