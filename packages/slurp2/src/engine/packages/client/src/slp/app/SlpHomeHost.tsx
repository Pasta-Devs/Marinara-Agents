import {
  ArrowLeft,
  ArrowDown,
  ArrowRight,
  Bell,
  BookmarkCheck,
  BookmarkPlus,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coins,
  Crown,
  Eye,
  Gift,
  Heart,
  LayoutGrid,
  Link,
  List,
  Loader2,
  Lock,
  Maximize2,
  MessageCircle,
  Minimize2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Star,
  Trash2,
  TriangleAlert,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
import {
  NOODLER_POST_CONTENT_MAX_LENGTH,
  NOODLER_POST_GUIDE_MAX_LENGTH,
  NOODLER_POST_TITLE_MAX_LENGTH,
  noodlePollInputSchema,
} from "@marinara-engine/shared";
import type {
  NoodleIdentityDisclosure,
  NoodleAccount,
  NoodleInteraction,
  NoodlePostAccess,
  NoodlerPostView,
  NoodlePollInput,
  NoodlePostImageCrop,
  NoodlerManagedPost,
  NoodlerStageProfile,
  NoodlerSourceSnapshot,
  AvatarCrop,
  Persona,
} from "@marinara-engine/shared";
import type { SlurpManagedStageProfile, SlurpStageProfileInput } from "../base/state/slp-state-types";
import {
  useHideSlurpAd,
  useHideSlurpAdBrand,
  useRecordSlurpAdAction,
  useSlurpInlineAds,
} from "../features/ads/slp-ads-hooks";
import type { SlurpPromotion } from "../features/ads/slp-ads-contract";
import {
  useNoodlerConnectionCounts,
  useNoodlerFollowers,
  useNoodlerSubscribers,
} from "../features/audience/slp-audience-hooks";
import { useUpdateNoodlerFanActivity } from "../features/audience/slp-fan-activity-hooks";
import {
  useCreateNoodlerStageProfile,
  useGenerateNoodlerArtwork,
  useGenerateNoodlerStageProfileDraft,
  useRemoveNoodlerAvatar,
  useUpdateNoodlerProfileLocation,
  useUpdateNoodlerStageProfile,
  useUploadNoodlerAvatar,
  useUploadNoodlerBanner,
  useUseNoodlerSourceAvatar,
} from "../features/creators/slp-creator-profile-hooks";
import { useNoodlerAccounts, useNoodlerEligibleAccounts } from "../features/creators/slp-creators-hooks";
import type { SlurpStudioCreator } from "../features/economy/slp-economy-contract";
import {
  useClaimSlurpDailyRefill,
  useNoodlerViewerWallets,
  useSetSlurpGoal,
  useSetSlurpWalletCoinsForDevelopment,
  useSlurpPayout,
  useSlurpStudio,
  useSlurpWallet,
  useTipSlurpCreator,
} from "../features/economy/slp-economy-hooks";
import type { SlurpProfilePost } from "../features/feed/slp-feed-contract";
import {
  useConfirmNoodlerImagePrompts,
  useCreateNoodlerPost,
  useDeleteNoodlerPost,
  useGenerateNoodlerNoodlePost,
  useGenerateNoodlerPostImage,
  useLoadNoodlerPostImage,
  useNoodlerPosts,
  useReplaceNoodlerPostImage,
  useUpdateNoodlerPost,
} from "../features/feed/slp-feed-post-hooks";
import {
  useRunNoodlerAutoPostNow,
  useUpdateNoodlerAccess,
  useUpdateNoodlerAutoPosting,
} from "../features/feed/slp-feed-schedule-hooks";
import {
  useCreateNoodlerInteraction,
  useDeleteNoodlerInteraction,
  useMarkNoodlerFeedSeen,
  useNoodlerUnseenCount,
  useNoodlerViewer,
  useRemoveNoodlerInteraction,
  useToggleNoodlerFollow,
  useToggleNoodlerSubscription,
  useTriggerNoodlerCreatorReply,
  useUnlockNoodlerPost,
  useUpdateNoodlerInteraction,
} from "../features/feed/slp-feed-viewer-hooks";
import {
  useRecordSlurpStoryView,
  useSlurpCompose,
  useSlurpStoryViews,
  useSlurpThreads,
} from "../features/messages/slp-messages-hooks";
import type { SlurpEventGroup, SlurpEventItem } from "../features/notifications/slp-notifications-contract";
import {
  useMarkSlurpNotificationsSeen,
  useSlurpNotifications,
} from "../features/notifications/slp-notification-hooks";
import { useSlurpArcs } from "../features/projects/slp-projects-hooks";
import { useSlurpSettings, useUpdateSlurpSettings } from "../features/settings/slp-settings-hooks";
import { useActivePersona, usePersonas } from "../../hooks/use-creator-personas";
import { useConnections } from "../../hooks/use-connections";
import { ApiError } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { useSlurpUIStore } from "../base/state/slp-package-store";
import { SlurpWalletView } from "./screens/SlpScreenWallet";
import { StageProfileSourcePicker, DisclosureStep } from "./screens/SlpScreenCreateProfile";
import { StageProfileView } from "./screens/SlpScreenProfile";
import { ViewerHub } from "./screens/SlpScreenHub";
import { SubscriptionSections } from "./screens/SlpScreenSubscriptions";
import { SlurpStudioView } from "./screens/SlpScreenStudio";
import { SlurpInboxView } from "./screens/SlpScreenMessages";
import {
  type NoodlerPostDraft,
  type NoodlerPostSubmission,
  type PendingNoodlerImage,
  type NoodlerContentFormat,
  type NoodlerPostDraftImage,
  type SlurpViewerCreator,
  NOODLER_FEED_WINDOW_SIZE,
  SLURP_PLACEHOLDER_BALANCE,
  STAGE_PERSONALITY_MAX_LENGTH,
  EMPTY_NOODLER_POST_DRAFT,
  isEmptyNoodlerPostDraft,
  isSlurpStory,
  slurpSubscriptionPriceOf,
  linkedPostIdForStory,
  parsePrice,
  errorMessage,
  toNoodlePostCardModel,
  toManagedPostCardModel,
  serializeNoodlerPostGuide,
  noodlerGoalOf,
  SlurpAccessTransition,
  NoodlerDraftImageFrame,
  EmptyState,
  NoodlerFrame,
  DisclosureBadge,
  SlurpFeedSkeleton,
} from "./screens/SlpHomeHelpers";
import { SlurpNotificationsView } from "./screens/SlpScreenMessages";
import {
  ImagePromptReviewModal,
  type ImagePromptOverride,
  type ImagePromptReviewItem,
} from "../../components/ui/ImagePromptReviewModal";
import {
  NoodleComposerShell,
  NoodleComposerToolRow,
  type NoodlePostCardCtx,
  type NoodlePostCardModel,
  type NoodlePostImageUpdate,
  useNoodlePostCardController,
} from "../modules/post/SlpPostCard";
import { NoodleAnchoredPopover } from "../base/chrome/SlpAnchoredPopover";
import { SlurpArcTimelineCard } from "../features/projects/SlpArcTimelineCard";
import { SlurpProjectsPanel } from "../features/projects/SlpProjectsBoard";
import { SlurpFanCard } from "../modules/audience/SlpFanCard";
import { LockedSlurpPostCard } from "../modules/post/SlpLockedPostCard";
import { SlurpCreatorPostCard } from "../modules/post/SlpCreatorPostCard";
import { SlurpSparkleVeil } from "../base/chrome/SlpSparkleVeil";
import {
  DEFAULT_SLURP_SUBSCRIPTION_PRICE,
  SlurpCoin,
  SlurpCoinAmount,
  SlurpCoinBurst,
} from "../modules/coin/SlpCoin";
import { ChatImageLightbox } from "../../components/chat/ChatImageLightbox";
import { useNearViewportSlurpMediaSrc, useSlurpMediaSrc } from "../base/media/slp-media-src";
import { SlurpOnboardingWizard } from "../features/onboarding/SlpOnboardingPanel";
import { SlurpAgeGate, SlurpConfetti } from "../features/onboarding/SlpAgeGate";
import { SlurpSplash, slurp2SplashPending } from "../features/onboarding/SlpSplash";
import { slurpCreatorStatus } from "../modules/creator/slp-creator-status";
import {
  Avatar,
  getNoodleAccentStyle,
  SLURP_TOGGLE_ACTIVE_CLASS,
  NewSinceLastVisitDivider,
  HIDE_ON_SCROLL_CLASS,
  NoodleLogo,
  ProfileInitial,
  useHideOnScroll,
  NOODLE_PERSONA_SWITCHER_PAGE_SIZE,
  NOODLE_PINK,
} from "../base/chrome/SlpChrome";
import { NoodleShell } from "../modules/chrome/SlpShell";
import { SlurpProfileSurface } from "../features/creators/SlpProfileSurface";
import { BroadcastPanel, SlurpMessagesView } from "../features/messages/SlpMessages";
import { SlpBackstageShell } from "../app/backstage/SlpBackstageShell";
import { SlpBackstageSidebar } from "../features/backstage/SlpBackstageSidebar";
import { confirmLeaveSlurpBackstage } from "../features/backstage/SlpBackstageControls";
import { NoodleImageComposer } from "../base/media/SlpImageComposer";
import { NoodlePollComposer } from "../modules/poll/SlpPollComposer";
import { SlpStoryTile } from "../modules/story/SlpStoryTile";
import { PostImageCropEditor, PostImageFrame } from "../base/media/SlpPostImageCropEditor";
import { ConversationMediaPickerPanel, type ConversationMediaPickerTabId } from "../../components/chat/ConversationMediaPickerPanel";
import { HelpTooltip } from "../../components/ui/HelpTooltip";
import { Modal } from "../../components/ui/Modal";
import type { SlurpNavigationState } from "../base/navigation/slp-navigation.types";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SlurpInlineAd, SlurpInlineAdTile } from "../features/ads/SlpInlineAd";
import { SlurpCreatorProfileCard } from "../modules/creator/SlpCreatorProfileCard";
import { SlurpDiscoveryProfileEditor } from "../features/discovery/SlpDiscoveryProfileEditor";
import {
  appendAudienceStance,
  confirmSlurpAvatarReview,
  AudienceStancePresets,
  disclosureOptions,
  profileAccent,
  StageProfileForm,
  WizardFooter,
} from "../features/creators/SlpStageProfileForm";
import { SlurpDiscoverToolbar } from "../features/discovery/SlpDiscoverToolbar";
import {
  filterAndSortSlurpCreators,
  isSlurpDiscoveryProfileIncomplete,
  SLURP_DISCOVERY_TAGS,
  type SlurpDiscoverLayout,
  type SlurpDiscoverSort,
} from "../features/discovery/slp-discovery";
import type { SlurpDiscoveryGender } from "../base/state/slp-state-types";
import { formatTime } from "../base/ui/slp-date-time";
import { useSlurpHomeState } from "./slp-home-actions";

interface SlurpHomeProps {
  navigation: Extract<SlurpNavigationState, { mode: "creator" }>;
  onNavigate: (destination: SlurpNavigationState) => void;
  onLeave?: () => void;
}

const EMPTY_STAGE_PROFILE: SlurpStageProfileInput = {
  displayName: "",
  handle: "",
  bio: "",
  stagePersonality: "",
  disclosureMode: "open",
  gender: null,
  tags: [],
};

const fieldClass =
  "mari-chrome-field h-11 w-full rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-accent)]";
const textareaClass =
  "mari-chrome-field min-h-24 w-full resize-y rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] p-3 text-sm leading-6 text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-accent)]";

export function SlurpHome({ navigation, onNavigate, onLeave }: SlurpHomeProps) {
  const {
    localizeUi,
    accountsQuery,
    retryAccountsOrReload,
    connectionCountsQuery,
    viewerWalletsQuery,
    slurpSettingsQuery,
    personasQuery,
    setOnboardingState,
    personas,
    viewerPersonaId,
    activeWalletCoins,
    viewerAccounts,
    shellPersonaAccount,
    myCreatorProfile,
    viewerActorAccount,
    accountSwitcherOpen,
    setAccountSwitcherOpen,
    mobileDrawerOpen,
    setMobileDrawerOpen,
    mobileDrawerTriggerRef,
    mobileAccountSwitcherOpen,
    setMobileAccountSwitcherOpen,
    setPersonaAccountLimit,
    accountSwitcherRef,
    visiblePersonaAccounts,
    switchViewerPersona,
    noodlerPostDrafts,
    updateNoodlerPostDraft,
    clearNoodlerPostDraft,
    exitToCreatorHub,
    openSettings,
    feedSearch,
    setFeedSearch,
    discoverRank,
    setDiscoverRank,
    discoveryInputRef,
    feedTab,
    setFeedTab,
    onboardingMode,
    setOnboardingMode,
    gateOpen,
    splashOpen,
    setSplashOpen,
    gateCelebrating,
    setGateCelebrating,
    onboardingPresentedRef,
    viewerQuery,
    noodlerUnseenCount,
    notificationsQuery,
    inboxThreadsQuery,
    frozenFeedSeenAt,
    markFeedShown,
    toggleFollow,
    toggleSubscription,
    unlockPost,
    updateAccess,
    draftNoodleAccountId,
    setDraftNoodleAccountId,
    sourceSearch,
    sourceKind,
    eligibleAccountsQuery,
    createProfile,
    updateProfile,
    uploadAvatar,
    useSourceAvatar,
    removeAvatar,
    generatePost,
    confirmImagePrompts,
    runAutoPostNow,
    setupAutoPosting,
    createPost,
    generateProfileDraft,
    connections,
    profileDraft,
    setProfileDraft,
    setProfileDraftDirty,
    imagePromptReview,
    setImagePromptReview,
    creationStep,
    setCreationStep,
    autoPostSetupId,
    setAutoPostSetupId,
    creationDisclosure,
    setCreationDisclosure,
    draftGuidance,
    setDraftGuidance,
    draftConnectionId,
    setDraftConnectionId,
    previousDraft,
    setPreviousDraft,
    editingProfileId,
    composerOpenSignal,
    setComposerOpenSignal,
    setAcceptSourceChangesForProfileId,
    invalidateProfileDraftGeneration,
    profileReturnView,
    prepareNavigationAwayFromProfileEditor,
    goToHub,
    goToNoodlerSearch,
    goToMessages,
    goToWallet,
    goToStudio,
    closeNoodlerSearch,
    postCardController,
    postCardCtx,
    selectedProfile,
    postsQuery,
    selectedViewerCreator,
    eligibleNoodleAccounts,
    selectedSource,
    sourcePickerLoading,
    handleSourceSearch,
    handleSourceKind,
    enterFromGate,
    closeOnboarding,
    beginCreate,
    cancelCreateProfile,
    beginEdit,
    closeProfileEditor,
    changeDisclosure,
    generateDraft,
    redraftFromSource,
    saveProfile,
    submitManualPost,
    submitGuidedPost,
    submitRunNow,
    confirmReviewedImagePrompts,
    toggleCreatorSubscription,
    toggleCreatorFollow,
    mainAuthorProfile,
    openPostComposer,
    openStoryComposer,
  } = useSlurpHomeState({ navigation, onNavigate, onLeave });

  const shellProps = {
    appMode: "slurp" as const,
    activeView:
      navigation.mode === "creator-settings"
        ? ("settings" as const)
        : navigation.mode === "creator" && navigation.view === "profile"
          ? ("profile" as const)
          : navigation.mode === "creator" && navigation.view === "search"
            ? ("search" as const)
            : navigation.mode === "creator" && navigation.view === "messages"
              ? ("messages" as const)
              : navigation.mode === "creator" && navigation.view === "wallet"
                ? ("wallet" as const)
                : navigation.mode === "creator" && navigation.view === "studio"
                  ? ("studio" as const)
                  : navigation.mode === "creator" && navigation.view === "notifications"
                    ? ("messages" as const)
                    : ("noodler" as const),
    contextualRail:
      navigation.mode === "creator" && (navigation.view === "hub" || navigation.view === "search")
        ? ("populated" as const)
        : ("spanning" as const),
    homeActive: navigation.mode === "creator" && navigation.view === "hub",
    noodlerUnseenCount,
    accent: NOODLE_PINK,
    personaAccount: shellPersonaAccount,
    // The Slurp identity to show for the active persona, when it runs a Creator profile. Kept
    // separate from `personaAccount` on purpose: that one carries the persona's own account id,
    // which the switcher list filter and the isCreator check both key on, while this one carries
    // the Creator's. Swapping them would make the active persona reappear in its own switcher.
    creatorIdentity: viewerActorAccount,
    sortedPersonaAccounts: viewerAccounts,
    visiblePersonaAccounts,
    linkedNoodleAccountIds: new Set(
      (accountsQuery.data ?? []).flatMap((profile) => (profile.sourceAccountId ? [profile.sourceAccountId] : [])),
    ),
    // Only a persona that runs a Creator profile has fans and followers, so the switcher
    // shows the line for those personas and leaves the rest without one.
    personaConnectionCounts: Object.fromEntries(
      (accountsQuery.data ?? []).flatMap((profile) => {
        const counts = profile.sourceAccountId ? connectionCountsQuery.data?.[profile.sourceAccountId] : undefined;
        return counts ? [[profile.sourceAccountId!, counts] as const] : [];
      }),
    ),
    personaWallets: viewerWalletsQuery.data,
    onLoadMorePersonaAccounts: () => setPersonaAccountLimit((current) => current + NOODLE_PERSONA_SWITCHER_PAGE_SIZE),
    onSwitchPersona: switchViewerPersona,
    accountSwitcherOpen,
    onAccountSwitcherOpenChange: setAccountSwitcherOpen,
    accountSwitcherRef,
    mobileDrawerOpen,
    onMobileDrawerOpenChange: setMobileDrawerOpen,
    mobileDrawerTriggerRef,
    mobileAccountSwitcherOpen,
    onMobileAccountSwitcherOpenChange: setMobileAccountSwitcherOpen,
    onOpenHome: exitToCreatorHub,
    onOpenMobileHome: exitToCreatorHub,
    onOpenNoodler: goToHub,
    onOpenSearch: goToNoodlerSearch,
    onOpenMessages: goToMessages,
    onOpenWallet: goToWallet,
    onOpenStudio: goToStudio,
    notificationCount:
      (notificationsQuery.data?.unseenCount ?? 0) +
      (inboxThreadsQuery.data?.unread ?? 0) +
      (inboxThreadsQuery.data?.inboundUnread ?? 0),
    // The studio is only meaningful for a persona that operates a Creator.
    hasOperatedCreator: Boolean(myCreatorProfile),
    walletBalanceLabel: `${viewerWalletsQuery.data?.[viewerPersonaId ?? ""]?.coins ?? SLURP_PLACEHOLDER_BALANCE}`,
    walletBalance: viewerWalletsQuery.data?.[viewerPersonaId ?? ""]?.coins,
    personaBannerUrl: myCreatorProfile?.bannerUrl ?? null,
    onBecomeCreator: shellPersonaAccount
      ? () => {
          onNavigate({ mode: "creator", view: "create-profile", sourceAccountId: shellPersonaAccount.id });
          setMobileDrawerOpen(false);
        }
      : undefined,
    onOpenProfile: async () => {
      if (!(await prepareNavigationAwayFromProfileEditor())) return;
      setMobileDrawerOpen(false);
      onNavigate(
        mainAuthorProfile
          ? { mode: "creator", view: "profile", accountId: mainAuthorProfile.id }
          : shellPersonaAccount
            ? { mode: "creator", view: "create-profile", sourceAccountId: shellPersonaAccount.id }
            : { mode: "creator", view: "profiles" },
      );
    },
    onOpenSettings: openSettings,
    onCompose: openPostComposer,
    // Every NoodleR branch spreads shellProps, so the lightbox mounts once wherever the user is.
    overlays: postCardController.imageLightbox ? (
      <ChatImageLightbox
        image={postCardController.imageLightbox}
        alt={postCardController.imageLightbox.prompt || "Slurp image"}
        pinEnabled={false}
        onClose={() => postCardController.setImageLightbox(null)}
      />
    ) : null,
  } as const;

  if (navigation.mode === "creator-settings") {
    return (
      <NoodleShell
        {...shellProps}
        desktopSidebar={
          <SlpBackstageSidebar navigation={navigation} onNavigate={onNavigate} onExit={exitToCreatorHub} />
        }
      >
        <SlpBackstageShell
          navigation={navigation}
          onNavigate={onNavigate}
          onAddCreators={() => setOnboardingMode("add-creators")}
          personaSourceIds={new Set(personas.map((persona) => persona.id))}
          onEditCreator={(creator) => {
            beginEdit(creator);
            onNavigate({ mode: "creator", view: "profile", accountId: creator.id, returnToSettings: navigation });
          }}
          onRedraftCreator={(creator) => {
            redraftFromSource(creator);
            onNavigate({ mode: "creator", view: "profile", accountId: creator.id, returnToSettings: navigation });
          }}
          onRestartOnboarding={() => {
            onboardingPresentedRef.current = true;
            setOnboardingState("entered");
            setOnboardingMode("first-run");
          }}
          viewerPersonaId={viewerPersonaId}
        />
        <SlurpOnboardingWizard
          open={onboardingMode !== null}
          selectionOnly={onboardingMode === "add-creators"}
          onClose={closeOnboarding}
          onComplete={() => {
            if (onboardingMode === "first-run") {
              setOnboardingState("completed");
            }
          }}
          onSeeFeed={
            onboardingMode === "add-creators"
              ? () => {
                  setOnboardingMode(null);
                  setFeedTab("all");
                  onNavigate({ mode: "creator", view: "hub" });
                }
              : undefined
          }
          onSkipped={() => setOnboardingMode(null)}
        />
      </NoodleShell>
    );
  }

  // Shared review layer: Guide generation can be triggered from both the selected stage-profile
  // view and the hub, so the confirmation modal must render on every branch that owns that action.
  const reviewModal = (
    <ImagePromptReviewModal
      open={Boolean(imagePromptReview)}
      items={imagePromptReview?.items ?? []}
      isSubmitting={confirmImagePrompts.isPending}
      onCancel={() => setImagePromptReview(null)}
      onConfirm={confirmReviewedImagePrompts}
    />
  );

  if (accountsQuery.isLoading) {
    return (
      <NoodleShell {...shellProps}>
        <NoodlerFrame onBack={exitToCreatorHub} title={localizeUi("ui.noodle.noodlemodetoggle.noodler")}>
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[var(--noodle-accent)]" />
          </div>
        </NoodlerFrame>
      </NoodleShell>
    );
  }

  if (accountsQuery.isError) {
    return (
      <NoodleShell {...shellProps}>
        <NoodlerFrame onBack={exitToCreatorHub} title={localizeUi("ui.noodle.noodlemodetoggle.noodler")}>
          <EmptyState
            title={localizeUi("ui.noodle.noodlerhome.noodlerCouldNotBeLoaded")}
            action={localizeUi("capabilities.actions.tryAgain")}
            onAction={retryAccountsOrReload}
          />
        </NoodlerFrame>
      </NoodleShell>
    );
  }

  if (creationStep === "source") {
    return (
      <NoodleShell {...shellProps}>
        <NoodlerFrame
          onBack={() => setCreationStep(null)}
          title={localizeUi("ui.noodle.noodlehome.createStageProfile")}
          hideBack
        >
          <StageProfileSourcePicker
            accounts={eligibleNoodleAccounts}
            search={sourceSearch}
            kind={sourceKind}
            selectedId={draftNoodleAccountId}
            onSearch={handleSourceSearch}
            onKindChange={handleSourceKind}
            onSelect={(accountId) => {
              invalidateProfileDraftGeneration();
              setDraftNoodleAccountId(accountId);
            }}
            hasMore={Boolean(eligibleAccountsQuery.hasNextPage)}
            isLoadingMore={eligibleAccountsQuery.isFetchingNextPage}
            isLoading={eligibleAccountsQuery.isLoading}
            isError={eligibleAccountsQuery.isError}
            onRetry={() => void eligibleAccountsQuery.refetch()}
            onLoadMore={() => void eligibleAccountsQuery.fetchNextPage()}
            onBack={cancelCreateProfile}
            onContinue={() => setCreationStep("disclosure")}
          />
        </NoodlerFrame>
      </NoodleShell>
    );
  }

  if (creationStep === "disclosure") {
    return (
      <NoodleShell {...shellProps}>
        <NoodlerFrame
          onBack={cancelCreateProfile}
          title={localizeUi("ui.noodle.noodlerhome.setIdentityDisclosure")}
          hideBack
        >
          <DisclosureStep
            source={selectedSource}
            value={creationDisclosure}
            onChange={setCreationDisclosure}
            onBack={
              navigation.mode === "creator" && navigation.view === "create-profile"
                ? cancelCreateProfile
                : () => setCreationStep("source")
            }
            onContinue={() => setCreationStep("draft")}
          />
        </NoodlerFrame>
      </NoodleShell>
    );
  }

  if (creationStep === "automatic" && autoPostSetupId) {
    const accountId = autoPostSetupId;
    const finishSetup = () => {
      setAutoPostSetupId(null);
      setCreationStep(null);
      onNavigate({ mode: "creator", view: "profile", accountId });
    };
    return (
      <NoodleShell {...shellProps}>
        <NoodlerFrame onBack={finishSetup} title={localizeUi("ui.noodle.stageprofileview.automaticPosting")} hideBack>
          <div className="mx-auto max-w-md space-y-5 p-4">
            <div className="space-y-1">
              <p className="text-sm font-bold">
                {localizeUi("ui.noodle.noodlerhome.shouldThisCreatorPostAutomatically")}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.noodle.noodlerhome.automaticPostsPublishAsSubscriberAccessOnASchedule")}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={finishSetup}
                className="h-10 flex-1 rounded-full border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)]"
              >
                {localizeUi("ui.chat.dependencyworkspaceapprovalcard.notNow")}
              </button>
              <button
                type="button"
                disabled={setupAutoPosting.isPending}
                onClick={() =>
                  setupAutoPosting.mutate(
                    { accountId, enabled: true },
                    {
                      onSuccess: finishSetup,
                      onError: (error) =>
                        toast.error(
                          errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotEnableAutomaticPosting")),
                        ),
                    },
                  )
                }
                className="h-10 flex-1 rounded-full border border-transparent bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-50"
              >
                {setupAutoPosting.isPending
                  ? localizeUi("ui.noodle.noodlerhome.enabling_5c258f0")
                  : localizeUi("ui.noodle.noodlerhome.turnOn")}
              </button>
            </div>
          </div>
        </NoodlerFrame>
      </NoodleShell>
    );
  }

  if ((profileDraft || creationStep === "draft") && !editingProfileId) {
    return (
      <NoodleShell {...shellProps}>
        <NoodlerFrame
          onBack={editingProfileId ? closeProfileEditor : () => setCreationStep("disclosure")}
          title={
            editingProfileId
              ? localizeUi("ui.noodle.noodlerhome.editStageProfile")
              : localizeUi("ui.noodle.noodlehome.createStageProfile")
          }
          hideBack={!editingProfileId}
        >
          <StageProfileForm
            draft={profileDraft ?? { ...EMPTY_STAGE_PROFILE, disclosureMode: creationDisclosure }}
            source={selectedSource}
            disclosureMode={creationDisclosure}
            onDisclosureChange={changeDisclosure}
            guidance={draftGuidance}
            onGuidanceChange={setDraftGuidance}
            connections={connections}
            connectionId={draftConnectionId}
            onConnectionChange={setDraftConnectionId}
            onGenerate={generateDraft}
            isGenerating={generateProfileDraft.isPending}
            previousDraft={previousDraft}
            onUndoDraft={() => {
              if (!previousDraft) return;
              invalidateProfileDraftGeneration();
              setProfileDraft(previousDraft);
              setPreviousDraft(null);
              setAcceptSourceChangesForProfileId(null);
            }}
            onChange={(patch) => {
              setProfileDraftDirty(true);
              setProfileDraft((current) => ({
                ...(current ?? { ...EMPTY_STAGE_PROFILE, disclosureMode: creationDisclosure }),
                ...patch,
              }));
            }}
            sourceAccountId={draftNoodleAccountId}
            accentId={editingProfileId ?? draftNoodleAccountId ?? "new-profile"}
            isEditing={Boolean(editingProfileId)}
            isPending={createProfile.isPending || updateProfile.isPending}
            avatar={
              editingProfileId ? (accountsQuery.data?.find((profile) => profile.id === editingProfileId) ?? null) : null
            }
            sourceAvatarUrl={selectedSource?.avatarUrl ?? null}
            avatarPending={uploadAvatar.isPending || useSourceAvatar.isPending || removeAvatar.isPending}
            onUploadAvatar={(file) => {
              if (!editingProfileId) return;
              uploadAvatar.mutate(
                { accountId: editingProfileId, file },
                {
                  onError: (error) =>
                    toast.error(errorMessage(error, localizeUi("ui.noodle.stageprofileform.couldNotUpdateAvatar"))),
                },
              );
            }}
            onUseSourceAvatar={() => {
              if (!editingProfileId) return;
              useSourceAvatar.mutate(
                { accountId: editingProfileId },
                {
                  onError: (error) =>
                    toast.error(errorMessage(error, localizeUi("ui.noodle.stageprofileform.couldNotUpdateAvatar"))),
                },
              );
            }}
            onRemoveAvatar={() => {
              if (!editingProfileId) return;
              removeAvatar.mutate(
                { accountId: editingProfileId },
                {
                  onError: (error) =>
                    toast.error(errorMessage(error, localizeUi("ui.noodle.stageprofileform.couldNotUpdateAvatar"))),
                },
              );
            }}
            onCancel={editingProfileId ? closeProfileEditor : cancelCreateProfile}
            onSave={saveProfile}
          />
        </NoodlerFrame>
      </NoodleShell>
    );
  }

  if (selectedProfile) {
    const ownsSelectedProfile = selectedProfile.sourceAccountId === viewerPersonaId;
    const similarCreators = (viewerQuery.data?.creators ?? [])
      .filter(
        (creator) => creator.profile.id !== selectedProfile.id && creator.profile.sourceAccountId !== viewerPersonaId,
      )
      .slice(0, 2);
    const profileRail = ownsSelectedProfile ? (
      <aside
        className="relative hidden w-[20rem] shrink-0 overflow-hidden px-4 py-5 @min-[1280px]:block"
        aria-labelledby="slurp-creator-tools-heading"
      >
        <div className="sticky top-4 space-y-3">
          <h2
            id="slurp-creator-tools-heading"
            className="px-1 text-xs font-black uppercase tracking-[0.14em] text-[var(--muted-foreground)]"
          >
            {localizeUi("ui.slurp.profile.creatorTools", { defaultValue: "Creator tools" })}
          </h2>
          <section className="overflow-hidden rounded-2xl bg-[var(--slurp-surface)] shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)]">
            {[
              {
                label: localizeUi("ui.slurp.profile.editProfile", { defaultValue: "Edit profile" }),
                icon: Pencil,
                action: () => beginEdit(selectedProfile),
              },
              {
                label: localizeUi("ui.slurp.profile.createPost", { defaultValue: "Create post" }),
                icon: Plus,
                action: () => {
                  updateNoodlerPostDraft(selectedProfile.id, { postType: "post", poll: null });
                  setComposerOpenSignal((tick) => tick + 1);
                },
              },
              {
                label: localizeUi("ui.slurp.profile.addStory", { defaultValue: "Add story" }),
                icon: Sparkles,
                action: () => {
                  updateNoodlerPostDraft(selectedProfile.id, { postType: "story", poll: null, title: "" });
                  setComposerOpenSignal((tick) => tick + 1);
                },
              },
              {
                label: localizeUi("ui.slurp.profile.openStudio", { defaultValue: "Open studio" }),
                icon: LayoutGrid,
                action: () => void goToStudio(),
              },
            ].map(({ label, icon: Icon, action }, index) => (
              <button
                key={label}
                type="button"
                onClick={action}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm font-bold transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]",
                  index > 0 && "border-t border-[var(--noodle-divider)]",
                )}
              >
                <Icon size={17} className="text-[var(--noodle-accent)]" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                <ChevronRight size={15} className="text-[var(--muted-foreground)]" aria-hidden="true" />
              </button>
            ))}
          </section>
        </div>
      </aside>
    ) : similarCreators.length > 0 ? (
      <aside
        className="relative hidden w-[20rem] shrink-0 overflow-hidden px-4 py-5 @min-[1280px]:block"
        aria-labelledby="slurp-similar-creators-heading"
      >
        <div className="sticky top-4 space-y-3">
          <h2
            id="slurp-similar-creators-heading"
            className="px-1 text-xs font-black uppercase tracking-[0.14em] text-[var(--muted-foreground)]"
          >
            {localizeUi("ui.slurp.profile.similarCreators", { defaultValue: "More creators" })}
          </h2>
          {similarCreators.map((creator) => (
            <SlurpCreatorProfileCard
              key={creator.profile.id}
              creator={creator}
              onOpenProfile={(accountId) => onNavigate({ mode: "creator", view: "profile", accountId })}
            />
          ))}
        </div>
      </aside>
    ) : undefined;
    return (
      <NoodleShell {...shellProps} contextualRail={profileRail ? "populated" : "spanning"} rightRail={profileRail}>
        <div className="h-full min-h-0 overflow-y-auto">
          <StageProfileView
            key={`${selectedProfile.id}:${shellPersonaAccount?.id ?? "no-viewer"}`}
            profile={selectedProfile}
            profileDraft={editingProfileId === selectedProfile.id ? profileDraft : null}
            composerOpenSignal={composerOpenSignal}
            onProfileChange={(patch) => setProfileDraft((current) => (current ? { ...current, ...patch } : current))}
            onCancelEdit={closeProfileEditor}
            onSaveEdit={(location) => void saveProfile(location)}
            profileSavePending={updateProfile.isPending}
            onOpenMessages={(creatorAccountId) =>
              onNavigate({ mode: "creator", view: "messages", creatorAccountId, returnTo: navigation })
            }
            posts={postsQuery.data ?? []}
            viewerCreator={selectedViewerCreator}
            viewerAccount={shellPersonaAccount}
            viewerActorAccount={viewerActorAccount}
            slurpSettings={slurpSettingsQuery.data ?? null}
            postCardCtx={postCardCtx}
            viewerAccounts={viewerAccounts}
            connectionCounts={connectionCountsQuery.data ?? {}}
            viewerIsLoading={Boolean(viewerPersonaId) && !viewerQuery.data && viewerQuery.isLoading}
            viewerIsError={Boolean(viewerPersonaId) && !viewerQuery.data && viewerQuery.isError}
            onRetryViewer={() => void viewerQuery.refetch()}
            draft={noodlerPostDrafts[selectedProfile.id] ?? EMPTY_NOODLER_POST_DRAFT}
            onDraftChange={(patch) => updateNoodlerPostDraft(selectedProfile.id, patch)}
            onClearDraft={() => clearNoodlerPostDraft(selectedProfile.id)}
            onDiscardDraft={() => clearNoodlerPostDraft(selectedProfile.id)}
            isLoading={postsQuery.isLoading}
            isError={postsQuery.isError}
            onRetry={() => void postsQuery.refetch()}
            onEdit={() => beginEdit(selectedProfile)}
            onBack={() =>
              navigation.mode === "creator" && navigation.view === "profile" && navigation.returnToSettings
                ? onNavigate(navigation.returnToSettings)
                : onNavigate({ mode: "creator", view: profileReturnView.current })
            }
            onManualPost={submitManualPost}
            onGuidedPost={submitGuidedPost}
            manualPending={createPost.isPending}
            guidePending={generatePost.isPending}
            onRunNow={submitRunNow}
            runNowPending={runAutoPostNow.isPending}
            onUnlock={(postId) => {
              if (!viewerPersonaId) return Promise.resolve();
              return unlockPost
                .mutateAsync({ postId, personaId: viewerPersonaId })
                .then(() => undefined)
                .catch((error) => {
                  toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotUnlockThisPost")));
                  throw error;
                });
            }}
            unlockPending={unlockPost.isPending}
            onToggleFollow={toggleCreatorFollow}
            followPending={toggleFollow.isPending}
            onToggleSubscription={toggleCreatorSubscription}
            subscriptionPending={toggleSubscription.isPending}
            accessPending={updateAccess.isPending}
            onAccessChange={(access) =>
              updateAccess.mutate(
                { accountId: selectedProfile.id, ...access },
                {
                  onSuccess: () => toast.success(localizeUi("ui.noodle.noodlerhome.accessSettingsUpdated")),
                  onError: (error) =>
                    toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotUpdateAccessSettings"))),
                },
              )
            }
          />
        </div>
        {reviewModal}
      </NoodleShell>
    );
  }

  if (navigation.mode === "creator" && navigation.view === "profile") {
    return (
      <NoodleShell {...shellProps}>
        <NoodlerFrame onBack={goToHub} title={localizeUi("ui.noodle.noodlehome.profile")}>
          <EmptyState title={localizeUi("ui.noodle.viewerhub.thisPersonaHasNoLinkedNoodlerProfile")} />
        </NoodlerFrame>
      </NoodleShell>
    );
  }

  const showDiscovery = navigation.mode === "creator" && navigation.view === "search";
  // Creator discovery stays in the wide-screen rail. Narrow layouts omit it so the
  // timeline remains the primary surface instead of stacking sidebar content above it.
  const feedRightRail = (
    <aside
      className="relative hidden w-[20rem] shrink-0 overflow-hidden bg-[linear-gradient(180deg,color-mix(in_srgb,var(--slurp-surface)_52%,transparent),transparent_32rem)] px-4 py-5 @min-[1280px]:block"
      aria-labelledby="slurp-rail-discover-heading"
      data-slurp-contextual-rail="populated"
    >
      <div className="sticky top-4 space-y-6">
        <label className="flex min-h-11 items-center gap-2 rounded-xl bg-[var(--slurp-glass)] px-3 text-sm shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-white/[0.06] backdrop-blur-xl transition-[background-color,box-shadow] focus-within:bg-[var(--slurp-surface-raised)] focus-within:ring-2 focus-within:ring-[var(--noodle-accent)]">
          <Search size={17} className="shrink-0 !text-[var(--noodle-accent)]" />
          <input
            value={feedSearch}
            onChange={(event) => setFeedSearch(event.target.value)}
            placeholder={localizeUi("ui.noodle.noodlerhome.searchPostsOrCreators")}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
          />
          {feedSearch.trim() && (
            <button
              type="button"
              onClick={() => setFeedSearch("")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
              title={localizeUi("ui.noodle.noodlehome.clearSearch")}
            >
              <X size={13} />
            </button>
          )}
        </label>
        {!showDiscovery && (
          <div className="hidden pt-1 @min-[1024px]:block">
            <SubscriptionSections
              creators={(viewerQuery.data?.creators ?? []).filter(
                (creator) => creator.profile.id !== mainAuthorProfile?.id && !creator.subscribed,
              )}
              onOpenProfile={(accountId) => onNavigate({ mode: "creator", view: "profile", accountId })}
              embedded
            />
          </div>
        )}
        {showDiscovery && (
          <section className="overflow-hidden rounded-2xl bg-[var(--slurp-surface)] shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)]">
            <div className="flex items-center justify-between gap-3 p-4 pb-3">
              <div>
                <h2 className="text-sm font-black">
                  {localizeUi("ui.slurp.discover.topCreators", { defaultValue: "Top creators" })}
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  {localizeUi("ui.slurp.discover.topCreatorsDetail", { defaultValue: "Who everyone is loving" })}
                </p>
              </div>
              <div
                className="flex rounded-full bg-[var(--accent)] p-1"
                role="group"
                aria-label={localizeUi("ui.slurp.discover.rankBy", { defaultValue: "Rank creators by" })}
              >
                {(
                  [
                    ["likes", Heart, localizeUi("ui.slurp.discover.likes", { defaultValue: "Likes" })],
                    [
                      "subscribers",
                      Crown,
                      localizeUi("ui.slurp.discover.subscribers", { defaultValue: "Subscribers" }),
                    ],
                  ] as const
                ).map(([value, Icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDiscoverRank(value)}
                    aria-pressed={discoverRank === value}
                    aria-label={label}
                    title={label}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-[background-color,color,transform] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none",
                      discoverRank === value &&
                        "bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950 shadow-sm",
                    )}
                  >
                    <Icon size={14} fill={discoverRank === value ? "currentColor" : "none"} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
            <ol className="border-t border-[var(--noodle-divider)]">
              {(viewerQuery.data?.creators ?? [])
                .slice()
                .sort((a, b) => {
                  const score = (creator: typeof a) =>
                    discoverRank === "subscribers"
                      ? (connectionCountsQuery.data?.[creator.profile.id]?.fans ?? 0)
                      : creator.posts.reduce((total, post) => total + (post.likeCount ?? 0), 0);
                  return score(b) - score(a);
                })
                .slice(0, 5)
                .map((creator, index) => {
                  const score =
                    discoverRank === "subscribers"
                      ? (connectionCountsQuery.data?.[creator.profile.id]?.fans ?? 0)
                      : creator.posts.reduce((total, post) => total + (post.likeCount ?? 0), 0);
                  return (
                    <li key={creator.profile.id}>
                      <button
                        type="button"
                        onClick={() => onNavigate({ mode: "creator", view: "profile", accountId: creator.profile.id })}
                        className="group flex min-h-14 w-full items-center gap-3 border-b border-[var(--noodle-divider)] px-4 text-left transition-colors last:border-b-0 hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
                      >
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.68rem] font-black tabular-nums",
                            index === 0
                              ? "bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950"
                              : "bg-[var(--accent)] text-[var(--muted-foreground)]",
                          )}
                        >
                          {index + 1}
                        </span>
                        <Avatar account={creator.profile} size="xs" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold">{creator.profile.displayName}</span>
                          <span className="block truncate text-[0.68rem] text-[var(--muted-foreground)]">
                            @{creator.profile.handle}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-xs font-black tabular-nums text-[var(--noodle-accent)]">
                          {discoverRank === "subscribers" ? (
                            <Crown size={12} aria-hidden="true" />
                          ) : (
                            <Heart size={12} fill="currentColor" aria-hidden="true" />
                          )}
                          {score.toLocaleString()}
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ol>
          </section>
        )}
      </div>
    </aside>
  );

  // Messages and Wallet are navigation destinations before they are features, so the
  // shell can show them as real pages instead of a dead button.
  if (navigation.mode === "creator" && navigation.view === "wallet") {
    return (
      <NoodleShell {...shellProps}>
        <SlurpWalletView
          personaId={viewerPersonaId}
          fallbackCoins={viewerWalletsQuery.data?.[viewerPersonaId ?? ""]?.coins ?? SLURP_PLACEHOLDER_BALANCE}
          personaName={shellPersonaAccount?.displayName ?? ""}
          personaAvatarUrl={shellPersonaAccount?.avatarUrl ?? null}
          personaAvatarCrop={shellPersonaAccount?.avatarCrop ?? null}
          creatorAvatarCrop={myCreatorProfile?.avatarCrop ?? null}
          onBack={exitToCreatorHub}
        />
      </NoodleShell>
    );
  }

  if (navigation.mode === "creator" && navigation.view === "notifications") {
    return (
      <NoodleShell {...shellProps} contextualRail="spanning">
        <SlurpInboxView
          personaId={viewerPersonaId}
          ownedCreatorAccountIds={myCreatorProfile ? [myCreatorProfile.id] : []}
          composeWithCreatorAccountId={null}
          initialActivity
          onBack={exitToCreatorHub}
          onOpenProfile={(accountId) => onNavigate({ mode: "creator", view: "profile", accountId })}
        />
      </NoodleShell>
    );
  }

  if (navigation.mode === "creator" && navigation.view === "studio") {
    return (
      <NoodleShell {...shellProps}>
        <SlurpStudioView
          personaId={viewerPersonaId}
          onBack={exitToCreatorHub}
          onOpenProfile={(accountId) => onNavigate({ mode: "creator", view: "profile", accountId })}
        />
      </NoodleShell>
    );
  }

  if (navigation.mode === "creator" && navigation.view === "messages") {
    return (
      <NoodleShell {...shellProps} contextualRail="spanning">
        <SlurpInboxView
          personaId={viewerPersonaId}
          ownedCreatorAccountIds={myCreatorProfile ? [myCreatorProfile.id] : []}
          composeWithCreatorAccountId={navigation.creatorAccountId ?? null}
          initialActivity={false}
          onBack={navigation.returnTo ? () => onNavigate(navigation.returnTo!) : exitToCreatorHub}
          leaveOnExit={Boolean(navigation.returnTo)}
          onOpenProfile={(accountId) => onNavigate({ mode: "creator", view: "profile", accountId })}
        />
      </NoodleShell>
    );
  }

  if (navigation.mode === "creator" && navigation.view === "profiles") {
    return (
      <NoodleShell {...shellProps}>
        <div className="flex h-full min-h-0 flex-col">
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex min-h-14 flex-wrap items-center gap-3 border-b border-[var(--noodle-divider)] px-4 py-3">
              {navigation.returnToSettings && (
                <button
                  type="button"
                  onClick={() => onNavigate(navigation.returnToSettings!)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--noodle-accent)] hover:bg-[var(--accent)]"
                  aria-label={localizeUi("ui.noodle.socialsettings.backToSettings")}
                  title={localizeUi("ui.noodle.socialsettings.backToSettings")}
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{localizeUi("ui.noodle.noodlerhome.stageProfiles")}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {localizeUi("ui.noodle.noodlerhome.noodlerIdentitiesAndGuidedPosts")}
                </p>
              </div>
              {shellPersonaAccount && (
                <button
                  type="button"
                  onClick={() =>
                    onNavigate(
                      myCreatorProfile
                        ? { mode: "creator", view: "profile", accountId: myCreatorProfile.id }
                        : {
                            mode: "creator",
                            view: "create-profile",
                            sourceAccountId: shellPersonaAccount.id,
                          },
                    )
                  }
                  title={localizeUi("ui.noodle.noodlerhome.myCreatorProfileDetail", {
                    persona: shellPersonaAccount.displayName,
                  })}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)]"
                >
                  <UserRound size={15} />
                  {localizeUi(
                    myCreatorProfile
                      ? "ui.noodle.noodlerhome.myCreatorProfile"
                      : "ui.noodle.noodlerhome.createMyCreatorProfile",
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={beginCreate}
                disabled={sourcePickerLoading || eligibleAccountsQuery.isError || eligibleNoodleAccounts.length === 0}
                title={
                  sourcePickerLoading
                    ? localizeUi("ui.noodle.noodlerhome.loadingEligibleSources")
                    : eligibleAccountsQuery.isError
                      ? localizeUi("ui.noodle.noodlerhome.sourcesUnavailable")
                      : eligibleNoodleAccounts.length === 0
                        ? localizeUi("ui.noodle.noodlerhome.everyEligibleAccountAlreadyHasAStageProfile")
                        : undefined
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={15} />
                {localizeUi("ui.noodle.noodlerhome.newProfile")}
              </button>
            </div>
            {accountsQuery.isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 size={24} className="animate-spin text-[var(--noodle-accent)]" />
              </div>
            ) : accountsQuery.isError ? (
              <EmptyState
                title={localizeUi("ui.noodle.noodlerhome.stageProfilesCouldNotBeLoaded")}
                action={localizeUi("capabilities.actions.tryAgain")}
                onAction={retryAccountsOrReload}
                icon={TriangleAlert}
              />
            ) : accountsQuery.data && accountsQuery.data.length > 0 ? (
              <div className="divide-y divide-[var(--noodle-divider)]">
                {accountsQuery.data.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() =>
                      onNavigate({
                        mode: "creator",
                        view: "profile",
                        accountId: profile.id,
                        ...(navigation.returnToSettings && { returnToSettings: navigation.returnToSettings }),
                      })
                    }
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-4 text-left hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
                  >
                    <ProfileInitial profile={profile} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold">{profile.displayName}</h3>
                        <DisclosureBadge mode={profile.disclosureMode} />
                        {isSlurpDiscoveryProfileIncomplete(profile) && (
                          <span
                            title={localizeUi("ui.slurp.profile.incompleteDetail")}
                            className="rounded-full border border-amber-500/50 px-2 py-0.5 text-[0.68rem] font-bold text-amber-600 dark:text-amber-400"
                          >
                            {localizeUi("ui.slurp.profile.incomplete")}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">
                        {profile.disclosureMode
                          ? localizeUi("ui.noodle.noodlehome.value1_0a5edda", { value1: profile.handle })
                          : localizeUi("ui.noodle.noodlerhome.completeThisLegacyStageProfile")}
                      </p>
                    </div>
                    <ChevronRight size={17} className="shrink-0 text-[var(--muted-foreground)]" />
                  </button>
                ))}
              </div>
            ) : (
              // With no profiles and no eligible sources loaded, the create button is disabled, so a
              // failed sources query would leave the page with nothing to act on but a page reload.
              <EmptyState
                title={
                  eligibleAccountsQuery.isError
                    ? localizeUi("ui.noodle.noodlerhome.sourcesUnavailable")
                    : localizeUi("ui.noodle.noodlerhome.noStageProfilesYet")
                }
                detail={localizeUi("ui.noodle.noodlerhome.createStageIdentityDetail")}
                action={
                  eligibleAccountsQuery.isError
                    ? localizeUi("capabilities.actions.tryAgain")
                    : eligibleNoodleAccounts.length > 0
                      ? localizeUi("ui.noodle.noodlehome.createStageProfile")
                      : undefined
                }
                onAction={
                  eligibleAccountsQuery.isError
                    ? () => void eligibleAccountsQuery.refetch()
                    : eligibleNoodleAccounts.length > 0
                      ? beginCreate
                      : undefined
                }
                icon={eligibleAccountsQuery.isError ? TriangleAlert : undefined}
              />
            )}
          </main>
        </div>
      </NoodleShell>
    );
  }

  return (
    <NoodleShell {...shellProps} contextualRail="populated" rightRail={feedRightRail}>
      <ViewerHub
        personas={personas}
        personasLoading={personasQuery.isLoading}
        personasError={personasQuery.isError}
        onRetryPersonas={() => void personasQuery.refetch()}
        scope={viewerQuery.data}
        newSinceAt={viewerQuery.data ? (frozenFeedSeenAt[viewerQuery.data.viewer.id] ?? null) : null}
        onFeedShown={markFeedShown}
        onOpenWallet={goToWallet}
        walletCoins={activeWalletCoins}
        isLoading={viewerQuery.isLoading}
        isError={viewerQuery.isError}
        onRetry={() => void viewerQuery.refetch()}
        onRefresh={() =>
          void viewerQuery.refetch().then(({ error }) => {
            if (error) {
              toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotRefreshNoodlerCreators")));
              return;
            }
            toast.success(localizeUi("ui.slurp.feed.refreshed"));
          })
        }
        isRefreshing={viewerQuery.isRefetching}
        unlockPending={unlockPost.isPending}
        postCardCtx={postCardCtx}
        onUnlock={(postId) => {
          if (!viewerPersonaId) return Promise.resolve();
          return unlockPost
            .mutateAsync({ postId, personaId: viewerPersonaId })
            .then(() => undefined)
            .catch((error) => {
              toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotUnlockThisPost")));
              throw error;
            });
        }}
        search={feedSearch}
        onSearchChange={setFeedSearch}
        discoveryOpen={showDiscovery}
        onCloseDiscovery={closeNoodlerSearch}
        discoveryInputRef={discoveryInputRef}
        tab={feedTab}
        onTabChange={setFeedTab}
        authorProfile={accountsQuery.isSuccess ? mainAuthorProfile : null}
        onAddStory={openStoryComposer}
        onOpenAuthorProfile={
          mainAuthorProfile
            ? () => onNavigate({ mode: "creator", view: "profile", accountId: mainAuthorProfile.id })
            : undefined
        }
        onToggleSubscription={toggleCreatorSubscription}
        togglePending={toggleSubscription.isPending || toggleFollow.isPending}
        connectionCounts={connectionCountsQuery.data ?? {}}
        inlineAdsEnabled={slurpSettingsQuery.data?.inlineAdsEnabled !== false}
        inlineAdsFrequency={slurpSettingsQuery.data?.inlineAdsFrequency ?? "standard"}
        storyLifetimeHours={slurpSettingsQuery.data?.storyLifetimeHours ?? 72}
      />
      <SlurpOnboardingWizard
        open={onboardingMode !== null}
        onClose={closeOnboarding}
        onComplete={() => {
          setOnboardingState("completed");
          setFeedTab("all");
        }}
        onSkipped={() => setOnboardingState("completed")}
      />
      <Modal
        open={gateOpen && !splashOpen}
        onClose={() => undefined}
        title={localizeUi("ui.noodle.noodlemodetoggle.noodler")}
        width="max-w-md"
        panelClassName="noodle-icon-scope"
        panelStyle={getNoodleAccentStyle(NOODLE_PINK)}
        closeDisabled
      >
        <SlurpAgeGate
          personaName={shellPersonaAccount?.displayName ?? ""}
          onComplete={enterFromGate}
          onCelebrate={() => setGateCelebrating(true)}
          onLeave={onLeave}
          isPending={false}
        />
      </Modal>
      <SlurpSplash open={splashOpen} onDismiss={() => setSplashOpen(false)} />
      {gateCelebrating && <SlurpConfetti fixed />}
      {reviewModal}
    </NoodleShell>
  );
}
