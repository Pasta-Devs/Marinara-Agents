# Marinara Agents

Official downloadable agents and capability packages for [Marinara Engine](https://github.com/Pasta-Devs/Marinara-Engine).

Marinara Engine starts lightweight: a fresh installation contains no optional agents. Open **Agents → Download Agents** on desktop or mobile to browse this catalog, read what each package does, and install only the features you want. Installed packages appear in the normal Agents panel and the chat modes they support. You can update or uninstall them from the same catalog. Restart Marinara Engine when the installer asks you to do so.

Users upgrading from an older Engine keep every feature that was available before the package split. The migration downloads matching packages once and preserves existing chat selections, agent settings, runtime data, and history.

## What is published here

- All first-party Roleplay and Game agents, including trackers, writers, Illustrator, Echo Chamber, Music DJ, and About Me Keeper.
- Hierarchical Maps for Roleplay and Game.
- Conversation audio and video calls.
- UNO, Chess, Poker, 8-Ball Pool, Tic-Tac-Toe, and Rock-Paper-Scissors for Conversation mode.

## Hierarchical Maps

Adds persistent nested locations, map authoring, spatial prompt context, and movement controls. After installing and restarting, enable **Hierarchical Maps** for a Roleplay chat from Chat Settings. In Game mode, select it as an agent during game creation or add it later; its map workspace and world-map views appear only for chats where it is active.

## Conversation Calls

Adds audio/video calls, incoming rings, microphone transcription, camera or screen input, and optional generated character video presence. After installing and restarting, enable **Conversation Calls** for a Conversation chat, then configure its audio and video controls in Chat Settings. Text to Speech and model connections remain configured in Marinara Engine.

## UNO

Adds the Conversation-mode UNO table, setup flow, `/uno` command, and character turns. Install and restart, then open the games picker or type `/uno` in a Conversation chat.

## Chess

Adds the Conversation-mode chess board, setup flow, `/chess` command, and character turns. Install and restart, then open the games picker or type `/chess`.

## Poker

Adds No-Limit Texas Hold'em for Conversation chats, including seeded dealing, betting, side pots, showdowns, and optional character dealers. Install and restart, then open the games picker or type `/poker`.

## Eightball

Adds the Conversation-mode 8-Ball Pool table, physics simulation, setup flow, and character shots. Install and restart, then open the games picker or type `/8ball` or `/pool`.

## Tic-Tac-Toe

Adds one-on-one Tic-Tac-Toe to Conversation mode. Install and restart, then open the games picker or type `/tictactoe` or `/ttt`.

## Rock-Paper-Scissors

Adds best-of-three, five, or seven Rock-Paper-Scissors matches to Conversation mode. Install and restart, then open the games picker or type `/rps`.

## Package trust and storage

The Engine downloads only entries from the official HTTPS catalog, validates the catalog schema, checks Engine version compatibility, verifies the archive SHA-256 checksum, rejects unsafe archive paths and undeclared files, validates each declared file hash and size, and installs atomically into the Engine data directory. Installed packages remain available offline. Server-capability packages run with their declared permissions and require a restart when their runtime changes.

Package source and reproducible build scripts live in this repository instead of the base Engine distribution. Generated artifacts are published under `artifacts/`, package manifests under `packages/`, and the catalog under `catalog/catalog.json`.

Catalog entries classify packages as `writer`, `tracker`, or `misc`. Creators may also provide an HTTPS `iconUrl`; Marinara displays that artwork in Download Agents and falls back to the Agents star icon when artwork is omitted or unavailable. Agent code does not need to be repackaged when catalog artwork changes.

## Maintainer build

Build the shared package snapshot and all feature bundles from a neighboring Marinara Engine checkout:

```bash
node scripts/build-agent-catalog.mjs
node scripts/build-feature-packages.mjs
node scripts/validate-catalog.mjs
```

The build records every Engine source dependency needed by a package under `sources/engine`, so future catalog builds do not depend on those implementations remaining in the base Engine.
