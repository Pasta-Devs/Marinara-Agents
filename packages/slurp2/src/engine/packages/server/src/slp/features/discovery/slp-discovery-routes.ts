import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { slurpDiscoveryTagNameSchema } from "../../base/host/slp-request-schemas.js";
import type { SlpRouteDeps } from "../../base/host/slp-viewer-context.js";

export async function slpDiscoveryRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { noodle } = deps;
  app.get("/discovery-tags/usage", async () => noodle.countDiscoveryTagUsage());
  app.post("/discovery-tags/rename", async (req, reply) => {
    const body = z.object({ from: slurpDiscoveryTagNameSchema, to: slurpDiscoveryTagNameSchema }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    return noodle.replaceDiscoveryTag(body.data.from, body.data.to);
  });
  app.post("/discovery-tags/delete", async (req, reply) => {
    const body = z.object({ tag: slurpDiscoveryTagNameSchema }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    return noodle.replaceDiscoveryTag(body.data.tag, null);
  });

  app.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      search?: string;
      kind?: string;
      includeAccountId?: string;
    };
  }>("/noodler/eligible-accounts", async (req, reply) => {
    const [publicAccounts, noodlerAccounts] = await Promise.all([
      noodle.listEligibleSources(),
      noodle.listNoodlerAccounts(),
    ]);
    const linkedIds = new Set(noodlerAccounts.map((account) => `${account.sourceKind}:${account.sourceEntityId}`));
    const search = (req.query.search ?? "").trim().toLocaleLowerCase();
    const kind = req.query.kind === "character" || req.query.kind === "persona" ? req.query.kind : null;
    const eligibleAccounts = publicAccounts.filter(
      (account) =>
        (account.kind === "persona" || account.kind === "character") &&
        (!kind || account.kind === kind) &&
        (!linkedIds.has(`${account.kind}:${account.entityId}`) || account.id === req.query.includeAccountId),
    );
    const filteredAccounts = search
      ? eligibleAccounts.filter((account) =>
          `${account.displayName} ${account.handle} ${account.bio}`.toLocaleLowerCase().includes(search),
        )
      : eligibleAccounts;
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    return {
      items: filteredAccounts.slice(offset, offset + limit),
      limit,
      offset,
      hasMore: offset + limit < filteredAccounts.length,
    };
  });
}
