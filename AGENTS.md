# AGENTS.md

This file is a thin maintainer note for contributors using coding agents. Canonical workflow and validation guidance lives in `CONTRIBUTING.md`.

## Agent Workflow Overlay

- Follow `.github/agents/chai-workflow.md` as the repository's additive AI-agent workflow overlay for proof discipline, issue ownership, feature sizing, PR gates, and risky package work.
- The overlay does not replace this file, `CONTRIBUTING.md`, package manifests, or the maintainer's latest request.

## Ponytail Implementation Discipline

- Apply [Ponytail](https://github.com/DietrichGebert/ponytail) as an additive minimalism overlay after understanding the task and tracing the affected flow. It never overrides repository rules, validation requirements, or the maintainer's latest request.
- Before adding code, stop at the first option that works: skip unnecessary work, reuse an existing helper or pattern, use the standard library, use a native platform capability, use an already-installed dependency, choose a clear inline solution, then write the minimum new code.
- Prefer shared root-cause fixes after checking every caller, deletion over addition, boring over clever, and the fewest files. Avoid speculative abstractions, dependencies, and boilerplate.
- Never trade away trust-boundary validation, data-loss prevention, security, accessibility, real-hardware calibration, or explicitly requested behavior.
- Non-trivial logic must leave behind the smallest runnable regression proof. Trivial one-line and instruction-only changes do not need a dedicated test.
- Mark a deliberate shortcut with a `ponytail:` comment that names its known ceiling and the upgrade path.

## Preferred Workflow

- Start from `staging` and open an issue before implementation.
- Open a draft PR when issue work begins so ownership is visible, then mark it ready only after validation and self-review are complete.
- Run `npm run check` for the maintained-source Prettier and ESLint gates.
- Run `node scripts/test-catalog-lanes.mjs`, `node scripts/validate-package-locales.mjs`, and `node scripts/validate-catalog.mjs` as the baseline validation commands.
- Rebuild the affected package and catalog entry whenever source payloads, manifests, Engine snapshots, or generated bundles change.
- Treat each manifest's `engine.min` / `engine.maxExclusive` range as the catalog-lane source of truth. The builders route packages into `catalog/v*/catalog.json`; do not hand-place or copy entries between lanes.

## Repository-Specific Cautions

- Keep edits non-destructive and preserve unrelated work in dirty worktrees.
- Treat `packages/**/client.js`, `packages/**/server.mjs`, `artifacts/*.zip`, `catalog/catalog.json`, `catalog/v*/catalog.json`, file hashes, checksums, and catalog sizes as generated outputs. Change their source or build scripts, then rebuild them; do not hand-edit generated bundles, catalogs, or hashes.
- Every downloadable package must be listed in the README's official catalog, have a compatible manifest, and pass archive/hash validation.
- About Me is a core Conversation feature and must never be published as an Agent package.
- Keep compatibility metadata aligned with the current minimum Marinara Engine version.
- Changes to package permissions, archive handling, install/update behavior, executable client/server code, or Engine snapshots are security-sensitive and require explicit validation notes.

## AI-Generated Pull Requests

- Never auto-check validation or test-plan checkboxes. They are a human verification list, not proof.
- Explain why the package or repository change is needed, not only which files changed.
- Link the issue, target `staging`, leave drafts unreviewed by CodeRabbit until they are marked ready, and address actionable review feedback before merge.
- Required checks and CodeRabbit must complete before every `staging` merge. PRs from active Pasta-Devs organization members and owners do not require another human approval; outside and first-time contributors require an approving review from `SpicyMarinara`. Organization members with repository merge permission may merge internal PRs after those gates pass.
- Only `SpicyMarinara` may promote this repository's `staging` branch into `main`.
