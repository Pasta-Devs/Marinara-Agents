// ──────────────────────────────────────────────
// Otome Forge: the Date Night routes (plan M5 "Date Night")
// ──────────────────────────────────────────────
// GET  /runs/:run/dates                                         → DatesView
// POST /runs/:run/dates {li, place, storyPlace?, herLook, hisLook} → {chapter: ChapterView, date: DateEntry, resumed}
//                                                               each look is BASE_LOOK or a look item its wearer owns,
//                                                               worn as Wear at home does before the date is planned
// POST /runs/:run/dates/:key/finish                             → DateFinishResult
// POST /runs/:run/art/keepsake/prompt {key}                     → {prompt, negativePrompt}
// POST /runs/:run/art/keepsake {key, prompt?, negativePrompt?}  → {paint}
// POST /runs/:run/photos/prompt {li, place, hisLook, herLook, his, her} → {prompt, negativePrompt} (#2087: no write)
// POST /runs/:run/photos {id, ...setup, prompt?, negativePrompt?} → {photo: PhotoView}: one image, on the tap
// POST /runs/:run/photos/:id/delete                             → {deleted: true}
// A date's scenes are written and read through the story routes (chapter `date-<n>`). Starting while a date with that
// love interest is open returns it (`resumed`). Place "story" goes to one of the story's painted places
// (`storyPlace`, its key in world.places; 400 `bad-request` for a place the story does not have). Planning may fail with 503 `no-connection`, 422 `declined` or 502
// `bad-format` (nothing is saved), and a Cancel while it runs is a 409 `conflict`. Finishing needs the last scene read
// (409 `conflict`) and counts once; a replay answers the same outcome with no grants. The keepsake paints only on the
// player's tap (+1 image), once the date is finished: 503 `no-connection` without an image connection, 409 `busy`
// while it is being painted, and a ready one is never painted again.
// The Photo Shoot (S/minigames/photo-shoot.ts) paints one photo of the two of them on the tap and calls no model: a
// resend with the same id waits for, or answers, the same photo. It wears nothing; a photo is deleted on request,
// except while it paints (409 `busy`). The list is the Album's `photos` and Home's `photo`.
import { z } from "zod";
import { DATE_PLACE_KINDS, type DatePlace } from "../../../../../client/src/features/otome-forge/shared/dates.js";
import { OtomeForgeError, debugModeOf, parseBody, runParam, type OtomeRequest, type RegisterRoutes } from "../http.js";
import { isLiId } from "../ids.js";
import { wearLook } from "./wardrobe.js";
import {
  datesView,
  finishDate,
  isDateKey,
  keepsakePromptFor,
  paintKeepsake,
  startDate,
} from "../minigames/date-night.js";
import { PhotoSetupSchema, deletePhoto, photoPromptFor, takePhoto } from "../minigames/photo-shoot.js";
import { PHOTO_ID, isPhotoId } from "../../../../../client/src/features/otome-forge/shared/photos.js";
import { toChapterView } from "../schemas/story.js";
import { cancellable } from "../story/beats.js";

const LOOK_ID = z.string().min(1).max(80);
const StartBody = z.object({
  li: z.string().min(1).max(80),
  place: z.enum(DATE_PLACE_KINDS as [DatePlace, ...DatePlace[]]),
  storyPlace: z.string().min(1).max(80).optional(),
  herLook: LOOK_ID,
  hisLook: LOOK_ID,
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
    "/runs/:run/dates",
    handle(async (request) => {
      const input = parseBody(StartBody, request.body);
      const { runId } = runParam(request);
      if (!isLiId(input.li)) throw new OtomeForgeError(404, "No such love interest.", "not-found");
      const debugMode = debugModeOf(request);
      // The looks picked for the date are worn, as Wear at home wears them (owned and painted, or a 4xx), so the
      // date's plan, scenes, faces, key images and keepsake all dress them in it. A resumed date keeps what it was
      // planned with; the looks stay worn afterwards.
      await wearLook(deps, runId, { owner: "me", look: input.herLook }, { debugMode });
      await wearLook(deps, runId, { owner: input.li, look: input.hisLook }, { debugMode });
      const { chapter, date, resumed } = await cancellable(deps, runId, (signal) =>
        startDate(deps, runId, input, { debugMode, signal }),
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
      return photoPromptFor(deps, runParam(request).runId, setup);
    }),
  );

  router.post(
    "/runs/:run/photos",
    handle(async (request) => {
      const input = parseBody(PhotoBody, request.body);
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
