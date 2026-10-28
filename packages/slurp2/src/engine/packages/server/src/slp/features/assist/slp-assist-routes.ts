import type { FastifyInstance } from "fastify";
import { logger } from "../../../lib/logger.js";
import { getErrorMessage } from "../../modules/creators/slp-public-support.js";
import { slpActionCatalog } from "../../../../../shared/src/slp/slp-actions.js";
import { runSlpAction } from "./slp-action-runner.js";

/**
 * The action layer over HTTP: `GET /slurp/actions` lists what Slurp can do for the player,
 * `POST /slurp/actions/:name` does one thing. The app's AI assist uses these routes.
 */
export async function slpAssistRoutes(app: FastifyInstance) {
  app.get("/slurp/actions", async () => ({ actions: slpActionCatalog() }));

  app.post("/slurp/actions/:name", async (req, reply) => {
    const { name } = req.params as { name: string };
    try {
      const outcome = await runSlpAction(app.db, name, req.body);
      return outcome.ok ? outcome.value : reply.code(outcome.status).send({ error: outcome.error });
    } catch (error) {
      logger.warn(error, "[slurp] Action %s failed", name);
      return reply.code(502).send({ error: getErrorMessage(error) });
    }
  });
}
