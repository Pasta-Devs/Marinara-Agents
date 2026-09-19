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

- Last updated: 2026-09-19
- Updated by: Slice 11 implementation agent
- Overall state: Slice 11 blocked
- Active slice: 11 (ownership completion and typecheck proof), issue #941, branch
  `slurp2-slice11-ownership-completion` from `origin/modular-simping` `09066008` (the merged Slice 10
  commit).
- Draft PR: not opened yet; it will target `modular-simping` and remain draft.
- Slice 10 merge gate: **satisfied.** PR #940 is `MERGED` into `modular-simping` at `09066008`.
- Slice 11 base: `09066008ec07ef900663f2a24f47b295ba9206cf`; `git status --short` was empty before
  implementation.
- Staging integration: `git rev-list --count origin/modular-simping..origin/staging` = **0**.
  `modular-simping` already contains every `origin/staging` commit, so no merge was needed and none
  was made. No commit was pushed directly to `modular-simping`.
- Pull request: Slice 10 PR #940 is merged. Slice 11 has no PR yet. Issue #941 is open.
- Package version: `0.0.33` before this slice; this slice is expected to ship `0.0.34` (integration-only;
  `staging` stays at `0.0.22` until the final `0.1.0` release PR).
- Node: `/home/dev/.nvm/versions/node/v24.18.0/bin`; `node -v` = `v24.18.0`, `npm -v` = `12.0.2`
  (verified this slice).
- Engine source: `/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`, branch
  `welcome-to-the-agentshop`, commit `fdb67d47bfb909f013346afdb3d2c23d72d7b399`, tracked files clean
  (`git status --porcelain --untracked-files=no` empty); 4 ahead / 80 behind Engine `origin/staging`
  after a fresh fetch. It will be used unchanged, as in Slices 7, 8, 9 and 10, so build deltas stay
  comparable across slices. No substitute worktree was needed and nothing in it was reset, rebased
  or cleaned.

### Slice 11 verified starting shape

- The seven remaining files under `packages/client/src/components/slurp/` are exactly:
  `SlurpHome.tsx` (8,143), `SlurpMessages.tsx` (5,159), `SlurpPostCard.tsx` (2,512),
  `SlurpCreatorPostCard.tsx` (1,677), `SlurpOnboardingPanel.tsx` (1,608),
  `SlurpStageProfileForm.tsx` (773), and `SlurpCreatorProfileEditor.tsx` (110): **19,982 lines**.
- The five files above 800 lines are single React components. The two files below the ceiling import
  the unsplit components. `SlurpCreatorPostCard.tsx` was previously attempted and reverted in Slice
  10; its locked-card extraction was clean, but the remainder was 1,159 lines with two shared-state
  render branches.
- `packages/client/src/slp/features/projects/SlpArcLibraryEditor.tsx` is **800 physical lines** on
  this checkout. Its two-line `ponytail:` note identifies the draft-editor branch as the next split.
- `slurp2OwnedSourcePaths` currently has seven entries, including `packages/client/src/components/slurp`.
  The target list is exactly six entries: the three `slp` roots, `packages/client/src/lib/api-client.ts`,
  `packages/server/src/services/garnish-ads`, and `packages/server/src/db/schema/slurp.ts`.
- The Engine worktree record above is current. Node is `/home/dev/.nvm/versions/node/v24.18.0/bin/node`
  at `v24.18.0`; npm is `12.0.2`.

### Slice 11 implementation checkpoint

- Issue #941 is open. No Slice 11 commit or draft PR exists because the branch has no committed
  implementation yet.
- The first move batch is present in the working tree: the post cards are under
  `client/src/slp/modules/post/`, onboarding is under `client/src/slp/features/onboarding/`, and the
  two creator profile files are under `client/src/slp/features/creators/`. Their imports typecheck.
- `SlurpHome.tsx` and `SlurpMessages.tsx` were moved to `client/src/slp/app/SlpHomeHost.tsx` and
  `client/src/slp/features/messages/SlpMessages.tsx`, but they remain oversized monoliths. No
  `app/screens/` or `features/messages/commissions/` extraction was produced.
- The current architecture regression therefore fails on the two oversized monoliths, the moved
  post-card sizes and module-to-feature imports, onboarding cross-feature imports, and the creator
  form's cross-feature imports. The generic Engine hook exception is now explicit and remains
  unowned as required.
- `node scripts/typecheck-packages.mjs slurp2` reports five existing server TS2305 diagnostics:
  `SlurpBootstrap`, two `SlurpCommission` imports, and two `SlurpMessage` imports. It reports no
  client move diagnostics. `tests/slurp2-typecheck-modules.regression.ts` passes, including the
  missing-export fixture. This confirms the new gate behavior but does not make the package clean.
- The Arc editor split, architecture pass, source-map proof, version bump, generated rebuild, full
  regressions, lifecycle proof, and draft PR remain pending. Slice 11 must not be marked ready for
  review until the UI extraction is completed and the five baseline TS2305 diagnostics are either
  fixed as pre-existing package defects or recorded with an approved gate treatment.

### Slice 11 continued checkpoint

- Direct implementation continued without subagents after the blocked checkpoint.
- Additional completed moves/splits now include message commissions, message insight panels, Arc draft
  editing, post-card helper/types/hooks fragments, and several Home screen fragments.
- The package typecheck reports only the five known server TS2305 baseline diagnostics. It reports no
  current client syntax or unresolved-module errors.
- Architecture still fails. Remaining verified failures include oversized `SlpHomeHost.tsx`,
  `SlpScreenHub.tsx`, `SlpScreenProfile.tsx`, `SlpMessages.tsx`, `SlpOnboardingPanel.tsx`,
  `SlpCreatorPostCard.tsx`, and `SlpPostCard.tsx`, plus unresolved cross-feature boundary imports.
- No generated outputs, version bump, commit, draft PR, or release validation has been performed.
- Slice 11 remains blocked and is not ready for review.

### Slice 10 verified starting shape and approved scope change

The plan's §7.10 bullet list and the Slice 10 acceptance criteria disagreed. Re-deriving the tree
from `14d27b4d` rather than trusting the ledger showed why:

- **44 live files, ~31,000 lines, remain in `packages/client/src/components/slurp/`**, plus
  `packages/server/src/db/schema/slurp.ts` (649 lines). Only `slurp-auto-post.ts` is dead.
- Eight of them exceed the 800-line architecture ceiling and therefore must be **split**, not moved:
  `SlurpHome.tsx` (8,142), `SlurpMessages.tsx` (5,159), `SlurpPostCard.tsx` (2,512),
  `SlurpBackstageWorkflow.tsx` (1,717), `SlurpCreatorPostCard.tsx` (1,677),
  `SlurpOnboardingPanel.tsx` (1,608), `SlurpShell.tsx` (1,214), `SlurpProjectsPanel.tsx` (1,013).
- `slurp2OwnedSourcePaths` has **7** entries today, not the plan's final five.
- `packages/server/src/db/schema/slurp.ts` appears in **both** `slurpOwnedSourcePaths` (frozen
  legacy Slurp) and `slurp2OwnedSourcePaths`, yet the plan's §5 final five-entry list omits it with
  no replacement owner.

So plan §7.10's bullets are a small slice, while the acceptance criteria additionally require
finishing the client scope gap that Slice 8 recorded and deferred. Two maintainer decisions were
taken on 2026-09-19 rather than being made silently:

1. **Scope: full ownership completion.** Slice 10 moves and splits every remaining
   `components/slurp/` file so `slurp2OwnedSourcePaths` reaches its final list. No Slice 11.
2. **`db/schema/slurp.ts`: permanent sixth exception.** The Drizzle schema stays at its current
   path and is recorded in the architecture guide as a third named permanent exception beside
   `packages/client/src/lib/api-client.ts` and `packages/server/src/services/garnish-ads/`. Moving
   it would rewrite table registration for the frozen legacy Slurp package, which the plan forbids.
   `SLURP-MODULE-PLAN.md` §5 is corrected to six entries with that reason.

### Slice 10 result

**Branch and commits.** `slurp2-slice10-final-architecture`, ten commits on top of `14d27b4d`:
`7c2432e1` (TS1xxx typecheck gate and slice start), `2443ef43` (batch 1 leaf moves),
`bdf8949c` (audience/discovery/world/settings leaves plus five pure rules to shared),
`0582ca1f` (shell split), `9373d7a3` (Backstage kit split), `14fedbde` (remaining sub-ceiling
moves, focusRing dedupe, dead-file deletion), `a455df89` (Projects split), `7b77f3d8` (rebuild
0.0.33), `6cfbc436` (prune split leftovers and rebuild), `5ea415d3` (formatting).

**Package version.** `0.0.33`. The builder's Slurp2 version was bumped once.

#### The TS1xxx typecheck gate (plan §7.10 item 3) — done

`scripts/typecheck-packages.mjs` now reports all `TS1xxx` syntax diagnostics unconditionally, with
no allowlist. Proof the gap was real: a fixture whose only defect is an unbalanced JSX fragment
returned `zz-syntax-probe: no undefined names or unresolved modules` and exit 0 before the change,
and after it reports `TS1381` and `TS1005` with exit 1. `tests/slurp2-typecheck-modules.regression.ts`
now contains that fixture and additionally asserts the gate emits **no** `TS2304` for the undefined
name inside the unparsed file, which is what makes the old result a blind pass rather than a quiet
one.

#### Source moves — 37 of 44 files done, 7 deliberately not done

`components/slurp/` went from 44 live files to 7. One file, `slurp-auto-post.ts`, was deleted:
its only export `summarizeRefreshOutcomes` had no importer anywhere in the package.

New homes: `base/chrome/` (chrome primitives, logo, avatar, popover, focus ring),
`base/ui/slp-date-time.ts`, `base/navigation/slp-navigation.types.ts`, `base/media/`,
`modules/chrome/` (new: shell, contract, persona switcher), `modules/creator/`,
`modules/audience/` (new), `modules/settings/` (shared Backstage kit), and the Ads, Audience,
Creators, Discovery, Maintenance, Messages, Onboarding, Projects, Settings and World features.

Three files above the 800-line ceiling were split rather than moved:

| Was | Lines | Became |
| --- | --- | --- |
| `SlurpShell.tsx` | 1214 | `base/chrome/SlpChrome.tsx` (292), `modules/chrome/slp-shell.types.ts` (88), `modules/chrome/SlpPersonaSwitcher.tsx` (206), `modules/chrome/SlpShell.tsx` (661) |
| `SlurpBackstageWorkflow.tsx` | 1717 | `modules/settings/slp-backstage-format.ts` (71), `modules/settings/SlpBackstageKit.tsx` (458), `features/projects/SlpArcLibraryEditor.tsx` (798), `features/audience/SlpAmbientProfilesPanel.tsx` (173), `features/messages/SlpCreatorMessagingGroup.tsx` (220) |
| `SlurpProjectsPanel.tsx` | 1013 | `features/projects/SlpProjectsBoard.tsx` (543), `SlpArcTimelineCard.tsx` (168), `SlpArcConfigSection.tsx` (190), `SlpProjectEditor.tsx` (112) |

**Ownership gap — the acceptance criterion "All final ownership rules pass" is NOT met.**
Seven files, 19,982 lines, remain in `packages/client/src/components/slurp/`:

| File | Lines |
| --- | --- |
| `SlurpHome.tsx` | 8143 |
| `SlurpMessages.tsx` | 5159 |
| `SlurpPostCard.tsx` | 2512 |
| `SlurpCreatorPostCard.tsx` | 1677 |
| `SlurpOnboardingPanel.tsx` | 1608 |
| `SlurpStageProfileForm.tsx` | 773 |
| `SlurpCreatorProfileEditor.tsx` | 110 |

`slurp2OwnedSourcePaths` therefore still carries `packages/client/src/components/slurp` and has
seven entries, not the corrected final six. Five of the seven files exceed the 800-line ceiling, and
each is a **single React component** whose split means threading a dozen pieces of local state
through new props — a behavioural refactor, not a move. `SlurpCreatorPostCard.tsx` was split during
this slice and then reverted, because the extraction still left a 1159-line component: the locked-card
half came out cleanly but the remaining component has two large render branches over shared state.
The two sub-ceiling files are held back only because they import the unsplit ones.

This gap is Slice 8's recorded client scope gap. Completing it is a slice in its own right and is
the honest remaining work before the `0.1.0` release PR.

#### Architecture regression — passes, with the migration accommodation still needed

`tests/slurp2-architecture.regression.ts` passes with **no size, boundary, dependency or ownership
allowlist**, and all 19 negative fixtures still reject. Every rule applies to every file now inside
the three `slp` roots. The one accommodation that could not be removed is the comment on its
ownership rule: files outside the roots are only flagged when they are named `slp-`/`Slp`, which is
what lets the seven remaining `Slurp*` components stay outside without failing. Removing that
accommodation is blocked by the ownership gap above, not by the regression.

Boundary work done so that no allowlist was needed:

- five pure rule modules moved to `shared/src/slp/` (`slp-world.ts`, `slp-world-pulse.ts`,
  `slp-reach.ts`, `slp-audience-subscription.ts`, `slp-audience-characters.ts`). The client
  simulation estimate and fan card had been importing them **across the client/server boundary**;
  the accommodation hid it because the importers sat outside the roots.
- `SlurpDiscoverLayout`, `SlurpReserveStatus` and `SlurpScheduleSlot` moved to `base/state/`, the
  last two re-exported from the feed contract so no feed consumer changed.
- eleven cross-feature reaches were routed through contracts. New: `slp-discovery-contract.ts`,
  `slp-maintenance-contract.ts`. Extended: Ads, Economy, Messages, Settings, post-guidance, Creators.

#### focusRing / quietButton (plan §7.10 item 4) — done, partly deliberately not merged

`focusRing` was byte-identical in four files; it is now `base/chrome/slp-focus.ts`. The three
`quietButton` composites are **not** merged: Creators uses `min-h-11` without a transition,
Maintenance uses `min-h-11` with `transition-[background-color,transform]`, `active:scale-[0.96]` and
`motion-reduce:` variants, and Settings uses `min-h-10`. Merging them would change rendered classes,
which plan §9 forbids. Each now builds its own string from the shared ring.

#### Source map

`tests/slurp2-source.ts` gained a logical key for every moved file and an aggregate key for each of
the three split monoliths, so negative assertions stay module-wide. No mapping was removed and no
assertion was deleted or weakened. Five historical service keys were **repointed** to the new
`shared/src/slp/` paths rather than duplicated, keeping one stable key per logical module.

Seven tests read Slurp2 source with a bare `readFileSync` rather than the helper and so broke on the
moves; five were routed through `slurp2Source` (`slurp-chrome`, `slurp-navigation-profile`,
`slurp-creator-card`, plus the two settings readers) and two were repointed at the file that now
holds the asserted line (`slurp2-logo`, `noodle-settings-structure`). Twenty test files that import
moved modules directly were repointed mechanically.

#### Generated release unit

Built with Node `v24.18.0`, `TMPDIR=/home/dev/.cache/slp-tmp`, and
`MARINARA_ENGINE_ROOT=/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`. Nothing was hand-edited.

- Artifact: `artifacts/slurp2-0.0.33.zip`.
- ZIP contents: exactly six declared files — `manifest.json`, `agents.json`, `server.mjs`,
  `client.js`, `slurp2-logo.png`, `slurp2agent.png`.
- Manifest version `0.0.33`; all five payload sha256 and byte-size entries match the files on disk.
- All three catalog lanes record Slurp2 `0.0.33`; `notes.json` updated in each.
- `sources/engine/` contains no `packages/{client,server,shared}/src/slp` and no
  `packages/server/src/services/garnish-ads`, so no Slurp2 or Garnish source leaked into generic
  Engine material.

Two build-only defects were caught by the builder and fixed, both from the split tooling: same-
directory imports emitted without a leading `./`, and a contract that re-exported only a type when
its consumer also imported five hooks. Note that `scripts/typecheck-packages.mjs` did **not** catch
the second one, because it reports TS2304/TS2552/TS2307/TS1xxx and not TS2305 ("no exported
member"). That is a real remaining blind spot in the gate and is recorded under Pending decisions.

#### Validation results

- `tests/slurp2-architecture.regression.ts` — pass, no allowlist, 19 negative fixtures reject.
- `tests/slurp2-typecheck-modules.regression.ts` — pass, including the new syntax fixture.
- `node scripts/typecheck-packages.mjs slurp2` — pass.
- `tests/slurp2-storage-methods.regression.ts` — pass, exactly 179 methods.
- `tests/slurp2-route-inventory.regression.ts` — pass, the 179-route multiset unchanged.
- `tests/slurp2-backstage-anchors.regression.ts` and `slurp2-backstage-completion.regression.ts` —
  pass (also used as the Slice 9 merge-gate evidence).
- `npm run check` — pass, 0 errors, 912 warnings (pre-existing style class).
- `node scripts/test-catalog-lanes.mjs`, `validate-package-locales.mjs`,
  `validate-package-locale-keys.mjs`, `validate-catalog.mjs`,
  `scripts/tests/catalog-release-notes.regression.mjs` — all pass.
- `git diff --check` — pass.

#### Full regression suite — no new failures

`tests/noodle*`, `noodler-*`, `slurp-*` and `slurp2-*` run per file, 204 files:

- **Slice 10 branch: 177 pass, 27 fail.**
- **Clean baseline at `14d27b4d` (the Slice 9 merge commit): 177 pass, 27 fail.**
- `comm` of the two sorted failure lists is **empty in both directions**: no new failure, and none
  of the pre-existing 24 unique failures was accidentally "fixed" by a weakened assertion.

The 24 unique pre-existing failures (the glob matches `noodler-*` twice, hence 27 lines) were
inherited, not introduced here. They were re-derived from a fresh worktree at `14d27b4d`
(`/home/dev/.cache/slice10-base`) rather than trusted from an earlier ledger entry. For the three
that this slice touched most (`slurp-feed-layout`, `slurp-lifecycle-safety`, `slurp-review-fixes`)
the first assertion message is byte-identical on both sides, so they fail for the same reason and
are not newly masked.

Six regressions did break during the slice and were fixed without weakening anything:

- `slurp2-audience-config`, `slurp2-splash`, `slurp2-simulation-estimate`, `slurp2-prompt-presets`,
  `slurp2-settings-reset` — bare `readFileSync` or direct module imports of moved files; routed
  through `tests/slurp2-source.ts` or repointed.
- `slurp2-client-hooks` — the real one. It is a **state-layer** proof, but it walked all of `slp/`
  and excluded only the files the source map attributed to Backstage keys. Every component Slice 10
  moved in therefore inflated its wiring counts (`onError` 3 → 18) and made three pre-existing
  requests newly visible. The exclusion now covers every file attributed to **any**
  `components/slurp/` key, which generalises what Slice 9 did for Backstage. With that fix the
  client request path/method set and all eleven wiring counts are **unchanged from the monolith** —
  the expected numbers were not rebaselined, and the three routes were not added to the list.

#### Browser suite — ran, and matches baseline exactly

`npm run test:browser:slurp2` previously could not run here at all. Two blockers were cleared:
`MARINARA_ENGINE_ROOT` satisfies the sibling-Engine requirement the runner checks, and
`LD_LIBRARY_PATH=/tmp/pwlibs/root/usr/lib/x86_64-linux-gnu` supplies the `libnspr4.so` the host
lacks. Chromium then launched and the suite completed.

- **Slice 10 branch: 12 failed, 1 passed, 1 skipped (4.1m).**
- **Clean baseline at `14d27b4d`: 12 failed, 1 passed, 1 skipped (4.2m).**

Identical totals, so this slice causes no browser regression. Both runs end with the Engine dev
servers dying (`ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` on `vite` and `tsx watch`, `SIGTERM`), which is
why almost everything fails on this host — an environment fault, not a code fault. **Caveat:** the
baseline capture was piped through a grep filter that dropped some case names, so a per-case
comparison of the two failure sets was not possible; only the totals are directly comparable. A
trustworthy per-case result needs the GitHub Actions browser job, as used in Slice 3.

#### Gaps — recorded, not claimed

- **Live package lifecycle proof: not performed.** `dev-marinara2`, which the plan names as the only
  permitted box for this restructure, is unreachable: `ssh dev-marinara2` gives
  `connect to host 10.0.0.138 port 22: Connection timed out`. `dev-marinara` answers but is a
  different box than the plan specifies, so it was not substituted. Therefore **none** of install,
  update from `0.0.32`, activation, deactivation, navigation, route access, settings persistence,
  restart, offline restart, package update, uninstall, post-uninstall data absence, legacy-Slurp
  non-interference, or desktop/tablet/mobile layout review was exercised. Production `ssh marinara`
  was never touched.
- **Desktop, tablet and mobile layout review: not performed**, for the same reason. No screenshots
  were inspected.
- **Per-case browser comparison: not available** (see caveat above).
- **Ownership completion: not achieved** (see the ownership gap above). This is the largest gap.

#### Plan corrections made

- §5's final ownership list: five entries → **six**, adding
  `packages/server/src/db/schema/slurp.ts` as a permanent exception, with the reason.
- `DECISIONS.md` gained the Slice 10 entry covering the schema exception, the shell placement, the
  `base/state/` type relocations, and the five pure rules moving to `shared/src/slp/`.
- `docs/architecture/README.md` now names three permanent exceptions, not two.

#### Pending decisions

1. **The remaining seven `components/slurp/` files.** Full ownership completion was the approved
   Slice 10 scope but is not delivered; the five oversized single-component files need a genuine
   component refactor. Decide whether this becomes Slice 11 before the `0.1.0` release PR, or whether
   `0.1.0` ships with `packages/client/src/components/slurp` still owned. The plan's §5 final list
   and the "no temporary allowlist" criterion cannot both hold until this is done.
2. **`scripts/typecheck-packages.mjs` does not report TS2305** ("module has no exported member"). A
   contract that re-exported only a type while its consumer imported five hooks passed the gate and
   was caught later by esbuild. Widening the gate to TS2305 looks cheap and was not done in this
   slice because it was not in scope; it needs its own negative fixture.
3. **`features/projects/SlpArcLibraryEditor.tsx` is 798 lines**, two under the automated ceiling. It
   carries a `ponytail:` comment naming the draft-editor branch as the next split. Any further field
   added to it breaks the build.

### Slice 9 verified starting shape

- Backstage renders by **target**, not by section. `SlurpSettings.tsx` renders all six section page
  components unconditionally and each one self-gates on `target === "..."` (Overview gates on
  `section`). The registry therefore replaces a real duplicated dispatch rather than inventing one.
- 17 targets in `SLURP_BACKSTAGE_TARGETS`: overview, creators, improve, world, tags, events, arcs,
  messaging, audience, ads, wallet, automation, general, images, prompts, autopurge, advanced.
- Current file sizes: `SlurpBackstageWorld.tsx` 2171, `SlurpSettings.tsx` 1328, `SlurpBackstageAutomation.tsx`
  926, `SlurpBackstageChrome.tsx` 816, `SlurpBackstageCreators.tsx` 811, `SlurpBackstageMaintenance.tsx`
  571, `SlurpBackstageOverview.tsx` 327, `SlurpBackstageKit.tsx` 318, `SlurpBackstagePrompts.tsx` 280,
  `slurp-backstage.ts` 266. `SlurpBackstageWorkflow.tsx` (1711) is a shared kit, not a panel.
- `useSlurpBackstageController` in `SlurpSettings.tsx` is one hook that fetches for every feature and
  is spread into all six pages as `SlurpBackstagePageProps`.

### Slice 9 approved panel ownership (maintainer decision, 2026-09-19)

`overview`, `world` and `automation` render only landing summaries that link to other targets, so
they encode the Backstage information architecture itself and stay in `features/backstage/`. The
other fourteen targets go to the feature that owns the setting, mirroring the server feature names:
creators/improve to `creators`, tags to `discovery`, events to `world`, arcs to `projects`,
messaging to `messages`, audience to `audience`, ads to `ads`, wallet to `economy`, general to
`feed`, autopurge/advanced to `maintenance`.

Two targets had no domain owner and were decided explicitly:

- `images` goes to a new client `features/media/`, mirroring the existing server `features/media/`.
  Evidence: `imageWidth`/`storyImageWidth`/`imageContextMode` are read on the server by
  `features/feed`, `features/media`, `features/messages`, `features/audience` and
  `base/media/slp-generated-media-policy.ts`, so `feed` cannot own them.
- `prompts` goes to the existing `features/settings/`, as cross-cutting generation configuration
  with no domain owner. Evidence: `generationGuidance`/`promptBlocks`/`imageGenerationPrompt` are
  read on the server by ads, audience, creators, feed, media, messages, projects and world, and the
  shared machinery lives in `base/prompting/` and `modules/prompting/` rather than in any feature.
  `features/settings/` already owns the settings contract, the settings hooks and the
  post-guidance hook the prompts panel calls. It owns cross-cutting configuration UI only, never a
  domain panel.

### Slice 9 result

**Branch and commits.** `slurp2-slice9-backstage`, five commits on top of `03ae3a90`:
`ff208848` (ordinary merge of `origin/staging`), `02e9a28b` (slice start and ownership),
`f027729f` (feature-owned Backstage state), `3919b892` (thin host and registry), `ceedd44e`
(rebuild 0.0.32 and the rewritten anchor regression), `85496c07` (retargeted regressions).

**Package version.** `0.0.32`. Builder `scripts/build-feature-packages.mjs` bumped once.

**Backstage host files.** `slp/app/backstage/SlpBackstageShell.tsx` (241),
`slp/app/backstage/slp-backstage-controller.ts` (65), `slp/app/backstage/slp-backstage-registry.ts`
(54). In `slp/features/backstage/`: `slp-backstage-contract.ts`, `slp-backstage-placement.ts`,
`SlpBackstageNavigation.tsx`, `SlpBackstagePreview.tsx`, `SlpBackstageControls.tsx`,
`SlpBackstageSidebar.tsx`, and the three landing panels. `slp/base/navigation/slp-backstage-target.ts`
holds the target vocabulary. `slp/modules/settings/SlpSettingsKit.tsx` and
`SlpSettingsControls.tsx` hold the shared setting controls.

The shell's rendered JSX is byte-identical to the deleted `SlurpSettings.tsx` render except for
three lines: two renamed label constants, the renamed section row, and the six hard-coded page
components replaced by `{Panel ? <Panel {...page} /> : null}`. `git show HEAD~3:...SlurpSettings.tsx
| sed -n '977,1093p'` diffed against the shell's `<main>` block shows only those changes.

**The controller.** `useSlurpBackstageController` was 545 lines that fetched for every feature. It
is now 65 lines of pure composition over ten feature-owned contracts:
`slp-ads-backstage-contract.ts`, `slp-audience-backstage-contract.ts`,
`slp-creators-backstage-contract.ts`, `slp-economy-backstage-contract.ts`,
`slp-feed-backstage-contract.ts`, `slp-maintenance-backstage-contract.ts`,
`slp-media-backstage-contract.ts`, `slp-messages-backstage-contract.ts`,
`slp-prompts-backstage-contract.ts` and `slp-settings-backstage-contract.ts`. Every query keeps its
original `enabled` condition, so the same requests fire at the same moments.

**Registry — all 17 targets, one entry each, no duplicates.**

| target | panel | owner |
| --- | --- | --- |
| overview | `SlpBackstageOverviewPanel` | backstage |
| creators | `SlpCreatorsPanel` | creators |
| improve | `SlpCreatorImprovePanel` | creators |
| world | `SlpBackstageWorldPanel` | backstage |
| tags | `SlpDiscoveryPanel` | discovery |
| events | `SlpWorldEventsPanel` | world |
| arcs | `SlpProjectsPanel` | projects |
| messaging | `SlpMessagingPanel` | messages |
| audience | `SlpAudiencePanel` | audience |
| ads | `SlpAdsPanel` | ads |
| wallet | `SlpWalletPanel` | economy |
| automation | `SlpBackstageAutomationPanel` | backstage |
| general | `SlpPublishingPanel` | feed |
| images | `SlpImagesPanel` | media |
| prompts | `SlpPromptsPanel` | settings |
| autopurge | `SlpAutopurgePanel` | maintenance |
| advanced | `SlpBackupPanel` | maintenance |

Three overlays moved with their owners: `features/creators/SlpCreatorRefreshModal.tsx`,
`features/feed/SlpCreatorScheduleModal.tsx`, `features/settings/SlpPromptEditors.tsx`.

**Anchor proof.** `tests/slurp2-backstage-anchors.regression.ts` was rewritten against the registry.
It imports the real `SLP_BACKSTAGE_SETTING_PLACEMENT` and `SLP_BACKSTAGE_TARGETS`, parses the real
registry entries, resolves each entry's `Component` to its actual file, and asserts every
non-internal setting renders `settingKey="<key>"` in the file its registry entry names. It also
proves target completeness, duplicate rejection, the unknown-target fallback, the absence of a
second switch in the shell, and the absence of glob loading, dynamic import and side-effect
registration. Internal settings keep their anchor exemption and the exemption is asserted non-empty.

Mutation checks, each confirmed to fail the regression and then reverted: dropping the `tags` entry;
duplicating the `tags` entry; renaming one anchor (`inlineAdsTone`); adding an `import.meta.glob`
call to the registry; pointing an entry at a component that does not exist. The suite passes again
after each revert.

There is no React renderer in this repository (no `react` in `node_modules`), so the regression
resolves and reads the real component files rather than mounting them. DOM proof belongs to the
browser suite, which could not run — see below.

**Source-map changes.** `tests/slurp2-source.ts` gained eleven Slice 9 keys mapping each historical
Backstage file to its new files, so `slurp2BackstageSource()` and its 26 consumers keep reading the
same logical module. Two paths were corrected for moved hooks
(`features/media/slp-image-connection-hooks.ts`, `features/settings/slp-post-guidance-contract.ts`)
and `features/ads/slp-ads-contract.ts` was added to the `hooks/use-slurp.ts` aggregate. No assertion
was deleted or weakened; the `save(` negative for World and Automation still reads through the
aggregate keys and so stays module-wide across all eleven new panels.

**Ownership.** `slurp2OwnedSourcePaths` needed no change: it owns `packages/client/src/slp` by
directory, which covers every new file, and `packages/client/src/components/slurp` still holds 44
live legacy files, so no entry could be removed. `node scripts/validate-catalog.mjs` and
`node scripts/test-catalog-lanes.mjs` pass.

**Validation, all run on this branch with Node v24.18.0.**

| command | result |
| --- | --- |
| `tsx tests/slurp2-architecture.regression.ts` | pass |
| `tsx tests/slurp2-backstage-anchors.regression.ts` | pass |
| `npm run check` | pass, 0 errors (918 pre-existing warnings, none in the new files) |
| `node scripts/typecheck-packages.mjs slurp2` | pass |
| per-file sweep of `test:noodle:regressions` | 177 pass / 27 fail |
| `node scripts/test-catalog-lanes.mjs` | pass |
| `node scripts/validate-package-locales.mjs` | pass |
| `node scripts/validate-catalog.mjs` | pass |
| `node scripts/tests/catalog-release-notes.regression.mjs` | pass |
| `git diff --check` | clean |
| `npm run test:browser:slurp2` | 14/14 blocked, Chromium cannot start |

**Baseline comparison.** `npm run test:noodle:regressions` exits on the first failure, so each file
was run separately on this branch and on a clean detached worktree of `origin/modular-simping`.
Both are 177 pass / 27 fail, and the failing sets are identical. Slice 9 adds no regression
failure and fixes none. The 27 are the recorded pre-existing baseline.

Three regressions did fail mid-slice and were repaired, not weakened:
`slurp2-backstage.regression.ts` imported the deleted vocabulary module and asserted the old
`target === "improve"` dispatch, so it now imports the moved module and asserts the registry's
`improve` entry; `slurp2-backstage-completion.regression.ts` asserted the old
`SlurpSettingsSidebar` export name; `slurp2-client-hooks.regression.ts` walked the whole `slp/`
tree, which now contains Backstage, so it excludes the files the source map attributes to the
Backstage components and its two moved-hook locations were corrected.

**Generated output.** Builder-produced with
`MARINARA_ENGINE_ROOT=/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`. Nothing was hand-edited.
`artifacts/slurp2-0.0.32.zip`, sha256
`aba57f7f0604d04b40c27010f54146a13fe965e7c78f0072c63990027f280853`, 6727019 bytes, 6 entries
including `manifest.json`, the client payload and the server payload. Every manifest hash and size
was recomputed from disk and matches. The catalog carries that hash, that size and version `0.0.32`
in all three lanes.

**Engine source.** `/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`, branch
`welcome-to-the-agentshop`, commit `fdb67d47bfb909f013346afdb3d2c23d72d7b399`, tracked files clean
before and after the build, 4 ahead / 80 behind Engine `origin/staging`. Used unchanged, as in
Slices 7 and 8. No substitute was needed and nothing in it was reset, rebased or discarded.

**File sizes.** No file under the `slp` roots exceeds 800 lines. The largest are
`SlpAdsPanel.tsx` 682, `SlpCreatorsPanel.tsx` 662, `SlpAudiencePanel.tsx` 572,
`SlpBackstagePreview.tsx` 512. `SlurpBackstageWorld.tsx` was 2171 lines before the split.

### Slice 9 browser, responsive and lifecycle gaps

No browser proof was obtained and none is claimed.

`MARINARA_ENGINE_ROOT=... npm run test:browser:slurp2` started the Engine services, then all 14
desktop and mobile cases failed in 2ms at `browserType.launch`. `ldd` on
`~/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome` reports 20 missing shared libraries,
including `libnspr4.so`, `libnss3.so`, `libatk-1.0.so.0` and `libxcb.so.1`. This is the same
environment failure recorded for Slice 8, not a Slice 9 defect.

Therefore **none** of the following was performed and none may be treated as verified: opening
Backstage; switching panels; deep-linking to a panel; searching; editing, saving, applying or
resetting a setting; navigating away with unsaved changes; unknown-target or internal-target
behaviour in a live browser; desktop, tablet or mobile layout checks; screenshots; console or
network inspection; accessibility checks; and install, update, restart, offline-restart or
uninstall lifecycle testing. No production `ssh marinara` was used.

Save, apply, reset, dirty-state, deep-link and fallback behaviour is evidenced only statically: the
shell render is byte-identical apart from the registry swap, the save/apply/reset code moved
unchanged into `slp-settings-backstage-contract.ts` and `slp-maintenance-backstage-contract.ts`, and
the anchor regression asserts the deep-link and fallback wiring. A human must still run the PR
checklist in a browser.

### Slice 9 plan corrections

1. **§9 registry path.** The plan places the registry in `features/backstage/`. The architecture
   regression forbids one feature importing another feature's internals, and a panel registry must
   name every feature's panel, so the registry and the shell live in `slp/app/backstage/` — the
   layer the rank table already designates for composing features. Maintainer-approved on
   2026-09-19 over the alternative of a boundary allowlist, because Slice 10 must end with none.
   No architecture exception was added and `DECISIONS.md` needs no entry: no approved boundary
   changed.
2. **Target vocabulary in `base/`.** `slp/base/state/slp-package-store.ts` restores a persisted
   Backstage destination and needs the target vocabulary. `base` may not import `features`, so
   `slp-backstage-target.ts` is at `slp/base/navigation/`. The placement map, which depends on the
   `SlurpSettings` key union, stays in `features/backstage/`.
3. **`scripts/typecheck-packages.mjs` is blind to syntax errors.** Verified during this slice: the
   gate reports only TS2304/TS2552 and relative TS2307, but TypeScript emits *only* TS1xxx
   diagnostics for a file that fails to parse and no semantic ones. A generated panel with an
   unbalanced JSX fragment was therefore reported as clean while every undefined name in it went
   unmentioned; a wider `tsc` run caught it. `SLURP-MODULE-PLAN.md` §5, §8 and §10 now record this
   and make reporting the TS1xxx codes a Slice 10 deliverable with a syntax-only fixture as proof.
   This slice did not change the script: widening the gate mid-slice would have mixed a tooling
   change into the Backstage diff.
4. **Two files renamed to contracts.** `features/settings/slp-post-guidance-hooks.ts` became
   `slp-post-guidance-contract.ts` and `SlurpPromotion` moved from `slp-ads-hooks.ts` to a new
   `features/ads/slp-ads-contract.ts`, because the creators panel and the Backstage preview need
   them across a feature boundary. `features/settings/slp-image-connection-hooks.ts` moved to
   `features/media/`, following the approved `images` ownership.

### Slice 9 recorded behaviour notes

These are the only behavioural deltas, all deliberate:

- Panels now mount only on their own target, so a panel's local view state resets when the user
  leaves that target. Everything that could be user-visible was hoisted into its feature's
  Backstage contract so it survives exactly as before: the creator table's search text, filter,
  tab and expanded row, and the pace, image, audience and messaging wizard drafts.
- Feature queries keep their original `enabled` conditions in the feature contracts, including the
  two audience-character queries that the single-page host mounted for every section.
- Export names inside the moved files were not renamed (`SettingAnchor`, `Toggle`,
  `SlurpBackstageApplyBar` and so on). The naming rules apply to filenames, and renaming roughly
  ten shared symbols across every panel would have added churn without a regression to catch a
  mistake. `SlurpBackstageScopeBadge` is the exception: it became `SlpSettingScopeBadge` because it
  moved into the shared module kit.
- `SettingAnchor` takes `settingKey: SlpSettingKey` (a string alias) rather than
  `keyof SlurpSettings`, because the shared kit is a module and may not import a feature. A typo'd
  anchor is caught by the anchor regression rather than the compiler.
- `SlurpBackstageWorkflow.tsx` (1711 lines) stays in `components/slurp/` as migration debt. It is a
  shared editor kit, not a Backstage panel, and splitting it is Slice 10 work.

### Slice 9 pending decisions

None blocking. For Slice 10 to consider:

- `SlurpBackstageWorkflow.tsx` still holds shared editors, presets and formatters in the legacy
  tree; it should become one or more `slp/modules/` files.
- `focusRing` and `quietButton` class constants are now duplicated in
  `features/creators/slp-creator-classes.ts` and `features/maintenance/SlpMaintenanceTask.tsx`.

Both are recorded as Slice 10 deliverables in `SLURP-MODULE-PLAN.md` §10, alongside the
`scripts/typecheck-packages.mjs` syntax-diagnostic gap described under plan corrections.


### Slice 9 handoff — the exact next action for Slice 10

Slice 9 is implementation-complete and validated. PR #937 is open as a draft against
`modular-simping` and is **not** merged. Slice 10 has **not** started.

The next action is **not** to write code. It is:

1. A human runs the six browser checks on the PR checklist against a development Engine instance
   that can start Chromium, because this environment cannot. Nothing about the rendered Backstage
   has been verified in a browser.
2. CodeRabbit reviews PR #937, its threads are resolved, and the PR is marked ready and merged into
   `modular-simping` with `--merge` (never squash).

Only then does Slice 10 begin: create a Slice 10 issue, branch and draft PR from the updated
`origin/modular-simping`, re-run the staging merge gate, and do the final architecture and package
proof — remove every temporary migration accommodation from the architecture regression, confirm the
final tree passes with no size or boundary allowlist (Slice 9 added none), split the remaining
`components/slurp/SlurpBackstageWorkflow.tsx` migration debt, widen
`scripts/typecheck-packages.mjs` to report TS1xxx syntax errors, and run the full validation and
live package lifecycle checks. Do not start Slice 10 until PR #937 is merged.

## Slice ledger

| Slice | Name                                   | State            | Issue / PR       | Package version | Evidence / handoff                                               |
| ----: | -------------------------------------- | ---------------- | ---------------- | --------------- | ---------------------------------------------------------------- |
|   0–1 | Architecture contract and safety rails | in progress      | #914 / no PR yet | 0.0.24          | Validated locally; on `modular-simping`                          |
|     2 | Entrypoints and shared base            | in progress      | #914 / no PR     | 0.0.25          | Validated locally; stacked on 0–1 on `modular-simping`           |
|     3 | Server routes                          | ready for review | #915 / #916      | 0.0.26          | 179-route multiset preserved; CI failures match Slice 2 baseline |
|     4 | Server storage                         | merged           | #918 / #919      | 0.0.27          | Merged into `modular-simping` at `7b9ba1f3`                      |
|     5 | Server services, contracts, workflows  | merged           | #924 / #925      | 0.0.28          | Merged into `modular-simping` at `c945b4a0`                      |
|     6 | Event and modifier seam                | ready for review | #926 / #927      | 0.0.29          | 0 new regression failures; 4 mutants caught; unit rebuilt        |
 |     7 | Client state and hooks                 | merged           | #928 / #929      | 0.0.30          | Merged into `modular-simping` at `4776370a`; focused gate passes |
|     8 | Client app and reusable modules        | in progress      | #931 / #932      | 0.0.31       | Partial: app boundary and coin/poll/story modules; Home/Messages split remains |
|     9 | Backstage                              | ready for review | #936 / #937      | 0.0.32          | Thin host + 17-entry registry; 0 new regression failures vs baseline; no browser proof |
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

| 2026-09-19 |        6 | Plan §4 said the server entry constructs the modifier provider. The only new-subscription charge sits inside one storage transaction (`data/economy/slp-economy-storage-1.ts` `subscribe()`), and `platformEvents` lives in Slurp settings that Backstage edits at runtime, so an entry-built provider would serve a frozen event list until restart. | Maintainer-approved: the consumer builds the provider from the settings snapshot its own transaction already read. Plan §4, the architecture guide, and `DECISIONS.md` updated. |
| 2026-09-19 |        6 | Plan §4 also said `features/world/events/` owns calendar activation, which contradicts §3's allocation ledger (`modules/world/events/`). Under the Slice 5 layer model activation is a pure rule, and three client files import it directly. | Activation stays in `modules/world/events/`. No file moved, so no client import or ownership entry changed. Plan §4 corrected. |
| 2026-09-19 |        6 | Adding two `.default()` fields to `slurpPlatformEventSchema` makes them required on the inferred `SlurpPlatformEvent`, so the Backstage editor's hand-built new-event literal stopped typechecking. | `SlurpPlatformEventsSettings.tsx` gained `kind: "calendar"` and `modifiers: []`. This is the only client change in a server slice, and it is forced by the type. |
| 2026-09-19 |        6 | Storing `source` on a saved modifier lets an event's modifier name another event's id, and nothing would reconcile them. | A saved event stores the effect only (`slpModifierDraftSchema`); the producing source stamps `source` at activation, so a mismatch cannot be represented. |
| 2026-09-19 |        6 | Bumping to `0.0.29` pushed the changelog past the 20-entry published cap, so `0.0.8` rolled off the derived `notes.json` while the splash mirror still carried 21 entries. | Dropped the `0.0.8` splash entry and retargeted `slurp2-release-notes.regression.ts`, as the 0.0.24 bump did for `0.0.3`. |
| 2026-09-19 |        6 | `npm run test:browser:slurp2` needs `MARINARA_ENGINE_ROOT`; without it the runner fails on a missing sibling Engine `package.json`. With it, the Engine dev servers did not come up inside a 400s budget. | The browser suite still produced no result locally, as in Slices 0–5. It needs CI or a host with Playwright system libraries. |
| 2026-09-19 |        6 | CodeRabbit review of PR #927 (Major, valid): `subscribe()` computed one priced value shared by two branches. The second branch renews an *existing* subscription whose paid period lapsed, so a running event would have changed what an existing subscription costs and would have stored the event price as the new agreed price. The automatic sweep (`renewSubscriptions`) was never affected — it always charged the stored price. | Split the value: `basePrice` is the Creator's own price and is what the renewal branch charges and stores, exactly as before Slice 6. Only the genuinely-new-subscription branch applies `slurpSubscriptionCharge`. Regression pins both branches, and two mutants prove it. |
| 2026-09-19 |        6 | CodeRabbit's second finding (Minor) claimed `validate-package-locales.mjs` and `validate-catalog.mjs` fail on missing repository files. | Not reproducible: both pass on the committed tree, before and after the fix, alongside `test-catalog-lanes.mjs`. The failure is an artifact of the review sandbox's checkout, not of this branch. Skipped with that reason recorded on the PR. |
| 2026-09-19 |        7 | The repository architecture rule requires every new non-component file under `slp/` to begin with `slp-`; hook files therefore use `slp-*-hooks.ts`, not `use-slp-*.ts`. | The split consistently uses the established package convention and the architecture regression enforces it. |
| 2026-09-19 |        7 | `SlurpSettings` and eleven other client component files consumed pure settings/rule types from server `slp` files. Leaving those imports in place would violate the approved client/server boundary. | Moved the eight pure rule modules (`slp-tone`, tuning, model budget, modifier schema/types, fan types, population, platform events) into `shared/src/slp/`; all client and server importers now use the one shared definition. Architecture docs, decision log, plan allocation, ownership, and tests were updated. |
| 2026-09-19 |        7 | Bumping to `0.0.30` rolls `0.0.9` off the 20-entry release-note window. | Added the `0.0.30` changelog/splash entry, removed the rolled-off `0.0.9` splash entry, and updated the release-note regression without weakening its cap or acknowledgement assertions. |
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
5. **Resolved 2026-09-19 — client imports server rule files.** The maintainer chose the pure shared
   rule-module move. Slice 7 moved all eight dependency-closed rule modules to `shared/src/slp/`,
   rewrote every client and server importer, and added the boundary decision and regression proof.

## Slice 7 start proof

- Slice 6 merge gate: PR #927 is `MERGED` into `modular-simping` at `26a80fe7`; the generated
  `0.0.29` payload, manifest, ZIP, and all three catalog lanes are present.
- `origin/staging` (`ccf4421f`) is an ancestor of `origin/modular-simping`; no staging merge and no
  generated-output rebuild for conflicts was needed.
- Branch `slurp2-slice7-client-state-hooks` created from `origin/modular-simping` `26a80fe7`.
- Node: `/home/dev/.nvm/versions/node/v24.18.0/bin`, `v24.18.0`.
- Engine: `/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`, branch `welcome-to-the-agentshop`,
  commit `fdb67d47b`, tracked files clean, 4 ahead / 39 behind Engine `origin/staging` after a fresh
  fetch; used unchanged, as in Slices 0-6.
- Client inventory re-derived from the tree, not from history: `hooks/use-slurp.ts` is 3,709 lines
  with 213 exported names; `hooks/use-slurp-media-src.ts` 147; `hooks/use-creator-personas.ts` 27
  (generic Engine hook, stays outside Slurp); `lib/api-client.ts` 499 (package-owned exception,
  stays); `lib/slurp-discovery.ts` 127; `lib/slurp-refresh-batch.ts` 32;
  `stores/slurp-package.store.ts` 186.
- Query-key factories in the client tree: exactly two, `noodleKeys` (exported, `use-slurp.ts:88`)
  and the module-local `messageKeys` (`use-slurp.ts:3123`). No other `*Keys = {` factory exists.
- Live importers of `hooks/use-slurp.ts`: 33 files under `components/slurp/` and 22 test files.

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

### Slice 7 (0.0.30)

[Issue #928](https://github.com/Pasta-Devs/Marinara-Agents/issues/928); draft
[PR #929](https://github.com/Pasta-Devs/Marinara-Agents/pull/929) to `modular-simping`; branch
`slurp2-slice7-client-state-hooks` from merged Slice 6 commit `26a80fe7`. Both issue and PR are
assigned to `Gunterlie`; human verification checkboxes remain unchecked. Implementation commit
`40407635`. Slice 7 is not merged and Slice 8 has not started.

**Client state and hook split.** The 3,709-line `hooks/use-slurp.ts` monolith is deleted with no
shim. Its 213 exported names each have exactly one definition under `client/src/slp/`. The moved
files are:

- base state/media: `slp-query-keys.ts`, `slp-state-types.ts`, `slp-page-cursor.ts`,
  `slp-host-connections.ts`, `slp-package-store.ts`, and `slp-media-src.ts`;
- ads: `slp-ads-hooks.ts`;
- audience: `slp-audience-contract.ts`, `slp-audience-hooks.ts`,
  `slp-ambient-profile-hooks.ts`, and `slp-fan-activity-hooks.ts`;
- creators: `slp-creators-contract.ts`, `slp-creators-hooks.ts`,
  `slp-creator-profile-hooks.ts`, `slp-creator-refresh-hooks.ts`, and `slp-refresh-batch.ts`;
- discovery: `slp-discovery.ts` and `slp-discovery-tag-hooks.ts`;
- economy: `slp-economy-contract.ts` and `slp-economy-hooks.ts`;
- feed: `slp-feed-contract.ts`, `slp-feed-post-hooks.ts`, `slp-feed-viewer-hooks.ts`, and
  `slp-feed-schedule-hooks.ts`;
- maintenance: `slp-backup.ts`, `slp-maintenance-hooks.ts`, and `slp-improvement-hooks.ts`;
- messages: `slp-messages-contract.ts`, `slp-message-keys.ts`, `slp-messages-hooks.ts`,
  `slp-message-action-hooks.ts`, and `commissions/slp-commission-hooks.ts`;
- notifications: `slp-notifications-contract.ts` and `slp-notification-hooks.ts`;
- onboarding: `slp-first-post-hooks.ts`;
- projects: `slp-projects-contract.ts` and `slp-projects-hooks.ts`;
- settings: `slp-settings-contract.ts`, `slp-settings-hooks.ts`,
  `slp-image-connection-hooks.ts`, and `slp-post-guidance-hooks.ts`.

No standalone world or backstage query-hook group existed in the current monolith; those consumers
compose the owning feature hooks above. `SlurpHome.tsx`, `SlurpMessages.tsx`, and all reusable visual
modules remain in place for Slice 8. The largest new client architecture file is 356 physical lines;
no new file exceeds 800.

**Keys, behaviour, and ownership.** `noodleKeys` has its sole definition in
`base/state/slp-query-keys.ts`; the feature-local `messageKeys` has its sole definition in
`features/messages/slp-message-keys.ts`. The focused regression freezes the complete `noodleKeys`
source and message root, the endpoint/HTTP-method multiset, all 213 exports, and cache wiring counts:
130 mutations, 186 queries, 5 infinite queries, 124 invalidations, 15 `setQueryData`, 5
`cancelQueries`, one removal, one refetch, two optimistic mutations, three error handlers, and three
settled handlers. Shared invalidator call counts remain messages 21, projects 5, viewer-shell merge 3.
No client `slp` file imports server `slp` code. `use-creator-personas.ts` remains the generic Engine
hook outside Slurp, and the package-owned `client/src/lib/api-client.ts` host override remains owned
and in place. `slurp2OwnedSourcePaths` already owns all three `slp` roots and retains only the API
client exception; obsolete hook/lib/store ownership entries were removed.

**Source-test migration.** The historical logical key `packages/client/src/hooks/use-slurp.ts` maps
to its 37 current state/contract/hook files in `tests/slurp2-source.ts`; the four satellite keys map
individually to package store, media source, discovery, and refresh-batch destinations. Existing
positive and negative assertions were preserved. `tests/slurp2-client-hooks.regression.ts` adds the
focused coverage, key, endpoint/method, mutation/invalidation, feature ownership, generic-hook,
API-client, client/server-boundary, and architecture checks.

**Shared rule correction.** Eight dependency-closed pure rule modules moved from server `slp` to
`shared/src/slp`: tone, tuning, model budget, modifier schema/types, fan types, population, and
platform events. Every client/server importer uses those single definitions. The plan allocation,
architecture guide, dated decision, architecture regression, source mappings, and builder ownership
were updated; no compatibility copy or client-to-server import remains.

**Validation.** Node `/home/dev/.nvm/versions/node/v24.18.0/bin/node` (`v24.18.0`); Engine
`/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`, branch `welcome-to-the-agentshop`, commit
`fdb67d47bfb909f013346afdb3d2c23d72d7b399`, tracked files clean after validation, 4 ahead / 39
behind Engine `origin/staging`; build used it unchanged with `MARINARA_ENGINE_ROOT` explicit.

- `tests/slurp2-architecture.regression.ts` and `tests/slurp2-client-hooks.regression.ts` — pass.
- `npm run check` — pass (0 errors; repository warnings remain).
- `node scripts/typecheck-packages.mjs slurp2` — pass: no undefined names or unresolved modules.
- `npm run test:noodle:regressions` — exits at the pre-existing
  `noodler-content-formats.regression.ts` assertion on both Slice 7 and clean Slice 6.
  Independent per-file sweep: Slice 7 179 pass / 25 fail; Slice 6 178 pass / 25 fail. Failure sets
  are identical; Slice 7's extra pass is the new focused regression. No new regression failure.
- `node scripts/test-catalog-lanes.mjs`, `node scripts/validate-package-locales.mjs`,
  `node scripts/validate-catalog.mjs`, and
  `node scripts/tests/catalog-release-notes.regression.mjs` — pass (`v2=38`, `v3=38`, legacy=v2).
- `git diff --check` — pass.
- `npm run test:browser:slurp2` — Engine server/client startup succeeded, but Chromium could not
  launch because the host lacks `libnspr4.so`; all 14 desktop/mobile cases are environment-blocked,
  not claimed as passed. Live install, update, restart, offline restart, and uninstall were not run.

**Generated unit.** Builder-produced `artifacts/slurp2-0.0.30.zip` is 6,725,108 bytes, sha256
`290d613cc088be535733f931769ab501a3bc9f85d19deef53d4af99a82d496c6`. It contains exactly
`manifest.json`, `agents.json`, `server.mjs`, `client.js`, `slurp2-logo.png`, and `slurp2agent.png`.
Every manifest payload sha256 and byte count matches; all three catalog lanes point to that ZIP with
the same hash and size. Generated payloads, manifest, ZIP, catalog entries, hashes, sizes, notes, and
release metadata came from the builder; none was hand-edited.

### Slice 6 (0.0.29)

Issue #926; draft PR #927 to `modular-simping`; branch `slurp2-slice6-event-modifier-seam` from
`origin/modular-simping` `7324d634`.

**Merge gate (re-verified, not assumed).**

- `gh pr view 925`: `state MERGED`, `baseRefName modular-simping`, `mergedAt 2026-09-18T21:35:58Z`,
  merge commit `c945b4a0`. `git merge-base --is-ancestor c945b4a0 origin/modular-simping` = true.
- Slice 5 generated outputs present and matching this ledger: manifest `0.0.28`,
  `artifacts/slurp2-0.0.28.zip` sha256 `90d890370f807e0353e45311071ffc534ddef6b50901f29bc7a3a26ba0ed4808`,
  6722866 bytes, and one `slurp2-0.0.28` entry in each of `catalog/v2`, `catalog/v3`, and the legacy alias.
- Slice 5 focused regressions on the merged branch: `slurp2-architecture`, `slurp2-storage-methods`,
  `slurp2-route-inventory`, `slurp2-platform-events`, `slurp2-creator-pricing`, `slurp-wallet` — all pass.
  `node scripts/typecheck-packages.mjs slurp2` passes.
- `origin/modular-simping` was 21 ahead / 4 behind `origin/staging`. Maintainer approved an ordinary
  `--no-ff` merge pushed to `modular-simping` as `7324d634`; no conflicts, so nothing generated was
  rebuilt. `node scripts/validate-catalog.mjs` passes on the merge (38 packages; preview overlay valid).
- No slice commit was pushed to `modular-simping`. Nothing was reset, rebased, or force-pushed.

**What changed.**

- New `base/modifiers/`: `slp-modifier.types.ts` (47 lines), `slp-modifier-schema.ts`,
  `slp-modifier-resolver.ts`, `slp-active-modifier-provider.ts`. All four are under the existing
  `packages/server/src/slp` ownership root, so no ownership entry changed.
- `modules/world/events/slp-platform-events.ts` (129 → 191 lines): added `kind: "calendar"` and
  `modifiers`, both `.default()`ed so saved rows parse unchanged; moved activation into
  `ACTIVATION_BY_KIND`, keeping the UTC and year-wrap arithmetic byte-identical; added
  `slurpActivePlatformEventModifiers` and `slurpPlatformEventModifierSource`.
- `modules/economy/slp-creator-pricing.ts`: added `slurpSubscriptionCharge(base, provider, at)`,
  which rounds once and clamps to the existing `0..9999` range.
- `data/economy/slp-economy-storage-1.ts` `subscribe()`: `at` now precedes `price`, and the new
  charge goes through the seam. Renewal is untouched — it charges the stored agreed price.
- `SlurpPlatformEventsSettings.tsx`: the new-event literal gained the two defaulted fields.
- Version, changelog `0.0.29`, splash mirror (with `0.0.8` rolled off), and
  `tests/slurp2-release-notes.regression.ts` retargeted.

**Preservation proof.**

- New `tests/slurp2-event-modifiers.regression.ts` covers every bullet in plan §8 "Modifier
  behaviour": the active `0.5` multiplier halves the charge (100 → 50) and the inactive one does
  not; a disabled event never applies; rounding happens once (7 → 4); the result clamps at both
  ends; multiplies precede adds; overlapping events resolve identically in either save order;
  each modifier is stamped with its owning event; evaluation mutates nothing; the same timestamp
  gives the same answer after a settings round-trip; the eight schema rejections all fail; a broken
  modifier is dropped without dropping its event or the list; at most eight modifiers survive; and
  `renewSubscriptions` still charges the stored price.
- Not vacuous — four mutants, each caught: resolver ignores `multiply`; provider skips sorting;
  charge skips the clamp; activation ignores `enabled`. Baseline green again after restoring all four.
- `slurp2-platform-events.regression.ts` is unchanged and still passes, which is the proof that the
  eight default events kept their ids, dates, durations, and guidance.
- The new test also asserts `subscribe()` never calls `setCreatorSubscriptionPrice`, so an event
  cannot rewrite a Creator's stored price.

**CodeRabbit review fixes (PR #927).**

- *Major, accepted.* `subscribe()` shared one priced value between the new-subscription branch and
  the branch that renews an existing subscription after its paid period lapsed. Now `basePrice` (the
  Creator's own price, no modifier) is what the renewal branch spends, stores, credits, notifies and
  records on the audience tie — byte-for-byte the pre-Slice-6 behaviour — and only the genuinely new
  subscription goes through `slurpSubscriptionCharge`. The automatic sweep `renewSubscriptions` was
  never in scope: it charges `subscription.price` from the wallet and is untouched.
- The regression now asserts `slurpSubscriptionCharge` appears exactly once in the file, that it
  starts from `basePrice`, and that the renewal branch mentions no modifier and stores
  `price: basePrice`. Two further mutants (renewal re-prices through the event; renewal stores a
  different price) are both caught, and the source is identical to pre-mutation afterwards.
- *Minor, skipped with reason.* The claim that `validate-package-locales.mjs` and
  `validate-catalog.mjs` fail on missing files is not reproducible: both pass on the committed tree
  before and after the fix. It is an artifact of the review sandbox's checkout.
- Rebuilt `0.0.29` in place rather than bumping again, because the plan allows one integration patch
  bump per PR and Slice 5 handled its own review fix the same way. Full suite re-run after the fix:
  still 25 failures / 203 files, the identical set — 0 new, 0 fixed.

**Commands.**

- `npm run check`: passes, 0 errors (1009 pre-existing warnings, same as Slice 5).
- `node scripts/typecheck-packages.mjs slurp2`: `no undefined names or unresolved modules`.
- `tests/slurp2-architecture.regression.ts`: passes, 0 violations, no new exception added.
- `slurp2-route-inventory` (179 routes) and `slurp2-storage-methods`: pass.
- Full per-file suite compared against the branch point `7324d634` (the suite exits at its first
  failure, so each file was run alone): baseline 25 failures / 202 files, after 25 failures / 203
  files. The failing set is **identical** — 0 new, 0 fixed. The extra file is this slice's new test.
- `node scripts/test-catalog-lanes.mjs`, `validate-package-locales.mjs`, `validate-catalog.mjs`,
  `scripts/tests/catalog-release-notes.regression.mjs`, `git diff --check`: all pass.
- `npm run test:browser:slurp2`: no result. It needs `MARINARA_ENGINE_ROOT`, and with it the Engine
  dev servers did not start inside a 400s budget. Unresolved environment gap, as in Slices 0–5.
- Build: `MARINARA_ENGINE_ROOT=/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish node scripts/build-feature-packages.mjs slurp2`.
  `git status` shows exactly one generated unit: `client.js`, `server.mjs`, `manifest.json`, the three
  catalog lanes with their `notes.json`, and the new `artifacts/slurp2-0.0.29.zip`.
- No live install/update/restart or uninstall test was performed, and no dev box was used. The
  human-verification boxes on issue #926 and PR #927 are unchecked.

**Engine source.** `/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`, branch
`welcome-to-the-agentshop`, commit `fdb67d47b`, tracked files clean; 4 ahead / 39 behind Engine
`origin/staging` after a fresh fetch. Used unchanged; no Engine integration was performed, so build
deltas stay comparable with Slices 0–5.

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

Review draft PR #940 (issue #939) and merge it into `modular-simping` after human review and
required checks. The Slice 10 PR is **not** merged by the implementation agent and the final
`staging` release PR is **not** open.

After PR #940 merges, resolve pending decision 1: either open Slice 11 for the remaining seven
`components/slurp/` files, or accept `packages/client/src/components/slurp` in the final ownership
list. Only then open the final PR that merges `modular-simping` into `staging` as Slurp2 `0.1.0`
(one changelog entry, the integration-only `0.0.x` ZIPs removed, one rebuild, and the full live
lifecycle proof on `dev-marinara2` once that box is reachable).

Earlier items:

1. Review draft PR #929 (issue #928) and merge it into `modular-simping` only after human review and
required checks. Do not start Slice 8 until PR #929 is merged. Then create a new Slice 8 issue,
branch, and draft PR from the updated `origin/modular-simping`; re-run the staging/Slice 7 merge
gate; and split the client app/screens and reusable visual modules without reopening the Slice 7
state ownership, duplicating query keys, or moving server logic into the client. Begin with the
current `SlurpHome.tsx`, `SlurpMessages.tsx`, and remaining `components/slurp/` importer graph as
authoritative. Pending decisions 3 and 4 remain open and are not Slice 7 blockers.

Earlier items:

1. After Slice 10, open the final PR `modular-simping` → `staging` as Slurp2 `0.1.0` (one changelog
   entry, integration-only `0.0.x` ZIPs removed, one rebuild, full live lifecycle proof).
