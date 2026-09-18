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
- Updated by: Slice 5 implementation agent
- Overall state: Slice 5 ready for review
- Active slice: 5 (server services, contracts, workflows), issue #924, branch
  `slurp2-slice5-server-services` from `origin/modular-simping` `7b9ba1f3` (Slice 4 merge commit).
  `origin/staging` is an ancestor of that commit; no staging merge was needed.
- Pull request: draft #925 targets `modular-simping` and is assigned to `Gunterlie`; issue #924 is
  assigned to `Gunterlie`. Slice 4 PR #919 is merged. Commits: `254b9bd1` (refactor), `e77611f8`
  (Slice 4 fix), `aa60cd99` (rebuild and ledger), plus this ledger update.
- Package version: `0.0.28` (integration-only; `staging` stays at `0.0.22` until the final `0.1.0`
  release PR)
- Generated artifact: `artifacts/slurp2-0.0.28.zip`, sha256
  `90d890370f807e0353e45311071ffc534ddef6b50901f29bc7a3a26ba0ed4808`, 6722866 bytes
- Node: `/home/dev/.nvm/versions/node/v24.18.0/bin`; `node -v` = `v24.18.0`
- Engine source: `/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`, branch
  `welcome-to-the-agentshop`, commit `fdb67d47b`, tracked files clean; 4 ahead / 32 behind Engine
  `origin/staging` after a fresh fetch. Used unchanged; no Engine integration was performed.

## Slice ledger

| Slice | Name                                   | State            | Issue / PR       | Package version | Evidence / handoff                                               |
| ----: | -------------------------------------- | ---------------- | ---------------- | --------------- | ---------------------------------------------------------------- |
|   0–1 | Architecture contract and safety rails | in progress      | #914 / no PR yet | 0.0.24          | Validated locally; on `modular-simping`                          |
|     2 | Entrypoints and shared base            | in progress      | #914 / no PR     | 0.0.25          | Validated locally; stacked on 0–1 on `modular-simping`           |
|     3 | Server routes                          | ready for review | #915 / #916      | 0.0.26          | 179-route multiset preserved; CI failures match Slice 2 baseline |
|     4 | Server storage                         | merged           | #918 / #919      | 0.0.27          | Merged into `modular-simping` at `7b9ba1f3`                      |
|     5 | Server services, contracts, workflows  | ready for review | #924 / #925      | 0.0.28          | Layer model approved; 0 architecture violations; unit rebuilt    |
|     6 | Event and modifier seam                | not started      | —                | —               | —                                                                |
|     7 | Client state and hooks                 | not started      | —                | —               | —                                                                |
|     8 | Client app and reusable modules        | not started      | —                | —               | —                                                                |
|     9 | Backstage                              | not started      | —                | —               | —                                                                |
|    10 | Final architecture and package proof   | not started      | —                | —               | —                                                                |

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

| Date       |    Slice | Discovery                                                                                                                                                                                                                                                                                                                                                                                                                          | Consequence                                                                                                                                                                             |
| ---------- | -------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-18 | planning | Slurp2 spreads legacy Slurp's ownership list.                                                                                                                                                                                                                                                                                                                                                                                      | Inline Slurp2 ownership before changing paths; never edit the legacy list.                                                                                                              |
| 2026-09-18 | planning | Garnish is present in generic `sources/engine`.                                                                                                                                                                                                                                                                                                                                                                                    | Claim it in Slice 1 and verify the builder scrubs the generic snapshot.                                                                                                                 |
| 2026-09-18 | planning | Package typecheck ignores TS2307.                                                                                                                                                                                                                                                                                                                                                                                                  | Add unresolved-module diagnostics before moving imports.                                                                                                                                |
| 2026-09-18 | planning | 123 of 142 Slurp2 tests read source text.                                                                                                                                                                                                                                                                                                                                                                                          | Add the logical source helper before moving monoliths.                                                                                                                                  |
| 2026-09-18 | planning | Cross-feature timed effects must be restart-safe.                                                                                                                                                                                                                                                                                                                                                                                  | Use pure typed modifiers; do not mutate and later restore stored values.                                                                                                                |
| 2026-09-18 |      0–1 | Only one custom-emoji file (`lib/slurp-custom-emojis.ts`) had an ownership entry; the hook never did. Both files import only each other; zero other importers in `packages/*/src`, `sources/engine`, `tests`.                                                                                                                                                                                                                      | Deleted both; removed only the one lib entry.                                                                                                                                           |
| 2026-09-18 |      0–1 | The builder never removed an existing snapshot for a newly owned path: capture skips owned paths but only `localization/locales` was scrubbed. Only Slurp2 imports Garnish.                                                                                                                                                                                                                                                        | Builder now also scrubs `services/garnish-ads` on a Slurp2 build; `validate-catalog.mjs` asserts it stays absent from `sources/engine`.                                                 |
| 2026-09-18 |      0–1 | Unfiltered TS2307 reports 452 lines: the overlay installs no dependencies (bare specifiers) and `sources/engine` lacks five Engine host modules.                                                                                                                                                                                                                                                                                   | TS2307 is reported for relative specifiers only, minus five named host targets. Bare-specifier checking is a recorded ponytail ceiling.                                                 |
| 2026-09-18 |      0–1 | Verified source-reader count is 91 test files reading a monolith, plus the `slurp2BackstageSource()` aggregate (26 consumers), not the historical 102. `slurp2-backstage-anchors`, `slurp2-settings-blank-panel`, `slurp2-manual-refresh` read individual Backstage pages (Slice 9 scope); `slurp2-simulation-estimate` only names a monolith in a comment; `slurp-phase1-durability` imports storage as a module (Slice 4 scope). | Converted 91 files and routed the aggregate helper; plan count corrected.                                                                                                               |
| 2026-09-18 |      0–1 | Baseline: 19 regression files already fail on clean `origin/staging` `e92684d1` (3 noodler, 12 slurp, 4 slurp2). `npm run test:noodle:regressions` therefore exits at its first failure on staging.                                                                                                                                                                                                                                | Pass/fail set compared per file before and after conversion: identical.                                                                                                                 |
| 2026-09-18 |      0–1 | `/tmp` tmpfs was 95% full.                                                                                                                                                                                                                                                                                                                                                                                                         | Builds and checks run with `TMPDIR=/home/dev/.cache/slp-tmp`.                                                                                                                           |
| 2026-09-18 |      0–1 | `artifacts/slurp2-0.0.23.zip` is tracked on staging from `cf2529df` (release v0.0.23), later rolled back to 0.0.22 by `2e742396` without removing the ZIP.                                                                                                                                                                                                                                                                         | Rebuilding as 0.0.23 would overwrite a published artifact with different bytes; used 0.0.24.                                                                                            |
| 2026-09-18 |      0–1 | Release-notes validation needs a changelog entry for every published version, including patches; the splash mirror in `slurp2-release.ts` must match the 20-entry changelog cap.                                                                                                                                                                                                                                                   | Added a 0.0.24 entry; dropped the rolled-off 0.0.3 from the splash mirror; extended `slurp2-release-notes.regression.ts` for 0.0.24.                                                    |
| 2026-09-18 |      0–1 | Staging's committed 0.0.22 bundle was built against another Engine. Clean staging rebuilt against `shy-lionfish` gives a byte-identical `server.mjs` to this branch; `client.js` differs only in release notes.                                                                                                                                                                                                                    | Bundle-size change (server 2954647 → 2746627) is Engine drift, not this slice.                                                                                                          |
| 2026-09-18 |      0–1 | Host lacks `libnspr4.so`; Playwright Chromium cannot launch.                                                                                                                                                                                                                                                                                                                                                                       | `npm run test:browser:slurp2` could not run locally; needs CI or a host with Playwright system deps.                                                                                    |
| 2026-09-18 |        2 | `scripts/validate-package-locale-keys.mjs` skips a package whose catalog is absent at the Engine path, so moving Slurp2's locales would have silently disabled the check.                                                                                                                                                                                                                                                          | The script now also reads `client/src/slp/locales/en.json`; a removed-key mutant is reported.                                                                                           |
| 2026-09-18 |        2 | `validate-catalog.mjs` required every legacy-owned path to exist in the Slurp2 source tree.                                                                                                                                                                                                                                                                                                                                        | Its Slurp2 list now drops the moved client entry and adds the three `slp` roots.                                                                                                        |
| 2026-09-18 |        2 | Two passing-or-baseline tests assert the server entry's relative import specifiers (`slurp-table-registration`, `slurp-boundary`).                                                                                                                                                                                                                                                                                                 | Only the path inside those two regexes changed (`../../db/…` → `../db/…`, `./slurp-refresh-…` → `../services/slurp/slurp-refresh-…`); what is asserted is unchanged.                    |
| 2026-09-18 |        2 | The browser runner's `pnpm install` synced the Engine worktree's ignored `node_modules`. Builds after that give `server.mjs` 2954647 bytes (same as staging's 0.0.22); the 0.0.24 build before it gave 2746627.                                                                                                                                                                                                                    | The earlier "Engine drift" was stale Engine `node_modules`, not the Engine commit. 0.0.25 is built with synced dependencies.                                                            |
| 2026-09-18 |  release | Maintainer decision: users must not receive intermediate refactor versions.                                                                                                                                                                                                                                                                                                                                                        | `modular-simping` is the integration branch; slices use `0.0.x` there; one final PR to `staging` ships `0.1.0`. Plan §7, slice prompt, package `AGENTS.md`, and `DECISIONS.md` updated. |
| 2026-09-18 |        3 | The two route files contain 179 HTTP registrations plus one ZIP content-type parser. Long-lived state includes the viewer cache, backup/restore maps and sweep timer, improvement-job set, and commission request sets.                                                                                                                                                                                                            | Added an exact route-multiset regression. The entry creates shared route dependencies once. Each long-lived state owner also has one construction site.                                 |
| 2026-09-18 |        5 | Slice 4 left `services/slurp/slurp-post-guidance.storage.ts` as a duplicate of `slp/base/settings/slp-post-guidance-storage.ts` (import paths differ only). Four services used the old copy; routes used the new one. | The Slice 5 move deletes the old copy and points its importers at the `slp` copy.                                                                                                        |
| 2026-09-18 |        5 | On `modular-simping` `7b9ba1f3`, 36 regression files fail (not 19). New since the ledger baseline: `slurp2-route-inventory` (entry now passes `{ db: app.db, noodle }`), `slurp2-release-notes` (`SLURP2_VERSION` still `0.0.26`, manifest `0.0.27`), and 14 files that read deleted Slice 4 storage paths with `readFileSync` instead of `slurp2Source`. | The Slice 4 ledger claims were not reproducible. Slice 5 compares per file against this 36-file baseline, not the 19-file one.                                                         |
| 2026-09-18 |        5 | Pure move of the 147 service files: package typecheck passes; the architecture regression reports 285 violations: 102 direction (57 imports of the entry-layer `slp-storage.ts` composition, 45 base→feature), 180 cross-feature, 3 size. 82 of the 147 files are pure domain rules (no DB, storage, Fastify, or model call); 124 of 176 cross-feature edges target those pure files. | The approved server layers cannot hold the current dependency graph without injection or exceptions. Recorded as a pending decision; implementation paused before commit.            |
| 2026-09-18 |        5 | Slice 4 regression (live on `modular-simping` `7b9ba1f3`): `compensate/claim/reset/settleSlurpPayment…ForDatabase` and `applySlurpTipEffectsForDatabase` became nested functions inside `createSlurpMessagesContext`, but the Slice 4 messages contract still re-exported them. esbuild drops an unresolved TypeScript re-export silently, so the build passes and `features/economy/slp-wallet-routes.ts` calls `undefined` in the profile-tip route. Slice 5 imports them directly, so the bundle now fails with "No matching export". | The profile tip (`walletEnabled`) throws at runtime on `modular-simping`. Needs a restoring fix before Slice 5 can build.                                                              |
| 2026-09-18 |        5 | Slice 4 regression: on `staging`, `messageUnlocks`, `directMessageTips`, `commissionOperations`, `paymentIntentClaims`, and `slurpDatabases` are module-level singletons. Slice 4 moved them inside `createSlurpMessagesContext`, and `createSlurpMessagesStorage` has about 20 per-call construction sites. In-process de-duplication of concurrent unlocks, tips, commissions, and payment claims no longer spans callers. | Breaks the "one construction site per long-lived state owner" invariant. Recorded as a pending decision with the fix above.                                                          |

## Pending decisions

1. **Resolved 2026-09-18 — server layer model.** The maintainer approved
   `base <- modules <- data <- features <- workflows <- entry` in one Slice 5 PR. Plan §3, the
   allocation ledger, the architecture guide, `DECISIONS.md`, and the regression now record it.
2. **Resolved 2026-09-18 — Slice 4 regressions.** The maintainer chose one labelled fix commit
   inside the Slice 5 PR (see Slice 5 validation).
3. **Open — three new server features.** The approved layer model moved routes and I/O out of
   `base/`, so `features/viewer/` (route host and viewer context), `features/media/` (image
   services and media routes), and `features/settings/` (settings routes) exist on the server only.
   The plan and guide name them. Confirm the names or choose others before Slice 9.
4. **Open — Slice 4 source-shape failures unmasked.** `slurp-commission-funnel` and
   `slurp-relationship-phase1` pass on `staging` and failed on `modular-simping` with `ENOENT`
   (hidden). With the reads routed, they fail on source regexes that Slice 4 broke (`storage.` became
   `context.storage.`; payment functions are nested and indented). Slice 5 did not weaken them.
   Decide whether to restore the source shape or re-express the assertions behaviourally.
5. **Open — client imports server rule files.** Twelve client files under `components/slurp/` and
   `hooks/use-slurp.ts` import server rule files directly (paths rewritten, behaviour unchanged).
   Slices 7–8 must route them through `shared/src/slp/` or a client module.

## Slice 5 start proof

- Slice 4 merge gate: PR #919 `MERGED` into `modular-simping` at `7b9ba1f3`; generated `0.0.27`
  payload, manifest, `artifacts/slurp2-0.0.27.zip`, and catalogs present.
- `origin/staging` is an ancestor of `origin/modular-simping`; no staging merge needed.
- Node: `/home/dev/.nvm/versions/node/v24.18.0/bin`, `v24.18.0`.
- Engine: `/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`, branch `welcome-to-the-agentshop`,
  commit `fdb67d47b`, tracked files clean, 4 ahead / 32 behind Engine `origin/staging` after a
  fresh fetch; to be used unchanged, as in Slices 0–4.
- Package version before the slice: `0.0.27`; this slice will use `0.0.28`.
- Service inventory re-derived: 148 files under `services/slurp/` (not 149): 147 to move plus the
  Slice 4 duplicate. The six `slurp-garnish-*` adapters go to `features/ads/`; generic
  `services/garnish-ads/` (6 files) stays.

## Slice 4 start proof

- Slice 3 merge gate: PR #916 is `MERGED` into `modular-simping` at `882e9783`; its generated
  `0.0.26` payload, manifest, ZIP, catalogs, and hashes are present.
- Integration branch: `origin/modular-simping` is 11 commits ahead and 0 commits behind
  `origin/staging`; no ordinary staging merge is required before this slice.
- Node: `/home/dev/.nvm/versions/node/v24.18.0/bin/node`, `v24.18.0`.
- Preferred Engine: `/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`, branch
  `welcome-to-the-agentshop`, commit `fdb67d47b`; tracked files clean; 4 ahead and 13 behind
  `origin/staging`; used unchanged for the baseline.
- Complete public method-name inventory is being recorded by `tests/slurp2-storage-methods.regression.ts`
  before the storage move. The current monolith is `slurp.storage.ts` (8,044 lines); satellite
  storage files are `slurp-messages.storage.ts` (3,010), `slurp-population.storage.ts` (439),
  `slurp-events.storage.ts` (179), and the existing reply, queue, host, error, and retention files.

## Latest validation

### Slice 5 (0.0.28)

Issue #924; draft PR #925 to `modular-simping`; branch `slurp2-slice5-server-services`.

Moved (all by `git mv`, renamed `slurp-<name>[.service|.operation].ts` → `slp-<name>[-service|-operation].ts`):

- 147 files from `services/slurp/` into `server/src/slp/`: 82 pure rules to `modules/<domain>/`
  (`settings`, `records`, `requests`, `prompting`, `creators`, `feed`, `messages`, `audience`,
  `world` with `world/events`, `projects`, `economy`, `notifications`, `discovery`, `maintenance`),
  domain-neutral infrastructure to `base/{host,prompting,media,identity,model,locking}`, persistence
  helpers to `data/{audience,creators}`, and the rest to `features/<name>/`. The six Garnish adapters
  are in `features/ads/`.
- `services/slurp/slurp-post-guidance.storage.ts` was a Slice 4 duplicate; it is deleted and its four
  importers use `data/settings/slp-post-guidance-storage.ts`.
- Slice 3/4 files re-layered: every storage facet `features/<d>/…storage…` → `data/<d>/`;
  `slp-storage.ts` → `data/`; storage context, constants, mappers → `data/host/`; settings schema →
  `modules/settings/`; record model → `modules/records/`; request schemas → `modules/requests/`;
  route host and viewer context → `features/viewer/`; media routes and image services →
  `features/media/`; settings routes → `features/settings/`; chat context → `features/creators/`;
  backup and data-deletion flags → `base/locking/`.
- Splits along domain boundaries, each verified acyclic by loading every file first: `slp-project.ts`
  (1549) → core 689 + `slp-arc-library.ts` 334 + `slp-arc-progress.ts` 398 + `slp-arc-crossover.ts`
  135; `slp-world-operation.ts` (1074) → 739 + `slp-world-actions.ts` 284 + `slp-world-tick-state.ts`
  79; `slp-generation-service.ts` (979) → 629 + `slp-post-prompt.ts` 278 + `slp-public-identity.ts`
  91; `slp-public-support.ts` → pure helpers + `data/creators/slp-creator-accounts.ts`;
  `slp-storage-model.ts` → pure model + `data/host/slp-storage-queries.ts`. Shared private helpers
  used by both halves were exported, and nothing else changed.
- Unused imports left by Slice 4 were pruned in four storage/settings files so they could leave
  `base/`. `slp-storage.ts` no longer re-exports settings and model names; importers point at the
  source files.

Contracts (added only for existing cross-feature calls, re-exporting exactly the imported names):
`ads` (Garnish factory, lorebook sync), `audience`, `creators`, `economy`, `feed`, `media`,
`messages`, `onboarding`, `projects`, `viewer` (`SlpRouteDeps` type), `world`. The three Slice 4
contracts that only re-exported storage were removed; features import `data/` directly.

Workflows: `slp-world-tick-workflow.ts` now imports only the world and audience contracts. Evidence
for no new workflow files: the subscribe route makes one `noodle.subscribe` storage call whose
wallet and event work runs in one transaction; the notification-open coordination is the existing
world-tick catch-up, injected by the entry; other cross-feature service calls are single capability
calls through contracts.

Fix commit (maintainer-approved, restores `staging` behaviour): the five payment helpers are
top-level exports again, and the five in-flight maps are module-scope singletons again.
`tests/slurp2-messages-shared-state.regression.ts` proves both and that every contract value
re-export resolves. Mutation checks: an unexported helper, a per-context map, and a contract naming a
missing export each fail it.

Ownership: `packages/server/src/services/slurp` removed from `slurp2OwnedSourcePaths` (its last file
moved) and added to `validate-catalog.mjs`'s moved-path filter. `packages/server/src/slp` already
covers every moved file. Legacy `slurpOwnedSourcePaths` unchanged. No `slp`, `services/slurp`, or
Garnish snapshot exists under `sources/engine`.

Garnish boundary: only `features/ads/` imports `services/garnish-ads/`; the route host and refresh
scheduler get `createGarnishAds` through `slp-ads-contract.ts`. The architecture regression now
asserts this (a stray import in `features/feed/` makes it fail). `slurp-garnish-ads-boundary` passes.

Architecture regression: ranks `modules` and `data`, rejects `fastify`, `db/connection`,
`db/file-query`, and host storage imports in server modules, and has negative fixtures for base →
module, module → data, data → feature, and module I/O. Turning off each new rule makes a fixture
fail. Real tree: 0 violations; largest file 789 lines; 35 files above 400.

Preservation: `slurp2-route-inventory` (179 routes, order) and `slurp2-storage-methods` (179 methods)
pass. The route regex in `slurp2-route-inventory` now matches the entry's
`{ db: app.db, noodle }` (Slice 4 change); `slurp-boundary` has one import-path regex updated for the
moved scheduler.

Test migration: `tests/slurp2-source.ts` maps all 148 historical service keys to their files and
re-points Slice 3/4 keys; 141 test imports were rewritten (split sources per symbol); 61 test files
route `readFileSync` through `slurp2Source` (same text for unmapped paths); the inventory guard in
`slurp-onboarding-failure-reasons` enumerates the historical keys and also checks every live `slp`
parser file. No assertion was weakened.

Validation (Node `v24.18.0`, `TMPDIR=/home/dev/.cache/slp-tmp`):

- `tests/slurp2-architecture.regression.ts`, `slurp2-route-inventory`, `slurp2-storage-methods`,
  `slurp2-messages-shared-state`, `slurp2-release-notes`, `slurp-garnish-ads-boundary` — pass.
- `node scripts/typecheck-packages.mjs slurp2` — pass ("no undefined names or unresolved modules").
  It does not report TS2305, which is why the Slice 4 missing re-exports were not caught; the new
  regression covers contracts.
- `npm run check` — pass (0 errors, 1009 warnings).
- Every regression file run on its own and compared with `modular-simping` `7b9ba1f3`: 33 files
  failed before; 23 fail now; 0 new failures; 10 fixed (Slice 4 read gaps, route inventory,
  financial queue). Each remaining failure stops at the same first assertion as before, except
  `slurp-boundary` (now the same assertion as clean `staging`), `slurp-relationship-panel` (same as
  `staging`), and the two Slice 4 carry-overs in Pending decisions.
- `npm run test:noodle:regressions` — exit 1 at the pre-existing `noodler-content-formats` failure.
- `MARINARA_ENGINE_ROOT=… npm run test:browser:slurp2` — both Engine servers became ready; all 14
  cases stopped because Chromium cannot load `libnspr4.so` (environment gap, not a code failure).
  Without the variable the runner needs a sibling `Marinara-Engine` checkout.
- `node scripts/test-catalog-lanes.mjs`, `validate-package-locales.mjs`,
  `validate-package-locale-keys.mjs`, `validate-catalog.mjs` (`v2=38, v3=38`),
  `scripts/tests/catalog-release-notes.regression.mjs`, `git diff --check` — pass.
- Generated unit (builder only): `packages/slurp2/{server.mjs,client.js,manifest.json}`,
  `artifacts/slurp2-0.0.28.zip`, three catalog lanes and notes. The ZIP holds `manifest.json`,
  `agents.json`, `server.mjs` (2973837 bytes), `client.js` (3592454 bytes), `slurp2-logo.png`,
  `slurp2agent.png`; every manifest sha256 and size matches, and the ZIP manifest equals the repo
  manifest. `SLURP2_VERSION`, the splash mirror (0.0.27 and 0.0.28 added, 0.0.7 and 0.0.6 dropped at
  the 20-entry cap), and the changelog agree.
- Live install, update, restart, offline restart, and uninstall: not performed.

Plan corrections: service count (147 + 1 duplicate, not 149); server tree, dependency direction,
and allocation rows revised for the approved layer model; Slice 5 workflow text records the
evidence above.


### Slice 4 (0.0.27)

Storage moved from the old `services/storage` boundary into explicit Slurp2 `server/src/slp`
facets. The public `createSlurpStorage` composition exposes the exact previous 179 sorted method
names. Settings/defaults, host helpers, creators, feed/reserve/interactions/refresh, audience,
economy, projects, notifications, and messages now have feature-owned implementation files. The
old storage files are deleted. Message storage uses explicit subfacets and contracts.

Ownership changes:

- `slurp2OwnedSourcePaths` now owns `packages/server/src/slp` for all moved server storage.
- Old storage ownership entries were removed after their last live file moved.
- `sources/engine/packages/server/src/services/noodle/noodle-prompt.ts` keeps a package-neutral
  structural settings type. It does not import Slurp2 package code.
- Legacy `slurpOwnedSourcePaths` was not changed.

Generated release unit:

- Engine: `/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`, branch `welcome-to-the-agentshop`,
  commit `fdb67d47b`, tracked files clean, 4 ahead / 13 behind `origin/staging`, used unchanged.
- Node: `/home/dev/.nvm/versions/node/v24.18.0/bin`, `v24.18.0`.
- Artifact: `artifacts/slurp2-0.0.27.zip`.
- Artifact sha256: `bff898bccc680530280b87edb8c75b0afc519c346b25990fbaefc7cc8937a65e`.
- Artifact bytes: `6723530`.
- ZIP contents: `manifest.json`, `agents.json`, `server.mjs`, `client.js`, `slurp2-logo.png`,
  `slurp2agent.png`.
- Manifest payload hashes and sizes match generated files.

Preservation proof:

- `tests/slurp2-storage-methods.regression.ts` passes and reports exactly 179 methods.
- `tests/slurp2-architecture.regression.ts` passes.
- `tests/slurp-table-registration.regression.ts` passes.
- `node scripts/typecheck-packages.mjs slurp2` passes with no undefined names or unresolved modules.
- Representative behavior regressions pass: backup round-trip, population, arc director,
  restore-settings/follow, autopurge, and cross-bundle unique-error handling.

Validation results:

- `npm run format:check` passes.
- `npm run lint` passes with 0 errors and 1,190 warnings.
- `node scripts/test-catalog-lanes.mjs` passes.
- `node scripts/validate-package-locales.mjs` passes.
- `node scripts/validate-catalog.mjs` passes.
- `node scripts/tests/catalog-release-notes.regression.mjs` passes.
- `git diff --check` passes.
- `npm run test:noodle:regressions` is blocked by a pre-existing source assertion in
  `tests/noodler-content-formats.regression.ts` that still reads the deleted historical storage
  path. The run reached that assertion after earlier tests passed.
- `npm run test:browser:slurp2` is blocked because this worktree has no sibling
  `/home/dev/.paseo/worktrees/0vl25jsh/Marinara-Engine/package.json`; no browser execution occurred.
- `tests/slurp-phase1-durability.regression.ts` has the same missing sibling Engine checkout gap.
- Live install, update, restart, offline restart, and uninstall testing were not performed.

Plan corrections: none. Pending decisions: none.

Slice 4 is not merged. Slice 5 is not started. The next action is to review and merge PR #919 into
`modular-simping` after human review; only then may Slice 5 begin.

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
- GitHub Actions run `35361067772`, Slurp2 browser job, reached both Engine servers and ran 14
  cases: 7 passed, 6 failed, and 1 skipped. Failures were settings persistence and UI readiness
  assertions in the existing browser suite. Temporary draft PR #917 ran the same workflow against
  unchanged `modular-simping` commit `92c25f9c`: run `35362807451` produced the identical 7 passed,
  6 failed, and 1 skipped result with the same assertions. The failures are pre-existing and are not
  a Slice 3 regression. PR #917 and its remote branch were closed and deleted after comparison.

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

Slice 5: review draft PR #925 (issue #924) and merge it into `modular-simping` after human review. Only
then start Slice 6 from the merged `modular-simping`: add `base/modifiers/`, add `kind: "calendar"` to
platform events (now `modules/world/events/slp-platform-events.ts`, read by
`modules/settings/slp-settings.ts`), move calendar activation into a kind dispatch table, expose
active guidance and modifiers from one timestamp, and inject the modifier provider into the
subscription price calculation (`modules/economy/slp-creator-pricing.ts` and the `data/economy`
subscribe path). Resolve pending decisions 3–4 first if the maintainer wants them in Slice 6.

Earlier items:

1. Review and merge draft PR #916 into `modular-simping` after its required review. Do not start
   Slice 4 until PR #916 is merged because Slice 4 is the storage point of no return.
2. After Slice 10, open the final PR `modular-simping` → `staging` as Slurp2 `0.1.0` (one changelog
   entry, integration-only `0.0.x` ZIPs removed, one rebuild, full live lifecycle proof).
