# Big Cheese

Status: concept, branch `big-cheese-agent` (local plan, not pushed). No PR yet.
Mockups: https://claude.ai/artifact/9gniMXoxfpKZXHx6xdzc9j (private Claude artifact, 18 phone screens).

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
has a dark secret) · Adult (off by default, asks the player to confirm age; see "Adult module").

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

## Places, the world and things

### Rooms inside the place

The place is a small map, not a list. Reuse the hierarchical-maps idea (AI draft → normalize →
snapshot), but keep it simple: zones → rooms, 6-20 rooms per kit.

- **Room fields:** name, kind (work, social, private, outside, hidden), capacity, opening hours,
  **condition** 0-100, the meter type it feeds, upgrades, a mood tag and an optional background.
- **Condition wears down** with use and weather. A worn room makes cards ("The roof is leaking
  again") and incidents. Repair costs money and hours.
- **Hidden rooms:** the roof, the old archive, the cold store at night. They need a key or a
  secret to open and often hold the best scenes.
- **The player shapes rooms:** rename, add or remove them in the kit editor, or wish for one in
  the game ("a rooftop garden"). The model writes the room; the code sets its cost and effect.

### People move around

- Every person has a **routine**: their shift or timetable plus habits ("smokes behind the fence
  at 15:00", "eats lunch alone in the library"). The code moves people every time slot.
- The **floor map** shows who is where right now. People who avoid each other never share a room;
  a crush makes two people meet "by accident".
- **Visiting a room** costs ½ hour. You see who is there, may **overhear** something (a plan, a
  complaint, a rumour), can **step in** for a scene, **keep listening**, **inspect** the room, or
  leave. Overheard lines feed the grapevine and unlock cards and secrets.
- Being seen matters: staff work harder in rooms you visit often, and talk more freely in rooms
  you never visit.

### Time and weather

Time slots (morning, afternoon, evening, night) decide who is where. Night-shift places have a
real night crew. Seasons and weather change outside rooms, visitors and card topics
(enrolment season, Christmas rush, a storm closes the harbour).

### The world outside

A second map with 4-8 outside places that the kit makes for the place type:

| Outside place | Role | What it does |
|---|---|---|
| Rival | competitor | has its own simple strength value; poaches staff, undercuts deals, can be outplayed |
| Supplier / partner | relation 0-100 | delivery days, price changes, favours |
| Authority | inspector, ministry, port authority | inspections, permits, fines |
| Money | bank, investors, donors | loans, interest, strings attached |
| Press | local paper, social feed | stories that move the Standing meter |
| After-work spot | pub, café, staff homes | off-duty scenes; people say what they never say at work |

A trip costs 2 hours. Outside places also come to you as **visitors** (the inspector, a parent,
an investor) and show up as cards or as people on the floor map.

### Things

- **Equipment** belongs to rooms (forklift, lab gear, beds, ovens, a ship's cannon). Each item
  has a condition and feeds one meter type. Broken equipment makes cards; you repair, replace or
  sell it.
- **Stock** (only for places that move goods: warehouse, restaurant, shop) is one number per kind
  with a delivery schedule. Running out makes a crisis. No per-item inventory in v1.
- **Your drawer** holds the boss's own things:
  - **Keys** open hidden rooms.
  - **Gifts** go to people (gift tastes like Modern Life Sim) and raise trust.
  - **Documents:** contracts with due dates, letters, and **meeting minutes** written by the
    model and stored as text.
  - **Evidence:** secrets and overheard lines become evidence cards. Playing one in a meeting
    gives big support changes, and people remember who used it.

### Rooms and growth (Building module)

Spend money to upgrade a room or add one (new lab, break room, loading dock). Each room gives a
small weekly effect and new card topics. The place grows in tiers (small → known → famous) that
unlock bigger events and more outside places.

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

## Authority: what kind of boss you are

The same game must carry a careful manager, an Absolute Authority Headmaster and a Medieval King.
The kit sets an **authority level**, and it changes the rules, not only the words.

| | Manager | Strong leader | Absolute ruler |
|---|---|---|---|
| Example | warehouse site manager | university Dean | Headmaster with total power, Medieval King |
| Who can remove you | the board or the owner | the board, after a vote | nobody — only a **revolt**, a **coup**, ruin or an outside power |
| House rules | proposals, often need a vote | rules, people may push back | **decrees**: instant and sealed, but each one costs Love or Legitimacy |
| People values | Trust | Trust | **Fear** and **Love** (both 0-100, per person and for the place) |
| Extra verbs | delegate, ask others | promote, let go | **decree, punish, pardon, reward, banish/expel, appoint** |
| Loss | fired | voted out | overthrown, assassinated, school closed, abdication |

- **Fear and Love** replace Trust under absolute rule. High fear keeps order but makes people
  hide things; low love plus high fear makes secret plots (a secret society, a noble conspiracy).
  The code turns the two values into plot chances; the model writes the plots.
- **Enforcers:** absolute rulers act through people (prefects, a Head Girl, knights, a spymaster).
  Enforcers have their own ambitions and can misuse your power.
- **Legitimacy** (absolute kits only): a hidden fifth value. Cruel or unfair decrees lower it;
  ceremonies and justice raise it. At zero, the revolt starts.

### Example: Absolute Authority Headmaster

- Meters: School funds (Money), Exam results (Output), Discipline (People), Ministry favour (Standing).
- Decrees: uniform rules, curfew, phone ban, house points, dorm inspections.
- Rituals: morning assembly (your weekly speech), house cup, sports day, entrance exams.
- Desk cards: rule breakers to judge (detention, pardon, letter home, expel), staff requests,
  parents' letters.
- Threats: a secret student society, a teacher faction, a ministry inspector, a rival academy.
- Night: dorm patrols use rooms and routines; who is out after curfew, and why?

### Example: Medieval King

- Meters: Treasury (Money), Harvest (Output), Commons (People), Nobles (Standing).
- **Petition day:** a queue of petitioners in the throne room, one card each. This is the
  Reigns-style heart of the kit.
- Royal council: chancellor, marshal, bishop, spymaster. Each wants a different kingdom.
- Rituals: feasts, tournaments, coronation anniversary, the harvest festival.
- Outside world: rival kingdoms, the Church, the merchants' guild, bandits.
- Things: the crown, the royal seal, treaties, letters, hostages.
- **Succession:** an heir, marriage alliances and a regent. Legacy mode means your child takes
  the throne and inherits your enemies.

### Content rule

Any kit with minors (schools below university) never allows romance or adult content with
students, and the Adult module is locked for that kit. Cruelty under absolute rule stays at the
level the Tone dial allows; the game shows consequences, not glorified abuse.

## Adult module

Mature and explicit themes are a full part of Big Cheese, in one optional module (Modern Life
Sim's Adult module pattern).

### Switching it on

- Off by default. Switched on per run at the wish or in the kit, after the player confirms they
  are an adult. A run with it on shows an "18+" mark on its title card.
- **Everyone 18+:** the module only runs when every person in the kit is an adult. A kit with
  minors locks it (see Content rule). The generator and the normalizer set every adult-eligible
  person's age to 18 or older, and the code refuses romance or explicit content for anyone
  without an adult age. A university, an office, a court or a ship crew works; a high-school
  student body does not. An academy kit can say "all students are 18+" as a kit fact.

### Intensity and themes

- **Intensity:** Fade to black · Suggestive · Explicit. It sets how scenes are written. The
  story results (relationships, scandals, numbers) are the same at every level.
- **Themes**, each switched on or off by the player:
  romance and dating · workplace affairs · the boss's own love life · rivalries in love and
  jealousy · infidelity and cheating · cuckolding / NTR (your partner and someone else, with
  you as the one who finds out, watches or agrees) · open relationships and polyamory · power
  and dominance games between consenting adults · kinks the player lists in their own words.
- **Hard limits:** the player can list things that must never happen. The prompt always carries
  them, and the validator rejects scene text that names a hard limit.
- **Consent in the story:** sexual content is always between consenting adults. Coercion,
  sex as a reward or punishment for staff, and non-consent are not generated, under any
  authority level. Power can be part of a consensual dynamic, never a tool to force someone.

### How it plays

- **Romance values:** each person gets a Romance value and an Attraction value toward the boss
  and toward other people (Modern Life Sim's three-number bond shape: friendship, romance, trust).
- **Your love life:** date someone at the place or outside it. Dating a subordinate creates
  favouritism rumours, jealousy and a Standing risk. A partner can live at another place (long
  distance): you hear about their week through messages, visits and the grapevine.
- **Cheating and cuckolding:** the storyteller can build an affair over several weeks (hints,
  lies, a discovery, your choice) when the theme is on. With the cuckolding theme, the player
  can choose to be told, to watch the story unfold, or to agree to it. Traits decide who strays
  (faithful, jealous, curious), so it fits each person.
- **Wishes** can ask for adult storylines ("my girlfriend at Hollowmere starts seeing the
  rowing coach"), inside the switched-on themes.
- **Staff drama:** affairs between staff create cards, scandals, broken teams and resignations.
- **Private places:** rooms marked private (your flat, a dorm room, a hotel, the royal
  chambers) are where explicit scenes happen. Viewer mode shows a closed door there unless the
  player turns that on.

### Technical rules

- The adult prompt parts are only sent when the module is on for that run.
- If the model refuses or the provider blocks a scene, the game falls back to fade to black and
  goes on. The refusal is logged in the `/calls` log.
- Explicit images are generated only when the player switches them on and has an image
  connection that allows them. Otherwise the game shows the normal illustrated card.
- Adult runs: optional "hide 18+ runs" on the title screen, blurred title cards, and adult
  scenes are never in the yearbook, the chronicle or an exported kit unless the player chooses.

## Make it feel alive

The most important goal. A place feels alive when it moves without you, reacts to you and
remembers you. Rules for every slice:

1. **Something always moves.** Every screen has a sign of life: people change rooms each time
   slot, an ambient line ("Anja is humming at the racks"), a light on at night.
2. **Everything gets a reaction.** Every decision gets at least one visible reaction within a
   day: a face, a grapevine line, a mood change, a note on your desk.
3. **Callbacks.** People quote your earlier decisions. The code picks 1-2 memories for every
   scene and card, so memory is used in text, not only stored.
4. **Small life, not only crises.** About 70% of moments are small (birthdays, a cold, a new
   couple, a cat in the warehouse, the coffee machine breaks); 30% carry stakes.
5. **Surprise budget.** The storyteller must make at least one surprise per week that the player
   did not cause.
6. **People have days.** Mood of the day, sick days, holidays, seasonal outfits, bad weeks.
7. **The place changes visibly.** Wear, repairs, upgrades, the festival banner that stays up,
   a plaque for the winner, a tradition's decoration.
8. **Each person has a voice.** A short voice sheet (speech style, pet phrases) is made once and
   used in every line, so people sound the same every time.
9. **Alive test** (playtest checklist): after week 2, can the player name 3 people and what they
   want? Did something happen that they did not cause? Did someone remember a decision?

## Ways to play

- **Viewer mode:** watch the place live like a diorama. Time plays by itself (pause, 1×, 2×,
  4×). Your deputy or an AI boss makes the decisions, or nobody does. Follow one person or one
  room. A ticker shows what happens. **Paused for drama** stops on big moments and offers
  *Keep watching* or *Step in*. You can take over at any time and give it back. You can still
  use wishes.
- **Away digest:** when you come back, the code plays the missed slots in a fast batch and shows
  "This morning at Hollowmere". The place never moves while the Engine is closed.
- **Scenarios:** fixed challenges with a goal and a time limit ("Save St. Agnes hospital in 12
  weeks", "The crew wants a vote"), plus a weekly seed so friends can compare.
- **Sandbox:** you cannot be fired, and you can edit meters while you play.
- **Moving places:** a tour bus, a ship, a travelling circus. The world outside changes every week.
- **More built-in kits:** villain lair, haunted hotel for ghosts, dragon's hoard, Mars colony,
  kindergarten, football club, film set, witch school, cat café, monastery, rock band on tour,
  Absolute Headmaster, Medieval King.

## Deeper mechanics

- **Culture and traditions:** repeated decisions become culture tags (Family, Cutthroat,
  Chaotic, Strict). Repeated events become traditions; stopping one causes outrage. Culture
  changes card topics and how newcomers behave.
- **Factions:** groups inside the place (old guard vs reformers, nobles vs merchants). Each wants
  different things; their support decides big votes.
- **Phone calls and messengers:** an urgent call or a royal messenger. Answer now or miss it.
- **Negotiation:** offers and counter-offers with hidden limits (union, suppliers, donors, treaties).
- **Crisis sequences:** 3 fast decisions in a row ("fire in the lab", "the castle gate falls").
- **Cover-ups:** hide a scandal; it can come back weeks later and worse.
- **Mentoring:** train a person; their skill grows; in legacy mode your protégé can be the next boss.
- **Elections:** student council, union rep, guild master. Backing a candidate has a cost.
- **The boss above you:** an owner, a board chair or an emperor with a mood and targets.
  Absolute rulers have none.

## Memories you keep

- **Yearbook / company newsletter / royal chronicle page:** at the end of each term, one page with
  pictures, quotes and awards. Save it as an image or a PDF.
- **Chronicle:** a history of the place that writes itself, and portraits of past bosses.
- **Meter graphs:** history lines with markers at big decisions.

## Screens

Title (saved places) · Wish · Preview · Kit editor · Office (meters, hours, next meeting,
inbox) · Card · Meeting scene · Friday report · Staff list and Staff file · House rules ·
Grapevine and wishes · Floor map (Site / Town) · Room visit · Drawer and equipment · Calendar ·
Goals and perks · Settings.
Bottom bar: Office, Floor, Staff, Calendar. "More" holds Rules, Grapevine, Drawer, Goals and the
Kit. Phone first, 44 px targets, theme tokens only in the real build (the mockup colours are
placeholders).

## Technical shape

- New package `packages/big-cheese` in Marinara-Agents, slot `home-browser-tab`, permissions
  `routes`, `storage`, `ui` (+ `network` only if images need it). Engine changes: none planned.
- **Source in the repo** and built by a repo script. (Modern Life Sim ships only minified
  bundles; its source is not reviewable. Do not repeat that.)
- One run = one document in `api.persistence.documents` with `saveVersion`, a migration function
  and a "newer save" guard. Writes go through a per-run queue with `expectedRevision`.
- Time advances through one `advance` route that returns `events[]`, like Modern Life Sim. It is
  called by player actions, and in viewer mode by a client timer while the tab is open and
  visible. The away digest calls it in one batch on return. No server-side clock.
- Viewer mode and the "alive" layer use one batch model call per time slot that writes ambient
  lines for many people at once; the code moves people and picks who gets a line.
- **Lite mode:** fewer and smaller model calls for slow or costly models, and template cards and
  lines when a call fails, so the game never stops.
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
0. Skeleton: package, Home tab, title screen, empty run document, build script, catalog lane,
   model helper with Lite mode.
1. Wish → Place Kit: wish screen, generator (draft → normalize → save), preview, reroll,
   authority level.
2. The week: office, hours, request cards with stance table, Friday report, losing.
3. People: staff list and file, trust (or Fear and Love), stress, memory, voice sheets,
   callbacks, "Talk it through" scenes.

**M2 · Alive**
4. Storyteller (Calm/Classic/Chaos), small-moments deck, surprise budget, follow-ups, crises,
   crisis sequences.
5. Meetings: agenda, attendees, support in the room, votes, negotiation.
6. Rooms and routines: floor map, room condition, people moving each time slot, room visits,
   overhearing, ambient lines.
7. Relationships between people, ambitions, secrets, grapevine, cover-ups.
8. **Viewer mode**, away digest and "Previously at…" recap.
9. Hire, promote, let go, delegate, mentoring.

**M3 · Yours**
10. Kit editor, extra meters, feel dials, kit themes, save, export and import kits.
11. Built-in kits (incl. Absolute Headmaster, Medieval King) and Kit from text or lorebook.
12. House rules and decrees (sliders, toggles, own-words rules), enforcers, legitimacy.
13. Roles (Middle manager, Rising star, Owner), the boss above you, module switchboard.
13a. Adult module: age gate, 18+ check, intensity, themes, hard limits, romance values,
     your love life, affairs and cuckolding storylines, private rooms, fallbacks.
14. Scenarios with weekly seeds, and Sandbox.

**M4 · Lasting**
15. The world outside: town map, rival, suppliers, authorities, money, visitors, trips,
    moving places.
16. Things: equipment, stock, the drawer (keys, gifts, documents, minutes, evidence).
17. Term goals, perks, wishes during the game, endings with epilogues, achievements.
18. Culture and traditions, factions, elections.
19. Building module, hidden rooms, Calendar events and rituals, weather, phone calls and messengers.
20. Yearbook, chronicle, meter graphs.
21. Press, Office drama, Deep finance and Union modules.
22. Legacy runs and succession, Make a character card, images, GUIDE app.

## Not planned

Multiplayer, multiple places in one run, a clock that runs while the Engine is closed.

## Later: Marinara crossovers (parked)

Parked on purpose until the game itself feels alive: a Slurp2 feed for the grapevine and press,
"Call someone" as a real Marinara roleplay chat, your persona as the boss, the place as a
lorebook, Illustrator and Music DJ helpers, and a link to Modern Life Sim (your job there = your
Big Cheese place).

## Open questions

- Week length default: Full day (5 hours) or Short day (3 hours)?
- One shared stance table for all kits, or one table per place family plus kit overrides?
- Kit sharing: file export only, or also a kit catalog in Marinara-Agents?
- Do the boss's own Energy and Stress bars ship in M1 or wait for M4?
- Viewer mode: who decides when you only watch — the deputy, a neutral AI boss, or nobody?
- Absolute rule: is Legitimacy shown to the player, or only felt through events?

## Do not copy

No names, art or look from Artificial Academy, Two Point, Reigns or other games. Use the genre
and its mechanics only.
