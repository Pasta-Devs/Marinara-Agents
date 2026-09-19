# Slurp Modularisation — Planning Step 2: Target Tree and Migration Sequence

STEP 1 is complete. Its output is `SLURP-MODULE-MAP.md` at the repo root (722
lines: domain inventory, dissection tables for the five large files, module
vocabulary, target tree sketch, reusable module candidates, event-system seam,
risk register). Read it first and in full. It is your input, not your competitor
— do not redo its inventory. Correct it only where you find it factually wrong,
and say so explicitly with `file:line` evidence when you do.

Also read `SLURP-MODULE-PLAN-STEP1.prompt.md` for the hard constraints. They all
still apply. In particular: the mirrored-Engine overlay, generated outputs,
locale-key validation, the deferred Noodle/Noodler rename, no behaviour change.

## Owner decisions since step 1 — these are settled, do not reopen them

1. **No re-export shims.** Old files do not survive as forwarding stubs. When a
   module moves, the old file is deleted and every import is rewritten in the
   same change. Plan for that reality, including the test fallout.
2. **The module is called `projects`, not `arcs`.** Arcs and Projects are the
   same domain. Keep the existing 71 `ui.slurp.projects` locale keys untouched.
   Any user-visible "arcs" wording is a matter for the deferred rename job.
3. **Garnish (ads) stays inside Slurp for now, but must be built so it can
   become its own Agent package later.** Treat it as a feature module with a
   deliberately narrow, documented seam to the rest of Slurp: name every import
   that crosses that seam in both directions, and keep the crossing surface as
   small as you can without inventing an abstraction layer. Separately,
   `server/src/services/garnish-ads` is missing from `slurp2OwnedSourcePaths` in
   `scripts/build-feature-packages.mjs` today. That is a live build-contamination
   bug. Schedule its fix as the first, standalone change.
4. **Backstage becomes a thin host.** Each feature module owns its own settings
   panel. Backstage collects and renders them. Adding a feature must mean adding
   one folder, not editing Backstage as well.

## Consequence of decision 1 that you must handle explicitly

`slurp2OwnedSourcePaths` in `scripts/build-feature-packages.mjs` (~line 162)
lists some entries as individual FILES, not folders — including
`packages/client/src/hooks/use-slurp.ts`,
`packages/client/src/slurp-package-entry.tsx`,
`packages/server/src/routes/slurp.routes.ts`,
`packages/server/src/db/schema/slurp.ts`,
`packages/server/src/services/storage/slurp.storage.ts`, and the
`slurp-messages.*` storage files. With no shims, those files disappear. Every
migration step that deletes or splits one of them must update its ownership entry
to the new folder in the same commit, or the build silently changes what the
package owns. Show this update in the step where it happens.

Also: step 1 reports that 128 of 151 slurp tests assert on source *text* rather
than behaviour, several with negative assertions that pass vacuously once the
guarded code moves to a sibling file
(`tests/slurp2-arc-reach.regression.ts:132-133` is a confirmed example). This is
the dominant cost of the whole effort. Treat it as a first-class part of the
plan, not a footnote.

## What to produce

One markdown document at the repo root: `SLURP-MODULE-PLAN.md`.

### 1. Final module tree
The complete target tree for client, server and shared, down to file level for
the modules being created, and to folder level for what is only being moved. For
every folder, one line saying what belongs in it and what does not. Apply the
step 1 naming rules; where step 1's sketch and decisions 2-4 disagree, the
decisions win.

### 2. Ownership ledger
The exact final contents of `slurp2OwnedSourcePaths`, as a diff against what is
there today. Flag every entry that changes from file to folder.

### 3. Migration sequence
An ordered list of changes, each one a single reviewable PR. For each:
- a one-line title and the domain it moves
- files deleted, files created, imports rewritten (counts, and the list where short)
- the ownership-list edit it carries, if any
- the tests it breaks, by name, and what each one becomes
- how a reviewer proves it changed no behaviour
- whether it can run in parallel with another step, or must be sequential

Order the sequence so that the riskiest structural work happens while the tree is
still small, and so that no step leaves the package unbuildable. Put the
garnish-ads ownership fix first. Say which step is the point of no return.

### 4. Test strategy
The 128 text-asserting tests are the hard part. Classify them into groups —
convert to behavioural, retarget to the new path, merge into a sibling, delete as
worthless — with counts per group and the rule you used to classify. Name the
tests that must be rewritten before any file moves, because they are the only
proof that a move changed nothing. Do not propose a new test framework or
fixtures; the repo's plain node regression scripts stay.

### 5. Event-system seam
Step 1 identified the seam. Now specify the minimum boundary change that makes a
new event kind additive, as part of this restructure. Show what adding one new
event kind would touch, before and after. Do not design new event kinds.

### 6. Garnish extraction seam
The import surface between garnish-ads and the rest of Slurp, in both
directions, file by file. What a future extraction into its own Agent package
would have to do, in a short list. What this restructure should do now to keep
that list short, and explicitly what it should NOT do now because it would be
speculative.

### 7. What this plan deliberately does not do
A short list. Include the Noodle/Noodler rename, and anything you considered and
rejected as over-engineering.

## Rules

- Every claim about the code cites `file:line`. Re-verify anything from step 1
  that a plan step depends on; step 1 may contain errors.
- Do not write or move code. Do not run the builder. Only create
  `SLURP-MODULE-PLAN.md`.
- No new dependencies, no new abstraction layers, no interface with one
  implementation, no config for a value that never changes. This reorganises what
  exists.
- Prefer fewer, larger steps that stay reviewable over many micro-steps.
- If a step in your own sequence is not worth doing, say so and drop it.
- Be concrete and dense. No filler. Do not restate this prompt.
