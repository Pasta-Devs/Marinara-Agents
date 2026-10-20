import type { FastifyInstance } from "fastify";
import { slpSceneKeepRequestSchema, slpSceneTurnRequestSchema } from "../../../../../shared/src/slp/slp-scene.js";
import { logger } from "../../../lib/logger.js";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import { slpUnreachableCode } from "../../base/model/slp-provider-retry.js";
import { getErrorMessage } from "../../modules/creators/slp-public-support.js";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { keepSlpSceneTranscript } from "./slp-scene-keep-service.js";
import { generateSlpSceneTurn } from "./slp-scene-turn-service.js";

/** The role-play Creator sign-up. */
export async function slpSceneRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { connections, noodle, resolveViewerPersona } = deps;
  app.post("/slurp/onboarding/scene/turn", async (req, reply) => {
    const parsed = slpSceneTurnRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const settings = await noodle.getSettings();
    const connection = await resolveSlurpTextConnection(
      connections,
      parsed.data.connectionId ?? settings.generationConnectionId,
    );
    if (!connection) return reply.code(404).send({ error: "Slurp generation connection not found" });
    try {
      return await generateSlpSceneTurn(app.db, { request: parsed.data, connection });
    } catch (error) {
      logger.error(error, "[slurp] Sign-up scene turn failed using %s", connection.model || connection.provider);
      // The sign-up shows this line with Retry, so say what to do, not the raw socket error.
      const unreachable = slpUnreachableCode(error);
      if (unreachable)
        return reply.code(502).send({
          error: `Slurp could not reach the connection "${connection.name || connection.model}" (${unreachable}). Start that model, or choose another generation connection, then press Retry.`,
        });
      return reply.code(500).send({ error: getErrorMessage(error) });
    }
  });

  // After "Finish registration": the chat stays as the Creator's first DM thread.
  app.post("/slurp/onboarding/scene/keep", async (req, reply) => {
    const parsed = slpSceneKeepRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await resolveViewerPersona(parsed.data.viewerPersonaId)))
      return reply.code(404).send({ error: "Persona not found" });
    const kept = await keepSlpSceneTranscript(app.db, parsed.data);
    if (kept.status === "missing") return reply.code(404).send({ error: "Creator profile not found" });
    return kept;
  });
}
