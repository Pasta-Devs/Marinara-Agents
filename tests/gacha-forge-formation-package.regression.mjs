// Actual package registration, HTTP routes, frozen snapshots and controlled provider transport.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createChapterRuntime, chapterRunId, chapterUnitId } from "./fixtures/gacha-forge-chapter-runtime.mjs";
import {
  normalizeForgeFormationKit,
  replayForgeFormationBattle,
} from "../packages/gacha-forge/src/formation-combat-shared.mjs";

const kit = () => ({
  version: 1,
  preferredRow: "front",
  standard: {
    name: "Formation strike",
    description: "An elemental strike.",
    effect: "damage",
    target: "enemy",
    power: 300,
    cost: 0,
    duration: 2,
  },
  ultimate: {
    name: "Elemental finale",
    description: "A decisive finale.",
    effect: "damage",
    target: "enemy",
    power: 300,
    cost: 4,
    elementCost: 2,
    duration: 2,
  },
  passive: {
    name: "Resolve",
    description: "Stay steady.",
    effect: "shield",
    target: "self",
    power: 0,
    duration: 2,
    row: "both",
    trigger: "turn_start",
  },
  traits: [],
});
const rawUnit = (id, name = "Mari") => ({
  unitId: id,
  kind: "character",
  name,
  rarity: 5,
  role: "Warrior",
  affinity: "Fire",
  position: "front",
  identitySex: "female",
  stats: { hp: 100, atk: 100, def: 100, spd: 100 },
  skill: { name: "Classic strike", effect: "damage", target: "enemy", power: 100, description: "Classic." },
  passive: {
    name: "Classic resolve",
    effect: "shield",
    target: "self",
    power: 0,
    trigger: "battle_start",
    description: "Classic.",
  },
  formationKit: kit(),
  appearance: "A blue coat.",
  personality: "Patient.",
  description: "A lighthouse keeper.",
});
async function fixture(mode = "formation") {
  const f = await createChapterRuntime();
  // The public Engine transaction contract serializes commits. The story fixture's
  // original rollback helper needs that serialization when three kit workers race.
  const transact = f.persistence.transaction;
  let tail = Promise.resolve();
  f.persistence.transaction = (operation) => {
    const pending = tail.then(() => transact(operation));
    tail = pending.catch(() => {});
    return pending;
  };
  const run = f.docs.get("index").data.runs[0];
  run.combat = { mode, revision: 0 };
  const heroId = `${chapterRunId}:unit:protagonist`,
    weaponId = `${chapterRunId}:unit:protagonist-weapon`;
  f.seed(heroId, "unit", { ...rawUnit(heroId), isProtagonist: true });
  f.seed(chapterUnitId, "unit", rawUnit(chapterUnitId, "Arden"));
  f.seed(weaponId, "unit", {
    kind: "weapon",
    name: "Kept blade",
    rarity: 5,
    weaponType: "blade",
    mainStat: { key: "atk", value: 1 },
    subStat: { key: "crit", value: 0 },
  });
  const session = f.session();
  session.roster[heroId] = { level: 100, weapon: weaponId };
  session.roster[weaponId] = { level: 1 };
  session.wallet.vigor = 1000;
  session.progress = { 1: { normal: 10 }, 2: { normal: 4 } };
  session.presets = [{ name: "Kept team", board: { front: ["leader", null, null], back: [null, null, null] } }];
  session.activePreset = 0;
  f.seed(`${chapterRunId}:combat:2:1`, "combat", {
    chapter: 2,
    combatIndex: 1,
    enemy: "Gate sentinel",
    opening: "A sentinel blocks the gate.",
    objective: "Defeat the sentinel.",
    outcomeOnWin: "The gate opens.",
    formation: [
      {
        name: "Sentinel",
        role: "Warrior",
        affinity: "Earth",
        position: "front",
        tier: "boss",
        stats: { hp: 1, atk: 1, def: 1, spd: 1 },
        skill: { name: "Strike", effect: "damage", target: "enemy", power: 100, description: "A strike." },
        formationKit: kit(),
        mech: ["phases"],
      },
    ],
    dialogueCues: [{ speaker: "enemy-0", content: "You shall not pass.", type: "main", trigger: "intro" }],
  });
  return { ...f, run, heroId, weaponId };
}
const request = { chapter: 2, combatIndex: 1, difficulty: "normal" };

test("actual new-world creation preserves Formation and defaults to Classic without converting units", async () => {
  const f = await fixture();
  try {
    for (const mode of ["formation", undefined]) {
      const created = await f.post("/run", {
        name: "New combat world",
        scenario: "A lighthouse garden.",
        connectionId: f.run.connectionId,
        protagonist: { name: "Mari" },
        storyNow: false,
        ...(mode ? { combat: { mode } } : {}),
      });
      assert.equal(created.status, 200);
      assert.equal(created.body.ok, true, JSON.stringify(created.body));
      assert.deepEqual(created.body.run.combat, { mode: mode || "classic", revision: 0 });
      const saved = f.docs.get("index").data.runs.find((run) => run.runId === created.body.run.runId);
      assert.deepEqual(saved.combat, created.body.run.combat);
    }
    assert.ok(
      !f.calls.some((call) =>
        call.body.messages.some((message) =>
          message.content.includes("Design a distinctive, balanced kit for Formation combat"),
        ),
      ),
      "selecting a new world's mode does not launch the existing-world unit conversion",
    );
  } finally {
    await f.close();
  }
});

test("actual battle view/start and completion replay Formation with existing boss dialogue and one reward", async () => {
  const f = await fixture();
  try {
    const view = (await f.post("/battle", request)).body;
    assert.equal(view.ok, true, JSON.stringify(view));
    assert.equal(view.combatMode, "formation");
    assert.ok(normalizeForgeFormationKit(view.allies[0].formationKit));
    assert.equal(view.dialogueCues[0].content, "You shall not pass.");
    const start = (await f.post("/battle/start", request)).body;
    assert.equal(start.ok, true, JSON.stringify(start));
    const pending = structuredClone(f.session().combatPending);
    assert.equal(pending.fight.combatMode, "formation");
    const played = replayForgeFormationBattle(pending.fight);
    assert.equal(played.result, "win");
    const won = (await f.post("/complete", { ...request, nodeIndex: 4, log: played.log })).body;
    assert.equal(won.ok, true, JSON.stringify(won));
    const wallet = structuredClone(f.session().wallet);
    const replay = (await f.post("/complete", { ...request, nodeIndex: 4, log: played.log })).body;
    assert.equal(replay.ok, true);
    assert.deepEqual(f.session().wallet, wallet);
    assert.equal(f.session().combatPending, null);
  } finally {
    await f.close();
  }
});

test("Classic remains selected by default and frozen legacy snapshots ignore later run mode metadata", async () => {
  const f = await fixture("classic");
  try {
    delete f.run.combat;
    const view = (await f.post("/battle", request)).body;
    assert.equal(view.ok, true, JSON.stringify(view));
    assert.equal(view.combatMode, "classic");
    assert.equal((await f.post("/battle/start", request)).body.ok, true);
    assert.equal(f.session().combatPending.fight.combatMode, "classic");
    f.run.combat = { mode: "formation" };
    const claimed = (await f.post("/complete", { ...request, nodeIndex: 4, log: [] })).body;
    assert.equal(claimed.ok, true, JSON.stringify(claimed));
  } finally {
    await f.close();
  }
});

test("oversized and back-only teams are rejected without spending Vigor or deleting saved slots", async () => {
  const f = await fixture();
  try {
    for (let index = 1; index <= 4; index += 1) {
      const id = `${chapterRunId}:unit:extra${index}`;
      f.seed(id, "unit", rawUnit(id));
      f.session().roster[id] = { level: 1 };
    }
    const ids = [1, 2, 3, 4].map((index) => `${chapterRunId}:unit:extra${index}`);
    f.session().presets[0].board = { front: ["leader", ids[0], ids[1]], back: [ids[2], ids[3], null] };
    const before = structuredClone(f.session());
    const result = (await f.post("/battle/start", request)).body;
    assert.equal(result.error, "formation-team-size");
    assert.deepEqual(f.session(), before);
    f.session().presets[0].board = { front: [null, null, null], back: ["leader", null, null] };
    assert.equal((await f.post("/battle/start", request)).body.error, "formation-rows");
    assert.equal(f.session().wallet.vigor, before.wallet.vigor);
  } finally {
    await f.close();
  }
});

test("the actual conversion route uses the same model and commits additive kits with authored canon", async () => {
  const f = await fixture("classic");
  try {
    const before = structuredClone(f.docs.get(chapterUnitId).data);
    delete f.docs.get(chapterUnitId).data.formationKit;
    delete f.docs.get(f.heroId).data.formationKit;
    f.docs.get(chapterUnitId).data.cardId = "chapter-proof-arden-card";
    f.transport.stage = "formation";
    f.transport.reply = () => JSON.stringify(kit());
    const started = (await f.post("/combat-mode/switch", { targetMode: "formation", confirmed: true })).body;
    assert.equal(started.ok, true, JSON.stringify(started));
    let state;
    for (let index = 0; index < 100; index += 1) {
      state = (await f.post("/combat-mode/status")).body;
      if (["committed", "failed"].includes(state.conversion?.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(state.conversion.status, "committed", JSON.stringify(state));
    assert.equal(state.combat.mode, "formation");
    const updated = f.docs.get(chapterUnitId).data;
    assert.equal(updated.skill.name, before.skill.name);
    assert.equal(updated.appearance, before.appearance);
    assert.ok(normalizeForgeFormationKit(updated.formationKit));
    const prompts = f.calls.filter((call) =>
      call.body.messages[0].content.includes("Design a distinctive, balanced kit"),
    );
    assert.equal(prompts.length, 2);
    assert.ok(prompts.some((call) => JSON.stringify(call.body.messages).includes("CURRENT_AUTHORED_CARD_CANON")));
    assert.ok(prompts.every((call) => !JSON.stringify(call.body.messages).includes("DISALLOWED_CARD_SCENARIO")));
  } finally {
    await f.close();
  }
});

test("Materials and Tower freeze Formation snapshots and verify their own action logs", async () => {
  const f = await fixture();
  try {
    const farm = { stage: "funds", difficulty: 1 };
    const view = (await f.post("/farm/battle", farm)).body;
    assert.equal(view.ok, true, JSON.stringify(view));
    assert.equal(view.combatMode, "formation");
    assert.equal((await f.post("/farm/start", farm)).body.ok, true);
    const farmFight = f.session().farmPending.fight;
    assert.equal(farmFight.combatMode, "formation");
    const farmReplay = replayForgeFormationBattle(farmFight);
    assert.equal(farmReplay.result, "win");
    const claim = (await f.post("/farm/claim", { log: farmReplay.log })).body;
    assert.equal(claim.ok, true, JSON.stringify(claim));
    assert.equal(f.session().farmPending, null);
    const tower = { floor: 1, part: 0 };
    const towerView = (await f.post("/tower/battle", tower)).body;
    assert.equal(towerView.ok, true, JSON.stringify(towerView));
    assert.equal(towerView.combatMode, "formation");
    assert.equal((await f.post("/tower/start", tower)).body.ok, true);
    const towerFight = f.session().towerPending.fight;
    assert.equal(towerFight.combatMode, "formation");
    const towerReplay = replayForgeFormationBattle(towerFight);
    assert.equal(towerReplay.result, "win");
    const towerClaim = (await f.post("/tower/claim", { log: towerReplay.log })).body;
    assert.equal(towerClaim.ok, true, JSON.stringify(towerClaim));
    assert.equal(f.session().towerPending, null);
  } finally {
    await f.close();
  }
});

test("boss objectives reach frozen snapshots and an impossible elemental team is refused before charging", async () => {
  const f = await fixture();
  try {
    const guide = f.docs.get(`${chapterRunId}:combat:2:1`).data;
    guide.formation.push({ ...structuredClone(guide.formation[0]), name: "Captain" });
    guide.formationRules = [
      { kind: "defeat_order", description: "Defeat the sentinel, then the captain.", order: [0, 1] },
    ];
    const view = (await f.post("/battle", request)).body;
    assert.equal(view.ok, true, JSON.stringify(view));
    assert.deepEqual(view.formationRules, guide.formationRules);
    assert.equal((await f.post("/battle/start", { ...request, expectedCombatMode: "formation" })).body.ok, true);
    const fight = f.session().combatPending.fight;
    assert.deepEqual(fight.formationRules, guide.formationRules);
    const played = replayForgeFormationBattle(fight);
    assert.deepEqual(
      played.steps
        .flatMap((step) => step.events)
        .filter((event) => event.op === "death")
        .map((event) => event.id),
      ["enemy-0", "enemy-1"],
    );
    f.session().combatPending = null;
    guide.formationRules = [
      { kind: "element_barrier", description: "Only Water breaks the barrier.", elements: ["water"] },
    ];
    const vigor = f.session().wallet.vigor;
    assert.equal((await f.post("/battle", request)).body.error, "formation-element-required");
    assert.equal((await f.post("/battle/start", request)).body.error, "formation-element-required");
    assert.equal(f.session().wallet.vigor, vigor);
    assert.equal(f.session().combatPending, null);
  } finally {
    await f.close();
  }
});

test("a claimed win cannot override the server replay of a lost Formation fight", async () => {
  const f = await fixture();
  try {
    const hero = f.docs.get(f.heroId).data;
    hero.stats = { hp: 1, atk: 1, def: 1, spd: 1 };
    f.session().roster[f.heroId].level = 1;
    f.docs.get(`${chapterRunId}:combat:2:1`).data.formation[0].stats = { hp: 100, atk: 100, def: 100, spd: 100 };
    assert.equal((await f.post("/battle/start", request)).body.ok, true);
    assert.equal(replayForgeFormationBattle(f.session().combatPending.fight).result, "lose");
    const wallet = structuredClone(f.session().wallet),
      progress = structuredClone(f.session().progress);
    const response = (await f.post("/complete", { ...request, nodeIndex: 4, log: [], outcome: "win", result: "win" }))
      .body;
    assert.equal(response.error, "lost");
    assert.deepEqual(f.session().wallet, wallet);
    assert.deepEqual(f.session().progress, progress);
  } finally {
    await f.close();
  }
});
