import { memo, type RefObject } from "react";
import { Archive, ChevronRight, Ellipsis, Trash2 } from "lucide-react";
import type { LtmNote } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { Button, ClickSurface, IconButton } from "../shared-controls";
import { labelKeys, localizedLabel, noteTypeLabel as formatNoteTypeLabel } from "../display-labels";
import { useLtmTranslation } from "../localization";

type NoteActionEvent = { preventDefault: () => void; stopPropagation: () => void };

/** The Vault's row handlers. Rows read them through a ref, so a new handler does not re-render every row. */
export type VaultRowActions = {
  openNote: (note: LtmNote) => void;
  toggleChecked: (noteId: string) => void;
  runNoteAction: (event: NoteActionEvent, note: LtmNote, action: "archive" | "delete") => void;
  toggleNoteActions: (event: NoteActionEvent, noteId: string) => void;
};

/**
 * One memory in the Vault navigator. It takes only the note and plain values, so a search keystroke
 * re-renders just the rows whose preview, selection or state changed.
 */
export const VaultRow = memo(function VaultRow({
  note,
  label,
  previewLabel,
  previewText,
  selected,
  actionsOpen,
  selectMode,
  checked,
  busy,
  actions,
}: {
  note: LtmNote;
  label: string;
  previewLabel?: string;
  previewText?: string;
  selected: boolean;
  actionsOpen: boolean;
  selectMode: boolean;
  checked: boolean;
  busy: boolean;
  actions: RefObject<VaultRowActions | null>;
}) {
  const { t: localizeUi } = useLtmTranslation();
  return (
    <ClickSurface
      data-ltm-note-id={note.id}
      data-ltm-note-type={note.type}
      data-ltm-note-source={note.type === "source" || undefined}
      data-ltm-note-actions-open={actionsOpen || undefined}
      className={`group border-b border-[var(--border)]/70 p-2 ${selected ? "bg-[var(--accent)]/50" : ""}`}
    >
      <div className="flex min-w-0 gap-2">
        {selectMode && note.type !== "source" ? (
          <label className="flex min-h-11 min-w-11 items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={checked}
              onChange={() => actions.current?.toggleChecked(note.id)}
              aria-label={localizeUi("ui.longTermMemory.memoryvault.selectValue1", {
                value1: label,
              })}
            />
          </label>
        ) : null}
        <button
          type="button"
          onClick={() => actions.current?.openNote(note)}
          className="min-h-14 min-w-0 flex-1 overflow-hidden rounded-md px-2 text-left hover:bg-[var(--accent)]"
        >
          <span className="flex items-center gap-2">
            <strong className="truncate text-sm">{label}</strong>
            <ChevronRight aria-hidden="true" size="0.875rem" className="shrink-0" />
          </span>
          <span className="mt-1 flex gap-1 text-xs">
            <span className="rounded border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5">
              {formatNoteTypeLabel(note.type, localizeUi)}
            </span>
            <span className="rounded border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5">
              {localizedLabel(note.status, localizeUi, labelKeys.status)}
            </span>
          </span>
          {previewText !== undefined ? (
            <span className="mt-1 line-clamp-2 break-words text-xs leading-5 text-[var(--muted-foreground)]">
              <span className="font-medium text-[var(--foreground)]">{previewLabel}:</span> {previewText}
            </span>
          ) : null}
        </button>
        {note.type !== "source" ? (
          <div
            data-ltm-note-actions-desktop
            data-ltm-row-actions="inline"
            className="shrink-0 flex-col items-start gap-1 pt-1 text-[var(--muted-foreground)]"
          >
            <IconButton
              icon={Archive}
              label={localizeUi("ui.longTermMemory.memoryvault.archiveValue1", {
                value1: label,
              })}
              className={busy ? "opacity-50" : ""}
              aria-disabled={busy || undefined}
              onClick={(event) => actions.current?.runNoteAction(event, note, "archive")}
            />
            <IconButton
              icon={Trash2}
              label={localizeUi("ui.longTermMemory.memoryvault.deleteValue1", {
                value1: label,
              })}
              destructive
              className={busy ? "opacity-50" : ""}
              aria-disabled={busy || undefined}
              onClick={(event) => actions.current?.runNoteAction(event, note, "delete")}
            />
          </div>
        ) : null}
        {note.type !== "source" ? (
          <div data-ltm-row-actions="menu">
            <IconButton
              icon={Ellipsis}
              label={localizeUi("ui.longTermMemory.memoryvault.moreActionsForValue1", {
                value1: label,
              })}
              aria-expanded={actionsOpen}
              aria-controls={actionsOpen ? `ltm-note-actions-${note.id}` : undefined}
              onClick={(event) => actions.current?.toggleNoteActions(event, note.id)}
            />
          </div>
        ) : null}
      </div>
      {note.type !== "source" && actionsOpen ? (
        <div id={`ltm-note-actions-${note.id}`} data-ltm-row-actions="menu" className="ml-10 flex gap-2 pt-2">
          <Button
            className={`flex-1 ${busy ? "opacity-50" : ""}`}
            aria-disabled={busy || undefined}
            onClick={(event) => actions.current?.runNoteAction(event, note, "archive")}
          >
            <Archive aria-hidden="true" size="1rem" className="shrink-0" />
            {localizeUi("ui.longTermMemory.memoryvault.archive")}
          </Button>
          <Button
            className={`flex-1 ${busy ? "opacity-50" : ""}`}
            destructive
            aria-disabled={busy || undefined}
            onClick={(event) => actions.current?.runNoteAction(event, note, "delete")}
          >
            <Trash2 aria-hidden="true" size="1rem" className="shrink-0" />
            {localizeUi("ui.longTermMemory.extractionprompttemplates.delete")}
          </Button>
        </div>
      ) : null}
    </ClickSurface>
  );
});
