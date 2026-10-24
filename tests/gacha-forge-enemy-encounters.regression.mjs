import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  forgeEnemyTier,
  forgeEncounterPlanMessages,
  forgeNormalizeEncounterPlan,
  forgeEncounterCombatMessages,
  forgeEnemyCombatMetadata,
  forgeNormalizeEncounterEnemy,
  forgeNormalizeDialogueCues,
  forgeNormalizeEncounterGuide,
  forgeEncounterPresentation,
} from "../packages/gacha-forge/src/enemy-encounters-server.mjs";

const enemy = (extra = {}) => ({ name: "Captain Arden", stats: { hp: 70, atk: 60 }, tier: "soldier", ...extra });
const legacyEnemy = (raw) => (raw?.name ? { name: raw.name, stats: structuredClone(raw.stats) } : null);
const legacyGuide = (raw, maximum) => {
  if (!Array.isArray(raw?.formation) || !raw.formation.length) return null;
  const formation = raw.formation
    .slice(0, maximum)
    .map((rawEnemy) => forgeNormalizeEncounterEnemy(rawEnemy, legacyEnemy));
  return formation.some((unit) => !unit) ? null : { formation, outcomeOnWin: raw.outcomeOnWin };
};
const guide = (extra = {}) => ({ tier: "soldier", formation: [enemy()], outcomeOnWin: "The gate opens.", ...extra });
const cue = (extra = {}) => ({
  speaker: "enemy-0",
  content: "You made it this far.",
  type: "main",
  trigger: "intro",
  ...extra,
});
const bossCues = () => ["intro", "victory", "defeat"].map((trigger) => cue({ trigger }));
const normalizePlan = (raw) => ({ nodes: raw.nodes.map(({ type, title }) => ({ type, title })) });

test("legacy story remains soldier while old Tower mechanics retain boss identity", () => {
  assert.equal(forgeEnemyTier(enemy({ tier: undefined })), "soldier");
  assert.equal(forgeEnemyTier(enemy({ tier: undefined, mech: ["phases"] })), "boss");
  assert.equal(forgeEnemyTier(enemy({ mech: ["unknown"] })), "soldier");
  assert.equal(forgeEnemyTier(enemy({ tier: "elite", mech: ["phases"] })), "elite");
  assert.deepEqual(forgeEnemyCombatMetadata(enemy()), { tier: "soldier" });
});

test("new plans require explicit tiers and a climactic boss without changing node types/counts", () => {
  const raw = {
    nodes: [
      { type: "combat", title: "Climax", tier: "boss" },
      { type: "story", title: "After" },
    ],
  };
  const before = structuredClone(raw);
  const plan = forgeNormalizeEncounterPlan(raw, 1, normalizePlan);
  assert.equal(plan.nodes[0].type, "combat");
  assert.equal(plan.nodes[0].tier, "boss");
  assert.equal(plan.nodes.length, 2);
  assert.deepEqual(raw, before);
  assert.equal(forgeNormalizeEncounterPlan({ nodes: [{ type: "combat" }] }, 1, normalizePlan), null);
  assert.equal(forgeNormalizeEncounterPlan({ nodes: [{ type: "combat", tier: "soldier" }] }, 1, normalizePlan), null);
  assert.equal(forgeNormalizeEncounterPlan({ nodes: [{ type: "combat", tier: "god" }] }, 1, normalizePlan), null);
});

test("generation prompts preserve prior agency rules and define climax/outcome semantics", () => {
  const messages = [
    { role: "system", content: "EXISTING_CHOICE_RULES" },
    { role: "user", content: "WORLD" },
  ];
  const before = structuredClone(messages);
  const plan = forgeEncounterPlanMessages(messages);
  const combat = forgeEncounterCombatMessages(messages, { tier: "boss" });
  assert.ok(plan[0].content.startsWith("EXISTING_CHOICE_RULES"));
  assert.match(plan[0].content, /LAST combat node/u);
  assert.match(plan[0].content, /type exactly "combat"/u);
  assert.match(combat[0].content, /ENCOUNTER TIER: boss/u);
  assert.match(combat[0].content, /GLOBAL PLAYER result/u);
  assert.match(combat[0].content, /every cue plays ONCE/u);
  assert.deepEqual(messages, before);
});

test("enemy normalization preserves stats and known mechanics without inventing names", () => {
  const raw = enemy({ tier: "boss", mech: ["charge", "unknown", "charge"] });
  const normalized = forgeNormalizeEncounterEnemy(raw, legacyEnemy);
  assert.equal(normalized.name, raw.name);
  assert.deepEqual(normalized.stats, raw.stats);
  assert.deepEqual(normalized.mech, ["charge"]);
  assert.deepEqual(forgeNormalizeEncounterEnemy(enemy({ tier: "boss" }), legacyEnemy).mech, ["phases", "charge"]);
  assert.equal(forgeNormalizeEncounterEnemy(enemy({ tier: "elite", mech: ["phases"] }), legacyEnemy).mech, undefined);
  assert.equal(forgeNormalizeEncounterEnemy(enemy({ tier: "unknown" }), legacyEnemy), null);
});

test("boss intent retains the actual boss and escorts while rejecting ordinary or missing output", () => {
  const raw = guide({
    tier: "boss",
    formation: [enemy({ tier: "boss" }), enemy({ name: "Escort" })],
    dialogueCues: bossCues(),
  });
  const before = structuredClone(raw);
  const normalized = forgeNormalizeEncounterGuide(raw, 6, legacyGuide, { tier: "boss" });
  assert.equal(normalized.tier, "boss");
  assert.equal(normalized.formation[0].tier, "boss");
  assert.deepEqual(normalized.formation[0].mech, ["phases", "charge"]);
  assert.equal(normalized.formation[1].tier, "soldier");
  assert.deepEqual(
    normalized.formation.map((unit) => unit.name),
    ["Captain Arden", "Escort"],
  );
  assert.deepEqual(
    normalized.formation.map((unit) => unit.id),
    ["enemy-0", "enemy-1"],
  );
  assert.deepEqual(raw, before);
  assert.equal(forgeNormalizeEncounterGuide(guide(), 6, legacyGuide, { tier: "boss" }), null);
  assert.equal(forgeNormalizeEncounterGuide(guide({ tier: "boss" }), 6, legacyGuide, { tier: "boss" }), null);
  assert.equal(
    forgeNormalizeEncounterGuide(guide({ tier: "boss", formation: [enemy({ tier: "boss" })] }), 6, legacyGuide, {
      tier: "boss",
    }),
    null,
  );
  const invalidActor = structuredClone(raw);
  invalidActor.dialogueCues[1].speaker = "leader";
  assert.equal(forgeNormalizeEncounterGuide(invalidActor, 6, legacyGuide, { tier: "boss" }), null);
  const missingOutcome = structuredClone(raw);
  missingOutcome.dialogueCues[2].trigger = "attack";
  assert.equal(forgeNormalizeEncounterGuide(missingOutcome, 6, legacyGuide, { tier: "boss" }), null);
});

test("elite intent stays distinct and soldier guides acquire no boss mechanics or dialogue", () => {
  const elite = forgeNormalizeEncounterGuide(
    guide({ tier: "elite", formation: [enemy({ tier: "elite" })] }),
    6,
    legacyGuide,
    { tier: "elite" },
  );
  assert.equal(elite.tier, "elite");
  assert.equal(elite.formation[0].tier, "elite");
  assert.equal(elite.formation[0].mech, undefined);
  const old = forgeNormalizeEncounterGuide(guide(), 6, legacyGuide);
  assert.equal(old.tier, "soldier");
  assert.equal(old.formation[0].mech, undefined);
  assert.deepEqual(old.dialogueCues, []);
  assert.equal(forgeNormalizeEncounterGuide(guide({ tier: "unknown" }), 6, legacyGuide), null);
  assert.equal(forgeNormalizeEncounterGuide(guide({ formation: [enemy({ tier: undefined })] }), 6, legacyGuide), null);
  assert.equal(forgeNormalizeEncounterGuide(guide({ formation: [enemy({ tier: "boss" })] }), 6, legacyGuide), null);
});

test("voice mapping requires a unique actual cast name/card association", () => {
  const input = enemy({ characterId: "generated-fake-id" });
  assert.equal(forgeEnemyCombatMetadata(input).characterId, undefined);
  assert.equal(
    forgeEnemyCombatMetadata(input, [{ name: " captain ARDEN ", characterId: "real-card" }]).characterId,
    "real-card",
  );
  assert.equal(forgeEnemyCombatMetadata(input, [{ name: "Arden", characterId: "wrong-card" }]).characterId, undefined);
  assert.equal(
    forgeEnemyCombatMetadata(input, [{ name: "Captain Arden", characterId: "persona", prota: true }]).characterId,
    undefined,
  );
  assert.equal(
    forgeEnemyCombatMetadata(input, [
      { name: "Captain Arden", characterId: "one" },
      { name: "Captain Arden", characterId: "two" },
    ]).characterId,
    undefined,
  );
});

test("dialogue accepts only present stable enemy IDs and the classic cue contract", () => {
  const actors = [{ id: "enemy-0" }];
  const valid = cue({ content: "  We meet again.  ", injected: "ignored" });
  assert.deepEqual(forgeNormalizeDialogueCues([valid, valid], actors), [
    { speaker: "enemy-0", content: "We meet again.", type: "main", trigger: "intro" },
  ]);
  for (const invalid of [
    cue({ speaker: "Captain Arden" }),
    cue({ speaker: "enemy-1" }),
    cue({ speaker: "leader" }),
    cue({ content: "" }),
    cue({ type: "script" }),
    cue({ trigger: "reward" }),
    cue({ round: 0 }),
    cue({ everyNRounds: -1 }),
    null,
  ])
    assert.deepEqual(forgeNormalizeDialogueCues([invalid], actors), []);
});

test("every supported cue type/trigger is grounded, with positive round controls", () => {
  const actors = [{ id: "enemy-0" }];
  for (const type of ["main", "side", "extra", "thought", "whisper"]) {
    assert.equal(forgeNormalizeDialogueCues([cue({ type })], actors)[0].type, type);
  }
  for (const trigger of [
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
  ]) {
    assert.equal(forgeNormalizeDialogueCues([cue({ trigger })], actors)[0].trigger, trigger);
  }
  assert.equal(forgeNormalizeDialogueCues([cue({ trigger: "round" })], actors)[0].round, 1);
  assert.deepEqual(
    forgeNormalizeDialogueCues([cue({ trigger: "round", round: 2, everyNRounds: 3 })], actors)[0],
    cue({ trigger: "round", round: 2, everyNRounds: 3 }),
  );
});

test("truncated formations cannot retain dialogue from absent actors", () => {
  const raw = guide({
    formation: [enemy(), enemy({ name: "Escort" })],
    dialogueCues: [cue(), cue({ speaker: "enemy-1" })],
  });
  const normalized = forgeNormalizeEncounterGuide(raw, 1, legacyGuide);
  assert.equal(normalized.formation.length, 1);
  assert.equal(normalized.dialogueCues.length, 1);
  assert.equal(normalized.dialogueCues[0].speaker, "enemy-0");
});

test("presentation normalizes old cached guides without modifying them", () => {
  const raw = guide();
  const before = structuredClone(raw);
  assert.deepEqual(forgeEncounterPresentation(raw, [{ id: "enemy-0" }]), { tier: "soldier", dialogueCues: [] });
  assert.deepEqual(raw, before);
});

test("boss allowlist and canonical packet use existing deterministic mechanics only", () => {
  const server = readFileSync(new URL("../packages/gacha-forge/server.mjs", import.meta.url), "utf8");
  const mechanics = JSON.parse(server.match(/Ak=(\[[^\]]+\])/u)[1]);
  assert.deepEqual(forgeEnemyCombatMetadata(enemy({ tier: "boss", mech: mechanics })).mech, mechanics);
  const packetFields = JSON.parse(server.match(/D=(\["id","name","role","affinity"[^\]]+\])/u)[1]);
  assert.ok(packetFields.includes("mech"));
  assert.ok(packetFields.includes("healAs"));
  assert.ok(!packetFields.includes("dialogueCues"));
  assert.ok(!packetFields.includes("tier"));
});
