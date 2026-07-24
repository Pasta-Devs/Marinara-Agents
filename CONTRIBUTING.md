# Contributing to Marinara Agents

Thank you for helping improve the official downloadable packages for [Marinara Engine](https://github.com/Pasta-Devs/Marinara-Engine). All participants are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before You Start

1. Open an issue or check the [issue tracker](https://github.com/Pasta-Devs/Marinara-Agents/issues) before implementing a new package or material behavior change. This lets maintainers agree on scope and prevents duplicate work.
2. Check for an issue-linked branch, open or draft PR, and visible owner before beginning work.
3. Base changes on `main`, the protected branch containing the published catalog consumed by Marinara Engine.

## Branches

| Branch | Role |
| --- | --- |
| `main` | Protected development and release branch. Package, catalog, documentation, and CI pull requests target this branch. |

Create a focused feature branch from current main:

```bash
git checkout main
git pull
git checkout -b feature/short-description
```

Open a draft PR as soon as implementation starts, then mark it **Ready for review** after validation and self-review. Draft PRs cannot merge and are intentionally skipped by CodeRabbit. Ready PRs receive an automatic CodeRabbit review and require at least one approving review before merge.

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

### Engine compatibility and catalog lanes

Each emitted package manifest is the source of truth for Engine compatibility. For ordinary Agent packages, edit the manifest range; for generated feature packages, edit the feature definition in `scripts/build-feature-packages.mjs`, which emits that range into the manifest. The builders automatically publish an entry into every Engine-major lane intersected by `engine.min` (inclusive) and `engine.maxExclusive` (exclusive). For example, `>=2.3.0 <3.0.0` publishes only to v2, `>=2.3.0 <4.0.0` publishes to v2 and v3, and `>=3.2.0 <3.3.0` publishes only to v3. `catalog/catalog.json` remains an exact v2 alias for Engine releases that predate lane selection.

When a feature is built from a neighboring Engine checkout, use the Engine branch that provides the APIs the package actually consumes. A package built from Engine `staging` must declare that staging Engine version (or a later compatible version) as its minimum. Do not lower the manifest range to make a package appear for stable users; run the builder and let the pipeline route it automatically. For manifest-v2 packages, validation also requires the exact `builtAgainst.engineVersion` to fall inside the declared range. Pull-request validation rejects inconsistent provenance and missing, stale, extra, or manually edited lane entries.

Feature implementations belong under `packages/<id>/src/`. Hierarchical Maps keeps its Engine-shaped source tree at `packages/hierarchical-maps/src/engine/` and builds from that package-owned tree without copying captured generic Engine dependencies into its build root. Do not move Maps implementation files back into `sources/engine/`.

Hierarchical Maps also owns `packages/hierarchical-maps/engine-boundary.json`. It records the capability API and exact Engine source baseline used for the package manifest. Its private-import inventory must remain empty: the feature builder and catalog validator reject any private Engine import. Update the paired Engine baseline only when the package intentionally depends on a newer public host contract.

## Validation

Every pull request must run:

```bash
node scripts/test-catalog-lanes.mjs
node scripts/validate-catalog.mjs
git diff --check
```

Catalog validation verifies every versioned lane and the legacy alias, package count and identity, Engine compatibility, categories, README coverage, package manifests, permissions, entrypoints, declared file hashes and sizes, ZIP checksums and contents, generated JavaScript syntax, runtime registration, and package-specific contracts.

Also manually install or update affected packages through **Agents → Download Agents** in a compatible Marinara Engine checkout. Verify the supported chat modes, restart behavior, uninstall cleanup, and an offline restart when relevant. Describe exactly what was tested in the PR; do not tick checklist items that were not personally verified.

## Pull Request Expectations

- Link the issue with `Closes #<number>`, `Fixes #<number>`, or `Resolves #<number>`.
- Target `main`.
- Keep the PR focused and explain the user-facing reason for the change.
- Mark the PR ready for review only after local validation and self-review.
- Let CodeRabbit review the ready PR and address actionable findings.
- Obtain at least one approving review before merge.
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

Package hashes are integrity checks, not independent publisher signatures. A contributor who can change both an artifact and its catalog entry can also change the recorded hash. For that reason, changes under `packages/`, `sources/`, `artifacts/`, `catalog/`, `scripts/`, or `.github/workflows/` require the code-owner review configured in `.github/CODEOWNERS`. Maintainers must keep **Require review from Code Owners** and stale-approval dismissal enabled for `main`; see [SECURITY.md](SECURITY.md) for the full repository ruleset.

## AI Agent Workflow

Coding agents use `.github/agents/chai-workflow.md` as an additive proof and coordination layer. `CONTRIBUTING.md`, `AGENTS.md`, package contracts, and the maintainer's latest request take priority.
