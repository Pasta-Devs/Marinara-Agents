// T8-T10: the five built-in kits beyond Hafenkai validate unchanged, seat people in their own rooms,
// and a careful bot plays 24 weeks without being fired or overthrown.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import {
  KITS,
  rulesOf,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/index.js";
import { normalizeKit } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/normalize.js";

const NEW = ["hollowmere", "ward7", "salt-magpie", "st-corvins", "valmora"] as const;
const RUNS = 20;

for (const id of NEW) {
  const kit = KITS[id].place;

  test(`${id}: passes normalizeKit unchanged`, () => {
    const r = normalizeKit(structuredClone(kit));
    assert.ok(r.ok, r.ok ? "" : r.reasons.join(" "));
    assert.deepEqual(r.fixes, []);
    assert.equal(r.kit.people.length, kit.people.length);
    assert.equal(r.kit.rooms.length, kit.rooms.length);
    assert.equal(r.kit.templates.arrival.length, kit.templates.arrival.length);
    assert.equal(r.kit.hearing.members.length, kit.hearing.members.length);
    assert.equal(r.kit.houseRules.length, kit.houseRules.length);
  });

  test(`${id}: people sit in their own rooms`, () => {
    const ids = new Set(kit.rooms.map((r) => r.id));
    for (const p of kit.people)
      for (const room of Object.values(p.routine)) assert.ok(room === "home" || ids.has(room), `${p.id}: ${room}`);
    assert.ok(kit.hearing.members.every((m) => kit.people.some((p) => p.id === m)));
    const s = core.newRun(rulesOf(kit), 7, kit);
    for (let d = 0; d < 5; d++) core.draft.endDay(s, kit);
    assert.deepEqual(Object.keys(s.rooms).sort(), kit.rooms.map((r) => r.id).sort());
    assert.ok(Object.values(s.rooms).flatMap((r) => r.people).length > 0);
  });

  test(`${id}: a careful bot plays 24 weeks and stays in office`, () => {
    const careful = (c: core.Card, m: core.Meters) => {
      const score = (st: string) => {
        const n = core.applyDelta(m, core.effect(c, st));
        return Math.min(...core.METERS.map((k) => n[k])) * 1000 + core.METERS.reduce((a, k) => a + n[k], 0);
      };
      return c.answers.map((a) => a.stance).reduce((a, b) => (score(b) > score(a) ? b : a));
    };
    for (let seed = 1; seed <= RUNS; seed++) {
      const s = core.newRun(rulesOf(kit), seed, kit);
      while (s.status === "playing") {
        core.draft.seedDay(s);
        while (s.inbox.length && s.clock.hoursLeft > 0)
          core.draft.answerCard(s, s.inbox[0]!.id, careful(s.inbox[0]!, s.meters));
        core.draft.endDay(s, kit);
        if (s.hearing) break;
      }
      assert.ok(
        !s.hearing && s.ending === null,
        `${id} seed ${seed}: ${s.ending ?? "hearing"} in week ${s.clock.week}`,
      );
      assert.equal(s.status, "complete");
    }
  });
}

test("the decree rules of the absolute kits use the fixed ids and a harsh last option", () => {
  const want = {
    "st-corvins": ["curfew", "phones", "dorm-inspections"],
    valmora: ["grain-tax", "hunting-rights", "petition-day"],
  } as const;
  for (const [id, rules] of Object.entries(want)) {
    const kit = KITS[id as keyof typeof want].place;
    assert.equal(kit.authority, "absolute");
    assert.ok(kit.authorityStart);
    assert.deepEqual(
      kit.houseRules.map((r) => r.id),
      rules,
    );
    assert.ok(kit.houseRules.every((r) => r.decree === true && r.options.length === 3));
    assert.ok(kit.people.some((p) => /enforcer/i.test(p.role)));
  }
});

test("St. Corvin's states that every student is an adult", () => {
  const kit = KITS["st-corvins"].place;
  assert.match(kit.premise, /every student is an adult, aged 18 to 23/);
  assert.ok(
    kit.people
      .filter((p) => p.role.startsWith("Student"))
      .every((p) => /Adult student, age (1[89]|2[0-3])\./.test(p.core ?? "")),
  );
});

test("the Salt Magpie has a Rum supply extra meter and a Marooned ending", () => {
  const kit = KITS["salt-magpie"].place;
  assert.deepEqual(kit.extras, [{ id: "rum", label: "Rum supply", main: "people", value: 70 }]);
  assert.equal(kit.hearing.ending, "Marooned");
  const s = core.newRun(rulesOf(kit), 3, kit);
  assert.equal(s.extras.find((e) => e.id === "rum")?.value, 70);
});
