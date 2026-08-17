import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWithSafeCleanup } from "./regression-helpers.ts";

const conversationChat = {
  id: "chat-conversation",
  name: "Kirei",
  mode: "conversation",
  characterIds: [],
  groupId: null,
  personaId: null,
  connectionId: null,
  metadata: {
    daySummaries: {
      "27.07.2026": {
        summary: "Discussed nikujaga.",
        keyDetails: ["mild", "no chili"],
      },
      "02.08.2026": "Bare string form is legal and must coerce.",
    },
    weekSummaries: {
      "27.07.2026": {
        summary: "Week of cooking talk.",
        keyDetails: [],
      },
    },
  },
  lastMessageAt: null,
  updatedAt: "2026-08-02T00:00:00.000Z",
};
const roleplayChat = {
  ...conversationChat,
  id: "chat-roleplay",
  mode: "roleplay",
  metadata: {
    summaryEntries: [{ id: "roleplay-summary", content: "A roleplay summary." }],
  },
};
const gameChat = {
  ...conversationChat,
  id: "chat-game",
  mode: "game",
  metadata: {
    gamePreviousSessionSummaries: [{ sessionNumber: 1, summary: "The party reached the Moon Vault." }],
  },
};

async function main() {
  const [
    { configurePackageRuntime },
    { previewPackageInterop, previewPackageLorebooks, importPackageInterop },
    { LongTermMemoryStorage },
  ] = await Promise.all([
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/package-runtime.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/interop.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/storage.ts"),
  ]);
  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-conversation-summary-"));
  const agents = JSON.parse(
    await readFile(new URL("../packages/long-term-memory/agents.json", import.meta.url), "utf8"),
  ) as Array<{ modeAllowlist?: string[] }>;
  let releaseRuntime: (() => void) | undefined;
  await runWithSafeCleanup(
    "Long-Term Memory Conversation summary import",
    async () => {
      const chats = [conversationChat, roleplayChat, gameChat];
      releaseRuntime = configurePackageRuntime({
        dataDir,
        logger: { debug() {}, info() {}, warn() {}, error() {} },
        languageModels: {
          async resolveForRequest() {
            return {
              name: "FixtureModel",
              connectionId: "fixture-connection",
              model: "fixture-model",
              maxContext: 32_000,
              maxOutputTokens: 4_000,
              fitContext(messages: any[], options: { maxTokens?: number }) {
                return {
                  messages,
                  maxTokens: options.maxTokens,
                  estimatedTokensBefore: 20,
                  estimatedTokensAfter: 20,
                  trimmed: false,
                };
              },
              async chatComplete() {
                return { content: JSON.stringify({ summary: "", units: [] }), finishReason: "stop" };
              },
            };
          },
        },
        persistence: {
          async getChat(chatId: string) {
            return chats.find((chat) => chat.id === chatId) ?? null;
          },
          async listChats() {
            return chats;
          },
        },
        resources: {
          async listCharacters() {
            return [
              {
                id: "character-import",
                data: { name: "Imported Character", description: "A character source for mode policy proof." },
                comment: "",
              },
            ];
          },
          async listPersonas() {
            return [];
          },
          async listLorebooks() {
            return [
              {
                id: "lorebook-import",
                data: { name: "Imported Lorebook", category: "World" },
                entries: [{ id: "lore-entry", name: "Moon Vault", content: "The Moon Vault is sealed." }],
              },
            ];
          },
        },
      });
      const request = {
        source: "chats" as const,
        chatId: conversationChat.id,
        mode: "conversation" as const,
        limit: 100,
      };
      const candidates = await previewPackageInterop(request, join(dataDir, "long-term-memory"));
      assert.equal(candidates.scanned, 3, "each day and week entry yields one candidate");
      assert.equal(candidates.draftable, 3);
      assert.deepEqual(
        candidates.samples.map((candidate) => candidate.sourceId),
        ["chat-conversation:day:27.07.2026", "chat-conversation:week:27.07.2026", "chat-conversation:day:02.08.2026"],
        "day and week DD.MM.YYYY keys must share one chronological order",
      );
      const limitedCandidates = await previewPackageInterop(
        { ...request, limit: 2 },
        join(dataDir, "long-term-memory"),
      );
      assert.deepEqual(
        limitedCandidates.samples.map((candidate) => candidate.sourceId),
        ["chat-conversation:day:27.07.2026", "chat-conversation:week:27.07.2026"],
        "preview limits must preserve the globally earliest summaries",
      );
      assert.ok(
        candidates.samples.some(
          (candidate) => candidate.snippet.includes("mild") && candidate.snippet.includes("no chili"),
        ),
        "keyDetails must be flattened into sourceText",
      );
      assert.ok(
        candidates.samples.some((candidate) => candidate.snippet.includes("Bare string form")),
        "legacy bare-string day entries must coerce, not vanish",
      );

      const importedCharacter = await importPackageInterop(
        { source: "characters", sourceIds: ["character-import"], extract: false, limit: 100 },
        join(dataDir, "long-term-memory"),
        new AbortController().signal,
      );
      assert.equal(importedCharacter.imported[0]?.note.modes[0], "roleplay");
      const explicitCharacter = await importPackageInterop(
        { source: "characters", sourceIds: ["character-import"], mode: "game", extract: false, limit: 100 },
        join(dataDir, "long-term-memory"),
        new AbortController().signal,
      );
      assert.equal(explicitCharacter.imported[0]?.note.modes[0], "game");

      const lorebookPreview = await previewPackageLorebooks({ limit: 100 }, join(dataDir, "long-term-memory"));
      const lorebookGamePreview = await previewPackageLorebooks(
        { limit: 100, mode: "game" },
        join(dataDir, "long-term-memory"),
      );
      const lorebookSourceId = lorebookPreview.books[0]?.entries[0]?.candidates[0]?.sourceId;
      assert.ok(lorebookSourceId, "lorebook preview must expose an importable candidate");
      assert.equal(lorebookPreview.books[0]?.counts.candidates, 1);
      assert.equal(lorebookGamePreview.books[0]?.counts.candidates, 1);
      const importedLorebook = await importPackageInterop(
        { source: "lorebooks", sourceIds: [lorebookSourceId], extract: true, limit: 100 },
        join(dataDir, "long-term-memory"),
        new AbortController().signal,
      );
      assert.equal(importedLorebook.imported[0]?.note.modes[0], "roleplay");
      assert.equal(importedLorebook.imported[0]?.extractionStatus, "succeeded");
      const explicitLorebook = await importPackageInterop(
        { source: "lorebooks", sourceIds: [lorebookSourceId], mode: "game", extract: true, limit: 100 },
        join(dataDir, "long-term-memory"),
        new AbortController().signal,
      );
      assert.equal(explicitLorebook.imported[0]?.note.modes[0], "game");
      assert.equal(explicitLorebook.imported[0]?.extractionStatus, "succeeded");

      const fixtureByMode: Record<string, typeof conversationChat> = {
        roleplay: roleplayChat,
        conversation: conversationChat,
        game: gameChat,
      };
      const declaredModes = agents[0]?.modeAllowlist ?? [];
      assert.ok(declaredModes.length > 0, "agents.json must declare a non-empty modeAllowlist for mode coverage");
      for (const mode of declaredModes) {
        const chat = fixtureByMode[mode];
        assert.ok(chat, `missing fixture for declared mode ${mode}`);
        const modeCandidates = await previewPackageInterop(
          { source: "chats", chatId: chat.id, mode: mode as "conversation" | "roleplay" | "game", limit: 100 },
          join(dataDir, "long-term-memory"),
        );
        assert.ok(modeCandidates.scanned > 0, `mode ${mode} declared in modeAllowlist yields no import candidates`);
      }

      const sourceIds = candidates.samples.map((candidate) => candidate.sourceId);
      const imported = await importPackageInterop(
        { ...request, sourceIds, extract: false },
        join(dataDir, "long-term-memory"),
        new AbortController().signal,
      );
      assert.equal(imported.counts.sourceNotesWritten, 3);
      assert.ok(imported.imported.every((item) => item.created));
      const storage = new LongTermMemoryStorage(join(dataDir, "long-term-memory"));
      const notes = await storage.listNotes({ type: "source" });
      assert.equal(notes.length, 5);
      const dayNote = notes.find((note) => note.provenance?.entryId === "day:27.07.2026");
      assert.equal(dayNote?.modes[0], "conversation");
      assert.match(dayNote?.sections.source.text ?? "", /Discussed nikujaga\.\n\nmild\n\nno chili/u);

      const importedAgain = await importPackageInterop(
        { ...request, sourceIds, extract: false },
        join(dataDir, "long-term-memory"),
        new AbortController().signal,
      );
      assert.equal(importedAgain.imported.length, 3);
      assert.equal(importedAgain.counts.sourceNotesWritten, 3);
      assert.ok(importedAgain.imported.every((item) => !item.created));
      assert.equal((await storage.listNotes({ type: "source" })).length, 5);
    },
    [() => releaseRuntime?.(), () => rm(dataDir, { recursive: true, force: true })],
  );
  process.stdout.write(
    "Long-Term Memory Conversation summary import regression: coercion, ordering, mode coverage, and idempotency ok\n",
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
