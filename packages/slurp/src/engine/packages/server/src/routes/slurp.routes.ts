// ──────────────────────────────────────────────
// Routes: Noodle Fake Social Media
// ──────────────────────────────────────────────
import { existsSync } from "fs";
import { basename, dirname } from "path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { extname } from "node:path";
import { z } from "zod";
import {
  createNoodlePoll,
  noodleBulkNoodlerAccountCreateSchema,
  noodlerPostCreateSchema,
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
import { generateAndApplyNoodlerCreatorReply } from "../services/slurp/slurp-creator-reply.operation.js";
import { getNoodlerFanActivityStatus, runNoodlerFanActivity } from "../services/slurp/slurp-fan-activity.operation.js";
import { admissionModeForRequest, isConnectionAdmissionFailure } from "../services/generation/connection-admission.js";
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
  readNoodlerMediaPath,
  removeNoodlerAccountMedia,
  resolveNoodlerMediaAbsolutePath,
  type NoodlerPostMediaUpload,
  unlinkNoodlerMedia,
} from "../services/slurp/slurp-media.js";
import {
  resolveNoodlerAvatarAbsolutePath,
  stageNoodlerAvatar,
  stageNoodlerBanner,
  unlinkNoodlerAvatar,
  unlinkNoodlerBanner,
  resolveNoodlerBannerAbsolutePath,
} from "../services/slurp/slurp-avatar.js";
import { getErrorMessage } from "../services/slurp/slurp-public-support.js";
import { generateNoodlerCreatorArtwork } from "../services/slurp/slurp-artwork.operation.js";

const slurpTargetedRefreshSchema = noodlerTargetedRefreshSchema.extend({
  access: z.enum(["public", "locked"]).optional(),
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
    let buffer: Buffer;
    try {
      buffer = await part.toBuffer();
    } catch (error) {
      const truncated = (part.file as typeof part.file & { truncated?: boolean }).truncated === true;
      const tooLarge = truncated || (error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE";
      throw new NoodlerMediaRequestError(
        tooLarge ? "NoodleR image is too large." : "Failed to read the uploaded image.",
        tooLarge ? 413 : 400,
      );
    }
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
  | { success: true; data: T; media: NoodlerPostMediaUpload | undefined }
  | { success: false; error: z.ZodError };

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

  app.patch("/accounts/:id/settings", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = noodleAccountSettingsPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = await noodle.patchAccountSettings(id, parsed.data);
    if (!updated) return reply.code(404).send({ error: "Creator account not found" });
    return updated;
  });

  app.get("/noodler/accounts", async (_req, reply) => {
    return noodle.listNoodlerStageProfiles();
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
    return reply
      .header("Cache-Control", "private, max-age=31536000, immutable")
      .sendFile(basename(absolute), dirname(absolute));
  });

  app.get("/noodler/accounts/:id/banner/:fileName", async (req, reply) => {
    const { id, fileName } = req.params as { id: string; fileName: string };
    const account = await noodle.getNoodlerAccountById(id);
    const absolute = account ? resolveNoodlerBannerAbsolutePath(id, account.settings.profile.bannerUrl ?? null) : null;
    if (!absolute || basename(absolute) !== fileName || !existsSync(absolute)) {
      return reply.code(404).send({ error: "Not Found" });
    }
    return reply
      .header("Cache-Control", "private, max-age=31536000, immutable")
      .sendFile(basename(absolute), dirname(absolute));
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
    return {
      viewer,
      visibleAccounts,
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
        // Fictional subscription price, presentation only. Per-Creator pricing would need a field
        // on the shared Engine account settings type, so every Creator shows the same default.
        subscriptionPrice: NOODLER_SUBSCRIPTION_COST,
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
  type NoodlerPricedPostView = NoodlerPostView & { unlockPrice: number | null };

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
            // presentation only — nothing on the unlock route reads it back or checks funds.
            unlockPrice: locked ? noodlerUnlockPriceFromMetadata(post.metadata) : null,
            createdAt: post.createdAt,
            interactions: locked ? [] : visibleInteractions,
            likeCount: allInteractions.filter((item) => item.type === "like").length,
            replyCount: allInteractions.filter((item) => item.type === "reply").length,
          },
        ];
      }),
    );
  }

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
    return (
      reply
        // The post-owned URL is stable across ordinary feed refreshes, but an owner can replace
        // its bytes in place. Audience URLs include distinct locked/original variants, so an
        // unlock changes the browser cache key instead of retaining a cached teaser.
        .header("Cache-Control", "private, max-age=300")
        .sendFile(basename(absolute), dirname(absolute))
    );
  });

  app.post("/noodler/posts/:id/interactions", async (req, reply) => {
    const parsed = noodlerCreateInteractionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
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
      actorAccountId: gated.viewer.id,
      type: parsed.data.type,
      content: parsed.data.content ?? null,
      parentInteractionId: parsed.data.parentInteractionId ?? null,
    });
    if (!interaction) return reply.code(400).send({ error: "Could not add that NoodleR interaction." });
    return reply.code(201).send(interaction);
  });

  app.post("/noodler/posts/:postId/interactions/:interactionId/creator-reply", async (req, reply) => {
    const parsed = noodlerCreatorReplyRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { postId, interactionId } = req.params as {
      postId: string;
      interactionId: string;
    };
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Noodle persona not found" });
    try {
      const result = await generateAndApplyNoodlerCreatorReply(app.db, {
        postId,
        parentInteractionId: interactionId,
        viewerAccountId: viewer.id,
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
    const gated = await resolveGatedNoodlerPost(parsed.data.personaId, id);
    if (!gated) return reply.code(404).send({ error: "NoodleR post not found" });
    const interaction = await noodle.deleteNoodlerInteraction(id, {
      actorAccountId: gated.viewer.id,
      type: parsed.data.type,
      parentInteractionId: parsed.data.parentInteractionId ?? null,
    });
    if (!interaction) return reply.code(404).send({ error: "NoodleR interaction not found" });
    return interaction;
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
      z.output<typeof noodlerPostCreateWithMediaSchema> | z.output<typeof noodlerPostCreateSchema>
    >;
    try {
      decoded = await decodeNoodlerMediaRequest(req, {
        withMedia: noodlerPostCreateWithMediaSchema,
        withoutMedia: noodlerPostCreateSchema,
      });
    } catch (error) {
      return sendNoodlerMediaError(reply, error);
    }
    if (!decoded.success) return reply.code(400).send({ error: decoded.error.flatten() });
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
    if (!subscription) return reply.code(400).send({ error: "Could not subscribe to this stage profile" });
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
          const account = await noodle.getViewer(subscription.viewerAccountId);
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
    if (!unlock) return reply.code(400).send({ error: "Could not unlock this post" });
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
    const connection = parsed.data.connectionId
      ? await connections.getWithKey(parsed.data.connectionId)
      : await connections.getDefaultForAgents();
    if (!connection) return reply.code(404).send({ error: "Noodle generation connection not found" });
    try {
      return await generateNoodlerStageProfileDraft(app.db, {
        request: parsed.data,
        connection,
      });
    } catch (error) {
      logger.error(error, "[noodler] Stage profile draft generation failed");
      return reply.code(500).send({ error: "Stage profile draft generation failed." });
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
    const selectedConnectionId = connectionId === undefined ? settings.generationConnectionId : connectionId;
    const connection = selectedConnectionId
      ? await connections.getWithKey(selectedConnectionId)
      : await connections.getDefaultForAgents();
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
        ...stageProfile
      } = parsed.data;
      const updated = await noodle.updateNoodlerStageProfile(id, stageProfile, sourceSnapshot ?? undefined);
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
    for (const connectionId of [defaultConnectionId, connectionId]) {
      if (connectionId === undefined || connectionId === null) continue;
      const connection = await connections.getWithKey(connectionId);
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
      return reply.code(404).send({ error: "NoodleR account not found." });
    } catch (error) {
      if (isConnectionAdmissionFailure(error)) return reply.code(409).send({ error: getErrorMessage(error) });
      logger.error(error, "[noodler] NoodleR post generation failed");
      return reply.code(500).send({ error: "NoodleR post generation failed." });
    }
  });
}
