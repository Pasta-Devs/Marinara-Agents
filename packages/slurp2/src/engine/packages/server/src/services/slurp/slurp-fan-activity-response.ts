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
    const type = row.type ?? row.kind ?? row.action;
    return [
      {
        ...row,
        actorHandle: row.actorHandle ?? row.actor,
        creatorAccountId:
          row.creatorAccountId ??
          row.creatorId ??
          (typeof targetPostId === "string" ? creatorAccountIdByPostId.get(targetPostId) : undefined),
        targetPostId,
        type: type === "comment" ? "reply" : type,
        content: row.content ?? row.text ?? row.comment ?? null,
        // Kept as a plain field rather than added to the shared generated-activity schema, which
        // this package cannot change. `parseGeneratedFanActivityResponse` reads it back off the
        // normalised row after the schema has stripped it.
        parentInteractionId:
          typeof row.parentInteractionId === "string"
            ? row.parentInteractionId
            : typeof row.replyToInteractionId === "string"
              ? row.replyToInteractionId
              : null,
      },
    ];
  });
  return { rows, rejected: activities.length - rows.length };
}
