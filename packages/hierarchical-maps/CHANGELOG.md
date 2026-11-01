## 1.8.0 — 2026-11-01
- **The Story Location bar always shows where you are.** In a deep map the bar used to show the path from the top, so the place you are actually in was cut off. It now shows as much of the path as fits, ending with your current place and starting with "…" when places above are left out. Open the bar to see the full path, and choose what the bar shows: as much as fits, your current place only, your place and the two above it, or the full path as before. The choice is kept on this device; hovering the bar still shows the full path.

## 1.7.1 — 2026-10-23
- Require the Engine version that supplies agent reference lorebooks, so an older Engine with a different capability update cannot accept an incompatible World Maps package. Update both the Engine and World Maps together.

## 1.7.0 — 2026-10-23
- World Maps can use the reference lorebook selected for it in Chat Settings. Matching entries help chat-specific map creation, replacement, expansion and prompt previews without changing the map builder's other lore sources or global templates. Update both the Engine and World Maps to use this setting.

## 1.6.0 — 2026-10-23
- When the Game Master moves the party to a place more than one step away on the map, such as a boat to the next town, the map now follows by the shortest route instead of staying put. Before, only a move to a place one step away (a place inside, the place around it, or a linked place) moved the map.

## 1.5.2 — 2026-10-20
- World Maps now uses Marinara Engine's own chat state, notifications and libraries instead of carrying copies of them. A pending map move you cleared no longer comes back, and its notifications appear where you put yours. The download is smaller. It needs a Marinara Engine release after 2.5.0. On 2.5.0 and older, the version you already have keeps working. (#1487)

## 1.5.1 — 2026-10-01
- The description now says what it does in plain words.

## 1.5.0 — 2026-09-30
- Maps can now hold up to 5,000 locations instead of 500, so a whole world fits with its buildings, floors and rooms. Game Mode uses these larger maps on Marinara Engine versions that include the matching update; older versions skip a map over 500 locations when a game starts.

## 1.4.3 — 2026-09-20
- Child-location maps now use the same square canvas in the editor and runtime, keeping square artwork aligned with the 100×100 coordinate grid. The background picker includes image size guidance.
