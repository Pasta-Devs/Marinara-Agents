# Long-Term Memory Architecture

This is the implementation map. Product intent lives in `../src/engine/packages/client/src/features/long-term-memory/PRODUCT.md`; client interaction rules live in its sibling `DESIGN.md`.

## Boundaries

```text
shared  -> schemas, note types, scopes, settings, validation
server  -> persistence, extraction, retrieval, routes, runtime integration
client  -> vault, review queue, sources, settings, and injection summary
```

The server registers `long-term-memory:storage` and
`long-term-memory:runtime` with the Engine and mounts privileged routes under
`/api/long-term-memory`. Registration is in `server-entry.ts`; route behavior is
in `routes.ts`.

## Durable State

The package data root is `long-term-memory/`:

```text
vault/{sources,timeline,characters,relationships,scenes,world,threads,tone}/
events/log.jsonl             append-only mutation history
events/receipts/             idempotency receipts
debug/log.jsonl              diagnostic events
indexes/                     rebuildable retrieval indexes
drafts/                      proposed changes awaiting review
transactions/                recovery journals
config/                      settings and rejected suggestions
```

Vault notes are the current durable state. The event log records mutation
history. Indexes are derived and rebuildable. Paths must pass the shared safe
path/schema checks; callers do not construct paths from unchecked user input.

## Write Flow

```text
source material
  -> source extraction
  -> validated evidence units
  -> projected review drafts
  -> user accepts or skips
  -> validated mutation transaction
  -> atomic vault update and event/activity records
  -> index refresh or rebuild
```

Mutation transactions journal the intended file changes, mark indexes dirty,
apply JSON changes atomically, publish events, and leave recovery information
for interrupted work. Review remains mandatory: generation recall never writes
durable memory directly.

## Backup and Restore

`backup-restore.ts` exports notes, drafts, rejected suggestions, and package
settings, and validates imports before publishing restored data. Restore stages
the replacement data and journals root swaps; `restore-recovery.ts` recovers
interrupted restores during storage initialization. Keep backup/restore changes
aligned with storage initialization and the storage and backup regression tests.

## Recall Flow

```text
recent chat messages + chat settings
  -> chat mode and scope resolution
  -> direct metadata, keyword/BM25, embedding, and graph lanes
  -> reciprocal-rank fusion
  -> scope/status filtering and token budgeting
  -> serialized prompt artifact at pre-generation
  -> receipt/debug/activity accounting
```

The retrieval entrypoint is `retrieval.ts`; ranking and budget behavior are in
`ranking.ts` and `budget.ts`; host injection and receipts are in
`generation-injection.ts`.

## Scope and Safety

Scope resolution is shared between chat context and server retrieval. Changes
must preserve isolation between chat, character, lorebook, persona, universe,
and global targets. Inspect `scope.ts`, `chat-scope.ts`, and `scoped-targets.ts`
before changing identity or visibility behavior.

For storage or recovery changes, inspect `paths.ts`, `atomic-json.ts`,
`mutation-transaction.ts`, `vault-lock.ts`, `restore-recovery.ts`, and the
storage regression tests. For extraction changes, inspect the evidence-unit,
draft, reconciliation, and source-processing modules. For recall changes,
inspect retrieval, ranking, indexes, budget, and generation injection together.

## Verification

Use the narrowest relevant LTM regression first, then run the complete LTM and
repository gates when release artifacts or package contracts change. The test
ownership matrix and commands are maintained in [`../../../tests/README.md`](../../../tests/README.md).
