// ──────────────────────────────────────────────
// Big Cheese: politics route (modules.md section 2)
// ──────────────────────────────────────────────
// POST backs one candidate in an open election. It costs no hour.
import { z } from "zod";
import { backCandidate } from "./core/index.js";
import { BigCheeseError, type RunStore } from "./store.js";
import { view } from "./game.js";

const Body = z.object({
  expectedRevision: z.number().int().min(0),
  thread: z.string().max(40),
  person: z.string().max(40),
});

export function createPolitics(store: RunStore) {
  return {
    async back(id: unknown, body: unknown) {
      const parsed = Body.safeParse(body ?? {});
      if (!parsed.success)
        throw new BigCheeseError(400, parsed.error.issues[0]?.message ?? "Invalid request.", "bad-request");
      const run = await store.get(id);
      if (parsed.data.expectedRevision !== run.revision)
        throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
      if (run.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
      if (run.scene) throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
      let game;
      try {
        game = backCandidate(run.game, parsed.data.thread, parsed.data.person);
      } catch (e) {
        throw new BigCheeseError(400, e instanceof Error ? e.message : "Invalid request.", "bad-request");
      }
      return view(await store.update(id, run.revision, (r) => ({ ...r, game })));
    },
  };
}
