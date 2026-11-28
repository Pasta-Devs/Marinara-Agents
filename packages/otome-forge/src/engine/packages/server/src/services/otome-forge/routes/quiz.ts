// ──────────────────────────────────────────────
// Otome Hearth: the personality quiz routes (#2174)
// ──────────────────────────────────────────────
// GET  /runs/:run/quiz                        → QuizView: the statements the player can see, open and answered, with
//                                               each love interest's answers; queues what is missing in the background
// POST /runs/:run/quiz/answer {statement, answer} → QuizView: the answer kept (the first is final), and a refill queued
//                                               once none is left open
// Neither waits for a model call (S/minigames/quiz.ts). A statement the player cannot see is a 404, an answer outside
// 1–5 a 400.
import { z } from "zod";
import type { QuizScore } from "../../../../../client/src/features/otome-forge/shared/quiz.js";
import { debugModeOf, parseBody, runParam, type RegisterRoutes } from "../http.js";
import { answerQuiz, readQuizView } from "../minigames/quiz.js";

const AnswerBody = z.object({
  statement: z.string().min(1).max(12),
  answer: z.number().int().min(1).max(5),
});

export const registerQuizRoutes: RegisterRoutes = (router, deps) => {
  const { handle } = deps;
  router.get(
    "/runs/:run/quiz",
    handle(async (request) => readQuizView(deps, runParam(request).runId, { debugMode: debugModeOf(request) })),
  );
  router.post(
    "/runs/:run/quiz/answer",
    handle(async (request) => {
      const { runId } = runParam(request);
      const body = parseBody(AnswerBody, request.body);
      return answerQuiz(deps, runId, body.statement, body.answer as QuizScore, { debugMode: debugModeOf(request) });
    }),
  );
};
