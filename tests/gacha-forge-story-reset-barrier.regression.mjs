import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createForgeStoryCancellation,
  forgeStoryDocuments,
  forgeStoryWork,
} from "../sources/forge-kit/story-cancel-server.mjs";
import { createForgeStoryMemoryIntegration } from "../sources/forge-kit/story-memory-integration.mjs";

const deferred = () => Promise.withResolvers();
const tick = () => new Promise((resolve) => setImmediate(resolve));

for (const kind of ["operation", "write"]) {
  test(`a timed-out ${kind} drain preserves the chapter and pending work for explicit retry`, async () => {
    const runtime = createForgeStoryCancellation({ resetDrainTimeoutMs: 30 });
    const started = deferred(),
      release = deferred();
    let calls = 0,
      cleanups = 0,
      retry;
    const documents = forgeStoryDocuments({
      update() {
        calls++;
        started.resolve();
        return release.promise;
      },
    });
    const work = runtime.run("world", async () => {
      if (kind === "write") {
        void documents.update();
        return "write entered";
      }
      calls++;
      started.resolve();
      await release.promise;
    });
    try {
      await started.promise;
      const result = await runtime.reset("world", async () => ++cleanups);
      assert.deepEqual(result, { ok: false, error: "reset-drain-timeout", retryable: true });
      assert.equal(cleanups, 0, "a deadline must not enter transactional cleanup");
      assert.equal(calls, 1, "timeout must not resend provider or document work");
      retry = runtime.reset("world", async () => ++cleanups);
      await tick();
      assert.equal(cleanups, 0, "the retry still joins the original pending work");
      release.resolve();
      assert.equal(await retry, 1);
      await work;
      assert.equal(cleanups, 1);
      assert.equal(calls, 1);
      assert.equal(await runtime.run("world", async () => "fresh"), "fresh");
    } finally {
      release.resolve();
      await Promise.allSettled([work, retry].filter(Boolean));
      runtime.dispose();
    }
  });
}

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

test("a reset that became stale after precheck leaves the newly active provider untouched", async () => {
  const runtime = createForgeStoryCancellation(),
    started = deferred(),
    release = deferred();
  let signal;
  const generation = runtime.run("world", async (current) => {
    signal = current;
    started.resolve();
    await release.promise;
    return "fresh result";
  });
  await started.promise;
  let cleanup = false;
  assert.deepEqual(
    await runtime.reset(
      "world",
      async () => {
        cleanup = true;
      },
      async () => ({ ok: false, error: "story-changed" }),
    ),
    { ok: false, error: "story-changed" },
  );
  assert.equal(cleanup, false);
  assert.equal(signal.aborted, false);
  release.resolve();
  assert.equal(await generation, "fresh result");
  runtime.dispose();
});

test("denied asynchronous eligibility preserves an admitted story's nested operation", async () => {
  const runtime = createForgeStoryCancellation(),
    started = deferred(),
    release = deferred(),
    childDone = deferred();
  const story = runtime.run("world", async () => {
    started.resolve();
    await release.promise;
    const result = await runtime.run("world", async () => "nested result");
    childDone.resolve(result);
    return result;
  });
  await started.promise;
  const reset = runtime.reset(
    "world",
    async () => {
      throw new Error("must not clean up");
    },
    async () => {
      release.resolve();
      assert.equal(await childDone.promise, "nested result");
      return { ok: false, error: "story-changed" };
    },
  );
  assert.equal(await story, "nested result");
  assert.deepEqual(await reset, { ok: false, error: "story-changed" });
  runtime.dispose();
});

test("accepted eligibility aborts and drains a child admitted during validation", async () => {
  const runtime = createForgeStoryCancellation(),
    startChild = deferred(),
    childStarted = deferred(),
    release = deferred();
  let signal,
    cleaned = false;
  const story = runtime.run("world", async () => {
    await startChild.promise;
    return runtime.run("world", async (current) => {
      signal = current;
      childStarted.resolve();
      await release.promise;
    });
  });
  const reset = runtime.reset(
    "world",
    async () => {
      cleaned = true;
    },
    async () => {
      startChild.resolve();
      await childStarted.promise;
      return { ok: true };
    },
  );
  assert.deepEqual(await story, { ok: false, error: "cancelled" });
  assert.equal(signal.aborted, true);
  assert.equal(cleaned, false);
  release.resolve();
  await reset;
  assert.equal(cleaned, true);
  runtime.dispose();
});
