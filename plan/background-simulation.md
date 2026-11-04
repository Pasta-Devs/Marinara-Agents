# Background Simulation — characters live while you are away (concept v2)

Status: concept for discussion, 2026-11-04. No code, no issue, no PR.
Decided 2026-11-04: name Meanwhile; clock = real time + fast forward + settable time and speed;
only big events wait for review; Sentinel is a sibling, neither depends on the other.

Name: **Meanwhile** (package id `meanwhile`; `background` is taken by the scene-background package).

## The idea in one line

Your characters keep living when no chat is open: they follow their schedules, meet each other,
have small and big moments, and when you come back you get "what happened while you were away" —
in the Home Screen, in the chat, and (if you allow it) in other agents like Long-Term Memory, Slurp and Noodle.
You can also say "let 3 days go by".

## Is it an Engine agent, a Home Screen agent or a chat agent?

All three, but as **one package with one core and three faces**:

| Face | What it does | Engine hook that exists today |
|---|---|---|
| **Core (server)** | Owns the clock, the cast, the life ledger, the generator. Runs catch-up and fast forward. | Package server timer (the Slurp2 world scheduler pattern), `languageModels` host, package storage, service registry |
| **Home Screen (dashboard)** | Setup and control: cast, links, influences, sources, fast forward, timeline, review queue, "while you were away" cards. | `home-browser-tab` slot (+ `homeWidgets` for a small digest widget) |
| **Chat agent** | When you open or write in a chat, it gives the main model a short, true "since you last talked" context, and updates the character status. | `prompt-context` agent, `updateCharacterStatus`, `createChatInfluence` |

Engine-level work is **not needed for v1**. The Engine has no generic scheduled-task API and no
world clock; packages run their own timers today (Slurp2 world clock, Noodle refresh). Later, the
ledger can become a shared Engine "life timeline" service (see Phase 4).

## What already exists (checked 2026-11-04)

Engine (`origin/staging`):
- **Character schedules**: `WeekSchedule` / `ScheduleBlock` in `packages/shared/src/utils/conversation-presence.ts`;
  current status from blocks (`getEffectiveCurrentStatus`); LLM schedule generator in
  `server/src/services/conversation/schedule.service.ts`; timezone + rollover hour in `timezone.ts`.
- **Autonomy loop**: `server-autonomous-scheduler.service.ts` (60 s poll) + `autonomous.service.ts`
  (`checkAutonomousMessaging`, `checkCharacterExchange`, daily budgets, presence). This already sends
  "character texts first" messages and character-to-character exchanges in conversation mode.
- **Package host API**: `CapabilityRuntimeHost` (language models, JSON, persistence, embeddings);
  persistence writes `appendMessages`, `createChatNote`, `createChatInfluence`, `updateCharacterStatus`, `appendRoleplayEvent`.
- **Game clock**: `game/time.service.ts` — moves only on player actions. No real-time world clock.
- **Not there**: world schedules, offline simulation, fast forward, a generic event bus, a direct character write API, a scheduled-task manifest contribution.

Agents repo:
- **Slurp2 world tick** already does offline catch-up: `readLastTick` → now, capped
  (`SLURP_WORLD_MAX_CATCHUP_DAYS = 3`), no model calls in the tick. Best local pattern to copy.
- **Service registry** for cross-package data: `long-term-memory:recall` / `:intake`, `slurp2:actions`,
  `noodle:prompt-context`, `agent-runtime:<id>`. Slurp2 and Noodle already read LTM this way.
- **relationship-tracker** publishes `persona-state-v1` / `read-api-v1` contracts (nobody reads them yet).
- **world-state** package tracks in-story date/time/weather.
- **Sentinel** (`origin/rp-sentinel-agent`): secret threads for absent characters **inside one story, in story time**.
  Meanwhile is the **real-time, cross-chat** sibling. Neither depends on the other (see "Sentinel and Meanwhile").

## Prior art — what we take from it

| Source | Lesson for us |
|---|---|
| Idle games / Tamagotchi | Store a timestamp; on return compute the gap, **clamp** it, apply it in one go. Cost must not grow with real time. |
| Dwarf Fortress (Legends) | Generate history, then let people **browse** it. Our timeline is a Legends view. A "history depth" slider. |
| Oblivion Radiant AI | Free simulation drifts into chaos (NPCs killed each other). **Allowed event types + caps** per day. |
| RimWorld storytellers | Pacing, not simulation: **storyteller profiles** (cozy / eventful / dramatic) and a **drama budget**. |
| The Sims story progression | Players want **per-character** on/off from day one. Off-screen life is coarse, not a full needs sim. |
| Generative Agents (Smallville) | Memory stream + **reflection** + plan-then-act. Write a few reflections into memory, not every event. |
| AI Town (a16z) | Pause when nobody watches; catch up in bulk on return. |
| LLM agent-society papers | ~95 % of cost is inference: **batch** characters into one call, use **code for routine**, LLM only for notable moments. |
| SillyTavern / companion apps | Proactive messages exist (Replika, EchoText), but nobody does a real offline life sim. "Life update" tone beats "where were you?". |

## Core concepts

### 1. A Life (the scope)
One character card is often used in many chats with different universes. So the simulation never runs
on "a character" alone. It runs on a **Life**: a named setup with

- **cast** — the characters who live in it (each on/off, each with a detail level),
- **setting** — the world it plays in (from a chat, a lorebook, or free text),
- **linked chats** — the chats that are "this universe" (they feed it and receive from it),
- **clock** — see "The clock" below,
- **sources** — which other agents it reads from and writes to.

A user can have one Life ("my modern-day friend group") or several ("fantasy party", "office AU").

### 1b. The clock
Each Life has its own clock with three controls:
- **Real time** (default) — Life time runs with the wall clock (and the Life's timezone); the gap since the last run is caught up, clamped.
- **Fast forward** — jump N hours or days now (see Fast forward).
- **Set time and speed** — set the Life's current date/time by hand, and a speed factor
  (×1 real time, ×24 = one Life day per real hour, ×0 = paused). Life time = last set point + real elapsed × speed.
Speed changes only how much Life time a catch-up covers; the generator and the clamp stay the same.

### 2. The life ledger (the truth)
An append-only list of **events** per Life. Every event has: time span, who, where, what (short),
optional detail, kind, weight (routine / notable / major), source (`schedule` / `generated` / `chat` / `user` / `<agent id>`),
and a status: `proposed` → `accepted` / `vetoed`, plus `canon` for user-locked facts.
Everything else (memories, posts, status, digests) is **derived from accepted events**. Undo = veto the event.

### 3. Chronicle, not tick simulation
We do not simulate minute by minute. On catch-up or fast forward, for each day:

1. **Routine by code (free)** — the character's `WeekSchedule` fills the day ("work 9–17", "gym", "sleep").
2. **Beats by the model (paid)** — one call per day per Life (batched cast) proposes a few notable beats
   on top of the routine: an encounter, a mood shift, a small story, a social post idea.
3. **Encounters are shared** — when two cast members meet, one resolution writes one event for both,
   so they never tell two different versions.
4. **Reflection at the end** — per character, a few durable facts ("got the promotion", "fell out with Mia")
   go to memory. Routine never goes to memory.

### 4. Level of detail
- **In a chat right now** → not simulated. The chat is the truth; chat activity marks that span as `chat`.
- **Recent gap (< 1 day)** → beats only if notable; often nothing.
- **Days** → day beats.
- **Weeks** → week summary with a few beats (clamped; see cost).

### 5. Influences
- **Storyteller profile**: Cozy (slice of life), Eventful, Dramatic, Custom.
- **Drama budget** per week; **allowed event kinds** (work, friends, romance, conflict, health, luck, spicy, …).
- **Review rule (decided)**: small and notable events are accepted automatically; **big events** wait.
- **Hard limits** = the big events (never without your OK): death, breakup, pregnancy, moving away, job loss, injury — they come as `proposed` and wait in the review queue. Vetoing an accepted event later retracts its writes.
- **Nudges**: "This week Lily gets a job offer", "Jonas and Mia should meet". Nudges become planned beats.
- **Canon locks**: facts the sim must not break (from you, from the card, from lorebooks).

### 6. Fast forward
"Let 3 days go by" on a Life (or one character):
1. Show a **preview**: days, cast, estimated model calls, what will be written where.
2. Generate day by day (progress in the dashboard; cancel any time, partial days stay `proposed`).
3. **Review** screen: timeline with accept / veto / edit per event (or "accept all").
4. Only then write to other agents.

Real-time and fast-forward share the same generator; real time is "fast forward by the gap since last run, clamped".

## Data flow — sources (each one a read toggle and a write toggle)

| Source | Read (input) | Write (output) |
|---|---|---|
| Character card + schedule | personality, `conversationSchedule`, talkativeness | (optional) suggest schedule changes |
| Chats (linked) | last messages, timestamps (spans that are "chat truth") | `createChatInfluence` / chat note: "since you last talked" |
| Character status | — | `updateCharacterStatus` (what they do right now) |
| Autonomous messaging | presence, budget | optional "life update" text via the existing autonomy loop |
| Long-Term Memory | `long-term-memory:recall` for context | `long-term-memory:intake` — reflections only, tagged `meanwhile` |
| relationship-tracker | `read-api-v1` feelings between characters | relationship deltas (capped per day) |
| world-state | in-story date/weather (story-time clock) | — |
| Lorebooks | canon facts | (optional) new lorebook entry for major events, via review |
| Slurp2 | creator state, recent posts | `slurp2:actions` — post ideas from beats ("posted from the beach") |
| Noodle | recent feed | post ideas from beats |
| Sentinel | in-story threads | shared ledger events (later) |

Rule: **writes go out only from accepted events, and each write carries a source tag** so it can be found and retracted.

## Dashboard (Home Screen tab)

1. **Lives** — list of Lives with a status line ("3 characters · last run 2 h ago · 4 new events").
2. **Cast board** — character cards with "now doing" (from schedule + ledger), mood, detail level, on/off.
3. **Connections** — the source table above as toggles (read / write), with a short "what this does".
4. **Influences** — storyteller, drama budget, allowed kinds, hard limits, nudges, canon locks.
5. **Timeline** — Legends-style: per day, per character, filter by kind; accept / veto / edit.
6. **Fast forward** — days slider, preview, cost, run, review.
7. **While you were away** — card per character, also as a small Home widget and as the chat's first context.

## Cost model

- Routine: 0 calls.
- Beats: ~1 call per Life per simulated day (batched cast), + 1 call per notable encounter, + 1 reflection call per character per run.
- Example: 4 characters, fast forward 3 days → ~3 + ~3 + 4 ≈ **10 calls**.
- Real-time catch-up is clamped (default max 3 days, like Slurp2) and runs at most a few times a day.
- Model choice per Life (cheap model for beats, main model optional for reflections).

## Sentinel and Meanwhile

| | Sentinel | Meanwhile |
|---|---|---|
| Time | story time, inside one roleplay | real time (default) across chats |
| Unit | secret threads you discover by play | a life ledger you see and steer |
| Visibility | hidden until found | open dashboard (optional "surprise" mode) |

Decided: two sibling packages, **neither depends on the other** — no shared format or service is required.
Each can later read the other through the service registry as an optional, fail-soft source.

## Risks

- **Canon drift** — generated events contradict the card or a chat. → canon locks, chat-truth spans, review queue.
- **Memory spam** — every small event in LTM. → reflections only, capped, tagged.
- **Same card, many universes** → the Life scope; a character can be in several Lives with separate ledgers.
- **Token cost on local models** → code routine, batched beats, clamp, preview before fast forward.
- **Double automation** — the Engine's autonomy loop and Meanwhile both send messages. → Meanwhile only feeds the existing loop; it never sends its own messages.
- **Cross-package contracts** — Slurp2/Noodle/LTM services change. → read through the service registry only, fail soft.

## Phases (proposal)

1. **Digest (MVP)** — one Life, cast, real-time catch-up + manual fast forward, ledger, timeline, "while you were away" card + chat context. Reads card, schedule, chats, LTM. Writes only its own ledger, prompt context and character status.
2. **Encounters and influences** — shared encounters, storyteller, drama budget, hard limits, nudges, review queue.
3. **Write-out** — LTM intake, relationship deltas, Slurp2/Noodle post ideas, lorebook suggestions; each behind a toggle and review.
4. **Engine API** — propose an Engine "life timeline" service + scheduled-task contribution, so Slurp2, Noodle, Sentinel and the autonomy loop publish to and read from one timeline.

## Open questions

1. First home: package first (proposal) or Engine feature first?
2. Should characters who are **not** in your chats at all (only cards) be allowed in a Life?
