# Sentinel — the world outside the scene (concept v3)

Status: concept for review, 2026-11-04. No code, no issue, no PR (on request).
Name: Sentinel (package id `sentinel`). v3 replaces v2; the changes are listed at the end.

## The problem

In roleplay the world only exists where the scene is. While you are in the kitchen, nothing happens in your daughter's room. Your shop does not run while you are away. When the story goes back there, the model invents a past on the spot — usually nothing happened, or something that contradicts earlier facts.

## The idea in one line

**Sentinel gives absent characters and places their own secret plans, keeps those plans true, and lets you find them out — by playing, not by clicking.**

## Three principles

1. **The story is the interface.** You do not need the panel. When you write "I quietly open Lily's door", Sentinel tells the main model what is really behind that door, and the main model writes the scene. Buttons in the panel are shortcuts, not the game.
2. **Plans, not a diary.** Sentinel does not write a minute-by-minute timeline. Each absent subject has a few **threads**: secret plans with stages (for example "Sneak out to the skate park party": plan → prepare → leave → be out → come back). Threads advance with story time. Every stage leaves **traces** (window open, pillows under the blanket, phone gone) that senses and scenes can find.
3. **Knowing has a price.** Every play style has one **pressure** value that watching pushes up: trust for a parent, heat for a thief, morale for staff, suspicion for a spy. Watch nothing and threads land without you. Watch everything and people hide better, get angry, or leave.

## How a thread works

```
Lily · "Saturday night"        ■■■□□  (stage 3 of 5: she is out)
  stage 1  asks to sleep at Mia's        trace: a too-casual question at dinner
  stage 2  hides shoes by the window     trace: shoes missing from the hallway
  stage 3  leaves through the window     traces: window open, pillows, phone gone
  stage 4  at the skate park party       traces: phone location, music in the background
  stage 5  back home before 3 a.m.       traces: wet hair, smell of smoke, tired at breakfast
  lands if nobody stops it: you hear about it a week later from Mia's mother
```

- **Code moves threads, not the model.** A tick is a cheap roll against story time and tension. No model call.
- **The model writes only when it matters:** a new thread is authored (rare), a sense is used (on demand), a subject enters the scene (handoff), or a thread lands.
- **You only see what you found.** The panel shows found traces and empty boxes for the rest.

## The moments that make it fun

| Moment                  | What happens                                                                                                                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hunch**               | A small sign reaches the scene ("a car stops outside, then drives off"). It can come in the narration, in the HUD, or both (setting).                                                                                                  |
| **Look**                | You use a sense, in the story or with a button. You get traces, never the plan itself.                                                                                                                                                 |
| **Catch**               | You reach a thread at the right stage: you can stop it, confront, or let it run.                                                                                                                                                       |
| **Handoff**             | An absent subject enters the scene. Sentinel tells the main model their true state ("Lily comes in through the back door, hair wet, smells of smoke"). While on screen they are not ticked. When they leave, they are offscreen again. |
| **Landing**             | A thread nobody stopped finishes. Its consequence enters the story, often later ("Later you learn…").                                                                                                                                  |
| **Backfire**            | Watching is noticed. Pressure rises, the subject changes the plan or starts a new thread against you.                                                                                                                                  |
| **While you were away** | You return to a place or person. Sentinel gives a short "what changed" card, built from the threads that moved.                                                                                                                        |

## Not every secret is bad

Threads come in flavours: **trouble** (sneaking out, stealing), **personal** (a crush, a bad grade, a hobby), **kind** (Lily is saving for your birthday gift; Jonas covers for a sick colleague). Finding a kind secret early can spoil it — a twist, not a punishment. The **truth mode** setting picks the mix:

- **Cozy:** mostly personal and kind threads; trouble is small.
- **Fair:** the mix comes from the play style; the truth is fixed once a thread starts.
- **Dramatic:** more trouble; threads can escalate and cross each other.

## Your suspicions

You can tell Sentinel "I think Jonas is stealing". Sentinel does not simply say yes. Depending on truth mode and tension it makes the suspicion **true, partly true, or wrong** — and you have to find out which. Wrong suspicions are a story too: accuse him, and morale drops.

## Building blocks

### Subjects

People and places that are not in the scene right now. Sentinel proposes them from the character cards and the chat ("Lily is mentioned often — watch her?"). Characters with a card keep their personality: their threads come from their card, not from a generic list.

### Senses (how you notice)

| Sense    | Finds                                             | Example skins                                      |
| -------- | ------------------------------------------------- | -------------------------------------------------- |
| Look     | traces in a place                                 | camera, peek through a door, scrying mirror, drone |
| Listen   | sound traces                                      | baby monitor, thin walls, radio bug                |
| Sensor   | one trace with an exact time                      | door/window sensor, motion, till log, ward         |
| Locate   | where a person is, roughly                        | phone finder, tracker, familiar                    |
| Messages | what a subject tells others                       | texts, letters, gossip                             |
| Report   | another person's account (can be wrong or biased) | staff, spy, neighbour, first mate                  |

Each sense has a clarity and a chance to be noticed. A play style decides which senses exist and what they are called.

### Hands (optional)

Call, text, lock, send someone, set a rule (curfew). Hands can stop or change a thread, and they raise pressure too.

### Voice (optional)

A persona that comments: house AI, butler, handler, familiar, nosy neighbour. Off for the parent style by default, on for heist or ship. The voice can have its own agenda (protects the kids from you, sells you out).

## Modes

- **Watcher (full):** threads + senses + hands + pressure.
- **Living world (light):** threads only. No senses, no panel needed. You get handoffs and "while you were away" cards. Good for any long roleplay that should feel alive.

## Play styles (data, not code)

| Play style            | Pressure              | Senses                                    | Thread examples                                                    |
| --------------------- | --------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| Parent                | trust                 | sensor, locate, listen, peek, family chat | sneaking out, secret friend, bad grade, saving for a gift          |
| Business owner        | staff morale          | cams, till log, staff report              | theft, slacking, rival poaching staff, staff covering for a friend |
| Detective             | suspect's alertness   | stakeout, records, informant              | hide evidence, meet accomplice, flee town                          |
| Long-distance partner | jealousy              | messages, locate, photos                  | new friend, surprise visit planned, job offer                      |
| Horror                | the house's attention | cams that lie, sounds                     | something moves closer each night                                  |
| Heist / spy           | heat                  | cams, radio                               | guard rotation, insider doubts, trap                               |
| Ruler / captain       | unrest                | spies, officers' reports                  | plot, sabotage, rumour                                             |
| Living world          | none                  | none                                      | anyone's life goes on                                              |

Users can copy a play style and edit everything: subjects, senses, pressure name, thread library, voice.

## Privacy and safety (built in, not shown as warnings)

- Every subject and place: **open**, **private**, or **off-limits**.
- Private (default for bedrooms and bathrooms): presence and activity only. No body, clothes or intimate detail in any sense result, hunch or handoff.
- Characters under 18 are always private, whatever the setting. Their threads never contain sexual content.
- Off-limits: no senses and no threads there.
- These rules sit in Sentinel's prompts and in the thread library format.

## Settings

Play style · mode (watcher / living world) · subjects and privacy · senses · hands · voice · tension (calm / normal / dramatic) · truth mode (cozy / fair / dramatic) · hunches (in story / in HUD / both) · connection for Sentinel's calls.

## Standalone first, other agents optional

Works alone with its own story clock. Uses `world-state` time when present (threads follow story time much better than turn counts). Can link `hierarchical-maps` rooms. Can ask `illustrator` for a still of an open place. None is required.

## UI

- **In the chat:** hunches as narration or small inline notes; a tiny "Sentinel" chip under replies that used hidden truth (tap: what was used, only already-found facts).
- **Floating:** bubble (pressure ring + new-hint badge) → HUD (newest hunch with actions, subjects with found progress) → full panel (Watch · Senses · Log · Setup). Beholder's floating panel is the pattern.

## Open questions

1. Storage of hidden thread state with swipe and branch safety.
2. Detecting in-story sense use ("I open her door") — keyword rules per sense, a small classifier call, or the main model's own tool call later.
3. How a handoff reaches the main model: hidden prompt line before generation (leaning yes).
4. Thread library format (stages, traces, flavour, landing) and how cards shape threads.
5. Cost cap per hour for Sentinel's calls.

## Changes from v2

- The story is the main interface; the panel is optional.
- Threads with stages and traces replace a model-written timeline (cheaper and consistent).
- Pressure gives every play style a real cost for watching.
- Kind and personal secrets, truth modes, and user suspicions.
- Handoff and "while you were away" make absent characters consistent when they return.
- New light mode "Living world" for any long roleplay.
