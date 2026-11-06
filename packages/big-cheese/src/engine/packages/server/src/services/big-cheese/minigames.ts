// Big Cheese: mini-game route (modules.md section 4, M4 T17). The code scores the picks;
// the model call only writes one line per step, and runs before the store's write, so a
// changed revision is a 409 and the client reloads. T18 adds its kinds in core/minigames.ts.
import { z } from "zod";
import { runTask, withCallLog, type ModelCall } from "./ai/tasks.js";
import { withCast } from "./cast.js";
import { minigameText, playMinigame } from "./core/index.js";
import { placeKitOf } from "./core/kits/index.js";
import { MINIGAMES } from "./core/minigames.js";
import { notStarted, view } from "./game.js";
import { BigCheeseError, type RunStore } from "./store.js";

const Body = z.object({
  expectedRevision: z.number().int().min(0),
  kind: z.string().max(40),
  picks: z.array(z.string().max(40)).max(40), // a big kit can show many rooms; minigamePlay checks the count
});

export function createMinigames(store: RunStore, getModel: () => Promise<ModelCall | undefined>) {
  return {
    async play(id: unknown, body: unknown) {
      const parsed = Body.safeParse(body ?? {});
      if (!parsed.success)
        throw new BigCheeseError(400, parsed.error.issues[0]?.message ?? "Invalid request.", "bad-request");
      const b = parsed.data;
      const run = await store.get(id);
      if (b.expectedRevision !== run.revision) throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
      if (run.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
      if (run.scene) throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
      if (run.game.meeting && !run.game.meeting.done)
        throw new BigCheeseError(409, "A meeting is open.", "wrong-phase");
      if (notStarted(run.game)) throw new BigCheeseError(409, "The day has not started.", "wrong-phase");
      const kit = withCast(placeKitOf(run), run.cast, run.game.clock);
      let game;
      try {
        game = playMinigame(run.game, kit, b.kind, b.picks);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Invalid request.";
        if (/No mini-game/.test(message)) throw new BigCheeseError(409, message, "wrong-phase");
        if (/Not enough hours/.test(message)) throw new BigCheeseError(409, message, "no-hours");
        throw new BigCheeseError(400, message, "bad-request");
      }
      const g = game.minigame!;
      const out = (
        await runTask(
          "minigame.lines",
          {
            kit,
            kind: g.kind,
            people: g.people,
            steps: g.done!.steps.map((x) => ({ text: x.text, verdict: MINIGAMES[g.kind]!.verdict(x) })),
          },
          { model: run.lite || !g.done!.steps.length ? undefined : withCallLog(await getModel(), String(id)) },
        )
      ).output;
      // The Lite line is the verdict sentence; a model line may name a person who is in the mini-game.
      game = minigameText(game, out.lines);
      return view(await store.update(run.id, run.revision, (r) => ({ ...r, game })));
    },
  };
}
