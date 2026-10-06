/**
 * Editing a DM thread by hand (docs/FEEDBACK-2026-10.md R9): change your own words, delete a
 * message, or have the Creator write their last answer again. The rules are in
 * `modules/messages/slp-message-edit.ts`; a scene in progress locks all three (slp-roleplay-scene-lock.ts).
 */
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { personaQuerySchema } from "../../modules/messages/slp-messages-schemas.js";
import {
  slurpLastAnswer,
  slurpMessageEditable,
  slurpMessageRemovable,
} from "../../../../../shared/src/slp/slp-message-edit.js";
import {
  deleteSlurpMessages,
  editSlurpMessage,
  readSlurpThreadMessage,
} from "../../data/messages/slp-message-edit-storage.js";
import { createSlurpReplyQueueStorage } from "../../data/messages/slp-reply-queue-storage.js";
import { replyToSlurpMessage } from "./slp-message-operation.js";
import type { SlpMessagesContext } from "./slp-messages-context.js";

export async function slpMessageEditRoutes(app: FastifyInstance, messaging: SlpMessagesContext) {
  const { freshView, maskForViewer, messages, requireViewer, seatIn, visibleMessages } = messaging;

  /** The thread and the persona's seat in it, or null for a 404. */
  const seat = async (personaId: string, threadId: string) => {
    const viewer = await requireViewer(personaId);
    const thread = viewer ? await messages.getThreadById(threadId) : null;
    const side = thread && viewer ? await seatIn(viewer.id, thread) : null;
    return thread && side ? { thread, side } : null;
  };
  const view = async (threadId: string, side: "viewer" | "creator") => ({
    thread: await freshView(threadId, side),
    messages: await visibleMessages(threadId, side),
  });

  app.post("/messages/threads/:threadId/messages/:messageId/edit", async (req, reply) => {
    const parsed = personaQuerySchema.extend({ content: z.string().trim().min(1).max(2000) }).safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId, messageId } = req.params as { threadId: string; messageId: string };
    const found = await seat(parsed.data.personaId, threadId);
    if (!found) return reply.code(404).send({ error: "Thread not found" });
    const message = await readSlurpThreadMessage(app.db, threadId, messageId);
    if (!message) return reply.code(404).send({ error: "Message not found" });
    if (!slurpMessageEditable(message, found.side))
      return reply.code(409).send({ error: "Only your own words can be edited." });
    await editSlurpMessage(app.db, message, parsed.data.content);
    return view(threadId, found.side);
  });

  app.post("/messages/threads/:threadId/messages/:messageId/delete", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId, messageId } = req.params as { threadId: string; messageId: string };
    const found = await seat(parsed.data.personaId, threadId);
    if (!found) return reply.code(404).send({ error: "Thread not found" });
    const message = await readSlurpThreadMessage(app.db, threadId, messageId);
    if (!message) return reply.code(404).send({ error: "Message not found" });
    if (!slurpMessageRemovable(message))
      return reply.code(409).send({ error: "Tips, paid pictures and commissions stay in the thread." });
    await deleteSlurpMessages(app.db, threadId, [message.id]);
    return view(threadId, found.side);
  });

  /** The fan's side only: the Creator's answer is taken out and written again, like Get reply now. */
  app.post("/messages/threads/:threadId/regenerate", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId } = req.params as { threadId: string };
    const found = await seat(parsed.data.personaId, threadId);
    if (!found || found.side !== "viewer") return reply.code(404).send({ error: "Thread not found" });
    // Bubbles of this answer are still arriving: writing it again now would interleave the two.
    if (await createSlurpReplyQueueStorage(app.db).hasPending(threadId))
      return reply.code(409).send({ error: "They are still writing. Give it a moment." });
    const answer = slurpLastAnswer(await messages.listMessages(threadId, 40));
    if (!answer) return reply.code(409).send({ error: "There is no answer to write again." });
    await deleteSlurpMessages(app.db, threadId, answer);
    const triggerMessageId = await messages.latestViewerMessageId(threadId);
    const outcome = triggerMessageId
      ? await replyToSlurpMessage(app.db, { threadId, triggerMessageId, force: true })
      : ({ status: "busy" } as const);
    return {
      ...(await view(threadId, "viewer")),
      reply: outcome.status === "replied" ? maskForViewer(outcome.message) : null,
      replyStatus: outcome.status,
      typingMs: "pacing" in outcome ? outcome.pacing.typingMs : 0,
    };
  });
}
