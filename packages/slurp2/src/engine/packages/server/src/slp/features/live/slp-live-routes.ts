import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { createSlurpLiveStorage } from "../../data/live/slp-live-storage.js";
import { createSlurpStorage, createSlurpMessagesStorage } from "../../data/slp-storage.js";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import {
  endSlurpPlayerLiveShow,
  getSlurpLiveMissed,
  narrateSlurpPlayerLiveShow,
  replyToSlurpLiveChat,
} from "./slp-live-contract.js";
import { slurpLiveMenuItems } from "../../modules/live/slp-live-menu.js";
import { newId } from "../../../utils/id-generator.js";
import {
  slurpLiveCanWatch,
  slurpLiveForViewer,
  slurpLivePrivatePrice,
  slurpLiveViewerCount,
} from "../../modules/live/slp-live.js";
import { resolveCreatorMediaAbsolutePath, sendSlurpImageFile } from "../../base/media/slp-media.js";

const body = z.object({ personaId: z.string().trim().min(1) }).passthrough();

export async function slpLiveRoutes(app: FastifyInstance, { resolveViewerPersona, noodle }: SlpRouteDeps) {
  const storage = createSlurpLiveStorage(app.db);
  const enabled = async () => slpExtensionOn(await createSlurpStorage(app.db).getSettings(), "live");
  const showForViewer = async (id: string, personaId: string | null) => {
    const show = await storage.get(id);
    return show ? slurpLiveForViewer(show, personaId, new Date()) : null;
  };
  app.get("/live", async (_request, reply) =>
    (await enabled())
      ? {
          shows: (await storage.list()).map((show) => slurpLiveForViewer(show, null, new Date())),
          upcoming: (await storage.upcomingAnnounced()).map((show) => slurpLiveForViewer(show, null, new Date())),
        }
      : reply.code(404).send({ error: "Live is switched off." }),
  );
  app.get("/live/:id", async (request, reply) => {
    if (!(await enabled())) return reply.code(404).send({ error: "Live is switched off." });
    const id = (request.params as { id: string }).id;
    const show = await storage.get(id);
    if (!show) return reply.code(404).send({ error: "Live show not found." });
    const personaId = (request.query as { personaId?: string }).personaId;
    const viewer = personaId ? await resolveViewerPersona(personaId) : null;
    if (show.startedNoticeAt && slurpLiveCanWatch(personaId, !!viewer)) {
      await storage.seen(id, new Date(), viewer?.id);
      const current = (await getSlurpLiveMissed(app.db, id)) ?? show;
      const elapsed = Math.max(0, Date.now() - Date.parse(current.startedAt));
      const duration = Date.parse(current.endsAt) - Date.parse(current.startedAt);
      const audience = (await createSlurpStorage(app.db).getSettings()).fanTypes?.length ?? 10;
      const creator =
        current.hostKind === "creator" ? await createSlurpStorage(app.db).getNoodlerAccountById(current.hostId) : null;
      return {
        ...slurpLiveForViewer(current, viewer?.id ?? null, new Date()),
        privatePrice: slurpLivePrivatePrice(Number(creator?.settings?.messaging?.ppvPrice ?? 25)),
        picturesAllowed: creator?.settings?.scheduler?.autoPosting?.imagesEnabled === true,
        viewers: slurpLiveViewerCount(elapsed, duration, audience),
      };
    }
    return slurpLiveForViewer(show, null, new Date());
  });
  app.get("/live/:id/picture/:mediaId", async (request, reply) => {
    const { id, mediaId } = request.params as { id: string; mediaId: string };
    const personaId = (request.query as { personaId?: string }).personaId;
    const viewer = personaId && (await resolveViewerPersona(personaId));
    if (!viewer || !(await enabled())) return reply.code(404).send({ error: "Picture not found." });
    const show = await storage.get(id);
    const picture = show?.pictures.find(
      (item) => item.mediaId === mediaId && item.personaId === viewer.id && item.status === "ready",
    );
    const absolute = picture?.mediaPath && resolveCreatorMediaAbsolutePath(picture.mediaPath);
    if (!absolute) return reply.code(404).send({ error: "Picture not found." });
    return sendSlurpImageFile(reply.header("Cache-Control", "private, no-store"), absolute);
  });
  app.post("/live/:id/remind", async (request, reply) => {
    const parsed = body.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await enabled())) return reply.code(404).send({ error: "Live is switched off." });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Player not found." });
    const reminded = await storage.remind((request.params as { id: string }).id, viewer.entityId);
    if (!reminded) return reply.code(404).send({ error: "Upcoming show not found." });
    return { reminded: true };
  });
  app.post("/live/start", async (request, reply) => {
    const parsed = z
      .object({ personaId: z.string().trim().min(1), duration: z.union([z.literal(20), z.literal(30), z.literal(40)]) })
      .safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await enabled())) return reply.code(404).send({ error: "Live is switched off." });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    const player = viewer && (await noodle.getSlurpAccountForEntity("persona", viewer.entityId, "viewer"));
    if (!viewer || !player) return reply.code(404).send({ error: "Player account not found." });
    const goal = await noodle.getCreatorSubscriptionPrice(player.id);
    const show = await storage.createIfNone({
      hostKind: "player",
      hostId: player.id,
      startedAt: new Date(),
      endsAt: new Date(Date.now() + parsed.data.duration * 60_000),
      goal: Math.max(1, goal),
      menu: slurpLiveMenuItems(0, [], goal),
    });
    if (!show) {
      const active = await storage.active();
      return reply.code(409).send({
        error: "A live show is already active.",
        show: active ? slurpLiveForViewer(active, viewer.id, new Date()) : null,
      });
    }
    return { show: slurpLiveForViewer(show, viewer.id, new Date()) };
  });
  app.post("/live/:id/narrate", async (request, reply) => {
    const parsed = body.extend({ text: z.string().trim().min(1).max(500) }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await enabled())) return reply.code(404).send({ error: "Live is switched off." });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    const show = await storage.get((request.params as { id: string }).id);
    const player = viewer && (await noodle.getSlurpAccountForEntity("persona", viewer.entityId, "viewer"));
    if (!viewer || !player || !show || show.hostKind !== "player" || show.hostId !== player.id || show.endedAt)
      return reply.code(404).send({ error: "Live show not found." });
    await narrateSlurpPlayerLiveShow(app.db, show.id, parsed.data.text);
    return { show: await showForViewer(show.id, viewer.id) };
  });
  app.post("/live/:id/end", async (request, reply) => {
    const parsed = body.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await enabled())) return reply.code(404).send({ error: "Live is switched off." });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    const show = await storage.get((request.params as { id: string }).id);
    const player = viewer && (await noodle.getSlurpAccountForEntity("persona", viewer.entityId, "viewer"));
    if (!viewer || !player || !show || show.hostKind !== "player" || show.hostId !== player.id)
      return reply.code(404).send({ error: "Live show not found." });
    const ended = await endSlurpPlayerLiveShow(app.db, show.id);
    return { show: slurpLiveForViewer(ended ?? (await storage.get(show.id))!, viewer.id, new Date()) };
  });
  app.post("/live/:id/tip", async (request, reply) => {
    const parsed = body
      .extend({ amount: z.number().int().positive(), requestId: z.string().trim().min(1).optional() })
      .safeParse(request.body ?? {});
    if (!parsed.success || !(await enabled())) return reply.code(404).send({ error: "Live is switched off." });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    const show = await storage.get((request.params as { id: string }).id);
    if (!viewer || !show || show.endedAt || !show.startedNoticeAt || Date.now() >= Date.parse(show.endsAt))
      return reply.code(404).send({ error: "Live show not found." });
    if (show.private && Date.parse(show.private.until) > Date.now())
      return reply.code(409).send({ error: "The host is in private." });
    const requestId = parsed.data.requestId;
    const claimId = requestId ?? `live-tip:${newId()}`;
    const event = {
      at: Date.now() - Date.parse(show.startedAt),
      kind: "tip" as const,
      name: viewer.displayName,
      amount: parsed.data.amount,
      text: "",
      requestId: claimId,
    };
    if (!(await storage.claimTip(show.id, event)))
      return {
        show: await showForViewer(show.id, viewer.id),
        duplicate: true,
        wallet: await createSlurpStorage(app.db).getWallet(viewer.id),
      };
    let result;
    try {
      result = await createSlurpMessagesStorage(app.db).tipInThread(
        viewer.id,
        show.hostId,
        parsed.data.amount,
        "Live show tip",
        claimId,
      );
    } catch (error) {
      await storage.releaseTip(show.id, claimId);
      throw error;
    }
    if (result.status !== "sent") {
      await storage.releaseTip(show.id, claimId);
      return reply.code(result.status === "insufficient_funds" ? 402 : 403).send(result);
    }
    return {
      show: await showForViewer(show.id, viewer.id),
      wallet: await createSlurpStorage(app.db).getWallet(viewer.id),
    };
  });
  app.post("/live/:id/chat", async (request, reply) => {
    const parsed = body.extend({ text: z.string().trim().min(1).max(1000) }).safeParse(request.body ?? {});
    if (!parsed.success || !(await enabled())) return reply.code(404).send({ error: "Live is switched off." });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    const show = await storage.get((request.params as { id: string }).id);
    if (!viewer || !show || show.endedAt || !show.startedNoticeAt || Date.now() >= Date.parse(show.endsAt))
      return reply.code(404).send({ error: "Live show not found." });
    if (show.private && Date.parse(show.private.until) > Date.now() && show.private.personaId !== viewer.id)
      return reply.code(409).send({ error: "The host is in private." });
    await storage.appendEvent(show.id, {
      at: Date.now() - Date.parse(show.startedAt),
      kind: "chat",
      name: viewer.displayName,
      text: parsed.data.text,
      personaId: show.private && Date.parse(show.private.until) > Date.now() ? viewer.id : undefined,
    });
    void replyToSlurpLiveChat(app.db, show.id);
    return { show: await showForViewer(show.id, viewer.id), replyQueued: true };
  });
  app.post("/live/:id/menu", async (request, reply) => {
    const parsed = body
      .extend({ itemId: z.string().trim().min(1), requestId: z.string().trim().min(1) })
      .safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await enabled())) return reply.code(404).send({ error: "Live is switched off." });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    const show = await storage.get((request.params as { id: string }).id);
    if (!viewer || !show || show.endedAt || !show.startedNoticeAt || Date.now() >= Date.parse(show.endsAt))
      return reply.code(404).send({ error: "Live show not found." });
    if (show.private && Date.parse(show.private.until) > Date.now())
      return reply.code(409).send({ error: "The host is in private." });
    const item = show.menu.find((entry) => entry.id === parsed.data.itemId);
    if (!item) return reply.code(404).send({ error: "Menu item not found." });
    const claimId = parsed.data.requestId;
    const claimed = await storage.claimMenu(
      show.id,
      {
        itemId: item.id,
        label: item.label,
        name: viewer.displayName,
        viewerId: viewer.id,
        at: Date.now() - Date.parse(show.startedAt),
        served: false,
        requestId: claimId,
      },
      item.price,
    );
    if (!claimed) {
      const state = await storage.menuClaimState(show.id, claimId, item.id, viewer.id);
      if (state === "conflict") return reply.code(409).send({ error: "Request ID already used." });
      if (state !== "resume")
        return {
          show: await showForViewer(show.id, viewer.id),
          duplicate: true,
          wallet: await createSlurpStorage(app.db).getWallet(viewer.id),
        };
    }
    let result;
    try {
      result = await createSlurpMessagesStorage(app.db).tipInThread(
        viewer.id,
        show.hostId,
        item.price,
        `Live menu: ${item.label}`,
        claimId,
      );
    } catch (error) {
      // The payment may have settled. Keep the claim for a retry with the same request ID.
      throw error;
    }
    if (result.status !== "sent") {
      if (result.status === "insufficient_funds") await storage.releaseMenu(show.id, claimId);
      return reply.code(result.status === "insufficient_funds" ? 402 : 403).send(result);
    }
    await storage.confirmMenu(show.id, claimId);
    return {
      show: await showForViewer(show.id, viewer.id),
      wallet: await createSlurpStorage(app.db).getWallet(viewer.id),
    };
  });
  app.post("/live/:id/private", async (request, reply) => {
    const parsed = body.extend({ requestId: z.string().trim().min(1) }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await enabled())) return reply.code(404).send({ error: "Live is switched off." });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    const show = await storage.get((request.params as { id: string }).id);
    if (
      !viewer ||
      !show ||
      show.hostKind !== "creator" ||
      show.endedAt ||
      !show.startedNoticeAt ||
      Date.now() >= Date.parse(show.endsAt)
    )
      return reply.code(404).send({ error: "Live show not found." });
    const creator = await createSlurpStorage(app.db).getNoodlerAccountById(show.hostId);
    const ppvPrice = Number(creator?.settings?.messaging?.ppvPrice ?? 25);
    const price = slurpLivePrivatePrice(ppvPrice);
    const state = await storage.privateClaim(show.id, viewer.id, parsed.data.requestId, new Date());
    if (state === "unavailable") return reply.code(409).send({ error: "The live show is no longer available." });
    if (state === "busy") return reply.code(409).send({ error: "The private show is busy." });
    if (state === "conflict") return reply.code(409).send({ error: "Request ID already used." });
    if (state === "duplicate")
      return {
        show: await showForViewer(show.id, viewer.id),
        duplicate: true,
        wallet: await createSlurpStorage(app.db).getWallet(viewer.id),
      };
    const result = await createSlurpMessagesStorage(app.db).tipInThread(
      viewer.id,
      show.hostId,
      price,
      "Private show",
      parsed.data.requestId,
    );
    if (result.status !== "sent") {
      if (result.status === "insufficient_funds") await storage.privateRelease(show.id, parsed.data.requestId);
      else if (result.status !== "sent") await storage.privateRelease(show.id, parsed.data.requestId);
      return reply.code(result.status === "insufficient_funds" ? 402 : 403).send(result);
    }
    const confirmed = await storage.privateConfirm(show.id, parsed.data.requestId, new Date());
    if (!confirmed)
      return reply.code(409).send({ error: "Private show could not start. Contact support about the payment." });
    return {
      show: slurpLiveForViewer(confirmed, viewer.id, new Date()),
      wallet: await createSlurpStorage(app.db).getWallet(viewer.id),
    };
  });
  app.post("/live/:id/mode", async (request, reply) => {
    const parsed = body.extend({ mode: z.enum(["text", "pictures"]) }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Player not found." });
    const show = await storage.get((request.params as { id: string }).id);
    const creator =
      show?.hostKind === "creator" ? await createSlurpStorage(app.db).getNoodlerAccountById(show.hostId) : null;
    if (
      !creator ||
      (parsed.data.mode === "pictures" && creator.settings?.scheduler?.autoPosting?.imagesEnabled !== true)
    )
      return reply.code(403).send({ error: "Picture mode is unavailable." });
    const mode = await storage.setMode(show!.id, viewer.id, parsed.data.mode, new Date());
    if (!mode) return reply.code(409).send({ error: "Picture mode is unavailable." });
    return { show: await showForViewer((request.params as { id: string }).id, viewer.id) };
  });
}
