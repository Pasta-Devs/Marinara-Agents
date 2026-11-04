# Big Cheese

Status: concept, branch `big-cheese-agent` (local plan, not pushed). No PR yet.
Mockups: https://claude.ai/artifact/9gniMXoxfpKZXHx6xdzc9j (private Claude artifact, 7 phone screens).

Big Cheese is a stand-alone game in its own Home tab, a sibling of Modern Life Sim. The player
wishes for any place, such as a warehouse, a university campus, a hospital ward or a space station,
and runs it as the boss. Staff and stakeholders are characters who remember what the boss decides.

## Pillars

1. **Any place, one ruleset.** The AI names everything. The code knows only four fixed meter
   types, so every place plays by the same tested rules.
2. **People, not spreadsheets.** Every request comes from a person with a face, a trust value and
   a memory. Numbers are the result of how you treat people.
3. **The code owns the numbers, the model writes the words.** (Modern Life Sim rule.) The model
   never sets a meter, a trust value or an outcome.
4. **Short loop, long story.** One week is about 10 minutes of play. A run lasts a few in-game
   months, until you win the year or the board fires you.

## What we learned

| Source | Lesson we use |
|---|---|
| Reigns | A request card with 2-3 answers. Show *which* meters an answer touches, not *how much*. A meter at an extreme ends the run. |
| Two Point Campus | Staff traits, a schedule of events, inspections and disasters keep a place alive. |
| RimWorld | A storyteller picks events from the current tension. The player chooses its style (Calm, Classic, Chaos). |
| MiniBistro, SlaveMaker | LLM staff with personalities and memory; a daily or weekly report. |
| Market gap | No polished "run any place you want" game exists. Most are ChatGPT prompts without real state. |
| Modern Life Sim | Home tab, saved runs as title cards, cast from character cards, VN scenes, the JSON-retry model helper, write queue with revisions. |
| Turn games (poker, chess) | Pure state functions; the model proposes, code validates, then the model narrates. |
| Hierarchical maps | AI draft → normalize → persist. Snapshot so a regenerate rewinds correctly. |
| Slurp2 | Event blueprints with scheduled occurrences and outcomes. |

## The fixed meter types

Every place has exactly four meters, one per type. The AI gives each a label that fits the place.

| Type | Warehouse | University | Hospital ward | Space station |
|---|---|---|---|---|
| Money | Budget | Endowment | Ward budget | Credits |
| Output | Throughput | Grades | Patients treated | Research |
| People | Crew morale | Campus mood | Staff morale | Crew morale |
| Standing | Safety record | Reputation | Inspection score | Command trust |

Meters run 0-100. A meter below 10 for two weeks in a row ends the run ("the board asks you to
leave"). A meter at 100 is safe; Reigns-style "too much" endings are not in v1.

## Core loop

1. **Wish** (one line + size + storyteller + optional character cards as staff).
2. **Preview** the place sheet: name, premise, departments and rooms, 4 meters, 3 key people,
   recurring meetings. *Reroll* or *Take the job*.
3. **Week** (Monday to Friday). The boss has **5 hours per day**.
   - **Inbox:** 3-5 request cards per day. Answering one costs 1 hour. A card you ignore grows
     ("Waited 2 days") and its next version is worse.
   - **Talk it through:** opens a short VN scene with that person; costs 1 hour; can unlock a
     better answer.
   - **Walk the floor:** visit a room and see who is there (later slice).
   - **Meetings** from the calendar.
4. **Friday report:** meter changes, "who remembers", warnings, next week's meetings.
5. **End:** win the year (meet 3 term goals) or get fired. The run stays as a title card.

## Request cards: who decides what

- **Code** picks the card seed: who asks, which meter types, severity 1-3, and any follow-up the
  card continues. The storyteller sets severity and frequency.
- **Model** writes the text and 2-3 answers. Each answer must carry one stance tag from a fixed
  list: `invest`, `cheap_fix`, `delay`, `delegate`, `refuse`, `ask_others`.
- **Code** maps stance × severity × place type to meter deltas and trust changes from a table,
  and may schedule a follow-up card 1-3 weeks later (for example `delay` → a worse roof leak).
- The card shows the meter types an answer touches ("Money · Mood"), never the numbers.

## People

- 8-16 named people per place; the rest is "the crew" or "the students".
- Roles: deputy, department heads, wildcards, and **stakeholder groups** with a spokesperson
  (parents' council, union, board, investors, inspectors). The wish decides which groups exist.
- Each person: role, 1-2 traits from a fixed catalog (reuse Modern Life Sim's archetype-knob
  shape), **trust** 0-100, **stress** 0-100, and a short memory list of decisions that touched them.
- Optional: staff from the player's character cards (read with the same card-reading tasks as
  Modern Life Sim).
- A deputy with an agenda is part of every place: low trust in you raises their chance to move
  against you at the board.

## Storyteller

- Tension score from the four meters and open follow-ups.
- **Calm:** fewer cards, severity 1-2, crises rare. **Classic:** tension rises and falls in waves.
  **Chaos:** random severity, crises any week.
- Crisis events per place family (inspection, strike, flood, viral post, outbreak, power cut).
  The model may improvise a crisis, but it must name one meter type and one stance list.

## Meetings

- Types come from the place sheet: board meeting, parent-teacher conference, union talks,
  investor pitch, all-hands, safety audit.
- A meeting has 2-3 agenda items built from open cards and follow-ups, and 3-6 attendees.
- It runs as a VN scene (Modern Life Sim shape `{lines, suggestions}`), one item at a time.
  The player picks a suggested line or types freely. The model must tag the player's line with a
  stance from the fixed list.
- **Support in the room** is computed by code from each attendee's trust and stance preference.
  Board items end in a vote; others end in an agreement the code turns into deltas.

## Screens

Title (saved places) · Wish · Preview · Office (meters, hours, next meeting, inbox) · Card ·
Meeting scene · Friday report · later: Floor map, Staff files, Calendar, Settings.
Bottom bar: Office, Floor, Staff, Calendar. Phone first, 44 px targets, theme tokens only in the
real build (the mockup colours are placeholders).

## Technical shape

- New package `packages/big-cheese` in Marinara-Agents, slot `home-browser-tab`, permissions
  `routes`, `storage`, `ui` (+ `network` only if images need it). Engine changes: none planned.
- **Source in the repo** and built by a repo script. (Modern Life Sim ships only minified
  bundles; its source is not reviewable. Do not repeat that.)
- One run = one document in `api.persistence.documents` with `saveVersion`, a migration function
  and a "newer save" guard. Writes go through a per-run queue with `expectedRevision`.
- Time advances only on player actions (`advance` route returns `events[]`), like Modern Life Sim.
- One model helper: JSON extract + repair, a validator with one fix-up retry, retry with more
  room on `finishReason == "length"`, retry once on an empty answer, per-task token budget that
  leaves room for reasoning models, and a `/calls` debug log. Honor the Engine debug mode.
- Model calls per week: ~1 batch call per day for cards, 1 call per scene turn, 1 report call.
  Place generation is 1-2 calls.
- UI: render each section on its own with its own error fallback. Small read routes for light
  views. One shared poller with stop conditions. (These fix the Modern Life Sim freezes and flicker.)
- Images are optional. Without an image connection, people get initials and places get
  illustrated cards.
- Copy goes through the package locale files.

## Slices

0. **Skeleton:** package, Home tab, title screen, empty run document, build script, catalog lane.
1. **Wish → place:** wish screen, place generator (draft → normalize → save), preview, reroll.
2. **The week:** office dashboard, hours, request cards with stance table, Friday report, firing.
3. **People:** staff files, trust and memory, "Talk it through" scenes.
4. **Storyteller:** Calm/Classic/Chaos, follow-up cards, crises.
5. **Meetings:** agenda, attendees, support in the room, votes.
6. **Goals and endings:** term goals, win the year, end cards on the title screen.
7. **Extras:** floor map, images, GUIDE app, character cards as staff.

Slices 0-2 are the smallest version that shows whether the loop is fun.

## Not in v1

Building or room layout, hiring markets, salaries per person, multiple places at once, a link to
Modern Life Sim (your job there = your Big Cheese place), adult content.

## Open questions

- Week length: 5 days with 5 hours each, or a shorter 3-slot day?
- Does the player have a body (Energy, Stress like Persona Stats), or only the place meters?
- Can the player rename meters and people in the preview?
- One shared stance table for all places, or one per place family?

## Do not copy

No names, art or look from Artificial Academy, Two Point, Reigns or other games. Use the genre
and its mechanics only.
