import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  HelpCircle,
  Loader2,
  MinusCircle,
  RotateCw,
  Search,
  Trash2,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { LtmDebugEvent, LtmNote } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { invalidateLtmQueries, ltmScopeTargetsKey, queryKeys, request, requestNotesByIds, requestRaw } from "./api";
import { Button, InfoPopover, StatusSurface, inputClass } from "./shared-controls";
import { humanizeLabel, labelKeys, localizedLabel } from "./display-labels";
import type { LongTermMemoryDestinationProps } from "./types";
import { useLtmTranslation, type LtmTranslationFunction } from "./localization";
import { LtmWorkspace, type LtmWorkspacePane } from "./LtmWorkspace";
import type { ScopeTargets } from "./scope-targets";
import {
  collectDebugNoteIds,
  deriveOperationStatus,
  filterOperations,
  groupOperations,
  humanizeDebugText,
  isTruncatedResponse,
  LTM_DEBUG_STALE_OPERATION_MS,
  type DebugActivityFilter,
  type DebugOperation,
  type DebugOperationStatus,
} from "./debug-activity";

type DebugLogResponse = { events: LtmDebugEvent[] };

type DebugChip = "all" | "problems" | "recall" | "extraction";

const debugChips: DebugChip[] = ["all", "problems", "recall", "extraction"];

const debugStatusLabelKeys: Record<DebugOperationStatus, string> = {
  started: "ui.longTermMemory.activityview.running",
  ok: "ui.longTermMemory.activityview.completed",
  skipped: "ui.longTermMemory.activityview.skipped",
  warning: "ui.longTermMemory.activityview.warning",
  completed_with_warnings: "ui.longTermMemory.activityview.completedWithWarnings",
  error: "ui.longTermMemory.activityview.failed",
  incomplete: "ui.longTermMemory.activityview.noCompletionRecorded",
};

const actionLabelKeys: Record<string, string> = {
  extract_source_note: "ui.longTermMemory.activityview.actionAiExtraction",
  evidence_unit_request: "ui.longTermMemory.activityview.actionAiExtraction",
  evidence_unit_context_preflight: "ui.longTermMemory.activityview.actionAiExtraction",
  evidence_unit_response: "ui.longTermMemory.activityview.actionAiExtraction",
  evidence_unit_json_parse: "ui.longTermMemory.activityview.actionReadExtractionResult",
  recall_explanation: "ui.longTermMemory.activityview.actionMemoryRecall",
};

const debugStatusIcons: Record<DebugOperationStatus, LucideIcon> = {
  started: Loader2,
  ok: CheckCircle2,
  skipped: MinusCircle,
  warning: AlertTriangle,
  completed_with_warnings: AlertTriangle,
  error: XCircle,
  incomplete: HelpCircle,
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

// Ageing a started-only operation into "No completion recorded" is a whole-operation
// rule. A per-event timeline step must not inherit it, or a completed operation's
// start step reads as unfinished.
function operationStatus(events: LtmDebugEvent[], localizeUi: LtmTranslationFunction, applyStaleThreshold = true) {
  const status = deriveOperationStatus(
    events,
    applyStaleThreshold ? { now: Date.now(), staleMs: LTM_DEBUG_STALE_OPERATION_MS } : undefined,
  );
  return { status, label: localizeUi(debugStatusLabelKeys[status]), Icon: debugStatusIcons[status] };
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

/** Errors, warnings and truncated responses are the operation's problems, whole-operation scoped. */
function problemMessages(
  events: LtmDebugEvent[],
  noteTitles: ReadonlyMap<string, string>,
  localizeUi: LtmTranslationFunction,
) {
  return events
    .filter((event) => event.status === "error" || event.status === "warning" || isTruncatedResponse(event))
    .map((event) => describeEvent(event, noteTitles, localizeUi));
}

function recallDetails(event: LtmDebugEvent | undefined) {
  const details = event?.details;
  return details && typeof details === "object" && !Array.isArray(details) ? details : null;
}

function operationSubject(
  operation: DebugOperation,
  noteTitles: ReadonlyMap<string, string>,
  chatLabel: (chatId: string) => string,
): { kind: "chat" | "memory"; value: string } | null {
  const recall = operation.events.find((event) => event.action === "recall_explanation");
  if (recall) {
    const chatId = recall.chatId ?? (typeof recall.details?.chatId === "string" ? recall.details.chatId : undefined);
    // Prefer the resolved chat name; keep the raw id when the scope lookup has no match.
    if (chatId) return { kind: "chat", value: chatLabel(chatId) };
  }
  const sourceNoteId = operation.events.find((event) => event.sourceNoteId)?.sourceNoteId;
  if (sourceNoteId && noteTitles.has(sourceNoteId)) return { kind: "memory", value: noteTitles.get(sourceNoteId)! };
  return null;
}

function operationHasProblems(operation: DebugOperation) {
  return operation.events.some(
    (event) => event.status === "warning" || event.status === "error" || isTruncatedResponse(event),
  );
}

// D31: match only explicit memory-id references in the structured log records — extraction
// source ids, produced target-note ids and recall selected/rejected candidate ids. Prose,
// titles, partial id strings and Recent-changes events are not evidence of a debug
// operation, and apply operations log change/mutation ids, so `mutationIds` is not consulted.
function operationReferencesMemory(operation: DebugOperation, memoryId: string) {
  return operation.events.some((event) => {
    if (event.sourceNoteId === memoryId || event.noteId === memoryId) return true;
    const details = event.details;
    if (!details || typeof details !== "object" || Array.isArray(details)) return false;
    return (["selected", "rejected"] as const).some((key) => {
      const candidates = (details as Record<string, unknown>)[key];
      return (
        Array.isArray(candidates) &&
        candidates.some(
          (candidate) =>
            candidate && typeof candidate === "object" && (candidate as { noteId?: unknown }).noteId === memoryId,
        )
      );
    });
  });
}

// Chips select whole operations through the shared #1255 helper; only the
// Problems predicate (warnings, errors and truncated responses) is extra.
const chipFilters: Record<Exclude<DebugChip, "problems">, DebugActivityFilter> = {
  all: "all",
  recall: "retrieval",
  extraction: "extraction",
};

function filterByChip(operations: readonly DebugOperation[], chip: DebugChip) {
  return chip === "problems"
    ? operations.filter(operationHasProblems)
    : filterOperations(operations, chipFilters[chip]);
}

function operationMatchesSearch(
  operation: DebugOperation,
  query: string,
  noteTitles: ReadonlyMap<string, string>,
  chatLabel: (chatId: string) => string,
  localizeUi: LtmTranslationFunction,
  locale: string,
) {
  // The displayed subject (source chat or memory name) must be searchable, or a
  // row that visibly names "chat-artifact" looks like a miss for that query.
  const subject = operationSubject(operation, noteTitles, chatLabel)?.value ?? "";
  const text = operation.events
    .map((event) =>
      [
        event.action,
        event.phase,
        event.model ?? "",
        actionLabel(event.action, localizeUi),
        describeEvent(event, noteTitles, localizeUi),
        summarizeCounts([event], localizeUi, locale),
      ].join(" "),
    )
    .join(" ")
    .concat(" ", subject)
    .toLocaleLowerCase(locale);
  return text.includes(query);
}

function isToday(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  );
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
  openActivityMemoryId,
  onOpenActivityMemoryIdHandled,
}: LongTermMemoryDestinationProps) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<"clear" | "export" | null>(null);
  const [actionError, setActionError] = useState("");
  const [copiedOperationId, setCopiedOperationId] = useState<string | null>(null);
  const [chip, setChip] = useState<DebugChip>("all");
  const [search, setSearch] = useState("");
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);
  const [activePane, setActivePane] = useState<LtmWorkspacePane>("navigator");
  const [limit, setLimit] = useState(200);
  // D31: a memory handoff opens the navigator filtered to that memory and with nothing
  // selected, whether or not a previous Debug selection existed.
  const [memoryFilterId, setMemoryFilterId] = useState<string | null>(openActivityMemoryId ?? null);
  useEffect(() => {
    if (!openActivityMemoryId) return;
    setMemoryFilterId(openActivityMemoryId);
    setSelectedOperationId(null);
    setActivePane("navigator");
    // The handoff target is consumed once; the tab must not re-apply a filter the
    // user cleared when it is reopened.
    onOpenActivityMemoryIdHandled?.();
  }, [openActivityMemoryId, onOpenActivityMemoryIdHandled]);
  const activity = useQuery({
    queryKey: [...queryKeys.activity, limit],
    queryFn: () => request<DebugLogResponse>(`/debug-log?limit=${limit}`),
  });
  const noteIds = useMemo(() => collectDebugNoteIds(activity.data?.events ?? []), [activity.data]);
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
  const operations = useMemo(() => groupOperations(activity.data?.events ?? []), [activity.data]);
  // Reuse the same scope-targets lookup the Vault uses so a recall row can name its
  // source chat; the raw id remains the fallback for unknown or absent chats.
  const scopeTargets = useQuery({
    queryKey: ltmScopeTargetsKey(props.chatId),
    staleTime: 30_000,
    queryFn: () =>
      request<ScopeTargets>(
        `/scope-targets?includeAllChats=true${props.chatId ? `&chatId=${encodeURIComponent(props.chatId)}` : ""}`,
      ),
  });
  const chatLabel = useMemo(() => {
    const labels = new Map((scopeTargets.data?.chats ?? []).map((chat) => [chat.id, chat.label]));
    return (chatId: string) => labels.get(chatId) ?? chatId;
  }, [scopeTargets.data]);
  const query = search.trim().toLocaleLowerCase(locale);
  // The memory filter selects whole operations and composes with the chips and search
  // rather than replacing them; each matching operation keeps its full event list.
  const filteredOperations = useMemo(
    () =>
      memoryFilterId
        ? operations.filter((operation) => operationReferencesMemory(operation, memoryFilterId))
        : operations,
    [operations, memoryFilterId],
  );
  // Counts describe the memory-filtered domain so they match the listed operations.
  const chipCounts = useMemo(
    () => new Map(debugChips.map((candidate) => [candidate, filterByChip(filteredOperations, candidate).length])),
    [filteredOperations],
  );
  const visibleOperations = useMemo(
    () =>
      filterByChip(filteredOperations, chip).filter(
        (operation) => !query || operationMatchesSearch(operation, query, noteTitles, chatLabel, localizeUi, locale),
      ),
    [filteredOperations, chip, query, noteTitles, chatLabel, localizeUi, locale],
  );
  const selectedOperation = useMemo(
    () => operations.find((operation) => operation.operationId === selectedOperationId) ?? null,
    [operations, selectedOperationId],
  );
  const selectedRecallEvent = selectedOperation?.events.find((event) => event.action === "recall_explanation");
  const recallWorkflow = recallDetails(selectedRecallEvent) as {
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

  // Copy JSON is the only path to raw records: it writes the selected operation's
  // events verbatim, identifiers and response snippet included.
  const copyOperationJson = async (operation: DebugOperation) => {
    setActionError("");
    const text = JSON.stringify(operation.events, null, 2);
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
    setCopiedOperationId(operation.operationId);
    window.setTimeout(
      () => setCopiedOperationId((current) => (current === operation.operationId ? null : current)),
      2_000,
    );
  };

  const activityRef = useRef<HTMLElement>(null);
  const selectOperation = (operationId: string) => {
    setSelectedOperationId(operationId);
    // On a phone the workbench is the only visible pane; selecting a row opens it and
    // moves focus to its tab, so focus is not stranded on the now-hidden row. Desktop
    // renders no pane tabs, so the clicked row keeps focus.
    setActivePane("workbench");
    requestAnimationFrame(() =>
      activityRef.current
        ?.querySelector<HTMLElement>('[data-ltm-workspace-pane-tab="workbench"]')
        ?.focus({ preventScroll: true }),
    );
  };

  const renderRecallCandidates = (candidates: Array<Record<string, unknown>>, rejected: boolean) => (
    <ul className="space-y-1 text-[var(--muted-foreground)]">
      {candidates.map((candidate, index) => {
        const noteId = typeof candidate.noteId === "string" ? candidate.noteId : undefined;
        const score = typeof candidate.score === "number" ? candidate.score : undefined;
        const fusedRank = typeof candidate.fusedRank === "number" ? candidate.fusedRank : undefined;
        const title = noteId ? noteTitles.get(noteId) : undefined;
        return (
          <li
            key={`${noteId ?? "candidate"}-${index}`}
            className="flex flex-wrap justify-between gap-2 rounded bg-[var(--background)] px-2 py-1"
          >
            <span>
              {noteId && title && onOpenMemory ? (
                <button
                  type="button"
                  data-ltm-recalled-note={noteId}
                  className="inline-flex min-h-11 min-w-0 items-center truncate text-left text-[var(--primary)] underline underline-offset-2"
                  onClick={() => onOpenMemory(noteId)}
                >
                  {title}
                </button>
              ) : (
                (title ?? noteId ?? localizeUi("ui.longTermMemory.activityview.unknownMemory"))
              )}{" "}
              · {String(candidate.sectionKey ?? "chunk")}
            </span>
            <span>
              {localizeUi("ui.longTermMemory.activityview.relevance")}{" "}
              {fusedRank == null ? null : (
                <>{localizeUi("ui.longTermMemory.activityview.fusedRank", { rank: fusedRank })} · </>
              )}
              {score == null
                ? "--"
                : localizeUi("ui.longTermMemory.activityview.value1", { value1: Math.round(score * 100) })}{" "}
              ·{" "}
              {rejected
                ? candidate.rejectionReason === "lower_rank"
                  ? localizeUi("ui.longTermMemory.activityview.lowerFusedRank")
                  : humanizeLabel(String(candidate.rejectionReason ?? "rejected"))
                : Array.isArray(candidate.lanes)
                  ? candidate.lanes.join(", ")
                  : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );

  const renderDetails = () => {
    if (!selectedOperation) {
      return (
        <div className="mari-editor-panel mari-editor-panel--soft min-h-11 px-3 py-3 text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.longTermMemory.activityview.selectOperation")}
        </div>
      );
    }
    const firstEvent = selectedOperation.events[0];
    const lastEvent = selectedOperation.events.at(-1)!;
    const status = operationStatus(selectedOperation.events, localizeUi);
    const title = actionLabel(firstEvent.action, localizeUi);
    const model = selectedOperation.events.find((event) => event.model)?.model;
    const provider = selectedOperation.events.find((event) => event.provider)?.provider;
    const durationMs = lastEvent.durationMs;
    const countSummary = summarizeCounts(selectedOperation.events, localizeUi, locale);
    const problems = problemMessages(selectedOperation.events, noteTitles, localizeUi);
    const subject = operationSubject(selectedOperation, noteTitles, chatLabel);
    return (
      <article data-ltm-debug-details className="mari-editor-panel min-w-0 space-y-3 p-3 text-xs">
        <header className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{title}</h3>
            <span
              className={status.status === "error" ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]"}
            >
              {status.label}
            </span>
          </div>
          {subject?.kind === "chat" ? (
            <p className="text-[var(--muted-foreground)]" data-ltm-debug-recall-source={subject.value}>
              {localizeUi("ui.longTermMemory.activityview.recallSource", { source: subject.value })}
            </p>
          ) : null}
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{formatTimestamp(lastEvent.ts, locale)}</p>
          <Button
            aria-label={localizeUi("ui.longTermMemory.activityview.copyJsonForOperation", { value1: title })}
            onClick={() => void copyOperationJson(selectedOperation)}
          >
            {copiedOperationId === selectedOperation.operationId ? (
              <Check aria-hidden="true" size="0.875rem" />
            ) : (
              <Copy aria-hidden="true" size="0.875rem" />
            )}
            {localizeUi("ui.longTermMemory.activityview.copyJson")}
          </Button>
          <span className="sr-only" role="status">
            {copiedOperationId === selectedOperation.operationId
              ? localizeUi("ui.longTermMemory.activityview.copied")
              : ""}
          </span>
        </header>
        {problems.length ? (
          <ul className="list-disc pl-4 text-[var(--marinara-editor-warning)]" data-ltm-activity-warnings>
            {problems.map((problem, index) => (
              <li key={`${problem}-${index}`}>{problem}</li>
            ))}
          </ul>
        ) : null}
        {recallWorkflow ? (
          <>
            {recallWorkflow.selected?.length ? (
              <section>
                <h4 className="mb-1 font-semibold">{localizeUi("ui.longTermMemory.activityview.selectedChunks")}</h4>
                {renderRecallCandidates(recallWorkflow.selected, false)}
              </section>
            ) : null}
            {recallWorkflow.rejected?.length ? (
              <section>
                <h4 className="mb-1 font-semibold">
                  {localizeUi("ui.longTermMemory.activityview.rejectedCandidatesUpTo", {
                    limit: recallWorkflow.rejectedLimit ?? 20,
                  })}
                </h4>
                {renderRecallCandidates(recallWorkflow.rejected, true)}
              </section>
            ) : null}
            <section>
              <h4 className="mb-1 font-semibold">{localizeUi("ui.longTermMemory.activityview.runParameters")}</h4>
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
                  {(selectedRecallEvent?.counts?.usedTokens ?? 0).toLocaleString(locale)}{" "}
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
                <p className="mt-1 text-[var(--muted-foreground)]">
                  {localizeUi("ui.longTermMemory.activityview.weights")}{" "}
                  {Object.entries(recallWorkflow.weights)
                    .map(([name, value]) => `${humanizeLabel(name)} ${value}`)
                    .join(" · ")}
                </p>
              ) : null}
            </section>
          </>
        ) : null}
        <section data-ltm-debug-facts>
          <h4 className="mb-1 font-semibold">{localizeUi("ui.longTermMemory.activityview.paneDetails")}</h4>
          <div className="grid gap-1 text-[var(--muted-foreground)] sm:grid-cols-2">
            {subject?.kind === "memory" ? (
              <span>
                {localizeUi("ui.longTermMemory.activityview.detailSource")}: {subject.value}
              </span>
            ) : null}
            {model ? (
              <span>
                {localizeUi("ui.longTermMemory.activityview.detailModel")}: {model}
              </span>
            ) : null}
            {provider ? (
              <span>
                {localizeUi("ui.longTermMemory.activityview.detailProvider")}: {provider}
              </span>
            ) : null}
            {durationMs != null ? (
              <span>
                {localizeUi("ui.longTermMemory.activityview.detailDuration")}:{" "}
                {localizeUi("ui.longTermMemory.activityview.durationMs", {
                  value: durationMs.toLocaleString(locale),
                })}
              </span>
            ) : null}
          </div>
          {countSummary ? <p className="mt-1 text-[var(--muted-foreground)]">{countSummary}</p> : null}
        </section>
        <section>
          <h4 className="mb-1 font-semibold">{localizeUi("ui.longTermMemory.activityview.whatHappened")}</h4>
          <ol className="space-y-2">
            {selectedOperation.events.map((event) => {
              const eventStatus = operationStatus([event], localizeUi, false);
              return (
                <li key={event.id} className="border-l-2 border-[var(--border)] pl-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {localizedLabel(event.phase, localizeUi, labelKeys.debugPhase)} /{" "}
                      {actionLabel(event.action, localizeUi)}
                    </span>
                    <span
                      className={
                        event.status === "error" ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]"
                      }
                    >
                      {eventStatus.label}
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
                </li>
              );
            })}
          </ol>
        </section>
      </article>
    );
  };

  const groups = [
    { key: "today", labelKey: "ui.longTermMemory.activityview.groupToday", operations: [] as DebugOperation[] },
    { key: "earlier", labelKey: "ui.longTermMemory.activityview.groupEarlier", operations: [] as DebugOperation[] },
  ];
  for (const operation of visibleOperations) {
    const lastEvent = operation.events.at(-1)!;
    (isToday(lastEvent.ts) ? groups[0] : groups[1]).operations.push(operation);
  }

  return (
    <section ref={activityRef} data-ltm-surface="activity" aria-labelledby="ltm-activity-title" className="space-y-4">
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
            disabled={activity.isFetching}
            onClick={() => {
              void activity.refetch().then((result) => {
                if (!result.isError) setActionError("");
              });
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

      <LtmWorkspace
        activeMobilePane={activePane}
        onMobilePaneChange={setActivePane}
        switcherLabel={localizeUi("ui.longTermMemory.activityview.paneSwitcher")}
        navigator={{
          label: localizeUi("ui.longTermMemory.activityview.paneEvents"),
          content: (
            <div className="space-y-3">
              <div className="mari-editor-panel mari-editor-panel--soft space-y-2 p-3" data-ltm-debug-controls>
                {memoryFilterId ? (
                  <div className="space-y-1">
                    <span
                      data-ltm-debug-memory-filter={memoryFilterId}
                      className="inline-flex min-h-11 max-w-full items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--secondary)]/35 pl-3 pr-1 text-xs"
                    >
                      <span className="min-w-0 truncate">
                        {localizeUi("ui.longTermMemory.activityview.memoryFilter", {
                          memory:
                            noteTitles.get(memoryFilterId) ??
                            localizeUi("ui.longTermMemory.activityview.unknownMemory"),
                        })}
                      </span>
                      <button
                        type="button"
                        aria-label={localizeUi("ui.longTermMemory.activityview.clearMemoryFilter")}
                        title={localizeUi("ui.longTermMemory.activityview.clearMemoryFilter")}
                        onClick={() => setMemoryFilterId(null)}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                      >
                        <X aria-hidden="true" size="0.875rem" />
                      </button>
                    </span>
                    <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                      {localizeUi("ui.longTermMemory.activityview.memoryFilterCoverage")}
                    </p>
                  </div>
                ) : null}
                <label className="relative block">
                  <Search
                    aria-hidden="true"
                    size="0.875rem"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                  />
                  <input
                    className={`${inputClass} pl-9 pr-10`}
                    data-ltm-debug-search
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={localizeUi("ui.longTermMemory.activityview.searchActivity")}
                    aria-label={localizeUi("ui.longTermMemory.activityview.searchActivity")}
                  />
                  {search ? (
                    <button
                      type="button"
                      aria-label={localizeUi("ui.longTermMemory.activityview.clearSearch")}
                      title={localizeUi("ui.longTermMemory.activityview.clearSearch")}
                      onClick={() => setSearch("")}
                      className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                    >
                      <X aria-hidden="true" size="0.875rem" />
                    </button>
                  ) : null}
                </label>
                <div
                  role="group"
                  aria-label={localizeUi("ui.longTermMemory.activityview.showEvents")}
                  className="flex flex-wrap gap-2"
                >
                  {debugChips.map((candidate) => (
                    <Button
                      key={candidate}
                      data-ltm-debug-chip={candidate}
                      aria-pressed={chip === candidate}
                      onClick={() => setChip(candidate)}
                    >
                      {localizeUi(
                        candidate === "all"
                          ? "ui.longTermMemory.activityview.chipAll"
                          : candidate === "problems"
                            ? "ui.longTermMemory.activityview.chipProblems"
                            : candidate === "recall"
                              ? "ui.longTermMemory.activityview.chipRecall"
                              : "ui.longTermMemory.activityview.chipExtraction",
                      )}{" "}
                      <span className="text-[var(--muted-foreground)]">{chipCounts.get(candidate) ?? 0}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <section
                data-ltm-debug-list
                aria-label={localizeUi("ui.longTermMemory.activityview.longTermMemoryActivityLog")}
                className="mari-editor-panel min-w-0"
                style={{ maxHeight: "calc(100vh - 12rem)", overflowY: "auto" }}
              >
                {activity.data && visibleOperations.length === 0 ? (
                  <StatusSurface>
                    {memoryFilterId
                      ? localizeUi("ui.longTermMemory.activityview.noOperationsForMemory")
                      : activity.data.events.length === 0
                        ? localizeUi("ui.longTermMemory.activityview.noActivityHasBeenRecordedYet")
                        : localizeUi("ui.longTermMemory.activityview.noActivityMatchesThisFilter")}
                  </StatusSurface>
                ) : (
                  groups.map((group) =>
                    group.operations.length ? (
                      <div key={group.key} data-ltm-debug-group={group.key}>
                        <h4 className="border-b border-[var(--border)] bg-[var(--secondary)]/35 px-3 py-2 text-[0.6875rem] font-semibold">
                          {localizeUi(group.labelKey)}
                        </h4>
                        <ul className="divide-y divide-[var(--border)]">
                          {group.operations.map((operation) => {
                            const firstEvent = operation.events[0];
                            const lastEvent = operation.events.at(-1)!;
                            const status = operationStatus(operation.events, localizeUi);
                            const principalEvent =
                              operation.events.find((event) => event.status === "error") ??
                              operation.events.find(
                                (event) => event.status === "warning" || isTruncatedResponse(event),
                              ) ??
                              lastEvent;
                            const summary = compactSummary(describeEvent(principalEvent, noteTitles, localizeUi));
                            const subject = operationSubject(operation, noteTitles, chatLabel);
                            return (
                              <li key={operation.operationId}>
                                <button
                                  type="button"
                                  data-ltm-debug-operation={operation.operationId}
                                  aria-pressed={selectedOperationId === operation.operationId}
                                  onClick={() => selectOperation(operation.operationId)}
                                  className="flex min-h-11 w-full items-start gap-2 px-3 py-2 text-left hover:bg-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                                >
                                  <span
                                    className={
                                      status.status === "error"
                                        ? "mt-0.5 shrink-0 text-[var(--destructive)]"
                                        : "mt-0.5 shrink-0 text-[var(--muted-foreground)]"
                                    }
                                    data-ltm-debug-status={status.status}
                                  >
                                    <status.Icon aria-hidden="true" size="0.875rem" />
                                    <span className="sr-only">{status.label}</span>
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center gap-2 text-xs">
                                      <span className="font-semibold">
                                        {actionLabel(firstEvent.action, localizeUi)}
                                      </span>
                                      {subject ? (
                                        <span className="min-w-0 truncate font-normal text-[var(--muted-foreground)]">
                                          · {subject.value}
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className="mt-1 block text-xs text-[var(--muted-foreground)]">{summary}</span>
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null,
                  )
                )}
              </section>

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
            </div>
          ),
        }}
        workbench={{
          label: localizeUi("ui.longTermMemory.activityview.paneDetails"),
          content: renderDetails(),
        }}
      />
    </section>
  );
}
