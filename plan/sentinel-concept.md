# Sentinel — look where you are not (concept v4)

Status: concept for review, 2026-11-04. No code, no issue, no PR (on request).
Name: Sentinel (package id `sentinel`). v4 replaces v3; the changes are listed at the end.

## The problem

In roleplay you often want to check on a place or a person that is not in the scene: the office cam, your daughter's room, the shop till, where your partner's phone is. Today you ask the narrator, and the narrator makes something up on the spot. Ask again later and the answer changes, or it ignores what the chat already said.

## The idea in one line

**Sentinel lets you look at and act on places and people outside the scene, gives an answer that fits the chat, and keeps that answer true afterwards.**

Sentinel does not simulate time or plan what absent people do. The chat is the only timeline. Sentinel answers one question: "what is true where I look, right now?" Background life is a separate concept (Meanwhile, branch `background-simulation`).

## How a look works

1. You look, in the story ("I quietly open Lily's door") or with a button (Look → Lily's room).
2. Sentinel makes one model call with: the subject, the sense, the recent chat, what earlier looks at this subject found, and the privacy level.
3. The answer is a short observation plus a few facts ("Lily: asleep", "window: closed").
4. The facts go into the log, stamped with the message they belong to.
5. Before the next reply, the narrator gets the observation as context, so the scene matches what you saw. Later replies get the found facts too, so the narrator does not contradict them.

The next look at the same subject must fit the earlier facts and what happened in the chat since then. Nothing else moves the facts.

## Acting: tell the butler

A free-text field: "turn up the heat in the office", "lock the front door", "play music in Lily's room", "tell Jonas to close the shop early". It works like a look, with the same single call:

1. You write the order in the panel (or, later, in the story: "Butler, lock the door").
2. Sentinel's call decides what happens, in a way that fits the chat and the setting: done, partly done, or not possible ("there is no lock on the back door").
3. The result is a short reply plus changed facts ("office heating: 24 °C", "front door: locked").
4. The facts go into the log, and the narrator gets them as context, so the scene reacts (the office gets warm, Lily hears the music).

The butler has a name and a short reply style per play style (house AI, butler, shop system, familiar). It answers in-world and does not comment on its own.

## Subjects

People, places and devices you can look at. Sentinel proposes them from the character cards and the chat ("Lily is mentioned often — add her?"). You can add and remove them.

## Senses

| Sense    | Gives                       | Example skins                        |
| -------- | --------------------------- | ------------------------------------ |
| Look     | what a place looks like now | camera, peek through a door, drone   |
| Listen   | what you hear there         | baby monitor, thin walls, radio bug  |
| Sensor   | one event with a time       | door/window sensor, motion, till log |
| Locate   | where a person is, roughly  | phone finder, tracker, familiar      |
| Messages | a recent message            | texts, letters                       |

A play style picks which senses exist and what they are called.

## Play styles (data, not code)

A play style is a list of sense skins and subject suggestions. Nothing else.

| Play style     | Sense skins                            | Subject suggestions         |
| -------------- | -------------------------------------- | --------------------------- |
| Parent         | peek, baby monitor, door sensor, phone | kids' rooms, front door     |
| Business owner | cams, till log, staff phone            | shop floor, till, back door |
| Generic        | camera, sensor, locate                 | from the chat               |

Users can copy a play style and rename skins and subjects.

## Privacy and safety (built in, not shown as warnings)

- Every subject: **open**, **private**, or **off-limits**.
- Private (default for bedrooms and bathrooms): presence and activity only. No body, clothes or intimate detail in any observation.
- Characters under 18 are always private, whatever the setting.
- Off-limits: no looks and no acts there.
- Acts follow the same rules as looks. An act on a private subject cannot produce intimate detail either.
- These rules sit in Sentinel's prompt and in the output filter.

## Settings

Play style · butler name · subjects and privacy · senses · acting (on / off) · in-story looks (on / off) · connection for Sentinel's calls.

## Standalone first, other agents optional

Works alone. Can link `hierarchical-maps` rooms as subjects and ask `illustrator` for a still of an open place. Neither is required.

## UI

- **In the chat:** a small "Sentinel" chip under replies that used an observation (tap: what was seen).
- **Floating panel:** bubble → panel with Look (subjects + sense buttons), an "Ask the butler" text field, and Log (found and changed facts). Beholder's floating panel is the pattern.

## Open questions

1. Storage of found facts with swipe and branch safety.
2. Detecting in-story looks ("I open her door") — keyword rules per skin first.
3. Cost: one call per look or act; a cap per hour.

## Changes from v3

- No clock, no threads, no ticks, no Living world mode. The chat is the only timeline.
- No pressure, backfire, hunches, truth modes or suspicions.
- Hands are now one free-text "Ask the butler" field. No separate voice persona; the butler answers in-world only.
- One model call per look; the log keeps answers consistent.
