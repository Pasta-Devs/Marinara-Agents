import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock } from "node:test";
import { runRegressionToCompletion, runWithSafeCleanup } from "./regression-helpers.ts";

const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => (resolve = next));
  return { promise, resolve };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
  const { configurePackageRuntime } = await import(`${source}/package-runtime.ts`);
  const { LongTermMemoryStorage } = await import(`${source}/persistence/storage.ts`);
  const { LongTermMemoryDraftStore } = await import(`${source}/drafts/draft-store.ts`);
  const { applyLongTermMemoryDraft } = await import(`${source}/drafts/reconciliation.ts`);
  const { retrieveLongTermMemory } = await import(`${source}/recall/retrieval.ts`);
  const { loadOrRebuildLongTermMemoryIndexes, rebuildLongTermMemoryIndexes } = await import(
    `${source}/recall/rebuild.ts`
  );
  const { readLtmIndexState } = await import(`${source}/persistence/index-state.ts`);
  const { recordLtmDebugEvent } = await import(`${source}/maintenance/debug-log.ts`);
  const { withLtmVaultLock } = await import(`${source}/persistence/vault-lock.ts`);

  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-rebuild-job-"));
  const root = join(dataDir, "long-term-memory");
  const warnings: unknown[][] = [];
  const logger = {
    debug() {},
    info() {},
    warn(...args: unknown[]) {
      warnings.push(args);
    },
    error() {},
  };
  // Counts document embedding calls (one per rebuild that has new text) and can hold or fail one.
  const documentEmbeds: string[][] = [];
  let hold: { entered: ReturnType<typeof deferred>; release: ReturnType<typeof deferred> } | undefined;
  let failNextEmbed = false;
  const adapter = {
    spaceId: "rebuild-job-space",
    label: "rebuild job embeddings",
    async embed(texts: string[], _signal?: AbortSignal, inputType?: "query" | "document") {
      if (inputType === "query") return texts.map(() => [1, 1]);
      documentEmbeds.push([...texts]);
      const held = hold;
      if (held) {
        held.entered.resolve();
        await held.release.promise;
      }
      if (failNextEmbed) {
        failNextEmbed = false;
        throw new Error("embedding provider unavailable");
      }
      return texts.map((text) => [(text.length % 5) + 1, 1]);
    },
  };
  // A second embedding source, for the upgrades a recall asks for. It shares the counter and the hold above.
  const upgradeSignals: (AbortSignal | undefined)[] = [];
  const upgradeAdapter = {
    spaceId: "rebuild-job-upgrade-space",
    label: "rebuild job upgrade embeddings",
    embed(texts: string[], signal?: AbortSignal, inputType?: "query" | "document") {
      if (inputType !== "query") upgradeSignals.push(signal);
      return adapter.embed(texts, signal, inputType);
    },
  };
  const releaseHost = configurePackageRuntime({ dataDir, logger, embeddings: adapter });
  const scope = { chatId: "chat-a", chatIds: ["chat-a"] };
  const timestamp = "2026-10-20T00:00:00.000Z";
  const worldNote = (id: string, text: string) => ({
    id,
    title: id,
    type: "world",
    modes: ["roleplay"],
    scope,
    tags: [],
    keywords: [],
    links: [],
    sections: { facts: { text, updatedAt: timestamp } },
  });
  const editFacts = (id: string, text: string) =>
    storage.updateNote(id, { sections: { facts: { text, updatedAt: timestamp } } });
  const storage = new LongTermMemoryStorage(root);

  await runWithSafeCleanup(
    "LTM rebuild job",
    async () => {
      await storage.initializeLtmStore();
      await storage.createNote(worldNote("world_rebuild_seed", "The lighthouse keeper logs every storm."));
      await rebuildLongTermMemoryIndexes({ root });

      // "Apply all" sends one request per draft (one per source). The drafts applied in one quiet period
      // rebuild the index once, and a recall right after them still sees the last one.
      const draftStore = new LongTermMemoryDraftStore(root);
      const drafts = [];
      for (let index = 0; index < 10; index += 1) {
        const sourceNote = await storage.createNote({
          id: `source_chat_summary_${index.toString(16).padStart(16, "0")}`,
          title: `Harbor log ${index}`,
          type: "source",
          status: "active",
          modes: ["roleplay"],
          scope,
          tags: ["source_summary", "imported_chat"],
          keywords: [],
          links: [],
          provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: `harbor-${index}` },
          sections: { source: { text: `Harbor log entry ${index}.`, updatedAt: timestamp } },
        });
        drafts.push(
          await draftStore.createDraft({
            source: { sourceNoteId: sourceNote.id, chatId: "chat-a" },
            scope,
            modes: ["roleplay"],
            response: {
              summary: `Record harbor bell ${index}.`,
              mutations: [
                {
                  id: randomUUID(),
                  claimKind: "static",
                  kind: "create_note",
                  risk: "low",
                  confidence: 0.9,
                  summary: `Create harbor bell ${index}`,
                  evidence: [`source_note:${sourceNote.id}`],
                  note: worldNote(`world_harbor_bell_${index}`, `Harbor bell ${index} rings at dusk.`),
                },
              ],
            },
          }),
        );
      }
      documentEmbeds.length = 0;
      mock.timers.enable({ apis: ["setTimeout"] });
      try {
        for (const draft of drafts) {
          assert.equal((await applyLongTermMemoryDraft(draft.id, { root })).appliedMutationIds.length, 1);
        }
        const recalled = await retrieveLongTermMemory({ root, queryText: "harbor bell 9", scope, mode: "roleplay" });
        assert.equal(documentEmbeds.length, 1, "ten draft applies in one quiet period must rebuild the index once");
        assert.ok(
          recalled.chunks.some((item: any) => item.chunk.noteId === "world_harbor_bell_9"),
          "a recall right after the applies must see the last applied memory",
        );
      } finally {
        mock.timers.reset();
      }

      const {
        LTM_REBUILD_MAX_WAIT_MS,
        LTM_REBUILD_QUIET_MS,
        flushLtmIndexRebuild,
        resumeLtmIndexRebuild,
        scheduleLtmIndexRebuild,
        stopLtmIndexRebuild,
      } = await import(`${source}/recall/rebuild-job.ts`);
      const { scheduleLongTermMemoryIndexRebuild } = await import(`${source}/recall/rebuild.ts`);

      // The job runner on its own, with a fake run and a fake clock.
      mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
      try {
        const runnerRoot = join(dataDir, "runner");
        const runs: number[] = [];
        let blocked: ReturnType<typeof deferred> | undefined;
        const run = async () => {
          runs.push(Date.now());
          await blocked?.promise;
        };

        // Rapid requests coalesce: ten requests 100 ms apart start one run, a quiet period after the last.
        for (let index = 0; index < 10; index += 1) {
          scheduleLtmIndexRebuild(runnerRoot, run);
          mock.timers.tick(100);
        }
        mock.timers.tick(LTM_REBUILD_QUIET_MS - 101);
        assert.deepEqual(runs, [], "a request inside the quiet period postpones the run");
        mock.timers.tick(1);
        assert.deepEqual(runs, [900 + LTM_REBUILD_QUIET_MS], "ten rapid requests must start exactly one run");
        await flushLtmIndexRebuild(runnerRoot);

        // A steady stream still runs: the cap starts the job 10 s after the first waiting request.
        runs.length = 0;
        const firstRequestAt = Date.now();
        while (Date.now() < firstRequestAt + LTM_REBUILD_MAX_WAIT_MS) {
          assert.deepEqual(runs, [], "a request every 500 ms keeps postponing the run until the cap");
          scheduleLtmIndexRebuild(runnerRoot, run);
          mock.timers.tick(500);
        }
        assert.deepEqual(runs, [firstRequestAt + LTM_REBUILD_MAX_WAIT_MS], "the cap must start the run at 10 s");
        await flushLtmIndexRebuild(runnerRoot);

        // A request during a run is not lost: it starts a follow-up run after its own quiet period.
        runs.length = 0;
        blocked = deferred();
        scheduleLtmIndexRebuild(runnerRoot, run);
        mock.timers.tick(LTM_REBUILD_QUIET_MS);
        assert.equal(runs.length, 1);
        scheduleLtmIndexRebuild(runnerRoot, run);
        blocked.resolve();
        blocked = undefined;
        await settle();
        assert.equal(runs.length, 1, "the follow-up waits for its quiet period");
        mock.timers.tick(LTM_REBUILD_QUIET_MS);
        assert.equal(runs.length, 2, "a request made during a run must start a follow-up run");
        await flushLtmIndexRebuild(runnerRoot);

        // A reader waits for one run, not for the follow-ups later writes ask for, so a steady stream of writes
        // cannot hold it.
        runs.length = 0;
        blocked = deferred();
        scheduleLtmIndexRebuild(runnerRoot, run);
        const reader = flushLtmIndexRebuild(runnerRoot);
        assert.equal(runs.length, 1, "a reader starts the pending run");
        scheduleLtmIndexRebuild(runnerRoot, run);
        blocked.resolve();
        blocked = undefined;
        await reader;
        assert.equal(runs.length, 1, "a reader must not wait for a follow-up a later write asked for");
        mock.timers.tick(LTM_REBUILD_QUIET_MS);
        assert.equal(runs.length, 2);
        await flushLtmIndexRebuild(runnerRoot);

        // A failed run is logged and does not wedge the job or reject a waiting reader.
        runs.length = 0;
        warnings.length = 0;
        scheduleLtmIndexRebuild(runnerRoot, async () => {
          runs.push(Date.now());
          throw new Error("rebuild failed");
        });
        await flushLtmIndexRebuild(runnerRoot);
        assert.equal(runs.length, 1);
        assert.equal(warnings.length, 1, "a failed background rebuild must be logged");
        scheduleLtmIndexRebuild(runnerRoot, run);
        mock.timers.tick(LTM_REBUILD_QUIET_MS);
        assert.equal(runs.length, 2, "the next request must run again after a failure");
        await flushLtmIndexRebuild(runnerRoot);

        // Lock order: waiting on the job under the vault lock would deadlock, so it throws; a job scheduled
        // inside a mutation does not inherit its lock and waits for the mutation to release it.
        const order: string[] = [];
        await withLtmVaultLock(runnerRoot, async () => {
          await assert.rejects(flushLtmIndexRebuild(runnerRoot), /cannot be awaited while holding the vault lock/u);
          await assert.rejects(stopLtmIndexRebuild(runnerRoot), /cannot be awaited while holding the vault lock/u);
          scheduleLtmIndexRebuild(runnerRoot, (key: string) =>
            withLtmVaultLock(key, async () => void order.push("job")),
          );
          mock.timers.tick(LTM_REBUILD_QUIET_MS);
          await settle();
          order.push("mutation");
        });
        await flushLtmIndexRebuild(runnerRoot);
        assert.deepEqual(order, ["mutation", "job"], "a job scheduled inside a mutation must wait for its lock");

        // An upgrade-only job (the index is current, its vectors are not) never makes a reader wait.
        runs.length = 0;
        scheduleLtmIndexRebuild(runnerRoot, run, { upgradeOnly: true });
        await flushLtmIndexRebuild(runnerRoot);
        assert.deepEqual(runs, [], "a reader must not wait for an upgrade-only job");
        mock.timers.tick(LTM_REBUILD_QUIET_MS);
        assert.equal(runs.length, 1);
        await settle();

        // A write while an upgrade-only job runs stops that run, and the write's follow-up run starts.
        let upgradeRunSignal: AbortSignal | undefined;
        scheduleLtmIndexRebuild(
          runnerRoot,
          (_key: string, signal: AbortSignal) => {
            upgradeRunSignal = signal;
            return new Promise((_resolve, reject) =>
              signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
            );
          },
          { upgradeOnly: true },
        );
        mock.timers.tick(LTM_REBUILD_QUIET_MS);
        assert.equal(upgradeRunSignal?.aborted, false);
        runs.length = 0;
        scheduleLtmIndexRebuild(runnerRoot, run);
        assert.equal(upgradeRunSignal?.aborted, true, "a write must stop a running upgrade-only job");
        await settle();
        mock.timers.tick(LTM_REBUILD_QUIET_MS);
        assert.equal(runs.length, 1, "the write's follow-up run must start");
        await flushLtmIndexRebuild(runnerRoot);

        // Deactivation drops a pending job, aborts a running one without logging a failure, and ignores later
        // requests until the package is activated again.
        runs.length = 0;
        warnings.length = 0;
        scheduleLtmIndexRebuild(runnerRoot, run);
        await stopLtmIndexRebuild(runnerRoot);
        mock.timers.tick(LTM_REBUILD_QUIET_MS);
        assert.deepEqual(runs, [], "deactivation must drop a pending rebuild");
        scheduleLtmIndexRebuild(runnerRoot, run, { upgradeOnly: true });
        mock.timers.tick(LTM_REBUILD_QUIET_MS);
        assert.deepEqual(runs, [], "a request after deactivation must not start a rebuild");
        resumeLtmIndexRebuild(runnerRoot);
        let stoppedSignal: AbortSignal | undefined;
        scheduleLtmIndexRebuild(runnerRoot, (_key: string, signal: AbortSignal) => {
          stoppedSignal = signal;
          return new Promise((_resolve, reject) =>
            signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
          );
        });
        mock.timers.tick(LTM_REBUILD_QUIET_MS);
        await stopLtmIndexRebuild(runnerRoot);
        assert.equal(stoppedSignal?.aborted, true, "deactivation must abort a running rebuild");
        assert.equal(warnings.length, 0, "an aborted rebuild is not a failure");
        resumeLtmIndexRebuild(runnerRoot);
      } finally {
        mock.timers.reset();
      }

      // The real rebuild holds the vault lock only to read and to publish. While it embeds, a vault write and a
      // debug event both finish; the write moves the index state, so the build is dropped and run again, and
      // the second embed covers only the text that changed.
      documentEmbeds.length = 0;
      hold = { entered: deferred(), release: deferred() };
      const embedding = hold;
      await editFacts("world_harbor_bell_0", "Harbor bell 0 now rings at dawn.");
      scheduleLongTermMemoryIndexRebuild(root);
      const flushed = flushLtmIndexRebuild(root);
      await embedding.entered.promise;
      await editFacts("world_harbor_bell_1", "Harbor bell 1 hangs beside a green lantern.");
      scheduleLongTermMemoryIndexRebuild(root);
      await recordLtmDebugEvent({ root, phase: "diagnostic", action: "during-rebuild", status: "ok" });
      hold = undefined;
      embedding.release.resolve();
      await flushed;
      assert.equal(documentEmbeds.length, 2, "a write during the embed must run the build again");
      assert.equal(documentEmbeds[1]!.length, 1, "the second build must reuse the vectors the first one embedded");
      assert.match(documentEmbeds[1]![0]!, /green lantern/u);
      let state = await readLtmIndexState(root);
      assert.equal(state.dirty, false);
      assert.equal(state.rebuildState, "idle");
      const loaded: { outcome?: string } = {};
      await loadOrRebuildLongTermMemoryIndexes(root, undefined, undefined, undefined, loaded);
      assert.equal(loaded.outcome, "loaded", "the published index must already include the write made mid-build");

      // An editor save rebuilds under the lock while a background build embeds older notes. That build must
      // not replace the newer index or mark it current.
      hold = { entered: deferred(), release: deferred() };
      const outrun = hold;
      await editFacts("world_harbor_bell_3", "Harbor bell 3 was recast in bronze.");
      scheduleLongTermMemoryIndexRebuild(root);
      const outrunFlush = flushLtmIndexRebuild(root);
      await outrun.entered.promise;
      hold = undefined;
      await editFacts("world_harbor_bell_4", "Harbor bell 4 tolls for the drowned pilot.");
      await rebuildLongTermMemoryIndexes({ root });
      outrun.release.resolve();
      await outrunFlush;
      const reloaded: { outcome?: string } = {};
      await loadOrRebuildLongTermMemoryIndexes(root, undefined, undefined, undefined, reloaded);
      assert.equal(reloaded.outcome, "loaded", "an older background build must not replace a newer index");
      const pilot = await retrieveLongTermMemory({ root, queryText: "drowned pilot", scope, mode: "roleplay" });
      assert.equal(pilot.chunks[0]?.chunk.noteId, "world_harbor_bell_4");

      // An older build that fails after a newer one published leaves the newer index's state alone.
      hold = { entered: deferred(), release: deferred() };
      const failing = hold;
      await editFacts("world_harbor_bell_6", "Harbor bell 6 was lost at sea.");
      scheduleLongTermMemoryIndexRebuild(root);
      const failingFlush = flushLtmIndexRebuild(root);
      await failing.entered.promise;
      hold = undefined;
      await rebuildLongTermMemoryIndexes({ root });
      failNextEmbed = true;
      failing.release.resolve();
      await failingFlush;
      assert.equal(
        (await readLtmIndexState(root)).rebuildState,
        "idle",
        "an older build's failure must not mark a newer index failed",
      );

      // A recall whose embedding source the index does not match starts an upgrade with that source. Returns
      // the release for its held embed.
      const startUpgrade = async () => {
        hold = { entered: deferred(), release: deferred() };
        const upgrading = hold;
        mock.timers.enable({ apis: ["setTimeout"] });
        try {
          await loadOrRebuildLongTermMemoryIndexes(root, upgradeAdapter);
          mock.timers.tick(LTM_REBUILD_QUIET_MS);
        } finally {
          mock.timers.reset();
        }
        await upgrading.entered.promise;
        hold = undefined;
        return upgrading.release;
      };

      // A write that schedules its rebuild while an upgrade embeds stops the upgrade; the write's own rebuild uses
      // the host's source.
      const releaseUpgrade = await startUpgrade();
      await editFacts("world_harbor_bell_5", "Harbor bell 5 hangs in the chapel tower.");
      scheduleLongTermMemoryIndexRebuild(root);
      assert.equal(upgradeSignals[0]?.aborted, true, "a write must stop a running upgrade");
      releaseUpgrade.resolve();
      await flushLtmIndexRebuild(root);
      await flushLtmIndexRebuild(root);
      assert.equal(upgradeSignals.length, 1);
      const afterWrite: { outcome?: string } = {};
      await loadOrRebuildLongTermMemoryIndexes(root, undefined, undefined, undefined, afterWrite);
      assert.equal(afterWrite.outcome, "loaded");

      // A write that schedules no rebuild (a draft or a source) still drops the upgrade at publish. The upgrade
      // then stops instead of building again with a source a connection change may have replaced.
      upgradeSignals.length = 0;
      const releaseDropped = await startUpgrade();
      await editFacts("world_harbor_bell_7", "Harbor bell 7 rings for the tide.");
      hold = { entered: deferred(), release: deferred() };
      const retry = hold;
      releaseDropped.resolve();
      const retried = await Promise.race([
        retry.entered.promise.then(() => true),
        new Promise<boolean>((done) => setTimeout(() => done(false), 300)),
      ]);
      hold = undefined;
      retry.release.resolve();
      // Deactivation waits for the upgrade to end.
      await stopLtmIndexRebuild(root);
      resumeLtmIndexRebuild(root);
      assert.equal(retried, false, "a dropped upgrade must not build again with its source");
      await rebuildLongTermMemoryIndexes({ root });

      // A rebuild under the lock publishes vectors for its own source, so it aborts a running upgrade.
      upgradeSignals.length = 0;
      warnings.length = 0;
      const releaseOutpaced = await startUpgrade();
      await rebuildLongTermMemoryIndexes({ root });
      assert.equal(upgradeSignals[0]?.aborted, true, "a rebuild under the lock must abort a running upgrade");
      releaseOutpaced.resolve();
      // Deactivation waits for the aborted upgrade to end.
      await stopLtmIndexRebuild(root);
      resumeLtmIndexRebuild(root);
      assert.equal(warnings.length, 0, "an aborted upgrade is not a failure");
      assert.equal(upgradeSignals.length, 1);
      state = await readLtmIndexState(root);
      assert.equal(state.rebuildState, "idle");

      // A rebuild stopped before it marks the index building has changed nothing, so it leaves a current index
      // as it found it instead of marking it failed.
      scheduleLongTermMemoryIndexRebuild(root);
      const waiting = flushLtmIndexRebuild(root);
      await stopLtmIndexRebuild(root);
      await waiting;
      resumeLtmIndexRebuild(root);
      state = await readLtmIndexState(root);
      assert.equal(state.rebuildState, "idle", "a rebuild stopped before it started must not mark the index failed");
      assert.equal(state.dirty, false);

      // A failed rebuild leaves the index state failed and dirty; the next write's rebuild repairs it.
      failNextEmbed = true;
      await editFacts("world_harbor_bell_2", "Harbor bell 2 cracked in the frost.");
      scheduleLongTermMemoryIndexRebuild(root);
      await flushLtmIndexRebuild(root);
      state = await readLtmIndexState(root);
      assert.equal(state.rebuildState, "failed");
      assert.equal(state.dirty, true);
      scheduleLongTermMemoryIndexRebuild(root);
      await flushLtmIndexRebuild(root);
      state = await readLtmIndexState(root);
      assert.equal(state.rebuildState, "idle", "a failed rebuild must not wedge the next one");
      assert.equal(state.dirty, false);
    },
    [() => releaseHost(), () => rm(dataDir, { recursive: true, force: true })],
  );

  process.stdout.write(
    "Long-Term Memory rebuild job regression: coalescing, cap, follow-up, reader bound, failure, lock order, upgrade, stop ok\n",
  );
}

void runRegressionToCompletion("long-term-memory-rebuild-job", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
