# Gacha Forge

Gacha Forge is a standalone gacha game mode: forge a self-contained gacha world from your lorebooks, pull on its banners, and collect the cast the model writes and paints for you.

Find the package in **Agents → Download Agents**. Installation requires a restart: once installed and Marinara Engine restarts, **Gacha Forge** appears as a second tab in Home's browser shell. Uninstalling the package removes that tab and stops its routes after restart.

Since 1.2.0 the package is **staging only**: Engine `staging` testers are offered it and stable `main` users are not, while the game mode gets exercised. It is listed in the repository README's *In development* table rather than the Misc catalogue for that reason.

## What this release contains

1.0.0 shipped the Collection slice: world forging with lorebook-driven casts, the founding and featured banners with pity, portrait and banner-art generation, the Units browser with each unit's sheet, and the Home scene with its background and unit pickers.

1.1.0 added Farming, so the collected units had somewhere to go: the Materials modes with their three difficulties, a Formation board with presets, the deterministic combat simulation and its result screen, and unit growth — levelling and ascension — on the unit sheet.

1.2.0 added Story, which is what the collection and the farming were being built toward: chapters whose nodes the model plans, a visual-novel narrator that reads each beat out segment by segment with its speakers framed beside the text, generated backgrounds per location, chapter combat that runs the same simulation the farming does, and the context controls — a compression pass and its threshold — that keep a long run inside the model's window.

**1.3.0 completes the game.** Nothing in the interface is drawn locked any more, and the two systems it adds are the ones every earlier release was making room for:

- **Progression** gives the farming drops somewhere to go. The Inventory screen browses relics and materials; a unit's sheet regains its Gear tab (a weapon and four relic slots), its Form tab (three separate ability tracks — ultimate, passive, and the weapon's own skill), and its Facets tab, which is what a duplicate character buys. With the sinks in place the two farming stages that shipped drawn locked — the Relic Vault and the Tenet Trial — open, and the mechanism that refused them leaves the server entirely rather than staying as an empty list.
- **Events** adds the events tab, a 7 Day Login Event that renews itself weekly without a scheduler, and a 30-day battle pass with its own daily, weekly and season missions. The pass grants what was earned but unclaimed when a season renews, rather than letting it expire silently.

With both in, the package registers 60 routes and every screen it draws is reachable.

### It also reworks screens that already shipped

This release is not only additive either; the reworks it carries to interfaces already delivered are listed in the pull request body and summarised here:

- **Units** (shipped in 1.0.0): the card text joins the shared type ramp and moves up one step — the name from 13.6px to 17.8px at the default scale — and the protagonist's "You" tag is gone, leaving the coral edge on its card as the only marker. Returning from a unit's sheet now re-requests the grid, so a level bought on the sheet shows on the card instead of waiting for a screen change.
- **The runs manager** (shipped in 1.0.0) re-requests state when it opens: each row prints a progress line that only a state read refreshes, and the manager was showing it as it stood at boot.
- **Materials and the farming routes** (shipped in 1.1.0): Vigor is charged in one place instead of two, and every wallet figure a farming route returns is a projection of a single builder, so the top bar refreshes on any farming read.
- **The story's completion route** (shipped in 1.2.0) now checks that its write landed. That save does not retry, and the portrait queue writes the same session in parallel, so a lost race showed the player a reward the disk had not kept. It answers with a conflict and consumes nothing instead, and the retry pays in full.

### And two side rails, with a door inside the game

The space left beside the 16:9 frame now carries a collapsible help Q&A on the left and the player-facing changelog on the right. Because those rails are what is left over — they vanish in fullscreen, on a phone, and in a tall window — the same two lists also live inside the stage, as Settings categories reached by the gear that is already on every screen. The rail whose content is on screen steps aside, so neither list is ever drawn twice at once.

### The reworks that shipped with 1.2.0

This release is not only additive, so the diff touches interfaces earlier PRs already delivered:

- **Materials** (shipped in 1.1.0) had three problems reported from play. Its body sat flush against the hoisted top bar because the padding left with the header the bar takes over; its type had drifted off the shared scale, using four sizes that fall between the ramp's steps; and its tier cards were stretched to fill a plate the board stretched to the screen, so a card carrying three rows of content got a box two and a half times taller than it needed. The board now wraps into two rows, the cards take their own height, and every stage's card is three rows tall so the rarity table shares the figure's line instead of making the Relic Vault's cards taller than its neighbours'.
- **The narration backlog** read in the same colour as its own panel on three of the five HUD styles, because it took its text colour from a token that is a surface — light in two styles and a translucent wash or a dark brown in the others.
- **What a farming run pays in commander rank** (shipped in 1.1.0) came from the pace of a chapter fight — its 300 XP over its 8 Vigor — which paid 225/300/375 across the three difficulties. Now that chapters exist, a farming run paying *more* than the story it is meant to support reads backwards, so it pays the story ladder instead: 150/225/300. The difficulty key is derived from the same table the story uses rather than being written out a second time.
- **Map nodes no longer pay Insight.** They did when the story was the only source of materials; since 1.1.0 shipped the farming, materials come from there, and a chapter that also hands them out removes the reason to farm. Funds, Aether and commander rank are unchanged. The result screen was also naming neither: its reward list read Funds and Insight and never Aether, so with Insight gone a cleared fight would have reported only Funds.

All generation — world text, cast sheets, portraits, banner art — runs through the Engine profile's own configured model and image connections. The package adds no external services and sends nothing anywhere else.

## Payloads

`client.js` and `server.mjs` are single-file esbuild bundles contributed from the package's own source tree, which is maintained outside this repository. The artifact zip, manifest hashes, and catalog entry are re-derived from the committed payload bytes by the package builder, so they cannot drift from what ships.

Rebuild the artifact and catalog entry from the repository root:

```bash
node scripts/build-gacha-forge-package.mjs
node scripts/test-catalog-lanes.mjs
node scripts/validate-package-locales.mjs
node scripts/validate-catalog.mjs
```
