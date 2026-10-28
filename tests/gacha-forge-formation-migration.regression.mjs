import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createForgeFormationMigration,
  forgeFormationUnitFingerprint,
} from "../packages/gacha-forge/src/formation-migration-server.mjs";
import { createForgeStoryCancellation } from "../sources/forge-kit/story-cancel-server.mjs";

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
      kitPrompt: 2,
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
  // Six seats are a full team; a fourth fighter in front is not.
  session.presets[0].board = { front: ["a", "b", "c", "g"], back: ["d", "e"] };
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
      formationKitPrompt: 2,
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

test("a full 3+3 team converts", async () => {
  const f = fixture({ count: 1 });
  f.docs.get(`${runId}:session`).data.presets[0].board = { front: ["a", "b", "c"], back: ["d", "e", "f"] };
  assert.equal((await f.service.start({ runId, targetMode: "formation", confirmed: true })).ok, true);
  await f.service.settled(runId);
  assert.equal((await f.service.status({ runId })).mode, "formation");
  f.dispose();
});

// Kits written for the old Formation rules fight on, but a Formation world remakes them before its next battle.
function formationWorld(f, stamps) {
  f.docs.get("index").data.runs[0].combat = { mode: "formation", revision: 1 };
  stamps.forEach((stamp, index) => {
    const data = f.docs.get(`${runId}:unit:${index}`).data;
    data.formationKit = { version: 1, standard: { name: `Old ${index}` } };
    if (stamp != null) data.formationKitPrompt = stamp;
  });
  return f.docs.get("index").data.runs[0];
}

test("old-rule kits are remade automatically on a Formation world's next battle, and only the stale ones", async () => {
  let calls = 0;
  const f = fixture({
    count: 3,
    generate: async () => {
      calls++;
      return kit;
    },
  });
  const run = formationWorld(f, [undefined, 1, 2]);
  assert.equal((await f.service.status({ runId })).staleKits, 2);
  const blocked = await f.service.ensure(runId, run);
  assert.equal(blocked.error, "combat-conversion-in-progress", "the battle waits for the remake");
  await f.service.settled(runId);
  assert.equal(calls, 2);
  assert.deepEqual(f.docs.get(`${runId}:unit:2`).data.formationKit, { version: 1, standard: { name: "Old 2" } });
  for (const index of [0, 1]) {
    assert.deepEqual(f.docs.get(`${runId}:unit:${index}`).data.formationKit, kit);
    assert.equal(f.docs.get(`${runId}:unit:${index}`).data.formationKitPrompt, 2);
  }
  const status = await f.service.status({ runId });
  assert.equal(status.staleKits, 0);
  assert.equal(status.mode, "formation");
  assert.deepEqual(await f.service.ensure(runId, f.docs.get("index").data.runs[0]), { ok: true });
  f.dispose();
});

test("a failed or cancelled remake never blocks battles: the old kits keep fighting", async () => {
  for (const outcome of ["failed", "cancelled"]) {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const f = fixture({
      count: 1,
      generate: async ({ signal }) => {
        if (outcome === "failed") throw new Error("generation-failed");
        await gate;
        signal.throwIfAborted();
        return kit;
      },
    });
    const run = formationWorld(f, [1]);
    const started = await f.service.ensure(runId, run);
    assert.equal(started.error, "combat-conversion-in-progress");
    if (outcome === "cancelled") {
      await f.service.cancel({ runId, jobId: started.conversion.id });
      release();
    }
    await f.service.settled(runId);
    assert.equal((await f.service.status({ runId })).conversion.status, outcome);
    assert.deepEqual(await f.service.ensure(runId, run), { ok: true }, `${outcome} remake leaves old kits playable`);
    assert.equal(f.docs.get(`${runId}:unit:0`).data.formationKitPrompt, 1);
    assert.equal((await f.service.status({ runId })).staleKits, 1, "Settings still offers the remake");
    f.dispose();
  }
});

test("a Classic world never generates Formation kits, even when it holds old ones", async () => {
  let calls = 0;
  const f = fixture({
    count: 2,
    generate: async () => {
      calls++;
      return kit;
    },
  });
  const run = formationWorld(f, [1, undefined]);
  run.combat = { mode: "classic", revision: 2 };
  assert.deepEqual(await f.service.ensure(runId, run), { ok: true });
  assert.equal((await f.service.status({ runId })).staleKits, 0);
  assert.equal(f.docs.has(`${runId}:formation-conversion`), false);
  // Switching that world to Formation remakes them under the current rules.
  await f.service.start({ runId, targetMode: "formation", confirmed: true });
  await f.service.settled(runId);
  assert.equal(calls, 2);
  assert.equal(f.docs.get(`${runId}:unit:0`).data.formationKitPrompt, 2);
  f.dispose();
});

test("a leftover unfinished fight never blocks the remake, and the remake never waits for it", async () => {
  let calls = 0;
  const f = fixture({
    count: 2,
    generate: async () => {
      calls++;
      return kit;
    },
  });
  const run = formationWorld(f, [1, 1]);
  // A lost or abandoned fight stays pending until the next start overwrites it.
  f.docs.get(`${runId}:session`).data.combatPending = { chapter: 3, fight: { combatMode: "formation" } };
  f.docs.get(`${runId}:session`).data.farmPending = { stage: "funds", fight: { combatMode: "formation" } };
  assert.equal((await f.service.ensure(runId, run)).error, "combat-conversion-in-progress", "the remake starts");
  await f.service.settled(runId);
  assert.equal(calls, 2);
  assert.equal((await f.service.status({ runId })).conversion.status, "committed");
  assert.ok(f.docs.get(`${runId}:session`).data.combatPending, "the pending fight is left alone");
  assert.deepEqual(await f.service.ensure(runId, f.docs.get("index").data.runs[0]), { ok: true });
  f.dispose();
});

test("an older failed job awaiting its retry never locks battles while every kit can fight", async () => {
  const f = fixture({ count: 1, generate: async () => kit });
  const run = formationWorld(f, [1]);
  f.seed(`${runId}:formation-conversion`, "formation-conversion", {
    id: "old-job",
    runId,
    sourceMode: "classic",
    targetMode: "formation",
    status: "failed",
    error: "unit-conversion-failed",
    units: {},
  });
  assert.deepEqual(await f.service.ensure(runId, run), { ok: true });
  f.dispose();
});

test("a character whose kit failed under the current rules waits for Retry; battle starts never pay again", async () => {
  let calls = 0,
    fail = true;
  const f = fixture({
    count: 2,
    generate: async ({ unit }) => {
      calls++;
      if (fail && unit.name === "Hero 1") throw new Error("invalid-kit");
      return kit;
    },
  });
  // Hero 0 has a current kit; Hero 1 has none at all.
  const run = formationWorld(f, [2]);
  assert.equal((await f.service.ensure(runId, run)).error, "combat-conversion-in-progress");
  await f.service.settled(runId);
  assert.equal(calls, 1);
  const failed = (await f.service.status({ runId })).conversion;
  assert.equal(failed.status, "failed");
  for (let battle = 0; battle < 2; battle++) {
    const blocked = await f.service.ensure(runId, run);
    assert.equal(blocked.error, "combat-conversion-failed", "the battle start points at Retry");
    assert.equal(blocked.conversion.id, failed.id, "the failed job is left for its retry");
    await f.service.settled(runId);
  }
  assert.equal(calls, 1, "no battle start launches another paid generation");
  fail = false;
  assert.equal((await f.service.retry({ runId, jobId: failed.id, confirmed: true })).ok, true);
  await f.service.settled(runId);
  assert.equal(calls, 2, "Retry generates only the missing kit");
  assert.deepEqual(f.docs.get(`${runId}:unit:1`).data.formationKit, kit);
  assert.deepEqual(await f.service.ensure(runId, f.docs.get("index").data.runs[0]), { ok: true });
  f.dispose();
});

test("Retry after a cancelled remake and a failed new kit pays only for the new kit and keeps the old ones", async () => {
  const calls = [];
  let release,
    fail = true;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const f = fixture({
    count: 3,
    generate: async ({ unit, signal }) => {
      calls.push(unit.name);
      if (unit.name === "New arrival") {
        if (fail) throw new Error("invalid-kit");
        return kit;
      }
      await gate;
      signal.throwIfAborted();
      return kit;
    },
  });
  const run = formationWorld(f, [1, 1, 1]);
  const remake = await f.service.ensure(runId, run);
  await f.service.cancel({ runId, jobId: remake.conversion.id });
  release();
  await f.service.settled(runId);
  // A new pull has no kit, and its generation fails.
  f.seed(`${runId}:unit:new`, "unit", { kind: "character", name: "New arrival", affinity: "wind" });
  assert.equal((await f.service.ensure(runId, run)).error, "combat-conversion-in-progress");
  await f.service.settled(runId);
  const failed = (await f.service.status({ runId })).conversion;
  assert.equal(failed.status, "failed");
  for (let battle = 0; battle < 2; battle++)
    assert.equal((await f.service.ensure(runId, run)).error, "combat-conversion-failed", "battles point at Retry");
  const stale = (await f.service.status({ runId })).staleKits;
  assert.equal(stale, 3);
  const paid = calls.length;
  fail = false;
  assert.equal((await f.service.retry({ runId, jobId: failed.id, confirmed: true })).ok, true);
  await f.service.settled(runId);
  assert.deepEqual(calls.slice(paid), ["New arrival"], "Retry generates one kit per missing character");
  assert.equal((await f.service.status({ runId })).conversion.status, "committed");
  for (const index of [0, 1, 2]) {
    assert.deepEqual(f.docs.get(`${runId}:unit:${index}`).data.formationKit, {
      version: 1,
      standard: { name: `Old ${index}` },
    });
    assert.equal(f.docs.get(`${runId}:unit:${index}`).data.formationKitPrompt, 1);
  }
  assert.equal((await f.service.status({ runId })).staleKits, stale, "Settings still offers the remake");
  assert.deepEqual(f.docs.get(`${runId}:unit:new`).data.formationKit, kit);
  f.dispose();
});

test("kits paid for in a cancelled or failed remake survive a new pull and are never paid for twice", async () => {
  for (const outcome of ["failed", "cancelled"]) {
    const calls = {};
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const f = fixture({
      count: 3,
      generate: async ({ unit, signal }) => {
        calls[unit.name] = (calls[unit.name] || 0) + 1;
        if (unit.name === "Hero 2" && calls[unit.name] === 1) {
          if (outcome === "failed") throw new Error("generation-failed");
          await gate;
          signal.throwIfAborted();
        }
        return kit;
      },
    });
    const run = formationWorld(f, [1, 1, 1]);
    const remake = await f.service.ensure(runId, run);
    if (outcome === "cancelled") {
      // Hero 0 and Hero 1 are generated and staged; Hero 2 is still being written when the player cancels.
      for (let wait = 0; wait < 500; wait++) {
        const units = (await f.service.status({ runId })).conversion.units;
        if (units.filter((unit) => unit.status === "ready").length === 2) break;
        await tick();
      }
      await f.service.cancel({ runId, jobId: remake.conversion.id });
      release();
    }
    await f.service.settled(runId);
    assert.equal((await f.service.status({ runId })).conversion.status, outcome);
    // A new pull, then a battle.
    f.seed(`${runId}:unit:new`, "unit", { kind: "character", name: "New arrival", affinity: "wind" });
    await f.service.ensure(runId, f.docs.get("index").data.runs[0]);
    await f.service.settled(runId);
    // Then the player finishes the remake: Retry for a failed job, "Remake kits now" otherwise.
    const state = await f.service.status({ runId });
    if (state.conversion.status === "failed")
      await f.service.retry({ runId, jobId: state.conversion.id, confirmed: true });
    else await f.service.start({ runId, targetMode: "formation", confirmed: true });
    await f.service.settled(runId);
    assert.equal((await f.service.status({ runId })).conversion.status, "committed", outcome);
    assert.deepEqual(
      calls,
      { "Hero 0": 1, "Hero 1": 1, "Hero 2": 2, "New arrival": 1 },
      `${outcome}: each kit is paid for once, plus Hero 2's interrupted attempt`,
    );
    for (const index of [0, 1, 2]) {
      assert.deepEqual(f.docs.get(`${runId}:unit:${index}`).data.formationKit, kit);
      assert.equal(f.docs.get(`${runId}:unit:${index}`).data.formationKitPrompt, 2);
    }
    assert.equal((await f.service.status({ runId })).staleKits, 0);
    f.dispose();
  }
});

test("kept kits stay one level deep across repeated only-missing jobs, and a paid stale kit is reused once", async () => {
  const calls = {};
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const f = fixture({
    count: 3,
    generate: async ({ unit, signal }) => {
      calls[unit.name] = (calls[unit.name] || 0) + 1;
      if (unit.name === "Hero 2" && calls[unit.name] === 1) {
        await gate;
        signal.throwIfAborted();
      }
      return kit;
    },
  });
  // Hero 0 is current; Hero 1 and Hero 2 are stale. The remake pays for Hero 1, then the player cancels.
  const run = formationWorld(f, [2, 1, 1]);
  const remake = await f.service.ensure(runId, run);
  for (let wait = 0; wait < 500; wait++) {
    const units = (await f.service.status({ runId })).conversion.units;
    if (units.find((unit) => unit.unitId === `${runId}:unit:1`)?.status === "ready") break;
    await tick();
  }
  await f.service.cancel({ runId, jobId: remake.conversion.id });
  release();
  await f.service.settled(runId);
  // Three pulls, each with its own only-missing job.
  for (let pull = 0; pull < 3; pull++) {
    f.seed(`${runId}:unit:new-${pull}`, "unit", { kind: "character", name: `New ${pull}`, affinity: "wind" });
    await f.service.ensure(runId, f.docs.get("index").data.runs[0]);
    await f.service.settled(runId);
    const job = f.docs.get(`${runId}:formation-conversion`).data;
    assert.equal(job.status, "committed", `pull ${pull}`);
    for (const [id, unit] of Object.entries(job.units)) {
      assert.equal(unit.staged?.staged, undefined, `${id}: staged stays flat`);
      if (id.endsWith(":unit:0") || id.includes(":unit:new-"))
        assert.equal(unit.staged, undefined, `${id}: a current kit stages nothing`);
    }
    assert.equal(job.units[`${runId}:unit:1`].staged.kitPrompt, 2, "the paid kit is still staged");
    assert.equal(job.units[`${runId}:unit:2`].staged, undefined, "nothing was paid for Hero 2");
  }
  // "Remake kits now" uses the staged kit instead of paying for Hero 1 again.
  await f.service.start({ runId, targetMode: "formation", confirmed: true });
  await f.service.settled(runId);
  assert.equal((await f.service.status({ runId })).conversion.status, "committed");
  assert.deepEqual(calls, { "Hero 1": 1, "Hero 2": 2, "New 0": 1, "New 1": 1, "New 2": 1 });
  assert.equal((await f.service.status({ runId })).staleKits, 0);
  f.dispose();
});

test("after a cancelled remake a new character still gets its kit, and the old kits stay as they are", async () => {
  let calls = 0,
    release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const f = fixture({
    count: 3,
    generate: async ({ unit, signal }) => {
      calls++;
      if (unit.name.startsWith("Hero")) {
        await gate;
        signal.throwIfAborted();
      }
      return kit;
    },
  });
  const run = formationWorld(f, [1, 1, 1]);
  const started = await f.service.ensure(runId, run);
  await f.service.cancel({ runId, jobId: started.conversion.id });
  release();
  await f.service.settled(runId);
  const paid = calls;
  // A new pull has no kit at all.
  f.seed(`${runId}:unit:new`, "unit", { kind: "character", name: "New arrival", affinity: "wind" });
  assert.equal((await f.service.ensure(runId, run)).error, "combat-conversion-in-progress");
  await f.service.settled(runId);
  assert.equal(calls, paid + 1, "only the new character is generated");
  assert.deepEqual(f.docs.get(`${runId}:unit:new`).data.formationKit, kit);
  for (const index of [0, 1, 2]) assert.equal(f.docs.get(`${runId}:unit:${index}`).data.formationKitPrompt, 1);
  assert.equal((await f.service.status({ runId })).staleKits, 3, "Settings still offers the remake");
  for (let battle = 0; battle < 2; battle++)
    assert.deepEqual(await f.service.ensure(runId, f.docs.get("index").data.runs[0]), { ok: true });
  assert.equal(calls, paid + 1);
  // Settings' remake still remakes them all.
  await f.service.start({ runId, targetMode: "formation", confirmed: true });
  await f.service.settled(runId);
  for (const index of [0, 1, 2]) assert.equal(f.docs.get(`${runId}:unit:${index}`).data.formationKitPrompt, 2);
  f.dispose();
});

test("a remake within Formation commits without cancelling story work; a mode switch still resets", async () => {
  const f = fixture({ count: 1, generate: async () => kit });
  const resets = [];
  const reset = f.cancellation.reset.bind(f.cancellation);
  f.cancellation.reset = (...args) => {
    resets.push(args[0]);
    return reset(...args);
  };
  await f.service.start({ runId, targetMode: "formation", confirmed: true });
  await f.service.settled(runId);
  assert.equal(resets.length, 1, "Classic to Formation resets the world");
  f.docs.get(`${runId}:unit:0`).data.formationKitPrompt = 1;
  await f.service.ensure(runId, f.docs.get("index").data.runs[0]);
  await f.service.settled(runId);
  assert.equal((await f.service.status({ runId })).conversion.status, "committed");
  assert.equal(f.docs.get(`${runId}:unit:0`).data.formationKitPrompt, 2);
  assert.equal(resets.length, 1, "the Formation remake did not reset");
  f.dispose();
});
