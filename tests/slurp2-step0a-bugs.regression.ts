import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Redesign step 0a: confirmed defects B1-B16 (see the UI review summary). Source-shape checks, the
// same kind the neighbouring Slurp2 regressions use: each fix has one line that must not regress.
const slp = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/client/src/slp");
const src = (path: string) => readFileSync(join(slp, path), "utf8");

// B1: the phone grid track must be minmax(0,1fr) or the longest preview stretches the whole list.
assert.match(src("features/messages/SlpMessages.tsx"), /grid-cols-\[minmax\(0,1fr\)\] md:grid-cols-/u);

// B2: header numbers read the post inside the `{ managed, viewerPost }` wrapper, never the wrapper.
const viewModel = src("app/screens/slp-profile-view-model.ts");
assert.match(viewModel, /entry\.viewerPost\?\.likeCount/u);
assert.doesNotMatch(viewModel, /post\.likeCount/u);
assert.doesNotMatch(src("app/screens/SlpScreenProfile.tsx"), /posts\.filter/u);

// B3: the profile price is the viewer-scope price, not the Creator record's missing field.
assert.doesNotMatch(src("app/screens/SlpProfileLeadingActions.tsx"), /slurpSubscriptionPriceOf\(profile\)/u);

// B4: no invented balance anywhere.
for (const file of ["app/SlpHomeHost.tsx", "app/slp-home-state.ts", "app/screens/SlpHomeHelpers.tsx"]) {
  assert.doesNotMatch(src(file), /PLACEHOLDER_BALANCE/u, `${file} must not invent a balance`);
}
assert.match(src("app/screens/SlpScreenWallet.tsx"), /if \(!wallet\) \{/u);

// B5: Create-profile is offered only after accounts really loaded.
assert.match(src("app/SlpHomeHost.tsx"), /shellPersonaAccount && accountsQuery\.isSuccess/u);
assert.match(src("app/slp-home-actions.ts"), /shellPersonaAccount && accountsQuery\.isSuccess/u);
assert.match(src("features/messages/SlpThreadView.tsx"), /const notLoaded = !threadQuery\.data/u);

// B7: every former improvised menu is an SlpSheet (step 0c), which closes on Escape and outside tap.
for (const file of [
  "modules/post/SlpPostMenu.tsx",
  "modules/post/SlpInteractionMenu.tsx",
  "app/screens/SlpProfileLeadingActions.tsx",
]) {
  assert.match(src(file), /<SlpSheet\b/u, `${file} must close on Escape and outside tap`);
}
const sheet = src("modules/chrome/SlpSheet.tsx");
assert.match(sheet, /event\.key === "Escape"/u);
assert.match(sheet, /addEventListener\("pointerdown", outside\)/u);
assert.match(sheet, /onClick=\{requestClose\}/u, "a scrim tap closes the phone sheet and the modal");

// B9: the selected Discover segment keeps a visible icon.
assert.doesNotMatch(src("features/discovery/SlpDiscoverToolbar.tsx"), /bg-\[var\(--noodle-accent\)\] text-white/u);

// B12: the clamped preview steps aside once the full bio is open.
assert.match(src("features/creators/SlpProfileSurface.tsx"), /line-clamp-4 group-open\/bio:hidden/u);

// B15: the age gate X and Escape mean Leave; the modal is no longer closeDisabled while Leave exists.
// (Step 8 moved the handler into one helper shared with the first-run splash.)
assert.match(src("features/onboarding/SlpSplash.tsx"), /closest\("button"\)\)\) return;\s+onLeave\?\.\(\)/u);
assert.match(src("app/SlpHomeHost.tsx"), /onClose=\{\(\) => leaveUnlessBackdrop\(onLeave\)\}/u);
assert.match(src("app/SlpHomeHost.tsx"), /closeDisabled=\{!onLeave\}/u);

// B16: the unlock sheet uses the same masked title as the card.
assert.doesNotMatch(src("modules/post/SlpLockedPostCard.tsx"), /\{post\.title && <span/u);

console.log("slurp2 step 0a bug regression: ok");
