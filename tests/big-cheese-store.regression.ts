import assert from "node:assert/strict";
import test from "node:test";
import {
  newRun,
  HAFENKAI,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { placeKitOf } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/index.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import type { CapabilityDocumentRecord, CapabilityDocumentStore } from "@marinara-engine/shared";
import {
  BigCheeseError,
  createRunStore,
  upgradeGame,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/store.js";

import {
  settleWeek,
  endDay,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { bossWeek } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/boss.js";

const M3 = [
  "mode",
  "cheeseMark",
  "difficulty",
  "mutators",
  "power",
  "adult",
  "systems",
  "advisors",
  "houseRules",
  "officeHours",
  "wishPoints",
];

function fakeDocuments(): CapabilityDocumentStore {
  const docs = new Map<string, CapabilityDocumentRecord>();
  return {
    list: async (_p, kind) => [...docs.values()].filter((d) => d.kind === kind),
    getById: async (_p, id) => docs.get(id) ?? null,
    create: async (input) => {
      const record = { ...input, revision: 1 } as CapabilityDocumentRecord;
      docs.set(record.id, record);
      return record;
    },
    update: async (input) => {
      const current = docs.get(input.id);
      if (!current || current.revision !== input.expectedRevision) return null;
      const record = { ...current, ...input, revision: current.revision + 1 } as CapabilityDocumentRecord;
      docs.set(record.id, record);
      return record;
    },
    remove: async (_p, id, expectedRevision) => docs.get(id)?.revision === expectedRevision && docs.delete(id),
  };
}

test("creates, lists, reads and deletes a run", async () => {
  const store = createRunStore(fakeDocuments());
  const run = await store.create("hafenkai");
  assert.equal(run.revision, 0);
  assert.equal(run.game.clock.week, 1);
  assert.equal((await store.list())[0]!.week, 1);
  await assert.rejects(store.create("nowhere"), (e) => e instanceof BigCheeseError && e.statusCode === 400);
  assert.equal((await store.list()).length, 1);
  assert.equal((await store.get(run.id)).kitId, "hafenkai");
  await store.remove(run.id);
  await assert.rejects(store.get(run.id), (e) => e instanceof BigCheeseError && e.statusCode === 404);
  await assert.rejects(store.get("../x"), (e) => e instanceof BigCheeseError && e.statusCode === 404);
});

test("a write with a stale revision gets a 409; queued writes both land", async () => {
  const store = createRunStore(fakeDocuments());
  const { id } = await store.create("hafenkai");
  const bump = (run: { createdAt: string }) => ({ ...run, createdAt: run.createdAt + "+" });
  await Promise.all([store.update(id, 0, bump as never), store.update(id, 1, bump as never)]);
  assert.ok((await store.get(id)).createdAt.endsWith("++"));
  await assert.rejects(store.update(id, 0, bump as never), (e) => e instanceof BigCheeseError && e.statusCode === 409);
});

test("a run saved by a newer version is listed as newer and refused with a 409", async () => {
  const documents = fakeDocuments();
  const at = new Date().toISOString();
  await documents.create({
    id: "big-cheese:run:r-000000000000",
    packageId: "big-cheese",
    kind: "run",
    name: "x",
    description: "",
    data: { saveVersion: 5 },
    createdAt: at,
    updatedAt: at,
  });
  const store = createRunStore(documents);
  assert.equal((await store.list())[0].newer, true);
  await assert.rejects(store.get("r-000000000000"), (e) => e instanceof BigCheeseError && e.code === "newer-save");
});

test("a v1 document migrates on read, loads, saves as v3 and round-trips", async () => {
  const documents = fakeDocuments();
  const at = new Date().toISOString();
  const game: Record<string, any> = { ...newRun(HAFENKAI, 7), saveVersion: 1 };
  for (const k of ["rooms", "relations", "grapevine", "story", "bigScenes", ...M3]) delete game[k];
  for (const p of Object.values<any>(game.people)) for (const k of ["room", "ambition", "status"]) delete p[k];
  await documents.create({
    id: "big-cheese:run:r-000000000001",
    packageId: "big-cheese",
    kind: "run",
    name: "x",
    description: "",
    createdAt: at,
    updatedAt: at,
    data: {
      saveVersion: 1,
      revision: 0,
      kitId: "hafenkai",
      createdAt: at,
      lite: false,
      text: { cards: {}, scenes: {}, feelings: {} },
      scene: null,
      game,
    },
  } as never);
  const store = createRunStore(documents);
  const run = await store.get("r-000000000001");
  assert.equal(run.game.saveVersion, 4);
  assert.equal(run.game.mode, "normal");
  assert.equal(run.game.difficulty, "normal");
  assert.deepEqual(run.game.officeHours, { day: 2, slot: "afternoon", visitors: [] });
  assert.equal(run.game.wishPoints.left, 3);
  assert.equal(Object.keys(run.game.rooms).length, 12);
  assert.equal(run.game.people.henrike!.status, "active");
  assert.equal(run.game.people.henrike!.trust, 50);
  await store.update(run.id, 0, (r) => r);
  const saved = (await documents.getById("big-cheese", "big-cheese:run:r-000000000001"))!.data as {
    saveVersion: number;
  };
  assert.equal(saved.saveVersion, 4);
  const fresh = await store.create("hafenkai");
  assert.deepEqual((await store.get(fresh.id)).game, fresh.game);
  const bytes = JSON.stringify(fresh.game).length;
  assert.ok(bytes < 6500, `fresh run is ${bytes} bytes`);
  console.log(`fresh run: ${bytes} bytes`);
});

test("a v2 document migrates to v3 and round-trips", async () => {
  const documents = fakeDocuments();
  const at = new Date().toISOString();
  const game: Record<string, any> = { ...newRun(HAFENKAI, 7), saveVersion: 2 };
  for (const k of M3) delete game[k];
  await documents.create({
    id: "big-cheese:run:r-000000000002",
    packageId: "big-cheese",
    kind: "run",
    name: "x",
    description: "",
    data: {
      saveVersion: 2,
      revision: 0,
      kitId: "hafenkai",
      createdAt: at,
      lite: false,
      text: { cards: {}, scenes: {}, feelings: {} },
      scene: null,
      game,
    },
    createdAt: at,
    updatedAt: at,
  } as never);
  const store = createRunStore(documents);
  const run = await store.get("r-000000000002");
  assert.equal(run.game.saveVersion, 4);
  assert.deepEqual(run.game.mutators, []);
  assert.equal(run.game.adult, null);
  assert.equal(run.game.difficulty, "normal");
  await store.update(run.id, 0, (r) => r);
  const saved = (await documents.getById("big-cheese", "big-cheese:run:r-000000000002"))!.data as {
    saveVersion: number;
    game: typeof run.game;
  };
  assert.equal(saved.saveVersion, 4);
  assert.deepEqual(saved.game, run.game);
  assert.deepEqual((await store.get(run.id)).game, run.game);
});

test("a run resolves its kit through placeKitOf", () => {
  assert.equal(placeKitOf({ kitId: "hafenkai" }), HAFENKAI_PLACE);
  const own = { ...HAFENKAI_PLACE, id: "mine" };
  assert.equal(placeKitOf({ kitId: "hafenkai", kit: own }), own);
});

test("T12: a sandbox run survives a meter at 0; the list shows mode and mark", async () => {
  let s = newRun(HAFENKAI, 1);
  s.mode = "sandbox";
  s.meters = { money: 0, output: 50, people: 50, standing: 50 };
  for (let i = 0; i < 4; i++) s = settleWeek(s);
  assert.equal(s.hearing, null);
  assert.equal(s.status, "playing");
  const store = createRunStore(fakeDocuments());
  await store.create("hafenkai", false, async (g) => {
    g.mode = "ironman";
    g.cheeseMark = true;
  });
  const [card] = await store.list();
  assert.equal(card.mode, "ironman");
  assert.equal(card.cheeseMark, true);
});

test("a v3 document migrates to v4 and round-trips 20 times", async () => {
  const documents = fakeDocuments();
  const at = new Date().toISOString();
  const M4 = [
    "things",
    "culture",
    "traditions",
    "goals",
    "perks",
    "achievements",
    "boss",
    "depth",
    "ledger",
    "openedRooms",
  ];
  const game: Record<string, any> = { ...newRun(HAFENKAI, 7), saveVersion: 3 };
  for (const k of M4) delete game[k];
  await documents.create({
    id: "big-cheese:run:r-000000000003",
    packageId: "big-cheese",
    kind: "run",
    name: "x",
    description: "",
    data: {
      saveVersion: 3,
      revision: 0,
      kitId: "hafenkai",
      createdAt: at,
      lite: false,
      text: { cards: {}, scenes: {}, feelings: {} },
      scene: null,
      game,
    },
    createdAt: at,
    updatedAt: at,
  } as never);
  const store = createRunStore(documents);
  let run = await store.get("r-000000000003");
  assert.equal(run.game.saveVersion, 4);
  assert.deepEqual(run.game.boss, { stress: 20, energy: 100, peak: 20, weeksAt100: 0 });
  assert.deepEqual(run.game.things.drawer, []);
  assert.deepEqual(run.game.depth, { money: false, building: false });
  assert.equal(run.game.traditions.length, HAFENKAI_PLACE.traditions?.length ?? 0);
  assert.ok(run.game.traditions.every((t) => t.count === 0 && !t.active));
  for (let i = 0; i < 20; i++) {
    await store.update(run.id, run.revision ?? i, (r) => r);
    run = await store.get(run.id);
  }
  assert.equal(run.game.saveVersion, 4);
});

test("a fresh run has empty M4 state; boss stress stays low in a quiet year and respects Thick skin", () => {
  const g = newRun(HAFENKAI, 7);
  assert.deepEqual(g.boss, { stress: 20, energy: 100, peak: 20, weeksAt100: 0 });
  assert.deepEqual(g.perks, []);
  assert.equal(g.pendingTerm, null);
  assert.equal(g.legacy, null);
  const a = newRun(HAFENKAI, 7);
  const b = newRun(HAFENKAI, 7);
  b.perks.push("thick_skin");
  b.meters.people = 20;
  a.meters.people = 20;
  bossWeek(a);
  bossWeek(b);
  assert.ok(b.boss.stress < a.boss.stress);
});

test("a v3 run with a custom kit upgrades with the kit's traditions, drawer and culture", () => {
  const kit = {
    ...HAFENKAI_PLACE,
    traditions: [{ id: "t1", tag: "family", text: "Friday lunch" }],
    things: [{ id: "k1", kind: "key", name: "Old key" }],
    culture: { family: 2 },
  } as typeof HAFENKAI_PLACE;
  const game: Record<string, any> = { ...newRun(HAFENKAI, 7), saveVersion: 3 };
  for (const k of ["things", "culture", "traditions", "boss", "lastTerm"]) delete game[k];
  const up = upgradeGame(game as never, "custom-x", kit);
  assert.equal(up.saveVersion, 4);
  assert.deepEqual(up.traditions, [{ id: "t1", text: "Friday lunch", count: 0, active: false }]);
  assert.equal(up.things.drawer[0]!.name, "Old key");
  assert.deepEqual(up.culture, { family: 2 });
});

test("boss weeksAt100 counts weeks that peak at 100 and resets otherwise", () => {
  const g = newRun(HAFENKAI, 7);
  g.boss.stress = 98;
  bossWeek(g);
  assert.equal(g.boss.peak, 100);
  assert.equal(g.boss.weeksAt100, 1);
  assert.ok(g.boss.stress < 100);
  g.boss.stress = 98;
  bossWeek(g);
  assert.equal(g.boss.weeksAt100, 2);
  g.boss.stress = 20;
  bossWeek(g);
  assert.equal(g.boss.weeksAt100, 0);
});

test("endTerm fires once per term even when speed_run is switched mid-run", () => {
  const run = (on: number | null, off: number | null) => {
    let s = newRun(HAFENKAI, 7);
    const seen: number[] = [];
    while (s.status === "playing") {
      if (s.clock.day === 0 && s.clock.week === on) s.mutators = ["speed_run"];
      if (s.clock.day === 0 && s.clock.week === off) s.mutators = [];
      for (const k of ["money", "output", "people", "standing"] as const) s.meters[k] = 80;
      const before = s.lastTerm;
      s = endDay(s, HAFENKAI_PLACE);
      if (s.lastTerm !== before) seen.push(s.lastTerm);
    }
    return seen;
  };
  assert.deepEqual(run(null, null), [1, 2, 3]);
  const a = run(6, null);
  assert.ok(a.every((n, i) => i === 0 || n > a[i - 1]!));
  assert.equal(a[0], 2); // week 8 under 4-week terms
  const b = run(1, 5);
  assert.ok(b.every((n, i) => i === 0 || n > b[i - 1]!));
  assert.equal(b[0], 1);
  assert.equal(b[1], 2); // week 16 under 8-week terms: term 1 was not ended twice
});
