# Slurp Bug Fix Plan

## Scope

Address the Slurp issues reported against Marinara Engine 2.4.4 and the
Slurp/Noodle v1.2.13 test build. Keep the work in the `slurp` package. Do not
modify generated `client.js`, `server.mjs`, artifacts, manifests, hashes, or
catalogs by hand.

The report contains confirmed defects, one already-filed issue that needs
staging verification, and product questions that need a decision before code
changes. The implementation should group fixes by root cause instead of by
screen.

## Priority And Dependencies

1. Fix identity resolution before validating generated replies or subscriber
   lists. A1 and A2 likely share one viewer-profile resolution defect.
2. Fix reply cancellation before other interaction work. B2 can create data
   after the user cancels an operation.
3. Fix post and comment edit/delete controls. These are visible dead controls
   and require a clear permission and persistence contract.
4. Fix profile-editor navigation. C1 and C2 likely share pending-navigation
   state handling.
5. Fix settings and localization defects. D1 and D2 are isolated and can be
   verified with focused tests.
6. Investigate image instruction delivery and import retry behavior. These
   require tracing the generation payload and provider failure path.
7. Apply product decisions and cosmetic changes after behavior is stable.

## Phase 0: Reproduce And Trace

- Read the Slurp manifest, client entry point, route registration, storage
  schema, hooks, and existing regression tests.
- Trace the active viewer persona to the Slurp profile used for comments,
  replies, likes, subscriptions, and prompt display names.
- Trace the reply confirmation flow from button click through interaction
  creation and creator-reply generation.
- Trace post and comment menu handlers and confirm whether edit/delete routes
  exist or are missing.
- Trace profile-editor navigation, discard confirmation, and clean-editor
  navigation.
- Trace every numeric settings stepper from input state through persistence and
  the displayed usage limit.
- Trace Slurp refresh image instructions through prompt creation, rewrite, and
  image-provider request payloads.
- Record reproduction results before edits. Separate confirmed defects from
  provider or product-policy questions.

## Phase 1: Identity And Data-Safety Fixes

### A1/A2: Use The Active Slurp Profile

- Resolve the active Slurp viewer profile for the selected Engine persona.
- Use that profile as the actor for comments, replies, likes, subscriptions,
  and other Slurp-surface interactions.
- Pass the Slurp stage name and handle into generated reply context. Do not
  pass the persona's real display name when the Slurp profile is active.
- Store subscriber rows with the Slurp profile identity.
- Preserve historical actor identity. Do not reattribute existing activity when
  the active persona or profile changes.
- Add regression proof for authored comments, generated replies, subscriber
  lists, and prompt identity context.

### B2: Cancel Reply Must Not Create A Comment

- Keep the confirmation dialog decision separate from the mutation.
- Create the viewer interaction only after the user confirms.
- Generate the creator reply only after the interaction succeeds and the user
  requested a reply.
- Add a regression test for cancel-after-Reply and confirm-before-Reply.

### B5: Implement Or Remove Dead Edit/Delete Actions

- Identify the supported ownership and authorization rules for Creator posts,
  viewer comments, and generated replies.
- Implement the smallest complete path for edit and delete, including route,
  storage mutation, query invalidation, confirmation, error state, and UI
  feedback.
- If a control is intentionally unsupported, remove or disable it with an
  accessible explanation. Do not leave a clickable no-op.
- Add positive and negative tests for permitted and denied mutations.

## Phase 2: Profile Navigation And Subscription State

### C1/C2: Complete Editor Navigation

- Preserve the requested destination when the unsaved-changes dialog opens.
- On Discard, clear the draft and complete the pending navigation.
- On Cancel, close the dialog and keep the editor open.
- Allow navigation from an editor with no changes.
- Test Slurp, Discover, and Profile destinations for both dirty and clean
  editors.

### B1: Verify Subscription Unlock Refresh

- Re-test issue #5487 on the staging channel before changing code.
- If still broken, invalidate or update the profile and post queries after a
  successful subscription from the profile page.
- Verify that the locked post unlocks in place without leaving and returning.

## Phase 3: Settings And Localization

### D1: Resolve Untranslated Cancel Label

- Find the Refresh Slurp dialog button that renders
  `capabilities.actions.cancel`.
- Replace the wrong key with the Slurp-localized Cancel key.
- Search the complete Slurp client source and locale files for other unresolved
  `capabilities.*` keys.
- Add a focused locale regression check.

### D2: Persist Numeric Steppers

- Bind persistence to the numeric value change, including native stepper arrow
  changes without focus or blur.
- Audit Likes, Replies, Reposts, Posts per day, and Runs per day controls.
- Verify the daily usage readout uses the persisted value immediately after an
  arrow click.
- Add regression proof for arrow-only changes and text-entry changes.

### D3: Decide Connection Label

- Confirm whether the setting means the Engine default language connection or a
  generic agent connection.
- Keep the current label until the product meaning is confirmed.
- Change the label and locale entries only after that decision.

## Phase 4: Generation And Automation Policy

### A3: Prevent Persona-Owned Profiles From Auto-Posting

- Define whether Linked and Hinted persona-owned profiles are always excluded
  or require explicit opt-in.
- Exclude those profiles from Creator auto-post settings and bulk refresh
  targets under the selected policy.
- Check that disabling auto-post also handles already queued work according to
  the existing schedule contract.
- Add positive and negative target-selection tests.

### B3: Clarify Generate-On-Demand Reply Behavior

- Confirm whether an explicit user reply confirmation is an allowed immediate
  generation trigger when automatic generation is set to Generate on demand.
- If allowed, document and test the distinction between explicit reply
  requests and automatic generation.
- If not allowed, prevent the generation request after confirmation.

### C3: Retry Empty Character-Card Responses

- Keep the current user-facing error message.
- Add a bounded retry or repair pass for empty or invalid JSON responses.
- Preserve provider and model errors after the retry budget is exhausted.
- Add a deterministic regression test for one failed response followed by a
  valid response.
- Reproduce the reported voice and bio field mapping issue separately. Do not
  combine it with retry work unless confirmed.

### E1: Deliver Image Generation Instructions

- Capture the exact refresh payload sent to the image connection in a test or
  safe diagnostic path.
- Verify that image-generation instructions survive settings load, prompt
  assembly, rewrite, and provider request creation.
- Fix the first dropped boundary, not the final provider behavior.
- Add a regression test using a unique instruction marker such as `pineapple`.

### E2: Defer Unconfirmed Image Explicitness Report

- Do not change default image safety or style prompts without a direct
  reproduction.
- Revisit only after E1 is confirmed and the default prompt path is observable.

## Phase 5: UI Polish

- Add sufficient spacing between cleanup or destructive action buttons in the
  affected Slurp surface.
- Ensure destructive styling appears on hover or focus only, not as a persistent
  hover state.
- Normalize the profile editor Cancel button so focus state does not change its
  visual priority without a functional reason.
- Fix the post-onboarding `See the feed` action to navigate to the Slurp feed.
- Add focused browser coverage for the affected flows where practical.

## Validation

For each phase, run the smallest relevant regression tests before moving on.
After source changes, rebuild the Slurp feature package with the repository
builder. Then run:

```bash
npm run check
node scripts/test-catalog-lanes.mjs
node scripts/validate-package-locales.mjs
node scripts/validate-catalog.mjs
git diff --check
```

Also run the Slurp regression suite and the Slurp browser test when a compatible
Marinara Engine checkout is available:

```bash
for test in tests/slurp-*.regression.ts; do tsx "$test" || exit 1; done
npm run test:browser:slurp
```

Manually verify install, activation, update, restart, offline restart, and
uninstall behavior for the rebuilt package. Record any unavailable Engine or
browser proof instead of claiming it was completed.

## Completion Criteria

- A1, A2, B2, B5, C1, C2, D1, D2, and E1 have code and regression proof.
- B1 is re-tested against staging or fixed with evidence if it still fails.
- A3, B3, C3, and D3 have explicit product decisions recorded in code or the
  issue notes before implementation.
- E2 remains unchanged unless direct reproduction confirms it.
- Source, generated package payloads, artifact, catalog entries, and tests are
  consistent after rebuild.
- Validation output and manual test gaps are recorded in the implementation
  change or pull request.
