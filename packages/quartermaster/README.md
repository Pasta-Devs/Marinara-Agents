# Quartermaster

A per-chat RPG character sheet and inventory manager: equip slots, item locations, saved
outfits, and a self-managed floating dock (draggable, resizable, mobile-responsive) alongside a
native-styled tracker-panel accordion. Persona-only for now; the data model and reconciliation
code are already owner-agnostic, so party/multi-character support is a later addition, not a
rewrite.

Requires **Marinara Engine 2.4.4+**, Roleplay mode only (`modeAllowlist: ["roleplay"]` — Game
Mode's Tracker Panel and roleplay-tracker toolbar are gated to Roleplay by the Engine itself,
confirmed against source, not just undocumented). Package-owned portrait/item image generation
is not built — the dock shows the persona's existing avatar instead — and cover artwork
(`artwork/agent-covers/quartermaster.png`) is still outstanding; both are why this stays in
`INCOMPLETE_PACKAGE_IDS` rather than the published catalog.

## What it does

- **Equip slots** — 16 slots (head, neck, eyes, ears, armor torso/legs, clothing torso/legs,
  underwear top/bottom, back, hands, weapon left/right hand, feet, belt), grouped into a
  portrait ring in the dock.
- **Item locations** — `bag` (carried), `equipped:<slot>`, or `stored:<name>` (a named stash).
- **Saved outfits** — snapshot the current equip state under a name, equip/unequip it later in
  one step.
- **Slot-group visibility toggles** — underwear (off by default, SFW), armor, and weapons
  (both on by default) can each be hidden — disabled, not just hidden — matching the original
  extension's `SLOT_GROUPS` convention.
- **Appearance macro** — writes the current outfit/equipped-items text into
  `chatMeta.macroVariables` per chat, so a `{{getvar::quartermaster_appearance_persona}}` token
  in the persona's appearance field resolves for Roleplay's Illustrator image generation.
- **Narrator prompt context** — `registerPromptContext` contributes a curated, read-only summary
  of what's equipped/carried/stored (`provides: {inventory: true}` suppresses the Engine's own
  built-in `[inventory:]` block), so the narrator sees current inventory without needing the
  tracker agent enabled.
- **Quartermaster agent** (`phase: post_processing`) — reads each turn's narration and returns a
  full-snapshot JSON description of the persona's current items/equip state, reconciled into
  the same store the dock UI reads and writes, through the `agent-runtime` capability's
  `finalizeResult` hook. Full-snapshot semantics match the established convention in this
  catalog (Inventory Tracker, Character Tracker, World State): an item not re-listed on a turn
  is treated as gone.

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
