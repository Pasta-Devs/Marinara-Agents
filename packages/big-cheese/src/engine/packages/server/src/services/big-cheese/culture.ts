// ──────────────────────────────────────────────
// Big Cheese: culture routes (content.md 7.2)
// ──────────────────────────────────────────────
// POST stops an active tradition: 1 hour, People -6, a protest thread.
import { z } from "zod";
import { stopTradition } from "./core/index.js";
import { HOURS } from "./core/clock.js";
import { BigCheeseError, type RunStore } from "./store.js";
import { view } from "./game.js";

const Body = z.object({
  expectedRevision: z.number().int().min(0),
  id: z.string().max(60),
  action: z.literal("stop"),
});

export function createCulture(store: RunStore) {
  return {
    async traditions(id: unknown, body: unknown) {
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
      if (run.game.clock.hoursLeft === HOURS && !run.game.inbox.some((c) => c.age === 0))
        throw new BigCheeseError(409, "The day has not started.", "wrong-phase");
      const game = structuredClone(run.game);
      try {
        stopTradition(game, parsed.data.id);
      } catch (e) {
        if (e instanceof Error && /Not enough hours/.test(e.message))
          throw new BigCheeseError(409, e.message, "no-hours");
        throw new BigCheeseError(400, e instanceof Error ? e.message : "Invalid request.", "bad-request");
      }
      return view(await store.update(id, run.revision, (r) => ({ ...r, game })));
    },
  };
}
