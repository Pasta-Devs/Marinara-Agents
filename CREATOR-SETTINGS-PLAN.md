# Slurp2 Creator Settings Improvement Plan

Temporary implementation plan for the Creator directory and the per-Creator settings workspace.
This file can be removed after the work is complete.

## Goals

- Prevent profile draft loss when changing tabs or leaving the settings workspace.
- Give failed Creator data loads a visible recovery path.
- Group Creator controls by user task and scope.
- Make inherited values, custom overrides, attention states, and save states clear.
- Keep the Creator directory useful for finding and comparing Creators.
- Keep bulk editing explicit about its limited field set and pending changes.

## Slice 1: Safety And State

Scope:

- Add modal-level protection for dirty profile edits.
- Preserve a profile draft across tab changes, or keep the profile editor mounted.
- Add Creator query error and retry handling.
- Add focused regression proof for dirty drafts and query errors.

Acceptance:

- A profile edit is not lost when the user changes tabs.
- Close, Escape, profile navigation, and destructive navigation do not silently discard a dirty draft.
- A failed Creator query shows an error and retry action.

## Slice 2: Creator Workspace Navigation

Scope:

- Replace the flat tab list with grouped Creator, Publishing, Interaction, Memory, Tools, and Danger navigation.
- Split overloaded Identity and Publishing content into task-based sections.
- Keep existing setting deep links mapped to their new sections.
- Add section-level status markers where the existing data supports them.

Acceptance:

- Profile, appearance, discovery, automation, content rules, production, and collaborations have clear homes.
- Existing Backstage search anchors still open the correct section.
- The destructive action is visually and structurally separate.
- Keyboard navigation remains correct for the grouped navigation.

## Slice 3: Save And Inheritance Consistency

Scope:

- Standardize inherited versus custom presentation.
- Add persistent local save status for immediate-save controls where practical.
- Keep explicit draft-save controls distinct from immediate-save controls.
- Add consistent loading, empty, and error states for section queries.

Acceptance:

- The effective value and override state are visible for inherited settings.
- Save failures remain visible long enough for recovery.
- No control appears enabled while its required data is unavailable.

## Slice 4: Creator Directory

Scope:

- Reorder the directory around search, filter, attention, and roster workflows.
- Make primary and secondary actions distinct.
- Improve responsive Creator rows and attention reason labels.
- Preserve continuity access and existing filters.

Acceptance:

- Add Creator is the clear primary action.
- Attention rows explain the reason without requiring a modal open.
- Desktop and mobile rows retain useful status and schedule information.

## Slice 5: Bulk Edit

Scope:

- Present bulk edit as an explicit selected-Creator workspace.
- Show pending changes before confirmation.
- Clarify leave-unchanged and override behavior.
- Preserve server limits, confirmation, result counts, and error handling.

Acceptance:

- The user can see the exact patch before applying it.
- Empty patches cannot be submitted.
- Partial results remain visible.

## Validation

Run after each source slice:

```text
npx tsx --tsconfig tests/tsconfig.regressions.json tests/slurp2-architecture.regression.ts
node scripts/typecheck-packages.mjs slurp2
```

Run affected regressions and `git diff --check` after each slice. Run the maintained-source checks and
the full relevant regression set before the final review. Rebuild generated Slurp2 payloads only after
the source slices are complete.

## Known Risks

- The existing profile form owns local draft state and currently unmounts when its tab changes.
- The modal uses both explicit-save and immediate-save controls.
- Creator settings combine Creator-wide, viewer-specific, world-inherited, and source-identity data.
- Generated package outputs must not be edited by hand.
