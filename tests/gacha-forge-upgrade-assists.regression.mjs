import assert from "node:assert/strict";
import { test } from "node:test";
import {
  forgeAffordableRelicFood,
  forgeBestFreeGear,
  forgeEquipFreeGear,
  forgeInsightAutoSelection,
  forgeSelectedTrainingLevels,
  wireForgeUpgradeAssists,
} from "../packages/gacha-forge/src/upgrade-assist-client.mjs";
import {
  forgeGearIsOccupied,
  forgeTrainingCost,
  forgeTrainingPlan,
  forgeTrainingPreviews,
} from "../packages/gacha-forge/src/upgrade-assist-server.mjs";

test("Insight auto-selection previews only affordable levels for characters and weapons", () => {
  const growth = {
    level: 1,
    xp: 20,
    ladder: [
      { level: 1, xp: 100, funds: 10 },
      { level: 2, xp: 200, funds: 20 },
      { level: 3, xp: 400, funds: 40 },
    ],
    tiers: [
      { id: "large", xp: 100 },
      { id: "small", xp: 20 },
    ],
    wallet: { funds: 30, insight: { small: 3, large: 10 } },
  };
  const before = structuredClone(growth);
  assert.deepEqual(forgeInsightAutoSelection(growth), { small: 3, large: 3 });
  assert.deepEqual(growth, before, "selection spends no resources");
  assert.deepEqual(forgeInsightAutoSelection({ ...growth, wallet: { ...growth.wallet, funds: 0 } }), {});
  assert.deepEqual(forgeInsightAutoSelection({ ...growth, ladder: [] }), {}, "cap consumes nothing");
  assert.deepEqual(forgeInsightAutoSelection({ ...growth, wallet: { funds: 30, insight: { small: 2 } } }), {
    small: 2,
  });
  assert.deepEqual(forgeInsightAutoSelection({ ...growth, xp: 300 }), {}, "banked XP needs no extra Insight");
});

test("relic auto-selection preserves scarce, locked and equipped items and respects funds", () => {
  const relics = {
    items: [
      { id: "target", level: 1, levelCap: 5, feedCost: 10, rarity: 5 },
      { id: "free-a", rarity: 3 },
      { id: "free-b", rarity: 4 },
      { id: "free-c", rarity: 3 },
      { id: "rare", rarity: 5 },
      { id: "locked", rarity: 3, locked: true },
      { id: "worn", rarity: 3, equipped: true },
      { id: "named", rarity: 3, wornBy: "Mira" },
    ],
    wallet: { funds: 20 },
    autoPick: ["target", "rare", "locked", "worn", "named", "missing", "free-a", "free-a", "free-b", "free-c"],
  };
  assert.deepEqual(forgeAffordableRelicFood(relics, "target"), ["free-a", "free-b"]);
  assert.deepEqual(forgeAffordableRelicFood({ ...relics, wallet: { funds: 9 } }, "target"), []);
  assert.deepEqual(forgeAffordableRelicFood(relics, "missing"), []);
});

const costAtLevel = (level) =>
  level < 5
    ? {
        funds: level * 10,
        items: [{ id: level < 3 ? "tenet-1" : "tenet-2", name: "Tenet", need: level }],
      }
    : null;

test("training preview aggregates tiers without spending, then validates the exact confirmation", () => {
  const materials = { "tenet-1": 3, "tenet-2": 7 };
  const options = { level: 1, cap: 5, materials, funds: 100, costAtLevel };
  const preview = forgeTrainingPlan(options);
  assert.deepEqual(preview, {
    ok: true,
    levelFrom: 1,
    levelTo: 5,
    levels: 4,
    funds: 100,
    items: [
      { id: "tenet-1", name: "Tenet", need: 3 },
      { id: "tenet-2", name: "Tenet", need: 7 },
    ],
  });
  assert.deepEqual(materials, { "tenet-1": 3, "tenet-2": 7 });
  assert.deepEqual(forgeTrainingPlan({ ...options, levels: preview.levels }), preview);
  assert.equal(forgeTrainingPlan({ ...options, funds: 30 }).levelTo, 3);
  assert.deepEqual(forgeTrainingPlan({ ...options, funds: 30, levels: 4 }), { ok: false, error: "short-funds" });
  assert.deepEqual(forgeTrainingPlan({ ...options, materials: {}, levels: 1 }), {
    ok: false,
    error: "short-materials",
  });
  for (const levels of [0, -1, 1.5, "2", 5, null]) {
    assert.deepEqual(forgeTrainingPlan({ ...options, levels }), { ok: false, error: "bad-levels" });
  }
  assert.equal(forgeTrainingPlan({ ...options, cap: 3 }).levelTo, 3);
});

test("training cost includes affinity tiers and event mandate, and dead tracks have no Auto preview", () => {
  const cost = forgeTrainingCost(
    4,
    "flame",
    () => ({ tier: 2, tenet: 3, mandate: 1, funds: 40 }),
    (...parts) => parts.join(":"),
    new Map([["tenet:flame:2", { name: "Flame Tenet" }]]),
  );
  assert.deepEqual(cost, {
    funds: 40,
    items: [
      { id: "tenet:flame:2", need: 3, name: "Flame Tenet" },
      { id: "mandate:any:1", need: 1, name: "mandate:any:1" },
    ],
  });
  const form = forgeTrainingPreviews(
    {
      tracks: [
        { key: "skill", level: 1, max: 10, cap: 3, live: true },
        { key: "granted", level: 1, max: 10, cap: 3, live: false },
      ],
    },
    { "tenet-1": 100 },
    1000,
    costAtLevel,
  );
  assert.equal(form.tracks[0].auto.levelTo, 3);
  assert.equal(form.tracks[1].auto, null);
});

test("a bulk training selection belongs only to the current run, unit, track and growth revision", () => {
  const host = {
    _run: { runId: "world" },
    _rosterUnitId: "unit",
    _growthRev: 2,
    _forgeTrainingSelection: { runId: "world", unitId: "unit", track: "skill", revision: 2, plan: { levels: 4 } },
  };
  assert.equal(forgeSelectedTrainingLevels(host, "skill"), 4);
  assert.equal(forgeSelectedTrainingLevels(host, "passive"), 1);
  for (const change of [{ _growthRev: 3 }, { _rosterUnitId: "other" }, { _run: { runId: "other" } }]) {
    assert.equal(forgeSelectedTrainingLevels({ ...host, ...change }, "skill"), 1);
  }
});

test("best-free gear improves actual displayed BP and never selects another unit's equipment", () => {
  const gear = {
    cp: 100,
    slots: [
      { key: "weapon", kind: "weapon" },
      { key: "ring", kind: "relic", locked: true },
    ],
    options: [
      { id: "occupied", heldBy: "other", cpIf: 1000 },
      { id: "named", heldByName: "Mira", cpIf: 900 },
      { id: "worn", wornElsewhere: true, cpIf: 800 },
      { id: "current", equipped: true, cpIf: 100 },
      { id: "downgrade", cpIf: 90 },
      { id: "best", cpIf: 130 },
      { id: "a-tie", cpIf: 130 },
    ],
  };
  assert.equal(forgeBestFreeGear(gear, "weapon", "unit").id, "a-tie");
  assert.equal(forgeBestFreeGear(gear, "ring", "unit"), null);
  assert.equal(
    forgeGearIsOccupied(
      { unit: { weapon: "best" }, other: { weapon: "occupied", ring: "ring-a" } },
      "unit",
      "weapon",
      "best",
    ),
    false,
  );
  assert.equal(forgeGearIsOccupied({ unit: {}, other: { weapon: "occupied" } }, "unit", "weapon", "occupied"), true);
  assert.equal(forgeGearIsOccupied({ other: { ring: "ring-a" } }, "unit", "ring", "ring-a"), true);
});

test("auto-equip sends strict free-only requests and reevaluates gear after each successful slot", async () => {
  const posts = [];
  const slots = [
    { key: "weapon", kind: "weapon" },
    { key: "ring", kind: "relic", options: [{ id: "ring", cpIf: 120 }] },
  ];
  const host = {
    _run: { runId: "world" },
    _rosterUnitId: "unit",
    _growthRev: 0,
    _growth: { gear: { cp: 100, slots, options: [{ id: "weapon", cpIf: 130 }] } },
    _renderBrowser() {},
    async _postJson(path, body) {
      posts.push({ path, body });
      return {
        ok: true,
        gear: { cp: 130, slots: [slots[0], { ...slots[1], options: [{ id: "ring", cpIf: 160 }] }], options: [] },
      };
    },
  };
  await forgeEquipFreeGear(host);
  assert.equal(posts.length, 2, "second slot compares refreshed BP, not stale absolute BP");
  assert.equal(
    posts.every(({ path, body }) => path === "/equip" && body.onlyFree === true),
    true,
  );
  assert.equal(posts[0].body.weaponId, "weapon");
  assert.equal(posts[1].body.relicId, "ring");
  assert.equal(host._equipBusy, false);
  assert.equal(host._growthRev, 2);
});

test("an equipment race or changed unit stops auto-equip without transferring stale gear", async () => {
  const host = {
    _run: { runId: "world" },
    _rosterUnitId: "unit",
    _growthRev: 0,
    _growth: { gear: { cp: 100, slots: [{ key: "weapon", kind: "weapon" }], options: [{ id: "weapon", cpIf: 130 }] } },
    _renderBrowser() {},
    _postJson: async () => ({ ok: false, error: "gear-unavailable" }),
  };
  await forgeEquipFreeGear(host);
  assert.equal(host._growthRev, 0);
  assert.deepEqual(host._forgeUpgradeError, {
    runId: "world",
    unitId: "unit",
    message: "Equipment changed. Refresh the unit and try again.",
  });
  host._postJson = async () => {
    host._rosterUnitId = "other";
    return { ok: true, gear: { cp: 999 } };
  };
  await forgeEquipFreeGear(host);
  assert.equal(host._growth.gear.cp, 100);
});

let fixtureSequence = 0;

function errorStateHost(post) {
  return {
    _run: { runId: "world-a" },
    _rosterUnitId: "unit-a",
    _growthRev: 0,
    _growth: {
      gear: {
        cp: 100,
        slots: [{ key: "weapon", kind: "weapon" }],
        options: [{ id: "weapon", cpIf: 130 }],
      },
    },
    _renderBrowser() {},
    _postJson: post,
  };
}

function renderedUpgradeErrors(host, onButton) {
  const originalDocument = globalThis.document;
  const originalRoot = host._root;
  const rows = [];
  const element = () => ({
    dataset: {},
    attributes: {},
    children: [],
    append(...children) {
      this.children.push(...children);
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  });
  const gear = { querySelector: () => null, prepend: (row) => rows.push(row) };
  host._root = {
    querySelector: (selector) =>
      selector === "[data-forge-upgrade-style]" ? {} : selector === ".cp-panel .gr-root.gear" ? gear : null,
    querySelectorAll: () => [],
  };
  globalThis.document = { createElement: element };
  try {
    wireForgeUpgradeAssists(host);
    onButton?.(rows[0]?.children.find((child) => Object.hasOwn(child.dataset, "forgeAutoEquip")));
    return rows.flatMap((row) =>
      row.children.filter((child) => child.attributes.role === "status").map((child) => child.textContent),
    );
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    host._root = originalRoot;
  }
}

test("auto-equip errors render only for the run and unit where the failure happened", async () => {
  const closed = errorStateHost();
  closed._run = null;
  closed._rosterUnitId = null;
  assert.deepEqual(renderedUpgradeErrors(closed), [], "a retired view with no error cannot show an error note");
  for (const next of [
    { runId: "world-a", unitId: "unit-b" },
    { runId: "world-b", unitId: "unit-a" },
  ]) {
    const host = errorStateHost(async () => ({ ok: false, error: "gear-unavailable" }));
    await forgeEquipFreeGear(host);
    assert.equal(renderedUpgradeErrors(host).length, 1, "the failed unit still sees its actionable error");
    host._run = { runId: next.runId };
    host._rosterUnitId = next.unitId;
    assert.deepEqual(renderedUpgradeErrors(host), [], "another unit/world must not inherit the error");
    host._run = { runId: "world-a" };
    host._rosterUnitId = "unit-a";
    assert.equal(renderedUpgradeErrors(host).length, 1, "returning to the initiating unit retains its error");
  }
});

test("late auto-equip rejection cannot replace an error belonging to the newly opened view", async () => {
  for (const next of [
    { runId: "world-a", unitId: "unit-b" },
    { runId: "world-b", unitId: "unit-a" },
  ]) {
    let reject;
    const host = errorStateHost(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const pending = forgeEquipFreeGear(host);
    host._run = { runId: next.runId };
    host._rosterUnitId = next.unitId;
    const currentError = { ...next, message: "Current view error" };
    host._forgeUpgradeError = currentError;
    reject(new Error("The previous request failed late."));
    await pending;
    assert.deepEqual(host._forgeUpgradeError, currentError);
    assert.deepEqual(renderedUpgradeErrors(host), ["Current view error"]);
    assert.equal(host._equipBusy, false);
  }
});

test("settled auto-equip repaints the current unit's button without adopting an older response", async () => {
  for (const outcome of ["refused", "rejected", "success"]) {
    let resolvePost, rejectPost, button;
    const host = errorStateHost(
      () =>
        new Promise((resolve, reject) => {
          resolvePost = resolve;
          rejectPost = reject;
        }),
    );
    host._renderBrowser = () =>
      renderedUpgradeErrors(host, (current) => {
        button = current;
      });
    const pending = forgeEquipFreeGear(host);
    host._rosterUnitId = "unit-b";
    host._growth = { gear: { cp: 200, slots: [{ key: "weapon", kind: "weapon" }], options: [] } };
    host._renderBrowser();
    assert.equal(button.disabled, true);
    assert.equal(button.textContent, "Equipping…");
    if (outcome === "rejected") rejectPost(new Error("The earlier request failed."));
    else resolvePost({ ok: outcome === "success", gear: { cp: 999 } });
    await pending;
    assert.equal(host._equipBusy, false);
    assert.equal(button.disabled, false, "the current button becomes usable when the shared operation ends");
    assert.equal(button.textContent, "Auto-equip free gear");
    assert.equal(host._growth.gear.cp, 200, "the previous unit's response stays ignored");
    assert.equal(host._growthRev, 0);
  }
});

async function shippedGrowthRoutes({ weapon = {}, combatMode = "classic" } = {}) {
  const runId = "upgrade-route-fixture";
  const unitId = `${runId}:unit:arden`;
  const otherId = `${runId}:unit:mira`;
  const weaponId = `${runId}:unit:blade`;
  const sessionId = `${runId}:session`;
  const docs = new Map();
  const routes = new Map();
  let beforeSessionWrite;
  const seed = (id, kind, data) =>
    docs.set(id, { id, kind, packageId: "gacha-forge", revision: 1, data: structuredClone(data) });
  seed("index", "index", {
    runs: [{ runId, name: "Synthetic upgrade world", combat: { mode: combatMode, revision: 0 } }],
  });
  const character = {
    kind: "character",
    name: "Arden",
    role: "Warrior",
    rarity: 5,
    affinity: "Fire",
    stats: { hp: 100, atk: 10, def: 10, spd: 10 },
    skill: { name: "Fixture skill", effect: "damage", power: 100 },
    passive: { name: "Fixture passive", effect: "buff", power: 10 },
  };
  seed(unitId, "unit", character);
  seed(otherId, "unit", { ...character, name: "Mira" });
  seed(weaponId, "unit", {
    kind: "weapon",
    name: "Fixture Blade",
    rarity: 5,
    weaponType: "blade",
    stats: { atk: 10 },
    ...weapon,
  });
  seed(`${runId}:relics`, "relics", {
    items: { "core-free": { slot: "core", rarity: 3, level: 0, main: { key: "hpPct", value: 1 }, subs: [] } },
  });
  seed(sessionId, "session", {
    account: { level: 100 },
    progress: {},
    roster: {
      [unitId]: { level: 1, form: { skill: 1, passive: 1 } },
      [otherId]: { level: 1 },
      [weaponId]: { level: 1 },
    },
    wallet: {
      funds: 100000,
      materials: { "tenet:fire:1": 100, "tenet:fire:2": 100, "tenet:fire:3": 100, "mandate:any:1": 10 },
    },
  });
  const documents = {
    getById: async (_package, id) => structuredClone(docs.get(id) || null),
    list: async (_package, kind) => structuredClone([...docs.values()].filter((doc) => !kind || doc.kind === kind)),
    create: async (document) => {
      seed(document.id, document.kind, document.data);
      return structuredClone(docs.get(document.id));
    },
    update: async (document) => {
      if (document.id === sessionId && beforeSessionWrite) {
        const callback = beforeSessionWrite;
        beforeSessionWrite = undefined;
        callback(docs.get(sessionId));
      }
      const current = docs.get(document.id);
      if (current?.revision !== document.expectedRevision) return null;
      const saved = { ...current, ...structuredClone(document), revision: current.revision + 1 };
      docs.set(document.id, saved);
      return structuredClone(saved);
    },
  };
  const serverUrl = new URL("../packages/gacha-forge/server.mjs", import.meta.url);
  const { activate } = await import(`${serverUrl.href}?upgrade-assists=${fixtureSequence++}`);
  await activate({
    package: { id: "gacha-forge", version: "fixture" },
    api: {
      runtime: {
        persistence: { documents },
        logger: { info() {}, warn() {}, error() {}, debug() {} },
        json: { parseJsonish: JSON.parse },
      },
      registerPrivilegedRoutes: async (register) =>
        register({ get() {}, post: (path, handler) => routes.set(path, handler) }),
    },
  });
  return {
    unitId,
    otherId,
    weaponId,
    session: () => docs.get(sessionId).data,
    onWrite: (callback) => {
      beforeSessionWrite = callback;
    },
    call: (path, body = {}) => routes.get(path)({ body: { runId, unitId, ...body } }),
  };
}

test("shipped weapon choices and equip honor the designated owner while preserving type checks for others", async () => {
  const grantedSkill = { name: "Signature strike", effect: "damage", power: 80, target: "enemy", trigger: "active" };
  const ownerId = "upgrade-route-fixture:unit:arden";
  const cases = [
    { weapon: { weaponType: "focus", dedicatedTo: "  aRdEn  ", grantedSkill }, allowed: true, active: true },
    {
      weapon: { weaponType: "focus", dedicatedToId: ownerId, dedicatedTo: "Old name", grantedSkill },
      allowed: true,
      active: true,
    },
    { weapon: { weaponType: "focus", dedicatedTo: "Arden" }, allowed: true, active: false },
    {
      weapon: { weaponType: "focus", dedicatedToId: "another-owner", dedicatedTo: "Arden", grantedSkill },
      allowed: false,
    },
    { weapon: { weaponType: "focus", dedicatedTo: "Mira", grantedSkill }, allowed: false },
    { weapon: { weaponType: "focus" }, allowed: false },
    { weapon: { weaponType: "blade" }, allowed: true, active: false },
    { weapon: { weaponType: "blade", dedicatedTo: "Mira", grantedSkill }, allowed: true, active: false },
  ];
  for (const combatMode of ["classic", "formation"]) {
    for (const row of cases) {
      const fixture = await shippedGrowthRoutes({ weapon: row.weapon, combatMode });
      const before = structuredClone(fixture.session());
      const view = await fixture.call("/unit");
      assert.equal(view.ok, true);
      assert.equal(
        view.gear.options.some((option) => option.id === fixture.weaponId),
        row.allowed,
        JSON.stringify(row),
      );
      const equipped = await fixture.call("/equip", { slot: "weapon", weaponId: fixture.weaponId });
      assert.equal(equipped.ok, row.allowed, JSON.stringify(equipped));
      if (row.allowed) {
        assert.equal(fixture.session().roster[fixture.unitId].weapon, fixture.weaponId);
        assert.equal(equipped.gear.slots.find((slot) => slot.key === "weapon").item.grantedActive, row.active);
        assert.deepEqual(fixture.session().wallet, before.wallet);
        assert.equal((await fixture.call("/equip", { slot: "weapon", weaponId: "" })).ok, true);
        assert.equal(fixture.session().roster[fixture.unitId].weapon, undefined);
      } else {
        assert.equal(equipped.error, "wrong-type");
        assert.deepEqual(fixture.session(), before, "a refused weapon never changes the session");
      }
    }
  }
});

test("shipped onlyFree equipment route rejects occupied weapons/relics and loses an occupancy race safely", async () => {
  const fixture = await shippedGrowthRoutes({ weapon: { weaponType: "focus", dedicatedTo: "Arden" } });
  const roster = fixture.session().roster;
  roster[fixture.otherId].weapon = fixture.weaponId;
  roster[fixture.otherId].core = "core-free";
  assert.equal(
    (await fixture.call("/equip", { slot: "weapon", weaponId: fixture.weaponId, onlyFree: true })).error,
    "gear-unavailable",
  );
  assert.equal(
    (await fixture.call("/equip", { slot: "core", relicId: "core-free", onlyFree: true })).error,
    "gear-unavailable",
  );
  assert.equal(roster[fixture.otherId].weapon, fixture.weaponId);
  delete roster[fixture.otherId].weapon;
  fixture.onWrite((current) => {
    current.data.roster[fixture.otherId].weapon = fixture.weaponId;
    current.revision += 1;
  });
  assert.equal(
    (await fixture.call("/equip", { slot: "weapon", weaponId: fixture.weaponId, onlyFree: true })).error,
    "write-conflict",
  );
  assert.equal(fixture.session().roster[fixture.unitId].weapon, undefined);
  assert.equal(fixture.session().roster[fixture.otherId].weapon, fixture.weaponId);
  const manual = await fixture.call("/equip", { slot: "weapon", weaponId: fixture.weaponId });
  assert.equal(manual.ok, true, "explicit manual transfer remains available");
  assert.equal(fixture.session().roster[fixture.otherId].weapon, undefined);
  assert.equal(fixture.session().roster[fixture.unitId].weapon, fixture.weaponId);
});

test("the designated weapon exception still requires owned characters and weapons from the same run", async () => {
  const fixture = await shippedGrowthRoutes({ weapon: { weaponType: "focus", dedicatedTo: "Arden" } });
  assert.equal((await fixture.call("/equip", { weaponId: "another-run:unit:signature" })).error, "bad-request");
  assert.equal(
    (await fixture.call("/equip", { weaponId: "upgrade-route-fixture:unit:missing" })).error,
    "not-a-weapon",
  );
  assert.equal((await fixture.call("/equip", { weaponId: fixture.otherId })).error, "not-a-weapon");
  delete fixture.session().roster[fixture.weaponId];
  assert.equal((await fixture.call("/unit")).gear.options.length, 0);
  assert.equal((await fixture.call("/equip", { weaponId: fixture.weaponId })).error, "not-owned-weapon");
  fixture.session().roster[fixture.weaponId] = { level: 1 };
  delete fixture.session().roster[fixture.unitId];
  assert.equal((await fixture.call("/equip", { weaponId: fixture.weaponId })).error, "not-owned");
});

test("shipped bulk-training route charges all tier costs once, enforces caps and preserves a competing save", async () => {
  const fixture = await shippedGrowthRoutes();
  const trained = await fixture.call("/form-up", { track: "skill", levels: 3 });
  assert.equal(trained.ok, true, JSON.stringify(trained));
  assert.equal(fixture.session().roster[fixture.unitId].form.skill, 4);
  assert.equal(fixture.session().wallet.funds, 97000);
  assert.equal(fixture.session().wallet.materials["tenet:fire:1"], 95);
  assert.equal(fixture.session().wallet.materials["tenet:fire:2"], 98);
  const capped = await fixture.call("/form-up", { track: "skill", levels: 1 });
  assert.equal(capped.error, "at-cap");
  const before = structuredClone(fixture.session());
  fixture.onWrite((current) => {
    current.data.competingSave = true;
    current.revision += 1;
  });
  const conflict = await fixture.call("/form-up", { track: "passive", levels: 3 });
  assert.equal(conflict.error, "write-conflict");
  assert.equal(fixture.session().roster[fixture.unitId].form.passive, 1);
  assert.deepEqual(fixture.session().wallet, before.wallet, "failed CAS spends neither funds nor materials");
  assert.equal(fixture.session().competingSave, true);
  const bad = await fixture.call("/form-up", { track: "passive", levels: "3" });
  assert.equal(bad.error, "bad-levels");
});
