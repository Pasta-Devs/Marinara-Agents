import type {
  LtmKeywordIndex,
  LtmMemoryChunk,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { normalizeKeywordTerms } from "./keyword-extract.js";

function addKeyword(map: Map<string, string[]>, key: string, value: string) {
  const bucket = map.get(key) ?? [];
  bucket.push(value);
  map.set(key, bucket);
}

export function buildLtmKeywordIndex(chunks: LtmMemoryChunk[]): LtmKeywordIndex {
  const byKeyword = new Map<string, string[]>();
  const byChunkId = new Map<string, string[]>();

  for (const chunk of chunks.slice().sort((left, right) => left.id.localeCompare(right.id))) {
    const normalized = Array.from(
      new Set(
        chunk.keywords.flatMap((keyword) => {
          const terms = normalizeKeywordTerms(keyword);
          return terms.length > 0 ? [terms.join(" ")] : [];
        }),
      ),
    ).sort((left, right) => left.localeCompare(right));
    byChunkId.set(chunk.id, normalized);
    for (const keyword of normalized) addKeyword(byKeyword, keyword, chunk.id);
  }

  return {
    version: 1,
    byKeyword: Object.fromEntries(
      Array.from(byKeyword.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([keyword, chunkIds]) => [keyword, chunkIds.sort((left, right) => left.localeCompare(right))]),
    ),
    byChunkId: Object.fromEntries(
      Array.from(byChunkId.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([chunkId, keywords]) => [chunkId, keywords]),
    ),
  };
}

/** Score of a keyword hit whose normalized phrase equals the normalized query exactly. */
export const LTM_KEYWORD_MAX_SCORE = 4;

/**
 * Issue #1258: a keyword shared by much of the vault carries little signal, so a
 * hit is scaled by an idf-like factor. A keyword unique to one chunk keeps full
 * weight; one present on every chunk keeps `log(2) / log(1 + chunkCount)`.
 * `totalChunks` is hoisted by the caller so a hit never re-counts the vault.
 */
function keywordFrequencyWeight(index: LtmKeywordIndex, keyword: string, totalChunks: number) {
  const documentFrequency = Object.hasOwn(index.byKeyword, keyword) ? (index.byKeyword[keyword]?.length ?? 0) : 0;
  if (totalChunks <= 1 || documentFrequency <= 1) return 1;
  return Math.log(1 + totalChunks / documentFrequency) / Math.log(1 + totalChunks);
}

/** Whole-token containment, so `king` does not match inside `looking`. Both
 * sides are space-joined normalized tokens; edges are non-alphanumeric.
 * Persisted keys are only length-checked, so escape before building the pattern. */
function containsKeywordToken(haystack: string, needle: string) {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(haystack);
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
    stopWords?: ReadonlySet<string>;
  } = {},
) {
  const normalizedTerms = normalizeKeywordTerms(queryText, options.stopWords);
  const normalizedQuery = normalizedTerms.join(" ");
  if (normalizedTerms.length === 0 || normalizedQuery.length === 0) return [];
  const maxCandidatesPerKeyword = Math.max(1, options.maxCandidatesPerKeyword ?? 128);
  const maxKeywordCatalogEntries = Math.max(1, options.maxKeywordCatalogEntries ?? 512);
  const maxCandidates = Math.max(1, options.maxCandidates ?? options.topK ?? 50);
  const totalChunks = Object.keys(index.byChunkId).length;

  const hits = new Map<string, { score: number; reasons: string[]; matchedKeywords: Set<string> }>();

  const add = (chunkId: string, keyword: string, score: number, reason: string) => {
    if (options.allowedChunks && !options.allowedChunks.has(chunkId)) return;
    const existing = hits.get(chunkId) ?? { score: 0, reasons: [], matchedKeywords: new Set<string>() };
    const dedupeKey = `${keyword}\0${reason}`;
    if (existing.matchedKeywords.has(dedupeKey)) return;
    existing.matchedKeywords.add(dedupeKey);
    // Best match per chunk instead of a sum: two generic exact keywords used to
    // add up to the exact-phrase ceiling on a chunk that shares nothing else.
    existing.score = Math.max(existing.score, score * keywordFrequencyWeight(index, keyword, totalChunks));
    existing.reasons.push(reason);
    hits.set(chunkId, existing);
  };

  // Issue #1251: every cap counts only chunks the caller allows, so out-of-scope
  // entries cannot crowd in-scope ones out of a bucket before the scope filter.
  const takeAllowed = (chunkIds: string[]) => {
    if (!options.allowedChunks) return chunkIds.slice(0, maxCandidatesPerKeyword);
    const taken: string[] = [];
    for (const chunkId of chunkIds) {
      if (!options.allowedChunks.has(chunkId)) continue;
      taken.push(chunkId);
      if (taken.length >= maxCandidatesPerKeyword) break;
    }
    return taken;
  };
  // The fuzzy catalog cap must count only keywords an allowed chunk actually has,
  // or late-alphabet in-scope keywords fall outside the vault-wide slice.
  const inScopeCatalogKeywords = options.allowedChunks
    ? new Set(
        Array.from(options.allowedChunks).flatMap((chunkId) =>
          Object.hasOwn(index.byChunkId, chunkId) ? (index.byChunkId[chunkId] ?? []) : [],
        ),
      )
    : undefined;

  const exactQueryMatches = Object.hasOwn(index.byKeyword, normalizedQuery)
    ? index.byKeyword[normalizedQuery]
    : undefined;
  for (const chunkId of takeAllowed(exactQueryMatches ?? [])) {
    add(chunkId, normalizedQuery, 4, `keyword:exact:${normalizedQuery}`);
  }

  for (const term of normalizedTerms) {
    if (term === normalizedQuery) continue;
    const exactTermMatches = Object.hasOwn(index.byKeyword, term) ? index.byKeyword[term] : undefined;
    for (const chunkId of takeAllowed(exactTermMatches ?? [])) {
      add(chunkId, term, 3, `keyword:exact:${term}`);
    }
  }

  let catalogEntries = 0;
  for (const [keyword, chunkIds] of Object.entries(index.byKeyword).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (catalogEntries >= maxKeywordCatalogEntries) break;
    if (inScopeCatalogKeywords && !inScopeCatalogKeywords.has(keyword)) continue;
    catalogEntries += 1;
    if (normalizedTerms.includes(keyword)) continue;
    const exactContained =
      containsKeywordToken(normalizedQuery, keyword) || containsKeywordToken(keyword, normalizedQuery);
    if (!exactContained) {
      const overlappingTerm = normalizedTerms.find(
        (term) => containsKeywordToken(keyword, term) || containsKeywordToken(term, keyword),
      );
      if (!overlappingTerm) continue;
      const overlapRatio =
        Math.min(overlappingTerm.length, keyword.length) / Math.max(overlappingTerm.length, keyword.length);
      for (const chunkId of takeAllowed(chunkIds)) {
        add(chunkId, keyword, 0.75 + overlapRatio * 0.75, `keyword:fuzzy:${keyword}`);
      }
      continue;
    }
    const overlapRatio =
      Math.min(normalizedQuery.length, keyword.length) / Math.max(normalizedQuery.length, keyword.length);
    for (const chunkId of takeAllowed(chunkIds)) {
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
