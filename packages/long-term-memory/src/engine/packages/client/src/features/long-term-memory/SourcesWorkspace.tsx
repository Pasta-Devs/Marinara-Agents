import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import type {
  LtmImportSourceNotesResponse,
  LtmInteropPreviewResponse,
  LtmInteropPreviewSample,
  LtmLorebookPreviewEntry,
  LtmLorebookPreviewResponse,
  LtmMode,
  LtmNoteTransferApplyResponse,
  LtmNoteTransferPreviewResponse,
  LtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { invalidateLtmQueries, queryKeys, request } from "./api";
import { Button, StatusSurface, inputClass } from "./shared-controls";
import type { LongTermMemoryDestinationProps } from "./types";

type Source = "characters" | "lorebooks" | "chats";
type PreviewRow = LtmInteropPreviewResponse["samples"][number];
type LorebookCandidate = LtmInteropPreviewSample;
type ImportContract = {
  source: Source;
  sourceIds: string[];
  scope?: LtmScope;
  mode?: LtmMode;
  selectionKey: string;
};

const sourceTabs: Array<{ id: Source; label: string }> = [
  { id: "chats", label: "Chat Summaries" },
  { id: "characters", label: "Characters" },
  { id: "lorebooks", label: "Lorebooks" },
];

type ScopeTargets = { currentScope: LtmScope | null };

function resultTone(status: string) {
  return status === "success" ||
    status === "succeeded" ||
    status === "created" ||
    status === "refreshed"
    ? "success"
    : status === "failed" || status === "cancelled"
      ? "danger"
      : "neutral";
}

function freshnessLabel(freshness: LorebookCandidate["freshness"]) {
  if (freshness === "source_updated") return "Update available";
  if (freshness === "context_updated") return "Context changed";
  if (freshness === "extraction_incomplete") return "Extraction incomplete";
  if (freshness === "current") return "Current";
  return "New";
}

function sourceStatusLabel(row: PreviewRow) {
  return freshnessLabel(row.freshness);
}

function entryStatusLabel(entry: LtmLorebookPreviewEntry) {
  const labels = new Set(
    entry.candidates.map((candidate) => freshnessLabel(candidate.freshness)),
  );
  return labels.size === 1 ? [...labels][0] : "Mixed";
}

function EntrySelect({
  entry,
  checked,
  indeterminate,
  onChange,
}: {
  entry: LtmLorebookPreviewEntry;
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={`Select ${entry.name}`}
      data-ltm-lorebook-entry-select={entry.id}
    />
  );
}

export default function SourcesWorkspace({
  props,
  onOpenMemory,
  onOpenReview,
}: LongTermMemoryDestinationProps) {
  const client = useQueryClient();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const importControllerRef = useRef<AbortController | null>(null);
  const [source, setSource] = useState<Source>("chats");
  const [selectedLorebookId, setSelectedLorebookId] = useState<string | null>(
    null,
  );
  const [lorebookMobilePane, setLorebookMobilePane] = useState<
    "lorebooks" | "entries"
  >("lorebooks");
  const [importScope, setImportScope] = useState<"current" | "all">(
    props.chatId ? "current" : "all",
  );
  const [modeFilter, setModeFilter] = useState<LtmMode | "all">("all");
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [collapsedSections, setCollapsedSections] = useState({
    available: false,
    imported: true,
  });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] =
    useState<LtmImportSourceNotesResponse | null>(null);
  const [importResultContract, setImportResultContract] =
    useState<ImportContract | null>(null);
  const [cancelledImport, setCancelledImport] = useState<ImportContract | null>(
    null,
  );
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState("");
  const [transferNoteIds, setTransferNoteIds] = useState<Set<string>>(
    new Set(),
  );
  const [transferMode, setTransferMode] = useState<"copy" | "move">("copy");
  const [includeDerived, setIncludeDerived] = useState(true);
  const [transferPreview, setTransferPreview] =
    useState<LtmNoteTransferPreviewResponse | null>(null);
  const [transferResult, setTransferResult] =
    useState<LtmNoteTransferApplyResponse | null>(null);
  const [transferBusy, setTransferBusy] = useState<"preview" | "apply" | null>(
    null,
  );
  const [transferError, setTransferError] = useState("");

  const scopeTargets = useQuery({
    queryKey: queryKeys.scopeTargets(props.chatId),
    queryFn: () =>
      request<ScopeTargets>(
        `/scope-targets${props.chatId ? `?chatId=${encodeURIComponent(props.chatId)}` : ""}`,
      ),
  });
  const effectiveImportScope =
    importScope === "current" && props.chatId ? "current" : "all";
  const sourceScope =
    effectiveImportScope === "current"
      ? (scopeTargets.data?.currentScope ?? {
          chatId: props.chatId,
          chatIds: [props.chatId],
        })
      : undefined;
  const preview = useQuery({
    queryKey: [...queryKeys.preview, source, sourceScope, modeFilter],
    queryFn: () =>
      request<
        LtmInteropPreviewResponse,
        { source: Source; limit: number; scope?: LtmScope; mode?: LtmMode }
      >("/import/preview", "POST", {
        source,
        limit: 100,
        ...(sourceScope ? { scope: sourceScope } : {}),
        ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
      }),
    enabled: source !== "lorebooks",
  });
  const lorebookPreview = useQuery({
    queryKey: [...queryKeys.lorebookPreview, sourceScope, modeFilter],
    queryFn: () =>
      request<
        LtmLorebookPreviewResponse,
        { limit: number; scope?: LtmScope; mode?: LtmMode }
      >("/import/lorebooks/preview", "POST", {
        limit: 100,
        ...(sourceScope ? { scope: sourceScope } : {}),
        ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
      }),
    enabled: source === "lorebooks",
  });
  const rows = [...(preview.data?.samples ?? [])].sort((left, right) => {
    if (source !== "chats" || !props.chatId) return 0;
    return (
      Number(!left.sourceId.startsWith(`${props.chatId}:`)) -
      Number(!right.sourceId.startsWith(`${props.chatId}:`))
    );
  });
  const pendingRows = rows.filter((row) => row.status === "pending");
  const importedRows = rows.filter((row) => row.status === "imported");
  const selectionKey = `${source}:${effectiveImportScope}:${modeFilter}`;
  const selectedIds = new Set(selections[selectionKey] ?? []);
  const importedSelectionKey = `${selectionKey}:imported`;
  const selectedImportedIds = new Set(selections[importedSelectionKey] ?? []);
  const retryableIds = importResult
    ? [
        ...importResult.imported
          .filter((item) => item.retryable)
          .map((item) => item.sourceId),
        ...importResult.writeFailures
          .filter((item) => item.retryable)
          .map((item) => item.sourceId),
      ]
    : [];
  const retryableIdSet = new Set(retryableIds);
  const selectableRows = rows.filter(
    (row) => row.status === "pending" || retryableIdSet.has(row.sourceId),
  );
  const selectedSelectableIds = selectableRows
    .filter((row) => selectedIds.has(row.sourceId))
    .map((row) => row.sourceId);
  const allSelectableSelected =
    selectableRows.length > 0 &&
    selectedSelectableIds.length === selectableRows.length;
  const selectedImportedRows = importedRows.filter((row) =>
    selectedImportedIds.has(row.sourceId),
  );
  const allImportedSelected =
    importedRows.length > 0 &&
    selectedImportedRows.length === importedRows.length;
  const lorebookImportSelectionKey = `${selectionKey}:lorebook-import`;
  const lorebookRefreshSelectionKey = `${selectionKey}:lorebook-refresh`;
  const selectedLorebookImportIds = new Set(
    selections[lorebookImportSelectionKey] ?? [],
  );
  const selectedLorebookRefreshIds = new Set(
    selections[lorebookRefreshSelectionKey] ?? [],
  );
  const selectedLorebook =
    lorebookPreview.data?.books.find(
      (book) => book.id === selectedLorebookId,
    ) ?? null;
  const selectedBookImportIds =
    selectedLorebook?.entries
      .flatMap((entry) => entry.candidates)
      .filter(
        (candidate) =>
          candidate.status === "pending" &&
          selectedLorebookImportIds.has(candidate.sourceId),
      )
      .map((candidate) => candidate.sourceId) ?? [];
  const selectedBookRefreshIds =
    selectedLorebook?.entries
      .flatMap((entry) => entry.candidates)
      .filter(
        (candidate) =>
          candidate.status === "imported" &&
          selectedLorebookRefreshIds.has(candidate.sourceId),
      )
      .map((candidate) => candidate.sourceId) ?? [];
  const selectedLorebookCandidateIds = new Set([
    ...selectedLorebookImportIds,
    ...selectedLorebookRefreshIds,
  ]);
  const pendingDraftsProduced = Boolean(
    importResult?.imported.some(
      (item) =>
        item.extractionStatus === "succeeded" &&
        item.draft?.status === "pending",
    ),
  );

  useEffect(() => {
    if (!props.chatId && importScope === "current") setImportScope("all");
  }, [importScope, props.chatId]);

  useEffect(() => () => importControllerRef.current?.abort(), []);

  useEffect(() => {
    if (!preview.data) return;
    setSelections((current) =>
      Object.hasOwn(current, selectionKey)
        ? current
        : {
            ...current,
            [selectionKey]: pendingRows.map((row) => row.sourceId),
          },
    );
  }, [preview.data, preview.dataUpdatedAt, selectionKey]);

  useEffect(() => {
    if (source !== "lorebooks" || !lorebookPreview.data) return;
    if (
      selectedLorebookId &&
      lorebookPreview.data.books.some((book) => book.id === selectedLorebookId)
    )
      return;
    setSelectedLorebookId(lorebookPreview.data.books[0]?.id ?? null);
  }, [lorebookPreview.data, selectedLorebookId, source]);

  useEffect(() => {
    if (selectAllRef.current)
      selectAllRef.current.indeterminate =
        selectedSelectableIds.length > 0 && !allSelectableSelected;
  }, [allSelectableSelected, selectedSelectableIds.length]);

  const invalidateAfterMutation = async () => {
    await invalidateLtmQueries(client, [
      queryKeys.notes,
      queryKeys.scopeTargets(props.chatId),
      queryKeys.status,
      queryKeys.integrity,
      queryKeys.review,
      queryKeys.pendingDrafts,
      queryKeys.preview,
      queryKeys.lorebookPreview,
    ]);
  };

  const clearImportResult = () => {
    setImportResult(null);
    setImportResultContract(null);
    setCancelledImport(null);
    setImportError("");
    setReviewMessage("");
  };

  const changeSource = (next: Source) => {
    setSource(next);
    if (next === "lorebooks") setLorebookMobilePane("lorebooks");
    clearImportResult();
  };

  const changeImportScope = (next: "current" | "all") => {
    setImportScope(next);
    clearImportResult();
  };

  const changeModeFilter = (next: LtmMode | "all") => {
    setModeFilter(next);
    clearImportResult();
  };

  const toggleSelected = (sourceId: string, checked: boolean) => {
    setSelections((current) => {
      const next = new Set(current[selectionKey] ?? []);
      if (checked) next.add(sourceId);
      else next.delete(sourceId);
      return { ...current, [selectionKey]: [...next] };
    });
  };

  const toggleImportedSelected = (sourceId: string, checked: boolean) => {
    setSelections((current) => {
      const next = new Set(current[importedSelectionKey] ?? []);
      if (checked) next.add(sourceId);
      else next.delete(sourceId);
      return { ...current, [importedSelectionKey]: [...next] };
    });
  };

  const toggleLorebookCandidates = (
    candidates: LorebookCandidate[],
    checked: boolean,
  ) => {
    setSelections((current) => {
      const importIds = new Set(current[lorebookImportSelectionKey] ?? []);
      const refreshIds = new Set(current[lorebookRefreshSelectionKey] ?? []);
      for (const candidate of candidates) {
        const target = candidate.status === "pending" ? importIds : refreshIds;
        if (checked) target.add(candidate.sourceId);
        else target.delete(candidate.sourceId);
      }
      return {
        ...current,
        [lorebookImportSelectionKey]: [...importIds],
        [lorebookRefreshSelectionKey]: [...refreshIds],
      };
    });
  };

  const runImport = async (
    sourceIds: string[],
    action: "import" | "refresh" = "import",
    retryContract?: ImportContract,
    selectionKeyOverride?: string,
  ) => {
    const ids = Array.from(new Set(sourceIds));
    if (ids.length === 0 || importing) return;
    if (ids.length > 100) {
      setImportError("Select up to 100 source parts per import.");
      return;
    }
    const contract: ImportContract = retryContract
      ? { ...retryContract, sourceIds: ids }
      : {
          source,
          sourceIds: ids,
          ...(sourceScope
            ? {
                scope: {
                  ...sourceScope,
                  ...(sourceScope.chatIds
                    ? { chatIds: [...sourceScope.chatIds] }
                    : {}),
                  ...(sourceScope.characterIds
                    ? { characterIds: [...sourceScope.characterIds] }
                    : {}),
                },
              }
            : {}),
          ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
          selectionKey: selectionKeyOverride ?? selectionKey,
        };
    setImporting(true);
    setImportError("");
    setReviewMessage("");
    setCancelledImport(null);
    const controller = new AbortController();
    importControllerRef.current = controller;
    try {
      const result = await request<
        LtmImportSourceNotesResponse,
        {
          source: Source;
          sourceIds: string[];
          limit: number;
          scope?: LtmScope;
          mode?: LtmMode;
        }
      >(
        "/import/source-notes",
        "POST",
        {
          source: contract.source,
          sourceIds: contract.sourceIds,
          limit: 100,
          ...(contract.scope ? { scope: contract.scope } : {}),
          ...(contract.mode ? { mode: contract.mode } : {}),
        },
        controller.signal,
      );
      setImportResult(result);
      setImportResultContract(contract);
      const failedIds = [
        ...result.imported
          .filter((item) => item.retryable)
          .map((item) => item.sourceId),
        ...result.writeFailures.map((item) => item.sourceId),
      ];
      setSelections((current) => ({
        ...current,
        [contract.selectionKey]: failedIds,
      }));
      setImporting(false);
      void invalidateAfterMutation().catch(() => undefined);
      void (
        contract.source === "lorebooks"
          ? lorebookPreview.refetch()
          : preview.refetch()
      ).catch(() => undefined);
      if (action === "refresh")
        setReviewMessage(
          "Source memory refreshed. Re-extract it if you need a new draft.",
        );
    } catch (error) {
      const cancelled = controller.signal.aborted;
      if (cancelled) setCancelledImport(contract);
      setImportError(
        cancelled
          ? "Import transport was cancelled before results were received. Some sources may have completed; the original selection is retained, and retry will use its original source, scope, and mode."
          : error instanceof Error
            ? error.message
            : "Sources could not be imported.",
      );
    } finally {
      if (importControllerRef.current === controller)
        importControllerRef.current = null;
      setImporting(false);
    }
  };

  const reextract = async (noteId: string) => {
    if (extractingId) return;
    setExtractingId(noteId);
    setImportError("");
    try {
      await request(
        `/notes/${encodeURIComponent(noteId)}/extract`,
        "POST",
        props.chatId ? { chatId: props.chatId } : {},
      );
      setReviewMessage("Extraction completed. Related draft review is ready.");
      await invalidateAfterMutation();
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "Source memory could not be re-extracted.",
      );
    } finally {
      setExtractingId(null);
    }
  };

  const toggleTransferNote = (noteId: string, checked: boolean) => {
    setTransferNoteIds((current) => {
      const next = new Set(current);
      if (checked) next.add(noteId);
      else next.delete(noteId);
      return next;
    });
    setTransferPreview(null);
    setTransferResult(null);
  };

  const previewTransfer = async () => {
    if (!props.chatId || transferNoteIds.size === 0 || transferBusy) return;
    setTransferBusy("preview");
    setTransferError("");
    setTransferResult(null);
    try {
      const result = await request<LtmNoteTransferPreviewResponse>(
        "/notes/transfer-preview",
        "POST",
        {
          noteIds: [...transferNoteIds],
          mode: transferMode,
          destinationChatId: props.chatId,
          includeDerived,
        },
      );
      setTransferPreview(result);
    } catch (error) {
      setTransferError(
        error instanceof Error
          ? error.message
          : "Transfer preview could not load.",
      );
    } finally {
      setTransferBusy(null);
    }
  };

  const applyTransfer = async () => {
    const readyIds = transferPreview?.buckets.ready ?? [];
    if (!props.chatId || readyIds.length === 0 || transferBusy) return;
    setTransferBusy("apply");
    setTransferError("");
    try {
      const result = await request<LtmNoteTransferApplyResponse>(
        "/notes/transfer",
        "POST",
        {
          // Do not send no-op or conflicting IDs from the preview back to apply.
          noteIds: readyIds,
          mode: transferPreview!.mode,
          destinationChatId: props.chatId,
          includeDerived: transferPreview.selection.includeDerived,
        },
      );
      setTransferResult(result);
      await invalidateAfterMutation();
    } catch (error) {
      setTransferError(
        error instanceof Error
          ? error.message
          : "Transfer could not be applied.",
      );
    } finally {
      setTransferBusy(null);
    }
  };

  const sourceMemoryActions = (noteId: string) => (
    <div className="flex flex-wrap gap-2">
      <label className="inline-flex min-h-11 items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <input
          type="checkbox"
          checked={transferNoteIds.has(noteId)}
          onChange={(event) => toggleTransferNote(noteId, event.target.checked)}
          data-ltm-source-transfer-note={noteId}
        />
        Transfer
      </label>
      <button
        type="button"
        data-ltm-source-memory-id={noteId}
        className="inline-flex min-h-11 items-center text-xs font-semibold text-[var(--primary)] underline underline-offset-2"
        onClick={() => onOpenMemory?.(noteId)}
      >
        Open source memory
      </button>
      <Button
        disabled={extractingId !== null}
        onClick={() => void reextract(noteId)}
        data-ltm-source-action="re-extract"
        data-ltm-source-note-id={noteId}
      >
        {extractingId === noteId ? (
          <Loader2 size="0.75rem" className="animate-spin" />
        ) : (
          <Sparkles size="0.75rem" />
        )}
        Re-extract
      </Button>
      <Button
        onClick={() => onOpenReview?.(noteId)}
        data-ltm-review-query={noteId}
      >
        Review related drafts
      </Button>
    </div>
  );

  return (
    <section
      data-ltm-surface="sources"
      data-ltm-import-status={importing ? "pending" : "idle"}
      data-ltm-extraction-status={extractingId ? "pending" : "idle"}
      data-ltm-extraction-note-id={extractingId ?? undefined}
      data-ltm-transfer-status={transferBusy ?? "idle"}
      className="space-y-4"
    >
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Import sources"
      >
        {sourceTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={source === tab.id}
            data-ltm-source-tab={tab.id}
            onClick={() => changeSource(tab.id)}
            className={`min-h-11 rounded-lg border px-3 text-xs font-semibold ${source === tab.id ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)] bg-[var(--secondary)]"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/25 p-3">
        <label className="flex min-h-11 items-center gap-2 text-xs font-medium">
          Import scope
          <select
            className={`${inputClass} min-w-44`}
            value={effectiveImportScope}
            onChange={(event) =>
              changeImportScope(event.target.value as "current" | "all")
            }
            data-ltm-import-scope
          >
            <option value="current" disabled={!props.chatId}>
              Current chat
            </option>
            <option value="all">All Available</option>
          </select>
        </label>
        <span className="text-xs text-[var(--muted-foreground)]">
          {effectiveImportScope === "all"
            ? "Search every available character, lorebook, chat, and branch."
            : "Limit imports to this chat and its related scope."}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          className="text-xs text-[var(--muted-foreground)]"
          data-ltm-source-preview-status={
            source === "lorebooks" ? lorebookPreview.status : preview.status
          }
        >
          {source === "lorebooks"
            ? lorebookPreview.data
              ? `${lorebookPreview.data.counts.books} lorebooks, ${lorebookPreview.data.counts.entries} entries, ${lorebookPreview.data.counts.imported} imported`
              : "Loading lorebooks..."
            : preview.data
              ? `${preview.data.scanned} scanned, ${preview.data.draftable} pending, ${preview.data.importedCount} imported`
              : "Loading source preview..."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-11 items-center gap-2 text-xs font-medium">
            Mode
            <select
              className={`${inputClass} w-36`}
              value={modeFilter}
              onChange={(event) =>
                changeModeFilter(event.target.value as LtmMode | "all")
              }
              aria-label="Filter sources by mode"
            >
              <option value="all">All</option>
              <option value="game">Game</option>
              <option value="conversation">Conversation</option>
              <option value="roleplay">Roleplay</option>
            </select>
          </label>
          <Button
            disabled={
              source === "lorebooks"
                ? lorebookPreview.isFetching
                : preview.isFetching
            }
            onClick={() =>
              void (source === "lorebooks"
                ? lorebookPreview.refetch()
                : preview.refetch())
            }
            data-ltm-source-action="refresh-preview"
          >
            {(
              source === "lorebooks"
                ? lorebookPreview.isFetching
                : preview.isFetching
            ) ? (
              <Loader2 size="0.75rem" className="animate-spin" />
            ) : (
              <RefreshCw size="0.75rem" />
            )}
            Refresh preview
          </Button>
        </div>
      </div>

      {(source === "lorebooks" ? lorebookPreview.isError : preview.isError) ? (
        <StatusSurface tone="danger">
          {(source === "lorebooks"
            ? lorebookPreview.error
            : preview.error) instanceof Error
            ? (source === "lorebooks" ? lorebookPreview.error : preview.error)
                .message
            : source === "lorebooks"
              ? "Lorebooks could not load."
              : "Source preview could not load."}
        </StatusSurface>
      ) : null}
      {importError ? (
        <StatusSurface tone="danger">
          {importError}
          {cancelledImport ? (
            <Button
              onClick={() =>
                void runImport(
                  cancelledImport.sourceIds,
                  "import",
                  cancelledImport,
                )
              }
              disabled={importing}
              data-ltm-source-action="retry-cancelled"
            >
              <RefreshCw size="0.75rem" />
              Retry original selection ({cancelledImport.sourceIds.length})
            </Button>
          ) : null}
        </StatusSurface>
      ) : null}
      {reviewMessage ? (
        <StatusSurface tone="success">{reviewMessage}</StatusSurface>
      ) : null}

      {source === "lorebooks" ? (
        <div
          data-ltm-source-preview="lorebooks"
          data-ltm-lorebook-browser
          className="space-y-3"
        >
          <style>{`
            @media (min-width: 1280px) {
              [data-ltm-lorebook-layout] {
                display: grid;
                grid-template-columns: minmax(17rem, 20rem) minmax(0, 1fr);
                gap: 1rem;
              }
              [data-ltm-lorebook-list],
              [data-ltm-lorebook-workbench] {
                display: block;
                margin-top: 0;
              }
            }
          `}</style>
          <div
            role="tablist"
            aria-label="Lorebook workspace"
            className="grid grid-cols-2 rounded-lg border border-[var(--border)] p-1 xl:hidden"
          >
            {(["lorebooks", "entries"] as const).map((pane) => (
              <button
                key={pane}
                type="button"
                role="tab"
                aria-selected={lorebookMobilePane === pane}
                aria-controls={`ltm-lorebook-${pane}-panel`}
                tabIndex={lorebookMobilePane === pane ? 0 : -1}
                disabled={pane === "entries" && !selectedLorebook}
                onClick={() => setLorebookMobilePane(pane)}
                onKeyDown={(event) => {
                  if (
                    event.key !== "ArrowLeft" &&
                    event.key !== "ArrowRight" &&
                    event.key !== "Home" &&
                    event.key !== "End"
                  )
                    return;
                  event.preventDefault();
                  const next =
                    event.key === "ArrowRight" || event.key === "End"
                      ? "entries"
                      : "lorebooks";
                  if (next === "entries" && !selectedLorebook) return;
                  setLorebookMobilePane(next);
                  requestAnimationFrame(() =>
                    document
                      .querySelector<HTMLElement>(
                        `[data-ltm-lorebook-pane="${next}"]`,
                      )
                      ?.focus(),
                  );
                }}
                data-ltm-lorebook-pane={pane}
                className={`min-h-11 rounded-md px-2 text-xs font-semibold capitalize disabled:opacity-40 ${lorebookMobilePane === pane ? "bg-[var(--primary)]/10 text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}
              >
                {pane}
              </button>
            ))}
          </div>

          <div data-ltm-lorebook-layout>
            <section
              id="ltm-lorebook-lorebooks-panel"
              role="tabpanel"
              aria-label="Lorebooks"
              data-ltm-lorebook-list
              className={`${lorebookMobilePane === "lorebooks" ? "block" : "hidden"} overflow-hidden rounded-lg border border-[var(--border)] xl:block xl:max-h-[calc(100vh-20rem)] xl:overflow-y-auto`}
            >
              <div className="flex min-h-11 items-center justify-between gap-3 bg-[var(--secondary)]/45 px-3 py-2">
                <h2 className="text-sm font-semibold">Lorebooks</h2>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {lorebookPreview.data?.books.length ?? 0}
                </span>
              </div>
              <div role="list" className="divide-y divide-[var(--border)]">
                {(lorebookPreview.data?.books ?? []).map((book) => (
                  <button
                    key={book.id}
                    type="button"
                    role="listitem"
                    aria-current={selectedLorebookId === book.id || undefined}
                    data-ltm-lorebook-id={book.id}
                    onClick={() => {
                      setSelectedLorebookId(book.id);
                      setLorebookMobilePane("entries");
                    }}
                    className={`flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--secondary)]/35 ${selectedLorebookId === book.id ? "bg-[var(--primary)]/10" : ""}`}
                  >
                    <BookOpen
                      size="1rem"
                      className="shrink-0 text-[var(--muted-foreground)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {book.name}
                      </span>
                      <span className="block text-xs text-[var(--muted-foreground)]">
                        {book.category} · {book.counts.entries} entries ·{" "}
                        {book.counts.imported} imported
                      </span>
                    </span>
                    <ChevronRight
                      size="0.875rem"
                      className="shrink-0 text-[var(--muted-foreground)]"
                    />
                  </button>
                ))}
                {!lorebookPreview.isLoading &&
                lorebookPreview.data?.books.length === 0 ? (
                  <p className="p-4 text-xs text-[var(--muted-foreground)]">
                    No lorebooks are available in this scope.
                  </p>
                ) : null}
              </div>
            </section>

            <section
              id="ltm-lorebook-entries-panel"
              role="tabpanel"
              aria-label="Lorebook entries"
              data-ltm-lorebook-workbench={selectedLorebook?.id ?? "empty"}
              className={`${lorebookMobilePane === "entries" ? "block" : "hidden"} mt-3 overflow-hidden rounded-lg border border-[var(--border)] xl:mt-0 xl:block xl:max-h-[calc(100vh-14rem)] xl:overflow-y-auto`}
            >
              {selectedLorebook ? (
                <>
                  <header className="space-y-2 border-b border-[var(--border)] bg-[var(--secondary)]/25 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold">
                          {selectedLorebook.name}
                        </h2>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {selectedLorebook.category} ·{" "}
                          {selectedLorebook.counts.entries} entries ·{" "}
                          {selectedLorebook.counts.candidates} source parts
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          primary
                          disabled={
                            importing || selectedBookImportIds.length === 0
                          }
                          onClick={() =>
                            void runImport(
                              selectedBookImportIds,
                              "import",
                              undefined,
                              lorebookImportSelectionKey,
                            )
                          }
                          data-ltm-lorebook-action="import-selected"
                        >
                          <Check size="0.75rem" /> Import selected (
                          {selectedBookImportIds.length})
                        </Button>
                        <Button
                          disabled={
                            importing || selectedBookRefreshIds.length === 0
                          }
                          onClick={() =>
                            void runImport(
                              selectedBookRefreshIds,
                              "refresh",
                              undefined,
                              lorebookRefreshSelectionKey,
                            )
                          }
                          data-ltm-lorebook-action="refresh-selected"
                        >
                          <RefreshCw size="0.75rem" /> Refresh selected (
                          {selectedBookRefreshIds.length})
                        </Button>
                        {importing ? (
                          <Button
                            destructive
                            onClick={() => importControllerRef.current?.abort()}
                            data-ltm-lorebook-action="cancel-import"
                          >
                            Cancel
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {selectedLorebook.description ? (
                      <p className="max-w-[75ch] text-xs text-[var(--muted-foreground)]">
                        {selectedLorebook.description}
                      </p>
                    ) : null}
                    {selectedLorebook.tags.length ? (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {selectedLorebook.tags.join(", ")}
                      </p>
                    ) : null}
                  </header>

                  <div role="list" className="divide-y divide-[var(--border)]">
                    {selectedLorebook.entries.map((entry) => {
                      const candidateIds = entry.candidates.map(
                          (candidate) => candidate.sourceId,
                        ),
                        selectedCount = candidateIds.filter((id) =>
                          selectedLorebookCandidateIds.has(id),
                        ).length,
                        importedCandidates = entry.candidates.filter(
                          (candidate) => candidate.status === "imported",
                        );
                      return (
                        <article
                          key={entry.id}
                          role="listitem"
                          data-ltm-lorebook-entry={entry.id}
                          className="space-y-3 p-3"
                        >
                          <div className="flex items-start gap-3">
                            <EntrySelect
                              entry={entry}
                              checked={
                                candidateIds.length > 0 &&
                                selectedCount === candidateIds.length
                              }
                              indeterminate={
                                selectedCount > 0 &&
                                selectedCount < candidateIds.length
                              }
                              onChange={(checked) =>
                                toggleLorebookCandidates(
                                  entry.candidates,
                                  checked,
                                )
                              }
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold">
                                  {entry.name}
                                </h3>
                                <span className="rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] font-semibold uppercase">
                                  {entryStatusLabel(entry)}
                                </span>
                                {entry.candidateCount > 1 ? (
                                  <span className="text-xs text-[var(--muted-foreground)]">
                                    {entry.candidateCount} parts
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 whitespace-pre-wrap break-words text-xs text-[var(--muted-foreground)]">
                                {entry.candidates[0]?.snippet}
                              </p>
                            </div>
                          </div>
                          {importedCandidates.map((candidate) => (
                            <div
                              key={candidate.sourceId}
                              className="ml-7 space-y-2"
                              data-ltm-source-existing-note={
                                candidate.existingNoteId
                              }
                            >
                              <p className="text-xs text-[var(--muted-foreground)]">
                                Source memory: {candidate.existingNoteTitle}
                              </p>
                              {sourceMemoryActions(candidate.existingNoteId)}
                            </div>
                          ))}
                        </article>
                      );
                    })}
                    {selectedLorebook.entries.length === 0 ? (
                      <p className="p-4 text-xs text-[var(--muted-foreground)]">
                        This lorebook has no importable entries.
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="p-4 text-xs text-[var(--muted-foreground)]">
                  Select a lorebook to inspect its entries.
                </p>
              )}
            </section>
          </div>
        </div>
      ) : (
        <div data-ltm-source-preview={source} className="space-y-3">
          {(
            [
              {
                id: "available" as const,
                title: "Ready to Import",
                rows: selectableRows,
                selected: selectedSelectableIds,
                allSelected: allSelectableSelected,
                selection: selectedIds,
                selectAllRef,
                action: "Import selected",
                actionId: "import-selected",
                onToggle: toggleSelected,
                onSelectAll: (checked: boolean) =>
                  setSelections((current) => ({
                    ...current,
                    [selectionKey]: checked
                      ? selectableRows.map((row) => row.sourceId)
                      : [],
                  })),
                onAction: () => void runImport(selectedSelectableIds),
                empty: "No new or retryable sources are ready to import.",
              },
              {
                id: "imported" as const,
                title: "Already Imported",
                rows: importedRows,
                selected: selectedImportedRows.map((row) => row.sourceId),
                allSelected: allImportedSelected,
                selection: selectedImportedIds,
                selectAllRef: undefined,
                action: "Refresh selected",
                actionId: "refresh-selected",
                onToggle: toggleImportedSelected,
                onSelectAll: (checked: boolean) =>
                  setSelections((current) => ({
                    ...current,
                    [importedSelectionKey]: checked
                      ? importedRows.map((row) => row.sourceId)
                      : [],
                  })),
                onAction: () =>
                  void runImport(
                    selectedImportedRows.map((row) => row.sourceId),
                    "refresh",
                  ),
                empty: "No sources have been imported in this scope.",
              },
            ] as const
          ).map((section) => (
            <section
              key={section.id}
              className="overflow-hidden rounded-lg border border-[var(--border)]"
              data-ltm-source-section={section.id}
            >
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-3 bg-[var(--secondary)]/45 px-3 py-2 text-left text-xs font-semibold"
                aria-expanded={!collapsedSections[section.id]}
                onClick={() =>
                  setCollapsedSections((current) => ({
                    ...current,
                    [section.id]: !current[section.id],
                  }))
                }
                data-ltm-source-section-toggle={section.id}
              >
                <span>{section.title}</span>
                <span className="text-[var(--muted-foreground)]">
                  {section.rows.length}
                </span>
              </button>
              {!collapsedSections[section.id] ? (
                <>
                  <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] px-3 py-2 text-xs font-semibold">
                    <input
                      ref={section.selectAllRef}
                      type="checkbox"
                      aria-label={`Select all ${section.title.toLowerCase()}`}
                      checked={section.allSelected}
                      disabled={section.rows.length === 0}
                      onChange={(event) =>
                        section.onSelectAll(event.target.checked)
                      }
                      data-ltm-source-select-all={section.id}
                    />
                    <span>
                      {section.selected.length} of {section.rows.length}{" "}
                      selected
                    </span>
                    <Button
                      primary
                      disabled={importing || section.selected.length === 0}
                      onClick={section.onAction}
                      data-ltm-source-action={section.actionId}
                      data-ltm-source-selected-count={section.selected.length}
                    >
                      {importing ? (
                        <Loader2 size="0.75rem" className="animate-spin" />
                      ) : section.id === "available" ? (
                        <Check size="0.75rem" />
                      ) : (
                        <RefreshCw size="0.75rem" />
                      )}
                      {section.action}
                    </Button>
                    {importing && section.id === "available" ? (
                      <Button
                        destructive
                        onClick={() => importControllerRef.current?.abort()}
                        data-ltm-source-action="cancel-import"
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                  <div role="list" className="divide-y divide-[var(--border)]">
                    {section.rows.map((row) => {
                      const selectable = section.id === "available";
                      return (
                        <article
                          key={row.sourceId}
                          role="listitem"
                          data-ltm-source-row-status={row.status}
                          data-ltm-source-id={row.sourceId}
                          className="space-y-2 p-3"
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              aria-label={`Select ${row.title}`}
                              checked={section.selection.has(row.sourceId)}
                              disabled={
                                !selectable && section.id !== "imported"
                              }
                              onChange={(event) =>
                                section.onToggle(
                                  row.sourceId,
                                  event.target.checked,
                                )
                              }
                              data-ltm-source-select={row.sourceId}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold">
                                  {row.title}
                                </h3>
                                <span
                                  data-ltm-source-status={row.status}
                                  className="rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] font-semibold uppercase"
                                >
                                  {sourceStatusLabel(row)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                                {row.summary}
                              </p>
                              <p className="mt-1 line-clamp-2 text-xs text-[var(--muted-foreground)]">
                                {row.snippet}
                              </p>
                            </div>
                          </div>
                          {section.id === "imported" ? (
                            <div
                              className="ml-7 space-y-2"
                              data-ltm-source-existing-note={row.existingNoteId}
                            >
                              <p className="text-xs text-[var(--muted-foreground)]">
                                Source memory: {row.existingNoteTitle}
                              </p>
                              <Button
                                disabled={importing}
                                onClick={() =>
                                  void runImport([row.sourceId], "refresh")
                                }
                                data-ltm-source-action="refresh-reimport"
                              >
                                <RefreshCw size="0.75rem" /> Refresh / re-import
                              </Button>
                              {sourceMemoryActions(row.existingNoteId)}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                    {!preview.isLoading && section.rows.length === 0 ? (
                      <p className="p-4 text-xs text-[var(--muted-foreground)]">
                        {section.empty}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}
            </section>
          ))}
        </div>
      )}

      {importResult ? (
        <section
          data-ltm-source-import-result={importResult.batchStatus}
          className="space-y-3 rounded-lg border border-[var(--border)] p-3"
        >
          <h2 className="text-sm font-semibold">
            Import result: {importResult.batchStatus}
          </h2>
          <div className="flex flex-wrap gap-2">
            {retryableIds.length ? (
              <Button
                primary
                disabled={importing}
                onClick={() =>
                  void runImport(
                    retryableIds,
                    "import",
                    importResultContract ?? undefined,
                  )
                }
                data-ltm-source-action="retry-failed"
              >
                <RefreshCw size="0.75rem" />
                Retry failed ({retryableIds.length})
              </Button>
            ) : null}
            {pendingDraftsProduced ? (
              <Button
                onClick={() => onOpenReview?.()}
                data-ltm-source-action="review-imported-drafts"
              >
                Review imported drafts
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            Requested {importResult.counts.requested}; wrote{" "}
            {importResult.counts.sourceNotesWritten}; succeeded{" "}
            {importResult.counts.succeeded}; failed {importResult.counts.failed}
            ; cancelled {importResult.counts.cancelled}; missing{" "}
            {importResult.counts.missing}; write failures{" "}
            {importResult.counts.sourceWriteFailed}.
          </p>
          {importResult.imported.map((item) => (
            <article
              key={item.sourceId}
              data-ltm-import-outcome={item.extractionStatus}
              className="space-y-2 rounded border border-[var(--border)] p-3"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <strong>{item.title}</strong>
                <span
                  data-ltm-source-write-status={item.sourceWriteStatus}
                  className={`rounded-full px-2 py-0.5 ${resultTone(item.sourceWriteStatus) === "success" ? "bg-emerald-500/15" : "bg-[var(--secondary)]"}`}
                >
                  {item.sourceWriteStatus}
                </span>
                <span
                  data-ltm-extraction-status={item.extractionStatus}
                  className="rounded-full bg-[var(--secondary)] px-2 py-0.5"
                >
                  {item.extractionStatus}
                </span>
                <span
                  data-ltm-extraction-outcome={item.outcome.state}
                  className="rounded-full bg-[var(--secondary)] px-2 py-0.5"
                >
                  {item.outcome.state}
                </span>
              </div>
              {item.extractionStatus !== "succeeded" ? (
                <StatusSurface tone={resultTone(item.extractionStatus)}>
                  {item.error.message}
                </StatusSurface>
              ) : null}
              {sourceMemoryActions(item.note.id)}
            </article>
          ))}
          {importResult.writeFailures.map((failure) => (
            <StatusSurface
              key={failure.sourceId}
              tone="danger"
              data-ltm-source-write-failure={failure.sourceId}
            >
              <CircleAlert size="0.875rem" /> {failure.title}:{" "}
              {failure.error.message} ({failure.sourceWriteStatus},{" "}
              {failure.extractionStatus})
            </StatusSurface>
          ))}
          {importResult.missingSourceIds.map((id) => (
            <StatusSurface key={id} tone="danger" data-ltm-source-missing={id}>
              <CircleAlert size="0.875rem" /> Missing source memory
            </StatusSurface>
          ))}
        </section>
      ) : null}

      <section
        data-ltm-source-transfer
        className="space-y-3 rounded-lg border border-[var(--border)] p-3"
      >
        <div>
          <h2 className="text-sm font-semibold">Transfer source memories</h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            Select source memories above, then preview a copy or move into the
            current chat.
          </p>
        </div>
        {!props.chatId ? (
          <StatusSurface tone="danger">
            Open Long-Term Memory from a chat before transferring memories.
          </StatusSurface>
        ) : null}
        <label className="block space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
          Mode
          <select
            value={transferMode}
            onChange={(event) => {
              setTransferMode(event.target.value as "copy" | "move");
              setTransferPreview(null);
              setTransferResult(null);
            }}
            className={inputClass}
            data-ltm-transfer-mode
          >
            <option value="copy">Copy to current chat</option>
            <option value="move">Move to current chat</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={includeDerived}
            onChange={(event) => {
              setIncludeDerived(event.target.checked);
              setTransferPreview(null);
              setTransferResult(null);
            }}
            data-ltm-transfer-include-derived
          />
          Include attached durable memories
        </label>
        <p className="text-xs text-[var(--muted-foreground)]">
          Attached durable memories are linked through source extraction. Turn
          this off to transfer only the selected source memories.
        </p>
        <Button
          primary
          disabled={
            !props.chatId || transferNoteIds.size === 0 || transferBusy !== null
          }
          onClick={() => void previewTransfer()}
          data-ltm-transfer-action="preview"
        >
          {transferBusy === "preview" ? (
            <Loader2 size="0.75rem" className="animate-spin" />
          ) : (
            <Send size="0.75rem" />
          )}{" "}
          Preview transfer ({transferNoteIds.size})
        </Button>
        {transferError ? (
          <StatusSurface tone="danger">{transferError}</StatusSurface>
        ) : null}
        {transferPreview ? (
          <div data-ltm-transfer-preview className="space-y-2 text-xs">
            <p>
              {transferPreview.buckets.ready.length} ready,{" "}
              {transferPreview.buckets.conflict.length} conflicts,{" "}
              {transferPreview.buckets.noOp.length} already applicable.
            </p>
            {transferPreview.items.map((item) => (
              <p
                key={item.noteId}
                data-ltm-transfer-item={item.classification}
                className="rounded bg-[var(--secondary)]/45 p-2"
              >
                <strong>{item.title}</strong>: {item.classification}
                {item.reason ? ` - ${item.reason}` : ""}
              </p>
            ))}
            <Button
              primary
              disabled={
                transferBusy !== null ||
                transferPreview.buckets.ready.length === 0
              }
              onClick={() => void applyTransfer()}
              data-ltm-transfer-action="apply-ready"
              data-ltm-transfer-ready-count={
                transferPreview.buckets.ready.length
              }
            >
              {transferBusy === "apply" ? (
                <Loader2 size="0.75rem" className="animate-spin" />
              ) : (
                <Check size="0.75rem" />
              )}{" "}
              Apply {transferPreview.buckets.ready.length} ready memory
              {transferPreview.buckets.ready.length === 1 ? "" : "ies"}
            </Button>
          </div>
        ) : null}
        {transferResult ? (
          <StatusSurface
            tone="success"
            data-ltm-transfer-result={transferResult.mode}
          >
            Updated {transferResult.updatedNoteIds.length}; skipped{" "}
            {transferResult.skippedNoteIds.length}; derived touched{" "}
            {transferResult.derivedNoteIdsTouched.length}.
          </StatusSurface>
        ) : null}
      </section>
    </section>
  );
}
