// M3 review fixes: kit deep checks, family thread close, absolute start, showdown week, old saves, advice, fatal kits.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import * as adv from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/advisors.js";
import { settleBig } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/bigscenes.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import { normalizeKit } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/normalize.js";
import type { PlaceKit } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/types.js";
import { tasks } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/ai/tasks.js";
import { upgradeGame } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/store.js";

const clone = () => structuredClone(HAFENKAI_PLACE) as unknown as Record<string, unknown>;

test("bogus optional kit parts are dropped and a run still plays a week", () => {
  const raw = clone();
  raw.systems = [
    { kind: "bogus", name: "x", text: "y" },
    { kind: "event", name: "Day", text: "t" },
  ];
  raw.houseRules = [
    { id: "constructor", text: "t", options: ["a", "b"], touches: ["fear"], decree: true },
    { id: "no-touches", text: "t", options: ["a"] },
  ];
  raw.hearing = { body: "b", members: [1] };
  raw.templates = { cards: {} };
  (raw.people as { traits: string[] }[])[0]!.traits = ["constructor"];
  const r = normalizeKit(raw);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(
    r.kit.systems.map((b) => b.kind),
    ["event"],
  );
  assert.deepEqual(
    r.kit.houseRules.map((x) => x.id),
    ["constructor"],
  );
  assert.deepEqual(r.kit.hearing, HAFENKAI_PLACE.hearing);
  assert.deepEqual(r.kit.templates, HAFENKAI_PLACE.templates);
  const kit = r.kit;
  const s = core.newRun(core.HAFENKAI, 3, kit);
  assert.equal(typeof core.ruleOption(s, kit.houseRules[0]!), "string");
  const who = kit.people[0]!.id;
  assert.equal(typeof adv.lean(kit, who, [{ stance: "decree" }, { stance: "delay" }]), "string");
  while (s.status === "playing" && s.clock.week < 1) {
    core.draft.seedDay(s);
    while (s.inbox.length && s.clock.hoursLeft > 0)
      core.draft.answerCard(s, s.inbox[0]!.id, s.inbox[0]!.answers[0]!.stance);
    core.draft.endDay(s, kit);
  }
  assert.ok(s.clock.week >= 1);
});

test("an absolute kit without authorityStart gets one and can lose Legitimacy", () => {
  const raw = clone();
  raw.authority = "absolute";
  const r = normalizeKit(raw);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.kit.authorityStart, { fear: 50, love: 40, legitimacy: 60 });
  assert.ok(core.newRun(core.HAFENKAI, 1, r.kit).extras.some((e) => e.id === "legitimacy"));
  raw.authorityStart = { fear: 150, love: -5, legitimacy: 50.4 };
  const c = normalizeKit(raw);
  assert.ok(
    c.ok &&
      c.kit.authorityStart!.fear === 100 &&
      c.kit.authorityStart!.love === 0 &&
      c.kit.authorityStart!.legitimacy === 50,
  );
  raw.authorityStart = { fear: 5 };
  const d = normalizeKit(raw);
  assert.ok(d.ok && d.kit.authorityStart!.legitimacy === 60);
});

test("a slug has no trailing hyphen after the cut", () => {
  const raw = clone();
  raw.id = `${"a".repeat(39)}-bcd`;
  const r = normalizeKit(raw);
  assert.ok(r.ok && r.kit.id === "a".repeat(39));
});

test("a refused-for-size kit is fatal, a repairable one is not", () => {
  const big = clone();
  big.junk = "x".repeat(200_001);
  const a = normalizeKit(big);
  assert.ok(!a.ok && a.fatal);
  const b = normalizeKit({ ...clone(), rooms: [] });
  assert.ok(!b.ok && !b.fatal);
});

const family = (s: ReturnType<typeof core.newRun>) => Object.values(s.threads).find((t) => t.layer === "family");
const seedFamily = (s: ReturnType<typeof core.newRun>) => {
  for (let i = 0; i < 80 && !family(s); i++) core.layerSeeds(s, 3);
  return family(s)!;
};

test("a family thread closes when its evening is played or declined", () => {
  for (const result of ["done", "declined"] as const) {
    const s = core.newRun(core.HAFENKAI, 5);
    s.layers = { drama: 0, romance: 0, press: 0, rivals: 0, family: 100 };
    const t = seedFamily(s);
    const beat = t.beats.find((b) => b.type === "big_scene")!;
    settleBig(s, beat, result);
    assert.equal(family(s), undefined);
    assert.equal(s.closed.find((c) => c.id === t.id)?.state, result === "done" ? "won" : "dropped");
    assert.ok(seedFamily(s).id !== t.id);
  }
});

test("the rival showdown opens in the last week of the term", () => {
  const s = core.newRun(core.HAFENKAI, 5);
  s.layers = { drama: 0, romance: 0, press: 0, rivals: 100, family: 0 };
  s.clock = { ...s.clock, week: core.WEEKS - 1, day: 0 };
  core.layerSeeds(s, 3);
  assert.ok(Object.values(s.threads).some((t) => t.title.includes("showdown")));
});

test("a v2 save gets its kit's blocks", () => {
  const g = core.newRun(core.HAFENKAI, 7) as unknown as Record<string, unknown>;
  delete g.systems;
  g.saveVersion = 2;
  const up = upgradeGame(g as never, "hafenkai");
  assert.ok(Object.values(up.systems).some((b) => b.kind === "event"));
});

test("a model that drops an advice line keeps the card and its other advice", () => {
  const offer = [
    { tier: "strong" as const, stance: "invest" as const },
    { tier: "middle" as const, stance: "cheap_fix" as const },
    { tier: "weak" as const, stance: "refuse" as const },
  ];
  const kit = HAFENKAI_PLACE as PlaceKit;
  const input = {
    kit,
    rng: 7,
    seeds: [
      {
        id: "s1",
        asker: "tomasz",
        need: "output" as const,
        severity: 2 as const,
        offer,
        advisors: [
          { who: "henrike", stance: "refuse" as const },
          { who: "olga", stance: "invest" as const },
        ],
      },
    ],
  };
  const output = {
    cards: [
      {
        seed: "s1",
        text: "The crane needs a new cable by Friday.",
        answers: [
          { stance: "invest", text: "Buy the cable today." },
          { stance: "cheap_fix", text: "Patch the old cable." },
          { stance: "refuse", text: "Tell him to wait." },
        ],
        advice: [{ who: "henrike", text: "Do not spend the money." }],
      },
    ],
  };
  const out = tasks["cards.day"].parse(output as never, input as never) as { cards: { advice?: { who: string }[] }[] };
  assert.deepEqual(
    out.cards[0]!.advice!.map((a) => a.who),
    ["henrike"],
  );
});
