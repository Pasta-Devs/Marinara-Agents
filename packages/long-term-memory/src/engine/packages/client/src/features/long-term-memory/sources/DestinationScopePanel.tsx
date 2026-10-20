import { useId, useMemo } from "react";
import { ChevronRight, X } from "lucide-react";
import type { LtmMode } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { AvailabilityTabRail, type AvailabilityPlaceKind } from "../AvailabilityTabRail";
import { InfoPopover } from "../shared-controls";
import { labelKeys, localizedLabel } from "../display-labels";
import { useLtmTranslation } from "../localization";
import {
  ALL_LTM_MODES,
  mergedDestinationScope,
  sourceCheckboxClass,
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
}) {
  const { t: localizeUi } = useLtmTranslation();
  const labelId = useId();
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
    ? selectedTargets.map((target) => targetDisplayLabel(target, true)).join(", ")
    : localizeUi("ui.longTermMemory.sourcesworkspace.chooseDestination");
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
  return (
    <div
      id="ltm-destination-scope-control"
      role="group"
      aria-labelledby={labelId}
      className="mari-editor-panel flex min-h-0 flex-col gap-3 p-3"
      style={{ maxHeight: "calc(100vh - 12rem)" }}
    >
      <div className="flex shrink-0 items-center gap-2 text-xs font-semibold">
        <span id={labelId}>{localizeUi("ui.longTermMemory.sourcesworkspace.makeMemoriesAvailableIn")}</span>
        <InfoPopover
          label={localizeUi("ui.longTermMemory.sourcesworkspace.makeMemoriesAvailableIn")}
          content={localizeUi("ui.longTermMemory.sourcesworkspace.bulkDestinationHelp")}
        />
      </div>
      <fieldset
        className="shrink-0 space-y-1.5 border-b border-[var(--border)] pb-2.5"
        data-ltm-availability-modes-fieldset
      >
        <legend className="text-xs font-semibold text-[var(--muted-foreground)]">
          {localizeUi("ui.longTermMemory.memoryvault.chatModes")}
        </legend>
        <div className="flex flex-wrap gap-3" data-ltm-availability-modes>
          {ALL_LTM_MODES.map((chatMode) => {
            const checked = availabilityModes.includes(chatMode);
            const isLastSelected = checked && availabilityModes.length === 1;
            return (
              <label
                key={chatMode}
                className="flex min-h-11 items-center gap-2 text-xs font-medium"
                data-ltm-availability-mode-label={chatMode}
              >
                <input
                  type="checkbox"
                  className={sourceCheckboxClass}
                  data-ltm-availability-mode-checkbox={chatMode}
                  checked={checked}
                  disabled={disabled || availabilityDisabled || isLastSelected}
                  onChange={() => {
                    const next = checked
                      ? availabilityModes.filter((m) => m !== chatMode)
                      : [...availabilityModes, chatMode];
                    if (next.length > 0) {
                      onAvailabilityModesChange(next);
                    }
                  }}
                />
                <span>{localizedLabel(chatMode, localizeUi, labelKeys.mode)}</span>
              </label>
            );
          })}
        </div>
        {modesError ? (
          <p role="alert" className="text-xs text-[var(--destructive)]">
            {modesError}
          </p>
        ) : null}
      </fieldset>
      {selectedTargets.length ? (
        <div className="shrink-0 space-y-2">
          <p className="text-xs font-semibold">{localizeUi("ui.longTermMemory.sourcesworkspace.selectedLocations")}</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedTargets.map((target) => (
              <span
                key={target.id}
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs"
              >
                <span className="min-w-0">
                  <span className="block truncate">{targetDisplayLabel(target, true)}</span>
                  {target.comment ? (
                    <span className="block truncate text-xs text-[var(--muted-foreground)]">{target.comment}</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.removeLocationValue1", {
                    value1: targetDisplayLabel(target, true),
                  })}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded hover:bg-[var(--accent)]"
                  onClick={() => onChange(selectedIds.filter((id) => id !== target.id))}
                >
                  <X aria-hidden="true" size="0.75rem" />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <style>{`
        [data-ltm-destination-scope] {
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        [data-ltm-destination-scope][open] {
          flex: 1 1 auto;
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
      `}</style>
      <details data-ltm-destination-scope className="group flex min-h-0 flex-col gap-3">
        <summary
          data-ltm-tab-focus
          className="mari-editor-action flex min-h-11 shrink-0 cursor-pointer list-none items-center gap-2 px-3 py-2 text-left [&::-webkit-details-marker]:hidden"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[0.625rem] font-medium text-[var(--marinara-editor-muted)]">
              {localizeUi("ui.longTermMemory.memoryvault.availableIn")}
            </span>
            <span
              className="block truncate text-xs font-semibold text-[var(--marinara-editor-text)]"
              data-ltm-destination-scope-summary
            >
              {destinationSummary}
            </span>
          </span>
          <ChevronRight aria-hidden="true" size="0.875rem" data-ltm-destination-scope-chevron className="shrink-0" />
        </summary>
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
      {!selectedTargets.length ? (
        <span role="alert" className="block shrink-0 text-xs">
          {localizeUi("ui.longTermMemory.sourcesworkspace.chooseDestinationBeforeImport")}
        </span>
      ) : null}
      <p className="shrink-0 text-xs text-[var(--muted-foreground)]" data-ltm-import-mode-summary>
        {availabilityModes.length > 1
          ? `${localizeUi("ui.longTermMemory.memoryvault.availableIn")}: ${availabilityModes
              .map((m) => localizedLabel(m, localizeUi, labelKeys.mode))
              .join(", ")}`
          : mode === "all"
            ? source === "chats"
              ? localizeUi("ui.longTermMemory.sourcesworkspace.automatic")
              : localizeUi("ui.longTermMemory.sourcesworkspace.importsDefaultToRoleplay")
            : sourceModeLabel(mode, localizeUi)}
      </p>
    </div>
  );
}
