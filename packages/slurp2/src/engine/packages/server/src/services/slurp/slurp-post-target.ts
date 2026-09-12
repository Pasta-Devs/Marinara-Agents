export interface NoodleTimelinePostTargetRange {
  minimum: number;
  maximum: number;
}

function normalizedCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function noodleTimelineRefreshMaxTokens(selectedAuthorCount: number) {
  return 4096 + normalizedCount(selectedAuthorCount) * 1024;
}

export function noodleTimelinePostTargetRange(
  selectedAuthorCount: number,
  maximumPostsPerRefresh: number,
): NoodleTimelinePostTargetRange {
  const maximum = Math.min(normalizedCount(selectedAuthorCount), normalizedCount(maximumPostsPerRefresh));
  if (maximum === 0) return { minimum: 0, maximum: 0 };
  return {
    minimum: Math.max(1, Math.min(maximum - 1, Math.ceil((maximum * 2) / 3))),
    maximum,
  };
}

export function noodleTimelinePostTargetInstruction(selectedAuthorCount: number, maximumPostsPerRefresh: number) {
  const target = noodleTimelinePostTargetRange(selectedAuthorCount, maximumPostsPerRefresh);
  const amount =
    target.maximum === 0
      ? "create no new posts"
      : target.minimum === target.maximum
        ? `aim for ${target.maximum} posts across the selected non-persona accounts`
        : `aim for ${target.minimum}-${target.maximum} posts across the selected non-persona accounts, varying naturally within that range`;
  return `Normal target: ${amount}. Generate only the interactions that fit current activity. The configured post quota is a hard safety ceiling, not a slot count to fill.`;
}
