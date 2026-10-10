import type {
  LtmBm25Index,
  LtmBm25Posting,
  LtmMemoryChunk,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { isHangulToken, stripHangulParticle } from "./hangul-lexical.js";

const TOKEN_PATTERN = /[\p{L}\p{N}_]+/gu;
const K1 = 1.2;
const B = 0.75;

/**
 * Tokenizes recall text for BM25.
 *
 * Issue #1295: Korean attaches particles to the noun (`반지를`) and sometimes
 * drops the space inside a compound (`그림선물`), so a plain Unicode split cannot
 * match `반지` or `그림 선물`. Hangul tokens additionally emit a
 * particle-stripped stem and an adjacent-Hangul bigram; the alias only adds a
 * match when the query uses the other surface form.
 *
 * `tokens` carries the aliases for matching, while `originalCount` counts only
 * the tokens actually written in the text, so synthetic aliases cannot inflate
 * BM25 length normalization (which would also perturb alias-free languages).
 */
export function tokenizeLtmText(text: string) {
  const lowered = text.toLocaleLowerCase();
  const matches = Array.from(lowered.matchAll(TOKEN_PATTERN));
  const tokens: string[] = [];
  let originalCount = 0;
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]!;
    const token = match[0];
    if (token.length <= 1) continue;
    tokens.push(token);
    originalCount += 1;

    const stem = stripHangulParticle(token);
    if (stem !== token && stem.length > 1) tokens.push(stem);

    const next = matches[index + 1];
    if (!next || !isHangulToken(token) || !isHangulToken(next[0])) continue;
    const gap = lowered.slice(match.index! + token.length, next.index);
    if (!/^\s*$/u.test(gap)) continue;
    tokens.push(`${token}${next[0]}`);
  }
  return { tokens, originalCount };
}

export function buildLtmBm25Index(chunks: LtmMemoryChunk[]): LtmBm25Index {
  const documents = new Map<string, LtmBm25Index["documents"][string]>();
  const termBuckets = new Map<string, LtmBm25Posting[]>();
  let totalLength = 0;

  for (const chunk of chunks) {
    const { tokens, originalCount } = tokenizeLtmText(chunk.text);
    totalLength += originalCount;
    documents.set(chunk.id, { length: originalCount });

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
  const queryTerms = new Set(tokenizeLtmText(query).tokens);
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
  const referenceEntries = presentEntries.sort((left, right) => right.idf - left.idf).slice(0, 8);
  const referenceScore = referenceEntries.reduce((total, { idf }) => total + idf, 0);

  // Issue #1264 (CodeRabbit): summing every present term let a chunk that only shares
  // common words reach the reference. Each chunk instead keeps its 16 strongest term
  // contributions, so a memory matching a ninth-ranked term still scores.
  const contributions = new Map<string, number[]>();
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
      const list = contributions.get(posting.chunkId) ?? [];
      list.push(score);
      contributions.set(posting.chunkId, list);
    }
  }
  for (const [chunkId, list] of contributions) {
    scores.set(
      chunkId,
      list
        .sort((a, b) => b - a)
        .slice(0, 16)
        .reduce((total, score) => total + score, 0),
    );
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
