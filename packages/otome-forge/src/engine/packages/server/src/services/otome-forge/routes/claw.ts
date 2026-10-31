// ──────────────────────────────────────────────
// Otome Forge: the Dates hub's view and the Claw Machine (plan M5)
// ──────────────────────────────────────────────
// GET  /runs/:run/play                                      → PlayView: today's capped earnings, the plush shelf, and
//                                                             how each love interest plays (bible.play), whether a
//                                                             rupture stands between them, whether Date Night with
//                                                             them is Make it right, and their claw and cold lines
// POST /runs/:run/claw/finish {li, round, first, caught, cheered} → ClawFinishResult {grants, newPlush, firstPlush,
//                                                             line?, capped, replay, plush, starlight}
// A finish never calls a model or paints an image (S/minigames/claw.ts). GET /play only queues, in the background, the
// drawing of a love interest's own plush when they have none yet (#1954, S/minigames/plush.ts); it never waits for one.
// A finish is answered once per round id: the same body sent again (a lost answer, a double tap) is a replay that pays
// nothing.
import { forgeDayKey } from "@forge-kit/time-zone-server.mjs";
import { z } from "zod";
import {
  CLAW_MAX_CATCHES,
  CLAW_ROUND_ID,
  type ClawFinishResult,
} from "../../../../../client/src/features/otome-forge/shared/claw.js";
import { OtomeForgeError, debugModeOf, parseBody, runParam, type OtomeRouter, type RouteDeps } from "../http.js";
import { isLiId, runDocTarget, stateId, unitId } from "../ids.js";
import { finishClawRound, playView } from "../minigames/claw.js";
import { makeItRightView } from "../minigames/date-night.js";
import { ensurePlushArt } from "../minigames/plush.js";
import { normalizeState, readRun } from "../schemas/state.js";
import { normalizeUnit } from "../schemas/unit.js";

const ClawPlayer = z.enum(["me", "partner"]);
const FinishBody = z.object({
  li: z.string().min(1).max(80),
  round: z.string().regex(CLAW_ROUND_ID),
  first: ClawPlayer,
  caught: z.array(z.object({ prize: z.string().min(1).max(100), by: ClawPlayer })).max(CLAW_MAX_CATCHES),
  cheered: z.boolean(),
});

const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
const liNotFound = () => new OtomeForgeError(404, "No such love interest.", "not-found");

export function registerClawRoutes(
  router: OtomeRouter,
  deps: Pick<RouteDeps, "store" | "handle" | "runtime" | "background">,
): void {
  const { store, handle, runtime } = deps;
  router.get(
    "/runs/:run/play",
    handle(async (request) => {
      const { runId } = runParam(request);
      const run = await readRun(store, runId);
      if (!run) throw runNotFound();
      // Each love interest's own plush is drawn once, in the background; until then theirs wears their look.
      void ensurePlushArt(deps, runId, Object.keys(run.state.lis), { debugMode: debugModeOf(request) }).catch(
        (error: unknown) =>
          runtime.logger.warn(
            "[otome-forge] Plushies not queued: %s",
            error instanceof Error ? error.message : String(error),
          ),
      );
      const dates = await makeItRightView(store, runId, run.state);
      return playView(run.state, run.units, forgeDayKey(Date.now()), dates);
    }),
  );

  router.post(
    "/runs/:run/claw/finish",
    handle(async (request) => {
      const body = parseBody(FinishBody, request.body);
      const { runId } = runParam(request);
      if (!isLiId(body.li)) throw liNotFound();
      const unit = await store.readDoc(unitId(runId, body.li), normalizeUnit);
      if (!unit) throw liNotFound();
      const at = new Date().toISOString();
      const dayKey = forgeDayKey(Date.now());
      // Set by the change that was saved (updateDoc applies it again after a stale revision).
      let result = null as ClawFinishResult | null;
      const saved = await store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
        if (!current.lis[body.li]) throw liNotFound();
        const finished = finishClawRound(current, unit, body, { at, dayKey });
        result = finished.result;
        return finished.state;
      });
      if (!saved || !result) throw runNotFound();
      return result;
    }),
  );
}
