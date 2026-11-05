// Big Cheese M4 T2: the drawer and hidden rooms over REST (design.md 14).
import { z } from "zod";
import { withCast } from "./cast.js";
import { openRoom } from "./core/index.js";
import { placeKitOf } from "./core/kits/index.js";
import { BigCheeseError, type RunStore } from "./store.js";
import { view } from "./game.js";

const Open = z.object({ expectedRevision: z.number().int().min(0) });

export function createThings(store: RunStore) {
  return {
    /** The drawer, the equipment and the rooms the boss has opened. */
    async list(id: unknown) {
      const { things, openedRooms } = (await store.get(id)).game;
      return { drawer: things.drawer, equipment: things.equipment, openedRooms };
    },
    /** Opens a hidden room with its key from the drawer. */
    async open(id: unknown, room: string, body: unknown) {
      const p = Open.safeParse(body ?? {});
      if (!p.success) throw new BigCheeseError(400, "Invalid request.", "bad-request");
      const run = await store.get(id);
      if (p.data.expectedRevision !== run.revision)
        throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
      if (run.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
      if (run.scene) throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
      if (run.game.meeting && !run.game.meeting.done)
        throw new BigCheeseError(409, "A meeting is open.", "wrong-phase");
      const game = structuredClone(run.game);
      try {
        openRoom(game, withCast(placeKitOf(run), run.cast, game.clock), room);
      } catch (e) {
        throw new BigCheeseError(400, e instanceof Error ? e.message : "Invalid request.", "bad-request");
      }
      return view(await store.update(run.id, run.revision, (r) => ({ ...r, game })));
    },
  };
}
