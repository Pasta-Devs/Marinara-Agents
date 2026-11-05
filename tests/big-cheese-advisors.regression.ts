import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import * as adv from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/advisors.js";
import { HAFENKAI_PLACE as kit } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import {
  runTask,
  type CardsDayInput,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/ai/tasks.js";

const fresh = () => core.newRun(core.HAFENKAI, 1);
const offer = [
  { tier: "strong" as const, stance: "invest" },
  { tier: "middle" as const, stance: "cheap_fix" },
  { tier: "weak" as const, stance: "refuse" },
];

test("lean: trait weights pick an offered stance, no match means the middle answer", () => {
  assert.equal(adv.lean(kit, "henrike", offer), "refuse"); // strict
  assert.equal(adv.lean(kit, "olga", offer), "invest"); // generous
  assert.equal(adv.lean(kit, "sven", offer), "cheap_fix"); // cautious, "delay" is not offered
});

test("circle: up to 3 active people, no repeats", () => {
  const s = fresh();
  const s2 = adv.pureSetCircle(s, ["henrike", "olga", "tomasz"]);
  assert.deepEqual(s2.advisors, ["henrike", "olga", "tomasz"]);
  assert.equal(s2.people.henrike!.influence, 50);
  assert.throws(() => adv.pureSetCircle(s, ["henrike", "olga", "tomasz", "dilek"]));
  assert.throws(() => adv.pureSetCircle(s, ["henrike", "henrike"]));
  assert.throws(() => adv.pureSetCircle(s, ["nobody"]));
  assert.throws(() => adv.pureSetCircle(s, ["__proto__"]));
});

test("follow raises influence, an ignored advisor sulks on Friday", () => {
  let s = adv.pureSetCircle(fresh(), ["henrike", "olga"]);
  s = adv.pureFollowAdvice(
    s,
    [
      { who: "henrike", stance: "refuse" },
      { who: "olga", stance: "delay" },
    ],
    "refuse",
  );
  assert.equal(s.people.henrike!.influence, 55);
  assert.equal(s.people.olga!.influence, 50);
  s.clock.week = 2; // a new week with no follow
  const trust = s.people.olga!.trust;
  adv.sulkAdvisors(s);
  assert.equal(s.people.olga!.influence, 40);
  assert.ok(s.people.olga!.trust < trust);
  const e = adv.pureFollowAdvice(s, [{ who: "olga", stance: "delay" }], "delay");
  adv.sulkAdvisors(e);
  assert.equal(e.people.olga!.influence, 45); // followed this week: no sulk
});

test("office hours: up to 4 booked, held on the booked day for one hour", () => {
  let s = fresh();
  assert.throws(() => adv.pureBookHour(s, ["henrike", "olga", "tomasz", "dilek", "gunnar"]));
  s = adv.pureBookHour(s, ["henrike", "olga"]);
  s.clock = { week: 1, day: 1, hoursLeft: 4 };
  assert.throws(() => adv.pureHoldHour(s), /Not office hours/);
  s.clock.day = s.officeHours.day;
  const trust = s.people.henrike!.trust;
  const held = adv.pureHoldHour(s);
  assert.equal(held.clock.hoursLeft, 3);
  assert.equal(held.people.henrike!.trust, trust + 2);
  assert.deepEqual(held.officeHours.visitors, []);
  assert.throws(() => adv.pureHoldHour(held), /No visitors/);
});

test("cards.day: advice only for advisors, Lite answers with the card's own line", async () => {
  const seed = { id: "s1", asker: "tomasz", need: "output" as const, severity: 2 as const, offer };
  const withAdvisors: CardsDayInput = {
    kit,
    rng: 7,
    seeds: [
      { ...seed, advisors: [{ who: "henrike", stance: "refuse" }] },
      { ...seed, id: "s2" },
    ],
  };
  const { output } = await runTask("cards.day", withAdvisors, {});
  const [a, b] = output.cards;
  assert.equal(a!.advice?.[0]?.who, "henrike");
  assert.equal(a!.advice?.[0]?.text, a!.answers.find((x) => x.stance === "refuse")!.text);
  assert.equal(b!.advice, undefined);
});
