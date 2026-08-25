import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Loader2, X } from "lucide-react";
import {
  ltmDraftMutationSchema,
  type LtmDraftMutation,
  type LtmDraftPreflightResponse,
  type LtmDraftReviewDraft,
  type LtmDraftReviewMutation,
  type LtmDraftReviewResponse,
  type LtmExtractionDropReason,
  type LtmImportance,
  type LtmNote,
  type LtmRejectedSuggestion,
  type LtmRejectedSuggestionsResponse,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { invalidateLtmQueries, queryKeys, request, requestNotesByIds } from "./api";
import { humanizeLabel, labelKeys, localizedLabel } from "./display-labels";
import { Button, IconButton, InfoPopover, inputClass, StatusSurface } from "./shared-controls";
import type { LongTermMemoryDestinationProps } from "./types";
import { selectLtmPluralForm, useLtmTranslation } from "./localization";
import { LtmWorkspace, type LtmWorkspacePane } from "./LtmWorkspace";

type ReviewRow = {
  sourceNoteId: string;
  draftId: string;
  mutation: LtmDraftMutation;
  disposition: LtmDraftReviewMutation["disposition"] | "unavailable";
  diagnostics: LtmDraftReviewMutation["diagnostics"];
  changes: LtmDraftReviewMutation["changes"];
  targetId: string;
  targetTitle?: string;
  targetType?: string;
};

type ApplyDraftResponse = {
  appliedMutationIds: string[];
  skippedMutationIds: string[];
  autoIncludedMutationIds: string[];
  indexRebuild: { status: "not_requested" | "succeeded" } | { status: "failed"; error: string };
};

type PreflightRow = LtmDraftPreflightResponse["rows"][number];
type AcceptRequest = {
  draftId: string;
  mutationIds: string[];
  editedMutations: LtmDraftMutation[];
};

type SkipDraftResponse = {
  mutationIds: string[];
};

type ReviewAction = "accept" | "skip";

type BatchResult = {
  action: "accepted" | "skipped";
  phase: "preflight" | "complete";
  ready: number;
  completed: number;
  failed: number;
  remaining: number;
  autoIncluded: number;
  indexRebuildFailures: string[];
  messages: string[];
  cascadeMutationLabels: string[];
  savedMemoryIds: string[];
  failedMutationIds: string[];
  failedDraftIds: string[];
  completedMutationIds: string[];
  blockedMutationIds: string[];
};

type PersistedReviewState = {
  version: 3;
  chatId: string | null;
  drafts: Record<
    string,
    {
      savedAt: number;
      draftFingerprint: string;
      contextFingerprint: string;
      mutationFingerprints: Array<[string, string]>;
      selectedIds: string[];
      editedMutations: Array<[string, LtmDraftMutation]>;
    }
  >;
};

type PersistedDraftState = PersistedReviewState["drafts"][string];

const REVIEW_STATE_STORAGE_KEY = "marinara_ltm_review_state";
const REVIEW_STATE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_APPEND_TEXT_LENGTH = 20_000;
const MAX_SECTION_TEXT_LENGTH = 24_000;
const CONFLICT_PREVIEW_LIMIT = 3;
const CONFLICT_TEXT_PREVIEW_LENGTH = 280;
const NEAR_TEXT_LIMIT_THRESHOLD = 500;

const importanceOptions: LtmImportance[] = ["critical", "major", "moderate", "minor"];

const freshnessLabel: Record<string, string> = {
  fresh: "ui.longTermMemory.reviewqueue.fresh",
  hashless: "ui.longTermMemory.reviewqueue.contextUnbound",
  stale: "ui.longTermMemory.reviewqueue.stale",
  missing: "ui.longTermMemory.reviewqueue.sourceMissing",
  invalid: "ui.longTermMemory.reviewqueue.sourceInvalid",
  superseded: "ui.longTermMemory.reviewqueue.superseded",
  invalidated: "ui.longTermMemory.reviewqueue.invalidated",
  not_pending: "ui.longTermMemory.reviewqueue.notPending",
};

function freshnessClass(freshness: string) {
  if (freshness === "fresh") return "border-[var(--marinara-editor-accent)]/40 text-[var(--marinara-editor-accent)]";
  if (
    freshness === "stale" ||
    freshness === "missing" ||
    freshness === "invalid" ||
    freshness === "superseded" ||
    freshness === "invalidated" ||
    freshness === "not_pending"
  )
    return "border-[var(--marinara-editor-warning)]/40 text-[var(--marinara-editor-warning)]";
  return "border-[var(--border)] text-[var(--muted-foreground)]";
}

const mutationLabels: Record<LtmDraftMutation["kind"], string> = {
  create_note: "ui.longTermMemory.reviewqueue.createMemory",
  append_section: "ui.longTermMemory.reviewqueue.addToSection",
  update_section: "ui.longTermMemory.reviewqueue.updateSection",
  add_link: "ui.longTermMemory.reviewqueue.addLink",
  set_keywords: "ui.longTermMemory.reviewqueue.replaceKeywords",
  set_status: "ui.longTermMemory.reviewqueue.changeStatus",
  set_subjects: "ui.longTermMemory.reviewqueue.updateSubjects",
};

const dispositionLabels: Record<ReviewRow["disposition"], string> = {
  new: "ui.longTermMemory.reviewqueue.newMemory",
  merge: "ui.longTermMemory.reviewqueue.mergeIntoMemory",
  rewrite: "ui.longTermMemory.reviewqueue.rewriteMemory",
  unavailable: "ui.longTermMemory.reviewqueue.previewUnavailable",
};

function mutationTarget(mutation: LtmDraftMutation) {
  return mutation.kind === "create_note" ? mutation.note.id : mutation.noteId;
}

function noteDisplayTitle(note: LtmNote | undefined, fallback: string) {
  return note?.title?.trim() || fallback;
}

function noteBody(note: LtmNote | undefined) {
  return note
    ? Object.values(note.sections)
        .map((section) => section.text.trim())
        .filter(Boolean)
        .join(" ")
    : "";
}

function mutationDisplayLabel(
  mutation: LtmDraftMutation | undefined,
  noteById: ReadonlyMap<string, LtmNote>,
  localizeUi: ReturnType<typeof useLtmTranslation>["t"],
) {
  if (!mutation) return localizeUi("ui.longTermMemory.reviewqueue.dependentChange");
  if (mutation.summary.trim()) return `"${mutation.summary.trim()}"`;
  const target = mutation.kind === "create_note" ? mutation.note : noteById.get(mutationTarget(mutation));
  const title = target && "title" in target ? target.title : undefined;
  const label = mutationLabels[mutation.kind]
    ? localizeUi(mutationLabels[mutation.kind])
    : humanizeLabel(mutation.kind);
  return title
    ? localizeUi("ui.longTermMemory.reviewqueue.mutationWithTitle", {
        mutation: label,
        title,
      })
    : label;
}

function draftDisplayTitle(item: LtmDraftReviewDraft, localizeUi: ReturnType<typeof useLtmTranslation>["t"]) {
  const firstMutation = item.draft.mutations[0];
  if (firstMutation?.kind === "create_note") {
    return noteDisplayTitle(firstMutation.note, localizeUi("ui.longTermMemory.reviewqueue.untitledMemory"));
  }
  return item.draft.summary || localizeUi("ui.longTermMemory.reviewqueue.noDraftSummary");
}

function humanizeReviewText(
  text: string,
  noteById: ReadonlyMap<string, LtmNote>,
  replacementPattern: RegExp | undefined,
  replacements: ReadonlyMap<string, string>,
  sourcePrefix: string,
  sourceFallback: string,
) {
  const display = text.replace(
    /source_note:([A-Za-z0-9_-]+)/gu,
    (_, id: string) => `${sourcePrefix} ${noteDisplayTitle(noteById.get(id), sourceFallback)}`,
  );
  return replacementPattern ? display.replace(replacementPattern, (id) => replacements.get(id) ?? id) : display;
}

function groupByDraft(rows: readonly ReviewRow[]) {
  const grouped = new Map<string, ReviewRow[]>();
  for (const row of rows) {
    grouped.set(row.draftId, [...(grouped.get(row.draftId) ?? []), row]);
  }
  return grouped;
}

function buildReviewRows(reviewData: LtmDraftReviewResponse | undefined) {
  const rowByMutationId = new Map<string, ReviewRow>();
  for (const source of reviewData?.sources ?? []) {
    for (const target of source.targets) {
      for (const row of target.rows) {
        rowByMutationId.set(row.mutation.id, {
          sourceNoteId: source.sourceNoteId,
          ...row,
          targetId: target.noteId,
          targetTitle: target.title,
          targetType: target.noteType,
        });
      }
    }
    for (const item of source.drafts) {
      for (const mutation of item.draft.mutations) {
        if (!rowByMutationId.has(mutation.id)) {
          rowByMutationId.set(mutation.id, {
            sourceNoteId: source.sourceNoteId,
            draftId: item.draft.id,
            mutation,
            disposition: "unavailable",
            diagnostics: [],
            changes: [],
            targetId: mutationTarget(mutation),
            targetTitle: mutation.kind === "create_note" ? mutation.note.title : undefined,
            targetType: mutation.kind === "create_note" ? mutation.note.type : undefined,
          });
        }
      }
    }
  }
  return { rowByMutationId, rows: [...rowByMutationId.values()] };
}

function acceptedMutationIds(draftRows: readonly ReviewRow[], selectedIds: readonly string[]) {
  const selected = new Set(selectedIds);
  const rowsById = new Map(draftRows.map((row) => [row.mutation.id, row] as const));
  const eventCreates = new Map(
    draftRows.flatMap((row) =>
      row.mutation.kind === "create_note" && row.mutation.note.type === "timeline_event" && row.disposition === "new"
        ? [[row.mutation.note.id, row.mutation.id] as const]
        : [],
    ),
  );

  let changed = true;
  while (changed) {
    changed = false;
    const selectedRows = [...selected].flatMap((id) => {
      const row = rowsById.get(id);
      return row ? [row] : [];
    });
    const selectedTargetIds = new Set(selectedRows.map((row) => mutationTarget(row.mutation)));

    for (const row of draftRows) {
      if (
        row.mutation.kind === "create_note" &&
        row.disposition === "new" &&
        selectedTargetIds.has(row.mutation.note.id) &&
        !selected.has(row.mutation.id)
      ) {
        selected.add(row.mutation.id);
        changed = true;
      }
    }

    const selectedNoteIds = new Set(
      [...selected].flatMap((id) => {
        const row = rowsById.get(id);
        return row ? [mutationTarget(row.mutation)] : [];
      }),
    );
    for (const row of draftRows) {
      if (
        row.mutation.kind !== "add_link" ||
        !selectedNoteIds.has(row.mutation.noteId) ||
        !eventCreates.has(row.mutation.link.target)
      )
        continue;
      if (!selected.has(row.mutation.id)) {
        selected.add(row.mutation.id);
        changed = true;
      }
      const createId = eventCreates.get(row.mutation.link.target)!;
      if (!selected.has(createId)) {
        selected.add(createId);
        changed = true;
      }
    }

    for (const row of selectedRows) {
      const eventTargetIds =
        row.mutation.kind === "create_note"
          ? row.mutation.note.links.map((link) => link.target)
          : row.mutation.kind === "add_link"
            ? [row.mutation.link.target]
            : [];
      for (const targetId of eventTargetIds) {
        const createId = eventCreates.get(targetId);
        if (createId && !selected.has(createId)) {
          selected.add(createId);
          changed = true;
        }
      }
    }
  }

  return selected;
}

function sameMutation(left: LtmDraftMutation, right: LtmDraftMutation) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function selectedEditIsValid(mutation: LtmDraftMutation) {
  if (mutation.kind === "append_section") return !mutationHasOverlongText(mutation) && Boolean(mutation.text.trim());
  if (mutation.kind === "update_section")
    return !mutationHasOverlongText(mutation) && Boolean(mutation.section.text.trim());
  if (mutation.kind === "create_note")
    return (
      !mutationHasOverlongText(mutation) &&
      Object.values(mutation.note.sections).every((section) => Boolean(section.text.trim()))
    );
  return true;
}

function parsePersistedMutation(value: unknown): LtmDraftMutation | null {
  const parsed = ltmDraftMutationSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function mutationHasOverlongText(mutation: LtmDraftMutation) {
  return mutation.kind === "append_section"
    ? mutation.text.length > MAX_APPEND_TEXT_LENGTH
    : mutation.kind === "update_section"
      ? mutation.section.text.length > MAX_SECTION_TEXT_LENGTH
      : mutation.kind === "create_note"
        ? Object.values(mutation.note.sections).some((section) => section.text.length > MAX_SECTION_TEXT_LENGTH)
        : false;
}

function mutationProposedText(mutation: LtmDraftMutation, noteById: ReadonlyMap<string, LtmNote>) {
  if (mutation.kind === "create_note")
    return Object.values(mutation.note.sections)
      .map((section) => section.text.trim())
      .filter(Boolean)
      .join(" ");
  if (mutation.kind === "append_section") return mutation.text.trim();
  if (mutation.kind === "update_section") return mutation.section.text.trim();
  if (mutation.kind === "set_keywords") return mutation.keywords.join(", ");
  if (mutation.kind === "set_status") return mutation.status;
  if (mutation.kind === "set_subjects") return mutation.subjects.map((subject) => subject.key).join(", ");
  if (mutation.kind === "add_link") return noteById.get(mutation.link.target)?.title?.trim() || mutation.link.target;
  return "";
}

function reviewStateStorageKey(chatId: string | null | undefined) {
  return `${REVIEW_STATE_STORAGE_KEY}:${chatId ?? "no-chat"}`;
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function getReviewStateStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isPersistedReviewState(value: unknown, chatId: string | null): value is PersistedReviewState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const parsed = value as Partial<PersistedReviewState>;
  if (
    parsed.version !== 3 ||
    parsed.chatId !== chatId ||
    !parsed.drafts ||
    typeof parsed.drafts !== "object" ||
    Array.isArray(parsed.drafts)
  )
    return false;
  return Object.values(parsed.drafts).every((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const draft = value as Partial<PersistedDraftState>;
    return (
      typeof draft.savedAt === "number" &&
      Number.isFinite(draft.savedAt) &&
      draft.savedAt <= Date.now() &&
      Date.now() - draft.savedAt <= REVIEW_STATE_MAX_AGE_MS &&
      typeof draft.draftFingerprint === "string" &&
      typeof draft.contextFingerprint === "string" &&
      Array.isArray(draft.mutationFingerprints) &&
      draft.mutationFingerprints.every(
        (entry) =>
          Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string" && typeof entry[1] === "string",
      ) &&
      Array.isArray(draft.selectedIds) &&
      draft.selectedIds.every((id) => typeof id === "string") &&
      Array.isArray(draft.editedMutations) &&
      draft.editedMutations.every(
        (entry) =>
          Array.isArray(entry) &&
          entry.length === 2 &&
          typeof entry[0] === "string" &&
          entry[1] &&
          typeof entry[1] === "object",
      )
    );
  });
}

function readPersistedReviewState(key: string, chatId: string | null) {
  const storage = getReviewStateStorage();
  if (!storage) return { state: null, error: "unavailable" as const };
  try {
    const raw = storage.getItem(key);
    if (!raw) return { state: null, error: null };
    const parsed = safeParse(raw);
    if (!isPersistedReviewState(parsed, chatId)) {
      storage.removeItem(key);
      return { state: null, error: null };
    }
    return { state: parsed, error: null };
  } catch {
    return { state: null, error: "failed" as const };
  }
}

function writePersistedReviewState(key: string, state: PersistedReviewState | null) {
  const storage = getReviewStateStorage();
  if (!storage) return "unavailable" as const;
  try {
    if (!state || !Object.keys(state.drafts).length) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(state));
    return "ok" as const;
  } catch {
    return "failed" as const;
  }
}

function cleanupPersistedReviewStates() {
  const storage = getReviewStateStorage();
  if (!storage) return;
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (!key?.startsWith(`${REVIEW_STATE_STORAGE_KEY}:`)) continue;
      const value = safeParse(storage.getItem(key) ?? "");
      if (!value || typeof value !== "object") {
        storage.removeItem(key);
        continue;
      }
      const state = value as { drafts?: Record<string, { savedAt?: unknown }> };
      if (
        !state.drafts ||
        Object.values(state.drafts).some(
          (draft) => typeof draft.savedAt !== "number" || Date.now() - draft.savedAt > REVIEW_STATE_MAX_AGE_MS,
        )
      ) {
        storage.removeItem(key);
      }
    }
  } catch {
    // Local storage is optional; callers surface the failure when their own read/write fails.
  }
}

function draftReviewFingerprint(item: LtmDraftReviewDraft) {
  return JSON.stringify({
    status: item.draft.status,
    freshness: item.freshness,
    source: item.draft.source,
    scope: item.draft.scope,
    modes: item.draft.modes,
    updatedAt: item.draft.updatedAt,
    mutations: item.draft.mutations,
  });
}

function draftReviewContextFingerprint(item: LtmDraftReviewDraft) {
  return JSON.stringify({
    freshness: item.freshness,
    source: item.draft.source,
    scope: item.draft.scope,
    modes: item.draft.modes,
  });
}

function mutationFingerprint(mutation: LtmDraftMutation) {
  return JSON.stringify(mutation);
}

function buildPersistedReviewState(
  reviewData: LtmDraftReviewResponse | undefined,
  reviewDataSignature: string | null,
  reviewStateHydrated: string | null,
  reviewStateKey: string,
  chatId: string | null | undefined,
  selectedIds: ReadonlySet<string>,
  editedById: ReadonlyMap<string, LtmDraftMutation>,
) {
  if (!reviewData || !reviewDataSignature || reviewStateHydrated !== `${reviewStateKey}:${reviewDataSignature}`)
    return null;
  const drafts: PersistedReviewState["drafts"] = {};
  const currentDrafts = new Map(
    reviewData.sources.flatMap((source) => source.drafts.map((item) => [item.draft.id, item] as const)),
  );
  for (const [draftId, item] of currentDrafts) {
    if (item.draft.status !== "pending") continue;
    const appliedMutationIds = new Set(item.draft.appliedMutationIds ?? []);
    const pendingMutations = item.draft.mutations.filter((mutation) => !appliedMutationIds.has(mutation.id));
    const mutationIds = new Set(pendingMutations.map((mutation) => mutation.id));
    const selected = [...selectedIds].filter((id) => mutationIds.has(id));
    const editedMutations = [...editedById].filter(([id]) => mutationIds.has(id));
    if (selected.length || editedMutations.length) {
      drafts[draftId] = {
        savedAt: Date.now(),
        draftFingerprint: draftReviewFingerprint(item),
        contextFingerprint: draftReviewContextFingerprint(item),
        mutationFingerprints: pendingMutations.map((mutation) => [mutation.id, mutationFingerprint(mutation)]),
        selectedIds: selected,
        editedMutations,
      };
    }
  }
  return {
    version: 3 as const,
    chatId: chatId ?? null,
    drafts,
  };
}

function remainingCharacters(value: string, limit: number) {
  return limit - value.length;
}

function boundedTrim(value: string, max: number) {
  return value.trim().slice(0, max);
}

function previewConflictText(value: string) {
  return value.length > CONFLICT_TEXT_PREVIEW_LENGTH ? `${value.slice(0, CONFLICT_TEXT_PREVIEW_LENGTH)}...` : value;
}

function ConflictValue({ label, value }: { label: string; value: string }) {
  const labelParts = label.split("{{value}}", 2);
  const renderedLabel = (
    <>
      {labelParts[0]}
      <span className="font-normal">
        {value.length <= CONFLICT_TEXT_PREVIEW_LENGTH ? value : previewConflictText(value)}
      </span>
      {labelParts[1]}
    </>
  );
  if (value.length <= CONFLICT_TEXT_PREVIEW_LENGTH) return renderedLabel;
  return (
    <details>
      <summary className="cursor-pointer">{renderedLabel}</summary>
      <p className="mt-1 break-words">{value}</p>
    </details>
  );
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function ReviewProgress({
  sources,
  pending,
  ready,
  blocked,
  reviewed,
  remaining,
}: {
  sources: number;
  pending: number;
  ready: number;
  blocked: number;
  reviewed: number;
  remaining: number;
}) {
  const { t: localizeUi, locale } = useLtmTranslation();
  return (
    <span data-ltm-review-summary data-ltm-review-progress className="text-xs text-[var(--muted-foreground)]">
      {localizeUi("ui.longTermMemory.reviewqueue.reviewSummary", {
        sources,
        source:
          selectLtmPluralForm(locale, sources) === "one"
            ? localizeUi("ui.longTermMemory.reviewqueue.source")
            : localizeUi("ui.longTermMemory.reviewqueue.sources"),
        pending,
        ready,
        blocked,
      })}
      {localizeUi("ui.longTermMemory.reviewqueue.reviewProgress", { reviewed, remaining })}
    </span>
  );
}

function recoveryLabel(
  recovery: NonNullable<LtmDraftReviewDraft["candidateRejections"][number]["recovery"]>,
  localizeUi: ReturnType<typeof useLtmTranslation>["t"],
  noteById: ReadonlyMap<string, LtmNote>,
  missingNoteFallback: string,
) {
  const hints = [
    recovery.noteType
      ? localizeUi("ui.longTermMemory.reviewqueue.recoveryMemoryType", {
          value: humanizeLabel(recovery.noteType),
        })
      : null,
    recovery.noteId
      ? localizeUi("ui.longTermMemory.reviewqueue.recoveryMemory", {
          value: noteDisplayTitle(noteById.get(recovery.noteId), missingNoteFallback),
        })
      : null,
    recovery.sectionKey
      ? localizeUi("ui.longTermMemory.reviewqueue.recoverySection", {
          value: humanizeLabel(recovery.sectionKey),
        })
      : null,
    recovery.status
      ? localizeUi("ui.longTermMemory.reviewqueue.recoveryStatus", {
          value: humanizeLabel(recovery.status),
        })
      : null,
  ].filter(Boolean);
  return hints.join(", ") || localizeUi("ui.longTermMemory.reviewqueue.reviewRejectedCandidate");
}

const rejectionReasonLabels: Partial<Record<LtmExtractionDropReason, string>> = {
  invalid_format: "ui.longTermMemory.reviewqueue.rejectionReasonInvalidFormat",
  placeholder_output: "ui.longTermMemory.reviewqueue.rejectionReasonPlaceholderOutput",
  quote_not_found_in_source: "ui.longTermMemory.reviewqueue.rejectionReasonQuoteNotFound",
  missing_source_evidence: "ui.longTermMemory.reviewqueue.rejectionReasonMissingEvidence",
  source_summary_payload: "ui.longTermMemory.reviewqueue.rejectionReasonSourceSummary",
  unsupported_bucket: "ui.longTermMemory.reviewqueue.rejectionReasonUnsupportedBucket",
  target_note_outside_scope: "ui.longTermMemory.reviewqueue.rejectionReasonOutsideScope",
  ambiguous_subject: "ui.longTermMemory.reviewqueue.rejectionReasonAmbiguousSubject",
  untrusted_subject: "ui.longTermMemory.reviewqueue.rejectionReasonUntrustedSubject",
  invalid_subject_cardinality: "ui.longTermMemory.reviewqueue.rejectionReasonInvalidSubjectCardinality",
  too_long_to_keep_safely: "ui.longTermMemory.reviewqueue.rejectionReasonTooLong",
};

const rejectionRecommendedLabels: Partial<Record<LtmExtractionDropReason, string>> = {
  invalid_format: "ui.longTermMemory.reviewqueue.recommendedFixInvalidFormat",
  placeholder_output: "ui.longTermMemory.reviewqueue.recommendedFixPlaceholderOutput",
  quote_not_found_in_source: "ui.longTermMemory.reviewqueue.recommendedFixQuoteNotFound",
  missing_source_evidence: "ui.longTermMemory.reviewqueue.recommendedFixMissingEvidence",
  source_summary_payload: "ui.longTermMemory.reviewqueue.recommendedFixSourceSummary",
  unsupported_bucket: "ui.longTermMemory.reviewqueue.recommendedFixUnsupportedBucket",
  target_note_outside_scope: "ui.longTermMemory.reviewqueue.recommendedFixOutsideScope",
  ambiguous_subject: "ui.longTermMemory.reviewqueue.recommendedFixAmbiguousSubject",
  untrusted_subject: "ui.longTermMemory.reviewqueue.recommendedFixUntrustedSubject",
  invalid_subject_cardinality: "ui.longTermMemory.reviewqueue.recommendedFixInvalidSubjectCardinality",
  too_long_to_keep_safely: "ui.longTermMemory.reviewqueue.recommendedFixTooLong",
};

function SelectionCheckbox({
  checked,
  indeterminate = false,
  label,
  compact = false,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  compact?: boolean;
  onChange: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium text-[var(--foreground)]">
      <input
        ref={inputRef}
        type="checkbox"
        data-ltm-control="review-select"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 rounded accent-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
      />
      <span className={compact ? "sr-only" : undefined}>{label}</span>
    </label>
  );
}

function ImportanceField({
  value,
  onChange,
  onBlur,
}: {
  value: LtmImportance | undefined;
  onChange: (value: LtmImportance | undefined) => void;
  onBlur?: () => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  return (
    <div className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
      <span className="flex items-center gap-1">
        {localizeUi("ui.longTermMemory.memoryvault.importance")}
        <InfoPopover
          label={localizeUi("ui.longTermMemory.memoryvault.importance")}
          content={localizeUi(
            "ui.longTermMemory.memoryvault.durabilityAndConsequenceCategoryCriticalMajorModerateOrMinor",
          )}
        />
      </span>
      <select
        aria-label={localizeUi("ui.longTermMemory.memoryvault.importance")}
        className={inputClass}
        value={value ?? ""}
        onChange={(event) => onChange((event.target.value || undefined) as LtmImportance | undefined)}
        onBlur={onBlur}
      >
        <option value="">{localizeUi("ui.longTermMemory.importancefield.notSpecified")}</option>
        {importanceOptions.map((importance) => (
          <option key={importance} value={importance}>
            {localizedLabel(importance, localizeUi, labelKeys.importance)}
          </option>
        ))}
      </select>
    </div>
  );
}

function MutationEditor({
  mutation,
  canEditTitle,
  onChange,
  onBlur,
}: {
  mutation: LtmDraftMutation;
  canEditTitle: boolean;
  onChange: (mutation: LtmDraftMutation) => void;
  onBlur?: () => void;
}) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const counterId = useId();
  const renderCounter = (id: string, value: string, limit: number) => {
    const count = Math.max(0, remainingCharacters(value, limit));
    const key =
      selectLtmPluralForm(locale, count) === "one"
        ? "ui.longTermMemory.reviewqueue.charactersRemainingOne"
        : "ui.longTermMemory.reviewqueue.charactersRemainingOther";
    return (
      <>
        <span
          id={id}
          data-ltm-character-counter
          className={`block text-right text-[0.6875rem] font-normal ${
            count <= NEAR_TEXT_LIMIT_THRESHOLD
              ? "text-[var(--marinara-editor-warning)]"
              : "text-[var(--muted-foreground)]"
          }`}
        >
          {localizeUi(key, { count })}
        </span>
        {count <= NEAR_TEXT_LIMIT_THRESHOLD ? (
          <span aria-live="polite" className="sr-only">
            {localizeUi(key, { count })}
          </span>
        ) : null}
      </>
    );
  };
  if (mutation.kind === "create_note") {
    return (
      <div data-ltm-mutation-editor className="space-y-3 pt-3">
        {canEditTitle ? (
          <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
            <span>{localizeUi("ui.longTermMemory.mutationeditor.memoryTitle")}</span>
            <input
              className={inputClass}
              maxLength={240}
              value={mutation.note.title ?? ""}
              onChange={(event) =>
                onChange({
                  ...mutation,
                  note: {
                    ...mutation.note,
                    title: event.target.value.slice(0, 240) || undefined,
                  },
                })
              }
              onBlur={(event) => {
                onChange({
                  ...mutation,
                  note: {
                    ...mutation.note,
                    title: boundedTrim(event.target.value, 240) || undefined,
                  },
                });
                onBlur?.();
              }}
            />
          </label>
        ) : null}
        {Object.entries(mutation.note.sections).map(([sectionKey, section]) => (
          <div key={sectionKey} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
              <span>{humanizeLabel(sectionKey)}</span>
              <textarea
                className={`${inputClass} min-h-24 py-2`}
                maxLength={MAX_SECTION_TEXT_LENGTH}
                aria-describedby={`${counterId}-${sectionKey}`}
                value={section.text}
                onChange={(event) =>
                  onChange({
                    ...mutation,
                    note: {
                      ...mutation.note,
                      sections: {
                        ...mutation.note.sections,
                        [sectionKey]: {
                          ...section,
                          text: event.target.value,
                        },
                      },
                    },
                  })
                }
                onBlur={(event) => {
                  onChange({
                    ...mutation,
                    note: {
                      ...mutation.note,
                      sections: {
                        ...mutation.note.sections,
                        [sectionKey]: {
                          ...section,
                          text: event.target.value.trim(),
                        },
                      },
                    },
                  });
                  onBlur?.();
                }}
              />
              {renderCounter(`${counterId}-${sectionKey}`, section.text, MAX_SECTION_TEXT_LENGTH)}
            </label>
            <ImportanceField
              value={section.importance}
              onChange={(importance) =>
                onChange({
                  ...mutation,
                  note: {
                    ...mutation.note,
                    sections: {
                      ...mutation.note.sections,
                      [sectionKey]: { ...section, importance },
                    },
                  },
                })
              }
              onBlur={onBlur}
            />
          </div>
        ))}
      </div>
    );
  }

  if (mutation.kind === "append_section") {
    return (
      <div data-ltm-mutation-editor className="grid gap-2 pt-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
          <span>
            {humanizeLabel(mutation.sectionKey)} {localizeUi("ui.longTermMemory.mutationeditor.text")}
          </span>
          <textarea
            className={`${inputClass} min-h-24 py-2`}
            maxLength={MAX_APPEND_TEXT_LENGTH}
            aria-describedby={`${counterId}-text`}
            value={mutation.text}
            onChange={(event) =>
              onChange({
                ...mutation,
                text: event.target.value,
              })
            }
            onBlur={(event) => {
              onChange({
                ...mutation,
                text: event.target.value.trim(),
              });
              onBlur?.();
            }}
          />
          {renderCounter(`${counterId}-text`, mutation.text, MAX_APPEND_TEXT_LENGTH)}
        </label>
        <ImportanceField
          value={mutation.importance}
          onChange={(importance) => onChange({ ...mutation, importance })}
          onBlur={onBlur}
        />
      </div>
    );
  }

  if (mutation.kind === "update_section") {
    return (
      <div data-ltm-mutation-editor className="grid gap-2 pt-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
          <span>
            {humanizeLabel(mutation.sectionKey)} {localizeUi("ui.longTermMemory.mutationeditor.text")}
          </span>
          <textarea
            className={`${inputClass} min-h-24 py-2`}
            maxLength={MAX_SECTION_TEXT_LENGTH}
            aria-describedby={`${counterId}-text`}
            value={mutation.section.text}
            onChange={(event) =>
              onChange({
                ...mutation,
                section: {
                  ...mutation.section,
                  text: event.target.value,
                },
              })
            }
            onBlur={(event) => {
              onChange({
                ...mutation,
                section: {
                  ...mutation.section,
                  text: event.target.value.trim(),
                },
              });
              onBlur?.();
            }}
          />
          {renderCounter(`${counterId}-text`, mutation.section.text, MAX_SECTION_TEXT_LENGTH)}
        </label>
        <ImportanceField
          value={mutation.section.importance}
          onChange={(importance) =>
            onChange({
              ...mutation,
              section: { ...mutation.section, importance },
            })
          }
          onBlur={onBlur}
        />
      </div>
    );
  }

  return null;
}

const diagnosticCategoryKeys: Record<string, string> = {
  source_backed_npc_identity: "ui.longTermMemory.extractiondetails.normalizedCorrected",
  subject_identity_corrected: "ui.longTermMemory.extractiondetails.normalizedCorrected",
  subject_identity_normalized: "ui.longTermMemory.extractiondetails.normalizedCorrected",
  low_lexical_evidence: "ui.longTermMemory.extractiondetails.lowEvidence",
  missing_evidence: "ui.longTermMemory.extractiondetails.lowEvidence",
  missing_source_note_evidence: "ui.longTermMemory.extractiondetails.lowEvidence",
  resolved_thread_missing_fanout: "ui.longTermMemory.extractiondetails.resolvedThreadHandling",
  relationship_state_missing_caused_by: "ui.longTermMemory.extractiondetails.resolvedThreadHandling",
  ambiguous_subject_link_target: "ui.longTermMemory.extractiondetails.identityTargetHandling",
  unknown_link_target: "ui.longTermMemory.extractiondetails.identityTargetHandling",
  target_note_identity_variant: "ui.longTermMemory.extractiondetails.identityTargetHandling",
  target_note_scoped_variant: "ui.longTermMemory.extractiondetails.identityTargetHandling",
};

function hasExtractionDetails(item: LtmDraftReviewDraft) {
  return (
    Boolean(item.draft.accounting) ||
    item.diagnostics.some((diagnostic) => diagnostic.code !== "deduplicated_evidence_unit") ||
    item.deduplications.length > 0
  );
}

function ExtractionDetails({
  item,
  humanizeText,
}: {
  item: LtmDraftReviewDraft;
  humanizeText: (text: string) => string;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const accounting = item.draft.accounting;
  const diagnostics = item.diagnostics.filter((diagnostic) => diagnostic.code !== "deduplicated_evidence_unit");
  const diagnosticsByCategory = new Map<string, typeof diagnostics>();
  for (const diagnostic of diagnostics) {
    const category = diagnosticCategoryKeys[diagnostic.code] ?? "ui.longTermMemory.extractiondetails.otherWarnings";
    diagnosticsByCategory.set(category, [...(diagnosticsByCategory.get(category) ?? []), diagnostic]);
  }
  if (!hasExtractionDetails(item)) return null;

  return (
    <section data-ltm-extraction-details className="mari-editor-panel space-y-3 p-3 text-xs">
      <header className="border-b border-[var(--border)] pb-3">
        <h2 className="font-semibold">{localizeUi("ui.longTermMemory.extractiondetails.extractionDetails")}</h2>
        {accounting ? (
          <p className="mt-1 text-[var(--muted-foreground)]">
            {localizeUi("ui.longTermMemory.extractiondetails.value1KeptValue2RejectedValue3Deduplicated", {
              value1: accounting.keptUnits,
              value2: accounting.parserRejections + accounting.validationRejections,
              value3: accounting.deduplications,
            })}
          </p>
        ) : null}
      </header>
      <div className="space-y-3 text-[var(--muted-foreground)]">
        {accounting ? (
          <p data-ltm-extraction-accounting>
            {accounting.providerCandidates} {localizeUi("ui.longTermMemory.extractiondetails.providerCandidates")}{" "}
            {accounting.normalizedAdditions} {localizeUi("ui.longTermMemory.extractiondetails.normalizedAdditions")}{" "}
            {accounting.keptUnits} {localizeUi("ui.longTermMemory.extractiondetails.kept")}{" "}
            {accounting.parserRejections} {localizeUi("ui.longTermMemory.extractiondetails.parserRejected")}{" "}
            {accounting.validationRejections} {localizeUi("ui.longTermMemory.extractiondetails.validationRejectedAnd")}{" "}
            {accounting.deduplications} {localizeUi("ui.longTermMemory.extractiondetails.deduplicated")}
          </p>
        ) : null}
        {item.deduplications.length ? (
          <details data-ltm-deduplications className="space-y-1">
            <summary className="cursor-pointer font-medium text-[var(--foreground)]">
              {localizeUi("ui.longTermMemory.extractiondetails.deduplications")} ( {item.deduplications.length} )
            </summary>
            <div className="mt-2 space-y-1">
              {item.deduplications.map((diagnostic, index) => (
                <p key={`${diagnostic.code}-${index}`}>{humanizeText(diagnostic.message)}</p>
              ))}
            </div>
          </details>
        ) : null}
        {diagnostics.length ? (
          <details data-ltm-draft-diagnostics>
            <summary className="cursor-pointer font-medium text-[var(--foreground)]">
              {localizeUi("ui.longTermMemory.extractiondetails.advancedExtractionDetails")}
            </summary>
            <div className="mt-2 space-y-2">
              {[...diagnosticsByCategory].map(([category, entries]) => (
                <details key={category}>
                  <summary className="cursor-pointer font-medium">
                    {localizeUi(category)} ({entries.length})
                  </summary>
                  <div className="mt-1 space-y-1 pl-3">
                    {entries.map((diagnostic, index) => (
                      <p key={`${diagnostic.code}-${index}`}>
                        {humanizeLabel(diagnostic.code)}: {humanizeText(diagnostic.message)}
                      </p>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}

export default function ReviewQueue({
  props,
  onDirtyChange,
  onSaveRequest,
  onOpenMemory,
  onOpenVault,
  onRecoverCandidate,
  reviewSourceNoteId,
}: LongTermMemoryDestinationProps) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const queryClient = useQueryClient();
  const [selectedSourceId, setSelectedSourceId] = useState(reviewSourceNoteId ?? null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<LtmWorkspacePane>("navigator");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sourceCollapsed, setSourceCollapsed] = useState(false);
  const [expandedMutationIds, setExpandedMutationIds] = useState<Set<string>>(new Set());
  const reviewRef = useRef<HTMLElement>(null);

  function setMobilePaneAndFocus(pane: LtmWorkspacePane) {
    setMobilePane(pane);
    requestAnimationFrame(() => {
      const workspace = reviewRef.current?.querySelector<HTMLElement>("[data-ltm-workspace]");
      const target = workspace?.querySelector<HTMLElement>(
        `[data-ltm-workspace-pane-tab="${pane}"], [data-ltm-workspace-pane="${pane}"] button, [data-ltm-workspace-pane="${pane}"] [tabindex]:not([tabindex="-1"]), [data-ltm-workspace-pane="${pane}"][tabindex]`,
      );
      target?.focus({ preventScroll: true });
    });
  }

  useEffect(() => {
    setSelectedSourceId(reviewSourceNoteId ?? null);
    setSourceCollapsed(false);
    setDetailsOpen(false);
  }, [reviewSourceNoteId]);
  const review = useQuery({
    queryKey: queryKeys.review,
    queryFn: () => request<LtmDraftReviewResponse>("/drafts/review?includeInvalidated=true"),
  });
  const rejectedSuggestions = useQuery({
    queryKey: queryKeys.rejectedSuggestions,
    queryFn: () => request<LtmRejectedSuggestionsResponse>("/rejected-suggestions"),
  });
  const contextNoteIds = useMemo(() => {
    const ids = new Set<string>();
    for (const source of review.data?.sources ?? []) {
      ids.add(source.sourceNoteId);
      source.targets.forEach((target) => {
        if (target.rows.some((row) => row.disposition !== "new")) ids.add(target.noteId);
      });
      source.drafts.forEach((item) =>
        item.draft.mutations.forEach((mutation) => {
          if (mutation.kind !== "create_note") ids.add(mutationTarget(mutation));
        }),
      );
    }
    for (const suggestion of rejectedSuggestions.data?.suggestions ?? []) {
      ids.add(suggestion.source.sourceNoteId);
      if (suggestion.candidate.recovery?.noteId) ids.add(suggestion.candidate.recovery.noteId);
    }
    return [...ids].sort();
  }, [rejectedSuggestions.data?.suggestions, review.data?.sources]);
  const notes = useQuery({
    queryKey: [...queryKeys.notes, "review-context", contextNoteIds],
    queryFn: ({ signal }) => requestNotesByIds<LtmNote>(contextNoteIds, signal),
    enabled: review.isSuccess && rejectedSuggestions.isSuccess,
  });
  const noteById = useMemo(() => new Map((notes.data ?? []).map((note) => [note.id, note])), [notes.data]);
  const reviewContextBusy =
    review.isSuccess && rejectedSuggestions.isSuccess && !notes.isError && (!notes.isSuccess || notes.isFetching);
  const reviewContextFailed = notes.isError;
  const reviewContextReady = notes.isSuccess && !notes.isFetching;
  const missingContextTitle = reviewContextFailed
    ? localizeUi("ui.longTermMemory.reviewqueue.memoryContextUnavailable")
    : reviewContextBusy
      ? localizeUi("ui.longTermMemory.reviewqueue.loadingMemoryContext")
      : localizeUi("ui.longTermMemory.reviewqueue.untitledMemory");
  const sourceIds = useMemo(
    () => [
      ...new Set([
        ...(review.data?.sources ?? []).map((source) => source.sourceNoteId),
        ...(rejectedSuggestions.data?.suggestions ?? []).map((suggestion) => suggestion.source.sourceNoteId),
        ...(selectedSourceId ? [selectedSourceId] : []),
      ]),
    ],
    [rejectedSuggestions.data?.suggestions, review.data?.sources, selectedSourceId],
  );
  const selectedSourceIsLive =
    review.data?.sources.some((source) => source.sourceNoteId === selectedSourceId) ||
    rejectedSuggestions.data?.suggestions.some((suggestion) => suggestion.source.sourceNoteId === selectedSourceId) ||
    false;
  useEffect(() => {
    if (!review.isSuccess || !rejectedSuggestions.isSuccess || !selectedSourceId || selectedSourceIsLive) {
      return;
    }
    setSelectedSourceId(null);
  }, [rejectedSuggestions.isSuccess, review.isSuccess, selectedSourceId, selectedSourceIsLive]);
  const effectiveSourceId =
    selectedSourceId && sourceIds.includes(selectedSourceId) ? selectedSourceId : (sourceIds[0] ?? null);
  const selectedReviewSource = review.data?.sources.find((source) => source.sourceNoteId === effectiveSourceId);
  const selectedDraft =
    selectedReviewSource?.drafts.find((item) => item.draft.id === selectedDraftId) ?? selectedReviewSource?.drafts[0];
  const sourceRejectedSuggestions =
    rejectedSuggestions.data?.suggestions.filter((item) => item.source.sourceNoteId === effectiveSourceId) ?? [];
  const needsSourceReextraction = Boolean(
    selectedReviewSource?.drafts.some(
      (item) =>
        item.blockReasons.length > 0 ||
        ["stale", "missing", "invalid", "superseded", "not_pending"].includes(item.freshness),
    ),
  );
  const selectedSourceIsExtractable = noteById.get(effectiveSourceId ?? "")?.type === "source";
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editedById, setEditedById] = useState<Map<string, LtmDraftMutation>>(new Map());
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [reviewStateHydrated, setReviewStateHydrated] = useState<string | null>(null);
  const [running, setRunning] = useState<"accept" | "skip" | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [preflightRows, setPreflightRows] = useState<Map<string, PreflightRow>>(new Map());
  const [preflightByDraftId, setPreflightByDraftId] = useState<Map<string, LtmDraftPreflightResponse>>(new Map());
  const [preflightKey, setPreflightKey] = useState<string | null>(null);
  const [deleteSuggestionError, setDeleteSuggestionError] = useState("");
  const [extractingSourceId, setExtractingSourceId] = useState<string | null>(null);
  const [extractionMessage, setExtractionMessage] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);
  const [reviewStateMessage, setReviewStateMessage] = useState<string | null>(null);
  const [reviewStatePersisted, setReviewStatePersisted] = useState(true);
  const [reviewStateMismatch, setReviewStateMismatch] = useState(false);
  const batchControllerRef = useRef<AbortController | null>(null);
  const selectedIdsRef = useRef(selectedIds);
  const editedByIdRef = useRef(editedById);
  const reviewDataRef = useRef(review.data);
  const reviewDataSignatureRef = useRef<string | null>(null);
  const reviewStateHydratedRef = useRef<string | null>(null);
  const persistenceTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const persistReviewStateSnapshotRef = useRef<(key: string, chatId: string | null | undefined) => boolean>(() => true);
  const flushReviewStateRef = useRef<() => boolean>(() => true);
  const reviewStateKey = reviewStateStorageKey(props.chatId);
  const reviewDataSignature = useMemo(
    () =>
      review.data
        ? JSON.stringify(
            review.data.sources.flatMap((source) =>
              source.drafts.map((item) => [item.draft.id, draftReviewFingerprint(item)]),
            ),
          )
        : null,
    [review.data],
  );
  selectedIdsRef.current = selectedIds;
  editedByIdRef.current = editedById;
  reviewDataRef.current = review.data;
  reviewDataSignatureRef.current = reviewDataSignature;
  reviewStateHydratedRef.current = reviewStateHydrated;

  const persistReviewStateSnapshot = (key: string, chatId: string | null | undefined) => {
    const state = buildPersistedReviewState(
      reviewDataRef.current,
      reviewDataSignatureRef.current,
      reviewStateHydratedRef.current,
      key,
      chatId,
      selectedIdsRef.current,
      editedByIdRef.current,
    );
    if (!state) return true;
    const persisted = writePersistedReviewState(key, state);
    if (mountedRef.current) {
      setReviewStatePersisted(persisted === "ok");
      if (persisted !== "ok")
        setReviewStateMessage(
          localizeUi(
            persisted === "unavailable"
              ? "ui.longTermMemory.reviewqueue.reviewStateUnavailable"
              : "ui.longTermMemory.reviewqueue.reviewStateSaveFailed",
          ),
        );
    }
    return persisted === "ok";
  };
  const flushReviewState = () => {
    if (persistenceTimerRef.current !== null) {
      window.clearTimeout(persistenceTimerRef.current);
      persistenceTimerRef.current = null;
    }
    return persistReviewStateSnapshot(reviewStateKey, props.chatId);
  };
  persistReviewStateSnapshotRef.current = persistReviewStateSnapshot;
  flushReviewStateRef.current = flushReviewState;

  useEffect(() => {
    setSelectedIds(new Set());
    setEditedById(new Map());
    setReviewedIds(new Set());
    setResult(null);
    setReviewStateHydrated(null);
    setReviewStateMessage(null);
    setReviewStateMismatch(false);
    setPreflightRows(new Map());
    setPreflightByDraftId(new Map());
    setPreflightKey(null);
    setDetailsOpen(false);
    setExpandedMutationIds(new Set());
  }, [props.chatId]);
  useEffect(() => {
    if (!review.isSuccess) return;
    cleanupPersistedReviewStates();
  }, [review.isSuccess]);
  useEffect(
    () => () => {
      batchControllerRef.current?.abort();
      batchControllerRef.current = null;
    },
    [],
  );
  useEffect(() => {
    const key = reviewStateKey;
    const chatId = props.chatId;
    return () => {
      if (persistenceTimerRef.current !== null) {
        window.clearTimeout(persistenceTimerRef.current);
        persistenceTimerRef.current = null;
      }
      persistReviewStateSnapshotRef.current(key, chatId);
    };
  }, [props.chatId, reviewStateKey]);
  useEffect(() => {
    const handlePageHide = () => flushReviewStateRef.current();
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []);
  useEffect(() => {
    if (reviewStatePersisted || !editedById.size) {
      onSaveRequest?.(null);
      return;
    }
    onSaveRequest?.(async () => flushReviewStateRef.current());
    return () => onSaveRequest?.(null);
  }, [editedById.size, onSaveRequest, reviewStatePersisted]);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );
  useEffect(() => {
    setSourceCollapsed(false);
    setSelectedDraftId(null);
    setDetailsOpen(false);
    setExpandedMutationIds(new Set());
    setPreflightRows(new Map());
    setPreflightByDraftId(new Map());
    setPreflightKey(null);
  }, [effectiveSourceId, selectedReviewSource?.sourceNoteId]);
  useEffect(() => {
    setDetailsOpen(false);
    setExpandedMutationIds(new Set());
    setPreflightRows(new Map());
    setPreflightByDraftId(new Map());
    setPreflightKey(null);
  }, [selectedDraft?.draft.id]);
  useEffect(() => {
    setPreflightRows(new Map());
    setPreflightByDraftId(new Map());
    setPreflightKey(null);
  }, [contextNoteIds, notes.data, notes.isError, notes.isFetching, notes.isSuccess]);

  useEffect(() => {
    if (!review.isSuccess) return;
    if (!reviewDataSignature) {
      setReviewStatePersisted(writePersistedReviewState(reviewStateKey, null) === "ok");
      setReviewStateHydrated(`${reviewStateKey}:empty`);
      return;
    }
    const hydrationKey = `${reviewStateKey}:${reviewDataSignature}`;
    if (reviewStateHydrated === hydrationKey) return;
    if (selectedIds.size || editedById.size) {
      setSelectedIds(new Set());
      setEditedById(new Map());
      setReviewStateMismatch(true);
      setReviewStateMessage(localizeUi("ui.longTermMemory.reviewqueue.savedReviewStateDiscarded"));
      setReviewStateHydrated(hydrationKey);
      return;
    }
    const persistedResult = readPersistedReviewState(reviewStateKey, props.chatId ?? null);
    const persisted = persistedResult.state;
    const restoredSelectedIds = new Set<string>();
    const restoredEdits = new Map<string, LtmDraftMutation>();
    let discardedState = false;
    const currentDrafts = new Map(
      review.data.sources.flatMap((source) => source.drafts.map((item) => [item.draft.id, item] as const)),
    );
    for (const [draftId, saved] of Object.entries(persisted?.drafts ?? {})) {
      const current = currentDrafts.get(draftId);
      if (
        !current ||
        current.draft.status !== "pending" ||
        saved.draftFingerprint !== draftReviewFingerprint(current) ||
        saved.contextFingerprint !== draftReviewContextFingerprint(current)
      ) {
        discardedState = true;
        continue;
      }
      const appliedMutationIds = new Set(current.draft.appliedMutationIds ?? []);
      const pendingMutations = current.draft.mutations.filter((mutation) => !appliedMutationIds.has(mutation.id));
      const currentMutationIds = new Set(pendingMutations.map((mutation) => mutation.id));
      const currentMutations = new Map(pendingMutations.map((mutation) => [mutation.id, mutation] as const));
      const savedMutationFingerprints = new Map(saved.mutationFingerprints);
      saved.selectedIds.forEach((id) => {
        if (!currentMutationIds.has(id)) return;
        if (savedMutationFingerprints.get(id) !== mutationFingerprint(currentMutations.get(id)!)) discardedState = true;
        else restoredSelectedIds.add(id);
      });
      for (const [id, mutation] of saved.editedMutations) {
        if (!currentMutationIds.has(id)) continue;
        if (savedMutationFingerprints.get(id) !== mutationFingerprint(currentMutations.get(id)!)) {
          discardedState = true;
          continue;
        }
        const parsed = parsePersistedMutation(mutation);
        if (parsed?.id === id) restoredEdits.set(id, parsed);
        else discardedState = true;
      }
    }
    setSelectedIds(restoredSelectedIds);
    setEditedById(restoredEdits);
    setReviewStateMessage(
      persistedResult.error
        ? localizeUi(
            persistedResult.error === "unavailable"
              ? "ui.longTermMemory.reviewqueue.reviewStateUnavailable"
              : "ui.longTermMemory.reviewqueue.reviewStateSaveFailed",
          )
        : discardedState
          ? localizeUi("ui.longTermMemory.reviewqueue.savedReviewStateDiscarded")
          : null,
    );
    setReviewStatePersisted(!discardedState && !persistedResult.error);
    setReviewStateMismatch(discardedState);
    setReviewStateHydrated(hydrationKey);
  }, [
    localizeUi,
    props.chatId,
    review.isSuccess,
    review.data,
    reviewDataSignature,
    reviewStateHydrated,
    reviewStateKey,
    selectedIds.size,
    editedById.size,
  ]);

  useEffect(() => {
    if (!review.isSuccess || !reviewDataSignature || reviewStateHydrated !== `${reviewStateKey}:${reviewDataSignature}`)
      return;
    if (persistenceTimerRef.current !== null) window.clearTimeout(persistenceTimerRef.current);
    persistenceTimerRef.current = window.setTimeout(() => {
      persistenceTimerRef.current = null;
      flushReviewStateRef.current();
    }, 250);
    return () => {
      if (persistenceTimerRef.current !== null) {
        window.clearTimeout(persistenceTimerRef.current);
        persistenceTimerRef.current = null;
      }
    };
  }, [editedById, review.isSuccess, reviewDataSignature, reviewStateHydrated, reviewStateKey, selectedIds]);

  const { rowByMutationId, rows } = useMemo(() => buildReviewRows(review.data), [review.data]);
  const mutationDisplayLabels = useMemo(
    () =>
      new Map(
        rows.flatMap((row) => [
          [row.mutation.id, mutationDisplayLabel(row.mutation, noteById, localizeUi)] as const,
          ...(row.mutation.kind === "create_note"
            ? [
                [
                  row.mutation.note.id,
                  row.mutation.note.title || localizeUi("ui.longTermMemory.reviewqueue.thisMemory"),
                ] as const,
              ]
            : []),
        ]),
      ),
    [localizeUi, noteById, rows],
  );
  const replacementEntries = useMemo(() => {
    const replacements = new Map<string, string>([
      ...[...noteById].map(
        ([id, note]) =>
          [
            id,
            noteDisplayTitle(
              note,
              note.type === "source"
                ? localizeUi("ui.longTermMemory.reviewqueue.thisSource")
                : localizeUi("ui.longTermMemory.reviewqueue.thisMemory"),
            ),
          ] as const,
      ),
      ...mutationDisplayLabels,
    ]);
    const ids = [...replacements.keys()].sort((left, right) => right.length - left.length);
    return {
      replacements,
      pattern: ids.length
        ? new RegExp(ids.map((id) => id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|"), "gu")
        : undefined,
    };
  }, [localizeUi, mutationDisplayLabels, noteById]);
  const humanizeText = (text: string) =>
    humanizeReviewText(
      text,
      noteById,
      replacementEntries.pattern,
      replacementEntries.replacements,
      localizeUi("ui.longTermMemory.reviewqueue.sourcePrefix"),
      missingContextTitle,
    );
  const reviewDraftTitle = (item: LtmDraftReviewDraft) => draftDisplayTitle(item, localizeUi);
  useEffect(
    () => onDirtyChange?.(reviewStateMismatch || (!reviewStatePersisted && editedById.size > 0)),
    [editedById.size, onDirtyChange, reviewStateMismatch, reviewStatePersisted],
  );
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const sourceRows = useMemo(
    () => rows.filter((row) => row.sourceNoteId === effectiveSourceId),
    [effectiveSourceId, rows],
  );
  const activeDraftRows = useMemo(
    () => sourceRows.filter((row) => row.draftId === selectedDraft?.draft.id),
    [selectedDraft?.draft.id, sourceRows],
  );
  const dependencyCounts = useMemo(
    () =>
      new Map(
        activeDraftRows.map((row) => [
          row.mutation.id,
          Math.max(0, acceptedMutationIds(activeDraftRows, [row.mutation.id]).size - 1),
        ]),
      ),
    [activeDraftRows],
  );
  const selectedRows = activeDraftRows.filter((row) => selectedIds.has(row.mutation.id));
  const eligibleIds = new Set<string>();
  for (const source of review.data?.sources ?? []) {
    for (const item of source.drafts) {
      if (item.freshness !== "fresh" || item.blockReasons.length) continue;
      for (const mutation of item.draft.mutations) {
        if (!item.draft.appliedMutationIds?.includes(mutation.id)) eligibleIds.add(mutation.id);
      }
    }
  }
  const eligibleSelectedRows = selectedRows.filter((row) => eligibleIds.has(row.mutation.id));
  const skippableDraftIds = new Set(
    (review.data?.sources ?? []).flatMap((source) =>
      source.drafts.filter((item) => item.draft.status === "pending").map((item) => item.draft.id),
    ),
  );
  const skippableSelectedRows = selectedRows.filter((row) => skippableDraftIds.has(row.draftId));
  const invalidSelectedEdits = eligibleSelectedRows.filter((row) => {
    const edited = editedById.get(row.mutation.id);
    return edited ? !selectedEditIsValid(edited) : false;
  });
  const allSelected = activeDraftRows.length > 0 && selectedRows.length === activeDraftRows.length;
  const someSelected = selectedRows.length > 0 && !allSelected;
  const reviewMutationIds = useMemo(
    () =>
      new Set(
        review.data?.sources.flatMap((source) =>
          source.drafts.flatMap((item) =>
            item.draft.mutations
              .filter((mutation) => !item.draft.appliedMutationIds?.includes(mutation.id))
              .map((mutation) => mutation.id),
          ),
        ) ?? [],
      ),
    [review.data],
  );
  const reviewProgress = {
    sources: review.data?.counts.sources ?? 0,
    pending: reviewMutationIds.size,
    ready: eligibleIds.size,
    blocked: review.data?.counts.blockedDrafts ?? 0,
    reviewed: reviewedIds.size,
    remaining: Math.max(
      0,
      (review.data?.counts.mutations ?? 0) - [...reviewedIds].filter((id) => reviewMutationIds.has(id)).length,
    ),
  };
  const preflightApplyDisabled = result?.phase === "preflight" && result.ready === 0;

  const clearPreflight = () => {
    setPreflightRows(new Map());
    setPreflightByDraftId(new Map());
    setPreflightKey(null);
    setResult(null);
  };

  const toggleSelection = (id: string) => {
    clearPreflight();
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateMutation = (original: LtmDraftMutation, next: LtmDraftMutation) => {
    setEditedById((current) => {
      const updated = new Map(current);
      if (sameMutation(original, next)) updated.delete(original.id);
      else updated.set(original.id, next);
      return updated;
    });
    clearPreflight();
  };

  const invalidClosureEditIds = (applicableRows: readonly ReviewRow[], allRows: readonly ReviewRow[] = rows) => {
    const invalidIds: string[] = [];
    for (const [draftId, selectedDraftRows] of groupByDraft(applicableRows)) {
      const draftRows = allRows
        .filter((row) => row.draftId === draftId)
        .map((row) => ({
          ...row,
          mutation: editedById.get(row.mutation.id) ?? row.mutation,
        }));
      const acceptedIds = acceptedMutationIds(
        draftRows,
        selectedDraftRows.map((row) => row.mutation.id),
      );
      for (const id of acceptedIds) {
        const edited = editedById.get(id);
        if (edited && !selectedEditIsValid(edited)) invalidIds.push(id);
      }
    }
    return invalidIds;
  };

  const buildAcceptRequests = (applicableRows: readonly ReviewRow[], allRows: readonly ReviewRow[]): AcceptRequest[] =>
    [...groupByDraft(applicableRows)].map(([draftId, selectedDraftRows]) => {
      const draftRows = allRows
        .filter((row) => row.draftId === draftId)
        .map((row) => ({ ...row, mutation: editedById.get(row.mutation.id) ?? row.mutation }));
      const mutationIds = [
        ...acceptedMutationIds(
          draftRows,
          selectedDraftRows.map((row) => row.mutation.id),
        ),
      ].sort();
      return {
        draftId,
        mutationIds,
        editedMutations: [...editedById].filter(([id]) => mutationIds.includes(id)).map(([, edited]) => edited),
      };
    });

  const acceptRequestKey = (requests: AcceptRequest[]) =>
    JSON.stringify(
      requests.map((request) => ({
        draftId: request.draftId,
        mutationIds: request.mutationIds,
        editedMutations: request.editedMutations,
      })),
    );

  const confirmDiscard = async (applicableRows: readonly ReviewRow[]) => {
    const dependentCopy = localizeUi("ui.longTermMemory.reviewqueue.discardDependentWarning");
    const message = localizeUi(
      applicableRows.length === 1
        ? "ui.longTermMemory.reviewqueue.discardProposalDescription"
        : "ui.longTermMemory.reviewqueue.discardSelectedDescription",
      {
        count: applicableRows.length,
        title: mutationDisplayLabel(applicableRows[0]?.mutation, noteById, localizeUi),
        dependent: dependentCopy,
      },
    );
    return props.confirmAction
      ? props.confirmAction({
          title: localizeUi("ui.longTermMemory.reviewqueue.discardProposalTitle"),
          message,
          confirmLabel: localizeUi("ui.longTermMemory.reviewqueue.discard"),
          tone: "destructive",
        })
      : window.confirm(`${localizeUi("ui.longTermMemory.reviewqueue.discardProposalTitle")}\n\n${message}`);
  };

  const runBatch = async (
    action: ReviewAction,
    explicitRows?: ReviewRow[],
    allRows: readonly ReviewRow[] = rows,
    allRowByMutationId: ReadonlyMap<string, ReviewRow> = rowByMutationId,
    retrying = false,
  ) => {
    const applicableRows = explicitRows ?? (action === "accept" ? eligibleSelectedRows : skippableSelectedRows);
    if (!applicableRows.length) return;
    if (action === "accept" && !reviewContextReady) return;
    const invalidEditIds = action === "accept" ? invalidClosureEditIds(applicableRows, allRows) : [];
    if (invalidEditIds.length) {
      setResult({
        action: "accepted",
        phase: "preflight",
        ready: 0,
        completed: 0,
        failed: invalidEditIds.length,
        remaining: applicableRows.length,
        autoIncluded: 0,
        indexRebuildFailures: [],
        messages: [
          localizeUi(
            selectLtmPluralForm(locale, invalidEditIds.length) === "one"
              ? "ui.longTermMemory.reviewqueue.invalidEditedMutationOne"
              : "ui.longTermMemory.reviewqueue.invalidEditedMutationOther",
            {
              count: invalidEditIds.length,
              labels: invalidEditIds
                .map((id) => mutationDisplayLabels.get(id) ?? localizeUi("ui.longTermMemory.reviewqueue.editedChange"))
                .join(", "),
            },
          ),
        ],
        cascadeMutationLabels: [],
        savedMemoryIds: [],
        failedMutationIds: invalidEditIds,
        failedDraftIds: [...new Set(applicableRows.map((row) => row.draftId))],
        completedMutationIds: [],
        blockedMutationIds: [],
      });
      return;
    }
    if (action === "skip" && !(await confirmDiscard(applicableRows))) return;
    const acceptRequests = action === "accept" ? buildAcceptRequests(applicableRows, allRows) : [];
    const requestKey = action === "accept" ? acceptRequestKey(acceptRequests) : null;
    batchControllerRef.current?.abort();
    const controller = new AbortController();
    batchControllerRef.current = controller;
    if (action === "accept" && preflightKey !== requestKey) {
      setRunning("accept");
      setResult(null);
      const preflights = new Map<string, LtmDraftPreflightResponse>();
      const nextRows = new Map<string, PreflightRow>();
      const blockedMutationIds = new Set<string>();
      const messages: string[] = [];
      const failedMutationIds = new Set<string>();
      try {
        for (const requestBody of acceptRequests) {
          try {
            const response = await request<LtmDraftPreflightResponse>(
              `/drafts/${requestBody.draftId}/preflight`,
              "POST",
              {
                mutationIds: requestBody.mutationIds,
                ...(requestBody.editedMutations.length ? { editedMutations: requestBody.editedMutations } : {}),
                bulk: requestBody.mutationIds.length > 1,
              },
              controller.signal,
            );
            preflights.set(requestBody.draftId, response);
            response.rows.forEach((row) => nextRows.set(row.mutationId, row));
            response.blockedMutationIds.forEach((id) => blockedMutationIds.add(id));
          } catch (error) {
            if (isAbortError(error)) return;
            requestBody.mutationIds.forEach((id) => failedMutationIds.add(id));
            messages.push(
              localizeUi("ui.longTermMemory.reviewqueue.draftActionFailed", {
                message:
                  error instanceof Error ? error.message : localizeUi("ui.longTermMemory.reviewqueue.requestFailed"),
              }),
            );
          }
          if (controller.signal.aborted) return;
        }
        setPreflightByDraftId(preflights);
        setPreflightRows(nextRows);
        setPreflightKey(messages.length ? null : requestKey);
        setExpandedMutationIds(
          new Set([...nextRows.values()].filter((row) => row.status === "blocked").map((row) => row.mutationId)),
        );
        setResult({
          action: "accepted",
          phase: "preflight",
          ready: [...preflights.values()].reduce((sum, response) => sum + response.readyMutationIds.length, 0),
          completed: 0,
          failed: failedMutationIds.size,
          remaining: applicableRows.length,
          autoIncluded: [...preflights.values()].reduce(
            (sum, response) => sum + response.autoIncludedMutationIds.length,
            0,
          ),
          indexRebuildFailures: [],
          messages: retrying
            ? [localizeUi("ui.longTermMemory.reviewqueue.retryPreflightReady"), ...messages]
            : messages,
          cascadeMutationLabels: [],
          savedMemoryIds: [],
          failedMutationIds: [...failedMutationIds],
          failedDraftIds: [],
          completedMutationIds: [],
          blockedMutationIds: [...blockedMutationIds],
        });
      } finally {
        if (!controller.signal.aborted && batchControllerRef.current === controller) {
          batchControllerRef.current = null;
          setRunning(null);
        }
      }
      return;
    }
    setRunning(action);
    setResult(null);
    const completedIds = new Set<string>();
    const remainingIds = new Set<string>();
    const failedIds = new Set<string>();
    const failedDraftIds = new Set<string>();
    const autoIncludedIds = new Set<string>();
    const indexRebuildFailures: string[] = [];
    const messages: string[] = [];
    const cascadeMutationLabels = new Set<string>();
    const blockedMutationIds = new Set<string>();
    try {
      for (const [draftId, draftRows] of groupByDraft(applicableRows)) {
        const mutationIds = draftRows.map((row) => row.mutation.id);
        try {
          if (action === "accept") {
            const preflight = preflightByDraftId.get(draftId);
            if (!preflight) throw new Error(localizeUi("ui.longTermMemory.reviewqueue.preflightMissing"));
            preflight.blockedMutationIds.forEach((id) => blockedMutationIds.add(id));
            const readyIds = new Set(preflight.readyMutationIds);
            if (!readyIds.size) continue;
            const requestBody = acceptRequests.find((request) => request.draftId === draftId)!;
            const response = await request<ApplyDraftResponse>(
              `/drafts/${draftId}/accept`,
              "POST",
              {
                mutationIds: [...readyIds],
                ...(requestBody.editedMutations.length
                  ? { editedMutations: requestBody.editedMutations.filter((mutation) => readyIds.has(mutation.id)) }
                  : {}),
              },
              controller.signal,
            );
            const applied = new Set(response.appliedMutationIds);
            const skipped = new Set(response.skippedMutationIds);
            response.skippedMutationIds.forEach((id) => remainingIds.add(id));
            readyIds.forEach((id) => {
              if (applied.has(id)) completedIds.add(id);
              else if (skipped.has(id)) return;
              else failedIds.add(id);
            });
            response.autoIncludedMutationIds.forEach((id) => autoIncludedIds.add(id));
            response.autoIncludedMutationIds.forEach((id) => {
              if (applied.has(id)) completedIds.add(id);
            });
            if (response.indexRebuild.status === "failed") indexRebuildFailures.push(response.indexRebuild.error);
          } else {
            const response = await request<SkipDraftResponse>(
              `/drafts/${draftId}/skip`,
              "POST",
              { mutationIds },
              controller.signal,
            );
            const deleted = new Set(response.mutationIds);
            response.mutationIds.forEach((id) => {
              completedIds.add(id);
              if (!mutationIds.includes(id)) {
                cascadeMutationLabels.add(
                  mutationDisplayLabels.get(id) ?? localizeUi("ui.longTermMemory.reviewqueue.dependentChange"),
                );
              }
            });
            mutationIds.forEach((id) => {
              if (!deleted.has(id)) failedIds.add(id);
            });
          }
          if (mutationIds.some((id) => failedIds.has(id))) failedDraftIds.add(draftId);
        } catch (error) {
          if (isAbortError(error)) return;
          const failedRequestIds =
            action === "accept"
              ? new Set(preflightByDraftId.get(draftId)?.readyMutationIds ?? [])
              : new Set(mutationIds);
          failedRequestIds.forEach((id) => failedIds.add(id));
          if (failedRequestIds.size) failedDraftIds.add(draftId);
          messages.push(
            localizeUi("ui.longTermMemory.reviewqueue.draftActionFailed", {
              message:
                error instanceof Error ? error.message : localizeUi("ui.longTermMemory.reviewqueue.requestFailed"),
            }),
          );
        }
        if (controller.signal.aborted) return;
      }
      setSelectedIds((current) => {
        const next = new Set(current);
        completedIds.forEach((id) => next.delete(id));
        return next;
      });
      setEditedById((current) => {
        const next = new Map(current);
        completedIds.forEach((id) => next.delete(id));
        return next;
      });
      setReviewedIds((current) => new Set([...current, ...completedIds]));
      setPreflightKey(null);
      setResult({
        action: action === "accept" ? "accepted" : "skipped",
        phase: "complete",
        ready: 0,
        completed: completedIds.size,
        failed: failedIds.size,
        remaining: remainingIds.size + failedIds.size,
        autoIncluded: autoIncludedIds.size,
        indexRebuildFailures,
        messages,
        cascadeMutationLabels: [...cascadeMutationLabels],
        failedMutationIds: [...failedIds],
        failedDraftIds: [...failedDraftIds],
        completedMutationIds: [...completedIds],
        savedMemoryIds:
          action === "accept"
            ? [
                ...new Set(
                  [...completedIds].flatMap((id) => {
                    const currentRow = allRowByMutationId.get(id);
                    return currentRow ? [currentRow.targetId] : [];
                  }),
                ),
              ]
            : [],
        blockedMutationIds: [...blockedMutationIds],
      });
      if (completedIds.size) {
        await invalidateLtmQueries(queryClient, [
          queryKeys.review,
          queryKeys.pendingDrafts,
          queryKeys.scopeTargetsRoot,
          ...(action === "accept" ? [queryKeys.notes, queryKeys.status, queryKeys.integrity, queryKeys.preview] : []),
        ]);
      }
    } finally {
      if (!controller.signal.aborted && batchControllerRef.current === controller) {
        batchControllerRef.current = null;
        setRunning(null);
      }
    }
  };

  const retryInFlightRef = useRef(false);
  const retryFailed = async () => {
    if (!result?.failedMutationIds.length || running !== null || retryInFlightRef.current) return;
    const action = result.action === "accepted" ? "accept" : "skip";
    retryInFlightRef.current = true;
    try {
      const refreshed = await review.refetch();
      if (refreshed.error) throw refreshed.error;
      const refreshedRows = buildReviewRows(refreshed.data);
      const pendingMutationIds = new Set(
        refreshed.data?.sources.flatMap((source) =>
          source.drafts
            .filter((item) => item.draft.status === "pending")
            .flatMap((item) =>
              item.draft.mutations
                .filter((mutation) => !item.draft.appliedMutationIds?.includes(mutation.id))
                .map((mutation) => mutation.id),
            ),
        ) ?? [],
      );
      const failedRows = result.failedMutationIds
        .filter((id) => pendingMutationIds.has(id))
        .map((id) => refreshedRows.rowByMutationId.get(id))
        .filter((row): row is ReviewRow => Boolean(row));
      if (!failedRows.length) {
        setResult((current) =>
          current
            ? {
                ...current,
                messages: [...current.messages, localizeUi("ui.longTermMemory.reviewqueue.retryNoLongerNeeded")],
              }
            : current,
        );
        return;
      }
      setSelectedIds((current) => new Set([...current, ...failedRows.map((row) => row.mutation.id)]));
      const pendingRows = refreshedRows.rows.filter((row) => pendingMutationIds.has(row.mutation.id));
      await runBatch(action, failedRows, pendingRows, refreshedRows.rowByMutationId, true);
    } catch (error) {
      setResult((current) =>
        current
          ? {
              ...current,
              messages: [
                ...current.messages,
                localizeUi("ui.longTermMemory.reviewqueue.draftActionFailed", {
                  message:
                    error instanceof Error ? error.message : localizeUi("ui.longTermMemory.reviewqueue.requestFailed"),
                }),
              ],
            }
          : current,
      );
    } finally {
      retryInFlightRef.current = false;
    }
  };

  const reviewFailed = () => {
    if (!result?.failedDraftIds.length || running !== null) return;
    const row = rows.find((candidate) => result.failedDraftIds.includes(candidate.draftId));
    if (!row) return;
    setSelectedSourceId(row.sourceNoteId);
    setSelectedDraftId(row.draftId);
    setSourceCollapsed(false);
    setMobilePaneAndFocus("workbench");
  };

  const dismissReport = async (draftId: string) => {
    setDismissingId(draftId);
    setResult(null);
    try {
      await request(`/drafts/${draftId}`, "DELETE");
      await invalidateLtmQueries(queryClient, [queryKeys.review, queryKeys.pendingDrafts]);
    } catch (error) {
      setResult({
        action: "skipped",
        phase: "complete",
        ready: 0,
        completed: 0,
        failed: 1,
        remaining: 0,
        autoIncluded: 0,
        indexRebuildFailures: [],
        messages: [
          localizeUi("ui.longTermMemory.reviewqueue.reportDismissalFailed", {
            message: error instanceof Error ? error.message : localizeUi("ui.longTermMemory.reviewqueue.requestFailed"),
          }),
        ],
        cascadeMutationLabels: [],
        savedMemoryIds: [],
        failedMutationIds: [],
        failedDraftIds: [],
        completedMutationIds: [],
        blockedMutationIds: [],
      });
    } finally {
      setDismissingId(null);
    }
  };

  const deleteRejectedSuggestion = async (suggestion: LtmRejectedSuggestion) => {
    const title = noteById.get(suggestion.source.sourceNoteId)?.title ?? missingContextTitle;
    const confirmed = props.confirmAction
      ? await props.confirmAction({
          title: localizeUi("ui.longTermMemory.reviewqueue.deleteRejectedSuggestion"),
          message: localizeUi("ui.longTermMemory.reviewqueue.deleteRejectedSuggestionDescription", { title }),
          confirmLabel: localizeUi("ui.longTermMemory.reviewqueue.delete"),
          tone: "destructive",
        })
      : window.confirm(localizeUi("ui.longTermMemory.reviewqueue.deleteRejectedSuggestionDescription", { title }));
    if (!confirmed) return;
    setDismissingId(suggestion.id);
    setDeleteSuggestionError("");
    try {
      await request(`/rejected-suggestions/${encodeURIComponent(suggestion.id)}`, "DELETE");
      await invalidateLtmQueries(queryClient, [queryKeys.rejectedSuggestions]);
    } catch (error) {
      setDeleteSuggestionError(
        error instanceof Error ? error.message : localizeUi("ui.longTermMemory.reviewqueue.requestFailed"),
      );
    } finally {
      setDismissingId(null);
    }
  };

  const reextractSource = async () => {
    if (!effectiveSourceId || extractingSourceId) return;
    const sourceId = effectiveSourceId;
    const editedSourceMutationIds = new Set(
      [...editedById.keys()].filter((id) => rowByMutationId.get(id)?.sourceNoteId === sourceId),
    );
    const sourceMutationIds = new Set(
      rows.filter((row) => row.sourceNoteId === sourceId).map((row) => row.mutation.id),
    );
    if (editedSourceMutationIds.size) {
      const action = localizeUi("ui.longTermMemory.reviewqueue.reExtractSource");
      const options = {
        title: localizeUi("ui.longTermMemory.longtermmemorydetail.discardUnsavedChanges"),
        message: localizeUi("ui.longTermMemory.memoryvault.changesLostBeforeAction", { action }),
        confirmLabel: localizeUi("ui.longTermMemory.longtermmemorydetail.discardChanges"),
        tone: "destructive" as const,
      };
      const confirmed = props.confirmAction
        ? await props.confirmAction(options)
        : window.confirm(
            localizeUi("ui.longTermMemory.longtermmemorydetail.confirmationWithMessage", {
              title: options.title,
              message: options.message,
            }),
          );
      if (!confirmed) return;
    }
    setExtractingSourceId(sourceId);
    setExtractionMessage(null);
    try {
      await request(`/notes/${encodeURIComponent(sourceId)}/extract`, "POST", {});
      await invalidateLtmQueries(queryClient, [
        queryKeys.review,
        queryKeys.pendingDrafts,
        queryKeys.rejectedSuggestions,
      ]);
      if (editedSourceMutationIds.size) {
        setEditedById((current) => {
          const next = new Map(current);
          editedSourceMutationIds.forEach((id) => next.delete(id));
          return next;
        });
      }
      setSelectedIds((current) => {
        const next = new Set(current);
        sourceMutationIds.forEach((id) => next.delete(id));
        return next;
      });
      setExtractionMessage({
        tone: "success",
        text: localizeUi("ui.longTermMemory.reviewqueue.sourceReextracted"),
      });
    } catch (error) {
      setExtractionMessage({
        tone: "danger",
        text:
          error instanceof Error ? error.message : localizeUi("ui.longTermMemory.reviewqueue.sourceReextractionFailed"),
      });
    } finally {
      setExtractingSourceId(null);
    }
  };

  const renderRow = (row: ReviewRow, projectionStale = false) => {
    const mutation = editedById.get(row.mutation.id) ?? row.mutation;
    const targetExists = noteById.has(row.targetId);
    const canEditTitle =
      mutation.kind === "create_note" &&
      (row.disposition === "new" || (targetExists && !noteById.get(row.targetId)?.title));
    const edited = editedById.has(row.mutation.id);
    const hideProjection = edited || projectionStale;
    const valid = selectedEditIsValid(mutation);
    const previewChanges = hideProjection ? [] : row.changes;
    const expanded = expandedMutationIds.has(row.mutation.id);
    const preflight = preflightRows.get(row.mutation.id);
    const rowRequestKey = acceptRequestKey(buildAcceptRequests([row], rows));
    const rowPreflighted = preflightKey === rowRequestKey;
    const rowPreflight = preflightByDraftId.get(row.draftId)?.selectedMutationIds.includes(row.mutation.id)
      ? preflight
      : undefined;
    const preflightBlocked = rowPreflight?.status === "blocked";
    const preflightReady = rowPreflighted && rowPreflight?.status === "ready";
    const dependencyCount = dependencyCounts.get(row.mutation.id) ?? 0;
    const mutationLabel = localizeUi(mutationLabels[mutation.kind]);
    const dispositionLabel = localizeUi(dispositionLabels[row.disposition]);
    const targetNote = mutation.kind === "create_note" ? mutation.note : noteById.get(row.targetId);
    const targetTitle = noteDisplayTitle(targetNote, row.targetTitle ?? missingContextTitle);
    const targetBody = noteBody(targetNote);
    const targetType =
      noteById.get(row.targetId)?.type ??
      row.targetType ??
      (mutation.kind === "create_note" ? mutation.note.type : undefined);
    const displayTitle =
      mutation.kind === "create_note" && targetType === "character"
        ? localizeUi("ui.longTermMemory.reviewqueue.proposedCharacterMemory", {
            title: targetTitle,
          })
        : targetTitle;
    const previewChange = previewChanges[0];
    const proposedText = mutationProposedText(mutation, noteById);
    const collapsedBody = edited || projectionStale ? proposedText : targetBody;
    const changeSummary = edited
      ? localizeUi("ui.longTermMemory.reviewqueue.editedProposalSummary", {
          value: proposedText || localizeUi("ui.longTermMemory.reviewqueue.editedChange"),
        })
      : projectionStale
        ? localizeUi("ui.longTermMemory.reviewqueue.editedProjectionSummary")
        : previewChange
          ? localizeUi("ui.longTermMemory.reviewqueue.changeSummary", {
              before: previewChange.before || localizeUi("ui.longTermMemory.reviewqueue.newValue"),
              after: previewChange.after,
            })
          : localizeUi("ui.longTermMemory.reviewqueue.proposedSummary", {
              value: proposedText || mutation.summary,
            });
    const rowActionLabel =
      running === "accept"
        ? localizeUi("ui.longTermMemory.reviewqueue.applyingChange", { title: targetTitle })
        : preflightBlocked
          ? localizeUi("ui.longTermMemory.reviewqueue.applyBlockedForTitle", { title: targetTitle })
          : preflightReady
            ? localizeUi("ui.longTermMemory.reviewqueue.applyChangeForTitle", { title: targetTitle })
            : localizeUi("ui.longTermMemory.reviewqueue.reviewChangeForTitle", { title: targetTitle });
    const importance =
      mutation.kind === "create_note"
        ? importanceOptions.find((value) =>
            Object.values(mutation.note.sections).some((section) => section.importance === value),
          )
        : mutation.kind === "append_section"
          ? mutation.importance
          : mutation.kind === "update_section"
            ? mutation.section.importance
            : undefined;
    return (
      <article
        key={row.mutation.id}
        data-ltm-review-mutation={row.mutation.id}
        className={`rounded-md border border-[var(--border)] px-1 py-3 ${selectedIds.has(row.mutation.id) ? "bg-[var(--accent)]/55" : ""}`}
      >
        <div className="flex min-w-0 items-start gap-2">
          <SelectionCheckbox
            checked={selectedIds.has(row.mutation.id)}
            compact
            label={`${localizeUi("ui.longTermMemory.memoryvault.selectValue1", {
              value1: mutationLabel,
            })}: ${displayTitle}`}
            onChange={() => toggleSelection(row.mutation.id)}
          />
          <button
            type="button"
            data-ltm-review-mutation-toggle={row.mutation.id}
            aria-expanded={expanded}
            onClick={() =>
              setExpandedMutationIds((current) => {
                const next = new Set(current);
                if (next.has(row.mutation.id)) next.delete(row.mutation.id);
                else next.add(row.mutation.id);
                return next;
              })
            }
            aria-controls={expanded ? `ltm-review-mutation-details-${row.mutation.id}` : undefined}
            className="relative min-w-0 flex-1 rounded-md px-2 py-1 pr-8 text-left hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-editor-focus-ring)]"
            data-ltm-risk={row.mutation.risk}
            data-ltm-disposition={row.disposition}
          >
            <span className="block text-sm font-semibold">{displayTitle}</span>
            {collapsedBody ? (
              <span className="mt-1 block truncate text-xs text-[var(--muted-foreground)]">{collapsedBody}</span>
            ) : null}
            <span className="mt-1 flex flex-wrap gap-1 text-[0.6875rem]">
              {targetType ? (
                <span
                  data-ltm-review-type={targetType}
                  className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5"
                >
                  {localizedLabel(targetType, localizeUi, labelKeys.noteType)}
                </span>
              ) : null}
              <span
                data-ltm-review-disposition={row.disposition}
                className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5"
              >
                {dispositionLabel}
              </span>
              {mutation.kind !== "create_note" ? (
                <span
                  data-ltm-review-operation={mutation.kind}
                  className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5"
                >
                  {mutationLabel}
                </span>
              ) : null}
              {importance ? (
                <span
                  data-ltm-review-importance={importance}
                  className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5"
                >
                  {localizedLabel(importance, localizeUi, labelKeys.importance)}
                </span>
              ) : null}
              <span className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5">
                {localizedLabel(row.mutation.risk, localizeUi, labelKeys.risk)} /{" "}
                {Math.round(row.mutation.confidence * 100)}
                {localizeUi("ui.longTermMemory.reviewqueue.confidence")}
              </span>
              {dependencyCount ? (
                <span className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5">
                  {localizeUi("ui.longTermMemory.reviewqueue.dependencyHint", {
                    count: dependencyCount,
                    dependency:
                      dependencyCount === 1
                        ? localizeUi("ui.longTermMemory.reviewqueue.dependency")
                        : localizeUi("ui.longTermMemory.reviewqueue.dependencies"),
                  })}
                </span>
              ) : null}
            </span>
            <span data-ltm-review-summary className="mt-3 block space-y-1 text-xs">
              <span className="block font-semibold text-[var(--foreground)]">
                {localizeUi("ui.longTermMemory.reviewqueue.changeLabel")}
              </span>
              <span className="block line-clamp-2 break-words text-[var(--muted-foreground)]">{changeSummary}</span>
            </span>
            <span data-ltm-review-evidence-summary className="mt-2 block space-y-1 text-xs">
              <span className="block font-semibold text-[var(--foreground)]">
                {localizeUi("ui.longTermMemory.reviewqueue.evidenceLabel")}
              </span>
              <span className="block line-clamp-2 break-words text-[var(--muted-foreground)]">
                {humanizeText(row.mutation.evidence[0] ?? localizeUi("ui.longTermMemory.reviewqueue.noEvidence"))}
                {row.mutation.evidence.length > 1
                  ? ` ${localizeUi("ui.longTermMemory.reviewqueue.moreEvidence", { count: row.mutation.evidence.length - 1 })}`
                  : ""}
              </span>
            </span>
            <ChevronRight
              aria-hidden="true"
              size="0.875rem"
              className={`absolute right-2 top-3 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </button>
          <div
            role="group"
            aria-label={localizeUi("ui.longTermMemory.reviewqueue.mutationActions")}
            className="flex shrink-0 gap-1 pt-1"
          >
            <IconButton
              icon={Check}
              label={rowActionLabel}
              data-ltm-review-action={preflightReady ? "apply" : preflightBlocked ? "blocked" : "review"}
              iconSize="1rem"
              className="mari-editor-action--primary !h-11 !min-h-11 !w-11 !min-w-11"
              style={{ height: 44, minHeight: 44, width: 44, minWidth: 44 }}
              disabled={
                !eligibleIds.has(row.mutation.id) ||
                !valid ||
                preflightBlocked ||
                !reviewContextReady ||
                running !== null
              }
              onClick={() => void runBatch("accept", [row])}
            />
            <IconButton
              icon={X}
              label={localizeUi("ui.longTermMemory.reviewqueue.discardProposalNamed", {
                title: targetTitle,
              })}
              iconSize="1rem"
              className="!h-11 !min-h-11 !w-11 !min-w-11"
              style={{ height: 44, minHeight: 44, width: 44, minWidth: 44 }}
              destructive
              disabled={!skippableDraftIds.has(row.draftId) || running !== null}
              onClick={() => void runBatch("skip", [row])}
            />
          </div>
        </div>
        {expanded ? (
          <div
            id={`ltm-review-mutation-details-${row.mutation.id}`}
            data-ltm-review-mutation-details
            className="ml-0 space-y-3 border-t border-[var(--border)]/70 pt-3 text-xs sm:ml-10"
          >
            {onOpenMemory && targetExists ? (
              <Button onClick={() => onOpenMemory(row.targetId)}>
                {localizeUi("ui.longTermMemory.reviewqueue.openMemory")}
              </Button>
            ) : null}
            <details data-ltm-review-preview className="text-xs">
              <summary className="cursor-pointer font-medium">
                {localizeUi("ui.longTermMemory.reviewqueue.evidenceAndPreview")} {row.mutation.evidence.length}{" "}
                {localizeUi("ui.longTermMemory.reviewqueue.evidence")}
                {previewChanges.length
                  ? localizeUi("ui.longTermMemory.reviewqueue.value1Changes", {
                      value1: previewChanges.length,
                    })
                  : ""}
              </summary>
              <div className="mt-2 space-y-2">
                <div data-ltm-review-evidence className="space-y-1">
                  <span className="font-medium">{localizeUi("ui.longTermMemory.reviewqueue.evidence_3ef3540")}</span>
                  {row.mutation.evidence.map((evidence, index) => (
                    <blockquote
                      key={`${evidence}-${index}`}
                      className="break-words border-l border-[var(--border)] py-0.5 pl-3 leading-5 text-[var(--muted-foreground)]"
                    >
                      {humanizeText(evidence)}
                    </blockquote>
                  ))}
                </div>
                {previewChanges.length ? (
                  <div data-ltm-review-changes className="space-y-1">
                    {previewChanges.map((change) => (
                      <p key={`${change.kind}-${change.key}`}>
                        <span className="font-medium">
                          {humanizeLabel(change.kind)} {humanizeLabel(change.key)}:
                        </span>{" "}
                        {change.before
                          ? localizeUi("ui.longTermMemory.reviewqueue.value1", {
                              value1: change.before,
                            })
                          : ""}
                        {change.after}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </details>
            {row.diagnostics.length ? (
              <div
                data-ltm-review-diagnostics
                className="mari-editor-panel mari-editor-panel--soft space-y-1 border-[var(--destructive)]/35 p-3 text-xs text-[var(--destructive)]"
              >
                {row.diagnostics.map((diagnostic, index) => (
                  <p key={`${diagnostic.code}-${index}`}>
                    {humanizeLabel(diagnostic.code)}: {humanizeText(diagnostic.message)}
                  </p>
                ))}
              </div>
            ) : null}
            {preflight ? (
              <div
                data-ltm-review-preflight
                role={preflightBlocked ? "alert" : "status"}
                className={`mari-editor-panel mari-editor-panel--soft space-y-2 p-3 text-xs ${
                  preflightBlocked ? "border-[var(--destructive)]/35 text-[var(--destructive)]" : ""
                }`}
              >
                <p className="font-semibold">
                  {preflightBlocked
                    ? localizeUi("ui.longTermMemory.reviewqueue.preflightBlocked")
                    : localizeUi("ui.longTermMemory.reviewqueue.preflightReady")}
                </p>
                {preflight.blockers.map((blocker) => (
                  <p key={`${blocker.code}-${blocker.message}`}>
                    {humanizeLabel(blocker.code)}: {humanizeText(blocker.message)}
                  </p>
                ))}
                {preflight.conflicts.length ? (
                  <details data-ltm-review-conflicts>
                    <summary className="cursor-pointer font-medium">
                      {localizeUi(
                        selectLtmPluralForm(locale, preflight.conflicts.length) === "one"
                          ? "ui.longTermMemory.reviewqueue.conflictsFoundOne"
                          : "ui.longTermMemory.reviewqueue.conflictsFoundOther",
                        { count: preflight.conflicts.length },
                      )}
                    </summary>
                    <div className="mt-2 space-y-2">
                      {preflight.conflicts.slice(0, CONFLICT_PREVIEW_LIMIT).map((conflict, index) => (
                        <div key={`${conflict.field}-${index}`} className="space-y-1">
                          <p className="font-medium">{humanizeLabel(conflict.field)}</p>
                          <div>
                            <ConflictValue
                              label={localizeUi("ui.longTermMemory.reviewqueue.existingValue", { value: "{{value}}" })}
                              value={conflict.existing}
                            />
                          </div>
                          <div>
                            <ConflictValue
                              label={localizeUi("ui.longTermMemory.reviewqueue.proposedValue", { value: "{{value}}" })}
                              value={conflict.proposed}
                            />
                          </div>
                          <p>
                            {localizeUi("ui.longTermMemory.reviewqueue.conflictPolicy", { value: conflict.policy })}
                          </p>
                        </div>
                      ))}
                      {preflight.conflicts.length > CONFLICT_PREVIEW_LIMIT ? (
                        <details>
                          <summary className="cursor-pointer text-[var(--muted-foreground)]">
                            {localizeUi(
                              selectLtmPluralForm(locale, preflight.conflicts.length - CONFLICT_PREVIEW_LIMIT) === "one"
                                ? "ui.longTermMemory.reviewqueue.moreConflictsOne"
                                : "ui.longTermMemory.reviewqueue.moreConflictsOther",
                              {
                                count: preflight.conflicts.length - CONFLICT_PREVIEW_LIMIT,
                              },
                            )}
                          </summary>
                          <div className="mt-2 space-y-2">
                            {preflight.conflicts.slice(CONFLICT_PREVIEW_LIMIT).map((conflict, index) => (
                              <div key={`${conflict.field}-${index + CONFLICT_PREVIEW_LIMIT}`} className="space-y-1">
                                <p className="font-medium">{humanizeLabel(conflict.field)}</p>
                                <div>
                                  <ConflictValue
                                    label={localizeUi("ui.longTermMemory.reviewqueue.existingValue", {
                                      value: "{{value}}",
                                    })}
                                    value={conflict.existing}
                                  />
                                </div>
                                <div>
                                  <ConflictValue
                                    label={localizeUi("ui.longTermMemory.reviewqueue.proposedValue", {
                                      value: "{{value}}",
                                    })}
                                    value={conflict.proposed}
                                  />
                                </div>
                                <p>
                                  {localizeUi("ui.longTermMemory.reviewqueue.conflictPolicy", {
                                    value: conflict.policy,
                                  })}
                                </p>
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}
            {hideProjection ? (
              <p data-ltm-review-preview-stale role="status" className="text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.longTermMemory.reviewqueue.projectionPreviewIsStaleBecauseThisTargetHasEdited")}
              </p>
            ) : null}
            {targetType === "character" &&
            ((mutation.kind === "create_note" &&
              Object.prototype.hasOwnProperty.call(mutation.note.sections, "appearance")) ||
              ((mutation.kind === "append_section" || mutation.kind === "update_section") &&
                mutation.sectionKey === "appearance")) ? (
              <p className="text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.longTermMemory.reviewqueue.appearanceProposalHelp")}
              </p>
            ) : null}
            <p className="text-[var(--muted-foreground)]">
              {localizeUi(
                row.disposition === "new"
                  ? "ui.longTermMemory.reviewqueue.acceptCreatesSavedMemory"
                  : row.disposition === "merge"
                    ? "ui.longTermMemory.reviewqueue.acceptAddsToSavedMemory"
                    : "ui.longTermMemory.reviewqueue.acceptReplacesSavedMemory",
              )}
            </p>
            <MutationEditor
              mutation={mutation}
              canEditTitle={canEditTitle}
              onChange={(next) => updateMutation(row.mutation, next)}
              onBlur={() => queueMicrotask(() => flushReviewStateRef.current())}
            />
            {mutationHasOverlongText(mutation) ? (
              <p role="alert" className="text-xs text-[var(--destructive)]">
                {localizeUi("ui.longTermMemory.reviewqueue.textExceedsLimit", {
                  limit: mutation.kind === "append_section" ? MAX_APPEND_TEXT_LENGTH : MAX_SECTION_TEXT_LENGTH,
                })}
              </p>
            ) : !valid ? (
              <p role="alert" className="text-xs text-[var(--destructive)]">
                {localizeUi("ui.longTermMemory.reviewqueue.sectionTextCannotBeEmpty")}
              </p>
            ) : null}
          </div>
        ) : null}
      </article>
    );
  };

  const reviewQueueEmpty =
    !review.isLoading &&
    !review.isError &&
    !rejectedSuggestions.isLoading &&
    !rejectedSuggestions.isError &&
    !review.data?.sources.length &&
    !rejectedSuggestions.data?.suggestions.length;
  const workspaceUnavailable = reviewQueueEmpty || reviewContextBusy || reviewContextFailed;
  const reviewDataUnavailable =
    review.isLoading || review.isError || rejectedSuggestions.isLoading || rejectedSuggestions.isError;

  return (
    <section
      ref={reviewRef}
      data-ltm-surface="review-queue"
      aria-label={localizeUi("ui.longTermMemory.reviewqueue.reviewQueue")}
      className="space-y-4"
    >
      {extractionMessage ? <StatusSurface tone={extractionMessage.tone}>{extractionMessage.text}</StatusSurface> : null}
      {reviewStateMessage ? (
        <StatusSurface tone="warning" data-ltm-review-state-warning>
          {reviewStateMessage}
        </StatusSurface>
      ) : null}
      {review.isLoading ? (
        <StatusSurface busy>{localizeUi("ui.longTermMemory.reviewqueue.loadingPendingReviewDrafts")}</StatusSurface>
      ) : null}
      {review.isError ? (
        <StatusSurface tone="danger">
          {review.error instanceof Error
            ? review.error.message
            : localizeUi("ui.longTermMemory.reviewqueue.pendingReviewDraftsCouldNotLoad")}{" "}
          <Button className="shrink-0" disabled={review.isFetching} onClick={() => void review.refetch()}>
            {localizeUi("ui.longTermMemory.activityview.retry")}
          </Button>
        </StatusSurface>
      ) : null}
      {result ? (
        <StatusSurface
          tone={
            result.failed || result.blockedMutationIds.length || result.indexRebuildFailures.length
              ? "danger"
              : "success"
          }
        >
          {result.phase === "preflight"
            ? localizeUi("ui.longTermMemory.reviewqueue.preflightSummary", {
                ready: result.ready,
                blocked: result.blockedMutationIds.length,
              })
            : localizeUi("ui.longTermMemory.reviewqueue.batchResultSummary", {
                action:
                  result.action === "accepted"
                    ? localizeUi("ui.longTermMemory.reviewqueue.applied")
                    : localizeUi("ui.longTermMemory.reviewqueue.skipped"),
                completed: result.completed,
                mutation:
                  result.completed === 1
                    ? localizeUi("ui.longTermMemory.reviewqueue.mutation")
                    : localizeUi("ui.longTermMemory.reviewqueue.mutations"),
                failed: result.failed,
              })}
          {result.blockedMutationIds.length
            ? localizeUi("ui.longTermMemory.reviewqueue.blockedMutations", {
                count: result.blockedMutationIds.length,
              })
            : ""}
          {result.remaining
            ? localizeUi("ui.longTermMemory.reviewqueue.otherMutationsPending", {
                count: result.remaining,
                mutation:
                  result.remaining === 1
                    ? localizeUi("ui.longTermMemory.reviewqueue.mutation")
                    : localizeUi("ui.longTermMemory.reviewqueue.mutations"),
              })
            : ""}
          {result.autoIncluded
            ? localizeUi("ui.longTermMemory.reviewqueue.dependenciesIncludedAutomatically", {
                count: result.autoIncluded,
                dependency:
                  result.autoIncluded === 1
                    ? localizeUi("ui.longTermMemory.reviewqueue.dependency")
                    : localizeUi("ui.longTermMemory.reviewqueue.dependencies"),
              })
            : ""}
          {result.indexRebuildFailures.length
            ? localizeUi("ui.longTermMemory.reviewqueue.changesWereSavedButTheIndexRebuildFailedValue1", {
                value1: result.indexRebuildFailures.join(" "),
              })
            : ""}
          {result.messages.length
            ? localizeUi("ui.longTermMemory.reviewqueue.value1_5cb90a9", {
                value1: result.messages.join(" "),
              })
            : ""}
          {result.failedMutationIds.length ? (
            <Button disabled={running !== null} onClick={retryFailed}>
              {localizeUi("ui.longTermMemory.reviewqueue.retryFailed")}
            </Button>
          ) : null}
          {result.failedDraftIds.length ? (
            <Button disabled={running !== null} onClick={reviewFailed}>
              {localizeUi("ui.longTermMemory.reviewqueue.reviewFailed")}
            </Button>
          ) : null}
          {result.cascadeMutationLabels.length
            ? localizeUi("ui.longTermMemory.reviewqueue.cascadeSkippedMutations", {
                count: result.cascadeMutationLabels.length,
                mutation:
                  result.cascadeMutationLabels.length === 1
                    ? localizeUi("ui.longTermMemory.reviewqueue.mutation")
                    : localizeUi("ui.longTermMemory.reviewqueue.mutations"),
                labels: result.cascadeMutationLabels.join(", "),
              })
            : ""}
          {result.action === "accepted" && result.completed && onOpenVault ? (
            <Button
              onClick={() => {
                const noteId = result.savedMemoryIds.length === 1 ? result.savedMemoryIds[0] : undefined;
                if (noteId && onOpenMemory) onOpenMemory(noteId);
                else onOpenVault();
              }}
            >
              {localizeUi("ui.longTermMemory.reviewqueue.viewSavedMemories")}
            </Button>
          ) : null}
        </StatusSurface>
      ) : null}
      {deleteSuggestionError ? <StatusSurface tone="danger">{deleteSuggestionError}</StatusSurface> : null}
      {rejectedSuggestions.isLoading ? (
        <StatusSurface busy>{localizeUi("ui.longTermMemory.reviewqueue.loadingRejectedSuggestions")}</StatusSurface>
      ) : null}
      {reviewQueueEmpty ? (
        <StatusSurface>
          {localizeUi("ui.longTermMemory.reviewqueue.noProposedMemoriesNeedReviewYetImportASource")}
        </StatusSurface>
      ) : null}
      {rejectedSuggestions.isError ? (
        <StatusSurface tone="danger">
          {localizeUi("ui.longTermMemory.reviewqueue.rejectedSuggestionsCouldNotLoad")}{" "}
          <Button
            className="shrink-0"
            disabled={rejectedSuggestions.isFetching}
            onClick={() => void rejectedSuggestions.refetch()}
          >
            {localizeUi("ui.longTermMemory.activityview.retry")}
          </Button>
        </StatusSurface>
      ) : null}
      {reviewContextBusy ? (
        <StatusSurface busy>{localizeUi("ui.longTermMemory.reviewqueue.loadingMemoryContext")}</StatusSurface>
      ) : null}
      {reviewContextFailed ? (
        <StatusSurface tone="danger">
          {localizeUi("ui.longTermMemory.reviewqueue.memoryContextCouldNotLoad")}{" "}
          <Button className="shrink-0" disabled={notes.isFetching} onClick={() => void notes.refetch()}>
            {localizeUi("ui.longTermMemory.activityview.retry")}
          </Button>
        </StatusSurface>
      ) : null}
      <LtmWorkspace
        className={workspaceUnavailable || reviewDataUnavailable ? "hidden" : ""}
        activeMobilePane={mobilePane}
        onMobilePaneChange={setMobilePane}
        switcherLabel={localizeUi("ui.longTermMemory.longtermmemorynavigation.workspacePanes")}
        navigator={{
          label: localizeUi("ui.longTermMemory.reviewqueue.sourcesPane"),
          content: (
            <div data-ltm-review-navigator className="space-y-3">
              <header className="space-y-1 px-1">
                <h2 className="text-base font-semibold tracking-tight">
                  {localizeUi("ui.longTermMemory.reviewqueue.reviewQueue")}
                </h2>
                <ReviewProgress {...reviewProgress} />
              </header>
              <div className="mari-editor-panel overflow-hidden">
                {sourceIds.map((id) => {
                  const source = review.data?.sources.find((item) => item.sourceNoteId === id);
                  const rejectedCount =
                    rejectedSuggestions.data?.suggestions.filter((item) => item.source.sourceNoteId === id).length ?? 0;
                  const active = effectiveSourceId === id;
                  const expanded = active && !sourceCollapsed;
                  const panelId = `ltm-review-source-panel-${id}`;
                  return (
                    <div key={id} className="group">
                      <div
                        className={`flex min-h-12 items-stretch border-b border-[var(--border)] text-sm ${active ? "bg-[var(--accent)]/55" : ""}`}
                      >
                        <button
                          type="button"
                          data-ltm-review-source-select={id}
                          aria-current={active || undefined}
                          aria-expanded={expanded}
                          aria-controls={panelId}
                          onClick={() => {
                            setSelectedSourceId(id);
                            setSelectedDraftId(null);
                            setSourceCollapsed((current) => (active ? !current : false));
                            setMobilePaneAndFocus("workbench");
                          }}
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
                        >
                          <ChevronRight
                            aria-hidden="true"
                            size="0.875rem"
                            className={`shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
                          />
                          <span className="min-w-0 flex-1 truncate font-semibold">
                            {noteById.get(id)?.title || missingContextTitle}
                          </span>
                          <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                            {(source?.drafts.length ?? 0) + rejectedCount}
                          </span>
                        </button>
                        {rejectedCount ? (
                          <Button
                            data-ltm-review-rejected-count={rejectedCount}
                            className="!min-h-11 !min-w-11 shrink-0 rounded-full border border-[var(--marinara-editor-warning)]/40 px-2 py-0.5 text-[0.625rem] font-semibold text-[var(--marinara-editor-warning)] underline underline-offset-2"
                            style={{ minHeight: 44, minWidth: 44 }}
                            onClick={() => {
                              setSelectedSourceId(id);
                              setSelectedDraftId(null);
                              setSourceCollapsed(false);
                              setMobilePaneAndFocus("workbench");
                              requestAnimationFrame(() => {
                                const details = document.querySelector<HTMLDetailsElement>(
                                  `details[data-ltm-rejected-source="${CSS.escape(id)}"]`,
                                );
                                if (details) details.open = true;
                              });
                            }}
                          >
                            {localizeUi("ui.longTermMemory.reviewqueue.rejectedCount", { count: rejectedCount })}
                          </Button>
                        ) : null}
                      </div>
                      <div id={panelId} hidden={!expanded}>
                        {source?.drafts.map((item, index) => (
                          <button
                            key={item.draft.id}
                            type="button"
                            data-ltm-review-draft-select={item.draft.id}
                            aria-current={selectedDraft?.draft.id === item.draft.id || undefined}
                            onClick={() => {
                              setSelectedDraftId(item.draft.id);
                              setMobilePaneAndFocus("workbench");
                            }}
                            className={`flex min-h-14 w-full items-start gap-3 border-b border-[var(--border)]/70 px-8 py-3 text-left last:border-b-0 hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] ${selectedDraft?.draft.id === item.draft.id ? "bg-[var(--primary)]/10" : ""}`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2 text-xs font-semibold">
                                <span>
                                  {localizeUi("ui.longTermMemory.reviewqueue.draft")} {index + 1}
                                </span>
                                <span className="text-[var(--muted-foreground)]">{item.draft.mutations.length}</span>
                              </span>
                              <span className="mt-1 block truncate text-xs text-[var(--muted-foreground)]">
                                {reviewDraftTitle(item)}
                              </span>
                            </span>
                            <span
                              data-ltm-freshness={item.freshness}
                              className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold ${freshnessClass(item.freshness)}`}
                            >
                              {localizeUi(freshnessLabel[item.freshness])}
                            </span>
                          </button>
                        ))}
                        {source?.drafts.length || rejectedCount ? null : (
                          <p className="px-8 py-3 text-xs text-[var(--muted-foreground)]">
                            {localizeUi("ui.longTermMemory.reviewqueue.noProposedMemoriesAwaitReviewForSource")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ),
        }}
        workbench={{
          label: localizeUi("ui.longTermMemory.reviewqueue.reviewPane"),
          content: (
            <div data-ltm-review-workbench className="mari-editor-panel min-w-0 space-y-4 p-3 sm:p-4">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
                <div className="min-w-0">
                  <h2 data-ltm-review-draft-title className="truncate text-base font-semibold tracking-tight">
                    {localizeUi("ui.longTermMemory.reviewqueue.sourceNote", {
                      title: noteById.get(effectiveSourceId ?? "")?.title || missingContextTitle,
                    })}
                  </h2>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {selectedDraft
                      ? `${localizeUi("ui.longTermMemory.reviewqueue.draft")} ${Math.max(0, (selectedReviewSource?.drafts.findIndex((item) => item.draft.id === selectedDraft.draft.id) ?? 0) + 1)} - ${selectedDraft.draft.mutations.length} ${localizeUi("ui.longTermMemory.reviewqueue.mutations")}`
                      : localizeUi("ui.longTermMemory.reviewqueue.noProposedMemoriesAwaitReviewForSource")}
                  </p>
                  {selectedReviewSource ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {localizeUi("ui.longTermMemory.reviewqueue.modes")}{" "}
                      {selectedReviewSource.modes
                        .map((mode) => localizedLabel(mode, localizeUi, labelKeys.mode))
                        .join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedDraft && hasExtractionDetails(selectedDraft) ? (
                    <Button
                      aria-pressed={detailsOpen}
                      data-ltm-details-toggle
                      onClick={() => {
                        const next = !detailsOpen;
                        setDetailsOpen(next);
                        setMobilePaneAndFocus(next ? "inspector" : "workbench");
                      }}
                      className="aria-pressed:bg-[var(--accent)]"
                    >
                      {localizeUi("ui.longTermMemory.reviewqueue.details")}
                    </Button>
                  ) : null}
                  {onOpenMemory && effectiveSourceId ? (
                    <Button onClick={() => onOpenMemory(effectiveSourceId)}>
                      {localizeUi("ui.longTermMemory.reviewqueue.openSource")}
                    </Button>
                  ) : null}
                  {effectiveSourceId && selectedSourceIsExtractable && needsSourceReextraction ? (
                    <Button disabled={extractingSourceId !== null} onClick={() => void reextractSource()}>
                      {extractingSourceId === effectiveSourceId ? (
                        <Loader2
                          aria-hidden="true"
                          size="0.875rem"
                          className="animate-spin motion-reduce:animate-none"
                        />
                      ) : null}
                      {localizeUi("ui.longTermMemory.reviewqueue.reExtractSource")}
                    </Button>
                  ) : null}
                </div>
              </header>
              {sourceRejectedSuggestions.length ? (
                <details
                  data-ltm-rejected-suggestions
                  data-ltm-rejected-source={effectiveSourceId ?? undefined}
                  aria-label={localizeUi("ui.longTermMemory.reviewqueue.suggestionsThatWerentSaved")}
                  className="group rounded-lg border border-[var(--border)] bg-[var(--secondary)]/20"
                >
                  <summary className="flex min-h-14 cursor-pointer list-none items-start gap-2 rounded-lg p-3 hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]">
                    <ChevronRight
                      aria-hidden="true"
                      size="0.875rem"
                      className="mt-1 shrink-0 transition-transform group-open:rotate-90"
                    />
                    <span>
                      <span className="block text-sm font-semibold">
                        {localizeUi("ui.longTermMemory.reviewqueue.suggestionsThatWerentSaved")}
                      </span>
                      <span className="block text-xs text-[var(--muted-foreground)]">
                        {localizeUi("ui.longTermMemory.reviewqueue.rejectedSuggestionsRemainUntilAction")}
                      </span>
                    </span>
                  </summary>
                  {(effectiveSourceId ? [effectiveSourceId] : []).map((sourceNoteId) => {
                    const items = sourceRejectedSuggestions;
                    return (
                      <article
                        key={sourceNoteId}
                        data-ltm-rejected-source={sourceNoteId}
                        className="space-y-3 border-t border-[var(--border)] p-3"
                      >
                        {items.map((item) => (
                          <article
                            key={item.id}
                            data-ltm-rejected-suggestion={item.id}
                            className="space-y-3 rounded-md border border-[var(--border)] p-3"
                          >
                            <div>
                              <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                                {localizeUi("ui.longTermMemory.reviewqueue.proposedContent")}
                              </p>
                              <p className="mt-1 text-sm font-semibold leading-6">
                                {item.candidate.snippet || item.candidate.message}
                              </p>
                            </div>
                            <div className="space-y-1 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted-foreground)]">
                              <p>
                                <span className="font-medium text-[var(--foreground)]">
                                  {localizeUi("ui.longTermMemory.reviewqueue.whyItWasntSaved")}:
                                </span>{" "}
                                {localizeUi(
                                  rejectionReasonLabels[item.candidate.reason] ??
                                    "ui.longTermMemory.reviewqueue.rejectionReasonOther",
                                )}
                              </p>
                              <p>
                                <span className="font-medium text-[var(--foreground)]">
                                  {localizeUi("ui.longTermMemory.reviewqueue.whatWasExpected")}:
                                </span>{" "}
                                {item.candidate.recovery
                                  ? recoveryLabel(item.candidate.recovery, localizeUi, noteById, missingContextTitle)
                                  : localizeUi("ui.longTermMemory.reviewqueue.reviewAndCorrectSuggestion")}
                              </p>
                              <p>
                                <span className="font-medium text-[var(--foreground)]">
                                  {localizeUi("ui.longTermMemory.reviewqueue.recommendedFix")}:
                                </span>{" "}
                                {localizeUi(
                                  rejectionRecommendedLabels[item.candidate.reason] ??
                                    "ui.longTermMemory.reviewqueue.recommendedFixOther",
                                )}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {onRecoverCandidate ? (
                                <Button
                                  aria-label={localizeUi("ui.longTermMemory.reviewqueue.recoverSuggestionNamed", {
                                    value1: item.candidate.message,
                                  })}
                                  onClick={() => onRecoverCandidate(item.candidate, item.scope, item.modes, item.id)}
                                >
                                  {localizeUi("ui.longTermMemory.reviewqueue.recoverManually")}
                                </Button>
                              ) : null}
                              <Button
                                destructive
                                aria-label={localizeUi("ui.longTermMemory.reviewqueue.deleteSuggestionNamed", {
                                  value1: item.candidate.message,
                                })}
                                disabled={dismissingId !== null}
                                onClick={() => void deleteRejectedSuggestion(item)}
                              >
                                {localizeUi("ui.longTermMemory.reviewqueue.delete")}
                              </Button>
                            </div>
                          </article>
                        ))}
                      </article>
                    );
                  })}
                </details>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SelectionCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  label={localizeUi("ui.longTermMemory.reviewqueue.selectAll")}
                  onChange={() => {
                    clearPreflight();
                    return allSelected
                      ? setSelectedIds((current) => {
                          const next = new Set(current);
                          activeDraftRows.forEach((row) => next.delete(row.mutation.id));
                          return next;
                        })
                      : setSelectedIds(
                          (current) => new Set([...current, ...activeDraftRows.map((row) => row.mutation.id)]),
                        );
                  }}
                />
                <ReviewProgress {...reviewProgress} />
              </div>
              {selectedRows.length ? (
                <div
                  data-ltm-review-batch-actions
                  role="group"
                  aria-label={localizeUi("ui.longTermMemory.reviewqueue.batchActions")}
                  className="sticky bottom-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 shadow-md md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none"
                >
                  <Button
                    primary
                    disabled={
                      !eligibleSelectedRows.length ||
                      invalidSelectedEdits.length > 0 ||
                      preflightApplyDisabled ||
                      !reviewContextReady ||
                      running !== null
                    }
                    onClick={() => void runBatch("accept")}
                  >
                    {running === "accept"
                      ? localizeUi("ui.longTermMemory.reviewqueue.accepting")
                      : result?.phase === "preflight"
                        ? localizeUi("ui.longTermMemory.reviewqueue.applyPreflighted", {
                            count: result.ready,
                          })
                        : localizeUi("ui.longTermMemory.reviewqueue.acceptEligibleValue1", {
                            value1: eligibleSelectedRows.length,
                          })}
                  </Button>
                  <Button
                    destructive
                    disabled={!skippableSelectedRows.length || running !== null}
                    onClick={() => void runBatch("skip")}
                  >
                    {running === "skip"
                      ? localizeUi("ui.longTermMemory.reviewqueue.skipping")
                      : localizeUi("ui.longTermMemory.reviewqueue.skipSelectedValue1", {
                          value1: skippableSelectedRows.length,
                        })}
                  </Button>
                  <Button
                    disabled={running !== null}
                    onClick={() => {
                      clearPreflight();
                      setSelectedIds(new Set());
                    }}
                  >
                    {localizeUi("ui.longTermMemory.activityview.clear")}
                  </Button>
                </div>
              ) : null}
              {review.data?.sources
                .filter((source) => source.sourceNoteId === effectiveSourceId)
                .map((source) => {
                  return (
                    <article
                      key={source.sourceNoteId}
                      data-ltm-review-source={source.sourceNoteId}
                      className="space-y-3"
                    >
                      <div className="space-y-2">
                        {source.drafts
                          .filter((item) => item.draft.id === selectedDraft?.draft.id)
                          .map((item) => {
                            const projectedIds = new Set(
                              source.targets.flatMap((target) =>
                                target.rows
                                  .filter((row) => row.draftId === item.draft.id)
                                  .map((row) => row.mutation.id),
                              ),
                            );
                            const fallbackTargets = new Map<string, ReviewRow[]>();
                            for (const mutation of item.draft.mutations) {
                              if (projectedIds.has(mutation.id)) continue;
                              const row = rowByMutationId.get(mutation.id)!;
                              fallbackTargets.set(row.targetId, [...(fallbackTargets.get(row.targetId) ?? []), row]);
                            }
                            const diagnosticsOnly = item.draft.mutations.length === 0;
                            return (
                              <section
                                key={item.draft.id}
                                data-ltm-review-draft={item.draft.id}
                                className="mari-editor-panel space-y-3 p-3 sm:p-4"
                              >
                                {item.blockReasons.length ? (
                                  <div
                                    data-ltm-review-blocks
                                    className="mari-editor-panel mari-editor-panel--soft space-y-1 border-[var(--destructive)]/35 p-3 text-xs text-[var(--destructive)]"
                                  >
                                    {item.blockReasons.map((reason) => (
                                      <p key={reason.code}>
                                        {humanizeLabel(reason.code)}: {humanizeText(reason.message)}
                                      </p>
                                    ))}
                                  </div>
                                ) : null}
                                {diagnosticsOnly ? (
                                  <Button
                                    destructive
                                    disabled={dismissingId !== null || running !== null}
                                    onClick={() => void dismissReport(item.draft.id)}
                                  >
                                    {dismissingId === item.draft.id
                                      ? localizeUi("ui.longTermMemory.reviewqueue.dismissing")
                                      : localizeUi("ui.longTermMemory.reviewqueue.dismissReport")}
                                  </Button>
                                ) : null}
                                <div className="space-y-3 pt-1">
                                  {source.targets.map((target) => {
                                    const targetRows = target.rows.filter((row) => row.draftId === item.draft.id);
                                    if (!targetRows.length) return null;
                                    const projectionEdited = targetRows.some((row) => editedById.has(row.mutation.id));
                                    return (
                                      <div
                                        key={target.noteId}
                                        data-ltm-review-target={target.noteId}
                                        className="space-y-2"
                                      >
                                        {targetRows.map((projectedRow) =>
                                          renderRow(rowByMutationId.get(projectedRow.mutation.id)!, projectionEdited),
                                        )}
                                      </div>
                                    );
                                  })}
                                  {[...fallbackTargets].map(([targetId, targetRows]) => {
                                    return (
                                      <div
                                        key={`fallback-${targetId}`}
                                        data-ltm-review-target={targetId}
                                        data-ltm-unprojected-target
                                        className="space-y-2"
                                      >
                                        {targetRows.map((row) => renderRow(row))}
                                      </div>
                                    );
                                  })}
                                </div>
                              </section>
                            );
                          })}
                      </div>
                    </article>
                  );
                })}
              {effectiveSourceId && !selectedReviewSource ? (
                <StatusSurface>
                  {localizeUi("ui.longTermMemory.reviewqueue.noProposedMemoriesAwaitReviewForSource")}
                </StatusSurface>
              ) : null}
            </div>
          ),
        }}
        inspector={
          selectedDraft && detailsOpen
            ? {
                label: localizeUi("ui.longTermMemory.reviewqueue.details"),
                content: <ExtractionDetails item={selectedDraft} humanizeText={humanizeText} />,
              }
            : undefined
        }
      />
    </section>
  );
}
