// ──────────────────────────────────────────────
// Big Cheese: legacy routes (modules.md section 2)
// ──────────────────────────────────────────────
// `heir` names the heir (no hour). `next` starts the next boss's run from a finished one.
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { legacyRun, nameHeir } from "./core/index.js";
import { placeKitOf } from "./core/kits/index.js";
import { BigCheeseError, type RunStore } from "./store.js";
import { view } from "./game.js";

const Base = z.object({ expectedRevision: z.number().int().min(0) });
const HeirBody = Base.extend({ person: z.string().min(1).max(40) });

const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success)
    throw new BigCheeseError(400, parsed.error.issues[0]?.message ?? "Invalid request.", "bad-request");
  return parsed.data;
};

export function createLegacy(store: RunStore) {
  return {
    async heir(id: unknown, body: unknown) {
      const b = parse(HeirBody, body);
      const run = await store.get(id);
      if (b.expectedRevision !== run.revision) throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
      if (run.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
      if (run.scene) throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
      if (run.game.meeting && !run.game.meeting.done)
        throw new BigCheeseError(409, "Finish the meeting first.", "wrong-phase");
      let game;
      try {
        game = nameHeir(run.game, b.person);
      } catch (e) {
        throw new BigCheeseError(400, e instanceof Error ? e.message : "Invalid request.", "bad-request");
      }
      return view(await store.update(id, run.revision, (r) => ({ ...r, game })));
    },

    /** The old run stays as it is. The new one is a separate run document. */
    async next(id: unknown, body: unknown) {
      const b = parse(Base, body);
      const run = await store.get(id);
      if (run.game.legacy?.next) return view(await store.get(run.game.legacy.next)); // one next run per old run
      if (b.expectedRevision !== run.revision) throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
      if (run.game.status === "playing") throw new BigCheeseError(409, "Finish this run first.", "wrong-phase");
      const kit = placeKitOf(run);
      let next;
      try {
        next = legacyRun(run.game, kit, randomBytes(4).readUInt32LE(0), run.id);
      } catch (e) {
        throw new BigCheeseError(400, e instanceof Error ? e.message : "Invalid request.", "bad-request");
      }
      const created = await store.create(
        run.kitId,
        run.lite ?? false,
        async (game) => {
          Object.assign(game, next);
          return { text: { cards: {}, scenes: {}, feelings: {} }, scene: null };
        },
        run.cast,
        run.kit,
      );
      // ponytail: two parallel posts can still both create; the revision check makes the second one fail here.
      await store.update(run.id, run.revision, (r) => ({
        ...r,
        game: { ...r.game, legacy: { generation: 1, ...r.game.legacy, next: created.id } },
      }));
      return view(created);
    },
  };
}
