import type { LtmMemoryChunk } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
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
  /** Added with its character's selected section, not ranked in on its own. */
  companion?: true;
}

export interface LtmBudgetOptions {
  /** A count limit on top of the token budget. Recall passes none; extraction's existing-note lookups do. */
  maxChunks?: number;
  maxTokens: number;
  relevanceScoreThreshold?: number;
  explain?: boolean;
  rejectedLimit?: number;
  dedupeExactText?: boolean;
  /** Estimate from the serialized bullet text (prompt cost) instead of the raw chunk text. */
  promptNormalizedEstimate?: boolean;
  /** Event slots already held by recalled memories; the linked pass sets it so seeds keep their places. */
  eventSlotFloor?: number;
  /**
   * The critical character sections of the eligible pool (the same chunks the ranking drew from). When a character
   * note has a selected section and no critical one selected, its highest-salience critical section joins it.
   */
  companionChunks?: readonly LtmMemoryChunk[];
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
  rejectionReason: "budget" | "lower_rank" | "missing_chunk" | "score_threshold" | "duplicate_text" | "type_cap";
}

// Timeline events lead the vector and bm25 lanes and took ~61% of recalled slots, so characters, relationships and
// threads sat below the cut. A quarter of the slots (rounded up, at least 3) may hold events, or a quarter of the
// token budget when there is no count limit; passed-over events come back only when nothing else is left to fill
// the recall.
const EVENT_SLOT_SHARE = 0.25;
const EVENT_SLOT_MINIMUM = 3;

// A death is saved as its own critical `status` section, which a scene's words rarely match, so the AI kept writing
// the character as alive. Recalling any section of a character brings along that note's top critical section.
const STATUS_COMPANION_REASON = "status_companion";

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function chunkEstimatedTokens(chunk: LtmMemoryChunk, promptNormalizedEstimate?: boolean) {
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

function rejectedRow(
  candidate: LtmRankedCandidate,
  chunk: LtmMemoryChunk | undefined,
  rejectionReason: LtmBudgetRejectedCandidate["rejectionReason"],
  promptNormalizedEstimate?: boolean,
): LtmBudgetRejectedCandidate {
  return {
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
  };
}

/** One companion per character note: its top-salience critical section, placed after the note's best-ranked selected section. */
function statusCompanionPlans(selected: readonly LtmBudgetedChunk[], pool: readonly LtmMemoryChunk[] | undefined) {
  if (!pool?.length) return [];
  const selectedIds = new Set(selected.map((item) => item.chunk.id));
  const best = new Map<string, LtmMemoryChunk>();
  const alreadyCritical = new Set<string>();
  for (const chunk of pool) {
    if (chunk.noteType !== "character" || chunk.importance !== "critical") continue;
    if (selectedIds.has(chunk.id)) alreadyCritical.add(chunk.noteId);
    const current = best.get(chunk.noteId);
    const better =
      (chunk.salience ?? 0) - (current?.salience ?? 0) || (current ? current.id.localeCompare(chunk.id) : 1);
    if (better > 0) best.set(chunk.noteId, chunk);
  }
  const anchors = new Map<string, LtmBudgetedChunk>();
  for (const item of selected) {
    if (item.chunk.noteType !== "character" || !best.has(item.chunk.noteId)) continue;
    const current = anchors.get(item.chunk.noteId);
    if (
      !current ||
      item.fusedRank < current.fusedRank ||
      (item.fusedRank === current.fusedRank && item.chunk.id.localeCompare(current.chunk.id) < 0)
    )
      anchors.set(item.chunk.noteId, item);
  }
  return Array.from(anchors, ([noteId, anchor]) => ({ anchor, companion: best.get(noteId)! }))
    .filter(({ anchor }) => !alreadyCritical.has(anchor.chunk.noteId))
    .sort((a, b) => a.anchor.fusedRank - b.anchor.fusedRank || a.anchor.chunk.id.localeCompare(b.anchor.chunk.id));
}

export function applyLtmBudget(
  candidates: LtmRankedCandidate[],
  chunksById: Map<string, LtmMemoryChunk>,
  options: LtmBudgetOptions,
) {
  const selected: LtmBudgetedChunk[] = [];
  const selectedIds = new Set<string>();
  const selectedText = new Set<string>();
  // Every rejection is noted first and the rows are cut to `rejectedLimit` by fused rank at the end, so the nearest
  // misses stay listed even when the linked pass puts its candidates ahead of the rest in walk order.
  const rejectedAll: Array<{
    candidate: LtmRankedCandidate;
    chunk: LtmMemoryChunk | undefined;
    reason: LtmBudgetRejectedCandidate["rejectionReason"];
  }> = [];
  const rejectedLimit = Math.max(0, options.rejectedLimit ?? 20);
  const scoreThreshold = Math.max(0, Math.min(1, options.relevanceScoreThreshold ?? 0));
  const maxChunks = options.maxChunks ?? Infinity;
  const eventCap = Math.max(
    EVENT_SLOT_MINIMUM,
    Number.isFinite(maxChunks) ? Math.ceil(maxChunks * EVENT_SLOT_SHARE) : 0,
    options.eventSlotFloor ?? 0,
  );
  const eventTokenCap = Number.isFinite(maxChunks) ? 0 : options.maxTokens * EVENT_SLOT_SHARE;
  // What cut a memory that ranked in: the count limit when there is one, the token budget otherwise.
  const cutReason = Number.isFinite(maxChunks) ? "lower_rank" : "budget";
  const passedOverEvents: Array<{ candidate: LtmRankedCandidate; chunk: LtmMemoryChunk }> = [];
  let selectedEvents = 0;
  let eventTokens = 0;
  let usedTokens = 0;
  let budgetExhausted = false;

  const selectedCandidates = new Map<string, LtmRankedCandidate>();
  const select = (candidate: LtmRankedCandidate, chunk: LtmMemoryChunk, estimatedTokens: number, companion?: true) => {
    selectedCandidates.set(candidate.chunkId, candidate);
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
      ...(companion ? { companion } : {}),
    });
    selectedIds.add(candidate.chunkId);
    const comparableText = normalizedComparableText(chunk);
    if (comparableText) selectedText.add(comparableText);
    usedTokens += estimatedTokens;
    if (chunk.noteType === "timeline_event") {
      selectedEvents += 1;
      eventTokens += estimatedTokens;
    }
  };

  for (const candidate of candidates) {
    const comparableScore = candidate.relevanceScore;
    if (!candidate.linked && scoreThreshold > 0 && comparableScore < scoreThreshold) {
      if (options.explain)
        rejectedAll.push({ candidate, chunk: chunksById.get(candidate.chunkId), reason: "score_threshold" });
      continue;
    }

    const chunk = chunksById.get(candidate.chunkId);
    if (!chunk) {
      if (options.explain) rejectedAll.push({ candidate, chunk, reason: "missing_chunk" });
      continue;
    }

    if (options.dedupeExactText) {
      const comparableText = normalizedComparableText(chunk);
      if (comparableText && selectedText.has(comparableText)) {
        if (options.explain) rejectedAll.push({ candidate, chunk, reason: "duplicate_text" });
        continue;
      }
    }

    if (selected.length >= maxChunks) {
      if (options.explain) rejectedAll.push({ candidate, chunk, reason: "lower_rank" });
      continue;
    }

    const estimatedTokens = chunkEstimatedTokens(chunk, options.promptNormalizedEstimate);
    if (
      chunk.noteType === "timeline_event" &&
      selectedEvents >= eventCap &&
      eventTokens + estimatedTokens > eventTokenCap
    ) {
      passedOverEvents.push({ candidate, chunk });
      continue;
    }

    if (usedTokens + estimatedTokens > options.maxTokens) {
      budgetExhausted = true;
      if (options.explain) rejectedAll.push({ candidate, chunk, reason: "budget" });
      continue;
    }

    select(candidate, chunk, estimatedTokens);
  }

  // The cap never leaves a slot empty while a passed-over event still fits: free slots go to those events, best rank
  // first. Each event that stays out gets its final reason, so the Debug rows never say "type_cap" for a refill skip.
  let refilled = false;
  const leftOut: Array<{
    candidate: LtmRankedCandidate;
    chunk: LtmMemoryChunk;
    reason: LtmBudgetRejectedCandidate["rejectionReason"];
  }> = [];
  for (const { candidate, chunk } of passedOverEvents) {
    if (selected.length >= maxChunks) {
      // Once the refill used the cap's slots, the memory limit (not the cap) is what keeps the rest out.
      leftOut.push({ candidate, chunk, reason: refilled ? "lower_rank" : "type_cap" });
      continue;
    }
    const comparableText = normalizedComparableText(chunk);
    if (options.dedupeExactText && comparableText && selectedText.has(comparableText)) {
      leftOut.push({ candidate, chunk, reason: "duplicate_text" });
      continue;
    }
    const estimatedTokens = chunkEstimatedTokens(chunk, options.promptNormalizedEstimate);
    if (usedTokens + estimatedTokens > options.maxTokens) {
      budgetExhausted = true;
      leftOut.push({ candidate, chunk, reason: "budget" });
      continue;
    }
    select(candidate, chunk, estimatedTokens);
    refilled = true;
  }
  if (options.explain) rejectedAll.push(...leftOut);

  const anchorByCompanion = new Map<string, string>();
  const companionPlans = statusCompanionPlans(selected, options.companionChunks);
  // An anchor is the section a companion is placed after, so it is never the chunk that makes room for one.
  const anchorIds = new Set(companionPlans.map((plan) => plan.anchor.chunk.id));
  for (const { anchor, companion } of companionPlans) {
    const comparableText = normalizedComparableText(companion);
    if (options.dedupeExactText && comparableText && selectedText.has(comparableText)) continue;
    const estimatedTokens = chunkEstimatedTokens(companion, options.promptNormalizedEstimate);
    // Room comes from the lowest-ranked chunk that is neither a companion, tier 1 nor a character's own critical
    // section (a death another character already holds); linked candidates go first. With none left, no companion.
    const droppable = selected
      .filter(
        (item) =>
          !item.companion &&
          item.tier !== 1 &&
          !anchorIds.has(item.chunk.id) &&
          !(item.chunk.noteType === "character" && item.chunk.importance === "critical"),
      )
      .sort(
        (a, b) =>
          Number(Boolean(selectedCandidates.get(b.chunk.id)?.linked)) -
            Number(Boolean(selectedCandidates.get(a.chunk.id)?.linked)) ||
          b.fusedRank - a.fusedRank ||
          b.chunk.id.localeCompare(a.chunk.id),
      );
    const drops: LtmBudgetedChunk[] = [];
    let count = selected.length;
    let tokens = usedTokens;
    while (count >= maxChunks || tokens + estimatedTokens > options.maxTokens) {
      const drop = droppable[drops.length];
      if (!drop) break;
      drops.push(drop);
      count -= 1;
      tokens -= drop.estimatedTokens;
    }
    if (count >= maxChunks || tokens + estimatedTokens > options.maxTokens) continue;
    for (const drop of drops) {
      selected.splice(selected.indexOf(drop), 1);
      selectedIds.delete(drop.chunk.id);
      usedTokens -= drop.estimatedTokens;
      if (drop.chunk.noteType === "timeline_event") {
        selectedEvents -= 1;
        eventTokens -= drop.estimatedTokens;
      }
      const dropText = normalizedComparableText(drop.chunk);
      if (dropText && !selected.some((item) => normalizedComparableText(item.chunk) === dropText))
        selectedText.delete(dropText);
      const dropCandidate = selectedCandidates.get(drop.chunk.id);
      if (options.explain && dropCandidate)
        rejectedAll.push({ candidate: dropCandidate, chunk: drop.chunk, reason: cutReason });
    }
    // The companion may have been ranked and passed over; it is recalled now, so it leaves the rejected rows.
    const own = candidates.find((candidate) => candidate.chunkId === companion.id);
    const ownRejected = rejectedAll.findIndex((row) => row.candidate.chunkId === companion.id);
    if (ownRejected >= 0) rejectedAll.splice(ownRejected, 1);
    const reason = `${STATUS_COMPANION_REASON}:${anchor.chunk.sectionKey}`;
    select(
      {
        // Below every ranked candidate when the chunk was never ranked.
        chunkId: companion.id,
        score: 0,
        relevanceScore: 0,
        fusedRank: candidates.length + 1,
        // An unranked companion names why it is here where the Debug list shows lanes.
        lanes: [STATUS_COMPANION_REASON],
        ...own,
        reasons: [...(own?.reasons ?? []), reason],
      },
      companion,
      estimatedTokens,
      true,
    );
    anchorByCompanion.set(companion.id, anchor.chunk.id);
  }

  const rejected = rejectedAll
    .sort((a, b) => a.candidate.fusedRank - b.candidate.fusedRank)
    .slice(0, rejectedLimit)
    .map(({ candidate, chunk, reason }) => rejectedRow(candidate, chunk, reason, options.promptNormalizedEstimate));

  const chunks = selected.sort((a, b) => a.tier - b.tier || b.score - a.score || a.chunk.id.localeCompare(b.chunk.id));
  // A companion reads straight after the section it came with.
  for (const [companionId, anchorId] of anchorByCompanion) {
    const from = chunks.findIndex((item) => item.chunk.id === companionId);
    const [companion] = chunks.splice(from, 1);
    chunks.splice(chunks.findIndex((item) => item.chunk.id === anchorId) + 1, 0, companion!);
  }

  return {
    chunks,
    usedTokens,
    maxTokens: options.maxTokens,
    rejected,
    budgetExhausted,
  };
}
