import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import {
  ltmBm25IndexSchema,
  ltmEmbeddingIndexSchema,
  ltmGraphIndexSchema,
  ltmKeywordIndexSchema,
  ltmMetadataIndexSchema,
  type LtmIndexLoadOutcome,
  type LtmIndexState,
  type LtmNote,
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
import { logger, resolvePackageEmbeddingAdapter, type PackageEmbeddingAdapter } from "../package-runtime.js";
import {
  markLtmIndexesBuilding,
  markLtmIndexesClean,
  markLtmIndexesFailed,
  markLtmIndexesVerified,
  readLtmIndexState,
  writeLtmNoteSummary,
} from "../persistence/index-state.js";
import { getVerifiedLtmRecallIndex, setVerifiedLtmRecallIndex } from "../persistence/vault-snapshot.js";
import { holdsLtmVaultLock, withLtmVaultLock } from "../persistence/vault-lock.js";
import { cancelPendingLtmIndexRebuild, flushLtmIndexRebuild, scheduleLtmIndexRebuild } from "./rebuild-job.js";

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
 * `unpublished` is a background build a write superseded: its fresh vectors are reused too.
 */
async function readReusableVectors(root: string, spaceId: string | undefined, unpublished?: LtmRecallIndex) {
  const vectors = new Map<string, number[]>();
  let dimension = 0;
  if (!spaceId) return { vectors, dimension };
  const indexes = unpublished ? [unpublished] : [];
  try {
    indexes.unshift(parseLtmRecallIndex(JSON.parse(await readFile(longTermMemoryRecallIndexPath(root), "utf8"))));
  } catch {
    // ponytail: no previous index to reuse; this rebuild embeds everything, as before this cache existed.
  }
  for (const { embeddings } of indexes) {
    if (embeddings.spaceId !== spaceId || !embeddings.dimension) continue;
    dimension = embeddings.dimension;
    for (const entry of embeddings.chunks)
      if (entry.textHash && entry.vector) vectors.set(entry.textHash, entry.vector);
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

/** Recall asks for an upgrade while the vectors are unusable; one failed try per write, save or restart is enough. */
function setAutoUpgradeFailure(root: string, adapter: EmbeddingAdapter | null) {
  if (adapter) autoUpgradeFailures.add(autoUpgradeFailureKey(root, adapter.spaceId));
}

function isCancellation(error: unknown, signal?: AbortSignal) {
  return Boolean(signal?.aborted) || (error instanceof Error && error.name === "AbortError");
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

/** Chunk the notes, embed the texts that have no reusable vector, and build every index. Needs no lock. */
async function buildLtmRecallIndex(
  root: string,
  notes: LtmNote[],
  stopWords: readonly string[],
  embeddingAdapter: EmbeddingAdapter | null | undefined,
  options: MemoryRecallEmbeddingOptions & { generatedAt?: string },
  unpublished?: LtmRecallIndex,
) {
  const chunks = chunkNotes(notes, { includeSourceNotes: false, stopWords });
  const texts = chunks.map((chunk) => chunk.text);
  const textHashes = texts.map(textHash);
  const vectors = await embedWithReuse(
    texts,
    textHashes,
    await readReusableVectors(root, embeddingAdapter?.spaceId, unpublished),
    (pending) => embedLongTermMemoryTexts(pending, { ...options, embeddingAdapter }),
  );
  const dimension = vectors?.[0]?.length ?? 0;
  const usableVectors =
    vectors?.length === chunks.length && dimension > 0 && vectors.every((vector) => isFiniteVector(vector, dimension))
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
  return {
    index,
    result: {
      root,
      generatedAt: index.generatedAt,
      noteCount: notes.length,
      chunkCount: chunks.length,
      embeddedChunkCount: usableVectors?.length ?? 0,
      embeddingsAvailable: Boolean(usableVectors),
    },
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
    // Under the lock this rebuild reads every write made so far, which leaves a scheduled one nothing to do.
    cancelPendingLtmIndexRebuild(root);
    await markLtmIndexesBuilding(root);
    try {
      clearAutoUpgradeFailure(root, embeddingAdapter ?? null);
      const notes = await new LongTermMemoryStorage(root).listNotes({ skipInvalid: true });
      await writeLtmNoteSummary(root, notes);
      const { index, result } = await buildLtmRecallIndex(root, notes, stopWords, embeddingAdapter, options);
      options.signal?.throwIfAborted();
      await writeJsonAtomic(longTermMemoryRecallIndexPath(root), index);
      await markLtmIndexesClean(root);
      return result;
    } catch (error) {
      await markLtmIndexesFailed(root, error);
      throw error;
    }
  });
}

/** Writes that superseded this many background builds in a row get one built under the lock instead. */
const MAX_BACKGROUND_REBUILD_ATTEMPTS = 3;

/**
 * The scheduled rebuild (`rebuild-job.ts`). It holds the vault lock only to read the notes and to publish, so
 * recall, saves and debug writes do not wait while it embeds. A write or another build in between moves the
 * index state; the build is then dropped and run again, reusing the vectors it embedded. A rebuild after a
 * write embeds with the host's source; an upgrade embeds with the source the recall that asked for it uses,
 * and is dropped without running again.
 */
async function rebuildLongTermMemoryIndexesInBackground(
  root: string,
  signal: AbortSignal,
  explicitAdapter?: EmbeddingAdapter | null,
) {
  const embeddingAdapter = await resolvePackageEmbeddingAdapter(explicitAdapter);
  const upgrade = explicitAdapter !== undefined;
  let unpublished: LtmRecallIndex | undefined;
  // Set once an attempt marks the index building. Until then a failure has changed nothing.
  let started: LtmIndexState | undefined;
  for (let attempt = 1; attempt <= MAX_BACKGROUND_REBUILD_ATTEMPTS; attempt += 1) {
    try {
      const { stopWords, notes, building } = await withLtmVaultLock(root, async () => {
        const stopWords = ltmGeneratedStopWords(await getLtmGlobalSettings(root));
        signal.throwIfAborted();
        const building = (started = await markLtmIndexesBuilding(root));
        clearAutoUpgradeFailure(root, embeddingAdapter);
        return { stopWords, building, notes: await new LongTermMemoryStorage(root).listNotes({ skipInvalid: true }) };
      });
      const built = await buildLtmRecallIndex(root, notes, stopWords, embeddingAdapter, { signal }, unpublished);
      const published = await withLtmVaultLock(root, async () => {
        signal.throwIfAborted();
        // Every write, build and failure moves the revision; a restored or repaired vault restarts it, so the
        // start time is compared too. New stop words change every chunk.
        const state = await readLtmIndexState(root);
        if (state.revision !== building.revision || state.rebuildStartedAt !== building.rebuildStartedAt) return false;
        const current = ltmGeneratedStopWords(await getLtmGlobalSettings(root));
        if (current.join("\u0000") !== stopWords.join("\u0000")) return false;
        await writeLtmNoteSummary(root, notes);
        await writeJsonAtomic(longTermMemoryRecallIndexPath(root), built.index);
        await markLtmIndexesClean(root);
        return true;
      });
      if (published) {
        if (!built.result.embeddingsAvailable) setAutoUpgradeFailure(root, embeddingAdapter);
        return built.result;
      }
      // An upgrade stops here rather than build again with the source it was given, which a connection change
      // may have replaced since. It leaves the state building and dirty; the write's own rebuild, or the next
      // recall (which rebuilds a stale index or schedules another upgrade), ends that.
      if (upgrade) return;
      unpublished = built.index;
    } catch (error) {
      if (!started) throw error;
      const superseded = await withLtmVaultLock(root, async () => {
        // The state leaves "building" only when a build ends or a restore replaces it. Either one happened since
        // this build started, owns the state now, and may already have published a current index.
        if ((await readLtmIndexState(root)).rebuildState !== "building") return true;
        await markLtmIndexesFailed(root, error);
        return false;
      });
      if (!superseded && !isCancellation(error, signal)) setAutoUpgradeFailure(root, embeddingAdapter);
      throw error;
    }
  }
  // ponytail: the vectors the dropped builds embedded are not passed on, so this build may embed them again.
  // Upgrade: hand `unpublished` to `buildLtmRecallIndex` here if busy vaults show repeated embedding.
  return rebuildLongTermMemoryIndexes({ root, embeddingAdapter, signal });
}

/** Rebuild the indexes in the background after a write; recall and extraction wait for it before reading. */
export function scheduleLongTermMemoryIndexRebuild(root = getLongTermMemoryRoot()) {
  scheduleLtmIndexRebuild(root, rebuildLongTermMemoryIndexesInBackground);
}

/**
 * Wait for a background rebuild that a write scheduled. A caller holding the vault lock cannot wait, because
 * the rebuild needs that lock; the index load it goes on to do rebuilds a stale index inline, as before.
 */
export async function waitForScheduledLtmIndexRebuild(root: string, signal?: AbortSignal) {
  if (!holdsLtmVaultLock(root)) await flushLtmIndexRebuild(root, signal);
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
  await waitForScheduledLtmIndexRebuild(root, signal);
  // Read, freshness-check, quarantine, and rebuild as one serialized vault lifecycle so a
  // queued caller rechecks the index the previous caller just published. The vault lock is
  // reentrant, so the nested rebuild call below does not deadlock.
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
      if (
        embeddingAdapter &&
        !getUsableEmbeddingState(index, embeddingAdapter) &&
        !autoUpgradeFailures.has(autoUpgradeFailureKey(root, embeddingAdapter.spaceId))
      ) {
        // The index matches the notes, but its vectors are missing or from another embedding source. Recall
        // answers with the keyword lanes now while a background job embeds the vault for the current source.
        scheduleLtmIndexRebuild(
          root,
          (root, signal) => rebuildLongTermMemoryIndexesInBackground(root, signal, embeddingAdapter),
          { upgradeOnly: true },
        );
      }
      if (observation) observation.outcome = "loaded";
      return index;
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
 * The Engine calls this from a connection or agent save. Recall moves an index to a new source in
 * the background; a deliberate save is a retry that embeds now, whatever that upgrade or its
 * failure guard is doing. Rejecting when the new source still cannot embed the vault lets the
 * Engine report `failed` instead of a false "refreshed".
 */
export async function refreshLongTermMemoryIndexes(root: string, signal?: AbortSignal) {
  const embeddingAdapter = await resolvePackageEmbeddingAdapter();
  await waitForScheduledLtmIndexRebuild(root, signal);
  const index = await withLtmVaultLock(root, async () => {
    const loaded = await loadOrRebuildLongTermMemoryIndexes(root, embeddingAdapter ?? null, undefined, signal);
    if (!embeddingAdapter || getUsableEmbeddingState(loaded, embeddingAdapter)) return loaded;
    try {
      if ((await rebuildLongTermMemoryIndexes({ root, embeddingAdapter, signal })).embeddingsAvailable)
        return parseLtmRecallIndex(JSON.parse(await readFile(longTermMemoryRecallIndexPath(root), "utf8")));
    } catch (error) {
      if (isCancellation(error, signal)) throw error;
      logger.warn(error, "[ltm] Index rebuild for the new embedding source failed");
    }
    setAutoUpgradeFailure(root, embeddingAdapter);
    return loaded;
  });
  if (embeddingAdapter && index.embeddings.chunks.length > 0 && !getUsableEmbeddingState(index, embeddingAdapter)) {
    throw new Error("Long-term memory could not embed the vault with the new embedding source");
  }
}
