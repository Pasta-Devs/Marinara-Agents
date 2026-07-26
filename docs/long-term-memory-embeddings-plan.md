# Long-Term Memory Embeddings Implementation Plan

## Purpose

This document is the implementation handoff for enabling semantic recall in the installable Long-Term Memory package on the current Marinara Engine base.

It is intentionally separate from the prompt placement and injected-text readability work in `docs/long-term-memory-injection-plan.md`.

The goal is to enable the package's existing semantic retrieval lane with the smallest correct Engine and package changes, while preserving lexical fallback and avoiding mixed embedding spaces.

## Summary

The current Engine base already exposes `runtime.embeddings` to capability packages, but that host is not stable enough for Long-Term Memory:

- it has only `label` and `embed()`;
- it has no `spaceId`;
- it currently resolves through the general configured Memory Recall embedding path rather than a fixed local source.

The smallest good plan is:

1. keep the existing `runtime.embeddings` host shape and extension point;
2. add a stable `spaceId` to that host;
3. change the host implementation from "configured memory recall embeddings" to Engine's built-in local MiniLM embedder;
4. keep the rest of the semantic logic in the LTM package;
5. preserve lexical fallback whenever local embeddings are unavailable or fail.

This avoids introducing a second embedding host, avoids remote/provider configuration work, and gives the package one stable vault-wide vector space.

## Scope

### Included

- Reuse of the existing Engine `runtime.embeddings` capability host.
- A stable embedding-space identifier exposed through that host.
- Built-in local `Xenova/all-MiniLM-L6-v2` as the only Long-Term Memory vector source.
- Package-side vector-space identity in the derived recall index.
- Package-side vector rebuild, upgrade, query embedding, and semantic retrieval activation.
- Lexical fallback when local embeddings are unavailable, cancelled, or fail.
- Focused Engine and package regression coverage.
- Package rebuild, compatibility update, and catalog validation.

### Excluded

- Remote embedding providers.
- Dedicated connection, default connection, or per-chat embedding resolution for Long-Term Memory.
- The configurable llama.cpp local sidecar.
- Per-chat or per-model LTM indexes.
- Changes to Conversation Memory Recall or lorebook vector identity.
- Token-estimation changes.
- Prompt placement or serialization changes.
- ANN/vector database work.

## Repository Rules

- Follow `AGENTS.md`, `CONTRIBUTING.md`, and `.github/agents/chai-workflow.md` in Marinara Agents.
- Follow the corresponding contribution and validation rules in Marinara Engine.
- Open or link issues before implementation and use draft PRs while work is in progress.
- Preserve unrelated changes in both worktrees.
- Change package source under `packages/long-term-memory/src/`; never hand-edit generated bundles, archives, catalogs, hashes, or sizes.
- Treat capability host changes, package runtime changes, index rebuild logic, and compatibility metadata as security-sensitive.

## Current Engine Base

### Existing capability embedding host

The current Engine already exposes `runtime.embeddings` to capability packages:

- public type: `Marinara-Engine/packages/shared/src/types/capability-runtime.ts:214`
- runtime wiring: `Marinara-Engine/packages/server/src/services/capability-packages/capability-module-runtime.service.ts:44`
- implementation: `Marinara-Engine/packages/server/src/services/capability-packages/capability-embedding.service.ts:8`

The current shape is:

```ts
export interface CapabilityEmbeddingHost {
  label: string;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][] | null>;
}
```

The current implementation is not a fixed local source. It labels itself `Configured memory recall embeddings` and resolves through `resolveMemoryRecallEmbeddingSource(db, {})`.

That means it can drift with Memory Recall configuration, remote providers, or sidecar selection, which is the opposite of the chosen Long-Term Memory policy.

### Existing local embedder

Engine already has the built-in local MiniLM embedder we want:

- implementation: `Marinara-Engine/packages/server/src/services/local-embedder.ts:1`
- model constant: `local-embedder.ts:20`
- lazy model load: `local-embedder.ts:60`
- inference path: `local-embedder.ts:109`
- availability hint: `local-embedder.ts:134`

Important characteristics:

- model: `Xenova/all-MiniLM-L6-v2`
- runtime: `@huggingface/transformers` + `onnxruntime-node`
- dtype: `q8`
- pooling: `mean`
- normalize: `true`
- one text at a time for predictable memory usage

### Existing LTM package

The package already contains the semantic pieces:

- runtime host mirror and embedding adapter: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/package-runtime.ts:87`
- host call: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/embedding-adapter.ts:8`
- vector index build: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/rebuild.ts:52`
- query embedding and cosine lane: `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/retrieval.ts:84`

What is missing is a stable Engine-owned source identity and a production embedding host that matches the chosen single-vault local policy.

## Decisions

1. Long-Term Memory uses one vault-wide embedding space.
2. That space is Engine's built-in local `Xenova/all-MiniLM-L6-v2` embedder.
3. The package must not follow chat connection, generation connection override, `embeddingConnectionId`, remote provider, or sidecar configuration.
4. The existing `runtime.embeddings` capability host remains the one integration point.
5. The public host change is minimal: add `spaceId`; do not add a second host unless forced by compatibility constraints.
6. Semantic recall is optional. Lexical recall remains the base behavior.
7. Token estimation remains unchanged.

## Why This Is The Smallest/Best Plan

This plan follows existing Marinara structure rather than fighting it:

- reuse the already-existing `runtime.embeddings` capability host;
- avoid introducing a new `runtime.localEmbeddings` or package-specific service;
- keep all LTM-specific policy in the package;
- avoid wiring Long-Term Memory through Engine's broader configured embedding resolver;
- avoid per-chat index policy, storage duplication, and remote privacy questions.

It is also the smallest correct path because the package already knows how to:

- build vectors;
- store vectors;
- rank by cosine similarity;
- fall back to lexical retrieval.

The missing part is stable source identity and a host implementation aligned with the chosen fixed local source.

## Behavioral Invariants

The completed change must preserve all of these:

1. Generation continues when embeddings are unavailable or fail.
2. Direct note/tag recall, BM25, keyword matching, graph expansion, scope filtering, ranking fusion, budgeting, and receipt accounting remain intact.
3. Archived memories, excluded resolved threads, mode mismatches, and scope mismatches never enter vector scoring.
4. Stored and query vectors are compared only when they belong to the same explicit `spaceId` and dimension.
5. A failed rebuild never mutates vault notes.
6. Restore, identity repair, source processing, reconciliation, and manual rebuild continue producing a valid lexical index even without vectors.
7. Existing derived indexes without vector identity remain parseable and can upgrade lazily.
8. No Engine connection or chat embedding configuration can silently change the LTM vector space.
9. Token estimation remains `ceil(characters / 4)`.

## Phase 1: Engine Capability Host Adjustment

### 1. Extend the existing public type

Update `Marinara-Engine/packages/shared/src/types/capability-runtime.ts`:

```ts
export interface CapabilityEmbeddingHost {
  spaceId: string;
  label: string;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][] | null>;
}
```

Do not add `isAvailable()` unless needed during implementation. The current Engine base does not have it, and the package can treat `embed() === null` as unavailable.

This keeps the capability host extension minimal and matches current structure.

### 2. Keep the current host name and location

Do not create a second embedding host concept. Keep:

- `runtime.embeddings`
- `createCapabilityEmbeddingHost(...)`

This minimizes surface area and avoids broader capability API redesign.

### 3. Replace the current host implementation

Update `Marinara-Engine/packages/server/src/services/capability-packages/capability-embedding.service.ts` so it no longer calls `resolveMemoryRecallEmbeddingSource(db, {})`.

Instead it should:

1. expose a fixed `spaceId` constant such as:

```ts
const LTM_EMBEDDING_SPACE_ID =
  "local:Xenova/all-MiniLM-L6-v2:q8:mean:normalized:v1";
```

2. expose a fixed label such as:

```ts
const LTM_EMBEDDING_LABEL = "Built-in local MiniLM";
```

3. delegate `embed(texts, signal)` to the built-in local embedder.

This isolates Long-Term Memory from the configurable Memory Recall source policy without introducing a new host family.

### 4. Add cancellation support to the local embedder

Update `localEmbed()` in `Marinara-Engine/packages/server/src/services/local-embedder.ts` to accept an optional `AbortSignal`.

Check the signal:

- before loading the pipeline;
- before each serial text inference;
- after each serial inference before storing the result.

Return `null` on cancellation rather than throwing. Keep actual failures logged as today.

This is still a small change because `localEmbed()` is already serial.

### 5. Decide whether capability API bumps are needed

On this Engine base, the public capability runtime type already includes `embeddings`, but the public shape changes by adding `spaceId`.

That is a capability contract change, so the clean plan is still:

- bump supported capability API from `1.5` to `1.6` in `packages/shared/src/schemas/capability-package.schema.ts:71`
- keep compatibility such that `1.5` packages still load on a `1.6` Engine

This is still the smallest correct compatibility story.

## Phase 2: Package Runtime Contract

### 1. Match the real Engine host

Update the package's runtime host mirror in `packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/package-runtime.ts` so its local `embeddings` host matches the public Engine shape:

```ts
type PackageEmbeddingHost = {
  spaceId: string;
  label: string;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][] | null>;
};
```

Do not add package-only methods.

### 2. Keep tests injectable

Regression tests should still be able to inject a fake host with deterministic vectors and explicit `spaceId`s.

No production alternate-source configuration is needed.

## Phase 3: Add Vector-Space Identity To LTM Indexes

### 1. Extend the derived embedding schema

Update `packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts` so the embedding index includes optional `spaceId`:

```ts
{
  version: 1,
  spaceId?: string,
  model: string,
  dimension: number | null,
  embeddedChunkCount: number,
  chunks: ...,
  byChunkId: ...,
}
```

Keep `spaceId` optional so existing `recall.json` files parse.

### 2. Define vector usability

Vectors are usable only when:

```text
index.embeddings.spaceId === runtime.embeddings.spaceId
index.embeddings.dimension is positive
embeddedChunkCount > 0
vector dimensions match the declared dimension
```

An index with vectors but no `spaceId` is lexical-valid but semantic-stale.

## Phase 4: Rebuild Behavior

### 1. Use the fixed host once per rebuild

At the beginning of `rebuildLongTermMemoryIndexes()`:

- read the package runtime embedding host once;
- use that exact host identity and adapter for the whole rebuild;
- do not derive any per-chat or per-request embedding source.

### 2. Always publish lexical indexes

Metadata, BM25, keyword, and graph indexes must always be built and published, regardless of vector success.

### 3. Only publish a complete vector set

When `embed()` succeeds:

1. require one vector per chunk;
2. require non-empty finite vectors;
3. require one consistent dimension;
4. write `spaceId`, `model`, `dimension`, `embeddedChunkCount`, and vectors.

When `embed()` returns `null` or fails validation:

- publish a lexical-only embedding section;
- omit `spaceId`;
- set `dimension: null`;
- set `embeddedChunkCount: 0`;
- do not keep stale vectors from an older build.

### 4. Keep atomic full rebuilds

Continue using the existing vault lock and `writeJsonAtomic()` full-file write.

Do not add partial vector journals, per-chunk incremental updates, or background worker infrastructure in this implementation.

## Phase 5: Load And Upgrade Behavior

### 1. Keep current lexical freshness checks

Retain the current lexical freshness path in `loadOrRebuildLongTermMemoryIndexes()`, including the existing note reload and `sourceHash` comparison.

Do not combine this embeddings change with index-efficiency refactors.

### 2. Upgrade semantic state lazily

After lexical validation:

- matching `spaceId` and valid vectors: return the index;
- missing `spaceId`: do not query vectors; rebuild only when the fixed local host can actually embed;
- mismatched `spaceId`: do not query vectors; rebuild only when the fixed local host can actually embed;
- malformed index: use the existing quarantine/rebuild path.

### 3. Avoid repeated automatic failures

The Engine local embedder already has process-local failure memory through `loadFailed`.

That is not enough for all semantic-upgrade failures, because inference can still return `null` after the model once loaded.

Add one minimal package-side process-local retry guard keyed by:

```text
vault root + runtime.embeddings.spaceId
```

Behavior:

- one failed automatic vector-upgrade attempt suppresses repeated automatic retries in the same process;
- manual `/rebuild` clears the guard and retries;
- process restart clears the guard naturally.

Do not add generalized exponential backoff or a persisted retry scheduler.

## Phase 6: Semantic Retrieval

### 1. Gate the vector lane strictly

In `retrieveLongTermMemory()`, use the vector lane only when:

```text
semanticWeight > 0
query text is non-empty
index spaceId matches runtime.embeddings.spaceId
index has compatible vectors
query embedding succeeds
query vector matches the declared dimension
request is not cancelled
```

### 2. Use one query vector

Embed the final retrieval query once with the fixed host and reuse it across the in-scope cosine scan.

### 3. Preserve scope filtering and ranking

Keep the existing allowed-chunk filtering before vector scoring, and keep the existing RRF fusion, tiering, deduplication, and budget behavior.

This implementation enables the existing semantic lane rather than redesigning retrieval.

### 4. Define `embeddingsAvailable` honestly

Return `embeddingsAvailable: true` only when:

- stored vectors are compatible with the runtime host;
- query embedding succeeded;
- at least one in-scope vector was eligible for scoring.

Return false otherwise.

## Phase 7: Tests

### Engine

Extend Engine capability lifecycle coverage to prove:

1. API `1.6` packages are accepted;
2. API `1.5` packages still work;
3. `runtime.embeddings` now exposes `spaceId`, `label`, and `embed()`;
4. the host uses built-in local embeddings, not configured Memory Recall resolution;
5. cancellation returns `null` without crashing package activation or generation;
6. remote or sidecar Memory Recall configuration does not change the capability host identity.

Extend local-embedder coverage to prove:

1. empty input returns an empty array;
2. cancellation before or between serial texts returns `null`;
3. output order matches input order;
4. missing ONNX native binding remains a graceful unavailable state;
5. load failure is not retried repeatedly in one process.

### Long-Term Memory package

Extend package runtime and routes regressions to prove:

1. a semantically related but lexically different query can match through the vector lane;
2. query and index use the same fixed `spaceId`;
3. legacy vector indexes without `spaceId` are never queried;
4. legacy or mismatched indexes upgrade into the fixed space;
5. failed automatic upgrade falls back lexically and does not repeat on every generation;
6. manual rebuild retries after an automatic failure;
7. missing local embeddings return lexical results;
8. scope and mode filters still apply before vector scoring;
9. receipt accounting remains unchanged;
10. lifecycle update preserves vault bytes while lazily replacing derived indexes.

## Phase 8: Versioning And Package Boundary

### Engine

Update the capability API support to `1.6` and release the first Engine version containing:

- the `spaceId` addition to `runtime.embeddings`;
- the built-in MiniLM capability embedding host;
- local embedder cancellation support.

### Marinara Agents

Update Long-Term Memory package metadata to match that Engine release:

- bump package version in `scripts/build-feature-packages.mjs`;
- set capability API to `1.6`;
- set `minEngineVersion` to the first Engine release carrying this host contract;
- update `engine-boundary.json` with the exact Engine version and commit.

Do not widen compatibility to older Engines that still provide the unstable configured-memory-recall host.

## Generated Outputs

Run the focused package builder:

```bash
node scripts/build-feature-packages.mjs long-term-memory
```

Expected generated outputs include:

- `packages/long-term-memory/server.mjs`;
- `packages/long-term-memory/manifest.json`;
- the versioned ZIP under `artifacts/`;
- compatible catalog lanes;
- `catalog/catalog.json` when applicable;
- generated hashes and sizes.

Do not hand-edit generated outputs.

## Validation

### Marinara Engine

Run at minimum:

```bash
pnpm build:shared
pnpm --filter @marinara-engine/server lint
pnpm regression:issues
pnpm check
```

### Marinara Agents

Run package regressions from the neighboring Engine checkout:

```bash
for test in storage extraction-graph runtime debug-log; do
  pnpm --filter @marinara-engine/server exec tsx \
    "$PWD/../Marinara-Agents/tests/long-term-memory-${test}.regression.ts"
done

MARINARA_ENGINE_ROOT="$PWD" pnpm --filter @marinara-engine/server exec tsx \
  "$PWD/../Marinara-Agents/tests/long-term-memory-routes.regression.ts"

MARINARA_ENGINE_ROOT="$PWD" pnpm --filter @marinara-engine/server exec tsx \
  "$PWD/../Marinara-Agents/tests/long-term-memory-lifecycle.regression.ts"
```

Then from Marinara Agents:

```bash
node scripts/test-catalog-lanes.mjs
node scripts/validate-catalog.mjs
git diff --check
```

### Manual verification

Test one fully supported desktop environment:

1. start with no cached MiniLM model;
2. trigger an LTM rebuild and verify one-time download/load behavior;
3. confirm status reports embedded recall chunks;
4. verify a semantically related memory can be recalled with low lexical overlap;
5. restart offline and confirm cached-model semantic recall still works;
6. update from the prior package with an existing lexical or legacy vector index;
7. confirm vault notes remain byte-identical while `recall.json` upgrades.

Also test fallback cases:

- Lite build;
- missing or mismatched ONNX native binding;
- cancelled generation during rebuild or query embedding;
- simulated embedding failure.

In every fallback case, verify lexical recall and generation continue.

## Rollout Order

1. Open/link Engine and Agents issues.
2. Update the existing Engine capability embedding host to fixed MiniLM + `spaceId`.
3. Add Engine regression coverage.
4. Release the Engine version carrying API `1.6`.
5. Update the package runtime mirror and vector identity schema.
6. Implement package rebuild, upgrade, and retrieval gating.
7. Add package semantic, fallback, and lifecycle regressions.
8. Rebuild the package and validate the catalog.
9. Publish only after lifecycle proof and manual fallback checks pass.

## Acceptance Criteria

- `runtime.embeddings` still exists, but now exposes a stable `spaceId` and fixed local MiniLM behavior.
- Long-Term Memory never uses chat, remote, connection, or sidecar embedding settings.
- Every stored LTM vector and query vector belongs to the same declared fixed space.
- Legacy and same-dimension incompatible vectors are never compared.
- A successful rebuild stores one complete vector per recall chunk with a consistent dimension.
- Failed or unavailable embedding work leaves a valid lexical index and does not block generation.
- Failed automatic vector upgrades do not rerun on every generation in the same process.
- Semantic recall demonstrably retrieves a relevant memory without lexical overlap in regression coverage.
- Existing vault data survives update, restart, offline restart, uninstall, reinstall, backup, and restore.
- Token estimation remains unchanged.

## Deferred Work

- Persist embedding-space identity for built-in Conversation Memory chunks.
- Persist embedding-space identity and canonical vectorization source for lorebook entries.
- Reconcile manual and automatic lorebook embedding text.
- Add sidecar or remote LTM sources only if a concrete built-in MiniLM limitation requires them.
- Replace JSON vectors or linear scans only after profiling representative vault sizes.
