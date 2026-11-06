# Meanwhile: characters live while you are away (concept v3)

Status: concept for review, 2026-11-04. No code, no issue, no PR.
Build plan: `plan/background-simulation-plan.md`.

**2026-11-06: merged into Kitchens.** 0.1.0 is the prototype. Meanwhile becomes the "Time" feature of a Kitchen (Engine core, Marinara-Engine `feat/kitchens`, `docs/development/kitchens-plan.md` § "Time: Meanwhile in a Kitchen"). The Circle goes away; events become Kitchen memory scenes; Meanwhile 0.2 follows Kitchens slice 3. Add no more Circle features until then.

Decided 2026-11-04:
- Name **Meanwhile**, package id `meanwhile` (`background` is taken by the scene-background package).
- Clock: real time, fast forward, and a time and speed you can set.
- Only big events wait for your OK. Small events are accepted on their own.
- Sentinel is a sibling. Neither package depends on the other.

v3 changes: the payoff moves into the chat (hooks, mention once, diary); "Life" is renamed **Circle**
(Modern Life Sim already owns "Life Sim"); added chat promises, privacy per chat, code-dealt beat seeds,
who-meets-whom rules, long-absence rule, small-model JSON rules; checked every Engine hook (see the plan).

## The idea in one line

Your characters keep living when no chat is open. When you come back, they have something to tell you,
and they tell it themselves, in the chat, once. You can also say "let 3 days go by".

## Why it is fun (the payoff)

A timeline of "went to the gym" is a log. Nobody reads it twice. Meanwhile pays off in three places:

1. **In the chat.** Each return gives every character at most one **hook**: "got a job offer",
   "had a fight with Mia", "found a stray cat". The character brings it up in their own words, once,
   when it fits. After that it is only a memory.
2. **"Pick up this thread".** A hook card has a button. It starts the topic in the chat or opens a new
   chat with that scene as the opener.
3. **The diary.** Each character keeps a short diary in their own voice (one line per notable moment).
   It reads better than a timeline and costs nothing extra: the same model call writes it.

The dashboard is where you steer. The chat is where you get the result.

## Engine agent, Home Screen agent or chat agent?

All three, as one package with one core:

| Part | What it does | Engine hook (checked on `staging`) |
|---|---|---|
| **Core (server)** | Clock, cast, ledger, beat generator, catch-up, fast forward | package `activate()` + own `setTimeout` loop with cleanup; `languageModels`; `listCharacters`, `listChats`, `listMessages` |
| **Home tab** | Setup and control, timeline, diary, review, fast forward | `home-browser-tab` slot, routes under `/api/meanwhile/...` |
| **Chat agent** | Adds "since you last talked" to the prompt of linked chats | `registerPromptContext` (runs on each generation, read-only, 2 s limit) |

No Engine change is needed for the first release.

## How it differs from what exists

| | What it is | Meanwhile is not |
|---|---|---|
| **Modern Life Sim** | a town game you play in its own tab, with its own clock and NPCs | a second town game. Meanwhile is the off-screen life behind your normal chats. We take its rule "code decides, the model writes the words". |
| **Engine autonomy** | characters text first after you are idle (conversation mode) | a second messenger. Meanwhile never sends messages. It gives the existing loop something true to talk about. |
| **Slurp2 world tick** | a social-media world that catches up while you are away | a social sim. We copy its catch-up pattern (mark, clamp, lease, backoff). |
| **Sentinel** | secret threads inside one roleplay, in story time | Meanwhile is real time, across chats, and open to see. |

## Core concepts

### 1. A Circle (the scope)
One character card is often used in many chats with different universes. The simulation never runs on
"a character". It runs on a **Circle**:

- **cast**: the characters who live in it (each on or off),
- **setting**: one paragraph (from a chat, a lorebook or free text),
- **linked chats**: the chats that belong to this Circle. They feed it and get its hooks,
- **clock**: see below,
- **connections**: which other agents it reads from and writes to.

You can have one Circle ("my friends in Berlin") or several ("fantasy party", "office AU").
A character can be in several Circles; each Circle has its own history.
Characters with only a card and no chat yet can be in a Circle.

### 2. You are not in the simulation
Your persona does not take part in simulated events. Meanwhile never writes what you said or did.
You appear only as someone the characters think about: "wants to tell you", "bought you a snack".
This keeps your own choices yours.

### 3. The clock
Each Circle has its own clock:
- **Real time** (default): Circle time runs with the wall clock and the Circle's timezone.
- **Fast forward**: jump hours or days now.
- **Set time and speed**: set the Circle date and time, and a speed (x1, x24 = one day per real hour, x0 = paused).

Two rules keep this safe:
- **The clock always moves the full distance. Only the content is clamped.** Away for two weeks at x24
  (336 Circle days)? The last 3 days get beats. Everything before that becomes one short
  **summary** event ("Autumn passed quietly. Lily started her new job.").
- **The cost budget counts model calls per real day**, not per Circle day. Speed cannot burn tokens.

### 4. The ledger
An append-only list of **events** per Circle. Everything else (hooks, diary, prompt context, status, writes to
other agents) comes from accepted events. Every event knows where it came from, who may know it,
and what it wrote elsewhere, so it can be undone. The data shape is in the plan.

### 5. The chat is the truth
- No event can start before the last message in a linked chat with that character.
- **Promises in chat become plans.** Before each run, one cheap pass reads the newest messages of linked
  chats and pulls out plans and stated facts ("I'm seeing Mia tomorrow", "I quit smoking"). The
  generator must honour them.
- If you edit or delete the message a promise came from, events built on it are marked `stale` and
  leave the prompt.

### 6. Privacy between chats
Every event and promise has a **visibility**: the whole Circle, or one chat. A secret told in chat A stays in
chat A's context, unless you mark the Circle as one shared world. Default: shared world for a Circle
you create from one chat; per-chat for a Circle that links chats created separately.

### 7. Code decides, the model writes
- **Routine** (free): the character's week schedule fills the day.
- **Beat seeds** (free): code deals 2 to 5 seeds per day from a deck: kind x who x place, with cooldowns,
  so Tuesday is not "coffee with Mia" every week.
- **Who meets whom** (free): pairs come from overlapping schedule blocks at the same place, weighted by how
  close they are (relationship tracker when present), plus one random pair per week.
- **Words** (one model call per Circle per day): the model turns the seeds into short events, diary lines,
  hooks and texts between characters. It never picks the weight; the seed does.

### 8. Big events
Death, breakup, pregnancy, moving away, job loss, serious injury. The deck deals them only when you allow
that kind. They arrive as `proposed` and wait for your OK. While one waits, that character's life runs on
routine only, so nothing builds on an undecided event. A pending event is dropped after 7 Circle days.

### 9. Tone
- **Pace**: Cozy (default), Eventful, Dramatic. It sets the deck mix and how many beats per day.
- **Allowed kinds**: work, friends, family, romance, conflict, health, luck, hobbies, spicy.
- **Spicy** events follow the Engine's adult-content setting, are written fade-to-black, and never show on the Home widget.
- **Nudges** (later): "This week Lily gets a job offer". A nudge becomes a planned seed.

## What you see

1. **Circles**: each with one line: "4 people · 2 days caught up · 3 new hooks".
2. **Now**: a card per character with what they are doing now and their newest hook.
3. **Hooks**: the "while you were away" cards, each with "Pick up this thread".
4. **Diary**: per character, newest first.
5. **Timeline**: per day, filter by person and kind. Veto or edit any event.
6. **Waiting for you**: big events to accept or veto.
7. **Fast forward**: days, a preview of model calls and what will be written where, then run.
8. **Setup**: cast, setting, linked chats, clock, pace, allowed kinds, connections.

## Connections (read and write, each a switch)

| Agent | Read | Write |
|---|---|---|
| Character card + schedule | personality, week schedule | — |
| Linked chats | newest messages (promises, chat-truth times) | prompt context only |
| Character status (conversation chats) | — | "what they do now", only at x1 speed |
| Long-Term Memory | recall for context | diary-level facts, retractable (needs LTM to accept `meanwhile` as a caller) |
| Relationship Tracker | who is close to whom | — (no write API exists) |
| Slurp2 | creator and recent posts | a post idea from a beat (`slurp2:actions` `add-idea`), later |
| Noodle | recent feed | — (no write service exists) |
| World State | in-story date and weather | — |

Writes to other agents only come from accepted events and wait 24 hours, so a veto can still stop them.

## Ideas for later

- **Phone view**: short texts the characters sent each other, made in the same call.
- **Monday paper** for the Circle (Modern Life Sim has a NEWS pattern).
- **Saved for you**: a thing or photo idea a character kept to show you (Illustrator can draw it).
- **Surprise mode**: the dashboard hides events until a character tells you.
- **Story hooks**: big moments you can jump into as a scene.

## Risks

- **A log nobody reads.** Mitigation: hooks in the chat, diary, "pick up this thread".
- **Contradicting the chat.** Mitigation: chat-truth times, promises, `stale` on edits.
- **Leaking secrets between chats.** Mitigation: visibility per event, persona outside the sim.
- **Cost on local models.** Mitigation: code does the planning, one call per day, budget per real day, preview before fast forward.
- **Bad JSON from small models.** Mitigation: tiny schema, cast by number, validate, one retry, else routine only.
- **Repetition.** Mitigation: seed deck with cooldowns, last 14 days as one-liners in the prompt.
- **Two messengers.** Mitigation: Meanwhile never sends messages.
