import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createNoodleStorage } from "../services/storage/noodle.storage.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createPublicNoodleGenerationService } from "../services/noodle/noodle-public-generation.service.js";
import { createPublicNoodleImagesService } from "../services/noodle/noodle-public-images.service.js";
import { resolveImageCaptioningRuntime } from "../services/generation/image-captioning-runtime.js";
import { normalizePromptTimeZone } from "../services/conversation/timezone.js";
import {
  bootstrapVisibleNoodle,
  characterAvatarCrop,
  characterNameFromRow,
  ensurePersonaAccounts,
  getErrorMessage,
  interactionDigestVerb,
  mentionedAccountMetadata,
  mentionedCharacterAccounts,
  noodleDigestAccountLabel,
  parseRecord,
  resolvePersonaAccount,
} from "../services/noodle/noodle-public-support.js";
import { isDirectlyInvitedNoodleCharacter } from "../services/noodle/noodle-invited-post-draft-access.js";
import {
  canManageNoodleReply,
  createNoodlePoll,
  noodleCreateInteractionSchema,
  noodleCreatePostSchema,
  noodleInteractionOwnerSchema,
  noodleInteractionUpdateSchema,
  noodlePostUpdateSchema,
  noodleRemoveInteractionSchema,
  readNoodlePollFromMetadata,
} from "@marinara-engine/shared";
import { isConnectionAdmissionFailure, admissionModeForRequest } from "../services/generation/connection-admission.js";

const accountQuery = z.object({ accountId: z.string().trim().min(1) });
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

  app.get("/", async () => bootstrapVisibleNoodle(noodle, characters));
  app.get("/refresh-indicator", async () => {
    const [latest] = await noodle.listRefreshRuns({ status: "completed", limit: 1 });
    return { marker: latest ? `${latest.id}:${latest.updatedAt}` : null };
  });
  app.put("/settings", async (request) => noodle.updateSettings(request.body as Record<string, unknown>));
  app.post("/data/cleanup-unused", async () => {
    const [charactersList, personas] = await Promise.all([characters.list(), characters.listPersonas()]);
    return noodle.cleanupUnusedData({
      characterIds: new Set(charactersList.map((character) => character.id)),
      personaIds: new Set(personas.map((persona) => persona.id)),
    });
  });
  app.delete("/data", async (request, reply) => {
    const parsed = z.object({ confirmation: z.literal("DELETE") }).safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "Type DELETE to confirm removal of all Noodle data." });
    return noodle.deleteAllData();
  });
  app.post("/ambient-profiles/reroll", async (request, reply) => {
    const { rerollAmbientNoodleProfiles } =
      await import("../services/noodle/noodle-ambient-profile-generation.service.js");
    const { createConnectionsStorage } = await import("../services/storage/connections.storage.js");
    const settings = await noodle.getSettings();
    const connectionId = String((settings as { generationConnectionId?: unknown }).generationConnectionId ?? "");
    const connection = connectionId ? await createConnectionsStorage(app.db).getWithKey(connectionId) : null;
    if (!connection) return reply.code(400).send({ error: "Select a Noodle generation connection first." });
    const accountIds = (request.body as { accountIds?: string[] }).accountIds ?? [];
    const accounts = (await Promise.all(accountIds.map((id) => noodle.getAccountById(id)))).filter(
      (account): account is NonNullable<typeof account> => Boolean(account),
    );
    return rerollAmbientNoodleProfiles({
      db: app.db,
      noodle,
      accounts,
      connection,
      debugMode: Boolean((request.body as { debugMode?: boolean }).debugMode),
    });
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
  app.get("/posts", async (request) => noodle.listPosts(request.query as { limit?: number; since?: string }));
  app.post("/posts", async (req, reply) => {
    if (req.body && typeof req.body === "object" && "title" in req.body) {
      return reply.code(400).send({ error: "Public Noodle posts do not support titles." });
    }
    const parsed = noodleCreatePostSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    let account = await noodle.getAccountByEntity(parsed.data.authorKind, parsed.data.authorEntityId);
    if (!account && parsed.data.authorKind === "persona") {
      account = await resolvePersonaAccount(noodle, characters, parsed.data.authorEntityId);
    }
    if (!account) return reply.code(404).send({ error: "Noodle account not found" });
    if (parsed.data.authorKind === "character" && !isDirectlyInvitedNoodleCharacter(account))
      return reply.code(403).send({ error: "Only directly invited characters can post publicly." });
    const mentionedAccounts = mentionedCharacterAccounts(await noodle.listAccounts(), parsed.data.content);
    const poll = parsed.data.poll ? createNoodlePoll(parsed.data.poll) : null;
    const post = await noodle.createPost({
      authorAccountId: account.id,
      content: parsed.data.content,
      imageUrl: parsed.data.imageUrl ?? null,
      imagePrompt: parsed.data.imagePrompt ?? null,
      parentPostId: parsed.data.parentPostId ?? null,
      quotePostId: parsed.data.quotePostId ?? null,
      source: "manual",
      metadata: {
        ...mentionedAccountMetadata(mentionedAccounts),
        ...(poll ? { poll } : {}),
        ...(parsed.data.imageCrop ? { imageCrop: parsed.data.imageCrop } : {}),
      },
    });
    if (!post) return reply.code(404).send({ error: "Noodle author not found" });
    const digest = await noodle.createDigest({
      accountIds: [account.id, ...mentionedAccounts.map((mentioned) => mentioned.id)],
      content: `${noodleDigestAccountLabel(account)} posted on Noodle: ${post.content}`,
      sourcePostId: post.id,
    });
    return (await noodle.updatePostMedia(post.id, { metadata: { activityDigestId: digest.id } })) ?? post;
  });
  app.patch("/posts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (req.body && typeof req.body === "object" && "title" in req.body) {
      return reply.code(400).send({ error: "Public Noodle posts do not support titles." });
    }
    const parsed = noodlePostUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const existing = await noodle.getPostById(id);
    if (!existing) return reply.code(404).send({ error: "Noodle post not found" });
    const nextContent = parsed.data.content === undefined ? existing.content : parsed.data.content;
    const nextPoll =
      parsed.data.poll === undefined
        ? readNoodlePollFromMetadata(existing.metadata)
        : parsed.data.poll
          ? createNoodlePoll(parsed.data.poll)
          : null;
    if (!nextContent.trim() && !nextPoll) {
      return reply.code(400).send({ error: "Posts need a body or poll." });
    }
    let post = await noodle.updatePost(id, parsed.data);
    if (!post) return reply.code(404).send({ error: "Noodle post not found" });
    if (parsed.data.content !== undefined || parsed.data.poll !== undefined) {
      const mentionedAccounts = mentionedCharacterAccounts(await noodle.listAccounts(), post.content);
      post = (await noodle.updatePostMedia(post.id, { metadata: mentionedAccountMetadata(mentionedAccounts) })) ?? post;
      const digestId = post.metadata.activityDigestId;
      const author = await noodle.getAccountById(post.authorAccountId);
      const poll = readNoodlePollFromMetadata(post.metadata);
      const digestContent = post.content.trim() || poll?.question || "Shared a poll.";
      if (typeof digestId === "string" && digestId && author) {
        await noodle.updateDigest(digestId, {
          accountIds: [author.id, ...mentionedAccounts.map((mentioned) => mentioned.id)],
          content: `${noodleDigestAccountLabel(author)} posted on Noodle: ${digestContent}`,
        });
      }
    }
    return post;
  });
  app.delete("/posts/:id", async (req, reply) => {
    const deleted = await noodle.deletePost((req.params as { id: string }).id);
    if (!deleted) return reply.code(404).send({ error: "Noodle post not found" });
    return deleted;
  });
  app.post("/posts/:id/interactions", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = noodleCreateInteractionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    let actor = await noodle.getAccountByEntity(parsed.data.actorKind, parsed.data.actorEntityId);
    if (!actor && parsed.data.actorKind === "persona") {
      actor = await resolvePersonaAccount(noodle, characters, parsed.data.actorEntityId);
    }
    if (!actor) return reply.code(404).send({ error: "Noodle actor not found" });
    const post = await noodle.getPostById(id);
    if (!post) return reply.code(404).send({ error: "Noodle post not found" });
    if (parsed.data.type === "vote") {
      const poll = readNoodlePollFromMetadata(post.metadata);
      if (!poll || !poll.options.some((option) => option.id === parsed.data.content?.trim())) {
        return reply.code(400).send({ error: "Choose a valid option from this poll." });
      }
    }
    const interaction = await noodle.createInteraction(id, {
      actorAccountId: actor.id,
      type: parsed.data.type,
      content: parsed.data.type === "vote" ? (parsed.data.content?.trim() ?? null) : (parsed.data.content ?? null),
      imageUrl: parsed.data.imageUrl ?? null,
      parentInteractionId: parsed.data.parentInteractionId ?? null,
    });
    if (!interaction) return reply.code(400).send({ error: "Could not add that Noodle interaction." });
    if (parsed.data.type !== "like") {
      const directReplyTarget = parsed.data.parentInteractionId
        ? await noodle.getInteractionById(parsed.data.parentInteractionId)
        : null;
      const poll = readNoodlePollFromMetadata(post.metadata);
      const selectedPollOption =
        parsed.data.type === "vote"
          ? poll?.options.find((option) => option.id === interaction.content)?.label
          : undefined;
      const interactionSummary =
        parsed.data.type === "vote" && poll && selectedPollOption
          ? `${poll.question}: ${selectedPollOption}`
          : interaction.content || (interaction.imageUrl ? "shared an image" : post.content);
      await noodle.createDigest({
        accountIds: Array.from(
          new Set([actor.id, post.authorAccountId, directReplyTarget?.actorAccountId].filter(Boolean) as string[]),
        ),
        content: `${noodleDigestAccountLabel(actor)} ${interactionDigestVerb(parsed.data.type)} a Noodle post: ${interactionSummary}`,
        sourcePostId: post.id,
        sourceInteractionId: interaction.id,
      });
    }
    return interaction;
  });
  app.delete("/posts/:id/interactions", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = noodleRemoveInteractionSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    let actor = await noodle.getAccountByEntity(parsed.data.actorKind, parsed.data.actorEntityId);
    if (!actor && parsed.data.actorKind === "persona") {
      actor = await resolvePersonaAccount(noodle, characters, parsed.data.actorEntityId);
    }
    if (!actor) return reply.code(404).send({ error: "Noodle actor not found" });
    const interaction = await noodle.deleteInteraction(id, {
      actorAccountId: actor.id,
      type: parsed.data.type,
      parentInteractionId: parsed.data.parentInteractionId ?? null,
    });
    if (!interaction) return reply.code(404).send({ error: "Noodle interaction not found" });
    return interaction;
  });
  app.patch("/posts/:postId/interactions/:interactionId", async (req, reply) => {
    const { postId, interactionId } = req.params as { postId: string; interactionId: string };
    const parsed = noodleInteractionUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const interaction = await noodle.getInteractionById(interactionId);
    if (!interaction || interaction.postId !== postId) {
      return reply.code(404).send({ error: "Noodle comment not found" });
    }
    await ensurePersonaAccounts(noodle, characters);
    const persona = await noodle.getAccountByEntity("persona", parsed.data.personaId);
    if (!persona) return reply.code(404).send({ error: "Noodle persona not found" });
    const interactionActor = await noodle.getAccountById(interaction.actorAccountId);
    const actorKind = interactionActor?.kind ?? interaction.actorSnapshot?.kind;
    if (
      interaction.type !== "reply" ||
      !canManageNoodleReply({ actorKind, actorAccountId: interaction.actorAccountId, personaAccountId: persona.id })
    ) {
      return reply.code(403).send({ error: "You can only edit comments from this persona or a character." });
    }
    const content = parsed.data.content === undefined ? interaction.content : parsed.data.content?.trim() || null;
    const imageUrl = parsed.data.imageUrl === undefined ? interaction.imageUrl : parsed.data.imageUrl?.trim() || null;
    if (!content && !imageUrl) return reply.code(400).send({ error: "Comments need text or an image." });
    const updated = await noodle.updateInteraction(interactionId, { content, imageUrl });
    if (!updated) return reply.code(404).send({ error: "Noodle comment not found" });
    const [post, accounts] = await Promise.all([noodle.getPostById(postId), noodle.listAccounts()]);
    if (post && interactionActor) {
      const directReplyTarget = updated.parentInteractionId
        ? await noodle.getInteractionById(updated.parentInteractionId)
        : null;
      const mentionedAccounts = mentionedCharacterAccounts(accounts, updated.content ?? "");
      await noodle.createDigest({
        accountIds: Array.from(
          new Set(
            [
              interactionActor.id,
              post.authorAccountId,
              directReplyTarget?.actorAccountId,
              ...mentionedAccounts.map((account) => account.id),
            ].filter(Boolean) as string[],
          ),
        ),
        content: `${noodleDigestAccountLabel(interactionActor)} replied to a Noodle post: ${
          updated.content || (updated.imageUrl ? "shared an image" : post.content)
        }`,
        sourcePostId: post.id,
        sourceInteractionId: updated.id,
      });
    }
    return updated;
  });
  app.delete("/posts/:postId/interactions/:interactionId", async (req, reply) => {
    const { postId, interactionId } = req.params as { postId: string; interactionId: string };
    const parsed = noodleInteractionOwnerSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const interaction = await noodle.getInteractionById(interactionId);
    if (!interaction || interaction.postId !== postId) {
      return reply.code(404).send({ error: "Noodle comment not found" });
    }
    await ensurePersonaAccounts(noodle, characters);
    const persona = await noodle.getAccountByEntity("persona", parsed.data.personaId);
    if (!persona) return reply.code(404).send({ error: "Noodle persona not found" });
    const interactionActor = await noodle.getAccountById(interaction.actorAccountId);
    const actorKind = interactionActor?.kind ?? interaction.actorSnapshot?.kind;
    if (
      interaction.type !== "reply" ||
      !canManageNoodleReply({ actorKind, actorAccountId: interaction.actorAccountId, personaAccountId: persona.id })
    ) {
      return reply.code(403).send({ error: "You can only delete comments from this persona or a character." });
    }
    const deleted = await noodle.deleteInteractionById(interactionId);
    if (deleted.length === 0) return reply.code(404).send({ error: "Noodle comment not found" });
    return deleted;
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
    return Promise.all(
      (await Promise.all(ids.map((id) => characters.getById(id)))).filter(Boolean).map((character) => {
        return noodle.upsertAccountFromProfile({
          kind: "character",
          entityId: character!.id,
          displayName: characterNameFromRow(character!),
          avatarUrl: character!.avatarPath ?? null,
          avatarCrop: characterAvatarCrop(character!),
          bio: String(parseRecord(character!.data).description ?? ""),
          invited: true,
        });
      }),
    );
  });
  app.delete("/invites", async () => {
    await Promise.all(
      (await noodle.listAccounts())
        .filter((account) => account.kind === "character")
        .map((account) => noodle.updateAccountProfile(account.id, { invited: false })),
    );
    return bootstrapVisibleNoodle(noodle, characters);
  });
  app.delete("/invites/:characterId", async (request, reply) => {
    const account = await noodle.getAccountByEntity(
      "character",
      (request.params as { characterId: string }).characterId,
    );
    if (!account) return reply.code(404).send({ error: "Noodle character account not found" });
    return noodle.updateAccountProfile(account.id, { invited: false });
  });
  app.delete("/timeline", async () => {
    await noodle.resetTimeline();
    return bootstrapVisibleNoodle(noodle, characters);
  });
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
        chatMeta: settings.imageCaptioningUseConnectionDefault
          ? {}
          : {
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
