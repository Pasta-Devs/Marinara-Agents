import { slpCreatorViewerPersonaSchema } from "../../../../../shared/src/slp/slp-social.schema.js";
import { createSlurpEventsStorage } from "../../data/notifications/slp-notification-storage.js";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { readSlpNotifications } from "./slp-notification-read-model.js";

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

  app.post("/slurp/notifications/seen", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    await createSlurpEventsStorage(app.db).markSeen(viewer.id);
    return { ok: true };
  });
}
