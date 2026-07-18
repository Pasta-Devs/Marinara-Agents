import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function main() {
  const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
  const { activate } = await import(`${source}/server-entry.ts`);
  const { longTermMemoryRecallIndexPath } = await import(`${source}/rebuild.ts`);
  const { readLongTermMemoryUsage } = await import(`${source}/usage.ts`);
  const services = new Map<string, any>();
  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-runtime-"));
  const logger = { debug() {}, info() {}, warn() {}, error() {} };
  const cleanup = await activate({
    dataDir,
    api: {
      runtime: { logger },
      registerService(name: string, service: unknown) {
        services.set(name, service);
        return () => services.delete(name);
      },
      async registerPrivilegedRoutes() {
        return () => {};
      },
    },
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
    await storage.createNote(note("world_visible", "chat-a", "The cobalt archive key is beneath the observatory."));
    await storage.createNote(note("world_hidden", "chat-b", "The cobalt archive key is hidden in another chat."));

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

    const finalized = {
      chatId: "chat-a",
      chatMode: "visual_novel",
      messageId: "message-1",
      swipeIndex: 0,
      content: "The brass observatory door opens.",
      characterId: "character-1",
      regenerate: false,
      continuation: false,
    };
    const created = await runtime.onTurnFinalized(finalized);
    assert.equal(created.created, true, "a finalized assistant turn must create a source note");
    assert.deepEqual(created.note.modes, ["roleplay"], "visual novel capture must use the roleplay retrieval mode");
    assert.deepEqual(created.note.scope, {
      chatId: "chat-a",
      chatIds: ["chat-a"],
      characterIds: ["character-1"],
    });
    const duplicate = await runtime.onTurnFinalized(finalized);
    assert.equal(duplicate.changed, false, "duplicate finalized notifications must be no-ops");
    const continued = await runtime.onTurnFinalized({
      ...finalized,
      content: "The brass observatory door opens. A blue flame appears inside.",
      continuation: true,
    });
    assert.equal(continued.created, false, "continuations must update the existing swipe source");
    assert.equal(continued.note.version, 2);
    assert.match(continued.note.sections.source.text, /blue flame/);
    const regeneratedSwipe = await runtime.onTurnFinalized({
      ...finalized,
      swipeIndex: 1,
      content: "The brass observatory door remains sealed.",
      regenerate: true,
    });
    assert.equal(regeneratedSwipe.created, true, "a new regeneration swipe must create a distinct source");
    assert.notEqual(regeneratedSwipe.note.id, continued.note.id);
    assert.equal((await storage.listNotes()).filter((candidate: any) => candidate.type === "source").length, 2);
    const capturedRecall = await runtime.recall({
      ...input,
      messages: [{ role: "user", content: "What appeared as a blue flame?" }],
    });
    assert.match(capturedRecall.text, /blue flame/, "captured finalized turns must participate in recall");
    const longTurn = await runtime.onTurnFinalized({
      ...finalized,
      messageId: "message-long",
      content: `${"a".repeat(24_000)}${"b".repeat(100)}`,
    });
    assert.equal(longTurn.note.sections.source.text.length, 24_000);
    assert.equal(longTurn.note.sections.source_2.text.length, 100, "long turns must be captured without truncation");
  } finally {
    await cleanup();
    assert.equal(services.has("long-term-memory:runtime"), false, "cleanup must unregister runtime service");
    assert.equal(services.has("long-term-memory:storage"), false, "cleanup must unregister storage service");
    await rm(dataDir, { recursive: true, force: true });
  }

  process.stdout.write("Long-Term Memory runtime regression: recall, receipts, finalized capture, activation cleanup ok\n");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
