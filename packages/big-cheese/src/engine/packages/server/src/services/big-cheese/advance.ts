// Big Cheese: the viewer's /advance route (design.md sections 11 and 12).
// One call runs a few slots. A tick is one slot; a skip is many slots with no card answered, no aging and no
// ambient lines. The core runs the slots (core/viewer.ts). Day ends reuse endDay, and a new day reuses game.dayStart.
import { z } from "zod";
import { runTask, type ModelCall } from "./ai/tasks.js";
import { withCast } from "./cast.js";
import { POLICIES, digestFacts, drama, runSlots, watch } from "./core/viewer.js";
import { HOURS } from "./core/clock.js";
import type { createBoard } from "./board.js";
import { view, type createGame } from "./game.js";
import { BigCheeseError, PLACES, type RunStore } from "./store.js";

const MAX_SLOTS = 25; // five days

const Body = z.object({
  expectedRevision: z.number().int().min(0),
  slots: z.number().int().min(1).max(MAX_SLOTS),
  policy: z.enum(POLICIES).default("nobody"),
  skip: z.boolean().default(false),
  follow: z.array(z.string().max(40)).max(5).default([]),
});

export function createAdvance(
  store: RunStore,
  game: ReturnType<typeof createGame>,
  board: ReturnType<typeof createBoard>,
  getModel: () => Promise<ModelCall | undefined>,
) {
  return async (id: unknown, body: unknown) => {
    const parsed = Body.safeParse(body ?? {});
    if (!parsed.success) throw new BigCheeseError(400, "Invalid request.", "bad-request");
    const b = parsed.data;
    let run = await store.get(id);
    if (b.expectedRevision !== run.revision) throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
    if (run.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
    if (run.scene || (run.game.meeting && !run.game.meeting.done))
      throw new BigCheeseError(409, "Finish the scene or the meeting first.", "wrong-phase");

    if (run.game.clock.hoursLeft === HOURS && !run.game.inbox.some((c) => c.age === 0))
      throw new BigCheeseError(409, "Start the day first.", "wrong-phase");
    const first = run;
    const w = watch(run.game);
    let used = 0;
    let paused: string | null = null;
    while (used < b.slots && !paused && run.game.status === "playing") {
      const g = structuredClone(run.game);
      const r = runSlots(g, b.slots - used, b, w);
      paused = r.paused;
      if (!r.used) break; // a due hearing or nothing to do: nothing changed, so nothing is written
      used += r.used;
      run = await store.update(run.id, run.revision, (x) => ({ ...x, game: g }));
      if (r.rolled) {
        await board.morning(await game.dayStart(run.id, { expectedRevision: run.revision }));
        run = await store.get(run.id);
        if (!b.skip) paused ??= drama(w, run.game, b.follow);
      }
    }

    let digest: string | null = null;
    if (b.skip && used) {
      const kit = withCast(PLACES[run.kitId as keyof typeof PLACES], run.cast, run.game.clock);
      const facts = digestFacts(first.game, run.game, (m) => kit.meters[m as keyof typeof kit.meters].label);
      const model = run.lite ? undefined : await getModel();
      digest = (await runTask("digest.away", { kit, facts }, { model })).output.text;
    }
    return { ...view(run), advanced: used, paused, digest };
  };
}
