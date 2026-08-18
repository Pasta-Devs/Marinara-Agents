import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Link,
  Loader2,
  Lock,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  NoodleStageProfileInput,
  NoodlePollInput,
  NoodlePostImageCrop,
  NoodlerManagedStageProfile,
  NoodlerManagedPost,
  NoodlerStageProfile,
  NoodlerSourceSnapshot,
  Persona,
} from "@marinara-engine/shared";
import {
  useCreateNoodlerPost,
  useCreateNoodlerInteraction,
  useTriggerNoodlerCreatorReply,
  useCreateNoodlerStageProfile,
  useDeleteNoodlerPost,
  useGenerateNoodlerNoodlePost,
  useConfirmNoodlerImagePrompts,
  useRunNoodlerAutoPostNow,
  useGenerateNoodlerStageProfileDraft,
  useLoadNoodlerPostImage,
  useNoodlerAccounts,
  useNoodlerEligibleAccounts,
  useNoodlerPosts,
  useNoodlerSubscribers,
  useNoodlerUnseenCount,
  useMarkNoodlerFeedSeen,
  useNoodlerViewer,
  useRemoveNoodlerInteraction,
  useToggleNoodlerFollow,
  useToggleNoodlerSubscription,
  useUnlockNoodlerPost,
  useUpdateNoodlerPost,
  useReplaceNoodlerPostImage,
  useUpdateNoodlerAccess,
  useUpdateNoodlerAutoPosting,
  useUpdateNoodlerFanActivity,
  useUpdateNoodlerStageProfile,
  useSlurpSettings,
  useUpdateSlurpSettings,
  useUploadNoodlerAvatar,
  useUploadNoodlerBanner,
  useGenerateNoodlerArtwork,
  useUseNoodlerSourceAvatar,
  useRemoveNoodlerAvatar,
  type NoodlerContentFormat,
  type SlurpProfilePost,
  type NoodlerPostDraftImage,
} from "../../hooks/use-slurp";
import { useActivePersona, usePersonas } from "../../hooks/use-creator-personas";
import { useConnections } from "../../hooks/use-connections";
import { ApiError } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { useSlurpUIStore } from "../../stores/slurp-package.store";
import {
  ImagePromptReviewModal,
  type ImagePromptOverride,
  type ImagePromptReviewItem,
} from "../ui/ImagePromptReviewModal";
import {
  NoodleAnchoredPopover,
  NoodleComposerShell,
  NoodleComposerToolRow,
  createNoodleLightboxImage,
  type NoodlePostCardModel,
  type NoodlePostImageUpdate,
  useNoodlePostCardController,
} from "./SlurpPostCard";
import { LockedSlurpPostCard, SlurpCreatorPostCard } from "./SlurpCreatorPostCard";
import { ChatImageLightbox } from "../chat/ChatImageLightbox";
import { useSlurpMediaSrc } from "../../hooks/use-slurp-media-src";
import { SlurpOnboardingWizard } from "./SlurpOnboardingPanel";
import { SlurpAgeGate } from "./SlurpAgeGate";
import {
  Avatar,
  getNoodleAccentStyle,
  NewSinceLastVisitDivider,
  HIDE_ON_SCROLL_CLASS,
  NoodleShell,
  ProfileInitial,
  useHideOnScroll,
  NOODLE_PERSONA_SWITCHER_PAGE_SIZE,
  NOODLE_PINK,
  useNoodleAccent,
} from "./SlurpShell";
import { SlurpProfileSurface } from "./SlurpProfileSurface";
import { SlurpSettings } from "./SlurpSettings";
import { NoodleImageComposer } from "./SlurpImageComposer";
import { NoodlePollComposer } from "./SlurpPollComposer";
import { PostImageCropEditor, PostImageFrame } from "./PostImageCropEditor";
import { ConversationMediaPickerPanel, type ConversationMediaPickerTabId } from "../chat/ConversationMediaPickerPanel";
import { HelpTooltip } from "../ui/HelpTooltip";
import { Modal } from "../ui/Modal";
import type { SlurpNavigationState } from "./slurp-navigation.types";
import { useTranslation as useUiTranslation } from "react-i18next";

interface SlurpHomeProps {
  navigation: Extract<SlurpNavigationState, { mode: "creator" }>;
  onNavigate: (destination: SlurpNavigationState) => void;
}

const NOODLER_FEED_WINDOW_SIZE = 20;

interface NoodlerPostSubmission {
  profileId: string;
  title: string;
  body: string;
  access: NoodlePostAccess;
  image: NoodlerPostDraftImage | null;
  poll: { question: string; options: string[] } | null;
  format: NoodlerContentFormat;
}

interface NoodlerPostDraft {
  title: string;
  body: string;
  access: NoodlePostAccess;
  image: NoodlerPostDraftImage | null;
  poll: NoodlePollInput | null;
}

interface PendingNoodlerImage {
  source: File | string;
}

const EMPTY_NOODLER_POST_DRAFT: NoodlerPostDraft = {
  title: "",
  body: "",
  access: "public",
  image: null,
  poll: null,
};

function isEmptyNoodlerPostDraft(draft: NoodlerPostDraft): boolean {
  return (
    draft.title === EMPTY_NOODLER_POST_DRAFT.title &&
    draft.body === EMPTY_NOODLER_POST_DRAFT.body &&
    draft.access === EMPTY_NOODLER_POST_DRAFT.access &&
    !draft.image &&
    !draft.poll
  );
}

function NoodlerDraftImageFrame({ image }: { image: NoodlerPostDraftImage }) {
  const { t: localizeUi } = useUiTranslation();
  const sourceUrl = useMemo(
    () => (typeof image.source === "string" ? image.source : URL.createObjectURL(image.source)),
    [image.source],
  );
  useEffect(
    () => () => {
      if (image.source instanceof File) URL.revokeObjectURL(sourceUrl);
    },
    [image.source, sourceUrl],
  );
  return (
    <PostImageFrame
      src={sourceUrl}
      crop={image.crop}
      alt={localizeUi("ui.noodle.noodlehome.attachedPostImage")}
      maxHeight={240}
    />
  );
}

type NoodlerProfileTab = "posts" | "media" | "subscribers";

function toNoodlePostCardModel(view: NoodlerPostView, profile: NoodlerStageProfile): NoodlePostCardModel {
  return {
    id: view.id,
    authorAccountId: view.authorAccountId,
    access: view.access,
    title: view.title,
    content: view.content ?? "",
    imageUrl: view.imageUrl,
    imagePrompt: view.imagePrompt,
    metadata: view.metadata ?? {},
    authorSnapshot: {
      id: profile.id,
      handle: profile.handle,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      avatarCrop: profile.avatarCrop,
    },
    createdAt: view.createdAt,
    interactions: view.interactions,
  };
}

function toManagedPostCardModel(post: NoodlerManagedPost, profile: NoodlerStageProfile): NoodlePostCardModel {
  return {
    id: post.id,
    authorAccountId: post.authorAccountId,
    access: post.access,
    title: post.title,
    content: post.content,
    imageUrl: post.imageUrl,
    imagePrompt: post.imagePrompt,
    metadata: post.metadata,
    authorSnapshot: {
      id: profile.id,
      handle: profile.handle,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      avatarCrop: profile.avatarCrop,
    },
    createdAt: post.createdAt,
    interactions: [],
  };
}

type DisclosureOption = {
  value: NoodleIdentityDisclosure;
  label: string;
  shortLabel: string;
  detail: string;
  guidance: string;
};

function disclosureOptions(t: ReturnType<typeof useUiTranslation>["t"]): DisclosureOption[] {
  return [
    {
      value: "open",
      label: "Linked identity",
      shortLabel: "Open",
      detail: "This Creator may openly use the source identity.",
      guidance: "Names, handles, recognizable details, and continuity may carry over.",
    },
    {
      value: "hinted",
      label: t("ui.noodle.disclosure.hinted.label"),
      shortLabel: t("ui.noodle.disclosure.hinted.shortLabel"),
      detail: t("ui.noodle.disclosure.hinted.detail"),
      guidance: t("ui.noodle.disclosure.hinted.guidance"),
    },
    {
      value: "secret",
      label: "Separate persona",
      shortLabel: "Secret",
      detail: "Create a genuinely separate identity with no public connection.",
      guidance:
        "The AI receives a reduced, non-identifying inspiration brief and avoids distinctive canonical details.",
    },
  ];
}

const EMPTY_STAGE_PROFILE: NoodleStageProfileInput = {
  displayName: "",
  handle: "",
  bio: "",
  stagePersonality: "",
  disclosureMode: "hinted",
};

const fieldClass =
  "mari-chrome-field h-11 w-full rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-accent)]";
const textareaClass =
  "mari-chrome-field min-h-24 w-full resize-y rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] p-3 text-sm leading-6 text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-accent)]";
function serializeNoodlerPostGuide(title: string, body: string) {
  const sections: string[] = [];
  if (title.trim()) sections.push(`Title:\n${title.trim()}`);
  if (body.trim()) sections.push(`Body:\n${body.trim()}`);
  return sections.join("\n\n");
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function SlurpHome({ navigation, onNavigate }: SlurpHomeProps) {
  const { t: localizeUi } = useUiTranslation();
  const accountsQuery = useNoodlerAccounts();
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
  const viewerAccounts = personas.map(
    (persona) =>
      ({
        id: persona.id,
        entityId: persona.id,
        kind: "persona" as const,
        handle: persona.name,
        displayName: persona.name,
        avatarUrl: null,
        settings: { social: {} },
      }) as NoodleAccount,
  );
  const shellPersonaAccount = viewerAccounts.find((account) => account.entityId === viewerPersonaId) ?? null;
  // The active persona's own Creator profile. Bulk onboarding deliberately lists characters only,
  // so without this the player has no obvious way to act as a Creator themselves — the persona is
  // buried in the generic source picker among every eligible character. Both destinations already
  // exist as navigation targets, so this only decides which one the persona currently needs.
  const myCreatorProfile =
    (shellPersonaAccount &&
      accountsQuery.data?.find((profile) => profile.sourceAccountId === shellPersonaAccount.id)) ||
    null;
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileAccountSwitcherOpen, setMobileAccountSwitcherOpen] = useState(false);
  const [personaAccountLimit, setPersonaAccountLimit] = useState(NOODLE_PERSONA_SWITCHER_PAGE_SIZE);
  const accountSwitcherRef = useRef<HTMLDivElement | null>(null);
  const visiblePersonaAccounts = viewerAccounts.slice(0, personaAccountLimit);
  const switchViewerPersona = (account: NoodleAccount, mobile: boolean) => {
    // A reply/edit composed as the previous persona must not carry over and submit as the
    // newly-selected one, so discard in-flight composer, tool, and post-menu state first.
    postCardController.reset();
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
    if (!(await confirmDiscardProfileDraft())) return;
    if (!(await confirmDiscardNoodlerPostDrafts())) return;
    setNoodlerPostDrafts({});
    onNavigate({ mode: "creator", view: "hub" });
  };
  const openSettings = async () => {
    if (!(await confirmDiscardProfileDraft())) return;
    if (!(await confirmDiscardNoodlerPostDrafts())) return;
    setNoodlerPostDrafts({});
    // Open the shared two-pane settings on the NoodleR tab instead of a separate
    // stripped-down page, so both shells reach the same settings surface.
    onNavigate({
      mode: "creator-settings",
      tab: "creator",
      section: "general",
      returnTo: { mode: "creator", view: "hub" },
    });
    setMobileDrawerOpen(false);
  };
  const [feedSearch, setFeedSearch] = useState("");
  const discoveryInputRef = useRef<HTMLInputElement | null>(null);
  const [feedTab, setFeedTab] = useState<"following" | "all">("following");
  const [onboardingMode, setOnboardingMode] = useState<"first-run" | "add-creators" | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const gatePresentedRef = useRef(false);
  const onboardingPresentedRef = useRef(false);
  const viewerQuery = useNoodlerViewer(viewerPersonaId);
  const noodlerUnseenCount = useNoodlerUnseenCount(viewerPersonaId);
  const markFeedSeenMutation = useMarkNoodlerFeedSeen();
  // The stored timestamp advances as soon as the feed is shown, which would erase the divider
  // out from under the reader. Freeze the value the divider uses per persona at that moment,
  // and keep advancing the stored one so the next visit measures from here.
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
  // NoodleR is a roleplay sandbox — the user owns every stage profile, so they
  // can edit/delete creator posts just like their own Noodle timeline. NoodleR
  // posts live on NoodleR, so these route through the NoodleR-only endpoints; the
  // viewer feed is refetched on success.
  const updatePost = useUpdateNoodlerPost();
  const deletePost = useDeleteNoodlerPost();
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
  const [profileDraft, setProfileDraft] = useState<NoodleStageProfileInput | null>(null);
  const [imagePromptReview, setImagePromptReview] = useState<{
    accountId: string;
    items: ImagePromptReviewItem[];
  } | null>(null);
  const [creationStep, setCreationStep] = useState<"source" | "disclosure" | "draft" | "automatic" | null>(null);
  const [autoPostSetupId, setAutoPostSetupId] = useState<string | null>(null);
  const [creationDisclosure, setCreationDisclosure] = useState<NoodleIdentityDisclosure>("hinted");
  const [draftGuidance, setDraftGuidance] = useState("");
  const [draftConnectionId, setDraftConnectionId] = useState("");
  const [previousDraft, setPreviousDraft] = useState<NoodleStageProfileInput | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
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
  // Back from a stage profile returns to wherever it was opened from (hub feed, sidebar,
  // profile list) instead of always dumping the user on the profile list. Hub is the fallback.
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
    setCreationStep("disclosure");
    setCreationDisclosure("hinted");
    setDraftGuidance("");
    setDraftConnectionId("");
    setPreviousDraft(null);
  }, [navigation]);
  // Returns false (and blocks navigation) when there is an unsaved create/edit draft the
  // user chose to keep. Covers both new drafts and changed edits so no surface silently
  // discards work.
  const confirmDiscardProfileDraft = async (): Promise<boolean> => {
    if (!profileDraft) return true;
    const editing = editingProfileId
      ? (accountsQuery.data?.find((profile) => profile.id === editingProfileId) ?? null)
      : null;
    if (editing) {
      const savedDraft: NoodleStageProfileInput = {
        displayName: editing.displayName,
        handle: editing.handle,
        bio: editing.bio,
        stagePersonality: editing.stagePersonality,
        disclosureMode: editing.disclosureMode ?? "hinted",
      };
      if (JSON.stringify(profileDraft) === JSON.stringify(savedDraft)) return true;
    }
    return showConfirmDialog({
      title: localizeUi("ui.noodle.noodlerhome.discardProfileChanges"),
      message: localizeUi("ui.noodle.noodlerhome.yourUnsavedStageProfileChangesWillBeLost"),
      confirmLabel: localizeUi("ui.noodle.noodlerhome.discardChanges"),
      tone: "destructive",
    });
  };
  const goToHub = async () => {
    if (!(await confirmDiscardProfileDraft())) return;
    invalidateProfileDraftGeneration();
    setCreationStep(null);
    setProfileDraft(null);
    setEditingProfileId(null);
    setFeedSearch("");
    onNavigate({ mode: "creator", view: "hub" });
    setMobileDrawerOpen(false);
  };
  const goToNoodlerSearch = async () => {
    if (!(await confirmDiscardProfileDraft())) return;
    onNavigate({ mode: "creator", view: "search" });
    setMobileDrawerOpen(false);
    window.requestAnimationFrame(() => discoveryInputRef.current?.focus());
  };
  const closeNoodlerSearch = () => {
    setFeedSearch("");
    onNavigate({ mode: "creator", view: "hub" });
  };
  const reactToPost = (post: NoodlePostCardModel, type: "like" | "repost", active = false) => {
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
    if (active) removeInteraction.mutate({ postId: post.id, personaId: viewerPersonaId, type }, { onError });
    else createInteraction.mutate({ postId: post.id, personaId: viewerPersonaId, type }, { onError });
  };
  const reactToReply = (post: NoodlePostCardModel, reply: NoodleInteraction, active: boolean) => {
    if (!viewerPersonaId) return;
    const payload = {
      postId: post.id,
      personaId: viewerPersonaId,
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
      { postId: post.id, personaId: viewerPersonaId, type: "vote", content: optionId },
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
    // The comment is already posted at this point. Opting out simply stops here, so no provider
    // request is made and the failure toast below can only ever mean a reply was actually asked for.
    if (!input.askForReply) return;
    if (!(await confirmProviderDisclosure())) return;
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
      message: localizeUi("ui.noodle.noodlerhome.thisAlsoRemovesItsLikesRepostsAndReplies"),
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
  const postCardController = useNoodlePostCardController({
    postManagement: false,
    personaAccount: shellPersonaAccount,
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
    deduplicatePollBody: false,
    imageFit: "contain",
    imageEditing: {
      loadPostImage: async (post) => {
        if (!post.imageUrl) throw new Error("This post does not have an image.");
        return loadPostImage.mutateAsync({ imageUrl: post.imageUrl });
      },
    },
    openAuthorProfile: (accountId) => onNavigate({ mode: "creator", view: "profile", accountId }),
  });
  const postCardCtx = postCardController.ctx;
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

  const closeOnboarding = () => {
    setOnboardingMode(null);
  };

  // NoodleR can only be entered through the opt-in gate in NoodleHome, so a persisted
  // navigation state pointing here while the feature is off has nowhere to render. Right after the
  // gate the bootstrap can still report the pre-opt-in value, so never bounce on that first render.

  const beginCreate = () => {
    invalidateProfileDraftGeneration();
    setEditingProfileId(null);
    setDraftNoodleAccountId(null);
    setProfileDraft(null);
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
    setDraftNoodleAccountId(null);
    setPreviousDraft(null);
    if (sourceAccountId && navigation.mode === "creator" && navigation.view === "create-profile") {
      onNavigate({ mode: "creator", view: "hub" });
    }
  };

  const beginEdit = (profile: NoodlerStageProfile) => {
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
    });
  };

  const closeProfileEditor = async () => {
    if (!(await confirmDiscardProfileDraft())) return;
    invalidateProfileDraftGeneration();
    setProfileDraft(null);
    setPreviousDraft(null);
    setEditingProfileId(null);
    setCreationStep(null);
    setAcceptSourceChangesForProfileId(null);
    setDraftSourceSnapshot(null);
    setDraftSourceRevisionToken(null);
  };

  const changeDisclosure = (value: NoodleIdentityDisclosure) => {
    setCreationDisclosure(value);
    setProfileDraft((current) => (current ? { ...current, disclosureMode: value } : current));
  };

  const generateDraft = async (options?: {
    noodlerAccountId?: string;
    disclosureMode?: NoodleIdentityDisclosure;
    guidance?: string;
    currentDraft?: NoodleStageProfileInput;
  }) => {
    const noodlerAccountId = options?.noodlerAccountId ?? editingProfileId;
    if (!draftNoodleAccountId && !noodlerAccountId) return;
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
          const { sourceSnapshot, sourceRevisionToken, ...stageProfile } = draft;
          setDraftSourceSnapshot(sourceSnapshot ?? null);
          setDraftSourceRevisionToken(sourceRevisionToken ?? null);
          setProfileDraft(stageProfile);
          setCreationStep("draft");
        },
        onError: (error) => {
          if (generationId !== profileDraftGenerationIdRef.current) return;
          toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotGenerateAStageProfileDraft")));
        },
      },
    );
  };

  const redraftFromSource = (profile: NoodlerStageProfile) => {
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
      },
    });
  };

  const saveProfile = async () => {
    if (!profileDraft) return;
    const input = {
      ...profileDraft,
      handle: profileDraft.handle.replace(/^@+/u, ""),
    };
    const onSuccess = (profile: NoodlerStageProfile & { discardedPreparedPostCount?: number }) => {
      invalidateProfileDraftGeneration();
      setProfileDraft(null);
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
      // A privacy downgrade throws away unreleased reserve posts; do not do that silently.
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
          invalidateProfileDraftGeneration();
          setProfileDraft(null);
          setCreationStep(null);
          onNavigate({ mode: "creator", view: "profile", accountId: existing.id });
          toast.info(localizeUi("ui.noodle.noodlerhome.thatStageProfileAlreadyExistedSoItWasOpened"));
          return;
        }
      }
      toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotSaveTheStageProfile")));
    };
    if (editingProfileId) {
      const editing = accountsQuery.data?.find((profile) => profile.id === editingProfileId);
      const keepsSeparateAvatar = Boolean(
        editing?.avatarUrl?.startsWith(`/api/slurp/noodler/accounts/${encodeURIComponent(editing.id)}/avatar/`),
      );
      const disclosureRank: Record<NoodleIdentityDisclosure, number> = {
        secret: 0,
        hinted: 1,
        open: 2,
      };
      const disclosureDowngrade = Boolean(
        editing?.disclosureMode && disclosureRank[input.disclosureMode] < disclosureRank[editing.disclosureMode],
      );
      let confirmAvatarReview = false;
      if (disclosureDowngrade && keepsSeparateAvatar) {
        confirmAvatarReview = await showConfirmDialog({
          title: localizeUi("ui.noodle.stageprofileform.reviewSeparateAvatar"),
          message: localizeUi("ui.noodle.stageprofileform.separateAvatarReviewMessage"),
          confirmLabel: localizeUi("ui.noodle.stageprofileform.keepAvatar"),
        });
        if (!confirmAvatarReview) return;
      }
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
        { onSuccess, onError },
      );
    } else if (draftNoodleAccountId) {
      createProfile.mutate({ sourceAccountId: draftNoodleAccountId, stageProfile: input }, { onSuccess, onError });
    }
  };

  const submitManualPost = async ({ profileId, title, body, access, image, poll, format }: NoodlerPostSubmission) => {
    await createPost.mutateAsync({
      targetAccountId: profileId,
      title,
      content: body,
      access,
      image,
      poll,
      format,
    });
    toast.success(localizeUi("ui.noodle.noodlerhome.noodlerPostPublished"));
  };

  const submitGuidedPost = async ({ profileId, title, body, access, image, poll, format }: NoodlerPostSubmission) => {
    if (!(await confirmProviderDisclosure())) return;
    const guide = serializeNoodlerPostGuide(title, body);
    const result = await generatePost.mutateAsync({
      mode: "creator",
      targetAccountId: profileId,
      ...(guide ? { noodlerPostGuide: guide } : {}),
      access,
      image,
      poll,
      format,
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
      // Run-now never requests prompt review, so it only ever yields a plain generated post.
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
    if (!viewerPersonaId) return;
    toggleSubscription.mutate(
      { creatorAccountId, personaId: viewerPersonaId, subscribed },
      {
        onError: (error) =>
          toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotUpdateYourSubscription"))),
      },
    );
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

  const shellProps = {
    appMode: "slurp" as const,
    activeView:
      navigation.mode === "creator-settings"
        ? ("settings" as const)
        : navigation.mode === "creator" && navigation.view === "profile"
          ? ("profile" as const)
          : navigation.mode === "creator" && navigation.view === "search"
            ? ("search" as const)
            : ("noodler" as const),
    homeActive: navigation.mode === "creator" && navigation.view === "hub",
    noodlerUnseenCount,
    // The Noodle count matters most from here: this is where the user is while the public
    // timeline is the one filling up unwatched.
    accent: NOODLE_PINK,
    personaAccount: shellPersonaAccount,
    sortedPersonaAccounts: viewerAccounts,
    visiblePersonaAccounts,
    linkedNoodleAccountIds: new Set((accountsQuery.data ?? []).flatMap((profile) => profile.sourceAccountId ?? [])),
    onLoadMorePersonaAccounts: () => setPersonaAccountLimit((current) => current + NOODLE_PERSONA_SWITCHER_PAGE_SIZE),
    onSwitchPersona: switchViewerPersona,
    accountSwitcherOpen,
    onAccountSwitcherOpenChange: setAccountSwitcherOpen,
    accountSwitcherRef,
    mobileDrawerOpen,
    onMobileDrawerOpenChange: setMobileDrawerOpen,
    mobileAccountSwitcherOpen,
    onMobileAccountSwitcherOpenChange: setMobileAccountSwitcherOpen,
    onOpenHome: exitToCreatorHub,
    onOpenMobileHome: exitToCreatorHub,
    onOpenNoodler: goToHub,
    onOpenSearch: goToNoodlerSearch,
    onOpenProfile: () => {
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
    // Every NoodleR branch spreads shellProps, so the lightbox mounts once wherever the user is.
    overlays: postCardController.imageLightbox ? (
      <ChatImageLightbox
        image={postCardController.imageLightbox}
        alt={postCardController.imageLightbox.prompt || "NoodleR image"}
        pinEnabled={false}
        onClose={() => postCardController.setImageLightbox(null)}
      />
    ) : null,
  } as const;

  // Reserve the same rail width as the feed view (see NoodleHome's "settings" rail) so
  // non-feed screens don't stretch the shell wider and look like a different layout.
  const emptyRightRail = (
    <aside className="hidden w-[22rem] shrink-0 px-4 py-3 @min-[1280px]:block" aria-hidden="true" />
  );

  if (navigation.mode === "creator-settings") {
    return (
      <NoodleShell {...shellProps} rightRail={emptyRightRail}>
        <SlurpSettings
          navigation={navigation}
          onNavigate={onNavigate}
          onAddCreators={() => setOnboardingMode("add-creators")}
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
      <NoodleShell {...shellProps} rightRail={emptyRightRail}>
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
      <NoodleShell {...shellProps} rightRail={emptyRightRail}>
        <NoodlerFrame onBack={exitToCreatorHub} title={localizeUi("ui.noodle.noodlemodetoggle.noodler")}>
          <EmptyState
            title={localizeUi("ui.noodle.noodlerhome.noodlerCouldNotBeLoaded")}
            action={localizeUi("capabilities.actions.tryAgain")}
            onAction={() => void accountsQuery.refetch()}
          />
        </NoodlerFrame>
      </NoodleShell>
    );
  }

  if (creationStep === "source") {
    return (
      <NoodleShell {...shellProps} rightRail={emptyRightRail}>
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
      <NoodleShell {...shellProps} rightRail={emptyRightRail}>
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
      <NoodleShell {...shellProps} rightRail={emptyRightRail}>
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
                className="h-10 flex-1 rounded-full border border-transparent bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 disabled:opacity-50"
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

  if (profileDraft || creationStep === "draft") {
    return (
      <NoodleShell {...shellProps} rightRail={emptyRightRail}>
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
            onChange={(patch) =>
              setProfileDraft((current) => ({
                ...(current ?? { ...EMPTY_STAGE_PROFILE, disclosureMode: creationDisclosure }),
                ...patch,
              }))
            }
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
    return (
      <NoodleShell {...shellProps} rightRail={emptyRightRail}>
        <div className="h-full min-h-0 overflow-y-auto">
          <StageProfileView
            key={`${selectedProfile.id}:${shellPersonaAccount?.id ?? "no-viewer"}`}
            profile={selectedProfile}
            posts={postsQuery.data ?? []}
            viewerCreator={selectedViewerCreator}
            viewerAccount={shellPersonaAccount}
            slurpSettings={slurpSettingsQuery.data ?? null}
            postCardCtx={postCardCtx}
            viewerAccounts={viewerAccounts}
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
            onOpenImage={(url, id) => postCardController.setImageLightbox(createNoodleLightboxImage(id, url))}
            onEdit={() => beginEdit(selectedProfile)}
            onRedraft={() => redraftFromSource(selectedProfile)}
            redraftPending={generateProfileDraft.isPending}
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
              if (!viewerPersonaId) return;
              unlockPost.mutate(
                { postId, personaId: viewerPersonaId },
                {
                  onError: (error) =>
                    toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotUnlockThisPost"))),
                },
              );
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
      <NoodleShell {...shellProps} rightRail={emptyRightRail}>
        <NoodlerFrame onBack={goToHub} title={localizeUi("ui.noodle.noodlehome.profile")}>
          <EmptyState title={localizeUi("ui.noodle.viewerhub.thisPersonaHasNoLinkedNoodlerProfile")} />
        </NoodlerFrame>
      </NoodleShell>
    );
  }

  // Creator discovery stays in the wide-screen rail. Narrow layouts omit it so the
  // timeline remains the primary surface instead of stacking sidebar content above it.
  const feedRightRail = (
    <aside className="hidden w-[22rem] shrink-0 px-4 py-3 @min-[1280px]:block">
      <div className="sticky top-3 space-y-4">
        <label className="flex h-11 items-center gap-2 rounded-full border border-[var(--noodle-divider)] bg-[var(--background)] px-4 text-sm transition-colors focus-within:border-[var(--noodle-accent)]">
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
              className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10"
              title={localizeUi("ui.noodle.noodlehome.clearSearch")}
            >
              <X size={13} />
            </button>
          )}
        </label>

        <div className="hidden @min-[1024px]:block">
          <SubscriptionSections
            creators={(viewerQuery.data?.creators ?? []).filter(
              (creator) => creator.profile.id !== mainAuthorProfile?.id,
            )}
            onToggleSubscription={toggleCreatorSubscription}
            togglePending={toggleSubscription.isPending}
            onOpenProfile={(accountId) => onNavigate({ mode: "creator", view: "profile", accountId })}
          />
        </div>
      </div>
    </aside>
  );

  if (navigation.mode === "creator" && navigation.view === "profiles") {
    return (
      <NoodleShell {...shellProps} rightRail={emptyRightRail}>
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
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)]"
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
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
                onAction={() => void accountsQuery.refetch()}
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
              />
            )}
          </main>
        </div>
      </NoodleShell>
    );
  }

  const showDiscovery = navigation.mode === "creator" && navigation.view === "search";
  return (
    <NoodleShell {...shellProps} rightRail={feedRightRail}>
      <ViewerHub
        personas={personas}
        personasLoading={personasQuery.isLoading}
        personasError={personasQuery.isError}
        onRetryPersonas={() => void personasQuery.refetch()}
        scope={viewerQuery.data}
        newSinceAt={viewerQuery.data ? (frozenFeedSeenAt[viewerQuery.data.viewer.id] ?? null) : null}
        onFeedShown={markFeedShown}
        isLoading={viewerQuery.isLoading}
        isError={viewerQuery.isError}
        onRetry={() => void viewerQuery.refetch()}
        onRefresh={() =>
          void viewerQuery.refetch().then(({ error }) => {
            if (error) {
              toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotRefreshNoodlerCreators")));
              return;
            }
            toast.success(localizeUi("ui.noodle.noodlehome.noodleTimelineRefreshed"));
          })
        }
        isRefreshing={viewerQuery.isRefetching}
        unlockPending={unlockPost.isPending}
        postCardCtx={postCardCtx}
        onUnlock={(postId) => {
          if (!viewerPersonaId) return;
          unlockPost.mutate(
            { postId, personaId: viewerPersonaId },
            {
              onError: (error) =>
                toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotUnlockThisPost"))),
            },
          );
        }}
        search={feedSearch}
        onSearchChange={setFeedSearch}
        discoveryOpen={showDiscovery}
        onCloseDiscovery={closeNoodlerSearch}
        discoveryInputRef={discoveryInputRef}
        tab={feedTab}
        onTabChange={setFeedTab}
        onToggleFollow={toggleCreatorFollow}
        authorProfile={accountsQuery.isSuccess ? mainAuthorProfile : null}
        authorDraft={
          mainAuthorProfile
            ? (noodlerPostDrafts[mainAuthorProfile.id] ?? EMPTY_NOODLER_POST_DRAFT)
            : EMPTY_NOODLER_POST_DRAFT
        }
        onAuthorDraftChange={(patch) => {
          if (mainAuthorProfile) updateNoodlerPostDraft(mainAuthorProfile.id, patch);
        }}
        onClearAuthorDraft={() => {
          if (mainAuthorProfile) clearNoodlerPostDraft(mainAuthorProfile.id);
        }}
        onDiscardAuthorDraft={() => {
          if (mainAuthorProfile) clearNoodlerPostDraft(mainAuthorProfile.id);
        }}
        authorLoading={accountsQuery.isLoading}
        authorError={accountsQuery.isError && !accountsQuery.data}
        onRetryAuthor={() => void accountsQuery.refetch()}
        onCreateAuthorProfile={
          shellPersonaAccount
            ? () =>
                onNavigate({
                  mode: "creator",
                  view: "create-profile",
                  sourceAccountId: shellPersonaAccount.id,
                })
            : undefined
        }
        onOpenAuthorProfile={
          mainAuthorProfile
            ? () => onNavigate({ mode: "creator", view: "profile", accountId: mainAuthorProfile.id })
            : undefined
        }
        onManualPost={submitManualPost}
        onGuidedPost={submitGuidedPost}
        manualPending={createPost.isPending}
        guidePending={generatePost.isPending}
        onToggleSubscription={toggleCreatorSubscription}
        togglePending={toggleSubscription.isPending || toggleFollow.isPending}
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
        open={gateOpen}
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
          isPending={false}
        />
      </Modal>
      {reviewModal}
    </NoodleShell>
  );
}

function StageProfileForm({
  draft,
  source,
  disclosureMode,
  onDisclosureChange,
  guidance,
  onGuidanceChange,
  connections,
  connectionId,
  onConnectionChange,
  onGenerate,
  isGenerating,
  previousDraft,
  onUndoDraft,
  onChange,
  sourceAccountId,
  accentId,
  isEditing,
  isPending,
  avatar,
  sourceAvatarUrl,
  avatarPending,
  onUploadAvatar,
  onUseSourceAvatar,
  onRemoveAvatar,
  onCancel,
  onSave,
}: {
  draft: NoodleStageProfileInput;
  source: { displayName: string; handle: string; avatarUrl?: string | null } | null;
  disclosureMode: NoodleIdentityDisclosure;
  onDisclosureChange: (value: NoodleIdentityDisclosure) => void;
  guidance: string;
  onGuidanceChange: (value: string) => void;
  connections: Array<{ id: string; name: string; model?: string }>;
  connectionId: string;
  onConnectionChange: (value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  previousDraft: NoodleStageProfileInput | null;
  onUndoDraft: () => void;
  onChange: (patch: Partial<NoodleStageProfileInput>) => void;
  sourceAccountId: string | null;
  accentId: string;
  isEditing: boolean;
  isPending: boolean;
  avatar: NoodlerStageProfile | null;
  sourceAvatarUrl: string | null;
  avatarPending: boolean;
  onUploadAvatar: (file: File) => void;
  onUseSourceAvatar: () => void;
  onRemoveAvatar: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const disclosureChoices = disclosureOptions(localizeUi);
  const accent = profileAccent(accentId);
  const [connectionPickerOpen, setConnectionPickerOpen] = useState(false);
  const [relationshipPickerOpen, setRelationshipPickerOpen] = useState(false);
  const [relationshipPickerPosition, setRelationshipPickerPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const connectionPickerRef = useRef<HTMLDivElement>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const relationshipPickerRef = useRef<HTMLDivElement>(null);
  const relationshipPickerMenuRef = useRef<HTMLDivElement>(null);
  const canSave =
    Boolean((isEditing || sourceAccountId) && draft.displayName.trim() && draft.handle.trim()) &&
    !isPending &&
    !isGenerating;
  const selectedConnection = connections.find((connection) => connection.id === connectionId) ?? null;
  const selectedDisclosure =
    disclosureChoices.find((option) => option.value === disclosureMode) ?? disclosureChoices[0];

  useEffect(() => {
    if (!connectionPickerOpen) return;
    const handleOutsidePointer = (event: PointerEvent) => {
      if (!connectionPickerRef.current?.contains(event.target as Node)) {
        setConnectionPickerOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [connectionPickerOpen]);

  useEffect(() => {
    if (!relationshipPickerOpen) return;
    const handleOutsidePointer = (event: PointerEvent) => {
      if (
        !relationshipPickerRef.current?.contains(event.target as Node) &&
        !relationshipPickerMenuRef.current?.contains(event.target as Node)
      ) {
        setRelationshipPickerOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [relationshipPickerOpen]);

  useEffect(() => {
    if (!relationshipPickerOpen || !relationshipPickerRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      const anchor = relationshipPickerRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const menuWidth = relationshipPickerMenuRef.current?.offsetWidth ?? 288;
      const menuHeight = relationshipPickerMenuRef.current?.offsetHeight ?? 224;
      const left = Math.min(Math.max(8, anchor.left), window.innerWidth - menuWidth - 8);
      const roomBelow = window.innerHeight - anchor.bottom;
      const top = roomBelow >= menuHeight + 8 ? anchor.bottom + 4 : Math.max(8, anchor.top - menuHeight - 4);
      setRelationshipPickerPosition({ left, top });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [relationshipPickerOpen]);

  const relationshipPickerMenu =
    relationshipPickerOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={relationshipPickerMenuRef}
            role="listbox"
            aria-label={localizeUi("ui.noodle.stageprofileform.identityRelationship")}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setRelationshipPickerOpen(false);
                relationshipPickerRef.current?.querySelector("button")?.focus();
              }
            }}
            className="fixed z-[9999] w-72 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-foreground/10 bg-[var(--card)] p-1 shadow-2xl"
            style={getNoodleAccentStyle(
              accent,
              relationshipPickerPosition
                ? { left: relationshipPickerPosition.left, top: relationshipPickerPosition.top }
                : { visibility: "hidden" },
            )}
          >
            {disclosureChoices.map((option) => {
              const isSelected = option.value === disclosureMode;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onDisclosureChange(option.value);
                    setRelationshipPickerOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-foreground/10",
                    isSelected && "bg-foreground/5",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-[var(--foreground)]">{option.label}</span>
                    <span className="mt-0.5 block text-[0.6875rem] leading-4 text-[var(--muted-foreground)]">
                      {option.detail}
                    </span>
                  </span>
                  {isSelected && <Check size={14} className="mt-0.5 shrink-0 text-[var(--noodle-accent)]" />}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col">
      <div className="px-4 py-5 sm:px-6 @min-[1024px]:py-6">
        <div className="rounded-lg border border-[var(--noodle-divider)] bg-[var(--accent)]/40 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--noodle-accent)]/15 text-[var(--noodle-accent)]">
              <Sparkles size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold">
                {isEditing
                  ? localizeUi("ui.noodle.stageprofileform.refineThisStageIdentity")
                  : localizeUi("ui.noodle.stageprofileform.createTheStageIdentity")}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-1 text-xs leading-5 text-[var(--muted-foreground)]">
                <span>
                  {source
                    ? localizeUi("ui.noodle.stageprofileform.builtFromValue1Value2", {
                        value1: source.displayName,
                        value2: source.handle,
                      })
                    : localizeUi("ui.noodle.stageprofileform.yourSourceIdentityIsKeptSeparateFromThisStage")}
                </span>
                <span>{localizeUi("ui.noodle.stageprofileform.relationship")}</span>
                <div ref={relationshipPickerRef} className="relative">
                  <button
                    type="button"
                    disabled={isGenerating || isPending}
                    onClick={() => setRelationshipPickerOpen((open) => !open)}
                    aria-haspopup="listbox"
                    aria-expanded={relationshipPickerOpen}
                    className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-bold text-[var(--foreground)] transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {selectedDisclosure.label}
                    <ChevronDown
                      size={13}
                      className={cn("transition-transform", relationshipPickerOpen && "rotate-180")}
                    />
                  </button>
                  {relationshipPickerMenu}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          {isEditing && avatar && (
            <div className="flex flex-col gap-4 rounded-lg border border-[var(--noodle-divider)] p-4 sm:flex-row sm:items-center">
              <div className="shrink-0">
                <ProfileInitial profile={avatar} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{localizeUi("ui.noodle.stageprofileform.creatorAvatar")}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                  {localizeUi("ui.noodle.stageprofileform.avatarHelp")}
                </p>
                {disclosureMode !== "open" && (
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                    {localizeUi("ui.noodle.stageprofileform.sourceAvatarOpenOnly")}
                  </p>
                )}
              </div>
              <input
                ref={avatarFileRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) onUploadAvatar(file);
                }}
              />
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button
                  type="button"
                  disabled={avatarPending}
                  onClick={() => avatarFileRef.current?.click()}
                  title={localizeUi("ui.noodle.stageprofileform.uploadAvatar")}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--noodle-divider)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
                >
                  <Upload size={15} /> {localizeUi("ui.noodle.stageprofileform.upload")}
                </button>
                <button
                  type="button"
                  disabled={avatarPending || disclosureMode !== "open" || !sourceAvatarUrl}
                  onClick={onUseSourceAvatar}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--noodle-divider)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
                >
                  <UserRound size={15} /> {localizeUi("ui.noodle.stageprofileform.useSource")}
                </button>
                {avatar.avatarUrl && (
                  <button
                    type="button"
                    disabled={avatarPending}
                    onClick={onRemoveAvatar}
                    title={localizeUi("ui.noodle.stageprofileform.removeAvatar")}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--noodle-divider)] text-[var(--destructive)] hover:bg-[var(--destructive)]/10 disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-semibold">{localizeUi("ui.noodle.stageprofileform.stageName")}</span>
              <input
                required
                aria-required="true"
                disabled={isGenerating || isPending}
                value={draft.displayName}
                maxLength={120}
                onChange={(event) => onChange({ displayName: event.target.value })}
                className={`${fieldClass} !h-10`}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold">{localizeUi("ui.noodle.stageprofileform.stageHandle")}</span>
              <span className="relative block">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-[var(--noodle-accent)]"
                >
                  @
                </span>
                <input
                  required
                  aria-required="true"
                  disabled={isGenerating || isPending}
                  value={draft.handle}
                  maxLength={40}
                  onChange={(event) => onChange({ handle: event.target.value })}
                  placeholder={localizeUi("ui.noodle.stageprofileform.afterhours")}
                  className={`${fieldClass} !h-10 !pl-7`}
                />
              </span>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold">{localizeUi("ui.noodle.noodleprofilesurface.bio")}</span>
              <textarea
                rows={2}
                disabled={isGenerating || isPending}
                value={draft.bio}
                maxLength={500}
                onChange={(event) => onChange({ bio: event.target.value })}
                className={`${textareaClass} !min-h-0`}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold">{localizeUi("ui.noodle.stageprofileform.stageVoice")}</span>
              <textarea
                rows={2}
                disabled={isGenerating || isPending}
                value={draft.stagePersonality}
                maxLength={1000}
                onChange={(event) => onChange({ stagePersonality: event.target.value })}
                placeholder={localizeUi("ui.noodle.stageprofileform.voiceAttitudeBoundariesAndCreatorPersona")}
                className={`${textareaClass} !min-h-0`}
              />
            </label>
          </div>
          <details className="group overflow-visible rounded-lg border border-[var(--noodle-divider)]">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--accent)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] [&::-webkit-details-marker]:hidden">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--noodle-accent)]/15 text-[var(--noodle-accent)]">
                <Sparkles size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{localizeUi("ui.noodle.stageprofileform.aiGuidance")}</span>
                <span className="block text-xs leading-5 text-[var(--muted-foreground)]">
                  {localizeUi("ui.noodle.stageprofileform.generateOrRewriteAnEditableProfileDraft")}
                </span>
              </span>
              <ChevronDown
                size={18}
                className="shrink-0 text-[var(--muted-foreground)] transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="border-t border-[var(--noodle-divider)] p-4">
              <label className="block space-y-2">
                <span className="text-xs font-semibold">
                  {localizeUi("ui.noodle.stageprofileform.optionalDirectionForAi")}
                </span>
                <textarea
                  value={guidance}
                  maxLength={2000}
                  disabled={isGenerating || isPending}
                  onChange={(event) => onGuidanceChange(event.target.value)}
                  placeholder={localizeUi("ui.noodle.stageprofileform.aMysteriousLateNightPhotographerWithAWarmBut")}
                  className={`${textareaClass} min-h-20`}
                />
              </label>
              {connections.length === 0 && (
                <p className="mt-3 rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-3 text-xs leading-5">
                  {localizeUi("ui.noodle.stageprofileform.noConnectionsConfiguredAddOneInSettingsConnections")}
                </p>
              )}
              <div className="mt-3 flex items-center justify-end gap-2">
                {connections.length > 0 && (
                  <div ref={connectionPickerRef} className="relative shrink-0">
                    <button
                      type="button"
                      disabled={isGenerating || isPending}
                      onClick={() => setConnectionPickerOpen((open) => !open)}
                      aria-label={localizeUi("ui.noodle.connection.generationLabel", {
                        name: selectedConnection?.name ?? localizeUi("ui.noodle.connection.default"),
                      })}
                      aria-haspopup="listbox"
                      aria-expanded={connectionPickerOpen}
                      title={localizeUi("ui.noodle.connection.title", {
                        name: selectedConnection?.name ?? localizeUi("ui.noodle.connection.default"),
                      })}
                      className={cn(
                        "flex h-11 max-w-[calc(100%-10.5rem)] items-center justify-center gap-2 rounded-md border border-[var(--noodle-divider)] px-3 transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] sm:max-w-64",
                        connectionPickerOpen && "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10",
                        (isGenerating || isPending) && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <Link size={18} className="shrink-0 !text-[var(--noodle-accent)]" />
                      <span className="truncate text-xs font-semibold">
                        {selectedConnection?.name ?? "Default connection"}
                      </span>
                    </button>
                    {connectionPickerOpen && (
                      <div
                        role="listbox"
                        aria-label={localizeUi("ui.noodle.stageprofileform.generationConnections")}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.stopPropagation();
                            setConnectionPickerOpen(false);
                          }
                        }}
                        className="absolute bottom-full left-0 z-50 mb-2 flex w-64 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-foreground/10 bg-[var(--card)] shadow-2xl"
                      >
                        <div className="border-b border-foreground/10 px-3 py-2 text-[0.6875rem] font-semibold">
                          {localizeUi("navigation.topbar.connections")}
                        </div>
                        <div className="max-h-60 overflow-y-auto p-1">
                          <button
                            type="button"
                            role="option"
                            aria-selected={!connectionId}
                            onClick={() => {
                              onConnectionChange("");
                              setConnectionPickerOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-foreground/10",
                              !connectionId && "bg-foreground/5 font-semibold",
                            )}
                          >
                            <span className="flex-1 truncate">{localizeUi("ui.noodle.connection.default")}</span>
                            {!connectionId && <Check size={14} />}
                          </button>
                          {connections.map((connection) => {
                            const isSelected = connection.id === connectionId;
                            return (
                              <button
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                key={connection.id}
                                onClick={() => {
                                  onConnectionChange(connection.id);
                                  setConnectionPickerOpen(false);
                                }}
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-foreground/10",
                                  isSelected && "bg-foreground/5 font-semibold",
                                )}
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate">{connection.name}</span>
                                  {connection.model && (
                                    <span className="block truncate text-[0.6875rem] font-normal text-[var(--muted-foreground)]">
                                      {connection.model}
                                    </span>
                                  )}
                                </span>
                                {isSelected && <Check size={14} className="shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={isGenerating || isPending || connections.length === 0}
                  className="inline-flex min-h-11 w-40 shrink-0 items-center justify-center gap-2 rounded-md bg-[var(--noodle-accent)] px-4 text-sm font-bold text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90 disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}{" "}
                  {isGenerating
                    ? localizeUi("ui.noodle.stageprofileform.generatingDraft")
                    : previousDraft
                      ? localizeUi("ui.noodle.stageprofileform.rewriteDraft")
                      : localizeUi("ui.noodle.stageprofileform.generateDraft")}
                </button>
              </div>
              {previousDraft && !isGenerating && (
                <button
                  type="button"
                  onClick={onUndoDraft}
                  className="mt-1 flex min-h-11 w-full items-center justify-center text-xs font-semibold text-[var(--noodle-accent)] hover:underline"
                >
                  {localizeUi("ui.noodle.stageprofileform.undoAiChanges")}
                </button>
              )}
            </div>
          </details>
        </div>
      </div>
      <WizardFooter
        step={2}
        onBack={onCancel}
        backLabel={isEditing ? "Cancel" : "Back"}
        showProgress={!isEditing}
        disabled={isPending || isGenerating}
        finalAction={
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--noodle-accent)] px-5 text-sm font-bold text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {isPending
              ? localizeUi("ui.noodle.stageprofileform.saving")
              : isEditing
                ? localizeUi("ui.noodle.stageprofileform.saveChanges")
                : localizeUi("ui.noodle.noodlehome.createStageProfile")}
          </button>
        }
      />
    </div>
  );
}

function StageProfileSourcePicker({
  accounts,
  search,
  kind,
  selectedId,
  onSearch,
  onKindChange,
  onSelect,
  hasMore,
  isLoadingMore,
  isLoading,
  isError,
  onRetry,
  onLoadMore,
  onBack,
  onContinue,
}: {
  accounts: Array<{
    id: string;
    kind: "character" | "persona" | "random_user";
    displayName: string;
    handle: string;
    bio: string;
    avatarUrl: string | null;
  }>;
  search: string;
  kind: "all" | "character" | "persona";
  selectedId: string | null;
  onSearch: (value: string) => void;
  onKindChange: (value: "all" | "character" | "persona") => void;
  onSelect: (id: string) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <div className="px-4 py-5 sm:px-6 @min-[1024px]:py-6">
        <h2 className="text-xl font-black">
          {localizeUi("ui.noodle.stageprofilesourcepicker.chooseASourceCharacterOrPersona")}
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">
          {localizeUi("ui.noodle.stageprofilesourcepicker.noodlerWillCreateASeparateStageIdentityFromThis")}
        </p>
        <label className="relative mt-5 block">
          <Search size={16} className="absolute left-3 top-3 !text-[var(--noodle-accent)]" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={localizeUi("ui.noodle.stageprofilesourcepicker.searchCharactersAndPersonas")}
            className={`${fieldClass} pl-9`}
          />
        </label>
        {selectedId && !accounts.some((account) => account.id === selectedId) && (
          <p className="mt-3 rounded-md border border-[var(--noodle-accent)]/40 bg-[var(--noodle-accent)]/10 p-3 text-xs leading-5 text-[var(--foreground)]">
            {localizeUi("ui.noodle.stageprofilesourcepicker.aSelectedSourceIsHiddenByTheCurrentSearch")}
          </p>
        )}
        {isLoading ? (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-[var(--noodle-divider)] py-12 text-sm text-[var(--muted-foreground)]">
            <Loader2 size={18} className="animate-spin" />{" "}
            {localizeUi("ui.noodle.stageprofilesourcepicker.loadingSources")}
          </div>
        ) : isError ? (
          <div className="mt-4 rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-6 text-center">
            <p className="text-sm font-semibold">
              {localizeUi("ui.noodle.stageprofilesourcepicker.sourcesCouldNotBeLoaded")}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 min-h-11 rounded-md border border-[var(--noodle-divider)] px-4 text-sm font-semibold hover:bg-[var(--accent)]"
            >
              {localizeUi("capabilities.actions.tryAgain")}
            </button>
          </div>
        ) : (
          <div
            className="mt-3 grid grid-cols-3 rounded-lg border border-[var(--noodle-divider)] p-1"
            aria-label={localizeUi("ui.noodle.stageprofilesourcepicker.filterProfileSources")}
          >
            {(["all", "character", "persona"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={kind === option}
                onClick={() => onKindChange(option)}
                className={`min-h-11 rounded-md px-2 text-xs font-semibold capitalize ${kind === option ? "bg-[var(--noodle-accent)] text-zinc-950" : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"}`}
              >
                {option === "all"
                  ? localizeUi("ui.noodle.stageprofilesourcepicker.all")
                  : option === "character"
                    ? localizeUi("navigation.topbar.characters")
                    : localizeUi("navigation.topbar.personas")}
              </button>
            ))}
          </div>
        )}
        {!isLoading && !isError && (
          <div className="mt-4 max-h-[min(28rem,50vh)] divide-y divide-[var(--noodle-divider)] overflow-y-auto rounded-lg border border-[var(--noodle-divider)]">
            {accounts.length === 0 ? (
              <p className="p-6 text-center text-sm text-[var(--muted-foreground)]">
                {localizeUi("ui.noodle.stageprofilesourcepicker.noEligibleSourceAccountsMatchThatSearch")}
              </p>
            ) : (
              accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => onSelect(account.id)}
                  className={`flex min-h-16 w-full items-center gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] ${selectedId === account.id ? "bg-[var(--noodle-accent)]/10" : "hover:bg-[var(--accent)]"}`}
                >
                  {account.avatarUrl ? (
                    <img src={account.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                  ) : (
                    <ProfileInitial profile={account} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{account.displayName}</span>
                    <span className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <span className="truncate">@{account.handle}</span>
                      <span className="shrink-0 rounded-full border border-[var(--noodle-divider)] px-1.5 py-0.5 text-[0.625rem] font-bold capitalize">
                        {account.kind}
                      </span>
                    </span>
                    {account.bio && (
                      <span className="mt-1 block truncate text-xs text-[var(--muted-foreground)]">{account.bio}</span>
                    )}
                  </span>
                  {selectedId === account.id ? (
                    <Check size={18} className="text-[var(--noodle-accent)]" />
                  ) : (
                    <ChevronRight size={17} className="text-[var(--muted-foreground)]" />
                  )}
                </button>
              ))
            )}
          </div>
        )}
        {!isLoading && !isError && hasMore && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-[var(--noodle-divider)] text-sm font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {isLoadingMore && <Loader2 size={15} className="animate-spin" />}
            {isLoadingMore
              ? localizeUi("ui.noodle.stageprofilesourcepicker.loadingMore")
              : localizeUi("ui.noodle.stageprofilesourcepicker.loadMoreCharacters")}
          </button>
        )}
      </div>
      <WizardFooter
        step={0}
        onBack={onBack}
        onNext={onContinue}
        nextDisabled={!selectedId || !accounts.some((account) => account.id === selectedId)}
      />
    </div>
  );
}

function DisclosureStep({
  source,
  value,
  onChange,
  onBack,
  onContinue,
}: {
  source: { displayName: string; handle: string } | null;
  value: NoodleIdentityDisclosure;
  onChange: (value: NoodleIdentityDisclosure) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const disclosureChoices = disclosureOptions(localizeUi);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <div className="px-4 py-5 sm:px-6 @min-[1024px]:py-6">
        <h2 className="text-xl font-black">{localizeUi("ui.noodle.disclosurestep.howConnectedShouldThisFeel")}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
          {localizeUi("ui.noodle.disclosurestep.chooseTheRelationshipBetweenThisNoodlerStageIdentityAnd")}
        </p>
        {source && (
          <p className="mt-4 rounded-md bg-[var(--accent)] p-3 text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.noodle.disclosurestep.source")}{" "}
            <span className="font-bold text-[var(--foreground)]">{source.displayName}</span> (@{source.handle})
          </p>
        )}
        <div className="mt-5 space-y-3">
          {disclosureChoices.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={value === option.value}
              onClick={() => onChange(option.value)}
              className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left ${value === option.value ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10" : "border-[var(--noodle-divider)] hover:bg-[var(--accent)]"}`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${value === option.value ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]" : "border-[var(--noodle-divider)]"}`}
              >
                {value === option.value && <Check size={13} className="!text-zinc-950" />}
              </span>
              <span>
                <span className="block text-sm font-bold">{option.label}</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--muted-foreground)]">{option.detail}</span>
                <span className="mt-2 block text-xs leading-5 text-[var(--muted-foreground)]">{option.guidance}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <WizardFooter step={1} onBack={onBack} onNext={onContinue} />
    </div>
  );
}

function WizardFooter({
  step,
  onBack,
  onNext,
  nextDisabled = false,
  finalAction,
  disabled = false,
  backLabel = "Back",
  showProgress = true,
}: {
  step: 0 | 1 | 2;
  onBack: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  finalAction?: ReactNode;
  disabled?: boolean;
  backLabel?: string;
  showProgress?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const labels = ["Source", "Disclosure", "Profile"];
  return (
    <div className="sticky bottom-0 z-[60] shrink-0 border-t border-[var(--noodle-divider)] bg-[var(--background)] px-4 pb-3 pt-3 sm:px-6">
      {showProgress && (
        <div
          className="mb-3 flex items-center justify-center gap-1.5"
          role="status"
          aria-label={localizeUi("ui.noodle.wizardfooter.stepValue1OfValue2Value3", {
            value1: step + 1,
            value2: labels.length,
            value3: labels[step],
          })}
        >
          {labels.map((label, index) => (
            <span key={label} className="flex items-center gap-1.5">
              <span
                aria-current={index === step ? "step" : undefined}
                aria-label={localizeUi("ui.noodle.wizardfooter.stepValue1Value2Value3", {
                  value1: index + 1,
                  value2: label,
                  value3:
                    index === step
                      ? localizeUi("ui.noodle.wizardfooter.current")
                      : index < step
                        ? localizeUi("ui.noodle.wizardfooter.complete")
                        : "",
                })}
                title={label}
                className={`h-1.5 rounded-full transition-all ${index === step ? "w-6 bg-[var(--noodle-accent)]" : index < step ? "w-4 bg-[var(--noodle-accent)]/45" : "w-2 bg-[var(--muted-foreground)]/25"}`}
              />
              {index < labels.length - 1 && <span className="sr-only">{localizeUi("ui.noodle.wizardfooter.to")}</span>}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={disabled}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--noodle-divider)] px-4 text-sm font-semibold hover:bg-[var(--accent)] disabled:cursor-wait disabled:opacity-50"
        >
          <ArrowLeft size={15} /> {backLabel}
        </button>
        {finalAction ?? (
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled || disabled}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--noodle-accent)] px-5 text-sm font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {localizeUi("ui.noodle.wizardfooter.continue")} <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

type SlurpProfileImagePost = NoodlePostCardModel & { imageUrl: string };

function profileAccent(_profileId: string): string {
  return NOODLE_PINK;
}

function SlurpProfileFeaturedImage({
  post,
  onOpenImage,
}: {
  post: SlurpProfileImagePost;
  onOpenImage: (url: string, id: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const source = useSlurpMediaSrc(post.imageUrl);
  return source ? (
    <button
      type="button"
      onClick={() => onOpenImage(source, post.id)}
      className="block w-full overflow-hidden rounded-md text-left ring-1 ring-inset ring-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
      aria-label={post.title || localizeUi("ui.slurp.post.openFeaturedImage")}
    >
      <img src={source} alt={post.title || ""} className="block aspect-[16/8] w-full object-cover" />
    </button>
  ) : null;
}

function SlurpProfileMediaTile({
  post,
  onOpenImage,
}: {
  post: SlurpProfileImagePost;
  onOpenImage: (url: string, id: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const source = useSlurpMediaSrc(post.imageUrl);
  return (
    <button
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
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
        />
      ) : (
        <div className="h-full w-full bg-[var(--muted)]" />
      )}
    </button>
  );
}

function StageProfileView({
  profile,
  posts,
  viewerCreator,
  viewerAccount,
  slurpSettings,
  postCardCtx,
  viewerAccounts,
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
  onRedraft,
  redraftPending,
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
  accessPending,
  onAccessChange,
  onOpenImage,
}: {
  profile: NoodlerManagedStageProfile;
  posts: SlurpProfilePost[];
  viewerCreator: NonNullable<ReturnType<typeof useNoodlerViewer>["data"]>["creators"][number] | null;
  viewerAccount: NoodleAccount | null;
  slurpSettings: ReturnType<typeof useSlurpSettings>["data"] | null;
  postCardCtx: ReturnType<typeof useNoodlePostCardController>["ctx"];
  viewerAccounts: NoodleAccount[];
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
  onRedraft: () => void;
  redraftPending: boolean;
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
  accessPending: boolean;
  onAccessChange: (access: NoodlerManagedStageProfile["access"]) => void;
  onOpenImage: (url: string, id: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const bannerSrc = useSlurpMediaSrc(profile.bannerUrl);
  const [accessSettingsOpen, setAccessSettingsOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const updateAutoPosting = useUpdateNoodlerAutoPosting();
  const updateFanActivity = useUpdateNoodlerFanActivity();
  const uploadProfileAvatar = useUploadNoodlerAvatar();
  const uploadProfileBanner = useUploadNoodlerBanner();
  const generateProfileArtwork = useGenerateNoodlerArtwork();
  const profileAvatarFileRef = useRef<HTMLInputElement | null>(null);
  const profileBannerFileRef = useRef<HTMLInputElement | null>(null);
  const [artworkKind, setArtworkKind] = useState<"avatar" | "banner" | null>(null);
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
  const subscribers = subscribersQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const subscriberTotal = subscribersQuery.data?.pages[0]?.total ?? subscribers.length;
  const accent = profileAccent(profile.id);
  const viewingOwnCreator = profile.sourceAccountId === viewerAccount?.entityId;
  // Every Slurp Creator profile is operator-managed, so post controls and artwork editing stay
  // available regardless of which viewer persona is looking at the profile.
  const managedCreator = true;
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
      ? [{ kind: "locked" as const, post: viewerPost }]
      : [{ kind: "card" as const, model: toNoodlePostCardModel(viewerPost, profile) }];
  });
  const visiblePosts = projectedPosts.filter((item) => {
    if (activeTab === "posts") return true;
    if (item.kind === "locked" || item.kind === "controller-locked") return false;
    if (activeTab === "media") return Boolean(item.model.imageUrl);
    return false;
  });
  const imagePosts = projectedPosts.flatMap<SlurpProfileImagePost>((item) => {
    if (item.kind !== "card" && item.kind !== "managed-reveal") return [];
    return typeof item.model.imageUrl === "string" ? [{ ...item.model, imageUrl: item.model.imageUrl }] : [];
  });
  const featuredPost = imagePosts[0] ?? null;
  const cards = (
    <>
      {activeTab === "subscribers" ? (
        subscribersQuery.isLoading ? (
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
                  <p className="truncate text-sm font-bold">{subscriber.displayName}</p>
                  <p className="truncate text-xs text-[var(--muted-foreground)]">@{subscriber.handle}</p>
                </div>
                <time dateTime={subscriber.subscribedAt} className="shrink-0 text-xs text-[var(--muted-foreground)]">
                  {new Date(subscriber.subscribedAt).toLocaleDateString()}
                </time>
              </div>
            ))}
            {subscribersQuery.hasNextPage && (
              <div className="flex justify-center p-4">
                <button
                  type="button"
                  onClick={() => void subscribersQuery.fetchNextPage()}
                  disabled={subscribersQuery.isFetchingNextPage}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--noodle-divider)] px-4 text-sm font-bold hover:bg-[var(--accent)] disabled:opacity-50"
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
        )
      ) : viewerIsLoading || isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={22} className="animate-spin text-[var(--noodle-accent)]" />
        </div>
      ) : viewerIsError ? (
        <EmptyState
          title={localizeUi("ui.noodle.stageprofileview.viewerAccessCouldNotBeLoaded")}
          action={localizeUi("capabilities.actions.tryAgain")}
          onAction={onRetryViewer}
        />
      ) : isError ? (
        <EmptyState
          title={localizeUi("ui.noodle.stageprofileview.noodlerPostsCouldNotBeLoaded")}
          action={localizeUi("capabilities.actions.tryAgain")}
          onAction={onRetry}
        />
      ) : activeTab === "media" ? (
        imagePosts.length > 0 ? (
          <div className="grid grid-cols-2 gap-px bg-[var(--noodle-divider)] sm:grid-cols-3">
            {imagePosts.map((post) => (
              <SlurpProfileMediaTile key={post.id} post={post} onOpenImage={onOpenImage} />
            ))}
          </div>
        ) : (
          <EmptyState title={localizeUi("ui.noodle.stageprofileview.noValue1PostsYet", { value1: activeTab })} />
        )
      ) : visiblePosts.length > 0 ? (
        visiblePosts.map((item) =>
          item.kind === "locked" || item.kind === "controller-locked" ? (
            <LockedSlurpPostCard
              key={item.post.id}
              post={item.post}
              profile={profile}
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
            />
          ) : item.kind === "managed-reveal" ? (
            <div key={item.model.id}>
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
              key={item.model.id}
              post={item.model}
              ctx={{
                ...postCardCtx,
                personaAccount: viewingOwnCreator ? null : viewerAccount,
                postManagement: managedCreator,
              }}
            />
          ),
        )
      ) : (
        <EmptyState
          title={
            activeTab === "posts"
              ? localizeUi("ui.noodle.stageprofileview.noNoodlerPostsYet")
              : localizeUi("ui.noodle.stageprofileview.noValue1PostsYet", { value1: activeTab })
          }
        />
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
            className="absolute left-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/45 @min-[1024px]:hidden"
            title={localizeUi("ui.noodle.mobiletimelinebackbutton.backToTimeline")}
            aria-label={localizeUi("ui.noodle.mobiletimelinebackbutton.backToNoodleTimeline")}
          >
            <ChevronLeft size={22} />
          </button>
        }
        account={profile}
        displayHandle={profile.handle}
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
          canEdit: true,
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
          canEdit: true,
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
        leadingActions={null}
        bioContent={
          <>
            {profile.bio && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{profile.bio}</p>}
            {!viewingOwnCreator && viewerCreator && !viewerCreator.followed ? (
              <button
                type="button"
                disabled={followPending}
                onClick={() => onToggleFollow(profile.id, false)}
                className="mt-4 inline-flex min-h-9 items-center rounded-md border border-[var(--noodle-divider)] px-4 text-xs font-bold hover:bg-[var(--accent)] disabled:opacity-50"
              >
                {localizeUi("ui.noodle.noodlehome.follow")}
              </button>
            ) : !viewingOwnCreator && viewerCreator?.followed && !viewerCreator.subscribed ? (
              <button
                type="button"
                disabled={subscriptionPending}
                onClick={() => onToggleSubscription(profile.id, viewerCreator.subscribed)}
                className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-md bg-[var(--foreground)] px-4 text-xs font-bold text-[var(--background)] hover:opacity-90 disabled:opacity-50"
              >
                {localizeUi("ui.slurp.profile.subscribe")}
              </button>
            ) : !viewingOwnCreator && viewerCreator?.subscribed ? (
              <button
                type="button"
                disabled={subscriptionPending}
                onClick={() => onToggleSubscription(profile.id, true)}
                className="mt-4 inline-flex min-h-9 items-center rounded-md border border-[var(--noodle-divider)] px-4 text-xs font-bold text-[var(--muted-foreground)] hover:bg-[var(--accent)] disabled:opacity-50"
              >
                {localizeUi("ui.noodle.stageprofileview.subscribed")}
              </button>
            ) : null}
          </>
        }
        contentActions={null}
        tabs={[
          { id: "posts", label: localizeUi("ui.noodle.profile.tabs.posts") },
          { id: "media", label: localizeUi("ui.noodle.profile.tabs.media") },
          {
            id: "subscribers",
            label: localizeUi("ui.noodle.stageProfile.tabs.subscribers", {
              count: subscribersQuery.data ? subscriberTotal : "…",
            }),
            ariaLabel: localizeUi("ui.noodle.stageProfile.tabs.subscribersAria", {
              count: subscribersQuery.data ? subscriberTotal : localizeUi("ui.noodle.stageProfile.tabs.loading"),
            }),
          },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        preTabsContent={
          managedCreator ? (
            <details className="group border-b border-[var(--noodle-divider)] bg-[var(--accent)]/10">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-xs font-semibold text-[var(--muted-foreground)] hover:bg-[var(--accent)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] [&::-webkit-details-marker]:hidden">
                <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
                <span>{localizeUi("ui.slurp.profile.additionalControls")}</span>
                {viewingOwnCreator && (
                  <span className="ml-auto text-[0.68rem] text-[var(--noodle-accent)]">
                    {localizeUi("ui.noodle.stageprofileview.yourProfile")}
                  </span>
                )}
              </summary>
              <div className="border-t border-[var(--noodle-divider)]">
                <div className="flex flex-wrap items-center justify-end gap-2 p-3">
                  <button
                    type="button"
                    onClick={onEdit}
                    className="h-9 rounded-md bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950"
                  >
                    {localizeUi("ui.noodle.stageprofileview.editProfile")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccessSettingsOpen(true)}
                    className="h-9 rounded-md border border-[var(--noodle-divider)] px-4 text-xs font-bold hover:bg-[var(--accent)]"
                  >
                    {localizeUi("ui.noodle.stageprofileview.access")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutomationOpen(true)}
                    className="h-9 rounded-md border border-[var(--noodle-divider)] px-4 text-xs font-bold hover:bg-[var(--accent)]"
                  >
                    {autoPosting.enabled
                      ? localizeUi("ui.noodle.stageprofileview.automationOn")
                      : localizeUi("ui.noodle.stageprofileview.automation")}
                  </button>
                </div>
                <div className="border-t border-[var(--noodle-divider)] bg-[var(--background)]">
                  <NoodlerPostComposer
                    key={profile.id}
                    profile={profile}
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
              </div>
            </details>
          ) : null
        }
        featuredContent={
          featuredPost && !bannerSrc && activeTab === "posts" ? (
            <div className="border-b border-[var(--noodle-divider)] bg-[var(--noodle-accent)]/[0.04] px-4 py-4 sm:px-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--noodle-accent)]">
                  {localizeUi("ui.noodle.profile.tabs.media")}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">{profile.displayName}</span>
              </div>
              <SlurpProfileFeaturedImage post={featuredPost} onOpenImage={onOpenImage} />
            </div>
          ) : null
        }
        postList={cards}
        accent={profileAccent(profile.id)}
      />
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
          "--background": "#17121b",
          "--foreground": "#fff7fc",
          "--muted-foreground": "#d8c9d4",
          "--border": "rgba(255, 126, 193, 0.24)",
          "--accent": "rgba(255, 126, 193, 0.12)",
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
              className="min-h-32 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-sm font-normal outline-none focus:border-[var(--noodle-accent)]"
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
              className="min-h-10 rounded-md border border-[var(--border)] px-4 text-xs font-semibold"
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
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 disabled:opacity-50"
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
          {viewerAccounts.length > 0 && (
            <fieldset>
              <legend className="text-xs font-bold">
                {localizeUi("ui.noodle.stageprofileview.hiddenFromPersonas")}
              </legend>
              <div className="mt-2 divide-y divide-[var(--noodle-divider)] rounded-md border border-[var(--noodle-divider)]">
                {viewerAccounts.map((account) => {
                  const owningAccount = profile.sourceAccountId === account.id;
                  const checked = profile.access.hiddenFromAccountIds.includes(account.id);
                  return (
                    <label key={account.id} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
                      <span className="truncate text-xs font-semibold">{account.displayName}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={accessPending || owningAccount}
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
        open={automationOpen}
        onClose={() => setAutomationOpen(false)}
        title={localizeUi("ui.noodle.stageprofileview.automaticPosting")}
        width="max-w-md"
        panelStyle={getNoodleAccentStyle(accent)}
      >
        <div className="space-y-4">
          <p className="text-xs leading-5 text-[var(--muted-foreground)]">
            {localizeUi("ui.noodle.stageprofileview.whenOnThisCreatorPostsOnItsOwnWhile")}
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
          <label className="flex min-h-11 items-center justify-between gap-4 rounded-md border border-[var(--noodle-divider)] px-3 py-2">
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
            <label className="flex min-h-11 items-center justify-between gap-4 rounded-md border border-[var(--noodle-divider)] px-3 py-2">
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
                className="h-9 w-full rounded-md border border-[var(--noodle-divider)] bg-[var(--background)] px-2"
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
                                  toast.error(
                                    errorMessage(error, localizeUi("ui.noodle.noodlehome.couldNotUpdateNoodleProfile")),
                                  );
                                  event.target.value = String(current);
                                },
                              },
                            );
                          }}
                          className="h-9 w-full rounded-md border border-[var(--noodle-divider)] bg-transparent px-2 text-sm"
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
}

function ViewerHub({
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
  onToggleFollow,
  authorProfile,
  authorDraft,
  onAuthorDraftChange,
  onClearAuthorDraft,
  onDiscardAuthorDraft,
  authorLoading,
  authorError,
  onRetryAuthor,
  onCreateAuthorProfile,
  onOpenAuthorProfile,
  onManualPost,
  onGuidedPost,
  manualPending,
  guidePending,
  onToggleSubscription,
  togglePending,
  newSinceAt,
  onFeedShown,
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
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  unlockPending: boolean;
  postCardCtx: ReturnType<typeof useNoodlePostCardController>["ctx"];
  onUnlock: (postId: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  discoveryOpen: boolean;
  onCloseDiscovery: () => void;
  discoveryInputRef: React.RefObject<HTMLInputElement | null>;
  tab: "following" | "all";
  onTabChange: (tab: "following" | "all") => void;
  onToggleFollow: (creatorAccountId: string, followed: boolean) => void;
  authorProfile: NoodlerManagedStageProfile | null;
  authorDraft: NoodlerPostDraft;
  onAuthorDraftChange: (patch: Partial<NoodlerPostDraft>) => void;
  onClearAuthorDraft: () => void;
  onDiscardAuthorDraft: () => void;
  authorLoading: boolean;
  authorError: boolean;
  onRetryAuthor: () => void;
  onCreateAuthorProfile?: () => void;
  onOpenAuthorProfile?: () => void;
  onManualPost: (input: NoodlerPostSubmission) => Promise<void>;
  onGuidedPost: (input: NoodlerPostSubmission) => Promise<void>;
  manualPending: boolean;
  guidePending: boolean;
  onToggleSubscription: (creatorAccountId: string, subscribed: boolean) => void;
  togglePending: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const setStickyHeader = useHideOnScroll(scroller);
  const [discoverCollapsed, setDiscoverCollapsed] = useState(false);
  const [visibleFeedCount, setVisibleFeedCount] = useState(NOODLER_FEED_WINDOW_SIZE);
  const profileKey = (scope?.creators ?? []).map((creator) => creator.profile.id).join("\u0000");
  useEffect(() => {
    setVisibleFeedCount(NOODLER_FEED_WINDOW_SIZE);
  }, [authorProfile?.id, profileKey, scope?.viewer.id, search, tab]);
  // The visit counts once the feed itself is on screen and loaded — not on app entry, and not
  // while discovery search has replaced it. Declared above the early returns so hook order
  // stays stable across the empty and error states below.
  // A search-filtered list is not the feed either, so it does not count as having seen it.
  const feedIsOnScreen = tab === "all" && Boolean(scope) && !isLoading && !isError && !discoveryOpen && !search.trim();
  useEffect(() => {
    if (feedIsOnScreen) onFeedShown();
  }, [feedIsOnScreen, onFeedShown]);
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
  const searchTerm = search.trim().toLowerCase();
  const searchable = (value: unknown) => (typeof value === "string" ? value.toLowerCase() : "");
  const followedCreatorIds = new Set(scope?.viewer.settings.social.followingAccountIds ?? []);
  const creators = scope?.creators ?? [];
  const feed = creators
    .filter((creator) => tab === "all" || followedCreatorIds.has(creator.profile.id))
    .flatMap((creator) => creator.posts.map((post) => ({ post, creator })))
    .filter(
      ({ post, creator }) =>
        !searchTerm ||
        (post.title ?? "").toLowerCase().includes(searchTerm) ||
        (post.content ?? "").toLowerCase().includes(searchTerm) ||
        searchable(creator.profile.handle).includes(searchTerm) ||
        searchable(creator.profile.displayName).includes(searchTerm),
    )
    .sort((a, b) => new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime());
  const searchResults = creators
    .flatMap((creator) => creator.posts.map((post) => ({ post, creator })))
    .filter(
      ({ post, creator }) =>
        searchTerm &&
        ((post.title ?? "").toLowerCase().includes(searchTerm) ||
          (post.content ?? "").toLowerCase().includes(searchTerm) ||
          searchable(creator.profile.handle).includes(searchTerm) ||
          searchable(creator.profile.displayName).includes(searchTerm)),
    )
    .sort((a, b) => new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime());
  const visibleFeed = feed.slice(0, visibleFeedCount);
  const visibleSearchResults = searchResults.slice(0, visibleFeedCount);
  const discoveredCreators = creators.filter(
    (creator) =>
      creator.profile.id !== authorProfile?.id &&
      (!searchTerm ||
        searchable(creator.profile.handle).includes(searchTerm) ||
        searchable(creator.profile.displayName).includes(searchTerm)),
  );
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
  const renderFeedPost = ({ post, creator }: (typeof searchResults)[number]) =>
    post.locked ? (
      <LockedSlurpPostCard
        key={post.id}
        post={post}
        profile={creator.profile}
        subscribed={creator.subscribed}
        unlockPending={unlockPending}
        subscriptionPending={togglePending}
        onUnlock={onUnlock}
        onToggleSubscription={onToggleSubscription}
        onOpenProfile={postCardCtx.openAuthorProfile}
      />
    ) : (
      <SlurpCreatorPostCard
        key={post.id}
        post={toNoodlePostCardModel(post, creator.profile)}
        ctx={{
          ...postCardCtx,
          personaAccount: creator.profile.id === authorProfile?.id ? null : postCardCtx.personaAccount,
        }}
      />
    );

  if (discoveryOpen) {
    return (
      <div ref={setScroller} className="min-h-0 flex-1 overflow-y-auto" data-component="SlurpHome.Discover">
        <div
          ref={setStickyHeader}
          className={cn(
            "sticky top-0 z-20 flex items-center gap-2 border-b border-[var(--noodle-divider)] bg-[var(--background)]/95 px-2 py-3 backdrop-blur",
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

        {searchTerm && (
          <section className="border-b border-[var(--noodle-divider)]" aria-labelledby="noodler-search-results">
            <div className="border-b border-[var(--noodle-divider)] px-4 py-3">
              <h2 id="noodler-search-results" className="text-lg font-bold">
                {localizeUi("ui.noodle.noodlehome.searchResults")}
              </h2>
            </div>
            {searchResults.length > 0 ? (
              <div>
                {visibleSearchResults.map(renderFeedPost)}
                {visibleSearchResults.length < searchResults.length && (
                  <LoadMoreFeedButton
                    visible={visibleSearchResults.length}
                    total={searchResults.length}
                    onLoadMore={() =>
                      setVisibleFeedCount((count) => Math.min(searchResults.length, count + NOODLER_FEED_WINDOW_SIZE))
                    }
                  />
                )}
              </div>
            ) : (
              <p className="px-4 py-6 text-sm text-[var(--muted-foreground)]">
                {localizeUi("ui.noodle.viewerhub.noSearchResults")}
              </p>
            )}
          </section>
        )}

        <section aria-labelledby="noodler-discover-creators">
          <div className="border-b border-[var(--noodle-divider)] px-4 py-3">
            <h2 id="noodler-discover-creators" className="text-lg font-bold">
              {localizeUi("ui.noodle.subscriptionsections.discoverCreators")}
            </h2>
          </div>
          {discoveredCreators.length > 0 ? (
            <div className="divide-y divide-[var(--noodle-divider)]">
              {discoveredCreators.map((creator) => (
                <div key={creator.profile.id} className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => postCardCtx.openAuthorProfile?.(creator.profile.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left transition-colors hover:text-[var(--noodle-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
                  >
                    <ProfileInitial profile={creator.profile} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{creator.profile.displayName}</span>
                      <span className="block truncate text-xs text-[var(--muted-foreground)]">
                        @{creator.profile.handle}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={togglePending}
                    onClick={() => onToggleFollow(creator.profile.id, creator.followed)}
                    className="h-8 rounded-full border border-[var(--noodle-divider)] px-4 text-xs font-bold hover:bg-[var(--accent)] disabled:opacity-50"
                  >
                    {creator.followed
                      ? localizeUi("ui.noodle.subscriptionsections.unfollow")
                      : localizeUi("ui.noodle.noodlehome.follow")}
                  </button>
                  <button
                    type="button"
                    disabled={togglePending}
                    onClick={() => onToggleSubscription(creator.profile.id, creator.subscribed)}
                    className={cn(
                      "h-8 rounded-full px-4 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-50",
                      creator.subscribed
                        ? "border border-[var(--noodle-divider)] text-[var(--foreground)]"
                        : "bg-[var(--foreground)] text-[var(--background)]",
                    )}
                  >
                    {creator.subscribed
                      ? localizeUi("ui.noodle.subscriptionsections.unsubscribe")
                      : localizeUi("ui.noodle.lockednoodlerpostcard.subscribe")}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-6 text-sm text-[var(--muted-foreground)]">
              {localizeUi("ui.noodle.subscriptionsections.noCreatorsAreVisibleToThisPersonaYet")}
            </p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div ref={setScroller} className="min-h-0 flex-1 overflow-y-auto">
      {/* NoodleR opened straight onto its tab row while Noodle showed a wordmark bar;
          both surfaces now carry the same phone header, and it travels with the tabs. */}
      <div
        ref={setStickyHeader}
        className={cn("sticky top-0 z-30", HIDE_ON_SCROLL_CLASS)}
        data-component="SlurpHome.StickyHeader"
      >
        {/* See NoodleHome: the phone wordmark bar is off while the bottom bar
            carries the branding. */}
        <div className="border-b border-[var(--noodle-divider)] bg-[var(--background)]/95 backdrop-blur">
          <div className="flex items-center pr-2">
            <div
              className="grid min-w-0 flex-1 grid-cols-2"
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
                    "relative flex h-12 items-center justify-center text-sm font-bold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]",
                    tab === option.id && "text-[var(--foreground)]",
                  )}
                >
                  {option.label}
                  {tab === option.id && (
                    <span className="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-[var(--noodle-accent)]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="hidden border-b border-[var(--noodle-divider)] py-3 @min-[1024px]:block @min-[1024px]:px-4 @min-[1280px]:hidden">
        <SubscriptionSections
          creators={(scope?.creators ?? []).filter((creator) => creator.profile.id !== authorProfile?.id)}
          onToggleSubscription={onToggleSubscription}
          togglePending={togglePending}
          onOpenProfile={postCardCtx.openAuthorProfile}
          compact
          collapsed={discoverCollapsed}
          onToggleCollapsed={() => setDiscoverCollapsed((value) => !value)}
        />
      </div>
      {authorProfile ? (
        <NoodlerPostComposer
          key={authorProfile.id}
          profile={authorProfile}
          collapsible={false}
          draft={authorDraft}
          onDraftChange={onAuthorDraftChange}
          onClearDraft={onClearAuthorDraft}
          onDiscardDraft={onDiscardAuthorDraft}
          onManualPost={onManualPost}
          onGuidedPost={onGuidedPost}
          manualPending={manualPending}
          guidePending={guidePending}
        />
      ) : authorLoading ? (
        <div className="border-b border-[var(--noodle-divider)] px-4 py-4 text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.noodle.viewerhub.resolvingYourLinkedNoodlerProfile")}
        </div>
      ) : authorError ? (
        <div className="border-b border-[var(--noodle-divider)] px-4 py-4">
          <p className="text-sm font-semibold">
            {localizeUi("ui.noodle.viewerhub.yourLinkedNoodlerProfileCouldNotBeLoaded")}
          </p>
          <button
            type="button"
            onClick={onRetryAuthor}
            className="mt-3 min-h-10 rounded-md border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)]"
          >
            {localizeUi("capabilities.actions.tryAgain")}
          </button>
        </div>
      ) : (
        <div className="border-b border-[var(--noodle-divider)] px-4 py-8">
          <div className="mx-auto flex max-w-sm flex-col items-center gap-2 rounded-xl border border-[var(--noodle-divider)] bg-[var(--accent)]/20 px-6 py-8 text-center">
            <p className="text-sm font-semibold">
              {localizeUi("ui.noodle.viewerhub.thisPersonaHasNoLinkedNoodlerProfile")}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.noodle.viewerhub.createOneToAuthorFromThisTimeline")}
            </p>
            {onCreateAuthorProfile && (
              <button
                type="button"
                onClick={onCreateAuthorProfile}
                className="mt-2 min-h-10 rounded-md bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 transition-opacity hover:opacity-90"
              >
                {localizeUi("ui.noodle.noodlehome.createStageProfile")}
              </button>
            )}
          </div>
        </div>
      )}
      <div className="border-b border-[var(--noodle-divider)] px-4 py-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:cursor-not-allowed disabled:opacity-50"
          title={localizeUi("ui.noodle.noodlehome.refreshTimeline")}
          aria-label={localizeUi("ui.noodle.noodlehome.refreshTimeline")}
        >
          {isRefreshing ? (
            <Loader2 size={17} className="!text-[var(--noodle-accent)] animate-spin" />
          ) : (
            <RefreshCw size={17} className="!text-[var(--noodle-accent)]" />
          )}
          {isRefreshing
            ? localizeUi("ui.noodle.noodlehome.refreshing")
            : localizeUi("ui.noodle.noodlehome.refreshTimeline")}
        </button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[var(--noodle-accent)]" />
        </div>
      ) : isError ? (
        <EmptyState
          title={localizeUi("ui.noodle.viewerhub.noodlerCouldNotBeLoadedForThisPersona")}
          action={localizeUi("capabilities.actions.tryAgain")}
          onAction={onRetry}
        />
      ) : scope && scope.creators.length > 0 ? (
        <>
          {feed.length === 0 ? (
            <p className="px-4 py-8 text-xs text-[var(--muted-foreground)]">
              {searchTerm
                ? localizeUi("ui.noodle.viewerhub.noSearchResults")
                : tab === "following"
                  ? localizeUi("ui.noodle.viewerhub.noFollowedPosts")
                  : localizeUi("ui.noodle.viewerhub.noPostsYet")}
            </p>
          ) : (
            <div>
              {visibleFeed.map((item, index) => (
                <Fragment key={item.post.id}>
                  {index === dividerIndex && <NewSinceLastVisitDivider />}
                  {renderFeedPost(item)}
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
    </div>
  );
}

function LoadMoreFeedButton({
  visible,
  total,
  onLoadMore,
}: {
  visible: number;
  total: number;
  onLoadMore: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <button
      data-component="SlurpHome.LoadMoreFeed"
      type="button"
      onClick={onLoadMore}
      className="min-h-11 w-full border-b border-[var(--noodle-divider)] px-4 py-3 text-sm font-bold text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10"
    >
      {localizeUi("ui.noodle.noodlehome.loadMore", { visible, total })}
    </button>
  );
}

type NoodlerComposerTool = "image" | "poll" | "media" | "access";

function NoodlerPostComposer({
  profile,
  collapsible = true,
  draft,
  onDraftChange,
  onClearDraft,
  onDiscardDraft,
  onManualPost,
  onGuidedPost,
  manualPending,
  guidePending,
}: {
  profile: NoodlerManagedStageProfile;
  collapsible?: boolean;
  draft: NoodlerPostDraft;
  onDraftChange: (patch: Partial<NoodlerPostDraft>) => void;
  onClearDraft: () => void;
  onDiscardDraft: () => void;
  onManualPost: (input: NoodlerPostSubmission) => Promise<void>;
  onGuidedPost: (input: NoodlerPostSubmission) => Promise<void>;
  manualPending: boolean;
  guidePending: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [expanded, setExpanded] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [guideError, setGuideError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<NoodlerComposerTool | null>(null);
  const [pollEditorValue, setPollEditorValue] = useState<NoodlePollInput | null>(null);
  const [mediaPickerTab, setMediaPickerTab] = useState<ConversationMediaPickerTabId>("emoji");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<PendingNoodlerImage | null>(null);
  const [imageUrlDraft, setImageUrlDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const imageFileRef = useRef<HTMLInputElement | null>(null);
  const imageToolRef = useRef<HTMLDivElement | null>(null);
  const pollToolRef = useRef<HTMLDivElement | null>(null);
  const mediaToolRef = useRef<HTMLDivElement | null>(null);
  const accessToolRef = useRef<HTMLDivElement | null>(null);
  const composerBusyRef = useRef(false);
  const { title, body, access, image, poll } = draft;
  // Format is an internal tag for the AI/length policy, not a choice we make the
  // human author pick. Derive it from what they actually did: a title makes it an
  // announcement (long_form when long); otherwise a caption (long_form when long).
  const derivedFormat = (): NoodlerContentFormat =>
    title.trim()
      ? body.trim().length > 1000
        ? "long_form"
        : "announcement"
      : body.trim().length > 500
        ? "long_form"
        : "caption";
  const hasDraft = pendingImage !== null || !isEmptyNoodlerPostDraft(draft);
  const composerBusy = submitting || manualPending || guidePending;
  composerBusyRef.current = composerBusy;
  const guide = serializeNoodlerPostGuide(title, body);
  const pollIsValid = poll ? noodlePollInputSchema.safeParse(poll).success : false;

  useEffect(() => {
    if (composerBusy) {
      setActiveTool(null);
    }
  }, [composerBusy]);

  const updateDraft = (patch: Partial<NoodlerPostDraft>) => {
    if (composerBusyRef.current) return false;
    onDraftChange(patch);
    return true;
  };
  const discardPendingImage = () => {
    setPendingImage(null);
  };

  const clearDraft = () => {
    onClearDraft();
    setPostError(null);
    setGuideError(null);
    setAttachmentError(null);
    discardPendingImage();
    setImageUrlDraft("");
    setPollEditorValue(null);
    setActiveTool(null);
    setExpanded(false);
  };
  const discardDraft = () => {
    if (composerBusyRef.current) return;
    onDiscardDraft();
    setPostError(null);
    setGuideError(null);
    setAttachmentError(null);
    discardPendingImage();
    setImageUrlDraft("");
    setPollEditorValue(null);
    setActiveTool(null);
    setExpanded(false);
  };
  const removeImage = () => {
    if (!image || composerBusyRef.current) return;
    onDraftChange({ image: null });
    setPendingImage(null);
  };
  const handleImageFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || composerBusyRef.current) return;
    if (!file.type.startsWith("image/")) {
      setAttachmentError("Choose an image file.");
      return;
    }
    setAttachmentError(null);
    discardPendingImage();
    onDraftChange({ image: { source: file, crop: null } });
    setActiveTool(null);
  };
  const handleImageUrl = () => {
    const imageUrl = imageUrlDraft.trim();
    if (!imageUrl || composerBusyRef.current) return;
    setAttachmentError(null);
    try {
      const parsed = new URL(imageUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Use an HTTP or HTTPS image URL.");
      setImageUrlDraft("");
      onDraftChange({ image: { source: parsed.toString(), crop: null } });
      setActiveTool(null);
    } catch (error) {
      setAttachmentError(errorMessage(error, "Enter a valid image URL."));
    }
  };
  const applyImageCrop = async (crop: NoodlePostImageCrop) => {
    if (composerBusyRef.current) return;
    const pending = pendingImage;
    if (!pending) return;
    setAttachmentError(null);
    onDraftChange({ image: { source: pending.source, crop } });
    setPendingImage(null);
    setActiveTool(null);
  };

  const toggleTool = (tool: NoodlerComposerTool) => {
    if (composerBusyRef.current) return;
    if (activeTool === tool) {
      setActiveTool(null);
      if (tool === "poll") setPollEditorValue(null);
      return;
    }
    if (tool === "poll") {
      setPollEditorValue(
        poll ? { question: poll.question, options: [...poll.options] } : { question: "", options: ["", ""] },
      );
    } else {
      setPollEditorValue(null);
    }
    setActiveTool(tool);
  };

  const applyPollDraft = () => {
    const parsed = noodlePollInputSchema.safeParse(pollEditorValue);
    if (!parsed.success) return;
    if (
      updateDraft({
        poll: parsed.data,
      })
    ) {
      setPollEditorValue(null);
      setActiveTool(null);
    }
  };

  const submission = (): NoodlerPostSubmission => ({
    profileId: profile.id,
    title,
    body: body.trim() || (image && !poll ? "Shared an image." : ""),
    access,
    image,
    poll: poll ? { question: poll.question.trim(), options: poll.options.map((option) => option.trim()) } : null,
    format: derivedFormat(),
  });

  const publish = async () => {
    if (composerBusyRef.current) return;
    setPostError(null);
    if (pendingImage) {
      setPostError("Apply or cancel the image crop before posting.");
      return;
    }
    if (!body.trim() && !image && !poll) {
      setPostError("Add a body, image, or poll.");
      return;
    }
    if (poll && !pollIsValid) {
      setPostError("Polls need a question and two unique answers.");
      return;
    }
    try {
      composerBusyRef.current = true;
      setSubmitting(true);
      setActiveTool(null);
      await onManualPost(submission());
      clearDraft();
    } catch (error) {
      setPostError(errorMessage(error, localizeUi("ui.noodle.noodlerpostcomposer.couldNotPublishThisPost")));
    } finally {
      setSubmitting(false);
    }
  };

  const guidePost = async () => {
    if (composerBusyRef.current) return;
    setGuideError(null);
    if (pendingImage) {
      setGuideError(localizeUi("ui.noodle.noodlerpostcomposer.finishImageCrop"));
      return;
    }
    if (!body.trim() && !image && !poll) {
      setGuideError(localizeUi("ui.noodle.noodlerpostcomposer.guidedPostNeedsContent"));
      return;
    }
    if (poll && !pollIsValid) {
      setGuideError(localizeUi("ui.noodle.noodlerpostcomposer.pollNeedsQuestionAndOptions"));
      return;
    }
    if (guide.length > NOODLER_POST_GUIDE_MAX_LENGTH) {
      setGuideError(
        `The combined title and body guide must be ${NOODLER_POST_GUIDE_MAX_LENGTH.toLocaleString()} characters or fewer.`,
      );
      return;
    }
    try {
      composerBusyRef.current = true;
      setSubmitting(true);
      setActiveTool(null);
      await onGuidedPost(submission());
      clearDraft();
    } catch (error) {
      setGuideError(errorMessage(error, localizeUi("ui.noodle.noodlerpostcomposer.couldNotGenerateThisPost")));
    } finally {
      setSubmitting(false);
    }
  };

  if (collapsible && !expanded) {
    return (
      <div className="border-b border-[var(--noodle-divider)] px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          disabled={composerBusy}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-[var(--noodle-divider)] px-3 text-left transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
          aria-expanded="false"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {localizeUi("ui.noodle.noodlerpostcomposer.postAs")} {profile.displayName}
            </span>
            <span className="block text-xs text-[var(--muted-foreground)]">
              {hasDraft
                ? localizeUi("ui.noodle.noodlerpostcomposer.draftSaved")
                : localizeUi("ui.noodle.noodlerpostcomposer.writeDirectlyOrGuideTheAi")}
            </span>
          </span>
          <Pencil size={16} />
        </button>
      </div>
    );
  }

  return (
    <NoodleComposerShell
      dataComponent="SlurpHome.NoodlerPostComposer"
      header={
        collapsible ? (
          <button
            type="button"
            onClick={() => {
              setActiveTool(null);
              setExpanded(false);
            }}
            disabled={composerBusy}
            aria-expanded="true"
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-1 text-xs font-bold text-[var(--noodle-accent)] hover:bg-[var(--accent)] disabled:opacity-50"
          >
            <ChevronDown size={14} />
            {localizeUi("ui.noodle.noodlerpostcomposer.postAs")} {profile.displayName}
          </button>
        ) : undefined
      }
      avatar={<ProfileInitial profile={profile} />}
      tools={
        <NoodleComposerToolRow
          image={{
            ref: imageToolRef,
            active: activeTool === "image" || Boolean(image),
            disabled: composerBusy,
            onClick: () => toggleTool("image"),
          }}
          poll={{
            ref: pollToolRef,
            active: activeTool === "poll" || Boolean(poll),
            disabled: composerBusy,
            onClick: () => toggleTool("poll"),
          }}
          media={{
            ref: mediaToolRef,
            active: activeTool === "media",
            disabled: composerBusy,
            onClick: () => toggleTool("media"),
          }}
          trailing={
            <div ref={accessToolRef} className="relative">
              <button
                type="button"
                onClick={() => toggleTool("access")}
                disabled={composerBusy}
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
                aria-label={localizeUi("ui.noodle.noodlerpostcomposer.postVisibilityValue", {
                  value: localizeUi(`ui.noodle.postaccess.${access}`),
                })}
                title={localizeUi(`ui.noodle.postaccess.${access}.hint`)}
              >
                <Lock size={13} />
                {localizeUi(`ui.noodle.postaccess.${access}`)}
              </button>
            </div>
          }
        />
      }
      action={
        <>
          <button
            type="button"
            onClick={() => void guidePost()}
            disabled={composerBusy || Boolean(pendingImage)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guidePending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {guidePending
              ? localizeUi("ui.noodle.noodlerpostcomposer.guiding")
              : localizeUi("ui.noodle.noodlerpostcomposer.guide_bf073fa")}
          </button>
          {hasDraft && (
            <button
              type="button"
              onClick={discardDraft}
              disabled={composerBusy}
              className="inline-flex h-9 items-center rounded-md px-3 text-xs font-bold text-[var(--muted-foreground)] hover:bg-[var(--accent)] disabled:opacity-50"
            >
              {localizeUi("ui.agents.agenteditor.discard")}
            </button>
          )}
          <button
            type="button"
            onClick={() => void publish()}
            disabled={composerBusy || Boolean(pendingImage) || (!body.trim() && !image && !pollIsValid)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 transition-[opacity,scale] hover:opacity-90 active:scale-[0.96] [&_svg]:!text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {manualPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {manualPending
              ? localizeUi("ui.noodle.noodlerpostcomposer.posting")
              : localizeUi("ui.noodle.noodlerpostcomposer.publishPost")}
          </button>
        </>
      }
      popovers={
        <>
          {activeTool === "media" && !composerBusy && (
            <NoodleAnchoredPopover anchorRef={mediaToolRef} wide>
              <ConversationMediaPickerPanel
                tabs={[{ id: "emoji", label: localizeUi("ui.noodle.media.tabs.emoji") }]}
                activeTab={mediaPickerTab}
                onActiveTabChange={(tab) => {
                  if (!composerBusyRef.current) setMediaPickerTab(tab);
                }}
                onClose={() => setActiveTool(null)}
                onEmojiSelect={(emoji) => updateDraft({ body: body + emoji })}
                onGifSelect={() => {}}
                onStickerSelect={(name) => updateDraft({ body: `${body}sticker:${name}:` })}
                className="w-full !border-[var(--marinara-chat-chrome-panel-border)] !bg-[var(--background)] !text-[var(--foreground)] shadow-2xl shadow-black/35"
              />
            </NoodleAnchoredPopover>
          )}
          {activeTool === "image" && !composerBusy && (
            <NoodleAnchoredPopover anchorRef={imageToolRef} wide>
              <NoodleImageComposer
                imageUrl={imageUrlDraft}
                onImageUrlChange={setImageUrlDraft}
                onChooseFile={() => {
                  if (!composerBusyRef.current) imageFileRef.current?.click();
                }}
                onUseImageUrl={() => void handleImageUrl()}
                onClose={() => setActiveTool(null)}
                disabled={composerBusy}
                hasImage={Boolean(image)}
                urlActionLabel={localizeUi("ui.noodle.noodlerpostcomposer.importUrl")}
              />
            </NoodleAnchoredPopover>
          )}
          {activeTool === "poll" && !composerBusy && (
            <NoodleAnchoredPopover anchorRef={pollToolRef} wide>
              <NoodlePollComposer
                value={pollEditorValue}
                onChange={setPollEditorValue}
                onClose={() => {
                  setPollEditorValue(null);
                  setActiveTool(null);
                }}
                onSubmit={applyPollDraft}
                submitLabel={
                  poll
                    ? localizeUi("ui.noodle.noodlerpostcomposer.updatePoll")
                    : localizeUi("ui.noodle.noodlerpostcomposer.addPoll")
                }
                disabled={composerBusy}
              />
            </NoodleAnchoredPopover>
          )}
          {activeTool === "access" && !composerBusy && (
            <NoodleAnchoredPopover anchorRef={accessToolRef}>
              <div className="marinara-chat-popover space-y-3 rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] p-3 text-[var(--foreground)] shadow-2xl shadow-black/35">
                <p className="text-xs font-bold">{localizeUi("ui.noodle.noodlerpostcomposer.whoCanSeeThisPost")}</p>
                <div className="grid grid-cols-2 gap-1 rounded-md bg-[var(--accent)] p-1">
                  {(["public", "locked"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={access === option}
                      disabled={composerBusy}
                      onClick={() => updateDraft({ access: option })}
                      title={localizeUi(`ui.noodle.postaccess.${option}.hint`)}
                      className={cn(
                        "min-h-8 rounded px-2 text-xs font-bold capitalize",
                        access === option
                          ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                      )}
                    >
                      {localizeUi(`ui.noodle.postaccess.${option}`)}
                    </button>
                  ))}
                </div>
              </div>
            </NoodleAnchoredPopover>
          )}
        </>
      }
      footer={
        (postError || guideError || attachmentError) && (
          <div className="mt-2 space-y-1 text-xs text-[var(--destructive)] @min-[480px]:pl-14" role="alert">
            {postError && (
              <p>
                {localizeUi("ui.noodle.noodlerpostcomposer.post")} {postError}
              </p>
            )}
            {guideError && (
              <p>
                {localizeUi("ui.noodle.noodlerpostcomposer.guide")} {guideError}
              </p>
            )}
            {attachmentError && (
              <p>
                {localizeUi("ui.noodle.noodlerpostcomposer.image")} {attachmentError}
              </p>
            )}
          </div>
        )
      }
    >
      <input ref={imageFileRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
      <label className="block space-y-1">
        <span className="sr-only">{localizeUi("ui.noodle.noodlerpostcomposer.postTitleOptional")}</span>
        <input
          value={title}
          onChange={(event) => updateDraft({ title: event.target.value })}
          maxLength={NOODLER_POST_TITLE_MAX_LENGTH}
          disabled={composerBusy}
          placeholder={localizeUi("ui.noodle.noodlerpostcomposer.postTitleOptional")}
          className="h-9 w-full border-0 bg-transparent text-base font-bold text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
        />
      </label>
      <textarea
        value={body}
        onChange={(event) => updateDraft({ body: event.target.value })}
        maxLength={NOODLER_POST_CONTENT_MAX_LENGTH}
        disabled={composerBusy}
        aria-label={localizeUi("ui.noodle.noodlerpostcomposer.postBody")}
        placeholder={localizeUi("ui.noodle.noodlerpostcomposer.whatSSimmering")}
        className="min-h-20 w-full resize-none border-0 bg-transparent py-2 text-[1rem] leading-6 text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
      />
      {pendingImage && (
        <PostImageCropEditor
          source={pendingImage.source}
          crop={image?.source === pendingImage.source ? image.crop : null}
          disabled={composerBusy}
          onCancel={discardPendingImage}
          onApply={applyImageCrop}
        />
      )}
      {image && !pendingImage && (
        <div className="mb-3 overflow-hidden rounded-xl border border-[var(--noodle-divider)] bg-[var(--noodle-accent)]/10">
          <NoodlerDraftImageFrame image={image} />
          <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-[var(--noodle-accent)]">
            <span>{localizeUi("ui.noodle.noodlehome.attachedImage")}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPendingImage({ source: image.source })}
                disabled={composerBusy}
                className="min-h-8 px-2 font-bold disabled:opacity-50"
              >
                {localizeUi("ui.noodle.noodlerpostcomposer.adjust")}
              </button>
              <button
                type="button"
                onClick={removeImage}
                disabled={composerBusy}
                className="min-h-8 px-2 font-bold disabled:opacity-50"
              >
                {localizeUi("ui.noodle.noodlehome.removeAttachedImage")}
              </button>
            </div>
          </div>
        </div>
      )}
      {poll && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-[var(--noodle-divider)] p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{poll.question}</p>
            <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">{poll.options.join(" · ")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => toggleTool("poll")}
              disabled={composerBusy}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10 disabled:opacity-50"
              aria-label={localizeUi("ui.noodle.noodlehome.editDraftPoll")}
              title={localizeUi("ui.noodle.noodlehome.editPoll")}
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => updateDraft({ poll: null })}
              disabled={composerBusy}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--destructive)] hover:bg-[var(--destructive)]/10 disabled:opacity-50"
              aria-label={localizeUi("ui.noodle.noodlehome.removeDraftPoll")}
              title={localizeUi("ui.noodle.noodlehome.removePoll")}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}
    </NoodleComposerShell>
  );
}

// Creator subscribe/unsubscribe suggestions for desktop layouts.
function SubscriptionSections({
  creators,
  onToggleSubscription,
  togglePending,
  onOpenProfile,
  compact = false,
  collapsed = false,
  onToggleCollapsed,
}: {
  creators: NonNullable<ReturnType<typeof useNoodlerViewer>["data"]>["creators"];
  onToggleSubscription: (creatorAccountId: string, subscribed: boolean) => void;
  togglePending: boolean;
  onOpenProfile?: (accountId: string) => void;
  compact?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (compact) {
    return (
      <section aria-labelledby="noodler-discover-heading">
        {/* A phone shows one card and a half of the row, which is a lot of height for a
            side note. Fold it away, and remember the choice for this session. */}
        {/* The button sits inside the heading, not the other way round: a button may not
            contain a heading, and the heading has to stay a heading for the landmark. */}
        <h3 id="noodler-discover-heading" className="text-xs font-bold text-[var(--muted-foreground)]">
          <button
            type="button"
            onClick={() => onToggleCollapsed?.()}
            aria-expanded={!collapsed}
            // Only claim to control the list while it is mounted.
            {...(collapsed ? {} : { "aria-controls": "noodler-discover-list" })}
            className="flex min-h-11 w-full items-center justify-between gap-2 px-4 pb-2 text-left"
          >
            {localizeUi("ui.noodle.subscriptionsections.discoverCreators")}
            <span className="flex shrink-0 items-center gap-1.5 text-[0.6875rem] font-normal tabular-nums text-[var(--muted-foreground)]">
              {creators.length}
              <ChevronDown
                size={16}
                className={cn("transition-transform duration-200", collapsed ? "-rotate-90" : "rotate-0")}
              />
            </span>
          </button>
        </h3>
        {collapsed ? null : creators.length > 0 ? (
          <div
            id="noodler-discover-list"
            className="flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {creators.map((creator) => {
              const openProfile = onOpenProfile ? () => onOpenProfile(creator.profile.id) : undefined;
              return (
                <article
                  key={creator.profile.id}
                  className="flex w-[11.5rem] shrink-0 snap-start items-center gap-2 rounded-md bg-[var(--accent)]/45 p-2.5 ring-1 ring-inset ring-[var(--noodle-divider)]"
                >
                  <button
                    type="button"
                    onClick={openProfile}
                    disabled={!openProfile}
                    className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
                    aria-label={localizeUi("ui.noodle.noodlehome.viewValue1", { value1: creator.profile.handle })}
                  >
                    <ProfileInitial profile={creator.profile} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={openProfile}
                      className="block w-full truncate text-left text-xs font-bold"
                    >
                      {creator.profile.displayName}
                    </button>
                    <p className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
                      @{creator.profile.handle}
                    </p>
                    <button
                      type="button"
                      disabled={togglePending}
                      onClick={() => onToggleSubscription(creator.profile.id, creator.subscribed)}
                      className="mt-1.5 min-h-8 text-xs font-bold text-[var(--noodle-accent)] disabled:opacity-50"
                    >
                      {creator.subscribed
                        ? localizeUi("ui.noodle.subscriptionsections.unsubscribe")
                        : localizeUi("ui.noodle.lockednoodlerpostcard.subscribe")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="px-4 text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.noodle.subscriptionsections.noCreatorsAreVisibleToThisPersonaYet")}
          </p>
        )}
      </section>
    );
  }
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)]">
      <div className="border-b border-[var(--noodle-divider)] px-4 py-3">
        <h3 className="text-lg font-bold">{localizeUi("ui.noodle.subscriptionsections.creators")}</h3>
      </div>
      {creators.length > 0 ? (
        <div className="divide-y divide-[var(--noodle-divider)]">
          {creators.map((creator) => {
            const openProfile = onOpenProfile ? () => onOpenProfile(creator.profile.id) : undefined;
            return (
              <div key={creator.profile.id} className="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={openProfile}
                  disabled={!openProfile}
                  className="h-fit rounded-full text-left transition-opacity enabled:hover:opacity-80 disabled:cursor-default"
                  title={
                    openProfile
                      ? localizeUi("ui.noodle.noodlehome.viewValue1", { value1: creator.profile.handle })
                      : undefined
                  }
                >
                  <ProfileInitial profile={creator.profile} />
                </button>
                <button
                  type="button"
                  onClick={openProfile}
                  disabled={!openProfile}
                  className="min-w-0 flex-1 text-left disabled:cursor-default"
                >
                  <span className="block truncate text-sm font-semibold transition-colors enabled:hover:text-[var(--noodle-accent)]">
                    {creator.profile.displayName}
                  </span>
                  <span className="block truncate text-xs text-[var(--muted-foreground)]">
                    @{creator.profile.handle}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={togglePending}
                  onClick={() => onToggleSubscription(creator.profile.id, creator.subscribed)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-xs font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
                    creator.subscribed
                      ? "border border-[var(--noodle-divider)] text-[var(--foreground)]"
                      : "bg-[var(--foreground)] text-[var(--background)] [&_svg]:!text-[var(--background)]",
                  )}
                >
                  {creator.subscribed ? <Minus size={14} /> : <Plus size={14} />}
                  {creator.subscribed
                    ? localizeUi("ui.noodle.subscriptionsections.unsubscribe")
                    : localizeUi("ui.noodle.lockednoodlerpostcard.subscribe")}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="px-4 py-5 text-sm text-[var(--muted-foreground)]">
          {localizeUi("ui.noodle.subscriptionsections.noCreatorsAreVisibleToThisPersonaYet")}
        </p>
      )}
    </section>
  );
}

function DisclosureBadge({ mode, detail }: { mode: NoodleIdentityDisclosure | null; detail?: ReactNode }) {
  const { t: localizeUi } = useUiTranslation();
  const label = mode
    ? localizeUi(`ui.noodle.disclosure.${mode}.shortLabel`)
    : localizeUi("ui.noodle.disclosure.setupNeeded");
  const defaultDetail =
    mode === "open"
      ? localizeUi("ui.slurp.disclosure.openDetail")
      : mode === "hinted"
        ? localizeUi("ui.slurp.disclosure.hintedDetail")
        : mode === "secret"
          ? localizeUi("ui.slurp.disclosure.secretDetail")
          : localizeUi("ui.slurp.disclosure.setupDetail");
  return (
    <HelpTooltip
      label={label}
      side="bottom"
      buttonClassName="rounded-full border border-[var(--noodle-divider)] px-2 py-0.5 text-[0.68rem] font-bold capitalize text-[var(--muted-foreground)] opacity-100 [&_svg]:hidden"
      text={<span>{detail ?? defaultDetail}</span>}
    />
  );
}

function EmptyState({
  title,
  detail,
  action,
  onAction,
}: {
  title: string;
  detail?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="px-8 py-8 text-center sm:py-16">
      <UserRound size={36} className="mx-auto !text-[var(--noodle-accent)]" />
      <p className="mt-4 font-bold">{title}</p>
      {detail && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted-foreground)]">{detail}</p>}
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 h-9 rounded-md border border-[var(--noodle-divider)] px-4 text-xs font-bold hover:bg-[var(--accent)]"
        >
          {action}
        </button>
      )}
    </div>
  );
}

function NoodlerFrame({
  children,
  onBack,
  title,
  hideBack = false,
  action,
}: {
  children: ReactNode;
  onBack: () => void;
  title: string;
  hideBack?: boolean;
  action?: ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--noodle-divider)] px-2">
        {!hideBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10"
            aria-label={localizeUi("ui.noodle.noodlerframe.back")}
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</p>
        {action ?? (
          <span className="rounded-full bg-[var(--noodle-accent)]/10 px-2.5 py-1 text-[0.65rem] font-bold text-[var(--noodle-accent)]">
            {localizeUi("ui.noodle.noodlerframe.noodler")}
          </span>
        )}
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
