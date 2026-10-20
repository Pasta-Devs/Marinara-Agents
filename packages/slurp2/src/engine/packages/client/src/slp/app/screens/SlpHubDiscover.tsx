import { SlpEmptyState, SlpErrorState, SlpSkeleton } from "../../modules/chrome/SlpStateKit";
import { SlpBalanceChip } from "../../modules/chrome/SlpShell";
import { ChevronLeft, Search, X } from "lucide-react";
import { useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useReducedMotion } from "framer-motion";
import { LoadMoreFeedButton, SLP_CREATOR_FEED_WINDOW_SIZE } from "./SlpHomeHelpers";
import {
  HIDE_ON_SCROLL_CLASS,
  SLP_BAR_GLASS_CLASS,
  SLP_PAGE_SCROLL_CLASS,
  SLP_SEARCH_FIELD_CLASS,
  SLP_TYPE,
} from "../../base/chrome/SlpChrome";
import { SlpCreatorAvatar, SlurpCreatorProfileCard } from "../../modules/creator/SlpCreatorProfileCard";
import { SlpTrendingRow } from "../../features/discovery/SlpTrendingRow";
import { SlurpDiscoverToolbar } from "../../features/discovery/SlpDiscoverToolbar";
import { cn } from "../../../lib/utils";
import { SLP_CARD_STACK_CLASS } from "../../modules/post/SlpPostHelpers";
import type { useTranslation } from "react-i18next";
import type { SlurpWallet } from "../../features/economy/slp-economy-contract";
import type { useHideOnScroll } from "../../base/chrome/SlpChrome";
import type { ViewerHub } from "./SlpScreenHub";
import type { deriveSlurpHubView } from "./slp-hub-view";
import type { useSlurpHubDiscoveryFilters } from "./slp-hub-discovery-filters";

type HubProps = Parameters<typeof ViewerHub>[0];
type HubResults = ReturnType<typeof deriveSlurpHubView>["searchResults"];
type Discover = ReturnType<typeof useSlurpHubDiscoveryFilters>;
type Localize = ReturnType<typeof useTranslation>["t"];

/** The ad sits after this many Creator cards in the grid (two rows on a phone). */
const DISCOVER_AD_AFTER = 4;

function SectionHeading({ id, title, count }: { id: string; title: string; count?: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-1 pb-2.5">
      <h2 id={id} className={SLP_TYPE.title}>
        {title}
      </h2>
      {count !== undefined && (
        <span className={cn(SLP_TYPE.meta, "tabular-nums text-[var(--slurp-muted)]")}>{count}</span>
      )}
    </div>
  );
}

/** Swipeable banner cards with snap and dots. The dots also move it (keyboard, mouse). */
function FeaturedCarousel({
  creators,
  localizeUi,
  renderCard,
}: {
  creators: Discover["featured"];
  localizeUi: Localize;
  renderCard: (creator: Discover["featured"][number]) => ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const reduceMotion = useReducedMotion();
  const slideAt = (index: number) => trackRef.current?.children[index] as HTMLElement | undefined;
  const syncActive = () => {
    const track = trackRef.current;
    const first = slideAt(0);
    const second = slideAt(1);
    if (!track || !first) return;
    const step = second ? second.offsetLeft - first.offsetLeft : first.offsetWidth;
    // At the far end the last slide may not reach the start edge, so the end counts as the last one.
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    setActive(atEnd ? creators.length - 1 : Math.round(track.scrollLeft / Math.max(1, step)));
  };
  const goTo = (index: number) => {
    const track = trackRef.current;
    const slide = slideAt(index);
    const first = slideAt(0);
    if (!track || !slide || !first) return;
    track.scrollTo({ left: slide.offsetLeft - first.offsetLeft, behavior: reduceMotion ? "auto" : "smooth" });
  };
  const title = localizeUi("ui.slurp.discover.featured", { defaultValue: "Featured" });
  return (
    <section aria-roledescription="carousel" aria-labelledby="slurp-discover-featured" className="pb-2 pt-3">
      <SectionHeading id="slurp-discover-featured" title={title} />
      <div
        ref={trackRef}
        onScroll={syncActive}
        className="-mx-3 flex snap-x snap-mandatory scroll-px-3 gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {creators.map((creator, index) => (
          <div
            key={creator.profile.id}
            role="group"
            aria-roledescription="slide"
            aria-label={localizeUi("ui.slurp.discover.slideOf", {
              index: index + 1,
              total: creators.length,
              defaultValue: `${index + 1} of ${creators.length}`,
            })}
            className="w-[86%] shrink-0 snap-start @min-[36rem]:w-[68%]"
          >
            {renderCard(creator)}
          </div>
        ))}
      </div>
      {creators.length > 1 && (
        <div className="mt-1 flex justify-center">
          {creators.map((creator, index) => (
            <button
              key={creator.profile.id}
              type="button"
              onClick={() => goTo(index)}
              aria-current={index === active ? "true" : undefined}
              aria-label={creator.profile.displayName}
              className="grid h-7 min-w-5 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "block h-1.5 rounded-full transition-[width,background-color] duration-[var(--slurp-motion-base)] motion-reduce:transition-none",
                  index === active
                    ? "w-4 bg-[var(--noodle-accent)] shadow-[0_0_8px_color-mix(in_srgb,var(--noodle-accent)_60%,transparent)]"
                    : "w-1.5 bg-[var(--slurp-muted)]/40",
                )}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Discover: the Featured carousel and the Creator grid under one chip row of filters (the rest in a
 * sheet); with a query, matching Creators first and then matching posts.
 */
export function SlpHubDiscover({
  discover,
  discoveryInputRef,
  localizeUi,
  onCloseDiscovery,
  onSearchChange,
  onToggleSubscription,
  postCardCtx,
  renderFeedPost,
  discoverAd,
  search,
  searchResults,
  searchTerm,
  setScroller,
  setStickyHeader,
  setVisibleFeedCount,
  togglePending,
  visibleSearchResults,
  isLoading,
  isError,
  onRetry,
  walletSubscriptions,
}: {
  discover: Discover;
  discoveryInputRef: HubProps["discoveryInputRef"];
  localizeUi: Localize;
  onCloseDiscovery: HubProps["onCloseDiscovery"];
  onSearchChange: HubProps["onSearchChange"];
  onToggleSubscription: HubProps["onToggleSubscription"];
  postCardCtx: HubProps["postCardCtx"];
  renderFeedPost: (item: HubResults[number]) => ReactNode;
  /** The native ad for the grid, or null when ads are off or none came back. */
  discoverAd: ReactNode;
  search: string;
  searchResults: HubResults;
  searchTerm: string;
  setScroller: (element: HTMLDivElement | null) => void;
  setStickyHeader: ReturnType<typeof useHideOnScroll>;
  setVisibleFeedCount: Dispatch<SetStateAction<number>>;
  togglePending: boolean;
  visibleSearchResults: HubResults;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  walletSubscriptions?: SlurpWallet["subscriptions"];
}) {
  const openProfile = postCardCtx.openAuthorProfile ?? (() => undefined);
  const searchLabel = localizeUi("ui.noodle.noodlerhome.searchPostsOrCreators");
  const creatorCard = (creator: Discover["filtered"][number], layout: "grid" | "featured" = "grid") => (
    <SlurpCreatorProfileCard
      key={creator.profile.id}
      creator={{
        ...creator,
        subscription: walletSubscriptions?.[creator.profile.id]
          ? {
              until: walletSubscriptions[creator.profile.id].paidThroughAt,
              cancelled: Boolean(walletSubscriptions[creator.profile.id].cancelled),
            }
          : null,
      }}
      layout={layout}
      onOpenProfile={postCardCtx.openAuthorProfile}
      showDiscoveryActions
      subscriptionPending={togglePending}
      onToggleSubscription={onToggleSubscription}
    />
  );

  let body: ReactNode;
  if (isLoading) {
    body = (
      <SlpSkeleton
        shape="creators"
        label={localizeUi("ui.slurp.discover.loading", { defaultValue: "Finding creators…" })}
      />
    );
  } else if (isError) {
    body = (
      <SlpErrorState
        title={localizeUi("ui.slurp.discover.loadFailed", { defaultValue: "Couldn't load creators" })}
        onRetry={onRetry}
      />
    );
  } else if (searchTerm) {
    const creators = discover.searchCreators;
    body =
      creators.length === 0 && searchResults.length === 0 ? (
        <SlpEmptyState
          title={localizeUi("ui.slurp.discover.noResults", {
            query: search.trim(),
            defaultValue: `Nothing matches "${search.trim()}"`,
          })}
          detail={localizeUi("ui.slurp.empty.searchDetail")}
          action={localizeUi("ui.slurp.empty.clearSearch")}
          onAction={() => onSearchChange("")}
          icon={Search}
        />
      ) : (
        <div className="space-y-5 px-3 pb-6 pt-4 sm:px-4">
          {creators.length > 0 && (
            <section aria-labelledby="slurp-search-creators">
              <SectionHeading
                id="slurp-search-creators"
                title={localizeUi("ui.noodle.subscriptionsections.creators")}
                count={creators.length}
              />
              <ul className="-mx-3 flex gap-1 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-4 sm:px-3">
                {creators.map((creator) => (
                  <li key={creator.profile.id} className="w-[5.25rem] shrink-0">
                    <button
                      type="button"
                      onClick={() => openProfile(creator.profile.id)}
                      className="flex w-full flex-col items-center gap-1.5 rounded-2xl px-1 py-2 text-center transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                    >
                      <SlpCreatorAvatar
                        profile={creator.profile}
                        className="h-16 w-16"
                        gapClassName="bg-[var(--slurp-canvas)]"
                      />
                      <span className="line-clamp-2 w-full break-words text-xs font-semibold leading-4">
                        {creator.profile.displayName}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {searchResults.length === 0 && (
            <p className={cn(SLP_TYPE.meta, "px-1 text-[var(--slurp-muted)]")}>
              {localizeUi("ui.slurp.discover.noPosts", {
                query: search.trim(),
                defaultValue: `No posts mention "${search.trim()}"`,
              })}
            </p>
          )}
          {searchResults.length > 0 && (
            <section aria-labelledby="slurp-search-posts">
              <SectionHeading
                id="slurp-search-posts"
                title={localizeUi("ui.slurp.discover.posts", { defaultValue: "Posts" })}
                count={searchResults.length}
              />
              <div className={SLP_CARD_STACK_CLASS}>
                {visibleSearchResults.map(renderFeedPost)}
                {visibleSearchResults.length < searchResults.length && (
                  <LoadMoreFeedButton
                    visible={visibleSearchResults.length}
                    total={searchResults.length}
                    onLoadMore={() =>
                      setVisibleFeedCount((count) =>
                        Math.min(searchResults.length, count + SLP_CREATOR_FEED_WINDOW_SIZE),
                      )
                    }
                  />
                )}
              </div>
            </section>
          )}
        </div>
      );
  } else {
    const cards = discover.filtered.map((creator) => creatorCard(creator));
    if (discoverAd && cards.length >= DISCOVER_AD_AFTER)
      cards.splice(
        DISCOVER_AD_AFTER,
        0,
        <div key="slurp-discover-ad" className="col-span-full">
          {discoverAd}
        </div>,
      );
    body = (
      <div className="@container px-3 pb-6 sm:px-4">
        {!discover.active && <SlpTrendingRow onPick={onSearchChange} />}
        {!discover.active && discover.featured.length > 1 && (
          <FeaturedCarousel
            creators={discover.featured}
            localizeUi={localizeUi}
            renderCard={(creator) => creatorCard(creator, "featured")}
          />
        )}
        <section aria-labelledby="noodler-discover-creators" className="pt-3">
          <SectionHeading
            id="noodler-discover-creators"
            title={
              discover.active
                ? localizeUi("ui.slurp.discover.resultCount", {
                    count: discover.filtered.length,
                    defaultValue: `${discover.filtered.length} creators`,
                  })
                : localizeUi("ui.slurp.discover.allCreators", { defaultValue: "All creators" })
            }
          />
          {discover.filtered.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5 @min-[40rem]:grid-cols-3 @min-[40rem]:gap-3">{cards}</div>
          ) : discover.active ? (
            <SlpEmptyState
              title={localizeUi("ui.slurp.discover.noMatches", { defaultValue: "No Creators match these filters" })}
              action={localizeUi("ui.slurp.discover.clearFilters", { defaultValue: "Clear filters" })}
              onAction={discover.clear}
            />
          ) : (
            <SlpEmptyState title={localizeUi("ui.noodle.subscriptionsections.noCreatorsAreVisibleToThisPersonaYet")} />
          )}
        </section>
      </div>
    );
  }

  return (
    <div
      ref={setScroller}
      className={cn("min-h-0 flex-1 overflow-y-auto", SLP_PAGE_SCROLL_CLASS)}
      data-component="SlurpHome.Discover"
    >
      <div
        ref={setStickyHeader}
        className={cn(
          "sticky top-0 z-20 space-y-2 px-3 pb-2.5 pt-2.5 sm:px-4",
          SLP_BAR_GLASS_CLASS,
          HIDE_ON_SCROLL_CLASS,
        )}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCloseDiscovery}
            className="-ms-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--slurp-ink)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            aria-label={localizeUi("ui.noodle.noodlerframe.back")}
          >
            <ChevronLeft size={22} />
          </button>
          <label className="relative min-w-0 flex-1">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-[var(--slurp-muted)]"
            />
            <span className="sr-only">{searchLabel}</span>
            <input
              ref={discoveryInputRef}
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchLabel}
              // B11: one clear button. The browser's own search cancel glyph is hidden; ours is 44 px.
              className={cn(SLP_SEARCH_FIELD_CLASS, search && "pe-11", "[&::-webkit-search-cancel-button]:hidden")}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange("");
                  discoveryInputRef.current?.focus();
                }}
                className="absolute end-0 top-0 flex h-11 w-11 items-center justify-center rounded-full text-[var(--slurp-muted)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                aria-label={localizeUi("ui.noodle.noodlehome.clearSearch")}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </label>
          <SlpBalanceChip />
        </div>
        {!searchTerm && !isLoading && !isError && (
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
            rowTags={discover.rowTags}
            customTags={discover.customTags}
            onTagToggle={(tag) => discover.toggle(discover.setTags, tag)}
            onTagsClear={() => discover.setTags(new Set())}
            sort={discover.sort}
            onSortChange={discover.setSort}
            sheetFilterCount={discover.sheetFilterCount}
            filteredCount={discover.filtered.length}
            onClear={discover.clear}
          />
        )}
      </div>
      {body}
    </div>
  );
}
