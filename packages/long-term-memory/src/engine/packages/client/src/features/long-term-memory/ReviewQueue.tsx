import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  LtmDraftMutation,
  LtmDraftReviewDraft,
  LtmDraftReviewMutation,
  LtmDraftReviewResponse,
  LtmExtractionDropReason,
  LtmImportance,
  LtmNote,
  LtmRejectedSuggestion,
  LtmRejectedSuggestionsResponse,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  invalidateLtmQueries,
  queryKeys,
  request,
  requestAllNotes,
} from "./api";
import { humanizeLabel } from "./display-labels";
import {
  Button,
  InfoPopover,
  inputClass,
  StatusSurface,
} from "./shared-controls";
import type { LongTermMemoryDestinationProps } from "./types";
import { selectLtmPluralForm, useLtmTranslation } from "./localization";

type ReviewRow = {
  draftId: string;
  mutation: LtmDraftMutation;
  disposition: LtmDraftReviewMutation["disposition"] | "unavailable";
  diagnostics: LtmDraftReviewMutation["diagnostics"];
  changes: LtmDraftReviewMutation["changes"];
  targetId: string;
};

type ApplyDraftResponse = {
  appliedMutationIds: string[];
  skippedMutationIds: string[];
  autoIncludedMutationIds: string[];
  indexRebuild:
    | { status: "not_requested" | "succeeded" }
    | { status: "failed"; error: string };
};

type SkipDraftResponse = {
  mutationIds: string[];
};

type BatchResult = {
  action: "accepted" | "skipped";
  completed: number;
  failed: number;
  remaining: number;
  autoIncluded: number;
  indexRebuildFailures: string[];
  messages: string[];
  cascadeMutationIds: string[];
};

const importanceOptions: LtmImportance[] = [
  "critical",
  "major",
  "moderate",
  "minor",
];

const freshnessLabel: Record<string, string> = {
  fresh: "ui.longTermMemory.reviewqueue.fresh",
  hashless: "ui.longTermMemory.reviewqueue.contextUnbound",
  stale: "ui.longTermMemory.reviewqueue.stale",
  missing: "ui.longTermMemory.reviewqueue.sourceMissing",
  invalid: "ui.longTermMemory.reviewqueue.sourceInvalid",
  superseded: "ui.longTermMemory.reviewqueue.superseded",
  not_pending: "ui.longTermMemory.reviewqueue.notPending",
};

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

function groupByDraft(rows: readonly ReviewRow[]) {
  const grouped = new Map<string, ReviewRow[]>();
  for (const row of rows) {
    grouped.set(row.draftId, [...(grouped.get(row.draftId) ?? []), row]);
  }
  return grouped;
}

function acceptedMutationIds(
  draftRows: readonly ReviewRow[],
  selectedIds: readonly string[],
) {
  const selected = new Set(selectedIds);
  const rowsById = new Map(
    draftRows.map((row) => [row.mutation.id, row] as const),
  );
  const eventCreates = new Map(
    draftRows.flatMap((row) =>
      row.mutation.kind === "create_note" &&
      row.mutation.note.type === "timeline_event" &&
      row.disposition === "new"
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
    const selectedTargetIds = new Set(
      selectedRows.map((row) => mutationTarget(row.mutation)),
    );

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
  if (mutation.kind === "append_section") return Boolean(mutation.text.trim());
  if (mutation.kind === "update_section")
    return Boolean(mutation.section.text.trim());
  if (mutation.kind === "create_note")
    return Object.values(mutation.note.sections).every((section) =>
      Boolean(section.text.trim()),
    );
  return true;
}

function boundedTrim(value: string, max: number) {
  return value.trim().slice(0, max);
}

function formatTimestamp(timestamp: string, locale: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? timestamp
    : date.toLocaleDateString(locale);
}

function recoveryLabel(
  recovery: NonNullable<
    LtmDraftReviewDraft["candidateRejections"][number]["recovery"]
  >,
  localizeUi: ReturnType<typeof useLtmTranslation>["t"],
) {
  const hints = [
    recovery.noteType
      ? localizeUi("ui.longTermMemory.reviewqueue.recoveryMemoryType", { value: humanizeLabel(recovery.noteType) })
      : null,
    recovery.noteId
      ? localizeUi("ui.longTermMemory.reviewqueue.recoveryMemory", { value: recovery.noteId })
      : null,
    recovery.sectionKey
      ? localizeUi("ui.longTermMemory.reviewqueue.recoverySection", { value: humanizeLabel(recovery.sectionKey) })
      : null,
    recovery.status
      ? localizeUi("ui.longTermMemory.reviewqueue.recoveryStatus", { value: humanizeLabel(recovery.status) })
      : null,
  ].filter(Boolean);
  return (
    hints.join(", ") ||
    localizeUi("ui.longTermMemory.reviewqueue.reviewRejectedCandidate")
  );
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
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label className="flex min-h-11 items-center gap-2 text-xs font-medium text-[var(--foreground)]">
      <input
        ref={inputRef}
        type="checkbox"
        data-ltm-control="review-select"
        checked={checked}
        onChange={onChange}
        className="h-5 w-5 accent-[var(--primary)]"
      />
      <span>{label}</span>
    </label>
  );
}

function ImportanceField({
  value,
  onChange,
}: {
  value: LtmImportance | undefined;
  onChange: (value: LtmImportance | undefined) => void;
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
        onChange={(event) =>
          onChange(
            (event.target.value || undefined) as LtmImportance | undefined,
          )
        }
      >
        <option value="">
          {localizeUi("ui.longTermMemory.importancefield.notSpecified")}
        </option>
        {importanceOptions.map((importance) => (
          <option key={importance} value={importance}>
            {humanizeLabel(importance)}
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
}: {
  mutation: LtmDraftMutation;
  canEditTitle: boolean;
  onChange: (mutation: LtmDraftMutation) => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  if (mutation.kind === "create_note") {
    return (
      <div
        data-ltm-mutation-editor
        className="space-y-3 border-t border-[var(--border)] pt-3"
      >
        {canEditTitle ? (
          <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
            <span>
              {localizeUi("ui.longTermMemory.mutationeditor.memoryTitle")}
            </span>
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
              onBlur={(event) =>
                onChange({
                  ...mutation,
                  note: {
                    ...mutation.note,
                    title: boundedTrim(event.target.value, 240) || undefined,
                  },
                })
              }
            />
          </label>
        ) : null}
        {Object.entries(mutation.note.sections).map(([sectionKey, section]) => (
          <div
            key={sectionKey}
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]"
          >
            <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
              <span>{humanizeLabel(sectionKey)}</span>
              <textarea
                className={`${inputClass} min-h-24 py-2`}
                maxLength={20_000}
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
                          text: event.target.value.slice(0, 20_000),
                        },
                      },
                    },
                  })
                }
                onBlur={(event) =>
                  onChange({
                    ...mutation,
                    note: {
                      ...mutation.note,
                      sections: {
                        ...mutation.note.sections,
                        [sectionKey]: {
                          ...section,
                          text: boundedTrim(event.target.value, 20_000),
                        },
                      },
                    },
                  })
                }
              />
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
            />
          </div>
        ))}
      </div>
    );
  }

  if (mutation.kind === "append_section") {
    return (
      <div
        data-ltm-mutation-editor
        className="grid gap-2 border-t border-[var(--border)] pt-3 sm:grid-cols-[minmax(0,1fr)_10rem]"
      >
        <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
          <span>
            {humanizeLabel(mutation.sectionKey)}{" "}
            {localizeUi("ui.longTermMemory.mutationeditor.text")}
          </span>
          <textarea
            className={`${inputClass} min-h-24 py-2`}
            maxLength={20_000}
            value={mutation.text}
            onChange={(event) =>
              onChange({
                ...mutation,
                text: event.target.value.slice(0, 20_000),
              })
            }
            onBlur={(event) =>
              onChange({
                ...mutation,
                text: boundedTrim(event.target.value, 20_000),
              })
            }
          />
        </label>
        <ImportanceField
          value={mutation.importance}
          onChange={(importance) => onChange({ ...mutation, importance })}
        />
      </div>
    );
  }

  if (mutation.kind === "update_section") {
    return (
      <div
        data-ltm-mutation-editor
        className="grid gap-2 border-t border-[var(--border)] pt-3 sm:grid-cols-[minmax(0,1fr)_10rem]"
      >
        <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
          <span>
            {humanizeLabel(mutation.sectionKey)}{" "}
            {localizeUi("ui.longTermMemory.mutationeditor.text")}
          </span>
          <textarea
            className={`${inputClass} min-h-24 py-2`}
            maxLength={20_000}
            value={mutation.section.text}
            onChange={(event) =>
              onChange({
                ...mutation,
                section: {
                  ...mutation.section,
                  text: event.target.value.slice(0, 20_000),
                },
              })
            }
            onBlur={(event) =>
              onChange({
                ...mutation,
                section: {
                  ...mutation.section,
                  text: boundedTrim(event.target.value, 20_000),
                },
              })
            }
          />
        </label>
        <ImportanceField
          value={mutation.section.importance}
          onChange={(importance) =>
            onChange({
              ...mutation,
              section: { ...mutation.section, importance },
            })
          }
        />
      </div>
    );
  }

  return null;
}

function ExtractionDetails({
  item,
  onRecoverCandidate,
}: {
  item: LtmDraftReviewDraft;
  onRecoverCandidate?: (
    candidate: LtmDraftReviewDraft["candidateRejections"][number],
  ) => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const accounting = item.draft.accounting;
  const hasDetails =
    Boolean(accounting) ||
    item.diagnostics.length > 0 ||
    item.candidateRejections.length > 0 ||
    item.deduplications.length > 0;
  if (!hasDetails) return null;

  return (
    <details
      data-ltm-extraction-details
      className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-xs"
    >
      <summary className="cursor-pointer font-medium">
        {localizeUi("ui.longTermMemory.extractiondetails.extractionDetails")}
        {accounting
          ? localizeUi(
              "ui.longTermMemory.extractiondetails.value1KeptValue2RejectedValue3Deduplicated",
              {
                value1: accounting.keptUnits,
                value2:
                  accounting.parserRejections + accounting.validationRejections,
                value3: accounting.deduplications,
              },
            )
          : ""}
      </summary>
      <div className="mt-3 space-y-3 text-[var(--muted-foreground)]">
        {accounting ? (
          <p data-ltm-extraction-accounting>
            {accounting.providerCandidates}{" "}
            {localizeUi(
              "ui.longTermMemory.extractiondetails.providerCandidates",
            )}{" "}
            {accounting.normalizedAdditions}{" "}
            {localizeUi(
              "ui.longTermMemory.extractiondetails.normalizedAdditions",
            )}{" "}
            {accounting.keptUnits}{" "}
            {localizeUi("ui.longTermMemory.extractiondetails.kept")}{" "}
            {accounting.parserRejections}{" "}
            {localizeUi("ui.longTermMemory.extractiondetails.parserRejected")}{" "}
            {accounting.validationRejections}{" "}
            {localizeUi(
              "ui.longTermMemory.extractiondetails.validationRejectedAnd",
            )}{" "}
            {accounting.deduplications}{" "}
            {localizeUi("ui.longTermMemory.extractiondetails.deduplicated")}
          </p>
        ) : null}
        {item.diagnostics.length ? (
          <div data-ltm-draft-diagnostics className="space-y-1">
            <p className="font-medium text-[var(--foreground)]">
              {localizeUi("ui.longTermMemory.extractiondetails.diagnostics")}
            </p>
            {item.diagnostics.map((diagnostic, index) => (
              <p key={`${diagnostic.code}-${index}`}>
                {humanizeLabel(diagnostic.code)}: {diagnostic.message}
              </p>
            ))}
          </div>
        ) : null}
        {item.candidateRejections.length ? (
          <div data-ltm-candidate-rejections className="space-y-2">
            <p className="font-medium text-[var(--foreground)]">
              {localizeUi(
                "ui.longTermMemory.extractiondetails.candidateRejections",
              )}
            </p>
            {item.candidateRejections.map((rejection) => (
              <div
                key={`${rejection.index}-${rejection.reason}`}
                className="space-y-1"
              >
                <p>
                  {humanizeLabel(rejection.reason)}: {rejection.message}
                </p>
                {rejection.snippet ? (
                  <p>
                    {localizeUi("ui.longTermMemory.extractiondetails.snippet")}{" "}
                    {rejection.snippet}
                  </p>
                ) : null}
                {rejection.issues?.map((issue) => (
                  <p key={issue}>
                    {localizeUi("ui.longTermMemory.extractiondetails.issue")}{" "}
                    {issue}
                  </p>
                ))}
                {rejection.recovery ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p>
                      {localizeUi(
                        "ui.longTermMemory.extractiondetails.recovery",
                      )}{" "}
                      {recoveryLabel(rejection.recovery, localizeUi)}
                    </p>
                    {onRecoverCandidate ? (
                      <Button onClick={() => onRecoverCandidate(rejection)}>
                        {localizeUi(
                          "ui.longTermMemory.extractiondetails.recoverAsMemory",
                        )}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {item.deduplications.length ? (
          <div data-ltm-deduplications className="space-y-1">
            <p className="font-medium text-[var(--foreground)]">
              {localizeUi("ui.longTermMemory.extractiondetails.deduplications")}
            </p>
            {item.deduplications.map((diagnostic, index) => (
              <p key={`${diagnostic.code}-${index}`}>{diagnostic.message}</p>
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}

export default function ReviewQueue({
  props,
  onDirtyChange,
  onOpenMemory,
  onRecoverCandidate,
  reviewSourceNoteId,
}: LongTermMemoryDestinationProps) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const queryClient = useQueryClient();
  const [sourceNoteId, setSourceNoteId] = useState(reviewSourceNoteId ?? null);
  useEffect(
    () => setSourceNoteId(reviewSourceNoteId ?? null),
    [reviewSourceNoteId],
  );
  const review = useQuery({
    queryKey: [...queryKeys.review, props.chatId, sourceNoteId],
    queryFn: () =>
      request<LtmDraftReviewResponse>(
        `/drafts/review?status=pending${props.chatId ? `&chatId=${encodeURIComponent(props.chatId)}` : ""}${sourceNoteId ? `&sourceNoteId=${encodeURIComponent(sourceNoteId)}` : ""}`,
      ),
  });
  const rejectedSuggestions = useQuery({
    queryKey: [...queryKeys.rejectedSuggestions, props.chatId, sourceNoteId],
    queryFn: () =>
      request<LtmRejectedSuggestionsResponse>(
        `/rejected-suggestions${props.chatId || sourceNoteId ? "?" : ""}${[
          props.chatId ? `chatId=${encodeURIComponent(props.chatId)}` : "",
          sourceNoteId ? `sourceNoteId=${encodeURIComponent(sourceNoteId)}` : "",
        ].filter(Boolean).join("&")}`,
      ),
  });
  const notes = useQuery({
    queryKey: queryKeys.notes,
    queryFn: () => requestAllNotes<LtmNote>("/notes?includeGlobal=true"),
  });
  const noteById = new Map((notes.data ?? []).map((note) => [note.id, note]));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editedById, setEditedById] = useState<Map<string, LtmDraftMutation>>(
    new Map(),
  );
  const [running, setRunning] = useState<"accept" | "skip" | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [deleteSuggestionError, setDeleteSuggestionError] = useState("");
  useEffect(() => {
    setSelectedIds(new Set());
    setEditedById(new Map());
    setResult(null);
  }, [props.chatId]);

  const rowByMutationId = new Map<string, ReviewRow>();
  for (const source of review.data?.sources ?? []) {
    for (const target of source.targets) {
      for (const row of target.rows) {
        rowByMutationId.set(row.mutation.id, {
          ...row,
          targetId: target.noteId,
        });
      }
    }
    for (const item of source.drafts) {
      for (const mutation of item.draft.mutations) {
        if (!rowByMutationId.has(mutation.id)) {
          rowByMutationId.set(mutation.id, {
            draftId: item.draft.id,
            mutation,
            disposition: "unavailable",
            diagnostics: [],
            changes: [],
            targetId: mutationTarget(mutation),
          });
        }
      }
    }
  }
  const rows = [...rowByMutationId.values()];
  useEffect(
    () => onDirtyChange?.(editedById.size > 0),
    [editedById, onDirtyChange],
  );
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const selectedRows = rows.filter((row) => selectedIds.has(row.mutation.id));
  const eligibleIds = new Set<string>();
  for (const source of review.data?.sources ?? []) {
    for (const item of source.drafts) {
      if (item.freshness !== "fresh" || item.blockReasons.length) continue;
      for (const mutation of item.draft.mutations) eligibleIds.add(mutation.id);
    }
  }
  const eligibleSelectedRows = selectedRows.filter((row) =>
    eligibleIds.has(row.mutation.id),
  );
  const invalidSelectedEdits = eligibleSelectedRows.filter((row) => {
    const edited = editedById.get(row.mutation.id);
    return edited ? !selectedEditIsValid(edited) : false;
  });
  const allSelected = rows.length > 0 && selectedRows.length === rows.length;
  const someSelected = selectedRows.length > 0 && !allSelected;

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateMutation = (
    original: LtmDraftMutation,
    next: LtmDraftMutation,
  ) => {
    setEditedById((current) => {
      const updated = new Map(current);
      if (sameMutation(original, next)) updated.delete(original.id);
      else updated.set(original.id, next);
      return updated;
    });
  };

  const invalidClosureEditIds = (applicableRows: readonly ReviewRow[]) => {
    const invalidIds: string[] = [];
    for (const [draftId, selectedDraftRows] of groupByDraft(applicableRows)) {
      const draftRows = rows
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

  const runBatch = async (
    action: "accept" | "skip",
    explicitRows?: ReviewRow[],
  ) => {
    const applicableRows =
      explicitRows ??
      (action === "accept" ? eligibleSelectedRows : selectedRows);
    if (!applicableRows.length) return;
    const invalidEditIds =
      action === "accept" ? invalidClosureEditIds(applicableRows) : [];
    if (invalidEditIds.length) {
      setResult({
        action: "accepted",
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
              ids: invalidEditIds.join(", "),
            },
          ),
        ],
        cascadeMutationIds: [],
      });
      return;
    }
    setRunning(action);
    setResult(null);
    const completedIds = new Set<string>();
    const remainingIds = new Set<string>();
    const failedIds = new Set<string>();
    const autoIncludedIds = new Set<string>();
    const indexRebuildFailures: string[] = [];
    const messages: string[] = [];
    const cascadeMutationIds = new Set<string>();
    try {
      for (const [draftId, draftRows] of groupByDraft(applicableRows)) {
        const mutationIds = draftRows.map((row) => row.mutation.id);
        try {
          if (action === "accept") {
            const draftRows = rows
              .filter((row) => row.draftId === draftId)
              .map((row) => ({
                ...row,
                mutation: editedById.get(row.mutation.id) ?? row.mutation,
              }));
            const acceptedIds = acceptedMutationIds(draftRows, mutationIds);
            const editedMutations = [...editedById]
              .filter(([id]) => acceptedIds.has(id))
              .map(([, edited]) => edited);
            const response = await request<ApplyDraftResponse>(
              `/drafts/${draftId}/accept`,
              "POST",
              {
                mutationIds: [...acceptedIds],
                ...(editedMutations.length ? { editedMutations } : {}),
              },
            );
            const applied = new Set(response.appliedMutationIds);
            const skipped = new Set(response.skippedMutationIds);
            response.skippedMutationIds.forEach((id) => remainingIds.add(id));
            mutationIds.forEach((id) => {
              if (applied.has(id)) completedIds.add(id);
              else if (skipped.has(id)) return;
              else failedIds.add(id);
            });
            response.autoIncludedMutationIds.forEach((id) =>
              autoIncludedIds.add(id),
            );
            response.autoIncludedMutationIds.forEach((id) => {
              if (applied.has(id)) completedIds.add(id);
            });
            if (response.indexRebuild.status === "failed")
              indexRebuildFailures.push(response.indexRebuild.error);
          } else {
            const response = await request<SkipDraftResponse>(
              `/drafts/${draftId}/skip`,
              "POST",
              { mutationIds },
            );
            const deleted = new Set(response.mutationIds);
            response.mutationIds.forEach((id) => {
              completedIds.add(id);
              if (!mutationIds.includes(id)) cascadeMutationIds.add(id);
            });
            mutationIds.forEach((id) => {
              if (!deleted.has(id)) failedIds.add(id);
            });
          }
        } catch (error) {
          mutationIds.forEach((id) => failedIds.add(id));
          messages.push(
            localizeUi("ui.longTermMemory.reviewqueue.draftActionFailed", {
              message:
                error instanceof Error
                  ? error.message
                  : localizeUi("ui.longTermMemory.reviewqueue.requestFailed"),
            }),
          );
        }
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
      setResult({
        action: action === "accept" ? "accepted" : "skipped",
        completed: completedIds.size,
        failed: failedIds.size,
        remaining: remainingIds.size,
        autoIncluded: autoIncludedIds.size,
        indexRebuildFailures,
        messages,
        cascadeMutationIds: [...cascadeMutationIds],
      });
      if (completedIds.size) {
        await invalidateLtmQueries(queryClient, [
          queryKeys.review,
          queryKeys.pendingDrafts,
          queryKeys.scopeTargetsRoot,
          ...(action === "accept"
            ? [
                queryKeys.notes,
                queryKeys.status,
                queryKeys.integrity,
                queryKeys.preview,
              ]
            : []),
        ]);
      }
    } finally {
      setRunning(null);
    }
  };

  const dismissReport = async (draftId: string) => {
    setDismissingId(draftId);
    setResult(null);
    try {
      await request(`/drafts/${draftId}`, "DELETE");
      await invalidateLtmQueries(queryClient, [
        queryKeys.review,
        queryKeys.pendingDrafts,
      ]);
    } catch (error) {
      setResult({
        action: "skipped",
        completed: 0,
        failed: 1,
        remaining: 0,
        autoIncluded: 0,
        indexRebuildFailures: [],
        messages: [
          localizeUi("ui.longTermMemory.reviewqueue.reportDismissalFailed", {
            message:
              error instanceof Error
                ? error.message
                : localizeUi("ui.longTermMemory.reviewqueue.requestFailed"),
          }),
        ],
        cascadeMutationIds: [],
      });
    } finally {
      setDismissingId(null);
    }
  };

  const deleteRejectedSuggestion = async (suggestion: LtmRejectedSuggestion) => {
    const title = noteById.get(suggestion.source.sourceNoteId)?.title ?? suggestion.source.sourceNoteId;
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
      setDeleteSuggestionError(error instanceof Error ? error.message : localizeUi("ui.longTermMemory.reviewqueue.requestFailed"));
    } finally {
      setDismissingId(null);
    }
  };

  const renderRow = (row: ReviewRow, projectionStale = false) => {
    const mutation = editedById.get(row.mutation.id) ?? row.mutation;
    const targetExists = noteById.has(row.targetId);
    const canEditTitle =
      mutation.kind === "create_note" &&
      (row.disposition === "new" ||
        (targetExists && !noteById.get(row.targetId)?.title));
    const edited = editedById.has(row.mutation.id);
    const hideProjection = edited || projectionStale;
    const valid = selectedEditIsValid(mutation);
    const previewChanges = hideProjection ? [] : row.changes;
    return (
      <article
        key={row.mutation.id}
        data-ltm-review-mutation={row.mutation.id}
        className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SelectionCheckbox
            checked={selectedIds.has(row.mutation.id)}
            label={localizeUi("ui.longTermMemory.memoryvault.selectValue1", {
              value1: localizeUi(mutationLabels[row.mutation.kind]),
            })}
            onChange={() => toggleSelection(row.mutation.id)}
          />
          <p
            data-ltm-risk={row.mutation.risk}
            data-ltm-disposition={row.disposition}
            className="text-right text-xs font-semibold"
          >
            {localizeUi(mutationLabels[row.mutation.kind])} |{" "}
            {localizeUi(dispositionLabels[row.disposition])} |{" "}
            {humanizeLabel(row.mutation.risk)}{" "}
            {localizeUi("ui.longTermMemory.reviewqueue.risk")}{" "}
            {Math.round(row.mutation.confidence * 100)}
            {localizeUi("ui.longTermMemory.reviewqueue.confidence")}
          </p>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          {row.mutation.summary}
        </p>
        <details data-ltm-review-preview className="text-xs">
          <summary className="cursor-pointer font-medium">
            {localizeUi("ui.longTermMemory.reviewqueue.evidenceAndPreview")}{" "}
            {row.mutation.evidence.length}{" "}
            {localizeUi("ui.longTermMemory.reviewqueue.evidence")}
            {previewChanges.length
              ? localizeUi("ui.longTermMemory.reviewqueue.value1Changes", {
                  value1: previewChanges.length,
                })
              : ""}
          </summary>
          <div className="mt-2 space-y-2">
            <div data-ltm-review-evidence>
              <span className="font-medium">
                {localizeUi("ui.longTermMemory.reviewqueue.evidence_3ef3540")}
              </span>{" "}
              {row.mutation.evidence.join(" | ")}
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
            className="space-y-1 text-xs text-[var(--destructive)]"
          >
            {row.diagnostics.map((diagnostic, index) => (
              <p key={`${diagnostic.code}-${index}`}>
                {humanizeLabel(diagnostic.code)}: {diagnostic.message}
              </p>
            ))}
          </div>
        ) : null}
        {hideProjection ? (
          <p
            data-ltm-review-preview-stale
            role="status"
            className="text-xs text-[var(--muted-foreground)]"
          >
            {localizeUi(
              "ui.longTermMemory.reviewqueue.projectionPreviewIsStaleBecauseThisTargetHasEdited",
            )}
          </p>
        ) : null}
        <MutationEditor
          mutation={mutation}
          canEditTitle={canEditTitle}
          onChange={(next) => updateMutation(row.mutation, next)}
        />
        {!valid ? (
          <p role="alert" className="text-xs text-[var(--destructive)]">
            {localizeUi(
              "ui.longTermMemory.reviewqueue.sectionTextCannotBeEmpty",
            )}
          </p>
        ) : null}
        <div
          role="group"
          aria-label={localizeUi(
            "ui.longTermMemory.reviewqueue.mutationActions",
          )}
          className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-2"
        >
          <Button
            primary
            disabled={
              !eligibleIds.has(row.mutation.id) || !valid || running !== null
            }
            onClick={() => void runBatch("accept", [row])}
          >
            {localizeUi("ui.longTermMemory.reviewqueue.accept")}
          </Button>
          <Button
            destructive
            disabled={running !== null}
            onClick={() => void runBatch("skip", [row])}
          >
            {localizeUi("ui.longTermMemory.longtermmemorydetail.skip")}
          </Button>
        </div>
      </article>
    );
  };

  return (
    <section
      data-ltm-surface="review-queue"
      aria-label={localizeUi("ui.longTermMemory.reviewqueue.reviewQueue")}
      className="space-y-4"
    >
      {review.isLoading ? (
        <StatusSurface busy>
          {localizeUi("ui.longTermMemory.reviewqueue.loadingPendingReviewDrafts")}
        </StatusSurface>
      ) : null}
      {review.isError ? (
        <StatusSurface tone="danger">
          {review.error instanceof Error
            ? review.error.message
            : localizeUi(
                "ui.longTermMemory.reviewqueue.pendingReviewDraftsCouldNotLoad",
              )}
        </StatusSurface>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30 p-3">
        <div>
          <h2 className="text-sm font-semibold">
            {localizeUi("ui.longTermMemory.reviewqueue.reviewQueue")}
          </h2>
          <p
            data-ltm-review-summary
            className="text-xs text-[var(--muted-foreground)]"
          >
            {localizeUi("ui.longTermMemory.reviewqueue.reviewSummary", {
              sources: review.data?.counts.sources ?? 0,
              source:
                review.data?.counts.sources === 1
                  ? localizeUi("ui.longTermMemory.reviewqueue.source")
                  : localizeUi("ui.longTermMemory.reviewqueue.sources"),
              pending: review.data?.counts.mutations ?? 0,
              ready: eligibleIds.size,
              blocked: review.data?.counts.blockedDrafts ?? 0,
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SelectionCheckbox
            checked={allSelected}
            indeterminate={someSelected}
            label={localizeUi("ui.longTermMemory.reviewqueue.selectAll")}
            onChange={() =>
              allSelected
                ? setSelectedIds((current) => {
                    const next = new Set(current);
                    rows.forEach((row) => next.delete(row.mutation.id));
                    return next;
                  })
                : setSelectedIds(
                    (current) =>
                      new Set([
                        ...current,
                        ...rows.map((row) => row.mutation.id),
                      ]),
                  )
            }
          />
          {selectedRows.length ? (
            <div
              data-ltm-review-batch-actions
              role="group"
              aria-label={localizeUi(
                "ui.longTermMemory.reviewqueue.batchActions",
              )}
              className="flex flex-wrap items-center gap-2"
            >
              <Button
                disabled={running !== null}
                onClick={() => setSelectedIds(new Set())}
              >
                {localizeUi("ui.longTermMemory.activityview.clear")}
              </Button>
              <Button
                primary
                disabled={
                  !eligibleSelectedRows.length ||
                  invalidSelectedEdits.length > 0 ||
                  running !== null
                }
                onClick={() => void runBatch("accept")}
              >
                {running === "accept"
                  ? localizeUi("ui.longTermMemory.reviewqueue.accepting")
                  : localizeUi(
                      "ui.longTermMemory.reviewqueue.acceptEligibleValue1",
                      { value1: eligibleSelectedRows.length },
                    )}
              </Button>
              <Button
                destructive
                disabled={running !== null}
                onClick={() => void runBatch("skip")}
              >
                {running === "skip"
                  ? localizeUi("ui.longTermMemory.reviewqueue.skipping")
                  : localizeUi(
                      "ui.longTermMemory.reviewqueue.skipSelectedValue1",
                      { value1: selectedRows.length },
                    )}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      {sourceNoteId ? (
        <StatusSurface>
          {localizeUi("ui.longTermMemory.reviewqueue.filteredToThisSource")}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => setSourceNoteId(null)}
          >
            {localizeUi("ui.longTermMemory.reviewqueue.showAll")}
          </button>
        </StatusSurface>
      ) : null}
      {result ? (
        <StatusSurface
          tone={
            result.failed || result.indexRebuildFailures.length
              ? "danger"
              : "success"
          }
        >
          {localizeUi("ui.longTermMemory.reviewqueue.batchResultSummary", {
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
          {result.remaining
            ? localizeUi(
                "ui.longTermMemory.reviewqueue.otherMutationsPending",
                {
                  count: result.remaining,
                  mutation:
                    result.remaining === 1
                      ? localizeUi("ui.longTermMemory.reviewqueue.mutation")
                      : localizeUi("ui.longTermMemory.reviewqueue.mutations"),
                },
              )
            : ""}
          {result.autoIncluded
            ? localizeUi(
                "ui.longTermMemory.reviewqueue.dependenciesIncludedAutomatically",
                {
                  count: result.autoIncluded,
                  dependency:
                    result.autoIncluded === 1
                      ? localizeUi("ui.longTermMemory.reviewqueue.dependency")
                      : localizeUi(
                          "ui.longTermMemory.reviewqueue.dependencies",
                        ),
                },
              )
            : ""}
          {result.indexRebuildFailures.length
            ? localizeUi(
                "ui.longTermMemory.reviewqueue.changesWereSavedButTheIndexRebuildFailedValue1",
                { value1: result.indexRebuildFailures.join(" ") },
              )
            : ""}
          {result.messages.length
            ? localizeUi("ui.longTermMemory.reviewqueue.value1_5cb90a9", {
                value1: result.messages.join(" "),
              })
            : ""}
          {result.cascadeMutationIds.length
            ? localizeUi(
                "ui.longTermMemory.reviewqueue.cascadeSkippedMutations",
                {
                  count: result.cascadeMutationIds.length,
                  mutation:
                    result.cascadeMutationIds.length === 1
                      ? localizeUi("ui.longTermMemory.reviewqueue.mutation")
                      : localizeUi("ui.longTermMemory.reviewqueue.mutations"),
                  ids: result.cascadeMutationIds.join(", "),
                },
              )
            : ""}
        </StatusSurface>
      ) : null}
      {deleteSuggestionError ? (
        <StatusSurface tone="danger">{deleteSuggestionError}</StatusSurface>
      ) : null}
      {rejectedSuggestions.isLoading ? (
        <StatusSurface busy>
          {localizeUi("ui.longTermMemory.reviewqueue.loadingRejectedSuggestions")}
        </StatusSurface>
      ) : null}
      {!review.isLoading && !review.isError && !rejectedSuggestions.isLoading && !rejectedSuggestions.isError && !review.data?.sources.length && !rejectedSuggestions.data?.suggestions.length ? (
        <StatusSurface>
          {localizeUi(
            "ui.longTermMemory.reviewqueue.noProposedMemoriesNeedReviewYetImportASource",
          )}
        </StatusSurface>
      ) : null}
      {rejectedSuggestions.isError ? (
        <StatusSurface tone="danger">
          {localizeUi("ui.longTermMemory.reviewqueue.rejectedSuggestionsCouldNotLoad")}
        </StatusSurface>
      ) : null}
      {rejectedSuggestions.data?.suggestions.length ? (
        <section
          data-ltm-rejected-suggestions
          aria-label={localizeUi("ui.longTermMemory.reviewqueue.suggestionsThatWerentSaved")}
          className="space-y-3"
        >
          <header>
            <h2 className="text-sm font-semibold">
              {localizeUi("ui.longTermMemory.reviewqueue.suggestionsThatWerentSaved")}
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.longTermMemory.reviewqueue.rejectedSuggestionsRemainUntilAction")}
            </p>
          </header>
          {[...new Set(rejectedSuggestions.data.suggestions.map((item) => item.source.sourceNoteId))].map((sourceNoteId) => {
            const items = rejectedSuggestions.data!.suggestions.filter((item) => item.source.sourceNoteId === sourceNoteId);
            return (
              <article key={sourceNoteId} data-ltm-rejected-source={sourceNoteId} className="space-y-3 rounded-lg border border-[var(--border)] p-3">
                <h3 className="text-sm font-semibold">
                  {noteById.get(sourceNoteId)?.title || localizeUi("ui.longTermMemory.reviewqueue.untitledMemory")}
                </h3>
                {items.map((item) => (
                  <div key={item.id} data-ltm-rejected-suggestion={item.id} className="space-y-2 border-t border-[var(--border)] pt-3">
                    <p className="text-xs font-semibold">{localizeUi("ui.longTermMemory.reviewqueue.proposedContent")}</p>
                    <p className="text-sm">{item.candidate.snippet || item.candidate.message}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      <span className="font-medium">{localizeUi("ui.longTermMemory.reviewqueue.whyItWasntSaved")}:</span>{" "}
                      {localizeUi(
                        rejectionReasonLabels[item.candidate.reason] ??
                          "ui.longTermMemory.reviewqueue.rejectionReasonOther",
                      )}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      <span className="font-medium">{localizeUi("ui.longTermMemory.reviewqueue.whatWasExpected")}:</span>{" "}
                      {item.candidate.recovery ? recoveryLabel(item.candidate.recovery, localizeUi) : localizeUi("ui.longTermMemory.reviewqueue.reviewAndCorrectSuggestion")}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      <span className="font-medium">{localizeUi("ui.longTermMemory.reviewqueue.recommendedFix")}:</span>{" "}
                      {localizeUi(
                        rejectionRecommendedLabels[item.candidate.reason] ??
                          "ui.longTermMemory.reviewqueue.recommendedFixOther",
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {onRecoverCandidate ? (
                        <Button
                          aria-label={localizeUi("ui.longTermMemory.reviewqueue.recoverSuggestionNamed", { value1: item.candidate.message })}
                          onClick={() => onRecoverCandidate(item.candidate, item.scope, item.modes, item.id)}
                        >
                          {localizeUi("ui.longTermMemory.reviewqueue.recoverManually")}
                        </Button>
                      ) : null}
                      <Button
                        destructive
                        aria-label={localizeUi("ui.longTermMemory.reviewqueue.deleteSuggestionNamed", { value1: item.candidate.message })}
                        disabled={dismissingId !== null}
                        onClick={() => void deleteRejectedSuggestion(item)}
                      >
                        {localizeUi("ui.longTermMemory.reviewqueue.delete")}
                      </Button>
                    </div>
                  </div>
                ))}
              </article>
            );
          })}
        </section>
      ) : null}
      {review.data?.sources.map((source) => {
        const projectedIds = new Set(
          source.targets.flatMap((target) =>
            target.rows.map((row) => row.mutation.id),
          ),
        );
        const fallbackTargets = new Map<string, ReviewRow[]>();
        for (const item of source.drafts) {
          for (const mutation of item.draft.mutations) {
            if (projectedIds.has(mutation.id)) continue;
            const row = rowByMutationId.get(mutation.id)!;
            fallbackTargets.set(row.targetId, [
              ...(fallbackTargets.get(row.targetId) ?? []),
              row,
            ]);
          }
        }
        return (
          <article
            key={source.sourceNoteId}
            data-ltm-review-source={source.sourceNoteId}
            className="space-y-3 rounded-lg border border-[var(--border)] p-3"
          >
            <header className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">
                  {localizeUi("ui.longTermMemory.reviewqueue.source_922acd2")}{" "}
                  {noteById.get(source.sourceNoteId)?.title ||
                    localizeUi("ui.longTermMemory.reviewqueue.untitledMemory")}
                </h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {localizeUi("ui.longTermMemory.reviewqueue.modes")}{" "}
                  {source.modes.map(humanizeLabel).join(", ")}
                </p>
              </div>
              {onOpenMemory ? (
                <Button onClick={() => onOpenMemory(source.sourceNoteId)}>
                  {localizeUi("ui.longTermMemory.reviewqueue.openSource")}
                </Button>
              ) : null}
            </header>
            <div className="space-y-2">
              {source.drafts.map((item, index) => {
                const diagnosticsOnly = item.draft.mutations.length === 0;
                return (
                  <section
                    key={item.draft.id}
                    data-ltm-review-draft={item.draft.id}
                    className="space-y-2 border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-xs font-semibold">
                            {localizeUi("ui.longTermMemory.reviewqueue.draft")}{" "}
                            {index + 1}
                          </h4>
                          {diagnosticsOnly ? (
                            <span
                              data-ltm-diagnostics-only
                              className="rounded-full border border-[var(--border)] px-2 py-1 text-xs font-medium"
                            >
                              {localizeUi(
                                "ui.longTermMemory.reviewqueue.diagnosticsOnly",
                              )}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {localizeUi("ui.longTermMemory.memoryvault.created")}{" "}
                          {formatTimestamp(item.draft.createdAt, locale)}.{" "}
                          {item.draft.summary ||
                            localizeUi(
                              "ui.longTermMemory.reviewqueue.noDraftSummary",
                            )}
                        </p>
                      </div>
                      <span
                        data-ltm-freshness={item.freshness}
                        className="rounded-full border border-[var(--border)] px-2 py-1 text-xs font-medium"
                      >
                        {localizeUi(freshnessLabel[item.freshness])}
                      </span>
                    </div>
                    {item.blockReasons.length ? (
                      <div
                        data-ltm-review-blocks
                        className="space-y-1 text-xs text-[var(--destructive)]"
                      >
                        {item.blockReasons.map((reason) => (
                          <p key={reason.code}>
                            {humanizeLabel(reason.code)}: {reason.message}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    <ExtractionDetails
                      item={item}
                      onRecoverCandidate={
                        onRecoverCandidate
                          ? (candidate) =>
                              onRecoverCandidate(
                                candidate,
                                item.draft.scope,
                                item.draft.modes,
                              )
                          : undefined
                      }
                    />
                    {diagnosticsOnly ? (
                      <Button
                        destructive
                        disabled={dismissingId !== null || running !== null}
                        onClick={() => void dismissReport(item.draft.id)}
                      >
                        {dismissingId === item.draft.id
                          ? localizeUi(
                              "ui.longTermMemory.reviewqueue.dismissing",
                            )
                          : localizeUi(
                              "ui.longTermMemory.reviewqueue.dismissReport",
                            )}
                      </Button>
                    ) : null}
                  </section>
                );
              })}
            </div>
            <div className="space-y-3">
              {source.targets.map((target) => {
                const projectionEdited = target.rows.some((row) =>
                  editedById.has(row.mutation.id),
                );
                return (
                  <section
                    key={target.noteId}
                    data-ltm-review-target={target.noteId}
                    className="space-y-2"
                  >
                    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
                      <div>
                        <h4 className="text-sm font-semibold">
                          {noteById.get(target.noteId)?.title ||
                            (!projectionEdited ? target.title : null) ||
                            (projectionEdited
                              ? localizeUi(
                                  "ui.longTermMemory.reviewqueue.editedProjectionPending",
                                )
                              : localizeUi(
                                  "ui.longTermMemory.reviewqueue.untitledMemory",
                                ))}
                        </h4>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {humanizeLabel(target.noteType)}
                        </p>
                      </div>
                      {onOpenMemory && noteById.has(target.noteId) ? (
                        <Button onClick={() => onOpenMemory(target.noteId)}>
                          {localizeUi(
                            "ui.longTermMemory.reviewqueue.openMemory",
                          )}
                        </Button>
                      ) : null}
                    </header>
                    <div className="space-y-2">
                      {target.rows.map((projectedRow) =>
                        renderRow(
                          rowByMutationId.get(projectedRow.mutation.id)!,
                          projectionEdited,
                        ),
                      )}
                    </div>
                  </section>
                );
              })}
              {[...fallbackTargets].map(([targetId, targetRows]) => {
                const note = noteById.get(targetId);
                const created = targetRows.find(
                  (row) => row.mutation.kind === "create_note",
                )?.mutation;
                const title =
                  note?.title ||
                  (created?.kind === "create_note"
                    ? created.note.title
                    : undefined) ||
                  localizeUi("ui.longTermMemory.reviewqueue.unprojectedTarget");
                const type =
                  note?.type ||
                  (created?.kind === "create_note"
                    ? created.note.type
                    : undefined);
                return (
                  <section
                    key={`fallback-${targetId}`}
                    data-ltm-review-target={targetId}
                    data-ltm-unprojected-target
                    className="space-y-2"
                  >
                    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
                      <div>
                        <h4 className="text-sm font-semibold">{title}</h4>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {type
                            ? humanizeLabel(type)
                            : localizeUi(
                                "ui.longTermMemory.reviewqueue.previewUnavailable",
                              )}
                        </p>
                      </div>
                      {onOpenMemory && note ? (
                        <Button onClick={() => onOpenMemory(targetId)}>
                          {localizeUi(
                            "ui.longTermMemory.reviewqueue.openMemory",
                          )}
                        </Button>
                      ) : null}
                    </header>
                    <div className="space-y-2">
                      {targetRows.map((row) => renderRow(row))}
                    </div>
                  </section>
                );
              })}
            </div>
          </article>
        );
      })}
    </section>
  );
}
