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
