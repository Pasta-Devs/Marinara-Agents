import { useEffect, useRef } from "react";
import { CircleAlert } from "lucide-react";
import type { LtmRejectedSuggestion } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { rejectionReasonLabels } from "../display-labels";
import { useLtmTranslation } from "../localization";
import { Button } from "../shared-controls";
import type { LongTermMemoryDestinationProps } from "../types";

export const SKIPPED_LIST_ID = "ltm-skipped-list";

/** The "Skipped (N)" chip in the Review heading row; it opens and closes the list below. */
export function SkippedChip({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  const { t: localizeUi } = useLtmTranslation();
  if (!count) return null;
  return (
    <Button
      chip
      data-ltm-skipped-toggle
      aria-expanded={open}
      aria-controls={open ? SKIPPED_LIST_ID : undefined}
      className="shrink-0"
      style={{ minHeight: "2.75rem" }}
      onClick={onToggle}
    >
      <CircleAlert aria-hidden="true" size="0.875rem" />
      {localizeUi("ui.longTermMemory.reviewqueue.skippedCount", { count })}
    </Button>
  );
}

/**
 * The list behind the "Skipped (N)" chip: every change the extraction left out, across sources, with the reason it gave. The server keeps a
 * reason per change (reason, message), so no run-level fallback is needed. Add anyway opens the same recovery as a
 * source's "Recover manually"; Open source goes to the memory the change came from.
 */
export default function SkippedSuggestions({
  open,
  suggestions,
  sourceTitle,
  sourceExists,
  onOpenSource,
  onRecover,
}: {
  open: boolean;
  suggestions: LtmRejectedSuggestion[];
  sourceTitle: (sourceNoteId: string) => string;
  sourceExists: (sourceNoteId: string) => boolean;
  onOpenSource?: (sourceNoteId: string) => void;
  onRecover?: LongTermMemoryDestinationProps["onRecoverCandidate"];
}) {
  const { t: localizeUi } = useLtmTranslation();
  const listRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // The list renders away from the chip that opened it, so move focus to it: a keyboard or screen-reader user
    // lands on the revealed content (announced by its label) instead of having to search backwards for it.
    if (open) listRef.current?.focus({ preventScroll: true });
    if (open) listRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [open]);
  if (!open || !suggestions.length) return null;
  return (
    <section
      ref={listRef}
      id={SKIPPED_LIST_ID}
      data-ltm-skipped-list
      tabIndex={-1}
      aria-label={localizeUi("ui.longTermMemory.reviewqueue.skippedCount", { count: suggestions.length })}
      className="mari-editor-panel overflow-hidden focus:outline-none"
    >
      <div className="space-y-2 p-3">
        <p className="text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.longTermMemory.reviewqueue.skippedHelp")}
        </p>
        <ul className="space-y-2">
          {suggestions.map((item) => (
            <li
              key={item.id}
              data-ltm-skipped-item={item.id}
              className="space-y-2 rounded-md border border-[var(--border)] p-3 text-xs"
            >
              <p className="text-sm font-semibold leading-6">{item.candidate.snippet || item.candidate.message}</p>
              <p className="text-[var(--muted-foreground)]">
                <span className="font-medium text-[var(--foreground)]">
                  {localizeUi("ui.longTermMemory.reviewqueue.whyItWasntSaved")}:
                </span>{" "}
                {item.candidate.message?.trim() ||
                  localizeUi(
                    rejectionReasonLabels[item.candidate.reason] ??
                      "ui.longTermMemory.reviewqueue.rejectionReasonOther",
                  )}
              </p>
              <p className="text-[var(--muted-foreground)]">
                {localizeUi("ui.longTermMemory.reviewqueue.sourceNote", {
                  title: sourceTitle(item.source.sourceNoteId),
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                {onRecover ? (
                  <Button
                    aria-label={localizeUi("ui.longTermMemory.reviewqueue.skippedAddAnywayNamed", {
                      value1: item.candidate.snippet || item.candidate.message,
                    })}
                    onClick={() => onRecover(item.candidate, item.scope, item.modes, item.id)}
                  >
                    {localizeUi("ui.longTermMemory.reviewqueue.skippedAddAnyway")}
                  </Button>
                ) : null}
                {onOpenSource && sourceExists(item.source.sourceNoteId) ? (
                  <Button onClick={() => onOpenSource(item.source.sourceNoteId)}>
                    {localizeUi("ui.longTermMemory.reviewqueue.openSource")}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
