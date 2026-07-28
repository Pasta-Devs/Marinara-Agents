import { useMemo, useState } from "react";
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
import {
  API_ROOT,
  invalidateLtmQueries,
  queryKeys,
  request,
  requestAllNotes,
} from "./api";
import {
  Button,
  InfoPopover,
  StatusSurface,
  inputClass,
} from "./shared-controls";
import { humanizeLabel } from "./display-labels";
import type { LongTermMemoryDestinationProps } from "./types";
import { LastInjectionSummary } from "./LastInjectionSummary";
import { useLtmTranslation, type LtmTranslationFunction } from "./localization";

type DebugLogResponse = { events: LtmDebugEvent[] };
type DebugOperation = { operationId: string; events: LtmDebugEvent[] };
type ActivityFilter = "all" | "errors" | LtmDebugEvent["phase"];
type DebugTextLookup = {
  pattern: RegExp;
  titlesByNormalizedId: ReadonlyMap<string, string>;
};

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

const actionLabelKeys: Record<string, string> = {
  evidence_unit_response: "ui.longTermMemory.activityview.actionAiExtraction",
  evidence_unit_json_parse:
    "ui.longTermMemory.activityview.actionReadExtractionResult",
  recall_explanation: "ui.longTermMemory.activityview.actionMemoryRecall",
};

function formatTimestamp(timestamp: string, locale: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString(locale);
}

function humanizeDebugText(
  text: string,
  lookup: DebugTextLookup,
  internalRecordLabel: string,
) {
  return text.replace(lookup.pattern, (id) => {
    return (
      lookup.titlesByNormalizedId.get(id.toLowerCase()) ?? internalRecordLabel
    );
  });
}

function describeEvent(
  event: LtmDebugEvent,
  debugTextLookup: DebugTextLookup,
  localizeUi: LtmTranslationFunction,
) {
  const internalRecordLabel = localizeUi(
    "ui.longTermMemory.activityview.anInternalRecord",
  );
  if (event.error)
    return humanizeDebugText(
      event.error.message,
      debugTextLookup,
      internalRecordLabel,
    );
  if (event.message)
    return humanizeDebugText(
      event.message,
      debugTextLookup,
      internalRecordLabel,
    );
  if (event.uiSummary)
    return humanizeDebugText(
      event.uiSummary,
      debugTextLookup,
      internalRecordLabel,
    );
  const summary = event.details?.summary;
  if (typeof summary === "string")
    return humanizeDebugText(summary, debugTextLookup, internalRecordLabel);
  const reason = event.details?.reason;
  if (typeof reason === "string")
    return localizeUi("ui.longTermMemory.activityview.eventDescription", {
      action: actionLabel(event.action, localizeUi),
      detail: humanizeLabel(reason),
    });
  return localizeUi("ui.longTermMemory.activityview.eventDescription", {
    action: actionLabel(event.action, localizeUi),
    detail: humanizeLabel(event.status),
  });
}

function compactSummary(value: string) {
  const singleLine = value.replaceAll(/\s+/g, " ").trim();
  return singleLine.length > 240
    ? `${singleLine.slice(0, 237)}...`
    : singleLine;
}

function actionLabel(action: string, localizeUi: LtmTranslationFunction) {
  const key = actionLabelKeys[action];
  return key ? localizeUi(key) : humanizeLabel(action);
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

function operationStatus(
  events: LtmDebugEvent[],
  localizeUi: LtmTranslationFunction,
) {
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
    return {
      status: "warning",
      label: localizeUi("ui.longTermMemory.activityview.completedWithWarnings"),
    } as const;
  }
  return {
    status,
    label: {
      started: localizeUi("ui.longTermMemory.activityview.running"),
      ok: localizeUi("ui.longTermMemory.activityview.completed"),
      skipped: localizeUi("ui.longTermMemory.activityview.skipped"),
      warning: localizeUi("ui.longTermMemory.activityview.warning"),
      error: localizeUi("ui.longTermMemory.activityview.failed"),
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

function summarizeCounts(
  events: LtmDebugEvent[],
  localizeUi: LtmTranslationFunction,
  locale: string,
) {
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
    summary.push(
      localizeUi("ui.longTermMemory.activityview.promptTokens", {
        count: promptTokens.toLocaleString(locale),
      }),
    );
  if (responseTokens != null)
    summary.push(
      localizeUi("ui.longTermMemory.activityview.responseTokens", {
        count: responseTokens.toLocaleString(locale),
      }),
    );
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
      .map(([label, count]) =>
        localizeUi("ui.longTermMemory.activityview.countWithLabel", {
          count: count.toLocaleString(locale),
          label: humanizeLabel(label).toLocaleLowerCase(locale),
        }),
      ),
  );
  return summary.join(" | ");
}

function latestRecallEvent(events: LtmDebugEvent[], chatId?: string | null) {
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
  const { t: localizeUi, locale } = useLtmTranslation();
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
  const noteTitles = useMemo(
    () =>
      new Map(
        (notes.data ?? []).map((note) => [
          note.id,
          note.title ||
            localizeUi("ui.longTermMemory.activityview.untitledMemory"),
        ]),
      ),
    [localizeUi, notes.data],
  );
  const debugTextLookup = useMemo<DebugTextLookup>(() => {
    const titlesByNormalizedId = new Map(
      [...noteTitles].map(([id, title]) => [id.toLowerCase(), title]),
    );
    const escapedIds = [...titlesByNormalizedId.keys()]
      .sort((left, right) => right.length - left.length)
      .map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return {
      titlesByNormalizedId,
      pattern: new RegExp(
        [...escapedIds, "\\b[0-9a-f]{8}-[0-9a-f-]{27,}\\b"].join("|"),
        "gi",
      ),
    };
  }, [noteTitles]);
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
        localizeUi("ui.longTermMemory.activityview.clearActivityLog"),
        localizeUi(
          "ui.longTermMemory.activityview.clearActivityLogDescription",
        ),
        localizeUi("ui.longTermMemory.activityview.clearLog"),
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
        error instanceof Error
          ? error.message
          : localizeUi("ui.longTermMemory.activityview.couldNotClearActivity"),
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
        throw new Error(
          response.statusText ||
            localizeUi("ui.longTermMemory.activityview.couldNotExportActivity"),
        );
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
        error instanceof Error
          ? error.message
          : localizeUi("ui.longTermMemory.activityview.couldNotExportActivity"),
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
        if (!document.execCommand("copy"))
          throw new Error(
            localizeUi("ui.longTermMemory.activityview.copyFailed"),
          );
        copied = true;
      } catch {
        copied = false;
      } finally {
        textarea.remove();
      }
    }
    if (!copied) {
      setActionError(
        localizeUi(
          "ui.longTermMemory.activityview.couldNotCopyTechnicalDetails",
        ),
      );
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
            {localizeUi("ui.longTermMemory.activityview.debugActivity")}
            <InfoPopover
              label={localizeUi("ui.longTermMemory.activityview.debugActivity")}
              content={localizeUi(
                "ui.longTermMemory.activityview.traceImportsExtractionDraftActionsRecallAndMaintenance",
              )}
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
            <RotateCw aria-hidden="true" size="0.875rem" />{" "}
            {localizeUi("ui.longTermMemory.activityview.refresh")}
          </Button>
          <Button disabled={pending !== null} onClick={() => void exportLog()}>
            <Download aria-hidden="true" size="0.875rem" />{" "}
            {localizeUi("ui.longTermMemory.activityview.export")}
          </Button>
          <Button
            destructive
            disabled={pending !== null}
            onClick={() => void clear()}
          >
            <Trash2 aria-hidden="true" size="0.875rem" />{" "}
            {localizeUi("ui.longTermMemory.activityview.clear")}
          </Button>
        </div>
      </div>

      <label className="block max-w-xs space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
        <span>{localizeUi("ui.longTermMemory.activityview.showEvents")}</span>
        <select
          className={inputClass}
          value={filter}
          onChange={(event) => setFilter(event.target.value as ActivityFilter)}
        >
          <option value="all">
            {localizeUi("ui.longTermMemory.activityview.allPhases")}
          </option>
          <option value="errors">
            {localizeUi("ui.longTermMemory.activityview.errorsOnly")}
          </option>
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
          <span>
            {localizeUi("ui.longTermMemory.activityview.latestRecallWorkflow")}
          </span>
          {recallEvent?.counts ? (
            <span className="shrink-0 text-[0.6875rem] font-normal text-[var(--muted-foreground)]">
              {recallEvent.counts.selected ?? 0}{" "}
              {localizeUi("ui.longTermMemory.activityview.selected")}{" "}
              {recallEvent.counts.rejected ?? 0}{" "}
              {localizeUi("ui.longTermMemory.activityview.rejected")}
            </span>
          ) : null}
        </summary>
        <div className="space-y-3 border-t border-[var(--border)] px-3 py-3 text-xs">
          {recallLoading ? (
            <StatusSurface busy>
              {localizeUi(
                "ui.longTermMemory.activityview.loadingRecallWorkflow",
              )}
            </StatusSurface>
          ) : recallError ? (
            <StatusSurface tone="danger">
              {localizeUi(
                "ui.longTermMemory.activityview.theRecallWorkflowCouldNotLoad",
              )}
            </StatusSurface>
          ) : !recallEvent || !recallWorkflow ? (
            <p className="text-[var(--muted-foreground)]">
              {localizeUi(
                "ui.longTermMemory.activityview.noRecallWorkflowHasBeenRecordedEnableDebugActivity",
              )}
            </p>
          ) : (
            <>
              <div className="grid gap-1 text-[var(--muted-foreground)] sm:grid-cols-2">
                <span>
                  {localizeUi(
                    "ui.longTermMemory.activityview.recentContextWasUsedForRecall",
                  )}
                </span>
                <span>
                  {localizeUi("ui.longTermMemory.activityview.limits")}{" "}
                  {String(recallWorkflow.maxChunks ?? "--")}{" "}
                  {localizeUi("ui.longTermMemory.activityview.chunks")}{" "}
                  {Number(recallWorkflow.maxTokens ?? 0).toLocaleString(locale)}{" "}
                  {localizeUi("ui.longTermMemory.activityview.tokens")}
                </span>
                <span>
                  {localizeUi("ui.longTermMemory.activityview.threshold")}{" "}
                  {String(recallWorkflow.scoreThreshold ?? 0)}
                </span>
                <span>
                  {localizeUi("ui.longTermMemory.activityview.used")}{" "}
                  {(recallEvent.counts?.usedTokens ?? 0).toLocaleString(locale)}{" "}
                  {localizeUi("ui.longTermMemory.activityview.tokens")}
                </span>
              </div>
              {recallWorkflow.weights ? (
                <p className="text-[var(--muted-foreground)]">
                  {localizeUi("ui.longTermMemory.activityview.weights")}{" "}
                  {Object.entries(recallWorkflow.weights)
                    .map(([name, value]) => `${humanizeLabel(name)} ${value}`)
                    .join(" · ")}
                </p>
              ) : null}
              {recallWorkflow.selected?.length ? (
                <div>
                  <h4 className="mb-1 font-semibold">
                    {localizeUi(
                      "ui.longTermMemory.activityview.selectedChunks",
                    )}
                  </h4>
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
                              : (noteId ??
                                localizeUi(
                                  "ui.longTermMemory.activityview.unknownMemory",
                                ))}{" "}
                            · {String(candidate.sectionKey ?? "chunk")}
                          </span>
                          <span>
                            {localizeUi(
                              "ui.longTermMemory.activityview.relevance",
                            )}{" "}
                            {score == null
                              ? "--"
                              : localizeUi(
                                  "ui.longTermMemory.activityview.value1",
                                  { value1: Math.round(score * 100) },
                                )}{" "}
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
                  <h4 className="mb-1 font-semibold">
                    {localizeUi(
                      "ui.longTermMemory.activityview.rejectedCandidates",
                    )}
                  </h4>
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
                              : (noteId ??
                                localizeUi(
                                  "ui.longTermMemory.activityview.unknownMemory",
                                ))}{" "}
                            · {String(candidate.sectionKey ?? "chunk")}
                          </span>
                          <span>
                            {localizeUi(
                              "ui.longTermMemory.activityview.relevance",
                            )}{" "}
                            {score == null
                              ? "--"
                              : localizeUi(
                                  "ui.longTermMemory.activityview.value1",
                                  { value1: Math.round(score * 100) },
                                )}{" "}
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
        <StatusSurface busy>
          {localizeUi("ui.longTermMemory.activityview.loadingActivity")}
        </StatusSurface>
      ) : null}
      {activity.isError ? (
        <StatusSurface tone="danger">
          {localizeUi("ui.longTermMemory.activityview.couldNotLoadActivity")}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void activity.refetch()}
          >
            {localizeUi("ui.longTermMemory.activityview.retry")}
          </button>
        </StatusSurface>
      ) : null}
      {activity.data?.events.length === 0 ? (
        <StatusSurface>
          {filter === "all"
            ? localizeUi(
                "ui.longTermMemory.activityview.noActivityHasBeenRecordedYet",
              )
            : localizeUi(
                "ui.longTermMemory.activityview.noActivityMatchesThisFilter",
              )}
        </StatusSurface>
      ) : null}
      {operations.length ? (
        <ol
          className="space-y-2"
          aria-label={localizeUi(
            "ui.longTermMemory.activityview.longTermMemoryActivityLog",
          )}
        >
          {operations.map((operation) => {
            const firstEvent = operation.events[0];
            const lastEvent = operation.events.at(-1)!;
            const status = operationStatus(operation.events, localizeUi);
            const sourceNoteId = operation.events.find(
              (event) => event.sourceNoteId,
            )?.sourceNoteId;
            const countSummary = summarizeCounts(
              operation.events,
              localizeUi,
              locale,
            );
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
                          {actionLabel(firstEvent.action, localizeUi)}
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
                              describeEvent(
                                lastEvent,
                                debugTextLookup,
                                localizeUi,
                              ),
                            )}
                      </span>
                      <span className="mt-1 block text-[0.6875rem] text-[var(--muted-foreground)]">
                        {formatTimestamp(lastEvent.ts, locale)}
                        {lastEvent.durationMs != null
                          ? localizeUi(
                              "ui.longTermMemory.activityview.value1Ms",
                              {
                                value1:
                                  lastEvent.durationMs.toLocaleString(locale),
                              },
                            )
                          : ""}
                        {countSummary
                          ? localizeUi(
                              "ui.longTermMemory.activityview.value1_9a93137",
                              { value1: countSummary },
                            )
                          : ""}
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
                              {actionLabel(event.action, localizeUi)}
                            </span>
                            <span
                              className={
                                event.status === "error"
                                  ? "text-[var(--destructive)]"
                                  : "text-[var(--muted-foreground)]"
                              }
                            >
                              {operationStatus([event], localizeUi).label}
                            </span>
                          </div>
                          <p className="mt-1 leading-relaxed">
                            {describeEvent(event, debugTextLookup, localizeUi)}
                          </p>
                          <p className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]">
                            {formatTimestamp(event.ts, locale)}
                            {event.durationMs != null
                              ? localizeUi(
                                  "ui.longTermMemory.activityview.value1Ms",
                                  {
                                    value1:
                                      event.durationMs.toLocaleString(locale),
                                  },
                                )
                              : ""}
                          </p>
                          {Object.keys(metadata).length ? (
                            <details className="mt-2 rounded bg-[var(--background)]">
                              <summary className="min-h-11 cursor-pointer px-2 py-3 font-medium">
                                {localizeUi(
                                  "ui.longTermMemory.activityview.technicalDetails",
                                )}
                              </summary>
                              <div className="border-t border-[var(--border)] p-2">
                                <Button
                                  className="mb-2"
                                  aria-label={localizeUi(
                                    "ui.longTermMemory.activityview.copyRawJsonForValue1",
                                    {
                                      value1: actionLabel(
                                        event.action,
                                        localizeUi,
                                      ),
                                    },
                                  )}
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
                                    ? localizeUi(
                                        "ui.longTermMemory.activityview.copied",
                                      )
                                    : localizeUi(
                                        "ui.longTermMemory.activityview.copyJson",
                                      )}
                                </Button>
                                <pre className="overflow-x-auto text-[0.6875rem] text-[var(--muted-foreground)]">
                                  {humanizeDebugText(
                                    JSON.stringify(metadata, null, 2),
                                    debugTextLookup,
                                    localizeUi(
                                      "ui.longTermMemory.activityview.anInternalRecord",
                                    ),
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
