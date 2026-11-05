// Big Cheese M4 T13: informants and rumours.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";

const kit = HAFENKAI_PLACE;
const [a, b, c] = kit.people.map((p) => p.id);
const room = kit.rooms[0].id;
const fresh = () => {
  const s = core.newRun(core.HAFENKAI, 1);
  core.movePeople(s, kit);
  return s;
};
const friday = (s: core.Run) => core.settleWeek(s, undefined, kit);

test("an informant adds one line a week and a paid one costs Money", () => {
  const s = fresh();
  s.people[a].trust = 30;
  s.people[b].trust = 80;
  s.rooms[room].people = [c];
  s.people[c].room = room;
  let r = core.pureAddInformant(s, kit, a, room, "room");
  assert.equal(r.informants[0].paid, true);
  r = core.pureAddInformant(r, kit, b, room, "room");
  assert.equal(r.informants[1].paid, false);
  const base = friday(core.pureAddInformant(s, kit, b, room, "room")); // a friend only
  const both = friday(r);
  assert.equal((both.eyes ?? []).filter((e) => e.week === 1).length, 2);
  assert.equal((base.eyes ?? []).filter((e) => e.week === 1).length, 1);
  assert.equal(both.meters.money, base.meters.money - 1, "only the paid one costs Money");
});

test("a paid informant is Money -1 and a friend is free", () => {
  const paid = fresh();
  paid.people[a].trust = 10;
  const free = fresh();
  free.people[a].trust = 90;
  const none = friday(fresh());
  assert.equal(friday(core.pureAddInformant(free, kit, a, room, "room")).meters.money, none.meters.money);
  assert.equal(friday(core.pureAddInformant(paid, kit, a, room, "room")).meters.money, none.meters.money - 1);
});

test("a run with no informants settles as before", () => {
  const s = friday(fresh());
  assert.equal(s.eyes, undefined);
  assert.equal(s.rumours, undefined);
});

test("bad informant and rumour requests are refused", () => {
  const s = fresh();
  assert.throws(() => core.pureAddInformant(s, kit, "nobody", room, "room"));
  assert.throws(() => core.pureAddInformant(s, kit, a, "nowhere", "room"));
  assert.throws(() => core.pureAddInformant(s, kit, a, "nowhere", "group"));
  let r = s;
  for (const p of kit.people.slice(0, 3)) r = core.pureAddInformant(r, kit, p.id, room, "room");
  assert.throws(() => core.pureAddInformant(r, kit, kit.people[3].id, room, "room"));
  assert.throws(() => core.purePlantRumour(s, kit, a, a, "x"));
  assert.throws(() => core.purePlantRumour(s, kit, a, b, "   "));
});

test("a planted rumour spreads for 3 days and sometimes comes back on its starter", () => {
  let back = 0;
  let quiet = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const s = fresh();
    s.rng = seed;
    const r = core.purePlantRumour(s, kit, a, b, "Somebody is skimming the till.");
    assert.ok(r.rumours![0].reached.includes(a));
    const before = r.people[b].trust;
    const done = friday(r);
    assert.equal(done.rumours!.length, 1, "too young to settle on day 0");
    r.clock = { week: 2, day: 4, hoursLeft: 5 };
    const end = friday(r);
    assert.equal(end.rumours!.length, 0);
    if (end.people[b].trust === before - 10) {
      back++;
      assert.ok(end.eyes!.some((e) => e.text.includes(kit.people[0].name)));
    } else quiet++;
  }
  assert.ok(back > 0 && quiet > back, `25% comes back: ${back} back, ${quiet} quiet`);
});
