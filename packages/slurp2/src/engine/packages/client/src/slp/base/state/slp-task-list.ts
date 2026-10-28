/** The Pulse task list's one rule (task B), pure: newest first, one row per id, a day of history, 50 rows. */
export const SLP_TASKS_MAX = 50;
export const SLP_TASKS_KEEP_MS = 24 * 60 * 60_000;

export function slpPutTask<T extends { id: string; status: string; finishedAt?: number }>(
  tasks: readonly T[],
  task: T,
  now: number,
): T[] {
  const cutoff = now - SLP_TASKS_KEEP_MS;
  const others = tasks.filter(
    (entry) => entry.id !== task.id && (entry.status === "running" || (entry.finishedAt ?? 0) >= cutoff),
  );
  return [task, ...others].slice(0, SLP_TASKS_MAX);
}

/**
 * What survives a reload: finished tasks of the last day, 50 at most, as plain data. A running task
 * died with its tab, and "Open" / "Try again" are functions of that tab, so neither is kept.
 */
export function slpStoredTasks<T extends { status: string; finishedAt?: number; open?: unknown; retry?: unknown }>(
  tasks: readonly T[],
  now: number,
): Omit<T, "open" | "retry">[] {
  const cutoff = now - SLP_TASKS_KEEP_MS;
  return tasks
    .filter((task) => task.status !== "running" && (task.finishedAt ?? 0) >= cutoff)
    .slice(0, SLP_TASKS_MAX)
    .map(({ open: _open, retry: _retry, ...task }) => task);
}

/** The screen a task kind starts from, for a failed task restored after a reload (its Try again died with the tab). */
export type SlpTaskAgainScreen = "stir" | "generate" | "creator" | "add";

/**
 * Where "Start it again from …" goes for a restored failed task: Stir for plays and plans, the
 * Generate posts picker, the Creator's page for Run now and picture draws, Add Creators for a
 * sign-up. Null for a kind with no screen (the row keeps its reason only) or a Creator task without one.
 */
export function slpTaskAgainScreen(task: { kind: string; accountIds?: readonly string[] }): SlpTaskAgainScreen | null {
  switch (task.kind) {
    case "stir-play":
    case "stir-plan":
      return "stir";
    case "generate-posts":
      return "generate";
    case "auto-post":
    case "generate-post-image":
      return task.accountIds?.[0] ? "creator" : null;
    case "sign-up":
      return "add";
    default:
      return null;
  }
}
