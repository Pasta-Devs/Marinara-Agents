# Contributing to Marinara Agents

Thank you for helping improve the official downloadable packages for [Marinara Engine](https://github.com/Pasta-Devs/Marinara-Engine). All participants are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before You Start

1. Open an issue or check the [issue tracker](https://github.com/Pasta-Devs/Marinara-Agents/issues) before implementing a new package or material behavior change. This lets maintainers agree on scope and prevents duplicate work.
2. Check for an issue-linked branch, open or draft PR, and visible owner before beginning work.
3. Base changes on `staging`, the protected testing branch consumed by Marinara Engine staging users.

## Branches

| Branch | Role |
| --- | --- |
| `staging` | Active development and Agent testing. This is the only target for package, catalog, documentation, and CI pull requests. |
| `main` | Stable published catalog. Only `SpicyMarinara` may promote tested work from `staging`. |

Create a focused feature branch from current staging:

```bash
git checkout staging
git pull
git checkout -b feature/short-description
```

Open a draft PR against `staging` as soon as implementation starts, then mark it **Ready for review** after validation and self-review. Draft PRs cannot merge and are intentionally skipped by CodeRabbit. Every ready PR must pass the catalog check, CodeQL security analysis, native Code Quality analysis, and CodeRabbit review. Dependency changes must also pass the low-severity dependency audit. PRs from active Pasta-Devs organization members and owners do not require a separate human approval; organization members with repository merge permission may merge internal PRs into `staging` after those gates pass. Outside and first-time contributors require an approving review from repository owner `SpicyMarinara`. Approval from another Pasta-Devs member does not satisfy this gate. Only `SpicyMarinara` may promote this repository's `staging` branch into `main`.

Marinara Engine automatically follows the matching Agent channel: Engine `staging` reads this repository's `staging` catalog and artifacts, while stable Engine builds read `main`. Test package installs and updates from an Engine staging checkout before promotion.

## Requirements and Setup

- Node.js 24+
- Git
- `zip` and `unzip`
- A neighboring Marinara Engine checkout when rebuilding Engine-derived feature packages

Typical layout:

```text
Developer/
├── Marinara-Engine/
└── Marinara-Agents/
```

Set `MARINARA_ENGINE_ROOT` when the Engine checkout is elsewhere.

After a fresh checkout, and whenever `package.json` or `package-lock.json` changes, install this repository's pinned build dependencies:

```bash
npm ci
```

The root `package.json` pins libraries that feature sources import but that the Engine no longer provides (currently `chess.js` for the Chess package). Because captured sources build from `sources/engine/` inside this repository, esbuild's standard upward module resolution finds those libraries in this repository's `node_modules`. When `MARINARA_ENGINE_SOURCE_ROOT` points at a source tree outside this repository, that upward walk does not reach this repository's `node_modules`, so the pinned libraries must be resolvable from the external tree instead.

## Repository Layout

- `packages/<id>/` — package manifest, package-owned source, and declared/generated payloads
- `artifacts/` — reproducible ZIP packages downloaded by Marinara Engine
- `catalog/v*/catalog.json` — generated Engine-major catalog lanes
- `catalog/catalog.json` — generated legacy alias of the Engine v2 lane
- `schemas/` — package schema documents
- `scripts/` — catalog builders and validation
- `sources/engine/` — captured generic Engine dependencies required to reproduce feature bundles
- `tests/` — integration proof for package behavior

The catalog contains Writer, Tracker, and Misc Agents. Feature packages such as Maps, Calls, and Conversation games are still represented by Agent definitions so installation and per-chat availability use one consistent lifecycle.

## Building Packages

Rebuild ordinary agent-only packages with:

```bash
node scripts/build-agent-catalog.mjs
```

Rebuild Engine-derived feature packages with:

```bash
node scripts/build-feature-packages.mjs
```

Both builders accept package IDs for a focused rebuild. When a build changes an artifact, commit the package payload, manifest, ZIP, catalog entry, and captured Engine sources together. Do not hand-edit generated bundles, checksums, byte sizes, or ZIP contents.

The catalog `generatedAt` field is preserved across rebuilds rather than stamped with the current time. This keeps a no-op rebuild byte-identical and stops the timestamp from being a guaranteed merge conflict between concurrent package PRs. A rebuild that touches nothing substantive should leave `catalog/**/catalog.json` unchanged — if `git status` shows only a `generatedAt` diff, discard it. To intentionally refresh the timestamp (for example when promoting a release), run the builder with `MARINARA_CATALOG_STAMP_GENERATED_AT=1`.

### Packages that are not ready for everyone

`scripts/catalog-incomplete.mjs` holds two sets, because "not finished" and "not promoted" are different states. Both keep the package building normally — payload, manifest, artifact, and locales stay committed so development and testing continue — and both are enforced at the single catalog chokepoint (`writeCatalogFamily`), so every builder inherits them and whichever builder runs next relocates or drops a stale committed entry for a newly-marked id.

| Set | Stable (`main`) users | Staging users |
| --- | --- | --- |
| `INCOMPLETE_PACKAGE_IDS` | hidden | hidden |
| `STAGING_ONLY_PACKAGE_IDS` | hidden | visible and installable |

Use `INCOMPLETE_PACKAGE_IDS` while a package is still being built and is not ready for anyone. Use `STAGING_ONLY_PACKAGE_IDS` once it is ready for testers but not for the stable channel. A package graduates `INCOMPLETE_PACKAGE_IDS` → `STAGING_ONLY_PACKAGE_IDS` → neither; an id may not sit in both.

**Why the staging tier needs an overlay.** Promotion is a wholesale `staging` → `main` merge, so both branches end up with byte-identical catalogs. A package therefore cannot be shown on one branch and hidden on the other by catalog *content* — only the Engine knows which channel it is on. So a staging-only package is cut from the published lanes (which stable users read, and which promotion copies verbatim) and written to a **preview overlay** under `catalog/preview/`, mirroring the normal lane layout. The overlay rides along on `main` inertly: a stable Engine never requests it. A staging Engine fetches it and merges it over the published lanes.

This is fail-hidden, never fail-leak: an Engine that predates preview-overlay support simply never sees a staging-only package, and no Engine can reveal one to stable users by being out of date.

When a package is ready to ship to everyone: delete its id from both sets, rebuild its package (which re-adds the catalog entry to the published lanes and removes the overlay), update the package-count assertion in `validate-catalog.mjs` and the README catalog tables, and land all of it in one PR.

`validate-catalog.mjs` enforces that each tier lands in exactly one place: an incomplete id in no catalog at all, a staging-only id in the overlay and never in the published lanes, no orphaned overlay entry or empty overlay directory. Activation guidance and README coverage may exist ahead of a listing.

For local testing against a development Engine, build with `MARINARA_CATALOG_INCLUDE_INCOMPLETE=1` to publish every held-back package into the normal lanes, and point the Engine's `MARINARA_AGENT_CATALOG_URL` override at it. Never commit a catalog generated that way — validation rejects it.

### Engine compatibility and catalog lanes

Each emitted package manifest is the source of truth for Engine compatibility. For ordinary Agent packages, edit the manifest range; for generated feature packages, edit the feature definition in `scripts/build-feature-packages.mjs`, which emits that range into the manifest. The builders automatically publish an entry into every Engine-major lane intersected by `engine.min` (inclusive) and `engine.maxExclusive` (exclusive). For example, `>=2.3.0 <3.0.0` publishes only to v2, `>=2.3.0 <4.0.0` publishes to v2 and v3, and `>=3.2.0 <3.3.0` publishes only to v3. `catalog/catalog.json` remains an exact v2 alias for Engine releases that predate lane selection.

When a feature is built from a neighboring Engine checkout, use the Engine branch that provides the APIs the package actually consumes. A package built from Engine `staging` must declare that staging Engine version (or a later compatible version) as its minimum. Do not lower the manifest range to make a package appear for stable users; run the builder and let the pipeline route it automatically. For manifest-v2 packages, validation also requires the exact `builtAgainst.engineVersion` to fall inside the declared range. Pull-request validation rejects inconsistent provenance and missing, stale, extra, or manually edited lane entries.

Feature implementations belong under `packages/<id>/src/`. Hierarchical Maps keeps its Engine-shaped source tree at `packages/hierarchical-maps/src/engine/` and builds from that package-owned tree without copying captured generic Engine dependencies into its build root. Do not move Maps implementation files back into `sources/engine/`.

Hierarchical Maps also owns `packages/hierarchical-maps/engine-boundary.json`. It records the capability API and exact Engine source baseline used for the package manifest. Its private-import inventory must remain empty: the feature builder and catalog validator reject any private Engine import. Update the paired Engine baseline only when the package intentionally depends on a newer public host contract.

## Validation

Every pull request must run:

```bash
npm run check
node scripts/test-catalog-lanes.mjs
node scripts/validate-package-locales.mjs
node scripts/validate-catalog.mjs
git diff --check
```

`npm run check` verifies Prettier formatting and ESLint rules for package-owned source, repository scripts, and tests. Use `npm run format` to apply Prettier. Generated bundles, artifacts, catalogs, and captured Engine snapshots are excluded; rebuild those through their owning scripts instead of formatting them by hand.

Catalog validation verifies every versioned lane and the legacy alias, package count and identity, Engine compatibility, categories, README coverage, package manifests, permissions, entrypoints, declared file hashes and sizes, ZIP checksums and contents, generated JavaScript syntax, runtime registration, and package-specific contracts.

### Localizing package metadata

Each downloadable package owns a canonical `packages/<id>/locales/en.json` catalog for its user-visible package metadata. It includes the package and installed-Agent names and descriptions plus names and descriptions for selectable prompt templates. Model prompt templates are behavior, not interface copy, and must not be translated.

The English catalogs are generated from `manifest.json` and `agents.json`. After changing those source strings, run:

```bash
node scripts/sync-package-locales.mjs
```

For a translation, copy the package's English catalog to a BCP 47 locale filename such as `ko.json` or `pt-BR.json`, update `_meta`, and translate only the fields you can maintain. Translated catalogs may be partial; missing fields fall back to English when Engine consumption is implemented. Keep Agent and prompt-template IDs unchanged, preserve the file structure, and run `node scripts/validate-package-locales.mjs` before opening a PR.

These package-adjacent metadata catalogs do not localize executable package interfaces by themselves. Package-owned interfaces keep their own UI catalogs, such as Long-Term Memory's `src/engine/.../locales/en.json`. Loading localized package metadata in **Agents → Download Agents** remains Engine-owned integration work; do not extend the strict Engine manifest or catalog schema from this repository alone.

Also manually install or update affected packages through **Agents → Download Agents** in a compatible Marinara Engine checkout. Verify the supported chat modes, restart behavior, uninstall cleanup, and an offline restart when relevant. Describe exactly what was tested in the PR; do not tick checklist items that were not personally verified.

## Pull Request Expectations

- Link the issue with `Closes #<number>`, `Fixes #<number>`, or `Resolves #<number>`.
- Target `staging`; contributions to `main` are not accepted.
- Keep the PR focused and explain the user-facing reason for the change.
- Mark the PR ready for review only after local validation and self-review.
- Let CodeRabbit review the ready PR and address actionable findings.
- Outside and first-time contributors must obtain an approving review from `SpicyMarinara`. Approval from another Pasta-Devs member does not satisfy this gate. Active organization members and owners do not require separate owner approval; those with repository merge permission may merge internal PRs after the required automated gates pass.
- Update the README and linked Engine documentation when catalog membership, compatibility, setup, or user-visible behavior changes.
- Include the generated package and catalog outputs when payloads change.
- Never commit credentials, private user data, local model files, or unreviewed executable archives.

## Adding a New Package

A new package must include:

1. A unique directory and `manifest.json` under `packages/`.
2. At least one Agent definition matching the package ID.
3. Correct category, modes, entrypoints, permissions, compatibility, and restart requirement.
4. Reproducible package payloads and a generated ZIP artifact.
5. A catalog entry with valid hashes, sizes, and documentation URL.
6. A row in the correct README category and detailed Engine documentation.
7. Validation and manual installation evidence in the PR.

Security-sensitive permissions and executable client/server entrypoints must be narrowly scoped and justified in the PR description.

Package hashes are integrity checks, not independent publisher signatures. A contributor who can change both an artifact and its catalog entry can also change the recorded hash. For that reason, paths map to `SpicyMarinara` in `.github/CODEOWNERS`. Maintainers must keep the required staging approval check fail-closed: it exempts active Pasta-Devs organization members and owners, while every outside contributor needs a current-head approval from `SpicyMarinara`. `main` must remain owner-only; see [SECURITY.md](SECURITY.md) for the full repository ruleset.

## AI Agent Workflow

Coding agents use `.github/agents/chai-workflow.md` as an additive proof and coordination layer. `CONTRIBUTING.md`, `AGENTS.md`, package contracts, and the maintainer's latest request take priority.
