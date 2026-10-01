/** Redesign step 8 (first run): splash consent once, "What's new" after updates, age gate restyle, one wizard progress model. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getSlurp2UnseenReleases,
  SLURP2_RELEASES,
  SLURP2_VERSION,
  slurp2SplashKind,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/onboarding/slp-release.ts";
import {
  SLP_SETUP_STEPS,
  SLP_TOUR_LABELS,
  slpOnboardingProgress,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/onboarding/slp-onboarding-progress.ts";

const slp = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/client/src/slp");
const src = (path: string) => readFileSync(join(slp, path), "utf8");
const en = JSON.parse(src("locales/en.json")) as Record<string, string>;

// 1. Consent once: a fresh install gets the welcome, an update gets "What's new", an up-to-date browser nothing.
assert.equal(slurp2SplashKind(null), "welcome");
assert.equal(slurp2SplashKind("0.2.60"), "whats-new");
assert.equal(slurp2SplashKind("an-unknown-version"), "whats-new");
assert.equal(slurp2SplashKind(SLURP2_VERSION), null);
assert.equal(getSlurp2UnseenReleases("0.2.72").length, 3);

const splash = src("features/onboarding/SlpSplash.tsx");
// G's thread replaced the welcome modal and the "What's new" sheet: one chat, replies as chips.
const chips = splash.slice(splash.indexOf("const chips: SlpChatChip[]"), splash.indexOf("<Modal"));
assert.match(
  chips,
  /consenting\s*\?[\s\S]*?label: "I get it: alpha, my own risk"/u,
  "the welcome keeps its one consent reply",
);
assert.match(chips, /\{ id: "leave", label: "Leave Slurp", onSelect: onLeave \}/u, "first-run consent has a real exit");
assert.match(
  src("modules/chrome/SlpChatShell.tsx"),
  /tabIndex=\{-1\} data-autofocus/u,
  "initial focus lands on the chat header, not the Discord link (B39)",
);
assert.match(
  src("features/onboarding/slp-g-thread.ts"),
  /if \(mode === "welcome"\) return \{ messages, scrollTo: null \};/u,
  "a fresh install does not list every release",
);
assert.doesNotMatch(splash, /type="checkbox"|approved/u, "updates never ask for consent again");
assert.match(
  chips,
  /: \[\{ id: "got-it", label: "Got it", primary: true, onSelect: finish \}\]/u,
  "after an update, Got it closes the thread",
);
assert.doesNotMatch(splash, /max-h-64/u, "one scroll container, no nested notes box");
assert.match(
  src("app/SlpHomeHost.tsx"),
  /<SlurpSplash open=\{splashOpen\} onDismiss=\{\(\) => setSplashOpen\(false\)\} onLeave=\{onLeave\} \/>/u,
);

// 2. Release notes: player outcomes, at most 3 bullets, no em dashes, no engineering words.
for (const release of SLURP2_RELEASES) {
  assert.ok(release.notes.length >= 1 && release.notes.length <= 3, `${release.version} has 1-3 bullets`);
  for (const note of release.notes) {
    assert.doesNotMatch(note, /—/u, `${release.version}: no em dash`);
    assert.doesNotMatch(note, /\b(prompt|negative prompt|deterministic|schema|modularis|simulated|fake)\b/iu, note);
  }
}

// 3. Age gate: restyle only. Text, flow and the Pastapay gag stay; the X/Escape behaviour from 0a stays.
const gate = src("features/onboarding/SlpAgeGate.tsx");
for (const key of [
  "cardTitle",
  "cardSub",
  "cardBrand",
  "cardFree",
  "adultConfirmation",
  "explainerContinue",
  "enter",
]) {
  assert.match(gate, new RegExp(`tt\\("${key}"`, "u"), `gate keeps ${key}`);
}
assert.match(gate, /const CARD_NUMBER = "5309 1312 4200 6969"/u);
assert.match(gate, /ui\.noodle\.agegate\.cardCharging/u);
assert.match(gate, /<SlpPrimaryButton[\s\S]*?disabled=\{!charged \|\| !confirmedAdult \|\| isPending\}/u);
assert.doesNotMatch(gate, /font-black uppercase|text-\[0\.55rem\]/u, "no shouting buttons or sub-floor type");
assert.match(src("app/SlpHomeHost.tsx"), /onClose=\{\(\) => leaveUnlessBackdrop\(onLeave\)\}/u);

// 4. Wizard: one progress model with short labels, Slurp's own controls, reasons for disabled primaries.
assert.deepEqual(slpOnboardingProgress({ intro: 0, setupLane: null, step: 1 }), {
  current: 1,
  total: 5,
  label: "welcome",
});
assert.deepEqual(slpOnboardingProgress({ intro: 4, setupLane: null, step: 1 }), {
  current: 5,
  total: 5,
  label: "posting",
});
assert.equal(slpOnboardingProgress({ intro: null, setupLane: null, step: 1 }), null, "the lane choice is not a step");
assert.deepEqual(slpOnboardingProgress({ intro: null, setupLane: "easy", step: 1 }), {
  current: 1,
  total: 2,
  label: "who",
});
assert.deepEqual(slpOnboardingProgress({ intro: null, setupLane: "easy", step: 4 }), {
  current: 2,
  total: 2,
  label: "review",
});
assert.deepEqual(slpOnboardingProgress({ intro: null, setupLane: "customize", step: 3 }), {
  current: 3,
  total: 4,
  label: "posting",
});
assert.equal(slpOnboardingProgress({ intro: null, setupLane: "customize", step: 5 }), null, "the result is not a step");
for (const label of [
  ...SLP_TOUR_LABELS,
  ...Object.values(SLP_SETUP_STEPS).flatMap((steps) => steps.map((s) => s.label)),
]) {
  const text = en[`ui.slurp.wizard.label.${label}`];
  assert.ok(text, `label ${label} has English copy`);
  assert.ok(text.length <= 12, `label ${label} fits 390 px`);
}
for (const key of ["stepOf", "stepCount_one", "stepCount_other", "revealToContinue", "pickOne"]) {
  assert.ok(en[`ui.slurp.wizard.${key}`], `ui.slurp.wizard.${key}`);
}

const panel = src("features/onboarding/SlpOnboardingPanel.tsx");
const steps = src("features/onboarding/SlpOnboardingSteps.tsx");
assert.match(panel, /<SlpWizardProgress/u);
assert.doesNotMatch(panel, /\[0, 1, 2, 3, 4\]\.map\(\(dot\)/u, "the tour dots are gone");
assert.doesNotMatch(panel + steps, /summaries/u, "the labelled segment rail is gone");
assert.doesNotMatch(
  panel + steps,
  /<select|type="checkbox"|type="number"/u,
  "no native selects, checkboxes or number fields",
);
assert.match(steps, /<SlpSquareCheck checked=\{checked\} \/>/u, "multi-select rows get square check marks");
assert.match(
  steps,
  /function ConnectionPicker[\s\S]*?<SlpSheet[\s\S]*?<SlpRadioRow/u,
  "connections use a picker sheet",
);
assert.match(panel, /ui\.slurp\.wizard\.revealToContinue/u);
assert.match(panel, /ui\.slurp\.wizard\.pickOne/u);
assert.match(panel, /note=\{running \|\| reason\}/u, "every disabled primary says why under it");
assert.match(src("modules/chrome/SlpWizardChrome.tsx"), /\[&>button\]:whitespace-nowrap/u, "the footer never wraps");
assert.match(src("modules/chrome/SlpButton.tsx"), /export function SlpSquareCheck[\s\S]*?rounded-\[5px\]/u);
// The demo stays, and its title stays hidden until the reveal (B16).
assert.match(panel, /<LockedSlurpPostCard[\s\S]*?demo=\{\{[\s\S]*?lockedTitle:/u);

console.log("Slurp2 step 8 first-run regressions passed.");
