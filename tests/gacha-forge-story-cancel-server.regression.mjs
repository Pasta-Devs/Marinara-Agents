import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import {
  createForgeStoryCancellation,
  forgeStoryGenerationSignal,
  forgeStoryAssertActive,
  forgeStoryDocuments,
} from "../sources/forge-kit/story-cancel-server.mjs";

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const turn = () => new Promise((resolve) => setImmediate(resolve));
const cancelled = { ok: false, error: "cancelled" };
const runtime = createForgeStoryCancellation();
assert.equal(forgeStoryGenerationSignal(), undefined, "non-story generation has no cancellation scope");
forgeStoryAssertActive();
const writes = [],
  rawDocuments = {
    create: (...args) => writes.push(["create", ...args]),
    update: (...args) => writes.push(["update", ...args]),
    getById: () => "read is preserved",
  },
  documents = forgeStoryDocuments(rawDocuments),
  lateWriteErrors = [];
assert.equal(documents.getById, rawDocuments.getById);
documents.create("outside");
documents.update("outside");
assert.deepEqual(writes, [
  ["create", "outside"],
  ["update", "outside"],
]);

const started = deferred(),
  release = deferred();
let activeSignal,
  committed = false;
const active = runtime.run("world-a", async (signal) => {
  activeSignal = signal;
  assert.equal(forgeStoryGenerationSignal(), signal);
  started.resolve();
  await release.promise; // Model a provider that ignores abort and completes late.
  for (const method of ["create", "update"])
    try {
      documents[method]("stale");
    } catch (error) {
      lateWriteErrors.push(error.name);
    }
  forgeStoryAssertActive();
  committed = true;
  return { ok: true };
});
await started.promise;
assert.equal(getEventListeners(activeSignal, "abort").length, 1);
assert.equal(runtime.cancel("world-a"), true);
assert.equal(activeSignal.aborted, true, "the signal passed to the actual host LLM is aborted");
assert.deepEqual(await active, cancelled, "cancellation does not wait for an uncooperative provider");
assert.equal(getEventListeners(activeSignal, "abort").length, 0);

const nextStarted = deferred(),
  nextRelease = deferred();
let nextSignal;
const next = runtime.run("world-a", async (signal) => {
  nextSignal = signal;
  nextStarted.resolve();
  await nextRelease.promise;
  forgeStoryAssertActive();
  documents.create("new");
  documents.update("new");
  return { ok: true, generation: "new" };
});
await nextStarted.promise;
assert.notEqual(nextSignal, activeSignal);
assert.equal(nextSignal.aborted, false);
release.resolve();
await turn();
assert.equal(committed, false, "a cancelled old scope cannot commit after a new generation starts");
assert.deepEqual(lateWriteErrors, ["AbortError", "AbortError"]);
assert.equal(writes.length, 2, "the guarded document methods reject cancelled-scope writes before persistence");
assert.equal(nextSignal.aborted, false, "late old cleanup cannot cancel the new generation");
nextRelease.resolve();
assert.deepEqual(await next, { ok: true, generation: "new" });
assert.deepEqual(writes.slice(2), [
  ["create", "new"],
  ["update", "new"],
]);
assert.equal(getEventListeners(nextSignal, "abort").length, 0);

let immediateStarts = 0;
const immediate = runtime.run("immediate", () => {
  immediateStarts++;
});
runtime.cancel("immediate");
assert.deepEqual(await immediate, cancelled);
assert.equal(immediateStarts, 0, "cancel before deferred dispatch never starts generation");

const firstReady = deferred(),
  secondReady = deferred(),
  separateReady = deferred(),
  firstRelease = deferred(),
  secondRelease = deferred(),
  separateRelease = deferred();
const signals = [];
const first = runtime.run("shared", async (signal) => {
  signals.push(signal);
  firstReady.resolve();
  await firstRelease.promise;
  forgeStoryAssertActive();
});
const second = runtime.run("shared", async (signal) => {
  signals.push(signal);
  secondReady.resolve();
  await secondRelease.promise;
  forgeStoryAssertActive();
});
const separate = runtime.run("separate", async (signal) => {
  signals.push(signal);
  separateReady.resolve();
  await separateRelease.promise;
  forgeStoryAssertActive();
  return "unrelated world";
});
await Promise.all([firstReady.promise, secondReady.promise, separateReady.promise]);
assert.equal(signals[0], signals[1], "foreground and background work share their world's cancellation");
assert.notEqual(signals[0], signals[2]);
runtime.cancel("shared");
assert.deepEqual(await first, cancelled);
assert.deepEqual(await second, cancelled);
assert.equal(signals[2].aborted, false);
firstRelease.resolve();
secondRelease.resolve();
separateRelease.resolve();
assert.equal(await separate, "unrelated world");
await turn();

const error = new Error("provider failed");
await assert.rejects(
  runtime.run("error", () => {
    throw error;
  }),
  (actual) => actual === error,
  "unexpected provider errors remain errors",
);
assert.equal(runtime.cancel("unknown"), false);
assert.deepEqual(await runtime.run("", () => assert.fail("invalid world dispatched")), {
  ok: false,
  error: "bad-request",
});
const disposalReady = deferred(),
  disposalRelease = deferred();
let disposalSignal;
const disposing = runtime.run("disposal", async (signal) => {
  disposalSignal = signal;
  disposalReady.resolve();
  await disposalRelease.promise;
  forgeStoryAssertActive();
});
await disposalReady.promise;
runtime.dispose();
assert.equal(disposalSignal.aborted, true);
assert.deepEqual(await disposing, cancelled);
disposalRelease.resolve();
await turn();
assert.deepEqual(await runtime.run("after-disposal", () => assert.fail("disposed runtime dispatched")), cancelled);
assert.equal(forgeStoryGenerationSignal(), undefined);
console.info(
  "Story cancellation aborts scoped LLM signals, rejects late commits, preserves new/other worlds and cleans listeners.",
);
