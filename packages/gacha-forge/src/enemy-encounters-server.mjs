const forgeEnemyTiers = ["soldier", "elite", "boss"];
const forgeBossMechanics = ["phases", "charge", "guard", "summon", "double", "immune", "counter", "aura"];
const forgeDialogueTypes = new Set(["main", "side", "extra", "thought", "whisper"]);
const forgeDialogueTriggers = new Set([
  "intro",
  "round",
  "attack",
  "hit",
  "charge",
  "phase_75",
  "phase_50",
  "phase_25",
  "low_hp",
  "victory",
  "defeat",
]);

function forgeKnownMechanics(enemy) {
  return [
    ...new Set((Array.isArray(enemy?.mech) ? enemy.mech : []).filter((value) => forgeBossMechanics.includes(value))),
  ];
}

export function forgeEnemyTier(enemy) {
  if (forgeEnemyTiers.includes(enemy?.tier)) return enemy.tier;
  return forgeKnownMechanics(enemy).length ? "boss" : "soldier";
}

export function forgeEncounterPlanMessages(messages) {
  const result = messages.map((message) => ({ ...message }));
  result[0].content += `

ENCOUNTER TIERS: keep every fight's type exactly "combat" and keep the node counts above. Add "tier":"soldier"|"elite"|"boss" to each combat node. Soldier fights are ordinary opposition; elite fights are significant, stronger encounters; the LAST combat node is this chapter's climactic BOSS confrontation, before the closing story node. Ground that boss in this chapter's setup and established world rather than inventing an unrelated named villain. Mark other significant fights elite and ordinary opposition soldier. The setup must explain the intended enemy and stakes so the combat writer can preserve them. Do not add extra fights or change settled canon.`;
  return result;
}

export function forgeNormalizeEncounterPlan(raw, chapter, normalize) {
  const plan = normalize(raw, chapter);
  if (!plan) return null;
  for (const [index, node] of plan.nodes.entries()) {
    if (node.type !== "combat") continue;
    const tier = raw.nodes[index].tier;
    if (!forgeEnemyTiers.includes(tier)) return null;
    node.tier = tier;
  }
  if (plan.nodes.filter((node) => node.type === "combat").at(-1)?.tier !== "boss") return null;
  return plan;
}

export function forgeEncounterCombatMessages(messages, node) {
  const result = messages.map((message) => ({ ...message }));
  const tier = forgeEnemyTier(node);
  result[0].content += `

ENCOUNTER TIER: ${tier}. Preserve this planned fight and its stakes. Add top-level "tier" and a "tier":"soldier"|"elite"|"boss" on EVERY formation member. A boss encounter must contain a boss; an elite encounter must contain at least an elite. Escorts can remain soldiers. Do not turn everyone into a boss. Keep the existing formation limits, role stats and power budget; do not inflate the stat range.
For bosses, optionally add "mech": [one or two of ${forgeBossMechanics.join(", ")}]. These are existing deterministic mechanics: phases enrages below half HP; charge warns of a heavy strike; guard can be broken; summon brings reinforcements; double acts twice; immune resists control; counter retaliates; aura drains enemy energy. Prefer a readable phases/charge combination when the boss has no more specific established mechanic. No new mechanic names.
For a BOSS encounter, write 3–6 contextual top-level "dialogueCues", including an intro, a victory reaction and a defeat reaction. Elite encounters should have a few cues where the scene warrants them. Write these alongside the encounter, so they are cached once and never generated per turn. Each cue is {"speaker":"enemy-0","content":"...","type":"main","trigger":"intro"}. Speakers MUST be stable ENEMY IDs: formation index 0 is enemy-0, index 1 is enemy-1, and so on. Use only enemies actually in this formation; never invent an equipped ally or speak for the player's chosen team. A nonverbal foe can use grounded vocalizations or thoughts rather than suddenly speaking fluent dialogue. Do not invent character IDs.
Types: main, side, extra, thought, whisper. Triggers: intro, round, attack, hit, charge, phase_75, phase_50, phase_25, low_hp, victory, defeat. A round cue should add a positive integer "round". Legacy "everyNRounds" is also a positive integer selecting its FIRST eligible round: every cue plays ONCE per encounter, never as a repeating taunt. Thresholds refer to the SPEAKING enemy's HP. Keep lines concise and grounded in this encounter, with at most 24 cues. Ordinary soldier encounters may omit them.
Victory and defeat ALWAYS mean the GLOBAL PLAYER result: on victory the enemy concedes/reacts to the PLAYER winning; on defeat the enemy reacts to the PLAYER losing. Never reverse those meanings. Dialogue is presentation only: it cannot grant rewards, change actions, decide a player choice or contradict outcomeOnWin.`;
  return result;
}

export function forgeEnemyCombatMetadata(enemy, cast = []) {
  const tier = forgeEnemyTier(enemy);
  const known = forgeKnownMechanics(enemy);
  const metadata = { tier, ...(tier === "boss" ? { mech: known.length ? known : ["phases", "charge"] } : {}) };
  const name = (value) => (typeof value === "string" ? value.normalize("NFC").trim().toLowerCase() : "");
  const matches = cast.filter((actor) => !actor.prota && name(actor.name) && name(actor.name) === name(enemy?.name));
  if (matches.length === 1 && typeof matches[0].characterId === "string" && matches[0].characterId) {
    metadata.characterId = matches[0].characterId;
  }
  return metadata;
}

export function forgeNormalizeEncounterEnemy(raw, normalize) {
  const enemy = normalize(raw);
  if (!enemy || (raw.tier != null && !forgeEnemyTiers.includes(raw.tier))) return null;
  return { ...enemy, ...forgeEnemyCombatMetadata(raw) };
}

export function forgeNormalizeDialogueCues(value, enemies) {
  if (!Array.isArray(value)) return [];
  const actors = new Set(enemies.map((enemy) => enemy.id));
  const seen = new Set();
  const result = [];
  for (const cue of value.slice(0, 24)) {
    if (
      !cue ||
      !actors.has(cue.speaker) ||
      !forgeDialogueTypes.has(cue.type) ||
      !forgeDialogueTriggers.has(cue.trigger)
    ) {
      continue;
    }
    const content = typeof cue.content === "string" ? cue.content.trim() : "";
    if (!content || content.length > 600) continue;
    if (cue.round != null && (!Number.isSafeInteger(cue.round) || cue.round < 1)) continue;
    if (cue.everyNRounds != null && (!Number.isSafeInteger(cue.everyNRounds) || cue.everyNRounds < 1)) continue;
    const normalized = { speaker: cue.speaker, content, type: cue.type, trigger: cue.trigger };
    if (cue.trigger === "round") {
      if (cue.round != null) normalized.round = cue.round;
      if (cue.everyNRounds != null) normalized.everyNRounds = cue.everyNRounds;
      if (cue.round == null && cue.everyNRounds == null) normalized.round = 1;
    }
    const key = JSON.stringify(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

export function forgeNormalizeEncounterGuide(raw, maximum, normalize, node) {
  const tier = forgeEnemyTier(node);
  if (raw?.tier !== tier) return null;
  const guide = normalize(raw, maximum);
  if (!guide) return null;
  if (raw.formation.slice(0, guide.formation.length).some((enemy) => !forgeEnemyTiers.includes(enemy?.tier)))
    return null;
  const formation = guide.formation.map((enemy, index) => ({ ...enemy, id: `enemy-${index}` }));
  if (!formation.some((enemy) => enemy.tier === tier)) return null;
  if (formation.some((enemy) => forgeEnemyTiers.indexOf(enemy.tier) > forgeEnemyTiers.indexOf(tier))) return null;
  const dialogueCues = forgeNormalizeDialogueCues(raw.dialogueCues, formation);
  if (
    tier === "boss" &&
    (dialogueCues.length < 3 ||
      dialogueCues.length > 6 ||
      ["intro", "victory", "defeat"].some((trigger) => !dialogueCues.some((cue) => cue.trigger === trigger)))
  )
    return null;
  return { ...guide, tier, formation, dialogueCues };
}

export function forgeEncounterPresentation(guide, enemies) {
  const tier =
    forgeEnemyTiers[Math.max(...[guide, ...enemies].map((enemy) => forgeEnemyTiers.indexOf(forgeEnemyTier(enemy))))];
  return { tier, dialogueCues: forgeNormalizeDialogueCues(guide?.dialogueCues, enemies) };
}
