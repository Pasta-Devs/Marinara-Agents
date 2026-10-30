// ──────────────────────────────────────────────
// Otome Hearth: the Read Me routes and each love interest's notebook (#1945)
// ──────────────────────────────────────────────
// POST /runs/:run/read-me {li}                                 → ReadMeSetView: their unfinished set, or a new one
// POST /runs/:run/read-me/:set/answer {guess, verdict, words?} → ReadMeAnswer {verdict, reaction, face, words?}
// POST /runs/:run/read-me/:set/finish                          → ReadMeFinishResult {grants, starlight, known}
// GET  /runs/:run/lis/:li/notebook                             → NotebookView {li, entries} (newest last)
// POST /runs/:run/lis/:li/notebook {action: "edit", id, words} | {action: "delete", id} → NotebookView
// A guess's reaction reaches the client only in its answer, and its first answer is final. Finishing pays and fills
// the notebook once (a replay returns what was paid) and needs every guess answered (409 `conflict`). Writing a set
// may fail with 503 `no-connection`, 422 `declined` or 502 `bad-format`, and nothing is saved then. The player's words
// that sound medical are a 400 `bad-request` with nothing saved; an unknown notebook entry is a 404. The notebook routes
// sit under the love interest (/lis/:li), not /read-me, so `:set` and `:li` never share a path segment; edit and delete
// are POSTs, the only other method the router has.
import { z } from "zod";
import {
  READ_ME_GUESSES,
  READ_ME_VERDICTS,
  isReadMeSetId,
} from "../../../../../client/src/features/otome-forge/shared/read-me.js";
import {
  OtomeForgeError,
  debugModeOf,
  liParam,
  parseBody,
  runParam,
  type OtomeRequest,
  type RegisterRoutes,
} from "../http.js";
import { isLiId } from "../ids.js";
import { answerReadMe, changeNotebook, finishReadMe, readNotebook, startReadMe } from "../minigames/read-me.js";

/** The player's words as sent: room for whitespace and quotes, which are cleaned before the READ_ME_WORDS_MAX cap. */
const WORDS_SENT_MAX = 1000;
const Words = z.string().max(WORDS_SENT_MAX);
const EntryId = z.string().min(1).max(120);

const StartBody = z.object({ li: z.string().min(1).max(80) });
const AnswerBody = z.object({
  guess: z
    .number()
    .int()
    .min(0)
    .max(READ_ME_GUESSES - 1),
  verdict: z.enum(READ_ME_VERDICTS),
  words: Words.optional(),
});
const NoFields = z.object({});
const NotebookBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), id: EntryId, words: Words }),
  z.object({ action: z.literal("delete"), id: EntryId }),
]);

/** The `:set` param, or a 404 (a malformed id names no set). */
function setParam(request: OtomeRequest): string {
  const params = request.params;
  const set = params && typeof params === "object" ? (params as Record<string, unknown>).set : undefined;
  if (!isReadMeSetId(set)) throw new OtomeForgeError(404, "No such Read Me set.", "not-found");
  return set;
}

export const registerReadMeRoutes: RegisterRoutes = (router, deps) => {
  const { handle, store } = deps;

  router.post(
    "/runs/:run/read-me",
    handle(async (request) => {
      const { li } = parseBody(StartBody, request.body);
      const { runId } = runParam(request);
      if (!isLiId(li)) throw new OtomeForgeError(404, "No such love interest.", "not-found");
      return startReadMe(deps, runId, li, { debugMode: debugModeOf(request) });
    }),
  );

  router.post(
    "/runs/:run/read-me/:set/answer",
    handle(async (request) => {
      const body = parseBody(AnswerBody, request.body);
      const { runId } = runParam(request);
      return answerReadMe(deps, runId, setParam(request), body);
    }),
  );

  router.post(
    "/runs/:run/read-me/:set/finish",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const { runId } = runParam(request);
      return finishReadMe(deps, runId, setParam(request));
    }),
  );

  router.get(
    "/runs/:run/lis/:li/notebook",
    handle(async (request) => {
      const { runId } = runParam(request);
      return readNotebook(store, runId, liParam(request));
    }),
  );

  router.post(
    "/runs/:run/lis/:li/notebook",
    handle(async (request) => {
      const change = parseBody(NotebookBody, request.body);
      const { runId } = runParam(request);
      return changeNotebook(store, runId, liParam(request), change);
    }),
  );
};
