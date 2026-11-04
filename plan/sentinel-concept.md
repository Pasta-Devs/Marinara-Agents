# Sentinel — the in-world screen layer (concept)

Status: concept for review, 2026-11-04. No code, no issue, no PR yet.
Name: Sentinel (package id `sentinel`).

## One sentence

An Agent package that gives the story world its screens: a companion AI with a personality, cameras on map rooms, in-world records, and device control — all fictional, all built on top of World Maps and World State instead of its own world model.

## Why

Roleplay often has an "AI in the walls" or a "phone that knows things": the house assistant, the ship computer, the security desk, the hacker's laptop, the scrying mirror. Today the model invents this ad hoc, and it forgets or contradicts itself (the door was locked, now it is open; the cam showed Mara in the office, now she was at home). Sentinel makes these screens real state that the user can tap and the model must respect.

Not a Home Assistant link. Nothing touches real devices or the network.

## Building blocks it reuses

| Need                | Source              | What it gives                                                                                        |
| ------------------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| Where things are    | `hierarchical-maps` | region > town > building > floor > room, current story location, travel between places, location art |
| When / conditions   | `world-state`       | date, time, weather, temperature, location, custom world fields                                      |
| Pictures (optional) | `illustrator`       | image generation for camera stills                                                                   |
| Counters / flags    | `custom-tracker`    | pattern for model-updated state blocks                                                               |

Open question to verify before slicing: how one package reads another package's chat data (Engine API, shared game state, or only via prompt context). If there is no read path, Sentinel reads the injected `<current_game_state>` / map context the model already sees, and slice 0 is a small Engine contract.

## Parts

### 1. Companion AI (the core)

- A system persona that lives in the user's devices: phone, earpiece, car, house, ship. Not a character card replacement; a side voice with its own name and personality preset (butler, corporate, glitchy, cold military, cute, sarcastic) or a custom prompt.
- Reads time, weather and location; speaks up on its own when a trigger fires (reminder due, weather change, user enters a new map location, an alert).
- Answers in-world questions: "where is the nearest pharmacy", "route to the docks" (uses map travel), "what's the time in the capital".
- Has a trust/loyalty value and states (normal, glitching, compromised, offline). Story events can change them: it can be hacked, lie, refuse, or get attached.
- Frequency control: quiet / normal / chatty, so it never floods the chat.

### 2. Cameras on map rooms

- Any map location can carry one or more cameras (name, angle, quality: HD / grainy / night vision / audio yes-no).
- "Look at Office Cam" produces a feed card: timestamp from world-state, room from maps, and a short CCTV-style description of what happens there now — including NPCs acting offscreen.
- Text feed by default (cheap). Image still optional via illustrator.
- Feed results are written to a log, so the story must stay consistent with what was seen.
- Cameras can be off, looped, broken or hacked (ties into part 4).

### 3. Records and documents

- In-world items the AI can open: emails, chat logs, bank statements, access logs, police/medical files, receipts, notes.
- Generated once, then stored and fixed. Re-opening shows the same content. The model gets them as facts.
- Use: mystery and detective clues, business sims, drama ("you read her messages").

### 4. Control and access

- Devices per map location: doors/locks, lights, power, alarm, gates, elevators, speakers.
- Access level per location and per user. Hacking or a stolen keycard raises it.
- Panel actions become story facts: "Door: locked by you, 21:14". Model-side changes come back through a state block and update the panel.
- Security reacts: alarms, guards dispatched, lockdown.

### 5. Scans and overviews

- "Scan the room": people, items, exits in the current map room — gives the model a fixed list to reduce contradictions.
- Drone/satellite overview of a region map: who is where, as far as the AI can know.

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

- Side panel (like other tracker agents): tabs Companion · Cams · Devices · Records · Log.
- Cams tab: grid of tiles per current building/floor from maps; tap = feed card in chat.
- Devices: toggles grouped by room; access-locked ones greyed with a lock icon.
- Alerts: small toast plus a log line.
- Follows `marinara-design`: mobile first, theme tokens, no new raw inputs except under Advanced.

## Model contract (sketch)

- Context injected per turn: companion persona + state, devices/cams of the current location, last N log lines, active alerts. Kept small; only the current building, not the world.
- The model may emit a `sentinel_updates` block (incremental, same style as world-state's incremental updates): device changes, new alerts, camera status, companion state. Unknown ids are ignored.
- Camera feed and record generation are separate small calls with a fixed schema, so they do not bloat the main reply.

## Slices (proposal)

0. Verify the cross-package read path (maps + world-state). Engine contract only if needed.
1. Companion AI: persona presets, context injection, triggers (location change, time, reminders), frequency setting, panel tab.
2. Cameras: cams on map locations, text feed card, log, consistency injection.
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
5. Does Sentinel stand alone, or require maps + world-state installed? (Proposal: works without them in a reduced mode with its own simple room list; full mode when they are present.)
6. Overlap with `modern-life-sim` home tab and Slurp's phone — keep Sentinel out of social media.
