import {
  LTM_LINKED_RECALL_MIN_RELEVANCE,
  LTM_UNRELATED_RECALL_MIN_COSINE,
  LTM_UNRELATED_RECALL_SPACE_PREFIX,
} from "../../../../../shared/src/features/agents/long-term-memory/constants.js";
import { matchesLtmScope, isGlobalLtmScope } from "../../../../../shared/src/features/agents/long-term-memory/scope.js";
import type {
  LtmIndexLoadOutcome,
  LtmMode,
  LtmNote,
  LtmScope,
  LtmSemanticOutcome,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { applyLtmBudget } from "./budget.js";
import { ltmHangulNameSyllables, searchLtmBm25 } from "./bm25.js";
import { embedLongTermMemoryTexts, type MemoryRecallEmbeddingOptions } from "./embedding-adapter.js";
import { findLtmLinkedNotes } from "./graph.js";
import { buildStopWordSet, normalizeKeywordTerms } from "./keyword-extract.js";
import { LTM_KEYWORD_MAX_SCORE, searchLtmKeywordIndex } from "./keyword-index.js";
import { getLtmMetadataMatches } from "./metadata-index.js";
import { resolvePackageEmbeddingAdapter } from "../package-runtime.js";
import { loadOrRebuildLongTermMemoryIndexes, waitForScheduledLtmIndexRebuild, type LtmRecallIndex } from "./rebuild.js";
import { reciprocalRankFuse, type LtmRankedCandidate, type LtmRankLane } from "./ranking.js";
import { getLtmGlobalSettings, ltmGeneratedStopWords } from "../settings.js";
import { withLtmVaultLock } from "../persistence/vault-lock.js";

// ponytail: measured on one vault (a vector rank weight of 1.0 at the default 0.7 semantic weight lifted useful
// meaning-only matches past lexical-only ones); the relevance gate keeps the plain weight. Upgrade: re-measure on a
// second vault.
const VECTOR_RANK_WEIGHT_SCALE = 10 / 7;

export type RetrieveLongTermMemoryInput = MemoryRecallEmbeddingOptions & {
  root: string;
  mode?: LtmMode;
  queryText?: string;
  /**
   * What the vector lane embeds instead of `queryText`. A local embedder reads only its first few hundred
   * tokens, so a caller whose query is long sends the part that matters here. The other lanes keep `queryText`.
   */
  vectorQueryText?: string;
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
  /** Restrict ranking to these notes before budgeting, for callers that select notes by more than scope. */
  noteIds?: ReadonlySet<string>;
  /** Reconciliation needs every matching chunk, even when two notes share identical text. */
  dedupeExactText?: boolean;
  /** Preloaded recall index so callers can run several bounded queries without reloading the vault. */
  index?: LtmRecallIndex;
  /** Notes recalled in addition to the scope match, such as a sibling branch's memories from shared summaries. */
  inheritedNoteIds?: ReadonlySet<string>;
  /** Chunks never recalled here, judged before ranking so they cannot take a budget slot from a chunk that is returned. */
  excludedChunk?: (chunk: { noteId: string; sectionKey: string }) => boolean;
  /**
   * A recalled character brings its critical section (a death, a lasting status) along. On by default; callers that
   * pick notes rather than build a prompt turn it off so the extra section cannot change which notes they get.
   */
  statusCompanions?: boolean;
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

/** Whether a note falls inside the place a recall draws on. Recall and the "available" count share this rule. */
export function ltmRecallScopeMatches(
  note: { id: string; type: string; scope: LtmScope },
  scope: LtmScope | undefined,
  characterIds: readonly string[],
) {
  const hasScope = !isGlobalLtmScope(scope) || characterIds.length > 0;
  return matchesLtmScope(
    note,
    hasScope ? { scope, characterIds: [...characterIds], includeGlobal: true } : { scope: {}, includeGlobal: true },
  );
}

export async function retrieveLongTermMemory(input: RetrieveLongTermMemoryInput) {
  const embeddingAdapter = await resolvePackageEmbeddingAdapter(input.embeddingAdapter);
  // Read settings and load the index under one vault-lock scope so a recall that queues
  // behind a settings save judges freshness against the settings that save persisted. The
  // loader's own lock is reentrant, so nesting it here cannot deadlock.
  // The loader reports how it obtained the index (loaded or rebuilt) so a
  // recall explanation can say which index served the recall without re-reading it.
  const indexObservation: { outcome?: LtmIndexLoadOutcome } = {};
  // The loader waits for a scheduled rebuild only outside the vault lock, so wait before taking it here.
  if (!input.index) await waitForScheduledLtmIndexRebuild(input.root, input.signal);
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
      .filter((chunk) => !input.noteIds || input.noteIds.has(chunk.noteId))
      .filter((chunk) => !input.excludedChunk?.(chunk))
      .filter((chunk) => {
        const exclusiveCharacterIds = input.exclusiveCharacterIds;
        if (exclusiveCharacterIds !== undefined) {
          const noteCharacterIds = chunk.scope?.characterIds ?? [];
          return noteCharacterIds.length > 0 && noteCharacterIds.every((id) => exclusiveCharacterIds.includes(id));
        }
        return (
          ltmRecallScopeMatches(
            { id: chunk.noteId, type: chunk.noteType, scope: chunk.scope },
            input.scope,
            characterIds,
          ) || input.inheritedNoteIds?.has(chunk.noteId)
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
  // Issue #1438: names come from every character chunk, not only the allowed
  // ones, so the query folds the same one-syllable names the index was built with.
  const lexical = searchLtmBm25(index.bm25, query, {
    allowedChunks: allowed,
    nameSyllables: ltmHangulNameSyllables(Object.values(index.metadata.chunks)),
  });
  if ((input.lexicalWeight ?? 1) > 0 && lexical.length) {
    lanes.push({
      name: "bm25",
      weight: input.lexicalWeight ?? 1,
      items: lexical.map((hit) => ({
        chunkId: hit.chunkId,
        rawScore: hit.score,
        normalizedScore: hit.normalizedScore,
        reason: "bm25",
      })),
    });
  }
  const stopWords = buildStopWordSet(triggerStopWords);
  // Issue #1363: a character's title words are names wherever they appear, so a
  // single keyword match on one keeps full credit without relying on capitalisation.
  const knownNames = new Set(
    Object.values(index.metadata.chunks).flatMap((chunk) =>
      chunk.noteType === "character" && chunk.title && allowed.has(chunk.id)
        ? normalizeKeywordTerms(chunk.title, stopWords)
        : [],
    ),
  );
  // Issue #1467: only the keyword lane reads this search, so skip it when that lane is off.
  const keywords =
    (input.keywordWeight ?? 1) > 0
      ? searchLtmKeywordIndex(index.keywords, query, {
          allowedChunks: allowed,
          stopWords,
          knownNames,
          // Issue #1465: BM25 agreement lets one distinctive keyword past the single-keyword cap.
          lexicalScores: new Map(lexical.map((hit) => [hit.chunkId, hit.normalizedScore])),
        })
      : [];
  if (keywords.length) {
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
  let embeddingsAvailable = false;
  // The meaning search found nothing close to the latest messages, so only explicit id/tag hits may pass.
  let unrelated = false;
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
    const queryVector = (
      await embedLongTermMemoryTexts([input.vectorQueryText?.trim() || query], {
        ...input,
        embeddingAdapter,
        inputType: "query",
      })
    )?.[0];
    if (!queryVector) {
      semanticOutcome = "unavailable";
    } else if (queryVector.length !== index.embeddings.dimension) {
      semanticOutcome = "incompatible";
    } else {
      // The gate reads the best cosine of every scored chunk, so a query far from all of them (<= 0) still counts.
      let bestCosine = Number.NEGATIVE_INFINITY;
      const vectors = index.embeddings.chunks
        .flatMap((entry) => {
          if (!entry.vector || entry.vector.length !== index.embeddings.dimension || !allowed.has(entry.chunkId))
            return [];
          const score = cosine(queryVector, entry.vector);
          bestCosine = Math.max(bestCosine, score);
          return score > 0 ? [{ chunkId: entry.chunkId, rawScore: score, reason: "vector" }] : [];
        })
        .sort((left, right) => right.rawScore - left.rawScore);
      embeddingsAvailable = vectors.length > 0;
      unrelated =
        bestCosine > Number.NEGATIVE_INFINITY &&
        embeddingAdapter.spaceId.startsWith(LTM_UNRELATED_RECALL_SPACE_PREFIX) &&
        bestCosine < LTM_UNRELATED_RECALL_MIN_COSINE;
      // A short reply ("ok", "go on") leaves the newest-messages query with no scene in it, so before skipping the
      // recall the joined window gets a say: skip only when it is under the cut too. Most turns pay no second embed;
      // if the window embeds to nothing usable the first answer stands.
      const windowText = input.vectorQueryText?.trim();
      if (unrelated && windowText && windowText !== query) {
        const windowVector = (
          await embedLongTermMemoryTexts([query], { ...input, embeddingAdapter, inputType: "query" })
        )?.[0];
        if (windowVector?.length === index.embeddings.dimension) {
          unrelated = !index.embeddings.chunks.some(
            (entry) =>
              entry.vector?.length === index.embeddings.dimension &&
              allowed.has(entry.chunkId) &&
              cosine(windowVector, entry.vector) >= LTM_UNRELATED_RECALL_MIN_COSINE,
          );
        }
      }
      if (vectors.length) {
        const weight = input.semanticWeight ?? 0;
        lanes.push({ name: "vector", weight, rankWeight: weight * VECTOR_RANK_WEIGHT_SCALE, items: vectors });
      }
      semanticOutcome = vectors.length > 0 ? "contributed" : "no_matches";
    }
  }
  const chunksById = new Map(Object.values(index.metadata.chunks).map((chunk) => [chunk.id, chunk]));
  const fused = reciprocalRankFuse(lanes);
  const ranked = unrelated ? fused.filter((candidate) => candidate.lanes.includes("direct")) : fused;
  const budgetOptions = {
    maxChunks: input.maxChunks,
    maxTokens: input.maxTokens ?? 4096,
    relevanceScoreThreshold: input.minScore,
    explain: input.explain,
    rejectedLimit: input.rejectedLimit,
    dedupeExactText: input.dedupeExactText ?? true,
    promptNormalizedEstimate: input.promptNormalizedEstimate,
    // Drawn from the chunks the ranking could use, so scope, mode, branch and exclusions apply to companions too.
    companionChunks:
      input.statusCompanions === false
        ? undefined
        : Array.from(allowed, (id) => chunksById.get(id)).filter(
            (chunk): chunk is NonNullable<typeof chunk> =>
              chunk?.noteType === "character" && chunk.importance === "critical",
          ),
  };
  let budgeted = applyLtmBudget(ranked, chunksById, budgetOptions);
  if ((input.graphWeight ?? 1) > 0 && (input.minScore ?? 0) > LTM_LINKED_RECALL_MIN_RELEVANCE) {
    // Linked recall: a memory that nearly matches the chat on its own is added through an explanatory
    // link from a recalled memory. Recalled memories keep their places, and linked ones skip the threshold.
    // At a threshold at or below the floor, the first pass already admitted every candidate it could.
    const noteTypes = new Map(Array.from(chunksById.values(), (chunk) => [chunk.noteId, chunk.noteType]));
    const rankedById = new Map(ranked.map((candidate) => [candidate.chunkId, candidate]));
    // A companion is not a seed: the second pass picks it again, with its reason, next to its own section.
    const seedChunkIds = new Set(budgeted.chunks.filter((item) => !item.companion).map((item) => item.chunk.id));
    const linkedCandidates: LtmRankedCandidate[] = [];
    for (const link of findLtmLinkedNotes(
      index.graph,
      budgeted.chunks.map((item) => item.chunk.noteId),
      (noteId) => noteTypes.get(noteId),
    )) {
      for (const chunkId of index.graph.nodes[link.noteId]?.chunkIds ?? []) {
        const own = rankedById.get(chunkId);
        if (!own || own.relevanceScore < LTM_LINKED_RECALL_MIN_RELEVANCE) continue;
        linkedCandidates.push({
          ...own,
          linked: true,
          lanes: [...own.lanes, "graph"],
          reasons: [...own.reasons, `graph:${link.relation}:${link.seedNoteId}`],
        });
      }
    }
    if (linkedCandidates.length) {
      linkedCandidates.sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId));
      const linkedIds = new Set(linkedCandidates.map((candidate) => candidate.chunkId));
      budgeted = applyLtmBudget(
        [
          ...ranked.filter((candidate) => seedChunkIds.has(candidate.chunkId)),
          ...linkedCandidates,
          ...ranked.filter((candidate) => !seedChunkIds.has(candidate.chunkId) && !linkedIds.has(candidate.chunkId)),
        ],
        chunksById,
        {
          ...budgetOptions,
          eventSlotFloor: budgeted.chunks.filter((item) => item.chunk.noteType === "timeline_event").length,
        },
      );
    }
  }
  // Bounded callers reconcile note ids, so "truncated" means a ranked note was dropped from the
  // budget entirely. Dropping extra chunks of a note that is already in the window hides nothing.
  const budgetedNoteIds = new Set(budgeted.chunks.map((chunk) => chunk.chunk.noteId));
  return {
    ...budgeted,
    embeddingsAvailable,
    semanticOutcome,
    // True when nothing is close to the latest messages in meaning; an explicit id or tag hit that survives the gate means no skip.
    skippedUnrelated: unrelated && ranked.length === 0,
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
