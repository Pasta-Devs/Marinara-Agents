// ──────────────────────────────────────────────
// Routes: Slurp direct messages
// ──────────────────────────────────────────────
//
// Registered from `slurp.routes.ts`, but kept in its own file: that one is already past two
// thousand five hundred lines, and nothing here needs the feed helpers it holds.
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { extname } from "node:path";
import { createSlurpStorage } from "../services/storage/slurp.storage.js";
import { createSlurpMessagesStorage } from "../services/storage/slurp-messages.storage.js";
import { createSlurpPopulationStorage } from "../services/storage/slurp-population.storage.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { replyToSlurpMessage } from "../services/slurp/slurp-message.operation.js";
import { SLURP_DM_POLICIES } from "../services/slurp/slurp-messaging.js";
import {
  SLURP_NOTE_MAX_LENGTH,
  SLURP_WORKING_NOTE_LIMIT,
  SLURP_LONGTERM_NOTE_LIMIT,
} from "../services/slurp/slurp-thread-notes.js";
import { SLURP_DEFAULT_RAPPORT_WEIGHTS } from "../services/slurp/slurp-rapport.js";
import { activeSlurpStrikes } from "../services/slurp/slurp-stance.js";
import { readSlurpAudienceTone } from "../services/slurp/slurp-tone.js";
import { resolveSlurpMediaOffer } from "../services/slurp/slurp-media-offer.js";
import { existsSync } from "node:fs";
import { basename, dirname } from "node:path";
import { generateSlurpCommissionImage } from "../services/slurp/slurp-commission-image.operation.js";
import { deliverAutomaticSlurpCommission } from "../services/slurp/slurp-commission-delivery.service.js";
import { buildSlurpMessagePrompt } from "../services/slurp/slurp-message-generation.service.js";
import { describeSlurpDayVibe } from "../services/slurp/slurp-day-vibe.service.js";
import { resolveSlurpTextConnection } from "../services/slurp/slurp-connection.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { isDebugAgentsEnabled } from "../config/runtime-config.js";
import { slurpCommissionDeliveryDelayMs } from "../services/slurp/slurp-messaging.js";
import {
  isAllowedImageBuffer,
  resolveNoodlerMediaAbsolutePath,
  slurpMessageMediaUrl,
  stageSlurpMessageMedia,
} from "../services/slurp/slurp-media.js";
import { logger } from "../lib/logger.js";
import { resolveSlurpCreatorAvailability } from "../services/slurp/slurp-creator-schedule-context.js";
import { selectSlurpAttentionCommissions } from "../services/slurp/slurp-inbox-attention.js";

const personaQuerySchema = z.object({ personaId: z.string().trim().min(1) });
const MESSAGE_MEDIA_MAX_BYTES = 20 * 1024 * 1024;
const MESSAGE_MEDIA_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);

async function readSlurpMessageImage(
  req: FastifyRequest,
): Promise<{ payload: Record<string, string>; media: { buffer: Buffer; extension: string } }> {
  const payload: Record<string, string> = {};
  let media: { buffer: Buffer; extension: string } | null = null;
  for await (const part of req.parts({ limits: { fileSize: MESSAGE_MEDIA_MAX_BYTES, files: 1 } })) {
    if (part.type === "field") {
      payload[part.fieldname] = String(part.value);
      continue;
    }
    if (part.fieldname !== "file" || media) {
      part.file.resume();
      throw new Error("Upload one image in the file field.");
    }
    const extension = extname(part.filename).toLowerCase();
    if (!MESSAGE_MEDIA_EXTENSIONS.has(extension)) {
      part.file.resume();
      throw new Error("Unsupported image file type.");
    }
    const buffer = await part.toBuffer();
    const detected = isAllowedImageBuffer(buffer, extension);
    if (!detected) throw new Error("Unsupported or invalid image file.");
    media = { buffer, extension: detected.ext };
  }
  if (!media) throw new Error("Upload one image in the file field.");
  return { payload, media };
}

const sendSchema = z.object({
  personaId: z.string().trim().min(1),
  creatorAccountId: z.string().trim().min(1),
  // Bounded at the trust boundary: this text reaches a model prompt, and an unbounded body
  // would let one message push the whole conversation out of the context window.
  content: z.string().trim().min(1).max(2000),
  requestId: z.string().trim().min(8).max(100).optional(),
  tip: z
    .object({ amount: z.number().int().min(1).max(9999), note: z.string().trim().max(280).default("") })
    .nullable()
    .optional(),
});

const tipSchema = z.object({
  personaId: z.string().trim().min(1),
  creatorAccountId: z.string().trim().min(1),
  amount: z.number().int().min(1).max(9999),
  note: z.string().trim().max(280).default(""),
});

/**
 * An image a paid message carries.
 *
 * A same-origin Marinara path only. The message stores the reference rather than downloading the
 * bytes, so accepting a remote URL here would let a Creator point the app at anything and would
 * leak the viewer's IP to it on render.
 */
const creatorMessageSchema = z.object({
  personaId: z.string().trim().min(1),
  viewerAccountId: z.string().trim().min(1),
  content: z.string().trim().min(1).max(4000),
  price: z.number().int().min(0).max(9999).default(0),
  // Attachments are created by the server after the message exists. Client-supplied paths could
  // point at unrelated protected API resources.
  imageUrl: z.null().optional(),
});

const broadcastSchema = creatorMessageSchema.omit({ viewerAccountId: true });
const commissionBriefSchema = z.object({
  personaId: z.string().trim().min(1),
  creatorAccountId: z.string().trim().min(1),
  brief: z.string().trim().min(10).max(2000),
});
const commissionQuoteSchema = z.object({
  personaId: z.string().trim().min(1),
  price: z.number().int().min(1).max(99999),
});
const commissionDeliverySchema = z.object({
  personaId: z.string().trim().min(1),
  content: z.string().trim().min(1).max(5000),
  imageUrl: z.null().optional(),
  /** Draw the commissioned piece from the brief instead of attaching one. */
  generateImage: z.boolean().optional(),
});

// Image generation happens before the storage write, so the storage-level delivery queue cannot
// stop two rapid requests from drawing the same commission at once. Hold the whole route per
// commission and make the second request retry after the first one finishes.
const commissionDeliveryRequests = new Set<string>();
const commissionAcceptRequests = new Set<string>();

const requestDecisionSchema = z.object({
  personaId: z.string().trim().min(1),
  decision: z.enum(["accept", "decline"]),
});

const rapportWeightsSchema = z
  .object(
    Object.fromEntries(
      Object.keys(SLURP_DEFAULT_RAPPORT_WEIGHTS).map((key) => [key, z.number().min(0).max(100)]),
    ) as Record<keyof typeof SLURP_DEFAULT_RAPPORT_WEIGHTS, z.ZodNumber>,
  )
  .partial();

const messagingPatchSchema = z.object({
  personaId: z.string().trim().min(1),
  dmPolicy: z.enum(SLURP_DM_POLICIES as unknown as [string, ...string[]]).optional(),
  requestFee: z.number().int().min(0).max(9999).optional(),
  ppvPrice: z.number().int().min(0).max(9999).optional(),
  rapportWeights: rapportWeightsSchema.optional(),
});

export async function slurpMessageRoutes(app: FastifyInstance) {
  const slurp = createSlurpStorage(app.db);
  const messages = createSlurpMessagesStorage(app.db);
  const population = createSlurpPopulationStorage(app.db);

  const creatorPresence = async (
    creator: NonNullable<Awaited<ReturnType<typeof slurp.getNoodlerAccountById>>>,
    threadId?: string,
  ) => {
    const threadMessages = threadId ? await messages.listMessages(threadId) : [];
    const latestMessage = threadMessages
      .filter((message) => message.role === "creator")
      .reduce<string | null>(
        (latest, message) => (!latest || message.createdAt > latest ? message.createdAt : latest),
        null,
      );
    const latestPost = (await slurp.listNoodlerPostsByAccount(creator.id, 1))[0] ?? null;
    const source = await slurp.resolveAccountSource(creator);
    const availability = source
      ? await resolveSlurpCreatorAvailability(
          createCharactersStorage(app.db),
          source,
          undefined,
          new Date(),
          latestPost?.createdAt ?? null,
        )
      : { online: true, activity: null, minutesUntilOnline: 0 };
    return {
      creatorLastActiveAt: latestPost?.createdAt ?? null,
      creatorLastMessageAt: latestMessage,
      creatorAutoPosting: Boolean(creator.settings.scheduler.autoPosting?.enabled),
      creatorAvailability: availability,
    };
  };

  /** Every route needs the same "is this a real persona" gate, so it lives in one helper. */
  const requireViewer = async (personaId: string) => slurp.getViewer(personaId);

  /**
   * The messages of a thread as this side is allowed to see them.
   *
   * A pay-per-view message the fan has not unlocked must not travel over the wire at all;
   * hiding it in the client would still hand the text to anyone reading the response. The
   * Creator side always sees what they wrote.
   */
  const visibleMessages = async (threadId: string, side: "viewer" | "creator") =>
    (await messages.listMessages(threadId)).map((message) =>
      side === "viewer" && message.kind === "ppv" && !message.unlockedAt
        ? { ...message, content: "", imageUrl: null }
        : side === "viewer" && message.kind === "post_preview" && message.metadata.previewLocked === true
          ? {
              ...message,
              content: "",
              imageUrl: null,
              metadata: { ...message.metadata, content: "", imageUrl: null },
            }
          : message,
    );

  /**
   * Re-read a thread and enrich it, so every response carries the same joined shape.
   *
   * `side` defaults to the fan, which is the safe default: their copy has the rapport score, the
   * mood, the notes and the strike count stripped. Every thread response goes through here, so a
   * new endpoint cannot leak the simulation's internals by forgetting to.
   */
  const freshView = async (threadId: string, side: "viewer" | "creator" = "viewer") => {
    const thread = await messages.getThreadById(threadId);
    if (!thread) return null;
    const view = await messages.viewThread(thread);
    return side === "creator" ? view : { ...view, ...messages.forViewer(thread) };
  };

  /**
   * A creator the viewer owns. The creator-side routes are gated on this: a player must not be
   * able to accept requests or read the rapport panel for somebody else's creator.
   */
  const ownsCreator = async (personaId: string, creatorAccountId: string) => {
    const creator = await slurp.getNoodlerAccountById(creatorAccountId);
    return Boolean(creator && creator.sourceKind === "persona" && creator.sourceEntityId === personaId);
  };

  app.get("/messages/threads", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const threads = await messages.listThreadsForViewer(viewer.id);
    // Threads written *to* the Creators this persona operates. Without these the inbox showed only
    // conversations the player started, and anything a fan or the world opened was unreachable.
    const operated = (await slurp.listNoodlerAccounts())
      .filter((account) => account.sourceKind === "persona" && account.sourceEntityId === viewer.id)
      .map((account) => account.id);
    const inbound = await messages.listThreadsForCreators(operated);
    const inboundViews = await Promise.all(
      inbound.map(async (thread) => ({
        ...thread,
        side: "creator" as const,
        // The counterpart is the fan here, not the Creator, so name them or the row is a blank.
        counterpartName:
          (await population.get(thread.viewerAccountId))?.displayName ??
          (await slurp.getNoodlerAccountById(thread.viewerAccountId))?.displayName ??
          (await slurp.getViewer(thread.viewerAccountId).catch(() => null))?.displayName ??
          null,
        counterpartHandle:
          (await population.get(thread.viewerAccountId))?.handle ??
          (await slurp.getNoodlerAccountById(thread.viewerAccountId))?.handle ??
          null,
      })),
    );
    const [viewerCommissionLists, creatorCommissionLists] = await Promise.all([
      Promise.all(threads.map((thread) => messages.listCommissionsForThread(thread.id))),
      Promise.all(operated.map((creatorAccountId) => messages.listOpenCommissionsForCreator(creatorAccountId))),
    ]);
    const attentionCommissions = selectSlurpAttentionCommissions({
      viewerThreadIds: new Set(threads.map((thread) => thread.id)),
      operatedCreatorIds: new Set(operated),
      viewerCommissions: viewerCommissionLists.flat(),
      creatorCommissions: creatorCommissionLists.flat(),
    });
    return {
      threads: threads
        .filter((thread) => thread.state !== "declined")
        .map((thread) => ({ ...thread, side: "viewer" as const })),
      inbound: inboundViews.filter((thread) => thread.state !== "declined"),
      unread: threads.reduce((sum, thread) => sum + thread.viewerUnread, 0),
      // Unread on the Creator side is what the player owes an answer to.
      inboundUnread: inboundViews.reduce((sum, thread) => sum + thread.creatorUnread, 0),
      attentionCommissions,
    };
  });

  app.get("/messages/threads/:threadId", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId } = req.params as { threadId: string };
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const thread = await messages.getThreadById(threadId);
    // Scoped to the requesting persona: a thread id must never be enough to read someone
    // else's inbox, even on a single-user install.
    if (!thread || (thread.viewerAccountId !== viewer.id && !(await ownsCreator(viewer.id, thread.creatorAccountId))))
      return reply.code(404).send({ error: "Thread not found" });
    const side = thread.viewerAccountId === viewer.id ? "viewer" : "creator";
    await messages.markRead(thread.id, side);
    const creator = await slurp.getNoodlerAccountById(thread.creatorAccountId);
    if (!creator) return reply.code(404).send({ error: "Creator not found" });
    const counterpart =
      side === "creator"
        ? ((await population.get(thread.viewerAccountId)) ??
          (await slurp.getNoodlerAccountById(thread.viewerAccountId)) ??
          (await slurp.getViewer(thread.viewerAccountId).catch(() => null)))
        : creator;
    // When the creator last posted, so the thread header can show the same online/away/offline
    // status the profile header does. The status rule is derived from posting activity, and the
    // thread view had no way to see it, which is why it showed nothing.
    return {
      thread: await freshView(thread.id, side),
      messages: await visibleMessages(thread.id, side),
      creator,
      counterpart,
      ...(await creatorPresence(creator, thread.id)),
      messaging: await messages.getCreatorMessaging(thread.creatorAccountId),
      commissions: await messages.listCommissionsForThread(thread.id),
      relationship: {
        side,
        tier: thread.rapport.tier,
        score: thread.rapport.score,
        contributions: thread.rapport.contributions,
        mood: thread.mood,
        strikes: activeSlurpStrikes(thread.strikes, thread.lastStrikeAt),
        notes: thread.notes,
        spentCoins: await messages.spentWithCreator(thread.viewerAccountId, thread.creatorAccountId),
        coolUntil: thread.coolUntil,
        dayVibe: await describeSlurpDayVibe(app.db, thread.creatorAccountId),
        availability: (await creatorPresence(creator, thread.id)).creatorAvailability,
        audienceTone: readSlurpAudienceTone((await slurp.getSettings()).audienceTone),
        imageMode:
          thread.mood <= -40 && readSlurpAudienceTone((await slurp.getSettings()).audienceTone) === "unfiltered"
            ? "hostile"
            : thread.mood >= 20
              ? "friendly"
              : "none",
        creatorState: await slurp.getCreatorState(thread.creatorAccountId),
        threadState: thread.threadState,
      },
    };
  });

  /**
   * Empty this conversation and start it over.
   *
   * Scoped exactly like reading the thread: either side of this pair may do it, a thread id alone
   * may not. Destructive and deliberate, so it is its own endpoint rather than a flag on send.
   */
  app.post("/messages/threads/:threadId/reset", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId } = req.params as { threadId: string };
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const thread = await messages.getThreadById(threadId);
    if (!thread || (thread.viewerAccountId !== viewer.id && !(await ownsCreator(viewer.id, thread.creatorAccountId))))
      return reply.code(404).send({ error: "Thread not found" });
    await messages.resetThread(thread.id);
    const side = thread.viewerAccountId === viewer.id ? "viewer" : "creator";
    // Empty, but read back through the masking helper all the same: every route that returns a
    // thread's messages goes through one door.
    return { thread: await freshView(thread.id, side), messages: await visibleMessages(thread.id, side) };
  });

  /**
   * Rewrite what the creator remembers about this fan.
   *
   * Scoped exactly like reading and clearing the thread: either side of this pair may do it. The
   * fan is allowed in because the memories are already shown to them in the conversation panel,
   * and a memory the player can read but never correct is worse than none — a creator who has
   * misremembered your job keeps saying it forever.
   *
   * The body is the whole list rather than a patch. It is short, capped, and read back through
   * the same normalizer the model's own writes use, so there is one shape of stored memory.
   */
  app.put("/messages/threads/:threadId/notes", async (req, reply) => {
    const parsed = z
      .object({
        personaId: z.string().min(1),
        notes: z
          .array(
            z.object({
              id: z.string().trim().max(32).optional(),
              text: z.string().trim().min(1).max(SLURP_NOTE_MAX_LENGTH),
              tier: z.enum(["working", "longterm"]),
            }),
          )
          .max(SLURP_WORKING_NOTE_LIMIT + SLURP_LONGTERM_NOTE_LIMIT),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId } = req.params as { threadId: string };
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const thread = await messages.getThreadById(threadId);
    if (!thread || (thread.viewerAccountId !== viewer.id && !(await ownsCreator(viewer.id, thread.creatorAccountId))))
      return reply.code(404).send({ error: "Thread not found" });
    return { notes: await messages.setThreadNotes(thread.id, parsed.data.notes) };
  });

  /**
   * The conversation with one creator, whether or not it has started.
   *
   * Returns a null thread rather than creating one, so opening a Creator's chat from their
   * profile never charges a request fee or leaves an empty thread behind when the player
   * changes their mind. The fee is taken on the first send, which is where it belongs.
   */
  app.get("/messages/compose", async (req, reply) => {
    const parsed = personaQuerySchema.extend({ creatorAccountId: z.string().trim().min(1) }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const creator = await slurp.getNoodlerAccountById(parsed.data.creatorAccountId);
    if (!creator) return reply.code(404).send({ error: "Creator not found" });
    const thread = await messages.getThread(viewer.id, creator.id);
    if (thread) await messages.markRead(thread.id, "viewer");
    return {
      thread: thread ? await freshView(thread.id) : null,
      messages: thread ? await visibleMessages(thread.id, "viewer") : [],
      commissions: thread ? await messages.listCommissionsForThread(thread.id) : [],
      creator,
      ...(await creatorPresence(creator, thread?.id)),
      relationship: thread
        ? {
            side: "viewer" as const,
            tier: thread.rapport.tier,
            score: thread.rapport.score,
            contributions: thread.rapport.contributions,
            mood: thread.mood,
            strikes: activeSlurpStrikes(thread.strikes, thread.lastStrikeAt),
            notes: thread.notes,
            spentCoins: await messages.spentWithCreator(thread.viewerAccountId, thread.creatorAccountId),
            coolUntil: thread.coolUntil,
            dayVibe: await describeSlurpDayVibe(app.db, thread.creatorAccountId),
            availability: (await creatorPresence(creator, thread.id)).creatorAvailability,
            audienceTone: readSlurpAudienceTone((await slurp.getSettings()).audienceTone),
            imageMode:
              thread.mood <= -40 && readSlurpAudienceTone((await slurp.getSettings()).audienceTone) === "unfiltered"
                ? "hostile"
                : thread.mood >= 20
                  ? "friendly"
                  : "none",
            creatorState: await slurp.getCreatorState(thread.creatorAccountId),
            threadState: thread.threadState,
          }
        : undefined,
      // The client shows the gate before the first message is written, so it must know the
      // policy even when no thread exists yet.
      messaging: await messages.getCreatorMessaging(creator.id),
      subscribed: (await slurp.listSubscriptionsForViewer(viewer.id)).some(
        (entry) => entry.creatorAccountId === creator.id,
      ),
    };
  });

  /**
   * Send, then answer if the creator is reachable.
   *
   * The reply is awaited rather than fired and forgotten, so the client gets the whole exchange
   * in one response and never has to poll to find out whether anything happened. A generation
   * failure still returns the sent message: the fan's words are not lost because a model was.
   */
  app.post("/messages/send", async (req, reply) => {
    const parsed = sendSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const sent = await messages.sendViewerMessage(
      viewer.id,
      parsed.data.creatorAccountId,
      parsed.data.content,
      parsed.data.requestId,
    );
    if (sent.status === "not_found") return reply.code(404).send({ error: "Creator not found" });
    if (sent.status === "closed") return reply.code(403).send({ error: "This Creator is not accepting messages." });
    if (sent.status === "insufficient_funds")
      return reply.code(402).send({ error: "Not enough coins.", required: sent.required });

    let outcome;
    let tipError: string | null = null;
    let replyTriggerMessageId = sent.message.id;
    if (parsed.data.tip) {
      const tipped = await messages.tipInThread(
        viewer.id,
        parsed.data.creatorAccountId,
        parsed.data.tip.amount,
        parsed.data.tip.note,
        parsed.data.requestId,
      );
      if (tipped.status === "sent") replyTriggerMessageId = tipped.message.id;
      else if (tipped.status === "insufficient_funds") tipError = "Not enough coins for the attached tip.";
      else tipError = "The message was sent, but the tip could not be sent.";
    }
    try {
      outcome = await replyToSlurpMessage(app.db, {
        threadId: sent.thread.id,
        triggerMessageId: replyTriggerMessageId,
      });
    } catch (error) {
      logger.error(error, "[slurp-message] Reply failed after a send in thread %s", sent.thread.id);
      outcome = { status: "failed" as const, error: "Reply generation failed." };
    }
    return {
      thread: (await freshView(sent.thread.id)) ?? sent.thread,
      message: sent.message,
      reply: outcome.status === "replied" ? outcome.message : null,
      replyStatus: outcome.status,
      // The client shows the typing indicator for this long before revealing the reply, so the
      // pacing the model was given and the pacing the player sees are the same number.
      typingMs: "pacing" in outcome ? outcome.pacing.typingMs : 0,
      tipError,
    };
  });

  app.post("/messages/tip", async (req, reply) => {
    const parsed = tipSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const sent = await messages.tipInThread(
      viewer.id,
      parsed.data.creatorAccountId,
      parsed.data.amount,
      parsed.data.note,
    );
    if (sent.status === "not_found") return reply.code(404).send({ error: "Creator not found" });
    if (sent.status === "closed") return reply.code(403).send({ error: "This Creator is not accepting messages." });
    if (sent.status === "insufficient_funds")
      return reply.code(402).send({ error: "Not enough coins.", required: sent.required });
    // A tip is worth answering, and a thanks that arrives an hour later is not a thanks.
    const outcome = await replyToSlurpMessage(app.db, {
      threadId: sent.thread.id,
      triggerMessageId: sent.message.id,
    });
    return {
      thread: (await freshView(sent.thread.id)) ?? sent.thread,
      message: sent.message,
      reply: outcome.status === "replied" ? outcome.message : null,
      replyStatus: outcome.status,
      wallet: await slurp.getWallet(viewer.id),
    };
  });

  app.post("/messages/ppv/unlock", async (req, reply) => {
    const parsed = z
      .object({ personaId: z.string().trim().min(1), messageId: z.string().trim().min(1) })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const message = await messages.unlockMessage(viewer.id, parsed.data.messageId);
    if (!message) return reply.code(402).send({ error: "PPV message cannot be unlocked." });
    return { message, wallet: await slurp.getWallet(viewer.id) };
  });

  app.post("/messages/:messageId/reaction", async (req, reply) => {
    const parsed = z
      .object({ personaId: z.string().min(1), reaction: z.enum(["heart"]).nullable() })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { messageId } = req.params as { messageId: string };
    const message = await messages.setMessageReaction(messageId, parsed.data.personaId, parsed.data.reaction);
    if (!message) return reply.code(404).send({ error: "Message not found" });
    return { message };
  });

  /**
   * Write as the Creator, in your own words.
   *
   * The Creator's side of a conversation was generated and only generated. There was no way to
   * answer a fan yourself, and once Creator-side threads became visible the only composer on
   * screen sent as the viewer — the wrong direction entirely.
   */
  app.post("/messages/creators/:creatorAccountId/reply", async (req, reply) => {
    const parsed = z
      .object({
        personaId: z.string().trim().min(1),
        viewerAccountId: z.string().trim().min(1),
        content: z.string().trim().min(1).max(2000),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    if (!(await ownsCreator(parsed.data.personaId, creatorAccountId))) {
      return reply.code(403).send({ error: "Only the Creator's owner can write as them." });
    }
    const message = await messages.sendCreatorMessage(creatorAccountId, parsed.data.viewerAccountId, {
      content: parsed.data.content,
    });
    if (!message) return reply.code(404).send({ error: "Conversation not found" });
    const thread = await messages.getThread(parsed.data.viewerAccountId, creatorAccountId);
    return { message, thread: thread ? await freshView(thread.id, "creator") : null };
  });

  /**
   * Have the Creator draft their own reply, for the player to send or rewrite.
   *
   * The generator is the fallback here rather than the default: the maintainer wants to write as
   * their Creator, with the model available when they would rather not.
   */
  app.post("/messages/creators/:creatorAccountId/draft-reply", async (req, reply) => {
    const parsed = z
      .object({ personaId: z.string().trim().min(1), threadId: z.string().trim().min(1) })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    if (!(await ownsCreator(parsed.data.personaId, creatorAccountId))) {
      return reply.code(403).send({ error: "Only the Creator's owner can draft as them." });
    }
    const thread = await messages.getThreadById(parsed.data.threadId);
    if (!thread || thread.creatorAccountId !== creatorAccountId) {
      return reply.code(404).send({ error: "Conversation not found" });
    }
    const latest = (await messages.listMessages(thread.id, 1))[0];
    if (!latest) return reply.code(400).send({ error: "Nothing to reply to yet." });
    const outcome = await replyToSlurpMessage(app.db, {
      threadId: thread.id,
      triggerMessageId: latest.id,
      force: true,
    });
    if (outcome.status !== "replied") {
      return reply.code(502).send({ error: "Could not draft a reply.", status: outcome.status });
    }
    return { message: outcome.message, thread: await freshView(thread.id, "creator") };
  });

  app.post("/messages/creators/:creatorAccountId/ppv", async (req, reply) => {
    const parsed = creatorMessageSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    if (!(await ownsCreator(parsed.data.personaId, creatorAccountId)))
      return reply.code(403).send({ error: "Only the Creator's owner can send PPV messages." });
    if (parsed.data.price <= 0) return reply.code(400).send({ error: "A PPV message needs a price." });
    const message = await messages.sendCreatorMessage(creatorAccountId, parsed.data.viewerAccountId, {
      content: parsed.data.content,
      kind: "ppv",
      price: parsed.data.price,
      imageUrl: parsed.data.imageUrl ?? null,
    });
    if (!message) return reply.code(404).send({ error: "Viewer or thread not found" });
    return { message };
  });

  app.post("/messages/creators/:creatorAccountId/broadcast", async (req, reply) => {
    const parsed = broadcastSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    if (!(await ownsCreator(parsed.data.personaId, creatorAccountId)))
      return reply.code(403).send({ error: "Only the Creator's owner can broadcast messages." });
    const subscribers = await slurp.listSubscriptionsForCreator(creatorAccountId);
    const activeSubscribers = [];
    for (const subscription of subscribers) {
      const wallet = await slurp.getWallet(subscription.viewerAccountId);
      if (wallet.subscriptions[creatorAccountId]) activeSubscribers.push(subscription);
    }
    const sent = [];
    for (const subscription of activeSubscribers) {
      const message = await messages.sendCreatorMessage(creatorAccountId, subscription.viewerAccountId, {
        content: parsed.data.content,
        kind: "broadcast",
      });
      if (message) sent.push(message.id);
    }
    return { sent: sent.length };
  });

  app.post("/messages/commissions", async (req, reply) => {
    const parsed = commissionBriefSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const commission = await messages.createCommission(viewer.id, parsed.data.creatorAccountId, parsed.data.brief);
    if (commission === "open_request")
      return reply.code(409).send({ error: "You already have a commission request open with this Creator." });
    if (!commission) return reply.code(403).send({ error: "This Creator is not accepting commissions." });
    // A commission needs a review step. Character Creators quote from the world tick, while a
    // persona-owned Creator can review and negotiate it here without charging the fan first.
    return { commission };
  });

  app.post("/messages/commissions/:commissionId/quote", async (req, reply) => {
    const parsed = commissionQuoteSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const commission = await messages.getCommission((req.params as { commissionId: string }).commissionId);
    if (!commission) return reply.code(404).send({ error: "Commission not found" });
    if (!(await ownsCreator(parsed.data.personaId, commission.creatorAccountId)))
      return reply.code(403).send({ error: "Creator ownership required" });
    const updated = await messages.quoteCommission(commission.id, parsed.data.price);
    if (!updated) return reply.code(409).send({ error: "This commission is no longer open for a quote." });
    return { commission: updated };
  });

  app.post("/messages/commissions/:commissionId/accept", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const commission = await messages.getCommission((req.params as { commissionId: string }).commissionId);
    if (!commission || commission.viewerAccountId !== parsed.data.personaId)
      return reply.code(404).send({ error: "Commission not found" });
    if (commission.state !== "quoted") {
      return reply.code(409).send({ error: "This commission is not waiting for payment." });
    }
    if (commissionAcceptRequests.has(commission.id)) {
      return reply.code(409).send({ error: "This commission is already being accepted." });
    }
    commissionAcceptRequests.add(commission.id);
    let drawn: Awaited<ReturnType<typeof generateSlurpCommissionImage>> | null = null;
    try {
      const creator = await slurp.getNoodlerAccountById(commission.creatorAccountId);
      const automatic = Boolean(creator && creator.sourceKind !== "persona");
      // Stage the character Creator's work before taking payment. A missing or failed image
      // connection must leave the quote payable later, not charge the fan for an empty delivery.
      if (automatic) {
        try {
          drawn = await generateSlurpCommissionImage(app.db, {
            creatorAccountId: commission.creatorAccountId,
            brief: commission.brief,
          });
        } catch (error) {
          logger.warn(error, "[slurp-commission] Could not draw an automatic commission");
          return reply.code(502).send({ error: "Could not create that commission yet. Try again later." });
        }
        if (drawn === "unavailable") {
          return reply.code(404).send({ error: "No image generation connection is configured." });
        }
      }

      const accepted = await messages.acceptCommission(commission.id);
      if (!accepted || accepted.state !== "accepted") {
        if (drawn && drawn !== "unavailable") drawn.compensate();
        return reply.code(402).send({ error: "Not enough coins." });
      }
      if (!automatic || !drawn || drawn === "unavailable") return { commission: accepted };

      // Keep the drawing. It is finished, it is paid for, and it now has to survive until the
      // delivery is due — which may be after a restart, so the file cannot stay staged.
      drawn.promote();
      const deliverAt = new Date(
        Date.now() + slurpCommissionDeliveryDelayMs({ price: accepted.price, briefLength: commission.brief.length }),
      ).toISOString();
      const scheduled = await messages.scheduleCommissionDelivery(commission.id, {
        deliverAt,
        mediaPath: drawn.mediaPath,
      });
      if (scheduled) return { commission: scheduled };

      // Nothing could be scheduled, so the wait is dropped rather than the delivery. The fan has
      // paid; handing them the piece now is worse pacing but it is not a loss.
      const outcome = await deliverAutomaticSlurpCommission(app.db, accepted, drawn.mediaPath);
      if (outcome.status === "delivered") return { commission: outcome.commission };
      return reply.code(500).send({
        error:
          outcome.status === "refunded"
            ? "Could not deliver that commission. Your payment was refunded."
            : "Could not deliver that commission. It is paid for and still in progress.",
      });
    } finally {
      commissionAcceptRequests.delete(commission.id);
    }
  });

  /** Either side may end an unpaid commission: the Creator declines it, the fan takes it back. */
  app.post("/messages/commissions/:commissionId/decline", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const commission = await messages.getCommission((req.params as { commissionId: string }).commissionId);
    if (!commission) return reply.code(404).send({ error: "Commission not found" });
    const isCreator = await ownsCreator(parsed.data.personaId, commission.creatorAccountId);
    const isViewer = commission.viewerAccountId === parsed.data.personaId;
    if (!isCreator && !isViewer) return reply.code(403).send({ error: "Commission not found" });
    if (commission.state !== "brief" && commission.state !== "quoted") {
      return reply.code(409).send({ error: "This commission can no longer be called off." });
    }
    return { commission: await messages.declineCommission(commission.id, isCreator ? "creator" : "viewer") };
  });

  app.post("/messages/commissions/:commissionId/deliver", async (req, reply) => {
    const parsed = commissionDeliverySchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const commissionId = (req.params as { commissionId: string }).commissionId;
    const commission = await messages.getCommission(commissionId);
    if (!commission || !(await ownsCreator(parsed.data.personaId, commission.creatorAccountId)))
      return reply.code(404).send({ error: "Commission not found" });
    if (commission.state !== "accepted") {
      return reply.code(409).send({ error: "This commission is not ready for delivery." });
    }
    if (commissionDeliveryRequests.has(commissionId)) {
      return reply.code(409).send({ error: "This commission is already being delivered." });
    }
    commissionDeliveryRequests.add(commissionId);
    try {
      // A commission is somebody paying for a picture, so the delivery can draw it. Generate before
      // the message is written: a failed drawing must not leave a delivered commission with nothing
      // in it, and the fan's coins are already spent.
      let drawn: Awaited<ReturnType<typeof generateSlurpCommissionImage>> | null = null;
      if (parsed.data.generateImage) {
        try {
          drawn = await generateSlurpCommissionImage(app.db, {
            creatorAccountId: commission.creatorAccountId,
            brief: commission.brief,
          });
        } catch (error) {
          logger.warn(error, "[slurp-commission] Could not draw the commissioned piece");
          return reply
            .code(502)
            .send({ error: "Could not draw that commission. Try again, or proceed without a generated image." });
        }
        if (drawn === "unavailable") {
          return reply.code(404).send({ error: "No image generation connection is configured." });
        }
      }
      const delivered = await messages.deliverCommission(
        commission.id,
        parsed.data.content,
        parsed.data.imageUrl ?? null,
      );
      if (!delivered || delivered.state !== "delivered" || !delivered.deliveryMessageId) {
        if (drawn && drawn !== "unavailable") drawn.compensate();
        // This used to answer 200 with a null commission after silently refunding the fan.
        return reply.code(500).send({
          error: delivered
            ? "This commission is no longer ready for delivery."
            : "Could not deliver that commission. The fan's payment was refunded.",
        });
      }
      if (drawn && drawn !== "unavailable") {
        drawn.promote();
        await messages.setMessageMedia(
          delivered.deliveryMessageId,
          slurpMessageMediaUrl(delivered.deliveryMessageId),
          drawn.mediaPath,
        );
      }
      return { commission: delivered };
    } finally {
      commissionDeliveryRequests.delete(commissionId);
    }
  });

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
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid image upload." });
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
        metadata: { noodlerMediaPath: drawn.mediaPath, generatedContext: "viewer" },
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

  app.get("/messages/creators/:creatorAccountId/settings", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    if (!(await slurp.getNoodlerAccountById(creatorAccountId)))
      return reply.code(404).send({ error: "Creator not found" });
    if (!(await ownsCreator(parsed.data.personaId, creatorAccountId)))
      return reply.code(403).send({ error: "Only the Creator's owner can read messaging settings." });
    // The weekly price rides along: it is already public on every profile, and the Creator's own
    // settings panel needs it beside the message prices rather than through a second request.
    return {
      messaging: await messages.getCreatorMessaging(creatorAccountId),
      subscriptionPrice: await slurp.getCreatorSubscriptionPrice(creatorAccountId),
    };
  });

  app.patch("/messages/creators/:creatorAccountId/settings", async (req, reply) => {
    const parsed = messagingPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    if (!(await slurp.getNoodlerAccountById(creatorAccountId)))
      return reply.code(404).send({ error: "Creator not found" });
    if (!(await ownsCreator(parsed.data.personaId, creatorAccountId)))
      return reply.code(403).send({ error: "Only the Creator's owner can change messaging settings." });
    const { personaId: _personaId, ...patch } = parsed.data;
    return {
      messaging: await messages.setCreatorMessaging(
        creatorAccountId,
        patch as Parameters<typeof messages.setCreatorMessaging>[1],
      ),
    };
  });

  /**
   * Exactly what the creator is about to be shown, and why.
   *
   * The prompt is produced by `buildSlurpMessagePrompt`, which is the same function the reply
   * itself runs. A debug view that rebuilds the prompt separately drifts, and then reports
   * something the model never received — worse than having no debug view.
   *
   * Nothing is generated. This is assembly only, so reading it costs nothing.
   *
   * The text is redacted exactly as the model sees it. There is deliberately no unprotected mode:
   * that would leak a concealed Creator's source identity through the debug door and undo
   * `noodlerConcealedSourceText`.
   */
  app.get("/messages/threads/:threadId/prompt", async (req, reply) => {
    if (!isDebugAgentsEnabled()) return reply.code(404).send({ error: "Not Found" });
    const parsed = personaQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId } = req.params as { threadId: string };
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const thread = await messages.getThreadById(threadId);
    if (!thread || !(await ownsCreator(viewer.id, thread.creatorAccountId)))
      return reply.code(404).send({ error: "Thread not found" });
    const creator = await slurp.getNoodlerAccountById(thread.creatorAccountId);
    const fan = await slurp.getViewer(thread.viewerAccountId);
    if (!creator || !fan) return reply.code(404).send({ error: "Thread not found" });
    const settings = await slurp.getSettings();
    const connection = await resolveSlurpTextConnection(
      createConnectionsStorage(app.db),
      settings.generationConnectionId,
    );
    if (!connection) return reply.code(409).send({ error: "No text connection is configured." });
    const subscriptions = await slurp.listSubscriptionsForViewer(thread.viewerAccountId);
    const messaging = await messages.getCreatorMessaging(thread.creatorAccountId);
    const built = await buildSlurpMessagePrompt({
      db: app.db,
      creator,
      viewer: fan,
      history: await messages.listMessages(thread.id, 60),
      rapport: thread.rapport,
      subscribed: subscriptions.some((entry) => entry.creatorAccountId === thread.creatorAccountId),
      dmPolicy: messaging.dmPolicy,
      isRequest: thread.state === "request",
      mood: thread.mood,
      moodUpdatedAt: thread.moodUpdatedAt,
      notes: thread.notes,
      threadState: thread.threadState,
      creatorState: await slurp.getCreatorState(thread.creatorAccountId),
      dayVibe: await describeSlurpDayVibe(app.db, thread.creatorAccountId),
      coolingOff: Boolean(thread.coolUntil && thread.coolUntil > new Date().toISOString()),
      strikes: thread.strikes,
      connection,
    });
    return {
      // The layers first. This is the section that answers "why did she say that".
      stance: built.stance,
      thread: {
        mood: thread.mood,
        moodUpdatedAt: thread.moodUpdatedAt,
        coolUntil: thread.coolUntil,
        strikes: thread.strikes,
        threadState: thread.threadState,
        notes: thread.notes,
        rapport: thread.rapport,
        state: thread.state,
      },
      audienceTone: settings.audienceTone,
      prompt: built.messages,
    };
  });

  /**
   * The rapport breakdown for one pair. Read by the creator edit panel only: the score is
   * deliberately absent from the thread UI, so the fiction is not broken by a visible meter.
   */
  app.get("/messages/creators/:creatorAccountId/rapport", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    const creator = await slurp.getNoodlerAccountById(creatorAccountId);
    if (!creator) return reply.code(404).send({ error: "Creator not found" });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    if (!(await ownsCreator(parsed.data.personaId, creatorAccountId)))
      return reply.code(403).send({ error: "Only the Creator's owner can read rapport." });
    const messaging = await messages.getCreatorMessaging(creatorAccountId);
    return {
      messaging,
      rapport: await messages.rapportFor(viewer.id, creatorAccountId),
      facts: await messages.rapportFactsFor(viewer.id, creatorAccountId),
    };
  });
}
