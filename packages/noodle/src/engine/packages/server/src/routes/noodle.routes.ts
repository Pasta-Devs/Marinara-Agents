import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createNoodleStorage } from "../services/storage/noodle.storage.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createPublicNoodleGenerationService } from "../services/noodle/noodle-public-generation.service.js";
import { createPublicNoodleImagesService } from "../services/noodle/noodle-public-images.service.js";
import { resolveImageCaptioningRuntime } from "../services/generation/image-captioning-runtime.js";
import { normalizePromptTimeZone } from "../services/conversation/timezone.js";
import { bootstrapVisibleNoodle, characterAvatarCrop, characterNameFromRow, getErrorMessage, parseRecord } from "../services/noodle/noodle-public-support.js";
import { isConnectionAdmissionFailure, admissionModeForRequest } from "../services/generation/connection-admission.js";

const accountQuery = z.object({ accountId: z.string().trim().min(1) });
const noodleImagePromptConfirmationSchema = z.object({
  prompts: z.array(z.object({
    id: z.string().min(1),
    prompt: z.string().trim().min(1).max(20_000),
    negativePrompt: z.string().trim().max(20_000).optional(),
  })).max(20),
  debugMode: z.boolean().optional(),
});
const noodleGenerationRequestSchema = z.object({
  mode: z.literal("public"),
  personaId: z.string().min(1).optional(),
  connectionId: z.string().min(1).optional(),
  timeZone: z.string().min(1).optional(),
  debugMode: z.boolean().optional(),
  reviewImagePromptsBeforeSend: z.boolean().optional(),
});
const noodleRescheduleRefreshSchema = z.object({
  scheduledTime: z.string().datetime(),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u, "Use a 24-hour time in HH:mm format."),
});

export async function noodleRoutes(app: FastifyInstance) {
  const noodle = createNoodleStorage(app.db);
  const characters = createCharactersStorage(app.db);
  const connections = createConnectionsStorage(app.db);
  const publicGeneration = createPublicNoodleGenerationService(app.db);
  const publicImages = createPublicNoodleImagesService(app.db);

  app.get("/", async () => noodle.bootstrap());
  app.get("/refresh-indicator", async () => {
    const [latest] = await noodle.listRefreshRuns({ status: "completed", limit: 1 });
    return { marker: latest ? `${latest.id}:${latest.updatedAt}` : null };
  });
  app.put("/settings", async (request) => noodle.updateSettings(request.body as Record<string, unknown>));
  app.post("/ambient-profiles/reroll", async (request, reply) => {
    const { rerollAmbientNoodleProfiles } = await import("../services/noodle/noodle-ambient-profile-generation.service.js");
    const { createConnectionsStorage } = await import("../services/storage/connections.storage.js");
    const settings = await noodle.getSettings();
    const connectionId = String((settings as { generationConnectionId?: unknown }).generationConnectionId ?? "");
    const connection = connectionId ? await createConnectionsStorage(app.db).getWithKey(connectionId) : null;
    if (!connection) return reply.code(400).send({ error: "Select a Noodle generation connection first." });
    const accountIds = ((request.body as { accountIds?: string[] }).accountIds ?? []);
    const accounts = (await Promise.all(accountIds.map((id) => noodle.getAccountById(id)))).filter((account): account is NonNullable<typeof account> => Boolean(account));
    return rerollAmbientNoodleProfiles({ db: app.db, noodle, accounts, connection, debugMode: Boolean((request.body as { debugMode?: boolean }).debugMode) });
  });
  app.put("/refresh-schedule", async (request, reply) => {
    const parsed = noodleRescheduleRefreshSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      return await noodle.rescheduleRefreshSchedule(parsed.data);
    } catch (error) {
      return reply.code(400).send({ error: getErrorMessage(error) });
    }
  });
  app.get("/accounts", async () => noodle.listAccounts());
  app.get("/accounts/:id", async (request, reply) => {
    const account = await noodle.getAccountById((request.params as { id: string }).id);
    return account ?? reply.code(404).send({ error: "Noodle account not found" });
  });
  app.get("/viewer", async (request, reply) => {
    const parsed = accountQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "accountId is required" });
    const account = await noodle.getAccountById(parsed.data.accountId);
    return account ?? reply.code(404).send({ error: "Noodle account not found" });
  });
  app.get("/posts", async (request) =>
    noodle.listPosts(request.query as { limit?: number; since?: string }),
  );
  app.post("/posts", async (request, reply) => {
    const result = await noodle.createPost(request.body as Parameters<typeof noodle.createPost>[0]);
    return result ? reply.code(201).send(result) : reply.code(400).send({ error: "Noodle account not found" });
  });
  app.patch("/posts/:id", async (request, reply) => {
    const result = await noodle.updatePost(
      (request.params as { id: string }).id,
      request.body as Parameters<typeof noodle.updatePost>[1],
    );
    return result ?? reply.code(404).send({ error: "Post not found" });
  });
  app.delete("/posts/:id", async (request, reply) => {
    const result = await noodle.deletePost((request.params as { id: string }).id);
    return result ?? reply.code(404).send({ error: "Post not found" });
  });
  app.post("/posts/:id/interactions", async (request, reply) => {
    const result = await noodle.createInteraction(
      (request.params as { id: string }).id,
      request.body as Parameters<typeof noodle.createInteraction>[1],
    );
    return result ? reply.code(201).send(result) : reply.code(404).send({ error: "Post not found" });
  });
  app.delete("/posts/:id/interactions", async (request, reply) => {
    const result = await noodle.deleteInteraction(
      (request.params as { id: string }).id,
      request.query as Parameters<typeof noodle.deleteInteraction>[1],
    );
    return result ?? reply.code(404).send({ error: "Interaction not found" });
  });
  app.patch("/posts/:postId/interactions/:interactionId", async (request, reply) => {
    const result = await noodle.updateInteraction((request.params as { interactionId: string }).interactionId, request.body as { content?: string | null; imageUrl?: string | null });
    return result ?? reply.code(404).send({ error: "Interaction not found" });
  });
  app.delete("/posts/:postId/interactions/:interactionId", async (request, reply) => {
    const result = await noodle.deleteInteractionById((request.params as { interactionId: string }).interactionId);
    return result.length ? result : reply.code(404).send({ error: "Interaction not found" });
  });
  app.patch("/accounts/:id/follows/:targetAccountId", async (request) =>
    noodle.updateAccountFollow(
      (request.params as { id: string; targetAccountId: string }).id,
      (request.params as { id: string; targetAccountId: string }).targetAccountId,
      request.body as Parameters<typeof noodle.updateAccountFollow>[2],
    ),
  );
  app.put("/accounts/:id/profile", async (request, reply) => {
    const account = await noodle.getAccountById((request.params as { id: string }).id);
    if (!account) return reply.code(404).send({ error: "Noodle account not found" });
    return noodle.updateAccountProfile((request.params as { id: string }).id, request.body as Record<string, unknown>);
  });
  app.patch("/accounts/:id/settings", async (request, reply) => {
    const account = await noodle.getAccountById((request.params as { id: string }).id);
    if (!account) return reply.code(404).send({ error: "Noodle account not found" });
    return noodle.patchAccountSettings((request.params as { id: string }).id, request.body as Record<string, unknown>);
  });
  app.post("/invites", async (request, reply) => {
    const characterId = String((request.body as { characterId?: unknown }).characterId ?? "");
    const character = await characters.getById(characterId);
    if (!character) return reply.code(404).send({ error: "Character not found" });
    return noodle.upsertAccountFromProfile({
      kind: "character",
      entityId: character.id,
      displayName: characterNameFromRow(character),
      avatarUrl: character.avatarPath ?? null,
      avatarCrop: characterAvatarCrop(character),
      bio: String(parseRecord(character.data).description ?? ""),
      invited: true,
    });
  });
  app.post("/invites/bulk", async (request) => {
    const ids = (request.body as { characterIds?: string[] }).characterIds ?? [];
    return Promise.all((await Promise.all(ids.map((id) => characters.getById(id)))).filter(Boolean).map((character) => {
      return noodle.upsertAccountFromProfile({
        kind: "character",
        entityId: character!.id,
        displayName: characterNameFromRow(character!),
        avatarUrl: character!.avatarPath ?? null,
        avatarCrop: characterAvatarCrop(character!),
        bio: String(parseRecord(character!.data).description ?? ""),
        invited: true,
      });
    }));
  });
  app.delete("/invites", async () => {
    await Promise.all((await noodle.listAccounts()).filter((account) => account.kind === "character").map((account) => noodle.updateAccountProfile(account.id, { invited: false })));
    return bootstrapVisibleNoodle(noodle, characters);
  });
  app.delete("/invites/:characterId", async (request, reply) => {
    const account = await noodle.getAccountByEntity("character", (request.params as { characterId: string }).characterId);
    if (!account) return reply.code(404).send({ error: "Noodle character account not found" });
    return noodle.updateAccountProfile(account.id, { invited: false });
  });
  app.delete("/timeline", async () => { await noodle.resetTimeline(); return noodle.bootstrap(); });
  app.post("/refresh/images", async (request, reply) => {
    const parsed = noodleImagePromptConfirmationSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = await publicImages.generateReviewedImages({
      prompts: parsed.data.prompts,
      debugMode: parsed.data.debugMode === true,
    });
    if (!result.ok) return reply.code(400).send({ error: result.message });
    return result.bootstrap;
  });
  app.post("/refresh", async (request, reply) => {
    const parsed = noodleGenerationRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const settings = await noodle.getSettings();
      const connectionId = parsed.data.connectionId ?? String(settings.generationConnectionId ?? "");
      if (!connectionId) return reply.code(400).send({ error: "Select a Noodle generation connection first." });
      const connection = await connections.getWithKey(connectionId);
      if (!connection) return reply.code(404).send({ error: "Noodle generation connection not found" });
      const imageCaptioning = await resolveImageCaptioningRuntime({
        chatMeta: settings.imageCaptioningUseConnectionDefault ? {} : {
          imageCaptioningEnabled: settings.imageCaptioningEnabled,
          imageCaptioningConnectionId: settings.imageCaptioningConnectionId,
        },
        fallbackConnectionId: connectionId,
        connections,
        admissionMode: admissionModeForRequest(request.headers),
      });
      const imageConnection = settings.enableImagePrompts
        ? settings.imageGenerationConnectionId
          ? await connections.getWithKey(settings.imageGenerationConnectionId)
          : await connections.getDefaultForImageGeneration()
        : null;
      if (settings.enableImagePrompts && !imageConnection) {
        return reply.code(400).send({ error: "Select a Noodle image generation connection first." });
      }
      const generated = await publicGeneration.generate({
        connection,
        imageConnection,
        imageCaptioning,
        settings,
        personaId: parsed.data.personaId,
        timeZone: normalizePromptTimeZone(parsed.data.timeZone),
        debugMode: parsed.data.debugMode === true,
        reviewImagePromptsBeforeSend: parsed.data.reviewImagePromptsBeforeSend === true,
        admissionMode: admissionModeForRequest(request.headers),
      });
      if (!generated.ok) return reply.code(400).send({ error: generated.error });
      return generated.result;
    } catch (error) {
      if (isConnectionAdmissionFailure(error)) return reply.code(409).send({ error: getErrorMessage(error) });
      return reply.code(500).send({ error: getErrorMessage(error) });
    }
  });
}
