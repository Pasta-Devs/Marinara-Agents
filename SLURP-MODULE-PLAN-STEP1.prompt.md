# Slurp Modularisation — Planning Step 1: Boundary Map

You are planning a structural refactor of the `slurp2` Agent package in the
Marinara-Agents repo. This is STEP 1 of a multi-step planning effort. Step 1
produces a **boundary map and module vocabulary**, not a migration plan and not
any code. Do not edit source files. Do not propose a file-by-file diff yet.

## Context

`slurp2` began as part of `noodle`, was renamed `noodler`, then split out as
`slurp`. The split left duplicated concepts, three naming eras in one tree, and
a handful of files that absorbed everything the split could not place.

Owner's goal, in his words: everything split into modules — a few base modules,
submodules, then feature modules with their own submodules, plus reusable
modules (a Creator Card is a module, a Post is a module, a Story is a module).
Good names, not convoluted names, that survive another restructuring later. No
huge files. Adding to or reusing a part must be easy; expanding the event system
in particular must be easy.

## Where the code is

- Source: `packages/slurp2/src/engine/packages/{client,server,shared}/src/...`
- Client components: one flat folder, `client/src/components/slurp/` (57 files)
- Client hooks: `client/src/hooks/use-slurp.ts` (3709 lines, all query keys and hooks)
- Server services: `server/src/services/slurp/` (~230 files, flat)
- Server storage: `server/src/services/storage/slurp*.ts`
- Routes: `server/src/routes/slurp.routes.ts`, `slurp-messages.routes.ts`
- Ads subsystem, already extracted-ish: `server/src/services/garnish-ads/`
- Event system today: `services/slurp/slurp-platform-events.ts` (132 lines, pure rules),
  `services/storage/slurp-events.storage.ts` (179 lines), plus
  `client/src/components/slurp/SlurpPlatformEventsSettings.tsx`

Largest files (lines): SlurpHome.tsx 8153, slurp.storage.ts 8044, slurp.routes.ts
5254, SlurpMessages.tsx 5153, use-slurp.ts 3709, slurp-messages.storage.ts 3010,
SlurpPostCard.tsx 2512, SlurpBackstageWorld.tsx 2172.

Existing planning documents to read for product vocabulary and prior decisions —
reuse their terms where they are already good, and say where they are not:
`SLURP-EXTRACTION-PLAN.md`, `SLURP-LIVE-WORLD-PLAN.md`,
`SLURP-AUDIENCE-SIMULATION-PLAN.md`, `SLURP-INVITED-CHARACTER-AUDIENCE-PLAN.md`,
`packages/slurp2/SLURP-ARCS-PLAN.md`, `packages/slurp2/SLURP-REVIEW.md`,
`packages/slurp2/SLURP-AUDIT-TASKS.md`.

## Hard constraints (a proposal that breaks one of these is invalid)

1. The package source mirrors the Engine source tree. At build time the builder
   copies the Engine `sources/engine` tree, then overlays
   `packages/slurp2/src/engine` on top. Any new or moved directory must be added
   to `slurp2OwnedSourcePaths` in `scripts/build-feature-packages.mjs` (~line
   162) or the files are treated as generic Engine material and contaminate other
   packages' build input. Name every path your target tree would add there.
2. `packages/slurp2/client.js`, `server.mjs`, `artifacts/*.zip`, `catalog/**`,
   hashes and sizes are generated. They are rebuilt, never hand-edited.
3. Locale keys live in `client/src/localization/locales/*.json` and are validated
   by `scripts/validate-package-locale-keys.mjs` and
   `scripts/validate-package-locales.mjs`. Say whether your module boundaries
   imply locale key renames, and prefer boundaries that do not.
4. The Noodle/Noodler -> Slurp rename is a SEPARATE, deferred job with three
   tiers (tier 3 is not renameable from this repo). Do not fold a mass rename
   into this restructure. Where an old name sits on a module boundary, note it as
   a rename candidate for that later job; do not plan to rename it now.
5. Behaviour must not change. This restructure is moves, splits and re-exports.
6. Regression tests live in `tests/slurp*.regression.ts` and
   `tests/slurp2-*.regression.ts` (~50 files) and import deep paths. Assume some
   are already failing on `staging` — do not trust any inherited list of failures,
   the baseline gets re-derived when implementation starts.

## What to produce

A single markdown document, written to `SLURP-MODULE-MAP.md` at the repo root.

### 1. Domain inventory
List the real domains you find in the code, not the ones the folder names claim.
For each: a one-line definition, the files that implement it today (client and
server), and whether it is currently coherent, split across files, or buried
inside a large file. Be specific — cite `file:line` for anything buried.

### 2. The four large files, dissected
For `SlurpHome.tsx`, `SlurpMessages.tsx`, `use-slurp.ts`, `slurp.storage.ts` and
`slurp.routes.ts`: list every top-level unit with its line range and the domain
it belongs to. This is the dissection table the later steps cut along.

### 3. Proposed module vocabulary
Define the layer terms and stick to them for the whole effort. Propose concrete
names for:
- base modules (things every feature uses)
- feature modules (a product area)
- reusable presentation modules (Creator Card, Post, Story, Fan Card, ...)
State the naming rule in one sentence per layer, and give a bad-name example
next to each good one so the rule is testable. Names must read the same in five
years and must not encode the current folder layout.

### 4. Target tree sketch
A directory tree for client and server after the restructure, down to module
folder level (not every file). Mark which folders are new paths that must be
added to `slurp2OwnedSourcePaths`. Keep depth modest — a submodule of a submodule
of a submodule is a smell; justify any third level.

### 5. Reusable module candidates
Every UI element used in three or more places today, with its current call sites.
These become the shared presentation modules. Where the same concept is
implemented twice (for example a post card in `SlurpPostCard.tsx` and again in
`SlurpCreatorPostCard.tsx`), say so and say which one wins.

### 6. Event system
The owner wants to expand it. Describe today's flow end to end (definition ->
storage -> active-window evaluation -> injection into post and message prompts ->
settings UI). Then say what the current shape blocks, and what the smallest
boundary change is that makes a new event kind additive. Do not design the
expansion; identify the seam.

### 7. Risk register
Ranked. Include at least: build-path ownership, locale keys, deep test imports,
the mirrored-Engine overlay, circular imports between the new modules, and any
place where a move would silently change behaviour.

### 8. Open questions for the owner
Maximum five. Only questions where two answers lead to materially different
trees.

## Rules for this step

- Read before you assert. Every claim about the code cites `file:line`.
- Do not write or move code. Do not run the builder.
- Do not invent new subsystems, new dependencies, or abstraction layers the
  product does not already need. This is a reorganisation of what exists.
- Prefer fewer, larger-named boundaries over many thin ones. The target is
  manageable files, not maximum files.
- If the honest answer to "should this be a module?" is no, say no.
- Keep the document dense. No filler, no restating this prompt back.
