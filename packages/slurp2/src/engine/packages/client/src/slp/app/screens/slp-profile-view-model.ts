import { useEffect, useRef, useState } from "react";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlurpManagedStageProfile, SlurpStageProfileInput } from "../../base/state/slp-state-types";
import { useCreatorFollowers, useCreatorSubscribers } from "../../features/audience/slp-audience-hooks";
import { useUpdateCreatorFanActivity } from "../../features/audience/slp-fan-activity-hooks";
import { useUploadCreatorAvatar, useUploadCreatorBanner } from "../../features/creators/slp-creator-profile-hooks";
import { slpProfileSubscriptionState } from "../../features/economy/slp-economy-subscription-state";
import { useSlurpWallet, useTipSlurpCreator } from "../../features/economy/slp-economy-hooks";
import type { SlurpProfilePost } from "../../features/feed/slp-feed-contract";
import { useUpdateCreatorAutoPosting } from "../../features/feed/slp-feed-schedule-hooks";
import { useCreatorViewer } from "../../features/feed/slp-feed-viewer-hooks";
import { useSlurpCompose } from "../../features/messages/slp-messages-hooks";
import { useSlurpArcs } from "../../features/projects/slp-projects-hooks";
import { useSlurpSettings } from "../../features/settings/slp-settings-hooks";
import { type SlpPostCardCtx } from "../../modules/post/SlpPostTypes";
import { useSlurpMediaSrc } from "../../base/media/slp-media-src";
import { slpPrefersReducedMotion } from "../../base/chrome/slp-motion";
import { slurpCreatorStatus } from "../../modules/creator/slp-creator-status";
import { useTranslation as useUiTranslation } from "react-i18next";
import { profileAccent } from "../../features/creators/SlpStageProfileForm";
import {
  isSlurpStory,
  slpCreatorGoalOf,
  toManagedPostCardModel,
  toSlpPostCardModel,
  type SlpCreatorPostDraft,
  type SlpCreatorPostSubmission,
} from "./SlpHomeHelpers";

import type { SlpCreatorProfileTab, SlurpProfileImagePost } from "./SlpScreenProfile";

export interface StageProfileViewProps {
  profile: SlurpManagedStageProfile;
  /** Open the own page's Dashboard on arrival (W). */
  openDashboard?: boolean;
  profileDraft: SlurpStageProfileInput | null;
  onProfileChange: (patch: Partial<SlurpStageProfileInput>) => void;
  onCancelEdit: () => void;
  onSaveEdit: (location?: string) => void;
  profileSavePending: boolean;
  posts: SlurpProfilePost[];
  viewerCreator: NonNullable<ReturnType<typeof useCreatorViewer>["data"]>["creators"][number] | null;
  viewerAccount: SlpAccount | null;
  viewerActorAccount: SlpAccount | null;
  slurpSettings: ReturnType<typeof useSlurpSettings>["data"] | null;
  postCardCtx: SlpPostCardCtx;
  viewerAccounts: SlpAccount[];
  /** Null while the counts load, so the header shows a dash instead of a false 0. */
  connectionCounts: Record<string, { fans: number; followers: number }> | null;
  viewerIsLoading: boolean;
  viewerIsError: boolean;
  onRetryViewer: () => void;
  draft: SlpCreatorPostDraft;
  onDraftChange: (patch: Partial<SlpCreatorPostDraft>) => void;
  onClearDraft: () => void;
  onDiscardDraft: () => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onEdit: () => void;
  onBack: () => void;
  onManualPost: (input: SlpCreatorPostSubmission) => Promise<void>;
  manualPending: boolean;
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
  /** Above 0 while the rail or the hub's "Add Story" asks for the composer; the profile opens it and calls `onComposerOpened`. */
  composerOpenSignal: number;
  /** Clears the request, so coming back to the profile later does not open the composer again. */
  onComposerOpened?: () => void;
}

/**
 * Everything the Creator profile screen renders from: its props, the state it keeps and the lists
 * it derives from the viewer scope.
 *
 * The screen was one component of sixteen hundred lines because this block and its JSX could not
 * be separated. Returning it as one object lets each part of the screen destructure exactly what
 * it draws, and keeps the derivation in one place where a test can reach it.
 */
export function useStageProfileViewModel(props: StageProfileViewProps) {
  const {
    profile,
    profileDraft,
    posts,
    viewerCreator,
    viewerAccount,
    slurpSettings,
    viewerAccounts,
    connectionCounts,
    composerOpenSignal,
  } = props;
  const { t: localizeUi, i18n } = useUiTranslation();
  const bannerSrc = useSlurpMediaSrc(profile.bannerUrl, { width: 1280 });
  const [automationOpen, setAutomationOpen] = useState(false);
  // Closed by default: posting moved to the composer sheet (design step 7), so what is left here
  // (identity, storyline effects, automation) is operator detail, quieter than the page itself.
  const [creatorToolsOpen, setCreatorToolsOpen] = useState(false);
  // The composer is one full-screen sheet (design step 7), opened from "New post", the rail's
  // "Create post" / "Add story" and the hub's "Add Story".
  const [composerOpen, setComposerOpen] = useState(false);
  useEffect(() => {
    if (composerOpenSignal <= 0) return;
    setComposerOpen(true);
    props.onComposerOpened?.();
  }, [composerOpenSignal]);
  const updateAutoPosting = useUpdateCreatorAutoPosting();
  const updateFanActivity = useUpdateCreatorFanActivity();
  const tipCreator = useTipSlurpCreator();
  const [tipOpen, setTipOpen] = useState(false);
  // The compose query is the viewer-facing source for action prices and messaging policy.
  const offerMessaging =
    useSlurpCompose(profile.id, viewerAccount?.entityId ?? null, false, true).data?.messaging ?? null;
  const [customTip, setCustomTip] = useState("");
  const walletQuery = useSlurpWallet(viewerAccount?.entityId ?? null);
  const subscriptionState = slpProfileSubscriptionState({
    creatorId: profile.id,
    subscribed: viewerCreator?.subscribed ?? false,
    wallet: walletQuery.data,
  });
  const openComposer = (postType?: "post" | "story") => {
    if (postType === "story") props.onDraftChange({ postType, poll: null, title: "" });
    else if (postType === "post") props.onDraftChange({ postType, linkedPostId: null });
    setComposerOpen(true);
  };
  const [locationDraft, setLocationDraft] = useState(
    () => (profile as SlurpManagedStageProfile & { location?: string }).location ?? "",
  );
  const locationProfileId = useRef(profile.id);
  useEffect(() => {
    if (locationProfileId.current === profile.id) return;
    locationProfileId.current = profile.id;
    setLocationDraft((profile as SlurpManagedStageProfile & { location?: string }).location ?? "");
  }, [profile.id, profile]);
  const uploadProfileAvatar = useUploadCreatorAvatar();
  const uploadProfileBanner = useUploadCreatorBanner();
  const profileAvatarFileRef = useRef<HTMLInputElement | null>(null);
  const profileBannerFileRef = useRef<HTMLInputElement | null>(null);
  const [artworkKind, setArtworkKind] = useState<"avatar" | "banner" | null>(null);
  const [openImagePostId, setOpenImagePostId] = useState<string | null>(null);
  // Global fan controls require a Creator settings route. Keep per-Creator controls available.
  const globalSettings = slurpSettings
    ? {
        fanActivityEnabled: slurpSettings.fanActivityEnabled,
        fanArchetypeWeights: slurpSettings.fanArchetypeWeights,
      }
    : null;
  const autoPosting = profile.autoPosting;
  const [activeTab, setActiveTab] = useState<SlpCreatorProfileTab>("posts");
  const [revealedManagedPostIds, setRevealedManagedPostIds] = useState<Set<string>>(() => new Set());
  const subscribersQuery = useCreatorSubscribers(profile.id);
  const followersQuery = useCreatorFollowers(profile.id);
  const subscribers = subscribersQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const subscriberTotal = subscribersQuery.data?.pages[0]?.total ?? subscribers.length;
  const followerTotal = connectionCounts ? (connectionCounts[profile.id]?.followers ?? 0) : null;
  // The posts response wraps each post as `{ viewerPost }` or `{ managed, viewerPost }`. Header counts,
  // likes and last activity read the post inside the wrapper, never the wrapper itself.
  const wrappedPosts = posts.flatMap((entry) => {
    const post = ("managed" in entry ? entry.managed : null) ?? entry.viewerPost;
    return post ? [post] : [];
  });
  const postTabCounts = {
    posts: wrappedPosts.filter((post) => !isSlurpStory(post)).length,
    media: wrappedPosts.filter((post) => Boolean(post.imageUrl)).length,
    stories: wrappedPosts.filter(isSlurpStory).length,
  };
  // Null while the posts load: the header shows a dash, never a false 0.
  const profileLikeTotal = props.isLoading
    ? null
    : posts.reduce((total, entry) => total + (entry.viewerPost?.likeCount ?? 0), 0);
  const latestActivityAt = wrappedPosts.reduce((latest, post) => {
    const at = Date.parse(post.createdAt);
    return Number.isNaN(at) ? latest : Math.max(latest, at);
  }, 0);
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
  // Every Slurp Creator profile is operator-managed, so post controls and artwork editing stay
  // available regardless of which viewer persona is looking at the profile.
  const managedCreator = true;
  // The goal the audience sees. It rides on the viewer scope beside `subscriptionPrice`, because
  // the audience profile projection is a strict allowlist and must stay that way.
  const goalForViewer = slpCreatorGoalOf(viewerCreator);
  const arcsQuery = useSlurpArcs(viewerAccount?.entityId ?? null, profile.id);
  const editing = Boolean(profileDraft);
  const editDraft = profileDraft ?? {
    displayName: profile.displayName,
    handle: profile.handle,
    bio: profile.bio,
    stagePersonality: profile.stagePersonality,
    appearance: profile.appearance,
    wardrobe: profile.wardrobe,
    locations: profile.locations,
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
        : [{ kind: "card" as const, model: toSlpPostCardModel(entryViewerPost, profile) }];
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
      : [{ kind: "card" as const, model: toSlpPostCardModel(viewerPost, profile) }];
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
  // What a subscription opens, for the paywall card and the locked tiles on Media: locked posts
  // (not Stories) and the blurred teasers the server sends for the ones with a picture.
  const lockedPosts = projectedPosts.flatMap((item) =>
    item.kind === "locked" && !isSlurpStory(item.post) ? [item.post] : [],
  );
  const lockedTeasers = lockedPosts.flatMap((post) =>
    typeof post.imageUrl === "string"
      ? [{ id: post.id, imageUrl: post.imageUrl, unlockPrice: slpUnlockPriceOf(post) }]
      : [],
  );
  // The Stories tab plays them in the Story viewer, so it needs them as moments (Creator + post).
  const storyMoments = viewerCreator
    ? posts.flatMap((entry) =>
        entry.viewerPost && isSlurpStory(entry.viewerPost) ? [{ creator: viewerCreator, post: entry.viewerPost }] : [],
      )
    : [];
  // Open a post of this profile: a picture post in the post dialog, anything else by switching to
  // Posts and scrolling it into view (storyline links, locked tiles on Media).
  const showProfilePost = (postId: string) => {
    if (imagePosts.some((post) => post.id === postId)) {
      setOpenImagePostId(postId);
      return;
    }
    setActiveTab("posts");
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() =>
        document
          .querySelector(`[data-noodle-post-id="${CSS.escape(postId)}"]`)
          ?.scrollIntoView({ block: "center", behavior: slpPrefersReducedMotion() ? "auto" : "smooth" }),
      ),
    );
  };
  const openImagePost = openImagePostId ? (imagePosts.find((post) => post.id === openImagePostId) ?? null) : null;
  const emptyTabTitle =
    activeTab === "media"
      ? localizeUi("ui.slurp.profile.emptyMedia")
      : activeTab === "stories"
        ? localizeUi("ui.slurp.profile.emptyStories")
        : localizeUi("ui.noodle.stageprofileview.noNoodlerPostsYet");
  return {
    ...props,
    localizeUi,
    i18n,
    bannerSrc,
    automationOpen,
    setAutomationOpen,
    creatorToolsOpen,
    setCreatorToolsOpen,
    updateAutoPosting,
    updateFanActivity,
    tipCreator,
    tipOpen,
    setTipOpen,
    offerMessaging,
    customTip,
    setCustomTip,
    subscriptionState,
    openComposer,
    composerOpen,
    setComposerOpen,
    lockedPosts,
    lockedTeasers,
    storyMoments,
    locationDraft,
    setLocationDraft,
    locationProfileId,
    uploadProfileAvatar,
    uploadProfileBanner,
    profileAvatarFileRef,
    profileBannerFileRef,
    artworkKind,
    setArtworkKind,
    openImagePostId,
    setOpenImagePostId,
    globalSettings,
    autoPosting,
    activeTab,
    setActiveTab,
    revealedManagedPostIds,
    setRevealedManagedPostIds,
    subscribersQuery,
    followersQuery,
    subscribers,
    subscriberTotal,
    followerTotal,
    profileLikeTotal,
    postTabCounts,
    latestActivityAt,
    viewingOwnCreator,
    creatorStatus,
    profileLocation,
    profileBioBody,
    accent,
    personaBackedCreator,
    managedCreator,
    goalForViewer,
    arcsQuery,
    editing,
    editDraft,
    viewerPostById,
    projectedPosts,
    visiblePosts,
    imagePosts,
    openImagePost,
    showProfilePost,
    emptyTabTitle,
  };
}

export type StageProfileViewModel = ReturnType<typeof useStageProfileViewModel>;

/** The server sends the unlock price beside the shared view types, which have no price field. */
function slpUnlockPriceOf(post: unknown): number | null {
  const price = (post as { unlockPrice?: unknown } | null)?.unlockPrice;
  return typeof price === "number" && price >= 0 ? price : null;
}
