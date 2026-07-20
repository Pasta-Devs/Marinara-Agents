import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function main() {
  const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
  const { activate } = await import(`${source}/server-entry.ts`);
  const { longTermMemoryRecallIndexPath, rebuildLongTermMemoryIndexes } = await import(`${source}/rebuild.ts`);
  const { retrieveLongTermMemory } = await import(`${source}/retrieval.ts`);
  const { readLongTermMemoryUsage } = await import(`${source}/usage.ts`);
  const { readLtmDebugLog } = await import(`${source}/debug-log.ts`);
  const services = new Map<string, any>();
  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-runtime-"));
  const logger = { debug() {}, info() {}, warn() {}, error() {} };
  const chats = [{
    id: "chat-a",
    name: "Legacy chat",
    mode: "roleplay",
    characterIds: [],
    groupId: null,
    personaId: null,
    connectionId: null,
    metadata: { enableLongTermMemory: true, longTermMemoryBudgetTokens: 2048 },
    lastMessageAt: null,
    updatedAt: "2026-07-16T00:00:00.000Z",
  }];
  let metadataUpdates = 0;
  let agentConfigReads = 0;
  let legacyAgentConfig: { connectionId: string | null; settings: Record<string, unknown> } | null = {
    connectionId: "legacy-connection",
    settings: {
      model: "legacy-model",
      instruction: "Preserve this instruction",
      importConcurrency: 4,
      autoApplyLowRisk: true,
    },
  };
  const api = {
    runtime: {
      logger,
      async getAgentConfig() {
        agentConfigReads += 1;
        return legacyAgentConfig;
      },
      persistence: {
        async getChat(chatId: string) { return chats.find((chat) => chat.id === chatId) ?? null; },
        async listChats() { return chats; },
        async updateChatMetadata(input: { chatId: string; metadata: Record<string, unknown> }) {
          metadataUpdates += 1;
          const chat = chats.find((candidate) => candidate.id === input.chatId);
          if (chat) chat.metadata = input.metadata as typeof chat.metadata;
        },
      },
    },
    registerService(name: string, service: unknown) {
      services.set(name, service);
      return () => services.delete(name);
    },
    async registerPrivilegedRoutes() {
      return () => {};
    },
  };
  let cleanup: Awaited<ReturnType<typeof activate>> | null = await activate({
    dataDir,
    api,
  });
  const storage = services.get("long-term-memory:storage").storage;
  const runtime = services.get("long-term-memory:runtime");
  const timestamp = "2026-07-17T00:00:00.000Z";
  const note = (id: string, chatId: string, text: string) => ({
    id,
    title: id,
    type: "world",
    status: "active",
    modes: ["roleplay"],
    scope: { chatId, chatIds: [chatId] },
    tags: [],
    keywords: ["cobalt archive"],
    links: [],
    sections: { facts: { text, updatedAt: timestamp } },
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  });

  try {
    assert.ok(runtime, "package activation must register the runtime service");
    assert.deepEqual(chats[0].metadata, {
      enableLongTermMemory: true,
      longTermMemoryBudgetTokens: 2048,
      activeAgentIds: ["long-term-memory"],
      enableAgents: true,
      longTermMemoryPackageAdopted: true,
    }, "legacy chat settings must be preserved while activating the package agent");
    assert.deepEqual(
      JSON.parse(await readFile(join(dataDir, "long-term-memory", "config", "agent-settings.json"), "utf8")),
      {
        connectionId: "legacy-connection",
        model: "legacy-model",
        instruction: "Preserve this instruction",
        importConcurrency: 4,
        autoApplyLowRisk: true,
      },
      "legacy agent preferences must move into the stable package root",
    );
    await storage.createNote(note("world_visible", "chat-a", "The cobalt archive key is beneath the observatory."));
    await storage.createNote(note("world_visible_second", "chat-a", "The cobalt archive has a brass warding seal."));
    await storage.createNote(note("world_hidden", "chat-b", "The cobalt archive key is hidden in another chat."));
    await rebuildLongTermMemoryIndexes({ root: storage.root });
    const explained = await retrieveLongTermMemory({
      root: storage.root,
      queryText: "cobalt archive",
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      mode: "roleplay",
      maxChunks: 1,
      maxTokens: 4096,
      explain: true,
      rejectedLimit: 1,
    });
    assert.equal(explained.chunks.length, 1);
    assert.equal(explained.rejected.length, 1);
    assert.equal(explained.rejected[0].rejectionReason, "lower_rank");
    assert.equal(explained.chunks[0].lanes.length > 0, true);
    const thresholded = await retrieveLongTermMemory({
      root: storage.root,
      queryText: "world_visible cobalt archive",
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      mode: "roleplay",
      minScore: 0.75,
      maxChunks: 10,
      maxTokens: 4096,
    });
    assert.deepEqual(
      thresholded.chunks.map((chunk: any) => chunk.chunk.noteId),
      ["world_visible"],
      "minimum score must apply to fused relevance, not a candidate's strongest lane",
    );

    const input = {
      chatId: "chat-a",
      chatMode: "roleplay",
      characterIds: [],
      messages: [{ role: "user", content: "Where is the cobalt archive key?" }],
      debugMode: false,
    };
    const first = await runtime.recall(input);
    assert.match(first.text, /beneath the observatory/);
    assert.doesNotMatch(first.text, /another chat/, "recall must enforce chat scope");
    assert.ok(first.receipt, "non-empty recall must return an opaque receipt");
    await runtime.recall({ ...input, debugMode: true });
    const recallExplanation = (await readLtmDebugLog(
      { phase: "retrieval" },
      storage.root,
    )).at(-1);
    assert.equal(recallExplanation?.action, "recall_explanation");
    assert.equal(
      recallExplanation?.details?.selected?.[0]?.noteId,
      "world_visible",
    );
    assert.equal(JSON.stringify(recallExplanation).includes(input.messages[0].content), false);
    assert.equal(JSON.stringify(recallExplanation).includes("beneath the observatory"), false);

    chats[0].metadata = {
      ...chats[0].metadata,
      longTermMemoryMaxChunks: 1,
    };
    const limited = await runtime.recall(input);
    assert.equal(limited.receipt.artifact.chunks.length, 1, "chat max chunks must constrain recall");
    chats[0].metadata = {
      ...chats[0].metadata,
      enableLongTermMemory: false,
    };
    assert.equal(await runtime.recall(input), null, "a chat-level disable must override global enablement");
    chats[0].metadata = {
      ...chats[0].metadata,
      enableLongTermMemory: true,
    };

    assert.equal(await runtime.recordPromptAccepted({ chatId: "chat-a", receipt: first.receipt, messages: [{ content: first.text }] }), true);
    assert.equal(await runtime.recordPromptAccepted({ chatId: "chat-a", receipt: first.receipt, messages: [{ content: first.text }] }), false, "the same receipt must account once");

    const regenerated = await runtime.recall(input);
    assert.equal(await runtime.recordPromptAccepted({ chatId: "chat-a", receipt: null, messages: [{ content: regenerated.text }] }), true, "null regeneration receipt must fall back to prompt presence");
    assert.equal(await runtime.recordPromptAccepted({ chatId: "chat-a", receipt: null, messages: [{ content: regenerated.text }] }), false);
    const usage = await readLongTermMemoryUsage(storage.root);
    assert.equal(usage.chats["chat-a"].chunks["world_visible::facts"].injectionCount, 2);

    assert.equal(await runtime.recall({ ...input, messages: [] }), null, "empty prompts must not recall");
    assert.equal(await runtime.recall({ ...input, messages: [{ role: "user", content: "unrelated zephyr" }] }), null, "empty retrieval must return null");

    await writeFile(longTermMemoryRecallIndexPath(storage.root), "{malformed\n");
    const recovered = await runtime.recall(input);
    assert.match(recovered.text, /beneath the observatory/, "malformed indexes must rebuild from canonical notes");
    assert.equal(JSON.parse(await readFile(longTermMemoryRecallIndexPath(storage.root), "utf8")).version, 1);

    await storage.createNote({
      id: "source_chat_summary_runtime",
      title: "Hidden source",
      type: "source",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      tags: ["source_summary", "imported_chat"],
      keywords: [],
      links: [],
      provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "runtime" },
      sections: { source: { text: "A blue flame appears inside.", updatedAt: "2026-07-17T00:00:00.000Z" } },
    });
    await rebuildLongTermMemoryIndexes({ root: storage.root });
    assert.equal(await runtime.recall({ ...input, messages: [{ role: "user", content: "What appeared as a blue flame?" }] }), null, "source notes must not participate in recall");

    const vaultBeforeUninstall = await readFile(join(dataDir, "long-term-memory", "vault", "world", "world_visible.json"));
    const preferencesBeforeUninstall = await readFile(join(dataDir, "long-term-memory", "config", "agent-settings.json"));
    await cleanup();
    cleanup = null;
    chats[0].metadata.activeAgentIds = [];
    legacyAgentConfig = null;
    cleanup = await activate({ dataDir, api });
    assert.deepEqual(chats[0].metadata.activeAgentIds, [], "reinstall must not reverse explicit uninstall cleanup");
    assert.equal(metadataUpdates, 1, "legacy adoption must be idempotent across restarts");
    assert.equal(agentConfigReads, 1, "persisted preferences must not depend on the deleted Engine config after reinstall");
    assert.deepEqual(
      await readFile(join(dataDir, "long-term-memory", "vault", "world", "world_visible.json")),
      vaultBeforeUninstall,
      "uninstall and reinstall must preserve exact vault bytes",
    );
    assert.deepEqual(
      await readFile(join(dataDir, "long-term-memory", "config", "agent-settings.json")),
      preferencesBeforeUninstall,
      "uninstall and reinstall must preserve exact agent preference bytes",
    );
  } finally {
    await cleanup?.();
    assert.equal(services.has("long-term-memory:runtime"), false, "cleanup must unregister runtime service");
    assert.equal(services.has("long-term-memory:storage"), false, "cleanup must unregister storage service");
    await rm(dataDir, { recursive: true, force: true });
  }

  process.stdout.write("Long-Term Memory runtime regression: recall, receipts, source exclusion, activation cleanup ok\n");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
