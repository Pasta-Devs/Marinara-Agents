# Noodle release notes

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
