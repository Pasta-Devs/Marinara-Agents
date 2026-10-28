import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { slpMessageDetailsSchema } from "../../../../../shared/src/slp/slp-message-details.js";
import type { SlpMessagesContext } from "./slp-messages-context.js";
import { SLURP_SUPPORT_ACCOUNT_ID } from "../../../../../shared/src/slp/slp-support.js";

export async function slpMessageDetailsRoutes(app: FastifyInstance, messaging: SlpMessagesContext) {
  const { messages, slurp, requireViewer, ownsCreator } = messaging;
  app.patch("/messages/threads/:threadId/details", async (req, reply) => {
    const parsed = slpMessageDetailsSchema.extend({ personaId: z.string().trim().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId } = req.params as { threadId: string };
    const { personaId, ...patch } = parsed.data;
    const viewer = await requireViewer(personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const thread = await messages.getThreadById(threadId);
    // Slurp Support's threads are the player's from every persona (`slp-support.ts`).
    const viewerSide = thread?.viewerAccountId === viewer.id || thread?.viewerAccountId === SLURP_SUPPORT_ACCOUNT_ID;
    if (!thread || (!viewerSide && !(await ownsCreator(viewer.id, thread.creatorAccountId))))
      return reply.code(404).send({ error: "Thread not found" });
    await messages.setThreadDetails(threadId, patch);
    await messages.saveDetailsOverrides(threadId, patch);
    if (patch.creatorState) await slurp.setCreatorDetails(thread.creatorAccountId, patch.creatorState);
    return { saved: true };
  });
}
