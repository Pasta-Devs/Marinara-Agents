# Big Cheese: modules and more features

Companion to [README.md](README.md), [design.md](design.md), [content.md](content.md), [cast.md](cast.md) and [cheese-board.md](cheese-board.md).

A warehouse, a kingdom and a pirate ship do not share the same systems. So Big Cheese has two layers:

1. **Place systems.** Three building blocks, filled with place words.
2. **Story layers.** They change what happens between people, not how the place works.

Both layers feed the same thing: **threads** (see design.md). A block or layer never talks to the player directly. It makes threads, and the threads make cards, scenes and small moments.

## 1. Place systems

### The 3 blocks in the core

The code knows 3 blocks. Each block has its own logic and state. The AI picks blocks and names them for the place.

| Block         | What it does                                                | Example instances                                            |
| ------------- | ----------------------------------------------------------- | ------------------------------------------------------------ |
| **Project**   | A goal that takes weeks, with progress, risks and a reveal. | new wing, research, a cathedral, a ship refit, a new product |
| **Big event** | One planned event with prep, a budget and a live night.     | gala, coronation, prom, launch party, a feast                |
| **Season**    | A team from your people plays fixtures against rivals.      | regatta, forklift cup, tourney, ship races, football         |

### How each block makes threads

| Block     | Thread it makes                                    | Beats                                                                                                    |
| --------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Project   | One long thread per project.                       | Kick-off, supply card, a risk, a setback, a reveal. Progress is the thread's clock.                      |
| Season    | One thread per fixture.                            | Pick the squad, a training moment, a rival move, match night, result. The season table is the chronicle. |
| Big event | One thread with prep beats and a live night scene. | Budget, guest list, a crisis in prep, then one live scene on the night. Result goes to the chronicle.    |

Each thread has a need meter, a stakes line and a clock like every other thread. Winning or losing the thread moves the meters in content.md §1.

### How a place gets its systems

- `place.draft` picks 1-3 blocks that fit the wish. For each one it returns: block, name, a one-line premise, the meter type it feeds, roles that run it, rooms it uses, and 6-10 deck items with place words.
- The normalizer checks the block exists, the meter type is valid and every role has a person.
- On the Preview screen each system is a chip. Tap it to rename, reroll or remove it.
- The Kit editor has a **Systems** tab: add a block, name it, write its deck items.
- A wish can add a system during a run: "Start a jousting tourney" becomes a Season block.

### System shape

```json
{
  "id": "regatta",
  "block": "season",
  "name": "The Regatta",
  "premise": "Hollowmere rows against Carrow College every spring.",
  "feeds": "standing",
  "roles": { "coach": "cormac" },
  "rooms": ["boathouse"],
  "deck": ["The cox is ill on race week.", "Carrow buys a new boat."],
  "settings": { "fixtures": 6, "squad": 8 }
}
```

### Examples per built-in kit

Core things such as petition day, the Friday meeting or house rota are not blocks. They are threads, meetings and cards.

| Kit                   | Systems                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| Hafenkai Logistics    | Dock extension (Project) and Founders' day (Big event). Night shift trouble is a thread.       |
| Hollowmere University | The Regatta (Season) and the new science wing (Project). Timetable clashes are threads.        |
| St. Corvin's Academy  | House cup (Season) and Founders' ball (Big event). Prefects' council is a group and a meeting. |
| Kingdom of Valmora    | Coronation (Big event) and the great cathedral (Project). Petition day is a thread.            |
| Salt Magpie           | Refit (Project) and the Crew race (Season). A crew vote is a meeting.                          |
| Ward 7                | New wing (Project) and the Charity gala (Big event). Admissions are threads.                   |

### Depth options

Two core parts can go deeper in any place:

- **Detailed money:** a ledger with salaries, loans, a quarterly budget and audits instead of one Money meter.
- **Detailed building:** a grid floor plan, build orders, room upgrades and decor instead of a room condition only.

### Later blocks

These wait. Most are number sims where the model adds little. Faction groups and meetings already exist in the core.

| Block   | Why it waits                                                              |
| ------- | ------------------------------------------------------------------------- |
| Queue   | Items and timers. A number sim. Petitions and patients work as threads.   |
| Rota    | Time blocks and gaps. A number sim. The planner mini-game needs it.       |
| Market  | Prices and graphs. A number sim, no story from the model.                 |
| Stock   | Counts of things that spoil. A number sim.                                |
| Ranking | A score race. A number sim. Fixtures in a Season already show a table.    |
| Map     | Regions and routes. Needs map art and rules. Wait for Many places.        |
| Faction | Groups, moods and votes already exist as groups and meetings in the core. |

### Hooks

There is no hook framework in M2. The 3 blocks and the layers are plain code that call each other directly. When a third block needs the same extension point, extract the hook. This list is the target shape for later.

| Hook        | When it runs                                                 |
| ----------- | ------------------------------------------------------------ |
| `onCreate`  | Place generation: add people, rooms, groups, thread seeds.   |
| `onSlot`    | Each time slot: move people, add small moments.              |
| `onDraw`    | Storyteller draw: add weighted items, change tension.        |
| `onApply`   | After a stance is applied: add deltas, memories, follow-ups. |
| `onMeeting` | Meeting setup and close: attendees, agenda, vote effects.    |
| `onWeekEnd` | Friday: report lines, decay, achievements.                   |
| `onTermEnd` | Term end: yearbook parts, endings.                           |

Hooks are pure: they take state and return new state and events.

## 2. Story layers

Story layers are place-free. Each layer mainly adds three things:

- **Thread seeds:** starting threads and new kinds of threads.
- **Roles:** who plays what (a rival, a cheater, a suitor).
- **Prompt parts:** words for the storyteller, the asker and the scene writer.

It can also add deck items, memories and achievements. Each layer has a dial (0-100) for how often and how strongly it acts.

| Layer                | What it adds                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Drama**            | cliques, feuds, "him or me" threads, mediation meetings, the yearly party, triangles, the boss's own love story |
| **Romance**          | crushes, dates, couples, break-ups, weddings                                                                    |
| **Adult**            | see the Adult module in the main plan                                                                           |
| **Crime**            | bribes, fraud, blackmail, cover-up threads, an evidence board, a fixer, a detective                             |
| **Rivals**           | a rival boss with a face and plans, mole threads, sabotage, a yearly showdown                                   |
| **Press and gossip** | a feed or an in-house paper, viral moments, interviews, scandals                                                |
| **Politics**         | elections inside the place, campaigns, backing candidates, outside laws                                         |
| **Mystery**          | one case thread per term: clues in rooms, suspects, an accusation scene                                         |
| **Horror**           | a dark secret, things at night, missing people, a sealed room, a final night                                    |
| **Family and home**  | the boss's home life, evening hours split, family events that clash with work                                   |
| **Legacy**           | heirs or proteges, succession, play the next boss with the same place                                           |
| **The strange**      | magic, curses, artefacts, odd tech, an AI crew member. Tone follows the place                                   |

The place sets the words. Crime at St. Corvin's is a cheating ring and a stolen key. Crime in Valmora is a poisoner at court. Crime on the ship is a thief in the crew.

### Bundles

One tap sets several story layers: **Soap opera** (Drama, Romance, Press and gossip), **Dark** (Crime, Horror, Mystery), **Cosy** (Family and home, Romance at low dial), **Power** (Politics, Rivals, Legacy).

### Data-only packs

Players can share JSON packs with deck items, roles, house rules, perks, achievements, endings and prompt parts for a story layer or a system ("Vampire hospital pack").

### Switching during a run

A layer or system can be added at the start of a week (it opens with a short intro event) and removed at any time (its state stays saved, its threads pause). The player does this in the Kit editor or through the Cheese Board.

## 3. Player freedom

The module and feature set gives the player these freedoms:

| Freedom                                                                       | Where it lives                     |
| ----------------------------------------------------------------------------- | ---------------------------------- |
| Own answer on every card (typed, mapped to a stance by the model)             | design.md §4.4, README Pillar 6    |
| "Do something": a free action anywhere, mapped to a verb or a new thread seed | design.md §10                      |
| Edit systems and layers in the middle of a run                                | Section 1 and 2 above              |
| Change any rule, edit the kit, change state on purpose                        | [cheese-board.md](cheese-board.md) |
| "Show numbers" setting                                                        | design.md §8.1                     |

The code owns every number. Freedom never means the model sets numbers.

## 4. More features

### Threads cover these

These ideas are now kinds of threads (design.md §3). They need no own system.

| Feature          | As a thread                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Personal arcs    | A named person's own thread, 3-5 beats over a term (retire to the coast, win the cup, take the throne).     |
| Promises         | A promise made in a scene becomes a thread with a due date. Kept: trust up. Broken: remembered a long time. |
| Crisis sequences | A thread with a short clock and linked beats.                                                               |
| Mysteries        | A thread of clues and suspects that ends in an accusation scene.                                            |

### The boss as a character

- **Boss sheet:** name, look, title, 2 traits and a short backstory. People react to the traits (a "Former soldier" Provost gets respect from the head porter and jokes from the students).
- **Epithet:** the place gives the boss a name from their decisions: "The Iron Provost", "Good King Aldric", "Bucket Brandt". It changes when the style changes, and the grapevine uses it.
- **Energy:** a bad night's sleep costs one hour the next day. A weekend off gives one back. Late meetings, parties and crises cost sleep.
- **Skills** grow with use: Negotiation, Charm, Fear, Finance, Craft. Each level adds a better answer type on cards (Charm 3: "Talk them round" appears on angry cards).
- **Wardrobe:** outfits for days and events. People comment on them.
- **Diary:** one short line per day, written from the day's events. Readable as a book at the end and part of the yearbook.

### Advisors

- Pick an **inner circle** of up to 3 people. On every card each advisor gives one line of advice in their own voice. Advice leans to one of the 3 offered answers (design.md §4.2) or to the player's own typed answer ("Imogen: Let the trustees pay. Yusuf: Fix it properly.").
- Advisors gain influence when you follow them and sulk when you never do.
- A bad advisor can be a plant from a rival or a faction. Fire them, or feed them false plans.
- In absolute places the inner circle is the court: chancellor, marshal, spymaster.

### Delegation

- Give an area (a system, a room, a group of people) to a person. They decide its cards by their own traits while you do other things, and report on Friday.
- Delegation uses the deputy ambition rule (content.md §1): each delegate gives the delegate +15 ambition. At 100 the deputy challenges you.
- A good deputy saves hours. A bad one makes choices you must clean up.
- Take an area back at any time. The person remembers it.

### Favours and leverage

- **Favours:** a list of who owes you and whom you owe. Spend a favour to swing a vote, skip a queue or get a person to do something.
- **Leverage:** secrets you know about people. Use one to force a choice. It costs trust if they find out you used it.

### The office as a place

- **Decorate** the office. Items (a plant, a trophy, a portrait, a throne) change how visitors feel.
- The desk holds the inbox, the drawer, the phone and the calendar as real objects.
- **Office door:** open (more small talk, more cards) or closed (fewer interruptions, people feel shut out).
- **Office hours:** a queue of visitors at set times. Short talks, 15 minutes each, no card needed.
- **Letters from the last boss** in the drawer: a small quest line about why they left.

### Phone and messages

- Message threads from staff, family and outsiders. Short, in each person's voice.
- Some messages need an answer by a time. A late answer counts as `delay`.
- Group chats the boss is not in are found as evidence.
- In a kingdom it is a messenger with letters. On a ship it is the signal flags and the log.

### Eyes and ears

- **Informants:** pay or befriend a person to report on a room or a group each week.
- **Cameras, spies or a spymaster** by place type. They show overheard lines from rooms you did not visit.
- **Plant a rumour:** write one line and pick who starts it. It spreads by relations and can come back to you.

### Out of the office

- **After work:** invitations to drinks, dinners, a card game, a feast. Go to build trust. You lose hours that evening.
- **Walk and talk:** take one person along on a floor walk. You talk while you visit rooms.
- **Trips:** a team trip, a royal progress, shore leave, a field trip. A trip is a short run in a new place with your people.
- **Visitors:** VIPs, parents, a celebrity, a foreign envoy, the boss above you. A visit is a 1-day event with special cards and a scene.

### Reviews and rewards

- **Term reviews:** a short sit-down with each key person. Pick praise, a raise, a warning or a new role. People compare what they got.
- **Awards:** at term end, give "Employee of the term", a knighthood, a house prize. The winner is happy. The people who lost are not.

### Mini-games

Short interactive parts that replace a card when it fits:

- **Budget sliders** (Detailed money, quarterly).
- **Seating plan** for a dinner or a gala: who sits next to whom changes relations.
- **Interview** with 3 questions you pick, for a new hire, a squire or a new crew member.
- **Speech** at an assembly: pick 3 lines in order. The crowd reacts per line.
- **Inspection walk:** hide or show rooms before the inspector arrives.

The Rota planner, Negotiation and Judgement mini-games return with their later blocks.

### Relationship map

A web of people with lines for friends, rivals, couples and secrets you know. Tap a line to see its story. Unknown lines show as faint dashes until someone hints at them.

### Career mode

- Start small (shift lead, a village reeve, a deputy head) and get promoted to bigger places.
- Each promotion is a new place on a map with your reputation and some people from before.
- Top of the ladder: regional director, CEO, emperor, chancellor.

### Many places

- Open a second branch or conquer a second castle. Appoint a manager there.
- Other places run in auto mode (like viewer mode) and send weekly reports. Visit to take over.
- People can move between your places.

### Return visit

After a run ends, come back years later as a guest. The place has moved on: new people, old people older, your traditions kept or dropped, a portrait of you on the wall (or not).

### Mutators

Toggles that change one run for fun:

| Mutator            | Effect                                                        |
| ------------------ | ------------------------------------------------------------- |
| Ironman            | One save. No undo, no reroll, Cheese Board off.               |
| Everyone hates you | Start trust at 20.                                            |
| Double drama       | Small moments become stakes more often.                       |
| Inherited mess     | Start with 5 open threads.                                    |
| Speed run          | A term is 4 weeks.                                            |
| Silent boss        | You can only pick offered answers. No own answers, no typing. |

### Daily and weekly challenge

A seeded place and week that everyone gets. A score at the end (meters, goals, achievements). Results stay local. Sharing is a copied text or image.

### Photo mode and postcards

Freeze a scene (a room, a meeting, the floor map) with a caption. Postcards go into the chronicle and the yearbook. Save as an image.

### Montage and time skip

Skip a quiet week: the code plays it with the AI boss (your style from past choices) and shows a short montage of 5 moments.

### Sound and ambience

Optional room sounds by place family (forklift beeps, a school bell, a harbour, a throne room echo). A short sting on big moments. Off by default.

## 5. Where it fits in the slices

| Slice     | Content                                                                                                                                                                                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1**    | A minimal thread core: the guided thread "Letters from the last boss" and promise threads from own answers. A card's follow-up comes back as a beat on that card's own thread. The big-scene screen and `scene.part` ship for two scenes only: the arrival and the board hearing.      |
| **M2**    | The full storyteller: 5-8 open threads and all 11 thread kinds (design.md §3.2). The weekly big-scene budget and the other big-scene blueprints (design.md §3.8). The Drama and Romance layers. The Project block. Systems chips on Preview. No hook framework: blocks are plain code. |
| **M3**    | Big event and Season blocks. More layers: Press and gossip, Rivals, Family and home. The Adult module. The Systems tab in the Kit editor. Advisors. Office hours.                                                                                                                      |
| **M4**    | Crime, Politics, Mystery, Horror, Legacy, The strange. Depth options. Delegation, favours and leverage. Eyes and ears. Out of the office. Reviews and awards. Mini-games.                                                                                                              |
| **Later** | The later blocks (Queue, Rota, Market, Stock, Ranking, Map, Faction) and the hook extraction. Data-only packs. Career mode. Many places. Return visit. Mutators other than Ironman (M3, with the Cheese Board). Daily challenge. Photo mode.                                           |
