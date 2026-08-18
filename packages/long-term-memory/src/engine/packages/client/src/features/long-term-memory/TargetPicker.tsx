import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, Search, X } from "lucide-react";
import { IconButton, inputClass } from "./shared-controls";

export type PickerTarget = {
  id: string;
  label: string;
  comment?: string;
  kind: "chat" | "group" | "character" | "persona";
};

export type AvailabilityTarget = {
  id: string;
  label: string;
  comment?: string;
  groupId?: string;
};
export type AvailabilityChatTarget = AvailabilityTarget & {
  mode?: string;
  characterIds?: string[];
  personaId?: string | null;
  chatIds?: string[];
  members?: AvailabilityChatTarget[];
};

export function AvailabilityTabRail({
  characters,
  personas,
  chats,
  branches,
  selectedIds,
  tablistLabel,
  sectionCopy,
  onToggle,
}: {
  characters: AvailabilityTarget[];
  personas: AvailabilityTarget[];
  chats: AvailabilityChatTarget[];
  branches: AvailabilityChatTarget[];
  selectedIds: ReadonlySet<string>;
  tablistLabel: string;
  sectionCopy: {
    character: {
      label: string;
      allLabel: string;
      searchPlaceholder: string;
      emptyLabel: string;
      accessibleLabel: (count: number) => string;
    };
    persona: {
      label: string;
      allLabel: string;
      searchPlaceholder: string;
      emptyLabel: string;
      accessibleLabel: (count: number) => string;
    };
    chat: {
      label: string;
      allLabel: string;
      searchPlaceholder: string;
      emptyLabel: string;
      accessibleLabel: (count: number) => string;
    };
    branch: {
      label: string;
      allLabel: string;
      searchPlaceholder: string;
      emptyLabel: string;
      accessibleLabel: (count: number) => string;
    };
  };
  onToggle: (kind: "character" | "persona" | "chat" | "branch", id: string) => void;
}) {
  const sections = [
    ["character", characters],
    ["persona", personas],
    ["chat", chats],
    ["branch", branches],
  ] as const;
  type SectionKind = (typeof sections)[number][0];
  const railId = useId();
  const [queries, setQueries] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<SectionKind>("character");
  const activeEntry = sections.find(([kind]) => kind === activeSection)!;
  const [activeKind, activeTargets] = activeEntry;
  const activeCopy = sectionCopy[activeKind];
  const query = queries[activeKind] ?? "";
  const displayedTargetsFor = (kind: SectionKind, targets: readonly AvailabilityTarget[], allLabel: string) =>
    kind === "chat" || kind === "branch" ? [{ id: "all", label: allLabel }, ...targets] : targets;
  const displayedTargets = displayedTargetsFor(activeKind, activeTargets, activeCopy.allLabel);
  const filtered = displayedTargets.filter((target) =>
    `${target.label} ${target.comment ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const panelId = `${railId}-panel`;
  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? sections.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + sections.length) % sections.length;
    const nextKind = sections[nextIndex]![0];
    setActiveSection(nextKind);
    requestAnimationFrame(() => document.getElementById(`${railId}-${nextKind}-tab`)?.focus({ preventScroll: true }));
  };

  return (
    <div
      data-ltm-availability-tabs
      className="overflow-hidden border-y border-[var(--marinara-editor-divider)] bg-[var(--marinara-editor-control-bg)]"
      style={{ containerType: "inline-size" }}
    >
      <style>{`
        [data-ltm-availability-tablist] {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1px;
          width: 100%;
          box-sizing: border-box;
          border-bottom: 1px solid var(--marinara-editor-divider);
          background: var(--marinara-editor-divider);
        }
        [data-ltm-availability-count] {
          flex: 0 0 auto;
          margin-left: 0.25rem;
          padding-inline: 0.25rem;
          font-size: 0.625rem;
        }
        [data-ltm-availability-tab] {
          justify-self: stretch;
          min-width: 0;
          border: 0;
          border-radius: 0;
          background: var(--marinara-editor-control-bg);
        }
        [data-ltm-availability-tab][data-active="true"] {
          background: var(--secondary);
        }
        @container (min-width: 34rem) {
          [data-ltm-availability-tablist] {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        @container (max-width: 28rem) {
          [data-ltm-availability-tablist] {
            grid-template-columns: minmax(0, 1fr);
          }
        }
        @container (max-width: 36rem) {
          [data-ltm-availability-tab] {
            padding-inline: 0.5rem;
            font-size: 0.625rem;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-ltm-availability-tab] {
            transition-duration: 0.01ms;
          }
        }
      `}</style>
      <div
        role="tablist"
        aria-label={tablistLabel}
        data-ltm-availability-tablist
        className="mari-editor-tab-rail grid w-full"
      >
        {sections.map(([kind, targets], index) => {
          const copy = sectionCopy[kind];
          const active = activeSection === kind;
          const displayTargets = displayedTargetsFor(kind, targets, copy.allLabel);
          const count = displayTargets.filter((target) => selectedIds.has(`${kind}:${target.id}`)).length;
          const tabId = `${railId}-${kind}-tab`;
          return (
            <button
              key={kind}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={panelId}
              aria-label={copy.accessibleLabel(count)}
              tabIndex={active ? 0 : -1}
              data-ltm-availability-tab={kind}
              data-active={active}
              className="mari-editor-tab flex min-h-11 min-w-0 items-center justify-center rounded-md border border-[var(--marinara-editor-divider)] px-1 text-[0.6875rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-editor-focus-ring)]"
              onClick={() => setActiveSection(kind)}
              onKeyDown={(event) => handleTabKey(event, index)}
            >
              <span className="min-w-0 flex-1 truncate text-center">{copy.label}</span>
              <span data-ltm-availability-count className="mari-editor-tab-badge">
                {count}
              </span>
            </button>
          );
        })}
      </div>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${railId}-${activeKind}-tab`}
        data-ltm-availability-panel={activeKind}
        className="space-y-3 p-3"
      >
        <label className="relative block">
          <Search
            aria-hidden="true"
            size="0.875rem"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--marinara-editor-muted)]"
          />
          <input
            className={`${inputClass} pl-9`}
            value={query}
            placeholder={activeCopy.searchPlaceholder}
            aria-label={activeCopy.searchPlaceholder}
            data-ltm-availability-search={activeKind}
            onChange={(event) => setQueries((current) => ({ ...current, [activeKind]: event.target.value }))}
          />
        </label>
        <div className="max-h-52 overflow-y-auto">
          {filtered.length ? (
            filtered.map((target) => {
              const selected = selectedIds.has(`${activeKind}:${target.id}`);
              return (
                <button
                  key={target.id}
                  type="button"
                  data-ltm-availability-target={`${activeKind}:${target.id}`}
                  data-selected={selected ? "true" : "false"}
                  aria-pressed={selected}
                  className="mari-editor-action mari-editor-action--compact flex min-h-11 w-full items-center gap-2 rounded-none border-x-0 border-t-0 px-3 py-2 text-left text-sm last:border-b-0 data-[selected=true]:bg-[var(--primary)]/10"
                  onClick={() => onToggle(activeKind, target.id)}
                >
                  <Check
                    aria-hidden="true"
                    size="0.875rem"
                    className={selected ? "shrink-0 text-[var(--marinara-editor-accent)]" : "shrink-0 opacity-0"}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-normal text-[var(--marinara-editor-text)]">
                      {target.label}
                    </span>
                    {target.comment ? (
                      <span className="block truncate text-xs text-[var(--marinara-editor-muted)]">
                        {target.comment}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-3 py-2 text-xs text-[var(--marinara-editor-muted)]">{activeCopy.emptyLabel}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function TargetPicker({
  targets,
  selectedIds,
  allowedKinds,
  placeholder,
  emptyLabel,
  clearLabel,
  groupLabels,
  onSelect,
}: {
  targets: PickerTarget[];
  selectedIds: ReadonlySet<string>;
  allowedKinds: ReadonlySet<PickerTarget["kind"]>;
  placeholder: string;
  emptyLabel: string;
  clearLabel: string;
  groupLabels?: Partial<Record<PickerTarget["kind"], string>>;
  onSelect: (target: PickerTarget) => void;
}) {
  const inputId = useId();
  const listId = `${inputId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const available = useMemo(
    () =>
      targets.filter(
        (target) =>
          allowedKinds.has(target.kind) &&
          !selectedIds.has(`${target.kind}:${target.id}`) &&
          !selectedIds.has(target.id),
      ),
    [allowedKinds, selectedIds, targets],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return available.filter((target) =>
      [target.label, target.comment].filter(Boolean).join(" ").toLocaleLowerCase().includes(needle),
    );
  }, [available, query]);
  const select = (target: PickerTarget) => {
    onSelect(target);
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div className="relative space-y-1">
      <label className="relative block">
        <Search
          aria-hidden="true"
          size="0.875rem"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
        />
        <input
          ref={inputRef}
          id={inputId}
          className={`${inputClass} pl-9 pr-10`}
          value={query}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query ? (
          <IconButton icon={X} label={clearLabel} className="absolute right-1 top-1" onClick={() => setQuery("")} />
        ) : null}
      </label>
      <div
        id={listId}
        role="list"
        className="max-h-52 overflow-y-auto rounded-md border border-[var(--marinara-editor-divider)] bg-[var(--marinara-editor-control-bg)]"
      >
        {filtered.length ? (
          filtered.map((target, index) => (
            <div key={`${target.kind}:${target.id}`} role="listitem">
              {groupLabels && (index === 0 || filtered[index - 1]?.kind !== target.kind) ? (
                <p className="border-b border-[var(--marinara-editor-divider)] bg-[var(--secondary)] px-3 py-1 text-xs font-semibold text-[var(--marinara-editor-muted)]">
                  {groupLabels[target.kind]}
                </p>
              ) : null}
              <button
                id={`${listId}-${target.kind}-${target.id}`}
                type="button"
                className="mari-editor-action mari-editor-action--compact flex min-h-11 w-full items-center border-x-0 border-t-0 px-3 py-2 text-left last:border-b-0"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(target)}
              >
                <span className="block text-sm font-normal text-[var(--marinara-editor-text)]">{target.label}</span>
                {target.comment ? (
                  <span className="block text-xs text-[var(--marinara-editor-muted)]">{target.comment}</span>
                ) : null}
              </button>
            </div>
          ))
        ) : (
          <p className="px-3 py-2 text-xs text-[var(--marinara-editor-muted)]">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}
