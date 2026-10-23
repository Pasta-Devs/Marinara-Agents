import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { createSlurpLiveStorage } from "../../data/live/slp-live-storage.js";
import { createSlurpStorage, createSlurpMessagesStorage } from "../../data/slp-storage.js";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import { slurpLiveReplyAllowed } from "../../modules/live/slp-live.js";
import { replyToSlurpLiveChat } from "./slp-live-contract.js";

const body = z.object({ personaId: z.string().trim().min(1) }).passthrough();

export async function slpLiveRoutes(app: FastifyInstance, { resolveViewerPersona }: SlpRouteDeps) {
  const storage = createSlurpLiveStorage(app.db);
  const enabled = async () => slpExtensionOn(await createSlurpStorage(app.db).getSettings(), "live");
  app.get("/live", async (_request, reply) => (await enabled()) ? { shows: await storage.list() } : reply.code(404).send({ error: "Live is switched off." }));
  app.get("/live/:id", async (request, reply) => {
    if (!(await enabled())) return reply.code(404).send({ error: "Live is switched off." });
    const show = await storage.get((request.params as { id: string }).id);
    return show ?? reply.code(404).send({ error: "Live show not found." });
  });
  app.post("/live/:id/tip", async (request, reply) => {
    const parsed = body.extend({ amount: z.number().int().positive(), requestId: z.string().optional() }).safeParse(request.body ?? {});
    if (!parsed.success || !(await enabled())) return reply.code(404).send({ error: "Live is switched off." });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    const show = await storage.get((request.params as { id: string }).id);
    if (!viewer || !show || show.endedAt) return reply.code(404).send({ error: "Live show not found." });
    const result = await createSlurpMessagesStorage(app.db).tipInThread(viewer.id, show.hostId, parsed.data.amount, "Live show tip", parsed.data.requestId);
    if (result.status !== "sent") return reply.code(result.status === "insufficient_funds" ? 402 : 403).send(result);
    const events = [...show.events, { at: Date.now() - Date.parse(show.startedAt), kind: "tip" as const, name: viewer.displayName, amount: parsed.data.amount, text: "" }];
    await storage.update(show.id, { events, raised: show.raised + parsed.data.amount, ...(show.raised < show.goal && show.raised + parsed.data.amount >= show.goal ? { goalHitAt: new Date().toISOString() } : {}) });
    return { show: await storage.get(show.id), wallet: await createSlurpStorage(app.db).getWallet(viewer.id) };
  });
  app.post("/live/:id/chat", async (request, reply) => {
    const parsed = body.extend({ text: z.string().trim().min(1).max(1000) }).safeParse(request.body ?? {});
    if (!parsed.success || !(await enabled())) return reply.code(404).send({ error: "Live is switched off." });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    const show = await storage.get((request.params as { id: string }).id);
    if (!viewer || !show || show.endedAt) return reply.code(404).send({ error: "Live show not found." });
    const events = [...show.events, { at: Date.now() - Date.parse(show.startedAt), kind: "chat" as const, name: viewer.displayName, text: parsed.data.text }];
    await storage.update(show.id, { events });
    if (slurpLiveReplyAllowed(show.lastReplyAt)) void replyToSlurpLiveChat(app.db, show.id, parsed.data.text);
    return { show: await storage.get(show.id), replyQueued: !slurpLiveReplyAllowed(show.lastReplyAt) };
  });
}
