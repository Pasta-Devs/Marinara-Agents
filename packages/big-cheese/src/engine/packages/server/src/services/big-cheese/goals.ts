// ──────────────────────────────────────────────
// Big Cheese: term goals and perks (content.md 8, 9)
// ──────────────────────────────────────────────
// GET shows the goals of the term and the perk offer. POST /goals picks 3 goals, POST /perk takes 1 perk.
// Neither costs an hour.
import { z } from "zod";
import { withCast } from "./cast.js";
import { PERKS, checkGoal, choosePerk, currentGoals, goalById, pickGoals } from "./core/index.js";
import { placeKitOf } from "./core/kits/index.js";
import { BigCheeseError, type RunStore } from "./store.js";
import { view } from "./game.js";
import type { Run } from "./core/types.js";

const Picks = z.object({ expectedRevision: z.number().int().min(0), picks: z.array(z.string().max(60)).max(5) });
const PerkBody = z.object({ expectedRevision: z.number().int().min(0), perk: z.string().max(60) });

export function createGoals(store: RunStore) {
  const open = async (id: unknown, body: unknown, schema: typeof Picks | typeof PerkBody) => {
    const parsed = schema.safeParse(body ?? {});
    if (!parsed.success)
      throw new BigCheeseError(400, parsed.error.issues[0]?.message ?? "Invalid request.", "bad-request");
    const run = await store.get(id);
    if (parsed.data.expectedRevision !== run.revision)
      throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
    if (run.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
    if (run.scene) throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
    if (run.game.meeting && !run.game.meeting.done) throw new BigCheeseError(409, "A meeting is open.", "wrong-phase");
    return { run, data: parsed.data };
  };
  const kit = (run: Awaited<ReturnType<RunStore["get"]>>) => withCast(placeKitOf(run), run.cast, run.game.clock);
  const change = async (id: unknown, run: Awaited<ReturnType<RunStore["get"]>>, fn: (g: Run) => void) => {
    const game = structuredClone(run.game);
    try {
      fn(game);
    } catch (e) {
      throw new BigCheeseError(400, e instanceof Error ? e.message : "Invalid request.", "bad-request");
    }
    return view(await store.update(id, run.revision, (r) => ({ ...r, game })));
  };

  return {
    async list(id: unknown) {
      const run = await store.get(id);
      const k = kit(run);
      const g = run.game;
      const now = currentGoals(g, k);
      const text = (i: string) => goalById(i, k);
      return {
        term: now.term,
        set: now.picked.length > 0,
        offered: now.offered.map((i) => ({ id: i, text: text(i)?.text ?? i, meter: text(i)?.meter })),
        // `ok` is how the pick stands today; `met` is frozen at term end.
        picked: now.picked.map((i) => ({ id: i, text: text(i)?.text ?? i, ok: checkGoal(g, i, k) })),
        history: g.goals
          .filter((x) => x.term !== now.term)
          .map((x) => ({ term: x.term, picked: x.picked, met: x.met })),
        perks: g.perks.map((i) => PERKS.find((p) => p.id === i)).filter((p) => !!p),
        perkOffer: (g.perkOffer ?? []).map((i) => PERKS.find((p) => p.id === i)).filter((p) => !!p),
      };
    },

    async pick(id: unknown, body: unknown) {
      const { run, data } = await open(id, body, Picks);
      return change(id, run, (g) => pickGoals(g, (data as z.infer<typeof Picks>).picks, kit(run)));
    },

    async perk(id: unknown, body: unknown) {
      const { run, data } = await open(id, body, PerkBody);
      return change(id, run, (g) => choosePerk(g, (data as z.infer<typeof PerkBody>).perk));
    },
  };
}
