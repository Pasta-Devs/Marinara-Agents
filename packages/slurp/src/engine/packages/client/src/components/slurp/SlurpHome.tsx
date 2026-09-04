import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  LayoutGrid,
  Link,
  List,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  useDeleteNoodlerInteraction,
  useGenerateNoodlerNoodlePost,
  useGenerateNoodlerPostImage,
  useConfirmNoodlerImagePrompts,
  useRunNoodlerAutoPostNow,
  useGenerateNoodlerStageProfileDraft,
  useLoadNoodlerPostImage,
  useNoodlerAccounts,
  useNoodlerEligibleAccounts,
  useNoodlerPosts,
  useNoodlerConnectionCounts,
  useSlurpWallet,
  useClaimSlurpDailyRefill,
  useTipSlurpCreator,
  type SlurpWalletEntry,
  useNoodlerViewerWallets,
  useNoodlerSubscribers,
  useNoodlerUnseenCount,
  useHideSlurpAd,
  useHideSlurpAdBrand,
  useRecordSlurpAdAction,
  useSlurpInlineAds,
  useMarkNoodlerFeedSeen,
  useNoodlerViewer,
  useRemoveNoodlerInteraction,
  useToggleNoodlerFollow,
  useToggleNoodlerSubscription,
  useUnlockNoodlerPost,
  useUpdateNoodlerPost,
  useUpdateNoodlerInteraction,
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
  NoodleComposerShell,
  NoodleComposerToolRow,
  type NoodlePostCardCtx,
  type NoodlePostCardModel,
  type NoodlePostImageUpdate,
  useNoodlePostCardController,
} from "./SlurpPostCard";
import { NoodleAnchoredPopover } from "./NoodleAnchoredPopover";
import { LockedSlurpPostCard, SlurpCreatorPostCard } from "./SlurpCreatorPostCard";
import { ChatImageLightbox } from "../chat/ChatImageLightbox";
import { useNearViewportSlurpMediaSrc, useSlurpMediaSrc } from "../../hooks/use-slurp-media-src";
import { SlurpOnboardingWizard } from "./SlurpOnboardingPanel";
import { SlurpAgeGate } from "./SlurpAgeGate";
import {
  Avatar,
  getNoodleAccentStyle,
  SLURP_TOGGLE_ACTIVE_CLASS,
  NewSinceLastVisitDivider,
  HIDE_ON_SCROLL_CLASS,
  NoodleLogo,
  NoodleShell,
  ProfileInitial,
  useHideOnScroll,
  NOODLE_PERSONA_SWITCHER_PAGE_SIZE,
  NOODLE_PINK,
} from "./SlurpShell";
import { SlurpProfileSurface } from "./SlurpProfileSurface";
import { SlurpMessagesView } from "./SlurpMessages";
import { SlurpSettings, SlurpSettingsSidebar } from "./SlurpSettings";
import { NoodleImageComposer } from "./SlurpImageComposer";
import { NoodlePollComposer } from "./SlurpPollComposer";
import { PostImageCropEditor, PostImageFrame } from "./PostImageCropEditor";
import { ConversationMediaPickerPanel, type ConversationMediaPickerTabId } from "../chat/ConversationMediaPickerPanel";
import { HelpTooltip } from "../ui/HelpTooltip";
import { Modal } from "../ui/Modal";
import type { SlurpNavigationState } from "./slurp-navigation.types";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SlurpInlineAd } from "./SlurpInlineAd";
import { SlurpCreatorProfileCard } from "./SlurpCreatorProfileCard";

interface SlurpHomeProps {
  navigation: Extract<SlurpNavigationState, { mode: "creator" }>;
  onNavigate: (destination: SlurpNavigationState) => void;
}

const NOODLER_FEED_WINDOW_SIZE = 20;
// Starting balance until the wallet earns or spends coins through future transactions.
const SLURP_PLACEHOLDER_BALANCE = 1111;
const SLURP_MOMENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const STAGE_PERSONALITY_MAX_LENGTH = 1000;

const AUDIENCE_STANCE_PRESETS = [
  {
    labelKey: "ui.noodle.stageprofileform.stance.girlfriend",
    textKey: "ui.noodle.stageprofileform.stance.girlfriendText",
  },
  {
    labelKey: "ui.noodle.stageprofileform.stance.brattyTease",
    textKey: "ui.noodle.stageprofileform.stance.brattyTeaseText",
  },
  { labelKey: "ui.noodle.stageprofileform.stance.aloof", textKey: "ui.noodle.stageprofileform.stance.aloofText" },
  { labelKey: "ui.noodle.stageprofileform.stance.inCharge", textKey: "ui.noodle.stageprofileform.stance.inChargeText" },
  { labelKey: "ui.noodle.stageprofileform.stance.eager", textKey: "ui.noodle.stageprofileform.stance.eagerText" },
  { labelKey: "ui.noodle.stageprofileform.stance.shy", textKey: "ui.noodle.stageprofileform.stance.shyText" },
] as const;

export function appendAudienceStance(current: string, sentence: string): string {
  const trimmed = current.trim();
  const next = trimmed ? `${trimmed}\n${sentence}` : sentence;
  return next.length <= STAGE_PERSONALITY_MAX_LENGTH ? next : trimmed;
}

interface NoodlerPostSubmission {
  profileId: string;
  title: string;
  body: string;
  access: NoodlePostAccess;
  image: NoodlerPostDraftImage | null;
  poll: { question: string; options: string[] } | null;
  format: NoodlerContentFormat;
  postType: "post" | "story";
  linkedPostId: string | null;
}

type SlurpViewerCreator = NonNullable<ReturnType<typeof useNoodlerViewer>["data"]>["creators"][number];

interface NoodlerPostDraft {
  title: string;
  body: string;
  access: NoodlePostAccess;
  image: NoodlerPostDraftImage | null;
  poll: NoodlePollInput | null;
  postType: "post" | "story";
  linkedPostId: string | null;
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
  postType: "post",
  linkedPostId: null,
};

function isEmptyNoodlerPostDraft(draft: NoodlerPostDraft): boolean {
  return (
    draft.title === EMPTY_NOODLER_POST_DRAFT.title &&
    draft.body === EMPTY_NOODLER_POST_DRAFT.body &&
    draft.access === EMPTY_NOODLER_POST_DRAFT.access &&
    !draft.image &&
    !draft.poll &&
    draft.postType === EMPTY_NOODLER_POST_DRAFT.postType &&
    draft.linkedPostId === EMPTY_NOODLER_POST_DRAFT.linkedPostId
  );
}

function isSlurpStory(post: NoodlerPostView | NoodlerManagedPost): boolean {
  return (post as NoodlerPostView & { story?: boolean }).story === true || post.metadata?.noodlerPostType === "story";
}

const DEFAULT_SLURP_SUBSCRIPTION_PRICE = 5;

function slurpSubscriptionPriceOf(profile: unknown): number {
  const price = (profile as { subscriptionPrice?: unknown } | null)?.subscriptionPrice;
  return typeof price === "number" && price >= 0 ? price : DEFAULT_SLURP_SUBSCRIPTION_PRICE;
}

function linkedPostIdForStory(post: NoodlerPostView): string | null {
  const linkedPostId = (post as NoodlerPostView & { linkedPostId?: unknown }).linkedPostId;
  return typeof linkedPostId === "string" && linkedPostId.length > 0 ? linkedPostId : null;
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

type NoodlerProfileTab = "posts" | "media" | "stories" | "subscribers";

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
  "mari-chrome-field h-11 w-full rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-accent)]";
const textareaClass =
  "mari-chrome-field min-h-24 w-full resize-y rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] p-3 text-sm leading-6 text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-accent)]";
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
  // The active persona's own Creator profile. Bulk onboarding deliberately lists characters only,
  // so without this the player has no obvious way to act as a Creator themselves — the persona is
  // buried in the generic source picker among every eligible character. Both destinations already
  // exist as navigation targets, so this only decides which one the persona currently needs.
  const myCreatorProfile =
    (shellPersonaAccount &&
      accountsQuery.data?.find((profile) => profile.sourceAccountId === shellPersonaAccount.id)) ||
    null;
  const viewerActorAccount =
    shellPersonaAccount && myCreatorProfile
      ? ({
          ...shellPersonaAccount,
          id: myCreatorProfile.id,
          handle: myCreatorProfile.handle,
          displayName: myCreatorProfile.displayName,
          bio: myCreatorProfile.bio,
          avatarUrl: myCreatorProfile.avatarUrl,
          avatarCrop: myCreatorProfile.avatarCrop,
          createdAt: myCreatorProfile.createdAt,
          updatedAt: myCreatorProfile.updatedAt,
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
    // A reply/edit composed as the previous persona must not carry over and submit as the
    // newly-selected one, so discard in-flight composer, tool, and post-menu state first.
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
    // Open the shared two-pane settings on the NoodleR tab instead of a separate
    // stripped-down page, so both shells reach the same settings surface.
    onNavigate({
      mode: "creator-settings",
      tab: "creator",
      section: "overview",
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
      const hasChangedDraft = profileDraft
        ? (Object.keys(savedDraft) as Array<keyof NoodleStageProfileInput>).some(
            (key) => profileDraft[key] !== savedDraft[key],
          )
        : false;
      if (!hasChangedDraft) return true;
      return showConfirmDialog({
        title: localizeUi("ui.noodle.noodlerhome.discardProfileChanges"),
        message: localizeUi("ui.noodle.noodlerhome.yourUnsavedStageProfileChangesWillBeLost"),
        confirmLabel: localizeUi("ui.noodle.noodlerhome.discardChanges"),
        tone: "destructive",
      });
    }
    const hasNewDraft = Boolean(
      profileDraft ||
      creationStep === "source" ||
      creationStep === "disclosure" ||
      creationStep === "draft" ||
      draftNoodleAccountId,
    );
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
  const handleGeneratePostImage = (post: Pick<NoodlerManagedPost, "id" | "authorAccountId">) => {
    setGeneratingPostImageId(post.id);
    generatePostImage.mutate(
      { id: post.id, accountId: post.authorAccountId },
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
    await prepareNavigationAwayFromProfileEditor();
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
    if (!draftNoodleAccountId && !noodlerAccountId) {
      // Was a silent no-op: the guided-persona "Generate draft" button looked dead with no
      // toast, no dialog, and no network request when this source id went missing.
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

  const saveProfile = async (location?: string) => {
    if (!profileDraft) return;
    const input = {
      ...profileDraft,
      handle: profileDraft.handle.replace(/^@+/u, ""),
      ...(editingProfileId && location !== undefined ? { location } : {}),
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
  }: NoodlerPostSubmission) => {
    await createPost.mutateAsync({
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
  };

  const submitGuidedPost = async ({ profileId, title, body, access, image, poll, format }: NoodlerPostSubmission) => {
    if (!(await confirmProviderDisclosure())) return;
    const guide = serializeNoodlerPostGuide(title, body);
    const result = await generatePost.mutateAsync({
      mode: "noodler",
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
                : ("noodler" as const),
    contextualRail:
      // Every destination reserves the same rail column, so the content column does not
      // change width as you move between them.
      navigation.mode === "creator-settings"
        ? ("blank" as const)
        : navigation.mode === "creator" && navigation.view === "profile"
          ? ("blank" as const)
          : navigation.mode === "creator" && (navigation.view === "hub" || navigation.view === "search")
            ? ("populated" as const)
            : ("blank" as const),
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
    walletBalanceLabel: `${viewerWalletsQuery.data?.[viewerPersonaId ?? ""]?.coins ?? SLURP_PLACEHOLDER_BALANCE}`,
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
        alt={postCardController.imageLightbox.prompt || "NoodleR image"}
        pinEnabled={false}
        onClose={() => postCardController.setImageLightbox(null)}
      />
    ) : null,
  } as const;

  if (navigation.mode === "creator-settings") {
    const settingsRail = (
      <aside
        className="relative hidden w-[20rem] shrink-0 overflow-hidden px-4 py-5 @min-[1280px]:block"
        aria-labelledby="slurp-settings-rail-heading"
      >
        <div className="sticky top-4 space-y-3">
          <section className="rounded-xl bg-[var(--slurp-surface)] p-4 shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)]">
            <h2 id="slurp-settings-rail-heading" className="text-sm font-black">
              {localizeUi("ui.slurp.settings.sectionSummary", { defaultValue: "Section summary" })}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
              {localizeUi(`ui.slurp.settings.rail.${navigation.section ?? "overview"}`, {
                defaultValue: "Current Slurp settings and status.",
              })}
            </p>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--muted-foreground)]">
                  {localizeUi("ui.slurp.settings.rail.publishing", { defaultValue: "Publishing" })}
                </dt>
                <dd className="font-black">
                  {slurpSettingsQuery.data?.autoPostingScheduleEnabled
                    ? localizeUi("ui.slurp.settings.rail.active", { defaultValue: "Active" })
                    : localizeUi("ui.slurp.settings.rail.paused", { defaultValue: "Paused" })}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--muted-foreground)]">
                  {localizeUi("ui.slurp.settings.rail.images", { defaultValue: "Images" })}
                </dt>
                <dd className="font-black">
                  {slurpSettingsQuery.data?.enableImagePrompts
                    ? localizeUi("ui.slurp.settings.rail.available", { defaultValue: "Available" })
                    : localizeUi("ui.slurp.settings.rail.paused", { defaultValue: "Paused" })}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--muted-foreground)]">
                  {localizeUi("ui.slurp.settings.rail.fans", { defaultValue: "Fan activity" })}
                </dt>
                <dd className="font-black">
                  {slurpSettingsQuery.data?.fanActivityEnabled
                    ? localizeUi("ui.slurp.settings.rail.active", { defaultValue: "Active" })
                    : localizeUi("ui.slurp.settings.rail.paused", { defaultValue: "Paused" })}
                </dd>
              </div>
            </dl>
          </section>
          <button
            type="button"
            onClick={() => onNavigate({ ...navigation, section: "general" })}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--noodle-accent)] px-4 text-sm font-black text-zinc-950 transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <Play size={15} fill="currentColor" aria-hidden="true" />
            {localizeUi("ui.slurp.settings.rail.openPublishing", { defaultValue: "Open publishing" })}
          </button>
        </div>
      </aside>
    );
    return (
      <NoodleShell
        {...shellProps}
        contextualRail="populated"
        rightRail={settingsRail}
        desktopSidebar={
          <SlurpSettingsSidebar navigation={navigation} onNavigate={onNavigate} onExit={exitToCreatorHub} />
        }
      >
        <SlurpSettings
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
            onAction={() => void accountsQuery.refetch()}
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
    const profileRail = (
      <aside
        className="relative hidden w-[20rem] shrink-0 overflow-hidden px-4 py-5 @min-[1280px]:block"
        aria-labelledby="slurp-profile-rail-heading"
      >
        <div className="sticky top-4 space-y-3">
          <section className="rounded-xl bg-[var(--slurp-surface)] p-4 shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)]">
            <div className="flex items-center gap-3">
              <Avatar account={selectedProfile} size="lg" />
              <div className="min-w-0">
                <h2 id="slurp-profile-rail-heading" className="truncate text-sm font-black">
                  {selectedProfile.displayName}
                </h2>
                <p className="truncate text-xs text-[var(--muted-foreground)]">@{selectedProfile.handle}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-lg bg-[var(--accent)] p-2">
                <strong className="block text-base tabular-nums">{selectedProfile.posts?.length ?? 0}</strong>
                <span className="text-[var(--muted-foreground)]">
                  {localizeUi("ui.slurp.profile.posts", { defaultValue: "Posts" })}
                </span>
              </div>
              <div className="rounded-lg bg-[var(--accent)] p-2">
                <strong className="block text-base tabular-nums">{selectedViewerCreator?.subscriberCount ?? 0}</strong>
                <span className="text-[var(--muted-foreground)]">
                  {localizeUi("ui.slurp.profile.subscribers", { defaultValue: "Subscribers" })}
                </span>
              </div>
            </div>
          </section>
          {selectedViewerCreator && selectedProfile.sourceAccountId !== viewerPersonaId && (
            <section className="space-y-2 rounded-xl bg-[var(--slurp-surface)] p-4 ring-1 ring-inset ring-[var(--noodle-divider)]">
              <p className="text-xs font-bold text-[var(--muted-foreground)]">
                {localizeUi("ui.slurp.profile.supportCreator", { defaultValue: "Support this creator" })}
              </p>
              <p className="text-xs leading-5 text-[var(--muted-foreground)]">
                {localizeUi("ui.slurp.profile.weeklyAccess", {
                  defaultValue: "Get weekly access to locked posts and creator activity.",
                })}
              </p>
              <button
                type="button"
                onClick={() => toggleCreatorSubscription(selectedProfile.id, selectedViewerCreator.subscribed)}
                className="min-h-11 w-full rounded-lg bg-[var(--noodle-accent)] px-3 text-sm font-black text-zinc-950 hover:opacity-90"
              >
                {selectedViewerCreator.subscribed
                  ? localizeUi("ui.slurp.profile.subscribed")
                  : localizeUi("ui.slurp.profile.subscribe")}
              </button>
            </section>
          )}
        </div>
      </aside>
    );
    return (
      <NoodleShell {...shellProps} contextualRail="populated" rightRail={profileRail}>
        <div className="h-full min-h-0 overflow-y-auto">
          <StageProfileView
            key={`${selectedProfile.id}:${shellPersonaAccount?.id ?? "no-viewer"}`}
            profile={selectedProfile}
            profileDraft={editingProfileId === selectedProfile.id ? profileDraft : null}
            onProfileChange={(patch) => setProfileDraft((current) => (current ? { ...current, ...patch } : current))}
            onCancelEdit={closeProfileEditor}
            onSaveEdit={(location) => void saveProfile(location)}
            profileSavePending={updateProfile.isPending}
            onOpenMessages={(creatorAccountId) => onNavigate({ mode: "creator", view: "messages", creatorAccountId })}
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
        <div className="hidden pt-1 @min-[1024px]:block">
          <SubscriptionSections
            creators={(viewerQuery.data?.creators ?? []).filter(
              (creator) => creator.profile.id !== mainAuthorProfile?.id && !creator.subscribed,
            )}
            onToggleSubscription={toggleCreatorSubscription}
            togglePending={toggleSubscription.isPending}
            onOpenProfile={(accountId) => onNavigate({ mode: "creator", view: "profile", accountId })}
            embedded
          />
        </div>
        {showDiscovery && (
          <section className="rounded-xl bg-[var(--slurp-surface)] p-4 ring-1 ring-inset ring-[var(--noodle-divider)]">
            <h2 className="text-sm font-black">
              {localizeUi("ui.slurp.discover.trending", { defaultValue: "Trending now" })}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.discover.trendingDetail", {
                defaultValue: "Creators and posts with the most recent activity.",
              })}
            </p>
            <ol className="mt-3 space-y-2">
              {(viewerQuery.data?.creators ?? [])
                .slice()
                .sort((a, b) => b.posts.length - a.posts.length)
                .slice(0, 5)
                .map((creator, index) => (
                  <li key={creator.profile.id} className="flex items-center gap-2 text-xs">
                    <span className="w-4 shrink-0 font-black text-[var(--noodle-accent)]">{index + 1}</span>
                    <Avatar account={creator.profile} size="xs" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{creator.profile.displayName}</span>
                    <span className="shrink-0 text-[var(--muted-foreground)]">{creator.posts.length}</span>
                  </li>
                ))}
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
          onBack={exitToCreatorHub}
        />
      </NoodleShell>
    );
  }

  if (navigation.mode === "creator" && navigation.view === "messages") {
    return (
      <NoodleShell {...shellProps}>
        <NoodlerFrame onBack={exitToCreatorHub} title={localizeUi("ui.slurp.navigation.messages")} action={<span />}>
          <SlurpMessagesView
            key={navigation.creatorAccountId ?? "inbox"}
            personaId={viewerPersonaId}
            composeWithCreatorAccountId={navigation.creatorAccountId ?? null}
            ownedCreatorAccountIds={myCreatorProfile ? [myCreatorProfile.id] : []}
            onOpenProfile={(accountId) => onNavigate({ mode: "creator", view: "profile", accountId })}
          />
        </NoodlerFrame>
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
                onAction={() => void accountsQuery.refetch()}
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
        onToggleSubscription={toggleCreatorSubscription}
        togglePending={toggleSubscription.isPending || toggleFollow.isPending}
        inlineAdsEnabled={slurpSettingsQuery.data?.inlineAdsEnabled !== false}
        inlineAdsFrequency={slurpSettingsQuery.data?.inlineAdsFrequency ?? "standard"}
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

function AudienceStancePresets({ disabled, onApply }: { disabled: boolean; onApply: (sentence: string) => void }) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div data-component="SlurpHome.AudienceStancePresets" className="space-y-1 pt-1">
      <span className="block text-[11px] font-semibold text-[var(--muted-foreground)]">
        {localizeUi("ui.noodle.stageprofileform.audienceStance")}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {AUDIENCE_STANCE_PRESETS.map((preset) => (
          <button
            key={preset.labelKey}
            type="button"
            disabled={disabled}
            onClick={() => onApply(localizeUi(preset.textKey))}
            className="min-h-8 rounded-full border border-[var(--noodle-divider)] px-3 text-xs font-semibold transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:opacity-50"
          >
            {localizeUi(preset.labelKey)}
          </button>
        ))}
      </div>
      <span className="block text-[11px] text-[var(--muted-foreground)]">
        {localizeUi("ui.noodle.stageprofileform.audienceStanceHint")}
      </span>
    </div>
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
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--noodle-divider)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
                >
                  <Upload size={15} /> {localizeUi("ui.noodle.stageprofileform.upload")}
                </button>
                <button
                  type="button"
                  disabled={avatarPending || disclosureMode !== "open" || !sourceAvatarUrl}
                  onClick={onUseSourceAvatar}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--noodle-divider)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
                >
                  <UserRound size={15} /> {localizeUi("ui.noodle.stageprofileform.useSource")}
                </button>
                {avatar.avatarUrl && (
                  <button
                    type="button"
                    disabled={avatarPending}
                    onClick={onRemoveAvatar}
                    title={localizeUi("ui.noodle.stageprofileform.removeAvatar")}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--noodle-divider)] text-[var(--destructive)] hover:bg-[var(--destructive)]/10 disabled:opacity-50"
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
              <AudienceStancePresets
                disabled={isGenerating || isPending}
                onApply={(sentence) =>
                  onChange({ stagePersonality: appendAudienceStance(draft.stagePersonality, sentence) })
                }
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
                <p className="mt-3 rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-3 text-xs leading-5">
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
                        "flex h-11 max-w-[calc(100%-10.5rem)] items-center justify-center gap-2 rounded-lg border border-[var(--noodle-divider)] px-3 transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] sm:max-w-64",
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
                  className="inline-flex min-h-11 w-40 shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-bold text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90 disabled:opacity-50"
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
        backLabel={localizeUi("ui.slurp.creatorForm.cancel")}
        showProgress={!isEditing}
        disabled={isPending || isGenerating}
        finalAction={
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-5 text-sm font-bold text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
          <p className="mt-3 rounded-lg border border-[var(--noodle-accent)]/40 bg-[var(--noodle-accent)]/10 p-3 text-xs leading-5 text-[var(--foreground)]">
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
              className="mt-3 min-h-11 rounded-lg border border-[var(--noodle-divider)] px-4 text-sm font-semibold hover:bg-[var(--accent)]"
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
                className={`min-h-11 rounded-lg px-2 text-xs font-semibold capitalize ${kind === option ? "bg-[var(--noodle-accent)] text-zinc-950" : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"}`}
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
                  <SourceAccountAvatar account={account} />
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
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--noodle-divider)] text-sm font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
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
          <p className="mt-4 rounded-lg bg-[var(--accent)] p-3 text-xs text-[var(--muted-foreground)]">
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
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--noodle-divider)] px-4 text-sm font-semibold hover:bg-[var(--accent)] disabled:cursor-wait disabled:opacity-50"
        >
          <ArrowLeft size={15} /> {backLabel}
        </button>
        {finalAction ?? (
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled || disabled}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-5 text-sm font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {localizeUi("ui.noodle.wizardfooter.continue")} <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

type SlurpProfileImagePost = NoodlePostCardModel & { imageUrl: string };

function SourceAccountAvatar({
  account,
}: {
  account: {
    displayName: string;
    avatarUrl: string | null;
  };
}) {
  const source = useSlurpMediaSrc(account.avatarUrl, { width: 96 });
  return source ? (
    <img src={source} alt="" decoding="async" className="h-11 w-11 shrink-0 rounded-full object-cover" />
  ) : (
    <ProfileInitial profile={{ ...account, avatarUrl: null }} />
  );
}

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

function SlurpProfileMediaTile({
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
function SlurpMediaWall({
  items,
  onOpenPost,
  onLoadMore,
  total,
}: {
  items: { post: NoodlerPostView & { locked?: boolean }; creator: { profile: NoodlerStageProfile } }[];
  onOpenPost: (postId: string) => void;
  onLoadMore?: () => void;
  total: number;
}) {
  const { t: localizeUi } = useUiTranslation();
  const tiles = items.flatMap<SlurpProfileImagePost>(({ post, creator }) => {
    if (post.locked || typeof post.imageUrl !== "string") return [];
    return [{ ...toNoodlePostCardModel(post, creator.profile), imageUrl: post.imageUrl }];
  });
  if (tiles.length === 0) {
    return (
      <p className="px-4 py-8 text-xs text-[var(--muted-foreground)]">
        {localizeUi("ui.slurp.home.layout.empty", { defaultValue: "No images in this feed yet." })}
      </p>
    );
  }
  return (
    <div className="bg-[var(--slurp-canvas)] pb-6">
      <div className="grid grid-cols-2 gap-px bg-[var(--noodle-divider)] @min-[620px]:grid-cols-3">
        {tiles.map((post) => (
          <SlurpProfileMediaTile key={post.id} post={post} onOpenImage={(_url, id) => onOpenPost(id)} />
        ))}
      </div>
      {onLoadMore && <LoadMoreFeedButton visible={items.length} total={total} onLoadMore={onLoadMore} />}
    </div>
  );
}

function StageProfileView({
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
}: {
  profile: NoodlerManagedStageProfile;
  profileDraft: NoodleStageProfileInput | null;
  onProfileChange: (patch: Partial<NoodleStageProfileInput>) => void;
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
  onAccessChange: (access: NoodlerManagedStageProfile["access"]) => void;
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const bannerSrc = useSlurpMediaSrc(profile.bannerUrl, { width: 1280 });
  const [accessSettingsOpen, setAccessSettingsOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [creatorToolsOpen, setCreatorToolsOpen] = useState(false);
  const updateAutoPosting = useUpdateNoodlerAutoPosting();
  const updateFanActivity = useUpdateNoodlerFanActivity();
  const tipCreator = useTipSlurpCreator();
  const [tipOpen, setTipOpen] = useState(false);
  const [customTip, setCustomTip] = useState("");
  const [locationDraft, setLocationDraft] = useState(
    () => (profile as NoodlerManagedStageProfile & { location?: string }).location ?? "",
  );
  const locationProfileId = useRef(profile.id);
  useEffect(() => {
    if (locationProfileId.current === profile.id) return;
    locationProfileId.current = profile.id;
    setLocationDraft((profile as NoodlerManagedStageProfile & { location?: string }).location ?? "");
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
  const subscribers = subscribersQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const subscriberTotal = subscribersQuery.data?.pages[0]?.total ?? subscribers.length;
  const followerTotal = connectionCounts[profile.id]?.followers ?? 0;
  const profileLikeTotal = posts.reduce((total, post) => total + (post.likeCount ?? 0), 0);
  const latestActivityAt = posts.reduce((latest, post) => Math.max(latest, Date.parse(post.createdAt)), 0);
  const activityAge = Date.now() - latestActivityAt;
  const creatorStatus: "online" | "away" | "offline" =
    activityAge <= 15 * 60_000
      ? "online"
      : activityAge <= 24 * 60 * 60_000 || profile.autoPosting.enabled
        ? "away"
        : "offline";
  const profileLocation = (profile as NoodlerManagedStageProfile & { location?: string }).location ?? "";
  const profileBioLines = profile.bio.split("\n");
  const profileBioQuote = profileBioLines[0]?.trim() ?? "";
  const profileBioBody = profileBioLines.slice(1).join("\n").trim();
  const accent = profileAccent(profile.id);
  const viewingOwnCreator = profile.sourceAccountId === viewerAccount?.entityId;
  const personaBackedCreator = viewerAccounts.some((account) => account.id === profile.sourceAccountId);
  const accessViewerAccounts = viewerAccounts.filter((account) => account.id !== profile.sourceAccountId);
  // Every Slurp Creator profile is operator-managed, so post controls and artwork editing stay
  // available regardless of which viewer persona is looking at the profile.
  const managedCreator = true;
  const editing = Boolean(profileDraft);
  const editDraft = profileDraft ?? {
    displayName: profile.displayName,
    handle: profile.handle,
    bio: profile.bio,
    stagePersonality: profile.stagePersonality,
    disclosureMode: profile.disclosureMode ?? "hinted",
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
                    <p className="truncate text-sm font-bold">{subscriber.displayName}</p>
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
        visiblePosts.map((item) =>
          item.kind === "locked" || item.kind === "controller-locked" ? (
            <div key={item.post.id} className="p-3 @min-[680px]:px-0">
              <LockedSlurpPostCard
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
                personaAccount: viewingOwnCreator ? null : viewerActorAccount,
                postManagement: managedCreator,
              }}
            />
          ),
        )
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
            className="absolute left-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-lg bg-black/50 text-white backdrop-blur-sm hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white @min-[1024px]:hidden"
            title={localizeUi("ui.slurp.profile.back")}
            aria-label={localizeUi("ui.slurp.profile.back")}
          >
            <ChevronLeft size={22} />
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
          ),
        }}
        leadingActions={
          !editing && !viewingOwnCreator && viewerCreator ? (
            <>
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
                {viewerCreator.followed ? <BookmarkCheck size={19} /> : <Bookmark size={19} />}
              </button>
              <button
                type="button"
                disabled={subscriptionPending}
                onClick={() => onToggleSubscription(profile.id, viewerCreator.subscribed)}
                className={cn(
                  "inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-bold transition-[background-color,opacity,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50",
                  viewerCreator.subscribed
                    ? "border border-[var(--noodle-accent)]/50 bg-[var(--noodle-accent)]/10 text-[var(--noodle-accent-foreground)] hover:bg-[var(--noodle-accent)]/15"
                    : "bg-[var(--noodle-accent)] text-zinc-950 hover:opacity-90",
                )}
              >
                {viewerCreator.subscribed
                  ? localizeUi("ui.slurp.profile.subscribed")
                  : `${localizeUi("ui.slurp.profile.subscribe")} · ${localizeUi("ui.slurp.profile.pricePerWeek", {
                      defaultValue: "{{amount}} coins / week",
                      amount: slurpSubscriptionPriceOf(profile),
                    })}`}
              </button>
              <button
                type="button"
                onClick={() => onOpenMessages(profile.id)}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[var(--noodle-divider)] px-4 text-sm font-bold transition-[background-color,opacity,transform] hover:bg-[var(--accent)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <MessageCircle size={16} aria-hidden="true" />
                {localizeUi("ui.slurp.profile.message", { defaultValue: "Message" })}
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
                            tipCreator.mutate({ accountId: profile.id, personaId: viewerAccount.entityId, amount });
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
                          });
                          setCustomTip("");
                          setTipOpen(false);
                        }}
                        className="min-h-9 rounded-md bg-[var(--noodle-accent)] px-2 text-xs font-bold text-zinc-950 disabled:opacity-50"
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
        bioQuote={profileBioQuote ? <span>{profileBioQuote}</span> : null}
        bioContent={profileBioBody ? <p className="whitespace-pre-wrap text-sm leading-6">{profileBioBody}</p> : null}
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
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        preTabsContent={
          managedCreator && !editing ? (
            <section
              data-slurp-creator-tools
              className="border-b border-[var(--noodle-divider)] bg-[var(--slurp-surface)]"
            >
              {/* Collapsed, this is one thin line under the header — the tools are the creator's
                  own business, not the first thing anyone reads on the profile. */}
              <button
                type="button"
                onClick={() => setCreatorToolsOpen((open) => !open)}
                aria-expanded={creatorToolsOpen}
                aria-controls="slurp-creator-tools-panel"
                title={localizeUi("ui.slurp.profile.creatorToolsDetail")}
                className="flex min-h-10 w-full items-center gap-2 px-3 text-start text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] @min-[760px]:px-4"
              >
                <Sparkles size={13} className="shrink-0 text-[var(--noodle-accent)]" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{localizeUi("ui.slurp.profile.creatorTools")}</span>
                {viewingOwnCreator && (
                  <span className="hidden shrink-0 text-[0.68rem] font-semibold text-[var(--noodle-accent)] lg:inline">
                    {localizeUi("ui.noodle.stageprofileview.yourProfile")}
                  </span>
                )}
                <ChevronDown
                  size={14}
                  className={cn(
                    "shrink-0 transition-transform motion-reduce:transition-none",
                    creatorToolsOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>
              <div
                id="slurp-creator-tools-panel"
                hidden={!creatorToolsOpen}
                className="border-t border-[var(--noodle-divider)] bg-[var(--background)]"
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
          ) : null
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
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 disabled:opacity-50"
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
  onToggleSubscription,
  togglePending,
  inlineAdsEnabled,
  inlineAdsFrequency,
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
  onToggleFollow: (creatorAccountId: string, followed: boolean) => void;
  authorProfile: NoodlerManagedStageProfile | null;
  onToggleSubscription: (creatorAccountId: string, subscribed: boolean) => void;
  togglePending: boolean;
  inlineAdsEnabled: boolean;
  inlineAdsFrequency: "light" | "standard" | "frequent";
}) {
  const { t: localizeUi } = useUiTranslation();
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const setStickyHeader = useHideOnScroll(scroller);
  const [discoverCollapsed, setDiscoverCollapsed] = useState(false);
  const [visibleFeedCount, setVisibleFeedCount] = useState(NOODLER_FEED_WINDOW_SIZE);
  const [activeMomentId, setActiveMomentId] = useState<string | null>(null);
  const [feedLayout, setFeedLayout] = useState<"list" | "wall">("list");
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [momentCutoff] = useState(() => Date.now() - SLURP_MOMENT_WINDOW_MS);
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
    return inlineAdsQuery.data?.items[Math.floor(index / inlineAdEvery)] ?? null;
  };
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
  const moments = creators
    .filter((creator) => tab === "all" || creator.followed)
    .flatMap((creator) =>
      creator.posts
        .filter((post) => isSlurpStory(post) && new Date(post.createdAt).getTime() >= momentCutoff)
        .map((post) => ({ creator, post })),
    )
    .sort((left, right) => new Date(right.post.createdAt).getTime() - new Date(left.post.createdAt).getTime());
  const activeMomentIndex = activeMomentId ? moments.findIndex((moment) => moment.post.id === activeMomentId) : -1;
  const activeMoment = activeMomentIndex >= 0 ? moments[activeMomentIndex] : null;
  const feed = creators
    .filter((creator) => tab === "all" || followedCreatorIds.has(creator.profile.id))
    .flatMap((creator) => creator.posts.filter((post) => !isSlurpStory(post)).map((post) => ({ post, creator })))
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
    .flatMap((creator) => creator.posts.filter((post) => !isSlurpStory(post)).map((post) => ({ post, creator })))
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
  const openPostItem = openPostId ? (feed.find((item) => item.post.id === openPostId) ?? null) : null;
  // One place decides what clicking a post image does, so the wall, the feed, and the profile
  // all open the same dialog.
  const feedCardCtx = { ...postCardCtx, openPost: setOpenPostId };
  const visibleSearchResults = searchResults.slice(0, visibleFeedCount);
  const discoveredCreators = creators.filter(
    (creator) =>
      creator.profile.id !== authorProfile?.id &&
      (!searchTerm ||
        searchable(creator.profile.handle).includes(searchTerm) ||
        searchable(creator.profile.displayName).includes(searchTerm)),
  );
  const suggestedCreators = creators
    .filter((creator) => creator.profile.id !== authorProfile?.id && !creator.followed)
    .slice(0, 3);
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
          ...feedCardCtx,
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

        <section className="px-3 pb-6 sm:px-4" aria-labelledby="noodler-discover-creators">
          <div className="px-1 py-3">
            <h2 id="noodler-discover-creators" className="text-lg font-bold">
              {localizeUi("ui.noodle.subscriptionsections.discoverCreators")}
            </h2>
          </div>
          {discoveredCreators.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {discoveredCreators.map((creator) => (
                <SlurpCreatorProfileCard
                  key={creator.profile.id}
                  creator={creator}
                  pending={togglePending}
                  onOpenProfile={postCardCtx.openAuthorProfile}
                  showFollow={false}
                  showSubscription={false}
                  showProfileAction
                />
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
          className="grid h-14 grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] items-center border-b border-[var(--noodle-divider)] px-3 @min-[1024px]:px-5"
          data-component="SlurpHome.HeaderBar"
        >
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:cursor-not-allowed disabled:opacity-50"
            title={localizeUi("ui.noodle.noodlehome.refreshTimeline")}
            aria-label={localizeUi("ui.noodle.noodlehome.refreshTimeline")}
          >
            {isRefreshing ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} aria-hidden="true" />}
          </button>
          <NoodleLogo className="mx-auto h-9 w-14" />
          {/* ponytail: placeholder balance, wire to the real wallet when there is one. */}
          {/* The desktop sidebar carries the same balance, so it only shows where there is no sidebar. */}
          <button
            type="button"
            onClick={onOpenWallet}
            className="justify-self-end flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold tabular-nums text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] @min-[1024px]:hidden"
            aria-label={localizeUi("ui.slurp.wallet.balance", { amount: walletCoins })}
            title={localizeUi("ui.slurp.wallet.balance", { amount: walletCoins })}
          >
            {walletCoins}
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--noodle-accent)] text-[0.62rem] font-black leading-none text-white"
              aria-hidden="true"
            >
              C
            </span>
          </button>
        </div>
      </div>
      {/* Part of the page, not the bar: the strip belongs to Home, so it stays put while the
          sticky header does its own hide-on-scroll dance above it. */}
      <SlurpMomentsShelf moments={moments} newSinceAt={newSinceAt} onOpenMoment={setActiveMomentId} embedded />
      <div className="hidden border-b border-[var(--noodle-divider)] py-3 @min-[1024px]:block @min-[1024px]:px-4 @min-[1280px]:hidden">
        <SubscriptionSections
          creators={(scope?.creators ?? []).filter(
            (creator) => creator.profile.id !== authorProfile?.id && !creator.subscribed,
          )}
          onToggleSubscription={onToggleSubscription}
          togglePending={togglePending}
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
            <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.home.latestDropsDetail")}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--slurp-surface-raised)] px-2.5 py-1 text-xs font-semibold tabular-nums text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)]">
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
            <p className="px-4 py-8 text-xs text-[var(--muted-foreground)]">
              {searchTerm
                ? localizeUi("ui.noodle.viewerhub.noSearchResults")
                : tab === "following"
                  ? localizeUi("ui.noodle.viewerhub.noFollowedPosts")
                  : localizeUi("ui.noodle.viewerhub.noPostsYet")}
            </p>
          ) : feedLayout === "wall" ? (
            <SlurpMediaWall
              items={visibleFeed}
              onOpenPost={setOpenPostId}
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
                    const ad = inlineAdForIndex(index);
                    if (!inlineAdsEnabled || searchTerm || tab !== "all" || !ad) return null;
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
                      pending={togglePending}
                      onOpenProfile={postCardCtx.openAuthorProfile}
                      onToggleFollow={onToggleFollow}
                      onToggleSubscription={onToggleSubscription}
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
          moment={activeMoment}
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
        />
      )}
    </div>
  );
}

function SlurpInlineSuggestedCreators({
  creators,
  pending,
  onOpenProfile,
  onToggleFollow,
  onToggleSubscription,
}: {
  creators: SlurpViewerCreator[];
  pending: boolean;
  onOpenProfile?: (accountId: string) => void;
  onToggleFollow: (creatorAccountId: string, followed: boolean) => void;
  onToggleSubscription: (creatorAccountId: string, subscribed: boolean) => void;
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
            pending={pending}
            onOpenProfile={onOpenProfile}
            onToggleFollow={onToggleFollow}
            onToggleSubscription={onToggleSubscription}
            className="w-64 shrink-0 snap-start"
          />
        ))}
      </div>
    </aside>
  );
}

/**
 * One media dialog for the whole app: the picture takes the room, the words sit beside it.
 * The post version fills the side with the real post card, so replies, reactions, and the
 * composer are the ones the feed already uses.
 */
/**
 * The wallet as a place rather than a number: what you hold, what a top-up costs, what today's
 * earning still has left in it, and where every coin went.
 *
 * Opening this page is what pays the daily stipend and charges due subscription renewals, because
 * the server does that work on read. That is deliberate — there is no scheduler to keep alive.
 */
function SlurpWalletView({
  personaId,
  fallbackCoins,
  personaName,
  onBack,
}: {
  personaId: string | null;
  /** Shown until the wallet loads, so the balance never flashes zero. */
  fallbackCoins: number;
  personaName: string;
  onBack: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const walletQuery = useSlurpWallet(personaId);
  const claimRefill = useClaimSlurpDailyRefill();
  const wallet = walletQuery.data;
  const coins = wallet?.coins ?? fallbackCoins;
  const subscriptions = wallet ? Object.entries(wallet.subscriptions) : [];
  const refillFloor = 60;
  const refillProgress = Math.min(100, Math.round((coins / Math.max(1, refillFloor)) * 100));
  const nextRefillAt = wallet?.stipendOn ? new Date(`${wallet.stipendOn}T00:00:00.000Z`).getTime() + 86_400_000 : null;
  const refillReady = !wallet?.stipendOn || (nextRefillAt !== null && nextRefillAt <= Date.now());
  const entryLabel = (kind: SlurpWalletEntry["kind"]) =>
    localizeUi(`ui.slurp.wallet.entry.${kind}`, { defaultValue: kind });
  return (
    <NoodlerFrame onBack={onBack} title={localizeUi("ui.slurp.navigation.wallet")} action={<span />}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 sm:p-5">
        <section className="relative isolate overflow-hidden rounded-xl bg-[var(--slurp-hero)] p-5 text-white shadow-[var(--slurp-shadow-modal)]">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/75">
            {localizeUi("ui.slurp.wallet.title")}
          </p>
          <p className="mt-2 flex items-center gap-2 text-4xl font-black tabular-nums">
            {coins}
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-base font-black leading-none"
              aria-hidden="true"
            >
              C
            </span>
          </p>
          {personaName && <p className="mt-1 text-sm text-white/80">{personaName}</p>}
          {wallet && (
            <p className="mt-2 text-xs text-white/75">
              {localizeUi("ui.slurp.wallet.earnedToday", {
                defaultValue: "Earned today: {{ads}} from ads, {{engagement}} from posting.",
                ads: wallet.earnedToday.ad,
                engagement: wallet.earnedToday.engagement,
              })}
            </p>
          )}
        </section>

        <section
          aria-labelledby="slurp-wallet-refill"
          className="rounded-xl bg-[var(--slurp-surface)] p-4 ring-1 ring-inset ring-[var(--noodle-divider)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="slurp-wallet-refill" className="text-sm font-bold">
                {localizeUi("ui.slurp.wallet.dailyRefill", { defaultValue: "Daily refill" })}
              </h2>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.slurp.wallet.dailyRefillDetail", {
                  defaultValue: "Claim once per day when your balance is low.",
                })}
              </p>
            </div>
            <span className="text-xs font-bold tabular-nums text-[var(--muted-foreground)]">{refillProgress}%</span>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--accent)]"
            aria-label={`${coins} of ${refillFloor} coins`}
          >
            <div
              className="h-full rounded-full bg-[var(--noodle-accent)] transition-[width] motion-reduce:transition-none"
              style={{ width: `${refillProgress}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--muted-foreground)]">
              {refillReady
                ? localizeUi("ui.slurp.wallet.refillReady", { defaultValue: "Your refill is ready." })
                : localizeUi("ui.slurp.wallet.refillNext", { defaultValue: "Available after the next daily reset." })}
            </p>
            <button
              type="button"
              disabled={!personaId || claimRefill.isPending || !refillReady}
              onClick={() => personaId && claimRefill.mutate({ personaId })}
              className="min-h-10 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50"
            >
              {claimRefill.isPending
                ? localizeUi("ui.slurp.wallet.refilling", { defaultValue: "Claiming..." })
                : localizeUi("ui.slurp.wallet.claimRefill", { defaultValue: "Claim daily refill" })}
            </button>
          </div>
        </section>

        <section
          aria-labelledby="slurp-wallet-subscriptions"
          className="rounded-xl bg-[var(--slurp-surface)] p-4 ring-1 ring-inset ring-[var(--noodle-divider)]"
        >
          <h2 id="slurp-wallet-subscriptions" className="text-sm font-bold">
            {localizeUi("ui.slurp.wallet.subscriptions", { defaultValue: "Subscriptions" })}
          </h2>
          {subscriptions.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {subscriptions.map(([creatorId, subscription]) => (
                <li
                  key={creatorId}
                  className="flex items-center justify-between gap-3 rounded-lg bg-[var(--accent)] p-3"
                >
                  <span className="min-w-0 truncate text-xs font-semibold">{creatorId}</span>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">
                    {subscription.price} / week
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.wallet.noSubscriptions", {
                defaultValue: "Your active subscriptions will appear here.",
              })}
            </p>
          )}
        </section>

        <section
          aria-labelledby="slurp-wallet-activity"
          className="rounded-xl bg-[var(--slurp-surface)] p-4 ring-1 ring-inset ring-[var(--noodle-divider)]"
        >
          <h2 id="slurp-wallet-activity" className="text-sm font-bold">
            {localizeUi("ui.slurp.wallet.activity", { defaultValue: "Recent activity" })}
          </h2>
          {wallet && wallet.ledger.length > 0 ? (
            <ul className="mt-3 flex flex-col divide-y divide-[var(--noodle-divider)]">
              {wallet.ledger.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold">{entryLabel(entry.kind)}</span>
                    {entry.note && (
                      <span className="block truncate text-[0.7rem] text-[var(--muted-foreground)]">{entry.note}</span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 text-sm font-black tabular-nums ${entry.amount < 0 ? "text-[var(--muted-foreground)]" : "text-[var(--noodle-accent)]"}`}
                  >
                    {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.wallet.activityEmpty", {
                defaultValue: "Unlocks and subscriptions paid with coins will show up here.",
              })}
            </p>
          )}
        </section>
      </div>
    </NoodlerFrame>
  );
}

function SlurpMediaDialog({
  title,
  onClose,
  media,
  side,
}: {
  title: string;
  onClose: () => void;
  media: ReactNode;
  side: ReactNode;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      width="max-w-5xl"
      mobileFullscreen
      contentClassName="p-0 sm:p-0"
      panelClassName="noodle-icon-scope"
      panelStyle={getNoodleAccentStyle(NOODLE_PINK)}
    >
      <div className="flex h-full min-h-0 flex-col sm:h-[min(80vh,44rem)] sm:flex-row">
        <div className="relative flex min-h-[16rem] flex-1 items-center justify-center overflow-hidden bg-black sm:min-h-0">
          {media}
        </div>
        <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-y-auto border-t border-[var(--noodle-divider)] bg-[var(--slurp-surface)] sm:w-[22rem] sm:border-s sm:border-t-0 @min-[1280px]:w-[24rem]">
          {side}
        </aside>
      </div>
    </Modal>
  );
}

function SlurpPostDialog({
  post,
  ctx,
  onClose,
}: {
  post: NoodlePostCardModel & { imageUrl: string };
  ctx: NoodlePostCardCtx;
  onClose: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const source = useSlurpMediaSrc(post.imageUrl, { width: 1600 });
  const authorName = post.authorSnapshot?.displayName ?? "";
  return (
    <SlurpMediaDialog
      title={localizeUi("ui.slurp.post.dialogTitle", { name: authorName })}
      onClose={onClose}
      media={
        source ? (
          <img
            src={source}
            alt={localizeUi("ui.noodle.post.imageBy", { name: authorName })}
            decoding="async"
            className="max-h-full w-full object-contain"
          />
        ) : (
          <div className="h-full w-full animate-pulse bg-[var(--slurp-surface-raised)] motion-reduce:animate-none" />
        )
      }
      // The dialog owns the picture, so the card must not draw it or offer its prompt again.
      side={<SlurpCreatorPostCard post={{ ...post, imageUrl: null, imagePrompt: null }} ctx={ctx} surface="profile" />}
    />
  );
}

type SlurpMoment = {
  creator: SlurpViewerCreator;
  post: NoodlerPostView;
};

function SlurpMomentsShelf({
  moments,
  newSinceAt,
  onOpenMoment,
  embedded = false,
}: {
  moments: SlurpMoment[];
  newSinceAt: string | null;
  onOpenMoment: (postId: string) => void;
  embedded?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const seenCreators = new Set<string>();
  const creatorMoments = moments.filter((moment) => {
    if (seenCreators.has(moment.creator.profile.id)) return false;
    seenCreators.add(moment.creator.profile.id);
    return true;
  });
  const seenAt = newSinceAt ? new Date(newSinceAt).getTime() : NaN;
  creatorMoments.sort((left, right) => {
    const leftNew = !Number.isNaN(seenAt) && new Date(left.post.createdAt).getTime() > seenAt;
    const rightNew = !Number.isNaN(seenAt) && new Date(right.post.createdAt).getTime() > seenAt;
    if (leftNew !== rightNew) return leftNew ? -1 : 1;
    return new Date(right.post.createdAt).getTime() - new Date(left.post.createdAt).getTime();
  });

  return (
    <section
      data-component="SlurpHome.Moments"
      aria-labelledby="slurp-moments-heading"
      className={cn(
        "relative isolate overflow-hidden",
        embedded
          ? "bg-[var(--slurp-canvas)] pb-1 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-6 after:bg-[linear-gradient(to_bottom,transparent,var(--slurp-canvas))] after:content-[''] @min-[1024px]:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--noodle-accent)_5%,transparent),transparent)]"
          : "mx-3 mt-3 rounded-xl bg-[linear-gradient(145deg,var(--slurp-surface-raised),color-mix(in_srgb,var(--noodle-accent)_7%,var(--slurp-canvas)))] py-4 shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)] sm:mx-4",
      )}
    >
      <div className={cn("flex items-end justify-between gap-3 px-4", embedded && "@min-[1024px]:px-5")}>
        <div>
          <h2 id="slurp-moments-heading" className="text-sm font-bold tracking-tight">
            {localizeUi("ui.slurp.moments.title")}
          </h2>
          {!embedded && (
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{localizeUi("ui.slurp.moments.detail")}</p>
          )}
        </div>
      </div>
      <div
        className={cn(
          "flex snap-x gap-3 overflow-x-auto px-4 pb-1 pe-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden @min-[1024px]:px-5",
          embedded ? "mt-1" : "mt-3",
        )}
      >
        {creatorMoments.length === 0 ? (
          <div className="flex min-h-16 items-center gap-3 text-[var(--muted-foreground)]" role="status">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--noodle-accent)]/40 bg-[var(--noodle-accent)]/[0.05]">
              <Clock3 size={18} aria-hidden="true" />
            </span>
            <span className="text-xs leading-5 text-pretty">{localizeUi("ui.slurp.moments.empty")}</span>
          </div>
        ) : (
          creatorMoments.map((moment) => {
            const isNew = !Number.isNaN(seenAt) && new Date(moment.post.createdAt).getTime() > seenAt;
            return (
              <button
                key={moment.creator.profile.id}
                type="button"
                onClick={() => onOpenMoment(moment.post.id)}
                className="group flex min-h-20 w-[4.5rem] shrink-0 snap-start flex-col items-center rounded-xl px-1 py-1 text-center transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100"
                aria-label={localizeUi("ui.slurp.moments.open", { name: moment.creator.profile.displayName })}
              >
                <span
                  className={cn(
                    "relative rounded-full p-[3px] transition-transform group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100",
                    isNew
                      ? "bg-[linear-gradient(145deg,var(--noodle-accent),var(--slurp-warm))] shadow-[0_0_0_1px_color-mix(in_srgb,var(--noodle-accent)_25%,transparent),0_8px_24px_-12px_var(--noodle-accent)]"
                      : "bg-[var(--noodle-divider)] opacity-80",
                  )}
                >
                  <span className="block rounded-full bg-[var(--slurp-canvas)] p-0.5">
                    <ProfileInitial profile={moment.creator.profile} />
                  </span>
                  {moment.post.locked && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--noodle-accent)] text-zinc-950 ring-2 ring-[var(--slurp-canvas)]">
                      <Lock size={10} aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className="mt-1.5 w-full truncate text-xs font-semibold">
                  {moment.creator.profile.displayName}
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function SlurpMomentViewer({
  moment,
  index,
  total,
  unlockPending,
  subscriptionPending,
  onClose,
  onPrevious,
  onNext,
  onUnlock,
  onToggleSubscription,
  onOpenProfile,
}: {
  moment: SlurpMoment;
  index: number;
  total: number;
  unlockPending: boolean;
  subscriptionPending: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onUnlock: (postId: string) => void;
  onToggleSubscription: (creatorAccountId: string, subscribed: boolean) => void;
  onOpenProfile?: (accountId: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const mediaSrc = useSlurpMediaSrc(moment.post.imageUrl, { width: 1600 });
  const openProfile = () => {
    onClose();
    onOpenProfile?.(moment.creator.profile.id);
  };
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowLeft" && onPrevious) {
        event.preventDefault();
        onPrevious();
      } else if (event.key === "ArrowRight" && onNext) {
        event.preventDefault();
        onNext();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onNext, onPrevious]);

  return (
    <SlurpMediaDialog
      title={localizeUi("ui.slurp.moments.fromCreator", { name: moment.creator.profile.displayName })}
      onClose={onClose}
      media={
        <>
          {mediaSrc ? (
            <img
              src={mediaSrc}
              decoding="async"
              fetchPriority="high"
              alt={
                moment.post.locked
                  ? localizeUi("ui.noodle.lockednoodlerpostcard.lockedImageFrom", {
                      name: moment.creator.profile.displayName,
                    })
                  : localizeUi("ui.noodle.post.imageBy", { name: moment.creator.profile.displayName })
              }
              className={cn("max-h-full w-full object-contain", moment.post.locked && "scale-105 saturate-[0.82]")}
            />
          ) : (
            <div
              className="absolute inset-0 animate-pulse bg-[var(--slurp-surface-raised)] motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}
          <div
            className="absolute inset-x-0 top-0 h-1 bg-black/40"
            role="progressbar"
            aria-label={localizeUi("ui.slurp.moments.progress")}
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={index + 1}
          >
            <div
              className="h-full bg-[var(--noodle-accent)] transition-[width] motion-reduce:transition-none"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
          {onPrevious && (
            <button
              type="button"
              onClick={onPrevious}
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/15 backdrop-blur-sm hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label={localizeUi("ui.slurp.moments.previous")}
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/15 backdrop-blur-sm hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label={localizeUi("ui.slurp.moments.next")}
            >
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          )}
        </>
      }
      side={
        <div data-component="SlurpHome.MomentViewer" className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openProfile}
              disabled={!onOpenProfile}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:cursor-default"
            >
              <ProfileInitial profile={moment.creator.profile} />
            </button>
            <button
              type="button"
              onClick={openProfile}
              disabled={!onOpenProfile}
              className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:cursor-default"
            >
              <span className="block truncate text-sm font-bold">{moment.creator.profile.displayName}</span>
              <span className="block truncate text-xs text-[var(--muted-foreground)]">
                @{moment.creator.profile.handle}
              </span>
            </button>
            <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
              {index + 1}/{total}
            </span>
          </div>
          {moment.post.locked && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent)] px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] ring-1 ring-inset ring-[var(--noodle-divider)]">
              <Lock size={11} aria-hidden="true" /> {localizeUi("ui.slurp.locked.blurredPreview")}
            </span>
          )}
          {moment.post.title && <h3 className="text-lg font-bold leading-tight">{moment.post.title}</h3>}
          {!moment.post.locked && moment.post.content && (
            <p className="text-sm leading-6 text-[var(--muted-foreground)]">{moment.post.content}</p>
          )}
          {linkedPostIdForStory(moment.post) && onOpenProfile && (
            <button
              type="button"
              onClick={openProfile}
              className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg bg-[var(--accent)] px-3 text-xs font-bold ring-1 ring-inset ring-[var(--noodle-divider)] hover:bg-[var(--noodle-accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
            >
              <Link size={14} aria-hidden="true" /> {localizeUi("ui.slurp.moments.viewLinkedPost")}
            </button>
          )}
          {moment.post.locked && (
            <div className="grid gap-2">
              <button
                type="button"
                disabled={unlockPending}
                onClick={() => onUnlock(moment.post.id)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50 [&_svg]:!text-zinc-950"
              >
                <Eye size={15} aria-hidden="true" /> {localizeUi("ui.slurp.moments.unlock")}
              </button>
              <button
                type="button"
                disabled={subscriptionPending}
                onClick={() => onToggleSubscription(moment.creator.profile.id, moment.creator.subscribed)}
                className="min-h-11 rounded-lg bg-[var(--accent)] px-3 text-xs font-bold ring-1 ring-inset ring-[var(--noodle-divider)] hover:bg-[var(--noodle-accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50"
              >
                {localizeUi("ui.slurp.profile.subscribe")}
              </button>
            </div>
          )}
        </div>
      }
    />
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
  availablePosts,
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
  availablePosts: SlurpProfilePost[];
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
  const { title, body, access, image, poll, postType, linkedPostId } = draft;
  const linkablePosts = availablePosts
    .map((entry) => ("managed" in entry ? entry.managed : entry.viewerPost))
    .filter((post): post is NoodlerManagedPost | NoodlerPostView => Boolean(post) && !isSlurpStory(post));
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
    if (postType === "story" && tool === "poll") return;
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
    postType,
  });

  const publish = async () => {
    if (composerBusyRef.current) return;
    setPostError(null);
    if (pendingImage) {
      setPostError("Apply or cancel the image crop before posting.");
      return;
    }
    if (postType === "story" && !image) {
      setPostError(localizeUi("ui.slurp.stories.imageRequired"));
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
      setGuideError(localizeUi("ui.slurp.composer.guideTooLong", { count: NOODLER_POST_GUIDE_MAX_LENGTH }));
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
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
          {collapsible ? (
            <button
              type="button"
              onClick={() => {
                setActiveTool(null);
                setExpanded(false);
              }}
              disabled={composerBusy}
              aria-expanded="true"
              className="inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-lg px-1 text-xs font-bold text-[var(--noodle-accent)] hover:bg-[var(--accent)] disabled:opacity-50"
            >
              <ChevronDown size={14} />
              <span className="truncate">
                {localizeUi("ui.noodle.noodlerpostcomposer.postAs")} {profile.displayName}
              </span>
            </button>
          ) : (
            <span />
          )}
          <div
            className="grid grid-cols-2 rounded-lg bg-[var(--accent)] p-1 ring-1 ring-inset ring-[var(--noodle-divider)]"
            aria-label={localizeUi("ui.slurp.stories.postType")}
          >
            {(["post", "story"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={postType === option}
                disabled={composerBusy}
                onClick={() => {
                  setActiveTool(null);
                  updateDraft({
                    postType: option,
                    ...(option === "story" ? { poll: null, title: "" } : { linkedPostId: null }),
                  });
                }}
                className={cn(
                  "min-h-9 rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50",
                  postType === option
                    ? SLURP_TOGGLE_ACTIVE_CLASS
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                )}
              >
                {localizeUi(`ui.slurp.stories.type.${option}`)}
              </button>
            ))}
          </div>
        </div>
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
            disabled: composerBusy || postType === "story",
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
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
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
            disabled={composerBusy || Boolean(pendingImage) || postType === "story"}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
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
              className="inline-flex h-9 items-center rounded-lg px-3 text-xs font-bold text-[var(--muted-foreground)] hover:bg-[var(--accent)] disabled:opacity-50"
            >
              {localizeUi("ui.agents.agenteditor.discard")}
            </button>
          )}
          <button
            type="button"
            onClick={() => void publish()}
            disabled={composerBusy || Boolean(pendingImage) || (!body.trim() && !image && !pollIsValid)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 transition-[opacity,scale] hover:opacity-90 active:scale-[0.96] [&_svg]:!text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {manualPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {manualPending
              ? localizeUi("ui.noodle.noodlerpostcomposer.posting")
              : postType === "story"
                ? localizeUi("ui.slurp.stories.publish")
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
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--accent)] p-1">
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
                          ? SLURP_TOGGLE_ACTIVE_CLASS
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
      {postType === "post" && (
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
      )}
      <textarea
        value={body}
        onChange={(event) => updateDraft({ body: event.target.value })}
        maxLength={NOODLER_POST_CONTENT_MAX_LENGTH}
        disabled={composerBusy}
        aria-label={localizeUi("ui.noodle.noodlerpostcomposer.postBody")}
        placeholder={localizeUi(
          postType === "story" ? "ui.slurp.stories.captionPlaceholder" : "ui.noodle.noodlerpostcomposer.whatSSimmering",
        )}
        className="min-h-20 w-full resize-none border-0 bg-transparent py-2 text-[1rem] leading-6 text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
      />
      {postType === "story" && (
        <label className="mb-3 block space-y-1">
          <span className="text-xs font-bold text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.stories.linkPost")}
          </span>
          <select
            value={linkedPostId ?? ""}
            onChange={(event) => updateDraft({ linkedPostId: event.target.value || null })}
            disabled={composerBusy}
            className="h-10 w-full rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
          >
            <option value="">{localizeUi("ui.slurp.stories.noLinkedPost")}</option>
            {linkablePosts.map((post) => (
              <option key={post.id} value={post.id}>
                {post.title || post.content.slice(0, 70) || post.id}
              </option>
            ))}
          </select>
        </label>
      )}
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10 disabled:opacity-50"
              aria-label={localizeUi("ui.noodle.noodlehome.editDraftPoll")}
              title={localizeUi("ui.noodle.noodlehome.editPoll")}
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => updateDraft({ poll: null })}
              disabled={composerBusy}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--destructive)] hover:bg-[var(--destructive)]/10 disabled:opacity-50"
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
  embedded = false,
  collapsed = false,
  onToggleCollapsed,
}: {
  creators: NonNullable<ReturnType<typeof useNoodlerViewer>["data"]>["creators"];
  onToggleSubscription: (creatorAccountId: string, subscribed: boolean) => void;
  togglePending: boolean;
  onOpenProfile?: (accountId: string) => void;
  compact?: boolean;
  embedded?: boolean;
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
            {creators.map((creator) => (
              <SlurpCreatorProfileCard
                key={creator.profile.id}
                creator={creator}
                pending={togglePending}
                onOpenProfile={onOpenProfile}
                onToggleSubscription={onToggleSubscription}
                showFollow={false}
                className="w-64 shrink-0 snap-start"
              />
            ))}
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
    <section
      className={cn(
        "overflow-hidden",
        !embedded &&
          "rounded-xl bg-[var(--slurp-surface)] shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)]",
      )}
    >
      <div className="px-4 pb-2 pt-4">
        <h3 id="slurp-rail-discover-heading" className="text-base font-black tracking-tight">
          {localizeUi("ui.noodle.subscriptionsections.discoverCreators")}
        </h3>
      </div>
      {creators.length > 0 ? (
        <div className="max-h-[36rem] space-y-3 overflow-y-auto p-2 pt-1">
          {creators.map((creator) => (
            <SlurpCreatorProfileCard
              key={creator.profile.id}
              creator={creator}
              pending={togglePending}
              onOpenProfile={onOpenProfile}
              onToggleSubscription={onToggleSubscription}
              showFollow={false}
            />
          ))}
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

/** Post-shaped placeholders: the feed settles into the same layout instead of popping in after a spinner. */
function SlurpFeedSkeleton() {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="space-y-4 bg-[var(--slurp-canvas)] px-3 pb-6 pt-4 sm:px-4" aria-busy="true">
      <span className="sr-only">{localizeUi("ui.slurp.feed.loading", { defaultValue: "Loading posts" })}</span>
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="rounded-xl bg-[var(--slurp-surface)] p-4 shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-[var(--noodle-divider)]"
          aria-hidden="true"
        >
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-[var(--slurp-surface-raised)] motion-reduce:animate-none" />
            <span className="min-w-0 flex-1 space-y-2">
              <span className="block h-3 w-32 animate-pulse rounded-full bg-[var(--slurp-surface-raised)] motion-reduce:animate-none" />
              <span className="block h-2.5 w-20 animate-pulse rounded-full bg-[var(--slurp-surface-raised)] motion-reduce:animate-none" />
            </span>
          </div>
          <div className="mt-4 space-y-2">
            <span className="block h-3 w-full animate-pulse rounded-full bg-[var(--slurp-surface-raised)] motion-reduce:animate-none" />
            <span className="block h-3 w-4/5 animate-pulse rounded-full bg-[var(--slurp-surface-raised)] motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  title,
  detail,
  action,
  onAction,
  icon: Icon = UserRound,
}: {
  title: string;
  detail?: string;
  action?: string;
  onAction?: () => void;
  /** Defaults to a person, which is wrong for an empty search or an empty feed. */
  icon?: LucideIcon;
}) {
  return (
    <div className="px-8 py-8 text-center sm:py-16">
      <Icon size={36} className="mx-auto !text-[var(--noodle-accent)]" />
      <p className="mt-4 font-bold">{title}</p>
      {detail && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted-foreground)]">{detail}</p>}
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 h-9 rounded-lg border border-[var(--noodle-divider)] px-4 text-xs font-bold hover:bg-[var(--accent)]"
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
