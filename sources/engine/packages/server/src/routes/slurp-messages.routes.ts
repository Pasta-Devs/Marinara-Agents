// ──────────────────────────────────────────────
// Routes: Slurp direct messages
// ──────────────────────────────────────────────
//
// Registered from `slurp.routes.ts`, but kept in its own file: that one is already past two
// thousand five hundred lines, and nothing here needs the feed helpers it holds.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createSlurpStorage } from "../services/storage/slurp.storage.js";
import { createSlurpMessagesStorage } from "../services/storage/slurp-messages.storage.js";
import { replyToSlurpMessage } from "../services/slurp/slurp-message.operation.js";
import { SLURP_DM_POLICIES } from "../services/slurp/slurp-messaging.js";
import { SLURP_DEFAULT_RAPPORT_WEIGHTS } from "../services/slurp/slurp-rapport.js";
import { logger } from "../lib/logger.js";

const personaQuerySchema = z.object({ personaId: z.string().trim().min(1) });

const sendSchema = z.object({
  personaId: z.string().trim().min(1),
  creatorAccountId: z.string().trim().min(1),
  // Bounded at the trust boundary: this text reaches a model prompt, and an unbounded body
  // would let one message push the whole conversation out of the context window.
  content: z.string().trim().min(1).max(2000),
});

const tipSchema = z.object({
  personaId: z.string().trim().min(1),
  creatorAccountId: z.string().trim().min(1),
  amount: z.number().int().min(1).max(9999),
  note: z.string().trim().max(280).default(""),
});

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
  dmPolicy: z.enum(SLURP_DM_POLICIES as unknown as [string, ...string[]]).optional(),
  requestFee: z.number().int().min(0).max(9999).optional(),
  ppvPrice: z.number().int().min(0).max(9999).optional(),
  rapportWeights: rapportWeightsSchema.optional(),
});

export async function slurpMessageRoutes(app: FastifyInstance) {
  const slurp = createSlurpStorage(app.db);
  const messages = createSlurpMessagesStorage(app.db);

  /** Every route needs the same "is this a real persona" gate, so it lives in one helper. */
  const requireViewer = async (personaId: string) => slurp.getViewer(personaId);

  /** Re-read a thread and enrich it, so every response carries the same joined shape. */
  const freshView = async (threadId: string) => {
    const thread = await messages.getThreadById(threadId);
    return thread ? await messages.viewThread(thread) : null;
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
    return {
      threads: threads.filter((thread) => thread.state !== "declined"),
      unread: threads.reduce((sum, thread) => sum + thread.viewerUnread, 0),
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
    return {
      thread: await freshView(thread.id),
      messages: await messages.listMessages(thread.id),
      creator,
      messaging: await messages.getCreatorMessaging(thread.creatorAccountId),
    };
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
      messages: thread ? await messages.listMessages(thread.id) : [],
      creator,
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
    const sent = await messages.sendViewerMessage(viewer.id, parsed.data.creatorAccountId, parsed.data.content);
    if (sent.status === "not_found") return reply.code(404).send({ error: "Creator not found" });
    if (sent.status === "closed") return reply.code(403).send({ error: "This Creator is not accepting messages." });
    if (sent.status === "insufficient_funds")
      return reply.code(402).send({ error: "Not enough coins.", required: sent.required });

    if (sent.thread.state !== "active") {
      return {
        thread: (await freshView(sent.thread.id)) ?? sent.thread,
        message: sent.message,
        reply: null,
        replyStatus: "request",
      };
    }
    let outcome;
    try {
      outcome = await replyToSlurpMessage(app.db, { threadId: sent.thread.id, triggerMessageId: sent.message.id });
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
    const outcome =
      sent.thread.state === "active"
        ? await replyToSlurpMessage(app.db, { threadId: sent.thread.id, triggerMessageId: sent.message.id })
        : { status: "request" as const };
    return {
      thread: (await freshView(sent.thread.id)) ?? sent.thread,
      message: sent.message,
      reply: outcome.status === "replied" ? outcome.message : null,
      replyStatus: outcome.status,
      wallet: await slurp.getWallet(viewer.id),
    };
  });

  app.post("/messages/threads/:threadId/request", async (req, reply) => {
    const parsed = requestDecisionSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId } = req.params as { threadId: string };
    const thread = await messages.getThreadById(threadId);
    if (!thread) return reply.code(404).send({ error: "Thread not found" });
    if (!(await ownsCreator(parsed.data.personaId, thread.creatorAccountId)))
      return reply.code(403).send({ error: "Only the Creator's owner can answer a message request." });
    await messages.resolveRequest(threadId, parsed.data.decision);
    return { thread: await freshView(threadId) };
  });

  app.get("/messages/creators/:creatorAccountId/settings", async (req, reply) => {
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    if (!(await slurp.getNoodlerAccountById(creatorAccountId)))
      return reply.code(404).send({ error: "Creator not found" });
    return { messaging: await messages.getCreatorMessaging(creatorAccountId) };
  });

  app.patch("/messages/creators/:creatorAccountId/settings", async (req, reply) => {
    const parsed = messagingPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    if (!(await slurp.getNoodlerAccountById(creatorAccountId)))
      return reply.code(404).send({ error: "Creator not found" });
    return {
      messaging: await messages.setCreatorMessaging(
        creatorAccountId,
        parsed.data as Parameters<typeof messages.setCreatorMessaging>[1],
      ),
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
    const messaging = await messages.getCreatorMessaging(creatorAccountId);
    return {
      messaging,
      rapport: await messages.rapportFor(viewer.id, creatorAccountId),
      facts: await messages.rapportFactsFor(viewer.id, creatorAccountId, creator.handle),
    };
  });
}
