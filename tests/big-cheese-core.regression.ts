import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";

import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
const { HAFENKAI, newRun, effect, seedDay, answerCard, endDay, settleWeek } = core;
const fresh = (seed = 1, kit: core.Kit = HAFENKAI) => newRun(kit, seed);

test("effect: severity 2 numbers (content.md 1.1)", () => {
  assert.deepEqual(effect({ need: "standing", severity: 2 }, "invest"), { standing: 6, money: -6 });
  assert.deepEqual(effect({ need: "standing", severity: 2 }, "cheap_fix"), { standing: 3, output: -2 });
  assert.deepEqual(effect({ need: "standing", severity: 2 }, "delegate"), { standing: 2 });
  assert.deepEqual(effect({ need: "standing", severity: 2 }, "ask_others"), { output: -1 });
  assert.deepEqual(effect({ need: "standing", severity: 2 }, "refuse"), { standing: -3, money: 2 });
  assert.deepEqual(effect({ need: "standing", severity: 2 }, "delay"), {});
  // refuse on need Money: the cost goes to People
  assert.deepEqual(effect({ need: "money", severity: 2 }, "refuse"), { money: -3, people: 2 });
  // invest on need Money: Money pays, People takes the cost
  assert.deepEqual(effect({ need: "money", severity: 3 }, "invest"), { money: 10, people: -10 });
  assert.throws(() => effect({ need: "money", severity: 1 }, "nonsense"));
});

test("clock: 5 hours a day, week rolls on Friday", () => {
  let c = core.newClock();
  assert.equal(core.slot(c), "morning");
  c = core.spendHours(c, 2);
  assert.equal(core.slot(c), "afternoon");
  assert.throws(() => core.spendHours(c, 4));
  const fri = core.nextDay({ week: 3, day: 4, hoursLeft: 0 });
  assert.deepEqual(fri, { week: 4, day: 0, hoursLeft: 5 });
  assert.equal(core.term({ week: 9, day: 0, hoursLeft: 5 }), 2);
});

test("rng: a snapshot replays exactly", () => {
  const play = (s: core.Run) => {
    for (let i = 0; i < 12 && s.status === "playing"; i++) {
      s = seedDay(s);
      while (s.inbox.length && s.clock.hoursLeft > 0) s = answerCard(s, s.inbox[0]!.id, s.inbox[0]!.answers[1]!.stance);
      s = endDay(s, HAFENKAI_PLACE);
    }
    return s;
  };
  const a = play(fresh(7));
  const mid = play(fresh(7)); // same seed, same result
  assert.deepEqual(a, mid);
  const snap = structuredClone(seedDay(fresh(7)));
  assert.deepEqual(play(snap), play(structuredClone(snap)));
  assert.notDeepEqual(play(fresh(8)).meters, a.meters);
});

test("cards: budget per storyteller and tier offers", () => {
  for (const [st, lo, hi] of [
    ["calm", 2, 2],
    ["classic", 3, 3],
    ["chaos", 2, 5],
  ] as const) {
    for (let seed = 1; seed <= 30; seed++) {
      const s = seedDay(fresh(seed, { ...HAFENKAI, storyteller: st }));
      assert.ok(s.inbox.length >= lo && s.inbox.length <= hi, st);
    }
  }
  const c = seedDay(fresh(3)).inbox[0]!;
  assert.deepEqual(
    c.answers.map((a) => a.tier),
    ["strong", "middle", "weak"],
  );
  assert.equal(c.answers[0]!.stance, "invest");
});

test("cards: calm-place rule gives harder cards", () => {
  const sevs = (m: core.Meters) => {
    const n = [0, 0, 0, 0];
    for (let seed = 1; seed <= 300; seed++) {
      const s = fresh(seed);
      s.meters = m;
      for (const c of seedDay(s).inbox) n[c.severity]!++;
    }
    return n;
  };
  const calm = sevs({ money: 90, output: 90, people: 90, standing: 90 });
  const tense = sevs({ money: 20, output: 20, people: 20, standing: 20 });
  assert.ok(calm[3]! > tense[3]! * 1.5);
});

test("answer: applies effect, trust, hour, and the follow-up beat", () => {
  let s = seedDay(fresh(2));
  const c = s.inbox[0]!;
  const before = { ...s.meters };
  const trust = s.people[c.asker]!.trust;
  s = answerCard(s, c.id, "invest");
  assert.equal(s.clock.hoursLeft, 4);
  assert.equal(s.people[c.asker]!.trust, Math.min(100, trust + core.trustChange("invest", c.severity)));
  assert.notDeepEqual(s.meters, before);
  assert.throws(() => answerCard(s, c.id, "invest"));
  // middle answers often roll a follow-up: some seeds plan a beat, not all
  let planned = 0;
  for (let seed = 1; seed <= 40; seed++) {
    let r = seedDay(fresh(seed));
    const k = r.inbox[0]!;
    r = answerCard(r, k.id, k.answers[1]!.stance); // cheap_fix or delegate
    if (Object.values(r.threads).some((t) => t.id === k.thread && t.beats.some((b) => b.planned))) planned++;
  }
  assert.ok(planned > 5 && planned < 35);
});

test("delegate feeds deputy ambition; 100 waits for the board meeting", () => {
  let s = fresh(1);
  s.deputyAmbition = 90;
  s.meters = { money: 50, output: 50, people: 50, standing: 50 };
  s.inbox = [
    {
      id: "c1",
      thread: "t0",
      asker: "tomasz",
      need: "output",
      severity: 1,
      age: 0,
      answers: [{ tier: "middle", stance: "delegate" }],
    },
  ];
  s = answerCard(s, "c1", "delegate");
  assert.equal(s.deputyAmbition, 100);
  assert.equal(s.meters.people, 50);
  assert.equal(s.people.henrike!.trust, 53);
});

test("ignored card: day 5 takes the full -k and the thread is lost", () => {
  const s = seedDay(fresh(4));
  const c = s.inbox[0]!;
  const t = s.threads[c.thread]!;
  s.inbox = [{ ...c, age: 4, need: "money", severity: 3 }];
  s.meters.money = 50;
  const e = endDay({ ...s, inbox: s.inbox }, HAFENKAI_PLACE);
  assert.equal(e.inbox.length, 0);
  assert.equal(e.meters.money, 40);
  assert.ok(e.closed.some((x) => x.id === t.id && x.state === "lost"));
});

test("settle: known state", () => {
  const s = fresh();
  s.meters = { money: 60, output: 70, people: 50, standing: 40 };
  const e = settleWeek(s);
  assert.equal(e.report!.income, 6);
  assert.deepEqual(e.meters, { money: 62, output: 66, people: 48, standing: 39 });
  assert.deepEqual(e.low, { money: 0, output: 0, people: 0, standing: 0 });
});

test("settle: extra meter below 20 costs its main meter 2", () => {
  const s = fresh(1, { ...HAFENKAI, extras: [{ id: "safety", main: "standing", value: 10 }] });
  s.meters = { money: 50, output: 50, people: 50, standing: 50 };
  assert.equal(settleWeek(s).meters.standing, 46);
});

test("deputy: low-meter streak calls a hearing on the second Friday", () => {
  let s = fresh();
  s.meters = { money: 5, output: 50, people: 50, standing: 50 };
  s = settleWeek(s);
  assert.equal(s.hearing, null);
  assert.equal(s.low.money, 1);
  s.clock = { week: 2, day: 4, hoursLeft: 5 };
  s.meters.money = 5;
  s = settleWeek(s);
  assert.equal(s.hearing?.meter, "money");
  assert.equal(s.hearing?.week, 3);
  assert.equal(s.hearing?.day, 1);
  assert.ok(Object.values(s.threads).some((t) => t.kind === "hearing"));
});

const calledHearing = (trust: number) => {
  let s = fresh();
  for (const m of s.hearingBody) s.people[m.id]!.trust = trust;
  s.meters = { money: 5, output: 50, people: 50, standing: 50 };
  s.low.money = 1;
  s = settleWeek(s);
  assert.ok(s.hearing);
  return s;
};

test("hearing: won sets the meter to 20 and a last warning for the run", () => {
  let s = core.holdHearing(calledHearing(80));
  assert.equal(s.lastHearing?.won, true);
  assert.equal(s.meters.money, 20);
  assert.equal(s.lastWarning, true);
  assert.equal(s.status, "playing");
  // second trigger: no hearing, the run ends
  s.low.money = 1;
  s.meters.money = 3;
  s = settleWeek(s);
  assert.equal(s.hearing, null);
  assert.equal(s.status, "ended");
  assert.equal(s.ending, "Fired");
});

test("hearing: lost ends the run; witnesses and evidence tip the vote", () => {
  const lost = core.holdHearing(calledHearing(20));
  assert.equal(lost.lastHearing?.won, false);
  assert.equal(lost.status, "ended");
  assert.equal(lost.ending, "Fired");
  // trust 40: item score -2 each, x3 = -6; two warm witnesses +2, two evidence +6 -> 2 > 0
  let s = calledHearing(40);
  s.people.tomasz!.trust = 70;
  s.people.mira!.trust = 70;
  s = core.addWitness(core.addWitness(s, "tomasz"), "mira");
  assert.throws(() => core.addWitness(s, "dilek"));
  s.closed.push({ id: "w1", state: "won" }, { id: "w2", state: "won" }, { id: "l1", state: "lost" });
  assert.throws(() => core.addEvidence(s, "l1"));
  s = core.addEvidence(core.addEvidence(s, "w1"), "w2");
  assert.throws(() => core.addEvidence(s, "w1"));
  assert.equal(s.clock.hoursLeft, 1);
  assert.equal(core.holdHearing(s).lastHearing?.won, true);
});

test("promise: kept closes won, broken costs trust 8", () => {
  const due = { week: 1, day: 2 };
  let s = core.openPromise(fresh(), { to: "tomasz", what: "a new forklift", due });
  const id = Object.keys(s.threads)[0]!;
  const kept = core.pure((x: core.Run) => void (x.threads[id]!.promise!.kept = true))(s);
  for (const [run, trust, state] of [
    [s, 42, "lost"],
    [kept, 50, "won"],
  ] as const) {
    let r = run;
    for (let d = 0; d < 3; d++) r = endDay(r, HAFENKAI_PLACE);
    assert.equal(r.people.tomasz!.trust, trust);
    assert.equal(r.closed.find((c) => c.id === id)?.state, state);
  }
  s = core.keepPromise(s, id);
  assert.equal(s.threads[id]!.promise!.kept, true);
});

test("guided: letters unlock by day, thread is won when all are read", () => {
  const letters = [-1, 0, 2, 3, 4].map((day) => ({ day, person: "tomasz", text: "x", screen: "inbox" }));
  let s = newRun({ ...HAFENKAI, letters }, 1);
  assert.equal(core.lettersUnlocked(s).length, 2); // Sunday + Monday
  assert.throws(() => core.readLetter(s, 4));
  s = core.readLetter(s, 0);
  s.clock.week = 2;
  for (let i = 1; i < 5; i++) s = core.readLetter(s, i);
  assert.equal(s.closed[0]!.state, "won");
});

test("a year ends 'complete' after Friday of week 24", () => {
  let s = fresh();
  s.clock = { week: 24, day: 4, hoursLeft: 5 };
  s = endDay(s, HAFENKAI_PLACE);
  assert.equal(s.status, "complete");
});

test("a hearing still pending after Friday of week 24 is held, and losing it ends the run", () => {
  let s = fresh();
  for (const m of s.hearingBody) s.people[m.id]!.trust = 20;
  s.clock = { week: 24, day: 4, hoursLeft: 5 };
  s.meters.money = 5;
  s.low.money = 1;
  s = endDay(s, HAFENKAI_PLACE);
  assert.equal(s.status, "ended");
  assert.equal(s.hearing, null);
});

test("trust table pinned at severity 2 (content.md 1.2)", () => {
  const want = { invest: 8, cheap_fix: -2, delay: -3, delegate: -2, refuse: -7, ask_others: 2 };
  for (const [stance, v] of Object.entries(want)) assert.equal(core.trustChange(stance, 2), v, stance);
});

test("closed threads keep their title and need, so a memory can still name them", () => {
  const s = seedDay(fresh(4));
  const c = s.inbox[0]!;
  const t = s.threads[c.thread]!;
  const e = endDay({ ...s, inbox: [{ ...c, age: 4 }] }, HAFENKAI_PLACE);
  assert.deepEqual(
    e.closed.find((x) => x.id === t.id),
    { id: t.id, state: "lost", title: t.title, need: c.need, layer: null },
  );
});

test("Friday report: 'before' is the meters the Office showed when the week ended", () => {
  let s = fresh(5);
  for (let d = 0; d < 4; d++) s = endDay(s, HAFENKAI_PLACE);
  s = seedDay(s);
  const c = s.inbox[0]!;
  s = { ...s, inbox: [{ ...c, age: 4 }], meters: { money: 50, output: 50, people: 50, standing: 50 } };
  const shown = { ...s.meters };
  const e = endDay(s, HAFENKAI_PLACE);
  assert.deepEqual(e.report!.before, shown, "the ignored card's loss shows in the change, not in 'before'");
  assert.ok(e.report!.after[c.need] < shown[c.need]);
});

test("difficulty scales losses only", () => {
  const m = { money: 50, output: 50, people: 50, standing: 50 };
  assert.deepEqual(core.applyDelta(m, { money: -8, output: 4 }, 1.25), { ...m, money: 40, output: 54 });
  assert.deepEqual(core.applyDelta(m, { money: -8, output: 4 }, 0.75), { ...m, money: 44, output: 54 });
});
