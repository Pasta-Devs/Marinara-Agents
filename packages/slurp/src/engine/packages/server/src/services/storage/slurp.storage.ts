// ──────────────────────────────────────────────
// Storage: Noodle Fake Social Media
// ──────────────────────────────────────────────
import { existsSync } from "node:fs";
import { and, desc, eq, gt, inArray, isNotNull, isNull, like, lt, or } from "../../db/file-query.js";
import {
  createNoodlePoll,
  DEFAULT_NOODLER_CREATOR_REPLIES_PER_24_HOURS,
  DEFAULT_NOODLE_WALLET_COINS,
  noodleAccountProfileSettingsSchema,
  noodleAccountPrivacySettingsSchema,
  noodleAccountSocialSettingsSchema,
  noodlerFanActivitySettingsSchema,
  normalizeAvatarCrop,
  readNoodlePollFromMetadata,
  type NoodleAccount,
  type NoodleAccountKind,
  type NoodleAccountProfileUpdateInput,
  type NoodleAccountSchedulerSettings,
  type NoodleAccountSettings,
  type NoodleAccountSettingsPatchInput,
  type NoodleAccountSubscription,
  type NoodleAccountUpdateInput,
  type AvatarCrop,
  type NoodleAuthorSnapshot,
  type NoodleBootstrap,
  type NoodleCreateInteractionInput,
  type NoodleCreatePostInput,
  type NoodleDigestEntry,
  type NoodleInteraction,
  type NoodleInteractionType,
  type NoodlePlatform,
  type NoodlePost,
  type NoodlePostAccess,
  type NoodlePollInput,
  type NoodlePostUnlock,
  type NoodlePostUpdateInput,
  type NoodlePostSource,
  type NoodlerPostUpdateInput,
  type NoodleStageProfileInput,
  type NoodlerManagedPost,
  type NoodlerManagedStageProfile,
  type NoodlerSourceSnapshot,
  type NoodleRefreshAttempt,
  type NoodleRefreshRun,
  type NoodleRemoveInteractionInput,
  type NoodlerCreateInteractionInput,
  type NoodlerRemoveInteractionInput,
} from "@marinara-engine/shared";
import { z } from "zod";
import type { DB } from "../../db/connection.js";
import { isFileUniqueConstraintError } from "../../db/file-schema.js";
export {
  NOODLER_SUBSCRIPTION_COST,
  NOODLER_UNLOCK_COST,
  noodlerUnlockPriceFromMetadata,
  noodlerUnlockPriceMetadata,
} from "../slurp/slurp-prices.js";
import { logger } from "../../lib/logger.js";
import {
  NOODLE_FAN_ACTIVITY_MAX_ACTIVITIES_PER_CREATOR,
  parsePersistedNoodleFanActivityDayPlan,
} from "../slurp/slurp-fan-activity-day-plan.js";
import { NOODLER_FAN_IDENTITY_PREFIX } from "../slurp/slurp-fan-identity-provider.js";
import {
  canViewNoodlerPost,
  isNoodlerHiddenFromViewer,
  withoutNoodlerSelfHiddenAccountId,
} from "../slurp/slurp-access.js";
import {
  NOODLER_MEDIA_URL_PREFIX,
  noodlerPostMediaUrl,
  resolveNoodlerMediaAbsolutePath,
  unlinkNoodlerMedia,
} from "../slurp/slurp-media.js";
import {
  noodleAccounts,
  noodleAccountSubscriptions,
  noodleActivityDigests,
  noodleInteractions,
  noodlePosts,
  noodlePostUnlocks,
  noodleRefreshRuns,
  noodlerCreatorReplyClaims,
  noodlerAutomaticAttempts,
  noodlerPreparedPosts,
  noodlerReserveState,
  noodlerFanActivityState,
} from "../../db/schema/slurp.js";
import { readNoodlerAccountMediaPath, readNoodlerAvatarMediaPath } from "../slurp/slurp-avatar.js";
import { newId, now } from "../../utils/id-generator.js";
import {
  compareMinimizedNoodlerSourceSnapshot,
  isMinimizedNoodlerSourceSnapshot,
  minimizeNoodlerSourceSnapshot,
} from "../slurp/slurp-source.js";
import { resolveNoodlerSourceSnapshot } from "../slurp/slurp-source-resolve.js";
import { createAppSettingsStorage } from "./app-settings.storage.js";
import {
  clearNoodleRefreshFailure,
  noodleRefreshSchedulerStatus,
  parsePersistedNoodleRefreshSchedule,
  reconcileNoodleRefreshSchedule,
  type PersistedNoodleRefreshSchedule,
} from "../slurp/slurp-refresh-schedule.js";
import { pruneNoodleRefreshRuns } from "./slurp-refresh-run-retention.js";
import { normalizeNoodlerSeenAt } from "../slurp/slurp-viewer-unseen.js";
import { createCharactersStorage } from "./characters.storage.js";
import {
  compareNoodlerPostSortKeysDescending,
  isNoodlerPostAfterCursor,
  type NoodlerPostSortKey,
} from "../slurp/slurp-post-page.js";

const SLURP_SETTINGS_KEY = "slurp.settings";
const NOODLE_REFRESH_SCHEDULE_KEY = "slurp.refresh-schedule";
const NOODLER_SOURCE_SNAPSHOT_MIGRATION_KEY = "slurp.migration.noodler-source-snapshots-v1";
const slurpViewerSettingsKey = (personaId: string) => `slurp.viewer.${personaId}.settings`;
const NOODLER_RESERVE_STATE_ID = "noodler-reserve";
let slurpSettingsUpdateQueue: Promise<unknown> = Promise.resolve();
const ROLLING_DAY_MS = 24 * 60 * 60 * 1000;
const MANUAL_POST_INVALIDATION_MS = 60 * 60 * 1000;
/**
 * The reserve poll runs every minute, so a slot this far past its publish time means the server
 * was down or paused. Publishing it now would backdate it, and a long outage would release the
 * whole missed run at once, so an elapsed slot is retired instead.
 */
const ELAPSED_PREPARED_SLOT_MS = 60 * 60 * 1000;
/** How long published/discarded prepared rows are kept for crash recovery before pruning. */
const TERMINAL_PREPARED_POST_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type NoodlerPostPageCursor = NoodlerPostSortKey;

const noodlerFanArchetypeWeightsSchema = z
  .object({
    ordinary: z.number().finite().min(0),
    eccentric: z.number().finite().min(0),
    crossFandom: z.number().finite().min(0),
    raider: z.number().finite().min(0),
    organicDiscovery: z.number().finite().min(0),
    freeResource: z.number().finite().min(0),
  })
  .partial()
  .refine((value) => Object.values(value).some((weight) => (weight ?? 0) > 0), {
    message: "At least one fan archetype weight must be greater than zero.",
  });

/**
 * Creator settings are owned by Slurp. Keep this deliberately narrow: public Noodle settings
 * must not become an implicit dependency of Creator scheduling or generation.
 */
export const slurpSettingsSchema = z.object({
  refreshesPerDay: z.number().int().min(0).max(24),
  generationGuidance: z.string().max(20_000),
  generationConnectionId: z.string().nullable(),
  imageGenerationConnectionId: z.string().nullable(),
  imageGenerationPrompt: z.string(),
  enableImageInterpretation: z.boolean(),
  imageGenerationUseAvatarReferences: z.boolean(),
  imageGenerationIncludeDescriptions: z.boolean(),
  autoPostingImagesEnabled: z.boolean(),
  allowRandomUsers: z.boolean(),
  allowProfessorMari: z.boolean(),
  participantSelectionMode: z.enum(["all", "random", "exact"]),
  participantMin: z.number().int().min(1).max(24),
  participantMax: z.number().int().min(1).max(24),
  invitedCharacterGroupIds: z.array(z.string()),
  carryoverModes: z.array(z.enum(["conversation", "roleplay", "game"])),
  carryoverHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 365),
  carryoverMaxItems: z.number().int().min(1).max(100),
  enableEnhancedTimelineWriting: z.boolean(),
  includeCharacterSchedules: z.boolean(),
  enableLorebookContext: z.boolean(),
  enableImagePrompts: z.boolean(),
  maxImagesPerRefresh: z.number().int().min(0).max(24),
  maxGeneratedPostsPerRefresh: z.number().int().min(0).max(24),
  maxLikesPerRefresh: z.number().int().min(0).max(24),
  maxRepostsPerRefresh: z.number().int().min(0).max(24),
  maxRepliesPerRefresh: z.number().int().min(0).max(24),
  allowGalleryImageAttachments: z.boolean(),
  postsPerDay: z.number().int().min(1).max(24),
  autoPostingScheduleEnabled: z.boolean(),
  autoPostGenerationMode: z.enum(["pre_generate", "on_demand"]),
  fanActivityEnabled: z.boolean(),
  fanActivityRunsPerDay: z.number().int().min(1).max(24),
  fanLikesPerRefresh: z.number().int().min(0).max(24),
  fanRepliesPerRefresh: z.number().int().min(0).max(12),
  fanRepostsPerRefresh: z.number().int().min(0).max(12),
  fanArchetypeWeights: noodlerFanArchetypeWeightsSchema,
  nightQuiet: z.boolean(),
  onboarding: z.enum(["not_started", "in_progress", "completed"]),
});

export type SlurpSettings = z.infer<typeof slurpSettingsSchema>;
export type SlurpSettingsUpdateInput = Partial<SlurpSettings>;
export type SlurpBootstrap = Omit<NoodleBootstrap, "settings"> & { settings: SlurpSettings };

export type SlurpSourceKind = "character" | "persona";
export type SlurpAccount = NoodleAccount & {
  sourceKind: SlurpSourceKind;
  sourceEntityId: string;
};

export type NoodlerPostPageOptions = {
  accountIds: string[];
  creatorSearchAccountIds?: string[];
  readableContentAccountIds?: string[];
  unlockedPostIds?: string[];
  search?: string;
  mediaOnly?: boolean;
  readableOnly?: boolean;
  cursor?: NoodlerPostPageCursor | null;
  limit: number;
};

function noodlerReadablePostCondition(options: NoodlerPostPageOptions) {
  return or(
    eq(noodlePosts.access, "public"),
    inArray(noodlePosts.authorAccountId, options.readableContentAccountIds ?? []),
    inArray(noodlePosts.id, options.unlockedPostIds ?? []),
  );
}

function noodlerPostPageCondition(options: NoodlerPostPageOptions, includeCursor: boolean) {
  const readable = noodlerReadablePostCondition(options);
  return and(
    inArray(noodlePosts.authorAccountId, options.accountIds),
    options.mediaOnly
      ? and(isNotNull(noodlePosts.imageUrl), or(readable, like(noodlePosts.imageUrl, `${NOODLER_MEDIA_URL_PREFIX}%`)))
      : undefined,
    options.readableOnly ? readable : undefined,
    includeCursor && options.cursor
      ? or(
          lt(noodlePosts.createdAt, options.cursor.createdAt),
          and(eq(noodlePosts.createdAt, options.cursor.createdAt), lt(noodlePosts.id, options.cursor.id)),
        )
      : undefined,
  );
}

export type NoodlerPreparedPostPayload = {
  title: string | null;
  content: string;
  access: NoodlePostAccess;
  imagePrompt: string | null;
  metadata: Record<string, unknown>;
};

export type NoodlerPreparedPostState = "scheduled" | "prepared" | "published" | "discarded";
export type NoodlerPreparedImageState = "none" | "pending" | "generating" | "attached" | "rejected" | "closed";
export type SlurpScheduleSlot = {
  id: string;
  publishAt: string;
  state: "scheduled" | "prepared";
};
export type SlurpReserveStatus = {
  preparedCount: number;
  preparedThrough: string | null;
  textAttemptsUsed: number;
  imageAttemptsUsed: number;
  postsPerDay: number;
  preparationNotBefore: string;
  creators: Array<{
    accountId: string;
    nextPreparedAt: string | null;
    preparedCount: number;
    slots: SlurpScheduleSlot[];
  }>;
};

export function noodlerReservePolicyFingerprint(
  account: SlurpAccount,
  settings?: Pick<
    SlurpSettings,
    | "imageGenerationPrompt"
    | "imageGenerationUseAvatarReferences"
    | "imageGenerationIncludeDescriptions"
    | "enableImageInterpretation"
    | "nightQuiet"
  >,
  sourceUpdatedAt?: string | null,
): string {
  // Pick the policy fields explicitly: callers pass the whole settings object, and
  // serializing it wholesale would invalidate every prepared post on any unrelated
  // NoodleR setting change (onboarding state, refresh cadence, …).
  const mediaPolicy = settings
    ? {
        imageGenerationPrompt: settings.imageGenerationPrompt,
        imageGenerationUseAvatarReferences: settings.imageGenerationUseAvatarReferences,
        imageGenerationIncludeDescriptions: settings.imageGenerationIncludeDescriptions,
        enableImageInterpretation: settings.enableImageInterpretation,
        nightQuiet: settings.nightQuiet,
      }
    : null;
  return JSON.stringify({
    sourceKind: account.sourceKind,
    sourceId: account.sourceEntityId,
    sourceUpdatedAt: sourceUpdatedAt ?? null,
    stageProfileUpdatedAt: account.updatedAt,
    disclosure: account.settings.privacy.identityDisclosure ?? "secret",
    stagePersonality: account.settings.privacy.stagePersonality ?? "",
    access: account.settings.privacy.access,
    scheduler: account.settings.scheduler.autoPosting,
    mediaPolicy,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

/**
 * Rewrite the linked-source ID inside a stored reserve fingerprint. Profile import can rename a
 * colliding account, and the fingerprint carries that ID, so without this every restored prepared
 * post fails its own policy check on the next reconcile and is discarded. Lives here because this
 * module owns the fingerprint format.
 */
export function remapNoodlerReservePolicyFingerprint(
  fingerprint: unknown,
  accountMap: ReadonlyMap<string, string>,
): unknown {
  if (typeof fingerprint !== "string") return fingerprint;
  try {
    const parsed = JSON.parse(fingerprint) as { sourceId?: unknown };
    if (typeof parsed?.sourceId !== "string") return fingerprint;
    const remapped = accountMap.get(parsed.sourceId);
    if (!remapped || remapped === parsed.sourceId) return fingerprint;
    // Re-serialized from the parsed object, so key order (and therefore the comparison) is
    // preserved exactly as the original writer produced it.
    return JSON.stringify({ ...parsed, sourceId: remapped });
  } catch {
    return fingerprint;
  }
}

type AccountRow = typeof noodleAccounts.$inferSelect;
type PostRow = typeof noodlePosts.$inferSelect;
type InteractionRow = typeof noodleInteractions.$inferSelect;
type DigestRow = typeof noodleActivityDigests.$inferSelect;
type RefreshRunRow = typeof noodleRefreshRuns.$inferSelect;
type SubscriptionRow = typeof noodleAccountSubscriptions.$inferSelect;
type PostUnlockRow = typeof noodlePostUnlocks.$inferSelect;
type PublicCreateInteractionCommand = Omit<NoodleCreateInteractionInput, "actorKind" | "actorEntityId"> & {
  actorAccountId: string;
};
type PublicRemoveInteractionCommand = Omit<NoodleRemoveInteractionInput, "actorKind" | "actorEntityId"> & {
  actorAccountId: string;
};
type NoodlerCreateInteractionCommand = Omit<NoodlerCreateInteractionInput, "personaId"> & {
  actorAccountId: string;
  viewerPersonaId: string;
};
type NoodlerRemoveInteractionCommand = Omit<NoodlerRemoveInteractionInput, "personaId"> & {
  actorAccountId: string;
  viewerPersonaId: string;
};
type DeleteStoredInteractionCommand = {
  actorAccountId: string;
  type: "like" | "repost";
  parentInteractionId?: string | null;
};
type InsertInteractionCommand = {
  actor: NoodleAccount;
  type: NoodleInteractionType;
  content?: string | null;
  imageUrl?: string | null;
  parentInteractionId: string | null;
};
type NoodlerPostPersistenceInput = {
  /** Optional caller-supplied id so a serving URL can be derived before the row is inserted. */
  id?: string;
  authorAccountId: string;
  title?: string | null;
  content: string;
  source?: NoodlePostSource;
  access?: NoodlePostAccess;
  metadata?: Record<string, unknown>;
  imageUrl?: string | null;
  imagePrompt?: string | null;
};

export type NoodlerCreatorReplyClaimResult =
  | {
      status: "claimed";
      claimId: string;
      creator: NoodleAccount;
      post: NoodlerManagedPost;
      parent: NoodleInteraction;
      viewer: NoodleAccount;
    }
  | { status: "duplicate"; interaction: NoodleInteraction | null }
  | { status: "exhausted" }
  | { status: "ineligible" };

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

let viewerSettingsUpdateQueue: Promise<unknown> = Promise.resolve();

function emptyNoodleAccountSettings(): NoodleAccountSettings {
  return {
    profile: {},
    social: {},
    scheduler: { autoPosting: defaultAutoPostingSettings() },
    privacy: { access: { hiddenFromAccountIds: [] } },
    wallet: { coins: DEFAULT_NOODLE_WALLET_COINS },
  };
}

function defaultAutoPostingSettings(): NonNullable<NoodleAccountSchedulerSettings["autoPosting"]> {
  return { enabled: false, imagesEnabled: false };
}

export function normalizeScheduler(value: unknown): NoodleAccountSchedulerSettings {
  const defaults = defaultAutoPostingSettings();
  const scheduler = parseRecord(value);
  const raw = parseRecord(scheduler.autoPosting);
  const fanActivity = noodlerFanActivitySettingsSchema.safeParse(scheduler.fanActivity);
  return {
    autoPosting: {
      enabled: typeof raw.enabled === "boolean" ? raw.enabled : defaults.enabled,
      imagesEnabled: typeof raw.imagesEnabled === "boolean" ? raw.imagesEnabled : defaults.imagesEnabled,
    },
    ...(fanActivity.success && { fanActivity: fanActivity.data }),
  };
}

function nestedOrLegacy(nested: Record<string, unknown>, legacy: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(nested, key) ? nested[key] : legacy[key];
}

function normalizePersistedBoolean(value: unknown): boolean | undefined {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

export function normalizePersistedInteger(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function validProfileField(key: string, value: unknown): NoodleAccountSettings["profile"] {
  if (value === undefined) return {};
  const parsed = noodleAccountProfileSettingsSchema.safeParse({ [key]: value });
  return parsed.success ? parsed.data : {};
}

function validSocialField(key: string, value: unknown): NoodleAccountSettings["social"] {
  if (value === undefined) return {};
  const parsed = noodleAccountSocialSettingsSchema.safeParse({ [key]: value });
  return parsed.success ? parsed.data : {};
}

function validPrivacyField(key: string, value: unknown): NoodleAccountSettings["privacy"] {
  const empty = { access: { hiddenFromAccountIds: [] } };
  if (value === undefined) return empty;
  const parsed = noodleAccountPrivacySettingsSchema.safeParse({ [key]: value });
  return parsed.success ? parsed.data : empty;
}

export function normalizeNoodleAccountSettings(value: unknown): NoodleAccountSettings {
  const raw = parseRecord(value);
  const rawProfile = parseRecord(raw.profile);
  const rawSocial = parseRecord(raw.social);
  const rawPrivacy = parseRecord(raw.privacy);
  const rawWallet = parseRecord(raw.wallet);
  const rawAvatarCrop = nestedOrLegacy(rawProfile, raw, "avatarCrop");
  const rawBannerUrl = nestedOrLegacy(rawProfile, raw, "bannerUrl");
  const rawLocation = nestedOrLegacy(rawProfile, raw, "location");
  const rawProfileGenerated = nestedOrLegacy(rawProfile, raw, "profileGenerated");
  const rawProfileManuallyEdited = nestedOrLegacy(rawProfile, raw, "profileManuallyEdited");
  const rawNoodlerWizardExecutionId = rawProfile.noodlerWizardExecutionId;
  const rawNoodlerSourceSnapshot = rawProfile.noodlerSourceSnapshot;
  const rawFollowingAccountIds = nestedOrLegacy(rawSocial, raw, "followingAccountIds");
  const rawFollowingAccountTimestamps = nestedOrLegacy(rawSocial, raw, "followingAccountTimestamps");
  const rawNotificationsReadAt = nestedOrLegacy(rawSocial, raw, "notificationsReadAt");
  const rawNoodlerFeedSeenAt = nestedOrLegacy(rawSocial, raw, "noodlerFeedSeenAt");
  const rawNoodleFeedSeenAt = nestedOrLegacy(rawSocial, raw, "noodleFeedSeenAt");
  const rawIdentityDisclosure = nestedOrLegacy(rawPrivacy, raw, "identityDisclosure");
  const rawStagePersonality = nestedOrLegacy(rawPrivacy, raw, "stagePersonality");
  const rawAccess = parseRecord(rawPrivacy.access);
  const normalizedAvatarCrop = rawAvatarCrop === null ? null : normalizeAvatarCrop(rawAvatarCrop);
  const profile = {
    ...(rawAvatarCrop !== undefined &&
      (rawAvatarCrop === null || normalizedAvatarCrop !== null) && { avatarCrop: normalizedAvatarCrop }),
    ...(rawBannerUrl !== undefined && validProfileField("bannerUrl", rawBannerUrl)),
    ...(rawLocation !== undefined && validProfileField("location", rawLocation)),
    ...(rawProfileGenerated !== undefined &&
      validProfileField("profileGenerated", normalizePersistedBoolean(rawProfileGenerated))),
    ...(rawProfileManuallyEdited !== undefined &&
      validProfileField("profileManuallyEdited", normalizePersistedBoolean(rawProfileManuallyEdited))),
    ...(rawNoodlerWizardExecutionId !== undefined &&
      validProfileField("noodlerWizardExecutionId", rawNoodlerWizardExecutionId)),
    ...(rawNoodlerSourceSnapshot !== undefined && validProfileField("noodlerSourceSnapshot", rawNoodlerSourceSnapshot)),
  };
  const followingAccountTimestamps = Object.fromEntries(
    Object.entries(parseRecord(rawFollowingAccountTimestamps)).filter(
      ([accountId, timestamp]) =>
        noodleAccountSocialSettingsSchema.safeParse({ followingAccountTimestamps: { [accountId]: timestamp } }).success,
    ),
  );
  const social = {
    ...(rawFollowingAccountIds !== undefined &&
      validSocialField("followingAccountIds", parseStringArray(rawFollowingAccountIds))),
    ...(rawFollowingAccountTimestamps !== undefined &&
      validSocialField("followingAccountTimestamps", followingAccountTimestamps)),
    ...(rawNotificationsReadAt !== undefined && validSocialField("notificationsReadAt", rawNotificationsReadAt)),
    ...(rawNoodlerFeedSeenAt !== undefined && validSocialField("noodlerFeedSeenAt", rawNoodlerFeedSeenAt)),
    ...(rawNoodleFeedSeenAt !== undefined && validSocialField("noodleFeedSeenAt", rawNoodleFeedSeenAt)),
  };
  const privacy = {
    ...(rawIdentityDisclosure !== undefined && validPrivacyField("identityDisclosure", rawIdentityDisclosure)),
    ...(rawStagePersonality !== undefined && validPrivacyField("stagePersonality", rawStagePersonality)),
    access: {
      hiddenFromAccountIds: parseStringArray(rawAccess.hiddenFromAccountIds),
    },
  };
  return {
    profile,
    social,
    scheduler: normalizeScheduler(raw.scheduler),
    privacy,
    wallet: { coins: normalizePersistedInteger(rawWallet.coins) ?? DEFAULT_NOODLE_WALLET_COINS },
  };
}

function parseRefreshAttempts(value: unknown): NoodleRefreshAttempt[] {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry): NoodleRefreshAttempt[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const candidate = entry as Record<string, unknown>;
    const kind = candidate.kind;
    if (kind !== "initial" && kind !== "text_only_fallback" && kind !== "correction") return [];
    if (
      typeof candidate.sequence !== "number" ||
      !Number.isInteger(candidate.sequence) ||
      candidate.sequence < 1 ||
      typeof candidate.response !== "string" ||
      (candidate.rejectionReason !== null && typeof candidate.rejectionReason !== "string") ||
      typeof candidate.createdAt !== "string"
    ) {
      return [];
    }
    return [
      {
        sequence: candidate.sequence,
        kind,
        response: candidate.response,
        rejectionReason: candidate.rejectionReason,
        createdAt: candidate.createdAt,
      },
    ];
  });
}

export function parseNoodleAvatarCrop(value: unknown): AvatarCrop | null {
  return normalizeAvatarCrop(value);
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
      : [];
  } catch {
    return [];
  }
}

function parseAuthorSnapshot(value: unknown): NoodleAuthorSnapshot | null {
  const parsed = parseRecord(value);
  const id = typeof parsed.id === "string" ? parsed.id : "";
  const kind =
    parsed.kind === "persona" || parsed.kind === "character" || parsed.kind === "random_user" ? parsed.kind : null;
  const entityId = typeof parsed.entityId === "string" ? parsed.entityId : "";
  const handle = typeof parsed.handle === "string" ? parsed.handle : "";
  const displayName = typeof parsed.displayName === "string" ? parsed.displayName : "";
  if (!id || !kind || !entityId || !handle || !displayName) return null;
  return {
    id,
    kind,
    entityId,
    handle,
    displayName,
    avatarUrl: typeof parsed.avatarUrl === "string" && parsed.avatarUrl ? parsed.avatarUrl : null,
    avatarCrop: normalizeAvatarCrop(parsed.avatarCrop),
  };
}

function normalizeBool(value: unknown): boolean {
  return value === true || value === "true";
}

function normalizeHandle(name: string, fallback: string) {
  const base = (name || fallback || "noodle")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 36);
  return base || "noodle";
}

function suffixedPublicHandle(base: string, suffixNumber: number): string {
  const suffix = `_${suffixNumber}`;
  return `${base.slice(0, Math.max(1, 36 - suffix.length))}${suffix}`;
}

function nextAvailablePublicHandle(base: string, reserved: ReadonlySet<string>): string {
  if (!reserved.has(base)) return base;
  for (let suffixNumber = 2; suffixNumber < Number.MAX_SAFE_INTEGER; suffixNumber += 1) {
    const candidate = suffixedPublicHandle(base, suffixNumber);
    if (!reserved.has(candidate)) return candidate;
  }
  throw new Error("Could not allocate a unique Noodle handle");
}

function normalizeAccountKind(kind: string): NoodleAccountKind {
  if (kind === "character" || kind === "random_user") return kind;
  return "persona";
}

function isToggleInteractionType(type: NoodleInteractionType) {
  return type === "like" || type === "repost";
}

// Package-owned default for the editable Slurp generation guidance. This is the
// single tone prompt: creator personality, mood balance, and the adult flirty lean
// all live here so they are visible and editable in Slurp settings, not hardcoded.
// Keep this value aligned with the Slurp settings surface.
export const LEGACY_NOODLER_DEFAULT_GENERATION_GUIDANCE =
  "All NoodleR creators and viewers are adults (18+). This is an adult creator page: flirty, suggestive, teasing, and sensual posts are common, and explicit posts appear regularly when they suit the creator — but they are not required and need not be the majority. Tease the locked posts and answer flirty comments in kind. Keep each creator's personality intact: a shy creator flirts shyly, a blunt one bluntly, a funny one filthily. Ordinary posts — updates, humor, behind the scenes, project news — matter just as much and keep both the page and the character human. Keep low mood or conflict uncommon and character-specific, and do not let recent posts set the default mood.";
export const NOODLER_DEFAULT_GENERATION_GUIDANCE =
  "All Slurp creators and viewers are adults (18+). This is an adult creator page: flirty, suggestive, teasing, and sensual posts are common, and explicit posts appear regularly when they suit the creator — but they are not required and need not be the majority. Tease the locked posts and answer flirty comments in kind. Keep each creator's personality intact: a shy creator flirts shyly, a blunt one bluntly, a funny one filthily. Ordinary posts — updates, humor, behind the scenes, project news — matter just as much and keep both the page and the character human. Keep low mood or conflict uncommon and character-specific, and do not let recent posts set the default mood.";
export const NOODLER_DEFAULT_IMAGE_GENERATION_PROMPT =
  "Create a polished social-media image for an adult Creator post. Match the creator's identity, personality, body, clothing, and established visual details. Follow the post's mood and subject. Describe the pose, expression, setting, lighting, camera angle, composition, and visible details clearly. Flirty, suggestive, sensual, or explicit imagery is allowed when it fits the post and creator, but do not force sexual content into ordinary updates. Keep the image coherent, intentional, and suitable for a public or locked Creator feed.";

/**
 * Every previously shipped default, newest first. An install that never edited the guidance
 * stored one of these strings verbatim, so it is migrated to the current default instead of
 * being kept as if the user had chosen it. Comparison is exact: an edited string differs by at
 * least one character and is preserved as the user's own.
 */

export const DEFAULT_SLURP_SETTINGS: SlurpSettings = {
  refreshesPerDay: 0,
  generationGuidance: NOODLER_DEFAULT_GENERATION_GUIDANCE,
  generationConnectionId: null,
  imageGenerationConnectionId: null,
  imageGenerationPrompt: NOODLER_DEFAULT_IMAGE_GENERATION_PROMPT,
  enableImageInterpretation: true,
  imageGenerationUseAvatarReferences: false,
  imageGenerationIncludeDescriptions: false,
  autoPostingImagesEnabled: false,
  allowRandomUsers: false,
  allowProfessorMari: false,
  participantSelectionMode: "random",
  participantMin: 1,
  participantMax: 4,
  invitedCharacterGroupIds: [],
  carryoverModes: [],
  carryoverHours: 24,
  carryoverMaxItems: 20,
  enableEnhancedTimelineWriting: false,
  includeCharacterSchedules: false,
  enableLorebookContext: false,
  enableImagePrompts: false,
  maxImagesPerRefresh: 0,
  maxGeneratedPostsPerRefresh: 4,
  maxLikesPerRefresh: 4,
  maxRepostsPerRefresh: 2,
  maxRepliesPerRefresh: 4,
  allowGalleryImageAttachments: false,
  postsPerDay: 4,
  autoPostingScheduleEnabled: false,
  autoPostGenerationMode: "pre_generate",
  fanActivityEnabled: false,
  fanActivityRunsPerDay: 4,
  fanLikesPerRefresh: 2,
  fanRepliesPerRefresh: 1,
  fanRepostsPerRefresh: 1,
  fanArchetypeWeights: {
    ordinary: 1,
    eccentric: 1,
    crossFandom: 1,
    raider: 1,
    organicDiscovery: 1,
    freeResource: 1,
  },
  nightQuiet: false,
  onboarding: "not_started",
};

export function normalizeSlurpSettings(raw: unknown): SlurpSettings {
  const rawRecord = parseRecord(raw);
  const candidate = Object.fromEntries(
    Object.entries(DEFAULT_SLURP_SETTINGS).map(([key, value]) => [key, rawRecord[key] ?? value]),
  ) as Record<keyof SlurpSettings, unknown>;
  candidate.generationGuidance =
    rawRecord.generationGuidance === LEGACY_NOODLER_DEFAULT_GENERATION_GUIDANCE
      ? NOODLER_DEFAULT_GENERATION_GUIDANCE
      : (rawRecord.generationGuidance ?? NOODLER_DEFAULT_GENERATION_GUIDANCE);
  candidate.imageGenerationPrompt =
    rawRecord.imageGenerationPrompt === undefined || rawRecord.imageGenerationPrompt === ""
      ? NOODLER_DEFAULT_IMAGE_GENERATION_PROMPT
      : rawRecord.imageGenerationPrompt;
  candidate.nightQuiet = rawRecord.nightQuiet ?? DEFAULT_SLURP_SETTINGS.nightQuiet;
  candidate.onboarding = rawRecord.onboarding ?? DEFAULT_SLURP_SETTINGS.onboarding;
  candidate.fanArchetypeWeights = {
    ...DEFAULT_SLURP_SETTINGS.fanArchetypeWeights,
    ...parseRecord(rawRecord.fanArchetypeWeights),
  };
  const settings: Record<string, unknown> = { ...DEFAULT_SLURP_SETTINGS };
  for (const key of Object.keys(DEFAULT_SLURP_SETTINGS) as Array<keyof SlurpSettings>) {
    const parsed = slurpSettingsSchema.shape[key].safeParse(candidate[key]);
    if (parsed.success) settings[key] = parsed.data;
    else logger.warn("Slurp setting %s was invalid; using its default", key);
  }
  return slurpSettingsSchema.parse(settings);
}

function mapAccount(row: AccountRow): SlurpAccount {
  const settings = normalizeNoodleAccountSettings(row.settings);
  return {
    id: row.id,
    kind: normalizeAccountKind(row.kind),
    entityId: row.entityId,
    handle: row.handle,
    displayName: row.displayName,
    bio: row.bio ?? "",
    avatarUrl: row.avatarUrl ?? null,
    avatarCrop: settings.profile.avatarCrop ?? null,
    invited: normalizeBool(row.invited),
    settings,
    platform: "slurp",
    slurpSourceAccountId: null,
    sourceKind: normalizeAccountKind(row.sourceKind ?? row.kind) as SlurpSourceKind,
    sourceEntityId: row.sourceEntityId ?? row.entityId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapViewer(
  personaId: string,
  settings: NoodleAccountSettings,
  persona: {
    name: string;
    convoDisplayName?: string | null;
    avatarPath?: string | null;
    avatarCrop?: unknown;
    createdAt?: string;
    updatedAt?: string;
  },
): NoodleAccount {
  return {
    id: personaId,
    kind: "persona",
    entityId: personaId,
    handle: normalizeHandle(persona.convoDisplayName || persona.name, personaId),
    displayName: persona.convoDisplayName || persona.name || "User",
    bio: "",
    avatarUrl: persona.avatarPath ?? null,
    avatarCrop: normalizeAvatarCrop(persona.avatarCrop),
    invited: true,
    settings,
    platform: "slurp",
    slurpSourceAccountId: null,
    createdAt: persona.createdAt ?? "",
    updatedAt: persona.updatedAt ?? persona.createdAt ?? "",
  };
}

function sourceAccountFromEntity(
  kind: SlurpSourceKind,
  sourceEntityId: string,
  source: Record<string, unknown>,
): NoodleAccount {
  const data = kind === "character" ? parseRecord(source.data) : source;
  const displayName = String(
    kind === "persona" ? source.convoDisplayName || source.name || "User" : data.name || "Character",
  );
  return {
    id: sourceEntityId,
    kind,
    entityId: sourceEntityId,
    handle: normalizeHandle(displayName, sourceEntityId),
    displayName,
    bio: String(kind === "persona" ? source.aboutMe || source.description || "" : data.description || ""),
    avatarUrl: typeof source.avatarPath === "string" ? source.avatarPath : null,
    avatarCrop: normalizeAvatarCrop(kind === "persona" ? source.avatarCrop : parseRecord(data.extensions).avatarCrop),
    invited: true,
    settings: emptyNoodleAccountSettings(),
    platform: "noodle",
    slurpSourceAccountId: null,
    createdAt: typeof source.createdAt === "string" ? source.createdAt : "",
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
  };
}

function snapshotForAccount(account: NoodleAccount): NoodleAuthorSnapshot {
  return {
    id: account.id,
    kind: account.kind,
    entityId: account.entityId,
    handle: account.handle,
    displayName: account.displayName,
    avatarUrl: account.avatarUrl,
    avatarCrop: account.avatarCrop,
  };
}

function mapPost(row: PostRow): NoodlePost {
  return {
    id: row.id,
    authorAccountId: row.authorAccountId,
    content: row.content ?? "",
    imageUrl: row.imageUrl ?? null,
    imagePrompt: row.imagePrompt ?? null,
    parentPostId: row.parentPostId ?? null,
    quotePostId: row.quotePostId ?? null,
    source: row.source === "generated" ? "generated" : "manual",
    access: row.access === "public" ? "public" : "locked",
    metadata: parseRecord(row.metadata),
    authorSnapshot: parseAuthorSnapshot(row.authorSnapshot),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapManagedPost(row: PostRow): NoodlerManagedPost {
  return {
    ...mapPost(row),
    title: row.title?.trim() || null,
  };
}

function updatePollMetadata(
  metadata: Record<string, unknown>,
  pollUpdate: NoodlePollInput | null | undefined,
): Record<string, unknown> {
  if (pollUpdate === undefined) return { ...metadata };
  const currentPoll = readNoodlePollFromMetadata(metadata);
  const generatedPoll = pollUpdate ? createNoodlePoll(pollUpdate) : null;
  const historicalOptionIds = Array.isArray(metadata.pollOptionIds)
    ? metadata.pollOptionIds.filter((id): id is string => typeof id === "string")
    : [];
  const usedOptionIds = new Set([...historicalOptionIds, ...(currentPoll?.options.map((option) => option.id) ?? [])]);
  const currentOptions = currentPoll?.options ?? [];
  const matchedCurrentOptionIds = new Set<string>();
  const normalizeOptionLabel = (label: string) => label.trim().toLocaleLowerCase();
  const retainedOptionIds =
    generatedPoll?.options.map((option) => {
      const matched = currentOptions.find(
        (current) =>
          !matchedCurrentOptionIds.has(current.id) &&
          normalizeOptionLabel(current.label) === normalizeOptionLabel(option.label),
      );
      if (!matched) return null;
      matchedCurrentOptionIds.add(matched.id);
      return matched.id;
    }) ?? [];
  for (let index = 0; index < retainedOptionIds.length; index += 1) {
    if (retainedOptionIds[index]) continue;
    const samePosition = currentOptions[index];
    const matched =
      samePosition && !matchedCurrentOptionIds.has(samePosition.id)
        ? samePosition
        : currentOptions.find((current) => !matchedCurrentOptionIds.has(current.id));
    if (!matched) continue;
    matchedCurrentOptionIds.add(matched.id);
    retainedOptionIds[index] = matched.id;
  }
  let nextOptionNumber = 1;
  const nextPoll = generatedPoll
    ? {
        ...generatedPoll,
        options: generatedPoll.options.map((option, index) => {
          const retainedOptionId = retainedOptionIds[index];
          if (retainedOptionId) return { ...option, id: retainedOptionId };
          while (usedOptionIds.has(`option-${nextOptionNumber}`)) nextOptionNumber += 1;
          const id = `option-${nextOptionNumber}`;
          usedOptionIds.add(id);
          nextOptionNumber += 1;
          return { ...option, id };
        }),
      }
    : null;
  const nextMetadata = { ...metadata };
  if (nextPoll) nextMetadata.poll = nextPoll;
  else delete nextMetadata.poll;
  nextMetadata.pollOptionIds = [...usedOptionIds];
  return nextMetadata;
}

function mapSubscription(row: SubscriptionRow): NoodleAccountSubscription {
  return {
    id: row.id,
    viewerAccountId: row.viewerAccountId,
    creatorAccountId: row.creatorAccountId,
    createdAt: row.createdAt,
  };
}

function mapPostUnlock(row: PostUnlockRow): NoodlePostUnlock {
  return { id: row.id, viewerAccountId: row.viewerAccountId, postId: row.postId, createdAt: row.createdAt };
}

function imageClaimIsAvailable(row: PostRow, at: string) {
  return (
    Boolean(row.imagePrompt) &&
    !row.imageUrl &&
    (!row.imageClaimToken || !row.imageClaimLeaseUntil || row.imageClaimLeaseUntil <= at)
  );
}

function mapInteraction(row: InteractionRow): NoodleInteraction {
  return {
    id: row.id,
    postId: row.postId,
    parentInteractionId: row.parentInteractionId ?? null,
    actorAccountId: row.actorAccountId,
    type:
      row.type === "repost" || row.type === "reply" || row.type === "like" || row.type === "vote"
        ? (row.type as NoodleInteractionType)
        : "like",
    content: row.content ?? null,
    imageUrl: row.imageUrl ?? null,
    actorSnapshot: parseAuthorSnapshot(row.actorSnapshot),
    createdAt: row.createdAt,
  };
}

function mapDigest(row: DigestRow): NoodleDigestEntry {
  return {
    id: row.id,
    accountIds: parseStringArray(row.accountIds),
    content: row.content ?? "",
    sourceRunId: row.sourceRunId ?? null,
    sourcePostId: row.sourcePostId ?? null,
    sourceInteractionId: row.sourceInteractionId ?? null,
    createdAt: row.createdAt,
  };
}

function mapRefreshRun(row: RefreshRunRow): NoodleRefreshRun {
  return {
    id: row.id,
    status: row.status === "completed" || row.status === "failed" ? row.status : "running",
    activeAccountIds: parseStringArray(row.activeAccountIds),
    prompt: row.prompt ?? "",
    result: row.result ?? null,
    error: row.error ?? null,
    attempts: parseRefreshAttempts(row.attempts),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createSlurpStorage(db: DB) {
  const settingsStore = createAppSettingsStorage(db);
  const characters = createCharactersStorage(db);
  let publicHandleReconciliation: Promise<void> | null = null;

  const pruneFinishedRefreshRuns = async () => {
    await db.transaction(async (tx) => {
      await pruneNoodleRefreshRuns({
        list: () => tx.select().from(noodleRefreshRuns),
        replace: async (rows) => {
          await tx.delete(noodleRefreshRuns);
          if (rows.length > 0) await tx.insert(noodleRefreshRuns).values(rows);
        },
        touch: async (row) => {
          await tx.update(noodleRefreshRuns).set({ updatedAt: row.updatedAt }).where(eq(noodleRefreshRuns.id, row.id));
        },
        flush: () => tx._fileStore.flush(),
      });
    });
  };

  const reconcilePublicHandles = () => {
    if (publicHandleReconciliation) return publicHandleReconciliation;
    publicHandleReconciliation = db
      .transaction(async (tx) => {
        const rows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.platform, "slurp"));
        const groups = new Map<string, AccountRow[]>();
        for (const row of rows) {
          const normalized = normalizeHandle(row.handle, row.entityId);
          const group = groups.get(normalized);
          if (group) group.push(row);
          else groups.set(normalized, [row]);
        }

        const reserved = new Set(groups.keys());
        for (const [base, group] of groups) {
          group.sort(
            (left, right) =>
              String(left.createdAt).localeCompare(String(right.createdAt)) || left.id.localeCompare(right.id),
          );
          const keeper = group.find((row) => row.handle === base) ?? group[0]!;
          for (const duplicate of group) {
            if (duplicate.id === keeper.id) continue;
            const handle = nextAvailablePublicHandle(base, reserved);
            reserved.add(handle);
            await tx
              .update(noodleAccounts)
              .set({ handle, updatedAt: now() })
              .where(eq(noodleAccounts.id, duplicate.id));
          }
          if (keeper.handle !== base) {
            await tx
              .update(noodleAccounts)
              .set({ handle: base, updatedAt: now() })
              .where(eq(noodleAccounts.id, keeper.id));
          }
        }
      })
      .catch((error) => {
        publicHandleReconciliation = null;
        throw error;
      });
    return publicHandleReconciliation;
  };

  const insertInteraction = async (
    postId: string,
    input: InsertInteractionCommand,
  ): Promise<NoodleInteraction | null> => {
    const readExistingToggleInteraction = async () => {
      if (!isToggleInteractionType(input.type)) return null;
      const existing = await db
        .select()
        .from(noodleInteractions)
        .where(
          and(
            eq(noodleInteractions.postId, postId),
            eq(noodleInteractions.actorAccountId, input.actor.id),
            eq(noodleInteractions.type, input.type),
            input.parentInteractionId
              ? eq(noodleInteractions.parentInteractionId, input.parentInteractionId)
              : isNull(noodleInteractions.parentInteractionId),
          ),
        );
      return existing[0] ? mapInteraction(existing[0]) : null;
    };

    const existingToggleInteraction = await readExistingToggleInteraction();
    if (existingToggleInteraction) return existingToggleInteraction;

    const id = newId();
    try {
      await db.insert(noodleInteractions).values({
        id,
        postId,
        parentInteractionId: input.parentInteractionId,
        actorAccountId: input.actor.id,
        type: input.type,
        content: input.content?.trim() || null,
        imageUrl: input.imageUrl?.trim() || null,
        actorSnapshot: JSON.stringify(snapshotForAccount(input.actor)),
        createdAt: now(),
      });
    } catch (error) {
      const toggleKeys = ["postId", "actorAccountId", "type", "parentInteractionId"];
      if (isToggleInteractionType(input.type) && isFileUniqueConstraintError(error, "slurp_interactions", toggleKeys)) {
        const existing = await readExistingToggleInteraction();
        if (existing) return existing;
      }
      throw error;
    }
    const rows = await db.select().from(noodleInteractions).where(eq(noodleInteractions.id, id));
    return rows[0] ? mapInteraction(rows[0]) : null;
  };

  const normalizeLegacyNoodlerToggleInteraction = async (
    tx: Parameters<Parameters<DB["transaction"]>[0]>[0],
    input: {
      postId: string;
      actorAccountId: string;
      viewerPersonaId: string;
      type: "like" | "repost" | "vote";
      parentInteractionId: string | null;
      actor: NoodleAccount;
    },
  ) => {
    if (input.actorAccountId === input.viewerPersonaId) return;
    const actorWhere = and(
      eq(noodleInteractions.postId, input.postId),
      eq(noodleInteractions.type, input.type),
      input.parentInteractionId
        ? eq(noodleInteractions.parentInteractionId, input.parentInteractionId)
        : isNull(noodleInteractions.parentInteractionId),
    );
    const [legacyRows, actorRows] = await Promise.all([
      tx
        .select()
        .from(noodleInteractions)
        .where(and(actorWhere, eq(noodleInteractions.actorAccountId, input.viewerPersonaId))),
      tx
        .select()
        .from(noodleInteractions)
        .where(and(actorWhere, eq(noodleInteractions.actorAccountId, input.actorAccountId))),
    ]);
    if (legacyRows.length === 0) return;
    const legacyIds = legacyRows.map((row) => row.id);
    if (actorRows.length > 0) {
      await tx.delete(noodleInteractions).where(inArray(noodleInteractions.id, legacyIds));
      return;
    }
    const [keeper, ...duplicates] = legacyRows;
    await tx
      .update(noodleInteractions)
      .set({ actorAccountId: input.actorAccountId, actorSnapshot: JSON.stringify(snapshotForAccount(input.actor)) })
      .where(eq(noodleInteractions.id, keeper!.id));
    if (duplicates.length > 0) {
      await tx.delete(noodleInteractions).where(
        inArray(
          noodleInteractions.id,
          duplicates.map((row) => row.id),
        ),
      );
    }
  };

  const upsertPollVote = async (
    postId: string,
    actor: NoodleAccount,
    viewerPersonaId: string,
    optionId: string,
    authorPlatform: NoodlePlatform,
    imageUrl: string | null,
  ): Promise<NoodleInteraction | null> => {
    return db.transaction(async (tx) => {
      const [postRows, actorRows] = await Promise.all([
        tx.select().from(noodlePosts).where(eq(noodlePosts.id, postId)),
        tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, actor.id), eq(noodleAccounts.platform, "slurp"))),
      ]);
      const currentPost = postRows[0];
      if (!currentPost || !actorRows[0]) return null;
      const authorRows = await tx
        .select()
        .from(noodleAccounts)
        .where(and(eq(noodleAccounts.id, currentPost.authorAccountId), eq(noodleAccounts.platform, authorPlatform)));
      const currentPoll = readNoodlePollFromMetadata(parseRecord(currentPost.metadata));
      if (!authorRows[0] || !currentPoll?.options.some((option) => option.id === optionId)) return null;

      const currentActor = actorRows[0] ? mapAccount(actorRows[0]) : actor;
      if (authorPlatform === "noodler") {
        const currentAuthor = mapAccount(authorRows[0]);
        if (
          currentActor.kind !== "persona" ||
          (currentAuthor.sourceKind === "persona" && currentAuthor.sourceEntityId === viewerPersonaId) ||
          isNoodlerHiddenFromViewer(currentAuthor, viewerPersonaId)
        ) {
          return null;
        }
        const currentPostView = mapPost(currentPost);
        const subscriptionRows =
          currentPostView.access === "public"
            ? []
            : await tx
                .select()
                .from(noodleAccountSubscriptions)
                .where(
                  and(
                    eq(noodleAccountSubscriptions.viewerAccountId, viewerPersonaId),
                    eq(noodleAccountSubscriptions.creatorAccountId, currentAuthor.id),
                  ),
                );
        const unlockRows =
          currentPostView.access === "locked"
            ? await tx
                .select()
                .from(noodlePostUnlocks)
                .where(
                  and(
                    eq(noodlePostUnlocks.viewerAccountId, viewerPersonaId),
                    eq(noodlePostUnlocks.postId, currentPostView.id),
                  ),
                )
            : [];
        if (
          !canViewNoodlerPost({
            post: currentPostView,
            subscribed: subscriptionRows.length > 0,
            unlockedPostIds: new Set(unlockRows.map((unlock) => unlock.postId)),
          })
        ) {
          return null;
        }
      }
      await normalizeLegacyNoodlerToggleInteraction(tx, {
        postId,
        actorAccountId: currentActor.id,
        viewerPersonaId,
        type: "vote",
        parentInteractionId: null,
        actor: currentActor,
      });
      const existingVotes = await tx
        .select()
        .from(noodleInteractions)
        .where(
          and(
            eq(noodleInteractions.postId, postId),
            eq(noodleInteractions.actorAccountId, currentActor.id),
            eq(noodleInteractions.type, "vote"),
            isNull(noodleInteractions.parentInteractionId),
          ),
        );
      const existingVote = existingVotes[0];
      const voteId = existingVote?.id ?? newId();
      if (existingVotes.length > 1) {
        await tx.delete(noodleInteractions).where(
          inArray(
            noodleInteractions.id,
            existingVotes.slice(1).map((vote) => vote.id),
          ),
        );
      }
      if (existingVote) {
        await tx
          .update(noodleInteractions)
          .set({
            content: optionId,
            actorSnapshot: JSON.stringify(snapshotForAccount(currentActor)),
          })
          .where(eq(noodleInteractions.id, voteId));
      } else {
        await tx.insert(noodleInteractions).values({
          id: voteId,
          postId,
          parentInteractionId: null,
          actorAccountId: currentActor.id,
          type: "vote",
          content: optionId,
          imageUrl,
          actorSnapshot: JSON.stringify(snapshotForAccount(currentActor)),
          createdAt: now(),
        });
      }
      const updated = await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, voteId));
      return updated[0] ? mapInteraction(updated[0]) : null;
    });
  };

  /**
   * Deleting a comment must take its creator reply with it: the reply is unreadable once its
   * parent is gone, and the permanent claim row would keep consuming the rolling allowance
   * and block the comment slot forever.
   */
  const deleteInteractionChildren = async (
    tx: Parameters<Parameters<DB["transaction"]>[0]>[0],
    parentId: string,
  ): Promise<void> => {
    const parent = (await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, parentId)))[0];
    const rows = parent
      ? await tx.select().from(noodleInteractions).where(eq(noodleInteractions.postId, parent.postId))
      : [];
    // The whole descendant subtree goes, not just the direct children (same closure as
    // deleteInteractionById): a reply to a creator reply would otherwise survive its thread.
    const removed = new Set([parentId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const row of rows) {
        if (removed.has(row.id) || !row.parentInteractionId || !removed.has(row.parentInteractionId)) continue;
        removed.add(row.id);
        changed = true;
      }
    }
    const removedIds = [...removed];
    // Claims are keyed by either end of the pair, so a claim whose reply is going away must go
    // too or it keeps consuming the rolling allowance forever.
    await tx
      .delete(noodlerCreatorReplyClaims)
      .where(
        or(
          inArray(noodlerCreatorReplyClaims.parentInteractionId, removedIds),
          inArray(noodlerCreatorReplyClaims.replyInteractionId, removedIds),
        ),
      );
    const childIds = removedIds.filter((id) => id !== parentId);
    if (childIds.length === 0) return;
    await tx.delete(noodleActivityDigests).where(inArray(noodleActivityDigests.sourceInteractionId, childIds));
    await tx.delete(noodleInteractions).where(inArray(noodleInteractions.id, childIds));
  };

  const deleteStoredInteraction = async (
    postId: string,
    input: DeleteStoredInteractionCommand,
    digestDeletionPolicy: "protect-public-digests" | "delete-directly",
  ): Promise<NoodleInteraction | null> => {
    const parentInteractionId = input.parentInteractionId ?? null;
    const rows = await db
      .select()
      .from(noodleInteractions)
      .where(
        and(
          eq(noodleInteractions.postId, postId),
          eq(noodleInteractions.actorAccountId, input.actorAccountId),
          eq(noodleInteractions.type, input.type),
          parentInteractionId
            ? eq(noodleInteractions.parentInteractionId, parentInteractionId)
            : isNull(noodleInteractions.parentInteractionId),
        ),
      );
    const existing = rows[0];
    if (!existing) return null;

    if (digestDeletionPolicy === "delete-directly") {
      await db.transaction(async (tx) => {
        await deleteInteractionChildren(tx, existing.id);
        await tx.delete(noodleInteractions).where(eq(noodleInteractions.id, existing.id));
      });
      return mapInteraction(existing);
    }

    const relatedDigests = await db
      .select()
      .from(noodleActivityDigests)
      .where(eq(noodleActivityDigests.sourceInteractionId, existing.id));
    const slurpSourceAccountIds = new Set(
      (await db.select().from(noodleAccounts).where(eq(noodleAccounts.platform, "slurp"))).map((row) => row.id),
    );
    if (
      relatedDigests.some(
        (digest) => !parseStringArray(digest.accountIds).every((accountId) => slurpSourceAccountIds.has(accountId)),
      )
    ) {
      return null;
    }
    await db.transaction(async (tx) => {
      await deleteInteractionChildren(tx, existing.id);
      await tx.delete(noodleActivityDigests).where(eq(noodleActivityDigests.sourceInteractionId, existing.id));
      await tx.delete(noodleInteractions).where(eq(noodleInteractions.id, existing.id));
    });
    return mapInteraction(existing);
  };

  return {
    async resolveSource(sourceKind: SlurpSourceKind, sourceEntityId: string): Promise<NoodleAccount | null> {
      const source =
        sourceKind === "character"
          ? await characters.getById(sourceEntityId)
          : await characters.getPersona(sourceEntityId);
      return source
        ? sourceAccountFromEntity(sourceKind, sourceEntityId, source as unknown as Record<string, unknown>)
        : null;
    },

    async resolveSourceByEntityId(sourceEntityId: string): Promise<NoodleAccount | null> {
      const character = await characters.getById(sourceEntityId);
      const persona = await characters.getPersona(sourceEntityId);
      if (character && persona) return null;
      if (character) {
        return sourceAccountFromEntity("character", sourceEntityId, character as unknown as Record<string, unknown>);
      }
      return persona
        ? sourceAccountFromEntity("persona", sourceEntityId, persona as unknown as Record<string, unknown>)
        : null;
    },

    async listEligibleSources(): Promise<NoodleAccount[]> {
      const [characterRows, personaRows] = await Promise.all([characters.list(), characters.listPersonas()]);
      return [
        ...characterRows.map((row) =>
          sourceAccountFromEntity("character", row.id, row as unknown as Record<string, unknown>),
        ),
        ...personaRows.map((row) =>
          sourceAccountFromEntity("persona", row.id, row as unknown as Record<string, unknown>),
        ),
      ];
    },

    async resolveAccountSource(account: Pick<SlurpAccount, "sourceKind" | "sourceEntityId">) {
      return this.resolveSource(account.sourceKind, account.sourceEntityId);
    },

    async getViewer(personaId: string): Promise<NoodleAccount | null> {
      const persona = await characters.getPersona(personaId);
      if (!persona) return null;
      const raw = await settingsStore.get(slurpViewerSettingsKey(personaId));
      return mapViewer(personaId, raw ? normalizeNoodleAccountSettings(raw) : emptyNoodleAccountSettings(), persona);
    },

    async cleanupRetiredViewer(personaId: string): Promise<void> {
      const authored = await db
        .select()
        .from(noodleInteractions)
        .where(eq(noodleInteractions.actorAccountId, personaId));
      for (const interaction of authored) await this.deleteInteractionById(interaction.id);
      await db.transaction(async (tx) => {
        await tx.delete(noodleAccountSubscriptions).where(eq(noodleAccountSubscriptions.viewerAccountId, personaId));
        await tx.delete(noodlePostUnlocks).where(eq(noodlePostUnlocks.viewerAccountId, personaId));
        await createAppSettingsStorage(tx).remove(slurpViewerSettingsKey(personaId));
        await tx._fileStore.flush();
      });
    },

    async getSettings(): Promise<SlurpSettings> {
      const raw = await settingsStore.get(SLURP_SETTINGS_KEY);
      return normalizeSlurpSettings(raw);
    },

    async getSlurpSettings() {
      return this.getSettings();
    },

    async updateSlurpSettings(input: SlurpSettingsUpdateInput) {
      return this.updateSettings(input);
    },

    async deleteAllSlurpData(): Promise<{ deletedCreators: number; deletedPosts: number }> {
      const accounts = await db.select().from(noodleAccounts).where(eq(noodleAccounts.platform, "slurp"));
      const accountIds = accounts.map((account) => account.id);
      const personaIds = (await characters.listPersonas()).map((persona) => persona.id);
      const posts = accountIds.length
        ? await db.select().from(noodlePosts).where(inArray(noodlePosts.authorAccountId, accountIds))
        : [];
      const postIds = posts.map((post) => post.id);
      await db.transaction(async (tx) => {
        for (const table of [
          noodleActivityDigests,
          noodleRefreshRuns,
          noodlerFanActivityState,
          noodlerAutomaticAttempts,
          noodlerReserveState,
          noodlerPreparedPosts,
          noodlerCreatorReplyClaims,
        ]) {
          await tx.delete(table);
        }
        if (postIds.length) {
          await tx.delete(noodleInteractions).where(inArray(noodleInteractions.postId, postIds));
          await tx.delete(noodlePostUnlocks).where(inArray(noodlePostUnlocks.postId, postIds));
          await tx.delete(noodlePosts).where(inArray(noodlePosts.id, postIds));
        }
        if (accountIds.length) {
          await tx.delete(noodleInteractions).where(inArray(noodleInteractions.actorAccountId, accountIds));
          await tx
            .delete(noodleAccountSubscriptions)
            .where(
              or(
                inArray(noodleAccountSubscriptions.viewerAccountId, accountIds),
                inArray(noodleAccountSubscriptions.creatorAccountId, accountIds),
              ),
            );
          await tx.delete(noodleAccounts).where(inArray(noodleAccounts.id, accountIds));
        }
        const settings = createAppSettingsStorage(tx);
        for (const personaId of personaIds) await settings.remove(slurpViewerSettingsKey(personaId));
        await settings.remove(SLURP_SETTINGS_KEY);
        await settings.remove(NOODLE_REFRESH_SCHEDULE_KEY);
        await settings.remove(NOODLER_SOURCE_SNAPSHOT_MIGRATION_KEY);
        await tx._fileStore.flush();
      });
      return { deletedCreators: accounts.length, deletedPosts: posts.length };
    },

    async deleteUnusedSlurpData(): Promise<{
      deletedPreparedPosts: number;
      deletedAttempts: number;
      deletedRuns: number;
    }> {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      let deletedPreparedPosts = 0;
      let deletedAttempts = 0;
      let deletedRuns = 0;
      await db.transaction(async (tx) => {
        const currentPrepared = await tx.select().from(noodlerPreparedPosts);
        const currentAttempts = await tx.select().from(noodlerAutomaticAttempts);
        const currentRuns = await tx.select().from(noodleRefreshRuns);
        const preparedIds = currentPrepared
          .filter((row) => ["published", "discarded"].includes(row.state) && Date.parse(row.updatedAt) < cutoff)
          .map((row) => row.id);
        const attemptIds = currentAttempts.filter((row) => Date.parse(row.claimedAt) < cutoff).map((row) => row.id);
        const runIds = currentRuns
          .filter(
            (row) => ["completed", "failed", "abandoned"].includes(row.status) && Date.parse(row.updatedAt) < cutoff,
          )
          .map((row) => row.id);
        if (preparedIds.length) {
          await tx.delete(noodlerPreparedPosts).where(inArray(noodlerPreparedPosts.id, preparedIds));
          deletedPreparedPosts = preparedIds.length;
        }
        if (attemptIds.length) {
          await tx.delete(noodlerAutomaticAttempts).where(inArray(noodlerAutomaticAttempts.id, attemptIds));
          deletedAttempts = attemptIds.length;
        }
        if (runIds.length) {
          await tx.delete(noodleRefreshRuns).where(inArray(noodleRefreshRuns.id, runIds));
          deletedRuns = runIds.length;
        }
        await tx._fileStore.flush();
      });
      return {
        deletedPreparedPosts,
        deletedAttempts,
        deletedRuns,
      };
    },

    async updateSettings(input: SlurpSettingsUpdateInput): Promise<SlurpSettings> {
      const run = slurpSettingsUpdateQueue.then(async () => {
        const current = await this.getSettings();
        const next = normalizeSlurpSettings({ ...current, ...input });
        await settingsStore.set(SLURP_SETTINGS_KEY, JSON.stringify(next));
        if (!current.autoPostingScheduleEnabled && next.autoPostingScheduleEnabled) {
          const timestamp = now();
          const rows = await db.select().from(noodlerPreparedPosts);
          const expired = rows.filter(
            (row) => row.state === "prepared" && Date.parse(row.publishAt) <= Date.parse(timestamp),
          );
          if (expired.length > 0) {
            await db.transaction(async (tx) =>
              tx
                .update(noodlerPreparedPosts)
                .set({ state: "discarded", updatedAt: timestamp })
                .where(
                  inArray(
                    noodlerPreparedPosts.id,
                    expired.map((row) => row.id),
                  ),
                ),
            );
            for (const row of expired) {
              unlinkNoodlerMedia(String(parseRecord(parseRecord(row.payload).metadata).noodlerMediaPath ?? "") || null);
            }
          }
        }
        return next;
      });
      slurpSettingsUpdateQueue = run.catch(() => undefined);
      return run;
    },

    async getRefreshSchedule(): Promise<PersistedNoodleRefreshSchedule | null> {
      const raw = await settingsStore.get(NOODLE_REFRESH_SCHEDULE_KEY);
      if (!raw) return null;
      try {
        return parsePersistedNoodleRefreshSchedule(JSON.parse(raw));
      } catch {
        return null;
      }
    },

    async saveRefreshSchedule(schedule: PersistedNoodleRefreshSchedule): Promise<void> {
      await settingsStore.set(NOODLE_REFRESH_SCHEDULE_KEY, JSON.stringify(schedule));
    },

    async ensureRefreshSchedule(
      at = new Date(),
      settingsOverride?: SlurpSettings,
    ): Promise<PersistedNoodleRefreshSchedule> {
      const settings = settingsOverride ?? (await this.getSettings());
      const current = await this.getRefreshSchedule();
      const reconciled = reconcileNoodleRefreshSchedule(current, 0, at);
      if (!current || JSON.stringify(current) !== JSON.stringify(reconciled)) {
        await this.saveRefreshSchedule(reconciled);
      }
      return reconciled;
    },

    async listAccounts(): Promise<NoodleAccount[]> {
      await reconcilePublicHandles();
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(eq(noodleAccounts.platform, "slurp"))
        .orderBy(desc(noodleAccounts.updatedAt));
      return rows.map(mapAccount);
    },

    async getAccountById(id: string): Promise<NoodleAccount | null> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "slurp")));
      return rows[0] ? mapAccount(rows[0]) : null;
    },

    /**
     * Delete the noodle account for a deleted entity (e.g. a character) along with its
     * posts/interactions/subscriptions. Dependent rows go via the file-store cascade;
     * activity digests have no cascade, so they are cleared explicitly.
     */
    async deleteAccountByEntity(kind: NoodleAccountKind, entityId: string): Promise<NoodleAccount | null> {
      const existing = await this.getSlurpAccountForEntity(kind, entityId);
      if (!existing) return null;
      const postIds = (await db.select().from(noodlePosts).where(eq(noodlePosts.authorAccountId, existing.id))).map(
        (post) => post.id,
      );
      // Interactions on the account's own posts die with the posts via cascade, but the
      // account's interactions on *other* posts have no cascade — delete those explicitly.
      const ownInteractionIds =
        postIds.length > 0
          ? (await db.select().from(noodleInteractions).where(inArray(noodleInteractions.postId, postIds))).map(
              (interaction) => interaction.id,
            )
          : [];
      const authoredRows = await db
        .select()
        .from(noodleInteractions)
        .where(eq(noodleInteractions.actorAccountId, existing.id));
      // Replies to an authored interaction would keep a dangling parentInteractionId, so
      // take the whole descendant subtree (same closure as deleteInteractionById).
      const authoredPostIds = Array.from(new Set(authoredRows.map((row) => row.postId)));
      const siblingRows =
        authoredPostIds.length > 0
          ? await db.select().from(noodleInteractions).where(inArray(noodleInteractions.postId, authoredPostIds))
          : [];
      const doomed = new Set(authoredRows.map((row) => row.id));
      let changed = true;
      while (changed) {
        changed = false;
        for (const row of siblingRows) {
          if (doomed.has(row.id) || !row.parentInteractionId || !doomed.has(row.parentInteractionId)) continue;
          doomed.add(row.id);
          changed = true;
        }
      }
      const authoredInteractionIds = [...doomed];
      const interactionIds = Array.from(new Set([...ownInteractionIds, ...authoredInteractionIds]));
      await db.transaction(async (tx) => {
        if (postIds.length > 0) {
          await tx.delete(noodleActivityDigests).where(inArray(noodleActivityDigests.sourcePostId, postIds));
        }
        if (interactionIds.length > 0) {
          await tx
            .delete(noodleActivityDigests)
            .where(inArray(noodleActivityDigests.sourceInteractionId, interactionIds));
        }
        if (authoredInteractionIds.length > 0) {
          await tx.delete(noodleInteractions).where(inArray(noodleInteractions.id, authoredInteractionIds));
        }
        await tx
          .delete(noodlePostUnlocks)
          .where(
            or(
              eq(noodlePostUnlocks.viewerAccountId, existing.id),
              postIds.length > 0
                ? inArray(noodlePostUnlocks.postId, postIds)
                : eq(noodlePostUnlocks.postId, "__none__"),
            ),
          );
        await tx
          .delete(noodleAccountSubscriptions)
          .where(
            or(
              eq(noodleAccountSubscriptions.viewerAccountId, existing.id),
              eq(noodleAccountSubscriptions.creatorAccountId, existing.id),
            ),
          );
        await tx
          .delete(noodlerCreatorReplyClaims)
          .where(
            or(
              eq(noodlerCreatorReplyClaims.creatorAccountId, existing.id),
              postIds.length > 0
                ? inArray(noodlerCreatorReplyClaims.postId, postIds)
                : eq(noodlerCreatorReplyClaims.postId, "__none__"),
            ),
          );
        await tx.delete(noodlerPreparedPosts).where(eq(noodlerPreparedPosts.creatorAccountId, existing.id));
        await tx.delete(noodlePosts).where(inArray(noodlePosts.id, postIds));
        await tx.delete(noodleAccounts).where(eq(noodleAccounts.id, existing.id));
        await tx._fileStore.flush();
      });
      return existing;
    },

    async getSlurpAccountForEntity(kind: NoodleAccountKind, entityId: string): Promise<SlurpAccount | null> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(
          and(
            eq(noodleAccounts.kind, kind),
            eq(noodleAccounts.entityId, entityId),
            eq(noodleAccounts.platform, "slurp"),
          ),
        );
      return rows[0] ? mapAccount(rows[0]) : null;
    },

    async getAccountsByEntities(kind: NoodleAccountKind, entityIds: string[]): Promise<SlurpAccount[]> {
      if (entityIds.length === 0) return [];
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(
          and(
            eq(noodleAccounts.kind, kind),
            inArray(noodleAccounts.entityId, entityIds),
            eq(noodleAccounts.platform, "slurp"),
          ),
        );
      return rows.map(mapAccount);
    },

    async listNoodlerAccounts(): Promise<SlurpAccount[]> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(eq(noodleAccounts.platform, "slurp"))
        .orderBy(desc(noodleAccounts.updatedAt));
      return rows.map(mapAccount);
    },

    async getNoodlerAccountById(id: string): Promise<SlurpAccount | null> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "slurp")));
      return rows[0] ? mapAccount(rows[0]) : null;
    },

    async getNoodlerAccountForSource(
      sourceKind: SlurpSourceKind,
      sourceEntityId: string,
    ): Promise<SlurpAccount | null> {
      const rows = await db
        .select()
        .from(noodleAccounts)
        .where(
          and(
            eq(noodleAccounts.platform, "slurp"),
            eq(noodleAccounts.sourceKind, sourceKind),
            eq(noodleAccounts.sourceEntityId, sourceEntityId),
          ),
        );
      return rows[0] ? mapAccount(rows[0]) : null;
    },

    async patchViewerSettings(
      personaId: string,
      input: NoodleAccountSettingsPatchInput,
    ): Promise<NoodleAccount | null> {
      const run = viewerSettingsUpdateQueue.then(async () => {
        if (input.subtree !== "social") return null;
        const viewer = await this.getViewer(personaId);
        if (!viewer) return null;
        const social = { ...viewer.settings.social, ...input.patch };
        for (const field of ["noodleFeedSeenAt", "noodlerFeedSeenAt"] as const) {
          const stored = viewer.settings.social[field];
          if (stored && social[field] && !(Date.parse(social[field]) > (Date.parse(stored) || 0)))
            social[field] = stored;
        }
        await settingsStore.set(slurpViewerSettingsKey(personaId), JSON.stringify({ ...viewer.settings, social }));
        return this.getViewer(personaId);
      });
      viewerSettingsUpdateQueue = run.catch(() => undefined);
      return run;
    },

    async updateViewerFollow(
      personaId: string,
      targetAccountId: string,
      followed: boolean,
      followedAt = now(),
    ): Promise<{ account: NoodleAccount; changed: boolean } | null> {
      const run = viewerSettingsUpdateQueue.then(async () => {
        const viewer = await this.getViewer(personaId);
        if (!viewer) return null;
        const followingAccountIds = viewer.settings.social.followingAccountIds ?? [];
        const isFollowing = followingAccountIds.includes(targetAccountId);
        const followingAccountTimestamps = { ...viewer.settings.social.followingAccountTimestamps };
        if (isFollowing === followed && (!followed || followingAccountTimestamps[targetAccountId]))
          return { account: viewer, changed: false };
        if (followed) followingAccountTimestamps[targetAccountId] = followedAt;
        else delete followingAccountTimestamps[targetAccountId];
        const next: NoodleAccountSettings = {
          ...viewer.settings,
          social: {
            ...viewer.settings.social,
            followingAccountIds: followed
              ? [...followingAccountIds, targetAccountId]
              : followingAccountIds.filter((accountId) => accountId !== targetAccountId),
            followingAccountTimestamps,
          },
        };
        await settingsStore.set(slurpViewerSettingsKey(personaId), JSON.stringify(next));
        return { account: (await this.getViewer(personaId))!, changed: true };
      });
      viewerSettingsUpdateQueue = run.catch(() => undefined);
      return run;
    },

    async deleteNoodlerAccount(id: string): Promise<NoodleAccount | null> {
      const existing = await this.getNoodlerAccountById(id);
      if (!existing) return null;
      const postRows = await db.select().from(noodlePosts).where(eq(noodlePosts.authorAccountId, id));
      const postIds = postRows.map((post) => post.id);
      const interactionRows =
        postIds.length > 0
          ? await db.select().from(noodleInteractions).where(inArray(noodleInteractions.postId, postIds))
          : [];
      const interactionIds = interactionRows.map((interaction) => interaction.id);
      await db.transaction(async (tx) => {
        if (postIds.length > 0) {
          await tx.delete(noodleActivityDigests).where(inArray(noodleActivityDigests.sourcePostId, postIds));
        }
        if (interactionIds.length > 0) {
          await tx
            .delete(noodleActivityDigests)
            .where(inArray(noodleActivityDigests.sourceInteractionId, interactionIds));
        }
        await tx
          .delete(noodlePostUnlocks)
          .where(
            or(
              eq(noodlePostUnlocks.viewerAccountId, id),
              postIds.length > 0
                ? inArray(noodlePostUnlocks.postId, postIds)
                : eq(noodlePostUnlocks.postId, "__none__"),
            ),
          );
        await tx
          .delete(noodleAccountSubscriptions)
          .where(
            or(eq(noodleAccountSubscriptions.viewerAccountId, id), eq(noodleAccountSubscriptions.creatorAccountId, id)),
          );
        await tx
          .delete(noodlerCreatorReplyClaims)
          .where(
            or(
              eq(noodlerCreatorReplyClaims.creatorAccountId, id),
              postIds.length > 0
                ? inArray(noodlerCreatorReplyClaims.postId, postIds)
                : eq(noodlerCreatorReplyClaims.postId, "__none__"),
            ),
          );
        await tx.delete(noodlerPreparedPosts).where(eq(noodlerPreparedPosts.creatorAccountId, id));
        await tx
          .delete(noodleInteractions)
          .where(
            or(
              eq(noodleInteractions.actorAccountId, id),
              postIds.length > 0
                ? inArray(noodleInteractions.postId, postIds)
                : eq(noodleInteractions.postId, "__none__"),
            ),
          );
        await tx.delete(noodleAccounts).where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "slurp")));
        await tx._fileStore.flush();
      });
      return existing;
    },

    async listNoodlerStageProfiles(): Promise<NoodlerManagedStageProfile[]> {
      const accounts = await this.listNoodlerAccounts();
      return Promise.all(
        accounts.map(async (account) => {
          const disclosureMode = account.settings.privacy.identityDisclosure ?? null;
          const publicAccount = await this.resolveAccountSource(account);
          const currentSource = publicAccount ? await resolveNoodlerSourceSnapshot(db, publicAccount) : null;
          const baseline = account.settings.profile.noodlerSourceSnapshot;
          return {
            id: account.id,
            sourceAccountId: account.sourceEntityId,
            handle: account.handle,
            displayName: account.displayName,
            bio: account.bio,
            avatarUrl: account.avatarUrl,
            avatarCrop: account.avatarCrop,
            bannerUrl: account.settings.profile.bannerUrl ?? null,
            disclosureMode,
            stagePersonality: account.settings.privacy.stagePersonality ?? "",
            access: account.settings.privacy.access,
            autoPosting:
              currentSource && !(account.kind === "persona" && account.sourceKind === "persona")
                ? (account.settings.scheduler.autoPosting ?? defaultAutoPostingSettings())
                : { ...(account.settings.scheduler.autoPosting ?? defaultAutoPostingSettings()), enabled: false },
            fanActivity: account.settings.scheduler.fanActivity ?? null,
            sourceStatus: !currentSource
              ? { state: "missing" as const }
              : compareMinimizedNoodlerSourceSnapshot(
                  baseline ?? minimizeNoodlerSourceSnapshot(currentSource, disclosureMode ?? "secret"),
                  currentSource,
                  disclosureMode ?? "secret",
                ),
            publicIdentity:
              publicAccount && (disclosureMode === "open" || disclosureMode === "hinted")
                ? { displayName: publicAccount.displayName, handle: publicAccount.handle }
                : null,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
          };
        }),
      );
    },

    /** One-time compatibility write; normal profile reads never change source-review state. */
    async migrateLegacyNoodlerSourceSnapshots(): Promise<number> {
      if ((await settingsStore.get(NOODLER_SOURCE_SNAPSHOT_MIGRATION_KEY)) === "1") return 0;
      const accounts = await this.listNoodlerAccounts();
      let migrated = 0;
      for (const account of accounts) {
        const disclosureMode = account.settings.privacy.identityDisclosure ?? "secret";
        const baseline = account.settings.profile.noodlerSourceSnapshot;
        const publicAccount = await this.resolveAccountSource(account);
        const currentSource = publicAccount ? await resolveNoodlerSourceSnapshot(db, publicAccount) : null;
        const next = !baseline
          ? currentSource
            ? minimizeNoodlerSourceSnapshot(currentSource, disclosureMode)
            : null
          : (disclosureMode === "hinted" || disclosureMode === "secret") && !isMinimizedNoodlerSourceSnapshot(baseline)
            ? minimizeNoodlerSourceSnapshot(baseline, disclosureMode)
            : null;
        if (!next) continue;
        await this.updateNoodlerSourceSnapshot(account.id, next);
        migrated += 1;
      }
      await settingsStore.set(NOODLER_SOURCE_SNAPSHOT_MIGRATION_KEY, "1");
      return migrated;
    },

    async createNoodlerAccount(
      sourceKind: SlurpSourceKind,
      sourceEntityId: string,
      stageProfile: NoodleStageProfileInput,
      wizardExecutionId?: string,
      sourceSnapshot?: NoodlerSourceSnapshot,
      avatarUrl?: string | null,
      bannerUrl?: string | null,
    ): Promise<NoodleAccount | null> {
      const publicAccount = await this.resolveSource(sourceKind, sourceEntityId);
      if (!publicAccount) return null;
      const timestamp = now();
      const id = newId();
      const base = emptyNoodleAccountSettings();
      const accountSettings: NoodleAccountSettings = {
        ...base,
        profile: {
          ...(wizardExecutionId && { noodlerWizardExecutionId: wizardExecutionId }),
          ...(sourceSnapshot && { noodlerSourceSnapshot: sourceSnapshot }),
          // Only an OPEN creator may hold the literal source banner (see
          // resolveNoodlerCreatorArtwork); callers already gate the value on that, this is
          // belt-and-suspenders against a future caller passing one for hinted/secret.
          ...(stageProfile.disclosureMode === "open" && bannerUrl ? { bannerUrl } : {}),
        },
        scheduler: { autoPosting: defaultAutoPostingSettings() },
        privacy: {
          identityDisclosure: stageProfile.disclosureMode,
          stagePersonality: stageProfile.stagePersonality,
          access: { hiddenFromAccountIds: [] },
        },
      };
      await db.insert(noodleAccounts).values({
        id,
        kind: publicAccount.kind,
        entityId: publicAccount.entityId,
        handle: normalizeHandle(stageProfile.handle, publicAccount.entityId),
        displayName: stageProfile.displayName,
        bio: stageProfile.bio,
        avatarUrl: stageProfile.disclosureMode === "open" ? (avatarUrl ?? null) : null,
        invited: "false",
        settings: JSON.stringify(accountSettings),
        platform: "slurp",
        sourceKind,
        sourceEntityId,
        slurpSourceAccountId: null,
        // Keep source identity mirrors for persisted Slurp rows.
        visibility: "private",
        publicAccountId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getNoodlerAccountById(id);
    },

    async updateNoodlerStageProfile(
      id: string,
      stageProfile: NoodleStageProfileInput,
      sourceSnapshot?: NoodlerSourceSnapshot,
    ): Promise<NoodleAccount | null> {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "slurp")));
        const row = rows[0];
        if (!row) return null;
        const settings = normalizeNoodleAccountSettings(row.settings);
        // Only OPEN may hold the literal source photo (see resolveNoodlerCreatorArtwork). A
        // downgrade away from open drops an inherited avatar/banner outright, the same way a
        // hinted or secret creator never gets one at creation. A NoodleR-owned generated image
        // (readNoodler*MediaPath resolves it) survives the downgrade — it was never the source's
        // literal photo, so it carries no identity to strip.
        const droppingOpen = stageProfile.disclosureMode !== "open";
        const profile = { ...settings.profile };
        if (droppingOpen && !readNoodlerAccountMediaPath(id, profile.bannerUrl ?? null)) {
          delete profile.bannerUrl;
        }
        await tx
          .update(noodleAccounts)
          .set({
            handle: normalizeHandle(stageProfile.handle, row.entityId),
            displayName: stageProfile.displayName,
            bio: stageProfile.bio,
            ...(droppingOpen && !readNoodlerAvatarMediaPath(id, row.avatarUrl) ? { avatarUrl: null } : {}),
            settings: JSON.stringify({
              ...settings,
              profile: {
                ...profile,
                ...(sourceSnapshot && { noodlerSourceSnapshot: sourceSnapshot }),
              },
              privacy: {
                ...settings.privacy,
                identityDisclosure: stageProfile.disclosureMode,
                stagePersonality: stageProfile.stagePersonality,
              },
            } satisfies NoodleAccountSettings),
            updatedAt: now(),
          })
          .where(eq(noodleAccounts.id, id));
        const updatedRows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id));
        return updatedRows[0] ? mapAccount(updatedRows[0]) : null;
      });
    },

    async updateNoodlerAvatar(id: string, avatarUrl: string | null): Promise<NoodleAccount | null> {
      await db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "slurp")));
        const row = rows[0];
        if (!row) return;
        const settings = normalizeNoodleAccountSettings(row.settings);
        await tx
          .update(noodleAccounts)
          .set({
            avatarUrl,
            settings: JSON.stringify({
              ...settings,
              profile: { ...settings.profile, avatarCrop: null },
            } satisfies NoodleAccountSettings),
            updatedAt: now(),
          })
          .where(eq(noodleAccounts.id, id));
      });
      return this.getNoodlerAccountById(id);
    },

    /** Creator banner lives in settings.profile, which patchAccountSettings keeps closed for noodler rows. */
    async updateNoodlerBanner(id: string, bannerUrl: string | null): Promise<NoodleAccount | null> {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id)))[0];
        if (!row || row.platform !== "slurp") return null;
        const settings = normalizeNoodleAccountSettings(row.settings);
        const profile = { ...settings.profile };
        if (bannerUrl) profile.bannerUrl = bannerUrl;
        else delete profile.bannerUrl;
        await tx
          .update(noodleAccounts)
          .set({
            settings: JSON.stringify({ ...settings, profile } satisfies NoodleAccountSettings),
            updatedAt: now(),
          })
          .where(eq(noodleAccounts.id, id));
        return this.getNoodlerAccountById(id);
      });
    },

    async updateNoodlerSourceSnapshot(
      id: string,
      sourceSnapshot: NoodlerSourceSnapshot,
    ): Promise<NoodleAccount | null> {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id)))[0];
        if (!row || row.platform !== "slurp") return null;
        const settings = normalizeNoodleAccountSettings(row.settings);
        await tx
          .update(noodleAccounts)
          .set({
            settings: JSON.stringify({
              ...settings,
              profile: { ...settings.profile, noodlerSourceSnapshot: sourceSnapshot },
            } satisfies NoodleAccountSettings),
            updatedAt: now(),
          })
          .where(eq(noodleAccounts.id, id));
        const updated = (await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id)))[0];
        return updated ? mapAccount(updated) : null;
      });
    },

    async adoptNoodlerPublicIdentity(id: string, currentSource: NoodlerSourceSnapshot): Promise<NoodleAccount | null> {
      return db.transaction(async (tx) => {
        const row = (await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id)))[0];
        if (!row || row.platform !== "slurp") return null;
        const settings = normalizeNoodleAccountSettings(row.settings);
        if (settings.privacy.identityDisclosure !== "open") return null;
        const baseline = settings.profile.noodlerSourceSnapshot ?? currentSource;
        await tx
          .update(noodleAccounts)
          .set({
            displayName: currentSource.publicDisplayName,
            handle: normalizeHandle(currentSource.publicHandle, row.entityId),
            settings: JSON.stringify({
              ...settings,
              profile: {
                ...settings.profile,
                noodlerSourceSnapshot: {
                  ...baseline,
                  publicDisplayName: currentSource.publicDisplayName,
                  publicHandle: currentSource.publicHandle,
                },
              },
            } satisfies NoodleAccountSettings),
            updatedAt: now(),
          })
          .where(eq(noodleAccounts.id, id));
        const updated = (await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id)))[0];
        return updated ? mapAccount(updated) : null;
      });
    },

    async upsertAccountFromProfile(input: {
      kind: NoodleAccountKind;
      entityId: string;
      displayName: string;
      avatarUrl?: string | null;
      avatarCrop?: AvatarCrop | null;
      bio?: string | null;
      invited?: boolean;
      /** Keep entity-owned identity fields current without replacing generated profile copy. */
      syncIdentity?: boolean;
    }): Promise<NoodleAccount> {
      await reconcilePublicHandles();
      const existing = await this.getSlurpAccountForEntity(input.kind, input.entityId);
      if (existing) {
        return db.transaction(async (tx) => {
          const rows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, existing.id));
          const row = rows[0];
          if (!row) return existing;
          const settings = normalizeNoodleAccountSettings(row.settings);
          const profileManuallyEdited = settings.profile.profileManuallyEdited === true;
          const updates: Record<string, unknown> = { updatedAt: now() };
          if (input.syncIdentity && !profileManuallyEdited) {
            updates.displayName = input.displayName.trim().slice(0, 120) || row.handle;
            if (input.avatarUrl !== undefined) updates.avatarUrl = input.avatarUrl;
          } else if (!String(row.displayName ?? "").trim()) {
            updates.displayName = input.displayName || row.handle;
          }
          if (!profileManuallyEdited && !String(row.bio ?? "").trim() && input.bio) updates.bio = input.bio;
          if (!input.syncIdentity && !row.avatarUrl && input.avatarUrl) updates.avatarUrl = input.avatarUrl;
          if (input.invited !== undefined) updates.invited = String(input.invited);
          if (input.avatarCrop !== undefined && !profileManuallyEdited) {
            updates.settings = JSON.stringify({
              ...settings,
              profile: { ...settings.profile, avatarCrop: input.avatarCrop },
            });
          }
          await tx.update(noodleAccounts).set(updates).where(eq(noodleAccounts.id, existing.id));
          const updatedRows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, existing.id));
          return updatedRows[0] ? mapAccount(updatedRows[0]) : existing;
        });
      }

      const id = await db.transaction(async (tx) => {
        const timestamp = now();
        const accountId = newId();
        const displayName = input.displayName.trim() || (input.kind === "persona" ? "User" : "Character");
        const publicRows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.platform, "slurp"));
        const reserved = new Set(publicRows.map((row) => normalizeHandle(row.handle, row.entityId)));
        const handle = nextAvailablePublicHandle(normalizeHandle(displayName, input.entityId), reserved);
        await tx.insert(noodleAccounts).values({
          id: accountId,
          kind: input.kind,
          entityId: input.entityId,
          handle,
          displayName,
          bio: input.bio?.trim() ?? "",
          avatarUrl: input.avatarUrl ?? null,
          invited: String(input.invited ?? input.kind === "persona"),
          settings: JSON.stringify({
            ...emptyNoodleAccountSettings(),
            profile: input.avatarCrop !== undefined ? { avatarCrop: input.avatarCrop } : {},
          }),
          platform: "slurp",
          sourceKind: input.kind === "random_user" ? null : input.kind,
          sourceEntityId: input.kind === "random_user" ? null : input.entityId,
          slurpSourceAccountId: null,
          // Keep source identity mirrors for persisted Slurp rows.
          visibility: "public",
          publicAccountId: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        return accountId;
      });
      return (await this.getAccountById(id))!;
    },

    async updateAccount(id: string, input: NoodleAccountUpdateInput): Promise<NoodleAccount | null> {
      await reconcilePublicHandles();
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "slurp")));
        const row = rows[0];
        if (!row) return null;
        await tx
          .update(noodleAccounts)
          .set({
            ...(input.handle !== undefined && { handle: normalizeHandle(input.handle, row.entityId) }),
            ...(input.displayName !== undefined && { displayName: input.displayName.trim().slice(0, 120) }),
            ...(input.bio !== undefined && { bio: input.bio.slice(0, 500) }),
            ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
            ...(input.invited !== undefined && { invited: String(input.invited) }),
            updatedAt: now(),
          })
          .where(eq(noodleAccounts.id, id));
        const updatedRows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id));
        return updatedRows[0] ? mapAccount(updatedRows[0]) : null;
      });
    },

    async updateAccountProfile(id: string, input: NoodleAccountProfileUpdateInput): Promise<NoodleAccount | null> {
      await reconcilePublicHandles();
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "slurp")));
        const row = rows[0];
        if (!row) return null;
        const settings = normalizeNoodleAccountSettings(row.settings);
        const nextSettings: NoodleAccountSettings = {
          ...settings,
          profile: { ...settings.profile, ...input.profile },
        };
        await tx
          .update(noodleAccounts)
          .set({
            ...(input.handle !== undefined && { handle: normalizeHandle(input.handle, row.entityId) }),
            ...(input.displayName !== undefined && { displayName: input.displayName.trim().slice(0, 120) }),
            ...(input.bio !== undefined && { bio: input.bio.slice(0, 500) }),
            ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
            settings: JSON.stringify(nextSettings),
            updatedAt: now(),
          })
          .where(eq(noodleAccounts.id, id));
        const updatedRows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id));
        return updatedRows[0] ? mapAccount(updatedRows[0]) : null;
      });
    },

    async patchAccountSettings(id: string, input: NoodleAccountSettingsPatchInput): Promise<NoodleAccount | null> {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id));
        const row = rows[0];
        if (!row) return null;
        if (row.platform !== "slurp") return null;
        if (input.subtree !== "privacy" && input.subtree !== "scheduler" && input.subtree !== "social") return null;
        if (
          row.platform === "slurp" &&
          input.subtree === "privacy" &&
          (input.patch.identityDisclosure !== undefined || input.patch.stagePersonality !== undefined)
        ) {
          return null;
        }
        const current = normalizeNoodleAccountSettings(row.settings);
        let next: NoodleAccountSettings;
        if (input.subtree === "social") {
          // Feed-visit timestamps only ever move forward. Two visits can be in flight at once
          // (both surfaces record on mount), and the later request is not always the later
          // timestamp — an out-of-order write would resurrect an already-cleared counter.
          const social = { ...current.social, ...input.patch };
          for (const field of ["noodleFeedSeenAt", "noodlerFeedSeenAt"] as const) {
            const stored = current.social[field];
            if (stored && social[field] && !(Date.parse(social[field]) > (Date.parse(stored) || 0))) {
              social[field] = stored;
            }
          }
          next = { ...current, social };
        } else if (input.subtree === "scheduler") {
          if (row.sourceKind === "persona" && row.kind === "persona" && input.patch.autoPosting?.enabled === true) {
            return null;
          }
          const currentAuto = current.scheduler.autoPosting ?? defaultAutoPostingSettings();
          const patchAuto = input.patch.autoPosting;
          const patchFan = input.patch.fanActivity;
          const config = patchAuto
            ? {
                enabled: patchAuto.enabled ?? currentAuto.enabled,
                imagesEnabled: patchAuto.imagesEnabled ?? currentAuto.imagesEnabled,
              }
            : currentAuto;
          next = {
            ...current,
            scheduler: {
              ...current.scheduler,
              autoPosting: config,
              ...(patchFan === null
                ? { fanActivity: undefined }
                : patchFan
                  ? {
                      fanActivity: {
                        ...current.scheduler.fanActivity,
                        ...patchFan,
                        ...(patchFan.archetypeWeights && { archetypeWeights: patchFan.archetypeWeights }),
                      },
                    }
                  : {}),
            },
          };
        } else {
          const access = { ...current.privacy.access, ...input.patch.access };
          next = {
            ...current,
            privacy: {
              ...current.privacy,
              ...input.patch,
              access: {
                ...access,
                hiddenFromAccountIds: withoutNoodlerSelfHiddenAccountId(
                  access.hiddenFromAccountIds,
                  row.sourceEntityId ?? row.entityId,
                ),
              },
            },
          };
        }
        await tx
          .update(noodleAccounts)
          .set({ settings: JSON.stringify(next), updatedAt: now() })
          .where(eq(noodleAccounts.id, id));
        const updatedRows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id));
        return updatedRows[0] ? mapAccount(updatedRows[0]) : null;
      });
    },

    /** Every NoodleR creator account with automatic posting enabled, settings attached. */
    async listAutoPostEnabledAccounts(): Promise<NoodleAccount[]> {
      const rows = await db.select().from(noodleAccounts).where(eq(noodleAccounts.platform, "slurp"));
      const enabled = rows
        .map(mapAccount)
        .filter((account) => account.settings.scheduler.autoPosting?.enabled === true);
      const checked = await Promise.all(
        enabled.map(async (account) => {
          if (account.sourceKind === "persona" && account.kind === "persona") {
            await this.patchAccountSettings(account.id, {
              subtree: "scheduler",
              patch: { autoPosting: { enabled: false } },
            });
            return null;
          }
          const publicAccount = await this.resolveAccountSource(account);
          if (publicAccount && (await resolveNoodlerSourceSnapshot(db, publicAccount))) return account;
          await this.patchAccountSettings(account.id, {
            subtree: "scheduler",
            patch: { autoPosting: { enabled: false } },
          });
          return null;
        }),
      );
      return checked.filter((account): account is NoodleAccount => account !== null);
    },

    /**
     * Latest real posting activity per creator: the newest published post or prepared slot.
     * Account `updatedAt` moves on profile edits, which is not activity, so scheduling order
     * must come from this instead.
     */
    async getNoodlerCreatorActivityTimes(): Promise<Map<string, string>> {
      const [posts, prepared] = await Promise.all([
        db.select().from(noodlePosts),
        db.select().from(noodlerPreparedPosts),
      ]);
      const latest = new Map<string, string>();
      const observe = (accountId: string, at: string) => {
        const current = latest.get(accountId);
        if (!current || at > current) latest.set(accountId, at);
      };
      for (const post of posts) observe(post.authorAccountId, post.createdAt);
      for (const item of prepared) {
        if (item.state !== "discarded") observe(item.creatorAccountId, item.publishAt);
      }
      return latest;
    },

    async ensureNoodlerReserveState(at = new Date()): Promise<{
      lastObservedBudgetTime: string;
      preparationNotBefore: string;
    }> {
      return db.transaction(async (tx) => {
        const existing = (
          await tx.select().from(noodlerReserveState).where(eq(noodlerReserveState.id, NOODLER_RESERVE_STATE_ID))
        )[0];
        // Imported or hand-edited state can carry timestamps that do not parse. NaN would
        // propagate into every budget and hold comparison, so an unreadable value resets to now.
        const parsed = existing ? Date.parse(existing.lastObservedBudgetTime) : 0;
        const observedMs = Math.max(at.getTime(), Number.isNaN(parsed) ? 0 : parsed);
        if (existing) {
          const observed = new Date(observedMs).toISOString();
          const storedPreparationMs = Date.parse(existing.preparationNotBefore);
          // Repair the startup hold written by the first reserve-state version. It blocked the
          // first scheduled post for a full day after the package started.
          const preparationNotBefore =
            Number.isNaN(storedPreparationMs) || storedPreparationMs > observedMs
              ? observed
              : existing.preparationNotBefore;
          if (observed !== existing.lastObservedBudgetTime || preparationNotBefore !== existing.preparationNotBefore) {
            await tx
              .update(noodlerReserveState)
              .set({ lastObservedBudgetTime: observed, preparationNotBefore, updatedAt: at.toISOString() })
              .where(eq(noodlerReserveState.id, NOODLER_RESERVE_STATE_ID));
          }
          return { lastObservedBudgetTime: observed, preparationNotBefore };
        }
        const timestamp = at.toISOString();
        await tx.insert(noodlerReserveState).values({
          id: NOODLER_RESERVE_STATE_ID,
          lastObservedBudgetTime: timestamp,
          preparationNotBefore: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        return { lastObservedBudgetTime: timestamp, preparationNotBefore: timestamp };
      });
    },

    async claimNoodlerAutomaticAttempt(
      kind: "text" | "image",
      limit: number,
      at = new Date(),
    ): Promise<{ status: "claimed"; claimId: string; claimedAt: string } | { status: "exhausted" | "holding" }> {
      return db.transaction(async (tx) => {
        let state = (
          await tx.select().from(noodlerReserveState).where(eq(noodlerReserveState.id, NOODLER_RESERVE_STATE_ID))
        )[0];
        if (!state) {
          const timestamp = at.toISOString();
          await tx.insert(noodlerReserveState).values({
            id: NOODLER_RESERVE_STATE_ID,
            lastObservedBudgetTime: timestamp,
            preparationNotBefore: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
          return { status: "holding" };
        }
        // Same NaN handling as ensureNoodlerReserveState: an unreadable stored timestamp resets
        // to now instead of poisoning the comparison (and toISOString) with NaN.
        const observed = Date.parse(state.lastObservedBudgetTime);
        const effectiveMs = Math.max(at.getTime(), Number.isNaN(observed) ? 0 : observed);
        const effectiveIso = new Date(effectiveMs).toISOString();
        if (effectiveIso !== state.lastObservedBudgetTime) {
          await tx
            .update(noodlerReserveState)
            .set({ lastObservedBudgetTime: effectiveIso, updatedAt: at.toISOString() })
            .where(eq(noodlerReserveState.id, NOODLER_RESERVE_STATE_ID));
          state = { ...state, lastObservedBudgetTime: effectiveIso };
        }
        const notBefore = Date.parse(state.preparationNotBefore);
        // An unparseable hold must not read as "hold expired"; hold until it is repaired.
        if (Number.isNaN(notBefore) || effectiveMs < notBefore) return { status: "holding" };
        const cutoff = effectiveMs - ROLLING_DAY_MS;
        // Prune claims that have left the rolling window, in the same transaction that
        // counts them: they can never affect the budget again, and the ledger is scanned
        // on every claim.
        const cutoffIso = new Date(cutoff).toISOString();
        await tx.delete(noodlerAutomaticAttempts).where(lt(noodlerAutomaticAttempts.claimedAt, cutoffIso));
        const attempts = (await tx.select().from(noodlerAutomaticAttempts)).filter(
          // A failed attempt (provider error, moderation reject, timeout) never produced a
          // post, so it must not permanently burn a slot out of the rolling-day budget: image
          // generation fails far more often than text, and without this a handful of image
          // failures locks out image posting for the rest of the day while text keeps going.
          (row) => row.kind === kind && row.outcome !== "failed" && Date.parse(row.claimedAt) > cutoff,
        );
        if (attempts.length >= limit) return { status: "exhausted" };
        const claimId = newId();
        await tx.insert(noodlerAutomaticAttempts).values({
          id: claimId,
          kind,
          claimedAt: effectiveIso,
          outcome: "claimed",
        });
        return { status: "claimed", claimId, claimedAt: effectiveIso };
      });
    },

    async completeNoodlerAutomaticAttempt(claimId: string, outcome: "completed" | "failed"): Promise<void> {
      await db.update(noodlerAutomaticAttempts).set({ outcome }).where(eq(noodlerAutomaticAttempts.id, claimId));
    },

    async createNoodlerPreparedPost(input: {
      creatorAccountId: string;
      generatedAt: string;
      publishAt: string;
      payload: NoodlerPreparedPostPayload;
      policyFingerprint: string;
    }): Promise<string> {
      const id = newId();
      // In a transaction so the row lands durably on commit (slurp_prepared_posts is a
      // durable-on-commit table): a direct insert rides the batched flush, and a crash inside
      // that window loses the row while its promoted media file stays on disk.
      await db.transaction(async (tx) =>
        tx.insert(noodlerPreparedPosts).values({
          id,
          creatorAccountId: input.creatorAccountId,
          generatedAt: input.generatedAt,
          publishAt: input.publishAt,
          payload: JSON.stringify(input.payload),
          policyFingerprint: input.policyFingerprint,
          state: "prepared",
          publishedPostId: null,
          imageState: input.payload.metadata.noodlerMediaPath ? "attached" : "none",
          imageClaimToken: null,
          imageClaimLeaseUntil: null,
          updatedAt: input.generatedAt,
        }),
      );
      return id;
    },

    async createNoodlerScheduledPost(input: {
      creatorAccountId: string;
      publishAt: string;
      policyFingerprint: string;
      createdAt: string;
    }): Promise<string> {
      const id = newId();
      await db.transaction(async (tx) =>
        tx.insert(noodlerPreparedPosts).values({
          id,
          creatorAccountId: input.creatorAccountId,
          generatedAt: input.createdAt,
          publishAt: input.publishAt,
          payload: "{}",
          policyFingerprint: input.policyFingerprint,
          state: "scheduled",
          publishedPostId: null,
          imageState: "none",
          imageClaimToken: null,
          imageClaimLeaseUntil: null,
          updatedAt: input.createdAt,
        }),
      );
      return id;
    },

    async fillNoodlerScheduledPost(
      id: string,
      input: {
        generatedAt: string;
        expectedPublishAt: string;
        payload: NoodlerPreparedPostPayload;
        policyFingerprint: string;
      },
    ): Promise<boolean> {
      return db.transaction(async (tx) => {
        const current = (await tx.select().from(noodlerPreparedPosts).where(eq(noodlerPreparedPosts.id, id)))[0];
        if (!current || current.state !== "scheduled" || current.publishAt !== input.expectedPublishAt) return false;
        await tx
          .update(noodlerPreparedPosts)
          .set({
            generatedAt: input.generatedAt,
            payload: JSON.stringify(input.payload),
            policyFingerprint: input.policyFingerprint,
            state: "prepared",
            imageState: input.payload.metadata.noodlerMediaPath ? "attached" : "none",
            imageClaimToken: null,
            imageClaimLeaseUntil: null,
            updatedAt: input.generatedAt,
          })
          .where(eq(noodlerPreparedPosts.id, id));
        return true;
      });
    },

    async rescheduleNoodlerPost(
      id: string,
      publishAt: string,
      at = new Date(),
    ): Promise<"updated" | "not_found" | "not_future" | "not_editable"> {
      const publishMs = Date.parse(publishAt);
      if (Number.isNaN(publishMs) || publishMs <= at.getTime()) return "not_future";
      const settings = await this.getSettings();
      let mediaPath: string | null = null;
      const result = await db.transaction(async (tx) => {
        const current = (await tx.select().from(noodlerPreparedPosts).where(eq(noodlerPreparedPosts.id, id)))[0];
        if (!current) return "not_found" as const;
        if (current.state !== "scheduled" && current.state !== "prepared") return "not_editable" as const;
        if (current.state === "prepared") {
          mediaPath = String(parseRecord(parseRecord(current.payload).metadata).noodlerMediaPath ?? "") || null;
        }
        const accountRow = (
          await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, current.creatorAccountId))
        )[0];
        if (!accountRow || accountRow.platform !== "slurp") return "not_found" as const;
        const account = mapAccount(accountRow);
        const source = await this.resolveAccountSource(account);
        const timestamp = at.toISOString();
        await tx
          .update(noodlerPreparedPosts)
          .set({
            publishAt: new Date(publishMs).toISOString(),
            generatedAt: timestamp,
            payload: "{}",
            policyFingerprint: noodlerReservePolicyFingerprint(account, settings, source?.updatedAt ?? null),
            state: "scheduled",
            publishedPostId: null,
            imageState: "none",
            imageClaimToken: null,
            imageClaimLeaseUntil: null,
            updatedAt: timestamp,
          })
          .where(eq(noodlerPreparedPosts.id, id));
        return "updated" as const;
      });
      if (result === "updated") unlinkNoodlerMedia(mediaPath);
      return result;
    },

    async listNoodlerPreparedPosts(): Promise<
      Array<{
        id: string;
        creatorAccountId: string;
        generatedAt: string;
        publishAt: string;
        payload: NoodlerPreparedPostPayload;
        policyFingerprint: string;
        state: NoodlerPreparedPostState;
        publishedPostId: string | null;
        imageState: NoodlerPreparedImageState;
        imageClaimToken: string | null;
        imageClaimLeaseUntil: string | null;
        updatedAt: string;
      }>
    > {
      const rows = await db.select().from(noodlerPreparedPosts).orderBy(noodlerPreparedPosts.publishAt);
      return rows.map((row) => ({
        ...row,
        state: (row.state === "scheduled" || row.state === "prepared" || row.state === "published"
          ? row.state
          : "discarded") as NoodlerPreparedPostState,
        imageState: (row.imageState === "pending" ||
        row.imageState === "generating" ||
        row.imageState === "attached" ||
        row.imageState === "rejected" ||
        row.imageState === "closed"
          ? row.imageState
          : "none") as NoodlerPreparedImageState,
        payload: parseRecord(row.payload) as NoodlerPreparedPostPayload,
      }));
    },

    /** Existence check for the idle scheduler poll, so it never materializes or parses rows. */
    async hasNoodlerPreparedPosts(): Promise<boolean> {
      const rows = await db.select({ id: noodlerPreparedPosts.id }).from(noodlerPreparedPosts).limit(1);
      return rows.length > 0;
    },

    /**
     * Unlinking media before the discard is durable can leave a still-publishable row whose
     * image bytes are gone, so the state is committed first and the file removed afterwards.
     * A crash between the two leaks a file, which `sweepOrphanedNoodlerMedia` reclaims.
     */
    async discardNoodlerPreparedPost(id: string, at = new Date()): Promise<void> {
      const current = (await db.select().from(noodlerPreparedPosts).where(eq(noodlerPreparedPosts.id, id)))[0];
      await db.transaction(async (tx) =>
        tx
          .update(noodlerPreparedPosts)
          .set({ state: "discarded", updatedAt: at.toISOString() })
          .where(eq(noodlerPreparedPosts.id, id)),
      );
      if (current)
        unlinkNoodlerMedia(String(parseRecord(parseRecord(current.payload).metadata).noodlerMediaPath ?? "") || null);
    },

    async discardPreparedPostsAfterManualPost(creatorAccountId: string, manualCreatedAt: string): Promise<number> {
      const start = Date.parse(manualCreatedAt);
      const end = start + MANUAL_POST_INVALIDATION_MS;
      const rows = await db
        .select()
        .from(noodlerPreparedPosts)
        .where(eq(noodlerPreparedPosts.creatorAccountId, creatorAccountId));
      const ids = rows
        .filter(
          (row) => row.state === "prepared" && Date.parse(row.publishAt) > start && Date.parse(row.publishAt) <= end,
        )
        .map((row) => row.id);
      if (ids.length > 0) {
        await db.transaction(async (tx) =>
          tx
            .update(noodlerPreparedPosts)
            .set({ state: "discarded", updatedAt: now() })
            .where(inArray(noodlerPreparedPosts.id, ids)),
        );
        for (const row of rows.filter((candidate) => ids.includes(candidate.id))) {
          unlinkNoodlerMedia(String(parseRecord(parseRecord(row.payload).metadata).noodlerMediaPath ?? "") || null);
        }
      }
      return ids.length;
    },

    async publishDueNoodlerPreparedPosts(at = new Date()): Promise<number> {
      const settings = await this.getSettings();
      if (!settings.autoPostingScheduleEnabled) return 0;
      const due = (await this.listNoodlerPreparedPosts()).filter(
        (item) => item.state === "prepared" && Date.parse(item.publishAt) <= at.getTime(),
      );
      if (due.length === 0) return 0;
      // One pass over posts for the whole batch: the crash-recovery lookup below only needs
      // to know which prepared items already published, not to rescan every post per item.
      const publishedPreparedIds = new Map<string, { id: string }>();
      for (const post of await db.select().from(noodlePosts)) {
        const preparedId = parseRecord(post.metadata).noodlerPreparedPostId;
        if (typeof preparedId === "string" && !publishedPreparedIds.has(preparedId)) {
          publishedPreparedIds.set(preparedId, { id: post.id });
        }
      }
      let published = 0;
      const discardedMediaPaths: Array<string | null> = [];
      for (const item of due) {
        const didPublish = await db.transaction(async (tx) => {
          const current = (await tx.select().from(noodlerPreparedPosts).where(eq(noodlerPreparedPosts.id, item.id)))[0];
          if (!current || current.state !== "prepared" || Date.parse(current.publishAt) > at.getTime()) return false;
          const existingPost = publishedPreparedIds.get(current.id);
          if (!existingPost && Date.parse(current.publishAt) < at.getTime() - ELAPSED_PREPARED_SLOT_MS) {
            await tx
              .update(noodlerPreparedPosts)
              .set({ state: "discarded", updatedAt: at.toISOString() })
              .where(eq(noodlerPreparedPosts.id, current.id));
            // Unlinked only after the discard commits, so a crash here leaks a file rather than
            // leaving a publishable row whose image is already gone.
            discardedMediaPaths.push(
              String(parseRecord(parseRecord(current.payload).metadata).noodlerMediaPath ?? "") || null,
            );
            return false;
          }
          if (existingPost) {
            await tx
              .update(noodlerPreparedPosts)
              .set({ state: "published", publishedPostId: existingPost.id, updatedAt: at.toISOString() })
              .where(eq(noodlerPreparedPosts.id, current.id));
            return false;
          }
          const accountRow = (
            await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, current.creatorAccountId))
          )[0];
          if (!accountRow || accountRow.platform !== "slurp") {
            await tx
              .update(noodlerPreparedPosts)
              .set({ state: "discarded", updatedAt: at.toISOString() })
              .where(eq(noodlerPreparedPosts.id, current.id));
            return false;
          }
          const account = mapAccount(accountRow);
          const source = await this.resolveAccountSource(account);
          const sourceSnapshot = source ? await resolveNoodlerSourceSnapshot(db, source) : null;
          if (
            !account.settings.scheduler.autoPosting?.enabled ||
            !source ||
            !sourceSnapshot ||
            current.policyFingerprint !== noodlerReservePolicyFingerprint(account, settings, source.updatedAt)
          ) {
            await tx
              .update(noodlerPreparedPosts)
              .set({ state: "discarded", updatedAt: at.toISOString() })
              .where(eq(noodlerPreparedPosts.id, current.id));
            return false;
          }
          const payload = parseRecord(current.payload) as NoodlerPreparedPostPayload;
          if (typeof payload.content !== "string" || !payload.content.trim()) {
            await tx
              .update(noodlerPreparedPosts)
              .set({ state: "discarded", updatedAt: at.toISOString() })
              .where(eq(noodlerPreparedPosts.id, current.id));
            return false;
          }
          const postId = newId();
          const imageState = current.imageState === "attached" ? "attached" : "closed";
          await tx.insert(noodlePosts).values({
            id: postId,
            authorAccountId: account.id,
            title: typeof payload.title === "string" ? payload.title : null,
            content: payload.content,
            imageUrl:
              typeof parseRecord(payload.metadata).noodlerMediaPath === "string" ? noodlerPostMediaUrl(postId) : null,
            imagePrompt: typeof payload.imagePrompt === "string" ? payload.imagePrompt : null,
            parentPostId: null,
            quotePostId: null,
            source: "generated",
            access: payload.access === "public" ? "public" : "locked",
            metadata: JSON.stringify({ ...parseRecord(payload.metadata), noodlerPreparedPostId: current.id }),
            authorSnapshot: JSON.stringify(snapshotForAccount(account)),
            // A late publish is stamped with the moment it actually happened. Using publishAt
            // would file the post behind whatever the feed received during the delay.
            createdAt: Date.parse(current.publishAt) < at.getTime() ? at.toISOString() : current.publishAt,
            updatedAt: at.toISOString(),
          });
          await tx
            .update(noodlerPreparedPosts)
            .set({
              state: "published",
              publishedPostId: postId,
              imageState,
              imageClaimToken: null,
              imageClaimLeaseUntil: null,
              updatedAt: at.toISOString(),
            })
            .where(eq(noodlerPreparedPosts.id, current.id));
          return true;
        });
        if (didPublish) published += 1;
      }
      for (const path of discardedMediaPaths) unlinkNoodlerMedia(path);
      return published;
    },

    async reconcileNoodlerPreparedPosts(at = new Date()): Promise<number> {
      const settings = await this.getSettings();
      const repaired = await db.transaction(async (tx) => {
        const [items, posts] = await Promise.all([
          tx.select().from(noodlerPreparedPosts),
          tx.select().from(noodlePosts),
        ]);
        const postsByPreparedId = new Map<string, typeof posts>();
        for (const post of posts) {
          const preparedId = parseRecord(post.metadata).noodlerPreparedPostId;
          if (typeof preparedId !== "string") continue;
          const existing = postsByPreparedId.get(preparedId) ?? [];
          existing.push(post);
          postsByPreparedId.set(preparedId, existing);
        }
        let count = 0;
        for (const item of items) {
          const linkedPosts = (postsByPreparedId.get(item.id) ?? []).sort((left, right) =>
            left.id.localeCompare(right.id),
          );
          const linkedPost = linkedPosts[0];
          if (linkedPost) {
            if (item.state !== "published" || item.publishedPostId !== linkedPost.id) {
              await tx
                .update(noodlerPreparedPosts)
                .set({ state: "published", publishedPostId: linkedPost.id, updatedAt: at.toISOString() })
                .where(eq(noodlerPreparedPosts.id, item.id));
              count += 1;
            }
          } else if (item.state === "published") {
            // The linked post is gone. Re-preparing is only right while the slot is still in the
            // future; a row whose publishAt has passed would be republished by the very next poll,
            // so a user who deletes an automatic post would watch it come back. Discard those.
            const slotStillAhead = Date.parse(item.publishAt) > at.getTime();
            await tx
              .update(noodlerPreparedPosts)
              .set(
                slotStillAhead
                  ? { state: "prepared", publishedPostId: null, updatedAt: at.toISOString() }
                  : { state: "discarded", updatedAt: at.toISOString() },
              )
              .where(eq(noodlerPreparedPosts.id, item.id));
            count += 1;
          }
        }
        return count;
      });
      const items = await this.listNoodlerPreparedPosts();
      const active = items.filter((item) => item.state === "scheduled" || item.state === "prepared");
      const accounts = new Map((await this.listNoodlerAccounts()).map((account) => [account.id, account]));
      const sources = new Map(
        await Promise.all(
          [...accounts.values()].map(
            async (account) => [account.id, await this.resolveAccountSource(account)] as const,
          ),
        ),
      );
      const missingSourceAccountIds = new Set(
        (
          await Promise.all(
            [...accounts.values()].map(async (account) => {
              const source = sources.get(account.id) ?? null;
              return !source || !(await resolveNoodlerSourceSnapshot(db, source)) ? account.id : null;
            }),
          )
        ).filter((id): id is string => id !== null),
      );
      const invalidIds = active
        .filter((item) => {
          const account = accounts.get(item.creatorAccountId);
          const source = account ? (sources.get(account.id) ?? null) : null;
          return (
            // A row whose timestamps do not parse can never become due and would otherwise make
            // every status read and publish pass fail until someone edited storage by hand.
            Number.isNaN(Date.parse(item.publishAt)) ||
            Number.isNaN(Date.parse(item.generatedAt)) ||
            Date.parse(item.publishAt) < at.getTime() - ELAPSED_PREPARED_SLOT_MS ||
            !account ||
            !source ||
            missingSourceAccountIds.has(item.creatorAccountId) ||
            !account.settings.scheduler.autoPosting?.enabled ||
            item.policyFingerprint !== noodlerReservePolicyFingerprint(account, settings, source.updatedAt)
          );
        })
        .map((item) => item.id);
      const invalidIdSet = new Set(invalidIds);
      // Soonest first, so lowering postsPerDay discards the latest excess items and leaves
      // the imminent ones intact.
      const validFuture = active
        .filter((item) => !invalidIdSet.has(item.id) && Date.parse(item.publishAt) > at.getTime())
        .sort((a, b) => Date.parse(a.publishAt) - Date.parse(b.publishAt));
      const excessIds = validFuture.slice(settings.postsPerDay).map((item) => item.id);
      const discardedSet = new Set([...invalidIds, ...excessIds]);
      const discarded = [...discardedSet];
      if (discarded.length > 0) {
        await db.transaction(async (tx) =>
          tx
            .update(noodlerPreparedPosts)
            .set({ state: "discarded", updatedAt: at.toISOString() })
            .where(inArray(noodlerPreparedPosts.id, discarded)),
        );
        for (const item of active.filter(
          (candidate) => candidate.state === "prepared" && discardedSet.has(candidate.id),
        )) {
          unlinkNoodlerMedia(String(parseRecord(item.payload.metadata).noodlerMediaPath ?? "") || null);
        }
      }
      // A crash between the durable row write and the media promotion leaves a row pointing at a
      // file that is not there; publishing it would give the post a 404 image route. Drop the
      // reference instead, so the post publishes as text.
      for (const item of items) {
        if (item.state !== "prepared" || discardedSet.has(item.id)) continue;
        const mediaPath = item.payload.metadata.noodlerMediaPath;
        if (typeof mediaPath !== "string" || !mediaPath) continue;
        const absolute = resolveNoodlerMediaAbsolutePath(mediaPath);
        if (absolute && existsSync(absolute)) continue;
        const { noodlerMediaPath: _missing, ...metadata } = item.payload.metadata;
        await db.transaction(async (tx) =>
          tx
            .update(noodlerPreparedPosts)
            .set({
              payload: JSON.stringify({ ...item.payload, metadata }),
              imageState: "closed",
              updatedAt: at.toISOString(),
            })
            .where(eq(noodlerPreparedPosts.id, item.id)),
        );
      }
      // Published and discarded rows only exist for crash recovery, and this table is read whole
      // on every poll, so aged terminal rows are dropped instead of accumulating forever.
      const pruneBefore = at.getTime() - TERMINAL_PREPARED_POST_RETENTION_MS;
      const prunable = items
        .filter(
          (item) =>
            item.state !== "scheduled" &&
            item.state !== "prepared" &&
            !discardedSet.has(item.id) &&
            !(Date.parse(item.updatedAt) > pruneBefore),
        )
        .map((item) => item.id);
      if (prunable.length > 0) {
        await db.delete(noodlerPreparedPosts).where(inArray(noodlerPreparedPosts.id, prunable));
      }
      return repaired + discarded.length;
    },

    async getNoodlerReserveStatus(at = new Date()): Promise<SlurpReserveStatus> {
      const settings = await this.getSettings();
      const state = await this.ensureNoodlerReserveState(at);
      const effectiveMs = Date.parse(state.lastObservedBudgetTime);
      const cutoff = effectiveMs - ROLLING_DAY_MS;
      const [items, attempts, creators] = await Promise.all([
        this.listNoodlerPreparedPosts(),
        db.select().from(noodlerAutomaticAttempts),
        this.listAutoPostEnabledAccounts(),
      ]);
      const prepared = items.filter((item) => item.state === "prepared");
      const upcoming = items.filter(
        (item) =>
          (item.state === "scheduled" || item.state === "prepared") && Date.parse(item.publishAt) > at.getTime(),
      );
      return {
        preparedCount: prepared.length,
        preparedThrough: prepared.reduce<string | null>(
          (latest, item) => (!latest || item.publishAt > latest ? item.publishAt : latest),
          null,
        ),
        textAttemptsUsed: attempts.filter(
          (row) => row.kind === "text" && row.outcome !== "failed" && Date.parse(row.claimedAt) > cutoff,
        ).length,
        imageAttemptsUsed: attempts.filter(
          (row) => row.kind === "image" && row.outcome !== "failed" && Date.parse(row.claimedAt) > cutoff,
        ).length,
        postsPerDay: settings.postsPerDay,
        preparationNotBefore: state.preparationNotBefore,
        creators: creators.map((account) => ({
          accountId: account.id,
          nextPreparedAt: prepared.find((item) => item.creatorAccountId === account.id)?.publishAt ?? null,
          // Settings shows who is holding reserve and how many, so the count travels with the row.
          preparedCount: prepared.filter((item) => item.creatorAccountId === account.id).length,
          slots: upcoming
            .filter((item) => item.creatorAccountId === account.id)
            .map((item) => ({ id: item.id, publishAt: item.publishAt, state: item.state })),
        })),
      };
    },

    async updateAccountFollow(
      id: string,
      targetAccountId: string,
      followed: boolean,
      followedAt = new Date().toISOString(),
    ): Promise<{ account: NoodleAccount; changed: boolean } | null> {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, id), eq(noodleAccounts.platform, "slurp")));
        const row = rows[0];
        if (!row) return null;
        const current = normalizeNoodleAccountSettings(row.settings);
        const followingAccountIds = current.social.followingAccountIds ?? [];
        const isFollowing = followingAccountIds.includes(targetAccountId);
        const followingAccountTimestamps = { ...current.social.followingAccountTimestamps };
        const hasFollowTimestamp = typeof followingAccountTimestamps[targetAccountId] === "string";
        if (isFollowing === followed && (!followed || hasFollowTimestamp)) {
          return { account: mapAccount(row), changed: false };
        }
        if (followed) followingAccountTimestamps[targetAccountId] = followedAt;
        else delete followingAccountTimestamps[targetAccountId];
        const next: NoodleAccountSettings = {
          ...current,
          social: {
            ...current.social,
            followingAccountIds: followed
              ? [...followingAccountIds, targetAccountId]
              : followingAccountIds.filter((accountId) => accountId !== targetAccountId),
            followingAccountTimestamps,
          },
        };
        await tx
          .update(noodleAccounts)
          .set({ settings: JSON.stringify(next), updatedAt: now() })
          .where(eq(noodleAccounts.id, id));
        const updatedRows = await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, id));
        return updatedRows[0] ? { account: mapAccount(updatedRows[0]), changed: true } : null;
      });
    },

    async setCharacterInvited(characterId: string, invited: boolean): Promise<NoodleAccount | null> {
      const existing = await this.getSlurpAccountForEntity("character", characterId);
      if (!existing) return null;
      return this.updateAccount(existing.id, { invited });
    },

    /** Mark every currently invited character account as uninvited. */
    async clearCharacterInvites(): Promise<void> {
      await db
        .update(noodleAccounts)
        .set({ invited: "false", updatedAt: now() })
        .where(
          and(
            eq(noodleAccounts.kind, "character"),
            eq(noodleAccounts.invited, "true"),
            eq(noodleAccounts.platform, "slurp"),
          ),
        );
    },

    async listPosts(options: { limit?: number; since?: string } = {}): Promise<NoodlePost[]> {
      const limit = Math.max(1, Math.min(300, Math.floor(options.limit ?? 120)));
      const slurpSourceAccountIds = (await this.listAccounts()).map((account) => account.id);
      if (slurpSourceAccountIds.length === 0) return [];
      const rows = options.since
        ? await db
            .select()
            .from(noodlePosts)
            .where(
              and(
                gt(noodlePosts.createdAt, options.since),
                inArray(noodlePosts.authorAccountId, slurpSourceAccountIds),
              ),
            )
            .orderBy(desc(noodlePosts.createdAt))
            .limit(limit)
        : await db
            .select()
            .from(noodlePosts)
            .where(inArray(noodlePosts.authorAccountId, slurpSourceAccountIds))
            .orderBy(desc(noodlePosts.createdAt))
            .limit(limit);
      return rows.map((row) => mapPost(row));
    },

    async listPostsBefore(before: string): Promise<NoodlePost[]> {
      const slurpSourceAccountIds = (await this.listAccounts()).map((account) => account.id);
      if (slurpSourceAccountIds.length === 0) return [];
      const rows = await db
        .select()
        .from(noodlePosts)
        .where(and(lt(noodlePosts.createdAt, before), inArray(noodlePosts.authorAccountId, slurpSourceAccountIds)))
        .orderBy(desc(noodlePosts.createdAt));
      return rows.map((row) => mapPost(row));
    },

    async listNoodlerPostsByAccount(accountId: string, limit = 8): Promise<NoodlerManagedPost[]> {
      const account = await this.getNoodlerAccountById(accountId);
      if (!account) return [];
      const rows = await db
        .select()
        .from(noodlePosts)
        .where(eq(noodlePosts.authorAccountId, accountId))
        .orderBy(desc(noodlePosts.createdAt))
        .limit(Math.max(1, Math.min(50, Math.floor(limit))));
      return rows.map(mapManagedPost);
    },

    // Unbounded — used by the disclosure-downgrade review, which must inspect every
    // published post (the clamped list above would undercount and let old
    // identifying posts slip through a privacy downgrade).
    async listAllNoodlerPostsByAccount(accountId: string): Promise<NoodlerManagedPost[]> {
      const account = await this.getNoodlerAccountById(accountId);
      if (!account) return [];
      const rows = await db
        .select()
        .from(noodlePosts)
        .where(eq(noodlePosts.authorAccountId, accountId))
        .orderBy(desc(noodlePosts.createdAt));
      return rows.map(mapManagedPost);
    },

    async listNoodlerPostsByAccounts(accountIds: string[], limit = 8): Promise<Map<string, NoodlerManagedPost[]>> {
      const boundedLimit = Math.max(1, Math.min(50, Math.floor(limit)));
      const result = new Map<string, NoodlerManagedPost[]>();
      if (accountIds.length === 0) return result;
      const rows = await db
        .select()
        .from(noodlePosts)
        .where(inArray(noodlePosts.authorAccountId, accountIds))
        .orderBy(desc(noodlePosts.createdAt));
      for (const row of rows) {
        const post = mapManagedPost(row);
        const existing = result.get(post.authorAccountId);
        if (existing) {
          if (existing.length < boundedLimit) existing.push(post);
        } else {
          result.set(post.authorAccountId, [post]);
        }
      }
      return result;
    },

    async listNoodlerPostPage(options: NoodlerPostPageOptions) {
      const limit = Math.max(1, Math.min(20, Math.floor(options.limit)));
      if (options.accountIds.length === 0) {
        return { items: [], total: 0, nextCursor: null };
      }
      const search = options.search?.trim().toLowerCase() ?? "";
      if (search) {
        const creatorMatches = new Set(options.creatorSearchAccountIds ?? []);
        const readableAccounts = new Set(options.readableContentAccountIds ?? []);
        const unlockedPosts = new Set(options.unlockedPostIds ?? []);
        const matchingRows = (
          await db
            .select()
            .from(noodlePosts)
            .where(noodlerPostPageCondition(options, false))
            .orderBy(desc(noodlePosts.createdAt), desc(noodlePosts.id))
        ).filter((row) => {
          const readable =
            row.access === "public" || readableAccounts.has(row.authorAccountId) || unlockedPosts.has(row.id);
          return (
            creatorMatches.has(row.authorAccountId) ||
            (row.title ?? "").toLowerCase().includes(search) ||
            (readable && row.content.toLowerCase().includes(search))
          );
        });
        const cursorRows = options.cursor
          ? matchingRows.filter((row) => isNoodlerPostAfterCursor(row, options.cursor!))
          : matchingRows;
        const pageRows = cursorRows.slice(0, limit);
        const last = pageRows.at(-1);
        return {
          items: pageRows.map(mapManagedPost),
          total: matchingRows.length,
          nextCursor: cursorRows.length > limit && last ? { createdAt: last.createdAt, id: last.id } : null,
        };
      }
      const total = db.count(noodlePosts, noodlerPostPageCondition(options, false));
      const rows = await db
        .select()
        .from(noodlePosts)
        .where(noodlerPostPageCondition(options, true))
        .orderBy(desc(noodlePosts.createdAt), desc(noodlePosts.id))
        .limit(limit + 1);
      const pageRows = rows.slice(0, limit);
      const last = pageRows.at(-1);
      return {
        items: pageRows.map(mapManagedPost),
        total,
        nextCursor: rows.length > limit && last ? { createdAt: last.createdAt, id: last.id } : null,
      };
    },

    async getNoodlerViewerSignal(
      visibleAccountIds: string[],
      unseenAccountIds: string[],
      seenAt: string | null | undefined,
    ) {
      const unseen = new Set(unseenAccountIds);
      const normalizedSeenAt = normalizeNoodlerSeenAt(seenAt);
      if (visibleAccountIds.length === 0) {
        return {
          count: 0,
          latestPost: null,
          latestPostId: null,
          latestPostAccountId: null,
          latestPostUpdate: null,
          updatedPostId: null,
          updatedPostAccountId: null,
          latestInteraction: null,
          interactionPostId: null,
        };
      }
      const posts = await db
        .select({
          id: noodlePosts.id,
          authorAccountId: noodlePosts.authorAccountId,
          createdAt: noodlePosts.createdAt,
          updatedAt: noodlePosts.updatedAt,
        })
        .from(noodlePosts)
        .where(inArray(noodlePosts.authorAccountId, visibleAccountIds));
      const latestPost = [...posts].sort(compareNoodlerPostSortKeysDescending)[0];
      const latestUpdate = [...posts].sort((left, right) =>
        compareNoodlerPostSortKeysDescending(
          { createdAt: left.updatedAt, id: left.id },
          { createdAt: right.updatedAt, id: right.id },
        ),
      )[0];
      const latestInteractionRows = await db
        .select({
          id: noodleInteractions.id,
          postId: noodleInteractions.postId,
          createdAt: noodleInteractions.createdAt,
        })
        .from(noodleInteractions)
        .where(
          inArray(
            noodleInteractions.postId,
            posts.map((row) => row.id),
          ),
        )
        .orderBy(desc(noodleInteractions.createdAt), desc(noodleInteractions.id))
        .limit(1);
      const latestInteraction = latestInteractionRows[0];
      return {
        count: normalizedSeenAt
          ? posts.filter((row) => unseen.has(row.authorAccountId) && row.createdAt > normalizedSeenAt).length
          : 0,
        latestPost: latestPost ? `${latestPost.createdAt}:${latestPost.id}` : null,
        latestPostId: latestPost?.id ?? null,
        latestPostAccountId: latestPost?.authorAccountId ?? null,
        latestPostUpdate: latestUpdate ? `${latestUpdate.updatedAt}:${latestUpdate.id}` : null,
        updatedPostId: latestUpdate?.id ?? null,
        updatedPostAccountId: latestUpdate?.authorAccountId ?? null,
        latestInteraction: latestInteraction ? `${latestInteraction.createdAt}:${latestInteraction.id}` : null,
        interactionPostId: latestInteraction?.postId ?? null,
      };
    },

    countNoodlerPostsByAccountsSince(accountIds: string[], since: string): number {
      if (accountIds.length === 0) return 0;
      return db.count(
        noodlePosts,
        and(inArray(noodlePosts.authorAccountId, accountIds), gt(noodlePosts.createdAt, since)),
      );
    },

    async getNoodlerPostById(id: string): Promise<NoodlerManagedPost | null> {
      const rows = await db.select().from(noodlePosts).where(eq(noodlePosts.id, id));
      const row = rows[0];
      if (!row || !(await this.getNoodlerAccountById(row.authorAccountId))) return null;
      return mapManagedPost(row);
    },

    async getNoodlerPostByWizardExecution(accountId: string, executionId: string): Promise<NoodlerManagedPost | null> {
      const account = await this.getNoodlerAccountById(accountId);
      if (!account) return null;
      const rows = await db.select().from(noodlePosts).where(eq(noodlePosts.authorAccountId, accountId));
      const row = rows.find((candidate) => parseRecord(candidate.metadata).noodlerWizardExecutionId === executionId);
      return row ? mapManagedPost(row) : null;
    },

    async createNoodlerPost(input: NoodlerPostPersistenceInput): Promise<NoodlerManagedPost | null> {
      const posts = await this.createNoodlerPosts([input]);
      return posts?.[0] ?? null;
    },

    // One transaction for the whole batch: a post and its linked follow-up are
    // either both stored or neither is, with no compensating delete to get wrong.
    async createNoodlerPosts(inputs: NoodlerPostPersistenceInput[]): Promise<NoodlerManagedPost[] | null> {
      const accounts = await Promise.all(inputs.map((input) => this.getNoodlerAccountById(input.authorAccountId)));
      if (accounts.some((account) => !account)) return null;
      const timestamp = now();
      const rows = inputs.map((input, index) => ({
        id: input.id ?? newId(),
        authorAccountId: input.authorAccountId,
        title: input.title?.trim() || null,
        content: input.content,
        imageUrl: input.imageUrl ?? null,
        imagePrompt: input.imagePrompt ?? null,
        parentPostId: null,
        quotePostId: null,
        source: input.source ?? "manual",
        access: input.access ?? "public",
        metadata: JSON.stringify(input.metadata ?? {}),
        authorSnapshot: JSON.stringify(snapshotForAccount(accounts[index]!)),
        createdAt: timestamp,
        updatedAt: timestamp,
      }));
      return db.transaction(async (tx) => {
        for (const row of rows) await tx.insert(noodlePosts).values(row);
        const stored = await tx
          .select()
          .from(noodlePosts)
          .where(
            inArray(
              noodlePosts.id,
              rows.map((row) => row.id),
            ),
          );
        const byId = new Map(stored.map((row) => [row.id, mapManagedPost(row)]));
        const managed = rows.map((row) => byId.get(row.id));
        return managed.every((post) => post) ? (managed as NoodlerManagedPost[]) : null;
      });
    },

    async createPost(
      input: Omit<NoodleCreatePostInput, "authorKind" | "authorEntityId"> & {
        authorAccountId: string;
        source?: NoodlePostSource;
        metadata?: Record<string, unknown>;
      },
    ): Promise<NoodlePost | null> {
      const account = await this.getAccountById(input.authorAccountId);
      if (!account) return null;
      const timestamp = now();
      const id = newId();
      await db.insert(noodlePosts).values({
        id,
        authorAccountId: input.authorAccountId,
        title: null,
        content: input.content,
        imageUrl: input.imageUrl ?? null,
        imagePrompt: input.imagePrompt ?? null,
        parentPostId: input.parentPostId ?? null,
        quotePostId: input.quotePostId ?? null,
        source: input.source ?? "manual",
        access: "public",
        metadata: JSON.stringify(input.metadata ?? {}),
        authorSnapshot: JSON.stringify(snapshotForAccount(account)),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return (await this.getPostById(id))!;
    },

    async getPostById(id: string): Promise<NoodlePost | null> {
      const rows = await db.select().from(noodlePosts).where(eq(noodlePosts.id, id));
      const row = rows[0];
      if (!row || !(await this.getAccountById(row.authorAccountId))) return null;
      return mapPost(row);
    },

    async updatePostMedia(
      id: string,
      input: { imageUrl?: string | null; imagePrompt?: string | null; metadata?: Record<string, unknown> },
    ): Promise<NoodlePost | null> {
      const existing = await this.getPostById(id);
      if (!existing) return null;
      await db
        .update(noodlePosts)
        .set({
          ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
          ...(input.imagePrompt !== undefined && { imagePrompt: input.imagePrompt }),
          ...((input.imageUrl !== undefined || input.imagePrompt !== undefined) && {
            imageClaimToken: null,
            imageClaimLeaseUntil: null,
          }),
          ...(input.metadata !== undefined && {
            metadata: JSON.stringify({ ...existing.metadata, ...input.metadata }),
          }),
          updatedAt: now(),
        })
        .where(eq(noodlePosts.id, id));
      return this.getPostById(id);
    },

    async claimPostImage(id: string, token: string, leaseUntil: string, at = now()): Promise<NoodlePost | null> {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(noodlePosts).where(eq(noodlePosts.id, id));
        const row = rows[0];
        if (!row || !imageClaimIsAvailable(row, at)) return null;
        await tx
          .update(noodlePosts)
          .set({ imageClaimToken: token, imageClaimLeaseUntil: leaseUntil })
          .where(
            and(
              eq(noodlePosts.id, id),
              isNull(noodlePosts.imageUrl),
              isNotNull(noodlePosts.imagePrompt),
              or(
                isNull(noodlePosts.imageClaimToken),
                isNull(noodlePosts.imageClaimLeaseUntil),
                lt(noodlePosts.imageClaimLeaseUntil, at),
              ),
            ),
          );
        const claimedRows = await tx
          .select()
          .from(noodlePosts)
          .where(and(eq(noodlePosts.id, id), eq(noodlePosts.imageClaimToken, token)));
        if (!claimedRows[0]) return null;
        return mapPost(row);
      });
    },

    async renewPostImageClaim(id: string, token: string, leaseUntil: string, at = now()): Promise<boolean> {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(noodlePosts).where(eq(noodlePosts.id, id));
        const row = rows[0];
        if (
          !row ||
          row.imageClaimToken !== token ||
          !row.imageClaimLeaseUntil ||
          row.imageClaimLeaseUntil <= at ||
          !row.imagePrompt ||
          row.imageUrl
        ) {
          return false;
        }
        await tx
          .update(noodlePosts)
          .set({ imageClaimLeaseUntil: leaseUntil })
          .where(and(eq(noodlePosts.id, id), eq(noodlePosts.imageClaimToken, token)));
        return true;
      });
    },

    async releasePostImageClaim(id: string, token: string): Promise<boolean> {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(noodlePosts).where(eq(noodlePosts.id, id));
        if (rows[0]?.imageClaimToken !== token) return false;
        await tx
          .update(noodlePosts)
          .set({ imageClaimToken: null, imageClaimLeaseUntil: null })
          .where(and(eq(noodlePosts.id, id), eq(noodlePosts.imageClaimToken, token)));
        return true;
      });
    },

    async finalizePostImageClaim(
      id: string,
      token: string,
      input: { imageUrl: string | null; imagePrompt?: string | null; metadata: Record<string, unknown> },
      at = now(),
    ): Promise<boolean> {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(noodlePosts).where(eq(noodlePosts.id, id));
        const row = rows[0];
        if (
          !row ||
          row.imageClaimToken !== token ||
          !row.imageClaimLeaseUntil ||
          row.imageClaimLeaseUntil <= at ||
          !row.imagePrompt ||
          row.imageUrl
        ) {
          return false;
        }
        // Finalization owns the terminal transition: drop the pending-review marker so a
        // finalized (success or failed) row never keeps contradictory pending lifecycle state.
        const mergedMetadata = { ...parseRecord(row.metadata), ...input.metadata };
        delete mergedMetadata.imagePendingReview;
        await tx
          .update(noodlePosts)
          .set({
            imageUrl: input.imageUrl,
            ...(input.imagePrompt !== undefined && { imagePrompt: input.imagePrompt }),
            metadata: JSON.stringify(mergedMetadata),
            imageClaimToken: null,
            imageClaimLeaseUntil: null,
            updatedAt: now(),
          })
          .where(and(eq(noodlePosts.id, id), eq(noodlePosts.imageClaimToken, token)));
        return true;
      });
    },

    async updatePost(id: string, input: NoodlePostUpdateInput): Promise<NoodlePost | null> {
      const updated = await db.transaction(async (tx) => {
        const postRows = await tx.select().from(noodlePosts).where(eq(noodlePosts.id, id));
        const existing = postRows[0];
        if (!existing) return false;
        const authorRows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, existing.authorAccountId), eq(noodleAccounts.platform, "slurp")));
        if (!authorRows[0]) return false;
        const nextMetadata = updatePollMetadata(mapPost(existing).metadata, input.poll);
        if (input.imageCrop === null) delete nextMetadata.imageCrop;
        else if (input.imageCrop !== undefined) nextMetadata.imageCrop = input.imageCrop;
        await tx
          .update(noodlePosts)
          .set({
            ...(input.content !== undefined && { content: input.content.trim().slice(0, 4000) }),
            ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
            ...(input.imagePrompt !== undefined && { imagePrompt: input.imagePrompt }),
            ...((input.imageUrl !== undefined || input.imagePrompt !== undefined) && {
              imageClaimToken: null,
              imageClaimLeaseUntil: null,
            }),
            ...((input.imageCrop !== undefined || input.poll !== undefined) && {
              metadata: JSON.stringify(nextMetadata),
            }),
            updatedAt: now(),
          })
          .where(eq(noodlePosts.id, id));
        return true;
      });
      if (!updated) return null;
      return this.getPostById(id);
    },

    async deletePost(id: string): Promise<NoodlePost | null> {
      const existing = await this.getPostById(id);
      if (!existing) return null;
      const interactions = await db.select().from(noodleInteractions).where(eq(noodleInteractions.postId, id));
      const slurpSourceAccountIds = new Set((await this.listAccounts()).map((account) => account.id));
      if (interactions.some((interaction) => !slurpSourceAccountIds.has(interaction.actorAccountId))) return null;
      const interactionIds = interactions.map((interaction) => interaction.id);
      const digests = await db.select().from(noodleActivityDigests);
      const relatedDigests = digests.filter(
        (digest) =>
          digest.sourcePostId === id ||
          (digest.sourceInteractionId !== null && interactionIds.includes(digest.sourceInteractionId)),
      );
      if (
        relatedDigests.some(
          (digest) => !parseStringArray(digest.accountIds).every((accountId) => slurpSourceAccountIds.has(accountId)),
        )
      ) {
        return null;
      }
      await db.transaction(async (tx) => {
        await tx.delete(noodlePostUnlocks).where(eq(noodlePostUnlocks.postId, id));
        await tx.delete(noodleInteractions).where(eq(noodleInteractions.postId, id));
        await tx.delete(noodleActivityDigests).where(eq(noodleActivityDigests.sourcePostId, id));
        await tx.delete(noodlePosts).where(eq(noodlePosts.id, id));
      });
      return existing;
    },

    async updateNoodlerPost(
      id: string,
      input: NoodlerPostUpdateInput,
      media?: { imageUrl: string; noodlerMediaPath: string },
    ): Promise<NoodlerManagedPost | null> {
      const imageChanged = Boolean(media || input.removeImage);
      const updated = await db.transaction(async (tx) => {
        const postRows = await tx.select().from(noodlePosts).where(eq(noodlePosts.id, id));
        const existing = postRows[0];
        if (!existing) return false;
        const authorRows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, existing.authorAccountId), eq(noodleAccounts.platform, "slurp")));
        if (!authorRows[0]) return false;
        const nextMetadata = updatePollMetadata(mapManagedPost(existing).metadata, input.poll);
        if (imageChanged) {
          for (const key of [
            "noodlerMediaPath",
            "imageGenerated",
            "imageProvider",
            "imageModel",
            "imageStyleProfileId",
            "imageGenerationFailed",
            "imageGenerationError",
            "imagePendingReview",
          ]) {
            delete nextMetadata[key];
          }
        }
        if (media) nextMetadata.noodlerMediaPath = media.noodlerMediaPath;
        if (input.removeImage || input.imageCrop === null) delete nextMetadata.imageCrop;
        else if (input.imageCrop !== undefined) nextMetadata.imageCrop = input.imageCrop;
        await tx
          .update(noodlePosts)
          .set({
            ...(input.title !== undefined && { title: input.title }),
            ...(input.content !== undefined && { content: input.content.trim().slice(0, 4000) }),
            ...(imageChanged && {
              imageUrl: media?.imageUrl ?? null,
              imagePrompt: null,
              imageClaimToken: null,
              imageClaimLeaseUntil: null,
            }),
            ...((imageChanged || input.imageCrop !== undefined || input.poll !== undefined) && {
              metadata: JSON.stringify(nextMetadata),
            }),
            updatedAt: now(),
          })
          .where(eq(noodlePosts.id, id));
        return true;
      });
      if (!updated) return null;
      return this.getNoodlerPostById(id);
    },

    async deleteNoodlerPost(id: string): Promise<NoodlerManagedPost | null> {
      const existing = await this.getNoodlerPostById(id);
      if (!existing) return null;
      const interactionRows = await db.select().from(noodleInteractions).where(eq(noodleInteractions.postId, id));
      const interactionIds = interactionRows.map((interaction) => interaction.id);
      await db.transaction(async (tx) => {
        await tx.delete(noodleActivityDigests).where(eq(noodleActivityDigests.sourcePostId, id));
        if (interactionIds.length > 0) {
          await tx
            .delete(noodleActivityDigests)
            .where(inArray(noodleActivityDigests.sourceInteractionId, interactionIds));
        }
        await tx.delete(noodlePostUnlocks).where(eq(noodlePostUnlocks.postId, id));
        await tx.delete(noodlerCreatorReplyClaims).where(eq(noodlerCreatorReplyClaims.postId, id));
        await tx.delete(noodleInteractions).where(eq(noodleInteractions.postId, id));
        await tx.delete(noodlePosts).where(eq(noodlePosts.id, id));
        await tx._fileStore.flush();
      });
      return existing;
    },

    async resetTimeline(): Promise<void> {
      const slurpSourceAccountIds = (await this.listAccounts()).map((account) => account.id);
      const publicPosts =
        slurpSourceAccountIds.length > 0
          ? await db.select().from(noodlePosts).where(inArray(noodlePosts.authorAccountId, slurpSourceAccountIds))
          : [];
      const publicPostIds = publicPosts.map((post) => post.id);
      const publicInteractions = await db
        .select()
        .from(noodleInteractions)
        .where(inArray(noodleInteractions.postId, publicPostIds));
      const slurpSourceAccountIdSet = new Set(slurpSourceAccountIds);
      const protectedPostIds = new Set(
        publicInteractions
          .filter((interaction) => !slurpSourceAccountIdSet.has(interaction.actorAccountId))
          .map((interaction) => interaction.postId),
      );
      const interactionPostById = new Map(
        publicInteractions.map((interaction) => [interaction.id, interaction.postId]),
      );
      const digests = await db.select().from(noodleActivityDigests);
      for (const digest of digests) {
        if (parseStringArray(digest.accountIds).every((accountId) => slurpSourceAccountIdSet.has(accountId))) continue;
        if (digest.sourcePostId && publicPostIds.includes(digest.sourcePostId)) {
          protectedPostIds.add(digest.sourcePostId);
        }
        if (digest.sourceInteractionId) {
          const postId = interactionPostById.get(digest.sourceInteractionId);
          if (postId) protectedPostIds.add(postId);
        }
      }
      const deletablePostIds = publicPostIds.filter((postId) => !protectedPostIds.has(postId));
      const deletableInteractionIds = publicInteractions
        .filter((interaction) => deletablePostIds.includes(interaction.postId))
        .map((interaction) => interaction.id);
      await db.transaction(async (tx) => {
        if (deletableInteractionIds.length > 0) {
          await tx
            .delete(noodleActivityDigests)
            .where(inArray(noodleActivityDigests.sourceInteractionId, deletableInteractionIds));
        }
        if (deletablePostIds.length > 0) {
          await tx.delete(noodleActivityDigests).where(inArray(noodleActivityDigests.sourcePostId, deletablePostIds));
          await tx.delete(noodleInteractions).where(inArray(noodleInteractions.postId, deletablePostIds));
          await tx.delete(noodlePosts).where(inArray(noodlePosts.id, deletablePostIds));
        }
        await tx.delete(noodleRefreshRuns);
      });
    },

    async listInteractions(postIds: string[] = []): Promise<NoodleInteraction[]> {
      if (postIds.length === 0) return [];
      const publicPostIds = new Set(
        (await Promise.all(postIds.map((postId) => this.getPostById(postId))))
          .filter((post): post is NoodlePost => post !== null)
          .map((post) => post.id),
      );
      if (publicPostIds.size === 0) return [];
      const slurpSourceAccountIds = new Set((await this.listAccounts()).map((account) => account.id));
      const rows = await db
        .select()
        .from(noodleInteractions)
        .where(inArray(noodleInteractions.postId, [...publicPostIds]))
        .orderBy(noodleInteractions.createdAt);
      return rows.filter((row) => slurpSourceAccountIds.has(row.actorAccountId)).map(mapInteraction);
    },

    async listRepliesByActorSince(actorAccountId: string, since: string, limit = 100): Promise<NoodleInteraction[]> {
      if (!(await this.getAccountById(actorAccountId))) return [];
      const slurpSourceAccountIds = (await this.listAccounts()).map((account) => account.id);
      if (slurpSourceAccountIds.length === 0) return [];
      const publicPostIds = new Set(
        (
          await db
            .select({ id: noodlePosts.id })
            .from(noodlePosts)
            .where(inArray(noodlePosts.authorAccountId, slurpSourceAccountIds))
        ).map((post) => post.id),
      );
      const rows = await db
        .select()
        .from(noodleInteractions)
        .where(
          and(
            eq(noodleInteractions.actorAccountId, actorAccountId),
            eq(noodleInteractions.type, "reply"),
            gt(noodleInteractions.createdAt, since),
          ),
        )
        .orderBy(desc(noodleInteractions.createdAt))
        .limit(Math.max(1, Math.min(200, Math.floor(limit))));
      return rows.filter((row) => publicPostIds.has(row.postId)).map(mapInteraction);
    },

    async getInteractionById(id: string): Promise<NoodleInteraction | null> {
      const rows = await db.select().from(noodleInteractions).where(eq(noodleInteractions.id, id));
      const row = rows[0];
      if (!row) return null;
      const [post, actor] = await Promise.all([this.getPostById(row.postId), this.getAccountById(row.actorAccountId)]);
      return post && actor ? mapInteraction(row) : null;
    },

    async updateInteraction(
      id: string,
      input: { content?: string | null; imageUrl?: string | null },
    ): Promise<NoodleInteraction | null> {
      const existing = await this.getInteractionById(id);
      if (!existing) return null;
      await db
        .update(noodleInteractions)
        .set({
          ...(input.content !== undefined && { content: input.content?.trim() || null }),
          ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl?.trim() || null }),
        })
        .where(eq(noodleInteractions.id, id));
      return this.getInteractionById(id);
    },

    async deleteInteractionById(id: string): Promise<NoodleInteraction[]> {
      const existing = await this.getInteractionById(id);
      if (!existing) return [];
      const rows = await db.select().from(noodleInteractions).where(eq(noodleInteractions.postId, existing.postId));
      const deletedIds = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const row of rows) {
          if (deletedIds.has(row.id) || !row.parentInteractionId || !deletedIds.has(row.parentInteractionId)) continue;
          deletedIds.add(row.id);
          changed = true;
        }
      }
      const deletedRows = rows.filter((row) => deletedIds.has(row.id));
      // The guard is "every actor in this subtree is an account this installation owns". A
      // creator reply is authored by a NoodleR stage account, so leaving those out made a
      // comment undeletable as soon as its creator answered it.
      const slurpSourceAccountIds = new Set((await this.listAccounts()).map((account) => account.id));
      const knownAccountIds = new Set([
        ...slurpSourceAccountIds,
        ...(await this.listNoodlerAccounts()).map((account) => account.id),
      ]);
      if (
        deletedRows.some(
          (row) =>
            !knownAccountIds.has(row.actorAccountId) && !row.actorAccountId.startsWith(NOODLER_FAN_IDENTITY_PREFIX),
        )
      ) {
        return [];
      }
      const relatedDigests = await db
        .select()
        .from(noodleActivityDigests)
        .where(inArray(noodleActivityDigests.sourceInteractionId, [...deletedIds]));
      if (
        relatedDigests.some(
          (digest) => !parseStringArray(digest.accountIds).every((accountId) => slurpSourceAccountIds.has(accountId)),
        )
      ) {
        return [];
      }
      await db.transaction(async (tx) => {
        await tx
          .delete(noodleActivityDigests)
          .where(inArray(noodleActivityDigests.sourceInteractionId, [...deletedIds]));
        // This is the route comment deletion actually takes, and the subtree it removes can
        // contain both a comment that owns a creator-reply claim and the reply that claim
        // points at. Either one left behind keeps consuming the rolling allowance forever.
        await tx
          .delete(noodlerCreatorReplyClaims)
          .where(inArray(noodlerCreatorReplyClaims.parentInteractionId, [...deletedIds]));
        await tx
          .delete(noodlerCreatorReplyClaims)
          .where(inArray(noodlerCreatorReplyClaims.replyInteractionId, [...deletedIds]));
        await tx.delete(noodleInteractions).where(inArray(noodleInteractions.id, [...deletedIds]));
      });
      return deletedRows.map(mapInteraction);
    },

    async createInteraction(postId: string, input: PublicCreateInteractionCommand): Promise<NoodleInteraction | null> {
      const parentInteractionId = input.parentInteractionId ?? null;
      if (input.type === "vote") {
        if (parentInteractionId) return null;
        const actor = await this.getAccountById(input.actorAccountId);
        if (!actor) return null;
        return upsertPollVote(
          postId,
          actor,
          actor.id,
          input.content?.trim() ?? "",
          "noodle",
          input.imageUrl?.trim() || null,
        );
      }

      const [post, actor] = await Promise.all([this.getPostById(postId), this.getAccountById(input.actorAccountId)]);
      if (!post || !actor) return null;

      if (parentInteractionId) {
        const parent = await this.getInteractionById(parentInteractionId);
        if (!parent || parent.postId !== postId || parent.type !== "reply") return null;
      }

      return insertInteraction(postId, {
        actor,
        type: input.type,
        content: input.content,
        imageUrl: input.imageUrl,
        parentInteractionId,
      });
    },

    async deleteInteraction(postId: string, input: PublicRemoveInteractionCommand): Promise<NoodleInteraction | null> {
      const post = await this.getPostById(postId);
      if (!post) return null;
      return deleteStoredInteraction(postId, input, "protect-public-digests");
    },

    // Callers pass post IDs already resolved from NoodleR-account queries
    // (listNoodlerPostsByAccounts), so this trusts them and issues a single bulk
    // read instead of re-validating each ID with getNoodlerPostById (2N reads).
    async listNoodlerInteractions(noodlerPostIds: string[] = []): Promise<NoodleInteraction[]> {
      if (noodlerPostIds.length === 0) return [];
      const rows = await db
        .select()
        .from(noodleInteractions)
        .where(inArray(noodleInteractions.postId, noodlerPostIds))
        .orderBy(noodleInteractions.createdAt);
      return rows.map(mapInteraction);
    },

    async claimNoodlerCreatorReply(
      creatorAccountId: string,
      postId: string,
      parentInteractionId: string,
      viewerPersonaId: string,
      viewerActorAccountId: string,
      at = now(),
      ceiling = DEFAULT_NOODLER_CREATOR_REPLIES_PER_24_HOURS,
    ): Promise<NoodlerCreatorReplyClaimResult> {
      const viewer = await this.getViewer(viewerPersonaId);
      if (!viewer) return { status: "ineligible" };
      const viewerActor =
        (await this.getNoodlerAccountById(viewerActorAccountId)) ??
        (viewerActorAccountId === viewerPersonaId ? viewer : null);
      if (!viewerActor) return { status: "ineligible" };
      return db.transaction(async (tx) => {
        const [creatorRows, parentRows] = await Promise.all([
          tx
            .select()
            .from(noodleAccounts)
            .where(and(eq(noodleAccounts.id, creatorAccountId), eq(noodleAccounts.platform, "slurp"))),
          tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, parentInteractionId)),
        ]);
        const creatorRow = creatorRows[0];
        const parentRow = parentRows[0];
        if (
          !creatorRow ||
          !parentRow ||
          parentRow.type !== "reply" ||
          (!parentRow.content?.trim() && !parentRow.imageUrl?.trim()) ||
          parentRow.postId !== postId ||
          ![viewerActor.id, viewerPersonaId].includes(parentRow.actorAccountId) ||
          (creatorRow.sourceKind === "persona" && creatorRow.sourceEntityId === viewerPersonaId) ||
          parentRow.actorAccountId === creatorAccountId
        ) {
          return { status: "ineligible" };
        }
        const postRows = await tx
          .select()
          .from(noodlePosts)
          .where(and(eq(noodlePosts.id, postId), eq(noodlePosts.authorAccountId, creatorAccountId)));
        const postRow = postRows[0];
        if (!postRow) return { status: "ineligible" };

        const creator = mapAccount(creatorRow);
        if (isNoodlerHiddenFromViewer(creator, viewerPersonaId)) return { status: "ineligible" };
        const post = mapManagedPost(postRow);
        const [subscriptions, unlocks] = await Promise.all([
          tx
            .select()
            .from(noodleAccountSubscriptions)
            .where(
              and(
                eq(noodleAccountSubscriptions.viewerAccountId, viewerPersonaId),
                eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId),
              ),
            ),
          tx
            .select()
            .from(noodlePostUnlocks)
            .where(and(eq(noodlePostUnlocks.viewerAccountId, viewerPersonaId), eq(noodlePostUnlocks.postId, post.id))),
        ]);
        if (
          !canViewNoodlerPost({
            post,
            subscribed: subscriptions.length > 0,
            unlockedPostIds: new Set(unlocks.map((unlock) => unlock.postId)),
          })
        ) {
          return { status: "ineligible" };
        }

        const cutoff = new Date(Date.parse(at) - ROLLING_DAY_MS).toISOString();
        // Prune only expired claims that never produced a reply. A claim that did is the
        // permanent "this comment already has a creator reply" key and must outlive the
        // budget window; an orphan one gates nothing once it leaves it.
        // Budget membership is `claimedAt > cutoff`, so anything not greater is outside the
        // window: pruning must use the exact complement or a claim sitting on the boundary is
        // neither counted nor released, and blocks its comment forever.
        const expiredOrphans = (await tx.select().from(noodlerCreatorReplyClaims)).filter(
          (row) => !row.replyInteractionId && !(row.claimedAt > cutoff),
        );
        if (expiredOrphans.length > 0) {
          await tx.delete(noodlerCreatorReplyClaims).where(
            inArray(
              noodlerCreatorReplyClaims.id,
              expiredOrphans.map((row) => row.id),
            ),
          );
        }
        // Duplicate detection runs after the eligibility and access checks above so a caller
        // replaying known IDs cannot read back a stored reply it is no longer entitled to,
        // and after the prune so an expired orphan claim does not block the same comment forever.
        const existingClaims = await tx
          .select()
          .from(noodlerCreatorReplyClaims)
          .where(
            and(
              eq(noodlerCreatorReplyClaims.parentInteractionId, parentInteractionId),
              eq(noodlerCreatorReplyClaims.creatorAccountId, creatorAccountId),
            ),
          );
        const existing = existingClaims[0];
        if (existing) {
          const replyRows = existing.replyInteractionId
            ? await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, existing.replyInteractionId))
            : [];
          return { status: "duplicate", interaction: replyRows[0] ? mapInteraction(replyRows[0]) : null };
        }
        // The reply can also outlive its claim if a crash lost the claim write. Reconcile against
        // the replies themselves so the comment cannot collect a second creator reply.
        const strandedReply = (
          await tx
            .select()
            .from(noodleInteractions)
            .where(
              and(
                eq(noodleInteractions.parentInteractionId, parentInteractionId),
                eq(noodleInteractions.actorAccountId, creatorAccountId),
                eq(noodleInteractions.type, "reply"),
              ),
            )
        )[0];
        if (strandedReply) {
          await tx.insert(noodlerCreatorReplyClaims).values({
            id: newId(),
            postId: post.id,
            parentInteractionId,
            creatorAccountId,
            replyInteractionId: strandedReply.id,
            claimedAt: at,
          });
          return { status: "duplicate", interaction: mapInteraction(strandedReply) };
        }

        const recentClaims = await tx
          .select()
          .from(noodlerCreatorReplyClaims)
          .where(gt(noodlerCreatorReplyClaims.claimedAt, cutoff));
        if (recentClaims.length >= ceiling) return { status: "exhausted" };

        const claimId = newId();
        await tx.insert(noodlerCreatorReplyClaims).values({
          id: claimId,
          postId: post.id,
          parentInteractionId,
          creatorAccountId,
          replyInteractionId: null,
          claimedAt: at,
        });
        return {
          status: "claimed",
          claimId,
          creator,
          post,
          parent: mapInteraction(parentRow),
          viewer: viewerActor,
        };
      });
    },

    /**
     * Release a claim whose generation never produced a reply. The claim is the dedupe key
     * for "this comment already has a creator reply", so keeping it after a failure would
     * block that comment forever; no provider call succeeded, so nothing is billed twice.
     */
    async releaseNoodlerCreatorReplyClaim(claimId: string): Promise<void> {
      await db.transaction(async (tx) => {
        const rows = await tx.select().from(noodlerCreatorReplyClaims).where(eq(noodlerCreatorReplyClaims.id, claimId));
        if (!rows[0] || rows[0].replyInteractionId) return;
        await tx.delete(noodlerCreatorReplyClaims).where(eq(noodlerCreatorReplyClaims.id, claimId));
      });
    },

    async finalizeNoodlerCreatorReplyClaim(claimId: string, content: string): Promise<NoodleInteraction | null> {
      return db.transaction(async (tx) => {
        const claimRows = await tx
          .select()
          .from(noodlerCreatorReplyClaims)
          .where(eq(noodlerCreatorReplyClaims.id, claimId));
        const claim = claimRows[0];
        if (!claim) return null;
        if (claim.replyInteractionId) {
          const existing = await tx
            .select()
            .from(noodleInteractions)
            .where(eq(noodleInteractions.id, claim.replyInteractionId));
          return existing[0] ? mapInteraction(existing[0]) : null;
        }
        const [creatorRows, parentRows, postRows] = await Promise.all([
          tx
            .select()
            .from(noodleAccounts)
            .where(and(eq(noodleAccounts.id, claim.creatorAccountId), eq(noodleAccounts.platform, "slurp"))),
          tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, claim.parentInteractionId)),
          tx.select().from(noodlePosts).where(eq(noodlePosts.id, claim.postId)),
        ]);
        const creatorRow = creatorRows[0];
        const parentRow = parentRows[0];
        const postRow = postRows[0];
        if (
          !creatorRow ||
          !parentRow ||
          !postRow ||
          parentRow.type !== "reply" ||
          parentRow.postId !== postRow.id ||
          postRow.authorAccountId !== creatorRow.id
        ) {
          return null;
        }
        const creator = mapAccount(creatorRow);
        const parentActorRows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, parentRow.actorAccountId), eq(noodleAccounts.platform, "slurp")));
        const viewerPersonaId =
          parentActorRows[0]?.sourceKind === "persona"
            ? (parentActorRows[0].sourceEntityId ?? parentRow.actorAccountId)
            : parentRow.actorAccountId;
        if (isNoodlerHiddenFromViewer(creator, viewerPersonaId)) return null;
        const post = mapManagedPost(postRow);
        const [subscriptions, unlocks] = await Promise.all([
          tx
            .select()
            .from(noodleAccountSubscriptions)
            .where(
              and(
                eq(noodleAccountSubscriptions.viewerAccountId, viewerPersonaId),
                eq(noodleAccountSubscriptions.creatorAccountId, creatorRow.id),
              ),
            ),
          tx
            .select()
            .from(noodlePostUnlocks)
            .where(
              and(eq(noodlePostUnlocks.viewerAccountId, viewerPersonaId), eq(noodlePostUnlocks.postId, postRow.id)),
            ),
        ]);
        if (
          !canViewNoodlerPost({
            post,
            subscribed: subscriptions.length > 0,
            unlockedPostIds: new Set(unlocks.map((unlock) => unlock.postId)),
          })
        ) {
          return null;
        }
        // Crash recovery: the reply row and the claim link are separate durable writes, so a
        // crash between them leaves a reply whose claim is still unlinked. Adopt that reply
        // instead of writing a second one — one reply per parent comment per creator.
        const orphanedReply = (
          await tx
            .select()
            .from(noodleInteractions)
            .where(
              and(
                eq(noodleInteractions.parentInteractionId, parentRow.id),
                eq(noodleInteractions.actorAccountId, creatorRow.id),
                eq(noodleInteractions.type, "reply"),
              ),
            )
        )[0];
        if (orphanedReply) {
          await tx
            .update(noodlerCreatorReplyClaims)
            .set({ replyInteractionId: orphanedReply.id })
            .where(eq(noodlerCreatorReplyClaims.id, claimId));
          return mapInteraction(orphanedReply);
        }
        const replyId = newId();
        await tx.insert(noodleInteractions).values({
          id: replyId,
          postId: postRow.id,
          parentInteractionId: parentRow.id,
          actorAccountId: creatorRow.id,
          type: "reply",
          content: content.trim(),
          imageUrl: null,
          actorSnapshot: JSON.stringify(snapshotForAccount(creator)),
          createdAt: now(),
        });
        await tx
          .update(noodlerCreatorReplyClaims)
          .set({ replyInteractionId: replyId })
          .where(eq(noodlerCreatorReplyClaims.id, claimId));
        const rows = await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, replyId));
        return rows[0] ? mapInteraction(rows[0]) : null;
      });
    },

    async createNoodlerInteraction(
      postId: string,
      input: NoodlerCreateInteractionCommand,
    ): Promise<NoodleInteraction | null> {
      const parentInteractionId = input.parentInteractionId ?? null;
      const viewer = await this.getViewer(input.viewerPersonaId);
      const actor = await this.getNoodlerAccountById(input.actorAccountId);
      if (
        !viewer ||
        !actor ||
        actor.kind !== "persona" ||
        actor.sourceKind !== "persona" ||
        actor.sourceEntityId !== input.viewerPersonaId
      ) {
        return null;
      }
      if (input.type === "vote") {
        if (parentInteractionId) return null;
        return upsertPollVote(postId, actor, input.viewerPersonaId, input.content?.trim() ?? "", "slurp", null);
      }
      return db.transaction(async (tx) => {
        const postRow = (await tx.select().from(noodlePosts).where(eq(noodlePosts.id, postId)))[0];
        if (!postRow) return null;
        const authorRow = (
          await tx
            .select()
            .from(noodleAccounts)
            .where(and(eq(noodleAccounts.id, postRow.authorAccountId), eq(noodleAccounts.platform, "slurp")))
        )[0];
        if (!authorRow) return null;
        const author = mapAccount(authorRow);
        if (
          actor.kind !== "persona" ||
          (author.sourceKind === "persona" && author.sourceEntityId === input.viewerPersonaId) ||
          isNoodlerHiddenFromViewer(author, input.viewerPersonaId)
        )
          return null;
        const subscribed =
          (
            await tx
              .select()
              .from(noodleAccountSubscriptions)
              .where(
                and(
                  eq(noodleAccountSubscriptions.viewerAccountId, input.viewerPersonaId),
                  eq(noodleAccountSubscriptions.creatorAccountId, author.id),
                ),
              )
          ).length > 0;
        const unlocked = await tx
          .select()
          .from(noodlePostUnlocks)
          .where(
            and(eq(noodlePostUnlocks.viewerAccountId, input.viewerPersonaId), eq(noodlePostUnlocks.postId, postId)),
          );
        if (
          !canViewNoodlerPost({
            post: mapPost(postRow),
            subscribed,
            unlockedPostIds: new Set(unlocked.map((row) => row.postId)),
          })
        )
          return null;
        if (isToggleInteractionType(input.type)) {
          await normalizeLegacyNoodlerToggleInteraction(tx, {
            postId,
            actorAccountId: actor.id,
            viewerPersonaId: input.viewerPersonaId,
            type: input.type,
            parentInteractionId,
            actor,
          });
        }
        if (parentInteractionId) {
          const parent = (
            await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, parentInteractionId))
          )[0];
          if (!parent || parent.postId !== postId || parent.type !== "reply") return null;
        }
        const id = newId();
        try {
          await tx.insert(noodleInteractions).values({
            id,
            postId,
            parentInteractionId,
            actorAccountId: actor.id,
            type: input.type,
            content: input.content?.trim() || null,
            imageUrl: null,
            actorSnapshot: JSON.stringify(snapshotForAccount(actor)),
            createdAt: now(),
          });
        } catch (error) {
          if (
            !isToggleInteractionType(input.type) ||
            !isFileUniqueConstraintError(error, "slurp_interactions", [
              "postId",
              "actorAccountId",
              "type",
              "parentInteractionId",
            ])
          )
            throw error;
          const existing = (
            await tx
              .select()
              .from(noodleInteractions)
              .where(
                and(
                  eq(noodleInteractions.postId, postId),
                  eq(noodleInteractions.actorAccountId, actor.id),
                  eq(noodleInteractions.type, input.type),
                  parentInteractionId
                    ? eq(noodleInteractions.parentInteractionId, parentInteractionId)
                    : isNull(noodleInteractions.parentInteractionId),
                ),
              )
          )[0];
          return existing ? mapInteraction(existing) : null;
        }
        const stored = (await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, id)))[0];
        return stored ? mapInteraction(stored) : null;
      });
    },

    async createNoodlerFanInteraction(
      postId: string,
      input: {
        id: string;
        creatorAccountId: string;
        actorId: string;
        actorSnapshot: NoodleAuthorSnapshot;
        runId: string;
        type: "like" | "reply" | "repost";
        content: string | null;
      },
    ): Promise<{ interaction: NoodleInteraction; created: boolean } | null> {
      return db.transaction(async (tx) => {
        const postRows = await tx.select().from(noodlePosts).where(eq(noodlePosts.id, postId));
        const postRow = postRows[0];
        if (
          !postRow ||
          (postRow.access !== "public" && postRow.access !== "locked") ||
          postRow.authorAccountId !== input.creatorAccountId
        ) {
          return null;
        }
        const creatorRows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, input.creatorAccountId), eq(noodleAccounts.platform, "slurp")));
        if (!creatorRows[0]) return null;
        const settings = normalizeSlurpSettings(await createAppSettingsStorage(tx).get(SLURP_SETTINGS_KEY));
        const creator = mapAccount(creatorRows[0]);
        const override = creator.settings.scheduler.fanActivity;
        if (!settings.fanActivityEnabled || override?.enabled === false) return null;

        const stateRows = await tx.select().from(noodlerFanActivityState);
        const plan = stateRows
          .flatMap((row) => {
            try {
              const parsed = parsePersistedNoodleFanActivityDayPlan(JSON.parse(row.plan));
              return parsed ? [parsed] : [];
            } catch {
              return [];
            }
          })
          .find((candidate) => candidate.runs.some((run) => run.id === input.runId));
        const run = plan?.runs.find((candidate) => candidate.id === input.runId);
        const creatorActivities =
          run?.acceptedActivities.filter((activity) => activity.creatorId === input.creatorAccountId) ?? [];
        if (
          run?.status !== "applying" ||
          creatorActivities.length > NOODLE_FAN_ACTIVITY_MAX_ACTIVITIES_PER_CREATOR ||
          !creatorActivities.some(
            (activity) =>
              activity.id === input.id &&
              activity.targetPostId === postId &&
              activity.actorId === input.actorId &&
              activity.type === input.type,
          )
        ) {
          return null;
        }

        const stableRows = await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, input.id));
        if (stableRows[0]) return { interaction: mapInteraction(stableRows[0]), created: false };

        const existingRows = await tx
          .select()
          .from(noodleInteractions)
          .where(
            and(
              eq(noodleInteractions.postId, postId),
              eq(noodleInteractions.actorAccountId, input.actorId),
              eq(noodleInteractions.type, input.type),
              isNull(noodleInteractions.parentInteractionId),
            ),
          );
        const content = input.type === "reply" ? input.content?.trim() || null : null;
        const duplicate = existingRows[0];
        if (duplicate) return { interaction: mapInteraction(duplicate), created: false };
        if (input.type === "reply" && !content) return null;

        await tx.insert(noodleInteractions).values({
          id: input.id,
          postId,
          parentInteractionId: null,
          actorAccountId: input.actorId,
          type: input.type,
          content,
          imageUrl: null,
          actorSnapshot: JSON.stringify(input.actorSnapshot),
          createdAt: now(),
        });
        const rows = await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, input.id));
        return rows[0] ? { interaction: mapInteraction(rows[0]), created: true } : null;
      });
    },

    async deleteNoodlerInteraction(
      postId: string,
      input: NoodlerRemoveInteractionCommand,
    ): Promise<NoodleInteraction | null> {
      const viewer = await this.getViewer(input.viewerPersonaId);
      const actor = await this.getNoodlerAccountById(input.actorAccountId);
      if (
        !viewer ||
        !actor ||
        actor.kind !== "persona" ||
        actor.sourceKind !== "persona" ||
        actor.sourceEntityId !== input.viewerPersonaId
      )
        return null;
      const parentInteractionId = input.parentInteractionId ?? null;
      return db.transaction(async (tx) => {
        const postRow = (await tx.select().from(noodlePosts).where(eq(noodlePosts.id, postId)))[0];
        if (!postRow) return null;
        const authorRow = (
          await tx
            .select()
            .from(noodleAccounts)
            .where(and(eq(noodleAccounts.id, postRow.authorAccountId), eq(noodleAccounts.platform, "slurp")))
        )[0];
        if (!authorRow) return null;
        const author = mapAccount(authorRow);
        if (
          (author.sourceKind === "persona" && author.sourceEntityId === input.viewerPersonaId) ||
          isNoodlerHiddenFromViewer(author, input.viewerPersonaId)
        )
          return null;
        const subscriptions = await tx
          .select()
          .from(noodleAccountSubscriptions)
          .where(
            and(
              eq(noodleAccountSubscriptions.viewerAccountId, input.viewerPersonaId),
              eq(noodleAccountSubscriptions.creatorAccountId, author.id),
            ),
          );
        const unlocks = await tx
          .select()
          .from(noodlePostUnlocks)
          .where(
            and(eq(noodlePostUnlocks.viewerAccountId, input.viewerPersonaId), eq(noodlePostUnlocks.postId, postId)),
          );
        if (
          !canViewNoodlerPost({
            post: mapPost(postRow),
            subscribed: subscriptions.length > 0,
            unlockedPostIds: new Set(unlocks.map((row) => row.postId)),
          })
        )
          return null;
        await normalizeLegacyNoodlerToggleInteraction(tx, {
          postId,
          actorAccountId: actor.id,
          viewerPersonaId: input.viewerPersonaId,
          type: input.type,
          parentInteractionId,
          actor,
        });
        const existing = (
          await tx
            .select()
            .from(noodleInteractions)
            .where(
              and(
                eq(noodleInteractions.postId, postId),
                eq(noodleInteractions.actorAccountId, actor.id),
                eq(noodleInteractions.type, input.type),
                parentInteractionId
                  ? eq(noodleInteractions.parentInteractionId, parentInteractionId)
                  : isNull(noodleInteractions.parentInteractionId),
              ),
            )
        )[0];
        if (!existing) return null;
        await deleteInteractionChildren(tx, existing.id);
        await tx.delete(noodleInteractions).where(eq(noodleInteractions.id, existing.id));
        return mapInteraction(existing);
      });
    },

    async createDigest(input: {
      accountIds: string[];
      content: string;
      sourceRunId?: string | null;
      sourcePostId?: string | null;
      sourceInteractionId?: string | null;
    }): Promise<NoodleDigestEntry> {
      const id = newId();
      const uniqueAccountIds = Array.from(new Set(input.accountIds.filter(Boolean)));
      const slurpSourceAccountIds = new Set((await this.listAccounts()).map((account) => account.id));
      if (!uniqueAccountIds.every((accountId) => slurpSourceAccountIds.has(accountId))) {
        throw new Error("Public Noodle digests cannot reference NoodleR accounts.");
      }
      await db.transaction(async (tx) => {
        if (input.sourceInteractionId) {
          const existingDigests = await tx
            .select()
            .from(noodleActivityDigests)
            .where(eq(noodleActivityDigests.sourceInteractionId, input.sourceInteractionId));
          const publicDigestIds = existingDigests
            .filter((digest) =>
              parseStringArray(digest.accountIds).every((accountId) => slurpSourceAccountIds.has(accountId)),
            )
            .map((digest) => digest.id);
          if (publicDigestIds.length > 0) {
            await tx.delete(noodleActivityDigests).where(inArray(noodleActivityDigests.id, publicDigestIds));
          }
        }
        await tx.insert(noodleActivityDigests).values({
          id,
          accountIds: JSON.stringify(uniqueAccountIds),
          content: input.content.trim().slice(0, 1200),
          sourceRunId: input.sourceRunId ?? null,
          sourcePostId: input.sourcePostId ?? null,
          sourceInteractionId: input.sourceInteractionId ?? null,
          createdAt: now(),
        });
      });
      const rows = await db.select().from(noodleActivityDigests).where(eq(noodleActivityDigests.id, id));
      return mapDigest(rows[0]!);
    },

    async updateDigest(
      id: string,
      input: { accountIds: string[]; content: string },
    ): Promise<NoodleDigestEntry | null> {
      const uniqueAccountIds = Array.from(new Set(input.accountIds.filter(Boolean)));
      const existingRows = await db.select().from(noodleActivityDigests).where(eq(noodleActivityDigests.id, id));
      const existing = existingRows[0];
      if (!existing) return null;
      const slurpSourceAccountIds = new Set((await this.listAccounts()).map((account) => account.id));
      if (
        !parseStringArray(existing.accountIds).every((accountId) => slurpSourceAccountIds.has(accountId)) ||
        !uniqueAccountIds.every((accountId) => slurpSourceAccountIds.has(accountId))
      ) {
        return null;
      }
      await db
        .update(noodleActivityDigests)
        .set({
          accountIds: JSON.stringify(uniqueAccountIds),
          content: input.content.trim().slice(0, 1200),
        })
        .where(eq(noodleActivityDigests.id, id));
      const rows = await db.select().from(noodleActivityDigests).where(eq(noodleActivityDigests.id, id));
      return rows[0] ? mapDigest(rows[0]) : null;
    },

    async listDigests(options: { limit?: number; since?: string } = {}): Promise<NoodleDigestEntry[]> {
      const limit = Math.max(1, Math.min(200, Math.floor(options.limit ?? 80)));
      const fetchLimit = 200;
      const rows = options.since
        ? await db
            .select()
            .from(noodleActivityDigests)
            .where(gt(noodleActivityDigests.createdAt, options.since))
            .orderBy(desc(noodleActivityDigests.createdAt))
            .limit(fetchLimit)
        : await db
            .select()
            .from(noodleActivityDigests)
            .orderBy(desc(noodleActivityDigests.createdAt))
            .limit(fetchLimit);

      const sourcePostIds = Array.from(new Set(rows.flatMap((row) => (row.sourcePostId ? [row.sourcePostId] : []))));
      const sourceInteractionIds = Array.from(
        new Set(rows.flatMap((row) => (row.sourceInteractionId ? [row.sourceInteractionId] : []))),
      );
      const [sourcePosts, sourceInteractions] = await Promise.all([
        sourcePostIds.length > 0
          ? db.select().from(noodlePosts).where(inArray(noodlePosts.id, sourcePostIds))
          : Promise.resolve([]),
        sourceInteractionIds.length > 0
          ? db.select().from(noodleInteractions).where(inArray(noodleInteractions.id, sourceInteractionIds))
          : Promise.resolve([]),
      ]);
      const sourcePostById = new Map(sourcePosts.map((post) => [post.id, post]));
      const sourceInteractionById = new Map(sourceInteractions.map((interaction) => [interaction.id, interaction]));
      const slurpSourceAccountIds = new Set((await this.listAccounts()).map((account) => account.id));

      return rows
        .filter((row) => {
          const digest = mapDigest(row);
          if (!digest.accountIds.every((accountId) => slurpSourceAccountIds.has(accountId))) return false;
          if (row.sourceInteractionId) {
            const interaction = sourceInteractionById.get(row.sourceInteractionId);
            if (!interaction || !slurpSourceAccountIds.has(interaction.actorAccountId)) return false;
            const sourcePost = sourcePostById.get(interaction.postId);
            return Boolean(sourcePost && slurpSourceAccountIds.has(sourcePost.authorAccountId));
          }
          // Older model-authored summaries had only a refresh-run reference,
          // so there is no way to invalidate them when their source post or
          // comment is deleted. Deterministic event digests supersede them.
          if (row.sourceRunId && !row.sourcePostId) return false;
          if (!row.sourcePostId) return true;
          const sourcePost = sourcePostById.get(row.sourcePostId);
          if (!sourcePost || !slurpSourceAccountIds.has(sourcePost.authorAccountId)) return false;
          // Digests created before source_interaction_id existed cannot be tied
          // safely to a still-live comment. Keep only the post's canonical digest;
          // stale legacy comment digests must never re-enter generation context.
          return parseRecord(sourcePost.metadata).activityDigestId === row.id;
        })
        .slice(0, limit)
        .map(mapDigest);
    },

    async createRefreshRun(input: { activeAccountIds: string[]; prompt: string }): Promise<NoodleRefreshRun> {
      const timestamp = now();
      const id = newId();
      await db.insert(noodleRefreshRuns).values({
        id,
        status: "running",
        activeAccountIds: JSON.stringify(input.activeAccountIds),
        prompt: input.prompt,
        result: null,
        error: null,
        attempts: "[]",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      const rows = await db.select().from(noodleRefreshRuns).where(eq(noodleRefreshRuns.id, id));
      return mapRefreshRun(rows[0]!);
    },

    async listRefreshRuns(options: { limit?: number; status?: NoodleRefreshRun["status"] } = {}) {
      const limit = Math.max(1, Math.min(20, Math.floor(options.limit ?? 5)));
      const baseQuery = db.select().from(noodleRefreshRuns);
      const rows = options.status
        ? await baseQuery
            .where(eq(noodleRefreshRuns.status, options.status))
            .orderBy(desc(noodleRefreshRuns.createdAt))
            .limit(limit)
        : await baseQuery.orderBy(desc(noodleRefreshRuns.createdAt)).limit(limit);
      return rows.map(mapRefreshRun);
    },

    async recordRefreshAttempt(id: string, attempt: NoodleRefreshAttempt): Promise<NoodleRefreshRun | null> {
      const rows = await db.select().from(noodleRefreshRuns).where(eq(noodleRefreshRuns.id, id));
      const current = rows[0];
      if (!current) return null;
      await db
        .update(noodleRefreshRuns)
        .set({
          attempts: JSON.stringify([...parseRefreshAttempts(current.attempts), attempt]),
          updatedAt: now(),
        })
        .where(eq(noodleRefreshRuns.id, id));
      const updatedRows = await db.select().from(noodleRefreshRuns).where(eq(noodleRefreshRuns.id, id));
      return updatedRows[0] ? mapRefreshRun(updatedRows[0]) : null;
    },

    async finishRefreshRun(
      id: string,
      patch: { status: "completed" | "failed"; result?: string | null; error?: string | null },
    ): Promise<NoodleRefreshRun | null> {
      await db
        .update(noodleRefreshRuns)
        .set({
          status: patch.status,
          result: patch.result ?? null,
          error: patch.error ?? null,
          updatedAt: now(),
        })
        .where(eq(noodleRefreshRuns.id, id));
      const rows = await db.select().from(noodleRefreshRuns).where(eq(noodleRefreshRuns.id, id));
      const finished = rows[0] ? mapRefreshRun(rows[0]) : null;
      // Retention cleanup is best-effort: never let a pruning failure make the
      // caller treat already-completed generation work as failed and retry it.
      try {
        await pruneFinishedRefreshRuns();
      } catch (error) {
        console.error("Noodle refresh-run retention cleanup failed", error);
      }
      return finished;
    },

    async subscribe(viewerAccountId: string, creatorAccountId: string): Promise<NoodleAccountSubscription | null> {
      if (viewerAccountId === creatorAccountId) return null;
      const run = viewerSettingsUpdateQueue.then(async () => {
        const viewer = await this.getViewer(viewerAccountId);
        if (!viewer) return null;
        return db.transaction(async (tx) => {
          const creatorRows = await tx
            .select()
            .from(noodleAccounts)
            .where(and(eq(noodleAccounts.id, creatorAccountId), eq(noodleAccounts.platform, "slurp")));
          const creator = creatorRows[0] ? mapAccount(creatorRows[0]) : null;
          if (
            !creator ||
            (creator.sourceKind === "persona" && creator.sourceEntityId === viewerAccountId) ||
            isNoodlerHiddenFromViewer(creator, viewerAccountId)
          )
            return null;
          const existing = await tx
            .select()
            .from(noodleAccountSubscriptions)
            .where(
              and(
                eq(noodleAccountSubscriptions.viewerAccountId, viewerAccountId),
                eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId),
              ),
            );
          if (existing[0]) {
            const followingAccountIds = viewer.settings.social.followingAccountIds ?? [];
            const followingAccountTimestamps = { ...viewer.settings.social.followingAccountTimestamps };
            if (!followingAccountIds.includes(creatorAccountId)) {
              followingAccountTimestamps[creatorAccountId] ??= existing[0].createdAt;
              await createAppSettingsStorage(tx).set(
                slurpViewerSettingsKey(viewerAccountId),
                JSON.stringify({
                  ...viewer.settings,
                  social: {
                    ...viewer.settings.social,
                    followingAccountIds: [...followingAccountIds, creatorAccountId],
                    followingAccountTimestamps,
                  },
                }),
              );
            }
            return mapSubscription(existing[0]);
          }
          const timestamp = now();
          const followingAccountIds = viewer.settings.social.followingAccountIds ?? [];
          const followingAccountTimestamps = { ...viewer.settings.social.followingAccountTimestamps };
          followingAccountTimestamps[creatorAccountId] ??= timestamp;
          const nextViewerSettings: NoodleAccountSettings = {
            ...viewer.settings,
            social: {
              ...viewer.settings.social,
              followingAccountIds: followingAccountIds.includes(creatorAccountId)
                ? followingAccountIds
                : [...followingAccountIds, creatorAccountId],
              followingAccountTimestamps,
            },
          };
          // A duplicate row means the subscription already existed, so this path stays idempotent.
          try {
            await tx.insert(noodleAccountSubscriptions).values({
              id: newId(),
              viewerAccountId,
              creatorAccountId,
              createdAt: timestamp,
            });
          } catch (error) {
            if (
              !isFileUniqueConstraintError(error, "slurp_account_subscriptions", [
                "viewerAccountId",
                "creatorAccountId",
              ])
            ) {
              throw error;
            }
            const duplicate = await tx
              .select()
              .from(noodleAccountSubscriptions)
              .where(
                and(
                  eq(noodleAccountSubscriptions.viewerAccountId, viewerAccountId),
                  eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId),
                ),
              );
            return duplicate[0] ? mapSubscription(duplicate[0]) : null;
          }
          await createAppSettingsStorage(tx).set(
            slurpViewerSettingsKey(viewerAccountId),
            JSON.stringify(nextViewerSettings),
          );
          const rows = await tx
            .select()
            .from(noodleAccountSubscriptions)
            .where(
              and(
                eq(noodleAccountSubscriptions.viewerAccountId, viewerAccountId),
                eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId),
              ),
            );
          return rows[0] ? mapSubscription(rows[0]) : null;
        });
      });
      viewerSettingsUpdateQueue = run.catch(() => undefined);
      return run;
    },

    async unsubscribe(viewerAccountId: string, creatorAccountId: string): Promise<void> {
      await db
        .delete(noodleAccountSubscriptions)
        .where(
          and(
            eq(noodleAccountSubscriptions.viewerAccountId, viewerAccountId),
            eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId),
          ),
        );
    },

    async listSubscriptionsForViewer(viewerAccountId: string): Promise<NoodleAccountSubscription[]> {
      const rows = await db
        .select()
        .from(noodleAccountSubscriptions)
        .where(eq(noodleAccountSubscriptions.viewerAccountId, viewerAccountId));
      return rows.map(mapSubscription);
    },

    async listSubscriptionsForCreator(creatorAccountId: string): Promise<NoodleAccountSubscription[]> {
      const rows = await db
        .select()
        .from(noodleAccountSubscriptions)
        .where(eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId))
        .orderBy(desc(noodleAccountSubscriptions.createdAt));
      return rows.map(mapSubscription);
    },

    async listSubscriptionsForCreatorPage(
      creatorAccountId: string,
      cursor: NoodlerPostPageCursor | null,
      limit: number,
    ) {
      const boundedLimit = Math.max(1, Math.min(20, Math.floor(limit)));
      const base = eq(noodleAccountSubscriptions.creatorAccountId, creatorAccountId);
      const rows = await db
        .select()
        .from(noodleAccountSubscriptions)
        .where(
          and(
            base,
            cursor
              ? or(
                  lt(noodleAccountSubscriptions.createdAt, cursor.createdAt),
                  and(
                    eq(noodleAccountSubscriptions.createdAt, cursor.createdAt),
                    lt(noodleAccountSubscriptions.id, cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(noodleAccountSubscriptions.createdAt), desc(noodleAccountSubscriptions.id))
        .limit(boundedLimit + 1);
      const items = rows.slice(0, boundedLimit).map(mapSubscription);
      const last = rows.slice(0, boundedLimit).at(-1);
      return {
        items,
        total: db.count(noodleAccountSubscriptions, base),
        nextCursor: rows.length > boundedLimit && last ? { createdAt: last.createdAt, id: last.id } : null,
      };
    },

    async unlockPost(viewerAccountId: string, postId: string): Promise<NoodlePostUnlock | null> {
      const viewer = await this.getViewer(viewerAccountId);
      if (!viewer) return null;
      return db.transaction(async (tx) => {
        const postRows = await tx.select().from(noodlePosts).where(eq(noodlePosts.id, postId));
        const postRow = postRows[0];
        if (!postRow || mapPost(postRow).access !== "locked") {
          return null;
        }
        const authorRows = await tx
          .select()
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, postRow.authorAccountId), eq(noodleAccounts.platform, "slurp")));
        const author = authorRows[0] ? mapAccount(authorRows[0]) : null;
        if (
          !author ||
          (author.sourceKind === "persona" && author.sourceEntityId === viewerAccountId) ||
          isNoodlerHiddenFromViewer(author, viewerAccountId)
        ) {
          return null;
        }
        const existing = await tx
          .select()
          .from(noodlePostUnlocks)
          .where(and(eq(noodlePostUnlocks.viewerAccountId, viewerAccountId), eq(noodlePostUnlocks.postId, postId)));
        if (existing[0]) return mapPostUnlock(existing[0]);
        const timestamp = now();
        // An already-unlocked post stays idempotent.
        try {
          await tx.insert(noodlePostUnlocks).values({ id: newId(), viewerAccountId, postId, createdAt: timestamp });
        } catch (error) {
          if (!isFileUniqueConstraintError(error, "slurp_post_unlocks", ["viewerAccountId", "postId"])) throw error;
          const duplicate = await tx
            .select()
            .from(noodlePostUnlocks)
            .where(and(eq(noodlePostUnlocks.viewerAccountId, viewerAccountId), eq(noodlePostUnlocks.postId, postId)));
          return duplicate[0] ? mapPostUnlock(duplicate[0]) : null;
        }
        // Unlocking no longer touches viewer settings at all: there is nothing to debit.
        const rows = await tx
          .select()
          .from(noodlePostUnlocks)
          .where(and(eq(noodlePostUnlocks.viewerAccountId, viewerAccountId), eq(noodlePostUnlocks.postId, postId)));
        return rows[0] ? mapPostUnlock(rows[0]) : null;
      });
    },

    async listPostUnlocksForViewer(viewerAccountId: string): Promise<NoodlePostUnlock[]> {
      const rows = await db
        .select()
        .from(noodlePostUnlocks)
        .where(eq(noodlePostUnlocks.viewerAccountId, viewerAccountId));
      return rows.map(mapPostUnlock);
    },

    async bootstrap(): Promise<SlurpBootstrap> {
      const posts = await this.listPosts({ limit: 160 });
      const scheduler = noodleRefreshSchedulerStatus(await this.ensureRefreshSchedule(new Date()), new Date());
      return {
        settings: await this.getSettings(),
        scheduler,
        accounts: await this.listAccounts(),
        posts,
        interactions: await this.listInteractions(posts.map((post) => post.id)),
        digests: await this.listDigests({ limit: 80 }),
      };
    },
  };
}
