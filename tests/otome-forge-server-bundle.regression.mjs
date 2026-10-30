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
  // Fastify route options, as the Engine's collector takes them: (path, handler) or (path, options, handler).
  const routeOptions = new Map();
  const prefixes = [];
  const collect =
    (method, prefix) =>
    (path, ...rest) => {
      routes.set(`${method} ${prefix}${path}`, rest.at(-1));
      if (rest.length > 1) routeOptions.set(`${method} ${prefix}${path}`, rest[0]);
    };
  const api = {
    runtime,
    async registerPrivilegedRoutes(register, options) {
      prefixes.push(options.prefix);
      await register({ get: collect("GET", options.prefix), post: collect("POST", options.prefix) });
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
  return { fake, logs, routes, routeOptions, prefixes, cleanup, call };
}

test("the bundle registers its routes under /api/otome-forge, keeps the id prefix and cleans up", async () => {
  const fake = createFakeDocuments();
  fake.seedGachaForgeIndex();
  const host = await activatePackage(fake);
  assert.deepEqual(host.prefixes, ["/api/otome-forge"]);
  assert.deepEqual([...host.routes.keys()].sort(), [
    "GET /api/otome-forge/index",
    "GET /api/otome-forge/runs/:run",
    "GET /api/otome-forge/runs/:run/album",
    "GET /api/otome-forge/runs/:run/art/scene",
    "GET /api/otome-forge/runs/:run/calendar",
    "GET /api/otome-forge/runs/:run/chapters/:key",
    "GET /api/otome-forge/runs/:run/dates",
    "GET /api/otome-forge/runs/:run/home",
    "GET /api/otome-forge/runs/:run/lis/:li/bible",
    "GET /api/otome-forge/runs/:run/lis/:li/lines",
    "GET /api/otome-forge/runs/:run/lis/:li/notebook",
    "GET /api/otome-forge/runs/:run/memory/status",
    "GET /api/otome-forge/runs/:run/phone",
    "GET /api/otome-forge/runs/:run/phone/:li",
    "GET /api/otome-forge/runs/:run/play",
    "GET /api/otome-forge/runs/:run/story",
    "GET /api/otome-forge/runs/:run/wardrobe",
    "GET /api/otome-forge/runs/:run/wish",
    "POST /api/otome-forge/age-gate",
    "POST /api/otome-forge/age-gate/revoke",
    "POST /api/otome-forge/index/opened",
    "POST /api/otome-forge/premise/suggest",
    "POST /api/otome-forge/runs",
    "POST /api/otome-forge/runs/:run/activate",
    "POST /api/otome-forge/runs/:run/art/cg",
    "POST /api/otome-forge/runs/:run/art/cg/prompt",
    "POST /api/otome-forge/runs/:run/art/cg/seen",
    "POST /api/otome-forge/runs/:run/art/expressions",
    "POST /api/otome-forge/runs/:run/art/expressions/prompt",
    "POST /api/otome-forge/runs/:run/art/keepsake",
    "POST /api/otome-forge/runs/:run/art/keepsake/prompt",
    "POST /api/otome-forge/runs/:run/art/paint",
    "POST /api/otome-forge/runs/:run/art/place",
    "POST /api/otome-forge/runs/:run/art/place/prompt",
    "POST /api/otome-forge/runs/:run/art/prompt",
    "POST /api/otome-forge/runs/:run/audio/brief",
    "POST /api/otome-forge/runs/:run/audio/settings",
    "POST /api/otome-forge/runs/:run/audio/track",
    "POST /api/otome-forge/runs/:run/cancel",
    "POST /api/otome-forge/runs/:run/care-note",
    "POST /api/otome-forge/runs/:run/chapters/:key/beats/:i",
    "POST /api/otome-forge/runs/:run/chapters/:key/beats/:i/choose",
    "POST /api/otome-forge/runs/:run/chapters/:key/beats/:i/ease-off",
    "POST /api/otome-forge/runs/:run/chapters/:key/beats/:i/read",
    "POST /api/otome-forge/runs/:run/chapters/:key/beats/:i/stance",
    "POST /api/otome-forge/runs/:run/chapters/next",
    "POST /api/otome-forge/runs/:run/claw/finish",
    "POST /api/otome-forge/runs/:run/dates",
    "POST /api/otome-forge/runs/:run/dates/:key/finish",
    "POST /api/otome-forge/runs/:run/delete",
    "POST /api/otome-forge/runs/:run/favorites",
    "POST /api/otome-forge/runs/:run/forge/consent",
    "POST /api/otome-forge/runs/:run/forge/retry",
    "POST /api/otome-forge/runs/:run/home/note",
    "POST /api/otome-forge/runs/:run/home/set",
    "POST /api/otome-forge/runs/:run/items/:item/art",
    "POST /api/otome-forge/runs/:run/items/:item/art/prompt",
    "POST /api/otome-forge/runs/:run/items/:item/open",
    "POST /api/otome-forge/runs/:run/lis/:li/accent",
    "POST /api/otome-forge/runs/:run/lis/:li/appearance",
    "POST /api/otome-forge/runs/:run/lis/:li/bible",
    "POST /api/otome-forge/runs/:run/lis/:li/card",
    "POST /api/otome-forge/runs/:run/lis/:li/intimacy",
    "POST /api/otome-forge/runs/:run/lis/:li/notebook",
    "POST /api/otome-forge/runs/:run/memory/retry",
    "POST /api/otome-forge/runs/:run/phone/:li/close",
    "POST /api/otome-forge/runs/:run/phone/:li/seen",
    "POST /api/otome-forge/runs/:run/phone/:li/send",
    "POST /api/otome-forge/runs/:run/prologue",
    "POST /api/otome-forge/runs/:run/read-him",
    "POST /api/otome-forge/runs/:run/read-him/:set/answer",
    "POST /api/otome-forge/runs/:run/read-him/:set/finish",
    "POST /api/otome-forge/runs/:run/read-me",
    "POST /api/otome-forge/runs/:run/read-me/:set/answer",
    "POST /api/otome-forge/runs/:run/read-me/:set/finish",
    "POST /api/otome-forge/runs/:run/repairs/:li",
    "POST /api/otome-forge/runs/:run/routes/:li/next",
    "POST /api/otome-forge/runs/:run/selector/:li",
    "POST /api/otome-forge/runs/:run/settings",
    "POST /api/otome-forge/runs/:run/veil",
    "POST /api/otome-forge/runs/:run/wardrobe/pair",
    "POST /api/otome-forge/runs/:run/wardrobe/pair/prompt",
    "POST /api/otome-forge/runs/:run/wardrobe/show",
    "POST /api/otome-forge/runs/:run/wardrobe/wear",
    "POST /api/otome-forge/runs/:run/wish/art",
    "POST /api/otome-forge/runs/:run/wish/art/prompt",
    "POST /api/otome-forge/runs/:run/wish/open",
    "POST /api/otome-forge/runs/:run/wish/pull",
  ]);
  // The Caring message is the one route the Engine writes no request line for (incoming request, request completed):
  // its button shows only on a day the period tracker marks, so a timestamped line would date one.
  assert.deepEqual(Object.fromEntries(host.routeOptions), {
    "POST /api/otome-forge/runs/:run/care-note": { logLevel: "silent" },
  });

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
