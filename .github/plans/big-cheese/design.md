# Big Cheese: design deep-dive

Companion to [README.md](README.md) (the concept), [content.md](content.md) (kits, decks and
catalogs), [modules.md](modules.md) (place systems and story layers), [cast.md](cast.md) (Engine
characters and personas) and [cheese-board.md](cheese-board.md) (the cheat menu). This file says
how the systems work: the day, threads, cards, the storyteller, meetings and hearings, people,
free actions, viewer mode, model tasks, routes and data shapes.

Two rules hold everywhere:

- **The code owns every number.** The model writes words. It can map words to a stance or a verb
  the code knows, but words never set a meter, a trust value or an outcome.
- **Say it and the place answers** (Pillar 6). The player can type an answer to any card and an
  action anywhere. The code decides what it costs and what it does.

## 1. A sample week at Hollowmere

Hollowmere University (kit in content.md §2.2), Classic storyteller, Strong leader. The player is
the new Provost. Start meters: Endowment 50, Grades 55, Campus mood 60, Reputation 50. The numbers
follow the stance table in content.md §1 (need +k / half / quarter, each stance with its own cost
meter).

**Sunday evening (arrival).** A short scene. Dr. Imogen Hale, the Deputy Provost, shows the
Provost the office. She says the last Provost "left in a hurry". The drawer holds a brass key with
no label and a bundle of letters. This opens the guided thread **"Letters from the last boss"**
(§3.6). Its first beat is the first letter: "Yusuf knows every door. Ask him first."

**Monday.**

- Morning slot: the inbox shows 3 cards. Yusuf Karim, the head porter, reports that the roof of
  The Stacks leaks (need Reputation, severity 2). Cormac Dunne wants a new boat for the rowing
  club (need Campus mood, severity 2). A first-year asks for an exam extension (need Grades,
  severity 1).
- The roof card opens the thread **"The Stacks roof"** (kind `follow_up`, people Yusuf and Hester,
  need Reputation). The Provost answers with `cheap_fix` ("Buckets and a tarp for now"):
  Reputation +3, Grades −2 (the porters spend their time on buckets). Yusuf's trust −2. The
  code rolls the follow-up (45% at severity 2): it hits, so the thread gets a hidden next beat in
  week 2. The Office screen shows "The Stacks roof · Yusuf · patched". A hidden beat shows no due
  date, so the player cannot tell the patch will fail.
- The Provost does not like the 3 answers on the boat card and taps **Say something else**. They
  type: "Not this term. If the eight beat Carrow at the Boat Race, the boat is yours." The
  `answer.tag` task returns stance `delay` (no change now) and one promise. The code opens a
  promise thread **"A boat for the eight"** (Cormac, due the Boat Race week). That is 2 of 5
  hours.
- Midday: the Provost walks to the cafeteria (1 hour). Overheard: two lecturers complain about the
  parking. A small moment: the cafeteria cat has kittens.
- Afternoon: "Talk it through" with the first-year (1 hour). The scene adds a fourth answer:
  "Extension, but you join study hall." The code gave it the stance `invest` before the model
  wrote it. The Provost takes it: Grades +3, Endowment −3.
- Evening: the second letter is in the drawer ("The union eats you alive if you skip their
  talks"). Grapevine: "The new Provost actually listens." Cormac tells The Bilge about the
  promise. In the background the server writes Tuesday's cards (prefetch, §4.6).

**Tuesday.** A surprise the player did not cause: Carrow College offers Prof. Anselm Baptiste a
job (need Campus mood, severity 3). The offered answers are "Match the offer" (`invest`), "Let
Imogen talk to him" (`delegate`) and "Wish him well" (`refuse`). The Provost refuses: Campus mood
−5, Endowment +3. Baptiste's friends remember it.

**Wednesday.** Union talks with Mina Okafor (a meeting from the calendar, and the beat the second
letter pointed at). Three agenda items: the food hub, the leaky Stacks, a complaint about grade
inflation. Support is counted per item. The Provost wins two items and loses the third. The
agreement gives Campus mood +2. Lady Cordelia Ashgrove's nephew is in the room and takes notes.
That evening the third letter opens the Staff file: "Your deputy smiles a lot. Count the smiles."

**Thursday.** Barnaby Quill says the Gazette will print a grade-inflation story (need Reputation,
severity 2). The Provost lets admissions handle it (`delegate`): Reputation +3 −1. Imogen's
ambition +15. The fourth letter opens the Grapevine screen: "Read what they say about you. Then
read it again."

**Friday.** Settle (content.md §1.5). Before settle: Endowment 50, Grades 56, Campus mood 57,
Reputation 55. Income +3 (2 + (56 − 50) / 5, rounded), drift 10% toward 50, wear −2. Report:
meters **51 / 53 / 54 / 53**. The report has no trust numbers. It has feeling lines (§8):

- Yusuf: "Thinks you are cheap, but he liked that you came up to see the roof."
- Prof. Baptiste: "Packs his books slowly. He thought you would fight for him."
- Cormac: "Holds you to the Boat Race. He told everyone."
- Imogen: "Pleased you trust her with the press. She is already using it."

Next week: board of trustees on Tuesday. A tradition seed appears: "Friday cake in the staff room"
(2 more Fridays make it a tradition). The last letter of week 1 says "Don't trust the clock". It
closes the guided thread and opens a mystery thread, **"The clock tower key"** (Yusuf knows the key
is missing).

**Next Tuesday.** The hidden beat of "The Stacks roof" lands: the patch fails, same topic, severity 3. Yusuf says: "I told you a bucket won't do it." The Provost pays for the full roof (`invest` sev
3): Reputation +10, Endowment −10, Yusuf's trust +12. The thread closes as **won** and goes to the
chronicle: "Week 2: the Provost re-roofed The Stacks after one wet week."

## 2. Time

- **Day:** 5 slots: Morning, Midday, Afternoon, Evening, Night. The boss has 5 hours. **1 hour = 1
  slot.** Every action costs whole hours: a card, a talk, a room visit or a free action costs 1
  hour, a trip costs 2. A kit or a perk can change the hours. A short day (Pace dial) has 3 hours:
  Morning, Afternoon, Evening.
- **Week:** 5 working days plus a weekend that is one summary step (weekend events, sports, a
  party, a weekend shift). Kits can set a 7-day week (ship, hospital, kingdom). A Classic week
  takes about 15-20 minutes of play.
- **Term and year:** a term is 8 weeks. A year is 3 terms, 24 weeks. A kit can name the terms
  (Michaelmas, Season, Quarter, Year of the reign).
- **Season and weather:** each week has a season and a weather roll. Weather changes routines
  (rain empties the quad) and some decks (snow day, heat wave).
- **Calendar:** fixed meetings, holidays, birthdays (each person has one), traditions, thread due
  dates, hearings, outside dates (the inspection in week 7).

## 3. Threads

A thread is one story in the place: a leaking roof, a promise to Cormac, a deputy's plan, a
missing key. Every card, scene and small moment with stakes is a **beat** of a thread. A follow-up
is the next beat. There is no other system for follow-ups, arcs, crises, promises or wishes.

### 3.1 Shape

```json
{
  "id": "t4",
  "kind": "follow_up",
  "title": "The Stacks roof",
  "people": ["yusuf", "hester"],
  "need": "standing",
  "severity": 2,
  "stakes": "Rain on the rare books. Hester will not forgive a second time.",
  "clock": { "dueWeek": 2, "pressure": "patched" },
  "origin": { "from": "deck", "item": "roof_leak" },
  "beats": [
    { "id": "b1", "type": "card", "card": "c31", "week": 1, "day": 1, "result": "cheap_fix" },
    {
      "id": "b2",
      "type": "card",
      "planned": { "week": 2, "day": 2 },
      "hidden": true,
      "seed": { "topic": "roof_leak", "severity": 3, "asker": "yusuf" }
    }
  ],
  "state": "open",
  "secret": false
}
```

- **kind** decides the beat plan (§3.2).
- **need** is the one meter the thread threatens. Every card beat uses it as its need.
- **clock** is a due week or `"open"` (no due date). `pressure` is the word on the story card:
  quiet, building, patched, getting worse, due now.
- **origin** says what started it: `deck`, `arc`, `block` (a place system, modules.md), `own_answer`,
  `action`, `wish`, `board` (a Cheese Board Spin), `guided`.
- **state:** `open`, `won`, `lost`, `dropped`.
- **secret:** the boss does not know the thread yet. It still runs. It shows on the Office screen
  once a beat reaches the boss (a clue, a rumour, a card).

Big text (beat lines, scene logs) lives in a child document. The run document keeps only this
compact shape.

### 3.2 Kinds

| Kind           | Opens from                                                       | Beats                                                           | Clock                               | Won when                                                    | Lost when                                          |
| -------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| `follow_up`    | a request card whose answer rolls a follow-up (content.md §1.3)  | the request, then the follow-up card                            | due 1-3 weeks after the roll        | the last card gets `invest` or the follow-up is a thank-you | a card is ignored 5 days                           |
| `personal_arc` | a person's ambition (content.md §6), one per key person per term | 3-5 beats: small moments, a scene, 1-2 cards                    | open, ends at the end of term       | the person reaches the ambition with the boss's help        | the boss blocks it, or the person leaves           |
| `crisis`       | the crisis deck                                                  | 3 card beats on 3 days in a row, severity 3                     | due in 3 days                       | 2 of 3 beats get a strong or middle stance                  | 2 of 3 beats get a weak stance or are ignored      |
| `promise`      | a promise in an own answer, a scene or a meeting                 | one check beat on the due date                                  | the due date in the promise         | the code finds the promised thing done                      | due date passes: trust −8 for the person (§8.2)    |
| `cover_up`     | a secret found, or the boss hides a problem                      | 2-4 beats: who knows, a question, a leak                        | open, or a due week if someone digs | the secret stays hidden to the end of term                  | a beat reveals it: Standing need takes the full −k |
| `mystery`      | a clue in a room, a letter, a module (Mystery layer)             | 3-5 clue beats, then an accusation scene                        | open                                | the accusation names the right person                       | the boss accuses the wrong person                  |
| `project`      | the Project block, a "start a project" action                    | kick-off, supply card, a risk, a setback, a reveal (modules.md) | progress is the clock               | the reveal beat lands                                       | the boss drops it, or two beats fail               |
| `wish`         | a wish (§3.7)                                                    | 1-4 beats from `thread.beat`                                    | the week the player chose           | always "won" when the last beat lands                       | dropped if the boss blocks it                      |
| `guided`       | week 1 of every built-in kit                                     | 5 letter beats (§3.6)                                           | due end of week 1                   | the last letter is read                                     | never lost                                         |
| `hearing`      | a meter below 10 on the second Friday (§7.4)                     | prep days, then the hearing meeting                             | due the hearing day                 | the vote backs the boss                                     | the vote goes against the boss                     |
| `revolt`       | Legitimacy 0 (absolute rulers, §9)                               | 3 crisis beats over 3 weeks                                     | due in 3 weeks                      | Legitimacy 25 or more on a Friday                           | due week passes with Legitimacy below 25           |

Thread close effects:

- **Won:** no extra meter change (the beats already moved the meters). The people in the thread
  get a memory of weight 2. A block may add its own payoff (modules.md).
- **Lost:** the need takes the full −k once, like an ignored card (content.md §1.4 rule 7). The
  people get a memory of weight 2.
- **Dropped:** no change. Used when a person leaves or the Cheese Board closes the thread.
- Every closed thread writes one chronicle line.

### 3.3 How the storyteller runs threads

The storyteller keeps a target number of open threads: **Calm 5, Classic 6, Chaos 8**. Only
threads with a future beat count. A one-card request whose answer rolls no follow-up opens and
closes on the same day.

Each morning, in this order:

1. **Due beats.** Every planned beat for today lands: a card goes to the inbox, a scene becomes an
   invitation ("Yusuf wants a word"), a small moment goes to the ticker.
2. **Clocks.** Each thread's pressure moves one step when a due week is 1 week away. A thread
   past its due week resolves as lost (or the promise breaks).
3. **Fill the card budget** (§5.2). The storyteller picks card seeds from open threads first (the
   highest pressure, then a thread with no beat for the longest time), then from the request deck.
   A deck request opens a new thread.
4. **Open threads.** If fewer threads are open than the target, open one from the decks (§5.3) or
   from a person's ambition. A surprise, a crisis or an arc each opens a thread.
5. **Cap.** Player-made threads (own answers, actions, wishes, Board Spins) never get blocked.
   When they push the count above the target, the storyteller opens no new deck threads until the
   count falls.

### 3.4 Beats

| Beat type      | What the player gets                                         | Costs               | Written by                          |
| -------------- | ------------------------------------------------------------ | ------------------- | ----------------------------------- |
| `card`         | a request card in the inbox                                  | 1 hour to answer    | `cards.day`                         |
| `scene`        | an invitation in the inbox or a person met in a room         | 1 hour              | `scene.turn`                        |
| `meeting_item` | an agenda item at the next meeting                           | part of the meeting | `meeting.turn`                      |
| `moment`       | a small moment in the ticker or grapevine, no choice         | free                | `ambient.batch` / `grapevine.batch` |
| `check`        | the code checks a condition (promise kept, progress done)    | free                | code only                           |
| `big_scene`    | a long VN scene in 3-6 parts, shown ahead on the week (§3.8) | 2 hours             | `scene.part`                        |

The code plans the beat type, the day, the people and the need. The model writes the words. When a
thread opens from text (a wish, an action seed, an arc, a Spin), one `thread.beat` call writes the
title, the stakes line and one line per planned beat. Deck threads need no call; the deck item
already has a title.

### 3.5 The Office screen

The Office screen shows open threads as story cards, the most urgent first:

```
The Stacks roof · Yusuf · patched
A boat for the eight · Cormac · promise · due Boat Race week
Letters from the last boss · Imogen · 3 of 5 read
Baptiste and Carrow · Anselm · quiet
```

Tap a story card to see its beats so far, the people and the stakes line. The inbox shows only
today's beats. Secret threads appear once the boss learns of them. Closed threads move to the
chronicle.

### 3.6 The guided first week

Every built-in kit (M1 starts with Hafenkai) has the guided thread "Letters from the last boss".
The last boss left 5 letters in the drawer. Each one points at a person and a screen:

| Day       | Letter                                              | Person                          | Screen it opens               |
| --------- | --------------------------------------------------- | ------------------------------- | ----------------------------- |
| Sunday    | "X knows every door. Ask them first."               | the head porter / forklift lead | Inbox                         |
| Monday    | "The union eats you alive if you skip their talks." | the union rep                   | Calendar and Meetings         |
| Wednesday | "Your deputy smiles a lot. Count the smiles."       | the deputy                      | Staff file                    |
| Thursday  | "Read what they say about you. Then read it again." | —                               | Grapevine                     |
| Friday    | a hint at the kit's first mystery                   | —                               | Friday report, Office threads |

The letters are kit data with placeholders, so a generated kit can have them too. The built-in
kits write their own letters on these days (content.md §2.1 and §2.2).

### 3.7 Wishes

A wish is a free line ("A storm hits the harbour", "Imogen falls for the new rowing coach").
`wish.classify` maps it to a thread kind and people. The code makes a `wish` thread with 1-4
beats, costs 1-3 wish points (3 per term by default, unlimited in sandbox) and plays it out
through cards, scenes and small moments, never as an instant change. Board Spins use the same
path without points (cheese-board.md).

### 3.8 Big scenes

Most beats are short: a card, or a 1-hour talk with one person. A **big scene** is a longer VN
scene in 3-6 parts for the moments a thread builds toward. It is a beat type, `big_scene`, so it
is planned, lands and closes like other beats. The screen is in [ui.md §5.7](ui.md).

**When one happens**

| Trigger        | Examples                                                                                                                                                          | Counts against the budget                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Thread climax  | board hearing (§7.4), mystery accusation, last week of a revolt, a promise due on an event (the Boat Race), Big event night, Season match night, deputy challenge | hearing and revolt: no. The others: yes. |
| Calendar event | arrival, term-end party, inspection day, the peak day of a storm crisis                                                                                           | arrival: no. The others: yes.            |
| Story layer    | a Romance or Adult layer date (modules.md §2)                                                                                                                     | yes                                      |
| Player         | a Spin or a wish that asks for one, an accusation the player calls with `investigate`                                                                             | no                                       |

**Budget.** The storyteller plans at most **Calm 1, Classic 2, Chaos 2** big scenes per week, and
never two on one day. Hearings, the revolt finale, the arrival and player-made scenes do not count
and are never blocked. When a climax finds the week full, it moves to the next week if its clock
allows. If not, it plays as a normal 1-hour scene with one choice point. (First values.)

**Shown in advance.** The storyteller plans a big scene at least 2 days ahead. From that moment it
shows on the Week view and the Office week strip with its day, slots and title. A climax of a
secret thread shows as "Something at the Boathouse, Friday evening" until the boss knows the
thread.

**Shape.** The code builds the parts from a **blueprint** for the trigger (code data; a kit can add
its own). Each part has:

- a room, 2-5 people on stage and a goal line from the blueprint ("Cormac asks for the boat in
  front of the crew");
- 3-6 exchanges, written by the model;
- an **end**, one of:
  - `stance`: the code picks strong, middle and weak stances (§4.2). The player picks one or
    types a line, which goes through `answer.tag`.
  - `pick`: the code offers 2-4 options (suspects, who rows stroke, which room to save).
  - `item`: a meeting item with support per person (§7.2).
  - `check`: the code tests a condition (the vote, the race result from the prep beats, the
    right suspect). No choice.

| Blueprint     | Parts                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `hearing`     | the charge (`item`), the defence (`item`), the last word (`item`), the vote (`check`). Same as §7.4.  |
| `match_night` | on the quay (`stance`), the line-up (`pick`), the race (`check`), afterwards (`stance`)               |
| `accusation`  | everyone in one room (`stance`), the evidence (`pick`), the accusation (`pick`), the answer (`check`) |
| `party`       | arrivals (`stance`), the speech (`stance`), a quiet corner (`stance`), the last drink (`stance`)      |
| `date`        | meeting up (`stance`), the long talk (`stance`), end of the evening (`pick`)                          |
| `storm`       | the warning (`stance`), the peak (`pick`: which room to save), the morning after (`check`, `stance`)  |
| `arrival`     | the office tour (`stance`), the drawer (`check`: opens the guided thread)                             |
| `free`        | for Spins and wishes: the setup (`stance`), the turn (`stance` or `pick`), the close (`check`)        |

**The code owns every number.** The code applies each part's result when the part ends. The
model only writes lines.

- `stance`: the stance table (content.md §1.1) at **half k** for the thread's severity (k/2,
  rounded up) on the thread's need, plus trust for each person on stage by stance fit, as for a
  card answer.
- `pick`: the blueprint's effect for that option. The right suspect wins the mystery, a wrong one
  loses it.
- `item`: support changes as in §7.2.
- `check`: the thread result and its close effects (§3.2).

Half k is a first value. The sim does not play big scenes yet.

**Cost and the day.** A big scene costs **2 hours**: two slots in a row (Morning and Midday,
Afternoon and Evening, or Evening and Night for an evening event). The code books the slots when
it plans the scene, so the booked hours cannot go to other actions. That day the card budget
drops by 1 (at least 1 card). No new beat lands while the scene runs. Inbox cards wait and age at
the end of the day as usual.

**Invitations.** A date or a party can be declined from the Week view or the Office: "Send
apologies" applies the weak stance of part 1 once and closes the beat. A hearing, a revolt
finale, a storm and the arrival cannot be declined.

**Save and resume.** The run document keeps a compact `bigScene` record. Each part's result is
written through the run queue when the part ends. Lines go to the scene-log child document. "Leave
for now" or a closed tab keeps the scene at its current part, and the Office shows "Resume: The
Boat Race, part 3 of 4". The clock cannot pass the booked slots until the scene ends. People,
Place and the Board stay open, but actions that cost hours wait. A Board play during a scene
applies at once, and the next part gets its reason seeds (cheese-board.md §6). A rewind to a
snapshot from before the scene puts it back to "planned".

**Skip to the result.** It is offered at every choice point and on the invitation. The code
applies a default for each remaining part: `stance` takes the middle tier, `pick` takes the
blueprint default (for an accusation: no accusation, and the mystery stays open), `item` keeps
the support as it stands, `check` runs as usual. The summary is template text with one line per
part ("At the quay you offered Cormac a cheap fix."), with no model call.

**Viewer mode** pauses on a big scene (§11). _Keep watching_ skips to the result with the AI
boss's picks. _Step in_ plays it.

**Lite mode.** Template lines from the blueprint and the voice phrases, 2-3 per part, and the
stance template texts for the answers. The numbers are the same.

**Prefetch.** At the Evening slot before the scene day, next to `cards.day`, the server writes
part 1. Each later part is written when the part before it ends. A scene that starts at once (a
Spin "now") writes part 1 on start.

**Model task `scene.part`** (one call per part):

```json
{
  "lines": [
    { "who": "cormac", "text": "They've painted the old boat. Painted it, Provost.", "mood": "angry" },
    { "who": "rhea", "text": "Paint floats. Get in.", "mood": "dry" }
  ],
  "suggestions": [
    { "stance": "invest", "text": "Order the new boat tonight, win or lose." },
    { "stance": "cheap_fix", "text": "Borrow Carrow's spare for the race." },
    { "stance": "delay", "text": "Row the old one. We talk after." }
  ],
  "summary": "Cormac wants the new boat before the start."
}
```

The validator checks that every `who` is on stage, the suggestions echo the given stances in
order and pass the text check (§4.3), there are 3-12 lines, `summary` is at most 120 characters,
and no line names a hard limit. One fix-up retry, then template text. A `pick` part gets the
option ids instead of stances and returns one text per option. A `check` part returns lines and a
summary only, written after the code has the result.

**Receipt.** When the last part ends, the screen shows what changed (meter types, and numbers when
"Show numbers" is on), the thread's new state, the next beat if one is planned, and who will
remember. Everyone on stage at a choice point gets a memory of weight 2.

**Data.**

```json
{
  "id": "bs4",
  "thread": "t7",
  "blueprint": "match_night",
  "when": { "week": 3, "day": 5, "slots": ["evening", "night"] },
  "parts": [
    {
      "id": "p1",
      "room": "quay",
      "people": ["cormac", "rhea"],
      "goal": "Cormac asks for the boat in front of the crew.",
      "end": { "type": "stance", "offer": ["invest", "cheap_fix", "delay"] },
      "result": "cheap_fix"
    },
    {
      "id": "p2",
      "room": "quay",
      "people": ["cormac", "rhea", "mina"],
      "end": { "type": "pick", "options": ["rhea", "tobias"] },
      "result": null
    }
  ],
  "at": 1,
  "state": "running"
}
```

`state` is `planned`, `running`, `done`, `skipped` or `declined`. A Spin can ask for a big scene
with the beat verb `scene.big` and a one-line premise. The code then uses the `free` blueprint.

## 4. Card lifecycle

### 4.1 Steps

1. **Seed (code):** from a thread beat or the request deck. Asker, topic, need, severity, thread
   id, 1-2 memory hooks.
2. **Offer (code):** the code picks 3 stances: one **strong**, one **middle**, one **weak**
   (§4.2).
3. **Write (model):** `cards.day` writes the asker's text and one answer text per given stance.
4. **Check (code):** the answer text must fit its stance (§4.3). One fix-up retry, then template
   text for that answer.
5. **Answer (player):** pick an answer (1 hour), "Talk it through" (1 hour, a scene that can add a
   fourth answer), or "Say something else" (§4.4).
6. **Apply (code):** deltas from the stance table (content.md §1: need, cost, k) × place family
   scale × difficulty, then perks. Trust change for the asker and for people who care about the
   topic. Deputy ambition +15 on `delegate`.
7. **React (code + ambient):** within one slot, at least one visible reaction (a face on the card,
   a grapevine line, a note).
8. **Next beat (code):** roll the follow-up (content.md §1.3). A hit adds the next beat to the
   thread. No hit and no other beats: the thread closes.
9. **Remember:** a memory for the asker and for every witness.

### 4.2 Strong, middle, weak

| Tier   | Manager                         | Strong leader                             | Absolute ruler                                         |
| ------ | ------------------------------- | ----------------------------------------- | ------------------------------------------------------ |
| Strong | `invest`                        | `invest`, `reward`                        | `reward`, `invest`                                     |
| Middle | `cheap_fix`, `delegate`         | `cheap_fix`, `delegate`                   | `decree`, `appoint`, `banish`, `cheap_fix`, `delegate` |
| Weak   | `delay`, `refuse`, `ask_others` | `delay`, `refuse`, `ask_others`, `punish` | `delay`, `refuse`, `ask_others`, `punish`, `pardon`    |

This is the table in content.md §1.6. The Strong leader and Absolute ruler rows are first values.

Each stance in a tier starts with weight 1. Weights change the pick:

| Source         | Example                                     | Change                  |
| -------------- | ------------------------------------------- | ----------------------- |
| Asker's traits | a `frugal` bursar                           | `cheap_fix` ×2          |
| Place culture  | Strict 3+                                   | `decree`, `punish` ×1.5 |
| Perks          | "Open door"                                 | `ask_others` ×2         |
| Sense          | the asker is the deputy                     | `delegate` removed      |
| Repeats        | the same stance offered on the last 2 cards | ×0.5                    |

The balance sim plays exactly this offer (`MODE=triad`). A careful player is never fired. A
random player is fired in about 45% of runs.

### 4.3 Text check

The model gets the stances and only writes words. The validator checks each answer:

- The `stance` field echoes the stance it was given, in the same order.
- 3-80 characters, no digits, in the asker's language register.
- No word from the stance's deny list (a `refuse` answer must not contain "fund", "yes", "pay
  for"; an `invest` answer must not contain "no", "later"). The lists live in `cards.ts`.
  `ponytail: word lists, swap for an answer.tag check if false fits show up in play.`

### 4.4 Say something else

Every card has a fourth button, **Say something else**. The player types any answer.

1. `answer.tag` gets the text, the card, the kit's allowed stances (all of them, not only the 3
   offered) and short place facts (authority, statuses that exist, rooms).
2. It returns one stance, whether the answer is possible here, and any promises:

```json
{
  "stance": "delay",
  "possible": true,
  "why": null,
  "promises": [{ "to": "cormac", "what": "a new boat if the eight beat Carrow", "due": { "event": "boat_race" } }]
}
```

3. The code checks the stance is in the allowed list. A stance outside it means "not possible".
4. **Possible:** the code applies the stance numbers like a normal answer and costs 1 hour. The
   typed text is the boss's line on the card and in memories. Each promise opens a `promise`
   thread with its due date (an event resolves to its calendar week).
5. **Not possible:** the asker answers in voice why ("We are a university, Provost. We have no
   cells."). No hour is spent. The card stays open.

Words can never set a number. "Give him double his salary" tags as `invest`, and the table decides
how much Money it costs.

### 4.5 Ignored cards

An unanswered card grows each day. Day 1: "Waited 1 day". Day 3: the asker goes over your head
(a moment beat: to the board, the press, the union). Day 5: the problem happens. The need takes
the full −k, there is no follow-up, and the thread closes as lost.

### 4.6 Prefetch

At the Evening slot the storyteller plans tomorrow's seeds and offers, and the server runs
`cards.day` in the background. The inbox opens at once in the morning. If the night changes the
state (a free action, a Board play), the code checks each prefetched card: a card whose thread
closed is dropped, a card whose seed changed is written again in the morning. Lite mode and
template fallback stay as they are.

### 4.7 Card shape

```json
{
  "id": "c31",
  "thread": "t4",
  "asker": "yusuf",
  "topic": "roof_leak",
  "need": "standing",
  "severity": 2,
  "waitedDays": 0,
  "text": "Provost, the roof of The Stacks is leaking onto the rare books again.",
  "answers": [
    { "tier": "strong", "stance": "invest", "text": "Get a roofer in this week." },
    { "tier": "middle", "stance": "cheap_fix", "text": "Buckets and a tarp for now." },
    { "tier": "weak", "stance": "refuse", "text": "The roof has lasted a century." }
  ],
  "own": null,
  "memoryHooks": ["m3"]
}
```

`own` holds the typed answer and its tag when the player used "Say something else". Each answer
shows the meter types it changes ("Reputation · Grades"), never the numbers (content.md §1.4).

### 4.8 Memory

```json
{
  "id": "m12",
  "week": 1,
  "who": ["yusuf"],
  "about": "c31",
  "thread": "t4",
  "stance": "cheap_fix",
  "line": "Put a bucket under the rare books.",
  "weight": 2,
  "feeling": "annoyed"
}
```

Weight sets how long a memory lasts: 1 fades after a term, 2 after a year, 3 never.

## 5. The storyteller

### 5.1 Tension

Tension 0-100 is recomputed each slot:

```
tension = (sum over meters of max(0, 50 − meter)) / 4
        + 8 × threads due this week
        + 5 × people with stress > 70
        + 10 × open crisis threads
```

Clamp to 0-100. Each preset has a target curve:

- **Calm:** target 20-35. When tension is above the target, the next cards are small and kind.
- **Classic:** target is a wave: 20 → 60 over 3 weeks, a peak event, then a quiet week.
- **Chaos:** target is a random value each day from 10 to 90.

The first line is the **meter part**. The balance sim models only the meter part.

### 5.2 Card budget per day

| Preset  | Cards per day | Severity mix (1 / 2 / 3) | Crisis chance per week     | Open threads |
| ------- | ------------- | ------------------------ | -------------------------- | ------------ |
| Calm    | 2             | 60 / 35 / 5              | 5%                         | 5            |
| Classic | 3             | 45 / 40 / 15             | 15% (25% at the wave peak) | 6            |
| Chaos   | 2-5           | 33 / 33 / 34             | 35%                        | 8            |

With 5 hours a day, 3 cards leave 2 hours for talks, visits, meetings and free actions.
Follow-up beats come on top of the budget.

**A calm place gets harder cards:** in Classic and Chaos, when the meter part of tension is below
20, the mix is 25 / 45 / 30. The rule reads the meter part only, as the sim does. Without this rule
a careful player keeps every meter near 90.

### 5.3 Decks feed threads

The storyteller draws from 4 decks. Each draw that has stakes opens or feeds a thread.

| Deck          | Share                    | Becomes                                                            |
| ------------- | ------------------------ | ------------------------------------------------------------------ |
| Small moments | about 70% of events      | a `moment` beat; may be a beat of an open arc; no stakes otherwise |
| Requests      | the card budget          | a new `follow_up` thread, or the next beat of an open one          |
| Surprises     | at least 1 per week      | a new thread (rival move, visitor, resignation, good luck)         |
| Crises        | the weekly crisis chance | a `crisis` thread with 3 beats                                     |

A draw takes the deck item, picks people who fit (traits, relations, room) and checks that the
same topic did not happen in the last 2 weeks.

**Surprise rule:** if Thursday Afternoon comes and no surprise happened this week, the next draw
is from the surprise deck.

## 6. Rooms and routines

- Every person has a routine: a list of slot → room kinds, made from role and traits. A night
  owl is in the lab at Night. A smoker visits the back door at Midday.
- Each slot the code moves people by routine, with a small random change (10%), and by needs
  (stress high → break room, crush → wherever the crush is).
- A room has a condition (0-100) that drops with use and weather. Low condition lowers the meter
  it feeds and makes cards about it.
- **Overhearing:** when the boss visits a room, the code picks 1-2 pairs in the room and asks the
  ambient batch for one short exchange each. Some exchanges carry a clue: a beat of a secret
  thread.

| Person                 | Morning        | Midday           | Afternoon       | Evening          | Night      |
| ---------------------- | -------------- | ---------------- | --------------- | ---------------- | ---------- |
| Yusuf (head porter)    | Porters' lodge | Cafeteria        | The Stacks roof | The Drowned Bell | Home       |
| Imogen (deputy)        | Admin corridor | Provost's office | Admin corridor  | Wine bar         | Home       |
| Mina (union president) | Tern Hall      | Cafeteria        | The Stacks      | The Bilge        | Gull House |
| Night guard            | Home           | Home             | Home            | Gate             | Patrol     |

## 7. Meetings

### 7.1 Flow

1. **Setup (code):** type, attendees (3-6), agenda (2-3 items from open threads and group
   wishes). Each attendee gets a position on each item: for, against or open.
2. **Opening (model):** chair line and the first item.
3. **Each item:**
   - The code picks 3 stances (strong, middle, weak, as for cards).
   - The model writes 2-4 lines from attendees (in their voices), then one suggestion per stance.
   - The boss picks a suggestion or types freely. A typed line goes through `answer.tag`.
   - The code updates support. A person can change from open to for or against.
   - The boss can spend a favour (from a perk or a past kindness) to swing one person.
4. **Close:** a vote (board, council, union) or an agreement (parent-teacher, team talk).
5. **Result (code):** deltas, memories, next beats for the threads on the agenda. The minutes go
   to the chronicle.

### 7.2 Support

For each attendee on each item (content.md §13):

```
score = (Trust − 50) / 5          (Love instead of Trust in absolute kits)
      + stance fit (−3..+3, from traits and ambition)
      + faction bonus (−2..+2)
      + 3 for the side that plays an evidence card
```

`score > 0` = for, `score < 0` = against, `0` = open. An agreement passes at a total of 0 or more.
A vote passes when more than half of the attendees have a score above 0.

### 7.3 Meeting types

Board meeting · All-hands · Union talks · Safety audit · Investor pitch · Parent or family forum ·
Senate or faculty meeting · Royal council · Crew vote (the Article) · Prefects' report · Handover
or morning briefing · Negotiation with outsiders · **Board hearing** (§7.4). Attendees, agenda
sources and outcomes are in content.md §13.

The **deputy challenge** is a board meeting item. It comes when deputy ambition reaches 100:
Standing −10, People −5, ambition back to 0 (content.md §1.5). In absolute kits it is a plot.

### 7.4 Board hearing

A low meter does not fire the boss at once. When a meter is below 10 on the second Friday in a
row, the body above calls a hearing.

| Kit                         | Body                                | Ending if lost |
| --------------------------- | ----------------------------------- | -------------- |
| Hafenkai (Manager)          | the owner family and the board      | Fired          |
| Hollowmere (Strong leader)  | the board of trustees               | Voted out      |
| Salt Magpie (Strong leader) | the crew vote under the Article     | Marooned       |
| Ward 7 (Manager)            | the hospital director and two leads | Fired          |

Flow:

1. **Notice (Friday report).** "The trustees will hear your case on Tuesday." A `hearing` thread
   opens, due on the hearing day (the second working day of next week).
2. **Prep days.** The boss has normal days. Each hour can go to the hearing: talk to a member
   (trust changes as in any scene), find evidence (an evidence card from a won thread, a known
   secret, a fixed meter), call in a favour, or ask up to 2 people to speak as witnesses.
3. **Hearing (meeting scene).** It plays as a big scene with the `hearing` blueprint (§3.8). It is a meeting with 3 items: the charge, the defence, the last
   word. Members score each item with the support formula. Witnesses speak in the defence item:
   a witness with trust 60 or more gives +1 to every member, a witness below 40 gives −1. Each
   evidence card gives +3 (at most 2 cards). The boss argues with suggestions or typed lines
   (`answer.tag`), and stance fit counts per member.
4. **Vote.** More than half of the members with a score above 0 backs the boss.
5. **Won:** the low meter goes to 20 and the boss gets a **last warning**. The next time the
   trigger hits, there is no hearing: the run ends.
6. **Lost:** the ending (Fired, Voted out, Marooned). The run stays as a title card.

Viewer mode pauses for a hearing. Sandbox has no hearings (cheese-board.md).

## 8. People

### 8.1 Feelings, not numbers

The player sees feelings. The code keeps the numbers.

- **Friday feeling line:** `report.week` writes one line per key person from their memories of the
  week and their trust band. The code sends the band, the model must echo it, and the validator
  rejects a line whose band does not match.

| Band    | Trust  | Example                                |
| ------- | ------ | -------------------------------------- |
| cold    | 0-24   | "Avoids you in the corridor."          |
| wary    | 25-44  | "Waits to see what you do next."       |
| neutral | 45-59  | "Thinks you are cheap, but fair."      |
| warm    | 60-79  | "Tells the porters you are all right." |
| loyal   | 80-100 | "Would stand up for you at the board." |

- **Staff file:** the feeling line, today's mood, the last 3 memories, known relations in words
  ("friends with Mina"), and the person's open threads.
- **Show numbers:** a setting. When on, the staff file and the report also show trust, stress and
  ambition. The Cheese Board always shows them.

### 8.2 The numbers in the code

- **Trust in the boss** 0-100. Starts 40-60 by trait. Changes by stance results that touch the
  person (content.md §1.2), by "Talk it through" (+2 base), by gifts (+3, once a week per person),
  by being heard in a meeting (+2), by broken promises (−8).
- **Stress** 0-100. Rises with workload, conflicts, low People meter and bad rooms. Above 70:
  mistakes, sick days, a breakdown card. Falls on weekends, holidays and with perks.
- **Mood of the day:** great, fine, low, sick, away. Rolled each morning from stress and events.
- **Relations** between people: kind (friend, rival, crush, couple, mentor, enemy, family, secret
  affair) and level 0-100. The boss sees only the known ones (grapevine, overheard, evidence).
- **Skills:** 1-3 skills per person, level 1-5. Mentoring raises one level per term.
- **Deputy ambition** 0-100: +15 per `delegate`. At 100 the deputy challenges the boss (§7.3).
- **Status:** active, on leave, sick, quit, fired, banished, imprisoned, dead (Tone dial and kit
  decide which exist).
- **Leaving:** a person with trust below 15 for 2 weeks hands in notice (a card: keep them or let
  them go). Their open threads drop. Leaving people tell the grapevine why.
- **Newcomers:** a newcomer gets a short `personal_arc` of 3 small moments in their first 2 weeks.

## 9. Authority in data

|                                       | Manager                    | Strong leader                        | Absolute ruler                                              |
| ------------------------------------- | -------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| Boss above you                        | yes, with targets and mood | a board that can vote you out        | none                                                        |
| Extra stances                         | —                          | `reward`, `punish`                   | `decree`, `punish`, `pardon`, `reward`, `banish`, `appoint` |
| Extra meters                          | —                          | —                                    | Fear, Love (0-100) and Legitimacy                           |
| House rules                           | proposals that need a vote | set by you, can be challenged        | decrees, enforced by enforcers                              |
| How a run ends                        | a lost hearing (Fired)     | a lost hearing (Voted out, Marooned) | a lost revolt, a coup, an outside power                     |
| A meter below 10 on the second Friday | board hearing (§7.4)       | board hearing (§7.4)                 | Legitimacy −10 each week while it stays low                 |

**The absolute rule.** Absolute rulers have no hearing and cannot be fired. A low meter costs
Legitimacy −10 each Friday while it stays below 10. Legitimacy 0 opens a `revolt` thread. The
revolt is won when Legitimacy is 25 or more on a Friday. It is lost when its due week passes with
Legitimacy below 25, and that ends the reign. (25 and 3 weeks are first values; the sim does not
test absolute kits yet.)

**Fear and Love.** `punish`, `banish` and decrees with harsh penalties raise Fear. `reward`,
`pardon`, feasts and kind decrees raise Love. Fear makes orders work (fewer ignored decrees).
Love makes people defend you. High Fear with low Love raises the plot chance each week:

```
plot chance = max(0, fear − love − 20) / 2   (percent per week)
```

A plot is a secret `cover_up` thread from the plotters' side: the boss sees it only through clues.

**Legitimacy** 0-100 comes from traditions kept, the priest or council on your side, wins and
heirs. Low legitimacy invites pretenders and rival claims.

**Enforcers** are people with the enforcer role (prefects, guards, knights, the bosun). A decree
works in rooms where an enforcer is present. Enforcer trust decides whether they enforce it.

## 10. Do something: free actions

The Office screen, every staff file and every room have a **Do something** field. The player types
an action. One small model call, `action.tag`, maps the text to a verb the code knows, or to a new
thread seed. The code decides the hours, the cost and the effect. The model never does.

### 10.1 Verbs

| Verb            | Hours        | Effect (code)                                                                             |
| --------------- | ------------ | ----------------------------------------------------------------------------------------- |
| `talk`          | 1            | a scene with a person; can add a promise                                                  |
| `visit`         | 1 (a trip 2) | go to a room; overhearing, people there                                                   |
| `call_meeting`  | 1            | a meeting of a known type in the next free slot                                           |
| `change_rule`   | 1            | a house rule option (Manager: a proposal for the next vote)                               |
| `give_gift`     | 1            | trust +3 for each person, once a week per person; Money −1 for a group gift (first value) |
| `start_project` | 1            | a `project` thread (modules.md)                                                           |
| `investigate`   | 1            | the next clue beat of a `mystery` or `cover_up` thread, or opens one                      |
| `write`         | 0            | a message or letter; the person answers in their next scene                               |
| `delegate_area` | 1            | gives a room or group to a person (modules.md, Delegation)                                |
| `rest`          | 1            | stress of the boss down; energy back (modules.md, Energy)                                 |

`action.tag` output:

```json
{
  "verb": "give_gift",
  "target": { "group": "porters" },
  "room": "drowned_bell",
  "args": { "what": "a round of drinks" },
  "possible": true,
  "why": null,
  "seed": null
}
```

The code validates the verb, the target (the person or room exists, the boss can reach it) and
the hours left. When `verb` is null and `seed` is set, the code opens a thread with `origin:
"action"`, costs 1 hour and asks `thread.beat` for the beats.

### 10.2 Examples at Hollowmere

| The player types                                              | Tag                                                                                  | What happens                                                                                                                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Buy the porters a round at the Drowned Bell tonight."        | `give_gift`, group porters, Evening                                                  | 1 hour, Money −1. Each porter present gets trust +3. Yusuf's next feeling line can mention it.                                                                                                          |
| "Keep the library open all night in exam weeks."              | `change_rule` library_hours = all night                                              | 1 hour. Strong leader: set at once, the touched meters follow the house-rule table. Hester gets a thread beat ("Who stays with the books?").                                                            |
| "Find out who took the clock tower key."                      | `investigate`, thread "The clock tower key"                                          | 1 hour. The next clue beat lands: a scene with Yusuf in the porters' lodge.                                                                                                                             |
| "Quietly tell the Gazette that Carrow's coach bets on races." | no verb, `seed`: kind `cover_up`, people Barnaby and Cormac, need Reputation, secret | 1 hour. A 3-beat thread: Barnaby runs it, Carrow answers, someone asks where it came from. If it comes out, Reputation takes the full −k. (Cormac bets on his own races, so the story can turn.)        |
| "Lock Barnaby in the clock tower until he apologises."        | `possible: false`                                                                    | No hour spent. Imogen answers: "We are a university, Provost, not a castle. The disciplinary board meets on Thursday." The field offers two near actions: talk to Barnaby, call a disciplinary meeting. |

## 11. Viewer mode

- The client runs a timer while the tab is open and visible. Each tick calls `advance` with one
  slot. 1× = one slot every 20 s, 2× = 10 s, 4× = 5 s. Pause stops the timer. A tick waits for the
  last `advance` to finish, so a slow model slows the clock instead of piling up calls.
- Ambient lines come from one `ambient.batch` call each morning for the whole day, not one call
  per slot. A model call every 5 s at 4× is not possible.
- **Who decides:** the deputy (by their own traits and ambition: an ambitious deputy favours their
  friends), an AI boss with a chosen style (Kind, Strict, Greedy, Chaotic), or nobody (cards pile
  up and resolve as ignored).
- The AI boss picks one of the 3 offered stances from a weighted table by style and severity, so
  it needs no extra model call.
- **Follow:** one person, one room or one thread. The ticker shows their lines first.
- **Paused for drama:** the timer stops on a crisis, a meeting vote, a hearing, a resignation, a
  new couple among followed people, a plot, a meter below 15, a secret found. Two buttons: _Keep
  watching_ and _Step in_.
- Wishes and Board plays work in viewer mode.

## 12. Skip ahead and the digest

The place has no clock outside the open tab, so the code cannot count "missed" time. Instead the
player chooses to skip: _Skip to evening_, _Skip to Monday_, _Play the weekend while I'm gone_. The
code runs the skipped slots in one batch with no model calls for ambient lines. Thread clocks run
as usual. Card beats in the skipped time wait in the inbox (they age as ignored cards only after
the skip). One model call writes a short digest: "This morning at Hollowmere". Closing the tab in
viewer mode just pauses the place.

## 13. Place generation

M1 plays a hand-written kit (Hafenkai first). The generator comes after the loop is fun.

1. **Wish screen:** one line, size (Small 8 people / Medium 12 / Large 16), storyteller,
   authority, dials, modules, optional Engine characters as staff and a persona as the boss
   (cast.md).
2. **Draft (model, 1 call):** premise, meter labels, rooms, people, groups, outside places,
   meetings, house rules, traditions, crisis deck picks, place systems (modules.md), the 5 guided
   letters.
3. **People pass (model, 1 call, Medium and Large):** voices, secrets, relations, routines,
   ambitions (each becomes a `personal_arc` seed).
4. **Normalize (code):** fix counts, ids, meter types, missing deputy, rooms without a purpose,
   start values within 35-70, dials. Fill gaps from the family defaults.
5. **Preview:** the place sheet. Reroll all, reroll one part (people, rooms, name), or edit in the
   Kit editor.
6. **Take the job:** freeze the kit into the run, roll birthdays, routines and the first threads
   (the guided thread plus 2-3 deck threads), play the arrival scene.

## 14. Data shapes

The shapes are sketches. Field names can change in the build.

### Place Kit

```json
{
  "kitVersion": 1,
  "id": "hollowmere",
  "name": "Hollowmere University",
  "family": "school",
  "premise": "An old harbour-town university with a famous rowing club and a leaky library.",
  "authority": "strong",
  "bossTitle": "Provost",
  "storyteller": "classic",
  "dials": { "tone": 40, "realism": 60, "difficulty": "normal", "era": "today", "pace": "full" },
  "layers": { "drama": 60, "romance": 40 },
  "week": { "days": 5, "hoursPerDay": 5, "termWeeks": 8, "terms": 3 },
  "meters": {
    "money": { "label": "Endowment", "start": 50 },
    "output": { "label": "Grades", "start": 55 },
    "people": { "label": "Campus mood", "start": 60 },
    "standing": { "label": "Reputation", "start": 50 }
  },
  "rooms": [
    { "id": "stacks", "name": "The Stacks", "kind": "work", "condition": 55, "feeds": ["output"], "capacity": 30 }
  ],
  "people": [
    {
      "id": "imogen",
      "name": "Dr. Imogen Hale",
      "role": "deputy",
      "traits": ["strict", "ambitious"],
      "ambition": "become Provost",
      "secret": "wrote the reform plan under your name",
      "voice": { "style": "crisp, cool", "phrases": ["The plan is sound. Your delay is not."] },
      "routine": "office"
    }
  ],
  "groups": [{ "id": "union", "name": "Student union", "spokesperson": "mina" }],
  "outside": [{ "id": "rival", "name": "Carrow College", "kind": "rival" }],
  "meetings": [{ "type": "union_talks", "every": "month", "week": 1, "day": 3 }],
  "hearing": { "body": "Board of trustees", "ending": "voted_out" },
  "houseRules": [{ "id": "phones", "text": "No phones in lectures", "options": ["ban", "allow", "silent"] }],
  "traditions": ["The Boat Race"],
  "crisisDeck": ["flood", "inspection", "viral_post"],
  "systems": ["regatta"],
  "guidedLetters": ["{porter} knows every door. Ask them first.", "..."],
  "modules": ["office_drama", "press"],
  "termGoals": [
    { "type": "money", "target": 60 },
    { "type": "standing", "target": 70 }
  ]
}
```

A kit is valid when it has 4 meters with one of each type, at least 6 rooms, at least 8 people,
one deputy and at least one meeting type. The normalizer fills missing parts with defaults for the
family.

### Run document

```json
{
  "saveVersion": 1,
  "revision": 42,
  "kit": { "...": "the kit as played, frozen at start" },
  "clock": { "week": 1, "day": 2, "slot": "afternoon", "hoursLeft": 3 },
  "meters": { "money": 51, "output": 53, "people": 54, "standing": 53 },
  "meterHistory": [{ "week": 1, "money": 51, "output": 53, "people": 54, "standing": 53 }],
  "boss": { "cast": { "source": "persona", "personaId": "persona_9", "snapshot": { "...": "cast.md §7" } } },
  "people": {
    "imogen": {
      "trust": 48,
      "stress": 20,
      "mood": "fine",
      "room": "office",
      "feeling": "Pleased you trust her with the press.",
      "memories": ["m12"],
      "skills": { "admin": 3 },
      "status": "active",
      "cast": { "source": "character", "engineId": "char_123", "snapshot": { "...": "cast.md §7" } }
    }
  },
  "relations": [{ "a": "imogen", "b": "ashgrove_nephew", "kind": "secret_affair", "level": 40 }],
  "threads": { "open": ["t4", "t5", "t6"], "closed": ["t1"] },
  "cards": { "inbox": ["c31"], "prefetched": ["c40", "c41", "c42"] },
  "rooms": { "stacks": { "condition": 70, "people": ["mina"] } },
  "things": { "drawer": ["brass_key", "letter_2"], "equipment": [], "stock": {} },
  "houseRules": { "phones": "silent" },
  "culture": { "family": 3, "strict": 1 },
  "traditions": [{ "id": "friday_cake", "count": 1 }],
  "deputyAmbition": 15,
  "lastWarning": false,
  "storyteller": { "tension": 34, "lastSurprise": { "week": 1, "day": 2 } },
  "authority": { "fear": 0, "love": 0, "legitimacy": 0 },
  "wishPoints": 3,
  "journal": { "plays": ["j7", "j8"], "snapshots": ["snap_j7", "snap_j8"] },
  "settings": { "showNumbers": false },
  "grapevine": ["g40"],
  "chronicle": ["e1"],
  "viewer": { "on": false, "follow": null, "speed": 1 }
}
```

- **threads** holds ids. Each thread's compact shape (§3.1) sits in a `threads` map in the same
  document; beat text sits in a child document.
- **cast** is a block on a person in `people`, or on `boss`, that links them to an Engine
  character or persona and keeps the snapshot the run uses (cast.md §7).
- **journal** lists Cheese Board plays and the id of the snapshot saved before each one. Rewind
  loads that snapshot (cheese-board.md).
- **Keep the run document small.** Snapshots are whole copies, so every byte counts once per
  play. Scene logs, beat lines, old grapevine lines, chronicle entries and memory lines live in
  child documents keyed by run id and week. A snapshot copies only the run document. Text made
  after a snapshot is dropped on rewind by week key. Target: under 50 KB for a Large place in
  term 3.

## 15. Model tasks

Each task has a token budget with room for reasoning models, a JSON validator and a template
fallback (Lite mode uses the template first for the tasks marked *).

| Task               | When                                                                | Input                                                                                                                                                                                                                                                                          | Output                                                     |
| ------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `place.draft`      | wish                                                                | wish, size, dials, authority, modules                                                                                                                                                                                                                                          | kit draft                                                  |
| `place.people`     | wish (M/L)                                                          | kit draft                                                                                                                                                                                                                                                                      | people with voice, secret, relations, routine, ambition    |
| `cards.day`        | each evening (prefetch for tomorrow)                                | card seeds with the 3 code-picked stances, memory hooks, voices                                                                                                                                                                                                                | asker text and one answer text per given stance            |
| `answer.tag`       | own answer on a card, typed line in a meeting or hearing            | text, card or item, allowed stances, place facts                                                                                                                                                                                                                               | `{stance, possible, why, promises}`                        |
| `action.tag`       | "Do something"                                                      | text, where, people present, verb list, open threads                                                                                                                                                                                                                           | `{verb, target, room, args, possible, why, seed}`          |
| `thread.beat`      | a thread opens from text (wish, action seed, arc, Spin)             | code skeleton: kind, people, need, beat types and days                                                                                                                                                                                                                         | title, stakes line, one line per beat                      |
| `scene.turn`       | talk, room visit, scene beat                                        | person, voice, memories, recent lines, player line, optional code-picked stance for a new answer                                                                                                                                                                               | `{lines, suggestions, newAnswer}`                          |
| `scene.part`*      | each big-scene part; part 1 is prefetched the evening before (§3.8) | blueprint goal, part index and count, room, people on stage with voice, core and 1-2 memory hooks, thread title and stakes, one-line summaries of earlier parts, the last 4 lines, the last part's result, the end type with the code-picked stances or options, content rules | `{lines, suggestions, summary}`                            |
| `meeting.turn`     | each meeting or hearing item                                        | attendees, positions, item, 3 code-picked stances, player line                                                                                                                                                                                                                 | `{lines, suggestions}` (one suggestion per stance)         |
| `ambient.batch`*   | each morning (viewer mode) or each visit                            | people in rooms, mood, relations, moment beats                                                                                                                                                                                                                                 | short lines per person                                     |
| `grapevine.batch`* | evening                                                             | the day's decisions and moments                                                                                                                                                                                                                                                | 3-6 rumour lines with source                               |
| `report.week`      | Friday                                                              | meter changes, memories, trust bands, warnings                                                                                                                                                                                                                                 | report text, one feeling line per key person with its band |
| `wish.classify`    | wish                                                                | wish text                                                                                                                                                                                                                                                                      | thread kind, people, seed                                  |
| `digest.away`      | after a skip                                                        | batch events                                                                                                                                                                                                                                                                   | short digest                                               |
| `chronicle.term`   | end of term                                                         | closed threads, term summary                                                                                                                                                                                                                                                   | yearbook page text, awards                                 |
| `kit.fix`          | import                                                              | broken kit                                                                                                                                                                                                                                                                     | fixed kit (code validates)                                 |

Cheese Board Spin planning is its own task (cheese-board.md). `crisis.step` is gone: crisis beats
are cards and go through `cards.day`.

Example `cards.day` output (the stances came in with the seed):

```json
{
  "cards": [
    {
      "seed": "s1",
      "text": "Provost, the roof of The Stacks is leaking onto the rare books again.",
      "answers": [
        { "stance": "invest", "text": "Get a roofer in this week." },
        { "stance": "cheap_fix", "text": "Buckets and a tarp for now." },
        { "stance": "refuse", "text": "The roof has lasted a century." }
      ]
    }
  ]
}
```

## 16. Routes

| Route                    | Method     | Purpose                                                                                                                                        |
| ------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `/runs`                  | GET        | saved places for the title screen (light)                                                                                                      |
| `/runs`                  | POST       | create a run from a kit                                                                                                                        |
| `/runs/:id/summary`      | GET        | office view: clock, meters, hours, inbox ids, open thread cards, next meeting                                                                  |
| `/runs/:id/advance`      | POST       | one action or `{ slots: n }`; returns `events[]`                                                                                               |
| `/runs/:id/cards/:card`  | GET / POST | read a card / answer it with one of the offered answers                                                                                        |
| `/runs/:id/answer`       | POST       | own answer on a card: `{card, text}` → tag, apply or "not possible"                                                                            |
| `/runs/:id/act`          | POST       | free action: `{text, where}` → tag, apply, or "not possible"                                                                                   |
| `/runs/:id/threads`      | GET        | open threads (story cards); `/threads/:tid` for beats and people                                                                               |
| `/runs/:id/scene`        | POST       | start or continue a talk or room scene                                                                                                         |
| `/runs/:id/meeting`      | POST       | start or continue a meeting or hearing                                                                                                         |
| `/runs/:id/big-scene`    | GET / POST | GET: the current big scene for resume. POST `{action: start, choose, skip or decline, sceneId, partId, choice, text, expectedRevision}` (§3.8) |
| `/runs/:id/people`       | GET        | staff list (light); `/people/:pid` for a full file                                                                                             |
| `/runs/:id/rooms`        | GET        | floor map with people per room                                                                                                                 |
| `/runs/:id/grapevine`    | GET        | paged rumour lines                                                                                                                             |
| `/runs/:id/wish`         | POST       | spend a wish                                                                                                                                   |
| `/runs/:id/rules`        | GET / POST | house rules and decrees                                                                                                                        |
| `/runs/:id/report/:week` | GET        | Friday report                                                                                                                                  |
| `/runs/:id/chronicle`    | GET        | chronicle and yearbook pages                                                                                                                   |
| `/runs/:id/board/*`      | GET / POST | Cheese Board: preview, play, rewind, journal, coming-up (cheese-board.md)                                                                      |
| `/cast/*`                | GET / POST | Engine characters and personas for kits and runs (cast.md)                                                                                     |
| `/kits`                  | GET / POST | saved kits, import, export                                                                                                                     |
| `/place/draft`           | POST       | wish → kit draft → preview                                                                                                                     |
| `/calls`                 | GET        | model call debug log                                                                                                                           |

All writes go through the per-run queue with `expectedRevision`.

## 17. Package layout

```
packages/big-cheese/
  manifest.json
  src/
    server/
      routes.ts          route table
      store.ts           run documents, child documents, queue, migrations
      clock.ts           slots, days, weeks, terms
      storyteller.ts     tension, decks, budget, thread targets
      threads.ts         thread kinds, beats, clocks, close effects
      cards.ts           seeds, strong/middle/weak offer, apply, own answers, follow-up rolls
      actions.ts         "Do something" verbs: hours, costs, effects
      meetings.ts        positions, support, votes, hearings
      people.ts          trust, stress, bands, routines, relations, memories
      authority.ts       fear, love, legitimacy, enforcers, plots, revolt
      viewer.ts          AI boss policies, drama triggers
      board.ts           Cheese Board plays, snapshots, rewind (cheese-board.md)
      cast.ts            Engine character and persona links (cast.md)
      model/
        ask.ts           JSON helper (extract, repair, validate, retries, budgets)
        tasks/*.ts       one file per model task with its validator and template
      kits/
        normalize.ts
        builtin/*.json   built-in kits from the content file
    client/
      app.ts             tab shell, bottom bar, poller
      screens/*.ts       one module per screen, each with its own error fallback
      locale/en.json
  scripts/build.mjs
```

The balance sim stays in the plan folder at [sim/stance-sim.mjs](sim/stance-sim.mjs) until the
code exists.

The pure modules (clock, storyteller, threads, cards, actions, meetings, people, authority, board)
take state and return new state and events. They need no model and no storage, so each one gets a
small runnable check, and the Cheese Board can snapshot and rewind any state. When `cards.ts` and
`storyteller.ts` exist, the sim imports them instead of its own copies. A CI check then fails when
a careful bot is fired, or when a random bot is fired in fewer than 20% or more than 60% of runs
(24 weeks, 500 runs).
