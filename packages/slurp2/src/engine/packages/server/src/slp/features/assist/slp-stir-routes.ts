import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { logger } from "../../../lib/logger.js";
import { getErrorMessage } from "../../modules/creators/slp-public-support.js";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { previewSlpAction } from "./slp-action-preview.js";
import { planSlpStir, playSlpStir, previewSlpStirSteps, readSlpStirView, undoSlpStirPlay } from "./slp-stir-service.js";
import {
  SLP_STIR_STEPS_MAX,
  slpStirPlanRequestSchema,
  slpStirPlaySchema,
  slpStirStepSchema,
} from "../../../../../shared/src/slp/slp-stir.js";
import { createSlurpMessagesStorage } from "../../data/slp-storage.js";
import { slpSupportPlayOnce } from "../../modules/assist/slp-stir-play.js";

/**
 * Stir (W) over HTTP: preview one action or a list of steps, turn words into a plan, do a play,
 * undo it, and the Stir tab's view. Every play runs through the action layer's one runner.
 */
export async function slpStirRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { resolveViewerPersona, creatorBelongsToViewer } = deps;
  const markSupportPlayed = async (messageId: string, playId: string) => {
    const storage = createSlurpMessagesStorage(app.db);
    const message = await storage.getMessageById(messageId);
    const proposal = message?.metadata?.stirProposal;
    if (proposal && typeof proposal === "object")
      await storage.mergeMessageMetadata(messageId, { stirProposal: { ...proposal, playId } });
  };
  const supportPlayed = async (messageId: string) => {
    const proposal = (await createSlurpMessagesStorage(app.db).getMessageById(messageId))?.metadata?.stirProposal;
    return Boolean(proposal && typeof proposal === "object" && (proposal as { playId?: unknown }).playId);
  };
  const supportOnce = slpSupportPlayOnce();
  const guard = async <T>(
    label: string,
    reply: { code: (code: number) => { send: (value: unknown) => unknown } },
    run: () => Promise<T>,
  ) => {
    try {
      return await run();
    } catch (error) {
      logger.warn(error, "[slurp] Stir %s failed", label);
      return reply.code(502).send({ error: getErrorMessage(error) });
    }
  };

  app.post("/slurp/actions/:name/preview", async (req, reply) => {
    const { name } = req.params as { name: string };
    return guard("preview", reply, async () => {
      const outcome = await previewSlpAction(app.db, name, req.body);
      return outcome.ok ? outcome.value : reply.code(outcome.status).send({ error: outcome.error });
    });
  });

  app.post("/slurp/stir/preview", async (req, reply) => {
    const parsed = z
      .object({ steps: z.array(slpStirStepSchema).min(1).max(SLP_STIR_STEPS_MAX) })
      .strict()
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return guard("preview", reply, () => previewSlpStirSteps(app.db, parsed.data.steps));
  });

  app.post("/slurp/stir/plan", async (req, reply) => {
    const parsed = slpStirPlanRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return guard("plan", reply, async () => {
      const outcome = await planSlpStir(app.db, parsed.data);
      return outcome.ok ? outcome.value : reply.code(outcome.status).send({ error: outcome.error });
    });
  });

  app.post("/slurp/stir/play", async (req, reply) => {
    const parsed = slpStirPlaySchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return guard("play", reply, async () => {
      const { supportMessageId } = parsed.data;
      const answer = await supportOnce(supportMessageId, supportPlayed, async () => {
        const answer = await playSlpStir(app.db, parsed.data);
        // A Support thread's plan shows as played, so its cards do not offer "Do it" again.
        if (supportMessageId)
          await markSupportPlayed(supportMessageId, answer.play.id).catch((error: unknown) =>
            logger.warn(error, "[slurp] Could not mark the Support plan as played"),
          );
        return answer;
      });
      return answer ?? reply.code(409).send({ error: "This plan is already in play." });
    });
  });

  app.post("/slurp/stir/plays/:id/undo", async (req, reply) =>
    guard("undo", reply, async () => {
      const outcome = await undoSlpStirPlay(app.db, (req.params as { id: string }).id);
      return outcome.ok ? { play: outcome.value } : reply.code(outcome.status).send({ error: outcome.error });
    }),
  );

  app.get("/slurp/stir", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.query ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    return guard("view", reply, () =>
      readSlpStirView(app.db, (account) => creatorBelongsToViewer(account as never, viewer)),
    );
  });
}
