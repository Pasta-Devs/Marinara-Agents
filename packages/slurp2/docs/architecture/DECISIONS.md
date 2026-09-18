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
