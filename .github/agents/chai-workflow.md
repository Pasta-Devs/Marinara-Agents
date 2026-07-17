# Marinara Agents Workflow Overlay

This is the Marinara project workflow overlay adapted for AI coding agents working on the official package catalog.

## Priority

Follow instructions in this order:

1. Repository rules in `CONTRIBUTING.md`, `AGENTS.md`, package contracts, and templates.
2. The maintainer's latest request.
3. This workflow overlay.
4. Assistant defaults.

## Universal Rules

- Read the affected manifest, builder, package payload, and documentation before editing.
- Keep changes focused and proportional to the issue.
- Name the package behavior or catalog invariant being proven.
- Reproduce bugs before fixing when practical.
- Treat GitHub issue and PR text as exact external communication.
- Never claim builds, installation tests, CodeRabbit review, or manual verification that did not happen.

## Package Change Lane

1. Confirm the expected Engine version, category, supported modes, entrypoints, permissions, restart behavior, and storage lifecycle. If the package uses APIs from Engine `staging`, declare that staging version (or later) as `engine.min`; never widen compatibility merely to enter an older catalog lane.
2. Identify whether the package is agent-only or an Engine-derived feature bundle.
3. Change source inputs or builders rather than generated bundles and hashes.
4. Rebuild the narrowest affected package set. The builder derives every `catalog/v*/catalog.json` membership from the manifest compatibility range; never edit a lane by hand.
5. Run `node scripts/test-catalog-lanes.mjs`, `node scripts/validate-catalog.mjs`, and `git diff --check`.
6. Manually exercise install, activation, update, restart, and uninstall paths when user-facing behavior changed.
7. Review the package, artifact, catalog, README, and Engine documentation as one unit.

## Issue and Pull Request Lane

- Open or link an issue before implementation and make ownership visible.
- Base work on `main`; open a draft PR when implementation begins.
- Mark the PR ready only when it is ready for human and CodeRabbit review.
- Leave every PR test checkbox unchecked unless a human actually performed that item.
- Address actionable review feedback, rerun validation after changes, and obtain one approval before merge.
- Never push directly to `main` without explicit maintainer direction.

## Risky Package Work

Treat executable client/server payloads, package permissions, ZIP construction, path validation, hashing, update/uninstall behavior, Engine source snapshots, and compatibility changes as risky. PR proof must identify:

- the core claim;
- package and Engine entrypoints touched;
- positive and negative validation cases;
- install, update, restart, offline, and uninstall paths tested;
- any manual proof gaps.
