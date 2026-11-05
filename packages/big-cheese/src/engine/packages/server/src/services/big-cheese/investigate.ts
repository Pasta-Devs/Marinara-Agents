// ──────────────────────────────────────────────
// Big Cheese M4 T4: investigate route (modules.md section 2)
// ──────────────────────────────────────────────
// A clue costs 1 hour. An accusation (body `accuse`) closes the case and costs none.
import { z } from "zod";
import { investigate } from "./core/index.js";
import { placeKitOf } from "./core/kits/index.js";
import { withCast } from "./cast.js";
import { BigCheeseError, type RunStore } from "./store.js";
import { notStarted, view } from "./game.js";

const Body = z.object({
  expectedRevision: z.number().int().min(0),
  accuse: z.string().max(40).optional(),
});

export function createInvestigate(store: RunStore) {
  return {
    async run(id: unknown, threadId: string, body: unknown) {
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
      if (parsed.data.accuse === undefined && notStarted(run.game))
        throw new BigCheeseError(409, "The day has not started.", "wrong-phase");
      if (parsed.data.accuse === undefined && run.game.clock.hoursLeft < 1)
        throw new BigCheeseError(409, "No hours left today.", "no-hours");
      let game;
      try {
        game = investigate(run.game, withCast(placeKitOf(run), run.cast, run.game.clock), threadId, parsed.data.accuse);
      } catch (e) {
        throw new BigCheeseError(400, e instanceof Error ? e.message : "Invalid request.", "bad-request");
      }
      return view(await store.update(run.id, run.revision, (r) => ({ ...r, game })));
    },
  };
}
