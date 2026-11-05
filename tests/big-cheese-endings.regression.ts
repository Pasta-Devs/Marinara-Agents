// Big Cheese M4 T9: endings and achievements (content.md 10).
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";

const fresh = () => core.newRun(core.HAFENKAI, 1, HAFENKAI_PLACE);
const idOf = (s: core.Run) => core.endingIdOf(s);
const meetGoals = (s: core.Run, per: number[]) =>
  (s.goals = per.map((n, i) => ({
    term: i + 1,
    offered: ["a", "b", "c"],
    picked: ["a", "b", "c"],
    met: ["a", "b", "c"].slice(0, n),
  })));

test("the player's own exits end the run with their ending", () => {
  for (const [kind, id] of [
    ["quit", "quit"],
    ["sell", "sold"],
    ["abdicate", "abdication"],
  ] as const) {
    const s = fresh();
    core.leaveRun(s, kind);
    assert.equal(s.status, "ended");
    assert.equal(idOf(s), id);
    assert.throws(() => core.leaveRun(s, kind), /over/);
  }
});

test("a lost hearing or revolt maps to its ending", () => {
  for (const [name, id] of [
    ["Fired", "fired"],
    ["Removed", "voted_out"],
    ["Marooned", "marooned"],
    ["Overthrown", "overthrown"],
  ] as const) {
    const s = fresh();
    s.status = "ended";
    s.ending = name;
    assert.equal(idOf(s), id);
  }
});

test("Burnout waits for 2 weeks at 100, Scandal needs a lost cover-up and Standing under 20, Legend 8 weeks above 70", () => {
  const s = fresh();
  s.boss.weeksAt100 = 1;
  core.judgeRun(s);
  assert.equal(s.status, "playing");
  s.boss.weeksAt100 = 2;
  core.judgeRun(s);
  assert.equal(idOf(s), "burnout");

  const c = fresh();
  c.closed.push({ id: "t1", state: "lost", title: "x", need: "standing", layer: "crime", secret: false });
  c.meters.standing = 25;
  core.judgeRun(c);
  assert.equal(c.status, "playing");
  c.meters.standing = 19;
  core.judgeRun(c);
  assert.equal(idOf(c), "scandal");

  const l = fresh();
  const high = { money: 80, output: 80, people: 80, standing: 80 };
  l.meterHistory = Array.from({ length: 7 }, (_, i) => ({ week: i + 1, ...high }));
  core.judgeRun(l);
  assert.equal(l.status, "playing");
  l.meterHistory.push({ week: 8, ...high });
  core.judgeRun(l);
  assert.equal(l.status, "playing"); // Legend waits for the year end
  l.clock = { ...l.clock, week: 24, day: 0 };
  core.judgeRun(l);
  assert.equal(l.status, "playing"); // not on Monday of the last week either
  l.clock = { ...l.clock, day: 4 };
  core.judgeRun(l);
  assert.equal(idOf(l), "legend");
  assert.equal(l.status, "complete");
});

test("win the year needs at least 2 of 3 goals in every term", () => {
  const s = fresh();
  s.status = "complete";
  meetGoals(s, [2, 3, 2]);
  assert.equal(idOf(s), "win");
  meetGoals(s, [2, 1, 3]);
  assert.equal(idOf(s), null);
  meetGoals(s, [3, 3]);
  assert.equal(idOf(s), null);
});

test("every live epilogue fills all its placeholders", () => {
  const ids = [
    "win",
    "fired",
    "voted_out",
    "quit",
    "sold",
    "overthrown",
    "marooned",
    "abdication",
    "burnout",
    "scandal",
    "legend",
  ];
  for (const id of ids) {
    const s = fresh();
    s.status = "ended";
    s.endingId = id;
    s.lastHearing = null;
    s.traditions = [];
    const card = core.endView(s, HAFENKAI_PLACE);
    assert.equal(card.id, id);
    assert.ok(card.text.length > 10, id);
    assert.ok(!/[{}]|undefined|\s\s/.test(card.text), `${id}: ${card.text}`);
  }
});

test("an achievement unlocks once and an Honest run unlocks nothing", () => {
  const s = fresh();
  s.lastHearing = { won: true, backing: 3, of: 5 };
  core.judgeRun(s);
  core.judgeRun(s);
  assert.deepEqual(s.achievements, ["a41", "a42"]);
  const h = fresh();
  h.cheeseMark = true;
  h.lastHearing = { won: true, backing: 3, of: 5 };
  core.judgeRun(h);
  assert.deepEqual(h.achievements, []);
  assert.equal(core.endView(s, HAFENKAI_PLACE).achievements.length, 2);
});

test("the 46 achievements are all named and the delay counter counts the boss's own answers", () => {
  assert.equal(core.ACHIEVEMENTS.length, 46);
  assert.ok(core.ACHIEVEMENTS.every((a) => a.name.length > 3));
  const s = fresh();
  s.tally["ach.delay"] = 20;
  core.judgeRun(s);
  assert.ok(s.achievements.includes("a4"));
});
