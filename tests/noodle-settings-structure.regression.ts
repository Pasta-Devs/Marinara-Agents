import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const [noodleHome, slurpHome, slurpSettings, slurpTypes, slurpStore] = await Promise.all([
    readFile("packages/noodle/src/engine/packages/client/src/components/noodle/NoodleHome.tsx", "utf8"),
    readFile("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8"),
    readFile("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpSettings.tsx", "utf8"),
    readFile("packages/slurp/src/engine/packages/client/src/components/slurp/slurp-navigation.types.ts", "utf8"),
    readFile("packages/slurp/src/engine/packages/client/src/stores/slurp-package.store.ts", "utf8"),
  ]);
  assert.doesNotMatch(noodleHome, /enableNoodler|NoodlerPublishingSettings|SlurpAgeGate/u);
  assert.match(slurpSettings, /useSlurpSettings|useUpdateSlurpSettings/u);
  assert.match(slurpHome, /SlurpOnboardingPanel/u);
  assert.match(slurpTypes, /mode: "creator-settings"/u);
  assert.match(slurpTypes, /sourceAccountId: string/u);
  assert.match(slurpStore, /marinara:slurp:package-ui/u);
  assert.doesNotMatch(slurpStore, /marinara:noodle:ui|LEGACY_UI_STATE_KEY.*noodle/u);
  console.log("Noodle and Slurp settings structure regressions passed.");
}

void main();
