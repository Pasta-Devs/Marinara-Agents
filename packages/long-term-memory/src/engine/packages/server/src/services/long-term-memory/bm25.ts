import type {
  LtmBm25Index,
  LtmBm25Posting,
  LtmMemoryChunk,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";

const TOKEN_PATTERN = /[\p{L}\p{N}_]+/gu;
const K1 = 1.2;
const B = 0.75;

export function tokenizeLtmText(text: string) {
  return Array.from(text.toLocaleLowerCase().matchAll(TOKEN_PATTERN), (match) => match[0]).filter(
    (token) => token.length > 1,
  );
}

export function buildLtmBm25Index(chunks: LtmMemoryChunk[]): LtmBm25Index {
  const documents = new Map<string, LtmBm25Index["documents"][string]>();
  const termBuckets = new Map<string, LtmBm25Posting[]>();
  let totalLength = 0;

  for (const chunk of chunks) {
    const tokens = tokenizeLtmText(chunk.text);
    totalLength += tokens.length;
    documents.set(chunk.id, { length: tokens.length });

    const counts = new Map<string, number>();
    for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);

    for (const [term, count] of counts) {
      const postings = termBuckets.get(term) ?? [];
      postings.push({ chunkId: chunk.id, count });
      termBuckets.set(term, postings);
    }
  }

  const terms = Object.fromEntries(
    Array.from(termBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([term, postings]) => {
        const sortedPostings = postings.sort((a, b) => a.chunkId.localeCompare(b.chunkId));
        return [
          term,
          {
            documentFrequency: sortedPostings.length,
            postings: sortedPostings,
          },
        ];
      }),
  );

  return {
    version: 1,
    chunkCount: chunks.length,
    avgDocLength: chunks.length === 0 ? 0 : totalLength / chunks.length,
    documents: Object.fromEntries(Array.from(documents.entries()).sort(([a], [b]) => a.localeCompare(b))),
    terms,
  };
}

export function searchLtmBm25(
  index: LtmBm25Index,
  query: string,
  options: { topK?: number; maxPostingsPerTerm?: number; maxCandidates?: number; allowedChunks?: Set<string> } = {},
) {
  if (index.chunkCount === 0 || index.avgDocLength === 0) return [];

  const scores = new Map<string, number>();
  const queryTerms = new Set(tokenizeLtmText(query));
  const maxCandidates = Math.max(1, options.maxCandidates ?? options.topK ?? 50);
  // Issue #1258: an unbounded idf sum made `score / (score + 1)` saturate near 1
  // for almost every hit, so the score threshold behaved as a cliff. Scaling by the
  // score of a reference document that contains each query term once at average
  // length measures how much of the query a chunk covers: a full-coverage match
  // approaches 1 and a partial match scales with the idf it shares. At tf = 1 and
  // dl = avgDocLength the length normalization cancels, so each present term
  // contributes exactly its idf.
  // Issue #1264: a long chat window has many query terms, and dividing by all of
  // them drove real BM25 scores below 0.1. Reference the eight highest-idf query
  // terms present in the index instead, so unrelated narration padding cannot
  // shrink a matching chunk's normalized score toward zero.
  // ponytail: the reference is not an upper bound. Repeated terms, or a chunk much
  // shorter than average, can clamp a partial match at 1 beside a full one. The
  // true ceiling, Σidf·(K1+1), compresses real hits below ~0.3 and would need the
  // recall presets retuned for that range.
  type Bm25TermEntry = LtmBm25Index["terms"][string];
  const presentEntries: Array<{ entry: Bm25TermEntry; idf: number }> = [];
  for (const term of queryTerms) {
    const entry = Object.hasOwn(index.terms, term) ? index.terms[term] : undefined;
    if (!entry) continue;
    presentEntries.push({
      entry,
      idf: Math.log(1 + (index.chunkCount - entry.documentFrequency + 0.5) / (entry.documentFrequency + 0.5)),
    });
  }
  const referenceScore = presentEntries
    .map(({ idf }) => idf)
    .sort((left, right) => right - left)
    .slice(0, 8)
    .reduce((total, idf) => total + idf, 0);

  for (const { entry, idf } of presentEntries) {
    const postings = entry.postings.filter(
      (posting) => !options.allowedChunks || options.allowedChunks.has(posting.chunkId),
    );
    for (const posting of options.maxPostingsPerTerm
      ? postings.slice(0, Math.max(1, options.maxPostingsPerTerm))
      : postings) {
      const document = Object.hasOwn(index.documents, posting.chunkId) ? index.documents[posting.chunkId] : undefined;
      if (!document) continue;
      const denominator = posting.count + K1 * (1 - B + B * (document.length / index.avgDocLength));
      const score = idf * ((posting.count * (K1 + 1)) / denominator);
      scores.set(posting.chunkId, (scores.get(posting.chunkId) ?? 0) + score);
    }
  }

  return Array.from(scores.entries())
    .map(([chunkId, score]) => ({
      chunkId,
      score,
      normalizedScore: referenceScore > 0 ? Math.min(1, score / referenceScore) : 0,
    }))
    .sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId))
    .slice(0, maxCandidates);
}
