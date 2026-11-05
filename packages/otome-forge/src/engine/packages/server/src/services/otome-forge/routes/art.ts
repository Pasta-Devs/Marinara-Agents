// ──────────────────────────────────────────────
// Otome Forge: the scene art routes (plan M2b "Art routes"): places, story CGs and their unlock
// ──────────────────────────────────────────────
// GET  /runs/:run/art/scene?key&i                          → SceneArt: the beat's places and CG with their paints, and
//                                                            each love interest's ready faces (the reader polls it
//                                                            while something is painting); in his 5★ look's
//                                                            first-wear scene, him in that look (`looks`), and
//                                                            `lookComing` while that look paints or is cut out
// POST /runs/:run/art/place {place, prompt?, negativePrompt?} → {place, world}; paints that place now (the tap)
// POST /runs/:run/art/place/prompt {place}                 → {prompt, negativePrompt}; for the prompt review dialog
// POST /runs/:run/art/cg {key, i, prompt?, negativePrompt?}  → {art}; paints that beat's CG now (the tap)
// POST /runs/:run/art/cg/prompt {key, i}                   → {prompt, negativePrompt}
// POST /runs/:run/art/cg/seen {key, i}                     → {unlocked, album}; 409 until it is ready and shown
// POST /runs/:run/stickers                                 → {started}; the phone opened: with images on, the
//                                                            protagonist's five stickers start (#2044, once)
// POST /runs/:run/art/sticker {sticker, prompt?, negativePrompt?} → {art}; paints that sticker now (the tap)
// POST /runs/:run/art/sticker/prompt {sticker}             → {prompt, negativePrompt}
// A tap is the consent Ask before painting waits for, and the Retry for a failed or stopped paint: it waits for the
// paint and answers with the record as left (`ready`, or `failed` with Retry). A tap on a ready image changes nothing,
// and a second tap while one paints waits for that same paint, so no tap pays twice. An edited prompt keeps its
// rating and adult tags. Automatic paints start from the beat writer (OtomeArt.queueScenePaints), never from here.
// The looks' own art routes are M1's (routes/setup.ts).
// A his-look5's first-wear scene (`story-<item>`, S/items/character-story.ts) is about that look, so he stands in it
// there instead of the look he wears on Home, on every read of it, also after he wears another: its image (the item's
// own art, so it shows the moment it is painted) cut out like every stage picture (free), and its faces only when a
// set is ready from wearing it. The scene can be read while the look still paints (the first open paints it in the
// background, or after Paint under Ask before painting): his worn look stands in meanwhile, and `lookComing` keeps the
// reader polling until he stands in the new one, cut out. A look waiting for Paint, failed or stopped is not waited
// for. No face set is painted for it here: faces are paid for when he wears a look (S/routes/wardrobe.ts), so the
// scene does not pay for one he may never wear. Worn now, it is his stage look already and needs nothing. A her-look5's
// first-wear scene pins nothing: the protagonist is never on stage, and he stands in the look he wears now.
import { z } from "zod";
import type { SceneArt, Unit } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { cutoutsPending, queueCutouts } from "../art/cutout.js";
import { cgPromptFor, cgView, markCgSeen, paintCgNow } from "../art/cg.js";
import { itemArtView, outfitOf } from "../art/outfits.js";
import { paintStickerNow, startPlayerStickers, stickerPromptFor } from "../art/stickers.js";
import { STICKER_ID } from "../../../../../client/src/features/otome-forge/shared/stickers.js";
import { paintPlaceNow, placePromptFor, readPlace, withPlaceViews } from "../art/places.js";
import { OtomeForgeError, debugModeOf, parseBody, runParam, type OtomeRequest, type RegisterRoutes } from "../http.js";
import { isChapterKey, isItemStoryKey } from "../ids.js";
import { readItem } from "../items/open.js";
import { cleanedFaces, facesComing, readRun, readyCutout, stageArtUrls } from "../schemas/state.js";
import { toWorldView } from "../schemas/world.js";
import type { OtomeStore } from "../store.js";
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
const StickerRef = { sticker: z.string().regex(STICKER_ID) };
const StickerBody = z.object({ ...StickerRef, ...Edited });
const StickerRefBody = z.object(StickerRef);
const NoFields = z.object({});

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

/** The his-look5 whose first-wear scene chapter `key` is (`story-<item>`), else null. */
async function firstWearItem(store: Pick<OtomeStore, "readDoc">, runId: string, key: string) {
  if (!isItemStoryKey(key)) return null;
  const item = await readItem(store, runId, key.slice("story-".length));
  return item?.kind === "his-look5" && item.li ? item : null;
}

export const registerArtRoutes: RegisterRoutes = (router, deps) => {
  const { store, handle } = deps;

  router.get(
    "/runs/:run/art/scene",
    handle(async (request) => {
      const { runId } = runParam(request);
      const query = queryOf(request);
      const { key, i } = beatRef(query.key, query.i);
      const [run, beat, item] = await Promise.all([
        readRun(store, runId),
        readBeat(store, runId, key, i),
        firstWearItem(store, runId, key),
      ]);
      if (!run) throw runNotFound();
      if (!beat) throw new OtomeForgeError(404, "No such beat.", "not-found");
      // The look this scene is about once painted (a look's outfit id is its item's), on him while he does not wear it.
      const painted = item && outfitOf(item);
      const standsIn = (unit: Unit) =>
        painted && unit.id === item?.li && unit.wornOutfit !== painted.id ? painted : undefined;
      const units = await Promise.all(
        run.units.map((unit) => queueCutouts(deps, runId, unit, stageArtUrls(run.world, unit, standsIn(unit)?.url))),
      );
      const faces: SceneArt["faces"] = {};
      const looks: NonNullable<SceneArt["looks"]> = {};
      for (const unit of units) {
        const look = standsIn(unit);
        const ready = cleanedFaces(run.world, unit, look?.url);
        if (ready) faces[unit.id] = ready;
        if (!look) continue;
        const cutout = readyCutout(unit, look.url);
        looks[unit.id] = {
          worn: { id: look.id, url: cutout ?? look.url },
          expressions: ready ?? {},
          cut: [cutout, ...Object.values(ready ?? {})].filter((url): url is string => !!url),
        };
      }
      // Its look still paints, or its free cut-out is on the way: the reader polls, with expressions off too.
      const lookComing =
        (!!item && !painted && itemArtView(runId, item)?.state === "pending") ||
        units.some((unit) => !!looks[unit.id] && cutoutsPending(runId, [unit]));
      const scene: SceneArt = {
        places: beat.places.map((place) => readPlace(run.world, runId, place.name) ?? place),
        cg: cgView(runId, beat),
        faces,
        // A first-wear look's faces come only from wearing it: only its free cut-outs are waited for here.
        facesComing: units
          .filter((unit) => (!looks[unit.id] && facesComing(run.world, unit)) || cutoutsPending(runId, [unit]))
          .map((unit) => unit.id),
        ...(Object.keys(looks).length ? { looks } : {}),
        ...(lookComing ? { lookComing } : {}),
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
    "/runs/:run/stickers",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      return { started: await startPlayerStickers(deps, runParam(request).runId) };
    }),
  );

  router.post(
    "/runs/:run/art/sticker",
    handle(async (request) => {
      const body = parseBody(StickerBody, request.body);
      const { runId } = runParam(request);
      const art = await paintStickerNow(deps, runId, body.sticker, {
        debugMode: debugModeOf(request),
        edited: { prompt: body.prompt, negativePrompt: body.negativePrompt },
        active: deps.art?.active,
      });
      return { art };
    }),
  );

  router.post(
    "/runs/:run/art/sticker/prompt",
    handle(async (request) => {
      const { sticker } = parseBody(StickerRefBody, request.body);
      const { prompt, negativePrompt } = await stickerPromptFor(deps, runParam(request).runId, sticker);
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
