# Big Cheese: design deep-dive

Companion to [big-cheese.md](big-cheese.md) (the concept) and
[big-cheese-content.md](big-cheese-content.md) (kits, decks and catalogs). This file says how
the systems work: data shapes, the day, the storyteller, cards, meetings, people, viewer mode,
model tasks and routes.

## 1. A sample week at Hollowmere

Hollowmere University, a harbour town campus. Classic storyteller, Strong leader. The player is
the new Dean. Start meters: Endowment 55, Grades 60, Campus mood 50, Reputation 58.

**Sunday evening (arrival).** A short scene. Vera Achterberg, the deputy, shows the Dean the
office. She says the last Dean "left in a hurry". The drawer holds a brass key with no label.

**Monday.**
- Morning slot: inbox shows 4 cards. The roof of the old library leaks (severity 2, Money ·
  Reputation, asker: Tomas the caretaker). The rowing club wants a new boat. A first-year asks
  for an exam extension. The canteen wants to drop the vegan menu.
- The Dean answers the roof with `cheap_fix` (Endowment −3, Reputation +1, Tomas trust +2) and
  the boat with `delay`. That is 2 of 5 hours.
- Midday: the Dean walks to the canteen (1 hour). Overheard: two lecturers complain about the
  parking. A small moment: the canteen cat has kittens.
- Afternoon: "Talk it through" with the first-year (1 hour). The scene unlocks a fourth answer:
  "Extension, but you join study hall." The Dean takes it (`invest` sev 1).
- Evening: ambient batch. Grapevine: "The new Dean actually listens." Campus mood +1.

**Tuesday.**
- The rowing club card comes back worse ("Waited 1 day": the captain posts about it).
- A surprise the player did not cause: Prof. Lindqvist is offered a job at the rival university.
- The Dean calls Lindqvist in. The scene sets a choice: match the offer (`invest` sev 3) or let
  him go (`refuse`). The Dean refuses. Lindqvist's friends lose 4 trust each.

**Wednesday.** The parent-teacher evening (a meeting from the calendar). Three agenda items:
the vegan menu, the leaky library, a complaint about grade inflation. Support is counted per
item. The Dean wins two items and loses the third. Board chair Mr. Halloran's nephew is in the
room and takes notes.

**Thursday.** The leak comes back (the cheap fix held 3 days). Now severity 3. Tomas says: "I
told you a bucket won't do it." The Dean pays for the full roof (`invest` sev 3, Endowment −14).
Reputation goes up as the press visits the new roof on Friday.

**Friday.** Report: meters 41 / 61 / 54 / 63. "Who remembers": Tomas (+6 trust, "Fixed it
properly in the end"), Lindqvist's circle (−4), the rowing captain (−5). Warnings: Endowment
below 45 makes the board nervous. Next week: board meeting Tuesday, open day Thursday.
A tradition seed appears: "Friday cake in the staff room" (2 more Fridays make it a tradition).

## 2. Time

- **Day:** 5 slots: Morning, Midday, Afternoon, Evening, Night. The boss has 5 hours (a kit or a
  perk can change this). Each action costs 1 hour; an hour spent moves the clock to the next
  slot only when all hours of that slot are used. Simple rule: 1 hour = 1 slot.
- **Week:** 5 working days plus a weekend that is one summary step (weekend events, sports, a
  party, a weekend shift). Kits can set a 7-day week (ship, hospital, kingdom).
- **Term:** 12 weeks by default. A year is 3 terms. A kit can name them (Spring term, Season,
  Quarter, Year of the reign).
- **Season and weather:** each week has a season and a weather roll. Weather changes routines
  (rain empties the quad) and some decks (snow day, heat wave).
- **Calendar:** fixed meetings, holidays, birthdays (each person has one), traditions,
  deadlines from follow-ups, outside dates (the inspection on week 7).

## 3. Data shapes

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
  "bossTitle": "Dean",
  "storyteller": "classic",
  "dials": { "drama": 60, "romance": 40, "humour": 50, "danger": 20, "realism": 60 },
  "week": { "days": 5, "hoursPerDay": 5, "termWeeks": 12 },
  "meters": {
    "money":    { "label": "Endowment",   "start": 55 },
    "output":   { "label": "Grades",      "start": 60 },
    "people":   { "label": "Campus mood", "start": 50 },
    "standing": { "label": "Reputation",  "start": 58 }
  },
  "extraMeters": [{ "id": "rowing", "label": "Rowing glory", "start": 30, "type": "standing" }],
  "rooms": [
    { "id": "library", "name": "Old library", "kind": "study", "condition": 40,
      "feeds": ["output"], "capacity": 30 }
  ],
  "people": [
    { "id": "vera", "name": "Vera Achterberg", "role": "deputy", "traits": ["ambitious", "charming"],
      "ambition": "become Dean", "secret": "meets the board chair's nephew",
      "voice": { "style": "polished, warm on top", "phrases": ["Of course, Dean."] },
      "routine": "office" }
  ],
  "groups": [{ "id": "parents", "name": "Parents' council", "spokesperson": "ines" }],
  "outside": [{ "id": "rival", "name": "Kingsbridge College", "kind": "rival" }],
  "meetings": [{ "type": "parent_teacher", "every": "term", "week": 3, "day": 3 }],
  "houseRules": [{ "id": "phones", "text": "No phones in lectures", "options": ["ban", "allow", "silent"] }],
  "traditions": ["Regatta day"],
  "crisisDeck": ["flood", "inspection", "viral_post"],
  "modules": ["office_drama", "press"],
  "termGoals": [{ "type": "money", "target": 60 }, { "type": "standing", "target": 70 }],
  "art": { "palette": "harbour", "fonts": "serif" }
}
```

A kit is valid when it has 4 meters with one of each type, at least 6 rooms, at least 8 people,
one deputy and at least one meeting type. The normalizer fills missing parts with defaults for
the family.

### Run document

```json
{
  "saveVersion": 1,
  "revision": 42,
  "kit": { "...": "the kit as played, frozen at start" },
  "clock": { "week": 1, "day": 2, "slot": "afternoon", "hoursLeft": 3 },
  "meters": { "money": 41, "output": 61, "people": 54, "standing": 63 },
  "meterHistory": [{ "week": 1, "money": 41, "output": 61, "people": 54, "standing": 63 }],
  "people": { "vera": { "trust": 48, "stress": 20, "mood": "fine", "room": "office",
                        "memories": ["m12"], "skills": { "admin": 3 }, "status": "active" } },
  "relations": [{ "a": "vera", "b": "halloran_nephew", "kind": "secret_affair", "level": 40 }],
  "cards": { "open": ["c31"], "done": ["c12"], "followUps": [{ "from": "c12", "dueWeek": 2 }] },
  "rooms": { "library": { "condition": 70, "people": ["anja"] } },
  "things": { "drawer": ["brass_key"], "equipment": [], "stock": {} },
  "houseRules": { "phones": "silent" },
  "culture": { "family": 3, "strict": 1 },
  "traditions": [{ "id": "friday_cake", "count": 1 }],
  "storyteller": { "tension": 34, "lastSurprise": { "week": 1, "day": 2 } },
  "authority": { "fear": 0, "love": 0, "legitimacy": 0 },
  "grapevine": ["g40"],
  "chronicle": ["e1"],
  "viewer": { "on": false, "follow": null, "speed": 1 }
}
```

Large text (scene logs, old grapevine lines, chronicle entries) lives in child documents keyed
by run id and week, so light views do not load it.

### Card

```json
{
  "id": "c31",
  "asker": "tomas",
  "topic": "roof_leak",
  "types": ["money", "standing"],
  "severity": 2,
  "followUpOf": null,
  "waitedDays": 0,
  "text": "Dean, the library roof is leaking onto the rare books again.",
  "answers": [
    { "text": "Get a roofer in this week.", "stance": "invest" },
    { "text": "Buckets and a tarp for now.", "stance": "cheap_fix" },
    { "text": "Ask the board for money.", "stance": "ask_others" }
  ],
  "memoryHooks": ["m3"]
}
```

### Memory

```json
{ "id": "m12", "week": 1, "who": ["tomas"], "about": "c31", "stance": "cheap_fix",
  "line": "Put a bucket under the rare books.", "weight": 2, "feeling": "annoyed" }
```

Weight sets how long a memory lasts: 1 fades after a term, 2 after a year, 3 never.

## 4. Rooms and routines

- Every person has a routine: a list of slot → room kinds, made from role and traits. A night
  owl is in the lab at Night. A smoker visits the back door at Midday.
- Each slot the code moves people by routine, with a small random change (10%), and by needs
  (stress high → break room, crush → wherever the crush is).
- A room has a condition (0-100) that drops with use and weather. Low condition lowers the
  meter it feeds and makes cards about it.
- **Overhearing:** when the boss visits a room, the code picks 1-2 pairs in the room and asks the
  ambient batch for one short exchange each. Some exchanges carry a clue (a secret, a plan, a
  crush).

Example routines:

| Person | Morning | Midday | Afternoon | Evening | Night |
|---|---|---|---|---|---|
| Tomas (caretaker) | Boiler room | Canteen | Library roof | Pub | Home |
| Vera (deputy) | Office | Board room | Office | Wine bar | Home |
| Anja (student) | Lecture hall | Quad | Library | Boathouse | Dorm |
| Night guard | Home | Home | Home | Gate | Patrol |

## 5. The storyteller

### Tension

Tension 0-100 is recomputed each slot:

```
tension = 0.5 × (sum over meters of max(0, 50 − meter)) / 2
        + 8 × open follow-ups due this week
        + 5 × people with stress > 70
        + 10 × open crisis
```

Clamp to 0-100. Each preset has a target curve:

- **Calm:** target 20-35. When tension is above the target, the next cards are small and kind.
- **Classic:** target is a wave: 20 → 60 over 3 weeks, a peak event, then a quiet week.
- **Chaos:** target is a random value each day from 10 to 90.

### Card budget per day

| Preset | Cards per day | Severity mix (1 / 2 / 3) | Crisis chance per week |
|---|---|---|---|
| Calm | 3 | 60 / 35 / 5 | 5% |
| Classic | 4 | 45 / 40 / 15 | 15% (25% at the wave peak) |
| Chaos | 3-6 | 33 / 33 / 34 | 35% |

### Decks

The storyteller draws from 4 decks each slot:

1. **Small moments** (about 70% of events): no stakes, gives life. Birthdays, colds, a new
   couple, a broken coffee machine.
2. **Requests:** become cards in the inbox.
3. **Surprises:** something the player did not cause (a rival move, a visitor, a resignation,
   good luck). At least one per week.
4. **Crises:** a crisis sequence of 3 fast decisions.

A draw takes the deck item, picks people who fit (by traits, relations, room), and checks that
the same topic did not happen in the last 2 weeks.

### Surprise rule in code

If Thursday Afternoon comes and no surprise happened this week, the next draw is from the
surprise deck.

## 6. Card lifecycle

1. **Seed (code):** asker, topic, meter types, severity, follow-up link, 1-2 memory hooks.
2. **Write (model):** one batch call per day writes all the day's cards from their seeds. Each
   answer gets a stance tag.
3. **Check (code):** stance must be in the list for this authority level; at least 2 different
   stances; text must name the asker in the right voice. One fix-up retry, then a template card.
4. **Answer (player):** costs 1 hour. "Talk it through" costs 1 hour and adds one answer.
5. **Apply (code):** deltas from the stance table (in the content file) × place family weight ×
   perks. Trust change for the asker and for people who care about the topic.
6. **React (code + ambient):** within one slot, at least one visible reaction (a face on the
   card, a grapevine line, a note).
7. **Follow-up (code):** some stances schedule a follow-up card 1-3 weeks later. `delay` and
   `cheap_fix` do this most.
8. **Remember:** a memory is written for the asker and for any witness.

**Ignored cards** grow each day: day 1 "Waited 1 day", day 3 the asker goes over your head (to
the board, the press, the union), day 5 the card resolves by itself with the worst stance.

## 7. Meetings

### Flow

1. **Setup (code):** type, attendees (3-6), agenda (2-3 items from open cards, follow-ups and
   group wishes). Each attendee gets a position on each item: for, against or open, from traits,
   trust, group and self-interest.
2. **Opening (model):** chair line and the first item.
3. **Each item:**
   - The model writes 2-4 lines from attendees (in their voices), then 3 suggestions for the
     boss.
   - The boss picks a suggestion or types freely. The model tags the line with a stance.
   - Code updates support. A person can change from open to for or against.
   - The boss can spend a favour (from a perk or a past kindness) to swing one person.
4. **Close:** a vote (board, council, union) or an agreement (parent-teacher, team talk).
5. **Result (code):** deltas, memories, follow-ups. The meeting minutes go to the chronicle.

### Support

For each attendee on each item:

```
lean = trust_in_boss − 50                (−50..+50)
     + 20 if the boss's stance matches the attendee's preferred stance for this topic
     − 20 if it is the attendee's disliked stance
     + 15 if a friend of theirs spoke for it
     − 15 if a rival of theirs spoke for it
     + faction weight (−20..+20)
```

`lean > 15` = for, `lean < −15` = against, else open. Open votes split by a coin weighted by
`lean`. The vote passes on a simple majority of weighted votes (board members can have 2).

### Meeting types and attendees

Board meeting (chair, 3-5 members, deputy) · Parent-teacher evening (parents' council, 2
teachers, a student) · Union talks (rep, 2 workers, HR) · Investor pitch (2 investors, finance
head) · All-hands (everyone; no vote, only mood) · Safety audit (inspector, safety lead) · Royal
council (chancellor, marshal, steward, priest) · Captain's council (quartermaster, bosun,
navigator). The content file has the full list.

## 8. People: the numbers

- **Trust in the boss** 0-100. Starts 40-60 by trait. Changes by stance results that touch the
  person, by "Talk it through" (+2 base), by gifts (+3, once a week per person), by being heard
  in a meeting (+2), by broken promises (−8).
- **Stress** 0-100. Rises with workload, conflicts, low People meter and bad rooms. Above 70:
  mistakes, sick days, a breakdown card. Falls on weekends, holidays and with perks.
- **Mood of the day:** great, fine, low, sick, away. Rolled each morning from stress and events.
- **Relations** between people: kind (friend, rival, crush, couple, mentor, enemy, family,
  secret affair) and level 0-100. Small moments create and change them. The boss sees only the
  ones that are known (grapevine, overheard, evidence).
- **Skills:** 1-3 skills per person, level 1-5. Mentoring raises one level per term.
- **Status:** active, on leave, sick, quit, fired, banished, imprisoned, dead (danger dial and
  kit decide which exist).
- **Leaving:** a person with trust below 15 for 2 weeks hands in notice (a card: keep them or let
  them go). Leaving people tell the grapevine why.
- **Newcomers:** hires, transfers, new students, a new knight. A newcomer has an onboarding arc
  of 3 small moments in their first 2 weeks.

## 9. Authority in data

| | Manager | Strong leader | Absolute ruler |
|---|---|---|---|
| Boss above you | yes, with targets and mood | a board that can vote you out | none |
| Extra stances | — | `reward`, `punish` | `decree`, `punish`, `pardon`, `reward`, `banish`, `appoint` |
| Extra meters | — | — | Fear, Love (0-100) and Legitimacy |
| House rules | proposals that need a vote | set by you, can be challenged | decrees, enforced by enforcers |
| How a run ends | fired by the boss above | voted out | revolt, a coup, an outside power, a walkout |

**Fear and Love.** `punish`, `banish` and decrees with harsh penalties raise Fear. `reward`,
`pardon`, feasts and kind decrees raise Love. Fear makes orders work (fewer ignored decrees).
Love makes people defend you. High Fear with low Love raises the plot chance each week:

```
plot chance = max(0, fear − love − 20) / 2   (percent per week)
```

**Legitimacy** 0-100 comes from traditions kept, the priest or council on your side, wins and
heirs. Low legitimacy invites pretenders and rival claims.

**Enforcers** are people with the enforcer role (prefects, guards, knights, the bosun). A decree
works in rooms where an enforcer is present. Enforcer trust decides whether they enforce it.

## 10. Viewer mode

- The client runs a timer while the tab is open and visible. Each tick calls `advance` with one
  slot. 1× = one slot every 20 s, 2× = 10 s, 4× = 5 s. Pause stops the timer.
- **Who decides:** the deputy (decides by their own traits and ambition: an ambitious deputy
  favours their friends), an AI boss with a chosen style (Kind, Strict, Greedy, Chaotic), or
  nobody (cards pile up and resolve by themselves).
- The AI boss picks a stance from a weighted table by style and severity, so it needs no extra
  model call.
- **Follow:** one person or one room. The ticker shows that person's lines first.
- **Paused for drama:** the timer stops on: a crisis, a meeting vote, a resignation, a new couple
  among followed people, a plot, a meter below 15, a secret found. Two buttons: *Keep watching*
  and *Step in*.
- Wishes work in viewer mode.

## 11. Away digest

When the player opens the tab and slots were missed (the place moves only while the tab is open,
so "missed" means the player left viewer mode on and closed the tab, or chose "play the weekend
while I'm gone"), the code runs the missed slots in one batch with no model calls for ambient
lines, then asks one model call for a short digest: "This morning at Hollowmere". Big moments
in the batch become cards waiting for the player.

## 12. Wishes

- A wish is a free line ("A new chemistry teacher with a secret", "A storm hits the harbour",
  "Vera falls for the new coach").
- **Code** classifies it with one small model call into a type: new person, event, crisis,
  relation, lucky break, rival move, room, thing. Each type has a cost in wish points (1-3).
- Wish points: 1 per week by default, more with perks; sandbox has unlimited.
- The wish becomes a normal seed for the storyteller, so it plays out through cards, scenes and
  small moments, not as an instant change.

## 13. Place generation

1. **Wish screen:** one line, size (Small 8 people / Medium 12 / Large 16), storyteller,
   authority, dials, modules, optional character cards as staff.
2. **Draft (model, 1 call):** premise, meter labels, rooms, people, groups, outside places,
   meetings, house rules, traditions, crisis deck picks.
3. **People pass (model, 1 call, Medium and Large):** voices, secrets, relations, routines.
4. **Normalize (code):** fix counts, ids, meter types, missing deputy, rooms without a
   purpose, start values within 35-70, dials. Fill gaps from the family defaults.
5. **Preview:** the place sheet. Reroll all, reroll one part (people, rooms, name), or edit in
   the Kit editor.
6. **Take the job:** freeze the kit into the run, roll birthdays, routines and week 1 seeds,
   play the arrival scene.

## 14. Model tasks

Each task has a token budget with room for reasoning models, a JSON validator and a template
fallback (Lite mode uses the template first for the tasks marked *).

| Task | When | Input | Output |
|---|---|---|---|
| `place.draft` | wish | wish, size, dials, authority, modules | kit draft |
| `place.people` | wish (M/L) | kit draft | people with voice, secret, relations, routine |
| `cards.day` | each morning | 3-6 card seeds, memory hooks, voices | cards with answers and stances |
| `scene.turn` | talk, room visit | person, voice, memories, recent lines, player line | `{lines, suggestions, stance}` |
| `meeting.turn` | each meeting item | attendees, positions, item, player line | `{lines, suggestions, stance}` |
| `ambient.batch`* | each slot (viewer mode) or each visit | people in rooms, mood, relations, small moments | short lines per person |
| `grapevine.batch`* | evening | the day's decisions and moments | 3-6 rumour lines with source |
| `report.week` | Friday | meter changes, memories, warnings | report text, 3 "who remembers" lines |
| `wish.classify` | wish | wish text | type, people, seed |
| `crisis.step` | crisis | crisis, step, last answer | text and 2-3 answers with stances |
| `digest.away` | return | batch events | short digest |
| `chronicle.term` | end of term | term summary | yearbook page text, awards |
| `kit.fix` | import | broken kit | fixed kit (code validates) |

Example `cards.day` output:

```json
{ "cards": [
  { "seed": "s1",
    "text": "Dean, the library roof is leaking onto the rare books again.",
    "answers": [
      { "text": "Get a roofer in this week.", "stance": "invest" },
      { "text": "Buckets and a tarp for now.", "stance": "cheap_fix" }
    ] } ] }
```

Example `scene.turn` output:

```json
{ "lines": [
    { "who": "tomas", "text": "A bucket. You gave me a bucket.", "mood": "dry" },
    { "who": "tomas", "text": "The books are fine. My back is not." } ],
  "suggestions": ["I'll get a roofer.", "Show me the worst spot.", "Take Friday off."],
  "stance": null }
```

## 15. Routes

| Route | Method | Purpose |
|---|---|---|
| `/runs` | GET | saved places for the title screen (light) |
| `/runs` | POST | create a run from a kit |
| `/runs/:id/summary` | GET | office view: clock, meters, hours, inbox ids, next meeting |
| `/runs/:id/advance` | POST | one action or `{ slots: n }`; returns `events[]` |
| `/runs/:id/cards/:card` | GET / POST | read a card / answer it |
| `/runs/:id/scene` | POST | start or continue a talk or room scene |
| `/runs/:id/meeting` | POST | start or continue a meeting |
| `/runs/:id/people` | GET | staff list (light); `/people/:pid` for a full file |
| `/runs/:id/rooms` | GET | floor map with people per room |
| `/runs/:id/grapevine` | GET | paged rumour lines |
| `/runs/:id/wish` | POST | spend a wish |
| `/runs/:id/rules` | GET / POST | house rules and decrees |
| `/runs/:id/report/:week` | GET | Friday report |
| `/runs/:id/chronicle` | GET | chronicle and yearbook pages |
| `/kits` | GET / POST | saved kits, import, export |
| `/place/draft` | POST | wish → kit draft → preview |
| `/calls` | GET | model call debug log |

All writes go through the per-run queue with `expectedRevision`.

## 16. Package layout

```
packages/big-cheese/
  manifest.json
  src/
    server/
      routes.ts          route table
      store.ts           run documents, queue, migrations
      clock.ts           slots, days, weeks, terms
      storyteller.ts     tension, decks, budget
      cards.ts           seeds, apply, follow-ups
      meetings.ts        positions, support, votes
      people.ts          trust, stress, routines, relations, memories
      authority.ts       fear, love, legitimacy, enforcers, plots
      viewer.ts          AI boss policies, drama triggers
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

The pure modules (clock, storyteller, cards, meetings, people, authority) take state and return
new state and events. They need no model and no storage, so each one gets a small runnable check.
