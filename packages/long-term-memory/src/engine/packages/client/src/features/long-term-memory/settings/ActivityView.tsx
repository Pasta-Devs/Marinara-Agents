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
import type {
  LtmDebugEvent,
  LtmDraftReviewResponse,
  LtmExtractionDropReason,
  LtmNote,
  LtmStatusResponse,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  errorMessage,
  failedResponseError,
  invalidateLtmQueries,
  queryKeys,
  request,
  requestNotesByIds,
  requestRaw,
  scopeTargetsQueryOptions,
} from "../api";
import { Button, InfoPopover, StatusSurface, inputClass } from "../shared-controls";
import { humanizeLabel, labelKeys, localizedLabel, rejectionReasonLabels } from "../display-labels";
import type { LongTermMemoryDestinationProps } from "../types";
import { confirm } from "./settings-shared";
import { selectLtmPluralForm, useLtmTranslation, type LtmTranslationFunction } from "../localization";
import { LtmWorkspace, type LtmWorkspacePane } from "../LtmWorkspace";
import {
  collectDebugNoteIds,
  deriveOperationStatus,
  filterOperations,
  formatAge,
  formatDuration,
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

// D23: a timeline step reports its own lifecycle verb. A recorded start step inside a
// completed operation reads "Started", not the whole-operation "Running"; the stale
// threshold and "No completion recorded" wording stay whole-operation only.
const timelineStatusLabelKeys: Record<DebugOperationStatus, string> = {
  started: "ui.longTermMemory.activityview.started",
  ok: "ui.longTermMemory.activityview.succeeded",
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
  evidence_units_compiled: "ui.longTermMemory.activityview.actionCompileEvidence",
  candidate_reconciliation: "ui.longTermMemory.activityview.actionCandidateReconciliation",
  draft_deferred: "ui.longTermMemory.activityview.actionDraftDeferred",
  apply_draft: "ui.longTermMemory.activityview.actionApplyDraft",
  mutations_selected: "ui.longTermMemory.activityview.actionApplyDraft",
};

// D20: known runtime count/weight names render as readable labels instead of humanized
// camelCase. Unknown keys keep the humanized fallback, so new server counters stay legible.
const weightLabelKeys: Record<string, string> = {
  semanticWeight: "ui.longTermMemory.activityview.weightSemantic",
  lexicalWeight: "ui.longTermMemory.activityview.weightLexical",
  graphWeight: "ui.longTermMemory.activityview.weightGraph",
  keywordWeight: "ui.longTermMemory.activityview.weightKeyword",
};

const countLabelKeys: Record<string, string> = {
  usedTokens: "ui.longTermMemory.activityview.countUsedTokens",
  droppedUnits: "ui.longTermMemory.activityview.countDroppedUnits",
  totalCandidates: "ui.longTermMemory.activityview.countTotalCandidates",
  deduplications: "ui.longTermMemory.activityview.countDeduped",
  targetNotes: "ui.longTermMemory.activityview.countTargetMemories",
  units: "ui.longTermMemory.activityview.countUnits",
  mutations: "ui.longTermMemory.activityview.countMutations",
};

const recallReasonLabelKeys: Record<string, string> = {
  budget: "ui.longTermMemory.activityview.recallReasonBudget",
  lower_rank: "ui.longTermMemory.activityview.lowerFusedRank",
  duplicate_text: "ui.longTermMemory.activityview.recallReasonDuplicate",
  score_threshold: "ui.longTermMemory.activityview.recallReasonThreshold",
  missing_chunk: "ui.longTermMemory.activityview.recallReasonMissingChunk",
  prompt_budget: "ui.longTermMemory.activityview.recallReasonPromptBudget",
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

function formatClock(timestamp: string, locale: string, timeStyle: "short" | "medium") {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleTimeString(locale, { timeStyle });
}

/** The time alone for today, the date and time otherwise. */
function formatWhen(timestamp: string, locale: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return isToday(timestamp)
    ? formatClock(timestamp, locale, "short")
    : date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

/** Prefer the server-provided same-origin filename, else a timestamped jsonl fallback. */
function exportFilename(response: Response) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
  const name = match?.[1]?.trim().replaceAll('"', "");
  if (name) return name;
  return `ltm-debug-log-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.jsonl`;
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
  // A bare "{action}: {status}." only repeats the title and the status icon.
  return "";
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
function operationStatus(
  events: LtmDebugEvent[],
  localizeUi: LtmTranslationFunction,
  applyStaleThreshold = true,
  labels: Record<DebugOperationStatus, string> = debugStatusLabelKeys,
) {
  const status = deriveOperationStatus(
    events,
    applyStaleThreshold ? { now: Date.now(), staleMs: LTM_DEBUG_STALE_OPERATION_MS } : undefined,
  );
  return { status, label: localizeUi(labels[status]), Icon: debugStatusIcons[status] };
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
          label: localizedLabel(label, localizeUi, countLabelKeys).toLocaleLowerCase(locale),
        }),
      ),
  );
  // D21: one separator for operation metadata and count parts; the locale supplies it.
  return summary.join(localizeUi("ui.longTermMemory.activityview.metaSeparator"));
}

// The server logs a compile-evidence warning with a count of candidates that failed checks and the
// model's own summary of the extraction; the warning is about the count, so the summary never names it.
function isCompileWarning(event: LtmDebugEvent) {
  return (
    event.action === "evidence_units_compiled" &&
    event.status === "warning" &&
    !event.error &&
    !isTruncatedResponse(event)
  );
}

function unnamedProblem(event: LtmDebugEvent, localizeUi: LtmTranslationFunction, locale: string) {
  if (event.action === "evidence_units_compiled") {
    const count = event.counts?.candidateRejectionDiagnostics;
    if (typeof count !== "number" || !Number.isFinite(count))
      return localizeUi("ui.longTermMemory.activityview.candidatesFailedChecksSome");
    return localizeUi(
      selectLtmPluralForm(locale, count) === "one"
        ? "ui.longTermMemory.activityview.candidatesFailedChecksOne"
        : "ui.longTermMemory.activityview.candidatesFailedChecks",
      { count: count.toLocaleString(locale) },
    );
  }
  return localizeUi("ui.longTermMemory.activityview.eventDescription", {
    action: actionLabel(event.action, localizeUi),
    detail: humanizeLabel(event.status),
  });
}

/** Errors, warnings and truncated responses are the operation's problems, whole-operation scoped. */
function problemMessages(
  events: LtmDebugEvent[],
  noteTitles: ReadonlyMap<string, string>,
  localizeUi: LtmTranslationFunction,
  locale: string,
) {
  return events
    .filter((event) => event.status === "error" || event.status === "warning" || isTruncatedResponse(event))
    .map((event) => ({
      message: isCompileWarning(event)
        ? unnamedProblem(event, localizeUi, locale)
        : describeEvent(event, noteTitles, localizeUi) || unnamedProblem(event, localizeUi, locale),
      guidance:
        isTruncatedResponse(event) || event.details?.reason === "output_budget_below_viability_floor"
          ? "ui.longTermMemory.activityview.tryOutputBudget"
          : event.details?.reason === "prompt_trim_required"
            ? "ui.longTermMemory.activityview.tryContext"
            : "ui.longTermMemory.activityview.tryRecordedProblem",
    }));
}

function recordDetails(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function recordRows(value: unknown) {
  return Array.isArray(value) ? value.map(recordDetails).filter((row) => row !== null) : [];
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

function recordedCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Result counts as large numbers over labels. A count the log did not record is left out. */
function renderResultCounts(
  counts: ReadonlyArray<readonly [value: number | null, one: string, other: string]>,
  localizeUi: LtmTranslationFunction,
  locale: string,
) {
  const recorded = counts.filter((count): count is readonly [number, string, string] => count[0] !== null);
  if (!recorded.length) return <p>{localizeUi("ui.longTermMemory.activityview.notRecorded")}</p>;
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {recorded.map(([value, one, other], index) => (
        <li key={other} className="flex items-center gap-3">
          {index ? (
            <span aria-hidden="true" className="text-[var(--muted-foreground)]">
              →
            </span>
          ) : null}
          <span>
            <span className="block text-lg font-semibold tabular-nums">{value.toLocaleString(locale)}</span>
            <span className="text-[var(--muted-foreground)]">
              {localizeUi(selectLtmPluralForm(locale, value) === "one" ? one : other)}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Saved and skipped change counts, in the shape the server logs on `mutations_selected`. */
function appliedChangeCounts(event: LtmDebugEvent) {
  const skipped = event.details?.skippedMutationIds;
  return Array.isArray(event.mutationIds) && Array.isArray(skipped)
    ? { saved: event.mutationIds.length, skipped: skipped.length }
    : null;
}

/** One sentence for what a log record did, from the counts it logged; null when the record has no such sentence. */
function stepText(
  event: LtmDebugEvent,
  localizeUi: LtmTranslationFunction,
  locale: string,
): { text: string; note?: string; hasDuration?: boolean } | null {
  if (event.status === "error" || event.status === "skipped") return null;
  const count = (value: number | null) => (value === null ? null : value.toLocaleString(locale));
  switch (event.action) {
    case "evidence_unit_request": {
      const tokens = count(
        recordedCount(event.counts?.estimatedPromptTokens ?? event.counts?.promptTokens ?? event.counts?.inputTokens),
      );
      return {
        text: localizeUi("ui.longTermMemory.activityview.stepSentToModel"),
        note: tokens ? localizeUi("ui.longTermMemory.activityview.estimatedInputTokens", { count: tokens }) : undefined,
      };
    }
    case "evidence_unit_response":
      return event.durationMs != null
        ? {
            text: localizeUi("ui.longTermMemory.activityview.stepModelRepliedAfter", {
              duration: formatDuration(event.durationMs, locale, localizeUi),
            }),
            hasDuration: true,
          }
        : { text: localizeUi("ui.longTermMemory.activityview.stepModelReplied") };
    case "evidence_units_compiled": {
      const kept = recordedCount(event.counts?.units);
      const candidates = recordedCount(event.counts?.totalCandidates);
      if (kept === null || candidates === null) return null;
      return {
        text: localizeUi(
          selectLtmPluralForm(locale, candidates) === "one"
            ? "ui.longTermMemory.activityview.stepKeptOne"
            : "ui.longTermMemory.activityview.stepKept",
          { kept: kept.toLocaleString(locale), candidates: candidates.toLocaleString(locale) },
        ),
      };
    }
    case "draft_deferred":
      return { text: localizeUi("ui.longTermMemory.activityview.stepPrepared") };
    case "mutations_selected": {
      const applied = appliedChangeCounts(event);
      if (!applied) return null;
      const total = applied.saved + applied.skipped;
      return {
        text: localizeUi(
          selectLtmPluralForm(locale, total) === "one"
            ? "ui.longTermMemory.activityview.stepSelectedOne"
            : "ui.longTermMemory.activityview.stepSelected",
          { saved: applied.saved.toLocaleString(locale), total: total.toLocaleString(locale) },
        ),
      };
    }
    case "apply_draft":
      return event.status === "ok" ? { text: localizeUi("ui.longTermMemory.activityview.stepSaved") } : null;
    case "recall_explanation": {
      const eligible = recordedCount(event.details?.eligibleChunks);
      const selected = count(recordedCount(event.counts?.selected));
      if (eligible === null || !selected) return null;
      return {
        text: localizeUi(
          selectLtmPluralForm(locale, eligible) === "one"
            ? "ui.longTermMemory.activityview.stepRankedOne"
            : "ui.longTermMemory.activityview.stepRanked",
          { eligible: eligible.toLocaleString(locale), selected },
        ),
      };
    }
    default:
      return null;
  }
}

/** The outcome in a few words, from counts the log already holds; empty when none were recorded. */
function operationOutcome(operation: DebugOperation, localizeUi: LtmTranslationFunction, locale: string) {
  const recall = operation.events.find((event) => event.action === "recall_explanation");
  if (recall) {
    const selected = recordedCount(recall.counts?.selected);
    const rejected = recordedCount(recall.counts?.rejected);
    if (selected === 0) return localizeUi("ui.longTermMemory.activityview.nothingAdded");
    if (selected !== null && rejected !== null)
      return localizeUi("ui.longTermMemory.activityview.recallCounts", {
        selected: selected.toLocaleString(locale),
        rejected: rejected.toLocaleString(locale),
      });
  }
  const total = (values: (number | null)[]) =>
    values.length && values.every((value) => value !== null)
      ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
      : null;
  const compiled = operation.events.filter((event) => event.action === "evidence_units_compiled");
  const kept = total(compiled.map((event) => recordedCount(event.counts?.units)));
  const candidates = total(compiled.map((event) => recordedCount(event.counts?.totalCandidates)));
  if (kept !== null && candidates !== null)
    return localizeUi("ui.longTermMemory.activityview.keptOfCandidates", {
      kept: kept.toLocaleString(locale),
      candidates: candidates.toLocaleString(locale),
    });
  const applied = operation.events.filter((event) => event.action === "mutations_selected").map(appliedChangeCounts);
  const saved = total(applied.map((counts) => counts && counts.saved));
  const skipped = total(applied.map((counts) => counts && counts.skipped));
  if (saved !== null && skipped !== null)
    return localizeUi("ui.longTermMemory.activityview.savedSkipped", {
      saved: saved.toLocaleString(locale),
      skipped: skipped.toLocaleString(locale),
    });
  return "";
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
    if (Array.isArray(details.targetNoteIds) && details.targetNoteIds.includes(memoryId)) return true;
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

export default function ActivityView({
  props,
  onOpenMemory,
  onOpenReview,
  openActivityMemoryId,
  onOpenActivityMemoryIdHandled,
}: LongTermMemoryDestinationProps) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const recordedNumber = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value)
      ? value.toLocaleString(locale)
      : localizeUi("ui.longTermMemory.activityview.notRecorded");
  const relevance = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value)
      ? localizeUi("ui.longTermMemory.activityview.value1", { value1: Math.round(value * 100) })
      : localizeUi("ui.longTermMemory.activityview.notRecorded");
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<"clear" | "export" | null>(null);
  const [actionState, setActionState] = useState<{ text: string; tone: "success" | "danger" }>({
    text: "",
    tone: "success",
  });
  const [copiedOperationId, setCopiedOperationId] = useState<string | null>(null);
  const refreshRef = useRef<HTMLButtonElement>(null);
  const exportRef = useRef<HTMLButtonElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  // D06: the initiating toolbar control keeps focus across the action and the host
  // confirmation flow instead of stranding focus on a dismissed dialog.
  const restoreFocus = (ref: { current: HTMLButtonElement | null }) =>
    requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }));
  // A native `disabled` button drops keyboard focus while its action runs, so the
  // toolbar controls stay focusable with `aria-disabled` plus this synchronous guard,
  // which also blocks a duplicate action before React re-renders.
  const pendingRef = useRef(false);
  const beginPending = (kind: "clear" | "export") => {
    if (pendingRef.current) return false;
    pendingRef.current = true;
    setPending(kind);
    return true;
  };
  const endPending = () => {
    pendingRef.current = false;
    setPending(null);
  };
  const [chip, setChip] = useState<DebugChip>("all");
  const [search, setSearch] = useState("");
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);
  const [hoveredOperationId, setHoveredOperationId] = useState<string | null>(null);
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
  // Shares the shell's cached /status query rather than adding an endpoint; pending or
  // errored status is never flattened into "healthy".
  const health = useQuery({
    queryKey: queryKeys.status,
    queryFn: () => request<LtmStatusResponse>("/status"),
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
  const scopeTargets = useQuery(scopeTargetsQueryOptions(props.chatId));
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
  const review = useQuery({
    queryKey: queryKeys.review,
    queryFn: () => request<LtmDraftReviewResponse>("/drafts/review?includeInvalidated=true"),
    enabled: Boolean(onOpenReview && selectedOperation?.events.some((event) => event.action === "draft_deferred")),
  });
  const recallWorkflow = recordDetails(selectedRecallEvent?.details) as {
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
    // Acquire the guard before the host confirmation (export does the same in
    // `beginPending`) so a second activation in the same turn cannot open a duplicate
    // dialog; a cancel or failure releases it in `finally`.
    if (!beginPending("clear")) return;
    try {
      if (
        !(await confirm(
          props,
          localizeUi("ui.longTermMemory.activityview.clearActivityLog"),
          localizeUi("ui.longTermMemory.activityview.clearActivityLogDescription"),
          localizeUi("ui.longTermMemory.activityview.clearLog"),
          true,
        ))
      )
        return;
      setActionState({ text: "", tone: "success" });
      await request<unknown>("/debug-log", "DELETE");
      await invalidateLtmQueries(queryClient, [queryKeys.activity]);
      setActionState({ text: localizeUi("ui.longTermMemory.activityview.clearedLog"), tone: "success" });
    } catch (error) {
      setActionState({
        text: errorMessage(error, localizeUi("ui.longTermMemory.activityview.couldNotClearActivity")),
        tone: "danger",
      });
    } finally {
      endPending();
      restoreFocus(clearRef);
    }
  };

  const exportLog = async () => {
    if (!beginPending("export")) return;
    setActionState({ text: "", tone: "success" });
    try {
      const response = await requestRaw("/debug-log/export");
      if (!response.ok) throw await failedResponseError(response);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exportFilename(response);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
      setActionState({ text: localizeUi("ui.longTermMemory.activityview.exportedFullLog"), tone: "success" });
    } catch (error) {
      setActionState({
        text: errorMessage(error, localizeUi("ui.longTermMemory.activityview.couldNotExportActivity")),
        tone: "danger",
      });
    } finally {
      endPending();
      restoreFocus(exportRef);
    }
  };

  // Copy JSON is the only path to raw records: it writes the selected operation's
  // events verbatim, identifiers and response snippet included.
  const copyOperationJson = async (operation: DebugOperation) => {
    setActionState({ text: "", tone: "success" });
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
      setActionState({
        text: localizeUi("ui.longTermMemory.activityview.couldNotCopyTechnicalDetails"),
        tone: "danger",
      });
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
    <ul className="divide-y divide-[var(--border)]">
      {candidates.map((candidate, index) => {
        const noteId = typeof candidate.noteId === "string" ? candidate.noteId : undefined;
        const score = typeof candidate.score === "number" ? candidate.score : undefined;
        const fusedRank = typeof candidate.fusedRank === "number" ? candidate.fusedRank : undefined;
        const title = noteId ? noteTitles.get(noteId) : undefined;
        const threshold = recallWorkflow?.scoreThreshold;
        const percent = (value: number) => `${Math.min(100, Math.max(0, value * 100))}%`;
        // The limit that applied, when the run recorded it; the generic reason otherwise.
        const reasonKey = String(candidate.rejectionReason ?? "rejected");
        const maxTokens = recordedCount(recallWorkflow?.maxTokens);
        const maxChunks = recordedCount(recallWorkflow?.maxChunks);
        const reason =
          reasonKey === "budget" && maxTokens !== null
            ? localizeUi("ui.longTermMemory.activityview.recallReasonTokenLimit", {
                tokens: maxTokens.toLocaleString(locale),
              })
            : reasonKey === "lower_rank" && maxChunks !== null
              ? localizeUi("ui.longTermMemory.activityview.recallReasonMemoryLimit", {
                  count: maxChunks.toLocaleString(locale),
                })
              : localizedLabel(reasonKey, localizeUi, recallReasonLabelKeys);
        const lanes = Array.isArray(candidate.lanes)
          ? candidate.lanes.join(localizeUi("ui.longTermMemory.activityview.listSeparator"))
          : "";
        return (
          <li key={`${noteId ?? "candidate"}-${index}`} className="grid gap-1 py-2 text-[var(--muted-foreground)]">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-0">
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
                )}
                {localizeUi("ui.longTermMemory.activityview.metaSeparator")}
                {String(candidate.sectionKey ?? localizeUi("ui.longTermMemory.activityview.sectionKeyFallback"))}
              </span>
              <span className="flex items-center gap-2">
                {score === undefined ? null : (
                  <span aria-hidden="true" className="relative h-1.5 w-14 rounded-full bg-[var(--border)]">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-[var(--primary)]"
                      style={{ width: percent(score) }}
                    />
                    {typeof threshold === "number" && Number.isFinite(threshold) ? (
                      <span
                        className="absolute -top-0.5 -bottom-0.5 w-0.5 -translate-x-1/2 bg-[var(--foreground)]"
                        style={{ left: percent(threshold) }}
                      />
                    ) : null}
                  </span>
                )}
                <span className="tabular-nums">{relevance(score)}</span>
                {fusedRank === undefined ? null : (
                  <span>
                    {localizeUi("ui.longTermMemory.activityview.metaSeparator")}
                    {localizeUi("ui.longTermMemory.activityview.fusedRank", { rank: fusedRank })}
                  </span>
                )}
              </span>
            </div>
            {rejected ? <p>{reason}</p> : lanes ? <p>{lanes}</p> : null}
          </li>
        );
      })}
    </ul>
  );

  const renderDroppedCandidates = (event: LtmDebugEvent, showSource: boolean) => {
    const outcome = recordDetails(event.details?.extractionOutcome);
    const dropped = recordRows(outcome?.droppedCandidates);
    const groups = new Map<string, typeof dropped>();
    for (const candidate of dropped) {
      const reason = typeof candidate.reason === "string" ? candidate.reason : "other";
      const candidates = groups.get(reason) ?? [];
      candidates.push(candidate);
      groups.set(reason, candidates);
    }
    const droppedUnits =
      typeof outcome?.droppedUnits === "number" && Number.isFinite(outcome.droppedUnits)
        ? outcome.droppedUnits
        : event.counts?.droppedUnits;
    const remaining =
      typeof droppedUnits === "number" && Number.isFinite(droppedUnits)
        ? Math.max(0, droppedUnits - dropped.length)
        : null;
    const draftId = selectedOperation?.events.find(
      (item) => item.draftId && item.sourceNoteId === event.sourceNoteId,
    )?.draftId;
    const pendingDraft =
      !review.isError &&
      review.data?.sources.some(
        (source) =>
          source.sourceNoteId === event.sourceNoteId &&
          source.drafts.some(
            (item) =>
              item.draft.status === "pending" &&
              item.freshness !== "not_pending" &&
              (!draftId || item.draft.id === draftId),
          ),
      );
    return (
      <div key={event.id} className="space-y-2">
        {showSource && event.sourceNoteId ? (
          <p className="font-medium">{noteTitles.get(event.sourceNoteId) ?? event.sourceNoteId}</p>
        ) : null}
        <p>
          {remaining != null
            ? localizeUi("ui.longTermMemory.activityview.notKeptCount", { count: recordedNumber(droppedUnits) })
            : localizeUi("ui.longTermMemory.activityview.notRecorded")}
        </p>
        {[...groups].map(([reason, candidates]) => (
          <div key={reason} data-ltm-debug-drop-reason={reason}>
            <h5 className="font-medium">
              {localizeUi(
                rejectionReasonLabels[reason as LtmExtractionDropReason] ??
                  "ui.longTermMemory.reviewqueue.rejectionReasonOther",
              )}{" "}
              ({candidates.length})
            </h5>
            <ul className="space-y-2 pl-3">
              {candidates.map((candidate, index) => (
                <li key={index}>
                  {typeof candidate.message === "string" ? <p>{candidate.message}</p> : null}
                  {typeof candidate.snippet === "string" && candidate.snippet.trim() ? (
                    <blockquote className="mt-1 text-[var(--muted-foreground)]">{candidate.snippet}</blockquote>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {remaining != null && remaining > 0 ? (
          <p>{localizeUi("ui.longTermMemory.activityview.andMore", { count: recordedNumber(remaining) })}</p>
        ) : null}
        {remaining !== 0 ||
        !Array.isArray(outcome?.droppedCandidates) ||
        outcome?.droppedCandidateDetailsTruncated === true ? (
          <p>{localizeUi("ui.longTermMemory.activityview.samplesOnly")}</p>
        ) : null}
        {pendingDraft && onOpenReview ? (
          <Button onClick={() => onOpenReview(event.sourceNoteId)}>
            {localizeUi("ui.longTermMemory.longtermmemorydetail.openReviewQueue")}
          </Button>
        ) : null}
      </div>
    );
  };

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
    // Recall counts already read under Result and Recall settings used.
    const countSummary = summarizeCounts(
      selectedOperation.events.filter((event) => event.action !== "recall_explanation"),
      localizeUi,
      locale,
    );
    const problems = problemMessages(selectedOperation.events, noteTitles, localizeUi, locale);
    const subject = operationSubject(selectedOperation, noteTitles, chatLabel);
    const compiled = selectedOperation.events.filter((event) => event.action === "evidence_units_compiled");
    const deferred = selectedOperation.events.filter((event) => event.action === "draft_deferred");
    const apply = selectedOperation.events.filter((event) => event.action === "mutations_selected");
    // mutations_selected is logged before the changes are written, so a failed apply saved an unknown share.
    // An auto-apply runs inside the extraction's operation, whose own terminal event can be ok, and one
    // operation can apply several drafts, so a failure counts against its own draft; one with no draft
    // to match counts against every selection.
    const applyFailedFor = (selection: LtmDebugEvent) =>
      selectedOperation.events.some(
        (event) =>
          event.action === "apply_draft" &&
          event.status === "error" &&
          (!event.draftId || !selection.draftId || event.draftId === selection.draftId),
      );
    // `selected` recorded as an empty array, or a recorded count of zero, means nothing was added; a
    // malformed `selected` with no count is not evidence either way.
    const nothingAdded =
      selectedRecallEvent != null &&
      (Array.isArray(recallWorkflow?.selected)
        ? recallWorkflow.selected.length === 0
        : recordedCount(selectedRecallEvent.counts?.selected) === 0);
    const rejectedRows = recordRows(recallWorkflow?.rejected);
    // Rests on the logged rejected sample; the pane already says how many rows the log keeps.
    const allBelowMinimum =
      typeof recallWorkflow?.scoreThreshold === "number" &&
      rejectedRows.length > 0 &&
      rejectedRows.every((row) => row.rejectionReason === "score_threshold");
    // Whole labels with their values; the first four always show, the rest only when the run recorded them.
    const weights = recordDetails(recallWorkflow?.weights);
    const recallSettings: string[][] = recallWorkflow
      ? [
          [localizeUi("ui.longTermMemory.activityview.settingMemoryLimit"), recordedNumber(recallWorkflow.maxChunks)],
          [localizeUi("ui.longTermMemory.activityview.settingTokenLimit"), recordedNumber(recallWorkflow.maxTokens)],
          [
            localizeUi("ui.longTermMemory.activityview.settingMinimumRelevance"),
            relevance(recallWorkflow.scoreThreshold),
          ],
          [
            localizeUi("ui.longTermMemory.activityview.settingTokensUsed"),
            recordedNumber(selectedRecallEvent?.counts?.usedTokens),
          ],
          ...(typeof recallWorkflow.mode === "string"
            ? [[localizeUi("ui.longTermMemory.activityview.settingRecallMode"), humanizeLabel(recallWorkflow.mode)]]
            : []),
          ...(typeof recallWorkflow.contextMessagesUsed === "number"
            ? [
                [
                  localizeUi("ui.longTermMemory.activityview.settingMessagesRead"),
                  recallWorkflow.contextMessagesUsed.toLocaleString(locale),
                ],
              ]
            : []),
          ...(typeof recallWorkflow.indexLoadOutcome === "string"
            ? [
                [
                  localizeUi("ui.longTermMemory.activityview.settingIndex"),
                  humanizeLabel(recallWorkflow.indexLoadOutcome),
                ],
              ]
            : []),
          ...(typeof recallWorkflow.indexGeneratedAt === "string"
            ? [
                [
                  localizeUi("ui.longTermMemory.activityview.settingIndexBuilt"),
                  formatTimestamp(recallWorkflow.indexGeneratedAt, locale),
                ],
              ]
            : []),
          ...(typeof recallWorkflow.embeddedChunks === "number"
            ? [
                [
                  localizeUi("ui.longTermMemory.activityview.settingEmbeddedChunks"),
                  recallWorkflow.embeddedChunks.toLocaleString(locale),
                ],
              ]
            : []),
          ...(typeof recallWorkflow.semanticOutcome === "string"
            ? [
                [
                  localizeUi("ui.longTermMemory.activityview.settingSemanticMatching"),
                  humanizeLabel(recallWorkflow.semanticOutcome),
                ],
              ]
            : []),
          ...(typeof recallWorkflow.includeResolved === "boolean"
            ? [
                [
                  localizeUi("ui.longTermMemory.activityview.settingResolvedMemories"),
                  localizeUi(
                    recallWorkflow.includeResolved
                      ? "ui.longTermMemory.activityview.valueEligible"
                      : "ui.longTermMemory.activityview.valueExcluded",
                  ),
                ],
              ]
            : []),
          ...(typeof recallWorkflow.exclusiveCharacterTargeting === "boolean"
            ? [
                [
                  localizeUi("ui.longTermMemory.activityview.settingCharacterTargeting"),
                  localizeUi(
                    recallWorkflow.exclusiveCharacterTargeting
                      ? "ui.longTermMemory.activityview.valueRespondingCharacter"
                      : "ui.longTermMemory.activityview.valueWholeChat",
                  ),
                ],
              ]
            : []),
          // Weights read as recorded; the log does not guarantee they sum to 1.
          ...(weights
            ? [
                [
                  localizeUi("ui.longTermMemory.activityview.settingRankingWeights"),
                  Object.entries(weights)
                    .filter(([, value]) => typeof value === "number")
                    .map(([name, value]) => `${localizedLabel(name, localizeUi, weightLabelKeys)} ${value}`)
                    .join(localizeUi("ui.longTermMemory.activityview.metaSeparator")),
                ],
              ]
            : []),
        ]
      : [];
    const hasFacts = subject?.kind === "memory" || Boolean(model || provider || countSummary) || durationMs != null;
    return (
      <article
        data-ltm-debug-details
        className="mari-editor-panel min-w-0 space-y-3 p-3 text-xs [overflow-wrap:anywhere]"
      >
        <header className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{title}</h3>
            <span
              data-ltm-debug-detail-status={status.status}
              className={`inline-flex items-center gap-1 ${
                status.status === "error" ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]"
              }`}
            >
              {status.status === "warning" || status.status === "completed_with_warnings" ? (
                <AlertTriangle aria-hidden="true" size="0.875rem" />
              ) : null}
              <span
                className={
                  status.status === "warning" || status.status === "completed_with_warnings"
                    ? "font-semibold"
                    : undefined
                }
              >
                {status.label}
              </span>
            </span>
          </div>
          {subject?.kind === "chat" ? (
            <p className="text-[var(--muted-foreground)]" data-ltm-debug-recall-source={subject.value}>
              {localizeUi("ui.longTermMemory.activityview.recallSource", { source: subject.value })}
            </p>
          ) : null}
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            <time dateTime={lastEvent.ts} title={formatTimestamp(lastEvent.ts, locale)}>
              {formatWhen(lastEvent.ts, locale)}
            </time>
            {[
              formatAge(lastEvent.ts, locale, Date.now()),
              durationMs != null
                ? localizeUi("ui.longTermMemory.activityview.tookDuration", {
                    duration: formatDuration(durationMs, locale, localizeUi),
                  })
                : "",
            ]
              .filter(Boolean)
              .map((part) => `${localizeUi("ui.longTermMemory.activityview.metaSeparator")}${part}`)
              .join("")}
          </p>
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
          <StatusSurface
            tone={status.status === "error" ? "danger" : "warning"}
            className="py-3"
            data-ltm-activity-warnings
          >
            <ul className="space-y-2">
              {problems.map((problem, index) => (
                <li key={index}>
                  <p>{problem.message}</p>
                  <p className="mt-1">
                    <strong>{localizeUi("ui.longTermMemory.activityview.whatToTry")}: </strong>
                    {localizeUi(problem.guidance)}
                  </p>
                </li>
              ))}
            </ul>
          </StatusSurface>
        ) : null}
        {nothingAdded ? (
          <StatusSurface tone="neutral" className="py-3" data-ltm-debug-nothing-added>
            {/* StatusSurface is a flex row; one child keeps the two paragraphs stacked. */}
            <div>
              <p>
                {allBelowMinimum
                  ? localizeUi("ui.longTermMemory.activityview.recallNothingBelowMinimum", {
                      threshold: relevance(recallWorkflow?.scoreThreshold),
                    })
                  : localizeUi("ui.longTermMemory.activityview.recallNothingAdded")}
              </p>
              <p className="mt-1">
                <strong>{localizeUi("ui.longTermMemory.activityview.whatToTry")}: </strong>
                {localizeUi("ui.longTermMemory.activityview.tryRecallNothingAdded")}
              </p>
            </div>
          </StatusSurface>
        ) : null}
        <section>
          <h4 className="mb-1 font-semibold">{localizeUi("ui.longTermMemory.activityview.result")}</h4>
          {selectedRecallEvent ? (
            renderResultCounts(
              [
                [
                  recordedCount(recallWorkflow?.indexedChunks),
                  "ui.longTermMemory.activityview.resultIndexed",
                  "ui.longTermMemory.activityview.resultIndexed",
                ],
                [
                  recordedCount(recallWorkflow?.eligibleChunks),
                  "ui.longTermMemory.activityview.resultUsable",
                  "ui.longTermMemory.activityview.resultUsable",
                ],
                [
                  recordedCount(selectedRecallEvent.counts?.selected),
                  "ui.longTermMemory.activityview.resultAdded",
                  "ui.longTermMemory.activityview.resultAdded",
                ],
              ],
              localizeUi,
              locale,
            )
          ) : compiled.length ? (
            compiled.map((event) => {
              const kinds = recordDetails(event.details?.mutationKinds);
              const targets = event.details?.targetNoteIds;
              return (
                <div key={event.id} className="space-y-1">
                  {compiled.length > 1 && event.sourceNoteId ? (
                    <p>{noteTitles.get(event.sourceNoteId) ?? event.sourceNoteId}</p>
                  ) : null}
                  {renderResultCounts(
                    [
                      [
                        recordedCount(event.counts?.totalCandidates),
                        "ui.longTermMemory.activityview.resultCandidatesFoundOne",
                        "ui.longTermMemory.activityview.resultCandidatesFound",
                      ],
                      [
                        recordedCount(event.counts?.units),
                        "ui.longTermMemory.activityview.resultKept",
                        "ui.longTermMemory.activityview.resultKept",
                      ],
                      [
                        recordedCount(event.counts?.mutations),
                        "ui.longTermMemory.activityview.resultChangesOne",
                        "ui.longTermMemory.activityview.resultChanges",
                      ],
                    ],
                    localizeUi,
                    locale,
                  )}
                  {kinds ? (
                    <p>
                      {Object.entries(kinds)
                        .filter(([, count]) => typeof count === "number")
                        .map(([kind, count]) =>
                          localizeUi("ui.longTermMemory.activityview.countWithLabel", {
                            count: recordedNumber(count),
                            label: humanizeLabel(kind),
                          }),
                        )
                        .join(localizeUi("ui.longTermMemory.activityview.metaSeparator"))}
                    </p>
                  ) : null}
                  {Array.isArray(targets) ? (
                    <p>
                      {targets
                        .filter((id): id is string => typeof id === "string")
                        .map((id) => noteTitles.get(id) ?? id)
                        .join(localizeUi("ui.longTermMemory.activityview.metaSeparator"))}
                    </p>
                  ) : null}
                </div>
              );
            })
          ) : apply.length ? (
            apply.map((event) => {
              const counts = applyFailedFor(event) ? undefined : appliedChangeCounts(event);
              return (
                <div key={event.id}>
                  {renderResultCounts(
                    counts
                      ? [
                          [
                            counts.saved + counts.skipped,
                            "ui.longTermMemory.activityview.resultDraftChangesOne",
                            "ui.longTermMemory.activityview.resultDraftChanges",
                          ],
                          [
                            counts.saved,
                            "ui.longTermMemory.activityview.resultSaved",
                            "ui.longTermMemory.activityview.resultSaved",
                          ],
                        ]
                      : [],
                    localizeUi,
                    locale,
                  )}
                </div>
              );
            })
          ) : (
            <p>{localizeUi("ui.longTermMemory.activityview.notRecorded")}</p>
          )}
        </section>
        {compiled.length || deferred.length ? (
          <section>
            <h4 className="mb-1 font-semibold">{localizeUi("ui.longTermMemory.activityview.notKept")}</h4>
            {deferred.length ? (
              deferred.map((event) => renderDroppedCandidates(event, deferred.length > 1))
            ) : (
              <p>{localizeUi("ui.longTermMemory.activityview.notRecorded")}</p>
            )}
          </section>
        ) : null}
        {apply.length ? (
          <section>
            <h4 className="mb-1 font-semibold">{localizeUi("ui.longTermMemory.activityview.notSaved")}</h4>
            {apply.map((event) => {
              const skipped = applyFailedFor(event) ? undefined : appliedChangeCounts(event)?.skipped;
              return (
                <p key={event.id}>
                  {skipped === undefined
                    ? localizeUi("ui.longTermMemory.activityview.notRecorded")
                    : skipped
                      ? localizeUi(
                          selectLtmPluralForm(locale, skipped) === "one"
                            ? "ui.longTermMemory.activityview.skippedChangesOne"
                            : "ui.longTermMemory.activityview.skippedChanges",
                          { count: skipped.toLocaleString(locale) },
                        )
                      : localizeUi("ui.longTermMemory.activityview.noSkippedChanges")}
                </p>
              );
            })}
          </section>
        ) : null}
        {recallWorkflow ? (
          <>
            {recordRows(recallWorkflow.selected).length ? (
              <section>
                <h4 className="mb-1 font-semibold">{localizeUi("ui.longTermMemory.activityview.added")}</h4>
                {renderRecallCandidates(recordRows(recallWorkflow.selected), false)}
              </section>
            ) : null}
            {recordRows(recallWorkflow.rejected).length ? (
              <section>
                <h4 className="mb-1 font-semibold">{localizeUi("ui.longTermMemory.activityview.notAdded")}</h4>
                <p className="mb-1 text-[var(--muted-foreground)]">
                  {localizeUi("ui.longTermMemory.activityview.rejectedCandidatesUpTo", {
                    limit: recallWorkflow.rejectedLimit ?? 20,
                  })}
                </p>
                {renderRecallCandidates(recordRows(recallWorkflow.rejected), true)}
              </section>
            ) : null}
            <section>
              <h4 className="mb-1 font-semibold">{localizeUi("ui.longTermMemory.activityview.recallSettingsUsed")}</h4>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {recallSettings.map(([term, value]) => (
                  <div key={term}>
                    <dt className="text-[var(--muted-foreground)]">{term}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </>
        ) : null}
        {hasFacts ? (
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
                  {formatDuration(durationMs, locale, localizeUi)}
                </span>
              ) : null}
            </div>
            {countSummary ? <p className="mt-1 text-[var(--muted-foreground)]">{countSummary}</p> : null}
          </section>
        ) : null}
        <section>
          <h4 className="mb-1 font-semibold">{localizeUi("ui.longTermMemory.activityview.whatHappened")}</h4>
          <ol className="space-y-2">
            {selectedOperation.events.map((event) => {
              const eventStatus = operationStatus([event], localizeUi, false, timelineStatusLabelKeys);
              const step = stepText(event, localizeUi, locale);
              // A step with its own sentence keeps the log's message only when it reports a problem.
              const isProblem = event.status === "error" || event.status === "warning" || isTruncatedResponse(event);
              const stepDescription = !step || isProblem ? describeEvent(event, noteTitles, localizeUi) : "";
              const offsetMs = Date.parse(event.ts) - Date.parse(firstEvent.ts);
              return (
                <li
                  key={event.id}
                  className="grid gap-x-3 border-l-2 border-[var(--border)] pl-3"
                  style={{ gridTemplateColumns: "4.5rem minmax(0, 1fr)" }}
                >
                  <time
                    dateTime={event.ts}
                    title={formatTimestamp(event.ts, locale)}
                    className="text-[0.6875rem] tabular-nums text-[var(--muted-foreground)]"
                  >
                    {offsetMs > 0
                      ? localizeUi("ui.longTermMemory.activityview.stepOffset", {
                          duration: formatDuration(offsetMs, locale, localizeUi),
                        })
                      : formatClock(event.ts, locale, "medium")}
                  </time>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{step?.text ?? actionLabel(event.action, localizeUi)}</span>
                      <span
                        data-ltm-debug-step-status={eventStatus.status}
                        className={`inline-flex items-center gap-1 ${
                          event.status === "error" ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]"
                        }`}
                      >
                        {eventStatus.status === "warning" ? <AlertTriangle aria-hidden="true" size="0.75rem" /> : null}
                        <span className={eventStatus.status === "warning" ? "font-semibold" : undefined}>
                          {eventStatus.label}
                        </span>
                      </span>
                    </div>
                    {step?.note ? <p className="mt-1 text-[var(--muted-foreground)]">{step.note}</p> : null}
                    {stepDescription ? <p className="mt-1 leading-relaxed">{stepDescription}</p> : null}
                    {event.durationMs != null && !step?.hasDuration ? (
                      <p className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.longTermMemory.activityview.tookDuration", {
                          duration: formatDuration(event.durationMs, locale, localizeUi),
                        })}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-[var(--muted-foreground)]">
            {localizeUi(
              selectLtmPluralForm(locale, selectedOperation.events.length) === "one"
                ? "ui.longTermMemory.activityview.copyJsonNoteOne"
                : "ui.longTermMemory.activityview.copyJsonNote",
              { count: selectedOperation.events.length.toLocaleString(locale) },
            )}
            {selectedOperation.events.some((event) => typeof event.details?.responseSnippet === "string")
              ? ` ${localizeUi("ui.longTermMemory.activityview.copyJsonNoteExcerpt")}`
              : ""}
          </p>
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

  const indexes = health.data?.indexes;
  const healthIndex =
    indexes?.rebuildState === "building" ? "building" : indexes?.rebuildState === "failed" ? "failed" : indexes?.health;
  // A failed rebuild can leave an old index with embeddings on disk; the shell already
  // treats that as semantic recall being unavailable, so the health line must not
  // contradict it.
  const indexUnusable = indexes?.rebuildState === "failed" || indexes?.health === "corrupt";
  const healthPending = health.isLoading || !health.data;
  const healthMissing = health.isError;
  const healthUnavailable = localizeUi("ui.longTermMemory.activityview.healthUnavailable");
  const healthChecking = localizeUi("ui.longTermMemory.activityview.healthChecking");
  const healthIndexText = healthMissing
    ? healthUnavailable
    : healthPending
      ? healthChecking
      : localizedLabel(healthIndex ?? "not_built", localizeUi, labelKeys.indexHealth);
  const healthSemanticText = healthMissing
    ? healthUnavailable
    : healthPending
      ? healthChecking
      : indexes?.embeddingsAvailable && !indexUnusable
        ? localizeUi("ui.longTermMemory.activityview.semanticAvailable")
        : localizeUi("ui.longTermMemory.activityview.semanticUnavailable");
  const embeddingSource = indexes?.embeddingSource ?? null;
  const indexedEmbeddingSource = indexes?.indexedEmbeddingSource ?? null;
  const healthSemanticWithSource =
    embeddingSource && !healthMissing && !healthPending
      ? localizeUi("ui.longTermMemory.activityview.semanticWithSource", {
          state: healthSemanticText,
          source: embeddingSource,
        })
      : healthSemanticText;
  // Vectors are reused or re-embedded by embedding space, not by display label, so the
  // note follows the server's availability verdict: a renamed connection with the same
  // model keeps working, and a switched sidecar model with the same label does not.
  const embeddingSourceChanged =
    !healthMissing &&
    !healthPending &&
    Boolean(embeddingSource && indexedEmbeddingSource && indexes?.embeddingsAvailable === false);

  return (
    <section ref={activityRef} data-ltm-surface="activity" aria-labelledby="ltm-activity-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h3 id="ltm-activity-title" className="text-xs font-semibold">
            {localizeUi("ui.longTermMemory.activityview.activityLog")}
          </h3>
          <InfoPopover
            label={localizeUi("ui.longTermMemory.activityview.activityLog")}
            content={localizeUi(
              "ui.longTermMemory.activityview.traceImportsExtractionDraftActionsRecallAndMaintenance",
            )}
          />
        </div>
        <div
          role="group"
          aria-label={localizeUi("ui.longTermMemory.activityview.logActions")}
          className="flex flex-wrap gap-2"
        >
          <Button
            ref={refreshRef}
            aria-disabled={pending !== null || activity.isFetching}
            onClick={() => {
              if (pendingRef.current || activity.isFetching) return;
              // `isFetching` is a rendered value, so a second activation in the same turn
              // still sees `false`. Disable refetch cancellation so it coalesces onto the
              // in-flight request instead of restarting it.
              void activity.refetch({ cancelRefetch: false }).then((result) => {
                if (!result.isError) setActionState({ text: "", tone: "success" });
                restoreFocus(refreshRef);
              });
            }}
          >
            {activity.isFetching ? (
              <Loader2 aria-hidden="true" size="0.875rem" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <RotateCw aria-hidden="true" size="0.875rem" />
            )}{" "}
            {localizeUi("ui.longTermMemory.activityview.refresh")}
          </Button>
          <Button ref={exportRef} aria-disabled={pending !== null} onClick={() => void exportLog()}>
            {pending === "export" ? (
              <Loader2 aria-hidden="true" size="0.875rem" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Download aria-hidden="true" size="0.875rem" />
            )}{" "}
            {localizeUi("ui.longTermMemory.activityview.exportFullLog")}
          </Button>
          <Button ref={clearRef} destructive aria-disabled={pending !== null} onClick={() => void clear()}>
            {pending === "clear" ? (
              <Loader2 aria-hidden="true" size="0.875rem" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Trash2 aria-hidden="true" size="0.875rem" />
            )}{" "}
            {localizeUi("ui.longTermMemory.activityview.clear")}
          </Button>
        </div>
      </div>

      {actionState.text ? <StatusSurface tone={actionState.tone}>{actionState.text}</StatusSurface> : null}
      {activity.isLoading ? (
        <StatusSurface busy>{localizeUi("ui.longTermMemory.activityview.loadingActivity")}</StatusSurface>
      ) : null}
      {activity.isError ? (
        <StatusSurface tone="danger">
          {localizeUi("ui.longTermMemory.activityview.couldNotLoadActivity")}{" "}
          <button
            type="button"
            className="inline-flex min-h-11 items-center underline"
            onClick={() => void activity.refetch()}
          >
            {localizeUi("ui.longTermMemory.activityview.retry")}
          </button>
        </StatusSurface>
      ) : null}
      <p className="text-[0.6875rem] text-[var(--muted-foreground)]" data-ltm-debug-export-warning>
        {localizeUi("ui.longTermMemory.activityview.exportPrivacyWarning")}
      </p>
      <p className="text-[0.6875rem] text-[var(--muted-foreground)]" data-ltm-debug-health>
        {localizeUi("ui.longTermMemory.activityview.healthEventsLoaded", {
          count: (activity.data?.events.length ?? 0).toLocaleString(locale),
        })}
        {localizeUi("ui.longTermMemory.activityview.metaSeparator")}
        {localizeUi("ui.longTermMemory.activityview.healthIndex", { index: healthIndexText })}
        {localizeUi("ui.longTermMemory.activityview.metaSeparator")}
        {localizeUi("ui.longTermMemory.activityview.healthSemantic", { state: healthSemanticWithSource })}
      </p>
      {embeddingSourceChanged ? (
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]" data-ltm-embedding-source-changed>
          {localizeUi("ui.longTermMemory.activityview.embeddingSourceChanged", {
            indexed: indexedEmbeddingSource,
            current: embeddingSource,
          })}
        </p>
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
                      style={chip === candidate ? { background: "var(--accent)" } : undefined}
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
                            // A failed row keeps its error; otherwise the outcome, then any warning message.
                            const summary =
                              (principalEvent.status === "error"
                                ? ""
                                : operationOutcome(operation, localizeUi, locale)) ||
                              compactSummary(
                                isCompileWarning(principalEvent)
                                  ? unnamedProblem(principalEvent, localizeUi, locale)
                                  : describeEvent(principalEvent, noteTitles, localizeUi),
                              );
                            const subject = operationSubject(operation, noteTitles, chatLabel);
                            // The editor shell restyles `text-[var(--muted-foreground)]` and `.mari-editor-action`
                            // backgrounds above any utility, and its hover rule recolours only the span under the
                            // pointer, so the selected and hovered states are a swapped class and inline style
                            // rather than a layered variant.
                            const isSelected = selectedOperationId === operation.operationId;
                            const mutedText =
                              isSelected || hoveredOperationId === operation.operationId
                                ? "text-[var(--foreground)]"
                                : "text-[var(--muted-foreground)]";
                            return (
                              <li key={operation.operationId}>
                                <button
                                  type="button"
                                  data-ltm-debug-operation={operation.operationId}
                                  aria-pressed={isSelected}
                                  style={
                                    isSelected
                                      ? { background: "var(--accent)", boxShadow: "inset 3px 0 0 var(--primary)" }
                                      : undefined
                                  }
                                  onClick={() => selectOperation(operation.operationId)}
                                  onPointerEnter={() => setHoveredOperationId(operation.operationId)}
                                  onPointerLeave={() => setHoveredOperationId(null)}
                                  data-ltm-tab-focus
                                  className="flex min-h-11 w-full items-start gap-2 px-3 py-2 text-left hover:bg-[var(--accent)]"
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
                                        <span className={`min-w-0 truncate font-normal ${mutedText}`}>
                                          {localizeUi("ui.longTermMemory.activityview.metaSeparator")}
                                          {subject.value}
                                        </span>
                                      ) : null}
                                    </span>
                                    {summary ? (
                                      <span className={`mt-1 line-clamp-2 text-xs ${mutedText}`}>{summary}</span>
                                    ) : null}
                                  </span>
                                  {/* ponytail: the age is computed at render and refreshes with the list; there is no
                                      ticking timer, so a row reads stale until the next render. Upgrade: a
                                      once-a-minute tick in state if that matters. */}
                                  <time
                                    dateTime={lastEvent.ts}
                                    className={`shrink-0 whitespace-nowrap text-[0.6875rem] ${mutedText}`}
                                  >
                                    {formatAge(lastEvent.ts, locale, Date.now())}
                                  </time>
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
