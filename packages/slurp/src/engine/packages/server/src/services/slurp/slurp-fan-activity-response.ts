export function normalizeSlurpFanActivityRows(
  value: unknown,
  creatorAccountIdByPostId: ReadonlyMap<string, string> = new Map(),
): { rows: Record<string, unknown>[]; rejected: number } {
  if (!value || typeof value !== "object") return { rows: [], rejected: 0 };
  const activities = Array.isArray(value) ? value : (value as { activities?: unknown }).activities;
  if (!Array.isArray(activities)) return { rows: [], rejected: 0 };
  const rows = activities.flatMap((activity) => {
    if (!activity || typeof activity !== "object" || Array.isArray(activity)) return [];
    const row = activity as Record<string, unknown>;
    const targetPostId = row.targetPostId ?? row.postId ?? row.targetId;
    return [
      {
        ...row,
        actorHandle: row.actorHandle ?? row.actor,
        creatorAccountId:
          row.creatorAccountId ??
          row.creatorId ??
          (typeof targetPostId === "string" ? creatorAccountIdByPostId.get(targetPostId) : undefined),
        targetPostId,
        content: row.content ?? null,
      },
    ];
  });
  return { rows, rejected: activities.length - rows.length };
}
