import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Onboarding completion is a one-way door: saveSettings("zero") writes noodlerOnboardingState
// "zero", and SlurpHome only reopens the wizard while that state is "incomplete". So the write
// must happen for a deliberate Skip Setup and nothing else. Wiring it to the modal's dismiss
// handler made Escape, the backdrop, and the X silently end the teaching flow forever. The
// component needs a DOM to render, so this asserts the wiring in source.

const panel = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpOnboardingPanel.tsx",
  "utf8",
);
const home = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8");

// Dismissing the modal closes it and records nothing.
assert.match(panel, /<Modal\s+open=\{open\}\s+onClose=\{onClose\}/u);
assert.doesNotMatch(panel, /onClose=\{[^}]*skip\(\)/u, "dismiss must not run the skip path");

// skip() is reachable from exactly one place: the Skip Setup button.
const skipCallSites = panel.match(/\bskip\(\)/gu) ?? [];
assert.equal(skipCallSites.length, 1, "skip() should have a single call site");
assert.match(panel, /intro === null \? void skip\(\) : setIntro\(null\)/u);

// "zero" is only ever written by that skip. The other saveSettings call decides between "zero"
// and "completed" from how many creators the run actually produced.
assert.match(
  panel,
  /const skip = async \(\) => \{[\s\S]*?saveSettings\("zero"\)[\s\S]*?onSkipped\?\.\(\)[\s\S]*?onClose\(\);/u,
);
assert.match(
  panel,
  /await saveSettings\(\s*selected\.size === 0 \|\| newIds\.length === 0 \? "zero" : "completed",?\s*\);/u,
);

// Adding creators later reuses this wizard; its settings write remains Slurp-owned.
assert.match(panel, /useUpdateSlurpSettings/u);
assert.match(panel, /autoPostingScheduleEnabled: autoPostingEnabled/u);

// A dismissed run is still incomplete, so the next mount reopens the wizard.
assert.doesNotMatch(home, /noodlerOnboardingState/u);

// The Easy lane skips steps 2 and 3, so Back from the review step returns to selection rather
// than dropping the player into a Customize step they never saw.
assert.match(panel, /setStep\(setupLane === "easy" \? 1 : \(\(step - 1\) as Step\)\)/u);

// The joke card must not read as a real payment.
const enLocale = readFileSync("packages/slurp/src/engine/packages/client/src/localization/locales/en.json", "utf8");
assert.match(
  enLocale,
  /"ui\.noodle\.agegate\.cardSub": "The card is fake[^"]*Nothing is charged and nothing leaves your computer\."/u,
);

console.log("NoodleR onboarding navigation regressions passed.");
