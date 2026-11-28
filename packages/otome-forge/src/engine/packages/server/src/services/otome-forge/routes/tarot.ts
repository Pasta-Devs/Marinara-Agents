// ──────────────────────────────────────────────
// Otome Hearth: the Tarot night routes (#2151)
// ──────────────────────────────────────────────
// GET  /runs/:run/lis/:li/tarot                          → TarotView {open, deck}: their unfinished reading, and the
//                                                          deck cards their readings show (no model call)
// POST /runs/:run/tarot {li, mode, question?, picks}     → TarotReadingView: their unfinished reading, or a new one
// POST /runs/:run/tarot/:reading/answer {card, pick}     → TarotAnswer {pick, reading, reaction, face}
// POST /runs/:run/tarot/:reading/finish                  → TarotFinishResult {grants, starlight}
// POST /runs/:run/art/tarot {li, card, prompt?, negativePrompt?} → {art}: paint a drawn card now (consent, review, Retry)
// POST /runs/:run/art/tarot/prompt {li, card}            → ImagePrompt: the prompt that paint would send
// A reaction reaches the client only in its answer, and its first answer is final; answers are for "you-read" only
// (400). Finishing pays once (a replay returns what was paid) and in "you-read" needs every card answered (409
// `conflict`). Writing a reading may fail with 503 `no-connection`, 422 `declined` or 502 `bad-format`, and nothing is
// saved or claimed then. Picks are three different places among the 22 face-down cards (400 otherwise), and a question
// in the player's own words is at most TAROT_QUESTION_MAX characters (400). A card never drawn with that love interest
// is a 409 `locked` for the art routes.
import { z } from "zod";
import {
  ARCANA,
  TAROT_CARDS,
  TAROT_MODES,
  TAROT_QUESTIONS,
  TAROT_QUESTION_MAX,
  TAROT_READINGS,
  isTarotReadingId,
} from "../../../../../client/src/features/otome-forge/shared/tarot.js";
import { paintTarotCardNow, tarotCardArtPrompt } from "../art/tarot-deck.js";
import { ArtBody as ItemArtBody } from "./items.js";
import {
  OtomeForgeError,
  debugModeOf,
  liParam,
  parseBody,
  reviewModeOf,
  runParam,
  type OtomeRequest,
  type RegisterRoutes,
} from "../http.js";
import { isLiId } from "../ids.js";
import { assertFreeToDate } from "../minigames/date-night.js";
import { answerTarot, finishTarot, readTarot, startTarot } from "../minigames/tarot.js";

const Li = z.string().min(1).max(80);
const StartBody = z.object({
  li: Li,
  mode: z.enum(TAROT_MODES),
  question: z
    .union([z.object({ chip: z.enum(TAROT_QUESTIONS) }), z.object({ own: z.string().max(TAROT_QUESTION_MAX) })])
    .nullable()
    .optional(),
  picks: z
    .array(
      z
        .number()
        .int()
        .min(0)
        .max(ARCANA.length - 1),
    )
    .length(TAROT_CARDS),
});
const AnswerBody = z.object({
  card: z
    .number()
    .int()
    .min(0)
    .max(TAROT_CARDS - 1),
  pick: z
    .number()
    .int()
    .min(0)
    .max(TAROT_READINGS - 1),
});
const NoFields = z.object({});
const CardBody = z.object({ li: Li, card: z.enum(ARCANA) });
const ArtBody = CardBody.merge(ItemArtBody);

/** The `:reading` param, or a 404 (a malformed id names no reading). */
function readingParam(request: OtomeRequest): string {
  const params = request.params;
  const id = params && typeof params === "object" ? (params as Record<string, unknown>).reading : undefined;
  if (!isTarotReadingId(id)) throw new OtomeForgeError(404, "No such Tarot reading.", "not-found");
  return id;
}

const liOf = (li: string) => {
  if (!isLiId(li)) throw new OtomeForgeError(404, "No such love interest.", "not-found");
  return li;
};

export const registerTarotRoutes: RegisterRoutes = (router, deps) => {
  const { handle } = deps;

  router.get(
    "/runs/:run/lis/:li/tarot",
    handle(async (request) => {
      const { runId } = runParam(request);
      return readTarot(deps, runId, liParam(request));
    }),
  );

  router.post(
    "/runs/:run/tarot",
    handle(async (request) => {
      const { li, mode, question, picks } = parseBody(StartBody, request.body);
      const { runId } = runParam(request);
      // #2156: a reading waits (an unfinished one too) while their grievance with her stands.
      await assertFreeToDate(deps.store, runId, liOf(li));
      return startTarot(
        deps,
        runId,
        liOf(li),
        { mode, question: question ?? null, picks },
        { debugMode: debugModeOf(request), review: reviewModeOf(request) },
      );
    }),
  );

  router.post(
    "/runs/:run/tarot/:reading/answer",
    handle(async (request) => {
      const body = parseBody(AnswerBody, request.body);
      const { runId } = runParam(request);
      return answerTarot(deps, runId, readingParam(request), body);
    }),
  );

  router.post(
    "/runs/:run/tarot/:reading/finish",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const { runId } = runParam(request);
      return finishTarot(deps, runId, readingParam(request), { debugMode: debugModeOf(request) });
    }),
  );

  router.post(
    "/runs/:run/art/tarot",
    handle(async (request) => {
      const { li, card, prompt, negativePrompt } = parseBody(ArtBody, request.body);
      const { runId } = runParam(request);
      const art = await paintTarotCardNow(deps, runId, liOf(li), card, {
        debugMode: debugModeOf(request),
        edited: { prompt, negativePrompt },
      });
      return { art };
    }),
  );

  router.post(
    "/runs/:run/art/tarot/prompt",
    handle(async (request) => {
      const { li, card } = parseBody(CardBody, request.body);
      const { runId } = runParam(request);
      return tarotCardArtPrompt(deps, runId, liOf(li), card);
    }),
  );
};
