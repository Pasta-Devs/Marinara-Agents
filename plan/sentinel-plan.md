# Sentinel — implementation plan (v4)

Status: plan for review, 2026-11-04. Concept: `plan/sentinel-concept.md` (v4). No issue or PR (on request).

## Scope of the first release

- Subjects with privacy levels and the under-18 rule.
- Senses Look, Listen, Sensor, Locate as panel buttons.
- In-story looks for Look and Sensor (keyword rules).
- One observe call per look; facts in a log; observation and found facts as context for the narrator.
- Play styles **Parent**, **Business owner**, **Generic** as data.
- Floating panel (bubble · panel with Look and Log) and the inline "Sentinel" chip.
- Standalone. Roleplay mode only.

Later: Messages sense, play style editor, maps and illustrator links.

## What the code gives us (checked 2026-11-04)

| Need              | Found                                                                                                                                        | Use                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Package shape     | `manifest.json`, `agents.json`, `locales/`, `src/` → generated `client.js` / `server.mjs` via `node scripts/build-feature-packages.mjs <id>` | copy `packages/quartermaster/` (panel + server)                                                        |
| Agent phases      | `pre_generation`, `post_processing`, `parallel`, `context_injection`, …                                                                      | `context_injection`: observation for a look in the user's message, plus found facts for the subject(s) |
| Per-message state | `game_state_snapshots` (per message and swipe)                                                                                               | candidate for the log (D1)                                                                             |
| Floating UI       | Beholder floating panel `packages/beholder/src/80-dock.js`                                                                                   | copy it                                                                                                |
| Server calls      | `routes`, `api.registerService`                                                                                                              | observe call                                                                                           |

Note: tracker prompts mention `<current_game_state>`, but the Engine injects `<context>` or `# Context`. Do not rely on a tag name.

## Data model (sketch)

- `subjects[]`: id, kind (person/place/device), name, cardId?, privacy (open/private/off-limits), minor.
- `log[]`: subjectId, sense, observation text, facts[], messageId.
- `settings`: play style, in-story looks on/off, connection.

## Model call

| Call    | When                     | Input                                                                    | Output (fixed schema)          |
| ------- | ------------------------ | ------------------------------------------------------------------------ | ------------------------------ |
| Observe | a look (story or button) | subject, sense skin, recent chat, earlier facts for the subject, privacy | observation (1–3 lines), facts |

Privacy filter runs on the output in code too. Cap per hour.

## Decisions to make

- **D1 Storage.** Package storage keyed by chat + message id (swipe-safe by reading the entries on the active branch). Spike confirms.
- **D2 In-story look detection.** Keyword rules per sense skin ("open her door", "check the cam"); a small classifier call only if rules miss too much.

## Slices

0. **Spike:** D1 on a throwaway Engine; one `context_injection` line reaches the main model; one fixed-schema call from a package route.
1. **Skeleton:** manifest (`ui`, `routes`, `storage`, `prompt-context`, `chat-read`), agents.json, locales, floating bubble + panel with empty Look and Log.
2. **Looks:** subjects, button senses, observe call, log, context injection, Sentinel chip, privacy filter.
3. **In-story looks:** keyword detection for Look and Sensor.
4. **Play styles:** Parent, Business owner, Generic data.
5. **Proof + release:** regressions, screenshots at 390 / 768 / 1440, version 0.1.0, catalog entry.

## Tests (smallest proof per slice)

- Privacy: private or minor subjects never get body/clothing/intimate content; off-limits gets no call.
- Log: a swipe or branch switch shows only the facts of the active branch.
- Context: the injected text holds the observation and found facts, nothing else.
- Look detection rules: positive and negative phrases per skin.
- UI proof per `marinara-design`: populated, empty, loading, error, long names.
