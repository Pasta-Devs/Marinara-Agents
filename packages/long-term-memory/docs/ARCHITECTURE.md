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
  -> direct metadata, keyword/BM25, and embedding lanes
  -> reciprocal-rank fusion
  -> scope/status filtering and token budgeting
  -> linked recall: near-miss memories behind explanatory links from recalled ones
  -> serialized prompt artifact at pre-generation
  -> receipt/debug/activity accounting
```

Recall reuses the parsed recall index while the index-state revision, the
`recall.json` file identity and the stop words are unchanged. Each package
mutation bumps the revision under the vault lock and `invalidateLtmVaultSnapshot`
drops the cached index, so a mutation or repair is never served stale. The cached
index is used only while the index state is clean. Each process's first recall
checks the whole vault, which catches notes edited outside the package before it
started. Notes edited outside the package while it runs, or by a second process
on the same vault, are seen after a restart or that process's next mutation. A
rebuild embeds only chunks whose `textHash` is new when the previous index shares
the embedding space.

The retrieval entrypoint is `retrieval.ts`; ranking and budget behavior are in
`ranking.ts` and `budget.ts`; the linked-recall lookup is in `graph.ts`; host
injection and receipts are in `generation-injection.ts`.

## Embedding Source

Recall embeddings come from the Engine agent config for `long-term-memory`,
falling back to the default connection (Connections → Semantic Search
(Embeddings)). The package resolves that source through
`resolvePackageEmbeddingAdapter()`; the "Extraction connection" in Memory
Settings only drives extraction. The built-in fallback is MiniLM, which is
trained on English, so Korean, Japanese, Chinese or mixed-language vaults
should set a multilingual embedding model on that connection, such as
`BAAI/bge-m3` (which needs no query or document prefixes). Keyword and BM25 lanes only match within one language, so a
multilingual vector lane is the only cross-language bridge.

`GET /status` reports `indexes.embeddingSource` (the label of the source
recall would embed with now) and `indexes.indexedEmbeddingSource` (the label
stored with the vectors). `embeddingsAvailable` is true only while the stored
`spaceId` matches the current adapter's `spaceId`; after a source switch it
reads false and the vault re-embeds on the next recall or reindex. The labels
are display text only: the clients show the "source changed" note from
`embeddingsAvailable === false`, because a renamed connection keeps its
`spaceId` (vectors stay usable) while a switched sidecar model keeps its
label.

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
