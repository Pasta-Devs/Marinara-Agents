// ──────────────────────────────────────────────
// Otome Forge: the Date Night routes (plan M5 "Date Night")
// ──────────────────────────────────────────────
// GET  /runs/:run/dates                                         → DatesView
// POST /runs/:run/dates {li, place, storyPlace?, herLook, hisLook} → {chapter: ChapterView, date: DateEntry, resumed}
// POST /runs/:run/dates/:key/finish                             → DateFinishResult
// POST /runs/:run/art/keepsake/prompt {key}                     → {prompt, negativePrompt}
// POST /runs/:run/art/keepsake {key, prompt?, negativePrompt?}  → {paint}
// A date's scenes are written and read through the story routes (chapter `date-<n>`). Starting while a date with that
// love interest is open returns it (`resumed`). Place "story" goes to one of the story's painted places
// (`storyPlace`, its key in world.places; 400 `bad-request` for a place the story does not have). Planning may fail with 503 `no-connection`, 422 `declined` or 502
// `bad-format` (nothing is saved), and a Cancel while it runs is a 409 `conflict`. Finishing needs the last scene read
// (409 `conflict`) and counts once; a replay answers the same outcome with no grants. The keepsake paints only on the
// player's tap (+1 image), once the date is finished: 503 `no-connection` without an image connection, 409 `busy`
// while it is being painted, and a ready one is never painted again.
import { z } from "zod";
import { DATE_PLACE_KINDS, type DatePlace } from "../../../../../client/src/features/otome-forge/shared/dates.js";
import { OtomeForgeError, debugModeOf, parseBody, runParam, type OtomeRequest, type RegisterRoutes } from "../http.js";
import { isLiId } from "../ids.js";
import {
  datesView,
  finishDate,
  isDateKey,
  keepsakePromptFor,
  paintKeepsake,
  startDate,
} from "../minigames/date-night.js";
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
};
