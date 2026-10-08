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
 * Issue #1258: a keyword shared by much of the recallable vault carries little
 * signal, so a hit is scaled by an idf-like factor. A keyword unique to one chunk
 * keeps full weight; one present on every chunk keeps `log(2) / log(1 + chunkCount)`.
 */
function keywordFrequencyWeight(documentFrequency: number, totalChunks: number) {
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

/** Issue #1264: names the query uses, i.e. a capitalised word that is not the
 * start of a sentence, quote, or line. Names keep full keyword credit on a single
 * match. Check the context before horizontal whitespace without consuming it. */
function queryNameTerms(queryText: string) {
  const names = new Set<string>();
  for (const match of queryText.matchAll(/[^\S\r\n]+(\p{Lu}[\p{L}'-]*)/gu)) {
    const precedingContext = queryText.slice(0, match.index).replace(/[^\S\r\n]+$/u, "");
    if (/(?:^|[.!?"\r\n*(])$/u.test(precedingContext)) continue;
    names.add(match[1]!.toLocaleLowerCase().replace(/'s$/, ""));
  }
  return names;
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
  // Like the #1251 caps, frequency counts only chunks the caller allows, so a
  // keyword common in other chats keeps its weight where it is distinctive.
  const totalChunks = options.allowedChunks
    ? Array.from(options.allowedChunks).filter((chunkId) => Object.hasOwn(index.byChunkId, chunkId)).length
    : Object.keys(index.byChunkId).length;
  const documentFrequencies = new Map<string, number>();
  const documentFrequency = (keyword: string) => {
    let count = documentFrequencies.get(keyword);
    if (count === undefined) {
      const chunkIds = Object.hasOwn(index.byKeyword, keyword) ? (index.byKeyword[keyword] ?? []) : [];
      count = options.allowedChunks
        ? chunkIds.filter((chunkId) => options.allowedChunks?.has(chunkId)).length
        : chunkIds.length;
      documentFrequencies.set(keyword, count);
    }
    return count;
  };

  const hits = new Map<
    string,
    { score: number; reasons: string[]; matchedKeywords: Set<string>; exactTerms: Set<string> }
  >();

  const add = (chunkId: string, keyword: string, score: number, reason: string) => {
    if (options.allowedChunks && !options.allowedChunks.has(chunkId)) return;
    const existing = hits.get(chunkId) ?? {
      score: 0,
      reasons: [],
      matchedKeywords: new Set<string>(),
      exactTerms: new Set<string>(),
    };
    const dedupeKey = `${keyword}\0${reason}`;
    if (existing.matchedKeywords.has(dedupeKey)) return;
    existing.matchedKeywords.add(dedupeKey);
    // Best match per chunk instead of a sum: two generic exact keywords used to
    // add up to the exact-phrase ceiling on a chunk that shares nothing else.
    existing.score = Math.max(existing.score, score * keywordFrequencyWeight(documentFrequency(keyword), totalChunks));
    if (reason.startsWith("keyword:exact:")) existing.exactTerms.add(reason.slice("keyword:exact:".length));
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

  // Issue #1264: pick the bounded fuzzy catalog by overlap with the query terms
  // instead of alphabetical order, so a keyword late in a large scope is still
  // reachable. The cap still bounds how many keywords get their postings scanned.
  const fuzzyCandidates: Array<{ keyword: string; chunkIds: string[]; score: number }> = [];
  for (const [keyword, chunkIds] of Object.entries(index.byKeyword)) {
    if (inScopeCatalogKeywords && !inScopeCatalogKeywords.has(keyword)) continue;
    if (normalizedTerms.includes(keyword)) continue;
    const exactContained =
      containsKeywordToken(normalizedQuery, keyword) || containsKeywordToken(keyword, normalizedQuery);
    if (exactContained) {
      const overlapRatio =
        Math.min(normalizedQuery.length, keyword.length) / Math.max(normalizedQuery.length, keyword.length);
      fuzzyCandidates.push({ keyword, chunkIds, score: 1.25 + overlapRatio });
      continue;
    }
    const overlappingTerm = normalizedTerms.find(
      (term) => containsKeywordToken(keyword, term) || containsKeywordToken(term, keyword),
    );
    if (!overlappingTerm) continue;
    const overlapRatio =
      Math.min(overlappingTerm.length, keyword.length) / Math.max(overlappingTerm.length, keyword.length);
    fuzzyCandidates.push({ keyword, chunkIds, score: 0.75 + overlapRatio * 0.75 });
  }
  fuzzyCandidates.sort((left, right) => right.score - left.score || left.keyword.localeCompare(right.keyword));
  for (const candidate of fuzzyCandidates.slice(0, maxKeywordCatalogEntries)) {
    for (const chunkId of takeAllowed(candidate.chunkIds)) {
      add(chunkId, candidate.keyword, candidate.score, `keyword:fuzzy:${candidate.keyword}`);
    }
  }

  // Issue #1264: one ordinary exact keyword must not clear the threshold alone.
  // Two or more distinct keywords, a multi-word phrase, or a name keep full credit.
  const nameTerms = queryNameTerms(queryText);
  for (const hit of hits.values()) {
    if (hit.exactTerms.size !== 1) continue;
    const [term] = hit.exactTerms;
    if (term!.includes(" ") || nameTerms.has(term!)) continue;
    hit.score = Math.min(hit.score, LTM_KEYWORD_MAX_SCORE / 2);
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
