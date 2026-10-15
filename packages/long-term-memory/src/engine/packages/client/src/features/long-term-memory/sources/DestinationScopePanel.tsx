import { type KeyboardEvent, useId, useMemo, useState } from "react";
import { ChevronRight, Search, X } from "lucide-react";
import type { LtmMode } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { InfoPopover, inputClass } from "../shared-controls";
import { useLtmTranslation } from "../localization";
import {
  ALL_LTM_MODES,
  chatModeLabel,
  mergedDestinationScope,
  sourceCheckboxClass,
  sourceModeLabel,
  targetDisplayLabel,
  targetFitsDestinationScope,
} from "./source-shared";
import type { DestinationCategoryKind, ScopeTarget, ScopeTargetKind, Source } from "./source-shared";

export function DestinationScopePanel({
  targets,
  selectedIds,
  currentIds,
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
  currentIds: { chat?: string; branch?: string; character?: string; persona?: string };
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
  const [activeKind, setActiveKind] = useState<DestinationCategoryKind>("all");
  const [query, setQuery] = useState("");
  const categoryLabels: Record<DestinationCategoryKind, string> = {
    all: localizeUi("ui.longTermMemory.sourcesworkspace.all"),
    chat: localizeUi("ui.longTermMemory.sourcesworkspace.chats"),
    branch: localizeUi("ui.longTermMemory.sourcesworkspace.branches"),
    character: localizeUi("ui.longTermMemory.sourcesworkspace.characters"),
    persona: localizeUi("ui.longTermMemory.sourcesworkspace.personas"),
  };
  const categories: Array<[DestinationCategoryKind, string]> = [
    ["all", categoryLabels.all],
    ["chat", categoryLabels.chat],
    ["branch", categoryLabels.branch],
    ["character", categoryLabels.character],
    ["persona", categoryLabels.persona],
  ];
  const sortedTargets = useMemo(
    () => [...targets].sort((left, right) => left.label.localeCompare(right.label)),
    [targets],
  );
  const activeTargets =
    activeKind === "all" ? sortedTargets : sortedTargets.filter((target) => target.kind === activeKind);
  const needle = query.trim().toLocaleLowerCase();
  const matches = (target: ScopeTarget) =>
    `${target.label} ${target.comment ?? ""} ${target.destinationLabel ?? ""} ${target.searchText ?? ""}`
      .toLocaleLowerCase()
      .includes(needle);
  const filteredTargets = activeTargets.filter(matches);
  const selectedTargets = sortedTargets.filter((target) => selectedIds.includes(target.id));
  const destinationSummary = selectedTargets.length
    ? selectedTargets.map((target) => targetDisplayLabel(target, true)).join(", ")
    : localizeUi("ui.longTermMemory.sourcesworkspace.chooseDestination");
  const currentDestinationScope = mergedDestinationScope(selectedTargets);
  const targetExceedsLimit = (target: ScopeTarget) =>
    !selectedIds.includes(target.id) && !targetFitsDestinationScope(currentDestinationScope, target);
  const blockedTargetCount = filteredTargets.filter(targetExceedsLimit).length;
  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((value) => value !== id));
      return;
    }
    const target = sortedTargets.find((item) => item.id === id);
    if (target && !targetExceedsLimit(target)) onChange([...selectedIds, id]);
  };
  const handleCategoryKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? categories.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + categories.length) % categories.length;
    const nextKind = categories[nextIndex]![0];
    setActiveKind(nextKind);
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-ltm-availability-tab="${nextKind}"]`)?.focus(),
    );
  };
  const currentTargetByKind: Record<Exclude<ScopeTargetKind, "all">, ScopeTarget | undefined> = {
    chat: currentIds.chat ? sortedTargets.find((target) => target.id === currentIds.chat) : undefined,
    branch: currentIds.branch ? sortedTargets.find((target) => target.id === currentIds.branch) : undefined,
    character: currentIds.character ? sortedTargets.find((target) => target.id === currentIds.character) : undefined,
    persona: currentIds.persona ? sortedTargets.find((target) => target.id === currentIds.persona) : undefined,
  };
  const renderCategoryActionRow = (kind: Exclude<ScopeTargetKind, "all">) => {
    const currentTarget = currentTargetByKind[kind];
    const categoryTargets = sortedTargets.filter((target) => target.kind === kind);
    const allLabel =
      kind === "chat"
        ? localizeUi("ui.longTermMemory.sourcesworkspace.allChats")
        : kind === "branch"
          ? localizeUi("ui.longTermMemory.sourcesworkspace.allBranches")
          : kind === "character"
            ? localizeUi("ui.longTermMemory.sourcesworkspace.allCharacters")
            : localizeUi("ui.longTermMemory.memoryvault.allPersonas");
    return (
      <div className="mb-2 divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
        {currentTarget ? (
          <button
            type="button"
            data-ltm-availability-action={`${kind}:current`}
            aria-pressed={selectedIds.includes(currentTarget.id)}
            disabled={disabled}
            className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--secondary)]/30"
            onClick={() => toggle(currentTarget.id)}
          >
            <span className="min-w-0 flex-1 truncate font-semibold">
              {localizeUi("ui.longTermMemory.sourcesworkspace.current")}
            </span>
            <span className="truncate text-xs text-[var(--muted-foreground)]">{currentTarget.label}</span>
          </button>
        ) : null}
        <button
          type="button"
          data-ltm-availability-action={`${kind}:all`}
          aria-pressed={
            categoryTargets.length > 0 && categoryTargets.every((target) => selectedIds.includes(target.id))
          }
          disabled={disabled}
          className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--secondary)]/30"
          onClick={() => {
            const nextIds = [...selectedIds];
            const nextTargets = [...selectedTargets];
            for (const target of categoryTargets) {
              if (
                nextIds.includes(target.id) ||
                !targetFitsDestinationScope(mergedDestinationScope(nextTargets), target)
              )
                continue;
              nextIds.push(target.id);
              nextTargets.push(target);
            }
            onChange(nextIds);
            setQuery("");
          }}
        >
          <span className="min-w-0 flex-1 truncate">{allLabel}</span>
        </button>
      </div>
    );
  };
  const renderTarget = (target: ScopeTarget) => (
    <label
      key={target.id}
      data-ltm-availability-target={`${target.kind}:${target.id.split(":").slice(1).join(":")}`}
      className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-[var(--secondary)]/30"
    >
      <input
        type="checkbox"
        className={sourceCheckboxClass}
        checked={selectedIds.includes(target.id)}
        disabled={disabled || targetExceedsLimit(target)}
        title={
          targetExceedsLimit(target)
            ? localizeUi("ui.longTermMemory.sourcesworkspace.destinationScopeLimitReached")
            : undefined
        }
        onChange={() => toggle(target.id)}
        aria-label={targetDisplayLabel(target, true)}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-normal">{target.label}</span>
        {target.comment ? (
          <span className="block truncate text-xs text-[var(--muted-foreground)]">{target.comment}</span>
        ) : null}
      </span>
    </label>
  );
  const groupedKinds: Array<Exclude<ScopeTargetKind, "all">> = ["chat", "branch", "character", "persona"];
  const destinationPickerList =
    activeKind === "all" ? (
      <div className="space-y-3">
        {groupedKinds.map((kind) => {
          const kindTargets = filteredTargets.filter((target) => target.kind === kind);
          if (!kindTargets.length) return null;
          return (
            <section key={kind}>
              <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                {categoryLabels[kind]}
              </p>
              <div className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
                {kindTargets.map(renderTarget)}
              </div>
            </section>
          );
        })}
        {!filteredTargets.length ? (
          <p className="rounded-md border border-[var(--border)] px-3 py-4 text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.longTermMemory.sourcesworkspace.noMatchingScopes")}
          </p>
        ) : null}
      </div>
    ) : (
      <>
        {renderCategoryActionRow(activeKind)}
        {filteredTargets.length ? (
          <div className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
            {filteredTargets.map(renderTarget)}
          </div>
        ) : (
          <p className="rounded-md border border-[var(--border)] px-3 py-4 text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.longTermMemory.sourcesworkspace.noMatchingScopes")}
          </p>
        )}
      </>
    );
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
                <span>{chatModeLabel(chatMode, localizeUi)}</span>
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
        <summary className="mari-editor-action flex min-h-11 shrink-0 cursor-pointer list-none items-center gap-2 px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)] [&::-webkit-details-marker]:hidden">
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
        <label className="relative block shrink-0">
          <Search
            aria-hidden="true"
            size="0.875rem"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
          <input
            className={`${inputClass} pl-9`}
            value={query}
            placeholder={localizeUi("ui.longTermMemory.sourcesworkspace.searchScopes")}
            aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.searchScopes")}
            aria-controls="ltm-bulk-destination-list"
            data-ltm-availability-search={activeKind}
            disabled={disabled}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div
          role="tablist"
          aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.makeMemoriesAvailableIn")}
          className="grid shrink-0 grid-cols-2 gap-1 sm:grid-cols-5"
        >
          {categories.map(([kind, label], index) => {
            const count =
              kind === "all"
                ? selectedIds.length
                : selectedIds.filter((id) => sortedTargets.some((target) => target.id === id && target.kind === kind))
                    .length;
            return (
              <button
                key={kind}
                type="button"
                role="tab"
                aria-selected={activeKind === kind}
                aria-controls="ltm-bulk-destination-list"
                tabIndex={activeKind === kind ? 0 : -1}
                data-ltm-availability-tab={kind}
                data-active={activeKind === kind}
                className="mari-editor-tab min-h-11 min-w-0 rounded-md border px-2 text-xs font-semibold"
                onClick={() => setActiveKind(kind)}
                onKeyDown={(event) => handleCategoryKey(event, index)}
              >
                <span className="block truncate">{label}</span>
                <span className="text-xs text-[var(--muted-foreground)]">{count}</span>
              </button>
            );
          })}
        </div>
        {blockedTargetCount ? (
          <p role="note" className="shrink-0 text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.longTermMemory.sourcesworkspace.destinationScopeLimitReached")}
          </p>
        ) : null}
        <div
          id="ltm-bulk-destination-list"
          role="tabpanel"
          aria-label={categoryLabels[activeKind]}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {destinationPickerList}
        </div>
      </details>
      {!selectedTargets.length ? (
        <span role="alert" className="block shrink-0 text-xs">
          {localizeUi("ui.longTermMemory.sourcesworkspace.chooseDestinationBeforeImport")}
        </span>
      ) : null}
      <p className="shrink-0 text-xs text-[var(--muted-foreground)]" data-ltm-import-mode-summary>
        {availabilityModes.length > 1
          ? `${localizeUi("ui.longTermMemory.memoryvault.availableIn")}: ${availabilityModes
              .map((m) => chatModeLabel(m, localizeUi))
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
