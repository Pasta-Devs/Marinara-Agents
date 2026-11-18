// ──────────────────────────────────────────────
// Otome Hearth: Kitty Cards' finish (0.35.0)
// ──────────────────────────────────────────────
// POST /runs/:run/kitty/finish {li, round, first, result, me, partner, cheat} → KittyFinishResult {grants, capped,
//                                                             replay, starlight}
// A finish never calls a model or paints an image (S/minigames/kitty.ts), and is answered once per game id: the same
// body sent again (a lost answer, a double tap) is a replay that pays nothing. What the game shows before it starts
// (his lines and how he cheats) comes with GET /runs/:run/play (S/routes/claw.ts).
import { forgeDayKey } from "@forge-kit/time-zone-server.mjs";
import { z } from "zod";
import {
  KITTY_POINTS_MAX,
  KITTY_ROUND_ID,
  type KittyFinishResult,
} from "../../../../../client/src/features/otome-forge/shared/kitty.js";
import { OtomeForgeError, parseBody, runParam, type OtomeRouter, type RouteDeps } from "../http.js";
import { isLiId, runDocTarget, stateId, unitId } from "../ids.js";
import { assertFreeToDate } from "../minigames/date-night.js";
import { finishKittyGame } from "../minigames/kitty.js";
import { KittyCheatSchema, normalizeState } from "../schemas/state.js";
import { normalizeUnit } from "../schemas/unit.js";

const Points = z.number().int().min(0).max(KITTY_POINTS_MAX);
const FinishBody = z.object({
  li: z.string().min(1).max(80),
  round: z.string().regex(KITTY_ROUND_ID),
  first: z.enum(["me", "partner"]),
  result: z.enum(["win", "lose", "draw"]),
  me: Points,
  partner: Points,
  cheat: KittyCheatSchema.nullable(),
});

const runNotFound = () => new OtomeForgeError(404, "No such Otome Hearth story.", "not-found");
const liNotFound = () => new OtomeForgeError(404, "No such love interest.", "not-found");

export function registerKittyRoutes(router: OtomeRouter, { store, handle }: Pick<RouteDeps, "store" | "handle">): void {
  router.post(
    "/runs/:run/kitty/finish",
    handle(async (request) => {
      const body = parseBody(FinishBody, request.body);
      const { runId } = runParam(request);
      if (!isLiId(body.li)) throw liNotFound();
      const unit = await store.readDoc(unitId(runId, body.li), normalizeUnit);
      if (!unit) throw liNotFound();
      // #2156: a game pays nothing, and is not counted, while his grievance with her stands.
      await assertFreeToDate(store, runId, body.li);
      const at = new Date().toISOString();
      const dayKey = forgeDayKey(Date.now());
      // Set by the change that was saved (updateDoc applies it again after a stale revision).
      let result = null as KittyFinishResult | null;
      const saved = await store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
        if (!current.lis[body.li]) throw liNotFound();
        const finished = finishKittyGame(current, unit, body, { at, dayKey });
        result = finished.result;
        return finished.state;
      });
      if (!saved || !result) throw runNotFound();
      return result;
    }),
  );
}
