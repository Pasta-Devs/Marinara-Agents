// M4 T1: culture tags and traditions (content.md 7.1, 7.2).
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";

const fresh = () => core.newRun(core.HAFENKAI, 1, HAFENKAI_PLACE);

test("3 punish answers in a row give Cutthroat and Strict a point, and the log is kept", () => {
  const s = fresh();
  for (let i = 0; i < 3; i++) core.logStance(s, "punish");
  assert.equal(s.culture.cutthroat, 1);
  assert.equal(s.culture.strict, 1);
  assert.equal(s.cultureLog.length, 3);
  core.logStance(s, "invest");
  assert.equal(s.culture.family, undefined);
});

test("5 of the last 8 weeks also count, and old weeks drop out of the log", () => {
  const s = fresh();
  for (const stance of ["pardon", "invest", "pardon", "invest", "pardon", "invest", "pardon", "invest", "pardon"])
    core.logStance(s, stance);
  assert.equal(s.culture.honour_bound, 1);
  s.clock.week += 9;
  core.logStance(s, "invest");
  assert.equal(s.cultureLog.length, 1);
});

test("a tag is active at 3 points, at most 3 are active and opposites cancel", () => {
  assert.deepEqual(core.activeTags({ family: 2 }), []);
  assert.deepEqual(core.activeTags({ family: 3 }), ["family"]);
  assert.deepEqual(core.activeTags({ strict: 3, free: 4 }), []);
  assert.deepEqual(core.activeTags({ family: 5, chaotic: 4, strict: 3, frugal: 3 }), ["family", "chaotic", "strict"]);
  assert.deepEqual(core.activeTags({ bogus: 9, __proto__: 3 } as never), []);
});

test("weekly effects, offer weight and firing trust follow the active tags", () => {
  const s = fresh();
  s.culture = { cutthroat: 3, festive: 3 };
  const before = { ...s.meters };
  core.weeklyCulture(s);
  assert.equal(s.meters.output, before.output + 2);
  assert.equal(s.meters.people, before.people - 1);
  assert.equal(s.meters.standing, before.standing + 1);
  assert.equal(core.stanceWeight({ strict: 3 }, "decree"), 1.5);
  assert.equal(core.stanceWeight({}, "decree"), 1);
  assert.equal(core.trustWeight({ family: 3 }, "banish"), 1.5);
});

test("answering a card logs the stance", () => {
  const s = fresh();
  core.draft.seedDay(s, HAFENKAI_PLACE);
  const c = s.inbox[0]!;
  core.draft.answerCard(s, c.id, c.answers[0]!.stance);
  assert.equal(s.cultureLog.length, 1);
});

test("an event that repeats 3 times becomes a tradition, and stopping one costs People and opens a protest", () => {
  const s = fresh();
  core.countEvent(s, "toast", "Raise a glass");
  core.countEvent(s, "toast", "Raise a glass");
  assert.equal(s.traditions.at(-1)!.active, false);
  core.countEvent(s, "toast", "Raise a glass");
  assert.equal(s.traditions.at(-1)!.active, true);
  const hours = s.clock.hoursLeft;
  const people = s.meters.people;
  const threads = Object.keys(s.threads).length;
  core.stopTradition(s, "toast");
  assert.equal(s.clock.hoursLeft, hours - 1);
  assert.equal(s.meters.people, people - 6);
  assert.equal(Object.keys(s.threads).length, threads + 1);
  assert.throws(() => core.stopTradition(s, "toast"));
});
