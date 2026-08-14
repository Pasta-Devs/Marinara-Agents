import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createNoodleStorage } from "../services/storage/noodle.storage.js";

const accountQuery = z.object({ accountId: z.string().trim().min(1) });

export async function noodleRoutes(app: FastifyInstance) {
  const noodle = createNoodleStorage(app.db);

  app.get("/", async () => noodle.bootstrap());
  app.get("/accounts", async () => noodle.listAccounts());
  app.get("/accounts/:id", async (request, reply) => {
    const account = await noodle.getAccountById((request.params as { id: string }).id);
    return account ?? reply.code(404).send({ error: "Noodle account not found" });
  });
  app.get("/viewer", async (request, reply) => {
    const parsed = accountQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "accountId is required" });
    return noodle.getAccountById(parsed.data.accountId);
  });
  app.get("/posts", async (request) =>
    noodle.listPosts(request.query as { limit?: number; since?: string }),
  );
  app.post("/posts", async (request, reply) => {
    const result = await noodle.createPost(request.body as Parameters<typeof noodle.createPost>[0]);
    return reply.code(201).send(result);
  });
  app.patch("/posts/:id", async (request, reply) => {
    const result = await noodle.updatePost(
      (request.params as { id: string }).id,
      request.body as Parameters<typeof noodle.updatePost>[1],
    );
    return result ?? reply.code(404).send({ error: "Post not found" });
  });
  app.delete("/posts/:id", async (request, reply) => {
    const result = await noodle.deletePost((request.params as { id: string }).id);
    return result ?? reply.code(404).send({ error: "Post not found" });
  });
  app.post("/posts/:id/interactions", async (request, reply) => {
    const result = await noodle.createInteraction(
      (request.params as { id: string }).id,
      request.body as Parameters<typeof noodle.createInteraction>[1],
    );
    return result ? reply.code(201).send(result) : reply.code(404).send({ error: "Post not found" });
  });
  app.delete("/posts/:id/interactions", async (request, reply) => {
    const result = await noodle.deleteInteraction(
      (request.params as { id: string }).id,
      request.body as Parameters<typeof noodle.deleteInteraction>[1],
    );
    return result ?? reply.code(404).send({ error: "Interaction not found" });
  });
  app.patch("/accounts/:id/follows/:targetAccountId", async (request) =>
    noodle.updateAccountFollow(
      (request.params as { id: string; targetAccountId: string }).id,
      (request.params as { id: string; targetAccountId: string }).targetAccountId,
      request.body as Parameters<typeof noodle.updateAccountFollow>[2],
    ),
  );
}
