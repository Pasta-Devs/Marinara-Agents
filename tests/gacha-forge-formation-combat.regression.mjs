import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import * as shared from "../packages/gacha-forge/src/formation-combat-shared.mjs";
import { forgeFormationLegacyReplay } from "../packages/gacha-forge/src/formation-combat-legacy.mjs";

const {
  FORGE_FORMATION_ENGINE,
  FORGE_FORMATION_RULES,
  forgeFormationBattle,
  forgeFormationEnemyKit,
  forgeFormationPayment,
  forgeFormationProjection,
  forgeFormationTeamError,
  normalizeForgeFormationKit,
  normalizeForgeFormationRules,
  replayForgeFormationBattle,
} = shared;

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
const strong = { hp: 1000, atk: 200, def: 100, spd: 50, crit: 0 };
const weak = { hp: 1, atk: 1, def: 1, spd: 1, crit: 0 };
const events = (battle) => battle.steps.flatMap((step) => step.events);
const hold = () => ({ action: "plan", plan: [] });
function drive(snapshot, choose = hold) {
  const battle = forgeFormationBattle(snapshot);
  let next = battle.next(),
    count = 0;
  const prompts = [];
  while (!next.done) {
    assert.ok(++count < 64, "one prompt per team turn, bounded by 40 rounds");
    // Steps keep growing after a prompt; remember how many there were when it was asked.
    prompts.push({ ...next.value, at: next.value.steps.length });
    next = battle.next(choose(next.value, count));
  }
  return { ...next.value, prompts };
}
const plan = (...entries) => ({ action: "plan", plan: entries });

test("kits are read leniently: synonyms remap, numbers clamp, impossible passives move, broken kits are refused", () => {
  const read = normalizeForgeFormationKit(
    kit({
      version: 1,
      preferredRow: "Support",
      standard: ability({ effect: "Burn", target: "single enemy", power: "999", cost: 9, duration: 7 }),
      ultimate: ability({ effect: "resurrection", target: "party", cost: 12, elementCost: 0, power: 1 }),
      passive: { ...kit().passive, effect: "immune", trigger: "on hit", row: "Back_Row" },
      traits: ["solo_front", { kind: "retreat_echo", power: 500 }, { kind: "eval" }],
    }),
  );
  assert.equal(read.preferredRow, "back");
  assert.equal(read.version, 1, "the stored version is preserved, never stamped");
  assert.deepEqual(
    [read.standard.effect, read.standard.target, read.standard.cost, read.standard.duration],
    ["dot", "enemy", 4, 3],
  );
  assert.equal(read.standard.power, Math.round(shared.forgeFormationPowerCap(read.standard, "standard") * 0.6));
  assert.deepEqual(
    [read.ultimate.effect, read.ultimate.target, read.ultimate.cost, read.ultimate.elementCost, read.ultimate.power],
    ["revive", "allies", 8, 1, 10],
  );
  assert.deepEqual(
    [read.passive.effect, read.passive.trigger, read.passive.row],
    ["shield", "ally_hit", "back"],
    "a back passive that waits to be hit listens for allies instead, and immunity becomes a shield",
  );
  assert.deepEqual(read.traits, [{ kind: "solo_front", power: 50 }], "hybrid perks need a hybrid");
  assert.deepEqual(
    normalizeForgeFormationKit(kit({ traits: ["solo_front"] }), { rarity: 4 }).traits,
    [],
    "signatures are five-star only at generation",
  );
  assert.deepEqual(
    normalizeForgeFormationKit(
      kit({ preferredRow: "hybrid", traits: ["advance_ult", "retreat_echo", "front_tokens", "solo_front"] }),
    ).traits,
    [
      { kind: "advance_ult", power: 0 },
      { kind: "front_tokens", power: 30 },
    ],
    "at most one perk and one signature",
  );
  const healer = normalizeForgeFormationKit(
    kit({ standard: ability({ effect: "heal", target: "ally" }), ultimate: ability({ effect: "buff", cost: 3 }) }),
  );
  assert.equal(healer.standard.effect, "damage", "a front fighter always has something that reaches the enemy");
  assert.equal(normalizeForgeFormationKit(kit({ standard: ability({ effect: "restore" }) })).standard.effect, "heal");
  // An unknown effect or a missing name takes the slot's plain default; only a missing ability is refused.
  assert.equal(normalizeForgeFormationKit(kit({ standard: ability({ effect: "eval" }) })).standard.effect, "damage");
  assert.equal(normalizeForgeFormationKit(kit({ standard: undefined })), null);
  assert.equal(normalizeForgeFormationKit(kit({ standard: ability({ name: "" }) })).standard.name, "Strike");
  const again = normalizeForgeFormationKit(read);
  assert.deepEqual(again, read, "normalizing a normalized kit changes nothing");
});

test("power caps follow the published budgets", () => {
  const cap = shared.forgeFormationPowerCap;
  assert.equal(cap({ effect: "damage", target: "enemy", cost: 0 }, "standard"), 100);
  assert.equal(cap({ effect: "damage", target: "enemy", cost: 2 }, "standard"), 160);
  assert.equal(cap({ effect: "aoe_damage", target: "all_enemies", cost: 4 }, "ultimate"), 168);
  assert.equal(cap({ effect: "damage", target: "enemy", cost: 8 }, "ultimate"), 300);
  assert.equal(cap({ effect: "heal", target: "ally", cost: 0 }, "standard"), 8);
  assert.equal(cap({ effect: "restore", target: "allies", cost: 8 }, "ultimate"), 96);
  assert.equal(cap({ effect: "shield", target: "self" }, "passive", "front"), 11);
  assert.equal(cap({ effect: "stun", target: "enemy", cost: 1 }, "standard"), 50);
  assert.equal(cap({ effect: "energy", target: "self", cost: 8 }, "ultimate"), 3);
});

test("encounter rules keep what can be played and drop the rest", () => {
  assert.deepEqual(
    normalizeForgeFormationRules([{ kind: "defeat_order", description: "Order", order: [0, 0] }], [{}, {}]),
    [],
  );
  assert.deepEqual(
    normalizeForgeFormationRules([{ kind: "element_barrier", description: "Ward", elements: ["ice"] }]),
    [],
  );
  assert.deepEqual(
    normalizeForgeFormationRules(
      [
        { kind: "element_barrier", description: "Ward", elements: ["Fire", "ice"] },
        { kind: "defeat_order", description: "Order", order: [2, 0, 9] },
      ],
      [{}, {}, {}],
    ),
    [
      { kind: "element_barrier", description: "Ward", elements: ["fire"] },
      { kind: "defeat_order", description: "Order", order: [2, 0] },
    ],
  );
  assert.deepEqual(normalizeForgeFormationRules(null), []);
});

test("legacy enemies without a kit fight with their classic skill", () => {
  const fallback = forgeFormationEnemyKit({ skill: ability({ power: 250 }), position: "back" });
  assert.equal(fallback.preferredRow, "back");
  assert.equal(fallback.standard.effect, "damage");
  assert.equal(fallback.ultimate.cost, 3);
  assert.equal(fallback.ultimate.elementCost, 1);
  assert.equal(forgeFormationEnemyKit({}).passive.effect, "shield");
});

test("payment: native first, Light and Dark stand in 1:1, other elements before native for the rest", () => {
  const ultimate = { cost: 3, elementCost: 2 };
  assert.deepEqual(forgeFormationPayment({ fire: 2, water: 1 }, ultimate, "fire"), {
    fire: 2,
    water: 1,
    wind: 0,
    earth: 0,
    light: 0,
    dark: 0,
  });
  assert.deepEqual(forgeFormationPayment({ fire: 1, dark: 1, water: 1 }, ultimate, "fire"), {
    fire: 1,
    water: 1,
    wind: 0,
    earth: 0,
    light: 0,
    dark: 1,
  });
  assert.equal(forgeFormationPayment({ water: 5 }, ultimate, "fire"), null, "the element share needs its element");
  assert.deepEqual(
    forgeFormationPayment({ light: 3 }, ultimate, "light"),
    { fire: 0, water: 0, wind: 0, earth: 0, light: 3, dark: 0 },
    "a Light unit pays with Light alone",
  );
  assert.equal(forgeFormationPayment({ light: 1, dark: 0 }, { cost: 2, elementCost: 1 }, "light"), null);
  assert.deepEqual(forgeFormationPayment({}, { cost: 0 }, "fire"), {
    fire: 0,
    water: 0,
    wind: 0,
    earth: 0,
    light: 0,
    dark: 0,
  });
  const projection = forgeFormationProjection(
    {
      bank: { fire: 3 },
      fighters: [
        { id: "a", aff: "fire", normal: { cost: 2 }, ultimate: { cost: 3, elementCost: 1 } },
        { id: "b", aff: "fire", normal: { cost: 2 }, ultimate: { cost: 3, elementCost: 1 } },
      ],
    },
    [
      { actorId: "a", action: "normal" },
      { actorId: "b", action: "normal" },
    ],
  );
  assert.deepEqual(
    projection.results.map((result) => result.ok),
    [true, false],
    "the second action is short once the first has spent",
  );
  assert.equal(projection.bank.fire, 1);
});

test("teams seat up to six, one to three in front and at most three in back", () => {
  const seat = (front, back) => [
    ...Array.from({ length: front }, (_, index) => unit(`f${index}`)),
    ...Array.from({ length: back }, (_, index) => unit(`b${index}`, { position: "back" })),
  ];
  assert.equal(forgeFormationTeamError(seat(3, 3)), null);
  assert.equal(forgeFormationTeamError(seat(1, 0)), null);
  assert.equal(forgeFormationTeamError(seat(3, 4)), "formation-team-size");
  assert.equal(forgeFormationTeamError(seat(2, 4)), "formation-rows");
  assert.equal(forgeFormationTeamError(seat(0, 2)), "formation-rows");
  assert.equal(forgeFormationTeamError([]), "formation-team-size");
  assert.equal(forgeFormationTeamError([unit("a"), unit("a")]), "formation-team-duplicate");
});

test("supports add one typed energy per own turn with no cap; a side with none gains one every other turn", () => {
  const supported = drive({
    allies: [
      unit("front", { stats: strong }),
      ...["water", "light", "dark"].map((affinity, index) => unit(`support${index}`, { position: "back", affinity })),
    ],
    enemies: [unit("foe", { stats: { ...strong, atk: 1 } })],
  });
  const banks = events(supported).filter((event) => event.op === "formation-bank" && event.side === "ally");
  assert.equal(banks[0].bank.water, 1);
  assert.ok(banks.at(-1).bank.water + banks.at(-1).bank.light + banks.at(-1).bank.dark > 12, "energy never expires");
  assert.equal(
    events(supported).filter((event) => event.op === "energy-gain" && event.id === "support0").length,
    supported.prompts.length,
  );
  const alone = drive(
    {
      allies: [unit("leader", { stats: strong, formationKit: kit({ standard: ability({ cost: 1 }) }) })],
      enemies: [unit("foe", { stats: { ...strong, atk: 1 } })],
    },
    () => plan({ actorId: "leader", action: "normal", targetId: "foe" }),
  );
  const gains = events(alone).filter((event) => event.op === "energy-gain" && event.id === "leader");
  assert.ok(gains.length && gains.every((event) => event.floor));
  const firstHit = alone.steps.findIndex((step) =>
    step.events.some((event) => event.op === "hit" && event.id === "foe"),
  );
  assert.ok(
    firstHit >= alone.prompts[1].at && firstHit < alone.prompts[2].at,
    "a support-less leader with a cost-1 skill acts on its second turn",
  );
});

test("one prompt plans the whole Front Row; actions resolve in plan order and unplanned fighters hold", () => {
  const snapshot = {
    allies: [unit("a", { stats: strong }), unit("b", { stats: strong }), unit("c", { stats: strong })],
    enemies: [unit("foe", { stats: { ...strong, hp: 5000, atk: 1 } })],
    seed: 7,
  };
  const played = drive(snapshot, (prompt) => {
    assert.deepEqual(
      prompt.options.formation.fighters.map((fighter) => fighter.id),
      ["a", "b", "c"],
    );
    assert.equal(prompt.options.formation.v, FORGE_FORMATION_ENGINE);
    return plan(
      { actorId: "c", action: "normal", targetId: "foe" },
      { actorId: "a", action: "hold" },
      { actorId: "nobody", action: "normal" },
      { actorId: "c", action: "ultimate" },
    );
  });
  const first = played.steps.slice(1).flatMap((step) => step.events);
  const acts = first.filter((event) => event.op === "act").slice(0, 1);
  assert.deepEqual(
    acts.map((event) => event.id),
    ["c"],
  );
  const held = first.filter((event) => event.op === "formation-held").slice(0, 2);
  assert.deepEqual(
    held.map((event) => [event.id, event.reason]),
    [
      ["a", "hold"],
      ["b", "hold"],
    ],
  );
  assert.ok(played.log.every((record) => record.v === FORGE_FORMATION_ENGINE && record.action === "plan"));
  assert.deepEqual(played.log[0].plan, [
    { actorId: "c", action: "normal", targetId: "foe" },
    { actorId: "a", action: "hold" },
  ]);
  const { prompts, ...result } = played;
  assert.ok(prompts.length);
  assert.deepEqual(replayForgeFormationBattle(snapshot, played.log), result, "a plan replays as a plan");
});

test("stale plans resolve deterministically: a fallen target is replaced, an unpaid action holds with a note", () => {
  const snapshot = {
    allies: [
      unit("a", { stats: strong, formationKit: kit({ standard: ability({ power: 100, cost: 1 }) }) }),
      unit("b", { stats: strong, formationKit: kit({ standard: ability({ power: 100, cost: 1 }) }) }),
      unit("s", { position: "back", affinity: "Fire" }),
    ],
    enemies: [unit("x", { stats: weak }), unit("y", { stats: { ...strong, atk: 1 } })],
  };
  const played = drive(snapshot, (prompt, count) =>
    count === 1
      ? plan({ actorId: "a", action: "normal", targetId: "x" }, { actorId: "b", action: "normal", targetId: "x" })
      : hold(),
  );
  const first = events({ steps: played.steps.slice(0, played.prompts[1].at) });
  assert.ok(first.some((event) => event.op === "death" && event.id === "x"));
  assert.ok(
    first.some((event) => event.op === "formation-held" && event.id === "b" && event.reason === "energy"),
    "one Fire energy paid for the first action only",
  );
  const retarget = drive(
    {
      ...snapshot,
      allies: snapshot.allies.map((ally) => ({ ...ally, formationKit: kit() })),
    },
    () => plan({ actorId: "a", action: "normal", targetId: "x" }, { actorId: "b", action: "normal", targetId: "x" }),
  );
  const hits = events(retarget).filter((event) => event.op === "hit" && ["x", "y"].includes(event.id));
  assert.deepEqual(
    hits.slice(0, 2).map((event) => event.id),
    ["x", "y"],
    "the second strike finds the enemy still standing",
  );
});

test("the Back Row is never struck; Swap pulls a support forward and Shuffle reseats by seed", () => {
  const swapper = unit("hero", {
    stats: strong,
    formationKit: kit({ ultimate: ability({ effect: "swap", cost: 2, elementCost: 1 }) }),
  });
  const foes = [
    unit("f1", { stats: { ...strong, atk: 1, hp: 300 } }),
    unit("f2", { stats: { ...strong, atk: 1, hp: 200 } }),
    unit("f3", { stats: { ...strong, atk: 1, hp: 100 } }),
    unit("back", { position: "back", stats: { ...strong, atk: 1 } }),
  ];
  const played = drive(
    { allies: [swapper, unit("s1", { position: "back" }), unit("s2", { position: "back" })], enemies: foes },
    (prompt) =>
      prompt.options.formation.fighters[0].targets.ultimate.ids.includes("back")
        ? plan({ actorId: "hero", action: "ultimate", targetId: "back" })
        : plan({ actorId: "hero", action: "normal" }),
  );
  const rows = events(played).filter((event) => event.op === "row");
  assert.deepEqual(rows.slice(0, 2), [
    { op: "row", id: "f1", position: "back" },
    { op: "row", id: "back", position: "front" },
  ]);
  const before = events({
    steps: played.steps.slice(
      0,
      played.steps.findIndex((step) => step.events.includes(rows[0])),
    ),
  });
  assert.ok(!before.some((event) => event.op === "hit" && event.id === "back"), "nothing struck it while it was back");
  const shuffler = unit("hero", {
    stats: strong,
    formationKit: kit({ ultimate: ability({ effect: "shuffle", cost: 2, elementCost: 1 }) }),
  });
  const shuffle = (seed) =>
    events(
      drive(
        {
          allies: [shuffler, unit("s1", { position: "back" }), unit("s2", { position: "back" })],
          enemies: foes,
          seed,
        },
        (_, count) => (count === 2 ? plan({ actorId: "hero", action: "ultimate" }) : hold()),
      ),
    ).filter((event) => event.op === "row");
  assert.deepEqual(shuffle(3), shuffle(3));
  assert.ok(
    [1, 2, 3, 4, 5].some((seed) => shuffle(seed).length > 0),
    "some seed moves someone",
  );
});

test("revive brings back the chosen ally or every fallen ally; restore heals and cleanses", () => {
  const reviver = (target) =>
    unit("cleric", {
      stats: strong,
      formationKit: kit({ ultimate: ability({ effect: "revive", target, cost: 2, elementCost: 1, power: 50 }) }),
    });
  const brittle = (id) => unit(id, { stats: { ...weak, hp: 10 } });
  const one = drive(
    {
      allies: [
        reviver("ally"),
        brittle("x"),
        brittle("y"),
        unit("s1", { position: "back" }),
        unit("s2", { position: "back" }),
      ],
      enemies: [
        unit("foe", {
          stats: { ...strong, atk: 500 },
          formationKit: kit({ standard: ability({ effect: "aoe_damage" }) }),
        }),
      ],
    },
    (prompt) =>
      prompt.options.formation.fallen.includes("y")
        ? plan({ actorId: "cleric", action: "ultimate", targetId: "y" })
        : hold(),
  );
  const revived = events(one).filter((event) => event.op === "revive");
  assert.equal(revived[0]?.id, "y", "the chosen fallen ally returns");
  assert.ok(
    revived.every((event, index) => revived.findIndex((other) => other.id === event.id) === index),
    "once each",
  );
  const all = drive(
    {
      allies: [
        reviver("allies"),
        brittle("x"),
        brittle("y"),
        unit("s1", { position: "back" }),
        unit("s2", { position: "back" }),
      ],
      enemies: [
        unit("foe", {
          stats: { ...strong, atk: 500 },
          formationKit: kit({ standard: ability({ effect: "aoe_damage" }) }),
        }),
      ],
    },
    (prompt) =>
      prompt.options.formation.fallen.length === 2 ? plan({ actorId: "cleric", action: "ultimate" }) : hold(),
  );
  const together = all.steps.find((step) => step.events.filter((event) => event.op === "revive").length === 2);
  assert.ok(together, "every fallen ally returns at once");
});

test("durations count the target's own turns: self-immunity covers the enemy turn, debuffs land on theirs", () => {
  const guarded = unit("hero", {
    stats: strong,
    formationKit: kit({
      ultimate: ability({ effect: "immune", target: "self", cost: 2, elementCost: 1, duration: 1 }),
    }),
  });
  const burner = unit("foe", {
    stats: { ...strong, atk: 300 },
    formationKit: kit({ standard: ability({ effect: "damage", power: 100 }) }),
  });
  const played = drive(
    { allies: [guarded, unit("s", { position: "back" }), unit("t", { position: "back" })], enemies: [burner] },
    (prompt, count) => (count === 1 ? plan({ actorId: "hero", action: "ultimate" }) : hold()),
  );
  const firstEnemyTurn = played.steps.slice(played.prompts[0].at, played.prompts[1].at);
  assert.ok(
    !events({ steps: firstEnemyTurn }).some((event) => event.op === "hit" && event.id === "hero" && event.amount > 0),
  );
  assert.ok(
    events({ steps: firstEnemyTurn }).some(
      (event) => event.op === "debuff" && event.id === "hero" && event.text === "IMMUNE",
    ),
  );
  const weakening = unit("hero", {
    stats: strong,
    formationKit: kit({ standard: ability({ effect: "debuff", stat: "atk", power: 20, duration: 1 }) }),
  });
  const debuffed = drive({ allies: [weakening], enemies: [unit("foe", { stats: strong })] }, () =>
    plan({ actorId: "hero", action: "normal", targetId: "foe" }),
  );
  const step = debuffed.steps.find((entry) => entry.events.some((event) => event.op === "act" && event.id === "foe"));
  assert.deepEqual(
    step.st.foe.find((chip) => chip.k === "atk"),
    { k: "atk", v: -20, r: 1 },
    "active on its own turn",
  );
});

test("shields take the larger value, cap at half max HP and show as a status", () => {
  const shielded = unit("tank", {
    stats: strong,
    formationKit: kit({
      standard: ability({ effect: "shield", target: "self", power: 999, cost: 4 }),
      ultimate: ability({ cost: 2, elementCost: 1 }),
    }),
  });
  const played = drive(
    {
      allies: [shielded, unit("s", { position: "back" }), unit("t", { position: "back" })],
      enemies: [unit("foe", { stats: { ...strong, atk: 1 } })],
    },
    () => plan({ actorId: "tank", action: "normal" }),
  );
  const chips = played.steps.flatMap((step) => step.st?.tank || []).filter((chip) => chip.k === "shield");
  assert.ok(chips.length);
  const hpMax = Math.round(20 + 1000 * 6);
  assert.ok(chips.every((chip) => chip.v <= hpMax * 0.5));
});

test("passives fire at full power once per turn, and back-row ally triggers work", () => {
  const cheer = unit("bard", {
    position: "back",
    formationKit: kit({
      preferredRow: "back",
      passive: { ...kit().passive, effect: "heal", target: "allies", power: 999, trigger: "ally_hit", row: "back" },
    }),
  });
  const played = drive({
    allies: [unit("hero", { stats: strong }), cheer],
    enemies: [unit("foe", { stats: { ...strong, atk: 100 } })],
  });
  const passives = events(played).filter((event) => event.op === "passive" && event.id === "bard");
  assert.ok(passives.length > 0);
  assert.equal(passives[0].name, "Reserve");
  const turns = played.prompts.length * 2;
  assert.ok(passives.length <= turns, "once per team turn");
});

test("traits: advance_ult, retreat_echo, solo_front and Echo tokens", () => {
  const surge = unit("surge", {
    position: "back",
    stats: strong,
    formationKit: kit({
      preferredRow: "hybrid",
      traits: ["advance_ult"],
      ultimate: ability({ cost: 8, elementCost: 3, power: 300 }),
    }),
  });
  const advanced = drive(
    {
      allies: [unit("lead", { stats: strong }), surge],
      enemies: [unit("foe", { stats: { ...strong, hp: 9000, atk: 1 } })],
    },
    (prompt, count) =>
      count === 1
        ? plan({ actorId: "lead", action: "row", moveId: "surge" })
        : count === 2
          ? plan({ actorId: "surge", action: "ultimate", targetId: "foe" })
          : hold(),
  );
  assert.equal(
    advanced.prompts[1].options.formation.fighters.find((fighter) => fighter.id === "surge").ultimate.cost,
    0,
  );
  assert.ok(
    events(advanced).some((event) => event.op === "ult" && event.id === "surge"),
    "free Ultimate after advancing",
  );
  const echo = unit("echo", {
    stats: strong,
    formationKit: kit({
      preferredRow: "hybrid",
      traits: [{ kind: "retreat_echo", power: 80 }],
      ultimate: ability({ cost: 2, elementCost: 1 }),
    }),
  });
  const retreat = drive(
    {
      allies: [echo, unit("mate", { stats: strong }), unit("s", { position: "back" }), unit("t", { position: "back" })],
      enemies: [unit("foe", { stats: { ...strong, hp: 9000, atk: 1 } })],
    },
    (prompt, count) =>
      count === 2
        ? plan({ actorId: "echo", action: "ultimate", targetId: "foe" })
        : count === 3
          ? plan({ actorId: "echo", action: "row", moveId: "echo" })
          : hold(),
  );
  assert.equal(
    events(retreat).filter((event) => event.op === "ult" && event.id === "echo").length,
    2,
    "the retreat recasts the Ultimate",
  );
  const summoner = unit("summoner", {
    stats: strong,
    formationKit: kit({ traits: [{ kind: "front_tokens", power: 30 }] }),
  });
  const tokens = drive(
    {
      allies: [summoner, unit("s", { position: "back" })],
      enemies: [unit("foe", { stats: { ...strong, atk: 2000 } })],
    },
    (prompt) => {
      assert.ok(
        prompt.options.formation.fighters.every((fighter) => !fighter.id.startsWith("summoner~")),
        "tokens never take an action",
      );
      return hold();
    },
  );
  const summons = events(tokens).filter((event) => event.op === "summon");
  assert.equal(summons.length, 2);
  assert.ok(summons.every((event) => event.name === "summoner · Echo"));
  assert.ok(
    events(tokens).some((event) => event.op === "act" && event.id.startsWith("summoner~")),
    "Echoes strike for free",
  );
  const deaths = events(tokens)
    .filter((event) => event.op === "death")
    .map((event) => event.id);
  assert.ok(deaths.includes("summoner") && deaths.includes("s"), "the support steps up and falls too");
  assert.equal(tokens.result, "lose", "Echoes do not keep a team alive");
  const solo = (allies) =>
    events(
      drive({ allies, enemies: [unit("foe", { stats: { ...strong, atk: 1, hp: 9000 } })], seed: 2 }, () =>
        plan({ actorId: "solo", action: "normal", targetId: "foe" }),
      ),
    ).find((event) => event.op === "hit" && event.id === "foe").amount;
  const lone = unit("solo", { stats: strong, formationKit: kit({ traits: [{ kind: "solo_front", power: 100 }] }) });
  assert.ok(solo([lone]) > solo([lone, unit("mate", { stats: strong })]), "alone in front it hits harder");
});

test("enemy AI: casts its Ultimate when it can pay, charge marks then fires its Ultimate ×1.5, saving lasts a turn", () => {
  const boss = unit("boss", {
    stats: { ...strong, atk: 50 },
    mech: ["charge"],
    formationKit: kit({ ultimate: ability({ name: "Meteor", cost: 2, elementCost: 1, power: 200 }) }),
  });
  const played = drive({
    allies: [unit("hero", { stats: { ...strong, atk: 1 } }), unit("mate", { stats: { ...strong, hp: 500, atk: 1 } })],
    enemies: [boss, unit("battery", { position: "back" })],
  });
  const all = events(played);
  const charge = all.find((event) => event.op === "charge");
  assert.ok(charge && charge.target, "the telegraph names its target");
  const marked = played.steps.find((step) => step.events.includes(charge)).st[charge.target];
  assert.ok(marked.some((chip) => chip.k === "fmarked"));
  const after = all.slice(all.indexOf(charge) + 1);
  const strike = after.find((event) => event.op === "ult" && event.id === "boss");
  assert.equal(strike?.name, "Meteor");
  const saver = unit("saver", {
    stats: { ...strong, atk: 50 },
    formationKit: kit({ standard: ability({ cost: 1 }), ultimate: ability({ cost: 4, elementCost: 1 }) }),
  });
  const saving = drive({
    allies: [unit("hero", { stats: { ...strong, atk: 1 } })],
    enemies: [saver, unit("battery", { position: "back" }), unit("battery2", { position: "back" })],
  });
  const enemyActs = events(saving).filter(
    (event) => ["act", "formation-held"].includes(event.op) && event.id === "saver",
  );
  assert.ok(
    !enemyActs.some((event, index) => event.op === "formation-held" && enemyActs[index + 1]?.op === "formation-held"),
  );
});

test("Auto plays a whole turn and replays from its one-record log; control cannot chain", () => {
  const snapshot = {
    allies: [unit("a", { stats: strong }), unit("b", { position: "back", affinity: "Light" })],
    enemies: [
      unit("e", {
        stats: { ...strong, atk: 20 },
        formationKit: kit({ standard: ability({ effect: "stun", power: 100, cost: 0 }) }),
      }),
    ],
    seed: 937,
  };
  const played = drive(snapshot, (prompt, count) => (count % 2 ? { action: "auto" } : hold()));
  assert.ok(played.log.every((record, index) => record.action === (index % 2 ? "plan" : "auto")));
  const { prompts, ...result } = played;
  assert.ok(prompts.length > 1);
  assert.deepEqual(replayForgeFormationBattle(snapshot, played.log), result);
  const stuns = events(played).filter((event) => event.op === "stun" && event.id === "a").length;
  const resisted = events(played).filter(
    (event) => event.op === "debuff" && event.id === "a" && event.text === "RESIST",
  ).length;
  assert.ok(stuns > 0 && resisted > 0, "a stunned fighter shrugs off the next stun");
});

test("defeat order protects later enemies, element barriers bind every action, and a side with nobody left loses", () => {
  const hero = unit("hero", { stats: strong, formationKit: kit({ standard: ability({ power: 100 }) }) });
  const foes = [unit("left", { stats: weak }), unit("right", { stats: weak })];
  const ordered = drive(
    { allies: [hero], enemies: foes, rules: [{ kind: "defeat_order", description: "Left then right", order: [0, 1] }] },
    (prompt) => {
      const reach = prompt.options.formation.fighters[0].targets.normal;
      if (reach.ids.length === 1 && reach.ids[0] === "left") assert.equal(reach.blocked.right, "order");
      return plan({ actorId: "hero", action: "normal", targetId: "right" });
    },
  );
  assert.deepEqual(
    events(ordered)
      .filter((event) => event.op === "death")
      .map((event) => event.id),
    ["left", "right"],
  );
  assert.equal(ordered.result, "win");
  const blocked = drive(
    {
      allies: [{ ...hero, affinity: "Water" }],
      enemies: [foes[0]],
      rules: [{ kind: "element_barrier", description: "Fire only", elements: ["fire"] }],
    },
    (prompt) => {
      assert.deepEqual(prompt.options.formation.fighters[0].targets.normal.ids, []);
      return plan({ actorId: "hero", action: "normal", targetId: "left" });
    },
  );
  assert.equal(blocked.result, "lose");
  assert.ok(events(blocked).some((event) => event.op === "formation-held" && event.reason === "target"));
  assert.ok(!events(blocked).some((event) => event.op === "hit" && event.id === "left"));
});

test("long fights fade into fatigue and every fight ends", () => {
  const wall = (id) =>
    unit(id, {
      stats: { hp: 100, atk: 1, def: 100, spd: 50, crit: 0 },
      formationKit: kit({ standard: ability({ effect: "damage", power: 10 }) }),
    });
  const played = drive({ allies: [wall("a")], enemies: [wall("b")] });
  assert.ok(events(played).some((event) => event.op === "formation-fatigue"));
  assert.ok(["win", "lose"].includes(played.result));
});

test("unknown or missing hero kits fail closed, and nothing in the engine depends on locale", async () => {
  assert.equal(
    replayForgeFormationBattle({ allies: [unit("hero", { formationKit: null })], enemies: [unit("foe")] }).result,
    "lose",
  );
  const source = await readFile(
    new URL("../packages/gacha-forge/src/formation-combat-shared.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /localeCompare|Date\.now|Math\.random/u);
});

test("the saved snapshot, not the client log, picks the engine that scores a claim", () => {
  const snapshot = { allies: [unit("a", { stats: strong })], enemies: [unit("e", { stats: weak })], seed: 5 };
  // A fight saved on engine 2 refuses records it would not write, even with the old engine present.
  globalThis.forgeFormationLegacyReplay = forgeFormationLegacyReplay;
  try {
    const stamped = { ...snapshot, formationEngine: FORGE_FORMATION_ENGINE };
    assert.equal(replayForgeFormationBattle(stamped, [{ action: "attack" }, { action: "auto" }]).result, "lose");
    assert.equal(replayForgeFormationBattle(stamped, []).result, replayForgeFormationBattle(snapshot, []).result);
  } finally {
    delete globalThis.forgeFormationLegacyReplay;
  }
  const old = forgeFormationLegacyReplay(snapshot, []);
  assert.ok(old.log.length && old.log.every((record) => record.v === undefined));
  globalThis.forgeFormationLegacyReplay = forgeFormationLegacyReplay;
  try {
    assert.deepEqual(replayForgeFormationBattle(snapshot, old.log), old);
  } finally {
    delete globalThis.forgeFormationLegacyReplay;
  }
  const current = replayForgeFormationBattle(snapshot, old.log);
  assert.ok(
    current.log.every((record) => record.v === FORGE_FORMATION_ENGINE),
    "without it, the log is read as Auto",
  );
  // A fight left pending by 1.24.0 carries no stamp but writes engine-2 records: the current engine scores it,
  // even with the old engine present.
  globalThis.forgeFormationLegacyReplay = () => assert.fail("engine-2 records never reach the legacy replay");
  try {
    const replayed = replayForgeFormationBattle(snapshot, current.log);
    assert.equal(replayed.result, current.result);
    assert.deepEqual(replayed.log, current.log);
  } finally {
    delete globalThis.forgeFormationLegacyReplay;
  }
});

test("the server seats enemies front-first and keeps Classic guides byte-identical", async () => {
  const source = await readFile(
    new URL("../packages/gacha-forge/src/formation-combat-server.mjs", import.meta.url),
    "utf8",
  );
  const context = vm.createContext({ ...shared });
  vm.runInContext(
    source.replace(/^export /gmu, "") +
      ";globalThis.adapter={messages:forgeFormationEncounterMessages,enemies:forgeFormationEnemies,guide:forgeFormationNormalizeGuide,kit:forgeFormationKitMessages};",
    context,
  );
  const { adapter } = context;
  const prompt = adapter.messages(
    [{ role: "system", content: "Write an encounter." }],
    { combat: { mode: "formation" } },
    ["fire"],
  );
  assert.match(prompt[0].content, /ZERO-BASED indices into this encounter's full formation array/u);
  assert.match(prompt[0].content, /ordered enemies are placed in the Front Row/u);
  assert.match(prompt[0].content, /EVERY elite and boss MUST have one/u);
  const classic = [{ role: "system", content: "Write an encounter." }];
  assert.equal(
    adapter.messages(classic, { combat: { mode: "classic" } }, ["fire"]),
    classic,
    "Classic prompts are untouched",
  );
  const preferring = (row) => kit({ preferredRow: row });
  const seated = adapter.enemies(
    [
      unit("a", { position: "back", formationKit: preferring("back") }),
      unit("b", { position: "back", formationKit: preferring("back") }),
      unit("c", { position: "front", formationKit: preferring("front") }),
      unit("d", { position: "back", formationKit: preferring("front") }),
      unit("boss", { position: "back", tier: "boss", formationKit: preferring("back") }),
      unit("e", { position: "back", formationKit: preferring("back") }),
    ],
    [],
  );
  assert.deepEqual(
    Array.from(seated, (enemy) => enemy.position),
    ["back", "back", "front", "front", "front", "back"],
  );
  assert.ok(seated.every((enemy) => enemy.formation === true));
  const ordered = adapter.enemies(
    ["x", "y", "z"].map((id) => unit(id, { position: "back", formationKit: preferring("back") })),
    [{ kind: "defeat_order", order: [2, 1], description: "z then y" }],
  );
  assert.deepEqual(
    Array.from(ordered, (enemy) => enemy.position),
    ["back", "front", "front"],
  );
  const guide = {
    title: "Gate",
    formation: [
      { id: "enemy-0", name: "Boss", tier: "boss", position: "front" },
      { id: "enemy-1", name: "Guard", tier: "soldier", position: "front" },
    ],
  };
  const raw = { formation: [{ name: "Boss" }, { name: "Guard" }] };
  assert.equal(
    JSON.stringify(adapter.guide(raw, structuredClone(guide))),
    JSON.stringify(guide),
    "a Classic guide without Formation fields is returned byte-identical",
  );
  assert.equal(
    adapter.guide(raw, structuredClone(guide), ["fire"]),
    null,
    "a Formation boss without a kit is regenerated",
  );
  const fixed = adapter.guide(
    {
      formation: [{ formationKit: kit() }, {}],
      formationRules: [{ kind: "element_barrier", elements: ["water"], description: "Water only" }],
    },
    structuredClone(guide),
    ["fire"],
  );
  assert.ok(fixed.formation[0].formationKit);
  assert.equal(fixed.formation[1].formationKit, undefined, "a soldier fights with its fallback kit");
  assert.equal(fixed.formationRules, undefined, "an unowned barrier is dropped, not regenerated");
  const messages = adapter.kit({
    run: { scenario: "World canon", language: "Español" },
    unit: unit("hero"),
    cardContext: { backstory: "Authored history" },
  });
  assert.match(messages[1].content, /Authored history/u);
  assert.match(messages[0].content, /Write every name and description in Español/u);
  assert.match(messages[0].content, /No arbitrary code/u);
  assert.match(messages[0].content, /heal and restore = % of each target's max HP/u);
  assert.match(messages[0].content, /x 0\.08 heal/u, "the prompt states the engine's own heal share");
});

const fewer = (list, op, id) => list.filter((event) => event.op === op && (id == null || event.id === id));

test("drifted kits parse: stat-named effects, synonyms, a 'normal' key and a tank's taunt", () => {
  const drift = normalizeForgeFormationKit({
    preferredRow: "front",
    normal: { name: "Bulwark", effect: "Defense Up", target: "self", power: 99 },
    ultimate: { name: "Mending Rain", effect: "heal_all", power: 99, cost: 4 },
    passive: { name: "Thorns", effect: "thorns", trigger: "on_hit", row: "front" },
  });
  assert.deepEqual([drift.standard.effect, drift.standard.stat], ["buff", "def"]);
  assert.deepEqual([drift.ultimate.effect, drift.ultimate.target], ["heal", "allies"]);
  assert.equal(drift.passive.effect, "damage");
  assert.equal(
    drift.standard.description,
    "",
    "nothing was rewritten; a striking passive counts as reaching the enemy",
  );
  assert.equal(drift.standard.effect, "buff");
  const tank = normalizeForgeFormationKit(
    kit({
      standard: ability({ name: "Bulwark Call", effect: "taunt", description: "Draws every attack." }),
      ultimate: ability({ effect: "aoe_damage", cost: 4, elementCost: 1 }),
    }),
  );
  assert.equal(tank.standard.effect, "taunt", "a taunt Normal with an attacking Ultimate stays a taunt");
  const idle = normalizeForgeFormationKit(
    kit({
      standard: ability({ effect: "shield", target: "self", description: "Raises a ward." }),
      ultimate: ability({ effect: "buff", stat: "def", cost: 3, elementCost: 1 }),
    }),
  );
  assert.deepEqual(
    [idle.standard.effect, idle.standard.description],
    ["damage", ""],
    "a rewritten skill drops its old text",
  );
  const salvaged = normalizeForgeFormationKit(
    { preferredRow: "back", standard: { name: "Glare", effect: "glare" } },
    { fallback: forgeFormationEnemyKit({ skill: ability({ name: "Old Strike" }) }) },
  );
  assert.equal(salvaged.ultimate.name, "Old Strike", "a missing slot comes from the enemy's classic skill");
  assert.equal(salvaged.standard.name, "Glare");
});

test("a planned energy cast funds the steps after it, in the projection and the engine alike", () => {
  const charger = unit("charger", {
    stats: strong,
    formationKit: kit({ standard: ability({ name: "Kindle", effect: "energy", target: "self", power: 2, cost: 1 }) }),
  });
  const striker = unit("striker", {
    stats: strong,
    formationKit: kit({ ultimate: ability({ name: "Blaze", cost: 2, elementCost: 1 }) }),
  });
  const snapshot = {
    allies: [
      charger,
      striker,
      unit("s", { position: "back", affinity: "Water" }),
      unit("t", { position: "back", affinity: "Water" }),
    ],
    enemies: [unit("foe", { stats: { ...strong, hp: 9000, atk: 1 } })],
  };
  const battle = forgeFormationBattle(snapshot);
  let next = battle.next();
  const plan = [
    { actorId: "charger", action: "normal" },
    { actorId: "striker", action: "ultimate", targetId: "foe" },
  ];
  const formation = next.value.options.formation;
  assert.deepEqual(formation.bank.water, 2);
  const projection = forgeFormationProjection(formation, plan);
  assert.deepEqual(
    projection.results.map((result) => result.ok),
    [true, true],
    "Kindle's Fire pays the Ultimate's Fire share",
  );
  next = battle.next({ action: "plan", plan });
  const turn = next.value.steps.flatMap((step) => step.events);
  assert.ok(fewer(turn, "ult", "striker").length === 1);
  assert.ok(!turn.some((event) => event.op === "formation-held" && event.reason === "energy"));
});

test("every spent point adds its element's bonus", () => {
  const hit = (element, overrides = {}, seed = 3) => {
    const hero = unit("hero", {
      stats: { hp: 1000, atk: 200, def: 100, spd: 50, crit: 0 },
      formationKit: kit({ standard: ability({ cost: 2 }) }),
      ...overrides,
    });
    const played = drive(
      {
        allies: [
          hero,
          unit("mate", { stats: { ...strong, hp: 40 } }),
          unit("s1", { position: "back", affinity: element }),
          unit("s2", { position: "back", affinity: element }),
        ],
        enemies: [unit("foe", { stats: { hp: 9000, atk: 1, def: 100, spd: 1, crit: 0 } })],
        seed,
      },
      (prompt, count) => (count === 1 ? plan({ actorId: "hero", action: "normal", targetId: "foe" }) : hold()),
    );
    const first = played.steps.slice(played.prompts[0].at, played.prompts[1].at).flatMap((step) => step.events);
    return { first, amount: first.find((event) => event.op === "hit" && event.id === "foe")?.amount };
  };
  const water = hit("Water"),
    fire = hit("Fire"),
    dark = hit("Dark");
  assert.ok(Math.abs(fire.amount / water.amount - 1.1) < 0.02, `Fire +5% a point: ${fire.amount} vs ${water.amount}`);
  assert.ok(Math.abs(dark.amount / water.amount - 1.16) < 0.02, `Dark +8% a point: ${dark.amount} vs ${water.amount}`);
  assert.ok(
    fewer(hit("Earth").first, "shieldFx").some((event) => event.ids.includes("hero")),
    "Earth shields the user",
  );
  assert.ok(fewer(water.first, "heal").length && !fewer(fire.first, "heal").length, "Water heals the weakest ally");
  assert.ok(fewer(hit("Light").first, "heal", "hero").length, "Light heals the user");
  // At 80 crit, two Wind points make every hit a crit; the same skill paid with Water does not always crit.
  const crits = (element) =>
    [1, 99992, 299974, 499956, 6599407].map(
      (seed) =>
        hit(element, { stats: { hp: 1000, atk: 200, def: 100, spd: 50, crit: 80 } }, seed).first.find(
          (event) => event.op === "hit" && event.id === "foe",
        ).crit,
    );
  assert.ok(crits("Wind").every(Boolean), "Wind +10 crit a point");
  assert.ok(crits("Water").some((crit) => !crit));
});

test("the AI casts Ultimates it can pay, and a saver casts the one it saved for", () => {
  const caster = unit("caster", {
    stats: { ...strong, atk: 20 },
    formationKit: kit({ ultimate: ability({ name: "Surge", cost: 2, elementCost: 1 }) }),
  });
  const played = drive({
    allies: [unit("hero", { stats: { ...strong, atk: 1 } })],
    enemies: [caster, unit("b1", { position: "back" }), unit("b2", { position: "back" })],
  });
  assert.ok(fewer(events(played), "ult", "caster").length > 0);
  const saver = unit("saver", {
    stats: { ...strong, atk: 20 },
    formationKit: kit({
      standard: ability({ cost: 1 }),
      ultimate: ability({ name: "Payday", cost: 4, elementCost: 1 }),
    }),
  });
  const saving = drive({
    allies: [unit("hero", { stats: { ...strong, atk: 1 } })],
    enemies: [saver, unit("b1", { position: "back" }), unit("b2", { position: "back" })],
  });
  assert.ok(fewer(events(saving), "ult", "saver").length > 0);
});

test("recast immunity cannot stall a fight: a ward forces a hittable turn and the AI stops wasting casts", () => {
  const aegis = (target) =>
    unit("boss", {
      stats: { hp: 300, atk: 60, def: 100, spd: 50, crit: 0 },
      formationKit: kit({
        ultimate: ability({ name: "Aegis", effect: "immune", target, cost: 4, elementCost: 1, duration: 2 }),
      }),
    });
  for (const target of ["self", "allies"])
    for (const batteries of [2, 3]) {
      const fighter = (id) => unit(id, { stats: { hp: 100, atk: 80, def: 80, spd: 50, crit: 0 } });
      const fight = replayForgeFormationBattle({
        allies: [fighter("a"), fighter("c"), fighter("d")],
        enemies: [
          aegis(target),
          ...Array.from({ length: batteries }, (_, index) => unit(`b${index}`, { position: "back" })),
        ],
        seed: 7,
      });
      const all = events(fight);
      const firstCast = all.findIndex((event) => event.op === "ult" && event.id === "boss");
      assert.ok(firstCast >= 0, "the boss casts its immunity");
      assert.ok(
        all.slice(firstCast).some((event) => event.op === "hit" && event.id === "boss" && event.amount > 0),
        `${target}/${batteries}: the boss can be hurt after its first immune cast`,
      );
      assert.equal(fight.result, "win", `${target}/${batteries}: the fight can be won`);
      assert.ok(
        !all.some((event) => event.op === "debuff" && event.id === "boss" && event.text === "RESIST"),
        "the AI never casts immunity that cannot land",
      );
    }
  const wall = unit("wall", {
    stats: strong,
    formationKit: kit({
      standard: ability({ effect: "taunt", target: "self", duration: 3 }),
      ultimate: ability({ effect: "immune", target: "self", cost: 2, elementCost: 1, duration: 3 }),
    }),
  });
  const battle = forgeFormationBattle({
    allies: [unit("hero", { stats: strong })],
    enemies: [
      wall,
      unit("blade", { stats: strong }),
      unit("b1", { position: "back" }),
      unit("b2", { position: "back" }),
    ],
  });
  battle.next();
  const next = battle.next(hold());
  const reach = next.value.options.formation.fighters[0].targets.normal;
  assert.ok(reach.ids.includes("blade"), "an immune taunter cannot pin the attack");
});

test("a taunt says why the other foes cannot be picked", () => {
  const taunter = unit("taunter", {
    stats: strong,
    formationKit: kit({
      passive: { ...kit().passive, effect: "taunt", target: "self", trigger: "turn_start", row: "front" },
    }),
  });
  const battle = forgeFormationBattle({
    allies: [unit("hero", { stats: strong })],
    enemies: [taunter, unit("other", { stats: strong })],
  });
  battle.next();
  const next = battle.next(hold());
  const reach = next.value.options.formation.fighters[0].targets.normal;
  assert.deepEqual(reach.ids, ["taunter"]);
  assert.equal(reach.blocked.other, "taunt");
});

test("a summon with no free seat holds without paying, and Echoes keep coming all fight", () => {
  const caller = unit("caller", {
    stats: strong,
    formationKit: kit({
      ultimate: ability({ name: "Call", effect: "summon", target: "self", cost: 2, elementCost: 1, power: 30 }),
    }),
  });
  const battle = forgeFormationBattle({
    allies: [
      caller,
      unit("m1", { stats: strong }),
      unit("m2", { stats: strong }),
      unit("s1", { position: "back" }),
      unit("s2", { position: "back" }),
    ],
    enemies: [unit("foe", { stats: { ...strong, hp: 9000, atk: 1 } })],
  });
  let next = battle.next();
  assert.deepEqual(next.value.options.formation.fighters[0].targets.ultimate.ids, [], "nothing to summon into");
  const before = next.value.options.formation.bank.fire;
  next = battle.next(plan({ actorId: "caller", action: "ultimate" }));
  const turn = next.value.steps.flatMap((step) => step.events);
  assert.ok(turn.some((event) => event.op === "formation-held" && event.id === "caller" && event.reason === "target"));
  assert.ok(!fewer(turn, "ult", "caller").length);
  assert.equal(next.value.options.formation.bank.fire, before + 2, "the bank kept its energy and gained this turn's");
  // Ten starting units: the old cap of thirty actors stopped summoning after twenty Echoes, dead ones included.
  const owner = unit("owner", {
    stats: { hp: 3000, atk: 1, def: 2000, spd: 50, crit: 0 },
    formationKit: kit({ traits: [{ kind: "front_tokens", power: 20 }] }),
  });
  const sweeper = (id) =>
    unit(id, {
      stats: { hp: 99999, atk: 450, def: 9000, spd: 50, crit: 0 },
      formationKit: kit({ standard: ability({ effect: "aoe_damage", target: "all_enemies", power: 70 }) }),
    });
  const long = replayForgeFormationBattle({
    allies: [owner, ...["b1", "b2", "b3"].map((id) => unit(id, { position: "back" }))],
    enemies: [
      sweeper("s1"),
      sweeper("s2"),
      sweeper("s3"),
      ...["e1", "e2", "e3"].map((id) => unit(id, { position: "back" })),
    ],
    seed: 1,
  });
  const summons = fewer(events(long), "summon");
  assert.ok(summons.length > 20, `Echoes keep refilling seats: ${summons.length}`);
});

test("retreat_echo repeats one paid cast once, never its own echo", () => {
  const echo = unit("echo", {
    stats: strong,
    formationKit: kit({
      preferredRow: "hybrid",
      traits: [{ kind: "retreat_echo", power: 80 }],
      ultimate: ability({ cost: 2, elementCost: 1 }),
    }),
  });
  const played = drive(
    {
      allies: [echo, unit("mate", { stats: strong }), unit("s", { position: "back" }), unit("t", { position: "back" })],
      enemies: [unit("foe", { stats: { ...strong, hp: 90000, atk: 1 } })],
    },
    (prompt) => {
      const ready = prompt.options.formation.fighters.map((fighter) => fighter.id);
      if (ready.includes("echo") && prompt.round === 1)
        return plan({ actorId: "echo", action: "ultimate", targetId: "foe" });
      if (ready.includes("echo")) return plan({ actorId: "echo", action: "row", moveId: "echo" });
      return plan({ actorId: "mate", action: "row", moveId: "echo" });
    },
  );
  assert.equal(fewer(events(played), "ult", "echo").length, 2, "the paid Ultimate and one echo of it");
});

test("a kit-less enemy's placeholder passive never fires", () => {
  const played = drive({
    allies: [unit("hero", { stats: { ...strong, atk: 1 } })],
    enemies: [unit("soldier", { formationKit: null, skill: ability(), passive: null, stats: { ...strong, atk: 1 } })],
  });
  assert.equal(fewer(events(played), "passive", "soldier").length, 0);
  assert.ok(!events(played).some((event) => event.op === "shieldFx" && event.ids.includes("soldier")));
});

test("the guide, seating and prompts keep the boss in the fight and every number honest", async () => {
  const source = await readFile(
    new URL("../packages/gacha-forge/src/formation-combat-server.mjs", import.meta.url),
    "utf8",
  );
  const context = vm.createContext({ ...shared });
  vm.runInContext(
    source.replace(/^export /gmu, "") +
      ";globalThis.adapter={enemies:forgeFormationEnemies,prepare:forgeFormationPrepare,guide:forgeFormationNormalizeGuide,error:forgeFormationEncounterError,classic:forgeFormationClassicFields,kit:forgeFormationKitMessages,messages:forgeFormationEncounterMessages};",
    context,
  );
  const { adapter } = context;
  const formation = { combat: { mode: "formation" } };
  for (const [members, order, boss] of [
    [["boss", "s1", "s2", "s3"], [1, 2, 3], 0],
    [["s1", "s2", "s3", "boss"], [0, 1, 2], 3],
  ]) {
    const enemies = members.map((id) =>
      unit(id, {
        position: "back",
        tier: id === "boss" ? "boss" : "soldier",
        formationKit: kit({ preferredRow: "back" }),
        stats: id === "boss" ? strong : weak,
      }),
    );
    const prepared = adapter.prepare(formation, [], enemies, [
      { kind: "defeat_order", order, description: "Wards first" },
    ]);
    assert.equal(prepared.enemies[boss].position, "front", `${members.join(",")}: the boss holds a Front Row seat`);
    assert.equal(prepared.formationRules[0].order.length, 2);
    const fight = replayForgeFormationBattle({
      allies: [unit("hero", { stats: { ...strong, atk: 400 } })],
      enemies: prepared.enemies,
      rules: prepared.formationRules,
    });
    if (fight.result === "win")
      assert.ok(fewer(events(fight), "death", "boss").length, "winning means defeating the boss");
  }
  const base = {
    title: "Gate",
    formation: [{ id: "enemy-0", name: "Boss", tier: "boss", position: "front", skill: ability() }],
  };
  const raw = {
    formation: [{ formationKit: { standard: { name: "Glare", effect: "glare" }, passive: { name: "Ward" } } }],
    formationRules: [{ kind: "element_barrier", elements: ["water"], description: "Water only" }],
  };
  const inner = adapter.guide(raw, structuredClone(base));
  assert.ok(inner.formationRules, "the Classic pass keeps the rules it read");
  const outer = adapter.guide(raw, inner, ["fire"]);
  assert.equal(
    outer.formationRules,
    undefined,
    "a barrier the player cannot meet is dropped, not kept from an earlier pass",
  );
  assert.equal(adapter.error([unit("hero")], outer.formationRules || []), null);
  assert.ok(
    outer.formation[0].formationKit.ultimate,
    "a drifted boss kit is salvaged from its classic skill, not regenerated",
  );
  const fixed = adapter.classic({ formation: [{ skill: { effect: "taunt" }, passive: { effect: "regen" } }] });
  assert.deepEqual([fixed.formation[0].skill.effect, fixed.formation[0].passive.effect], ["shield", "heal"]);
  const appendix = adapter.messages([{ role: "system", content: "" }], formation, ["fire"])[0].content;
  assert.match(appendix, /Every enemy still needs its classic fields/u);
  assert.doesNotMatch(appendix, /replace the classic combat rules/u);
  assert.match(appendix, /If the boss is not in the defeat_order, the order holds at most 2 indices/u);
  const prompt = adapter.kit({ run: { scenario: "" }, unit: unit("hero") })[0].content;
  assert.match(prompt, new RegExp(`No ability's power exceeds ${shared.forgeFormationMaxPower}`, "u"));
  for (const line of prompt.split("\n").filter((entry) => /^A (front fighter|back support): /u.test(entry))) {
    const written = JSON.parse(line.slice(line.indexOf("{")));
    const read = normalizeForgeFormationKit(written);
    for (const slot of ["standard", "ultimate", "passive"])
      assert.equal(
        read[slot].power,
        written[slot].power,
        `${line.slice(0, 16)} ${slot} is within its limit as written`,
      );
  }
});

test("a support skill on front_row reads as the user's own Front Row, matching who it reaches", async () => {
  const { forgeFormationCombatEnglish } = await import("../packages/gacha-forge/src/formation-combat-en.mjs");
  const source = await readFile(
    new URL("../packages/gacha-forge/src/formation-combat-client.mjs", import.meta.url),
    "utf8",
  );
  const context = vm.createContext({ ...shared, forgeFormationCombatEnglish });
  vm.runInContext(source.replace(/^export /gmu, "") + ";globalThis.describe=forgeFormationDescribe;", context);
  const heal = { effect: "heal", target: "front_row", power: 8, duration: 2 };
  assert.match(context.describe(heal), /your Front Row fighters/u);
  assert.match(context.describe({ effect: "damage", target: "front_row", power: 100 }), /every enemy fighter/u);
  const healer = unit("healer", {
    stats: strong,
    formationKit: kit({ ultimate: ability({ ...heal, cost: 2, elementCost: 1 }) }),
  });
  const prompt = forgeFormationBattle({
    allies: [healer, unit("mate", { stats: strong })],
    enemies: [unit("foe")],
  }).next().value;
  assert.deepEqual(
    prompt.options.formation.fighters[0].targets.ultimate.ids,
    ["healer", "mate"],
    "it reaches the user's own row",
  );
});

const serverAdapter = async () => {
  const source = await readFile(
    new URL("../packages/gacha-forge/src/formation-combat-server.mjs", import.meta.url),
    "utf8",
  );
  const context = vm.createContext({ ...shared });
  vm.runInContext(
    source.replace(/^export /gmu, "") +
      ";globalThis.adapter={seated:forgeFormationSeatedRules,kit:forgeFormationKitMessages};",
    context,
  );
  return context.adapter;
};

test("a front kit counts a passive only when it can strike without attacking first", async () => {
  const tank = (passive) =>
    normalizeForgeFormationKit(
      kit({
        standard: ability({ name: "Hold the line", effect: "taunt", target: "self", duration: 2 }),
        ultimate: ability({ name: "Brace", effect: "buff", stat: "def", target: "self", cost: 2, elementCost: 1 }),
        passive: {
          ...kit().passive,
          effect: "damage",
          target: "enemy",
          power: 60,
          trigger: "on_hit",
          row: "front",
          ...passive,
        },
      }),
    );
  assert.equal(tank({}).standard.effect, "taunt", "an on_hit strike lets the tank keep its taunt");
  for (const [passive, why] of [
    [{ trigger: "on_attack" }, "on_attack needs an attack it never makes"],
    [{ trigger: "on_kill" }, "on_kill needs a kill it never makes"],
    [{ power: 0 }, "a passive with no power never fires"],
    [{ row: "back" }, "a Back Row passive never fires in front"],
  ]) {
    const read = tank(passive);
    assert.equal(read.standard.effect, "damage", why);
    assert.equal(read.standard.description, "");
  }
  // A kit-less, classic-derived enemy with a heal and an on_attack drain strikes too.
  const enemy = forgeFormationEnemyKit({
    position: "front",
    skill: { name: "Mend", effect: "heal", target: "ally", power: 50 },
    passive: { name: "Leech", effect: "drain", target: "enemy", power: 40, trigger: "on_attack" },
  });
  assert.equal(enemy.standard.effect, "damage");
  const adapter = await serverAdapter();
  const prompt = adapter.kit({ run: { scenario: "" }, unit: unit("hero") })[0].content;
  assert.match(prompt, /on a trigger other than on_attack or on_kill, in row "front" or "both"/u);
});

test("an immune Ultimate lands on the ally the player picked, and holds unpaid when an earlier cast warded it", () => {
  const aegis = kit({
    ultimate: ability({ name: "Aegis", effect: "immune", target: "ally", cost: 2, elementCost: 1, duration: 1 }),
  });
  const light = (id, overrides) => unit(id, { affinity: "Light", formationKit: aegis, ...overrides });
  const foe = unit("foe", { stats: { hp: 5000, atk: 1, def: 100, spd: 1, crit: 0 } });
  // A lone fighter wards itself, then its supports: they stay pickable and the cast lands on the one picked.
  const battle = forgeFormationBattle({
    allies: [light("A", { stats: strong }), light("S1", { position: "back" }), light("S2", { position: "back" })],
    enemies: [foe],
    seed: 3,
  });
  let next = battle.next(),
    self = false,
    picked = -1;
  for (let turn = 0; turn < 16 && !next.done && picked < 0; turn++) {
    const formation = next.value.options.formation,
      me = formation.fighters.find((fighter) => fighter.id === "A");
    let entries = [];
    if (me && forgeFormationPayment(formation.bank, me.ultimate, me.aff)) {
      const reach = me.targets.ultimate.ids;
      if (!self && reach.includes("A")) {
        entries = [{ actorId: "A", action: "ultimate", targetId: "A" }];
        self = true;
      } else if (self && !reach.includes("A") && reach.includes("S1")) {
        entries = [{ actorId: "A", action: "ultimate", targetId: "S1" }];
        picked = next.value.steps.length;
      }
    }
    next = battle.next(plan(...entries));
  }
  assert.ok(picked >= 0, "the warded fighter offers its supports");
  const after = next.value.steps.slice(picked).flatMap((step) => step.events);
  assert.ok(after.some((event) => event.op === "buff" && event.id === "S1" && event.text === "IMMUNE"));
  assert.ok(!after.some((event) => event.op === "formation-held" && event.id === "A"), "the cast is not refused");
  // Two casts on the same ally in one plan: the second holds before it pays.
  const both = (second) => {
    const fight = forgeFormationBattle({
      allies: [
        light("C"),
        light("A2"),
        light("B", { stats: strong }),
        light("S1", { position: "back" }),
        light("S2", { position: "back" }),
        light("S3", { position: "back" }),
      ],
      enemies: [foe],
      seed: 3,
    });
    let step = fight.next();
    for (let turn = 0; turn < 4 && !step.done; turn++)
      step = fight.next(turn === 2 ? plan({ actorId: "C", action: "ultimate", targetId: "B" }, second) : plan());
    return step.value;
  };
  const twice = both({ actorId: "A2", action: "ultimate", targetId: "B" });
  const once = both({ actorId: "A2", action: "hold" });
  const evs = twice.steps.flatMap((step) => step.events);
  assert.ok(evs.some((event) => event.op === "buff" && event.id === "B" && event.text === "IMMUNE"));
  assert.ok(evs.some((event) => event.op === "formation-held" && event.id === "A2" && event.reason === "target"));
  assert.ok(!evs.some((event) => event.op === "ult" && event.id === "A2"));
  assert.deepEqual(twice.options.formation.bank, once.options.formation.bank, "the held cast spent nothing");
});

test("a summon after a retreat earlier in the plan fills the seat the retreat frees", async () => {
  const { forgeFormationSeatsFreed } = await import("../packages/gacha-forge/src/formation-combat-client.mjs");
  const caller = unit("c", {
    formationKit: kit({
      ultimate: ability({ name: "Call", effect: "summon", target: "self", power: 60, cost: 2, elementCost: 1 }),
    }),
  });
  const battle = forgeFormationBattle({
    allies: [caller, unit("f2"), unit("f3"), unit("s1", { position: "back" }), unit("s2", { position: "back" })],
    enemies: [unit("foe", { stats: { hp: 5000, atk: 1, def: 100, spd: 1, crit: 0 } })],
    seed: 7,
  });
  let next = battle.next(),
    at = -1,
    formation = null;
  for (let turn = 0; turn < 16 && !next.done && at < 0; turn++) {
    formation = next.value.options.formation;
    const me = formation.fighters.find((fighter) => fighter.id === "c");
    if (me && forgeFormationPayment(formation.bank, me.ultimate, me.aff)) {
      assert.deepEqual(me.targets.ultimate.ids, [], "a full Front Row leaves no seat at turn start");
      at = next.value.steps.length;
      const entries = [
        { actorId: "f2", action: "row", moveId: "f2" },
        { actorId: "c", action: "ultimate" },
      ];
      assert.equal(forgeFormationSeatsFreed(formation, entries, "c"), 1, "the retreat frees a seat before the summon");
      assert.equal(forgeFormationSeatsFreed(formation, entries.toReversed(), "c"), 0, "a summon before it frees none");
      next = battle.next(plan(...entries));
    } else next = battle.next(plan());
  }
  assert.ok(at >= 0);
  const after = next.value.steps.slice(at).flatMap((step) => step.events);
  assert.ok(
    after.some((event) => event.op === "summon" && event.from === "c"),
    "the engine seats the Echo",
  );
  assert.equal(
    forgeFormationSeatsFreed(
      formation,
      [
        { actorId: "c", action: "row", moveId: "s1" },
        { actorId: "f2", action: "ultimate" },
      ],
      "f2",
    ),
    -1,
    "bringing a support forward fills a seat",
  );
});

test("a trimmed defeat order says what the engine enforces, naming the enemies it kept", async () => {
  const adapter = await serverAdapter();
  const names = ["Left sentinel", "Right sentinel", "Gate warden", "Captain"];
  const enemies = names.map((name, index) => ({ name, tier: index === 3 ? "boss" : "soldier" }));
  const [rule] = adapter.seated(enemies, [
    {
      kind: "defeat_order",
      order: [0, 1, 2],
      description:
        "Fell the left sentinel, then the right, then the gate warden; only then can the captain be reached.",
    },
  ]);
  assert.deepEqual(rule.order, [0, 1]);
  assert.equal(rule.description, "Defeat Left sentinel, then Right sentinel.");
  const kept = { kind: "defeat_order", order: [0, 3], description: "Fell the sentinel first." };
  assert.deepEqual(adapter.seated(enemies, [kept])[0], kept, "an order that keeps the boss is left as written");
});

test("unplanned immunity never wards a Back Row support: it holds unpaid, while a planned Front Row ally still gets it", () => {
  const aegis = kit({
    ultimate: ability({ name: "Aegis", effect: "immune", target: "ally", cost: 2, elementCost: 1, duration: 1 }),
  });
  const light = (id, overrides) => unit(id, { affinity: "Light", formationKit: aegis, ...overrides });
  // The enemy AI wards its lone fighter, then holds rather than paying to ward its supports.
  const fight = replayForgeFormationBattle({
    allies: [unit("hero", { stats: { hp: 3000, atk: 60, def: 100, spd: 50, crit: 0 } })],
    enemies: [
      light("boss", { stats: { hp: 900, atk: 10, def: 80, spd: 50, crit: 0 } }),
      light("b0", { position: "back" }),
      light("b1", { position: "back" }),
    ],
    seed: 5,
  });
  const all = events(fight);
  assert.ok(all.some((event) => event.op === "buff" && event.id === "boss" && event.text === "IMMUNE"));
  assert.ok(
    !all.some((event) => event.op === "buff" && /^b\d$/u.test(event.id) && event.text === "IMMUNE"),
    "no ward is paid for on a support nobody can attack",
  );
  // A player's warded lone fighter: an Ultimate planned without a target holds and spends nothing.
  const run = (second) => {
    const battle = forgeFormationBattle({
      allies: [
        light("A", { stats: strong }),
        light("B", { stats: strong }),
        light("S1", { position: "back" }),
        light("S2", { position: "back" }),
      ],
      enemies: [unit("foe", { stats: { hp: 5000, atk: 1, def: 100, spd: 1, crit: 0 } })],
      seed: 3,
    });
    let next = battle.next(),
      warded = false,
      at = -1;
    for (let turn = 0; turn < 16 && !next.done && at < 0; turn++) {
      const formation = next.value.options.formation,
        a = formation.fighters.find((fighter) => fighter.id === "A"),
        b = formation.fighters.find((fighter) => fighter.id === "B");
      let entries = [];
      const first = a && forgeFormationPayment(formation.bank, a.ultimate, a.aff);
      const rest =
        first &&
        Object.fromEntries(Object.entries(formation.bank).map(([key, value]) => [key, value - (first[key] || 0)]));
      if (b && first && forgeFormationPayment(rest, b.ultimate, b.aff) && !warded) {
        // Ward both Front Row fighters this turn.
        entries = [
          { actorId: "A", action: "ultimate", targetId: "A" },
          { actorId: "B", action: "ultimate", targetId: "B" },
        ];
        warded = true;
      } else if (warded && a && !a.targets.ultimate.ids.includes("A") && !a.targets.ultimate.ids.includes("B")) {
        entries = [second];
        at = next.value.steps.length;
      }
      next = battle.next(plan(...entries));
    }
    assert.ok(at >= 0, "both fighters were warded");
    return { value: next.value, after: next.value.steps.slice(at).flatMap((step) => step.events) };
  };
  const unplanned = run({ actorId: "A", action: "ultimate" });
  const held = run({ actorId: "A", action: "hold" });
  assert.ok(
    unplanned.after.some((event) => event.op === "formation-held" && event.id === "A" && event.reason === "target"),
  );
  assert.ok(!unplanned.after.some((event) => event.op === "buff" && event.text === "IMMUNE"));
  assert.deepEqual(unplanned.value.options.formation.bank, held.value.options.formation.bank, "nothing was paid");
  // Two fighters, one warded: the other, planned explicitly, still gets the ward.
  const battle = forgeFormationBattle({
    allies: [light("A", { stats: strong }), light("B", { stats: strong }), light("S1", { position: "back" })],
    enemies: [unit("foe", { stats: { hp: 5000, atk: 1, def: 100, spd: 1, crit: 0 } })],
    seed: 3,
  });
  let next = battle.next(),
    self = false,
    at = -1;
  for (let turn = 0; turn < 16 && !next.done && at < 0; turn++) {
    const formation = next.value.options.formation,
      a = formation.fighters.find((fighter) => fighter.id === "A");
    let entries = [];
    if (a && forgeFormationPayment(formation.bank, a.ultimate, a.aff)) {
      if (!self) {
        entries = [{ actorId: "A", action: "ultimate", targetId: "A" }];
        self = true;
      } else if (!a.targets.ultimate.ids.includes("A") && a.targets.ultimate.ids.includes("B")) {
        entries = [{ actorId: "A", action: "ultimate", targetId: "B" }];
        at = next.value.steps.length;
      }
    }
    next = battle.next(plan(...entries));
  }
  assert.ok(at >= 0);
  assert.ok(
    next.value.steps
      .slice(at)
      .flatMap((step) => step.events)
      .some((event) => event.op === "buff" && event.id === "B" && event.text === "IMMUNE"),
  );
});

// Rules 3 (1.24.5): a support steps into each Front Row seat a fallen fighter leaves, and a side loses only when
// nobody is left.
const deathStep = (battle, id) =>
  battle.steps.find((step) => step.events.some((event) => event.op === "death" && event.id === id));
const rowsOf = (step) => step.events.filter((event) => event.op === "row").map((event) => event.id);
const back = (id, overrides = {}) => unit(id, { position: "back", ...overrides });
const support = (id, standard, overrides = {}) =>
  back(id, {
    formationKit: kit({
      preferredRow: "back",
      standard: ability({ effect: standard, target: standard === "heal" ? "allies" : "enemy", cost: 0 }),
      ultimate: ability({ effect: "shield", target: "allies", cost: 5, elementCost: 2 }),
    }),
    ...overrides,
  });

test("a support steps into a fallen fighter's seat in the same step, on either side, and acts next turn", () => {
  const hero = unit("hero", { stats: strong });
  const won = drive(
    {
      allies: [hero],
      enemies: [unit("f1", { stats: weak }), back("b1", { stats: weak }), back("b2", { stats: weak })],
    },
    (prompt) => plan({ actorId: "hero", action: "normal", targetId: prompt.options.formation.foes[0].id }),
  );
  assert.deepEqual(rowsOf(deathStep(won, "f1")), ["b1"], "exactly one support steps up, in the death's own step");
  assert.deepEqual(rowsOf(deathStep(won, "b1")), ["b2"]);
  assert.ok(
    events(won).some((event) => event.op === "act" && event.id === "b1"),
    "it acts on its side's next turn",
  );
  assert.deepEqual(
    events(won)
      .filter((event) => event.op === "death")
      .map((event) => event.id),
    ["f1", "b1", "b2"],
  );
  assert.equal(won.result, "win", "the fight ends only when nobody is left");
  // An ally killed on the enemy's turn is replaced by a support that acts on the very next ally turn.
  const lost = drive(
    {
      allies: [unit("lead", { stats: weak }), back("s1"), back("s2", { stats: weak })],
      enemies: [unit("foe", { stats: { ...strong, atk: 2000 } })],
    },
    () => hold(),
  );
  const step = deathStep(lost, "lead");
  assert.deepEqual(rowsOf(step), ["s1"]);
  assert.ok(
    step.events.findIndex((event) => event.op === "death") < step.events.findIndex((event) => event.op === "row"),
  );
  assert.deepEqual(
    lost.prompts[1].options.formation.fighters.map((fighter) => fighter.id),
    ["s1"],
  );
  assert.equal(lost.result, "lose");
  assert.ok(
    ["lead", "s1", "s2"].every((id) => deathStep(lost, id)),
    "the player loses only with nobody left",
  );
});

test("a support stepping up on its own turn start waits a turn, and an AoE frees one seat per death", () => {
  const burn = drive(
    {
      allies: [unit("lead", { stats: weak }), unit("tank", { stats: { ...strong, hp: 9000 } }), back("s1")],
      enemies: [
        unit("foe", { stats: { ...strong, atk: 2000 }, formationKit: kit({ standard: ability({ effect: "dot" }) }) }),
      ],
    },
    () => hold(),
  );
  const step = deathStep(burn, "lead");
  assert.ok(
    step.events.some((event) => event.op === "formation-bank") && !step.events.some((event) => event.op === "act"),
    "the burn kills at the ally turn start",
  );
  assert.deepEqual(rowsOf(step), ["s1"]);
  const after = burn.prompts.find((prompt) => prompt.at > burn.steps.indexOf(step));
  assert.deepEqual(
    after.options.formation.fighters.map((fighter) => fighter.id),
    ["tank"],
  );
  assert.deepEqual(after.options.formation.waiting, [{ id: "s1", reason: "arrived" }]);
  const next = burn.prompts[burn.prompts.indexOf(after) + 1];
  assert.ok(
    next.options.formation.fighters.some((fighter) => fighter.id === "s1"),
    "it acts the turn after",
  );
  const blast = drive(
    {
      allies: [unit("x", { stats: weak }), unit("y", { stats: weak }), back("s1"), back("s2"), back("s3")],
      enemies: [
        unit("foe", {
          stats: { ...strong, atk: 2000 },
          formationKit: kit({ standard: ability({ effect: "aoe_damage", target: "all_enemies" }) }),
        }),
      ],
    },
    () => hold(),
  );
  const both = deathStep(blast, "x");
  assert.equal(both, deathStep(blast, "y"));
  assert.deepEqual(rowsOf(both), ["s1", "s2"], "two deaths, two seats, s3 stays back");
});

test("death triggers resolve before the step-up: a back passive fires, a revive refills, an Echo makes way", () => {
  const foe = unit("foe", { stats: { ...strong, atk: 2000 } });
  const passive = (effect, target) => ({
    name: effect,
    description: "",
    effect,
    target,
    power: 50,
    duration: 2,
    trigger: "ally_death",
    row: "back",
  });
  const guard = drive(
    {
      allies: [
        unit("lead", { stats: weak }),
        support("s1", "damage", { formationKit: kit({ preferredRow: "back", passive: passive("shield", "self") }) }),
      ],
      enemies: [foe],
    },
    () => hold(),
  );
  const fired = deathStep(guard, "lead").events;
  assert.ok(
    fired.findIndex((event) => event.op === "passive" && event.id === "s1") <
      fired.findIndex((event) => event.op === "row" && event.id === "s1"),
    "the Back Row passive fires while s1 is still behind",
  );
  const raised = drive(
    {
      allies: [
        unit("lead", { stats: weak }),
        back("s1", { formationKit: kit({ preferredRow: "back", passive: passive("revive", "ally") }) }),
      ],
      enemies: [foe],
    },
    () => hold(),
  );
  const refilled = deathStep(raised, "lead").events;
  assert.ok(refilled.some((event) => event.op === "revive" && event.id === "lead"));
  assert.deepEqual(rowsOf({ events: refilled }), [], "the revived fighter keeps its seat and nobody steps up");
  const echoed = drive(
    {
      allies: [
        unit("lead", { stats: weak }),
        unit("mate", { stats: { ...strong, hp: 9000 } }),
        unit("third", { stats: { ...strong, hp: 9000 } }),
        back("s1", { formationKit: kit({ preferredRow: "back", passive: passive("summon", "self") }) }),
      ],
      enemies: [foe],
    },
    () => hold(),
  );
  const made = deathStep(echoed, "lead").events.map((event) => `${event.op}:${event.id}`);
  const echo = made.find((entry) => entry.startsWith("summon:s1~"));
  assert.ok(echo, "the passive summons into the free seat");
  assert.ok(
    made.indexOf(echo) < made.indexOf(`death:${echo.slice(7)}`) &&
      made.indexOf(`death:${echo.slice(7)}`) < made.indexOf("row:s1"),
    "the Echo is dismissed so the support can take the seat",
  );
});

test("the step-up prefers the next in a defeat order, then a support that can strike, then seat order", () => {
  const hero = unit("hero", { stats: strong });
  const pinned = drive(
    {
      allies: [hero],
      enemies: [
        unit("f", { stats: weak }),
        unit("x", { stats: strong }),
        unit("y", { stats: strong }),
        back("keen"),
        back("p", { stats: weak }),
      ],
      rules: [{ kind: "defeat_order", description: "f, then p", order: [0, 4] }],
    },
    () => plan({ actorId: "hero", action: "normal", targetId: "f" }),
  );
  assert.deepEqual(rowsOf(deathStep(pinned, "f")), ["p"]);
  const striking = drive(
    {
      allies: [unit("lead", { stats: weak }), support("healer", "heal"), support("striker", "damage")],
      enemies: [unit("foe", { stats: { ...strong, atk: 2000 } })],
    },
    () => hold(),
  );
  assert.deepEqual(rowsOf(deathStep(striking, "lead")), ["striker"]);
  assert.deepEqual(rowsOf(deathStep(striking, "striker")), ["healer"], "then whoever is left");
});

test("only stamped snapshots step up: an unstamped fight replays under the old rule, and client and server agree", async () => {
  const snapshot = {
    allies: [unit("hero", { stats: strong }), back("ally-s")],
    enemies: [unit("f1", { stats: weak }), back("b1", { stats: weak })],
    seed: 9,
    formationEngine: FORGE_FORMATION_ENGINE,
  };
  const old = replayForgeFormationBattle(snapshot);
  assert.equal(old.result, "win");
  assert.ok(!events(old).some((event) => event.op === "row"), "a fight saved before 1.24.5 ends when its front falls");
  const current = replayForgeFormationBattle({ ...snapshot, formationRevision: FORGE_FORMATION_RULES });
  assert.deepEqual(rowsOf(deathStep(current, "f1")), ["b1"]);
  assert.ok(deathStep(current, "b1"));
  // The client runs the loaded rules on the snapshot it holds, which carries no stamp; the server replays the
  // saved, stamped snapshot. Both agree for the same log, and an unstamped claim matches a revision-2 run.
  for (const [client, saved] of [
    [
      { ...snapshot, formationEngine: undefined },
      { ...snapshot, formationRevision: FORGE_FORMATION_RULES },
    ],
    [{ ...snapshot, formationRevision: 2 }, snapshot],
  ]) {
    const played = drive(client, (prompt) =>
      plan({ actorId: "hero", action: "normal", targetId: prompt.options.formation.foes[0].id }),
    );
    const replayed = replayForgeFormationBattle(saved, played.log);
    assert.equal(replayed.result, played.result);
    assert.deepEqual(replayed.steps, played.steps);
    assert.deepEqual(replayed.log, played.log);
  }
  // The shipped client starts its battle from the preview's units and seed with no stamp, so it plays the rules
  // revision it was loaded with, which the server's start guard has just matched and stamped into the snapshot.
  const client = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
  assert.ok(client.includes("forgeFormationBattle({allies:t,enemies:e,seed:a,rules:formationRules||[]})"));
  assert.ok(client.includes("formationRevision = FORGE_FORMATION_RULES"));
});

const trace = (step) =>
  step.events
    .filter((event) => ["act", "row", "passive", "hit", "death"].includes(event.op))
    .map((event) => `${event.op}:${event.id}${event.op === "row" ? `->${event.position}` : ""}`)
    .join(" ");

test("a shuffle keeps a support's step-up seat when an enter trigger kills mid-shuffle, and never seats the dead", () => {
  const stats = (overrides = {}) => ({ hp: 100, atk: 10, def: 50, spd: 50, crit: 0, ...overrides });
  const buffs = (overrides = {}) =>
    kit({
      preferredRow: "back",
      standard: ability({ effect: "buff", target: "self", stat: "atk", power: 20 }),
      ultimate: ability({ effect: "buff", target: "self", stat: "atk", power: 30, cost: 4, elementCost: 2 }),
      ...overrides,
    });
  const strike = (trigger, row) => ({ ...kit().passive, effect: "damage", target: "enemy", power: 160, trigger, row });
  const snapshot = {
    seed: 251,
    rules: [{ kind: "defeat_order", description: "W, then E, then K", order: [2, 0, 1] }],
    allies: [
      unit("a0", { stats: stats({ atk: 1000 }), formationKit: buffs({ passive: strike("enter_back", "back") }) }),
      back("a1", { stats: stats(), formationKit: kit({ preferredRow: "back" }) }),
      back("a2", { stats: stats({ hp: 1 }) }),
    ],
    enemies: [
      unit("E", {
        stats: stats(),
        formationKit: buffs({
          standard: ability({ effect: "shuffle", target: "all_enemies", cost: 2 }),
          ultimate: ability({ effect: "heal", target: "allies", power: 30, cost: 4, elementCost: 2 }),
        }),
      }),
      unit("K", { stats: stats({ atk: 3000 }), formationKit: buffs({ passive: strike("ally_death", "front") }) }),
      unit("W", { stats: stats({ hp: 1 }), formationKit: buffs() }),
      back("B", { stats: stats(), formationKit: buffs() }),
      back("B2", { stats: stats(), formationKit: buffs() }),
    ],
  };
  const shuffled = (battle) =>
    battle.steps.find((step) => step.events.some((event) => event.id === "E" && event.op === "act"));
  const now = drive({ ...snapshot, formationRevision: FORGE_FORMATION_RULES });
  assert.equal(
    trace(shuffled(now)),
    "act:E row:a2->front row:a0->back passive:a0 hit:W death:W passive:K hit:a2 death:a2 row:a1->front row:B->front",
    "a1 steps up for a2 and keeps the seat; a2 stays dead",
  );
  assert.ok(now.steps.indexOf(shuffled(now)) < now.steps.length - 2, "the fight goes on after the shuffle");
  // Revision 2 keeps the 1.24.4 shuffle, which seated the fallen a2 and lost on the spot.
  const old = drive({ ...snapshot, formationRevision: 2 });
  assert.equal(
    trace(shuffled(old)),
    "act:E row:a2->front row:a0->back passive:a0 hit:W death:W passive:K hit:a2 death:a2 row:a2->front",
  );
  assert.equal(old.steps.indexOf(shuffled(old)), old.steps.length - 2);
  assert.equal(old.result, "lose");
});

test("an ally heir whose element cannot pass the enemy barrier steps up after one that can", () => {
  const barred = drive(
    {
      allies: [
        unit("lead", { stats: weak }),
        support("blocked", "damage", { affinity: "Water" }),
        support("crosser", "damage", { affinity: "Fire" }),
      ],
      enemies: [unit("foe", { stats: { ...strong, atk: 2000 } })],
      rules: [{ kind: "element_barrier", description: "only fire passes", elements: ["fire"] }],
    },
    () => hold(),
  );
  assert.deepEqual(rowsOf(deathStep(barred, "lead")), ["crosser"]);
  assert.deepEqual(rowsOf(deathStep(barred, "crosser")), ["blocked"], "then whoever is left");
});

// Seats as the client draws them, rebuilt from the events alone after every step: cards move only on row events. A
// revive with no row event of its own seats the unit in front, so it must already be drawn there.
const crowded = (snapshot, battle) => {
  const seats = new Map(
    [...snapshot.allies.map((ally) => [ally, "ally"]), ...snapshot.enemies.map((enemy) => [enemy, "enemy"])].map(
      ([entry, side]) => [entry.id, { side, row: entry.position === "back" ? "back" : "front", alive: true }],
    ),
  );
  // The engine seats the enemies of a defeat order in front at the start, as the server already places them.
  for (const index of snapshot.rules?.find((rule) => rule.kind === "defeat_order")?.order || []) {
    const seat = seats.get(snapshot.enemies[index]?.id);
    const front = [...seats.values()].filter((entry) => entry.side === "enemy" && entry.row === "front").length;
    if (seat?.row === "back" && front < 3) seat.row = "front";
  }
  for (const [index, step] of battle.steps.entries()) {
    for (const [at, event] of step.events.entries()) {
      if (event.op === "summon") seats.set(event.id, { side: seats.get(event.from).side, row: "front", alive: true });
      const seat = seats.get(event.id);
      if (!seat) continue;
      if (event.op === "row") seat.row = event.position;
      if (event.op === "death") seat.alive = false;
      if (event.op !== "revive") continue;
      seat.alive = true;
      const shown = step.events.slice(at + 1, at + 3).some((next) => next.op === "row" && next.id === event.id);
      if (!shown && seat.row !== "front") return `step ${index}: ${event.id} is revived in front but drawn in back`;
    }
    for (const side of ["ally", "enemy"])
      for (const row of ["front", "back"]) {
        const ids = [...seats].filter(([, seat]) => seat.alive && seat.side === side && seat.row === row);
        if (ids.length > 3) return `step ${index}: ${side} ${row} ${ids.map(([id]) => id).join(",")}`;
      }
  }
  return null;
};

test("rules 4: a two-unit move seats both units before either enter trigger, so no row ever holds four", () => {
  const enterBack = (effect, overrides = {}) => ({
    ...kit().passive,
    name: effect,
    effect,
    power: 40,
    trigger: "enter_back",
    row: "back",
    ...overrides,
  });
  const actsOf = (battle, id) => battle.steps.find((step) => step.events.some((e) => e.op === "act" && e.id === id));
  const passiveOf = (battle, id) =>
    battle.steps.find((step) => step.events.some((e) => e.op === "passive" && e.id === id));
  const rules = (snapshot, choose) =>
    [3, FORGE_FORMATION_RULES].map((rev) => {
      const battle = drive({ ...snapshot, formationRevision: rev }, choose);
      return { battle, crowded: crowded(snapshot, battle) };
    });

  // #1745: the mover's enter_back revive filled the seat it had just left, and the swapped-in partner sat a fourth.
  const revive = {
    seed: 3,
    allies: [
      unit("d", { stats: weak }),
      unit("m", { stats: strong, formationKit: kit({ passive: enterBack("revive", { target: "ally" }) }) }),
      unit("f1", { stats: strong }),
      support("s", "damage", { stats: strong }),
      support("p", "heal", { stats: strong }),
    ],
    enemies: [unit("E", { stats: { ...strong, atk: 300 } })],
  };
  const swapIn = (prompt, count) =>
    count === 2 ? plan({ actorId: "m", action: "row", moveId: "m", swapId: "p" }) : hold();
  const [oldRevive, newRevive] = rules(revive, swapIn);
  assert.equal(trace(actsOf(oldRevive.battle, "m")), "act:m row:m->back passive:m row:p->front");
  assert.match(oldRevive.crowded, /ally front d,f1,s,p$/, "revision 3 replays keep the four-fighter row");
  assert.equal(trace(actsOf(newRevive.battle, "m")), "act:m row:m->back row:p->front passive:m row:d->back");
  assert.equal(newRevive.crowded, null, "the fallen fighter is revived into the Back Row instead");

  // A Swap effect is a two-unit move too: the fighter it pushes back no longer leaves an Echo beside the pulled target.
  const echo = {
    seed: 5,
    allies: [
      unit("a", { stats: strong, formationKit: kit({ passive: enterBack("summon", { target: "self" }) }) }),
      unit("b", { stats: strong }),
      unit("c", { stats: strong }),
      back("t", { stats: strong }),
    ],
    enemies: [
      unit("E", {
        stats: strong,
        formationKit: kit({
          passive: { ...kit().passive, name: "Pull", effect: "swap", target: "enemy", row: "front" },
        }),
      }),
    ],
  };
  const [oldEcho, newEcho] = rules(echo, () => hold());
  assert.match(oldEcho.crowded, /ally front b,c,t,a~1$/);
  assert.ok(!passiveOf(newEcho.battle, "E").events.some((event) => event.op === "summon"), "no free seat, no Echo");
  assert.equal(newEcho.crowded, null);

  // A Shuffle set off mid-move used to keep the mover's transient two-front, four-back split.
  const scatter = {
    seed: 1,
    allies: [
      unit("m", {
        stats: { ...strong, atk: 500 },
        formationKit: kit({ passive: enterBack("damage", { target: "enemy", power: 100 }) }),
      }),
      unit("f1", { stats: strong }),
      unit("f2", { stats: strong }),
      back("p", { stats: strong }),
      back("s1", { stats: strong }),
      back("s2", { stats: strong }),
    ],
    enemies: [
      unit("e1", {
        stats: weak,
        formationKit: kit({
          passive: { ...kit().passive, name: "Scatter", effect: "shuffle", trigger: "on_death", row: "front" },
        }),
      }),
      unit("e2", { stats: strong }),
    ],
  };
  const [oldScatter, newScatter] = rules(scatter, (prompt, count) =>
    count === 1 ? plan({ actorId: "m", action: "row", moveId: "m", swapId: "p" }) : hold(),
  );
  assert.match(oldScatter.crowded, /ally back m,f2,s1,s2$/);
  assert.equal(newScatter.crowded, null);
});

test("rules 4: a Shuffle shows every move before its enter triggers, so a unit killed and revived is drawn where it sits", () => {
  // The enemy's Shuffle seats x in front; y's enter_front blast kills K, whose dying blast kills x before revision 3
  // showed x moving. Revived in front, x was still drawn in the Back Row.
  // Ultimates no one can afford yet, so every unit casts its standard skill.
  const slow = (overrides = {}) => kit({ ultimate: ability({ cost: 8, elementCost: 2, power: 220 }), ...overrides });
  const mend = (overrides = {}) =>
    slow({ standard: ability({ name: "Mend", effect: "revive", target: "ally", power: 50, cost: 2 }), ...overrides });
  const blast = (name, trigger, row) => ({
    ...kit().passive,
    name,
    effect: "aoe_damage",
    target: "all_enemies",
    power: trigger === "on_death" ? 150 : 100,
    trigger,
    row,
  });
  const snapshot = {
    seed: 2,
    allies: [
      unit("f1", { stats: strong, formationKit: mend() }),
      unit("f2", { stats: strong, formationKit: mend() }),
      back("y", {
        stats: { ...strong, atk: 900 },
        formationKit: mend({ preferredRow: "hybrid", passive: blast("Arrive", "enter_front", "front") }),
      }),
      back("x", { stats: { ...weak, spd: 1 }, formationKit: mend() }),
    ],
    enemies: [
      unit("S", {
        stats: { ...strong, hp: 9000, atk: 1 },
        formationKit: slow({
          standard: ability({ name: "Scatter", effect: "shuffle", target: "all_enemies", cost: 2 }),
        }),
      }),
      unit("K", {
        stats: { ...weak, atk: 2000 },
        formationKit: slow({ passive: blast("Last Gasp", "on_death", "both") }),
      }),
      back("eb", { stats: strong, formationKit: slow() }),
      back("eb2", { stats: strong, formationKit: slow() }),
    ],
  };
  // Whoever can, revives x.
  const choose = (prompt) => {
    const { fighters, fallen } = prompt.options.formation;
    return fallen.includes("x") && fighters.length
      ? plan({ actorId: fighters[0].id, action: "normal", targetId: "x" })
      : hold();
  };
  const old = drive({ ...snapshot, formationRevision: 3 }, choose);
  assert.match(crowded(snapshot, old), /x is revived in front but drawn in back$/u);
  const now = drive({ ...snapshot, formationRevision: FORGE_FORMATION_RULES }, choose);
  assert.ok(
    events(now).some((event) => event.op === "revive" && event.id === "x"),
    "x is still killed and revived",
  );
  assert.equal(crowded(snapshot, now), null);
});

test("rules 4: a unit that fell in the Back Row and is revived in front is shown moving there", () => {
  // f retreats with a burn and dies of it in the Back Row; b then fills that row, so a's revive seats f in front.
  const snapshot = {
    seed: 4,
    allies: [
      unit("f", { stats: { ...strong, hp: 10 } }),
      unit("a", {
        stats: strong,
        formationKit: kit({
          standard: ability({ name: "Mend", effect: "revive", target: "ally", power: 50, cost: 2 }),
        }),
      }),
      unit("b", { stats: strong }),
      back("s1", { stats: strong }),
      back("s2", { stats: strong }),
    ],
    enemies: [
      unit("E", {
        stats: { ...strong, atk: 120 },
        formationKit: kit({
          standard: ability({ name: "Burn", effect: "dot", target: "enemy", power: 100, duration: 3 }),
        }),
      }),
    ],
  };
  const choose = (prompt) => {
    const { fallen } = prompt.options.formation;
    if (fallen.includes("f"))
      return plan({ actorId: "b", action: "row", moveId: "b" }, { actorId: "a", action: "normal", targetId: "f" });
    const burned = prompt.steps.some((step) =>
      step.events.some((event) => event.op === "debuff" && event.id === "f" && event.text === "DOT"),
    );
    return burned ? plan({ actorId: "f", action: "row", moveId: "f" }) : hold();
  };
  const revived = (battle) =>
    battle.steps
      .find((step) => step.events.some((event) => event.op === "revive" && event.id === "f"))
      ?.events.filter((event) => ["act", "revive", "row"].includes(event.op))
      .map((event) => `${event.op}:${event.id}${event.op === "row" ? `->${event.position}` : ""}`)
      .join(" ");
  const old = drive({ ...snapshot, formationRevision: 3 }, choose);
  assert.equal(revived(old), "act:a revive:f");
  assert.match(crowded(snapshot, old), /f is revived in front but drawn in back$/u);
  const now = drive({ ...snapshot, formationRevision: FORGE_FORMATION_RULES }, choose);
  assert.equal(revived(now), "act:a revive:f row:f->front");
  assert.equal(crowded(snapshot, now), null);
});

test("fuzz: from rules 3 no side is beaten before the round cap while it has a non-token unit standing, and from rules 4 no row holds four", () => {
  const roster = (seed) => {
    let state = seed >>> 0 || 1;
    const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
    const pick = (list) => list[Math.floor(random() * list.length)];
    const skill = (effects, cost) => ({
      ...ability({ effect: pick(effects), cost, elementCost: 1, stat: "atk" }),
      target: pick(["enemy", "all_enemies", "self", "allies", "ally"]),
      power: 40 + Math.floor(random() * 200),
    });
    const member = (id, position) => ({
      ...unit(id, { position, affinity: pick(["fire", "water", "earth", "wind", "light", "dark"]) }),
      stats: { hp: 1 + random() * 60, atk: 50 + random() * 600, def: 30 + random() * 60, spd: 50, crit: 10 },
      formationKit: normalizeForgeFormationKit(
        {
          preferredRow: pick(["front", "back", "hybrid"]),
          standard: skill(["shuffle", "shuffle", "damage", "heal", "buff"], Math.floor(random() * 2)),
          ultimate: skill(
            ["shuffle", "aoe_damage", "revive", "summon", "swap", "damage"],
            2 + Math.floor(random() * 3),
          ),
          passive: {
            ...skill(["damage", "aoe_damage", "damage", "summon", "revive"], 0),
            trigger: pick(["enter_front", "enter_back", "ally_death", "on_death", "enter_back"]),
            row: pick(["front", "back", "both"]),
          },
          traits: [],
        },
        { rarity: 4 },
      ),
    });
    const side = (prefix, size) => {
      const front = Math.min(3, size, Math.max(size - 3, 1 + Math.floor(random() * 3)));
      return Array.from({ length: size }, (_, index) => member(`${prefix}${index}`, index < front ? "front" : "back"));
    };
    const allies = side("A", 2 + Math.floor(random() * 5)),
      enemies = side("E", 2 + Math.floor(random() * 5)),
      rules = [];
    if (random() < 0.4)
      rules.push({ kind: "defeat_order", description: "order", order: [Math.floor(random() * enemies.length), 0] });
    if (random() < 0.3)
      rules.push({
        kind: "element_barrier",
        description: "barrier",
        elements: [pick(["fire", "water", "earth"]), pick(["wind", "light", "dark"])],
      });
    return { allies, enemies, rules, seed, random };
  };
  // Revision 3 still replays fights started before 1.25.2, so it keeps its coverage.
  for (const formationRevision of [3, FORGE_FORMATION_RULES]) {
    let fights = 0;
    for (let seed = 1; seed <= 600; seed += 1)
      for (const planned of [false, true]) {
        const { random, ...rest } = roster(seed);
        const snapshot = { ...rest, formationRevision };
        const battle = forgeFormationBattle(snapshot);
        let next = battle.next();
        while (!next.done) {
          const formation = next.value.options.formation;
          // Auto, or a random plan that also moves rows, so swaps and retreats run into deaths mid-move.
          const entries = formation.fighters.map((fighter) => {
            const roll = random();
            const option = fighter.moves[Math.floor(random() * fighter.moves.length)];
            if (roll < 0.35 && option)
              return { actorId: fighter.id, action: "row", moveId: option.moveId, swapId: option.swapId || undefined };
            const foe = formation.foes[Math.floor(random() * formation.foes.length)];
            return {
              actorId: fighter.id,
              action: roll < 0.7 ? "normal" : roll < 0.85 ? "ultimate" : "hold",
              targetId: foe?.id,
            };
          });
          next = battle.next(planned ? plan(...entries) : { v: FORGE_FORMATION_ENGINE, action: "auto" });
        }
        const fight = next.value;
        if (formationRevision >= 4)
          assert.equal(crowded(snapshot, fight), null, `seed ${seed}${planned ? " (planned)" : ""}: a row holds four`);
        const standing = new Set([...snapshot.allies, ...snapshot.enemies].map((entry) => entry.id));
        for (const event of events(fight)) {
          if (event.op === "death") standing.delete(event.id);
          if (event.op === "revive") standing.add(event.id);
        }
        // Each side's turn opens with one 450 ms bank step; 80 of them means the fight ran into the round-40 cap.
        const turns = fight.steps.filter(
          (step) => step.d === 450 && step.events.some((event) => event.op === "formation-bank"),
        ).length;
        if (turns >= 80) continue;
        fights += 1;
        const beaten = fight.result === "win" ? "E" : "A";
        assert.ok(
          ![...standing].some((id) => id.startsWith(beaten)),
          `seed ${seed}${planned ? " (planned)" : ""}: ${fight.result} with ${[...standing].join(",")} standing`,
        );
      }
    assert.ok(fights > 1000, `most fights end before the cap (${fights})`);
  }
});
