# Quartermaster

A per-chat RPG character sheet and inventory manager: equip slots, item locations, saved
outfits, and a self-managed floating dock (draggable, resizable, mobile-responsive) alongside a
native-styled tracker-panel accordion. Persona-only for now.

Requires **Marinara Engine 2.4.4+**, Roleplay mode only (`modeAllowlist: ["roleplay"]` — Game
Mode's Tracker Panel and roleplay-tracker toolbar are gated to Roleplay by the Engine itself,
confirmed against source, not just undocumented). Package-owned portrait/item image generation
is not built — the dock shows the persona's existing avatar instead — and cover artwork
(`artwork/agent-covers/quartermaster.png`) is still outstanding. Visual refinement to the UI is
still needed, it is not in its final state.

## What it does

- **Equip slots** — 16 slots (head, neck, eyes, ears, armor torso/legs, clothing torso/legs,
  underwear top/bottom, back, hands, weapon left/right hand, feet, belt), grouped into a
  portrait ring in the dock.
- **Item locations** — `bag` (carried), `equipped:<slot>`, or `stored:<name>` (a named stash).
- **Saved outfits** — snapshot the current equip state under a name, equip/unequip it later in
  one step.
- **Export/import** — download the current chat's items, outfits, and settings as a JSON file, or
  replace them by importing one back — ported from the original extension. Item/outfit ids are
  reissued on import rather than kept as-is, so importing into a chat that already has data (or
  importing the same file twice) never collides with what's already there.
- **Slot-group visibility toggles** — underwear (off by default, SFW), armor, and weapons
  (both on by default) can each be hidden — disabled, not just hidden — matching the original
  extension's `SLOT_GROUPS` convention.
- **Appearance macro** — writes the current outfit/equipped-items text into
  `chatMeta.macroVariables` per chat, so a `{{getvar::quartermaster_appearance_persona}}` token
  in the persona's appearance field resolves for Roleplay's Illustrator image generation.
- **Narrator prompt context** — `registerPromptContext` contributes a curated, read-only summary
  of what's equipped/carried/stored (`provides: {inventory: true}` suppresses the Engine's own
  built-in `[inventory:]` block). Gated on the Quartermaster agent being currently enabled for the
  chat (`chatMeta.enableAgents`/`activeAgentIds` — the same signal every built-in tracker uses to
  decide it's active), so disabling the agent stops this feed the same turn instead of continuing
  to report stale state.
- **Quartermaster agent** (`phase: post_processing`) — reads each turn's narration and returns a
  full-snapshot JSON description of the persona's current items/equip state, reconciled into
  the same store the dock UI reads and writes, through the `agent-runtime` capability's
  `finalizeResult` hook. Full-snapshot semantics match the established convention in this
  catalog (Inventory Tracker, Character Tracker, World State): an item not re-listed on a turn
  is treated as gone.

## Planned

- **Party / multi-character support** — persona-only for now, but `ownerId` is threaded through
  every function in `server.mjs` as a real parameter rather than assumed, so extending past the
  persona is a later addition, not a rewrite.
- **Package-owned portrait/item images** — the dock currently shows the persona's existing
  avatar as-is; a generated or uploaded portrait that changes with equipped gear is later work,
  once the current layout is settled.
- **Avatar swapping based on equipped gear** — tying the portrait image itself to what's
  currently equipped, beyond the existing appearance-macro text feed.

Quality-of-life features from the original extension not covered above are intentionally out of
scope for now — the focus here is the inventory/outfit/appearance core, not full parity.

## Layout

```text
packages/quartermaster/
├── src/                # plain-JS client modules, concatenated in filename order into client.js
├── server.mjs           # hand-authored — do not generate; hashed as-is by the build script
├── agents.json           # hand-authored — carries the tracker agent's real prompt template
├── client.js             # generated — do not edit
├── manifest.json         # generated — do not edit
└── locales/en.json       # generated — do not edit
```

## Rebuilding

```sh
node scripts/build-quartermaster-package.mjs
```

Regenerates `client.js` (concatenated from `src/*.js`), stamps `manifest.json`/`locales/en.json`
from `manifest.json`'s and `agents.json`'s source strings, hashes `server.mjs`/`agents.json` as
committed, and writes the reproducible `artifacts/quartermaster-<version>.zip` plus the catalog
lanes. `INCOMPLETE_PACKAGE_IDS` (`scripts/catalog-incomplete.mjs`) keeps this package out of
every published catalog until it's ready for testers.

## Changelog

### 0.1.1

UI refinement pass: dropdown popups now match the Engine's actual theme instead of always
rendering light; the portrait ring no longer visibly shifts when the underwear toggle adds a
third sub-column on the left; every button has real hover/press/focus feedback; border-radius is
consistent across the whole dock instead of only the portrait frame following the theme variable;
the dock body has a themed scrollbar; the Settings section animates open/closed instead of
snapping; and clicking outside the open dock now closes it, matching other Marinara menus and the
original extension.

### 0.1.0

Initial capability-package port of the original "RPG Inventory" extension: equip slots arranged
in a portrait ring, item locations, saved outfits, export/import, the appearance macro, the
narrator prompt-context feed, and the `post_processing` tracker agent.
