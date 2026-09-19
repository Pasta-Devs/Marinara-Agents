import { z } from "zod";
import { replyToSlurpMessage } from "./slp-message-operation.js";
import { logger } from "../../../lib/logger.js";
import { parseSlurpCheatDirective } from "../../modules/messages/slp-cheat-directive.js";
import { SLURP_DEV_CHEAT_MAX_COINS } from "../../modules/economy/slp-wallet.js";
import { generateCreatorArtwork } from "../creators/slp-creators-contract.js";
import { createScheduledFollowUps } from "../../modules/messages/slp-follow-up.js";
import { createSlurpReplyQueueStorage } from "../../data/messages/slp-reply-queue-storage.js";
import { reactToSlurpPayment } from "../economy/slp-economy-contract.js";
import type { FastifyInstance } from "fastify";
import { personaQuerySchema } from "../../modules/messages/slp-messages-schemas.js";
import type { SlpMessagesContext } from "./slp-messages-context.js";

const sendSchema = z.object({
  personaId: z.string().trim().min(1),
  creatorAccountId: z.string().trim().min(1),
  // Bounded at the trust boundary: this text reaches a model prompt, and an unbounded body
  // would let one message push the whole conversation out of the context window.
  content: z.string().trim().min(1).max(2000),
  generationGuidance: z.string().trim().max(2000).optional(),
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
  requestId: z.string().trim().min(8).max(100).optional(),
});
export async function slpMessagesSendRoutes(app: FastifyInstance, messaging: SlpMessagesContext) {
  const { freshView, messages, ownsCreator, requireViewer, slurp } = messaging;
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
        generationGuidance: parsed.data.generationGuidance,
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

  app.post("/messages/cheat", async (req, reply) => {
    // Check on every request. Do not trust a client flag cached before the environment changed.
    if (process.env.NODE_ENV !== "development" || process.env.CHEATS_ENABLED !== "true")
      return reply.code(404).send({ error: "Not found" });
    const parsed = z
      .object({
        personaId: z.string().trim().min(1),
        creatorAccountId: z.string().trim().min(1),
        directive: z.string().trim().min(1).max(2000),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const directive = parseSlurpCheatDirective(parsed.data.directive);
    if (directive.kind === "invalid") return reply.code(400).send({ status: "rejected", reason: "invalid" });
    if (directive.kind === "help") {
      return {
        status: "accepted",
        kind: "help",
        help: [
          "/cheat coins <amount>",
          "/cheat force creator photo [guidance]",
          "/cheat force ppv [message]",
          "/cheat mood <+/-amount>",
          "/cheat rapport <+/-amount>",
          "/cheat availability <minutes>",
          "/cheat test follow-up <timing> <reason>",
          "/cheat test promise <timing> <reason>",
          "/cheat <free-text directive>",
        ],
      };
    }
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    if (directive.kind === "coins") {
      if (directive.coins > SLURP_DEV_CHEAT_MAX_COINS)
        return reply.code(400).send({ status: "rejected", reason: "coins_limit" });
      await slurp.setWalletCoinsForDevelopment(viewer.id, directive.coins);
      return { status: "accepted", kind: "coins", coins: directive.coins };
    }
    const thread = await messages.getThread(viewer.id, parsed.data.creatorAccountId);
    if (!thread) return reply.code(400).send({ status: "rejected", reason: "no_thread" });
    if (directive.kind === "force_creator_photo") {
      if (!(await ownsCreator(parsed.data.personaId, parsed.data.creatorAccountId)))
        return reply.code(403).send({ status: "rejected", reason: "not_owner" });
      const result = await generateCreatorArtwork(app.db, {
        accountId: parsed.data.creatorAccountId,
        kind: "avatar",
        guidance: directive.guidance,
      });
      if (result !== "avatar") return reply.code(400).send({ status: "rejected", reason: result });
      return { status: "accepted", kind: directive.kind };
    }
    if (directive.kind === "mood" || directive.kind === "rapport") {
      if (!Number.isFinite(directive.amount) || Math.abs(directive.amount) > 100)
        return reply.code(400).send({ status: "rejected", reason: "amount_limit" });
      await messages.adjustCheatState(thread.id, { [directive.kind]: directive.amount });
      return { status: "accepted", kind: directive.kind, amount: directive.amount };
    }
    if (directive.kind === "availability") {
      if (directive.minutes < 1 || directive.minutes > 24 * 60)
        return reply.code(400).send({ status: "rejected", reason: "availability_limit" });
      await messages.keepOnlineFor(thread.id, directive.minutes);
      return { status: "accepted", kind: directive.kind, minutes: directive.minutes };
    }
    if (directive.kind === "follow_up") {
      const { parseTimingToMinutes } = await import("../../modules/messages/slp-follow-up.js");
      const minutes = parseTimingToMinutes(directive.timing);
      if (!minutes || minutes < 1 || minutes > 7 * 24 * 60)
        return reply.code(400).send({ status: "rejected", reason: "timing_invalid" });
      const followUps = createScheduledFollowUps(
        {
          type: directive.type,
          timing: directive.timing,
          count: 1,
          reason: directive.reason,
          context: "Development command test",
        },
        new Date(),
      );
      await messages.addScheduledFollowUps(thread.id, followUps);
      return { status: "accepted", kind: directive.kind, followUp: followUps[0] };
    }
    if (directive.kind === "force_ppv") {
      if (!(await ownsCreator(parsed.data.personaId, parsed.data.creatorAccountId)))
        return reply.code(403).send({ status: "rejected", reason: "not_owner" });
      const messaging = await messages.getCreatorMessaging(parsed.data.creatorAccountId);
      const message = await messages.sendCreatorMessage(parsed.data.creatorAccountId, thread.viewerAccountId, {
        content: directive.guidance || "A paid unlock is ready for you.",
        kind: "ppv",
        price: messaging.ppvPrice,
      });
      if (!message) return reply.code(400).send({ status: "rejected", reason: "message_failed" });
      return { status: "accepted", kind: directive.kind, message };
    }
    const triggerMessageId = await messages.latestViewerMessageId(thread.id);
    if (!triggerMessageId) return reply.code(400).send({ status: "rejected", reason: "no_message" });
    const outcome = await replyToSlurpMessage(app.db, {
      threadId: thread.id,
      triggerMessageId,
      // Guidance changes the requested behavior only. Availability, policy, claims, connection,
      // pacing, and budget checks remain inside the existing reply operation.
      generationGuidance: directive.text,
    });
    if (outcome.status !== "replied") return reply.code(400).send({ status: "rejected", reason: outcome.status });
    return {
      status: "accepted",
      kind: "guidance",
      replyStatus: outcome.status,
      reply: outcome.message,
      typingMs: outcome.pacing.typingMs,
    };
  });

  /**
   * Answer a queued message now instead of waiting out the creator's schedule.
   *
   * Only the pacing wait is skipped. Claims, the account lock, cool-off and the model budget still
   * apply inside `replyToSlurpMessage`, so the outcome is reported exactly as a send reports it.
   */
  app.post("/messages/threads/:threadId/force-reply", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId } = req.params as { threadId: string };
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const thread = await messages.getThreadById(threadId);
    if (!thread || thread.viewerAccountId !== viewer.id) return reply.code(404).send({ error: "Thread not found" });
    const triggerMessageId = await messages.latestViewerMessageId(thread.id);
    if (!triggerMessageId) return reply.code(400).send({ error: "Nothing to reply to yet." });
    // Bubbles from the last answer are still arriving; a second answer would interleave with them.
    const outcome = (await createSlurpReplyQueueStorage(app.db).hasPending(thread.id))
      ? ({ status: "busy" } as const)
      : await replyToSlurpMessage(app.db, { threadId: thread.id, triggerMessageId, force: true });
    return {
      thread: (await freshView(thread.id)) ?? thread,
      reply: outcome.status === "replied" ? outcome.message : null,
      replyStatus: outcome.status,
      typingMs: "pacing" in outcome ? outcome.pacing.typingMs : 0,
    };
  });

  app.post("/messages/threads/:threadId/request-reply", async (req, reply) => {
    const parsed = z
      .object({ personaId: z.string().trim().min(1), guidance: z.string().trim().max(2000).optional() })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId } = req.params as { threadId: string };
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const thread = await messages.getThreadById(threadId);
    if (!thread || thread.viewerAccountId !== viewer.id) return reply.code(404).send({ error: "Thread not found" });
    const triggerMessageId = await messages.latestViewerMessageId(thread.id);
    if (!triggerMessageId) return reply.code(400).send({ error: "Send a message before requesting a reply." });
    const outcome = await replyToSlurpMessage(app.db, {
      threadId: thread.id,
      triggerMessageId,
      generationGuidance:
        parsed.data.guidance ??
        "The fan is asking for a reply. Treat this as a gentle request, not a demand. Answer only if the conversation rules and your availability allow it.",
    });
    return {
      reply: outcome.status === "replied" ? outcome.message : null,
      replyStatus: outcome.status,
      typingMs: "pacing" in outcome ? outcome.pacing.typingMs : 0,
    };
  });

  app.post("/messages/tip", async (req, reply) => {
    const parsed = tipSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const creator = await slurp.getNoodlerAccountById(parsed.data.creatorAccountId);
    if (creator?.sourceKind === "persona" && creator.sourceEntityId === viewer.id)
      return reply.code(400).send({ error: "You cannot tip yourself." });
    const sent = await messages.tipInThread(
      viewer.id,
      parsed.data.creatorAccountId,
      parsed.data.amount,
      parsed.data.note,
      parsed.data.requestId,
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
    const unlockedThread = await messages.getThreadById(message.threadId);
    if (unlockedThread)
      await reactToSlurpPayment(app.db, {
        viewerAccountId: viewer.id,
        creatorAccountId: unlockedThread.creatorAccountId,
        kind: "ppv",
        amount: message.price,
      });
    return { message, wallet: await slurp.getWallet(viewer.id) };
  });

  app.post("/messages/:messageId/reaction", async (req, reply) => {
    const parsed = z
      .object({ personaId: z.string().min(1), reaction: z.enum(["heart"]).nullable() })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { messageId } = req.params as { messageId: string };
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const message = await messages.setMessageReaction(messageId, viewer.id, parsed.data.reaction);
    if (!message) return reply.code(404).send({ error: "Message not found" });
    return { message };
  });
}
