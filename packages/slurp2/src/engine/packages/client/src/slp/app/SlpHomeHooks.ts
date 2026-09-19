import { useEffect, useRef, useState } from "react";
import { NOODLER_POST_TITLE_MAX_LENGTH } from "@marinara-engine/shared";
import type { NoodleAccount, NoodleInteraction, NoodlePollInput, NoodlerManagedPost, NoodlePostAccess, NoodleIdentityDisclosure, NoodlerSourceSnapshot } from "@marinara-engine/shared";
import type { SlurpManagedStageProfile, SlurpStageProfileInput } from "../base/state/slp-state-types";
import {
  useNoodlerConnectionCounts,
} from "../features/audience/slp-audience-hooks";
import {
  useCreateNoodlerStageProfile,
  useGenerateNoodlerStageProfileDraft,
  useRemoveNoodlerAvatar,
  useUpdateNoodlerProfileLocation,
  useUpdateNoodlerStageProfile,
  useUploadNoodlerAvatar,
  useUseNoodlerSourceAvatar,
} from "../features/creators/slp-creator-profile-hooks";
import { useNoodlerAccounts, useNoodlerEligibleAccounts } from "../features/creators/slp-creators-hooks";
import {
  useNoodlerViewerWallets,
} from "../features/economy/slp-economy-hooks";
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
  useSlurpThreads,
} from "../features/messages/slp-messages-hooks";
import {
  useSlurpNotifications,
} from "../features/notifications/slp-notification-hooks";
import { useSlurpSettings, useUpdateSlurpSettings } from "../features/settings/slp-settings-hooks";
import { useActivePersona, usePersonas } from "../../hooks/use-creator-personas";
import { useConnections } from "../../hooks/use-connections";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { useSlurpUIStore } from "../base/state/slp-package-store";
import {
  type NoodlerPostDraft,
  type NoodlerPostSubmission,
  EMPTY_NOODLER_POST_DRAFT,
  isEmptyNoodlerPostDraft,
  errorMessage,
  serializeNoodlerPostGuide,
  SLURP_PLACEHOLDER_BALANCE,
} from "./screens/SlpHomeHelpers";
import {
  type NoodlePostCardModel,
  type NoodlePostImageUpdate,
  useNoodlePostCardController,
} from "../modules/post/SlpPostCard";
import type {
  ImagePromptOverride,
  ImagePromptReviewItem,
} from "../../components/ui/ImagePromptReviewModal";
import type { SlurpNavigationState } from "../base/navigation/slp-navigation.types";
import { useTranslation as useUiTranslation } from "react-i18next";
import { confirmLeaveSlurpBackstage } from "../features/backstage/SlpBackstageControls";
import { confirmSlurpAvatarReview } from "../features/creators/SlpStageProfileForm";
import {
  NOODLE_PERSONA_SWITCHER_PAGE_SIZE,
  NOODLE_PINK,
} from "../base/chrome/SlpChrome";
import { ApiError } from "../../lib/api-client";
import { toast } from "sonner";
import { slurp2SplashPending } from "../features/onboarding/SlpSplash";

interface SlurpHomeProps {
  navigation: Extract<SlurpNavigationState, { mode: "creator" }>;
  onNavigate: (destination: SlurpNavigationState) => void;
  onLeave?: () => void;
}

export function useSlurpHomeState({ navigation, onNavigate, onLeave }: SlurpHomeProps) {
  const { t: localizeUi } = useUiTranslation();
  const accountsQuery = useNoodlerAccounts();
  const retryAccountsOrReload = async () => {
    if ((await accountsQuery.refetch()).isError) window.location.reload();
  };
  const connectionCountsQuery = useNoodlerConnectionCounts();
  const viewerWalletsQuery = useNoodlerViewerWallets();
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
      }) as NoodleAccount,
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
      } as NoodleAccount)
    : null;
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const mobileDrawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [mobileAccountSwitcherOpen, setMobileAccountSwitcherOpen] = useState(false);
  const [personaAccountLimit, setPersonaAccountLimit] = useState(NOODLE_PERSONA_SWITCHER_PAGE_SIZE);
  const accountSwitcherRef = useRef<HTMLDivElement | null>(null);
  const visiblePersonaAccounts = viewerAccounts.slice(0, personaAccountLimit);
  const switchViewerPersona = (account: NoodleAccount, mobile: boolean) => {
    postCardController.reset();
    setEditingReplyId(null);
    setEditingReplyContent("");
    setStoredPersonaId(account.entityId);
    if (mobile) setMobileDrawerOpen(false);
    else setAccountSwitcherOpen(false);
  };
  useEffect(() => {
    if (accountSwitcherOpen) setPersonaAccountLimit(NOODLE_PERSONA_SWITCHER_PAGE_SIZE);
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
  const replacePostImage = useReplaceNoodlerPostImage();
  const loadPostImage = useLoadNoodlerPostImage();
  const [noodlerPostDrafts, setNoodlerPostDrafts] = useState<Record<string, NoodlerPostDraft>>({});
  const updateNoodlerPostDraft = (profileId: string, patch: Partial<NoodlerPostDraft>) => {
    setNoodlerPostDrafts((current) => {
      const nextDraft = {
        ...EMPTY_NOODLER_POST_DRAFT,
        ...current[profileId],
        ...patch,
      };
      if (!isEmptyNoodlerPostDraft(nextDraft)) {
        return { ...current, [profileId]: nextDraft };
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
  const viewerQuery = useNoodlerViewer(viewerPersonaId);
  const noodlerUnseenCount = useNoodlerUnseenCount(viewerPersonaId);
  const notificationsQuery = useSlurpNotifications(viewerPersonaId);
  const inboxThreadsQuery = useSlurpThreads(viewerPersonaId);
  const markFeedSeenMutation = useMarkNoodlerFeedSeen();
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
  const toggleFollow = useToggleNoodlerFollow();
  const toggleSubscription = useToggleNoodlerSubscription();
  const unlockPost = useUnlockNoodlerPost();
  const createInteraction = useCreateNoodlerInteraction();
  const triggerCreatorReply = useTriggerNoodlerCreatorReply();
  const removeInteraction = useRemoveNoodlerInteraction();
  const updatePost = useUpdateNoodlerPost();
  const deletePost = useDeleteNoodlerPost();
  const updateInteraction = useUpdateNoodlerInteraction();
  const deleteInteraction = useDeleteNoodlerInteraction();
  const updateAccess = useUpdateNoodlerAccess();
  const [draftNoodleAccountId, setDraftNoodleAccountId] = useState<string | null>(null);
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourceKind, setSourceKind] = useState<"all" | "character" | "persona">("all");
  const eligibleAccountsQuery = useNoodlerEligibleAccounts(
    sourceSearch,
    sourceKind,
    navigation.mode === "creator",
    draftNoodleAccountId,
  );
  const createProfile = useCreateNoodlerStageProfile();
  const updateProfile = useUpdateNoodlerStageProfile();
  const updateProfileLocation = useUpdateNoodlerProfileLocation();
  const uploadAvatar = useUploadNoodlerAvatar();
  const useSourceAvatar = useUseNoodlerSourceAvatar();
  const removeAvatar = useRemoveNoodlerAvatar();
  const generatePost = useGenerateNoodlerNoodlePost();
  const confirmImagePrompts = useConfirmNoodlerImagePrompts();
  const runAutoPostNow = useRunNoodlerAutoPostNow();
  const setupAutoPosting = useUpdateNoodlerAutoPosting();
  const createPost = useCreateNoodlerPost();
  const generateProfileDraft = useGenerateNoodlerStageProfileDraft();
  const connectionsQuery = useConnections();
  const connections = (connectionsQuery.data ?? []) as Array<{ id: string; name: string; model?: string }>;
  const [profileDraft, setProfileDraft] = useState<SlurpStageProfileInput | null>(null);
  const [profileDraftDirty, setProfileDraftDirty] = useState(false);
  const [imagePromptReview, setImagePromptReview] = useState<{
    accountId: string;
    items: ImagePromptReviewItem[];
  } | null>(null);
  const [creationStep, setCreationStep] = useState<"source" | "disclosure" | "draft" | "automatic" | null>(null);
  const [autoPostSetupId, setAutoPostSetupId] = useState<string | null>(null);
  const [creationDisclosure, setCreationDisclosure] = useState<NoodleIdentityDisclosure>("open");
  const [draftGuidance, setDraftGuidance] = useState("");
  const [draftConnectionId, setDraftConnectionId] = useState("");
  const [previousDraft, setPreviousDraft] = useState<SlurpStageProfileInput | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [composerOpenSignal, setComposerOpenSignal] = useState(0);
  const profileReturnToSettingsRef = useRef<SlurpNavigationState | null>(null);
  const [acceptSourceChangesForProfileId, setAcceptSourceChangesForProfileId] = useState<string | null>(null);
  const [draftSourceSnapshot, setDraftSourceSnapshot] = useState<NoodlerSourceSnapshot | null>(null);
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
  const reactToPost = (post: NoodlePostCardModel, type: "like", active = false) => {
    if (!viewerPersonaId) return;
    const onError = (error: unknown) =>
      toast.error(
        errorMessage(
          error,
          active
            ? localizeUi("ui.noodle.noodlerhome.couldNotUndoThatReaction")
            : localizeUi("ui.noodle.noodlerhome.couldNotReactToThisPost"),
        ),
      );
    const actorAccountId = viewerActorAccount?.id;
    if (active)
      removeInteraction.mutate({ postId: post.id, personaId: viewerPersonaId, actorAccountId, type }, { onError });
    else createInteraction.mutate({ postId: post.id, personaId: viewerPersonaId, actorAccountId, type }, { onError });
  };
  const reactToReply = (post: NoodlePostCardModel, reply: NoodleInteraction, active: boolean) => {
    if (!viewerPersonaId) return;
    const payload = {
      postId: post.id,
      personaId: viewerPersonaId,
      actorAccountId: viewerActorAccount?.id,
      type: "like" as const,
      parentInteractionId: reply.id,
    };
    const onError = (error: unknown) =>
      toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotReactToThisReply")));
    if (active) removeInteraction.mutate(payload, { onError });
    else createInteraction.mutate(payload, { onError });
  };
  const voteInPoll = (post: NoodlePostCardModel, optionId: string, selectedOptionId: string | null) => {
    if (!viewerPersonaId || optionId === selectedOptionId) return;
    createInteraction.mutate(
      {
        postId: post.id,
        personaId: viewerPersonaId,
        actorAccountId: viewerActorAccount?.id,
        type: "vote",
        content: optionId,
      },
      {
        onError: (error) =>
          toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotVoteInThisPoll"))),
      },
    );
  };
  const submitReply = async (
    post: NoodlePostCardModel,
    input: {
      content: string;
      parentInteractionId: string | null;
      askForReply: boolean;
    },
  ) => {
    if (!viewerPersonaId) return;
    if (input.askForReply && !(await confirmProviderDisclosure())) return;
    const viewerReply = await createInteraction.mutateAsync(
      {
        postId: post.id,
        personaId: viewerPersonaId,
        type: "reply",
        content: input.content,
        ...(input.parentInteractionId ? { parentInteractionId: input.parentInteractionId } : {}),
      },
      {
        onError: (error) => toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotPostThisReply"))),
      },
    );
    if (!input.askForReply) return;
    try {
      await triggerCreatorReply.mutateAsync({
        postId: post.id,
        interactionId: viewerReply.id,
        personaId: viewerPersonaId,
      });
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotGenerateCreatorReply")));
    }
  };
  const savePost = async (
    post: NoodlePostCardModel,
    input: {
      title: string | null;
      content: string;
      image: NoodlePostImageUpdate | null;
      poll?: NoodlePollInput | null;
    },
  ) => {
    try {
      if (input.image?.kind === "replace") {
        await replacePostImage.mutateAsync({
          id: post.id,
          accountId: post.authorAccountId,
          file: input.image.file,
          crop: input.image.crop,
          title: input.title,
          ...(input.content !== post.content.trim() && { content: input.content }),
          ...(input.poll !== undefined && { poll: input.poll }),
        });
      } else {
        await updatePost.mutateAsync({
          id: post.id,
          accountId: post.authorAccountId,
          title: input.title,
          ...(input.content !== post.content.trim() && { content: input.content }),
          ...(input.poll !== undefined && { poll: input.poll }),
          ...(input.image?.kind === "crop" && { imageCrop: input.image.crop }),
          ...(input.image?.kind === "remove" && { removeImage: true }),
        });
      }
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotUpdateThisPost")));
      throw error;
    }
  };
  const deleteNoodlePost = async (post: NoodlePostCardModel) => {
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.noodle.noodlerhome.deleteNoodlerPost"),
      message: localizeUi("ui.slurp.posts.deleteDetail"),
      confirmLabel: localizeUi("ui.noodle.noodlehome.deletePost"),
      tone: "destructive",
    });
    if (!confirmed) return;
    deletePost.mutate(
      { id: post.id, accountId: post.authorAccountId },
      {
        onError: (error) =>
          toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotDeleteThisPost"))),
      },
    );
  };
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingReplyContent, setEditingReplyContent] = useState("");
  const startEditingReply = (reply: NoodleInteraction) => {
    setEditingReplyId(reply.id);
    setEditingReplyContent(reply.content ?? "");
  };
  const cancelEditingReply = () => {
    setEditingReplyId(null);
    setEditingReplyContent("");
  };
  const saveEditedReply = (post: NoodlePostCardModel, reply: NoodleInteraction) => {
    if (!viewerPersonaId) return;
    const content = editingReplyContent.trim();
    if (!content && !reply.imageUrl) {
      toast.error(localizeUi("ui.noodle.noodlehome.commentsNeedTextOrAnImage"));
      return;
    }
    updateInteraction.mutate(
      {
        postId: post.id,
        interactionId: reply.id,
        personaId: viewerPersonaId,
        content,
      },
      {
        onSuccess: cancelEditingReply,
        onError: (error) => toast.error(errorMessage(error, localizeUi("ui.slurp.comment.editError"))),
      },
    );
  };
  const deleteNoodleReply = async (post: NoodlePostCardModel, reply: NoodleInteraction) => {
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.slurp.comment.deleteTitle"),
      message: localizeUi("ui.noodle.noodlehome.thisRemovesTheCommentAndAnyRepliesOrLikes"),
      confirmLabel: localizeUi("ui.noodle.noodlepostcard.deleteComment"),
      tone: "destructive",
    });
    if (!confirmed || !viewerPersonaId) return;
    deleteInteraction.mutate(
      { postId: post.id, interactionId: reply.id, personaId: viewerPersonaId },
      {
        onError: (error) => toast.error(errorMessage(error, localizeUi("ui.slurp.comment.deleteError"))),
      },
    );
  };
  const postCardController = useNoodlePostCardController({
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
    titleMaxLength: NOODLER_POST_TITLE_MAX_LENGTH,
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
  const generatePostImage = useGenerateNoodlerPostImage();
  const [generatingPostImageId, setGeneratingPostImageId] = useState<string | null>(null);
  const handleGeneratePostImage = (post: Pick<NoodlerManagedPost, "id" | "authorAccountId">, imagePrompt?: string) => {
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
  };
  const selectedProfile =
    navigation.mode === "creator" && navigation.view === "profile"
      ? (accountsQuery.data?.find((profile) => profile.id === navigation.accountId) ?? null)
      : null;
  const postsQuery = useNoodlerPosts(selectedProfile?.id ?? null, viewerPersonaId);
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

  const beginCreate = () => {
    invalidateProfileDraftGeneration();
    setEditingProfileId(null);
    setDraftNoodleAccountId(null);
    setProfileDraft(null);
    setProfileDraftDirty(false);
    setCreationStep("source");
    setCreationDisclosure("hinted");
    setDraftGuidance("");
    setDraftConnectionId("");
    setPreviousDraft(null);
    setSourceSearch("");
    setSourceKind("all");
  };

  const cancelCreateProfile = async () => {
    if (!(await confirmDiscardProfileDraft())) return;
    invalidateProfileDraftGeneration();
    const sourceAccountId =
      navigation.mode === "creator" && navigation.view === "create-profile"
        ? navigation.sourceAccountId
        : draftNoodleAccountId;
    setCreationStep(null);
    setProfileDraft(null);
    setProfileDraftDirty(false);
    setDraftNoodleAccountId(null);
    setPreviousDraft(null);
    if (sourceAccountId && navigation.mode === "creator" && navigation.view === "create-profile") {
      onNavigate({ mode: "creator", view: "hub" });
    }
  };

  const beginEdit = (profile: SlurpManagedStageProfile) => {
    invalidateProfileDraftGeneration();
    setAcceptSourceChangesForProfileId(null);
    setDraftSourceSnapshot(null);
    setDraftSourceRevisionToken(null);
    setEditingProfileId(profile.id);
    profileReturnToSettingsRef.current =
      navigation.mode === "creator" && navigation.view === "profile" ? (navigation.returnToSettings ?? null) : null;
    setDraftNoodleAccountId(profile.sourceAccountId);
    setCreationDisclosure(profile.disclosureMode ?? "hinted");
    setCreationStep("draft");
    setDraftGuidance("");
    setDraftConnectionId("");
    setPreviousDraft(null);
    setProfileDraft({
      displayName: profile.displayName,
      handle: profile.handle,
      bio: profile.bio,
      stagePersonality: profile.stagePersonality,
      disclosureMode: profile.disclosureMode ?? "hinted",
      gender: profile.gender,
      tags: profile.tags,
    });
    setProfileDraftDirty(false);
  };

  const closeProfileEditor = async () => {
    await prepareNavigationAwayFromProfileEditor();
  };

  const changeDisclosure = (value: NoodleIdentityDisclosure) => {
    setCreationDisclosure(value);
    setProfileDraftDirty(true);
    setProfileDraft((current) => (current ? { ...current, disclosureMode: value } : current));
  };

  const generateDraft = async (options?: {
    noodlerAccountId?: string;
    disclosureMode?: NoodleIdentityDisclosure;
    guidance?: string;
    currentDraft?: SlurpStageProfileInput;
  }) => {
    const noodlerAccountId = options?.noodlerAccountId ?? editingProfileId;
    if (!draftNoodleAccountId && !noodlerAccountId) {
      toast.error(localizeUi("ui.noodle.noodlerhome.noSourceSelectedForThisDraft"));
      return;
    }
    if (connections.length === 0) {
      toast.error(localizeUi("ui.noodle.stageprofileform.noConnectionsConfiguredAddOneInSettingsConnections"));
      return;
    }
    if (!(await confirmProviderDisclosure())) return;
    const generationId = ++profileDraftGenerationIdRef.current;
    const draftForGeneration = options?.currentDraft ?? profileDraft;
    generateProfileDraft.mutate(
      {
        ...(noodlerAccountId ? { noodlerAccountId } : { noodleAccountId: draftNoodleAccountId! }),
        disclosureMode: options?.disclosureMode ?? creationDisclosure,
        guidance: options?.guidance ?? draftGuidance,
        currentDraft: draftForGeneration ?? undefined,
        connectionId: draftConnectionId || undefined,
      },
      {
        onSuccess: (draft) => {
          if (generationId !== profileDraftGenerationIdRef.current) return;
          if (draftForGeneration) setPreviousDraft(draftForGeneration);
          if (noodlerAccountId) setAcceptSourceChangesForProfileId(noodlerAccountId);
          const { sourceSnapshot, sourceRevisionToken, notes, ...stageProfile } = draft;
          if (notes?.length) toast.info(notes.join(" "));
          setDraftSourceSnapshot(sourceSnapshot ?? null);
          setDraftSourceRevisionToken(sourceRevisionToken ?? null);
          setProfileDraft(stageProfile);
          setProfileDraftDirty(true);
          setCreationStep("draft");
        },
        onError: (error) => {
          if (generationId !== profileDraftGenerationIdRef.current) return;
          toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotGenerateAStageProfileDraft")));
        },
      },
    );
  };

  const redraftFromSource = (profile: SlurpManagedStageProfile) => {
    beginEdit(profile);
    void generateDraft({
      noodlerAccountId: profile.id,
      disclosureMode: profile.disclosureMode ?? "hinted",
      guidance: localizeUi("ui.noodle.noodlerhome.redraftGuidance"),
      currentDraft: {
        displayName: profile.displayName,
        handle: profile.handle,
        bio: profile.bio,
        stagePersonality: profile.stagePersonality,
        disclosureMode: profile.disclosureMode ?? "hinted",
        gender: profile.gender,
        tags: profile.tags,
      },
    });
  };

  const saveProfile = async (location?: string) => {
    if (!profileDraft) return;
    const input = {
      ...profileDraft,
      handle: profileDraft.handle.replace(/^@+/u, ""),
      ...(editingProfileId && location !== undefined ? { location } : {}),
    };
    const onSuccess = (profile: SlurpManagedStageProfile & { discardedPreparedPostCount?: number }) => {
      invalidateProfileDraftGeneration();
      setProfileDraft(null);
      setProfileDraftDirty(false);
      setEditingProfileId(null);
      setDraftNoodleAccountId(null);
      setPreviousDraft(null);
      setAcceptSourceChangesForProfileId(null);
      setCreationStep(null);
      setAutoPostSetupId(null);
      onNavigate({
        mode: "creator",
        view: "profile",
        accountId: profile.id,
        ...((profileReturnToSettingsRef.current ??
        (navigation.mode === "creator" && (navigation.view === "profiles" || navigation.view === "profile")
          ? navigation.returnToSettings
          : null))
          ? {
              returnToSettings: profileReturnToSettingsRef.current ?? navigation.returnToSettings,
            }
          : {}),
      });
      profileReturnToSettingsRef.current = null;
      toast.success(
        editingProfileId
          ? localizeUi("ui.noodle.noodlerhome.stageProfileUpdated")
          : localizeUi("ui.noodle.noodlerhome.stageProfileCreated"),
      );
      if (profile.discardedPreparedPostCount) {
        toast.info(
          localizeUi("ui.noodle.noodlerhome.discardedPreparedPosts", {
            count: profile.discardedPreparedPostCount,
          }),
        );
      }
    };
    const onError = async (error: unknown) => {
      if (!editingProfileId && draftNoodleAccountId && error instanceof ApiError && error.status === 409) {
        const refreshed = await accountsQuery.refetch();
        const existing = refreshed.data?.find((profile) => profile.sourceAccountId === draftNoodleAccountId);
        if (existing) {
          clearProfileEditorState();
          onNavigate({ mode: "creator", view: "profile", accountId: existing.id });
          toast.info(localizeUi("ui.noodle.noodlerhome.thatStageProfileAlreadyExistedSoItWasOpened"));
          return;
        }
      }
      toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotSaveTheStageProfile")));
    };
    if (editingProfileId) {
      const editing = accountsQuery.data?.find((profile) => profile.id === editingProfileId);
      const review = await confirmSlurpAvatarReview({
        existing: editing ?? null,
        nextDisclosure: input.disclosureMode,
        localize: localizeUi,
        confirm: showConfirmDialog,
      });
      if (!review.proceed) return;
      const confirmAvatarReview = review.confirmAvatarReview;
      updateProfile.mutate(
        {
          accountId: editingProfileId,
          ...input,
          ...(confirmAvatarReview && { confirmAvatarReview: true }),
          acceptSourceChanges: acceptSourceChangesForProfileId === editingProfileId,
          ...(acceptSourceChangesForProfileId === editingProfileId && draftSourceSnapshot
            ? { sourceSnapshot: draftSourceSnapshot }
            : {}),
          ...(acceptSourceChangesForProfileId === editingProfileId && draftSourceRevisionToken
            ? { sourceRevisionToken: draftSourceRevisionToken }
            : {}),
        },
        {
          onSuccess: (profile) => {
            if (input.location !== undefined && viewerPersonaId) {
              updateProfileLocation.mutate(
                { accountId: editingProfileId, personaId: viewerPersonaId, location: input.location },
                { onSuccess: () => onSuccess(profile), onError },
              );
              return;
            }
            onSuccess(profile);
          },
          onError,
        },
      );
    } else if (draftNoodleAccountId) {
      createProfile.mutate({ sourceAccountId: draftNoodleAccountId, stageProfile: input }, { onSuccess, onError });
    }
  };

  const submitManualPost = async ({
    profileId,
    title,
    body,
    access,
    image,
    poll,
    format,
    postType,
    linkedPostId,
    unlockPrice,
    generateImage,
  }: NoodlerPostSubmission) => {
    const wantsImage = generateImage && !image;
    const created = await createPost.mutateAsync({
      unlockPrice: access === "locked" ? unlockPrice : null,
      ...(wantsImage ? { imagePrompt: body.trim() || title.trim() } : {}),
      targetAccountId: profileId,
      title,
      content: body,
      access,
      image,
      poll,
      format,
      postType,
      linkedPostId: linkedPostId ?? null,
    });
    toast.success(localizeUi("ui.noodle.noodlerhome.noodlerPostPublished"));
    if (wantsImage && created?.id) {
      await generatePostImage.mutateAsync({ id: created.id, accountId: profileId }).catch((error: unknown) =>
        toast.error(
          errorMessage(
            error,
            localizeUi("ui.slurp.composer.aiImageFailed", {
              defaultValue: "The post was published, but its image could not be created.",
            }),
          ),
        ),
      );
    }
  };

  const submitGuidedPost = async ({
    profileId,
    title,
    body,
    access,
    image,
    poll,
    format,
    postType,
    generateImage,
  }: NoodlerPostSubmission) => {
    if (!(await confirmProviderDisclosure())) return;
    const guide = serializeNoodlerPostGuide(title, body);
    const result = await generatePost.mutateAsync({
      mode: "noodler",
      targetAccountId: profileId,
      ...(guide ? { noodlerPostGuide: guide } : {}),
      ...(generateImage ? { generateImage: true } : {}),
      access,
      image,
      poll,
      format,
      postType,
    });
    if (result.imagePromptReview) {
      setImagePromptReview({ accountId: profileId, items: [result.imagePromptReview] });
      toast.success(localizeUi("ui.noodle.noodlerhome.noodlerPostGeneratedReviewTheImagePromptToRender"));
      return;
    }
    toast.success(localizeUi("ui.noodle.noodlerhome.noodlerPostGenerated"));
  };

  const submitRunNow = async (accountId: string) => {
    if (!(await confirmProviderDisclosure())) return;
    runAutoPostNow.mutate(accountId, {
      onSuccess: () => toast.success(localizeUi("ui.noodle.noodlerhome.automaticPostGenerated")),
      onError: (error) =>
        toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotRunAnAutomaticPostNow"))),
    });
  };

  const confirmReviewedImagePrompts = (overrides: ImagePromptOverride[]) => {
    if (!imagePromptReview) return;
    confirmImagePrompts.mutate(
      { targetAccountId: imagePromptReview.accountId, prompts: overrides },
      {
        onSuccess: ({ finalized }) => {
          setImagePromptReview(null);
          if (finalized === 0) {
            toast.error(localizeUi("ui.noodle.noodlerhome.noImageWasGeneratedForThatPrompt"));
            return;
          }
          toast.success(localizeUi("ui.noodle.noodlerhome.noodlerImageGenerated"));
        },
        onError: (error) =>
          toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotGenerateTheReviewedImage"))),
      },
    );
  };

  const toggleCreatorSubscription = (creatorAccountId: string, subscribed: boolean) => {
    if (!viewerPersonaId) return Promise.resolve();
    return toggleSubscription
      .mutateAsync({ creatorAccountId, personaId: viewerPersonaId, subscribed })
      .then(() => undefined)
      .catch((error) => {
        toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotUpdateYourSubscription")));
        throw error;
      });
  };

  const toggleCreatorFollow = (creatorAccountId: string, followed: boolean) => {
    if (!viewerPersonaId) return;
    toggleFollow.mutate(
      { creatorAccountId, personaId: viewerPersonaId, followed: !followed },
      {
        onError: (error) =>
          toast.error(errorMessage(error, localizeUi("ui.noodle.noodlehome.couldNotUpdateFollowedAccounts"))),
      },
    );
  };

  const mainAuthorProfile = shellPersonaAccount
    ? (accountsQuery.data?.find((profile) => profile.sourceAccountId === shellPersonaAccount.id) ?? null)
    : null;
  const openPostComposer = () => {
    if (mainAuthorProfile) {
      onNavigate({ mode: "creator", view: "profile", accountId: mainAuthorProfile.id });
    } else if (shellPersonaAccount) {
      onNavigate({ mode: "creator", view: "create-profile", sourceAccountId: shellPersonaAccount.id });
    } else {
      onNavigate({ mode: "creator", view: "profiles" });
    }
    setMobileDrawerOpen(false);
  };
  const openStoryComposer = () => {
    if (mainAuthorProfile) {
      updateNoodlerPostDraft(mainAuthorProfile.id, { postType: "story", poll: null, title: "" });
    }
    openPostComposer();
  };

  return {
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
    notificationsQuery,
    inboxThreadsQuery,
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
    updateAccess,
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
  };
}
