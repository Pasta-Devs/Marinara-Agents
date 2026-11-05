// ──────────────────────────────────────────────
// Big Cheese M4 T11: delegation routes (modules.md section 4)
// ──────────────────────────────────────────────
// POST give an area to a person (1 hour) or take it back. Same guards as the rules routes.
import { z } from "zod";
import { delegate, takeBack } from "./core/delegation.js";
import { HOURS } from "./core/clock.js";
import { withCast } from "./cast.js";
import { placeKitOf } from "./core/kits/index.js";
import { BigCheeseError, type RunStore } from "./store.js";
import { view } from "./game.js";

const Give = z.object({
  expectedRevision: z.number().int().min(0),
  area: z.string().max(60),
  person: z.string().max(60),
});
const Take = z.object({ expectedRevision: z.number().int().min(0), area: z.string().max(60) });

export function createDelegation(store: RunStore) {
  async function open(id: unknown, parsed: { success: boolean; data?: { expectedRevision: number } }) {
    if (!parsed.success) throw new BigCheeseError(400, "Invalid request.", "bad-request");
    const run = await store.get(id);
    if (parsed.data!.expectedRevision !== run.revision)
      throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
    if (run.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
    if (run.scene) throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
    if (run.game.meeting && !run.game.meeting.done) throw new BigCheeseError(409, "A meeting is open.", "wrong-phase");
    return run;
  }
  const save = async (run: Awaited<ReturnType<typeof open>>, game: typeof run.game) =>
    view(await store.update(run.id, run.revision, (r) => ({ ...r, game })));
  const fail = (e: unknown): never => {
    if (!(e instanceof Error)) throw e;
    throw new BigCheeseError(
      /hours/.test(e.message) ? 409 : 400,
      e.message,
      /hours/.test(e.message) ? "no-hours" : "bad-request",
    );
  };
  return {
    async give(id: unknown, body: unknown) {
      const p = Give.safeParse(body ?? {});
      const run = await open(id, p);
      if (run.game.clock.hoursLeft === HOURS && !run.game.inbox.some((c) => c.age === 0))
        throw new BigCheeseError(409, "The day has not started.", "wrong-phase");
      const game = structuredClone(run.game);
      try {
        delegate(game, withCast(placeKitOf(run), run.cast, game.clock), p.data!.area, p.data!.person);
      } catch (e) {
        fail(e);
      }
      return save(run, game);
    },
    async takeBack(id: unknown, body: unknown) {
      const p = Take.safeParse(body ?? {});
      const run = await open(id, p);
      const game = structuredClone(run.game);
      try {
        takeBack(game, p.data!.area);
      } catch (e) {
        fail(e);
      }
      return save(run, game);
    },
  };
}
