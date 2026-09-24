# Noodle release notes

## 1.3.0 — 2026-09-24

- Widgets on Homescreen now avaliable.

## 1.2.33 — 2026-09-24

- Add a subtle Noodle-blue background gradient and compact widget subtitle.

## 1.2.32 — 2026-09-24

- Fix compact widget mounting and provide Noodle theme variables inside isolated Home widget mounts.

## 1.2.31 — 2026-09-24

- Add a compact Noodle Snapshot widget and make like and repost controls perform native Noodle interactions.

## 1.2.30 — 2026-09-24

- Remove the manual refresh button from the Home widget. The feed continues to refresh automatically.

## 1.2.29 — 2026-09-24

- Align the Home widget with Noodle timeline styling, show twenty posts, and make post summaries keyboard and pointer interactive.

## 1.2.28 — 2026-09-24

- Fix a render error that could leave the native Latest Posts widget blank when posts were available.

## 1.2.27 — 2026-09-24

- Make Latest Posts a native Noodle widget with the Noodle logo, avatars, handles, media, polls, and live interaction counts.

## 1.2.26 — 2026-09-24

- Give the Latest Posts Home widget a rich package-owned surface with live status, refresh controls, metadata, and direct Noodle navigation.

## 1.2.25 — 2026-09-24

- Offer a large Home widget with a scrollable preview of the five newest public posts. Opening a preview takes you to that post in Noodle.

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
