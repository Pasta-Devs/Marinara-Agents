// ──────────────────────────────────────────────
// Big Cheese: advisor and office hours routes (modules.md section 4)
// ──────────────────────────────────────────────
// No model call here: the inner circle, the booked visitors and the visit are all code.

import { z } from "zod";
import { pureBookHour, pureHoldHour, pureSetCircle } from "./core/advisors.js";
import type { Run as Game } from "./core/index.js";
import { view } from "./game.js";
import { BigCheeseError, type Run, type RunStore } from "./store.js";

const Base = z.object({ expectedRevision: z.number().int().min(0) });
const Ids = z.array(z.string().min(1).max(40)).max(4);
const CircleBody = Base.extend({ ids: Ids });
const BookBody = Base.extend({ visitors: Ids });

// Core messages that mean "wrong time" rather than "bad input".
const PHASE = /Not office hours|day has not started/;

export function createAdvisors(store: RunStore) {
  async function act<S extends z.ZodType<{ expectedRevision: number }>>(
    id: unknown,
    body: unknown,
    schema: S,
    fn: (game: Game, b: z.infer<S>) => Game,
  ) {
    const parsed = schema.safeParse(body ?? {});
    if (!parsed.success)
      throw new BigCheeseError(400, parsed.error.issues[0]?.message ?? "Invalid request.", "bad-request");
    const run = await store.get(id);
    if (parsed.data.expectedRevision !== run.revision)
      throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
    const g = run.game;
    if (g.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
    if (run.scene || (g.meeting && !g.meeting.done))
      throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
    let game: Game;
    try {
      game = fn(g, parsed.data as z.infer<S>);
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      if (/Not enough hours/.test(m)) throw new BigCheeseError(409, "No hours left today.", "no-hours");
      throw new BigCheeseError(
        PHASE.test(m) ? 409 : 400,
        m || "Invalid request.",
        PHASE.test(m) ? "wrong-phase" : "bad-request",
      );
    }
    return view(await store.update(run.id, run.revision, (r: Run) => ({ ...r, game })));
  }

  return {
    circle: (id: unknown, body: unknown) => act(id, body, CircleBody, (g, b) => pureSetCircle(g, b.ids)),
    book: (id: unknown, body: unknown) => act(id, body, BookBody, (g, b) => pureBookHour(g, b.visitors)),
    hold: (id: unknown, body: unknown) => act(id, body, Base, (g) => pureHoldHour(g)),
  };
}
