import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  LtmDraftMutation,
  LtmDraftReviewMutation,
  LtmDraftReviewResponse,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { invalidateLtmQueries, queryKeys, request } from "./api";
import { Button, StatusSurface } from "./shared-controls";
import type { LongTermMemoryDestinationProps } from "./types";

type ReviewRow = {
  draftId: string;
  mutation: LtmDraftMutation;
  disposition: LtmDraftReviewMutation["disposition"] | "unavailable";
  diagnostics: LtmDraftReviewMutation["diagnostics"];
  changes: LtmDraftReviewMutation["changes"];
  targetId: string;
  targetTitle?: string;
};

type BatchResult = {
  action: "accepted" | "skipped";
  completed: number;
  failed: number;
  messages: string[];
};

const freshnessLabel: Record<string, string> = {
  fresh: "Fresh",
  hashless: "Context unbound",
  stale: "Stale",
  missing: "Source missing",
  invalid: "Source invalid",
  superseded: "Superseded",
  not_pending: "Not pending",
};

function mutationTarget(mutation: LtmDraftMutation) {
  return mutation.kind === "create_note" ? mutation.note.id : mutation.noteId;
}

function mutationLabel(mutation: LtmDraftMutation) {
  return mutation.kind.replaceAll("_", " ");
}

function groupByDraft(rows: readonly ReviewRow[]) {
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    grouped.set(row.draftId, [
      ...(grouped.get(row.draftId) ?? []),
      row.mutation.id,
    ]);
  }
  return grouped;
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

export default function ReviewQueue(_: LongTermMemoryDestinationProps) {
  const queryClient = useQueryClient();
  const review = useQuery({
    queryKey: queryKeys.review,
    queryFn: () =>
      request<LtmDraftReviewResponse>("/drafts/review?status=pending"),
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState<"accept" | "skip" | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);

  const rowByMutationId = new Map<string, ReviewRow>();
  for (const source of review.data?.sources ?? []) {
    for (const target of source.targets) {
      for (const row of target.rows) {
        rowByMutationId.set(row.mutation.id, {
          ...row,
          targetId: target.noteId,
          targetTitle: target.title,
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
  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBatch = async (action: "accept" | "skip") => {
    const applicableRows =
      action === "accept" ? eligibleSelectedRows : selectedRows;
    if (!applicableRows.length) return;
    setRunning(action);
    setResult(null);
    const completedIds = new Set<string>();
    const messages: string[] = [];
    try {
      for (const [draftId, mutationIds] of groupByDraft(applicableRows)) {
        try {
          await request(
            `/drafts/${draftId}/${action === "accept" ? "accept" : "skip"}`,
            "POST",
            { mutationIds },
          );
          mutationIds.forEach((id) => completedIds.add(id));
          messages.push(
            `${action === "accept" ? "Accepted" : "Skipped"} ${mutationIds.length} mutation${mutationIds.length === 1 ? "" : "s"} from draft ${draftId}.`,
          );
        } catch (error) {
          messages.push(
            `Draft ${draftId}: ${error instanceof Error ? error.message : "Request failed"}`,
          );
        }
      }
      setSelectedIds((current) => {
        const next = new Set(current);
        completedIds.forEach((id) => next.delete(id));
        return next;
      });
      setResult({
        action: action === "accept" ? "accepted" : "skipped",
        completed: completedIds.size,
        failed: applicableRows.length - completedIds.size,
        messages,
      });
      if (completedIds.size) {
        await invalidateLtmQueries(queryClient, [
          queryKeys.review,
          queryKeys.pendingDrafts,
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

  return (
    <section data-ltm-surface="review-queue" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30 p-3">
        <div>
          <h2 className="text-sm font-semibold">Review queue</h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            {review.data?.counts.mutations ?? 0} pending mutations across{" "}
            {review.data?.counts.drafts ?? 0} drafts. {eligibleIds.size} fresh
            and unblocked mutation{eligibleIds.size === 1 ? "" : "s"} can be
            accepted.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SelectionCheckbox
            checked={allSelected}
            indeterminate={someSelected}
            label="Select all"
            onChange={() =>
              allSelected
                ? setSelectedIds(new Set())
                : setSelectedIds(new Set(rows.map((row) => row.mutation.id)))
            }
          />
          <Button
            disabled={!selectedIds.size || running !== null}
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
          <Button
            primary
            disabled={!eligibleSelectedRows.length || running !== null}
            onClick={() => void runBatch("accept")}
          >
            {running === "accept"
              ? "Accepting..."
              : `Accept eligible (${eligibleSelectedRows.length})`}
          </Button>
          <Button
            destructive
            disabled={!selectedRows.length || running !== null}
            onClick={() => void runBatch("skip")}
          >
            {running === "skip"
              ? "Skipping..."
              : `Skip selected (${selectedRows.length})`}
          </Button>
        </div>
      </div>
      {result ? (
        <StatusSurface tone={result.failed ? "danger" : "success"}>
          {result.action === "accepted" ? "Accepted" : "Skipped"}{" "}
          {result.completed} mutation{result.completed === 1 ? "" : "s"};{" "}
          {result.failed} failed. {result.messages.join(" ")}
        </StatusSurface>
      ) : null}
      {!review.data?.sources.length ? (
        <StatusSurface>No pending draft mutations need review.</StatusSurface>
      ) : null}
      {review.data?.sources.map((source) => (
        <article
          key={source.sourceNoteId}
          data-ltm-review-source={source.sourceNoteId}
          className="space-y-3 rounded-lg border border-[var(--border)] p-3"
        >
          <header>
            <h3 className="text-sm font-semibold">
              Source: {source.sourceNoteId}
            </h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Modes: {source.modes.join(", ")}
            </p>
          </header>
          {source.drafts.map((item) => {
            const blocked = item.blockReasons.length > 0;
            return (
              <section
                key={item.draft.id}
                data-ltm-review-draft={item.draft.id}
                className="space-y-3 rounded-lg bg-[var(--secondary)]/35 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-semibold">
                      Draft {item.draft.id}
                    </h4>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Status: {item.draft.status}. Created:{" "}
                      {item.draft.createdAt}.{" "}
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
                {blocked ? (
                  <div
                    data-ltm-review-blocks
                    className="space-y-1 text-xs text-[var(--destructive)]"
                  >
                    {item.blockReasons.map((reason) => (
                      <p key={reason.code}>
                        {reason.code}: {reason.message}
                      </p>
                    ))}
                  </div>
                ) : null}
                <div className="space-y-2">
                  {item.draft.mutations.map((mutation) => {
                    const row = rowByMutationId.get(mutation.id)!;
                    return (
                      <article
                        key={mutation.id}
                        data-ltm-review-mutation={mutation.id}
                        className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <SelectionCheckbox
                            checked={selectedIds.has(mutation.id)}
                            label={`Select ${mutationLabel(mutation)}`}
                            onChange={() => toggleSelection(mutation.id)}
                          />
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span
                              data-ltm-risk={mutation.risk}
                              className="rounded-full bg-[var(--secondary)] px-2 py-1"
                            >
                              Risk: {mutation.risk}
                            </span>
                            <span
                              data-ltm-disposition={row.disposition}
                              className="rounded-full bg-[var(--secondary)] px-2 py-1"
                            >
                              Disposition: {row.disposition}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs font-medium">
                          {mutationLabel(mutation)} target:{" "}
                          {row.targetTitle ?? row.targetId}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {mutation.summary} Confidence:{" "}
                          {Math.round(mutation.confidence * 100)}%.
                        </p>
                        <div data-ltm-review-evidence className="text-xs">
                          <span className="font-medium">Evidence:</span>{" "}
                          {mutation.evidence.join(" | ")}
                        </div>
                        {row.changes.length ? (
                          <div
                            data-ltm-review-changes
                            className="space-y-1 text-xs"
                          >
                            {row.changes.map((change) => (
                              <p key={`${change.kind}-${change.key}`}>
                                <span className="font-medium">
                                  {change.kind} {change.key}:
                                </span>{" "}
                                {change.before ? `${change.before} -> ` : ""}
                                {change.after}
                              </p>
                            ))}
                          </div>
                        ) : null}
                        {row.diagnostics.length ? (
                          <div
                            data-ltm-review-diagnostics
                            className="space-y-1 text-xs text-[var(--destructive)]"
                          >
                            {row.diagnostics.map((diagnostic, index) => (
                              <p key={`${diagnostic.code}-${index}`}>
                                {diagnostic.code}: {diagnostic.message}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
                {item.candidateRejections.length ? (
                  <p
                    data-ltm-candidate-rejections
                    className="text-xs text-[var(--muted-foreground)]"
                  >
                    {item.candidateRejections.length} candidate rejection
                    {item.candidateRejections.length === 1 ? "" : "s"} recorded.
                  </p>
                ) : null}
                {item.deduplications.length ? (
                  <p
                    data-ltm-deduplications
                    className="text-xs text-[var(--muted-foreground)]"
                  >
                    {item.deduplications.length} duplicate candidate
                    {item.deduplications.length === 1 ? "" : "s"} removed.
                  </p>
                ) : null}
              </section>
            );
          })}
        </article>
      ))}
    </section>
  );
}
