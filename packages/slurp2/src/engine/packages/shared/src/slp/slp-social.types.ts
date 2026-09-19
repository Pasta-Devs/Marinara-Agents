// ──────────────────────────────────────────────
// Slurp social shapes. Copied from the Engine Noodle types so Slurp2 owns its own vocabulary;
// AvatarCrop stays an Engine contract because Engine avatar rendering consumes it.
// ──────────────────────────────────────────────
import type { AvatarCrop } from "@marinara-engine/shared";

export type SlpAccountKind = "persona" | "character" | "random_user";
/**
 * Which simulated platform an account lives on. This is content separation
 * between two fictional products, NOT a privacy or security control — see
 * `SlpPostAccess` for the actual paywall/visibility concept.
 */
export type SlpPlatform = "noodle" | "noodler";
export type SlpInteractionType = "like" | "repost" | "reply" | "vote";
export type SlpPostSource = "manual" | "generated";
/** The real privacy concept: who may read a Slurp post. Deliberately keeps the word "public". */
export type SlpPostAccess = "public" | "locked";
export type SlpTheme = "system" | "light" | "dark";
export type SlpCarryoverMode = "off" | "conversation" | "roleplay" | "game" | "all";
export type SlpCarryoverTarget = "conversation" | "roleplay" | "game";
export type SlpParticipantSelectionMode = "all" | "random_range" | "exact";
export type SlpIdentityDisclosure = "open" | "hinted" | "secret";
export type SlpCreatorOnboardingState = "incomplete" | "zero" | "completed";
export type SlpCreatorFanArchetype =
  "ordinary" | "eccentric" | "crossFandom" | "raider" | "organicDiscovery" | "freeResource";

export interface SlpCreatorSourceSnapshot {
  publicDisplayName: string;
  publicHandle: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  appearance: string;
  backstory: string;
}

export type SlpCreatorSourceField = keyof SlpCreatorSourceSnapshot;

export type SlpCreatorSourceStatus =
  | { state: "current" }
  | { state: "missing" }
  | {
      state: "changed";
      changes: Array<{ field: SlpCreatorSourceField; previous: string; current: string }>;
    };

export interface SlpAccountAccessSettings {
  hiddenFromAccountIds: string[];
}

export interface SlpWalletSettings {
  coins: number;
}

export interface SlpAccountProfileSettings {
  avatarCrop?: AvatarCrop | null;
  bannerUrl?: string;
  location?: string;
  profileGenerated?: boolean;
  profileManuallyEdited?: boolean;
  noodlerWizardExecutionId?: string;
  /** Server-owned source state used to detect changes after a Creator profile is drafted. */
  noodlerSourceSnapshot?: SlpCreatorSourceSnapshot;
}

export interface SlpAccountSocialSettings {
  followingAccountIds?: string[];
  followingAccountTimestamps?: Record<string, string>;
  notificationsReadAt?: string;
  /**
   * When this viewer persona last had the Slurp feed shown to it, for the
   * "new since your last visit" divider and entry-point counter. Per viewer persona rather
   * than per user: Slurp follows and locked-post access are persona-scoped, so an
   * account-wide timestamp would let one persona silently clear another's.
   */
  noodlerFeedSeenAt?: string;
  /** The same, for the public Slurp timeline. Separate field: one value would let a visit to
   * either surface clear the other's counter. */
  noodleFeedSeenAt?: string;
}

export interface SlpAutoPostingSettings {
  enabled: boolean;
  /** Slurp-owned image enablement; independent of Slurp's enableImagePrompts. */
  imagesEnabled: boolean;
}

export type SlpCreatorFanArchetypeWeights = Record<SlpCreatorFanArchetype, number>;

export interface SlpCreatorFanActivitySettings {
  enabled?: boolean;
  archetypeWeights?: Partial<SlpCreatorFanArchetypeWeights>;
}

export interface SlpAccountSchedulerSettings {
  autoPosting?: SlpAutoPostingSettings;
  fanActivity?: SlpCreatorFanActivitySettings;
}

/** Per-creator outcome of the global "Refresh Slurp now" action; one creator never rolls back another. */
export type SlpCreatorRefreshNowOutcomeStatus =
  | "generated"
  | "disabled"
  | "busy"
  | "connection_required"
  | "connection_not_found"
  | "noodler_account_not_found"
  | "skipped"
  | "error";

export interface SlpCreatorRefreshNowOutcome {
  accountId: string;
  status: SlpCreatorRefreshNowOutcomeStatus;
}
export interface SlpAccountPrivacySettings {
  identityDisclosure?: SlpIdentityDisclosure;
  stagePersonality?: string;
  access: SlpAccountAccessSettings;
}

export interface SlpAccountSettings {
  profile: SlpAccountProfileSettings;
  social: SlpAccountSocialSettings;
  scheduler: SlpAccountSchedulerSettings;
  privacy: SlpAccountPrivacySettings;
  wallet: SlpWalletSettings;
}

export interface SlpPollOption {
  id: string;
  label: string;
}

export interface SlpPoll {
  question: string;
  options: SlpPollOption[];
}

export interface SlpPostImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
}

export interface SlpSettings {
  refreshesPerDay: number;
  participantSelectionMode: SlpParticipantSelectionMode;
  participantMin: number;
  participantMax: number;
  maxGeneratedPostsPerRefresh: number;
  maxRepliesPerRefresh: number;
  maxRepostsPerRefresh: number;
  maxLikesPerRefresh: number;
  maxImagesPerRefresh: number;
  enableImagePrompts: boolean;
  imageGenerationConnectionId: string | null;
  imageGenerationPrompt: string;
  imageGenerationUseAvatarReferences: boolean;
  imageGenerationIncludeDescriptions: boolean;
  allowGalleryImageAttachments: boolean;
  imageCaptioningEnabled: boolean;
  imageCaptioningConnectionId: string | null;
  imageCaptioningUseConnectionDefault: boolean;
  enableLorebookContext: boolean;
  includeCharacterSchedules: boolean;
  enableEnhancedTimelineWriting: boolean;
  allowProfessorMari: boolean;
  allowRandomUsers: boolean;
  invitedCharacterGroupIds: string[];
  carryoverMode: SlpCarryoverMode;
  carryoverModes: SlpCarryoverTarget[];
  carryoverHours: number;
  carryoverMaxItems: number;
  theme: SlpTheme;
  generationConnectionId: string | null;
  enableNoodler: boolean;
  /** Editable creative guidance injected into every Slurp post generation. */
  noodlerGenerationGuidance: string;
  /** Master switch for automatic posting; pauses the scheduler without disabling Slurp. */
  autoPostingScheduleEnabled: boolean;
  /** Rolling text-attempt ceiling and target maximum publication density. */
  postsPerDay: number;
  /** Durable first-run completion flag shared by every client. */
  noodlerOnboardingComplete: boolean;
  /** Explicit durable first-run sentinel, including an intentional zero-creator completion. */
  noodlerOnboardingState: SlpCreatorOnboardingState;
  /** Avoid overnight automatic posts for creators without a character schedule. */
  noodlerNightQuiet: boolean;
  /** Optional synthetic audience activity. Kept separate from creator auto-post scheduling. */
  fanActivityEnabled: boolean;
  fanActivityRunsPerDay: number;
  fanLikesPerRefresh: number;
  fanRepliesPerRefresh: number;
  fanRepostsPerRefresh: number;
  fanArchetypeWeights: SlpCreatorFanArchetypeWeights;
}

export interface SlpCreatorReserveCreatorStatus {
  accountId: string;
  nextPreparedAt: string | null;
}

export interface SlpCreatorReserveStatus {
  preparedCount: number;
  preparedThrough: string | null;
  textAttemptsUsed: number;
  imageAttemptsUsed: number;
  postsPerDay: number;
  preparationNotBefore: string;
  creators: SlpCreatorReserveCreatorStatus[];
}

export interface SlpAccount {
  id: string;
  kind: SlpAccountKind;
  entityId: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  avatarCrop: AvatarCrop | null;
  invited: boolean;
  settings: SlpAccountSettings;
  platform: SlpPlatform;
  noodleAccountId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SlpCreatorStageProfile {
  id: string;
  noodleAccountId: string | null;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  avatarCrop: AvatarCrop | null;
  disclosureMode: SlpIdentityDisclosure | null;
  stagePersonality: string;
  publicIdentity: { displayName: string; handle: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface SlpCreatorManagedStageProfile extends SlpCreatorStageProfile {
  access: SlpAccountAccessSettings;
  autoPosting: SlpAutoPostingSettings;
  sourceStatus: SlpCreatorSourceStatus;
  fanActivity: SlpCreatorFanActivitySettings | null;
}

export interface SlpCreatorProfileSource {
  id: string;
  kind: SlpAccountKind;
  entityId: string;
  displayName: string;
  handle: string;
  bio: string;
  avatarUrl: string | null;
}

export interface SlpAuthorSnapshot {
  id: string;
  kind: SlpAccountKind;
  entityId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  avatarCrop: AvatarCrop | null;
}

export interface SlpPost {
  id: string;
  authorAccountId: string;
  content: string;
  imageUrl: string | null;
  imagePrompt: string | null;
  parentPostId: string | null;
  quotePostId: string | null;
  source: SlpPostSource;
  access: SlpPostAccess;
  metadata: Record<string, unknown>;
  authorSnapshot: SlpAuthorSnapshot | null;
  createdAt: string;
  updatedAt: string;
}

export interface SlpCreatorManagedPost extends SlpPost {
  title: string | null;
}

export interface SlpAccountSubscription {
  id: string;
  viewerAccountId: string;
  creatorAccountId: string;
  createdAt: string;
}

export interface SlpCreatorSubscriber {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  avatarCrop: AvatarCrop | null;
  subscribedAt: string;
}

export interface SlpPostUnlock {
  id: string;
  viewerAccountId: string;
  postId: string;
  createdAt: string;
}

export interface SlpCreatorPostView {
  id: string;
  authorAccountId: string;
  access: SlpPostAccess;
  locked: boolean;
  title: string | null;
  content: string | null;
  /** True when the post owns media, including while locked (imageUrl stays null then). */
  hasImage: boolean;
  imageUrl: string | null;
  imagePrompt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  /** Empty for locked posts — use likeCount/replyCount for the teaser footer. */
  interactions: SlpInteraction[];
  likeCount: number;
  replyCount: number;
}

export interface SlpCreatorViewerCreator {
  profile: SlpCreatorStageProfile;
  subscribed: boolean;
  followed: boolean;
  posts: SlpCreatorPostView[];
}

export interface SlpCreatorViewerScope {
  viewer: SlpAccount;
  creators: SlpCreatorViewerCreator[];
}

export interface SlpInteraction {
  id: string;
  postId: string;
  parentInteractionId: string | null;
  actorAccountId: string;
  type: SlpInteractionType;
  content: string | null;
  imageUrl: string | null;
  actorSnapshot: SlpAuthorSnapshot | null;
  createdAt: string;
}

export type SlpCreatorReplyResult =
  | { status: "generated"; interaction: SlpInteraction }
  | { status: "duplicate"; interaction: SlpInteraction | null }
  | { status: "exhausted" }
  | { status: "busy" }
  | { status: "ineligible" }
  | { status: "connection_required" }
  | { status: "connection_not_found" };

export interface SlpDigestEntry {
  id: string;
  accountIds: string[];
  content: string;
  sourceRunId: string | null;
  sourcePostId: string | null;
  sourceInteractionId: string | null;
  createdAt: string;
}

export type SlpRefreshAttemptKind = "initial" | "text_only_fallback" | "correction";

export interface SlpRefreshAttempt {
  sequence: number;
  kind: SlpRefreshAttemptKind;
  response: string;
  rejectionReason: string | null;
  createdAt: string;
}

export interface SlpRefreshRun {
  id: string;
  status: "running" | "completed" | "failed";
  activeAccountIds: string[];
  prompt: string;
  result: string | null;
  error: string | null;
  attempts: SlpRefreshAttempt[];
  createdAt: string;
  updatedAt: string;
}

export type SlpRefreshSchedulerState = "disabled" | "scheduled" | "due" | "retrying" | "completed";

export interface SlpRefreshSchedulerStatus {
  state: SlpRefreshSchedulerState;
  scheduleDate: string;
  timezone: string;
  refreshesPerDay: number;
  scheduledTimes: string[];
  completedTimes: string[];
  completedSlots: number;
  successfulRefreshes: number;
  skippedSlots: number;
  nextRefreshAt: string | null;
  nextAttemptAt: string | null;
  lastAutomaticRefreshAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
}

export interface SlpBootstrap {
  settings: SlpSettings;
  scheduler: SlpRefreshSchedulerStatus;
  accounts: SlpAccount[];
  posts: SlpPost[];
  interactions: SlpInteraction[];
  digests: SlpDigestEntry[];
}
