# Slurp Modular Refactor — Status

This is the living execution ledger for `SLURP-MODULE-PLAN.md`.

## Update protocol

Every implementation agent must update this file:

1. after reading the plan and verifying repository state, before changing implementation files;
2. after any discovery that affects scope, risk, ordering, or validation;
3. before every handoff or final response.

Use evidence, not optimistic checkmarks. Record commands and outcomes precisely. Do not edit the
plan merely to show progress. Update the plan only for a verified factual correction or an approved
architectural decision. Record an unapproved design deviation under **Pending decisions** and do not
implement it silently.

Allowed slice states: `not started`, `in progress`, `blocked`, `ready for review`, `merged`.

## Current state

- Last updated: 2026-09-18
- Updated by: Slice 0–1 implementation agent
- Overall state: Slice 0–1 implemented and validated locally; committed on the branch, not pushed
- Active slice: 0–1 (combined)
- Issue: #914 (assigned `Gunterlie`)
- Pull request: none — the maintainer approved the issue only. Open a draft PR to `staging`,
  assigned to `Gunterlie`, after the maintainer approves it.
- Branch: `refactor/slurp2-module-safety-rails`, created from `origin/staging` at `e92684d1`
- Package version: `0.0.24` (staging was `0.0.22`; `0.0.23` was skipped, see discoveries)
- Generated artifact: `artifacts/slurp2-0.0.24.zip`, sha256
  `945e245c4748afc7ff0d36ea6d8741812e8804a7aa7048b6c35abbf1bf2cdc04`, 6464540 bytes
- Node: `/home/dev/.nvm/versions/node/v24.18.0/bin` prepended to PATH; `node -v` = `v24.18.0`
- Engine source: `/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`, branch
  `welcome-to-the-agentshop`, commit `fdb67d47b`, clean; 4 ahead / 0 behind `origin/staging`
  (`70f83886f`) after fetch. Used unchanged. The browser runner synced its ignored `node_modules`
  and `.pnpm/` to its own lockfile; tracked files stayed clean.

## Slice ledger

| Slice | Name | State | Issue / PR | Package version | Evidence / handoff |
|---:|---|---|---|---|---|
| 0–1 | Architecture contract and safety rails | in progress | #914 / no PR yet | 0.0.24 | Validated locally; awaiting PR approval |
| 2 | Entrypoints and shared base | not started | — | — | Depends on 0–1 merged |
| 3 | Server routes | not started | — | — | Depends on Slice 2 merged |
| 4 | Server storage | not started | — | — | Point of no return |
| 5 | Server services, contracts, workflows | not started | — | — | — |
| 6 | Event and modifier seam | not started | — | — | — |
| 7 | Client state and hooks | not started | — | — | — |
| 8 | Client app and reusable modules | not started | — | — | — |
| 9 | Backstage | not started | — | — | — |
| 10 | Final architecture and package proof | not started | — | — | — |

## Verified baseline

- `SLURP-MODULE-MAP.md` contains the current domain inventory and monolith extraction map.
- `SLURP-MODULE-PLAN.md` is the current architecture and migration source of truth.
- No implementation source has been changed for this refactor.
- The planning documents are untracked at last inspection. The initial PR must add
  `SLURP-MODULE-MAP.md`, `SLURP-MODULE-PLAN.md`, this status ledger, and both reusable slice prompts.
  The obsolete Step 1/Step 2 research prompts remain local unless the maintainer requests them.
- The last observed branch was behind current `origin/staging`; fetch and rebase or recreate from
  current staging before implementation.
- `/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish` is the maintainer-provided preferred Engine
  staging worktree. It was clean on branch `welcome-to-the-agentshop` at commit `fdb67d47b` during
  the last inspection. Reverify it and its relationship to `origin/staging` before every build.
  Fetch/integrate newer staging only when needed and only while clean; never reset, rebase, force,
  or discard its local commits.
- `/home/dev/projects/Marinara-Engine` had unrelated local modifications at last inspection. Do not
  overwrite, clean, or build from it unless its owner first clears it.
- Node was not available on the non-interactive shell PATH at last inspection. Resolve Node 24+
  before claiming validation.

## Material discoveries

| Date | Slice | Discovery | Consequence |
|---|---:|---|---|
| 2026-09-18 | planning | Slurp2 spreads legacy Slurp's ownership list. | Inline Slurp2 ownership before changing paths; never edit the legacy list. |
| 2026-09-18 | planning | Garnish is present in generic `sources/engine`. | Claim it in Slice 1 and verify the builder scrubs the generic snapshot. |
| 2026-09-18 | planning | Package typecheck ignores TS2307. | Add unresolved-module diagnostics before moving imports. |
| 2026-09-18 | planning | 123 of 142 Slurp2 tests read source text. | Add the logical source helper before moving monoliths. |
| 2026-09-18 | planning | Cross-feature timed effects must be restart-safe. | Use pure typed modifiers; do not mutate and later restore stored values. |
| 2026-09-18 | 0–1 | Only one custom-emoji file (`lib/slurp-custom-emojis.ts`) had an ownership entry; the hook never did. Both files import only each other; zero other importers in `packages/*/src`, `sources/engine`, `tests`. | Deleted both; removed only the one lib entry. |
| 2026-09-18 | 0–1 | The builder never removed an existing snapshot for a newly owned path: capture skips owned paths but only `localization/locales` was scrubbed. Only Slurp2 imports Garnish. | Builder now also scrubs `services/garnish-ads` on a Slurp2 build; `validate-catalog.mjs` asserts it stays absent from `sources/engine`. |
| 2026-09-18 | 0–1 | Unfiltered TS2307 reports 452 lines: the overlay installs no dependencies (bare specifiers) and `sources/engine` lacks five Engine host modules. | TS2307 is reported for relative specifiers only, minus five named host targets. Bare-specifier checking is a recorded ponytail ceiling. |
| 2026-09-18 | 0–1 | Verified source-reader count is 91 test files reading a monolith, plus the `slurp2BackstageSource()` aggregate (26 consumers), not the historical 102. `slurp2-backstage-anchors`, `slurp2-settings-blank-panel`, `slurp2-manual-refresh` read individual Backstage pages (Slice 9 scope); `slurp2-simulation-estimate` only names a monolith in a comment; `slurp-phase1-durability` imports storage as a module (Slice 4 scope). | Converted 91 files and routed the aggregate helper; plan count corrected. |
| 2026-09-18 | 0–1 | Baseline: 19 regression files already fail on clean `origin/staging` `e92684d1` (3 noodler, 12 slurp, 4 slurp2). `npm run test:noodle:regressions` therefore exits at its first failure on staging. | Pass/fail set compared per file before and after conversion: identical. |
| 2026-09-18 | 0–1 | `/tmp` tmpfs was 95% full. | Builds and checks run with `TMPDIR=/home/dev/.cache/slp-tmp`. |
| 2026-09-18 | 0–1 | `artifacts/slurp2-0.0.23.zip` is tracked on staging from `cf2529df` (release v0.0.23), later rolled back to 0.0.22 by `2e742396` without removing the ZIP. | Rebuilding as 0.0.23 would overwrite a published artifact with different bytes; used 0.0.24. |
| 2026-09-18 | 0–1 | Release-notes validation needs a changelog entry for every published version, including patches; the splash mirror in `slurp2-release.ts` must match the 20-entry changelog cap. | Added a 0.0.24 entry; dropped the rolled-off 0.0.3 from the splash mirror; extended `slurp2-release-notes.regression.ts` for 0.0.24. |
| 2026-09-18 | 0–1 | Staging's committed 0.0.22 bundle was built against another Engine. Clean staging rebuilt against `shy-lionfish` gives a byte-identical `server.mjs` to this branch; `client.js` differs only in release notes. | Bundle-size change (server 2954647 → 2746627) is Engine drift, not this slice. |
| 2026-09-18 | 0–1 | Host lacks `libnspr4.so`; Playwright Chromium cannot launch. | `npm run test:browser:slurp2` could not run locally; needs CI or a host with Playwright system deps. |

## Pending decisions

None.

## Latest validation

Environment: Node `v24.18.0`, `TMPDIR=/home/dev/.cache/slp-tmp`,
`MARINARA_ENGINE_ROOT=/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish` (`fdb67d47b`).

Focused:

- `tsx --tsconfig tests/tsconfig.regressions.json tests/slurp2-architecture.regression.ts` — pass.
  Valid fixture passes; 15 negative fixtures each rejected (direction ×3, contract ×2,
  client↔server, shared, layer, naming ×2, barrel, size, slp file outside roots, unowned root,
  unowned Garnish). Mutation check: disabling each of 8 rule branches makes the regression fail.
- `tests/slurp2-typecheck-modules.regression.ts` — pass with the new checker; fails with the
  staging checker (proves TS2307 is new coverage).
- `tests/slurp2-release-notes.regression.ts` — pass.

Baseline:

- `npm run check` — pass (0 errors; 197 warnings, pre-existing style).
- `node scripts/typecheck-packages.mjs slurp2` — pass: "no undefined names or unresolved modules".
  `npm run typecheck:packages` (all five packages) — pass.
- `npm run test:noodle:regressions` — exit 1 at `noodler-content-formats`, a pre-existing failure.
  Per-file run: 19 files fail on this branch and the same 19 fail on clean `origin/staging`
  `e92684d1`; every other file passes, plus the two new regressions.
- `npm run test:browser:slurp2` — not run to completion: Chromium cannot load `libnspr4.so` on this
  host (environment gap, not a test failure).
- `node scripts/test-catalog-lanes.mjs` — pass.
- `node scripts/validate-package-locales.mjs` — pass.
- `node scripts/validate-catalog.mjs` — pass (`v2=38, v3=38; legacy=v2`).
- `node scripts/tests/catalog-release-notes.regression.mjs` — pass.
- `git diff --check` — pass.

Generated output (builder only, no hand edits):

- `node scripts/build-feature-packages.mjs slurp2` rewrote `packages/slurp2/{server.mjs,client.js,
  manifest.json}`, added `artifacts/slurp2-0.0.24.zip`, and updated `catalog/{,v2/,v3/}catalog.json`
  and `notes.json`.
- ZIP holds exactly `manifest.json`, `agents.json`, `server.mjs`, `client.js`, `slurp2-logo.png`,
  `slurp2agent.png`; every manifest sha256 and byte size matches the extracted file.
- The builder removed all six `sources/engine/packages/server/src/services/garnish-ads/*` files.
- Live install/update/restart/offline/uninstall testing: not performed.

## Next action

1. Maintainer: approve pushing `refactor/slurp2-module-safety-rails` and opening the draft PR to
   `staging` (assign `Gunterlie`, link #914, leave verification boxes unchecked). Let CI run the
   browser job.
2. After merge, start Slice 2 (entrypoints and shared base) from `SLURP-MODULE-SLICE.prompt.md`: move
   the entrypoints, autopurge time module, and locales into the `slp` roots, add the three root
   ownership entries, update the descriptor, and let the architecture regression check the new files.
