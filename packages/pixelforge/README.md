# Pixelforge

A downloadable Game Mode **Experience** (capability package, `game-surface` slot): a walkable
top-down pixel village in the spirit of pre-3D Harvest Moon / Stardew Valley, rendered by a
package-owned Canvas2D engine. NPC dialogue flows into the normal GM turn loop, World Maps
(hierarchical spatial context) is read and written as you move, and combat hands off to the
engine's own vanilla combat — the package never replaces it.

Requires **Marinara Engine 2.4.3+** (capability API 1.10 for `contributions.assets`). It is
client-only: no server entrypoint, no restart after install. The package agent definition is a
runtime-inert stub that satisfies the catalog loader; all behavior lives in `client.js`.

## How to play

Install Pixelforge from the agent catalog, create a **Game Mode** chat, and choose **Pixelforge**
in the Experience chooser. Walk with the arrow keys / WASD or the on-screen D-pad, talk to NPCs to
drive the story, and let the GM narrate. The world saves into the chat (debounced), so reloading
resumes where you left off.

## World generation (0.4.0)

Since 0.4.0 the wizard's preferences drive what the world *is*, under one rule: **the LLM decides
what exists, the algorithm decides where every tile goes.** After launch the surface makes one
host-run structured generation call (`POST /api/game/:chatId/experience-generation`, Engine
2.4.3-staging+) with themed guidance and a strict schema; the model returns a compact **World
Brief** — settlement, cast with household structure, places, features — and a deterministic
compiler builds the tile world from it (30 villagers in 6 households → ~6 houses, never 30). The
brief is validated, repaired, and floored (`src/18-brief.js`, spec in `docs/brief-schema.md`),
then sealed into chat metadata; the compiled zones carry the prose the GM sees, metered so it
never taxes more than one turn.

Generation is an upgrade, never a gate: the chat boots the themed default world instantly and
rebuilds in place when the brief lands. Any failure — timeout, truncation, provider error, or an
engine without the route — lands on the themed default world, which plays exactly like 0.3.0.

Run the validator/compiler regression harness with:

```sh
node packages/pixelforge/test-brief.mjs
```

## Art

Two tiers, resolved at runtime with graceful degradation:

- **Tier 1 (shipped)** — per-theme tile atlases (`tiles.png` for cozy-village,
  `tiles-sci-fi-colony.png` for the colony theme, both sharing one `atlas.json` id map) and
  4-direction × 4-frame
  walk-cycle sprite sheets (`sprites/*.png` + `sprites.json`) generated at build time by
  `build/build-art.mjs` with a dependency-free PNG encoder (`build/png.mjs`). Deterministic for a
  given Node.js build: the pixel data never varies, but the PNG container bytes depend on Node's
  bundled zlib, so rebuilding on a different Node release may churn them — harmlessly, because the
  build re-stamps every hash from its own output and CI verifies committed bytes without rebuilding. Served through the engine's package-asset route via
  `contributions.assets`.
- **Tier 0 (fallback)** — procedural Canvas painters inside `client.js`. If assets fail to load
  (or on engines without asset serving) the game still runs, just plainer.

## Layout

```text
packages/pixelforge/
├── src/                  # plain-JS modules, concatenated in filename order into client.js
├── docs/brief-schema.md  # the World Brief schema v1 spec (sealed; amendments inline)
├── test-brief.mjs        # standalone validator/compiler/spatial regression harness
├── build/
│   ├── build-art.mjs     # deterministic Tier-1 art generator (writes build/assets/, untracked)
│   ├── png.mjs           # dependency-free PNG encoder
│   └── cover.mjs         # regenerates artwork/agent-covers/pixelforge.png
├── engine-boundary.json  # capability API + build provenance; zero private engine imports
├── client.js             # generated — do not edit
├── agents.json           # generated — do not edit
├── manifest.json         # generated — do not edit
├── locales/en.json       # generated — do not edit
└── tiles*.png, atlas.json, sprites.json, sprites/*.png   # generated Tier-1 assets
```

## Rebuilding

```sh
node scripts/build-pixelforge-package.mjs
```

Regenerates `client.js`, the Tier-1 assets, `manifest.json`/`agents.json`/`locales/en.json`, the
reproducible `artifacts/pixelforge-<version>.zip` (deterministic store-only zip, no system `zip`
binary needed), and the catalog lanes. Bump `VERSION` in the build script and update
`engine-boundary.json` when rebuilding against a newer engine.
