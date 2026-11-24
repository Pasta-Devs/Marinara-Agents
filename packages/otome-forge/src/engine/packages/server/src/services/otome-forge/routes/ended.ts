// ──────────────────────────────────────────────
// Otome Hearth: an ended story only opens to look at (#2459)
// ──────────────────────────────────────────────
// Once its epilogue is read to its end (`state.ended`), every POST under /runs/:run/ is a 409 `locked`, but for the
// ones that play nothing and call no model: opening, deleting or cancelling the story, its settings and audio
// settings, reading its scenes again (a scene not written yet is refused where it is served, S/story/beats.ts), marks
// of what was seen, favourite lines, who Home shows, stopping the toys and deleting a photo. The Messages heartbeat
// answers "disabled" (S/routes/phone.ts); opening Home, Games or the story starts no background work.
import { OtomeForgeError, runParam, type OtomeRouter, type RouteHandler } from "../http.js";
import { stateId } from "../ids.js";
import { normalizeState } from "../schemas/state.js";
import type { OtomeStore } from "../store.js";

/** The POSTs an ended story still takes. */
const STILL_OPEN = new Set([
  "/runs/:run/activate",
  "/runs/:run/delete",
  "/runs/:run/cancel",
  "/runs/:run/settings",
  "/runs/:run/audio/settings",
  "/runs/:run/chapters/:key/beats/:i",
  "/runs/:run/chapters/:key/beats/:i/read",
  "/runs/:run/art/cg/seen",
  "/runs/:run/favorites",
  "/runs/:run/items/:item/seen",
  "/runs/:run/phone/:li/seen",
  "/runs/:run/phone/group/seen",
  "/runs/:run/phone/due",
  "/runs/:run/home/set",
  "/runs/:run/haptics/stop",
  "/runs/:run/photos/:id/delete",
]);

/** True when the run behind `request` has ended. */
export async function runEnded(store: Pick<OtomeStore, "readDoc">, runId: string): Promise<boolean> {
  return !!(await store.readDoc(stateId(runId), normalizeState))?.ended;
}

/** The router, with each POST that plays something refused once its story has ended (see the header). */
export function endedGuard(router: OtomeRouter, store: Pick<OtomeStore, "readDoc">): OtomeRouter {
  const guard =
    (path: string, handler: RouteHandler): RouteHandler =>
    async (request, reply) => {
      if (path.startsWith("/runs/:run/") && !STILL_OPEN.has(path)) {
        let runId: string | null = null;
        try {
          runId = runParam(request).runId;
        } catch {
          // A malformed run is the handler's own 404.
        }
        if (runId && (await runEnded(store, runId))) {
          const ended = new OtomeForgeError(409, "This story has ended. It still opens to look at.", "locked");
          return reply.status(ended.statusCode).send({ error: ended.message, code: ended.code });
        }
      }
      return handler(request, reply);
    };
  return {
    get: (path, handler) => router.get(path, handler),
    post: ((path: string, second: unknown, third?: unknown) =>
      third === undefined
        ? router.post(path, guard(path, second as RouteHandler))
        : router.post(path, second as never, guard(path, third as RouteHandler))) as OtomeRouter["post"],
  };
}
