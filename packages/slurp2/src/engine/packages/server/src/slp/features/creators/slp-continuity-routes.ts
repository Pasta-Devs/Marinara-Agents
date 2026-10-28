import { z } from "zod";
import type { FastifyInstance } from "fastify";
import {
  createSlurpContinuityFact,
  editSlurpContinuityFact,
  findSlurpContinuityFactBySourceHash,
  listSlurpContinuityForEditor,
  listSlurpContinuityLinks,
  moveSlurpContinuityStatus,
  promoteSlurpContinuityFact,
  reviewSlurpContinuityProposal,
  SLURP_PROMOTION_TARGETS,
} from "../../data/continuity/slp-continuity-storage.js";
import { listSlurpOpportunities } from "../../data/feed/slp-opportunity-storage.js";
import { listSlurpSignals } from "./slp-signals-service.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import {
  slurpChatMomentKey,
  slurpContinuityIdentityOf,
  SLURP_CONTINUITY_TEXT_MAX,
} from "../../modules/continuity/slp-continuity-rules.js";
import {
  SLURP_AUDIENCE_SCOPES,
  SLURP_CONTINUITY_FACT_TYPES,
  SLURP_CONTINUITY_SOURCES,
  SLURP_CONTINUITY_STATUSES,
} from "../../../../../shared/src/slp/slp-continuity.js";

const editorFilterSchema = z.object({
  type: z.string().optional(),
  source: z.enum(SLURP_CONTINUITY_SOURCES).optional(),
  scope: z.enum(SLURP_AUDIENCE_SCOPES).optional(),
  status: z.enum(SLURP_CONTINUITY_STATUSES).optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

function filterLedger<T extends { source: string; audienceScope: string; status: string; confidence: number }>(
  rows: T[],
  filters: z.infer<typeof editorFilterSchema>,
  typeOf: (row: T) => string,
  dateOf: (row: T) => string,
) {
  return rows.filter(
    (row) =>
      (!filters.type || typeOf(row) === filters.type) &&
      (!filters.source || row.source === filters.source) &&
      (!filters.scope || row.audienceScope === filters.scope) &&
      (!filters.status || row.status === filters.status) &&
      (filters.minConfidence === undefined || row.confidence >= filters.minConfidence) &&
      (!filters.from || dateOf(row) >= filters.from) &&
      (!filters.to || dateOf(row) <= filters.to),
  );
}

/** Creator continuity, as the player manages it. Every change here is explicit and auditable. */
export async function slpContinuityRoutes(app: FastifyInstance) {
  /** Everything for one Creator: facts, events, pending proposals, and the plans behind them. */
  app.get("/continuity/:creatorAccountId", async (req, reply) => {
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    const filters = editorFilterSchema.safeParse(req.query ?? {});
    if (!filters.success) return reply.code(400).send({ error: filters.error.flatten() });
    const [ledger, opportunities, links] = await Promise.all([
      listSlurpContinuityForEditor(app.db, creatorAccountId),
      listSlurpOpportunities(app.db, creatorAccountId, 25),
      listSlurpContinuityLinks(app.db, creatorAccountId),
    ]);
    return {
      ...ledger,
      facts: filterLedger(
        ledger.facts,
        filters.data,
        (row) => row.factType,
        (row) => row.updatedAt,
      ),
      events: filterLedger(
        ledger.events,
        filters.data,
        (row) => row.eventType,
        (row) => row.occurredAt,
      ),
      opportunities,
      links,
    };
  });

  /** Cross-Creator Backstage view. Payloads stay scoped; this is the owner-only management route. */
  app.get("/continuity", async () => {
    const accounts = await createSlurpStorage(app.db).listNoodlerAccounts();
    return Promise.all(
      accounts.map(async (account) => ({
        creator: { id: account.id, displayName: account.displayName, handle: account.handle },
        ...(await listSlurpContinuityForEditor(app.db, account.id)),
      })),
    );
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

  /**
   * "Save to Slurp" from an Engine chat. A chat knows its character, not the Slurp account, so this
   * finds every Creator page that character runs and stores the moment on each. Saving is the
   * player's explicit choice, so the note is active at once, but it stays with the Creator
   * (creator_private) until the player promotes it. Saving the same message again stores nothing new.
   */
  app.post("/continuity/from-chat", async (req, reply) => {
    const body = z
      .object({
        characterId: z.string().trim().min(1).max(128),
        chatId: z.string().trim().min(1).max(128),
        messageId: z.string().trim().max(128).optional(),
        text: z.string().trim().min(1).max(SLURP_CONTINUITY_TEXT_MAX),
        factType: z.enum(SLURP_CONTINUITY_FACT_TYPES).default("circumstance"),
        subject: z.string().trim().max(120).optional(),
      })
      .strict()
      .safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const { characterId, chatId, messageId, text, factType, subject } = body.data;
    const accounts = (await createSlurpStorage(app.db).listNoodlerAccounts()).filter(
      (account) => account.sourceKind === "character" && account.sourceEntityId === characterId,
    );
    if (accounts.length === 0) return reply.code(404).send({ error: "This character has no Slurp page." });
    const sourceHash = slurpChatMomentKey(chatId, messageId, text);
    const saved = [];
    for (const account of accounts) {
      const identity = slurpContinuityIdentityOf(account);
      if (!identity) continue;
      const existing = await findSlurpContinuityFactBySourceHash(app.db, account.id, sourceHash);
      const fact =
        existing ??
        (await createSlurpContinuityFact(app.db, {
          ...identity,
          factType,
          subject,
          text,
          audienceScope: "creator_private",
          realityScope: "slurp",
          source: "chat",
          evidence: `chat ${chatId}${messageId ? ` message ${messageId}` : ""}`,
          sourceHash,
          contribution: "manual",
        }));
      if (fact) saved.push({ creatorAccountId: account.id, fact, created: !existing });
    }
    return { saved };
  });

  /** A Creator's recent signals, newest first, for the Backstage view. Owner-only like the editor. */
  app.get("/continuity/:creatorAccountId/signals", async (req, reply) => {
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    const signals = await listSlurpSignals(app.db, creatorAccountId);
    if (!signals) return reply.code(404).send({ error: "Creator account not found" });
    return { signals };
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
    if (result === "stale")
      return reply.code(409).send({ error: "The source messages changed. Extract this thread again." });
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
