import type { FastifyRequest, FastifyInstance } from "fastify";
import {
  isAllowedImageBuffer,
  resolveNoodlerMediaAbsolutePath,
  slurpMessageMediaUrl,
  stageSlurpMessageMedia,
} from "../../base/media/slp-media.js";
import { z } from "zod";
import { existsSync } from "node:fs";
import { basename, dirname } from "node:path";
import { resolveSlurpMediaOffer } from "../../modules/economy/slp-media-offer.js";
import { generateSlurpCommissionImage } from "./commissions/slp-commission-image-operation.js";
import { replyToSlurpMessage } from "./slp-message-operation.js";
import { trySlurpWrite } from "../../base/locking/slp-operation-lock.js";
import { personaQuerySchema } from "../../modules/messages/slp-messages-schemas.js";
import type { SlpMessagesContext } from "./slp-messages-context.js";

const MESSAGE_MEDIA_MAX_BYTES = 20 * 1024 * 1024;

class SlurpMessageMediaRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

async function readSlurpMessageMultipart(req: FastifyRequest) {
  const payload: Record<string, string> = {};
  let media: { buffer: Buffer; extension: string } | null = null;
  for await (const part of req.parts({ limits: { fileSize: MESSAGE_MEDIA_MAX_BYTES, files: 1 } })) {
    if (part.type === "field") {
      payload[part.fieldname] = String(part.value);
      continue;
    }
    if (part.fieldname !== "file" || media) {
      part.file.resume();
      throw new SlurpMessageMediaRequestError("Upload one image in the file field.", 400);
    }
    const write = await trySlurpWrite(async () => {
      try {
        return await part.toBuffer();
      } catch (error) {
        const truncated = (part.file as typeof part.file & { truncated?: boolean }).truncated === true;
        const tooLarge = truncated || (error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE";
        throw new SlurpMessageMediaRequestError(
          tooLarge ? "Slurp image is too large." : "Failed to read the uploaded image.",
          tooLarge ? 413 : 400,
        );
      }
    });
    if (!write.acquired) {
      part.file.resume();
      throw new SlurpMessageMediaRequestError("Slurp data cleanup is in progress.", 409);
    }
    const detected = isAllowedImageBuffer(write.value, ".avif");
    if (!detected) {
      throw new SlurpMessageMediaRequestError(
        "That file is not a PNG, JPEG, WebP, GIF or AVIF image. Its contents are read to decide, so renaming it does not help.",
        400,
      );
    }
    media = { buffer: write.value, extension: detected.ext };
  }
  if (!media) throw new SlurpMessageMediaRequestError("Upload one image in the file field.", 400);
  return { payload, media };
}

async function readSlurpMessageImage(
  req: FastifyRequest,
): Promise<{ payload: Record<string, string>; media: { buffer: Buffer; extension: string } }> {
  return readSlurpMessageMultipart(req);
}

const requestDecisionSchema = z.object({
  personaId: z.string().trim().min(1),
  decision: z.enum(["accept", "decline"]),
});
export async function slpMessagesMediaRoutes(app: FastifyInstance, messaging: SlpMessagesContext) {
  const { freshView, messages, ownsCreator, requireViewer, slurp } = messaging;
  /**
   * The bytes of a generated message image.
   *
   * Gated like the post media route: only the two sides of the thread may read it, and a locked
   * PPV message stays locked here too. Serving it from the message id alone would hand the thing
   * being sold to anybody who guessed one.
   */
  app.get("/messages/:messageId/media", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { messageId } = req.params as { messageId: string };
    const message = await messages.getMessageById(messageId);
    if (!message) return reply.code(404).send({ error: "Not Found" });
    const thread = await messages.getThreadById(message.threadId);
    if (!thread) return reply.code(404).send({ error: "Not Found" });
    const isViewer = thread.viewerAccountId === parsed.data.personaId;
    const isCreator = await ownsCreator(parsed.data.personaId, thread.creatorAccountId);
    if (!isViewer && !isCreator) return reply.code(404).send({ error: "Not Found" });
    if (isViewer && !isCreator && message.kind === "ppv" && !message.unlockedAt) {
      return reply.code(402).send({ error: "This message is locked." });
    }
    const mediaPath = message.metadata?.noodlerMediaPath;
    const absolute = typeof mediaPath === "string" ? resolveNoodlerMediaAbsolutePath(mediaPath) : null;
    if (!absolute || !existsSync(absolute)) return reply.code(404).send({ error: "Not Found" });
    return reply.header("Cache-Control", "private, max-age=300").sendFile(basename(absolute), dirname(absolute));
  });

  app.post("/messages/threads/:threadId/image", async (req, reply) => {
    const parsed = z
      .object({
        personaId: z.string().min(1),
        creatorAccountId: z.string().min(1),
        prompt: z.string().trim().min(3).max(1000),
        content: z.string().max(1000).default(""),
        intent: z.enum(["friendly", "hostile", "premium", "preview"]).default("friendly"),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId } = req.params as { threadId: string };
    const thread = await messages.getThreadById(threadId);
    if (
      !thread ||
      thread.creatorAccountId !== parsed.data.creatorAccountId ||
      !(await ownsCreator(parsed.data.personaId, thread.creatorAccountId))
    )
      return reply.code(404).send({ error: "Thread not found" });
    if (thread.coolUntil && thread.coolUntil > new Date().toISOString()) {
      return reply.code(409).send({ error: "This conversation is cooling off." });
    }
    const subscribed = (await slurp.listSubscriptionsForViewer(thread.viewerAccountId)).some(
      (entry) => entry.creatorAccountId === thread.creatorAccountId,
    );
    const messaging = await messages.getCreatorMessaging(thread.creatorAccountId);
    const offer = resolveSlurpMediaOffer({
      intent: parsed.data.intent,
      rapportTier: thread.rapport.tier,
      subscribed,
      configuredPrice: messaging.ppvPrice,
    });
    const drawn = await generateSlurpCommissionImage(app.db, {
      creatorAccountId: thread.creatorAccountId,
      brief: parsed.data.prompt,
    });
    if (drawn === "unavailable") return reply.code(503).send({ error: "Image generation is not available." });
    try {
      const message = await messages.sendCreatorMessage(thread.creatorAccountId, thread.viewerAccountId, {
        content: parsed.data.content,
        kind: offer.visibility === "locked" ? "ppv" : "text",
        price: offer.price,
        unlockedAt: offer.visibility === "free" ? new Date().toISOString() : null,
        imageUrl: slurpMessageMediaUrl("pending"),
        metadata: {
          noodlerMediaPath: drawn.mediaPath,
          generatedContext: parsed.data.intent,
          imagePrompt: parsed.data.prompt,
          mediaReason: offer.reason,
        },
      });
      if (!message) return reply.code(404).send({ error: "Thread not found" });
      drawn.promote();
      await messages.setMessageMedia(message.id, slurpMessageMediaUrl(message.id), drawn.mediaPath);
      return { message: { ...message, imageUrl: slurpMessageMediaUrl(message.id) } };
    } catch (error) {
      drawn.compensate();
      throw error;
    }
  });

  app.post("/messages/threads/:threadId/image-upload", async (req, reply) => {
    let decoded: Awaited<ReturnType<typeof readSlurpMessageImage>>;
    try {
      decoded = await readSlurpMessageImage(req);
    } catch (error) {
      const statusCode = error instanceof SlurpMessageMediaRequestError ? error.statusCode : 400;
      return reply.code(statusCode).send({ error: error instanceof Error ? error.message : "Invalid image upload." });
    }
    const parsed = z
      .object({
        personaId: z.string().min(1),
        creatorAccountId: z.string().min(1),
        content: z.string().max(1000).default(""),
      })
      .safeParse(decoded.payload);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId } = req.params as { threadId: string };
    const thread = await messages.getThreadById(threadId);
    const viewer = await requireViewer(parsed.data.personaId);
    if (
      !thread ||
      !viewer ||
      thread.viewerAccountId !== viewer.id ||
      thread.creatorAccountId !== parsed.data.creatorAccountId
    )
      return reply.code(404).send({ error: "Thread not found" });
    const staged = stageSlurpMessageMedia(decoded.media);
    try {
      const sent = await messages.appendMessage(thread.id, {
        senderAccountId: viewer.id,
        role: "viewer",
        content: parsed.data.content,
        imageUrl: slurpMessageMediaUrl("pending"),
        metadata: { noodlerMediaPath: staged.filePath, uploaded: true },
      });
      if (!sent) return reply.code(404).send({ error: "Thread not found" });
      staged.promote();
      await messages.setMessageMedia(sent.id, slurpMessageMediaUrl(sent.id), staged.filePath);
      const outcome = await replyToSlurpMessage(app.db, { threadId, triggerMessageId: sent.id });
      return { message: { ...sent, imageUrl: slurpMessageMediaUrl(sent.id) }, replyStatus: outcome.status };
    } catch (error) {
      staged.compensate();
      throw error;
    }
  });

  app.post("/messages/threads/:threadId/viewer-image", async (req, reply) => {
    const parsed = z
      .object({
        personaId: z.string().min(1),
        creatorAccountId: z.string().min(1),
        prompt: z.string().trim().min(3).max(1000),
        content: z.string().max(1000).default(""),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId } = req.params as { threadId: string };
    const thread = await messages.getThreadById(threadId);
    const viewer = await requireViewer(parsed.data.personaId);
    if (
      !thread ||
      !viewer ||
      thread.viewerAccountId !== viewer.id ||
      thread.creatorAccountId !== parsed.data.creatorAccountId
    )
      return reply.code(404).send({ error: "Thread not found" });
    if (thread.coolUntil && thread.coolUntil > new Date().toISOString())
      return reply.code(409).send({ error: "This conversation is cooling off." });
    const recentImage = (await messages.listMessages(thread.id)).some(
      (message) =>
        message.role === "viewer" &&
        message.metadata.generatedContext === "viewer" &&
        Date.now() - Date.parse(message.createdAt) < 3 * 60 * 60_000,
    );
    if (recentImage) return reply.code(429).send({ error: "You can generate another picture later." });
    const drawn = await generateSlurpCommissionImage(app.db, {
      creatorAccountId: thread.creatorAccountId,
      brief: parsed.data.prompt,
    });
    if (drawn === "unavailable") return reply.code(503).send({ error: "Image generation is not available." });
    try {
      const message = await messages.appendMessage(thread.id, {
        senderAccountId: viewer.id,
        role: "viewer",
        content: parsed.data.content,
        imageUrl: slurpMessageMediaUrl("pending"),
        unlockedAt: new Date().toISOString(),
        metadata: { noodlerMediaPath: drawn.mediaPath, generatedContext: "viewer", imagePrompt: parsed.data.prompt },
      });
      if (!message) return reply.code(404).send({ error: "Thread not found" });
      drawn.promote();
      await messages.setMessageMedia(message.id, slurpMessageMediaUrl(message.id), drawn.mediaPath);
      const outcome = await replyToSlurpMessage(app.db, { threadId, triggerMessageId: message.id });
      return { message: { ...message, imageUrl: slurpMessageMediaUrl(message.id) }, replyStatus: outcome.status };
    } catch (error) {
      drawn.compensate();
      throw error;
    }
  });

  app.post("/messages/threads/:threadId/request", async (req, reply) => {
    const parsed = requestDecisionSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId } = req.params as { threadId: string };
    const thread = await messages.getThreadById(threadId);
    if (!thread) return reply.code(404).send({ error: "Thread not found" });
    if (!(await ownsCreator(parsed.data.personaId, thread.creatorAccountId)))
      return reply.code(403).send({ error: "Only the Creator's owner can answer a message request." });
    // `resolveRequest` no-ops on a thread that is not awaiting a decision. Reporting 200 and then
    // generating a reply made a double-tap, or answering a request the creator had already
    // declined, look like it had just been accepted.
    if (thread.state !== "request") {
      return reply.code(409).send({ error: "This message request has already been answered." });
    }
    await messages.resolveRequest(threadId, parsed.data.decision);
    let outcome: Awaited<ReturnType<typeof replyToSlurpMessage>> = { status: "ineligible" };
    if (parsed.data.decision === "accept") {
      const latest = (await messages.listMessages(threadId, 1))[0];
      if (latest?.role === "viewer") {
        outcome = await replyToSlurpMessage(app.db, { threadId, triggerMessageId: latest.id });
      }
    }
    return {
      thread: await freshView(threadId, "creator"),
      reply: outcome.status === "replied" ? outcome.message : null,
      replyStatus: outcome.status,
    };
  });
}
