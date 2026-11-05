// ──────────────────────────────────────────────
// Otome Forge: the Read Him routes (plan M5 "Read Him")
// ──────────────────────────────────────────────
// POST /runs/:run/read-him {li}                      → ReadHimSetView: his unfinished set at his stage, or a new one
// POST /runs/:run/read-him/:set/answer {round, pick} → ReadHimAnswer {pick, correct, trueIndex, thought, tellLearned?}
// POST /runs/:run/read-him/:set/finish               → ReadHimFinishResult {grants, starlight}
// A round's truth reaches the client only in its answer, and its first pick is the answer. Finishing pays once (a
// replay returns what was paid) and needs every round answered (409 `conflict`). Writing a set may fail with 503
// `no-connection`, 422 `declined` or 502 `bad-format`, and nothing is saved then.
import { z } from "zod";
import {
  READINGS_MAX,
  READ_HIM_ROUNDS,
  isReadHimSetId,
} from "../../../../../client/src/features/otome-forge/shared/read-him.js";
import { OtomeForgeError, debugModeOf, parseBody, runParam, type OtomeRequest, type RegisterRoutes } from "../http.js";
import { isLiId } from "../ids.js";
import { answerReadHim, finishReadHim, startReadHim } from "../minigames/read-him.js";

const StartBody = z.object({ li: z.string().min(1).max(80) });
const AnswerBody = z.object({
  round: z
    .number()
    .int()
    .min(0)
    .max(READ_HIM_ROUNDS - 1),
  pick: z
    .number()
    .int()
    .min(0)
    .max(READINGS_MAX - 1),
});
const NoFields = z.object({});

/** The `:set` param, or a 404 (a malformed id names no set). */
function setParam(request: OtomeRequest): string {
  const params = request.params;
  const set = params && typeof params === "object" ? (params as Record<string, unknown>).set : undefined;
  if (!isReadHimSetId(set)) throw new OtomeForgeError(404, "No such Read Him set.", "not-found");
  return set;
}

export const registerReadHimRoutes: RegisterRoutes = (router, deps) => {
  const { handle } = deps;

  router.post(
    "/runs/:run/read-him",
    handle(async (request) => {
      const { li } = parseBody(StartBody, request.body);
      const { runId } = runParam(request);
      if (!isLiId(li)) throw new OtomeForgeError(404, "No such love interest.", "not-found");
      return startReadHim(deps, runId, li, { debugMode: debugModeOf(request) });
    }),
  );

  router.post(
    "/runs/:run/read-him/:set/answer",
    handle(async (request) => {
      const { round, pick } = parseBody(AnswerBody, request.body);
      const { runId } = runParam(request);
      return answerReadHim(deps, runId, setParam(request), round, pick);
    }),
  );

  router.post(
    "/runs/:run/read-him/:set/finish",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const { runId } = runParam(request);
      return finishReadHim(deps, runId, setParam(request), { debugMode: debugModeOf(request) });
    }),
  );
};
