import { SlurpMomentsShelf, SlurpMomentViewer } from "./SlpScreenMoments";
import { SubscriptionSections } from "./SlpScreenSubscriptions";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Heart,
  LayoutGrid,
  Link,
  List,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import type { NoodlerPostView, Persona } from "@marinara-engine/shared";
import type { SlurpManagedStageProfile } from "../../base/state/slp-state-types";
import {
  useHideSlurpAd,
  useHideSlurpAdBrand,
  useRecordSlurpAdAction,
  useSlurpInlineAds,
} from "../../features/ads/slp-ads-hooks";
import { useNoodlerViewer } from "../../features/feed/slp-feed-viewer-hooks";
import {
  useRecordSlurpStoryView,
  useSlurpStoryViews,
} from "../../features/messages/slp-messages-hooks";
import { useSlurpSettings } from "../../features/settings/slp-settings-hooks";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import {
  NoodlePostCardCtx,
  type NoodlePostCardModel,
} from "../../modules/post/SlpPostCard";
import { SlurpCreatorProfileCard } from "../../modules/creator/SlpCreatorProfileCard";
import { SlurpCoinAmount } from "../../modules/coin/SlpCoin";
import { SlpStoryTile } from "../../modules/story/SlpStoryTile";
import { LockedSlurpPostCard } from "../../modules/post/SlpLockedPostCard";
import { SlurpCreatorPostCard } from "../../modules/post/SlpCreatorPostCard";
import { SlurpMediaWall } from "./SlpScreenProfile";
import { useSlurpMediaSrc } from "../../base/media/slp-media-src";
import {
  getNoodleAccentStyle,
  SLURP_TOGGLE_ACTIVE_CLASS,
  NewSinceLastVisitDivider,
  HIDE_ON_SCROLL_CLASS,
  NoodleLogo,
  ProfileInitial,
  useHideOnScroll,
  NOODLE_PINK,
} from "../../base/chrome/SlpChrome";
import { SlurpSparkleVeil } from "../../base/chrome/SlpSparkleVeil";
import { SlurpInlineAd } from "../../features/ads/SlpInlineAd";
import { SlurpDiscoverToolbar } from "../../features/discovery/SlpDiscoverToolbar";
import {
  filterAndSortSlurpCreators,
  SLURP_DISCOVERY_TAGS,
  type SlurpDiscoverLayout,
  type SlurpDiscoverSort,
} from "../../features/discovery/slp-discovery";
import type { SlurpDiscoveryGender } from "../../base/state/slp-state-types";
import { Modal } from "../../../components/ui/Modal";
import {
  EmptyState,
  SlurpFeedSkeleton,
  SlurpAccessTransition,
  isSlurpStory,
  toNoodlePostCardModel,
  parsePrice,
  linkedPostIdForStory,
  errorMessage,
  type SlurpViewerCreator,
  SlurpMediaDialog,
  SlurpPostDialog,
  LoadMoreFeedButton,
} from "./SlpHomeHelpers";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

type SlurpMoment = {
  creator: SlurpViewerCreator;
  post: NoodlerPostView;
};


// ---------------------------------------------------------------------------
// ViewerHub
// ---------------------------------------------------------------------------

export function ViewerHub({
  personas,
  personasLoading,
  personasError,
  onRetryPersonas,
  scope,
  isLoading,
  isError,
  onRetry,
  onRefresh,
  isRefreshing,
  unlockPending,
  postCardCtx,
  onUnlock,
  search,
  onSearchChange,
  discoveryOpen,
  onCloseDiscovery,
  discoveryInputRef,
  tab,
  onTabChange,
  authorProfile,
  onAddStory,
  onOpenAuthorProfile,
  onToggleSubscription,
  togglePending,
  connectionCounts,
  inlineAdsEnabled,
  inlineAdsFrequency,
  storyLifetimeHours,
  newSinceAt,
  onFeedShown,
  onOpenWallet,
  walletCoins,
}: {
  personas: Persona[];
  personasLoading: boolean;
  personasError: boolean;
  onRetryPersonas: () => void;
  scope: ReturnType<typeof useNoodlerViewer>["data"];
  newSinceAt: string | null;
  onFeedShown: () => void;
  onOpenWallet: () => void;
  walletCoins: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  unlockPending: boolean;
  postCardCtx: NoodlePostCardCtx;
  onUnlock: (postId: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  discoveryOpen: boolean;
  onCloseDiscovery: () => void;
  discoveryInputRef: React.RefObject<HTMLInputElement | null>;
  tab: "following" | "all";
  onTabChange: (tab: "following" | "all") => void;
  authorProfile: SlurpManagedStageProfile | null;
  onAddStory: () => void;
  onOpenAuthorProfile?: () => void;
  onToggleSubscription: (creatorAccountId: string, subscribed: boolean) => void;
  togglePending: boolean;
  connectionCounts: Record<string, { fans: number; followers: number }>;
  inlineAdsEnabled: boolean;
  inlineAdsFrequency: "light" | "standard" | "frequent";
  storyLifetimeHours: number;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const setStickyHeader = useHideOnScroll(scroller);
  const [discoverCollapsed, setDiscoverCollapsed] = useState(false);
  const [visibleFeedCount, setVisibleFeedCount] = useState(20);
  const [activeMomentId, setActiveMomentId] = useState<string | null>(null);
  const [feedLayout, setFeedLayout] = useState<"list" | "wall">("list");
  const [discoverLayout, setDiscoverLayout] = useState<SlurpDiscoverLayout>(() => {
    if (typeof window === "undefined") return "grid";
    return window.localStorage.getItem("slurp2.discover.layout") === "list" ? "list" : "grid";
  });
  const [discoverNotSubscribed, setDiscoverNotSubscribed] = useState(false);
  const [discoverGenders, setDiscoverGenders] = useState<Set<SlurpDiscoveryGender>>(() => new Set());
  const [discoverTags, setDiscoverTags] = useState<Set<string>>(() => new Set());
  const [discoverMinimumPrice, setDiscoverMinimumPrice] = useState("");
  const [discoverMaximumPrice, setDiscoverMaximumPrice] = useState("");
  const [discoverSort, setDiscoverSort] = useState<SlurpDiscoverSort>("recommended");
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [momentNow] = useState(() => Date.now());
  const momentCutoff = momentNow - storyLifetimeHours * 60 * 60 * 1000;
  useEffect(() => {
    window.localStorage.setItem("slurp2.discover.layout", discoverLayout);
  }, [discoverLayout]);
  const inlineAdsQuery = useSlurpInlineAds(scope?.viewer.entityId ?? null, null, [
    tab === "all" ? "discover" : "following",
    new Date().getHours() >= 18 ? "night" : "day",
  ]);
  const hideSlurpAd = useHideSlurpAd();
  const hideSlurpAdBrand = useHideSlurpAdBrand();
  const recordSlurpAdAction = useRecordSlurpAdAction();
  const inlineAdEvery = inlineAdsFrequency === "light" ? 8 : inlineAdsFrequency === "frequent" ? 2 : 4;
  const inlineAdForIndex = (index: number) => {
    if (index % inlineAdEvery !== inlineAdEvery - 1) return null;
    const items = inlineAdsQuery.data?.items ?? [];
    if (items.length === 0) return null;
    return items[Math.floor(index / inlineAdEvery) % items.length];
  };
  const emptyWallAd = inlineAdsQuery.data?.items?.[0] ?? null;
  const profileKey = (scope?.creators ?? []).map((creator) => creator.profile.id).join("\u0000");
  useEffect(() => {
    setVisibleFeedCount(20);
  }, [authorProfile?.id, profileKey, scope?.viewer.id, search, tab]);
  const feedIsOnScreen = Boolean(scope) && !isLoading && !isError && !discoveryOpen && !search.trim();
  useEffect(() => {
    if (feedIsOnScreen) onFeedShown();
  }, [feedIsOnScreen, onFeedShown]);
  const searchTerm = search.trim().toLowerCase();
  const { moments, feed, searchResults, discoveredCreators, suggestedCreators } = useMemo(() => {
    const searchable = (value: unknown) => (typeof value === "string" ? value.toLowerCase() : "");
    const creators = scope?.creators ?? [];
    const nextMoments = creators
      .filter((creator) => tab === "all" || creator.followed)
      .map((creator) => ({
        creator,
        posts: creator.posts
          .filter((post) => isSlurpStory(post) && new Date(post.createdAt).getTime() >= momentCutoff)
          .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()),
      }))
      .filter(({ posts }) => posts.length > 0)
      .sort(
        (left, right) =>
          new Date(right.posts[right.posts.length - 1]!.createdAt).getTime() -
          new Date(left.posts[left.posts.length - 1]!.createdAt).getTime(),
      )
      .flatMap(({ creator, posts }) => posts.map((post) => ({ creator, post })));
    const allPosts = creators.flatMap((creator) =>
      creator.posts.filter((post) => !isSlurpStory(post)).map((post) => ({ post, creator })),
    );
    const matchesSearch = ({ post, creator }: (typeof allPosts)[number]) =>
      !searchTerm ||
      (post.title ?? "").toLowerCase().includes(searchTerm) ||
      (post.content ?? "").toLowerCase().includes(searchTerm) ||
      searchable(creator.profile.handle).includes(searchTerm) ||
      searchable(creator.profile.displayName).includes(searchTerm);
    const newestFirst = (left: (typeof allPosts)[number], right: (typeof allPosts)[number]) =>
      new Date(right.post.createdAt).getTime() - new Date(left.post.createdAt).getTime();
    return {
      moments: nextMoments,
      feed: allPosts
        .filter(({ creator }) => tab === "all" || creator.followed)
        .filter(matchesSearch)
        .sort(newestFirst),
      searchResults: searchTerm ? allPosts.filter(matchesSearch).sort(newestFirst) : [],
      discoveredCreators: creators.filter((creator) => creator.profile.id !== authorProfile?.id),
      suggestedCreators: creators
        .filter((creator) => creator.profile.id !== authorProfile?.id && !creator.followed)
        .slice(0, 3),
    };
  }, [authorProfile?.id, momentCutoff, scope, searchTerm, tab]);
  const filteredDiscoveredCreators = useMemo(
    () =>
      filterAndSortSlurpCreators(
        discoveredCreators,
        {
          search,
          notSubscribed: discoverNotSubscribed,
          genders: discoverGenders,
          tags: discoverTags,
          minimumPrice: parsePrice(discoverMinimumPrice),
          maximumPrice: parsePrice(discoverMaximumPrice),
          sort: discoverSort,
        },
        connectionCounts,
      ),
    [
      connectionCounts,
      discoverGenders,
      discoverMaximumPrice,
      discoverMinimumPrice,
      discoverNotSubscribed,
      discoverSort,
      discoverTags,
      discoveredCreators,
      search,
    ],
  );
  const discoverFiltersActive = Boolean(
    searchTerm ||
    discoverNotSubscribed ||
    discoverGenders.size ||
    discoverTags.size ||
    discoverMinimumPrice ||
    discoverMaximumPrice,
  );
  const discoveryTagSettings = useSlurpSettings().data?.discoveryTags;
  const customDiscoverTags = useMemo(() => {
    const curated = new Set<string>(discoveryTagSettings?.map((entry) => entry.tag) ?? SLURP_DISCOVERY_TAGS);
    return [...new Set(discoveredCreators.flatMap((creator) => creator.profile.tags ?? []))]
      .filter((tag) => !curated.has(tag))
      .sort((left, right) => left.localeCompare(right));
  }, [discoveredCreators, discoveryTagSettings]);
  const toggleDiscoverSetValue = <T,>(setter: Dispatch<SetStateAction<Set<T>>>, value: T) =>
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  const clearDiscoverFilters = () => {
    onSearchChange("");
    setDiscoverNotSubscribed(false);
    setDiscoverGenders(new Set());
    setDiscoverTags(new Set());
    setDiscoverMinimumPrice("");
    setDiscoverMaximumPrice("");
  };
  if (personas.length === 0) {
    if (personasError) {
      return (
        <EmptyState
          title={localizeUi("ui.noodle.viewerhub.couldNotLoadPersonas")}
          detail={localizeUi("ui.noodle.viewerhub.personaAccessDetail")}
          action={localizeUi("capabilities.actions.tryAgain")}
          onAction={onRetryPersonas}
        />
      );
    }
    if (personasLoading) {
      return <EmptyState title={localizeUi("ui.noodle.viewerhub.loadingPersonas")} detail="" />;
    }
    return (
      <EmptyState
        title={localizeUi("ui.noodle.viewerhub.createAPersonaToBrowseNoodler")}
        detail={localizeUi("ui.noodle.viewerhub.personaAccessDetail")}
      />
    );
  }
  const activeMomentIndex = activeMomentId ? moments.findIndex((moment) => moment.post.id === activeMomentId) : -1;
  const activeMoment = activeMomentIndex >= 0 ? moments[activeMomentIndex] : null;
  const visibleFeed = feed.slice(0, visibleFeedCount);
  const openPostItem = openPostId ? (feed.find((item) => item.post.id === openPostId) ?? null) : null;
  const feedCardCtx = { ...postCardCtx, postManagement: true, openPost: setOpenPostId };
  const visibleSearchResults = searchResults.slice(0, visibleFeedCount);
  const newSince = newSinceAt ? new Date(newSinceAt).getTime() : NaN;
  const isNewToViewer = ({ post, creator }: (typeof feed)[number]) =>
    !Number.isNaN(newSince) &&
    creator.profile.sourceAccountId !== scope?.viewer.id &&
    new Date(post.createdAt).getTime() > newSince;
  let lastNewIndex = -1;
  if (!searchTerm) {
    for (let index = feed.length - 1; index >= 0; index -= 1) {
      if (isNewToViewer(feed[index]!)) {
        lastNewIndex = index;
        break;
      }
    }
  }
  const dividerIndex = lastNewIndex >= 0 && lastNewIndex < feed.length - 1 ? lastNewIndex + 1 : -1;
  const renderFeedPost = ({ post, creator }: (typeof searchResults)[number]) => (
    <SlurpAccessTransition key={post.id} postId={post.id} locked={post.locked}>
      {post.locked ? (
        <LockedSlurpPostCard
          post={post}
          profile={creator.profile}
          subscriptionPrice={creator.subscriptionPrice}
          subscribed={creator.subscribed}
          unlockPending={unlockPending}
          subscriptionPending={togglePending}
          onUnlock={onUnlock}
          onToggleSubscription={onToggleSubscription}
          onOpenProfile={postCardCtx.openAuthorProfile}
        />
      ) : (
        <SlurpCreatorPostCard
          post={toNoodlePostCardModel(post, creator.profile)}
          ctx={{
            ...feedCardCtx,
            personaAccount: postCardCtx.personaAccount,
          }}
        />
      )}
    </SlurpAccessTransition>
  );
  if (discoveryOpen) {
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
          notSubscribed={discoverNotSubscribed}
          onNotSubscribedChange={setDiscoverNotSubscribed}
          genders={discoverGenders}
          onGenderToggle={(gender) => toggleDiscoverSetValue(setDiscoverGenders, gender)}
          minimumPrice={discoverMinimumPrice}
          maximumPrice={discoverMaximumPrice}
          onMinimumPriceChange={setDiscoverMinimumPrice}
          onMaximumPriceChange={setDiscoverMaximumPrice}
          tags={discoverTags}
          customTags={customDiscoverTags}
          onTagToggle={(tag) => toggleDiscoverSetValue(setDiscoverTags, tag)}
          sort={discoverSort}
          onSortChange={setDiscoverSort}
          layout={discoverLayout}
          onLayoutChange={setDiscoverLayout}
          filteredCount={filteredDiscoveredCreators.length}
          filtersActive={discoverFiltersActive}
          onClear={clearDiscoverFilters}
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
                      setVisibleFeedCount((count) => Math.min(searchResults.length, count + 20))
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
          {filteredDiscoveredCreators.length > 0 ? (
            <div className={cn(discoverLayout === "grid" ? "grid gap-3 sm:grid-cols-2" : "space-y-3")}>
              {filteredDiscoveredCreators.map((creator) => (
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
                {discoverFiltersActive
                  ? localizeUi("ui.slurp.discover.noMatches", { defaultValue: "No Creators match these filters" })
                  : localizeUi("ui.noodle.subscriptionsections.noCreatorsAreVisibleToThisPersonaYet")}
              </p>
              {discoverFiltersActive && (
                <button
                  type="button"
                  onClick={clearDiscoverFilters}
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
  return (
    <div ref={setScroller} className="min-h-0 flex-1 overflow-y-auto">
      <div
        ref={setStickyHeader}
        className={cn(
          "sticky top-0 z-30 border-b border-white/[0.055] bg-[var(--slurp-surface,var(--background))] shadow-[var(--slurp-shadow-modal)] backdrop-blur-xl @min-[1024px]:bg-[linear-gradient(110deg,color-mix(in_srgb,var(--slurp-surface,var(--background))_91%,transparent),color-mix(in_srgb,var(--noodle-accent)_10%,var(--slurp-surface))_55%,color-mix(in_srgb,var(--slurp-violet)_8%,var(--slurp-surface)))]",
          HIDE_ON_SCROLL_CLASS,
        )}
        data-component="SlurpHome.StickyHeader"
      >
        <div
          className="relative flex h-14 items-center border-b border-[var(--noodle-divider)] px-3 @min-[1024px]:px-5"
          data-component="SlurpHome.HeaderBar"
        >
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:cursor-not-allowed disabled:opacity-50"
            title={localizeUi("ui.noodle.noodlehome.refreshTimeline")}
            aria-label={localizeUi("ui.noodle.noodlehome.refreshTimeline")}
          >
            {isRefreshing ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} aria-hidden="true" />}
          </button>
          <NoodleLogo className="pointer-events-none absolute start-1/2 h-9 w-14 -translate-x-1/2 rtl:translate-x-1/2" />
          <button
            type="button"
            onClick={onOpenWallet}
            className="ms-auto flex h-11 max-w-full items-center gap-1.5 overflow-hidden rounded-full px-3 text-sm font-semibold tabular-nums text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] @min-[1024px]:hidden"
            aria-label={localizeUi("ui.slurp.wallet.balance", { amount: walletCoins })}
            title={localizeUi("ui.slurp.wallet.balance", { amount: walletCoins })}
          >
            <SlurpCoinAmount amount={walletCoins} watchAmount={walletCoins} />
          </button>
        </div>
      </div>
      <SlurpMomentsShelf
        moments={moments}
        newSinceAt={newSinceAt}
        onOpenMoment={setActiveMomentId}
        onAddStory={onAddStory}
        embedded
      />
      <div className="hidden border-b border-[var(--noodle-divider)] py-3 @min-[1024px]:block @min-[1280px]:hidden">
        <SubscriptionSections
          creators={(scope?.creators ?? []).filter(
            (creator) => creator.profile.id !== authorProfile?.id && !creator.subscribed,
          )}
          onOpenProfile={postCardCtx.openAuthorProfile}
          compact
          collapsed={discoverCollapsed}
          onToggleCollapsed={() => setDiscoverCollapsed((value) => !value)}
        />
      </div>
      {!isLoading && !isError && scope && (
        <div className="flex items-end justify-between gap-4 bg-[var(--slurp-canvas)] px-4 pb-3 pt-7 sm:px-5 @min-[1024px]:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--noodle-accent)_3%,var(--slurp-canvas)),var(--slurp-canvas))]">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--slurp-warm)]" aria-hidden="true" />
              <h2 className="text-lg font-black tracking-tight">{localizeUi("ui.slurp.home.latestDrops")}</h2>
            </div>
            <p className="mt-1 hidden text-xs leading-5 text-[var(--muted-foreground)] sm:block">
              {localizeUi("ui.slurp.home.latestDropsDetail")}
            </p>
          </div>
          <span className="hidden shrink-0 rounded-full bg-[var(--slurp-surface-raised)] px-2.5 py-1 text-xs font-semibold tabular-nums text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)] sm:inline-flex">
            {localizeUi("ui.slurp.home.postCount", { count: feed.length })}
          </span>
        </div>
      )}
      {!isLoading && !isError && scope && (
        <div className="bg-[var(--slurp-canvas)] pb-2">
          <div className="relative isolate overflow-hidden px-3 @min-[1024px]:px-5" data-slurp-home-masthead>
            <div className="flex items-center justify-between gap-3">
              <div
                className="relative grid flex-1 grid-cols-2 @min-[1024px]:max-w-xs"
                role="tablist"
                aria-label={localizeUi("ui.noodle.viewerhub.feedTabs")}
              >
                {(
                  [
                    { id: "following", label: localizeUi("ui.noodle.viewerhub.tabs.following") },
                    { id: "all", label: localizeUi("ui.noodle.viewerhub.tabs.allCreators") },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onTabChange(option.id)}
                    role="tab"
                    aria-selected={tab === option.id}
                    className={cn(
                      "relative flex min-h-11 items-center justify-center px-3 text-sm font-bold text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]",
                      tab === option.id && "text-[var(--foreground)]",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
                <span
                  className={cn(
                    "pointer-events-none absolute bottom-0 left-0 h-0.5 w-1/2 transition-transform duration-200 ease-out motion-reduce:transition-none",
                    tab === "all" && "translate-x-full",
                  )}
                  aria-hidden="true"
                >
                  <span className="mx-auto block h-full w-12 rounded-full bg-[var(--noodle-accent)]" />
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent)] p-1 ring-1 ring-inset ring-[var(--noodle-divider)]">
                {(
                  [
                    { id: "list", icon: List, label: localizeUi("ui.slurp.home.layout.list", { defaultValue: "List" }) },
                    { id: "wall", icon: LayoutGrid, label: localizeUi("ui.slurp.home.layout.wall", { defaultValue: "Media wall" }) },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFeedLayout(option.id)}
                    aria-pressed={feedLayout === option.id}
                    title={option.label}
                    aria-label={option.label}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]",
                      feedLayout === option.id && SLURP_TOGGLE_ACTIVE_CLASS,
                    )}
                  >
                    <option.icon size={17} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {isLoading ? (
        <SlurpFeedSkeleton />
      ) : isError ? (
        <EmptyState
          title={localizeUi("ui.noodle.viewerhub.noodlerCouldNotBeLoadedForThisPersona")}
          action={localizeUi("capabilities.actions.tryAgain")}
          onAction={onRetry}
        />
      ) : scope && scope.creators.length > 0 ? (
        <>
          {feed.length === 0 ? (
            <EmptyState
              title={
                searchTerm
                  ? localizeUi("ui.noodle.viewerhub.noSearchResults")
                  : tab === "following"
                    ? localizeUi("ui.noodle.viewerhub.noFollowedPosts")
                    : localizeUi("ui.noodle.viewerhub.noPostsYet")
              }
              detail={
                searchTerm
                  ? localizeUi("ui.slurp.empty.searchDetail")
                  : tab === "following"
                    ? localizeUi("ui.slurp.empty.followingDetail")
                    : undefined
              }
              action={
                searchTerm
                  ? localizeUi("ui.slurp.empty.clearSearch")
                  : tab === "following"
                    ? localizeUi("ui.slurp.empty.browseAll")
                    : authorProfile && onOpenAuthorProfile
                      ? localizeUi("ui.noodle.viewerhub.viewValue1", { value1: authorProfile.displayName })
                      : undefined
              }
              onAction={
                searchTerm
                  ? () => onSearchChange("")
                  : tab === "following"
                    ? () => onTabChange("all")
                    : onOpenAuthorProfile
              }
              icon={searchTerm ? Search : UserRound}
            />
          ) : feedLayout === "wall" ? (
            <SlurpMediaWall
              items={visibleFeed}
              onOpenPost={setOpenPostId}
              emptyAd={inlineAdsEnabled && !searchTerm ? emptyWallAd : null}
              adForIndex={(index) => {
                const ad = inlineAdForIndex(index);
                return inlineAdsEnabled && !searchTerm ? ad : null;
              }}
              adLabels={{
                sponsored: localizeUi("ui.slurp.ads.sponsored"),
                hide: localizeUi("ui.slurp.ads.hide"),
                actionFallback: localizeUi("ui.slurp.ads.view"),
              }}
              onAdAction={(ad) => {
                recordSlurpAdAction.mutate({ personaId: scope!.viewer.entityId, promotionId: ad.id });
                toast.info(localizeUi("ui.slurp.ads.opened", { brand: ad.brand }));
              }}
              onAdHide={(ad) =>
                hideSlurpAd.mutate(
                  { personaId: scope!.viewer.entityId, promotionId: ad.id },
                  {
                    onError: (error) => toast.error(errorMessage(error, localizeUi("ui.slurp.ads.hideFailed"))),
                  },
                )
              }
              onLoadMore={
                visibleFeed.length < feed.length
                  ? () => setVisibleFeedCount((count) => Math.min(feed.length, count + 20))
                  : undefined
              }
              total={feed.length}
            />
          ) : (
            <div className="space-y-4 bg-[var(--slurp-canvas)] px-3 pb-6 sm:px-4">
              {visibleFeed.map((item, index) => (
                <Fragment key={item.post.id}>
                  {index === dividerIndex && <NewSinceLastVisitDivider />}
                  {renderFeedPost(item)}
                  {(() => {
                    const ad = inlineAdForIndex(index);
                    if (!inlineAdsEnabled || searchTerm || !ad) return null;
                    return (
                      <SlurpInlineAd
                        promotion={ad}
                        labels={{
                          sponsored: localizeUi("ui.slurp.ads.sponsored"),
                          hide: localizeUi("ui.slurp.ads.hide"),
                          hideBrand: localizeUi("ui.slurp.ads.hideBrand"),
                          actionFallback: localizeUi("ui.slurp.ads.view"),
                        }}
                        onAction={() => {
                          recordSlurpAdAction.mutate({ personaId: scope!.viewer.entityId, promotionId: ad.id });
                          toast.info(localizeUi("ui.slurp.ads.opened", { brand: ad.brand }));
                        }}
                        onHide={() =>
                          hideSlurpAd.mutate(
                            { personaId: scope!.viewer.entityId, promotionId: ad.id },
                            {
                              onError: (error) =>
                                toast.error(errorMessage(error, localizeUi("ui.slurp.ads.hideFailed"))),
                            },
                          )
                        }
                        onHideBrand={() =>
                          hideSlurpAdBrand.mutate(
                            { personaId: scope!.viewer.entityId, brand: ad.brand },
                            {
                              onError: (error) =>
                                toast.error(errorMessage(error, localizeUi("ui.slurp.ads.hideFailed"))),
                            },
                          )
                        }
                      />
                    );
                  })()}
                  {tab === "all" && !searchTerm && index === Math.min(2, visibleFeed.length - 1) && (
                    <SlurpInlineSuggestedCreators
                      creators={suggestedCreators}
                      onOpenProfile={postCardCtx.openAuthorProfile}
                    />
                  )}
                </Fragment>
              ))}
              {visibleFeed.length < feed.length && (
                <LoadMoreFeedButton
                  visible={visibleFeed.length}
                  total={feed.length}
                  onLoadMore={() =>
                    setVisibleFeedCount((count) => Math.min(feed.length, count + 20))
                  }
                />
              )}
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title={
            authorProfile
              ? localizeUi("ui.noodle.viewerhub.noOtherStageProfilesAreVisibleToThisPersona")
              : localizeUi("ui.noodle.viewerhub.noStageProfilesAreVisibleToThisPersona")
          }
          detail={authorProfile ? localizeUi("ui.noodle.viewerhub.ownStageProfileStillAvailable") : undefined}
          action={
            authorProfile && onOpenAuthorProfile
              ? localizeUi("ui.noodle.viewerhub.viewValue1", { value1: authorProfile.displayName })
              : undefined
          }
          onAction={authorProfile ? onOpenAuthorProfile : undefined}
        />
      )}
      {openPostItem?.post.imageUrl && (
        <SlurpPostDialog
          post={{
            ...toNoodlePostCardModel(openPostItem.post, openPostItem.creator.profile),
            imageUrl: openPostItem.post.imageUrl,
          }}
          ctx={postCardCtx}
          onClose={() => setOpenPostId(null)}
        />
      )}
      {activeMoment && (
        <SlurpMomentViewer
          key={activeMoment.post.id}
          moment={activeMoment}
          personaId={scope?.viewer.entityId ?? null}
          isOwner={activeMoment.creator.profile.sourceAccountId === scope?.viewer.entityId}
          index={activeMomentIndex}
          total={moments.length}
          unlockPending={unlockPending}
          subscriptionPending={togglePending}
          onClose={() => setActiveMomentId(null)}
          onPrevious={
            activeMomentIndex > 0 ? () => setActiveMomentId(moments[activeMomentIndex - 1]!.post.id) : undefined
          }
          onNext={
            activeMomentIndex < moments.length - 1
              ? () => setActiveMomentId(moments[activeMomentIndex + 1]!.post.id)
              : undefined
          }
          onUnlock={onUnlock}
          onToggleSubscription={onToggleSubscription}
          onOpenProfile={postCardCtx.openAuthorProfile}
          ctx={postCardCtx}
        />
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// SlurpInlineSuggestedCreators
// ---------------------------------------------------------------------------

export function SlurpInlineSuggestedCreators({
  creators,
  onOpenProfile,
}: {
  creators: SlurpViewerCreator[];
  onOpenProfile?: (accountId: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (creators.length === 0) return null;
  return (
    <aside
      data-component="SlurpHome.InlineSuggestedCreators"
      aria-labelledby="slurp-inline-suggested-creators"
      className="overflow-hidden rounded-xl bg-[var(--slurp-surface)] px-3 py-3 ring-1 ring-inset ring-[var(--noodle-divider)]"
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 id="slurp-inline-suggested-creators" className="text-sm font-bold">
          {localizeUi("ui.slurp.suggestedCreators")}
        </h2>
        <Sparkles size={15} className="shrink-0 text-[var(--noodle-accent)]" aria-hidden="true" />
      </div>
      <div className="mt-2 flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {creators.map((creator) => (
          <SlurpCreatorProfileCard
            key={creator.profile.id}
            creator={creator}
            onOpenProfile={onOpenProfile}
            className="w-64 shrink-0 snap-start"
          />
        ))}
      </div>
    </aside>
  );
}

export { SlurpMomentShelfTile } from "./SlpScreenMoments";
export { SlurpMomentsShelf, SlurpMomentViewer };

