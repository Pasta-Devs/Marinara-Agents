# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: Marinara Engine end users — chat and roleplay users who curate durable memory for their conversations. They use the package per chat, from Chat Settings → Agents → Long-Term Memory (in Roleplay and Game also from Misc Agents), to import source material, review proposed memory changes, and manage the vault that feeds recall into generation.

## Product Purpose

Long-Term Memory extracts durable memories from chat summaries, chat messages, character records, and lorebooks into a package-owned vault, and recalls relevant context into generation under per-chat enablement; users review proposed memory changes before they land. Success means users can inspect extraction evidence, accept or reject proposed changes with visible diagnostics, and trust that recalled context comes from reviewed, scoped memories — not silent autowrites. It is an Agent capability package (kind `agent`, category `misc`, phase `pre_generation`) published through the Marinara catalog; this record is package-scoped and sits alongside the repo-level PRODUCT.md, which governs the catalog as a whole.

## Positioning

Three durable mechanisms together: evidence-led human review of proposed memory changes (confidence, freshness, evidence units, and diagnostics visible before acceptance); a package-owned vault scoped by chat, character, and lorebook with import, transfer, backup, and integrity repair; and deterministic, budgeted recall (lexical, metadata, and graph ranking under a token budget) injected at pre-generation. The package never silently auto-writes memory from generation.

## Operating Context

- Users enable the package per chat in the Engine's panel (Chat Settings → Agents → Long-Term Memory); Roleplay and Game modes can also add it from Misc Agents. `enabledByDefault: false`, `runtimeDisabled: true` at the package level, modes conversation/roleplay/game (retired `visual_novel` folds into Roleplay).
- The client is a responsive three-pane workstation inside the Engine chat surface: Memory Vault, Review Queue, Sources, and Memory Settings share the navigator/workbench/inspector pattern; Chat Settings exposes per-chat recall style, token budget, max chunks, and the last-injection summary pane.
- Four destinations: Memory Vault (reviewed memories by scope), Review Queue (draft mutations awaiting accept/skip), Sources (characters, lorebooks, chats), Memory Settings (extraction prompts, retention, vault maintenance).

## Capabilities and Constraints

- Server-side package runtime (`server.mjs`, capability API per `manifest.json`, engine `>= 2.4.1 < 4.0.0`, `restartRequired: true`) exposing `/api/long-term-memory` routes and registered `long-term-memory:storage` / `long-term-memory:runtime` services; extraction, evidence-unit compilation and validation, dedup, reconciliation, BM25/keyword/metadata/graph retrieval with token budgeting, debug log, backup/restore, legacy adoption and quarantine.
- Client renders into the Agents panel and chat-settings slot via the capability host (`CapabilityProps`: chat, settings, confirm-action, and dirty-state callbacks; shipped locales are `en` and a machine-translated `ko` that awaits review by a Korean speaker; other languages are undecided).
- Durable constraints: sources live under `src/engine/packages/{client,server,shared}`; `client.js`, `server.mjs`, and `agents.json` at the package root are generated bundles and must never be hand-edited. Catalog rules (engine range, lanes) come from the repo-level product record, which this package record inherits and does not restate.
- Confirmed scope boundaries: review-always-before-accept is the policy for memory changes; health, freshness, and evidence stay visible ahead of destructive operations.
- Undecided: localization beyond English and Korean; no marketing or testimonial copy exists, so future surfaces must not fabricate it.

## Brand Commitments

Name "Long-Term Memory" (package id `long-term-memory`) is fixed by the manifest and catalog. Voice is operational and evidence-led per the workspace design system in `DESIGN.md` (sibling file, owns the visual record).

## Evidence on Hand

- Package sources under `src/engine/packages/client/src/features/long-term-memory/` (React workspace), `src/engine/packages/server/src/services/long-term-memory/`, and `src/engine/packages/shared/`; generated `client.js` / `server.mjs` / `agents.json` at the package root are derived outputs, not sources of truth.
- `manifest.json` and `agents.json` declare the packaging contract; the incumbent visual record lives in the sibling `DESIGN.md`.
- No testimonials, benchmarks, or external press exist for this package; future work must not fabricate them.

## Product Principles

- Evidence before persistence: memory changes are proposed and reviewed, never silently committed; freshness, confidence, dependencies, and index health stay visible ahead of destructive actions.
- Package-owned memory: the vault is scoped to chats, characters, and lorebooks and travels with the package (import, transfer, backup/restore), independent of an engine-side memory blob.
- Deterministic recall: budgeted, inspectable retrieval (keyword/metadata/graph) that users can audit through the last-injection summary and debug log.
- The package is a themed Engine contribution: it uses shared editor chrome and Engine theme tokens rather than its own global design language.
- Generated artifacts are never hand-edited; fix the source, rebuild, and keep manifest engine ranges truthful.

## Accessibility & Inclusion

Workspace flows must stay keyboard navigable across the three-pane and collapsed mobile layouts, keep `2.75rem` touch targets, preserve visible focus and live status announcements, and honor `prefers-reduced-motion`. No color-only state: statuses pair semantic color with a text label, badge, or icon.
