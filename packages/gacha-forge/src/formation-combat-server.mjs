/* global FORGE_FORMATION_ENGINE, FORGE_FORMATION_RULES, forgeFormationCeilings, forgeFormationEffects, forgeFormationEnemyKit, forgeFormationMaxPower, forgeFormationMode, forgeFormationShares, forgeFormationSpread, forgeFormationTargets, forgeFormationTeamError, forgeFormationTriggers, normalizeForgeFormationKit, normalizeForgeFormationRules */
export function forgeFormationAvailableElements(session, documents) {
  return [
    ...new Set(
      documents
        .filter((document) => document?.data?.kind === "character" && session?.roster?.[document.id])
        .map((document) => String(document.data.affinity || "").toLowerCase()),
    ),
  ];
}

// The rules every Formation prompt states, built from the engine's own numbers so a model is never told otherwise.
export function forgeFormationRulesText() {
  const share = (effect) => forgeFormationShares[effect];
  const ceiling = (effect) => (forgeFormationCeilings[effect] ? ` (max ${forgeFormationCeilings[effect]})` : "");
  return `FORMATION RULES. A team seats up to three Front Row fighters and up to three Back Row supports. At the start of each of its team turns, every living Back Row support adds 1 energy of its own element to the team's shared bank; a team with no supports gains 1 every other turn from its fighters. Energy never expires. Back Row supports do not act and cannot be attacked: they power the team and carry passives. Every Front Row fighter acts once per team turn: its Normal skill, its Ultimate, a row change (move into an empty seat or swap places with a support; whoever arrives in front acts next turn), or Hold (keep the energy). When a Front Row fighter falls, one of its team's supports at once steps into the empty seat and acts from its team's next turn. A team loses only when it has nobody left; Echo tokens do not count. Water beats Fire, Fire beats Earth, Earth beats Wind, Wind beats Water; Light and Dark beat each other. From round 12 healing fades and every hit grows stronger, so fights end.
COSTS. Normal skill: cost 0-4 energy of any element. Ultimate: cost 2-8, of which elementCost (1..cost) must be the user's own element; Light and Dark energy can pay that part of any Ultimate. Every point spent adds its element's bonus to the action: Fire +5% damage, Dark +8% damage, Wind +10 crit, Earth a small shield, Water heals the weakest ally a little, Light heals the user.
POWER means, per effect: damage, aoe_damage, drain, execute = % of the user's ATK per hit; dot = % of the user's ATK dealt at the start of each of the target's turns, past DEF and shields; heal and restore = % of each target's max HP; revive = % of max HP the ally returns with; shield = % of each target's max HP absorbed${ceiling("shield")}; regen = % of max HP healed at the start of each of the target's turns; buff/debuff = % ATK or DEF up/down, or crit chance points${ceiling("buff")}; stun/silence = % chance to land; energy = points of the user's element (1-3); summon = the Echo's share of the user's stats (20-60). taunt, immune, cleanse, swap and shuffle use power 0.
POWER LIMITS. Budget B: Normal skill 100 + 30 per energy of cost; Ultimate 160 + 20 per energy of cost (max 320); passive 110 in the Front Row or 160 in the Back Row. Maximum power = B x ${share("damage")} for damage/aoe_damage, x ${share("drain")} drain/execute, x ${share("dot")} dot, x ${share("heal")} heal, x ${share("shield")} shield, x ${share("regen")} regen, x ${share("buff")} buff/debuff, x ${share("restore")} restore/revive (max 100); x ${forgeFormationSpread} when it reaches a whole row or team. No ability's power exceeds ${forgeFormationMaxPower}. stun/silence chance: Normal 25 + 25 per energy of cost, Ultimate 100, passive 35. Higher numbers are lowered to the limit.
EFFECTS: ${forgeFormationEffects.join(", ")}. damage hits its target; aoe_damage hits every enemy fighter; drain heals the user 40% of the damage dealt; execute grows up to x2 as the target weakens; dot burns each turn; heal; restore (Ultimate only) heals and removes harmful effects; shield; regen; buff/debuff need "stat": "atk", "def" or "crit"; stun (the target loses its next action); silence (the target can only move or hold); taunt (enemies must target the user); immune (Ultimate only: blocks enemy damage, damage over time and control); cleanse; revive (each fallen ally returns once per battle); energy; swap (pull one enemy support into their Front Row; if it is full, their healthiest fighter steps back); shuffle (reseat the enemy team at random); summon (an Echo token takes an empty Front Row seat). A unit that lost its last turn to stun or silence shrugs off the next one.
TARGETS: ${forgeFormationTargets.join(", ")}. enemy = one enemy fighter the player picks; all_enemies = every enemy fighter; front_row = every enemy fighter for an attack, or the user's own Front Row for a heal, shield or buff; ally = one ally the player picks; allies = the whole team; back_row = the user's own supports. Back Row enemies can never be targeted, except by swap.
DURATION 1-3 counts the target's own turns, starting with its next one.
PASSIVE: fires at full power at most once per team turn. trigger: ${forgeFormationTriggers.join(", ")}. on_attack, on_hit, on_ult, on_kill, on_death and enter_front only fire in the Front Row; enter_back only in the Back Row; ally_* fire in either row when a teammate does it. "row" (front, back or both) is where the passive works; pick a trigger that can fire there.
TRAITS: a hybrid may take ONE perk: advance_ult (its Ultimate is free on its next turn after it moves from Back to Front) or retreat_echo (power 40-100: when it moves from Front to Back it recasts its last skill for free at that % power). A five-star character takes exactly ONE signature: solo_front (power 30-100: +that % ATK and DEF while it is the only fighter in its Front Row) or front_tokens (power 20-60: while it fights in front, its Echo tokens fill every empty Front Row seat at its turn start; an Echo has that % of its stats, strikes weakly for free at the end of its team's turn and vanishes with it). Everyone else uses "traits": [].`;
}

const forgeFormationKitShape = `{"preferredRow":"front|back|hybrid","standard":{"name":"...","description":"...","effect":"damage","target":"enemy","power":100,"cost":0,"duration":2},"ultimate":{"name":"...","description":"...","effect":"aoe_damage","target":"all_enemies","power":160,"cost":4,"elementCost":2,"duration":2},"passive":{"name":"...","description":"...","effect":"shield","target":"self","power":10,"duration":2,"trigger":"turn_start","row":"front"},"traits":[]}`;

export function forgeFormationKitMessages({ run, unit, cardContext = "" }) {
  const language = typeof run?.language === "string" && run.language.trim() ? run.language.trim() : "English";
  return [
    {
      role: "system",
      content: `Design this character's kit for Formation combat. Keep the supplied character's identity, authored canon, element and rarity. Never rewrite appearance, personality or backstory. Return ONLY JSON.
${forgeFormationRulesText()}
ARCHETYPE. Choose "preferredRow" from canon first (how this character fights), then from role: Tanks, Warriors and Assassins usually "front", Supports "back", Mages either; "hybrid" for characters who thrive moving between rows.
- front: a fighter that hits or protects. Normal costs 0-1 (damage power 80-100 at cost 0, up to 130 at cost 1, or a tank's taunt or shield); Ultimate costs 2-5 with elementCost 1-3 and helps it fight; passive row "front" or "both".
A front or hybrid kit needs a Normal skill or Ultimate that hits or controls enemies (damage, aoe_damage, drain, execute, dot, debuff, stun, silence, swap or shuffle), or a passive with power that deals damage (damage, aoe_damage, drain or execute) on a trigger other than on_attack or on_kill, in row "front" or "both": a tank's taunt or shield Normal pairs with an attacking Ultimate or such a passive. Otherwise its Normal skill becomes a plain strike.
- back: a deliberately weak Normal (cost 1-3; a back character's Normal keeps only 60% of the power limit); a powerful but situational Ultimate that a team saves for, costing 5-8 with elementCost 2-4: revive, restore the party, team immunity, swap or shuffle the enemy board, or one devastating hit; and a VERY STRONG passive with row "back" using turn_start or an ally_* trigger, near the passive limit.
- hybrid: Normal cost 0-2, Ultimate cost 3-6, and a perk and/or enter_front/enter_back passives that reward switching rows.
Vary costs between characters: simple attackers may have a free Normal skill and a cheap Ultimate, while advanced characters need energy saved over several turns for devastating effects. Use effects that suit the character and the genre: damage over time, attack or defence up and down, regeneration, stun, silence, shields, taunts, immunity, and board control (swap, shuffle) for manipulators.
Write every name and description in ${language}. A description is one or two sentences that say exactly what the skill does with its real numbers, for example "Deals 120% ATK to one enemy." or "Every ally regenerates 4% max HP for 2 turns."
Every ability has exactly one effect. Use only the effects, targets, triggers and traits listed above. No arbitrary code, invented fields, extra turns or recursive triggers.
Shape: ${forgeFormationKitShape}
A front fighter: {"preferredRow":"front","standard":{"name":"Riptide Lance","description":"Deals 100% ATK to one enemy.","effect":"damage","target":"enemy","power":100,"cost":0,"duration":1},"ultimate":{"name":"Abyssal Tide","description":"Deals 150% ATK to every enemy fighter.","effect":"aoe_damage","target":"all_enemies","power":150,"cost":4,"elementCost":2,"duration":1},"passive":{"name":"Undertow","description":"When struck, it strikes back for 90% ATK.","effect":"damage","target":"enemy","power":90,"duration":1,"trigger":"on_hit","row":"front"},"traits":[]}
A back support: {"preferredRow":"back","standard":{"name":"Soft Chime","description":"Heals one ally for 6% max HP.","effect":"heal","target":"ally","power":6,"cost":1,"duration":1},"ultimate":{"name":"Second Dawn","description":"Brings every fallen ally back with 60% max HP.","effect":"revive","target":"allies","power":60,"cost":7,"elementCost":3,"duration":1},"passive":{"name":"Hymn of Resolve","description":"At each turn start, every ally gains 20% ATK for 1 turn.","effect":"buff","target":"allies","stat":"atk","power":20,"duration":1,"trigger":"turn_start","row":"back"},"traits":[]}`,
    },
    {
      role: "user",
      content: `World: ${typeof run?.scenario === "string" ? run.scenario.trim().slice(0, 6000) : ""}\nCharacter: ${JSON.stringify({ name: unit?.name, rarity: unit?.rarity, role: unit?.role, affinity: unit?.affinity, description: unit?.description, personality: unit?.personality, backstory: unit?.backstory, appearance: unit?.appearance, skill: unit?.skill, passive: unit?.passive })}\nCurrent authored card canon:\n${typeof cardContext === "string" ? cardContext : JSON.stringify(cardContext)}`,
    },
  ];
}

export function forgeFormationEncounterMessages(messages, run, elements) {
  if (forgeFormationMode(run) !== "formation") return messages;
  const result = messages.map((message) => ({ ...message }));
  result[0].content += `

FORMATION COMBAT. This encounter is fought in Formation: these rules decide how the fight plays. Every enemy still needs its classic fields exactly as specified above (role, stats, position, and a skill whose effect is one of the classic skill effects listed above); Formation-only effects such as taunt, silence, restore, immune, swap, shuffle, summon and regen go only inside its "formationKit", which is what actually fights.
${forgeFormationRulesText()}
The player brings up to six characters. Give every enemy "position": "front" (it acts each turn and can be attacked) or "back" (a protected battery: each enemy turn it adds 1 energy of its element and its passive works, and it can only be reached by swap until it steps into the seat of a fallen front enemy). One to three per row, at least one in front, at most six enemies; with three or more enemies, seat one or two supports in back.
Give EVERY enemy a "formationKit"; EVERY elite and boss MUST have one. Kits follow the archetypes: front fighters hit and protect; back supports have weak actions, strong passives and a situational Ultimate. The boss stands in the Front Row, or is last in the defeat_order.
Make boss fights creative and readable. Each boss fight uses at least one device besides the boss's mech: a formationRule, a Back Row engine (a support whose passive empowers the boss), or a board-changing Ultimate (swap or shuffle). Boss "mech" values add to its kit and never replace it: phases (enrages below half HP), charge (marks one fighter, then fires its Ultimate at x1.5 the next turn), guard (a guard bar that breaks into extra damage), summon (Echo reinforcements), double (a weaker second Normal skill each turn), immune (resists control and swap), counter (answers each paid Ultimate with a strike), aura (every third turn the player's supports make no energy).
Optional "formationRules" (at most 2): {"kind":"element_barrier","elements":["fire"],"description":"Only Fire can pierce the ward."} means ONLY the player's units of those elements can target ANY enemy in this fight; use only an element the player already owns: ${(elements || []).join(", ") || "no element barrier allowed"}. {"kind":"defeat_order","order":[0,1,2],"description":"Fell the left sentinel, then the right, then the captain."} The order contains 2-3 distinct ZERO-BASED indices into this encounter's full formation array; ordered enemies are placed in the Front Row, and each can only be targeted after the earlier ones fall. If the boss is not in the defeat_order, the order holds at most 2 indices so the boss keeps a Front Row seat.
Explain every rule and mechanic plainly in the objective or opening and in the rule's description. Require counterplay the player has now: never demand unowned units, spending currency, impossible row access or hidden rules.
Enemies talk during combat: keep the dialogueCues contract above, and let cues react to their own mechanics (for example a "charge" cue as a boss marks its target).
formationKit shape: ${forgeFormationKitShape}. Omit anything this grammar does not support rather than inventing fields.`;
  return result;
}

/**
 * Formation's view of a generated guide. `elements` (the player's owned elements) is passed only in Formation
 * worlds; Classic guides pass none and are returned unchanged. Kits and rules are read leniently; in Formation a
 * boss without any kit refuses the guide so the boss fight is regenerated, and a barrier the player cannot
 * meet is dropped.
 */
export function forgeFormationNormalizeGuide(raw, guide, elements) {
  if (!guide) return null;
  const formationWorld = Array.isArray(elements);
  const formation = guide.formation.map((enemy, index) => {
    const written = raw?.formation?.[index]?.formationKit;
    // In Formation a kit the model wrote is salvaged slot by slot from the enemy's classic skill, never paid for twice.
    const kit = normalizeForgeFormationKit(written, formationWorld ? { fallback: forgeFormationEnemyKit(enemy) } : {});
    return kit ? { ...enemy, formationKit: kit } : enemy;
  });
  // A boss with no kit at all is the one thing worth regenerating: its fight would have no Formation identity.
  if (formationWorld && formation.some((enemy) => enemy?.tier === "boss" && !enemy.formationKit)) return null;
  let rules = normalizeForgeFormationRules(raw?.formationRules, guide.formation).filter(
    (rule) =>
      !formationWorld || rule.kind !== "element_barrier" || rule.elements.some((element) => elements.includes(element)),
  );
  if (formationWorld) rules = forgeFormationSeatedRules(formation, rules);
  // The rules are rebuilt from the reply every time, so a copy left by an earlier pass never survives the filter.
  const { formationRules: _previous, ...rest } = guide;
  return { ...rest, formation, ...(rules.length ? { formationRules: rules } : {}) };
}

/**
 * A three-member defeat order that leaves out the boss would bench it in the Back Row until the ordered enemies
 * fall. The order then keeps its first two members, so the boss takes the third Front Row seat.
 */
export function forgeFormationSeatedRules(enemies, rules = []) {
  const boss = enemies.findIndex((enemy) => enemy?.tier === "boss");
  return rules.map((rule) => {
    if (rule.kind !== "defeat_order" || boss < 0 || rule.order.includes(boss) || rule.order.length <= 2) return rule;
    const order = rule.order.slice(0, 2);
    // The model's sentence still names the dropped step; say what the engine now enforces.
    const names = order.map((index) => String(enemies[index]?.name || "").trim() || `enemy ${index + 1}`);
    return { ...rule, order, description: `Defeat ${names.join(", then ")}.` };
  });
}

/**
 * Formation-only safety net before the classic parser runs: a classic skill or passive that borrowed a
 * Formation-only effect is read as its nearest classic effect, so the guide is not refused over it.
 */
export function forgeFormationClassicFields(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.formation)) return raw;
  const nearest = {
    taunt: "shield",
    immune: "shield",
    silence: "stun",
    restore: "heal",
    regen: "heal",
    swap: "damage",
    shuffle: "damage",
    summon: "damage",
  };
  const fit = (ability) =>
    ability && typeof ability === "object" && nearest[ability.effect]
      ? { ...ability, effect: nearest[ability.effect] }
      : ability;
  return {
    ...raw,
    formation: raw.formation.map((enemy) =>
      enemy && typeof enemy === "object" ? { ...enemy, skill: fit(enemy.skill), passive: fit(enemy.passive) } : enemy,
    ),
  };
}

/**
 * Seats enemies front-first: defeat-order members, the boss, elites, fighters whose kit prefers the front, then
 * those the guide put in front. At most three per row (overflow takes the other row) and at least one in front.
 */
export function forgeFormationEnemies(enemies, rules = []) {
  rules = forgeFormationSeatedRules(enemies, rules);
  const result = enemies.map((enemy) => ({
    ...enemy,
    formationKit: normalizeForgeFormationKit(enemy.formationKit) || forgeFormationEnemyKit(enemy),
    formation: true,
  }));
  const order = rules.find((rule) => rule.kind === "defeat_order")?.order || [];
  const rank = (enemy, index) =>
    order.includes(index)
      ? order.indexOf(index)
      : enemy.tier === "boss"
        ? 10
        : enemy.tier === "elite"
          ? 20
          : ["front", "hybrid"].includes(enemy.formationKit?.preferredRow)
            ? 30
            : enemy.position !== "back"
              ? 40
              : 50;
  const ranked = result.map((enemy, index) => index).sort((a, b) => rank(result[a], a) - rank(result[b], b) || a - b);
  const keen = ranked.filter((index) => rank(result[index], index) < 50).length;
  const seats = Math.min(3, Math.max(1, result.length - 3, keen));
  const front = new Set(ranked.slice(0, seats));
  return result.map((enemy, index) => ({ ...enemy, position: front.has(index) ? "front" : "back" }));
}

// ponytail: a guarded route records the elements its Formation world owns before the handler reads a cached guide,
// so a barrier nobody in the world can meet (a guide cached by 1.24.0) is dropped the way generation drops it.
// Ceiling: one process-wide map keyed by world; upgrade path: pass the elements through every guide reader.
const forgeFormationOwnedElements = new Map();

export function forgeFormationPrepare(run, allies, enemies, rules = []) {
  if (forgeFormationMode(run) !== "formation") return { allies, enemies, combatMode: "classic", formationRules: [] };
  const owned = forgeFormationOwnedElements.get(run?.runId);
  const meetable = owned
    ? rules.filter(
        (rule) => rule.kind !== "element_barrier" || rule.elements.some((element) => owned.includes(element)),
      )
    : rules;
  // The preview, the snapshot and the engine all read the same seated rules.
  const seated = forgeFormationSeatedRules(enemies, meetable);
  return { allies, enemies: forgeFormationEnemies(enemies, seated), combatMode: "formation", formationRules: seated };
}

export function forgeFormationEncounterError(allies, rules = []) {
  const teamError = forgeFormationTeamError(allies);
  if (teamError) return teamError;
  const elements = new Set(allies.map((actor) => String(actor.affinity || "").toLowerCase()));
  if (rules.some((rule) => rule.kind === "element_barrier" && !rule.elements.some((element) => elements.has(element))))
    return "formation-element-required";
  if (allies.some((actor) => !normalizeForgeFormationKit(actor.formationKit))) return "formation-conversion-required";
  return null;
}

export function forgeFormationRoutes(routes, { migration, readWorld, cancellation }) {
  const guarded = new Set([
    "/battle",
    "/battle/start",
    "/farm/battle",
    "/farm/start",
    "/tower/battle",
    "/tower/start",
    "/story-event/battle",
    "/story-event/battle/start",
  ]);
  const wrapper = Object.create(routes);
  wrapper.post = (path, handler) =>
    routes.post(path, async (request) => {
      if (!guarded.has(path) && path !== "/formation") return handler(request);
      const runId = request?.body?.runId,
        starting = guarded.has(path) && path.endsWith("/start");
      const operation = async () => {
        // Read the run inside admission. A conversion may have committed while this
        // request was queued; the preview's expected mode must still match.
        let run = await readWorld(runId);
        if (!run) return { ok: false, error: "not-found" };
        if (guarded.has(path)) {
          const block = await migration.guard(runId);
          if (block && block.ok === false) return block;
          // A tab still running an older engine or older rules would play a fight this server scores differently;
          // it starts, previews and spends nothing, and never sets off a paid kit remake, until it reloads. A
          // missing field means an older tab. Checked before ensure and again on the world it may have changed.
          const stale = (world) =>
            forgeFormationMode(world) === "formation" &&
            (request.body?.expectedFormationEngine !== FORGE_FORMATION_ENGINE ||
              request.body?.expectedFormationRules !== FORGE_FORMATION_RULES);
          if (stale(run)) return { ok: false, error: "formation-engine-changed" };
          const ready = await migration.ensure(runId, run);
          if (ready && ready.ok === false) return ready;
          run = await readWorld(runId);
          if (!run) return { ok: false, error: "not-found" };
          if (forgeFormationMode(run) === "formation" && typeof migration.elements === "function")
            forgeFormationOwnedElements.set(runId, await migration.elements(runId));
          if (
            starting &&
            request.body?.expectedCombatMode != null &&
            request.body.expectedCombatMode !== forgeFormationMode(run)
          )
            return { ok: false, error: "changed" };
          if (stale(run)) return { ok: false, error: "formation-engine-changed" };
        }
        const response = await handler(request);
        run = (await readWorld(runId)) || run;
        if (path === "/formation" && response?.ok) return { ...response, combatMode: forgeFormationMode(run) };
        if (!response?.ok || !response.allies || !response.enemies)
          return starting && response?.ok ? { ...response, combatMode: forgeFormationMode(run) } : response;
        const snapshotRun = response.combatMode
          ? { ...run, combat: { ...run.combat, mode: response.combatMode } }
          : run;
        const prepared = forgeFormationPrepare(
          snapshotRun,
          response.allies,
          response.enemies,
          response.formationRules || [],
        );
        if (prepared.combatMode === "formation") {
          const error = forgeFormationEncounterError(prepared.allies, prepared.formationRules);
          if (error) return { ok: false, error, formationRules: prepared.formationRules };
        }
        return { ...response, ...prepared };
      };
      try {
        return starting ? await cancellation.mutate(runId, operation) : await operation();
      } catch (error) {
        if (error?.forgeFormation === true) return { ok: false, error: error.message };
        throw error;
      }
    });
  return wrapper;
}
