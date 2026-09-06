import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Ellipsis,
  FileInput,
  Loader2,
  ListChecks,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  X,
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
  LtmSourceDetailsResponse,
  LtmScope,
  LtmExtractSourceNoteResponse,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { invalidateLtmQueries, ltmScopeTargetsKey, queryKeys, request } from "./api";
import { Button, ClickSurface, IconButton, InfoPopover, StatusSurface, inputClass } from "./shared-controls";
import { humanizeLabel, labelKeys, localizedLabel, noteTypeLabel } from "./display-labels";
import type { LongTermMemoryDestinationProps, SourceTab } from "./types";
import { useLtmTranslation, type LtmTranslationFunction } from "./localization";
import { LtmWorkspace } from "./LtmWorkspace";
import type { LtmWorkspacePane } from "./LtmWorkspace";
import {
  cancelLtmSourceTask,
  getLtmSourceTaskSnapshot,
  markLtmSourceTaskViewed,
  startLtmSourceTask,
  subscribeLtmSourceTask,
  type LtmSourceTaskContract,
} from "./source-task";
import { buildScopeIndexes, type ScopeTargetChat, type ScopeTargets } from "./scope-targets";
import {
  normalizeLtmScope,
  withMergedLtmScopeLinks,
} from "../../../../shared/src/features/agents/long-term-memory/scope.js";

type Source = SourceTab;
type SourceStatusFilter = "all" | "ready" | "imported";
type PreviewRow = LtmInteropPreviewResponse["samples"][number];
type LorebookCandidate = LtmInteropPreviewSample;
type SourceOperation = "copy" | "move" | "archive" | "delete";
type ImportContract = {
  source: Source;
  sourceIds: string[];
  action: "import" | "refresh";
  sourceScope?: LtmScope;
  destinationScope?: LtmScope;
  sourceTargetLabel: string;
  destinationTargetLabel: string;
  mode?: LtmMode;
  chatId?: string;
  selectionKey: string;
};
type ScopeTargetKind = "all" | "chat" | "branch" | "character" | "persona";
type ScopeTarget = {
  id: string;
  label: string;
  comment?: string;
  destinationLabel?: string;
  kind: ScopeTargetKind;
  sourceScope?: LtmScope;
  destinationScope?: LtmScope;
  searchText?: string;
  pinned?: "current" | "all";
};

function targetDisplayLabel(target: ScopeTarget, destination: boolean) {
  return destination ? (target.destinationLabel ?? target.label) : target.label;
}

function ScopeTargetPicker({
  targets,
  value,
  onChange,
  ariaLabel,
  testId,
  destination = false,
  required = false,
  invalid = false,
  disabled = false,
}: {
  targets: ScopeTarget[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  testId: string;
  destination?: boolean;
  required?: boolean;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const groups: Array<[Exclude<ScopeTargetKind, "all">, string]> = [
    ["chat", localizeUi("ui.longTermMemory.sourcesworkspace.chats")],
    ["branch", localizeUi("ui.longTermMemory.sourcesworkspace.branches")],
    ["character", localizeUi("ui.longTermMemory.sourcesworkspace.characters")],
    ["persona", localizeUi("ui.longTermMemory.sourcesworkspace.personas")],
  ];
  const selectedTarget = targets.find((target) => target.id === value);
  const needle = query.trim().toLocaleLowerCase();
  const matches = (target: ScopeTarget) =>
    `${target.label} ${target.comment ?? ""} ${target.destinationLabel ?? ""} ${target.searchText ?? ""}`
      .toLocaleLowerCase()
      .includes(needle);
  const pinnedTargets = targets.filter((target) => target.pinned);
  const filteredTargets = targets.filter((target) => matches(target));
  const regularTargets = filteredTargets.filter((target) => !target.pinned);
  const selectedRegularTarget =
    selectedTarget && !selectedTarget.pinned && matches(selectedTarget) ? selectedTarget : null;
  const optionTargets = [
    ...pinnedTargets,
    ...(selectedRegularTarget ? [selectedRegularTarget] : []),
    ...groups.flatMap(([kind]) => regularTargets.filter((target) => target.kind === kind && target.id !== value)),
  ];
  const [highlightedId, setHighlightedId] = useState(value);
  useEffect(() => setHighlightedId(value), [value]);
  const close = () => {
    setOpen(false);
    setQuery("");
    requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => searchRef.current?.focus());
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const choose = (target: ScopeTarget) => {
    onChange(target.id);
    close();
  };
  const moveHighlight = (direction: 1 | -1) => {
    if (!optionTargets.length) return;
    const currentIndex = optionTargets.findIndex((target) => target.id === highlightedId);
    const nextIndex =
      currentIndex < 0
        ? direction === 1
          ? 0
          : optionTargets.length - 1
        : (currentIndex + direction + optionTargets.length) % optionTargets.length;
    setHighlightedId(optionTargets[nextIndex]!.id);
  };
  const option = (target: ScopeTarget) => (
    <button
      key={target.id}
      type="button"
      role="option"
      id={`${listId}-option-${target.id}`}
      aria-selected={target.id === value}
      data-highlighted={target.id === highlightedId}
      data-ltm-scope-option={target.id}
      className="mari-editor-action mari-editor-action--compact flex min-h-11 w-full items-center gap-2 rounded-none border-x-0 border-t-0 px-3 py-2 text-left text-xs last:border-b-0 data-[highlighted=true]:bg-[var(--secondary)] aria-selected:bg-[var(--primary)]/10"
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={() => setHighlightedId(target.id)}
      onClick={() => choose(target)}
    >
      <Check
        aria-hidden="true"
        size="0.875rem"
        className={target.id === value ? "shrink-0 text-[var(--marinara-editor-accent)]" : "shrink-0 opacity-0"}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{targetDisplayLabel(target, destination)}</span>
        {target.comment ? (
          <span className="block truncate text-xs text-[var(--muted-foreground)]">{target.comment}</span>
        ) : null}
      </span>
    </button>
  );
  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 sm:max-w-[36rem]" data-ltm-scope-picker={testId}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        aria-required={required}
        aria-invalid={invalid}
        disabled={disabled}
        data-ltm-scope-picker-trigger={testId}
        className={`${inputClass} flex items-center gap-2 text-left`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (["Enter", " ", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="min-w-0 flex-1">
          <span
            className="block truncate"
            title={selectedTarget ? targetDisplayLabel(selectedTarget, destination) : undefined}
          >
            {selectedTarget
              ? targetDisplayLabel(selectedTarget, destination)
              : localizeUi("ui.longTermMemory.sourcesworkspace.chooseDestination")}
          </span>
          {selectedTarget?.comment ? (
            <span className="block truncate text-xs text-[var(--muted-foreground)]">{selectedTarget.comment}</span>
          ) : null}
        </span>
        <ChevronDown
          aria-hidden="true"
          size="0.875rem"
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div
          className="absolute left-0 top-full z-30 mt-2 w-full min-w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-[var(--marinara-editor-divider)] bg-[var(--card)] shadow-xl"
          data-ltm-scope-picker-popup
        >
          <label className="relative block border-b border-[var(--marinara-editor-divider)] p-2">
            <Search
              aria-hidden="true"
              size="0.875rem"
              className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              ref={searchRef}
              className={`${inputClass} pl-9`}
              value={query}
              placeholder={localizeUi("ui.longTermMemory.sourcesworkspace.searchScopes")}
              aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.searchScopes")}
              aria-controls={listId}
              aria-activedescendant={
                highlightedId && optionTargets.some((target) => target.id === highlightedId)
                  ? `${listId}-option-${highlightedId}`
                  : undefined
              }
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlightedId("");
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  moveHighlight(event.key === "ArrowDown" ? 1 : -1);
                } else if (event.key === "Enter") {
                  const target = optionTargets.find((item) => item.id === highlightedId);
                  if (target) {
                    event.preventDefault();
                    choose(target);
                  }
                }
              }}
            />
          </label>
          <div id={listId} role="listbox" aria-label={ariaLabel} className="max-h-72 overflow-y-auto">
            {pinnedTargets.map(option)}
            {selectedRegularTarget ? (
              <div className="border-b border-[var(--marinara-editor-divider)]">
                <p className="bg-[var(--secondary)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  {localizeUi("ui.longTermMemory.sourcesworkspace.selectedLocation")}
                </p>
                {option(selectedRegularTarget)}
              </div>
            ) : null}
            {groups.map(([kind, label]) => {
              const options = regularTargets.filter((target) => target.kind === kind && target.id !== value);
              return options.length ? (
                <div key={kind}>
                  <p className="border-b border-[var(--marinara-editor-divider)] bg-[var(--secondary)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                    {label}
                  </p>
                  {options.map(option)}
                </div>
              ) : null;
            })}
            {!optionTargets.length ? (
              <p className="px-3 py-4 text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.longTermMemory.sourcesworkspace.noMatchingScopes")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function mergedDestinationScope(targets: ScopeTarget[]) {
  const primary = targets[0]?.destinationScope;
  if (!primary) return undefined;
  return targets.slice(1).reduce((scope, target) => {
    return target.destinationScope ? withMergedLtmScopeLinks(scope, target.destinationScope) : scope;
  }, normalizeLtmScope(primary));
}

const MAX_DESTINATION_SCOPE_IDS = 100;

function destinationScopeIds(scope: LtmScope | undefined) {
  const normalized = normalizeLtmScope(scope);
  return {
    chatIds: normalized.chatIds ?? [],
    groupIds: normalized.groupIds ?? [],
    characterIds: normalized.characterIds ?? [],
    personaIds: normalized.personaIds ?? [],
  };
}

function hasDestinationScopeCapacity(scope: LtmScope | undefined) {
  return Object.values(destinationScopeIds(scope)).every((ids) => !ids || ids.length <= MAX_DESTINATION_SCOPE_IDS);
}

function targetFitsDestinationScope(scope: LtmScope | undefined, target: ScopeTarget) {
  const current = destinationScopeIds(scope);
  const candidate = destinationScopeIds(target.destinationScope);
  return (Object.keys(candidate) as Array<keyof typeof candidate>).every((key) => {
    const additionalIds = candidate[key].filter((id) => !current[key].includes(id));
    return additionalIds.length <= MAX_DESTINATION_SCOPE_IDS - current[key].length;
  });
}

type DestinationCategoryKind = "all" | Exclude<ScopeTargetKind, "all">;

function DestinationScopePanel({
  targets,
  selectedIds,
  currentIds,
  onChange,
  mode,
  source,
  disabled = false,
}: {
  targets: ScopeTarget[];
  selectedIds: string[];
  currentIds: { chat?: string; branch?: string; character?: string; persona?: string };
  onChange: (ids: string[]) => void;
  mode: LtmMode | "all";
  source: Source;
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
            className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--secondary)]/35"
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
          className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--secondary)]/35"
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
      className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-[var(--secondary)]/35"
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
      {!selectedTargets.length ? (
        <span role="alert" className="block shrink-0 text-xs text-[var(--marinara-editor-warning)]">
          {localizeUi("ui.longTermMemory.sourcesworkspace.chooseDestinationBeforeImport")}
        </span>
      ) : null}
      <p className="shrink-0 text-xs text-[var(--muted-foreground)]" data-ltm-import-mode-summary>
        {mode === "all"
          ? source === "chats"
            ? localizeUi("ui.longTermMemory.sourcesworkspace.automatic")
            : localizeUi("ui.longTermMemory.sourcesworkspace.importsDefaultToRoleplay")
          : sourceModeLabel(mode, localizeUi)}
      </p>
    </div>
  );
}
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
const sourceCheckboxClass = "size-6 shrink-0 accent-[var(--marinara-editor-accent)]";
const mobilePrimaryActionsClass =
  "sticky bottom-0 z-10 flex flex-wrap gap-2 border-t border-[var(--border)] bg-[var(--card)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:static md:border-0 md:bg-transparent md:p-0";

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
      : tone === "danger"
        ? "border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 text-[var(--destructive)]"
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

function sourceModeLabel(mode: LtmMode, localizeUi: LtmTranslationFunction) {
  const labels: Record<LtmMode, string> = {
    conversation: "ui.longTermMemory.sourcesworkspace.conversation",
    roleplay: "ui.longTermMemory.sourcesworkspace.roleplay",
    game: "ui.longTermMemory.sourcesworkspace.game",
  };
  return localizeUi("ui.longTermMemory.sourcesworkspace.importsAsMode", {
    mode: localizeUi(labels[mode]),
  });
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
  onChange: (id: T) => boolean | void | Promise<boolean | void>,
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
  void Promise.resolve(onChange(next)).then((changed) => {
    if (changed !== false)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => document.querySelector<HTMLElement>(`[${selector}="${next}"]`)?.focus()),
      );
  });
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
      className={sourceCheckboxClass}
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
      setError(
        error instanceof Error ? error.message : localizeUi("ui.longTermMemory.sourceoperation.previewCouldNotLoad"),
      );
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

function ImportedSourceInspector({
  source,
  disabled,
  bulkActive,
  onOpenMemory,
  onOpenReview,
  onReextract,
  onManage,
}: {
  source: { id: string; title: string };
  disabled: boolean;
  bulkActive: boolean;
  onOpenMemory?: (id: string) => void;
  onOpenReview?: (id: string) => void;
  onReextract: (id: string) => void;
  onManage: (id: string, title: string, operation: SourceOperation) => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  if (bulkActive) return null;
  return (
    <div className="space-y-3" data-ltm-source-inspector>
      <div className="space-y-2">
        <Button onClick={() => onOpenMemory?.(source.id)} data-ltm-source-inspector-action="open-memory">
          {localizeUi("ui.longTermMemory.sourcesworkspace.openSourceMemory")}
        </Button>
        <Button onClick={() => onOpenReview?.(source.id)} data-ltm-source-inspector-action="review-drafts">
          {localizeUi("ui.longTermMemory.memoryvault.reviewRelatedDrafts")}
        </Button>
        <Button
          disabled={disabled}
          onClick={() => onReextract(source.id)}
          data-ltm-source-inspector-action="re-extract"
        >
          <Sparkles aria-hidden="true" size="0.75rem" />
          {localizeUi("ui.longTermMemory.sourcesworkspace.reExtract")}
        </Button>
      </div>
      <details data-ltm-source-management>
        <summary className="cursor-pointer text-xs font-semibold">
          {localizeUi("ui.longTermMemory.sourceoperation.manageSource")}
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["copy", "move", "archive", "delete"] as const).map((operation) => (
            <Button
              key={operation}
              disabled={disabled}
              destructive={operation === "delete"}
              onClick={() => onManage(source.id, source.title, operation)}
              data-ltm-source-management-action={operation}
            >
              {localizeUi(`ui.longTermMemory.sourceoperation.${operation}`)}
            </Button>
          ))}
        </div>
      </details>
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
  const confirmAction = props.confirmAction;
  const sourceScopeLabelId = useId();
  const importResultLabelId = useId();
  const client = useQueryClient();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const importResultRef = useRef<HTMLElement>(null);
  const sourceTask = useSyncExternalStore(subscribeLtmSourceTask, getLtmSourceTaskSnapshot, getLtmSourceTaskSnapshot);
  const [source, setSource] = useState<Source>(selectedSource ?? "chats");
  const [selectedLorebookId, setSelectedLorebookId] = useState<string | null>(null);
  const [requestedSourceNoteId, setRequestedSourceNoteId] = useState<string | null>(null);
  const [workspacePane, setWorkspacePane] = useState<LtmWorkspacePane>("navigator");
  const [sourceContextKey, setSourceContextKey] = useState(props.chatId ?? "all");
  const [sourceTargetId, setSourceTargetId] = useState(props.chatId ? `chat:${props.chatId}` : "all");
  const [selectedDestinationTargetIds, setSelectedDestinationTargetIds] = useState<string[]>(
    props.chatId ? [`chat:${props.chatId}`] : [],
  );
  const [modeFilter, setModeFilter] = useState<LtmMode | "all">("all");
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceStatusFilter, setSourceStatusFilter] = useState<SourceStatusFilter>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [sourceGroupsOpen, setSourceGroupsOpen] = useState<Record<Source, { ready: boolean; imported: boolean }>>({
    chats: { ready: false, imported: false },
    characters: { ready: false, imported: false },
    lorebooks: { ready: false, imported: false },
  });
  const sourceGroupsBeforeSearch = useRef<Record<Source, { ready: boolean; imported: boolean }> | null>(null);
  const sourceSearchContext = useRef<Source | null>(null);
  const sourceQueryByType = useRef<Record<Source, string>>({ chats: "", characters: "", lorebooks: "" });
  const sourceStatusByType = useRef<Record<Source, SourceStatusFilter>>({
    chats: "all",
    characters: "all",
    lorebooks: "all",
  });
  const focusedSourceByType = useRef<Record<Source, string | null>>({ chats: null, characters: null, lorebooks: null });
  const focusedLorebookByType = useRef<Record<Source, string | null>>({
    chats: null,
    characters: null,
    lorebooks: null,
  });
  const openLorebookEntryByType = useRef<Record<Source, string | null>>({
    chats: null,
    characters: null,
    lorebooks: null,
  });
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [focusedFlatSourceId, setFocusedFlatSourceId] = useState<string | null>(null);
  const [openLorebookEntryId, setOpenLorebookEntryId] = useState<string | null>(null);
  const [importError, setImportError] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [latestTaskResultOpen, setLatestTaskResultOpen] = useState(false);
  const [dismissedTaskResultId, setDismissedTaskResultId] = useState<string | null>(null);
  const [resultWorkbenchHost, setResultWorkbenchHost] = useState<HTMLDivElement | null>(null);
  const [sourceOperation, setSourceOperation] = useState<{
    id: string;
    title: string;
    operation?: SourceOperation;
  } | null>(null);
  const [openSourceActionId, setOpenSourceActionId] = useState<string | null>(null);
  const importing =
    sourceTask.active?.status === "running" &&
    (sourceTask.active.kind === "import" || sourceTask.active.kind === "refresh");
  const extractingId =
    sourceTask.active?.status === "running" && sourceTask.active.kind === "re-extract"
      ? (sourceTask.active.contract.sourceIds[0] ?? null)
      : null;
  const importTask =
    sourceTask.active?.kind === "import" || sourceTask.active?.kind === "refresh"
      ? sourceTask.active
      : sourceTask.latest?.kind === "import" || sourceTask.latest?.kind === "refresh"
        ? sourceTask.latest
        : null;
  const importResult = importTask?.status === "completed" ? (importTask.result as LtmImportSourceNotesResponse) : null;
  const visibleImportResult = importTask?.id === dismissedTaskResultId ? null : importResult;
  const importResultContract = importTask?.contract as ImportContract | null;
  const cancelledImport = importTask?.status === "cancelled" ? importResultContract : null;
  const reextractTask =
    sourceTask.active?.kind === "re-extract"
      ? sourceTask.active
      : sourceTask.latest?.kind === "re-extract"
        ? sourceTask.latest
        : null;
  const reextractResult =
    reextractTask?.status === "completed" ? (reextractTask.result as LtmExtractSourceNoteResponse | undefined) : null;
  const retryableReextract =
    reextractTask?.status === "failed" || reextractTask?.status === "cancelled" ? reextractTask : null;
  const failedSourceTask =
    importTask && (importTask.status === "failed" || importTask.status === "cancelled")
      ? importTask
      : reextractTask && (reextractTask.status === "failed" || reextractTask.status === "cancelled")
        ? reextractTask
        : null;
  const sourceTaskError = failedSourceTask?.error?.message
    ? failedSourceTask.error.message
    : failedSourceTask?.error?.code === "interrupted"
      ? localizeUi("ui.longTermMemory.sourcesworkspace.sourceTaskInterrupted")
      : failedSourceTask?.error?.code === "cancelled"
        ? localizeUi("ui.longTermMemory.sourcesworkspace.sourceTaskCancelled")
        : failedSourceTask
          ? localizeUi("ui.longTermMemory.sourcesworkspace.sourceTaskFailed")
          : "";

  const scopeTargets = useQuery({
    queryKey: ltmScopeTargetsKey(props.chatId),
    staleTime: 30_000,
    queryFn: () =>
      request<ScopeTargets>(
        `/scope-targets?includeAllChats=true${props.chatId ? `&chatId=${encodeURIComponent(props.chatId)}` : ""}`,
      ),
  });
  const scopeIndexes = useMemo(() => buildScopeIndexes(scopeTargets.data?.chats ?? []), [scopeTargets.data?.chats]);
  const scopeTargetOptions = useMemo(() => {
    const currentChatId = props.chatId ?? scopeTargets.data?.currentScope?.chatId;
    const chatTarget = (chat: ScopeTargetChat, current = false): ScopeTarget => ({
      id: `chat:${chat.id}`,
      label: current ? localizeUi("ui.longTermMemory.sourcesworkspace.current") : chat.label,
      kind: "chat",
      sourceScope: current
        ? (scopeTargets.data?.currentScope ?? { chatId: chat.id, chatIds: [chat.id] })
        : { chatId: chat.id, chatIds: [chat.id] },
      destinationScope: current
        ? (scopeTargets.data?.currentScope ?? { chatId: chat.id, chatIds: [chat.id] })
        : { chatId: chat.id, chatIds: [chat.id] },
      searchText: [chat.mode, chat.groupId, chat.personaId, ...chat.characterIds].filter(Boolean).join(" "),
      ...(current ? { pinned: "current" as const } : {}),
    });
    return [
      ...(currentChatId
        ? [
            chatTarget(
              scopeIndexes.chatsById.get(currentChatId) ?? {
                id: currentChatId,
                label: props.chatName ?? localizeUi("ui.longTermMemory.sourcesworkspace.currentChat"),
                mode: "roleplay",
                groupId: null,
                personaId: null,
                characterIds: [],
              },
              true,
            ),
          ]
        : []),
      {
        id: "all",
        label: localizeUi("ui.longTermMemory.sourcesworkspace.all"),
        kind: "all" as const,
        pinned: "all" as const,
        sourceScope: undefined,
        destinationScope: undefined,
      },
      ...(scopeTargets.data?.chats ?? [])
        .filter((chat) => chat.id !== currentChatId && !chat.groupId)
        .map((chat) => chatTarget(chat)),
      ...(scopeTargets.data?.groups ?? []).map((group) => ({
        id: `group:${group.id}`,
        label: `${localizeUi("ui.longTermMemory.sourcesworkspace.allBranches")}: ${group.label}`,
        kind: "branch" as const,
        sourceScope: { groupId: group.id, groupIds: [group.id], chatIds: group.chatIds },
        destinationScope: { groupId: group.id, groupIds: [group.id], chatIds: group.chatIds },
        searchText: group.chatIds.join(" "),
      })),
      ...(scopeTargets.data?.characters ?? []).map((character) => ({
        id: `character:${character.id}`,
        label: character.label,
        comment: character.comment,
        destinationLabel: localizeUi("ui.longTermMemory.sourcesworkspace.characterAvailability", {
          value1: character.label,
        }),
        kind: "character" as const,
        sourceScope: { characterIds: [character.id] },
        destinationScope: { characterIds: [character.id] },
      })),
      ...(scopeTargets.data?.personas ?? []).map((persona) => ({
        id: `persona:${persona.id}`,
        label: persona.label,
        comment: persona.comment,
        destinationLabel: localizeUi("ui.longTermMemory.sourcesworkspace.personaAvailability", {
          value1: persona.label,
        }),
        kind: "persona" as const,
        sourceScope: { personaId: persona.id, personaIds: [persona.id] },
        destinationScope: { personaId: persona.id, personaIds: [persona.id] },
      })),
    ].filter((target, index, targets) => targets.findIndex((item) => item.id === target.id) === index);
  }, [localizeUi, props.chatId, props.chatName, scopeIndexes.chatsById, scopeTargets.data]);
  const sourceTarget =
    scopeTargetOptions.find((target) => target.id === sourceTargetId) ??
    scopeTargetOptions.find((target) => target.id === "all") ??
    scopeTargetOptions[0];
  const sourceContextMatchesProps = sourceContextKey === (props.chatId ?? "all");
  const sourceTargetResolved = Boolean(sourceTarget && scopeTargets.isSuccess);
  const destinationTargets = useMemo(
    () =>
      scopeTargetOptions.filter(
        (target) => target.kind !== "all" && hasDestinationScopeCapacity(target.destinationScope),
      ),
    [scopeTargetOptions],
  );
  const selectedDestinationTargets = selectedDestinationTargetIds.flatMap((id) => {
    const target = destinationTargets.find((item) => item.id === id);
    return target ? [target] : [];
  });
  const currentDestinationScope = mergedDestinationScope(selectedDestinationTargets);
  const currentDestinationLabel = selectedDestinationTargets.length
    ? selectedDestinationTargets.map((target) => targetDisplayLabel(target, true)).join(", ")
    : localizeUi("ui.longTermMemory.sourcesworkspace.chooseDestination");
  const currentDestinationIds = useMemo(() => {
    const currentChatId = props.chatId ?? scopeTargets.data?.currentScope?.chatId;
    const currentChatRecord = currentChatId ? scopeIndexes.chatsById.get(currentChatId) : undefined;
    const branchId = currentChatRecord?.groupId ?? null;
    const characterIds = currentChatRecord?.characterIds ?? [];
    const personaId = currentChatRecord?.personaId ?? null;
    return {
      chat: currentChatId ? `chat:${currentChatId}` : undefined,
      branch:
        branchId && destinationTargets.some((target) => target.id === `group:${branchId}`)
          ? `group:${branchId}`
          : undefined,
      character:
        characterIds.length === 1 && destinationTargets.some((target) => target.id === `character:${characterIds[0]}`)
          ? `character:${characterIds[0]}`
          : undefined,
      persona:
        personaId && destinationTargets.some((target) => target.id === `persona:${personaId}`)
          ? `persona:${personaId}`
          : undefined,
    };
  }, [destinationTargets, props.chatId, scopeIndexes.chatsById, scopeTargets.data?.currentScope?.chatId]);
  const sourceScope = sourceTarget?.sourceScope;
  const previewScope =
    source === "chats" || source === "lorebooks" || (source === "characters" && sourceTarget?.kind === "character")
      ? sourceScope
      : undefined;
  const effectiveImportScope = `${sourceTargetId}:${[...selectedDestinationTargetIds].sort().join(",")}`;
  const preview = useQuery({
    queryKey: [...queryKeys.preview, source, previewScope, modeFilter, sourceQuery],
    queryFn: () =>
      request<
        LtmInteropPreviewResponse,
        { source: Source; limit: number; sourceScope?: LtmScope; mode?: LtmMode; query?: string }
      >("/import/preview", "POST", {
        source,
        limit: 100,
        ...(previewScope ? { sourceScope: previewScope } : {}),
        ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
        ...(sourceQuery.trim() ? { query: sourceQuery } : {}),
      }),
    enabled: sourceContextMatchesProps && sourceTargetResolved && source !== "lorebooks",
  });
  const lorebookPreview = useQuery({
    queryKey: [...queryKeys.lorebookPreview, previewScope, modeFilter, sourceQuery],
    queryFn: () =>
      request<LtmLorebookPreviewResponse, { limit: number; sourceScope?: LtmScope; mode?: LtmMode; query?: string }>(
        "/import/lorebooks/preview",
        "POST",
        {
          limit: 100,
          ...(previewScope ? { sourceScope: previewScope } : {}),
          ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
          ...(sourceQuery.trim() ? { query: sourceQuery } : {}),
        },
      ),
    enabled: sourceContextMatchesProps && sourceTargetResolved && source === "lorebooks",
  });
  const sourceDetails = useQuery({
    queryKey: [...queryKeys.preview, "details", source, previewScope, modeFilter, focusedFlatSourceId],
    queryFn: () =>
      request<
        LtmSourceDetailsResponse,
        { source: Source; sourceIds: string[]; sourceScope?: LtmScope; mode?: LtmMode }
      >("/import/source-details", "POST", {
        source,
        sourceIds: [focusedFlatSourceId!],
        ...(previewScope ? { sourceScope: previewScope } : {}),
        ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
      }),
    enabled:
      scopeTargets.isSuccess &&
      Boolean(sourceTarget) &&
      sourceContextMatchesProps &&
      sourceTargetResolved &&
      source !== "lorebooks" &&
      focusedFlatSourceId !== null,
  });
  const previewData = sourceContextMatchesProps && sourceTargetResolved ? preview.data : undefined;
  const lorebookPreviewData = sourceContextMatchesProps && sourceTargetResolved ? lorebookPreview.data : undefined;
  const sourceDetailsData = sourceContextMatchesProps && sourceTargetResolved ? sourceDetails.data : undefined;
  const rows = [...(previewData?.samples ?? [])].sort((left, right) => {
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
  const lorebookImportSelectionKey = `${selectionKey}:lorebook-import`;
  const lorebookRefreshSelectionKey = `${selectionKey}:lorebook-refresh`;
  const selectedLorebookImportIds = new Set(selections[lorebookImportSelectionKey] ?? []);
  const selectedLorebookRefreshIds = new Set(selections[lorebookRefreshSelectionKey] ?? []);
  const selectedLorebook = lorebookPreviewData?.books.find((book) => book.id === selectedLorebookId) ?? null;
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
  const activeFlatRows =
    sourceStatusFilter === "ready" ? selectableRows : sourceStatusFilter === "imported" ? importedRows : rows;
  const activeFlatSelection = new Set([...selectedIds, ...selectedImportedIds]);
  const selectedFlatSourceIds = [...new Set([...selectedIds, ...selectedImportedIds])];
  const activeFlatSelectedIds = activeFlatRows
    .filter((row) => activeFlatSelection.has(row.sourceId))
    .map((row) => row.sourceId);
  const activeFlatAllSelected = activeFlatRows.length > 0 && activeFlatSelectedIds.length === activeFlatRows.length;
  const focusedFlatRow = rows.find((row) => row.sourceId === focusedFlatSourceId) ?? null;
  const focusedFlatDetail =
    sourceDetailsData?.details.find((detail) => detail.sourceId === focusedFlatSourceId) ?? null;
  const openLorebookEntry = selectedLorebook?.entries.find((entry) => entry.id === openLorebookEntryId);
  const openLorebookSourceIds = openLorebookEntry?.candidates.map((candidate) => candidate.sourceId) ?? [];
  const lorebookDetails = useQuery({
    queryKey: [...queryKeys.lorebookPreview, "details", previewScope, modeFilter, openLorebookSourceIds],
    queryFn: () =>
      request<
        LtmSourceDetailsResponse,
        { source: Source; sourceIds: string[]; sourceScope?: LtmScope; mode?: LtmMode }
      >("/import/source-details", "POST", {
        source: "lorebooks",
        sourceIds: openLorebookSourceIds,
        ...(previewScope ? { sourceScope: previewScope } : {}),
        ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
      }),
    enabled: source === "lorebooks" && openLorebookSourceIds.length > 0,
  });
  const allLorebooks = lorebookPreviewData?.books ?? [];
  const activeLorebooks = allLorebooks.filter((book) =>
    sourceStatusFilter === "all"
      ? true
      : sourceStatusFilter === "ready"
        ? book.totals.pending > 0
        : book.totals.pending === 0 && book.totals.imported > 0,
  );
  const focusedLorebookCandidate = openLorebookEntry?.candidates.find((candidate) => candidate.status === "imported");
  const focusedImportedSource =
    focusedFlatRow?.status === "imported"
      ? { id: focusedFlatRow.existingNoteId, title: focusedFlatRow.existingNoteTitle }
      : focusedLorebookCandidate?.status === "imported"
        ? { id: focusedLorebookCandidate.existingNoteId, title: focusedLorebookCandidate.existingNoteTitle }
        : null;
  const bulkSelectionActive = selectedFlatSourceIds.length > 0 || selectedLorebookCandidateIds.size > 0;
  const selectionCount = source === "lorebooks" ? selectedLorebookCandidateIds.size : selectedFlatSourceIds.length;
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
  const importScopeResultMessage = importResultContract
    ? localizeUi("ui.longTermMemory.sourcesworkspace.importScopeResult", {
        source: importResultContract.sourceTargetLabel,
        destination: importResultContract.destinationTargetLabel,
      })
    : "";
  const activeSourceTask = sourceTask.active?.status === "running" ? sourceTask.active : null;
  const sourceTaskProgressMessage = activeSourceTask
    ? activeSourceTask.kind === "import"
      ? localizeUi("ui.longTermMemory.sourcesworkspace.importingSources", { count: activeSourceTask.sourceCount })
      : activeSourceTask.kind === "refresh"
        ? localizeUi("ui.longTermMemory.sourcesworkspace.refreshingSources", { count: activeSourceTask.sourceCount })
        : localizeUi("ui.longTermMemory.sourcesworkspace.reExtractingSources", {
            count: activeSourceTask.sourceCount,
          })
    : "";
  const latestSourceTask = sourceTask.latest;
  const latestSourceTaskId = latestSourceTask?.id;
  const latestSourceTaskLabel = latestSourceTask
    ? latestSourceTask.kind === "import"
      ? localizeUi("ui.longTermMemory.sourcesworkspace.lastImport")
      : latestSourceTask.kind === "refresh"
        ? localizeUi("ui.longTermMemory.sourcesworkspace.lastRefresh")
        : localizeUi("ui.longTermMemory.sourcesworkspace.lastReExtract")
    : "";
  const closeTaskResult = () => {
    if (latestSourceTask) setDismissedTaskResultId(latestSourceTask.id);
    setLatestTaskResultOpen(false);
  };
  const reextractResultPanel =
    reextractTask?.status === "completed" &&
    reextractTask.id !== dismissedTaskResultId &&
    (reextractResult || latestTaskResultOpen) ? (
      <section
        ref={importResultRef}
        className="space-y-2 border-t border-[var(--border)] p-4"
        data-ltm-reextract-result
        data-ltm-source-task-result-workbench
      >
        <StatusSurface tone="success">
          {reextractResult?.outcome.totalCandidates
            ? localizeUi("ui.longTermMemory.sourcesworkspace.extractionCompletedReviewReady")
            : localizeUi("ui.longTermMemory.sourcesworkspace.extractionCompleted")}
        </StatusSurface>
        <p className="text-xs text-[var(--muted-foreground)]" data-ltm-extraction-accounting>
          {localizeUi("ui.longTermMemory.sourcesworkspace.suggestionsKeptOfTotal", {
            kept: reextractResult?.outcome.keptUnits ?? reextractTask.safeResult?.counts?.keptUnits ?? 0,
            total: reextractResult?.outcome.totalCandidates ?? reextractTask.safeResult?.counts?.totalCandidates ?? 0,
          })}
        </p>
        {reextractTask.contract.sourceIds[0] && onOpenReview ? (
          <Button onClick={() => onOpenReview(reextractTask.contract.sourceIds[0]!)}>
            {localizeUi("ui.longTermMemory.memoryvault.reviewRelatedDrafts")}
          </Button>
        ) : null}
        <Button onClick={closeTaskResult}>{localizeUi("ui.longTermMemory.sourcesworkspace.backToPreview")}</Button>
      </section>
    ) : null;

  const clearImportResult = useCallback(() => {
    setImportError("");
    setReviewMessage("");
    setSourceOperation(null);
    setDismissedTaskResultId(latestSourceTaskId ?? null);
    setLatestTaskResultOpen(false);
  }, [latestSourceTaskId]);

  const confirmSelectionChange = useCallback(async () => {
    if (selectionCount > 1) {
      const confirmed = confirmAction
        ? await confirmAction({
            title: localizeUi("ui.longTermMemory.sourcesworkspace.clearSelection"),
            message: localizeUi("ui.longTermMemory.sourcesworkspace.clearSelectionMessage", {
              count: selectionCount,
            }),
            confirmLabel: localizeUi("ui.longTermMemory.sourcesworkspace.clearSelection"),
            tone: "default",
          })
        : window.confirm(
            localizeUi("ui.longTermMemory.sourcesworkspace.clearSelectionMessage", { count: selectionCount }),
          );
      if (!confirmed) return false;
    }
    if (selectionCount)
      setSelections((current) =>
        Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${source}:`))),
      );
    return true;
  }, [confirmAction, localizeUi, selectionCount, source]);

  const changeSource = useCallback(
    async (next: Source) => {
      if (next === source) return true;
      if (!(await confirmSelectionChange())) return false;
      setSource(next);
      onSourceChange?.(next);
      sourceQueryByType.current[source] = sourceQuery;
      sourceStatusByType.current[source] = sourceStatusFilter;
      focusedSourceByType.current[source] = focusedFlatSourceId;
      focusedLorebookByType.current[source] = selectedLorebookId;
      openLorebookEntryByType.current[source] = openLorebookEntryId;
      setSourceQuery(sourceQueryByType.current[next]);
      setSourceStatusFilter(sourceStatusByType.current[next]);
      setFocusedFlatSourceId(focusedSourceByType.current[next]);
      setSelectedLorebookId(focusedLorebookByType.current[next]);
      setOpenLorebookEntryId(openLorebookEntryByType.current[next]);
      setWorkspacePane("navigator");
      clearImportResult();
      return true;
    },
    [
      clearImportResult,
      confirmSelectionChange,
      focusedFlatSourceId,
      onSourceChange,
      openLorebookEntryId,
      selectedLorebookId,
      source,
      sourceQuery,
      sourceStatusFilter,
    ],
  );

  const openLatestTaskResult = async () => {
    if (!latestSourceTask || !(await changeSource(latestSourceTask.contract.source))) return;
    markLtmSourceTaskViewed(latestSourceTask.id);
    setDismissedTaskResultId(null);
    setLatestTaskResultOpen(true);
    setWorkspacePane("workbench");
    requestAnimationFrame(() => importResultRef.current?.scrollIntoView({ block: "nearest" }));
  };

  useEffect(() => {
    setSelectedDestinationTargetIds((current) =>
      current.filter((id) => destinationTargets.some((target) => target.id === id)),
    );
  }, [destinationTargets]);

  useEffect(() => {
    setSourceContextKey(props.chatId ?? "all");
    setSourceTargetId(props.chatId ? `chat:${props.chatId}` : "all");
    setSelectedDestinationTargetIds(props.chatId ? [`chat:${props.chatId}`] : []);
  }, [props.chatId]);

  useEffect(() => {
    if (!requestedSource) return;
    setRequestedSourceNoteId(requestedSource.sourceNoteId ?? null);
    setSourceGroupsOpen((current) => ({
      ...current,
      [requestedSource.source]: { ...current[requestedSource.source], imported: true },
    }));
    void changeSource(requestedSource.source).then((changed) => {
      if (!changed) return;
      setSourceStatusFilter("imported");
      onRequestedSourceHandled?.();
    });
  }, [changeSource, onRequestedSourceHandled, requestedSource]);

  useEffect(() => {
    if (selectedSource && selectedSource !== source) void changeSource(selectedSource);
  }, [changeSource, selectedSource, source]);

  useEffect(() => {
    if (!requestedSourceNoteId) return;
    if (source === "lorebooks") {
      const match = allLorebooks.find((book) =>
        book.entries.some((entry) =>
          entry.candidates.some((candidate) => candidate.existingNoteId === requestedSourceNoteId),
        ),
      );
      if (!match) return;
      const entry = match.entries.find((candidate) =>
        candidate.candidates.some((candidate) => candidate.existingNoteId === requestedSourceNoteId),
      );
      setSelectedLorebookId(match.id);
      setOpenLorebookEntryId(entry?.id ?? null);
    } else {
      const match = rows.find((row) => row.existingNoteId === requestedSourceNoteId);
      if (!match) return;
      setFocusedFlatSourceId(match.sourceId);
    }
    setWorkspacePane("workbench");
    setRequestedSourceNoteId(null);
  }, [allLorebooks, requestedSourceNoteId, rows, source]);

  useEffect(() => {
    if (selectAllRef.current)
      selectAllRef.current.indeterminate = activeFlatSelectedIds.length > 0 && !activeFlatAllSelected;
  }, [activeFlatAllSelected, activeFlatSelectedIds.length]);

  useEffect(() => {
    sourceQueryByType.current[source] = sourceQuery;
    sourceStatusByType.current[source] = sourceStatusFilter;
    focusedSourceByType.current[source] = focusedFlatSourceId;
    focusedLorebookByType.current[source] = selectedLorebookId;
    openLorebookEntryByType.current[source] = openLorebookEntryId;
  }, [focusedFlatSourceId, openLorebookEntryId, selectedLorebookId, source, sourceQuery, sourceStatusFilter]);

  useEffect(() => {
    const searching = Boolean(sourceQuery.trim());
    if (!searching) {
      if (sourceSearchContext.current !== null) {
        const previous = sourceGroupsBeforeSearch.current;
        if (previous) setSourceGroupsOpen(previous);
        sourceGroupsBeforeSearch.current = null;
        sourceSearchContext.current = null;
      }
      return;
    }
    if (sourceSearchContext.current === source) return;
    sourceGroupsBeforeSearch.current ??= sourceGroupsOpen;
    sourceSearchContext.current = source;
    setSourceGroupsOpen((current) => ({
      ...current,
      [source]: { ready: selectableRows.length > 0, imported: importedRows.length > 0 },
    }));
  }, [importedRows.length, selectableRows.length, source, sourceGroupsOpen, sourceQuery]);

  useEffect(() => {
    if (sourceTask.active?.status === "running") setWorkspacePane("workbench");
  }, [sourceTask.active?.id, sourceTask.active?.status]);

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

  const changeSourceScope = async (next: string) => {
    if (next === sourceTargetId || !(await confirmSelectionChange())) return;
    setSourceTargetId(next);
    clearImportResult();
  };

  const changeDestinationIds = (next: string[]) => {
    setSelectedDestinationTargetIds(next);
    clearImportResult();
  };

  const changeModeFilter = async (next: LtmMode | "all") => {
    if (next === modeFilter || !(await confirmSelectionChange())) return;
    setModeFilter(next);
    clearImportResult();
  };

  const changeSourceStatusFilter = async (next: SourceStatusFilter) => {
    if (next === sourceStatusFilter) return true;
    if (!(await confirmSelectionChange())) return false;
    setSourceStatusFilter(next);
    return true;
  };

  const toggleSelectionMode = async () => {
    if (selectionMode) {
      if (!(await confirmSelectionChange())) return;
    }
    setSelectionMode((current) => !current);
  };

  const toggleSelected = async (sourceId: string, checked: boolean) => {
    if (checked && selectedImportedIds.size && !(await confirmSelectionChange())) return;
    setSelections((current) => {
      const next = new Set(current[selectionKey] ?? []);
      if (checked) next.add(sourceId);
      else next.delete(sourceId);
      return {
        ...current,
        [selectionKey]: [...next],
        [importedSelectionKey]: checked ? [] : current[importedSelectionKey],
      };
    });
  };

  const toggleImportedSelected = async (sourceId: string, checked: boolean) => {
    if (checked && selectedIds.size && !(await confirmSelectionChange())) return;
    setSelections((current) => {
      const next = new Set(current[importedSelectionKey] ?? []);
      if (checked) next.add(sourceId);
      else next.delete(sourceId);
      return { ...current, [importedSelectionKey]: [...next], [selectionKey]: checked ? [] : current[selectionKey] };
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
    if (ids.length === 0 || importing || sourceTask.active?.status === "running") return;
    if (ids.length > 100) {
      setImportError(localizeUi("ui.longTermMemory.sourcesworkspace.selectUpTo100SourceParts"));
      return;
    }
    const effectiveDestination = retryContract
      ? {
          destinationScope: retryContract.destinationScope,
          destinationLabel: retryContract.destinationTargetLabel,
        }
      : currentDestinationScope
        ? { destinationScope: currentDestinationScope, destinationLabel: currentDestinationLabel }
        : undefined;
    if (!effectiveDestination) {
      setImportError(localizeUi("ui.longTermMemory.sourcesworkspace.chooseDestinationBeforeImport"));
      return;
    }
    const destinationScope = effectiveDestination.destinationScope;
    if (!hasDestinationScopeCapacity(destinationScope)) {
      setImportError(localizeUi("ui.longTermMemory.sourcesworkspace.destinationScopeLimitReached"));
      return;
    }
    const destinationTargetLabel = effectiveDestination.destinationLabel;
    const effectiveAction = retryContract?.action ?? action;
    const contract: ImportContract = retryContract
      ? {
          ...retryContract,
          sourceIds: ids,
          action: effectiveAction,
          destinationScope,
          destinationTargetLabel,
        }
      : {
          source,
          sourceIds: ids,
          action: effectiveAction,
          sourceScope: {
            ...(previewScope ?? {}),
            ...(previewScope?.chatIds ? { chatIds: [...previewScope.chatIds] } : {}),
            ...(previewScope?.characterIds ? { characterIds: [...previewScope.characterIds] } : {}),
            ...(previewScope?.personaIds ? { personaIds: [...previewScope.personaIds] } : {}),
          },
          ...(destinationScope
            ? {
                destinationScope: {
                  ...destinationScope,
                  ...(destinationScope.chatIds ? { chatIds: [...destinationScope.chatIds] } : {}),
                  ...(destinationScope.groupIds ? { groupIds: [...destinationScope.groupIds] } : {}),
                  ...(destinationScope.characterIds ? { characterIds: [...destinationScope.characterIds] } : {}),
                  ...(destinationScope.personaIds ? { personaIds: [...destinationScope.personaIds] } : {}),
                },
              }
            : {}),
          sourceTargetLabel: sourceTarget?.label ?? localizeUi("ui.longTermMemory.sourcesworkspace.allAvailable"),
          destinationTargetLabel,
          ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
          ...(props.chatId ? { chatId: props.chatId } : {}),
          selectionKey: selectionKeyOverride ?? selectionKey,
        };
    setImportError("");
    setReviewMessage("");
    const sourceTitleById = new Map(
      [...rows, ...(selectedLorebook?.entries.flatMap((entry) => entry.candidates) ?? [])].map((row) => [
        row.sourceId,
        row.title,
      ]),
    );
    try {
      const task = await startLtmSourceTask<LtmImportSourceNotesResponse>({
        kind: contract.action,
        contract,
        sourceTitles: ids.map((id) => sourceTitleById.get(id) ?? id),
        run: (signal) =>
          request(
            "/import/source-notes",
            "POST",
            {
              source: contract.source,
              sourceIds: contract.sourceIds,
              limit: 100,
              extract: contract.action !== "refresh",
              ...(contract.sourceScope ? { sourceScope: contract.sourceScope } : {}),
              ...(contract.destinationScope ? { destinationScope: contract.destinationScope } : {}),
              ...(contract.mode ? { mode: contract.mode } : {}),
              ...(contract.chatId ? { chatId: contract.chatId } : {}),
            },
            signal,
          ),
      });
      if (task.status === "completed") {
        const result = task.result as LtmImportSourceNotesResponse;
        const failedIds = [
          ...result.imported.filter((item) => item.retryable).map((item) => item.sourceId),
          ...result.writeFailures.filter((item) => item.retryable).map((item) => item.sourceId),
        ];
        setSelections((current) => ({
          ...current,
          [contract.selectionKey]: failedIds,
        }));
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
      } else if (task.status === "cancelled" || task.status === "failed") {
        setImportError(
          task.status === "cancelled"
            ? localizeUi("ui.longTermMemory.sourcesworkspace.importCancelledSelectionRetained")
            : (task.error?.message ?? localizeUi("ui.longTermMemory.sourcesworkspace.sourcesCouldNotBeImported")),
        );
      }
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : localizeUi("ui.longTermMemory.sourcesworkspace.sourcesCouldNotBeImported"),
      );
    }
  };

  const reextract = async (noteId: string, retryContract?: LtmSourceTaskContract) => {
    if (sourceTask.active?.status === "running") return;
    setImportError("");
    const contract: LtmSourceTaskContract = retryContract ?? {
      source,
      sourceIds: [noteId],
      action: "re-extract",
      ...(previewScope ? { sourceScope: previewScope } : {}),
      ...(currentDestinationScope ? { destinationScope: currentDestinationScope } : {}),
      ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
      ...(props.chatId ? { chatId: props.chatId } : {}),
    };
    const sourceNoteId = contract.sourceIds[0] ?? noteId;
    try {
      const task = await startLtmSourceTask({
        kind: "re-extract",
        contract,
        sourceTitles: [sourceNoteId],
        run: (signal) =>
          request(
            `/notes/${encodeURIComponent(sourceNoteId)}/extract`,
            "POST",
            {
              ...(contract.chatId ? { chatId: contract.chatId } : {}),
              ...(contract.mode ? { mode: contract.mode } : {}),
            },
            signal,
          ),
      });
      if (task.status === "completed") {
        setReviewMessage(localizeUi("ui.longTermMemory.sourcesworkspace.extractionCompletedReviewReady"));
        await invalidateAfterMutation();
      } else if (task.status === "failed" || task.status === "cancelled") {
        setImportError(
          task.error?.message ?? localizeUi("ui.longTermMemory.sourcesworkspace.sourceCouldNotBeReextracted"),
        );
      }
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : localizeUi("ui.longTermMemory.sourcesworkspace.sourceCouldNotBeReextracted"),
      );
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
      <div className="hidden items-start gap-1 md:flex">
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
            setSourceOperation({ id: noteId, title, operation: "copy" });
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
                setSourceOperation({ id: noteId, title, operation: "copy" });
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

  const renderFlatSourceRow = (row: PreviewRow) => {
    const ready = row.status === "pending" || retryableIdSet.has(row.sourceId);
    const selected = ready ? selectedIds.has(row.sourceId) : selectedImportedIds.has(row.sourceId);
    return (
      <ClickSurface
        key={row.sourceId}
        role="listitem"
        data-ltm-source-row-status={row.status}
        data-ltm-source-id={row.sourceId}
        data-ltm-source-focused={focusedFlatSourceId === row.sourceId || undefined}
        className={`group flex items-start gap-2 p-3 ${focusedFlatSourceId === row.sourceId ? "bg-[var(--primary)]/10" : ""}`}
        onClick={() => {
          setFocusedFlatSourceId(row.sourceId);
          setWorkspacePane("workbench");
        }}
      >
        {selectionMode ? (
          <input
            type="checkbox"
            className={sourceCheckboxClass}
            aria-label={localizeUi("ui.longTermMemory.memoryvault.selectValue1", { value1: row.title })}
            checked={selected}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) =>
              ready
                ? void toggleSelected(row.sourceId, event.target.checked)
                : void toggleImportedSelected(row.sourceId, event.target.checked)
            }
            data-ltm-source-select={row.sourceId}
          />
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <strong className="truncate text-sm">{row.title}</strong>
            <span
              data-ltm-source-status={row.status}
              className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] font-semibold uppercase"
            >
              {sourceStatusLabel(row, localizeUi)}
            </span>
          </span>
          <span className="mt-1 block truncate text-xs text-[var(--muted-foreground)]">{row.summary}</span>
        </span>
        {ready ? (
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
        ) : null}
      </ClickSurface>
    );
  };

  const sourceOperationWorkbench = sourceOperation ? (
    <SourceOperationWorkbench
      key={`${sourceOperation.id}:${sourceOperation.operation ?? "copy"}`}
      sourceNoteId={sourceOperation.id}
      sourceTitle={sourceOperation.title}
      initialOperation={sourceOperation.operation}
      destinations={scopeTargets.data?.chats ?? []}
      disabled={activeSourceTask !== null}
      confirmAction={props.confirmAction}
      onComplete={async () => {
        await invalidateAfterMutation();
        await (source === "lorebooks" ? lorebookPreview.refetch() : preview.refetch());
      }}
    />
  ) : null;
  const restoredImportResult =
    latestTaskResultOpen &&
    latestSourceTask?.id !== dismissedTaskResultId &&
    !importResult &&
    latestSourceTask?.status === "completed" &&
    latestSourceTask.kind !== "re-extract" &&
    latestSourceTask.safeResult
      ? latestSourceTask.safeResult
      : null;
  const restoredRetryIds = restoredImportResult
    ? Array.from(
        new Set([
          ...(restoredImportResult.items?.filter((item) => item.retryable).map((item) => item.sourceId) ?? []),
          ...(restoredImportResult.writeFailures?.filter((item) => item.retryable).map((item) => item.sourceId) ?? []),
          ...(restoredImportResult.missingSourceIds ?? []),
        ]),
      )
    : [];
  const restoredImportResultPanel = restoredImportResult ? (
    <section
      ref={importResultRef}
      role="region"
      aria-labelledby={importResultLabelId}
      data-ltm-safe-source-task-result={latestSourceTask?.status}
      data-ltm-source-task-result-workbench
      className="space-y-3 p-4"
    >
      <h2 id={importResultLabelId} className="text-sm font-semibold">
        {latestSourceTaskLabel}
      </h2>
      <p className="text-xs text-[var(--muted-foreground)]">
        {localizeUi("ui.longTermMemory.sourcesworkspace.importResultSummary", {
          requested: restoredImportResult.counts?.requested ?? latestSourceTask?.sourceCount ?? 0,
          wrote: restoredImportResult.counts?.sourceNotesWritten ?? 0,
          succeeded: restoredImportResult.counts?.succeeded ?? 0,
          failed: restoredImportResult.counts?.failed ?? 0,
          cancelled: restoredImportResult.counts?.cancelled ?? 0,
          missing: restoredImportResult.counts?.missing ?? restoredImportResult.missingSourceIds?.length ?? 0,
          writeFailures: restoredImportResult.counts?.sourceWriteFailed ?? 0,
        })}
      </p>
      {restoredRetryIds.length ? (
        <Button
          primary
          onClick={() =>
            void runImport(
              restoredRetryIds,
              latestSourceTask?.kind === "refresh" ? "refresh" : "import",
              latestSourceTask?.contract as ImportContract,
            )
          }
          data-ltm-source-action="retry-restored"
        >
          <RefreshCw aria-hidden="true" size="0.75rem" />
          {localizeUi("ui.longTermMemory.sourcesworkspace.retryFailedCount", { count: restoredRetryIds.length })}
        </Button>
      ) : null}
      {restoredImportResult.items?.map((item) => (
        <article key={item.sourceId} className="space-y-1 border-t border-[var(--border)] pt-3 text-xs">
          <strong>{item.title}</strong>
          {item.status ? <p className="text-[var(--muted-foreground)]">{humanizeLabel(item.status)}</p> : null}
          {item.error?.message ? <StatusSurface tone="danger">{item.error.message}</StatusSurface> : null}
          {item.diagnostics?.length ? (
            <ul className="space-y-1 text-[var(--muted-foreground)]">
              {item.diagnostics.map((diagnostic, index) => (
                <li key={`${diagnostic.code ?? "diagnostic"}-${index}`}>{diagnostic.message ?? diagnostic.code}</li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
      {restoredImportResult.writeFailures?.map((failure) => (
        <StatusSurface key={failure.sourceId} tone="danger" data-ltm-source-write-failure={failure.sourceId}>
          <CircleAlert aria-hidden="true" size="0.875rem" /> {failure.title}: {failure.error.message} (
          {importStatusLabel(failure.sourceWriteStatus, localizeUi)},{" "}
          {importStatusLabel(failure.extractionStatus, localizeUi)})
        </StatusSurface>
      ))}
      {restoredImportResult.missingSourceIds?.map((id) => (
        <StatusSurface key={id} tone="danger">
          <CircleAlert aria-hidden="true" size="0.875rem" /> {id}
        </StatusSurface>
      ))}
      <Button onClick={closeTaskResult}>{localizeUi("ui.longTermMemory.sourcesworkspace.backToPreview")}</Button>
    </section>
  ) : null;
  const taskResultWorkbenchOpen = Boolean(visibleImportResult || restoredImportResult || reextractResultPanel);
  const workbenchModeClass = sourceOperation
    ? "[&>:not([data-ltm-source-operation-workbench])]:hidden"
    : taskResultWorkbenchOpen
      ? "[&>:not([data-ltm-source-task-result-workbench])]:hidden"
      : "";

  if (scopeTargets.isError) {
    return (
      <section data-ltm-surface="sources" className="space-y-4">
        <StatusSurface tone="danger">
          {scopeTargets.error instanceof Error
            ? scopeTargets.error.message
            : localizeUi("ui.longTermMemory.sourcesworkspace.scopeTargetsCouldNotLoad")}
          <Button onClick={() => void scopeTargets.refetch()}>
            <RefreshCw aria-hidden="true" size="0.75rem" />
            {localizeUi("ui.longTermMemory.activityview.retry")}
          </Button>
        </StatusSurface>
      </section>
    );
  }

  return (
    <section
      data-ltm-surface="sources"
      data-ltm-import-status={importing ? "pending" : "idle"}
      data-ltm-extraction-status={extractingId ? "pending" : "idle"}
      data-ltm-extraction-note-id={extractingId ?? undefined}
      className="space-y-4"
    >
      <div
        className="mari-editor-tab-rail flex flex-wrap gap-1 rounded-lg border p-1"
        role="tablist"
        aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.sourceTypes")}
        style={{ display: "flex" }}
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
            onClick={() => void changeSource(tab.id)}
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
          aria-labelledby={sourceScopeLabelId}
          className="flex min-h-11 w-full flex-col gap-2 text-xs font-medium sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-2 sm:shrink-0">
            <span id={sourceScopeLabelId}>{localizeUi("ui.longTermMemory.sourcesworkspace.findSourcesIn")}</span>
            <InfoPopover
              label={localizeUi("ui.longTermMemory.sourcesworkspace.findSourcesIn")}
              content={
                sourceTargetId === "all"
                  ? localizeUi("ui.longTermMemory.sourcesworkspace.searchEveryAvailableCharacterLorebookChatAndBranch")
                  : localizeUi("ui.longTermMemory.sourcesworkspace.limitImportsToThisChatAndItsRelatedScope")
              }
            />
          </div>
          <ScopeTargetPicker
            targets={scopeTargetOptions}
            value={sourceTarget?.id ?? "all"}
            onChange={changeSourceScope}
            ariaLabel={localizeUi("ui.longTermMemory.sourcesworkspace.findSourcesIn")}
            testId="source"
            disabled={activeSourceTask !== null}
          />
        </div>
      </div>

      <p
        className="text-xs text-[var(--muted-foreground)]"
        data-ltm-source-preview-status={source === "lorebooks" ? lorebookPreview.status : preview.status}
        role="status"
        aria-live="polite"
      >
        {source === "lorebooks"
          ? lorebookPreviewData
            ? localizeUi("ui.longTermMemory.sourcesworkspace.value1LorebooksValue2EntriesValue3Imported", {
                value1: lorebookPreviewData.counts.books,
                value2: lorebookPreviewData.counts.entries,
                value3: lorebookPreviewData.counts.imported,
              })
            : localizeUi("ui.longTermMemory.sourcesworkspace.loadingLorebooks")
          : previewData
            ? localizeUi("ui.longTermMemory.sourcesworkspace.value1ScannedValue2PendingValue3Imported", {
                value1: previewData.scanned,
                value2: previewData.draftable,
                value3: previewData.importedCount,
              })
            : localizeUi("ui.longTermMemory.sourcesworkspace.loadingSourcePreview")}
      </p>

      {(source === "lorebooks" ? lorebookPreview.isError : preview.isError) ? (
        <StatusSurface tone="danger">
          {(source === "lorebooks" ? lorebookPreview.error : preview.error) instanceof Error
            ? (source === "lorebooks" ? lorebookPreview.error : preview.error).message
            : source === "lorebooks"
              ? localizeUi("ui.longTermMemory.sourcesworkspace.lorebooksCouldNotLoad")
              : localizeUi("ui.longTermMemory.sourcesworkspace.sourcePreviewCouldNotLoad")}
        </StatusSurface>
      ) : null}
      {importError || sourceTaskError ? (
        <StatusSurface tone="danger">
          {importError || sourceTaskError}
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
          {retryableReextract?.contract.sourceIds[0] ? (
            <Button
              onClick={() => void reextract(retryableReextract.contract.sourceIds[0]!, retryableReextract.contract)}
              disabled={activeSourceTask !== null}
              data-ltm-source-action="retry-re-extract"
            >
              <RefreshCw aria-hidden="true" size="0.75rem" />
              {localizeUi("ui.longTermMemory.sourcesworkspace.retryOriginalSelection", { count: 1 })}
            </Button>
          ) : null}
        </StatusSurface>
      ) : null}
      {reviewMessage ? <StatusSurface tone="success">{reviewMessage}</StatusSurface> : null}
      {!reviewMessage && !importResult && !importError && !sourceTaskError ? (
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
            activeMobilePane={workspacePane}
            onMobilePaneChange={setWorkspacePane}
            switcherLabel={localizeUi("ui.longTermMemory.longtermmemorynavigation.workspacePanes")}
            navigator={{
              label: localizeUi("ui.longTermMemory.sourcesworkspace.lorebooks"),
              content: (
                <section data-ltm-lorebook-list className="mari-editor-panel overflow-hidden">
                  <div className="space-y-3 bg-[var(--secondary)]/25 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold">
                        {localizeUi("ui.longTermMemory.sourcesworkspace.lorebooks")}
                      </h2>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--muted-foreground)]">{activeLorebooks.length}</span>
                        <Button className="mari-editor-action--compact" onClick={() => void toggleSelectionMode()}>
                          {localizeUi(
                            selectionMode
                              ? "ui.longTermMemory.sourcesworkspace.doneSelecting"
                              : "ui.longTermMemory.sourcesworkspace.selectSources",
                          )}
                        </Button>
                      </div>
                    </div>
                    {lorebookPreviewData?.truncated ? (
                      <p role="note" className="text-xs text-[var(--marinara-editor-warning)]">
                        {localizeUi("ui.longTermMemory.sourcesworkspace.moreThan100Matches")}
                      </p>
                    ) : null}
                    <label className="relative block">
                      <Search
                        aria-hidden="true"
                        size="0.875rem"
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                      />
                      <input
                        className={`${inputClass} pl-9`}
                        value={sourceQuery}
                        placeholder={localizeUi("ui.longTermMemory.sourcesworkspace.searchSources")}
                        aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.searchSources")}
                        data-ltm-source-search
                        onChange={(event) => setSourceQuery(event.target.value)}
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex min-h-11 items-center gap-2 text-xs font-medium">
                        {localizeUi("ui.longTermMemory.transferworkbench.mode")}
                        <select
                          className={`${inputClass} w-36`}
                          value={modeFilter}
                          disabled={activeSourceTask !== null}
                          onChange={(event) => void changeModeFilter(event.target.value as LtmMode | "all")}
                          aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.filterSourcesByMode")}
                          data-ltm-source-mode
                        >
                          <option value="all">{localizeUi("ui.longTermMemory.sourcesworkspace.all")}</option>
                          <option value="game">{localizeUi("ui.longTermMemory.sourcesworkspace.game")}</option>
                          <option value="conversation">
                            {localizeUi("ui.longTermMemory.sourcesworkspace.conversation")}
                          </option>
                          <option value="roleplay">{localizeUi("ui.longTermMemory.sourcesworkspace.roleplay")}</option>
                        </select>
                      </label>
                      <Button
                        disabled={lorebookPreview.isFetching}
                        onClick={() => void lorebookPreview.refetch()}
                        data-ltm-source-action="refresh-preview"
                      >
                        {lorebookPreview.isFetching ? (
                          <Loader2 aria-hidden="true" size="0.75rem" className="animate-spin" />
                        ) : (
                          <RefreshCw aria-hidden="true" size="0.75rem" />
                        )}
                        {localizeUi("ui.longTermMemory.sourcesworkspace.refreshPreview")}
                      </Button>
                    </div>
                    <div
                      role="tablist"
                      aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.sourceStatus")}
                      className="grid grid-cols-3 gap-1"
                    >
                      {(["all", "ready", "imported"] as const).map((filter) => {
                        const count =
                          filter === "all"
                            ? (lorebookPreviewData?.books.length ?? 0)
                            : allLorebooks.filter((book) =>
                                filter === "ready"
                                  ? book.totals.pending > 0
                                  : book.totals.pending === 0 && book.totals.imported > 0,
                              ).length;
                        return (
                          <button
                            key={filter}
                            type="button"
                            role="tab"
                            id={`ltm-source-status-${source}-${filter}`}
                            tabIndex={sourceStatusFilter === filter ? 0 : -1}
                            aria-selected={sourceStatusFilter === filter}
                            aria-controls={`ltm-source-results-${source}`}
                            data-ltm-source-status-filter={filter}
                            data-active={sourceStatusFilter === filter}
                            className="mari-editor-tab min-h-11 rounded-md border px-2 text-xs font-semibold"
                            onClick={() => void changeSourceStatusFilter(filter)}
                            onKeyDown={(event) =>
                              handleTabKey(
                                event,
                                ["all", "ready", "imported"],
                                sourceStatusFilter,
                                changeSourceStatusFilter,
                                "data-ltm-source-status-filter",
                              )
                            }
                          >
                            {localizeUi(
                              filter === "all"
                                ? "ui.longTermMemory.sourcesworkspace.all"
                                : filter === "ready"
                                  ? "ui.longTermMemory.sourcesworkspace.readyToImport"
                                  : "ui.longTermMemory.sourcesworkspace.alreadyImported",
                            )}{" "}
                            ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div id={`ltm-source-results-${source}`} role="list" className="divide-y divide-[var(--border)]">
                    {activeLorebooks.map((book) => (
                      <div key={book.id} role="listitem">
                        <button
                          type="button"
                          aria-current={selectedLorebookId === book.id || undefined}
                          data-ltm-lorebook-id={book.id}
                          onClick={() => {
                            setSelectedLorebookId(book.id);
                            setOpenLorebookEntryId(null);
                            setWorkspacePane("workbench");
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
                              {book.category} · {book.totals.entries}{" "}
                              {localizeUi("ui.longTermMemory.sourcesworkspace.entries")} {book.totals.imported}{" "}
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
                    {!lorebookPreview.isLoading && activeLorebooks.length === 0 ? (
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
              content: (
                <section
                  data-ltm-lorebook-workbench={selectedLorebook?.id ?? "empty"}
                  className={`mari-editor-panel overflow-hidden ${workbenchModeClass}`}
                >
                  {sourceOperationWorkbench}
                  <div ref={setResultWorkbenchHost} className="contents" data-ltm-source-task-result-workbench />
                  {restoredImportResultPanel}
                  {activeSourceTask ? (
                    <div className="space-y-3 border-b border-[var(--border)] p-4" data-ltm-source-task-progress>
                      <StatusSurface busy>
                        <Loader2 aria-hidden="true" size="0.875rem" className="animate-spin" />
                        {sourceTaskProgressMessage}
                      </StatusSurface>
                      <Button destructive onClick={cancelLtmSourceTask} data-ltm-source-action="cancel-import">
                        {localizeUi("ui.longTermMemory.memoryvault.cancel")}
                      </Button>
                    </div>
                  ) : null}
                  {selectedLorebook ? (
                    <>
                      <header className="space-y-2 border-b border-[var(--border)] bg-[var(--secondary)]/25 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="text-base font-semibold">{selectedLorebook.name}</h2>
                            <p className="text-xs text-[var(--muted-foreground)]">
                              {selectedLorebook.category} · {selectedLorebook.totals.entries}{" "}
                              {localizeUi("ui.longTermMemory.sourcesworkspace.entries")}{" "}
                              {selectedLorebook.totals.candidates}{" "}
                              {localizeUi("ui.longTermMemory.sourcesworkspace.sourceParts")}
                            </p>
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
                      <div className={mobilePrimaryActionsClass} data-ltm-source-primary-actions>
                        <Button
                          primary
                          disabled={!currentDestinationScope || importing || selectedBookImportIds.length === 0}
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
                          disabled={!currentDestinationScope || importing || selectedBookRefreshIds.length === 0}
                          onClick={() =>
                            void runImport(selectedBookRefreshIds, "refresh", undefined, lorebookRefreshSelectionKey)
                          }
                          data-ltm-lorebook-action="refresh-selected"
                        >
                          <RefreshCw aria-hidden="true" size="0.75rem" />{" "}
                          {localizeUi("ui.longTermMemory.sourcesworkspace.refreshSelectedSourcesCount", {
                            count: selectedBookRefreshIds.length,
                          })}
                        </Button>
                        {importing ? (
                          <Button destructive onClick={cancelLtmSourceTask} data-ltm-lorebook-action="cancel-import">
                            {localizeUi("ui.longTermMemory.memoryvault.cancel")}
                          </Button>
                        ) : null}
                      </div>

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
                                {selectionMode ? (
                                  <EntrySelect
                                    entry={entry}
                                    checked={candidateIds.length > 0 && selectedCount === candidateIds.length}
                                    indeterminate={selectedCount > 0 && selectedCount < candidateIds.length}
                                    onChange={(checked) => toggleLorebookCandidates(entry.candidates, checked)}
                                  />
                                ) : null}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      aria-expanded={openLorebookEntryId === entry.id}
                                      data-ltm-lorebook-entry-toggle={entry.id}
                                      className="inline-flex min-h-11 items-center gap-1 text-left text-sm font-semibold"
                                      onClick={() =>
                                        setOpenLorebookEntryId((current) => (current === entry.id ? null : entry.id))
                                      }
                                    >
                                      {openLorebookEntryId === entry.id ? (
                                        <ChevronDown aria-hidden="true" size="0.875rem" />
                                      ) : (
                                        <ChevronRight aria-hidden="true" size="0.875rem" />
                                      )}
                                      {entry.name}
                                    </button>
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
                                    <span className="text-xs text-[var(--muted-foreground)]">
                                      {sourceModeLabel(entry.candidates[0]?.importMode ?? "roleplay", localizeUi)}
                                    </span>
                                  </div>
                                  <p className="mt-1 whitespace-pre-wrap break-words text-xs text-[var(--muted-foreground)]">
                                    {entry.candidates[0]?.snippet}
                                  </p>
                                </div>
                              </div>
                              {openLorebookEntryId === entry.id ? (
                                <div role="list" className="space-y-2">
                                  {lorebookDetails.isLoading ? (
                                    <div
                                      className="h-20 animate-pulse rounded bg-[var(--secondary)]"
                                      aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.loadingSourceContent")}
                                    />
                                  ) : lorebookDetails.isError ? (
                                    <StatusSurface tone="danger">
                                      {lorebookDetails.error instanceof Error
                                        ? lorebookDetails.error.message
                                        : localizeUi("ui.longTermMemory.sourcesworkspace.sourcePreviewCouldNotLoad")}
                                      <Button onClick={() => void lorebookDetails.refetch()}>
                                        {localizeUi("ui.longTermMemory.sourcesworkspace.refreshPreview")}
                                      </Button>
                                    </StatusSurface>
                                  ) : null}
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
                                      <p className="whitespace-pre-wrap break-words text-xs text-[var(--muted-foreground)]">
                                        {lorebookDetails.data?.details.find(
                                          (detail) => detail.sourceId === candidate.sourceId,
                                        )?.content ?? candidate.snippet}
                                      </p>
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
                              ) : null}
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
                    <div className="space-y-2 p-4 text-xs text-[var(--muted-foreground)]">
                      <p>{localizeUi("ui.longTermMemory.sourcesworkspace.selectALorebookToInspectItsEntries")}</p>
                      <p>
                        {localizeUi("ui.longTermMemory.sourcesworkspace.readyToImport")} (
                        {lorebookPreviewData?.counts.pending ?? 0}) ·{" "}
                        {localizeUi("ui.longTermMemory.sourcesworkspace.alreadyImported")} (
                        {lorebookPreviewData?.counts.imported ?? 0})
                      </p>
                    </div>
                  )}
                  {reextractResultPanel}
                </section>
              ),
            }}
            inspector={{
              label: localizeUi("ui.longTermMemory.sourcesworkspace.chooseDestination"),
              content: (
                <div className="space-y-3">
                  <DestinationScopePanel
                    targets={destinationTargets}
                    selectedIds={selectedDestinationTargetIds}
                    currentIds={currentDestinationIds}
                    onChange={changeDestinationIds}
                    mode={modeFilter}
                    source={source}
                    disabled={sourceTask.active?.status === "running"}
                  />
                  {focusedImportedSource ? (
                    <ImportedSourceInspector
                      source={focusedImportedSource}
                      disabled={sourceTask.active?.status === "running"}
                      bulkActive={bulkSelectionActive}
                      onOpenMemory={onOpenMemory}
                      onOpenReview={onOpenReview}
                      onReextract={(id) => void reextract(id)}
                      onManage={(id, title, operation) => {
                        setSourceOperation({ id, title, operation });
                        setWorkspacePane("workbench");
                      }}
                    />
                  ) : null}
                  {latestSourceTask ? (
                    <button
                      type="button"
                      className="mari-editor-panel flex min-h-11 w-full items-center justify-between gap-2 p-3 text-left text-xs"
                      data-ltm-latest-source-task
                      onClick={() => void openLatestTaskResult()}
                    >
                      <span className="font-semibold">{latestSourceTaskLabel}</span>
                      <span className="text-[var(--muted-foreground)]">
                        {latestSourceTask.sourceCount} · {latestSourceTask.status}
                      </span>
                    </button>
                  ) : null}
                </div>
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
          className="min-w-0"
        >
          <LtmWorkspace
            activeMobilePane={workspacePane}
            onMobilePaneChange={setWorkspacePane}
            switcherLabel={localizeUi("ui.longTermMemory.longtermmemorynavigation.workspacePanes")}
            navigator={{
              label: localizeUi("ui.longTermMemory.sourcesworkspace.sourceTypes"),
              content: (
                <section className="mari-editor-panel overflow-hidden" data-ltm-source-navigator>
                  <header className="space-y-3 border-b border-[var(--border)] bg-[var(--secondary)]/25 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold">
                        {localizeUi(sourceTabs.find((tab) => tab.id === source)?.labelKey ?? "")}
                      </h2>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {previewData?.totals.matches ?? activeFlatRows.length}
                        </span>
                        <Button className="mari-editor-action--compact" onClick={() => void toggleSelectionMode()}>
                          {localizeUi(
                            selectionMode
                              ? "ui.longTermMemory.sourcesworkspace.doneSelecting"
                              : "ui.longTermMemory.sourcesworkspace.selectSources",
                          )}
                        </Button>
                      </div>
                    </div>
                    {previewData?.truncated ? (
                      <p role="note" className="text-xs text-[var(--marinara-editor-warning)]">
                        {localizeUi("ui.longTermMemory.sourcesworkspace.moreThan100Matches")}
                      </p>
                    ) : null}
                    <label className="relative block">
                      <Search
                        aria-hidden="true"
                        size="0.875rem"
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                      />
                      <input
                        className={`${inputClass} pl-9`}
                        value={sourceQuery}
                        placeholder={localizeUi("ui.longTermMemory.sourcesworkspace.searchSources")}
                        aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.searchSources")}
                        data-ltm-source-search
                        onChange={(event) => setSourceQuery(event.target.value)}
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex min-h-11 items-center gap-2 text-xs font-medium">
                        {localizeUi("ui.longTermMemory.transferworkbench.mode")}
                        <select
                          className={`${inputClass} w-36`}
                          value={modeFilter}
                          disabled={activeSourceTask !== null}
                          onChange={(event) => void changeModeFilter(event.target.value as LtmMode | "all")}
                          aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.filterSourcesByMode")}
                          data-ltm-source-mode
                        >
                          <option value="all">{localizeUi("ui.longTermMemory.sourcesworkspace.all")}</option>
                          <option value="game">{localizeUi("ui.longTermMemory.sourcesworkspace.game")}</option>
                          <option value="conversation">
                            {localizeUi("ui.longTermMemory.sourcesworkspace.conversation")}
                          </option>
                          <option value="roleplay">{localizeUi("ui.longTermMemory.sourcesworkspace.roleplay")}</option>
                        </select>
                      </label>
                      <Button
                        disabled={preview.isFetching}
                        onClick={() => void preview.refetch()}
                        data-ltm-source-action="refresh-preview"
                      >
                        {preview.isFetching ? (
                          <Loader2 aria-hidden="true" size="0.75rem" className="animate-spin" />
                        ) : (
                          <RefreshCw aria-hidden="true" size="0.75rem" />
                        )}
                        {localizeUi("ui.longTermMemory.sourcesworkspace.refreshPreview")}
                      </Button>
                    </div>
                    <div
                      role="tablist"
                      aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.sourceStatus")}
                      className="grid grid-cols-3 gap-1"
                    >
                      {(["all", "ready", "imported"] as const).map((filter) => {
                        const count =
                          filter === "all"
                            ? (previewData?.totals.matches ?? rows.length)
                            : filter === "ready"
                              ? (previewData?.totals.ready ?? selectableRows.length)
                              : (previewData?.totals.imported ?? importedRows.length);
                        const labelKey =
                          filter === "all"
                            ? "ui.longTermMemory.sourcesworkspace.all"
                            : filter === "ready"
                              ? "ui.longTermMemory.sourcesworkspace.readyToImport"
                              : "ui.longTermMemory.sourcesworkspace.alreadyImported";
                        return (
                          <button
                            key={filter}
                            type="button"
                            role="tab"
                            id={`ltm-source-status-${source}-${filter}`}
                            tabIndex={sourceStatusFilter === filter ? 0 : -1}
                            aria-selected={sourceStatusFilter === filter}
                            aria-controls={`ltm-source-results-${source}`}
                            data-ltm-source-status-filter={filter}
                            className="mari-editor-tab min-h-11 rounded-md border px-2 text-xs font-semibold"
                            data-active={sourceStatusFilter === filter}
                            onClick={() => void changeSourceStatusFilter(filter)}
                            onKeyDown={(event) =>
                              handleTabKey(
                                event,
                                ["all", "ready", "imported"],
                                sourceStatusFilter,
                                changeSourceStatusFilter,
                                "data-ltm-source-status-filter",
                              )
                            }
                          >
                            {localizeUi(labelKey)} ({count})
                          </button>
                        );
                      })}
                    </div>
                    {selectionMode ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          className={sourceCheckboxClass}
                          aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.selectAllValue1", {
                            value1: localizeUi("ui.longTermMemory.sourcesworkspace.sourceParts"),
                          })}
                          checked={activeFlatAllSelected}
                          disabled={sourceStatusFilter === "all" || activeFlatRows.length === 0}
                          onChange={(event) =>
                            setSelections((current) => ({
                              ...current,
                              [selectionKey]: event.target.checked
                                ? activeFlatRows
                                    .filter((row) => row.status === "pending" || retryableIdSet.has(row.sourceId))
                                    .map((row) => row.sourceId)
                                : [],
                              [importedSelectionKey]: event.target.checked
                                ? activeFlatRows.filter((row) => row.status === "imported").map((row) => row.sourceId)
                                : [],
                            }))
                          }
                          data-ltm-source-select-all={sourceStatusFilter}
                        />
                        <span>
                          {selectedFlatSourceIds.length} {localizeUi("ui.longTermMemory.memoryvault.selected")}
                        </span>
                        {selectedIds.size ? (
                          <Button
                            primary
                            disabled={!currentDestinationScope || importing}
                            onClick={() => void runImport([...selectedIds])}
                            data-ltm-source-action="import-selected"
                          >
                            <Check aria-hidden="true" size="0.75rem" />
                            {localizeUi("ui.longTermMemory.sourcesworkspace.importSelected_7fb57e8")}
                          </Button>
                        ) : null}
                        {selectedImportedIds.size ? (
                          <Button
                            disabled={!currentDestinationScope || importing}
                            onClick={() => void runImport([...selectedImportedIds], "refresh")}
                            data-ltm-source-action="refresh-selected"
                          >
                            <RefreshCw aria-hidden="true" size="0.75rem" />
                            {localizeUi("ui.longTermMemory.sourcesworkspace.refreshSelectedSources")}
                          </Button>
                        ) : null}
                        {importing ? (
                          <Button destructive onClick={cancelLtmSourceTask} data-ltm-source-action="cancel-import">
                            {localizeUi("ui.longTermMemory.memoryvault.cancel")}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </header>
                  <div id={`ltm-source-results-${source}`} role="list" className="divide-y divide-[var(--border)]">
                    {sourceStatusFilter === "all" ? (
                      <>
                        <details
                          open={sourceGroupsOpen[source].ready}
                          data-ltm-source-group="ready"
                          onToggle={(event) => {
                            const open = event.currentTarget.open;
                            setSourceGroupsOpen((current) => ({
                              ...current,
                              [source]: { ...current[source], ready: open },
                            }));
                          }}
                        >
                          <summary className="cursor-pointer list-none border-b border-[var(--border)] bg-[var(--secondary)]/25 px-3 py-3 text-xs font-semibold">
                            {localizeUi("ui.longTermMemory.sourcesworkspace.readyToImport")} (
                            {previewData?.totals.ready ?? selectableRows.length})
                          </summary>
                          <div className="divide-y divide-[var(--border)]">
                            {selectableRows.map(renderFlatSourceRow)}
                          </div>
                        </details>
                        <details
                          open={sourceGroupsOpen[source].imported}
                          data-ltm-source-group="imported"
                          onToggle={(event) => {
                            const open = event.currentTarget.open;
                            setSourceGroupsOpen((current) => ({
                              ...current,
                              [source]: { ...current[source], imported: open },
                            }));
                          }}
                        >
                          <summary className="cursor-pointer list-none bg-[var(--secondary)]/25 px-3 py-3 text-xs font-semibold">
                            {localizeUi("ui.longTermMemory.sourcesworkspace.alreadyImported")} (
                            {previewData?.totals.imported ?? importedRows.length})
                          </summary>
                          <div className="divide-y divide-[var(--border)]">{importedRows.map(renderFlatSourceRow)}</div>
                        </details>
                      </>
                    ) : (
                      activeFlatRows.map(renderFlatSourceRow)
                    )}
                    {!preview.isLoading && activeFlatRows.length === 0 ? (
                      <p className="p-4 text-xs text-[var(--muted-foreground)]">
                        {sourceStatusFilter === "imported"
                          ? localizeUi("ui.longTermMemory.sourcesworkspace.noSourcesHaveBeenImportedInThisScope")
                          : localizeUi("ui.longTermMemory.sourcesworkspace.noNewOrRetryableSourcesAreReadyToImport")}
                      </p>
                    ) : null}
                  </div>
                </section>
              ),
            }}
            workbench={{
              label: localizeUi("ui.longTermMemory.sourcesworkspace.sourcePreview"),
              content: (
                <section
                  className={`mari-editor-panel overflow-hidden ${workbenchModeClass}`}
                  data-ltm-source-workbench
                >
                  {sourceOperationWorkbench}
                  <div ref={setResultWorkbenchHost} className="contents" data-ltm-source-task-result-workbench />
                  {restoredImportResultPanel}
                  {selectedFlatSourceIds.length > 1 ? (
                    <section className="space-y-2 border-b border-[var(--border)] p-3" data-ltm-source-bulk-queue>
                      <h2 className="text-sm font-semibold">
                        {localizeUi("ui.longTermMemory.sourcesworkspace.selectedSourceParts")} (
                        {selectedFlatSourceIds.length})
                      </h2>
                      {selectedFlatSourceIds.map((id) => {
                        const row = rows.find((item) => item.sourceId === id);
                        return (
                          <details key={id} className="rounded border border-[var(--border)]">
                            <summary
                              className="cursor-pointer list-none px-3 py-2 text-xs font-semibold"
                              onClick={() => {
                                if (row) setFocusedFlatSourceId(row.sourceId);
                              }}
                            >
                              {row?.title ?? id} ·{" "}
                              {row
                                ? sourceStatusLabel(row, localizeUi)
                                : localizeUi("ui.longTermMemory.sourcesworkspace.selected")}
                            </summary>
                            {row ? (
                              <p className="whitespace-pre-wrap px-3 pb-3 text-xs text-[var(--muted-foreground)]">
                                {sourceDetailsData?.details.find((detail) => detail.sourceId === row.sourceId)
                                  ?.content ?? row.snippet}
                              </p>
                            ) : null}
                          </details>
                        );
                      })}
                    </section>
                  ) : null}
                  {activeSourceTask ? (
                    <div className="space-y-3 p-4" data-ltm-source-task-progress>
                      <StatusSurface busy>
                        <Loader2 aria-hidden="true" size="0.875rem" className="animate-spin" />
                        {sourceTaskProgressMessage}
                      </StatusSurface>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {localizeUi("ui.longTermMemory.sourcesworkspace.savingAndExtracting", {
                          count: activeSourceTask.sourceCount,
                        })}
                      </p>
                      <Button destructive onClick={cancelLtmSourceTask} data-ltm-source-action="cancel-import">
                        {localizeUi("ui.longTermMemory.memoryvault.cancel")}
                      </Button>
                    </div>
                  ) : focusedFlatRow ? (
                    <article className="space-y-3 p-4">
                      <header className="space-y-2 border-b border-[var(--border)] pb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold">{focusedFlatRow.title}</h2>
                          <span className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] font-semibold uppercase">
                            {sourceStatusLabel(focusedFlatRow, localizeUi)}
                          </span>
                          <span className="text-xs text-[var(--muted-foreground)]">
                            {sourceModeLabel(focusedFlatRow.importMode, localizeUi)}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--muted-foreground)]">{focusedFlatRow.summary}</p>
                        {sourceDetails.isLoading ? (
                          <div
                            className="h-32 animate-pulse rounded bg-[var(--secondary)]"
                            aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.loadingSourceContent")}
                          />
                        ) : sourceDetails.isError ? (
                          <StatusSurface tone="danger">
                            {sourceDetails.error instanceof Error
                              ? sourceDetails.error.message
                              : localizeUi("ui.longTermMemory.sourcesworkspace.sourcePreviewCouldNotLoad")}
                            <Button onClick={() => void sourceDetails.refetch()}>
                              {localizeUi("ui.longTermMemory.sourcesworkspace.refreshPreview")}
                            </Button>
                          </StatusSurface>
                        ) : focusedFlatDetail ? (
                          <pre className="max-h-[min(60vh,48rem)] overflow-auto whitespace-pre-wrap break-words rounded-md border border-[var(--border)] bg-[var(--secondary)]/25 p-3 text-sm">
                            {focusedFlatDetail.content}
                          </pre>
                        ) : (
                          <p className="text-sm text-[var(--muted-foreground)]">{focusedFlatRow.snippet}</p>
                        )}
                      </header>
                      <div className={mobilePrimaryActionsClass} data-ltm-source-primary-actions>
                        {selectedIds.size ? (
                          <Button
                            primary
                            disabled={!currentDestinationScope || importing}
                            onClick={() => void runImport([...selectedIds])}
                            data-ltm-source-action="import-selected"
                          >
                            <FileInput aria-hidden="true" size="0.75rem" />
                            {localizeUi("ui.longTermMemory.sourcesworkspace.importSelectedCount", {
                              count: selectedIds.size,
                            })}
                          </Button>
                        ) : selectedImportedIds.size ? (
                          <Button
                            disabled={!currentDestinationScope || importing}
                            onClick={() => void runImport([...selectedImportedIds], "refresh")}
                            data-ltm-source-action="refresh-selected"
                          >
                            <RefreshCw aria-hidden="true" size="0.75rem" />
                            {localizeUi("ui.longTermMemory.sourcesworkspace.refreshSelectedSourcesCount", {
                              count: selectedImportedIds.size,
                            })}
                          </Button>
                        ) : focusedFlatRow.status === "pending" || retryableIdSet.has(focusedFlatRow.sourceId) ? (
                          <Button
                            primary
                            disabled={!currentDestinationScope || importing}
                            onClick={() => void runImport([focusedFlatRow.sourceId])}
                            data-ltm-source-action="import"
                          >
                            <FileInput aria-hidden="true" size="0.75rem" />
                            {localizeUi("ui.longTermMemory.sourcesworkspace.importValue1", {
                              value1: focusedFlatRow.title,
                            })}
                          </Button>
                        ) : (
                          <>
                            <Button
                              disabled={!currentDestinationScope || importing}
                              onClick={() => void runImport([focusedFlatRow.sourceId], "refresh")}
                              data-ltm-source-action="refresh"
                            >
                              <RefreshCw aria-hidden="true" size="0.75rem" />
                              {localizeUi("ui.longTermMemory.sourcesworkspace.refreshPreview")}
                            </Button>
                            {bulkSelectionActive
                              ? null
                              : sourceInlineActions(focusedFlatRow.existingNoteId, focusedFlatRow.existingNoteTitle)}
                          </>
                        )}
                      </div>
                      {focusedFlatRow.status === "imported" ? (
                        <button
                          type="button"
                          data-ltm-source-memory-id={focusedFlatRow.existingNoteId}
                          className="text-left text-xs font-semibold text-[var(--primary)] underline underline-offset-2"
                          onClick={() => onOpenMemory?.(focusedFlatRow.existingNoteId)}
                        >
                          {localizeUi("ui.longTermMemory.sourcesworkspace.sourceMemory")}{" "}
                          {focusedFlatRow.existingNoteTitle}
                        </button>
                      ) : null}
                    </article>
                  ) : (
                    <div className="space-y-2 p-4 text-xs text-[var(--muted-foreground)]">
                      <p>{localizeUi("ui.longTermMemory.sourcesworkspace.selectASourceToInspect")}</p>
                      <p>
                        {localizeUi("ui.longTermMemory.sourcesworkspace.readyToImport")} (
                        {previewData?.totals.ready ?? 0}) ·{" "}
                        {localizeUi("ui.longTermMemory.sourcesworkspace.alreadyImported")} (
                        {previewData?.totals.imported ?? 0})
                      </p>
                    </div>
                  )}
                  {reextractResultPanel}
                </section>
              ),
            }}
            inspector={{
              label: localizeUi("ui.longTermMemory.sourcesworkspace.chooseDestination"),
              content: (
                <div className="space-y-3">
                  <DestinationScopePanel
                    targets={destinationTargets}
                    selectedIds={selectedDestinationTargetIds}
                    currentIds={currentDestinationIds}
                    onChange={changeDestinationIds}
                    mode={modeFilter}
                    source={source}
                    disabled={sourceTask.active?.status === "running"}
                  />
                  {focusedImportedSource ? (
                    <ImportedSourceInspector
                      source={focusedImportedSource}
                      disabled={sourceTask.active?.status === "running"}
                      bulkActive={bulkSelectionActive}
                      onOpenMemory={onOpenMemory}
                      onOpenReview={onOpenReview}
                      onReextract={(id) => void reextract(id)}
                      onManage={(id, title, operation) => {
                        setSourceOperation({ id, title, operation });
                        setWorkspacePane("workbench");
                      }}
                    />
                  ) : null}
                  {latestSourceTask ? (
                    <button
                      type="button"
                      className="mari-editor-panel flex min-h-11 w-full items-center justify-between gap-2 p-3 text-left text-xs"
                      data-ltm-latest-source-task
                      onClick={() => void openLatestTaskResult()}
                    >
                      <span className="font-semibold">{latestSourceTaskLabel}</span>
                      <span className="text-[var(--muted-foreground)]">
                        {latestSourceTask.sourceCount} · {latestSourceTask.status}
                      </span>
                    </button>
                  ) : null}
                </div>
              ),
            }}
          />
        </section>
      )}

      {importResult && visibleImportResult && resultWorkbenchHost
        ? createPortal(
            <section
              ref={importResultRef}
              role="region"
              aria-labelledby={importResultLabelId}
              data-ltm-source-import-result={importResult.batchStatus}
              data-ltm-source-task-result-workbench
              className="mari-editor-panel space-y-3 p-3"
            >
              <h2 id={importResultLabelId} className="text-sm font-semibold">
                {localizeUi("ui.longTermMemory.sourcesworkspace.sourceImportComplete")}
              </h2>
              {importScopeResultMessage ? (
                <p className="text-xs font-medium" data-ltm-import-scope-result>
                  {importScopeResultMessage}
                </p>
              ) : null}
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
                  className="space-y-2 border-t border-[var(--border)] py-3 first:border-t-0"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <strong>{item.title}</strong>
                    <span data-ltm-import-result-mode={item.note.modes[0]} className="text-[var(--muted-foreground)]">
                      {sourceModeLabel(item.note.modes[0] ?? "roleplay", localizeUi)}
                    </span>
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
              <Button onClick={closeTaskResult}>
                {localizeUi("ui.longTermMemory.sourcesworkspace.backToPreview")}
              </Button>
            </section>,
            resultWorkbenchHost,
          )
        : null}
    </section>
  );
}
