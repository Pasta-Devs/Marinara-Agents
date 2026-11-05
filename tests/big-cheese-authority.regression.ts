// T7: house rules, decrees and the absolute rule (design.md section 9, content.md 1.2, 2.3-2.4, 11).
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { PLACES } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/index.js";
import type { PlaceKit } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/types.js";

const base = PLACES.hafenkai;
const boss = base.people[0]!;
const rule = (id: string, options: string[], touches: string[], decree = false) =>
  ({ id, text: id, options, touches, decree }) as PlaceKit["houseRules"][number];
// A court-like place built from Hafenkai: two decrees, one enforcer, Fear 50 Love 40 Legitimacy 60.
const court: PlaceKit = {
  ...base,
  authority: "absolute",
  authorityStart: { fear: 50, love: 40, legitimacy: 60 },
  houseRules: [
    ...base.houseRules.filter((r) => r.id !== "phones"),
    rule("curfew", ["none", "23:00", "21:00"], ["people", "output", "fear", "love"], true),
    rule("phones", ["allowed", "lectures only", "locked in boxes"], ["output", "people", "legitimacy"], true),
  ],
  people: base.people.map((p, i) => (i === 0 ? { ...p, role: `${p.role} (enforcer)` } : p)),
};
const run = (authority: "manager" | "strong_leader" | "absolute", place: PlaceKit = base) =>
  core.newRun({ ...core.HAFENKAI, authority }, 1, { ...place, authority });
const legit = (s: core.Run) => s.extras.find((e) => e.id === "legitimacy")?.value;

test("plot chance: max(0, fear - love - 20) / 2", () => {
  assert.equal(core.plotChance({ fear: 60, love: 20 }), 10);
  assert.equal(core.plotChance({ fear: 70, love: 10 }), 20);
  assert.equal(core.plotChance({ fear: 50, love: 40 }), 0);
  assert.equal(core.plotChance({ fear: 10, love: 90 }), 0);
});

test("decree numbers match content.md 2.3-2.4", () => {
  const cost = (id: string, o: string[]) => core.decreeCost(rule(id, o, []), o.at(-1)!);
  assert.deepEqual(cost("curfew", ["none", "23:00", "21:00"]), [4, -3, 0]);
  assert.deepEqual(cost("phones", ["a", "b", "c"]), [3, -4, -1]);
  assert.deepEqual(cost("dorm-inspections", ["a", "b", "c"]), [5, -5, -2]);
  assert.deepEqual(cost("grain-tax", ["a", "b", "c"]), [3, -4, 0]);
  assert.deepEqual(cost("hunting-rights", ["a", "b", "c"]), [0, -5, 0]);
  assert.deepEqual(cost("petition-day", ["a", "b", "c"]), [0, -6, -3]);
  assert.deepEqual(core.decreeCost(rule("curfew", ["a", "b", "c"], []), "b"), [0, 0, 0]);
});

test("an absolute decree is instant, costs 1 hour and can be taken back", () => {
  let s = run("absolute", court);
  assert.deepEqual(s.power, { fear: 50, love: 40 });
  assert.equal(legit(s), 60);
  s = core.setRule(s, court, "curfew", "21:00");
  assert.deepEqual(s.power, { fear: 54, love: 37 });
  assert.equal(s.clock.hoursLeft, 4);
  assert.equal(
    core.ruleOption(
      s,
      court.houseRules.find((r) => r.id === "curfew")!,
    ),
    "21:00",
  );
  s = core.setRule(s, court, "phones", "locked in boxes");
  assert.equal(legit(s), 59);
  s = core.setRule(s, court, "curfew", "23:00");
  assert.deepEqual(s.power, { fear: 53, love: 36 });
  assert.throws(() => core.setRule(s, court, "curfew", "23:00"), /already/);
  assert.throws(() => core.setRule(s, court, "__proto__", "x"), /No such rule/);
  assert.throws(() => core.setRule(s, court, "curfew", "never"), /No such option/);
});

test("a stance moves Fear and Love in an absolute place only", () => {
  const s = run("absolute", court);
  const t = core.stancePower;
  const a = structuredClone(s);
  t(a, "banish", 2);
  assert.deepEqual(a.power, { fear: 60, love: 32 });
  assert.equal(legit(a), 57);
  const m = run("manager");
  t(m, "banish", 2);
  assert.deepEqual(m.power, { fear: 0, love: 0 });
});

test("a Manager proposal is the first item of the next meeting and passes into the rule", () => {
  let s = run("manager");
  const r = base.houseRules[0]!;
  s = core.setRule(s, base, r.id, r.options[2]!);
  assert.equal(core.ruleOption(s, r), r.options[1]); // not set yet
  const t = Object.values(s.threads).find((x) => x.rule?.id === r.id && x.rule.option === r.options[2])!;
  assert.ok(t);
  assert.throws(() => core.setRule(s, base, r.id, r.options[2]!), /already made/);
  s = core.startMeeting(s, "all_hands", base);
  assert.equal(s.meeting!.items[0]!.thread, t.id);
  const stance = s.meeting!.items[0]!.offer[0]!.stance;
  // Trust 100 in the room carries the vote; trust 0 loses it.
  const vote = (trust: number) => {
    const w = structuredClone(s);
    for (const id of w.meeting!.people) w.people[id]!.trust = trust;
    return core.meetingChoice(w, stance, base);
  };
  const won = vote(100);
  assert.equal(core.ruleOption(won, r), r.options[2]);
  assert.equal(won.threads[t.id], undefined);
  const lost = vote(0);
  assert.equal(core.ruleOption(lost, r), r.options[1]);
  assert.equal(lost.threads[t.id], undefined);
});

test("a Strong leader sets a rule at once and people push back", () => {
  const r = base.houseRules[0]!;
  const s = core.setRule(run("strong_leader"), base, r.id, r.options[2]!);
  assert.equal(core.ruleOption(s, r), r.options[2]);
  assert.ok(Object.values(s.threads).some((t) => t.title.startsWith("Push back")));
});

test("a rule option off the start option moves meters on Friday; the start option does not", () => {
  const r = base.houseRules.find((x) => x.id === "night-bonus")!;
  const plain = core.settleWeek(run("strong_leader"), undefined, base);
  let s = core.setRule(run("strong_leader"), base, r.id, "large");
  s = core.settleWeek(s, undefined, base);
  assert.equal(s.meters.money, plain.meters.money - 1);
  assert.equal(s.meters.people, plain.meters.people + 1);
  assert.equal(s.meters.output, plain.meters.output + 1);
  assert.deepEqual(core.settleWeek(run("manager"), undefined, base).meters, plain.meters);
});

test("a decree moves meters only where an enforcer stands", () => {
  const withEnforcer = core.setRule(run("absolute", court), court, "curfew", "21:00");
  assert.ok(core.enforcerIn(withEnforcer, court));
  const week = (s: core.Run) => core.settleWeek(s, undefined, court).meters;
  const noOne = structuredClone(withEnforcer);
  noOne.people[boss.id]!.trust = 10;
  assert.ok(!core.enforcerIn(noOne, court));
  assert.notDeepEqual(week(withEnforcer), week(noOne));
});

test("an absolute ruler has no hearing; a meter that stays low costs Legitimacy -10 a Friday", () => {
  let s = run("absolute", court);
  s.meters.people = 0;
  s = core.settleWeek(s, undefined, court);
  assert.equal(legit(s), 60); // first low Friday
  s.meters.people = 0;
  s = core.settleWeek(s, undefined, court);
  assert.equal(s.hearing, null);
  assert.equal(s.status, "playing");
  assert.equal(legit(s), 50);
});
