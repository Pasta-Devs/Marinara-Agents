// ──────────────────────────────────────────────
// Big Cheese M4 T16: detailed building routes
// ──────────────────────────────────────────────
// GET shows the rooms, the open orders and the prices. POST /build orders work on a room.
// It needs the depth option `building`. An order costs no hour.
import { z } from "zod";
import { withCast } from "./cast.js";
import {
  BASE_CAP,
  BUILD_COST,
  BUILD_WEEKS,
  MAX_OPEN_ORDERS,
  MAX_UPGRADES,
  METERS,
  openOrders,
  priceOf,
  roomCap,
  startBuild,
  upgradesOf,
} from "./core/index.js";
import { placeKitOf } from "./core/kits/index.js";
import { view } from "./game.js";
import { BigCheeseError, type RunStore } from "./store.js";

const BuildBody = z.object({
  expectedRevision: z.number().int().min(0),
  kind: z.enum(["upgrade", "decor", "new"]),
  room: z.string().max(60).optional(),
  name: z.string().max(40).optional(),
  feeds: z.enum(METERS).optional(),
});

export function createBuilding(store: RunStore) {
  const kit = (run: Awaited<ReturnType<RunStore["get"]>>) => withCast(placeKitOf(run), run.cast, run.game.clock);
  return {
    async list(id: unknown) {
      const g = (await store.get(id)).game;
      const orders = g.buildOrders;
      return {
        on: !!g.depth?.building,
        week: g.clock.week,
        money: g.meters.money,
        baseCap: BASE_CAP,
        maxOpen: MAX_OPEN_ORDERS,
        maxUpgrades: MAX_UPGRADES,
        prices: Object.fromEntries(Object.keys(BUILD_COST).map((k) => [k, priceOf(g, k as keyof typeof BUILD_COST)])),
        weeks: BUILD_WEEKS,
        open: openOrders(g),
        // The rooms the boss can work on: condition, cap and what is already ordered.
        rooms: Object.entries(g.rooms).map(([room, r]) => ({
          id: room,
          condition: r.condition,
          cap: roomCap(g, room),
          upgrades: orders.filter((o) => o.kind === "upgrade" && o.room === room).length,
          built: upgradesOf(g, room),
          decor: orders.some((o) => o.kind === "decor" && o.room === room),
          name: orders.find((o) => o.kind === "new" && o.room === room)?.name,
        })),
        orders,
      };
    },
    async build(id: unknown, body: unknown) {
      const parsed = BuildBody.safeParse(body ?? {});
      if (!parsed.success)
        throw new BigCheeseError(400, parsed.error.issues[0]?.message ?? "Invalid request.", "bad-request");
      const run = await store.get(id);
      if (parsed.data.expectedRevision !== run.revision)
        throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
      if (run.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
      if (run.scene) throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
      if (run.game.meeting && !run.game.meeting.done)
        throw new BigCheeseError(409, "A meeting is open.", "wrong-phase");
      const game = structuredClone(run.game);
      try {
        startBuild(game, kit(run), parsed.data);
      } catch (e) {
        throw new BigCheeseError(400, e instanceof Error ? e.message : "Invalid request.", "bad-request");
      }
      return view(await store.update(id, run.revision, (r) => ({ ...r, game })));
    },
  };
}
