import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Ellipsis,
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
import {
  Button,
  ClickSurface,
  IconButton,
  InfoPopover,
  StatusSurface,
  inputClass,
} from "./shared-controls";
import type { LongTermMemoryDestinationProps } from "./types";

type Source = "characters" | "lorebooks" | "chats";
type FlatPanel = "available" | "imported";
type PreviewRow = LtmInteropPreviewResponse["samples"][number];
type LorebookCandidate = LtmInteropPreviewSample;
type ImportContract = {
  source: Source;
  sourceIds: string[];
  scope?: LtmScope;
  mode?: LtmMode;
  chatId?: string;
  selectionKey: string;
};

const sourceTabs: Array<{ id: Source; label: string }> = [
  { id: "chats", label: "Chat Summaries" },
  { id: "characters", label: "Characters" },
  { id: "lorebooks", label: "Lorebooks" },
];

const flatPanelTabs: Array<{ id: FlatPanel; label: string }> = [
  { id: "available", label: "Ready to Import" },
  { id: "imported", label: "Already Imported" },
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

function handleTabKey<T extends string>(
  event: KeyboardEvent<HTMLButtonElement>,
  ids: readonly T[],
  current: T,
  onChange: (id: T) => void,
  selector: string,
) {
  const index = ids.indexOf(current);
  if (
    index < 0 ||
    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
  )
    return;
  event.preventDefault();
  const nextIndex =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? ids.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + ids.length) %
          ids.length;
  const next = ids[nextIndex];
  onChange(next);
  requestAnimationFrame(() =>
    document.querySelector<HTMLElement>(`[${selector}="${next}"]`)?.focus(),
  );
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

function TransferWorkbench({
  chatId,
  noteCount,
  mode,
  includeDerived,
  busy,
  error,
  preview,
  result,
  onModeChange,
  onIncludeDerivedChange,
  onPreview,
  onApply,
}: {
  chatId?: string | null;
  noteCount: number;
  mode: "copy" | "move";
  includeDerived: boolean;
  busy: "preview" | "apply" | null;
  error: string;
  preview: LtmNoteTransferPreviewResponse | null;
  result: LtmNoteTransferApplyResponse | null;
  onModeChange: (mode: "copy" | "move") => void;
  onIncludeDerivedChange: (includeDerived: boolean) => void;
  onPreview: () => void;
  onApply: () => void;
}) {
  return (
    <div
      data-ltm-source-transfer
      className="space-y-3 border-b border-[var(--border)] bg-[var(--secondary)]/20 p-3"
    >
      <div className="flex items-center gap-1">
        <h2 className="text-sm font-semibold">Transfer memories</h2>
        <InfoPopover
          label="Transfer memories"
          wide
          content="Preview a copy or move into the current chat. Copy keeps the original scopes. Move transfers applicability to the current chat according to the preview. Attached durable memories are included only when selected. The preview shows which memories are ready, conflicting, or already applicable."
        />
      </div>
      {!chatId ? (
        <StatusSurface tone="danger">
          Open Long-Term Memory from a chat before transferring memories.
        </StatusSurface>
      ) : null}
      {noteCount ? (
        <>
          <label className="block space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
            Mode
            <select
              value={mode}
              onChange={(event) =>
                onModeChange(event.target.value as "copy" | "move")
              }
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
              onChange={(event) => onIncludeDerivedChange(event.target.checked)}
              data-ltm-transfer-include-derived
            />
            Include attached durable memories
          </label>
        </>
      ) : null}
      {noteCount ? (
        <Button
          primary
          disabled={!chatId || busy !== null}
          onClick={onPreview}
          data-ltm-transfer-action="preview"
        >
          {busy === "preview" ? (
            <Loader2 size="0.75rem" className="animate-spin" />
          ) : (
            <Send size="0.75rem" />
          )}
          Preview transfer ({noteCount})
        </Button>
      ) : null}
      {error ? <StatusSurface tone="danger">{error}</StatusSurface> : null}
      {preview ? (
        <div data-ltm-transfer-preview className="space-y-2 text-xs">
          <p role="status">
            {preview.buckets.ready.length} ready,{" "}
            {preview.buckets.conflict.length} conflicts,{" "}
            {preview.buckets.noOp.length} already applicable.
          </p>
          {preview.items.map((item) => (
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
            disabled={busy !== null || preview.buckets.ready.length === 0}
            onClick={onApply}
            data-ltm-transfer-action="apply-ready"
            data-ltm-transfer-ready-count={preview.buckets.ready.length}
          >
            {busy === "apply" ? (
              <Loader2 size="0.75rem" className="animate-spin" />
            ) : (
              <Check size="0.75rem" />
            )}
            {preview.mode === "move" ? "Move" : "Copy"}{" "}
            {preview.buckets.ready.length} memor
            {preview.buckets.ready.length === 1 ? "y" : "ies"}
          </Button>
        </div>
      ) : null}
      {result ? (
        <div data-ltm-transfer-result={result.mode}>
          <StatusSurface tone="success">
            Updated {result.updatedNoteIds.length}; skipped{" "}
            {result.skippedNoteIds.length}; derived touched{" "}
            {result.derivedNoteIdsTouched.length}.
          </StatusSurface>
        </div>
      ) : null}
    </div>
  );
}

export default function SourcesWorkspace({
  props,
  onOpenMemory,
  onOpenReview,
}: LongTermMemoryDestinationProps) {
  const importScopeLabelId = useId();
  const client = useQueryClient();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectAllImportedRef = useRef<HTMLInputElement>(null);
  const [transferResultKey, setTransferResultKey] = useState<string | null>(
    null,
  );
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
  const [flatPanel, setFlatPanel] = useState<FlatPanel>("available");
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
  const [transferOpen, setTransferOpen] = useState(false);
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
  const [openSourceActionId, setOpenSourceActionId] = useState<string | null>(
    null,
  );

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
  const selectedLorebookTransferNoteIds = new Set(
    selectedLorebook?.entries
      .flatMap((entry) => entry.candidates)
      .filter(
        (candidate) =>
          candidate.status === "imported" &&
          selectedLorebookRefreshIds.has(candidate.sourceId),
      )
      .map((candidate) => candidate.existingNoteId) ?? [],
  );
  const transferNoteIds = new Set(
    source === "lorebooks"
      ? selectedLorebookTransferNoteIds
      : selectedImportedRows.map((row) => row.existingNoteId),
  );
  const transferSelectionKey = JSON.stringify([...transferNoteIds].sort());
  const activeFlatRows =
    flatPanel === "available" ? selectableRows : importedRows;
  const activeFlatSelection =
    flatPanel === "available" ? selectedIds : selectedImportedIds;
  const activeFlatSelectedIds =
    flatPanel === "available"
      ? selectedSelectableIds
      : selectedImportedRows.map((row) => row.sourceId);
  const activeFlatAllSelected =
    flatPanel === "available" ? allSelectableSelected : allImportedSelected;
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

  useEffect(() => {
    if (selectAllImportedRef.current)
      selectAllImportedRef.current.indeterminate =
        selectedImportedRows.length > 0 && !allImportedSelected;
  }, [allImportedSelected, selectedImportedRows.length]);

  useEffect(() => {
    const resultStillMatchesSelection =
      transferResultKey === transferSelectionKey;
    setTransferPreview(null);
    setTransferError("");
    if (!resultStillMatchesSelection) {
      setTransferResult(null);
      setTransferResultKey(null);
    }
    if (!transferNoteIds.size && !resultStillMatchesSelection)
      setTransferOpen(false);
  }, [transferResultKey, transferSelectionKey, transferNoteIds.size]);

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
    setTransferOpen(false);
    setTransferPreview(null);
    setTransferResult(null);
    setTransferResultKey(null);
    setTransferError("");
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
          ...(props.chatId ? { chatId: props.chatId } : {}),
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
           extract: boolean;
           scope?: LtmScope;
           mode?: LtmMode;
           chatId?: string;
        }
      >(
        "/import/source-notes",
        "POST",
        {
          source: contract.source,
          sourceIds: contract.sourceIds,
          limit: 100,
          extract: action !== "refresh",
          ...(contract.scope ? { scope: contract.scope } : {}),
          ...(contract.mode ? { mode: contract.mode } : {}),
          ...(contract.chatId ? { chatId: contract.chatId } : {}),
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
          "Source synced. Re-run extraction when you want a new draft.",
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
    if (!props.chatId || readyIds.length === 0 || transferBusy || !transferPreview) return;
    setTransferBusy("apply");
    setTransferError("");
    try {
      const result = await request<LtmNoteTransferApplyResponse>(
        "/notes/transfer",
        "POST",
        {
          // Do not send no-op or conflicting IDs from the preview back to apply.
          requestedNoteIds: transferPreview.selection.requestedNoteIds,
          derivedNoteIds: transferPreview.selection.derivedNoteIds.filter((id) => readyIds.includes(id)),
          applyNoteIds: readyIds,
          mode: transferPreview!.mode,
          destinationChatId: props.chatId,
        },
      );
      setTransferResult(result);
      setTransferResultKey("[]");
      setTransferPreview(null);
      setSelections((current) => ({
        ...current,
        [source === "lorebooks"
          ? lorebookRefreshSelectionKey
          : importedSelectionKey]: [],
      }));
      setTransferOpen(true);
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

  const stopRowAction = (event: {
    preventDefault: () => void;
    stopPropagation: () => void;
  }) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const toggleSourceActions = (
    event: { preventDefault: () => void; stopPropagation: () => void },
    noteId: string,
  ) => {
    stopRowAction(event);
    setOpenSourceActionId((current) => (current === noteId ? null : noteId));
  };

  const sourceInlineActions = (noteId: string, title: string) => (
    <>
      <div className="hidden items-start gap-1 opacity-0 transition-opacity pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto group-hover:opacity-100 group-focus-within:opacity-100 md:flex">
        <IconButton
          icon={extractingId === noteId ? Loader2 : Sparkles}
          label={`Re-extract ${title}`}
          disabled={extractingId !== null}
          onClick={(event) => {
            stopRowAction(event);
            setOpenSourceActionId(null);
            void reextract(noteId);
          }}
          data-ltm-source-action="re-extract"
          data-ltm-source-note-id={noteId}
        />
        <IconButton
          icon={BookOpen}
          label={`Review drafts for ${title}`}
          onClick={(event) => {
            stopRowAction(event);
            setOpenSourceActionId(null);
            onOpenReview?.(noteId);
          }}
          data-ltm-review-query={noteId}
        />
      </div>
      <div className="flex items-start gap-1 md:hidden">
        {openSourceActionId === noteId ? (
          <>
            <IconButton
              icon={extractingId === noteId ? Loader2 : Sparkles}
              label="Re-extract"
              disabled={extractingId !== null}
              onClick={(event) => {
                stopRowAction(event);
                setOpenSourceActionId(null);
                void reextract(noteId);
              }}
              className={extractingId === noteId ? "[&>svg]:animate-spin" : ""}
            />
            <IconButton
              icon={BookOpen}
              label="Review drafts"
              onClick={(event) => {
                stopRowAction(event);
                setOpenSourceActionId(null);
                onOpenReview?.(noteId);
              }}
            />
          </>
        ) : (
          <IconButton
            icon={Ellipsis}
            label={`More actions for ${title}`}
            aria-expanded={false}
            onClick={(event) => toggleSourceActions(event, noteId)}
          />
        )}
      </div>
    </>
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
            id={`ltm-source-tab-${tab.id}`}
            tabIndex={source === tab.id ? 0 : -1}
            aria-selected={source === tab.id}
            aria-controls={`ltm-source-preview-${tab.id}`}
            data-ltm-source-tab={tab.id}
            onClick={() => changeSource(tab.id)}
            onKeyDown={(event) =>
              handleTabKey(
                event,
                sourceTabs.map((item) => item.id),
                source,
                changeSource,
                "data-ltm-source-tab",
              )
            }
            className={`min-h-11 rounded-lg border px-3 text-xs font-semibold ${source === tab.id ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)] bg-[var(--secondary)]"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/25 p-3">
        <div className="flex min-h-11 items-center gap-2 text-xs font-medium">
          <span id={importScopeLabelId}>Import scope</span>
          <InfoPopover
            label="Import scope"
            content={
              effectiveImportScope === "all"
                ? "Search every available character, lorebook, chat, and branch."
                : "Limit imports to this chat and its related scope."
            }
          />
          <select
            aria-labelledby={importScopeLabelId}
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
        </div>
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
      {!reviewMessage && !importResult && !importError ? (
        <StatusSurface>
          Importing saves source material first. Extract proposed memories, then
          review and accept the ones you want to keep.
        </StatusSurface>
      ) : null}

      {source === "lorebooks" ? (
        <div
          id="ltm-source-preview-lorebooks"
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
                          <RefreshCw size="0.75rem" /> Sync selected (
                          {selectedBookRefreshIds.length})
                        </Button>
                        {selectedLorebookTransferNoteIds.size ? (
                          <Button
                            primary
                            onClick={() => setTransferOpen((open) => !open)}
                            aria-expanded={transferOpen}
                            data-ltm-lorebook-action="transfer-selected"
                          >
                            <Send size="0.75rem" /> Transfer selected (
                            {selectedLorebookTransferNoteIds.size})
                          </Button>
                        ) : null}
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
                    {transferOpen &&
                    (selectedLorebookTransferNoteIds.size || transferResult) ? (
                      <TransferWorkbench
                        chatId={props.chatId}
                        noteCount={selectedLorebookTransferNoteIds.size}
                        mode={transferMode}
                        includeDerived={includeDerived}
                        busy={transferBusy}
                        error={transferError}
                        preview={transferPreview}
                        result={transferResult}
                        onModeChange={(mode) => {
                          setTransferMode(mode);
                          setTransferPreview(null);
                          setTransferResult(null);
                        }}
                        onIncludeDerivedChange={(includeDerived) => {
                          setIncludeDerived(includeDerived);
                          setTransferPreview(null);
                          setTransferResult(null);
                        }}
                        onPreview={() => void previewTransfer()}
                        onApply={() => void applyTransfer()}
                      />
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
                            <ClickSurface
                              key={candidate.sourceId}
                              className="group ml-7 space-y-2"
                              data-ltm-source-existing-note={
                                candidate.existingNoteId
                              }
                              data-ltm-source-actions-open={
                                openSourceActionId ===
                                  candidate.existingNoteId || undefined
                              }
                            >
                              <div className="flex items-start gap-2">
                                <button
                                  type="button"
                                  data-ltm-source-memory-id={
                                    candidate.existingNoteId
                                  }
                                  aria-label={`Open source memory: ${candidate.existingNoteTitle}`}
                                  className="inline-flex min-h-11 flex-1 items-center text-left text-xs font-semibold text-[var(--primary)] underline underline-offset-2"
                                  onClick={() =>
                                    onOpenMemory?.(candidate.existingNoteId)
                                  }
                                >
                                  Source memory: {candidate.existingNoteTitle}
                                </button>
                                {sourceInlineActions(
                                  candidate.existingNoteId,
                                  candidate.existingNoteTitle,
                                )}
                              </div>
                            </ClickSurface>
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
        <section
          id={`ltm-source-preview-${source}`}
          data-ltm-source-preview={source}
          className="overflow-hidden rounded-lg border border-[var(--border)]"
        >
          <div
            role="tablist"
            aria-label="Source status"
            className="flex border-b border-[var(--border)] bg-[var(--secondary)]/45 p-1"
          >
            {flatPanelTabs.map((tab) => {
              const count =
                tab.id === "available"
                  ? selectableRows.length
                  : importedRows.length;
              return (
                <button
                  key={tab.id}
                  id={`ltm-source-panel-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  tabIndex={flatPanel === tab.id ? 0 : -1}
                  aria-selected={flatPanel === tab.id}
                  aria-controls={`ltm-source-panel-${tab.id}`}
                  data-ltm-source-section={tab.id}
                  onClick={() => setFlatPanel(tab.id)}
                  onKeyDown={(event) =>
                    handleTabKey(
                      event,
                      flatPanelTabs.map((item) => item.id),
                      flatPanel,
                      setFlatPanel,
                      "data-ltm-source-section",
                    )
                  }
                  className={`min-h-11 flex-1 rounded-md px-3 text-xs font-semibold ${flatPanel === tab.id ? "bg-[var(--primary)]/10 text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}
                >
                  {tab.label} ({count})
                </button>
              );
            })}
          </div>
          <div
            id={`ltm-source-panel-${flatPanel}`}
            role="tabpanel"
            aria-labelledby={`ltm-source-panel-tab-${flatPanel}`}
          >
            <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-3 py-2 text-xs font-semibold">
              <input
                ref={
                  flatPanel === "available"
                    ? selectAllRef
                    : selectAllImportedRef
                }
                type="checkbox"
                aria-label={`Select all ${flatPanel === "available" ? "ready to import" : "already imported"}`}
                checked={activeFlatAllSelected}
                disabled={activeFlatRows.length === 0}
                onChange={(event) =>
                  setSelections((current) => ({
                    ...current,
                    [flatPanel === "available"
                      ? selectionKey
                      : importedSelectionKey]: event.target.checked
                      ? activeFlatRows.map((row) => row.sourceId)
                      : [],
                  }))
                }
                data-ltm-source-select-all={flatPanel}
              />
              <span>{activeFlatSelectedIds.length} selected</span>
              {flatPanel === "available" ? (
                <Button
                  primary
                  disabled={importing || activeFlatSelectedIds.length === 0}
                  onClick={() => void runImport(activeFlatSelectedIds)}
                  data-ltm-source-action="import-selected"
                  data-ltm-source-selected-count={activeFlatSelectedIds.length}
                >
                  {importing ? (
                    <Loader2 size="0.75rem" className="animate-spin" />
                  ) : (
                    <Check size="0.75rem" />
                  )}
                  Import selected
                </Button>
              ) : (
                <>
                  <Button
                    disabled={importing || activeFlatSelectedIds.length === 0}
                    onClick={() =>
                      void runImport(activeFlatSelectedIds, "refresh")
                    }
                    data-ltm-source-action="refresh-selected"
                    data-ltm-source-selected-count={
                      activeFlatSelectedIds.length
                    }
                  >
                    <RefreshCw size="0.75rem" /> Sync selected
                  </Button>
                  {transferNoteIds.size ? (
                    <Button
                      primary
                      onClick={() => setTransferOpen((open) => !open)}
                      aria-expanded={transferOpen}
                      data-ltm-source-action="transfer-selected"
                    >
                      <Send size="0.75rem" /> Transfer selected (
                      {transferNoteIds.size})
                    </Button>
                  ) : null}
                </>
              )}
              {importing && flatPanel === "available" ? (
                <Button
                  destructive
                  onClick={() => importControllerRef.current?.abort()}
                  data-ltm-source-action="cancel-import"
                >
                  Cancel
                </Button>
              ) : null}
            </div>
            {flatPanel === "imported" &&
            transferOpen &&
            (transferNoteIds.size || transferResult) ? (
              <TransferWorkbench
                chatId={props.chatId}
                noteCount={transferNoteIds.size}
                mode={transferMode}
                includeDerived={includeDerived}
                busy={transferBusy}
                error={transferError}
                preview={transferPreview}
                result={transferResult}
                onModeChange={(mode) => {
                  setTransferMode(mode);
                  setTransferPreview(null);
                  setTransferResult(null);
                }}
                onIncludeDerivedChange={(includeDerived) => {
                  setIncludeDerived(includeDerived);
                  setTransferPreview(null);
                  setTransferResult(null);
                }}
                onPreview={() => void previewTransfer()}
                onApply={() => void applyTransfer()}
              />
            ) : null}
            <div role="list" className="divide-y divide-[var(--border)]">
              {activeFlatRows.map((row) => (
                <ClickSurface
                  key={row.sourceId}
                  role="listitem"
                  data-ltm-source-row-status={row.status}
                  data-ltm-source-id={row.sourceId}
                  data-ltm-source-actions-open={
                    flatPanel === "imported" &&
                    openSourceActionId === row.existingNoteId
                      ? true
                      : undefined
                  }
                  className="group space-y-2 p-3"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.title}`}
                      checked={activeFlatSelection.has(row.sourceId)}
                      onChange={(event) =>
                        flatPanel === "available"
                          ? toggleSelected(row.sourceId, event.target.checked)
                          : toggleImportedSelected(
                              row.sourceId,
                              event.target.checked,
                            )
                      }
                      data-ltm-source-select={row.sourceId}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">{row.title}</h3>
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
                    {flatPanel === "imported"
                      ? sourceInlineActions(
                          row.existingNoteId,
                          row.existingNoteTitle,
                        )
                      : null}
                  </div>
                  {flatPanel === "imported" ? (
                    <div
                      className="ml-7 space-y-2"
                      data-ltm-source-existing-note={row.existingNoteId}
                    >
                      <button
                        type="button"
                        data-ltm-source-memory-id={row.existingNoteId}
                        aria-label={`Open source memory: ${row.existingNoteTitle}`}
                        className="inline-flex min-h-11 items-center text-left text-xs font-semibold text-[var(--primary)] underline underline-offset-2"
                        onClick={() => onOpenMemory?.(row.existingNoteId)}
                      >
                        Source memory: {row.existingNoteTitle}
                      </button>
                    </div>
                  ) : null}
                </ClickSurface>
              ))}
              {!preview.isLoading && activeFlatRows.length === 0 ? (
                <p className="p-4 text-xs text-[var(--muted-foreground)]">
                  {flatPanel === "available"
                    ? "No new or retryable sources are ready to import."
                    : "No sources have been imported in this scope."}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {importResult ? (
        <section
          data-ltm-source-import-result={importResult.batchStatus}
          className="space-y-3 rounded-lg border border-[var(--border)] p-3"
        >
          <h2 className="text-sm font-semibold">Source import complete</h2>
          {pendingDraftsProduced ? (
            <p className="text-xs text-[var(--muted-foreground)]">
              Proposed memories are ready for review. They are not saved
              memories until you accept them.
            </p>
          ) : null}
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
                Review proposed memories
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
              {item.extractionStatus === "failed" ||
              item.extractionStatus === "cancelled" ? (
                <StatusSurface tone={resultTone(item.extractionStatus)}>
                  {item.error.message}
                </StatusSurface>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-ltm-source-memory-id={item.note.id}
                  aria-label={`Open source memory: ${item.title}`}
                  className="inline-flex min-h-11 items-center text-xs font-semibold text-[var(--primary)] underline underline-offset-2"
                  onClick={() => onOpenMemory?.(item.note.id)}
                >
                  Open source memory
                </button>
                <Button
                  disabled={extractingId !== null}
                  onClick={() => void reextract(item.note.id)}
                  data-ltm-source-action="re-extract"
                  data-ltm-source-note-id={item.note.id}
                >
                  {extractingId === item.note.id ? (
                    <Loader2 size="0.75rem" className="animate-spin" />
                  ) : (
                    <Sparkles size="0.75rem" />
                  )}
                  Re-extract
                </Button>
                <Button
                  onClick={() => onOpenReview?.(item.note.id)}
                  data-ltm-review-query={item.note.id}
                >
                  Review related drafts
                </Button>
              </div>
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
    </section>
  );
}
