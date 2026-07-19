import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RotateCw, Trash2 } from "lucide-react";
import type {
  LtmDebugEvent,
  LtmLastInjectionResponse,
  LtmNote,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { API_ROOT, invalidateLtmQueries, queryKeys, request } from "./api";
import { Button, StatusSurface } from "./shared-controls";
import type { LongTermMemoryDestinationProps } from "./types";

type DebugLogResponse = { events: LtmDebugEvent[] };

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString();
}

function humanizeDebugText(text: string, noteTitles: ReadonlyMap<string, string>) {
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
  const activity = useQuery({
    queryKey: queryKeys.activity,
    queryFn: () => request<DebugLogResponse>("/debug-log?limit=200"),
  });
  const notes = useQuery({
    queryKey: queryKeys.notes,
    queryFn: () => request<LtmNote[]>("/notes?includeGlobal=true"),
  });
  const noteTitles = new Map(
    (notes.data ?? []).map((note) => [note.id, note.title || "Untitled memory"]),
  );
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
          <h2 className="text-sm font-semibold">Activity</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Recent processing, recall, and maintenance diagnostics.
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
        <StatusSurface>No activity has been recorded yet.</StatusSurface>
      ) : null}
      {activity.data?.events.length ? (
        <ol className="space-y-2" aria-label="Long-Term Memory activity log">
          {activity.data.events.map((event) => (
            <li
              key={event.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/25 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold">
                  {event.phase} / {event.action}
                </span>
                <span
                  className={
                    event.status === "error"
                      ? "text-[var(--destructive)]"
                      : "text-[var(--muted-foreground)]"
                  }
                >
                  {event.status}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed">
                {describeEvent(event, noteTitles)}
              </p>
              {event.sourceNoteId && noteTitles.has(event.sourceNoteId) ? (
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                  Source memory: {noteTitles.get(event.sourceNoteId)}
                </p>
              ) : null}
              <p className="mt-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                {formatTimestamp(event.ts)}
                {event.durationMs != null ? ` | ${event.durationMs} ms` : ""}
              </p>
              {event.diagnostics?.length ? (
                <details className="mt-2 text-xs text-[var(--muted-foreground)]">
                  <summary className="cursor-pointer">
                    Diagnostics ({event.diagnostics.length})
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded bg-[var(--background)] p-2 text-[0.6875rem]">
                    {humanizeDebugText(
                       JSON.stringify(event.diagnostics, null, 2),
                       noteTitles,
                     )}
                  </pre>
                </details>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
