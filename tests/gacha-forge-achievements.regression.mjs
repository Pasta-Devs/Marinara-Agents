// Exercise the real achievement readers/writers and routes with isolated documents.
// Apply only this feature's recipe in memory when the generated bundle is not rebuilt yet.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { repairForgeAchievementProgress } from "../packages/gacha-forge/src/achievement-progress.mjs";
import { loadGachaBundlePatches, swapGachaBundleText } from "../scripts/gacha-forge-bundle-patches.mjs";

const packageRoot = new URL("../packages/gacha-forge/", import.meta.url);
const ledger = await loadGachaBundlePatches(packageRoot);
const patch = ledger.files["server.mjs"].patches.find((entry) => entry.notes?.startsWith("Count actual unit"));
assert.ok(patch, "the maintained achievement recipe exists");
let source = await readFile(new URL("server.mjs", packageRoot), "utf8");
if (!source.includes("/* forge-achievement-progress-source:start */")) {
  for (const edit of patch.edits) source = swapGachaBundleText(source, edit.find, edit.replace);
}
const temporary = await mkdtemp(join(tmpdir(), "marinara-forge-achievements-"));
const modulePath = join(temporary, "server.mjs");
await writeFile(modulePath, `${source}\nexport {Np as definitions,Gl as view,Xt as record,vf as facetGain};\n`);
let sequence = 0;
const load = () => import(`${pathToFileURL(modulePath).href}?case=${sequence++}`);
const runId = "achievement-regression";
const unitId = `${runId}:unit:hero`;
const sessionId = `${runId}:session`;
const clone = (value) => structuredClone(value);
const originalFetch = globalThis.fetch;
globalThis.fetch = () => {
  throw new Error("This regression must not contact a provider");
};

async function harness({ level = 1, facet = 0, stats = {}, items = {}, roster = {}, session = {} } = {}) {
  const docs = new Map();
  const routes = new Map();
  const seed = (id, kind, data) => {
    docs.set(id, { id, packageId: "gacha-forge", kind, name: id, revision: 1, data: clone(data) });
  };
  seed("index", "index", {
    activeRunId: runId,
    runs: [
      {
        runId,
        name: "Fixture",
        scenario: "Fixture world",
        protagonist: { name: "Mari" },
        images: { enabled: false },
        storyDeferred: true,
      },
    ],
  });
  seed(sessionId, "session", {
    account: { level: 100, xp: 0 },
    roster: { [unitId]: { level, facet, bondFights: 0 }, ...roster },
    wallet: { funds: 1e9, aether: 1e9, vigor: 1e3, insight: { shard: 1e3, core: 1e3, prism: 1e3 } },
    progress: {},
    stats,
    achievements: { claimed: { "ach-level-1": true } },
    ...session,
  });
  seed(unitId, "unit", {
    unitId,
    kind: "character",
    name: "Fixture hero",
    rarity: 5,
    role: "Warrior",
    affinity: "fire",
    stats: { hp: 40, atk: 40, def: 40, spd: 40 },
    skill: { name: "Fixture skill", effect: "damage", power: 100, target: "enemy" },
    passive: null,
  });
  seed(`${runId}:relics`, "relics", { items, seq: Object.keys(items).length });
  seed(`${runId}:banner:standard`, "banner", { charIds: [unitId], weaponIds: [], weaponFourIds: [] });
  const documents = {
    async getById(_packageId, id) {
      return clone(docs.get(id) ?? null);
    },
    async list(_packageId, kind) {
      return clone([...docs.values()].filter((doc) => !kind || doc.kind === kind));
    },
    async create(document) {
      assert.ok(!docs.has(document.id), "fixture create does not overwrite existing progress");
      const saved = { ...clone(document), revision: 1 };
      docs.set(document.id, saved);
      return clone(saved);
    },
    async update(document) {
      const previous = docs.get(document.id);
      if (!previous || previous.revision !== document.expectedRevision) return null;
      const saved = { ...previous, ...clone(document), revision: previous.revision + 1 };
      delete saved.expectedRevision;
      docs.set(document.id, saved);
      return clone(saved);
    },
    async remove(_packageId, id, revision) {
      return docs.get(id)?.revision === revision && docs.delete(id);
    },
  };
  const module = await load();
  await module.activate({
    package: { id: "gacha-forge", version: "fixture" },
    api: {
      runtime: {
        persistence: { documents },
        logger: { info() {}, warn() {}, error() {}, debug() {} },
        json: { parseJsonish: JSON.parse },
        languageModels: {
          async resolveForRequest() {
            throw new Error("No model generation is allowed in this regression");
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
    docs,
    seed,
    session: () => clone(docs.get(sessionId).data),
    async call(path, body = {}, method = "POST") {
      const route = routes.get(`${method} ${path}`);
      assert.ok(route, `real route registered: ${method} ${path}`);
      return route({ body: { runId, ...body } });
    },
  };
}

try {
  const claimed = { "ach-level-1": true };
  const pass = { xp: 200, daily: { done: { "d-level": 1 }, paid: {} } };
  const state = {
    roster: {
      [unitId]: { level: 20, facet: 3 },
      [`${runId}:unit:weapon`]: { level: 20 },
      "another:unit:foreign": { level: 100, facet: 6 },
    },
    stats: { "level-up": 11, "relic-feed": 1, untouched: 99 },
    achievements: { claimed },
    pass,
  };
  assert.equal(repairForgeAchievementProgress(state, runId, { one: { level: 3 }, two: { level: 4 } }), true);
  assert.deepEqual(state.stats, { "level-up": 38, "relic-feed": 7, facet: 3, untouched: 99 });
  assert.strictEqual(state.achievements.claimed, claimed);
  assert.deepEqual(state.pass, pass, "historical repair does not award old pass missions again");
  assert.equal(
    repairForgeAchievementProgress(state, runId, {}),
    false,
    "consumed items never lower historical progress",
  );
  delete state.roster[unitId];
  assert.equal(repairForgeAchievementProgress(state, runId), false, "removed units never lower historical progress");
  const restored = clone(state);
  restored.stats["level-up"] = 100;
  assert.equal(repairForgeAchievementProgress(restored, runId), false, "a higher existing counter survives reload");

  const module = await load();
  assert.equal(module.definitions.length, 22, "every shipped achievement ladder is covered");
  const derived = new Set(["rank", "tower-floor", "character-story", "bond-level", "characters"]);
  let thresholds = 0;
  for (const definition of module.definitions) {
    assert.equal(new Set(definition.steps).size, definition.steps.length);
    assert.ok(definition.steps.every((goal, index) => goal > 0 && (!index || goal > definition.steps[index - 1])));
    for (const [index, goal] of definition.steps.entries()) {
      const fixture = {
        account: { level: goal - 1 },
        stats: { [definition.kind]: goal - 1 },
        achievements: { claimed: {} },
      };
      const row = (value) =>
        module.view(fixture, { [definition.kind]: value }).rows.find((item) => item.id === definition.id);
      assert.equal(row(goal - 1).steps[index].ready, false);
      fixture.account.level = goal;
      fixture.stats[definition.kind] = goal;
      assert.equal(row(goal).steps[index].ready, true);
      fixture.achievements.claimed[`${definition.id}-${index + 1}`] = true;
      assert.equal(row(goal).steps[index].ready, false);
      assert.equal(row(goal).steps[index].claimed, true);
      thresholds++;
    }
    if (!derived.has(definition.kind)) {
      const fixture = { stats: {} };
      assert.equal(module.record(fixture, runId, definition.kind, 0, Date.now()), false);
      assert.equal(module.record(fixture, runId, definition.kind, 3, Date.now()), true);
      assert.equal(fixture.stats[definition.kind], 3);
    }
  }

  const growth = await harness();
  const leveled = await growth.call("/level-up", { unitId, spend: { shard: 1e3 } });
  assert.equal(leveled.ok, true, JSON.stringify(leveled));
  assert.ok(leveled.gained > 1);
  assert.equal(
    growth.session().stats["level-up"],
    leveled.gained,
    "one multi-level request records every gained level",
  );
  const partial = await harness({ level: 19, stats: { "level-up": 11 } });
  const fed = await partial.call("/level-up", { unitId, spend: { shard: 1 } });
  assert.equal(fed.ok, true, JSON.stringify(fed));
  assert.equal(fed.gained, 0);
  assert.equal(partial.session().stats["level-up"], 11, "partial XP without a level records no progress");

  const relic = { slot: "edge", rarity: 5, level: 0, main: { key: "atkPct" }, subs: [], locked: false };
  const reinforcement = await harness({ items: { target: relic, food1: relic, food2: relic, food3: relic } });
  const reinforced = await reinforcement.call("/relic/feed", { relicId: "target", food: ["food1", "food2", "food3"] });
  assert.equal(reinforced.ok, true, JSON.stringify(reinforced));
  assert.equal(
    reinforcement.session().stats["relic-feed"],
    3,
    "one multi-level reinforcement records all gained levels",
  );
  assert.equal(module.facetGain(6).gained, false, "duplicates at the facet cap grant no facet");

  const random = Math.random;
  try {
    Math.random = () => 0;
    const summons = await harness();
    const pulled = await summons.call("/summon", { banner: "char-standard", count: 10 });
    assert.equal(pulled.ok, true, JSON.stringify(pulled));
    assert.equal(pulled.results.length, 10);
    assert.equal(summons.session().stats.summon, 10);
    assert.equal(summons.session().stats["summon-5star"], 10);
    assert.equal(summons.session().stats.facet, 6, "only six real facet gains count across ten duplicates");
    assert.equal(pulled.results.filter((result) => result.facet?.gained).length, 6);
    const capped = await summons.call("/summon", { banner: "char-standard" });
    assert.equal(capped.ok, true, JSON.stringify(capped));
    assert.equal(summons.session().stats.facet, 6, "a capped duplicate does not create phantom progress");
  } finally {
    Math.random = random;
  }
  const towerShop = await harness({
    facet: 2,
    stats: { facet: 2 },
    session: {
      tower: {
        month: new Date().toISOString().slice(0, 7),
        reached: 70,
        top: 70,
        coins: 1e4,
        recommended: "fire",
        bought: {},
      },
    },
  });
  const bought = await towerShop.call("/shop/buy-tower", { itemId: "unit", unitId });
  assert.equal(bought.ok, true, JSON.stringify(bought));
  assert.equal(towerShop.session().roster[unitId].facet, 3);
  assert.equal(towerShop.session().stats.facet, 3, "a real facet from the tower shop also counts");

  const historical = await harness({ level: 20, stats: { "level-up": 11 }, items: { target: { ...relic, level: 4 } } });
  const refreshed = await historical.call("/state", {}, "GET");
  assert.equal(refreshed.ok, true, JSON.stringify(refreshed));
  assert.equal(historical.session().stats["level-up"], 19, "a state refresh persists missing historical progress");
  assert.equal(historical.session().stats["relic-feed"], 4);
  assert.equal(historical.session().achievements.claimed["ach-level-1"], true);
  const reloaded = await historical.call("/state", {}, "GET");
  assert.equal(reloaded.ok, true);
  assert.equal(historical.session().stats["level-up"], 19, "reopening achievements does not duplicate the repair");
  const paid = await historical.call("/achievements/claim", { stepId: "ach-level-2" });
  assert.equal(paid.ok, true, JSON.stringify(paid));
  assert.equal(historical.session().achievements.claimed["ach-level-2"], true);
  const wallet = historical.session().wallet.aether;
  const twice = await historical.call("/achievements/claim", { stepId: "ach-level-2" });
  assert.equal(twice.ok, false);
  assert.equal(twice.error, "nothing-to-claim");
  assert.equal(historical.session().wallet.aether, wallet, "an already-claimed reward is never paid again");
  const weaponId = `${runId}:unit:weapon`;
  const derivedProgress = await harness({
    roster: {
      [unitId]: { level: 1, bondFights: 1e6, bondCurve: 2 },
      [weaponId]: { level: 1, bondFights: 1e6, bondCurve: 2 },
    },
    session: { tower: { reached: 12 }, bondChapters: { [unitId]: { beats: 3, beats2: 3 } } },
  });
  derivedProgress.seed(weaponId, "unit", { unitId: weaponId, kind: "weapon", name: "Fixture weapon", rarity: 5 });
  const derivedState = await derivedProgress.call("/state", {}, "GET");
  assert.equal(derivedState.ok, true, JSON.stringify(derivedState));
  const derivedRows = Object.fromEntries(derivedState.activeRun.achievements.rows.map((row) => [row.kind, row.done]));
  assert.equal(derivedRows.rank, 100);
  assert.equal(derivedRows["tower-floor"], 12);
  assert.equal(derivedRows["character-story"], 2);
  assert.equal(derivedRows["bond-level"], 10, "weapons do not add character bond progress");
  assert.equal(derivedRows.characters, 1, "weapons do not inflate the owned-character achievement");
  console.info(
    `Gacha achievement regression passed: 22 ladders, ${thresholds} threshold controls, real level/relic/summon/shop/repair/claim and all derived readers`,
  );
} finally {
  globalThis.fetch = originalFetch;
  await rm(temporary, { recursive: true, force: true });
}
