// T1: the saved kits library. A kit from outside is checked and fixed, a broken one is refused with
// reasons, and a run from a saved kit plays one week on that kit's own rooms and routines.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { CapabilityDocumentRecord, CapabilityDocumentStore } from "@marinara-engine/shared";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { rulesOf } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/index.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import { normalizeKit } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/normalize.js";
import type { PlaceKit } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/types.js";
import { createKits } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/kits.js";
import {
  BigCheeseError,
  createRunStore,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/store.js";

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
  } as CapabilityDocumentStore;
}

// A kit with its own room ids: nothing in it matches the built-in place.
const own = (): PlaceKit => {
  const k = structuredClone(HAFENKAI_PLACE) as PlaceKit;
  const map = (id: string) => (id === "home" ? id : `x-${id}`);
  k.id = "own-place";
  k.name = "Own place";
  k.rooms = k.rooms.map((r) => ({ ...r, id: map(r.id) }));
  k.people = k.people.map((p) => ({
    ...p,
    routine: Object.fromEntries(Object.entries(p.routine ?? {}).map(([slot, room]) => [slot, map(room)])),
  }));
  return k;
};

const ok = (raw: unknown) => {
  const r = normalizeKit(raw);
  assert.ok(r.ok, r.ok ? "" : r.reasons.join(" "));
  return r;
};

test("a built-in kit passes the check unchanged", () => {
  const r = ok(structuredClone(HAFENKAI_PLACE));
  assert.equal(r.kit.rooms.length, HAFENKAI_PLACE.rooms.length);
  assert.equal(r.kit.people.length, HAFENKAI_PLACE.people.length);
});

test("an invalid kit is refused with reasons", () => {
  const few = { ...structuredClone(HAFENKAI_PLACE), rooms: HAFENKAI_PLACE.rooms.slice(0, 2), people: [] };
  const r = normalizeKit(few);
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.reasons.length >= 2);
  assert.equal(normalizeKit("text").ok, false);
  assert.equal(normalizeKit({ ...structuredClone(HAFENKAI_PLACE), meetings: [] }).ok, false);
});

test("the normalizer fixes ids, meters, the deputy and rooms without a purpose", () => {
  const bad = structuredClone(HAFENKAI_PLACE) as PlaceKit;
  bad.people = bad.people.map((p) => ({ ...p, deputy: false }));
  bad.people[1]!.id = bad.people[0]!.id; // a repeated id
  bad.rooms[0]!.feeds = null; // a work room that feeds nothing
  bad.rooms[0]!.id = "Dock A!";
  (bad.meters as Record<string, unknown>).luck = { label: "Luck", start: 5 };
  delete (bad.meters as Partial<PlaceKit["meters"]>).money;
  const { kit } = ok(bad);
  assert.equal(new Set(kit.people.map((p) => p.id)).size, kit.people.length);
  assert.equal(kit.people.filter((p) => p.deputy).length, 1);
  assert.equal(kit.rooms[0]!.id, "dock-a");
  assert.equal(kit.rooms[0]!.feeds, "output");
  assert.deepEqual(Object.keys(kit.meters).sort(), ["money", "output", "people", "standing"]);
});

test("an import with prototype keys is refused", () => {
  const raw = JSON.parse(JSON.stringify(HAFENKAI_PLACE).replace(/^{/, '{"__proto__":{"x":1},'));
  assert.equal(normalizeKit(raw).ok, false);
  assert.equal(normalizeKit({ ...structuredClone(HAFENKAI_PLACE), premise: "x".repeat(300_000) }).ok, false);
  assert.equal(({} as Record<string, unknown>).x, undefined);
});

test("a kit with its own rooms and routines gets them in core", () => {
  const kit = ok(own()).kit;
  const s = core.newRun(rulesOf(kit), 7, kit);
  assert.deepEqual(Object.keys(s.rooms).sort(), kit.rooms.map((r) => r.id).sort());
  for (let d = 0; d < 5; d++) core.draft.endDay(s, kit);
  assert.equal(s.status, "playing");
  const placed = Object.values(s.rooms).flatMap((r) => r.people);
  assert.ok(placed.length > 0);
  assert.ok(Object.keys(s.rooms).every((id) => id.startsWith("x-")));
});

test("the saved kits library saves, lists, imports and repairs", async () => {
  const good = own();
  const kits = createKits(fakeDocuments(), async () => undefined);
  const saved = await kits.save(good);
  assert.equal(saved.kit.id, "own-place");
  assert.equal((await kits.save({ ...good, name: "Renamed" })).kit.id, "own-place"); // same id replaces
  const imported = await kits.import(good); // an import never replaces
  assert.notEqual(imported.kit.id, "own-place");
  assert.equal((await kits.list()).length, 2);
  assert.equal((await kits.get("own-place")).name, "Renamed");
  await assert.rejects(
    kits.import({ ...good, people: [] }),
    (e: unknown) => e instanceof BigCheeseError && e.statusCode === 400,
  );
  await assert.rejects(kits.get("nope"), (e: unknown) => e instanceof BigCheeseError && e.statusCode === 404);

  // The model gets one try on a broken import, and its answer is checked again.
  const broken = { ...good, people: good.people.slice(0, 3) };
  const answer = (kit: PlaceKit) => async () => JSON.stringify({ kit });
  const repairing = createKits(fakeDocuments(), async () => answer(good));
  assert.equal((await repairing.import(broken)).kit.people.length, good.people.length);
  const lying = createKits(fakeDocuments(), async () => answer(broken));
  await assert.rejects(lying.import(broken), (e: unknown) => e instanceof BigCheeseError && e.statusCode === 400);
});

test("a run from a saved kit freezes the kit and plays on it", async () => {
  const kit = ok(own()).kit;
  const store = createRunStore(fakeDocuments());
  const run = await store.create("hafenkai", true, undefined, undefined, kit);
  assert.equal(run.kit?.id, "own-place");
  assert.ok(Object.keys(run.game.rooms).every((id) => id.startsWith("x-")));
  assert.equal((await store.get(run.id)).kit?.id, "own-place");
});
