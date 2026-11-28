import type { KeyboardEvent, ReactNode } from "react";
import { RefreshCw, Search } from "lucide-react";
import type { LtmMode } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { Button, ShowMore, Spinner, inputClass } from "../shared-controls";
import type { LtmTranslationFunction } from "../localization";
import { nextTabIndex } from "../tab-keys";

export type SourceStatusFilter = "all" | "ready" | "imported";

export function handleTabKey<T extends string>(
  event: KeyboardEvent<HTMLButtonElement>,
  ids: readonly T[],
  current: T,
  onChange: (id: T) => boolean | void | Promise<boolean | void>,
  selector: string,
) {
  const index = ids.indexOf(current);
  const nextIndex = index < 0 ? null : nextTabIndex(event.key, index, ids.length);
  if (nextIndex === null) return;
  event.preventDefault();
  const next = ids[nextIndex];
  void Promise.resolve(onChange(next)).then((changed) => {
    if (changed !== false)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => document.querySelector<HTMLElement>(`[${selector}="${next}"]`)?.focus()),
      );
  });
}

const statusFilters = ["all", "ready", "imported"] as const;
const statusLabelKeys: Record<SourceStatusFilter, string> = {
  all: "ui.longTermMemory.sourcesworkspace.all",
  ready: "ui.longTermMemory.sourcesworkspace.readyToImport",
  imported: "ui.longTermMemory.sourcesworkspace.alreadyImported",
};

/**
 * The one navigator header every source list uses: title and count, then one wrapping row of search, Mode, Reload and the three status tabs.
 * Callers pass what only they have (destination panel, Import all new, Branch, outdated sources, the selection
 * bar) as slots. "Load more" is `SourceLoadMore`, under the list.
 */
export function SourceNavigatorBar({
  localizeUi,
  title,
  count,
  selectionMode,
  onToggleSelection,
  top,
  query,
  onQueryChange,
  filterStart,
  modeFilter,
  modeLocked,
  onModeChange,
  reloading,
  onReload,
  afterFilters,
  source,
  statusFilter,
  statusCounts,
  onStatusChange,
  children,
}: {
  localizeUi: LtmTranslationFunction;
  title: string;
  count: number;
  selectionMode: boolean;
  onToggleSelection: () => void;
  top?: ReactNode;
  query: string;
  onQueryChange: (value: string) => void;
  filterStart?: ReactNode;
  modeFilter: LtmMode | "all";
  modeLocked: boolean;
  onModeChange: (mode: LtmMode | "all") => void;
  reloading: boolean;
  onReload: () => void;
  afterFilters?: ReactNode;
  source: string;
  statusFilter: SourceStatusFilter;
  statusCounts: Record<SourceStatusFilter, number>;
  onStatusChange: (filter: SourceStatusFilter) => boolean | void | Promise<boolean | void>;
  children?: ReactNode;
}) {
  return (
    <header className="space-y-3 border-b border-[var(--border)] bg-[var(--secondary)]/25 p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted-foreground)]">{count}</span>
          <Button className="mari-editor-action--compact" onClick={onToggleSelection}>
            {localizeUi(
              selectionMode
                ? "ui.longTermMemory.sourcesworkspace.doneSelecting"
                : "ui.longTermMemory.sourcesworkspace.selectSources",
            )}
          </Button>
        </div>
      </div>
      {top}
      {/* One wrapping row: search, chat type, Reload, then the status control. */}
      <div className="flex flex-wrap items-center gap-2" data-ltm-source-filters>
        <label className="relative block" style={{ flex: "1 1 12rem" }}>
          <Search
            aria-hidden="true"
            size="0.875rem"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
          <input
            className={`${inputClass} pl-9`}
            value={query}
            placeholder={localizeUi("ui.longTermMemory.sourcesworkspace.searchSources")}
            aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.searchSources")}
            data-ltm-source-search
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        {filterStart}
        <label className="flex min-h-11 items-center gap-2 text-xs font-medium">
          {localizeUi("ui.longTermMemory.transferworkbench.mode")}
          <select
            className={`${inputClass} w-36${modeLocked ? " opacity-50" : ""}`}
            value={modeFilter}
            aria-disabled={modeLocked ? true : undefined}
            onChange={(event) => {
              if (!modeLocked) onModeChange(event.target.value as LtmMode | "all");
            }}
            aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.filterSourcesByMode")}
            data-ltm-source-mode
          >
            <option value="all">{localizeUi("ui.longTermMemory.sourcesworkspace.all")}</option>
            <option value="game">{localizeUi("ui.longTermMemory.sourcesworkspace.game")}</option>
            <option value="conversation">{localizeUi("ui.longTermMemory.sourcesworkspace.conversation")}</option>
            <option value="roleplay">{localizeUi("ui.longTermMemory.sourcesworkspace.roleplay")}</option>
          </select>
        </label>
        <Button disabled={reloading} onClick={onReload} data-ltm-source-action="refresh-preview">
          {reloading ? <Spinner size="0.75rem" /> : <RefreshCw aria-hidden="true" size="0.75rem" />}
          {localizeUi("ui.longTermMemory.sourcesworkspace.reloadList")}
        </Button>
        <div
          role="tablist"
          aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.sourceStatus")}
          className="flex gap-1"
          style={{ flex: "1 1 20rem" }}
        >
          {statusFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              role="tab"
              id={`ltm-source-status-${source}-${filter}`}
              tabIndex={statusFilter === filter ? 0 : -1}
              aria-selected={statusFilter === filter}
              aria-controls={`ltm-source-results-${source}`}
              data-ltm-source-status-filter={filter}
              data-active={statusFilter === filter}
              className="mari-editor-tab min-h-11 min-w-0 flex-1 rounded-md border px-2 text-xs font-semibold"
              onClick={() => void onStatusChange(filter)}
              onKeyDown={(event) =>
                handleTabKey(event, statusFilters, statusFilter, onStatusChange, "data-ltm-source-status-filter")
              }
            >
              {localizeUi(statusLabelKeys[filter])} ({statusCounts[filter]})
            </button>
          ))}
        </div>
      </div>
      {afterFilters}
      {children}
    </header>
  );
}

/** "Load more" for a source list: under the list, where the next rows will appear. */
export function SourceLoadMore({
  localizeUi,
  hasNextPage,
  fetching,
  fetchingNextPage,
  onLoadMore,
}: {
  localizeUi: LtmTranslationFunction;
  hasNextPage: boolean;
  fetching: boolean;
  fetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  if (!hasNextPage) return null;
  return (
    <div className="border-t border-[var(--border)] p-3">
      <ShowMore busy={fetchingNextPage} disabled={fetching} onClick={onLoadMore} data-ltm-source-action="load-more">
        {localizeUi(
          fetchingNextPage
            ? "ui.longTermMemory.sourcesworkspace.loadingMoreSources"
            : "ui.longTermMemory.sourcesworkspace.loadMoreSources",
        )}
      </ShowMore>
    </div>
  );
}

/** The one Cancel for a running import or refresh; `attribute` keeps each surface's existing test hook. */
export function SourceCancelButton({
  localizeUi,
  onCancel,
  attribute = "data-ltm-source-action",
}: {
  localizeUi: LtmTranslationFunction;
  onCancel: () => void;
  attribute?: "data-ltm-source-action" | "data-ltm-lorebook-action";
}) {
  const label = localizeUi("ui.longTermMemory.memoryvault.cancel");
  return attribute === "data-ltm-lorebook-action" ? (
    <Button destructive onClick={onCancel} data-ltm-lorebook-action="cancel-import">
      {label}
    </Button>
  ) : (
    <Button destructive onClick={onCancel} data-ltm-source-action="cancel-import">
      {label}
    </Button>
  );
}
