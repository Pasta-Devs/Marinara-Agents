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
- Updated by: Slice 3 implementation agent
- Overall state: Slice 3 implemented and validated; ready for draft PR review
- Active slice: 3 (server routes), issue #915, branch `slurp2-slice3-server-routes` from
  `modular-simping` `92c25f9c` (0 behind `origin/staging` after fetch; no merge needed)
- Issue: #914 (assigned `Gunterlie`)
- Pull request: draft #916 targets `modular-simping`, assigned to `Gunterlie`. Slices 0–1 and 2
  were pushed directly to the integration branch at the maintainer's request.
- Branch: `origin/modular-simping` is the integration branch (local name
  `refactor/slurp2-module-safety-rails`); based on
  `origin/staging` `e92684d1`. Slice 0–1 commit `29ff6ec2`; Slice 2 is the commit after the ledger
  update `f22f46fa`.
- Package version: `0.0.26` (integration-only; `staging` stays at `0.0.22` until the final `0.1.0`
  release PR)
- Generated artifact: `artifacts/slurp2-0.0.26.zip`, sha256
  `4c12215dafb2178925b374f580b7b8eee4be3d7089db8d39c22cfceb2b09aff4`, 6707553 bytes
- Node: `/home/dev/.nvm/versions/node/v24.18.0/bin`; `node -v` = `v24.18.0`
- Engine source: `/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`, branch
  `welcome-to-the-agentshop`, commit `fdb67d47b`, tracked files clean; 4 ahead / 0 behind
  `origin/staging` after a fresh fetch. Used unchanged.

## Slice ledger

| Slice | Name | State | Issue / PR | Package version | Evidence / handoff |
|---:|---|---|---|---|---|
| 0–1 | Architecture contract and safety rails | in progress | #914 / no PR yet | 0.0.24 | Validated locally; on `modular-simping` |
| 2 | Entrypoints and shared base | in progress | #914 / no PR | 0.0.25 | Validated locally; stacked on 0–1 on `modular-simping` |
| 3 | Server routes | ready for review | #915 / #916 | 0.0.26 | 179-route multiset preserved; draft PR to `modular-simping` |
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
| 2026-09-18 | 2 | `scripts/validate-package-locale-keys.mjs` skips a package whose catalog is absent at the Engine path, so moving Slurp2's locales would have silently disabled the check. | The script now also reads `client/src/slp/locales/en.json`; a removed-key mutant is reported. |
| 2026-09-18 | 2 | `validate-catalog.mjs` required every legacy-owned path to exist in the Slurp2 source tree. | Its Slurp2 list now drops the moved client entry and adds the three `slp` roots. |
| 2026-09-18 | 2 | Two passing-or-baseline tests assert the server entry's relative import specifiers (`slurp-table-registration`, `slurp-boundary`). | Only the path inside those two regexes changed (`../../db/…` → `../db/…`, `./slurp-refresh-…` → `../services/slurp/slurp-refresh-…`); what is asserted is unchanged. |
| 2026-09-18 | 2 | The browser runner's `pnpm install` synced the Engine worktree's ignored `node_modules`. Builds after that give `server.mjs` 2954647 bytes (same as staging's 0.0.22); the 0.0.24 build before it gave 2746627. | The earlier "Engine drift" was stale Engine `node_modules`, not the Engine commit. 0.0.25 is built with synced dependencies. |
| 2026-09-18 | release | Maintainer decision: users must not receive intermediate refactor versions. | `modular-simping` is the integration branch; slices use `0.0.x` there; one final PR to `staging` ships `0.1.0`. Plan §7, slice prompt, package `AGENTS.md`, and `DECISIONS.md` updated. |
| 2026-09-18 | 3 | The two route files contain 179 HTTP registrations plus one ZIP content-type parser. Long-lived state includes the viewer cache, backup/restore maps and sweep timer, improvement-job set, and commission request sets. | Added an exact route-multiset regression. The entry creates shared route dependencies once. Each long-lived state owner also has one construction site. |

## Pending decisions

None.

## Latest validation

### Slice 3 (0.0.26)

Split `slurp.routes.ts` and `slurp-messages.routes.ts` into 33 files under `server/src/slp/base/`,
`features/`, and `workflows/`. The server entry creates the route host and viewer context once and
mounts feature routes in their original order. The improvement runner, backup engine, notification
read model, and world catch-up coordinator now live in their planned modules. The old route files
are deleted and their ownership entries are removed. No Slice 4 storage source moved.

Preservation proof: `tests/slurp2-route-inventory.regression.ts` records the exact 179 HTTP method
and path registrations plus the ZIP parser. It passes on the real tree and fails when one route is
changed. Historical route source keys now concatenate the moved files through
`tests/slurp2-source.ts`; affected assertion bodies are unchanged. The largest new source file is
672 lines, below the 800-line limit. The package typecheck and architecture regression pass.

Generated release unit: built with Node `v24.18.0`, `TMPDIR=/home/dev/.cache/slp-tmp`, and
`MARINARA_ENGINE_ROOT=/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`. Engine branch
`welcome-to-the-agentshop`, commit `fdb67d47b`, tracked files clean, 4 ahead / 0 behind
`origin/staging`; used unchanged. The ZIP has the six declared files. Every manifest payload hash
and byte count matches. All three catalog lanes record artifact sha256
`4c12215dafb2178925b374f580b7b8eee4be3d7089db8d39c22cfceb2b09aff4` and 6707553 bytes.

Results:

- `tsx --tsconfig tests/tsconfig.regressions.json tests/slurp2-route-inventory.regression.ts`,
  `tests/slurp2-architecture.regression.ts`, and `tests/slurp2-release-notes.regression.ts` — pass.
- `npm run check` — pass (0 errors, 196 warnings).
- `node scripts/typecheck-packages.mjs slurp2` — pass.
- `npm run test:noodle:regressions` — exit 1 at the recorded pre-existing
  `noodler-content-formats` failure. The per-file pass/fail set and first errors match the clean
  staging baseline recorded for Slices 0–1.
- `npm run test:browser:slurp2` — Engine desktop and mobile servers became ready, then all 14 cases
  stopped before test execution because Chromium cannot load host library `libnspr4.so`.
- `node scripts/test-catalog-lanes.mjs`, `validate-package-locales.mjs`,
  `validate-package-locale-keys.mjs`, `validate-catalog.mjs`,
  `tests/catalog-release-notes.regression.mjs`, and `git diff --check` — pass.
- Live install, update, restart, offline restart, and uninstall tests were not performed. Draft PR
  human verification boxes remain unchecked.

### Slice 2 (0.0.25)

Moved with `git mv` (100% renames, content unchanged except import specifiers in the two entries):

- `client/src/slurp-package-entry.tsx` → `client/src/slp/slp-client-entry.tsx`
- `server/src/services/slurp/server-entry.ts` → `server/src/slp/slp-server-entry.ts`
- `shared/src/slurp-autopurge-time.ts` → `shared/src/slp/slp-autopurge-time.ts` (five importers
  updated)
- `client/src/localization/locales/{en,de,ko,pl}.json` → `client/src/slp/locales/` (keys and bytes
  unchanged)

Ownership: added `packages/{client,server,shared}/src/slp`; removed the client entry, the
`localization/locales` entry, and the shared autopurge entry. `services/slurp` stays owned (other
live files); the package-store entry stays until Slice 7. Descriptor `serverImport`/`clientImport`
now point at the `slp` entries. Legacy Slurp's list is unchanged.

Tests: `tests/slurp2-source.ts` maps the seven historical keys to the new files; 16 test files had a
read call routed through it; `slurp2-autopurge` import path and `slurp2-branding` locale directory
updated; the two import-specifier regexes above updated.

Preservation proof: the Slice 1 commit rebuilt against the same Engine state gives a byte-identical
`server.mjs`; `client.js` differs only in minified names and the release-notes literal (compared
with short names normalised). No `slp` or `localization` snapshot appears in `sources/engine`.

Results (Node `v24.18.0`, same Engine):

- architecture, typecheck-modules, release-notes, table-registration, autopurge, locale-keys,
  branding regressions — pass.
- `npm run check` — pass (0 errors).
- `node scripts/typecheck-packages.mjs slurp2` — pass.
- `npm run test:noodle:regressions` — exit 1 at the pre-existing `noodler-content-formats`
  failure; per-file pass/fail set identical to the staging baseline (19 pre-existing failures), the
  pre-existing failures' first errors unchanged.
- `npm run test:browser:slurp2` — not rerun; host still lacks `libnspr4.so`.
- `node scripts/test-catalog-lanes.mjs`, `validate-package-locales.mjs`,
  `validate-package-locale-keys.mjs`, `validate-catalog.mjs` (`v2=38, v3=38`),
  `tests/catalog-release-notes.regression.mjs`, `git diff --check` — pass.
- ZIP holds the six declared files. The builder wrote manifest, payloads, ZIP, catalog lanes, and
  notes. Live install/update/restart/offline/uninstall testing: not performed.

### Slices 0–1 (0.0.24)

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

1. Review and merge draft PR #916 into `modular-simping` after its checks and human verification
   complete. Do not start Slice 4 until PR #916 is merged and green because Slice 4 is the storage
   point of no return.
2. After Slice 10, open the final PR `modular-simping` → `staging` as Slurp2 `0.1.0` (one changelog
   entry, integration-only `0.0.x` ZIPs removed, one rebuild, full live lifecycle proof).
