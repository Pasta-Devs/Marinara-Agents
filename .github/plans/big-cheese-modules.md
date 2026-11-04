# Big Cheese: modules and more features

Companion to [big-cheese.md](big-cheese.md), [big-cheese-design.md](big-cheese-design.md) and
[big-cheese-content.md](big-cheese-content.md).

A warehouse, a kingdom and a pirate ship do not share the same systems. A fixed list like
"Classes", "Shifts" or "War" only fits some places. So Big Cheese has two layers:

1. **Place systems** are made with each place. The AI builds them from a small set of generic
   building blocks and names them for the place: the warehouse gets "Night shift", Hollowmere
   gets "The Regatta", Valmora gets "Tithe day".
2. **Story layers** fit any place. They change what happens between people, not how the place
   works: Romance, Drama, Crime, Horror, Mystery and so on.

## 1. Place systems

### Building blocks

The code knows about 10 blocks. Each block has its own logic, state and one generic screen.
The AI only picks blocks, names them and fills them with place words.

| Block | What it does | Generic screen | Example instances |
|---|---|---|---|
| **Queue** | Things arrive and must be handled in time. Late items hurt a meter. | a list with timers | shipments, patients, guests, petitioners, orders, prisoners to judge |
| **Rota** | Put people into time blocks. Gaps and overwork have effects. | a week grid | shifts, classes, night watches, ward rota, guard duty |
| **Project** | A goal that takes weeks, with progress, risks and a reveal. | a progress card | new wing, research, a cathedral, a ship refit, a new product |
| **Season** | A team from your people plays fixtures against rivals. | fixtures and a live match | regatta, forklift cup, tourney, ship races, football |
| **Market** | Prices move each week; buy, sell, sign contracts. | a price list and graph | freight rates, grain, plunder sale, tuition fees, drug supplies |
| **Stock** | Things you hold run low, spoil or go missing. | a stock list | inventory, rum, medicine, the armoury, lab samples |
| **Ranking** | A score race against rivals, updated each week. | a league table | university rankings, hotel stars, kingdom prestige, infamy |
| **Map** | Regions or routes; move people or forces between them. | a simple region map | sales areas, provinces, sea routes, wards |
| **Faction** | A group with its own mood, demands and votes. | a group card | union, guild, nobles, parents' council, the crew vote |
| **Big event** | One planned event with prep, a budget and a live night. | a planner | gala, coronation, prom, launch party, a feast |

### How a place gets its systems

- `place.draft` picks 2-4 blocks that fit the wish and returns for each one: block, name, a one-line
  premise, the meter type it feeds, roles that run it, rooms it uses, and 6-10 deck items in
  place words.
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
  "premise": "Hollowmere rows against Kingsbridge every spring.",
  "feeds": "standing",
  "roles": { "coach": "lindqvist", "captain": "anja" },
  "rooms": ["boathouse"],
  "deck": ["The cox is ill on race week.", "Kingsbridge buys a new boat."],
  "settings": { "fixtures": 6, "squad": 8 }
}
```

### Examples per built-in kit

| Kit | Systems |
|---|---|
| Hafenkai warehouse | Inbound trucks (Queue) · Night shift (Rota) · Freight rates (Market) · Forklift cup (Season) |
| Hollowmere University | Timetable (Rota) · The Regatta (Season) · League tables (Ranking) · New science wing (Project) |
| St. Corvin's Academy | House rota (Rota) · House cup (Ranking) · Prefects' council (Faction) · Founders' ball (Big event) |
| Kingdom of Valmora | Petition day (Queue) · Granaries (Stock) · The provinces (Map) · Nobles' council (Faction) |
| Pirate ship | Prizes to sell (Market) · Rum and powder (Stock) · Sea routes (Map) · Crew vote (Faction) |
| Hospital ward | Admissions (Queue) · Ward rota (Rota) · Medicine cabinet (Stock) · Inspection stars (Ranking) |

### Depth options

Two core parts can go deeper on any place:

- **Detailed money:** a ledger with salaries, loans, a quarterly budget and audits instead of one
  Money meter.
- **Detailed building:** a grid floor plan, build orders, room upgrades and decor instead of room
  condition only.

## 2. Story layers

Story layers are place-free. Each one adds people events, decks, roles and prompt parts.
Each has a dial (0-100) for how often and how strongly it acts.

| Layer | What it adds |
|---|---|
| **Drama** | cliques, feuds, "him or me" cards, mediation meetings, the yearly party |
| **Romance** | crushes, dates, couples, break-ups, weddings, triangles, the boss's own love story |
| **Adult** | see the Adult module in the main plan |
| **Crime** | bribes, fraud, blackmail, cover-ups, an evidence board, a fixer, a detective |
| **Rivals** | a rival boss with a face and plans, moles, sabotage, a yearly showdown |
| **Press and gossip** | a feed or an in-house paper, viral moments, interviews, scandals |
| **Politics** | elections inside the place, campaigns, backing candidates, outside laws |
| **Mystery** | one case per term: clues in rooms, suspects, an accusation scene |
| **Horror** | a dark secret, things at night, missing people, a sealed room, a final night |
| **Family and home** | the boss's home life, evening hours split, family events that clash with work |
| **Legacy** | heirs or protégés, succession, play the next boss with the same place |
| **The strange** | magic, curses, artefacts, odd tech, an AI crew member; tone follows the place |

The place sets the words. Crime at St. Corvin's is a cheating ring and a stolen key. Crime in
Valmora is a poisoner at court. Crime on the ship is a thief in the crew.

### Bundles

One tap sets several story layers: **Soap opera** (Drama, Romance, Press and gossip), **Dark**
(Crime, Horror, Mystery), **Cosy** (Family and home, Romance at low dial), **Power** (Politics,
Rivals, Legacy).

## 3. How both layers plug in

Systems and story layers use the same hooks. The core never knows a system or layer by name.

| Hook | When | What it can do |
|---|---|---|
| `onCreate` | place generation | add people, rooms, groups, seed state |
| `onSlot` | each time slot | move people, add small moments, change own state |
| `onDraw` | storyteller draw | add weighted deck items, raise or lower tension |
| `onCardSeed` | before cards are written | add topics, askers, extra stances |
| `onApply` | after a stance is applied | extra deltas, memories, follow-ups |
| `onMeeting` | meeting setup and close | extra attendees, agenda items, vote effects |
| `onWish` | wish classify | new wish types |
| `onWeekEnd` | Friday | report lines, decay, achievements |
| `onTermEnd` | term end | yearbook parts, endings |
| `onViewerTick` | viewer mode | drama triggers, AI boss choices |

Hooks are pure: they take state and return new state and events.

**Data-only packs.** Players can share JSON packs with deck items, roles, house rules, perks,
achievements, endings and prompt parts for a story layer or a system ("Vampire hospital pack").

**Switching during a run.** A layer or system can be added at the start of a week (it opens with
a short intro event) and removed at any time (its state stays saved; its cards stop).

## 4. More features for the core game

### The boss as a character
- A boss sheet: name, look, title, 2 traits, a short backstory. People react to the traits.
- Boss energy: a bad night's sleep costs one hour the next day; a weekend off gives one back.
- Boss skills grow with use: Negotiation, Charm, Fear, Finance, Craft. Each level unlocks a
  better answer type on cards.
- A wardrobe with outfits for days and events. People comment on them.
- A boss diary: one short line per day, written by the model from the day's events. Readable
  as a book at the end.

### The office as a place
- Decorate the office. Items (a plant, a trophy, a portrait, a throne) change how visitors feel.
- The desk holds the inbox, the drawer, the phone and the calendar as real objects.
- An office door state: open (more small talk, more cards) or closed (fewer interruptions,
  people feel shut out).

### Phone and messages
- A phone with message threads from staff, family and outsiders. Short, in each person's voice.
- Some messages need an answer by a time. Late answers count as `delay`.
- Group chats the boss is not in, found as evidence.
- In a kingdom it is a messenger with letters; on a ship it is the signal flags and the log.

### Mini-games
Short interactive parts that replace a card when it fits:
- **Budget sliders** (Deep finance, quarterly).
- **Shift planner** (Shifts and logistics).
- **Seating plan** for a dinner or a gala: who sits next to whom changes relations.
- **Interview** with 3 questions you pick (Hiring).
- **Negotiation** with offers and a hidden limit (Union, Trade, War peace talks).
- **Speech** at an assembly: pick 3 lines in order; the crowd reacts per line.
- **Inspection walk**: hide or show rooms before the inspector arrives.

### Relationship map
A web of people with lines for friends, rivals, couples and secrets you know. Tap a line to see
its story. Unknown lines show as faint dashes once someone hints at them.

### Career mode
- Start small (shift lead, a village reeve, a deputy head) and get promoted to bigger places.
- Each promotion is a new place on a map with your reputation and some people from before.
- Top of the ladder: regional director, CEO, emperor, chancellor.

### Many places
- Open a second branch or conquer a second castle. Appoint a manager there.
- Places run in viewer-style auto mode and send weekly reports. Visit to take over.
- People can move between your places.

### Mutators
Toggles that change the rules of one run for fun:
- **Ironman:** one save, no reroll.
- **Everyone hates you:** start trust 20.
- **Short days:** 3 hours per day.
- **Double drama:** small moments become stakes more often.
- **Inherited mess:** start with 5 open follow-ups.
- **Speed run:** a term is 4 weeks.
- **Silent boss:** you can only pick answers, never type.

### Daily and weekly challenge
A seeded place and week that everyone gets. A score at the end (meters, goals, achievements).
Results stay local; sharing is a copied text or image.

### Photo mode and postcards
Freeze a scene (a room, a meeting, the floor map) with a caption. Postcards go into the
chronicle and the yearbook. Save as an image.

### Montage and time skip
Skip a quiet week: the code plays it with the AI boss (your style from past choices) and shows a
short montage of 5 moments.

### Sound and ambience
Optional room sounds by place family (forklift beeps, a school bell, a harbour, a throne room
echo). A short sting on big moments. Off by default.

## 5. Where it fits in the slices

- **M2:** the hook system, the Queue and Rota blocks, Systems chips on Preview, and the Drama
  and Romance layers.
- **M3:** Project, Stock, Faction and Big event blocks; Press and gossip, Rivals, Family and home
  layers; the Systems tab in the Kit editor.
- **M4:** Season, Market, Ranking and Map blocks; Crime, Politics, Mystery, Horror, Legacy, The
  strange and Adult (13a stays as planned); depth options.
- **Later:** data-only packs, Career mode, Many places, mutators, daily challenge, photo mode.
