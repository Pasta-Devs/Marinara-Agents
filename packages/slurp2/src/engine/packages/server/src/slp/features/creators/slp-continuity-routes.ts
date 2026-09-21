import { z } from "zod";
import type { FastifyInstance } from "fastify";
import {
  createSlurpContinuityFact,
  editSlurpContinuityFact,
  listSlurpContinuityForEditor,
  moveSlurpContinuityStatus,
  promoteSlurpContinuityFact,
  reviewSlurpContinuityProposal,
  SLURP_PROMOTION_TARGETS,
} from "../../data/continuity/slp-continuity-storage.js";
import { listSlurpOpportunities } from "../../data/feed/slp-opportunity-storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { slurpContinuityIdentityOf, SLURP_CONTINUITY_TEXT_MAX } from "../../modules/continuity/slp-continuity-rules.js";
import { SLURP_AUDIENCE_SCOPES, SLURP_CONTINUITY_FACT_TYPES } from "../../../../../shared/src/slp/slp-continuity.js";

/** Creator continuity, as the player manages it. Every change here is explicit and auditable. */
export async function slpContinuityRoutes(app: FastifyInstance) {
  /** Everything for one Creator: facts, events, pending proposals, and the plans behind them. */
  app.get("/continuity/:creatorAccountId", async (req) => {
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    const [ledger, opportunities] = await Promise.all([
      listSlurpContinuityForEditor(app.db, creatorAccountId),
      listSlurpOpportunities(app.db, creatorAccountId, 25),
    ]);
    return { ...ledger, opportunities };
  });

  app.post("/continuity/:creatorAccountId/facts", async (req, reply) => {
    const body = z
      .object({
        factType: z.enum(SLURP_CONTINUITY_FACT_TYPES),
        text: z.string().trim().min(1).max(SLURP_CONTINUITY_TEXT_MAX),
        subject: z.string().trim().max(120).optional(),
        audienceScope: z.enum(SLURP_AUDIENCE_SCOPES).default("creator_private"),
      })
      .strict()
      .safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    const account = await createSlurpStorage(app.db).getNoodlerAccountById(creatorAccountId);
    const identity = account ? slurpContinuityIdentityOf(account) : null;
    if (!identity) return reply.code(404).send({ error: "Creator account not found" });
    const fact = await createSlurpContinuityFact(app.db, {
      ...identity,
      ...body.data,
      realityScope: "slurp",
      source: "user",
      contribution: "manual",
    });
    if (!fact) return reply.code(400).send({ error: "Write something for the note to say." });
    return fact;
  });

  app.patch("/continuity/facts/:id", async (req, reply) => {
    const body = z
      .object({
        text: z.string().trim().max(SLURP_CONTINUITY_TEXT_MAX).optional(),
        subject: z.string().trim().max(120).optional(),
        factType: z.enum(SLURP_CONTINUITY_FACT_TYPES).optional(),
        audienceScope: z.enum(SLURP_AUDIENCE_SCOPES).optional(),
      })
      .strict()
      .safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const { id } = req.params as { id: string };
    const fact = await editSlurpContinuityFact(app.db, id, body.data);
    if (!fact) return reply.code(404).send({ error: "Fact not found" });
    return fact;
  });

  /** Retract a record. It stays, marked, so what it produced can still be traced. */
  app.post("/continuity/:target/:id/retract", async (req, reply) => {
    const { target, id } = req.params as { target: string; id: string };
    if (target !== "facts" && target !== "events") return reply.code(404).send({ error: "Unknown record" });
    const moved = await moveSlurpContinuityStatus(app.db, target === "facts" ? "fact" : "event", id, "retracted");
    if (!moved) return reply.code(409).send({ error: "This record cannot be retracted." });
    return { retracted: true };
  });

  app.post("/continuity/proposals/:id/:decision", async (req, reply) => {
    const { id, decision } = req.params as { id: string; decision: string };
    if (decision !== "approve" && decision !== "reject") return reply.code(404).send({ error: "Unknown decision" });
    const result = await reviewSlurpContinuityProposal(app.db, id, decision);
    if (result === "not_found") return reply.code(404).send({ error: "Proposal not found" });
    if (result === "not_pending") return reply.code(409).send({ error: "This proposal was already reviewed." });
    return result === "rejected" ? { rejected: true } : result;
  });

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
