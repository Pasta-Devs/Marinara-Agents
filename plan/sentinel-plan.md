# Sentinel — implementation plan

Status: plan for review, 2026-11-04. Concept: `plan/sentinel-concept.md`. No issue or PR yet (on request).

## Scope of the first release

Slices 1–2 of the concept: the companion AI and cameras, standalone, roleplay mode only. No devices, records, hacking or images yet.

## What the code gives us (checked 2026-11-04)

| Need               | Found                                                                                                                                          | Use                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Package shape      | `manifest.json`, `agents.json`, `locales/`, `src/` → generated `client.js` / `server.mjs` via `node scripts/build-feature-packages.mjs <id>`   | same; copy `packages/quartermaster/` (panel + server)                |
| Tracker agent      | `packages/world-state/agents.json`: `phase: "post_processing"`, `modeAllowlist: ["roleplay"]`, `defaultInjectAsSection`, `category: "tracker"` | Sentinel agent of the same shape writes the `sentinel_updates` block |
| Per-message state  | Engine `game_state_snapshots` (one row per message and swipe, `committed` flag); re-injected by `committed-tracker-context.ts`                 | see decision D1                                                      |
| Panel              | `tracker-panel` / `roleplay-tracker` slots; `packages/quartermaster/src/15-panel.js` (accordion); tabs: `packages/beholder/src/80-dock.js:336` | Sentinel panel in `tracker-panel`, tabs inside                       |
| Server routes      | permission `routes`; services via `api.registerService`                                                                                        | feed and companion calls run on the package server                   |
| In-chat card       | no package renderer for a card inside the message stream                                                                                       | first release: no custom card (D3)                                   |
| Slash command      | no generic package command registration found                                                                                                  | first release: panel buttons, not commands (D4)                      |
| Cross-package read | none; the Engine itself reads world-state fields (`illustrator-background-generation.ts:120`)                                                  | standalone first; links later (concept)                              |
| Images             | Engine-internal `generateImage` (`conversation-selfie-command-runtime.ts:312`)                                                                 | later slice                                                          |

Note: tracker prompt templates mention `<current_game_state>`, but the Engine injects `<context>` (XML) or `# Context`. Sentinel's prompt must not rely on a tag name.

## Decisions to make

- **D1 Where Sentinel state lives.**
  - A (recommended): game state custom fields under a `sentinel.` prefix. Swipe- and branch-safe for free, re-injected by the Engine. Risk: the 64-field cap is shared with world-state custom fields → keep Sentinel to a few compact JSON fields (`sentinel.state`, `sentinel.places`, `sentinel.log`).
  - B: package-owned store (memory-nag vault pattern). No cap, but swipes and branches need own handling.
  - Places and camera definitions are setup, not story → they may live in B even with A for story state.
- **D2 How the companion speaks.** Panel line + short aside appended to the scene (recommended), or own chat messages (needs `chat-write`, feels heavier).
- **D3 Camera feed output.** First release: feed card in the panel, plus an optional "Share to scene" button that posts the feed as a narrator line. A real in-chat card needs an Engine renderer (later Engine PR).
- **D4 Triggers.** Panel buttons first ("Look", "Ask"). Slash commands need an Engine contract → later.

## Slices

0. **Spike (half a day):** prove D1-A on a throwaway Engine: a tracker agent writes a `sentinel.state` custom field, the panel reads it, a swipe restores it. Prove a package route can run one LLM call (feed). Outcome decides D1.
1. **Skeleton:** manifest (`ui`, `routes`, `storage`, `prompt-context`), agents.json tracker agent (roleplay), locales, empty panel with tabs Companion · Cams · Places · Log. Builds and installs.
2. **Places + presets:** sites and rooms list, preset picker (Modern home, Office), starter rooms per preset. Model can add rooms and set the current room through `sentinel_updates`.
3. **Companion:** persona preset + custom prompt, mood/state (normal, glitching, compromised, offline), trust 0–100, frequency (quiet / normal / chatty), clock and weather in own state, reminders. Context injection kept under ~400 tokens.
4. **Cameras:** cameras per room (name, quality, audio, status), "Look" runs one fixed-schema LLM call → feed card (timestamp, room, what is visible, who is there). Feed goes to the log and back into context as fact. Only what the camera can see.
5. **Alerts + log:** alert toasts (motion, doorbell, power, message), log tab, frequency-limited random hooks.
6. **Proof + release:** regressions for the update-block parser and context budget, screenshots at 390 / 768 / 1440 in roleplay mode, version 0.1.0, catalog entry.

After release: devices + access, records, scans, maps/world-state links, image feeds, more presets (each one is data).

## Tests (smallest proof per slice)

- `sentinel_updates` parser: unknown ids ignored, rooms added, current room set, bad JSON keeps old state (`tests/sentinel-updates.regression.ts`).
- Context builder stays under budget with 30 rooms and 50 log lines.
- Feed result schema: missing fields fall back, never break the panel.
- UI proof per `marinara-design`: populated, empty (no places yet), loading feed, error feed, long room names.
