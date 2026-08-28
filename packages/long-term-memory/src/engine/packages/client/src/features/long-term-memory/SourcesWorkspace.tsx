import { type KeyboardEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Plus,
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
  LtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { invalidateLtmQueries, queryKeys, request } from "./api";
import { Button, ClickSurface, IconButton, InfoPopover, StatusSurface, inputClass } from "./shared-controls";
import { humanizeLabel, labelKeys, localizedLabel, noteTypeLabel } from "./display-labels";
import type { LongTermMemoryDestinationProps, SourceTab } from "./types";
import { useLtmTranslation, type LtmTranslationFunction } from "./localization";
import { LtmWorkspace } from "./LtmWorkspace";
import type { LtmWorkspacePane } from "./LtmWorkspace";
import { buildScopeIndexes, type ScopeTargetChat, type ScopeTargets } from "./scope-targets";
import {
  normalizeLtmScope,
  withMergedLtmScopeLinks,
} from "../../../../shared/src/features/agents/long-term-memory/scope.js";

type Source = SourceTab;
type FlatPanel = "available" | "imported";
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
}: {
  targets: ScopeTarget[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  testId: string;
  destination?: boolean;
  required?: boolean;
  invalid?: boolean;
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
  const filteredTargets = targets.filter((target) => matches(target));
  const optionTargets = [
    ...(selectedTarget && matches(selectedTarget) ? [selectedTarget] : []),
    ...groups.flatMap(([kind]) => filteredTargets.filter((target) => target.kind === kind && target.id !== value)),
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
            {selectedTarget && matches(selectedTarget) ? (
              <div className="border-b border-[var(--marinara-editor-divider)]">
                <p className="bg-[var(--secondary)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  {localizeUi("ui.longTermMemory.sourcesworkspace.selectedLocation")}
                </p>
                {option(selectedTarget)}
              </div>
            ) : null}
            {groups.map(([kind, label]) => {
              const options = filteredTargets.filter((target) => target.kind === kind && target.id !== value);
              return options.length ? (
                <div key={kind}>
                  <p className="border-b border-[var(--marinara-editor-divider)] bg-[var(--secondary)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                    {label}
                  </p>
                  {options.map(option)}
                </div>
              ) : null;
            })}
            {!filteredTargets.length ? (
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

function BulkDestinationPicker({
  primaryTarget,
  targets,
  selectedIds,
  onChange,
}: {
  primaryTarget?: ScopeTarget;
  targets: ScopeTarget[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const [open, setOpen] = useState(false);
  const [draftIds, setDraftIds] = useState(selectedIds);
  const [activeKind, setActiveKind] = useState<"all" | Exclude<ScopeTargetKind, "all">>("all");
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const availableTargets = useMemo(
    () =>
      targets
        .filter((target) => target.id !== primaryTarget?.id)
        .sort((left, right) => left.label.localeCompare(right.label)),
    [primaryTarget?.id, targets],
  );
  const categoryLabels: Record<"all" | Exclude<ScopeTargetKind, "all">, string> = {
    all: localizeUi("ui.longTermMemory.sourcesworkspace.all"),
    chat: localizeUi("ui.longTermMemory.sourcesworkspace.chats"),
    branch: localizeUi("ui.longTermMemory.sourcesworkspace.branches"),
    character: localizeUi("ui.longTermMemory.sourcesworkspace.characters"),
    persona: localizeUi("ui.longTermMemory.sourcesworkspace.personas"),
  };
  const categories: Array<["all" | Exclude<ScopeTargetKind, "all">, string]> = [
    ["all", categoryLabels.all],
    ["chat", categoryLabels.chat],
    ["branch", categoryLabels.branch],
    ["character", categoryLabels.character],
    ["persona", categoryLabels.persona],
  ];
  const activeTargets =
    activeKind === "all" ? availableTargets : availableTargets.filter((target) => target.kind === activeKind);
  const needle = query.trim().toLocaleLowerCase();
  const filteredTargets = activeTargets.filter((target) =>
    `${target.label} ${target.comment ?? ""} ${target.destinationLabel ?? ""} ${target.searchText ?? ""}`
      .toLocaleLowerCase()
      .includes(needle),
  );
  const selectedTargets = availableTargets.filter((target) => draftIds.includes(target.id));
  const currentDestinationScope = mergedDestinationScope([
    ...(primaryTarget ? [primaryTarget] : []),
    ...selectedTargets,
  ]);
  const targetExceedsLimit = (target: ScopeTarget) =>
    !draftIds.includes(target.id) && !targetFitsDestinationScope(currentDestinationScope, target);
  const blockedTargetCount = filteredTargets.filter((target) => targetExceedsLimit(target)).length;
  const toggle = (id: string) => {
    if (draftIds.includes(id)) {
      setDraftIds((current) => current.filter((value) => value !== id));
      return;
    }
    const target = availableTargets.find((item) => item.id === id);
    if (target && !targetExceedsLimit(target))
      setDraftIds((current) => (current.includes(id) ? current : [...current, id]));
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

  const restoreTriggerFocus = () => requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  const closePicker = () => {
    setOpen(false);
    restoreTriggerFocus();
  };

  useEffect(() => {
    const transitionedOpen = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (transitionedOpen) {
      setDraftIds(selectedIds);
      setActiveKind("all");
      setQuery("");
      requestAnimationFrame(() => dialog.querySelector<HTMLElement>("input")?.focus());
    }
  }, [open, selectedIds]);

  return (
    <>
      <Button
        ref={triggerRef}
        disabled={!primaryTarget}
        onClick={() => setOpen(true)}
        data-ltm-add-destination
        className="w-full justify-center sm:w-auto"
      >
        <Plus aria-hidden="true" size="0.875rem" />
        {localizeUi("ui.longTermMemory.sourcesworkspace.addMoreLocations")}
        {selectedIds.length ? ` (${selectedIds.length})` : ""}
      </Button>
      {open ? (
        <dialog
          ref={dialogRef}
          data-ltm-bulk-destination
          aria-modal="true"
          aria-labelledby="ltm-bulk-destination-title"
          onCancel={(event) => {
            event.preventDefault();
            closePicker();
          }}
          onClose={() => {
            setOpen(false);
            restoreTriggerFocus();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) closePicker();
          }}
          className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none bg-black/50 p-0 backdrop:bg-black/50 sm:grid sm:place-items-center sm:p-4"
        >
          <section className="flex h-full w-full flex-col bg-[var(--background)] text-[var(--foreground)] sm:h-auto sm:max-h-[min(42rem,calc(100vh-2rem))] sm:max-w-2xl sm:rounded-md sm:border sm:border-[var(--border)] sm:shadow-xl">
            <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-4">
              <div className="min-w-0">
                <h2 id="ltm-bulk-destination-title" className="text-base font-semibold">
                  {localizeUi("ui.longTermMemory.sourcesworkspace.addMoreLocations")}
                </h2>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {localizeUi("ui.longTermMemory.sourcesworkspace.bulkDestinationHelp")}
                </p>
              </div>
              <IconButton
                icon={X}
                label={localizeUi("ui.longTermMemory.sourcesworkspace.closeBulkPicker")}
                onClick={closePicker}
              />
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="sticky top-0 z-10 space-y-3 bg-[var(--background)] p-4 pb-3">
                <div className="rounded-md border border-[var(--border)] bg-[var(--secondary)]/35 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                    {localizeUi("ui.longTermMemory.sourcesworkspace.primaryLocation")}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold">
                    {primaryTarget ? targetDisplayLabel(primaryTarget, true) : ""}
                  </p>
                </div>
                {selectedTargets.length ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold">
                      {localizeUi("ui.longTermMemory.sourcesworkspace.selectedLocations")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTargets.map((target) => (
                        <span
                          key={target.id}
                          className="inline-flex max-w-full items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs"
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{targetDisplayLabel(target, true)}</span>
                            {target.comment ? (
                              <span className="block truncate text-xs text-[var(--muted-foreground)]">
                                {target.comment}
                              </span>
                            ) : null}
                          </span>
                          <button
                            type="button"
                            aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.removeLocationValue1", {
                              value1: targetDisplayLabel(target, true),
                            })}
                            className="grid h-11 w-11 shrink-0 place-items-center rounded hover:bg-[var(--accent)]"
                            onClick={() => setDraftIds((current) => current.filter((id) => id !== target.id))}
                          >
                            <X aria-hidden="true" size="0.75rem" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <label className="relative block">
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
                    data-ltm-availability-search={activeKind}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                {blockedTargetCount ? (
                  <p role="note" className="text-xs text-[var(--muted-foreground)]">
                    {localizeUi("ui.longTermMemory.sourcesworkspace.destinationScopeLimitReached")}
                  </p>
                ) : null}
                <div
                  role="tablist"
                  aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.additionalLocations")}
                  className="grid grid-cols-2 gap-1 sm:grid-cols-5"
                >
                  {categories.map(([kind, label], index) => {
                    const count =
                      kind === "all"
                        ? draftIds.length
                        : draftIds.filter((id) =>
                            availableTargets.some((target) => target.id === id && target.kind === kind),
                          ).length;
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
              </div>
              <div
                id="ltm-bulk-destination-list"
                role="tabpanel"
                className="px-4 pb-4"
                aria-label={categoryLabels[activeKind]}
              >
                {filteredTargets.length ? (
                  <div className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
                    {filteredTargets.map((target) => (
                      <label
                        key={target.id}
                        data-ltm-availability-target={`${target.kind}:${target.id.split(":").slice(1).join(":")}`}
                        className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-[var(--secondary)]/35"
                      >
                        <input
                          type="checkbox"
                          className={sourceCheckboxClass}
                          checked={draftIds.includes(target.id)}
                          disabled={targetExceedsLimit(target)}
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
                            <span className="block truncate text-xs text-[var(--muted-foreground)]">
                              {target.comment}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-[var(--border)] px-3 py-4 text-xs text-[var(--muted-foreground)]">
                    {localizeUi("ui.longTermMemory.sourcesworkspace.noMatchingScopes")}
                  </p>
                )}
              </div>
            </div>
            <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] p-4">
              <Button onClick={closePicker} data-ltm-bulk-cancel>
                {localizeUi("ui.longTermMemory.sourcesworkspace.cancel")}
              </Button>
              <Button
                primary
                onClick={() => {
                  onChange(draftIds);
                  closePicker();
                }}
                data-ltm-bulk-done
              >
                {localizeUi("ui.longTermMemory.sourcesworkspace.done")}
              </Button>
            </footer>
          </section>
        </dialog>
      ) : null}
    </>
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
const sourceCheckboxClass = "size-6 shrink-0 accent-[var(--marinara-editor-accent)]";

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
    if (!linked.data || linked.isError || ((operation === "copy" || operation === "move") && !destinationChatId))
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
    if (!linked.data || linked.isError || !previewed || busy || result) return;
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
  const sourceScopeLabelId = useId();
  const destinationScopeLabelId = useId();
  const importResultLabelId = useId();
  const client = useQueryClient();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectAllImportedRef = useRef<HTMLInputElement>(null);
  const importControllerRef = useRef<AbortController | null>(null);
  const [source, setSource] = useState<Source>(selectedSource ?? "chats");
  const [selectedLorebookId, setSelectedLorebookId] = useState<string | null>(null);
  const [lorebookMobilePane, setLorebookMobilePane] = useState<Exclude<LtmWorkspacePane, "inspector">>("navigator");
  const [sourceTargetId, setSourceTargetId] = useState(props.chatId ? `chat:${props.chatId}` : "all");
  const [destinationTargetId, setDestinationTargetId] = useState(props.chatId ? `chat:${props.chatId}` : "");
  const [additionalDestinationTargetIds, setAdditionalDestinationTargetIds] = useState<string[]>([]);
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
  const scopeTargetOptions = useMemo(() => {
    const chatTarget = (chat: ScopeTargetChat, current = false): ScopeTarget => ({
      id: `chat:${chat.id}`,
      label: current ? (props.chatName ?? localizeUi("ui.longTermMemory.sourcesworkspace.currentChat")) : chat.label,
      kind: "chat",
      sourceScope: {
        chatId: chat.id,
        chatIds: [chat.id],
      },
      destinationScope: { chatId: chat.id, chatIds: [chat.id] },
      searchText: [chat.mode, chat.groupId, chat.personaId, ...chat.characterIds].filter(Boolean).join(" "),
    });
    return [
      ...(props.chatId
        ? [
            chatTarget(
              scopeIndexes.chatsById.get(props.chatId) ?? {
                id: props.chatId,
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
      ...(scopeTargets.data?.chats ?? []).filter((chat) => chat.id !== props.chatId).map((chat) => chatTarget(chat)),
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
      {
        id: "all",
        label: localizeUi("ui.longTermMemory.sourcesworkspace.allAvailable"),
        kind: "all" as const,
        sourceScope: undefined,
        destinationScope: undefined,
      },
    ].filter((target, index, targets) => targets.findIndex((item) => item.id === target.id) === index);
  }, [localizeUi, props.chatId, props.chatName, scopeIndexes.chatsById, scopeTargets.data]);
  const sourceTarget =
    scopeTargetOptions.find((target) => target.id === sourceTargetId) ??
    scopeTargetOptions.find((target) => target.id === "all") ??
    scopeTargetOptions[0];
  const destinationTargets = useMemo(
    () =>
      scopeTargetOptions.filter(
        (target) => target.kind !== "all" && hasDestinationScopeCapacity(target.destinationScope),
      ),
    [scopeTargetOptions],
  );
  const destinationTarget = destinationTargets.find((target) => target.id === destinationTargetId);
  const primaryDestinationTarget = destinationTarget;
  const additionalDestinationTargets = additionalDestinationTargetIds.flatMap((id) => {
    const target = destinationTargets.find((item) => item.id === id);
    return target ? [target] : [];
  });
  const selectedDestinationTargets = primaryDestinationTarget
    ? [primaryDestinationTarget, ...additionalDestinationTargets]
    : [];
  const currentDestinationScope = mergedDestinationScope(selectedDestinationTargets);
  const currentDestinationLabel = primaryDestinationTarget
    ? `${targetDisplayLabel(primaryDestinationTarget, true)}${
        additionalDestinationTargets.length
          ? ` + ${localizeUi("ui.longTermMemory.sourcesworkspace.additionalLocationsCount", {
              count: additionalDestinationTargets.length,
            })}`
          : ""
      }`
    : localizeUi("ui.longTermMemory.sourcesworkspace.chooseDestination");
  const sourceScope = sourceTarget?.sourceScope;
  const previewScope =
    source === "chats" || source === "lorebooks" || (source === "characters" && sourceTarget?.kind === "character")
      ? sourceScope
      : undefined;
  const effectiveImportScope = `${sourceTargetId}:${destinationTargetId || "none"}:${[...additionalDestinationTargetIds]
    .sort()
    .join(",")}`;
  const preview = useQuery({
    queryKey: [...queryKeys.preview, source, previewScope, modeFilter],
    queryFn: () =>
      request<LtmInteropPreviewResponse, { source: Source; limit: number; sourceScope?: LtmScope; mode?: LtmMode }>(
        "/import/preview",
        "POST",
        {
          source,
          limit: 100,
          ...(previewScope ? { sourceScope: previewScope } : {}),
          ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
        },
      ),
    enabled: source !== "lorebooks",
  });
  const lorebookPreview = useQuery({
    queryKey: [...queryKeys.lorebookPreview, previewScope, modeFilter],
    queryFn: () =>
      request<LtmLorebookPreviewResponse, { limit: number; sourceScope?: LtmScope; mode?: LtmMode }>(
        "/import/lorebooks/preview",
        "POST",
        {
          limit: 100,
          ...(previewScope ? { sourceScope: previewScope } : {}),
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
  const importScopeResultMessage = importResultContract
    ? localizeUi("ui.longTermMemory.sourcesworkspace.importScopeResult", {
        source: importResultContract.sourceTargetLabel,
        destination: importResultContract.destinationTargetLabel,
      })
    : "";

  const clearImportResult = useCallback(() => {
    setImportResult(null);
    setImportResultContract(null);
    setCancelledImport(null);
    setImportError("");
    setReviewMessage("");
    setSourceOperation(null);
  }, []);

  const changeSource = useCallback(
    (next: Source) => {
      setSource(next);
      onSourceChange?.(next);
      if (next === "lorebooks") setLorebookMobilePane("navigator");
      clearImportResult();
    },
    [clearImportResult, onSourceChange],
  );

  useEffect(() => {
    if (!scopeTargetOptions.some((target) => target.id === sourceTargetId))
      setSourceTargetId(props.chatId ? `chat:${props.chatId}` : "all");
    if (!destinationTargets.some((target) => target.id === destinationTargetId))
      setDestinationTargetId(props.chatId ? `chat:${props.chatId}` : "");
    setAdditionalDestinationTargetIds((current) =>
      current.filter((id) => destinationTargets.some((target) => target.id === id)),
    );
  }, [destinationTargetId, destinationTargets, props.chatId, scopeTargetOptions, sourceTargetId]);

  useEffect(() => {
    setSourceTargetId(props.chatId ? `chat:${props.chatId}` : "all");
    setDestinationTargetId(props.chatId ? `chat:${props.chatId}` : "");
    setAdditionalDestinationTargetIds([]);
  }, [props.chatId]);

  useEffect(() => {
    if (!requestedSource) return;
    changeSource(requestedSource.source);
    onRequestedSourceHandled?.();
  }, [changeSource, onRequestedSourceHandled, requestedSource]);

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

  const changeSourceScope = (next: string) => {
    setSourceTargetId(next);
    clearImportResult();
  };

  const changeDestinationScope = (next: string) => {
    const nextTarget = destinationTargets.find((target) => target.id === next);
    const retainedAdditionalTargets = additionalDestinationTargetIds.flatMap((id) => {
      const target = destinationTargets.find((item) => item.id === id);
      return target && target.id !== next ? [target] : [];
    });
    if (
      nextTarget &&
      !hasDestinationScopeCapacity(mergedDestinationScope([nextTarget, ...retainedAdditionalTargets]))
    ) {
      setImportError(localizeUi("ui.longTermMemory.sourcesworkspace.destinationScopeLimitReached"));
      return;
    }
    setDestinationTargetId(next);
    setAdditionalDestinationTargetIds((current) => current.filter((id) => id !== next));
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
          sourceScope?: LtmScope;
          destinationScope?: LtmScope;
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
          ...(contract.sourceScope ? { sourceScope: contract.sourceScope } : {}),
          ...(contract.destinationScope ? { destinationScope: contract.destinationScope } : {}),
          ...(contract.mode ? { mode: contract.mode } : {}),
          ...(contract.chatId ? { chatId: contract.chatId } : {}),
        },
        controller.signal,
      );
      setImportResult(result);
      setImportResultContract(contract);
      const failedIds = [
        ...result.imported.filter((item) => item.retryable).map((item) => item.sourceId),
        ...result.writeFailures.filter((item) => item.retryable).map((item) => item.sourceId),
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
          />
        </div>
        <div
          id="ltm-destination-scope-control"
          role="group"
          aria-labelledby={destinationScopeLabelId}
          className="flex min-h-11 w-full flex-col gap-2 text-xs font-medium"
        >
          <div className="flex min-h-11 w-full flex-col gap-2 sm:flex-row sm:items-center">
            <span id={destinationScopeLabelId} className="sm:shrink-0">
              {localizeUi("ui.longTermMemory.sourcesworkspace.makeMemoriesAvailableIn")}
            </span>
            <ScopeTargetPicker
              targets={destinationTargets}
              value={destinationTargetId}
              onChange={changeDestinationScope}
              ariaLabel={localizeUi("ui.longTermMemory.sourcesworkspace.makeMemoriesAvailableIn")}
              testId="destination"
              destination
              required
              invalid={!primaryDestinationTarget}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:pl-[8.5rem]">
            <BulkDestinationPicker
              primaryTarget={primaryDestinationTarget}
              targets={destinationTargets}
              selectedIds={additionalDestinationTargetIds}
              onChange={(ids) => {
                setAdditionalDestinationTargetIds(ids);
                clearImportResult();
              }}
            />
            {additionalDestinationTargets.length ? (
              <span className="text-xs text-[var(--muted-foreground)]" data-ltm-additional-destination-summary>
                {localizeUi("ui.longTermMemory.sourcesworkspace.additionalLocationsCount", {
                  count: additionalDestinationTargets.length,
                })}
              </span>
            ) : null}
          </div>
          {!primaryDestinationTarget ? (
            <span role="alert" className="text-[var(--marinara-editor-warning)]">
              {localizeUi("ui.longTermMemory.sourcesworkspace.chooseDestinationBeforeImport")}
            </span>
          ) : null}
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
                                    <span className="text-xs text-[var(--muted-foreground)]">
                                      {sourceModeLabel(entry.candidates[0]?.importMode ?? "roleplay", localizeUi)}
                                    </span>
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
                className={sourceCheckboxClass}
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
                      className={sourceCheckboxClass}
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
                        <span
                          data-ltm-source-import-mode={row.importMode}
                          className="text-xs text-[var(--muted-foreground)]"
                        >
                          {sourceModeLabel(row.importMode, localizeUi)}
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
        </section>
      ) : null}
    </section>
  );
}
