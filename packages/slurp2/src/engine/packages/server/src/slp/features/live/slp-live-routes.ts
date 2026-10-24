import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { createSlurpLiveStorage } from "../../data/live/slp-live-storage.js";
import { createSlurpStorage, createSlurpMessagesStorage } from "../../data/slp-storage.js";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import { endSlurpPlayerLiveShow, narrateSlurpPlayerLiveShow, replyToSlurpLiveChat } from "./slp-live-contract.js";
import { slurpLiveMenuItems } from "../../modules/live/slp-live-menu.js";
import { newId } from "../../../utils/id-generator.js";
import { SLURP_LIVE_ROOM_TYPES, type SlurpLiveRoomType } from "../../modules/live/slp-live-rooms.js";
import {
  slurpLiveCanWatch,
  slurpLiveForViewer,
  slurpLivePrivatePrice,
  slurpLiveViewerCount,
  slurpLiveMenuPriceInBounds,
} from "../../modules/live/slp-live.js";
import { resolveCreatorMediaAbsolutePath, sendSlurpImageFile } from "../../base/media/slp-media.js";
import { trySlpOperation } from "../../base/locking/slp-operation-lock.js";
import { announceSlurpLive, kickSlurpLiveShow, liveSpice } from "./slp-live-service.js";

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
      kickSlurpLiveShow(app.db, id);
      const current = show;
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
  app.post("/live/stir", async (request, reply) => {
    const parsed = z
      .object({
        creatorAccountId: z.string().trim().min(1),
        when: z.union([z.literal("now"), z.string().datetime()]),
        minutes: z.union([z.literal(20), z.literal(30), z.literal(40)]),
        mode: z.enum(["text", "pictures"]),
        requestId: z.string().trim().min(1),
      })
      .safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await enabled())) return reply.code(404).send({ error: "Live is switched off." });
    const creator = await createSlurpStorage(app.db).getNoodlerAccountById(parsed.data.creatorAccountId);
    if (!creator || creator.kind !== "character") return reply.code(404).send({ error: "Creator not found." });
    const storage = createSlurpLiveStorage(app.db);
    const previous = await storage.byStirRequestId(parsed.data.requestId);
    if (previous) {
      if (previous.hostId !== creator.id)
        return reply.code(409).send({ error: "Request ID belongs to another Creator." });
      return {
        show:
          previous.announcedFor && !previous.announcementPostId ? await announceSlurpLive(app.db, previous) : previous,
        started: !!previous.startedNoticeAt,
      };
    }
    const now = new Date();
    const startsAt = parsed.data.when === "now" ? now : new Date(parsed.data.when);
    if (startsAt < now || startsAt.getTime() > now.getTime() + 48 * 60 * 60_000)
      return reply.code(400).send({ error: "Choose a time within the next 48 hours." });
    const endsAt = new Date(startsAt.getTime() + parsed.data.minutes * 60_000);
    const spice = await liveSpice(app.db, creator);
    const menu = slurpLiveMenuItems(
      spice.level,
      spice.turnOns,
      Math.max(10, Number(creator.settings?.messaging?.ppvPrice ?? 25)),
      spice.hardNoes,
    );
    const planned = await storage.plan(
      creator.id,
      startsAt,
      endsAt,
      parsed.data.when === "now" ? null : startsAt.toISOString(),
      Math.max(10, Number(creator.settings?.messaging?.ppvPrice ?? 25)),
      menu,
      parsed.data.requestId,
      parsed.data.mode,
    );
    if (!planned) return reply.code(409).send({ error: "This Creator is already live at that time." });
    if (planned.hostId !== creator.id) return reply.code(409).send({ error: "Request ID belongs to another Creator." });
    if (planned.startedNoticeAt) return { show: planned, started: true };
    if (parsed.data.when !== "now") {
      const announced = await announceSlurpLive(app.db, planned);
      if (!announced.announcementPostId) return reply.code(503).send({ error: "Could not post the announcement." });
      return { show: announced, started: false };
    }
    const claim = await trySlpOperation("slurp-live-start", () => storage.startPlanned(planned.id, new Date()));
    if (!claim.acquired || !claim.value) {
      await storage.cancelUnstarted(planned.id);
      return reply.code(409).send({ error: "The live show cap is full." });
    }
    const started = claim.value;
    return { show: await storage.get(started.id), started: true };
  });
  app.post("/live/start", async (request, reply) => {
    const parsed = z
      .object({
        personaId: z.string().trim().min(1),
        duration: z.union([z.literal(20), z.literal(30), z.literal(40)]),
        goal: z.number().int().min(1).max(9999).optional(),
        menu: z
          .array(z.object({ id: z.string().min(1), enabled: z.boolean(), price: z.number() }))
          .max(8)
          .optional(),
        crowd: z.enum(SLURP_LIVE_ROOM_TYPES as [SlurpLiveRoomType, ...SlurpLiveRoomType[]]).optional(),
      })
      .safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await enabled())) return reply.code(404).send({ error: "Live is switched off." });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    const player = viewer && (await noodle.getSlurpAccountForEntity("persona", viewer.entityId, "viewer"));
    if (!viewer || !player) return reply.code(404).send({ error: "Player account not found." });
    if (parsed.data.menu?.some((item) => !slurpLiveMenuPriceInBounds(item.price)))
      return reply.code(400).send({ error: "Menu prices must be whole numbers from 1 to 9999." });
    const ppvPrice = await noodle.getCreatorSubscriptionPrice(player.id);
    const spice = await liveSpice(app.db, player);
    const defaults = slurpLiveMenuItems(spice.level, spice.turnOns, ppvPrice, spice.hardNoes);
    const menu = parsed.data.menu
      ? defaults.flatMap((item) => {
          const edit = parsed.data.menu?.find((entry) => entry.id === item.id);
          return edit?.enabled ? [{ ...item, price: edit.price }] : [];
        })
      : defaults;
    const goal = parsed.data.goal ?? Math.min(9999, Math.max(1, ppvPrice * 4));
    const show = await storage.createIfNone({
      hostKind: "player",
      hostId: player.id,
      startedAt: new Date(),
      endsAt: new Date(Date.now() + parsed.data.duration * 60_000),
      goal,
      menu,
      crowd: parsed.data.crowd ?? null,
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
  app.get("/live/player-menu/:personaId", async (request, reply) => {
    const viewer = await resolveViewerPersona((request.params as { personaId: string }).personaId);
    const player = viewer && (await noodle.getSlurpAccountForEntity("persona", viewer.entityId, "viewer"));
    if (!viewer || !player) return reply.code(404).send({ error: "Player account not found." });
    const ppvPrice = await noodle.getCreatorSubscriptionPrice(player.id);
    const spice = await liveSpice(app.db, player);
    return {
      goal: Math.min(9999, Math.max(1, ppvPrice * 4)),
      menu: slurpLiveMenuItems(spice.level, spice.turnOns, ppvPrice, spice.hardNoes),
    };
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
      fromPlayer: true,
    };
    // A retry of a known tip still goes through the payment: the DM tip id makes it charge at most once,
    // and it charges now if the first attempt crashed before paying.
    const duplicate = !(await storage.claimTip(show.id, event));
    let result;
    try {
      result = await createSlurpMessagesStorage(app.db).tipInThread(
        viewer.id,
        show.hostId,
        parsed.data.amount,
        "Live show tip",
        // Scoped to this show and action, so a client id reused elsewhere never counts as paid here.
        `live:${show.id}:tip:${claimId}`,
      );
    } catch (error) {
      await storage.releaseTip(show.id, claimId);
      throw error;
    }
    if (result.status !== "sent") {
      await storage.releaseTip(show.id, claimId);
      return reply.code(result.status === "insufficient_funds" ? 402 : 403).send(result);
    }
    if (!duplicate) void replyToSlurpLiveChat(app.db, show.id);
    return {
      show: await showForViewer(show.id, viewer.id),
      replyQueued: !duplicate,
      ...(duplicate ? { duplicate: true } : {}),
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
      private: !!show.private && Date.parse(show.private.until) > Date.now(),
      fromPlayer: true,
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
        `live:${show.id}:menu:${claimId}`,
        "Live show menu",
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
  app.post("/live/:id/menu/:requestId/done", async (request, reply) => {
    const parsed = body.safeParse(request.body ?? {});
    if (!parsed.success || !(await enabled())) return reply.code(400).send({ error: "Invalid request." });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    const player = viewer && (await noodle.getSlurpAccountForEntity("persona", viewer.entityId, "viewer"));
    const params = request.params as { id: string; requestId: string };
    const show = await storage.get(params.id);
    if (!viewer || !player || !show || show.hostKind !== "player" || show.hostId !== player.id)
      return reply.code(404).send({ error: "Live show not found." });
    const updated = await storage.markMenuServed(show.id, params.requestId);
    if (!updated) return reply.code(404).send({ error: "Menu item not found." });
    return { show: slurpLiveForViewer(updated, viewer.id, new Date()) };
  });
  app.post("/live/:id/private", async (request, reply) => {
    const parsed = body.extend({ requestId: z.string().trim().min(1) }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await enabled())) return reply.code(404).send({ error: "Live is switched off." });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    const show = await storage.get((request.params as { id: string }).id);
    const resumed = show?.privateClaims.find(
      (claim) => claim.requestId === parsed.data.requestId && claim.personaId === viewer?.id,
    );
    if (
      !viewer ||
      !show ||
      show.hostKind !== "creator" ||
      (show.endedAt && !resumed) ||
      !show.startedNoticeAt ||
      (Date.now() >= Date.parse(show.endsAt) && !resumed)
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
      `live:${show.id}:private:${parsed.data.requestId}`,
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
