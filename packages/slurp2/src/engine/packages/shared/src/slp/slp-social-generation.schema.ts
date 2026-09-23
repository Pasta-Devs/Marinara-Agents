// ──────────────────────────────────────────────
// Slurp generation schemas. Split from slp-social.schema.ts to stay under the architecture
// line budget; copied from the Engine Noodle schemas with values unchanged.
// ──────────────────────────────────────────────
import {
  SLURP_CONTENT_DELIVERIES,
  SLURP_CONTENT_INTENTS,
  slurpContentDeliveryFits,
  slurpIntentFitsAccess,
} from "./slp-content-axes.js";
import { z } from "zod";
import { slpWardrobeSceneSchema } from "./slp-wardrobe.js";
import {
  SLP_CREATOR_POST_CONTENT_MAX_LENGTH,
  SLP_CREATOR_POST_GUIDE_MAX_LENGTH,
  SLP_CREATOR_REPLY_CONTENT_MAX_LENGTH,
  slpAccountFollowUpdateSchema,
  slpAccountProfileUpdateSchema,
  slpAccountSettingsPatchSchema,
  slpAccountUpdateSchema,
  slpAmbientProfileRerollSchema,
  slpBulkCreatorAccountCreateSchema,
  slpBulkInviteSchema,
  slpCreateInteractionSchema,
  slpCreatePostSchema,
  slpCreatorAccountCreateSchema,
  slpCreatorContentFormatSchema,
  slpCreatorCreateInteractionSchema,
  slpCreatorPostCreateSchema,
  slpCreatorPostTitleSchema,
  slpCreatorPostUpdateSchema,
  slpCreatorRemoveInteractionSchema,
  slpInteractionOwnerSchema,
  slpInteractionTypeSchema,
  slpInteractionUpdateSchema,
  slpInviteSchema,
  slpPollInputSchema,
  slpPollSchema,
  slpPostAccessSchema,
  slpPostImageCropSchema,
  slpPostUpdateSchema,
  slpRemoveInteractionSchema,
  slpSettingsSchema,
  slpSettingsUpdateSchema,
  slpStageProfileDraftRequestSchema,
  slpStageProfileSchema,
} from "./slp-social.schema.js";

const slpGenerationConnectionShape = {
  connectionId: z.string().min(1).optional(),
  debugMode: z.boolean().optional(),
};

export const slpPublicGenerationRequestSchema = z
  .object({
    mode: z.literal("public"),
    ...slpGenerationConnectionShape,
    personaId: z.string().min(1).optional(),
    timeZone: z.string().min(1).max(100).optional(),
    reviewImagePromptsBeforeSend: z.boolean().optional(),
  })
  .strict();

export const slpCreatorPostGuideSchema = z.string().trim().min(1).max(SLP_CREATOR_POST_GUIDE_MAX_LENGTH);

export const slpCreatorProjectWorkSchema = z.string().trim().min(1).max(4000);

const slpCreatorGenerationRequestShape = {
  mode: z.literal("noodler"),
  ...slpGenerationConnectionShape,
  targetAccountId: z.string().min(1),
  format: slpCreatorContentFormatSchema.optional(),
  executionId: z.string().min(1).max(128).optional(),
  noodlerPostGuide: slpCreatorPostGuideSchema.optional(),
  noodlerProjectWork: slpCreatorProjectWorkSchema.optional(),
  // Manual Guide path may ask to review the image prompt before rendering; the autonomous
  // scheduler never sets this (no human in the loop).
  reviewImagePromptsBeforeSend: z.boolean().optional(),
  uploadedImageUrl: z.string().trim().url().max(2000).optional(),
  imageCrop: slpPostImageCropSchema.optional(),
  poll: slpPollInputSchema.nullable().optional(),
  /** A one-shot post purpose from the composer. Outranks the Creator's strategy for this post only. */
  contentIntent: z.enum(SLURP_CONTENT_INTENTS).optional(),
  /** One-shot delivery. It is paired with an intent so incompatible combinations fail early. */
  contentDelivery: z.enum(SLURP_CONTENT_DELIVERIES).optional(),
};

export const slpCreatorGenerationRequestSchema = z
  .object({ ...slpCreatorGenerationRequestShape, access: slpPostAccessSchema.default("public") })
  .strict()
  .superRefine((input, ctx) => {
    if (input.contentIntent && !slurpIntentFitsAccess(input.contentIntent, input.access)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contentIntent"],
        message: "That purpose does not fit a locked post.",
      });
    }
    if (input.contentDelivery && !input.contentIntent) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contentDelivery"], message: "Choose a post purpose too." });
    } else if (
      input.contentDelivery &&
      input.contentIntent &&
      !slurpContentDeliveryFits(input.contentIntent, input.contentDelivery)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contentDelivery"],
        message: "That delivery does not fit this post purpose.",
      });
    }
  });

export const slpGenerationRequestSchema = z.union([
  slpPublicGenerationRequestSchema,
  slpCreatorGenerationRequestSchema,
]);

export const slpRescheduleRefreshSchema = z.object({
  scheduledTime: z.string().datetime(),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u, "Use a 24-hour time in HH:mm format."),
});

export const slpGeneratedPostSchema = z.object({
  tempId: z.string().min(1).optional(),
  authorHandle: z.string().min(1),
  content: z.string().min(1).max(4000),
  imagePrompt: z.string().max(2000).nullable().optional(),
  attachGalleryImage: z.boolean().optional().default(false),
  poll: slpPollInputSchema.nullable().optional(),
});

export const slpGeneratedCreatorPostSchema = z
  .object({
    title: slpCreatorPostTitleSchema,
    content: z.string().trim().min(1).max(SLP_CREATOR_POST_CONTENT_MAX_LENGTH),
    imagePrompt: z.string().max(2000).nullable().optional(),
    scene: slpWardrobeSceneSchema.nullable().optional(),
    poll: slpPollInputSchema.nullable().optional(),
  })
  .strip()
  .transform(({ title, content, imagePrompt, scene }) => ({
    title,
    content,
    imagePrompt: imagePrompt ?? null,
    scene: scene ?? null,
  }));

export const slpGeneratedCreatorReplySchema = z
  .object({ content: z.string().trim().min(1).max(SLP_CREATOR_REPLY_CONTENT_MAX_LENGTH) })
  .strip();

export const slpGeneratedInteractionSchema = z
  .object({
    actorHandle: z.string().min(1),
    targetTempId: z
      .string()
      .min(1)
      .nullish()
      .transform((value) => value ?? undefined),
    targetPostId: z
      .string()
      .min(1)
      .nullish()
      .transform((value) => value ?? undefined),
    parentInteractionId: z
      .string()
      .min(1)
      .nullish()
      .transform((value) => value ?? undefined),
    type: slpInteractionTypeSchema,
    content: z.string().max(2000).nullable().optional(),
    pollOptionIndex: z
      .number()
      .int()
      .min(0)
      .max(3)
      .nullish()
      .transform((value) => value ?? undefined),
  })
  .strip()
  .superRefine((interaction, ctx) => {
    if (interaction.type === "vote" && interaction.pollOptionIndex === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pollOptionIndex"],
        message: "Poll votes require a poll option index.",
      });
    }
    if (interaction.type !== "reply" && interaction.parentInteractionId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentInteractionId"],
        message: "Only replies can target an existing comment.",
      });
    }
  });

export const slpGeneratedFanActivitySchema = z
  .object({
    actorHandle: z.string().min(1),
    creatorAccountId: z.string().min(1),
    targetPostId: z.string().min(1),
    type: z.enum(["like", "reply", "repost"]),
    content: z.string().trim().max(2000).nullable().optional(),
  })
  .strip();

export const slpGeneratedFollowSchema = z
  .object({
    actorHandle: z.string().min(1),
    targetHandle: z.string().min(1),
  })
  .strip();

export const slpGeneratedDigestSchema = z
  .object({
    accountEntityIds: z.array(z.string().min(1)).default([]),
    content: z.string().min(1).max(1200),
  })
  .strip();

function boundedGeneratedProfileText(maxLength: number, minimumLength = 0) {
  return z
    .string()
    .transform((value) => {
      if (value.length <= maxLength) return value;
      const truncated = value.slice(0, maxLength);
      // Avoid leaving a dangling UTF-16 high surrogate when truncating emoji.
      return /[\uD800-\uDBFF]$/.test(truncated) ? truncated.slice(0, -1) : truncated;
    })
    .pipe(z.string().min(minimumLength).max(maxLength));
}

export const slpGeneratedProfileSchema = z
  .object({
    entityId: z.string().min(1),
    name: boundedGeneratedProfileText(120, 1),
    handle: boundedGeneratedProfileText(40, 1),
    bio: boundedGeneratedProfileText(500).default(""),
    location: boundedGeneratedProfileText(120).default(""),
  })
  .strip();

export const slpGeneratedRefreshSchema = z
  .object({
    posts: z.array(slpGeneratedPostSchema).default([]),
    interactions: z.array(slpGeneratedInteractionSchema).default([]),
    follows: z.array(slpGeneratedFollowSchema).default([]),
    digests: z.array(slpGeneratedDigestSchema).default([]),
  })
  .strip();

export const slpGeneratedFanRefreshSchema = z
  .object({
    activities: z.array(slpGeneratedFanActivitySchema).default([]),
  })
  .strip();

export type SlpGeneratedFanRefresh = z.infer<typeof slpGeneratedFanRefreshSchema>;

export const slpGeneratedProfilesSchema = z
  .object({
    profiles: z.array(slpGeneratedProfileSchema).default([]),
  })
  .strip();

export type SlpSettingsInput = z.infer<typeof slpSettingsSchema>;
export type SlpSettingsUpdateInput = z.infer<typeof slpSettingsUpdateSchema>;
export type SlpAccountUpdateInput = z.infer<typeof slpAccountUpdateSchema>;
export type SlpAccountProfileUpdateInput = z.infer<typeof slpAccountProfileUpdateSchema>;
export type SlpAccountSettingsPatchInput = z.infer<typeof slpAccountSettingsPatchSchema>;
export type SlpAccountFollowUpdateInput = z.infer<typeof slpAccountFollowUpdateSchema>;
export type SlpAmbientProfileRerollInput = z.infer<typeof slpAmbientProfileRerollSchema>;
export type SlpAmbientProfileRerollOutcome = {
  accountId: string;
  status: "updated" | "invalid_response" | "error";
};
export type SlpCreatorAccountCreateInput = z.infer<typeof slpCreatorAccountCreateSchema>;
export type SlpBulkCreatorAccountCreateInput = z.infer<typeof slpBulkCreatorAccountCreateSchema>;
export type SlpStageProfileInput = z.infer<typeof slpStageProfileSchema>;
export type SlpStageProfileDraftRequest = z.infer<typeof slpStageProfileDraftRequestSchema>;
export type SlpInviteInput = z.infer<typeof slpInviteSchema>;
export type SlpBulkInviteInput = z.infer<typeof slpBulkInviteSchema>;
export type SlpPollInput = z.infer<typeof slpPollInputSchema>;
export type SlpPollData = z.infer<typeof slpPollSchema>;
export type SlpCreatePostInput = z.infer<typeof slpCreatePostSchema>;
export type SlpPostUpdateInput = z.infer<typeof slpPostUpdateSchema>;
export type SlpCreatorPostCreateInput = z.infer<typeof slpCreatorPostCreateSchema>;
export type SlpCreatorPostUpdateInput = z.infer<typeof slpCreatorPostUpdateSchema>;
export type SlpCreateInteractionInput = z.infer<typeof slpCreateInteractionSchema>;
export type SlpRemoveInteractionInput = z.infer<typeof slpRemoveInteractionSchema>;
export type SlpInteractionOwnerInput = z.infer<typeof slpInteractionOwnerSchema>;
export type SlpInteractionUpdateInput = z.infer<typeof slpInteractionUpdateSchema>;
export type SlpCreatorCreateInteractionInput = z.infer<typeof slpCreatorCreateInteractionSchema>;
export type SlpCreatorRemoveInteractionInput = z.infer<typeof slpCreatorRemoveInteractionSchema>;
type InferredSlpPublicGenerationRequest = z.infer<typeof slpPublicGenerationRequestSchema>;
type AssertNoKeys<T extends never> = T;
export type SlpPublicGenerationRequest = InferredSlpPublicGenerationRequest &
  Record<
    AssertNoKeys<
      Extract<keyof InferredSlpPublicGenerationRequest, "targetAccountId" | "noodlerPostGuide" | "noodlerProjectWork">
    >,
    never
  >;
export type SlpCreatorPostGuide = z.infer<typeof slpCreatorPostGuideSchema>;
export type SlpCreatorProjectWork = z.infer<typeof slpCreatorProjectWorkSchema>;
export type SlpCreatorGenerationRequest = z.infer<typeof slpCreatorGenerationRequestSchema>;
export type SlpGenerationRequest = z.infer<typeof slpGenerationRequestSchema>;
export type SlpRescheduleRefreshInput = z.infer<typeof slpRescheduleRefreshSchema>;
export type SlpGeneratedRefresh = z.infer<typeof slpGeneratedRefreshSchema>;
export type SlpGeneratedProfiles = z.infer<typeof slpGeneratedProfilesSchema>;
export type SlpGeneratedProfile = z.infer<typeof slpGeneratedProfileSchema>;
