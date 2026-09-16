import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const component = (name: string) =>
  readFileSync(join(root, "packages/slurp2/src/engine/packages/client/src/components/slurp", name), "utf8");

const settings = component("SlurpSettings.tsx");
const automation = component("SlurpBackstageAutomation.tsx");
const world = component("SlurpBackstageWorld.tsx");
const preview = component("SlurpBackstageChrome.tsx");

for (const wizard of ["imageWizardOpen", "audienceWizardOpen", "messagingWizardOpen"]) {
  assert.match(`${automation}\n${world}`, new RegExp(`\\b${wizard}\\b`), `${wizard} must remain reachable`);
}

assert.match(automation, /<BackstageWizard[\s\S]*patch=\{imageDraft\}/u, "the image wizard must apply one patch");
assert.match(world, /audienceWizardOpen[\s\S]*<BackstageWizard/u, "audience must expose a reviewed wizard");
assert.match(world, /messagingWizardOpen[\s\S]*<BackstageWizard/u, "messaging must expose a reviewed wizard");

for (const visualTarget of ['target === "creators"', 'target === "general"', 'target === "images"']) {
  assert.ok(preview.includes(visualTarget), `${visualTarget} must have a representative visual preview`);
}
assert.match(preview, /creatorProfile=|creatorProfile\?:/u, "the preview must accept safe real Creator data");

assert.doesNotMatch(
  settings,
  /md:grid-cols-\[12rem_minmax\(0,1fr\)\]/u,
  "Backstage content must not render a second desktop destination rail",
);
assert.match(settings, /export function SlurpSettingsSidebar/u, "the shell-owned desktop rail must remain available");

console.log("Slurp2 Backstage completion regression passed");
