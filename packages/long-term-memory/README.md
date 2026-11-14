# Long-Term Memory

Long-Term Memory is a server-backed Agent package that proposes durable memory
changes for review, stores accepted notes in a package-owned vault, and recalls
scoped context during pre-generation.

## Start Here

- [`manifest.json`](manifest.json): package, capability, permission, and artifact contract.
- [`src/engine/packages/client/src/features/long-term-memory/PRODUCT.md`](src/engine/packages/client/src/features/long-term-memory/PRODUCT.md): product behavior and boundaries.
- [`src/engine/packages/client/src/features/long-term-memory/DESIGN.md`](src/engine/packages/client/src/features/long-term-memory/DESIGN.md): client layout, accessibility, and local UI patterns.
- [`docs/UI.md`](docs/UI.md): client surfaces, workflows, states, and UI test routing.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): server, shared-domain, storage, extraction, and recall flow.
- [`../../tests/README.md`](../../tests/README.md): test ownership and Engine-backed commands.
- [`CHANGELOG.md`](CHANGELOG.md): released package behavior.

## Automatic Memories

Memories from chats (Memory Settings → Extraction) turns on background import:
Collect them, I'll review imports new message pieces into the Review, and Save
them for me also accepts the low-risk suggestions. Chat summaries are not read
in the background: import them by hand from Sources. A chat can choose
differently in its Chat Settings, and Mari's setup asks the same question in its
How step.

## Setup and Tour

Mari, the archivist, walks you through setup in four short beats (Hello, How, Head start, Done). Setup never opens on
its own: it starts from the empty Vault's "Set up memory", the chat drawer's "Off · Set up" chip, or "Run setup again" in
the Help menu and in Memory Settings' Troubleshooting, and closing it with Later resumes at the same beat. An optional eight-stop tour then shows the Vault, Sources, Review,
linked memories, background reading, what the last reply used in the chat, and Settings. While a chat is being read, the Memory page header
shows a "Reading the last reply…" chip. Mari animates, and holds a still picture when your system asks for reduced
motion. See [`docs/UI.md`](docs/UI.md) for the details.

## Memory Vault

The Memory Vault lists every stored memory and has a List / Graph switch in its header. The Graph opens on one memory
and the memories linked with it, two steps out, with "Whole Vault" for everything, filters for the kind of memory
(People, Story, Threads, World), importance, sources and archived memories, and a "Used in the last reply" filter that rings what
the last reply in the open chat used. It works at phone width, in both themes and in Korean. See
[`docs/UI.md`](docs/UI.md) for the details.

## Source Layout

```text
src/engine/packages/
├── client/   React capability UI and chat settings
├── server/   storage, extraction, retrieval, routes, and runtime services
└── shared/   schemas, scope rules, constants, and shared types
```

`assets/onboarding/` holds the archivist pictures for setup and the tour. The
package ships every `.webp` in that folder as a served asset.

The root `client.js`, `server.mjs`, and `agents.json` files are generated
artifacts. Change source under `src/`, rebuild the package, and validate the
result; do not edit generated files directly.

## Package Contract

The package contributes an Agent in the `pre_generation` phase through the
`chat-settings` slot, and shows what the last reply used and saved in the chat's Agent activity panel (`chat-activity` slot). It supports Conversation, Roleplay, and Game modes,
requires Engine `>=2.5.2 <4.0.0`, and requires restart after installation or
runtime changes.
