// ──────────────────────────────────────────────
// Slurp social schemas. Copied from the Engine Noodle schemas so Slurp2 owns its own
// vocabulary. Every string literal, enum value and wire key is unchanged.
// ──────────────────────────────────────────────
import { z } from "zod";
import { avatarCropSchema } from "@marinara-engine/shared";

export const slpAccountKindSchema = z.enum(["persona", "character", "random_user"]);
export const slpInteractionTypeSchema = z.enum(["like", "repost", "reply", "vote"]);
export const slpPostAccessSchema = z.enum(["public", "locked"]);
export const slpCreatorContentFormatSchema = z.enum(["caption", "announcement", "long_form"]);
export const DEFAULT_SLP_WALLET_COINS = 999_999;
export const slpParticipantSelectionModeSchema = z.enum(["all", "random_range", "exact"]);
export const slpCarryoverModeSchema = z.enum(["off", "conversation", "roleplay", "game", "all"]);
export const slpCarryoverTargetSchema = z.enum(["conversation", "roleplay", "game"]);
export const slpThemeSchema = z.enum(["system", "light", "dark"]);
export const slpIdentityDisclosureSchema = z.enum(["open", "hinted", "secret"]);
export const slpCreatorOnboardingStateSchema = z.enum(["incomplete", "zero", "completed"]);
export const slpCreatorFanArchetypeSchema = z.enum([
  "ordinary",
  "eccentric",
  "crossFandom",
  "raider",
  "organicDiscovery",
  "freeResource",
]);
export const SLP_CREATOR_FAN_ARCHETYPES = slpCreatorFanArchetypeSchema.options;
export const DEFAULT_SLP_CREATOR_FAN_ARCHETYPE_WEIGHTS = {
  ordinary: 6,
  eccentric: 2,
  crossFandom: 1,
  raider: 1,
  organicDiscovery: 1,
  freeResource: 1,
} as const;
const slpCreatorFanArchetypeWeightsObjectSchema = z
  .object({
    ordinary: z.number().int().min(0).max(100),
    eccentric: z.number().int().min(0).max(100),
    crossFandom: z.number().int().min(0).max(100),
    raider: z.number().int().min(0).max(100),
    organicDiscovery: z.number().int().min(0).max(100),
    freeResource: z.number().int().min(0).max(100),
  })
  .strict();
export const slpCreatorFanArchetypeWeightsSchema = slpCreatorFanArchetypeWeightsObjectSchema.refine(
  (weights) => Object.values(weights).some((weight) => weight > 0),
  {
    message: "At least one audience archetype must have a positive weight.",
  },
);
export const SLP_CREATOR_POST_TITLE_MAX_LENGTH = 200;
export const SLP_CREATOR_POST_CONTENT_MAX_LENGTH = 4000;
export const SLP_CREATOR_REPLY_CONTENT_MAX_LENGTH = 2000;
export const DEFAULT_SLP_CREATOR_REPLIES_PER_24_HOURS = 10;
export const SLP_CREATOR_POSTS_PER_DAY_MAX = 24;
/** Per-request cap on bulk creator creation and targeted refresh. The wizard enforces the same
 *  ceiling so a selection larger than this is prevented rather than rejected as a whole request. */
export const SLP_CREATOR_BULK_ACCOUNT_MAX = 100;
export const AMBIENT_SLP_ENTITY_IDS = [
  "random_user:thread-countess",
  "random_user:packet-soup",
  "random_user:orbit-notice",
  "random_user:glass-bulletin",
  "random_user:moth-hour",
  "random_user:brine-index",
] as const;
// Exact `Title:\n` + `\n\n` + `Body:\n` framing overhead from serializeCreatorPostGuide.
export const SLP_CREATOR_POST_GUIDE_MAX_LENGTH =
  SLP_CREATOR_POST_TITLE_MAX_LENGTH + SLP_CREATOR_POST_CONTENT_MAX_LENGTH + 15;

export const DEFAULT_SLP_SETTINGS = {
  refreshesPerDay: 2,
  participantSelectionMode: "random_range",
  participantMin: 2,
  participantMax: 5,
  maxGeneratedPostsPerRefresh: 8,
  maxRepliesPerRefresh: 12,
  maxRepostsPerRefresh: 4,
  maxLikesPerRefresh: 18,
  maxImagesPerRefresh: 3,
  enableImagePrompts: false,
  imageGenerationConnectionId: null,
  imageGenerationPrompt:
    "Create either a social-media-ready character image or an in-character meme for the post. For character images, mention build, clothing, visible appearance, pose, expression, setting, lighting, mood, and composition. For memes, mention meme format, visual gag, composition, and short readable caption/text when relevant.",
  imageGenerationUseAvatarReferences: true,
  imageGenerationIncludeDescriptions: true,
  allowGalleryImageAttachments: false,
  imageCaptioningEnabled: false,
  imageCaptioningConnectionId: null,
  imageCaptioningUseConnectionDefault: true,
  enableLorebookContext: false,
  includeCharacterSchedules: false,
  enableEnhancedTimelineWriting: false,
  allowProfessorMari: true,
  allowRandomUsers: false,
  invitedCharacterGroupIds: [],
  carryoverMode: "off",
  carryoverModes: [],
  carryoverHours: 48,
  carryoverMaxItems: 8,
  theme: "system",
  generationConnectionId: null,
  enableNoodler: false,
  noodlerGenerationGuidance:
    "All NoodleR creators and viewers are adults (18+). NSFW and explicit content are allowed when appropriate to the creator's personality and current context. Do not force it: stay true to each creator's voice rather than making every post sexual.",
  autoPostingScheduleEnabled: true,
  postsPerDay: 4,
  noodlerOnboardingComplete: false,
  noodlerOnboardingState: "incomplete",
  noodlerNightQuiet: true,
  fanActivityEnabled: false,
  fanActivityRunsPerDay: 4,
  fanLikesPerRefresh: 6,
  fanRepliesPerRefresh: 2,
  fanRepostsPerRefresh: 1,
  fanArchetypeWeights: DEFAULT_SLP_CREATOR_FAN_ARCHETYPE_WEIGHTS,
} as const;

export const slpSettingsSchema = z.object({
  refreshesPerDay: z.number().int().min(0).max(24).default(DEFAULT_SLP_SETTINGS.refreshesPerDay),
  participantSelectionMode: slpParticipantSelectionModeSchema.default(DEFAULT_SLP_SETTINGS.participantSelectionMode),
  participantMin: z.number().int().min(1).max(100).default(DEFAULT_SLP_SETTINGS.participantMin),
  participantMax: z.number().int().min(1).max(100).default(DEFAULT_SLP_SETTINGS.participantMax),
  maxGeneratedPostsPerRefresh: z
    .number()
    .int()
    .min(0)
    .max(100)
    .default(DEFAULT_SLP_SETTINGS.maxGeneratedPostsPerRefresh),
  maxRepliesPerRefresh: z.number().int().min(0).max(200).default(DEFAULT_SLP_SETTINGS.maxRepliesPerRefresh),
  maxRepostsPerRefresh: z.number().int().min(0).max(100).default(DEFAULT_SLP_SETTINGS.maxRepostsPerRefresh),
  maxLikesPerRefresh: z.number().int().min(0).max(500).default(DEFAULT_SLP_SETTINGS.maxLikesPerRefresh),
  maxImagesPerRefresh: z.number().int().min(0).max(50).default(DEFAULT_SLP_SETTINGS.maxImagesPerRefresh),
  enableImagePrompts: z.boolean().default(DEFAULT_SLP_SETTINGS.enableImagePrompts),
  imageGenerationConnectionId: z.string().min(1).nullable().default(DEFAULT_SLP_SETTINGS.imageGenerationConnectionId),
  imageGenerationPrompt: z.string().max(4000).default(DEFAULT_SLP_SETTINGS.imageGenerationPrompt),
  imageGenerationUseAvatarReferences: z.boolean().default(DEFAULT_SLP_SETTINGS.imageGenerationUseAvatarReferences),
  imageGenerationIncludeDescriptions: z.boolean().default(DEFAULT_SLP_SETTINGS.imageGenerationIncludeDescriptions),
  allowGalleryImageAttachments: z.boolean().default(DEFAULT_SLP_SETTINGS.allowGalleryImageAttachments),
  imageCaptioningEnabled: z.boolean().default(DEFAULT_SLP_SETTINGS.imageCaptioningEnabled),
  imageCaptioningConnectionId: z.string().min(1).nullable().default(DEFAULT_SLP_SETTINGS.imageCaptioningConnectionId),
  imageCaptioningUseConnectionDefault: z.boolean().default(DEFAULT_SLP_SETTINGS.imageCaptioningUseConnectionDefault),
  enableLorebookContext: z.boolean().default(DEFAULT_SLP_SETTINGS.enableLorebookContext),
  includeCharacterSchedules: z.boolean().default(DEFAULT_SLP_SETTINGS.includeCharacterSchedules),
  enableEnhancedTimelineWriting: z.boolean().default(DEFAULT_SLP_SETTINGS.enableEnhancedTimelineWriting),
  allowProfessorMari: z.boolean().default(DEFAULT_SLP_SETTINGS.allowProfessorMari),
  allowRandomUsers: z.boolean().default(DEFAULT_SLP_SETTINGS.allowRandomUsers),
  invitedCharacterGroupIds: z
    .array(z.string().min(1))
    .default(() => [...DEFAULT_SLP_SETTINGS.invitedCharacterGroupIds]),
  carryoverMode: slpCarryoverModeSchema.default(DEFAULT_SLP_SETTINGS.carryoverMode),
  carryoverModes: z.array(slpCarryoverTargetSchema).default(() => [...DEFAULT_SLP_SETTINGS.carryoverModes]),
  carryoverHours: z.number().int().min(1).max(720).default(DEFAULT_SLP_SETTINGS.carryoverHours),
  carryoverMaxItems: z.number().int().min(1).max(50).default(DEFAULT_SLP_SETTINGS.carryoverMaxItems),
  theme: slpThemeSchema.default(DEFAULT_SLP_SETTINGS.theme),
  generationConnectionId: z.string().min(1).nullable().default(DEFAULT_SLP_SETTINGS.generationConnectionId),
  enableNoodler: z.boolean().default(DEFAULT_SLP_SETTINGS.enableNoodler),
  noodlerGenerationGuidance: z.string().max(4000).default(DEFAULT_SLP_SETTINGS.noodlerGenerationGuidance),
  autoPostingScheduleEnabled: z.boolean().default(DEFAULT_SLP_SETTINGS.autoPostingScheduleEnabled),
  postsPerDay: z.number().int().min(1).max(SLP_CREATOR_POSTS_PER_DAY_MAX).default(DEFAULT_SLP_SETTINGS.postsPerDay),
  noodlerOnboardingComplete: z.boolean().default(DEFAULT_SLP_SETTINGS.noodlerOnboardingComplete),
  noodlerOnboardingState: slpCreatorOnboardingStateSchema.default(DEFAULT_SLP_SETTINGS.noodlerOnboardingState),
  noodlerNightQuiet: z.boolean().default(DEFAULT_SLP_SETTINGS.noodlerNightQuiet),
  fanActivityEnabled: z.boolean().default(DEFAULT_SLP_SETTINGS.fanActivityEnabled),
  fanActivityRunsPerDay: z.number().int().min(1).max(24).default(DEFAULT_SLP_SETTINGS.fanActivityRunsPerDay),
  fanLikesPerRefresh: z.number().int().min(0).max(24).default(DEFAULT_SLP_SETTINGS.fanLikesPerRefresh),
  fanRepliesPerRefresh: z.number().int().min(0).max(12).default(DEFAULT_SLP_SETTINGS.fanRepliesPerRefresh),
  fanRepostsPerRefresh: z.number().int().min(0).max(12).default(DEFAULT_SLP_SETTINGS.fanRepostsPerRefresh),
  fanArchetypeWeights: slpCreatorFanArchetypeWeightsSchema.default(DEFAULT_SLP_SETTINGS.fanArchetypeWeights),
});

export const slpSettingsUpdateSchema = slpSettingsSchema.partial();

export const slpCreatorSourceSnapshotSchema = z
  .object({
    publicDisplayName: z.string(),
    publicHandle: z.string(),
    name: z.string(),
    description: z.string(),
    personality: z.string(),
    scenario: z.string(),
    appearance: z.string(),
    backstory: z.string(),
  })
  .strict();

export const slpAccountProfileSettingsSchema = z
  .object({
    avatarCrop: avatarCropSchema.nullable().optional(),
    bannerUrl: z.string().max(2000).optional(),
    location: z.string().max(120).optional(),
    profileGenerated: z.boolean().optional(),
    profileManuallyEdited: z.boolean().optional(),
    noodlerWizardExecutionId: z.string().min(1).max(128).optional(),
    noodlerSourceSnapshot: slpCreatorSourceSnapshotSchema.optional(),
  })
  .strict();

export const slpAccountSocialSettingsSchema = z
  .object({
    followingAccountIds: z.array(z.string().min(1)).optional(),
    followingAccountTimestamps: z.record(z.string(), z.string().datetime()).optional(),
    notificationsReadAt: z.string().datetime().optional(),
    noodlerFeedSeenAt: z.string().datetime().optional(),
    noodleFeedSeenAt: z.string().datetime().optional(),
  })
  .strict();

export const slpAutoPostingSettingsSchema = z
  .object({
    enabled: z.boolean().default(false),
    imagesEnabled: z.boolean().default(false),
  })
  .strict();

export const slpCreatorFanActivitySettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    archetypeWeights: slpCreatorFanArchetypeWeightsObjectSchema
      .partial()
      .refine((weights) => Object.values(weights).some((weight) => weight > 0), {
        message: "At least one audience archetype must have a positive weight.",
      })
      .optional(),
  })
  .strict();

/** Full normalized stored shape. */
export const slpAccountSchedulerSettingsSchema = z
  .object({
    autoPosting: slpAutoPostingSettingsSchema.optional(),
    fanActivity: slpCreatorFanActivitySettingsSchema.optional(),
  })
  .strict();

export const slpAccountSchedulerPatchSchema = z
  .object({
    autoPosting: slpAutoPostingSettingsSchema.pick({ enabled: true, imagesEnabled: true }).partial().optional(),
    fanActivity: slpCreatorFanActivitySettingsSchema.nullable().optional(),
  })
  .strict();
export const slpAccountAccessSettingsSchema = z
  .object({
    hiddenFromAccountIds: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const slpWalletSettingsSchema = z
  .object({ coins: z.number().int().min(0).default(DEFAULT_SLP_WALLET_COINS) })
  .strict();

export const slpAccountPrivacySettingsSchema = z
  .object({
    identityDisclosure: slpIdentityDisclosureSchema.optional(),
    stagePersonality: z.string().trim().max(1000).optional(),
    access: slpAccountAccessSettingsSchema.default({
      hiddenFromAccountIds: [],
    }),
  })
  .strict();

export const slpAccountPrivacyPatchSchema = slpAccountPrivacySettingsSchema
  .omit({ access: true })
  .extend({ access: slpAccountAccessSettingsSchema.partial().optional() })
  .strict();

export const slpAccountSocialPatchSchema = slpAccountSocialSettingsSchema.pick({
  notificationsReadAt: true,
  noodlerFeedSeenAt: true,
  noodleFeedSeenAt: true,
});

/**
 * One Creator strategy edit. `null` clears a value back to the derived default; an absent key
 * leaves it alone. Bounds match `SLURP_STRATEGY_LIMITS` on the server.
 */
export const slpCreatorStrategyPatchSchema = z
  .object({
    style: z.enum(["homemade", "polished", "documentary", "theatrical"]).nullable().optional(),
    skipRate: z.number().int().min(0).max(40).nullable().optional(),
    textOnlyRate: z.number().int().min(0).max(100).nullable().optional(),
    intentWeights: z.record(z.string(), z.number().int().min(0).max(100)).nullable().optional(),
    strategyText: z.string().max(2000).nullable().optional(),
  })
  .strict();

export const slpAccountSettingsPatchSchema = z.discriminatedUnion("subtree", [
  z.object({ subtree: z.literal("social"), patch: slpAccountSocialPatchSchema }).strict(),
  z.object({ subtree: z.literal("scheduler"), patch: slpAccountSchedulerPatchSchema }).strict(),
  z.object({ subtree: z.literal("privacy"), patch: slpAccountPrivacyPatchSchema }).strict(),
  z.object({ subtree: z.literal("strategy"), patch: slpCreatorStrategyPatchSchema }).strict(),
]);

const slpAccountIdentityUpdateShape = {
  handle: z
    .string()
    .trim()
    .min(1, "Enter a Slurp handle.")
    .max(40, "Handle must contain at most 40 characters.")
    .optional(),
  displayName: z.string().min(1).max(120).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().max(2000).nullable().optional(),
};

export const slpAccountUpdateSchema = z
  .object({ ...slpAccountIdentityUpdateShape, invited: z.boolean().optional() })
  .strict();

export const slpAccountProfileUpdateSchema = z
  .object({ ...slpAccountIdentityUpdateShape, profile: slpAccountProfileSettingsSchema })
  .strict();

export const slpAccountFollowUpdateSchema = z.object({ followed: z.boolean() }).strict();

export const slpAmbientProfileRerollSchema = z
  .object({
    accountIds: z
      .array(z.string().min(1).max(64))
      .min(1)
      .max(AMBIENT_SLP_ENTITY_IDS.length)
      .refine((ids) => new Set(ids).size === ids.length, { message: "Duplicate account IDs are not allowed." }),
    debugMode: z.boolean().default(false),
  })
  .strict();

const slpStageProfileShape = {
  displayName: z.string().trim().min(1, "Enter a stage name.").max(120),
  handle: z.string().trim().min(1, "Enter a stage handle.").max(40),
  bio: z.string().trim().max(500),
  stagePersonality: z.string().trim().max(1000),
  disclosureMode: slpIdentityDisclosureSchema,
};

export const slpStageProfileSchema = z.object(slpStageProfileShape).strict();
export const slpCreatorAccountCreateSchema = z.object({ stageProfile: slpStageProfileSchema }).strict();
export const slpBulkCreatorAccountCreateSchema = z
  .object({
    // Cap and dedupe so one accepted request can't fan out into unbounded or
    // duplicated sequential create work, and each public account has exactly one outcome.
    noodleAccountIds: z
      .array(z.string().min(1).max(64))
      .min(0)
      .max(SLP_CREATOR_BULK_ACCOUNT_MAX)
      .refine((ids) => new Set(ids).size === ids.length, { message: "Duplicate account IDs are not allowed." }),
    disclosureMode: slpIdentityDisclosureSchema,
    disclosureExceptions: z.record(z.string().min(1).max(64), slpIdentityDisclosureSchema).default({}),
    autoPosting: slpAutoPostingSettingsSchema.default({ enabled: true, imagesEnabled: false }),
    executionId: z.string().min(1).max(128).optional(),
  })
  .strict();
export const slpCreatorTargetedRefreshSchema = z
  .object({
    accountIds: z
      .array(z.string().min(1).max(64))
      .min(1)
      .max(SLP_CREATOR_BULK_ACCOUNT_MAX)
      .refine((ids) => new Set(ids).size === ids.length, { message: "Duplicate account IDs are not allowed." }),
    executionId: z.string().min(1).max(128).optional(),
  })
  .strict();
export const slpStageProfileUpdateSchema = z
  .object({
    ...slpStageProfileShape,
    acceptSourceChanges: z.boolean().optional(),
    sourceSnapshot: slpCreatorSourceSnapshotSchema.optional(),
  })
  .strict();

export const slpStageProfileDraftRequestSchema = z
  .object({
    noodleAccountId: z.string().min(1).optional(),
    noodlerAccountId: z.string().min(1).optional(),
    disclosureMode: slpIdentityDisclosureSchema,
    guidance: z.string().trim().max(2000).default(""),
    currentDraft: slpStageProfileSchema.partial().optional(),
    connectionId: z.string().min(1).optional(),
  })
  .strict()
  .refine((input) => Boolean(input.noodleAccountId) !== Boolean(input.noodlerAccountId), {
    message: "Choose a source account.",
  });

export const slpStageProfileDraftResponseSchema = slpStageProfileSchema.extend({
  sourceSnapshot: slpCreatorSourceSnapshotSchema.optional(),
});

export const slpInviteSchema = z.object({
  characterId: z.string().min(1),
});

export const slpBulkInviteSchema = z.object({
  characterIds: z.array(z.string().min(1)).min(1).max(5000),
});

export const slpPollInputSchema = z
  .object({
    question: z.string().trim().min(1).max(240),
    options: z.array(z.string().trim().min(1).max(120)).min(2).max(4),
  })
  .superRefine((poll, ctx) => {
    const normalized = poll.options.map((option) => option.toLocaleLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Poll options must be unique.",
      });
    }
  });

export const slpPollSchema = z.object({
  question: z.string().trim().min(1).max(240),
  options: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        label: z.string().trim().min(1).max(120),
      }),
    )
    .min(2)
    .max(4),
});

export const slpPostImageCropSchema = z
  .object({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
    width: z.number().finite().gt(0).max(1),
    height: z.number().finite().gt(0).max(1),
    sourceWidth: z.number().int().min(1).max(65_535),
    sourceHeight: z.number().int().min(1).max(65_535),
  })
  .strict()
  .refine((crop) => crop.x + crop.width <= 1.000_001 && crop.y + crop.height <= 1.000_001, {
    message: "Image crop must stay inside the source image.",
  });

export const slpCreatePostSchema = z.object({
  authorKind: slpAccountKindSchema,
  authorEntityId: z.string().min(1),
  content: z.string().min(1).max(4000),
  imageUrl: z.string().max(2000).nullable().optional(),
  imagePrompt: z.string().max(2000).nullable().optional(),
  imageCrop: slpPostImageCropSchema.optional(),
  parentPostId: z.string().min(1).nullable().optional(),
  quotePostId: z.string().min(1).nullable().optional(),
  poll: slpPollInputSchema.nullable().optional(),
});

const slpCreatorPersonaIdSchema = z.object({ personaId: z.string().min(1) }).strict();
export const slpCreatorViewerPersonaSchema = slpCreatorPersonaIdSchema;
export const slpCreatorSubscriptionSchema = slpCreatorPersonaIdSchema;
export const slpCreatorUnlockSchema = slpCreatorPersonaIdSchema;

export const slpCreatorCreateInteractionSchema = slpCreatorPersonaIdSchema
  .extend({
    type: z.enum(["like", "repost", "reply", "vote"]),
    content: z.string().max(2000).nullable().optional(),
    parentInteractionId: z.string().min(1).nullable().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.type === "reply" && !input.content?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["content"], message: "Replies need text." });
    }
    if (input.type === "repost" && input.parentInteractionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentInteractionId"],
        message: "Reposts cannot target a reply.",
      });
    }
    if (input.type === "vote" && (!input.content?.trim() || input.content.length > 40)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "Poll votes require a valid option ID.",
      });
    }
    if (input.type === "vote" && input.parentInteractionId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentInteractionId"],
        message: "Poll votes cannot target a reply.",
      });
    }
    if ((input.type === "like" || input.type === "repost") && input.content?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "Likes and reposts cannot include content.",
      });
    }
  });

export const slpCreatorRemoveInteractionSchema = slpCreatorPersonaIdSchema
  .extend({
    type: z.enum(["like", "repost"]),
    parentInteractionId: z.string().min(1).nullable().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.type === "repost" && input.parentInteractionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentInteractionId"],
        message: "Reposts cannot target a reply.",
      });
    }
  });

export const slpCreatorReplyRequestSchema = slpCreatorPersonaIdSchema
  .extend({ debugMode: z.boolean().optional() })
  .strict();

export const slpPostUpdateSchema = z.object({
  content: z.string().trim().max(4000).optional(),
  imageUrl: z.string().max(2000).nullable().optional(),
  imagePrompt: z.string().max(2000).nullable().optional(),
  imageCrop: slpPostImageCropSchema.nullable().optional(),
  poll: slpPollInputSchema.nullable().optional(),
});

const slpCreatorPostTitleValueSchema = z.string().trim().max(SLP_CREATOR_POST_TITLE_MAX_LENGTH).nullable();
export const slpCreatorPostTitleSchema = slpCreatorPostTitleValueSchema
  .optional()
  .transform((value) => value?.trim() || null);
const slpCreatorPostTitleUpdateSchema = slpCreatorPostTitleValueSchema
  .optional()
  .transform((value) => (value === undefined ? undefined : value?.trim() || null));

const slpCreatorPostCreateShape = {
  targetAccountId: z.string().min(1),
  title: slpCreatorPostTitleSchema,
  content: z.string().trim().max(SLP_CREATOR_POST_CONTENT_MAX_LENGTH),
  format: slpCreatorContentFormatSchema.optional(),
  uploadedImageUrl: z.string().trim().url().max(2000).optional(),
  imageCrop: slpPostImageCropSchema.optional(),
  poll: slpPollInputSchema.nullable().optional(),
};

export const slpCreatorPostCreateWithMediaSchema = z
  .object({ ...slpCreatorPostCreateShape, access: slpPostAccessSchema.default("public") })
  .strict();

export const slpCreatorPostCreateSchema = slpCreatorPostCreateWithMediaSchema.superRefine((input, ctx) => {
  if (!input.content && !input.poll && !input.uploadedImageUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["content"],
      message: "Posts need a body, image, or poll.",
    });
  }
});

export const slpCreatorPostUpdateSchema = z
  .object({
    title: slpCreatorPostTitleUpdateSchema,
    content: z.string().trim().max(SLP_CREATOR_POST_CONTENT_MAX_LENGTH).optional(),
    removeImage: z.literal(true).optional(),
    imageCrop: slpPostImageCropSchema.nullable().optional(),
    poll: slpPollInputSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.title !== undefined ||
      input.content !== undefined ||
      input.removeImage !== undefined ||
      input.imageCrop !== undefined ||
      input.poll !== undefined,
    {
      message: "Provide a title, body, image, or poll update.",
    },
  );

export const slpCreateInteractionSchema = z
  .object({
    actorKind: slpAccountKindSchema,
    actorEntityId: z.string().min(1),
    type: slpInteractionTypeSchema,
    content: z.string().max(2000).nullable().optional(),
    imageUrl: z.string().max(2000).nullable().optional(),
    parentInteractionId: z.string().min(1).nullable().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.type === "reply" && !input.content?.trim() && !input.imageUrl?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "Replies need text or an image.",
      });
    }
    if (input.type === "repost" && input.parentInteractionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentInteractionId"],
        message: "Reposts cannot target a reply.",
      });
    }
    if (input.type === "vote" && (!input.content?.trim() || input.parentInteractionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "Poll votes require an option and cannot target a reply.",
      });
    }
    if (input.type !== "reply" && input.imageUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["imageUrl"],
        message: "Only replies can include an image.",
      });
    }
  });

export const slpRemoveInteractionSchema = z
  .object({
    actorKind: slpAccountKindSchema,
    actorEntityId: z.string().min(1),
    type: z.enum(["like", "repost"]),
    parentInteractionId: z.string().min(1).nullable().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.type === "repost" && input.parentInteractionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentInteractionId"],
        message: "Reposts cannot target a reply.",
      });
    }
  });

export const slpInteractionOwnerSchema = z.object({
  personaId: z.string().min(1),
});

export const slpInteractionUpdateSchema = slpInteractionOwnerSchema
  .extend({
    content: z.string().max(2000).nullable().optional(),
    imageUrl: z.string().max(2000).nullable().optional(),
  })
  .refine((input) => input.content !== undefined || input.imageUrl !== undefined, {
    message: "Provide comment text or an image update.",
  });
