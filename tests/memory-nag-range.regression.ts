import assert from "node:assert/strict";
import { configureMemoryNagRuntime } from "../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/package-runtime.ts";
import {
  memoryNagScanWindow,
  scanMemoryNagBatch,
  scanMemoryNagIfDue,
  startMemoryNagRangeScan,
  endMemoryNagRangeScan,
} from "../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/scanner.ts";
import { emptyMemoryNagVault } from "../packages/memory-nag/src/engine/packages/shared/src/features/agents/memory-nag/schema.ts";

async function main() {
  let messages = Array.from({ length: 1000 }, (_, i) => ({
    id: `m${i + 1}`,
    role: i % 2 ? "assistant" : "user",
    characterId: i % 2 ? "dottore" : null,
    content: `MARKER_${i + 1}_END`,
    extra: {},
    createdAt: "2026-09-09T10:00:00Z",
  }));
  let document = {
    id: "vault",
    revision: 1,
    data: {
      ...emptyMemoryNagVault("chat"),
      settings: { ...emptyMemoryNagVault("chat").settings, messagesPerBatch: 5 },
    },
  };
  const prompts: string[] = [];
  let completeScan: (() => Promise<void>) | undefined;
  const release = configureMemoryNagRuntime({
    persistence: {
      getChat: async () => ({ id: "chat", mode: "roleplay", characterIds: ["dottore"], connectionId: null }),
      listMessages: async () => messages,
      documents: {
        getById: async () => document,
        update: async (value: typeof document) => {
          document = { ...document, data: value.data, revision: document.revision + 1 };
          return document;
        },
      },
    },
    resources: { listCharacters: async () => [{ id: "dottore", data: { name: "Dottore" } }] },
    getAgentConfig: async () => null,
    isDebugAgentsEnabled: () => false,
    logger: { debugOverride: () => undefined },
    json: { parseJsonish: JSON.parse },
    languageModels: {
      resolveForRequest: async () => ({
        fitContext: (messages: unknown[]) => ({ messages }),
        chatComplete: async (prompt: unknown) => {
          prompts.push(JSON.stringify(prompt));
          await completeScan?.();
          return { content: '{"memories":[],"resolvedMemoryIds":[]}' };
        },
      }),
    },
  } as never);
  try {
    assert.equal(memoryNagScanWindow(messages, undefined), null);
    for (const bad of [
      {},
      [],
      { startMessageId: "foreign", endMessageId: "m900" },
      { startMessageId: "m900", endMessageId: "m899" },
      { startMessageId: "m900", endMessageId: "m910", afterMessageId: "foreign" },
      { startMessageId: "m900", endMessageId: "m910", afterMessageId: "m899" },
      { startMessageId: "m900", endMessageId: "m910", afterMessageId: "m911" },
    ]) {
      await assert.rejects(scanMemoryNagBatch("chat", bad), (error: any) => error.statusCode === 400);
    }
    assert.equal(prompts.length, 0, "invalid ranges never spend tokens or move the checkpoint");
    const range = {
      startMessageId: "m900",
      endMessageId: "m909",
      afterMessageId: undefined as string | undefined,
      scanId: "",
    };
    range.scanId = (await startMemoryNagRangeScan("chat", range)).scanId;
    await assert.rejects(startMemoryNagRangeScan("chat", range), (error: any) => error.statusCode === 409);
    await assert.rejects(
      scanMemoryNagBatch("chat", { ...range, scanId: "another-session" }),
      (error: any) => error.statusCode === 409,
    );
    await assert.rejects(
      scanMemoryNagBatch("chat", { ...range, endMessageId: "m910" }),
      (error: any) => error.statusCode === 409,
    );
    await assert.rejects(scanMemoryNagBatch("other-chat", range), (error: any) => error.statusCode === 409);
    assert.equal(endMemoryNagRangeScan("chat", "another-session"), false);
    assert.equal(endMemoryNagRangeScan("other-chat", range.scanId), false);
    let releaseCompletion!: () => void;
    let scanStarted!: () => void;
    const entered = new Promise<void>((resolve) => {
      scanStarted = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      releaseCompletion = resolve;
    });
    completeScan = async () => {
      scanStarted();
      await blocked;
    };
    const firstPending = scanMemoryNagBatch("chat", range);
    await entered;
    const queuedAutomatic = scanMemoryNagIfDue("chat");
    releaseCompletion();
    const first = await firstPending;
    await queuedAutomatic;
    completeScan = undefined;
    assert.equal(
      prompts.length,
      1,
      "an automatic request queued during a range batch rechecks the session after acquiring the queue",
    );
    await scanMemoryNagIfDue("chat");
    assert.equal(prompts.length, 1, "the manual session also guards the gap between requests");
    assert.deepEqual([first.processed, first.total, first.done, first.checkpointMessageId], [5, 10, false, "m904"]);
    assert.match(prompts.at(-1)!, /MARKER_900_END/);
    assert.match(prompts.at(-1)!, /MARKER_904_END/);
    assert.doesNotMatch(prompts.at(-1)!, /MARKER_(899|905)_END/);
    assert.equal(document.data.checkpointMessageId, "m904", "automatic scanning skips the omitted stale history");
    range.afterMessageId = first.checkpointMessageId!;
    messages = messages.slice(100); // A deletion before the selected range must not change its boundaries.
    const second = await scanMemoryNagBatch("chat", range);
    assert.deepEqual([second.processed, second.total, second.done], [10, 10, true]);
    assert.match(prompts.at(-1)!, /MARKER_905_END/);
    assert.match(prompts.at(-1)!, /MARKER_909_END/);
    assert.doesNotMatch(prompts.at(-1)!, /MARKER_(904|910)_END/);
    assert.equal(endMemoryNagRangeScan("chat", range.scanId), false, "the last batch releases its session");
    await scanMemoryNagBatch("chat", { startMessageId: "m899", endMessageId: "m899" });
    assert.match(prompts.at(-1)!, /MARKER_899_END/);
    assert.equal(
      document.data.checkpointMessageId,
      "m909",
      "explicitly rescanning an older range never rewinds automatic progress",
    );
    const fullMessages = messages;
    messages = messages.filter((message) => Number(message.id.slice(1)) <= 914);
    const beforeDue = prompts.length;
    await Promise.all([scanMemoryNagIfDue("chat"), scanMemoryNagIfDue("chat")]);
    assert.equal(
      prompts.length,
      beforeDue + 1,
      "automatic due checks use the checkpoint after the queued previous batch",
    );
    messages = fullMessages;
    assert.match(prompts.at(-1)!, /MARKER_910_END/);
    assert.doesNotMatch(prompts.at(-1)!, /MARKER_909_END/);
    assert.equal(document.data.checkpointMessageId, "m914", "legacy All scanning resumes at the furthest checkpoint");
    const before = prompts.length;
    await assert.rejects(scanMemoryNagBatch("chat", { startMessageId: "m1", endMessageId: "m10" }));
    assert.equal(prompts.length, before, "deleted boundaries fail rather than silently choosing another range");

    const canceledRange = { startMessageId: "m920", endMessageId: "m929", scanId: "" };
    canceledRange.scanId = (await startMemoryNagRangeScan("chat", canceledRange)).scanId;
    let releaseCanceled!: () => void;
    let canceledStarted!: () => void;
    const canceledEntered = new Promise<void>((resolve) => {
      canceledStarted = resolve;
    });
    const canceledBlocked = new Promise<void>((resolve) => {
      releaseCanceled = resolve;
    });
    completeScan = async () => {
      canceledStarted();
      await canceledBlocked;
    };
    const cancelingBatch = scanMemoryNagBatch("chat", canceledRange);
    await canceledEntered;
    assert.equal(endMemoryNagRangeScan("chat", canceledRange.scanId), true, "Stop releases the same in-flight session");
    const afterCancel = prompts.length;
    const automaticAfterCancel = scanMemoryNagIfDue("chat");
    releaseCanceled();
    await cancelingBatch;
    await automaticAfterCancel;
    completeScan = undefined;
    assert.equal(
      prompts.length,
      afterCancel + 1,
      "after Stop, automatic work waits for the in-flight checkpoint and never repeats that batch",
    );
    assert.match(prompts.at(-1)!, /MARKER_925_END/);
    await assert.rejects(
      scanMemoryNagBatch("chat", { ...canceledRange, afterMessageId: "m924" }),
      (error: any) => error.statusCode === 409,
    );

    const abandonedRange = { startMessageId: "m940", endMessageId: "m949", scanId: "" };
    abandonedRange.scanId = (await startMemoryNagRangeScan("chat", abandonedRange)).scanId;
    await scanMemoryNagBatch("chat", abandonedRange);
    const actualNow = Date.now;
    const abandonedAt = actualNow();
    Date.now = () => abandonedAt + 61_000;
    try {
      const beforeExpiry = prompts.length;
      await scanMemoryNagIfDue("chat");
      assert.equal(
        prompts.length,
        beforeExpiry + 1,
        "a vanished client's idle lease expires without a cleanup request",
      );
      assert.match(prompts.at(-1)!, /MARKER_945_END/);
      await assert.rejects(
        scanMemoryNagBatch("chat", { ...abandonedRange, afterMessageId: "m944" }),
        (error: any) => error.statusCode === 409,
      );
    } finally {
      Date.now = actualNow;
    }
    const failedRange = { startMessageId: "m960", endMessageId: "m969", scanId: "" };
    failedRange.scanId = (await startMemoryNagRangeScan("chat", failedRange)).scanId;
    completeScan = async () => {
      throw new Error("scan failed");
    };
    await assert.rejects(scanMemoryNagBatch("chat", failedRange), /scan failed/);
    completeScan = undefined;
    assert.equal(endMemoryNagRangeScan("chat", failedRange.scanId), false, "model failures release the guard");
    const replacement = await startMemoryNagRangeScan("chat", failedRange);
    assert.equal(
      endMemoryNagRangeScan("chat", failedRange.scanId),
      false,
      "old cleanup cannot clear a replacement session",
    );
    assert.equal(endMemoryNagRangeScan("chat", replacement.scanId), true);

    document.data.checkpointMessageId = null;
    document.data.checkpointMessageCount = 0;
    document.data.settings.messagesPerBatch = 20;
    const reportedRange = {
      startMessageId: "m900",
      endMessageId: "m1000",
      scanId: "",
      afterMessageId: undefined as string | undefined,
    };
    reportedRange.scanId = (await startMemoryNagRangeScan("chat", reportedRange)).scanId;
    const beforeReportedRange = prompts.length;
    for (;;) {
      const result = await scanMemoryNagBatch("chat", reportedRange);
      await scanMemoryNagIfDue("chat");
      if (result.done) break;
      reportedRange.afterMessageId = result.checkpointMessageId!;
    }
    const reportedPrompts = prompts.slice(beforeReportedRange);
    const covered = reportedPrompts.flatMap((prompt) =>
      [...prompt.matchAll(/MARKER_(\d+)_END/g)].map((match) => Number(match[1])),
    );
    assert.equal(
      reportedPrompts.length,
      6,
      "the reported 101-message range buys six batches, even with a reply between every request",
    );
    assert.equal(covered.length, 101);
    assert.equal(new Set(covered).size, 101);
    assert.equal(document.data.checkpointMessageId, "m1000");
  } finally {
    release();
  }
  console.log(
    "Memory Nag ranges passed: stable boundaries/checkpoints, automatic interleaving, session isolation, cancellation, expiry, and failure cleanup.",
  );
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
