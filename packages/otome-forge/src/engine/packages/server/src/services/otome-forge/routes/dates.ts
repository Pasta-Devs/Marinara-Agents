// ──────────────────────────────────────────────
// Otome Forge: the date routes (plan M5 "Date Night"; #2303, dates won from Wish)
// ──────────────────────────────────────────────
// GET  /runs/:run/dates                                         → DatesView
// POST /runs/:run/dates/pulled {item, cast, herLook, gift?}     → {chapter: ChapterView, date: DateEntry, resumed}:
//                                                               #2303, a date won from Wish with whoever she takes;
//                                                               her look is BASE_LOOK or one she owns, worn as Wear at
//                                                               home does before the date is planned; `gift` (#2128)
//                                                               one she owns from the Shop
// POST /runs/:run/dates/:key/finish                             → DateFinishResult
// POST /runs/:run/art/keepsake/prompt {key}                     → {prompt, negativePrompt}
// POST /runs/:run/art/keepsake {key, prompt?, negativePrompt?}  → {paint}
// POST /runs/:run/photos/prompt {li, place, hisLook, herLook, his, her} → {prompt, negativePrompt} (#2087: no paint;
//   it saves only the looks' free cut-outs, 0.36.7)
// POST /runs/:run/photos {id, ...setup, prompt?, negativePrompt?} → {photo: PhotoView}: one image, on the tap
// POST /runs/:run/photos/:id/delete                             → {deleted: true}
// A date's scenes are written and read through the story routes (chapter `date-<n>`). Date Night is no longer started
// (#2303): its dates already saved are read, finished and kept as before. A pulled date she has not won is a 404, a
// company that is empty or names someone twice a 400, and one where everyone has been on it a 409 `conflict` (it only
// replays for them); one with the same company still open is returned (`resumed`). Planning may fail with 503
// `no-connection`, 422 `declined` or 502 `bad-format` (nothing is saved), and a Cancel while it runs is a 409
// `conflict`. A gift she does not own is a 409 `conflict`, and the aphrodisiac under SFW Heat a 409 `locked`, both
// before anything is planned; it is spent only by the write that saves a new date, never by a resumed one
// (S/minigames/date-night.ts). Finishing needs the last scene
// read (409 `conflict`) and counts once; a replay answers the same outcome with no grants. The keepsake paints only on
// the player's tap (+1 image), once the date is finished: 503 `no-connection` without an image connection, 409 `busy`
// while it is being painted, and a ready one is never painted again.
// The Photo Shoot (S/minigames/photo-shoot.ts) paints one photo of the two of them on the tap and calls no model: a
// resend with the same id waits for, or answers, the same photo. It wears nothing; a photo is deleted on request,
// except while it paints (409 `busy`). The list is the Album's `photos` and Home's `photo`.
// #2156: while his grievance with her stands, starting or finishing a date with him and the Photo Shoot are a 409
// `locked`, before anything is worn, given, planned or painted (S/minigames/date-night.ts assertFreeToDate); on a date
// with several (#2303), that is so while any of them holds one.
import { z } from "zod";
import { GIFT_IDS } from "../../../../../client/src/features/otome-forge/shared/shop.js";
import { OtomeForgeError, debugModeOf, parseBody, runParam, type OtomeRequest, type RegisterRoutes } from "../http.js";
import { isLiId } from "../ids.js";
import { wearLook } from "./wardrobe.js";
import {
  assertFreeToDate,
  checkPulledDate,
  datesView,
  finishDate,
  isDateKey,
  keepsakePromptFor,
  paintKeepsake,
  startPulledDate,
} from "../minigames/date-night.js";
import { PhotoSetupSchema, deletePhoto, photoPromptFor, takePhoto } from "../minigames/photo-shoot.js";
import { PHOTO_ID, isPhotoId } from "../../../../../client/src/features/otome-forge/shared/photos.js";
import { toChapterView } from "../schemas/story.js";
import { cancellable } from "../story/beats.js";

const LOOK_ID = z.string().min(1).max(80);
// #2303: a date won from Wish, with one love interest or several.
const PulledBody = z.object({
  item: z.string().min(1).max(80),
  cast: z.array(z.string().min(1).max(80)).min(1).max(20),
  herLook: LOOK_ID,
  gift: z.enum(GIFT_IDS).optional(),
});
const NoFields = z.object({});
const KeyBody = z.object({ key: z.string().min(1).max(40) });
const PaintBody = z.object({
  key: z.string().min(1).max(40),
  prompt: z.string().max(4000).optional(),
  negativePrompt: z.string().max(4000).optional(),
});

const PhotoBody = PhotoSetupSchema.extend({
  id: z.string().regex(PHOTO_ID),
  prompt: z.string().max(4000).optional(),
  negativePrompt: z.string().max(4000).optional(),
});

/** The `:id` param as a photo id, or a 404. */
function photoParam(request: OtomeRequest): string {
  const id = request.params && typeof request.params === "object" ? (request.params as { id?: unknown }).id : undefined;
  if (!isPhotoId(id)) throw new OtomeForgeError(404, "No such photo.", "not-found");
  return id;
}

/** A date key, or a 404 (a malformed key names no date). */
function dateKey(value: unknown): string {
  if (!isDateKey(value)) throw new OtomeForgeError(404, "No such date.", "not-found");
  return value;
}

const keyParam = (request: OtomeRequest) =>
  dateKey(request.params && typeof request.params === "object" ? (request.params as { key?: unknown }).key : undefined);

export const registerDateRoutes: RegisterRoutes = (router, deps) => {
  const { handle } = deps;

  router.get(
    "/runs/:run/dates",
    handle(async (request) => datesView(deps, runParam(request).runId)),
  );

  router.post(
    "/runs/:run/dates/pulled",
    handle(async (request) => {
      const input = parseBody(PulledBody, request.body);
      const { runId } = runParam(request);
      if (!input.cast.every(isLiId)) throw new OtomeForgeError(404, "No such love interest.", "not-found");
      const debugMode = debugModeOf(request);
      // Refused before anything is worn, given or planned: a date she has not won, a company it cannot have (a
      // grievance of theirs with her included), one where everyone has been on it, or a gift she cannot give.
      await checkPulledDate(deps, runId, input);
      // Her look is worn as Wear at home wears it (owned and painted, or a 4xx), so the date's plan, scenes, key image
      // and keepsake dress her in it; the love interests come as they are dressed. It stays worn afterwards.
      await wearLook(deps, runId, { owner: "me", look: input.herLook }, { debugMode });
      const { chapter, date, resumed } = await cancellable(deps, runId, (signal) =>
        startPulledDate(deps, runId, input, { debugMode, signal }),
      );
      return { chapter: toChapterView(chapter), date, resumed };
    }),
  );

  router.post(
    "/runs/:run/dates/:key/finish",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const { runId } = runParam(request);
      return finishDate(deps, runId, keyParam(request));
    }),
  );

  router.post(
    "/runs/:run/art/keepsake/prompt",
    handle(async (request) => {
      const { key } = parseBody(KeyBody, request.body);
      const { runId } = runParam(request);
      const { prompt, negativePrompt } = await keepsakePromptFor(deps, runId, dateKey(key));
      return { prompt, negativePrompt };
    }),
  );

  router.post(
    "/runs/:run/art/keepsake",
    handle(async (request) => {
      const { key, prompt, negativePrompt } = parseBody(PaintBody, request.body);
      const { runId } = runParam(request);
      const paint = await paintKeepsake(deps, runId, dateKey(key), {
        prompt,
        negativePrompt,
        debugMode: debugModeOf(request),
      });
      return { paint };
    }),
  );

  router.post(
    "/runs/:run/photos/prompt",
    handle(async (request) => {
      const setup = parseBody(PhotoSetupSchema, request.body);
      if (isLiId(setup.li)) await assertFreeToDate(deps.store, runParam(request).runId, setup.li);
      return photoPromptFor(deps, runParam(request).runId, setup);
    }),
  );

  router.post(
    "/runs/:run/photos",
    handle(async (request) => {
      const input = parseBody(PhotoBody, request.body);
      if (isLiId(input.li)) await assertFreeToDate(deps.store, runParam(request).runId, input.li);
      const photo = await takePhoto(deps, runParam(request).runId, input, { debugMode: debugModeOf(request) });
      return { photo };
    }),
  );

  router.post(
    "/runs/:run/photos/:id/delete",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const { runId } = runParam(request);
      return deletePhoto(deps, runId, photoParam(request));
    }),
  );
};
