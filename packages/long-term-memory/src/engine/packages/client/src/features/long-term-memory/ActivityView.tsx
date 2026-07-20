import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Download, RotateCw, Trash2 } from "lucide-react";
import type {
  LtmDebugEvent,
  LtmLastInjectionResponse,
  LtmNote,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { API_ROOT, invalidateLtmQueries, queryKeys, request } from "./api";
import { Button, StatusSurface } from "./shared-controls";
import type { LongTermMemoryDestinationProps } from "./types";

type DebugLogResponse = { events: LtmDebugEvent[] };
type DebugOperation = { operationId: string; events: LtmDebugEvent[] };
type ActivityFilter = "all" | "errors" | LtmDebugEvent["phase"];

const debugPhases: LtmDebugEvent["phase"][] = [
  "import",
  "source_note",
  "extraction",
  "llm",
  "compiler",
  "draft",
  "apply",
  "injection",
  "retrieval",
  "rebuild",
  "repair",
  "replay",
  "diagnostic",
];

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString();
}

function humanizeDebugText(
  text: string,
  noteTitles: ReadonlyMap<string, string>,
) {
  let result = text;
  for (const [id, title] of noteTitles) result = result.replaceAll(id, title);
  return result.replaceAll(
    /\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi,
    "an internal record",
  );
}

function describeEvent(
  event: LtmDebugEvent,
  noteTitles: ReadonlyMap<string, string>,
) {
  if (event.error) return humanizeDebugText(event.error.message, noteTitles);
  if (event.message) return humanizeDebugText(event.message, noteTitles);
  if (event.uiSummary) return humanizeDebugText(event.uiSummary, noteTitles);
  return "No message recorded.";
}

function compactSummary(value: string) {
  const singleLine = value.replaceAll(/\s+/g, " ").trim();
  return singleLine.length > 240
    ? `${singleLine.slice(0, 237)}...`
    : singleLine;
}

function humanizeLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function groupOperations(events: LtmDebugEvent[]): DebugOperation[] {
  const operations = new Map<string, LtmDebugEvent[]>();
  for (const event of events) {
    const operation = operations.get(event.operationId) ?? [];
    operation.push(event);
    operations.set(event.operationId, operation);
  }
  return [...operations.entries()]
    .map(([operationId, operationEvents]) => ({
      operationId,
      events: operationEvents.sort((left, right) =>
        left.ts.localeCompare(right.ts),
      ),
    }))
    .sort((left, right) =>
      right.events.at(-1)!.ts.localeCompare(left.events.at(-1)!.ts),
    );
}

function operationStatus(events: LtmDebugEvent[]) {
  const started = events.find((event) => event.status === "started");
  const terminal = started
    ? events.findLast(
        (event) =>
          event.phase === started.phase &&
          event.action === started.action &&
          event.status !== "started",
      )
    : events.at(-1);
  const status = terminal?.status ?? (started ? "started" : "warning");
  if (status === "ok" && events.some((event) => event.status === "warning")) {
    return { status: "warning", label: "Completed with warnings" } as const;
  }
  return {
    status,
    label: {
      started: "Running",
      ok: "Completed",
      skipped: "Skipped",
      warning: "Warning",
      error: "Failed",
    }[status],
  };
}

function eventMetadata(event: LtmDebugEvent) {
  const {
    id: _id,
    ts: _ts,
    phase: _phase,
    action: _action,
    status: _status,
    message: _message,
    uiSummary: _uiSummary,
    ...metadata
  } = event;
  return metadata;
}

function summarizeCounts(events: LtmDebugEvent[]) {
  const counts = events.findLast((event) => event.counts)?.counts;
  if (!counts) return "";
  return Object.entries(counts)
    .slice(0, 3)
    .map(
      ([label, count]) =>
        `${count.toLocaleString()} ${humanizeLabel(label).toLowerCase()}`,
    )
    .join(" | ");
}

async function confirm(
  props: LongTermMemoryDestinationProps["props"],
  title: string,
  message: string,
  confirmLabel: string,
) {
  if (props.confirmAction)
    return props.confirmAction({
      title,
      message,
      confirmLabel,
      tone: "destructive",
    });
  return window.confirm(`${title}\n\n${message}`);
}

export default function ActivityView({
  props,
  onOpenMemory,
}: LongTermMemoryDestinationProps) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<"clear" | "export" | null>(null);
  const [actionError, setActionError] = useState("");
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const activityPath = (() => {
    const parameters = new URLSearchParams({ limit: "200" });
    if (filter === "errors") parameters.set("status", "error");
    else if (filter !== "all") parameters.set("phase", filter);
    return `/debug-log?${parameters.toString()}`;
  })();
  const activity = useQuery({
    queryKey: [...queryKeys.activity, filter],
    queryFn: () => request<DebugLogResponse>(activityPath),
  });
  const notes = useQuery({
    queryKey: queryKeys.notes,
    queryFn: () => request<LtmNote[]>("/notes?includeGlobal=true"),
  });
  const noteTitles = new Map(
    (notes.data ?? []).map((note) => [
      note.id,
      note.title || "Untitled memory",
    ]),
  );
  const operations = groupOperations(activity.data?.events ?? []);
  const lastInjection = useQuery({
    enabled: Boolean(props.chatId),
    queryKey: queryKeys.lastInjection(props.chatId),
    queryFn: () =>
      request<LtmLastInjectionResponse>(
        `/last-injection/${encodeURIComponent(props.chatId!)}`,
      ),
  });

  const clear = async () => {
    if (
      !(await confirm(
        props,
        "Clear activity log?",
        "This permanently removes the recorded Long-Term Memory debug events.",
        "Clear log",
      ))
    )
      return;
    setPending("clear");
    setActionError("");
    try {
      await request<unknown>("/debug-log", "DELETE");
      await invalidateLtmQueries(queryClient, [queryKeys.activity]);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not clear activity.",
      );
    } finally {
      setPending(null);
    }
  };

  const exportLog = async () => {
    setPending("export");
    setActionError("");
    try {
      const response = await fetch(`${API_ROOT}/debug-log/export`, {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(response.statusText || "Could not export activity.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ltm-debug-log.jsonl";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not export activity.",
      );
    } finally {
      setPending(null);
    }
  };

  return (
    <section data-ltm-surface="activity" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Debug</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Trace imports, extraction, draft actions, recall, and maintenance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={activity.isFetching}
            onClick={() => void activity.refetch()}
          >
            <RotateCw aria-hidden="true" size="0.875rem" /> Refresh
          </Button>
          <Button disabled={pending !== null} onClick={() => void exportLog()}>
            <Download aria-hidden="true" size="0.875rem" /> Export
          </Button>
          <Button
            destructive
            disabled={pending !== null}
            onClick={() => void clear()}
          >
            <Trash2 aria-hidden="true" size="0.875rem" /> Clear
          </Button>
        </div>
      </div>

      <label className="block max-w-xs space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
        <span>Show events</span>
        <select
          className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[var(--foreground)]"
          value={filter}
          onChange={(event) => setFilter(event.target.value as ActivityFilter)}
        >
          <option value="all">All phases</option>
          <option value="errors">Errors only</option>
          {debugPhases.map((phase) => (
            <option key={phase} value={phase}>
              {humanizeLabel(phase)}
            </option>
          ))}
        </select>
      </label>

      {props.chatId ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30 p-3">
          <h3 className="text-xs font-semibold">
            Last recall for {props.chatName ?? "this chat"}
          </h3>
          {lastInjection.isLoading ? (
            <StatusSurface busy>Loading recalled memories.</StatusSurface>
          ) : null}
          {lastInjection.isError ? (
            <StatusSurface tone="danger">
              The last recall could not load.
            </StatusSurface>
          ) : null}
          {lastInjection.data ? (
            <div className="mt-2 space-y-2 text-xs text-[var(--muted-foreground)]">
              <p>
                {lastInjection.data.memoryCount} memories,{" "}
                {lastInjection.data.tokenCount.toLocaleString()} tokens.
              </p>
              {lastInjection.data.memories.length ? (
                <ul className="space-y-1">
                  {lastInjection.data.memories.map((memory) => (
                    <li
                      key={memory.noteId}
                      className="rounded bg-[var(--background)] px-2 py-1"
                    >
                      <button
                        type="button"
                        data-ltm-recalled-note={memory.noteId}
                        className="min-h-11 text-left text-[var(--primary)] underline underline-offset-2"
                        onClick={() => onOpenMemory?.(memory.noteId)}
                      >
                        {memory.title} ({memory.tokenCount.toLocaleString()}{" "}
                        tokens)
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {actionError ? (
        <StatusSurface tone="danger">{actionError}</StatusSurface>
      ) : null}
      {activity.isLoading ? (
        <StatusSurface busy>Loading activity.</StatusSurface>
      ) : null}
      {activity.isError ? (
        <StatusSurface tone="danger">
          Could not load activity.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void activity.refetch()}
          >
            Retry
          </button>
        </StatusSurface>
      ) : null}
      {activity.data?.events.length === 0 ? (
        <StatusSurface>
          {filter === "all"
            ? "No activity has been recorded yet."
            : "No activity matches this filter."}
        </StatusSurface>
      ) : null}
      {operations.length ? (
        <ol className="space-y-2" aria-label="Long-Term Memory activity log">
          {operations.map((operation) => {
            const firstEvent = operation.events[0];
            const lastEvent = operation.events.at(-1)!;
            const status = operationStatus(operation.events);
            const sourceNoteId = operation.events.find(
              (event) => event.sourceNoteId,
            )?.sourceNoteId;
            const countSummary = summarizeCounts(operation.events);
            return (
              <li
                key={operation.operationId}
                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/25"
              >
                <details className="group">
                  <summary className="flex min-h-11 cursor-pointer list-none items-start gap-2 p-3 marker:content-none">
                    <ChevronRight
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 transition-transform group-open:rotate-90"
                      size="1rem"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold">
                          {humanizeLabel(firstEvent.action)}
                        </span>
                        <span
                          className={
                            status.status === "error"
                              ? "text-[var(--destructive)]"
                              : "text-[var(--muted-foreground)]"
                          }
                        >
                          {status.label}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
                        {sourceNoteId && noteTitles.has(sourceNoteId)
                          ? noteTitles.get(sourceNoteId)
                          : compactSummary(
                              describeEvent(lastEvent, noteTitles),
                            )}
                      </span>
                      <span className="mt-1 block text-[0.6875rem] text-[var(--muted-foreground)]">
                        {formatTimestamp(lastEvent.ts)}
                        {lastEvent.durationMs != null
                          ? ` | ${lastEvent.durationMs.toLocaleString()} ms`
                          : ""}
                        {countSummary ? ` | ${countSummary}` : ""}
                      </span>
                    </span>
                  </summary>
                  <ol className="space-y-2 border-t border-[var(--border)] px-3 py-3">
                    {operation.events.map((event) => {
                      const metadata = eventMetadata(event);
                      return (
                        <li
                          key={event.id}
                          className="border-l-2 border-[var(--border)] pl-3 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">
                              {humanizeLabel(event.phase)} /{" "}
                              {humanizeLabel(event.action)}
                            </span>
                            <span
                              className={
                                event.status === "error"
                                  ? "text-[var(--destructive)]"
                                  : "text-[var(--muted-foreground)]"
                              }
                            >
                              {operationStatus([event]).label}
                            </span>
                          </div>
                          <p className="mt-1 leading-relaxed">
                            {describeEvent(event, noteTitles)}
                          </p>
                          <p className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]">
                            {formatTimestamp(event.ts)}
                            {event.durationMs != null
                              ? ` | ${event.durationMs.toLocaleString()} ms`
                              : ""}
                          </p>
                          {Object.keys(metadata).length ? (
                            <pre className="mt-2 overflow-x-auto rounded bg-[var(--background)] p-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                              {humanizeDebugText(
                                JSON.stringify(metadata, null, 2),
                                noteTitles,
                              )}
                            </pre>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                </details>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
