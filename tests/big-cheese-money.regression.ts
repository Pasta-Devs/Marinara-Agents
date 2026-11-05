// Big Cheese M4 T15: detailed money (ledger, loans, quarterly budget, audits) and the budget sliders.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import { createLedger } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/ledger.js";
import { rebalance } from "../packages/big-cheese/src/engine/packages/client/src/features/big-cheese/budget.js";

const fresh = (money = true) => {
  const s = core.newRun(core.HAFENKAI, 3, HAFENKAI_PLACE);
  s.depth.money = money;
  return s;
};
// The pure API clones the run, so the settled run is the return value.
const settle = (s: core.Run) => core.settleWeek(s, { ...s.meters }, HAFENKAI_PLACE);

test("with the option off the income line and the state are as before", () => {
  const s = fresh(false);
  s.meters.output = 70;
  s.meters.money = 40;
  const c = settle(s);
  assert.equal(c.report!.income, 2 + Math.round(20 * 0.2));
  assert.deepEqual(c.ledger, { salaries: 0, loans: [], quarter: 0 });
  assert.equal(c.rng, s.rng); // no roll for an audit week
});

test("a loan adds Money now, is due later, and the loans are capped", () => {
  const s = fresh();
  s.meters.money = 30;
  core.takeLoan(s, 20, 4);
  assert.equal(s.meters.money, 50);
  assert.equal(s.ledger.loans[0]!.due, s.clock.week + 4);
  assert.equal(core.owed(s.ledger.loans[0]!), 24);
  core.takeLoan(s, 10, 8);
  assert.throws(() => core.takeLoan(s, 10, 4), /Repay a loan first/);
  assert.throws(() => core.takeLoan(fresh(), 15, 4), /not offered/);
  assert.throws(() => core.takeLoan(fresh(false), 10, 4), /is off/);
  const late = fresh();
  late.clock.week = 22;
  assert.throws(() => core.takeLoan(late, 10, 4), /after the year ends/);
});

test("a loan is paid on its due Friday when the money is there", () => {
  const s = fresh();
  core.takeLoan(s, 10, 4);
  s.clock.week = s.ledger.loans[0]!.due;
  s.meters.money = 80;
  const c = settle(s);
  assert.ok(c.ledger.loans[0]!.repaid);
  assert.ok(!c.ledger.loans[0]!.missed);
  assert.ok(c.report!.income < 0); // 12 owed against the plain income
});

test("a missed loan opens the audit thread, a late payment still closes the loan", () => {
  const s = fresh();
  s.ledger.loans.push({ id: "l1", amount: 30, due: s.clock.week, repaid: false });
  s.meters.money = 0;
  s.meters.output = 0;
  const c = settle(s);
  assert.ok(c.ledger.loans[0]!.missed);
  assert.ok(Object.values(c.threads).some((t) => t.kind === "audit"));
  // money comes back: the loan is paid later, but the goal "on time" stays unmet
  c.clock.week += 1;
  c.meters.money = 90;
  const d = settle(c);
  assert.ok(d.ledger.loans[0]!.repaid);
  assert.ok(d.ledger.loans[0]!.missed);
  assert.ok(!core.checkGoal(d, "repay_loan", HAFENKAI_PLACE));
});

test("an audit scores the books: a bad score opens the thread and costs Standing, a good one closes it", () => {
  const bad = fresh();
  bad.ledger.quarter = 1;
  bad.ledger.auditWeek = bad.clock.week;
  bad.meters = { money: 5, output: 20, people: 60, standing: 60 };
  const b = settle(bad);
  assert.ok(b.ledger.audit! < core.AUDIT_PASS);
  assert.ok(Object.values(b.threads).some((t) => t.kind === "audit"));
  assert.ok(b.meters.standing < 60);
  b.ledger.auditWeek = b.clock.week + 1;
  b.clock.week += 1;
  b.meters.money = 90;
  const g = settle(b);
  assert.ok(g.ledger.audit! >= 70);
  assert.ok(!Object.values(g.threads).some((t) => t.kind === "audit"));
});

test("the quarter turns after week 12: the budget resets and the audit week is in the new quarter", () => {
  const s = fresh();
  s.clock.week = 12;
  s.ledger.quarter = 1;
  s.ledger.auditWeek = 5;
  core.setBudget(s, { money: 10, output: 30, people: 30, standing: 30 });
  const c = settle(s);
  assert.equal(c.ledger.quarter, 2);
  assert.equal(c.ledger.budget, undefined);
  assert.ok(c.ledger.auditWeek! >= 13 && c.ledger.auditWeek! <= 24);
});

test("the budget must add up to 100 and moves upkeep", () => {
  const s = fresh();
  assert.throws(() => core.setBudget(s, { money: 25, output: 25, people: 25, standing: 26 }), /100/);
  assert.throws(() => core.setBudget(s, { money: -10, output: 60, people: 25, standing: 25 }), /100/);
  assert.throws(() => core.setBudget(s, { money: 12.5, output: 12.5, people: 50, standing: 25 }), /100/);
  const even = settle(structuredClone(s));
  core.setBudget(s, { money: 0, output: 0, people: 0, standing: 100 });
  const c = settle(s);
  assert.ok(c.meters.standing > even.meters.standing);
  assert.ok(c.meters.people < even.meters.people);
});

test("budget sliders always sum to 100", () => {
  let b: Record<string, number> = { money: 25, output: 25, people: 25, standing: 25 };
  let seed = 7;
  for (let i = 0; i < 500; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const keys = Object.keys(b);
    b = rebalance(b, keys[seed % 4]!, (seed >> 4) % 130);
    assert.equal(
      Object.values(b).reduce((a, n) => a + n, 0),
      100,
    );
    assert.ok(Object.values(b).every((n) => Number.isInteger(n) && n >= 0));
  }
  assert.deepEqual(rebalance({ a: 0, b: 0, c: 100 }, "c", 100), { a: 0, b: 0, c: 100 });
  assert.deepEqual(rebalance({ a: 0, b: 0, c: 100 }, "c", 40), { a: 30, b: 30, c: 40 });
});

test("the routes: the books, a loan and a budget, with the same guards as the other routes", async () => {
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
  const store: any = {
    get: async () => run,
    update: async (_id: string, rev: number, fn: (r: any) => any) => (run = { ...fn(run), revision: rev + 1 }),
  };
  const ledger = createLedger(store);
  const books: any = await ledger.list("r1");
  assert.equal(books.on, true);
  assert.equal(books.audit, null);
  assert.ok(!("auditWeek" in books));
  await ledger.loan("r1", { expectedRevision: 0, amount: 20, weeks: 4 });
  assert.equal(run.game.ledger.loans.length, 1);
  await assert.rejects(ledger.loan("r1", { expectedRevision: 0, amount: 20, weeks: 4 }), /changed/);
  await assert.rejects(
    ledger.budget("r1", { expectedRevision: 1, budget: { money: 50, output: 50, people: 50, standing: 50 } }),
    /100/,
  );
  await ledger.budget("r1", { expectedRevision: 1, budget: { money: 10, output: 20, people: 30, standing: 40 } });
  assert.equal(run.game.ledger.budget.standing, 40);
  run.game.depth.money = false;
  await assert.rejects(ledger.loan("r1", { expectedRevision: 2, amount: 10, weeks: 4 }), /is off/);
  run.game.depth.money = true;
  run.scene = "x";
  await assert.rejects(ledger.loan("r1", { expectedRevision: 2, amount: 10, weeks: 4 }), /scene/);
  run.scene = null;
  run.game.status = "ended";
  await assert.rejects(ledger.loan("r1", { expectedRevision: 2, amount: 10, weeks: 4 }), /over/);
});

// The balance sim with the option on (the same bots and year as the core balance test).
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
function playFull(bot: Bot, seed: number, money: boolean) {
  const s = core.newRun(core.HAFENKAI, seed);
  s.depth.money = money;
  const h = { rng: seed * 7919 + 13 };
  while (s.status === "playing") {
    core.draft.seedDay(s);
    while (s.inbox.length && s.clock.hoursLeft > 0) {
      const c = s.inbox[0]!;
      core.draft.answerCard(s, c.id, bot(c, s.meters, h));
    }
    core.draft.endDay(s, HAFENKAI_PLACE);
    if (s.hearing) return { fired: true, s };
  }
  return { fired: false, s };
}

test("balance with detailed money on: careful bots are not fired, random bots still are", () => {
  const rate = (bot: Bot, money: boolean) =>
    Array.from({ length: RUNS }, (_, i) => playFull(bot, i + 1, money)).filter((r) => r.fired).length / RUNS;
  const off = { careful: rate(careful, false), random: rate(random, false) };
  const on = { careful: rate(careful, true), random: rate(random, true) };
  console.log(`fired rate  careful off ${off.careful} on ${on.careful}   random off ${off.random} on ${on.random}`);
  const avg = Array.from({ length: 50 }, (_, i) => playFull(careful, i + 1, true).s.meters.money);
  console.log(`careful bot end Money avg ${Math.round(avg.reduce((a, n) => a + n, 0) / avg.length)}`);
  assert.equal(on.careful, 0, "a careful bot must never be fired");
  assert.ok(on.random >= 0.2 && on.random <= 0.6, `random bot fired in ${on.random * 100}% of runs`);
});
