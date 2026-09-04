import assert from "node:assert/strict";

const session = new Map<string, string>();
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    sessionStorage: {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => session.set(key, value),
    },
  },
});

const contract = {
  source: "chats" as const,
  sourceIds: ["chat-a:summary-a"],
  action: "import" as const,
  sourceScope: { chatId: "chat-a", chatIds: ["chat-a"] },
  destinationScope: { chatId: "chat-a", chatIds: ["chat-a"] },
  mode: "roleplay" as const,
};

async function main() {
  const {
    cancelLtmSourceTask,
    getLtmSourceTaskSnapshot,
    markLtmSourceTaskViewed,
    startLtmSourceTask,
    subscribeLtmSourceTask,
  } =
    await import("../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/source-task.ts");
  let notifications = 0;
  const unsubscribe = subscribeLtmSourceTask(() => {
    notifications += 1;
  });
  const completed = await startLtmSourceTask({
    kind: "import",
    contract,
    sourceTitles: ["Observatory"],
    run: async () => ({
      batchStatus: "success",
      counts: { requested: 1, succeeded: 1 },
      imported: [
        {
          sourceId: "chat-a:summary-a",
          title: "Observatory",
          extractionStatus: "succeeded",
          retryable: false,
          note: { id: "source_summary" },
        },
      ],
    }),
  });
  assert.equal(completed.status, "completed");
  assert.deepEqual(completed.contract, contract);
  assert.deepEqual(completed.safeResult?.counts, { requested: 1, succeeded: 1 });
  assert.deepEqual(completed.safeResult?.items, [
    {
      sourceId: "chat-a:summary-a",
      title: "Observatory",
      status: "succeeded",
      retryable: false,
      noteId: "source_summary",
    },
  ]);
  assert.ok(notifications >= 2, "subscribers must see task start and completion");

  const writeFailure = {
    sourceId: "chat-a:summary-b",
    title: "Observatory follow-up",
    sourceWriteStatus: "failed",
    extractionStatus: "not_started",
    retryable: true,
    error: { code: "source_write_failed", message: "Vault write failed" },
  } as const;
  const partial = await startLtmSourceTask({
    kind: "import",
    contract,
    sourceTitles: [writeFailure.title],
    run: async () => ({
      batchStatus: "failed",
      imported: [],
      writeFailures: [writeFailure],
      missingSourceIds: [],
      counts: {
        requested: 1,
        sourceNotesWritten: 0,
        succeeded: 0,
        failed: 0,
        cancelled: 0,
        missing: 0,
        sourceWriteFailed: 1,
      },
    }),
  });
  assert.deepEqual(partial.safeResult?.writeFailures, [writeFailure]);
  assert.deepEqual(JSON.parse(session.values().next().value ?? "{}").safeResult.writeFailures, [writeFailure]);

  let release: (() => void) | undefined;
  const cancelled = startLtmSourceTask({
    kind: "refresh",
    contract: { ...contract, action: "refresh" },
    sourceTitles: ["Observatory"],
    run: (signal) =>
      new Promise((_resolve, reject) => {
        release = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        signal.addEventListener("abort", () => release?.(), { once: true });
      }),
  });
  assert.equal(getLtmSourceTaskSnapshot().active?.status, "running");
  assert.throws(
    () =>
      startLtmSourceTask({
        kind: "import",
        contract,
        sourceTitles: [],
        run: async () => null,
      }),
    /already running/u,
  );
  cancelLtmSourceTask();
  const cancelledTask = await cancelled;
  assert.equal(cancelledTask.status, "cancelled");
  assert.equal(cancelledTask.error?.code, "cancelled");
  assert.deepEqual(cancelledTask.contract.sourceIds, contract.sourceIds);
  assert.equal(getLtmSourceTaskSnapshot().latest?.id, cancelledTask.id);
  markLtmSourceTaskViewed(cancelledTask.id);
  assert.ok(getLtmSourceTaskSnapshot().latest?.viewedAt, "viewing a task must clear its unread navigation state");
  unsubscribe();
  process.stdout.write(
    "Long-Term Memory source task regression: single slot, cancellation, and safe result proof ok\n",
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
