import { useSlpMinuteClock } from "../../base/ui/slp-minute-clock";
import { SlpEmptyState, SlpErrorState, SlpSkeleton } from "../../modules/chrome/SlpStateKit";
import { SlpBalanceChip, SlpWordmark } from "../../modules/chrome/SlpShell";
import { SlpSegment } from "../../modules/chrome/SlpButton";
import { isSlurpStory, SLP_CREATOR_FEED_WINDOW_SIZE, type SlurpViewerCreator } from "./SlpHomeHelpers";
import { SlurpMomentsShelf, SlurpMomentViewer } from "./SlpScreenMoments";
import { slpShowPostInPlace } from "../../modules/post/SlpPostPurposeNote";
import { ArrowUp, LayoutGrid, List, Search, UserRound } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSlpDrawnCount } from "../../base/ui/slp-drawn-count";
import { useSlpStoryRings } from "../../modules/story/SlpStoryRing";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import type { Persona } from "@marinara-engine/shared";
import type { SlurpManagedStageProfile } from "../../base/state/slp-state-types";
import {
  useHideSlurpAd,
  useHideSlurpAdBrand,
  useRecordSlurpAdAction,
  useSlurpInlineAds,
} from "../../features/ads/slp-ads-hooks";
import { useCreatorViewer, useSlurpViewerFeedSlice } from "../../features/feed/slp-feed-viewer-hooks";
import { useSlurpWallet } from "../../features/economy/slp-economy-hooks";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SLP_CARD_STACK_CLASS } from "../../modules/post/SlpPostHelpers";
import { SlpPostCardCtx } from "../../modules/post/SlpPostTypes";
import { LockedSlurpPostCard } from "../../modules/post/SlpLockedPostCard";
import { SlpPostCard } from "../../modules/post/SlpPostCard";
import { SlurpMediaWall } from "./SlpScreenProfile";
import {
  Avatar,
  NewSinceLastVisitDivider,
  HIDE_ON_SCROLL_CLASS,
  SLP_BAR_GLASS_CLASS,
  SLP_PAGE_SCROLL_CLASS,
  useHideOnScroll,
} from "../../base/chrome/SlpChrome";
import { SlpTwinkle } from "../../modules/sparkle/SlpSparkle";
import { SlurpInlineAd } from "../../features/ads/SlpInlineAd";
import {
  SlurpFeedSkeleton,
  SlurpAccessTransition,
  toSlpPostCardModel,
  errorMessage,
  SlurpPostDialog,
  LoadMoreFeedButton,
} from "./SlpHomeHelpers";
import { deriveSlurpHubView } from "./slp-hub-view";
import { holdNewSlpFeedPosts, newestSlpFeedTime } from "../../features/feed/slp-feed-refresh";
import { useSlurpHubDiscoveryFilters } from "./slp-hub-discovery-filters";
import { SlurpInlineSuggestedCreators } from "./SlpScreenSuggestedCreators";
import { SlpHubDiscover } from "./SlpHubDiscover";
import { useSlurpSettings, useTurnOnSlurpAutoPosting } from "../../features/settings/slp-settings-hooks";

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
  onAddCreators,
  togglePending,
  connectionCounts,
  inlineAdsEnabled,
  inlineAdsFrequency,
  storyLifetimeHours,
  newSinceAt,
  onFeedShown,
  onLoadMore,
  hasMore,
}: {
  personas: Persona[];
  personasLoading: boolean;
  personasError: boolean;
  onRetryPersonas: () => void;
  scope: ReturnType<typeof useCreatorViewer>["data"];
  /**
   * Frozen at the moment this persona's feed was first shown, so advancing the stored
   * timestamp does not make the divider vanish under the reader while they are still on it.
   */
  newSinceAt: string | null;
  /** Called once the feed is actually on screen — entering NoodleR is not the same as seeing it. */
  onFeedShown: () => void;
  onLoadMore: () => Promise<boolean>;
  hasMore: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  unlockPending: boolean;
  postCardCtx: SlpPostCardCtx;
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
  /** Open the setup wizard's "Add creators" step from an empty Hub. */
  onAddCreators?: () => void;
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
  const reduceMotion = useReducedMotion();
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const setStickyHeader = useHideOnScroll(scroller);
  const [loadingMore, setLoadingMore] = useState(false);
  const [visibleFeedCount, setVisibleFeedCount] = useState(SLP_CREATOR_FEED_WINDOW_SIZE);
  const [activeMomentId, setActiveMomentId] = useState<string | null>(null);
  const [feedLayout, setFeedLayout] = useState<"list" | "wall">("list");
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const momentNow = useSlpMinuteClock();
  const momentCutoff = momentNow - storyLifetimeHours * 60 * 60 * 1000;
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
    setVisibleFeedCount(SLP_CREATOR_FEED_WINDOW_SIZE);
  }, [authorProfile?.id, profileKey, scope?.viewer.id, search, tab]);
  // The visit counts once the feed itself is on screen and loaded — not on app entry, and not
  // while discovery search has replaced it. Declared above the early returns so hook order
  // stays stable across the empty and error states below.
  // A search-filtered list is not the feed either, so it does not count as having seen it.
  const feedIsOnScreen = Boolean(scope) && !isLoading && !isError && !discoveryOpen && !search.trim();
  useEffect(() => {
    if (feedIsOnScreen) onFeedShown();
  }, [feedIsOnScreen, onFeedShown]);
  const searchTerm = useDeferredValue(search).trim().toLowerCase(); // filtering no longer blocks typing
  // Search and Following come from the server, page by page (R1-084); the loaded feed alone missed
  // older posts. The derived view below still gives Stories, Creators and the "all" feed.
  const sliceActive = Boolean(searchTerm) || tab === "following";
  const slice = useSlurpViewerFeedSlice(scope?.viewer.entityId ?? null, searchTerm ? "all" : tab, search);
  const sliceItems = useMemo(() => {
    if (!sliceActive || !slice.data) return null;
    const byId = new Map<string, SlurpViewerCreator>();
    for (const page of slice.data.pages) for (const creator of page.creators) byId.set(creator.profile.id, creator);
    for (const creator of scope?.creators ?? []) byId.set(creator.profile.id, creator);
    return slice.data.pages
      .flatMap((page) => page.items)
      .filter((item) => !isSlurpStory(item.post))
      .flatMap((item) => {
        const creator = byId.get(item.creatorAccountId);
        return creator ? [{ post: item.post, creator }] : [];
      });
  }, [scope?.creators, slice.data, sliceActive]);
  const {
    moments,
    feed: derivedFeed,
    searchResults: derivedSearchResults,
    discoveredCreators,
    suggestedCreators,
  } = useMemo(
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
  // A ringed avatar asked for a Creator's Stories: play them here, or on their page when this tab's
  // shelf does not carry them (Following, not followed).
  const { pending: pendingStories, taken: storiesTaken, startOf: storyStartOf } = useSlpStoryRings();
  useEffect(() => {
    if (!pendingStories) return;
    const start = storyStartOf?.(pendingStories);
    if (start && moments.some((moment) => moment.post.id === start)) {
      setActiveMomentId(start);
      storiesTaken?.();
    } else postCardCtx.openAuthorProfile?.(pendingStories);
  }, [moments, pendingStories, storiesTaken, storyStartOf, postCardCtx]);
  const fullFeed = !searchTerm && sliceItems ? sliceItems : derivedFeed;
  const searchResults = searchTerm && sliceItems ? sliceItems : derivedSearchResults;
  // "Load more" pages whichever list is on screen; the total is the server's count, not a guess (R1-042).
  const feedHasMore = sliceActive ? Boolean(slice.hasNextPage) : hasMore;
  const loadMoreFeed = sliceActive
    ? async () => {
        if (!slice.hasNextPage) return false;
        await slice.fetchNextPage();
        return true;
      }
    : onLoadMore;
  const serverTotal = sliceActive ? slice.data?.pages[0]?.total : (scope as { total?: number } | undefined)?.total;
  // The feed updates itself; posts that arrive while the reader is here wait behind the "New posts"
  // pill (the mark is per persona and tab), so the list never jumps under their thumb.
  const feedMarkKey = `${scope?.viewer.id ?? ""}\u0000${tab}`;
  const [feedMark, setFeedMark] = useState<{ key: string; at: number } | null>(null);
  const newestFeedAt = newestSlpFeedTime(fullFeed);
  useEffect(() => {
    if (newestFeedAt !== null && feedMark?.key !== feedMarkKey) setFeedMark({ key: feedMarkKey, at: newestFeedAt });
  }, [feedMark?.key, feedMarkKey, newestFeedAt]);
  const { shown: feed, held: heldPosts } = holdNewSlpFeedPosts(
    fullFeed,
    !searchTerm && feedMark?.key === feedMarkKey ? feedMark.at : null,
    ({ creator }) => (creator as { ownedByViewer?: boolean }).ownedByViewer === true,
  );
  const drawnFeedCount = useSlpDrawnCount(Math.min(feed.length, visibleFeedCount), `${feedMarkKey}:${searchTerm}`);
  // Up to three faces of who posted, newest first, one per Creator.
  const heldPosters = [
    ...new Map(heldPosts.map(({ creator }) => [creator.profile.id, creator.profile])).values(),
  ].slice(0, 3);
  const showHeldPosts = () => {
    if (newestFeedAt !== null) setFeedMark({ key: feedMarkKey, at: newestFeedAt });
    setVisibleFeedCount((count) => count + heldPosts.length);
    scroller?.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };
  const discover = useSlurpHubDiscoveryFilters({
    discoveredCreators,
    connectionCounts,
    search,
    searchTerm,
    onSearchChange,
  });
  // The paid period of each subscription, so a Discover card can say "ends Thu" after a cancel.
  const walletSubscriptions = useSlurpWallet(scope?.viewer.entityId ?? null).data?.subscriptions;
  // "Tap a preview to open the full post" (on by default); off, a tap shows the picture alone.
  const slurpSettings = useSlurpSettings().data;
  const previewOpensPost = slurpSettings?.previewOpensPost !== false;
  // An empty feed says why: automatic posting is off (one tap turns it on), or first posts are on the way.
  const turnOnAutoPosting = useTurnOnSlurpAutoPosting((error) =>
    toast.error(errorMessage(error, localizeUi("ui.slurp.empty.autoPostingError"))),
  );
  const autoPostingOff = slurpSettings?.autoPostingScheduleEnabled === false;
  // "Create a persona" is a claim about the user's data, so it waits for the personas query to
  // actually succeed instead of speaking for a cold or failed load.
  if (personas.length === 0) {
    if (personasError) {
      return (
        <SlpErrorState
          title={localizeUi("ui.noodle.viewerhub.couldNotLoadPersonas")}
          detail={localizeUi("ui.noodle.viewerhub.personaAccessDetail")}
          onRetry={onRetryPersonas}
        />
      );
    }
    if (personasLoading) {
      return <SlpSkeleton label={localizeUi("ui.noodle.viewerhub.loadingPersonas")} />;
    }
    return (
      <SlpEmptyState
        title={localizeUi("ui.noodle.viewerhub.createAPersonaToBrowseNoodler")}
        detail={localizeUi("ui.slurp.empty.noPersonaDetail")}
      />
    );
  }
  const activeMomentIndex = activeMomentId ? moments.findIndex((moment) => moment.post.id === activeMomentId) : -1;
  const activeMoment = activeMomentIndex >= 0 ? moments[activeMomentIndex] : null;
  const visibleFeed = feed.slice(0, visibleFeedCount);
  // Search results are a list of their own: a picture tapped there opened nothing while it looked only in the feed.
  const openPostItem = openPostId
    ? (feed.find((item) => item.post.id === openPostId) ??
      searchResults.find((item) => item.post.id === openPostId) ??
      null)
    : null;
  // One place decides what clicking a post image does, so the wall, the feed, and the profile
  // all open the same dialog.
  // Every Creator on the feed is one of the player's own, so the feed offers the same edit and
  // delete as the Creator profile. The image dialog keeps management off: it draws the card
  // without its picture, and an edit started there would save the post without it.
  const feedCardCtx = {
    ...postCardCtx,
    postManagement: true,
    openPost: previewOpensPost ? setOpenPostId : undefined,
  };
  const visibleSearchResults = searchResults.slice(0, visibleFeedCount);
  // The feed is newest-first, so the divider goes after the *last* new post — the viewer's own
  // posts sitting in that run are not news themselves but must not cut it short. Shown only
  // when there is something on both sides: with no older posts it would sit at the bottom
  // labelling nothing, and with no new ones it says nothing. A search-filtered list is not the
  // feed, so no boundary marker there either.
  const newSince = newSinceAt ? new Date(newSinceAt).getTime() : NaN;
  const isNewToViewer = ({ post, creator }: (typeof feed)[number]) =>
    !Number.isNaN(newSince) &&
    !((creator as { ownedByViewer?: boolean }).ownedByViewer === true) &&
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
    <SlurpAccessTransition
      key={post.id}
      postId={post.id}
      locked={post.locked}
      menuOpen={postCardCtx.postMenuId === post.id}
    >
      {post.locked ? (
        <LockedSlurpPostCard
          post={post}
          profile={creator.profile}
          subscriptionPrice={creator.subscriptionPrice}
          postMenuOpen={postCardCtx.postMenuId === post.id}
          setPostMenuOpen={(open) => postCardCtx.setPostMenuId(open ? post.id : null)}
          subscribed={creator.subscribed}
          unlockPending={unlockPending}
          subscriptionPending={togglePending}
          onUnlock={onUnlock}
          onGambleUnlock={postCardCtx.gambleUnlockPost}
          unlockOffer={postCardCtx.unlockOffer}
          subscriptionOffer={postCardCtx.subscriptionOffer}
          onToggleSubscription={onToggleSubscription}
          onOpenProfile={postCardCtx.openAuthorProfile}
        />
      ) : (
        <SlpPostCard
          post={toSlpPostCardModel(post, creator.profile)}
          ctx={{
            ...feedCardCtx,
            personaAccount: postCardCtx.personaAccount,
          }}
        />
      )}
    </SlurpAccessTransition>
  );

  // One ad card for the feed and Discover (native post style).
  const renderInlineAd = (ad: NonNullable<ReturnType<typeof inlineAdForIndex>>, wide = false) => (
    <SlurpInlineAd
      promotion={ad}
      wide={wide}
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
            onError: (error) => toast.error(errorMessage(error, localizeUi("ui.slurp.ads.hideFailed"))),
          },
        )
      }
      onHideBrand={() =>
        hideSlurpAdBrand.mutate(
          { personaId: scope!.viewer.entityId, brand: ad.brand },
          {
            onError: (error) => toast.error(errorMessage(error, localizeUi("ui.slurp.ads.hideFailed"))),
          },
        )
      }
    />
  );

  if (discoveryOpen) {
    return (
      <SlpHubDiscover
        discover={discover}
        discoverAd={
          inlineAdsEnabled && inlineAdsQuery.data?.items?.[0]
            ? renderInlineAd(inlineAdsQuery.data.items[0], true)
            : null
        }
        isLoading={isLoading && !scope}
        isError={isError && !scope}
        onRetry={onRetry}
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
        walletSubscriptions={walletSubscriptions}
      />
    );
  }

  return (
    <div ref={setScroller} className={cn("min-h-0 flex-1 overflow-y-auto", SLP_PAGE_SCROLL_CLASS)}>
      {/* Phones only: the desktop sidebar already carries the brand and the balance. */}
      <div
        ref={setStickyHeader}
        className={cn(
          // Glass: the feed scrolls under the bar and shows through the blur.
          "sticky top-0 z-30 border-b border-[var(--noodle-divider)] shadow-[var(--slurp-shadow-floating),var(--slurp-highlight)] @min-[1024px]:hidden",
          SLP_BAR_GLASS_CLASS,
          HIDE_ON_SCROLL_CLASS,
        )}
        data-component="SlurpHome.StickyHeader"
      >
        <div
          className="relative flex h-14 items-center justify-between gap-1 px-3"
          data-component="SlurpHome.HeaderBar"
        >
          <SlpWordmark />
          <SlpBalanceChip />
        </div>
      </div>
      {/* Zero height, so the pill floats over the top of the feed without moving it. Under the phone
          header (56 px + 12 px air); on desktop there is no header. */}
      <div
        className="pointer-events-none sticky top-[68px] z-20 flex h-0 justify-center @min-[1024px]:top-3"
        aria-live="polite"
      >
        <AnimatePresence>
          {heldPosts.length > 0 && (
            <motion.button
              type="button"
              onClick={showHeldPosts}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              className="pointer-events-auto flex h-11 items-center rounded-full px-1 focus-visible:outline-none [&:focus-visible>span]:ring-2 [&:focus-visible>span]:ring-[var(--slurp-focus)] [&:focus-visible>span]:ring-offset-2"
              data-component="SlurpHome.NewPosts"
            >
              <span
                className={cn(
                  "relative flex h-9 items-center gap-1.5 rounded-full bg-[var(--noodle-accent)] pe-4 text-[13px] font-bold text-[var(--slurp-on-accent)] shadow-[var(--slurp-glow),var(--slurp-shadow-floating)] [&_svg]:!text-[var(--slurp-on-accent)]",
                  heldPosters.length > 0 ? "ps-1.5" : "ps-3",
                )}
              >
                {heldPosters.length > 0 && (
                  <span className="flex" aria-hidden="true">
                    {heldPosters.map((profile) => (
                      <Avatar
                        key={profile.id}
                        account={profile}
                        size="xs"
                        className="-ms-2 h-6 w-6 border-2 border-[var(--noodle-accent)] bg-[var(--slurp-surface)] text-[9px] first:ms-0"
                      />
                    ))}
                  </span>
                )}
                <ArrowUp size={16} strokeWidth={2.25} aria-hidden="true" />
                {localizeUi("ui.slurp.feed.newPosts", { count: heldPosts.length })}
                {/* A new post is a good moment: two stars pop on the corners once, then fade (static under reduced motion). */}
                <SlpTwinkle
                  fade
                  points={[
                    { x: "-5px", y: "-6px", size: 11 },
                    { x: "calc(100% - 4px)", y: "calc(100% - 8px)", size: 9 },
                  ]}
                />
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      {/* Part of the page, not the bar: the strip belongs to Home, so it stays put while the
          sticky header does its own hide-on-scroll dance above it. */}
      <SlurpMomentsShelf
        moments={moments}
        newSinceAt={newSinceAt}
        onOpenMoment={setActiveMomentId}
        onAddStory={onAddStory}
        embedded
        // No feed yet (loading, or the query has not started) is not "nothing new".
        isLoading={isLoading || (!scope && !isError)}
        isError={isError}
      />
      {!isLoading && !isError && scope && (
        <div className="pb-2 pt-4 @min-[1024px]:bg-[var(--slurp-canvas)]">
          <div className="relative isolate overflow-hidden px-3 @min-[1024px]:px-5" data-slurp-home-masthead>
            {/* One row, one purpose: which feed and how to show it. No refresh: the feed updates itself. */}
            <div className="flex items-center gap-2">
              <SlpSegment
                label={localizeUi("ui.noodle.viewerhub.feedTabs")}
                value={tab}
                onChange={onTabChange}
                className="min-w-0"
                options={[
                  { value: "following", label: localizeUi("ui.noodle.viewerhub.tabs.following") },
                  { value: "all", label: localizeUi("ui.noodle.viewerhub.tabs.allCreators") },
                ]}
              />
              <SlpSegment
                label={localizeUi("ui.slurp.home.layout.label", { defaultValue: "Feed layout" })}
                value={feedLayout}
                onChange={setFeedLayout}
                className="ms-auto shrink-0"
                options={[
                  {
                    value: "list",
                    label: localizeUi("ui.slurp.home.layout.list", { defaultValue: "List" }),
                    icon: <List size={17} aria-hidden="true" />,
                  },
                  {
                    value: "wall",
                    label: localizeUi("ui.slurp.home.layout.wall", { defaultValue: "Media wall" }),
                    icon: <LayoutGrid size={17} aria-hidden="true" />,
                  },
                ]}
              />
            </div>
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="relative">
          <div className="flex items-center gap-2 px-4 pt-4 text-xs font-semibold text-[var(--noodle-accent-foreground)] sm:px-5">
            <span className="relative flex h-5 w-5 items-center justify-center" aria-hidden="true">
              <span className="absolute h-5 w-5 rounded-full border border-[var(--noodle-accent)]/25 motion-safe:animate-ping motion-reduce:animate-none" />
              <span className="h-2 w-2 rounded-full bg-[var(--noodle-accent)]" />
            </span>
            <span>{localizeUi("ui.slurp.feed.loading", { defaultValue: "Loading latest drops" })}</span>
          </div>
          <SlurpFeedSkeleton />
        </div>
      ) : isError ? (
        <SlpErrorState
          title={localizeUi("ui.noodle.viewerhub.noodlerCouldNotBeLoadedForThisPersona")}
          onRetry={onRetry}
        />
      ) : scope && scope.creators.length > 0 ? (
        <>
          {feed.length === 0 ? (
            <SlpEmptyState
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
                    : autoPostingOff
                      ? localizeUi("ui.slurp.empty.autoPostingOffDetail")
                      : slurpSettings && localizeUi("ui.slurp.empty.firstPostsDetail")
              }
              action={
                searchTerm
                  ? localizeUi("ui.slurp.empty.clearSearch")
                  : tab === "following"
                    ? localizeUi("ui.slurp.empty.browseAll")
                    : autoPostingOff
                      ? localizeUi("ui.slurp.empty.turnOnAutoPosting")
                      : authorProfile && onOpenAuthorProfile
                        ? localizeUi("ui.noodle.viewerhub.viewValue1", { value1: authorProfile.displayName })
                        : undefined
              }
              onAction={
                searchTerm
                  ? () => onSearchChange("")
                  : tab === "following"
                    ? () => onTabChange("all")
                    : autoPostingOff
                      ? turnOnAutoPosting
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
                  ? () => setVisibleFeedCount((count) => Math.min(feed.length, count + SLP_CREATOR_FEED_WINDOW_SIZE))
                  : feedHasMore
                    ? () =>
                        void loadMoreFeed().then((loaded) => {
                          if (loaded) setVisibleFeedCount((count) => count + SLP_CREATOR_FEED_WINDOW_SIZE);
                        })
                    : undefined
              }
              total={Math.max(feed.length, serverTotal ?? 0)}
            />
          ) : (
            <div className={cn(SLP_CARD_STACK_CLASS, "px-3 pb-6 sm:px-4 @min-[1024px]:bg-[var(--slurp-canvas)]")}>
              <AnimatePresence initial={false} mode="popLayout">
                {visibleFeed.slice(0, drawnFeedCount).map((item, index) => (
                  <motion.div
                    key={item.post.id}
                    initial={false}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: "easeOut" }}
                    className={
                      postCardCtx.postMenuId === item.post.id ? "relative z-40 overflow-visible" : "overflow-hidden"
                    }
                  >
                    <div className={SLP_CARD_STACK_CLASS}>
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
                        return renderInlineAd(ad);
                      })()}
                      {tab === "all" && !searchTerm && index === Math.min(2, visibleFeed.length - 1) && (
                        <SlurpInlineSuggestedCreators
                          creators={suggestedCreators}
                          onOpenProfile={postCardCtx.openAuthorProfile}
                        />
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {drawnFeedCount < visibleFeed.length && <SlpSkeleton shape="posts" count={1} />}
              {(visibleFeed.length < feed.length || feedHasMore) && (
                <LoadMoreFeedButton
                  visible={visibleFeed.length}
                  total={Math.max(feed.length, serverTotal ?? 0, feedHasMore ? visibleFeed.length + 1 : 0)}
                  onLoadMore={async () => {
                    if (visibleFeed.length < feed.length) {
                      setVisibleFeedCount((count) => Math.min(feed.length, count + SLP_CREATOR_FEED_WINDOW_SIZE));
                      return;
                    }
                    setLoadingMore(true);
                    try {
                      if (await loadMoreFeed()) {
                        setVisibleFeedCount((count) => count + SLP_CREATOR_FEED_WINDOW_SIZE);
                      }
                    } finally {
                      setLoadingMore(false);
                    }
                  }}
                  loading={loadingMore}
                />
              )}
            </div>
          )}
        </>
      ) : (
        <SlpEmptyState
          title={
            authorProfile
              ? localizeUi("ui.noodle.viewerhub.noOtherStageProfilesAreVisibleToThisPersona")
              : localizeUi("ui.noodle.viewerhub.noStageProfilesAreVisibleToThisPersona")
          }
          detail={localizeUi(
            authorProfile ? "ui.noodle.viewerhub.ownStageProfileStillAvailable" : "ui.slurp.empty.noCreatorsDetail",
          )}
          // First run ended here with no way on: with no Creators at all, the action adds some (R1-131).
          action={
            authorProfile && onOpenAuthorProfile
              ? localizeUi("ui.noodle.viewerhub.viewValue1", { value1: authorProfile.displayName })
              : onAddCreators
                ? localizeUi("ui.noodle.noodlerwizard.addCreators")
                : undefined
          }
          onAction={authorProfile ? onOpenAuthorProfile : onAddCreators}
        />
      )}
      {/* A gallery post can carry its pictures in `images` with no single `imageUrl`. */}
      {(openPostItem?.post.imageUrl || openPostItem?.post.images[0]) && (
        <SlurpPostDialog
          post={{
            ...toSlpPostCardModel(openPostItem.post, openPostItem.creator.profile),
            imageUrl: openPostItem.post.imageUrl ?? openPostItem.post.images[0]!.imageUrl,
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
          isOwner={(activeMoment.creator as { ownedByViewer?: boolean }).ownedByViewer === true}
          // Progress counts this Creator's Stories only, so the bar shows where one Creator ends.
          index={
            moments.filter(
              (moment, position) =>
                position < activeMomentIndex && moment.creator.profile.id === activeMoment.creator.profile.id,
            ).length
          }
          total={moments.filter((moment) => moment.creator.profile.id === activeMoment.creator.profile.id).length}
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
          onOpenPost={(postId) => {
            const creatorId = activeMoment.creator.profile.id;
            setActiveMomentId(null);
            // After the Story closes: the post in the feed if it is there, else the Creator's page.
            window.setTimeout(() => slpShowPostInPlace(postId) || postCardCtx.openAuthorProfile?.(creatorId), 80);
          }}
          ctx={postCardCtx}
        />
      )}
    </div>
  );
}

export { SlurpInlineSuggestedCreators } from "./SlpScreenSuggestedCreators";
export { SlurpMomentShelfTile } from "./SlpScreenMoments";
export { SlurpMomentsShelf, SlurpMomentViewer };
