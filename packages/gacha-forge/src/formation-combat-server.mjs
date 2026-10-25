/* global forgeFormationMode, normalizeForgeFormationKit, normalizeForgeFormationRules, forgeFormationEnemyKit, forgeFormationTeamError */
export function forgeFormationAvailableElements(session, documents) {
  return [
    ...new Set(
      documents
        .filter((document) => document?.data?.kind === "character" && session?.roster?.[document.id])
        .map((document) => String(document.data.affinity || "").toLowerCase()),
    ),
  ];
}

export function forgeFormationEncounterMessages(messages, run, elements) {
  if (forgeFormationMode(run) !== "formation") return messages;
  const result = messages.map((message) => ({ ...message }));
  result[0].content += `\nFORMATION COMBAT: this encounter uses Front Row fighters and Back Row elemental supports, a shared 12-point bank, one support energy each team turn and one action per frontline fighter. Front collapse defeats a team; supports are protected from direct attacks. At most 3 per row, at most 6 enemies. Give each enemy an optional executable formationKit using the supplied grammar. STANDARD uses any energy (cost 0..4), ULTIMATE uses native energy (cost 2..8, elementCost 0..cost); Light/Dark substitute 2:1. Passive trigger once per team turn, row-gated. Make bosses creative and telegraphed with existing mechs and at most 2 optional formationRules: {kind:'element_barrier',elements:['fire'],description:'Only Fire damage breaks the ward.'} or {kind:'defeat_order',order:[0,1,2],description:'Defeat left sentinel, right sentinel, then captain.'}. The order contains 2–3 distinct ZERO-BASED indices into this encounter's full formation array; ordered enemies are placed in the Front Row. Other ordered enemies are protected until earlier ones fall. Element barriers may use ONLY an element the player already owns: ${(elements || []).join(",") || "no element barrier allowed"}. Require actual counterplay available now; do not demand unowned units, spend currency, impossible row access or hidden rules. These rules must be clearly explained in objective/opening and description. Existing enemies-talking dialogueCues remain required where appropriate. The formationKit shape is {version:1,preferredRow:'front|back|hybrid',standard:{name,description,effect,target,power,cost,duration},ultimate:{name,description,effect,target,power,cost,elementCost,duration},passive:{name,description,effect,target,power,duration,trigger,row},traits:[]}. Effects damage,aoe_damage,heal,shield,buff,debuff,dot,stun,cleanse,revive,energy,drain,execute,regen,immune,silence,taunt,swap,summon. Targets enemy,all_enemies,ally,allies,self,front_row,back_row. Power 0..300, duration 1..3; buff/debuff needs stat atk/def/spd/crit. Passive trigger turn_start,on_attack,on_hit,on_ult,on_death,on_kill,enter_front,enter_back; row front/back/both. Up to 2 traits with kind solo_front,advance_ult,retreat_echo,front_tokens and power 10..75. No code or extra actions. Omit optional mechanics rather than invent unsupported fields.`;
  return result;
}

export function forgeFormationNormalizeGuide(raw, guide, elements) {
  if (!guide) return null;
  const rules = normalizeForgeFormationRules(raw?.formationRules, guide.formation);
  if (
    !rules ||
    rules.some(
      (rule) =>
        rule.kind === "element_barrier" && elements && !rule.elements.some((element) => elements.includes(element)),
    )
  )
    return null;
  const formation = guide.formation.map((enemy, index) => {
    if (raw?.formation?.[index]?.formationKit == null) return enemy;
    const kit = normalizeForgeFormationKit(raw.formation[index].formationKit);
    return kit ? { ...enemy, formationKit: kit } : null;
  });
  if (formation.some((enemy) => !enemy)) return null;
  return { ...guide, formation, ...(rules.length ? { formationRules: rules } : {}) };
}

export function forgeFormationEnemies(enemies, rules = []) {
  const result = enemies.map((enemy) => ({
    ...enemy,
    formationKit: normalizeForgeFormationKit(enemy.formationKit) || forgeFormationEnemyKit(enemy),
  }));
  const order = rules.find((rule) => rule.kind === "defeat_order")?.order || [];
  const front = new Set(order);
  for (const [index, enemy] of result.entries()) if (front.size < 3 && enemy.position !== "back") front.add(index);
  if (!front.size && result.length) front.add(0);
  return result.map((enemy, index) => ({ ...enemy, position: front.has(index) ? "front" : "back" }));
}

export function forgeFormationPrepare(run, allies, enemies, rules = []) {
  if (forgeFormationMode(run) !== "formation") return { allies, enemies, combatMode: "classic", formationRules: [] };
  return { allies, enemies: forgeFormationEnemies(enemies, rules), combatMode: "formation", formationRules: rules };
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
      if (!guarded.has(path) && !["/formation", "/formation/save"].includes(path)) return handler(request);
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
          const ready = await migration.ensure(runId, run);
          if (ready && ready.ok === false) return ready;
          run = await readWorld(runId);
          if (!run) return { ok: false, error: "not-found" };
          if (
            starting &&
            request.body?.expectedCombatMode != null &&
            request.body.expectedCombatMode !== forgeFormationMode(run)
          )
            return { ok: false, error: "changed" };
        }
        if (path === "/formation/save" && forgeFormationMode(run) === "formation") {
          const presets = Array.isArray(request.body?.presets) ? request.body.presets : [],
            active = Number.isInteger(request.body?.active) ? request.body.active : 0,
            board = presets[active]?.board || {};
          const actors = ["front", "back"].flatMap((position) =>
            (Array.isArray(board[position]) ? board[position] : []).filter(Boolean).map((id) => ({ id, position })),
          );
          const error = forgeFormationTeamError(actors);
          if (error) return { ok: false, error };
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
