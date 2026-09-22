import { useEffect, useRef, useState } from "react";
import { useSlurpHomePostActions } from "./slp-home-post-actions";
import { SLP_CREATOR_POST_TITLE_MAX_LENGTH } from "../../../../shared/src/slp/slp-social.schema.js";
import type {
  SlpAccount,
  SlpCreatorManagedPost,
  SlpCreatorSourceSnapshot,
  SlpIdentityDisclosure,
} from "../../../../shared/src/slp/slp-social.types.js";
import type { SlurpStageProfileInput } from "../base/state/slp-state-types";
import { useCreatorConnectionCounts } from "../features/audience/slp-audience-hooks";
import {
  useCreateCreatorStageProfile,
  useGenerateCreatorStageProfileDraft,
  useRemoveCreatorAvatar,
  useUpdateCreatorProfileLocation,
  useUpdateCreatorStageProfile,
  useUploadCreatorAvatar,
  useUseCreatorSourceAvatar,
} from "../features/creators/slp-creator-profile-hooks";
import { useCreatorAccounts, useCreatorEligibleAccounts } from "../features/creators/slp-creators-hooks";
import { useCreatorViewerWallets } from "../features/economy/slp-economy-hooks";
import {
  useConfirmCreatorImagePrompts,
  useCreateCreatorPost,
  useDeleteCreatorPost,
  useRestoreCreatorPost,
  useGenerateCreatorSlpPost,
  useGenerateCreatorPostImage,
  useLoadCreatorPostImage,
  useCreatorPosts,
  useReplaceCreatorPostImage,
  useUpdateCreatorPost,
} from "../features/feed/slp-feed-post-hooks";
import { useRunCreatorAutoPostNow, useUpdateCreatorAutoPosting } from "../features/feed/slp-feed-schedule-hooks";
import {
  useCreateCreatorInteraction,
  useDeleteCreatorInteraction,
  useMarkCreatorFeedSeen,
  useCreatorUnseenCount,
  useCreatorViewer,
  useRemoveCreatorInteraction,
  useToggleCreatorFollow,
  useToggleCreatorSubscription,
  useTriggerCreatorReply,
  useUnlockCreatorPost,
  useUpdateCreatorInteraction,
} from "../features/feed/slp-feed-viewer-hooks";
import { useSlurpUnreadCount } from "../features/messages/slp-messages-hooks";
import { useSlurpNotificationUnseenCount } from "../features/notifications/slp-notification-hooks";
import { useSlurpSettings, useUpdateSlurpSettings } from "../features/settings/slp-settings-hooks";
import { useActivePersona, usePersonas } from "../../hooks/use-creator-personas";
import { useSlurpConnections } from "../base/state/slp-host-connections";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { useSlurpUIStore } from "../base/state/slp-package-store";
import { api } from "../../lib/api-client";
import type { SlpPostCardModel } from "../modules/post/SlpPostTypes";
import {
  type SlpCreatorPostDraft,
  EMPTY_SLP_CREATOR_POST_DRAFT,
  isEmptyCreatorPostDraft,
  errorMessage,
  SLURP_PLACEHOLDER_BALANCE,
} from "./screens/SlpHomeHelpers";
import { useSlpPostCardController } from "../modules/post/SlpPostHooks";
import type { ImagePromptReviewItem } from "../../components/ui/ImagePromptReviewModal";
import type { SlurpNavigationState } from "../base/navigation/slp-navigation.types";
import { useTranslation as useUiTranslation } from "react-i18next";
import { confirmLeaveSlurpBackstage } from "../features/backstage/SlpBackstageControls";
import { SLP_PERSONA_SWITCHER_PAGE_SIZE } from "../base/chrome/SlpChrome";
import { toast } from "sonner";
import { slurp2SplashPending } from "../features/onboarding/SlpSplash";
import type { SlurpHomeProps } from "./slp-home.types";
export function useSlurpHomeBaseState({ navigation, onNavigate, onLeave }: SlurpHomeProps) {
  const { t: localizeUi } = useUiTranslation();
  const creatorView = navigation.mode === "creator" ? navigation.view : null;
  const viewerSurfaceActive = creatorView !== null && ["hub", "search", "profile"].includes(creatorView);
  const accountsQuery = useCreatorAccounts();
  const retryAccountsOrReload = async () => {
    if ((await accountsQuery.refetch()).isError) window.location.reload();
  };
  const connectionCountsQuery = useCreatorConnectionCounts(viewerSurfaceActive);
  const viewerWalletsQuery = useCreatorViewerWallets();
  const slurpSettingsQuery = useSlurpSettings();
  const updateSlurpSettings = useUpdateSlurpSettings();
  const personasQuery = usePersonas();
  const activePersonaQuery = useActivePersona();
  const onboardingState = useSlurpUIStore((state) => state.onboardingState);
  const setOnboardingState = useSlurpUIStore((state) => state.setOnboardingState);
  useEffect(() => {
    if (slurpSettingsQuery.data?.onboarding === "completed" && onboardingState !== "completed") {
      setOnboardingState("completed");
    }
  }, [onboardingState, setOnboardingState, slurpSettingsQuery.data?.onboarding]);
  const storedPersonaId = useSlurpUIStore((state) => state.viewerPersonaId);
  const setStoredPersonaId = useSlurpUIStore((state) => state.setViewerPersonaId);
  const personas = personasQuery.data ?? [];
  const viewerPersonaId =
    (storedPersonaId && personas.some((persona) => persona.id === storedPersonaId) ? storedPersonaId : null) ??
    activePersonaQuery.data?.id ??
    personas[0]?.id ??
    null;
  const activeWalletCoins = viewerWalletsQuery.data?.[viewerPersonaId ?? ""]?.coins ?? SLURP_PLACEHOLDER_BALANCE;
  const viewerAccounts = personas.map(
    (persona) =>
      ({
        id: persona.id,
        entityId: persona.id,
        kind: "persona" as const,
        handle: persona.name,
        displayName: persona.name,
        avatarUrl: persona.avatarPath,
        avatarCrop: persona.avatarCrop,
        settings: { social: {} },
      }) as SlpAccount,
  );
  const shellPersonaAccount = viewerAccounts.find((account) => account.entityId === viewerPersonaId) ?? null;
  const myCreatorProfile =
    (shellPersonaAccount &&
      accountsQuery.data?.find((profile) => profile.sourceAccountId === shellPersonaAccount.id)) ||
    null;
  const viewerActorAccount = shellPersonaAccount
    ? ({
        ...shellPersonaAccount,
        ...(myCreatorProfile
          ? {
              id: myCreatorProfile.id,
              handle: myCreatorProfile.handle,
              displayName: myCreatorProfile.displayName,
              bio: myCreatorProfile.bio,
              avatarUrl: myCreatorProfile.avatarUrl,
              avatarCrop: myCreatorProfile.avatarCrop,
              createdAt: myCreatorProfile.createdAt,
              updatedAt: myCreatorProfile.updatedAt,
            }
          : {}),
      } as SlpAccount)
    : null;
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const mobileDrawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [mobileAccountSwitcherOpen, setMobileAccountSwitcherOpen] = useState(false);
  const [personaAccountLimit, setPersonaAccountLimit] = useState(SLP_PERSONA_SWITCHER_PAGE_SIZE);
  const accountSwitcherRef = useRef<HTMLDivElement | null>(null);
  const visiblePersonaAccounts = viewerAccounts.slice(0, personaAccountLimit);
  const switchViewerPersona = (account: SlpAccount, mobile: boolean) => {
    postCardController.reset();
    setEditingReplyId(null);
    setEditingReplyContent("");
    setStoredPersonaId(account.entityId);
    if (mobile) setMobileDrawerOpen(false);
    else setAccountSwitcherOpen(false);
  };
  useEffect(() => {
    if (accountSwitcherOpen) setPersonaAccountLimit(SLP_PERSONA_SWITCHER_PAGE_SIZE);
  }, [accountSwitcherOpen]);
  useEffect(() => {
    if (!mobileDrawerOpen) {
      setMobileAccountSwitcherOpen(false);
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileDrawerOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileDrawerOpen]);
  useEffect(() => {
    if (!accountSwitcherOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountSwitcherOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (accountSwitcherRef.current?.contains(event.target)) return;
      setAccountSwitcherOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [accountSwitcherOpen]);
  const replacePostImage = useReplaceCreatorPostImage();
  const loadPostImage = useLoadCreatorPostImage();
  const [noodlerPostDrafts, setNoodlerPostDrafts] = useState<Record<string, SlpCreatorPostDraft>>({});
  const updateNoodlerPostDraft = (profileId: string, patch: Partial<SlpCreatorPostDraft>) => {
    setNoodlerPostDrafts((current) => {
      const nextDraft = {
        ...EMPTY_SLP_CREATOR_POST_DRAFT,
        ...current[profileId],
        ...patch,
      };
      if (!isEmptyCreatorPostDraft(nextDraft)) {
        return {
          ...current,
          [profileId]: nextDraft,
        };
      }
      if (!current[profileId]) return current;
      const next = { ...current };
      delete next[profileId];
      return next;
    });
  };
  const clearNoodlerPostDraft = (profileId: string) => {
    setNoodlerPostDrafts((current) => {
      if (!current[profileId]) return current;
      const next = { ...current };
      delete next[profileId];
      return next;
    });
  };
  const confirmDiscardNoodlerPostDrafts = async () =>
    Object.keys(noodlerPostDrafts).length === 0 ||
    showConfirmDialog({
      title: localizeUi("ui.noodle.noodlerhome.discardNoodlerDrafts"),
      message: localizeUi("ui.noodle.noodlerhome.yourUnpublishedNoodlerPostDraftsWillBeLost"),
      confirmLabel: localizeUi("ui.noodle.noodlerhome.discardDrafts"),
      tone: "destructive",
    });
  const exitToCreatorHub = async () => {
    if (navigation.mode === "creator-settings" && !(await confirmLeaveSlurpBackstage(localizeUi))) return;
    if (!(await confirmDiscardProfileDraft())) return;
    if (!(await confirmDiscardNoodlerPostDrafts())) return;
    clearProfileEditorState();
    setNoodlerPostDrafts({});
    onNavigate({ mode: "creator", view: "hub" });
  };
  const openSettings = async () => {
    if (!(await confirmDiscardProfileDraft())) return;
    if (!(await confirmDiscardNoodlerPostDrafts())) return;
    clearProfileEditorState();
    setNoodlerPostDrafts({});
    onNavigate({
      mode: "creator-settings",
      tab: "creator",
      section: "overview",
      returnTo: { mode: "creator", view: "hub" },
    });
    setMobileDrawerOpen(false);
  };
  const [feedSearch, setFeedSearch] = useState("");
  const [discoverRank, setDiscoverRank] = useState<"likes" | "subscribers">("likes");
  const discoveryInputRef = useRef<HTMLInputElement | null>(null);
  const [feedTab, setFeedTab] = useState<"following" | "all">("all");
  const [onboardingMode, setOnboardingMode] = useState<"first-run" | "add-creators" | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [splashOpen, setSplashOpen] = useState(slurp2SplashPending);
  const [gateCelebrating, setGateCelebrating] = useState(false);
  const gatePresentedRef = useRef(false);
  const onboardingPresentedRef = useRef(false);
  const viewerQuery = useCreatorViewer(viewerPersonaId, viewerSurfaceActive);
  const noodlerUnseenCount = useCreatorUnseenCount(viewerPersonaId);
  const notificationUnseenCountQuery = useSlurpNotificationUnseenCount(viewerPersonaId);
  const unreadCountQuery = useSlurpUnreadCount(viewerPersonaId);
  const markFeedSeenMutation = useMarkCreatorFeedSeen();
  const [frozenFeedSeenAt, setFrozenFeedSeenAt] = useState<Record<string, string | null>>({});
  const feedShownForAccountRef = useRef<string | null>(null);
  const markFeedShown = () => {
    const scope = viewerQuery.data;
    if (!scope || feedShownForAccountRef.current === scope.viewer.id) return;
    feedShownForAccountRef.current = scope.viewer.id;
    setFrozenFeedSeenAt((current) => ({
      ...current,
      [scope.viewer.id]: scope.viewer.settings.social.noodlerFeedSeenAt ?? null,
    }));
    markFeedSeenMutation.mutate(scope.viewer.id);
  };
  const toggleFollow = useToggleCreatorFollow();
  const toggleSubscription = useToggleCreatorSubscription();
  const unlockPost = useUnlockCreatorPost();
  const createInteraction = useCreateCreatorInteraction();
  const triggerCreatorReply = useTriggerCreatorReply();
  const removeInteraction = useRemoveCreatorInteraction();
  const updatePost = useUpdateCreatorPost();
  const deletePost = useDeleteCreatorPost();
  const restorePost = useRestoreCreatorPost();
  const updateInteraction = useUpdateCreatorInteraction();
  const deleteInteraction = useDeleteCreatorInteraction();
  const [draftNoodleAccountId, setDraftNoodleAccountId] = useState<string | null>(null);
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourceKind, setSourceKind] = useState<"all" | "character" | "persona">("all");
  const createProfile = useCreateCreatorStageProfile();
  const updateProfile = useUpdateCreatorStageProfile();
  const updateProfileLocation = useUpdateCreatorProfileLocation();
  const uploadAvatar = useUploadCreatorAvatar();
  const useSourceAvatar = useUseCreatorSourceAvatar();
  const removeAvatar = useRemoveCreatorAvatar();
  const generatePost = useGenerateCreatorSlpPost();
  const confirmImagePrompts = useConfirmCreatorImagePrompts();
  const runAutoPostNow = useRunCreatorAutoPostNow();
  const setupAutoPosting = useUpdateCreatorAutoPosting();
  const createPost = useCreateCreatorPost();
  const generateProfileDraft = useGenerateCreatorStageProfileDraft();
  const [profileDraft, setProfileDraft] = useState<SlurpStageProfileInput | null>(null);
  const [profileDraftDirty, setProfileDraftDirty] = useState(false);
  const [imagePromptReview, setImagePromptReview] = useState<{
    accountId: string;
    items: ImagePromptReviewItem[];
  } | null>(null);
  const [creationStep, setCreationStep] = useState<"source" | "disclosure" | "draft" | "automatic" | null>(null);
  const [autoPostSetupId, setAutoPostSetupId] = useState<string | null>(null);
  const [creationDisclosure, setCreationDisclosure] = useState<SlpIdentityDisclosure>("open");
  const [draftGuidance, setDraftGuidance] = useState("");
  const [draftConnectionId, setDraftConnectionId] = useState("");
  const [previousDraft, setPreviousDraft] = useState<SlurpStageProfileInput | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const profileWorkspaceActive =
    creatorView !== null &&
    (["profiles", "create-profile"].includes(creatorView) || creationStep !== null || editingProfileId !== null);
  const eligibleAccountsQuery = useCreatorEligibleAccounts(
    sourceSearch,
    sourceKind,
    profileWorkspaceActive,
    draftNoodleAccountId,
  );
  const connectionsQuery = useSlurpConnections(
    creatorView === "create-profile" || creationStep === "draft" || editingProfileId !== null,
  );
  const connections = (connectionsQuery.data ?? []) as Array<{ id: string; name: string; model?: string }>;
  const [composerOpenSignal, setComposerOpenSignal] = useState(0);
  const profileReturnToSettingsRef = useRef<SlurpNavigationState | null>(null);
  const [acceptSourceChangesForProfileId, setAcceptSourceChangesForProfileId] = useState<string | null>(null);
  const [draftSourceSnapshot, setDraftSourceSnapshot] = useState<SlpCreatorSourceSnapshot | null>(null);
  const [draftSourceRevisionToken, setDraftSourceRevisionToken] = useState<string | null>(null);
  const profileDraftGenerationIdRef = useRef(0);
  const confirmProviderDisclosure = async () => {
    return showConfirmDialog({
      title: localizeUi("ui.slurp.providerDisclosure.title"),
      message: localizeUi("ui.slurp.providerDisclosure.generationDetail"),
      confirmLabel: localizeUi("ui.slurp.actions.continue"),
    });
  };
  const invalidateProfileDraftGeneration = () => {
    profileDraftGenerationIdRef.current += 1;
  };
  const profileDraftRouteKey =
    navigation.view === "profile"
      ? `profile:${navigation.accountId}`
      : navigation.view === "create-profile"
        ? `create-profile:${navigation.sourceAccountId}`
        : navigation.view;
  useEffect(() => {
    profileDraftGenerationIdRef.current += 1;
  }, [profileDraftRouteKey]);
  useEffect(() => {
    setDraftSourceSnapshot(null);
    setDraftSourceRevisionToken(null);
  }, [editingProfileId]);
  const profileReturnView = useRef<"hub" | "profiles">("hub");
  useEffect(() => {
    if (navigation.mode !== "creator") return;
    if (navigation.view === "hub" || navigation.view === "profiles") profileReturnView.current = navigation.view;
  }, [navigation]);
  useEffect(() => {
    if (
      navigation.mode !== "creator" ||
      navigation.view !== "profile" ||
      navigation.accountId === null ||
      !accountsQuery.isSuccess ||
      accountsQuery.data.some((profile) => profile.id === navigation.accountId)
    ) {
      return;
    }
    onNavigate({ mode: "creator", view: "profiles" });
  }, [accountsQuery.data, accountsQuery.isSuccess, navigation, onNavigate]);
  useEffect(() => {
    if (navigation.mode !== "creator" || navigation.view !== "create-profile") return;
    setEditingProfileId(null);
    setDraftNoodleAccountId(navigation.sourceAccountId);
    setProfileDraft(null);
    setProfileDraftDirty(false);
    setCreationStep("disclosure");
    setCreationDisclosure("hinted");
    setDraftGuidance("");
    setDraftConnectionId("");
    setPreviousDraft(null);
  }, [navigation]);
  const confirmDiscardProfileDraft = async (): Promise<boolean> => {
    const editing = editingProfileId
      ? (accountsQuery.data?.find((profile) => profile.id === editingProfileId) ?? null)
      : null;
    if (editing) {
      if (!profileDraftDirty) return true;
      return showConfirmDialog({
        title: localizeUi("ui.noodle.noodlerhome.discardProfileChanges"),
        message: localizeUi("ui.noodle.noodlerhome.yourUnsavedStageProfileChangesWillBeLost"),
        confirmLabel: localizeUi("ui.noodle.noodlerhome.discardChanges"),
        tone: "destructive",
      });
    }
    const hasNewDraft = Boolean(profileDraftDirty || draftGuidance.trim() || generateProfileDraft.isPending);
    if (!hasNewDraft) return true;
    return showConfirmDialog({
      title: localizeUi("ui.noodle.noodlerhome.discardProfileChanges"),
      message: localizeUi("ui.noodle.noodlerhome.yourUnsavedStageProfileChangesWillBeLost"),
      confirmLabel: localizeUi("ui.noodle.noodlerhome.discardChanges"),
      tone: "destructive",
    });
  };
  const clearProfileEditorState = () => {
    invalidateProfileDraftGeneration();
    setCreationStep(null);
    setProfileDraft(null);
    setProfileDraftDirty(false);
    setEditingProfileId(null);
    setDraftNoodleAccountId(null);
    setPreviousDraft(null);
    setAcceptSourceChangesForProfileId(null);
    setDraftSourceSnapshot(null);
    setDraftSourceRevisionToken(null);
    setSourceSearch("");
    setSourceKind("all");
    profileReturnToSettingsRef.current = null;
  };
  const prepareNavigationAwayFromProfileEditor = async () => {
    if (!(await confirmDiscardProfileDraft())) return false;
    clearProfileEditorState();
    return true;
  };
  const goToHub = async () => {
    if (!(await prepareNavigationAwayFromProfileEditor())) return;
    setFeedSearch("");
    onNavigate({ mode: "creator", view: "hub" });
    setMobileDrawerOpen(false);
  };
  const goToNoodlerSearch = async () => {
    if (!(await prepareNavigationAwayFromProfileEditor())) return;
    onNavigate({ mode: "creator", view: "search" });
    setMobileDrawerOpen(false);
    window.requestAnimationFrame(() => discoveryInputRef.current?.focus());
  };
  const goToMessages = async () => {
    if (!(await prepareNavigationAwayFromProfileEditor())) return;
    onNavigate({ mode: "creator", view: "messages" });
    setMobileDrawerOpen(false);
  };
  const goToWallet = async () => {
    if (!(await prepareNavigationAwayFromProfileEditor())) return;
    onNavigate({ mode: "creator", view: "wallet" });
    setMobileDrawerOpen(false);
  };
  const goToStudio = async () => {
    if (!(await prepareNavigationAwayFromProfileEditor())) return;
    onNavigate({ mode: "creator", view: "studio" });
    setMobileDrawerOpen(false);
  };
  const closeNoodlerSearch = () => {
    setFeedSearch("");
    onNavigate({ mode: "creator", view: "hub" });
  };
  const {
    reactToPost,
    reactToReply,
    voteInPoll,
    submitReply,
    savePost,
    deleteNoodlePost,
    deletingPostIds,
    deletedPostIds,
    restoringPostIds,
    editingReplyId,
    setEditingReplyId,
    editingReplyContent,
    setEditingReplyContent,
    startEditingReply,
    cancelEditingReply,
    saveEditedReply,
    deleteNoodleReply,
  } = useSlurpHomePostActions({
    localizeUi,
    viewerPersonaId,
    viewerActorAccount,
    confirmProviderDisclosure,
    createInteraction,
    removeInteraction,
    updateInteraction,
    deleteInteraction,
    triggerCreatorReply,
    replacePostImage,
    updatePost,
    deletePost,
    restorePost,
  });
  const postCardController = useSlpPostCardController({
    postShowMoreLength: slurpSettingsQuery.data?.postShowMoreLength,
    postManagement: false,
    personaAccount: viewerActorAccount,
    savePost,
    deletePost: deleteNoodlePost,
    reactToPost,
    reactToReply,
    voteInPoll,
    submitReply,
    creatorReplyRequest: true,
    reactionPendingFor: () => false,
    createInteractionPendingFor: (_postId, type) =>
      (type === "reply" && (createInteraction.isPending || triggerCreatorReply.isPending)) ||
      (type === "vote" && createInteraction.isPending),
    updatePostPending: updatePost.isPending || replacePostImage.isPending,
    titleMaxLength: SLP_CREATOR_POST_TITLE_MAX_LENGTH,
    allowPollOnlyEdits: true,
    replyManagement: {
      editingReplyId,
      editingReplyContent,
      setEditingReplyContent,
      startEditingReply,
      cancelEditingReply,
      saveEditedReply,
      deleteNoodleReply,
      updateInteraction,
      deleteInteraction,
    },
    deduplicatePollBody: false,
    imageEditing: {
      loadPostImage: async (post) => {
        if (!post.imageUrl) throw new Error("This post does not have an image.");
        return loadPostImage.mutateAsync({ imageUrl: post.imageUrl });
      },
    },
    openAuthorProfile: (accountId) => onNavigate({ mode: "creator", view: "profile", accountId }),
  });
  const generatePostImage = useGenerateCreatorPostImage();
  const [generatingPostImageId, setGeneratingPostImageId] = useState<string | null>(null);
  const handleGeneratePostImage = (
    post: Pick<SlpCreatorManagedPost, "id" | "authorAccountId">,
    imagePrompt?: string,
  ) => {
    setGeneratingPostImageId(post.id);
    generatePostImage.mutate(
      { id: post.id, accountId: post.authorAccountId, imagePrompt },
      {
        onError: (error) => toast.error(errorMessage(error, localizeUi("ui.slurp.image.generateFailed"))),
        onSettled: () => setGeneratingPostImageId(null),
      },
    );
  };
  const postCardCtx = {
    ...postCardController.ctx,
    generatePostImage: handleGeneratePostImage,
    generatingPostImageId,
    // Undefined without a persona rather than a no-op handler: the menu then falls back to its
    // own share-card download instead of the item doing nothing at all when it is clicked.
    sharePost: viewerPersonaId
      ? (post: SlpPostCardModel) => {
          void api
            .post("/slurp2/messages/share-post", {
              personaId: viewerPersonaId,
              creatorAccountId: post.authorAccountId,
              postId: post.id,
            })
            .then(() => toast.success(localizeUi("ui.slurp.post.shared", { defaultValue: "Post shared." })))
            .catch((error: unknown) => toast.error(errorMessage(error, localizeUi("ui.slurp.post.shareFailed"))));
        }
      : undefined,
  };
  const selectedProfile =
    navigation.mode === "creator" && navigation.view === "profile"
      ? (accountsQuery.data?.find((profile) => profile.id === navigation.accountId) ?? null)
      : null;
  const postsQuery = useCreatorPosts(selectedProfile?.id ?? null, viewerPersonaId);
  const selectedViewerCreator =
    viewerQuery.data?.creators.find((creator) => creator.profile.id === selectedProfile?.id) ?? null;
  const eligibleNoodleAccounts = eligibleAccountsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const selectedSource = eligibleNoodleAccounts.find((account) => account.id === draftNoodleAccountId) ?? null;
  const sourcePickerLoading = eligibleAccountsQuery.isLoading || eligibleAccountsQuery.isFetching;
  const handleSourceSearch = (value: string) => {
    invalidateProfileDraftGeneration();
    setSourceSearch(value);
    setDraftNoodleAccountId(null);
  };
  const handleSourceKind = (value: "all" | "character" | "persona") => {
    invalidateProfileDraftGeneration();
    setSourceKind(value);
    setDraftNoodleAccountId(null);
  };
  useEffect(() => {
    if (
      slurpSettingsQuery.isSuccess &&
      slurpSettingsQuery.data.onboarding !== "completed" &&
      onboardingState === "unseen" &&
      navigation.mode === "creator" &&
      navigation.view === "hub" &&
      !gatePresentedRef.current
    ) {
      gatePresentedRef.current = true;
      setGateOpen(true);
    }
  }, [
    navigation.mode,
    navigation.view,
    onboardingState,
    slurpSettingsQuery.data?.onboarding,
    slurpSettingsQuery.isSuccess,
  ]);
  useEffect(() => {
    if (navigation.mode !== "creator" || navigation.view !== "hub") return;
    onboardingPresentedRef.current = false;
  }, [navigation.mode, navigation.view, onboardingState]);
  const enterFromGate = async () => {
    setGateOpen(false);
    setOnboardingState("completed");
    try {
      await updateSlurpSettings.mutateAsync({ onboarding: "completed" });
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.slurp.onboarding.saveError")));
    }
    onNavigate({ mode: "creator", view: "hub" });
  };
  useEffect(() => {
    if (!gateCelebrating) return;
    const timer = window.setTimeout(() => setGateCelebrating(false), 1_400);
    return () => window.clearTimeout(timer);
  }, [gateCelebrating]);
  const closeOnboarding = () => {
    setOnboardingMode(null);
  };
  return {
    navigation,
    onNavigate,
    localizeUi,
    accountsQuery,
    retryAccountsOrReload,
    connectionCountsQuery,
    viewerWalletsQuery,
    slurpSettingsQuery,
    updateSlurpSettings,
    personasQuery,
    activePersonaQuery,
    onboardingState,
    setOnboardingState,
    storedPersonaId,
    setStoredPersonaId,
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
    personaAccountLimit,
    setPersonaAccountLimit,
    accountSwitcherRef,
    visiblePersonaAccounts,
    switchViewerPersona,
    replacePostImage,
    loadPostImage,
    noodlerPostDrafts,
    setNoodlerPostDrafts,
    updateNoodlerPostDraft,
    clearNoodlerPostDraft,
    confirmDiscardNoodlerPostDrafts,
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
    setGateOpen,
    splashOpen,
    setSplashOpen,
    gateCelebrating,
    setGateCelebrating,
    gatePresentedRef,
    onboardingPresentedRef,
    viewerQuery,
    noodlerUnseenCount,
    notificationUnseenCountQuery,
    unreadCountQuery,
    markFeedSeenMutation,
    frozenFeedSeenAt,
    setFrozenFeedSeenAt,
    feedShownForAccountRef,
    markFeedShown,
    toggleFollow,
    toggleSubscription,
    unlockPost,
    createInteraction,
    triggerCreatorReply,
    removeInteraction,
    updatePost,
    deletePost,
    updateInteraction,
    deleteInteraction,
    draftNoodleAccountId,
    setDraftNoodleAccountId,
    sourceSearch,
    setSourceSearch,
    sourceKind,
    setSourceKind,
    eligibleAccountsQuery,
    createProfile,
    updateProfile,
    updateProfileLocation,
    uploadAvatar,
    useSourceAvatar,
    removeAvatar,
    generatePost,
    confirmImagePrompts,
    runAutoPostNow,
    setupAutoPosting,
    createPost,
    generateProfileDraft,
    connectionsQuery,
    connections,
    profileDraft,
    setProfileDraft,
    profileDraftDirty,
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
    setEditingProfileId,
    composerOpenSignal,
    setComposerOpenSignal,
    profileReturnToSettingsRef,
    acceptSourceChangesForProfileId,
    setAcceptSourceChangesForProfileId,
    draftSourceSnapshot,
    setDraftSourceSnapshot,
    draftSourceRevisionToken,
    setDraftSourceRevisionToken,
    profileDraftGenerationIdRef,
    confirmProviderDisclosure,
    invalidateProfileDraftGeneration,
    profileDraftRouteKey,
    profileReturnView,
    confirmDiscardProfileDraft,
    clearProfileEditorState,
    prepareNavigationAwayFromProfileEditor,
    goToHub,
    goToNoodlerSearch,
    goToMessages,
    goToWallet,
    goToStudio,
    closeNoodlerSearch,
    reactToPost,
    reactToReply,
    voteInPoll,
    submitReply,
    savePost,
    deleteNoodlePost,
    deletingPostIds,
    deletedPostIds,
    restoringPostIds,
    editingReplyId,
    setEditingReplyId,
    editingReplyContent,
    setEditingReplyContent,
    startEditingReply,
    cancelEditingReply,
    saveEditedReply,
    deleteNoodleReply,
    postCardController,
    generatePostImage,
    generatingPostImageId,
    setGeneratingPostImageId,
    handleGeneratePostImage,
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
  };
}
export type SlurpHomeBaseState = ReturnType<typeof useSlurpHomeBaseState>;
