import type { LtmScope } from "../../../../shared/src/features/agents/long-term-memory/schema.js";

export type LtmSourceTaskKind = "import" | "refresh" | "re-extract";

export type LtmSourceTaskContract = {
  source: "characters" | "lorebooks" | "chats";
  sourceIds: string[];
  action: LtmSourceTaskKind;
  sourceScope?: LtmScope;
  destinationScope?: LtmScope;
  mode?: "conversation" | "roleplay" | "game";
  chatId?: string;
  sourceTargetLabel?: string;
  destinationTargetLabel?: string;
  selectionKey?: string;
};

type SafeTaskResult = {
  batchStatus?: string;
  operationId?: string;
  counts?: Record<string, number>;
  items?: Array<{
    sourceId: string;
    title: string;
    status?: string;
    retryable?: boolean;
    noteId?: string;
    diagnostics?: Array<{ code?: string; message?: string }>;
    error?: { code?: string; message?: string };
  }>;
  writeFailures?: Array<{
    sourceId: string;
    title: string;
    sourceWriteStatus: string;
    extractionStatus: string;
    retryable: boolean;
    error: { code?: string; message?: string };
  }>;
  missingSourceIds?: string[];
  error?: { code: string; message: string };
};

export type LtmSourceTask = {
  id: string;
  kind: LtmSourceTaskKind;
  contract: LtmSourceTaskContract;
  sourceCount: number;
  sourceTitles: string[];
  startedAt: string;
  finishedAt?: string;
  viewedAt?: string;
  status: "running" | "completed" | "failed" | "cancelled";
  result?: unknown;
  safeResult?: SafeTaskResult;
  error?: { code: string; message: string };
};

export type LtmSourceTaskSnapshot = {
  active: LtmSourceTask | null;
  latest: LtmSourceTask | null;
};

const STORAGE_KEY = "marinara-long-term-memory-source-task-v1";
const MAX_ITEMS = 100;
const listeners = new Set<() => void>();
const controllerByTask = new Map<string, AbortController>();

function sessionStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function notify() {
  for (const listener of listeners) listener();
}

function safeTaskResult(kind: LtmSourceTaskKind, response: unknown): SafeTaskResult {
  if (!response || typeof response !== "object") return {};
  const value = response as Record<string, unknown>;
  const imported = Array.isArray(value.imported) ? value.imported : [];
  const items = imported.slice(0, MAX_ITEMS).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const diagnostics = Array.isArray(row.diagnostics)
      ? row.diagnostics.slice(0, 20).flatMap((diagnostic) => {
          if (!diagnostic || typeof diagnostic !== "object") return [];
          const value = diagnostic as Record<string, unknown>;
          return [
            {
              ...(typeof value.code === "string" ? { code: value.code } : {}),
              ...(typeof value.message === "string" ? { message: value.message } : {}),
            },
          ];
        })
      : [];
    const error =
      row.error && typeof row.error === "object"
        ? {
            ...(typeof (row.error as Record<string, unknown>).code === "string"
              ? { code: (row.error as Record<string, unknown>).code as string }
              : {}),
            ...(typeof (row.error as Record<string, unknown>).message === "string"
              ? { message: (row.error as Record<string, unknown>).message as string }
              : {}),
          }
        : undefined;
    return typeof row.sourceId === "string" && typeof row.title === "string"
      ? [
          {
            sourceId: row.sourceId,
            title: row.title,
            ...(typeof row.extractionStatus === "string" ? { status: row.extractionStatus } : {}),
            ...(typeof row.retryable === "boolean" ? { retryable: row.retryable } : {}),
            ...(row.note && typeof row.note === "object" && typeof (row.note as Record<string, unknown>).id === "string"
              ? { noteId: (row.note as Record<string, unknown>).id as string }
              : {}),
            ...(diagnostics.length ? { diagnostics } : {}),
            ...(error && (error.code || error.message) ? { error } : {}),
          },
        ]
      : [];
  });
  const writeFailures = Array.isArray(value.writeFailures)
    ? value.writeFailures.slice(0, MAX_ITEMS).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const error = row.error;
        if (
          typeof row.sourceId !== "string" ||
          typeof row.title !== "string" ||
          typeof row.sourceWriteStatus !== "string" ||
          typeof row.extractionStatus !== "string" ||
          typeof row.retryable !== "boolean" ||
          !error ||
          typeof error !== "object"
        )
          return [];
        const errorValue = error as Record<string, unknown>;
        return [
          {
            sourceId: row.sourceId,
            title: row.title,
            sourceWriteStatus: row.sourceWriteStatus,
            extractionStatus: row.extractionStatus,
            retryable: row.retryable,
            error: {
              ...(typeof errorValue.code === "string" ? { code: errorValue.code } : {}),
              ...(typeof errorValue.message === "string" ? { message: errorValue.message } : {}),
            },
          },
        ];
      })
    : [];
  const counts =
    value.counts && typeof value.counts === "object"
      ? (Object.fromEntries(
          Object.entries(value.counts as Record<string, unknown>).filter(
            ([key, count]) => typeof count === "number" && Number.isSafeInteger(count) && key.length <= 80,
          ),
        ) as Record<string, number>)
      : undefined;
  return {
    ...(typeof value.batchStatus === "string" ? { batchStatus: value.batchStatus } : {}),
    ...(typeof value.operationId === "string" ? { operationId: value.operationId } : {}),
    ...(counts && Object.keys(counts).length ? { counts } : {}),
    ...(items.length ? { items } : {}),
    ...(writeFailures.length ? { writeFailures } : {}),
    ...(Array.isArray(value.missingSourceIds)
      ? {
          missingSourceIds: value.missingSourceIds
            .filter((id): id is string => typeof id === "string")
            .slice(0, MAX_ITEMS),
        }
      : {}),
    ...(kind === "re-extract" && value.outcome && typeof value.outcome === "object"
      ? {
          counts: {
            ...(counts ?? {}),
            ...(typeof (value.outcome as Record<string, unknown>).totalCandidates === "number"
              ? { totalCandidates: (value.outcome as Record<string, unknown>).totalCandidates as number }
              : {}),
            ...(typeof (value.outcome as Record<string, unknown>).keptUnits === "number"
              ? { keptUnits: (value.outcome as Record<string, unknown>).keptUnits as number }
              : {}),
          },
        }
      : {}),
  };
}

function restoreLatest(): LtmSourceTask | null {
  const storage = sessionStorage();
  if (!storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null") as LtmSourceTask | null;
    if (!parsed || typeof parsed !== "object" || !parsed.id || !parsed.contract) return null;
    if (parsed.status === "running") {
      return {
        ...parsed,
        status: "cancelled",
        finishedAt: new Date().toISOString(),
        error: {
          code: "interrupted",
          message: "",
        },
      };
    }
    return parsed;
  } catch {
    return null;
  }
}

let snapshot: LtmSourceTaskSnapshot = { active: null, latest: restoreLatest() };

function persist(task: LtmSourceTask) {
  const storage = sessionStorage();
  if (!storage) return;
  try {
    const { result: _result, ...safeTask } = task;
    storage.setItem(STORAGE_KEY, JSON.stringify(safeTask));
  } catch {}
}

function update(task: LtmSourceTask) {
  snapshot = { active: task, latest: task };
  persist(task);
  notify();
}

export function subscribeLtmSourceTask(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLtmSourceTaskSnapshot() {
  return snapshot;
}

export function cancelLtmSourceTask() {
  const task = snapshot.active;
  if (task?.status === "running") controllerByTask.get(task.id)?.abort();
}

export function markLtmSourceTaskViewed(id: string) {
  const latest = snapshot.latest;
  if (!latest || latest.id !== id || latest.viewedAt) return;
  const viewed = { ...latest, viewedAt: new Date().toISOString() };
  snapshot = {
    active: snapshot.active?.id === id ? viewed : snapshot.active,
    latest: viewed,
  };
  persist(viewed);
  notify();
}

export function startLtmSourceTask<T>(options: {
  kind: LtmSourceTaskKind;
  contract: LtmSourceTaskContract;
  sourceTitles: string[];
  run: (signal: AbortSignal) => Promise<T>;
}) {
  if (snapshot.active?.status === "running") throw new Error("A Long-Term Memory source task is already running.");
  const id = `ltm-source-task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const controller = new AbortController();
  const task: LtmSourceTask = {
    id,
    kind: options.kind,
    contract: structuredClone(options.contract),
    sourceCount: options.contract.sourceIds.length,
    sourceTitles: options.sourceTitles.slice(0, MAX_ITEMS),
    startedAt: new Date().toISOString(),
    status: "running",
  };
  controllerByTask.set(id, controller);
  update(task);
  return (async () => {
    try {
      const result = await options.run(controller.signal);
      const completed: LtmSourceTask = {
        ...task,
        finishedAt: new Date().toISOString(),
        status: "completed",
        result,
        safeResult: safeTaskResult(options.kind, result),
      };
      update(completed);
      return completed;
    } catch (error) {
      const cancelled = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
      const failed: LtmSourceTask = {
        ...task,
        finishedAt: new Date().toISOString(),
        status: cancelled ? "cancelled" : "failed",
        error: {
          code: cancelled ? "cancelled" : "source_task_failed",
          message: cancelled ? "" : error instanceof Error ? error.message : "",
        },
      };
      update(failed);
      return failed;
    } finally {
      controllerByTask.delete(id);
    }
  })();
}
