import { ChevronLeft, Search, X } from "lucide-react";
import { EmptyState, LoadMoreFeedButton, SLP_CREATOR_FEED_WINDOW_SIZE } from "./SlpHomeHelpers";
import { HIDE_ON_SCROLL_CLASS } from "../../base/chrome/SlpChrome";
import { SlurpCreatorProfileCard } from "../../modules/creator/SlpCreatorProfileCard";
import { SlurpDiscoverToolbar } from "../../features/discovery/SlpDiscoverToolbar";
import { cn } from "../../../lib/utils";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { useTranslation } from "react-i18next";
import type { useHideOnScroll } from "../../base/chrome/SlpChrome";
import type { SlurpDiscoverLayout } from "../../features/discovery/slp-discovery";
import type { ViewerHub } from "./SlpScreenHub";
import type { deriveSlurpHubView } from "./slp-hub-view";
import type { useSlurpHubDiscoveryFilters } from "./slp-hub-discovery-filters";

type HubProps = Parameters<typeof ViewerHub>[0];
type HubResults = ReturnType<typeof deriveSlurpHubView>["searchResults"];

/** Discover: the creator directory with its filter bar, and search results when a query is set. */
export function SlpHubDiscover({
  discover,
  discoverLayout,
  setDiscoverLayout,
  discoveryInputRef,
  localizeUi,
  onCloseDiscovery,
  onSearchChange,
  onToggleSubscription,
  postCardCtx,
  renderFeedPost,
  search,
  searchResults,
  searchTerm,
  setScroller,
  setStickyHeader,
  setVisibleFeedCount,
  togglePending,
  visibleSearchResults,
}: {
  discover: ReturnType<typeof useSlurpHubDiscoveryFilters>;
  discoverLayout: SlurpDiscoverLayout;
  setDiscoverLayout: Dispatch<SetStateAction<SlurpDiscoverLayout>>;
  discoveryInputRef: HubProps["discoveryInputRef"];
  localizeUi: ReturnType<typeof useTranslation>["t"];
  onCloseDiscovery: HubProps["onCloseDiscovery"];
  onSearchChange: HubProps["onSearchChange"];
  onToggleSubscription: HubProps["onToggleSubscription"];
  postCardCtx: HubProps["postCardCtx"];
  renderFeedPost: (item: HubResults[number]) => ReactNode;
  search: string;
  searchResults: HubResults;
  searchTerm: string;
  setScroller: (element: HTMLDivElement | null) => void;
  setStickyHeader: ReturnType<typeof useHideOnScroll>;
  setVisibleFeedCount: Dispatch<SetStateAction<number>>;
  togglePending: boolean;
  visibleSearchResults: HubResults;
}) {
  return (
    <div ref={setScroller} className="min-h-0 flex-1 overflow-y-auto" data-component="SlurpHome.Discover">
      <div
        ref={setStickyHeader}
        className={cn(
          "sticky top-0 z-20 flex items-center gap-2 border-b border-[var(--noodle-divider)] bg-[linear-gradient(110deg,color-mix(in_srgb,var(--slurp-surface)_94%,transparent),color-mix(in_srgb,var(--noodle-accent)_7%,var(--slurp-surface)))] px-2 py-3 shadow-[var(--slurp-shadow-floating)] backdrop-blur-xl",
          HIDE_ON_SCROLL_CLASS,
        )}
      >
        <button
          type="button"
          onClick={onCloseDiscovery}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
          aria-label={localizeUi("ui.noodle.noodlerframe.back")}
        >
          <ChevronLeft size={22} />
        </button>
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-[var(--accent)] px-4 text-base ring-1 ring-inset ring-[var(--noodle-divider)] transition-colors focus-within:ring-[var(--noodle-accent)] sm:text-sm">
          <Search size={18} className="shrink-0 text-[var(--noodle-accent)]" />
          <span className="sr-only">{localizeUi("ui.noodle.noodlerhome.searchPostsOrCreators")}</span>
          <input
            ref={discoveryInputRef}
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={localizeUi("ui.noodle.noodlerhome.searchPostsOrCreators")}
            className="min-w-0 flex-1 border-0 bg-transparent text-base text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] sm:text-sm"
          />
          {search.trim() && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10"
              aria-label={localizeUi("ui.noodle.noodlehome.clearSearch")}
            >
              <X size={14} />
            </button>
          )}
        </label>
      </div>

      {!searchTerm && (
        <header className="relative isolate overflow-hidden px-4 pb-5 pt-7 sm:px-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--noodle-accent)]">Slurp</p>
          <h1 className="mt-1 text-2xl font-bold text-balance">{localizeUi("ui.slurp.discover.title")}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.discover.detail")}
          </p>
        </header>
      )}

      <SlurpDiscoverToolbar
        notSubscribed={discover.notSubscribed}
        onNotSubscribedChange={discover.setNotSubscribed}
        genders={discover.genders}
        onGenderToggle={(gender) => discover.toggle(discover.setGenders, gender)}
        minimumPrice={discover.minimumPrice}
        maximumPrice={discover.maximumPrice}
        onMinimumPriceChange={discover.setMinimumPrice}
        onMaximumPriceChange={discover.setMaximumPrice}
        tags={discover.tags}
        customTags={discover.customTags}
        onTagToggle={(tag) => discover.toggle(discover.setTags, tag)}
        sort={discover.sort}
        onSortChange={discover.setSort}
        layout={discoverLayout}
        onLayoutChange={setDiscoverLayout}
        filteredCount={discover.filtered.length}
        filtersActive={discover.active}
        onClear={discover.clear}
      />

      {searchTerm && (
        <section className="px-3 pb-4 sm:px-4" aria-labelledby="noodler-search-results">
          <div className="border-b border-[var(--noodle-divider)] px-4 py-3">
            <h2 id="noodler-search-results" className="text-lg font-bold">
              {localizeUi("ui.noodle.noodlehome.searchResults")}
            </h2>
          </div>
          {searchResults.length > 0 ? (
            <div className="space-y-3 pt-3">
              {visibleSearchResults.map(renderFeedPost)}
              {visibleSearchResults.length < searchResults.length && (
                <LoadMoreFeedButton
                  visible={visibleSearchResults.length}
                  total={searchResults.length}
                  onLoadMore={() =>
                    setVisibleFeedCount((count) => Math.min(searchResults.length, count + SLP_CREATOR_FEED_WINDOW_SIZE))
                  }
                />
              )}
            </div>
          ) : (
            <EmptyState
              title={localizeUi("ui.noodle.viewerhub.noSearchResults")}
              detail={localizeUi("ui.slurp.empty.searchDetail")}
              action={localizeUi("ui.slurp.empty.clearSearch")}
              onAction={() => onSearchChange("")}
              icon={Search}
            />
          )}
        </section>
      )}

      <section className="px-3 pb-6 sm:px-4" aria-labelledby="noodler-discover-creators">
        <div className="px-1 py-3">
          <h2 id="noodler-discover-creators" className="text-lg font-bold">
            {localizeUi("ui.noodle.subscriptionsections.discoverCreators")}
          </h2>
        </div>
        {discover.filtered.length > 0 ? (
          <div className={cn(discoverLayout === "grid" ? "grid gap-3 sm:grid-cols-2" : "space-y-3")}>
            {discover.filtered.map((creator) => (
              <SlurpCreatorProfileCard
                key={creator.profile.id}
                creator={creator}
                onOpenProfile={postCardCtx.openAuthorProfile}
                layout={discoverLayout}
                showDiscoveryActions
                subscriptionPending={togglePending}
                onToggleSubscription={onToggleSubscription}
              />
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-bold">
              {discover.active
                ? localizeUi("ui.slurp.discover.noMatches", { defaultValue: "No Creators match these filters" })
                : localizeUi("ui.noodle.subscriptionsections.noCreatorsAreVisibleToThisPersonaYet")}
            </p>
            {discover.active && (
              <button
                type="button"
                onClick={discover.clear}
                className="mt-3 min-h-10 rounded-full px-4 text-sm font-bold text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
              >
                {localizeUi("ui.slurp.discover.clearFilters", { defaultValue: "Clear filters" })}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
