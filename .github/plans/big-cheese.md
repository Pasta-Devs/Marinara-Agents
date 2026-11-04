# Big Cheese

Status: concept, branch `big-cheese-agent` (local plan, not pushed). No PR yet.
Mockups: https://claude.ai/artifact/9gniMXoxfpKZXHx6xdzc9j (private Claude artifact, 11 phone screens).

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
5. **Everything the AI makes, the player can change.** Every generated part is data in a Place
   Kit: you can edit it, save it, share it and start a new run from it.

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

## Make it yours: customization

### Place Kits

A Place Kit is the whole place as one JSON document: premise, meter names and start values, extra
meters, departments and rooms, people and stakeholder groups, meeting types, crisis deck, house
rules, stance table overrides and the feel dials. The wish makes a kit. The preview opens it.

- **Kit editor** (tabs Meters, People, Rooms, Events, Rules). Rename anything, change start
  values, delete or add people, write your own crisis cards.
- **Extra meters:** up to 2 more meters per place (for example "Rum supply" on a pirate ship).
  Each extra meter maps to one of the four types, so the rules still work.
- **Save as kit / Share kit:** export and import a kit file. A shared kit holds no run history.
  Kits are validated on import (schema, limits, text length) like any untrusted input.
- **Built-in kits:** Warehouse, University, Hospital ward, Restaurant, Hotel, Startup,
  Newsroom, Esports team, Zoo, Theme park, Space station, Pirate ship, Royal court, Magic academy,
  Haunted inn, Mercenary guild. Each is a normal kit the player can copy and edit.
- **Kit from text:** paste a lore text or a lorebook and the AI drafts a kit from it.

### Feel dials (per run)

| Dial | Range | What it changes |
|---|---|---|
| Tone | Cozy ↔ Drama | card topics, how harsh people speak, crisis themes |
| Realism | Silly ↔ Real | how absurd events may get |
| Difficulty | Easy ↔ Brutal | delta size, firing threshold, hours per day |
| Storyteller | Calm / Classic / Chaos / Custom | event pacing (Custom = own sliders) |
| Era | Any text, for example "1920s", "far future" | names, technology, language |
| Pace | Short day (3 hours) / Full day (5 hours) | length of a week |

### Your role

- **Big Cheese** (default): you run the whole place.
- **Middle manager:** you run one department and have a boss above you who sends you demands.
- **Rising star:** you start as a shift lead or a junior teacher and get promoted to the top.
  Each promotion opens more of the place and more meters.
- **Owner:** you set the budget and the rules and hire a manager (played by the AI) to run it.

### Modules

Optional parts, switched on per run (Modern Life Sim module pattern):
Office drama (romances, cliques, feuds) · Union and strikes · Deep finance (ledger, salaries,
quarterly budget) · Building (rooms and upgrades) · Press and social media · Horror (the place
has a dark secret) · Adult (off by default, asks the player to confirm age).

## Make it alive: depth

### People, deeper

- **Ambitions:** each person wants something (your job, a raise, a quiet life, to leave).
- **Relationships between people:** ally, feud, crush, mentor, secret romance. They change on
  their own each week and create cards ("Tomas and Vera refuse to work together").
- **Secrets:** each key person has one. You learn it at trust 60, from the grapevine or in a crisis.
- **Hire, promote, let go:** hiring shows 3 candidate cards and an interview scene. Letting
  someone go changes the trust of their friends.
- **Make a character card:** turn any staff member into a Marinara character card (with their
  memories as a lorebook entry) to chat with them outside the game.

### House rules (policies)

Standing rules that change the meters every week without a card: sliders (night-shift bonus,
tuition level, speed target), toggles (phones on the floor, Friday pizza) and rules the player
writes in their own words (the model maps them to a meter type and a stance; the code sets
the numbers). Changing a rule costs 1 hour and the people who care react.

### Grapevine and press

- **Grapevine:** a feed of what people say when you are not in the room: complaints, plans,
  rumours. Some rumours are false; checking one costs an hour.
- **Press:** a local paper or a social feed writes about your place. It moves the Standing meter.

### Wishes during the game

The wish idea stays in the game. You get 3 wishes per term. A wish asks the storyteller for
something ("a rich old graduate wants to donate, with strings attached"). It arrives in its own
way within 1-2 weeks. Wishes cannot set numbers; they only make new cards, people or events.

### Rooms and growth (Building module)

A simple floor map of rooms with who is in each room now. Spend money to upgrade a room or add
one (new lab, break room, loading dock). Each room gives a small weekly effect and new card
topics. The place grows in tiers (small → known → famous) that unlock bigger events.

### Calendar

Terms or quarters, holidays, fiscal year end, recurring meetings, and events the player
schedules (open day, team building, festival). Each scheduled event is a mini-scene with a result.

## Make it last: long-term play

- **Term goals:** 3 goals per term, chosen from 5 offers (for example "Reputation above 70",
  "No strike"). Meeting them earns wishes and perks.
- **Boss perks:** small skills you pick after each term (Negotiator: meetings start with +1
  support; Penny-pincher: cheap fixes cost less). Perks unlock new answer stances.
- **Your own bars (optional):** Energy and Stress for the boss. A hard week costs Energy; a
  burnout skips a day. Can read Persona Stats if the player uses it.
- **Delegate:** let the deputy answer severity-1 cards. They answer in their own style,
  and their trust and ambition change what they pick.
- **Endings:** win the year, fired, quit, or sold the place. Each ending is a title card with a
  short epilogue of what happened to everyone.
- **Legacy:** start a new run in the same place years later. Old staff may still be there and
  remember the last boss.
- **Achievements:** fun one-liners ("Fired in week 1", "Everyone came to your farewell").
- **Undo:** one undo per day by default (swipe-like). An Ironman setting turns undo off.

## Screens

Title (saved places) · Wish · Preview · Kit editor · Office (meters, hours, next meeting,
inbox) · Card · Meeting scene · Friday report · Staff list and Staff file · House rules ·
Grapevine and wishes · Floor map · Calendar · Goals and perks · Settings.
Bottom bar: Office, Floor, Staff, Calendar. "More" holds Rules, Grapevine, Goals and the Kit. Phone first, 44 px targets, theme tokens only in the
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

Four milestones. Each one is playable on its own; each slice is one small PR later.

**M1 · Playable** (does the loop feel fun?)
0. Skeleton: package, Home tab, title screen, empty run document, build script, catalog lane.
1. Wish → Place Kit: wish screen, generator (draft → normalize → save), preview, reroll.
2. The week: office, hours, request cards with stance table, Friday report, firing.
3. People: staff list and file, trust, stress, memory, "Talk it through" scenes.

**M2 · Alive**
4. Storyteller (Calm/Classic/Chaos), follow-up cards, crises.
5. Meetings: agenda, attendees, support in the room, votes.
6. Relationships between people, ambitions, secrets, grapevine.
7. Hire, promote, let go, delegate to the deputy.

**M3 · Yours**
8. Kit editor, extra meters, feel dials, save, export and import kits.
9. Built-in kits (16) and Kit from text or lorebook.
10. House rules (sliders, toggles, own-words rules).
11. Roles (Middle manager, Rising star, Owner) and the module switchboard.

**M4 · Lasting**
12. Term goals, perks, wishes during the game, endings with epilogues, achievements.
13. Building module (floor map, rooms, growth tiers) and Calendar events.
14. Press module, Office drama module, Deep finance module, Union module.
15. Legacy runs, Make a character card, images (portraits, backgrounds), GUIDE app.

## Not planned

Multiplayer, multiple places in one run, real-time clock, a link to Modern Life Sim (your job
there = your Big Cheese place; revisit after M4).

## Open questions

- Week length default: Full day (5 hours) or Short day (3 hours)?
- One shared stance table for all kits, or one table per place family plus kit overrides?
- Kit sharing: file export only, or also a kit catalog in Marinara-Agents?
- Do the boss's own Energy and Stress bars ship in M1 or wait for M4?

## Do not copy

No names, art or look from Artificial Academy, Two Point, Reigns or other games. Use the genre
and its mechanics only.
