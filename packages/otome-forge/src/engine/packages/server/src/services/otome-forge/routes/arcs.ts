// ──────────────────────────────────────────────
// Otome Forge: the arc routes (plan M2b "Routes", "Confrontation")
// ──────────────────────────────────────────────
// POST /runs/:run/routes/:li/next                               → {chapter: ChapterView}; his route chapter toward the
//                                                                  next stage (409 `locked`: affection too low, a
//                                                                  rupture, or his route complete)
// POST /runs/:run/repairs/:li                                   → {chapter: ChapterView}; the repair for the rupture
//                                                                  with him ("Make it right"; 409 `conflict` when none)
// POST /runs/:run/chapters/:key/beats/:i/stance {round, stance} → StanceResult {round (the played round's view),
//                                                                  next?, ending?, confrontation, remembered,
//                                                                  rememberedBy}
// All three are idempotent: the chapter a key has is returned as it is, and a stance already taken returns what it
// did (another stance for that round is a 409 `locked`). A Closer (#1938) takes its answers (reassure, tease,
// mirror, ask) on the same route; a move of the other game is a 400 that saves nothing. Planning runs in the run's Cancel scope and may fail as any
// plan does (503 `no-connection`, 422 `declined`, 502 `bad-format`). GET /runs/:run/story carries each love
// interest's `routes` entry and the `repairs` on offer (S/story/chapters.ts).
import { z } from "zod";
import { ALL_CLIMAX_MOVES, CONFRONTATION_ROUNDS } from "../../../../../client/src/features/otome-forge/shared/arcs.js";
import { debugModeOf, liParam, parseBody, reviewModeOf, runParam, type RegisterRoutes } from "../http.js";
import { toChapterView } from "../schemas/story.js";
import { cancellable, chooseStance } from "../story/beats.js";
import { planRepairChapter, planRouteChapter } from "../story/routes-plan.js";
import { beatParams } from "./story.js";

const NoFields = z.object({});
const StanceBody = z.object({
  round: z.number().int().min(1).max(CONFRONTATION_ROUNDS),
  stance: z.enum(ALL_CLIMAX_MOVES),
});

export const registerArcRoutes: RegisterRoutes = (router, deps) => {
  const { handle } = deps;

  router.post(
    "/runs/:run/routes/:li/next",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const { runId } = runParam(request);
      const li = liParam(request);
      const debugMode = debugModeOf(request);
      const chapter = await cancellable(deps, runId, (signal) =>
        planRouteChapter(deps, runId, li, { debugMode, signal }),
      );
      return { chapter: toChapterView(chapter) };
    }),
  );

  router.post(
    "/runs/:run/repairs/:li",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const { runId } = runParam(request);
      const li = liParam(request);
      const debugMode = debugModeOf(request);
      const chapter = await cancellable(deps, runId, (signal) =>
        planRepairChapter(deps, runId, li, { debugMode, signal }),
      );
      return { chapter: toChapterView(chapter) };
    }),
  );

  router.post(
    "/runs/:run/chapters/:key/beats/:i/stance",
    handle(async (request) => {
      const { round, stance } = parseBody(StanceBody, request.body);
      const { runId } = runParam(request);
      const { key, i } = beatParams(request);
      return chooseStance(deps, runId, key, i, round, stance, {
        debugMode: debugModeOf(request),
        review: reviewModeOf(request),
      });
    }),
  );
};
