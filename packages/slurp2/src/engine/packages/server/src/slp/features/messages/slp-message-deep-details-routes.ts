import type { FastifyInstance } from "fastify";
import type {
  SlpMessageDeepDetailsRecord,
  SlpMessageDeepDetailsResponse,
} from "../../../../../shared/src/slp/slp-deep-details.js";
import { getSlurpMessageDeepDetails } from "../../data/messages/slp-message-deep-details-storage.js";
import { slpDeepDetailsSeatView } from "../../modules/messages/slp-deep-details-mask.js";
import { personaQuerySchema } from "../../modules/messages/slp-messages-schemas.js";
import type { SlpMessagesContext } from "./slp-messages-context.js";

/**
 * Everything behind one generated Creator reply, for the Message menu's Deep details: the recorded
 * prompt, the model, its raw answer and the chat facts the reply was built from.
 *
 * The record holds the full prompt, source card and private notes included. Only a persona with a
 * seat in the thread reads it, and it never rides along with the message itself.
 */
export async function slpMessageDeepDetailsRoutes(app: FastifyInstance, messaging: SlpMessagesContext) {
  const { messages, slurp, requireViewer, seatIn } = messaging;
  app.get("/slurp/messages/:messageId/deep-details", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { messageId } = req.params as { messageId: string };
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const message = await messages.getMessageById(messageId);
    const thread = message ? await messages.getThreadById(message.threadId) : null;
    // A reply bubble only: a paid message or a locked post card must not show its text through here.
    if (!message || message.role !== "creator" || message.kind !== "text" || !thread)
      return reply.code(404).send({ error: "Message not found" });
    const seat = await seatIn(viewer.id, thread);
    if (!seat) return reply.code(404).send({ error: "Message not found" });
    const creator = await slurp.getNoodlerAccountById(thread.creatorAccountId);
    if (!creator) return reply.code(404).send({ error: "Message not found" });
    const kept = await getSlurpMessageDeepDetails(app.db, message.id);
    const response: SlpMessageDeepDetailsResponse = {
      message: { id: message.id, content: message.content, createdAt: message.createdAt },
      creator: { id: creator.id, displayName: creator.displayName, handle: creator.handle },
      // A record is only ever read through the thread it was written in.
      details: kept?.threadId === thread.id ? slpDeepDetailsSeatView(kept.record, seat) : null,
    };
    return response;
  });
}
