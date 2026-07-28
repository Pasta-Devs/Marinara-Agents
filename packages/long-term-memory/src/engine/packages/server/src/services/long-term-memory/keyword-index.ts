import type { LtmKeywordIndex, LtmMemoryChunk } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { normalizeKeywordTerms } from "./keyword-extract.js";

function addKeyword(map: Record<string, string[]>, key: string, value: string) {
  const bucket = map[key] ?? [];
  bucket.push(value);
  map[key] = bucket;
}

export function buildLtmKeywordIndex(chunks: LtmMemoryChunk[]): LtmKeywordIndex {
  const byKeyword: Record<string, string[]> = {};
  const byChunkId: Record<string, string[]> = {};

  for (const chunk of chunks.slice().sort((left, right) => left.id.localeCompare(right.id))) {
    const normalized = Array.from(
      new Set(
        chunk.keywords.flatMap((keyword) => {
          const terms = normalizeKeywordTerms(keyword);
          return terms.length > 0 ? [terms.join(" ")] : [];
        }),
      ),
    ).sort((left, right) => left.localeCompare(right));
    byChunkId[chunk.id] = normalized;
    for (const keyword of normalized) addKeyword(byKeyword, keyword, chunk.id);
  }

  return {
    version: 1,
    byKeyword: Object.fromEntries(
      Object.entries(byKeyword)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([keyword, chunkIds]) => [keyword, chunkIds.sort((left, right) => left.localeCompare(right))]),
    ),
    byChunkId: Object.fromEntries(
      Object.entries(byChunkId)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([chunkId, keywords]) => [chunkId, keywords]),
    ),
  };
}

export function searchLtmKeywordIndex(
  index: LtmKeywordIndex,
  queryText: string,
  options: {
    topK?: number;
    maxCandidatesPerKeyword?: number;
    maxKeywordCatalogEntries?: number;
    maxCandidates?: number;
    allowedChunks?: Set<string>;
  } = {},
) {
  const normalizedTerms = normalizeKeywordTerms(queryText);
  const normalizedQuery = normalizedTerms.join(" ");
  if (normalizedTerms.length === 0 || normalizedQuery.length === 0) return [];
  const maxCandidatesPerKeyword = Math.max(1, options.maxCandidatesPerKeyword ?? 128);
  const maxKeywordCatalogEntries = Math.max(1, options.maxKeywordCatalogEntries ?? 512);
  const maxCandidates = Math.max(1, options.maxCandidates ?? options.topK ?? 50);

  const hits = new Map<string, { score: number; reasons: string[]; matchedKeywords: Set<string> }>();

  const add = (chunkId: string, keyword: string, score: number, reason: string) => {
    if (options.allowedChunks && !options.allowedChunks.has(chunkId)) return;
    const existing = hits.get(chunkId) ?? { score: 0, reasons: [], matchedKeywords: new Set<string>() };
    const dedupeKey = `${keyword}\0${reason}`;
    if (existing.matchedKeywords.has(dedupeKey)) return;
    existing.matchedKeywords.add(dedupeKey);
    existing.score += score;
    existing.reasons.push(reason);
    hits.set(chunkId, existing);
  };

  for (const chunkId of (index.byKeyword[normalizedQuery] ?? []).slice(0, maxCandidatesPerKeyword)) {
    add(chunkId, normalizedQuery, 4, `keyword:exact:${normalizedQuery}`);
  }

  for (const term of normalizedTerms) {
    if (term === normalizedQuery) continue;
    for (const chunkId of (index.byKeyword[term] ?? []).slice(0, maxCandidatesPerKeyword)) {
      add(chunkId, term, 3, `keyword:exact:${term}`);
    }
  }

  for (const [keyword, chunkIds] of Object.entries(index.byKeyword)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, maxKeywordCatalogEntries)) {
    if (normalizedTerms.includes(keyword)) continue;
    const exactContained = normalizedQuery.includes(keyword) || keyword.includes(normalizedQuery);
    if (!exactContained) {
      const overlappingTerm = normalizedTerms.find((term) => keyword.includes(term) || term.includes(keyword));
      if (!overlappingTerm) continue;
      const overlapRatio =
        Math.min(overlappingTerm.length, keyword.length) / Math.max(overlappingTerm.length, keyword.length);
      for (const chunkId of chunkIds.slice(0, maxCandidatesPerKeyword)) {
        add(chunkId, keyword, 0.75 + overlapRatio * 0.75, `keyword:fuzzy:${keyword}`);
      }
      continue;
    }
    const overlapRatio =
      Math.min(normalizedQuery.length, keyword.length) / Math.max(normalizedQuery.length, keyword.length);
    for (const chunkId of chunkIds.slice(0, maxCandidatesPerKeyword)) {
      add(chunkId, keyword, 1.25 + overlapRatio, `keyword:fuzzy:${keyword}`);
    }
  }

  return [...hits.entries()]
    .map(([chunkId, value]) => ({
      chunkId,
      score: value.score,
      reasons: value.reasons,
    }))
    .sort((left, right) => right.score - left.score || left.chunkId.localeCompare(right.chunkId))
    .slice(0, maxCandidates);
}
