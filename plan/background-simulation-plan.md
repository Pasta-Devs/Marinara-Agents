# Meanwhile: build plan (v1)

Status: plan for review, 2026-11-04. Concept: `plan/background-simulation.md`.
Code facts checked on Engine `origin/staging` and Agents `staging` (774c08e55) on 2026-11-04.

## Scope of the first release

In:
- Circles with cast, setting, linked chats, real-time clock, set time and speed, fast forward (1 to 7 days).
- Ledger, seed deck, who-meets-whom, one beat call per Circle day, promises pass, visibility.
- Hooks with mention-once prompt context, "Pick up this thread", diary, timeline with veto and edit.
- Big events with the review queue (off by default per kind).
- Long-absence summary, cost budget per real day.

Out (later slices): writes to other agents (LTM, Slurp2), status writes, nudges, phone view, Monday paper,
surprise mode, Home widget.

## What the code gives us

| Need | Hook | Where |
|---|---|---|
| Start and stop | `activate(context)`; return cleanups, run on disable/uninstall | Engine `capability-module-runtime.service.ts:182`, `:580-594` |
| Background timer | plain `setTimeout` + `unref()` in the package; no Engine timer API | pattern: Slurp2 `slp-world-scheduler-service.ts` |
| Model calls | `languageModels.resolve(connectionId?)` → `chatComplete`, `fitContext`; usage tokens returned | Engine `shared/src/types/capability-runtime.ts:244-270`, `:217-226` |
| Characters | `listCharacters(ids?)` → raw card (`data.extensions.conversationSchedule`) | `capability-runtime.ts:170`, `:91-95` |
| Chat schedules | chat copy `metadata.characterSchedules` (per chat, wins over the card copy) | `shared/src/types/chat.ts:668` |
| Chats, messages | `listChats`, `getChat` (`mode`, `characterIds`, `lastMessageAt`), `listMessages` (needs `chat-read`) | `capability-runtime.ts:470-477`, `:72-90`, `:276-285` |
| Prompt context | `registerPromptContext(fn)`; gets `chatId`, `mode`, `targetCharacterIds`; returns text; 2 s timeout | `capability-prompt-context.service.ts:13-49`, `:78`; injected `generate.routes.ts:5474` |
| Home tab | slot `home-browser-tab` + `homeBrowserTab.label`, client entrypoint, routes `/api/meanwhile/*` | `capability-package.schema.ts:138`, `:285-296`; `capability-route-registration.service.ts:83` |
| Status (later) | `updateCharacterStatus(chatId, characterId, {status, activity ≤500, duration ≤1 week})` | `capability-runtime.ts:56-63`, `:531` |
| LTM write (later) | `long-term-memory:intake` submit `{caller, recordId, characterIds, text}` + retract `{caller, recordId}` | Agents `long-term-memory/.../intake.ts:34-63`, `:305-316`; caller list `:24` is `["slurp2"]` |
| Slurp2 (later) | `slurp2:actions` (`add-idea`, `draft-post`, ...), zod-checked, own-page actions need preview | Agents `slurp2/.../slp-action-runner.ts:23-38`, `slp-actions.ts:116` |

Not there and not used:
- `createChatNote` / `createChatInfluence`: they cannot be removed later, so a veto could not undo them. We use prompt context instead.
- A presence API for packages: we use message timestamps (`listMessages`, `lastMessageAt`).
- A place in schedule blocks (`ScheduleBlock` = `{time, activity, status}`): we tag places ourselves (below).
- A Noodle or Relationship Tracker write API.

## Data model (sketch)

Stored in package storage (`storage` permission). The exact storage API is not checked yet; slice 1 copies what Slurp2 uses.

```ts
type Weight = 'routine' | 'notable' | 'major' | 'summary';
type Visibility = 'circle' | `chat:${string}`;

interface Circle {
  id: string; name: string;
  castIds: string[];                // character ids
  setting: string;                  // <= 600 chars
  linkedChatIds: string[];
  sharedWorld: boolean;             // false = per-chat visibility for chat facts
  clock: { anchorCircle: string; anchorReal: number; speed: number; timezone: string };
  lastRunCircle: string;            // Circle time covered so far (ISO)
  pace: 'cozy' | 'eventful' | 'dramatic';
  allowedKinds: string[]; bigKindsAllowed: string[];
  connectionId?: string;            // model; empty = user default
  budgetCallsPerDay: number;        // real day, default 12
  connections: Record<string, { read: boolean; write: boolean }>;
}

interface LifeEvent {
  id: string; circleId: string;
  start: string; end: string;       // Circle time, ISO
  createdAt: number;                // wall clock
  cast: string[];                   // one shared event for an encounter
  place?: string; kind: string; weight: Weight;
  text: string;                     // <= 140 chars, third person
  diary?: Record<string, string>;   // characterId -> first-person line
  hook?: Record<string, string>;    // characterId -> what they want to tell you
  source: 'schedule' | 'generated' | 'chat' | 'user' | 'summary';
  status: 'accepted' | 'proposed' | 'vetoed' | 'stale';
  visibility: Visibility;
  anchors?: { chatId: string; messageId: string }[];
  delivered?: Record<string, number>; // chatId -> when the hook went into that chat's prompt
  writes?: { target: string; ref: string; at: number }[];
  seedId?: string;                  // deck card, for cooldowns
}

interface Promise_ {                // "Promise" is taken in JS
  id: string; circleId: string; characterId: string;
  text: string; due?: string;       // Circle time
  visibility: Visibility; anchor: { chatId: string; messageId: string };
  status: 'open' | 'kept' | 'dropped' | 'stale';
}

interface PlaceTags { characterId: string; scheduleHash: string; byActivity: Record<string, string> }
interface RunMark { circleId: string; leaseUntil: number; failures: number; nextAt: number }
interface Usage { realDay: string; circleId: string; calls: number; promptTokens: number; outputTokens: number }
```

## How a run works

1. **Due?** Timer wakes every 5 min (90 s after start). A Circle is due when Circle time is ahead of
   `lastRunCircle` by at least 6 Circle hours, or a linked chat was opened since the last run
   (seen through `lastMessageAt`), or the user pressed fast forward. Background runs at most every 6 real hours.
2. **Lease.** One run per Circle: lease row with 30 min expiry (Slurp2 pattern). Failures back off
   `min(30 min, 5 min x 2^failures)`.
3. **Window.** `from = max(lastRunCircle, newest linked chat message with a cast member)`, `to = Circle now`.
   If the window is longer than 3 Circle days, everything before the last 3 days becomes one `summary` event.
4. **Promises.** Read messages newer than the last pass in each linked chat; one small call extracts
   promises and stated facts (skip when there are no new messages).
5. **Per Circle day:** fill routine from the schedule (code), deal seeds (code, seeded by `circleId + day`),
   pick pairs (code), then one **beat call**. Write events as `accepted`, or `proposed` for big kinds.
6. **Budget.** Stop when `budgetCallsPerDay` is used up; the rest of the window waits for the next real day.
   Fast forward shows the count first and asks.
7. **Mark.** `lastRunCircle = to` only after the events are stored (no double days after a crash).

## Model calls

| Call | When | Input | Output |
|---|---|---|---|
| Place tags | once per character per new schedule (weekly) | distinct activity texts | `{activity: place}` from a fixed list (home, work, school, gym, cafe, bar, park, shop, out of town, online) |
| Promises | before a run, only if linked chats have new messages | newest messages (capped ~2k tokens) | `[{who, text, due?}]` |
| Beats | one per Circle day | see below | see below |
| Summary | once for a long absence | last 14 days of one-liners + cast | `{text, perCharacter: {id: line}}` |

Typical cost: 4 characters, fast forward 3 days = 3 beat calls + at most 1 promise call = **4 calls**.

### Beat call

Input (code builds it, ~1.5k tokens):
- Setting paragraph, the date, weekday, season.
- Cast as numbered lines: `0: Lily, 24, shy, likes climbing. Today: 09-17 work (office), 19-21 gym`.
- Seeds: `{seed: "s1", kind: "friends", cast: [0, 2], place: "cafe", time: "18:00"}`.
- Open promises due today.
- Last 14 days as one-liners; motifs to avoid.
- Pace, allowed kinds, adult setting, "the user is not in these events".

Output (flat JSON, cast by number):
```json
{"beats":[{"seed":"s1","start":"18:00","end":"19:30","text":"Lily and Mia talk over coffee; Mia admits she is moving to Hamburg.",
  "diary":{"0":"Mia is leaving. I didn't know what to say.","2":"Finally told Lily."},
  "hook":{"0":"Mia is moving away"}}]}
```

Checks (code): each seed used once; cast and time match the seed; time inside the day and not inside a
chat-truth span; text ≤ 140 chars; no persona name; kind allowed. On a parse or check error: one retry with
the error message; then keep the beats that passed; if none passed, the day is routine only. A run never blocks.

## Prompt context (the chat face)

For a chat that is linked to a Circle, for the characters in this generation:
- At most 3 items, about 150 tokens, ranked: undelivered hook of a target character, then events they were in,
  then recency. Only events visible to this chat.
- Text frame: "Since you last talked with {user}, this happened. Mention it only if it fits, at most once, in your own words."
- After a hook goes in, `delivered[chatId]` is set; it does not come back in that chat.
- It also runs for the Engine's first-text messages (conversation mode), so they can talk about real events.
  To check in slice 3: the autonomous path calls the same prompt-context collector.

## Decisions to make

- **D1 Model:** default to the user's default connection, or ask for a cheap connection in setup? (Proposal: default, with a "use a cheaper model" picker.)
- **D2 Visibility default:** shared world for a Circle made from one chat, per-chat otherwise. (Proposal as written.)
- **D3 First write-out after release:** LTM (needs a one-line change in the LTM package) or status? (Proposal: LTM.)
- **D4 Background runs:** catch up only when you return (cheap) or also every 6 real hours (feels alive, costs calls)? (Proposal: on return, plus an opt-in background switch, like Slurp2.)

## Slices

Each slice is one PR into `staging`, version bump by patch, tests listed below.

1. **Skeleton:** manifest (`home-browser-tab`, `chat-read`, `storage`, `routes`, `prompt-context`), storage tables, Circle setup UI, clock math, timer with lease and backoff. No model calls.
2. **Routine and deck:** schedule reading (chat copy over card copy), place tags, seed deck with cooldowns, pair picking, timeline view of routine.
3. **Beats:** beat call, checks, retry, diary, hooks, budget, long-absence summary. Prompt context with mention-once. "Pick up this thread".
4. **Fast forward and review:** preview with call count, progress, cancel; big kinds with the "Waiting for you" queue; veto and edit; promises pass with `stale` on edited messages.
5. **Write-outs (behind switches):** LTM intake + retract (after D3), status at x1, Slurp2 post idea. Each waits 24 h and is undone on veto.
6. **Delight:** phone view, Monday paper, Home widget, nudges, surprise mode.

## Tests (smallest proof per slice)

1. Clock math: speed changes, x0, set time, long absence → summary window. Lease: two runs, one wins; crash → expiry.
2. Deck: same seed input → same cards; cooldown blocks repeats; pairs only from overlapping blocks.
3. Beat checks: bad JSON, wrong seed, out-of-range cast, time in a chat span → rejected; retry path; budget stop.
4. Review: big kind arrives `proposed`; character runs routine only while it waits; expiry after 7 Circle days; message edit → `stale`.
5. Write-outs: veto before 24 h → no write; veto after → retract called.
6. Prompt context: only visible events; max 3 items; delivered once per chat.

Live proof: one Circle with 3 characters on a dev Engine, fast forward 3 days, then open a linked chat and see one hook mentioned once.
