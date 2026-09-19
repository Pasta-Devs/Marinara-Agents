# Slurp2 architecture decisions

Append-only. Add new entries at the bottom. Each entry states the date, problem, decision, affected
modules, rejected alternative, and migration consequence.

## 2026-09-18 — Feature-first `slp` namespace

- **Problem:** Slurp2 grew from legacy Noodle/Slurp code into five very large route, storage, hook,
  and UI files plus a flat service directory. Cross-feature coupling was implicit, and new features
  had no clear place or extension seam.
- **Decision:** Move Slurp2 into package-owned `client/src/slp`, `server/src/slp`, and a narrow
  `shared/src/slp`. Organise each root as base → reusable modules (client) → features → app or
  workflows → entry. Features talk to each other only through `slp-<name>-contract.ts` files.
  Platform events reach other features through pure typed modifiers. `api-client.ts` and Garnish
  remain named exceptions. Rules are enforced by `tests/slurp2-architecture.regression.ts`.
- **Affected modules:** all Slurp2 source; `scripts/build-feature-packages.mjs` ownership;
  `scripts/typecheck-packages.mjs`; Slurp2 source-reading tests.
- **Rejected alternative:** keeping code in Engine technical folders (`routes/`, `services/`,
  `hooks/`, `components/`) with smaller files. It gave no durable Slurp namespace and no clean
  cross-feature seam.
- **Migration consequence:** ten reviewable slices, recorded in `SLURP-MODULE-PLAN.md` and
  `SLURP-MODULE-STATUS.md`. Ownership shrinks to the three roots and two exceptions as files move.
  Persisted names, routes, and locale keys do not change.

## 2026-09-18 — Ship the refactor once, through an integration branch

- **Problem:** Each slice changes package source, so each needs a rebuild and version bump.
  Publishing every slice to `staging` would give users many intermediate versions of a half-finished
  restructure.
- **Decision:** Slice PRs target the `modular-simping` integration branch and use `0.0.x` versions
  there. One final PR merges it into `staging` as Slurp2 `0.1.0`.
- **Affected modules:** release process only; no source boundary changes.
- **Rejected alternative:** merging source-only slices to `staging` without rebuilding. The committed
  payload would drift from source, and the next unrelated Slurp2 fix would ship half-migrated code.
- **Migration consequence:** keep `modular-simping` merged with `staging`; the final PR folds the
  integration changelog entries into one `0.1.0` entry and removes unpublished `0.0.x` ZIPs.

## 2026-09-18 — Split the server by role: pure rules, persistence, features

- **Problem:** Slice 5 moved the 147 service files. 82 of them are pure domain rules, and 124 of the
  176 cross-feature imports pointed at those rules. Every feature service also called the storage
  composition, and the settings aggregate, storage context, and viewer context in `base/` imported
  domain rules. The layers `base <- features <- workflows` could not hold that graph without
  injection or permanent exceptions.
- **Decision:** Server layers become `base <- modules <- data <- features <- workflows <- entry`.
  `modules/` holds pure rules, `data/` holds persistence and the storage composition, and features
  keep routes, services, operations, and schedulers. The remaining real I/O calls between features
  go through small contracts.
- **Affected modules:** every server `slp` file; Slice 4 storage facets moved from `features/` to
  `data/`; settings and the record model moved to `modules/`; new server features `viewer`,
  `media`, and `settings` hold the route plumbing and the routes that left `base/`.
- **Rejected alternative:** injecting storage into about 57 call sites (not a pure move, more
  behaviour risk); a permanent exception for `slp-storage.ts` (the rules forbid it).
- **Migration consequence:** the architecture regression ranks `modules` and `data`, rejects I/O
  imports in server modules, and has negative fixtures for each new edge. Client layers are
  unchanged.

## 2026-09-19 — The modifier consumer builds the provider, not the entry

- **Problem:** Plan §4 said the server entry constructs the active-modifier provider. Slice 6 found
  that it cannot. The only new-subscription charge is computed inside one storage transaction in
  `data/economy/slp-economy-storage-1.ts`, and the platform-event list lives in Slurp settings,
  which Backstage edits at runtime. A provider built once during `activate()` would serve a frozen
  event list until the next Engine restart, and threading one through `createSlurpStorage` would
  also add a constructor dependency to three construction sites for no gain.
- **Decision:** The consuming feature builds the provider from the settings snapshot its own
  transaction already read, and passes it to a pure `slurpSubscriptionCharge(base, provider, at)`.
  Economy depends on `SlpActiveModifierProvider` and never on World, so the seam is unchanged.
  A saved event stores the modifier effect only; the producing source stamps `source` on at
  activation, which makes an id mismatch impossible.
- **Affected modules:** `base/modifiers/` (new), `modules/world/events/slp-platform-events.ts`,
  `modules/economy/slp-creator-pricing.ts`, `data/economy/slp-economy-storage-1.ts`, and the
  Backstage event editor, whose new-event literal gains the two defaulted fields.
- **Rejected alternative:** a provider constructed in the entry. It is either stale after a
  Backstage edit or forces a settings read per request inside the entry, which is the same work in
  a worse place. Also rejected: moving the charge out of the transaction, which plan §3 forbids.
- **Migration consequence:** calendar activation stays in `modules/world/events/` rather than moving
  to `features/world/events/` as §4 first said, because it is a pure rule under the Slice 5 layer
  model and the client reads it directly. Plan §3's allocation ledger already placed it there.

## 2026-09-19 — Shared pure rules move to `shared/src/slp/`, and the client gains a settings feature

- **Problem:** Slice 7 moved the client state layer into `packages/client/src/slp/`, where the
  architecture regression forbids importing server `slp` code. `SlurpSettings` needs
  `SlurpSimulationTuning`, `SlurpFanType`, `SlurpPlatformEvent`, and `SlurpModelBudget`, which lived
  in server `base/` and `modules/`. Thirteen client files already imported those rule files
  directly; pending decision 5 recorded the debt and assigned it to Slices 7–8.
- **Decision:** Move the closed set of pure rules both sides need into `shared/src/slp/`:
  `slp-tone.ts`, `slp-tuning.ts`, `slp-model-budget.ts`, `slp-modifier.types.ts`,
  `slp-modifier-schema.ts`, `slp-platform-events.ts`, `slp-fan-types.ts`, and `slp-population.ts`.
  Every importer's path is rewritten; no re-export shim is left behind. The client also gains
  `features/settings/`, mirroring the server feature added in Slice 5, so the settings document has
  one owner instead of being spread across maintenance and discovery.
- **Affected modules:** server `base/prompting/`, `base/model/`, `base/modifiers/`,
  `modules/audience/`, and `modules/world/events/` lose those eight files; `shared/src/slp/` gains
  them; client `slp/features/settings/` is new. The Slice 6 modifier seam is unchanged in behaviour:
  the resolver and provider stay in server `base/modifiers/` and now import the contract from shared.
- **Rejected alternative:** splitting each rule file into a shared type half and a server schema
  half. The types are `z.infer` of the schemas, so the split would separate a type from its only
  source of truth and duplicate the pairing. Also rejected: leaving the settings types outside the
  `slp` roots, which defers the same work to Slice 8 and keeps a client-to-server edge alive.
- **Migration consequence:** `shared/src/slp/` is no longer "pure functions only"; README now states
  the narrower test that replaced it. The plan's server allocation ledger moves these eight files to
  shared. Pending decision 5 is resolved for the hook layer; the remaining component importers in
  `components/slurp/` now import shared, so Slice 8 inherits no client-to-server edge.

## 2026-09-19 — Slice 10: the schema is a permanent exception, and the shell is a module

- **Problem:** the final ownership list in plan §5 had five entries and omitted
  `packages/server/src/db/schema/slurp.ts`, which is live and appears in **both**
  `slurpOwnedSourcePaths` (frozen legacy Slurp) and `slurp2OwnedSourcePaths`. Separately, the shell
  and the reusable Creator card could not go where plan §3 placed them: `NoodleShell` renders a
  wallet balance through `modules/coin/`, and the Creator card read a Discovery type, so putting
  either in `base/` would have broken the layer direction the same document defines.
- **Decision:** (1) the Drizzle schema stays at its path and becomes a third permanent ownership
  exception; moving it would rewrite table registration for the frozen legacy package. (2) The
  domain-neutral chrome (accent tokens, logo, avatar, scroll behaviour, media img) goes to
  `base/chrome/`, while the shell, its contract and the persona switcher go to `modules/chrome/`.
  (3) Types read by more than one layer move to `base/state/`: `SlurpDiscoverLayout`,
  `SlurpReserveStatus` and `SlurpScheduleSlot`, the last two re-exported from the feed contract so no
  feed consumer changes. (4) Five pure rule modules the client already imported across the
  client/server boundary move to `shared/src/slp/`: `slp-world.ts`, `slp-world-pulse.ts`,
  `slp-reach.ts`, `slp-audience-subscription.ts` and `slp-audience-characters.ts`.
- **Affected modules:** `base/chrome/`, `modules/chrome/` (new), `modules/settings/`,
  `modules/creator/`, `modules/audience/` (new), `base/state/`, `shared/src/slp/`, server
  `modules/audience/` and `modules/world/`, and the Discovery, Maintenance, Ads, Economy, Messages,
  Projects and Settings contracts, which gained the entries other features legitimately need.
- **Rejected alternative:** keeping the shell in `base/chrome/` and passing the wallet balance in as
  a prop. That changes a component API during a structural move, which plan §9 forbids. Also
  rejected: an allowlist for the client-to-server rule imports, since the plan requires the final
  regression to pass with no temporary exception.
- **Migration consequence:** plan §5's final ownership list becomes six entries, not five. The
  `focusRing` class string, copied byte-identically into four files by Slice 9, is now
  `base/chrome/slp-focus.ts`; the three `quietButton` composites stay separate because they differ in
  minimum height and animation, so merging them would change what renders.

## 2026-09-19 — Slice 11: ownership completion and the missing-export gate

- **Problem:** seven Slurp components still sat in `components/slurp/`, five of them above the size
  ceiling, and the architecture regression tolerated them by only flagging `slp`-named strays. The
  post cards read settings and the fan card, both feature code, from what the plan calls a module.
  The package typecheck caught TS2305 but not an unexported or doubly-bound import, which is what a
  mechanical split produces.
- **Decision:** (1) Each oversized component becomes a view-model hook plus render parts; a hook's
  type is `ReturnType` of the hook, so parts take the model instead of forty typed props. (2) The
  fan card and its member query move to `modules/audience/`; the post cards receive the Show-more
  threshold through the post-card controller instead of reading settings. (3) Cross-feature reads use
  contracts, including a new `slp-media-contract`. (4) The ownership rule covers any implementation
  file outside the roots; `slurp2OwnedSourcePaths` is the six entries, in both the builder and the
  catalog validator. (5) The typecheck gate reports TS2305, TS2459, TS2724 and TS2300.
- **Affected modules:** client `app/` and `app/screens/`, `features/messages/`, `features/onboarding/`,
  `features/creators/`, `features/projects/`, `modules/post/`, `modules/audience/`, the Creators,
  Discovery, Economy, Settings and Media contracts, server `data/slp-storage.ts`; the builder, the
  catalog validator, the typecheck script and their regressions.
- **Rejected alternative:** reusing the creator card's reply row and composer in the post card. The
  two differ in locale keys, fallbacks and the ask-for-reply control, so one component would change
  what one of them renders. Also rejected: rebaselining the client-hooks wiring counts after the
  member query moved.
- **Migration consequence:** no `components/slurp/` path remains, so no source test may read one
  except through `slurp2Source`. New Slurp2 code must live in the `slp` roots or one of the three
  permanent exceptions.

