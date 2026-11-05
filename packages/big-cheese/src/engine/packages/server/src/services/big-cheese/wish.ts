// Big Cheese: in-run wishes (design.md 3.7). POST /runs/:id/wish spends 1-3 points of the term (no
// limit in Sandbox). The model reads the line and writes the words; the code opens the thread.
import { z } from "zod";
import { runTask, withCallLog, type ModelCall } from "./ai/tasks.js";
import { withCast } from "./cast.js";
import { openWish, roll, wishPeople } from "./core/index.js";
import { placeKitOf } from "./core/kits/index.js";
import { BigCheeseError, type RunStore } from "./store.js";
import { view } from "./game.js";

const Body = z.object({
  expectedRevision: z.number().int().min(0),
  text: z.string().trim().min(1).max(200),
  cost: z.number().int().min(1).max(3).default(1),
});

export function createWish(store: RunStore, getModel: () => Promise<ModelCall | undefined>) {
  return async (id: unknown, body: unknown) => {
    const parsed = Body.safeParse(body ?? {});
    if (!parsed.success) throw new BigCheeseError(400, "Invalid request.", "bad-request");
    const { expectedRevision, text, cost } = parsed.data;
    const run = await store.get(id);
    if (expectedRevision !== run.revision) throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
    if (run.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
    if (run.scene) throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
    if (run.game.meeting && !run.game.meeting.done)
      throw new BigCheeseError(409, "Finish the meeting first.", "wrong-phase");
    if (run.game.mode !== "sandbox" && run.game.wishPoints.left < cost)
      throw new BigCheeseError(409, "Not enough wish points this term.", "no-points");

    const kit = withCast(placeKitOf(run), run.cast, run.game.clock);
    const model = run.lite ? undefined : withCallLog(await getModel(), run.id);
    const game = structuredClone(run.game);
    const c = (await runTask("wish.classify", { kit, rng: game.rng, text }, { model })).output;
    const people = wishPeople(game, c.people);
    const severity = c.kind === "crisis" ? 3 : 2;
    const beats = Array.from({ length: cost }, () => ({ type: "card" }));
    const plan = (
      await runTask(
        "thread.beat",
        { adult: game.adult, kit, rng: game.rng, kind: "wish", idea: text, people, need: c.need, beats },
        { model },
      )
    ).output;
    roll(game);
    try {
      openWish(game, { cost, title: plan.title, stakes: plan.stakes, people, need: c.need, severity });
    } catch (e) {
      throw new BigCheeseError(400, e instanceof Error ? e.message : "Invalid request.", "bad-request");
    }
    return view(await store.update(id, run.revision, (r) => ({ ...r, game })));
  };
}
