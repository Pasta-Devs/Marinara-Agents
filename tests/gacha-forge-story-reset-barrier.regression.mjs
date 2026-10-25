import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createForgeStoryCancellation,
  forgeStoryDocuments,
  forgeStoryWork,
} from "../packages/gacha-forge/src/story-cancel-server.mjs";
import { createForgeStoryMemoryIntegration } from "../packages/gacha-forge/src/story-memory-integration.mjs";

const deferred = () => Promise.withResolvers();
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("reset drains the actual provider operation after ordinary cancel has already replied", async () => {
  const runtime = createForgeStoryCancellation();
  const started = deferred(),
    late = deferred(),
    events = [];
  const documents = forgeStoryDocuments({ create: async () => events.push("write") });
  const request = runtime.run("world", async () => {
    started.resolve();
    await late.promise;
    await documents.create({ id: "world:chapter:1" });
  });
  await started.promise;
  runtime.cancel("world");
  assert.deepEqual(await request, { ok: false, error: "cancelled" });
  let resetFinished = false;
  const reset = runtime.reset("world", async () => {
    events.push("reset");
    resetFinished = true;
    return { ok: true };
  });
  await tick();
  assert.equal(resetFinished, false);
  assert.deepEqual(await runtime.run("world", async () => events.push("new")), {
    ok: false,
    error: "reset-in-progress",
  });
  late.resolve();
  assert.deepEqual(await reset, { ok: true });
  assert.deepEqual(events, ["reset"], "the old provider cannot write or start replacement work during reset");
  assert.equal(await runtime.run("world", async () => "fresh"), "fresh");
  runtime.dispose();
});

test("reset joins a document write that entered persistence before cancellation", async () => {
  const runtime = createForgeStoryCancellation();
  const entered = deferred(),
    release = deferred(),
    events = [];
  const documents = forgeStoryDocuments({
    update: async () => {
      entered.resolve();
      await release.promise;
      events.push("saved");
      return true;
    },
  });
  const request = runtime.run("world", () => documents.update({ id: "world:beat:1:0" }));
  await entered.promise;
  const reset = runtime.reset("world", async () => {
    events.push("removed");
    return { ok: true };
  });
  assert.deepEqual(await request, { ok: false, error: "cancelled" });
  await tick();
  assert.deepEqual(events, []);
  release.resolve();
  await reset;
  assert.deepEqual(events, ["saved", "removed"]);
  runtime.dispose();
});

test("a reset still drains older canceled epochs after a fresh request was admitted", async () => {
  const runtime = createForgeStoryCancellation();
  const old = deferred(),
    started = deferred();
  const request = runtime.run("world", async () => {
    started.resolve();
    await old.promise;
  });
  await started.promise;
  runtime.cancel("world");
  await request;
  assert.equal(await runtime.run("world", async () => "new epoch"), "new epoch");
  let finished = false;
  const reset = runtime.reset("world", async () => {
    finished = true;
  });
  await tick();
  assert.equal(finished, false);
  old.resolve();
  await reset;
  assert.equal(finished, true);
  runtime.dispose();
});

test("reset failure releases admission while keeping the canceled epoch fenced", async () => {
  const runtime = createForgeStoryCancellation();
  await assert.rejects(
    runtime.reset("world", async () => {
      throw new Error("transaction rollback");
    }),
    /transaction rollback/,
  );
  assert.equal(await runtime.run("world", async () => "recover"), "recover");
  runtime.dispose();
});

test("scheduled automatic memory joins the same story scope and cannot repopulate reset records", async () => {
  const runtime = createForgeStoryCancellation(),
    started = deferred(),
    release = deferred(),
    events = [];
  const documents = forgeStoryDocuments({ update: async () => events.push("late memory write") });
  const memory = createForgeStoryMemoryIntegration({
    createMemory: () => ({
      maintain: async () => {
        started.resolve();
        await release.promise;
        await documents.update({ id: "world:summary:memory" });
      },
    }),
    background: (operation) => operation(),
    runStory: (runId, operation) => runtime.run(runId, operation),
  });
  const scheduled = memory.schedule("world");
  await started.promise;
  const reset = runtime.reset("world", async () => events.push("reset"));
  await scheduled;
  await tick();
  assert.deepEqual(events, []);
  release.resolve();
  await reset;
  assert.deepEqual(events, ["reset"]);
  runtime.dispose();
});

test("detached provider descendants remain tracked after their route returned", async () => {
  const runtime = createForgeStoryCancellation(),
    release = deferred(),
    events = [];
  let child;
  assert.equal(
    await runtime.run("world", async () => {
      child = forgeStoryWork(async () => {
        await release.promise;
        forgeStoryWork(() => {
          events.push("late upload");
          return Promise.resolve();
        });
      });
      void child.catch(() => {});
      return "route returned";
    }),
    "route returned",
  );
  const reset = runtime.reset("world", async () => events.push("reset"));
  await tick();
  assert.deepEqual(events, []);
  release.resolve();
  await reset;
  await assert.rejects(child, { name: "AbortError" });
  assert.deepEqual(events, ["reset"]);
  runtime.dispose();
});
