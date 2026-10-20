import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { inputClass } from "./shared-controls";
import { scopeKindCategories } from "./display-labels";
import { selectLtmPluralForm, useLtmTranslation } from "./localization";
import { nextTabIndex } from "./tab-keys";
import { targetDisplayLabel } from "./sources/source-shared";
import type { ScopeTarget, ScopeTargetKind } from "./sources/source-shared";

const showNoMemoriesId = "no-memories:show";

/**
 * The single-place picker for Sources and the Memory Vault filters. `memoryGroups` splits the list into places
 * with memories and a collapsed group without them; searching opens that group. While collapsed, the group is a
 * "Show N places" option, so the listbox holds only options and groups.
 */
export function SourceScopeCombobox({
  targets,
  value,
  onChange,
  ariaLabel,
  testId,
  destination = false,
  required = false,
  invalid = false,
  disabled = false,
  memoryGroups,
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
  memoryGroups?: { has: (target: ScopeTarget) => boolean; withLabel: string; withoutLabel: string };
}) {
  const { locale, t: localizeUi } = useLtmTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeKind, setActiveKind] = useState<ScopeTargetKind>("all");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const panelId = useId();
  const tablistId = useId();
  const categories = scopeKindCategories(localizeUi);
  const selectedTarget = targets.find((target) => target.id === value);
  const needle = query.trim().toLocaleLowerCase();
  const matches = (target: ScopeTarget) =>
    `${target.label} ${target.comment ?? ""} ${target.destinationLabel ?? ""} ${target.searchText ?? ""}`
      .toLocaleLowerCase()
      .includes(needle);
  const pinnedTargets = targets.filter((target) => {
    if (!target.pinned) return false;
    if (target.pinned === "all") return true;
    return activeKind === "all" || target.kind === activeKind;
  });
  const regularTargets = targets.filter(
    (target) =>
      !target.pinned && matches(target) && (activeKind === "all" ? target.kind !== "all" : target.kind === activeKind),
  );
  const targetsWithMemories = memoryGroups ? regularTargets.filter(memoryGroups.has) : [];
  const targetsWithoutMemories = memoryGroups ? regularTargets.filter((target) => !memoryGroups.has(target)) : [];
  const [noMemoriesOpen, setNoMemoriesOpen] = useState(false);
  const noMemoriesPreference = useRef(false);
  const wasSearching = useRef(false);
  useEffect(() => {
    if (needle) setNoMemoriesOpen(true);
    else if (wasSearching.current) setNoMemoriesOpen(noMemoriesPreference.current);
    wasSearching.current = Boolean(needle);
  }, [needle]);
  const resetNoMemories = () => {
    setNoMemoriesOpen(false);
    noMemoriesPreference.current = false;
    wasSearching.current = false;
  };
  const optionTargets = memoryGroups
    ? [...pinnedTargets, ...targetsWithMemories, ...(noMemoriesOpen ? targetsWithoutMemories : [])]
    : [...pinnedTargets, ...regularTargets];
  const showNoMemories = Boolean(memoryGroups && !noMemoriesOpen && targetsWithoutMemories.length);
  const optionIds = [...optionTargets.map((target) => target.id), ...(showNoMemories ? [showNoMemoriesId] : [])];
  const [highlightedId, setHighlightedId] = useState(value);
  useEffect(() => setHighlightedId(value), [value]);
  const close = () => {
    setOpen(false);
    setQuery("");
    setActiveKind("all");
    resetNoMemories();
    requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  };
  const selectKind = (kind: ScopeTargetKind, focusTab = false) => {
    setActiveKind(kind);
    setHighlightedId("");
    if (!needle) resetNoMemories();
    if (focusTab) document.getElementById(`${tablistId}-${kind}`)?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
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

  // The "Show N places" row opens its group without choosing a place. A place moves focus to the place button
  // before onChange, so an unsaved-changes prompt records the button, not an option the close removes.
  const choose = (id: string) => {
    if (id === showNoMemoriesId) {
      noMemoriesPreference.current = true;
      setNoMemoriesOpen(true);
      setHighlightedId(targetsWithoutMemories[0]?.id ?? "");
      return;
    }
    triggerRef.current?.focus({ preventScroll: true });
    close();
    onChange(id);
  };
  const moveHighlight = (direction: 1 | -1) => {
    if (!optionIds.length) return;
    const currentIndex = optionIds.indexOf(highlightedId);
    const nextIndex =
      currentIndex < 0
        ? direction === 1
          ? 0
          : optionIds.length - 1
        : (currentIndex + direction + optionIds.length) % optionIds.length;
    setHighlightedId(optionIds[nextIndex]!);
  };
  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const nextIndex = nextTabIndex(event.key, index, categories.length);
    if (nextIndex === null) return;
    event.preventDefault();
    selectKind(categories[nextIndex]![0], true);
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
      className={`mari-editor-action mari-editor-action--compact flex min-h-11 w-full items-center gap-2 rounded-none border-t-0 px-3 py-2 text-left text-xs last:border-b-0 ${target.id === highlightedId ? "bg-[var(--secondary)]" : target.id === value ? "bg-[var(--primary)]/10" : ""}`}
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={() => setHighlightedId(target.id)}
      onClick={() => choose(target.id)}
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
    <div ref={rootRef} className="relative min-w-0 flex-1" data-ltm-scope-picker={testId}>
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
          className="absolute left-0 top-full z-30 mt-2 w-full overflow-hidden rounded-md border border-[var(--marinara-editor-divider)] shadow-xl"
          data-ltm-scope-picker-popup
          style={{
            containerType: "inline-size",
            minWidth: "min(20rem, calc(100vw - 2rem))",
            // --card can be translucent; layering it over --background keeps the list readable over the page.
            backgroundColor: "var(--background)",
            backgroundImage: "linear-gradient(var(--card), var(--card))",
          }}
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
                highlightedId && optionIds.includes(highlightedId) ? `${listId}-option-${highlightedId}` : undefined
              }
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlightedId("");
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  moveHighlight(event.key === "ArrowDown" ? 1 : -1);
                } else if (event.key === "Enter" && optionIds.includes(highlightedId)) {
                  event.preventDefault();
                  choose(highlightedId);
                }
              }}
            />
          </label>
          <div
            role="tablist"
            aria-label={ariaLabel}
            data-ltm-scope-tablist
            className="mari-editor-tab-rail grid w-full min-w-0 gap-1 border-b border-[var(--marinara-editor-divider)] p-1"
          >
            <style>{`
              [data-ltm-scope-tablist] {
                grid-template-columns: repeat(2, minmax(0, 1fr));
              }
              [data-ltm-scope-tab]:not([data-active="true"]):not(:hover) {
                background: var(--marinara-editor-control-bg);
              }
              @container (min-width: 16rem) {
                [data-ltm-scope-tablist] {
                  grid-template-columns: repeat(4, minmax(0, 1fr));
                }
              }
              @container (max-width: 15rem) {
                [data-ltm-scope-tablist] {
                  grid-template-columns: minmax(0, 1fr);
                }
              }
            `}</style>
            {categories.map(([kind, label], index) => (
              <button
                key={kind}
                type="button"
                role="tab"
                id={`${tablistId}-${kind}`}
                aria-controls={panelId}
                tabIndex={activeKind === kind ? 0 : -1}
                aria-selected={activeKind === kind}
                data-ltm-scope-tab={kind}
                data-active={activeKind === kind}
                data-ltm-tab-focus
                className="mari-editor-tab min-h-11 min-w-0 rounded-md px-1 text-xs font-semibold"
                onClick={() => selectKind(kind, true)}
                onKeyDown={(event) => handleTabKey(event, index)}
              >
                <span className="block truncate">{label}</span>
              </button>
            ))}
          </div>
          <div
            id={panelId}
            role="tabpanel"
            aria-labelledby={`${tablistId}-${activeKind}`}
            data-ltm-scope-tabpanel={activeKind}
          >
            <div id={listId} role="listbox" aria-label={ariaLabel} className="max-h-72 overflow-y-auto">
              {pinnedTargets.map(option)}
              {memoryGroups ? (
                <>
                  {targetsWithMemories.length ? (
                    <div role="group" aria-label={memoryGroups.withLabel} data-ltm-scope-presence="with-memories">
                      <p className="border-b border-[var(--marinara-editor-divider)] bg-[var(--secondary)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                        {memoryGroups.withLabel}
                      </p>
                      {targetsWithMemories.map(option)}
                    </div>
                  ) : null}
                  {targetsWithoutMemories.length && noMemoriesOpen ? (
                    <div role="group" aria-label={memoryGroups.withoutLabel} data-ltm-scope-presence="no-memories">
                      <p className="border-b border-[var(--marinara-editor-divider)] bg-[var(--secondary)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                        {memoryGroups.withoutLabel}
                      </p>
                      {targetsWithoutMemories.map(option)}
                    </div>
                  ) : null}
                  {showNoMemories ? (
                    <button
                      type="button"
                      role="option"
                      id={`${listId}-option-${showNoMemoriesId}`}
                      aria-selected={false}
                      data-highlighted={highlightedId === showNoMemoriesId}
                      data-ltm-scope-show-no-memories
                      className={`mari-editor-action mari-editor-action--compact flex min-h-11 w-full items-center rounded-none border-t-0 px-3 py-2 text-left text-xs font-semibold text-[var(--muted-foreground)] last:border-b-0 ${highlightedId === showNoMemoriesId ? "bg-[var(--secondary)]" : ""}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setHighlightedId(showNoMemoriesId)}
                      onClick={() => choose(showNoMemoriesId)}
                    >
                      {localizeUi(
                        selectLtmPluralForm(locale, targetsWithoutMemories.length) === "one"
                          ? "ui.longTermMemory.memoryvault.showNoMemoriesOne"
                          : "ui.longTermMemory.memoryvault.showNoMemories",
                        { count: targetsWithoutMemories.length.toLocaleString(locale) },
                      )}
                    </button>
                  ) : null}
                </>
              ) : (
                regularTargets.map(option)
              )}
              {!pinnedTargets.length && !regularTargets.length ? (
                <p className="px-3 py-4 text-xs text-[var(--muted-foreground)]">
                  {localizeUi("ui.longTermMemory.sourcesworkspace.noMatchingScopes")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
