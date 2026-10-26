import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import {
  forgeFormationBattle,
  forgeFormationElements,
  forgeFormationEnemyKit,
  forgeFormationKitMessages,
  forgeFormationMode,
  forgeFormationPayment,
  forgeFormationTeamError,
  normalizeForgeFormationKit,
  normalizeForgeFormationRules,
  replayForgeFormationBattle,
} from "../packages/gacha-forge/src/formation-combat-shared.mjs";
import { forgeFormationCombatEnglish } from "../packages/gacha-forge/src/formation-combat-en.mjs";

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

test("kits reject unsupported model code, invented effects and bad costs, and keep only valid distinct traits", () => {
  assert.ok(normalizeForgeFormationKit(kit()));
  assert.equal(normalizeForgeFormationKit(kit({ standard: ability({ effect: "eval" }) })), null);
  assert.equal(normalizeForgeFormationKit(kit({ ultimate: ability({ cost: 1, elementCost: 3 }) })), null);
  // Traits are optional: duplicates collapse, unknown or extra ones drop, and a bare name counts at default power.
  assert.deepEqual(
    normalizeForgeFormationKit(kit({ traits: [{ kind: "solo_front" }, { kind: "solo_front" }] })).traits,
    [{ kind: "solo_front", power: 30 }],
  );
  assert.deepEqual(
    normalizeForgeFormationKit(
      kit({
        traits: [
          "advance_ult",
          { kind: "extra_turn" },
          { name: "x" },
          { kind: "front_tokens", power: 99 },
          "retreat_echo",
        ],
      }),
    ).traits,
    [
      { kind: "advance_ult", power: 30 },
      { kind: "front_tokens", power: 75 },
    ],
  );
  assert.deepEqual(normalizeForgeFormationKit(kit({ traits: undefined })).traits, []);
  assert.equal(normalizeForgeFormationKit(kit({ traits: "advance_ult" })), null);
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

test("legacy enemy fallback keeps zero power and defaults missing or malformed power consistently", () => {
  assert.equal(forgeFormationEnemyKit({ skill: ability() }).passive.power, 0);
  for (const [label, power, standard, ultimate] of [
    ["zero", 0, 0, 0],
    ["numeric zero", "0", 0, 0],
    ["positive", 250, 150, 250],
    ["numeric positive", "250", 150, 250],
    ["raw power before clamp", 400, 240, 300],
    ["missing", undefined, 60, 100],
    ["null", null, 60, 100],
    ["invalid text", "invalid", 60, 100],
    ["empty text", "", 60, 100],
    ["blank text", "   ", 60, 100],
    ["boolean", false, 60, 100],
    ["array", [], 60, 100],
    ["non-finite", Infinity, 60, 100],
    ["NaN", NaN, 60, 100],
    ["negative", -10, 0, 0],
  ]) {
    const skill = ability({ power }),
      passive = { ...kit().passive, power };
    if (power === undefined) {
      delete skill.power;
      delete passive.power;
    }
    const result = forgeFormationEnemyKit({ skill, passive });
    assert.equal(result.standard.power, standard, `${label} Standard`);
    assert.equal(result.ultimate.power, ultimate, `${label} Ultimate`);
    assert.equal(result.passive.power, ultimate, `${label} passive`);
  }
});

test("an enemy without a passive gains no shield that can absorb later attacks", () => {
  const hero = unit("hero", { stats: { hp: 1000, atk: 100, def: 100, spd: 100, crit: 0 } }),
    foe = unit("foe", {
      formationKit: null,
      skill: ability(),
      stats: { hp: 1000, atk: 10, def: 50, spd: 10, crit: 0 },
    });
  const expectedKit = forgeFormationEnemyKit(foe);
  expectedKit.passive.power = 0;
  const damage = (enemy) =>
    events(drive({ allies: [hero], enemies: [enemy], seed: 1 }, () => ({ action: "attack" })))
      .filter((event) => event.op === "hit" && event.id === "foe")
      .slice(0, 3)
      .map((event) => event.amount);
  assert.deepEqual(damage(foe), damage({ ...foe, formationKit: expectedKit }));
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

test("the generated defeat-order contract indexes the full formation before placing ordered enemies in Front", async () => {
  const source = await readFile(
    new URL("../packages/gacha-forge/src/formation-combat-server.mjs", import.meta.url),
    "utf8",
  );
  const adapter = vm.runInNewContext(
    source.replace(/^export /gmu, "") + ";({messages:forgeFormationEncounterMessages,enemies:forgeFormationEnemies})",
    { forgeFormationMode, normalizeForgeFormationKit, forgeFormationEnemyKit },
  );
  const prompt = adapter.messages(
    [{ role: "system", content: "Write an encounter." }],
    { combat: { mode: "formation" } },
    ["fire"],
  );
  assert.match(prompt[0].content, /ZERO-BASED indices into this encounter's full formation array/u);
  assert.match(prompt[0].content, /ordered enemies are placed in the Front Row/u);
  const foes = [
    unit("reserve", { position: "back" }),
    unit("first", { stats: { hp: 1, atk: 1, def: 1 } }),
    unit("captain", { position: "back", stats: { hp: 1, atk: 1, def: 1 } }),
  ];
  const rules = normalizeForgeFormationRules(
    [{ kind: "defeat_order", description: "Captain, then first.", order: [2, 1] }],
    foes,
  );
  const enemies = adapter.enemies(foes, rules);
  assert.deepEqual(
    Array.from(enemies, (enemy) => enemy.position),
    ["back", "front", "front"],
  );
  const result = drive(
    { allies: [unit("hero", { stats: { hp: 1000, atk: 1000, def: 1000, spd: 1000 } })], enemies, rules },
    () => ({ action: "weapon", targetId: "first" }),
  );
  assert.equal(result.result, "win");
  assert.deepEqual(
    events(result)
      .filter((event) => event.op === "death")
      .map((event) => event.id),
    ["captain", "first"],
  );
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

test("the real turn form offers only bonuses from entered payment and preserves None", async () => {
  const source = await readFile(
    new URL("../packages/gacha-forge/src/formation-combat-client.mjs", import.meta.url),
    "utf8",
  );
  const { renderTurn, presentation } = vm.runInNewContext(
    source.replace(/export /gu, "") +
      ";({renderTurn:forgeRenderFormationTurn,presentation:createForgeFormationPresentation})",
    {
      forgeFormationElements,
      forgeFormationPayment,
      forgeFormationCombatEnglish,
      document: { createElement: () => ({ remove() {} }) },
    },
  );
  const fields = new Map();
  const field = (name) => {
    if (!fields.has(name))
      fields.set(name, {
        value: "",
        options: [],
        get selectedOptions() {
          return this.options.filter((option) => option.value === this.value);
        },
        set innerHTML(markup) {
          this.options = [...markup.matchAll(/<option value="([^"]*)"([^>]*)>/gu)].map((match) => ({
            value: match[1],
            disabled: match[2].includes("disabled"),
          }));
          this.value = this.options.find((option) => !option.disabled)?.value || "";
        },
      });
    return fields.get(name);
  };
  const parts = new Map();
  const form = {
    elements: { namedItem: field },
    querySelector(selector) {
      if (!parts.has(selector)) parts.set(selector, {});
      return parts.get(selector);
    },
  };
  const hero = unit("hero"),
    foe = unit("foe"),
    standard = ability({ cost: 1 });
  const selected = [];
  renderTurn({
    root: { querySelectorAll: () => [] },
    container: { querySelector: () => form },
    payload: { allies: [hero], enemies: [foe] },
    choice: {
      actor: hero.id,
      formationActors: [
        {
          ...hero,
          options: {
            attack: true,
            weapon: true,
            formation: { bank: { fire: 1, dark: 1 }, standard, allies: [hero], foes: [{ ...foe, targetable: true }] },
          },
        },
      ],
    },
    onChoice: (choice) => selected.push(choice),
  });
  const bank = parts.get("[data-formation-bank]");
  assert.equal([...bank.innerHTML.matchAll(/data-formation-energy=/gu)].length, 6);
  assert.ok(bank.innerHTML.includes(">dark 1</span>"));
  const view = presentation(
    {
      append() {},
      querySelector(selector) {
        assert.notEqual(selector, ".cbar", "energy counters no longer crowd the battle header");
        return null;
      },
      querySelectorAll: () => [bank],
    },
    { combatMode: "formation" },
  );
  view.event({ op: "formation-bank", side: "ally", bank: { light: 3, dark: 2 } });
  assert.ok(bank.innerHTML.includes(">light 3</span>") && bank.innerHTML.includes(">dark 2</span>"));
  view.dispose();
  field("action").value = "weapon";
  field("action").onchange();
  const bonus = (element) => field("bonus").options.find((option) => option.value === element);
  assert.equal(field("bonus").value, "fire");
  assert.equal(bonus("fire").disabled, false);
  assert.equal(bonus("dark").disabled, true, "unspent energy is unavailable even when present in the bank");
  field("pay-fire").value = "0";
  field("pay-dark").value = "1";
  field("pay-dark").oninput();
  assert.equal(bonus("fire").disabled, true);
  assert.equal(bonus("dark").disabled, false);
  assert.equal(field("bonus").value, "", "an unavailable selection becomes explicit None");
  assert.equal(bonus("").disabled, false);
  form.onsubmit({ preventDefault() {}, stopPropagation() {} });
  assert.equal(selected[0].bonus, "");
  assert.equal(selected[0].payment.dark, 1);
  field("bonus").value = "dark";
  form.onsubmit({ preventDefault() {}, stopPropagation() {} });
  assert.equal(selected[1].bonus, "dark");
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
