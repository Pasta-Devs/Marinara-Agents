/**
 * Roleplay scenes from a DM thread (docs/SCENES.md): plan one, change how far a recap travels,
 * decline an invite. Starting the scene is the Engine's `startScene`; the lock is its claim.
 */
import type { FastifyInstance } from "fastify";
import {
  readSlpSceneLine,
  slpScenePlanRequestSchema,
  slpSceneReachRequestSchema,
} from "../../../../../../shared/src/slp/slp-roleplay-scene.js";
import { logger } from "../../../../lib/logger.js";
import { createConnectionsStorage } from "../../../../services/storage/connections.storage.js";
import { resolveSlurpTextConnection } from "../../../base/identity/slp-connection.js";
import { getErrorMessage } from "../../../modules/creators/slp-public-support.js";
import { personaQuerySchema } from "../../../modules/messages/slp-messages-schemas.js";
import type { SlpMessagesContext } from "../slp-messages-context.js";
import { writeSlpSceneFact } from "./slp-roleplay-scene-origin.js";
import { planSlpRoleplayScene, SlpScenePlanRefusal } from "./slp-roleplay-scene-planner.js";

export async function slpRoleplaySceneRoutes(app: FastifyInstance, messaging: SlpMessagesContext) {
  const { messages, requireViewer, slurp } = messaging;
  const connections = createConnectionsStorage(app.db);

  /** The thread, when this persona is its fan side. Scenes are only ever the player's own. */
  const fanThread = async (personaId: string, threadId: string) => {
    const viewer = await requireViewer(personaId);
    const thread = viewer ? await messages.getThreadById(threadId) : null;
    return viewer && thread && thread.viewerAccountId === viewer.id ? { viewer, thread } : null;
  };

  app.post("/messages/threads/:threadId/scene/plan", async (req, reply) => {
    const parsed = slpScenePlanRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId } = req.params as { threadId: string };
    const found = await fanThread(parsed.data.personaId, threadId);
    if (!found) return reply.code(404).send({ error: "Thread not found" });
    const settings = await slurp.getSettings();
    const connection = await resolveSlurpTextConnection(connections, settings.generationConnectionId);
    if (!connection) return reply.code(404).send({ error: "Slurp generation connection not found" });
    try {
      return await planSlpRoleplayScene(app.db, {
        threadId: found.thread.id,
        viewer: found.viewer,
        idea: parsed.data.idea,
        inviteMessageId: parsed.data.inviteMessageId,
        connection,
      });
    } catch (error) {
      if (error instanceof SlpScenePlanRefusal) return reply.code(error.status).send({ error: error.message });
      logger.error(error, "[slurp] Scene plan failed using %s", connection.model || connection.provider);
      return reply.code(500).send({ error: getErrorMessage(error) });
    }
  });

  // Where a scene came back to: the Engine knows only the thread id, Slurp opens it for its persona.
  app.get("/messages/threads/:threadId/scene/origin", async (req, reply) => {
    const { threadId } = req.params as { threadId: string };
    const thread = await messages.getThreadById(threadId);
    const viewer = thread ? await requireViewer(thread.viewerAccountId) : null;
    if (!thread || !viewer) return reply.code(404).send({ error: "Thread not found" });
    return { personaId: viewer.id, creatorAccountId: thread.creatorAccountId };
  });

  // The reach a recap travels at, changed on the recap itself. The fact is rewritten, never stacked.
  app.post("/messages/threads/:threadId/scene/recap/:messageId/reach", async (req, reply) => {
    const parsed = slpSceneReachRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId, messageId } = req.params as { threadId: string; messageId: string };
    const found = await fanThread(parsed.data.personaId, threadId);
    const message = found ? await messages.getMessageById(messageId) : null;
    const line = message?.threadId === threadId ? readSlpSceneLine(message.metadata) : null;
    if (!found || !message || line?.kind !== "recap") return reply.code(404).send({ error: "Recap not found" });
    const scene = { ...line, reach: parsed.data.reach };
    await messages.setSceneLine(message.id, scene);
    await writeSlpSceneFact(app.db, {
      creatorAccountId: found.thread.creatorAccountId,
      threadId: found.thread.id,
      sceneChatId: line.sceneChatId,
      title: line.title,
      summary: line.summary,
      reach: parsed.data.reach,
    });
    return { scene };
  });

  // An invite answered no. Accepting is starting the scene, which marks it accepted when it is claimed.
  app.post("/messages/threads/:threadId/scene/invite/:messageId/decline", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId, messageId } = req.params as { threadId: string; messageId: string };
    const found = await fanThread(parsed.data.personaId, threadId);
    const message = found ? await messages.getMessageById(messageId) : null;
    const line = message?.threadId === threadId ? readSlpSceneLine(message.metadata) : null;
    if (!found || !message || line?.kind !== "invite") return reply.code(404).send({ error: "Invite not found" });
    if (line.state !== "open") return { scene: line };
    const scene = { ...line, state: "declined" as const };
    await messages.setSceneLine(message.id, scene);
    return { scene };
  });
}
