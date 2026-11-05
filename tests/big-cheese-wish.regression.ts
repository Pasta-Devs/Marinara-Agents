// T3: in-run wishes. 3 points per term, Sandbox unlimited, the points refill when a term turns, and
// the wish arrives as cards (never an instant change).
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import { tasks } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/ai/tasks.js";

const kit = HAFENKAI_PLACE;
const plan = (s: core.Run, cost: number): core.WishPlan => ({
  cost,
  title: "A storm hits the harbour",
  stakes: "The boats stay in.",
  people: core.wishPeople(s, []),
  need: "standing",
  severity: 2,
});

test("a wish spends points, plans one card per point and changes no meter", () => {
  const s = core.newRun(kit, 1);
  const before = { ...s.meters };
  const t = core.openWish(s, plan(s, 2));
  assert.equal(s.wishPoints.left, core.WISH_POINTS_PER_TERM - 2);
  assert.deepEqual(s.meters, before);
  assert.equal(t.kind, "wish");
  assert.equal(t.beats.length, 2);
  assert.ok(t.beats.every((b) => b.type === "card" && b.planned!.week > s.clock.week));
  assert.throws(() => core.openWish(s, plan(s, 2)), /Not enough/);
  assert.equal(s.wishPoints.left, 1);
  assert.throws(() => core.openWish(s, plan(s, 4)), /1 to 3/);
});

test("Sandbox has no limit", () => {
  const s = core.newRun(kit, 1);
  s.mode = "sandbox";
  for (let i = 0; i < 5; i++) core.openWish(s, plan(s, 3));
  assert.equal(s.wishPoints.left, core.WISH_POINTS_PER_TERM);
});

test("points refill when the term turns", () => {
  const s = core.newRun(kit, 1);
  core.openWish(s, plan(s, 3));
  assert.equal(s.wishPoints.left, 0);
  for (let i = 0; i < core.TERM_WEEKS * 5 && s.status === "playing"; i++) core.draft.endDay(s, kit);
  assert.equal(s.wishPoints.term, core.term(s.clock));
  assert.equal(s.wishPoints.left, core.WISH_POINTS_PER_TERM);
});

test("wish.classify keeps only known people and meters", () => {
  const t = tasks["wish.classify"];
  const id = kit.people[0]!.id;
  const ok = t.parse({ kind: "crisis", need: "money", people: [id, id] }, { kit, rng: 1, text: "x" });
  assert.deepEqual([ok.kind, ok.need], ["crisis", "money"]);
  assert.throws(() => t.parse({ kind: "wish", need: "gold", people: [] }, { kit, rng: 1, text: "x" }));
  assert.throws(() => t.parse({ kind: "wish", need: "money", people: ["nobody"] }, { kit, rng: 1, text: "x" }));
});
