// ──────────────────────────────────────────────
// Big Cheese: the player leaves (content.md 10.1: Quit, Sold the place, Abdication)
// ──────────────────────────────────────────────
// POST ends the run at once. The ending card is built from the run in `view`.
import { z } from "zod";
import { leaveRun } from "./core/index.js";
import { BigCheeseError, type RunStore } from "./store.js";
import { view } from "./game.js";

const Body = z.object({
  expectedRevision: z.number().int().min(0),
  kind: z.enum(["quit", "sell", "abdicate"]),
});

export function createEndings(store: RunStore) {
  return {
    async quit(id: unknown, body: unknown) {
      const parsed = Body.safeParse(body ?? {});
      if (!parsed.success)
        throw new BigCheeseError(400, parsed.error.issues[0]?.message ?? "Invalid request.", "bad-request");
      const run = await store.get(id);
      if (parsed.data.expectedRevision !== run.revision)
        throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
      if (run.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
      if (run.scene) throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
      if (run.game.meeting && !run.game.meeting.done)
        throw new BigCheeseError(409, "A meeting is open.", "wrong-phase");
      const game = structuredClone(run.game);
      leaveRun(game, parsed.data.kind);
      return view(await store.update(id, run.revision, (r) => ({ ...r, game })));
    },
  };
}
