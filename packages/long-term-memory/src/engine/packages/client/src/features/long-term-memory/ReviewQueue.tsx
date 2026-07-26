import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  LtmDraftMutation,
  LtmDraftReviewDraft,
  LtmDraftReviewMutation,
  LtmDraftReviewResponse,
  LtmImportance,
  LtmNote,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { invalidateLtmQueries, queryKeys, request } from "./api";
import { humanizeLabel } from "./display-labels";
import {
  Button,
  InfoPopover,
  inputClass,
  StatusSurface,
} from "./shared-controls";
import type { LongTermMemoryDestinationProps } from "./types";

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
  fresh: "Fresh",
  hashless: "Context unbound",
  stale: "Stale",
  missing: "Source missing",
  invalid: "Source invalid",
  superseded: "Superseded",
  not_pending: "Not pending",
};

const mutationLabels: Record<LtmDraftMutation["kind"], string> = {
  create_note: "Create memory",
  append_section: "Add to section",
  update_section: "Update section",
  add_link: "Add link",
  set_keywords: "Replace keywords",
  set_status: "Change status",
  set_subjects: "Update subjects",
};

const dispositionLabels: Record<ReviewRow["disposition"], string> = {
  new: "New memory",
  merge: "Merge into memory",
  rewrite: "Rewrite memory",
  unavailable: "Preview unavailable",
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

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleDateString();
}

function recoveryLabel(
  recovery: NonNullable<
    LtmDraftReviewDraft["candidateRejections"][number]["recovery"]
  >,
) {
  const hints = [
    recovery.noteType
      ? `memory type ${humanizeLabel(recovery.noteType)}`
      : null,
    recovery.noteId ? `memory ${recovery.noteId}` : null,
    recovery.sectionKey
      ? `section ${humanizeLabel(recovery.sectionKey)}`
      : null,
    recovery.status ? `status ${humanizeLabel(recovery.status)}` : null,
  ].filter(Boolean);
  return (
    hints.join(", ") ||
    "Review the rejected candidate and try extraction again."
  );
}

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
  return (
    <div className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
      <span className="flex items-center gap-1">
        Importance
        <InfoPopover
          label="Importance"
          content="Durability and consequence category: critical, major, moderate, or minor."
        />
      </span>
      <select
        aria-label="Importance"
        className={inputClass}
        value={value ?? ""}
        onChange={(event) =>
          onChange(
            (event.target.value || undefined) as LtmImportance | undefined,
          )
        }
      >
        <option value="">Not specified</option>
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
  if (mutation.kind === "create_note") {
    return (
      <div
        data-ltm-mutation-editor
        className="space-y-3 border-t border-[var(--border)] pt-3"
      >
        {canEditTitle ? (
          <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
            <span>Memory title</span>
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
          <span>{humanizeLabel(mutation.sectionKey)} text</span>
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
          <span>{humanizeLabel(mutation.sectionKey)} text</span>
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
        Extraction details
        {accounting
          ? ` | ${accounting.keptUnits} kept | ${accounting.parserRejections + accounting.validationRejections} rejected | ${accounting.deduplications} deduplicated`
          : ""}
      </summary>
      <div className="mt-3 space-y-3 text-[var(--muted-foreground)]">
        {accounting ? (
          <p data-ltm-extraction-accounting>
            {accounting.providerCandidates} provider candidates +{" "}
            {accounting.normalizedAdditions} normalized additions ={" "}
            {accounting.keptUnits} kept, {accounting.parserRejections} parser
            rejected, {accounting.validationRejections} validation rejected, and{" "}
            {accounting.deduplications} deduplicated.
          </p>
        ) : null}
        {item.diagnostics.length ? (
          <div data-ltm-draft-diagnostics className="space-y-1">
            <p className="font-medium text-[var(--foreground)]">Diagnostics</p>
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
              Candidate rejections
            </p>
            {item.candidateRejections.map((rejection) => (
              <div
                key={`${rejection.index}-${rejection.reason}`}
                className="space-y-1"
              >
                <p>
                  {humanizeLabel(rejection.reason)}: {rejection.message}
                </p>
                {rejection.snippet ? <p>Snippet: {rejection.snippet}</p> : null}
                {rejection.issues?.map((issue) => (
                  <p key={issue}>Issue: {issue}</p>
                ))}
                {rejection.recovery ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p>Recovery: {recoveryLabel(rejection.recovery)}</p>
                    {onRecoverCandidate ? (
                      <Button onClick={() => onRecoverCandidate(rejection)}>
                        Recover as memory
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
              Deduplications
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
  onDirtyChange,
  onOpenMemory,
  onRecoverCandidate,
  reviewSourceNoteId,
}: LongTermMemoryDestinationProps) {
  const queryClient = useQueryClient();
  const [sourceNoteId, setSourceNoteId] = useState(reviewSourceNoteId ?? null);
  useEffect(
    () => setSourceNoteId(reviewSourceNoteId ?? null),
    [reviewSourceNoteId],
  );
  const review = useQuery({
    queryKey: [...queryKeys.review, sourceNoteId],
    queryFn: () =>
      request<LtmDraftReviewResponse>(
        `/drafts/review?status=pending${sourceNoteId ? `&sourceNoteId=${encodeURIComponent(sourceNoteId)}` : ""}`,
      ),
  });
  const notes = useQuery({
    queryKey: queryKeys.notes,
    queryFn: () => request<LtmNote[]>("/notes?includeGlobal=true"),
  });
  const noteById = new Map((notes.data ?? []).map((note) => [note.id, note]));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editedById, setEditedById] = useState<Map<string, LtmDraftMutation>>(
    new Map(),
  );
  const [running, setRunning] = useState<"accept" | "skip" | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);

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
          `Fix invalid edited mutation${invalidEditIds.length === 1 ? "" : "s"} before accepting: ${invalidEditIds.join(", ")}.`,
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
            `Draft action failed: ${error instanceof Error ? error.message : "Request failed"}`,
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
          `Report dismissal failed: ${error instanceof Error ? error.message : "Request failed"}`,
        ],
        cascadeMutationIds: [],
      });
    } finally {
      setDismissingId(null);
    }
  };

  if (review.isLoading) {
    return <StatusSurface busy>Loading pending review drafts.</StatusSurface>;
  }
  if (review.isError) {
    return (
      <StatusSurface tone="danger">
        {review.error instanceof Error
          ? review.error.message
          : "Pending review drafts could not load."}
      </StatusSurface>
    );
  }

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
            label={`Select ${mutationLabels[row.mutation.kind].toLowerCase()}`}
            onChange={() => toggleSelection(row.mutation.id)}
          />
          <p
            data-ltm-risk={row.mutation.risk}
            data-ltm-disposition={row.disposition}
            className="text-right text-xs font-semibold"
          >
            {mutationLabels[row.mutation.kind]} |{" "}
            {dispositionLabels[row.disposition]} |{" "}
            {humanizeLabel(row.mutation.risk)} risk |{" "}
            {Math.round(row.mutation.confidence * 100)}% confidence
          </p>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          {row.mutation.summary}
        </p>
        <details data-ltm-review-preview className="text-xs">
          <summary className="cursor-pointer font-medium">
            Evidence and preview | {row.mutation.evidence.length} evidence
            {previewChanges.length ? ` | ${previewChanges.length} changes` : ""}
          </summary>
          <div className="mt-2 space-y-2">
            <div data-ltm-review-evidence>
              <span className="font-medium">Evidence:</span>{" "}
              {row.mutation.evidence.join(" | ")}
            </div>
            {previewChanges.length ? (
              <div data-ltm-review-changes className="space-y-1">
                {previewChanges.map((change) => (
                  <p key={`${change.kind}-${change.key}`}>
                    <span className="font-medium">
                      {humanizeLabel(change.kind)} {humanizeLabel(change.key)}:
                    </span>{" "}
                    {change.before ? `${change.before} -> ` : ""}
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
            Projection preview is stale because this target has edited
            mutations. Accept will re-project the edited values.
          </p>
        ) : null}
        <MutationEditor
          mutation={mutation}
          canEditTitle={canEditTitle}
          onChange={(next) => updateMutation(row.mutation, next)}
        />
        {!valid ? (
          <p role="alert" className="text-xs text-[var(--destructive)]">
            Section text cannot be empty.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-2">
          <Button
            primary
            disabled={
              !eligibleIds.has(row.mutation.id) || !valid || running !== null
            }
            onClick={() => void runBatch("accept", [row])}
          >
            Accept
          </Button>
          <Button
            destructive
            disabled={running !== null}
            onClick={() => void runBatch("skip", [row])}
          >
            Skip
          </Button>
        </div>
      </article>
    );
  };

  return (
    <section data-ltm-surface="review-queue" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30 p-3">
        <div>
          <h2 className="text-sm font-semibold">Review queue</h2>
          <p
            data-ltm-review-summary
            className="text-xs text-[var(--muted-foreground)]"
          >
            {review.data?.counts.sources ?? 0} source
            {review.data?.counts.sources === 1 ? "" : "s"} |{" "}
            {review.data?.counts.mutations ?? 0} pending | {eligibleIds.size}{" "}
            ready | {review.data?.counts.blockedDrafts ?? 0} blocked
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SelectionCheckbox
            checked={allSelected}
            indeterminate={someSelected}
            label="Select all"
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
              className="flex flex-wrap items-center gap-2"
            >
              <Button
                disabled={running !== null}
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
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
                  ? "Accepting..."
                  : `Accept eligible (${eligibleSelectedRows.length})`}
              </Button>
              <Button
                destructive
                disabled={running !== null}
                onClick={() => void runBatch("skip")}
              >
                {running === "skip"
                  ? "Skipping..."
                  : `Skip selected (${selectedRows.length})`}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      {sourceNoteId ? (
        <StatusSurface>
          Filtered to this source.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => setSourceNoteId(null)}
          >
            Show all
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
          {result.action === "accepted" ? "Applied" : "Skipped"}{" "}
          {result.completed} mutation
          {result.completed === 1 ? "" : "s"}; {result.failed} failed.
          {result.remaining
            ? ` ${result.remaining} other mutation${result.remaining === 1 ? " remains" : "s remain"} pending.`
            : ""}
          {result.autoIncluded
            ? ` ${result.autoIncluded} dependenc${result.autoIncluded === 1 ? "y was" : "ies were"} included automatically.`
            : ""}
          {result.indexRebuildFailures.length
            ? ` Changes were saved, but the index rebuild failed: ${result.indexRebuildFailures.join(" ")}`
            : ""}
          {result.messages.length ? ` ${result.messages.join(" ")}` : ""}
          {result.cascadeMutationIds.length
            ? ` Cascade skipped ${result.cascadeMutationIds.length} dependent mutation${result.cascadeMutationIds.length === 1 ? "" : "s"}: ${result.cascadeMutationIds.join(", ")}.`
            : ""}
        </StatusSurface>
      ) : null}
      {!review.data?.sources.length ? (
        <StatusSurface>
          No proposed memories need review yet. Import a source, then choose
          Extract to review.
        </StatusSurface>
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
                  Source:{" "}
                  {noteById.get(source.sourceNoteId)?.title ||
                    "Untitled memory"}
                </h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Modes: {source.modes.map(humanizeLabel).join(", ")}
                </p>
              </div>
              {onOpenMemory ? (
                <Button onClick={() => onOpenMemory(source.sourceNoteId)}>
                  Open source
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
                            Draft {index + 1}
                          </h4>
                          {diagnosticsOnly ? (
                            <span
                              data-ltm-diagnostics-only
                              className="rounded-full border border-[var(--border)] px-2 py-1 text-xs font-medium"
                            >
                              Diagnostics only
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          Created {formatTimestamp(item.draft.createdAt)}.{" "}
                          {item.draft.summary || "No draft summary."}
                        </p>
                      </div>
                      <span
                        data-ltm-freshness={item.freshness}
                        className="rounded-full border border-[var(--border)] px-2 py-1 text-xs font-medium"
                      >
                        {freshnessLabel[item.freshness]}
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
                          ? "Dismissing..."
                          : "Dismiss report"}
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
                              ? "Edited projection pending"
                              : "Untitled memory")}
                        </h4>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {humanizeLabel(target.noteType)}
                        </p>
                      </div>
                      {onOpenMemory && noteById.has(target.noteId) ? (
                        <Button onClick={() => onOpenMemory(target.noteId)}>
                          Open memory
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
                  "Unprojected target";
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
                          {type ? humanizeLabel(type) : "Preview unavailable"}
                        </p>
                      </div>
                      {onOpenMemory && note ? (
                        <Button onClick={() => onOpenMemory(targetId)}>
                          Open memory
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
