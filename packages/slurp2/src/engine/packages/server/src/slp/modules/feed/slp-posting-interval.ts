const DAY_MS = 24 * 60 * 60 * 1000;

export function slurpCreatorPostingIntervalMs(postsPerDay: number): number {
  return DAY_MS / postsPerDay;
}

/** Return true when an existing post or active slot is too close to a candidate slot. */
export function hasSlurpCreatorPostingIntervalConflict(
  activityTimes: number[],
  candidatePublishAt: number,
  postsPerDay: number,
): boolean {
  const interval = slurpCreatorPostingIntervalMs(postsPerDay);
  return activityTimes.some((activityAt) => Math.abs(candidatePublishAt - activityAt) < interval);
}

/**
 * Posts per day for one Creator's own spacing, at the pace the player set for them (see
 * `SLP_STEERING_PACE_FACTOR`). A busier Creator may post again sooner, a quieter one waits longer.
 * A break (factor 0) is handled by the reserve, which gives that Creator no slot at all.
 */
export function slurpPacedPostsPerDay(postsPerDay: number, factor: number): number {
  return Math.min(96, Math.max(1, Math.round(postsPerDay * (factor > 0 ? factor : 1))));
}

/**
 * Who gets the next open slot: the Creator whose last post or slot lies furthest back, with the gap
 * scaled by their pace, so a busier Creator is picked more often and a quieter one less. A slot
 * already held in the future counts as activity at its time, so whoever was given a slot last goes
 * to the back of the line (every Creator holds a slot ahead most of the time; clamping those to
 * "no wait" made every Creator tie, and the old id tie-break then gave one Creator every spare
 * slot). Never-posted Creators go first. Real ties are broken at random, never by id.
 */
export function slurpPickCreatorForSlot<T extends { id: string }>(
  candidates: readonly T[],
  lastActivity: (candidate: T) => number,
  pace: (candidate: T) => number,
  at: number,
  random: () => number = Math.random,
): T | undefined {
  const score = (candidate: T) => {
    const last = lastActivity(candidate);
    if (last <= 0) return Number.MAX_SAFE_INTEGER / 4;
    const gap = at - last;
    // A higher pace always raises the score: a past gap grows, a future one (a held slot) shrinks.
    return gap >= 0 ? gap * pace(candidate) : gap / pace(candidate);
  };
  const scored = candidates
    .filter((candidate) => pace(candidate) > 0)
    .map((candidate) => ({ candidate, score: score(candidate) }));
  const best = Math.max(...scored.map((entry) => entry.score));
  const tied = scored.filter((entry) => entry.score === best);
  return tied[Math.floor(random() * tied.length)]?.candidate;
}
