import { useId, useState, type KeyboardEvent } from "react";
import { Check, Search } from "lucide-react";
import { labelKeys } from "./display-labels";
import { useLtmTranslation } from "./localization";
import { inputClass } from "./shared-controls";
import { nextTabIndex } from "./tab-keys";

export type AvailabilityTarget = {
  id: string;
  label: string;
  comment?: string;
  groupId?: string;
  searchText?: string;
};
export type AvailabilityChatTarget = AvailabilityTarget & {
  mode?: string;
  characterIds?: string[];
  personaId?: string | null;
  chatIds?: string[];
  members?: AvailabilityChatTarget[];
};
export type AvailabilityPlaceKind = "chat" | "character" | "persona";

/**
 * The multi-place picker for the availability editors and the Sources destination. Selection keys are
 * `${kind}:${id}`; the Chats tab adds a `chat:all` row whose meaning belongs to the caller.
 */
export function AvailabilityTabRail({
  characters,
  personas,
  chats,
  selectedIds,
  tablistLabel,
  disabled = false,
  onToggle,
}: {
  characters: readonly AvailabilityTarget[];
  personas: readonly AvailabilityTarget[];
  chats: readonly AvailabilityChatTarget[];
  selectedIds: ReadonlySet<string>;
  tablistLabel: string;
  disabled?: boolean;
  onToggle: (kind: AvailabilityPlaceKind, id: string) => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  type SectionKind = "all" | AvailabilityPlaceKind;
  type Row = AvailabilityTarget & { kind: AvailabilityPlaceKind };
  const rows = (kind: AvailabilityPlaceKind, targets: readonly AvailabilityTarget[]): Row[] =>
    targets.map((target) => ({ ...target, kind }));
  const chatRows = rows("chat", chats);
  const characterRows = rows("character", characters);
  const personaRows = rows("persona", personas);
  const sections: Array<[SectionKind, Row[]]> = [
    ["all", [...chatRows, ...characterRows, ...personaRows]],
    ["chat", [{ id: "all", label: localizeUi("ui.longTermMemory.memoryvault.allChats"), kind: "chat" }, ...chatRows]],
    ["character", characterRows],
    ["persona", personaRows],
  ];
  const copy = {
    all: {
      searchPlaceholder: localizeUi("ui.longTermMemory.sourcesworkspace.searchScopes"),
      emptyLabel: localizeUi("ui.longTermMemory.sourcesworkspace.noMatchingScopes"),
    },
    chat: {
      searchPlaceholder: localizeUi("ui.longTermMemory.memoryvault.searchChats"),
      emptyLabel: localizeUi("ui.longTermMemory.memoryvault.noMatchingChats"),
    },
    character: {
      searchPlaceholder: localizeUi("ui.longTermMemory.memoryvault.searchCharacters"),
      emptyLabel: localizeUi("ui.longTermMemory.memoryvault.noMatchingCharacters"),
    },
    persona: {
      searchPlaceholder: localizeUi("ui.longTermMemory.memoryvault.searchPersonas"),
      emptyLabel: localizeUi("ui.longTermMemory.memoryvault.noMatchingPersonas"),
    },
  } satisfies Record<SectionKind, { searchPlaceholder: string; emptyLabel: string }>;
  const kindLabels: Record<AvailabilityPlaceKind, string> = {
    chat: localizeUi("ui.longTermMemory.memoryvault.chat"),
    character: localizeUi("ui.longTermMemory.memoryvault.character"),
    persona: localizeUi("ui.longTermMemory.memoryvault.persona"),
  };
  const railId = useId();
  const [queries, setQueries] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<SectionKind>("all");
  const [activeKind, activeTargets] = sections.find(([kind]) => kind === activeSection)!;
  const activeCopy = copy[activeKind];
  const query = queries[activeKind] ?? "";
  const filtered = activeTargets.filter((target) =>
    `${target.label} ${target.comment ?? ""} ${target.searchText ?? ""}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const panelId = `${railId}-panel`;
  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const nextIndex = nextTabIndex(event.key, index, sections.length);
    if (nextIndex === null) return;
    event.preventDefault();
    const nextKind = sections[nextIndex]![0];
    setActiveSection(nextKind);
    requestAnimationFrame(() => document.getElementById(`${railId}-${nextKind}-tab`)?.focus({ preventScroll: true }));
  };

  return (
    <div
      data-ltm-availability-tabs
      className="overflow-hidden border-y border-[var(--marinara-editor-divider)]"
      style={{ containerType: "inline-size", backgroundColor: "var(--marinara-editor-control-bg)" }}
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
        @container (min-width: 22rem) {
          [data-ltm-availability-tablist] {
            grid-template-columns: repeat(4, minmax(0, 1fr));
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
          const label = localizeUi(labelKeys.scopeKind[kind]);
          const active = activeSection === kind;
          const count = targets.filter((target) => selectedIds.has(`${target.kind}:${target.id}`)).length;
          const tabId = `${railId}-${kind}-tab`;
          return (
            <button
              key={kind}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={panelId}
              aria-label={localizeUi("ui.longTermMemory.memoryvault.availabilitySectionSelected", { label, count })}
              tabIndex={active ? 0 : -1}
              data-ltm-availability-tab={kind}
              data-active={active}
              data-ltm-tab-focus
              className="mari-editor-tab flex min-h-11 min-w-0 items-center justify-center rounded-md border border-[var(--marinara-editor-divider)] px-1 text-[0.6875rem] font-semibold transition-colors"
              onClick={() => setActiveSection(kind)}
              onKeyDown={(event) => handleTabKey(event, index)}
            >
              <span className="min-w-0 flex-1 truncate text-center">{label}</span>
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
            disabled={disabled}
            onChange={(event) => setQueries((current) => ({ ...current, [activeKind]: event.target.value }))}
          />
        </label>
        <div data-ltm-availability-list className="max-h-52 overflow-y-auto">
          {filtered.length ? (
            filtered.map((target) => {
              const key = `${target.kind}:${target.id}`;
              const selected = selectedIds.has(key);
              const comment =
                activeKind === "all"
                  ? [kindLabels[target.kind], target.comment].filter(Boolean).join(" · ")
                  : target.comment;
              return (
                <button
                  key={key}
                  type="button"
                  data-ltm-availability-target={key}
                  data-selected={selected ? "true" : "false"}
                  aria-pressed={selected}
                  disabled={disabled}
                  className={`mari-editor-action mari-editor-action--compact flex min-h-11 w-full items-center gap-2 rounded-none border-t-0 px-3 py-2 text-left text-sm last:border-b-0 ${selected ? "bg-[var(--primary)]/10" : ""}`}
                  onClick={() => onToggle(target.kind, target.id)}
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
                    {comment ? (
                      <span className="block truncate text-xs text-[var(--marinara-editor-muted)]">{comment}</span>
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
