import { readFile } from "node:fs/promises";
import {
  ltmBm25IndexSchema,
  ltmEmbeddingIndexSchema,
  ltmGraphIndexSchema,
  ltmKeywordIndexSchema,
  ltmMetadataIndexSchema,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { writeJsonAtomic } from "./atomic-json.js";
import { buildLtmBm25Index } from "./bm25.js";
import { chunkNotes, stableJsonHash } from "./chunking.js";
import { embedLongTermMemoryTexts, type MemoryRecallEmbeddingOptions } from "./embedding-adapter.js";
import { buildLtmGraphIndex } from "./graph.js";
import { quarantineLtmIndexArtifact } from "./index-quarantine.js";
import { buildLtmKeywordIndex } from "./keyword-index.js";
import { buildLtmMetadataIndex } from "./metadata-index.js";
import { getLongTermMemoryDirectories, getLongTermMemoryRoot, safeJoin } from "./paths.js";
import { getLtmGlobalSettings, ltmGeneratedStopWords } from "./settings.js";
import { LongTermMemoryStorage } from "./storage.js";
import { resolvePackageEmbeddingAdapter, type PackageEmbeddingAdapter } from "./package-runtime.js";
import {
  markLtmIndexesBuilding,
  markLtmIndexesClean,
  markLtmIndexesFailed,
  writeLtmNoteSummary,
} from "./index-state.js";
import { withLtmVaultLock } from "./vault-lock.js";

const autoUpgradeFailures = new Set<string>();

type EmbeddingAdapter = PackageEmbeddingAdapter;

function autoUpgradeFailureKey(root: string, spaceId: string) {
  return `${root}\u0000${spaceId}`;
}

function isFiniteVector(vector: number[] | undefined, dimension: number) {
  return Array.isArray(vector) && vector.length === dimension && vector.every(Number.isFinite);
}

function getUsableEmbeddingState(index: LtmRecallIndex, adapter: EmbeddingAdapter | null) {
  const dimension = index.embeddings.dimension;
  if (!adapter || !index.embeddings.spaceId || index.embeddings.spaceId !== adapter.spaceId) return null;
  if (!dimension || index.embeddings.embeddedChunkCount <= 0) return null;
  const eligibleVectors = index.embeddings.chunks.filter((entry) => isFiniteVector(entry.vector, dimension));
  if (eligibleVectors.length !== index.embeddings.embeddedChunkCount) return null;
  return { adapter, dimension };
}

function clearAutoUpgradeFailure(root: string, adapter: EmbeddingAdapter | null) {
  if (adapter) autoUpgradeFailures.delete(autoUpgradeFailureKey(root, adapter.spaceId));
}

function isCancellation(error: unknown, signal?: AbortSignal) {
  return Boolean(signal?.aborted) || (error instanceof Error && error.name === "AbortError");
}

async function tryUpgradeSemanticIndex(
  root: string,
  index: LtmRecallIndex,
  adapter: EmbeddingAdapter | null,
  stopWords: readonly string[],
  signal?: AbortSignal,
) {
  if (!adapter) return index;
  const failureKey = autoUpgradeFailureKey(root, adapter.spaceId);
  if (autoUpgradeFailures.has(failureKey)) return index;
  try {
    const rebuilt = await rebuildLongTermMemoryIndexes({ root, embeddingAdapter: adapter, stopWords, signal });
    if (rebuilt.embeddingsAvailable) {
      autoUpgradeFailures.delete(failureKey);
      return parseLtmRecallIndex(JSON.parse(await readFile(longTermMemoryRecallIndexPath(root), "utf8")));
    }
  } catch (error) {
    // A cancelled upgrade must not disable the retry guard for later callers.
    if (isCancellation(error, signal)) throw error;
    // ponytail: keep lexical recall; one process-local guard stops rebuild spam until manual rebuild or restart.
  }
  autoUpgradeFailures.add(failureKey);
  return index;
}

export type LtmRecallIndex = {
  version: 1;
  generatedAt: string;
  sourceHash: string;
  metadata: ReturnType<typeof buildLtmMetadataIndex>;
  bm25: ReturnType<typeof buildLtmBm25Index>;
  graph: ReturnType<typeof buildLtmGraphIndex>;
  keywords: ReturnType<typeof buildLtmKeywordIndex>;
  embeddings: ReturnType<typeof ltmEmbeddingIndexSchema.parse>;
};

export function longTermMemoryRecallIndexPath(root = getLongTermMemoryRoot()) {
  return safeJoin(getLongTermMemoryDirectories(root).indexes, "recall.json");
}

export function parseLtmRecallIndex(value: unknown): LtmRecallIndex {
  if (!value || typeof value !== "object" || (value as { version?: unknown }).version !== 1) {
    throw new Error("Malformed long-term memory recall index.");
  }
  const index = value as Record<string, unknown>;
  if (typeof index.generatedAt !== "string" || !Number.isFinite(Date.parse(index.generatedAt))) {
    throw new Error("Malformed long-term memory recall index timestamp.");
  }
  return {
    version: 1,
    generatedAt: index.generatedAt,
    sourceHash: typeof index.sourceHash === "string" ? index.sourceHash : "",
    metadata: ltmMetadataIndexSchema.parse(index.metadata),
    bm25: ltmBm25IndexSchema.parse(index.bm25),
    graph: ltmGraphIndexSchema.parse(index.graph),
    keywords: ltmKeywordIndexSchema.parse(index.keywords),
    embeddings: ltmEmbeddingIndexSchema.parse(index.embeddings),
  };
}

export async function rebuildLongTermMemoryIndexes(
  options: MemoryRecallEmbeddingOptions & { root?: string; generatedAt?: string; stopWords?: readonly string[] } = {},
) {
  const root = options.root ?? getLongTermMemoryRoot();
  const embeddingAdapter = await resolvePackageEmbeddingAdapter(options.embeddingAdapter);
  const stopWords = options.stopWords ?? ltmGeneratedStopWords(await getLtmGlobalSettings(root));
  return withLtmVaultLock(root, async () => {
    options.signal?.throwIfAborted();
    await markLtmIndexesBuilding(root);
    try {
      clearAutoUpgradeFailure(root, embeddingAdapter ?? null);
      const notes = await new LongTermMemoryStorage(root).listNotes();
      await writeLtmNoteSummary(root, notes);
      const chunks = chunkNotes(notes, { includeSourceNotes: false, stopWords });
      const vectors = await embedLongTermMemoryTexts(
        chunks.map((chunk) => chunk.text),
        {
          ...options,
          embeddingAdapter,
        },
      );
      const dimension = vectors?.[0]?.length ?? 0;
      const usableVectors =
        vectors?.length === chunks.length &&
        dimension > 0 &&
        vectors.every((vector) => isFiniteVector(vector, dimension))
          ? vectors
          : null;
      const embeddings = ltmEmbeddingIndexSchema.parse({
        version: 1,
        ...(usableVectors ? { spaceId: embeddingAdapter?.spaceId } : {}),
        model: embeddingAdapter?.label ?? "unavailable",
        dimension: usableVectors?.[0]?.length ?? null,
        embeddedChunkCount: usableVectors?.length ?? 0,
        chunks: chunks.map((chunk, index) => ({
          chunkId: chunk.id,
          sourceHash: chunk.sourceHash,
          ...(usableVectors?.[index] ? { vector: usableVectors[index] } : {}),
        })),
        byChunkId: Object.fromEntries(chunks.map((chunk, index) => [chunk.id, index])),
      });
      const index: LtmRecallIndex = {
        version: 1,
        generatedAt: options.generatedAt ?? new Date().toISOString(),
        sourceHash: stableJsonHash(chunks),
        metadata: buildLtmMetadataIndex(chunks),
        bm25: buildLtmBm25Index(chunks),
        graph: buildLtmGraphIndex(notes, chunks),
        keywords: buildLtmKeywordIndex(chunks),
        embeddings,
      };
      options.signal?.throwIfAborted();
      await writeJsonAtomic(longTermMemoryRecallIndexPath(root), index);
      await markLtmIndexesClean(root);
      return {
        root,
        generatedAt: index.generatedAt,
        noteCount: notes.length,
        chunkCount: chunks.length,
        embeddedChunkCount: usableVectors?.length ?? 0,
        embeddingsAvailable: Boolean(usableVectors),
      };
    } catch (error) {
      await markLtmIndexesFailed(root, error);
      throw error;
    }
  });
}

export async function loadOrRebuildLongTermMemoryIndexes(
  root = getLongTermMemoryRoot(),
  resolvedEmbeddingAdapter?: EmbeddingAdapter | null,
  stopWords?: readonly string[],
  signal?: AbortSignal,
) {
  const embeddingAdapter =
    resolvedEmbeddingAdapter !== undefined ? resolvedEmbeddingAdapter : await resolvePackageEmbeddingAdapter();
  const resolvedStopWords = stopWords ?? ltmGeneratedStopWords(await getLtmGlobalSettings(root));
  const path = longTermMemoryRecallIndexPath(root);
  // Read, freshness-check, quarantine, and rebuild as one serialized vault lifecycle so a
  // queued caller rechecks the index the previous caller just published. The vault lock is
  // reentrant, so the nested upgrade/rebuild calls below do not deadlock.
  return withLtmVaultLock(root, async () => {
    signal?.throwIfAborted();
    try {
      const index = parseLtmRecallIndex(JSON.parse(await readFile(path, "utf8")));
      const notes = await new LongTermMemoryStorage(root).listNotes();
      if (
        index.sourceHash !==
        stableJsonHash(chunkNotes(notes, { includeSourceNotes: false, stopWords: resolvedStopWords }))
      ) {
        throw new Error("Stale long-term memory recall index.");
      }
      const usableEmbeddings = getUsableEmbeddingState(index, embeddingAdapter);
      if (usableEmbeddings) return index;
      return await tryUpgradeSemanticIndex(root, index, embeddingAdapter, resolvedStopWords, signal);
    } catch (error) {
      // Cancellation is not corruption: never quarantine a valid index or rebuild on abort.
      if (isCancellation(error, signal)) throw error;
      await quarantineLtmIndexArtifact(root, path).catch(() => {});
      await rebuildLongTermMemoryIndexes({ root, embeddingAdapter, stopWords: resolvedStopWords, signal });
      return parseLtmRecallIndex(JSON.parse(await readFile(path, "utf8")));
    }
  });
}
