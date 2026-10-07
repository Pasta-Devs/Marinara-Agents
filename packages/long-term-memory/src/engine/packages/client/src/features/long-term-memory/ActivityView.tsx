import { useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Copy, Download, RotateCw, Trash2 } from "lucide-react";
import type {
  LtmDebugEvent,
  LtmLastInjectionResponse,
  LtmNote,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { invalidateLtmQueries, queryKeys, request, requestNotesByIds, requestRaw } from "./api";
import { Button, InfoPopover, StatusSurface, inputClass } from "./shared-controls";
import { humanizeLabel, labelKeys, localizedLabel } from "./display-labels";
import type { LongTermMemoryDestinationProps } from "./types";
import { LastInjectionSummary } from "./LastInjectionSummary";
import { useLtmTranslation, type LtmTranslationFunction } from "./localization";
import {
  collectDebugNoteIds,
  deriveOperationStatus,
  filterOperations,
  groupOperations,
  humanizeDebugText,
  isTruncatedResponse,
  LTM_DEBUG_STALE_OPERATION_MS,
  type DebugActivityFilter,
  type DebugOperationStatus,
} from "./debug-activity";

type DebugLogResponse = { events: LtmDebugEvent[] };

const debugStatusLabelKeys: Record<DebugOperationStatus, string> = {
  started: "ui.longTermMemory.activityview.running",
  ok: "ui.longTermMemory.activityview.completed",
  skipped: "ui.longTermMemory.activityview.skipped",
  warning: "ui.longTermMemory.activityview.warning",
  completed_with_warnings: "ui.longTermMemory.activityview.completedWithWarnings",
  error: "ui.longTermMemory.activityview.failed",
  incomplete: "ui.longTermMemory.activityview.noCompletionRecorded",
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
  extract_source_note: "ui.longTermMemory.activityview.actionAiExtraction",
  evidence_unit_request: "ui.longTermMemory.activityview.actionAiExtraction",
  evidence_unit_context_preflight: "ui.longTermMemory.activityview.actionAiExtraction",
  evidence_unit_response: "ui.longTermMemory.activityview.actionAiExtraction",
  evidence_unit_json_parse: "ui.longTermMemory.activityview.actionReadExtractionResult",
  recall_explanation: "ui.longTermMemory.activityview.actionMemoryRecall",
};

function formatTimestamp(timestamp: string, locale: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString(locale);
}

function describeEvent(
  event: LtmDebugEvent,
  noteTitles: ReadonlyMap<string, string>,
  localizeUi: LtmTranslationFunction,
) {
  const internalRecordLabel = localizeUi("ui.longTermMemory.activityview.anInternalRecord");
  if (event.error) return humanizeDebugText(event.error.message, noteTitles, internalRecordLabel);
  if (isTruncatedResponse(event))
    return localizeUi("ui.longTermMemory.activityview.outputTruncated", {
      finishReason: String(event.details?.finishReason),
    });
  if (event.action === "evidence_unit_context_preflight") {
    if (event.details?.reason === "prompt_trim_required")
      return localizeUi("ui.longTermMemory.activityview.promptTooLarge");
    if (event.details?.reason === "output_budget_below_viability_floor")
      return localizeUi("ui.longTermMemory.activityview.outputBudgetTooSmall");
  }
  if (event.message) return humanizeDebugText(event.message, noteTitles, internalRecordLabel);
  if (event.uiSummary) return humanizeDebugText(event.uiSummary, noteTitles, internalRecordLabel);
  const summary = event.details?.summary;
  if (typeof summary === "string") return humanizeDebugText(summary, noteTitles, internalRecordLabel);
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
  return singleLine.length > 240 ? `${singleLine.slice(0, 237)}...` : singleLine;
}

function actionLabel(action: string, localizeUi: LtmTranslationFunction) {
  const key = actionLabelKeys[action];
  return key ? localizeUi(key) : humanizeLabel(action);
}

function operationStatus(
  events: LtmDebugEvent[],
  localizeUi: LtmTranslationFunction,
  options?: { now?: number; staleMs?: number },
) {
  const status = deriveOperationStatus(events, options);
  return { status, label: localizeUi(debugStatusLabelKeys[status]) };
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
  const visibleCounts = Object.fromEntries(Object.entries(counts ?? {}).filter(([label]) => !/chars$/i.test(label)));
  return Object.keys(visibleCounts).length ? { ...metadata, counts: visibleCounts } : metadata;
}

function summarizeCounts(events: LtmDebugEvent[], localizeUi: LtmTranslationFunction, locale: string) {
  const counts = new Map<string, number>();
  for (const event of events)
    for (const [label, count] of Object.entries(event.counts ?? {}))
      counts.set(
        event.action === "evidence_unit_request" && label === "promptTokens" ? "estimatedPromptTokens" : label,
        count,
      );
  if (!counts.size) return "";
  const summary: string[] = [];
  const inputTokens = counts.get("promptTokens");
  const estimatedInputTokens = counts.get("estimatedPromptTokens") ?? counts.get("inputTokens");
  const reasoningTokens = counts.get("completionReasoningTokens") ?? counts.get("reasoningTokens");
  const outputTokens = counts.get("completionTokens") ?? counts.get("outputTokens") ?? counts.get("responseTokens");
  const totalTokens = counts.get("totalTokens");
  if (inputTokens != null)
    summary.push(
      localizeUi("ui.longTermMemory.activityview.inputTokens", {
        count: inputTokens.toLocaleString(locale),
      }),
    );
  if (estimatedInputTokens != null)
    summary.push(
      localizeUi("ui.longTermMemory.activityview.estimatedInputTokens", {
        count: estimatedInputTokens.toLocaleString(locale),
      }),
    );
  if (reasoningTokens != null)
    summary.push(
      localizeUi("ui.longTermMemory.activityview.reasoningTokens", {
        count: reasoningTokens.toLocaleString(locale),
      }),
    );
  if (outputTokens != null)
    summary.push(
      localizeUi("ui.longTermMemory.activityview.outputTokens", {
        count: outputTokens.toLocaleString(locale),
      }),
    );
  if (totalTokens != null)
    summary.push(
      localizeUi("ui.longTermMemory.activityview.totalTokens", {
        count: totalTokens.toLocaleString(locale),
      }),
    );
  summary.push(
    ...[...counts.entries()]
      .filter(
        ([label]) =>
          !/chars$/i.test(label) &&
          label !== "promptTokens" &&
          label !== "inputTokens" &&
          label !== "estimatedPromptTokens" &&
          label !== "completionReasoningTokens" &&
          label !== "reasoningTokens" &&
          label !== "completionTokens" &&
          label !== "outputTokens" &&
          label !== "totalTokens" &&
          label !== "responseTokens",
      )
      .slice(0, Math.max(0, 4 - summary.length))
      .map(([label, count]) =>
        localizeUi("ui.longTermMemory.activityview.countWithLabel", {
          count: count.toLocaleString(locale),
          label: humanizeLabel(label).toLocaleLowerCase(locale),
        }),
      ),
  );
  return summary.join(" | ");
}

function warningMessages(
  events: LtmDebugEvent[],
  noteTitles: ReadonlyMap<string, string>,
  localizeUi: LtmTranslationFunction,
) {
  return events
    .filter((event) => event.status === "warning" || isTruncatedResponse(event))
    .map((event) => describeEvent(event, noteTitles, localizeUi));
}

function latestRecallEvent(events: LtmDebugEvent[], chatId?: string | null, attemptId?: string | null) {
  const candidates = events.filter(
    (event) =>
      event.phase === "retrieval" &&
      event.action === "recall_explanation" &&
      (!chatId || event.chatId === chatId || event.details?.chatId === chatId),
  );
  // Prefer the explanation carrying the same attempt id as the recorded recall
  // rather than trusting timestamp order, which can pair the wrong attempts.
  const correlated = attemptId ? candidates.find((event) => event.operationId === attemptId) : undefined;
  // With a known attempt, never fall back to another recall's explanation; a missing
  // match means the current attempt has no recorded workflow.
  if (attemptId) return correlated;
  return candidates.sort((left, right) => right.ts.localeCompare(left.ts))[0];
}

function recallDetails(event: LtmDebugEvent | undefined) {
  const details = event?.details;
  return details && typeof details === "object" && !Array.isArray(details) ? details : null;
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

export default function ActivityView({ props, onOpenMemory }: LongTermMemoryDestinationProps) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<"clear" | "export" | null>(null);
  const [actionError, setActionError] = useState("");
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);
  const [openTechnicalDetails, setOpenTechnicalDetails] = useState<ReadonlySet<string>>(new Set());
  const [filter, setFilter] = useState<DebugActivityFilter>("all");
  const [limit, setLimit] = useState(200);
  const [recallOpen, setRecallOpen] = useState(false);
  const activity = useQuery({
    queryKey: [...queryKeys.activity, limit],
    queryFn: () => request<DebugLogResponse>(`/debug-log?limit=${limit}`),
  });
  const recallActivity = useQuery({
    queryKey: [...queryKeys.activity, "recall-workflow"],
    enabled: recallOpen,
    queryFn: () => request<DebugLogResponse>("/debug-log?limit=200&phase=retrieval"),
  });
  const noteIds = useMemo(
    () => collectDebugNoteIds([...(activity.data?.events ?? []), ...(recallActivity.data?.events ?? [])]),
    [activity.data, recallActivity.data],
  );
  const notes = useQuery({
    queryKey: [...queryKeys.notes, "activity-context", noteIds],
    queryFn: ({ signal }) => requestNotesByIds<LtmNote>(noteIds, signal, true),
    enabled: noteIds.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
  const noteTitles = useMemo(
    () =>
      new Map(
        (notes.data ?? []).map((note) => [
          note.id,
          note.title || localizeUi("ui.longTermMemory.activityview.untitledMemory"),
        ]),
      ),
    [localizeUi, notes.data],
  );
  const operations = useMemo(
    () => filterOperations(groupOperations(activity.data?.events ?? []), filter),
    [activity.data, filter],
  );
  const recallEvents = recallOpen ? (recallActivity.data?.events ?? []) : (activity.data?.events ?? []);
  const recallLoading = recallOpen ? recallActivity.isLoading : activity.isLoading;
  const recallError = recallOpen ? recallActivity.isError : activity.isError;
  const lastInjection = useQuery({
    enabled: Boolean(props.chatId),
    queryKey: queryKeys.lastInjection(props.chatId),
    queryFn: () => request<LtmLastInjectionResponse>(`/last-injection/${encodeURIComponent(props.chatId!)}`),
  });
  const recallEvent = latestRecallEvent(recallEvents, props.chatId, lastInjection.data?.attempt?.attemptId);
  const recallWorkflow = recallDetails(recallEvent) as {
    maxChunks?: number;
    maxTokens?: number;
    scoreThreshold?: number;
    weights?: Record<string, number>;
    selected?: Array<Record<string, unknown>>;
    rejected?: Array<Record<string, unknown>>;
    semanticOutcome?: string;
    indexLoadOutcome?: string;
    indexGeneratedAt?: string;
    indexedChunks?: number;
    eligibleChunks?: number;
    embeddedChunks?: number;
    mode?: string;
    includeResolved?: boolean;
    exclusiveCharacterTargeting?: boolean;
    contextMessagesUsed?: number;
    rejectedLimit?: number;
  } | null;

  const clear = async () => {
    if (
      !(await confirm(
        props,
        localizeUi("ui.longTermMemory.activityview.clearActivityLog"),
        localizeUi("ui.longTermMemory.activityview.clearActivityLogDescription"),
        localizeUi("ui.longTermMemory.activityview.clearLog"),
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
        error instanceof Error ? error.message : localizeUi("ui.longTermMemory.activityview.couldNotClearActivity"),
      );
    } finally {
      setPending(null);
    }
  };

  const exportLog = async () => {
    setPending("export");
    setActionError("");
    try {
      const response = await requestRaw("/debug-log/export");
      if (!response.ok)
        throw new Error(response.statusText || localizeUi("ui.longTermMemory.activityview.couldNotExportActivity"));
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
        error instanceof Error ? error.message : localizeUi("ui.longTermMemory.activityview.couldNotExportActivity"),
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
        if (!document.execCommand("copy")) throw new Error(localizeUi("ui.longTermMemory.activityview.copyFailed"));
        copied = true;
      } catch {
        copied = false;
      } finally {
        textarea.remove();
      }
    }
    if (!copied) {
      setActionError(localizeUi("ui.longTermMemory.activityview.couldNotCopyTechnicalDetails"));
      return;
    }
    setCopiedEventId(eventId);
    window.setTimeout(() => setCopiedEventId((current) => (current === eventId ? null : current)), 2_000);
  };

  return (
    <section data-ltm-surface="activity" aria-labelledby="ltm-activity-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 id="ltm-activity-title" className="flex items-center gap-1 text-xs font-semibold">
            {localizeUi("ui.longTermMemory.activityview.debugActivity")}
            <InfoPopover
              label={localizeUi("ui.longTermMemory.activityview.debugActivity")}
              content={localizeUi(
                "ui.longTermMemory.activityview.traceImportsExtractionDraftActionsRecallAndMaintenance",
              )}
            />
          </h4>
        </div>
        <div
          role="group"
          aria-label={localizeUi("ui.longTermMemory.activityview.debugActivity")}
          className="flex flex-wrap gap-2"
        >
          <Button
            disabled={activity.isFetching || recallActivity.isFetching}
            onClick={() => {
              void Promise.all(recallOpen ? [activity.refetch(), recallActivity.refetch()] : [activity.refetch()]).then(
                (results) => {
                  if (!results.some((result) => result.isError)) setActionError("");
                },
              );
            }}
          >
            <RotateCw aria-hidden="true" size="0.875rem" /> {localizeUi("ui.longTermMemory.activityview.refresh")}
          </Button>
          <Button disabled={pending !== null} onClick={() => void exportLog()}>
            <Download aria-hidden="true" size="0.875rem" /> {localizeUi("ui.longTermMemory.activityview.export")}
          </Button>
          <Button destructive disabled={pending !== null} onClick={() => void clear()}>
            <Trash2 aria-hidden="true" size="0.875rem" /> {localizeUi("ui.longTermMemory.activityview.clear")}
          </Button>
        </div>
      </div>

      <label className="block max-w-xs space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
        <span>{localizeUi("ui.longTermMemory.activityview.showEvents")}</span>
        <select
          className={inputClass}
          value={filter}
          onChange={(event) => setFilter(event.target.value as DebugActivityFilter)}
        >
          <option value="all">{localizeUi("ui.longTermMemory.activityview.allPhases")}</option>
          <option value="errors">{localizeUi("ui.longTermMemory.activityview.errorsOnly")}</option>
          {debugPhases.map((phase) => (
            <option key={phase} value={phase}>
              {localizedLabel(phase, localizeUi, labelKeys.debugPhase)}
            </option>
          ))}
        </select>
      </label>

      {props.chatId ? (
        <LastInjectionSummary
          data={lastInjection.data}
          loading={lastInjection.isFetching}
          error={lastInjection.isError}
          onOpenMemory={onOpenMemory}
          onRetry={() => void lastInjection.refetch()}
        />
      ) : null}

      <details
        data-ltm-recall-workflow
        className="mari-editor-panel mari-editor-panel--soft"
        onToggle={(event) => setRecallOpen(event.currentTarget.open)}
      >
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-xs font-semibold">
          <span>{localizeUi("ui.longTermMemory.activityview.latestRecallWorkflow")}</span>
          {recallEvent?.counts ? (
            <span className="shrink-0 text-[0.6875rem] font-normal text-[var(--muted-foreground)]">
              {recallEvent.counts.selected ?? 0} {localizeUi("ui.longTermMemory.activityview.selected")}{" "}
              {recallEvent.counts.rejected ?? 0} {localizeUi("ui.longTermMemory.activityview.rejected")}
            </span>
          ) : null}
        </summary>
        <div className="space-y-3 border-t border-[var(--border)] px-3 py-3 text-xs">
          {lastInjection.data?.attempt && lastInjection.data.attempt.reason !== "no_matches" ? (
            <p
              className="text-[var(--muted-foreground)]"
              data-ltm-recall-confirmation={lastInjection.data.attempt.confirmed ? "confirmed" : "unconfirmed"}
            >
              {lastInjection.data.attempt.confirmed
                ? localizeUi("ui.longTermMemory.activityview.recallWorkflowInjectionConfirmed")
                : localizeUi("ui.longTermMemory.activityview.recallWorkflowInjectionNotConfirmed")}
            </p>
          ) : null}
          {recallLoading ? (
            <StatusSurface busy>{localizeUi("ui.longTermMemory.activityview.loadingRecallWorkflow")}</StatusSurface>
          ) : recallError ? (
            <StatusSurface tone="danger">
              {localizeUi("ui.longTermMemory.activityview.theRecallWorkflowCouldNotLoad")}
            </StatusSurface>
          ) : !recallEvent || !recallWorkflow ? (
            <p className="text-[var(--muted-foreground)]">
              {localizeUi("ui.longTermMemory.activityview.noRecallWorkflowHasBeenRecordedEnableDebugActivity")}
            </p>
          ) : (
            <>
              <div className="grid gap-1 text-[var(--muted-foreground)] sm:grid-cols-2">
                <span>{localizeUi("ui.longTermMemory.activityview.recentContextWasUsedForRecall")}</span>
                <span>
                  {localizeUi("ui.longTermMemory.activityview.limits")} {String(recallWorkflow.maxChunks ?? "--")}{" "}
                  {localizeUi("ui.longTermMemory.activityview.chunks")}{" "}
                  {Number(recallWorkflow.maxTokens ?? 0).toLocaleString(locale)}{" "}
                  {localizeUi("ui.longTermMemory.activityview.tokens")}
                </span>
                <span>
                  {localizeUi("ui.longTermMemory.activityview.threshold")} {String(recallWorkflow.scoreThreshold ?? 0)}
                </span>
                <span>
                  {localizeUi("ui.longTermMemory.activityview.used")}{" "}
                  {(recallEvent.counts?.usedTokens ?? 0).toLocaleString(locale)}{" "}
                  {localizeUi("ui.longTermMemory.activityview.tokens")}
                </span>
                {typeof recallWorkflow.mode === "string" ? (
                  <span>
                    {localizeUi("ui.longTermMemory.activityview.recallMode", {
                      mode: humanizeLabel(recallWorkflow.mode),
                    })}
                  </span>
                ) : null}
                {typeof recallWorkflow.contextMessagesUsed === "number" ? (
                  <span>
                    {localizeUi("ui.longTermMemory.activityview.recallContextMessages", {
                      count: recallWorkflow.contextMessagesUsed,
                    })}
                  </span>
                ) : null}
                {typeof recallWorkflow.indexedChunks === "number" ||
                typeof recallWorkflow.eligibleChunks === "number" ? (
                  <span>
                    {localizeUi("ui.longTermMemory.activityview.recallIndexSummary", {
                      indexed: recallWorkflow.indexedChunks ?? 0,
                      eligible: recallWorkflow.eligibleChunks ?? 0,
                      outcome: humanizeLabel(String(recallWorkflow.indexLoadOutcome ?? "loaded")),
                    })}
                  </span>
                ) : null}
                {typeof recallWorkflow.indexGeneratedAt === "string" ? (
                  <span>
                    {localizeUi("ui.longTermMemory.activityview.recallIndexBuiltAt", {
                      value: formatTimestamp(recallWorkflow.indexGeneratedAt, locale),
                    })}
                  </span>
                ) : null}
                {typeof recallWorkflow.embeddedChunks === "number" ? (
                  <span>
                    {localizeUi("ui.longTermMemory.activityview.recallIndexEmbeddedChunks", {
                      count: recallWorkflow.embeddedChunks,
                    })}
                  </span>
                ) : null}
                {typeof recallWorkflow.semanticOutcome === "string" ? (
                  <span>
                    {localizeUi("ui.longTermMemory.activityview.recallSemanticOutcome", {
                      outcome: humanizeLabel(recallWorkflow.semanticOutcome),
                    })}
                  </span>
                ) : null}
                {typeof recallWorkflow.includeResolved === "boolean" ? (
                  <span>
                    {localizeUi(
                      recallWorkflow.includeResolved
                        ? "ui.longTermMemory.activityview.recallResolvedEligible"
                        : "ui.longTermMemory.activityview.recallResolvedExcluded",
                    )}
                  </span>
                ) : null}
                {typeof recallWorkflow.exclusiveCharacterTargeting === "boolean" ? (
                  <span>
                    {localizeUi(
                      recallWorkflow.exclusiveCharacterTargeting
                        ? "ui.longTermMemory.activityview.recallTargetedCharactersOnly"
                        : "ui.longTermMemory.activityview.recallChatWideTargeting",
                    )}
                  </span>
                ) : null}
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
                  <h4 className="mb-1 font-semibold">{localizeUi("ui.longTermMemory.activityview.selectedChunks")}</h4>
                  <ul
                    aria-label={localizeUi("ui.longTermMemory.activityview.selectedChunks")}
                    className="space-y-1 text-[var(--muted-foreground)]"
                  >
                    {recallWorkflow.selected.map((candidate, index) => {
                      const noteId = typeof candidate.noteId === "string" ? candidate.noteId : undefined;
                      const score = typeof candidate.score === "number" ? candidate.score : undefined;
                      return (
                        <li
                          key={`${noteId ?? "candidate"}-${index}`}
                          className="flex flex-wrap justify-between gap-2 rounded bg-[var(--background)] px-2 py-1"
                        >
                          <span>
                            {noteId && noteTitles.get(noteId)
                              ? noteTitles.get(noteId)
                              : (noteId ?? localizeUi("ui.longTermMemory.activityview.unknownMemory"))}{" "}
                            · {String(candidate.sectionKey ?? "chunk")}
                          </span>
                          <span>
                            {localizeUi("ui.longTermMemory.activityview.relevance")}{" "}
                            {score == null
                              ? "--"
                              : localizeUi("ui.longTermMemory.activityview.value1", {
                                  value1: Math.round(score * 100),
                                })}{" "}
                            · {Array.isArray(candidate.lanes) ? candidate.lanes.join(", ") : ""}
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
                    {localizeUi("ui.longTermMemory.activityview.rejectedCandidatesUpTo", {
                      limit: recallWorkflow.rejectedLimit ?? 20,
                    })}
                  </h4>
                  <ul
                    aria-label={localizeUi("ui.longTermMemory.activityview.rejectedCandidatesUpTo", {
                      limit: recallWorkflow.rejectedLimit ?? 20,
                    })}
                    className="space-y-1 text-[var(--muted-foreground)]"
                  >
                    {recallWorkflow.rejected.map((candidate, index) => {
                      const noteId = typeof candidate.noteId === "string" ? candidate.noteId : undefined;
                      const score = typeof candidate.score === "number" ? candidate.score : undefined;
                      return (
                        <li
                          key={`${noteId ?? "candidate"}-${index}`}
                          className="flex flex-wrap justify-between gap-2 rounded bg-[var(--background)] px-2 py-1"
                        >
                          <span>
                            {noteId && noteTitles.get(noteId)
                              ? noteTitles.get(noteId)
                              : (noteId ?? localizeUi("ui.longTermMemory.activityview.unknownMemory"))}{" "}
                            · {String(candidate.sectionKey ?? "chunk")}
                          </span>
                          <span>
                            {localizeUi("ui.longTermMemory.activityview.relevance")}{" "}
                            {score == null
                              ? "--"
                              : localizeUi("ui.longTermMemory.activityview.value1", {
                                  value1: Math.round(score * 100),
                                })}{" "}
                            · {humanizeLabel(String(candidate.rejectionReason ?? "rejected"))}
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

      {actionError ? <StatusSurface tone="danger">{actionError}</StatusSurface> : null}
      {activity.isLoading ? (
        <StatusSurface busy>{localizeUi("ui.longTermMemory.activityview.loadingActivity")}</StatusSurface>
      ) : null}
      {activity.isError ? (
        <StatusSurface tone="danger">
          {localizeUi("ui.longTermMemory.activityview.couldNotLoadActivity")}{" "}
          <button type="button" className="underline" onClick={() => void activity.refetch()}>
            {localizeUi("ui.longTermMemory.activityview.retry")}
          </button>
        </StatusSurface>
      ) : null}
      {activity.data?.events.length === 0 ? (
        <StatusSurface>{localizeUi("ui.longTermMemory.activityview.noActivityHasBeenRecordedYet")}</StatusSurface>
      ) : activity.data && operations.length === 0 ? (
        <StatusSurface>{localizeUi("ui.longTermMemory.activityview.noActivityMatchesThisFilter")}</StatusSurface>
      ) : null}
      {activity.data && activity.data.events.length >= limit ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <span>
            {localizeUi("ui.longTermMemory.activityview.newestEventsShown", {
              count: limit.toLocaleString(locale),
            })}
          </span>
          {limit < 1_000 ? (
            <Button onClick={() => setLimit(1_000)}>
              {localizeUi("ui.longTermMemory.activityview.showUpTo1_000Events")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {operations.length ? (
        <ol className="space-y-2" aria-label={localizeUi("ui.longTermMemory.activityview.longTermMemoryActivityLog")}>
          {operations.map((operation) => {
            const firstEvent = operation.events[0];
            const lastEvent = operation.events.at(-1)!;
            const status = operationStatus(operation.events, localizeUi, {
              now: Date.now(),
              staleMs: LTM_DEBUG_STALE_OPERATION_MS,
            });
            const sourceNoteId = operation.events.find((event) => event.sourceNoteId)?.sourceNoteId;
            const principalEvent =
              operation.events.find((event) => event.status === "error") ??
              operation.events.find((event) => event.status === "warning" || isTruncatedResponse(event)) ??
              lastEvent;
            const summary = compactSummary(describeEvent(principalEvent, noteTitles, localizeUi));
            const model = operation.events.find((event) => event.model)?.model;
            const durationMs = lastEvent.durationMs;
            const countSummary = summarizeCounts(operation.events, localizeUi, locale);
            const warnings = warningMessages(operation.events, noteTitles, localizeUi).filter(
              (warning) => compactSummary(warning) !== summary,
            );
            return (
              <li key={operation.operationId} className="mari-editor-panel mari-editor-panel--soft">
                <details className="group">
                  <summary className="flex min-h-11 cursor-pointer list-none items-start gap-2 p-3 marker:content-none">
                    <ChevronRight
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 transition-transform group-open:rotate-90"
                      size="1rem"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold">{actionLabel(firstEvent.action, localizeUi)}</span>
                        <span
                          className={
                            status.status === "error" ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]"
                          }
                        >
                          {status.label}
                        </span>
                      </span>
                      {sourceNoteId && noteTitles.has(sourceNoteId) ? (
                        <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
                          {noteTitles.get(sourceNoteId)}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-xs text-[var(--muted-foreground)]">{summary}</span>
                      <span className="mt-1 block text-[0.6875rem] text-[var(--muted-foreground)]">
                        {formatTimestamp(lastEvent.ts, locale)}
                        {durationMs != null
                          ? localizeUi("ui.longTermMemory.activityview.value1Ms", {
                              value1: durationMs.toLocaleString(locale),
                            })
                          : ""}
                        {model ? localizeUi("ui.longTermMemory.activityview.value1_9a93137", { value1: model }) : ""}
                        {countSummary
                          ? localizeUi("ui.longTermMemory.activityview.value1_9a93137", { value1: countSummary })
                          : ""}
                      </span>
                      {warnings.length ? (
                        <ul
                          className="mt-1 list-disc pl-4 text-[0.6875rem] text-[var(--marinara-editor-warning)]"
                          data-ltm-activity-warnings
                        >
                          {warnings.map((warning, index) => (
                            <li key={`${warning}-${index}`}>{warning}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </summary>
                  <ol className="space-y-2 border-t border-[var(--border)] px-3 py-3">
                    {operation.events.map((event) => {
                      const metadata = eventMetadata(event);
                      return (
                        <li key={event.id} className="border-l-2 border-[var(--border)] pl-3 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">
                              {localizedLabel(event.phase, localizeUi, labelKeys.debugPhase)} /{" "}
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
                          <p className="mt-1 leading-relaxed">{describeEvent(event, noteTitles, localizeUi)}</p>
                          <p className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]">
                            {formatTimestamp(event.ts, locale)}
                            {event.durationMs != null
                              ? localizeUi("ui.longTermMemory.activityview.value1Ms", {
                                  value1: event.durationMs.toLocaleString(locale),
                                })
                              : ""}
                          </p>
                          {Object.keys(metadata).length ? (
                            <details
                              className="mt-2 rounded bg-[var(--background)]"
                              onToggle={(toggleEvent) => {
                                const open = toggleEvent.currentTarget.open;
                                setOpenTechnicalDetails((current) => {
                                  const next = new Set(current);
                                  if (open) next.add(event.id);
                                  else next.delete(event.id);
                                  return next;
                                });
                              }}
                            >
                              <summary className="min-h-11 cursor-pointer px-2 py-3 font-medium">
                                {localizeUi("ui.longTermMemory.activityview.technicalDetails")}
                              </summary>
                              <div className="border-t border-[var(--border)] p-2">
                                <Button
                                  className="mb-2"
                                  aria-label={localizeUi("ui.longTermMemory.activityview.copyRawJsonForValue1", {
                                    value1: actionLabel(event.action, localizeUi),
                                  })}
                                  onClick={() => void copyJson(event.id, metadata)}
                                >
                                  {copiedEventId === event.id ? (
                                    <Check aria-hidden="true" size="0.875rem" />
                                  ) : (
                                    <Copy aria-hidden="true" size="0.875rem" />
                                  )}
                                  {copiedEventId === event.id
                                    ? localizeUi("ui.longTermMemory.activityview.copied")
                                    : localizeUi("ui.longTermMemory.activityview.copyJson")}
                                </Button>
                                {openTechnicalDetails.has(event.id) ? (
                                  <pre className="overflow-x-auto text-[0.6875rem] text-[var(--muted-foreground)]">
                                    {humanizeDebugText(
                                      JSON.stringify(metadata, null, 2),
                                      noteTitles,
                                      localizeUi("ui.longTermMemory.activityview.anInternalRecord"),
                                    )}
                                  </pre>
                                ) : null}
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
