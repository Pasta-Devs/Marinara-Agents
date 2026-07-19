import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CircleAlert,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import type {
  LtmImportSourceNotesResponse,
  LtmInteropPreviewResponse,
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

export default function SourcesWorkspace({
  props,
  onOpenMemory,
  onOpenReview,
}: LongTermMemoryDestinationProps) {
  const client = useQueryClient();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source>("chats");
  const [importScope, setImportScope] = useState<"current" | "all">("current");
  const [modeFilter, setModeFilter] = useState<LtmMode | "all">("all");
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] =
    useState<LtmImportSourceNotesResponse | null>(null);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState("");
  const [transferNoteIds, setTransferNoteIds] = useState<Set<string>>(
    new Set(),
  );
  const [transferMode, setTransferMode] = useState<"copy" | "move">("copy");
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
  const sourceScope =
    importScope === "current"
      ? (scopeTargets.data?.currentScope ??
        (props.chatId
          ? { chatId: props.chatId, chatIds: [props.chatId] }
          : undefined))
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
  });
  const rows = preview.data?.samples ?? [];
  const pendingRows = rows.filter((row) => row.status === "pending");
  const selectionKey = `${source}:${importScope}:${modeFilter}`;
  const selectedIds = new Set(selections[selectionKey] ?? []);
  const selectedPendingIds = pendingRows
    .filter((row) => selectedIds.has(row.sourceId))
    .map((row) => row.sourceId);
  const allPendingSelected =
    pendingRows.length > 0 && selectedPendingIds.length === pendingRows.length;

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
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedPendingIds.length > 0 && !allPendingSelected;
    }
  }, [allPendingSelected, selectedPendingIds.length]);

  const invalidateAfterMutation = async () => {
    await invalidateLtmQueries(client, [
      queryKeys.notes,
      queryKeys.scopeTargets(props.chatId),
      queryKeys.status,
      queryKeys.integrity,
      queryKeys.review,
      queryKeys.pendingDrafts,
      queryKeys.preview,
    ]);
  };

  const changeSource = (next: Source) => {
    setSource(next);
    setImportResult(null);
    setImportError("");
    setReviewMessage("");
  };

  const toggleSelected = (sourceId: string, checked: boolean) => {
    setSelections((current) => {
      const next = new Set(current[selectionKey] ?? []);
      if (checked) next.add(sourceId);
      else next.delete(sourceId);
      return { ...current, [selectionKey]: [...next] };
    });
  };

  const runImport = async (
    sourceIds: string[],
    action: "import" | "refresh" = "import",
  ) => {
    const ids = Array.from(new Set(sourceIds)).slice(0, 100);
    if (ids.length === 0 || importing) return;
    setImporting(true);
    setImportError("");
    setReviewMessage("");
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
      >("/import/source-notes", "POST", {
        source,
        sourceIds: ids,
        limit: 100,
        ...(sourceScope ? { scope: sourceScope } : {}),
        ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
      });
      setImportResult(result);
      setImporting(false);
      void invalidateAfterMutation().catch(() => undefined);
      void preview.refetch().catch(() => undefined);
      if (action === "refresh")
        setReviewMessage(
          "Source memory refreshed. Re-extract it if you need a new draft.",
        );
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "Sources could not be imported.",
      );
    } finally {
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
          includeDerived: false,
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
            value={importScope}
            onChange={(event) =>
              setImportScope(event.target.value as "current" | "all")
            }
            data-ltm-import-scope
          >
            <option value="current">Current chat</option>
            <option value="all">All Available</option>
          </select>
        </label>
        <span className="text-xs text-[var(--muted-foreground)]">
          {importScope === "all"
            ? "Search every available character, lorebook, chat, and branch."
            : "Limit imports to this chat and its related scope."}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          className="text-xs text-[var(--muted-foreground)]"
          data-ltm-source-preview-status={preview.status}
        >
          {preview.data
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
                setModeFilter(event.target.value as LtmMode | "all")
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
            disabled={preview.isFetching}
            onClick={() => void preview.refetch()}
            data-ltm-source-action="refresh-preview"
          >
            {preview.isFetching ? (
              <Loader2 size="0.75rem" className="animate-spin" />
            ) : (
              <RefreshCw size="0.75rem" />
            )}
            Refresh preview
          </Button>
        </div>
      </div>

      {preview.isError ? (
        <StatusSurface tone="danger">
          {preview.error instanceof Error
            ? preview.error.message
            : "Source preview could not load."}
        </StatusSurface>
      ) : null}
      {importError ? (
        <StatusSurface tone="danger">{importError}</StatusSurface>
      ) : null}
      {reviewMessage ? (
        <StatusSurface tone="success">{reviewMessage}</StatusSurface>
      ) : null}

      <div
        className="overflow-hidden rounded-lg border border-[var(--border)]"
        data-ltm-source-preview={source}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--secondary)]/45 px-3 py-2 text-xs font-semibold">
          <input
            ref={selectAllRef}
            type="checkbox"
            aria-label="Select all visible pending sources"
            checked={allPendingSelected}
            disabled={pendingRows.length === 0}
            onChange={(event) => setSelections((current) => ({
              ...current,
              [selectionKey]: event.target.checked
                ? pendingRows.map((row) => row.sourceId)
                : [],
            }))}
            data-ltm-source-select-all
          />
          <span>
            {selectedPendingIds.length} of {pendingRows.length} pending selected
          </span>
          <Button
            primary
            disabled={importing || selectedPendingIds.length === 0}
            onClick={() => void runImport(selectedPendingIds)}
            data-ltm-source-action="import-selected"
            data-ltm-source-selected-count={selectedPendingIds.length}
          >
            {importing ? (
              <Loader2 size="0.75rem" className="animate-spin" />
            ) : (
              <Check size="0.75rem" />
            )}
            Import selected
          </Button>
        </div>
        <div role="list" className="divide-y divide-[var(--border)]">
          {rows.map((row) => {
            const pending = row.status === "pending";
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
                    checked={pending && selectedIds.has(row.sourceId)}
                    disabled={!pending}
                    onChange={(event) =>
                      toggleSelected(row.sourceId, event.target.checked)
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
                        {row.status} {row.freshness}
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
                {row.status === "imported" ? (
                  <div
                    className="ml-7 space-y-2"
                    data-ltm-source-existing-note={row.existingNoteId}
                  >
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Source memory: {row.existingNoteTitle}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={importing}
                        onClick={() =>
                          void runImport([row.sourceId], "refresh")
                        }
                        data-ltm-source-action="refresh-reimport"
                      >
                        {importing ? (
                          <Loader2 size="0.75rem" className="animate-spin" />
                        ) : (
                          <RefreshCw size="0.75rem" />
                        )}{" "}
                        Refresh / re-import
                      </Button>
                    </div>
                    {sourceMemoryActions(row.existingNoteId)}
                  </div>
                ) : null}
              </article>
            );
          })}
          {!preview.isLoading && rows.length === 0 ? (
            <p className="p-4 text-xs text-[var(--muted-foreground)]">
              No importable{" "}
              {sourceTabs.find((tab) => tab.id === source)?.label.toLowerCase()}{" "}
              were found.
            </p>
          ) : null}
        </div>
      </div>

      {importResult ? (
        <section
          data-ltm-source-import-result={importResult.batchStatus}
          className="space-y-3 rounded-lg border border-[var(--border)] p-3"
        >
          <h2 className="text-sm font-semibold">
            Import result: {importResult.batchStatus}
          </h2>
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
