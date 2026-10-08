import type { LtmMemoryChunk } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { formatLongTermMemoryPromptBullet } from "./prompt.js";
import { formatLtmChunkPromptText } from "./prompt-text.js";
import type { LtmRankedCandidate } from "./ranking.js";

export interface LtmBudgetedChunk {
  chunk: LtmMemoryChunk;
  score: number;
  normalizedScore?: number;
  finalNormalizedScore?: number;
  relevanceScore: number;
  reasons: string[];
  lanes: string[];
  laneScores?: Record<string, number>;
  rawLaneScores?: Record<string, number>;
  fusedRank: number;
  tier: 1 | 2 | 3;
  estimatedTokens: number;
}

export interface LtmBudgetOptions {
  maxChunks: number;
  maxTokens: number;
  relevanceScoreThreshold?: number;
  explain?: boolean;
  rejectedLimit?: number;
  dedupeExactText?: boolean;
  /** Estimate from the serialized bullet text (prompt cost) instead of the raw chunk text. */
  promptNormalizedEstimate?: boolean;
}

export interface LtmBudgetRejectedCandidate {
  chunkId: string;
  noteId?: string;
  sectionKey?: string;
  score: number;
  normalizedScore?: number;
  finalNormalizedScore?: number;
  relevanceScore: number;
  reasons: string[];
  lanes: string[];
  laneScores?: Record<string, number>;
  rawLaneScores?: Record<string, number>;
  fusedRank: number;
  estimatedTokens?: number;
  rejectionReason: "budget" | "lower_rank" | "missing_chunk" | "score_threshold" | "duplicate_text";
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function chunkEstimatedTokens(chunk: LtmMemoryChunk, promptNormalizedEstimate?: boolean) {
  const text = formatLtmChunkPromptText(chunk);
  return estimateTokens(promptNormalizedEstimate ? formatLongTermMemoryPromptBullet(text) : text);
}

function tierFor(chunk: LtmMemoryChunk): 1 | 2 | 3 {
  if (
    chunk.noteType === "tone" ||
    (chunk.noteType === "character" && ["core", "current_state"].includes(chunk.sectionKey))
  ) {
    return 1;
  }

  if (chunk.noteType === "thread" && chunk.status !== "resolved") {
    return 2;
  }

  return 3;
}

function normalizedComparableText(chunk: LtmMemoryChunk) {
  return formatLtmChunkPromptText(chunk).replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function pushRejected(
  rejected: LtmBudgetRejectedCandidate[],
  rejectedLimit: number,
  candidate: LtmRankedCandidate,
  chunk: LtmMemoryChunk | undefined,
  rejectionReason: LtmBudgetRejectedCandidate["rejectionReason"],
  promptNormalizedEstimate?: boolean,
) {
  if (rejected.length >= rejectedLimit) return;
  rejected.push({
    chunkId: candidate.chunkId,
    noteId: chunk?.noteId,
    sectionKey: chunk?.sectionKey,
    score: candidate.score,
    normalizedScore: candidate.normalizedScore,
    finalNormalizedScore: candidate.finalNormalizedScore,
    relevanceScore: candidate.relevanceScore,
    reasons: candidate.reasons,
    lanes: candidate.lanes,
    laneScores: candidate.laneScores,
    rawLaneScores: candidate.rawLaneScores,
    fusedRank: candidate.fusedRank,
    estimatedTokens: chunk ? chunkEstimatedTokens(chunk, promptNormalizedEstimate) : undefined,
    rejectionReason: chunk ? rejectionReason : "missing_chunk",
  });
}

export function applyLtmBudget(
  candidates: LtmRankedCandidate[],
  chunksById: Map<string, LtmMemoryChunk>,
  options: LtmBudgetOptions,
) {
  const selected: LtmBudgetedChunk[] = [];
  const selectedIds = new Set<string>();
  const selectedText = new Set<string>();
  const rejected: LtmBudgetRejectedCandidate[] = [];
  const rejectedLimit = Math.max(0, options.rejectedLimit ?? 20);
  const scoreThreshold = Math.max(0, Math.min(1, options.relevanceScoreThreshold ?? 0));
  let usedTokens = 0;
  let budgetExhausted = false;

  for (const candidate of candidates) {
    const comparableScore = candidate.relevanceScore;
    if (scoreThreshold > 0 && comparableScore < scoreThreshold) {
      if (options.explain && rejected.length < rejectedLimit) {
        const chunk = chunksById.get(candidate.chunkId);
        pushRejected(rejected, rejectedLimit, candidate, chunk, "score_threshold", options.promptNormalizedEstimate);
      }
      continue;
    }

    const chunk = chunksById.get(candidate.chunkId);
    if (!chunk) {
      if (options.explain && rejected.length < rejectedLimit) {
        pushRejected(rejected, rejectedLimit, candidate, chunk, "missing_chunk", options.promptNormalizedEstimate);
      }
      continue;
    }

    if (options.dedupeExactText) {
      const comparableText = normalizedComparableText(chunk);
      if (comparableText && selectedText.has(comparableText)) {
        if (options.explain && rejected.length < rejectedLimit) {
          pushRejected(rejected, rejectedLimit, candidate, chunk, "duplicate_text", options.promptNormalizedEstimate);
        }
        continue;
      }
    }

    if (selected.length >= options.maxChunks) {
      if (options.explain && rejected.length < rejectedLimit) {
        pushRejected(rejected, rejectedLimit, candidate, chunk, "lower_rank", options.promptNormalizedEstimate);
      }
      continue;
    }

    const estimatedTokens = chunkEstimatedTokens(chunk, options.promptNormalizedEstimate);
    if (usedTokens + estimatedTokens > options.maxTokens) {
      budgetExhausted = true;
      if (options.explain && rejected.length < rejectedLimit) {
        pushRejected(rejected, rejectedLimit, candidate, chunk, "budget", options.promptNormalizedEstimate);
      }
      continue;
    }

    selected.push({
      chunk,
      score: candidate.score,
      normalizedScore: candidate.normalizedScore,
      finalNormalizedScore: candidate.finalNormalizedScore,
      relevanceScore: candidate.relevanceScore,
      reasons: candidate.reasons,
      lanes: candidate.lanes,
      laneScores: candidate.laneScores,
      rawLaneScores: candidate.rawLaneScores,
      fusedRank: candidate.fusedRank,
      tier: tierFor(chunk),
      estimatedTokens,
    });
    selectedIds.add(candidate.chunkId);
    const comparableText = normalizedComparableText(chunk);
    if (comparableText) selectedText.add(comparableText);
    usedTokens += estimatedTokens;
  }

  if (options.explain && rejected.length < rejectedLimit) {
    for (const candidate of candidates) {
      if (rejected.length >= rejectedLimit) break;
      if (selectedIds.has(candidate.chunkId)) continue;
      if (rejected.some((item) => item.chunkId === candidate.chunkId)) continue;
      const chunk = chunksById.get(candidate.chunkId);
      pushRejected(rejected, rejectedLimit, candidate, chunk, "lower_rank");
    }
  }

  return {
    chunks: selected.sort((a, b) => a.tier - b.tier || b.score - a.score || a.chunk.id.localeCompare(b.chunk.id)),
    usedTokens,
    maxTokens: options.maxTokens,
    rejected,
    budgetExhausted,
  };
}
