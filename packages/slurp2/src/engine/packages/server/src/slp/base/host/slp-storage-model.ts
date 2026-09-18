import { and, eq, inArray, isNotNull, like, lt, ne, or } from "../../../db/file-query.js";
import {
  noodleAccountProfileSettingsSchema,
  noodleAccountPrivacySettingsSchema,
  noodleAccountSocialSettingsSchema,
  noodlerFanActivitySettingsSchema,
  normalizeAvatarCrop,
  NoodleAccount,
  NoodleAccountKind,
  NoodleAccountSchedulerSettings,
  NoodleAccountSettings,
  AvatarCrop,
  NoodleAuthorSnapshot,
  NoodleCreateInteractionInput,
  NoodleInteraction,
  NoodleInteractionType,
  NoodlePostAccess,
  NoodlePostSource,
  NoodlerManagedPost,
  NoodlerManagedStageProfile,
  NoodleRefreshAttempt,
  NoodleRemoveInteractionInput,
  NoodlerCreateInteractionInput,
  NoodlerRemoveInteractionInput,
} from "@marinara-engine/shared";
import { slurpDiscoveryFields, SlurpDiscoveryGender } from "../../../services/slurp/slurp-discovery-profile.js";
import { SLURP_DEFAULT_ECONOMY } from "../../../services/slurp/slurp-wallet.js";
import { NOODLER_MEDIA_URL_PREFIX } from "../../../services/slurp/slurp-media.js";
import {
  noodleAccounts,
  noodleAccountSubscriptions,
  noodleActivityDigests,
  noodleInteractions,
  noodlePosts,
  noodlePostUnlocks,
  noodleRefreshRuns,
} from "../../../db/schema/slurp.js";
import type { NoodlerPostSortKey } from "../../../services/slurp/slurp-post-page.js";
import type { SlurpSettings } from "../settings/slp-settings.js";

export type NoodlerPostPageCursor = NoodlerPostSortKey;

export type SlurpSourceKind = "character" | "persona";

export type SlurpNoodleAccountSettings = Omit<NoodleAccountSettings, "profile"> & {
  profile: NoodleAccountSettings["profile"] & {
    gender: SlurpDiscoveryGender | null;
    tags: string[];
  };
};

export type SlurpManagedStageProfile = NoodlerManagedStageProfile & {
  gender: SlurpDiscoveryGender | null;
  tags: string[];
};

export type SlurpAccount = Omit<NoodleAccount, "settings"> & {
  settings: SlurpNoodleAccountSettings;
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

export function noodlerReadablePostCondition(options: NoodlerPostPageOptions) {
  return or(
    eq(noodlePosts.access, "public"),
    inArray(noodlePosts.authorAccountId, options.readableContentAccountIds ?? []),
    inArray(noodlePosts.id, options.unlockedPostIds ?? []),
  );
}

export function noodlerPostPageCondition(options: NoodlerPostPageOptions, includeCursor: boolean) {
  const readable = noodlerReadablePostCondition(options);
  return and(
    inArray(noodlePosts.authorAccountId, options.accountIds),
    ne(noodlePosts.access, "draft"),
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
  /** The project chosen when the post was prepared, carried through to publication. */
  projectId?: string | null;
  projectChapter?: string | null;
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
    | "imagePromptInterpretation"
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
        imagePromptInterpretation: settings.imagePromptInterpretation,
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

export type AccountRow = typeof noodleAccounts.$inferSelect;

export type PostRow = typeof noodlePosts.$inferSelect;

export type InteractionRow = typeof noodleInteractions.$inferSelect;

export type DigestRow = typeof noodleActivityDigests.$inferSelect;

export type RefreshRunRow = typeof noodleRefreshRuns.$inferSelect;

export type SubscriptionRow = typeof noodleAccountSubscriptions.$inferSelect;

export type PostUnlockRow = typeof noodlePostUnlocks.$inferSelect;

export type PublicCreateInteractionCommand = Omit<NoodleCreateInteractionInput, "actorKind" | "actorEntityId"> & {
  actorAccountId: string;
};

export type PublicRemoveInteractionCommand = Omit<NoodleRemoveInteractionInput, "actorKind" | "actorEntityId"> & {
  actorAccountId: string;
};

export type NoodlerCreateInteractionCommand = Omit<NoodlerCreateInteractionInput, "personaId"> & {
  actorAccountId: string;
  viewerPersonaId: string;
};

export type NoodlerRemoveInteractionCommand = Omit<NoodlerRemoveInteractionInput, "personaId"> & {
  actorAccountId: string;
  viewerPersonaId: string;
};

export type DeleteStoredInteractionCommand = {
  actorAccountId: string;
  type: "like" | "repost";
  parentInteractionId?: string | null;
};

export type InsertInteractionCommand = {
  actor: NoodleAccount;
  type: NoodleInteractionType;
  content?: string | null;
  imageUrl?: string | null;
  parentInteractionId: string | null;
};

export type SlurpAccountRole = "creator" | "viewer";

export type NoodlerWorldInteractionInput = {
  creatorAccountId: string;
  actorId: string;
  type: "like" | "reply" | "repost";
  content: string | null;
};

export type NoodlerPostPersistenceInput = {
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
  /** The project this post was published into, and the chapter it was on. See `slurp-project.ts`. */
  projectId?: string | null;
  projectChapter?: string | null;
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

export function emptyNoodleAccountSettings(): SlurpNoodleAccountSettings {
  return {
    profile: { gender: null, tags: [] },
    social: {},
    scheduler: { autoPosting: defaultAutoPostingSettings() },
    privacy: { access: { hiddenFromAccountIds: [] } },
    wallet: { coins: SLURP_DEFAULT_ECONOMY.startingCoins },
  };
}

export function defaultAutoPostingSettings(): NonNullable<NoodleAccountSchedulerSettings["autoPosting"]> {
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

export function validProfileField(key: string, value: unknown): NoodleAccountSettings["profile"] {
  if (value === undefined) return {};
  const parsed = noodleAccountProfileSettingsSchema.safeParse({ [key]: value });
  return parsed.success ? parsed.data : {};
}

export function validSocialField(key: string, value: unknown): NoodleAccountSettings["social"] {
  if (value === undefined) return {};
  const parsed = noodleAccountSocialSettingsSchema.safeParse({ [key]: value });
  return parsed.success ? parsed.data : {};
}

export function validPrivacyField(key: string, value: unknown): NoodleAccountSettings["privacy"] {
  const empty = { access: { hiddenFromAccountIds: [] } };
  if (value === undefined) return empty;
  const parsed = noodleAccountPrivacySettingsSchema.safeParse({ [key]: value });
  return parsed.success ? parsed.data : empty;
}

export function normalizeNoodleAccountSettings(value: unknown): SlurpNoodleAccountSettings {
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
    ...(rawNoodlerWizardExecutionId !== undefined &&
      validProfileField("noodlerWizardExecutionId", rawNoodlerWizardExecutionId)),
    ...(rawNoodlerSourceSnapshot !== undefined && validProfileField("noodlerSourceSnapshot", rawNoodlerSourceSnapshot)),
    ...discovery,
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
    // Slurp no longer offers Secret. A stored Secret Creator reads as Hinted, the closest tier that
    // still keeps the source name and handle protected.
    ...(rawIdentityDisclosure !== undefined &&
      validPrivacyField("identityDisclosure", rawIdentityDisclosure === "secret" ? "hinted" : rawIdentityDisclosure)),
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
    wallet: { coins: normalizePersistedInteger(rawWallet.coins) ?? SLURP_DEFAULT_ECONOMY.startingCoins },
  };
}

export function parseRefreshAttempts(value: unknown): NoodleRefreshAttempt[] {
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

export function parseAuthorSnapshot(value: unknown): NoodleAuthorSnapshot | null {
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

export function normalizeAccountKind(kind: string): NoodleAccountKind {
  if (kind === "character" || kind === "random_user") return kind;
  return "persona";
}

export function isToggleInteractionType(type: NoodleInteractionType) {
  return type === "like" || type === "repost";
}
