# Big Cheese

Status: concept, plan files only. No PR yet.
Mockups: https://claude.ai/artifact/9gniMXoxfpKZXHx6xdzc9j (private Claude artifact, 18 phone screens).

Big Cheese is a stand-alone game in its own Home tab, a sibling of Modern Life Sim. The player
wishes for any place, such as a warehouse, a university campus, a hospital ward or a space station,
and runs it as the boss. Staff and stakeholders are characters who remember what the boss decides.

This file is the hub. When it and a detail file disagree, the detail file wins.

| File                                     | What it holds                                                                                                                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [design.md](design.md)                   | How the systems work: time, threads, cards, storyteller, meetings, hearings, people, free actions, viewer mode, model tasks, routes, data shapes, package layout |
| [content.md](content.md)                 | Numbers and content: stance table, Friday settle, the six built-in kits, decks, traits, goals, perks, endings, house rules                                       |
| [modules.md](modules.md)                 | Place systems (Project, Big event, Season), story layers, more features, mutators                                                                                |
| [cast.md](cast.md)                       | Your Engine characters and personas inside the game, export back to the Engine                                                                                   |
| [ui.md](ui.md)                           | Screens and UX: phone-first layout, navigation, wireframes, motion, copy rules, components, screenshot proof                                                     |
| [cheese-board.md](cheese-board.md)       | The cheat menu: Set and Spin layers, journal, exact rewind, Coming up                                                                                            |
| [sim/stance-sim.mjs](sim/stance-sim.mjs) | Balance sim for the stance table and the Friday settle. Run: `node .github/plans/big-cheese/sim/stance-sim.mjs`                                                  |

## Pillars

1. **Any place, one ruleset.** The AI names everything. The code knows only four fixed meter
   types, so every place plays by the same tested rules.
2. **People, not spreadsheets.** Every request comes from a person with a face, a feeling about
   you and a memory. Numbers are the result of how you treat people.
3. **The code owns the numbers, the model writes the words.** (Modern Life Sim rule.) The model
   never sets a meter, a trust value or an outcome.
4. **Short loop, long story.** One week is about 15-20 minutes of play. A year is 3 terms of 8
   weeks (24 weeks). A run lasts until you win the year or lose your post.
5. **Everything the AI makes, the player can change.** Every generated part is data in a Place
   Kit: you can edit it, save it, share it and start a new run from it.
6. **Say it and the place answers.** You can type your own answer to any card (`answer.tag`) and
   type an action anywhere (`action.tag`). You can talk to anyone, go anywhere, change any rule,
   edit the kit and change the game state on purpose through the Cheese Board. The code still
   decides what it costs and what it does.

## What we learned

| Source                    | Lesson we use                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Reigns                    | A request card with 3 answers. Show _which_ meters an answer touches, not _how much_.                                               |
| Two Point Campus          | Staff traits, a schedule of events, inspections and disasters keep a place alive.                                                   |
| RimWorld                  | A storyteller picks events from the current tension. The player chooses its style (Calm, Classic, Chaos).                           |
| Market gap                | No polished "run any place you want" game exists. Most are ChatGPT prompts without real state.                                      |
| Modern Life Sim           | Home tab, saved runs as title cards, cast from character cards, VN scenes, the JSON-retry model helper, write queue with revisions. |
| Turn games (poker, chess) | Pure state functions; the code decides, the model narrates.                                                                         |
| Slurp2                    | Event blueprints with scheduled beats. Stir showed what a cheat menu must do better (cheese-board.md §1).                           |

## The fixed meter types

Every place has exactly four meters, one per type. The AI gives each a label that fits the place.

| Type     | Warehouse     | University  | Hospital ward    | Space station |
| -------- | ------------- | ----------- | ---------------- | ------------- |
| Money    | Budget        | Endowment   | Ward budget      | Credits       |
| Output   | Throughput    | Grades      | Patients treated | Research      |
| People   | Crew morale   | Campus mood | Staff morale     | Crew morale   |
| Standing | Safety record | Reputation  | Inspection score | Command trust |

Meters run 0-100. Meters also move without cards. The **Friday settle** (content.md §1.5) runs
after the last answer each Friday:

1. Income: Money + 2 + (Output - 50) / 5.
2. Drift: every meter moves 10% of the way to 50.
3. Wear: every meter -2.
4. An extra meter below 20 gives its main meter -2.
5. A meter below 10 on the second Friday in a row starts a board hearing (see below).

## Core loop

1. **Wish or kit.** M1 starts from a hand-written kit (Hafenkai first). The wish generator comes
   after the loop is fun. You can bring a persona as the boss and up to 3 character cards as staff.
2. **Preview** the place sheet: name, premise, rooms, 4 meters, key people, meetings, systems.
   _Reroll_ or _Take the job_.
3. **Week** (Monday to Friday). The boss has **5 hours per day**; every action costs whole hours.
   - **Inbox:** today's cards (Classic 3 a day, Calm 2, Chaos 2-5). Answering costs 1 hour.
   - **Talk it through:** a short VN scene with that person; 1 hour; can add a fourth answer.
   - **Do something:** type any action; it maps to a verb the code knows or a new thread.
   - **Walk the floor, meetings, the grapevine.**
4. **Friday report:** meter changes, one feeling line per key person, warnings, next week.
5. **End:** win the year (reach the end of term 3 and meet at least 2 of the 3 goals in every
   term), keep the job without a win, or lose a hearing. The run stays as a title card.

The first week is guided. The thread "Letters from the last boss" has 5 letters in the drawer.
Each one points at a person and a screen (design.md §3.6).

## Threads

Threads replace loose cards (design.md §3). A thread is one story: a leaking roof, a promise to
Cormac, a deputy's plan, a missing key. It has people, a need meter, a stakes line, a clock (a
due week or "open"), beats (cards, scenes, small moments) and a state (open, won, lost, dropped).
Follow-ups, personal arcs, crises, cover-ups, mysteries, promises, projects, wishes and hearings
are all thread kinds.

The storyteller keeps 5-8 threads open (Calm 5, Classic 6, Chaos 8). The Office screen shows open
threads as story cards ("The Stacks roof · Yusuf · patched"). The inbox shows today's beats.
Closed threads go to the chronicle.

**Big scenes** are longer VN scenes in 3-6 parts for climaxes and calendar events (a hearing, the
Boat Race, a party, a date). Each costs 2 hours, and the week view shows them in advance
([design.md §3.8](design.md#38-big-scenes)).

## Cards: who decides what

- **Code** picks the seed: who asks, the **need** (the one meter the problem threatens), severity
  1-3 and the thread it belongs to.
- **Code** picks 3 answers: one strong (`invest`), one middle (`cheap_fix` or `delegate`) and one
  weak (`delay`, `refuse` or `ask_others`). Strong leaders and absolute rulers add their own
  stances to the tiers.
  Traits, culture and perks weight the pick (content.md §1.6).
- **Model** writes only the asker's text and the words for the 3 answers. A validator checks that
  each text fits its stance: one fix-up retry, then template text.
- **Code** applies the stance table (content.md §1.1): the answer changes the need by k, half or
  a quarter (k = 3 / 6 / 10 by severity) and may cost a second meter. It may schedule a follow-up
  beat 1-3 weeks later (content.md §1.3).
- The card shows the meter types an answer touches ("Reputation · Grades"), never the numbers.
- **Say something else.** The player types any answer. `answer.tag` maps it to one allowed stance
  (any stance the kit allows, not only the 3 offered), says if it is possible here, and pulls out
  promises. Possible: the code applies the stance and opens a promise thread for each promise.
  Not possible: the asker says why and no hour is spent (design.md §4.4).
- **Ignored cards** grow each day. On day 5 the problem happens: the need takes the full -k.
- **Prefetch:** at the Evening slot the server writes tomorrow's cards, so the inbox opens at once.

## Board hearing

A low meter does not fire the boss at once (design.md §7.4). When a meter is below 10 on the
second Friday in a row, the body above (board, trustees, the crew vote under the Article) calls a
hearing. The boss has prep days for allies and evidence, then a meeting scene with a vote. Won:
the meter goes to 20 and the boss gets a **last warning** (next time, no hearing). Lost: the
ending (Fired, Voted out, Marooned). Absolute rulers have no hearing: a low meter costs Legitimacy
-10 a week, Legitimacy 0 starts a revolt thread, and losing it ends the reign.

## People and feelings

- 8-16 named people per place, plus stakeholder groups with a spokesperson. Each has a role, 1-2
  traits, an ambition, a secret, a routine, a voice sheet and memories. The code keeps trust (or
  Fear and Love), stress, mood and relations.
- **Feelings, not numbers** (design.md §8). Each Friday the model writes one feeling line per key
  person from their memories ("Yusuf: thinks you are cheap, but fair"). The Staff file shows the
  feeling line, the mood and a few memories. The "Show numbers" setting shows the numbers too. The
  Cheese Board always shows them.
- A deputy with an agenda is part of every place. Each `delegate` gives them +15 ambition. At 100
  they challenge you at the board.

## Storyteller and pacing

- Tension (design.md §5) sets what comes next. **Calm:** 2 cards a day, rare crises.
  **Classic:** 3 cards a day, tension in waves. **Chaos:** 2-5 cards a day, crises any week.
- A calm place gets harder cards: Classic and Chaos use the severity mix 25 / 45 / 30 while the
  meter part of tension is below 20.
- **Meetings** (design.md §7) run as VN scenes with 2-3 agenda items from open threads. The code
  picks 3 stances per item and counts support in the room; the player picks a line or types one.

## Balance

The sim plays a 24-week Hafenkai year with strong / middle / weak offers on every card, 500 runs
per bot (`node .github/plans/big-cheese/sim/stance-sim.mjs`).

| Bot                                      | Fired                                          |
| ---------------------------------------- | ---------------------------------------------- |
| Careful (keeps the lowest meter highest) | 0%, ends near 70 on every meter                |
| Random                                   | 45%                                            |
| Always one stance                        | 45% (`invest`) to 95% (`refuse`, `ask_others`) |

The sim is the CI gate. When `cards.ts` and `storyteller.ts` exist, the sim imports them. CI
fails when a careful bot is fired, or when a random bot is fired in fewer than 20% or more than 60%
of runs. Change a number in content.md §1, change it in the sim and run the sim again.

## Engine characters and personas

Bring your own people (cast.md). A persona can be the boss; cards can be staff, visitors or story
roles. `cast.read` turns a card into an editable casting sheet. The game never writes a card back.

| Works with today's `api.runtime.resources`                                                          | Needs a small Engine change                                                                                                                        |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read character cards and personas (`listCharacters`, `listPersonas`)                                | Make a character card from a generated person: needs `resources.createCharacter`. Fallback: export a card file the player imports.                 |
| Write the run's memories and the place as lorebooks (`createLorebook`, `bulkCreateLorebookEntries`) | Call someone (a normal chat with that character): needs chat creation in the capability API and a host `openChat(chatId)` call. Parked until then. |
| Add an opt-in note to a persona (`updatePersona`)                                                   |                                                                                                                                                    |

Card avatars come through the HTTP route `/api/characters/:id`. Professor
Mari is never cast.

## Cheese Board

The cheat menu, named for the cheese board and the board of directors (cheese-board.md). It is
better than Slurp2's Stir in the places where Stir is weak.

- **Set layer:** direct edits, no AI, instant and exact. Meters, feelings, relations, secrets,
  rooms, cards, threads, time, rules, layers, cast.
- **Spin layer:** plain words ("Imogen falls for Cormac", "a storm floods the boathouse next week")
  become a planned thread with up to 8 beats. The model picks sizes, the code sets the numbers,
  and the preview shows every beat, when it lands and what it changes.
- **Exact rewind and journal:** every play saves a snapshot first. Any play in the journal can be
  rewound at any time, not only from a toast. "Revert values" undoes a Set play and keeps the time
  played since.
- **Coming up:** one timeline of every scheduled beat, wish and thread clock. Each row can be
  moved, changed, cancelled or forced now.
- People never refuse a play, but they react in character after it. No budget: a failed plan
  costs nothing. Honest run adds a cheese mark; Sandbox pins the Board; Ironman closes it.

## Make it yours

- **Place Kits:** the whole place is one JSON document (design.md §14). Edit, save, share and
  import it (validated like any untrusted input). Up to 2 extra meters, each mapped to a type.
- **Built-in kits** (content.md §2): Hafenkai Logistics, Hollowmere University, St. Corvin's
  Academy, Kingdom of Valmora, the _Salt Magpie_, Ward 7.
- **Feel dials:** Tone, Realism, Difficulty, Storyteller, Era, Pace (5 or 3 hours a day).
  **Roles:** Big Cheese (default), Middle manager, Rising star, Owner.
- **Modules** (modules.md): place systems (Project, Big event, Season), 12 story layers and two
  depth options (Detailed money, Detailed building).
- **House rules** (content.md §11) and **wishes** (3 points per term; a wish becomes a `wish`
  thread and never sets a number).

## Make it alive

The most important goal. A place feels alive when it moves without you, reacts to you and
remembers you. Rules for every slice:

1. **Something always moves.** People change rooms each time slot; an ambient line on every
   screen.
2. **Everything gets a reaction** within a day: a face, a grapevine line, a note on your desk.
3. **Callbacks.** The code picks 1-2 memories for every scene and card.
4. **Small life, not only crises.** About 70% small moments, 30% stakes.
5. **Surprise budget.** At least one surprise per week that the player did not cause.
6. **People have days, the place changes visibly** (mood, sick days, wear, repairs, decorations).
7. **Each person has a voice.** A voice sheet made once and used in every line.
8. **Alive test:** after week 2, can the player name 3 people and what they want? Did something
   happen that they did not cause? Did someone remember a decision?

Depth that serves these rules: relations, secrets, the grapevine, rooms and routines, the world
outside, things in the drawer, culture and traditions (design.md §6-8, modules.md §4).

## Authority: what kind of boss you are

The kit sets an **authority level**. It changes the rules, not only the words.

|                    | Manager                                 | Strong leader                             | Absolute ruler                                              |
| ------------------ | --------------------------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| Example            | Hafenkai site manager, Ward 7           | Hollowmere Provost, _Salt Magpie_ captain | St. Corvin's Headmaster, King Aldric of Valmora             |
| Who can remove you | a hearing before the board or the owner | a hearing and a vote                      | nobody: only a revolt, a coup, ruin or an outside power     |
| House rules        | proposals, often need a vote            | rules, people may push back               | decrees: instant, but each costs Love or Legitimacy         |
| People values      | Trust                                   | Trust                                     | Fear and Love                                               |
| Extra stances      | none                                    | `reward`, `punish`                        | `decree`, `punish`, `pardon`, `reward`, `banish`, `appoint` |
| Loss               | Fired                                   | Voted out, Marooned                       | overthrown, abdication                                      |

Absolute kits add Legitimacy, enforcers and plots (design.md §9; kits in content.md §2.3-2.4).

## Adult module

Mature and explicit themes are a full part of Big Cheese, in one optional module (Modern Life
Sim's Adult module pattern).

### Switching it on

- Off by default. Switched on per run at the wish or in the kit, after the player confirms they
  are an adult. A run with it on shows an "18+" mark on its title card.

### Intensity and themes

- **Intensity:** Fade to black · Suggestive · Explicit. It sets how scenes are written. The
  story results (relationships, scandals, numbers) are the same at every level.
- **Themes**, each switched on or off by the player:
  romance and dating · workplace affairs · the boss's own love life · rivalries in love and
  jealousy · infidelity and cheating · cuckolding / NTR (your partner and someone else, with
  you as the one who finds out, watches or agrees) · open relationships and polyamory · power
  and dominance games kinks the player lists in their own words.

### How it plays

- **Romance values:** each person gets a Romance value and an Attraction value toward the boss
  and toward other people (Modern Life Sim's three-number bond shape: friendship, romance, trust).
- **Your love life:** date someone at the place or outside it. Dating a subordinate creates
  favouritism rumours, jealousy and a Standing risk. A partner can live at another place.
- **Cheating and cuckolding:** the storyteller can build an affair thread over several weeks
  (hints, lies, a discovery, your choice) when the theme is on. With the cuckolding theme, the
  player can choose to be told, to watch the story unfold, or to agree to it. Traits decide who
  strays (faithful, jealous, curious).
- **Wishes and Spins** can ask for adult storylines inside the switched-on themes.
- **Staff drama:** affairs between staff create cards, scandals, broken teams and resignations.
- **Private places:** rooms marked private are where explicit scenes happen. Viewer mode shows a
  closed door there unless the player turns that on.

### Technical rules

- The adult prompt parts are only sent when the module is on for that run.
- If the model refuses or the provider blocks a scene, the game falls back to fade to black and
  goes on. The refusal is logged in the `/calls` log.
- Explicit images are generated only when the player switches them on and has an image
  connection that allows them. Otherwise the game shows the normal illustrated card.
- Adult runs: optional "hide 18+ runs" on the title screen, blurred title cards, and adult
  scenes are never in the yearbook, the chronicle or an export unless the player chooses.

## Ways to play and long-term play

- **Viewer mode** and **skip ahead** with a digest (design.md §11-12). The place never moves
  while the tab is closed.
- **Scenarios** (a kit with fixed start meters, a fixed opening thread and one set goal), **Sandbox,
  mutators** (modules.md §4, cheese-board.md §7), term goals, perks, endings, achievements,
  a yearbook page each term, legacy runs.

## Technical shape

- New package `packages/big-cheese` in Marinara-Agents, slot `home-browser-tab`, permissions
  `routes`, `storage`, `ui` (+ `network` only if images need it).
- **Engine changes:** none for M1-M3. Two small ones for M4 cast features: `resources.createCharacter`
  and a host `openChat(chatId)` call with chat creation (cast.md §6). Both have fallbacks.
- **Source in the repo**, built by a repo script. (Modern Life Sim ships only minified bundles;
  do not repeat that.)
- One run = one small document in `api.persistence.documents` with `saveVersion`, a migration and
  a "newer save" guard. Big text lives in child documents. Writes go through a per-run queue with
  `expectedRevision`.
- Time advances through one `advance` route that returns `events[]`. No server-side clock.
- Pure modules (clock, storyteller, threads, cards, actions, meetings, people, authority, board)
  take state and return new state. Each gets a small runnable check, and the Cheese Board can
  snapshot and rewind any state.
- One model helper with a validator, one fix-up retry, a `/calls` debug log and Lite mode with
  template fallbacks. Phone first, 44 px targets, theme tokens, locale files.
- Model tasks, routes and package layout: design.md §15-17.

## Slices

Four milestones. Each one is playable on its own; each slice is one small PR later.

**M1 · Playable** (does the loop feel fun?)

1. Skeleton: package, Home tab, title screen, run document, build script, catalog lane, model
   helper with Lite mode, the sim as CI gate.
2. Hafenkai kit (hand-written) and the guided week "Letters from the last boss". The kit's other
   opening threads wait for M2.
3. The week: office, hours, cards with strong / middle / weak answers, Say something else, Friday
   settle and report with feeling lines, board hearing. A minimal thread core carries the guided
   thread and the promise threads from own answers (modules.md §5).
4. Persona as the boss and up to 3 cards as staff: picker, casting sheet, `cast.read`, age check
   (cast.md §11).
5. Cheese Board Set for meters, feelings, cards and time, the journal with snapshots, rewind and
   revert (cheese-board.md §10).

**M2 · Alive:** the full storyteller (5-8 open threads, all 11 thread kinds), the Drama and Romance layers, the Project block,
systems chips on Preview (modules.md §5). Meetings, rooms and routines, relations, grapevine,
viewer mode and skip ahead. Cheese Board Spin, Coming up and reason seeds. Cast swap, mid-run hire,
visitors and story roles.

**M3 · Yours:** kit editor, the wish generator, all six built-in kits, Big event and Season, Press
and gossip, Rivals, Family and home, advisors, office hours. House rules and decrees, roles, the
Adult module, Scenarios and Sandbox. Cheese Board
cast insert, layer switches, Honest run, Ironman. Lorebook and persona-note export.

**M4 · Lasting:** Crime, Politics, Mystery, Horror, Legacy, The strange, depth options,
delegation, favours, eyes and ears, mini-games, the world outside, things, goals and perks,
yearbook. Make a character card and Call someone when the Engine changes land.

**Later:** the later place blocks (Queue, Rota, Market, Stock, Ranking, Map, Faction), the hook
extraction, data-only packs, career mode, many places, return visit, daily challenge, photo mode.

## Not planned and parked

Not planned: multiplayer, multiple places in one run, a clock that runs while the Engine is
closed. Parked until the game feels alive: a Slurp2 feed for the grapevine, Illustrator and Music
DJ helpers, a link to Modern Life Sim. Persona as the boss and the place as a lorebook moved to
cast.md.

## Open questions

These are still open in the detail files.

1. **Last warning:** does it last the whole run, or reset after one term? (design.md §7.4 says
   only "the next time".)
2. **Revolt numbers** (Legitimacy 25, 3 weeks) are first values and not simulated (design.md §9).
3. **Absolute-ruler stances and tiers** are first values; the sim tests only the Manager row
   (content.md §1.1, §1.6).
4. **Morale-floor goals** such as "Crew morale 55 or more for the whole term" are not in the sim
   (content.md §2.1, §9). The sim does not model term goals at all.
5. **Professor Mari:** the Engine has no marker to detect her, so the picker cannot yet leave her
   out by a field (cast.md §4).
6. **Cheese Board first values to tune:** an 8-week Spin horizon (or the whole year), a
   30-minute preview lifetime, 7 morning snapshots for "Rewind a day", "Revert values" for Set
   plays, and the Board closed in Ironman (cheese-board.md §4, §5, §7, §8).
7. **Kit sharing:** file export only, or also a kit catalog in Marinara-Agents?
8. **Boss Energy and Stress bars:** M1 or later?
9. **Legitimacy:** shown to the player, or only felt through events?
10. The questions in [cast.md §12](cast.md) (cast slots, persona note timing, can a cast person
    leave the story, card file format) and [cheese-board.md §11](cheese-board.md) (cheese mark in
    a Normal run, Spin horizon, rewind toast, "vanishes").

## Do not copy

No names, art or look from Artificial Academy, Two Point, Reigns or other games. Use the genre
and its mechanics only.
