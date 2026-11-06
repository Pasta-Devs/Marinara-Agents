// ============================================================================
// Big Cheese: "Call someone" (cast.md section 6 e, M4 T21)
// ============================================================================
// A short phone scene run inside Big Cheese. The package's own model helper writes the reply,
// with a Lite fallback. It reads the run and writes nothing back: no number, trust or memory
// changes, no Engine chat.
import { z } from "zod";
import { CALL_TOPICS, runTask, withCallLog, type ModelCall } from "./ai/tasks.js";
import { withCast } from "./cast.js";
import { band } from "./game.js";
import { placeKitOf } from "./core/kits/index.js";
import { BigCheeseError, type RunStore } from "./store.js";

export const MAX_CALL_LINES = 10; // five exchanges

const Body = z.object({
  expectedRevision: z.number().int().min(0),
  topic: z.enum(Object.keys(CALL_TOPICS) as [string, ...string[]]),
  earlier: z
    .array(z.object({ who: z.enum(["you", "them"]), text: z.string().max(300) }))
    .max(MAX_CALL_LINES)
    .default([]),
});

export function createCall(store: RunStore, getModel: () => Promise<ModelCall | undefined>) {
  return {
    async call(id: unknown, personId: unknown, body: unknown) {
      const parsed = Body.safeParse(body ?? {});
      if (!parsed.success) throw new BigCheeseError(400, "Invalid request.", "bad-request");
      const run = await store.get(id);
      if (parsed.data.expectedRevision !== run.revision)
        throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
      if (run.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
      if (run.scene) throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
      if (run.game.meeting && !run.game.meeting.done)
        throw new BigCheeseError(409, "A meeting is open.", "wrong-phase");
      const kit = withCast(placeKitOf(run), run.cast, run.game.clock);
      const who = run.game.people[String(personId)];
      if (!who || !kit.people.some((p) => p.id === personId) || (who.status ?? "active") !== "active") {
        throw new BigCheeseError(400, "That person is not here.", "bad-request");
      }
      const model = run.lite ? undefined : withCallLog(await getModel(), String(run.id));
      const { output } = await runTask(
        "call.line",
        {
          kit,
          // Reads the seed without spending it, so a call never changes the run.
          rng: (run.game.rng + parsed.data.earlier.length * 7919) >>> 0,
          person: String(personId),
          band: band(who.trust),
          topic: parsed.data.topic,
          earlier: parsed.data.earlier,
        },
        { model },
      );
      return { line: output.line };
    },
  };
}
