import { slpMessageDetailsRoutes } from "./slp-message-details-routes.js";
import type { FastifyInstance } from "fastify";
import { slpCommissionsRoutes } from "./commissions/slp-commissions-routes.js";
import { createSlpMessagesContext } from "./slp-messages-context.js";
import { slpMessagesCreatorRoutes } from "./slp-messages-creator-routes.js";
import { slpMessagesMediaRoutes } from "./slp-messages-media-routes.js";
import { slpMessagesSendRoutes } from "./slp-messages-send-routes.js";
import { slpMessagesThreadRoutes } from "./slp-messages-thread-routes.js";
import { slpMessagesRequestRoutes } from "./slp-messages-request-routes.js";
import { slpDeskRoutes } from "./desk/slp-desk-routes.js";
import { slpRoleplaySceneRoutes } from "./scenes/slp-roleplay-scene-routes.js";
import { slpSceneLockHook } from "./scenes/slp-roleplay-scene-lock.js";

/** Mounts every direct-message route against one shared messages context. */
export async function slpMessagesRoutes(
  app: FastifyInstance,
  dependencies: Parameters<typeof createSlpMessagesContext>[1],
  messages: Parameters<typeof createSlpMessagesContext>[2],
) {
  const messaging = createSlpMessagesContext(app, dependencies, messages);
  // Before the routes it guards, so every thread write below is locked during a scene.
  slpSceneLockHook(app);
  await slpMessagesThreadRoutes(app, messaging);
  await slpRoleplaySceneRoutes(app, messaging);
  await slpMessageDetailsRoutes(app, messaging);
  await slpMessagesSendRoutes(app, messaging);
  await slpMessagesCreatorRoutes(app, messaging);
  await slpCommissionsRoutes(app, messaging);
  await slpMessagesMediaRoutes(app, messaging);
  await slpMessagesRequestRoutes(app, messaging);
  await slpDeskRoutes(app, messaging);
}
