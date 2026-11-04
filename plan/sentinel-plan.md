# Sentinel — implementation plan (v3)

Status: plan for review, 2026-11-04. Concept: `plan/sentinel-concept.md` (v3). No issue or PR (on request).

## Scope of the first release

- Threads with stages, traces, flavour and landing; ticked by code against story time.
- Handoff (absent subject enters the scene) and "while you were away".
- Hunches (in story / in HUD).
- In-story sense use for Look and Sensor, plus panel buttons for Look, Listen, Sensor, Locate.
- Pressure per play style.
- Play styles: **Parent**, **Business owner**, **Living world** (light mode). All data.
- Truth modes cozy / fair / dramatic; user suspicions.
- Privacy levels and the under-18 rule from day one.
- Floating UI (bubble · HUD · full) and the inline "Sentinel" chip.
- Standalone; uses `world-state` time if present. Roleplay mode only.

Later: hands, voice, Messages/Report senses, more play styles, play style editor, character-side tools, maps/illustrator links.

## What the code gives us (checked 2026-11-04)

| Need              | Found                                                                                                                                        | Use                                                                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package shape     | `manifest.json`, `agents.json`, `locales/`, `src/` → generated `client.js` / `server.mjs` via `node scripts/build-feature-packages.mjs <id>` | copy `packages/quartermaster/` (panel + server)                                                                                                                                       |
| Agent phases      | `pre_generation`, `post_processing`, `parallel`, `context_injection`, …                                                                      | `post_processing`: advance clocks, detect enter/leave, detect in-story sense use for the next turn; `context_injection`: handoff, hunch, truth for a sense used in the user's message |
| Per-message state | `game_state_snapshots` (per message and swipe)                                                                                               | candidate for thread state (D1)                                                                                                                                                       |
| Story time        | `world-state` fields read by the Engine (`illustrator-background-generation.ts:120`)                                                         | own clock first; world-state time when readable                                                                                                                                       |
| Floating UI       | Beholder floating panel `packages/beholder/src/80-dock.js`                                                                                   | copy it                                                                                                                                                                               |
| Server calls      | `routes`, `api.registerService`                                                                                                              | sense, author and landing calls                                                                                                                                                       |
| Tools             | Engine built-ins only                                                                                                                        | no character tools in the first release                                                                                                                                               |

Note: tracker prompts mention `<current_game_state>`, but the Engine injects `<context>` or `# Context`. Do not rely on a tag name.

## Data model (sketch)

- `subjects[]`: id, kind (person/place), name, cardId?, privacy (open/private/off-limits), minor, onscreen (bool), known `{where, doing, at, source}`.
- `threads[]`: id, subjectId, flavour (trouble/personal/kind), title (hidden), stages[] `{text, traces[]}`, stage index, clock progress, landing `{text, delay}`, found traces[], status (running/caught/stopped/landed).
- `pressure`: name, value 0–100, effects by band.
- `suspicions[]`: text, resolved as true/partial/false (hidden), threadId?.
- `log[]`: found facts with time and source; later reveals.
- `settings`: play style, mode, tension, truth mode, hunch channel, update cap, connection.

Hidden data (thread titles, stages not found, landing, suspicion truth) never goes into the main prompt. Only found traces, hunches and the handoff state do.

## Model calls (and when)

| Call                | When                                                | Output (fixed schema)                                                      |
| ------------------- | --------------------------------------------------- | -------------------------------------------------------------------------- |
| Author thread       | new subject, thread landed or stopped, rare refresh | stages with traces, flavour, landing; from the card and play style library |
| Render sense        | sense used (story or button)                        | what is noticed, from traces at the current stage, privacy-filtered        |
| Handoff             | subject enters the scene                            | one or two lines of true state for the main model                          |
| Landing / away card | thread lands; user returns                          | short consequence or "what changed"                                        |

Ticks, pressure, hunch choice and suspicion resolution are code (seeded random). Cost cap per hour applies to all calls.

## Decisions to make

- **D1 Storage.** Package storage keyed by chat + message id for hidden state (swipe-safe by re-reading the snapshot at the active message), plus a small `known` summary in game state custom fields. Spike confirms.
- **D2 In-story sense detection.** Keyword rules per sense skin first ("open her door", "check the cam"), a small classifier call only if rules miss too much.
- **D3 Thread library format.** Small JSON: stages with traces, flavour, tension weight, landing, follow-up threads. Ship 15–20 threads per play style.
- **D4 Story time.** Own clock advanced by detected time phrases and time skips; world-state time when available.

## Slices

0. **Spike:** D1 on a throwaway Engine; one `context_injection` line reaches the main model; one fixed-schema call from a package route.
1. **Skeleton:** manifest (`ui`, `routes`, `storage`, `prompt-context`, `chat-read`), agents.json, locales, floating bubble/HUD/full with empty tabs.
2. **Threads core:** library format, Parent + Business + Living world libraries, clock ticks, landing, log. Unit-tested without any model.
3. **Handoff + away card:** enter/leave detection, handoff injection, "while you were away".
4. **Senses:** button senses, in-story Look/Sensor detection, trace rendering with privacy filter, Sentinel chip.
5. **Pressure + backfire + hunches:** pressure bands, noticed senses, hunch channel setting.
6. **Truth modes + suspicions.**
7. **Proof + release:** regressions, screenshots at 390 / 768 / 1440, version 0.1.0, catalog entry.

## Tests (smallest proof per slice)

- Threads: a seeded tick sequence moves stages as expected; onscreen subjects do not tick; landing fires once.
- Privacy: private or minor subjects never get body/clothing/intimate content in any output; off-limits gets no thread and no call.
- Hidden truth never appears in injected context (only found traces, hunches, handoff).
- Suspicion resolution respects truth mode weights (seeded).
- Sense detection rules: positive and negative phrases per skin.
- UI proof per `marinara-design`: populated, empty, loading, error, long names.
