import type { FastifyInstance } from "fastify";
import { slpCommissionsRoutes } from "./commissions/slp-commissions-routes.js";
import { createSlpMessagesContext } from "./slp-messages-context.js";
import { slpMessagesCreatorRoutes } from "./slp-messages-creator-routes.js";
import { slpMessagesMediaRoutes } from "./slp-messages-media-routes.js";
import { slpMessagesSendRoutes } from "./slp-messages-send-routes.js";
import { slpMessagesThreadRoutes } from "./slp-messages-thread-routes.js";

/** Mounts every direct-message route against one shared messages context. */
export async function slpMessagesRoutes(
  app: FastifyInstance,
  dependencies: Parameters<typeof createSlpMessagesContext>[1],
  messages: Parameters<typeof createSlpMessagesContext>[2],
) {
  const messaging = createSlpMessagesContext(app, dependencies, messages);
  await slpMessagesThreadRoutes(app, messaging);
  await slpMessagesSendRoutes(app, messaging);
  await slpMessagesCreatorRoutes(app, messaging);
  await slpCommissionsRoutes(app, messaging);
  await slpMessagesMediaRoutes(app, messaging);
}
