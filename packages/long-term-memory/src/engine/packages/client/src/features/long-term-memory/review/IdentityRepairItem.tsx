import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LtmIdentityRepairPreviewResponse } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { errorMessage, invalidateLtmQueries, queryKeys, request } from "../api";
import { labelKeys, localizedLabel } from "../display-labels";
import { selectLtmPluralForm, useLtmTranslation } from "../localization";
import { Button, InfoPopover, StatusSurface, confirm, lockedActionProps } from "../shared-controls";
import type { LongTermMemoryDestinationProps } from "../types";

type Candidate = LtmIdentityRepairPreviewResponse["candidates"][number];

const KEEP_BOTH_KEY = "ltm-identity-keep-both";
const KEEP_BOTH_LIMIT = 200;

// "Keep both" is a per-device choice: the server stores no dismissal for a duplicate pair, and this item must not
// change a stored format. A pair that changes gets a new candidate id and is offered again.
function readKeptBoth(): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(KEEP_BOTH_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeKeptBoth(ids: string[]) {
  try {
    window.localStorage.setItem(KEEP_BOTH_KEY, JSON.stringify(ids.slice(-KEEP_BOTH_LIMIT)));
  } catch {
    // Storage can be blocked; the choice then lasts until Review closes.
  }
}

/**
 * Review's "same person" item: duplicate trusted identities, each with Merge or Keep both. Merge and
 * "Preview identity repairs" open the real repair preview (canonical memory, duplicates to include, content to
 * add, section conflicts) and ask for confirmation before anything is archived.
 */
export default function IdentityRepairItem({ props }: { props: LongTermMemoryDestinationProps["props"] }) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const queryClient = useQueryClient();
  const check = useQuery({
    queryKey: queryKeys.identityRepair,
    queryFn: () => request<LtmIdentityRepairPreviewResponse>("/identity-repair/preview", "POST", {}),
    // The preview reads every note; mutations elsewhere invalidate this key, so a focus refetch adds only cost.
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const [keptBoth, setKeptBoth] = useState<string[]>(readKeptBoth);
  const [pending, setPending] = useState("");
  // Only the "include a duplicate first" check stays inline (it belongs to the open preview); results are toasts.
  const [validation, setValidation] = useState("");
  const [preview, setPreview] = useState<LtmIdentityRepairPreviewResponse | null>(null);
  const [shownIds, setShownIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sectionChoices, setSectionChoices] = useState<Record<string, Record<string, string>>>({});
  const [includedNoteIds, setIncludedNoteIds] = useState<Record<string, string[]>>({});
  const [canonicalNoteIds, setCanonicalNoteIds] = useState<Record<string, string>>({});
  const sectionRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const previewButton = useRef<HTMLButtonElement>(null);
  const busy = pending !== "";
  const lock = lockedActionProps(busy);

  const joinList = (items: string[], type: "conjunction" | "unit" = "conjunction") => {
    try {
      return new Intl.ListFormat(locale, { style: "long", type }).format(items);
    } catch {
      return items.join(type === "unit" ? ", " : " and ");
    }
  };

  const candidates = check.data?.candidates ?? [];
  // A row is a real duplicate pair. A candidate with nothing to archive (a bind-only repair) has no row, but the
  // preview still lists it, so "Preview identity repairs" stays reachable whenever any candidate exists.
  const rows = candidates.filter(
    (candidate) => candidate.duplicateNoteIds.length > 0 && !keptBoth.includes(candidate.id),
  );
  const detailOpen = preview !== null;
  useEffect(() => {
    if (detailOpen) detailRef.current?.focus();
  }, [detailOpen]);

  const focusSoon = (find: () => HTMLElement | null | undefined) => requestAnimationFrame(() => find()?.focus());
  const closeDetail = () => {
    setPreview(null);
    setShownIds([]);
    setSelectedIds([]);
    setSectionChoices({});
    setIncludedNoteIds({});
    setCanonicalNoteIds({});
    setValidation("");
    focusSoon(() => previewButton.current);
  };
  // This item can unmount with the button that has focus (nothing left to merge), so focus moves to the review
  // queue itself, the stable container outside the item.
  const queueRoot = () => document.querySelector<HTMLElement>('[data-ltm-surface="review-queue"]');
  // A merge can leave no pair to offer, which unmounts this item with its Preview button; focus then falls back to
  // the review queue, unless the user already put it somewhere.
  const settleFocus = () =>
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && active !== document.body && active.isConnected) return;
      (previewButton.current ?? queueRoot())?.focus();
    });

  const keepBoth = (candidate: Candidate) => {
    if (busy) return;
    const next = [...keptBoth.filter((id) => id !== candidate.id), candidate.id];
    setKeptBoth(next);
    writeKeptBoth(next);
    // The pressed row leaves the list; keep focus in it, on the neighbouring Merge, or on Preview when none is left.
    const index = rows.findIndex((row) => row.id === candidate.id);
    const neighbour = rows[index + 1] ?? rows[index - 1];
    focusSoon(() =>
      neighbour
        ? sectionRef.current?.querySelector<HTMLElement>(`[data-ltm-identity-row="${neighbour.id}"] button`)
        : previewButton.current,
    );
  };

  /** Reads a fresh preview, then opens it for one pair (Merge) or for every pair still offered. */
  const openDetail = async (onlyId?: string) => {
    if (busy) return;
    setPending("identity-preview");
    setValidation("");
    try {
      const fresh = (await check.refetch({ throwOnError: true })).data;
      const ids = (fresh?.candidates ?? [])
        .filter((candidate) => !onlyId || candidate.id === onlyId)
        .map((candidate) => candidate.id);
      if (!fresh || !ids.length) {
        toast(localizeUi("ui.longTermMemory.reviewqueue.identityNothingToMerge"));
        // The refetch can empty the list, which unmounts the pressed button.
        queueRoot()?.focus();
        return;
      }
      setPreview(fresh);
      setShownIds(ids);
      setSelectedIds(
        fresh.candidates
          .filter((candidate) => ids.includes(candidate.id) && !candidate.blockingReasons.length)
          .map((candidate) => candidate.id),
      );
      setSectionChoices({});
      setIncludedNoteIds(
        Object.fromEntries(fresh.candidates.map((candidate) => [candidate.id, candidate.duplicateNoteIds])),
      );
      setCanonicalNoteIds({});
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.couldNotPreviewIdentityRepairs")));
    } finally {
      setPending("");
    }
  };

  const selectCanonical = async (candidateId: string, canonicalNoteId: string) => {
    if (busy || !preview) return;
    const nextCanonical = { ...canonicalNoteIds, [candidateId]: canonicalNoteId };
    setPending(`identity-canonical-${candidateId}`);
    try {
      const refreshed = await request<LtmIdentityRepairPreviewResponse>("/identity-repair/preview", "POST", {
        scope: preview.scope,
        canonicalNoteIds: nextCanonical,
      });
      setPreview(refreshed);
      setCanonicalNoteIds(nextCanonical);
      setSectionChoices((current) => ({ ...current, [candidateId]: {} }));
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.couldNotRefreshCanonicalPreview")));
    } finally {
      setPending("");
    }
  };

  const applySelected = async () => {
    if (busy || !preview || !selectedIds.length) return;
    const selected = preview.candidates.filter((candidate) => selectedIds.includes(candidate.id));
    const repairs = selected.flatMap((candidate) => {
      if (candidate.blockingReasons.length) return [];
      const included = new Set([candidate.canonicalNoteId, ...(includedNoteIds[candidate.id] ?? [])]);
      const choices = sectionChoices[candidate.id] ?? {};
      const conflicts = candidate.supersedingConflicts.filter(
        (conflict) =>
          conflict.options.filter((option) => option.noteIds.some((noteId) => included.has(noteId))).length > 1,
      );
      if (
        conflicts.some(
          (conflict) =>
            !conflict.options.some(
              (option) =>
                option.noteIds.includes(choices[conflict.sectionKey] ?? "") &&
                option.noteIds.some((noteId) => included.has(noteId)),
            ),
        )
      )
        return [];
      return [
        {
          candidateId: candidate.id,
          canonicalNoteId: candidate.canonicalNoteId,
          excludedNoteIds: candidate.duplicateNoteIds.filter((noteId) => !included.has(noteId)),
          sectionChoices: conflicts.map((conflict) => ({
            sectionKey: conflict.sectionKey,
            noteId: choices[conflict.sectionKey]!,
          })),
        },
      ];
    });
    if (repairs.length !== selected.length) return;
    const includedDuplicateCount = repairs.reduce(
      (count, repair) =>
        count +
        selected.find((candidate) => candidate.id === repair.candidateId)!.duplicateNoteIds.length -
        repair.excludedNoteIds.length,
      0,
    );
    if (includedDuplicateCount === 0) {
      setValidation(localizeUi("ui.longTermMemory.memorysettings.includeDuplicateBeforeApplyingRepairs"));
      return;
    }
    setPending("identity-confirm");
    setValidation("");
    let confirmed = false;
    try {
      confirmed = await confirm(
        props,
        localizeUi("ui.longTermMemory.memorysettings.applyIdentityRepairs"),
        localizeUi("ui.longTermMemory.memorysettings.applyIdentityRepairsDescription", {
          repairs: localizeUi(
            selectLtmPluralForm(locale, repairs.length) === "one"
              ? "ui.longTermMemory.memorysettings.selectedIdentityRepairsOne"
              : "ui.longTermMemory.memorysettings.selectedIdentityRepairsOther",
            { count: repairs.length },
          ),
          duplicates: localizeUi(
            selectLtmPluralForm(locale, includedDuplicateCount) === "one"
              ? "ui.longTermMemory.memorysettings.includedDuplicateNotesOne"
              : "ui.longTermMemory.memorysettings.includedDuplicateNotesOther",
            { count: includedDuplicateCount },
          ),
        }),
        localizeUi(
          selectLtmPluralForm(locale, repairs.length) === "one"
            ? "ui.longTermMemory.memorysettings.applyIdentityRepairsActionOne"
            : "ui.longTermMemory.memorysettings.applyIdentityRepairsActionOther",
          { count: repairs.length },
        ),
        true,
      );
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.couldNotConfirmIdentityRepairs")));
    }
    if (!confirmed) {
      setPending("");
      return;
    }
    setPending("identity-apply");
    try {
      const result = await request<{ repairs: unknown[]; backup: { id: string } }>("/identity-repair/apply", "POST", {
        scope: preview.scope,
        repairs,
      });
      toast.success(
        localizeUi(
          selectLtmPluralForm(locale, result.repairs.length) === "one"
            ? "ui.longTermMemory.reviewqueue.identityMergedOne"
            : "ui.longTermMemory.reviewqueue.identityMergedOther",
          { count: result.repairs.length },
        ),
      );
      closeDetail();
      await invalidateLtmQueries(queryClient, [
        queryKeys.identityRepair,
        queryKeys.integrity,
        queryKeys.status,
        queryKeys.notes,
        queryKeys.review,
        queryKeys.pendingDrafts,
        queryKeys.rejectedSuggestions,
        queryKeys.activity,
        queryKeys.localCharactersRoot,
        queryKeys.scopeTargetsRoot,
        ...(props.chatId ? [queryKeys.lastInjection(props.chatId)] : []),
      ]);
      settleFocus();
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.couldNotApplyIdentityRepairs")));
    } finally {
      setPending("");
    }
  };

  const unresolved = Boolean(
    preview?.candidates.some((candidate) => {
      if (!selectedIds.includes(candidate.id)) return false;
      const included = new Set([candidate.canonicalNoteId, ...(includedNoteIds[candidate.id] ?? [])]);
      return (
        candidate.blockingReasons.length > 0 ||
        candidate.supersedingConflicts.some((conflict) => {
          const includedOptions = conflict.options.filter((option) =>
            option.noteIds.some((noteId) => included.has(noteId)),
          );
          if (includedOptions.length < 2) return false;
          const choice = sectionChoices[candidate.id]?.[conflict.sectionKey];
          return !includedOptions.some((option) => option.noteIds.includes(choice ?? ""));
        })
      );
    }),
  );

  const kindLabel = (candidate: Candidate) =>
    candidate.noteType === "relationship"
      ? localizeUi("ui.longTermMemory.memorysettings.relationship")
      : localizeUi("ui.longTermMemory.memorysettings.character");

  if (!detailOpen && !candidates.length && !check.isError) return null;

  return (
    <section ref={sectionRef} data-ltm-identity-item className="mari-editor-panel space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h3 className="text-sm font-semibold">
            {(detailOpen ? shownIds.length : rows.length) > 0
              ? localizeUi("ui.longTermMemory.reviewqueue.samePersonTitle", {
                  count: detailOpen ? shownIds.length : rows.length,
                })
              : localizeUi("ui.longTermMemory.reviewqueue.samePersonTitleBare")}
          </h3>
          <InfoPopover
            label={localizeUi("ui.longTermMemory.memorysettings.identityRepair")}
            content={localizeUi(
              "ui.longTermMemory.memorysettings.previewDuplicateTrustedIdentitiesBeforeMergingAndArchivingDuplicates",
            )}
          />
        </div>
        {detailOpen ? (
          <div className="flex flex-wrap gap-2">
            <Button
              destructive
              disabled={selectedIds.length === 0 || unresolved}
              {...lock}
              onClick={() => void applySelected()}
            >
              {localizeUi("ui.longTermMemory.memorysettings.applySelectedRepairs", { count: selectedIds.length })}
            </Button>
            <Button {...lock} onClick={() => !busy && closeDetail()}>
              {localizeUi("ui.longTermMemory.memoryvault.cancel")}
            </Button>
          </div>
        ) : candidates.length ? (
          <Button ref={previewButton} {...lock} onClick={() => void openDetail()}>
            {localizeUi("ui.longTermMemory.memorysettings.previewIdentityRepairs")}
          </Button>
        ) : null}
      </div>
      {check.isError && !detailOpen ? (
        <StatusSurface tone="danger">
          {localizeUi("ui.longTermMemory.reviewqueue.identityCheckFailed")}{" "}
          <Button
            className="shrink-0"
            {...lockedActionProps(check.isFetching)}
            onClick={() => {
              if (!check.isFetching) void check.refetch();
            }}
          >
            {localizeUi("ui.longTermMemory.activityview.retry")}
          </Button>
        </StatusSurface>
      ) : null}
      {validation ? <StatusSurface tone="danger">{validation}</StatusSurface> : null}
      {!detailOpen && rows.length ? (
        <ul className="space-y-2">
          {rows.map((candidate) => (
            <li
              key={candidate.id}
              data-ltm-identity-row={candidate.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] p-3 text-xs"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{joinList(candidate.subjectNames)}</span>
                <span className="block text-[var(--muted-foreground)]">
                  {localizeUi("ui.longTermMemory.reviewqueue.samePersonRow", {
                    kind: kindLabel(candidate),
                    count: candidate.notes.length,
                  })}
                </span>
              </span>
              <span className="flex flex-wrap gap-2">
                <Button {...lock} onClick={() => void openDetail(candidate.id)}>
                  {localizeUi("ui.longTermMemory.reviewqueue.identityMerge")}
                </Button>
                <Button {...lock} onClick={() => keepBoth(candidate)}>
                  {localizeUi("ui.longTermMemory.reviewqueue.identityKeepBoth")}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {!detailOpen && rows.length ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.longTermMemory.reviewqueue.identityKeepBothHint")}
        </p>
      ) : null}
      {preview ? (
        <div
          ref={detailRef}
          tabIndex={-1}
          role="group"
          data-ltm-identity-preview
          aria-label={localizeUi("ui.longTermMemory.memorysettings.previewIdentityRepairs")}
          className="space-y-2 text-xs focus-visible:outline-none"
        >
          {/* Always mounted while open, so a refreshed preview is read out. */}
          {/* The counts cover every candidate, so they are shown only when the preview lists them all. */}
          <p
            role="status"
            data-ltm-identity-preview-summary
            className={shownIds.length === preview.candidates.length ? undefined : "sr-only"}
          >
            {shownIds.length === preview.candidates.length ? (
              <>
                {preview.counts.candidateCount} {localizeUi("ui.longTermMemory.memorysettings.candidateGroupS")}{" "}
                {preview.counts.duplicateNotes} {localizeUi("ui.longTermMemory.memorysettings.duplicateNoteS")}{" "}
                {preview.counts.unresolvedNotes} {localizeUi("ui.longTermMemory.memorysettings.unresolved")}
              </>
            ) : null}
          </p>
          {preview.candidates
            .filter((candidate) => shownIds.includes(candidate.id))
            .map((candidate) => (
              <div key={candidate.id} className="space-y-2 rounded border border-[var(--border)] p-3">
                <label className="flex min-h-11 items-start gap-2">
                  <input
                    className={`mt-0.5 ${busy ? "opacity-50" : ""}`}
                    type="checkbox"
                    checked={selectedIds.includes(candidate.id)}
                    disabled={candidate.blockingReasons.length > 0}
                    {...lock}
                    onChange={(event) => {
                      if (busy) return;
                      setSelectedIds((current) =>
                        event.target.checked ? [...current, candidate.id] : current.filter((id) => id !== candidate.id),
                      );
                    }}
                  />
                  <span>
                    <span className="block font-semibold">{joinList(candidate.subjectNames)}</span>
                    <span className="block text-[var(--muted-foreground)]">
                      {kindLabel(candidate)} {localizeUi("ui.longTermMemory.memorysettings.matchVia")}{" "}
                      {joinList(
                        candidate.matchBasis.map((basis) =>
                          localizedLabel(basis, localizeUi, labelKeys.identityMatchBasis),
                        ),
                        "unit",
                      )}
                      .
                    </span>
                  </span>
                </label>
                {candidate.blockingReasons.length ? (
                  <StatusSurface tone="danger">{candidate.blockingReasons.join(" ")}</StatusSurface>
                ) : null}
                <div className="space-y-1 text-[var(--muted-foreground)]">
                  {candidate.notes.map((note) => {
                    const canonical = note.noteId === candidate.canonicalNoteId;
                    return (
                      <div
                        key={note.noteId}
                        className="flex min-h-11 items-start gap-3 rounded border border-[var(--border)] p-2"
                      >
                        <label className="flex items-start gap-2">
                          <input
                            className={`mt-0.5 ${busy ? "opacity-50" : ""}`}
                            type="radio"
                            name={`canonical-${candidate.id}`}
                            checked={canonical}
                            disabled={!selectedIds.includes(candidate.id)}
                            {...lock}
                            onChange={() => void selectCanonical(candidate.id, note.noteId)}
                          />
                          <span className="font-medium text-[var(--foreground)]">
                            {localizeUi("ui.longTermMemory.memorysettings.keepAsCanonical")}
                          </span>
                        </label>
                        <label className="flex min-w-0 flex-1 items-start gap-2">
                          <input
                            className={`mt-0.5 ${busy ? "opacity-50" : ""}`}
                            type="checkbox"
                            checked={canonical || (includedNoteIds[candidate.id] ?? []).includes(note.noteId)}
                            disabled={canonical || !selectedIds.includes(candidate.id)}
                            {...lock}
                            onChange={(event) => {
                              if (busy) return;
                              setValidation("");
                              setIncludedNoteIds((current) => ({
                                ...current,
                                [candidate.id]: event.target.checked
                                  ? [...(current[candidate.id] ?? []), note.noteId]
                                  : (current[candidate.id] ?? []).filter((id) => id !== note.noteId),
                              }));
                            }}
                          />
                          <span>
                            <span className="block font-medium text-[var(--foreground)]">
                              {canonical
                                ? localizeUi("ui.longTermMemory.memorysettings.canonicalMemory")
                                : localizeUi("ui.longTermMemory.memorysettings.includeDuplicateInMergeAndArchive")}
                              : {note.title}
                            </span>
                            <span className="block">
                              {localizedLabel(note.basis, localizeUi, labelKeys.identityMatchBasis)}
                              {note.alreadyBound ? localizeUi("ui.longTermMemory.memorysettings.alreadyBound") : ""}
                              {note.exactFullName ? localizeUi("ui.longTermMemory.memorysettings.exactFullName") : ""}
                              {localizeUi("ui.longTermMemory.memorysettings.created")}{" "}
                              {new Date(note.createdAt).toLocaleDateString(locale)}
                            </span>
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
                {candidate.additiveContent.length ? (
                  <div className="space-y-1">
                    <p className="font-medium">{localizeUi("ui.longTermMemory.memorysettings.contentToAdd")}</p>
                    {candidate.additiveContent.map((content) => (
                      <p key={content.sectionKey} className="text-[var(--muted-foreground)]">
                        {content.sectionKey}: {content.addedLines.join(" | ")}
                      </p>
                    ))}
                  </div>
                ) : null}
                {candidate.supersedingConflicts.map((conflict) => (
                  <fieldset
                    key={conflict.sectionKey}
                    className="space-y-1 border-t border-[var(--border)] pt-2"
                    disabled={!selectedIds.includes(candidate.id)}
                  >
                    <legend className="font-medium">
                      {localizeUi("ui.longTermMemory.memorysettings.chooseSectionContent", {
                        sectionKey: conflict.sectionKey,
                      })}
                    </legend>
                    {conflict.options.map((option) => {
                      const included = new Set([candidate.canonicalNoteId, ...(includedNoteIds[candidate.id] ?? [])]);
                      const noteId = option.noteIds.find((id) => included.has(id));
                      const titles = option.noteIds.map(
                        (id) => candidate.notes.find((note) => note.noteId === id)?.title ?? id,
                      );
                      return (
                        <label
                          key={`${conflict.sectionKey}-${option.noteIds.join(":")}`}
                          className="flex min-h-11 items-start gap-2 rounded border border-[var(--border)] p-2"
                        >
                          <input
                            className={`mt-0.5 ${busy ? "opacity-50" : ""}`}
                            type="radio"
                            name={`${candidate.id}-${conflict.sectionKey}`}
                            disabled={!noteId}
                            {...lock}
                            checked={
                              noteId !== undefined &&
                              option.noteIds.includes(sectionChoices[candidate.id]?.[conflict.sectionKey] ?? "")
                            }
                            onChange={() => {
                              if (busy || !noteId) return;
                              setSectionChoices((current) => ({
                                ...current,
                                [candidate.id]: { ...current[candidate.id], [conflict.sectionKey]: noteId },
                              }));
                            }}
                          />
                          <span>
                            <span className="block font-medium">{titles.join(", ")}</span>
                            <span className="block whitespace-pre-wrap text-[var(--muted-foreground)]">
                              {option.text}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                ))}
              </div>
            ))}
        </div>
      ) : null}
    </section>
  );
}
