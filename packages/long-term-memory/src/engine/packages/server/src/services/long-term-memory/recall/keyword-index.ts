import type {
  LtmKeywordIndex,
  LtmMemoryChunk,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
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

/** Issue #1465: the BM25 normalized score at which one distinctive keyword counts. */
export const LTM_SINGLE_KEYWORD_BM25_AGREEMENT = 0.2;

/**
 * Issue #1258: a keyword shared by much of the recallable vault carries little
 * signal, so a hit is scaled by an idf-like factor. A keyword unique to one chunk
 * keeps full weight; one present on every chunk keeps `log(2) / log(1 + chunkCount)`.
 */
function keywordFrequencyWeight(documentFrequency: number, totalChunks: number) {
  if (totalChunks <= 1 || documentFrequency <= 1) return 1;
  return Math.log(1 + totalChunks / documentFrequency) / Math.log(1 + totalChunks);
}

/** Issue #1467: compiled once. A pattern built per call took most of each recall. */
const KEYWORD_TOKEN_CHARACTER = /[\p{L}\p{N}]/u;

function isKeywordTokenCodePoint(codePoint: number | undefined) {
  return codePoint !== undefined && KEYWORD_TOKEN_CHARACTER.test(String.fromCodePoint(codePoint));
}

/** Whether `index` falls between the two halves of a surrogate pair. */
function splitsSurrogatePair(text: string, index: number) {
  return index > 0 && text.codePointAt(index - 1)! > 0xffff;
}

/** Whole-token containment, so `king` does not match inside `looking`. Both
 * sides are space-joined normalized tokens; edges are non-alphanumeric. Every
 * occurrence is checked, so one inside a word does not hide a later whole one.
 * Like the `u` regex this replaced, a match never starts or ends inside a
 * surrogate pair, and a pair before it counts as one code point. */
function containsKeywordToken(haystack: string, needle: string) {
  for (let start = haystack.indexOf(needle); start !== -1; start = haystack.indexOf(needle, start + 1)) {
    const end = start + needle.length;
    const before =
      start === 0
        ? undefined
        : splitsSurrogatePair(haystack, start - 1)
          ? haystack.codePointAt(start - 2)
          : haystack.charCodeAt(start - 1);
    if (
      !splitsSurrogatePair(haystack, start) &&
      !splitsSurrogatePair(haystack, end) &&
      !isKeywordTokenCodePoint(before) &&
      !isKeywordTokenCodePoint(haystack.codePointAt(end))
    ) {
      return true;
    }
    // indexOf clamps an empty needle's start to the length, so it would never return -1.
    if (end >= haystack.length) return false;
  }
  return false;
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
    /** Issue #1363: normalized names the vault knows (character titles). Capitalisation
     * cannot flag a name at a sentence start, in lowercase, or in a caseless script. */
    knownNames?: ReadonlySet<string>;
    /** Issue #1465: BM25 normalized score by chunk id, for the single-keyword cap. */
    lexicalScores?: ReadonlyMap<string, number>;
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
  // Two or more distinct keywords, a multi-word phrase, or a name (capitalised in
  // the query, or a known character name, issue #1363) keep full credit.
  // Issue #1465: a keyword the cap would cut is already rare in scope, so when
  // BM25 also rates the memory a reasonable match it scores three quarters instead.
  const nameTerms = queryNameTerms(queryText);
  const cap = LTM_KEYWORD_MAX_SCORE / 2;
  for (const [chunkId, hit] of hits) {
    if (hit.exactTerms.size !== 1) continue;
    const [term] = hit.exactTerms;
    if (term!.includes(" ") || nameTerms.has(term!) || options.knownNames?.has(term!)) continue;
    const bm25Agrees = (options.lexicalScores?.get(chunkId) ?? 0) >= LTM_SINGLE_KEYWORD_BM25_AGREEMENT;
    hit.score = hit.score >= cap && bm25Agrees ? LTM_KEYWORD_MAX_SCORE * 0.75 : Math.min(hit.score, cap);
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
