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

## Source Layout

```text
src/engine/packages/
├── client/   React capability UI and chat settings
├── server/   storage, extraction, retrieval, routes, and runtime services
└── shared/   schemas, scope rules, constants, and shared types
```

The root `client.js`, `server.mjs`, and `agents.json` files are generated
artifacts. Change source under `src/`, rebuild the package, and validate the
result; do not edit generated files directly.

## Package Contract

The package contributes an Agent in the `pre_generation` phase through the
`chat-settings` slot. It supports Conversation, Roleplay, and Game modes,
requires Engine `>=2.4.1 <4.0.0`, and requires restart after installation or
runtime changes.
