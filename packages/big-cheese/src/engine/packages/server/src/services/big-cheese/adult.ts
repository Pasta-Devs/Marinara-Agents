// Big Cheese: the adult module routes (README Adult module). One switch and the affair choice.
import { z } from "zod";
import { pureAffairChoice, pureSetAdult, THEMES } from "./core/index.js";
import { BigCheeseError, type RunStore } from "./store.js";
import { view } from "./game.js";
import type { Run } from "./core/types.js";

const Switch = z.object({
  expectedRevision: z.number().int().min(0),
  on: z.boolean(),
  confirmAdult: z.boolean().optional(), // the player's "I am an adult" confirm
  intensity: z.number().int().min(0).max(2).optional(),
  // The listed themes plus the player's own words (kinks), kept short.
  themes: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});
const Choice = z.object({ expectedRevision: z.number().int().min(0), choice: z.enum(["stop", "watch", "agree"]) });

export function createAdult(store: RunStore) {
  const edit = async (id: unknown, rev: number, fn: (g: Run) => Run) => {
    const run = await store.get(id);
    if (rev !== run.revision) throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
    if (run.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
    if (run.scene) throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
    if (run.game.meeting && !run.game.meeting.done) throw new BigCheeseError(409, "A meeting is open.", "wrong-phase");
    try {
      const game = fn(run.game);
      return view(await store.update(id, run.revision, (r) => ({ ...r, game })));
    } catch (e) {
      throw new BigCheeseError(400, e instanceof Error ? e.message : "Invalid request.", "bad-request");
    }
  };
  return {
    list: async (id: unknown) => ({ themes: THEMES, adult: (await store.get(id)).game.adult }),
    async set(id: unknown, body: unknown) {
      const p = Switch.safeParse(body ?? {});
      if (!p.success) throw new BigCheeseError(400, p.error.issues[0]?.message ?? "Invalid request.", "bad-request");
      const { expectedRevision, confirmAdult, ...rest } = p.data;
      return edit(id, expectedRevision, (g) => pureSetAdult(g, { ...rest, confirm: confirmAdult }));
    },
    async choose(id: unknown, threadId: string, body: unknown) {
      const p = Choice.safeParse(body ?? {});
      if (!p.success) throw new BigCheeseError(400, "Invalid request.", "bad-request");
      return edit(id, p.data.expectedRevision, (g) => pureAffairChoice(g, threadId, p.data.choice));
    },
  };
}
