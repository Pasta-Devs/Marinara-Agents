# Sentinel — the world outside the scene (concept v2)

Status: concept for review, 2026-11-04. No code, no issue, no PR (on request).
Name: Sentinel (package id `sentinel`). v1 ("in-world screens / smart home") is replaced by this version.

## The problem

In roleplay the world only exists where the scene is. While you are in the kitchen, nothing happens in your daughter's room. Your shop does not run while you are away. The suspect does nothing while you sleep. When the story later goes there, the model invents a past on the spot, and it often contradicts itself.

## The idea

Sentinel keeps a **hidden offscreen timeline**: what the people and places you care about do while you are not there. It gives you **senses** to notice parts of it, optional **hands** to act on it, and an optional **voice** that talks to you about it.

Smart home, cameras and AI butlers are one skin. A worried parent, a shop owner, a detective, a captain or a queen with spies use the same engine with other senses.

## What Sentinel is, as an agent

Marinara agents take part in every turn: they read the chat, add prompt context, keep state, show UI, and can use tools. Existing roles: tracker (memory), writer (shapes the prose), experience layer (adds senses and interaction), mini-game, own app. Sentinel combines three of them:

| Role             | In Sentinel                                                               | Comparable package                     |
| ---------------- | ------------------------------------------------------------------------- | -------------------------------------- |
| Director         | offscreen timeline moves on; beats collide with the scene                 | `director` (but autonomous and hidden) |
| Tracker          | last known state of every watched subject; what you know vs. what is true | `world-state`, `character-tracker`     |
| Experience layer | floating bubble / HUD / panel, alerts, sense results                      | `echo-chamber`, `beholder` panel       |

It is not an own app (no Home tab). It lives in the chat.

## The fun loop

1. **Something happens offscreen.** The timeline ticks and writes beats for watched subjects, guided by the play style's event pack.
2. **You notice part of it.** An alert, a sound, a hint from the voice, a sensor. Never the full truth by default.
3. **You choose.** Look closer (use a sense), act (use a hand), go there (the scene moves), or ignore it.
4. **The story reacts.** Seen facts become fixed. Watching has consequences: a subject can notice the camera, trust drops, plans change.
5. **New beats.** Ignored threads continue and can grow.

Rules that keep it fun:

- **Partial truth.** Each sense has a clarity (clear / blurry / sound only / rumour). The timeline knows more than you.
- **Later reveals.** Things you did not see can surface later ("Later you learn: she was not at Mia's").
- **Collisions.** An offscreen beat can enter the scene (the daughter comes downstairs, the thief trips the alarm). Sentinel hints this to the main model; it does not write the scene.
- **No spam.** Tension setting limits beats and alerts. Quiet periods are allowed.

## Building blocks

### Subjects (who and what is watched)

- People (NPC from the chat, or a name) and places (rooms, shop, street, ship deck).
- Each subject has: last known state (where, doing what, mood), when it was last observed, a hidden true state, open threads.
- Subjects come from the setup, the play style, or the story (Sentinel proposes, the user confirms).

### Senses (how you notice)

| Sense    | Shows                                   | Example skins                                         |
| -------- | --------------------------------------- | ----------------------------------------------------- |
| Look     | what is visible in a place now          | camera, scrying mirror, drone, peeking through a door |
| Listen   | sound only                              | baby monitor, bug, thin walls                         |
| Sensor   | one fact with a time                    | door / window sensor, motion, badge reader, ward      |
| Locate   | approximate place of a person           | phone location, tracker, familiar, informant          |
| Messages | what a subject writes or says to others | texts, letters, radio, gossip                         |
| Report   | a summary from someone else             | staff, spy, first mate, informant                     |

A play style picks which senses exist and their skin and clarity. A sense can fail, be blocked, or be noticed.

### Hands (optional actions)

Lock / unlock, lights, call or text a subject, send someone (staff, guard, spy), trigger an alarm. Actions become facts in the timeline and can be noticed.

### Voice (optional companion)

A persona that speaks about the offscreen world: house AI, ship computer, handler, familiar, butler, gossipy neighbour. Off by default for play styles where it does not fit (parent). Personality, trust and its own agenda (protects you, hides things, sides with someone) are settings.

## Play styles (presets = data)

| Play style            | Subjects                     | Senses (skin)                                                                                     | Hands                         | Typical beats                                                  |
| --------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------- |
| Parent / family       | kids, home                   | sensor (door/window), locate (phone), listen (thin walls), presence check, messages (family chat) | call, text, curfew            | sneaking out, secret friend, bad grade, fight, crying at night |
| Business owner        | shop, staff, rivals          | look (cams), report (staff), sensor (till)                                                        | call staff, close shop, alarm | theft, rush hour, staff drama, inspector                       |
| Detective             | suspects, places             | look (stakeout), messages (records), report (informant)                                           | tail, search warrant          | meeting, lie exposed, evidence moved                           |
| Long-distance partner | partner                      | messages, locate, photos                                                                          | call, surprise visit          | late night out, new friend, a gift                             |
| Horror                | the house                    | look (cams that lie), listen, sensor                                                              | lights, lock, run             | something moves when you do not look                           |
| Heist / spy           | guards, targets              | look (cams, loopable), listen (radio)                                                             | loop cam, cut power, distract | rotation change, alarm, betrayal                               |
| Ruler / captain       | city or ship, factions, crew | report (spies, officers), messages                                                                | send guards, orders           | plot, sabotage, rumour                                         |

Users can copy and edit a play style: subjects, senses and skins, hands, voice, event pack, tension.

## Privacy and safety rules (built in)

- Every subject and place has a privacy level: **open**, **private**, **off-limits**.
- Private (default for bedrooms and bathrooms): senses report presence and activity only ("lights on, music, at her desk on her phone"). No body, clothes or intimate details.
- Characters under 18: always treated as private, whatever the setting. Never intimate or sexual content in any sense result or beat.
- Off-limits: Sentinel does not generate senses or beats there.
- These rules sit in the sense and timeline prompts, not as disclaimers in the UI.

## Settings

- Play style (and edit it).
- Subjects: add, remove, privacy.
- Senses: on / off, skin name, clarity.
- Hands: on / off.
- Voice: off / on, persona, personality.
- Tension: calm / normal / dramatic (beat and alert frequency, how big beats get).
- Timeline updates: every turn / every 3 turns / only on time skips and "Check".
- Connection: which model runs the timeline and senses (a cheap one is fine).

## Standalone first, other agents optional

Works alone: own subjects, places, clock. If `world-state` is on, its time and location are used. If `hierarchical-maps` is on, its rooms can be linked. If `illustrator` is on, a Look can get a still image (only for open places). None is required.

## UI

Floating over the chat (pattern: Beholder's floating panel):

- **Bubble:** small button at the edge, alert count.
- **HUD:** compact card: newest alert with an action, watched subjects with a one-line last-known state and age ("Lily · her room · 40 min ago"), and quick senses.
- **Full panel:** phone = bottom sheet; desktop = movable, resizable window. Tabs: **Watch** (subjects), **Senses** (use them), **Log** (what you know, incl. later reveals), **Setup**.
- Sense results show as cards in the panel with "Share to scene".

## Open questions

1. Where the hidden timeline lives (per-chat variables, game state custom fields, or package storage) — swipe and branch safety matters.
2. How collisions reach the main model: a short hidden prompt hint before generation ("Lily may come downstairs soon") vs. only on user action.
3. Whether characters in the scene may use senses and hands as tools (needs package-defined tools in the Engine; today tools are Engine built-ins).
4. Event packs: same format as Slurp packs, or a new small format?
5. Cost guard: hard cap of timeline calls per hour?
