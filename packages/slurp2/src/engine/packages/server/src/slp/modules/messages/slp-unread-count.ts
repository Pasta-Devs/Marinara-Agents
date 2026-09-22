type SlpUnreadThreadRow = {
  viewerAccountId: unknown;
  creatorAccountId: unknown;
  state?: unknown;
  creatorExists?: boolean;
  viewerUnread: unknown;
  creatorUnread: unknown;
};

const unread = (value: unknown): number => {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
};

/** Count both inbox seats without hydrating threads or their related records. */
export function countSlurpUnreadThreads(
  rows: readonly SlpUnreadThreadRow[],
  viewerAccountId: string,
  operatedCreatorAccountIds: readonly string[],
): { unread: number; inboundUnread: number } {
  const operated = new Set(operatedCreatorAccountIds);
  let viewerUnread = 0;
  let creatorUnread = 0;
  for (const row of rows) {
    if (row.state === "declined" || row.creatorExists === false) continue;
    const rowViewerId = String(row.viewerAccountId);
    const rowCreatorId = String(row.creatorAccountId);
    if (rowViewerId === viewerAccountId) viewerUnread += unread(row.viewerUnread);
    // A conversation with the persona's own Creator belongs to the viewer seat only. This mirrors
    // listThreadsForCreators, which excludes it from the inbound side of the full inbox.
    if (operated.has(rowCreatorId) && !operated.has(rowViewerId)) creatorUnread += unread(row.creatorUnread);
  }
  return { unread: viewerUnread, inboundUnread: creatorUnread };
}
