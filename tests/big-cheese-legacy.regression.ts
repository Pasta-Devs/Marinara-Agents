import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityDocumentRecord, CapabilityDocumentStore } from "@marinara-engine/shared";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { placeKitOf } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/index.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import { endTerm } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/term.js";
import { goalById } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/goals.js";
import { createLegacy } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/legacy.js";
import {
  BigCheeseError,
  createRunStore,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/store.js";
import type { Run } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/types.js";

const run = (legacy?: number, seed = 1) => {
  const s = core.newRun(core.HAFENKAI, seed);
  if (legacy !== undefined) s.layers = { legacy };
  return s;
};
const legacyThreads = (s: Run) => Object.values(s.threads).filter((t) => t.layer === "legacy");

test("the legacy dial defaults to 0 and opens nothing", () => {
  const s = run();
  assert.equal(core.dial(s, "legacy"), 0);
  for (let i = 0; i < 60; i++) core.layerSeeds(s, 5);
  assert.equal(legacyThreads(s).length, 0);
});

test("dial 100 opens a protege thread, one at a time", () => {
  const s = run(100);
  for (let i = 0; i < 60; i++) core.layerSeeds(s, 5);
  assert.equal(legacyThreads(s).length, 1);
});

test("naming an heir needs the layer and an active person", () => {
  assert.throws(() => core.nameHeir(run(), "henrike"), /layer is off/);
  const s = run(50);
  assert.throws(() => core.nameHeir(s, "nobody"), /Not a person/);
  assert.throws(() => core.nameHeir(s, "__proto__"), /Not a person/);
  const named = core.nameHeir(s, "henrike");
  assert.equal(named.legacy?.heir, "henrike");
  assert.equal(named.legacy?.generation, 1);
  assert.equal(s.legacy, null); // the pure version leaves the old state alone
  assert.equal(core.nameHeir(named, "sven").legacy?.heir, "sven");
});

test("the heir goal reads legacy.heir", () => {
  const s = run(50);
  assert.equal(goalById("heir")!.check(s, { since: 0, hist: [], gain: () => 0 }), false);
  assert.equal(goalById("heir")!.check(core.nameHeir(s, "henrike"), { since: 0, hist: [], gain: () => 0 }), true);
});

test("an heir who has left is dropped at term end", () => {
  const s = core.nameHeir(run(50), "henrike");
  s.people.henrike!.status = "on_leave";
  endTerm(s);
  assert.equal(s.legacy?.heir, "henrike");
  s.people.henrike!.status = "quit";
  endTerm(s);
  assert.equal(s.legacy?.heir, undefined);
  assert.equal(s.legacy?.generation, 1);
});

test("a legacy run needs an heir and a finished run", () => {
  const s = core.nameHeir(run(50), "henrike");
  assert.throws(() => core.legacyRun(s, HAFENKAI_PLACE, 7), /Finish this run/);
  const done = { ...run(50), status: "complete" as const };
  assert.throws(() => core.legacyRun(done, HAFENKAI_PLACE, 7), /Name an heir/);
});

test("a legacy run keeps people, traditions and culture and resets meters", () => {
  const old = core.nameHeir(run(60), "sven");
  old.status = "ended";
  old.ending = "Fired";
  old.meters = { money: 1, output: 2, people: 3, standing: 4 };
  old.people.tomasz!.traits = ["Former soldier"];
  old.people.tomasz!.trust = 5;
  old.traditions = [{ id: "t1", text: "Friday cake", count: 3, active: true }];
  old.culture = { family: 4 };
  old.relations.push({ a: "tomasz", b: "olga", kind: "enemy", level: 70 });
  const next = core.legacyRun(old, HAFENKAI_PLACE, 9, "old-run");
  assert.deepEqual(next.legacy, { generation: 2, from: "old-run" });
  assert.equal(next.status, "playing");
  assert.equal(next.deputy, "sven");
  assert.deepEqual(next.meters, core.newRun(core.HAFENKAI, 9).meters);
  assert.deepEqual(next.people.tomasz!.traits, ["Former soldier"]);
  assert.notEqual(next.people.tomasz!.trust, 5);
  assert.equal(
    next.people.tomasz!.memories.at(-1)?.about,
    "The last boss: Fired.".replace("boss", HAFENKAI_PLACE.bossTitle),
  );
  assert.ok(next.traditions.some((t) => t.id === "t1" && t.active && t.count === 3));
  assert.equal(next.culture.family, 4);
  assert.ok(next.relations.some((r) => r.a === "tomasz" && r.b === "olga" && r.kind === "enemy"));
  assert.deepEqual(next.layers, { legacy: 60 });
  // a copy, not shared with the old run
  next.layers.legacy = 1;
  next.people.tomasz!.traits!.push("x");
  assert.equal(old.layers.legacy, 60);
  assert.deepEqual(old.people.tomasz!.traits, ["Former soldier"]);
  // the second generation counts on
  const third = core.legacyRun({ ...core.nameHeir(next, "sven"), status: "complete" }, HAFENKAI_PLACE, 3);
  assert.equal(third.legacy?.generation, 3);
});

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

test("routes: name an heir, then start the next run from a finished one", async () => {
  const store = createRunStore(fakeDocuments());
  const legacy = createLegacy(store);
  const { id } = await store.create("hafenkai");
  const bad = (p: Promise<unknown>, code: number) =>
    assert.rejects(p, (e) => e instanceof BigCheeseError && e.statusCode === code);
  await bad(legacy.heir(id, { expectedRevision: 0, person: "henrike" }), 400); // layer off
  await store.update(id, 0, (r) => ({ ...r, game: { ...r.game, layers: { legacy: 50 } } }));
  await bad(legacy.heir(id, { expectedRevision: 0, person: "henrike" }), 409); // stale
  await bad(legacy.heir(id, { expectedRevision: 1, person: "nobody" }), 400);
  await bad(legacy.heir(id, { person: "henrike" }), 400);
  await legacy.heir(id, { expectedRevision: 1, person: "henrike" });
  // the old run is still playing: no next run
  await bad(legacy.next(id, { expectedRevision: 2 }), 409);
  await store.update(id, 2, (r) => ({ ...r, game: { ...r.game, status: "complete" } }));
  const view = (await legacy.next(id, { expectedRevision: 3 })) as { run: { id: string; game: Run } };
  assert.notEqual(view.run.id, id);
  assert.equal(view.run.game.legacy?.generation, 2);
  assert.equal(view.run.game.legacy?.from, id);
  assert.equal(view.run.game.deputy, "henrike");
  assert.equal(view.run.game.status, "playing");
  assert.equal((await store.get(id)).game.status, "complete"); // the old run stays
  const list = await store.list();
  assert.equal(list.length, 2);
  assert.equal(list.find((r) => r.id === view.run.id)!.generation, 2);
  // a second post (stale revision, double click) opens the same next run
  const again = (await legacy.next(id, { expectedRevision: 3 })) as { run: { id: string } };
  assert.equal(again.run.id, view.run.id);
  assert.equal((await store.list()).length, 2);
  assert.equal(placeKitOf(await store.get(view.run.id)).bossTitle, HAFENKAI_PLACE.bossTitle);
});
