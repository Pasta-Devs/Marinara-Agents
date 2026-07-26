# Long-Term Memory Simplification Plan

## Purpose

This document turns the Long-Term Memory over-engineering audit into an implementation handoff. It records the traced callers, safest fixes, functional impact, compatibility and security risks, execution order, and validation required for the next agent.

The implementation goal is deletion and consolidation without changing vault contents, recall results, extraction semantics, scope isolation, or recovery guarantees except where this document explicitly identifies an API or telemetry contraction.

## Repository Rules

- Follow `AGENTS.md`, `CONTRIBUTING.md`, and `.github/agents/chai-workflow.md`.
- Open or link an issue and make ownership visible before implementation. Open a draft PR when work begins.
- Change source under `packages/long-term-memory/src/`; never hand-edit generated bundles, archives, catalogs, hashes, or sizes.
- Treat executable client/server changes, backup/restore, package activation, and index recovery as security-sensitive.
- Preserve unrelated work in a dirty worktree.
- Long-Term Memory `1.0.16` already has a published artifact. Bump the builder definition to `1.0.17` before rebuilding.

## Behavioral Invariants

The completed change must preserve all of these:

1. Notes and drafts survive package update, restart, offline restart, uninstall, and reinstall exactly as before.
2. Old valid backups containing policy and retrieval settings still import. Malformed present legacy fields still fail validation at the backup trust boundary.
3. New backups omit inert policy and retrieval settings, and restoring an old backup does not recreate their files.
4. Recall continues to exclude archived memories, apply resolved-thread policy, enforce mode and scope isolation, and rank the same active chunks.
5. Existing valid derived indexes with obsolete fields remain readable; malformed indexes may be quarantined and rebuilt, but vault notes must never be quarantined or modified because of index-format cleanup.
6. Source extraction preserves model selection, prompt messages, response format, cancellation, reasoning effort, verbosity, temperature, token limits, and context preflight behavior.
7. Deduplication preserves exact and lexical matching, note/section boundaries, existing-note matching, and same-extraction matching.
8. Backup restore locking, staging, integrity checks, rollback journaling, and path validation remain unchanged.
9. `withLtmVaultLock` and its `AsyncLocalStorage` reentrancy remain unchanged.

## Audit Findings

### 1. Remove Inert Policy And Retrieval Configuration

**References**

- Defaults: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/default-config.ts:7`
- Schemas: `packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts:1205`
- Initialization: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/storage.ts:135`
- Backup export/restore/reset: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/backup-restore.ts:54`
- Backup schema: `packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts:3017`

**Traced state**

- `DEFAULT_LTM_POLICIES` and `DEFAULT_LTM_RETRIEVAL_CONFIG` are used only to initialize and round-trip `config/policies.json` and `config/retrieval.json`.
- No recall, mutation, route, retention, or client path reads either setting.
- Active recall settings come from global/chat settings through `runtime-settings.ts`.

**Safest fix**

1. Keep the legacy policy/retrieval schemas only as private backup-field validators; remove their exported runtime types and defaults.
2. Make `settings.policies` and `settings.retrieval` optional in `ltmBackupSchema` so legacy backups remain valid.
3. Stop including either field in `exportLongTermMemoryData()`.
4. Stop writing either field in `writeBackupRoot()` and `resetLongTermMemorySettings()`.
5. Remove both entries from `LongTermMemoryStorage.initializeLtmStore()`.
6. Leave existing on-disk files untouched and unread. Do not add migration or deletion code.

**Functional impact**

- Recall and extraction behavior do not change because the settings are inert.
- Fresh stores and reset stores stop creating two unused files.
- New backup JSON loses two settings keys. Existing valid backups still import, but those settings are ignored and disappear on re-export.

**Risks**

- Making legacy backup fields permissive instead of validated would weaken the import trust boundary. Keep strict validation when the optional fields are present.
- External tools that assume the old backup shape may need adjustment.
- Do not remove retention configuration; it is live.

**Focused checks**

- Extend `tests/long-term-memory-storage.regression.ts` to prove fresh initialization omits both files.
- Prove a new export omits both keys.
- Prove a valid legacy backup imports and re-export drops the keys.
- Prove malformed present legacy fields are rejected.
- Prove delete-all and settings reset still preserve their documented note/draft behavior.

### 2. Delete The Abandoned Index-Generation Subsystem

**References**

- Dead module: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/index-generation.ts:1`
- Generation schemas: `packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts:1308`
- Status response: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/routes.ts:313`
- Active recall index: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/rebuild.ts:28`
- Active state index: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/index-state.ts:8`
- Transfer summary: `packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts:1864`

**Traced state**

- Nothing imports or calls `index-generation.ts`.
- `indexes/current.json` and `indexes/generations/<id>/manifest.json` have no active owner.
- Active indexing uses only `indexes/recall.json` and `indexes/state.json`.
- Status always returns `manifestAvailable: false`, null generation IDs, and `recovered: false`; the built-in client reads none of them.
- `lastPublishedGenerationId` is never used.
- Transfer/repair `manifest` is always unavailable.
- `sourceChunkCount` is always zero because rebuild calls `chunkNotes(..., { includeSourceNotes: false })`.

**Safest fix**

1. Delete `index-generation.ts`.
2. Remove `ltmIndexMetadataSchema`, `ltmIndexFamilySchema`, `ltmIndexFamilySummarySchema`, `ltmIndexGenerationManifestSchema`, and `ltmIndexPointerSchema`, plus their inferred types.
3. Remove `lastPublishedGenerationId` from the parsed state shape, but preprocess and ignore that key when reading a legacy `state.json`.
4. Remove `manifestAvailable`, `generationId`, `currentGenerationId`, and `recovered` from `ltmStatusResponseSchema` and `/status`.
5. Remove `manifest` and `sourceChunkCount` from `ltmTransferRebuildSummarySchema` and every response mapper.
6. Remove `sourceChunkCount` from `rebuildLongTermMemoryIndexes()`.
7. Keep `recall.json`, `state.json`, health, dirty/rebuild state, counts, timestamps, errors, warnings, chunk format, and embedding status.

**Functional impact**

- Runtime indexing and recall do not change.
- Raw status, note-transfer, and identity-repair response shapes become smaller.
- Source-note indexing does not change; source notes remain excluded from active recall.

**Risks**

- External HTTP consumers may depend on removed status or rebuild fields even though the in-repository client does not.
- Removing `lastPublishedGenerationId` without a legacy preprocessor would make valid old state look corrupt and can leave status dirty/failed while a valid recall index remains loaded. Strip only that obsolete key before strict validation.
- Do not confuse request-generation code such as `generation-injection.ts` with the dead index-generation subsystem.

**Focused checks**

- Extend `tests/long-term-memory-routes.regression.ts` to assert the remaining status fields and absence of generation fields.
- Verify note-transfer and identity-repair responses omit `manifest` and `sourceChunkCount` while retaining useful rebuild data.
- Keep runtime malformed-index recovery coverage as the proof that only derived files are rebuilt.

### 3. Delete The Unused Shared Type Re-Export

**Reference**

- `packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/types.ts:1`

**Traced state**

- No source, test, script, generated entry, or shared index imports this file.
- Consumers already infer and import types from `schema.ts`.

**Safest fix**

- Delete `types.ts`; change no imports unless a final search reveals a concurrent new caller.

**Functional impact**

- None. It is an unreachable type-only source file.

**Risk**

- Only unpublished external deep imports into this source tree would break. Downloadable packages contain bundles, not this source module.

### 4. Delete Unused Recall Helpers And Constants

**Reference**

- `packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/constants.ts:23`
- `packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/constants.ts:371`

**Traced state**

- Unused constants: `IMPORTANCE_LEVELS`, `DEFAULT_RELATIONSHIP_BASELINE`, and `LTM_EXTRACTION_EXAMPLE`.
- Unused functions: `clampLtmRecallWeight()` and `readLtmRecallWeightOverrides()`.
- The active runtime parser in `runtime-settings.ts` rejects invalid values to a preset; the dead helper clamps them. Reusing it would change ranking behavior.

**Safest fix**

- Delete exactly those five exports. Keep `RELATIONSHIP_DIMENSIONS`, `QUEST_THREAD_SECTION_KEYS`, style presets, `LtmRecallWeights`, and `parseLongTermMemoryRecallStyle()`.

**Functional impact**

- None. Active recall parsing and ranking remain untouched.

**Risk**

- Do not replace the runtime parser with the deleted clamping helper.

### 5. Shrink The Metadata Index

**References**

- Schema: `packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts:1495`
- Builder/query: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/metadata-index.ts:14`
- Builder caller: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/rebuild.ts:52`
- Query caller and authoritative filters: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/retrieval.ts:43`

**Traced state**

- Live buckets: `chunks`, `byNoteId`, and `byTag`.
- Serialized but unused: `byType`, `byStatus`, `byMode`, and every `byScope` bucket.
- `getLtmMetadataMatches()` is called only with parsed note IDs and tags.
- `retrieval.ts` filters chunk metadata for archived/resolved status, mode, group, chat, character, persona, and global scope before ranking.

**Safest fix**

1. Reduce `ltmMetadataIndexSchema` to `version`, `chunks`, `byNoteId`, and `byTag`.
2. Simplify `MutableLtmMetadataIndex` and `buildLtmMetadataIndex()` to create and sort only those buckets.
3. Remove `LtmScope`, scope helpers, `scope`, and `characterIds` from `getLtmMetadataMatches()`.
4. Leave the authoritative `allowed` chunk filter in `retrieval.ts` unchanged.
5. Preprocess legacy metadata objects by discarding `byType`, `byStatus`, `byMode`, and `byScope`, then strictly parse the retained current fields. Do not rewrite the file solely for this cleanup.
6. Keep the existing `loadOrRebuildLongTermMemoryIndexes()` quarantine/rebuild path for genuinely malformed or stale data.

**Functional impact**

- Intended recall results are unchanged.
- New `recall.json` files are smaller and rebuild work is reduced.
- Existing valid expanded `recall.json` files remain readable without a rebuild; obsolete buckets are ignored in memory. The next ordinary rebuild writes the smaller shape.

**Risks**

- Moving or weakening scope/status/mode filtering could expose memories across chats. Do not relocate those filters into optional metadata buckets.
- A rebuild failure must surface through existing health/recovery behavior, not fall back to unfiltered recall.

**Focused checks**

- Extend `tests/long-term-memory-runtime.regression.ts` to inspect the reduced metadata shape.
- Prove direct note-ID and tag recall still works.
- Prove archived, resolved-thread, mode, and cross-chat exclusions still hold.
- Prove an old expanded `recall.json` remains readable without rebuilding, while a malformed index still rebuilds without note loss.

### 6. Mock Lorebook Fixtures Without Real CRUD

**Reference**

- `tests/long-term-memory.e2e.ts:47`
- Lorebook test: `tests/long-term-memory.e2e.ts:444`

**Traced state**

- The browser test creates two real lorebooks and three entries, then intercepts the LTM preview endpoint with handcrafted data. Real CRUD is unrelated to what the test asserts.
- The Playwright configuration uses one worker and disables full parallelism, so fixed IDs are safe.

**Safest fix**

1. Delete `createLorebook()`, `createLorebookEntry()`, and `deleteLorebook()`.
2. Remove every `/api/lorebooks*` setup and cleanup call.
3. Keep the local generated `client.js` interception.
4. Keep the `/api/long-term-memory/import/lorebooks/preview` interception.
5. Replace dynamic lorebook, entry, and source IDs and labels with fixed fixture values.
6. Retain chat cleanup only.

**Functional impact**

- Production behavior is unchanged.
- The browser test continues proving client rendering, entry selection, actions, and responsive layout, but no longer exercises Engine lorebook CRUD or the runtime resource bridge.

**Risk**

- Do not accidentally remove the preview interception; that would turn this into a different integration test.
- Server-side lorebook normalization remains covered in `tests/long-term-memory-routes.regression.ts`.

### 7. Use The Capability Host Language Model Directly

**References**

- Local adapter type: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/model.ts:1`
- Host contract: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/package-runtime.ts:15`
- Route adapter: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/routes.ts:641`
- Import adapter: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/interop.ts:696`
- Model calls: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/evidence-unit-extraction.ts:342`
- Context preflight: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/evidence-unit-extraction.ts:689`

**Traced state**

- `LongTermMemoryExtractionModel` has one implementation shape and two duplicate constructors.
- The host's resolved model already provides `name`, `model`, limits, `chatComplete()`, and `fitContext()`.
- The route adapter explicitly projects supported completion options; interop currently forwards all options.
- Context preflight intentionally rejects any required prompt trimming and only accepts a reduced output-token budget.

**Safest fix**

1. Export a `PackageLanguageModel` type inferred from `CapabilityRuntimeHost["languageModels"]["resolveForRequest"]`.
2. Replace `provider` plus separate `model` plumbing with one `languageModel` object through `source-processing.ts`, `source-extraction.ts`, and `evidence-unit-extraction.ts`.
3. Call `languageModel.chatComplete(messages, options)` directly.
4. Call `languageModel.fitContext(messages, { maxTokens })` directly.
5. Build only host-supported completion options. Do not pass local-only `model` or `stream` keys.
6. Use `languageModel.name` and `languageModel.model` for telemetry.
7. Preserve current preflight behavior: ignore fitted messages when no trimming is required; throw if `fit.trimmed` is true; apply only a reduced `fit.maxTokens`.
8. Pass the resolved object directly from routes and interop, then delete `model.ts` and both adapters.

**Functional impact**

- No intended extraction change.
- Route and imported-source extraction share the exact host contract instead of subtly different adapters.
- This is the highest-risk refactor because a forwarding mistake could change model output or break extraction.

**Risks**

- Dropping `responseFormat`, `signal`, reasoning effort, verbosity, temperature, debug mode, or token limits would change extraction.
- Forwarding unsupported local keys would change the host call contract.
- Using `fit.messages` would silently truncate source content, violating current extraction policy.

**Focused checks**

- Extend `tests/long-term-memory-routes.regression.ts` across both route and import flows.
- Assert completion receives original messages and all supported options.
- Assert it receives no `model` or `stream` option.
- Assert cancellation reaches `chatComplete()`.
- Assert reduced output budget is honored and prompt trimming still throws.

### 8. Parameterize Repeated Regression Commands

**Reference**

- `tests/README.md:23`

**Safest fix**

- Replace the four repeated storage, extraction-graph, runtime, and debug-log command blocks with a small parameter table and one shell loop.
- Keep the Playwright command separate.
- Keep routes and lifecycle commands separate because they require an isolated `MARINARA_ENGINE_ROOT`.
- Leave Hierarchical Maps commands unchanged.

**Functional impact and risk**

- Documentation only. The loop must remain directly runnable from the neighboring Engine checkout and preserve the same four test files.

### 9. Delete The Unreferenced Boundary Wrapper

**Reference**

- `scripts/long-term-memory-boundary.mjs:1`

**Traced state**

- No script, documentation, or package imports this wrapper.
- `scripts/build-feature-packages.mjs` and `scripts/validate-catalog.mjs` already call `assertPackagePrivateImportBoundary()` for LTM.

**Safest fix**

- Delete only `scripts/long-term-memory-boundary.mjs`.
- Do not refactor the generic boundary implementation as part of this audit.

**Functional impact**

- None. Build and validation boundary enforcement remains active.

**Risk**

- Run both the focused builder and catalog validator to prove the security gate still executes.

### 10. Deduplicate Extraction-Settings Schema Fields

**Reference**

- `packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts:347`

**Traced state**

- Full and patch schemas duplicate the same field definitions.
- Only the full schema may require active prompt-template IDs to exist in `promptTemplates`; a patch may refer to a template already stored outside the patch.

**Safest fix**

1. Define the prompt-template array schema once.
2. Define one plain `ltmExtractionSettingsFields` object.
3. Construct strict full and patch Zod objects from those fields.
4. Keep cross-field `.superRefine()` only on the full schema.
5. Preserve legacy preprocessing on both schemas.

**Functional impact**

- None intended. Validation limits, defaults, strict unknown-field rejection, migration, and patch semantics remain the same.

**Risk**

- Applying full-schema refinement to patches would reject valid partial updates.
- Accidentally sharing a refined Zod object instead of field definitions can alter schema behavior.

**Focused checks**

- Keep the existing patch-then-merge template tests in `tests/long-term-memory-routes.regression.ts`.
- Add field-boundary and unknown-field parity assertions for full and patch schemas.

### 11. Simplify Deduplication Inputs And Invariants

**References**

- `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/dedup.ts:11`
- Sole caller: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/evidence-unit-extraction.ts:1069`
- Canonical note ID helper: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/evidence-unit-validation.ts:636`

**Traced state**

- The sole caller always uses within-extraction matching.
- Exact matching and lexical threshold are never overridden.
- `embeddingSimilarity` is never read.
- The effective lexical threshold is always `0.85`.
- `dedup.ts` duplicates `noteIdForEvidenceUnit()`.

**Safest fix**

1. Import canonical `noteIdForEvidenceUnit()`.
2. Change the function to `deduplicateUnits(units, existingNotes)`.
3. Remove `DedupOptions`, `DeduplicateUnitsInput`, `DeduplicateUnitsResult`, and the embedding threshold.
4. Keep one local named lexical threshold of `0.85`.
5. Preserve exact normalization, token intersection, same-batch candidates, existing-note candidates, note/section matching, diagnostic content, and ordering.

**Functional impact**

- No intended change. Correct behavior still suppresses duplicate memory suggestions while retaining distinct facts.

**Risks**

- A regression could create duplicate memories or discard distinct memories.
- Preserve the current edge case where exact strings with no eligible tokens are not deduplicated because empty token sets return early.
- Preserve Jaccard `>= 0.85`, not `> 0.85`.

**Focused checks**

- Add one focused runnable test covering exact same-batch duplicate, existing-note duplicate, exactly `0.85`, just below `0.85`, different note/section, and empty-token exact text.

### 12. Remove Redundant Suggestion Metadata

**References**

- `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/evidence-unit-compiler.ts:33`
- Compiler integration: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/evidence-unit-extraction.ts:1083`
- Debug counters: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/source-extraction.ts:578`

**Traced state**

- `generated` and `returned` are both assigned `mutations.length`; no filtering or limit exists between them.
- They are removed before the extraction response and survive only as duplicate debug counters.

**Safest fix**

1. Make `compileLtmEvidenceUnits()` return `LtmExtractionResponse` directly.
2. Remove `LtmSuggestionMetadata`, `CompiledLtmEvidenceUnits`, and `suggestions` from compile results.
3. Remove `generatedMutations` and `returnedMutations` debug counts.
4. Keep the existing `mutations` count based on `compiledResponse.mutations.length`.

**Functional impact**

- Extraction mutations, drafts, and API responses do not change.
- Debug JSONL loses two redundant optional count keys.

**Risk**

- External debug-log consumers may parse those keys even though no schema requires them.

### 13. Share One Allowed-Stream Array

**References**

- `packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/constants.ts:245`
- Duplicate server array: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/evidence-unit-extraction.ts:52`

**Traced state**

- Roleplay, Conversation, Game, and the server-local default all list the same seven buckets.
- `LTM_EXTRACTION_BUCKET_SCAN_ORDER` has a different intentional order and must remain separate.

**Safest fix**

1. Define one readonly `DEFAULT_LTM_ALLOWED_STREAMS` array.
2. Map every mode in `DEFAULT_LTM_ALLOWED_STREAMS_BY_MODE` to that array to preserve the existing API.
3. Replace `DEFAULT_LTM_EVIDENCE_UNIT_ALLOWED_BUCKETS` with the shared array.

**Functional impact**

- No current extraction change. Every mode continues allowing the same streams.
- Future mode-specific policy will require deliberately reintroducing distinct arrays.

**Risk**

- The array is shared at runtime. Keep it readonly and preserve the existing clone where mutable use is required.

### 14. Delete The Unused Backup Snapshot Helper

**Reference**

- `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/backup-restore.ts:210`

**Safest fix**

- Delete `copyLongTermMemoryBackupSnapshot()` and remove now-unused `mkdir`, `basename`, `dirname`, and `join` imports.

**Functional impact**

- None. No caller uses it. Identity repair retains its own active snapshot/rollback implementation.

**Risk**

- Do not modify identity-repair backup creation or restore while deleting this helper.

### 15. Reuse Client Label Helpers

**References**

- Canonical helper: `packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/display-labels.ts:11`
- `packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/ReviewQueue.tsx:82`
- `packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/ActivityView.tsx:80`
- `packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/MemoryVault.tsx:126`

**Safest fix**

- Import and call `humanizeLabel()` directly in Review Queue and Activity.
- Delete `MemoryVault.title()` and call `noteTypeLabel()` directly.

**Functional impact**

- Labels should render identically: underscores become spaces and the first character is capitalized.

**Risk**

- Replace every wrapper call before deletion; client bundling is the simplest completeness check.

### 16. Remove Redundant Embedding-Adapter Global State

**References**

- `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/package-runtime.ts:88`
- Activation: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/server-entry.ts:30`
- Consumers: `embedding-adapter.ts` and `rebuild.ts`

**Traced state**

- Activation stores the whole runtime host and separately stores the same `runtime.embeddings` object.
- Per-operation embedding adapter injection is separate and live.
- Host cleanup is registration-token guarded; embedding cleanup is not. An old activation cleanup can clear a newer activation's adapter.

**Safest fix**

1. Delete `embeddingAdapter` global state and `configurePackageEmbeddingAdapter()`.
2. Make `getPackageEmbeddingAdapter()` return `host?.embeddings ?? null`.
3. Remove duplicate setup and cleanup from `server-entry.ts`.
4. Keep operation-level `options.embeddingAdapter` precedence unchanged.

**Functional impact**

- Normal embedding recall and rebuild behavior remain the same.
- Reactivation becomes more reliable by eliminating stale cleanup interference.

**Risks**

- Do not remove per-operation adapter injection.
- Add activation cleanup coverage that configures a newer host before invoking older cleanup and proves the newer embeddings remain active.

### 17. Delete The Duplicate Subject-Equality Module

**References**

- Duplicate module: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/subject-equality.ts:1`
- Existing implementation: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/subject-identity.ts:1094`
- Duplicate-module caller: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/draft-projector.ts:17`

**Safest fix**

- Change `draft-projector.ts` to import `subjectsEqual` from `subject-identity.ts`, then delete `subject-equality.ts`, as requested by the audit.
- Before editing, inspect the current import graph again. This direction can tighten the existing `subject-identity -> storage -> draft-projector` cycle.
- If runtime initialization fails because of that cycle, stop and document the conflict rather than silently changing the requested canonical direction. The minimal cycle-safe alternative is to keep the leaf implementation canonical and import it from `subject-identity.ts`.

**Functional impact**

- No intended comparison change. Missing arrays remain unequal, order matters, only `subject.key` matters, and differing reference metadata is ignored.

**Risks**

- Module initialization failure is the main risk, not equality semantics.
- Subject mismatch protection prevents unrelated identities from merging; preserve it exactly.

**Focused checks**

- Verify undefined inputs, length mismatch, equal keys, reversed keys, and equal keys with different reference metadata.
- Retain projector rejection for `subject_identity_mismatch`.
- Run package activation and extraction regressions to catch import-cycle failures.

### 18. Use Native `structuredClone`

**Reference**

- `packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/MemoryVault.tsx:111`

**Safest fix**

- Delete the JSON serialization clone helper and replace its calls with `structuredClone()`.
- Keep JSON-based `fingerprint()`; it implements dirty-state comparison, not cloning.

**Functional impact**

- Note editing should behave identically. Notes are schema-validated structured data, and native cloning preserves supported values more faithfully.

**Risk**

- `structuredClone` rejects functions and DOM objects, but `LtmNote` cannot contain them. The client already uses `structuredClone` elsewhere, so no new platform requirement is introduced.

### 19. Delete Other Unused Options And Keys

**References**

- Vault lock introspection: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/vault-lock.ts:6`
- Identity preview query key: `packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/api.ts:24`
- Source extraction options: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/source-extraction.ts:37`
- Rebuild calls: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/source-processing.ts:106`

**Traced state**

- `isLtmVaultLockHeld()` has no callers.
- `queryKeys.identityPreview` has no query or invalidation caller; identity preview is intentionally imperative POST state.
- `embeddingSource` and private `getExistingTypedNotes.sourceNoteId` are forwarded but unread.
- Rebuild `scope: "all" | "source"` arguments are ignored; rebuilds are full-vault today.

**Safest fix**

- Delete those fields and arguments only.
- Keep `withLtmVaultLock`, `AsyncLocalStorage`, all live extraction limits/settings, and per-operation embedding injection.

**Functional impact**

- None intended. Rebuild remains full-vault, identity preview remains imperative, and locking remains reentrant.

**Risks**

- Do not infer that source-only rebuild behavior exists; it does not.
- Do not remove similarly named debug `sourceNoteId` fields, which are live telemetry.

## Execution Order

Use focused commits or reviewable slices in this order. Keep each slice green before continuing.

### Phase 1: Characterize Contract-Sensitive Behavior

1. Add or confirm backup compatibility assertions.
2. Add metadata scope/mode/status, legacy-index normalization, and malformed-index recovery assertions.
3. Add model-option/context-preflight assertions.
4. Add focused dedup and subject-equality checks.
5. Confirm the current package activates before changing the subject import graph.

### Phase 2: Remove Isolated Dead Files And Symbols

1. Delete `types.ts`.
2. Delete the three constants and two recall helpers.
3. Delete the backup snapshot helper and vault-lock introspection.
4. Delete the identity preview key.
5. Delete `scripts/long-term-memory-boundary.mjs`.
6. Apply the subject-equality deletion with the import-cycle check.

### Phase 3: Remove Persisted Inert Configuration

1. Make legacy backup fields optional and validated.
2. Stop exporting, restoring, resetting, and initializing policy/retrieval settings.
3. Remove their defaults, public schemas/types, and imports after all runtime callers are gone.
4. Run storage and backup regressions immediately.

### Phase 4: Collapse Indexes

1. Shrink metadata schema, builder, and matcher together.
2. Remove generation schemas, state/status fields, transfer summary fields, and response construction together.
3. Delete `index-generation.ts`.
4. Run runtime, routes, transfer, identity-repair, integrity, and recovery checks.

### Phase 5: Simplify Extraction Internals

1. Deduplicate extraction settings and allowed streams.
2. Simplify dedup inputs and reuse the canonical note-ID helper.
3. Remove suggestion metadata and duplicate debug counters.
4. Remove inert source-extraction and rebuild options.
5. Replace the extraction-model adapter with direct host model use.
6. Remove redundant embedding runtime state.
7. Run extraction graph, routes, runtime, and debug-log regressions.

### Phase 6: Client, Browser Test, And Documentation Cleanup

1. Reuse label helpers and `structuredClone`.
2. Replace real lorebook CRUD with fixed intercepted fixtures.
3. Parameterize README regression commands.
4. Run the client build and Playwright desktop/mobile suite.

### Phase 7: Version, Rebuild, And Review Generated Output

1. Change LTM version in `scripts/build-feature-packages.mjs` from `1.0.16` to `1.0.17`.
2. Run the focused package rebuild.
3. Review generated client/server payload diffs, manifest provenance, ZIP contents, catalog lane membership, and unexpected `generatedAt` churn.
4. Do not delete prior immutable artifacts.

## Validation Commands

Run ordinary source regressions from the neighboring Marinara Engine checkout:

```bash
cd ../Marinara-Engine
for test in storage extraction-graph runtime debug-log; do
  pnpm --filter @marinara-engine/server exec tsx \
    "$PWD/../Marinara-Agents/tests/long-term-memory-${test}.regression.ts"
done
```

Run the isolated-host routes regression:

```bash
cd ../Marinara-Engine
MARINARA_ENGINE_ROOT="$PWD" \
  pnpm --filter @marinara-engine/server exec tsx \
  "$PWD/../Marinara-Agents/tests/long-term-memory-routes.regression.ts"
```

Rebuild the package from the Agents repository:

```bash
node scripts/build-feature-packages.mjs long-term-memory
```

Run browser coverage against a provisioned Engine with the rebuilt package installed and active:

```bash
cd ../Marinara-Engine
MARINARA_ENGINE_ROOT="$PWD" \
  pnpm exec playwright test \
  -c ../Marinara-Agents/tests/long-term-memory.playwright.config.ts
```

Run exact-artifact lifecycle coverage. This installs the immutable `1.0.16`
artifact, populates legacy state, updates to `1.0.17`, and verifies the vault
survives the migration and reinstall:

```bash
cd ../Marinara-Engine
MARINARA_ENGINE_ROOT="$PWD" \
  pnpm --filter @marinara-engine/server exec tsx \
  ../Marinara-Agents/tests/long-term-memory-lifecycle.regression.ts
```

Run repository gates from Marinara Agents:

```bash
node scripts/test-catalog-lanes.mjs
node scripts/validate-catalog.mjs
git diff --check
```

## Manual Package Proof

Because both executable payloads change, manually verify and record:

1. Fresh install and activation in a compatible Engine.
2. Update from the previous LTM artifact with an existing populated vault.
3. First recall after update, proving valid legacy indexes do not rebuild unnecessarily and malformed indexes still recover.
4. Conversation, Roleplay, Visual Novel, and Game availability.
5. Source extraction through both the single-note route and batch import.
6. Restart and offline restart.
7. Backup export, legacy backup preview/import, delete-all, and settings reset.
8. Uninstall and reinstall preserve the vault.
9. No cross-chat or cross-scope recall leakage.

## Generated Outputs Expected To Change

- `packages/long-term-memory/client.js`
- `packages/long-term-memory/server.mjs`
- `packages/long-term-memory/agents.json`
- `packages/long-term-memory/manifest.json`
- `artifacts/long-term-memory-1.0.17.zip`
- `catalog/v2/catalog.json`
- `catalog/catalog.json`
- Any catalog family metadata rewritten by the builder

The package remains in the Engine v2 lane because its manifest range remains `>=2.3.3 <2.4.0`. Engine boundary metadata and captured Engine sources should not change unless the source refactor reveals a real host-contract dependency change.

## Completion Checklist

- Every audit item above is either implemented or explicitly deferred with a reason.
- No deleted symbol has remaining source, test, script, or generated-entry references.
- New backups omit legacy fields; old valid backups import; malformed legacy fields fail.
- Recall isolation and ranking behavior pass focused regressions.
- Extraction host options and context behavior are unchanged.
- Dedup characterization passes unchanged.
- Package activation proves the subject import graph is valid.
- Focused rebuild completes and generated outputs are reviewed.
- Catalog lanes, catalog validation, lifecycle regression, Playwright, and `git diff --check` pass.
- PR validation checkboxes remain unchecked unless a human actually performed them.
