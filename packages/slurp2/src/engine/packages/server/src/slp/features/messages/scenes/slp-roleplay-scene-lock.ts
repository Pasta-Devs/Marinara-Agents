/**
 * What a running scene locks (docs/SCENES.md), like a Conversation with a scene in progress: the
 * thread takes no new messages, and the Creator is busy everywhere else on Slurp until it ends.
 */
import type { FastifyInstance } from "fastify";
import type { DB } from "../../../../db/connection.js";
import { createSlurpMessagesStorage } from "../../../data/slp-storage.js";
import { reconcileSlpThreadScene } from "./slp-roleplay-scene-origin.js";

/** Routes that write into a fan's thread. While that thread is in a scene they answer 409. */
const SCENE_LOCKED_ROUTES = new Set([
  "/messages/send",
  "/messages/share-post",
  "/messages/tip",
  "/messages/commissions",
  "/messages/threads/:threadId/image",
  "/messages/threads/:threadId/image-upload",
  "/messages/threads/:threadId/viewer-image",
  "/messages/threads/:threadId/request",
  "/messages/threads/:threadId/force-reply",
  "/messages/threads/:threadId/request-reply",
  "/messages/threads/:threadId/requests/:requestId/action",
]);

/** One guard for every thread write, so a route added later is locked by naming it here. */
export function slpSceneLockHook(app: FastifyInstance) {
  const messages = createSlurpMessagesStorage(app.db);
  app.addHook("preHandler", async (req, reply) => {
    if (req.method !== "POST") return;
    const url = req.routeOptions.url ?? "";
    if (!SCENE_LOCKED_ROUTES.has(url.slice(url.indexOf("/messages/")))) return;
    const params = (req.params ?? {}) as { threadId?: unknown };
    const body = (req.body ?? {}) as { personaId?: unknown; creatorAccountId?: unknown };
    const thread =
      typeof params.threadId === "string"
        ? await messages.getThreadById(params.threadId)
        : typeof body.personaId === "string" && typeof body.creatorAccountId === "string"
          ? await messages.getThread(body.personaId, body.creatorAccountId)
          : null;
    if (thread?.sceneChatId && (await reconcileSlpThreadScene(app.db, thread)))
      return reply.code(409).send({ error: "You are in a scene together. Finish it first.", inScene: true });
  });
}

/**
 * Whether this Creator is in a running scene with anyone. Busy Creators do not post, reply or start
 * conversations; their work waits until the scene ends.
 */
export async function slurpCreatorInScene(db: DB, creatorAccountId: string): Promise<boolean> {
  const threads = await createSlurpMessagesStorage(db).listCreatorSceneThreads(creatorAccountId);
  for (const thread of threads) if (await reconcileSlpThreadScene(db, thread)) return true;
  return false;
}

/** Every Creator in a running locking scene, for the passes that skip busy Creators (posting, fans). */
export async function slpCreatorsInScene(db: DB): Promise<Set<string>> {
  const busy = new Set<string>();
  for (const thread of await createSlurpMessagesStorage(db).listSceneThreads()) {
    if (await reconcileSlpThreadScene(db, thread)) busy.add(thread.creatorAccountId);
  }
  return busy;
}
