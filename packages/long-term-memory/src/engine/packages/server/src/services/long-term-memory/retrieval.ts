import { matchesLtmScope, isGlobalLtmScope } from "../../../../shared/src/features/agents/long-term-memory/scope.js";
import type { LtmMode, LtmScope } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { applyLtmBudget } from "./budget.js";
import { searchLtmBm25 } from "./bm25.js";
import { embedLongTermMemoryTexts, type MemoryRecallEmbeddingOptions } from "./embedding-adapter.js";
import { expandLtmGraph } from "./graph.js";
import { searchLtmKeywordIndex } from "./keyword-index.js";
import { getLtmMetadataMatches } from "./metadata-index.js";
import { loadOrRebuildLongTermMemoryIndexes } from "./rebuild.js";
import { reciprocalRankFuse, type LtmRankLane } from "./ranking.js";

export type RetrieveLongTermMemoryInput = MemoryRecallEmbeddingOptions & {
  root: string;
  mode?: LtmMode;
  queryText?: string;
  scope?: LtmScope;
  characterIds?: string[];
  includeResolved?: boolean;
  maxChunks?: number;
  maxTokens?: number;
  minScore?: number;
  semanticWeight?: number;
  lexicalWeight?: number;
  graphWeight?: number;
  keywordWeight?: number;
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

export async function retrieveLongTermMemory(input: RetrieveLongTermMemoryInput) {
  const index = await loadOrRebuildLongTermMemoryIndexes(input.root);
  const query = input.queryText?.trim() ?? "";
  const characterIds = Array.from(new Set([...(input.scope?.characterIds ?? []), ...(input.characterIds ?? [])]));
  const allowed = new Set(
    Object.values(index.metadata.chunks)
      .filter((chunk) => chunk.status !== "archived")
      .filter((chunk) => input.includeResolved || chunk.status !== "resolved" || chunk.noteType !== "thread")
      .filter((chunk) => !input.mode || chunk.modes?.includes(input.mode))
      .filter((chunk) => {
        if (chunk.scope.groupId && chunk.scope.groupId !== input.scope?.groupId) return false;
        const hasScope = !isGlobalLtmScope(input.scope) || characterIds.length > 0;
        return matchesLtmScope(
          { id: chunk.noteId, type: chunk.noteType, scope: chunk.scope },
          hasScope ? { scope: input.scope, characterIds, includeGlobal: true } : { scope: {}, includeGlobal: true },
        );
      })
      .map((chunk) => chunk.id),
  );
  const lanes: LtmRankLane[] = [];
  const metadata = getLtmMetadataMatches(index.metadata, {
    noteIds: Array.from(query.matchAll(/\b(?:source|char|rel|scene|thread|world|faction|location|rule|tone)_[a-z0-9_]+\b/g), (match) => match[0]),
    tags: Array.from(query.matchAll(/#([a-z][a-z0-9_]+)/g), (match) => match[1]!),
  }).filter((hit) => allowed.has(hit.chunkId));
  if (metadata.length) {
    lanes.push({ name: "direct", weight: 1, items: metadata.map((hit) => ({ chunkId: hit.chunkId, rawScore: Math.min(1, hit.score), reason: hit.reasons.join(",") })) });
  }
  const lexical = searchLtmBm25(index.bm25, query, { allowedChunks: allowed });
  if ((input.lexicalWeight ?? 1) > 0 && lexical.length) {
    lanes.push({ name: "bm25", weight: input.lexicalWeight ?? 1, items: lexical.map((hit) => ({ chunkId: hit.chunkId, rawScore: hit.score, reason: "bm25" })) });
  }
  const keywords = searchLtmKeywordIndex(index.keywords, query, { allowedChunks: allowed });
  if ((input.keywordWeight ?? 1) > 0 && keywords.length) {
    const max = keywords[0]?.score ?? 1;
    lanes.push({ name: "keyword", weight: input.keywordWeight ?? 1, items: keywords.map((hit) => ({ chunkId: hit.chunkId, rawScore: hit.score / max, reason: hit.reasons.join(",") })) });
  }
  const seedNotes = Array.from(new Set([...lexical, ...keywords].slice(0, 10).map((hit) => index.metadata.chunks[hit.chunkId]?.noteId).filter((id): id is string => Boolean(id))));
  const graph = expandLtmGraph(index.graph, seedNotes).filter((hit) => allowed.has(hit.chunkId));
  if ((input.graphWeight ?? 1) > 0 && graph.length) {
    lanes.push({ name: "graph", weight: input.graphWeight ?? 1, items: graph.map((hit) => ({ chunkId: hit.chunkId, rawScore: hit.score, reason: `graph:${hit.viaNoteId}` })) });
  }
  let embeddingsAvailable = false;
  if ((input.semanticWeight ?? 0) > 0 && index.embeddings.dimension && query) {
    const queryVector = (await embedLongTermMemoryTexts([query], input))?.[0];
    if (queryVector?.length === index.embeddings.dimension) {
      const vectors = index.embeddings.chunks.flatMap((entry) => {
        if (!entry.vector || !allowed.has(entry.chunkId)) return [];
        const score = cosine(queryVector, entry.vector);
        return score > 0 ? [{ chunkId: entry.chunkId, rawScore: score, reason: "vector" }] : [];
      }).sort((left, right) => right.rawScore - left.rawScore);
      embeddingsAvailable = vectors.length > 0;
      if (vectors.length) lanes.push({ name: "vector", weight: input.semanticWeight ?? 0, items: vectors });
    }
  }
  const chunksById = new Map(Object.values(index.metadata.chunks).map((chunk) => [chunk.id, chunk]));
  const ranked = reciprocalRankFuse(lanes).filter((candidate) => (candidate.normalizedScore ?? 0) >= (input.minScore ?? 0));
  const budgeted = applyLtmBudget(ranked, chunksById, {
    maxChunks: input.maxChunks ?? 20,
    maxTokens: input.maxTokens ?? 4096,
    dedupeExactText: true,
  });
  return { ...budgeted, embeddingsAvailable, warnings: [] as string[] };
}
