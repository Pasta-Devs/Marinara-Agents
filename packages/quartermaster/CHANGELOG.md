# Quartermaster changelog

## 0.1.13 — 2026-09-14
- Fixed Recent Agent Update's collapsed box showing a sliver of Restore Inventory underneath —
  its vertical padding wasn't included in the collapsed max-height. Also shrank its header text.
- Info tooltips and card overflow menus no longer clip against the dock's own edge; they now flip
  to whichever side actually has room.
- Shrank the item card's quantity field to match the "⋯" button beside it.
- "+ Add Item" is now green, matching Save Current Outfit.

## 0.1.12 — 2026-09-14 [highlight]
- Dock layout overhaul: Settings moved to its own top-level tab (Inventory/Settings) instead of an
  accordion, grouped under Appearance/Display/Image Generation/Data, with hover-and-tap info
  tooltips replacing permanent explanatory paragraphs.
- Recent Automatic Update (renamed Recent Agent Update) moved into Settings' old spot next to
  Restore Inventory: collapsed header shows a +N/↑N/−N count, rows are colored, Revert sits on the
  left, and it now shows the agent's reasoning even on a quiet turn.
- Item/outfit cards collapse Edit/Update/Delete into a "⋯" menu and promote Equip to the name row,
  giving descriptions the reclaimed width. Delete still confirms; the item-image and outfit-portrait
  remove buttons now confirm too (they didn't before).
- "Stored at: Bag" and "Default Slot" no longer render when they carry no information.
- Add Item is now a modal instead of an always-open inline form.

## 0.1.11 — 2026-09-13 [highlight]
- The tracking agent now targets specific changes (add/update/remove an item, equip an outfit)
  instead of re-listing the whole inventory every turn, using a short tag for existing items
  instead of retyping names. An item the model doesn't mention is never dropped, and a large
  inventory can't have the model's own output cut off mid-listing and lose whatever didn't fit.
  An implausibly large turn is rejected outright rather than applied.
- Added a "Recent Automatic Update" view in Settings: what the last turn added, changed, or
  removed, with the tracker's reasoning and a per-item Revert button for fixing one mistake
  without reverting everything else. A revert refuses rather than overwriting if that item has
  changed again since.

## 0.1.10 — 2026-09-13
- Rewrote the README's Features section for readability and completeness: organized by what you
  actually interact with (the Dock, Equip Slots & Outfits, Inventory, Item Images, the tracking
  agent, the Appearance Macro, the Tracker Panel) instead of a flat bullet list, and documented
  several real features that were previously undocumented -- the Bag's Items/Wearables/Stored
  tabs, outfit resnapshotting, the "stays equipped through extras" behavior, the Tracker Panel's
  per-stash grouping, the Refresh Images setting, and Build Wardrobe sharing its LLM connection
  with the tracking agent.
- Updated the in-app description (shown in Download Agents) to mention saved outfits, AI-generated
  art, and the tracker agent's own automation -- it hadn't been touched since before those
  features shipped.

## 0.1.9 — 2026-09-11
- Fixed a regression from 0.1.8's new Bag tabs: clicking an empty equip slot's quick-fill
  shortcut only searched the Wearables tab, so a wearable item currently stashed (Stored tab)
  couldn't be found or equipped from there at all. The slot-driven search now reaches every
  wearable regardless of tab, matching how it worked before tabs existed.

## 0.1.8 — 2026-09-11
- Confirmed fix: the 0.1.7 persona-leak fix for Generate Image resolved the reported issue --
  item images no longer show a person.
- The Bag column now splits into three tabs -- Items, Wearables (anything with a default slot
  set), and Stored (anything in a named stash) -- instead of one flat list, so a chat with a lot
  of stuff is easier to scan. Clicking an empty equip slot's quick-fill shortcut now also jumps
  the Bag to the Wearables tab, since only a wearable item can ever fill a slot that way.

## 0.1.7 — 2026-09-09
- Attempted fix for Generate Image (0.1.6) sending the persona's appearance into item/outfit image
  requests instead of a clean product shot -- the request now matches the exact shape confirmed
  working against this same Engine, rather than an unverified one copied from another package.
  Reported by a real user; pending final confirmation it fully resolves it.
- A build-script safety check now refuses to silently overwrite an already-released version's
  artifact file under the same filename.

## 0.1.6 — 2026-09-08 [highlight]
- Added Generate Image: an AI-generated alternative to uploading, for both item images and outfit
  portraits. Review (and optionally edit) the filled-in prompt before generating.
- New Settings section picks which image connection to use and lets you edit the two prompt
  templates, pre-filled with sensible defaults to edit from rather than write from scratch.
- The portrait prompt no longer leaks a raw {{getvar::...}} appearance-macro token into the image
  request when the persona's Appearance field uses it.
- Export/import now carry the two prompt templates along with everything else.

## 0.1.5 — 2026-09-08
- Fixed Build Wardrobe producing no debug-log output even with Debug Mode enabled -- the
  request/response now log correctly.
- Replaced the dock/tracker panel's 5-second inventory poll with an event-driven refresh right
  after a turn completes, cutting needless network requests.

## 0.1.4 — 2026-09-08 [highlight]
- Added Build Wardrobe: describe a style direction and get a proposed set of new items and
  outfits to review before adding them to inventory.
- Outfits it builds can reuse your existing wearable items instead of always creating new ones.
- Generation uses the tracker agent's own configured connection, so switching that in the Agents
  menu also moves this.
- Fixed non-wearable items (a phone, a wallet) sometimes turning up in a generated outfit.

## 0.1.3 — 2026-09-07 [highlight]
- Fixed inventory silently wiping every turn: the tracker agent's resultType was misconfigured as
  a text-only result, so its JSON response never actually got parsed.
- Outfits now stay equipped when extra items get added alongside them — only swapping one of the
  outfit's own items unequips it — and the appearance macro reflects that.
- Added a "Restore Inventory" safety net and a "Refresh Images" button, both under Settings.
- Fixed a rendering bug that hid an equip slot's name/item labels behind its fallback icon.
- Stopped repeatedly re-requesting (and console-flooding) images already confirmed missing.

## 0.1.2 — 2026-09-05 [highlight]
- Added a decorated portrait frame with connector lines to each equip slot.
- Added bundled artwork for every equip slot.
- Redesigned item/outfit cards to size themselves to their own content instead of clipping or
  growing unbounded.
- Equip slots now show the item's full image.
- Outfits got a reworked save/edit flow.
- Columns can collapse to genuinely narrow the dock.
- Added delete confirmations and Escape-to-close.

## 0.1.1 — 2026-08-30
- Theme-aware dropdowns.
- Fixed a portrait-ring shift with the underwear toggle.
- Real button hover/press states.
- Consistent styling.
- Added an animated Settings section.
- Added click-outside-to-close.

## 0.1.0 — 2026-08-28 [highlight]
- Equip slots around a portrait.
- Item locations.
- Saved outfits.
- Export/import.
- The appearance macro.
- The narrator context feed.
- An agent that keeps inventory in sync automatically from the story.
