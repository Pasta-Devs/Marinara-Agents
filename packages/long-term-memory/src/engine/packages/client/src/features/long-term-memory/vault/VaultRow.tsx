import { memo, type RefObject } from "react";
import { Archive, ChevronRight, Ellipsis, Globe, Trash2 } from "lucide-react";
import type { LtmNote } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { Button, Chip, ClickSurface, IconButton } from "../shared-controls";
import { labelKeys, localizedLabel } from "../display-labels";
import { useLtmTranslation } from "../localization";
import { hasExplicitScope } from "./vault-shared";

type NoteActionEvent = { preventDefault: () => void; stopPropagation: () => void };

/** The Vault's row handlers. Rows read them through a ref, so a new handler does not re-render every row. */
export type VaultRowActions = {
  openNote: (note: LtmNote) => void;
  toggleChecked: (noteId: string) => void;
  runNoteAction: (event: NoteActionEvent, note: LtmNote, action: "archive" | "delete") => void;
  toggleNoteActions: (event: NoteActionEvent, noteId: string) => void;
  /** Narrow this chat's list to the memories one of its other branches added. */
  filterByBranch: (chatId: string) => void;
};

type VaultRowProps = {
  note: LtmNote;
  label: string;
  previewLabel?: string;
  previewText?: string;
  originLabel?: string;
  /**
   * "From branch …": this chat recalls the memory from another branch of its conversation. The text is the visible
   * label, the label the accessible name (it says what the button does), and the button narrows the list to that
   * branch. Plain strings, so `sameRow` compares them by value. Absent while a branch is already shown.
   */
  fromBranchChatId?: string;
  fromBranchText?: string;
  fromBranchLabel?: string;
  /** Where the memory is available; a plain array the row compares by value, so a new array does not re-render it. */
  places?: readonly string[];
  /** The short age ("2 hr. ago"), already worded; empty when the note has no usable timestamp. */
  updatedText?: string;
  /** The tooltip for the age: "Updated" and the full date and time. */
  updatedTitle?: string;
  /** Who the memory is about, already worded ("About Rika"). */
  subjectText?: string;
  selected: boolean;
  actionsOpen: boolean;
  selectMode: boolean;
  checked: boolean;
  busy: boolean;
  actions: RefObject<VaultRowActions | null>;
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
  originLabel,
  fromBranchChatId,
  fromBranchText,
  fromBranchLabel,
  places,
  updatedText,
  updatedTitle,
  subjectText,
  selected,
  actionsOpen,
  selectMode,
  checked,
  busy,
  actions,
}: VaultRowProps) {
  const { t: localizeUi } = useLtmTranslation();
  // No explicit place: the one place chip says "Available everywhere" and carries a globe.
  const everywhere = note.type !== "source" && !hasExplicitScope(note.scope);
  const hasChips = note.status !== "active" || Boolean(originLabel) || Boolean(places?.length);
  return (
    <ClickSurface
      data-ltm-note-id={note.id}
      data-ltm-note-type={note.type}
      data-ltm-note-source={note.type === "source" || undefined}
      data-ltm-note-actions-open={actionsOpen || undefined}
      className={`group relative border-b border-[var(--border)]/70 p-2 ${selected ? "bg-[var(--primary)]/10" : ""}`}
    >
      {selected ? (
        <span
          aria-hidden="true"
          data-ltm-note-open-bar
          className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[var(--primary)]"
        />
      ) : null}
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
        <div className="min-w-0 flex-1">
          <button
            type="button"
            aria-current={selected ? "true" : undefined}
            onClick={() => actions.current?.openNote(note)}
            className="min-h-14 w-full min-w-0 overflow-hidden rounded-md px-2 text-left hover:bg-[var(--accent)]"
          >
            <span className="flex items-center gap-2">
              <strong className="truncate text-sm">{label}</strong>
              {updatedText ? (
                <span
                  data-ltm-row-updated
                  title={updatedTitle}
                  className="ml-auto shrink-0 text-xs text-[var(--muted-foreground)]"
                >
                  {updatedText}
                </span>
              ) : null}
              <ChevronRight aria-hidden="true" size="0.875rem" className="shrink-0" />
            </span>
            {hasChips ? (
              <span className="mt-1 flex flex-wrap gap-1 text-xs">
                {/* The type is the heading the row sits under. An active memory is the normal case, so only the other states earn a chip. */}
                {note.status !== "active" ? (
                  <Chip>{localizedLabel(note.status, localizeUi, labelKeys.status)}</Chip>
                ) : null}
                {originLabel ? <Chip>{originLabel}</Chip> : null}
                {places?.slice(0, maxPlacePills).map((place, index) => (
                  <Chip
                    key={index}
                    tone="muted"
                    data-ltm-row-place
                    className={everywhere ? "inline-flex items-center gap-1" : ""}
                  >
                    {everywhere ? <Globe aria-hidden="true" size="0.75rem" className="shrink-0" /> : null}
                    {place}
                  </Chip>
                ))}
                {places && places.length > maxPlacePills ? (
                  <Chip tone="muted" data-ltm-row-place title={places.slice(maxPlacePills).join(", ")}>
                    +{places.length - maxPlacePills}
                    <span className="sr-only"> ({places.slice(maxPlacePills).join(", ")})</span>
                  </Chip>
                ) : null}
              </span>
            ) : null}
            {subjectText ? (
              <span data-ltm-row-subject className="mt-1 block truncate text-xs text-[var(--muted-foreground)]">
                {subjectText}
              </span>
            ) : null}
            {previewText !== undefined ? (
              <span className="mt-1 line-clamp-2 break-words text-xs leading-5 text-[var(--muted-foreground)]">
                {previewLabel ? (
                  <>
                    <span className="font-medium text-[var(--foreground)]">{previewLabel}:</span>{" "}
                  </>
                ) : null}
                {previewText}
              </span>
            ) : null}
          </button>
          {/* A button of its own: it cannot sit inside the open button above, and it must not open the memory. */}
          {fromBranchChatId && fromBranchText ? (
            <Button
              data-ltm-row-from-branch={fromBranchChatId}
              aria-label={fromBranchLabel}
              title={fromBranchLabel}
              className="mt-1 max-w-full justify-start text-xs"
              onClick={() => actions.current?.filterByBranch(fromBranchChatId)}
            >
              <span className="truncate">{fromBranchText}</span>
            </Button>
          ) : null}
        </div>
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
}, sameRow);

const maxPlacePills = 2;

/** Props compare by value (`updatedText` and `updatedTitle` included), except `places`, which is rebuilt on every render of the list. */
function sameRow(previous: VaultRowProps, next: VaultRowProps) {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]) as Set<keyof VaultRowProps>;
  for (const key of keys) {
    if (key === "places") continue;
    if (!Object.is(previous[key], next[key])) return false;
  }
  return (
    previous.places?.length === next.places?.length &&
    (previous.places ?? []).every((place, index) => place === next.places?.[index])
  );
}
