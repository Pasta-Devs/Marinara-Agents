// ──────────────────────────────────────────────
// Routes: Noodle Fake Social Media
// ──────────────────────────────────────────────
import { existsSync, readFileSync } from "fs";
import { basename, dirname } from "path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { extname } from "node:path";
import { z } from "zod";
import {
  createNoodlePoll,
  noodleBulkNoodlerAccountCreateSchema,
  noodlerPostCreateWithMediaSchema,
  noodlerGenerationRequestSchema,
  noodlerPostUpdateSchema,
  noodlerAccountCreateSchema,
  noodlerCreatorReplyRequestSchema,
  noodlerCreateInteractionSchema,
  noodlerRemoveInteractionSchema,
  noodlerTargetedRefreshSchema,
  noodlerSubscriptionSchema,
  noodlerUnlockSchema,
  noodlerViewerPersonaSchema,
  noodleGenerationRequestSchema,
  noodleAccountSettingsPatchSchema,
  noodleAmbientProfileRerollSchema,
  noodleInteractionUpdateSchema,
  noodleStageProfileUpdateSchema,
  noodleStageProfileDraftRequestSchema,
  readNoodlePollFromMetadata,
  type NoodleAccount,
  type NoodlerManagedPost,
  type NoodlerSubscriber,
  type NoodlerPostView,
} from "@marinara-engine/shared";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createCharacterGalleryStorage } from "../services/storage/character-gallery.storage.js";
import { resolveNoodlerCreatorArtwork } from "../services/slurp/slurp-public-profiles.service.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createSlurpStorage, slurpSettingsSchema } from "../services/storage/slurp.storage.js";
import { NOODLER_SUBSCRIPTION_COST, noodlerUnlockPriceFromMetadata } from "../services/slurp/slurp-prices.js";
import { settleAgentJobsWithConcurrencyLimit } from "../services/agents/agent-concurrency.js";
import { logger } from "../lib/logger.js";
import { isFileUniqueConstraintError } from "../db/file-schema.js";
import { isAllowedImageBuffer, safeFetch } from "../utils/security.js";

import { NOODLER_FAN_IDENTITY_PREFIX } from "../services/slurp/slurp-fan-identity-provider.js";
import {
  buildNoodlerPublicIdentity,
  stageProfileContainsPublicIdentity,
  stageProfileContainsSourceDetails,
} from "../services/slurp/slurp-generation.service.js";
import {
  createNoodlerPost,
  generateAndApplyNoodlerPost,
  refreshAllNoodlerCreatorsNow,
  refreshTargetedNoodlerCreatorsNow,
  updateNoodlerPostWithMedia,
} from "../services/slurp/slurp-post.operation.js";
import { tryNoodlerAccountOperation } from "../services/slurp/slurp-account-operation-lock.js";
import { trySlurpDataDeletion, trySlurpWrite } from "../services/slurp/slurp-operation-lock.js";
import { removeAllNoodlerMedia } from "../services/slurp/slurp-media.js";
import { clearNoodlerImageConnections } from "../services/slurp/slurp-image-connections.js";
import { generateAndApplyNoodlerCreatorReply } from "../services/slurp/slurp-creator-reply.operation.js";
import { getNoodlerFanActivityStatus, runNoodlerFanActivity } from "../services/slurp/slurp-fan-activity.operation.js";
import { admissionModeForRequest, isConnectionAdmissionFailure } from "../services/generation/connection-admission.js";
import {
  exportGarnishAds,
  importGarnishAds,
  GARNISH_EXPORT_VERSION,
} from "../services/garnish-ads/garnish-ads.export.js";
import { createGarnishAds } from "../services/garnish-ads/garnish-ads.service.js";
import type { GarnishAd } from "../services/garnish-ads/garnish-ads.types.js";
// Used by the ad generate route. These were referenced without ever being imported, so every
// generate call died with a ReferenceError that the route reported as a bare 502.
import { generateGarnishAds, retireWeakGarnishAds } from "../services/slurp/slurp-garnish-generation.service.js";
import { qualityScores } from "../services/garnish-ads/garnish-ads.rating.js";
import { newId } from "../utils/id-generator.js";
import { SLURP_GARNISH_PLATFORM, garnishContextForViewer } from "../services/slurp/slurp-garnish-context.js";
import { generateGarnishAdImage } from "../services/slurp/slurp-garnish-image.service.js";
import { resolveGarnishAdImageAbsolutePath, unlinkGarnishAdImage } from "../services/slurp/slurp-garnish-image.js";
import { readGarnishLorebookContext } from "../services/slurp/slurp-garnish-lorebook.js";
import { syncGarnishAdsWithLorebook } from "../services/slurp/slurp-garnish-sync.service.js";
import { createLorebooksStorage } from "../services/storage/lorebooks.storage.js";
import { generateNoodlerStageProfileDraft } from "../services/slurp/slurp-stage-profile-draft.service.js";
import {
  getNoodlerImageConnections,
  updateNoodlerImageConnections,
} from "../services/slurp/slurp-image-connections.js";
import { verifyNoodlerSourceRevisionToken } from "../services/slurp/slurp-source-revision.js";
import { compareNoodlerSourceSnapshots, minimizeNoodlerSourceSnapshot } from "../services/slurp/slurp-source.js";
import { resolveNoodlerSourceSnapshot } from "../services/slurp/slurp-source-resolve.js";
import { canViewNoodlerPost, isNoodlerHiddenFromViewer } from "../services/slurp/slurp-access.js";
import { noodlerUnseenCreatorAccountIds } from "../services/slurp/slurp-viewer-unseen.js";
import { noodlerDisclosureReviewReasons, projectNoodlerAudienceProfile } from "../services/slurp/slurp-disclosure.js";
import { createNoodlerNoodleImagesService } from "../services/slurp/slurp-images.service.js";
import {
  NOODLER_MEDIA_URL_PREFIX,
  noodlerPostMediaUrlForPersona,
  readNoodlerLockedTeaser,
  resolveNoodlerMediaVariant,
  readNoodlerMediaPath,
  removeNoodlerAccountMedia,
  resolveNoodlerMediaAbsolutePath,
  type NoodlerPostMediaUpload,
  unlinkNoodlerMedia,
} from "../services/slurp/slurp-media.js";
import {
  readNoodlerAvatarMediaPath,
  resolveNoodlerAvatarAbsolutePath,
  stageNoodlerAvatar,
  stageNoodlerBanner,
  unlinkNoodlerAvatar,
  unlinkNoodlerBanner,
  resolveNoodlerBannerAbsolutePath,
} from "../services/slurp/slurp-avatar.js";
import { renderSlurpShareCard } from "../services/slurp/slurp-share-card.js";
import { getErrorMessage, resolvePersonaAccount } from "../services/slurp/slurp-public-support.js";
import { generateNoodlerCreatorArtwork } from "../services/slurp/slurp-artwork.operation.js";
import { slurpMessageRoutes } from "./slurp-messages.routes.js";
import { resolveSlurpTextConnection } from "../services/slurp/slurp-connection.js";
import {
  slurpCreatorReach,
  slurpPostLikeCount,
  slurpPostReplyCount,
  slurpPostImpressions,
  slurpPostUnlockCount,
} from "../services/slurp/slurp-reach.js";
import { slurpFollowerMilestone, slurpMilestonesCrossed } from "../services/slurp/slurp-milestones.js";
import { createSlurpEventsStorage } from "../services/storage/slurp-events.storage.js";
import { groupSlurpEvents } from "../services/slurp/slurp-event-weight.js";
import {
  slurpGoalProgress,
  SLURP_GOAL_LABEL_MAX_LENGTH,
  SLURP_GOAL_MAX_TARGET,
  SLURP_GOAL_MIN_TARGET,
} from "../services/slurp/slurp-goal.js";
import { readSlurpStudioSnapshot, writeSlurpStudioSnapshot } from "../services/slurp/slurp-studio-snapshot.js";
import { rerollAmbientNoodleProfiles } from "../services/slurp/slurp-ambient-profile-generation.service.js";
import { ensureAmbientNoodleAccounts, isAmbientNoodleAccount } from "../services/slurp/slurp-ambient-profiles.js";
import { generateInvitedNoodlePostDraft } from "../services/slurp/slurp-invited-post-draft.service.js";
import { isDirectlyInvitedNoodleCharacter } from "../services/slurp/slurp-invited-post-draft-access.js";
import { tryNoodleOperation } from "../services/slurp/slurp-operation-lock.js";

const slurpTargetedRefreshSchema = noodlerTargetedRefreshSchema.extend({
  access: z.enum(["public", "locked"]).optional(),
});

const slurpPostTypeSchema = z.enum(["post", "story"]);
// The packaged shared bundle wraps this schema in a refinement, so `.extend` is not always
// available. Extend the underlying object and re-run the full base schema in a refinement.
const slurpNoodlerPostCreateBaseSchema = (
  noodlerPostCreateWithMediaSchema instanceof z.ZodEffects
    ? noodlerPostCreateWithMediaSchema.innerType()
    : noodlerPostCreateWithMediaSchema
) as typeof noodlerPostCreateWithMediaSchema;
const slurpNoodlerPostCreateWithMediaSchema = slurpNoodlerPostCreateBaseSchema
  .extend({
    postType: slurpPostTypeSchema.default("post"),
    linkedPostId: z.string().trim().min(1).nullable().optional(),
  })
  .superRefine(({ postType: _postType, linkedPostId: _linkedPostId, ...rest }, ctx) => {
    const result = noodlerPostCreateWithMediaSchema.safeParse(rest);
    if (!result.success) {
      for (const issue of result.error.issues) ctx.addIssue(issue);
    }
  });
const slurpNoodlerPostCreateSchema = slurpNoodlerPostCreateWithMediaSchema.superRefine((input, ctx) => {
  if (!input.content && !input.poll && !input.uploadedImageUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["content"],
      message: "Posts need a body, image, or poll.",
    });
  }
});

function requestRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

const noodleImagePromptConfirmationSchema = z.object({
  prompts: z
    .array(
      z.object({
        id: z.string().min(1),
        prompt: z.string().trim().min(1).max(20_000),
        negativePrompt: z.string().trim().max(20_000).optional(),
      }),
    )
    .max(20),
  debugMode: z.boolean().optional(),
});

const slurpBulkNoodlerAccountCreateSchema = noodleBulkNoodlerAccountCreateSchema.extend({
  connectionId: z.string().min(1).nullable().optional(),
});

const noodleStageProfileUpdateRequestSchema = noodleStageProfileUpdateSchema.extend({
  location: z.string().trim().max(120).optional(),
  sourceRevisionToken: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/u)
    .optional(),
  confirmAvatarReview: z.boolean().optional(),
});

/** The `identity` lock is shared by refresh, reroll, and profile edits, so the 409 stays operation-neutral. */
const NOODLE_IDENTITY_LOCK_BUSY = "Another Noodle identity operation is already running. Wait for it to finish.";
const NOODLER_MEDIA_MAX_BYTES = 20 * 1024 * 1024;
const NOODLER_FEED_PAGE_SIZE = 20;
const NOODLER_MEDIA_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);

const noodlerPageCursorSchema = z
  .object({
    cursorAt: z.string().datetime().optional(),
    cursorId: z.string().trim().min(1).max(200).optional(),
  })
  .refine(
    (value) => Boolean(value.cursorAt) === Boolean(value.cursorId),
    "cursorAt and cursorId must be provided together",
  );

const noodlerViewerFeedQuerySchema = noodlerViewerPersonaSchema
  .extend({
    tab: z.enum(["following", "all"]).default("all"),
    search: z.string().trim().max(200).default(""),
    limit: z.coerce.number().int().min(1).max(NOODLER_FEED_PAGE_SIZE).default(NOODLER_FEED_PAGE_SIZE),
    cursorAt: z.string().datetime().optional(),
    cursorId: z.string().trim().min(1).max(200).optional(),
  })
  .refine(
    (value) => Boolean(value.cursorAt) === Boolean(value.cursorId),
    "cursorAt and cursorId must be provided together",
  );

const noodlerProfilePostsQuerySchema = noodlerPageCursorSchema.and(
  z.object({
    personaId: z.string().trim().min(1).optional(),
    filter: z.enum(["posts", "media"]).default("posts"),
    limit: z.coerce.number().int().min(1).max(NOODLER_FEED_PAGE_SIZE).default(NOODLER_FEED_PAGE_SIZE),
  }),
);

const noodlerSubscriberPageQuerySchema = noodlerPageCursorSchema.and(
  z.object({
    limit: z.coerce.number().int().min(1).max(NOODLER_FEED_PAGE_SIZE).default(NOODLER_FEED_PAGE_SIZE),
  }),
);

type NoodlerViewerSignalResponse = {
  count: number;
  revision: {
    latestPost: string | null;
    latestPostId: string | null;
    latestPostAccountId: string | null;
    latestPostUpdate: string | null;
    updatedPostId: string | null;
    updatedPostAccountId: string | null;
    latestInteraction: string | null;
    interactionPostId: string | null;
    latestCreator: string | null;
  };
};

class NoodlerMediaRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

async function readNoodlerMultipart(req: FastifyRequest): Promise<{ payload: unknown; media: NoodlerPostMediaUpload }> {
  let payload: unknown;
  let media: NoodlerPostMediaUpload | null = null;
  for await (const part of req.parts({
    limits: { fileSize: NOODLER_MEDIA_MAX_BYTES, files: 1 },
  })) {
    if (part.type === "field") {
      if (part.fieldname === "payload") {
        try {
          payload = JSON.parse(String(part.value));
        } catch {
          throw new NoodlerMediaRequestError("The image request payload is invalid.", 400);
        }
      }
      continue;
    }
    if (part.fieldname !== "file" || media) {
      part.file.resume();
      throw new NoodlerMediaRequestError("Upload one image in the file field.", 400);
    }
    const extension = extname(part.filename).toLowerCase();
    if (!NOODLER_MEDIA_EXTENSIONS.has(extension)) {
      part.file.resume();
      throw new NoodlerMediaRequestError("Unsupported image file type.", 400);
    }
    const write = await trySlurpWrite(async () => {
      try {
        return await part.toBuffer();
      } catch (error) {
        const truncated = (part.file as typeof part.file & { truncated?: boolean }).truncated === true;
        const tooLarge = truncated || (error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE";
        throw new NoodlerMediaRequestError(
          tooLarge ? "NoodleR image is too large." : "Failed to read the uploaded image.",
          tooLarge ? 413 : 400,
        );
      }
    });
    if (!write.acquired) {
      part.file.resume();
      throw new NoodlerMediaRequestError("Slurp data cleanup is in progress.", 409);
    }
    const buffer = write.value;
    const detected = isAllowedImageBuffer(buffer, extension);
    if (!detected || (extension === ".jpeg" ? "jpg" : extension.slice(1)) !== detected.ext) {
      throw new NoodlerMediaRequestError("Unsupported or invalid image file.", 400);
    }
    media = { buffer, extension: detected.ext };
  }
  if (payload === undefined) {
    throw new NoodlerMediaRequestError("The image request payload is required.", 400);
  }
  if (!media) throw new NoodlerMediaRequestError("Upload one image in the file field.", 400);
  return { payload, media };
}

async function importNoodlerMedia(imageUrl: string): Promise<NoodlerPostMediaUpload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await safeFetch(imageUrl, {
      signal: controller.signal,
      policy: {
        allowLocal: false,
        allowLoopback: false,
        allowedProtocols: ["http:", "https:"],
        maxRedirects: 3,
      },
      maxResponseBytes: NOODLER_MEDIA_MAX_BYTES,
      allowedContentTypes: ["image/"],
      allowMissingContentType: true,
      headers: { Accept: "image/*" },
    });
    if (!response.ok) {
      throw new NoodlerMediaRequestError(`Image URL returned HTTP ${response.status}.`, 400);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const detected = isAllowedImageBuffer(buffer);
    if (!detected) {
      throw new NoodlerMediaRequestError("The URL did not return a supported image.", 415);
    }
    return { buffer, extension: detected.ext };
  } catch (error) {
    if (error instanceof NoodlerMediaRequestError) throw error;
    logger.warn(error, "[noodler] Could not import image URL");
    const tooLarge = error instanceof Error && /exceeded \d+ bytes/iu.test(error.message);
    throw new NoodlerMediaRequestError(
      tooLarge
        ? "NoodleR image is too large."
        : "Could not download that image URL. Check that it is public and points directly to an image.",
      tooLarge ? 413 : 400,
    );
  } finally {
    clearTimeout(timeout);
  }
}

type DecodedNoodlerMediaRequest<T> =
  { success: true; data: T; media: NoodlerPostMediaUpload | undefined } | { success: false; error: z.ZodError };

async function decodeNoodlerMediaRequest<WithMediaSchema extends z.ZodTypeAny, WithoutMediaSchema extends z.ZodTypeAny>(
  req: FastifyRequest,
  schemas: { withMedia: WithMediaSchema; withoutMedia: WithoutMediaSchema },
): Promise<DecodedNoodlerMediaRequest<z.output<WithMediaSchema> | z.output<WithoutMediaSchema>>> {
  let payload: unknown = req.body;
  let media: NoodlerPostMediaUpload | undefined;
  if (req.headers["content-type"]?.startsWith("multipart/form-data")) {
    const multipart = await readNoodlerMultipart(req);
    payload = multipart.payload;
    media = multipart.media;
  }

  const parsedForUrl = schemas.withMedia.safeParse(payload);
  const uploadedImageUrl =
    parsedForUrl.success && typeof (parsedForUrl.data as { uploadedImageUrl?: unknown }).uploadedImageUrl === "string"
      ? (parsedForUrl.data as { uploadedImageUrl: string }).uploadedImageUrl
      : undefined;
  if (uploadedImageUrl) {
    if (media) {
      throw new NoodlerMediaRequestError("Choose either an uploaded file or an image URL.", 400);
    }
    media = await importNoodlerMedia(uploadedImageUrl);
  }

  const parsed = (media ? schemas.withMedia : schemas.withoutMedia).safeParse(payload);
  return parsed.success ? { success: true, data: parsed.data, media } : { success: false, error: parsed.error };
}

function sendNoodlerMediaError(reply: FastifyReply, error: unknown) {
  const tooLarge = (error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE";
  const statusCode = tooLarge ? 413 : error instanceof NoodlerMediaRequestError ? error.statusCode : 500;
  if (statusCode === 500) logger.error(error, "[noodler] Image request failed");
  return reply.code(statusCode).send({
    error:
      statusCode === 500
        ? "Image request failed."
        : tooLarge
          ? "NoodleR image is too large."
          : (error as Error).message,
  });
}

export async function slurpRoutes(app: FastifyInstance) {
  const noodle = createSlurpStorage(app.db);
  const characters = createCharactersStorage(app.db);
  const characterGallery = createCharacterGalleryStorage(app.db);
  const connections = createConnectionsStorage(app.db);
  const noodlerImages = createNoodlerNoodleImagesService(app.db);
  const ads = createGarnishAds(app.db);
  const garnishAdInputSchema = z.object({
    id: z.string().trim().min(1).max(120).optional(),
    kind: z.enum(["creator", "inline"]).default("inline"),
    brand: z.string().trim().min(1).max(80),
    product: z.string().trim().min(1).max(120),
    copy: z.string().trim().min(1).max(600),
    categories: z.array(z.string().trim().min(1).max(32)).max(12).default([]),
    contextTags: z.array(z.string().trim().min(1).max(32)).max(12).default([]),
    imageUrl: z.string().trim().max(2048).nullable().optional(),
    actionLabel: z.string().trim().min(1).max(40).optional(),
    contentRating: z.enum(["tame", "suggestive", "explicit"]).default("tame"),
  });
  const noodlerViewerSignalCache = new Map<string, { generationKey: string; value: NoodlerViewerSignalResponse }>();

  async function resolveNoodlerPublicIdentity(publicAccount: NoodleAccount) {
    const source =
      publicAccount.kind === "character"
        ? await characters.getById(publicAccount.entityId)
        : publicAccount.kind === "persona"
          ? await characters
              .getPersona(publicAccount.entityId)
              .then((persona) => (persona ? { data: { name: persona.name } } : null))
          : null;
    return buildNoodlerPublicIdentity(publicAccount, source);
  }

  app.get("/settings", async () => noodle.getSlurpSettings());
  app.patch("/settings", async (req, reply) => {
    const body = slurpSettingsSchema.partial().safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    return noodle.updateSlurpSettings(body.data);
  });

  /**
   * The managed ambient roster, seeded on read.
   *
   * The reroll below takes explicit account ids, so the client needs to see the crowd before it
   * can change any of it.
   */
  app.get("/ambient-profiles", async () => {
    const settings = await noodle.getSettings();
    const accounts = await ensureAmbientNoodleAccounts(noodle, settings.allowRandomUsers);
    return {
      allowRandomUsers: settings.allowRandomUsers,
      items: accounts.map((account) => ({
        id: account.id,
        handle: account.handle,
        displayName: account.displayName,
        bio: account.bio,
        avatarUrl: account.avatarUrl,
      })),
    };
  });

  /**
   * Reroll the generated identities of the managed ambient profiles.
   *
   * Restored after the standalone Noodle/Slurp split dropped the route but kept the service, which
   * left the feature unreachable. Serialized on the shared `identity` lock, because a reroll and a
   * profile edit rewriting the same accounts would interleave.
   */
  app.post("/ambient-profiles/reroll", async (req, reply) => {
    const parsed = noodleAmbientProfileRerollSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const settings = await noodle.getSettings();
    const connection = await resolveSlurpTextConnection(connections, settings.generationConnectionId);
    if (!connection) return reply.code(400).send({ error: "Select a Slurp generation connection first." });
    const operation = await tryNoodleOperation("identity", async () => {
      await ensureAmbientNoodleAccounts(noodle, settings.allowRandomUsers);
      const accounts = (await Promise.all(parsed.data.accountIds.map((id) => noodle.getAccountById(id)))).filter(
        (account): account is NoodleAccount => account !== null,
      );
      if (accounts.length !== parsed.data.accountIds.length || accounts.some((a) => !isAmbientNoodleAccount(a))) {
        return { status: "invalid" } as const;
      }
      return {
        status: "ok" as const,
        result: await rerollAmbientNoodleProfiles({
          db: app.db,
          noodle,
          accounts,
          connection,
          debugMode: parsed.data.debugMode ?? false,
        }),
      };
    });
    if (!operation.acquired) return reply.code(409).send({ error: NOODLE_IDENTITY_LOCK_BUSY });
    if (operation.value.status === "invalid") {
      return reply.code(400).send({ error: "Only managed ambient Slurp profiles can be rerolled." });
    }
    return operation.value.result;
  });

  app.patch("/accounts/:id/settings", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = noodleAccountSettingsPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const account = await noodle.getNoodlerAccountById(id);
    if (!account) return reply.code(404).send({ error: "Creator account not found" });
    if (
      account.sourceKind === "persona" &&
      account.kind === "persona" &&
      parsed.data.subtree === "scheduler" &&
      parsed.data.patch.autoPosting?.enabled === true
    ) {
      return reply.code(400).send({ error: "Persona-owned Slurp profiles cannot post automatically." });
    }
    const updated = await noodle.patchAccountSettings(id, parsed.data);
    if (!updated) return reply.code(404).send({ error: "Creator account not found" });
    return updated;
  });

  app.patch("/accounts/:id/profile", async (req, reply) => {
    const parsed = z.object({ profile: z.object({ location: z.string().trim().max(120) }) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const updated = await noodle.updateAccountProfile(id, { profile: parsed.data.profile });
    if (!updated) return reply.code(404).send({ error: "Creator account not found" });
    return updated;
  });

  app.get("/noodler/accounts", async (_req, reply) => {
    return noodle.listNoodlerStageProfiles();
  });

  /**
   * One viewer's wallet: balance, recent ledger, and paid-through dates. Reading it is what pays
   * the daily stipend and charges due renewals, so the wallet page is also the economy's clock.
   */
  app.get("/noodler/viewer/wallet", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    return noodle.getWallet(viewer.id);
  });

  app.post("/noodler/viewer/wallet/daily-refill", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    return noodle.claimWalletRefill(viewer.id);
  });

  app.post("/noodler/accounts/:id/tip", async (req, reply) => {
    const parsed = z
      .object({ personaId: z.string().trim().min(1), amount: z.number().int().min(1).max(9999) })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const wallet = await noodle.tipCreator(viewer.id, (req.params as { id: string }).id, parsed.data.amount);
    if (!wallet) return reply.code(402).send({ error: "Unable to send tip" });
    return wallet;
  });

  /** A creator's own weekly price. `null` clears it back to the Slurp-wide default. */
  app.put("/noodler/accounts/:id/subscription-price", async (req, reply) => {
    const parsed = z.object({ price: z.number().int().min(0).max(9999).nullable() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const creator = await noodle.getNoodlerAccountById(id);
    if (!creator) return reply.code(404).send({ error: "Stage profile not found" });
    await noodle.setCreatorSubscriptionPrice(id, parsed.data.price);
    return { price: await noodle.getCreatorSubscriptionPrice(id) };
  });

  app.get("/noodler/viewer-wallets", async (_req, reply) => {
    const personas = await characters.listPersonas();
    return noodle.listViewerWallets(personas.map((persona) => persona.id));
  });

  // Fan and follower totals per creator account, so a list of profiles needs one request
  // instead of one per row. Keyed by creator account id.
  // ponytail: counts by scanning; swap for aggregate queries if a player ever keeps
  // enough creator profiles for this to show up in the request time.
  app.get("/noodler/account-connection-counts", async (_req, _reply) => {
    const [creators, accounts] = await Promise.all([noodle.listNoodlerAccounts(), noodle.listAccounts()]);
    const followerCounts = new Map<string, number>();
    for (const account of accounts) {
      for (const followedId of account.settings.social.followingAccountIds ?? []) {
        followerCounts.set(followedId, (followerCounts.get(followedId) ?? 0) + 1);
      }
    }
    const at = new Date();
    const entries = await Promise.all(
      creators.map(async (creator) => [
        creator.id,
        {
          // Fans are subscribers, and a subscriber is a wallet that pays. That number stays exact.
          fans: (await noodle.listSubscriptionsForCreator(creator.id)).length,
          // Followers are social proof and nothing charges against them, so they carry the
          // synthetic platform reach. Real followers are folded in at a heavy weight.
          followers: slurpCreatorReach(
            {
              accountId: creator.id,
              createdAt: creator.createdAt,
              realFollowers: followerCounts.get(creator.id) ?? 0,
            },
            at,
          ),
        },
      ]),
    );
    return Object.fromEntries(entries) as Record<string, { fans: number; followers: number }>;
  });

  app.get("/noodler/accounts/:id/avatar/:fileName", async (req, reply) => {
    const { id, fileName } = req.params as { id: string; fileName: string };
    const account = await noodle.getNoodlerAccountById(id);
    const candidates = account
      ? [
          resolveNoodlerAvatarAbsolutePath(id, account.avatarUrl),
          // Banners generated before the banner route existed were stored under this prefix.
          resolveNoodlerBannerAbsolutePath(id, account.settings.profile.bannerUrl ?? null),
        ]
      : [];
    const absolute = candidates.find(
      (candidate) => candidate && basename(candidate) === fileName && existsSync(candidate),
    );
    if (!absolute) {
      return reply.code(404).send({ error: "Not Found" });
    }
    const width = z.coerce
      .number()
      .int()
      .optional()
      .safeParse((req.query as { width?: string }).width);
    const served = await resolveNoodlerMediaVariant(absolute, width.success ? width.data : undefined);
    return reply
      .header("Cache-Control", "private, max-age=31536000, immutable")
      .sendFile(basename(served), dirname(served));
  });

  app.get("/noodler/accounts/:id/banner/:fileName", async (req, reply) => {
    const { id, fileName } = req.params as { id: string; fileName: string };
    const account = await noodle.getNoodlerAccountById(id);
    const absolute = account ? resolveNoodlerBannerAbsolutePath(id, account.settings.profile.bannerUrl ?? null) : null;
    if (!absolute || basename(absolute) !== fileName || !existsSync(absolute)) {
      return reply.code(404).send({ error: "Not Found" });
    }
    const width = z.coerce
      .number()
      .int()
      .optional()
      .safeParse((req.query as { width?: string }).width);
    const served = await resolveNoodlerMediaVariant(absolute, width.success ? width.data : undefined);
    return reply
      .header("Cache-Control", "private, max-age=31536000, immutable")
      .sendFile(basename(served), dirname(served));
  });

  app.post("/noodler/accounts/:id/avatar", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const { media } = await readNoodlerMultipart(req);
      const locked = await tryNoodlerAccountOperation(id, async () => {
        const account = await noodle.getNoodlerAccountById(id);
        if (!account) return null;
        const staged = stageNoodlerAvatar(id, media);
        try {
          staged.promote();
          const updated = await noodle.updateNoodlerAvatar(id, staged.avatarUrl);
          if (!updated) {
            staged.compensate();
            return null;
          }
          unlinkNoodlerAvatar(id, account.avatarUrl);
          return (await noodle.listNoodlerStageProfiles()).find((profile) => profile.id === id) ?? null;
        } catch (error) {
          staged.compensate();
          throw error;
        }
      });
      if (!locked.acquired)
        return reply.code(409).send({ error: "Another operation for this NoodleR account is already running." });
      if (!locked.value) return reply.code(404).send({ error: "NoodleR stage profile not found" });
      return locked.value;
    } catch (error) {
      return sendNoodlerMediaError(reply, error);
    }
  });

  app.patch("/noodler/accounts/:id/avatar/source", async (req, reply) => {
    const { id } = req.params as { id: string };
    const locked = await tryNoodlerAccountOperation(id, async () => {
      const account = await noodle.getNoodlerAccountById(id);
      if (!account || (account.settings.privacy.identityDisclosure ?? "secret") !== "open") return null;
      const source = await noodle.resolveAccountSource(account);
      if (!source?.avatarUrl) return false;
      const oldAvatarUrl = account.avatarUrl;
      const updated = await noodle.updateNoodlerAvatar(id, source.avatarUrl);
      if (updated) unlinkNoodlerAvatar(id, oldAvatarUrl);
      return (await noodle.listNoodlerStageProfiles()).find((profile) => profile.id === id) ?? null;
    });
    if (!locked.acquired)
      return reply.code(409).send({ error: "Another operation for this NoodleR account is already running." });
    if (locked.value === false) return reply.code(409).send({ error: "The linked source does not have an avatar." });
    if (!locked.value) return reply.code(404).send({ error: "An Open NoodleR stage profile was not found." });
    return locked.value;
  });

  app.delete("/noodler/accounts/:id/avatar", async (req, reply) => {
    const { id } = req.params as { id: string };
    const locked = await tryNoodlerAccountOperation(id, async () => {
      const account = await noodle.getNoodlerAccountById(id);
      if (!account) return null;
      const updated = await noodle.updateNoodlerAvatar(id, null);
      if (updated) unlinkNoodlerAvatar(id, account.avatarUrl);
      return (await noodle.listNoodlerStageProfiles()).find((profile) => profile.id === id) ?? null;
    });
    if (!locked.acquired)
      return reply.code(409).send({ error: "Another operation for this NoodleR account is already running." });
    if (!locked.value) return reply.code(404).send({ error: "NoodleR stage profile not found" });
    return locked.value;
  });

  app.post("/noodler/accounts/:id/banner", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const { media } = await readNoodlerMultipart(req);
      const locked = await tryNoodlerAccountOperation(id, async () => {
        const account = await noodle.getNoodlerAccountById(id);
        if (!account) return null;
        const staged = stageNoodlerBanner(id, media);
        try {
          staged.promote();
          const updated = await noodle.updateNoodlerBanner(id, staged.bannerUrl);
          if (!updated) {
            staged.compensate();
            return null;
          }
          unlinkNoodlerBanner(id, account.settings.profile.bannerUrl ?? null);
          return (await noodle.listNoodlerStageProfiles()).find((profile) => profile.id === id) ?? null;
        } catch (error) {
          staged.compensate();
          throw error;
        }
      });
      if (!locked.acquired)
        return reply.code(409).send({ error: "Another operation for this Creator is already running." });
      if (!locked.value) return reply.code(404).send({ error: "Creator profile not found" });
      return locked.value;
    } catch (error) {
      return sendNoodlerMediaError(reply, error);
    }
  });

  app.post("/noodler/accounts/:id/artwork/generate", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = z
      .object({
        kind: z.enum(["avatar", "banner"]),
        guidance: z.string().max(2000).optional(),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = await generateNoodlerCreatorArtwork(app.db, {
      accountId: id,
      ...parsed.data,
    });
    if (result === "missing") return reply.code(404).send({ error: "Creator profile not found" });
    if (result === "busy") return reply.code(409).send({ error: "Another Creator operation is running." });
    if (result === "unavailable")
      return reply.code(400).send({ error: "No image generation connection is available." });
    return (await noodle.listNoodlerStageProfiles()).find((profile) => profile.id === id);
  });

  async function resolveViewerPersona(personaId: string) {
    return noodle.getViewer(personaId);
  }

  async function resolveViewerIdentity(personaId: string) {
    const viewer = await resolveViewerPersona(personaId);
    if (!viewer) return null;
    // The persona's own Slurp profile is normally provisioned at bootstrap, but it can be
    // absent right after account deletion/cleanup — provision it here so interactions never
    // 404 for a still-live persona (review finding).
    const resolvedActor =
      (await noodle.getSlurpAccountForEntity("persona", personaId)) ??
      (await resolvePersonaAccount(noodle, characters, personaId));
    const actor = resolvedActor?.kind === "persona" && resolvedActor.entityId === personaId ? resolvedActor : null;
    return { personaId, viewer, actor };
  }

  function creatorBelongsToViewer(
    account: Awaited<ReturnType<typeof noodle.getNoodlerAccountById>>,
    viewer: NoodleAccount,
  ) {
    return Boolean(account && account.sourceKind === "persona" && account.sourceEntityId === viewer.entityId);
  }

  async function buildViewerContext(viewer: NonNullable<Awaited<ReturnType<typeof resolveViewerPersona>>>) {
    const [accounts, profiles, subscriptions, unlocks] = await Promise.all([
      noodle.listNoodlerAccounts(),
      noodle.listNoodlerStageProfiles(),
      noodle.listSubscriptionsForViewer(viewer.id),
      noodle.listPostUnlocksForViewer(viewer.id),
    ]);
    const subscribedIds = new Set(subscriptions.map((item) => item.creatorAccountId));
    const followedIds = new Set(viewer.settings.social.followingAccountIds ?? []);
    const unlockedIds = new Set(unlocks.map((item) => item.postId));
    const profileById = new Map(profiles.map((profile) => [profile.id, projectNoodlerAudienceProfile(profile)]));
    const visibleAccounts = accounts.filter(
      (account) => creatorBelongsToViewer(account, viewer) || !isNoodlerHiddenFromViewer(account, viewer.id),
    );
    // Prices for the visible creators only, so a large roster costs one lookup per shown row.
    const subscriptionPrices = Object.fromEntries(
      await Promise.all(
        visibleAccounts.map(
          async (account) => [account.id, await noodle.getCreatorSubscriptionPrice(account.id)] as const,
        ),
      ),
    );
    return {
      viewer,
      visibleAccounts,
      subscriptionPrices,
      accountById: new Map(visibleAccounts.map((account) => [account.id, account])),
      profileById,
      subscribedIds,
      followedIds,
      unlockedIds,
    };
  }

  type ViewerContext = Awaited<ReturnType<typeof buildViewerContext>>;

  function buildViewerShell(context: ViewerContext) {
    return {
      viewer: context.viewer,
      creators: context.visibleAccounts.map((account) => ({
        profile: context.profileById.get(account.id)!,
        subscribed: context.subscribedIds.has(account.id),
        followed: context.followedIds.has(account.id),
        // The creator's own weekly price when it has set one, else the Slurp-wide default.
        subscriptionPrice: context.subscriptionPrices[account.id] ?? NOODLER_SUBSCRIPTION_COST,
        // Feed posts live in a separate keyset-paged query. Keeping this field preserves the
        // shared Engine contract for older consumers without hydrating any post history here.
        posts: [] as NoodlerPostView[],
      })),
    };
  }

  /**
   * The shared Engine view type has no price field, and adding one there would force an
   * engine.min bump for a presentation detail. The package widens it locally instead.
   */
  type NoodlerPricedPostView = NoodlerPostView & {
    unlockPrice: number | null;
    /** Social proof on the paywall. Null for a post the viewer can already read. */
    unlockCount: number | null;
    story: boolean;
    linkedPostId: string | null;
  };

  async function projectViewerPosts(
    context: ViewerContext,
    posts: NoodlerManagedPost[],
  ): Promise<Map<string, NoodlerPricedPostView>> {
    const viewablePostIds = new Set(
      posts
        .filter((post) => {
          const account = context.accountById.get(post.authorAccountId);
          return Boolean(
            account &&
            (creatorBelongsToViewer(account, context.viewer) ||
              canViewNoodlerPost({
                post,
                subscribed: context.subscribedIds.has(account.id),
                unlockedPostIds: context.unlockedIds,
              })),
          );
        })
        .map((post) => post.id),
    );
    const interactionsByPostId = new Map<string, NoodlerPostView["interactions"]>();
    const interactions = posts.length > 0 ? await noodle.listNoodlerInteractions(posts.map((post) => post.id)) : [];
    for (const interaction of interactions) {
      const existing = interactionsByPostId.get(interaction.postId) ?? [];
      existing.push(interaction);
      interactionsByPostId.set(interaction.postId, existing);
    }
    // One clock for the whole projection, so every post in a page is measured against the same
    // instant and two posts made together never disagree about how old they are.
    const projectedAt = new Date();
    const reachByAccountId = new Map(
      [...new Set(posts.map((post) => post.authorAccountId))].map((accountId) => {
        const account = context.accountById.get(accountId);
        return [
          accountId,
          account ? slurpCreatorReach({ accountId, createdAt: account.createdAt, realFollowers: 0 }, projectedAt) : 0,
        ] as const;
      }),
    );
    return new Map(
      posts.map((post): [string, NoodlerPricedPostView] => {
        const locked = !viewablePostIds.has(post.id);
        const allInteractions = interactionsByPostId.get(post.id) ?? [];
        const visibleInteractions = allInteractions.filter(
          (interaction) => !locked || !interaction.actorAccountId.startsWith(NOODLER_FAN_IDENTITY_PREFIX),
        );
        return [
          post.id,
          {
            id: post.id,
            authorAccountId: post.authorAccountId,
            access: post.access,
            locked,
            title: post.title,
            content: locked ? null : post.content,
            hasImage: post.imageUrl !== null,
            imageUrl:
              locked && !post.imageUrl?.startsWith(NOODLER_MEDIA_URL_PREFIX)
                ? null
                : noodlerPostMediaUrlForPersona(post.imageUrl, context.viewer.entityId, locked ? "locked" : "original"),
            imagePrompt: locked ? null : post.imagePrompt,
            metadata: locked ? null : post.metadata,
            // A locked post withholds its metadata, so the price travels as its own field. It is
            // The post's own price, which the unlock route charges when the wallet is enabled.
            unlockPrice: locked ? noodlerUnlockPriceFromMetadata(post.metadata) : null,
            story: post.metadata.noodlerPostType === "story",
            linkedPostId:
              post.metadata.noodlerPostType === "story" && typeof post.metadata.noodlerLinkedPostId === "string"
                ? post.metadata.noodlerLinkedPostId
                : null,
            createdAt: post.createdAt,
            interactions: locked ? [] : visibleInteractions,
            // Real interactions are never replaced: expanding the list still shows exactly the
            // accounts that acted. The counts add the silent crowd nobody can click.
            likeCount: slurpPostLikeCount(
              {
                postId: post.id,
                createdAt: post.createdAt,
                creatorReach: reachByAccountId.get(post.authorAccountId) ?? 0,
                realLikes: allInteractions.filter((item) => item.type === "like").length,
              },
              projectedAt,
            ),
            replyCount: slurpPostReplyCount(
              {
                postId: post.id,
                createdAt: post.createdAt,
                creatorReach: reachByAccountId.get(post.authorAccountId) ?? 0,
                realReplies: allInteractions.filter((item) => item.type === "reply").length,
              },
              projectedAt,
            ),
            unlockCount: locked
              ? slurpPostUnlockCount(
                  {
                    postId: post.id,
                    createdAt: post.createdAt,
                    creatorReach: reachByAccountId.get(post.authorAccountId) ?? 0,
                  },
                  projectedAt,
                )
              : null,
          },
        ];
      }),
    );
  }

  /**
   * The Creator home: one answer to "how am I doing", per Creator this persona operates.
   *
   * A review found the world had cause and effect the player could never see. Reach moved, posts
   * performed differently, and nothing surfaced why. This is the legibility surface: every number
   * the world produces becomes visible and attributable here.
   *
   * Deltas need a mark to measure from, so the first read stores a snapshot and reports no change.
   * That is correct rather than a special case: nothing has happened since a visit that never
   * happened.
   */
  /**
   * Open, replace, or clear a Creator's tip goal.
   *
   * A milestone is a target the player aims at. A tip goal is one they show the audience, which is
   * what gives anyone a reason to tip. Only the operating persona may set it.
   */
  app.put("/noodler/accounts/:id/goal", async (req, reply) => {
    const parsed = z
      .object({
        personaId: z.string().trim().min(1),
        label: z.string().trim().max(SLURP_GOAL_LABEL_MAX_LENGTH).nullable(),
        target: z.number().int().min(SLURP_GOAL_MIN_TARGET).max(SLURP_GOAL_MAX_TARGET).default(SLURP_GOAL_MIN_TARGET),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const { id } = req.params as { id: string };
    const creator = await noodle.getNoodlerAccountById(id);
    if (!creator || !creatorBelongsToViewer(creator, viewer)) {
      return reply.code(403).send({ error: "Only the Creator's owner can set a goal." });
    }
    const goal = await noodle.setGoal(creator.id, parsed.data.label, parsed.data.target);
    if (parsed.data.label !== null && !goal) {
      return reply.code(400).send({ error: "A goal needs a label and a target." });
    }
    const earnings = await noodle.getEarnings(creator.id);
    return { goal: goal ? slurpGoalProgress(goal, earnings.lifetime) : null };
  });

  /**
   * The notification stream, and what happened while you were away.
   *
   * One table, two presentations: `items` is the full list, `unseen` is what to show on open.
   * Grouping keeps a busy day to a readable handful instead of a wall.
   */
  app.get("/noodler/notifications", async (req, reply) => {
    const parsed = noodlerViewerPersonaSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const events = createSlurpEventsStorage(app.db);
    const [items, unseen] = await Promise.all([events.list(viewer.id), events.listUnseen(viewer.id)]);
    // Actors are stored as ids so a renamed or departed account still renders. Resolve to display
    // names here: "abc-123 subscribed" tells the player nothing, which is the whole failure this
    // surface exists to fix.
    const actorIds = [
      ...new Set(items.concat(unseen).flatMap((event) => (event.actorLabel ? [event.actorLabel] : []))),
    ];
    const names = new Map<string, string>();
    await Promise.all(
      actorIds.map(async (id) => {
        const persona = await noodle.getViewer(id).catch(() => null);
        const name = persona?.displayName ?? (await noodle.getNoodlerAccountById(id))?.displayName ?? null;
        if (name) names.set(id, name);
      }),
    );
    const named = (list: typeof items) =>
      list.map((event) => ({
        ...event,
        actorLabel: event.actorLabel ? (names.get(event.actorLabel) ?? null) : null,
      }));
    return {
      items: groupSlurpEvents(named(items)),
      unseen: groupSlurpEvents(named(unseen)),
      unseenCount: unseen.length,
    };
  });

  app.post("/noodler/notifications/seen", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    await createSlurpEventsStorage(app.db).markSeen(viewer.id);
    return { ok: true };
  });

  app.get("/noodler/studio", async (req, reply) => {
    const parsed = noodlerViewerPersonaSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });

    const accounts = await noodle.listNoodlerAccounts();
    const operated = accounts.filter((account) => creatorBelongsToViewer(account, viewer));
    const at = new Date();
    const snapshot = await readSlurpStudioSnapshot(app.db, viewer.id);

    const followerCounts = new Map<string, number>();
    for (const account of await noodle.listAccounts()) {
      for (const followedId of account.settings.social.followingAccountIds ?? []) {
        followerCounts.set(followedId, (followerCounts.get(followedId) ?? 0) + 1);
      }
    }

    const postsByAccount = await noodle.listNoodlerPostsByAccounts(
      operated.map((account) => account.id),
      6,
    );
    const allPostIds = [...postsByAccount.values()].flat().map((post) => post.id);
    const interactions = allPostIds.length > 0 ? await noodle.listNoodlerInteractions(allPostIds) : [];
    const interactionsByPostId = new Map<string, typeof interactions>();
    for (const interaction of interactions) {
      const existing = interactionsByPostId.get(interaction.postId) ?? [];
      existing.push(interaction);
      interactionsByPostId.set(interaction.postId, existing);
    }

    const creators = await Promise.all(
      operated.map(async (account) => {
        const followers = slurpCreatorReach(
          {
            accountId: account.id,
            createdAt: account.createdAt,
            realFollowers: followerCounts.get(account.id) ?? 0,
          },
          at,
        );
        const earnings = await noodle.getEarnings(account.id);
        const goal = await noodle.getGoal(account.id);
        const previous = snapshot?.creators[account.id] ?? null;
        const posts = (postsByAccount.get(account.id) ?? []).map((post) => {
          const postInteractions = interactionsByPostId.get(post.id) ?? [];
          const input = { postId: post.id, createdAt: post.createdAt, creatorReach: followers };
          return {
            id: post.id,
            title: post.title,
            createdAt: post.createdAt,
            locked: post.access === "locked",
            hasImage: post.imageUrl !== null,
            reach: slurpPostImpressions(input, at),
            likeCount: slurpPostLikeCount(
              { ...input, realLikes: postInteractions.filter((item) => item.type === "like").length },
              at,
            ),
            replyCount: slurpPostReplyCount(
              { ...input, realReplies: postInteractions.filter((item) => item.type === "reply").length },
              at,
            ),
            unlockCount: post.access === "locked" ? slurpPostUnlockCount(input, at) : null,
          };
        });
        return {
          id: account.id,
          handle: account.handle,
          displayName: account.displayName,
          avatarUrl: account.avatarUrl,
          followers,
          subscribers: (await noodle.listSubscriptionsForCreator(account.id)).length,
          earnings,
          milestone: slurpFollowerMilestone(followers),
          goal: goal ? slurpGoalProgress(goal, earnings.lifetime) : null,
          // Null rather than zero on a first read: "no change yet" and "measured no change" are
          // different, and the client renders them differently.
          followersDelta: previous ? followers - previous.followers : null,
          earningsDelta: previous ? earnings.lifetime - previous.lifetimeEarnings : null,
          milestonesCrossed: previous ? slurpMilestonesCrossed(previous.followers, followers) : [],
          posts,
        };
      }),
    );

    await writeSlurpStudioSnapshot(app.db, viewer.id, {
      at: at.toISOString(),
      creators: Object.fromEntries(
        creators.map((creator) => [
          creator.id,
          { followers: creator.followers, lifetimeEarnings: creator.earnings.lifetime },
        ]),
      ),
    });

    return { since: snapshot?.at ?? null, creators };
  });

  app.get("/noodler/viewer/unseen-count", async (req, reply) => {
    const parsed = noodlerViewerPersonaSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Noodle persona not found" });
    const accounts = await noodle.listNoodlerAccounts();
    const unseenCreatorAccountIds = noodlerUnseenCreatorAccountIds(accounts, viewer.id);
    const visibleAccounts = accounts.filter(
      (account) => creatorBelongsToViewer(account, viewer) || !isNoodlerHiddenFromViewer(account, viewer.id),
    );
    const visibleAccountIds = visibleAccounts.map((account) => account.id);
    const generationKey = [
      app.db._fileStore.getTableWriteGeneration("slurp_posts"),
      app.db._fileStore.getTableWriteGeneration("slurp_interactions"),
      app.db._fileStore.getTableWriteGeneration("slurp_accounts"),
      viewer.settings.social.noodlerFeedSeenAt ?? "never",
      [...visibleAccountIds].sort().join(","),
      [...unseenCreatorAccountIds].sort().join(","),
    ].join("|");
    const cached = noodlerViewerSignalCache.get(viewer.id);
    if (cached?.generationKey === generationKey) return cached.value;
    const signal = await noodle.getNoodlerViewerSignal(
      visibleAccountIds,
      unseenCreatorAccountIds,
      viewer.settings.social.noodlerFeedSeenAt,
    );
    const latestCreator = visibleAccounts.sort(
      (left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id),
    )[0];
    const value: NoodlerViewerSignalResponse = {
      count: signal.count,
      revision: {
        latestPost: signal.latestPost,
        latestPostId: signal.latestPostId,
        latestPostAccountId: signal.latestPostAccountId,
        latestPostUpdate: signal.latestPostUpdate,
        updatedPostId: signal.updatedPostId,
        updatedPostAccountId: signal.updatedPostAccountId,
        latestInteraction: signal.latestInteraction,
        interactionPostId: signal.interactionPostId,
        latestCreator: latestCreator ? `${latestCreator.updatedAt}:${latestCreator.id}` : null,
      },
    };
    if (!noodlerViewerSignalCache.has(viewer.id) && noodlerViewerSignalCache.size >= 100) {
      const oldestKey = noodlerViewerSignalCache.keys().next().value;
      if (oldestKey) noodlerViewerSignalCache.delete(oldestKey);
    }
    noodlerViewerSignalCache.set(viewer.id, { generationKey, value });
    return value;
  });

  app.post("/noodler/viewer/mark-seen", async (req, reply) => {
    const parsed = noodlerViewerPersonaSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await noodle.patchViewerSettings(parsed.data.personaId, {
      subtree: "social",
      patch: { noodlerFeedSeenAt: new Date().toISOString() },
    });
    if (!viewer) return reply.code(404).send({ error: "Slurp viewer persona not found" });
    return viewer;
  });

  app.get("/noodler/viewer", async (req, reply) => {
    const parsed = noodlerViewerPersonaSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Noodle persona not found" });
    return buildViewerShell(await buildViewerContext(viewer));
  });

  app.get("/noodler/viewer/feed", async (req, reply) => {
    const parsed = noodlerViewerFeedQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Noodle persona not found" });
    const context = await buildViewerContext(viewer);
    const accounts = context.visibleAccounts.filter(
      (account) => parsed.data.tab === "all" || context.followedIds.has(account.id),
    );
    const normalizedSearch = parsed.data.search.toLowerCase();
    const creatorSearchAccountIds = normalizedSearch
      ? accounts
          .filter((account) => {
            const profile = context.profileById.get(account.id);
            return Boolean(
              profile &&
              (profile.handle.toLowerCase().includes(normalizedSearch) ||
                profile.displayName.toLowerCase().includes(normalizedSearch)),
            );
          })
          .map((account) => account.id)
      : [];
    const page = await noodle.listNoodlerPostPage({
      accountIds: accounts.map((account) => account.id),
      creatorSearchAccountIds,
      readableContentAccountIds: accounts
        .filter((account) => creatorBelongsToViewer(account, viewer) || context.subscribedIds.has(account.id))
        .map((account) => account.id),
      unlockedPostIds: [...context.unlockedIds],
      search: parsed.data.search,
      cursor:
        parsed.data.cursorAt && parsed.data.cursorId
          ? { createdAt: parsed.data.cursorAt, id: parsed.data.cursorId }
          : null,
      limit: parsed.data.limit,
    });
    const projected = await projectViewerPosts(context, page.items);
    return {
      items: page.items.flatMap((post) => {
        const view = projected.get(post.id);
        return view ? [{ creatorAccountId: post.authorAccountId, post: view }] : [];
      }),
      total: page.total,
      nextCursor: page.nextCursor,
    };
  });

  app.get("/noodler/viewer/ads", async (req, reply) => {
    const parsed = z
      .object({
        personaId: z.string().trim().min(1),
        creatorId: z.string().trim().min(1).optional(),
        contextTags: z.string().optional(),
      })
      .safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const settings = await noodle.getSettings();
    if (!settings.inlineAdsEnabled) return { items: [] };
    const persona = await characters.getPersona(parsed.data.personaId);
    const creator = parsed.data.creatorId ? await noodle.getNoodlerAccountById(parsed.data.creatorId) : null;
    const items = await ads.listInline(
      parsed.data.personaId,
      SLURP_GARNISH_PLATFORM,
      garnishContextForViewer({
        persona,
        creator,
        contextTags: parsed.data.contextTags?.split(",") ?? [],
        preferredTags: settings.inlineAdsPreferredTags,
        steering: settings.inlineAdsSteering,
        contentCeiling: settings.inlineAdsContentCeiling,
      }),
    );
    // Rotation is only real if what was served is written down.
    await ads.markRecent(
      parsed.data.personaId,
      items.map((item) => item.id),
    );
    for (const item of items) await ads.record(parsed.data.personaId, item.id, "impression");
    return { items };
  });

  app.post("/noodler/viewer/ads/:id/hide", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    return ads.hide(parsed.data.personaId, (req.params as { id: string }).id);
  });

  app.post("/noodler/viewer/ads/reset", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    return ads.reset(parsed.data.personaId);
  });

  app.post("/noodler/viewer/ads/:id/action", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    await ads.record(parsed.data.personaId, (req.params as { id: string }).id, "action");
    // Acting on an ad pays, capped per day. The wallet applies the cap, so a capped-out day
    // quietly pays nothing rather than failing the click.
    const wallet = await noodle.earnCoins(parsed.data.personaId, "ad", (req.params as { id: string }).id);
    return { ok: true, coins: wallet.coins };
  });

  app.post("/noodler/viewer/ads/brand/hide", async (req, reply) => {
    const parsed = z
      .object({ personaId: z.string().trim().min(1), brand: z.string().trim().min(1).max(80) })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    return ads.hideBrand(parsed.data.personaId, parsed.data.brand);
  });

  app.post("/noodler/viewer/ads/brand/unhide", async (req, reply) => {
    const parsed = z
      .object({ personaId: z.string().trim().min(1), brand: z.string().trim().min(1).max(80) })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    return ads.unhideBrand(parsed.data.personaId, parsed.data.brand);
  });

  app.get("/noodler/viewer/ads/state", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const [state, all] = await Promise.all([
      ads.state(parsed.data.personaId),
      ads.pool.listAll(SLURP_GARNISH_PLATFORM),
    ]);
    const byId = new Map(all.map((ad) => [ad.id, ad]));
    return {
      hiddenBrands: state.hiddenBrands,
      hidden: state.hiddenAdIds.map((id) => byId.get(id) ?? null).filter(Boolean),
      seen: state.recentAdIds.map((id) => byId.get(id) ?? null).filter(Boolean),
    };
  });

  // ── Ad pool authoring ─────────────────────────────────────────────
  app.get("/noodler/ads/pool", async () => ({ items: await ads.pool.listAll(SLURP_GARNISH_PLATFORM) }));

  app.post("/noodler/ads/pool", async (req, reply) => {
    const parsed = garnishAdInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const input = parsed.data;
    return ads.pool.add({
      ...input,
      id: input.id ?? `user-${newId()}`,
      platform: SLURP_GARNISH_PLATFORM,
      origin: "user",
      createdAt: new Date().toISOString(),
    });
  });

  app.delete("/noodler/ads/pool/:id", async (req) => {
    const { id } = req.params as { id: string };
    const existing = (await ads.pool.listAll()).find((ad) => ad.id === id);
    await ads.pool.remove(id);
    // Otherwise every deleted ad leaves its artwork behind on disk forever.
    unlinkGarnishAdImage(id, existing?.imageUrl);
    return { ok: true };
  });

  app.post("/noodler/ads/:id/image", async (req, reply) => {
    const { id } = req.params as { id: string };
    const ad = (await ads.pool.listAll(SLURP_GARNISH_PLATFORM)).find((row) => row.id === id);
    if (!ad) return reply.code(404).send({ error: "Not Found" });
    const settings = await noodle.getSettings();
    const outcome = await generateGarnishAdImage(app.db, ads.pool, ad, settings.imageGenerationConnectionId);
    if (outcome === "unavailable") {
      return reply.code(400).send({ error: "Select an image generation connection first." });
    }
    if (outcome === "failed") return reply.code(502).send({ error: "Could not generate that image." });
    const updated = (await ads.pool.listAll(SLURP_GARNISH_PLATFORM)).find((row) => row.id === id);
    return { ad: updated ?? ad };
  });

  app.get("/noodler/ads/:id/image/:fileName", async (req, reply) => {
    const { id, fileName } = req.params as { id: string; fileName: string };
    const ad = (await ads.pool.listAll()).find((row) => row.id === id);
    const absolute = resolveGarnishAdImageAbsolutePath(id, ad?.imageUrl);
    if (!absolute || basename(absolute) !== fileName || !existsSync(absolute)) {
      return reply.code(404).send({ error: "Not Found" });
    }
    const width = z.coerce
      .number()
      .int()
      .optional()
      .safeParse((req.query as { width?: string }).width);
    const served = await resolveNoodlerMediaVariant(absolute, width.success ? width.data : undefined);
    return reply
      .header("Cache-Control", "private, max-age=31536000, immutable")
      .sendFile(basename(served), dirname(served));
  });

  app.post("/noodler/ads/lorebook/sync", async (req, reply) => {
    const parsed = z.object({ force: z.boolean().optional() }).safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const outcome = await syncGarnishAdsWithLorebook(app.db, ads.pool, { force: parsed.data.force });
    if (outcome === "failed") return reply.code(502).send({ error: "Could not sync the pool to that lorebook." });
    return { outcome };
  });

  app.get("/noodler/ads/lorebooks", async () => ({
    // Lorebook rows are typed through Record<string, unknown>, so id and name are read rather
    // than accessed off the declared type.
    items: (await createLorebooksStorage(app.db).list())
      .map((book) => book as { id?: unknown; name?: unknown })
      .filter((book): book is { id: string; name: string } => typeof book.id === "string")
      .map((book) => ({ id: book.id, name: typeof book.name === "string" ? book.name : book.id })),
  }));

  app.post("/noodler/ads/generate", async (req, reply) => {
    const parsed = z
      .object({ connectionId: z.string().trim().min(1).optional(), count: z.number().int().min(1).max(10).optional() })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const settings = await noodle.getSettings();
    try {
      // A selected lorebook is the setting the ads live in, so it leads the world context.
      const lorebook = settings.inlineAdsLorebookId
        ? await readGarnishLorebookContext(app.db, settings.inlineAdsLorebookId)
        : null;
      const items = await generateGarnishAds(app.db, ads.pool, {
        // Ads generate through the same connection as the rest of Slurp; only the main
        // connection was consulted before, so a Slurp-only setup could never generate.
        connectionId: parsed.data.connectionId ?? settings.generationConnectionId ?? undefined,
        count: parsed.data.count,
        tone: settings.inlineAdsTone,
        era: settings.inlineAdsEra,
        contentCeiling: settings.inlineAdsContentCeiling,
        worldContext: [lorebook?.text, settings.inlineAdsWorldContext].filter((part) => part?.trim()).join("\n\n"),
      });
      let images = 0;
      if (settings.inlineAdsImagesEnabled) {
        for (const ad of items) {
          if (
            (await generateGarnishAdImage(app.db, ads.pool, ad, settings.imageGenerationConnectionId)) === "generated"
          )
            images += 1;
        }
      }
      if (lorebook) await noodle.updateSettings({ inlineAdsLorebookRevision: lorebook.revision });
      // Pruning runs after generation so the pool cannot grow without also
      // shedding what the audience keeps dismissing.
      const retired = await retireWeakGarnishAds(ads.pool, qualityScores(await ads.pool.listEvents()));
      // Re-read: the pool now carries the generated image URLs.
      const stored = await ads.pool.listAll(SLURP_GARNISH_PLATFORM);
      const byId = new Map(stored.map((ad): [string, GarnishAd] => [ad.id, ad]));
      return { items: items.map((ad) => byId.get(ad.id) ?? ad), retired, images };
    } catch (error) {
      return reply.code(502).send({ error: (error as Error).message });
    }
  });

  app.get("/noodler/ads/export", async () => exportGarnishAds(ads.pool, SLURP_GARNISH_PLATFORM));

  app.post("/noodler/ads/import", async (req, reply) => {
    const parsed = z
      .object({ mode: z.enum(["merge", "replace"]).default("merge"), payload: z.unknown() })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      return await importGarnishAds(ads.pool, parsed.data.payload, parsed.data.mode);
    } catch (error) {
      return reply.code(400).send({
        error: `Not a garnish-ads export (version ${GARNISH_EXPORT_VERSION}): ${(error as Error).message}`,
      });
    }
  });

  async function resolveReadableNoodlerPost(personaId: string, postId: string) {
    const viewer = await resolveViewerPersona(personaId);
    const post = viewer ? await noodle.getNoodlerPostById(postId) : null;
    const creator = post ? await noodle.getNoodlerAccountById(post.authorAccountId) : null;
    if (!viewer || !post || !creator || isNoodlerHiddenFromViewer(creator, viewer.id)) return null;
    if (creatorBelongsToViewer(creator, viewer)) return { viewer, post, creator, locked: false };
    const [subscriptions, unlocks] = await Promise.all([
      noodle.listSubscriptionsForViewer(viewer.id),
      noodle.listPostUnlocksForViewer(viewer.id),
    ]);
    const subscribed = subscriptions.some((item) => item.creatorAccountId === creator.id);
    const locked = !canViewNoodlerPost({
      post,
      subscribed,
      unlockedPostIds: new Set(unlocks.map((item) => item.postId)),
    });
    // Locked is reported rather than refused: the media route still owes a locked viewer a
    // blurred teaser. Every caller that needs the post's protected content checks it.
    return { viewer, post, creator, locked };
  }

  async function resolveGatedNoodlerPost(personaId: string, postId: string) {
    const readable = await resolveReadableNoodlerPost(personaId, postId);
    // A viewer persona linked to the creator's own public account may read its posts, but
    // is not an audience member and must not persist self-interactions.
    if (!readable || readable.locked || creatorBelongsToViewer(readable.creator, readable.viewer)) return null;
    return readable;
  }

  // Access-checked serving for NoodleR-owned media. This entire router is installed
  // through registerPrivilegedRoutes, so the host authenticates the Engine owner before
  // any handler runs. A persona query additionally gates that owner-scoped request as a fan
  // (subscriber/unlock/hidden all enforced), which is why audience-facing projections bind
  // the viewer's persona into every media URL they hand out. No persona is the owner path,
  // the same trusted management surface as the other /noodler/accounts routes. The bytes
  // live outside any publicly readable gallery namespace, so this is the only way in.
  app.get("/noodler/posts/:id/media", async (req, reply) => {
    const { id } = req.params as { id: string };
    const personaId = (req.query as { personaId?: string }).personaId;
    const readable = personaId ? await resolveReadableNoodlerPost(personaId, id) : null;
    const post = personaId ? readable?.post : await noodle.getNoodlerPostById(id);
    if (!post) return reply.code(404).send({ error: "Not Found" });
    const mediaPath = readNoodlerMediaPath(post);
    const absolute = mediaPath ? resolveNoodlerMediaAbsolutePath(mediaPath) : null;
    if (!absolute || !existsSync(absolute)) return reply.code(404).send({ error: "Not Found" });
    // A locked viewer gets the blurred derivative, never the original bytes. If it cannot be
    // built the frame stays empty rather than falling back to the protected image.
    if (readable?.locked) {
      const teaser = await readNoodlerLockedTeaser(absolute);
      if (!teaser) return reply.code(404).send({ error: "Not Found" });
      return reply.header("Cache-Control", "private, max-age=300").type("image/jpeg").send(teaser);
    }
    const width = z.coerce
      .number()
      .int()
      .optional()
      .safeParse((req.query as { width?: string }).width);
    const served = await resolveNoodlerMediaVariant(absolute, width.success ? width.data : undefined);
    return (
      reply
        // The post-owned URL is stable across ordinary feed refreshes, but an owner can replace
        // its bytes in place. Audience URLs include distinct locked/original variants, so an
        // unlock changes the browser cache key instead of retaining a cached teaser.
        .header("Cache-Control", "private, max-age=300")
        .sendFile(basename(served), dirname(served))
    );
  });

  /**
   * A post rendered as one downloadable PNG: creator avatar and name, title, caption, and the
   * post image.
   *
   * Gated exactly like reading the post. A locked post the viewer has not unlocked is never
   * rendered — a share card would otherwise be a way to read paid content for free, and the
   * blurred teaser is not worth sharing. Falls back to the caller's own view when no persona is
   * supplied, which is the owner path the other management routes use.
   */
  app.get("/noodler/posts/:id/share-card", async (req, reply) => {
    const { id } = req.params as { id: string };
    const personaId = (req.query as { personaId?: string }).personaId;
    const readable = personaId ? await resolveReadableNoodlerPost(personaId, id) : null;
    if (personaId && (!readable || readable.locked)) return reply.code(404).send({ error: "Not Found" });
    const post = readable?.post ?? (personaId ? null : await noodle.getNoodlerPostById(id));
    if (!post) return reply.code(404).send({ error: "Not Found" });
    if (!personaId && post.access === "locked") return reply.code(404).send({ error: "Not Found" });
    const creator = await noodle.getNoodlerAccountById(post.authorAccountId);
    if (!creator) return reply.code(404).send({ error: "Not Found" });

    const readBytes = (mediaPath: string | null) => {
      const absolute = mediaPath ? resolveNoodlerMediaAbsolutePath(mediaPath) : null;
      return absolute && existsSync(absolute) ? readFileSync(absolute) : null;
    };
    const card = await renderSlurpShareCard({
      displayName: creator.displayName,
      handle: creator.handle,
      title: post.title ?? null,
      content: post.content,
      avatar: readBytes(readNoodlerAvatarMediaPath(creator.id, creator.avatarUrl ?? null)),
      image: readBytes(readNoodlerMediaPath(post)),
    });
    // No sharp means no card. Say so rather than sending a broken download.
    if (!card) return reply.code(503).send({ error: "Image rendering is unavailable on this install" });
    return reply
      .header("Content-Disposition", `attachment; filename="slurp-${id}.png"`)
      .header("Cache-Control", "private, max-age=300")
      .type("image/png")
      .send(card);
  });

  app.post("/noodler/posts/:id/interactions", async (req, reply) => {
    const parsed = noodlerCreateInteractionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const identity = await resolveViewerIdentity(parsed.data.personaId);
    if (!identity?.actor) return reply.code(404).send({ error: "Slurp viewer profile not found" });
    const gated = await resolveGatedNoodlerPost(parsed.data.personaId, id);
    if (!gated) return reply.code(404).send({ error: "NoodleR post not found" });
    if (parsed.data.type === "vote") {
      const poll = readNoodlePollFromMetadata(gated.post.metadata);
      const optionId = parsed.data.content?.trim() ?? "";
      if (!poll?.options.some((option) => option.id === optionId)) {
        return reply.code(400).send({ error: "Choose a valid poll option." });
      }
    }
    const interaction = await noodle.createNoodlerInteraction(id, {
      actorAccountId: identity.actor.id,
      viewerPersonaId: identity.personaId,
      type: parsed.data.type,
      content: parsed.data.content ?? null,
      parentInteractionId: parsed.data.parentInteractionId ?? null,
    });
    if (!interaction) return reply.code(400).send({ error: "Could not add that NoodleR interaction." });
    // Taking part pays, capped per day. A like is one tap, so only the interactions that cost the
    // player something to write are rewarded — otherwise the cap is reached by tapping hearts.
    if (parsed.data.type === "reply" || parsed.data.type === "vote") {
      await noodle.earnCoins(identity.personaId, "engagement", parsed.data.type);
    }
    return reply.code(201).send(interaction);
  });

  app.post("/noodler/posts/:postId/interactions/:interactionId/creator-reply", async (req, reply) => {
    const parsed = noodlerCreatorReplyRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { postId, interactionId } = req.params as {
      postId: string;
      interactionId: string;
    };
    const identity = await resolveViewerIdentity(parsed.data.personaId);
    if (!identity?.actor) return reply.code(404).send({ error: "Slurp viewer profile not found" });
    try {
      const result = await generateAndApplyNoodlerCreatorReply(app.db, {
        postId,
        parentInteractionId: interactionId,
        viewerPersonaId: identity.personaId,
        viewerActorAccountId: identity.actor.id,
        debugMode: parsed.data.debugMode === true,
      });
      if (result.status === "generated") return reply.code(201).send(result);
      if (result.status === "busy") {
        return reply.code(409).send({
          error: "Another operation for this NoodleR account is already running.",
        });
      }
      if (result.status === "connection_required") {
        return reply.code(400).send({ error: "Select a Noodle generation connection first." });
      }
      if (result.status === "connection_not_found") {
        return reply.code(404).send({ error: "Noodle generation connection not found" });
      }
      if (result.status === "exhausted") {
        // The ceiling is installation-wide, not per creator: saying otherwise sends the user to
        // another creator that is just as blocked.
        return reply.code(429).send({
          error: "No automatic creator replies are left in the last 24 hours.",
        });
      }
      if (result.status === "ineligible") {
        return reply.code(404).send({
          error: "That NoodleR reply can no longer receive a creator reply.",
        });
      }
      // `duplicate` carries the existing interaction and is a success: the reply the caller
      // wanted is already there.
      return result;
    } catch (error) {
      logger.error(error, "[noodler-reply] Creator reply generation failed");
      return reply.code(500).send({ error: "Creator reply generation failed." });
    }
  });

  app.delete("/noodler/posts/:id/interactions", async (req, reply) => {
    const parsed = noodlerRemoveInteractionSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const identity = await resolveViewerIdentity(parsed.data.personaId);
    if (!identity?.actor) return reply.code(404).send({ error: "Slurp viewer profile not found" });
    const gated = await resolveGatedNoodlerPost(parsed.data.personaId, id);
    if (!gated) return reply.code(404).send({ error: "NoodleR post not found" });
    const interaction = await noodle.deleteNoodlerInteraction(id, {
      actorAccountId: identity.actor.id,
      viewerPersonaId: identity.personaId,
      type: parsed.data.type,
      parentInteractionId: parsed.data.parentInteractionId ?? null,
    });
    if (!interaction) return reply.code(404).send({ error: "NoodleR interaction not found" });
    return interaction;
  });

  app.patch("/noodler/posts/:postId/interactions/:interactionId", async (req, reply) => {
    const { postId, interactionId } = req.params as { postId: string; interactionId: string };
    const parsed = noodleInteractionUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const interaction = await noodle.getInteractionById(interactionId);
    if (!interaction || interaction.postId !== postId)
      return reply.code(404).send({ error: "Slurp comment not found" });
    if (interaction.type !== "reply") return reply.code(403).send({ error: "Only comments can be edited." });
    const identity = await resolveViewerIdentity(parsed.data.personaId);
    if (!identity?.actor) return reply.code(404).send({ error: "Slurp viewer profile not found" });
    const actor = await noodle.getNoodlerAccountById(interaction.actorAccountId);
    const canManage =
      interaction.actorAccountId === identity.actor.id ||
      (actor?.kind === "character" && actor.sourceKind === "character");
    if (!canManage) return reply.code(403).send({ error: "You can only edit comments owned by this persona." });
    const content = parsed.data.content === undefined ? interaction.content : parsed.data.content?.trim() || null;
    const imageUrl = parsed.data.imageUrl === undefined ? interaction.imageUrl : parsed.data.imageUrl?.trim() || null;
    if (!content && !imageUrl) return reply.code(400).send({ error: "Comments need text or an image." });
    const updated = await noodle.updateInteraction(interactionId, { content, imageUrl });
    if (!updated) return reply.code(404).send({ error: "Slurp comment not found" });
    return updated;
  });

  app.delete("/noodler/posts/:postId/interactions/:interactionId", async (req, reply) => {
    const { postId, interactionId } = req.params as { postId: string; interactionId: string };
    const parsed = noodlerViewerPersonaSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const interaction = await noodle.getInteractionById(interactionId);
    if (!interaction || interaction.postId !== postId)
      return reply.code(404).send({ error: "Slurp comment not found" });
    if (interaction.type !== "reply") return reply.code(403).send({ error: "Only comments can be deleted." });
    const identity = await resolveViewerIdentity(parsed.data.personaId);
    if (!identity?.actor) return reply.code(404).send({ error: "Slurp viewer profile not found" });
    const actor = await noodle.getNoodlerAccountById(interaction.actorAccountId);
    const canManage =
      interaction.actorAccountId === identity.actor.id ||
      (actor?.kind === "character" && actor.sourceKind === "character");
    if (!canManage) return reply.code(403).send({ error: "You can only delete comments owned by this persona." });
    const deleted = await noodle.deleteInteractionById(interactionId);
    if (deleted.length === 0) return reply.code(404).send({ error: "Slurp comment not found" });
    return deleted;
  });

  // NoodleR posts are stage-profile posts the user fully owns, so edit/delete route
  // through the NoodleR-only storage methods (getNoodlerPostById) rather than the Noodle
  // /posts endpoints, which reject any post whose author is not a Noodle account.
  app.patch("/noodler/posts/:id", async (req, reply) => {
    const body = requestRecord(req.body);
    const accountId = typeof body?.accountId === "string" ? body.accountId : null;
    if (!accountId) return reply.code(400).send({ error: "accountId is required" });
    const { accountId: _accountId, ...updateBody } = body;
    const parsed = noodlerPostUpdateSchema.safeParse(updateBody);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const existing = await noodle.getNoodlerPostById(id);
    if (!existing) return reply.code(404).send({ error: "NoodleR post not found" });
    if (existing.authorAccountId !== accountId) return reply.code(403).send({ error: "Forbidden" });
    const nextContent = parsed.data.content === undefined ? existing.content : parsed.data.content;
    const nextPoll =
      parsed.data.poll === undefined
        ? readNoodlePollFromMetadata(existing.metadata)
        : parsed.data.poll
          ? createNoodlePoll(parsed.data.poll)
          : null;
    const nextHasImage = parsed.data.removeImage ? false : Boolean(existing.imageUrl);
    if (!nextContent.trim() && !nextPoll && !nextHasImage) {
      return reply.code(400).send({ error: "Posts need a body, image, or poll." });
    }
    // The media path has to be re-read under the lock: the pre-lock `existing` snapshot can
    // name a file a concurrent write already replaced, and unlinking that deletes live bytes.
    const locked = await tryNoodlerAccountOperation(existing.authorAccountId, async () => {
      const current = parsed.data.removeImage ? await noodle.getNoodlerPostById(id) : null;
      const updated = await noodle.updateNoodlerPost(id, parsed.data);
      return updated
        ? {
            updated,
            staleMedia: current ? readNoodlerMediaPath(current) : null,
          }
        : null;
    });
    if (!locked.acquired) {
      return reply.code(409).send({
        error: "Another operation for this NoodleR account is already running.",
      });
    }
    if (!locked.value) return reply.code(404).send({ error: "NoodleR post not found" });
    if (parsed.data.removeImage) unlinkNoodlerMedia(locked.value.staleMedia);
    return locked.value.updated;
  });

  app.post("/noodler/posts", async (req, reply) => {
    let decoded: DecodedNoodlerMediaRequest<
      z.output<typeof slurpNoodlerPostCreateWithMediaSchema> | z.output<typeof slurpNoodlerPostCreateSchema>
    >;
    try {
      decoded = await decodeNoodlerMediaRequest(req, {
        withMedia: slurpNoodlerPostCreateWithMediaSchema,
        withoutMedia: slurpNoodlerPostCreateSchema,
      });
    } catch (error) {
      return sendNoodlerMediaError(reply, error);
    }
    if (!decoded.success) return reply.code(400).send({ error: decoded.error.flatten() });
    if (decoded.data.postType === "story" && !decoded.media) {
      return reply.code(400).send({ error: "Stories need an image." });
    }
    if (decoded.data.postType === "story" && decoded.data.poll) {
      return reply.code(400).send({ error: "Stories cannot contain polls." });
    }
    if (decoded.data.linkedPostId) {
      if (decoded.data.postType !== "story") {
        return reply.code(400).send({ error: "Only Stories can link to a Post." });
      }
      const linkedPost = await noodle.getNoodlerPostById(decoded.data.linkedPostId);
      if (!linkedPost || linkedPost.authorAccountId !== decoded.data.targetAccountId) {
        return reply.code(400).send({ error: "The linked Post must belong to this Creator." });
      }
    }
    const result = await createNoodlerPost(app.db, decoded.data, decoded.media);
    if (result.status === "created") return reply.code(201).send(result.post);
    if (result.status === "busy") {
      return reply.code(409).send({
        error: "Another operation for this NoodleR account is already running.",
      });
    }
    if (result.status === "disabled") return reply.code(404).send({ error: "Not Found" });
    return reply.code(404).send({ error: "NoodleR stage profile not found" });
  });

  app.post("/noodler/posts/:id/media", async (req, reply) => {
    const { id } = req.params as { id: string };
    let multipart: Awaited<ReturnType<typeof readNoodlerMultipart>>;
    try {
      multipart = await readNoodlerMultipart(req);
    } catch (error) {
      return sendNoodlerMediaError(reply, error);
    }
    const payload = requestRecord(multipart.payload);
    const accountId = typeof payload?.accountId === "string" ? payload.accountId : null;
    if (!accountId) return reply.code(400).send({ error: "accountId is required" });
    const { accountId: _accountId, ...updatePayload } = payload;
    const parsed = noodlerPostUpdateSchema.safeParse(updatePayload);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (parsed.data.removeImage) {
      return reply.code(400).send({ error: "A replacement image cannot also remove the image." });
    }
    const result = await updateNoodlerPostWithMedia(app.db, id, accountId, parsed.data, multipart.media);
    if (result.status === "updated") return result.post;
    if (result.status === "busy") {
      return reply.code(409).send({
        error: "Another operation for this NoodleR account is already running.",
      });
    }
    if (result.status === "disabled") return reply.code(404).send({ error: "Not Found" });
    if (result.status === "forbidden") return reply.code(403).send({ error: "Forbidden" });
    return reply.code(404).send({ error: "NoodleR post not found" });
  });

  app.post("/noodler/posts/:id/image/generate", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = z
      .object({
        accountId: z.string().min(1),
        debugMode: z.boolean().optional(),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const post = await noodle.getNoodlerPostById(id);
    if (!post) return reply.code(404).send({ error: "NoodleR post not found" });
    if (post.authorAccountId !== parsed.data.accountId) return reply.code(403).send({ error: "Forbidden" });
    if (post.imageUrl) return reply.code(409).send({ error: "This post already has an image." });
    if (!post.imagePrompt) return reply.code(400).send({ error: "This post does not have an image prompt." });

    const result = await noodlerImages.generateReviewedImages({
      prompts: [{ id: post.id, prompt: post.imagePrompt }],
      debugMode: parsed.data.debugMode === true,
      retryStoredPrompt: true,
    });
    if (!result.ok) return reply.code(400).send({ error: result.message });
    const updated = await noodle.getNoodlerPostById(id);
    if (updated?.imageUrl) return updated;
    if (updated?.updatedAt !== post.updatedAt && updated?.metadata.imageGenerationFailed === true) {
      return reply.code(502).send({ error: "Image generation failed. Try again later." });
    }
    return reply.code(409).send({ error: "This image is already being generated." });
  });

  app.delete("/noodler/posts/:id", async (req, reply) => {
    const accountId =
      typeof (req.query as { accountId?: unknown })?.accountId === "string"
        ? (req.query as { accountId: string }).accountId
        : null;
    if (!accountId) {
      return reply.code(400).send({ error: "accountId is required" });
    }
    const { id } = req.params as { id: string };
    const existing = await noodle.getNoodlerPostById(id);
    if (!existing) return reply.code(404).send({ error: "NoodleR post not found" });
    if (existing.authorAccountId !== accountId) return reply.code(403).send({ error: "Forbidden" });
    const locked = await tryNoodlerAccountOperation(existing.authorAccountId, () => noodle.deleteNoodlerPost(id));
    if (!locked.acquired) {
      return reply.code(409).send({
        error: "Another operation for this NoodleR account is already running.",
      });
    }
    if (!locked.value) return reply.code(404).send({ error: "NoodleR post not found" });
    unlinkNoodlerMedia(readNoodlerMediaPath(locked.value));
    return locked.value;
  });

  app.post("/noodler/accounts/:id/subscribe", async (req, reply) => {
    const parsed = noodlerSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const [viewer, creator] = await Promise.all([
      resolveViewerPersona(parsed.data.personaId),
      noodle.getNoodlerAccountById(id),
    ]);
    if (
      !viewer ||
      !creator ||
      creatorBelongsToViewer(creator, viewer) ||
      isNoodlerHiddenFromViewer(creator, viewer.id)
    ) {
      return reply.code(404).send({ error: "NoodleR stage profile not found" });
    }
    const subscription = await noodle.subscribe(viewer.id, creator.id);
    if (!subscription) {
      const [wallet, price] = await Promise.all([
        noodle.getWallet(viewer.id),
        noodle.getCreatorSubscriptionPrice(creator.id),
      ]);
      if (wallet.coins < price) return reply.code(402).send({ error: "Not enough coins", price, coins: wallet.coins });
      return reply.code(400).send({ error: "Could not subscribe to this stage profile" });
    }
    const freshViewer = await resolveViewerPersona(parsed.data.personaId);
    return reply.code(201).send(buildViewerShell(await buildViewerContext(freshViewer ?? viewer)));
  });

  app.delete("/noodler/accounts/:id/subscribe", async (req, reply) => {
    const parsed = noodlerSubscriptionSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Noodle persona not found" });
    const { id } = req.params as { id: string };
    await noodle.unsubscribe(viewer.id, id);
    const freshViewer = await resolveViewerPersona(parsed.data.personaId);
    return buildViewerShell(await buildViewerContext(freshViewer ?? viewer));
  });

  app.get("/noodler/accounts/:id/subscribers", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = noodlerSubscriberPageQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await noodle.getNoodlerAccountById(id))) {
      return reply.code(404).send({ error: "NoodleR stage profile not found" });
    }
    const page = await noodle.listSubscriptionsForCreatorPage(
      id,
      parsed.data.cursorAt && parsed.data.cursorId
        ? { createdAt: parsed.data.cursorAt, id: parsed.data.cursorId }
        : null,
      parsed.data.limit,
    );
    const subscribers = (
      await Promise.all(
        page.items.map(async (subscription): Promise<NoodlerSubscriber | null> => {
          const account =
            (await noodle.getSlurpAccountForEntity("persona", subscription.viewerAccountId)) ??
            (await noodle.getViewer(subscription.viewerAccountId));
          if (!account) return null;
          return {
            id: account.id,
            displayName: account.displayName,
            handle: account.handle,
            avatarUrl: account.avatarUrl,
            avatarCrop: account.avatarCrop,
            subscribedAt: subscription.createdAt,
          };
        }),
      )
    ).filter((subscriber): subscriber is NoodlerSubscriber => subscriber !== null);
    return {
      items: subscribers,
      total: page.total,
      nextCursor: page.nextCursor,
    };
  });

  app.patch("/noodler/accounts/:id/follow", async (req, reply) => {
    const body = req.body as { personaId?: unknown; followed?: unknown };
    if (typeof body?.personaId !== "string" || typeof body.followed !== "boolean") {
      return reply.code(400).send({ error: "personaId and followed are required" });
    }
    const { id } = req.params as { id: string };
    const viewer = await resolveViewerPersona(body.personaId);
    const creator = await noodle.getNoodlerAccountById(id);
    if (
      !viewer ||
      !creator ||
      creatorBelongsToViewer(creator, viewer) ||
      isNoodlerHiddenFromViewer(creator, viewer.id)
    ) {
      return reply.code(404).send({ error: "NoodleR stage profile not found" });
    }
    const updated = await noodle.updateViewerFollow(viewer.id, creator.id, body.followed);
    if (!updated) return reply.code(400).send({ error: "Could not update follow state" });
    const freshViewer = await resolveViewerPersona(body.personaId);
    return buildViewerShell(await buildViewerContext(freshViewer ?? updated.account));
  });

  app.post("/noodler/posts/:id/unlock", async (req, reply) => {
    const parsed = noodlerUnlockSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const [viewer, post] = await Promise.all([
      resolveViewerPersona(parsed.data.personaId),
      noodle.getNoodlerPostById(id),
    ]);
    const creator = post ? await noodle.getNoodlerAccountById(post.authorAccountId) : null;
    if (
      !viewer ||
      !post ||
      !creator ||
      post.access !== "locked" ||
      creatorBelongsToViewer(creator, viewer) ||
      isNoodlerHiddenFromViewer(creator, viewer.id)
    ) {
      return reply.code(404).send({ error: "NoodleR post not found" });
    }
    const unlock = await noodle.unlockPost(viewer.id, post.id);
    // An affordable post that still fails is a different problem from an unaffordable one, so
    // the client can tell "top up" apart from "this post is gone".
    if (!unlock) {
      const wallet = await noodle.getWallet(viewer.id);
      const price = noodlerUnlockPriceFromMetadata(post.metadata);
      if (wallet.coins < price) return reply.code(402).send({ error: "Not enough coins", price, coins: wallet.coins });
      return reply.code(400).send({ error: "Could not unlock this post" });
    }
    return reply.code(201).send(buildViewerShell(await buildViewerContext(viewer)));
  });

  app.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      search?: string;
      kind?: string;
      includeAccountId?: string;
    };
  }>("/noodler/eligible-accounts", async (req, reply) => {
    const [publicAccounts, noodlerAccounts] = await Promise.all([
      noodle.listEligibleSources(),
      noodle.listNoodlerAccounts(),
    ]);
    const linkedIds = new Set(noodlerAccounts.map((account) => `${account.sourceKind}:${account.sourceEntityId}`));
    const search = (req.query.search ?? "").trim().toLocaleLowerCase();
    const kind = req.query.kind === "character" || req.query.kind === "persona" ? req.query.kind : null;
    const eligibleAccounts = publicAccounts.filter(
      (account) =>
        (account.kind === "persona" || account.kind === "character") &&
        (!kind || account.kind === kind) &&
        (!linkedIds.has(`${account.kind}:${account.entityId}`) || account.id === req.query.includeAccountId),
    );
    const filteredAccounts = search
      ? eligibleAccounts.filter((account) =>
          `${account.displayName} ${account.handle} ${account.bio}`.toLocaleLowerCase().includes(search),
        )
      : eligibleAccounts;
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    return {
      items: filteredAccounts.slice(offset, offset + limit),
      limit,
      offset,
      hasMore: offset + limit < filteredAccounts.length,
    };
  });

  app.post("/noodler/stage-profile-draft", async (req, reply) => {
    const parsed = noodleStageProfileDraftRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const settings = await noodle.getSettings();
    const connection = await resolveSlurpTextConnection(
      connections,
      parsed.data.connectionId ?? settings.generationConnectionId,
    );
    if (!connection) return reply.code(404).send({ error: "Noodle generation connection not found" });
    try {
      return await generateNoodlerStageProfileDraft(app.db, {
        request: parsed.data,
        connection,
      });
    } catch (error) {
      logger.error(
        error,
        "[noodler] Stage profile draft generation failed using %s",
        connection.model || connection.provider,
      );
      return reply
        .code(500)
        .send({ error: "Stage profile draft generation failed. Check the generation connection and try again." });
    }
  });

  /**
   * Draft one post for a directly invited character, optionally steered by the user's guidance.
   *
   * Restored with the ambient reroll above: the split kept the service and dropped the route.
   */
  app.post("/accounts/:id/post-draft", async (req, reply) => {
    const body = z
      .object({
        guidance: z.string().trim().max(20_000).optional(),
        connectionId: z.string().trim().min(1).optional(),
        debugMode: z.boolean().optional(),
      })
      .safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const { id } = req.params as { id: string };
    const account = await noodle.getAccountById(id);
    if (!isDirectlyInvitedNoodleCharacter(account)) {
      return reply.code(403).send({ error: "Only directly invited characters can generate post drafts." });
    }
    const settings = await noodle.getSettings();
    const connection = await resolveSlurpTextConnection(
      connections,
      body.data.connectionId ?? settings.generationConnectionId,
    );
    if (!connection) return reply.code(400).send({ error: "Select a Slurp generation connection first." });
    try {
      return await generateInvitedNoodlePostDraft(app.db, account!, connection, body.data);
    } catch (error) {
      if (isConnectionAdmissionFailure(error)) return reply.code(409).send({ error: getErrorMessage(error) });
      logger.error(error, "[slurp] Invited post draft generation failed");
      return reply.code(500).send({ error: getErrorMessage(error) });
    }
  });

  app.post("/accounts/:id/noodler", async (req, reply) => {
    const parsed = noodlerAccountCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const publicAccount = await noodle.resolveSourceByEntityId(id);
    if (!publicAccount) {
      return reply.code(404).send({ error: "Noodle account not found" });
    }
    const sourceSnapshot = publicAccount ? await resolveNoodlerSourceSnapshot(app.db, publicAccount) : null;
    if (
      publicAccount &&
      (stageProfileContainsPublicIdentity(
        parsed.data.stageProfile,
        await resolveNoodlerPublicIdentity(publicAccount),
      ) ||
        (sourceSnapshot && stageProfileContainsSourceDetails(parsed.data.stageProfile, sourceSnapshot)))
    ) {
      return reply.code(400).send({
        error: "Hinted and secret stage profiles cannot use identifying source names or details.",
      });
    }
    try {
      const artwork = await resolveNoodlerCreatorArtwork({
        characters,
        characterGallery,
        publicAccount,
        disclosureMode: parsed.data.stageProfile.disclosureMode,
      });
      const created = await noodle.createNoodlerAccount(
        publicAccount.kind as "character" | "persona",
        publicAccount.entityId,
        parsed.data.stageProfile,
        undefined,
        sourceSnapshot
          ? minimizeNoodlerSourceSnapshot(sourceSnapshot, parsed.data.stageProfile.disclosureMode)
          : undefined,
        artwork.avatarUrl,
        artwork.bannerUrl,
      );
      if (!created) return reply.code(404).send({ error: "Noodle account not found" });
      const profile = (await noodle.listNoodlerStageProfiles()).find((item) => item.id === created.id);
      if (!profile) throw new Error("Failed to load the created NoodleR stage profile.");
      return reply.code(201).send(profile);
    } catch (error) {
      if (isFileUniqueConstraintError(error, "slurp_accounts", ["sourceKind", "sourceEntityId"])) {
        return reply.code(409).send({
          error: "A NoodleR account already exists for this Noodle account.",
        });
      }
      throw error;
    }
  });

  app.post("/noodler/accounts/bulk", async (req, reply) => {
    const parsed = slurpBulkNoodlerAccountCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { noodleAccountIds, disclosureMode, disclosureExceptions, autoPosting, connectionId, executionId } =
      parsed.data;
    if (noodleAccountIds.length === 0) {
      return reply.code(201).send({ created: [], skipped: [], failed: [], reasons: [], executionId });
    }
    const settings = await noodle.getSettings();
    const connection = await resolveSlurpTextConnection(
      connections,
      connectionId === undefined ? settings.generationConnectionId : connectionId,
    );
    if (!connection) return reply.code(400).send({ error: "The selected writing connection is not available." });
    const created: string[] = [];
    const skipped: string[] = [];
    // Operational failures (provider/storage) are reported apart from expected exclusions
    // so a provider outage cannot look like a batch of harmless skips.
    const failed: string[] = [];
    // Every exclusion carries a reason against its creator: without one the wizard can only
    // report a count, and one batch can fail for several different causes.
    const reasons: { accountId: string; reason: string }[] = [];
    const noteReason = (accountId: string, reason: string) => {
      reasons.push({ accountId, reason });
    };
    const errorReason = (error: unknown) => (error instanceof Error ? error.message : String(error));
    // The account row and its scheduler settings are two writes. A retry that finds the row
    // already there must still apply the settings, or a creator whose first attempt failed
    // between the two is reported as created while never receiving its auto-posting config.
    const applyAutoPosting = (accountId: string) =>
      noodle.patchAccountSettings(accountId, {
        subtree: "scheduler",
        patch: { autoPosting },
      });
    const settledCreations = await settleAgentJobsWithConcurrencyLimit(noodleAccountIds, 4, async (noodleAccountId) => {
      const publicAccount = await noodle.resolveSourceByEntityId(noodleAccountId);
      const existing = publicAccount
        ? await noodle.getNoodlerAccountForSource(publicAccount.kind as "character" | "persona", publicAccount.entityId)
        : null;
      if (existing) {
        if (executionId && existing.settings.profile.noodlerWizardExecutionId === executionId) {
          try {
            await applyAutoPosting(existing.id);
            created.push(existing.id);
          } catch (error) {
            logger.error(error, "[noodler] Bulk replay could not apply auto-posting for %s", noodleAccountId);
            failed.push(noodleAccountId);
            noteReason(noodleAccountId, errorReason(error));
          }
        } else {
          skipped.push(noodleAccountId);
          noteReason(
            noodleAccountId,
            "Already a Slurp creator from an earlier run. Remove the existing creator first to create it again.",
          );
        }
        return;
      }
      const accountDisclosure = disclosureExceptions[noodleAccountId] ?? disclosureMode;
      if (!publicAccount) {
        skipped.push(noodleAccountId);
        noteReason(noodleAccountId, "The source character or persona no longer exists in Noodle.");
        return;
      }
      try {
        const stageProfile = await generateNoodlerStageProfileDraft(app.db, {
          request: {
            noodleAccountId,
            disclosureMode: accountDisclosure,
            guidance: "",
          },
          connection,
        });
        const sourceSnapshot = await resolveNoodlerSourceSnapshot(app.db, publicAccount);
        // Belt-and-braces: the generator already enforces leak protection, but keep the guard.
        if (
          stageProfileContainsPublicIdentity(stageProfile, await resolveNoodlerPublicIdentity(publicAccount)) ||
          (sourceSnapshot && stageProfileContainsSourceDetails(stageProfile, sourceSnapshot))
        ) {
          skipped.push(noodleAccountId);
          noteReason(
            noodleAccountId,
            "The generated stage profile repeated the linked public identity, so it was rejected. Try again, or set the disclosure mode to open.",
          );
          return;
        }
        const artwork = await resolveNoodlerCreatorArtwork({
          characters,
          characterGallery,
          publicAccount,
          disclosureMode: accountDisclosure,
        });
        const account = await noodle.createNoodlerAccount(
          publicAccount.kind as "character" | "persona",
          publicAccount.entityId,
          stageProfile,
          executionId,
          sourceSnapshot ? minimizeNoodlerSourceSnapshot(sourceSnapshot, accountDisclosure) : undefined,
          artwork.avatarUrl,
          artwork.bannerUrl,
        );
        if (!account) {
          skipped.push(noodleAccountId);
          noteReason(noodleAccountId, "The creator record could not be written.");
          return;
        }
        await applyAutoPosting(account.id);
        created.push(account.id);
      } catch (error) {
        if (isFileUniqueConstraintError(error, "slurp_accounts", ["sourceKind", "sourceEntityId"])) {
          const replayed = await noodle.getNoodlerAccountForSource(
            publicAccount.kind as "character" | "persona",
            publicAccount.entityId,
          );
          if (executionId && replayed?.settings.profile.noodlerWizardExecutionId === executionId) {
            // This branch already runs inside the outer catch, so an unguarded throw here would
            // escape the loop and fail the whole batch instead of this one creator.
            try {
              await applyAutoPosting(replayed.id);
              created.push(replayed.id);
            } catch (autoPostingError) {
              logger.error(
                autoPostingError,
                "[noodler] Bulk replay could not apply auto-posting for %s",
                noodleAccountId,
              );
              failed.push(noodleAccountId);
              noteReason(noodleAccountId, errorReason(autoPostingError));
            }
          } else {
            skipped.push(noodleAccountId);
            noteReason(
              noodleAccountId,
              "Already a Slurp creator from an earlier run. Remove the existing creator first to create it again.",
            );
          }
          return;
        }
        logger.error(error, "[noodler] Bulk stage profile generation failed for %s", noodleAccountId);
        failed.push(noodleAccountId);
        noteReason(noodleAccountId, errorReason(error));
        return;
      }
    });
    settledCreations.forEach((result, index) => {
      if (result.status === "fulfilled") return;
      const noodleAccountId = noodleAccountIds[index]!;
      logger.error(result.reason, "[noodler] Bulk stage profile setup failed for %s", noodleAccountId);
      failed.push(noodleAccountId);
      noteReason(noodleAccountId, errorReason(result.reason));
    });
    const profiles = await noodle.listNoodlerStageProfiles();
    return reply.code(201).send({
      created: profiles.filter((profile) => created.includes(profile.id)),
      skipped,
      failed,
      reasons,
      executionId,
    });
  });

  app.put("/noodler/accounts/:id/stage-profile", async (req, reply) => {
    const parsed = noodleStageProfileUpdateRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    let discardedPreparedPostCount = 0;
    const locked = await tryNoodlerAccountOperation(id, async () => {
      const noodlerAccount = await noodle.getNoodlerAccountById(id);
      const publicAccount = noodlerAccount ? await noodle.resolveAccountSource(noodlerAccount) : null;
      const currentSourceSnapshot = publicAccount ? await resolveNoodlerSourceSnapshot(app.db, publicAccount) : null;
      if (
        publicAccount &&
        (stageProfileContainsPublicIdentity(parsed.data, await resolveNoodlerPublicIdentity(publicAccount)) ||
          (currentSourceSnapshot && stageProfileContainsSourceDetails(parsed.data, currentSourceSnapshot)))
      ) {
        return { status: "identity_conflict" } as const;
      }
      const submittedSnapshotIsCurrent =
        parsed.data.sourceSnapshot &&
        currentSourceSnapshot &&
        compareNoodlerSourceSnapshots(parsed.data.sourceSnapshot, currentSourceSnapshot).state === "current";
      const submittedRevisionIsCurrent =
        parsed.data.sourceRevisionToken &&
        currentSourceSnapshot &&
        verifyNoodlerSourceRevisionToken(parsed.data.sourceRevisionToken, id, currentSourceSnapshot);
      const sourceRevisionIsCurrent =
        parsed.data.disclosureMode === "open" ? submittedSnapshotIsCurrent : submittedRevisionIsCurrent;
      if (parsed.data.acceptSourceChanges && !sourceRevisionIsCurrent) {
        return { status: "source_revision_conflict" } as const;
      }
      if (noodlerAccount) {
        const currentMode = noodlerAccount.settings.privacy.identityDisclosure ?? "secret";
        const [publishedPosts, preparedPosts] = await Promise.all([
          noodle.listAllNoodlerPostsByAccount(id),
          noodle.listNoodlerPreparedPosts(),
        ]);
        const publicIdentity = publicAccount ? await resolveNoodlerPublicIdentity(publicAccount) : null;
        const preparedForCreator = preparedPosts.filter(
          (post) => post.creatorAccountId === id && post.state === "prepared",
        );
        const identifyingPostCount = currentSourceSnapshot
          ? publishedPosts.filter((post) => {
              const candidate = {
                displayName: "review",
                handle: "review",
                bio: [post.title, post.content].filter(Boolean).join(" "),
                stagePersonality: "",
                disclosureMode: parsed.data.disclosureMode,
              };
              return (
                (publicIdentity && stageProfileContainsPublicIdentity(candidate, publicIdentity)) ||
                stageProfileContainsSourceDetails(candidate, currentSourceSnapshot)
              );
            }).length
          : publishedPosts.length;
        const reviewReasons = noodlerDisclosureReviewReasons({
          currentMode,
          nextMode: parsed.data.disclosureMode,
          postCount: identifyingPostCount,
          mediaCount: publishedPosts.filter((post) => Boolean(post.imageUrl)).length,
          // Any avatar/banner must trigger review, including ones adopted from the linked
          // source (whose URL lives outside the NoodleR media namespace, so
          // readNoodler*MediaPath would return null and skip the check).
          hasAvatar: Boolean(noodlerAccount.avatarUrl),
          hasBanner: Boolean(noodlerAccount.settings.profile.bannerUrl),
          preparedPostCount: preparedForCreator.length,
        });
        const unresolvedReviewReasons = parsed.data.confirmAvatarReview
          ? reviewReasons.filter((reason) => reason.code !== "creator_avatar")
          : reviewReasons;
        if (unresolvedReviewReasons.length > 0) {
          return {
            status: "disclosure_review_required",
            reviewReasons: unresolvedReviewReasons,
          } as const;
        }
        await Promise.all(preparedForCreator.map((post) => noodle.discardNoodlerPreparedPost(post.id)));
        // The downgrade throws away unreleased reserve posts; say how many.
        discardedPreparedPostCount = preparedForCreator.length;
      }
      const currentMode = noodlerAccount?.settings.privacy.identityDisclosure ?? "secret";
      const sourceSnapshot =
        currentSourceSnapshot &&
        (parsed.data.disclosureMode !== currentMode || (parsed.data.acceptSourceChanges && sourceRevisionIsCurrent))
          ? minimizeNoodlerSourceSnapshot(currentSourceSnapshot, parsed.data.disclosureMode)
          : undefined;
      const {
        acceptSourceChanges: _acceptSourceChanges,
        sourceSnapshot: _sourceSnapshot,
        sourceRevisionToken: _sourceRevisionToken,
        confirmAvatarReview: _confirmAvatarReview,
        location,
        ...stageProfile
      } = parsed.data;
      const updated = await noodle.updateNoodlerStageProfile(id, stageProfile, sourceSnapshot ?? undefined, location);
      if (!updated) return { status: "not_found" } as const;
      const profile = (await noodle.listNoodlerStageProfiles()).find((item) => item.id === updated.id);
      if (!profile) throw new Error("Failed to load the updated NoodleR stage profile.");
      return { status: "updated", profile, discardedPreparedPostCount } as const;
    });
    if (!locked.acquired) {
      return reply.code(409).send({
        error: "Another operation for this NoodleR account is already running.",
      });
    }
    if (locked.value.status === "identity_conflict") {
      return reply.code(400).send({
        error: "Hinted and secret stage profiles cannot use identifying source names or details.",
      });
    }
    if (locked.value.status === "disclosure_review_required") {
      return reply.code(409).send({
        error: "Review or remove existing creator content before using a more private identity mode.",
        reviewRequired: locked.value.reviewReasons.map((reason) => reason.label),
        reviewRequiredCodes: locked.value.reviewReasons,
      });
    }
    if (locked.value.status === "not_found") {
      return reply.code(404).send({ error: "NoodleR stage profile not found" });
    }
    if (locked.value.status === "source_revision_conflict") {
      return reply.code(409).send({
        error:
          "The linked source changed or this draft expired. Generate a fresh draft before accepting source changes.",
      });
    }
    return {
      ...locked.value.profile,
      discardedPreparedPostCount: locked.value.discardedPreparedPostCount,
    };
  });

  app.post("/noodler/accounts/:id/source/dismiss", async (req, reply) => {
    const { id } = req.params as { id: string };
    const locked = await tryNoodlerAccountOperation(id, async () => {
      const account = await noodle.getNoodlerAccountById(id);
      const publicAccount = account ? await noodle.resolveAccountSource(account) : null;
      const sourceSnapshot = publicAccount ? await resolveNoodlerSourceSnapshot(app.db, publicAccount) : null;
      if (!account || !sourceSnapshot) return false;
      await noodle.updateNoodlerSourceSnapshot(
        id,
        minimizeNoodlerSourceSnapshot(sourceSnapshot, account.settings.privacy.identityDisclosure ?? "secret"),
      );
      return true;
    });
    if (!locked.acquired) return reply.code(409).send({ error: "Another Creator operation is already running." });
    if (!locked.value) return reply.code(404).send({ error: "NoodleR source not found" });
    return (await noodle.listNoodlerStageProfiles()).find((profile) => profile.id === id);
  });

  app.post("/noodler/accounts/:id/source/adopt-identity", async (req, reply) => {
    const { id } = req.params as { id: string };
    const locked = await tryNoodlerAccountOperation(id, async () => {
      const account = await noodle.getNoodlerAccountById(id);
      const publicAccount = account ? await noodle.resolveAccountSource(account) : null;
      const sourceSnapshot = publicAccount ? await resolveNoodlerSourceSnapshot(app.db, publicAccount) : null;
      if (!account || !sourceSnapshot) return "missing" as const;
      return (await noodle.adoptNoodlerPublicIdentity(id, sourceSnapshot))
        ? ("updated" as const)
        : ("invalid" as const);
    });
    if (!locked.acquired) return reply.code(409).send({ error: "Another Creator operation is already running." });
    if (locked.value === "missing") return reply.code(404).send({ error: "NoodleR source not found" });
    if (locked.value === "invalid") {
      return reply.code(400).send({
        error: "Only open Creator profiles can adopt the public identity.",
      });
    }
    return (await noodle.listNoodlerStageProfiles()).find((profile) => profile.id === id);
  });

  app.delete("/noodler/accounts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const locked = await tryNoodlerAccountOperation(id, async () => {
      const imageConnections = await getNoodlerImageConnections(app.db);
      const removedConnectionId = imageConnections.creatorConnectionIds[id];
      await updateNoodlerImageConnections(app.db, (current) => {
        const creatorConnectionIds = { ...current.creatorConnectionIds };
        delete creatorConnectionIds[id];
        return { ...current, creatorConnectionIds };
      });
      try {
        const deleted = await noodle.deleteNoodlerAccount(id);
        if (deleted) removeNoodlerAccountMedia(id);
        return deleted;
      } catch (error) {
        if (removedConnectionId) {
          await updateNoodlerImageConnections(app.db, (current) => ({
            ...current,
            creatorConnectionIds: {
              ...current.creatorConnectionIds,
              [id]: removedConnectionId,
            },
          }));
        }
        throw error;
      }
    });
    if (!locked.acquired) {
      return reply.code(409).send({
        error: "Another operation for this NoodleR account is already running.",
      });
    }
    const deleted = locked.value;
    if (!deleted) return reply.code(404).send({ error: "NoodleR stage profile not found" });
    return deleted;
  });

  app.delete("/data", async (_req, reply) => {
    const locked = await trySlurpDataDeletion(async () => {
      const result = await noodle.deleteAllSlurpData();
      await clearNoodlerImageConnections(app.db);
      removeAllNoodlerMedia();
      return result;
    });
    if (!locked.acquired) return reply.code(409).send({ error: "Another Slurp operation is already running." });
    return locked.value;
  });

  app.delete("/data/unused", async (_req, reply) => {
    const locked = await trySlurpDataDeletion(() => noodle.deleteUnusedSlurpData());
    if (!locked.acquired) return reply.code(409).send({ error: "Another Slurp operation is already running." });
    return locked.value;
  });

  app.get("/noodler/accounts/:id/posts", async (req, reply) => {
    const parsed = noodlerProfilePostsQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    if (!(await noodle.getNoodlerAccountById(id))) {
      return reply.code(404).send({ error: "NoodleR stage profile not found" });
    }
    const viewer = parsed.data.personaId ? await resolveViewerPersona(parsed.data.personaId) : null;
    if (parsed.data.personaId && !viewer) {
      return reply.code(404).send({ error: "Noodle persona not found" });
    }
    const context = viewer ? await buildViewerContext(viewer) : null;
    const creatorVisible = Boolean(context?.accountById.has(id));
    if (context && !creatorVisible) {
      return { items: [], total: 0, nextCursor: null };
    }
    const viewerOwnsCreator = Boolean(
      context && creatorBelongsToViewer(context.accountById.get(id) ?? null, context.viewer),
    );
    const page = await noodle.listNoodlerPostPage({
      accountIds: [id],
      readableContentAccountIds:
        !context ||
        creatorBelongsToViewer(context.accountById.get(id) ?? null, context.viewer) ||
        context.subscribedIds.has(id)
          ? [id]
          : [],
      unlockedPostIds: context ? [...context.unlockedIds] : [],
      mediaOnly: parsed.data.filter === "media",
      cursor:
        parsed.data.cursorAt && parsed.data.cursorId
          ? { createdAt: parsed.data.cursorAt, id: parsed.data.cursorId }
          : null,
      limit: parsed.data.limit,
    });
    const projected = context ? await projectViewerPosts(context, page.items) : null;
    return {
      items:
        context && !viewerOwnsCreator
          ? page.items.flatMap((post) => {
              const viewerPost = projected!.get(post.id);
              return viewerPost ? [{ viewerPost }] : [];
            })
          : page.items.map((managed) => ({
              managed,
              viewerPost: projected?.get(managed.id) ?? null,
            })),
      total: page.total,
      nextCursor: page.nextCursor,
    };
  });

  app.get("/noodler/auto-post/status", async (_req, reply) => {
    return noodle.getNoodlerReserveStatus();
  });

  app.patch("/noodler/auto-post/schedule/:slotId", async (req, reply) => {
    const body = z.object({ publishAt: z.string().datetime() }).safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const { slotId } = req.params as { slotId: string };
    const result = await noodle.rescheduleNoodlerPost(slotId, body.data.publishAt);
    if (result === "not_found") return reply.code(404).send({ error: "Scheduled Slurp post not found." });
    if (result === "not_future") return reply.code(400).send({ error: "Publication time must be in the future." });
    if (result === "not_editable") return reply.code(409).send({ error: "This Slurp post is no longer editable." });
    if (result === "conflict") {
      return reply.code(409).send({ error: "This publication time is too close to another Creator post." });
    }
    return noodle.getNoodlerReserveStatus();
  });

  app.get("/noodler/image-connections", async () => getNoodlerImageConnections(app.db));

  app.patch("/noodler/image-connections", async (req, reply) => {
    const body = z
      .object({
        defaultConnectionId: z.string().min(1).nullable().optional(),
        creatorId: z.string().min(1).optional(),
        connectionId: z.string().min(1).nullable().optional(),
      })
      .safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const { creatorId, connectionId, defaultConnectionId } = body.data;
    // A creatorId without a connectionId (or the reverse) silently did nothing.
    if ((creatorId === undefined) !== (connectionId === undefined)) {
      return reply.code(400).send({
        error: "Set creatorId and connectionId together to map a Creator to an image connection.",
      });
    }
    if (creatorId && !(await noodle.getNoodlerAccountById(creatorId))) {
      return reply.code(404).send({ error: "NoodleR stage profile not found" });
    }
    for (const candidateConnectionId of [defaultConnectionId, connectionId]) {
      if (candidateConnectionId === undefined || candidateConnectionId === null) continue;
      const connection = await connections.getWithKey(candidateConnectionId);
      if (!connection || connection.provider !== "image_generation") {
        return reply.code(404).send({ error: "Noodle image connection not found" });
      }
    }
    return updateNoodlerImageConnections(app.db, (current) => {
      const creatorConnectionIds = { ...current.creatorConnectionIds };
      if (creatorId) {
        if (connectionId) creatorConnectionIds[creatorId] = connectionId;
        else delete creatorConnectionIds[creatorId];
      }
      return {
        defaultConnectionId: defaultConnectionId !== undefined ? defaultConnectionId : current.defaultConnectionId,
        creatorConnectionIds,
      };
    });
  });

  // Manual test trigger: runs one automatic-style post immediately, the same way the
  // scheduler does (locked access, no guide), without waiting for the next cadence
  // schedule or requiring auto-posting to be enabled.
  app.post("/noodler/accounts/:id/auto-post/run-now", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const result = await generateAndApplyNoodlerPost(app.db, {
        mode: "noodler",
        targetAccountId: id,
        access: "locked",
      });
      // Run-now never sets reviewImagePromptsBeforeSend, so the generator can only return a
      // plain post here — no image-prompt review is ever produced on this path.
      if (result.status === "generated") return result.post;
      if (result.status === "busy") {
        return reply.code(409).send({
          error: "A generation for this NoodleR account is already running.",
        });
      }
      if (result.status === "connection_required") {
        return reply.code(400).send({ error: "Select a Noodle generation connection first." });
      }
      if (result.status === "connection_not_found") {
        return reply.code(404).send({ error: "Noodle generation connection not found" });
      }
      if (result.status === "disabled") {
        return reply.code(400).send({ error: "Persona-owned Slurp profiles cannot post automatically" });
      }
      return reply.code(404).send({ error: "NoodleR account not found." });
    } catch (error) {
      logger.error(error, "[noodler] Manual run-now failed");
      return reply.code(500).send({ error: "Manual post generation failed." });
    }
  });

  // Global manual trigger: runs every automation-enabled creator (prioritizing those
  // scheduled soonest), consuming each selected creator's near-future slot the same way
  // an automatic run would. One creator's failure does not affect the others.
  app.post("/noodler/auto-post/refresh-now", async (_req, reply) => {
    const result = await refreshAllNoodlerCreatorsNow(app.db);
    if (result.status === "disabled") return reply.code(404).send({ error: "Not Found" });
    return { outcomes: result.outcomes };
  });

  app.post("/noodler/fan-activity/refresh-now", async (req, reply) => {
    try {
      const result = await runNoodlerFanActivity({
        db: app.db,
        mode: "manual",
        debugMode: (req.body as { debugMode?: unknown } | undefined)?.debugMode === true,
      });
      if (result.status === "disabled") return reply.code(404).send({ error: "Not Found" });
      if (result.status === "busy") return reply.code(409).send({ error: "NoodleR fan activity is already running." });
      if (result.status === "limit_reached")
        return reply.code(429).send({ error: "Today's audience activity limit has been reached." });
      if (result.status === "connection_required") {
        return reply.code(400).send({ error: "Select a Noodle generation connection first." });
      }
      if (result.status === "connection_not_found") {
        return reply.code(404).send({ error: "Noodle generation connection not found" });
      }
      return result;
    } catch (error) {
      if (isConnectionAdmissionFailure(error)) return reply.code(409).send({ error: getErrorMessage(error) });
      logger.error(error, "[noodler] Fan activity generation failed");
      return reply.code(500).send({ error: "Fan activity generation failed." });
    }
  });

  app.get("/noodler/fan-activity/status", async () => getNoodlerFanActivityStatus(app.db));

  app.post("/noodler/auto-post/refresh-targeted", async (req, reply) => {
    const parsed = slurpTargetedRefreshSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = await refreshTargetedNoodlerCreatorsNow(
      app.db,
      parsed.data.accountIds,
      parsed.data.executionId,
      parsed.data.access ?? "locked",
    );
    if (result.status === "disabled") return reply.code(404).send({ error: "Not Found" });
    return { outcomes: result.outcomes };
  });

  app.post("/noodler/refresh/images", async (req, reply) => {
    const parsed = noodleImagePromptConfirmationSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = await noodlerImages.generateReviewedImages({
      prompts: parsed.data.prompts,
      debugMode: parsed.data.debugMode === true,
    });
    if (!result.ok) return reply.code(400).send({ error: result.message });
    return { finalized: result.finalized };
  });

  app.post("/refresh", async (req, reply) => {
    let decoded: DecodedNoodlerMediaRequest<
      z.output<typeof noodlerGenerationRequestSchema> | z.output<typeof noodleGenerationRequestSchema>
    >;
    try {
      decoded = await decodeNoodlerMediaRequest(req, {
        withMedia: noodlerGenerationRequestSchema,
        withoutMedia: noodleGenerationRequestSchema,
      });
    } catch (error) {
      return sendNoodlerMediaError(reply, error);
    }
    if (!decoded.success) return reply.code(400).send({ error: decoded.error.flatten() });
    if (decoded.data.mode !== "noodler") return reply.code(404).send({ error: "Not Found" });
    try {
      const result = await generateAndApplyNoodlerPost(
        app.db,
        decoded.data,
        decoded.media,
        admissionModeForRequest(req.headers),
      );
      if (result.status === "generated") {
        return result.imagePromptReview ? { ...result.post, imagePromptReview: result.imagePromptReview } : result.post;
      }
      if (result.status === "busy") {
        return reply.code(409).send({
          error: "A generation for this NoodleR account is already running.",
        });
      }
      if (result.status === "connection_required") {
        return reply.code(400).send({ error: "Select a Noodle generation connection first." });
      }
      if (result.status === "connection_not_found") {
        return reply.code(404).send({ error: "Noodle generation connection not found" });
      }
      if (result.status === "disabled") {
        return reply.code(400).send({ error: "Persona-owned Slurp profiles cannot post automatically" });
      }
      return reply.code(404).send({ error: "NoodleR account not found." });
    } catch (error) {
      if (isConnectionAdmissionFailure(error)) return reply.code(409).send({ error: getErrorMessage(error) });
      logger.error(error, "[noodler] NoodleR post generation failed");
      return reply.code(500).send({ error: "NoodleR post generation failed." });
    }
  });

  await slurpMessageRoutes(app);
}
