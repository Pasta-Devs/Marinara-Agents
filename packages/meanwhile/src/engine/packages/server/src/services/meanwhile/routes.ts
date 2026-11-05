import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import {
  DAY,
  HOUR,
  SPEED_MAX,
  BACKGROUND_EVERY_MS,
  RUN_AHEAD_MS,
  circleNowMs,
  msToWall,
  shiftDay,
  normalizeSpeed,
  setSpeed,
  setTime,
  validTimezone,
  wallToMs,
  type RunMark,
} from "./clock.js";
import {
  cancelFastForward,
  dueNow,
  ffStatus,
  previewFastForward,
  readSchedules,
  runCircleNow,
  runDuePass,
  startFastForward,
} from "./scheduler.js";
import { KINDS } from "./deck.js";
import { currentBlock } from "./routine.js";
import { statusOwner } from "./status.js";
import { countHidden, hiddenBySurprise } from "./context.js";
import { bannedWords, usageRow } from "./beats.js";
import {
  applyCircleFields,
  circleFieldError,
  defaultCircle,
  getMeanwhileRuntime,
  markOf,
  readMeanwhile,
  updateMeanwhile,
  withMark,
  type Circle,
  type LifeEvent,
  NUDGE_MAX_OPEN,
  type MeanwhileDocument,
  type Nudge,
} from "./store.js";

const body = (request: { body?: unknown }): Record<string, unknown> =>
  request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? (request.body as Record<string, unknown>)
    : {};

/** A 400 message for a bad request, or null. The model must exist when the Engine can resolve it. */
async function inputError(src: Record<string, unknown>): Promise<string | null> {
  const error = circleFieldError(src);
  if (error || typeof src.connectionId !== "string" || src.connectionId === "") return error;
  try {
    await getMeanwhileRuntime().languageModels?.resolve(src.connectionId);
    return null;
  } catch {
    return "Unknown model";
  }
}

function statusOf(circle: Circle, mark: RunMark, now: number, calls: number) {
  const circleNow = circleNowMs(circle.clock, now);
  return {
    ready: circle.connectionId !== "",
    callsToday: calls,
    // The daily model-call limit is used up; the rest waits for the next real day.
    paused: circle.connectionId !== "" && calls >= circle.budgetCallsPerDay,
    circleNow: new Date(circleNow).toISOString(),
    nowWall: msToWall(circleNow, circle.clock.timezone),
    lastRunCircle: circle.lastRunCircle,
    lastRunAt: mark.lastRunAt || null,
    lastWindow: mark.lastWindow,
    // ponytail: only the background timer has a known next time; chat and tab reasons are events.
    nextDueAt:
      circle.backgroundTimer && circle.connectionId && circle.clock.speed > 0
        ? Math.max(
            mark.nextAt,
            mark.lastRunAt + BACKGROUND_EVERY_MS,
            // the real time at which 6 unseen Circle hours have passed
            circle.clock.anchorReal +
              Math.max(0, Date.parse(circle.lastRunCircle) + RUN_AHEAD_MS - Date.parse(circle.clock.anchorCircle)) /
                circle.clock.speed,
          )
        : null,
    leaseUntil: mark.leaseUntil > now ? mark.leaseUntil : null,
    failures: mark.failures,
    retryAt: mark.nextAt > now ? mark.nextAt : null,
    lastError: mark.lastError,
    fastForward: ffStatus(circle.id),
    dueReason: dueNow(circle, mark, false, now),
  };
}

const view = (doc: MeanwhileDocument, circle: Circle, now: number) => ({
  ...circle,
  status: statusOf(circle, markOf(doc, circle.id), now, usageRow(doc.usage, circle.id, now).calls),
  toHear: countHidden(doc, circle),
  waiting: doc.events.filter((e) => e.circleId === circle.id && e.status === "proposed").length,
  // Characters whose status another Circle writes, with that Circle's name.
  statusElsewhere: circle.writeStatus
    ? circle.castIds.flatMap((id) => {
        const owner = statusOwner(doc.circles, id);
        const other = owner && owner !== circle.id ? doc.circles.find((c) => c.id === owner) : null;
        return other
          ? [
              {
                characterId: id,
                circle: other.name,
                note: other.clock.speed === 0 ? "paused" : other.clock.speed !== 1 ? "not real time" : "",
              },
            ]
          : [];
      })
    : [],
});

export const meanwhileRoutes: FastifyPluginAsync = async (app) => {
  const find = (doc: MeanwhileDocument, id: string) => doc.circles.find((c) => c.id === id) ?? null;
  const notFound = (reply: { code: (n: number) => { send: (v: unknown) => unknown } }) =>
    reply.code(404).send({ error: "Circle not found" });

  app.get("/circles", async () => {
    const doc = await readMeanwhile();
    const now = Date.now();
    return { circles: doc.circles.map((c) => view(doc, c, now)), speedMax: SPEED_MAX };
  });

  // Home widget: the newest unheard hooks over all Circles. The widget sits outside any chat, so only
  // accepted, Circle-visible, non-spicy events count. "Heard" matches the tab: a chat took it into a prompt.
  app.get("/widget", async () => {
    const doc = await readMeanwhile();
    const circles = new Map(doc.circles.map((c) => [c.id, c]));
    const all = doc.events
      .filter(
        (e) =>
          circles.has(e.circleId) &&
          !hiddenBySurprise(doc, circles.get(e.circleId)!, e) &&
          e.status === "accepted" &&
          e.visibility === "circle" &&
          e.kind !== "spicy" &&
          e.hook &&
          Object.keys(e.delivered ?? {}).length === 0,
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .flatMap((e) =>
        Object.entries(e.hook!).map(([characterId, text]) => ({
          eventId: e.id,
          circleId: e.circleId,
          circleName: circles.get(e.circleId)!.name,
          characterId,
          text,
        })),
      );
    const withHooks = new Set(all.map((h) => h.circleId));
    return {
      hooks: all.slice(0, 3),
      quiet: doc.circles
        .filter((c) => !withHooks.has(c.id))
        .map((c) => ({
          id: c.id,
          name: c.name,
          lastRunCircle: c.lastRunCircle,
          timezone: c.clock.timezone,
          toHear: countHidden(doc, c),
        })),
    };
  });

  app.post("/circles", async (request, reply) => {
    const src = body(request);
    const error = await inputError(src);
    if (error) return reply.code(400).send({ error });
    const now = Date.now();
    const base = defaultCircle(randomUUID(), now);
    let circle = applyCircleFields(base, src);
    if (typeof src.sharedWorld !== "boolean") circle = { ...circle, sharedWorld: circle.linkedChatIds.length === 1 };
    if (validTimezone(src.timezone)) circle = { ...circle, clock: { ...circle.clock, timezone: src.timezone } };
    if (circle.writeStatus) circle = { ...circle, statusSince: now };
    const doc = await updateMeanwhile((d) => ({ ...d, circles: [...d.circles, circle] }));
    return view(doc, circle, now);
  });

  app.patch<{ Params: { id: string } }>("/circles/:id", async (request, reply) => {
    const { id } = request.params;
    const src = body(request);
    if (!find(await readMeanwhile(), id)) return notFound(reply);
    const error = await inputError(src);
    if (error) return reply.code(400).send({ error });
    const doc = await updateMeanwhile((d) => ({
      ...d,
      circles: d.circles.map((c) => {
        if (c.id !== id) return c;
        const applied = applyCircleFields(c, src);
        const next = applied.writeStatus && !c.writeStatus ? { ...applied, statusSince: Date.now() } : applied;
        return validTimezone(src.timezone) ? { ...next, clock: { ...next.clock, timezone: src.timezone } } : next;
      }),
    }));
    const circle = find(doc, id);
    return circle ? view(doc, circle, Date.now()) : notFound(reply);
  });

  app.delete<{ Params: { id: string } }>("/circles/:id", async (request, reply) => {
    const { id } = request.params;
    if (!find(await readMeanwhile(), id)) return notFound(reply);
    await updateMeanwhile((d) => ({
      ...d,
      circles: d.circles.filter((c) => c.id !== id),
      marks: d.marks.filter((m) => m.circleId !== id),
      events: d.events.filter((e) => e.circleId !== id),
      seeds: d.seeds.filter((s) => s.circleId !== id),
      dealtDays: d.dealtDays.filter((k) => !k.startsWith(`${id}:`)),
      papers: d.papers.filter((p) => p.circleId !== id),
      paperWeeks: d.paperWeeks.filter((k) => !k.startsWith(`${id}:`)),
      promises: d.promises.filter((p) => p.circleId !== id),
      nudges: d.nudges.filter((n) => n.circleId !== id),
    }));
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/circles/:id/speed", async (request, reply) => {
    const speed = normalizeSpeed(body(request).speed);
    if (speed === null) return reply.code(400).send({ error: `Speed must be a number from 0 to ${SPEED_MAX}` });
    const now = Date.now();
    const doc = await updateMeanwhile((d) => ({
      ...d,
      circles: d.circles.map((c) => (c.id === request.params.id ? { ...c, clock: setSpeed(c.clock, speed, now) } : c)),
    }));
    const circle = find(doc, request.params.id);
    return circle ? view(doc, circle, now) : notFound(reply);
  });

  // Body: { wall: "YYYY-MM-DDTHH:mm" } in the Circle's own time zone.
  app.post<{ Params: { id: string } }>("/circles/:id/time", async (request, reply) => {
    const wall = body(request).wall;
    const now = Date.now();
    const current = find(await readMeanwhile(), request.params.id);
    if (!current) return notFound(reply);
    const ms = typeof wall === "string" ? wallToMs(wall, current.clock.timezone) : null;
    if (ms === null) return reply.code(400).send({ error: "Time must look like 2026-11-05T18:00" });
    const doc = await updateMeanwhile((d) => ({
      ...d,
      circles: d.circles.map((c) =>
        c.id === current.id
          ? {
              ...c,
              clock: setTime(c.clock, ms, now),
              // Going back leaves nothing to catch up. Going forward is the fast forward.
              lastRunCircle: ms < Date.parse(c.lastRunCircle) ? new Date(ms).toISOString() : c.lastRunCircle,
            }
          : c,
      ),
    }));
    return view(doc, find(doc, current.id)!, now);
  });

  // The Meanwhile tab opened: every Circle with a model may catch up now.
  app.post("/tab-opened", async () => {
    await updateMeanwhile((d) => {
      let next = d;
      for (const c of d.circles) if (c.connectionId) next = withMark(next, { ...markOf(d, c.id), trigger: "tab" });
      return next;
    });
    const logger = getMeanwhileRuntime().logger;
    void runDuePass().catch((error) => logger.warn(`[meanwhile] tab pass failed: ${String(error)}`));
    return { ok: true };
  });

  // Manual run for testing. It needs a model like any other run.
  app.post<{ Params: { id: string } }>("/circles/:id/run", async (request, reply) => {
    const circle = find(await readMeanwhile(), request.params.id);
    if (!circle) return notFound(reply);
    if (!circle.connectionId) return reply.code(409).send({ error: "Choose a model to start" });
    if (!(await runCircleNow(circle.id)))
      return reply.code(409).send({ error: "A run is already live for this Circle" });
    const doc = await readMeanwhile();
    return view(doc, find(doc, circle.id) ?? circle, Date.now());
  });

  // Routine and summary events of the last `days` Circle days (default 3, at most 14), what each person does now
  // (from the schedule), and today's dealt seeds.
  app.get<{ Params: { id: string }; Querystring: { days?: string } }>(
    "/circles/:id/timeline",
    async (request, reply) => {
      const doc = await readMeanwhile();
      const circle = find(doc, request.params.id);
      if (!circle) return notFound(reply);
      const tz = circle.clock.timezone;
      const nowMs = circleNowMs(circle.clock, Date.now());
      const today = msToWall(nowMs, tz).slice(0, 10);
      const days = Math.min(14, Math.max(1, Math.trunc(Number(request.query.days)) || 3));
      const oldest = shiftDay(today, 1 - days);
      const wall = (iso: string) => msToWall(Date.parse(iso), tz);
      const events = doc.events
        .filter(
          (e) =>
            e.circleId === circle.id &&
            !hiddenBySurprise(doc, circle, e) &&
            (e.status === "accepted" || e.status === "proposed") &&
            wall(e.start).slice(0, 10) >= oldest,
        )
        .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
        .map((e) => ({
          ...e,
          day: wall(e.start).slice(0, 10),
          time: wall(e.start).slice(11),
          until: wall(e.end).slice(11),
        }));
      const { schedules } = await readSchedules(circle);
      const now: Record<string, ReturnType<typeof currentBlock>> = {};
      for (const id of circle.castIds) {
        const byActivity = doc.placeTags.find((t) => t.characterId === id)?.byActivity;
        now[id] = currentBlock(schedules[id], nowMs, tz, byActivity);
      }
      return {
        events,
        now,
        today,
        nowTime: msToWall(nowMs, tz).slice(11),
        dealt: circle.surprise ? [] : doc.seeds.filter((s) => s.circleId === circle.id && s.day === today),
        // Where and when the status was last written for each character.
        statusSent: Object.fromEntries(
          circle.castIds.flatMap((id) => {
            const sent = doc.statusSent[id];
            return sent?.at && circle.linkedChatIds.includes(sent.chatId)
              ? [[id, { chatId: sent.chatId, at: sent.at }]]
              : [];
          }),
        ),
      };
    },
  );

  // Phone: texts between characters, one thread per pair, newest thread first. Like the widget it
  // sits outside any chat, so only accepted, Circle-visible, non-spicy events count.
  app.get<{ Params: { id: string }; Querystring: { days?: string } }>("/circles/:id/phone", async (request, reply) => {
    const doc = await readMeanwhile();
    const circle = find(doc, request.params.id);
    if (!circle) return notFound(reply);
    const tz = circle.clock.timezone;
    const days = Math.min(14, Math.max(1, Math.trunc(Number(request.query.days)) || 7));
    const oldest = shiftDay(msToWall(circleNowMs(circle.clock, Date.now()), tz).slice(0, 10), 1 - days);
    const threads = new Map<string, { a: string; b: string; texts: { from: string; text: string; time: string }[] }>();
    for (const e of doc.events) {
      if (
        e.circleId !== circle.id ||
        e.status !== "accepted" ||
        e.visibility !== "circle" ||
        e.kind === "spicy" ||
        hiddenBySurprise(doc, circle, e)
      )
        continue;
      for (const t of e.texts ?? []) {
        if (msToWall(Date.parse(t.time), tz).slice(0, 10) < oldest) continue;
        const [a, b] = [t.from, t.to].sort() as [string, string];
        const thread = threads.get(`${a}|${b}`) ?? { a, b, texts: [] };
        thread.texts.push({ from: t.from, text: t.text, time: t.time });
        threads.set(`${a}|${b}`, thread);
      }
    }
    const last = (th: { texts: { time: string }[] }) => th.texts.at(-1)!.time;
    return {
      threads: [...threads.values()]
        .map((th) => ({ ...th, texts: th.texts.sort((x, y) => x.time.localeCompare(y.time)) }))
        .sort((x, y) => last(y).localeCompare(last(x))),
    };
  });

  // Monday papers, newest first. A paper is hidden once one of its events is vetoed or stale.
  app.get<{ Params: { id: string } }>("/circles/:id/papers", async (request, reply) => {
    const doc = await readMeanwhile();
    const circle = find(doc, request.params.id);
    if (!circle) return notFound(reply);
    const status = new Map(doc.events.map((e) => [e.id, hiddenBySurprise(doc, circle, e) ? "hidden" : e.status]));
    const papers = doc.papers
      .filter(
        (p) =>
          p.circleId === request.params.id &&
          !p.eventIds.some(
            (id) => status.get(id) === "vetoed" || status.get(id) === "stale" || status.get(id) === "hidden",
          ),
      )
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
      .map(({ id, weekStart, title, items, createdAt }) => ({ id, weekStart, title, items, createdAt }));
    return { papers };
  });

  // Hook cards and diary lines per character, newest first.
  app.get<{ Params: { id: string } }>("/circles/:id/home", async (request, reply) => {
    const doc = await readMeanwhile();
    const circle = find(doc, request.params.id);
    if (!circle) return notFound(reply);
    const tz = circle.clock.timezone;
    const mine = doc.events
      .filter((e) => e.circleId === circle.id && e.status === "accepted" && !hiddenBySurprise(doc, circle, e))
      .sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
    const chats = circle.linkedChatIds.length
      ? (await getMeanwhileRuntime().persistence.listChats()).filter((chat) => circle.linkedChatIds.includes(chat.id))
      : [];
    const hooks = mine
      .filter((e) => e.hook)
      .flatMap((e) =>
        Object.entries(e.hook!).map(([characterId, text]) => ({
          eventId: e.id,
          characterId,
          text,
          day: msToWall(Date.parse(e.start), tz).slice(0, 10),
          told: Object.keys(e.delivered ?? {}).length > 0,
          chats: chats
            .filter((chat) => chat.characterIds.includes(characterId))
            .map((chat) => ({ id: chat.id, name: chat.name })),
        })),
      )
      .slice(0, 12);
    const diary: Record<string, { id: string; day: string; text: string }[]> = {};
    for (const id of circle.castIds) {
      diary[id] = mine
        .filter((e) => e.diary?.[id])
        .slice(0, 20)
        .map((e) => ({ id: e.id, day: msToWall(Date.parse(e.start), tz).slice(0, 10), text: e.diary![id]! }));
    }
    const waiting = doc.events
      .filter((e) => e.circleId === circle.id && e.status === "proposed")
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .map((e) => ({
        id: e.id,
        cast: e.cast,
        kind: e.kind,
        text: e.text,
        day: msToWall(Date.parse(e.start), tz).slice(0, 10),
      }));
    return { hooks, diary, waiting };
  });

  // "Pick up this thread": the next generation in that chat brings the hook up.
  app.post<{ Params: { id: string; eventId: string } }>("/circles/:id/hooks/:eventId/pick", async (request, reply) => {
    const chatId = body(request).chatId;
    const doc = await readMeanwhile();
    const circle = find(doc, request.params.id);
    if (!circle) return notFound(reply);
    if (typeof chatId !== "string" || !circle.linkedChatIds.includes(chatId))
      return reply.code(400).send({ error: "Pick a linked chat" });
    const { eventId } = request.params;
    if (!doc.events.some((e) => e.id === eventId && e.circleId === circle.id && e.status === "accepted" && e.hook)) {
      return reply.code(404).send({ error: "Hook not found" });
    }
    await updateMeanwhile((d) => ({
      ...d,
      events: d.events.map((e) => {
        if (e.id !== eventId) return e;
        const delivered = { ...e.delivered };
        delete delivered[chatId]; // it may go into the prompt once more
        return { ...e, delivered, pickedUp: { ...e.pickedUp, [chatId]: Date.now() } };
      }),
    }));
    return { ok: true };
  });

  // Fast forward: 1 to 7 days, or hours up to that. Body: { days } or { hours }.
  const spanOf = (src: Record<string, unknown>): number | null => {
    const unit = src.days !== undefined ? DAY : HOUR;
    const n = src.days ?? src.hours;
    return typeof n === "number" && Number.isInteger(n) && n >= 1 && n * unit <= 7 * DAY ? n * unit : null;
  };
  const SPAN_ERROR = "Pick 1 to 7 days, or up to 168 hours";

  app.post<{ Params: { id: string } }>("/circles/:id/fast-forward/preview", async (request, reply) => {
    const span = spanOf(body(request));
    if (span === null) return reply.code(400).send({ error: SPAN_ERROR });
    const estimate = await previewFastForward(request.params.id, span);
    return estimate ? { ...estimate, overBudget: estimate.calls > estimate.left } : notFound(reply);
  });

  app.post<{ Params: { id: string } }>("/circles/:id/fast-forward", async (request, reply) => {
    const circle = find(await readMeanwhile(), request.params.id);
    if (!circle) return notFound(reply);
    const src = body(request);
    const span = spanOf(src);
    if (span === null) return reply.code(400).send({ error: SPAN_ERROR });
    if (!circle.connectionId) return reply.code(409).send({ error: "Choose a model to start" });
    const over = src.allowOverBudget === true;
    const now = Date.now();
    const estimate = await previewFastForward(circle.id, span, now);
    if (estimate && estimate.calls > estimate.left && !over) {
      const left = Math.max(0, estimate.left);
      return reply.code(409).send({
        error: `This uses ${estimate.calls} of ${left} calls left today. Go on?`,
        ...estimate,
        overBudget: true,
      });
    }
    if (!(await startFastForward(circle.id, span, over, now))) {
      return reply.code(409).send({ error: "A run is already live for this Circle" });
    }
    const doc = await readMeanwhile();
    return view(doc, find(doc, circle.id) ?? circle, Date.now());
  });

  app.post<{ Params: { id: string } }>("/circles/:id/fast-forward/cancel", async (request, reply) => {
    if (!find(await readMeanwhile(), request.params.id)) return notFound(reply);
    return { ok: cancelFastForward(request.params.id) };
  });

  // Review queue. Accept a proposed event, veto a proposed or accepted one, edit the text of a notable or major one.
  type Change = (
    event: LifeEvent,
    circle: Circle,
    src: Record<string, unknown>,
  ) => Promise<LifeEvent | { code: number; error: string }>;
  // `from` is checked again inside the write, so an expiry or a second click between read and write gives a 409.
  const changeEvent =
    (from: LifeEvent["status"][], change: Change) =>
    async (
      request: { params: { id: string; eventId: string }; body?: unknown },
      reply: Parameters<typeof notFound>[0],
    ) => {
      const doc = await readMeanwhile();
      const circle = find(doc, request.params.id);
      const event = doc.events.find((e) => e.id === request.params.eventId && e.circleId === request.params.id);
      if (!circle || !event || hiddenBySurprise(doc, circle, event)) return notFound(reply);
      const next = await change(event, circle, body(request));
      if ("error" in next) return reply.code(next.code).send({ error: next.error });
      let moved = false;
      await updateMeanwhile((d) => {
        const now = d.events.find((e) => e.id === next.id);
        moved = !now || !from.includes(now.status);
        return moved
          ? d
          : {
              ...d,
              events: d.events.map((e) => (e.id === next.id ? { ...e, text: next.text, status: next.status } : e)),
            };
      });
      return moved ? reply.code(409).send({ error: "This event changed. Reload and try again." }) : { ok: true };
    };
  type EventParams = { Params: { id: string; eventId: string } };

  app.post<EventParams>(
    "/circles/:id/events/:eventId/accept",
    changeEvent(["proposed"], async (e) =>
      e.status === "proposed"
        ? { ...e, status: "accepted" }
        : { code: 409, error: "Only an event that waits can be accepted" },
    ),
  );
  app.post<EventParams>(
    "/circles/:id/events/:eventId/veto",
    changeEvent(["proposed", "accepted"], async (e) =>
      e.status === "proposed" || e.status === "accepted"
        ? { ...e, status: "vetoed" }
        : { code: 409, error: "This event is already gone" },
    ),
  );
  app.patch<EventParams>(
    "/circles/:id/events/:eventId",
    changeEvent(["accepted", "proposed"], async (e, circle, src) => {
      const text = typeof src.text === "string" ? src.text.trim().replace(/\s+/g, " ") : "";
      if (e.weight !== "notable" && e.weight !== "major")
        return { code: 409, error: "Only notable and major events can be edited" };
      if (e.status !== "accepted" && e.status !== "proposed") return { code: 409, error: "This event is already gone" };
      if (!text || text.length > 140) return { code: 400, error: "Text must have 1 to 140 characters" };
      const { personas, cast } = await readSchedules(circle);
      if (
        bannedWords(
          personas,
          Object.values(cast).map((c) => c.name),
        ).test(text)
      ) {
        return { code: 400, error: "The text must not name or address you" };
      }
      return { ...e, text };
    }),
  );

  // Nudges: the user steers a Circle ("this week Lily gets a job offer"). The deck turns each into one seed.
  app.get<{ Params: { id: string } }>("/circles/:id/nudges", async (request, reply) => {
    const doc = await readMeanwhile();
    const circle = find(doc, request.params.id);
    if (!circle) return notFound(reply);
    const events = new Map(doc.events.map((e) => [e.id, e]));
    const nudges = doc.nudges
      .filter((n) => n.circleId === circle.id)
      .slice(-30)
      .reverse();
    return {
      nudges: nudges.map((n) => {
        const e = n.eventId ? events.get(n.eventId) : undefined;
        return e && !hiddenBySurprise(doc, circle, e)
          ? { ...n, event: { text: e.text, day: msToWall(Date.parse(e.start), circle.clock.timezone).slice(0, 10) } }
          : n;
      }),
    };
  });

  app.post<{ Params: { id: string } }>("/circles/:id/nudges", async (request, reply) => {
    const circle = find(await readMeanwhile(), request.params.id);
    if (!circle) return notFound(reply);
    const src = body(request);
    const cast: unknown[] = Array.isArray(src.cast) ? [...new Set(src.cast)] : [];
    const text = typeof src.text === "string" ? src.text.trim().replace(/\s+/g, " ") : "";
    const days = src.withinDays === undefined ? 7 : src.withinDays;
    const kinds: string[] = [...(circle.allowedKinds.length ? circle.allowedKinds : KINDS), ...circle.bigKindsAllowed];
    const error =
      cast.length < 1 || cast.length > 2 || cast.some((id) => typeof id !== "string" || !circle.castIds.includes(id))
        ? "Pick 1 or 2 people from the cast"
        : !text || text.length > 140
          ? "Text must have 1 to 140 characters"
          : typeof src.kind !== "string" || !kinds.includes(src.kind)
            ? "This kind is not allowed in this Circle"
            : typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 7
              ? "Days must be a whole number from 1 to 7"
              : null;
    if (error) return reply.code(400).send({ error });
    // The window starts at the first Circle day that is not dealt yet, so a new nudge gets all its days.
    const nowMs = circleNowMs(circle.clock, Date.now());
    const tz = circle.clock.timezone;
    const dealt = new Set((await readMeanwhile()).dealtDays);
    let day = msToWall(nowMs, tz).slice(0, 10);
    const today = day;
    while (dealt.has(`${circle.id}:${day}`)) day = shiftDay(day, 1);
    const createdCircle = new Date(day === today ? nowMs : (wallToMs(`${day}T00:00`, tz) ?? nowMs)).toISOString();
    const nudge: Nudge = {
      id: randomUUID(),
      circleId: circle.id,
      cast: cast as string[],
      text,
      kind: src.kind as string,
      withinDays: days as number,
      createdCircle,
      status: "open",
    };
    let added = false;
    await updateMeanwhile((d) => {
      added = d.nudges.filter((n) => n.circleId === circle.id && n.status === "open").length < NUDGE_MAX_OPEN;
      return added ? { ...d, nudges: [...d.nudges, nudge] } : d;
    });
    return added ? nudge : reply.code(409).send({ error: `A Circle can hold ${NUDGE_MAX_OPEN} open nudges` });
  });

  app.delete<{ Params: { id: string; nudgeId: string } }>("/circles/:id/nudges/:nudgeId", async (request, reply) => {
    const nudge = (await readMeanwhile()).nudges.find(
      (n) => n.id === request.params.nudgeId && n.circleId === request.params.id,
    );
    if (!nudge) return notFound(reply);
    if (nudge.status !== "open") return reply.code(409).send({ error: "Only an open nudge can be removed" });
    await updateMeanwhile((d) => ({
      ...d,
      nudges: d.nudges.filter((n) => n.id !== nudge.id || n.status !== "open"),
      seeds: d.seeds.filter((s) => s.nudgeId !== nudge.id),
    }));
    return { ok: true };
  });

  // Plans that the characters said in chat, newest first.
  app.get<{ Params: { id: string } }>("/circles/:id/promises", async (request, reply) => {
    const doc = await readMeanwhile();
    if (!find(doc, request.params.id)) return notFound(reply);
    return {
      promises: doc.promises
        .filter((p) => p.circleId === request.params.id)
        .sort((a, b) => b.due.localeCompare(a.due))
        .slice(0, 30)
        .map(({ id, characterId, text, due, status, visibility }) => ({
          id,
          characterId,
          text,
          due,
          status,
          visibility,
        })),
    };
  });

  app.get<{ Params: { id: string } }>("/circles/:id/status", async (request, reply) => {
    const doc = await readMeanwhile();
    const circle = find(doc, request.params.id);
    return circle
      ? statusOf(circle, markOf(doc, circle.id), Date.now(), usageRow(doc.usage, circle.id, Date.now()).calls)
      : notFound(reply);
  });
};
