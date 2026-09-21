import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { promoteSlurpContinuityFact, SLURP_PROMOTION_TARGETS } from "../../data/continuity/slp-continuity-storage.js";

/** Creator continuity, as the player manages it. Every change here is explicit and auditable. */
export async function slpContinuityRoutes(app: FastifyInstance) {
  app.post("/continuity/facts/:id/promote", async (req, reply) => {
    const body = z
      .object({ audienceScope: z.enum(SLURP_PROMOTION_TARGETS) })
      .strict()
      .safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const { id } = req.params as { id: string };
    const result = await promoteSlurpContinuityFact(app.db, id, body.data.audienceScope);
    if (result === "not_found") return reply.code(404).send({ error: "Fact not found" });
    if (result === "not_promotable") return reply.code(409).send({ error: "This fact cannot be promoted there." });
    return result;
  });
}
