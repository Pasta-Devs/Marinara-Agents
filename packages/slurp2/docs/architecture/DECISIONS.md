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
