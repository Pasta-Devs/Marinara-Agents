import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createForgeChapterRegeneration,
  forgeStoryPaidThrough,
} from "../packages/gacha-forge/src/chapter-regeneration-server.mjs";
import { createForgeStoryCancellation, forgeStoryDocuments } from "../sources/forge-kit/story-cancel-server.mjs";

const runId = "reset-world",
  packageId = "gacha-forge",
  unitId = `${runId}:unit:arden`;
const clone = structuredClone,
  deferred = () => Promise.withResolvers();
const tick = () => new Promise((resolve) => setImmediate(resolve));
const plan = () => ({ nodes: Array.from({ length: 10 }, () => ({ type: "story" })) });

function fixture() {
  const docs = new Map(),
    runtime = createForgeStoryCancellation(),
    invalidated = [];
  let conflictId;
  const seed = (id, kind, data) =>
    docs.set(id, { id, packageId, kind, revision: 1, name: id, description: "", data: clone(data) });
  seed("index", "index", { runs: [{ runId }], activeRunId: runId });
  seed(`${runId}:session`, "session", {
    progress: { 1: { normal: 10 }, 2: { normal: 3 } },
    wallet: { funds: 800, vigor: 97, aether: 12 },
    account: { xp: 35, level: 8 },
    roster: { [unitId]: { level: 12, bondFights: 200 } },
    achievements: { claimed: { one: true } },
    pity: { character: 42 },
    reading: { chapter: 2, storyIndex: 1, at: 4 },
    combatPending: { chapter: 2, combatIndex: 0 },
    preforge: { 1: { autos: 2 }, 2: { autos: 1 }, "bond-other": { autos: 1 } },
  });
  seed(`${runId}:chapter:1`, "chapter-plan", { ...plan(), title: "Completed" });
  seed(`${runId}:chapter:2`, "chapter-plan", { ...plan(), title: "Discarded" });
  seed(unitId, "unit", { kind: "character", name: "Arden", portrait: "saved" });
  for (const kind of ["beat", "cg", "combat"]) {
    seed(`${runId}:${kind}:1:0`, kind, { text: "Completed canon" });
    seed(`${runId}:${kind}:2:0`, kind, { text: "Discarded canon", choiceCanon: { choice: "old" } });
    seed(`${runId}:${kind}:20:0`, kind, { text: "Exact delimiter control" });
  }
  seed(`${runId}:chat:arden`, "chat", {
    messages: [{ id: "photo", photo: "retained" }],
    sessions: [{ memory: "Independent DM canon", memoryPosition: { chapter: 2, nodeIndex: 3 } }],
  });
  seed(`${runId}:summary:2`, "summary", { chapter: 2, digest: "Discarded" });
  seed(`${runId}:summary:1`, "summary", { chapter: 1, from: 1, to: 2, digest: "Mixed derived digest" });
  seed(`${runId}:summary:other`, "summary", { chapter: "bond-other", digest: "Keep this" });
  seed(`${runId}:summary:memory`, "summary", {
    records: [
      { kind: "chapter", id: "1", key: '["chapter","1"]', content: "Completed" },
      { kind: "chapter", id: "2", key: '["chapter","2"]', content: "Discarded" },
      { kind: "chat", id: "dm", key: '["chat","dm"]', content: "Independent" },
    ],
    overview: { content: "Includes discarded chapter", sources: [['["chapter","2"]', "old"]] },
    work: [{ id: "incomplete" }],
  });
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
      const current = docs.get(row.id);
      if (row.id === conflictId || current?.revision !== row.expectedRevision) return null;
      const saved = { ...current, ...clone(row), revision: current.revision + 1 };
      docs.set(row.id, saved);
      return clone(saved);
    },
    remove: async (_package, id, revision) => {
      if (id === conflictId || docs.get(id)?.revision !== revision) return false;
      return docs.delete(id);
    },
  };
  const persistence = {
    documents,
    transaction: async (work) => {
      const before = clone(docs);
      try {
        return await work({ documents });
      } catch (error) {
        docs.clear();
        for (const [id, row] of before) docs.set(id, row);
        throw error;
      }
    },
  };
  const service = createForgeChapterRegeneration({
    packageId,
    persistence,
    cancellation: runtime,
    allNodes: (value) => value?.nodes || [],
    bondChapterId: (id, part) => `bond-${id.split(":unit:")[1]}${part > 1 ? `-${part}` : ""}`,
    bondLength: 3,
    isCharacter: (value) => value.kind === "character",
    openBond: (session) => {
      for (const [id, row] of Object.entries(session.bondChapters || {})) {
        for (const part of [1, 2]) {
          const suffix = part > 1 ? String(part) : "";
          if (row[`after${suffix}`] != null && Number(row[`beats${suffix}`] || 0) < 3) return { id, part };
        }
      }
      return { id: "", part: 0 };
    },
    invalidateMemory: (id) => invalidated.push(id),
  });
  return {
    docs,
    runtime,
    documents,
    service,
    seed,
    invalidated,
    conflict: (id) => {
      conflictId = id;
    },
  };
}

test("reset removes only the selected ongoing chapter and overlapping derived memory", async () => {
  const f = fixture(),
    before = clone(f.docs);
  const result = await f.service.reset({ runId, chapter: 2 });
  assert.equal(result.ok, true);
  assert.equal(result.storyRevision, 1);
  for (const id of [
    `${runId}:chapter:2`,
    `${runId}:beat:2:0`,
    `${runId}:cg:2:0`,
    `${runId}:combat:2:0`,
    `${runId}:summary:2`,
    `${runId}:summary:1`,
  ])
    assert.equal(f.docs.has(id), false, id);
  for (const [id, row] of before) {
    if (id === `${runId}:session` || id === `${runId}:summary:memory` || !f.docs.has(id)) continue;
    assert.deepEqual(f.docs.get(id), row, id);
  }
  const session = f.docs.get(`${runId}:session`).data;
  assert.deepEqual(session.progress, { 1: { normal: 10 }, 2: { normal: 0 } });
  assert.equal(session.storyRewardProgress["2"], 3);
  assert.equal(session.reading, undefined);
  assert.equal(session.combatPending, undefined);
  assert.deepEqual(session.preforge, { 1: { autos: 2 }, "bond-other": { autos: 1 } });
  for (const key of ["wallet", "account", "roster", "achievements", "pity"])
    assert.deepEqual(session[key], before.get(`${runId}:session`).data[key]);
  const memory = f.docs.get(`${runId}:summary:memory`).data;
  assert.deepEqual(
    memory.records.map((row) => row.id),
    ["1", "dm"],
  );
  assert.equal(memory.overview, null);
  assert.deepEqual(f.invalidated, [runId]);
  f.runtime.dispose();
});

test("completed/stale/contradictory requests reject without canceling another paid generation", async () => {
  const f = fixture(),
    started = deferred(),
    release = deferred();
  let signal;
  const generation = f.runtime.run(runId, async (current) => {
    signal = current;
    started.resolve();
    await release.promise;
    return "kept";
  });
  await started.promise;
  const before = clone(f.docs);
  assert.deepEqual(await f.service.reset({ runId, chapter: 1 }), { ok: false, error: "chapter-completed" });
  f.seed(`${runId}:chapter:3`, "chapter-plan", plan());
  assert.equal((await f.service.reset({ runId, chapter: 2 })).error, "chapter-not-ongoing");
  f.docs.delete(`${runId}:chapter:3`);
  assert.equal((await f.service.reset({ runId, chapter: 2, storyRevision: 9 })).error, "story-changed");
  assert.deepEqual(f.docs, before);
  assert.equal(signal.aborted, false);
  assert.deepEqual(f.invalidated, []);
  release.resolve();
  assert.equal(await generation, "kept");
  f.runtime.dispose();
});

test("completion admitted before reset wins the authoritative transaction recheck", async () => {
  const f = fixture(),
    entered = deferred(),
    release = deferred();
  const documents = forgeStoryDocuments({
    update: async (row) => {
      entered.resolve();
      await release.promise;
      return f.documents.update(row);
    },
  });
  const session = clone(f.docs.get(`${runId}:session`));
  session.data.progress[2].normal = 10;
  const completion = f.runtime.run(runId, () => documents.update({ ...session, expectedRevision: session.revision }));
  await entered.promise;
  const reset = f.service.reset({ runId, chapter: 2 });
  await tick();
  release.resolve();
  await completion;
  assert.deepEqual(await reset, { ok: false, error: "chapter-completed" });
  assert.equal(f.docs.has(`${runId}:chapter:2`), true);
  assert.equal(f.docs.has(`${runId}:beat:2:0`), true);
  assert.equal(f.docs.get(`${runId}:session`).data.progress[2].normal, 10);
  assert.deepEqual(f.invalidated, []);
  f.runtime.dispose();
});

test("a conflict partway through removal rolls all selected records and session back", async () => {
  const f = fixture(),
    before = clone(f.docs);
  f.conflict(`${runId}:cg:2:0`);
  await assert.rejects(f.service.reset({ runId, chapter: 2 }), /chapter-reset-write-conflict/);
  assert.deepEqual(f.docs, before);
  assert.equal(await f.runtime.run(runId, async () => "retryable"), "retryable");
  f.runtime.dispose();
});

test("the current Character Story part resets without altering completed parts or its placement", async () => {
  const f = fixture();
  const track = { beats: 3, after: 1, opened: 100, beats2: 1, after2: 2, opened2: 200 };
  f.docs.get(`${runId}:session`).data.bondChapters = { [unitId]: clone(track) };
  const chapter = "bond-arden-2";
  f.seed(`${runId}:chapter:${chapter}`, "chapter-plan", { ...plan(), bondUnitId: unitId, bondPart: 2 });
  f.seed(`${runId}:beat:${chapter}:0`, "beat", { text: "Discarded part" });
  f.seed(`${runId}:chapter:bond-arden`, "chapter-plan", { ...plan(), bondUnitId: unitId, bondPart: 1 });
  const completed = clone(f.docs.get(`${runId}:chapter:bond-arden`));
  assert.equal((await f.service.reset({ runId, unitId, part: 1 })).error, "chapter-completed");
  assert.equal((await f.service.reset({ runId, unitId, part: 2 })).ok, true);
  const session = f.docs.get(`${runId}:session`).data;
  assert.deepEqual(session.bondChapters[unitId], { ...track, beats2: 0 });
  assert.deepEqual(session.progress, { 1: { normal: 10 }, 2: { normal: 3 } });
  assert.equal(session.storyRewardProgress[chapter], 1);
  assert.deepEqual(f.docs.get(completed.id), completed);
  f.runtime.dispose();
});

test("an open Character Story blocks normal reset before any cancellation or deletion", async () => {
  const f = fixture();
  f.docs.get(`${runId}:session`).data.bondChapters = { [unitId]: { beats: 1, after: 2, opened: 100 } };
  const before = clone(f.docs);
  assert.deepEqual(await f.service.reset({ runId, chapter: 2 }), {
    ok: false,
    error: "bond-chapter-open",
    heldBy: "Arden",
    heldById: unitId,
    heldPart: 1,
  });
  assert.deepEqual(f.docs, before);
  assert.deepEqual(f.invalidated, []);
  f.runtime.dispose();
});

test("paid progress is monotonic across repeated resets while play progress can rewind", async () => {
  const f = fixture();
  assert.equal((await f.service.reset({ runId, chapter: 2 })).ok, true);
  f.seed(`${runId}:chapter:2`, "chapter-plan", plan());
  f.docs.get(`${runId}:session`).data.progress[2].normal = 1;
  assert.equal((await f.service.reset({ runId, chapter: 2, storyRevision: 1 })).ok, true);
  const session = f.docs.get(`${runId}:session`).data;
  assert.equal(forgeStoryPaidThrough(session, 2, 0), 3);
  assert.equal(forgeStoryPaidThrough(session, 2, 0, "hard"), 0);
  assert.equal(forgeStoryPaidThrough(session, 2, 0, "veryhard"), 0);
  assert.equal(3 + 1 > forgeStoryPaidThrough(session, 2, 3), true);
  assert.equal(2 + 1 > forgeStoryPaidThrough(session, 2, 2), false);
  assert.equal(session.storyRevision, 2);
  f.runtime.dispose();
});

test("the story route wrapper rejects requests from before reset and bootstraps fresh plan reads", async () => {
  const f = fixture(),
    routes = new Map();
  let mutations = 0;
  const router = { post: (path, handler) => routes.set(path, handler) };
  f.service.post(router, "/complete", async () => {
    mutations++;
    return { ok: true };
  });
  f.service.post(router, "/chapter-plan", async () => ({ ok: true, plan: plan() }));
  await f.service.reset({ runId, chapter: 2 });
  assert.deepEqual(await routes.get("/complete")({ body: { runId, chapter: 2 } }), {
    ok: false,
    error: "story-changed",
    storyRevision: 1,
  });
  assert.equal(mutations, 0);
  assert.equal((await routes.get("/chapter-plan")({ body: { runId, chapter: 2 } })).storyRevision, 1);
  assert.equal((await routes.get("/complete")({ body: { runId, chapter: 2, storyRevision: 1 } })).ok, true);
  assert.equal(mutations, 1);
  f.runtime.dispose();
});

test("a reset invoked inside its own admitted story operation fails promptly instead of joining itself", async () => {
  const runtime = createForgeStoryCancellation();
  assert.deepEqual(await runtime.run("world", () => runtime.reset("world", async () => true)), {
    ok: false,
    error: "reset-in-progress",
  });
  runtime.dispose();
});

test("ordinary generation Cancel preserves an already admitted canonical completion save", async () => {
  const f = fixture(),
    started = deferred(),
    release = deferred(),
    routes = new Map();
  const documents = forgeStoryDocuments(f.documents);
  f.service.post({ post: (path, handler) => routes.set(path, handler) }, "/complete", async () => {
    started.resolve();
    await release.promise;
    const session = await f.documents.getById(packageId, `${runId}:session`);
    session.data.progress[2].normal = 4;
    await documents.update({ ...session, expectedRevision: session.revision });
    return { ok: true };
  });
  const completion = routes.get("/complete")({ body: { runId, chapter: 2 } });
  await started.promise;
  f.runtime.cancel(runId);
  release.resolve();
  assert.equal((await completion).ok, true);
  assert.equal(f.docs.get(`${runId}:session`).data.progress[2].normal, 4);
  f.runtime.dispose();
});

test("reset drains an admitted completion while rejecting a fresh mutation, then preserves the completed story", async () => {
  const f = fixture(),
    started = deferred(),
    release = deferred(),
    routes = new Map();
  let saves = 0;
  f.service.post({ post: (path, handler) => routes.set(path, handler) }, "/complete", async () => {
    saves++;
    started.resolve();
    await release.promise;
    const session = await f.documents.getById(packageId, `${runId}:session`);
    session.data.progress[2].normal = 10;
    await f.documents.update({ ...session, expectedRevision: session.revision });
    return { ok: true };
  });
  const completion = routes.get("/complete")({ body: { runId, chapter: 2 } });
  await started.promise;
  const reset = f.service.reset({ runId, chapter: 2 });
  await tick();
  assert.equal((await routes.get("/complete")({ body: { runId, chapter: 2 } })).error, "reset-in-progress");
  assert.equal(saves, 1);
  release.resolve();
  assert.equal((await completion).ok, true);
  assert.equal((await reset).error, "chapter-completed");
  assert.equal(f.docs.has(`${runId}:chapter:2`), true);
  assert.equal(f.docs.has(`${runId}:beat:2:0`), true);
  f.runtime.dispose();
});

test("higher-difficulty progress protects contradictory imported completed stories", async () => {
  for (const difficulty of ["hard", "veryhard"]) {
    const f = fixture();
    f.docs.get(`${runId}:session`).data.progress[2][difficulty] = 1;
    const before = clone(f.docs);
    assert.equal((await f.service.reset({ runId, chapter: 2 })).ok, false);
    assert.deepEqual(f.docs, before);
    assert.deepEqual(f.invalidated, []);
    f.runtime.dispose();
  }
});
