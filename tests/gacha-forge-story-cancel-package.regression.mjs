// Exercise the shipped route/controller/LLM/document wiring without a paid provider or personal save.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const directory = await mkdtemp(join(tmpdir(), "forge-story-cancel-package-")),
  packageId = "gacha-forge",
  runId = "cancel-package-proof",
  sessionId = `${runId}:session`,
  chapterId = `${runId}:chapter:1`,
  docs = new Map(),
  routes = new Map(),
  requests = [],
  clone = structuredClone;
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const started = deferred(),
  lateResponse = deferred(),
  originalFetch = globalThis.fetch;
const seed = (id, kind, data) => docs.set(id, { id, packageId, kind, name: id, revision: 1, data: clone(data) });
seed("index", "index", {
  activeRunId: runId,
  runs: [
    {
      runId,
      name: "Cancellation fixture",
      scenario: "Recover the lighthouse key.",
      connectionId: "fixture-story",
      protagonist: { name: "Mari" },
      story: { choices: false, preforge: "story" },
      images: { enabled: false },
    },
  ],
});
seed(sessionId, "session", {
  progress: { 1: { normal: 0 } },
  roster: {},
  account: { level: 100, xp: 0 },
  wallet: { funds: 12345, aether: 42, vigor: 1000 },
});
const originalWorld = clone(docs.get("index").data),
  originalSession = clone(docs.get(sessionId).data);
const plan = {
  chapter: 1,
  title: "The lighthouse key",
  premise: "Return the key to the keeper.",
  nodes: Array.from({ length: 10 }, (_, index) =>
    [1, 4, 8].includes(index)
      ? {
          type: "combat",
          title: "Guard",
          setup: "Face a guard.",
          tier: index === 8 ? "boss" : index === 4 ? "elite" : "soldier",
        }
      : { type: "story", title: "Scene", goal: "Meet the keeper.", guide: "Continue." },
  ),
};
const completion = { content: JSON.stringify(plan), finishReason: "stop" };
let cleanup;
try {
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.pathname, "/api/connections");
    return Response.json([{ id: "fixture-story", provider: "custom", model: "fixture-only", maxContext: 10000 }]);
  };
  const modulePath = join(directory, "server.mjs");
  await writeFile(modulePath, await readFile(new URL("../packages/gacha-forge/server.mjs", import.meta.url)));
  const { activate } = await import(pathToFileURL(modulePath).href);
  cleanup = await activate({
    dataDir: directory,
    package: { id: packageId },
    api: {
      runtime: {
        logger: Object.fromEntries(["info", "warn", "error", "debug"].map((level) => [level, () => {}])),
        json: { parseJsonish: JSON.parse },
        persistence: {
          documents: {
            getById: async (_package, id) => clone(docs.get(id) ?? null),
            list: async (_package, kind) => clone([...docs.values()].filter((doc) => !kind || doc.kind === kind)),
            create: async (document) => {
              assert.equal(document.packageId, packageId);
              assert.equal(docs.has(document.id), false, "a generated document must not overwrite another save");
              const saved = { ...clone(document), revision: 1 };
              docs.set(saved.id, saved);
              return clone(saved);
            },
            update: async (document) => {
              const old = docs.get(document.id);
              if (old?.revision !== document.expectedRevision) return null;
              const saved = { ...old, ...clone(document), revision: old.revision + 1 };
              docs.set(saved.id, saved);
              return clone(saved);
            },
          },
        },
        languageModels: {
          resolveForRequest: async ({ connectionId }) => {
            assert.equal(connectionId, "fixture-story");
            return {
              connectionId,
              model: "fixture-only",
              maxContext: 10000,
              chatComplete: async (_messages, options) => {
                requests.push(options);
                assert.ok(options.signal instanceof AbortSignal, "the shipped common LLM helper forwards its scope");
                if (requests.length === 1) {
                  started.resolve();
                  return lateResponse.promise; // Deliberately ignore abort to test the late-commit guard.
                }
                return completion;
              },
            };
          },
        },
      },
      registerPrivilegedRoutes: async (register) =>
        register({
          get: (path, handler) => routes.set(path, handler),
          post: (path, handler) => routes.set(path, handler),
        }),
    },
  });
  const post = (path, body = {}) => {
    assert.ok(routes.has(path), `The shipped package registers ${path}`);
    return routes.get(path)({ body: { runId, ...body } });
  };
  const pending = post("/chapter-plan", { chapter: 1 });
  await started.promise;
  assert.equal(requests[0].signal.aborted, false);
  assert.deepEqual(await post("/story/cancel", { chapter: 1 }), { ok: true });
  assert.equal(requests[0].signal.aborted, true, "the actual shipped cancel route aborts the active LLM signal");
  assert.deepEqual(await pending, { ok: false, error: "cancelled" }, "cancel settles before the provider returns");
  assert.equal(docs.has(chapterId), false);
  assert.deepEqual(docs.get("index").data, originalWorld, "cancellation preserves the saved world");
  assert.deepEqual(docs.get(sessionId).data, {
    ...originalSession,
    preforge: { 1: { cancelled: true } },
  });
  const preforge = await post("/preforge/cancel", { chapter: 1 });
  assert.equal(preforge.ok, true, "the existing preforge cancel route still works");
  assert.equal(preforge.preforge.cancelled, true);

  lateResponse.resolve(completion);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(docs.has(chapterId), false, "a late provider completion cannot create a cancelled chapter");
  assert.equal(requests.length, 1, "cancellation must not retry or use a fallback provider");
  assert.deepEqual(docs.get(sessionId).data.progress, originalSession.progress);
  assert.deepEqual(docs.get(sessionId).data.wallet, originalSession.wallet);
  const recovered = await post("/chapter-plan", { chapter: 1 });
  assert.equal(recovered.ok, true, "a fresh request can recover after the cancelled job settles");
  assert.equal(docs.has(chapterId), true);
  assert.equal(requests.length, 2);
  assert.notEqual(requests[1].signal, requests[0].signal);
  assert.equal(requests[1].signal.aborted, false);
  console.info("Shipped chapter/cancel routes abort active LLM work, block late writes and preserve saves and retry.");
} finally {
  cleanup?.();
  globalThis.fetch = originalFetch;
  await rm(directory, { recursive: true, force: true });
}
