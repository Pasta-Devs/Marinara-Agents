# Quartermaster changelog

## 0.1.20 — 2026-09-26
- Rebuilding the dock now closes its dialogs and clears their pending sessions.
- A late wardrobe confirmation cannot replace a newly opened dialog or another chat's view.

## 0.1.19 — 2026-09-26
- Available from the official staging Download Agents catalog with Professor Mari's armored
  Quartermaster cover and installation guidance.
- Closing the dock also closes its dialogs; an old image-prompt preview cannot replace a later
  dialog or another chat's preview. Failed inventory exports now report their error.
- A failed outfit save cannot overwrite an existing outfit's portrait.

## 0.1.18 — 2026-09-19
- Fixed the Settings avatar-swap toggle showing a stale value from the previous chat after a
  failed reload.
- Fixed a failed image delete permanently hiding an item's picture instead of just the delete.
- Fixed the Build Wardrobe and Generate Image modals letting a stale, still-running generation
  overwrite what a later session in the same modal was showing.
- Fixed the tracker panel briefly reappearing over the toolbar button in a rare mount-reuse case.
- Corrected the README's stated minimum Engine version to 2.4.6, matching the manifest.

## 0.1.17 — 2026-09-18
- Raised the minimum required Engine version to 2.4.6, matching what this has actually been
  tested against recently.

## 0.1.16 — 2026-09-16
- Brief toast notifications now appear when the tracker agent adds, updates, equips, or removes
  an item -- visible even with the dock closed.
- Items can now be favorited with a star, which sorts them to the top of the Bag.

## 0.1.15 — 2026-09-15
- Fixed the Recent Agent Update box leak for real this time — 0.1.13 and 0.1.14 were both
  attempted fixes that didn't fully resolve it.
- Widened the info tooltip box so long macro tokens read on one line.

## 0.1.14 — 2026-09-15
- Attempted fix for the Recent Agent Update collapsed-box leak (0.1.13's attempt didn't fully
  resolve it either).
- Fixed tooltip text overflowing outside its own box.

## 0.1.13 — 2026-09-14
- Attempted fix for Recent Agent Update's collapsed box showing a sliver of Restore Inventory
  underneath.
- Info tooltips and card overflow menus no longer clip against the dock's edge.
- Shrank the item card's quantity field to match the "⋯" button beside it.
- "+ Add Item" is now green, matching Save Current Outfit.

## 0.1.12 — 2026-09-14 [highlight]
- Settings moved to its own tab instead of an accordion pushing inventory below the fold.
- Settings regrouped into Appearance/Display/Image Generation/Data, with hover-and-tap tooltips
  replacing permanent explanation text.
- Recent Automatic Update (renamed Recent Agent Update) moved next to Restore Inventory, with a
  colored +N/↑N/−N count summary and visible reasoning even on quiet turns.
- Item and outfit cards collapse Edit/Update/Delete into a "⋯" menu, giving descriptions more
  room.
- Delete confirmations now also cover the item-image and outfit-portrait remove buttons.
- Add Item is now a modal instead of an always-open form.

## 0.1.11 — 2026-09-13 [highlight]
- The tracking agent now targets specific changes instead of re-listing the whole inventory every
  turn, so nothing gets dropped or cut off.
- Added a "Recent Automatic Update" view showing what the last turn changed, with a per-item
  Revert button.

## 0.1.10 — 2026-09-13
- Rewrote the README's Features section for readability and documented several
  previously-undocumented features.
- Updated the in-app description to mention saved outfits, AI-generated art, and the tracker
  agent.

## 0.1.9 — 2026-09-11
- Fixed equip-slot quick-fill only searching the Wearables tab, missing stashed wearable items.

## 0.1.8 — 2026-09-11
- Confirmed fix: Generate Image no longer shows a person in item images.
- Bag column now splits into Items, Wearables, and Stored tabs.

## 0.1.7 — 2026-09-09
- Attempted fix for Generate Image sending the persona's appearance into item/outfit image
  requests instead of a clean product shot.
- Build script now refuses to silently overwrite an already-released version's artifact.

## 0.1.6 — 2026-09-08 [highlight]
- Added Generate Image: an AI-generated alternative to uploading, for both item images and
  outfit portraits.
- New Settings section to pick the image connection and edit the two prompt templates.
- Fixed the portrait prompt leaking a raw appearance-macro token into the image request.
- Export/import now carry the two prompt templates.

## 0.1.5 — 2026-09-08
- Fixed Build Wardrobe producing no debug-log output.
- Replaced the dock's 5-second inventory poll with an event-driven refresh.

## 0.1.4 — 2026-09-08 [highlight]
- Added Build Wardrobe: describe a style and get a proposed set of items and outfits to review
  before adding.
- Outfits it builds can reuse existing wearable items instead of always creating new ones.
- Fixed non-wearable items sometimes turning up in a generated outfit.

## 0.1.3 — 2026-09-07 [highlight]
- Fixed inventory silently wiping every turn due to a misconfigured result type.
- Outfits now stay equipped when extra items are added alongside them.
- Added a "Restore Inventory" safety net and a "Refresh Images" button.
- Fixed a rendering bug hiding an equip slot's labels behind its fallback icon.

## 0.1.2 — 2026-09-05 [highlight]
- Added a decorated portrait frame and bundled artwork for every equip slot.
- Redesigned item/outfit cards to size themselves to their own content.
- Outfits got a reworked save/edit flow.
- Columns can collapse to narrow the dock.
- Added delete confirmations and Escape-to-close.

## 0.1.1 — 2026-08-30
- Theme-aware dropdowns and real button hover/press states.
- Fixed a portrait-ring shift with the underwear toggle.
- Added an animated Settings section and click-outside-to-close.

## 0.1.0 — 2026-08-28 [highlight]
- Equip slots around a portrait, item locations, and saved outfits.
- Export/import, the appearance macro, and the narrator context feed.
- An agent that keeps inventory in sync automatically from the story.
