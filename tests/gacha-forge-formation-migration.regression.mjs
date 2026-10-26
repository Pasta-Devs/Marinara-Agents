import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createForgeFormationMigration,
  forgeFormationUnitFingerprint,
} from "../packages/gacha-forge/src/formation-migration-server.mjs";
import { createForgeStoryCancellation } from "../packages/gacha-forge/src/story-cancel-server.mjs";

const runId = "formation-world",
  packageId = "gacha-forge";
const clone = structuredClone;
const kit = { version: 1, standard: { name: "New skill" } };
const normalizeKit = (value) => (value?.version === 1 ? clone(value) : null);
const tick = () => new Promise((resolve) => setImmediate(resolve));

function fixture({ count = 5, generate = async () => kit, cancellationOptions, retireInactiveFight } = {}) {
  const docs = new Map();
  const seed = (id, kind, data) =>
    docs.set(id, {
      id,
      packageId,
      kind,
      revision: 1,
      name: `Saved ${id}`,
      description: "Saved metadata",
      data: clone(data),
    });
  seed("index", "index", { runs: [{ runId, name: "Kept world", combat: { mode: "classic" } }] });
  seed(`${runId}:session`, "session", {
    wallet: { aether: 123, funds: 456 },
    inventory: { weapon: 2 },
    progress: { 1: { normal: 10 } },
    presets: [{ board: { front: ["@protagonist"], back: [] } }],
  });
  for (let i = 0; i < count; i++)
    seed(`${runId}:unit:${i}`, "unit", {
      kind: "character",
      name: `Hero ${i}`,
      affinity: "fire",
      cardId: `card-${i}`,
      skill: { name: "Classic skill" },
      portrait: `portrait-${i}`,
      stats: { hp: 77 },
    });
  seed(`${runId}:unit:weapon`, "unit", { kind: "weapon", name: "Sword" });
  seed("other-world:unit:0", "unit", { kind: "character", name: "Other" });
  let conflict = "",
    tail = Promise.resolve();
  const documents = {
    getById: async (_package, id) => clone(docs.get(id) || null),
    list: async (_package, kind) => clone([...docs.values()].filter((row) => row.kind === kind)),
    create: async (row) => {
      assert(!docs.has(row.id));
      const saved = { ...clone(row), revision: 1 };
      docs.set(row.id, saved);
      return clone(saved);
    },
    update: async (row) => {
      const previous = docs.get(row.id);
      if (row.id === conflict || previous?.revision !== row.expectedRevision) return null;
      const saved = { ...previous, ...clone(row), revision: previous.revision + 1 };
      docs.set(row.id, saved);
      return clone(saved);
    },
  };
  const persistence = {
    documents,
    transaction(work) {
      const promise = tail.then(async () => {
        const before = clone(docs);
        try {
          return await work({ documents });
        } catch (error) {
          docs.clear();
          for (const [id, row] of before) docs.set(id, row);
          throw error;
        }
      });
      tail = promise.catch(() => {});
      return promise;
    },
  };
  const cancellation = createForgeStoryCancellation(cancellationOptions);
  const create = () =>
    createForgeFormationMigration({
      packageId,
      persistence,
      cancellation,
      normalizeKit,
      generateKit: generate,
      retireInactiveFight,
    });
  const service = create();
  return {
    docs,
    seed,
    service,
    create,
    documents,
    cancellation,
    conflict: (id) => {
      conflict = id;
    },
    dispose() {
      service.dispose();
      cancellation.dispose();
    },
  };
}

test("conversion requires confirmation and keeps pending battles and oversized teams intact", async () => {
  const f = fixture();
  const before = clone(f.docs);
  assert.equal((await f.service.start({ runId, targetMode: "formation" })).error, "confirmation-required");
  assert.deepEqual(f.docs, before);
  const session = f.docs.get(`${runId}:session`).data;
  session.combatPending = { snapshot: "classic" };
  assert.equal(
    (await f.service.start({ runId, targetMode: "formation", confirmed: true })).error,
    "combat-in-progress",
  );
  delete session.combatPending;
  session.presets[0].board = { front: ["a", "b", "c"], back: ["d", "e"] };
  assert.equal(
    (await f.service.start({ runId, targetMode: "formation", confirmed: true })).error,
    "formation-team-too-large",
  );
  assert.equal(f.docs.has(`${runId}:formation-conversion`), false);
  f.dispose();
});

test("bounded parallel conversion commits all kits atomically and preserves identity and saved state", async () => {
  let inFlight = 0,
    high = 0,
    calls = 0;
  const f = fixture({
    generate: async () => {
      calls++;
      inFlight++;
      high = Math.max(high, inFlight);
      await tick();
      inFlight--;
      return kit;
    },
  });
  const before = clone(f.docs);
  await f.service.start({ runId, targetMode: "formation", confirmed: true });
  assert.equal((await f.service.guard(runId)).error, "combat-conversion-in-progress");
  await f.service.settled(runId);
  assert.equal(calls, 5);
  assert.equal(high, 3);
  const status = await f.service.status({ runId });
  assert.equal(status.mode, "formation");
  assert.equal(status.conversion.status, "committed");
  assert.deepEqual(f.docs.get(`${runId}:session`), before.get(`${runId}:session`));
  for (let i = 0; i < 5; i++) {
    const id = `${runId}:unit:${i}`,
      row = f.docs.get(id),
      previous = before.get(id);
    assert.equal(row.name, previous.name);
    assert.equal(row.description, previous.description);
    assert.deepEqual(row.data, {
      ...previous.data,
      formationKit: kit,
      formationKitSource: forgeFormationUnitFingerprint(previous.data),
    });
  }
  for (const id of [`${runId}:unit:weapon`, "other-world:unit:0"]) assert.deepEqual(f.docs.get(id), before.get(id));
  f.dispose();
});

test("partial generation failure leaves Classic active and explicit retry reuses ready kits", async () => {
  const calls = new Map();
  const f = fixture({
    count: 3,
    generate: async ({ unit }) => {
      calls.set(unit.name, (calls.get(unit.name) || 0) + 1);
      if (unit.name === "Hero 1" && calls.get(unit.name) === 1) throw new Error("controlled failure");
      return kit;
    },
  });
  await f.service.start({ runId, targetMode: "formation", confirmed: true });
  await f.service.settled(runId);
  const failed = await f.service.status({ runId });
  assert.equal(failed.mode, "classic");
  assert.equal(failed.conversion.status, "failed");
  assert.equal(f.docs.get(`${runId}:unit:0`).data.formationKit, undefined);
  assert.equal((await f.service.retry({ runId, jobId: "forged", confirmed: true })).error, "conversion-changed");
  await f.service.retry({ runId, jobId: failed.conversion.id, confirmed: true });
  await f.service.settled(runId);
  assert.equal((await f.service.status({ runId })).mode, "formation");
  assert.deepEqual([...calls.values()], [1, 2, 1]);
  f.dispose();
});

test("restart never automatically regenerates an interrupted paid attempt", async () => {
  let calls = 0;
  const f = fixture({
    count: 1,
    generate: async () => {
      calls++;
      return kit;
    },
  });
  const row = f.docs.get(`${runId}:unit:0`);
  f.seed(`${runId}:formation-conversion`, "formation-conversion", {
    id: "previous-job",
    runId,
    sourceMode: "classic",
    sourceRevision: 0,
    targetMode: "formation",
    status: "preparing",
    units: {
      [row.id]: {
        unitId: row.id,
        name: row.data.name,
        fingerprint: forgeFormationUnitFingerprint(row.data),
        status: "generating",
        owner: "previous-process",
        attempt: "paid-once",
      },
    },
  });
  await f.service.status({ runId });
  await f.service.settled(runId);
  const status = await f.service.status({ runId });
  assert.equal(calls, 0);
  assert.equal(status.mode, "classic");
  assert.equal(status.conversion.units[0].error, "generation-interrupted");
  await f.service.retry({ runId, jobId: status.conversion.id, confirmed: true });
  await f.service.settled(runId);
  assert.equal(calls, 1);
  assert.equal((await f.service.status({ runId })).mode, "formation");
  f.dispose();
});

test("a commit conflict rolls back every kit and retry does not repay completed generations", async () => {
  let calls = 0;
  const f = fixture({
    count: 2,
    generate: async () => {
      calls++;
      return kit;
    },
  });
  const before = clone(f.docs);
  f.conflict("index");
  await f.service.start({ runId, targetMode: "formation", confirmed: true });
  await f.service.settled(runId);
  const failed = await f.service.status({ runId });
  assert.equal(failed.mode, "classic");
  assert.equal(failed.conversion.status, "failed");
  assert.deepEqual(f.docs.get(`${runId}:unit:0`), before.get(`${runId}:unit:0`));
  assert.deepEqual(f.docs.get(`${runId}:unit:1`), before.get(`${runId}:unit:1`));
  f.conflict("");
  await f.service.retry({ runId, jobId: failed.conversion.id, confirmed: true });
  await f.service.settled(runId);
  assert.equal(calls, 2);
  assert.equal((await f.service.status({ runId })).mode, "formation");
  f.dispose();
});

test("cancel fences late provider results without changing the active mode", async () => {
  const ready = Promise.withResolvers(),
    release = Promise.withResolvers();
  const f = fixture({
    count: 1,
    generate: async () => {
      ready.resolve();
      await release.promise;
      return kit;
    },
  });
  const started = await f.service.start({ runId, targetMode: "formation", confirmed: true });
  await ready.promise;
  await f.service.cancel({ runId, jobId: started.conversion.id });
  release.resolve();
  await f.service.settled(runId);
  assert.equal((await f.service.status({ runId })).mode, "classic");
  assert.equal(f.docs.get(`${runId}:unit:0`).data.formationKit, undefined);
  f.dispose();
});

test("identity changes during generation reject stale kits and explicit retry uses the current character", async () => {
  let calls = 0;
  const f = fixture({
    count: 1,
    generate: async ({ unit }) => {
      calls++;
      if (calls === 1) {
        const row = f.docs.get(`${runId}:unit:0`);
        await f.documents.update({ ...row, expectedRevision: row.revision, data: { ...row.data, affinity: "water" } });
      }
      return { ok: true, value: { ...kit, affinity: unit.affinity } };
    },
  });
  await f.service.start({ runId, targetMode: "formation", confirmed: true });
  await f.service.settled(runId);
  const failed = await f.service.status({ runId });
  assert.equal(failed.mode, "classic");
  assert.equal(failed.conversion.error, "units-changed");
  assert.equal(f.docs.get(`${runId}:unit:0`).data.formationKit, undefined);
  await f.service.retry({ runId, jobId: failed.conversion.id, confirmed: true });
  await f.service.settled(runId);
  assert.equal(calls, 2);
  assert.equal(f.docs.get(`${runId}:unit:0`).data.formationKit.affinity, "water");
  f.dispose();
});

test("a newly pending battle prevents final commit and retry retains paid ready kits", async () => {
  let calls = 0;
  const f = fixture({
    count: 1,
    generate: async () => {
      calls++;
      f.docs.get(`${runId}:session`).data.farmPending = { snapshot: "classic" };
      return kit;
    },
  });
  await f.service.start({ runId, targetMode: "formation", confirmed: true });
  await f.service.settled(runId);
  const failed = await f.service.status({ runId });
  assert.equal(failed.mode, "classic");
  assert.equal(failed.conversion.error, "combat-in-progress");
  delete f.docs.get(`${runId}:session`).data.farmPending;
  await f.service.retry({ runId, jobId: failed.conversion.id, confirmed: true });
  await f.service.settled(runId);
  assert.equal(calls, 1);
  assert.equal((await f.service.status({ runId })).mode, "formation");
  f.dispose();
});

test("a later new unit receives a missing kit without remaking existing Formation characters", async () => {
  let calls = 0;
  const f = fixture({
    count: 1,
    generate: async () => {
      calls++;
      return kit;
    },
  });
  await f.service.start({ runId, targetMode: "formation", confirmed: true });
  await f.service.settled(runId);
  f.seed(`${runId}:unit:new`, "unit", { kind: "character", name: "New arrival", affinity: "wind" });
  const run = f.docs.get("index").data.runs[0];
  assert.equal((await f.service.ensure(runId, run)).error, "combat-conversion-in-progress");
  await f.service.settled(runId);
  assert.equal(calls, 2);
  assert.deepEqual(f.docs.get(`${runId}:unit:new`).data.formationKit, kit);
  f.dispose();
});

test("switching back restores Classic without deleting Formation kits or generating again", async () => {
  let calls = 0;
  const f = fixture({
    count: 1,
    generate: async () => {
      calls++;
      return kit;
    },
  });
  await f.service.start({ runId, targetMode: "formation", confirmed: true });
  await f.service.settled(runId);
  const saved = clone(f.docs.get(`${runId}:unit:0`).data);
  await f.service.start({ runId, targetMode: "classic", confirmed: true });
  await f.service.settled(runId);
  assert.equal((await f.service.status({ runId })).mode, "classic");
  assert.deepEqual(f.docs.get(`${runId}:unit:0`).data, saved);
  assert.equal(calls, 1);
  f.dispose();
});

test("commit waits for actual story work and times out before any live kit or mode changes", async () => {
  let calls = 0;
  const release = Promise.withResolvers(),
    started = Promise.withResolvers();
  const f = fixture({
    count: 1,
    cancellationOptions: { resetDrainTimeoutMs: 5 },
    generate: async () => {
      calls++;
      return kit;
    },
  });
  const old = f.cancellation.run(runId, async () => {
    started.resolve();
    await release.promise;
  });
  await started.promise;
  await f.service.start({ runId, targetMode: "formation", confirmed: true });
  await f.service.settled(runId);
  const failed = await f.service.status({ runId });
  assert.equal(failed.mode, "classic");
  assert.equal(failed.conversion.error, "reset-drain-timeout");
  assert.equal(f.docs.get(`${runId}:unit:0`).data.formationKit, undefined);
  release.resolve();
  await old;
  await tick();
  await f.service.retry({ runId, jobId: failed.conversion.id, confirmed: true });
  await f.service.settled(runId);
  assert.equal(calls, 1);
  assert.equal((await f.service.status({ runId })).mode, "formation");
  f.dispose();
});

test("world deletion fences a late provider and never recreates deleted jobs or characters", async () => {
  const ready = Promise.withResolvers(),
    release = Promise.withResolvers();
  const f = fixture({
    count: 1,
    generate: async () => {
      ready.resolve();
      await release.promise;
      return kit;
    },
  });
  await f.service.start({ runId, targetMode: "formation", confirmed: true });
  await ready.promise;
  f.service.removeWorld(runId);
  f.docs.get("index").data.runs = [];
  for (const id of [...f.docs.keys()]) if (id.startsWith(`${runId}:`)) f.docs.delete(id);
  const deleted = clone(f.docs);
  release.resolve();
  await f.service.settled(runId);
  assert.deepEqual(f.docs, deleted);
  assert.equal((await f.service.status({ runId })).error, "not-found");
  f.dispose();
});

test("queued characters use the exact identity they have when their paid generation starts", async () => {
  let calls = 0;
  const occupied = Promise.withResolvers(),
    release = Promise.withResolvers();
  const f = fixture({
    count: 4,
    generate: async ({ unit }) => {
      calls++;
      if (calls === 3) occupied.resolve();
      if (unit.name !== "Hero 3") await release.promise;
      return { ...kit, affinity: unit.affinity };
    },
  });
  await f.service.start({ runId, targetMode: "formation", confirmed: true });
  await occupied.promise;
  const queued = f.docs.get(`${runId}:unit:3`);
  await f.documents.update({
    ...queued,
    expectedRevision: queued.revision,
    data: { ...queued.data, affinity: "water" },
  });
  release.resolve();
  await f.service.settled(runId);
  const status = await f.service.status({ runId });
  assert.equal(status.mode, "formation");
  assert.equal(calls, 4);
  assert.equal(f.docs.get(`${runId}:unit:3`).data.formationKit.affinity, "water");
  f.dispose();
});

test("retry regenerates an invalid staged ready kit instead of trapping conversion in a loop", async () => {
  let calls = 0;
  const f = fixture({
    count: 1,
    generate: async () => {
      calls++;
      return kit;
    },
  });
  f.conflict("index");
  await f.service.start({ runId, targetMode: "formation", confirmed: true });
  await f.service.settled(runId);
  const failed = await f.service.status({ runId });
  f.docs.get(`${runId}:formation-conversion`).data.units[`${runId}:unit:0`].kit = null;
  f.conflict("");
  await f.service.retry({ runId, jobId: failed.conversion.id, confirmed: true });
  await f.service.settled(runId);
  assert.equal(calls, 2);
  assert.equal((await f.service.status({ runId })).mode, "formation");
  f.dispose();
});

test("optional inactive-event cleanup runs before confirmed admission, never before confirmation", async () => {
  let retired = 0;
  const f = fixture({
    count: 1,
    retireInactiveFight: async () => {
      retired++;
      delete f.docs.get(`${runId}:session`).data.combatPending;
    },
  });
  f.docs.get(`${runId}:session`).data.combatPending = { chapter: "event-1", expired: true };
  assert.equal((await f.service.start({ runId, targetMode: "formation" })).error, "confirmation-required");
  assert.equal(retired, 0);
  assert.ok(f.docs.get(`${runId}:session`).data.combatPending);
  assert.equal((await f.service.start({ runId, targetMode: "formation", confirmed: true })).ok, true);
  await f.service.settled(runId);
  assert.ok(retired >= 1);
  assert.equal((await f.service.status({ runId })).mode, "formation");
  f.dispose();
});

test("a failed character keeps its error code, and starting again after a cancel reuses ready kits", async () => {
  const calls = new Map();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const f = fixture({
    count: 3,
    generate: async ({ unit, signal }) => {
      calls.set(unit.name, (calls.get(unit.name) || 0) + 1);
      if (unit.name === "Hero 1" && calls.get(unit.name) === 1) throw new Error("generation-output-capacity");
      if (unit.name === "Hero 2" && calls.get(unit.name) === 1) {
        await gate;
        signal.throwIfAborted();
      }
      return kit;
    },
  });
  const started = await f.service.start({ runId, targetMode: "formation", confirmed: true });
  let units = [];
  for (let attempt = 0; attempt < 100; attempt++) {
    units = (await f.service.status({ runId })).conversion.units;
    if (units.find((unit) => unit.name === "Hero 0").status === "ready" && units[1].status === "failed") break;
    await tick();
  }
  assert.deepEqual(
    units.map(({ status, error }) => [status, error]),
    [
      ["ready", ""],
      ["failed", "generation-output-capacity"],
      ["generating", ""],
    ],
  );
  assert.equal((await f.service.cancel({ runId, jobId: started.conversion.id })).conversion.status, "cancelled");
  release();
  await f.service.settled(runId);
  await f.service.start({ runId, targetMode: "formation", confirmed: true });
  await f.service.settled(runId);
  assert.equal((await f.service.status({ runId })).conversion.status, "committed");
  assert.deepEqual(Object.fromEntries(calls), { "Hero 0": 1, "Hero 1": 2, "Hero 2": 2 });
  f.dispose();
});
