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
import { SlurpFanCard } from "../../modules/audience/SlpFanCard";
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

import type { NoodlerProfileTab, SlurpProfileImagePost } from "./SlpScreenProfile";

export interface StageProfileViewProps {
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
  } = props;
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
  return {
    ...props,
    localizeUi,
    i18n,
    bannerSrc,
    accessSettingsOpen,
    setAccessSettingsOpen,
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
    locationDraft,
    setLocationDraft,
    locationProfileId,
    uploadProfileAvatar,
    uploadProfileBanner,
    generateProfileArtwork,
    profileAvatarFileRef,
    profileBannerFileRef,
    artworkKind,
    setArtworkKind,
    openImagePostId,
    setOpenImagePostId,
    artworkGuidance,
    setArtworkGuidance,
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
    latestActivityAt,
    viewingOwnCreator,
    creatorStatus,
    profileLocation,
    profileBioBody,
    accent,
    personaBackedCreator,
    accessViewerAccounts,
    managedCreator,
    goalForViewer,
    arcsQuery,
    editing,
    editDraft,
    viewerPostById,
    projectedPosts,
    visiblePosts,
    imagePosts,
    featuredPost,
    openImagePost,
    emptyTabTitle,
  };
}

export type StageProfileViewModel = ReturnType<typeof useStageProfileViewModel>;
