import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import {
  ltmBm25IndexSchema,
  ltmEmbeddingIndexSchema,
  ltmGraphIndexSchema,
  ltmKeywordIndexSchema,
  ltmMetadataIndexSchema,
  type LtmIndexLoadOutcome,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { writeJsonAtomic } from "../persistence/atomic-json.js";
import { buildLtmBm25Index } from "./bm25.js";
import { chunkNotes, stableJsonHash } from "./chunking.js";
import { embedLongTermMemoryTexts, type MemoryRecallEmbeddingOptions } from "./embedding-adapter.js";
import { buildLtmGraphIndex } from "./graph.js";
import { quarantineLtmIndexArtifact } from "../persistence/index-quarantine.js";
import { buildLtmKeywordIndex } from "./keyword-index.js";
import { buildLtmMetadataIndex } from "./metadata-index.js";
import { getLongTermMemoryDirectories, getLongTermMemoryRoot, safeJoin } from "../persistence/paths.js";
import { getLtmGlobalSettings, ltmGeneratedStopWords } from "../settings.js";
import { LongTermMemoryStorage } from "../persistence/storage.js";
import { resolvePackageEmbeddingAdapter, type PackageEmbeddingAdapter } from "../package-runtime.js";
import {
  markLtmIndexesBuilding,
  markLtmIndexesClean,
  markLtmIndexesFailed,
  markLtmIndexesVerified,
  readLtmIndexState,
  writeLtmNoteSummary,
} from "../persistence/index-state.js";
import { getVerifiedLtmRecallIndex, setVerifiedLtmRecallIndex } from "../persistence/vault-snapshot.js";
import { withLtmVaultLock } from "../persistence/vault-lock.js";

const autoUpgradeFailures = new Set<string>();

type EmbeddingAdapter = PackageEmbeddingAdapter;

function autoUpgradeFailureKey(root: string, spaceId: string) {
  return `${root}\u0000${spaceId}`;
}

function isFiniteVector(vector: number[] | undefined, dimension: number) {
  return Array.isArray(vector) && vector.length === dimension && vector.every(Number.isFinite);
}

const textHash = (text: string) => createHash("sha256").update(text).digest("hex");

/**
 * Vectors from the previous index keyed by embedded-text hash. Empty unless that index parses and was
 * built in the same embedding space, so a missing, malformed or other-space index embeds everything.
 */
async function readReusableVectors(root: string, spaceId: string | undefined) {
  const vectors = new Map<string, number[]>();
  let dimension = 0;
  if (!spaceId) return { vectors, dimension };
  try {
    const { embeddings } = parseLtmRecallIndex(JSON.parse(await readFile(longTermMemoryRecallIndexPath(root), "utf8")));
    if (embeddings.spaceId !== spaceId || !embeddings.dimension) return { vectors, dimension };
    dimension = embeddings.dimension;
    for (const entry of embeddings.chunks)
      if (entry.textHash && entry.vector) vectors.set(entry.textHash, entry.vector);
  } catch {
    // ponytail: no previous index to reuse; this rebuild embeds everything, as before this cache existed.
  }
  return { vectors, dimension };
}

/** Embed only the texts whose hash has no reusable vector; returns one vector per text, or null. */
async function embedWithReuse(
  texts: string[],
  hashes: string[],
  reusable: { vectors: Map<string, number[]>; dimension: number },
  embed: (texts: string[]) => Promise<number[][] | null>,
) {
  const pending = new Map<string, string>();
  hashes.forEach((hash, index) => {
    if (!reusable.vectors.has(hash)) pending.set(hash, texts[index]!);
  });
  const fresh = pending.size > 0 ? await embed([...pending.values()]) : [];
  if (!fresh) return null;
  // A source that now answers with another dimension cannot be mixed with the old vectors.
  if (reusable.vectors.size > 0 && fresh.length > 0 && fresh[0]!.length !== reusable.dimension) return embed(texts);
  const byHash = new Map(reusable.vectors);
  [...pending.keys()].forEach((hash, index) => byHash.set(hash, fresh[index]!));
  return hashes.map((hash) => byHash.get(hash)!);
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
  return withLtmVaultLock(root, async () => {
    // Resolve the effective stop words inside the lock so a rebuild always fingerprints
    // the settings the vault lock currently protects, even when queued behind a save.
    const stopWords = options.stopWords ?? ltmGeneratedStopWords(await getLtmGlobalSettings(root));
    options.signal?.throwIfAborted();
    await markLtmIndexesBuilding(root);
    try {
      clearAutoUpgradeFailure(root, embeddingAdapter ?? null);
      const notes = await new LongTermMemoryStorage(root).listNotes({ skipInvalid: true });
      await writeLtmNoteSummary(root, notes);
      const chunks = chunkNotes(notes, { includeSourceNotes: false, stopWords });
      const texts = chunks.map((chunk) => chunk.text);
      const textHashes = texts.map(textHash);
      const vectors = await embedWithReuse(
        texts,
        textHashes,
        await readReusableVectors(root, embeddingAdapter?.spaceId),
        (pending) => embedLongTermMemoryTexts(pending, { ...options, embeddingAdapter }),
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
          ...(usableVectors?.[index] ? { textHash: textHashes[index], vector: usableVectors[index] } : {}),
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

/** Device, inode, size and times of `recall.json`; empty when it cannot be read. */
async function recallIndexFileKey(path: string) {
  try {
    const file = await stat(path, { bigint: true });
    return `${file.dev}:${file.ino}:${file.size}:${file.mtimeNs}:${file.ctimeNs}`;
  } catch {
    return "";
  }
}

export async function loadOrRebuildLongTermMemoryIndexes(
  root = getLongTermMemoryRoot(),
  resolvedEmbeddingAdapter?: EmbeddingAdapter | null,
  stopWords?: readonly string[],
  signal?: AbortSignal,
  /** Optional out-parameter; the caller reads how this call obtained its index. */
  observation?: { outcome?: LtmIndexLoadOutcome },
) {
  const embeddingAdapter =
    resolvedEmbeddingAdapter !== undefined ? resolvedEmbeddingAdapter : await resolvePackageEmbeddingAdapter();
  const path = longTermMemoryRecallIndexPath(root);
  // Read, freshness-check, quarantine, and rebuild as one serialized vault lifecycle so a
  // queued caller rechecks the index the previous caller just published. The vault lock is
  // reentrant, so the nested upgrade/rebuild calls below do not deadlock.
  return withLtmVaultLock(root, async () => {
    // Resolve the effective stop words inside the lock: a recall queued behind a settings
    // save must judge freshness against the settings that save just persisted.
    const resolvedStopWords = stopWords ?? ltmGeneratedStopWords(await getLtmGlobalSettings(root));
    signal?.throwIfAborted();
    let stale = false;
    try {
      // Read what a cached index must still match before touching the vault, so a change that lands
      // during the check can only make the next call miss, never hide the change.
      const state = await readLtmIndexState(root).catch(() => null);
      const fileKey = await recallIndexFileKey(path);
      const stopWordsKey = resolvedStopWords.join("\u0000");
      const verified = getVerifiedLtmRecallIndex(root);
      let index: LtmRecallIndex;
      if (
        verified &&
        state &&
        !state.dirty &&
        fileKey &&
        verified.revision === state.revision &&
        verified.fileKey === fileKey &&
        verified.stopWordsKey === stopWordsKey
      ) {
        // Every package mutation bumps the revision under the vault lock, so none happened since the
        // vault was last hashed. A process's first recall has no entry and always takes the full check.
        // ponytail: notes edited outside the package while this process runs, or by a second process
        // (the vault lock is per-process), are not seen until a restart or this process's next mutation,
        // and a hit skips listNotes, so recall alone no longer starts the daily retention run. Upgrade:
        // bump the revision again after commitLtmMutation applies its files, and stat the note
        // directories here.
        index = verified.index;
      } else {
        index = parseLtmRecallIndex(JSON.parse(await readFile(path, "utf8")));
        const notes = await new LongTermMemoryStorage(root).listNotes({ skipInvalid: true });
        if (
          index.sourceHash !==
          stableJsonHash(chunkNotes(notes, { includeSourceNotes: false, stopWords: resolvedStopWords }))
        ) {
          stale = true;
          throw new Error("Stale long-term memory recall index.");
        }
        // The index matches the vault. A mutation of unindexed notes (sources, drafts) leaves the state
        // dirty with a fresh index, so clear that to let the next call reuse it; cache only a state
        // that is clean at the revision read above.
        if (state && fileKey) {
          const clean = state.dirty ? await markLtmIndexesVerified(root, state.revision).catch(() => null) : state;
          if (clean && !clean.dirty && clean.revision === state.revision + (state.dirty ? 1 : 0)) {
            setVerifiedLtmRecallIndex(root, { index, revision: clean.revision, fileKey, stopWordsKey });
          }
        }
      }
      const usableEmbeddings = getUsableEmbeddingState(index, embeddingAdapter);
      if (usableEmbeddings) {
        if (observation) observation.outcome = "loaded";
        return index;
      }
      const upgraded = await tryUpgradeSemanticIndex(root, index, embeddingAdapter, resolvedStopWords, signal);
      // `tryUpgradeSemanticIndex` returns the same object when it did not rebuild.
      if (observation) observation.outcome = upgraded === index ? "loaded" : "upgraded";
      return upgraded;
    } catch (error) {
      // Cancellation is not corruption: never quarantine a valid index or rebuild on abort.
      if (isCancellation(error, signal)) throw error;
      // A stale index parsed fine and the rebuild's atomic write replaces it, so only an
      // unreadable or malformed one is quarantined; otherwise every edit would park a full copy.
      if (!stale) await quarantineLtmIndexArtifact(root, path).catch(() => {});
      await rebuildLongTermMemoryIndexes({ root, embeddingAdapter, stopWords: resolvedStopWords, signal });
      // ponytail: an index built here is not cached; the next call verifies it once before caching it,
      // which narrows, but does not close, the window for a write from another process.
      if (observation) observation.outcome = "rebuilt";
      return parseLtmRecallIndex(JSON.parse(await readFile(path, "utf8")));
    }
  });
}

/**
 * Bring the recall index up to date for the embedding source the host currently resolves.
 * The Engine calls this from a connection or agent save. A deliberate save is a retry, so it
 * clears the process-local auto-upgrade guard under the vault lock. Rejecting when the new source
 * still cannot embed the vault lets the Engine report `failed` instead of a false "refreshed".
 */
export async function refreshLongTermMemoryIndexes(root: string, signal?: AbortSignal) {
  const embeddingAdapter = await resolvePackageEmbeddingAdapter();
  // Clear the guard while holding the vault lock: an upgrade that failed just before this call
  // restores the guard on its way out, and clearing first would let it win and skip the retry.
  const index = await withLtmVaultLock(root, async () => {
    clearAutoUpgradeFailure(root, embeddingAdapter ?? null);
    return loadOrRebuildLongTermMemoryIndexes(root, embeddingAdapter ?? null, undefined, signal);
  });
  if (embeddingAdapter && index.embeddings.chunks.length > 0 && !getUsableEmbeddingState(index, embeddingAdapter)) {
    throw new Error("Long-term memory could not embed the vault with the new embedding source");
  }
}
