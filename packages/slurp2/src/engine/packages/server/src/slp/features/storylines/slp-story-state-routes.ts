import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { slpStoryConditionInputSchema, slpStoryFactSchema } from "../../../../../shared/src/slp/slp-story-engine.js";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { loadSlurpStoryState } from "./slp-story-state-service.js";

/** The Life panel (docs/STORYLINES.md, "State"): a Creator's conditions and what reaches the prompts. */
export async function slpStoryStateRoutes(app: FastifyInstance, { noodle }: SlpRouteDeps) {
  app.get("/story/state/:accountId", async (req, reply) => {
    const { accountId } = req.params as { accountId: string };
    if (!(await noodle.getNoodlerAccountById(accountId))) return reply.code(404).send({ error: "Creator not found." });
    const now = Date.now();
    const facts = (await noodle.listStoryFacts()).filter(
      (fact) =>
        fact.scope === "creator" &&
        fact.creatorId === accountId &&
        (!fact.expiresAt || Date.parse(fact.expiresAt) > now),
    );
    return { facts, state: (await loadSlurpStoryState(app.db, accountId, new Date(now))).state };
  });
  app.post("/story/state/:accountId", async (req, reply) => {
    const { accountId } = req.params as { accountId: string };
    if (!slpExtensionOn(await noodle.getSettings(), "storylines"))
      return reply.code(409).send({ error: "Storylines is switched off in Backstage." });
    const body = slpStoryConditionInputSchema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    if (!(await noodle.getNoodlerAccountById(accountId))) return reply.code(404).send({ error: "Creator not found." });
    const { days, tag, ...condition } = body.data;
    const at = new Date();
    // Checked as stored: the store drops a fact it cannot read, and the put has already freed the track.
    const fact = slpStoryFactSchema.safeParse({
      ...condition,
      id: `player:${randomUUID()}`,
      scope: "creator",
      creatorId: accountId,
      tag:
        tag ??
        (condition.label
          .toLocaleLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, "-")
          .slice(0, 64)
          .replace(/^-|-$/g, "") ||
          condition.track),
      sourceKind: "player",
      sourceId: "life-panel",
      createdAt: at.toISOString(),
      expiresAt: days ? new Date(at.getTime() + days * 86_400_000).toISOString() : null,
    });
    if (!fact.success) return reply.code(400).send({ error: fact.error.flatten() });
    await noodle.putStoryCondition(fact.data);
    return { fact: fact.data };
  });
}
