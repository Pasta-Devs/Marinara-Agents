# Quartermaster

A per-chat RPG character sheet and inventory manager with equip slots around your character's
portrait, a full inventory with item locations, saved outfits, and AI-generated images — in a
draggable floating dock, plus a native Tracker Panel view.

**Requires Marinara Engine 2.4.6+.** Roleplay only (no Game Mode yet), persona only (no party/NPC
support yet).

## Install and enable

Open **Agents → Download Agents**, install **Quartermaster**, and restart
when prompted. In each Roleplay chat, open **Chat Settings → Agents**, enable agents, add
Quartermaster under **Tracker Agents**, and select its model connection. Installing the package
does not enable it in every chat. Open its dock from the launcher above the Tracker Panel.

## The main feature: an LLM tracker that runs on its own

Quartermaster's core feature is the tracking agent — set it up once, and it keeps running every
turn without you ever needing to open the dock again. It reads the story and creates, equips,
unequips, stores, and discards items on its own, no manual upkeep required.

Everything else is optional, for when you want more:
- **Outfits and images** are extras for anyone who wants deeper wardrobe management or visuals —
  not required to get value from the tracker.
- The **appearance macro** only updates automatically if you've placed it in your persona card's
  Appearance block; leave it out and Quartermaster won't touch your persona at all.

## The Dock

Opened from the chevron above the Engine's native Tracker Panel. A floating, resizable window with
its own UI Size and Thumbnail Size controls, split into two top-level tabs:

- **Inventory** — Pending Item Changes (only while the agent is waiting on you, see Hidden Items
  below) and Recent Item Updates (see below) above three sections: **Outfits**, **Equipped
  items** (around your portrait), and **Bag**. Each section can be collapsed to a narrow strip to
  save space, and they stack vertically instead of side-by-side once the dock (or your screen) gets
  narrow.
- **Settings** — grouped under Appearance, Hidden Items, Display, Image Generation, and Data, with a
  small `?`
  next to anything that needs more explaining than its label alone — tap or hover it for details,
  rather than a permanent paragraph taking up space whether you need it or not.

Matches whatever theme you're running — no separate light/dark setting to configure. Should work on
mobile, though this hasn't actually been tested yet.

## Equip Slots & Outfits

**24 equip slots** arranged around the portrait: head, neck, eyes, ears, armor (torso/legs),
three clothing layers each for torso and legs, underwear (top/bottom), back, hands, a weapon slot
for each hand, belt, socks, feet (footwear), and three Extra Wearable slots. Each slot shows the
equipped item's own image, or built-in art if it doesn't have one.

**Layered clothing** goes inside out, one item per layer: **Inner** clothing is the first layer
over underwear, **Mid** goes over it, and **Outer** over that. A suit is a dress shirt (inner), a
waistcoat (mid), and a jacket (outer); shorts over tights put the tights in inner and the shorts in
mid. Something worn on its own just uses the inner slot. On the portrait ring each region's three
layers share one stack of cards: the front layer shows in full, the others as narrow tabs beside it
(outlined like any slot when something's worn there). Use the arrows on the card, or tap a tab, to
bring another layer to the front. The outermost worn layer is in front when the dock opens.
The **Extra Wearable** slots are for anything worn that no other slot fits — a second necklace,
rings, a coat over a suit jacket.

**Saved outfits** snapshot your current equip state under a name, and can carry their own
description text too (the whole-look description — this feeds both outfit-portrait generation and
Build Wardrobe):
- Equip/Unequip, edit, or **resnapshot** it (update it to whatever's currently equipped) any time.
- The dock shows which outfit (if any) is currently active — and it *stays* marked as equipped
  even if you add something extra on top (a pickup, an accessory). Only swapping out one of the
  outfit's own pieces actually unequips it.
- Give an outfit its own portrait (uploaded or generated) and the dock shows that in place of
  your persona's usual avatar whenever it's equipped. An opt-in setting can push this to your
  persona's *real* Marinara avatar too — see "Before enabling..." below before turning it on.
- **Hide** an outfit from its ⋯ menu to keep it from the agent (see Hidden Items below).

## Inventory (the Bag)

**+ Add Item** opens a small modal (name, description, quantity, and where it lives) rather than
leaving an add form always open and eating space above the list:
- **Bag** (just carried), a **named stash** (e.g. "in the car," "at home" — not carried on your
  person), or **equipped** in a specific slot.
- Give an item a **default slot**, so it always knows which slot it belongs to when equipped using
  the "Equip" buttons.

Each item's card shows Hide, Edit and Delete behind a small **⋯** menu — only Equip stays a
visible button — so the description gets more room instead of clipping. Turn on **Quick delete**
in Settings → Display to also get a Delete button on every item and outfit card (it still asks
first). Quick delete is saved in this browser, so it applies to every chat on this device. Slot and stash info only shows on
the card when there's actually something to say (a default slot set, or a named stash) — a plain
bag item with no default slot shows neither line at all.

The Bag is split into four tabs so a busy inventory stays easy to scan:
- **Items** — everything else.
- **Wearables** — anything with a default slot set.
- **Stored** — anything tucked away in a named stash (this wins over "wearable" if both apply).
- **Hidden** — items you've hidden. By default they show only here; turn off "Hidden items only in
  the Hidden tab" to also see them, marked Hidden, in their usual tab.

Other conveniences:
- **Quantity** adjusts right on the item's card — no need to open the full editor for the one
  field you're touching constantly.
- **Favorite** an item with the star next to its name — favorited items always sort to the top of
  whichever Bag tab they're in, so frequently-used items don't get buried as the list grows.
- **Search** works two ways: by name, or by which slot an item's set to fill by default.
- Click an **empty equip slot** on the portrait ring and the Bag auto-filters to whatever could
  actually fill it — including stashed items, not just what's sitting loose in the bag.
- **Export/Import** your whole setup (items, outfits, settings) as a JSON file — carry your setup
  between chats, or back it up before reinstalling Marinara Engine.

## Hidden Items & Locked Descriptions

**Hide** an item or outfit from its ⋯ menu when the agent shouldn't know about it (a surprise
gift, a disguise, something stashed away). The agent never sees a hidden item, except while you're
wearing it: putting one on shows it for as long as it's worn, and taking it off hides it again.
Hiding something you're wearing takes it off. Equipping an outfit always puts on and takes off its
hidden pieces, whoever equips it. The agent can always take off a hidden item you're wearing.

Settings → Hidden Items decides what happens when the agent tries to change a hidden item anyway:
- **Ask before agent changes to hidden items** (on by default): the change waits for you. A popup
  shows what would change, side by side, with **Accept changes** and **Keep old item details**.
  Closing the popup leaves the change under **Pending Item Changes** in the dock until you decide.
  If the item changed in the meantime, you see all three versions and pick which to keep. Accepted
  changes appear in Recent Item Updates and can be reverted.
- **Hidden item access** (used when not asking; when asking, it only decides whether the popup's
  "Show (unhide) this item" box starts ticked):
  - *Only you can change it — stays hidden* (default): the agent's changes are skipped. It can
    still take a worn hidden item off.
  - *Only you can change it — becomes shown*: the agent's description, quantity and removal
    changes are skipped, but it can equip or move the item, which then shows it.
  - *Agent can change it — stays hidden*: the agent's changes apply. It stays hidden, showing only
    while worn.
  - *Agent can change it — becomes shown*: the agent's changes apply and the item becomes shown.
- **Build Wardrobe can use hidden items** (off by default): see Build Wardrobe below.
- **Hidden items only in the Hidden tab** (on by default): see the Bag tabs above.

**Lock** an item's description with the lock button at the top of the description in its editor.
The agent then never changes that description, hidden or not; the card shows a small lock. Your
own edits still work, and so do changes you choose yourself (accepting a pending change, Revert,
Restore Inventory, or overwriting it in Build Wardrobe).

These settings are per chat, are included in Export/Import, and leave pending changes out of the
export.

## Item Images & Generated Art

Give any item — or any saved outfit — its own picture, three ways:
1. **Auto-match**: drop images into your Engine's `data/gallery/quartermaster/items` folder, named
   to match; item pictures show up on their own. This makes sharing a full image pack with friends
   as simple as sharing that folder.
2. **Upload** one directly from the item or outfit's card.
3. **Generate** one with AI: pick Generate, review (and optionally tweak) the filled-in prompt,
   then go. Uses whichever image connection you've picked in Settings → Image Generation, and both
   prompt templates (item images, outfit portraits) are fully editable there too — pre-filled with
   sensible defaults so you're editing, not writing from scratch.

An image you upload or generate is **saved to the item**: it keeps that picture even if you rename
it. Everything else is matched by name, as before: image-pack files, images uploaded before
Quartermaster 0.1.32 (saved to the item the first time it's renamed), and items you've unlinked.
Image files are shared by name across chats, so an "Apple" in another chat with no saved image of
its own shows the same picture. A new image never replaces an existing file; it's saved as
`apple (1).png`, `apple (2).png` and so on.

- **Bag cards** have an **[i]** on the image showing the file and where it came from: *Uploaded
  filename*, *Generated filename*, or *Matched by name*.
- The **item editor** shows the same under the item's name, with **Unlink** when the image is
  saved to the item. Unlink only changes this chat's item: it goes back to matching its name, and
  the file stays. Rename "Apple" to "Orange", unlink, and it picks up an orange image if there is one.
- The **×** on the image in the item editor offers **Delete file**, which deletes the image file for
  every item using it in every chat, or **Unlink**. Image-pack files (in a subfolder) are never
  deleted from Quartermaster.

Settings also has a **Refresh Images** button, which re-checks every item for a matching image. If
you've just dropped new images into the gallery folder for items that were missing pictures, click
Refresh Images and they'll pick up the new files.

## The Quartermaster Agent (automation)

An agent that reads each turn's narration and keeps your inventory in sync on its own — adding and
removing items, equipping and unequipping them (individually or as a full saved outfit) as the
story calls for it. Its prompt is fully editable from the Agents menu, within the constraints of
the JSON output it needs to produce. (A customized prompt keeps your version after updates, so
reset it to the default to pick up new slots or rules from a newer version.) It targets specific changes each turn rather than re-stating
the whole inventory, so an item it doesn't mention is never at risk of being dropped, no matter how
large your inventory gets.

- **Build Wardrobe**: describe a style in plain language and get back a proposed set of new items
  and outfits to review before anything's added — it'll reuse wearable items you already have
  instead of always inventing new ones. Uses the *same* connection as the tracking agent (set once
  in the Agents menu — switch it there and both move together). Hidden items are left out unless
  you turn on "Build Wardrobe can use hidden items". Whenever a proposal uses a hidden item, you
  see its details beside the new ones and choose **Overwrite with new details**, **Keep hidden
  item's details**, or **Skip** (the default, which leaves it out of those outfits), and whether to
  show it again.
- **Recent Item Updates**: a collapsible section on the Inventory tab (right next to Restore
  Inventory below) showing what the last turn actually added, changed, or removed — colored rows
  (green/yellow/red) with a Revert button beside each one, for undoing one specific mistake without
  touching anything else the turn got right. Reverting refuses rather than overwrites if that item
  has changed again since, so it can't clobber something newer. The agent's own stated reasoning
  shows underneath, even on a turn that changed nothing. Collapsed, the header still shows a
  compact `+N ↑N −N` count so you can tell at a glance whether there's anything worth expanding for.
- **Turn notifications**: a brief toast for each thing the agent just did ("Blue Hat added to
  inventory," "Blue Hat equipped to Head") — appears in the corner of the screen for a few seconds
  and fades away on its own, so you can tell what changed during ordinary roleplay without opening
  the dock at all. A turn touching a lot at once collapses the rest into one "+N more changes" toast
  instead of flooding the screen.
- **Restore Inventory**: a whole-state safety net right beside it, for when a turn goes wrong in a
  bigger way than a single item. Revert to the inventory state from right before the agent's last
  automatic update, in one click — even with no export file to fall back on. (This only rewinds
  the agent's own last change, not any manual edits you've made since.)

## The Appearance Macro

Drop `{{getvar::quartermaster_appearance_persona}}` into your persona's Appearance field once, and
Quartermaster keeps it updated automatically from then on — feeding your current outfit or
equipped items to anything that reads the persona's appearance, like Illustrator. Pick what it
feeds in Settings → Appearance:
- **Off**, **Outfit Name**, **Outfit Description**, or **Outfit Name + Description** — for the
  saved outfit you're wearing. With no matching outfit (or a hidden one, or one without that text),
  it uses the matching equipped-item option instead.
- **Equipped Item Names**, **Equipped Item Descriptions**, or **Equipped Item Names +
  Descriptions** — every item you're wearing, outermost layers first. An item with no description
  uses its name.

Names and descriptions are written as "Red baseball hat, A weathered red baseball hat. Black
sneakers, A pair of sporty black sneakers." Outfit portrait prompts use the same choice. Leave the
macro out, and it does nothing — no forced changes to your persona.

## Tracker Panel

The chevron above the Engine's native Tracker Panel opens the Dock.

The Tracker Panel itself also always shows its own "Quartermaster" section alongside the Engine's
other tracker sections — click it to expand three independently-collapsible sub-sections:
- **Equipped** — with a one-click unequip per item.
- **Outfits** — with equip/unequip buttons.
- **Inventory** — everything not currently equipped, grouped by where it's kept (Bag first, then
  each named stash as its own labeled group), so you're never seeing an item listed twice.

Hidden items and outfits are marked Hidden here too.

## Before enabling "replace persona's real avatar on equip"

Two things worth knowing: every change adds a permanent entry to the persona's version history
(no way to turn that off), and other screens showing that avatar (chat header, persona picker) can
take a moment to visually catch up — a Marinara caching quirk outside Quartermaster's control. The
dock's own portrait display always updates instantly either way; this setting only affects the
persona's *real* avatar elsewhere in Marinara.

## Planned

- **Party / multi-character support** — persona-only today; the storage layer's already built to
  extend to this without a rewrite.
- **A distributable item-image pack** — image matching already works today, and sharing a pack
  with friends is already possible; a curated official one just isn't decided yet.
- **Game Mode support** — Roleplay-only for now; being investigated as a later expansion.
- **Optional automatic image generation** for newly-created items — on/off toggle, not yet built.
- **Optional stat boosts on equipped items** — numeric modifiers an item could grant while worn
  (+2 STR, +5 HP, etc.); not yet built.
- **Deeper integration with other agents** — beyond the appearance macro Illustrator already
  reads, exposing equip/inventory state for other packages to build on.
- **A paperdoll alternative to the portrait ring** — equipped item art layered directly onto the
  persona's portrait instead of icons around its edge; a bigger visual lift than the current ring.
- **Drag-and-drop equip** — drag an item card straight onto a portrait slot instead of using the
  Equip button.

## Contributing

```text
packages/quartermaster/
├── src/            # plain-JS client modules — edit these; concatenated into client.js
├── icons/          # bundled slot artwork (WebP)
├── server.mjs      # hand-authored server routes
├── agents.json     # hand-authored tracker-agent definition
├── client.js       # generated — do not edit
├── manifest.json   # generated — do not edit
└── locales/en.json # generated — do not edit
```

Rebuild after any change:

```sh
node scripts/build-quartermaster-package.mjs
```

This regenerates `client.js`/`manifest.json`/`locales/en.json`, hashes `server.mjs`/`agents.json`
and every bundled icon, and writes `artifacts/quartermaster-<version>.zip` — refusing to silently
overwrite an already-released version's artifact file if you forget to bump `VERSION` first.

## Changelog

### 0.1.32
- **Item images stay with their item** (attempted fix for #1697, pending the reporter's
  confirmation). Uploading or generating an image saves its filename on the item, so renaming it no
  longer loses the picture. An image uploaded before this update is saved to its item the first
  time it's renamed. Image-pack matches aren't saved, so renaming onto another pack image's name
  still switches to it.
- **Connection blips no longer hide images.** Item images now always load through Quartermaster's
  own loader, which tells a real "no image" apart from a dropped connection or server error. Before,
  without an Admin Secret saved, any failed load hid that item's image until the page was reloaded.
  A disk error on the server now reports as an error, not as "no image".
- **Image details and Unlink.** Bag cards have an [i] on the image, and the item editor has a line
  under the name, showing the file and whether it was uploaded, generated, or matched by name.
  Unlink sends this chat's item back to matching by name and keeps the file.
- **Deleting moved to the item editor.** The × on bag card images is gone; the editor's × offers
  Delete file (warning that every chat using the file loses it) or Unlink.
- **New images never replace another file.** If `apple.png` exists, a new one is saved as
  `apple (1).png`, so another chat's Apple keeps its picture.
- Item names containing characters a filename can't hold (like "/") now upload correctly, and those
  characters can no longer affect where the file is written.

### 0.1.31
- Corrected a code comment about settling pending item changes. Nothing changes in use.

### 0.1.30
- Settling a pending item change (Accept, Keep, or the stale and deleted-item choices) and then
  switching chats before the answer arrives no longer writes that answer into the chat you
  switched to. Returning to the original chat shows its own, current state.
- Hidden item access help, here and in Settings, now describes each mode the same way and matches
  what the agent is actually allowed to do ("becomes shown" also skips removals).

### 0.1.29
- **Hidden items and outfits**: hide anything from its ⋯ menu to keep it from the agent, which
  only sees a hidden item while you're wearing it. Hidden items get their own Bag tab, a dimmed
  card and a Hidden label, here and in the Tracker Panel.
- **Hidden Items settings**: ask before agent changes to hidden items (a side-by-side popup, with
  undecided changes kept under Pending Item Changes in the dock), choose what the agent may do to
  them when not asking, let Build Wardrobe use them, and show them outside the Hidden tab.
- **Description lock**: lock an item's description from its editor so the agent can't change it.
- **Feed appearance** has seven options, from outfit name to every equipped item's name and
  description. Outfit portrait prompts follow it, without the doubled period they could have.
- **Build Wardrobe** asks what to do with each hidden item a proposal uses: overwrite, keep its
  details, or skip it.
- **Quick delete**: an optional Delete button on item and outfit cards, saved per device.
- "Recent Agent Update" is now **Recent Item Updates**, since accepted changes show there too.
- Re-equipping an outfit whose item you'd deleted now brings it back with its own default slot
  (and lock), instead of the slot it was equipped in. Reverting an agent's removal restores the
  item's default slot, hidden state and lock too.

### 0.1.28
- **Build Wardrobe layering**: the model now just gives each garment its usual slot and lists an
  outfit from innermost to outermost; when two pieces of one outfit share a clothing layer (tights
  and a pencil skirt over them), the later one is moved up to the next free layer instead of being
  dropped. Each item keeps its own default slot, so the skirt still goes to the inner layer when
  worn alone. The prompt's layering rule got shorter, which should help less capable models.
- **New slot artwork**: the clothing layers read as one outfit — shirt, waistcoat and coat for the
  torso; leggings, shorts and chaps for the legs — plus socks and a ring shared by the three Extra
  Wearable slots. All gender-neutral, in the same style as the original icons.

### 0.1.27
- The clothing layers on the portrait ring are now a stack of cards instead of three boxes side by
  side, so the dock stays about as wide as before. The front layer shows in full and the others as
  narrow tabs, outlined when something's worn there; the arrows on the card or a tap on a tab switch
  layers. The outermost worn layer is in front by default.

### 0.1.26
- **Layered clothing**: torso and legs each get three clothing layers — Inner, Mid and Outer — so a
  shirt, waistcoat and jacket (or tights under shorts) can all be worn at once. The existing
  clothing slots become the Inner layer, so nothing already equipped or saved changes.
- New **Socks** slot beside Feet, and three **Extra Wearable** slots for anything that doesn't fit
  elsewhere.
- The tracker agent and Build Wardrobe know about the new slots and how to layer clothing. If you
  customized the tracker prompt, reset it to the default to pick these up.

### 0.1.25
- With an Admin Secret saved, each image now loads once and is reused, instead of reloading after
  every change in the dock.
- An image that failed to load for a reason other than having no image tries again when the dock is
  reopened, and changing the saved Admin Secret retries every image.

### 0.1.24
- Works from other devices and remote access: Quartermaster now sends the Admin Secret saved in
  Settings → Advanced → Admin Access, fixing "Invalid or missing X-Admin-Secret header".
- Item images, outfit portraits and slot icons also load from other devices.
- A missing or mismatched Admin Secret now explains how to fix it.

### 0.1.23
- The description now says what it does in plain words.

### 0.1.22
- Image uploads and outfit saves use their own result during overlapping edits.
- Late uploads cannot close a newer dialog or show their error in another chat.
- Late inventory refreshes cannot undo a completed edit or replace a newer refresh.

### 0.1.21

- Detached tracker elements wait until mounted before starting subscriptions or changing the active chat.
- Late connection checks and failed mutations cannot overwrite a later dialog or another chat's error.
- Image deletion uses its own request result; closing the active chat clears its old panel error.

### 0.1.20

- Rebuilding the dock closes its dialogs and clears their pending sessions.
- Late wardrobe confirmations cannot overwrite a newly opened dialog or another chat's view.

### 0.1.19

- Added the official staging catalogue listing and armored Professor Mari cover.
- Prevented stale image-prompt previews from overwriting a later dialog or another chat.
- Closing the dock closes its child dialogs. Failed inventory exports show their error.
- A failed outfit save cannot overwrite an existing outfit's portrait.

### 0.1.18

A round of fixes from CodeRabbit's automated review on the initial pull request — verified each
against the actual code before touching anything, rather than applying suggestions as-is (one
finding turned out to be a false positive from its own sandbox, and one real architectural gap was
deliberately deferred rather than fixed; see the PR discussion for both).

- Fixed the Settings "replace persona's real avatar" toggle showing the *previous* chat's value if
  a reload failed right after switching chats — `setChat` reset every other per-chat setting except
  this one.
- Fixed a failed item-image delete permanently hiding that item's picture instead of just the
  delete — the missing-image cache was marked before the delete request even resolved, so a failed
  delete left the image suppressed forever with no error shown.
- Fixed both Build Wardrobe and Generate Image letting a stale, still-in-flight generation from a
  previous modal session overwrite what a *later* session in the same modal was showing — closing
  and reopening either modal (or switching items/chats, for Generate Image) mid-generation no
  longer lets the old result land somewhere it doesn't belong.
- Fixed the tracker panel's own DOM getting silently overwritten by the toolbar button in the rare
  case where the host changes an already-mounted element's view without disconnecting it first.
- Corrected the README's stated minimum Engine version (was still 2.4.4) to match the 2.4.6 already
  declared everywhere else.

### 0.1.17

- Raised the minimum required Engine version from 2.4.4 to 2.4.6. This package hadn't actually
  been re-verified against 2.4.4/2.4.5 since the very first build — current development and
  testing has been against a 2.4.6 staging checkout for a while, so the declared minimum now
  reflects what's actually been tested rather than a stale value from early in the project.

### 0.1.16

- Added brief "Item Acquired!"-style toast notifications for tracker-agent turns — one per
  add/update/equip/remove, phrased in plain language ("Blue Hat added to inventory," "Blue Hat
  equipped to Head"), each fading away on its own after a few seconds. Checked first whether this
  could reuse the Engine's own native toast system (`sonner`, used by real React feature packages
  like Hierarchical Maps) — it can't, since Quartermaster is a plain-JS agent bundle with no access
  to that module graph, and the Capability API (checked through 1.18) has no notify/toast bridge
  for a package like this. Built as a small self-contained overlay instead. Deliberately independent
  of the dock's own DOM: it renders even with the dock fully closed, which is the normal case during
  roleplay — it rides the same `marinara:generation-complete` mechanism the dock/tracker panel
  already use to catch up, triggered by whichever of them (usually just the Tracker Panel) is
  mounted. A turn touching more than 5 things at once collapses the rest into one "+N more changes"
  toast instead of flooding the corner of the screen.
- Items can now be favorited with a star next to their name (outline vs. filled) — favorited items
  always sort to the top of whichever Bag tab they're in. Survives Export/Import.

### 0.1.15

- Recent Agent Update's collapsed-box leak, for real this time — the `min-height: 0` fix in
  0.1.14 still wasn't enough on its own. The animated max-height/overflow-hidden collapse is gone
  entirely now, in favor of a plain `display: none` toggle: there's no box-model subtlety left to
  get wrong that way, at the cost of the slide animation the old Settings accordion had.
- Widened the info tooltip box (220px → 320px) so a long token like the Feed Appearance
  tooltip's `{{getvar::...}}` macro name reads on one line instead of an awkward mid-token wrap.

### 0.1.14

- Actually fixed Recent Agent Update's collapsed-box leak — 0.1.13 only got it partway. A flex
  container's default `min-height` is `auto`, driven by its own children's content size, and per
  spec that wins over a smaller `max-height` when the two conflict — so the collapsed box was
  still being forced open just enough to show a sliver of Restore Inventory underneath, no matter
  how the padding/box-sizing math was fixed. Explicit `min-height: 0` is the actual fix.
- Fixed tooltip text overflowing its own box: a long unbroken token (the `{{getvar::...}}` macro
  name in the Feed Appearance tooltip has no spaces to wrap at) wasn't breaking mid-token, so it
  spilled past the fixed-width edge instead of staying inside it.

### 0.1.13

- Fixed Recent Agent Update's collapsed box showing a sliver of Restore Inventory underneath —
  its vertical padding wasn't included in the collapsed max-height calculation. Also shrank its
  header text to match the other section labels.
- Info tooltips and card overflow menus no longer clip against the dock's own edge (previously
  clipped by the Bag/Outfits column's own scroll container) — they now flip to whichever side
  actually has room, re-checked every time they open.
- Shrank the item card's quantity field to match the width of the "⋯" button beside it — it
  rarely needs more room than that.
- "+ Add Item" is now green, matching Save Current Outfit's own styling.

### 0.1.12

- Settings moved to its own top-level tab (Inventory/Settings) instead of an accordion that pushed
  the actual inventory below the fold.
- Settings is now grouped under Appearance/Display/Image Generation/Data instead of one flat list
  of nine rows, with hover-and-tap info tooltips replacing the permanent explanatory paragraphs
  that used to sit under every control.
- Recent Automatic Update (renamed Recent Agent Update) moved into Settings' old spot, right next
  to Restore Inventory — its collapsed header now shows a compact `+N/↑N/−N` count, its rows are
  colored (green/yellow/red, keeping the existing symbols too), Revert sits to the left of each
  row, and it now shows the agent's own reasoning even on a turn that changed nothing.
- Item and outfit cards collapse Edit/Update/Delete into a "⋯" menu and promote Equip up to the
  name row — descriptions get the width that used to go to a fixed action column.
- Delete still confirms from inside the "⋯" menu. The item-image and outfit-portrait "×" remove
  buttons now confirm before clearing too (they didn't before).
- "Stored at: Bag" and "Default Slot" no longer render on an item's card when they carry no real
  information (plain bag, no default slot set) — only shown when there's something to actually say.
- Add Item is now a modal (Cancel/Add Item) instead of an always-open inline form in the Bag
  column, matching the Outfits column's own compact search-plus-action header.

### 0.1.11

- The tracking agent now targets specific changes (add/update/remove an item, equip an outfit)
  instead of re-listing the whole inventory every turn, referring to existing items and outfits by
  a short tag instead of retyping their names. An item the model doesn't mention is never dropped,
  and a large inventory can no longer have the model's own output get cut off mid-listing and lose
  whatever didn't make it in. A turn touching an implausible number of items is rejected outright.
- Added a "Recent Automatic Update" view in Settings: what the last turn added, changed, or
  removed, with the tracker's own reasoning, and a per-item Revert button for correcting one
  specific mistake without reverting everything else. A revert refuses rather than overwriting if
  that item has changed again since.

### 0.1.10

- Rewrote this Features section for readability and completeness, and documented several real
  features that hadn't been written down before: the Bag's Items/Wearables/Stored tabs, outfit
  resnapshotting, the "stays equipped through extras" behavior, the Tracker Panel's per-stash
  grouping, the Refresh Images setting, and Build Wardrobe sharing its LLM connection with the
  tracking agent.
- Updated the in-app description (Download Agents) to mention saved outfits, AI-generated art,
  and the tracker agent's own automation.

### 0.1.9

- Fixed a regression from 0.1.8's new Bag tabs: clicking an empty equip slot's quick-fill
  shortcut only searched the Wearables tab, so a stashed wearable item couldn't be found or
  equipped from there at all. That search now reaches every wearable regardless of tab, matching
  how it worked before tabs existed.

### 0.1.8

- Confirmed fix: the 0.1.7 persona-leak fix for Generate Image resolved the reported issue --
  item images no longer show a person.
- The Bag column now splits into three tabs (Items / Wearables / Stored) instead of one flat
  list, so a chat with a lot of stuff is easier to scan. Selecting an empty equip slot's
  quick-fill shortcut also jumps to the Wearables tab now, since only a wearable item can ever
  fill a slot that way.

### 0.1.7

- **Attempted fix** for Generate Image (added in 0.1.6): a real user reported item images coming
  back showing their persona instead of a clean product shot, even for things like a pair of
  slippers. Traced to the request sent to the Engine's own image-generation endpoint not matching
  the exact shape the legacy RPG Inventory extension's own proven-working code uses — it now does,
  field-for-field (a normalized name/slug and an `avatar:<slug>` override id, matching that
  extension exactly, dropping a guessed field set copied from a different package that didn't
  actually fix it). Marked "attempted" here because this is pending the reporting user's
  confirmation that it fully resolves it.
- The package's own build script now refuses to silently overwrite an already-released version's
  artifact file under the same filename if a rebuild ever runs before a version bump.

### 0.1.6

- Added Generate Image: an AI-generated alternative to uploading, for both item images and outfit
  portraits. Ported from the legacy RPG Inventory extension's own Generate/Upload menu, including
  its editable "review prompt" step before every generation.
- New Settings section (Image generation) picks which connection Quartermaster uses (a purely
  local preference — it never changes any Engine-wide default) and lets you edit the two prompt
  templates, pre-filled with the real default text so you edit from it rather than write a prompt
  from scratch.
- The default portrait prompt now specifies a casual pose.
- Fixed the portrait prompt leaking a raw, unresolved `{{getvar::quartermaster_appearance_persona}}`
  token into the image-generation request when the persona's Appearance field uses it — stripped
  out now instead.
- Export/import now carry the two prompt templates along with everything else (the image
  connection itself is deliberately excluded — it references a connection configured on your own
  Engine installation, not portable data).

### 0.1.5

- Fixed Build Wardrobe never producing debug-log output even with Debug Mode enabled: its request
  and raw response now log correctly, matching the tracker agent's own per-turn debug logging.
- Replaced the dock/tracker panel's 5-second inventory poll with the Engine's own
  generation-complete event, so it refreshes right after a turn actually finishes instead of on a
  fixed timer, cutting needless network traffic while nothing has changed.
- The Build Wardrobe prompt sent to the model now labels its sections explicitly (the style
  direction, the persona, the existing inventory) instead of leaving the direction unlabeled above
  two headed sections.

### 0.1.4

- Added Build Wardrobe: describe a style direction and get a proposed set of new items and
  outfits to review before adding them to inventory.
- Outfits it builds can reuse your existing wearable items instead of always creating new ones.
- Generation uses the tracker agent's own configured connection (Agents menu), so switching that
  there moves this too.
- Fixed non-wearable existing items (a phone, a wallet) sometimes turning up in a generated
  outfit.

### 0.1.3

- Fixed a serious bug where the tracker agent's inventory updates were silently discarded every
  turn: its `resultType` was misconfigured as a text-only result, so the model's JSON response
  never actually got parsed, and the full-snapshot reconcile wiped the inventory to empty each
  time.
- Outfits now stay "currently equipped" as long as their own saved items are still worn, even if
  something extra gets equipped alongside them — only swapping out one of the outfit's own items
  unequips it — and the appearance-macro description now lists that extra gear alongside the
  outfit's own text.
- Added a "Restore Inventory" button (Settings) that reverts to the state from just before the
  last agent update, a safety net for a bad turn with no export file to fall back on.
- Added a "Refresh Images" button (Settings) and a missing-image cache, so an item with no
  picture no longer re-triggers a failed image request (and console 404) on every repaint.
- Fixed the equip-slot fallback icon rendering on top of its own name/slot labels when an
  equipped item had no image.

### 0.1.2

- Added a decorated portrait frame with connector lines to each equip slot.
- Added bundled artwork for every equip slot.
- Redesigned item and outfit cards (image, name, description, focused Edit modal) to size
  themselves to their own content instead of clipping or growing unbounded.
- Equip slots now show the item's full image with overlay labels.
- Reworked the Outfits section (save via modal, live equip/edit/update from the card).
- Collapsible columns that actually narrow the dock instead of just hiding content.
- Added delete confirmations; Escape closes open modals; settings reorganized with descriptions.

### 0.1.1

- Theme-aware dropdowns.
- Fixed a portrait-ring shift with the underwear toggle.
- Real button hover/press states.
- Consistent border radius and scrollbar styling.
- Added an animated Settings section.
- Added click-outside-to-close.

### 0.1.0

- Initial release: equip slots around a portrait, item locations, saved outfits, export/import,
  the appearance macro, the narrator context feed, and the auto-tracking agent.
