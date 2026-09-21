import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { personaQuerySchema } from "../../modules/messages/slp-messages-schemas.js";
import { SLURP_REQUEST_ACTIONS, SLURP_REQUEST_DELAY_MAX_HOURS } from "../../modules/messages/slp-request-actions.js";
import { SLURP_DEMAND_TOPIC_MAX } from "../../modules/feed/slp-demand.js";
import type { SlpMessagesContext } from "./slp-messages-context.js";
import { applySlurpRequestAction, listSlurpThreadRequests } from "./slp-request-action-service.js";

const requestActionSchema = personaQuerySchema
  .extend({
    action: z.enum(SLURP_REQUEST_ACTIONS),
    topic: z.string().trim().max(SLURP_DEMAND_TOPIC_MAX).optional(),
    dueInHours: z.number().int().min(1).max(SLURP_REQUEST_DELAY_MAX_HOURS).optional(),
  })
  .strict();

/**
 * Requests in a thread, and the Creator's answer to each. Only the side that owns the Creator may
 * read or answer them: a fan never sees how their request was filed.
 */
export async function slpMessagesRequestRoutes(app: FastifyInstance, messaging: SlpMessagesContext) {
  const { messages, ownsCreator, requireViewer } = messaging;
  const ownedThread = async (threadId: string, personaId: string) => {
    const viewer = await requireViewer(personaId);
    const thread = viewer ? await messages.getThreadById(threadId) : null;
    if (!viewer || !thread || !(await ownsCreator(viewer.id, thread.creatorAccountId))) return null;
    return thread;
  };

  app.get("/messages/threads/:threadId/requests", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId } = req.params as { threadId: string };
    const thread = await ownedThread(threadId, parsed.data.personaId);
    if (!thread) return reply.code(404).send({ error: "Thread not found" });
    return { requests: await listSlurpThreadRequests(app.db, thread.id) };
  });

  app.post("/messages/threads/:threadId/requests/:requestId/action", async (req, reply) => {
    const parsed = requestActionSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId, requestId } = req.params as { threadId: string; requestId: string };
    const thread = await ownedThread(threadId, parsed.data.personaId);
    if (!thread) return reply.code(404).send({ error: "Thread not found" });
    const result = await applySlurpRequestAction(app.db, {
      threadId: thread.id,
      creatorAccountId: thread.creatorAccountId,
      requestId,
      action: parsed.data.action,
      topic: parsed.data.topic,
      dueInHours: parsed.data.dueInHours,
    });
    if (result === "not_found") return reply.code(404).send({ error: "Request not found" });
    if (result === "already_answered") return reply.code(409).send({ error: "This request already has an answer." });
    if (result === "topic_required") return reply.code(400).send({ error: "Name the kind of request to count it." });
    return { requests: await listSlurpThreadRequests(app.db, thread.id) };
  });
}
