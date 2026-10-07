import { matchesLtmScope, isGlobalLtmScope } from "../../../../shared/src/features/agents/long-term-memory/scope.js";
import type {
  LtmIndexLoadOutcome,
  LtmMode,
  LtmNote,
  LtmScope,
  LtmSemanticOutcome,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { applyLtmBudget } from "./budget.js";
import { searchLtmBm25 } from "./bm25.js";
import { embedLongTermMemoryTexts, type MemoryRecallEmbeddingOptions } from "./embedding-adapter.js";
import { expandLtmGraph } from "./graph.js";
import { buildStopWordSet } from "./keyword-extract.js";
import { LTM_KEYWORD_MAX_SCORE, searchLtmKeywordIndex } from "./keyword-index.js";
import { getLtmMetadataMatches } from "./metadata-index.js";
import { resolvePackageEmbeddingAdapter } from "./package-runtime.js";
import { loadOrRebuildLongTermMemoryIndexes, type LtmRecallIndex } from "./rebuild.js";
import { reciprocalRankFuse, type LtmRankLane } from "./ranking.js";
import { getLtmGlobalSettings, ltmGeneratedStopWords } from "./settings.js";
import { withLtmVaultLock } from "./vault-lock.js";

export type RetrieveLongTermMemoryInput = MemoryRecallEmbeddingOptions & {
  root: string;
  mode?: LtmMode;
  queryText?: string;
  scope?: LtmScope;
  characterIds?: string[];
  /**
   * Targeted generation: keep only notes whose entire character scope is inside this set.
   * Unset keeps the caller's normal chat-wide scope behavior.
   */
  exclusiveCharacterIds?: readonly string[];
  includeResolved?: boolean;
  maxChunks?: number;
  maxTokens?: number;
  minScore?: number;
  semanticWeight?: number;
  lexicalWeight?: number;
  graphWeight?: number;
  keywordWeight?: number;
  explain?: boolean;
  rejectedLimit?: number;
  /** Estimate chunk cost from the serialized prompt text, matching the prompt serializer. */
  promptNormalizedEstimate?: boolean;
  /** Restrict ranking to these note types before budgeting, so bounded callers do not lose targets to unrelated chunks. */
  noteTypes?: readonly LtmNote["type"][];
  /** Reconciliation needs every matching chunk, even when two notes share identical text. */
  dedupeExactText?: boolean;
  /** Preloaded recall index so callers can run several bounded queries without reloading the vault. */
  index?: LtmRecallIndex;
};

function cosine(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index]! * b[index]!;
    aa += a[index]! * a[index]!;
    bb += b[index]! * b[index]!;
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}

function hasUsableVectorIndex(
  embeddings: Awaited<ReturnType<typeof loadOrRebuildLongTermMemoryIndexes>>["embeddings"],
  spaceId: string,
) {
  return Boolean(embeddings.spaceId === spaceId && embeddings.dimension && embeddings.embeddedChunkCount > 0);
}

function pickGraphSeedNotes(
  index: Awaited<ReturnType<typeof loadOrRebuildLongTermMemoryIndexes>>,
  rankedHits: Array<{ chunkId: string }>,
  limit: number,
) {
  return Array.from(
    new Set(
      rankedHits
        .slice(0, limit)
        .map((hit) => index.metadata.chunks[hit.chunkId]?.noteId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
}

export async function retrieveLongTermMemory(input: RetrieveLongTermMemoryInput) {
  const embeddingAdapter = await resolvePackageEmbeddingAdapter(input.embeddingAdapter);
  // Read settings and load the index under one vault-lock scope so a recall that queues
  // behind a settings save judges freshness against the settings that save persisted. The
  // loader's own lock is reentrant, so nesting it here cannot deadlock.
  // The loader reports how it obtained the index (loaded, upgraded, rebuilt) so a
  // recall explanation can say which index served the recall without re-reading it.
  const indexObservation: { outcome?: LtmIndexLoadOutcome } = {};
  const { triggerStopWords, index } = await withLtmVaultLock(input.root, async () => {
    const settings = await getLtmGlobalSettings(input.root);
    return {
      triggerStopWords: settings.longTermMemoryStopWords,
      index:
        input.index ??
        (await loadOrRebuildLongTermMemoryIndexes(
          input.root,
          embeddingAdapter,
          ltmGeneratedStopWords(settings),
          input.signal,
          indexObservation,
        )),
    };
  });
  const indexLoadOutcome: LtmIndexLoadOutcome = input.index ? "preloaded" : (indexObservation.outcome ?? "loaded");
  // A caller-supplied index skips the signal-aware loader, so cancellation must be
  // rechecked here before ranking and returning a recall the caller already abandoned.
  input.signal?.throwIfAborted();
  const query = input.queryText?.trim() ?? "";
  const characterIds = Array.from(new Set([...(input.scope?.characterIds ?? []), ...(input.characterIds ?? [])]));
  const allowed = new Set(
    Object.values(index.metadata.chunks)
      .filter((chunk) => chunk.status !== "archived")
      .filter((chunk) => input.includeResolved || chunk.status !== "resolved")
      .filter((chunk) => !input.mode || chunk.modes?.includes(input.mode))
      .filter((chunk) => !input.noteTypes || input.noteTypes.includes(chunk.noteType))
      .filter((chunk) => {
        const exclusiveCharacterIds = input.exclusiveCharacterIds;
        if (exclusiveCharacterIds !== undefined) {
          const noteCharacterIds = chunk.scope?.characterIds ?? [];
          return noteCharacterIds.length > 0 && noteCharacterIds.every((id) => exclusiveCharacterIds.includes(id));
        }
        const hasScope = !isGlobalLtmScope(input.scope) || characterIds.length > 0;
        return matchesLtmScope(
          { id: chunk.noteId, type: chunk.noteType, scope: chunk.scope },
          hasScope ? { scope: input.scope, characterIds, includeGlobal: true } : { scope: {}, includeGlobal: true },
        );
      })
      .map((chunk) => chunk.id),
  );
  const lanes: LtmRankLane[] = [];
  const metadata = getLtmMetadataMatches(
    index.metadata,
    {
      noteIds: Array.from(
        query.matchAll(/\b(?:source|char|rel|scene|thread|world|faction|location|rule|tone)_[a-z0-9_]+\b/g),
        (match) => match[0],
      ),
      tags: Array.from(query.matchAll(/#([a-z][a-z0-9_]+)/g), (match) => match[1]!),
    },
    { allowedChunks: allowed },
  );
  if (metadata.length) {
    lanes.push({
      name: "direct",
      weight: 1,
      items: metadata.map((hit) => ({
        chunkId: hit.chunkId,
        rawScore: Math.min(1, hit.score),
        reason: hit.reasons.join(","),
      })),
    });
  }
  const lexical = searchLtmBm25(index.bm25, query, { allowedChunks: allowed });
  if ((input.lexicalWeight ?? 1) > 0 && lexical.length) {
    lanes.push({
      name: "bm25",
      weight: input.lexicalWeight ?? 1,
      items: lexical.map((hit) => ({ chunkId: hit.chunkId, rawScore: hit.score, reason: "bm25" })),
    });
  }
  const keywords = searchLtmKeywordIndex(index.keywords, query, {
    allowedChunks: allowed,
    stopWords: buildStopWordSet(triggerStopWords),
  });
  if ((input.keywordWeight ?? 1) > 0 && keywords.length) {
    lanes.push({
      name: "keyword",
      weight: input.keywordWeight ?? 1,
      items: keywords.map((hit) => ({
        chunkId: hit.chunkId,
        rawScore: Math.min(1, hit.score / LTM_KEYWORD_MAX_SCORE),
        reason: hit.reasons.join(","),
      })),
    });
  }
  const seedNotes = Array.from(
    new Set([...pickGraphSeedNotes(index, lexical, 5), ...pickGraphSeedNotes(index, keywords, 5)]),
  );
  const allowedNoteIds = new Set(
    Array.from(allowed, (chunkId) => index.metadata.chunks[chunkId]?.noteId).filter((id): id is string => Boolean(id)),
  );
  const graph = expandLtmGraph(index.graph, seedNotes, { allowedNoteIds }).filter((hit) => allowed.has(hit.chunkId));
  if ((input.graphWeight ?? 1) > 0 && graph.length) {
    lanes.push({
      name: "graph",
      weight: input.graphWeight ?? 1,
      items: graph.map((hit) => ({ chunkId: hit.chunkId, rawScore: hit.score, reason: `graph:${hit.viaNoteId}` })),
    });
  }
  let embeddingsAvailable = false;
  let semanticOutcome: LtmSemanticOutcome;
  if ((input.semanticWeight ?? 0) <= 0) {
    semanticOutcome = "disabled";
  } else if (!query) {
    semanticOutcome = "no_matches";
  } else if (!embeddingAdapter) {
    semanticOutcome = "unavailable";
  } else if (!hasUsableVectorIndex(index.embeddings, embeddingAdapter.spaceId)) {
    semanticOutcome = "incompatible";
  } else {
    const queryVector = (await embedLongTermMemoryTexts([query], { ...input, embeddingAdapter }))?.[0];
    if (!queryVector) {
      semanticOutcome = "unavailable";
    } else if (queryVector.length !== index.embeddings.dimension) {
      semanticOutcome = "incompatible";
    } else {
      const vectors = index.embeddings.chunks
        .flatMap((entry) => {
          if (!entry.vector || entry.vector.length !== index.embeddings.dimension || !allowed.has(entry.chunkId))
            return [];
          const score = cosine(queryVector, entry.vector);
          return score > 0 ? [{ chunkId: entry.chunkId, rawScore: score, reason: "vector" }] : [];
        })
        .sort((left, right) => right.rawScore - left.rawScore);
      embeddingsAvailable = vectors.length > 0;
      if (vectors.length) lanes.push({ name: "vector", weight: input.semanticWeight ?? 0, items: vectors });
      semanticOutcome = vectors.length > 0 ? "contributed" : "no_matches";
    }
  }
  const chunksById = new Map(Object.values(index.metadata.chunks).map((chunk) => [chunk.id, chunk]));
  const ranked = reciprocalRankFuse(lanes);
  const budgeted = applyLtmBudget(ranked, chunksById, {
    maxChunks: input.maxChunks ?? 20,
    maxTokens: input.maxTokens ?? 4096,
    relevanceScoreThreshold: input.minScore,
    explain: input.explain,
    rejectedLimit: input.rejectedLimit,
    dedupeExactText: input.dedupeExactText ?? true,
    promptNormalizedEstimate: input.promptNormalizedEstimate,
  });
  // Bounded callers reconcile note ids, so "truncated" means a ranked note was dropped from the
  // budget entirely. Dropping extra chunks of a note that is already in the window hides nothing.
  const budgetedNoteIds = new Set(budgeted.chunks.map((chunk) => chunk.chunk.noteId));
  return {
    ...budgeted,
    embeddingsAvailable,
    semanticOutcome,
    indexSnapshot: {
      loadOutcome: indexLoadOutcome,
      generatedAt: index.generatedAt,
      indexedChunks: chunksById.size,
      eligibleChunks: allowed.size,
      embeddedChunks: index.embeddings.embeddedChunkCount,
    },
    truncated: ranked.some((hit) => {
      const noteId = chunksById.get(hit.chunkId)?.noteId;
      return Boolean(noteId) && !budgetedNoteIds.has(noteId!);
    }),
    warnings: [] as string[],
  };
}
