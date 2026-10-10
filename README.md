# Marinara Agents

Official downloadable agents and capability packages for [Marinara Engine](https://github.com/Pasta-Devs/Marinara-Engine).

Marinara Engine starts lightweight: a fresh installation contains no optional agents. Open **Agents → Download Agents** on desktop or mobile to browse this catalog, read what each package does, and install only the features you want. Installed packages appear in the normal Agents panel and the chat modes they support. You can update or uninstall them from the same catalog. Restart Marinara Engine when the installer asks you to do so.

Across its Engine compatibility lanes, the stable catalog currently contains **39 first-party packages**: 6 Writer Agents, 13 Tracker Agents, and 20 Misc Agents. Staging-only previews below are additional and are not included in these stable counts. Most packages support **Marinara Engine v2.3.0+**; World Maps and Storyboard require **v2.4.2**; Inventory Tracker and Haptic Feedback require **v2.4.3**; Beholder, Noodle, Memory Nag, Gacha Forge, and Relationship Tracker require **v2.4.4**; Long-Term Memory requires **v2.4.1**; and Slurp and Quartermaster require **v2.4.6**. Every package accepts compatible Engine v2 and v3 releases below **v4.0.0**. Each Engine release sees only the packages compatible with its major version. Users upgrading from an older Engine keep every feature that was available before the package split. Migration downloads matching packages once and preserves existing chat selections, agent settings, runtime data, and history.

## Official catalog

### Writer Agents

| Agent | Package | What it does |
| --- | --- | --- |
| Card Evolution Auditor | [`card-evolution-auditor`](packages/card-evolution-auditor/manifest.json) | Suggests character card updates when the story changes a character, for you to approve. |
| Continuity Checker | [`continuity`](packages/continuity/manifest.json) | Fixes mistakes about places, time, and physical details in AI messages without changing the story. |
| Knowledge Retrieval | [`knowledge-retrieval`](packages/knowledge-retrieval/manifest.json) | Finds what matters for the current scene in your lorebooks and gives the AI a short summary of it. |
| Knowledge Router | [`knowledge-router`](packages/knowledge-router/manifest.json) | A cheaper Knowledge Retrieval: picks the lorebook entries that fit the scene and gives them to the AI as they are. Works best with big lorebooks whose entries have short descriptions. |
| Narrative Director | [`director`](packages/director/manifest.json) | Gives the story a push in a new direction when you ask for it. |
| Prose Guardian | [`prose-guardian`](packages/prose-guardian/manifest.json) | Removes banned words, repetition, and unwanted writing habits from AI messages without changing what they say. |

### Tracker Agents

| Agent | Package | What it does |
| --- | --- | --- |
| Background | [`background`](packages/background/manifest.json) | Selects the best existing scene background from your library. |
| Beholder | [`beholder`](packages/beholder/manifest.json) | Keeps track of what each character is wearing and holding, plus any injuries, so the story stays consistent. You can check it on a paper doll from the roleplay toolbar. Works with big online models, or with the free Beholder model that runs privately on your computer. |
| Character Tracker | [`character-tracker`](packages/character-tracker/manifest.json) | Tracks who is in the scene and how each character looks, feels, and acts, plus stats like HP. |
| Custom Tracker | [`custom-tracker`](packages/custom-tracker/manifest.json) | Tracks anything you want during the roleplay, like money, counters, or flags. |
| Expression Engine | [`expression`](packages/expression/manifest.json) | Changes character sprites to match how they feel. |
| Inventory Tracker | [`inventory-tracker`](packages/inventory-tracker/manifest.json) | Keeps track of your money, gear, and what you're carrying. |
| Memory Nag | [`memory-nag`](packages/memory-nag/manifest.json) | Remembers loose ends from your roleplay, like promises and open questions, and reminds the AI when they matter. |
| World Maps | [`hierarchical-maps`](packages/hierarchical-maps/manifest.json) | Adds world maps to Roleplay and Game, from whole regions down to single rooms, with art and travel between places. |
| Persona Stats | [`persona-stats`](packages/persona-stats/manifest.json) | Tracks your persona's needs, like hunger, energy, and hygiene, as the story goes on. |
| Quest Tracker | [`quest`](packages/quest/manifest.json) | Keeps track of your quests, their goals, and their rewards. |
| Quartermaster | [`quartermaster`](packages/quartermaster/manifest.json) | An RPG character sheet and inventory for Roleplay: equip gear around your persona's portrait, save outfits, get AI art for items, and let it keep everything in step with the story. |
| Relationship Tracker | [`relationship-tracker`](packages/relationship-tracker/manifest.json) | Tracks how the characters and your persona feel about each other. |
| World State | [`world-state`](packages/world-state/manifest.json) | Tracks date, time, weather, location, temperature, and custom world details. |

### Misc Agents

| Agent | Package | What it does |
| --- | --- | --- |
| 8-Ball Pool | [`eightball`](packages/eightball/manifest.json) | Adds a complete Conversation-mode 8-Ball Pool table and `/8ball` command. |
| Chess | [`chess`](packages/chess/manifest.json) | Adds a Conversation-mode chess board and `/chess` command. |
| Combat | [`combat`](packages/combat/manifest.json) | Manages combat encounters, initiative, HP tracking, and turn-based actions. |
| Calls | [`conversation-calls`](packages/conversation-calls/manifest.json) | Adds live audio/video calls, microphone transcription, and character video presence. |
| CYOA Choices | [`cyoa`](packages/cyoa/manifest.json) | Offers a few choices after each AI message, like a Choose Your Own Adventure book. Click one to send it as your reply. |
| Echo Chamber | [`echo-chamber`](packages/echo-chamber/manifest.json) | Simulates a streaming-style audience chat reacting to Roleplay in real time. |
| Gacha Forge | [`gacha-forge`](packages/gacha-forge/manifest.json) | A complete gacha game mode: describe a world and it builds the rest — banners to pull on, a generated cast, story chapters told by a visual-novel narrator, and the battles, gear, bonds and events that grow around them, all from **Home → Gacha Forge**. |
| Haptic Feedback | [`haptic`](packages/haptic/manifest.json) | Controls connected intimate toys to match what happens in the story. Needs Intiface Central running on your computer, with your toy connected there first. |
| Illustrator | [`illustrator`](packages/illustrator/manifest.json) | Creates images and videos, with optional automatic Roleplay backgrounds for new scene locations. |
| Immersive HTML | [`html`](packages/html/manifest.json) | Adds HTML/CSS/JS visual effects to AI messages. |
| Lorebook Keeper | [`lorebook-keeper`](packages/lorebook-keeper/manifest.json) | Saves important story facts, characters, places, and world changes to the chat's lorebook as you play. |
| Long-Term Memory | [`long-term-memory`](packages/long-term-memory/manifest.json) | Remembers important things from your chat summaries, characters, and lorebooks, and brings them back when they matter. |
| Music DJ | [`spotify`](packages/spotify/manifest.json) | Plays music that fits the mood of the story, from Spotify, YouTube, or your own Game Assets music. |
| Noodle | [`noodle`](packages/noodle/manifest.json) | A pretend social network where your characters post, share photos, and talk about your chats, available after installation from **Home → Noodle**. |
| Slurp | [`slurp2`](packages/slurp2/manifest.json) | A private social app for your characters: turn characters and personas into Creators, post public or locked photos, and watch a simulated audience follow, subscribe, unlock, comment, and message them, from **Home → Slurp**. Tuned for an adult experience by default. |
| Poker | [`poker`](packages/poker/manifest.json) | Adds No-Limit Texas Hold'em for Conversation chats and the `/poker` command. |
| Rock-Paper-Scissors | [`rock-paper-scissors`](packages/rock-paper-scissors/manifest.json) | Adds best-of-three, five, or seven Conversation matches and the `/rps` command. |
| Storyboard | [`storyboard`](packages/storyboard/manifest.json) | Turns Game and Roleplay scenes into storyboards of still images or short animations. |
| Tic-Tac-Toe | [`tic-tac-toe`](packages/tic-tac-toe/manifest.json) | Adds one-on-one Conversation matches and the `/tictactoe` command. |
| UNO | [`uno`](packages/uno/manifest.json) | Adds a complete Conversation-mode UNO table and `/uno` command. |

For complete mode, lifecycle, and settings documentation for every package, see the Engine's [Downloadable Agents Reference](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/agents/built-in-agents.md).

For manual-only Illustrator on the updated Engine staging build, set **Run Interval** to **0** in its setup or when adding it to a chat. This stops automatic Illustrator runs, including automatic scene backgrounds, while keeping the **Gallery → Illustrate** and **Background** actions available. The default remains **5**; choose a positive interval to resume automatic runs. This is an Engine scheduling option, so no Illustrator package update is required.

Slurp offers **Image context for reactions** in settings for fan reactions and creator replies: **Auto** prefers the stored image prompt and falls back to vision, **Stored image prompt only** uses that prompt only, and **Vision** describes the image. Public fans do not receive locked images. Manual creator refresh shows how many requests remain.

When breaking a Slurp couple up, choose whether they keep the usual breakup history, **Move on** without dwelling on it, or **Forget the relationship** in future posts and chats. For existing exes, **Stir → Nudge a couple** can move them on or forget the relationship. Published posts and messages stay. Where Undo is offered, use **Recent plays → Undo** to restore the previous choice.

### In development

These packages are being built in this repository but are not ready for the stable catalog yet. A package is either **in development** (hidden from every Engine channel) or **staging only** (offered to Engine `staging` testers, hidden from stable `main` users). See [Contributing § Packages that are not ready for everyone](CONTRIBUTING.md#packages-that-are-not-ready-for-everyone).

| Package | ID | Availability | Status |
| --- | --- | --- | --- |
| Modern Life Sim | [`modern-life-sim`](packages/modern-life-sim/manifest.json) | Staging only | A modern life sim in its own Home tab: a town on a clock, a job, rent and needs, and a cast drawn from your character cards whose relationships grow scene by scene, with a visual-novel narrator for the scenes that matter. Alpha; offered to Engine `staging` testers from **Home → Life Sim**. |
| Pixelforge | [`pixelforge`](packages/pixelforge/manifest.json) | In development | A pixel-art RPG world for Game Mode that you walk around in. Pick a setting, like a cozy village or a sci-fi colony, then explore, talk to NPCs, and let the Game Master narrate. Under active development; not yet listed for users. |
| 5e (SRD 5.1) | [`ruleset-5e-2014`](packages/ruleset-5e-2014/manifest.json) | Staging only | Play Game Mode by the 5e rules (SRD 5.1): ability checks, saving throws, a full character sheet with spells and class features, and 5e combat against 319 monsters, on a battle board or without positions. Ships only data, no Agent and no code. Needs an Engine with Capability API 1.46, which today means the Engine `staging` branch. |

### Localization sources

Every downloadable package keeps its canonical user-visible metadata in `packages/<id>/locales/en.json`. These catalogs cover package and Agent names and descriptions plus selectable named prompt options, while deliberately excluding model instructions. Translators can add partial BCP 47 catalogs such as `ko.json`; untranslated fields fall back to English once Engine-side catalog localization support consumes them. See [Contributing](CONTRIBUTING.md#localizing-package-metadata) for the format and validation workflow.

Package-owned interfaces maintain their UI catalogs separately. The metadata catalogs prepared here do not change the Engine's catalog schema or runtime behavior on their own.

## Package trust and storage

The Engine downloads only entries from its Engine-major lane in this official HTTPS catalog, validates the catalog schema, checks Engine version compatibility, verifies the archive SHA-256 checksum, rejects unsafe archive paths and undeclared files, validates each declared file hash and size, and installs atomically into the Engine data directory. Installed packages remain available offline. Server-capability packages run with their declared permissions and require a restart when their runtime changes.

Package source and reproducible build scripts live in this repository instead of the base Engine distribution. Generated artifacts are published under [`artifacts/`](artifacts/), package manifests under [`packages/`](packages/), and machine-readable catalogs under [`catalog/`](catalog/). Engine 2 uses [`catalog/v2/catalog.json`](catalog/v2/catalog.json), Engine 3 uses [`catalog/v3/catalog.json`](catalog/v3/catalog.json), and [`catalog/catalog.json`](catalog/catalog.json) remains the legacy Engine 2 alias.

Catalog entries classify packages as `writer`, `tracker`, or `misc`. Every official package has a square Professor Mari cover under [`artwork/agent-covers/`](artwork/agent-covers/), published through its HTTPS `iconUrl`; Marinara displays that artwork in Download Agents and falls back to the Agents star icon when artwork is unavailable. Agent code does not need to be repackaged when catalog artwork changes.

Conversation mode's About Me profile and `update_about_me` tool are built into Marinara Engine. They are not agents and must not be published in this catalog.

## Contributing

Agent ideas, bugs, documentation corrections, and package improvements are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before starting: contributions begin with an issue and target the `staging` branch. Engine staging users automatically consume Agents staging for package testing. Every ready PR must pass validation and CodeRabbit; outside and first-time contributors also need an approving review from `SpicyMarinara`. Only `SpicyMarinara` promotes tested staging work to `main`.

## Maintainer build

Build the shared package snapshot and all feature bundles from a neighboring Marinara Engine checkout:

```bash
node scripts/build-agent-catalog.mjs
node scripts/build-feature-packages.mjs
node scripts/build-ruleset-packages.mjs
node scripts/test-catalog-lanes.mjs
node scripts/validate-package-locales.mjs
node scripts/validate-catalog.mjs
```

The build records generic Engine source dependencies needed by feature packages under `sources/engine`. Package-owned implementations stay with their package; for example, World Maps, Long-Term Memory, and Noodle source live under their respective `packages/<id>/src/engine/` trees and are overlaid on those generic dependencies during each build. Noodle also compiles and embeds the same Engine design utilities used by its former built-in interface, preventing visual drift when it runs as a downloaded Home tab.

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
