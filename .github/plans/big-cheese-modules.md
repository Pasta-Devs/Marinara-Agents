# Big Cheese: modules and more features

Companion to [big-cheese.md](big-cheese.md), [big-cheese-design.md](big-cheese-design.md) and
[big-cheese-content.md](big-cheese-content.md). The core game is small: place, meters, people,
cards, meetings, storyteller. Everything else is a **module** the player switches on per run.

## 1. How modules work

### What a module is

A module is one folder in the package with a manifest and optional code. It plugs into the core
through fixed hooks. The core never knows a module by name.

```json
{
  "id": "crime",
  "name": "Crime and corruption",
  "summary": "Bribes, fraud, blackmail and the police.",
  "fits": ["workplace", "court", "industrial", "hospitality", "ship"],
  "requires": [],
  "conflicts": [],
  "dial": { "label": "How dirty", "default": 40 },
  "adds": {
    "meters": [{ "id": "heat", "label": "Police heat", "type": "standing", "start": 10 }],
    "stances": ["bribe", "cover_up", "report"],
    "decks": { "requests": "crime.requests", "surprises": "crime.surprises",
               "small": "crime.small", "crises": "crime.crises" },
    "roles": ["fixer", "detective"],
    "rooms": [{ "kind": "back_office" }],
    "outside": [{ "kind": "police" }],
    "meetings": ["interrogation"],
    "houseRules": ["crime.whistleblowers"],
    "perks": ["crime.friends_in_low_places"],
    "endings": ["crime.arrested", "crime.untouchable"],
    "achievements": ["crime.clean_hands"],
    "screens": ["crime.ledger"],
    "promptParts": { "cards.day": "crime/cards.md", "ambient.batch": "crime/ambient.md" }
  },
  "state": { "bribesPaid": 0, "evidence": [] }
}
```

### Hooks

| Hook | When | What a module can do |
|---|---|---|
| `onCreate` | place generation | add people, rooms, groups, outside places, seed state |
| `onSlot` | each time slot | move people, add small moments, change module meters |
| `onDraw` | storyteller draw | add weighted deck items, raise or lower tension |
| `onCardSeed` | before the model writes cards | add topics, askers, extra stances |
| `onApply` | after a stance is applied | extra deltas, memories, follow-ups |
| `onMeeting` | meeting setup and close | extra attendees, agenda items, vote effects |
| `onWish` | wish classify | new wish types |
| `onWeekEnd` | Friday | report lines, module meter decay, achievements |
| `onTermEnd` | term end | yearbook page parts, endings check |
| `onViewerTick` | viewer mode | drama triggers, AI boss choices for module cards |

Hooks are pure: they take state and return new state and events, like the core modules.

### Two kinds of modules

- **Built-in modules** ship with code and hooks.
- **Data modules** are JSON only: decks, card topics, rooms, roles, house rules, perks,
  achievements, endings and prompt parts. Players can make, share and import them like Place
  Kits ("Vampire hospital pack", "Space trucker slang"). The Kit editor gets a Modules tab.

### Switching modules

- On the Wish screen: a module list with a dial each. Built-in kits come with a default set.
- **Bundles:** one tap sets several modules ("Soap opera" = Office drama + Romance + Gossip
  column; "Grim kingdom" = War + Faith + Dynasty + Crime; "Cosy" = Pets + Festivals + Family).
- During a run: a module can be switched on at the start of a week (it seeds itself with a
  short intro event) and off at any time (its state stays saved; its cards stop).
- **Module dial** (0-100): how often its decks draw and how strong its effects are.

## 2. Module catalog

Each module lists what it adds. The existing ones from the main plan come first.

### Office drama
Romance, cliques, feuds, office parties. Adds: relation events, a **cliques** view (who eats
with whom), feud cards ("Him or me"), the office party as a yearly event, secret couples found
by evidence. Meeting: mediation.

### Union and strikes
A union with a rep, members and a mood. Adds: union meter (Solidarity), demands, negotiation
(offers and counter-offers with hidden limits), strike votes, picket lines in viewer mode,
scabs, a strike fund. Endings: "The union runs the place now".

### Deep finance
A real ledger. Adds: salaries per person, loans with interest, quarterly budget plan (sliders
per department), investors with targets, audits, a cash-flow graph. Cards can show real
amounts. Mini-game: the budget meeting.

### Building
Rooms you can build, upgrade, decorate and break. Adds: a grid floor plan, build orders that take
days, contractors, room themes, decor that people react to, hidden rooms found by exploring.

### Press and social media
A feed. Adds: posts by staff and outsiders, viral moments, a journalist character, interviews
as scenes, press releases you write (the model rates the tone), a scandal meter. Viewer mode
shows the feed beside the ticker.

### Horror
The place has a dark secret. Adds: a slow mystery over a term, things that move at night,
people who go missing, a sealed room, sanity on people (stress variant), a final night.

### Adult
See the Adult module in the main plan.

### Romance
Love stories as a full system, not only drama. Adds: crushes, dates, couples, break-ups,
weddings at the place, love triangles, jealousy from traits, a "couples" view, Valentine
events. The boss can have a love story too (with a person in the place or outside). Works with
Office drama and Adult.

### Hiring and talent
People come and go through the boss. Adds: job posts, a stack of CVs (generated people),
interviews as short scenes, trial weeks, headhunters, poaching from rivals and by rivals, a
talent pool that remembers who you turned down.

### Crime and corruption
Bribes, fraud, theft, blackmail. Adds: Police heat meter, stances `bribe`, `cover_up`, `report`,
an evidence board, a fixer, a detective who visits, fraud found in the ledger, a criminal
outside place (the docks, the fence). Endings: arrested, untouchable.

### Spies and rivals
The rival place becomes a full opponent. Adds: a rival boss with a face, voice and plans,
moles inside your place, sabotage, counter-spying, stolen ideas, a yearly showdown (a match,
a bid, a war, a ranking).

### Politics and elections
Inside votes and outside politics. Adds: elections (student council, union rep, guild master,
mayor), campaigns with posters and speeches, backing a candidate, a council in the town, laws
that change the place (a new tax, a new safety law).

### Competitions and sports
The place has a team or a contest. Adds: a season with fixtures, a squad from your people,
training choices, match days that play like viewer mode with a live ticker, a trophy room,
rival fans. Fits schools (regatta), warehouses (forklift cup), ships (races), kingdoms (tourney).

### Festivals and events
Plan big events. Adds: an event planner (budget, guest list, entertainment, food, seating plan
mini-game), the event as a live viewer-mode evening, things that go wrong, photos for the
chronicle, events that become traditions.

### Family and home
The boss has a life after work. Adds: a home with a partner, kids, a parent or flatmates,
evening hours split between work and home, family events that clash with work ("the board
meeting is on your daughter's birthday"), a home meter (Home life, People type, boss only).

### Health
Bodies matter. Adds: injuries, colds that spread by room, an outbreak crisis, a sick bay or
nurse, health checks, burnout as a story, drinking and recovery arcs.

### Trade and economy
The world outside has prices. Adds: a market with prices that move each week, suppliers and
customers with contracts, orders and deliveries, shortages, exports, a price graph. Fits
warehouses, ships, kingdoms, shops.

### War
For kingdoms, ships, colonies and gangs. Adds: an army or crew strength, campaigns on a simple
region map, sieges, battles as 3-step crisis sequences, war councils, peace talks, veterans
who come home changed.

### Faith
A church, a temple, a cult or a strong belief in the place. Adds: a priest character, holy days,
omens, a faith meter (Standing type), miracles and heresy cards, the faith's stance on your
decrees (affects Legitimacy).

### Dynasty
The run continues after the boss. Adds: an heir (child, protégé or deputy), marriages and
alliances, succession crises, a family tree, play the next boss with the place and its memory.
Pairs with Legacy mode.

### Magic and the strange
For fantasy and weird places. Adds: spells as stances, magical rooms (a library that moves),
artefacts in the drawer, curses, a familiar, a council of mages, wild magic days.

### Tech and research
For labs, stations and studios. Adds: a research tree with 3 branches, projects that take weeks,
breakthroughs, failures, an AI crew member with its own trust, machines that break.

### Pets and mascots
Animals in the place. Adds: a mascot (the warehouse cat, the ship's parrot, the royal hound),
animals with names and moods, small moments with them, an animal that picks favourites.

### Classes and exams
For schools. Adds: a timetable, classes with teachers, grades per student, exam weeks, a
cheating scandal, prize day, report cards you sign, the top student and the worst student.

### Shifts and logistics
For workplaces with shifts. Adds: a shift planner mini-game (drag people into shifts), overtime,
orders that must ship, late trucks, inventory, accidents when people are tired.

### Disasters
Big natural events. Adds: storms, floods, fire, heat, power cuts with warning days, prepare
cards (sandbags, a generator), a rebuild arc after, heroes and cowards among your people.

### Mystery
One case per term. Adds: a case (theft, a missing person, a poison pen letter), clues found in
rooms and by talking, a suspect board, an accusation scene, the wrong accusation has a price.

### Gossip column
A weekly paper inside the place (the school paper, the crew sheet, the court herald). Adds: an
editor character, a weekly issue made from grapevine lines, the boss can censor, feed or ignore
it, columns that stir feuds.

### Customers and guests
For hotels, restaurants, hospitals, shops. Adds: daily guests, reviews with stars, VIP visits,
a guest book, complaints as cards, a critic in disguise.

### Law and inspections
Rules from outside. Adds: inspectors with checklists, lawsuits, a lawyer character, court days
as meetings, fines, licences that can be taken away.

## 3. More features for the core game

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

## 4. Where modules fit in the slices

- **M2:** module system (manifest, hooks, Wish screen list, bundles) with Office drama and
  Romance as the first two.
- **M3:** Hiring, Festivals, Press, Classes and exams, Shifts, Customers, Pets.
- **M4:** Crime, Spies and rivals, Union, Deep finance, War, Faith, Dynasty, Disasters,
  Mystery, Gossip column, Family, Health, Trade, Magic, Tech, Law, Politics, Competitions,
  Building, Horror, Adult (13a stays as planned).
- **Later:** data modules in the Kit editor, Career mode, Many places, mutators, daily
  challenge, photo mode.
