export const NOODLE_FINISHED_REFRESH_RUN_RETENTION_LIMIT = 100;

type RefreshRunRetentionRecord = {
  id: string;
  status: string;
  createdAt: string;
};

type RefreshRunRetentionStore<TRow extends RefreshRunRetentionRecord> = {
  list: () => Promise<TRow[]>;
  replace: (rows: TRow[]) => Promise<void>;
  touch: (row: TRow) => Promise<void>;
  flush: () => Promise<void>;
};

export function selectNoodleRefreshRunIdsToPrune(
  rows: readonly RefreshRunRetentionRecord[],
  limit = NOODLE_FINISHED_REFRESH_RUN_RETENTION_LIMIT,
): string[] {
  return rows
    .filter((row) => row.status === "completed" || row.status === "failed")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))
    .slice(Math.max(0, limit))
    .map((row) => row.id);
}

export async function pruneNoodleRefreshRuns<TRow extends RefreshRunRetentionRecord>(
  store: RefreshRunRetentionStore<TRow>,
): Promise<void> {
  const rows = await store.list();
  const staleIds = new Set(selectNoodleRefreshRunIdsToPrune(rows));
  if (staleIds.size === 0) return;

  const retained = rows
    .filter((row) => !staleIds.has(row.id))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
  await store.replace(retained);
  await store.flush();

  // The file store copies the previous primary to .bak before each write. A
  // second write makes both snapshots contain the retained table.
  const newest = retained[0];
  if (!newest) return;
  await store.touch(newest);
  await store.flush();
}
