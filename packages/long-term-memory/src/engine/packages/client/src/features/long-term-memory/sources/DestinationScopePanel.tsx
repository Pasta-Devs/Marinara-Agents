import { useId, useMemo, useRef, type ReactNode, type SyntheticEvent } from "react";
import { ChevronRight } from "lucide-react";
import type { LtmMode } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { AvailabilityTabRail, type AvailabilityPlaceKind } from "../AvailabilityTabRail";
import { InfoPopover, ModeCheckboxes, RemovableChip } from "../shared-controls";
import { labelKeys, localizedLabel } from "../display-labels";
import { useLtmTranslation } from "../localization";
import {
  ALL_LTM_MODES,
  mergedDestinationScope,
  sourceModeLabel,
  targetDisplayLabel,
  targetFitsDestinationScope,
} from "./source-shared";
import type { ScopeTarget, Source } from "./source-shared";

const placeId = (target: ScopeTarget) => target.id.split(":").slice(1).join(":");

export function DestinationScopePanel({
  targets,
  selectedIds,
  onChange,
  mode,
  source,
  availabilityModes,
  onAvailabilityModesChange,
  modesError = "",
  availabilityDisabled = false,
  disabled = false,
  currentChatId,
  reasonId,
  action,
  hint,
}: {
  targets: ScopeTarget[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  mode: LtmMode | "all";
  source: Source;
  availabilityModes: LtmMode[];
  onAvailabilityModesChange: (modes: LtmMode[]) => void;
  modesError?: string;
  availabilityDisabled?: boolean;
  disabled?: boolean;
  /** The open chat: a destination that is only this chat reads "This chat". */
  currentChatId?: string;
  /** Id of the screen-reader-only status that says why Import waits; the waiting buttons point at it. */
  reasonId: string;
  /** The primary Import button, rendered first in the bar. */
  action?: ReactNode;
  /** The one hint line under the bar's controls. */
  hint?: ReactNode;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const labelId = useId();
  const listScroll = useRef<{ scroller: Element; top: number } | null>(null);
  const sortedTargets = useMemo(
    () =>
      [...targets].sort(
        (left, right) =>
          Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)) || left.label.localeCompare(right.label),
      ),
    [targets],
  );
  const selectedTargets = sortedTargets.filter((target) => selectedIds.includes(target.id));
  const destinationSummary = selectedTargets.length
    ? currentChatId && selectedTargets.length === 1 && selectedTargets[0]?.id === `chat:${currentChatId}`
      ? localizeUi("ui.longTermMemory.sourcesworkspace.thisChat")
      : selectedTargets.map((target) => targetDisplayLabel(target, true)).join(", ")
    : localizeUi("ui.longTermMemory.sourcesworkspace.chooseDestinationShort");
  const currentDestinationScope = mergedDestinationScope(selectedTargets);
  const targetExceedsLimit = (target: ScopeTarget) =>
    !selectedIds.includes(target.id) && !targetFitsDestinationScope(currentDestinationScope, target);
  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((value) => value !== id));
      return;
    }
    const target = sortedTargets.find((item) => item.id === id);
    if (target && !targetExceedsLimit(target)) onChange([...selectedIds, id]);
  };
  const placeRows = (kind: AvailabilityPlaceKind) =>
    sortedTargets
      .filter((target) => target.kind === kind)
      .map((target) => ({
        id: placeId(target),
        label: target.label,
        comment: target.comment,
        searchText: [target.destinationLabel, target.searchText].filter(Boolean).join(" "),
      }));
  const chatTargets = sortedTargets.filter((target) => target.kind === "chat");
  // "All chats" is on once no further chat fits: choosing it adds every chat within the limits, choosing it again
  // clears them.
  const allChatsSelected =
    chatTargets.some((target) => selectedIds.includes(target.id)) &&
    chatTargets.every((target) => selectedIds.includes(target.id) || targetExceedsLimit(target));
  const railSelectedIds = new Set(selectedTargets.map((target) => `${target.kind}:${placeId(target)}`));
  if (allChatsSelected) railSelectedIds.add("chat:all");
  const toggleRail = (kind: AvailabilityPlaceKind, id: string) => {
    if (kind === "chat" && id === "all") {
      if (allChatsSelected) {
        onChange(selectedIds.filter((value) => !chatTargets.some((target) => target.id === value)));
        return;
      }
      const nextIds = [...selectedIds];
      const nextTargets = [...selectedTargets];
      for (const target of chatTargets) {
        if (nextIds.includes(target.id) || !targetFitsDestinationScope(mergedDestinationScope(nextTargets), target))
          continue;
        nextIds.push(target.id);
        nextTargets.push(target);
      }
      onChange(nextIds);
      return;
    }
    const target = sortedTargets.find((item) => item.kind === kind && placeId(item) === id);
    if (target) toggle(target.id);
  };
  const modeSummary =
    availabilityModes.length > 1
      ? `${localizeUi("ui.longTermMemory.memoryvault.availableIn")}: ${availabilityModes
          .map((m) => localizedLabel(m, localizeUi, labelKeys.mode))
          .join(", ")}`
      : mode === "all"
        ? source === "chats" || source === "messages"
          ? localizeUi("ui.longTermMemory.sourcesworkspace.automatic")
          : localizeUi("ui.longTermMemory.sourcesworkspace.importsDefaultToRoleplay")
        : sourceModeLabel(mode, localizeUi);
  // At phone width the open picker leaves the pin and sits after the list: opening scrolls to it, closing returns the
  // list to where it was.
  const followUnpinnedPicker = (event: SyntheticEvent<HTMLDetailsElement>) => {
    const details = event.currentTarget;
    const bar = details.closest<HTMLElement>("[data-ltm-import-bar]");
    if (!details.open) {
      const saved = listScroll.current;
      listScroll.current = null;
      if (saved) saved.scroller.scrollTop = saved.top;
      return;
    }
    if (!bar || getComputedStyle(bar).position !== "static") return;
    // The first ancestor that really scrolls: the editor content in the app, the page where it is not height-bound.
    let scroller: Element | null = bar.parentElement;
    while (
      scroller &&
      !(
        /(auto|scroll|hidden)/u.test(getComputedStyle(scroller).overflowY) &&
        scroller.scrollHeight > scroller.clientHeight
      )
    )
      scroller = scroller.parentElement;
    scroller ??= document.scrollingElement;
    if (scroller) listScroll.current = { scroller, top: scroller.scrollTop };
    details.querySelector("summary")?.scrollIntoView({ block: "start" });
  };
  // One bar under the list: Import, where the memories will be available, one hint. It pins to the bottom of the
  // card while the list scrolls and grows (scrolling inside itself) while the picker is open; at phone width the open
  // picker unpins instead (see followUnpinnedPicker).
  return (
    <div
      id="ltm-destination-scope-control"
      role="group"
      aria-labelledby={labelId}
      data-ltm-import-bar
      className="z-10 flex min-h-0 flex-col gap-2 border-t border-[var(--border)] bg-[var(--card)] p-3"
    >
      {disabled ? (
        <p
          id={`${labelId}-lock`}
          className="shrink-0 text-xs text-[var(--muted-foreground)]"
          data-ltm-import-lock="destination"
        >
          {localizeUi("ui.longTermMemory.sourcesworkspace.lockedWhileImportRuns")}
        </p>
      ) : null}
      <style>{`
        [data-ltm-import-bar] {
          position: sticky;
          bottom: 0;
        }
        [data-ltm-source-column] :is(button, a, input, summary, select, [tabindex]):focus {
          scroll-margin-bottom: 10rem;
        }
        [data-ltm-import-bar]:has([data-ltm-destination-scope][open]) {
          max-height: min(36rem, 60dvh);
          overflow-y: auto;
        }
        [data-ltm-destination-scope] {
          display: flex;
          flex: 1 1 12rem;
          flex-direction: column;
          min-height: 0;
          min-width: 0;
        }
        [data-ltm-destination-scope][open] {
          flex: 1 1 100%;
        }
        [data-ltm-destination-scope]::details-content {
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          min-height: 0;
          gap: 0.75rem;
        }
        [data-ltm-destination-scope] > summary [data-ltm-destination-scope-chevron] {
          transition: transform 150ms ease;
        }
        [data-ltm-destination-scope][open] > summary [data-ltm-destination-scope-chevron] {
          transform: rotate(90deg);
        }
        /* A phone screen has no room for a scroll box inside the page: the open picker leaves the pin and reads in
           the page's own scroll, its "Available in" line held at the top so one tap closes it. A narrow docked
           column on a desktop window keeps the box. */
        @media (max-width: 47.99rem) {
          [data-ltm-import-bar]:has([data-ltm-destination-scope][open]) {
            position: static;
            max-height: none;
            overflow: visible;
          }
          [data-ltm-destination-scope][open] > summary {
            position: sticky;
            top: 0;
            z-index: 1;
            /* Theme card colours are see-through; the opaque page colour under them keeps the list from showing through. */
            background: linear-gradient(var(--card), var(--card)), var(--background);
          }
        }
      `}</style>
      <div className="flex flex-wrap items-center gap-2">
        {action}
        <details data-ltm-destination-scope className="group min-h-0 gap-3" onToggle={followUnpinnedPicker}>
          <summary
            data-ltm-tab-focus
            className="mari-editor-action flex min-h-11 shrink-0 cursor-pointer list-none items-center gap-2 px-3 py-2 text-left [&::-webkit-details-marker]:hidden"
          >
            <span className="shrink-0 text-xs font-medium text-[var(--marinara-editor-muted)]">
              {localizeUi("ui.longTermMemory.memoryvault.availableIn")}:
            </span>
            <span
              className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--marinara-editor-text)]"
              data-ltm-destination-scope-summary
            >
              {destinationSummary}
            </span>
            {selectedTargets.length ? (
              <>
                <span aria-hidden="true" className="shrink-0 text-xs">
                  ·
                </span>
                <span className="shrink-0 text-xs font-semibold" data-ltm-destination-change>
                  {localizeUi("ui.longTermMemory.sourcesworkspace.changeDestination")}
                </span>
              </>
            ) : null}
            <ChevronRight aria-hidden="true" size="0.875rem" data-ltm-destination-scope-chevron className="shrink-0" />
          </summary>
          <p className="shrink-0 text-xs text-[var(--muted-foreground)]" data-ltm-import-mode-summary>
            {modeSummary}
          </p>
          <div className="flex shrink-0 items-center gap-2 text-xs font-semibold">
            <span id={labelId}>{localizeUi("ui.longTermMemory.sourcesworkspace.makeMemoriesAvailableIn")}</span>
            <InfoPopover
              label={localizeUi("ui.longTermMemory.sourcesworkspace.makeMemoriesAvailableIn")}
              content={localizeUi("ui.longTermMemory.sourcesworkspace.bulkDestinationHelp")}
            />
          </div>
          <ModeCheckboxes
            modes={ALL_LTM_MODES}
            selected={availabilityModes}
            onChange={onAvailabilityModesChange}
            labelFor={(chatMode) => localizedLabel(chatMode, localizeUi, labelKeys.mode)}
            legend={localizeUi("ui.longTermMemory.memoryvault.chatModes")}
            error={modesError}
            disabled={availabilityDisabled || disabled}
            describedBy={disabled ? `${labelId}-lock` : undefined}
            dataPrefix="ltm-availability"
            className="shrink-0 space-y-1.5 border-b border-[var(--border)] pb-2.5"
            legendClassName="text-xs font-semibold text-[var(--muted-foreground)]"
            textClassName="text-xs"
          />
          {selectedTargets.length ? (
            <div className="shrink-0 space-y-2">
              <p className="text-xs font-semibold">
                {localizeUi("ui.longTermMemory.sourcesworkspace.selectedLocations")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedTargets.map((target) => (
                  <RemovableChip
                    key={target.id}
                    disabled={disabled}
                    removeLabel={localizeUi("ui.longTermMemory.sourcesworkspace.removeLocationValue1", {
                      value1: targetDisplayLabel(target, true),
                    })}
                    onRemove={() => onChange(selectedIds.filter((id) => id !== target.id))}
                  >
                    <span className="block truncate">{targetDisplayLabel(target, true)}</span>
                    {target.comment ? (
                      <span className="block truncate text-xs text-[var(--muted-foreground)]">{target.comment}</span>
                    ) : null}
                  </RemovableChip>
                ))}
              </div>
            </div>
          ) : null}
          {sortedTargets.some(targetExceedsLimit) ? (
            <p role="note" className="shrink-0 text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.longTermMemory.sourcesworkspace.destinationScopeLimitReached")}
            </p>
          ) : null}
          <AvailabilityTabRail
            chats={placeRows("chat")}
            characters={placeRows("character")}
            personas={placeRows("persona")}
            selectedIds={railSelectedIds}
            tablistLabel={localizeUi("ui.longTermMemory.sourcesworkspace.makeMemoriesAvailableIn")}
            disabled={disabled}
            onToggle={toggleRail}
          />
        </details>
      </div>
      {hint}
      {/* Always mounted, so emptying the selection is read as a change. Screen-reader only, and the id the waiting
          Import buttons point at: no warning sentence and no second link beside the chip. */}
      <span id={reasonId} role="status" className="sr-only" data-ltm-destination-hint>
        {selectedTargets.length ? null : localizeUi("ui.longTermMemory.sourcesworkspace.chooseDestinationBeforeImport")}
      </span>
    </div>
  );
}
