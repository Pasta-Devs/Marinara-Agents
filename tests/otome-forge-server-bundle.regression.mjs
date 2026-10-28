// Activates the COMMITTED packages/otome-forge/server.mjs against the fake host (documents keyed by id alone, as the
// Engine's capability_documents table is) and drives its routes, so a bundle built from stale or broken sources fails
// here even though CI cannot rebuild it. It pins the id prefix, the route list and error shapes, the store's retry with
// no lost write and its create-race recovery, that selfCheck reads storage, and cleanup.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createFakeDocuments, createFakeRuntime } from "./fixtures/otome-forge-fakes.ts";

const serverPath = fileURLToPath(new URL("../packages/otome-forge/server.mjs", import.meta.url));
const { activate, selfCheck } = await import(serverPath);

async function activatePackage(fake = createFakeDocuments()) {
  const { runtime, logs } = createFakeRuntime({ documents: fake.documents });
  const routes = new Map();
  const prefixes = [];
  const api = {
    runtime,
    async registerPrivilegedRoutes(register, options) {
      prefixes.push(options.prefix);
      await register({
        get: (path, handler) => routes.set(`GET ${options.prefix}${path}`, handler),
        post: (path, handler) => routes.set(`POST ${options.prefix}${path}`, handler),
      });
      return () => routes.clear();
    },
  };
  const cleanup = await activate({ api });
  const call = async (method, url, body) => {
    const handler = routes.get(`${method} ${url}`);
    assert.ok(handler, `${method} ${url} is registered`);
    const reply = {
      statusCode: 200,
      payload: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      send(payload) {
        this.payload = payload;
        return this;
      },
    };
    const result = await handler({ method, url, params: {}, query: {}, body }, reply);
    return { status: reply.statusCode, body: result === reply ? reply.payload : result };
  };
  return { fake, logs, routes, prefixes, cleanup, call };
}

test("the bundle registers its routes under /api/otome-forge, keeps the id prefix and cleans up", async () => {
  const fake = createFakeDocuments();
  fake.seedGachaForgeIndex();
  const host = await activatePackage(fake);
  assert.deepEqual(host.prefixes, ["/api/otome-forge"]);
  assert.deepEqual([...host.routes.keys()].sort(), [
    "GET /api/otome-forge/index",
    "POST /api/otome-forge/index/opened",
  ]);

  await selfCheck();
  assert.deepEqual([...fake.rows.keys()], ["index"], "selfCheck and reads create nothing");
  const empty = await host.call("GET", "/api/otome-forge/index", undefined);
  assert.deepEqual(empty, {
    status: 200,
    body: { index: { version: 1, runs: [], activeRun: null, ageGate: null, lastOpenedAt: null } },
  });

  const opened = await host.call("POST", "/api/otome-forge/index/opened", { timeZone: "UTC", debugMode: false });
  assert.equal(opened.status, 200);
  assert.equal(typeof opened.body.index.lastOpenedAt, "string");
  assert.deepEqual((await host.call("GET", "/api/otome-forge/index")).body, opened.body);
  const ownRows = [...fake.rows.values()].filter((row) => row.packageId === "otome-forge");
  assert.deepEqual(
    ownRows.map((row) => [row.id, row.kind]),
    [["otome-forge:index", "index"]],
  );
  assert.equal(fake.rows.get("index").packageId, "gacha-forge", "Gacha Forge's index row is untouched");

  await host.cleanup();
  assert.equal(host.routes.size, 0, "cleanup releases the routes");
  await assert.rejects(selfCheck(), /did not activate/);
});

test("the bundle answers conflicts, bad bodies and storage failures with the agreed shapes", async () => {
  const host = await activatePackage();
  await host.call("POST", "/api/otome-forge/index/opened", {});
  for (let attempt = 0; attempt < 4; attempt += 1) host.fake.interfere("otome-forge:index");
  const conflict = await host.call("POST", "/api/otome-forge/index/opened", {});
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.code, "conflict");

  const badBody = await host.call("POST", "/api/otome-forge/index/opened", "nope");
  assert.equal(badBody.status, 400);
  assert.equal(badBody.body.code, "bad-request");
  assert.equal(host.logs.length, 0, "known failures are not logged as crashes");

  host.fake.documents.getById = async () => {
    throw new Error("disk on fire");
  };
  const failure = await host.call("GET", "/api/otome-forge/index");
  assert.deepEqual(failure, { status: 500, body: { error: "Otome Forge could not complete the request." } });
  assert.equal(host.logs.length, 1);
  assert.equal(host.logs[0].level, "error");
  assert.match(String(host.logs[0].error), /disk on fire/);
  await host.cleanup();
});

test("the bundle retries a stale revision without losing the other writer's change", async () => {
  const host = await activatePackage();
  await host.call("POST", "/api/otome-forge/index/opened", {});
  // `interfere` acts on updates, so the document exists first; one other writer confirms the age gate meanwhile.
  host.fake.interfere("otome-forge:index", (data) => ({ ...data, ageGate: { confirmedAt: "x" } }));
  const opened = await host.call("POST", "/api/otome-forge/index/opened", {});
  assert.equal(opened.status, 200);
  assert.deepEqual(opened.body.index.ageGate, { confirmedAt: "x" }, "the other write survives");
  assert.equal(typeof opened.body.index.lastOpenedAt, "string", "ours lands on top of it");
  assert.deepEqual(host.fake.rows.get("otome-forge:index").data, opened.body.index);
  assert.equal(host.fake.rows.get("otome-forge:index").revision, 3);
  await host.cleanup();
});

test("the bundle applies its change on top of a document another request created first", async () => {
  const host = await activatePackage();
  host.fake.raceCreate("otome-forge:index", { lastOpenedAt: null, runs: [], ageGate: { confirmedAt: "y" } });
  const opened = await host.call("POST", "/api/otome-forge/index/opened", {});
  assert.equal(opened.status, 200);
  assert.deepEqual(opened.body.index.ageGate, { confirmedAt: "y" }, "the other request's document is kept");
  assert.equal(typeof opened.body.index.lastOpenedAt, "string");
  assert.equal(host.fake.rows.get("otome-forge:index").revision, 2);
  await host.cleanup();
});

test("the bundle's selfCheck reads storage", async () => {
  const host = await activatePackage();
  await selfCheck();
  host.fake.documents.getById = async () => {
    throw new Error("disk on fire");
  };
  await assert.rejects(selfCheck(), /disk on fire/);
  await host.cleanup();
});
