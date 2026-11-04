import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityDocumentRecord, CapabilityDocumentStore } from "@marinara-engine/shared";
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
    data: { saveVersion: 2 },
    createdAt: at,
    updatedAt: at,
  });
  const store = createRunStore(documents);
  assert.equal((await store.list())[0].newer, true);
  await assert.rejects(store.get("r-000000000000"), (e) => e instanceof BigCheeseError && e.code === "newer-save");
});
