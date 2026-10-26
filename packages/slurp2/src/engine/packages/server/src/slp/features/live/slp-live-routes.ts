import { existsSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import { slpLiveView, slpLiveViewers } from "../../../../../shared/src/slp/slp-live.js";
import { resolveCreatorMediaAbsolutePath, sendSlurpImageFile } from "../../base/media/slp-media.js";
import { createSlurpLiveStorage } from "../../data/live/slp-live-storage.js";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { endSlurpLiveShow, hostSlurpLiveShow, simulateSlurpLiveShow } from "./slp-live-service.js";
import { beatSlurpLiveShow } from "./slp-live-beat.js";
import { tipSlurpLiveShow } from "./slp-live-tip.js";

const LIVE_OFF = "Live is switched off in Backstage.";
const TIP_ERRORS = {
  missing: [404, "No such show"],
  ended: [409, "The show has ended"],
  processing: [409, "Tip payment is still processing."],
  broke: [402, "Not enough coins"],
  taken: [409, "The show is private right now"],
  hosting: [409, "You host this show"],
} as const;

/** Live shows (LIVE-V3-PLAN.md): who is live now, one show for the screen, and the player's tips. */
export async function slpLiveRoutes(app: FastifyInstance, { noodle, resolveViewerPersona }: SlpRouteDeps) {
  const storage = createSlurpLiveStorage(app.db);
  const liveOn = async () => slpExtensionOn(await noodle.getSettings(), "live");

  app.get("/slurp/live", async () => {
    // Nobody is live while Live is off: an empty list keeps the polling screen's console clean.
    if (!(await liveOn())) return { shows: [] };
    const now = Date.now();
    const shows = (await storage.listOpen()).filter((show) => Date.parse(show.endsAt) > now);
    return {
      shows: shows.map((show) => ({
        id: show.id,
        hostId: show.hostId,
        hostKind: show.hostKind,
        startedAt: show.startedAt,
        endsAt: show.endsAt,
        viewers: slpLiveViewers(show.state, show.id),
        heat: Math.round(show.state.heat),
      })),
    };
  });

  app.get("/slurp/live/:id", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!slpExtensionOn(settings, "live")) return reply.code(409).send({ error: LIVE_OFF });
    const { personaId } = z.object({ personaId: z.string().trim().min(1).optional() }).parse(req.query);
    const stored = await storage.get((req.params as { id: string }).id);
    if (!stored) return reply.code(404).send({ error: "No such show" });
    const at = new Date();
    // Watching moves the show to now, so the screen never waits for the next world tick.
    const show = stored.endedAt ? stored : await simulateSlurpLiveShow(app.db, stored, settings, at);
    if (!show.endedAt) await storage.save(show.id, { watchedAt: at.toISOString() });
    return slpLiveView(show, at.getTime(), personaId ? `persona:${personaId}` : null, settings.live);
  });

  // A live picture by number (`picture.n` in the view). The show is public, so any viewer may load it.
  app.get("/slurp/live/:id/picture/:n", async (req, reply) => {
    if (!(await liveOn())) return reply.code(409).send({ error: LIVE_OFF });
    const { id, n } = req.params as { id: string; n: string };
    const picture = (await storage.get(id))?.state.pictures?.[Number(n)];
    const absolute = picture ? resolveCreatorMediaAbsolutePath(picture.path) : null;
    if (!absolute || !existsSync(absolute)) return reply.code(404).send({ error: "No such picture" });
    return sendSlurpImageFile(reply.header("Cache-Control", "private, max-age=3600"), absolute);
  });

  // The screen asks for the next beat when the current one runs low, when the player joins, or with a
  // chat message (which cuts in). The answer is the show as the viewer sees it now.
  app.post("/slurp/live/:id/beat", async (req, reply) => {
    if (!(await liveOn())) return reply.code(409).send({ error: LIVE_OFF });
    const parsed = z
      .object({
        personaId: z.string().trim().min(1).optional(),
        message: z.string().trim().min(1).max(300).optional(),
        joined: z.boolean().optional(),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { personaId, message, joined } = parsed.data;
    if (message && !personaId) return reply.code(400).send({ error: "Pick a persona to talk in a live show" });
    const viewer = personaId ? await resolveViewerPersona(personaId) : null;
    if (personaId && !viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const showId = (req.params as { id: string }).id;
    const result = await beatSlurpLiveShow(app.db, {
      showId,
      viewer,
      ...(personaId ? { personaId } : {}),
      ...(message ? { message } : {}),
      ...(joined ? { joined } : {}),
    });
    if (result === "missing") return reply.code(404).send({ error: "No such show" });
    const show = await storage.get(showId);
    if (!show) return reply.code(404).send({ error: "No such show" });
    return {
      beat: result,
      show: slpLiveView(show, Date.now(), personaId ? `persona:${personaId}` : null, (await noodle.getSettings()).live),
    };
  });

  app.post("/slurp/live/:id/tip", async (req, reply) => {
    if (!(await liveOn())) return reply.code(409).send({ error: LIVE_OFF });
    const parsed = z
      .object({
        personaId: z.string().trim().min(1),
        amount: z.number().int().min(1).max(99_999),
        itemId: z.string().trim().min(1).max(40).optional(),
        requestId: z.string().trim().min(8).max(100),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const showId = (req.params as { id: string }).id;
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    if (parsed.data.itemId) {
      const item = (await storage.get(showId))?.state.menu.find((entry) => entry.id === parsed.data.itemId);
      if (!item || parsed.data.amount < item.price)
        return reply.code(400).send({ error: "That is not on the menu at this price" });
    }
    const result = await tipSlurpLiveShow(app.db, { ...parsed.data, showId, viewer });
    if (result !== "booked") return reply.code(TIP_ERRORS[result][0]).send({ error: TIP_ERRORS[result][1] });
    const show = await storage.get(showId);
    return show
      ? slpLiveView(show, Date.now(), `persona:${parsed.data.personaId}`, (await noodle.getSettings()).live)
      : reply.code(404).send({ error: "No such show" });
  });

  // A private block at the Backstage price and length; buying again while it runs extends it.
  app.post("/slurp/live/:id/private", async (req, reply) => {
    const settings = await noodle.getSettings();
    if (!slpExtensionOn(settings, "live")) return reply.code(409).send({ error: LIVE_OFF });
    const parsed = z
      .object({ personaId: z.string().trim().min(1), requestId: z.string().trim().min(8).max(100) })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const showId = (req.params as { id: string }).id;
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const result = await tipSlurpLiveShow(app.db, {
      ...parsed.data,
      showId,
      viewer,
      amount: settings.live.privatePrice,
      private: true,
    });
    if (result !== "booked") return reply.code(TIP_ERRORS[result][0]).send({ error: TIP_ERRORS[result][1] });
    const show = await storage.get(showId);
    return show
      ? slpLiveView(show, Date.now(), `persona:${parsed.data.personaId}`, (await noodle.getSettings()).live)
      : reply.code(404).send({ error: "No such show" });
  });

  // The player goes live: as their persona's own Creator, or as the Creator they play in Stir.
  app.post("/slurp/live/host", async (req, reply) => {
    if (!(await liveOn())) return reply.code(409).send({ error: LIVE_OFF });
    const parsed = z
      .object({
        personaId: z.string().trim().min(1),
        creatorId: z.string().trim().min(1).optional(),
        minutes: z.number().int().min(1).max(240),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await resolveViewerPersona(parsed.data.personaId)))
      return reply.code(404).send({ error: "Slurp persona not found" });
    const result = await hostSlurpLiveShow(app.db, parsed.data);
    if (result === "missing") return reply.code(404).send({ error: "No such Creator" });
    if (result === "live") return reply.code(409).send({ error: "This Creator is already live" });
    const settings = await noodle.getSettings();
    return slpLiveView(result.show, Date.now(), `persona:${parsed.data.personaId}`, settings.live);
  });

  app.post("/slurp/live/:id/end", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const show = await endSlurpLiveShow(app.db, { showId: (req.params as { id: string }).id, ...parsed.data });
    if (show === "missing") return reply.code(404).send({ error: "No such show" });
    const settings = await noodle.getSettings();
    return slpLiveView(show, Date.now(), `persona:${parsed.data.personaId}`, settings.live);
  });
}
