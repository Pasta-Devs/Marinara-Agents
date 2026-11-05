// M4 T12: favours and leverage (modules.md section 4, design.md 7.2 and 7.4).
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { HAFENKAI_PLACE as kit } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";

const fresh = () => core.newRun(core.HAFENKAI, 1, kit);
const card = (stance: string, severity: 1 | 2 | 3, asker = "henrike") =>
  ({ id: "c1", thread: "t1", asker, need: "people", severity, age: 0, answers: [{ tier: "strong", stance }] }) as never;
// core.answerCard, startMeeting and meetingChoice are the pure versions: they return a new run.
const answer = (s: ReturnType<typeof fresh>, c: ReturnType<typeof card>, stance: string) => {
  s.inbox.push(c);
  return core.answerCard(s, "c1", stance);
};
const meeting = () => {
  const s = core.startMeeting(fresh(), "board", kit);
  const m = s.meeting!;
  return { s, m, p: m.people[0]!, q: m.people[1]! };
};

test("a reward or pardon at severity 2+ earns one favour; mild ones earn none", () => {
  let s = fresh();
  s = answer(s, card("reward", 1), "reward");
  assert.equal(s.favours.length, 0);
  s = answer(s, card("reward", 2), "reward");
  s = answer(s, card("pardon", 3), "pardon");
  s = answer(s, card("invest", 3), "invest");
  assert.deepEqual(
    s.favours.map((f) => [f.from, f.used]),
    [
      ["henrike", false],
      ["henrike", false],
    ],
  );
});

test("a delegate answer makes the boss owe the deputy", () => {
  const s = answer(fresh(), card("delegate", 1, "tomasz"), "delegate");
  assert.deepEqual(
    s.favours.map((f) => [f.from, f.to]),
    [["boss", s.deputy]],
  );
  assert.throws(() => core.spendFavour(s, s.deputy), /owe you nothing/);
});

test("a favour is spent once and swings exactly one attendee, once per item", () => {
  const { s: s0, m, p, q } = meeting();
  s0.favours.push({ from: p, why: "x", week: 1, used: false }, { from: q, why: "y", week: 1, used: false });
  const stance = m.items[0]!.offer[0]!.stance;
  const control = core.meetingChoice(structuredClone(s0), stance, kit);
  const s = structuredClone(s0);
  core.spendFavour(s, p);
  assert.equal(s.favours[0]!.used, true);
  assert.deepEqual(s.meeting!.items[0]!.swing, [p]);
  assert.throws(() => core.spendFavour(s, q), /one person per item/);
  assert.equal(s.favours[1]!.used, false); // the failed call keeps the second favour
  const a = core.meetingChoice(s, stance, kit).meeting!.items[0]!.scores!;
  const b = control.meeting!.items[0]!.scores!;
  assert.ok(a[p]! >= 3);
  for (const id of m.people) if (id !== p) assert.equal(a[id], b[id]);
  assert.throws(() => core.spendFavour(s, p), /owe you nothing/);
});

test("a favour at the hearing counts as one witness, once", () => {
  const s = fresh();
  s.hearing = { meter: "people", thread: "t", week: 2, day: 1, witnesses: [], evidence: [] };
  s.favours.push(
    { from: "henrike", why: "x", week: 1, used: false },
    { from: "tomasz", why: "y", week: 1, used: false },
  );
  core.spendFavour(s, "henrike");
  assert.equal(core.favourWitness(s.hearing), 1);
  assert.throws(() => core.spendFavour(s, "tomasz"), /One favour per hearing/);
  assert.throws(() => core.spendFavour(fresh(), "henrike"), /owe you nothing|Nothing to call/);
});

test("leverage needs a known secret, closes a card as won, and works once", () => {
  const s = fresh();
  assert.throws(() => core.useLeverage(s, "henrike", "c1"), /no secret/);
  s.people.henrike!.trust = 70;
  core.learnSecret(s, kit, "henrike");
  s.inbox.push(card("invest", 2));
  assert.throws(() => core.useLeverage(s, "tomasz", "c1"), /no secret/);
  core.useLeverage(s, "henrike", "c1");
  assert.equal(s.inbox.length, 0);
  assert.deepEqual(s.leverage, [{ about: "henrike", thread: "t1", used: true, found: false }]);
  assert.throws(() => core.useLeverage(s, "henrike"), /already/);
});

test("leverage in a meeting item swings that attendee and shares the one swing", () => {
  const { s, p, q } = meeting();
  s.people[p]!.trust = 70;
  core.learnSecret(s, kit, p);
  s.favours.push({ from: q, why: "x", week: 1, used: false });
  core.useLeverage(s, p);
  assert.deepEqual(s.meeting!.items[0]!.swing, [p]);
  assert.throws(() => core.spendFavour(s, q), /one person per item/);
});

test("found leverage costs 20 trust with the person and 5 with their friends, once", () => {
  const s = fresh();
  s.relations.push({ a: "tomasz", b: "henrike", kind: "friend", level: 50 });
  s.leverage.push({ about: "henrike", used: true, found: false });
  s.people.henrike!.trust = s.people.tomasz!.trust = 80;
  const before = { h: s.people.henrike!.trust, t: s.people.tomasz!.trust };
  for (let i = 0; i < 200 && !s.leverage[0]!.found; i++) core.weekLeverage(s);
  assert.equal(s.leverage[0]!.found, true);
  assert.equal(s.people.henrike!.trust, before.h - 20);
  assert.equal(s.people.tomasz!.trust, before.t - 5);
  for (let i = 0; i < 50; i++) core.weekLeverage(s);
  assert.equal(s.people.henrike!.trust, before.h - 20);
});
