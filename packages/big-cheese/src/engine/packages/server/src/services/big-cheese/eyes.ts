// Big Cheese: eyes and ears routes (modules.md section 4). Each one costs 1 hour.
// POST an informant on a room or group, or plant a rumour that goes on the grapevine.
import { z } from "zod";
import { runTask, withCallLog, type ModelCall } from "./ai/tasks.js";
import { withCast } from "./cast.js";
import { addInformant, plantRumour } from "./core/eyes.js";
import { HOURS, spendHours } from "./core/clock.js";
import { newId } from "./core/run.js";
import { placeKitOf } from "./core/kits/index.js";
import { BigCheeseError, type PlaceText, type RunStore } from "./store.js";
import type { Run as Game } from "./core/types.js";
import { view } from "./game.js";

const MAX_RUMOURS = 60; // same cap as place.ts

const Informant = z.object({
  expectedRevision: z.number().int().min(0),
  person: z.string().max(60),
  target: z.string().max(60),
  kind: z.enum(["room", "group"]),
});
const Rumour = z.object({
  expectedRevision: z.number().int().min(0),
  starter: z.string().max(60),
  target: z.string().max(60),
  line: z.string().max(160),
});

export function createEyes(store: RunStore, getModel: () => Promise<ModelCall | undefined>) {
  /** Reads the run for a write, with the same guards as the rules routes. */
  async function open(id: unknown, parsed: { success: boolean; data?: { expectedRevision: number } }) {
    if (!parsed.success) throw new BigCheeseError(400, "Invalid request.", "bad-request");
    const run = await store.get(id);
    if (parsed.data!.expectedRevision !== run.revision)
      throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
    if (run.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
    if (run.scene) throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
    if (run.game.meeting && !run.game.meeting.done) throw new BigCheeseError(409, "A meeting is open.", "wrong-phase");
    if (run.game.clock.hoursLeft === HOURS && !run.game.inbox.some((c) => c.age === 0)) {
      throw new BigCheeseError(409, "The day has not started.", "wrong-phase");
    }
    return run;
  }

  /** Core rule errors are plain Errors: no hours is 409, the rest is a bad request. */
  const guard = <T>(fn: () => T): T => {
    try {
      return fn();
    } catch (e) {
      if (!(e instanceof Error)) throw e;
      if (/hours/.test(e.message)) throw new BigCheeseError(409, e.message, "no-hours");
      throw new BigCheeseError(400, e.message, "bad-request");
    }
  };

  return {
    async informant(id: unknown, body: unknown) {
      const parsed = Informant.safeParse(body ?? {});
      const run = await open(id, parsed);
      const game: Game = structuredClone(run.game);
      const kit = withCast(placeKitOf(run), run.cast, game.clock);
      guard(() => {
        game.clock = spendHours(game.clock, 1);
        addInformant(game, kit, parsed.data!.person, parsed.data!.target, parsed.data!.kind);
      });
      return view(await store.update(run.id, run.revision, (r) => ({ ...r, game })));
    },

    async rumour(id: unknown, body: unknown) {
      const parsed = Rumour.safeParse(body ?? {});
      const run = await open(id, parsed);
      const { starter, target, line } = parsed.data!;
      const game: Game = structuredClone(run.game);
      const kit = withCast(placeKitOf(run), run.cast, game.clock);
      guard(() => {
        game.clock = spendHours(game.clock, 1);
        plantRumour(game, kit, starter, target, line);
      });
      const text = game.rumours![game.rumours!.length - 1].line;
      const place: PlaceText = structuredClone(
        run.text.place ?? { day: -1, evening: -1, morning: [], known: [], grapevine: {} },
      );
      const h = { rng: game.rng };
      const model = run.lite ? undefined : await getModel().then((m) => m && withCallLog(m, String(id)));
      const { output: out } = await runTask(
        "grapevine.batch",
        { kit, rng: h.rng, facts: [{ person: starter, text }], planted: { person: starter, text } },
        { model },
      );
      for (const l of out.lines) {
        const gid = newId(game, "g");
        place.grapevine[gid] = { source: l.source, text: l.line };
        game.grapevine.push(gid);
      }
      while (game.grapevine.length > MAX_RUMOURS) delete place.grapevine[game.grapevine.shift()!];
      return view(await store.update(run.id, run.revision, (r) => ({ ...r, game, text: { ...r.text, place } })));
    },
  };
}
