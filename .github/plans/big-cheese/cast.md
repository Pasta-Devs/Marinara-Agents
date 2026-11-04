# Big Cheese: your cast

Your own Engine characters and personas inside the game. This file covers where they come in, how a card becomes a game person, and what can go back to the Engine. Numbers and traits come from [content.md](content.md). The cheat menu is in [cheese-board.md](cheese-board.md).

## 1. Why

Big Cheese runs inside Marinara, and Marinara players already have characters they love. A management game is only a game. A game where _your_ Rhea coaches the rowing crew, remembers that you cut her budget, and gossips about you in The Bilge is the reason to play it here and not anywhere else.

**Promise:** "Bring your people. They stay themselves, they remember you, and nothing leaves the game unless you say so."

**Pillars**

| #   | Pillar                           | What it means                                                                                              |
| --- | -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Your character stays themselves  | Voice, looks and history come from the card. The kit gives them a job, not a new personality.              |
| 2   | The game never rewrites the card | Big Cheese only reads cards. It writes nothing back on its own.                                            |
| 3   | You decide what goes back        | Memories, places and notes go to the Engine only from an export sheet, one tap per item, with a preview.   |
| 4   | Same rules as everyone           | A cast person uses the same numbers, traits and stances as a generated one. |

## 2. Where cast can come in

| Moment             | What the player does                                                                                           | Example                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| The wish           | Picks a persona as the boss and up to 3 cards as staff (M1).                                                   | Persona "Wren Calloway" becomes the new Provost of Hollowmere.                                                               |
| Preview            | Swaps any generated person for a card, keeping the role.                                                       | Replace Cormac Dunne with "Rhea" as head of rowing, or keep Cormac and add Rhea as his assistant coach.                      |
| Mid-run hire       | Hires a card as a new person through the normal hire flow.                                                     | Rhea joins in week 3 as rowing coach. Cormac now has a rival on the quay.                                                    |
| Mid-run visitor    | Brings a card in for a scene or a few days.                                                                    | Rhea's old crewmate visits for the Boat Race.                                                                                |
| Story roles        | Casts a card into a thread role: old flame, rival boss, inspector.                                             | Your character "Silas" is the new head of Carrow College, the rival. Another card is the Education Quality Agency inspector. |
| Cheese Board       | Inserts any card at once, no hire cost (see [cheese-board.md](cheese-board.md)).                               | "Put Rhea in the boathouse, tonight."                                                                                        |
| Partner and family | Casts a card as the boss's partner, child or parent. Needs the Romance, Adult or Family layer (modules.md §2). | Your character "June" is the Provost's partner who lives in town.                                                            |

### The persona as the boss

The persona fills the boss sheet (modules.md §4, "The boss as a character").

| Persona field           | Boss sheet                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| Name                    | Name. The epithet ("The Iron Provost") is earned in play as usual.                          |
| Description, appearance | Look and short backstory. Summarized to 3-4 lines.                                          |
| Pronouns                | Used in every prompt and grapevine line. If missing, the casting sheet asks. Never guessed. |
| Avatar                  | Boss portrait.                                                                              |
| Personality text        | Read by `cast.read` into 2 boss traits from content.md §5.                                  |

The persona's traits shape how people react, the same way the "Former soldier" Provost works today. A `charming` boss gets warmer first meetings. A `strict` one gets respect from Yusuf and jokes from the students. Without a persona, the player fills the boss sheet by hand as before.

## 3. Casting: card to game person

### Fields read

Big Cheese reads one card only when the player picks it. From `resources.listCharacters([id])` it reads `data`:

| Card field              | Used for                                     |
| ----------------------- | -------------------------------------------- |
| name                    | Name. Never changed.                         |
| description, appearance | Look line, portrait prompt if images are on. |
| personality             | Traits, voice sheet.                         |
| scenario, backstory     | Ambition, secret suggestion, routine hints.  |
| tags                    | Role fit hints, picker filters.              |
| avatar (`avatarPath`)   | Portrait.                                    |

The card's `data` is untyped, so every field is optional. A missing field means the sheet shows an empty slot to fill, not an error.

### `cast.read` model task

One model call per card, through the shared model helper (JSON extract, validator, one fix-up retry, template fallback).

Input: the card fields above, the place kit summary, open roles, the trait catalog (content.md §5), ambition and secret lists (content.md §6).

Output:

```json
{
  "core": "Rhea Sand, 34. Former Olympic rower, blunt, protective of her crew, hates losing more than she loves winning.",
  "roleFit": [
    { "role": "Head of rowing", "why": "Rowing career in the backstory" },
    { "role": "Head porter", "why": "Ran a boathouse yard" }
  ],
  "traits": ["hot-headed", "loyal"],
  "ambition": "Win the national cup",
  "secretSuggestion": "Was banned for one season and never told anyone why",
  "voice": {
    "tone": "short, dry",
    "sample": "Again. And this time, row like you mean it.",
    "likes": ["sport", "honesty", "early mornings"]
  },
  "routine": { "morning": "boathouse", "afternoon": "marine lab quay", "evening": "The Drowned Bell" },
  "age": { "value": 34, "source": "description" }
}
```

Rules the code checks:

- `traits` must be 1-2 ids from the fixed catalog. Unknown ids are dropped. The numbers come from the catalog, never from the model.
- `ambition` must be from the ambition list or a free line mapped to one. `secretSuggestion` is only a suggestion. The player keeps, edits or removes it.
- `voice.sample` must quote or paraphrase the card. The kit's voice line is never used for a cast person.
- `age.value` is only kept when the card states it. The model may not guess an age (see §4).
- Rooms in `routine` must exist in the kit. Unknown rooms fall back to the role's default room.

**Big cards.** Cards over about 2,000 tokens are summarized first, inside the same call. The run keeps `core` (at most 60 words) for every prompt, and the full voice sheet for scenes with that person. Prompts never carry the whole card.

### Casting sheet

The player sees the result before confirming. Everything is editable.

| Field            | Edit                                                                         |
| ---------------- | ---------------------------------------------------------------------------- |
| Role             | Pick from roleFit, any open role, or a new role (new person, not a swap).    |
| Traits           | Change 1-2 from the catalog chips.                                           |
| Ambition, secret | Pick, type, or leave empty.                                                  |
| Voice sample     | Edit the line.                                                               |
| Routine          | Pick rooms per slot.                                                         |
| Age              | Shown with its source.                          |
| Starting numbers | trust, stress as normal starts. Change only with the "Show numbers" setting. |

**How the role is picked.** At the wish and on mid-run hire, the AI suggests the best role in this place first (top of `roleFit`). The player can choose any other. On a Preview swap the role is fixed by the slot. On the Cheese Board the player can drop a card anywhere without a sheet ("Quick cast" uses the AI's first suggestion and skips the sheet).

## 4. Rules

- **Professor Mari** (the Engine's built-in assistant) is never cast. The picker leaves her out, and the cast route refuses her id.
- **Many runs, separate memories.** The same card can be in many runs. Each run keeps its own memories, relations and numbers. Rhea at Hollowmere does not know Rhea on the Salt Magpie.
- **Refusals still work.** A cast person reacts in character like everyone else. The card shapes how they react, not whether the game obeys.

## 5. Images

| Case               | Portrait                                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card has an avatar | The card avatar, read through `avatarPath` on HTTP `/api/characters/:id`.                                                                                                  |
| No avatar          | Initials on a role colour, same as generated people.                                                                                                                       |
| Images switched on | New portraits only through the existing HTTP route `POST /api/characters/avatar-generation`, prompted from the look line. The card avatar is never replaced in the Engine. |

## 6. Back to the Engine

Nothing goes back on its own. The export sheet shows each item with a preview and its own button.

| Feature                                                                   | API                                                                          | Works today?                                                             | Engine change needed                        | Fallback                                                                                |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| (a) Run memories as a lorebook                                            | `resources.createLorebook`, `bulkCreateLorebookEntries`                      | Yes                                                                      | None                                        | -                                                                                       |
| (b) The place as a lorebook                                               | same                                                                         | Yes                                                                      | None                                        | -                                                                                       |
| (c) Persona note ("What happened at Hollowmere")                          | `resources.updatePersona`                                                    | Yes, opt-in                                                              | None                                        | -                                                                                       |
| (d) Make a character card from a generated person                         | `resources.createCharacter`                                                  | No (only HTTP `POST /api/characters`, no contract, no gate)              | Add `createCharacter` to the capability API | Export a V2 card file (JSON, or PNG with embedded data) that the player imports         |
| (e) Call someone (normal chat with that character and the run's lorebook) | needs chat creation in the capability API and a host `openChat(chatId)` call | No (HTTP `POST /api/chats` exists, no navigate call in the host overlay) | Both                                        | Parked. Show "Copy chat setup": character name, lorebook name and a first line to paste |

Details:

- **(a) Memories lorebook.** One entry per person with their memories of the boss and the key events, keyed on their name. Example entry: "Rhea Sand: coached Hollowmere to the national cup in year 2. Never forgave the Provost for selling the old boat."
- **(b) Place lorebook.** Rooms, groups, outside places, traditions, as entries. Adult scenes are left out unless the player ticks them (README: adult scenes never go into exports unless the player chooses).
- **(c) Persona note.** A short block of 2-4 lines added to the persona description, between clear markers so the player can find and remove it. The name is never changed. The sheet shows the full new description before saving.
- **(d) Make a character card.** Card fields come from the person: name, look, voice sheet, traits as personality text, backstory from memories. Works for generated people only. A cast person already has a card.
- **(e) Call someone.** Uses (a) and (b) as the attached lorebook. This is the "Call someone" crossover from the README M4 slice.

## 7. Data

### Cast link in the run document

Each cast person in `people` gets a `cast` block:

```json
"rhea": {
  "trust": 50, "stress": 15, "traits": ["hot-headed", "loyal"],
  "cast": {
    "source": "character",
    "engineId": "char_8f2c",
    "castAt": { "week": 3, "day": 1 },
    "cardHash": "sha256:4be1...",
    "snapshot": { "name": "Rhea Sand", "core": "Rhea Sand, 34. Former Olympic rower...", "voice": { "tone": "short, dry", "sample": "Again..." }, "look": "Tall, sun-bleached hair, crew jacket", "age": 34, "ageSource": "card", "avatarPath": "/avatars/char_8f2c.png" }
  }
}
```

The boss gets the same block with `"source": "persona"` and `personaId`.

- The run uses only the snapshot. If the card changes or is deleted, the run keeps working. A deleted card keeps its snapshot and loses only the "From your library" link.
- **Refresh from card.** On the Staff file, when the hash differs, a small "Card changed" chip offers "Refresh from card". It runs `cast.read` again and shows a casting sheet with old and new side by side. Memories, relations and numbers stay. A refresh that lowers or removes the age runs the age check again.

### Privacy

- The picker list asks only for what it shows: name, avatar, tags, a short line. It does not read full cards.
- Full card fields are read only for the cards the player picks, at the moment they pick them.
- No bulk reading of the library, no background scans, no copies of cards that were not cast.
- Card text sent to the model is only the fields in §3, for `cast.read`. After that, prompts carry the snapshot `core` and voice.

## 8. Screens

Phone first, 44 px targets, theme tokens.

**Cast picker** (bottom sheet)

```
[ Search your characters...      ]
Recent:  (Rhea) (Silas) (June)
Tags:    [rowing] [noble] [rival] [+]
------------------------------------
[o] Rhea Sand       rowing, sport    [x]
[o] Silas Marr      noble, rival     [ ]
[o] June Okoye      romance          [ ]
------------------------------------
        [ Cast 1 person ]
```

Multi-select up to 3 at the wish, one at a time elsewhere. A "Personas" tab lists personas for the boss slot.

**Casting sheet**

```
(avatar) Rhea Sand        From your library
Role:   [Head of rowing v]  suggested
Traits: (hot-headed) (loyal)        [edit]
Wants:  Win the national cup        [edit]
Secret: Banned one season...  [keep][x]
Voice:  "Again. And this time..."   [edit]
Age:    34 (from card)
        [ Back ]     [ Confirm ]
```


**Badges.** Cast people show a small "From your library" badge on the staff list, the Staff file and scene headers. The boss card shows "Your persona".

**Export sheet** (from the run menu, "Take it home")

```
Take it home: Hollowmere, year 2
[ ] Memories lorebook   (12 people)   [preview]
[ ] Place lorebook      (9 rooms)     [preview]
[ ] Note on persona "Wren"            [preview]
[ ] Card file: Teodor Vance  (download)
    Call someone            (coming later)
          [ Send selected ]
```

## 9. Model tasks and routes

| Task        | When                                 | Input                                                          | Output            |
| ----------- | ------------------------------------ | -------------------------------------------------------------- | ----------------- |
| `cast.read` | player confirms a pick in the picker | card fields, kit summary, open roles, trait and ambition lists | casting JSON (§3) |

| Route                           | Method | Purpose                                                                                                                      |
| ------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `/cast/characters`              | GET    | picker list: id, name, avatar, tags, one short line. Light, paged, search.                                                   |
| `/cast/personas`                | GET    | persona list for the boss slot.                                                                                              |
| `/cast/read`                    | POST   | run `cast.read` for one picked card, return the casting sheet.                                                               |
| `/runs/:id/cast`                | POST   | insert or swap: `{ engineId, role, mode: "swap" or "hire" or "visit" or "board", sheet }`. Goes through the run write queue. |
| `/runs/:id/cast/:pid/refresh`   | POST   | refresh from card.                                                                                                           |
| `/runs/:id/export/lorebook`     | POST   | memories or place lorebook.                                                                                                  |
| `/runs/:id/export/persona-note` | POST   | persona note.                                                                                                                |
| `/runs/:id/export/card`         | GET    | V2 card file for a generated person (fallback for d).                                                                        |

At the wish, `cast.read` runs once per picked card before `place.draft`, and the drafted kit treats cast people as fixed slots.

## 10. Permissions

Big Cheese declares only what it uses. Resource reads and model calls have no permission check in the Engine today, but Big Cheese still reads cards and personas only on a player action (opening the picker, confirming a pick, refreshing). Lorebook and persona writes happen only from the export sheet. When the Engine adds gates for resources, the manifest already lists the right ones.

## 11. Slices

| Milestone   | Cast work                                                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M1 Playable | Persona as the boss. Up to 3 cards as staff at the wish. Picker, casting sheet, `cast.read`, age check, cast link and snapshot, badges, card avatar. This is the main hook, so it ships with the first loop. |
| M2 Alive    | Swap on Preview, hire a card mid-run, visitors, story roles (old flame, rival boss, inspector), refresh from card.                                                                                           |
| M3 Yours    | Cheese Board insert, memories and place lorebook export, persona note, partner and family casting with the layers.                                                                                           |
| M4 / Engine | Make a character card (fallback card file can ship in M3), Call someone. Both wait for the Engine changes in §6.                                                                                             |

## 12. Open questions

1. At the wish, should cast cards take kit slots (Rhea replaces Cormac) or be added on top (the place gets one more person)?
2. Should the persona note (c) be offered at the end of every term, or only from the export sheet?
3. Can a cast person be fired, die in a crisis or leave the story, or should the game protect them unless the player allows it in settings?
4. Should the export card file (d fallback) be JSON only, or also PNG with the card data embedded?
