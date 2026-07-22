# Marinara Agents

Official downloadable agents and capability packages for [Marinara Engine](https://github.com/Pasta-Devs/Marinara-Engine).

Marinara Engine starts lightweight: a fresh installation contains no optional agents. Open **Agents → Download Agents** on desktop or mobile to browse this catalog, read what each package does, and install only the features you want. Installed packages appear in the normal Agents panel and the chat modes they support. You can update or uninstall them from the same catalog. Restart Marinara Engine when the installer asks you to do so.

Across its Engine compatibility lanes, the catalog currently contains **29 first-party packages** for **Marinara Engine v2.3.0+**: 6 Writer Agents, 8 Tracker Agents, and 15 Misc Agents. Each Engine release sees only the packages compatible with its major version. Users upgrading from an older Engine keep every feature that was available before the package split. Migration downloads matching packages once and preserves existing chat selections, agent settings, runtime data, and history.

## Official catalog

### Writer Agents

| Agent | Package | What it does |
| --- | --- | --- |
| Card Evolution Auditor | [`card-evolution-auditor`](packages/card-evolution-auditor/manifest.json) | Audits durable roleplay changes and proposes precise character-card edits for approval. |
| Continuity Checker | [`continuity`](packages/continuity/manifest.json) | Fixes concrete spatial, timeline, and physical logic errors without changing the story. |
| Knowledge Retrieval | [`knowledge-retrieval`](packages/knowledge-retrieval/manifest.json) | Finds relevant lorebook information, summarizes it, and injects it into the prompt. |
| Knowledge Router | [`knowledge-router`](packages/knowledge-router/manifest.json) | Selects relevant lorebook entries from a lightweight catalog and injects them verbatim. |
| Narrative Director | [`director`](packages/director/manifest.json) | Creates one-shot story directions when the user chooses to push the next response forward. |
| Prose Guardian | [`prose-guardian`](packages/prose-guardian/manifest.json) | Removes banned words, repetition, and unwanted prose habits without changing meaning. |

### Tracker Agents

| Agent | Package | What it does |
| --- | --- | --- |
| Background | [`background`](packages/background/manifest.json) | Selects the best existing scene background from your library. |
| Character Tracker | [`character-tracker`](packages/character-tracker/manifest.json) | Tracks present characters, moods, actions, appearance, thoughts, and character stats. |
| Custom Tracker | [`custom-tracker`](packages/custom-tracker/manifest.json) | Tracks user-defined currencies, counters, flags, and other custom fields. |
| Expression Engine | [`expression`](packages/expression/manifest.json) | Detects character emotions and selects matching Visual Novel sprites or expressions. |
| Hierarchical Maps | [`hierarchical-maps`](packages/hierarchical-maps/manifest.json) | Adds persistent nested locations, spatial context, map authoring, and movement. |
| Persona Stats | [`persona-stats`](packages/persona-stats/manifest.json) | Tracks the player persona's status bars and custom stats from narrative events. |
| Quest Tracker | [`quest`](packages/quest/manifest.json) | Manages quest objectives, completion states, and rewards. |
| World State | [`world-state`](packages/world-state/manifest.json) | Tracks date, time, weather, location, temperature, and custom world details. |

### Misc Agents

| Agent | Package | What it does |
| --- | --- | --- |
| 8-Ball Pool | [`eightball`](packages/eightball/manifest.json) | Adds a complete Conversation-mode 8-Ball Pool table and `/8ball` command. |
| Chess | [`chess`](packages/chess/manifest.json) | Adds a Conversation-mode chess board and `/chess` command. |
| Combat | [`combat`](packages/combat/manifest.json) | Manages combat encounters, initiative, HP tracking, and turn-based actions. |
| Calls | [`conversation-calls`](packages/conversation-calls/manifest.json) | Adds live audio/video calls, microphone transcription, and character video presence. |
| CYOA Choices | [`cyoa`](packages/cyoa/manifest.json) | Generates clickable Choose Your Own Adventure choices after Roleplay responses. |
| Echo Chamber | [`echo-chamber`](packages/echo-chamber/manifest.json) | Simulates a streaming-style audience chat reacting to Roleplay in real time. |
| Haptic Feedback | [`haptic`](packages/haptic/manifest.json) | Controls connected Intiface devices from analyzed narrative content. |
| Illustrator | [`illustrator`](packages/illustrator/manifest.json) | Creates images and videos, with optional automatic Roleplay backgrounds for new scene locations. |
| Immersive HTML | [`html`](packages/html/manifest.json) | Adds diegetic HTML/CSS/JS visual artifacts without changing story meaning. |
| Lorebook Keeper | [`lorebook-keeper`](packages/lorebook-keeper/manifest.json) | Creates and updates durable lorebook entries from important story facts. |
| Music DJ | [`spotify`](packages/spotify/manifest.json) | Plays scene-matched music through Spotify, YouTube, or local Game Assets. |
| Poker | [`poker`](packages/poker/manifest.json) | Adds No-Limit Texas Hold'em for Conversation chats and the `/poker` command. |
| Rock-Paper-Scissors | [`rock-paper-scissors`](packages/rock-paper-scissors/manifest.json) | Adds best-of-three, five, or seven Conversation matches and the `/rps` command. |
| Tic-Tac-Toe | [`tic-tac-toe`](packages/tic-tac-toe/manifest.json) | Adds one-on-one Conversation matches and the `/tictactoe` command. |
| UNO | [`uno`](packages/uno/manifest.json) | Adds a complete Conversation-mode UNO table and `/uno` command. |

For complete mode, lifecycle, and settings documentation for every package, see the Engine's [Downloadable Agents Reference](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/agents/built-in-agents.md).

## Package trust and storage

The Engine downloads only entries from its Engine-major lane in this official HTTPS catalog, validates the catalog schema, checks Engine version compatibility, verifies the archive SHA-256 checksum, rejects unsafe archive paths and undeclared files, validates each declared file hash and size, and installs atomically into the Engine data directory. Installed packages remain available offline. Server-capability packages run with their declared permissions and require a restart when their runtime changes.

Package source and reproducible build scripts live in this repository instead of the base Engine distribution. Generated artifacts are published under [`artifacts/`](artifacts/), package manifests under [`packages/`](packages/), and machine-readable catalogs under [`catalog/`](catalog/). Engine 2 uses [`catalog/v2/catalog.json`](catalog/v2/catalog.json), Engine 3 uses [`catalog/v3/catalog.json`](catalog/v3/catalog.json), and [`catalog/catalog.json`](catalog/catalog.json) remains the legacy Engine 2 alias.

Catalog entries classify packages as `writer`, `tracker`, or `misc`. Every official package has a square Professor Mari cover under [`artwork/agent-covers/`](artwork/agent-covers/), published through its HTTPS `iconUrl`; Marinara displays that artwork in Download Agents and falls back to the Agents star icon when artwork is unavailable. Agent code does not need to be repackaged when catalog artwork changes.

Conversation mode's About Me profile and `update_about_me` tool are built into Marinara Engine. They are not agents and must not be published in this catalog.

## Contributing

Agent ideas, bugs, documentation corrections, and package improvements are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before starting: contributions begin with an issue, target the `main` branch, must be marked ready for review, and require an approving review before merge. CodeRabbit automatically reviews ready pull requests.

## Maintainer build

Build the shared package snapshot and all feature bundles from a neighboring Marinara Engine checkout:

```bash
node scripts/build-agent-catalog.mjs
node scripts/build-feature-packages.mjs
node scripts/validate-catalog.mjs
```

The build records generic Engine source dependencies needed by feature packages under `sources/engine`. Package-owned implementations stay with their package; for example, Hierarchical Maps source lives under `packages/hierarchical-maps/src/engine/` and is overlaid on those generic dependencies during its build.

---

## Community & Support

- [**Join our Discord**](https://discord.com/invite/KdAkTg94ME) — Chat, get help, share characters, and give feedback
- [**Support on Ko-fi**](https://ko-fi.com/marinara_spaghetti) — Help keep the project alive

---

## Contributors

<p align="left">
  <a href="https://github.com/Pasta-Devs/Marinara-Agents/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=Pasta-Devs/Marinara-Agents" alt="Marinara Agents contributors" />
  </a>
</p>

<p align="left">
  Made with <a href="https://contrib.rocks">contrib.rocks</a>.
</p>

---

## License

[AGPL-3.0](LICENSE)
