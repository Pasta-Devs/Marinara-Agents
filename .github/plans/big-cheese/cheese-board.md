# Big Cheese: the Cheese Board

Companion to [README.md](README.md), [design.md](design.md), [content.md](content.md),
[modules.md](modules.md) and [cast.md](cast.md). This file is the full design of the cheat menu.

## 1. What it is

The Cheese Board is the boss's own board of directors, and the player is its only member. The
Board can change any part of the game state on purpose: a meter, a feeling, a secret, a room, a
rule, the calendar, the story itself.

The Board does three things:

- It sets any number or flag the game stores, exactly and at once.
- It turns plain words into a planned story with beats over the next days and weeks.
- It keeps every play in the journal, and any play can be rewound.

It is pillar 6 of the plan ("Say it and the place answers"). The code still owns every number:
the Board changes numbers through code, never through model text.

### How it beats Slurp2 Stir

Stir (Slurp2) has 37 actions plus 8 Support-desk actions, an AI planner with up to 8 preview
cards, and a "Recent plays" ledger. The 2026-09-29 audit found these weak points.

| Stir weak point                                                                             | Cheese Board answer                                                                |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Undo is partial: an 8 s toast, lost when the screen unmounts, several undo bugs broke state | Exact rewind of any play from a snapshot, from the journal, at any time. No toast. |
| Many actions cannot be undone, and the UI does not say so first                             | No action is "not undoable". Rewind works on the whole state, not per action.      |
| Failed AI plans still use the plan budget; a gate returns HTTP 429                          | No budget at all. A failed plan costs nothing and says why.                        |
| Delayed answers create a second state the player must track                                 | The Set layer is instant and exact. Nothing waits for an answer.                   |
| Later effects (1-14 days) show only in the ledger                                           | **Coming up** shows every scheduled beat. You can move, change or cancel it.       |
| Two action families (Stir, Support desk) with one schema but different rules                | One schema and one rule set for Set and Spin.                                      |
| Hard-coded English, a fixed 680 px box, targets under 44 px, limits only in schemas         | Phone first, 44 px targets, locale strings, theme tokens, limits shown in the UI.  |

## 2. Opening it

The Board opens from anywhere, with the target already filled in.

| From                                                         | How                                                           | Target filled in         |
| ------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------ |
| More menu                                                    | tap "Cheese Board"                                            | none (search first)      |
| A person (Staff list, Staff file, floor map, scene portrait) | long-press                                                    | that person              |
| A room (floor map, room visit)                               | long-press                                                    | that room                |
| A card or a thread (inbox, thread list)                      | long-press                                                    | that card or thread      |
| A meter (office header)                                      | long-press                                                    | that meter               |
| A meeting or a Coming-up row                                 | long-press                                                    | that meeting or beat     |
| Anywhere                                                     | the cheese button in the top bar, or the "/" key on a desktop | the screen's main object |

The Board is a bottom sheet over the current screen, so the player keeps the place in view. A
long-press has a short "Board" label on the press point for discovery. A setting turns
long-press off for players who use it for text selection.

**Search box.** One field searches actions and targets together. "trust" lists every trust
action. "Imogen" lists Imogen and every action on a person. "storm" lists the Spin box with
"storm" already typed, plus the "Storm floods the Stacks" crisis from the kit deck. Search runs on
the client over the action catalog and the light `/people` and `/rooms` lists.

## 3. Two layers, one schema

- **Set** is direct: no AI, instant, exact. You pick a value and it is the value.
- **Spin** is planned: plain words go to the model, the model returns beats, the code checks
  them, and you see the plan before anything happens.

Both layers make the same thing: a **play**, which is a list of Board actions.

```json
{
  "verb": "person.feelings",
  "target": { "kind": "person", "id": "yusuf" },
  "input": { "trust": 70 },
  "when": "now",
  "silent": false
}
```

A Set play is one or more actions with `when: "now"`. A Spin play is up to 8 actions, each with
its own `when` and an optional scene line. The code validates both with the same verb list and
the same limits, and both go into the same journal.

### Action catalog

Every action works in Set. Actions marked "Set + Spin" can also be beats in a Spin plan. All
values are clamped to their range (meters, trust, stress, condition: 0-100).

**Place**

| Action           | Layer      | Inputs                                 | Effect                                                                                        |
| ---------------- | ---------- | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| Set meter        | Set + Spin | meter, value or delta                  | Endowment 49 → 70. Writes a point in the meter history with a Board mark.                     |
| Extra meter      | Set        | add, rename, remove, value; type       | Add "Rowing glory" (Standing). Max 2 extra meters, as in the kit rules.                       |
| Money now        | Set + Spin | amount                                 | A one-off gift or loss on the Money meter ("an anonymous donor").                             |
| Authority values | Set + Spin | Fear, Love, Legitimacy (absolute kits) | Valmora Legitimacy 12 → 40. Plot chance updates at once.                                      |
| Culture tags     | Set        | tag, level                             | Add "Family" 3, remove "Cutthroat".                                                           |
| Traditions       | Set + Spin | add, remove, count                     | Make "Friday cake" a tradition now (count 3). Removing one asks: "with outrage" or "quietly". |

**People**

| Action        | Layer      | Inputs                                                    | Effect                                                                          |
| ------------- | ---------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Feelings      | Set + Spin | trust (or Fear and Love), stress, mood of the day         | Yusuf trust 38 → 70, mood "great".                                              |
| Traits        | Set        | add or remove from the trait catalog (content.md §5)      | Cormac loses "hot-headed", gains "loyal".                                       |
| Ambition      | Set + Spin | ambition from the catalog or own words, progress 0-100    | Imogen progress 85 → 20. At 100 the person acts as normal.                      |
| Secret        | Set + Spin | text, who knows it (list of people, "boss")               | Give Barnaby Quill a new secret; let Mina know Cormac's betting.                |
| Relation      | Set + Spin | person A, person B, kind, level                           | Imogen and Cormac: crush 40. Kinds from design.md §8.                           |
| Status        | Set        | active, on leave, sick, quit, fired, banished, imprisoned | The statuses the kit and Tone dial allow.                                       |
| Move          | Set + Spin | room, until (slot or "rest of day")                       | Put Lady Cordelia in the Boathouse this afternoon.                              |
| Add person    | Set + Spin | name, role, traits, age, or a generated person            | A new bursar. A Spin can write the person; Set uses the add form.               |
| Remove person | Set        | person, how (leaves, vanishes)                            | "Leaves" makes a goodbye moment. "Vanishes" removes with no trace.              |
| Swap role     | Set        | person, new role                                          | Yusuf becomes Head of estates.                                                  |
| Make deputy   | Set        | person                                                    | Barnaby becomes deputy. The old deputy keeps their role or steps down (choice). |

**Threads and cards**

| Action          | Layer      | Inputs                                                         | Effect                                                            |
| --------------- | ---------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| Open thread     | Set + Spin | from a kit seed or own words; kind, people, need meter, stakes | "The Stacks roof" opens at severity 2. Own words go through Spin. |
| Change thread   | Set        | severity 1-3, clock (due week or "open"), people               | Push the strike clock from week 3 to week 6.                      |
| Close thread    | Set        | won, lost, dropped                                             | "Lost" applies the thread's loss effect from the code table.      |
| Force a beat    | Set + Spin | thread, beat                                                   | The next beat happens now instead of on its day.                  |
| Add a follow-up | Set + Spin | thread or card, weeks 1-3                                      | A worse leak in 2 weeks.                                          |
| Add a card      | Set        | asker, need, severity, own text or kit card                    | Put a signature card in today's inbox.                            |
| Reroll a card   | Set        | card                                                           | New words for the same seed.                                      |

**Time**

| Action             | Layer | Inputs                               | Effect                                                             |
| ------------------ | ----- | ------------------------------------ | ------------------------------------------------------------------ |
| Skip               | Set   | slots, days or weeks                 | Uses the normal skip-ahead batch and digest (design.md §12).       |
| Rewind a day       | Set   | 1-7 days                             | Restores the morning snapshot of that day.                         |
| Hours              | Set   | hours left today                     | Give the boss 2 more hours today.                                  |
| Pause storyteller  | Set   | on or off                            | No new draws until it is switched on. Threads stay where they are. |
| Storyteller preset | Set   | Calm, Classic, Chaos, Custom sliders | Applies from the next slot.                                        |

**Rooms and things**

| Action           | Layer      | Inputs                            | Effect                                                         |
| ---------------- | ---------- | --------------------------------- | -------------------------------------------------------------- |
| Condition        | Set + Spin | room, value                       | Boathouse 45 → 90.                                             |
| Open hidden room | Set        | room                              | Clock tower opens with no key.                                 |
| Add room         | Set + Spin | name, kind, feeds, condition      | A rooftop garden. Spin can write it; the code sets its effect. |
| Drawer items     | Set        | add or remove key, gift, document | Put the clock tower key in the drawer.                         |
| Evidence         | Set + Spin | about whom, which secret          | Evidence card of Odalys's tutoring fees.                       |
| Equipment        | Set        | item, condition                   | The marine lab pump works again.                               |

**Rules**

| Action     | Layer | Inputs                          | Effect                                                      |
| ---------- | ----- | ------------------------------- | ----------------------------------------------------------- |
| House rule | Set   | rule, option; own-words rule    | Bar licence "until 01:00", with no 1-hour cost and no vote. |
| Decree     | Set   | text, harshness (absolute kits) | A decree with no Love or Legitimacy cost.                   |
| Mutators   | Set   | each mutator on or off          | "Everyone hates you" on. Ironman: see §7.                   |
| Difficulty | Set   | Easy to Brutal                  | Applies from the next card.                                 |
| Feel dials | Set   | Tone, Realism, Era, Pace        | Same as the kit dials (README "Feel dials").                |

**Story layers and systems**

| Action           | Layer | Inputs            | Effect                                                                                                        |
| ---------------- | ----- | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Layer on or off  | Set   | layer, dial 0-100 | Romance on at 40, now. The Board skips the "start of week" wait (modules.md §2); the intro event still plays. |
| System on or off | Set   | system block      | Turn on Season. Removing keeps its state, as in modules.md.                                                   |
| Adult module     | Set   | on or off         |                                                                                                               |

**Cast** (details of reading cards, ages and memory are in cast.md)

| Action           | Layer      | Inputs                                                                                         | Effect                                                                                   |
| ---------------- | ---------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Insert character | Set + Spin | an Engine character card, role (staff, visitor, boss above you, partner), room, start feelings | The character joins with their card's voice. cast.md owns how the card becomes a person. |
| Insert persona   | Set + Spin | an Engine persona, role                                                                        | The same, for a persona. "Boss" swaps who the player is (cast.md).                       |
| Remove inserted  | Set        | person                                                                                         | The card stays in the Engine; only the person leaves the run.                            |

**Meta**

| Action       | Layer | Inputs                                 | Effect                                                                                                         |
| ------------ | ----- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Show numbers | Set   | on or off                              | Trust, stress and relation levels show on Staff files (design.md §8.1). The Board itself always shows numbers. |
| Reroll today | Set   | none                                   | New seeds and words for today's unanswered cards.                                                              |
| Edit the kit | Set   | opens the Kit editor for the run's kit | Changes apply to this run and are one play in the journal.                                                     |

## 4. Spin in depth

### Inputs

The Spin box takes one line up to 600 characters. The target from the long-press is sent with
it, so "falls for Cormac" from Imogen's file means Imogen.

| Player writes                                 | Plan (short)                                                                                                                                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Imogen falls for Cormac"                     | 4 beats over 2 weeks: a late talk at the Boathouse, Yusuf notices, a crush (Imogen → Cormac, medium), a thread "Imogen and Cormac" with stakes for the deputy's focus. Needs Romance on. |
| "A storm floods the boathouse next week"      | 3 beats: Monday weather "storm", Tuesday Boathouse condition big drop, a thread "Boathouse flood" (need Campus mood, severity 2). Cormac asks for money on Wednesday.                    |
| "Make the union strike unless I fix pay"      | A thread "Union strike" with a 2-week clock and a win condition (answer the pay card with `invest`), Mina's ambition progress up, one grapevine beat.                                    |
| "Bring my persona's sister as the new bursar" | Insert person: a new bursar written from the persona's lore, Teodor Vance moves to "on leave" or stays (the preview asks). One arrival scene on Monday.                                  |

### The planner task `board.plan`

One model call. Input:

- the Spin text and the target;
- a short run summary: clock, meters, people (id, name, role, traits, age class), rooms, open
  threads, layers on, Adult on or off, themes;
- the verb list with each verb's inputs and the size words.

The verb list includes `scene.big` with a one-line premise. The code builds that big scene from
the `free` blueprint (design.md §3.8). It counts as a scene the player asked for, so it is outside
the storyteller's weekly big-scene budget. It still costs 2 hours and shows in Coming up with its
parts and hours.

The model never writes a number. It picks a **size** (`small`, `medium`, `big`) and the code turns
it into a number with the severity scale k = 3 / 6 / 10 (content.md §1). The player can change
any number in the preview.

```json
{
  "summary": "Imogen starts to fall for Cormac over two weeks.",
  "question": null,
  "cant": [],
  "thread": {
    "kind": "romance",
    "title": "Imogen and Cormac",
    "people": ["imogen", "cormac"],
    "need": "people",
    "stakes": "Imogen's work slips if this goes wrong",
    "clock": "open"
  },
  "beats": [
    {
      "id": "b1",
      "when": { "week": 3, "day": 2, "slot": "evening" },
      "verb": "scene.small",
      "who": ["imogen", "cormac"],
      "touches": { "room": "boathouse" },
      "scene": "Imogen stays late to check the boat budget. Cormac makes her laugh."
    },
    {
      "id": "b2",
      "when": { "week": 3, "day": 4, "slot": "midday" },
      "verb": "relation.shift",
      "who": ["imogen", "cormac"],
      "touches": { "relation": { "kind": "crush", "size": "medium" } }
    },
    {
      "id": "b3",
      "when": { "week": 3, "day": 5, "slot": "midday" },
      "verb": "grapevine.line",
      "who": ["yusuf"],
      "scene": "Yusuf has seen the deputy at the Boathouse twice this week."
    },
    {
      "id": "b4",
      "when": { "week": 4, "day": 1, "slot": "morning" },
      "verb": "person.feelings",
      "who": ["imogen"],
      "touches": { "stress": { "size": "small" } }
    }
  ]
}
```

`question` is set when the words are unclear, for example "Fix pay for whom: porters or
lecturers?". The player answers in one line and the plan runs again. `cant` lists parts the
model could not plan, with a reason the UI shows.

### Validation by code

The code checks every plan before the preview. Model text that breaks a rule is dropped with the
beat it belongs to; the preview names what was dropped and why.

| Check        | Rule                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------- |
| Verbs        | Only verbs in the Board verb list. Unknown verb = beat dropped.                           |
| Targets      | Every id exists, or is a new person or room made in the same plan.                        |
| Size         | Only `small`, `medium`, `big`. The code sets the number.                                  |
| Limits       | Max 8 beats per play. Beats from now up to 8 weeks ahead (one term). Text 600 characters. |
| Adult module | Adult beats only when the module is on and that theme is on.                              |

One fix-up retry with the error list. If the retry also fails, the play is not made: "The planner
could not make this plan: <reason>. Nothing changed." The Board then lists Set actions that match
the words, by keyword search with no model call.

### Preview, remove, "Play it"

The preview is a list of beat cards in time order. Each card can be removed with its "x". The
player can tap a number to change it, or tap the time to move the beat. "Play it" makes the play.
"Cancel" leaves no trace and no cost.

## 5. Truth, journal and Coming up

### The preview tells the truth

Every preview card shows four things:

1. **What:** "Yusuf: trust 38 → 70" or "Boathouse: condition 45 → 14".
2. **When:** "now" or "Week 3, Tuesday, evening".
3. **Numbers:** always, even when "Show numbers" is off for the rest of the game.
4. **Rewind note:** "You can rewind this from the journal." For Spin: "Beats that already
   happened go back too."

When a beat touches something that will cause more (a meter below 10, deputy ambition at 100),
the card says so: "Endowment 8: a board hearing starts on Friday if it stays below 10."

### The journal

The journal lists every play, newest first: time, layer, a short summary, who and what it
touched, and its state (done, partly done, scheduled, rewound).

- **Rewind to before this play.** Restores the snapshot taken just before the play. Everything
  after it goes too: later plays and the game time played since. The confirm sheet lists them:
  "This also rewinds 3 later plays and 2 days of play (Tuesday, Wednesday)."
- **Revert values** (Set plays only). Writes the old values back as a new Set play, and keeps the
  time played since. The journal stores before and after values for every Set field, so this is
  exact. If a value changed again since, the sheet shows both and lets the player pick.
- Rewound plays stay in the journal, grey, with "Redo" while no new play was made after the
  rewind.

### Coming up

One timeline of everything scheduled, grouped by day:

- beats from Spin plays,
- wishes on their way (design.md §3.7),
- thread beats and clocks (strike due week 6),
- follow-ups and scheduled meetings.

Each row has **Move** (pick a new slot), **Change** (edit people, size or text, with the same
validation), **Cancel** and **Run now** (force it). Every change is a small play in the journal, so it
can be rewound too. Rows from the storyteller (not from the player) show a small "storyteller"
tag; they can be changed the same way.

## 6. The fiction adapts

People react to a Board play in character, but they never refuse it, deny it or undo it.

- After a play, the code adds a **reason seed** for each changed person to the next ambient
  batch or scene prompt (no extra model call). A trust jump of 15 or more, a mood change, a new
  relation, a moved person or a new secret gets one in-world reason line. Example: Yusuf trust
  38 → 70 gives "Yusuf heard you stood up for the porters at the trustees' meeting."
- The reason line also becomes a memory (weight 1), so later callbacks fit the new value.
- A Spin beat is a real event. People talk about the storm, the strike, the new bursar as if the
  place made it.
- Prompts carry the rule "this is true now; react in character". The scene validator rejects
  lines that say the change did not happen. People may still dislike it: Imogen made deputy
  again after a demotion is cool to you.

**Silent edit** (a switch on every Set play): no reason line, no memory, no grapevine. The new
values are true at once. Use it for fixes and tests.

## 7. Honest runs, Sandbox, Ironman

Cheats never punish. The Board is always free, with no wish points, no cooldown and no fake
budget. The only cost note is the real one: "Spin uses one call on your AI connection."

| Mode                     | Board                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Normal run (default)     | Board open. Achievements still count. No mark.                                                                                            |
| **Honest run** switch on | Board open. The first play shows a one-time sheet: "This adds a small cheese mark to the title card, and achievements stop for this run." |
| **Sandbox**              | Board always open and pinned in the bottom bar. No firing, no hearing. No mark.                                                           |
| **Ironman** mutator      | Board closed. Opening it offers "End Ironman for this run". After that the run is a normal run and stays one.                             |

Rewinding a play never removes the cheese mark of an Honest run. A failed or cancelled plan is
not a play, so it adds no mark.

## 8. Data

### Journal entry

```json
{
  "id": "p57",
  "at": { "week": 3, "day": 2, "slot": "afternoon", "revision": 412 },
  "layer": "spin",
  "text": "Imogen falls for Cormac",
  "summary": "Imogen starts to fall for Cormac over two weeks.",
  "silent": false,
  "actions": [
    {
      "verb": "relation.shift",
      "target": { "kind": "relation", "a": "imogen", "b": "cormac" },
      "input": { "kind": "crush", "delta": 6 },
      "when": { "week": 3, "day": 4, "slot": "midday" },
      "beatId": "b2",
      "state": "scheduled",
      "before": null,
      "after": null
    }
  ],
  "threadId": "t19",
  "snapshotId": "s57",
  "state": "scheduled",
  "rewoundBy": null
}
```

`before` and `after` are filled when an action runs. They make **Revert values** exact.

### Snapshots

- Before each play, the code saves a copy of the run document. The run document is small (meters,
  people values, relations, rooms, threads, clock), so a full copy is cheaper and safer than
  diffs.
- Snapshots live in a child document per run (`board-snapshots`), so the summary and other light
  routes never load them.
- Keep the last 50 plays' snapshots. When a 51st arrives, the oldest becomes the **base
  snapshot**: the earliest point the Board can rewind to. Plays before the base stay in the
  journal as text with "Revert values" only.
- Large text child documents (scene logs, grapevine, chronicle) are not copied. They are
  append-only, and the snapshot stores their revision numbers. A rewind hides entries written
  after those revisions.
- One morning snapshot per day, last 7 kept, for "Rewind a day" and the normal daily undo.
- A rewind writes through the per-run queue with `expectedRevision`, like every other write.

### Routes

| Route                       | Method      | Purpose                                                                                                             |
| --------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `/runs/:id/board/preview`   | POST        | `{ actions }` (Set) or `{ text, target }` (Spin) → validated preview with numbers. Spin calls `board.plan`.         |
| `/runs/:id/board/play`      | POST        | `{ previewId, edits, silent, expectedRevision }` → snapshot, apply "now" actions, schedule the rest, journal entry. |
| `/runs/:id/board/rewind`    | POST        | `{ playId, mode: "rewind" \| "revert", confirmLater }` → restore or revert.                                         |
| `/runs/:id/board/journal`   | GET         | paged journal entries.                                                                                              |
| `/runs/:id/board/coming-up` | GET / PATCH | the timeline; PATCH moves, changes, cancels or forces one row.                                                      |

A preview is kept for 30 minutes. "Play it" on an old preview, or after the run moved on, makes a
fresh preview instead and shows what changed.

### Model task `board.plan`

| Field     | Value                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------- |
| When      | Spin "Plan it"                                                                                        |
| Input     | text, target, run summary, verb list                                                                  |
| Output    | the JSON in §4                                                                                        |
| Budget    | the shared model helper: room for reasoning models, retry on `length` and on empty answers            |
| Validator | §4 table; one fix-up retry                                                                            |
| Lite mode | short run summary (only people and rooms named in the text and the target)                            |
| Fallback  | no plan, nothing changed; keyword list of Set actions. The Set layer needs no model and always works. |

The calls go into the `/calls` debug log like every other task.

## 9. Screens

Phone first. All targets 44 px or more. All copy in locale files (`board.*` keys). Colours and
spacing from theme tokens only.

```
+--------------------------------------+
| Cheese Board                  [Close]|
| [ Search actions, people, rooms... ] |
| Target: Yusuf Karim  (x)             |
| Recent: Imogen . Boathouse . Strike  |
|--------------------------------------|
| [ Set ]  [ Spin ]                    |
|--------------------------------------|
| Feelings     trust 38  stress 55  >  |
| Ambition     Keep the old ways 40 >  |
| Secret       knows: you, Imogen   >  |
| Relations    3                    >  |
| Status . Move . Role . Deputy     >  |
|--------------------------------------|
| [ Journal ]          [ Coming up 4 ] |
+--------------------------------------+
```

- **Set tab:** groups for the target (Place, People, Threads, Time, Rooms, Rules, Layers, Cast,
  Meta). Without a target, the groups list all. Numbers use steppers and sliders with the exact
  value in a field; no raw JSON.
- **Spin tab:** one text box with the target as a chip, 3 suggestions from the open threads
  ("Make the strike happen sooner"), and "Plan it".
- **Preview sheet:** beat cards (what, when, numbers, rewind note), "x" on each card, a Silent
  edit switch for Set plays, "Play it" and "Cancel". A loading state for Spin says "Planning...",
  and a failure says why and offers the Set list.
- **Journal:** rows with time, layer icon, summary; tap opens the entry with "Rewind" and
  "Revert values".
- **Coming up:** a day-grouped list; each row has Move, Change, Cancel, Run now.

On a wide screen the Board is a right-hand panel instead of a bottom sheet.

## 10. Slices

| Milestone   | Board parts                                                                                                                                                    | Why then                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| M1 Playable | Board shell from More and long-press, search, Set for meters, feelings, cards, time (skip, hours, rewind a day), journal with snapshots, rewind and revert     | Helps every playtest and bug report: set up a state in one minute, then rewind. |
| M2 Alive    | Spin with `board.plan`, preview with beats, Coming up, threads (open, change, close, force), relations, secrets, ambition, rooms, reason seeds and Silent edit | Threads and the storyteller arrive in M2; Spin needs them.                      |
| M3 Yours    | Cast insert (with cast.md), layer and system switches, Adult module switch, rules, decrees, dials, mutators, Honest run, Sandbox, Ironman                      | Follows the kit editor, modules and Sandbox slices.                             |
| M4 Lasting  | Drawer, evidence, equipment, hidden rooms, culture and traditions, authority values for all kits, Edit the kit from the Board, Redo                            | Follows the M4 systems they touch.                                              |

Each part needs one runnable check: validator cases (unknown verb, too
many beats), and a rewind check (play, advance a day, rewind, compare with the snapshot).

## 11. Open questions

1. Should a Normal run also show the cheese mark, or only an Honest run?
2. Is 8 weeks the right Spin horizon, or the whole year (24 weeks)?
3. Should "Rewind" also be offered from a toast right after a play, as a shortcut to the journal
   entry?
4. Should "Remove person: vanishes" exist at all, or must every removal leave a goodbye moment?
