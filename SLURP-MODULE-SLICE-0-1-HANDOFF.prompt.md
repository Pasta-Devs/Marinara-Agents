# Handoff: Implement Slurp Modular Refactor Slices 0 and 1

## Task

Implement only Slices 0 and 1 of the Slurp modular refactor as one initial safety-rails PR. Do not
move live Slurp implementation modules into the new architecture yet.

## Context

Slurp2 grew from legacy Noodle/Slurp code and now contains very large route, storage, hook, and UI
files plus a flat service directory. The approved refactor introduces package-owned `slp` roots,
feature-first modules, explicit cross-feature contracts/workflows, and enforced architecture rules.

The full architecture and sequence are in `SLURP-MODULE-PLAN.md`. The current execution state is in
`SLURP-MODULE-STATUS.md`. Treat the plan as architecture truth and the status file as the living
ledger.

Slices 0 and 1 are combined because their documentation, architecture regression, source-map
helper, ownership correction, and typecheck correction are mutually reinforcing prerequisites.

## Current state

- Planning is complete; no refactor implementation source or generated package output has changed.
- At last inspection Slurp2 was `0.0.22`, the active Agents branch was behind current
  `origin/staging`, and Node was absent from the non-interactive shell PATH. Reverify these facts
  instead of assuming they remain true.
- The preferred Engine source is `/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`. At last
  inspection it was clean on `welcome-to-the-agentshop` at `fdb67d47b`, which already included a
  staging merge. Reverify its status and staging relationship before building.
- The plan, map, status ledger, and reusable prompts are currently untracked and must be deliberately
  added by this initial PR. The superseded Step 1/Step 2 research prompts stay local.

## What was tried

- A first boundary-map pass inventoried the package and five monoliths.
- An older Step 2 plan kept code scattered across Engine technical folders; it was rejected because
  it did not provide a durable Slurp namespace or clean cross-feature extension seams.
- No implementation attempt, partial move, failed build, or generated-output edit has occurred.

## Decisions

- Use `client/src/slp`, `server/src/slp`, and a narrow `shared/src/slp` namespace.
- Keep progress in `SLURP-MODULE-STATUS.md`; change the plan only for verified facts or approved
  architecture changes.
- Combine Slices 0 and 1 into one initial PR; later slices remain separate PRs.
- Keep transitional ownership entries until the PR that moves their last live file.
- Do not move implementation modules, create compatibility shims, or add a real event modifier in
  this batch.

## Read first

Read completely before editing:

- `AGENTS.md`
- `.github/agents/chai-workflow.md`
- `CONTRIBUTING.md`
- `SLURP-MODULE-PLAN.md`
- `SLURP-MODULE-STATUS.md`
- `SLURP-MODULE-MAP.md`
- `scripts/build-feature-packages.mjs`
- `scripts/typecheck-packages.mjs`
- `packages/slurp2/manifest.json`
- `packages/slurp2/CHANGELOG.md`

Inspect the current branch, upstream, worktree, issue/PR state, current staging package version, and
the preferred Engine worktree. Preserve unrelated and untracked work.

## Coordination

1. Work from current `origin/staging`, not the historical branch state recorded in the status file.
2. Open or link an issue, assigned to `Gunterlie`.
3. Open a draft PR targeting `staging`, assigned to `Gunterlie`, when implementation begins, per
   repository workflow. Keep human verification checkboxes unchecked.
4. Before changing implementation files, update `SLURP-MODULE-STATUS.md` with `in progress`, issue,
   PR, branch, verified package version, Engine path/branch/commit/status, and Node path.
5. If repository truth contradicts the plan, record the evidence in the status file. Correct the
   plan only for a proven factual error. Do not make an unapproved architectural deviation.
6. Prefer `/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish` for Engine-derived builds. If it is
   clean and current enough, use it as-is. If newer staging is necessary, fetch `origin staging`
   and integrate `origin/staging` without reset, rebase, force, or dropping local commits:
   fast-forward when possible, otherwise use an ordinary merge only while clean. If dirty or
   conflicted, leave it untouched and create/select a different clean Engine worktree.

## Slice 0 deliverables: architecture contract

Create:

```text
packages/slurp2/AGENTS.md
packages/slurp2/docs/architecture/README.md
packages/slurp2/docs/architecture/ADDING-A-MODULE.md
packages/slurp2/docs/architecture/DECISIONS.md
tests/slurp2-architecture.regression.ts
```

Add these already-prepared refactor records to version control in the same PR:

```text
SLURP-MODULE-MAP.md
SLURP-MODULE-PLAN.md
SLURP-MODULE-STATUS.md
SLURP-MODULE-SLICE-0-1-HANDOFF.prompt.md
SLURP-MODULE-SLICE.prompt.md
```

Do not add `SLURP-MODULE-PLAN-STEP1.prompt.md` or `SLURP-MODULE-PLAN-STEP2.prompt.md`; they are
superseded research prompts, not ongoing instructions.

Requirements:

- `packages/slurp2/AGENTS.md` must require future agents to read the architecture guide, follow the
  root repository workflow, run architecture validation, rebuild generated package outputs when
  payload source changes, and update the status ledger.
- The architecture docs must reflect Sections 2–6 of `SLURP-MODULE-PLAN.md`; do not invent a second
  architecture.
- Record the approved feature-first refactor as the first dated decision.
- The architecture regression must enforce new-root dependency direction, contract-only
  cross-feature imports, ownership exceptions, `slp-`/`Slp` filenames, no generic `index.ts`
  barrels, shared-layer direction, and an 800-line hard ceiling with generated files/locales
  excluded.
- The regression may tolerate currently absent new roots, but it must prove each rule against
  temporary negative fixtures so the initial green result is not vacuous.
- Add it to the existing Slurp regression glob; do not introduce a new runner or dependency.

## Slice 1 deliverables: safety rails and ownership

1. Stop `slurp2OwnedSourcePaths` from spreading `slurpOwnedSourcePaths`. Inline Slurp2's complete
   current ownership set without changing legacy Slurp's array.
2. Add `packages/server/src/services/garnish-ads` to Slurp2 ownership.
3. Preserve every ownership entry for live source at its current path. Do not install the final
   five-entry ownership list early.
4. Confirm again that both custom-emoji files have zero importers, then delete:
   - `packages/slurp2/src/engine/packages/client/src/hooks/use-slurp-custom-emojis.ts`
   - `packages/slurp2/src/engine/packages/client/src/lib/slurp-custom-emojis.ts`
   Remove only their now-stale ownership entry.
5. Extend package typechecking to report TS2307 unresolved-module diagnostics as well as the existing
   TS2304/TS2552 undefined-name diagnostics. Keep ignored-global filtering specific to missing-name
   errors because TS2307 has a different capture shape.
6. Add a focused regression proving an unresolved package import fails the checker.
7. Add `tests/slurp2-source.ts`. It maps historical logical source paths to the current files and
   falls back to direct reads for unmapped paths.
8. Convert the verified 102 monolith/Backstage source-reading tests to this helper without changing
   assertion bodies or historical path strings. Initially each logical key reads the same current
   file set, so the helper is behaviour-neutral.
9. Do not move routes, storage, services, hooks, components, entrypoints, locales, or schema files.

## Package/release requirements

Because Slice 1 changes package source/ownership, derive the next patch version from current staging,
update the builder's Slurp2 version once, and run the focused feature-package builder with an
explicit `MARINARA_ENGINE_ROOT=/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`, or the clean
substitute recorded in the status ledger. Do not hand-edit generated files. A refactor-only patch
does not require a changelog entry unless repository validation says otherwise.

Confirm the complete generated unit: client/server payloads as applicable, manifest, artifact ZIP,
catalog lanes, hashes, sizes, and archive contents. Verify that the builder—not a manual deletion—
removes the contaminated generic Garnish snapshot.

## Acceptance criteria

- [ ] Package-level agent and architecture guidance exists and matches the approved plan.
- [ ] Architecture regression has positive coverage and negative fixtures for every enforced rule.
- [ ] Slurp2 ownership no longer spreads or mutates legacy Slurp ownership.
- [ ] Every still-live old source path remains owned during the transition.
- [ ] Garnish is Slurp2-owned and absent from generic Engine snapshots after rebuild.
- [ ] The two dead emoji files are gone only after importer re-verification.
- [ ] TS2307 is reported without breaking TS2304/TS2552 ignored-global behavior.
- [ ] The logical source helper preserves every converted assertion's effective input.
- [ ] No live implementation module was moved or behaviorally changed.
- [ ] Generated package/catalog outputs are builder-produced and internally consistent.
- [ ] `SLURP-MODULE-STATUS.md` records exact evidence and the Slice 2 handoff.

## Validation

Run focused new regressions first, then:

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

Inspect the generated ZIP and hashes. Do not claim live install, update, restart, offline, or
uninstall testing unless actually performed. This safety-only slice does not require production or
dev-box mutation unless a local browser/package test cannot provide the required proof.

## Handoff requirements

Before finishing:

- update `SLURP-MODULE-STATUS.md` with state, issue/PR, branch, commits, package version, artifact,
  exact validations and failures, generated-output status, plan corrections, blockers, and next
  action;
- update `SLURP-MODULE-PLAN.md` only if verified facts changed it;
- report any manual-test gaps honestly;
- do not start Slice 2 in this PR.
