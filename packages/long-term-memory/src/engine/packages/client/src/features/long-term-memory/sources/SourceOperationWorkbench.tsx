import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Send } from "lucide-react";
import type {
  LtmBulkNoteResult,
  LtmNoteTransferApplyResponse,
  LtmNoteTransferPreviewResponse,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { derivedNotesQueryOptions, errorMessage, request } from "../api";
import { Button, InfoPopover, StatusSurface, inputClass } from "../shared-controls";
import { labelKeys, localizedLabel, noteTypeLabel } from "../display-labels";
import type { LongTermMemoryDestinationProps } from "../types";
import { useLtmTranslation } from "../localization";
import { type ScopeTargetChat } from "../scope-targets";
import { sourceCheckboxClass } from "./source-shared";
import type { SourceOperation } from "./source-shared";

export function SourceOperationWorkbench({
  sourceNoteId,
  sourceTitle,
  initialOperation,
  destinations,
  disabled,
  confirmAction,
  onComplete,
}: {
  sourceNoteId: string;
  sourceTitle: string;
  initialOperation?: SourceOperation;
  destinations: ScopeTargetChat[];
  disabled: boolean;
  confirmAction?: LongTermMemoryDestinationProps["props"]["confirmAction"];
  onComplete: () => Promise<void>;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const [operation, setOperation] = useState<SourceOperation>(initialOperation ?? "copy");
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
  const linked = useQuery(derivedNotesQueryOptions(sourceNoteId));
  const memories = linked.data?.memories ?? [];
  const selected = new Set(selectedLinkedIds);
  const selectedMemories = memories.filter((memory) => selected.has(memory.id));
  const excludedMemories = memories.filter((memory) => !selected.has(memory.id));
  const selectedIds = [sourceNoteId, ...selectedMemories.map((memory) => memory.id)];
  const titleFor = (id: string) =>
    id === sourceNoteId ? sourceTitle : (memories.find((memory) => memory.id === id)?.title ?? id);

  useEffect(() => {
    // The derived list is cached per source and shared with the Vault, so wait for this mount's
    // read instead of seeding the selection from a list a later extraction may have changed.
    if (!linked.data || initializedFor === sourceNoteId || !(linked.isFetchedAfterMount || linked.isError)) return;
    setSelectedLinkedIds(linked.data.memories.map((memory) => memory.id));
    setInitializedFor(sourceNoteId);
  }, [initializedFor, linked.data, linked.isError, linked.isFetchedAfterMount, sourceNoteId]);

  const resetPreview = () => {
    setPreview(null);
    setPreviewed(false);
    setPreviewLineageNoteIds(null);
    setResult(null);
    setError("");
  };
  const previewOperation = async () => {
    if (
      disabled ||
      !linked.data ||
      linked.isError ||
      ((operation === "copy" || operation === "move") && !destinationChatId)
    )
      return;
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
      setError(errorMessage(error, localizeUi("ui.longTermMemory.sourceoperation.previewCouldNotLoad")));
    } finally {
      setBusy(null);
    }
  };
  const apply = async () => {
    if (disabled || !linked.data || linked.isError || !previewed || busy || result) return;
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
      setError(errorMessage(error, localizeUi("ui.longTermMemory.sourceoperation.couldNotApply")));
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
      data-ltm-source-operation-workbench
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
        {linked.isError ? (
          <StatusSurface tone="danger">
            {localizeUi("ui.longTermMemory.sourceoperation.linkedMemoriesCouldNotLoad")}
          </StatusSurface>
        ) : null}
        {memories.map((memory) => (
          <label
            key={memory.id}
            className="flex min-h-11 items-start gap-2 rounded border border-[var(--border)] bg-[var(--background)]/50 p-2 text-xs"
          >
            <input
              type="checkbox"
              className={sourceCheckboxClass}
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
          disabled ||
          busy !== null ||
          !linked.data ||
          linked.isError ||
          ((operation === "copy" || operation === "move") && !destinationChatId)
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
              disabled ||
              Boolean(result) ||
              busy !== null ||
              !linked.data ||
              linked.isError ||
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
