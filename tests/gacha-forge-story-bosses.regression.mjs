// Exercise the shipped routes and deterministic combat replay. Only the Engine host is faked:
// fixture model replies, isolated revision-checked documents, and read-only connection metadata.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { pathToFileURL } from "node:url";

const packageId = "gacha-forge";
const runId = "story-boss-regression";
const sessionId = `${runId}:session`;
const chapterId = `${runId}:chapter:1`;
const guideId = `${runId}:combat:1:2`;
const heroId = `${runId}:unit:protagonist`;
const weaponId = `${runId}:unit:protagonist-weapon`;
const clone = (value) => structuredClone(value);
const skill = { name: "Strike", effect: "damage", power: 100, target: "enemy", description: "A clean hit." };
const enemy = (name, tier) => ({
  name,
  ...(tier ? { tier } : {}),
  role: "Warrior",
  affinity: "Fire",
  position: "front",
  stats: { hp: 30, atk: 30, def: 30, spd: 30 },
  skill,
});
const plan = () => ({
  chapter: 1,
  title: "The occupied gate",
  premise: "Reach the gate, face its defenders, and confront their captain.",
  nodes: Array.from({ length: 10 }, (_, index) => {
    const tier = { 1: "soldier", 4: "elite", 8: "boss" }[index];
    return tier
      ? { index: index + 1, type: "combat", title: `${tier} encounter`, setup: `Face the gate's ${tier}.`, tier }
      : { index: index + 1, type: "story", title: `Scene ${index + 1}`, goal: "Reach the gate", guide: "Continue." };
  }),
});
const cues = [
  { speaker: "enemy-0", content: "You have reached my gate.", type: "main", trigger: "intro" },
  { speaker: "enemy-0", content: "The gate is yours.", type: "whisper", trigger: "victory" },
  { speaker: "enemy-0", content: "You will go no farther.", type: "side", trigger: "defeat" },
];
const guide = () => ({
  enemy: "Gate Captain",
  tier: "boss",
  opening: "The captain blocks the gate.",
  objective: "Defeat the captain.",
  outcomeOnWin: "The gate opens and its defenders surrender.",
  formation: [{ ...enemy("Gate Captain", "boss"), mech: ["phases", "charge"] }],
  dialogueCues: clone(cues),
});
const legacyPlan = () => {
  const value = plan();
  for (const node of value.nodes) delete node.tier;
  return value;
};
const legacyGuide = () => {
  const value = guide();
  delete value.tier;
  delete value.dialogueCues;
  for (const actor of value.formation) {
    delete actor.tier;
    delete actor.mech;
  }
  return value;
};

const directory = await mkdtemp(join(tmpdir(), "marinara-forge-story-bosses-"));
const modulePath = join(directory, "server.mjs");
const source = await readFile(new URL("../packages/gacha-forge/server.mjs", import.meta.url), "utf8");
// Existing regressions expose a bundled internal in a disposable copy. This leaves the real
// activation, route handlers, packet whitelist, and replay implementation byte-for-byte intact.
await writeFile(modulePath, `${source}\nexport { Gm as replayCombat };\n`);
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = new URL(input);
  assert.equal(url.pathname, "/api/connections", `No provider or unrelated Engine request: ${url.pathname}`);
  return {
    ok: true,
    json: async () => [{ id: "fixture-model", provider: "fixture", model: "fixture-only", maxContext: 128000 }],
  };
};
after(async () => {
  globalThis.fetch = originalFetch;
  await rm(directory, { recursive: true, force: true });
});

let sequence = 0;
async function harness({ chapter = plan(), combat, progress = {}, session = {} } = {}) {
  const docs = new Map();
  const routes = new Map();
  const calls = [];
  const replies = [];
  const seed = (id, kind, data) => {
    docs.set(id, { id, packageId, kind, name: id, revision: 1, data: clone(data) });
  };
  seed("index", "index", {
    activeRunId: runId,
    runs: [
      {
        runId,
        name: "Story boss fixture",
        scenario: "The occupied gate and its captain.",
        protagonist: { name: "Mari" },
        connectionId: "fixture-model",
        images: { enabled: false, connectionId: "" },
        story: { choices: false, preforge: "off" },
      },
    ],
  });
  seed(sessionId, "session", {
    account: { level: 100, xp: 0 },
    roster: { [heroId]: { level: 100, weapon: weaponId }, [weaponId]: { level: 1 } },
    wallet: { funds: 12345, aether: 42, vigor: 1000 },
    progress,
    ...session,
  });
  seed(heroId, "unit", {
    ...enemy("Mari"),
    unitId: heroId,
    kind: "character",
    rarity: 5,
    isProtagonist: true,
    stats: { hp: 100, atk: 100, def: 100, spd: 100 },
  });
  seed(weaponId, "unit", { unitId: weaponId, kind: "weapon", rarity: 5, name: "Fixture blade", stats: {} });
  seed(`${runId}:relics`, "relics", { items: {} });
  seed(`${runId}:combat-art`, "combat-art", { effigies: { byKey: {}, hasArt: false } });
  if (chapter) seed(chapterId, "chapter-plan", chapter);
  if (combat) seed(guideId, "combat", { chapter: 1, combatIndex: 2, ...combat });
  const documents = {
    async getById(id, documentId) {
      assert.equal(id, packageId);
      return clone(docs.get(documentId) ?? null);
    },
    async list(id, kind) {
      assert.equal(id, packageId);
      return clone([...docs.values()].filter((doc) => !kind || doc.kind === kind));
    },
    async create(document) {
      assert.equal(document.packageId, packageId);
      assert.ok(!docs.has(document.id), "Creating a guide must not overwrite an existing save");
      const saved = { ...clone(document), revision: 1 };
      docs.set(document.id, saved);
      return clone(saved);
    },
    async update(document) {
      assert.equal(document.packageId, packageId);
      const current = docs.get(document.id);
      if (!current || current.revision !== document.expectedRevision) return null;
      const saved = { ...current, ...clone(document), revision: current.revision + 1 };
      delete saved.expectedRevision;
      docs.set(document.id, saved);
      return clone(saved);
    },
    async remove(id, documentId, revision) {
      assert.equal(id, packageId);
      return docs.get(documentId)?.revision === revision && docs.delete(documentId);
    },
  };
  const bundled = await import(`${pathToFileURL(modulePath).href}?case=${sequence++}`);
  await bundled.activate({
    package: { id: packageId, version: "fixture" },
    api: {
      runtime: {
        persistence: { documents },
        logger: { info() {}, warn() {}, error() {}, debug() {} },
        json: { parseJsonish: JSON.parse },
        languageModels: {
          async resolveForRequest({ connectionId }) {
            assert.equal(connectionId, "fixture-model");
            return {
              connectionId,
              model: "fixture-only",
              async chatComplete(messages) {
                calls.push(clone(messages));
                assert.ok(replies.length, "Every model request needs an explicit fixture reply");
                return { content: JSON.stringify(replies.shift()), finishReason: "stop" };
              },
            };
          },
        },
      },
      async registerPrivilegedRoutes(register) {
        await register({
          get(path, handler) {
            routes.set(`GET ${path}`, handler);
          },
          post(path, handler) {
            routes.set(`POST ${path}`, handler);
          },
        });
      },
    },
  });
  return {
    calls,
    replies,
    seed,
    replay: bundled.replayCombat,
    data: (id) => clone(docs.get(id)?.data),
    async post(path, body = {}) {
      const route = routes.get(`POST ${path}`);
      assert.ok(route, `The shipped server registers POST ${path}`);
      return route({ body: { runId, ...clone(body) } });
    },
  };
}
const ok = (result) => assert.equal(result.ok, true, JSON.stringify(result));
const prompt = (host) =>
  host.calls
    .at(-1)
    .map((message) => message.content)
    .join("\n");
const battleRequest = { chapter: 1, combatIndex: 2, difficulty: "normal" };

await test("chapter planner retains Soldier, Elite, and the climactic Boss before the closing scene", async () => {
  const host = await harness({ chapter: null });
  host.replies.push(plan());
  const response = await host.post("/chapter-plan", { chapter: 1 });
  ok(response);
  assert.deepEqual(
    response.plan.nodes.filter((node) => node.type === "combat").map((node) => node.tier),
    ["soldier", "elite", "boss"],
  );
  assert.equal(response.plan.nodes.at(-1).type, "story");
  assert.match(prompt(host), /climactic BOSS/u);
  assert.deepEqual(host.data(chapterId), response.plan);
});

await test("combat guide caches validated tiers, boss mechanics, and actor-grounded cues without another call", async () => {
  const host = await harness();
  host.replies.push(guide());
  const first = await host.post("/combat-guide", battleRequest);
  ok(first);
  assert.equal(first.guide.tier, "boss");
  assert.equal(first.guide.formation[0].tier, "boss");
  assert.equal(first.guide.formation[0].id, "enemy-0");
  assert.deepEqual(first.guide.formation[0].mech, ["phases", "charge"]);
  assert.deepEqual(first.guide.dialogueCues, cues);
  assert.match(prompt(host), /GLOBAL PLAYER result/u);
  const second = await host.post("/combat-guide", battleRequest);
  ok(second);
  assert.equal(second.cached, true);
  assert.deepEqual(second.guide, first.guide);
  assert.deepEqual(host.data(guideId), first.guide);
  assert.equal(host.calls.length, 1);
});

await test("battle presentation preserves boss mechanics while the same verified action log yields the same rewards", async () => {
  const rich = guide();
  const plain = guide();
  delete plain.dialogueCues;
  const first = await harness({ combat: rich, progress: { 1: { normal: 8 } } });
  const second = await harness({ combat: plain, progress: { 1: { normal: 8 } } });
  const displayed = await first.post("/battle", battleRequest);
  ok(displayed);
  assert.equal(displayed.tier, "boss");
  assert.deepEqual(displayed.dialogueCues, cues);
  assert.equal(displayed.enemies[0].tier, "boss");
  assert.deepEqual(displayed.enemies[0].mech, ["phases", "charge"]);
  for (const host of [first, second]) ok(await host.post("/battle/start", battleRequest));
  const packet = first.data(sessionId).combatPending.fight;
  assert.deepEqual(packet, second.data(sessionId).combatPending.fight);
  assert.deepEqual(packet.enemies[0].mech, ["phases", "charge"]);
  for (const actor of packet.enemies) {
    for (const presentation of ["tier", "dialogueCues", "characterId"])
      assert.equal(Object.hasOwn(actor, presentation), false);
  }
  const baseline = first.replay(clone(packet), []);
  assert.equal(baseline.result, "win", "The strong fixture hero wins deterministically");
  assert.ok(baseline.log.length > 0, "Submit actual player actions, not a forged outcome");
  const submitted = clone(baseline.log);
  assert.deepEqual(first.replay(clone(packet), submitted), baseline);
  const complete = { chapter: 1, difficulty: "normal", nodeIndex: 8, log: submitted };
  const settled = await first.post("/complete", complete);
  const comparison = await second.post("/complete", complete);
  ok(settled);
  ok(comparison);
  assert.deepEqual(settled.reward, comparison.reward);
  assert.deepEqual(settled.rank, comparison.rank);
  assert.deepEqual(settled.progress, comparison.progress);
  assert.equal(settled.progress[1].normal, 9);
  assert.ok(settled.reward.funds > 0);
  assert.deepEqual(submitted, baseline.log, "Settlement does not rewrite the submitted actions");
  assert.equal(first.calls.length + second.calls.length, 0);
});

await test("cached legacy plans and guides remain readable without regeneration or lost progress", async () => {
  const chapter = legacyPlan();
  const combat = legacyGuide();
  const progress = { 1: { normal: 8, hard: 2 } };
  const host = await harness({ chapter, combat, progress, session: { stats: { untouched: 91 } } });
  const before = host.data(sessionId);
  const planned = await host.post("/chapter-plan", { chapter: 1 });
  const cached = await host.post("/combat-guide", battleRequest);
  ok(planned);
  ok(cached);
  assert.equal(planned.cached, true);
  assert.equal(cached.cached, true);
  assert.deepEqual(planned.plan, chapter);
  assert.deepEqual(cached.guide, { chapter: 1, combatIndex: 2, ...combat });
  assert.deepEqual(host.data(sessionId), before);
  const battle = await host.post("/battle", battleRequest);
  ok(battle);
  assert.equal(battle.enemies[0].name, combat.formation[0].name);
  assert.deepEqual(host.data(sessionId).progress, progress);
  assert.equal(host.data(sessionId).stats.untouched, 91);
  assert.equal(host.calls.length, 0);
});

await test("the existing Tower boss keeps its legacy mechanics without model generation", async () => {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const host = await harness({ session: { tower: { month, reached: 9, coins: 17, top: 70, bought: {} } } });
  const response = await host.post("/tower/battle", { floor: 10 });
  ok(response);
  const boss = response.enemies.find((actor) => actor.mech?.length);
  assert.ok(boss, "The established floor-10 boss still has mechanical behavior");
  assert.deepEqual(boss.mech, ["guard", "counter"]);
  assert.equal(host.data(sessionId).tower.reached, 9);
  assert.equal(host.data(sessionId).tower.coins, 17);
  assert.equal(host.calls.length, 0);
});
