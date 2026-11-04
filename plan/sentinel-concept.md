# Sentinel — the in-world screen layer (concept)

Status: concept for review, 2026-11-04. No code, no issue, no PR yet.
Name: Sentinel (package id `sentinel`).

## One sentence

An Agent package that gives the story world its screens: a companion AI with a personality, cameras on map rooms, in-world records, and device control — all fictional. It works alone, and uses World Maps and World State when they are installed.

## Why

Roleplay often has an "AI in the walls" or a "phone that knows things": the house assistant, the ship computer, the security desk, the hacker's laptop, the scrying mirror. Today the model invents this ad hoc, and it forgets or contradicts itself (the door was locked, now it is open; the cam showed Mara in the office, now she was at home). Sentinel makes these screens real state that the user can tap and the model must respect.

Not a Home Assistant link. Nothing touches real devices or the network.

## Standalone first, other agents optional

Sentinel works with no other agent installed. It keeps its own small world:

- **Places:** a simple list of sites and rooms (for example "Home > Kitchen, Office, Garage"). The user adds them in the panel, or Sentinel adds them when the story names a new room. The preset brings a starter list.
- **Clock and conditions:** Sentinel tracks story time and weather in its own state block, updated from the story.
- **Current location:** the room the scene is in, from its own state block.

When other agents are present, Sentinel uses their data instead of its own, so nothing is tracked twice:

| Optional agent      | What Sentinel uses instead of its own                                                  | Without it                           |
| ------------------- | -------------------------------------------------------------------------------------- | ------------------------------------ |
| `hierarchical-maps` | region > town > building > floor > room, current location, travel routes, location art | own flat site > room list, no routes |
| `world-state`       | date, time, weather, temperature, location                                             | own clock and weather fields         |
| `illustrator`       | image stills for camera feeds                                                          | text feeds only                      |

Rules:

- No feature needs another agent. A missing agent only removes extras (routes, map art, images).
- Detection is silent. The panel shows "Using World Maps" (or similar) only as a small hint, never as a setup step.
- If a user installs maps later, Sentinel keeps its own room list and offers a one-tap link of its rooms to map rooms. It does not delete its own data.
- `custom-tracker` is a pattern reference for the state block, not a dependency.

Open question to verify before slicing: how one package reads another package's chat data (Engine API, shared game state, or only via prompt context). If there is no read path, Sentinel reads the injected `<current_game_state>` / map context the model already sees. Standalone mode does not depend on this answer.

## Parts

### 1. Companion AI (the core)

- A system persona that lives in the user's devices: phone, earpiece, car, house, ship. Not a character card replacement; a side voice with its own name and personality preset (butler, corporate, glitchy, cold military, cute, sarcastic) or a custom prompt.
- Reads time, weather and location (own state, or world-state / maps when present); speaks up on its own when a trigger fires (reminder due, weather change, user enters a new room, an alert).
- Answers in-world questions: "where is the nearest pharmacy", "route to the docks" (exact routes with maps, a plausible in-story answer without), "what's the time in the capital".
- Has a trust/loyalty value and states (normal, glitching, compromised, offline). Story events can change them: it can be hacked, lie, refuse, or get attached.
- Frequency control: quiet / normal / chatty, so it never floods the chat.

### 2. Cameras on rooms

- Any room (Sentinel's own, or a map location) can carry one or more cameras (name, angle, quality: HD / grainy / night vision / audio yes-no).
- "Look at Office Cam" produces a feed card: timestamp from the story clock, the room, and a short CCTV-style description of what happens there now — including NPCs acting offscreen.
- Text feed by default (cheap). Image still optional via illustrator.
- Feed results are written to a log, so the story must stay consistent with what was seen.
- Cameras can be off, looped, broken or hacked (ties into part 4).

### 3. Records and documents

- In-world items the AI can open: emails, chat logs, bank statements, access logs, police/medical files, receipts, notes.
- Generated once, then stored and fixed. Re-opening shows the same content. The model gets them as facts.
- Use: mystery and detective clues, business sims, drama ("you read her messages").

### 4. Control and access

- Devices per room: doors/locks, lights, power, alarm, gates, elevators, speakers.
- Access level per location and per user. Hacking or a stolen keycard raises it.
- Panel actions become story facts: "Door: locked by you, 21:14". Model-side changes come back through a state block and update the panel.
- Security reacts: alarms, guards dispatched, lockdown.

### 5. Scans and overviews

- "Scan the room": people, items, exits in the current room — gives the model a fixed list to reduce contradictions.
- Overview of the whole site (drone/satellite with maps: the region map): who is where, as far as the AI can know.

### 6. Alerts and log

- Pop-up alerts: motion, doorbell, power drop, message received, intruder, low oxygen (preset-dependent).
- Triggered by story events, timers, or random hooks (frequency setting).
- One chronological log of everything Sentinel saw or did: the audit trail of the story.

## Presets (same engine, different skin)

| Preset                | Companion         | Cameras                                 | Devices                    | Records                     |
| --------------------- | ----------------- | --------------------------------------- | -------------------------- | --------------------------- |
| Modern home           | house assistant   | home cams, doorbell                     | lights, locks, heating     | messages, bills             |
| Business / office     | office system     | lobby, office, storage                  | badge doors, alarm         | emails, sales, staff shifts |
| Cyberpunk             | implant AI        | city cams                               | doors, drones              | corp files, bank            |
| Sci-fi ship / station | ship computer     | deck cams                               | bulkheads, oxygen, reactor | crew logs                   |
| Horror                | unreliable system | cams that show things that aren't there | power, locks               | corrupted logs              |
| Spy / heist           | handler on comms  | security cams (loopable)                | doors, alarms, lasers      | guard rotas, blueprints     |
| Fantasy               | familiar / spirit | scrying mirror, crystal balls           | wards, gates               | letters, ledgers            |

A preset is data (persona, labels, icons, device types, alert types), not code.

## UI

- Floating over the chat, three sizes (pattern: Beholder's floating panel):
  - **Bubble:** small round button at a screen edge, alert count badge. Default when nothing happens.
  - **HUD:** compact card over the chat: status line (time, weather), the newest alert with "Look", 3 cam tiles, "Ask" field. Opens by itself on an alert (setting), then shrinks back.
  - **Full:** phone = bottom sheet over the chat (swipe down = smaller); desktop = movable, resizable window. Tabs Companion · Cams · Places · Log (later Devices · Records).
  - Size and position are remembered per chat.
- Cams tab: grid of tiles per current site (or building/floor when maps is present); tap = feed card in chat.
- Places: small list editor for sites and rooms; hidden behind a link when maps provides the rooms.
- Devices: toggles grouped by room; access-locked ones greyed with a lock icon.
- Alerts: small toast plus a log line.
- Follows `marinara-design`: mobile first, theme tokens, no new raw inputs except under Advanced.

## Model contract (sketch)

- Context injected per turn: companion persona + state, devices/cams of the current location, last N log lines, active alerts. Kept small; only the current building, not the world.
- The model may emit a `sentinel_updates` block (incremental, same style as world-state's incremental updates): device changes, new alerts, camera status, companion state, and in standalone mode also current room, new rooms, time and weather. Unknown ids are ignored.
- Camera feed and record generation are separate small calls with a fixed schema, so they do not bloat the main reply.

## Slices (proposal)

1. Companion AI, standalone: own places list, clock and weather, persona presets, context injection, triggers (room change, time, reminders), frequency setting, panel tab.
2. Cameras: cams on rooms, text feed card, log, consistency injection.
   Optional-agent links (maps, world-state) come after slice 2, once the cross-package read path is verified. Engine contract only if needed.
3. Alerts + log tab, random/story hooks.
4. Devices + access levels + `sentinel_updates` block.
5. Records and documents.
6. Scans and region overview.
7. Image stills via illustrator.
8. More presets (each is data).

Slices 1–2 are a usable first release.

## Open questions

1. Cross-package read path (see above).
2. One companion per chat, or one per persona across chats?
3. Should the companion ever speak as a real chat message, or only in the panel and as short asides?
4. Cameras: may a feed reveal things the user's character could not know (meta knowledge), or only what the camera can see? (Proposal: only what the camera can see; audio only if the cam has audio.)
5. Overlap with `modern-life-sim` home tab and Slurp's phone — keep Sentinel out of social media.
