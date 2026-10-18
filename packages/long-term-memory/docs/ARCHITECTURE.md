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
`/api/long-term-memory`. Registration is in `server-entry.ts`; `routes.ts`
composes one file per area under `routes/` (notes, drafts, imports, maintenance,
settings), with shared limits, errors and the post-mutation rebuild in
`routes/shared.ts`.

### Engine fields read directly

The package reads these Engine-owned values without a declared Engine API, so
`engine-boundary.json` cannot list them.
`tests/long-term-memory-engine-fields.regression.ts` checks them against an
Engine checkout and fails when one is renamed or removed. A failure means Sources
quietly stops finding those summaries, or the built-in assistant starts appearing
as a source and place.

| Field or constant | Feeds | Engine definition |
| --- | --- | --- |
| `ChatMetadata.daySummaries`, `weekSummaries` | day and week conversation summaries | `packages/shared/src/types/chat.ts` |
| `ChatMetadata.summaryEntries` | agent summary entries | `packages/shared/src/types/chat.ts` |
| `ChatMetadata.summary` | the single legacy summary | `packages/shared/src/types/chat.ts` |
| `ChatMetadata.gamePreviousSessionSummaries` | game session summaries | `packages/shared/src/types/chat.ts` |
| `PROFESSOR_MARI_ID` (`__professor_mari__`) | excludes the built-in assistant from sources and places | `packages/shared/src/constants/defaults.ts` |

The reads are in `sources/interop.ts`. The long-term fix is an Engine API for chat
summaries, which needs a higher minimum Engine version.

## Server Modules

Server source is in `src/engine/packages/server/src/services/long-term-memory/`.
The top level holds the Engine entry points and helpers used everywhere; each
folder owns one area.

| Folder | Owns | Files (`.ts`) |
| --- | --- | --- |
| top level | Engine registration, runtime services, settings, route composition, shared errors and helpers | `server-entry`, `runtime`, `package-runtime`, `routes`, `settings`, `default-config`, `service-error`, `ltm-utils` |
| `routes/` | HTTP handlers, one file per area, and the helpers they share (`shared`) | `notes`, `drafts`, `imports`, `maintenance`, `settings`, `shared` |
| `persistence/` | vault storage, atomic writes, the vault lock, mutation journals, index state, the activity index, per-section source contributions, retention, backup and restore | `storage`, `mutation-transaction`, `atomic-json`, `paths`, `vault-lock`, `vault-snapshot`, `stored-note`, `index-state`, `index-quarantine`, `retention`, `backup-restore`, `restore-recovery`, `activity-index`, `section-contributions` |
| `recall/` | chunking, keyword, BM25, graph and embedding indexes, ranking, budget, the recall prompt, generation injection, injection receipts and usage | `chunking`, `bm25`, `keyword-extract`, `keyword-index`, `hangul-lexical`, `graph`, `metadata-index`, `ranking`, `budget`, `prompt`, `prompt-text`, `retrieval`, `rebuild`, `embedding-adapter`, `generation-injection`, `usage` |
| `extraction/` | evidence-unit extraction, validation and compilation, source processing and hashes, candidate reconciliation, extraction settings | `evidence-unit-extraction`, `evidence-unit-validation`, `evidence-unit-compiler`, `structured-summary-normalizer`, `source-extraction`, `source-processing`, `source-hash`, `dedup`, `candidate-reconciliation`, `scoped-targets`, `extraction-config` |
| `identity/` | subject identity, chat scope and scope links, identity and fork repair | `subject-identity`, `subject-choice-review`, `subject-equality`, `identity-repair`, `note-fork-repair`, `chat-scope`, `scope-links` |
| `drafts/` | the draft store, projection and review, applying drafts to notes, rejected suggestions | `draft-store`, `draft-projector`, `draft-review`, `reconciliation`, `rejected-suggestions` |
| `maintenance/` | integrity checks and repair, note transfer, legacy adoption and quarantine, the debug log | `maintenance`, `note-transfer`, `legacy-adoption`, `legacy-source-quarantine`, `debug-log` |
| `sources/` | Engine chats and summaries read as sources | `interop`, `source-identity` |

The folders are areas, not enforced layers. `persistence/` still imports from
the areas above it: `storage.ts` uses `drafts/draft-projector`,
`extraction/source-hash`, `identity/chat-scope` and
`maintenance/legacy-source-quarantine`; `backup-restore.ts` uses the draft
store, rejected suggestions, extraction settings, maintenance and the index
rebuild; `retention.ts` and `vault-snapshot.ts` use `recall/`. No lint rule
checks import direction.

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
and global targets. Inspect shared `scope.ts`, `identity/chat-scope.ts`, and
`extraction/scoped-targets.ts` before changing identity or visibility behavior.

For storage or recovery changes, inspect `paths.ts`, `atomic-json.ts`,
`mutation-transaction.ts`, `vault-lock.ts`, `restore-recovery.ts`, and the
storage regression tests. For extraction changes, inspect the evidence-unit,
draft, reconciliation, and source-processing modules. For recall changes,
inspect retrieval, ranking, indexes, budget, and generation injection together.

## Verification

Use the narrowest relevant LTM regression first, then run the complete LTM and
repository gates when release artifacts or package contracts change. The test
ownership matrix and commands are maintained in [`../../../tests/README.md`](../../../tests/README.md).
