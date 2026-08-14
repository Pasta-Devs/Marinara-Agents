import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createSlurpStorage } from "../services/storage/slurp.storage.js";

const creatorSchema = z.object({
  sourceKind: z.enum(["character", "persona"]),
  sourceEntityId: z.string().trim().min(1),
});

export const slurpRoutes: FastifyPluginAsync = async (router) => {
  const app = router as FastifyInstance & { db: Parameters<typeof createSlurpStorage>[0] };
  const storage = createSlurpStorage(app.db);
  router.get("/", async () => storage.bootstrap());
  router.get("/viewer", async (request, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "personaId is required" });
    return storage.getViewer(parsed.data.personaId);
  });
  router.post("/creators", async (request, reply) => {
    const parsed = creatorSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid Slurp source" });
    try {
      return reply.code(201).send(await storage.createCreator(parsed.data));
    } catch (error) {
      return reply.code(409).send({ error: error instanceof Error ? error.message : "Creator exists" });
    }
  });
};
