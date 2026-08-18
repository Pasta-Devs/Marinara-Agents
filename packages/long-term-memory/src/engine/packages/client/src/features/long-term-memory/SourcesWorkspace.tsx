import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Ellipsis,
  FileInput,
  Loader2,
  ListChecks,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import type {
  LtmImportSourceNotesResponse,
  LtmBulkNoteResult,
  LtmInteropPreviewResponse,
  LtmInteropPreviewSample,
  LtmLorebookPreviewEntry,
  LtmLorebookPreviewResponse,
  LtmMode,
  LtmNoteTransferApplyResponse,
  LtmNoteTransferPreviewResponse,
  LtmSourceDerivedMemoriesResponse,
  LtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { invalidateLtmQueries, queryKeys, request } from "./api";
import { Button, ClickSurface, IconButton, InfoPopover, StatusSurface, inputClass } from "./shared-controls";
import { humanizeLabel, labelKeys, localizedLabel, noteTypeLabel } from "./display-labels";
import type { LongTermMemoryDestinationProps, SourceTab } from "./types";
import { useLtmTranslation, type LtmTranslationFunction } from "./localization";
import { LtmWorkspace } from "./LtmWorkspace";
import type { LtmWorkspacePane } from "./LtmWorkspace";
import {
  buildScopeIndexes,
  deriveScopeBranches,
  deriveScopeConversations,
  type ScopeTargetChat,
  type ScopeTargets,
} from "./scope-targets";

type Source = SourceTab;
type FlatPanel = "available" | "imported";
type PreviewRow = LtmInteropPreviewResponse["samples"][number];
type LorebookCandidate = LtmInteropPreviewSample;
type SourceOperation = "copy" | "move" | "archive" | "delete";
type ImportContract = {
  source: Source;
  sourceIds: string[];
  action: "import" | "refresh";
  scope?: LtmScope;
  mode?: LtmMode;
  chatId?: string;
  selectionKey: string;
};

const sourceTabs: Array<{ id: Source; labelKey: string }> = [
  {
    id: "chats",
    labelKey: "ui.longTermMemory.sourcesworkspace.chatSummaries",
  },
  {
    id: "characters",
    labelKey: "ui.longTermMemory.sourcesworkspace.characters",
  },
  {
    id: "lorebooks",
    labelKey: "ui.longTermMemory.sourcesworkspace.lorebooks",
  },
];

const flatPanelTabs: Array<{ id: FlatPanel; labelKey: string }> = [
  {
    id: "available",
    labelKey: "ui.longTermMemory.sourcesworkspace.readyToImport",
  },
  {
    id: "imported",
    labelKey: "ui.longTermMemory.sourcesworkspace.alreadyImported",
  },
];
const importStatusLabelKeys: Record<string, string> = {
  created: "ui.longTermMemory.sourcesworkspace.statusCreated",
  refreshed: "ui.longTermMemory.sourcesworkspace.statusRefreshed",
  failed: "ui.longTermMemory.sourcesworkspace.statusFailed",
  succeeded: "ui.longTermMemory.sourcesworkspace.statusSucceeded",
  cancelled: "ui.longTermMemory.sourcesworkspace.statusCancelled",
  not_started: "ui.longTermMemory.sourcesworkspace.statusNotStarted",
  success: "ui.longTermMemory.sourcesworkspace.statusSuccess",
  partial_success: "ui.longTermMemory.sourcesworkspace.statusPartialSuccess",
  no_suggestions_created: "ui.longTermMemory.sourcesworkspace.statusNoSuggestionsCreated",
};

function resultTone(status: string): "neutral" | "success" | "warning" | "danger" {
  return status === "success" || status === "succeeded" || status === "created" || status === "refreshed"
    ? "success"
    : status === "failed" || status === "cancelled"
      ? "danger"
      : status === "partial_success" || status === "no_suggestions_created" || status === "not_started"
        ? "warning"
        : "neutral";
}

function resultToneClass(status: string) {
  const tone = resultTone(status);
  return tone === "success"
    ? "border border-[var(--border)] bg-[var(--marinara-editor-accent)]/15"
    : tone === "warning"
      ? "border border-[var(--marinara-editor-warning)]/40 text-[var(--marinara-editor-warning)]"
      : "border border-[var(--border)] bg-[var(--secondary)]";
}

function importStatusLabel(status: string, localizeUi: LtmTranslationFunction) {
  const key = importStatusLabelKeys[status];
  return key ? localizeUi(key) : humanizeLabel(status);
}

function freshnessLabel(freshness: LorebookCandidate["freshness"], localizeUi: LtmTranslationFunction) {
  if (freshness === "source_updated") return localizeUi("ui.longTermMemory.sourcesworkspace.updateAvailable");
  if (freshness === "context_updated") return localizeUi("ui.longTermMemory.sourcesworkspace.contextChanged");
  if (freshness === "extraction_incomplete")
    return localizeUi("ui.longTermMemory.sourcesworkspace.extractionIncomplete");
  if (freshness === "current") return localizeUi("ui.longTermMemory.sourcesworkspace.current");
  return localizeUi("ui.longTermMemory.sourcesworkspace.new");
}

function sourceStatusLabel(row: PreviewRow, localizeUi: LtmTranslationFunction) {
  return freshnessLabel(row.freshness, localizeUi);
}

function entryStatusLabel(entry: LtmLorebookPreviewEntry, localizeUi: LtmTranslationFunction) {
  const labels = new Set(entry.candidates.map((candidate) => freshnessLabel(candidate.freshness, localizeUi)));
  return labels.size === 1 ? [...labels][0] : localizeUi("ui.longTermMemory.sourcesworkspace.mixed");
}

function entryStatusToneClass(entry: LtmLorebookPreviewEntry) {
  const statusByFreshness: Record<LorebookCandidate["freshness"], string> = {
    new: "unknown",
    current: "success",
    source_updated: "partial_success",
    context_updated: "partial_success",
    extraction_incomplete: "partial_success",
  };
  const statuses = entry.candidates.map((candidate) => statusByFreshness[candidate.freshness]);
  return resultToneClass(
    statuses.includes("partial_success") ? "partial_success" : statuses.includes("unknown") ? "unknown" : "success",
  );
}

function extractionResultLabel(
  item: LtmImportSourceNotesResponse["imported"][number],
  localizeUi: LtmTranslationFunction,
) {
  if (item.extractionStatus === "not_started")
    return localizeUi("ui.longTermMemory.sourcesworkspace.sourceRefreshedExtractionNotRun");
  if (item.extractionStatus !== "succeeded")
    return localizeUi("ui.longTermMemory.sourcesworkspace.extractionDidNotFinish");
  if (item.outcome.state === "partial_success")
    return localizeUi("ui.longTermMemory.sourcesworkspace.readyForReviewWithRejectedSuggestions");
  if (item.outcome.state === "no_suggestions_created")
    return localizeUi("ui.longTermMemory.sourcesworkspace.noMemoriesSuggested");
  return localizeUi("ui.longTermMemory.sourcesworkspace.readyForReview");
}

function handleTabKey<T extends string>(
  event: KeyboardEvent<HTMLButtonElement>,
  ids: readonly T[],
  current: T,
  onChange: (id: T) => void,
  selector: string,
) {
  const index = ids.indexOf(current);
  if (index < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const nextIndex =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? ids.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length;
  const next = ids[nextIndex];
  onChange(next);
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[${selector}="${next}"]`)?.focus());
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
  const { t: localizeUi } = useLtmTranslation();
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
      aria-label={localizeUi("ui.longTermMemory.memoryvault.selectValue1", {
        value1: entry.name,
      })}
      data-ltm-lorebook-entry-select={entry.id}
    />
  );
}

function SourceOperationWorkbench({
  sourceNoteId,
  sourceTitle,
  destinations,
  confirmAction,
  onComplete,
}: {
  sourceNoteId: string;
  sourceTitle: string;
  destinations: ScopeTargetChat[];
  confirmAction?: LongTermMemoryDestinationProps["props"]["confirmAction"];
  onComplete: () => Promise<void>;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const [operation, setOperation] = useState<SourceOperation>("copy");
  const [destinationChatId, setDestinationChatId] = useState("");
  const [selectedLinkedIds, setSelectedLinkedIds] = useState<string[]>([]);
  const [initializedFor, setInitializedFor] = useState("");
  const [preview, setPreview] = useState<LtmNoteTransferPreviewResponse | null>(null);
  const [previewed, setPreviewed] = useState(false);
  const [previewLineageNoteIds, setPreviewLineageNoteIds] = useState<string[] | null>(null);
  const [result, setResult] = useState<{
    updated: string[];
    skipped: string[];
    deleted: string[];
    detached: string[];
    excluded: string[];
    failed: string[];
  } | null>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [error, setError] = useState("");
  const linked = useQuery({
    queryKey: [...queryKeys.notes, "source-operation", sourceNoteId],
    queryFn: () => request<LtmSourceDerivedMemoriesResponse>(`/notes/${encodeURIComponent(sourceNoteId)}/derived`),
  });
  const memories = linked.data?.memories ?? [];
  const selected = new Set(selectedLinkedIds);
  const selectedMemories = memories.filter((memory) => selected.has(memory.id));
  const excludedMemories = memories.filter((memory) => !selected.has(memory.id));
  const selectedIds = [sourceNoteId, ...selectedMemories.map((memory) => memory.id)];
  const titleFor = (id: string) =>
    id === sourceNoteId ? sourceTitle : (memories.find((memory) => memory.id === id)?.title ?? id);

  useEffect(() => {
    if (!linked.data || initializedFor === sourceNoteId) return;
    setSelectedLinkedIds(linked.data.memories.map((memory) => memory.id));
    setInitializedFor(sourceNoteId);
  }, [initializedFor, linked.data, sourceNoteId]);

  const resetPreview = () => {
    setPreview(null);
    setPreviewed(false);
    setPreviewLineageNoteIds(null);
    setResult(null);
    setError("");
  };
  const previewOperation = async () => {
    if ((operation === "copy" || operation === "move") && !destinationChatId) return;
    setBusy("preview");
    setError("");
    setResult(null);
    try {
      if (operation === "copy" || operation === "move") {
        setPreview(
          await request<LtmNoteTransferPreviewResponse>("/notes/transfer-preview", "POST", {
            noteIds: [sourceNoteId],
            derivedNoteIds: selectedLinkedIds,
            mode: operation,
            destinationChatId,
          }),
        );
      }
      if (operation === "delete") setPreviewLineageNoteIds([sourceNoteId, ...memories.map((memory) => memory.id)]);
      setPreviewed(true);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : localizeUi("ui.longTermMemory.sourceoperation.previewCouldNotLoad"),
      );
    } finally {
      setBusy(null);
    }
  };
  const apply = async () => {
    if (!previewed || busy || result) return;
    if (operation === "archive" || operation === "delete") {
      const options = {
        title: localizeUi(`ui.longTermMemory.sourceoperation.apply${operation[0].toUpperCase()}${operation.slice(1)}`),
        message: localizeUi(
          operation === "delete"
            ? "ui.longTermMemory.sourceoperation.confirmDelete"
            : "ui.longTermMemory.sourceoperation.confirmArchive",
          { count: selectedIds.length },
        ),
        confirmLabel: localizeUi(
          `ui.longTermMemory.sourceoperation.apply${operation[0].toUpperCase()}${operation.slice(1)}`,
        ),
        tone: operation === "delete" ? ("destructive" as const) : ("default" as const),
      };
      const confirmed = confirmAction
        ? await confirmAction(options)
        : window.confirm(
            localizeUi("ui.longTermMemory.longtermmemorydetail.confirmationWithMessage", {
              title: options.title,
              message: options.message,
            }),
          );
      if (!confirmed) return;
    }
    setBusy("apply");
    setError("");
    try {
      if ((operation === "copy" || operation === "move") && preview) {
        const ready = preview.buckets.ready;
        const applied = await request<LtmNoteTransferApplyResponse>("/notes/transfer", "POST", {
          requestedNoteIds: [sourceNoteId],
          derivedNoteIds: selectedLinkedIds,
          applyNoteIds: ready,
          mode: operation,
          destinationChatId,
        });
        setResult({
          updated: applied.updatedNoteIds,
          skipped: [...applied.skippedNoteIds, ...preview.buckets.noOp, ...preview.buckets.conflict],
          deleted: [],
          detached: [],
          excluded: excludedMemories.map((memory) => memory.id),
          failed: [],
        });
      } else if (operation === "archive") {
        const applied = await request<LtmBulkNoteResult>("/notes/batch", "POST", {
          noteIds: selectedIds,
          archive: "notes_only",
        });
        setResult({
          updated: applied.updatedNoteIds,
          skipped: applied.skippedNoteIds,
          deleted: [],
          detached: [],
          excluded: excludedMemories.map((memory) => memory.id),
          failed: applied.failedNoteIds,
        });
      } else if (operation === "delete") {
        const applied = await request<{
          deletedIds: string[];
          failedIds: string[];
          detachedNoteIds: string[];
        }>("/notes/permanent-delete", "POST", {
          ids: selectedIds,
          retractExtracted: true,
          excludedNoteIds: excludedMemories.map((memory) => memory.id),
          lineageSourceNoteId: sourceNoteId,
          expectedLineageNoteIds: previewLineageNoteIds ?? [sourceNoteId, ...memories.map((memory) => memory.id)],
        });
        setResult({
          updated: [],
          skipped: [],
          deleted: applied.deletedIds,
          detached: applied.detachedNoteIds,
          excluded: excludedMemories.map((memory) => memory.id),
          failed: applied.failedIds,
        });
      }
      await onComplete();
    } catch (error) {
      setError(error instanceof Error ? error.message : localizeUi("ui.longTermMemory.sourceoperation.couldNotApply"));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div
      id="ltm-source-operation-workbench"
      role="region"
      aria-labelledby="ltm-source-operation-heading"
      data-ltm-source-operation={operation}
      className="space-y-3 border-b border-[var(--border)] bg-[var(--secondary)]/20 p-3"
    >
      <div className="flex items-center gap-1">
        <h2 id="ltm-source-operation-heading" className="text-sm font-semibold">
          {localizeUi("ui.longTermMemory.sourceoperation.manageSource")}
        </h2>
        <InfoPopover
          label={localizeUi("ui.longTermMemory.sourceoperation.manageSource")}
          wide
          content={localizeUi("ui.longTermMemory.sourceoperation.description")}
        />
      </div>
      <label className="block space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
        {localizeUi("ui.longTermMemory.sourceoperation.operation")}
        <select
          value={operation}
          onChange={(event) => {
            setOperation(event.target.value as SourceOperation);
            resetPreview();
          }}
          className={inputClass}
          data-ltm-source-operation-select
        >
          {(["copy", "move", "archive", "delete"] as const).map((value) => (
            <option key={value} value={value}>
              {localizeUi(`ui.longTermMemory.sourceoperation.${value}`)}
            </option>
          ))}
        </select>
      </label>
      {operation === "copy" || operation === "move" ? (
        <label className="block space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
          {localizeUi("ui.longTermMemory.transferworkbench.destination")}
          <select
            value={destinationChatId}
            onChange={(event) => {
              setDestinationChatId(event.target.value);
              resetPreview();
            }}
            className={inputClass}
            data-ltm-source-operation-destination
          >
            <option value="" disabled>
              {localizeUi("ui.longTermMemory.transferworkbench.chooseDestination")}
            </option>
            {destinations.map((chat) => (
              <option key={chat.id} value={chat.id}>
                {chat.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="space-y-2" data-ltm-linked-memory-selection>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
          <span>{localizeUi("ui.longTermMemory.sourceoperation.linkedMemories")}</span>
          <span>
            {selectedLinkedIds.length} {localizeUi("ui.longTermMemory.memoryvault.selected")}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="mari-editor-action--compact"
            onClick={() => {
              setSelectedLinkedIds(memories.map((memory) => memory.id));
              resetPreview();
            }}
            disabled={!memories.length}
            data-ltm-source-operation-select-all
          >
            {localizeUi("ui.longTermMemory.sourceoperation.selectAll")}
          </Button>
          <Button
            className="mari-editor-action--compact"
            onClick={() => {
              setSelectedLinkedIds([]);
              resetPreview();
            }}
            disabled={!selectedLinkedIds.length}
            data-ltm-source-operation-clear-all
          >
            {localizeUi("ui.longTermMemory.sourceoperation.clearAll")}
          </Button>
        </div>
        {linked.isLoading ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.longTermMemory.sourceoperation.loadingLinkedMemories")}
          </p>
        ) : null}
        {memories.map((memory) => (
          <label
            key={memory.id}
            className="flex min-h-11 items-start gap-2 rounded border border-[var(--border)] bg-[var(--background)]/50 p-2 text-xs"
          >
            <input
              type="checkbox"
              checked={selected.has(memory.id)}
              onChange={(event) => {
                setSelectedLinkedIds((ids) =>
                  event.target.checked ? [...ids, memory.id] : ids.filter((id) => id !== memory.id),
                );
                resetPreview();
              }}
              data-ltm-source-operation-memory={memory.id}
            />
            <span className="min-w-0">
              <strong className="block truncate">{memory.title ?? memory.id}</strong>
              <span className="text-[var(--muted-foreground)]">
                {noteTypeLabel(memory.type, localizeUi)} · {localizedLabel(memory.status, localizeUi, labelKeys.status)}
              </span>
              <span className="block line-clamp-2 text-[var(--muted-foreground)]">{memory.previewText}</span>
            </span>
          </label>
        ))}
      </div>
      {error ? <StatusSurface tone="danger">{error}</StatusSurface> : null}
      <Button
        primary
        disabled={
          busy !== null || linked.isLoading || ((operation === "copy" || operation === "move") && !destinationChatId)
        }
        onClick={() => void previewOperation()}
        data-ltm-source-operation-action="preview"
      >
        {busy === "preview" ? (
          <Loader2 aria-hidden="true" size="0.75rem" className="animate-spin" />
        ) : (
          <Send aria-hidden="true" size="0.75rem" />
        )}
        {localizeUi("ui.longTermMemory.sourceoperation.preview")}
      </Button>
      {previewed ? (
        <div data-ltm-source-operation-preview className="space-y-2 text-xs">
          <p role="status">
            {localizeUi("ui.longTermMemory.sourceoperation.previewSummary", {
              selected: selectedMemories.length,
              excluded: excludedMemories.length,
            })}
          </p>
          {operation === "delete" && excludedMemories.length ? (
            <StatusSurface tone="warning">
              {localizeUi("ui.longTermMemory.sourceoperation.deleteDetachment", { count: excludedMemories.length })}
            </StatusSurface>
          ) : null}
          {operation === "delete" ? (
            <p className="text-[var(--muted-foreground)]">
              {localizeUi("ui.longTermMemory.sourceoperation.deleteLinks", {
                incoming: linked.data?.sourceIncomingLinkCount ?? 0,
                outgoing: linked.data?.sourceOutgoingLinkCount ?? 0,
              })}
            </p>
          ) : null}
          {operation === "archive" || operation === "delete" ? (
            <div role="list">
              {selectedIds.map((id) => (
                <p key={id} role="listitem" className="rounded bg-[var(--secondary)]/45 p-2">
                  {titleFor(id)}
                  {id === sourceNoteId
                    ? ""
                    : ` - ${localizeUi("ui.longTermMemory.sourceoperation.links", { incoming: memories.find((memory) => memory.id === id)?.incomingLinkCount ?? 0, outgoing: memories.find((memory) => memory.id === id)?.outgoingLinkCount ?? 0 })}`}
                </p>
              ))}
            </div>
          ) : null}
          {operation === "delete" && excludedMemories.length ? (
            <div role="list" data-ltm-source-operation-excluded>
              {excludedMemories.map((memory) => (
                <p key={memory.id} role="listitem" className="rounded bg-[var(--secondary)]/45 p-2">
                  {memory.title ?? memory.id} -{" "}
                  {localizeUi("ui.longTermMemory.sourceoperation.links", {
                    incoming: memory.incomingLinkCount,
                    outgoing: memory.outgoingLinkCount,
                  })}
                </p>
              ))}
            </div>
          ) : null}
          {preview?.items.map((item) => (
            <p
              key={item.noteId}
              data-ltm-source-operation-preview-item={item.classification}
              className="rounded bg-[var(--secondary)]/45 p-2"
            >
              <strong>{item.title}</strong>:{" "}
              {localizedLabel(item.classification, localizeUi, labelKeys.transferClassification)}
              {item.reason ? ` - ${item.reason}` : ""}
            </p>
          ))}
          <Button
            primary={operation !== "delete"}
            destructive={operation === "delete"}
            disabled={
              Boolean(result) ||
              busy !== null ||
              ((operation === "copy" || operation === "move") && !preview?.buckets.ready.length)
            }
            onClick={() => void apply()}
            data-ltm-source-operation-action="apply"
          >
            {busy === "apply" ? (
              <Loader2 aria-hidden="true" size="0.75rem" className="animate-spin" />
            ) : (
              <Check aria-hidden="true" size="0.75rem" />
            )}
            {localizeUi(`ui.longTermMemory.sourceoperation.apply${operation[0].toUpperCase()}${operation.slice(1)}`)}
          </Button>
        </div>
      ) : null}
      {result ? (
        <div data-ltm-source-operation-result={operation} className="space-y-2">
          <StatusSurface tone={result.failed.length ? "warning" : "success"}>
            {localizeUi("ui.longTermMemory.sourceoperation.resultSummary", {
              updated: result.updated.length,
              deleted: result.deleted.length,
              detached: result.detached.length,
              excluded: result.excluded.length,
              skipped: result.skipped.length,
              failed: result.failed.length,
            })}
          </StatusSurface>
          {[
            ...new Set([
              ...result.updated,
              ...result.deleted,
              ...result.detached,
              ...result.excluded,
              ...result.skipped,
              ...result.failed,
            ]),
          ].map((id) => (
            <p
              key={id}
              className="rounded bg-[var(--secondary)]/45 p-2 text-xs"
              data-ltm-source-operation-result-memory={id}
            >
              {titleFor(id)}:{" "}
              {result.deleted.includes(id)
                ? localizeUi("ui.longTermMemory.sourceoperation.deleted")
                : result.detached.includes(id)
                  ? localizeUi("ui.longTermMemory.sourceoperation.detached")
                  : result.updated.includes(id)
                    ? localizeUi("ui.longTermMemory.sourceoperation.updated")
                    : result.excluded.includes(id)
                      ? localizeUi("ui.longTermMemory.sourceoperation.excluded")
                      : result.failed.includes(id)
                        ? localizeUi("ui.longTermMemory.sourceoperation.failed")
                        : localizeUi("ui.longTermMemory.sourceoperation.skipped")}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function SourcesWorkspace({
  props,
  onOpenMemory,
  onOpenReview,
  requestedSource,
  onRequestedSourceHandled,
  selectedSource,
  onSourceChange,
}: LongTermMemoryDestinationProps) {
  const { t: localizeUi } = useLtmTranslation();
  const importScopeLabelId = useId();
  const importResultLabelId = useId();
  const client = useQueryClient();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectAllImportedRef = useRef<HTMLInputElement>(null);
  const importControllerRef = useRef<AbortController | null>(null);
  const [source, setSource] = useState<Source>(selectedSource ?? "chats");
  const [selectedLorebookId, setSelectedLorebookId] = useState<string | null>(null);
  const [lorebookMobilePane, setLorebookMobilePane] = useState<Exclude<LtmWorkspacePane, "inspector">>("navigator");
  const [importTargetId, setImportTargetId] = useState(props.chatId ? `chat:${props.chatId}` : "all");
  const [importCharacterId, setImportCharacterId] = useState<string | null>(null);
  const [modeFilter, setModeFilter] = useState<LtmMode | "all">("all");
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [flatPanel, setFlatPanel] = useState<FlatPanel>("available");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<LtmImportSourceNotesResponse | null>(null);
  const [importResultContract, setImportResultContract] = useState<ImportContract | null>(null);
  const [cancelledImport, setCancelledImport] = useState<ImportContract | null>(null);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState("");
  const [sourceOperation, setSourceOperation] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [openSourceActionId, setOpenSourceActionId] = useState<string | null>(null);

  const scopeTargets = useQuery({
    queryKey: [...queryKeys.scopeTargetsRoot, "all-chats", props.chatId],
    queryFn: () =>
      request<ScopeTargets>(
        `/scope-targets?includeAllChats=true${props.chatId ? `&chatId=${encodeURIComponent(props.chatId)}` : ""}`,
      ),
  });
  const scopeIndexes = useMemo(() => buildScopeIndexes(scopeTargets.data?.chats ?? []), [scopeTargets.data?.chats]);
  const importTargets = useMemo(
    () =>
      [
        ...(props.chatId
          ? [
              {
                id: `chat:${props.chatId}`,
                label: props.chatName ?? localizeUi("ui.longTermMemory.sourcesworkspace.currentChat"),
                scope: scopeTargets.data?.currentScope ?? {
                  chatId: props.chatId,
                  chatIds: [props.chatId],
                },
              },
            ]
          : []),
        ...(scopeTargets.data?.chats ?? []).map((chat) => ({
          id: `chat:${chat.id}`,
          label: chat.label,
          scope: { chatId: chat.id, chatIds: [chat.id] },
        })),
        ...(scopeTargets.data?.groups ?? []).map((group) => ({
          id: `group:${group.id}`,
          label: group.label,
          scope: {
            groupId: group.id,
            chatIds: group.chatIds,
          },
        })),
        ...(scopeTargets.data?.characters ?? []).map((character) => ({
          id: `character:${character.id}`,
          label: character.label,
          scope: {
            characterIds: [character.id],
            chatIds: (scopeIndexes.chatsByCharacterId.get(character.id) ?? []).map((chat) => chat.id),
          },
        })),
        {
          id: "all",
          label: localizeUi("ui.longTermMemory.sourcesworkspace.allAvailable"),
          scope: undefined,
        },
      ].filter((target, index, targets) => targets.findIndex((item) => item.id === target.id) === index),
    [
      localizeUi,
      props.chatId,
      props.chatName,
      scopeIndexes.chatsByCharacterId,
      scopeTargets.data?.characters,
      scopeTargets.data?.chats,
      scopeTargets.data?.currentScope,
      scopeTargets.data?.groups,
    ],
  );
  const importTarget = importTargets.find((target) => target.id === importTargetId) ?? importTargets.at(-1)!;
  const sourceScope = importTarget.scope;
  const effectiveImportScope = importTarget.id;
  const selectedImportChat =
    importTarget.id.startsWith("chat:") && sourceScope?.chatIds?.length === 1
      ? scopeIndexes.chatsById.get(sourceScope.chatIds[0])
      : undefined;
  const selectedImportGroupId = sourceScope?.groupId ?? selectedImportChat?.groupId ?? "";
  const selectedImportCharacterId = importCharacterId ?? selectedImportChat?.characterIds[0] ?? "";
  const selectedImportConversationId = selectedImportGroupId
    ? `group:${selectedImportGroupId}`
    : selectedImportChat
      ? `chat:${selectedImportChat.id}`
      : "";
  const importConversations = useMemo(
    () =>
      deriveScopeConversations(
        scopeTargets.data?.chats ?? [],
        scopeTargets.data?.groups ?? [],
        selectedImportCharacterId,
        scopeIndexes,
      ),
    [scopeIndexes, scopeTargets.data?.chats, scopeTargets.data?.groups, selectedImportCharacterId],
  );
  const selectedImportConversation = importConversations.find((item) => item.id === selectedImportConversationId);
  const importBranches = useMemo(
    () => deriveScopeBranches(selectedImportConversation, scopeIndexes),
    [scopeIndexes, selectedImportConversation],
  );
  const preview = useQuery({
    queryKey: [...queryKeys.preview, source, sourceScope, modeFilter],
    queryFn: () =>
      request<LtmInteropPreviewResponse, { source: Source; limit: number; scope?: LtmScope; mode?: LtmMode }>(
        "/import/preview",
        "POST",
        {
          source,
          limit: 100,
          ...(sourceScope ? { scope: sourceScope } : {}),
          ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
        },
      ),
    enabled: source !== "lorebooks",
  });
  const lorebookPreview = useQuery({
    queryKey: [...queryKeys.lorebookPreview, sourceScope, modeFilter],
    queryFn: () =>
      request<LtmLorebookPreviewResponse, { limit: number; scope?: LtmScope; mode?: LtmMode }>(
        "/import/lorebooks/preview",
        "POST",
        {
          limit: 100,
          ...(sourceScope ? { scope: sourceScope } : {}),
          ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
        },
      ),
    enabled: source === "lorebooks",
  });
  const rows = [...(preview.data?.samples ?? [])].sort((left, right) => {
    if (source !== "chats" || !props.chatId) return 0;
    return (
      Number(!left.sourceId.startsWith(`${props.chatId}:`)) - Number(!right.sourceId.startsWith(`${props.chatId}:`))
    );
  });
  const importedRows = rows.filter((row) => row.status === "imported");
  const selectionKey = `${source}:${effectiveImportScope}:${modeFilter}`;
  const selectedIds = new Set(selections[selectionKey] ?? []);
  const importedSelectionKey = `${selectionKey}:imported`;
  const selectedImportedIds = new Set(selections[importedSelectionKey] ?? []);
  const retryableIds = importResult
    ? [
        ...importResult.imported.filter((item) => item.retryable).map((item) => item.sourceId),
        ...importResult.writeFailures.filter((item) => item.retryable).map((item) => item.sourceId),
      ]
    : [];
  const retryableIdSet = new Set(retryableIds);
  const selectableRows = rows.filter((row) => row.status === "pending" || retryableIdSet.has(row.sourceId));
  const selectedSelectableIds = selectableRows
    .filter((row) => selectedIds.has(row.sourceId))
    .map((row) => row.sourceId);
  const allSelectableSelected = selectableRows.length > 0 && selectedSelectableIds.length === selectableRows.length;
  const selectedImportedRows = importedRows.filter((row) => selectedImportedIds.has(row.sourceId));
  const allImportedSelected = importedRows.length > 0 && selectedImportedRows.length === importedRows.length;
  const lorebookImportSelectionKey = `${selectionKey}:lorebook-import`;
  const lorebookRefreshSelectionKey = `${selectionKey}:lorebook-refresh`;
  const selectedLorebookImportIds = new Set(selections[lorebookImportSelectionKey] ?? []);
  const selectedLorebookRefreshIds = new Set(selections[lorebookRefreshSelectionKey] ?? []);
  const selectedLorebook = lorebookPreview.data?.books.find((book) => book.id === selectedLorebookId) ?? null;
  const selectedBookImportIds =
    selectedLorebook?.entries
      .flatMap((entry) => entry.candidates)
      .filter((candidate) => candidate.status === "pending" && selectedLorebookImportIds.has(candidate.sourceId))
      .map((candidate) => candidate.sourceId) ?? [];
  const selectedBookRefreshIds =
    selectedLorebook?.entries
      .flatMap((entry) => entry.candidates)
      .filter((candidate) => candidate.status === "imported" && selectedLorebookRefreshIds.has(candidate.sourceId))
      .map((candidate) => candidate.sourceId) ?? [];
  const selectedLorebookCandidateIds = new Set([...selectedLorebookImportIds, ...selectedLorebookRefreshIds]);
  const activeFlatRows = flatPanel === "available" ? selectableRows : importedRows;
  const activeFlatSelection = flatPanel === "available" ? selectedIds : selectedImportedIds;
  const activeFlatSelectedIds =
    flatPanel === "available" ? selectedSelectableIds : selectedImportedRows.map((row) => row.sourceId);
  const activeFlatAllSelected = flatPanel === "available" ? allSelectableSelected : allImportedSelected;
  const pendingDraftsProduced = Boolean(
    importResult?.imported.some((item) => item.extractionStatus === "succeeded" && item.draft?.status === "pending"),
  );
  const proposalCount =
    importResult?.imported.reduce((count, item) => count + (item.draft?.mutations.length ?? 0), 0) ?? 0;
  const importResultMessage = !importResult
    ? ""
    : importResult.counts.sourceNotesWritten === 0
      ? localizeUi("ui.longTermMemory.sourcesworkspace.importFailedBeforeSaving")
      : importResultContract?.action === "refresh" &&
          !importResult.counts.failed &&
          !importResult.counts.cancelled &&
          !importResult.counts.missing &&
          !importResult.counts.sourceWriteFailed
        ? localizeUi("ui.longTermMemory.sourcesworkspace.sourceRefreshedExtractionNotRun")
        : importResultContract?.action === "refresh"
          ? localizeUi("ui.longTermMemory.sourcesworkspace.sourceRefreshCompletedWithFailures")
          : importResult.counts.failed || importResult.counts.cancelled
            ? localizeUi("ui.longTermMemory.sourcesworkspace.sourceSavedExtractionFailed")
            : proposalCount
              ? localizeUi("ui.longTermMemory.sourcesworkspace.sourceSavedProposalsReady", {
                  count: proposalCount,
                })
              : localizeUi("ui.longTermMemory.sourcesworkspace.sourceSavedNoProposals");

  useEffect(() => {
    if (!importTargets.some((target) => target.id === importTargetId))
      setImportTargetId(props.chatId ? `chat:${props.chatId}` : "all");
  }, [importTargetId, importTargets, props.chatId]);

  useEffect(() => {
    setImportTargetId(props.chatId ? `chat:${props.chatId}` : "all");
    setImportCharacterId(null);
  }, [props.chatId]);

  useEffect(() => {
    if (!requestedSource) return;
    changeSource(requestedSource.source);
    onRequestedSourceHandled?.();
  }, [onRequestedSourceHandled, requestedSource?.key]);

  useEffect(() => {
    if (selectedSource) setSource(selectedSource);
  }, [selectedSource]);

  useEffect(() => () => importControllerRef.current?.abort(), []);

  useEffect(() => {
    if (source !== "lorebooks" || !lorebookPreview.data) return;
    if (selectedLorebookId && lorebookPreview.data.books.some((book) => book.id === selectedLorebookId)) return;
    setSelectedLorebookId(lorebookPreview.data.books[0]?.id ?? null);
  }, [lorebookPreview.data, selectedLorebookId, source]);

  useEffect(() => {
    if (selectAllRef.current)
      selectAllRef.current.indeterminate = selectedSelectableIds.length > 0 && !allSelectableSelected;
  }, [allSelectableSelected, selectedSelectableIds.length]);

  useEffect(() => {
    if (selectAllImportedRef.current)
      selectAllImportedRef.current.indeterminate = selectedImportedRows.length > 0 && !allImportedSelected;
  }, [allImportedSelected, selectedImportedRows.length]);

  const invalidateAfterMutation = async () => {
    await invalidateLtmQueries(client, [
      queryKeys.notes,
      queryKeys.scopeTargetsRoot,
      queryKeys.status,
      queryKeys.integrity,
      queryKeys.review,
      queryKeys.pendingDrafts,
      queryKeys.rejectedSuggestions,
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
    setSourceOperation(null);
  };

  const changeSource = (next: Source) => {
    setSource(next);
    onSourceChange?.(next);
    if (next === "lorebooks") setLorebookMobilePane("navigator");
    clearImportResult();
  };

  const changeImportScope = (next: string) => {
    setImportTargetId(next);
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

  const toggleLorebookCandidates = (candidates: LorebookCandidate[], checked: boolean) => {
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
      setImportError(localizeUi("ui.longTermMemory.sourcesworkspace.selectUpTo100SourceParts"));
      return;
    }
    const effectiveAction = retryContract?.action ?? action;
    const contract: ImportContract = retryContract
      ? { ...retryContract, sourceIds: ids, action: effectiveAction }
      : {
          source,
          sourceIds: ids,
          action: effectiveAction,
          ...(sourceScope
            ? {
                scope: {
                  ...sourceScope,
                  ...(sourceScope.chatIds ? { chatIds: [...sourceScope.chatIds] } : {}),
                  ...(sourceScope.characterIds ? { characterIds: [...sourceScope.characterIds] } : {}),
                },
              }
            : {}),
          ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
          ...(sourceScope?.chatId ? { chatId: sourceScope.chatId } : {}),
          selectionKey: selectionKeyOverride ?? selectionKey,
        };
    setImporting(true);
    setImportResultContract(contract);
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
          extract: contract.action !== "refresh",
          ...(contract.scope ? { scope: contract.scope } : {}),
          ...(contract.mode ? { mode: contract.mode } : {}),
          ...(contract.chatId ? { chatId: contract.chatId } : {}),
        },
        controller.signal,
      );
      setImportResult(result);
      setImportResultContract(contract);
      const failedIds = [
        ...result.imported.filter((item) => item.retryable).map((item) => item.sourceId),
        ...result.writeFailures.map((item) => item.sourceId),
      ];
      setSelections((current) => ({
        ...current,
        [contract.selectionKey]: failedIds,
      }));
      setImporting(false);
      void invalidateAfterMutation().catch(() => undefined);
      void (contract.source === "lorebooks" ? lorebookPreview.refetch() : preview.refetch()).catch(() => undefined);
      if (
        contract.action === "refresh" &&
        !result.counts.failed &&
        !result.counts.cancelled &&
        !result.counts.missing &&
        !result.counts.sourceWriteFailed
      )
        setReviewMessage(localizeUi("ui.longTermMemory.sourcesworkspace.sourceRefreshedRerunExtraction"));
    } catch (error) {
      const cancelled = controller.signal.aborted;
      if (cancelled) setCancelledImport(contract);
      setImportError(
        cancelled
          ? localizeUi("ui.longTermMemory.sourcesworkspace.importCancelledSelectionRetained")
          : error instanceof Error
            ? error.message
            : localizeUi("ui.longTermMemory.sourcesworkspace.sourcesCouldNotBeImported"),
      );
    } finally {
      if (importControllerRef.current === controller) importControllerRef.current = null;
      setImporting(false);
    }
  };

  const reextract = async (noteId: string) => {
    if (extractingId) return;
    setExtractingId(noteId);
    setImportError("");
    try {
      await request(`/notes/${encodeURIComponent(noteId)}/extract`, "POST", {});
      setReviewMessage(localizeUi("ui.longTermMemory.sourcesworkspace.extractionCompletedReviewReady"));
      await invalidateAfterMutation();
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : localizeUi("ui.longTermMemory.sourcesworkspace.sourceCouldNotBeReextracted"),
      );
    } finally {
      setExtractingId(null);
    }
  };

  const stopRowAction = (event: { preventDefault: () => void; stopPropagation: () => void }) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const toggleSourceActions = (event: { preventDefault: () => void; stopPropagation: () => void }, noteId: string) => {
    stopRowAction(event);
    setOpenSourceActionId((current) => (current === noteId ? null : noteId));
  };

  const sourceInlineActions = (noteId: string, title: string) => (
    <>
      <div className="hidden items-start gap-1 opacity-0 transition-opacity pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto group-hover:opacity-100 group-focus-within:opacity-100 md:flex">
        <IconButton
          icon={extractingId === noteId ? Loader2 : Sparkles}
          label={localizeUi("ui.longTermMemory.sourcesworkspace.reExtractValue1", { value1: title })}
          disabled={extractingId !== null}
          onClick={(event) => {
            stopRowAction(event);
            setOpenSourceActionId(null);
            void reextract(noteId);
          }}
          data-ltm-source-action="re-extract"
          data-ltm-source-note-id={noteId}
          className={extractingId === noteId ? "[&>svg]:animate-spin" : ""}
        />
        <IconButton
          icon={BookOpen}
          label={localizeUi("ui.longTermMemory.sourcesworkspace.reviewDraftsForValue1", { value1: title })}
          onClick={(event) => {
            stopRowAction(event);
            setOpenSourceActionId(null);
            onOpenReview?.(noteId);
          }}
          data-ltm-review-query={noteId}
        />
        <IconButton
          icon={ListChecks}
          label={localizeUi("ui.longTermMemory.sourceoperation.manageValue1", {
            value1: title,
          })}
          onClick={(event) => {
            stopRowAction(event);
            setSourceOperation({ id: noteId, title });
          }}
          data-ltm-source-action="manage"
          data-ltm-source-note-id={noteId}
        />
      </div>
      <div className="flex items-start gap-1 md:hidden">
        {openSourceActionId === noteId ? (
          <>
            <IconButton
              icon={extractingId === noteId ? Loader2 : Sparkles}
              label={localizeUi("ui.longTermMemory.sourcesworkspace.reExtractValue1", { value1: title })}
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
              label={localizeUi("ui.longTermMemory.sourcesworkspace.reviewDraftsForValue1", { value1: title })}
              onClick={(event) => {
                stopRowAction(event);
                setOpenSourceActionId(null);
                onOpenReview?.(noteId);
              }}
            />
            <IconButton
              icon={ListChecks}
              label={localizeUi("ui.longTermMemory.sourceoperation.manageValue1", { value1: title })}
              onClick={(event) => {
                stopRowAction(event);
                setOpenSourceActionId(null);
                setSourceOperation({ id: noteId, title });
              }}
              data-ltm-source-action="manage"
            />
          </>
        ) : null}
        <IconButton
          icon={Ellipsis}
          label={localizeUi("ui.longTermMemory.sourcesworkspace.moreActionsForValue1", { value1: title })}
          aria-expanded={openSourceActionId === noteId}
          onClick={(event) => toggleSourceActions(event, noteId)}
        />
      </div>
    </>
  );

  return (
    <section
      data-ltm-surface="sources"
      data-ltm-import-status={importing ? "pending" : "idle"}
      data-ltm-extraction-status={extractingId ? "pending" : "idle"}
      data-ltm-extraction-note-id={extractingId ?? undefined}
      className="space-y-4"
    >
      <style>{`
        @container ltm-destination (min-width: 48rem) {
          [data-ltm-import-scope-fields] {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @container ltm-destination (min-width: 72rem) {
          [data-ltm-import-scope-fields] {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
      `}</style>
      {sourceOperation ? (
        <SourceOperationWorkbench
          key={sourceOperation.id}
          sourceNoteId={sourceOperation.id}
          sourceTitle={sourceOperation.title}
          destinations={scopeTargets.data?.chats ?? []}
          confirmAction={props.confirmAction}
          onComplete={async () => {
            await invalidateAfterMutation();
            await (source === "lorebooks" ? lorebookPreview.refetch() : preview.refetch());
          }}
        />
      ) : null}
      <div
        className="mari-editor-tab-rail flex flex-wrap gap-1 rounded-lg border p-1"
        role="tablist"
        aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.sourceTypes")}
      >
        {sourceTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`ltm-source-tab-${tab.id}`}
            tabIndex={source === tab.id ? 0 : -1}
            aria-selected={source === tab.id}
            aria-controls={source === tab.id ? `ltm-source-preview-${tab.id}` : undefined}
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
            data-active={source === tab.id}
            className="mari-editor-tab min-h-11 rounded-lg border px-3 text-xs font-semibold"
          >
            {localizeUi(tab.labelKey)}
          </button>
        ))}
      </div>
      <div className="mari-editor-panel mari-editor-panel--soft flex flex-wrap items-center gap-3 p-3">
        <div
          role="group"
          aria-labelledby={importScopeLabelId}
          className="flex min-h-11 w-full flex-col gap-2 text-xs font-medium sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-2 sm:shrink-0">
            <span id={importScopeLabelId}>{localizeUi("ui.longTermMemory.sourcesworkspace.importScope")}</span>
            <InfoPopover
              label={localizeUi("ui.longTermMemory.sourcesworkspace.importScope")}
              content={
                effectiveImportScope === "all"
                  ? localizeUi("ui.longTermMemory.sourcesworkspace.searchEveryAvailableCharacterLorebookChatAndBranch")
                  : localizeUi("ui.longTermMemory.sourcesworkspace.limitImportsToThisChatAndItsRelatedScope")
              }
            />
          </div>
          <div data-ltm-import-scope-fields className="grid min-w-0 flex-1 grid-cols-1 gap-2">
            <label className="min-w-0 space-y-1">
              <span>{localizeUi("ui.longTermMemory.sourcesworkspace.character")}</span>
              <select
                className={inputClass}
                value={selectedImportCharacterId}
                onChange={(event) => {
                  setImportCharacterId(event.target.value);
                  changeImportScope(event.target.value ? `character:${event.target.value}` : "all");
                }}
                data-ltm-import-character
              >
                <option value="">{localizeUi("ui.longTermMemory.sourcesworkspace.allCharacters")}</option>
                {(scopeTargets.data?.characters ?? []).map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 space-y-1">
              <span>{localizeUi("ui.longTermMemory.sourcesworkspace.chat")}</span>
              <select
                className={inputClass}
                value={selectedImportConversationId}
                onChange={(event) => {
                  setImportCharacterId(selectedImportCharacterId || null);
                  changeImportScope(
                    event.target.value ||
                      (selectedImportCharacterId ? `character:${selectedImportCharacterId}` : "all"),
                  );
                }}
                data-ltm-import-chat
              >
                <option value="">{localizeUi("ui.longTermMemory.sourcesworkspace.allChats")}</option>
                {importConversations.map((conversation) => (
                  <option key={conversation.id} value={conversation.id}>
                    {conversation.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 space-y-1">
              <span>{localizeUi("ui.longTermMemory.sourcesworkspace.branch")}</span>
              <select
                className={inputClass}
                value={selectedImportChat?.id ?? ""}
                disabled={!selectedImportConversation}
                onChange={(event) => {
                  setImportCharacterId(selectedImportCharacterId || null);
                  changeImportScope(event.target.value ? `chat:${event.target.value}` : selectedImportConversationId);
                }}
                data-ltm-import-branch
              >
                <option value="">{localizeUi("ui.longTermMemory.sourcesworkspace.allBranches")}</option>
                {importBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          className="text-xs text-[var(--muted-foreground)]"
          data-ltm-source-preview-status={source === "lorebooks" ? lorebookPreview.status : preview.status}
          role="status"
          aria-live="polite"
        >
          {source === "lorebooks"
            ? lorebookPreview.data
              ? localizeUi("ui.longTermMemory.sourcesworkspace.value1LorebooksValue2EntriesValue3Imported", {
                  value1: lorebookPreview.data.counts.books,
                  value2: lorebookPreview.data.counts.entries,
                  value3: lorebookPreview.data.counts.imported,
                })
              : localizeUi("ui.longTermMemory.sourcesworkspace.loadingLorebooks")
            : preview.data
              ? localizeUi("ui.longTermMemory.sourcesworkspace.value1ScannedValue2PendingValue3Imported", {
                  value1: preview.data.scanned,
                  value2: preview.data.draftable,
                  value3: preview.data.importedCount,
                })
              : localizeUi("ui.longTermMemory.sourcesworkspace.loadingSourcePreview")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-11 items-center gap-2 text-xs font-medium">
            {localizeUi("ui.longTermMemory.transferworkbench.mode")}
            <select
              className={`${inputClass} w-36`}
              value={modeFilter}
              onChange={(event) => changeModeFilter(event.target.value as LtmMode | "all")}
              aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.filterSourcesByMode")}
            >
              <option value="all">{localizeUi("ui.longTermMemory.sourcesworkspace.all")}</option>
              <option value="game">{localizeUi("ui.longTermMemory.sourcesworkspace.game")}</option>
              <option value="conversation">{localizeUi("ui.longTermMemory.sourcesworkspace.conversation")}</option>
              <option value="roleplay">{localizeUi("ui.longTermMemory.sourcesworkspace.roleplay")}</option>
            </select>
          </label>
          {source !== "chats" && modeFilter === "all" ? (
            <p
              role="note"
              data-ltm-import-mode-policy
              className="max-w-[42rem] text-xs text-[var(--marinara-editor-warning)]"
            >
              {localizeUi("ui.longTermMemory.sourcesworkspace.importsDefaultToRoleplay")}
            </p>
          ) : null}
          <Button
            disabled={source === "lorebooks" ? lorebookPreview.isFetching : preview.isFetching}
            onClick={() => void (source === "lorebooks" ? lorebookPreview.refetch() : preview.refetch())}
            data-ltm-source-action="refresh-preview"
          >
            {(source === "lorebooks" ? lorebookPreview.isFetching : preview.isFetching) ? (
              <Loader2 aria-hidden="true" size="0.75rem" className="animate-spin" />
            ) : (
              <RefreshCw aria-hidden="true" size="0.75rem" />
            )}
            {localizeUi("ui.longTermMemory.sourcesworkspace.refreshPreview")}
          </Button>
        </div>
      </div>

      {(source === "lorebooks" ? lorebookPreview.isError : preview.isError) ? (
        <StatusSurface tone="danger">
          {(source === "lorebooks" ? lorebookPreview.error : preview.error) instanceof Error
            ? (source === "lorebooks" ? lorebookPreview.error : preview.error).message
            : source === "lorebooks"
              ? localizeUi("ui.longTermMemory.sourcesworkspace.lorebooksCouldNotLoad")
              : localizeUi("ui.longTermMemory.sourcesworkspace.sourcePreviewCouldNotLoad")}
        </StatusSurface>
      ) : null}
      {importError ? (
        <StatusSurface tone="danger">
          {importError}
          {cancelledImport ? (
            <Button
              onClick={() => void runImport(cancelledImport.sourceIds, "import", cancelledImport)}
              disabled={importing}
              data-ltm-source-action="retry-cancelled"
            >
              <RefreshCw aria-hidden="true" size="0.75rem" />
              {localizeUi("ui.longTermMemory.sourcesworkspace.retryOriginalSelection", {
                count: cancelledImport.sourceIds.length,
              })}
            </Button>
          ) : null}
        </StatusSurface>
      ) : null}
      {reviewMessage ? <StatusSurface tone="success">{reviewMessage}</StatusSurface> : null}
      {!reviewMessage && !importResult && !importError ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.longTermMemory.sourcesworkspace.importExplanation")}{" "}
          {localizeUi("ui.longTermMemory.sourcesworkspace.refreshExplanation")}
        </p>
      ) : null}
      {importing ? (
        <p role="status" className="text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.longTermMemory.sourcesworkspace.savingAndExtracting", {
            count: importResultContract?.sourceIds.length ?? 0,
          })}
        </p>
      ) : null}

      {source === "lorebooks" ? (
        <div
          id="ltm-source-preview-lorebooks"
          role="tabpanel"
          aria-labelledby="ltm-source-tab-lorebooks"
          data-ltm-source-preview="lorebooks"
          data-ltm-lorebook-browser
          className="space-y-3"
        >
          <LtmWorkspace
            activeMobilePane={lorebookMobilePane}
            onMobilePaneChange={(pane) => {
              if (pane !== "inspector") setLorebookMobilePane(pane);
            }}
            switcherLabel={localizeUi("ui.longTermMemory.longtermmemorynavigation.workspacePanes")}
            navigator={{
              label: localizeUi("ui.longTermMemory.sourcesworkspace.lorebooks"),
              content: (
                <section data-ltm-lorebook-list className="mari-editor-panel overflow-hidden">
                  <div className="flex min-h-11 items-center justify-between gap-3 bg-[var(--secondary)]/45 px-3 py-2">
                    <h2 className="text-sm font-semibold">
                      {localizeUi("ui.longTermMemory.sourcesworkspace.lorebooks")}
                    </h2>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {lorebookPreview.data?.books.length ?? 0}
                    </span>
                  </div>
                  <div role="list" className="divide-y divide-[var(--border)]">
                    {(lorebookPreview.data?.books ?? []).map((book) => (
                      <div key={book.id} role="listitem">
                        <button
                          type="button"
                          aria-current={selectedLorebookId === book.id || undefined}
                          data-ltm-lorebook-id={book.id}
                          onClick={() => {
                            setSelectedLorebookId(book.id);
                            setLorebookMobilePane("workbench");
                          }}
                          className={`flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--secondary)]/35 ${selectedLorebookId === book.id ? "bg-[var(--primary)]/10" : ""}`}
                        >
                          <BookOpen
                            aria-hidden="true"
                            size="1rem"
                            className="shrink-0 text-[var(--muted-foreground)]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{book.name}</span>
                            <span className="block text-xs text-[var(--muted-foreground)]">
                              {book.category} · {book.counts.entries}{" "}
                              {localizeUi("ui.longTermMemory.sourcesworkspace.entries")} {book.counts.imported}{" "}
                              {localizeUi("ui.longTermMemory.sourcesworkspace.imported")}
                            </span>
                          </span>
                          <ChevronRight
                            aria-hidden="true"
                            size="0.875rem"
                            className="shrink-0 text-[var(--muted-foreground)]"
                          />
                        </button>
                      </div>
                    ))}
                    {!lorebookPreview.isLoading && lorebookPreview.data?.books.length === 0 ? (
                      <p className="p-4 text-xs text-[var(--muted-foreground)]">
                        {localizeUi("ui.longTermMemory.sourcesworkspace.noLorebooksAreAvailableInThisScope")}
                      </p>
                    ) : null}
                  </div>
                </section>
              ),
            }}
            workbench={{
              label: localizeUi("ui.longTermMemory.sourcesworkspace.entries"),
              disabled: !selectedLorebook,
              content: (
                <section
                  data-ltm-lorebook-workbench={selectedLorebook?.id ?? "empty"}
                  className="mari-editor-panel overflow-hidden"
                >
                  {selectedLorebook ? (
                    <>
                      <header className="space-y-2 border-b border-[var(--border)] bg-[var(--secondary)]/25 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="text-base font-semibold">{selectedLorebook.name}</h2>
                            <p className="text-xs text-[var(--muted-foreground)]">
                              {selectedLorebook.category} · {selectedLorebook.counts.entries}{" "}
                              {localizeUi("ui.longTermMemory.sourcesworkspace.entries")}{" "}
                              {selectedLorebook.counts.candidates}{" "}
                              {localizeUi("ui.longTermMemory.sourcesworkspace.sourceParts")}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              primary
                              disabled={importing || selectedBookImportIds.length === 0}
                              onClick={() =>
                                void runImport(selectedBookImportIds, "import", undefined, lorebookImportSelectionKey)
                              }
                              data-ltm-lorebook-action="import-selected"
                            >
                              <Check aria-hidden="true" size="0.75rem" />{" "}
                              {localizeUi("ui.longTermMemory.sourcesworkspace.importSelectedCount", {
                                count: selectedBookImportIds.length,
                              })}
                            </Button>
                            <Button
                              disabled={importing || selectedBookRefreshIds.length === 0}
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
                              <RefreshCw aria-hidden="true" size="0.75rem" />{" "}
                              {localizeUi("ui.longTermMemory.sourcesworkspace.refreshSelectedSourcesCount", {
                                count: selectedBookRefreshIds.length,
                              })}
                            </Button>
                            {importing ? (
                              <Button
                                destructive
                                onClick={() => importControllerRef.current?.abort()}
                                data-ltm-lorebook-action="cancel-import"
                              >
                                {localizeUi("ui.longTermMemory.memoryvault.cancel")}
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
                          <p className="text-xs text-[var(--muted-foreground)]">{selectedLorebook.tags.join(", ")}</p>
                        ) : null}
                      </header>

                      <div role="list" className="divide-y divide-[var(--border)]">
                        {selectedLorebook.entries.map((entry) => {
                          const candidateIds = entry.candidates.map((candidate) => candidate.sourceId),
                            selectedCount = candidateIds.filter((id) => selectedLorebookCandidateIds.has(id)).length;
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
                                  checked={candidateIds.length > 0 && selectedCount === candidateIds.length}
                                  indeterminate={selectedCount > 0 && selectedCount < candidateIds.length}
                                  onChange={(checked) => toggleLorebookCandidates(entry.candidates, checked)}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-sm font-semibold">{entry.name}</h3>
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[0.625rem] font-semibold uppercase ${entryStatusToneClass(entry)}`}
                                    >
                                      {entryStatusLabel(entry, localizeUi)}
                                    </span>
                                    {entry.candidateCount > 1 ? (
                                      <span className="text-xs text-[var(--muted-foreground)]">
                                        {entry.candidateCount} {localizeUi("ui.longTermMemory.sourcesworkspace.parts")}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 whitespace-pre-wrap break-words text-xs text-[var(--muted-foreground)]">
                                    {entry.candidates[0]?.snippet}
                                  </p>
                                </div>
                              </div>
                              <div role="list" className="space-y-2">
                                {entry.candidates.map((candidate) => (
                                  <ClickSurface
                                    key={candidate.sourceId}
                                    role="listitem"
                                    className="group ml-7 space-y-2"
                                    data-ltm-source-existing-note={candidate.existingNoteId}
                                    data-ltm-source-actions-open={
                                      openSourceActionId === candidate.existingNoteId || undefined
                                    }
                                  >
                                    <div className="flex items-start gap-2">
                                      {candidate.status === "pending" ? (
                                        <IconButton
                                          icon={importing ? Loader2 : FileInput}
                                          label={localizeUi("ui.longTermMemory.sourcesworkspace.importValue1", {
                                            value1: candidate.title,
                                          })}
                                          disabled={importing}
                                          onClick={(event) => {
                                            stopRowAction(event);
                                            void runImport([candidate.sourceId]);
                                          }}
                                          className={importing ? "[&>svg]:animate-spin" : ""}
                                          data-ltm-source-action="import"
                                          data-ltm-source-id={candidate.sourceId}
                                        />
                                      ) : null}
                                      {candidate.status !== "imported" ? null : (
                                        <>
                                          <button
                                            type="button"
                                            data-ltm-source-memory-id={candidate.existingNoteId}
                                            aria-label={localizeUi(
                                              "ui.longTermMemory.sourcesworkspace.openSourceMemoryValue1",
                                              {
                                                value1: candidate.existingNoteTitle,
                                              },
                                            )}
                                            className="inline-flex min-h-11 flex-1 items-center text-left text-xs font-semibold text-[var(--primary)] underline underline-offset-2"
                                            onClick={() => onOpenMemory?.(candidate.existingNoteId)}
                                          >
                                            {localizeUi("ui.longTermMemory.sourcesworkspace.sourceMemory")}{" "}
                                            {candidate.existingNoteTitle}
                                          </button>
                                          {sourceInlineActions(candidate.existingNoteId, candidate.existingNoteTitle)}
                                        </>
                                      )}
                                    </div>
                                  </ClickSurface>
                                ))}
                              </div>
                            </article>
                          );
                        })}
                        {selectedLorebook.entries.length === 0 ? (
                          <p className="p-4 text-xs text-[var(--muted-foreground)]">
                            {localizeUi("ui.longTermMemory.sourcesworkspace.thisLorebookHasNoImportableEntries")}
                          </p>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className="p-4 text-xs text-[var(--muted-foreground)]">
                      {localizeUi("ui.longTermMemory.sourcesworkspace.selectALorebookToInspectItsEntries")}
                    </p>
                  )}
                </section>
              ),
            }}
          />
        </div>
      ) : (
        <section
          id={`ltm-source-preview-${source}`}
          role="tabpanel"
          aria-labelledby={`ltm-source-tab-${source}`}
          data-ltm-source-preview={source}
          className="mari-editor-panel overflow-hidden"
        >
          <div
            role="tablist"
            aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.sourceStatus")}
            className="mari-editor-tab-rail flex border-b p-1"
          >
            {flatPanelTabs.map((tab) => {
              const count = tab.id === "available" ? selectableRows.length : importedRows.length;
              return (
                <button
                  key={tab.id}
                  id={`ltm-source-panel-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  tabIndex={flatPanel === tab.id ? 0 : -1}
                  aria-selected={flatPanel === tab.id}
                  aria-controls={flatPanel === tab.id ? `ltm-source-panel-${tab.id}` : undefined}
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
                  data-active={flatPanel === tab.id}
                  className="mari-editor-tab min-h-11 flex-1 rounded-md px-3 text-xs font-semibold"
                >
                  {localizeUi(tab.labelKey)} ({count})
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
                ref={flatPanel === "available" ? selectAllRef : selectAllImportedRef}
                type="checkbox"
                aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.selectAllValue1", {
                  value1:
                    flatPanel === "available"
                      ? localizeUi("ui.longTermMemory.sourcesworkspace.readyToImport")
                      : localizeUi("ui.longTermMemory.sourcesworkspace.alreadyImported"),
                })}
                checked={activeFlatAllSelected}
                disabled={activeFlatRows.length === 0}
                onChange={(event) =>
                  setSelections((current) => ({
                    ...current,
                    [flatPanel === "available" ? selectionKey : importedSelectionKey]: event.target.checked
                      ? activeFlatRows.map((row) => row.sourceId)
                      : [],
                  }))
                }
                data-ltm-source-select-all={flatPanel}
              />
              <span>
                {activeFlatSelectedIds.length} {localizeUi("ui.longTermMemory.memoryvault.selected")}
              </span>
              {flatPanel === "available" ? (
                <Button
                  primary
                  disabled={importing || activeFlatSelectedIds.length === 0}
                  onClick={() => void runImport(activeFlatSelectedIds)}
                  data-ltm-source-action="import-selected"
                  data-ltm-source-selected-count={activeFlatSelectedIds.length}
                >
                  {importing ? (
                    <Loader2 aria-hidden="true" size="0.75rem" className="animate-spin" />
                  ) : (
                    <Check aria-hidden="true" size="0.75rem" />
                  )}
                  {localizeUi("ui.longTermMemory.sourcesworkspace.importSelected_7fb57e8")}
                </Button>
              ) : (
                <>
                  <Button
                    disabled={importing || activeFlatSelectedIds.length === 0}
                    onClick={() => void runImport(activeFlatSelectedIds, "refresh")}
                    data-ltm-source-action="refresh-selected"
                    data-ltm-source-selected-count={activeFlatSelectedIds.length}
                  >
                    <RefreshCw aria-hidden="true" size="0.75rem" />{" "}
                    {localizeUi("ui.longTermMemory.sourcesworkspace.refreshSelectedSources")}
                  </Button>
                </>
              )}
              {importing && flatPanel === "available" ? (
                <Button
                  destructive
                  onClick={() => importControllerRef.current?.abort()}
                  data-ltm-source-action="cancel-import"
                >
                  {localizeUi("ui.longTermMemory.memoryvault.cancel")}
                </Button>
              ) : null}
            </div>
            <div role="list" className="divide-y divide-[var(--border)]">
              {activeFlatRows.map((row) => (
                <ClickSurface
                  key={row.sourceId}
                  role="listitem"
                  data-ltm-source-row-status={row.status}
                  data-ltm-source-id={row.sourceId}
                  data-ltm-source-actions-open={
                    flatPanel === "imported" && openSourceActionId === row.existingNoteId ? true : undefined
                  }
                  className="group space-y-2 p-3"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      aria-label={localizeUi("ui.longTermMemory.memoryvault.selectValue1", { value1: row.title })}
                      checked={activeFlatSelection.has(row.sourceId)}
                      onChange={(event) =>
                        flatPanel === "available"
                          ? toggleSelected(row.sourceId, event.target.checked)
                          : toggleImportedSelected(row.sourceId, event.target.checked)
                      }
                      data-ltm-source-select={row.sourceId}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">{row.title}</h3>
                        <span
                          data-ltm-source-status={row.status}
                          className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] font-semibold uppercase"
                        >
                          {sourceStatusLabel(row, localizeUi)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">{row.summary}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--muted-foreground)]">{row.snippet}</p>
                    </div>
                    {flatPanel === "imported" ? (
                      sourceInlineActions(row.existingNoteId, row.existingNoteTitle)
                    ) : (
                      <IconButton
                        icon={importing ? Loader2 : FileInput}
                        label={localizeUi("ui.longTermMemory.sourcesworkspace.importValue1", { value1: row.title })}
                        disabled={importing}
                        onClick={(event) => {
                          stopRowAction(event);
                          void runImport([row.sourceId]);
                        }}
                        className={importing ? "[&>svg]:animate-spin" : ""}
                        data-ltm-source-action="import"
                        data-ltm-source-id={row.sourceId}
                      />
                    )}
                  </div>
                  {flatPanel === "imported" ? (
                    <div className="ml-7 space-y-2" data-ltm-source-existing-note={row.existingNoteId}>
                      <button
                        type="button"
                        data-ltm-source-memory-id={row.existingNoteId}
                        aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.openSourceMemoryValue1", {
                          value1: row.existingNoteTitle,
                        })}
                        className="inline-flex min-h-11 items-center text-left text-xs font-semibold text-[var(--primary)] underline underline-offset-2"
                        onClick={() => onOpenMemory?.(row.existingNoteId)}
                      >
                        {localizeUi("ui.longTermMemory.sourcesworkspace.sourceMemory")} {row.existingNoteTitle}
                      </button>
                    </div>
                  ) : null}
                </ClickSurface>
              ))}
              {!preview.isLoading && activeFlatRows.length === 0 ? (
                <p className="p-4 text-xs text-[var(--muted-foreground)]">
                  {flatPanel === "available"
                    ? localizeUi("ui.longTermMemory.sourcesworkspace.noNewOrRetryableSourcesAreReadyToImport")
                    : localizeUi("ui.longTermMemory.sourcesworkspace.noSourcesHaveBeenImportedInThisScope")}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {importResult ? (
        <section
          role="region"
          aria-labelledby={importResultLabelId}
          data-ltm-source-import-result={importResult.batchStatus}
          className="mari-editor-panel space-y-3 p-3"
        >
          <h2 id={importResultLabelId} className="text-sm font-semibold">
            {localizeUi("ui.longTermMemory.sourcesworkspace.sourceImportComplete")}
          </h2>
          <p className="text-xs text-[var(--muted-foreground)]">{importResultMessage}</p>
          <div className="flex flex-wrap gap-2">
            {retryableIds.length ? (
              <Button
                primary
                disabled={importing}
                onClick={() => void runImport(retryableIds, "import", importResultContract ?? undefined)}
                data-ltm-source-action="retry-failed"
              >
                <RefreshCw aria-hidden="true" size="0.75rem" />
                {localizeUi("ui.longTermMemory.sourcesworkspace.retryFailedCount", { count: retryableIds.length })}
              </Button>
            ) : null}
            {pendingDraftsProduced ? (
              <Button onClick={() => onOpenReview?.()} data-ltm-source-action="review-imported-drafts">
                {localizeUi("ui.longTermMemory.sourcesworkspace.reviewProposedMemories")}
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.longTermMemory.sourcesworkspace.importResultSummary", {
              requested: importResult.counts.requested,
              wrote: importResult.counts.sourceNotesWritten,
              succeeded: importResult.counts.succeeded,
              failed: importResult.counts.failed,
              cancelled: importResult.counts.cancelled,
              missing: importResult.counts.missing,
              writeFailures: importResult.counts.sourceWriteFailed,
            })}
          </p>
          {importResult.imported.map((item) => (
            <article
              key={item.sourceId}
              data-ltm-import-outcome={item.extractionStatus}
              className="mari-editor-panel space-y-2 p-3"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <strong>{item.title}</strong>
                <span
                  data-ltm-source-write-status={item.sourceWriteStatus}
                  className={`rounded-full px-2 py-0.5 ${resultToneClass(item.sourceWriteStatus)}`}
                >
                  {importStatusLabel(item.sourceWriteStatus, localizeUi)}
                </span>
                <span
                  data-ltm-extraction-status={item.extractionStatus}
                  data-ltm-extraction-outcome={item.outcome.state}
                  className={`rounded-full px-2 py-0.5 ${resultToneClass(item.extractionStatus === "succeeded" ? item.outcome.state : item.extractionStatus)}`}
                >
                  {extractionResultLabel(item, localizeUi)}
                </span>
                <span data-ltm-extraction-accounting className="text-[0.6875rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.longTermMemory.sourcesworkspace.suggestionsKeptOfTotal", {
                    kept: item.outcome.keptUnits,
                    total: item.outcome.totalCandidates,
                  })}
                </span>
              </div>
              {item.extractionStatus === "failed" || item.extractionStatus === "cancelled" ? (
                <StatusSurface tone={resultTone(item.extractionStatus)}>{item.error.message}</StatusSurface>
              ) : null}
              {item.extractionStatus === "succeeded" && item.outcome.droppedUnits > 0 ? (
                <div className="space-y-2">
                  <p
                    className="text-xs text-[var(--muted-foreground)]"
                    data-ltm-rejected-count={item.outcome.droppedUnits}
                  >
                    {localizeUi("ui.longTermMemory.sourcesworkspace.rejectedSuggestionCount", {
                      count: item.outcome.droppedUnits,
                    })}
                  </p>
                  <Button
                    onClick={() => onOpenReview?.(item.note.id)}
                    data-ltm-source-action="review-rejected-suggestions"
                  >
                    {localizeUi("ui.longTermMemory.sourcesworkspace.reviewRejectedSuggestions")}
                  </Button>
                </div>
              ) : null}
              {item.diagnostics.length ? (
                <ul className="space-y-1 text-xs text-[var(--muted-foreground)]" data-ltm-extraction-diagnostics>
                  {item.diagnostics.map((diagnostic, index) => (
                    <li key={`${diagnostic.code}-${index}`}>{diagnostic.message}</li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-ltm-source-memory-id={item.note.id}
                  aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.openSourceMemoryValue1", {
                    value1: item.title,
                  })}
                  className="inline-flex min-h-11 items-center text-xs font-semibold text-[var(--primary)] underline underline-offset-2"
                  onClick={() => onOpenMemory?.(item.note.id)}
                >
                  {localizeUi("ui.longTermMemory.sourcesworkspace.openSourceMemory")}
                </button>
                <Button
                  disabled={extractingId !== null}
                  onClick={() => void reextract(item.note.id)}
                  data-ltm-source-action="re-extract"
                  data-ltm-source-note-id={item.note.id}
                >
                  {extractingId === item.note.id ? (
                    <Loader2 aria-hidden="true" size="0.75rem" className="animate-spin" />
                  ) : (
                    <Sparkles aria-hidden="true" size="0.75rem" />
                  )}
                  {localizeUi("ui.longTermMemory.sourcesworkspace.reExtract")}
                </Button>
                <Button onClick={() => onOpenReview?.(item.note.id)} data-ltm-review-query={item.note.id}>
                  {localizeUi("ui.longTermMemory.memoryvault.reviewRelatedDrafts")}
                </Button>
              </div>
            </article>
          ))}
          {importResult.writeFailures.map((failure) => (
            <StatusSurface key={failure.sourceId} tone="danger" data-ltm-source-write-failure={failure.sourceId}>
              <CircleAlert aria-hidden="true" size="0.875rem" /> {failure.title}: {failure.error.message} (
              {importStatusLabel(failure.sourceWriteStatus, localizeUi)},{" "}
              {importStatusLabel(failure.extractionStatus, localizeUi)})
            </StatusSurface>
          ))}
          {importResult.missingSourceIds.map((id) => (
            <StatusSurface key={id} tone="danger" data-ltm-source-missing={id}>
              <CircleAlert aria-hidden="true" size="0.875rem" />{" "}
              {localizeUi("ui.longTermMemory.sourcesworkspace.missingSourceMemory")}
            </StatusSurface>
          ))}
        </section>
      ) : null}
    </section>
  );
}
