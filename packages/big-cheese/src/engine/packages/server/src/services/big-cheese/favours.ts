// Big Cheese M4 T12: favours and leverage over REST (modules.md section 4).
// GET lists them. POST spends a favour (in a meeting item or at the hearing) or uses a secret.
import { z } from "zod";
import { knownSecrets, spendFavour, useLeverage } from "./core/favours.js";
import { BigCheeseError, type RunStore } from "./store.js";
import { notStarted, view } from "./game.js";

const Favour = z.object({ expectedRevision: z.number().int().min(0), person: z.string().max(60) });
const Leverage = Favour.extend({ card: z.string().max(60).optional() });

export function createFavours(store: RunStore) {
  async function open(id: unknown, parsed: { success: boolean; data?: { expectedRevision: number } }) {
    if (!parsed.success) throw new BigCheeseError(400, "Invalid request.", "bad-request");
    const run = await store.get(id);
    if (parsed.data!.expectedRevision !== run.revision)
      throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
    if (run.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
    if (run.scene) throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
    return run;
  }
  const fail = (e: unknown): never => {
    throw e instanceof BigCheeseError
      ? e
      : new BigCheeseError(400, e instanceof Error ? e.message : "Invalid request.", "bad-request");
  };

  return {
    /** Who owes whom, and the secrets the boss knows. */
    async list(id: unknown) {
      const g = (await store.get(id)).game;
      return { favours: g.favours, leverage: knownSecrets(g) };
    },
    async spend(id: unknown, body: unknown) {
      const p = Favour.safeParse(body ?? {});
      const run = await open(id, p);
      const game = structuredClone(run.game);
      try {
        spendFavour(game, p.data!.person);
      } catch (e) {
        fail(e);
      }
      return view(await store.update(run.id, run.revision, (r) => ({ ...r, game })));
    },
    async leverage(id: unknown, body: unknown) {
      const p = Leverage.safeParse(body ?? {});
      const run = await open(id, p);
      // A card costs 1 hour, so it needs a started day. In a meeting item it costs nothing.
      if (p.data!.card !== undefined && notStarted(run.game))
        throw new BigCheeseError(409, "The day has not started.", "wrong-phase");
      if (p.data!.card !== undefined && run.game.meeting && !run.game.meeting.done)
        throw new BigCheeseError(409, "A meeting is open.", "wrong-phase");
      const game = structuredClone(run.game);
      try {
        useLeverage(game, p.data!.person, p.data!.card);
      } catch (e) {
        fail(e);
      }
      return view(await store.update(run.id, run.revision, (r) => ({ ...r, game })));
    },
  };
}
