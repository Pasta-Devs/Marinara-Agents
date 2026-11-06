// Big Cheese M4 T16: detailed building (build orders, upgrades, decor, new rooms).
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import * as adv from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/advisors.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import { createBuilding } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/building.js";

const kit = HAFENKAI_PLACE;
const fresh = (on = true) => {
  const s = core.newRun(core.HAFENKAI, 3);
  s.depth.building = on;
  s.meters.money = 60;
  return s;
};
const settle = (s: core.Run) => core.settleWeek(s, { ...s.meters }, kit);

test("with the option off nothing changes and no order is taken", () => {
  const s = fresh(false);
  assert.throws(() => core.startBuild(s, kit, { kind: "decor", room: "dock-a" }), /is off/);
  s.rooms["dock-a"]!.condition = 95;
  const c = settle(s);
  assert.equal(c.rooms["dock-a"]!.condition, 95); // no cap
  assert.equal(core.roomCap(s, "dock-a"), 100);
  assert.deepEqual(c.buildOrders, []);
  assert.equal(core.visitBonus(s), 0);
});

test("an order costs Money, finishes on its Friday and raises the cap", () => {
  const s = fresh();
  s.rooms["dock-a"]!.condition = 79;
  core.startBuild(s, kit, { kind: "upgrade", room: "dock-a" });
  assert.equal(s.meters.money, 40);
  assert.equal(s.buildOrders[0]!.doneWeek, 3);
  assert.equal(core.roomCap(s, "dock-a"), 80);
  s.clock.week = 3;
  const c = settle(s);
  assert.equal(c.rooms["dock-a"]!.condition, 89); // +10, under the new cap of 90
  s.clock.week = 4;
  assert.equal(core.roomCap(s, "dock-a", 3), 90);
  assert.equal(core.upgradesOf(s, "dock-a"), 1);
});

test("a room above the base cap is cut back, and an upgrade slows wear", () => {
  const s = fresh();
  s.rooms["dock-b"]!.condition = 95;
  assert.equal(settle(s).rooms["dock-b"]!.condition, 80);
  s.buildOrders.push(
    { room: "dock-b", kind: "upgrade", doneWeek: 1 },
    { room: "dock-b", kind: "upgrade", doneWeek: 1 },
  );
  s.clock.week = 2;
  assert.equal(core.wears(s, "dock-b"), false); // 2 upgrades: wear every 3rd week
  s.clock.week = 3;
  assert.equal(core.wears(s, "dock-b"), true);
  s.clock.week = 2;
  assert.equal(core.wears(s, "dock-a"), true);
});

test("the guards: money, two open orders, limits and names", () => {
  const s = fresh();
  s.meters.money = 5;
  assert.throws(() => core.startBuild(s, kit, { kind: "upgrade", room: "dock-a" }), /Not enough/);
  s.meters.money = 100;
  assert.throws(() => core.startBuild(s, kit, { kind: "upgrade", room: "nowhere" }), /not a room/);
  assert.throws(() => core.startBuild(s, kit, { kind: "upgrade", room: "__proto__" }), /not a room/);
  core.startBuild(s, kit, { kind: "decor", room: "dock-a" });
  assert.throws(() => core.startBuild(s, kit, { kind: "decor", room: "dock-a" }), /its decor/);
  core.startBuild(s, kit, { kind: "upgrade", room: "dock-a" });
  assert.throws(() => core.startBuild(s, kit, { kind: "upgrade", room: "dock-b" }), /Two orders/);
  const late = fresh();
  late.clock.week = 23;
  assert.throws(() => core.startBuild(late, kit, { kind: "upgrade", room: "dock-a" }), /after the year/);
  assert.throws(() => core.startBuild(fresh(), kit, { kind: "new", name: "  !! ", feeds: "output" }), /name/);
  assert.throws(() => core.startBuild(fresh(), kit, { kind: "new", name: "Roof", feeds: "luck" as never }), /helps/);
});

test("a new room opens at 60 and gives its meter 5 points", () => {
  const s = fresh();
  core.startBuild(s, kit, { kind: "new", name: "Roof garden", feeds: "people" });
  assert.equal(s.meters.money, 30);
  assert.throws(() => core.startBuild(s, kit, { kind: "new", name: "roof Garden", feeds: "people" }), /exists/);
  const people = s.meters.people;
  s.clock.week = 4;
  const c = settle(s);
  assert.equal(c.rooms["new-roof-garden"]!.condition, 60);
  assert.ok(c.meters.people >= people); // drift can move it, the gift is 5
  assert.ok(Object.hasOwn(c.rooms, "new-roof-garden"));
});

test("decor makes visitors trust the boss one point more", () => {
  const s = fresh();
  core.startBuild(s, kit, { kind: "decor", room: "dock-a" });
  const hold = (r: core.Run) => {
    adv.bookHour(r, ["henrike"]);
    r.clock = { week: r.clock.week, day: r.officeHours.day, hoursLeft: 4 };
    const before = r.people.henrike!.trust;
    adv.holdHour(r);
    return r.people.henrike!.trust - before;
  };
  s.officeHours = { ...s.officeHours, day: 2 };
  assert.equal(hold(structuredClone(s)), 2); // decor not done yet
  s.clock.week = 3; // doneWeek 2 is past
  assert.equal(hold(structuredClone(s)), 3);
});

test("the routes: list and build, with the same guards as the other routes", async () => {
  let run: any = {
    id: "r1",
    revision: 0,
    kitId: "hafenkai",
    lite: true,
    game: fresh(),
    text: {},
    scene: null,
    cast: { people: {} },
  };
  run.game.meters.money = 90;
  const store: any = {
    get: async () => run,
    update: async (_id: string, rev: number, fn: (r: any) => any) => (run = { ...fn(run), revision: rev + 1 }),
  };
  const b = createBuilding(store);
  const books = await b.list("r1");
  assert.equal(books.on, true);
  assert.equal(books.rooms.find((r) => r.id === "dock-a")!.cap, 80);
  await b.build("r1", { expectedRevision: 0, kind: "upgrade", room: "dock-a" });
  assert.equal(run.game.buildOrders.length, 1);
  assert.equal((await b.list("r1")).open.length, 1);
  await assert.rejects(b.build("r1", { expectedRevision: 0, kind: "decor", room: "dock-a" }), /changed/);
  await assert.rejects(b.build("r1", { expectedRevision: 1, kind: "sell" }), (e: any) => e.statusCode === 400);
  await assert.rejects(b.build("r1", { expectedRevision: 1, kind: "upgrade", room: "x" }), /not a room/);
  run.game.depth.building = false;
  await assert.rejects(b.build("r1", { expectedRevision: 1, kind: "decor", room: "dock-a" }), /is off/);
  run.game.depth.building = true;
  run.scene = "x";
  await assert.rejects(b.build("r1", { expectedRevision: 1, kind: "decor", room: "dock-a" }), /scene/);
  run.scene = null;
  run.game.status = "ended";
  await assert.rejects(b.build("r1", { expectedRevision: 1, kind: "decor", room: "dock-a" }), /over/);
});

// The balance sim with the option on: a boss who orders an upgrade and decor in week 1.
const RUNS = 200;
type Bot = (c: core.Card, m: core.Meters, h: { rng: number }) => string;
const stances = (c: core.Card) => c.answers.map((a) => a.stance);
const random: Bot = (c, _m, h) => core.pick(h, stances(c));
const careful: Bot = (c, m) => {
  const score = (st: string) => {
    const n = core.applyDelta(m, core.effect(c, st));
    return Math.min(...core.METERS.map((k) => n[k])) * 1000 + core.METERS.reduce((a, k) => a + n[k], 0);
  };
  return stances(c).reduce((a, b) => (score(b) > score(a) ? b : a));
};

function playFull(bot: Bot, seed: number, building: boolean) {
  const s = core.newRun(core.HAFENKAI, seed);
  s.depth.building = building;
  if (building) {
    core.startBuild(s, kit, { kind: "upgrade", room: "dock-a" });
    core.startBuild(s, kit, { kind: "decor", room: "dock-b" });
  }
  const h = { rng: seed * 7919 + 13 };
  while (s.status === "playing") {
    core.draft.seedDay(s);
    while (s.inbox.length && s.clock.hoursLeft > 0) {
      const c = s.inbox[0]!;
      core.draft.answerCard(s, c.id, bot(c, s.meters, h));
    }
    core.draft.endDay(s, kit);
    if (s.hearing) return { fired: true, s };
  }
  return { fired: false, s };
}

test("balance with detailed building: careful bots are not fired, random bots still are", () => {
  const rate = (bot: Bot, building: boolean) =>
    Array.from({ length: RUNS }, (_, i) => playFull(bot, i + 1, building)).filter((r) => r.fired).length / RUNS;
  const off = { careful: rate(careful, false), random: rate(random, false) };
  const on = { careful: rate(careful, true), random: rate(random, true) };
  console.log(`fired rate: careful off ${off.careful} on ${on.careful}, random off ${off.random} on ${on.random}`);
  assert.equal(on.careful, 0, "a careful bot must never be fired");
  assert.ok(on.random >= 0.2 && on.random <= 0.6, `random bot fired in ${on.random * 100}% of runs`);
});
