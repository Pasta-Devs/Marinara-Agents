// ──────────────────────────────────────────────
// Otome Forge: the scene art routes (plan M2b "Art routes"): places, story CGs and their unlock
// ──────────────────────────────────────────────
// GET  /runs/:run/art/scene?key&i                          → SceneArt: the beat's places and CG with their paints, and
//                                                            each love interest's ready faces (the reader polls it
//                                                            while something is painting)
// POST /runs/:run/art/place {place, prompt?, negativePrompt?} → {place, world}; paints that place now (the tap)
// POST /runs/:run/art/place/prompt {place}                 → {prompt, negativePrompt}; for the prompt review dialog
// POST /runs/:run/art/cg {key, i, prompt?, negativePrompt?}  → {art}; paints that beat's CG now (the tap)
// POST /runs/:run/art/cg/prompt {key, i}                   → {prompt, negativePrompt}
// POST /runs/:run/art/cg/seen {key, i}                     → {unlocked, album}; 409 until it is ready and shown
// A tap is the consent Ask before painting waits for, and the Retry for a failed or stopped paint: it waits for the
// paint and answers with the record as left (`ready`, or `failed` with Retry). A tap on a ready image changes nothing,
// and a second tap while one paints waits for that same paint, so no tap pays twice. An edited prompt keeps its
// rating and adult tags. Automatic paints start from the beat writer (OtomeArt.queueScenePaints), never from here.
// The looks' own art routes are M1's (routes/setup.ts).
import { z } from "zod";
import type { SceneArt } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { cgPromptFor, cgView, markCgSeen, paintCgNow } from "../art/cg.js";
import { paintPlaceNow, placePromptFor, readPlace, withPlaceViews } from "../art/places.js";
import { OtomeForgeError, debugModeOf, parseBody, runParam, type OtomeRequest, type RegisterRoutes } from "../http.js";
import { isChapterKey } from "../ids.js";
import { facesComing, readRun, readyFaces } from "../schemas/state.js";
import { toWorldView } from "../schemas/world.js";
import { readBeat } from "../story/canon.js";

const PROMPT_MAX = 4000;
const BEAT_MAX = 99;

const Edited = {
  prompt: z.string().max(PROMPT_MAX).optional(),
  negativePrompt: z.string().max(PROMPT_MAX).optional(),
};
const PlaceBody = z.object({ place: z.string().min(1).max(120), ...Edited });
const PlacePromptBody = z.object({ place: z.string().min(1).max(120) });
const BeatRef = { key: z.string().min(1).max(120), i: z.number().int().min(0).max(BEAT_MAX) };
const CgBody = z.object({ ...BeatRef, ...Edited });
const CgRefBody = z.object(BeatRef);

const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");

/** A beat named by `key` and `i`, or a 404 (a malformed one names no beat). */
function beatRef(key: unknown, i: unknown): { key: string; i: number } {
  const index = typeof i === "string" && /^\d{1,2}$/.test(i) ? Number(i) : i;
  if (!isChapterKey(key)) throw new OtomeForgeError(404, "No such chapter.", "not-found");
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index > BEAT_MAX) {
    throw new OtomeForgeError(404, "No such beat.", "not-found");
  }
  return { key, i: index };
}

const queryOf = (request: OtomeRequest) =>
  request.query && typeof request.query === "object" ? (request.query as Record<string, unknown>) : {};

export const registerArtRoutes: RegisterRoutes = (router, deps) => {
  const { store, handle } = deps;

  router.get(
    "/runs/:run/art/scene",
    handle(async (request) => {
      const { runId } = runParam(request);
      const query = queryOf(request);
      const { key, i } = beatRef(query.key, query.i);
      const [run, beat] = await Promise.all([readRun(store, runId), readBeat(store, runId, key, i)]);
      if (!run) throw runNotFound();
      if (!beat) throw new OtomeForgeError(404, "No such beat.", "not-found");
      const faces: SceneArt["faces"] = {};
      for (const unit of run.units) {
        const ready = readyFaces(run.world, unit);
        if (ready) faces[unit.id] = ready;
      }
      const scene: SceneArt = {
        places: beat.places.map((place) => readPlace(run.world, runId, place.name) ?? place),
        cg: cgView(runId, beat),
        faces,
        facesComing: run.units.filter((unit) => facesComing(run.world, unit)).map((unit) => unit.id),
      };
      return scene;
    }),
  );

  router.post(
    "/runs/:run/art/place",
    handle(async (request) => {
      const { place, prompt, negativePrompt } = parseBody(PlaceBody, request.body);
      const { runId } = runParam(request);
      const painted = await paintPlaceNow(deps, runId, place, {
        debugMode: debugModeOf(request),
        edited: { prompt, negativePrompt },
      });
      const run = await readRun(store, runId);
      if (!run) throw runNotFound();
      return { place: painted, world: toWorldView(withPlaceViews(runId, run.world)) };
    }),
  );

  router.post(
    "/runs/:run/art/place/prompt",
    handle(async (request) => {
      const { place } = parseBody(PlacePromptBody, request.body);
      const { runId } = runParam(request);
      const { prompt, negativePrompt } = await placePromptFor(deps, runId, place);
      return { prompt, negativePrompt };
    }),
  );

  router.post(
    "/runs/:run/art/cg",
    handle(async (request) => {
      const body = parseBody(CgBody, request.body);
      const { runId } = runParam(request);
      const { key, i } = beatRef(body.key, body.i);
      const art = await paintCgNow(deps, runId, key, i, {
        debugMode: debugModeOf(request),
        edited: { prompt: body.prompt, negativePrompt: body.negativePrompt },
      });
      return { art: art ?? null };
    }),
  );

  router.post(
    "/runs/:run/art/cg/prompt",
    handle(async (request) => {
      const body = parseBody(CgRefBody, request.body);
      const { runId } = runParam(request);
      const { key, i } = beatRef(body.key, body.i);
      const { prompt, negativePrompt } = await cgPromptFor(deps, runId, key, i);
      return { prompt, negativePrompt };
    }),
  );

  router.post(
    "/runs/:run/art/cg/seen",
    handle(async (request) => {
      const body = parseBody(CgRefBody, request.body);
      const { runId } = runParam(request);
      const { key, i } = beatRef(body.key, body.i);
      return markCgSeen(deps, runId, key, i);
    }),
  );
};
