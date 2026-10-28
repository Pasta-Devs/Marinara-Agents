// Seeded balance simulation: many Auto-vs-Auto Formation fights between kits built the way the kit prompt asks
// (front fighters, back supports, hybrids, five-star signatures), every power at its budget's limit.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FORGE_FORMATION_RULES,
  forgeFormationEffects,
  forgeFormationElements,
  forgeFormationTraitKinds,
  forgeFormationTriggers,
  normalizeForgeFormationKit,
  replayForgeFormationBattle,
} from "../packages/gacha-forge/src/formation-combat-shared.mjs";

function generator(seed) {
  let state = seed >>> 0 || 1;
  const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
  const pick = (list) => list[Math.floor(random() * list.length)];
  const ability = (slot, row) => {
    const back = row === "back";
    const effect =
      slot === "standard"
        ? pick(
            back
              ? ["damage", "heal", "buff", "debuff", "dot", "shield"]
              : ["damage", "damage", "drain", "execute", "dot", "aoe_damage", "shield", "debuff"],
          )
        : slot === "ultimate"
          ? pick(
              back
                ? ["revive", "restore", "immune", "swap", "shuffle", "damage", "aoe_damage", "stun", "energy"]
                : ["damage", "aoe_damage", "execute", "stun", "buff", "drain", "dot", "silence", "immune"],
            )
          : pick(
              back
                ? ["heal", "buff", "damage", "energy", "shield", "regen", "debuff", "dot"]
                : ["shield", "buff", "damage", "heal", "taunt", "stun"],
            );
    return {
      name: effect,
      description: "",
      effect,
      target: pick(["enemy", "enemy", "all_enemies", "ally", "self", "allies"]),
      power: 999,
      cost:
        slot === "standard"
          ? back
            ? 1 + Math.floor(random() * 3)
            : Math.floor(random() * 2)
          : back
            ? 5 + Math.floor(random() * 4)
            : 2 + Math.floor(random() * 4),
      elementCost: 1 + Math.floor(random() * 3),
      duration: 1 + Math.floor(random() * 3),
      stat: pick(["atk", "def", "crit"]),
      trigger: back
        ? pick(["turn_start", "ally_hit", "ally_attack", "ally_ult", "ally_death"])
        : pick(forgeFormationTriggers),
      row: row === "hybrid" ? "both" : row,
    };
  };
  const unit = (id, position, row) => {
    const five = random() < 0.3;
    return {
      id,
      name: id,
      affinity: pick(forgeFormationElements),
      position,
      power: 1,
      stats: { hp: 60 + random() * 60, atk: 60 + random() * 60, def: 60 + random() * 60, spd: 50, crit: 10 },
      formationKit: normalizeForgeFormationKit(
        {
          preferredRow: row,
          standard: ability("standard", row),
          ultimate: ability("ultimate", row),
          passive: ability("passive", row),
          traits: five
            ? [pick(forgeFormationTraitKinds)]
            : row === "hybrid"
              ? [pick(["advance_ult", "retreat_echo"])]
              : [],
        },
        { rarity: five ? 5 : 4 },
      ),
    };
  };
  const team = (prefix, size) =>
    [
      unit(`${prefix}a`, "front", "front"),
      unit(`${prefix}b`, "front", pick(["front", "hybrid"])),
      unit(`${prefix}c`, "front", "front"),
      unit(`${prefix}d`, "back", "back"),
      unit(`${prefix}e`, "back", "back"),
      unit(`${prefix}f`, "back", pick(["back", "hybrid"])),
    ].slice(0, size);
  return { random, team };
}

test("seeded Auto-vs-Auto fights end, split evenly and keep a sane energy economy", () => {
  assert.ok(forgeFormationEffects.length >= 20);
  const total = 400,
    outcome = { win: 0, lose: 0 },
    lengths = [];
  let stalled = 0,
    silent = 0,
    casting = 0;
  const peaks = [];
  for (let index = 0; index < total; index += 1) {
    const { team } = generator(1000 + index);
    const enemies = team("E", 3 + (index % 4)).map((enemy, at) =>
      at === 0 && index % 5 === 0 ? { ...enemy, tier: "boss", mech: ["phases", "charge"] } : enemy,
    );
    const allies = team("A", 3 + ((index >> 2) % 4));
    const fight = replayForgeFormationBattle({
      allies,
      enemies,
      seed: index + 1,
      formationRevision: FORGE_FORMATION_RULES,
    });
    outcome[fight.result] += 1;
    lengths.push(fight.log.length);
    if (fight.log.length >= 40) stalled += 1;
    const all = fight.steps.flatMap((step) => step.events);
    if (!all.some((event) => event.op === "hit")) silent += 1;
    // Supports step into fallen fighters' seats, so a side that is beaten before the round cap has nobody left.
    const standing = new Set([...allies, ...enemies].map((entry) => entry.id));
    for (const event of all) {
      if (event.op === "death") standing.delete(event.id);
      if (event.op === "revive") standing.add(event.id);
    }
    if (fight.log.length < 40)
      assert.ok(
        ![...standing].some((id) => id.startsWith(fight.result === "win" ? "E" : "A")),
        `the beaten side has nobody left (${index})`,
      );
    const charged = new Set(enemies.filter((enemy) => enemy.mech?.includes("charge")).map((enemy) => enemy.id));
    if (all.some((event) => event.op === "ult" && !charged.has(event.id))) casting += 1;
    peaks.push(
      Math.max(
        0,
        ...all
          .filter((entry) => entry.op === "formation-bank")
          .map((entry) => Object.values(entry.bank).reduce((sum, amount) => sum + amount, 0)),
      ),
    );
    for (const event of all.filter((entry) => entry.op === "formation-bank"))
      for (const amount of Object.values(event.bank))
        assert.ok(Number.isInteger(amount) && amount >= 0, `bank stays a whole, non-negative count (${index})`);
  }
  lengths.sort((a, b) => a - b);
  // ponytail: thresholds from the 1.24.0 tuning run (1 stall, p95 21 rounds, median 9, 217 wins of 400, an Ultimate
  // in 292 fights, p95 peak bank 26); retune budgets, the energy floor, fatigue and the AI against it, not by feel.
  // 1.24.5 (rules 3) seats a support in each fallen fighter's place, so fights run past the old win point: 5 stalls,
  // p95 27 rounds, median 11, 218 wins, an Ultimate in 293 fights, p95 peak bank 17. Only the p95 bound moved (25 -> 28).
  assert.ok(stalled / total < 0.02, `stall rate ${stalled}/${total}`);
  assert.ok(
    lengths[Math.floor(total * 0.95) - 1] < 28,
    `95% end before round 28 (p95 ${lengths[Math.floor(total * 0.95) - 1]})`,
  );
  assert.ok(
    outcome.win / total > 0.35 && outcome.win / total < 0.65,
    `neither side always wins: ${JSON.stringify(outcome)}`,
  );
  assert.equal(silent, 0, "every fight trades blows");
  // The AI and Auto spend their energy on Ultimates rather than hoarding it.
  peaks.sort((a, b) => a - b);
  assert.ok(casting / total >= 0.6, `fights with an Ultimate cast: ${casting}/${total}`);
  assert.ok(peaks[Math.floor(total * 0.95) - 1] < 35, `p95 peak bank ${peaks[Math.floor(total * 0.95) - 1]}`);
});

test("a lone fighter without supports still acts, and a stalled fight is never a win", () => {
  const { team } = generator(77);
  const [leader] = team("A", 1);
  const fight = replayForgeFormationBattle({ allies: [leader], enemies: team("E", 1), seed: 3 });
  assert.ok(fight.steps.flatMap((step) => step.events).some((event) => event.op === "act" && event.id === leader.id));
  assert.ok(["win", "lose"].includes(fight.result));
});
