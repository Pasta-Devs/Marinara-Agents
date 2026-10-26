import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import * as shared from "../packages/gacha-forge/src/formation-combat-shared.mjs";
import { forgeFormationLegacyReplay } from "../packages/gacha-forge/src/formation-combat-legacy.mjs";

const {
  FORGE_FORMATION_ENGINE,
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
  assert.equal(normalizeForgeFormationKit(kit({ standard: ability({ effect: "eval" }) })), null);
  assert.equal(normalizeForgeFormationKit(kit({ standard: undefined })), null);
  assert.equal(normalizeForgeFormationKit(kit({ standard: ability({ name: "" }) })), null);
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
      assert.deepEqual(
        prompt.options.formation.fighters.map((fighter) => fighter.id),
        ["summoner"],
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
  assert.ok(deaths.includes("summoner"));
  assert.equal(tokens.result, "lose", "Echoes do not keep a Front Row alive");
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

test("defeat order protects later enemies, element barriers bind every action, and a fallen Front Row loses", () => {
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

test("a log from the engine before 1.24.0 is scored by that engine when the server carries it", () => {
  const snapshot = { allies: [unit("a", { stats: strong })], enemies: [unit("e", { stats: weak })], seed: 5 };
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
