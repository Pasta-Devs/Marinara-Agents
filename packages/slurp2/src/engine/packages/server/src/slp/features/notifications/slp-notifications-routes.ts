import { slpCreatorViewerPersonaSchema } from "../../../../../shared/src/slp/slp-social.schema.js";
import { createSlurpEventsStorage } from "../../data/notifications/slp-notification-storage.js";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { readSlpNotifications } from "./slp-notification-read-model.js";
import { markSlurpPlayerPresent } from "../world/slp-world-contract.js";
import { answerSlurpFanNote, readSlurpFanNoteAnswers } from "../../data/notifications/slp-fan-note-storage.js";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";

/**
 * Opening the notification stream first lets the world catch up; the server entry supplies that
 * step from the world-tick workflow, because a feature may not import a workflow.
 */
export async function slpNotificationsRoutes(
  app: FastifyInstance,
  deps: SlpRouteDeps,
  catchUpWorld: (app: FastifyInstance) => Promise<void>,
) {
  const { noodle, messages, resolveViewerPersona } = deps;
  app.get("/slurp/notifications/unseen-count", async (req, reply) => {
    const parsed = slpCreatorViewerPersonaSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    // Only a timestamp: the world clock sees the player is here and runs its regular pass (R1-106).
    markSlurpPlayerPresent();
    return { unseenCount: await createSlurpEventsStorage(app.db).countUnseen(viewer.id) };
  });
  /**
   * The notification stream, and what happened while you were away.
   *
   * One table, two presentations: `items` is the full list, `unseen` is what to show on open.
   * Grouping keeps a busy day to a readable handful instead of a wall.
   */
  app.get("/slurp/notifications", async (req, reply) => {
    const parsed = slpCreatorViewerPersonaSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    await catchUpWorld(app);
    return readSlpNotifications(app.db, noodle, messages, viewer.id);
  });

  /** A fan's note to the player's page: heart it, or reply once (never a chat). */
  app.post("/slurp/notifications/:id/fan-note", async (req, reply) => {
    const parsed = z
      .object({
        personaId: z.string().trim().min(1),
        heart: z.literal(true).optional(),
        reply: z.string().trim().min(1).max(280).optional(),
      })
      .strict()
      .refine((body) => body.heart || body.reply, { message: "heart or reply" })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const event = await createSlurpEventsStorage(app.db).get(viewer.id, String((req.params as { id: string }).id));
    if (!event || event.kind !== "fan_note") return reply.code(404).send({ error: "Note not found" });
    const before = (await readSlurpFanNoteAnswers(app.db, [event.id])).get(event.id);
    const answer = await answerSlurpFanNote(app.db, event.id, { heart: parsed.data.heart, reply: parsed.data.reply });
    if (answer === "replied") return reply.code(409).send({ error: "You already replied to this note." });
    const changed = answer.hearted !== Boolean(before?.hearted) || answer.reply !== (before?.reply ?? null);
    // The fan felt seen: a new heart or the reply warms them up to the page, once each.
    if (changed && event.subjectId && event.creatorAccountId)
      await createSlurpPopulationStorage(app.db)
        .advanceTie(event.subjectId, event.creatorAccountId, { stage: "viewer", interactions: 1 })
        .catch(() => undefined);
    return { answer };
  });

  app.post("/slurp/notifications/seen", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    await createSlurpEventsStorage(app.db).markSeen(viewer.id);
    return { ok: true };
  });
}
