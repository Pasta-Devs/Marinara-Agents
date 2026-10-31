# Long-Term Memory Architecture

This is the implementation map. Product intent lives in `../src/engine/packages/client/src/features/long-term-memory/PRODUCT.md`; client interaction rules live in its sibling `DESIGN.md`.

## Boundaries

```text
shared  -> schemas, note types, scopes, settings, validation
server  -> persistence, extraction, retrieval, routes, runtime integration
client  -> vault, review queue, sources, settings, and injection summary
```

The server registers `long-term-memory:recall` (read-only memories for other
packages, from `services/`; see Services for Other Packages) and
`long-term-memory:runtime` (chat recall, receipts and the
vault lock for the Engine; registered host-only, so from Capability API 1.388
other packages get `null` from `services.get`) with the Engine and mounts
privileged routes under `/api/long-term-memory`. Registration is in
`server-entry.ts`; `routes.ts` composes one file per area under `routes/`
(notes, drafts, imports, maintenance, settings), with shared limits, errors and
the post-mutation rebuild in `routes/shared.ts`.

### Shared schema

The shared layer is in `src/engine/packages/shared/src/features/agents/long-term-memory/`.
`schema.ts` is a barrel that re-exports the ten area files in `schema/`, so
importers keep one specifier. A file imports only from the files above it in
this list, so the zod schemas are defined before use.

| File (`schema/`) | Defines |
| --- | --- |
| `primitives` | note types, statuses, modes, vault folders, ids, subjects, scopes, links and other building blocks the rest reuse |
| `settings` | global, extraction, retrieval, retention and per-agent settings, and the defaults |
| `debug` | debug log statuses, phases, errors and events |
| `recall` | usage counts, the last-injection summary and recall attempts |
| `notes` | notes, sections, evidence units, events, bulk actions, note transfer and fork, section rename and delete |
| `indexes` | index health, chunks, and the embedding, BM25 and graph indexes |
| `identity` | identity-repair previews, candidates and conflicts |
| `drafts` | drafts, extraction outcomes and diagnostics, rejected suggestions, draft review and preflight |
| `sources` | Engine chat and lorebook previews, source details and source import |
| `backup` | the backup file |

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
| `identity/` | subject identity (`subject-names`: name text rules; `subject-matching`: the trusted catalog's types, index and matchers; `subject-catalog`: building and loading the catalog and checking stored notes against it; `subject-identity`: resolving a batch's subjects), chat scope and scope links, identity and fork repair | `subject-names`, `subject-matching`, `subject-catalog`, `subject-identity`, `subject-choice-review`, `subject-equality`, `identity-repair`, `note-fork-repair`, `chat-scope`, `scope-links` |
| `drafts/` | the draft store, projection and review, applying drafts to notes, rejected suggestions | `draft-store`, `draft-projector`, `draft-review`, `reconciliation`, `rejected-suggestions` |
| `maintenance/` | integrity checks and repair, note transfer, legacy agent-settings adoption and quarantine, the debug log | `maintenance`, `note-transfer`, `legacy-adoption`, `legacy-source-quarantine`, `debug-log` |
| `sources/` | Engine chats, summaries and messages read as sources | `interop`, `source-identity` |
| `services/` | what other packages can look up through the Engine: recalled memories about the accounts they write as (`recall`), the shareable-memory rule, the reads switch and the reader list | `recall`, `storage-read` |

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

Before compiling, source extraction recalls existing memories that match the
source, bounded by the `existingNoteMaxChunks` and `existingNoteMaxTokens`
extraction settings. The server uses them to drop duplicate details and to pick
the memories a new unit updates. They are never sent to the model.

Memories from chats decides whether chats are imported in the background and
whether low-risk proposals are accepted. The global choice is the two extraction
settings `autoImportChatSources` and `autoAcceptSafeChanges`; a chat can
override it with the chat-metadata key `longTermMemoryChatMemories` (`manual`,
`review` or `save`; unset or unknown uses the global settings).
`resolveLtmChatMemories` in the shared `runtime-settings.ts` resolves the chat's
choice against the global settings for the arm check in `generation-injection.ts`,
the background job's re-check and accept step, a Sources import from one chat
and a source note's re-extract. The Engine passes only the recall keys to Chat
Settings, so `GET /chat-memories/:chatId` (`routes/settings.ts`) reads the
chat's choice for the panel.

Hide imported messages from the AI hides a piece's messages only after its
memories are saved: a source note with a pending draft keeps its not-yet-hidden
messages, and accepting, skipping or deleting that draft runs Hide again for the
note (`hideImportedMessagesAfterReview` in `sources/interop.ts`). The extraction
form saves the two flags of the shown choice, and an import follows a chat's
override only when every row comes from that chat.

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

Draft apply and source extraction schedule the rebuild in the background
(`rebuild-job.ts`) instead of running it before they answer. The job starts 1 s
after the last request, or 10 s after the first one during a steady stream, and
holds the vault lock only to read the notes and to publish; while it embeds,
saves, recall and debug writes go ahead. A write in between moves the
index-state revision, so the job publishes nothing and builds again, reusing the
vectors it embedded. Recall, extraction, the Engine refresh and the integrity
check run a scheduled rebuild at once and wait for it before they take the vault
lock, so they never read an index older than the notes. Waiting for the job while
holding the vault lock would deadlock, so `flushLtmIndexRebuild` throws there.
Editor, settings, scope-link, repair, restore and explicit rebuilds still run
under the lock, because their responses carry the rebuild's result.

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
reads false. The next recall answers from the keyword lanes and schedules a
background job that re-embeds the vault; an Engine refresh or reindex re-embeds
it before answering and stops that job. The job also stops, without trying
again, when a write lands while it embeds. The labels
are display text only: the clients show the "source changed" note from
`embeddingsAvailable === false`, because a renamed connection keeps its
`spaceId` (vectors stay usable) while a switched sidecar model keeps its
label.

## Services for Other Packages

Other packages look these up with `api.runtime.services.get(key)`. The Engine
does not say who asks, so `caller` is the name a package gives itself. Each read
is a debug-log line ("Read by another Agent" in Activity), and Memory Settings
lists the ten names that read most lately, so Clear log empties that list.
Recall gives nothing while "Other Agents can read memories" is off.

`long-term-memory:recall`, version 1:

```ts
recall({
  caller?: string,         // up to 64 letters, digits and . _ : -, else dropped
  queryText: string,       // 1-8,000 characters: what the package is about to write
  characterIds?: string[], // the accounts it writes as, up to 20
  personaId?: string,      // only when the persona's own account writes
  mode?: "roleplay" | "conversation",
  maxTokens?: number,      // 50-4,000, default 800
  whole?: boolean,         // default false: whole memories instead of ranked parts
  excludeFrom?: string[],  // callers whose intake records are left out, up to 10 names like `caller`
  signal?: AbortSignal,
}): Promise<{ version: 1; sections: { noteId; type; title?; text }[] } | null>
```

- `null` for invalid input (no query, or no character or persona), an aborted
  call or reads turned off; `{ version: 1, sections: [] }` when nothing matches.
  Other errors are thrown; malformed vault files are skipped, as in chat recall.
- Sections are memories available to the named characters or persona
  everywhere: never limited to a chat or group, archived, game-only or tone
  memories. A character or relationship memory comes back only when one of its
  subjects is a named account. Resolved threads and events are included.
- Order: thread, timeline_event, relationship, character, world, scene, and
  within a type the order chat recall ranks them in (the user's recall
  weights). `text` is the recalled part of each memory, within `maxTokens` and
  at most 20 recalled parts in all. Recall receipts and usage are not touched.
- `whole: true` returns every memory that passes the rules above with all its
  text instead of the parts that fit `queryText`: no ranking and no
  embeddings, but `queryText` is still required, so one call serves both
  modes. Order is the type order above, then newest first (`updatedAt`). A
  memory is added while its estimated tokens still fit `maxTokens`; one that
  does not fit is skipped, never cut, and later smaller ones can still fit.
  At most 20 sections. An older Long-Term Memory ignores `whole` and answers
  with ranked parts.
- Sections that only hold records the `excludeFrom` callers added through
  `long-term-memory:intake` are left out, and a memory with nothing else left
  is not returned. A section that also holds a chat memory or a manual edit
  stays. An older Long-Term Memory ignores `excludeFrom`; a malformed name
  makes the call invalid (`null`).
- A new section field can be added without a version change; removing or
  renaming one raises `version`.

`long-term-memory:intake`, version 1, lets a package add what it knows about a
character. Only `caller: "slurp2"` is accepted. The name is self-reported, so
the user's "Other Agents can add memories" switch (off by default) is the real
gate; an Engine-supplied caller id is the upgrade path.

```ts
submit({
  caller: "slurp2",
  recordId: string,        // 1-100 characters, the package's own id for the record
  characterIds: string[],  // 1-2 distinct character ids the line is about
  text: string,            // 1-1,000 characters; line breaks become spaces
  signal?: AbortSignal,
}): Promise<{ version: 1; status: "applied" | "unchanged" } | null>

retract({ caller: "slurp2", recordId: string, signal?: AbortSignal }):
  Promise<{ version: 1; status: "retracted" | "missing" } | null>
```

- `null` for invalid input, another caller, a character the host does not
  have, an aborted call or adding turned off (also for `retract`: memories
  already added stay). The switch and the signal are checked inside the vault
  lock. `submit` is also `null` when every named character's `char_slurp2_`
  memory from an earlier record was archived or narrowed by the user: intake
  leaves those alone. Other errors are thrown.
- Each record is a source note `ltmPackageSourceNoteId(caller, recordId)`
  (`source_pkg_slurp2_` and a hash) with `package_record` provenance
  `slurp2:<recordId>`, scoped to the named characters. Its line goes through
  the usual draft and apply path into a `from_slurp2` section on each
  character's own character memory (one scoped to that character alone), or a
  new `char_slurp2_` memory when there is none.
- Submitting the same text for the same characters again is `unchanged`; new
  text or characters replace the old line everywhere it went. `retract`
  removes the line and keeps the memory's other sections; a memory left
  empty is deleted with its source. It checks the whole vault before its
  first write, so an unreadable note makes it throw without changing
  anything.

## Scope and Safety

Scope resolution is shared between chat context and server retrieval. Changes
must preserve isolation between chat, character, lorebook, persona, universe,
and global targets. Inspect shared `scope.ts`, `identity/chat-scope.ts`, and
`extraction/scoped-targets.ts` before changing identity or visibility behavior.

Any installed package can look up a registered service, so whatever `services/`
hands out lists only memories available to the named characters or persona
everywhere: never memories limited to a chat or group, imported sources,
archived or game-only memories, drafts, or the vault folder. The intake
service writes only `from_<caller>` lines on character memories scoped to the
named characters, through its own source notes.

For storage or recovery changes, inspect `paths.ts`, `atomic-json.ts`,
`mutation-transaction.ts`, `vault-lock.ts`, `restore-recovery.ts`, and the
storage regression tests. For extraction changes, inspect the evidence-unit,
draft, reconciliation, and source-processing modules. For recall changes,
inspect retrieval, ranking, indexes, budget, and generation injection together.

## Verification

Use the narrowest relevant LTM regression first, then run the complete LTM and
repository gates when release artifacts or package contracts change. The test
ownership matrix and commands are maintained in [`../../../tests/README.md`](../../../tests/README.md).
