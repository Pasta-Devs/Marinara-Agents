import { readFile } from "node:fs/promises";
import { ltmBm25IndexSchema, ltmEmbeddingIndexSchema, ltmGraphIndexSchema, ltmKeywordIndexSchema, ltmMetadataIndexSchema } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { writeJsonAtomic } from "./atomic-json.js";
import { buildLtmBm25Index } from "./bm25.js";
import { chunkNotes, stableJsonHash } from "./chunking.js";
import { embedLongTermMemoryTexts, type MemoryRecallEmbeddingOptions } from "./embedding-adapter.js";
import { buildLtmGraphIndex } from "./graph.js";
import { quarantineLtmIndexArtifact } from "./index-quarantine.js";
import { buildLtmKeywordIndex } from "./keyword-index.js";
import { buildLtmMetadataIndex } from "./metadata-index.js";
import { getLongTermMemoryDirectories, getLongTermMemoryRoot, safeJoin } from "./paths.js";
import { LongTermMemoryStorage } from "./storage.js";
import { getPackageEmbeddingAdapter } from "./package-runtime.js";
import { markLtmIndexesClean } from "./index-state.js";
import { withLtmVaultLock } from "./vault-lock.js";

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
  options: MemoryRecallEmbeddingOptions & { root?: string; generatedAt?: string } = {},
) {
  const root = options.root ?? getLongTermMemoryRoot();
  return withLtmVaultLock(root,async()=>{
    const notes = await new LongTermMemoryStorage(root).listNotes();
    const chunks = chunkNotes(notes, { includeSourceNotes: false });
    const vectors = await embedLongTermMemoryTexts(chunks.map((chunk) => chunk.text), options);
    const usableVectors =
      vectors?.length === chunks.length && vectors.every((vector) => vector.length > 0) ? vectors : null;
    const embeddings = ltmEmbeddingIndexSchema.parse({
      version: 1,
      model: options.embeddingAdapter?.label ?? getPackageEmbeddingAdapter()?.label ?? "unavailable",
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
    await writeJsonAtomic(longTermMemoryRecallIndexPath(root), index);
    await markLtmIndexesClean(root);
    return { root,generatedAt:index.generatedAt,noteCount: notes.length, chunkCount: chunks.length,embeddedChunkCount:usableVectors?.length??0, embeddingsAvailable: Boolean(usableVectors) };
  });
}

export async function loadOrRebuildLongTermMemoryIndexes(root = getLongTermMemoryRoot()) {
  const path = longTermMemoryRecallIndexPath(root);
  try {
    const index = parseLtmRecallIndex(JSON.parse(await readFile(path, "utf8")));
    const notes = await new LongTermMemoryStorage(root).listNotes();
    if (index.sourceHash !== stableJsonHash(chunkNotes(notes, { includeSourceNotes: false }))) {
      throw new Error("Stale long-term memory recall index.");
    }
    return index;
  } catch (error) {
    await quarantineLtmIndexArtifact(root, path).catch(() => {});
    await rebuildLongTermMemoryIndexes({ root });
    return parseLtmRecallIndex(JSON.parse(await readFile(path, "utf8")));
  }
}
