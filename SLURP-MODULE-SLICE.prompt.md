# Base Prompt: Implement One Slurp Modular Refactor Slice

Replace every `<...>` field before handing this prompt to an implementation agent.

## Task

Implement only Slice `<SLICE_NUMBER>` — `<SLICE_NAME>` — from `SLURP-MODULE-PLAN.md`.
Do not begin the next slice.

## Context

The Slurp2 modular refactor is governed by:

- `SLURP-MODULE-PLAN.md` — architecture, invariants, target tree, and ordered migration;
- `SLURP-MODULE-STATUS.md` — live execution state and handoff evidence;
- `SLURP-MODULE-MAP.md` — original domain inventory and monolith extraction map;
- `packages/slurp2/AGENTS.md` — mandatory package-specific agent rules;
- `packages/slurp2/docs/architecture/` — permanent architecture guidance.

Read all of them completely, plus root `AGENTS.md`, `.github/agents/chai-workflow.md`,
`CONTRIBUTING.md`, the Slurp2 manifest/changelog, builder definition, affected sources, and affected
tests before editing.

## Start protocol

1. Fetch `origin/staging` and `origin/modular-simping` (the integration branch). Verify the previous
   slice was merged into `modular-simping` through its PR and its generated package/catalog outputs
   are present. Merge `origin/staging` into `modular-simping` with an ordinary merge if it is behind;
   rebuild generated outputs rather than hand-resolving their conflicts.
2. Inspect branch, upstream, worktree, issue/PR state, current package version, Node 24+, and the
   preferred Engine worktree at `/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`. Record its
   branch, commit, cleanliness, and relationship to `origin/staging`. Preserve unrelated work.
3. Open/link the slice issue and draft PR targeting `modular-simping` (never `staging`; only the
   final release PR targets `staging`), both assigned to `Gunterlie`, per repository workflow. Every
   slice must merge through its own PR. Do not push slice commits directly to `modular-simping`.
   Never mark human verification checkboxes yourself.
4. Update `SLURP-MODULE-STATUS.md` to `in progress` with the verified coordination and environment
   details before implementation.
5. Re-derive every path/count named by this slice from the current tree. Treat old line numbers as
   navigation hints, not truth.
6. Use the preferred Engine worktree as-is when clean and current enough. If newer staging is
   required, fetch `origin staging` and integrate `origin/staging` without reset, rebase, force, or
   loss of local commits: fast-forward when possible, otherwise ordinary-merge only while clean. If
   dirty or conflicted, leave it untouched and create/select a clean substitute worktree, recording
   that path and commit in status.

## Slice scope

Implement exactly the deliverables under Slice `<SLICE_NUMBER>` in the plan.

Additional slice-specific instructions:

```text
<SLICE_SPECIFIC_INSTRUCTIONS_OR_NONE>
```

Do not opportunistically clean up adjacent code, rename persisted/public identifiers, redesign UI,
add dependencies, introduce compatibility shims, or begin later slices.

## Plan and status discipline

- The plan is architectural truth; the status file is the progress ledger.
- Update status after material discoveries and before every handoff/final response.
- Correct the plan only for verified factual errors or maintainer-approved architectural changes.
- Record an unapproved design question under **Pending decisions**, stop at that boundary, and
  continue any unaffected in-scope work.
- If the slice changes paths, update the transitional ownership ledger in the same commit: add a
  new root when its first file moves and remove an old entry only after its last live file moves.

## Required preservation proof

- Identify this slice's pre-move invariant before editing.
- Add or adapt the smallest regression that would fail if the invariant changed.
- Preserve source-text tests through `tests/slurp2-source.ts`; do not weaken or delete assertions
  because a file moved.
- Run `tests/slurp2-architecture.regression.ts` and keep all new-root files within dependency,
  naming, barrel, ownership, and size rules.
- For executable payload changes, bump the integration `0.0.x` patch version once, rebuild from an explicit clean
  Engine checkout using
  `MARINARA_ENGINE_ROOT=/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish` or the recorded clean
  substitute, and commit the complete generated release unit. Never hand-edit generated files.

## Acceptance criteria

- [ ] Every deliverable for Slice `<SLICE_NUMBER>` is complete.
- [ ] No later-slice work or unrelated cleanup is included.
- [ ] Existing API routes, persisted data, locale keys, package identity, and external contracts are
      unchanged unless this slice explicitly says otherwise.
- [ ] Transitional ownership exactly covers all live package-specific source.
- [ ] Focused regressions prove this slice's preservation invariants.
- [ ] Architecture regression passes without adding a permanent exception.
- [ ] Generated payload, manifest, artifact, catalogs, hashes, sizes, and ZIP contents agree.
- [ ] Status ledger contains reproducible evidence and the exact next-slice handoff.
- [ ] The slice is ready to merge through its PR into `modular-simping`; it was not merged directly.

## Validation

Run focused tests first, then the applicable complete gate:

```text
npm run check
node scripts/typecheck-packages.mjs slurp2
npm run test:noodle:regressions
npm run test:browser:slurp2
node scripts/test-catalog-lanes.mjs
node scripts/validate-package-locales.mjs
node scripts/validate-catalog.mjs
node scripts/tests/catalog-release-notes.regression.mjs
git diff --check
```

For client/UI changes, perform proportionate dev-instance browser proof with screenshots and error
inspection. For package lifecycle or storage changes, exercise install/update, activation, restart,
offline restart, and uninstall as applicable. Never use production `ssh marinara`.

Before opening or updating external issue/PR text, follow the live repository templates and preserve
human checkbox state. Do not claim tests, review, or manual verification that did not occur.

## Final handoff

Update `SLURP-MODULE-STATUS.md` with:

- slice state and completion date;
- issue, PR, branch, commits, and push state;
- package version and artifact filename;
- files/modules moved and ownership entries changed;
- exact commands and pass/fail results;
- generated-output and live-test evidence;
- Engine source path, branch, commit, cleanliness, and staging-integration action;
- blockers, remaining risks, plan corrections, and pending decisions;
- the one exact next action for Slice `<NEXT_SLICE_NUMBER>`.

Update `SLURP-MODULE-PLAN.md` only when the architecture or a verified repository fact changed.
Do not begin Slice `<NEXT_SLICE_NUMBER>`.
