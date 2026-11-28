import type { ReactNode } from "react";
import type { LtmLink, LtmNote } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { useLtmTranslation } from "../localization";
import { Chip, RemovableChip } from "../shared-controls";

/**
 * The rows of a memory's links: what it points to, where it was extracted from and what points to it. The editor's
 * Linked memories section and the Graph's preview card both render this, so a link reads the same in both. The editor
 * passes `onRemove` (its links are editable); the card leaves it out and shows plain chips, or, with `rows`, one
 * read-only row per link: relation, kind icon, title, at most `limit` rows and then "N more".
 */
export type LinkedMemoriesProps = {
  /** Links from this memory, `extracted_from` excluded. */
  outgoing: readonly LtmLink[];
  /** The `extracted_from` links: where the memory came from, not a relation. */
  extractedFrom: readonly LtmLink[];
  /** Memories that link to this one. */
  incoming: readonly LtmNote[];
  notesById: ReadonlyMap<string, LtmNote>;
  memoryLabel: (note: LtmNote | undefined) => string;
  relationLabel: (relation: string) => string;
  onOpen: (noteId: string) => void;
  onRemove?: (link: LtmLink) => void;
  /** The Graph card's presentation. `selfId` is this memory, so a memory linking here names its own relation. */
  rows?: { selfId: string; limit: number; icon: (note: LtmNote) => ReactNode; onMore: () => void };
};

const openButtonClass = "inline-flex min-h-11 items-center underline underline-offset-2";

export function LinkedMemories({
  outgoing,
  extractedFrom,
  incoming,
  notesById,
  memoryLabel,
  relationLabel,
  onOpen,
  onRemove,
  rows,
}: LinkedMemoriesProps) {
  const { t: localizeUi } = useLtmTranslation();
  if (rows) {
    const entries = [
      ...[...outgoing, ...extractedFrom].map((link) => ({ id: link.target, relation: link.relation, back: false })),
      ...incoming.map((note) => ({
        id: note.id,
        relation: note.links.find((link) => link.target === rows.selfId)?.relation ?? "",
        back: true,
      })),
    ];
    const shown = entries.slice(0, rows.limit);
    const more = entries.length - shown.length;
    return (
      <>
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          {localizeUi("ui.longTermMemory.memoryvault.linkedMemories")}
          <span className="font-medium text-[var(--muted-foreground)]">
            {entries.length ? entries.length : localizeUi("ui.longTermMemory.memorygraph.emptyNoLinks")}
          </span>
        </div>
        {entries.length ? (
          <div data-ltm-graph-links>
            {shown.map((entry, index) => {
              const note = notesById.get(entry.id);
              return (
                <button
                  key={`${entry.id}-${entry.relation}-${index}`}
                  type="button"
                  data-ltm-graph-link-row
                  onClick={() => onOpen(entry.id)}
                >
                  <span data-ltm-graph-link-rel>
                    {entry.back ? <span aria-hidden="true">← </span> : null}
                    {relationLabel(entry.relation)}
                  </span>
                  {note ? rows.icon(note) : null}
                  <span data-ltm-graph-link-title>{memoryLabel(note)}</span>
                </button>
              );
            })}
            {more > 0 ? (
              <button type="button" data-ltm-graph-link-row data-ltm-graph-link-more onClick={rows.onMore}>
                {localizeUi("ui.longTermMemory.memorygraph.moreLinks", { count: more })}
              </button>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {outgoing.map((link, index) => {
          const target = memoryLabel(notesById.get(link.target));
          const sentence = (
            <>
              {localizeUi("ui.longTermMemory.memoryvault.thisMemory")}{" "}
              {relationLabel(link.relation).toLocaleLowerCase()}{" "}
              <button type="button" className={openButtonClass} onClick={() => onOpen(link.target)}>
                {target}
              </button>
            </>
          );
          return onRemove ? (
            <RemovableChip
              key={`${link.target}-${link.relation}-${index}`}
              label={localizeUi("ui.longTermMemory.longtermmemorydetail.value1Value2", {
                value1: relationLabel(link.relation),
                value2: target,
              })}
              onRemove={() => onRemove(link)}
            >
              {sentence}
            </RemovableChip>
          ) : (
            <Chip key={`${link.target}-${link.relation}-${index}`} tone="neutral" className="text-xs">
              {sentence}
            </Chip>
          );
        })}
      </div>
      {extractedFrom.map((link) => (
        <p key={`${link.target}-${link.relation}`} className="text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.longTermMemory.memoryvault.relationExtractedFrom")}: {memoryLabel(notesById.get(link.target))}
        </p>
      ))}
      <p className="text-xs text-[var(--muted-foreground)]">
        {localizeUi("ui.longTermMemory.memoryvault.memoriesLinkingHere")}: {incoming.length}
      </p>
      {incoming.map((note) => (
        <button
          key={note.id}
          type="button"
          className="flex min-h-11 items-center text-left text-xs underline"
          onClick={() => onOpen(note.id)}
        >
          {memoryLabel(note)}
        </button>
      ))}
    </>
  );
}
