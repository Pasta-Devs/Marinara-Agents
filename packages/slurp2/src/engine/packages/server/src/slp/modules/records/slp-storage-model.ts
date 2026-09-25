import { normalizeAvatarCrop, AvatarCrop } from "@marinara-engine/shared";
import { normalizeSlurpCreatorStrategy } from "../creators/slp-creator-strategy.js";
import { SLURP_STAGE_FACT_MAX_LENGTH } from "../creators/slp-stage-profile-repair.js";
import {
  SlpCreateInteractionInput,
  SlpCreatorCreateInteractionInput,
  SlpCreatorRemoveInteractionInput,
  SlpRemoveInteractionInput,
} from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import {
  slpAccountPrivacySettingsSchema,
  slpAccountProfileSettingsSchema,
  slpAccountSocialSettingsSchema,
  slpCreatorFanActivitySettingsSchema,
} from "../../../../../shared/src/slp/slp-social.schema.js";
import {
  SlpAccount,
  SlpAccountKind,
  SlpAccountSchedulerSettings,
  SlpAccountSettings,
  SlpAuthorSnapshot,
  SlpCreatorManagedPost,
  SlpCreatorManagedStageProfile,
  SlpInteraction,
  SlpInteractionType,
  SlpPostAccess,
  SlpPostSource,
  SlpRefreshAttempt,
} from "../../../../../shared/src/slp/slp-social.types.js";
import { slurpDiscoveryFields, SlurpDiscoveryGender } from "../discovery/slp-discovery-profile.js";
import { SLURP_DEFAULT_ECONOMY } from "../economy/slp-wallet.js";
import type {
  slpAccounts,
  slpAccountSubscriptions,
  slpActivityDigests,
  slpInteractions,
  slpPosts,
  slpPostUnlocks,
  slpRefreshRuns,
} from "../../../db/schema/slurp.js";
import type { SlpCreatorPostSortKey } from "../feed/slp-post-page.js";
import type { SlurpSettings } from "../settings/slp-settings.js";

export type SlpCreatorPostPageCursor = SlpCreatorPostSortKey;

export type SlurpSourceKind = "character" | "persona";

export type SlurpSlpAccountSettings = Omit<SlpAccountSettings, "profile"> & {
  profile: SlpAccountSettings["profile"] & {
    gender: SlurpDiscoveryGender | null;
    tags: string[];
  };
};

export type SlurpManagedStageProfile = SlpCreatorManagedStageProfile & {
  gender: SlurpDiscoveryGender | null;
  tags: string[];
};

export type SlurpAccount = Omit<SlpAccount, "settings"> & {
  settings: SlurpSlpAccountSettings;
  sourceKind: SlurpSourceKind;
  sourceEntityId: string;
};

export type SlpCreatorPostPageOptions = {
  accountIds: string[];
  creatorSearchAccountIds?: string[];
  readableContentAccountIds?: string[];
  unlockedPostIds?: string[];
  search?: string;
  mediaOnly?: boolean;
  readableOnly?: boolean;
  cursor?: SlpCreatorPostPageCursor | null;
  limit: number;
};

export type SlpCreatorStoryQueryOptions = {
  accountIds: string[];
  creatorSearchAccountIds?: string[];
  search?: string;
  since: string;
};

export type SlpCreatorPreparedPostPayload = {
  title: string | null;
  content: string;
  access: SlpPostAccess;
  imagePrompt: string | null;
  /** The project chosen when the post was prepared, carried through to publication. */
  projectId?: string | null;
  projectChapter?: string | null;
  metadata: Record<string, unknown>;
};

export type SlpCreatorPreparedPostState = "scheduled" | "prepared" | "published" | "discarded";

export type SlpCreatorPreparedImageState = "none" | "pending" | "generating" | "attached" | "rejected" | "closed";

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

export function slpCreatorReservePolicyFingerprint(
  account: SlurpAccount,
  settings?: Pick<
    SlurpSettings,
    | "imageGenerationPrompt"
    | "imagePromptInterpretation"
    | "imageGenerationUseAvatarReferences"
    | "imageGenerationIncludeDescriptions"
    | "appearanceProfileMode"
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
        imagePromptInterpretation: settings.imagePromptInterpretation,
        imageGenerationUseAvatarReferences: settings.imageGenerationUseAvatarReferences,
        imageGenerationIncludeDescriptions: settings.imageGenerationIncludeDescriptions,
        appearanceProfileMode: settings.appearanceProfileMode,
        enableImageInterpretation: settings.enableImageInterpretation,
        nightQuiet: settings.nightQuiet,
      }
    : null;
  return JSON.stringify({
    sourceKind: account.sourceKind,
    sourceId: account.sourceEntityId,
    sourceUpdatedAt: sourceUpdatedAt ?? null,
    stageProfileUpdatedAt: account.updatedAt,
    disclosure: account.settings.privacy.identityDisclosure ?? "open",
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
export function remapCreatorReservePolicyFingerprint(
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

export type AccountRow = typeof slpAccounts.$inferSelect;

export type PostRow = typeof slpPosts.$inferSelect;

export type InteractionRow = typeof slpInteractions.$inferSelect;

export type DigestRow = typeof slpActivityDigests.$inferSelect;

export type RefreshRunRow = typeof slpRefreshRuns.$inferSelect;

export type SubscriptionRow = typeof slpAccountSubscriptions.$inferSelect;

export type PostUnlockRow = typeof slpPostUnlocks.$inferSelect;

export type PublicCreateInteractionCommand = Omit<SlpCreateInteractionInput, "actorKind" | "actorEntityId"> & {
  actorAccountId: string;
};

export type PublicRemoveInteractionCommand = Omit<SlpRemoveInteractionInput, "actorKind" | "actorEntityId"> & {
  actorAccountId: string;
};

export type SlpCreatorCreateInteractionCommand = Omit<SlpCreatorCreateInteractionInput, "personaId"> & {
  actorAccountId: string;
  viewerPersonaId: string;
};

export type SlpCreatorRemoveInteractionCommand = Omit<SlpCreatorRemoveInteractionInput, "personaId"> & {
  actorAccountId: string;
  viewerPersonaId: string;
};

export type DeleteStoredInteractionCommand = {
  actorAccountId: string;
  type: "like" | "repost";
  parentInteractionId?: string | null;
};

export type InsertInteractionCommand = {
  actor: SlpAccount;
  type: SlpInteractionType;
  content?: string | null;
  imageUrl?: string | null;
  parentInteractionId: string | null;
};

export type SlurpAccountRole = "creator" | "viewer";

export type SlpCreatorWorldInteractionInput = {
  creatorAccountId: string;
  actorId: string;
  type: "like" | "reply" | "repost";
  content: string | null;
};

export type SlpCreatorPostPersistenceInput = {
  /** Optional caller-supplied id so a serving URL can be derived before the row is inserted. */
  id?: string;
  authorAccountId: string;
  title?: string | null;
  content: string;
  source?: SlpPostSource;
  access?: SlpPostAccess;
  metadata?: Record<string, unknown>;
  imageUrl?: string | null;
  imagePrompt?: string | null;
  /** The project this post was published into, and the chapter it was on. See `slurp-project.ts`. */
  projectId?: string | null;
  projectChapter?: string | null;
};

export type SlpCreatorReplyClaimResult =
  | {
      status: "claimed";
      claimId: string;
      creator: SlpAccount;
      post: SlpCreatorManagedPost;
      parent: SlpInteraction;
      viewer: SlpAccount;
    }
  | { status: "duplicate"; interaction: SlpInteraction | null }
  | { status: "exhausted" }
  | { status: "ineligible" };

export function parseRecord(value: unknown): Record<string, unknown> {
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

export function emptySlpAccountSettings(): SlurpSlpAccountSettings {
  return {
    profile: { gender: null, tags: [] },
    social: {},
    scheduler: { autoPosting: defaultAutoPostingSettings() },
    privacy: { access: { hiddenFromAccountIds: [] } },
    wallet: { coins: SLURP_DEFAULT_ECONOMY.startingCoins },
  };
}

export function defaultAutoPostingSettings(): NonNullable<SlpAccountSchedulerSettings["autoPosting"]> {
  return { enabled: false, imagesEnabled: false };
}

export function normalizeScheduler(value: unknown): SlpAccountSchedulerSettings {
  const defaults = defaultAutoPostingSettings();
  const scheduler = parseRecord(value);
  const raw = parseRecord(scheduler.autoPosting);
  const fanActivity = slpCreatorFanActivitySettingsSchema.safeParse(scheduler.fanActivity);
  return {
    autoPosting: {
      enabled: typeof raw.enabled === "boolean" ? raw.enabled : defaults.enabled,
      imagesEnabled: typeof raw.imagesEnabled === "boolean" ? raw.imagesEnabled : defaults.imagesEnabled,
    },
    ...(fanActivity.success && { fanActivity: fanActivity.data }),
  };
}

export function nestedOrLegacy(nested: Record<string, unknown>, legacy: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(nested, key) ? nested[key] : legacy[key];
}

export function normalizePersistedBoolean(value: unknown): boolean | undefined {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

export function normalizePersistedInteger(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export function validProfileField(key: string, value: unknown): SlpAccountSettings["profile"] {
  if (value === undefined) return {};
  const parsed = slpAccountProfileSettingsSchema.safeParse({ [key]: value });
  return parsed.success ? parsed.data : {};
}

export function validSocialField(key: string, value: unknown): SlpAccountSettings["social"] {
  if (value === undefined) return {};
  const parsed = slpAccountSocialSettingsSchema.safeParse({ [key]: value });
  return parsed.success ? parsed.data : {};
}

export function validPrivacyField(key: string, value: unknown): SlpAccountSettings["privacy"] {
  const empty = { access: { hiddenFromAccountIds: [] } };
  if (value === undefined) return empty;
  const parsed = slpAccountPrivacySettingsSchema.safeParse({ [key]: value });
  return parsed.success ? parsed.data : empty;
}

export function normalizeSlpAccountSettings(value: unknown): SlurpSlpAccountSettings {
  const raw = parseRecord(value);
  const rawProfile = parseRecord(raw.profile);
  const rawSocial = parseRecord(raw.social);
  const rawPrivacy = parseRecord(raw.privacy);
  const rawWallet = parseRecord(raw.wallet);
  const rawStage = parseRecord(raw.stage);
  const rawAppearanceProfile = parseRecord(raw.appearanceProfile);
  const rawAvatarCrop = nestedOrLegacy(rawProfile, raw, "avatarCrop");
  const rawBannerUrl = nestedOrLegacy(rawProfile, raw, "bannerUrl");
  const rawLocation = nestedOrLegacy(rawProfile, raw, "location");
  const rawProfileGenerated = nestedOrLegacy(rawProfile, raw, "profileGenerated");
  const rawProfileManuallyEdited = nestedOrLegacy(rawProfile, raw, "profileManuallyEdited");
  const rawCreatorWizardExecutionId = rawProfile.noodlerWizardExecutionId;
  const rawCreatorSourceSnapshot = rawProfile.noodlerSourceSnapshot;
  const rawFollowingAccountIds = nestedOrLegacy(rawSocial, raw, "followingAccountIds");
  const rawFollowingAccountTimestamps = nestedOrLegacy(rawSocial, raw, "followingAccountTimestamps");
  const rawNotificationsReadAt = nestedOrLegacy(rawSocial, raw, "notificationsReadAt");
  const rawCreatorFeedSeenAt = nestedOrLegacy(rawSocial, raw, "noodlerFeedSeenAt");
  const rawSlpFeedSeenAt = nestedOrLegacy(rawSocial, raw, "noodleFeedSeenAt");
  const rawIdentityDisclosure = nestedOrLegacy(rawPrivacy, raw, "identityDisclosure");
  const rawStagePersonality = nestedOrLegacy(rawPrivacy, raw, "stagePersonality");
  const rawAccess = parseRecord(rawPrivacy.access);
  const normalizedAvatarCrop = rawAvatarCrop === null ? null : normalizeAvatarCrop(rawAvatarCrop);
  const discovery = slurpDiscoveryFields(rawProfile);
  const profile = {
    ...(rawAvatarCrop !== undefined &&
      (rawAvatarCrop === null || normalizedAvatarCrop !== null) && { avatarCrop: normalizedAvatarCrop }),
    ...(rawBannerUrl !== undefined && validProfileField("bannerUrl", rawBannerUrl)),
    ...(rawLocation !== undefined && validProfileField("location", rawLocation)),
    ...(rawProfileGenerated !== undefined &&
      validProfileField("profileGenerated", normalizePersistedBoolean(rawProfileGenerated))),
    ...(rawProfileManuallyEdited !== undefined &&
      validProfileField("profileManuallyEdited", normalizePersistedBoolean(rawProfileManuallyEdited))),
    ...(rawCreatorWizardExecutionId !== undefined &&
      validProfileField("noodlerWizardExecutionId", rawCreatorWizardExecutionId)),
    ...(rawCreatorSourceSnapshot !== undefined && validProfileField("noodlerSourceSnapshot", rawCreatorSourceSnapshot)),
    ...discovery,
  };
  const followingAccountTimestamps = Object.fromEntries(
    Object.entries(parseRecord(rawFollowingAccountTimestamps)).filter(
      ([accountId, timestamp]) =>
        slpAccountSocialSettingsSchema.safeParse({ followingAccountTimestamps: { [accountId]: timestamp } }).success,
    ),
  );
  const social = {
    ...(rawFollowingAccountIds !== undefined &&
      validSocialField("followingAccountIds", parseStringArray(rawFollowingAccountIds))),
    ...(rawFollowingAccountTimestamps !== undefined &&
      validSocialField("followingAccountTimestamps", followingAccountTimestamps)),
    ...(rawNotificationsReadAt !== undefined && validSocialField("notificationsReadAt", rawNotificationsReadAt)),
    ...(rawCreatorFeedSeenAt !== undefined && validSocialField("noodlerFeedSeenAt", rawCreatorFeedSeenAt)),
    ...(rawSlpFeedSeenAt !== undefined && validSocialField("noodleFeedSeenAt", rawSlpFeedSeenAt)),
  };
  const privacy = {
    // Slurp no longer offers Secret. A stored Secret Creator reads as Hinted, the closest tier that
    // still keeps the source name and handle protected.
    ...(rawIdentityDisclosure !== undefined &&
      validPrivacyField("identityDisclosure", rawIdentityDisclosure === "secret" ? "hinted" : rawIdentityDisclosure)),
    ...(rawStagePersonality !== undefined && validPrivacyField("stagePersonality", rawStagePersonality)),
    access: {
      hiddenFromAccountIds: parseStringArray(rawAccess.hiddenFromAccountIds),
    },
  };
  const strategy = normalizeSlurpCreatorStrategy(raw.strategy);
  const stage = {
    ...(stageFact(rawStage.appearance) !== undefined && { appearance: stageFact(rawStage.appearance)! }),
    ...(stageFact(rawStage.wardrobe) !== undefined && { wardrobe: stageFact(rawStage.wardrobe)! }),
    ...(stageFact(rawStage.locations) !== undefined && { locations: stageFact(rawStage.locations)! }),
  };
  const appearanceProfile =
    typeof rawAppearanceProfile.text === "string" && rawAppearanceProfile.text.trim()
      ? {
          text: rawAppearanceProfile.text.trim().slice(0, SLURP_STAGE_FACT_MAX_LENGTH),
          source:
            rawAppearanceProfile.source === "source_appearance" ||
            rawAppearanceProfile.source === "description" ||
            rawAppearanceProfile.source === "avatar" ||
            rawAppearanceProfile.source === "mixed"
              ? rawAppearanceProfile.source
              : "mixed",
          sourceEntityId:
            typeof rawAppearanceProfile.sourceEntityId === "string" ? rawAppearanceProfile.sourceEntityId : "",
          sourceRevisionToken:
            typeof rawAppearanceProfile.sourceRevisionToken === "string"
              ? rawAppearanceProfile.sourceRevisionToken
              : "",
          confidence:
            rawAppearanceProfile.confidence === "high" ||
            rawAppearanceProfile.confidence === "medium" ||
            rawAppearanceProfile.confidence === "low"
              ? rawAppearanceProfile.confidence
              : "low",
          status: rawAppearanceProfile.status === "accepted" ? "accepted" : "needs_review",
          generatedAt: typeof rawAppearanceProfile.generatedAt === "string" ? rawAppearanceProfile.generatedAt : "",
          acceptedAt: typeof rawAppearanceProfile.acceptedAt === "string" ? rawAppearanceProfile.acceptedAt : null,
        }
      : undefined;
  return {
    profile,
    ...(strategy && { strategy }),
    social,
    scheduler: normalizeScheduler(raw.scheduler),
    ...(Object.keys(stage).length > 0 && { stage }),
    ...(appearanceProfile && { appearanceProfile }),
    privacy,
    wallet: { coins: normalizePersistedInteger(rawWallet.coins) ?? SLURP_DEFAULT_ECONOMY.startingCoins },
  };
}

/** Trim and cap one stage fact. Empty means the Creator has not been given one. */
function stageFact(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim().slice(0, SLURP_STAGE_FACT_MAX_LENGTH) : "";
  return text || undefined;
}

export function parseRefreshAttempts(value: unknown): SlpRefreshAttempt[] {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry): SlpRefreshAttempt[] => {
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

export function parseSlpAvatarCrop(value: unknown): AvatarCrop | null {
  return normalizeAvatarCrop(value);
}

export function parseStringArray(value: unknown): string[] {
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

export function parseAuthorSnapshot(value: unknown): SlpAuthorSnapshot | null {
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

export function normalizeBool(value: unknown): boolean {
  return value === true || value === "true";
}

export function normalizeHandle(name: string, fallback: string) {
  const base = (name || fallback || "noodle")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 36);
  return base || "noodle";
}

export function suffixedPublicHandle(base: string, suffixNumber: number): string {
  const suffix = `_${suffixNumber}`;
  return `${base.slice(0, Math.max(1, 36 - suffix.length))}${suffix}`;
}

export function nextAvailablePublicHandle(base: string, reserved: ReadonlySet<string>): string {
  if (!reserved.has(base)) return base;
  for (let suffixNumber = 2; suffixNumber < Number.MAX_SAFE_INTEGER; suffixNumber += 1) {
    const candidate = suffixedPublicHandle(base, suffixNumber);
    if (!reserved.has(candidate)) return candidate;
  }
  throw new Error("Could not allocate a unique Noodle handle");
}

export function normalizeAccountKind(kind: string): SlpAccountKind {
  if (kind === "character" || kind === "random_user") return kind;
  return "persona";
}

export function isToggleInteractionType(type: SlpInteractionType) {
  return type === "like" || type === "repost";
}
