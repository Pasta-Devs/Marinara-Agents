import assert from "node:assert/strict";
import { configureMemoryNagRuntime } from "../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/package-runtime.ts";
import {
  memoryNagScanWindow,
  scanMemoryNagBatch,
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
    const range = { startMessageId: "m900", endMessageId: "m909", afterMessageId: undefined as string | undefined };
    const first = await scanMemoryNagBatch("chat", range);
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
    await scanMemoryNagBatch("chat", { startMessageId: "m899", endMessageId: "m899" });
    assert.match(prompts.at(-1)!, /MARKER_899_END/);
    assert.equal(
      document.data.checkpointMessageId,
      "m909",
      "explicitly rescanning an older range never rewinds automatic progress",
    );
    await scanMemoryNagBatch("chat");
    assert.match(prompts.at(-1)!, /MARKER_910_END/);
    assert.doesNotMatch(prompts.at(-1)!, /MARKER_909_END/);
    assert.equal(document.data.checkpointMessageId, "m914", "legacy All scanning resumes at the furthest checkpoint");
    const before = prompts.length;
    await assert.rejects(scanMemoryNagBatch("chat", { startMessageId: "m1", endMessageId: "m10" }));
    assert.equal(prompts.length, before, "deleted boundaries fail rather than silently choosing another range");
  } finally {
    release();
  }
  console.log("Memory-nag range extraction, stable boundaries, validation, and checkpoint continuity passed.");
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
