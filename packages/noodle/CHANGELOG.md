# Noodle release notes

## 1.4.0 — 2026-10-01

- You can now translate posts and comments, your own included. Pick Translate in a post's menu or under a comment, and use the same button to hide it again. Noodle uses the translator defaults you saved in a chat's Translation settings, or Google Translate into English if you have not saved any.
- In Chrome on Android, adding a picture to a post or comment now offers the camera as well as your files. The Marinara Android app doesn't offer the camera yet.
- Noodle's description now says what it is in plain words.

## 1.3.1 — 2026-09-30

- When Noodle cannot load, it now says so instead of showing an empty timeline. If Marinara Engine blocked it because this device has no Admin Secret, it explains how to set one.

## 1.2.25 — 2026-09-24

- Widgets on Homescreen now available.

## 1.2.24 — 2026-09-15

- Search icons and post menus keep Noodle's selected accent when Engine Chroma animates.

## 1.2.23 — 2026-09-13

- Applying a saved prompt asks before replacing the current prompt, including edits already saved as the active prompt.
- Cancel works immediately in Delete All Noodle Data; only deletion requires typing DELETE.
- A running timeline refresh blocks duplicate refresh requests instead of queuing extra generations.
- GLM 5.3 on NanoGPT and Z.AI keeps its required reasoning enabled when the selected effort is None.

## 1.2.22 — 2026-09-13

- Maintenance: simplify the inline composer's visibility checks and remove unused code.

## 1.2.21 — 2026-09-07

- Fixed "Load more" on the timeline, which failed on every page after the first.
- Fixed a manually chosen profile avatar being replaced by the character card image.
- Applying a saved prompt now asks before it discards unsaved prompt changes.
- Ambient accounts no longer post images.
- Removed leftover NoodleR wording from the image generation settings.

## 1.2.20 — 2026-09-03

- Added independent image width and height settings to Noodle settings.

## 1.2.19 — 2026-09-03

- Fixed automatic timeline refresh when Marinara requires an admin secret on loopback.

## 1.2.18 — 2026-09-03 [highlight]

- Test the agent changelog feature with a highlighted patch release. No features were added.
