import { NOODLER_FEED_WINDOW_SIZE } from "./SlpHomeHelpers";
import { SlurpMomentsShelf, SlurpMomentViewer } from "./SlpScreenMoments";
import { SubscriptionSections } from "./SlpScreenSubscriptions";
import { LayoutGrid, List, Loader2, RefreshCw, Search, UserRound } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Persona } from "@marinara-engine/shared";
import type { SlurpManagedStageProfile } from "../../base/state/slp-state-types";
import {
  useHideSlurpAd,
  useHideSlurpAdBrand,
  useRecordSlurpAdAction,
  useSlurpInlineAds,
} from "../../features/ads/slp-ads-hooks";
import { useNoodlerViewer } from "../../features/feed/slp-feed-viewer-hooks";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { NoodlePostCardCtx } from "../../modules/post/SlpPostCard";
import { SlurpCoinAmount } from "../../modules/coin/SlpCoin";
import { LockedSlurpPostCard } from "../../modules/post/SlpLockedPostCard";
import { SlurpCreatorPostCard } from "../../modules/post/SlpCreatorPostCard";
import { SlurpMediaWall } from "./SlpScreenProfile";
import {
  SLURP_TOGGLE_ACTIVE_CLASS,
  NewSinceLastVisitDivider,
  HIDE_ON_SCROLL_CLASS,
  NoodleLogo,
  useHideOnScroll,
} from "../../base/chrome/SlpChrome";
import { SlurpInlineAd } from "../../features/ads/SlpInlineAd";
import { type SlurpDiscoverLayout } from "../../features/discovery/slp-discovery";
import {
  EmptyState,
  SlurpFeedSkeleton,
  SlurpAccessTransition,
  toNoodlePostCardModel,
  errorMessage,
  SlurpPostDialog,
  LoadMoreFeedButton,
} from "./SlpHomeHelpers";
import { deriveSlurpHubView } from "./slp-hub-view";
import { useSlurpHubDiscoveryFilters } from "./slp-hub-discovery-filters";
import { SlurpInlineSuggestedCreators } from "./SlpScreenSuggestedCreators";
import { SlpHubDiscover } from "./SlpHubDiscover";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

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
  /**
   * Frozen at the moment this persona's feed was first shown, so advancing the stored
   * timestamp does not make the divider vanish under the reader while they are still on it.
   */
  newSinceAt: string | null;
  /** Called once the feed is actually on screen — entering NoodleR is not the same as seeing it. */
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
  /** Open the persona's own Creator profile from the empty feed. */
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
  const [visibleFeedCount, setVisibleFeedCount] = useState(NOODLER_FEED_WINDOW_SIZE);
  const [activeMomentId, setActiveMomentId] = useState<string | null>(null);
  const [feedLayout, setFeedLayout] = useState<"list" | "wall">("list");
  const [discoverLayout, setDiscoverLayout] = useState<SlurpDiscoverLayout>(() => {
    if (typeof window === "undefined") return "grid";
    return window.localStorage.getItem("slurp2.discover.layout") === "list" ? "list" : "grid";
  });
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
    // Slot n sits after every nth post and takes the nth ad. Subtracting one here left the first
    // slot permanently empty and dropped one ad out of the rotation.
    if (index % inlineAdEvery !== inlineAdEvery - 1) return null;
    const items = inlineAdsQuery.data?.items ?? [];
    // The server hands back a small batch per fetch, not one ad per slot, so a long scroll
    // must cycle through it rather than index off the end into slots that stay empty forever.
    if (items.length === 0) return null;
    return items[Math.floor(index / inlineAdEvery) % items.length];
  };
  const emptyWallAd = inlineAdsQuery.data?.items?.[0] ?? null;
  const profileKey = (scope?.creators ?? []).map((creator) => creator.profile.id).join("\u0000");
  useEffect(() => {
    setVisibleFeedCount(NOODLER_FEED_WINDOW_SIZE);
  }, [authorProfile?.id, profileKey, scope?.viewer.id, search, tab]);
  // The visit counts once the feed itself is on screen and loaded — not on app entry, and not
  // while discovery search has replaced it. Declared above the early returns so hook order
  // stays stable across the empty and error states below.
  // A search-filtered list is not the feed either, so it does not count as having seen it.
  const feedIsOnScreen = Boolean(scope) && !isLoading && !isError && !discoveryOpen && !search.trim();
  useEffect(() => {
    if (feedIsOnScreen) onFeedShown();
  }, [feedIsOnScreen, onFeedShown]);
  const searchTerm = search.trim().toLowerCase();
  const { moments, feed, searchResults, discoveredCreators, suggestedCreators } = useMemo(
    () =>
      deriveSlurpHubView({
        creators: scope?.creators ?? [],
        tab,
        momentCutoff,
        searchTerm,
        authorProfileId: authorProfile?.id,
      }),
    [authorProfile?.id, momentCutoff, scope, searchTerm, tab],
  );
  const discover = useSlurpHubDiscoveryFilters({
    discoveredCreators,
    connectionCounts,
    search,
    searchTerm,
    onSearchChange,
  });
  // "Create a persona" is a claim about the user's data, so it waits for the personas query to
  // actually succeed instead of speaking for a cold or failed load.
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
  // One place decides what clicking a post image does, so the wall, the feed, and the profile
  // all open the same dialog.
  // Every Creator on the feed is one of the player's own, so the feed offers the same edit and
  // delete as the Creator profile. The image dialog keeps management off: it draws the card
  // without its picture, and an edit started there would save the post without it.
  const feedCardCtx = { ...postCardCtx, postManagement: true, openPost: setOpenPostId };
  const visibleSearchResults = searchResults.slice(0, visibleFeedCount);
  // The feed is newest-first, so the divider goes after the *last* new post — the viewer's own
  // posts sitting in that run are not news themselves but must not cut it short. Shown only
  // when there is something on both sides: with no older posts it would sit at the bottom
  // labelling nothing, and with no new ones it says nothing. A search-filtered list is not the
  // feed, so no boundary marker there either.
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
      <SlpHubDiscover
        discover={discover}
        discoverLayout={discoverLayout}
        setDiscoverLayout={setDiscoverLayout}
        discoveryInputRef={discoveryInputRef}
        localizeUi={localizeUi}
        onCloseDiscovery={onCloseDiscovery}
        onSearchChange={onSearchChange}
        onToggleSubscription={onToggleSubscription}
        postCardCtx={postCardCtx}
        renderFeedPost={renderFeedPost}
        search={search}
        searchResults={searchResults}
        searchTerm={searchTerm}
        setScroller={setScroller}
        setStickyHeader={setStickyHeader}
        setVisibleFeedCount={setVisibleFeedCount}
        togglePending={togglePending}
        visibleSearchResults={visibleSearchResults}
      />
    );
  }

  return (
    <div ref={setScroller} className="min-h-0 flex-1 overflow-y-auto">
      {/* Keep the feed controls attached to the scroller so the bar follows the reader's scroll. */}
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
          {/* ponytail: placeholder balance, wire to the real wallet when there is one. */}
          {/* The desktop sidebar carries the same balance, so it only shows where there is no sidebar. */}
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
      {/* Part of the page, not the bar: the strip belongs to Home, so it stays put while the
          sticky header does its own hide-on-scroll dance above it. */}
      <SlurpMomentsShelf
        moments={moments}
        newSinceAt={newSinceAt}
        onOpenMoment={setActiveMomentId}
        onAddStory={onAddStory}
        embedded
      />
      <div className="hidden border-b border-[var(--noodle-divider)] py-3 @min-[1024px]:block @min-[1024px]:px-4 @min-[1280px]:hidden">
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
            {/* Flat underline tabs: the accent marks the active feed, nothing else competes with the posts. */}
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
                {/* One underline that travels, rather than two that blink in and out. Half the row
                  wide so the transform is a plain 0/100%, with the bar centred inside it. */}
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
              {/* List or media wall. Same feed, two ways to read it. */}
              <div className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent)] p-1 ring-1 ring-inset ring-[var(--noodle-divider)]">
                {(
                  [
                    {
                      id: "list",
                      icon: List,
                      label: localizeUi("ui.slurp.home.layout.list", { defaultValue: "List" }),
                    },
                    {
                      id: "wall",
                      icon: LayoutGrid,
                      label: localizeUi("ui.slurp.home.layout.wall", { defaultValue: "Media wall" }),
                    },
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
                  ? () => setVisibleFeedCount((count) => Math.min(feed.length, count + NOODLER_FEED_WINDOW_SIZE))
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
                    // One place decides whether this row gets an ad. The slot
                    // maths used to be copy-pasted six times inside the JSX.
                    //
                    // Following carries ads too. The query already asks for a "following" context
                    // tag, so suppressing them here meant the default tab — the one nobody has to
                    // switch to — never showed a single ad. Search stays clean: results are the
                    // answer to a question, not a place to sell.
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
                          // The rating system has no positive signal without this.
                          recordSlurpAdAction.mutate({ personaId: scope!.viewer.entityId, promotionId: ad.id });
                          toast.info(localizeUi("ui.slurp.ads.opened", { brand: ad.brand }));
                        }}
                        // A silently failed hide leaves the ad on screen, so say so rather than
                        // letting the reader think it worked.
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
                    setVisibleFeedCount((count) => Math.min(feed.length, count + NOODLER_FEED_WINDOW_SIZE))
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

export { SlurpInlineSuggestedCreators } from "./SlpScreenSuggestedCreators";
export { SlurpMomentShelfTile } from "./SlpScreenMoments";
export { SlurpMomentsShelf, SlurpMomentViewer };
