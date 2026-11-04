# Sentinel — implementation plan (v2)

Status: plan for review, 2026-11-04. Concept: `plan/sentinel-concept.md` (v2, "the world outside the scene"). No issue or PR (on request).

## Scope of the first release

- Hidden offscreen timeline for watched subjects, with tension and update settings.
- Senses: Look, Listen, Sensor, Locate (Messages and Report come later).
- Two play styles: **Parent / family** and **Business owner**. Both are data.
- Privacy levels and the under-18 rule from the start.
- Floating UI: bubble, HUD, full panel (Watch · Senses · Log · Setup).
- Standalone. Roleplay mode only.

Later: hands, voice/companion, Messages and Report senses, more play styles, play style editor, character tools, maps/world-state/illustrator links.

## What the code gives us (checked 2026-11-04)

| Need               | Found                                                                                                                                        | Use                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Package shape      | `manifest.json`, `agents.json`, `locales/`, `src/` → generated `client.js` / `server.mjs` via `node scripts/build-feature-packages.mjs <id>` | copy `packages/quartermaster/` (panel + server)                                                                      |
| Agent phases       | `pre_generation`, `post_processing`, `parallel`, `context_injection`, …                                                                      | timeline tick = `post_processing` (after the reply, so it sees the new scene); collision hints = `context_injection` |
| Per-message state  | Engine `game_state_snapshots` (per message and swipe, `committed`), re-injected by `committed-tracker-context.ts`                            | candidate for the hidden timeline (D1)                                                                               |
| Chat variables     | Engine tools `read-chat-variable` / `write-chat-variable`                                                                                    | second candidate for D1                                                                                              |
| Floating UI        | Beholder floating panel `packages/beholder/src/80-dock.js` (move, resize, collapse, full screen on phone)                                    | copy it                                                                                                              |
| Server calls       | permission `routes`, `api.registerService`                                                                                                   | sense calls ("Look") run on the package server                                                                       |
| Tools              | Engine built-ins only (`roll_dice`, `spotify_*`, `update-game-state`, `trigger-event`, …); no package-defined tools                          | first release: user-only senses; character tools need an Engine contract (later)                                     |
| Cross-package read | none                                                                                                                                         | standalone first                                                                                                     |

Note: tracker prompts mention `<current_game_state>`, but the Engine injects `<context>` or `# Context`. Sentinel's prompts must not rely on a tag name.

## Data model (sketch)

- `subjects[]`: id, kind (person / place), name, privacy (open / private / off-limits), minor (bool), known `{where, doing, mood, at}`, true `{where, doing, mood}`, threads[].
- `senses[]`: id, type (look / listen / sensor / locate), skin label, clarity, target subject ids, status (ok / blocked / noticed).
- `beats[]`: time, subject, text, visibility (hidden / hinted / seen / revealed-later), collision (bool).
- `log[]`: what the user knows, with time and source.
- `settings`: play style id, tension, update mode, connection.

Hidden truth never goes into the main prompt. Only `known` state, hinted beats and collision hints do.

## Decisions to make

- **D1 Where the timeline lives.** A: game state custom fields (swipe/branch safe, re-injected, 64-field cap shared, and re-injection would leak hidden truth → needs a split). B: package storage keyed by chat + message id (own swipe handling). C: chat variables. Spike decides; leaning B for hidden state and A for the small `known` summary.
- **D2 Collision hints.** A short hidden line before generation when a beat may enter the scene, or only on user action. Leaning: hint, max one per turn.
- **D3 Event packs.** Reuse Slurp's pack shape or a small new JSON format. Leaning: small new format (beats with subject role, tension, trigger, follow-ups).
- **D4 Cost guard.** Update mode default "every 3 turns", plus a hard cap per hour.

## Slices

0. **Spike:** D1 on a throwaway Engine (store hidden + known state per message, swipe restores both). One package-route LLM call returns a fixed-schema sense result.
1. **Skeleton:** manifest (`ui`, `routes`, `storage`, `prompt-context`, `chat-read`), agents.json (`post_processing` tracker, roleplay), locales, floating panel (bubble · HUD · full) with empty tabs. Builds and installs.
2. **Setup + play styles:** play style picker, subjects with privacy and minor flag, Parent and Business presets, event pack format.
3. **Timeline tick:** post-processing call that advances beats for watched subjects within tension and update settings; known vs. true state; log.
4. **Senses:** Look, Listen, Sensor, Locate; fixed-schema calls; clarity; privacy filter; results to log and `known`; "Share to scene".
5. **Alerts + collisions:** alert rules per pack, HUD alert with action, collision hint to the main model.
6. **Consequences:** a sense can be noticed (chance by pack and tension); noticed changes subject threads and trust.
7. **Proof + release:** regressions, screenshots at 390 / 768 / 1440, version 0.1.0, catalog entry.

## Tests (smallest proof per slice)

- Privacy filter: a private or minor subject never gets body/clothing/intimate fields in a sense result; off-limits gets no call (`tests/sentinel-privacy.regression.ts`).
- Hidden truth never appears in the injected context.
- Timeline tick respects tension and update mode (no call when not due).
- Sense result schema: bad JSON keeps old state, panel never breaks.
- UI proof per `marinara-design`: populated, empty, loading, error, long names.
