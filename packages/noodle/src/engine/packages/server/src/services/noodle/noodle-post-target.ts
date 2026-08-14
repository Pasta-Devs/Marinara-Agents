export interface NoodleTimelinePostTargetRange {
  minimum: number;
  maximum: number;
}

function normalizePostCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * Give the model enough fallback output budget for every selected account that can author a post.
 * Provider/model clamps and an explicit connection override are still applied by the caller.
 */
export function noodleTimelineRefreshMaxTokens(
  selectedAuthorCount: number,
): number {
  return 4096 + normalizePostCount(selectedAuthorCount) * 1024;
}

/**
 * Scale the normal generation target with the selected non-persona authors while leaving room for
 * a natural feed. The configured maximum remains the independently enforced hard ceiling.
 */
export function noodleTimelinePostTargetRange(
  selectedAuthorCount: number,
  maximumPostsPerRefresh: number,
): NoodleTimelinePostTargetRange {
  const maximum = Math.min(
    normalizePostCount(selectedAuthorCount),
    normalizePostCount(maximumPostsPerRefresh),
  );
  if (maximum === 0) return { minimum: 0, maximum: 0 };
  return {
    minimum: Math.max(
      1,
      Math.min(maximum - 1, Math.ceil((maximum * 2) / 3)),
    ),
    maximum,
  };
}

export function noodleTimelinePostTargetInstruction(
  selectedAuthorCount: number,
  maximumPostsPerRefresh: number,
): string {
  const target = noodleTimelinePostTargetRange(
    selectedAuthorCount,
    maximumPostsPerRefresh,
  );
  let amount: string;
  if (target.maximum === 0) {
    amount = "create no new posts";
  } else if (target.minimum === target.maximum) {
    amount = `aim for ${target.maximum} posts across the selected non-persona accounts`;
  } else {
    amount = `aim for ${target.minimum}-${target.maximum} posts across the selected non-persona accounts, varying naturally within that range`;
  }
  return `Normal target: ${amount}. Generate only the interactions that fit current activity. The configured post quota is a hard safety ceiling, not a slot count to fill.`;
}
