import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronRight,
  Copy,
  Download,
  RotateCw,
  Trash2,
} from "lucide-react";
import type {
  LtmDebugEvent,
  LtmLastInjectionResponse,
  LtmNote,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { API_ROOT, invalidateLtmQueries, queryKeys, request, requestAllNotes } from "./api";
import { Button, InfoPopover, StatusSurface } from "./shared-controls";
import { humanizeLabel } from "./display-labels";
import type { LongTermMemoryDestinationProps } from "./types";
import { LastInjectionSummary } from "./LastInjectionSummary";

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

const actionLabels: Record<string, string> = {
  evidence_unit_response: "AI extraction",
  evidence_unit_json_parse: "Read extraction result",
  recall_explanation: "Memory recall",
};

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString();
}

function humanizeDebugText(
  text: string,
  noteTitles: ReadonlyMap<string, string>,
) {
  const ids = [...noteTitles.keys()].sort((left, right) => right.length - left.length);
  const escaped = ids.map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = [...escaped, "\\b[0-9a-f]{8}-[0-9a-f-]{27,}\\b"].join("|");
  return text.replace(new RegExp(pattern, "gi"), (id) => noteTitles.get(id) ?? "an internal record");
}

function describeEvent(
  event: LtmDebugEvent,
  noteTitles: ReadonlyMap<string, string>,
) {
  if (event.error) return humanizeDebugText(event.error.message, noteTitles);
  if (event.message) return humanizeDebugText(event.message, noteTitles);
  if (event.uiSummary) return humanizeDebugText(event.uiSummary, noteTitles);
  const summary = event.details?.summary;
  if (typeof summary === "string")
    return humanizeDebugText(summary, noteTitles);
  const reason = event.details?.reason;
  if (typeof reason === "string")
    return `${actionLabel(event.action)}: ${humanizeLabel(reason)}.`;
  return `${actionLabel(event.action)}: ${humanizeLabel(event.status)}.`;
}

function compactSummary(value: string) {
  const singleLine = value.replaceAll(/\s+/g, " ").trim();
  return singleLine.length > 240
    ? `${singleLine.slice(0, 237)}...`
    : singleLine;
}

function actionLabel(action: string) {
  return actionLabels[action] ?? humanizeLabel(action);
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
    counts,
    ...metadata
  } = event;
  const visibleCounts = Object.fromEntries(
    Object.entries(counts ?? {}).filter(([label]) => !/chars$/i.test(label)),
  );
  return Object.keys(visibleCounts).length
    ? { ...metadata, counts: visibleCounts }
    : metadata;
}

function summarizeCounts(events: LtmDebugEvent[]) {
  const counts = new Map<string, number>();
  for (const event of events)
    for (const [label, count] of Object.entries(event.counts ?? {}))
      counts.set(label, count);
  if (!counts.size) return "";
  const summary: string[] = [];
  const promptTokens = counts.get("promptTokens");
  const responseTokens =
    counts.get("completionTokens") ?? counts.get("responseTokens");
  if (promptTokens != null)
    summary.push(`Prompt: ${promptTokens.toLocaleString()} Tokens`);
  if (responseTokens != null)
    summary.push(`Response: ${responseTokens.toLocaleString()} Tokens`);
  summary.push(
    ...[...counts.entries()]
      .filter(
        ([label]) =>
          !/chars$/i.test(label) &&
          label !== "promptTokens" &&
          label !== "completionTokens" &&
          label !== "responseTokens",
      )
      .slice(0, 3 - summary.length)
      .map(
        ([label, count]) =>
          `${count.toLocaleString()} ${humanizeLabel(label).toLowerCase()}`,
      ),
  );
  return summary.join(" | ");
}

function latestRecallEvent(events: LtmDebugEvent[], chatId?: string) {
  return events
    .filter(
      (event) =>
        event.phase === "retrieval" &&
        event.action === "recall_explanation" &&
        (!chatId ||
          event.chatId === chatId ||
          event.details?.chatId === chatId),
    )
    .sort((left, right) => right.ts.localeCompare(left.ts))[0];
}

function recallDetails(event: LtmDebugEvent | undefined) {
  const details = event?.details;
  return details && typeof details === "object" && !Array.isArray(details)
    ? details
    : null;
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
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [recallOpen, setRecallOpen] = useState(false);
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
  const recallActivity = useQuery({
    queryKey: [...queryKeys.activity, "recall-workflow"],
    enabled: recallOpen && filter !== "all",
    queryFn: () =>
      request<DebugLogResponse>("/debug-log?limit=200&phase=retrieval"),
  });
  const notes = useQuery({
    queryKey: queryKeys.notes,
    queryFn: () => requestAllNotes<LtmNote>("/notes?includeGlobal=true"),
  });
  const noteTitles = new Map(
    (notes.data ?? []).map((note) => [
      note.id,
      note.title || "Untitled memory",
    ]),
  );
  const operations = groupOperations(activity.data?.events ?? []);
  const recallEvents =
    filter === "all"
      ? (activity.data?.events ?? [])
      : (recallActivity.data?.events ?? []);
  const recallLoading =
    filter === "all" ? activity.isLoading : recallActivity.isLoading;
  const recallError =
    filter === "all" ? activity.isError : recallActivity.isError;
  const recallEvent = latestRecallEvent(recallEvents, props.chatId);
  const recallWorkflow = recallDetails(recallEvent) as {
    maxChunks?: number;
    maxTokens?: number;
    scoreThreshold?: number;
    weights?: Record<string, number>;
    selected?: Array<Record<string, unknown>>;
    rejected?: Array<Record<string, unknown>>;
  } | null;
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
      await invalidateLtmQueries(queryClient, [
        queryKeys.activity,
        [...queryKeys.activity, "recall-workflow"],
      ]);
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
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not export activity.",
      );
    } finally {
      setPending(null);
    }
  };

  const copyJson = async (eventId: string, metadata: object) => {
    setActionError("");
    const text = JSON.stringify(metadata, null, 2);
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      // Fall through to the legacy mobile-safe copy path.
    }
    if (!copied) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "-9999px";
      document.body.appendChild(textarea);
      try {
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        if (!document.execCommand("copy")) throw new Error("Copy failed");
        copied = true;
      } catch {
        copied = false;
      } finally {
        textarea.remove();
      }
    }
    if (!copied) {
      setActionError("Could not copy technical details.");
      return;
    }
    setCopiedEventId(eventId);
    window.setTimeout(
      () =>
        setCopiedEventId((current) => (current === eventId ? null : current)),
      2_000,
    );
  };

  return (
    <section data-ltm-surface="activity" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="flex items-center gap-1 text-xs font-semibold">
            Debug Activity
            <InfoPopover
              label="Debug Activity"
              content="Trace imports, extraction, draft actions, recall, and maintenance."
            />
          </h4>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={activity.isFetching || recallActivity.isFetching}
            onClick={() =>
              void (filter === "all" || !recallOpen
                ? activity.refetch()
                : Promise.all([activity.refetch(), recallActivity.refetch()]))
            }
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
        <LastInjectionSummary
          data={lastInjection.data}
          loading={lastInjection.isLoading}
          error={lastInjection.isError}
          onOpenMemory={onOpenMemory}
        />
      ) : null}

      <details
        data-ltm-recall-workflow
        className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30"
        onToggle={(event) => setRecallOpen(event.currentTarget.open)}
      >
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-xs font-semibold">
          <span>Latest recall workflow</span>
          {recallEvent?.counts ? (
            <span className="shrink-0 text-[0.6875rem] font-normal text-[var(--muted-foreground)]">
              {recallEvent.counts.selected ?? 0} selected ·{" "}
              {recallEvent.counts.rejected ?? 0} rejected
            </span>
          ) : null}
        </summary>
        <div className="space-y-3 border-t border-[var(--border)] px-3 py-3 text-xs">
          {recallLoading ? (
            <StatusSurface busy>Loading recall workflow.</StatusSurface>
          ) : recallError ? (
            <StatusSurface tone="danger">
              The recall workflow could not load.
            </StatusSurface>
          ) : !recallEvent || !recallWorkflow ? (
            <p className="text-[var(--muted-foreground)]">
              No recall workflow has been recorded. Enable debug activity to
              record future recalls.
            </p>
          ) : (
            <>
              <div className="grid gap-1 text-[var(--muted-foreground)] sm:grid-cols-2">
                <span>Recent context was used for recall.</span>
                <span>
                  Limits: {String(recallWorkflow.maxChunks ?? "--")} chunks ·{" "}
                  {Number(recallWorkflow.maxTokens ?? 0).toLocaleString()}{" "}
                  tokens
                </span>
                <span>
                  Threshold: {String(recallWorkflow.scoreThreshold ?? 0)}
                </span>
                <span>
                  Used: {(recallEvent.counts?.usedTokens ?? 0).toLocaleString()}{" "}
                  tokens
                </span>
              </div>
              {recallWorkflow.weights ? (
                <p className="text-[var(--muted-foreground)]">
                  Weights:{" "}
                  {Object.entries(recallWorkflow.weights)
                    .map(([name, value]) => `${humanizeLabel(name)} ${value}`)
                    .join(" · ")}
                </p>
              ) : null}
              {recallWorkflow.selected?.length ? (
                <div>
                  <h4 className="mb-1 font-semibold">Selected chunks</h4>
                  <ul className="space-y-1 text-[var(--muted-foreground)]">
                    {recallWorkflow.selected.map((candidate, index) => {
                      const noteId =
                        typeof candidate.noteId === "string"
                          ? candidate.noteId
                          : undefined;
                      const score =
                        typeof candidate.score === "number"
                          ? candidate.score
                          : undefined;
                      return (
                        <li
                          key={`${noteId ?? "candidate"}-${index}`}
                          className="flex flex-wrap justify-between gap-2 rounded bg-[var(--background)] px-2 py-1"
                        >
                          <span>
                            {noteId && noteTitles.get(noteId)
                              ? noteTitles.get(noteId)
                              : (noteId ?? "Unknown memory")}{" "}
                            · {String(candidate.sectionKey ?? "chunk")}
                          </span>
                          <span>
                            Relevance:{" "}
                            {score == null
                              ? "--"
                              : `${Math.round(score * 100)}%`}{" "}
                            ·{" "}
                            {Array.isArray(candidate.lanes)
                              ? candidate.lanes.join(", ")
                              : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              {recallWorkflow.rejected?.length ? (
                <div>
                  <h4 className="mb-1 font-semibold">Rejected candidates</h4>
                  <ul className="space-y-1 text-[var(--muted-foreground)]">
                    {recallWorkflow.rejected.map((candidate, index) => {
                      const noteId =
                        typeof candidate.noteId === "string"
                          ? candidate.noteId
                          : undefined;
                      const score =
                        typeof candidate.score === "number"
                          ? candidate.score
                          : undefined;
                      return (
                        <li
                          key={`${noteId ?? "candidate"}-${index}`}
                          className="flex flex-wrap justify-between gap-2 rounded bg-[var(--background)] px-2 py-1"
                        >
                          <span>
                            {noteId && noteTitles.get(noteId)
                              ? noteTitles.get(noteId)
                              : (noteId ?? "Unknown memory")}{" "}
                            · {String(candidate.sectionKey ?? "chunk")}
                          </span>
                          <span>
                            Relevance:{" "}
                            {score == null
                              ? "--"
                              : `${Math.round(score * 100)}%`}{" "}
                            ·{" "}
                            {humanizeLabel(
                              String(candidate.rejectionReason ?? "rejected"),
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      </details>

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
                          {actionLabel(firstEvent.action)}
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
                              {actionLabel(event.action)}
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
                            <details className="mt-2 rounded bg-[var(--background)]">
                              <summary className="min-h-11 cursor-pointer px-2 py-3 font-medium">
                                Technical details
                              </summary>
                              <div className="border-t border-[var(--border)] p-2">
                                <Button
                                  className="mb-2"
                                  aria-label={`Copy raw JSON for ${actionLabel(event.action)}`}
                                  onClick={() =>
                                    void copyJson(event.id, metadata)
                                  }
                                >
                                  {copiedEventId === event.id ? (
                                    <Check aria-hidden="true" size="0.875rem" />
                                  ) : (
                                    <Copy aria-hidden="true" size="0.875rem" />
                                  )}
                                  {copiedEventId === event.id
                                    ? "Copied"
                                    : "Copy JSON"}
                                </Button>
                                <pre className="overflow-x-auto text-[0.6875rem] text-[var(--muted-foreground)]">
                                  {humanizeDebugText(
                                    JSON.stringify(metadata, null, 2),
                                    noteTitles,
                                  )}
                                </pre>
                              </div>
                            </details>
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
