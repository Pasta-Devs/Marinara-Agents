// ──────────────────────────────────────────────
// Otome Hearth: long-term recall (0.19.0), each earlier chapter's original summary found again by meaning
// ──────────────────────────────────────────────
// The timeline (S/memory/timeline.ts) condenses everything before the newest main chapter's entry into one head, again
// and again, so on a long story its opening is condensed three or four times over. Each chapter's original summary is
// still saved (the kit's detail record, savedStory's `summaries`). This indexes those summaries by meaning, so a
// chapter's plan can choose the few earlier chapters that matter to it and its prompts carry them whole, beside the
// condensed head (S/story/canon.ts recallText, "# Earlier, in detail"). The timeline itself is unchanged.
// - The index, `${R}:recall` (kind "recall", one per story), holds every timeline chapter's summary (a storyline chapter,
//   his side, a Character Story; never a date, which is never in the timeline) as vectors: the summary cut into pieces
//   of about RECALL_CHUNK_WORDS words (the built-in MiniLM reads about 256 tokens), each a base64 Float32Array, with a
//   fingerprint of the summary's text, so a rewritten summary is indexed again. The pieces only choose: a prompt
//   recalls a chapter's whole summary, and a chapter scores its best piece's similarity. The index is no memory source
//   and no prompt reads it.
// - Its model is the story's Memory recall embeddings (Settings → Connections, `connections.embeddings`): the Engine's
//   built-in local MiniLM by default (runtime.embeddingsFor(null)), or the embedding source of one of the player's
//   Engine connections (capability API 1.818). An older Engine has only runtime.embeddings, so only the built-in. The
//   index keeps its model's spaceId and connection: another model or connection rebuilds it.
// - Indexing is background work with no model call, one job per story at a time (the background queue's key; asked again
//   while it waits or runs, it goes round once more): after memory upkeep (S/memory/memory.ts afterUpkeep), whenever a
//   story is opened (GET /runs/:run) and when its model changes, for every summary with no current entry. An embed call
//   holds at most EMBED_TEXTS_MAX texts and EMBED_CHARACTERS_MAX characters (the Engine's caps), and what it embedded is
//   saved before the next. It runs in the embedding connection's admission slot, or LOCAL_LANE's for the built-in.
// - Status: indexing while a job waits or runs; failed, with its error (no embedding model, or an embed call that threw
//   or gave no vectors), which waits for Retry (foreground admission, as the memory's own Retry) or the next memory
//   upkeep, never for a story being opened; otherwise ready, with how many of the summaries are indexed.
// - Choosing (`choose`, a chapter's plan): the query's pieces are embedded and averaged, each candidate scores its best
//   piece, and the best RECALL_MAX at RECALL_MIN_SIMILARITY or more are chosen. No index, an index of another model, or
//   no vectors chooses none, and the prompt is as it would be without this. Debug mode logs each candidate's score.
// A deleted story keeps no index: it is a run document (RUN_DOC_KINDS), and a job's write for a story gone is refused or
// removed again.
import { createHash } from "node:crypto";
import type { CapabilityEmbeddingHost, CapabilityRuntimeHost } from "@marinara-engine/shared";
import type { RecallIndexStatus } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import type { BackgroundQueue } from "../background-queue.js";
import { isItemStoryKey, memoryId, recallId, runDocTarget, worldId } from "../ids.js";
import { isRecord } from "../schemas/common.js";
import { normalizeWorld } from "../schemas/world.js";
import type { OtomeStore } from "../store.js";
import { savedStory } from "./timeline.js";

/** The words in a piece the index embeds: the built-in MiniLM reads about 256 tokens, some 190 words. */
export const RECALL_CHUNK_WORDS = 180;
/** The most earlier chapters one chapter recalls in detail (the maintainer's). */
export const RECALL_MAX = 3;
/**
 * The least similarity (cosine, best piece) a chapter needs to be recalled. Measured on the built-in MiniLM over a
 * harbour story's summaries: a chapter about what the query is about scored 0.50–0.69, the same story's other chapters
 * 0.25–0.45 (they share its names and places), and a query about nothing in it at most 0.38.
 */
export const RECALL_MIN_SIMILARITY = 0.45;
/** The Engine's caps on one embed call (capability-embedding.service.ts). */
export const EMBED_TEXTS_MAX = 128;
export const EMBED_CHARACTERS_MAX = 200_000;
/** The longest piece embedded, in characters: far above RECALL_CHUNK_WORDS words, for text with no words to cut at. */
const CHUNK_CHARACTERS_MAX = 6000;
/** The background lane, and admission slot, of indexing with the built-in model, which uses no connection. */
export const LOCAL_LANE = "otome-forge:local-embeddings";
/** The longest failure kept for the status. */
const FAILURE_CHARACTERS = 500;

const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });

/** Where each word of `text` starts: Intl.Segmenter, so a language written without spaces has its words counted too. */
const wordStarts = (text: string) =>
  [...segmenter.segment(text)].flatMap((segment) => (segment.isWordLike ? [segment.index] : []));

/** `text` in pieces of at most RECALL_CHUNK_WORDS words, as even as they come; [] for blank text. */
export function recallChunks(text: string): string[] {
  const starts = wordStarts(text);
  const count = Math.max(1, Math.ceil(starts.length / RECALL_CHUNK_WORDS));
  const per = Math.ceil(starts.length / count);
  const chunks: string[] = [];
  for (let k = 0; k < count; k += 1) {
    const from = k ? (starts[k * per] ?? text.length) : 0;
    const to = k + 1 < count ? (starts[(k + 1) * per] ?? text.length) : text.length;
    const chunk = text.slice(from, to).trim().slice(0, CHUNK_CHARACTERS_MAX);
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

/** The last `count` words of `text` (how a chapter ended, for the query). */
export function lastWords(text: string, count: number): string {
  const starts = wordStarts(text);
  return (starts.length > count ? text.slice(starts[starts.length - count]) : text).trim();
}

/** A summary's fingerprint: an entry whose summary changed is indexed again. */
export const fingerprintOf = (text: string) => createHash("sha256").update(text).digest("base64url").slice(0, 22);

/** The vector at length 1, so a dot product is its cosine; null for one that is empty, zero or not finite. */
function unitVector(vector: unknown): Float32Array | null {
  if (!Array.isArray(vector) || !vector.length) return null;
  let squares = 0;
  for (const value of vector) squares += typeof value === "number" ? value * value : Number.NaN;
  const norm = Math.sqrt(squares);
  return Number.isFinite(norm) && norm > 0 ? Float32Array.from(vector as number[], (value) => value / norm) : null;
}

export const packVector = (vector: Float32Array) =>
  Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength).toString("base64");

export function unpackVector(text: string): Float32Array {
  const bytes = Buffer.from(text, "base64");
  // Copied out, so the floats are aligned whatever the buffer pool's offset.
  return new Float32Array(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength - (bytes.byteLength % 4)),
  );
}

const dot = (a: Float32Array, b: Float32Array) => {
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) sum += a[index]! * b[index]!;
  return sum;
};

/** A chapter's similarity to the query: its best piece's (see the header); -1 when no piece is of the query's model. */
export function chapterScore(query: Float32Array, pieces: readonly Float32Array[]): number {
  return Math.max(-1, ...pieces.filter((piece) => piece.length === query.length).map((piece) => dot(query, piece)));
}

/** `pieces` cut into embed calls of at most EMBED_TEXTS_MAX texts and EMBED_CHARACTERS_MAX characters, in order. */
export function embedBatches<T extends { text: string }>(pieces: readonly T[]): T[][] {
  const batches: T[][] = [];
  let batch: T[] = [];
  let characters = 0;
  for (const piece of pieces) {
    if (batch.length && (batch.length >= EMBED_TEXTS_MAX || characters + piece.text.length > EMBED_CHARACTERS_MAX)) {
      batches.push(batch);
      batch = [];
      characters = 0;
    }
    batch.push(piece);
    characters += piece.text.length;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

interface RecallEntry {
  fingerprint: string;
  /** Each piece's unit vector, a base64 Float32Array. */
  vectors: string[];
}

/** `${R}:recall` */
export interface RecallIndexDoc {
  version: 1;
  /** The model's vector space (the host's spaceId); null before one was resolved. */
  spaceId: string | null;
  /** The embedding connection, or null for the built-in model. */
  connectionId: string | null;
  /** By the kit's source key, JSON [kind, id]. */
  chapters: Record<string, RecallEntry>;
  /** Why the last job failed, which waits for Retry; gone once a job succeeds. */
  failure?: string;
}

/** The index as stored; a damaged entry is dropped. */
export function normalizeRecallIndex(data: unknown): RecallIndexDoc {
  const raw = isRecord(data) ? data : {};
  const chapters: Record<string, RecallEntry> = {};
  for (const [key, entry] of Object.entries(isRecord(raw.chapters) ? raw.chapters : {})) {
    if (!isRecord(entry) || typeof entry.fingerprint !== "string" || !Array.isArray(entry.vectors)) continue;
    const vectors = entry.vectors.filter((vector): vector is string => typeof vector === "string");
    if (vectors.length && vectors.length === entry.vectors.length)
      chapters[key] = { fingerprint: entry.fingerprint, vectors };
  }
  return {
    version: 1,
    spaceId: typeof raw.spaceId === "string" ? raw.spaceId : null,
    connectionId: typeof raw.connectionId === "string" ? raw.connectionId : null,
    chapters,
    ...(typeof raw.failure === "string" && raw.failure ? { failure: raw.failure } : {}),
  };
}

/** Whether a source key (JSON [kind, id]) is a timeline chapter's: a storyline chapter or his side, or a Character Story. */
function inTimeline(key: string): boolean {
  try {
    const [kind, id] = JSON.parse(key) as unknown[];
    return kind === "chapter" || (kind === "character-story" && typeof id === "string" && isItemStoryKey(id));
  } catch {
    return false;
  }
}

/** The summaries the index holds (see the header), by source key, from the saved memory document's data. */
export const indexedSummaries = (memory: unknown) =>
  new Map([...savedStory(memory).summaries].filter(([key]) => inTimeline(key)));

type EmbeddingsFor = (connectionId: string | null) => Promise<CapabilityEmbeddingHost | null>;

/** Capability API 1.818's embeddingsFor, on an Engine that has it. */
export function embeddingsForOf(runtime: object): EmbeddingsFor | undefined {
  const embeddingsFor = "embeddingsFor" in runtime ? (runtime as { embeddingsFor?: unknown }).embeddingsFor : undefined;
  return typeof embeddingsFor === "function" ? (embeddingsFor.bind(runtime) as EmbeddingsFor) : undefined;
}

/**
 * The story's embedding model: the built-in (`null`) or that connection's own. Null when there is none: a connection
 * without one, or any connection on an Engine before capability API 1.818.
 */
export async function embeddingHost(
  runtime: object,
  connectionId: string | null,
): Promise<CapabilityEmbeddingHost | null> {
  const embeddingsFor = embeddingsForOf(runtime);
  if (embeddingsFor) return (await embeddingsFor(connectionId)) ?? null;
  if (connectionId || !("embeddings" in runtime)) return null;
  return (runtime as { embeddings?: CapabilityEmbeddingHost }).embeddings ?? null;
}

/** The texts' unit vectors, or null when the call gave none for any of them (or vectors of different sizes). */
async function embedAll(
  host: CapabilityEmbeddingHost,
  texts: string[],
  inputType: "query" | "document",
  signal?: AbortSignal,
): Promise<Float32Array[] | null> {
  const vectors = await host.embed(texts, signal, inputType);
  if (!Array.isArray(vectors) || vectors.length !== texts.length) return null;
  const units = vectors.map(unitVector);
  return units.every((unit): unit is Float32Array => !!unit && unit.length === units[0]!.length) ? units : null;
}

export interface RecallCandidate {
  /** The kit's source key, JSON [kind, id]. */
  key: string;
  title: string;
  /** The summary the prompt would carry: an entry indexed from another text is passed over. */
  summary: string;
}

export interface RecallIndexDeps {
  /** The host's runtime: its embeddingsFor, else its embeddings, are feature-detected on it (embeddingHost). */
  runtime: Pick<CapabilityRuntimeHost, "logger" | "isDebugAgentsEnabled">;
  store: Pick<OtomeStore, "readDoc" | "mutateDoc" | "removeDoc">;
  background: Pick<BackgroundQueue, "ensure" | "has" | "waiting">;
}

export function createRecallIndex({ runtime, store, background }: RecallIndexDeps) {
  /** Runs asked to index again while their job waited or ran. */
  const again = new Set<string>();
  let disposed = false;
  const jobKey = (runId: string) => `${recallId(runId)}#index`;
  const runExists = async (runId: string) => !!(await store.readDoc(worldId(runId), normalizeWorld));
  const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

  async function read(runId: string) {
    const [world, summaries, index] = await Promise.all([
      store.readDoc(worldId(runId), normalizeWorld),
      store.readDoc(memoryId(runId), indexedSummaries),
      store.readDoc(recallId(runId), normalizeRecallIndex),
    ]);
    return { world, summaries: summaries ?? new Map<string, string>(), index };
  }

  /** Saves the index unless the story is gone; one deleted meanwhile keeps none. */
  async function save(runId: string, change: (current: RecallIndexDoc) => RecallIndexDoc) {
    if (!(await runExists(runId))) return;
    await store.mutateDoc(runDocTarget("recall", recallId(runId)), normalizeRecallIndex, change);
    if (!(await runExists(runId))) await store.removeDoc(recallId(runId));
  }

  /** Whether the index has a current entry for every summary, of the story's model (see the header). */
  async function current(runId: string) {
    const { world, summaries, index } = await read(runId);
    const connectionId = world?.connections.embeddings ?? null;
    const host = await embeddingHost(runtime, connectionId).catch(() => null);
    const same = !!host && index?.spaceId === host.spaceId && index.connectionId === connectionId;
    const entries = same && index ? index.chapters : {};
    const owed = [...summaries].filter(([key, text]) => entries[key]?.fingerprint !== fingerprintOf(text));
    return { world, summaries, index, connectionId, host, same, entries, owed };
  }

  /** One round of the job: embeds every summary owed, saving after each call, and lets go of what is gone. */
  async function build(runId: string) {
    const { world, summaries, index, connectionId, host, same, entries, owed } = await current(runId);
    if (!world) return;
    if (!host) {
      throw new Error(
        connectionId ? "The chosen connection has no embedding model." : "This Engine has no embedding model.",
      );
    }
    // What stays: the current entries whose summary is still the same.
    const kept = Object.fromEntries(
      Object.entries(entries).filter(
        ([key, entry]) => summaries.has(key) && entry.fingerprint === fingerprintOf(summaries.get(key)!),
      ),
    );
    const dropped = Object.keys(kept).length !== Object.keys(entries).length;
    if (same && !owed.length && !dropped && !index?.failure) return;
    const base = { version: 1 as const, spaceId: host.spaceId, connectionId };
    const chapters: Record<string, RecallEntry> = { ...kept };
    const work = owed.map(([key, text]) => ({ key, fingerprint: fingerprintOf(text), pieces: recallChunks(text) }));
    const vectors = new Map<string, string[]>();
    for (const batch of embedBatches(work.flatMap(({ key, pieces }) => pieces.map((text) => ({ key, text }))))) {
      const texts = batch.map((piece) => piece.text);
      const units = await embedAll(host, texts, "document");
      if (!units) throw new Error("The embedding model gave no vectors.");
      for (const [at, { key }] of batch.entries()) {
        vectors.set(key, [...(vectors.get(key) ?? []), packVector(units[at]!)]);
      }
      for (const { key, fingerprint, pieces } of work) {
        if (!chapters[key] && vectors.get(key)?.length === pieces.length) {
          chapters[key] = { fingerprint, vectors: vectors.get(key)! };
        }
      }
      await save(runId, () => ({ ...base, chapters }));
    }
    if (!work.length) await save(runId, () => ({ ...base, chapters }));
  }

  return {
    /**
     * Queues indexing when a summary has no current entry (see the header): never while its failure waits for Retry if
     * `open` (a story being opened). `retry`, the player's Retry, always queues, under foreground admission. True once
     * queued, or folded into the job already waiting or running.
     */
    async ensure(runId: string, { retry = false, open = false }: { retry?: boolean; open?: boolean } = {}) {
      if (disposed) return false;
      const { world, index, connectionId, owed } = await current(runId);
      if (!world || disposed) return false;
      if (!retry && (!owed.length || (open && index?.failure))) return false;
      const key = jobKey(runId);
      const queued = background.ensure({
        key,
        connectionId: connectionId ?? LOCAL_LANE,
        foreground: retry,
        run: async () => {
          try {
            do {
              again.delete(runId);
              await build(runId);
            } while (again.has(runId) && !disposed);
          } catch (error) {
            // Kept for Retry, never thrown: an embedding failure is no failure of the connection's text jobs.
            const failure = messageOf(error).slice(0, FAILURE_CHARACTERS) || "Indexing failed.";
            runtime.logger.warn("[otome-forge] Recall index: %s", failure);
            await save(runId, (saved) => ({ ...saved, failure })).catch(() => undefined);
          }
        },
      });
      if (!queued) again.add(runId);
      return true;
    },

    /** Indexing, ready or failed (see the header), with how many summaries are indexed for the story's model. */
    async status(runId: string): Promise<RecallIndexStatus> {
      const { world, summaries, index } = await read(runId);
      const connectionId = world?.connections.embeddings ?? null;
      const entries = index && index.connectionId === connectionId ? index.chapters : {};
      const indexed = [...summaries].filter(([key, text]) => entries[key]?.fingerprint === fingerprintOf(text)).length;
      const key = jobKey(runId);
      const failure = index?.failure;
      // A failure whose upkeep only waits for background admission stays the failure, with its Retry (as memory's).
      const phase =
        background.has(key) && !(failure && background.waiting(key)) ? "indexing" : failure ? "failed" : "ready";
      return {
        phase,
        indexed,
        total: summaries.size,
        ...(phase === "failed" && failure ? { message: failure } : {}),
        choosable: !!embeddingsForOf(runtime),
      };
    },

    /**
     * The candidates to recall for `query` (see the header), best first; [] without an index of the story's model or
     * vectors for the query. Never throws: a chapter's plan goes on without them.
     */
    async choose<T extends RecallCandidate>(
      runId: string,
      {
        query,
        candidates,
        signal,
        debugMode = false,
        label,
      }: { query: string; candidates: readonly T[]; signal?: AbortSignal; debugMode?: boolean; label: string },
    ): Promise<T[]> {
      const pieces = recallChunks(query).slice(0, EMBED_TEXTS_MAX);
      if (!candidates.length || !pieces.length) return [];
      try {
        const { world, index } = await read(runId);
        const connectionId = world?.connections.embeddings ?? null;
        if (!index || index.connectionId !== connectionId) return [];
        const host = await embeddingHost(runtime, connectionId);
        if (!host || host.spaceId !== index.spaceId) return [];
        // The query's pieces, averaged: one direction for the whole query.
        const vectors = await embedAll(host, pieces, "query", signal);
        const sum = vectors?.reduce((total, vector) => total.map((value, at) => value + vector[at]!));
        const mean = sum && unitVector(Array.from(sum));
        if (!mean) return [];
        const scored = candidates.flatMap((candidate) => {
          const entry = index.chapters[candidate.key];
          if (entry?.fingerprint !== fingerprintOf(candidate.summary)) return [];
          return [{ candidate, score: chapterScore(mean, entry.vectors.map(unpackVector)) }];
        });
        scored.sort((a, b) => b.score - a.score);
        const chosen = scored.filter(({ score }) => score >= RECALL_MIN_SIMILARITY).slice(0, RECALL_MAX);
        const debug = debugMode || runtime.isDebugAgentsEnabled();
        if (debug || runtime.logger.isLevelEnabled?.("debug") !== false) {
          runtime.logger.debugOverride(
            debug,
            "[debug/otome-forge/%s] Earlier chapters recalled in detail (at most %d, similarity at least %s): %s",
            label,
            RECALL_MAX,
            RECALL_MIN_SIMILARITY,
            JSON.stringify(
              scored.map(({ candidate, score }) => ({
                title: candidate.title,
                score: Math.round(score * 1000) / 1000,
                recalled: chosen.some((entry) => entry.candidate === candidate),
              })),
            ),
          );
        }
        return chosen.map(({ candidate }) => candidate);
      } catch (error) {
        runtime.logger.warn("[otome-forge] Recall: %s", messageOf(error));
        return [];
      }
    },

    /** Forgets a deleted story's request to index again. */
    invalidate(runId: string) {
      again.delete(runId);
    },

    dispose() {
      disposed = true;
      again.clear();
    },
  };
}

export type RecallIndex = ReturnType<typeof createRecallIndex>;
