// Actual combined Seasonal/Formation SDK routes with controlled documents and no remote provider.
// Uses the real activated package SDK. A seeded, already-written event reaches the combat join without replaying overview/story tests.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createChapterRuntime,
  chapterRunId as runId,
  chapterUnitId as unitId,
  freshMainPlan,
} from "./fixtures/gacha-forge-chapter-runtime.mjs";
import {
  FORGE_FORMATION_ENGINE,
  FORGE_FORMATION_RULES,
  FORGE_FORMATION_KIT_PROMPT,
  forgeFormationEnemyKit,
  replayForgeFormationBattle,
} from "../packages/gacha-forge/src/formation-combat-shared.mjs";

async function fixture() {
  const f = await createChapterRuntime();
  // Match the real public transaction's serialized commit behavior for conversion workers.
  const transaction = f.persistence.transaction;
  let tail = Promise.resolve();
  f.persistence.transaction = (operation) => {
    const next = tail.then(() => transaction(operation));
    tail = next.catch(() => {});
    return next;
  };
  const run = f.docs.get("index").data.runs[0];
  run.combat = { mode: "formation", revision: 0 };
  run.story.seasonalEvents = true;
  const hero = {
    ...f.docs.get(unitId).data,
    name: "Arden",
    kind: "character",
    rarity: 5,
    role: "Mage",
    affinity: "Fire",
    stats: { hp: 100, atk: 100, def: 100, spd: 100 },
    skill: { name: "Flare", effect: "damage", power: 100, target: "enemy", description: "A clear flame." },
  };
  hero.formationKit = forgeFormationEnemyKit(hero);
  hero.formationKitPrompt = FORGE_FORMATION_KIT_PROMPT;
  f.seed(unitId, "unit", hero);
  const leaderId = `${runId}:unit:protagonist`;
  f.seed(leaderId, "unit", { ...hero, cardId: "", name: "Mari", isProtagonist: true });
  const weaponId = `${runId}:unit:protagonist-weapon`;
  f.seed(weaponId, "unit", {
    kind: "weapon",
    name: "Kept blade",
    rarity: 5,
    weaponType: "blade",
    mainStat: { key: "atk", value: 1 },
    subStat: { key: "crit", value: 0 },
  });
  f.seed(`${runId}:combat-art`, "combat-art", { effigies: { byKey: {}, hasArt: false } });
  const session = f.session();
  session.roster[unitId].level = 100;
  session.roster[leaderId] = { level: 100, weapon: weaponId };
  session.roster[weaponId] = { level: 1 };
  session.wallet.vigor = 1000;
  session.presets = [{ name: "Fixture", board: { front: [unitId, null, null], back: [leaderId, null, null] } }];
  session.activePreset = 0;
  session.progress["event-1"] = { normal: 1 };
  f.seed(`${runId}:story-event:1`, "story-event", {
    seq: 1,
    chapter: "event-1",
    state: "ready",
    title: "The lantern trial",
    theme: "Friends keep the coast alight.",
    premise: "A friendly festival trial.",
    cast: [unitId],
    after: 1,
    opened: Date.now(),
    endsAt: Date.now() + 86400000,
    rewards: [{ nodeIndex: 1, kind: "funds", qty: 5000 }],
  });
  f.seed(`${runId}:chapter:event-1`, "chapter-plan", { ...freshMainPlan, chapter: "event-1", after: 1 });
  const enemy = { ...hero, cardId: "", name: "Sentinel", position: "front", stats: { hp: 1, atk: 1, def: 1, spd: 1 } };
  f.seed(`${runId}:combat:event-1:0`, "combat", {
    chapter: "event-1",
    combatIndex: 0,
    enemy: "Sentinel",
    opening: "Fire opens the festival ward.",
    objective: "Break the Fire ward and defeat the sentinel.",
    outcomeOnWin: "The procession continues.",
    formation: [enemy],
    formationRules: [{ kind: "element_barrier", elements: ["fire"], description: "Only Fire breaks the ward." }],
    dialogueCues: [{ speaker: "enemy-0", content: "Keep the lantern burning.", type: "main", trigger: "intro" }],
  });
  return f;
}
const request = { chapter: "event-1", combatIndex: 0 };
const engine = { expectedFormationEngine: FORGE_FORMATION_ENGINE, expectedFormationRules: FORGE_FORMATION_RULES };

test("actual event routes freeze Formation mode and rules, replay its choices, and grant the event reward once", async () => {
  const f = await fixture();
  try {
    const view = (await f.post("/story-event/battle", { ...request, ...engine })).body;
    assert.equal(view.ok, true, JSON.stringify(view));
    assert.equal(view.combatMode, "formation");
    assert.equal(view.formationRules[0].kind, "element_barrier");
    assert.equal(view.dialogueCues[0].content, "Keep the lantern burning.");
    const wallet = structuredClone(f.session().wallet);
    assert.equal(
      (await f.post("/story-event/battle/start", { ...request, ...engine, expectedCombatMode: "classic" })).body.error,
      "changed",
    );
    assert.deepEqual(f.session().wallet, wallet);
    assert.equal(
      (await f.post("/story-event/battle/start", { ...request, ...engine, expectedCombatMode: "formation" })).body.ok,
      true,
    );
    const snapshot = structuredClone(f.session().combatPending.fight);
    assert.equal(snapshot.combatMode, "formation");
    assert.deepEqual(snapshot.formationRules, view.formationRules);
    assert.equal(
      (await f.post("/combat-mode/switch", { targetMode: "classic", confirmed: true })).body.error,
      "combat-in-progress",
    );
    const played = replayForgeFormationBattle(snapshot);
    assert.equal(played.result, "win");
    const complete = { chapter: "event-1", nodeIndex: 1, log: played.log };
    assert.equal((await f.post("/story-event/complete", complete)).body.ok, true);
    assert.equal(f.session().wallet.funds, wallet.funds + 5000);
    const finished = structuredClone(f.session());
    assert.equal((await f.post("/story-event/complete", complete)).body.cached, true);
    assert.deepEqual(f.session(), finished);
  } finally {
    await f.close();
  }
});

for (const reason of ["expired", "disabled"])
  test(`confirmed mode conversion retires the ${reason} event fight without reward or regeneration`, async () => {
    const f = await fixture();
    try {
      assert.equal((await f.post("/story-event/battle/start", { ...request, ...engine })).body.ok, true);
      const wallet = structuredClone(f.session().wallet);
      if (reason === "expired") f.docs.get(`${runId}:story-event:1`).data.endsAt = Date.now() - 1;
      else f.docs.get("index").data.runs[0].story.seasonalEvents = false;
      const pending = structuredClone(f.session().combatPending);
      assert.equal((await f.post("/combat-mode/switch", { targetMode: "classic" })).body.ok, false);
      assert.deepEqual(f.session().combatPending, pending, "No retirement before confirmation");
      const calls = f.calls.length;
      assert.equal((await f.post("/combat-mode/switch", { targetMode: "classic", confirmed: true })).body.ok, true);
      for (let attempt = 0; attempt < 100 && f.docs.get("index").data.runs[0].combat.mode !== "classic"; attempt++)
        await new Promise((resolve) => setImmediate(resolve));
      assert.equal(f.docs.get("index").data.runs[0].combat.mode, "classic");
      assert.ok(!f.session().combatPending);
      assert.equal(f.session().progress["event-1"].normal, 1);
      assert.deepEqual(f.session().wallet, wallet);
      assert.equal(f.calls.length, calls);
    } finally {
      await f.close();
    }
  });

test("a finished event's Hard fight in Formation is the saved fight, seated and scaled, paid once with no model call", async () => {
  const f = await fixture();
  try {
    // The same fight on Normal (its reached node), for its scale.
    const normal = (await f.post("/story-event/battle", { ...request, ...engine })).body;
    assert.equal(normal.ok, true, JSON.stringify(normal));
    f.session().progress["event-1"] = { normal: 10 };
    const calls = f.calls.length;
    f.transport.reply = () => {
      throw new Error("An event's Hard fight must not call a model");
    };
    const hard = { ...request, ...engine, difficulty: "hard" };
    const view = (await f.post("/story-event/battle", hard)).body;
    assert.equal(view.ok, true, JSON.stringify(view));
    assert.deepEqual(
      { mode: view.combatMode, difficulty: view.difficulty, cp: view.cp, rule: view.formationRules[0].kind },
      { mode: "formation", difficulty: "hard", cp: 3000, rule: "element_barrier" },
    );
    assert.equal(view.enemies[0].name, "Sentinel");
    assert.ok(view.enemies[0].formation, "Formation seats the scaled enemy");
    const ratio = view.enemies[0].power / normal.enemies[0].power;
    assert.ok(ratio > 1.45 && ratio < 1.55, `Hard calibrates the enemy to 1.5 times Normal's power (${ratio})`);
    const wallet = structuredClone(f.session().wallet);
    assert.equal(
      (await f.post("/story-event/battle/start", { ...hard, expectedCombatMode: "formation" })).body.ok,
      true,
    );
    const snapshot = structuredClone(f.session().combatPending.fight);
    assert.equal(snapshot.combatMode, "formation");
    assert.equal(f.session().combatPending.difficulty, "hard");
    const played = replayForgeFormationBattle(snapshot);
    assert.equal(played.result, "win");
    const complete = { chapter: "event-1", nodeIndex: 0, difficulty: "hard", log: played.log };
    const won = (await f.post("/story-event/complete", complete)).body;
    assert.equal(won.ok, true, JSON.stringify(won));
    assert.deepEqual({ funds: won.reward.funds, aether: won.reward.aether }, { funds: 750, aether: 150 });
    assert.equal(f.session().wallet.funds, wallet.funds + 750);
    assert.deepEqual(f.session().progress["event-1"], { normal: 10, hard: 1 });
    const finished = structuredClone(f.session());
    assert.equal((await f.post("/story-event/complete", complete)).body.cached, true);
    assert.deepEqual(f.session(), finished);
    assert.equal((await f.post("/story-event/battle", hard)).body.error, "event-already-played");
    assert.equal(f.calls.length, calls);
  } finally {
    await f.close();
  }
});
