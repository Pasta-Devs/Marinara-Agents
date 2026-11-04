import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import {
  SPEED_MAX,
  BACKGROUND_EVERY_MS,
  RUN_AHEAD_MS,
  circleNowMs,
  msToWall,
  normalizeSpeed,
  setSpeed,
  setTime,
  validTimezone,
  wallToMs,
  type RunMark,
} from "./clock.js";
import { dueNow, runCircleNow, runDuePass } from "./scheduler.js";
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
  type MeanwhileDocument,
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

function statusOf(circle: Circle, mark: RunMark, now: number) {
  const circleNow = circleNowMs(circle.clock, now);
  return {
    ready: circle.connectionId !== "",
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
    dueReason: dueNow(circle, mark, false, now),
  };
}

const view = (doc: MeanwhileDocument, circle: Circle, now: number) => ({
  ...circle,
  status: statusOf(circle, markOf(doc, circle.id), now),
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

  app.post("/circles", async (request, reply) => {
    const src = body(request);
    const error = await inputError(src);
    if (error) return reply.code(400).send({ error });
    const now = Date.now();
    const base = defaultCircle(randomUUID(), now);
    let circle = applyCircleFields(base, src);
    if (typeof src.sharedWorld !== "boolean") circle = { ...circle, sharedWorld: circle.linkedChatIds.length === 1 };
    if (validTimezone(src.timezone)) circle = { ...circle, clock: { ...circle.clock, timezone: src.timezone } };
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
        const next = applyCircleFields(c, src);
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

  app.get<{ Params: { id: string } }>("/circles/:id/status", async (request, reply) => {
    const doc = await readMeanwhile();
    const circle = find(doc, request.params.id);
    return circle ? statusOf(circle, markOf(doc, circle.id), Date.now()) : notFound(reply);
  });
};
