// Big Cheese M4 T8: term goals and perks (content.md 8, 9).
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { endTerm } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/term.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";

const fresh = () => core.newRun(core.HAFENKAI, 1, HAFENKAI_PLACE);

test("5 goals are offered and the player picks exactly 3", () => {
  const s = fresh();
  core.offerGoals(s, HAFENKAI_PLACE);
  const g = s.goals[0]!;
  assert.equal(g.offered.length, 5);
  assert.equal(new Set(g.offered).size, 5);
  assert.throws(() => core.pickGoals(s, g.offered.slice(0, 2), HAFENKAI_PLACE), /Pick 3/);
  assert.throws(() => core.pickGoals(s, ["nope", "x", "y"], HAFENKAI_PLACE), /Pick 3/);
  core.pickGoals(s, g.offered.slice(0, 3), HAFENKAI_PLACE);
  assert.deepEqual(g.picked, g.offered.slice(0, 3));
  assert.throws(() => core.pickGoals(s, g.offered.slice(0, 3), HAFENKAI_PLACE), /already set/);
});

test("a goal is offered only when its authority, system or layer is on", () => {
  const ids = (s: core.Run) => {
    const c = structuredClone(s);
    for (let i = 0; i < 60; i++) core.offerGoals(c, HAFENKAI_PLACE);
    return new Set(c.goals.flatMap((g) => g.offered));
  };
  const s = fresh();
  s.authority = "manager";
  s.layers = { ...s.layers, press: 0, rivals: 0 };
  const seen = ids(s);
  for (const id of ["treasury", "love_fear", "legit_60", "press_3", "rival", "heir", "no_cover_up", "repay_loan"])
    assert.ok(!seen.has(id), `${id} must not be offered`);
  s.authority = "absolute";
  s.layers = { ...s.layers, press: 80 };
  const abs = ids(s);
  assert.ok(abs.has("treasury") && abs.has("press_3") && !abs.has("money_floor"));
});

test("a crafted run meets and misses goals", () => {
  const s = fresh();
  core.offerGoals(s, HAFENKAI_PLACE);
  s.meters = { money: 61, output: 40, people: 80, standing: 30 };
  assert.ok(core.checkGoal(s, "money_60", HAFENKAI_PLACE));
  assert.ok(!core.checkGoal(s, "output_65", HAFENKAI_PLACE));
  assert.ok(core.checkGoal(s, "people_60", HAFENKAI_PLACE));
  s.meters.money = 20;
  assert.ok(!core.checkGoal(s, "money_up", HAFENKAI_PLACE)); // the baseline was taken at the offer
  s.meters.money = s.tally["goal.money"]! + 15;
  assert.ok(core.checkGoal(s, "money_up", HAFENKAI_PLACE));
  s.traditions = [1, 2, 3].map((n) => ({ id: `t${n}`, text: "x", count: 3, active: true }));
  assert.ok(core.checkGoal(s, "traditions_3", HAFENKAI_PLACE));
});

test("a term end checks the picks, then offers next goals and 3 perks; the pick is taken once", () => {
  const s = fresh();
  core.offerGoals(s, HAFENKAI_PLACE);
  core.pickGoals(s, s.goals[0]!.offered.slice(0, 3), HAFENKAI_PLACE);
  s.goals[0]!.picked = ["money_60", "output_65", "people_60"];
  s.meters = { money: 70, output: 10, people: 70, standing: 50 };
  s.lastTerm = 1;
  s.clock.week = 8;
  endTerm(s, HAFENKAI_PLACE);
  assert.deepEqual(s.goals[0]!.met, ["money_60", "people_60"]);
  assert.equal(s.goals[1]!.term, 2);
  assert.equal(s.perkOffer!.length, 3);
  const id = s.perkOffer![0]!;
  assert.throws(() => core.choosePerk(s, "thick_skin_x"), /not offered/);
  core.choosePerk(s, id);
  assert.deepEqual(s.perks, [id]);
  assert.equal(s.perkOffer, null);
});

test("the last Friday of the year offers nothing", () => {
  const s = fresh();
  s.lastTerm = 3;
  s.clock.week = core.WEEKS;
  endTerm(s, HAFENKAI_PLACE);
  assert.equal(s.goals.length, 0);
  assert.equal(s.perkOffer, null);
});

test("the Thick skin perk exists with the id boss.ts reads", () => {
  assert.ok(core.PERKS.some((p) => p.id === "thick_skin" && p.live));
  assert.equal(core.PERKS.length, 20);
});

const answer = (perks: string[], stance: string) => {
  const s = fresh();
  s.perks = perks;
  core.draft.seedDay(s, HAFENKAI_PLACE);
  const c = s.inbox[0]!;
  c.severity = 3;
  c.need = "standing";
  c.answers = [{ tier: "strong", stance }];
  const before = { ...s.meters };
  core.draft.answerCard(s, c.id, stance);
  return { before, after: s.meters };
};

test("a perk changes the delta of the answer it names, and nothing else", () => {
  const plain = answer([], "cheap_fix");
  const perk = answer(["penny_pincher"], "cheap_fix");
  assert.ok(perk.after.output > plain.after.output, "penny-pincher costs less Output");
  assert.equal(perk.after.money, plain.after.money);
  const other = answer(["penny_pincher"], "invest");
  assert.deepEqual(other.after, answer([], "invest").after);
  assert.ok(answer(["builder"], "invest").after.money > answer([], "invest").after.money);
  assert.ok(answer(["generous_host"], "reward").after.money > answer([], "reward").after.money);
});

test("perks weigh their stance in the offer and steady hand slows the Friday wear", () => {
  assert.equal(core.perkWeight(["builder"], "invest"), 1.5);
  assert.equal(core.perkWeight(["builder"], "refuse"), 1);
  assert.equal(core.perkWeight([], "invest"), 1);
  const wear = (perks: string[]) => {
    const s = fresh();
    s.perks = perks;
    s.meters = { money: 47, output: 47, people: 47, standing: 47 };
    return core.settleWeek(s).meters.standing;
  };
  assert.equal(wear(["steady_hand"]), wear([]) + 1);
});
