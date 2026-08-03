import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, X } from "lucide-react";
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
  IconButton,
  InfoPopover,
  inputClass,
  StatusSurface,
} from "./shared-controls";
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
  cascadeMutationLabels: string[];
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

function freshnessClass(freshness: string) {
  if (freshness === "fresh")
    return "border-[var(--marinara-editor-accent)]/40 text-[var(--marinara-editor-accent)]";
  if (
    freshness === "stale" ||
    freshness === "missing" ||
    freshness === "invalid" ||
    freshness === "superseded" ||
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
  if (!mutation)
    return localizeUi("ui.longTermMemory.reviewqueue.dependentChange");
  if (mutation.summary.trim()) return `"${mutation.summary.trim()}"`;
  const target =
    mutation.kind === "create_note"
      ? mutation.note
      : noteById.get(mutationTarget(mutation));
  const title = target && "title" in target ? target.title : undefined;
  return `${humanizeLabel(mutation.kind)}${title ? ` "${title}"` : ""}`;
}

function draftDisplayTitle(
  item: LtmDraftReviewDraft,
  localizeUi: ReturnType<typeof useLtmTranslation>["t"],
) {
  const firstMutation = item.draft.mutations[0];
  if (firstMutation?.kind === "create_note") {
    return noteDisplayTitle(
      firstMutation.note,
      localizeUi("ui.longTermMemory.reviewqueue.untitledMemory"),
    );
  }
  return (
    item.draft.summary ||
    localizeUi("ui.longTermMemory.reviewqueue.noDraftSummary")
  );
}

function humanizeReviewText(
  text: string,
  noteById: ReadonlyMap<string, LtmNote>,
  replacementPattern: RegExp | undefined,
  replacements: ReadonlyMap<string, string>,
  sourcePrefix: string,
  sourceFallback: string,
) {
  let display = text.replace(
    /source_note:([A-Za-z0-9_-]+)/gu,
    (_, id: string) =>
      `${sourcePrefix} ${noteDisplayTitle(noteById.get(id), sourceFallback)}`,
  );
  return replacementPattern
    ? display.replace(replacementPattern, (id) => replacements.get(id) ?? id)
    : display;
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

function recoveryLabel(
  recovery: NonNullable<
    LtmDraftReviewDraft["candidateRejections"][number]["recovery"]
  >,
  localizeUi: ReturnType<typeof useLtmTranslation>["t"],
  noteById: ReadonlyMap<string, LtmNote>,
) {
  const hints = [
    recovery.noteType
      ? localizeUi("ui.longTermMemory.reviewqueue.recoveryMemoryType", {
          value: humanizeLabel(recovery.noteType),
        })
      : null,
    recovery.noteId
      ? localizeUi("ui.longTermMemory.reviewqueue.recoveryMemory", {
          value: noteDisplayTitle(
            noteById.get(recovery.noteId),
            localizeUi("ui.longTermMemory.reviewqueue.untitledMemory"),
          ),
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
  return (
    hints.join(", ") ||
    localizeUi("ui.longTermMemory.reviewqueue.reviewRejectedCandidate")
  );
}

function rejectedCandidateKey(
  candidate: LtmDraftReviewDraft["candidateRejections"][number],
) {
  const normalize = (value: string) => value.trim().replace(/\s+/gu, " ");
  return JSON.stringify({
    reason: candidate.reason,
    message: normalize(candidate.message),
    snippet: candidate.snippet ? normalize(candidate.snippet) : null,
    issues: candidate.issues?.map(normalize).sort() ?? [],
    recovery: {
      noteType: candidate.recovery?.noteType ?? null,
      noteId: candidate.recovery?.noteId ?? null,
      sectionKey: candidate.recovery?.sectionKey ?? null,
      status: candidate.recovery?.status ?? null,
    },
  });
}
const rejectionReasonLabels: Partial<Record<LtmExtractionDropReason, string>> =
  {
    invalid_format:
      "ui.longTermMemory.reviewqueue.rejectionReasonInvalidFormat",
    placeholder_output:
      "ui.longTermMemory.reviewqueue.rejectionReasonPlaceholderOutput",
    quote_not_found_in_source:
      "ui.longTermMemory.reviewqueue.rejectionReasonQuoteNotFound",
    missing_source_evidence:
      "ui.longTermMemory.reviewqueue.rejectionReasonMissingEvidence",
    source_summary_payload:
      "ui.longTermMemory.reviewqueue.rejectionReasonSourceSummary",
    unsupported_bucket:
      "ui.longTermMemory.reviewqueue.rejectionReasonUnsupportedBucket",
    target_note_outside_scope:
      "ui.longTermMemory.reviewqueue.rejectionReasonOutsideScope",
    ambiguous_subject:
      "ui.longTermMemory.reviewqueue.rejectionReasonAmbiguousSubject",
    untrusted_subject:
      "ui.longTermMemory.reviewqueue.rejectionReasonUntrustedSubject",
    invalid_subject_cardinality:
      "ui.longTermMemory.reviewqueue.rejectionReasonInvalidSubjectCardinality",
    too_long_to_keep_safely:
      "ui.longTermMemory.reviewqueue.rejectionReasonTooLong",
  };

const rejectionRecommendedLabels: Partial<
  Record<LtmExtractionDropReason, string>
> = {
  invalid_format: "ui.longTermMemory.reviewqueue.recommendedFixInvalidFormat",
  placeholder_output:
    "ui.longTermMemory.reviewqueue.recommendedFixPlaceholderOutput",
  quote_not_found_in_source:
    "ui.longTermMemory.reviewqueue.recommendedFixQuoteNotFound",
  missing_source_evidence:
    "ui.longTermMemory.reviewqueue.recommendedFixMissingEvidence",
  source_summary_payload:
    "ui.longTermMemory.reviewqueue.recommendedFixSourceSummary",
  unsupported_bucket:
    "ui.longTermMemory.reviewqueue.recommendedFixUnsupportedBucket",
  target_note_outside_scope:
    "ui.longTermMemory.reviewqueue.recommendedFixOutsideScope",
  ambiguous_subject:
    "ui.longTermMemory.reviewqueue.recommendedFixAmbiguousSubject",
  untrusted_subject:
    "ui.longTermMemory.reviewqueue.recommendedFixUntrustedSubject",
  invalid_subject_cardinality:
    "ui.longTermMemory.reviewqueue.recommendedFixInvalidSubjectCardinality",
  too_long_to_keep_safely:
    "ui.longTermMemory.reviewqueue.recommendedFixTooLong",
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
      <div data-ltm-mutation-editor className="space-y-3 pt-3">
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
        className="grid gap-2 pt-3 sm:grid-cols-[minmax(0,1fr)_10rem]"
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
        className="grid gap-2 pt-3 sm:grid-cols-[minmax(0,1fr)_10rem]"
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

const diagnosticCategoryKeys: Record<string, string> = {
  source_backed_npc_identity:
    "ui.longTermMemory.extractiondetails.normalizedCorrected",
  subject_identity_corrected:
    "ui.longTermMemory.extractiondetails.normalizedCorrected",
  subject_identity_normalized:
    "ui.longTermMemory.extractiondetails.normalizedCorrected",
  low_lexical_evidence: "ui.longTermMemory.extractiondetails.lowEvidence",
  missing_evidence: "ui.longTermMemory.extractiondetails.lowEvidence",
  missing_source_note_evidence:
    "ui.longTermMemory.extractiondetails.lowEvidence",
  resolved_thread_missing_fanout:
    "ui.longTermMemory.extractiondetails.resolvedThreadHandling",
  relationship_state_missing_caused_by:
    "ui.longTermMemory.extractiondetails.resolvedThreadHandling",
  ambiguous_subject_link_target:
    "ui.longTermMemory.extractiondetails.identityTargetHandling",
  unknown_link_target:
    "ui.longTermMemory.extractiondetails.identityTargetHandling",
  target_note_identity_variant:
    "ui.longTermMemory.extractiondetails.identityTargetHandling",
  target_note_scoped_variant:
    "ui.longTermMemory.extractiondetails.identityTargetHandling",
};

function hasExtractionDetails(item: LtmDraftReviewDraft) {
  return (
    Boolean(item.draft.accounting) ||
    item.diagnostics.some(
      (diagnostic) => diagnostic.code !== "deduplicated_evidence_unit",
    ) ||
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
  const diagnostics = item.diagnostics.filter(
    (diagnostic) => diagnostic.code !== "deduplicated_evidence_unit",
  );
  const diagnosticsByCategory = new Map<string, typeof diagnostics>();
  for (const diagnostic of diagnostics) {
    const category =
      diagnosticCategoryKeys[diagnostic.code] ??
      "ui.longTermMemory.extractiondetails.otherWarnings";
    diagnosticsByCategory.set(category, [
      ...(diagnosticsByCategory.get(category) ?? []),
      diagnostic,
    ]);
  }
  if (!hasExtractionDetails(item)) return null;

  return (
    <section
      data-ltm-extraction-details
      className="mari-editor-panel space-y-3 p-3 text-xs"
    >
      <header className="border-b border-[var(--border)] pb-3">
        <h2 className="font-semibold">
          {localizeUi("ui.longTermMemory.extractiondetails.extractionDetails")}
        </h2>
        {accounting ? (
          <p className="mt-1 text-[var(--muted-foreground)]">
            {localizeUi(
              "ui.longTermMemory.extractiondetails.value1KeptValue2RejectedValue3Deduplicated",
              {
                value1: accounting.keptUnits,
                value2:
                  accounting.parserRejections + accounting.validationRejections,
                value3: accounting.deduplications,
              },
            )}
          </p>
        ) : null}
      </header>
      <div className="space-y-3 text-[var(--muted-foreground)]">
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
        {item.deduplications.length ? (
          <details data-ltm-deduplications className="space-y-1">
            <summary className="cursor-pointer font-medium text-[var(--foreground)]">
              {localizeUi("ui.longTermMemory.extractiondetails.deduplications")}{" "}
              ( {item.deduplications.length} )
            </summary>
            <div className="mt-2 space-y-1">
              {item.deduplications.map((diagnostic, index) => (
                <p key={`${diagnostic.code}-${index}`}>
                  {humanizeText(diagnostic.message)}
                </p>
              ))}
            </div>
          </details>
        ) : null}
        {diagnostics.length ? (
          <details data-ltm-draft-diagnostics>
            <summary className="cursor-pointer font-medium text-[var(--foreground)]">
              {localizeUi(
                "ui.longTermMemory.extractiondetails.advancedExtractionDetails",
              )}
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
                        {humanizeLabel(diagnostic.code)}:{" "}
                        {humanizeText(diagnostic.message)}
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
  onOpenMemory,
  onRecoverCandidate,
  reviewSourceNoteId,
}: LongTermMemoryDestinationProps) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const queryClient = useQueryClient();
  const [selectedSourceId, setSelectedSourceId] = useState(
    reviewSourceNoteId ?? null,
  );
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<LtmWorkspacePane>("navigator");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sourceCollapsed, setSourceCollapsed] = useState(false);
  const [expandedMutationIds, setExpandedMutationIds] = useState<Set<string>>(
    new Set(),
  );
  const reviewRef = useRef<HTMLElement>(null);

  function setMobilePaneAndFocus(pane: LtmWorkspacePane) {
    setMobilePane(pane);
    requestAnimationFrame(() => {
      const workspace = reviewRef.current?.querySelector<HTMLElement>(
        "[data-ltm-workspace]",
      );
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
    queryKey: [...queryKeys.review, props.chatId],
    queryFn: () =>
      request<LtmDraftReviewResponse>(
        `/drafts/review?status=pending${props.chatId ? `&chatId=${encodeURIComponent(props.chatId)}` : ""}`,
      ),
  });
  const rejectedSuggestions = useQuery({
    queryKey: [...queryKeys.rejectedSuggestions, props.chatId],
    queryFn: () =>
      request<LtmRejectedSuggestionsResponse>(
        `/rejected-suggestions${props.chatId ? "?" : ""}${[
          props.chatId ? `chatId=${encodeURIComponent(props.chatId)}` : "",
        ]
          .filter(Boolean)
          .join("&")}`,
      ),
  });
  const notes = useQuery({
    queryKey: queryKeys.notes,
    queryFn: () => requestAllNotes<LtmNote>("/notes?includeGlobal=true"),
  });
  const noteById = new Map((notes.data ?? []).map((note) => [note.id, note]));
  const sourceIds = [
    ...new Set([
      ...(review.data?.sources ?? []).map((source) => source.sourceNoteId),
      ...(rejectedSuggestions.data?.suggestions ?? []).map(
        (suggestion) => suggestion.source.sourceNoteId,
      ),
      ...(selectedSourceId ? [selectedSourceId] : []),
    ]),
  ];
  const selectedSourceIsLive =
    review.data?.sources.some(
      (source) => source.sourceNoteId === selectedSourceId,
    ) ||
    rejectedSuggestions.data?.suggestions.some(
      (suggestion) => suggestion.source.sourceNoteId === selectedSourceId,
    ) ||
    false;
  useEffect(() => {
    if (
      !review.isSuccess ||
      !rejectedSuggestions.isSuccess ||
      !selectedSourceId ||
      selectedSourceIsLive
    ) {
      return;
    }
    setSelectedSourceId(null);
  }, [
    rejectedSuggestions.isSuccess,
    review.isSuccess,
    selectedSourceId,
    selectedSourceIsLive,
  ]);
  const effectiveSourceId =
    selectedSourceId && sourceIds.includes(selectedSourceId)
      ? selectedSourceId
      : (sourceIds[0] ?? null);
  const selectedReviewSource = review.data?.sources.find(
    (source) => source.sourceNoteId === effectiveSourceId,
  );
  const selectedDraft =
    selectedReviewSource?.drafts.find(
      (item) => item.draft.id === selectedDraftId,
    ) ?? selectedReviewSource?.drafts[0];
  const sourceRejectedSuggestions =
    rejectedSuggestions.data?.suggestions.filter(
      (item) => item.source.sourceNoteId === effectiveSourceId,
    ) ?? [];
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
    setDetailsOpen(false);
    setExpandedMutationIds(new Set());
  }, [props.chatId]);
  useEffect(() => {
    setSelectedIds(new Set());
    setSourceCollapsed(false);
    setSelectedDraftId(null);
    setDetailsOpen(false);
    setExpandedMutationIds(new Set());
  }, [effectiveSourceId]);
  useEffect(() => {
    setSelectedIds(new Set());
    setDetailsOpen(false);
    setExpandedMutationIds(new Set());
  }, [selectedDraft?.draft.id]);

  const { rowByMutationId, rows } = useMemo(() => {
    const rowByMutationId = new Map<string, ReviewRow>();
    for (const source of review.data?.sources ?? []) {
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
              targetTitle:
                mutation.kind === "create_note"
                  ? mutation.note.title
                  : undefined,
              targetType:
                mutation.kind === "create_note"
                  ? mutation.note.type
                  : undefined,
            });
          }
        }
      }
    }
    return { rowByMutationId, rows: [...rowByMutationId.values()] };
  }, [review.data]);
  const mutationDisplayLabels = useMemo(
    () =>
      new Map(
        rows.flatMap((row) => [
          [
            row.mutation.id,
            mutationDisplayLabel(row.mutation, noteById, localizeUi),
          ] as const,
          ...(row.mutation.kind === "create_note"
            ? [
                [
                  row.mutation.note.id,
                  row.mutation.note.title ||
                    localizeUi("ui.longTermMemory.reviewqueue.thisMemory"),
                ] as const,
              ]
            : []),
        ]),
      ),
    [localizeUi, notes.data, rows],
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
    const ids = [...replacements.keys()].sort(
      (left, right) => right.length - left.length,
    );
    return {
      replacements,
      pattern: ids.length
        ? new RegExp(
            ids
              .map((id) => id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
              .join("|"),
            "gu",
          )
        : undefined,
    };
  }, [localizeUi, mutationDisplayLabels, notes.data]);
  const humanizeText = (text: string) =>
    humanizeReviewText(
      text,
      noteById,
      replacementEntries.pattern,
      replacementEntries.replacements,
      localizeUi("ui.longTermMemory.reviewqueue.sourcePrefix"),
      localizeUi("ui.longTermMemory.reviewqueue.thisSource"),
    );
  const reviewDraftTitle = (item: LtmDraftReviewDraft) =>
    draftDisplayTitle(item, localizeUi);
  useEffect(
    () => onDirtyChange?.(editedById.size > 0),
    [editedById, onDirtyChange],
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
          Math.max(
            0,
            acceptedMutationIds(activeDraftRows, [row.mutation.id]).size - 1,
          ),
        ]),
      ),
    [activeDraftRows],
  );
  const selectedRows = activeDraftRows.filter((row) =>
    selectedIds.has(row.mutation.id),
  );
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
  const allSelected =
    activeDraftRows.length > 0 &&
    selectedRows.length === activeDraftRows.length;
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
              labels: invalidEditIds
                .map(
                  (id) =>
                    mutationDisplayLabels.get(id) ??
                    localizeUi("ui.longTermMemory.reviewqueue.editedChange"),
                )
                .join(", "),
            },
          ),
        ],
        cascadeMutationLabels: [],
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
    const cascadeMutationLabels = new Set<string>();
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
              if (!mutationIds.includes(id)) {
                cascadeMutationLabels.add(
                  mutationDisplayLabels.get(id) ??
                    localizeUi("ui.longTermMemory.reviewqueue.dependentChange"),
                );
              }
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
        cascadeMutationLabels: [...cascadeMutationLabels],
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
        cascadeMutationLabels: [],
      });
    } finally {
      setDismissingId(null);
    }
  };

  const deleteRejectedSuggestion = async (
    suggestion: LtmRejectedSuggestion,
  ) => {
    const title =
      noteById.get(suggestion.source.sourceNoteId)?.title ??
      localizeUi("ui.longTermMemory.reviewqueue.untitledMemory");
    const confirmed = props.confirmAction
      ? await props.confirmAction({
          title: localizeUi(
            "ui.longTermMemory.reviewqueue.deleteRejectedSuggestion",
          ),
          message: localizeUi(
            "ui.longTermMemory.reviewqueue.deleteRejectedSuggestionDescription",
            { title },
          ),
          confirmLabel: localizeUi("ui.longTermMemory.reviewqueue.delete"),
          tone: "destructive",
        })
      : window.confirm(
          localizeUi(
            "ui.longTermMemory.reviewqueue.deleteRejectedSuggestionDescription",
            { title },
          ),
        );
    if (!confirmed) return;
    setDismissingId(suggestion.id);
    setDeleteSuggestionError("");
    try {
      await request(
        `/rejected-suggestions/${encodeURIComponent(suggestion.id)}`,
        "DELETE",
      );
      await invalidateLtmQueries(queryClient, [queryKeys.rejectedSuggestions]);
    } catch (error) {
      setDeleteSuggestionError(
        error instanceof Error
          ? error.message
          : localizeUi("ui.longTermMemory.reviewqueue.requestFailed"),
      );
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
    const expanded = expandedMutationIds.has(row.mutation.id);
    const dependencyCount = dependencyCounts.get(row.mutation.id) ?? 0;
    const mutationLabel = localizeUi(mutationLabels[mutation.kind]);
    const dispositionLabel = localizeUi(dispositionLabels[row.disposition]);
    const targetNote =
      mutation.kind === "create_note"
        ? mutation.note
        : noteById.get(row.targetId);
    const targetTitle = noteDisplayTitle(
      targetNote,
      row.targetTitle ??
        localizeUi("ui.longTermMemory.reviewqueue.untitledMemory"),
    );
    const targetBody = noteBody(targetNote);
    const targetType =
      noteById.get(row.targetId)?.type ??
      row.targetType ??
      (mutation.kind === "create_note" ? mutation.note.type : undefined);
    const importance =
      mutation.kind === "create_note"
        ? importanceOptions.find((value) =>
            Object.values(mutation.note.sections).some(
              (section) => section.importance === value,
            ),
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
            })}: ${targetTitle}`}
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
            aria-controls={
              expanded
                ? `ltm-review-mutation-details-${row.mutation.id}`
                : undefined
            }
            className="relative min-w-0 flex-1 rounded-md px-2 py-1 pr-8 text-left hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-editor-focus-ring)]"
            data-ltm-risk={row.mutation.risk}
            data-ltm-disposition={row.disposition}
          >
            <span className="block text-sm font-semibold">{targetTitle}</span>
            {targetBody ? (
              <span className="mt-1 block truncate text-xs text-[var(--muted-foreground)]">
                {targetBody}
              </span>
            ) : null}
            <span className="mt-1 flex flex-wrap gap-1 text-[0.6875rem]">
              {targetType ? (
                <span
                  data-ltm-review-type={targetType}
                  className="rounded-full bg-[var(--secondary)] px-1.5 py-0.5"
                >
                  {humanizeLabel(targetType)}
                </span>
              ) : null}
              <span
                data-ltm-review-disposition={row.disposition}
                className="rounded-full bg-[var(--secondary)] px-1.5 py-0.5"
              >
                {dispositionLabel}
              </span>
              {mutation.kind !== "create_note" ? (
                <span
                  data-ltm-review-operation={mutation.kind}
                  className="rounded-full bg-[var(--secondary)] px-1.5 py-0.5"
                >
                  {mutationLabel}
                </span>
              ) : null}
              {importance ? (
                <span
                  data-ltm-review-importance={importance}
                  className="rounded-full bg-[var(--secondary)] px-1.5 py-0.5"
                >
                  {humanizeLabel(importance)}
                </span>
              ) : null}
              <span className="rounded-full bg-[var(--secondary)] px-1.5 py-0.5">
                {humanizeLabel(row.mutation.risk)} /{" "}
                {Math.round(row.mutation.confidence * 100)}
                {localizeUi("ui.longTermMemory.reviewqueue.confidence")}
              </span>
              {dependencyCount ? (
                <span className="rounded-full bg-[var(--secondary)] px-1.5 py-0.5">
                  {localizeUi("ui.longTermMemory.reviewqueue.dependencyHint", {
                    count: dependencyCount,
                    dependency:
                      dependencyCount === 1
                        ? localizeUi("ui.longTermMemory.reviewqueue.dependency")
                        : localizeUi(
                            "ui.longTermMemory.reviewqueue.dependencies",
                          ),
                  })}
                </span>
              ) : null}
            </span>
            <ChevronRight
              aria-hidden="true"
              size="0.875rem"
              className={`absolute right-2 top-3 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </button>
          <div
            role="group"
            aria-label={localizeUi(
              "ui.longTermMemory.reviewqueue.mutationActions",
            )}
            className="flex shrink-0 gap-1 pt-1"
          >
            <IconButton
              icon={Check}
              label={`${localizeUi("ui.longTermMemory.reviewqueue.accept")} ${targetTitle} (${mutationLabel})`}
              iconSize="1rem"
              className="mari-editor-action--primary !h-11 !min-h-11 !w-11 !min-w-11"
              style={{ height: 44, minHeight: 44, width: 44, minWidth: 44 }}
              disabled={
                !eligibleIds.has(row.mutation.id) || !valid || running !== null
              }
              onClick={() => void runBatch("accept", [row])}
            />
            <IconButton
              icon={X}
              label={`${localizeUi("ui.longTermMemory.longtermmemorydetail.skip")} ${targetTitle} (${mutationLabel})`}
              iconSize="1rem"
              className="!h-11 !min-h-11 !w-11 !min-w-11"
              style={{ height: 44, minHeight: 44, width: 44, minWidth: 44 }}
              destructive
              disabled={running !== null}
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
                <div data-ltm-review-evidence className="space-y-1">
                  <span className="font-medium">
                    {localizeUi(
                      "ui.longTermMemory.reviewqueue.evidence_3ef3540",
                    )}
                  </span>
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
                          {humanizeLabel(change.kind)}{" "}
                          {humanizeLabel(change.key)}:
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
                    {humanizeLabel(diagnostic.code)}:{" "}
                    {humanizeText(diagnostic.message)}
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
          </div>
        ) : null}
      </article>
    );
  };

  return (
    <section
      ref={reviewRef}
      data-ltm-surface="review-queue"
      aria-label={localizeUi("ui.longTermMemory.reviewqueue.reviewQueue")}
      className="space-y-4"
    >
      {review.isLoading ? (
        <StatusSurface busy>
          {localizeUi(
            "ui.longTermMemory.reviewqueue.loadingPendingReviewDrafts",
          )}
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
          {result.cascadeMutationLabels.length
            ? localizeUi(
                "ui.longTermMemory.reviewqueue.cascadeSkippedMutations",
                {
                  count: result.cascadeMutationLabels.length,
                  mutation:
                    result.cascadeMutationLabels.length === 1
                      ? localizeUi("ui.longTermMemory.reviewqueue.mutation")
                      : localizeUi("ui.longTermMemory.reviewqueue.mutations"),
                  labels: result.cascadeMutationLabels.join(", "),
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
          {localizeUi(
            "ui.longTermMemory.reviewqueue.loadingRejectedSuggestions",
          )}
        </StatusSurface>
      ) : null}
      {!review.isLoading &&
      !review.isError &&
      !rejectedSuggestions.isLoading &&
      !rejectedSuggestions.isError &&
      !review.data?.sources.length &&
      !rejectedSuggestions.data?.suggestions.length ? (
        <StatusSurface>
          {localizeUi(
            "ui.longTermMemory.reviewqueue.noProposedMemoriesNeedReviewYetImportASource",
          )}
        </StatusSurface>
      ) : null}
      {rejectedSuggestions.isError ? (
        <StatusSurface tone="danger">
          {localizeUi(
            "ui.longTermMemory.reviewqueue.rejectedSuggestionsCouldNotLoad",
          )}
        </StatusSurface>
      ) : null}
      <LtmWorkspace
        activeMobilePane={mobilePane}
        onMobilePaneChange={setMobilePane}
        switcherLabel={localizeUi(
          "ui.longTermMemory.longtermmemorynavigation.workspacePanes",
        )}
        navigator={{
          label: localizeUi("ui.longTermMemory.reviewqueue.reviewQueue"),
          content: (
            <div data-ltm-review-navigator className="space-y-3">
              <header className="space-y-1 px-1">
                <h2 className="text-base font-semibold tracking-tight">
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
              </header>
              <div className="mari-editor-panel overflow-hidden">
                {sourceIds.map((id) => {
                  const source = review.data?.sources.find(
                    (item) => item.sourceNoteId === id,
                  );
                  const rejectedCount =
                    rejectedSuggestions.data?.suggestions.filter(
                      (item) => item.source.sourceNoteId === id,
                    ).length ?? 0;
                  const active = effectiveSourceId === id;
                  const expanded = active && !sourceCollapsed;
                  const panelId = `ltm-review-source-panel-${id}`;
                  return (
                    <div key={id} className="group">
                      <button
                        type="button"
                        data-ltm-review-source-select={id}
                        aria-current={active || undefined}
                        aria-expanded={expanded}
                        aria-controls={panelId}
                        onClick={() => {
                          setSelectedSourceId(id);
                          setSelectedDraftId(null);
                          setSourceCollapsed((current) =>
                            active ? !current : false,
                          );
                          setMobilePaneAndFocus("workbench");
                        }}
                        className={`flex min-h-12 cursor-pointer list-none items-center gap-2 border-b border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] ${active ? "bg-[var(--accent)]/55" : ""}`}
                      >
                        <ChevronRight
                          aria-hidden="true"
                          size="0.875rem"
                          className={`shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
                        />
                        <span className="min-w-0 flex-1 truncate font-semibold">
                          {noteById.get(id)?.title ||
                            localizeUi(
                              "ui.longTermMemory.reviewqueue.untitledMemory",
                            )}
                        </span>
                        <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                          {(source?.drafts.length ?? 0) + rejectedCount}
                        </span>
                      </button>
                      <div id={panelId} hidden={!expanded}>
                        {source?.drafts.map((item, index) => (
                          <button
                            key={item.draft.id}
                            type="button"
                            data-ltm-review-draft-select={item.draft.id}
                            aria-current={
                              selectedDraft?.draft.id === item.draft.id ||
                              undefined
                            }
                            onClick={() => {
                              setSelectedDraftId(item.draft.id);
                              setMobilePaneAndFocus("workbench");
                            }}
                            className={`flex min-h-14 w-full items-start gap-3 border-b border-[var(--border)]/70 px-8 py-3 text-left last:border-b-0 hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] ${selectedDraft?.draft.id === item.draft.id ? "bg-[var(--primary)]/10" : ""}`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2 text-xs font-semibold">
                                <span>
                                  {localizeUi(
                                    "ui.longTermMemory.reviewqueue.draft",
                                  )}{" "}
                                  {index + 1}
                                </span>
                                <span className="text-[var(--muted-foreground)]">
                                  {item.draft.mutations.length}
                                </span>
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
                            {localizeUi(
                              "ui.longTermMemory.reviewqueue.noProposedMemoriesAwaitReviewForSource",
                            )}
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
          label: localizeUi("ui.longTermMemory.reviewqueue.reviewQueue"),
          content: (
            <div
              data-ltm-review-workbench
              className="mari-editor-panel min-w-0 space-y-4 p-3 sm:p-4"
            >
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
                <div className="min-w-0">
                  <h2
                    data-ltm-review-draft-title
                    className="truncate text-base font-semibold tracking-tight"
                  >
                    {noteById.get(effectiveSourceId ?? "")?.title ||
                      localizeUi(
                        "ui.longTermMemory.reviewqueue.untitledMemory",
                      )}
                  </h2>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {selectedDraft
                      ? `${localizeUi("ui.longTermMemory.reviewqueue.draft")} ${Math.max(0, (selectedReviewSource?.drafts.findIndex((item) => item.draft.id === selectedDraft.draft.id) ?? 0) + 1)} - ${selectedDraft.draft.mutations.length} ${localizeUi("ui.longTermMemory.reviewqueue.mutations")}`
                      : localizeUi(
                          "ui.longTermMemory.reviewqueue.noProposedMemoriesAwaitReviewForSource",
                        )}
                  </p>
                  {selectedReviewSource ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {localizeUi("ui.longTermMemory.reviewqueue.modes")}{" "}
                      {selectedReviewSource.modes.map(humanizeLabel).join(", ")}
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
                </div>
              </header>
              {sourceRejectedSuggestions.length ? (
                <details
                  data-ltm-rejected-suggestions
                  aria-label={localizeUi(
                    "ui.longTermMemory.reviewqueue.suggestionsThatWerentSaved",
                  )}
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
                        {localizeUi(
                          "ui.longTermMemory.reviewqueue.suggestionsThatWerentSaved",
                        )}
                      </span>
                      <span className="block text-xs text-[var(--muted-foreground)]">
                        {localizeUi(
                          "ui.longTermMemory.reviewqueue.rejectedSuggestionsRemainUntilAction",
                        )}
                      </span>
                    </span>
                  </summary>
                  {(effectiveSourceId ? [effectiveSourceId] : []).map(
                    (sourceNoteId) => {
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
                                  {localizeUi(
                                    "ui.longTermMemory.reviewqueue.proposedContent",
                                  )}
                                </p>
                                <p className="mt-1 text-sm font-semibold leading-6">
                                  {item.candidate.snippet ||
                                    item.candidate.message}
                                </p>
                              </div>
                              <div className="space-y-1 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted-foreground)]">
                                <p>
                                  <span className="font-medium text-[var(--foreground)]">
                                    {localizeUi(
                                      "ui.longTermMemory.reviewqueue.whyItWasntSaved",
                                    )}
                                    :
                                  </span>{" "}
                                  {localizeUi(
                                    rejectionReasonLabels[
                                      item.candidate.reason
                                    ] ??
                                      "ui.longTermMemory.reviewqueue.rejectionReasonOther",
                                  )}
                                </p>
                                <p>
                                  <span className="font-medium text-[var(--foreground)]">
                                    {localizeUi(
                                      "ui.longTermMemory.reviewqueue.whatWasExpected",
                                    )}
                                    :
                                  </span>{" "}
                                  {item.candidate.recovery
                                    ? recoveryLabel(
                                        item.candidate.recovery,
                                        localizeUi,
                                        noteById,
                                      )
                                    : localizeUi(
                                        "ui.longTermMemory.reviewqueue.reviewAndCorrectSuggestion",
                                      )}
                                </p>
                                <p>
                                  <span className="font-medium text-[var(--foreground)]">
                                    {localizeUi(
                                      "ui.longTermMemory.reviewqueue.recommendedFix",
                                    )}
                                    :
                                  </span>{" "}
                                  {localizeUi(
                                    rejectionRecommendedLabels[
                                      item.candidate.reason
                                    ] ??
                                      "ui.longTermMemory.reviewqueue.recommendedFixOther",
                                  )}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {onRecoverCandidate ? (
                                  <Button
                                    aria-label={localizeUi(
                                      "ui.longTermMemory.reviewqueue.recoverSuggestionNamed",
                                      { value1: item.candidate.message },
                                    )}
                                    onClick={() =>
                                      onRecoverCandidate(
                                        item.candidate,
                                        item.scope,
                                        item.modes,
                                        item.id,
                                      )
                                    }
                                  >
                                    {localizeUi(
                                      "ui.longTermMemory.reviewqueue.recoverManually",
                                    )}
                                  </Button>
                                ) : null}
                                <Button
                                  destructive
                                  aria-label={localizeUi(
                                    "ui.longTermMemory.reviewqueue.deleteSuggestionNamed",
                                    { value1: item.candidate.message },
                                  )}
                                  disabled={dismissingId !== null}
                                  onClick={() =>
                                    void deleteRejectedSuggestion(item)
                                  }
                                >
                                  {localizeUi(
                                    "ui.longTermMemory.reviewqueue.delete",
                                  )}
                                </Button>
                              </div>
                            </article>
                          ))}
                        </article>
                      );
                    },
                  )}
                </details>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SelectionCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  label={localizeUi("ui.longTermMemory.reviewqueue.selectAll")}
                  onChange={() =>
                    allSelected
                      ? setSelectedIds((current) => {
                          const next = new Set(current);
                          activeDraftRows.forEach((row) =>
                            next.delete(row.mutation.id),
                          );
                          return next;
                        })
                      : setSelectedIds(
                          (current) =>
                            new Set([
                              ...current,
                              ...activeDraftRows.map((row) => row.mutation.id),
                            ]),
                        )
                  }
                />
                <span className="text-xs text-[var(--muted-foreground)]">
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
                </span>
              </div>
              {selectedRows.length ? (
                <div
                  data-ltm-review-batch-actions
                  role="group"
                  aria-label={localizeUi(
                    "ui.longTermMemory.reviewqueue.batchActions",
                  )}
                  className="sticky bottom-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 shadow-md md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none"
                >
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
                  <Button
                    disabled={running !== null}
                    onClick={() => setSelectedIds(new Set())}
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
                          .filter(
                            (item) => item.draft.id === selectedDraft?.draft.id,
                          )
                          .map((item) => {
                            const projectedIds = new Set(
                              source.targets.flatMap((target) =>
                                target.rows
                                  .filter(
                                    (row) => row.draftId === item.draft.id,
                                  )
                                  .map((row) => row.mutation.id),
                              ),
                            );
                            const fallbackTargets = new Map<
                              string,
                              ReviewRow[]
                            >();
                            for (const mutation of item.draft.mutations) {
                              if (projectedIds.has(mutation.id)) continue;
                              const row = rowByMutationId.get(mutation.id)!;
                              fallbackTargets.set(row.targetId, [
                                ...(fallbackTargets.get(row.targetId) ?? []),
                                row,
                              ]);
                            }
                            const diagnosticsOnly =
                              item.draft.mutations.length === 0;
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
                                        {humanizeLabel(reason.code)}:{" "}
                                        {humanizeText(reason.message)}
                                      </p>
                                    ))}
                                  </div>
                                ) : null}
                                {diagnosticsOnly ? (
                                  <Button
                                    destructive
                                    disabled={
                                      dismissingId !== null || running !== null
                                    }
                                    onClick={() =>
                                      void dismissReport(item.draft.id)
                                    }
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
                                <div className="space-y-3 pt-1">
                                  {source.targets.map((target) => {
                                    const targetRows = target.rows.filter(
                                      (row) => row.draftId === item.draft.id,
                                    );
                                    if (!targetRows.length) return null;
                                    const projectionEdited = targetRows.some(
                                      (row) => editedById.has(row.mutation.id),
                                    );
                                    return (
                                      <div
                                        key={target.noteId}
                                        data-ltm-review-target={target.noteId}
                                        className="space-y-2"
                                      >
                                        {targetRows.map((projectedRow) =>
                                          renderRow(
                                            rowByMutationId.get(
                                              projectedRow.mutation.id,
                                            )!,
                                            projectionEdited,
                                          ),
                                        )}
                                      </div>
                                    );
                                  })}
                                  {[...fallbackTargets].map(
                                    ([targetId, targetRows]) => {
                                      return (
                                        <div
                                          key={`fallback-${targetId}`}
                                          data-ltm-review-target={targetId}
                                          data-ltm-unprojected-target
                                          className="space-y-2"
                                        >
                                          {targetRows.map((row) =>
                                            renderRow(row),
                                          )}
                                        </div>
                                      );
                                    },
                                  )}
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
                  {localizeUi(
                    "ui.longTermMemory.reviewqueue.noProposedMemoriesAwaitReviewForSource",
                  )}
                </StatusSurface>
              ) : null}
            </div>
          ),
        }}
        inspector={
          selectedDraft && detailsOpen
            ? {
                label: localizeUi("ui.longTermMemory.reviewqueue.details"),
                content: (
                  <ExtractionDetails
                    item={selectedDraft}
                    humanizeText={humanizeText}
                  />
                ),
              }
            : undefined
        }
      />
    </section>
  );
}
