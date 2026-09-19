import { NoodlerPostComposer } from "./SlpScreenComposer";
import {
  BookmarkCheck,
  BookmarkPlus,
  ChevronDown,
  ChevronLeft,
  Clock3,
  LayoutGrid,
  List,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  NOODLER_POST_CONTENT_MAX_LENGTH,
  NOODLER_POST_GUIDE_MAX_LENGTH,
  NOODLER_POST_TITLE_MAX_LENGTH,
  noodlePollInputSchema,
} from "@marinara-engine/shared";
import type {
  NoodleAccount,
  NoodlePostAccess,
  NoodlerPostView,
  NoodlePollInput,
  NoodlePostImageCrop,
  NoodlerManagedPost,
  NoodlerStageProfile,
} from "@marinara-engine/shared";
import type { SlurpManagedStageProfile, SlurpStageProfileInput } from "../../base/state/slp-state-types";
import type { SlurpPromotion } from "../../features/ads/slp-ads-contract";
import {
  useNoodlerFollowers,
  useNoodlerSubscribers,
} from "../../features/audience/slp-audience-hooks";
import { useUpdateNoodlerFanActivity } from "../../features/audience/slp-fan-activity-hooks";
import {
  useGenerateNoodlerArtwork,
  useUploadNoodlerAvatar,
  useUploadNoodlerBanner,
} from "../../features/creators/slp-creator-profile-hooks";
import { useTipSlurpCreator } from "../../features/economy/slp-economy-hooks";
import type {
  NoodlerContentFormat,
  NoodlerPostDraftImage,
  SlurpProfilePost,
} from "../../features/feed/slp-feed-contract";
import {
  useUpdateNoodlerAutoPosting,
} from "../../features/feed/slp-feed-schedule-hooks";
import {
  useNoodlerViewer,
  useToggleNoodlerFollow,
  useToggleNoodlerSubscription,
} from "../../features/feed/slp-feed-viewer-hooks";
import { useSlurpCompose } from "../../features/messages/slp-messages-hooks";
import { useSlurpArcs } from "../../features/projects/slp-projects-hooks";
import { useSlurpSettings } from "../../features/settings/slp-settings-hooks";
import { toast } from "sonner";
import {
  NoodleComposerShell,
  NoodleComposerToolRow,
  type NoodlePostCardCtx,
  type NoodlePostCardModel,
} from "../../modules/post/SlpPostCard";
import { NoodleAnchoredPopover } from "../../base/chrome/SlpAnchoredPopover";
import { SlurpArcTimelineCard } from "../../features/projects/SlpArcTimelineCard";
import { SlurpFanCard } from "../../features/audience/SlpFanCard";
import { LockedSlurpPostCard } from "../../modules/post/SlpLockedPostCard";
import { SlurpCreatorPostCard } from "../../modules/post/SlpCreatorPostCard";
import {
  SlurpCoinAmount,
  SlurpCoinBurst,
} from "../../modules/coin/SlpCoin";
import { useNearViewportSlurpMediaSrc, useSlurpMediaSrc } from "../../base/media/slp-media-src";
import { slurpCreatorStatus } from "../../modules/creator/slp-creator-status";
import {
  Avatar,
  getNoodleAccentStyle,
  SLURP_TOGGLE_ACTIVE_CLASS,
  NoodleLogo,
  ProfileInitial,
  NOODLE_PINK,
} from "../../base/chrome/SlpChrome";
import { SlurpProfileSurface } from "../../features/creators/SlpProfileSurface";
import { NoodleImageComposer } from "../../base/media/SlpImageComposer";
import { NoodlePollComposer } from "../../modules/poll/SlpPollComposer";
import { PostImageCropEditor } from "../../base/media/SlpPostImageCropEditor";
import { ConversationMediaPickerPanel, type ConversationMediaPickerTabId } from "../../../components/chat/ConversationMediaPickerPanel";
import { HelpTooltip } from "../../../components/ui/HelpTooltip";
import { Modal } from "../../../components/ui/Modal";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SlurpInlineAdTile } from "../../features/ads/SlpInlineAd";
import { SlurpCreatorProfileCard } from "../../modules/creator/SlpCreatorProfileCard";
import { SlurpDiscoveryProfileEditor } from "../../features/discovery/SlpDiscoveryProfileEditor";
import {
  appendAudienceStance,
  AudienceStancePresets,
  profileAccent,
} from "../../features/creators/SlpStageProfileForm";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { cn } from "../../../lib/utils";
import {
  errorMessage,
  isEmptyNoodlerPostDraft,
  isSlurpStory,
  linkedPostIdForStory,
  noodlerGoalOf,
  parsePrice,
  serializeNoodlerPostGuide,
  slurpSubscriptionPriceOf,
  toManagedPostCardModel,
  toNoodlePostCardModel,
  type NoodlerPostDraft,
  type NoodlerPostSubmission,
  type PendingNoodlerImage,
  NoodlerDraftImageFrame,
  SlurpAccessTransition,
  SlurpFeedSkeleton,
  EmptyState,
  NoodlerFrame,
  DisclosureBadge,
  NOODLER_FEED_WINDOW_SIZE,
  SourceAccountAvatar,
  LoadMoreFeedButton,
  SlurpMediaDialog,
  SlurpPostDialog,
} from "./SlpHomeHelpers";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

type SlurpProfileImagePost = NoodlePostCardModel & { imageUrl: string };

type NoodlerComposerTool = "image" | "poll" | "media" | "access";

type NoodlerProfileTab = "posts" | "media" | "stories" | "subscribers" | "followers";

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export function SlurpProfileFeaturedImage({
  post,
  onOpenImage,
}: {
  post: SlurpProfileImagePost;
  onOpenImage: (url: string, id: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { src: source, observe } = useNearViewportSlurpMediaSrc(post.imageUrl, { width: 960 });
  return (
    <button
      ref={observe}
      type="button"
      onClick={() => source && onOpenImage(source, post.id)}
      disabled={!source}
      className="block w-full overflow-hidden rounded-lg text-left ring-1 ring-inset ring-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
      aria-label={post.title || localizeUi("ui.slurp.post.openFeaturedImage")}
    >
      {source ? (
        <img
          src={source}
          alt={post.title || ""}
          loading="lazy"
          decoding="async"
          className="block aspect-[16/8] w-full object-cover"
        />
      ) : (
        <span className="block aspect-[16/8] w-full animate-pulse bg-[var(--muted)] motion-reduce:animate-none" />
      )}
    </button>
  );
}

export function SlurpProfileMediaTile({
  post,
  onOpenImage,
}: {
  post: SlurpProfileImagePost;
  onOpenImage: (url: string, id: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { src: source, observe } = useNearViewportSlurpMediaSrc(post.imageUrl, { width: 480 });
  return (
    <button
      ref={observe}
      type="button"
      onClick={() => source && onOpenImage(source, post.id)}
      disabled={!source}
      className="relative aspect-square overflow-hidden bg-[var(--background)] text-left focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] disabled:cursor-wait"
      aria-label={post.title || localizeUi("ui.slurp.post.openImage")}
    >
      {source ? (
        <img
          src={source}
          alt={post.title || ""}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03] motion-reduce:transition-none motion-reduce:hover:scale-100"
        />
      ) : (
        <div className="h-full w-full bg-[var(--muted)]" />
      )}
    </button>
  );
}

/**
 * The same feed as images only. Locked and text posts have nothing to show on a wall, so they
 * sit this view out rather than becoming grey squares.
 */
export function SlurpMediaWall({
  items,
  onOpenPost,
  onLoadMore,
  total,
  emptyAd,
  adForIndex,
  onAdAction,
  onAdHide,
  adLabels,
}: {
  items: { post: NoodlerPostView & { locked?: boolean }; creator: { profile: NoodlerStageProfile } }[];
  onOpenPost: (postId: string) => void;
  onLoadMore?: () => void;
  total: number;
  emptyAd?: SlurpPromotion | null;
  adForIndex?: (index: number) => SlurpPromotion | null;
  onAdAction?: (ad: SlurpPromotion) => void;
  onAdHide?: (ad: SlurpPromotion) => void;
  adLabels?: { sponsored: string; hide: string; actionFallback: string };
}) {
  const { t: localizeUi } = useUiTranslation();
  const tiles = items.flatMap<SlurpProfileImagePost>(({ post, creator }) => {
    if (post.locked || typeof post.imageUrl !== "string") return [];
    return [{ ...toNoodlePostCardModel(post, creator.profile), imageUrl: post.imageUrl }];
  });
  const emptyWallAd = emptyAd ?? null;
  if (tiles.length === 0) {
    return (
      <div className="space-y-3 px-4 py-8">
        <p className="text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.home.layout.empty", { defaultValue: "No images in this feed yet." })}
        </p>
        {emptyWallAd && adLabels ? (
          <SlurpInlineAdTile
            promotion={emptyWallAd}
            labels={adLabels}
            onAction={() => onAdAction?.(emptyWallAd)}
            onHide={() => onAdHide?.(emptyWallAd)}
          />
        ) : null}
      </div>
    );
  }
  return (
    <div className="bg-[var(--slurp-canvas)] pb-6">
      <div className="grid grid-cols-2 gap-px bg-[var(--noodle-divider)] @min-[620px]:grid-cols-3">
        {tiles.map((post, index) => {
          const ad = adForIndex?.(index) ?? null;
          return (
            <Fragment key={post.id}>
              <SlurpProfileMediaTile post={post} onOpenImage={(_url, id) => onOpenPost(id)} />
              {ad && adLabels ? (
                <SlurpInlineAdTile
                  promotion={ad}
                  labels={adLabels}
                  onAction={() => onAdAction?.(ad)}
                  onHide={() => onAdHide?.(ad)}
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>
      {onLoadMore && <LoadMoreFeedButton visible={items.length} total={total} onLoadMore={onLoadMore} />}
    </div>
  );
}

/**
 * A Creator's tip goal, as the fan sees it.
 *
 * The server sends this on the viewer scope alongside the shared view types, which have no goal
 * field — the same arrangement `subscriptionPrice` already uses. It cannot ride on the profile,
 * because the audience profile projection is a strict allowlist and must stay one.
 */
export function noodlerGoalOfProfile(
  scope: unknown,
): { label: string; raised: number; target: number; progress: number; met: boolean } | null {
  const goal = (scope as { goal?: unknown } | null)?.goal;
  if (!goal || typeof goal !== "object") return null;
  const value = goal as Record<string, unknown>;
  if (typeof value.label !== "string" || typeof value.target !== "number" || typeof value.raised !== "number") {
    return null;
  }
  return {
    label: value.label,
    raised: value.raised,
    target: value.target,
    progress: typeof value.progress === "number" ? value.progress : 0,
    met: value.met === true,
  };
}

// ---------------------------------------------------------------------------
// Profile View
// ---------------------------------------------------------------------------

export function StageProfileView({
  profile,
  profileDraft,
  onProfileChange,
  onCancelEdit,
  onSaveEdit,
  profileSavePending,
  posts,
  viewerCreator,
  viewerAccount,
  viewerActorAccount,
  slurpSettings,
  postCardCtx,
  viewerAccounts,
  connectionCounts,
  viewerIsLoading,
  viewerIsError,
  onRetryViewer,
  draft,
  onDraftChange,
  onClearDraft,
  onDiscardDraft,
  isLoading,
  isError,
  onRetry,
  onEdit,
  onBack,
  onManualPost,
  onGuidedPost,
  manualPending,
  guidePending,
  onRunNow,
  runNowPending,
  onUnlock,
  unlockPending,
  onToggleFollow,
  followPending,
  onToggleSubscription,
  subscriptionPending,
  onOpenMessages,
  accessPending,
  onAccessChange,
  composerOpenSignal,
}: {
  profile: SlurpManagedStageProfile;
  profileDraft: SlurpStageProfileInput | null;
  onProfileChange: (patch: Partial<SlurpStageProfileInput>) => void;
  onCancelEdit: () => void;
  onSaveEdit: (location?: string) => void;
  profileSavePending: boolean;
  posts: SlurpProfilePost[];
  viewerCreator: NonNullable<ReturnType<typeof useNoodlerViewer>["data"]>["creators"][number] | null;
  viewerAccount: NoodleAccount | null;
  viewerActorAccount: NoodleAccount | null;
  slurpSettings: ReturnType<typeof useSlurpSettings>["data"] | null;
  postCardCtx: NoodlePostCardCtx;
  viewerAccounts: NoodleAccount[];
  connectionCounts: Record<string, { fans: number; followers: number }>;
  viewerIsLoading: boolean;
  viewerIsError: boolean;
  onRetryViewer: () => void;
  draft: NoodlerPostDraft;
  onDraftChange: (patch: Partial<NoodlerPostDraft>) => void;
  onClearDraft: () => void;
  onDiscardDraft: () => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onEdit: () => void;
  onBack: () => void;
  onManualPost: (input: NoodlerPostSubmission) => Promise<void>;
  onGuidedPost: (input: NoodlerPostSubmission) => Promise<void>;
  manualPending: boolean;
  guidePending: boolean;
  onRunNow: (accountId: string) => void;
  runNowPending: boolean;
  onUnlock: (postId: string) => void;
  unlockPending: boolean;
  onToggleFollow: (creatorAccountId: string, followed: boolean) => void;
  followPending: boolean;
  onToggleSubscription: (creatorAccountId: string, subscribed: boolean) => void;
  subscriptionPending: boolean;
  /** Opens Messages in this Creator's chat. No thread is created until something is sent. */
  onOpenMessages: (creatorAccountId: string) => void;
  accessPending: boolean;
  onAccessChange: (access: SlurpManagedStageProfile["access"]) => void;
  /** Increments each time the profile rail asks the composer to open. */
  composerOpenSignal: number;
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const bannerSrc = useSlurpMediaSrc(profile.bannerUrl, { width: 1280 });
  const [accessSettingsOpen, setAccessSettingsOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  // Open on a Creator this persona operates, where posting is the reason for the visit. On a
  // world-run Creator the tools are still reachable, but they are not what you came to read.
  const [creatorToolsOpen, setCreatorToolsOpen] = useState(
    viewerAccounts.some((account) => account.id === profile.sourceAccountId),
  );
  useEffect(() => {
    if (composerOpenSignal > 0) setCreatorToolsOpen(true);
  }, [composerOpenSignal]);
  const updateAutoPosting = useUpdateNoodlerAutoPosting();
  const updateFanActivity = useUpdateNoodlerFanActivity();
  const tipCreator = useTipSlurpCreator();
  const [tipOpen, setTipOpen] = useState(false);
  // The compose query is the viewer-facing source for action prices and messaging policy.
  const offerMessaging = useSlurpCompose(profile.id, viewerAccount?.entityId ?? null).data?.messaging ?? null;
  const [customTip, setCustomTip] = useState("");
  const [locationDraft, setLocationDraft] = useState(
    () => (profile as SlurpManagedStageProfile & { location?: string }).location ?? "",
  );
  const locationProfileId = useRef(profile.id);
  useEffect(() => {
    if (locationProfileId.current === profile.id) return;
    locationProfileId.current = profile.id;
    setLocationDraft((profile as SlurpManagedStageProfile & { location?: string }).location ?? "");
  }, [profile.id, profile]);
  const uploadProfileAvatar = useUploadNoodlerAvatar();
  const uploadProfileBanner = useUploadNoodlerBanner();
  const generateProfileArtwork = useGenerateNoodlerArtwork();
  const profileAvatarFileRef = useRef<HTMLInputElement | null>(null);
  const profileBannerFileRef = useRef<HTMLInputElement | null>(null);
  const [artworkKind, setArtworkKind] = useState<"avatar" | "banner" | null>(null);
  const [openImagePostId, setOpenImagePostId] = useState<string | null>(null);
  const [artworkGuidance, setArtworkGuidance] = useState("");
  // Global fan controls require a Creator settings route. Keep per-Creator controls available.
  const globalSettings = slurpSettings
    ? {
        fanActivityEnabled: slurpSettings.fanActivityEnabled,
        fanArchetypeWeights: slurpSettings.fanArchetypeWeights,
      }
    : null;
  const autoPosting = profile.autoPosting;
  const [activeTab, setActiveTab] = useState<NoodlerProfileTab>("posts");
  const [revealedManagedPostIds, setRevealedManagedPostIds] = useState<Set<string>>(() => new Set());
  const subscribersQuery = useNoodlerSubscribers(profile.id);
  const followersQuery = useNoodlerFollowers(profile.id);
  const subscribers = subscribersQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const subscriberTotal = subscribersQuery.data?.pages[0]?.total ?? subscribers.length;
  const followerTotal = connectionCounts[profile.id]?.followers ?? 0;
  const profileLikeTotal = posts.reduce((total, post) => total + (post.likeCount ?? 0), 0);
  const latestActivityAt = posts.reduce((latest, post) => Math.max(latest, Date.parse(post.createdAt)), 0);
  const viewingOwnCreator = profile.sourceAccountId === viewerAccount?.entityId;
  const creatorStatus = viewingOwnCreator
    ? "online"
    : slurpCreatorStatus({
        lastActiveAt: latestActivityAt || null,
        autoPostingEnabled: profile.autoPosting.enabled,
      });
  const profileLocation = (profile as SlurpManagedStageProfile & { location?: string }).location ?? "";
  const profileBioBody = profile.bio.trim();
  const accent = profileAccent(profile.id);
  const personaBackedCreator = viewerAccounts.some((account) => account.id === profile.sourceAccountId);
  const accessViewerAccounts = viewerAccounts.filter((account) => account.id !== profile.sourceAccountId);
  // Every Slurp Creator profile is operator-managed, so post controls and artwork editing stay
  // available regardless of which viewer persona is looking at the profile.
  const managedCreator = true;
  // The goal the audience sees. It rides on the viewer scope beside `subscriptionPrice`, because
  // the audience profile projection is a strict allowlist and must stay that way.
  const goalForViewer = noodlerGoalOf(viewerCreator);
  const arcsQuery = useSlurpArcs(viewerAccount?.entityId ?? null, profile.id);
  const editing = Boolean(profileDraft);
  const editDraft = profileDraft ?? {
    displayName: profile.displayName,
    handle: profile.handle,
    bio: profile.bio,
    stagePersonality: profile.stagePersonality,
    disclosureMode: profile.disclosureMode ?? "hinted",
    gender: profile.gender,
    tags: profile.tags,
  };
  const viewerPostById = new Map((viewerCreator?.posts ?? []).map((post) => [post.id, post]));
  const projectedPosts = posts.flatMap((entry) => {
    const managedPost = "managed" in entry ? entry.managed : null;
    const entryViewerPost = entry.viewerPost;
    if (!managedPost && !entryViewerPost) return [];
    if (!managedPost) {
      return entryViewerPost.locked
        ? [{ kind: "locked" as const, post: entryViewerPost }]
        : [{ kind: "card" as const, model: toNoodlePostCardModel(entryViewerPost, profile) }];
    }
    const viewerPost = viewerPostById.get(managedPost.id) ?? entryViewerPost;
    if (revealedManagedPostIds.has(managedPost.id)) {
      return [
        {
          kind: "managed-reveal" as const,
          model: toManagedPostCardModel(managedPost, profile),
        },
      ];
    }
    if (!viewerPost) {
      return [
        {
          kind: "controller-locked" as const,
          post: managedPost,
        },
      ];
    }
    return viewerPost.locked
      ? [{ kind: "locked" as const, post: { ...viewerPost, imagePrompt: managedPost.imagePrompt } }]
      : [{ kind: "card" as const, model: toNoodlePostCardModel(viewerPost, profile) }];
  });
  const visiblePosts = projectedPosts.filter((item) => {
    const post = item.kind === "locked" || item.kind === "controller-locked" ? item.post : item.model;
    const story = isSlurpStory(post);
    if (activeTab === "stories") return story;
    if (activeTab === "posts") return !story;
    return false;
  });
  const imagePosts = projectedPosts.flatMap<SlurpProfileImagePost>((item) => {
    if (item.kind !== "card" && item.kind !== "managed-reveal") return [];
    return !isSlurpStory(item.model) && typeof item.model.imageUrl === "string"
      ? [{ ...item.model, imageUrl: item.model.imageUrl }]
      : [];
  });
  const featuredPost = imagePosts[0] ?? null;
  const openImagePost = openImagePostId ? (imagePosts.find((post) => post.id === openImagePostId) ?? null) : null;
  const emptyTabTitle =
    activeTab === "media"
      ? localizeUi("ui.slurp.profile.emptyMedia")
      : activeTab === "stories"
        ? localizeUi("ui.slurp.profile.emptyStories")
        : localizeUi("ui.noodle.stageprofileview.noNoodlerPostsYet");
  const cards = (
    <>
      {activeTab === "subscribers" ? (
        <div>
          <div className="border-b border-[var(--noodle-divider)] bg-[var(--slurp-surface-raised,var(--background))] px-4 py-4 sm:px-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--noodle-accent)]">
              {localizeUi("ui.slurp.profile.managementData")}
            </p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.profile.managementDataDetail")}
            </p>
          </div>
          {subscribersQuery.isLoading ? (
            <div
              className="flex justify-center py-12"
              role="status"
              aria-label={localizeUi("ui.noodle.stageprofileview.loadingSubscribers")}
            >
              <Loader2 size={22} className="animate-spin text-[var(--noodle-accent)]" />
            </div>
          ) : subscribersQuery.isError ? (
            <EmptyState
              title={localizeUi("ui.noodle.stageprofileview.subscribersCouldNotBeLoaded")}
              action={localizeUi("capabilities.actions.tryAgain")}
              onAction={() => void subscribersQuery.refetch()}
              icon={TriangleAlert}
            />
          ) : subscribers.length > 0 ? (
            <div>
              {subscribers.map((subscriber) => (
                <div
                  key={subscriber.id}
                  className="flex min-h-16 items-center gap-3 border-b border-[var(--noodle-divider)] px-4 py-3"
                >
                  <Avatar account={subscriber} />
                  <div className="min-w-0 flex-1">
                    {subscriber.audience ? (
                      <SlurpFanCard memberId={subscriber.id} creatorAccountId={profile.id} className="block min-w-0">
                        <p className="truncate text-sm font-bold">{subscriber.displayName}</p>
                      </SlurpFanCard>
                    ) : (
                      <p className="truncate text-sm font-bold">{subscriber.displayName}</p>
                    )}
                    <p className="truncate text-xs text-[var(--muted-foreground)]">@{subscriber.handle}</p>
                  </div>
                  <time dateTime={subscriber.subscribedAt} className="shrink-0 text-xs text-[var(--muted-foreground)]">
                    {new Date(subscriber.subscribedAt).toLocaleDateString(i18n.language)}
                  </time>
                </div>
              ))}
              {subscribersQuery.hasNextPage && (
                <div className="flex justify-center p-4">
                  <button
                    type="button"
                    onClick={() => void subscribersQuery.fetchNextPage()}
                    disabled={subscribersQuery.isFetchingNextPage}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--noodle-divider)] px-4 text-sm font-bold hover:bg-[var(--accent)] disabled:opacity-50"
                  >
                    {subscribersQuery.isFetchingNextPage && <Loader2 size={14} className="animate-spin" />}
                    {localizeUi("ui.noodle.noodlehome.loadMore", {
                      visible: subscribers.length,
                      total: subscriberTotal,
                    })}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title={localizeUi("ui.noodle.stageprofileview.noSubscribersYet")}
              detail={localizeUi("ui.noodle.stageprofileview.subscribersEmptyDetail")}
            />
          )}
        </div>
      ) : activeTab === "followers" ? (
        <div>
          {/* Followers were a number everywhere and a list nowhere. The funnel held the people all
              along; the named cast is capped, so the rest stays the count in the header. */}
          {followersQuery.isLoading ? (
            <div className="flex justify-center py-12" role="status">
              <Loader2 size={22} className="animate-spin text-[var(--noodle-accent)]" />
            </div>
          ) : (followersQuery.data?.items.length ?? 0) > 0 ? (
            <div>
              {followersQuery.data!.items.map((follower) => (
                <div
                  key={follower.id}
                  className="flex min-h-16 items-center gap-3 border-b border-[var(--noodle-divider)] px-4 py-3"
                >
                  <Avatar account={follower} />
                  <div className="min-w-0 flex-1">
                    <SlurpFanCard memberId={follower.id} creatorAccountId={profile.id} className="block min-w-0">
                      <p className="truncate text-sm font-bold">{follower.displayName}</p>
                    </SlurpFanCard>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">
                      {[
                        `@${follower.handle}`,
                        localizeUi(`ui.slurp.studio.stage.${follower.stage}`, { defaultValue: follower.stage }),
                        ...follower.traits,
                      ].join(" · ")}
                    </p>
                  </div>
                </div>
              ))}
              <p className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.slurp.profile.followersRemainder", {
                  count: Math.max(0, (followersQuery.data?.total ?? 0) - followersQuery.data!.items.length),
                })}
              </p>
            </div>
          ) : (
            <EmptyState title={localizeUi("ui.slurp.profile.followersEmpty")} />
          )}
        </div>
      ) : viewerIsLoading || isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={22} className="animate-spin text-[var(--noodle-accent)]" />
        </div>
      ) : viewerIsError ? (
        <EmptyState
          title={localizeUi("ui.noodle.stageprofileview.viewerAccessCouldNotBeLoaded")}
          action={localizeUi("capabilities.actions.tryAgain")}
          onAction={onRetryViewer}
          icon={TriangleAlert}
        />
      ) : isError ? (
        <EmptyState
          title={localizeUi("ui.noodle.stageprofileview.noodlerPostsCouldNotBeLoaded")}
          action={localizeUi("capabilities.actions.tryAgain")}
          onAction={onRetry}
          icon={TriangleAlert}
        />
      ) : activeTab === "media" ? (
        imagePosts.length > 0 ? (
          <div className="grid grid-cols-2 gap-px bg-[var(--noodle-divider)] @min-[620px]:grid-cols-3">
            {imagePosts.map((post) => (
              <SlurpProfileMediaTile key={post.id} post={post} onOpenImage={(_url, id) => setOpenImagePostId(id)} />
            ))}
          </div>
        ) : (
          <EmptyState title={emptyTabTitle} />
        )
      ) : visiblePosts.length > 0 ? (
        visiblePosts.map((item) => {
          const itemId = item.kind === "locked" || item.kind === "controller-locked" ? item.post.id : item.model.id;
          const locked = item.kind === "locked" || item.kind === "controller-locked";
          return (
            <SlurpAccessTransition key={itemId} postId={itemId} locked={locked}>
              {item.kind === "locked" || item.kind === "controller-locked" ? (
                <div className="p-3 @min-[680px]:px-0">
                  <LockedSlurpPostCard
                    post={item.post}
                    profile={profile}
                    subscriptionPrice={viewerCreator?.subscriptionPrice}
                    controllerOnly={item.kind === "controller-locked"}
                    subscribed={viewerCreator?.subscribed ?? false}
                    unlockPending={unlockPending}
                    subscriptionPending={subscriptionPending}
                    onUnlock={onUnlock}
                    onToggleSubscription={onToggleSubscription}
                    onManage={() => {
                      setRevealedManagedPostIds((current) => {
                        const next = new Set(current);
                        next.add(item.post.id);
                        return next;
                      });
                    }}
                    onGenerateImage={
                      item.post.imagePrompt
                        ? () =>
                            postCardCtx.generatePostImage?.({
                              id: item.post.id,
                              authorAccountId: item.post.authorAccountId,
                            })
                        : undefined
                    }
                    imageGenerationPending={postCardCtx.generatingPostImageId === item.post.id}
                  />
                </div>
              ) : item.kind === "managed-reveal" ? (
                <div>
                  <div className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--noodle-divider)] bg-[var(--noodle-accent)]/5 px-4">
                    <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                      {localizeUi("ui.noodle.stageprofileview.controllerViewHiddenFrom")}{" "}
                      {viewerAccount?.displayName ?? localizeUi("ui.noodle.stageprofileview.thisViewer")}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setRevealedManagedPostIds((current) => {
                          const next = new Set(current);
                          next.delete(item.model.id);
                          return next;
                        })
                      }
                      className="min-h-11 shrink-0 px-2 text-xs font-bold text-[var(--noodle-accent)]"
                    >
                      {localizeUi("ui.noodle.stageprofileview.hide")}
                    </button>
                  </div>
                  <SlurpCreatorPostCard
                    surface="profile"
                    post={item.model}
                    ctx={{ ...postCardCtx, personaAccount: null, postManagement: managedCreator }}
                  />
                </div>
              ) : (
                <SlurpCreatorPostCard
                  surface="profile"
                  post={item.model}
                  ctx={{
                    ...postCardCtx,
                    personaAccount: viewerActorAccount,
                    postManagement: managedCreator,
                  }}
                />
              )}
            </SlurpAccessTransition>
          );
        })
      ) : (
        <EmptyState title={emptyTabTitle} />
      )}
    </>
  );
  return (
    <>
      <SlurpProfileSurface
        mobileHeader={
          <button
            type="button"
            onClick={onBack}
            className="absolute start-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-lg bg-black/50 text-white backdrop-blur-sm hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white @min-[1024px]:hidden"
            title={localizeUi("ui.slurp.profile.back")}
            aria-label={localizeUi("ui.slurp.profile.back")}
          >
            <ChevronLeft size={22} className="rtl:-scale-x-100" />
          </button>
        }
        account={profile}
        displayHandle={editing ? editDraft.handle : profile.handle}
        handleMeta={
          <>
            {profile.disclosureMode === "hinted" && profile.publicIdentity ? (
              <HelpTooltip
                label={localizeUi("ui.noodle.disclosure.hinted.shortLabel")}
                side="bottom"
                buttonClassName="border border-[var(--noodle-divider)] px-2 py-0.5 text-[0.68rem] font-bold text-[var(--muted-foreground)] opacity-100 [&_svg]:hidden"
                text={
                  <span>
                    <span className="block font-bold text-[var(--popover-foreground)]">
                      {localizeUi("ui.noodle.disclosure.open.label")}
                    </span>
                    <span className="mt-1 block">
                      {profile.publicIdentity.displayName} (@{profile.publicIdentity.handle})
                    </span>
                  </span>
                }
              />
            ) : (
              <DisclosureBadge
                mode={profile.disclosureMode}
                detail={
                  profile.disclosureMode === "open" && profile.publicIdentity
                    ? localizeUi("ui.slurp.disclosure.openLinkedDetail", {
                        name: profile.publicIdentity.displayName,
                        handle: profile.publicIdentity.handle,
                      })
                    : undefined
                }
              />
            )}
          </>
        }
        // A creator inherits a banner from its source at creation (open/hinted only); without
        // one the shell keeps its plain accent band.
        banner={{
          url: bannerSrc,
          canEdit: editing,
          uploadTarget: uploadProfileBanner.isPending ? "banner" : null,
          fileRef: profileBannerFileRef,
          onFileChange: (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            uploadProfileBanner.mutate(
              { accountId: profile.id, file },
              {
                onError: (error) => toast.error(errorMessage(error, localizeUi("ui.slurp.artwork.bannerUploadError"))),
              },
            );
          },
          onGenerate: () => {
            setArtworkGuidance("");
            setArtworkKind("banner");
          },
        }}
        avatarUpload={{
          canEdit: editing,
          uploadTarget: uploadProfileAvatar.isPending ? "avatar" : null,
          fileRef: profileAvatarFileRef,
          onFileChange: (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            uploadProfileAvatar.mutate(
              { accountId: profile.id, file },
              {
                onError: (error) => toast.error(errorMessage(error, localizeUi("ui.slurp.artwork.avatarUploadError"))),
              },
            );
          },
          onGenerate: () => {
            setArtworkGuidance("");
            setArtworkKind("avatar");
          },
        }}
        decorativeBanner={false}
        editor={{
          isEditing: editing,
          onStartEditing: onEdit,
          onCancel: onCancelEdit,
          onSave: () => onSaveEdit(locationDraft),
          canSave: Boolean(editDraft.displayName.trim() && editDraft.handle.trim()),
          isSaving: profileSavePending,
          name: editDraft.displayName,
          onNameChange: (value) => onProfileChange({ displayName: value }),
          handle: editDraft.handle,
          onHandleChange: (value) => onProfileChange({ handle: value }),
          bio: editDraft.bio,
          onBioChange: (value) => onProfileChange({ bio: value }),
          location: locationDraft,
          onLocationChange: setLocationDraft,
          privateFields: (
            <div className="space-y-3">
              <SlurpDiscoveryProfileEditor
                gender={editDraft.gender}
                tags={editDraft.tags}
                disabled={profileSavePending}
                onChange={onProfileChange}
              />
              <div className="space-y-3 rounded-xl border border-[var(--noodle-divider)] bg-[var(--accent)]/35 p-4">
                <div>
                  <p className="text-sm font-bold">{localizeUi("ui.noodle.stageprofileform.stageVoice")}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                    {localizeUi("ui.noodle.stageprofileform.voiceAttitudeBoundariesAndCreatorPersona")}
                  </p>
                  <textarea
                    value={editDraft.stagePersonality}
                    maxLength={1000}
                    onChange={(event) => onProfileChange({ stagePersonality: event.target.value })}
                    className="mt-2 min-h-24 w-full resize-y rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] p-3 text-sm outline-none focus:border-[var(--noodle-accent)]"
                  />
                </div>
                <AudienceStancePresets
                  disabled={profileSavePending}
                  onApply={(sentence) =>
                    onProfileChange({ stagePersonality: appendAudienceStance(editDraft.stagePersonality, sentence) })
                  }
                />
              </div>
            </div>
          ),
        }}
        leadingActions={
          !editing && !viewingOwnCreator && viewerCreator ? (
            <>
              {!viewerCreator.subscribed && (
                <button
                  type="button"
                  disabled={followPending}
                  onClick={() => onToggleFollow(profile.id, viewerCreator.followed)}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--noodle-divider)] text-[var(--noodle-accent)] transition-[background-color,opacity,transform] hover:bg-[var(--accent)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={
                    viewerCreator.followed
                      ? localizeUi("ui.noodle.connections.tabs.following")
                      : localizeUi("ui.slurp.profile.follow")
                  }
                  aria-pressed={viewerCreator.followed}
                  title={
                    viewerCreator.followed
                      ? localizeUi("ui.noodle.connections.tabs.following")
                      : localizeUi("ui.slurp.profile.follow")
                  }
                >
                  {viewerCreator.followed ? <BookmarkCheck size={19} /> : <BookmarkPlus size={19} />}
                </button>
              )}
              <button
                type="button"
                disabled={subscriptionPending}
                onClick={() =>
                  void (async () => {
                    // One click used to cancel a paid subscription with no warning.
                    if (
                      viewerCreator.subscribed &&
                      !(await showConfirmDialog({
                        title: localizeUi("ui.slurp.profile.cancelSubscription", {
                          defaultValue: "Cancel subscription?",
                        }),
                        message: localizeUi("ui.slurp.profile.cancelSubscriptionDetail", {
                          defaultValue:
                            "You keep subscriber access until the week you already paid for ends. It will not renew after that.",
                        }),
                        confirmLabel: localizeUi("ui.slurp.profile.cancelSubscriptionConfirm", {
                          defaultValue: "Cancel subscription",
                        }),
                        tone: "destructive",
                      }))
                    )
                      return;
                    await Promise.resolve(onToggleSubscription(profile.id, viewerCreator.subscribed)).catch(
                      () => undefined,
                    );
                  })()
                }
                className={cn(
                  "relative inline-flex min-h-11 items-center justify-center overflow-visible rounded-lg px-5 text-sm font-bold transition-[background-color,opacity,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50",
                  viewerCreator.subscribed
                    ? "border border-[var(--noodle-accent)]/50 bg-[var(--noodle-accent)]/10 text-[var(--noodle-accent-foreground)] hover:bg-[var(--noodle-accent)]/15"
                    : "bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90",
                )}
              >
                <SlurpCoinBurst active={subscriptionPending && !viewerCreator.subscribed} />
                {viewerCreator.subscribed
                  ? localizeUi("ui.slurp.profile.subscribed")
                  : localizeUi("ui.slurp.profile.subscribe")}
                {!viewerCreator.subscribed && (
                  <>
                    {" · "}
                    <SlurpCoinAmount amount={`${slurpSubscriptionPriceOf(profile)} / week`} />
                  </>
                )}
              </button>
              {!viewerCreator.subscribed && (
                <span className="max-w-52 text-[0.68rem] leading-4 text-[var(--muted-foreground)]">
                  {localizeUi("ui.slurp.profile.subscribeBenefits", {
                    defaultValue: "Faster replies · Free chat photos · Subscriber-only posts",
                  })}
                </span>
              )}
              <button
                type="button"
                disabled={offerMessaging?.dmPolicy === "closed"}
                onClick={() => onOpenMessages(profile.id)}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[var(--noodle-divider)] px-4 text-sm font-bold transition-[background-color,opacity,transform] hover:bg-[var(--accent)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <MessageCircle size={16} aria-hidden="true" />
                {offerMessaging?.dmPolicy === "paid" && !viewerCreator.subscribed && offerMessaging.requestFee > 0
                  ? localizeUi("ui.slurp.profile.requestMessage", {
                      defaultValue: "Request message · {{count}} coins",
                      count: offerMessaging.requestFee,
                    })
                  : offerMessaging?.dmPolicy === "closed"
                    ? localizeUi("ui.slurp.profile.messagingUnavailable", { defaultValue: "Messaging unavailable" })
                    : localizeUi("ui.slurp.profile.message", { defaultValue: "Message" })}
              </button>
              <div className="relative">
                <button
                  type="button"
                  disabled={tipCreator.isPending}
                  onClick={() => setTipOpen((open) => !open)}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--noodle-divider)] px-4 text-sm font-bold transition-[background-color,opacity,transform] hover:bg-[var(--accent)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50"
                >
                  {localizeUi("ui.slurp.profile.tip", { defaultValue: "Tip" })}
                </button>
                {tipOpen && (
                  <div className="absolute end-0 top-[calc(100%+0.5rem)] z-20 w-56 rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] p-3 shadow-xl">
                    <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                      {localizeUi("ui.slurp.profile.tipAmount", { defaultValue: "Tip amount" })}
                    </p>
                    <div className="mt-2 grid grid-cols-4 gap-1.5">
                      {[1, 5, 10, 25].map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => {
                            if (!viewerAccount?.entityId) return;
                            tipCreator.mutate({
                              accountId: profile.id,
                              personaId: viewerAccount.entityId,
                              amount,
                              requestId:
                                typeof crypto !== "undefined" && "randomUUID" in crypto
                                  ? crypto.randomUUID()
                                  : `${Date.now()}-${Math.random()}`,
                            });
                            setTipOpen(false);
                          }}
                          className="min-h-9 rounded-md bg-[var(--accent)] text-xs font-bold hover:bg-[var(--noodle-accent)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
                        >
                          {amount}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={9999}
                        value={customTip}
                        onChange={(event) => setCustomTip(event.target.value)}
                        aria-label={localizeUi("ui.slurp.profile.customTip", { defaultValue: "Custom tip amount" })}
                        className="min-w-0 flex-1 rounded-md border border-[var(--noodle-divider)] bg-[var(--background)] px-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={
                          !viewerAccount?.entityId || !Number.isInteger(Number(customTip)) || Number(customTip) < 1
                        }
                        onClick={() => {
                          if (!viewerAccount?.entityId) return;
                          tipCreator.mutate({
                            accountId: profile.id,
                            personaId: viewerAccount.entityId,
                            amount: Number(customTip),
                            requestId:
                              typeof crypto !== "undefined" && "randomUUID" in crypto
                                ? crypto.randomUUID()
                                : `${Date.now()}-${Math.random()}`,
                          });
                          setCustomTip("");
                          setTipOpen(false);
                        }}
                        className="min-h-9 rounded-md bg-[var(--noodle-accent)] px-2 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-50"
                      >
                        {localizeUi("ui.slurp.profile.sendTip", { defaultValue: "Send" })}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null
        }
        status={creatorStatus}
        stats={{ followers: followerTotal, subscribers: subscriberTotal, likes: profileLikeTotal }}
        location={profileLocation}
        bioContent={profileBioBody ? <p className="whitespace-pre-wrap text-sm leading-6">{profileBioBody}</p> : null}
        bioCollapsible={profileBioBody.length > 280 || profileBioBody.split("\n").length > 4}
        contentActions={null}
        tabs={[
          {
            id: "posts",
            label: `${localizeUi("ui.noodle.profile.tabs.posts")} (${posts.filter((post) => !isSlurpStory(post)).length})`,
          },
          {
            id: "media",
            label: `${localizeUi("ui.noodle.profile.tabs.media")} (${posts.filter((post) => Boolean(post.imageUrl)).length})`,
          },
          { id: "stories", label: `${localizeUi("ui.slurp.stories.archive")} (${posts.filter(isSlurpStory).length})` },
          {
            id: "subscribers",
            label: localizeUi("ui.noodle.stageProfile.tabs.subscribers", {
              count: subscribersQuery.data ? subscriberTotal : "…",
            }),
            ariaLabel: localizeUi("ui.noodle.stageProfile.tabs.subscribersAria", {
              count: subscribersQuery.data ? subscriberTotal : localizeUi("ui.noodle.stageProfile.tabs.loading"),
            }),
            management: true,
          },
          {
            id: "followers",
            label: localizeUi("ui.slurp.profile.tabs.followers", { count: followerTotal }),
            management: true,
          },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        editorActionInPreTabs
        preTabsContent={
          <>
            {/* Both, never either: a set tip goal used to take this slot and hide the composer,
              so Create post and Add story opened nothing while still leaving a draft behind. */}
            {goalForViewer && !editing && (
              <section className="border-b border-[var(--noodle-divider)] bg-[var(--slurp-surface)] px-4 py-3 sm:px-6">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-xs font-bold">{goalForViewer.label}</p>
                  <p className="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">
                    {goalForViewer.met
                      ? localizeUi("ui.slurp.profile.goalMet", { defaultValue: "Goal met" })
                      : localizeUi("ui.slurp.profile.goalProgress", {
                          defaultValue: "{{raised}} / {{target}}",
                          raised: goalForViewer.raised.toLocaleString(),
                          target: goalForViewer.target.toLocaleString(),
                        })}
                  </p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--accent)]">
                  <div
                    className="h-full rounded-full bg-[var(--noodle-accent)] transition-[width] motion-reduce:transition-none"
                    style={{ width: `${Math.round(goalForViewer.progress * 100)}%` }}
                  />
                </div>
              </section>
            )}
            {!editing && arcsQuery.data && (
              <SlurpArcTimelineCard
                arcs={arcsQuery.data.arcs}
                onOpenPost={postCardCtx.openPost}
                onOpenProfile={postCardCtx.openAuthorProfile}
              />
            )}
            {managedCreator && !editing && (
              <section data-slurp-creator-tools className="min-w-0">
                {/* Open by default: this panel only renders on a creator you own, and posting is
                  what you came here to do. The line above it still collapses the whole thing. */}
                <div className="flex h-11 items-stretch">
                  <button
                    type="button"
                    onClick={() => setCreatorToolsOpen((open) => !open)}
                    aria-expanded={creatorToolsOpen}
                    aria-controls="slurp-creator-tools-panel"
                    title={localizeUi("ui.slurp.profile.creatorToolsDetail")}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-s-2xl px-3 text-start text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
                  >
                    <Sparkles size={13} className="shrink-0 text-[var(--muted-foreground)]" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{localizeUi("ui.slurp.profile.creatorTools")}</span>
                    {viewingOwnCreator && (
                      <span className="hidden shrink-0 text-[0.68rem] font-semibold text-[var(--muted-foreground)] lg:inline">
                        {localizeUi("ui.noodle.stageprofileview.yourProfile")}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onEdit}
                    className="group/edit flex min-h-11 items-center px-2 text-xs font-bold text-[var(--noodle-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
                  >
                    <span className="rounded-lg bg-[color-mix(in_srgb,var(--noodle-accent)_18%,transparent)] px-2.5 py-1.5 transition-[background-color,transform] group-hover/edit:bg-[color-mix(in_srgb,var(--noodle-accent)_26%,transparent)] group-active/edit:scale-[0.96] motion-reduce:transition-none motion-reduce:group-active/edit:scale-100">
                      {localizeUi("ui.noodle.stageprofileview.editProfile")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatorToolsOpen((open) => !open)}
                    aria-expanded={creatorToolsOpen}
                    aria-controls="slurp-creator-tools-panel"
                    aria-label={localizeUi("ui.slurp.profile.creatorTools")}
                    className="flex w-11 shrink-0 items-center justify-center rounded-e-2xl text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
                  >
                    <ChevronDown
                      size={16}
                      strokeWidth={2.5}
                      className={cn(
                        "transition-transform motion-reduce:transition-none",
                        creatorToolsOpen && "rotate-180",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </div>
                <div
                  id="slurp-creator-tools-panel"
                  hidden={!creatorToolsOpen}
                  className="mt-1 rounded-xl bg-[var(--background)] shadow-inner ring-1 ring-inset ring-[var(--noodle-divider)]"
                >
                  {/* Edit lives on the profile header with Follow and Subscribe. It used to be
                    duplicated here too, which gave the same action two homes and made this panel
                    look like the place to go. */}
                  <div className="flex flex-wrap gap-2 px-3 py-2 @min-[760px]:px-4">
                    <button
                      type="button"
                      onClick={() => setAccessSettingsOpen(true)}
                      className="min-h-11 rounded-lg border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
                    >
                      {localizeUi("ui.noodle.stageprofileview.access")}
                    </button>
                    {!personaBackedCreator && (
                      <button
                        type="button"
                        onClick={() => setAutomationOpen(true)}
                        className="min-h-11 rounded-lg border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
                      >
                        {autoPosting.enabled
                          ? localizeUi("ui.noodle.stageprofileview.automationOn")
                          : localizeUi("ui.noodle.stageprofileview.automation")}
                      </button>
                    )}
                  </div>
                  <NoodlerPostComposer
                    key={profile.id}
                    profile={profile}
                    openSignal={composerOpenSignal}
                    availablePosts={posts}
                    draft={draft}
                    onDraftChange={onDraftChange}
                    onClearDraft={onClearDraft}
                    onDiscardDraft={onDiscardDraft}
                    onManualPost={onManualPost}
                    onGuidedPost={onGuidedPost}
                    manualPending={manualPending}
                    guidePending={guidePending}
                  />
                </div>
              </section>
            )}
          </>
        }
        featuredContent={
          featuredPost && !bannerSrc && activeTab === "posts" ? (
            <div className="border-b border-[var(--noodle-divider)] bg-[var(--noodle-accent)]/[0.04] px-4 py-4 sm:px-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--noodle-accent)]">
                  {localizeUi("ui.slurp.profile.featuredDrop")}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">{profile.displayName}</span>
              </div>
              <SlurpProfileFeaturedImage post={featuredPost} onOpenImage={(_url, id) => setOpenImagePostId(id)} />
            </div>
          ) : null
        }
        postList={cards}
        accent={profileAccent(profile.id)}
        spotlight
      />
      {openImagePost && (
        <SlurpPostDialog
          post={openImagePost}
          ctx={{ ...postCardCtx, openPost: undefined }}
          onClose={() => setOpenImagePostId(null)}
        />
      )}
      <Modal
        open={artworkKind !== null}
        onClose={() => setArtworkKind(null)}
        title={localizeUi(
          artworkKind === "banner" ? "ui.slurp.artwork.generateBanner" : "ui.slurp.artwork.generateAvatar",
        )}
        width="max-w-lg"
        closeDisabled={generateProfileArtwork.isPending}
        panelClassName="noodle-icon-scope"
        panelStyle={getNoodleAccentStyle(accent, {
          "--background": "var(--slurp-surface)",
          "--foreground": "var(--slurp-text)",
          "--muted-foreground": "var(--slurp-muted)",
          "--border": "color-mix(in srgb, var(--noodle-accent) 24%, transparent)",
          "--accent": "color-mix(in srgb, var(--noodle-accent) 12%, transparent)",
        })}
      >
        <div className="space-y-4">
          <label className="block space-y-2 text-sm font-semibold">
            <span>{localizeUi("ui.slurp.artwork.guidanceLabel")}</span>
            <textarea
              value={artworkGuidance}
              onChange={(event) => setArtworkGuidance(event.target.value)}
              maxLength={2000}
              placeholder={
                artworkKind === "banner"
                  ? localizeUi("ui.slurp.artwork.bannerPlaceholder")
                  : localizeUi("ui.slurp.artwork.avatarPlaceholder")
              }
              className="min-h-32 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm font-normal outline-none focus:border-[var(--noodle-accent)]"
            />
          </label>
          <p className="text-xs leading-5 text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.artwork.guidanceHelp")}
          </p>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              disabled={generateProfileArtwork.isPending}
              onClick={() => setArtworkKind(null)}
              className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-xs font-semibold"
            >
              {localizeUi("ui.slurp.artwork.cancel")}
            </button>
            <button
              type="button"
              disabled={generateProfileArtwork.isPending || !artworkKind}
              onClick={() => {
                if (!artworkKind) return;
                generateProfileArtwork.mutate(
                  { accountId: profile.id, kind: artworkKind, guidance: artworkGuidance.trim() || undefined },
                  {
                    onSuccess: () => {
                      toast.success(
                        localizeUi(
                          artworkKind === "banner"
                            ? "ui.slurp.artwork.bannerGenerated"
                            : "ui.slurp.artwork.avatarGenerated",
                        ),
                      );
                      setArtworkKind(null);
                    },
                    onError: (error) => toast.error(errorMessage(error, localizeUi("ui.slurp.artwork.generateError"))),
                  },
                );
              }}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-50"
            >
              {generateProfileArtwork.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              {localizeUi("ui.slurp.artwork.generate")}
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        open={accessSettingsOpen}
        onClose={() => setAccessSettingsOpen(false)}
        title={localizeUi("ui.noodle.stageprofileview.viewerAccess")}
        width="max-w-md"
        panelStyle={getNoodleAccentStyle(accent)}
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs leading-5 text-[var(--muted-foreground)]">
              {localizeUi("ui.noodle.stageprofileview.theseRulesApplyOnlyToThisStageProfile")}
            </p>
            {accessPending && <Loader2 size={16} className="shrink-0 animate-spin text-[var(--noodle-accent)]" />}
          </div>
          {accessViewerAccounts.length > 0 && (
            <fieldset>
              <legend className="text-xs font-bold">
                {localizeUi("ui.noodle.stageprofileview.hiddenFromPersonas")}
              </legend>
              <div className="mt-2 divide-y divide-[var(--noodle-divider)] rounded-lg border border-[var(--noodle-divider)]">
                {accessViewerAccounts.map((account) => {
                  const checked = profile.access.hiddenFromAccountIds.includes(account.id);
                  return (
                    <label key={account.id} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
                      <span className="truncate text-xs font-semibold">{account.displayName}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={accessPending}
                        onChange={(event) =>
                          onAccessChange({
                            ...profile.access,
                            hiddenFromAccountIds: event.target.checked
                              ? [...profile.access.hiddenFromAccountIds, account.id]
                              : profile.access.hiddenFromAccountIds.filter((id) => id !== account.id),
                          })
                        }
                        className="h-5 w-5 accent-[var(--noodle-accent)]"
                      />
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
        </div>
      </Modal>
      <Modal
        open={automationOpen && !personaBackedCreator}
        onClose={() => setAutomationOpen(false)}
        title={localizeUi("ui.noodle.stageprofileview.automaticPosting")}
        width="max-w-md"
        panelStyle={getNoodleAccentStyle(accent)}
      >
        <div className="space-y-4">
          <p className="text-xs leading-5 text-[var(--muted-foreground)]">
            {localizeUi("ui.noodle.stageprofileview.whenOnThisCreatorPostsOnItsOwnWhile")}
          </p>
          <p className="text-xs leading-5 text-[var(--muted-foreground)]">
            {localizeUi("ui.noodle.stageprofileview.automaticPostingProviderDisclosure")}
          </p>
          <button
            type="button"
            onClick={() => {
              setAutomationOpen(false);
              onEdit();
            }}
            className="h-9 w-full rounded-full border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)]"
          >
            {localizeUi("ui.noodle.stageprofileview.editBioStageVoice")}
          </button>
          <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-[var(--noodle-divider)] px-3 py-2">
            <span className="text-xs font-bold">
              {localizeUi("ui.noodle.stageprofileview.automaticPostingEnabled")}
            </span>
            <input
              type="checkbox"
              checked={autoPosting.enabled}
              disabled={updateAutoPosting.isPending}
              onChange={(event) =>
                updateAutoPosting.mutate(
                  { accountId: profile.id, enabled: event.target.checked },
                  {
                    onError: (error) =>
                      toast.error(
                        errorMessage(error, localizeUi("ui.noodle.stageprofileview.couldNotUpdateAutomaticPosting")),
                      ),
                  },
                )
              }
              className="h-5 w-5 accent-[var(--noodle-accent)]"
            />
          </label>
          <fieldset disabled={updateAutoPosting.isPending} className="space-y-2 disabled:opacity-50">
            <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-[var(--noodle-divider)] px-3 py-2">
              <span className="text-xs font-bold">
                {localizeUi("ui.noodle.stageprofileview.generateAnImageWithPosts")}
              </span>
              <input
                type="checkbox"
                checked={autoPosting.imagesEnabled}
                onChange={(event) =>
                  updateAutoPosting.mutate(
                    { accountId: profile.id, imagesEnabled: event.target.checked },
                    {
                      onError: (error) =>
                        toast.error(
                          errorMessage(error, localizeUi("ui.noodle.stageprofileview.couldNotUpdateImageGeneration")),
                        ),
                    },
                  )
                }
                className="h-5 w-5 accent-[var(--noodle-accent)]"
              />
            </label>
          </fieldset>
          <fieldset disabled={updateFanActivity.isPending} className="space-y-3 disabled:opacity-50">
            <legend className="text-xs font-bold">{localizeUi("ui.noodle.noodlerfanactivity.creatorTitle")}</legend>
            <label className="block space-y-1 text-xs font-semibold">
              <span className="text-[var(--muted-foreground)]">
                {localizeUi("ui.noodle.noodlerfanactivity.creatorMode")}
              </span>
              <select
                value={
                  profile.fanActivity?.enabled === true
                    ? "on"
                    : profile.fanActivity?.enabled === false
                      ? "off"
                      : "inherit"
                }
                onChange={(event) => {
                  const mode = event.target.value;
                  updateFanActivity.mutate(
                    {
                      accountId: profile.id,
                      fanActivity: mode === "inherit" ? null : { ...profile.fanActivity, enabled: mode === "on" },
                    },
                    {
                      onError: (error) =>
                        toast.error(
                          errorMessage(error, localizeUi("ui.noodle.noodlerfanactivity.couldNotUpdateCreator")),
                        ),
                    },
                  );
                }}
                className="h-9 w-full rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] px-2"
              >
                {/* "Use global defaults" is meaningless without saying what that resolves to
                    right now, which used to mean leaving the Creator to go and look. */}
                <option value="inherit">
                  {globalSettings
                    ? localizeUi("ui.noodle.noodlerfanactivity.inheritResolved", {
                        value: localizeUi(
                          globalSettings.fanActivityEnabled
                            ? "ui.noodle.noodlerfanactivity.on"
                            : "ui.noodle.noodlerfanactivity.off",
                        ),
                      })
                    : localizeUi("ui.noodle.noodlerfanactivity.inherit")}
                </option>
                <option value="on">{localizeUi("ui.noodle.noodlerfanactivity.on")}</option>
                <option value="off">{localizeUi("ui.noodle.noodlerfanactivity.off")}</option>
              </select>
            </label>
            {profile.fanActivity && globalSettings && (
              <div className="grid grid-cols-2 gap-2">
                {(["ordinary", "eccentric", "crossFandom", "raider", "organicDiscovery", "freeResource"] as const).map(
                  (archetype) => {
                    const override = profile.fanActivity?.archetypeWeights?.[archetype];
                    const globalValue = globalSettings.fanArchetypeWeights[archetype];
                    const current = override ?? globalValue;
                    return (
                      <label key={archetype} className="space-y-1 text-[0.68rem] font-semibold">
                        <span className="block text-[var(--muted-foreground)]">
                          {localizeUi(`ui.noodle.noodlerfanactivity.archetype.${archetype}`)}
                          {/* Without this an inherited value and a deliberate override that
                              happens to match look identical. */}
                          {override === undefined && (
                            <span className="ml-1 font-normal opacity-70">
                              {localizeUi("ui.noodle.noodlerfanactivity.inheritedValue")}
                            </span>
                          )}
                        </span>
                        <input
                          key={`${profile.id}-${archetype}-${current}`}
                          type="number"
                          min={0}
                          max={100}
                          defaultValue={current}
                          onBlur={(event) => {
                            const value = Number(event.target.value);
                            if (!Number.isInteger(value) || value < 0 || value > 100) {
                              event.target.value = String(current);
                              return;
                            }
                            const archetypeWeights = {
                              ...globalSettings.fanArchetypeWeights,
                              ...profile.fanActivity?.archetypeWeights,
                              [archetype]: value,
                            };
                            if (!Object.values(archetypeWeights).some((weight) => weight > 0)) {
                              toast.error(localizeUi("ui.noodle.noodlerfanactivity.allWeightsZero"));
                              event.target.value = String(current);
                              return;
                            }
                            const archetypeOverrides = {
                              ...profile.fanActivity?.archetypeWeights,
                              [archetype]: value,
                            };
                            updateFanActivity.mutate(
                              {
                                accountId: profile.id,
                                fanActivity: { ...profile.fanActivity, archetypeWeights: archetypeOverrides },
                              },
                              {
                                onError: (error) => {
                                  toast.error(errorMessage(error, localizeUi("ui.slurp.creator.updateError")));
                                  event.target.value = String(current);
                                },
                              },
                            );
                          }}
                          className="h-9 w-full rounded-lg border border-[var(--noodle-divider)] bg-transparent px-2 text-sm"
                        />
                      </label>
                    );
                  },
                )}
              </div>
            )}
          </fieldset>
          <div className="space-y-1">
            <button
              type="button"
              disabled={runNowPending}
              onClick={() => onRunNow(profile.id)}
              className="h-9 w-full rounded-full border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)] disabled:opacity-50"
            >
              {runNowPending
                ? localizeUi("ui.noodle.stageprofileview.running")
                : localizeUi("ui.noodle.stageprofileview.runNow")}
            </button>
            <p className="text-[0.68rem] text-[var(--muted-foreground)]">
              {localizeUi("ui.noodle.stageprofileview.generatesOneAutomaticStylePostImmediatelySubscriberAccessThe")}
            </p>
          </div>
        </div>
      </Modal>
    </>
  );

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

}

export type { NoodlerComposerTool } from "./SlpScreenComposer";
export { NoodlerPostComposer };

