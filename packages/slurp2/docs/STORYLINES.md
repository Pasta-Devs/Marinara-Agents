# Slurp Storylines (design)

Status: **concept** (2026-10-12). Nothing here is built. It extends `DRAMA.md` and
`WORLD-SIMULATION.md`; it adds no third planner.

Paths are relative to `packages/slurp2/src/engine/packages/` unless stated.

## Why

Users want storylines with real choices, different endings, and consequences that reach other
storylines, plus a way to see and edit them as a flowchart. The first story that needs all of it is
a **pregnancy**: long, with a partner, with choices (tell them? announce it?), a body that changes in
the pictures, and a result that stays after the story ends.

## What exists today

Slurp has three story systems. Each has a part of what is asked for; none has all of it.

|               | **Arcs** (life events)                                                                                                                           | **Dramas**                                                                                         | **Occasions** (events)                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Where         | `server/src/slp/modules/projects/slp-arc-library.ts`, `slp-arc-progress.ts`                                                                      | `shared/src/slp/slp-drama.ts`, `…/world/events/slp-drama-runtime.ts`                               | `shared/src/slp/slp-story-engine.ts`                                                         |
| Cast          | one Creator (crossovers aside)                                                                                                                   | 1–5 roles, the player may be one                                                                   | participants                                                                                 |
| Shape         | linear chapters; a fan poll may insert up to 4 **detour** chapters, then the line goes on (`slp-project.ts:83`)                                  | a stage **graph**: `next`, choices (`fans`/`player`/`role`) whose options lead to a stage or `end` | one event                                                                                    |
| Length        | arc ≤ 365 days, chapter ≤ 90; pace ×1.5 / ×1 / ×0.5, real time                                                                                   | ≤ 90 days, stage ≤ 30, ≤ 10 stages                                                                 | days                                                                                         |
| Endings       | one                                                                                                                                              | many paths, but one shared `exit` beat                                                             | —                                                                                            |
| Writes        | stats, mood, profile proposals. Chapter `outcomes` / `opportunities` / `influences` exist in the type but are **always empty and never applied** | ties only (`tie`, `end-tie`, `temperature`)                                                        | facts + arc opportunities, applied (`server/src/slp/data/world/slp-story-engine-storage.ts`) |
| Reads         | facts and opportunities, at arc generation (`features/projects/slp-arc-generation-service.ts:204`)                                               | `requires: { situation }` only                                                                     | —                                                                                            |
| In-app editor | yes: chapters, pace, effects, profile, polls (`client/src/slp/features/projects/SlpArcLibraryDraftEditor.tsx`)                                   | none; pack JSON import; Stir shows running runs                                                    | pack JSON                                                                                    |

So the trigger channel already exists — **facts** and **arc opportunities** in
`slurp2.story.facts` / `slurp2.story.opportunities` — but only occasions write to it.

### Gaps against the request

1. **Different endings.** Arcs have one end. Drama paths end in one shared exit.
2. **Storylines that influence each other.** Arcs and dramas write nothing to the shared fact store,
   and dramas read nothing from it.
3. **Flowchart and editing.** Neither system can be seen as a graph. Dramas cannot be edited in the
   app at all.
4. **Pregnancy needs.** Length (arcs fit, dramas do not), a partner and player choices (dramas fit,
   arcs do not), a lasting result (facts, which neither writes), and a body that changes in the
   pictures (neither).

## Rules

1. **Two runtimes stay.** Arcs and dramas keep their own runtimes and storage. They share building
   blocks (endings, outcomes, conditions, the flow view), not one merged model.
2. **One trigger channel.** Every storyline influences others only through facts, opportunities and
   ties. No storyline reads another storyline's private state.
3. **Code decides, the model writes** (as in `DRAMA.md`). Branches, conditions and outcomes are
   seeded pure code; the model never invents a plot step.
4. **Old data stays valid.** A stored arc type or pack without the new fields runs as today. A poll
   option with `chapters` is still a detour.
5. **No new model calls** for storyline logic. A chapter adds at most one line to an existing post
   or picture call.
6. **Phone first.** The flow view is a vertical list on a phone; a graph canvas only on wide screens.

## Building blocks

### A. Endings

- **Arcs:** a type gains `endings: [{ key, label, outcomes, lastBeat? }]`. A poll option gains
  `next`: a chapter key, or `end:<endingKey>`. An option with `chapters` and no `next` stays a
  detour. Chapters gain an optional `key` so `next` can name them; without keys, order is used.
- **Dramas:** `exits: { [endingKey]: beat }` beside the current `exit`, which stays the default.
  `next: "end"` keeps working; `next: "end:<key>"` picks an exit.
- The settled path (chapters visited, poll results, ending) is already partly kept on the project
  (`choices`, poll results). Keep the ending key there too, so pages and Stir can show it.

### B. Outcomes (the triggers)

One vocabulary, reusing `slpStoryOutcomeSchema` (facts with expiry, `grant-arc-opportunity`) and the
drama tie outcomes:

| Outcome                            | Arcs (chapter, option, ending)                       | Dramas (stage, ending) |
| ---------------------------------- | ---------------------------------------------------- | ---------------------- |
| add / remove creator fact          | new: applied                                         | new                    |
| add / remove world fact            | new: applied                                         | new                    |
| grant arc opportunity (story tags) | new: applied                                         | new                    |
| tie / end-tie / temperature        | new, between the Creator and a named tie (`partner`) | as today               |
| stats, mood, profile proposal      | as today                                             | —                      |

Arc outcomes apply through `applySlpStoryOutcomes` when a chapter starts, an option wins, or an
ending is reached — the same function occasions use, so facts expire and opportunities are consumed
in one place.

### C. Conditions (how storylines gate each other)

- **Start conditions** on arc types and dramas: `requires: { facts?: [tag], lacksFacts?: [tag],
tie?: kind }`. Arc generation and drama casting already filter; they check these too. Examples:
  "pregnancy needs a partner and no `pregnant` fact", "a custody drama needs `parent` and an `ex`".
- **Gated edges:** a choice option or a `next` may carry one `when: { fact | lacksFact }`. A gated
  option is hidden from the poll when it fails; a gated `next` falls through to the next listed
  edge. One condition per edge — no expressions.

### D. Look per chapter

A chapter may carry `look` (≤ 120 characters, e.g. "visibly pregnant, about six months"). While the
chapter runs, the Creator's picture plan gets that one line beside the card's appearance. Useful
beyond pregnancy: a new haircut (`new_look`), a tan after a trip, a cast after an injury.

### E. Story time

Arcs run in real days. A nine-month story at real time is too slow. An arc type may set
`storyClock: { unit: "month", per: <real days> }`: chapters then state their length in story months,
and the post brief says "month 6", never a date. Pace still multiplies.

## Flow view and editor

One client component renders both arcs and dramas from a shared node/edge list (an adapter per
system). Plain SVG, no new dependency, like the People map.

- **Phone — flow list.** Chapters or stages as cards top to bottom. A choice card shows its options
  as indented branches with a color rail; branches fold. Endings are end cards. Outcomes and
  conditions show as chips ("+ fact: parent", "opens: new parent life", "needs: partner"). Tap a
  card to edit it in a sheet.
- **Wide screens — graph.** The same data left to right, a column per depth.
- **Inline checks** from the existing drama validator (unknown `next`, an option that leads
  nowhere), plus a new unreachable-node check, shared by arcs and dramas.
- **You are here.** On a Creator's page, the running project and Stir show the same view with the
  current node and the path taken highlighted.
- **Variants.** "Duplicate as variant" copies a type with a new id and `variantOf`; the library
  groups variants under the original.
- **Dry run.** Walks the graph with seeded picks and shows the path, the outcomes and the days it
  takes. Pure code, no model call.
- **Dramas become editable** in the app with the same editor. JSON import stays.

## Pregnancy (built-in, off by default)

**Kind:** an arc (length) with a `partner` from the Creator's couple tie, or the player when her
relation to you is `partner`. **Requires:** a partner tie, no `pregnant` fact, and a Creator who can
be pregnant (open decision 3). **Once** per Creator until its ending fact expires.

| #   | Chapter (story month)   | Look                    | Choice (asks)                                                   |
| --- | ----------------------- | ----------------------- | --------------------------------------------------------------- |
| 1   | the test (0–1)          | —                       | tell the partner now or wait (Creator; the player if partner)   |
| 2   | telling the partner (1) | —                       | —                                                               |
| 3   | first weeks (1–3)       | —                       | announce to fans or keep it secret (fans or Creator)            |
| 3a  | keeping it hidden (3–5) | "bump hidden by angles" | the secret comes out on its own → 4 (gated `next` after a time) |
| 4   | the announcement (3–5)  | "small bump"            | name poll / reveal poll (fans)                                  |
| 5   | showing (5–7)           | "visibly pregnant"      | maternity shoot or not (fans)                                   |
| 6   | the last weeks (7–9)    | "heavily pregnant"      | —                                                               |
| 7   | due date (9)            | —                       | —                                                               |

**Endings:** `born` (default): facts `parent` and `baby:<name>`, profile bio proposal, opportunities
"new parent life" and "back to content". Other endings are open decision 2.

**Heat and content.** Slurp's rules apply as in `DRAMA.md`: the story gives posts a _why_, it does
not tame them; spice follows the Creator's settings; no disclaimers. One hard line, as the drama
design sets for family ties: **the child never appears in a picture and is never part of a spicy
post** — after the birth the child is only a mention.

## Phases

1. Arc outcomes applied (chapters, options) through `applySlpStoryOutcomes`; dramas write facts.
2. Endings: arc `endings` + `next`, drama `exits`; old data migrates by reading, not rewriting.
3. Conditions: start `requires`, gated edges.
4. `look` per chapter in the picture plan; story clock.
5. Flow view, read-only: library, Creator page, Stir.
6. Flow editor for arcs, then dramas; variants; dry run.
7. Pregnancy built-in; content check on a dev box.

Phases 1–4 are pure code with regressions; 5–6 are UI and need `marinara-design` proof.
Versions bump by patch.

## Cost

| Thing                                 | Cost                                            |
| ------------------------------------- | ----------------------------------------------- |
| Branches, conditions, outcomes, clock | code only                                       |
| Look line                             | ~120 characters inside an existing picture plan |
| Story month line                      | a few words inside an existing post brief       |
| Flow view, dry run                    | client and pure code                            |

## Tests

- **Graph regression:** the shared validator rejects unknown targets, unreachable nodes and gated
  edges with no fallback, for both arcs and dramas; old stored types and packs read unchanged.
- **Outcome regression:** an arc chapter's fact reaches `slurp2.story.facts`, expires, and an
  opportunity it grants raises the matching arc type at generation.
- **Simulation:** pregnancy over a seeded world, all choices both ways — every run reaches an
  ending, facts land, no picture brief of the child, `look` lines match the chapter.
- **Dry run** gives the same path for the same seed.
- **Architecture regression and typecheck** after each structural change.

## Open decisions

1. **Real length of a pregnancy** at normal pace (proposed: about 6 weeks, one story month ≈ 5 days).
2. **Which endings ship**, and which are on by default (proposed: `born` only by default; others
   as separate, opt-in endings).
3. **Who can be pregnant:** from the card's gender, or a Creator setting that defaults from it
   (proposed: the setting).
4. **Player as partner:** choices as DM chips like drama choices (proposed: yes).
5. **Loops in graphs** (a stage that leads back): allowed with `maxDays` as the stop, or rejected
   (proposed: allowed for dramas, rejected for arcs).
6. **Merging arcs and dramas** into one model later (proposed: no; revisit after phase 6).
