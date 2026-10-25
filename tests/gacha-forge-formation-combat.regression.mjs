import assert from "node:assert/strict";
import { test } from "node:test";
import {
  forgeFormationBattle,
  forgeFormationEnemyKit,
  forgeFormationKitMessages,
  forgeFormationPayment,
  forgeFormationTeamError,
  normalizeForgeFormationKit,
  normalizeForgeFormationRules,
  replayForgeFormationBattle,
} from "../packages/gacha-forge/src/formation-combat-shared.mjs";

const ability = (overrides = {}) => ({
  name: "Strike",
  description: "A deliberate strike.",
  effect: "damage",
  target: "enemy",
  power: 100,
  duration: 2,
  cost: 0,
  ...overrides,
});
const kit = (overrides = {}) => ({
  version: 1,
  preferredRow: "front",
  standard: ability(),
  ultimate: ability({ cost: 4, elementCost: 2, power: 220 }),
  passive: {
    name: "Reserve",
    description: "",
    effect: "shield",
    target: "self",
    power: 0,
    duration: 2,
    trigger: "turn_start",
    row: "both",
  },
  traits: [],
  ...overrides,
});
const unit = (id, overrides = {}) => ({
  id,
  name: id,
  affinity: "Fire",
  position: "front",
  power: 1,
  stats: { hp: 100, atk: 10, def: 50, spd: 50, crit: 0 },
  formationKit: kit(),
  ...overrides,
});
const events = (battle) => battle.steps.flatMap((step) => step.events);
function drive(snapshot, choose = () => ({ action: "defend" })) {
  const battle = forgeFormationBattle(snapshot);
  let next = battle.next(),
    count = 0;
  while (!next.done) {
    assert.ok(++count < 256, "bounded activations");
    next = battle.next(choose(next.value, count));
  }
  return next.value;
}

test("kits reject unsupported model code, invented effects, bad costs and recursive trait duplication", () => {
  assert.ok(normalizeForgeFormationKit(kit()));
  assert.equal(normalizeForgeFormationKit(kit({ standard: ability({ effect: "eval" }) })), null);
  assert.equal(normalizeForgeFormationKit(kit({ ultimate: ability({ cost: 1, elementCost: 3 }) })), null);
  assert.equal(normalizeForgeFormationKit(kit({ traits: [{ kind: "solo_front" }, { kind: "solo_front" }] })), null);
  assert.equal(normalizeForgeFormationKit(kit({ passive: { ...kit().passive, trigger: "extra_turn" } })), null);
  assert.equal(
    normalizeForgeFormationRules([{ kind: "defeat_order", description: "Order", order: [0, 0] }], [{}, {}]),
    null,
  );
  assert.equal(
    normalizeForgeFormationRules([{ kind: "element_barrier", description: "Ward", elements: ["ice"] }]),
    null,
  );
  assert.equal(
    normalizeForgeFormationRules([{ kind: "element_barrier", description: "Ward", elements: "fire" }]),
    null,
  );
});

test("native payment is efficient and wildcard elemental substitution costs two points", () => {
  const bank = { fire: 1, water: 1, wind: 0, earth: 0, light: 2, dark: 0 },
    skill = { cost: 2, elementCost: 1 };
  assert.deepEqual(forgeFormationPayment(bank, skill, "fire"), {
    fire: 1,
    water: 1,
    wind: 0,
    earth: 0,
    light: 0,
    dark: 0,
  });
  assert.ok(forgeFormationPayment({ ...bank, fire: 0 }, skill, "fire", { light: 2, water: 1 }));
  assert.equal(forgeFormationPayment({ ...bank, fire: 0 }, skill, "fire", { light: 1, water: 1 }), null);
  assert.equal(forgeFormationPayment(bank, skill, "fire", { fire: 1, water: 1, light: 1 }), null);
  assert.equal(forgeFormationPayment(bank, skill, "fire", { fire: -1, water: 3 }), null);
  assert.equal(forgeFormationPayment(bank, skill, "fire", { fire: 1.5, water: 0.5 }), null);
});

test("only supports generate typed energy, once per own turn, with carry-over and a shared cap", () => {
  const result = drive({
    allies: [
      unit("front"),
      ...["water", "light", "dark"].map((affinity, index) => unit(`support${index}`, { position: "back", affinity })),
    ],
    enemies: [
      unit("foe", { formationKit: kit({ standard: ability({ effect: "shield", target: "self", power: 0 }) }) }),
    ],
  });
  assert.ok(result.log.every((choice) => choice.id === "front"));
  const banks = events(result).filter((event) => event.op === "formation-bank" && event.side === "ally");
  assert.equal(banks[0].bank.water, 1);
  assert.equal(banks[1].bank.water, 2);
  assert.ok(banks.every((event) => Object.values(event.bank).reduce((sum, amount) => sum + amount, 0) <= 12));
  assert.equal(
    Object.values(banks.at(-1).bank).reduce((sum, amount) => sum + amount, 0),
    12,
  );
  assert.equal(result.result, "lose", "a stalled battle is not rewarded as a win");
});

test("players select frontline activation order and each fighter acts only once per turn", () => {
  const result = drive(
    {
      allies: [unit("first", { stats: { hp: 100, atk: 1, def: 100, spd: 100 } }), unit("second")],
      enemies: [unit("foe")],
    },
    (choice) => ({
      action: "defend",
      actorId: choice.formationActors.find((actor) => actor.id === "second")?.id || choice.actor,
    }),
  );
  assert.deepEqual(
    result.log.slice(0, 2).map((choice) => choice.id),
    ["second", "first"],
  );
  assert.equal(result.log.filter((choice) => choice.id === "first").length, 40);
});

test("advancing a support costs an action, supplies no extra energy and cannot create an activation", () => {
  let chosen = 0;
  const result = drive(
    {
      allies: [
        unit("leader", { stats: { hp: 100, atk: 1, def: 100, spd: 100 } }),
        unit("fighter", { affinity: "Water" }),
        unit("support", { position: "back", affinity: "Light" }),
      ],
      enemies: [unit("foe")],
    },
    () =>
      ++chosen === 1
        ? { action: "row", actorId: "leader", moveId: "support", swapId: "fighter" }
        : { action: "defend" },
  );
  assert.equal(result.log[0].action, "row");
  assert.equal(result.log[1].id, "leader", "new support waits for the next team turn");
  const banks = events(result).filter((event) => event.op === "formation-bank" && event.side === "ally");
  assert.equal(banks[0].bank.light, 1);
  assert.equal(banks[1].bank.light, 1);
  assert.equal(banks[1].bank.water, 1);
});

test("the last frontline cannot voluntarily retreat into an empty back slot", () => {
  const result = drive({ allies: [unit("leader")], enemies: [unit("foe")] }, () => ({ action: "row" }));
  assert.equal(events(result).filter((event) => event.op === "row" && event.id === "leader").length, 0);
});

test("a frontline collapse wins while protected enemy supports remain alive", () => {
  const result = drive(
    {
      allies: [
        unit("hero", {
          stats: { hp: 100, atk: 100, def: 100, spd: 100 },
          formationKit: kit({ standard: ability({ power: 300 }) }),
        }),
      ],
      enemies: [
        unit("front", { stats: { hp: 1, atk: 1, def: 1, spd: 1 } }),
        unit("back", { position: "back", stats: { hp: 100, atk: 100, def: 100, spd: 100 } }),
      ],
    },
    () => ({ action: "weapon", targetId: "back" }),
  );
  assert.equal(result.result, "win");
  assert.ok(!events(result).some((event) => event.op === "hit" && event.id === "back"));
  assert.ok(events(result).some((event) => event.op === "death" && event.id === "front" && event.killerId === "hero"));
});

test("ordered bosses protect later targets and element barriers execute as stated", () => {
  const hero = unit("hero", {
    stats: { hp: 100, atk: 100, def: 100, spd: 100 },
    formationKit: kit({ standard: ability({ power: 300 }) }),
  });
  const foes = [
    unit("left", { stats: { hp: 1, atk: 1, def: 1 } }),
    unit("right", { stats: { hp: 1, atk: 1, def: 1 } }),
  ];
  const result = drive(
    { allies: [hero], enemies: foes, rules: [{ kind: "defeat_order", description: "Left then right", order: [0, 1] }] },
    () => ({ action: "weapon", targetId: "right" }),
  );
  assert.deepEqual(
    events(result)
      .filter((event) => event.op === "death")
      .map((event) => event.id),
    ["left", "right"],
  );
  const blocked = drive(
    {
      allies: [{ ...hero, affinity: "Water" }],
      enemies: [foes[0]],
      rules: [{ kind: "element_barrier", description: "Fire only", elements: ["fire"] }],
    },
    () => ({ action: "weapon" }),
  );
  assert.equal(blocked.result, "lose");
  assert.ok(!events(blocked).some((event) => event.op === "hit" && event.id === "left"));
});

test("free actions remain available without supports or energy, and unknown/missing kits fail closed", () => {
  assert.equal(
    forgeFormationTeamError([
      unit("a"),
      unit("b"),
      unit("c"),
      unit("d", { position: "back" }),
      unit("e", { position: "back" }),
    ]),
    "formation-team-size",
  );
  const missing = replayForgeFormationBattle({
    allies: [unit("hero", { formationKit: null })],
    enemies: [unit("foe")],
  });
  assert.equal(missing.result, "lose");
  const emptyBank = forgeFormationBattle({ allies: [unit("hero")], enemies: [unit("foe")] }).next().value;
  assert.equal(emptyBank.options.attack, true);
  assert.equal(emptyBank.options.defend, true);
  assert.equal(emptyBank.options.ultimate, false);
  assert.ok(forgeFormationEnemyKit({ skill: ability() }));
});

test("the identical choices replay identically, including payment, randomness and death attribution", () => {
  const snapshot = {
    allies: [unit("a"), unit("b", { position: "back", affinity: "Light" })],
    enemies: [unit("e")],
    seed: 937,
  };
  const played = drive(snapshot, () => ({ action: "auto" }));
  assert.deepEqual(replayForgeFormationBattle(snapshot, played.log), played);
  assert.ok(played.steps.every((step) => typeof step.d === "number" && Array.isArray(step.events)));
});

test("an explicit None spending bonus is retained in authoritative replay", () => {
  const snapshot = {
    allies: [
      unit("hero", { formationKit: kit({ standard: ability({ cost: 1 }) }) }),
      unit("support", { position: "back", affinity: "Dark" }),
    ],
    enemies: [unit("foe")],
  };
  const played = drive(snapshot, () => ({ action: "weapon", payment: { dark: 1 }, bonus: "" }));
  assert.equal(played.log[0].bonus, "");
  assert.deepEqual(replayForgeFormationBattle(snapshot, played.log), played);
});

test("row-gated passives and token traits are executable and tokens do not acquire actions", () => {
  const source = unit("summoner", {
    formationKit: kit({
      traits: [{ kind: "front_tokens", power: 30 }],
      passive: { ...kit().passive, effect: "heal", power: 100, row: "back" },
    }),
  });
  const result = drive({ allies: [source], enemies: [unit("foe")] });
  assert.equal(events(result).filter((event) => event.op === "summon").length, 2);
  assert.ok(result.log.every((choice) => choice.id === "summoner"));
  assert.ok(!events(result).some((event) => event.op === "heal" && event.id === "summoner"));
});

test("critical and speed modifiers change actual damage rolls and default activation order", () => {
  const buff = (stat) => ({ ...kit().passive, effect: "buff", stat, power: 300, row: "front" });
  const fighter = unit("a", {
    stats: { hp: 100, atk: 10, def: 50, spd: 50, crit: 0 },
    formationKit: kit({ passive: buff("crit") }),
  });
  const empowered = drive({ allies: [fighter], enemies: [unit("e")], seed: 1 }, () => ({ action: "attack" }));
  const ordinary = drive({ allies: [{ ...fighter, formationKit: kit() }], enemies: [unit("e")], seed: 1 }, () => ({
    action: "attack",
  }));
  assert.equal(events(empowered).find((event) => event.op === "hit").crit, true);
  assert.equal(events(ordinary).find((event) => event.op === "hit").crit, false);
  const fast = unit("a", { formationKit: kit({ passive: buff("spd") }) }),
    other = unit("b", { stats: { hp: 100, atk: 10, def: 50, spd: 60 } });
  assert.equal(drive({ allies: [fast, other], enemies: [unit("e")] }).log[0].id, "a");
  assert.equal(drive({ allies: [{ ...fast, formationKit: kit() }, other], enemies: [unit("e")] }).log[0].id, "b");
});

test("generation receives authored four-field canon without roleplay scenario or invented executable code", () => {
  const messages = forgeFormationKitMessages({
    run: { scenario: "World canon" },
    unit: unit("hero"),
    cardContext: {
      description: "Authored description",
      personality: "Authored personality",
      backstory: "Authored history",
      appearance: "Authored look",
    },
  });
  assert.match(messages[1].content, /Authored history/);
  assert.match(messages[0].content, /No arbitrary code/);
  assert.doesNotMatch(messages[1].content, /greetings|exampleDialogue|cardScenario/);
});
