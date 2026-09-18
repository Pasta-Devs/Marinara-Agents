# Slurp2 source architecture

Paths are relative to `packages/slurp2/src/engine/`. The rules below are enforced by
`tests/slurp2-architecture.regression.ts`; this document explains them. The migration toward this
layout is tracked in `SLURP-MODULE-PLAN.md` and `SLURP-MODULE-STATUS.md` at the repository root.

## Roots

```text
packages/client/src/slp/    client UI, hooks, state, locales
packages/server/src/slp/    pure rules, persistence, routes, services, workflows
packages/shared/src/slp/    pure code imported by both client and server
```

`shared/src/slp/` holds pure rules that both sides genuinely need: the autopurge date calculation,
plus the tone, tuning, model-budget, modifier, platform-event, fan-type, and population rules the
settings surface reads and the server enforces. It imports neither client nor server code, depends
only on `zod` and `@marinara-engine/shared`, and holds no I/O, no React, and no Fastify. Client and
server may import it. A rule belongs here only when both sides already need it; a rule one side
needs stays in that side's `base/` or `modules/`.

Two named exceptions live outside the roots and are owned separately:

- `packages/client/src/lib/api-client.ts` — a package-owned override of the Engine host file. The
  Engine-generic `hooks/use-creator-personas.ts` imports it, so it cannot move. That hook stays
  unowned and byte-identical to Engine.
- `packages/server/src/services/garnish-ads/` — Garnish, a separate reusable ad module. Slurp uses
  it through the adapters in `features/ads/`; Garnish never imports Slurp.

Every file under a root or exception must be in `slurp2OwnedSourcePaths` in
`scripts/build-feature-packages.mjs`. Otherwise the builder captures it into `sources/engine` as
generic Engine material. The final ownership list is exactly the three roots plus the two
exceptions.

## Client layers

```text
base <- modules <- features <- app <- slp-client-entry.tsx
```

| Layer | Holds | May import |
|---|---|---|
| `base/` | `api/`, `chrome/`, `media/`, `state/`, `ui/`: domain-neutral plumbing | `base`, `locales`, shared |
| `modules/` | reusable presentation: `creator/`, `post/`, `story/`, `poll/`, `coin/` | `base`, `modules` |
| `features/<name>/` | one product area, including its hooks and Backstage panels | `base`, `modules`, own feature, other features' contracts |
| `app/` | router, navigation, `screens/` — composition only, no domain logic | everything below |
| `locales/` | `en`, `de`, `ko`, `pl`; keys unchanged | — |

Modules render from props and import no feature hook. `features/backstage/` owns only the shell,
save contract, search and deep links, and one explicit `{ target, Component }` panel registry.
Each settings panel lives with the feature whose setting it controls.

`features/settings/` mirrors the server feature of the same name. It owns the Slurp settings
document itself — its type, its read and write hooks, and the image-connection and post-guidance
hooks that write into it — and exposes `slp-settings-contract.ts` to the features that read a
setting. It does not own another feature's panel.

Hook files follow the file rule below rather than React's `use-` convention: a hook module is named
`slp-<domain>-hooks.ts`, so every file under a root sorts and greps by domain. The hook symbols
inside keep their existing public `useSlurp*` / `useNoodler*` names.

## Server layers

```text
base <- modules <- data <- features <- workflows <- slp-server-entry.ts
```

| Layer | Holds | May import |
|---|---|---|
| `base/` | `host/`, `prompting/`, `media/`, `identity/`, `model/`, `locking/`, `modifiers/`: domain-neutral infrastructure | `base` |
| `modules/<domain>/` | pure domain rules: no database, host storage, Fastify, or model call (`settings/` holds the settings schema, `records/` the stored-record model, `requests/` the shared request schemas) | `base`, `modules` |
| `data/` | persistence: `host/` storage context, `settings/`, one `<domain>/` facet folder per area, and the `slp-storage.ts` composition | `base`, `modules`, `data` |
| `features/<name>/` | routes, services, operations, and schedulers for one area | `base`, `modules`, `data`, own feature, other features' contracts |
| `workflows/` | coordination across features | feature contracts, and everything below `features` |
| `slp-server-entry.ts` | creates route dependencies and schedulers once and mounts routes in order | everything |

`modules/` and `data/` are shared layers: their domain folders organize files, and they may import
each other's domain folders without contracts. A pure rule never reaches I/O, and persistence never
reaches a route or a service. A feature never imports a workflow or the entry.

`features/viewer/` holds the shared route plumbing (`slp-route-host.ts`, `slp-viewer-context.ts`)
that every feature's routes receive through `SlpRouteDeps`. `features/media/` owns image generation
and media routes, and `features/settings/` owns the settings routes; the domain-neutral image and
media helpers stay in `base/media/`.

## Features

Client and server share one feature vocabulary: `creators`, `feed`, `messages`, `discovery`,
`audience`, `projects`, `economy`, `notifications`, `world`, `ads`, `onboarding`, `maintenance`,
plus client-only `backstage` and server-only `viewer`, `media`, and `settings`. Submodules that are deliberate expansion seams get a folder:
`creators/improvement`, `feed/reserve`, `messages/commissions`, `world/events`.

These are not features: Stories (a `modules/story/` presentation composed by Feed), tags
(Discovery), wallet (Economy), goals and arcs (Projects).

## Contracts and workflows

A feature that another module needs exposes the smallest explicit `slp-<name>-contract.ts`. Another
feature, or a workflow, imports only that file — never another feature's internals. Add a contract
only for a cross-feature call that already exists.

Move logic into a workflow only when it already coordinates several features. Do not wrap a
single-feature operation in a workflow.

## Cross-feature modifiers

Platform events affect other features through pure numeric modifiers in `base/modifiers/`, not an
event bus. A modifier names a target (initially `economy.subscription-price`), an operation
(`multiply` or `add`), a bounded value, and its source. Resolution is deterministic: sort by source,
apply multiplies, then adds; the consumer rounds and clamps once. The provider receives the
evaluation time from its caller. Nothing rewrites stored prices when an event starts, and nothing
cleans up when it ends, so the behaviour is restart-safe. Design a separate contract when a real
non-numeric need appears.

The producing side (`modules/world/events/`) stores only the effect on a saved event and stamps
`source` on at activation, so an event cannot claim a modifier on another event's behalf. The
consuming side builds the provider from the settings snapshot it has already read, inside its own
transaction — never from a provider cached at activation, which would freeze the event list until
the next restart. A consumer depends on `SlpActiveModifierProvider`, never on World.

## Naming

- React components: `SlpName.tsx`, with component symbols `SlpName`.
- Every other file: `slp-name.ts` or `slp-name.tsx`. Suffixes such as `slp-modifier.types.ts` are
  fine.
- Folders use short domain nouns and do not repeat `slp`.
- No generic `index.ts` barrels. Import the concrete file or a contract.
- A submodule gets its own folder only when it has several cohesive files or is an expansion seam.

Persisted and public names are not renamed during source work: `/api/slurp2` and `/noodler/*`
routes, `slurp2_*` tables, `noodle*` stored identifiers and keys, stored JSON shapes, `ui.slurp.*`
locale keys, and existing exported Slurp/Noodle symbols that form a public contract. New private
symbols use `Slp`/`slp`.

## Size

No file under a root may exceed 800 physical lines. Aim for under 400; crossing 400 is a review
prompt. Locale JSON and `*.generated.*` files are exempt. There is no size allowlist: a monolith is
split into cohesive files as part of its move, never moved whole.

## Forbidden imports (summary)

- `base/` → `modules/`, `data/`, `features/`, `app/`, `workflows/`, or an entry.
- `modules/` → `data/`, `features/`, or `app/`; a server module → `fastify`, `db/connection`,
  `db/file-query`, or host `services/storage/`.
- `data/` → `features/`, `workflows/`, or an entry.
- a feature → another feature's non-contract file, a workflow, or an entry.
- a workflow → a feature's non-contract file.
- client `slp` ↔ server `slp`.
- `shared/src/slp/` → anything under `packages/client/` or `packages/server/`.
