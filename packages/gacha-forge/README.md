# Gacha Forge

Gacha Forge is a standalone gacha game mode: forge a self-contained gacha world from your lorebooks, pull on its banners, and collect the cast the model writes and paints for you.

Find the package in **Agents → Download Agents**. Installation requires a restart: once installed and Marinara Engine restarts, **Gacha Forge** appears as a second tab in Home's browser shell. Uninstalling the package removes that tab and stops its routes after restart.

## What this release contains

1.0.0 shipped the Collection slice: world forging with lorebook-driven casts, the founding and featured banners with pity, portrait and banner-art generation, the Units browser with each unit's sheet, and the Home scene with its background and unit pickers.

**1.1.0 adds Farming**, so the units a player collects now have somewhere to go: the Materials modes with their three difficulties, a Formation board with presets, the deterministic combat simulation and its result screen, and unit growth — levelling and ascension — on the unit sheet. Battle and Formation are live on the Home from here.

Story chapters, equipment and relics, the inventory, and the events tab stay drawn locked in the interface and are planned as follow-up PRs, one system at a time. Two farming stages whose drops have no sink yet — the Relic Vault and the Tenet Trial — are drawn locked for the same reason, and the server refuses them too rather than leaving the screen and the route with two opinions about the same rule.

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
