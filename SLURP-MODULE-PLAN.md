# Slurp Modular Architecture — Implementation Plan

Input: `SLURP-MODULE-MAP.md`. This document supersedes the earlier Step 2 tree and migration sequence.
All source paths below are relative to `packages/slurp2/src/engine/` unless stated otherwise.

## 1. Goal and invariants

Refactor Slurp2 from large technical buckets into stable package-owned namespaces with feature-first
modules. The work changes source structure and extension seams, not current user-visible behaviour.

The following must remain unchanged throughout the migration:

- package id `slurp2`, manifest permissions, Engine compatibility, and generated entrypoint names;
- `/api/slurp2` and `/noodler/*` route paths;
- `slurp2_*` tables, existing `noodle*` persisted identifiers, storage keys, and stored JSON shapes;
- `ui.slurp.*` locale keys and the four shipped locale catalogs;
- existing subscription semantics: a subscription stores its agreed price and renews at that price;
- the eight default platform events, their UTC calendar behaviour, and their prompt guidance;
- the public method set returned by `createSlurpStorage`;
- all 179 HTTP routes and the shared mutable state currently created by the route module;
- Garnish as a separate module with no import from Garnish back into Slurp.

No re-export shims, duplicate old/new source trees, dependency additions, blanket Noodle rename, or
hand edits to generated payloads, manifests, artifacts, catalogs, hashes, or sizes.

## 2. Source boundaries and naming

### Primary ownership roots

```text
packages/client/src/slp/
packages/server/src/slp/
packages/shared/src/slp/
```

`shared/src/slp/` is intentionally narrow. It contains only pure code imported by both client and
server; initially this is the autopurge date calculation. It may not import client or server code.

Two explicit exceptions remain outside these roots:

- `packages/client/src/lib/api-client.ts` is a package-owned Engine host override used by the
  Engine-generic `use-creator-personas.ts`; moving it would require forking that generic hook.
- `packages/server/src/services/garnish-ads/` is a separate reusable module and remains a sibling of
  Slurp. It receives its own ownership entry so it cannot leak into `sources/engine`.

`packages/client/src/hooks/use-creator-personas.ts` remains unowned and byte-identical to Engine.

### File naming

- React component files and component symbols: `SlpName.tsx`.
- Other Slurp implementation files: `slp-name.ts` or `slp-name.tsx`.
- Nested folders use concise domain nouns without repeating `slp`.
- Avoid generic `index.ts` barrels. Import the concrete file or an explicit feature contract.
- A submodule receives a folder only when it contains multiple cohesive files or is a deliberate
  expansion seam such as `events`, `commissions`, or `reserve`.
- Existing externally meaningful Slurp/Noodle symbol names may remain when renaming them would alter
  a persisted or public contract. New private symbols follow the `Slp`/`slp` convention.

## 3. Target architecture

### Client

```text
packages/client/src/slp/
├── slp-client-entry.tsx
├── app/
│   ├── SlpApp.tsx
│   ├── SlpRouter.tsx
│   └── screens/                 one file per navigation destination
├── base/
│   ├── api/                     Slurp API adapter and error helpers
│   ├── chrome/                  shell, logo, avatar, popover, visual tokens
│   ├── media/                   image rendering, composition, crop, media hook
│   ├── state/                   package store, query keys, cross-cutting types
│   └── ui/                      small domain-neutral Slurp controls
├── modules/
│   ├── creator/                 reusable Creator card/avatar/badge
│   ├── post/                    post cards, context, markdown
│   ├── story/                   Story tile and strip
│   ├── poll/                    poll card and composer
│   └── coin/                    SlurpCoin presentation and formatting
├── features/
│   ├── creators/                profile, editor, source picker, bulk edit, improvement
│   ├── feed/                    feed, composer, media wall, post dialogs
│   ├── messages/
│   │   └── commissions/
│   ├── discovery/
│   ├── audience/
│   ├── projects/
│   ├── economy/
│   ├── notifications/
│   ├── world/
│   │   └── events/
│   ├── ads/
│   ├── onboarding/
│   ├── maintenance/
│   └── backstage/               shell, navigation, controls, panel registry
└── locales/                     en, de, ko, pl; keys unchanged
```

Client dependency direction:

```text
base <- modules <- features <- app
```

- `base/` imports neither modules nor features.
- `modules/` render from props and import no feature.
- a feature may import base and modules, but not another feature's internal files;
- `app/` composes features and owns navigation, but contains no domain logic;
- Backstage panels live with their owning feature; `features/backstage/` owns only the shell,
  save contract, search/deep-link behaviour, and one explicit panel registry.

### Server

```text
packages/server/src/slp/
├── slp-server-entry.ts
├── base/
│   ├── host/                    Fastify/DB adapters, viewer projection, multipart transport
│   ├── settings/                schema, defaults, normalization, settings persistence
│   ├── prompting/               prompt text and formatting; no model calls
│   ├── media/                   image/media rules and generation support
│   ├── identity/                source binding, handles, disclosure, protection
│   ├── model/                   budgets, workers, answers, tuning
│   ├── locking/                 operation locks and activation lifecycle
│   └── modifiers/               typed, pure cross-feature modifiers
├── features/
│   ├── creators/
│   │   └── improvement/
│   ├── feed/
│   │   └── reserve/
│   ├── messages/
│   │   └── commissions/
│   ├── audience/
│   ├── world/
│   │   └── events/
│   ├── projects/
│   ├── economy/
│   ├── notifications/
│   ├── discovery/
│   ├── ads/
│   ├── onboarding/
│   └── maintenance/
└── workflows/
    ├── slp-subscription-workflow.ts
    ├── slp-world-tick-workflow.ts
    └── slp-notification-workflow.ts
```

Each server feature colocates its routes, storage facet, schema/table definitions, services, types,
and submodules. Feature internals do not import another feature's internals.

When another module needs a feature capability, that feature exposes the smallest explicit
`slp-<feature>-contract.ts`. Workflows depend only on these contracts. `slp-server-entry.ts` creates
the implementations and wires them into workflows and route mounts.

Dependency direction:

```text
base <- feature internals <- feature contracts <- workflows <- server entry
```

The entrypoint and workflows may compose features. A feature may use `base/` but cannot import a
workflow. Cross-feature behaviour currently buried inside the storage and route monoliths moves to
workflows only when it already coordinates multiple domains; do not manufacture wrappers for
single-feature operations.

### Allocation ledger

The following placements are fixed; they are not implementation-time naming decisions.

| Current source | Target ownership |
|---|---|
| `slurp.routes.ts` settings handlers | `base/settings/slp-settings-routes.ts` |
| route schemas, multipart transport, viewer projection | `base/host/slp-request-schemas.ts`, `slp-multipart.ts`, `slp-viewer-context.ts` |
| image/media transport routes | `base/media/slp-media-routes.ts` |
| creator/profile/improvement routes | `features/creators/`, with improvement jobs under `improvement/` |
| posts, feed, interactions, publishing routes | `features/feed/slp-feed-routes.ts` |
| message routes | `features/messages/slp-messages-routes.ts` |
| audience/fan/reach routes | `features/audience/slp-audience-routes.ts` |
| world-event configuration and catch-up | `features/world/events/` plus `slp-world-tick-workflow.ts` |
| projects, arcs, goals | `features/projects/` |
| wallet, prices, earnings, payments | `features/economy/` |
| activity-feed notification endpoints | `features/notifications/` |
| ads | `features/ads/` using the separate Garnish contract |
| setup and first-post queue | `features/onboarding/` |
| backup, restore, autopurge | `features/maintenance/` |
| settings schema/defaults/storage | `base/settings/` |
| DB helpers, missing-table tolerance, file errors | `base/host/` |
| creator storage and tables | `features/creators/` |
| post/feed/interaction/reserve storage and tables | `features/feed/`, with reserve under `reserve/` |
| message/reply/commission storage and tables | `features/messages/`, with commissions under `commissions/` |
| audience/population storage and tables | `features/audience/` |
| wallet/earnings/payment storage and tables | `features/economy/` |
| project/arc/goal storage and tables | `features/projects/` |
| platform-event settings/evaluation | `features/world/events/` |
| notification event stream | `features/notifications/` |
| `use-slurp.ts` query keys and common types | `client base/state/` |
| `use-slurp.ts` domain hooks | corresponding client feature folder |
| `SlurpHome.tsx` router and navigation branches | `app/`, `app/screens/`, and owning features |
| reusable post/Creator/Story/poll/coin rendering | matching client `modules/` folder |
| `SlurpMessages.tsx` | `features/messages/` and `features/messages/commissions/` |
| Backstage shell/search/save/deep links | `features/backstage/` |
| Backstage setting bodies | the feature whose setting they control |

These concepts deliberately do not become top-level features:

- Stories are reusable content under `modules/story/` and are composed by Feed.
- Tags belong to Discovery.
- Wallet belongs to Economy.
- Goals and arcs belong to Projects.
- Commissions are a Messages submodule.
- Reserve is a Feed submodule.
- Calendar events are a World submodule, distinct from the Notifications activity feed.

The full current-function inventory and monolith line ranges remain in `SLURP-MODULE-MAP.md` and
are the extraction checklist. If an item does not match this ledger, stop and update the plan rather
than inventing a new top-level domain during implementation.

## 4. Cross-feature event modifiers

Platform events currently provide prompt guidance only. Extend that seam with a small pure numeric
modifier contract, not a general event bus.

### Base contract

Create:

```text
base/modifiers/slp-modifier.types.ts
base/modifiers/slp-modifier-schema.ts
base/modifiers/slp-modifier-resolver.ts
base/modifiers/slp-active-modifier-provider.ts
```

The initial contract has:

```ts
type SlpModifierTarget = "economy.subscription-price";
type SlpModifierOperation = "multiply" | "add";

type SlpModifier = {
  target: SlpModifierTarget;
  operation: SlpModifierOperation;
  value: number;
  source: { kind: "platform-event"; id: string };
};
```

The initial target uses these fixed bounds: `multiply` accepts `0..10`, `add` accepts
`-9999..9999`, and one event may contain at most eight modifiers. The schema rejects unknown
targets/operations, non-finite values, and values outside those bounds. Saved event settings are
normalized leniently as today: an invalid modifier is dropped without dropping the event or the
whole event list. `SlurpPlatformEvent` gains `kind: "calendar"` and `modifiers: SlpModifier[]`, both
with defaults so existing saved rows parse unchanged.

Resolution is pure and deterministic:

1. select modifiers for one target;
2. sort by `source.kind`, then `source.id`;
3. apply `multiply` modifiers in sorted order;
4. apply `add` modifiers in sorted order;
5. let Economy round once with `Math.round` and clamp the final subscription charge to the existing
   `0..9999` price range after all modifiers have been applied.

The provider is constructed by the server entry with active modifier sources and receives the
evaluation timestamp from its caller. It has no global clock capture, global registry, or module
side effects.

### World producer and economy consumer

`features/world/events/` owns calendar activation and turns active event definitions into prompt
guidance plus modifier descriptors. Economy receives the provider through its explicit contract and
asks for `economy.subscription-price` modifiers when calculating a new subscription charge.

An event does not rewrite creator prices or wallets when it starts, and no cleanup runs when it
ends. Re-evaluation from current settings and time makes the behaviour restart-safe and handles
overlapping events deterministically.

A synthetic regression event with a `0.5` multiplier proves that a new subscription charge is
halved. No real sale is added to the default event catalog in this refactor. Existing subscriptions
continue renewing at their stored agreed price.

If a later feature needs a non-numeric cross-feature reaction, design that contract when the real
use case exists; do not stretch the numeric modifier layer into a general message bus.

## 5. Ownership and builder changes

Stop spreading `slurpOwnedSourcePaths` into `slurp2OwnedSourcePaths`; the shared array belongs to
frozen legacy Slurp. The final Slurp2 ownership list is:

```text
packages/shared/src/slp
packages/client/src/slp
packages/client/src/lib/api-client.ts
packages/server/src/slp
packages/server/src/services/garnish-ads
```

Update the Slurp2 feature descriptor in the same change that moves the entrypoints:

```text
serverImport: packages/server/src/slp/slp-server-entry.ts
clientImport: packages/client/src/slp/slp-client-entry.tsx
```

Do not edit `slurpOwnedSourcePaths`. After the first rebuilt package, confirm the builder removes
the contaminated `sources/engine/packages/server/src/services/garnish-ads/` snapshot through
`removeOwnedSourceSnapshots`; do not hand-delete generated snapshots.

The final list must not land before the moves. Use a transitional ledger:

1. PR 1 inlines Slurp2's complete current ownership list, adds `garnish-ads`, and removes only the
   two deleted custom-emoji entries. No existing live ownership entry is removed.
2. PR 2 adds the three new `slp` roots when their first files move, then removes the old entrypoint,
   locale, and shared-autopurge entries whose last files moved. The package-store entry remains
   until PR 7 moves it into `base/state/`.
3. Each later PR removes an old route, storage, service, hook, lib, or component entry only when the
   last live file beneath that old boundary has moved into a new root.
4. The final architecture PR asserts that the ownership list is exactly the five entries above and
   that no package-specific Slurp source remains outside them.

This ordering keeps every intermediate commit buildable and prevents package source from being
captured into generic `sources/engine` material.

Add `TS2307` to `scripts/typecheck-packages.mjs`'s reported diagnostics before moving imports, so an
unresolved module fails package typechecking. Keep ignored-global filtering specific to
TS2304/TS2552; TS2307 has a different diagnostic shape and must not reuse the missing-name capture.

## 6. Permanent architecture guidance

The refactor must leave behind rules that future humans and coding agents encounter before editing
Slurp. Documentation and executable checks are both required; either one alone will drift.

Create:

```text
packages/slurp2/AGENTS.md
packages/slurp2/docs/architecture/
├── README.md
├── ADDING-A-MODULE.md
└── DECISIONS.md
tests/slurp2-architecture.regression.ts
SLURP-MODULE-STATUS.md
SLURP-MODULE-SLICE-0-1-HANDOFF.prompt.md
SLURP-MODULE-SLICE.prompt.md
```

`packages/slurp2/AGENTS.md` is short and normative. It requires an agent working anywhere under the
package to read the architecture guide, preserve package-generation rules, run the architecture
regression, and update the guide when intentionally changing a boundary. It points to the root
repository rules rather than duplicating them.

`docs/architecture/README.md` records:

- the client/server/shared trees and allowed dependency direction;
- the difference between base modules, reusable client modules, features, contracts, workflows,
  and app composition;
- the ownership exceptions for the API-client host adapter and Garnish;
- naming rules, placement examples, forbidden imports, and the modifier/workflow patterns;
- the rule that persisted names and public API paths are not casually renamed during source work.

`ADDING-A-MODULE.md` is the practical checklist: identify the owning domain, start feature-local,
promote to `modules/` only after a second real feature needs it or when it is an explicit domain
primitive, expose the smallest contract, add focused proof, update the Backstage registry if
needed, rebuild the package, and verify generated outputs.

`DECISIONS.md` is an append-only short decision log for future boundary changes. Each entry states
date, problem, decision, affected modules, rejected alternative, and migration consequence. Do not
create a folder of one-file ADRs until the single log becomes hard to navigate.

The architecture regression enforces, for the three `slp` roots:

- dependency direction and contract-only cross-feature imports;
- no package-specific implementation outside the final ownership roots and named exceptions;
- `slp-`/`Slp` filename conventions;
- no generic `index.ts` barrels;
- `shared/src/slp/` imports neither client nor server code; client and server may import shared code;
- no new file above 800 physical lines. Files should normally stay below 400 lines; crossing 400 is
  a review prompt, while 800 is the automated ceiling. Generated files and locale JSON are excluded.

The target architecture has no permanent size allowlist. During migration, the regression checks
only files already moved into a new `slp` root, so old monoliths remain visible debt without making
the safety rail vacuous. A monolith cannot enter the new namespace unchanged if it exceeds the
ceiling; it must be split into cohesive files as part of its move.

`SLURP-MODULE-STATUS.md` is the living execution ledger. Every implementation agent updates it when
starting a slice, after any material discovery, and before handoff. It records slice state,
issue/PR/branch/commit, package version and artifact, validation evidence, blockers, plan deviations,
and the exact next action. The plan remains the architectural source of truth: agents update this
plan only for verified factual corrections or approved architectural changes, never merely to mark
progress. Any unapproved design deviation is recorded as pending in the status file and not silently
implemented.

The two prompt files are versioned operating procedures: the first bootstraps the combined safety
batch, and the second is copied and filled for each later slice. `SLURP-MODULE-MAP.md`, this plan,
the status ledger, and both prompt files enter version control in the initial PR. The earlier
Step 1/Step 2 research prompts are not required runtime guidance and remain optional local history.

## 7. Migration sequence

### Integration branch and release

Staging users receive the refactor once, as Slurp2 `0.1.0`, never as intermediate versions.

- `modular-simping` is the long-lived integration branch. Every slice is a separate reviewable PR
  that targets `modular-simping`, not `staging`. Open/link an issue and draft PR before
  implementation, assign both to `Gunterlie`, and keep the PR draft until its focused and baseline
  validation passes. "Merged" in this plan means merged into `modular-simping`.
- Slices 0 and 1 land together as the initial safety-rails work because their documentation,
  architecture regression, source-map helper, ownership correction, and typecheck correction are
  mutually reinforcing prerequisites and move no live implementation module.
- Each source-changing slice still rebuilds Slurp2, commits the complete generated release unit, and
  bumps the `0.0.x` patch version once, so dev-box installs can detect each slice. These versions
  exist only on the integration branch; the Engine reads only `staging` and `main` catalogs, so no
  user receives them. Their changelog entries are working notes.
- Keep the integration branch current: merge `origin/staging` into `modular-simping` with an
  ordinary merge (no rebase, no force) at least before each slice starts. Resolve generated-output
  conflicts by rebuilding, never by hand. If a Slurp2 fix on `staging` has reached or passed the
  integration version, bump the integration version above it in that merge.
- The final PR merges `modular-simping` into `staging` after Slice 10. It sets the version to
  `0.1.0` (a deliberate minor release; the usual patch-only rule does not apply), replaces the
  integration-only `0.0.x` changelog and splash entries with one `0.1.0` entry, removes the
  integration-only `artifacts/slurp2-0.0.*.zip` files that no `staging` catalog ever published, and
  rebuilds once. It needs CodeRabbit review and the full live lifecycle proof below.

### 0. Architecture contract

- Add the package-level `AGENTS.md`, architecture directory, and architecture regression described
  above before moving implementation source.
- Add `SLURP-MODULE-MAP.md`, this plan, the status ledger, and both reusable prompt files to version
  control; do not add the obsolete Step 1/Step 2 research prompts unless the maintainer requests it.
- Record this refactor as the first decision in `DECISIONS.md`.
- Make the regression tolerate absent new roots, but prove it fails against temporary fixtures for
  each forbidden import, filename, barrel, and size rule so the initial green result is not vacuous.
- Add the architecture regression to the Slurp regression glob; no new runner is introduced.

This slice shares the initial PR with Slice 1. Slice 0 alone would not rebuild or version-bump the
package; the combined PR follows Slice 1's rebuild and integration-version requirements.

### 1. Safety rails and ownership

- Unlink Slurp2 ownership from legacy Slurp by inlining its complete current list.
- Claim `garnish-ads`; retain every ownership entry for live source at its current path.
- Add `TS2307` package-typecheck reporting.
- Delete the two confirmed dead custom-emoji files.
- Add `tests/slurp2-source.ts`, mapping historical logical source keys to current file lists.
- Convert the affected source-reading tests to the helper without changing assertions (verified
  2026-09-18: 91 files read a monolith directly, plus the Backstage aggregate helper).

No implementation file moves in this PR.

### 2. Entrypoints and shared base

- Move and rename the client/server entrypoints into their `slp/` roots and update the descriptor.
- Move the autopurge time module to `shared/src/slp/slp-autopurge-time.ts`.
- Move locales beneath `client/src/slp/locales/` without changing any key or translation.
- Add the three new root ownership entries and remove only the now-empty old boundaries covered by
  these moves.
- Establish empty target folders only when the same PR places a real file in them.

### 3. Server routes

- Split `slurp.routes.ts` and `slurp-messages.routes.ts` directly into feature-owned route files.
- Create shared route dependencies once in `base/host/` and inject them into mounts.
- Move the existing improvement runner, backup engine, notification read model, and world catch-up
  coordinator to their target feature/workflow modules rather than leaving domain logic in routes.
- Preserve the exact route multiset and construct mutable maps, sets, and timers once.

### 4. Server storage — point of no return

- Split `slurp.storage.ts` and its ten satellite storage files into feature-owned storage facets.
- Keep settings schema, defaults, normalization, and byte-sensitive legacy prompt defaults together.
- Compose `createSlurpStorage` from facets while preserving its exact public method-name set and
  duplicate-key semantics.
- Move table definitions beside their owning features and aggregate them once for `registerTables`.
- Keep financial operations and compensations atomic across the new facet boundaries.

This is the point of no return because it deletes the old storage boundary, rewrites its callers,
and changes ownership paths together. Do not start it until PRs 1–3 are merged and green.

### 5. Server services, contracts, and workflows

- Move the 149 service files into `base/` and feature folders as pure renames first.
- Rename files to `slp-*` while rewriting imports once; do not mix behavioural cleanup into moves.
- Add feature contracts only for existing cross-feature calls.
- Extract subscription, world-tick, and notification coordination from route/storage internals into
  the named workflows.
- Keep Garnish separate; Slurp's six adapter files move under `features/ads/`.

### 6. Event and modifier seam

- Add the base modifier contract and provider.
- Add `kind: "calendar"` to normalized platform events with a default preserving old saved rows.
- Move calendar activation into a kind dispatch table and keep UTC/year-wrap arithmetic unchanged.
- Have the world-event module expose active prompt guidance and active modifiers from one timestamp.
- Inject the modifier provider into economy price calculation.
- Add only the synthetic regression modifier; do not add a default sale.

### 7. Client state and hooks

- Split `use-slurp.ts` by feature and move shared query keys/types into `base/state/`.
- Keep each query key factory defined once so cache identity does not split.
- Move Slurp-specific discovery, refresh, and media helpers into the new namespace.
- Keep the generic persona hook outside Slurp and preserve the explicit API-client host override.

### 8. Client app and reusable modules

- Split `SlurpHome.tsx` into `app/`, screens, and feature components.
- Split reusable Creator, post, Story, poll, and coin presentation into `modules/`.
- Split `SlurpMessages.tsx` into the messages feature and commissions submodule.
- Reusable modules retain prop-driven APIs and import no feature hooks.
- Do not merge visually different post-card variants or redesign UI during the move.

### 9. Backstage

- Keep Backstage shell, search, save/apply contract, deep-linking, and panel registry together.
- Move every settings panel to its owning feature.
- Use one explicit `{ target, Component }` registry; do not add glob loading or side-effect registration.
- Rewrite the Backstage anchor regression against the registry before moving panels.

### 10. Final architecture and package proof

- Remove every temporary migration accommodation from the architecture regression and verify the
  final tree passes with no size or boundary allowlist.
- Remove historical source-map entries only when no test or documentation uses the logical key;
  retaining stable keys is acceptable and preferred over mass test churn.
- Run the full validation and live package lifecycle checks below.
- Self-review generated payloads, permissions, archive contents, compatibility, and the final diff
  before marking the final PR ready.

## 8. Regression and acceptance proof

### Structural invariants

- Pre/post HTTP route multisets are identical: 179 routes.
- `createSlurpStorage(db)` exposes the identical sorted method-name set.
- each query-key factory has one definition;
- platform-event default count, ids, dates, durations, and guidance are unchanged;
- every non-internal Backstage setting resolves to a registered panel and rendered anchor;
- `base/` imports no feature/workflow;
- client modules import no feature;
- one feature imports another feature only through its explicit contract;
- workflows import feature contracts, never feature internals;
- `shared/src/slp/` imports neither client nor server;
- files outside `services/garnish-ads/` importing Garnish match the reviewed Slurp ads adapter set.
- the package-level architecture guide exists, is referenced by `packages/slurp2/AGENTS.md`, and its
  executable filename, dependency, barrel, ownership, and file-size rules all have negative fixtures.

### Existing-test migration

The verified universe is 142 tests referencing the Slurp2 source tree: 123 read source text, 11
import source only, and 8 merely mention paths or dynamic imports. Preserve all of them.

- Before any split, route the tests reading one of the five monoliths or Backstage aggregate
  through `tests/slurp2-source.ts` (verified 2026-09-18: 91 direct readers plus the 26 consumers of
  `slurp2BackstageSource()`). Historical path strings become stable logical module keys.
- Retarget the 15 tests reading a small service file when that file moves.
- Rewrite the 11 source imports mechanically with their owning move.
- Convert the six tests already importing a pure function as well as reading its source to direct
  behavioural assertions when their module moves.
- Rewrite `slurp2-backstage-anchors.regression.ts` against the panel registry before splitting
  Backstage.
- Do not delete or weaken negative assertions. The source helper concatenates every file belonging
  to a logical module so a negative remains module-wide rather than passing vacuously.

### Modifier behaviour

- an active synthetic `0.5` event modifier halves the calculated new-subscription charge;
- the same inactive event leaves the charge unchanged;
- invalid targets, operations, non-finite values, negative multipliers, and out-of-range values fail
  schema validation or are dropped by saved-event normalization as specified;
- overlapping modifiers resolve in deterministic source order;
- evaluation does not mutate the base price, settings, event definitions, or stored Creator price;
- repeated evaluation at the same timestamp produces the same result after simulated restart;
- existing captured subscription prices and renewals remain unchanged.

### Per-PR validation

Run focused affected regressions, then:

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

The required result is a focused Slurp2 typecheck that reports TS2307 as well as the existing
TS2304/TS2552 checks.

### Build and live verification

- Use Node 24+ and prefer the maintainer-provided Engine worktree at
  `/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`. Before every slice build, record its branch,
  commit, status, and relationship to `origin/staging` in the status ledger.
- If that Engine worktree is clean and already contains the required staging commit, use it as-is.
  If newer staging is required, fetch `origin staging` and integrate `origin/staging` without reset,
  rebase, force, or loss of local commits. Fast-forward when possible; otherwise make an ordinary
  merge only while the worktree is clean. If it is dirty or integration conflicts, do not clean or
  overwrite it—create/select another clean Engine worktree and record the substitute path.
- Do not build from the unrelated dirty `/home/dev/projects/Marinara-Engine` checkout unless its
  owner first clears it.
- Rebuild with
  `MARINARA_ENGINE_ROOT=/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish node scripts/build-feature-packages.mjs slurp2`,
  or the recorded clean substitute path when the preferred worktree cannot be used.
- Confirm payloads, manifest, artifact ZIP, catalogs, hashes, sizes, and changelog/version move as
  one generated unit. Slice PRs use `0.0.x` on `modular-simping`; only the final PR to `staging`
  publishes `0.1.0`, which requires a matching `packages/slurp2/CHANGELOG.md` entry.
- Confirm the ZIP contains only its declared files and all hashes match.
- On `dev-marinara2` only, reserve the box, then exercise install/update, activation, navigation,
  restart, offline restart, and uninstall. Verify phone, tablet, and desktop layouts for affected
  client PRs and inspect screenshots plus browser/network errors.
- Never test this restructure on production `ssh marinara`.

## 9. Deliberate exclusions

- no blanket Noodle/Noodler-to-Slurp rename of routes, tables, stored keys, or public contracts;
- no actual subscription sale or new default platform event;
- no general event bus, plugin registry, or arbitrary-effect payload;
- no Garnish extraction into a separate downloadable package;
- no visual redesign or merging of superficially similar components during structural moves;
- no custom ESLint plugin when a focused architecture regression can enforce the boundary;
- no compatibility-range widening, permission changes, or data migration.
