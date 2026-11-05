// Otome Forge's ids, document store and route plumbing (M0c): the `otome-forge:` prefix keeps Otome clear of Gacha
// Forge's unprefixed `index` row, and revision-checked writes never lose a change.
import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  createHandle,
  OtomeForgeError,
  parseBody,
  type OtomeReply,
  type OtomeRequest,
  type OtomeRouter,
  type RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  INDEX_ID,
  isLiId,
  isOtomeId,
  isRunKey,
  nameSlug,
  newLiId,
  newRunKey,
  runIdOf,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { registerIndexRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/index.ts";
import { normalizeIndex } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/index.ts";
import { createOtomeStore } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/store.ts";
import { createFakeDocuments, createFakeRuntime, FakeUniqueConstraintError } from "./fixtures/otome-forge-fakes.ts";

// A counter document: `count` adds up every applied change, so a lost write shows as a smaller number.
const normalizeCounter = (data: unknown) => {
  const count = (data as { count?: unknown } | undefined)?.count;
  return { count: typeof count === "number" ? count : 0 };
};
const counter = (id: string) => ({ id, kind: "counter", name: "Counter" });

function fakeRoutes(store: ReturnType<typeof createOtomeStore>) {
  const { runtime, logs } = createFakeRuntime();
  const routes = new Map<string, RouteHandler>();
  const router: OtomeRouter = {
    get: (path, handler) => routes.set(`GET ${path}`, handler),
    post: (path, handler) => routes.set(`POST ${path}`, handler),
  };
  registerIndexRoutes(router, { store, handle: createHandle(runtime.logger) });
  const call = async (method: string, url: string, body?: unknown) => {
    const handler = routes.get(`${method} ${url}`);
    assert.ok(handler, `${method} ${url} is registered`);
    let status = 200;
    let payload: unknown;
    const reply: OtomeReply = {
      status(code) {
        status = code;
        return reply;
      },
      send(value) {
        payload = value;
        return reply;
      },
    };
    const request: OtomeRequest = { method, url, body, params: {}, query: {} };
    const result = await handler(request, reply);
    return { status, body: result === reply ? payload : result };
  };
  return { routes, call, logs };
}

test("ids: run keys, run ids and LI ids keep their formats and the prefix rule", () => {
  const runKey = newRunKey(Date.UTC(2026, 9, 28));
  assert.match(runKey, /^r-[0-9a-z]+-[0-9a-z]{6}$/);
  assert.ok(isRunKey(runKey));
  assert.equal(runIdOf(runKey), `otome-forge:${runKey}`);
  assert.ok(isOtomeId(runIdOf(runKey)));
  assert.ok(isOtomeId(INDEX_ID));
  for (const bad of ["index", "otome-forge:", "gacha-forge:index", 7, null]) assert.equal(isOtomeId(bad), false);
  for (const bad of ["r-abc", "R-mh-abcdef", "r-mh-abcdef/../x", "otome-forge:r-mh-abcdef", ""]) {
    assert.equal(isRunKey(bad), false, String(bad));
    assert.throws(() => runIdOf(bad), RangeError);
  }

  assert.equal(nameSlug("Élodie Saint-Clair the Third"), "elodie-saint-cla");
  assert.equal(nameSlug("黒川"), "x");
  assert.equal(nameSlug("  Kai!! "), "kai");
  const kai = newLiId("Kai");
  assert.match(kai, /^li-kai-[0-9a-z]{4}$/);
  assert.ok(isLiId(kai));
  assert.ok(isLiId(newLiId("Élodie Saint-Clair the Third")));
  assert.ok(isLiId(newLiId("黒川")));
  for (const bad of ["li--abcd", "li-kai-abc", "li-a-very-long-name-here-abcd", "li-Kai-abcd", "kai"]) {
    assert.equal(isLiId(bad), false, bad);
  }
  // Two LIs with the same name still get different ids.
  const taken = new Set<string>();
  for (let index = 0; index < 50; index += 1) taken.add(newLiId("Kai", taken));
  assert.equal(taken.size, 50);
});

test("with Gacha Forge's index row present, Otome creates and reads otome-forge:index", async () => {
  const fake = createFakeDocuments();
  fake.seedGachaForgeIndex();
  // The fake enforces one id across packages, as the Engine does: an unprefixed Otome index would collide.
  await assert.rejects(
    fake.documents.create({
      id: "index",
      packageId: "otome-forge",
      kind: "index",
      name: "Otome Forge",
      description: "",
      data: {},
      createdAt: "",
      updatedAt: "",
    }),
    FakeUniqueConstraintError,
  );

  const { call } = fakeRoutes(createOtomeStore(fake.documents));
  const before = await call("GET", "/index");
  assert.deepEqual(before, { status: 200, body: { index: normalizeIndex(undefined) } });
  assert.deepEqual([...fake.rows.keys()], ["index"], "a read creates nothing");

  const opened = await call("POST", "/index/opened", { timeZone: "Europe/Warsaw", debugMode: false });
  assert.equal(opened.status, 200);
  const { index } = opened.body as { index: ReturnType<typeof normalizeIndex> };
  assert.equal(typeof index.lastOpenedAt, "string");
  assert.deepEqual((await call("GET", "/index")).body, { index });

  const row = fake.rows.get(INDEX_ID);
  assert.equal(row?.packageId, "otome-forge");
  assert.equal(row?.kind, "index");
  assert.equal(fake.rows.get("index")?.packageId, "gacha-forge", "Gacha Forge's row is untouched");
  assert.deepEqual(fake.rows.get("index")?.data, { runs: [] });

  // A second visit updates the same document.
  await call("POST", "/index/opened", {});
  assert.equal(fake.rows.get(INDEX_ID)?.revision, 2);
});

test("a revision conflict is retried with no lost write", async () => {
  const fake = createFakeDocuments();
  const store = createOtomeStore(fake.documents);
  const id = "otome-forge:r-test-abcdef:state";
  assert.deepEqual(await store.mutateDoc(counter(id), normalizeCounter, ({ count }) => ({ count: count + 1 })), {
    count: 1,
  });
  // Three other writers land between our reads and our updates; each adds 10. The default budget (4 attempts) still
  // wins on the last one, and the 409 test below shows a fourth writer exhausts it, so the budget is pinned at 4.
  for (let other = 0; other < 3; other += 1) fake.interfere(id, (data) => ({ count: data.count + 10 }));
  let applied = 0;
  const saved = await store.mutateDoc(counter(id), normalizeCounter, ({ count }) => {
    applied += 1;
    return { count: count + 1 };
  });
  assert.deepEqual(saved, { count: 32 }, "the other writes and ours survive");
  assert.equal(applied, 4, "the change was applied again on each fresh read");
  assert.equal(fake.rows.get(id)?.revision, 5);
});

test("a lost create race applies the change on top of the other request's document", async () => {
  const fake = createFakeDocuments();
  const store = createOtomeStore(fake.documents);
  const id = "otome-forge:r-test-abcdef:state";
  fake.raceCreate(id, { count: 5 });
  assert.deepEqual(await store.mutateDoc(counter(id), normalizeCounter, ({ count }) => ({ count: count + 1 })), {
    count: 6,
  });
  assert.equal(fake.rows.get(id)?.revision, 2);

  // A create that fails for its own reason (here: another package holds the id) is not retried as a race.
  const foreign = "otome-forge:r-test-abcdef:taken";
  fake.raceCreate(foreign, { count: 9 }, "gacha-forge");
  await assert.rejects(
    store.mutateDoc(counter(foreign), normalizeCounter, ({ count }) => ({ count: count + 1 })),
    FakeUniqueConstraintError,
  );
  assert.equal(fake.rows.get(foreign)?.packageId, "gacha-forge");
});

test("a 409 conflict once every attempt loses, through the store and the route", async () => {
  const fake = createFakeDocuments();
  const store = createOtomeStore(fake.documents);
  const id = "otome-forge:r-test-abcdef:state";
  await store.mutateDoc(counter(id), normalizeCounter, () => ({ count: 1 }));
  for (let attempt = 0; attempt < 4; attempt += 1) fake.interfere(id);
  await assert.rejects(
    store.mutateDoc(counter(id), normalizeCounter, ({ count }) => ({ count: count + 1 })),
    (error) => error instanceof OtomeForgeError && error.statusCode === 409 && error.code === "conflict",
  );
  // `attempts` is honoured: one stale revision is too many for a single attempt.
  fake.interfere(id);
  await assert.rejects(
    store.mutateDoc(counter(id), normalizeCounter, ({ count }) => ({ count: count + 1 }), { attempts: 1 }),
    OtomeForgeError,
  );

  const { call, logs } = fakeRoutes(store);
  await call("POST", "/index/opened", {});
  for (let attempt = 0; attempt < 4; attempt += 1) fake.interfere(INDEX_ID);
  const conflict = await call("POST", "/index/opened", {});
  assert.equal(conflict.status, 409);
  assert.equal((conflict.body as { code?: string }).code, "conflict");
  assert.equal(logs.length, 0, "a known failure is not logged as a crash");
});

test("the store refuses ids without the prefix and lists one run's documents", async () => {
  const fake = createFakeDocuments();
  const store = createOtomeStore(fake.documents);
  await assert.rejects(store.readDoc("index", normalizeCounter), RangeError);
  await assert.rejects(
    store.mutateDoc(counter("r-test-abcdef:state"), normalizeCounter, () => ({ count: 1 })),
    RangeError,
  );
  assert.equal(await store.readDoc("otome-forge:r-test-abcdef:state", normalizeCounter), null);

  const one = runIdOf("r-one-abcdef");
  const two = runIdOf("r-two-abcdef");
  await store.mutateDoc(counter(`${one}:counter:a`), normalizeCounter, () => ({ count: 1 }));
  await store.mutateDoc(counter(`${two}:counter:a`), normalizeCounter, () => ({ count: 2 }));
  // A run key that is a prefix of another run's key must not pick up that run's documents.
  await store.mutateDoc(counter(`${one}x:counter:a`), normalizeCounter, () => ({ count: 3 }));
  assert.deepEqual(
    (await store.listRun("counter", one)).map((document) => document.id),
    [`${one}:counter:a`],
  );
});

test("the index normalizer keeps good fields and defaults the rest", () => {
  assert.deepEqual(normalizeIndex(null), {
    version: 1,
    runs: [],
    activeRun: null,
    ageGate: null,
    lastOpenedAt: null,
  });
  const run = { runKey: "r-mh00abcd-abcdef", title: "Moonlit Academy", createdAt: "2026-10-28T10:00:00.000Z" };
  const index = normalizeIndex({
    version: 0,
    runs: [run, { ...run, title: "duplicate" }, { runKey: "../etc", title: "x", createdAt: "" }, "junk"],
    activeRun: "r-missing-abcdef",
    ageGate: { confirmedAt: "2026-10-28T10:00:00.000Z" },
    lastOpenedAt: 12,
  });
  assert.deepEqual(index.runs, [{ ...run, lastPlayedAt: null }]);
  assert.equal(index.activeRun, null, "an active run must be one of the runs");
  assert.deepEqual(index.ageGate, { confirmedAt: "2026-10-28T10:00:00.000Z" });
  assert.equal(index.lastOpenedAt, null);
  assert.equal(normalizeIndex({ runs: [run], activeRun: run.runKey }).activeRun, run.runKey);
});

test("a run with bad fields keeps its place in the index when the next visit writes it back", async () => {
  const fake = createFakeDocuments();
  const runKey = "r-mh00abcd-abcdef";
  const at = "2026-10-28T10:00:00.000Z";
  // An entry from an older build or a hand edit: an over-long title, no createdAt, a number for lastPlayedAt.
  const stored = {
    version: 1,
    runs: [
      { runKey, title: "T".repeat(201), lastPlayedAt: 7 },
      { runKey: "r-mh00abcd-ghijkl", title: 3 },
    ],
    activeRun: runKey,
    ageGate: null,
    lastOpenedAt: null,
  };
  await fake.documents.create({
    id: INDEX_ID,
    packageId: "otome-forge",
    kind: "index",
    name: "Otome Forge",
    description: "",
    data: stored,
    createdAt: at,
    updatedAt: at,
  });

  const { call } = fakeRoutes(createOtomeStore(fake.documents));
  const opened = await call("POST", "/index/opened", {});
  assert.equal(opened.status, 200);
  const saved = fake.rows.get(INDEX_ID)?.data as ReturnType<typeof normalizeIndex>;
  assert.deepEqual(saved.runs, [
    { runKey, title: "T".repeat(200), createdAt: "", lastPlayedAt: null },
    { runKey: "r-mh00abcd-ghijkl", title: "r-mh00abcd-ghijkl", createdAt: "", lastPlayedAt: null },
  ]);
  assert.equal(saved.activeRun, runKey, "the active run still points at it");
  assert.equal(typeof saved.lastOpenedAt, "string");
  assert.deepEqual((opened.body as { index: unknown }).index, saved);
});

test("route plumbing: bad bodies are 400s, unknown failures are logged once and hidden", async () => {
  const schema = z.object({ title: z.string().min(1) });
  assert.deepEqual(parseBody(schema, { title: "A", timeZone: "UTC", debugMode: true }), { title: "A" });
  assert.throws(
    () => parseBody(schema, { title: "" }),
    (error) => error instanceof OtomeForgeError && error.statusCode === 400 && error.code === "bad-request",
  );

  const fake = createFakeDocuments();
  const { call, logs } = fakeRoutes(createOtomeStore(fake.documents));
  const badBody = await call("POST", "/index/opened", "not an object");
  assert.equal(badBody.status, 400);
  assert.equal((badBody.body as { code?: string }).code, "bad-request");

  const failure = new Error("disk on fire");
  fake.documents.getById = async () => {
    throw failure;
  };
  const crashed = await call("POST", "/index/opened", { secret: "never logged" });
  assert.deepEqual(crashed, { status: 500, body: { error: "Otome Forge could not complete the request." } });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].level, "error");
  assert.equal(logs[0].error, failure, "the error object comes first");
  assert.doesNotMatch(JSON.stringify(logs), /never logged/, "request bodies are never logged");
});
