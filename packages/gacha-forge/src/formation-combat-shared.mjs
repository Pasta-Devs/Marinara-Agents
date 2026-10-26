// One deterministic implementation is shipped to the client and the claim verifier.
export const forgeFormationElements = ["fire", "water", "wind", "earth", "light", "dark"];
const forgeFormationEffects = [
  "damage",
  "aoe_damage",
  "heal",
  "shield",
  "buff",
  "debuff",
  "dot",
  "stun",
  "cleanse",
  "revive",
  "energy",
  "drain",
  "execute",
  "regen",
  "immune",
  "silence",
  "taunt",
  "swap",
  "summon",
];
const forgeFormationTargets = ["enemy", "all_enemies", "ally", "allies", "self", "front_row", "back_row"];
const forgeFormationTriggers = [
  "turn_start",
  "on_attack",
  "on_hit",
  "on_ult",
  "on_death",
  "on_kill",
  "enter_front",
  "enter_back",
];
const forgeFormationTraits = ["solo_front", "advance_ult", "retreat_echo", "front_tokens"];
const forgeFormationText = (value, max = 240) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const forgeFormationInt = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const forgeFormationCopy = (value) => JSON.parse(JSON.stringify(value));

export function forgeFormationMode(run) {
  return run?.combat?.mode === "formation" ? "formation" : "classic";
}

function forgeFormationAbility(raw, type) {
  if (
    !raw ||
    !forgeFormationText(raw.name, 80) ||
    !forgeFormationEffects.includes(raw.effect) ||
    !forgeFormationTargets.includes(raw.target) ||
    !forgeFormationInt(raw.power, 0, 300)
  )
    return null;
  const ability = {
    name: forgeFormationText(raw.name, 80),
    description: forgeFormationText(raw.description, 500),
    effect: raw.effect,
    target: raw.target,
    power: raw.power,
    duration: raw.duration == null ? 2 : raw.duration,
  };
  if (!forgeFormationInt(ability.duration, 1, 3)) return null;
  if (["buff", "debuff"].includes(raw.effect)) {
    if (!["atk", "def", "spd", "crit"].includes(raw.stat)) return null;
    ability.stat = raw.stat;
  }
  if (type === "passive") {
    if (!forgeFormationTriggers.includes(raw.trigger) || !["front", "back", "both"].includes(raw.row)) return null;
    ability.trigger = raw.trigger;
    ability.row = raw.row;
  } else {
    if (!forgeFormationInt(raw.cost, type === "ultimate" ? 2 : 0, type === "ultimate" ? 8 : 4)) return null;
    ability.cost = raw.cost;
    if (type === "ultimate") {
      if (!forgeFormationInt(raw.elementCost, 0, raw.cost)) return null;
      ability.elementCost = raw.elementCost;
    }
  }
  return ability;
}

export function normalizeForgeFormationKit(raw) {
  if (!raw || !["front", "back", "hybrid"].includes(raw.preferredRow)) return null;
  const standard = forgeFormationAbility(raw.standard, "standard"),
    ultimate = forgeFormationAbility(raw.ultimate, "ultimate"),
    passive = forgeFormationAbility(raw.passive, "passive");
  if (!standard || !ultimate || !passive || (raw.traits != null && !Array.isArray(raw.traits))) return null;
  // Traits are optional extras: keep up to two known, distinct ones and drop the rest, so a five-star kit
  // with a malformed trait still converts. A bare trait name counts as that trait at default power.
  const traits = [];
  for (const trait of raw.traits ?? []) {
    const kind = typeof trait === "string" ? trait : trait?.kind;
    if (traits.length === 2 || !forgeFormationTraits.includes(kind) || traits.some((entry) => entry.kind === kind))
      continue;
    traits.push({ kind, power: Math.max(10, Math.min(75, Math.round(Number(trait?.power) || 30))) });
  }
  return { version: 1, preferredRow: raw.preferredRow, standard, ultimate, passive, traits };
}

export function forgeFormationReady(unit) {
  return !!normalizeForgeFormationKit(unit?.formationKit);
}

export function forgeFormationKitMessages({ run, unit, cardContext = "" }) {
  return [
    {
      role: "system",
      content: `Design a distinctive, balanced kit for Formation combat. Keep the supplied character's identity, authored canon, element and rarity. Never rewrite appearance, personality or backstory. Return ONLY JSON. Four characters occupy up to three Front Row and three Back Row slots. Only living Front Row fighters act once per team turn; Back Row supplies one typed energy each turn and strong row-gated passives. Team energy persists between turns, cap12. Attack and Guard are free. Moving costs one frontline activation; an advancing fighter waits until next turn. A frontline collapse loses after immediate effects. Standard costs0..4 any energy; ultimate costs2..8, elementCost0..cost native element. Light/Dark substitute2:1 for another required element. Roles may be front, back, hybrid. Create meaningful support and movement kits, varied costs and expensive situational effects, not merely damage. Five-stars may combine up to2 bounded traits, each {"kind":"<trait>","power":10..75}; everyone else uses "traits":[]. All effects must fit this exact executable grammar. Effects: ${forgeFormationEffects.join(",")}. Targets: ${forgeFormationTargets.join(",")}. Durations1..3 team turns. Power0..300, buff/debuff needs stat atk/def/spd/crit. Passive triggers: ${forgeFormationTriggers.join(",")}, row front/back/both; each triggers once per unit/team turn. Traits: solo_front(stat bonus while alone in Front Row), advance_ult(free next-turn ultimate after voluntarily advancing), retreat_echo(repeats previous standard at half power when retreating), front_tokens(fills open frontline slots with fragile non-acting tokens at turn start). Tokens generate no energy. No arbitrary code, invented fields, extra turns or recursive triggers. Shape: {"preferredRow":"front|back|hybrid","standard":{"name":"...","description":"...","effect":"damage","target":"enemy","power":100,"cost":0,"duration":2},"ultimate":{"name":"...","description":"...","effect":"damage","target":"enemy","power":200,"cost":4,"elementCost":2,"duration":2},"passive":{"name":"...","description":"...","effect":"shield","target":"self","power":50,"duration":2,"trigger":"turn_start","row":"front"},"traits":[]}. A five-star's traits look like "traits":[{"kind":"advance_ult","power":40}].`,
    },
    {
      role: "user",
      content: `World: ${forgeFormationText(run?.scenario, 6000)}\nCharacter: ${JSON.stringify({ name: unit?.name, rarity: unit?.rarity, role: unit?.role, affinity: unit?.affinity, description: unit?.description, personality: unit?.personality, backstory: unit?.backstory, appearance: unit?.appearance, skill: unit?.skill, passive: unit?.passive })}\nCurrent authored card canon:\n${typeof cardContext === "string" ? cardContext : JSON.stringify(cardContext)}`,
    },
  ];
}

export function normalizeForgeFormationRules(raw, enemies = []) {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > 2) return null;
  const rules = [];
  for (const rule of raw) {
    if (
      !rule ||
      !["element_barrier", "defeat_order"].includes(rule.kind) ||
      rules.some((entry) => entry.kind === rule.kind)
    )
      return null;
    const description = forgeFormationText(rule.description, 400);
    if (!description) return null;
    if (rule.kind === "element_barrier") {
      if (!Array.isArray(rule.elements)) return null;
      const elements = [...new Set(rule.elements.map((element) => String(element).toLowerCase()))];
      if (!elements.length || elements.some((element) => !forgeFormationElements.includes(element))) return null;
      rules.push({ kind: rule.kind, description, elements });
    } else {
      const order = rule.order;
      if (
        !Array.isArray(order) ||
        order.length < 2 ||
        order.length > 3 ||
        new Set(order).size !== order.length ||
        order.some((index) => !Number.isInteger(index) || index < 0 || index >= enemies.length)
      )
        return null;
      rules.push({ kind: rule.kind, description, order: order.slice() });
    }
  }
  return rules;
}

// An efficient payment is suggested, while the exact chosen spend is replayed server-side.
export function forgeFormationPayment(bank, ability, affinity, chosen) {
  const element = String(affinity).toLowerCase(),
    cost = Number(ability?.cost) || 0,
    required = Number(ability?.elementCost) || 0;
  const valid = (payment) => {
    if (
      !payment ||
      typeof payment !== "object" ||
      Array.isArray(payment) ||
      Object.keys(payment).some((key) => !forgeFormationElements.includes(key))
    )
      return false;
    let total = 0;
    for (const key of forgeFormationElements) {
      const amount = payment[key] || 0;
      if (!forgeFormationInt(amount, 0, Math.max(0, bank[key] || 0))) return false;
      total += amount;
    }
    const native = Math.min(required, payment[element] || 0),
      missing = required - native;
    const wild = (element === "light" ? 0 : payment.light || 0) + (element === "dark" ? 0 : payment.dark || 0);
    return wild >= missing * 2 && total - missing === cost;
  };
  if (chosen != null) return valid(chosen) ? { ...chosen } : null;
  let best = null,
    score = Infinity;
  const inspect = (index, payment, spent) => {
    if (spent > cost + required) return;
    if (index === forgeFormationElements.length) {
      if (!valid(payment)) return;
      const value = spent * 100 + ((payment.light || 0) + (payment.dark || 0)) * 3 - (payment[element] || 0);
      if (value < score) {
        score = value;
        best = { ...payment };
      }
      return;
    }
    const key = forgeFormationElements[index];
    for (let amount = 0; amount <= Math.min(bank[key] || 0, cost + required - spent); amount += 1) {
      payment[key] = amount;
      inspect(index + 1, payment, spent + amount);
    }
  };
  inspect(0, {}, 0);
  return best;
}

export function forgeFormationTeamError(actors, enemy = false) {
  if (!Array.isArray(actors) || !actors.length || actors.length > (enemy ? 6 : 4)) return "formation-team-size";
  if (new Set(actors.map((actor) => actor.id)).size !== actors.length) return "formation-team-duplicate";
  const front = actors.filter((actor) => actor.position !== "back").length;
  return front < 1 || front > 3 || actors.length - front > 3 ? "formation-rows" : null;
}

// Compatibility for old generated enemies; heroes must have an authored generated kit.
export function forgeFormationEnemyKit(enemy) {
  const legacyPower = (skill) => {
    const raw = skill?.power;
    const value = typeof raw === "number" || (typeof raw === "string" && raw.trim() !== "") ? Number(raw) : NaN;
    return Number.isFinite(value) ? value : 100;
  };
  const normalize = (skill, cost) => ({
    name: skill?.name || "Strike",
    description: skill?.description || "",
    effect: forgeFormationEffects.includes(skill?.effect) ? skill.effect : "damage",
    target: forgeFormationTargets.includes(skill?.target) ? skill.target : "enemy",
    power: Math.max(0, Math.min(300, Math.round(legacyPower(skill)))),
    duration: 2,
    cost,
    ...(["buff", "debuff"].includes(skill?.effect) ? { stat: skill.stat || "atk" } : {}),
  });
  const passive = normalize(enemy.passive || { name: "Reserve", effect: "shield", power: 0, target: "self" }, 0);
  delete passive.cost;
  return normalizeForgeFormationKit({
    preferredRow: enemy.position === "back" ? "back" : "front",
    standard: normalize({ ...enemy.skill, power: Math.round(legacyPower(enemy.skill) * 0.6) }, 0),
    ultimate: { ...normalize(enemy.skill, 3), elementCost: 1 },
    passive: {
      ...passive,
      trigger: forgeFormationTriggers.includes(enemy.passive?.trigger) ? enemy.passive.trigger : "turn_start",
      row: "both",
    },
    traits: [],
  });
}

export function* forgeFormationBattle({ allies = [], enemies = [], seed = 1, rules = [] } = {}) {
  let randomSeed = seed >>> 0 || 1;
  const random = () => {
    randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
    return randomSeed / 4294967296;
  };
  const steps = [],
    log = [],
    banks = {
      ally: Object.fromEntries(forgeFormationElements.map((element) => [element, 0])),
      enemy: Object.fromEntries(forgeFormationElements.map((element) => [element, 0])),
    };
  const actors = [
    ...allies.map((unit) => ({ unit, side: "ally" })),
    ...enemies.map((unit) => ({ unit, side: "enemy" })),
  ].map(({ unit, side }, index) => {
    const stats = unit.stats || {},
      power = Number(unit.power) > 0 ? Number(unit.power) : 1,
      hpMax = Math.round(20 + (Number(stats.hp) || 50) * power * 6);
    const kit =
      normalizeForgeFormationKit(unit.formationKit) || (side === "enemy" ? forgeFormationEnemyKit(unit) : null);
    if (kit)
      for (const key of ["standard", "ultimate", "passive"])
        kit[key].power *= Math.max(1, Math.min(3, Number(unit.formationScaling?.[key]) || 1));
    return {
      ...forgeFormationCopy(unit),
      id: unit.id || `${side}-${index}`,
      side,
      aff: String(unit.affinity || "fire").toLowerCase(),
      position: unit.position === "back" ? "back" : "front",
      kit,
      hp: hpMax,
      hpMax,
      atk: (Number(stats.atk) || 50) * power,
      def: (Number(stats.def) || 50) * power,
      spd: Number(stats.spd) || 50,
      crit: Math.max(0, Math.min(100, Number.isFinite(Number(stats.crit)) ? Number(stats.crit) : 15)),
      critDmg: Math.max(100, Number(stats.critDmg) || 150),
      shield: 0,
      statuses: [],
      alive: true,
      acted: false,
      entered: 0,
      advanced: -2,
      revived: false,
      triggers: new Set(),
      lastStandard: null,
      token: false,
      guard: unit.mech?.includes("guard") ? 100 : 0,
      broken: 0,
      enraged: false,
      turns: 0,
      charge: false,
    };
  });
  const team = (side) => actors.filter((actor) => actor.side === side),
    live = (side) => team(side).filter((actor) => actor.alive),
    fronts = (side) => live(side).filter((actor) => actor.position === "front"),
    opponent = (side) => (side === "ally" ? "enemy" : "ally");
  const emit = (events, ms = 550) => {
    if (events.length) {
      const state = events.find((event) => event.op === "statuses");
      steps.push({
        d: ms,
        events: events.filter((event) => event.op !== "statuses"),
        ...(state ? { st: state.byId } : {}),
      });
    }
  };
  const hp = (actor, op = "hp", amount) => ({
    op,
    id: actor.id,
    hp: Math.max(0, Math.round(actor.hp)),
    hpMax: actor.hpMax,
    hpPct: Math.max(0, Math.round((actor.hp / actor.hpMax) * 100)),
    pct: Math.max(0, Math.round((actor.hp / actor.hpMax) * 100)),
    ...(amount == null ? {} : { amount }),
  });
  const status = (actor, kind) => actor.statuses.find((effect) => effect.kind === kind);
  const hasTrait = (actor, kind) => actor.kit?.traits.find((trait) => trait.kind === kind);
  const scalar = (actor, stat) => {
    let value = 1;
    for (const effect of actor.statuses) if (effect.stat === stat) value += effect.power / 100;
    const solo = hasTrait(actor, "solo_front");
    if (solo && actor.position === "front" && fronts(actor.side).length === 1 && ["atk", "def"].includes(stat))
      value += solo.power / 100;
    return Math.max(0.4, Math.min(2, value));
  };
  const statuses = () => ({
    op: "statuses",
    byId: Object.fromEntries(
      actors.map((actor) => [
        actor.id,
        actor.statuses.map((effect) => ({
          k: effect.kind === "dot" ? "burn" : effect.stat || effect.kind,
          v: effect.power,
          r: effect.rounds,
        })),
      ]),
    ),
  });
  const addStatus = (actor, kind, power, rounds, from, stat) => {
    const existing = actor.statuses.find((effect) => effect.kind === kind && effect.stat === stat);
    if (existing) {
      existing.power = power;
      existing.rounds = Math.max(existing.rounds, rounds);
      existing.from = from;
    } else actor.statuses.push({ kind, power, rounds, from, ...(stat ? { stat } : {}) });
  };
  let turn = 0,
    tokenSequence = 0,
    result = null,
    triggerDepth = 0;
  const canTarget = (source, target) => {
    if (target.side === source.side || target.position !== "front" || !target.alive) return false;
    const barrier = rules.find((rule) => rule.kind === "element_barrier");
    if (target.side === "enemy" && barrier && !barrier.elements.includes(source.aff)) return false;
    const order = rules.find((rule) => rule.kind === "defeat_order");
    if (target.side === "enemy" && order) {
      const next = order.order
        .map((index) => team("enemy").filter((actor) => !actor.token)[index])
        .find((actor) => actor?.alive);
      if (
        next &&
        order.order.some((index) => team("enemy").filter((actor) => !actor.token)[index] === target) &&
        next !== target
      )
        return false;
    }
    return true;
  };
  const targets = (source, ability, targetId) => {
    const offensive = ["damage", "aoe_damage", "drain", "execute", "dot", "stun", "debuff", "silence", "swap"].includes(
      ability.effect,
    );
    const candidates = offensive
      ? live(opponent(source.side)).filter((actor) => canTarget(source, actor))
      : live(source.side);
    if (ability.target === "self") return offensive ? candidates.slice(0, 1) : [source];
    if (["allies", "all_enemies"].includes(ability.target) || ability.effect === "aoe_damage") return candidates;
    if (["front_row", "back_row"].includes(ability.target))
      return candidates.filter((actor) => actor.position === (ability.target === "front_row" ? "front" : "back"));
    const taunted = offensive && candidates.find((actor) => status(actor, "taunt"));
    return [
      taunted ||
        candidates.find((actor) => actor.id === targetId) ||
        candidates.slice().sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax || a.id.localeCompare(b.id))[0],
    ].filter(Boolean);
  };
  const trigger = (actor, key, events) => {
    const passive = actor.kit?.passive;
    if (
      !passive ||
      passive.trigger !== key ||
      actor.triggers.has(key) ||
      triggerDepth >= 8 ||
      (passive.row !== "both" && passive.row !== actor.position) ||
      (!actor.alive && key !== "on_death")
    )
      return;
    actor.triggers.add(key);
    triggerDepth += 1;
    effect(actor, passive, null, events, 0.45, true);
    triggerDepth -= 1;
  };
  const collapse = () => {
    if (!fronts("ally").length) return "lose";
    if (!fronts("enemy").length) return "win";
    return null;
  };
  const kill = (actor, source, events) => {
    if (!actor.alive || actor.hp > 0) return;
    actor.alive = false;
    events.push({ op: "death", id: actor.id, killerId: source?.id || "" });
    for (const echo of actors.filter((unit) => unit.ownerId === actor.id && unit.alive)) {
      echo.hp = 0;
      echo.alive = false;
      events.push({ op: "death", id: echo.id, killerId: source?.id || "" });
    }
    trigger(actor, "on_death", events);
    if (source?.alive) trigger(source, "on_kill", events);
  };
  const token = (owner, events) => {
    if (!owner.alive || fronts(owner.side).length >= 3 || actors.length >= 24) return;
    const value = {
      ...owner,
      id: `${owner.id}~${++tokenSequence}`,
      ownerId: owner.id,
      name: `${owner.name} · Echo`,
      hpMax: Math.max(1, Math.round(owner.hpMax * 0.15)),
      hp: Math.max(1, Math.round(owner.hpMax * 0.15)),
      atk: owner.atk * 0.15,
      def: owner.def * 0.15,
      position: "front",
      token: true,
      kit: null,
      statuses: [],
      shield: 0,
      alive: true,
      acted: true,
      triggers: new Set(),
      mech: [],
    };
    actors.push(value);
    events.push({ op: "summon", id: value.id, from: owner.id, by: owner.id, position: "front" }, hp(value));
  };
  function effect(source, ability, targetId, events, multiplier = 1, passive = false) {
    const chosen = targets(source, ability, targetId),
      power = ((Number(ability.power) || 0) / 100) * multiplier;
    if (ability.effect === "revive") {
      const fallen = team(source.side).find(
        (actor) =>
          !actor.alive &&
          !actor.revived &&
          !actor.token &&
          (actor.position === "front"
            ? fronts(source.side).length < 3
            : live(source.side).filter((ally) => ally.position === "back").length < 3),
      );
      if (fallen) {
        fallen.alive = true;
        fallen.revived = true;
        fallen.hp = Math.max(1, Math.round(fallen.hpMax * Math.min(0.5, 0.15 + power * 0.15)));
        fallen.entered = turn;
        fallen.acted = true;
        events.push({ op: "revive", id: fallen.id }, hp(fallen, "heal", fallen.hp));
      }
      return;
    }
    if (ability.effect === "summon") {
      token(source, events);
      return;
    }
    if (ability.effect === "energy") {
      const bank = banks[source.side],
        held = Object.values(bank).reduce((sum, amount) => sum + amount, 0);
      bank[source.aff] += Math.min(12 - held, Math.max(1, Math.min(3, Math.round(power))));
      events.push({ op: "formation-bank", side: source.side, bank: { ...bank } });
      return;
    }
    if (chosen.length > 1 && ["damage", "aoe_damage", "drain", "execute"].includes(ability.effect))
      events.push({ op: "aoe", side: source.side === "ally" ? "enemies" : "allies", color: `var(--${source.aff})` });
    for (const target of chosen) {
      if (["damage", "aoe_damage", "drain", "execute"].includes(ability.effect)) {
        if (status(target, "immune")) {
          events.push({ op: "debuff", id: target.id, text: "IMMUNE" });
          continue;
        }
        const strengths = { fire: "earth", earth: "wind", wind: "water", water: "fire", light: "dark", dark: "light" },
          affinity = strengths[source.aff] === target.aff ? 1.5 : strengths[target.aff] === source.aff ? 0.75 : 1;
        const criticalChance = Math.max(
          0,
          Math.min(
            100,
            source.crit +
              source.statuses.filter((entry) => entry.stat === "crit").reduce((sum, entry) => sum + entry.power, 0),
          ),
        );
        const crit = random() * 100 < criticalChance,
          attack = source.atk * scalar(source, "atk"),
          defense = target.def * scalar(target, "def");
        let amount = Math.max(
          1,
          Math.round(
            attack *
              Math.max(0.2, power) *
              (1 - Math.min(0.8, (defense * 0.4) / Math.max(1, attack * 1.5))) *
              affinity *
              (crit ? source.critDmg / 100 : 1) *
              (ability.effect === "execute" ? 1 + (1 - target.hp / target.hpMax) : 1) *
              (source.damageBonus || 1),
          ),
        );
        if (target.defending) amount = Math.max(1, Math.round(amount * 0.5));
        if (target.broken) amount = Math.round(amount * 1.5);
        const blocked = Math.min(target.shield, amount);
        target.shield -= blocked;
        amount -= blocked;
        target.hp = Math.max(0, target.hp - amount);
        events.push({
          ...hp(target, "hit", amount),
          crit,
          effLabel: affinity > 1 ? "STRONG" : affinity < 1 ? "WEAK" : "",
        });
        if (target.guard > 0) {
          target.guard = Math.max(0, target.guard - (affinity > 1 ? 20 : 10));
          events.push({ op: "guard", id: target.id, v: target.guard, max: 100 });
          if (!target.guard) {
            target.broken = 1;
            events.push({ op: "broken", id: target.id });
          }
        }
        if (
          target.alive &&
          target.hp > 0 &&
          target.mech?.includes("phases") &&
          !target.enraged &&
          target.hp < target.hpMax * 0.5
        ) {
          target.enraged = true;
          target.atk *= 1.3;
          events.push({ op: "phase", id: target.id });
        }
        if (ability.effect === "drain" && source.alive) {
          const heal = Math.round(amount * 0.4);
          source.hp = Math.min(source.hpMax, source.hp + heal);
          events.push(hp(source, "heal", heal));
        }
        kill(target, source, events);
        if (target.alive && !passive) trigger(target, "on_hit", events);
      } else if (ability.effect === "heal") {
        const amount = Math.round(source.hpMax * 0.15 * power);
        target.hp = Math.min(target.hpMax, target.hp + amount);
        events.push(hp(target, "heal", amount));
      } else if (ability.effect === "shield") {
        target.shield += Math.round(source.def * scalar(source, "def") * power);
        events.push({ op: "shieldFx", ids: [target.id] });
      } else if (ability.effect === "cleanse") {
        target.statuses = target.statuses.filter((entry) => !["dot", "stun", "debuff", "silence"].includes(entry.kind));
        events.push({ op: "buff", id: target.id, text: "CLEANSE" });
      } else if (ability.effect === "swap") {
        const replacement = live(target.side).find((actor) => actor.position === "back");
        if (replacement) {
          target.position = "back";
          replacement.position = "front";
          replacement.entered = turn;
          replacement.acted = true;
          events.push(
            { op: "row", id: target.id, position: "back" },
            { op: "row", id: replacement.id, position: "front" },
          );
        }
      } else {
        if (target.mech?.includes("immune") && ["dot", "stun", "debuff", "silence"].includes(ability.effect)) continue;
        if (
          ["dot", "stun", "debuff", "silence"].includes(ability.effect) &&
          random() >=
            Math.max(
              0.15,
              Math.min(
                1,
                0.5 + ((Number(source.stats?.effectHit) || 0) - (Number(target.stats?.effectRes) || 0)) / 100,
              ),
            )
        ) {
          events.push({ op: "debuff", id: target.id, text: "RESIST" });
          continue;
        }
        const value =
          ability.effect === "dot" ? Math.round(source.atk * power * 0.25) : Math.max(1, Math.round(power * 20));
        addStatus(
          target,
          ability.effect,
          ability.effect === "debuff" ? -value : value,
          ability.duration || 2,
          source.id,
          ability.stat,
        );
        events.push({
          op: ["buff", "regen", "immune", "taunt"].includes(ability.effect) ? "buff" : "debuff",
          id: target.id,
          text: ability.effect.toUpperCase(),
        });
      }
    }
  }
  const available = (actor) => {
    const bank = banks[actor.side],
      skill = actor.kit?.standard,
      ultimate = actor.kit?.ultimate;
    const discounted =
      ultimate && hasTrait(actor, "advance_ult") && actor.advanced === turn - 2
        ? { ...ultimate, cost: 0, elementCost: 0 }
        : ultimate;
    return {
      attack: true,
      defend: true,
      row: true,
      weapon: !!skill && !status(actor, "silence") && !!forgeFormationPayment(bank, skill, actor.aff),
      ultimate: !!discounted && !status(actor, "silence") && !!forgeFormationPayment(bank, discounted, actor.aff),
      item: false,
      energy: 0,
      formation: {
        bank: { ...bank },
        standard: skill,
        ultimate: discounted,
        allies: live(actor.side).map((ally) => ({
          id: ally.id,
          name: ally.name,
          position: ally.position,
          token: ally.token,
        })),
        foes: live(opponent(actor.side)).map((foe) => ({
          id: foe.id,
          name: foe.name,
          position: foe.position,
          targetable: canTarget(actor, foe),
        })),
      },
    };
  };
  emit([{ op: "start" }, ...actors.map((actor) => hp(actor)), statuses()], 700);
  if (forgeFormationTeamError(allies) || forgeFormationTeamError(enemies, true) || actors.some((actor) => !actor.kit))
    result = "lose";
  const initialRules = normalizeForgeFormationRules(rules, enemies);
  if (!initialRules) result = "lose";
  rules = initialRules || [];
  for (let round = 1; round <= 40 && !result; round += 1) {
    for (const side of ["ally", "enemy"]) {
      turn += 1;
      for (const actor of actors) actor.triggers.clear();
      const events = [],
        bank = banks[side];
      for (const actor of live(side)) {
        actor.acted = false;
        actor.defending = false;
        if (
          actor.position === "back" &&
          !actor.token &&
          !(fronts(opponent(side)).some((foe) => foe.mech?.includes("aura")) && round % 3 === 0) &&
          Object.values(bank).reduce((sum, amount) => sum + amount, 0) < 12
        )
          bank[actor.aff] += 1;
        for (const entry of actor.statuses) {
          if (entry.kind === "dot") {
            actor.hp = Math.max(0, actor.hp - Math.abs(entry.power));
            events.push(hp(actor, "hit", Math.abs(entry.power)));
            kill(
              actor,
              actors.find((source) => source.id === entry.from),
              events,
            );
          }
          if (entry.kind === "regen" && actor.alive) {
            const amount = Math.round((actor.hpMax * entry.power) / 100);
            actor.hp = Math.min(actor.hpMax, actor.hp + amount);
            events.push(hp(actor, "heal", amount));
          }
        }
        if (actor.alive) trigger(actor, "turn_start", events);
        if (actor.alive && hasTrait(actor, "front_tokens"))
          for (let count = 0; count < 3 && fronts(side).length < 3; count += 1) token(actor, events);
        if (actor.alive && actor.mech?.includes("summon") && round % 3 === 0) token(actor, events);
      }
      events.push({ op: "formation-bank", side, bank: { ...bank } }, statuses());
      emit(events, 350);
      result = collapse();
      if (result) break;
      while (true) {
        const ready = fronts(side).filter((actor) => !actor.acted && !actor.token && actor.entered < turn);
        if (!ready.length) break;
        let actor = ready
          .slice()
          .sort((a, b) => b.spd * scalar(b, "spd") - a.spd * scalar(a, "spd") || a.id.localeCompare(b.id))[0];
        let forced = !!status(actor, "stun") || actor.broken > 0;
        let choice = { action: "auto" };
        if (side === "ally" && !forced) {
          const response = yield {
            op: "choice",
            actor: actor.id,
            round,
            options: available(actor),
            steps,
            foes: live("enemy").map((foe) => ({
              id: foe.id,
              hp: foe.hp,
              hpMax: foe.hpMax,
              atk: foe.atk,
              def: foe.def,
              spd: foe.spd,
            })),
            formationActors: ready
              .filter((unit) => !status(unit, "stun") && unit.broken <= 0)
              .map((unit) => ({ id: unit.id, name: unit.name, affinity: unit.aff, options: available(unit) })),
          };
          if (
            response &&
            ready.some((unit) => unit.id === response.actorId && !status(unit, "stun") && unit.broken <= 0)
          )
            actor = ready.find((unit) => unit.id === response.actorId);
          choice = response && typeof response === "object" ? response : choice;
        }
        forced = !!status(actor, "stun") || actor.broken > 0;
        const option = available(actor);
        let action = String(choice.action || "auto"),
          actionEvents = [{ op: "act", id: actor.id }];
        if (forced) {
          actor.acted = true;
          if (actor.broken > 0) actor.broken -= 1;
          actor.statuses = actor.statuses.filter((entry) => entry.kind !== "stun");
          emit([{ op: "stun", id: actor.id }], 300);
          continue;
        }
        if (action === "auto") action = option.ultimate ? "ultimate" : option.weapon ? "weapon" : "attack";
        if (!option[action]) action = "attack";
        if (actor.mech?.includes("charge")) {
          actor.turns += 1;
          action = "attack";
        }
        let payment = null,
          skill = action === "ultimate" ? option.formation.ultimate : action === "weapon" ? actor.kit.standard : null;
        if (skill) {
          payment = forgeFormationPayment(bank, skill, actor.aff, choice.payment);
          if (!payment) {
            action = "attack";
            skill = null;
          }
        }
        actor.acted = true;
        const record = {
          id: actor.id,
          actorId: actor.id,
          action,
          ...(choice.targetId ? { targetId: String(choice.targetId) } : {}),
          ...(payment
            ? {
                payment,
                bonus:
                  forgeFormationElements.includes(choice.bonus) && payment[choice.bonus] > 0
                    ? choice.bonus
                    : choice.bonus == null
                      ? forgeFormationElements.find((element) => payment[element] > 0) || ""
                      : "",
              }
            : {}),
          ...(choice.moveId ? { moveId: String(choice.moveId) } : {}),
          ...(choice.swapId ? { swapId: String(choice.swapId) } : {}),
        };
        if (side === "ally") log.push(record);
        if (action === "row") {
          const mover = live(side).find((unit) => unit.id === record.moveId && !unit.token) || actor;
          const otherRow = mover.position === "front" ? "back" : "front",
            swap = live(side).find((unit) => unit.id === record.swapId && unit.position === otherRow && !unit.token);
          const canMove =
            swap ||
            (live(side).filter((unit) => unit.position === otherRow).length < 3 &&
              !(mover.position === "front" && fronts(side).length === 1));
          if (canMove) {
            const involved = swap ? [mover, swap] : [mover];
            for (const moving of involved) {
              moving.position = moving.position === "front" ? "back" : "front";
              moving.entered = turn;
              moving.acted = true;
              if (moving.position === "front") moving.advanced = turn;
              actionEvents.push({ op: "row", id: moving.id, position: moving.position });
              trigger(moving, moving.position === "front" ? "enter_front" : "enter_back", actionEvents);
              if (
                moving.position === "back" &&
                hasTrait(moving, "retreat_echo") &&
                moving.lastStandard &&
                !moving.triggers.has("retreat_echo")
              ) {
                moving.triggers.add("retreat_echo");
                effect(moving, moving.lastStandard, null, actionEvents, 0.5, true);
              }
            }
          } else {
            actor.defending = true;
            actionEvents.push({ op: "defend", id: actor.id, pct: 50 });
          }
        } else if (action === "defend") {
          actor.defending = true;
          actionEvents.push({ op: "defend", id: actor.id, pct: 50 });
        } else {
          if (payment) {
            for (const element of forgeFormationElements) bank[element] -= payment[element] || 0;
            actionEvents.push({ op: "formation-bank", side, bank: { ...bank } });
            const bonus = record.bonus;
            if (bonus === "light") {
              const amount = Math.round(actor.hpMax * 0.05);
              actor.hp = Math.min(actor.hpMax, actor.hp + amount);
              actionEvents.push(hp(actor, "heal", amount));
            }
            if (bonus === "dark") actor.damageBonus = 1.08;
            if (bonus === "earth") {
              actor.shield += Math.round(actor.def * 0.12);
              actionEvents.push({ op: "shieldFx", ids: [actor.id] });
            }
            if (bonus === "water") {
              const ally = live(side)
                .slice()
                .sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
              const amount = Math.round(actor.hpMax * 0.03);
              ally.hp = Math.min(ally.hpMax, ally.hp + amount);
              actionEvents.push(hp(ally, "heal", amount));
            }
            if (bonus === "wind") addStatus(actor, "buff", 5, 2, actor.id, "spd");
            if (bonus === "fire") actor.damageBonus = 1.05;
          }
          if (action === "ultimate") {
            actionEvents.push({ op: "ult", id: actor.id, name: skill.name, aff: actor.aff, weapon: false });
            trigger(actor, "on_ult", actionEvents);
          }
          if (action === "weapon") actor.lastStandard = skill;
          const basic = { name: "Attack", effect: "damage", power: 75, target: "enemy" };
          if (actor.mech?.includes("charge")) {
            if (actor.charge) {
              basic.power *= 3;
              actor.charge = false;
            } else if (actor.turns % 3 === 0) {
              actor.charge = true;
              actionEvents.push({ op: "charge", id: actor.id });
              emit(actionEvents);
              continue;
            }
          }
          effect(actor, skill || basic, record.targetId, actionEvents);
          if (!skill || ["damage", "aoe_damage", "drain", "execute"].includes(skill.effect))
            trigger(actor, "on_attack", actionEvents);
          if (actor.mech?.includes("double") && actor.alive && !collapse())
            effect(actor, basic, record.targetId, actionEvents, 0.6, true);
          if (action === "ultimate")
            for (const counter of fronts(opponent(side)).filter((unit) => unit.mech?.includes("counter"))) {
              actionEvents.push({ op: "counter", id: counter.id });
              effect(counter, basic, actor.id, actionEvents, 0.6, true);
            }
          actor.damageBonus = 1;
        }
        actionEvents.push(statuses());
        emit(actionEvents, action === "ultimate" ? 1100 : 650);
        result = collapse();
        if (result) break;
      }
      for (const actor of team(side))
        actor.statuses = actor.statuses.filter((entry) => {
          entry.rounds -= 1;
          return entry.rounds > 0;
        });
      if (result) break;
    }
  }
  // A stalled puzzle or an invalid client log must never be rewarded as a victory.
  result ||= "lose";
  emit([{ op: "end", result }], 800);
  return { result, steps, log };
}

export function replayForgeFormationBattle(snapshot, choices = []) {
  const battle = forgeFormationBattle(snapshot);
  let index = 0,
    next = battle.next();
  while (!next.done) next = battle.next(choices[index++] || { action: "auto" });
  return next.value;
}
