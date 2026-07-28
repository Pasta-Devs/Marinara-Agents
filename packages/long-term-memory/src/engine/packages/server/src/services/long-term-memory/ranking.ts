export interface LtmRankedCandidate {
  chunkId: string;
  score: number;
  normalizedScore?: number;
  finalNormalizedScore?: number;
  relevanceScore: number;
  reasons: string[];
  lanes: string[];
  laneScores?: Record<string, number>;
  rawLaneScores?: Record<string, number>;
  cooldownPenalty?: number;
}

export interface LtmRankLaneItem {
  chunkId: string;
  reason: string;
  rawScore?: number;
}

export interface LtmRankLane {
  name: string;
  weight: number;
  items: LtmRankLaneItem[];
}

export type LtmRankCooldown = {
  chunkId: string;
  penalty: number;
  reason: string;
};

const RRF_K = 60;

export function reciprocalRankFuse(lanes: LtmRankLane[], options: { cooldowns?: LtmRankCooldown[] } = {}) {
  const candidates = new Map<string, LtmRankedCandidate>();

  for (const lane of lanes) {
    if (lane.weight <= 0) continue;

    const rawScores = lane.items
      .map((item) => item.rawScore)
      .filter((score): score is number => typeof score === "number" && Number.isFinite(score) && score > 0);
    const topRawScore = rawScores.length > 0 ? Math.max(...rawScores) : 0;

    lane.items.forEach((item, index) => {
      const rank = index + 1;
      const rawScore = typeof item.rawScore === "number" && Number.isFinite(item.rawScore) ? item.rawScore : 0;
      const normalizedRawScore = lane.name === "bm25"
        ? rawScore / (rawScore + 1)
        : Math.max(0, Math.min(1, rawScore));
      const rawFactor = typeof item.rawScore === "number" ? normalizedRawScore : 1;
      const score = lane.weight * (1 / (RRF_K + rank)) * rawFactor;
      const rawScoreBoost = rawScore * 0.001 * lane.weight;
      const candidate =
        candidates.get(item.chunkId) ??
        ({
          chunkId: item.chunkId,
          score: 0,
          relevanceScore: 0,
          reasons: [],
          lanes: [],
          laneScores: {},
          rawLaneScores: {},
        } satisfies LtmRankedCandidate);
      candidate.score += score + rawScoreBoost;
      candidate.normalizedScore = Math.max(candidate.normalizedScore ?? 0, normalizedRawScore);
      candidate.relevanceScore = Math.max(
        candidate.relevanceScore,
        normalizedRawScore * lane.weight,
      );
      candidate.laneScores ??= {};
      candidate.rawLaneScores ??= {};
      candidate.laneScores[lane.name] = (candidate.laneScores[lane.name] ?? 0) + score + rawScoreBoost;
      if (typeof item.rawScore === "number") {
        candidate.rawLaneScores[lane.name] = Math.max(candidate.rawLaneScores[lane.name] ?? 0, item.rawScore);
      }
      candidate.reasons.push(item.reason);
      if (normalizedRawScore > 0) {
        candidate.reasons.push(`${lane.name}:normalized:${normalizedRawScore.toFixed(3)}`);
      }
      if (!candidate.lanes.includes(lane.name)) candidate.lanes.push(lane.name);
      candidates.set(item.chunkId, candidate);
    });
  }

  const cooldowns = new Map(options.cooldowns?.map((cooldown) => [cooldown.chunkId, cooldown]) ?? []);
  for (const candidate of candidates.values()) {
    const cooldown = cooldowns.get(candidate.chunkId);
    if (!cooldown) continue;
    candidate.cooldownPenalty = cooldown.penalty;
    candidate.score *= cooldown.penalty;
    candidate.reasons.push(cooldown.reason);
  }

  const ranked = Array.from(candidates.values()).sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId));
  const topScore = ranked[0]?.score ?? 0;
  for (const candidate of ranked) {
    const finalNormalizedScore = topScore > 0 ? candidate.score / topScore : 0;
    candidate.finalNormalizedScore = finalNormalizedScore;
  }

  return ranked;
}
