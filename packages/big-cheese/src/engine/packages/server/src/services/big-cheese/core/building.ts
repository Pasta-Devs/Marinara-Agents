// ──────────────────────────────────────────────
// Big Cheese M4 T16: detailed building (modules.md section 1 depth options, cheese-board.md section 3)
// ──────────────────────────────────────────────
// With `depth.building` on, the boss orders work on the place. An upgrade raises one room's
// condition cap and slows its wear, decor makes visitors trust the boss a little more, a new
// room is a small extra place. Orders cost Money and finish on the Friday of their week.
// With the option off nothing here runs.

import type { PlaceKit } from "./kits/types.js";
import { applyDelta, clamp, pure } from "./run.js";
import { isLocked } from "./things.js";
import { DIFFICULTY_FACTOR, METERS, type Meter, type Run } from "./types.js";
import { WEEKS } from "./clock.js";

export const BUILD_COST = { upgrade: 20, decor: 10, new: 30 } as const;
export const BUILD_WEEKS = { upgrade: 2, decor: 1, new: 3 } as const;
export type BuildKind = keyof typeof BUILD_COST;
export const MAX_OPEN_ORDERS = 2;
export const MAX_UPGRADES = 2; // per room
export const MAX_NEW_ROOMS = 2;
export const BASE_CAP = 80; // a room's condition cap before any upgrade
const CAP_STEP = 10;
const NEW_ROOM_CONDITION = 60;
const NEW_ROOM_FEED = 5;

export type BuildOrder = Run["buildOrders"][number];

/** An order finishes on the Friday settle of its week, so it counts as done from the next week on. */
const doneBy = (o: BuildOrder, week: number) => o.doneWeek <= week;
const lastWeek = (s: Run) => s.clock.week - 1;

export const openOrders = (s: Run) => s.buildOrders.filter((o) => o.doneWeek >= s.clock.week);
export const upgradesOf = (s: Run, room: string, week = lastWeek(s)) =>
  s.buildOrders.filter((o) => o.kind === "upgrade" && o.room === room && doneBy(o, week)).length;
export const hasDecor = (s: Run, week = lastWeek(s)) =>
  s.buildOrders.some((o) => o.kind === "decor" && doneBy(o, week));
export const roomCap = (s: Run, room: string, week = lastWeek(s)) =>
  s.depth?.building ? Math.min(100, BASE_CAP + CAP_STEP * upgradesOf(s, room, week)) : 100;
/** Extra visitor trust per office visit from decor. */
export const visitBonus = (s: Run) => (s.depth?.building && hasDecor(s) ? 1 : 0);
/** Weekly room wear: an upgraded room wears every 2nd (1 upgrade) or 3rd (2 upgrades) week. */
export const wears = (s: Run, room: string) => !s.depth?.building || s.clock.week % (upgradesOf(s, room) + 1) === 0;

export const priceOf = (s: Run, kind: BuildKind) => Math.round(BUILD_COST[kind] * DIFFICULTY_FACTOR[s.difficulty]);

export type BuildInput = { kind: BuildKind; room?: string; name?: string; feeds?: Meter };

/** The id a new room gets from its name, or "" when the name has no letters or digits. */
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function startBuild(s: Run, kit: PlaceKit, input: BuildInput) {
  if (!s.depth?.building) throw new Error("Detailed building is off.");
  const { kind } = input;
  if (!Object.hasOwn(BUILD_COST, kind)) throw new Error("Pick upgrade, decor or new room.");
  if (openOrders(s).length >= MAX_OPEN_ORDERS) throw new Error("Two orders are open. Wait for one to finish.");
  const doneWeek = s.clock.week + BUILD_WEEKS[kind];
  if (doneWeek > WEEKS) throw new Error("This work would finish after the year ends.");
  let order: BuildOrder;
  if (kind === "new") {
    const name = (input.name ?? "").trim().slice(0, 40);
    const id = `new-${slug(name)}`;
    if (id === "new-") throw new Error("Give the new room a name.");
    if (s.buildOrders.some((o) => o.room === id) || kit.rooms.some((r) => r.id === id))
      throw new Error("A room with that name exists.");
    if (s.buildOrders.filter((o) => o.kind === "new").length >= MAX_NEW_ROOMS)
      throw new Error("No space for more rooms.");
    if (!METERS.includes(input.feeds as Meter)) throw new Error("Pick what the room helps.");
    order = { room: id, kind, doneWeek, name, feeds: input.feeds };
  } else {
    const room = input.room ?? "";
    if (!Object.hasOwn(s.rooms, room) || isLocked(s, kit, room)) throw new Error("That is not a room you can work on.");
    if (kind === "upgrade" && s.buildOrders.filter((o) => o.kind === kind && o.room === room).length >= MAX_UPGRADES)
      throw new Error("This room has all its upgrades.");
    if (kind === "decor" && s.buildOrders.some((o) => o.kind === kind && o.room === room))
      throw new Error("This room has its decor.");
    order = { room, kind, doneWeek };
  }
  const price = priceOf(s, kind);
  if (s.meters.money < price) throw new Error("Not enough Money.");
  s.meters = applyDelta(s.meters, { money: -price }); // price already carries the difficulty factor
  s.buildOrders.push(order);
}

/** Friday: orders of this week finish, then no room stays above its cap. */
export function settleBuilding(s: Run) {
  if (!s.depth?.building) return;
  const week = s.clock.week;
  for (const o of s.buildOrders) {
    if (o.doneWeek !== week) continue;
    if (o.kind === "new") {
      s.rooms[o.room] = { condition: NEW_ROOM_CONDITION, people: [] };
      if (o.feeds) s.meters = applyDelta(s.meters, { [o.feeds]: NEW_ROOM_FEED });
    } else if (o.kind === "upgrade" && Object.hasOwn(s.rooms, o.room)) {
      s.rooms[o.room]!.condition = clamp(s.rooms[o.room]!.condition + CAP_STEP);
    }
  }
  for (const [id, r] of Object.entries(s.rooms)) r.condition = Math.min(r.condition, roomCap(s, id, week));
}

export const pureStartBuild = pure(startBuild);
export const pureSettleBuilding = pure(settleBuilding);
