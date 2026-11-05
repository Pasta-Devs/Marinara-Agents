import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { HAFENKAI_PLACE as kit } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";

const withCards = () => {
  const s = core.seedDay(core.newRun(core.HAFENKAI, 1));
  assert.ok(s.inbox.length > 0);
  return s;
};

test("a delegated card is answered at day end, the boss keeps the hour, the delegate gains 15 ambition", () => {
  let s = withCards();
  const need = s.inbox[0]!.need;
  s = core.pureDelegate(s, kit, need, "henrike");
  const hours = s.clock.hoursLeft;
  const mine = s.inbox.filter((c) => c.need === need).length;
  const asked = s.inbox.filter((c) => c.need === need).map((c) => c.id);
  const before = s.people.henrike!.ambition;
  const culture = structuredClone(s.culture);
  core.delegateDay(s, kit);
  assert.equal(s.clock.hoursLeft, hours);
  assert.deepEqual(s.culture, culture); // the boss's stance log stays out of it
  assert.equal(s.eyes, undefined);
  assert.equal(s.delegateLog?.length, mine);
  assert.ok(s.delegateLog!.every((e) => e.who === "henrike" && e.need === need));
  assert.ok(asked.every((id) => !s.inbox.some((c) => c.id === id)));
  assert.equal(s.people.henrike!.ambition, Math.min(100, before + 15 * mine));
});

test("the deputy challenge needs the deputy at 100, a plain delegate does not trigger it", () => {
  let s = withCards();
  const need = s.inbox[0]!.need;
  s = core.pureDelegate(s, kit, need, "henrike");
  s.people.henrike!.ambition = 95;
  s.deputyAmbition = 0;
  core.delegateDay(s, kit);
  assert.equal(s.people.henrike!.ambition, 100);
  assert.ok(s.deputyAmbition < 100);
});

test("bad areas and people are refused, take back leaves a memory", () => {
  const s = withCards();
  assert.throws(() => core.pureDelegate(s, kit, "__proto__", "henrike"));
  assert.throws(() => core.pureDelegate(s, kit, "money", "nobody"));
  const t = core.pureTakeBack(core.pureDelegate(s, kit, "money", "henrike"), "money");
  assert.deepEqual(t.delegated, {});
  assert.equal(t.people.henrike!.memories.at(-1)!.about, "money");
  assert.throws(() => core.pureTakeBack(t, "money"));
});
