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
    { previewPackageInterop, previewPackageLorebooks, sourcePackageDetails, importPackageInterop },
    { LongTermMemoryStorage },
    { ltmInteropPreviewRequestSchema, ltmLorebookPreviewResponseSchema, ltmSourceDetailsRequestSchema },
  ] = await Promise.all([
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/package-runtime.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/interop.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/storage.ts"),
    import("../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts"),
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
                entries: [
                  { id: "lore-entry", name: "Moon Vault", content: "The Moon Vault is sealed." },
                  { id: "lore-entry-two", name: "Sun Vault", content: "The Sun Vault is open." },
                ],
              },
              {
                id: "lorebook-large",
                data: { name: "Large Lorebook", category: "World" },
                entries: Array.from({ length: 101 }, (_, index) => ({
                  id: `large-lore-entry-${index}`,
                  name: `Large Entry ${index}`,
                  content: `Shared pagination large lore content ${index}.`,
                })),
              },
              {
                id: "lorebook-later",
                data: { name: "Later Lorebook", category: "World" },
                entries: [{ id: "later-entry", name: "Later Entry", content: "Shared pagination later lore content." }],
              },
              ...Array.from({ length: 101 }, (_, index) => ({
                id: `lorebook-many-${index}`,
                data: { name: `Many Lorebook ${index}`, category: "World" },
                entries: [{ id: "many-entry", name: "Many Entry", content: `Many books lore content ${index}.` }],
              })),
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
      assert.equal(
        ltmInteropPreviewRequestSchema.parse({ source: "chats", query: "  nikujaga  " }).query,
        "nikujaga",
        "preview search must trim bounded input",
      );
      assert.equal(
        ltmInteropPreviewRequestSchema.parse({ source: "chats", query: "   " }).query,
        undefined,
        "blank preview search must behave as omitted",
      );
      assert.throws(
        () => ltmInteropPreviewRequestSchema.parse({ source: "chats", query: "x".repeat(201) }),
        /String must contain at most 200 character/u,
      );
      assert.deepEqual(
        ltmSourceDetailsRequestSchema.parse({
          source: "chats",
          sourceIds: ["chat-conversation:day:27.07.2026"],
          sourceScope: { chatId: conversationChat.id },
          mode: "conversation",
        }),
        {
          source: "chats",
          sourceIds: ["chat-conversation:day:27.07.2026"],
          sourceScope: { chatId: conversationChat.id },
          mode: "conversation",
        },
      );
      const candidates = await previewPackageInterop(request, join(dataDir, "long-term-memory"));
      assert.equal(candidates.scanned, 3, "each day and week entry yields one candidate");
      assert.equal(candidates.draftable, 3);
      assert.deepEqual(candidates.totals, { matches: 3, ready: 3, imported: 0 });
      assert.equal(candidates.truncated, false);
      assert.deepEqual(
        candidates.samples.map((candidate) => candidate.sourceId),
        ["chat-conversation:day:27.07.2026", "chat-conversation:week:27.07.2026", "chat-conversation:day:02.08.2026"],
        "day and week DD.MM.YYYY keys must share one chronological order",
      );
      assert.ok(candidates.samples.every((candidate) => candidate.importMode === "conversation"));
      const limitedCandidates = await previewPackageInterop(
        { ...request, limit: 2 },
        join(dataDir, "long-term-memory"),
      );
      assert.deepEqual(limitedCandidates.totals, { matches: 3, ready: 3, imported: 0 });
      assert.equal(limitedCandidates.truncated, true);
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
      const searchedCandidates = await previewPackageInterop(
        { ...request, query: "mild" },
        join(dataDir, "long-term-memory"),
      );
      assert.deepEqual(
        searchedCandidates.samples.map((candidate) => candidate.sourceId),
        ["chat-conversation:day:27.07.2026"],
      );
      assert.deepEqual(searchedCandidates.totals, { matches: 1, ready: 1, imported: 0 });
      const sourceDetails = await sourcePackageDetails(
        {
          source: "chats",
          sourceIds: ["chat-conversation:day:27.07.2026", "missing-summary"],
          sourceScope: { chatId: conversationChat.id },
          mode: "conversation",
        },
        join(dataDir, "long-term-memory"),
      );
      assert.equal(sourceDetails.details[0]?.content, "Discussed nikujaga.\n\nmild\n\nno chili");
      assert.deepEqual(sourceDetails.missingSourceIds, ["missing-summary"]);

      const importedCharacter = await importPackageInterop(
        {
          source: "characters",
          sourceIds: ["character-import"],
          destinationScope: { characterIds: ["character-import"] },
          extract: false,
          limit: 100,
        },
        join(dataDir, "long-term-memory"),
        new AbortController().signal,
      );
      assert.equal(importedCharacter.imported[0]?.note.modes[0], "roleplay");
      const characterPreview = await previewPackageInterop(
        { source: "characters", limit: 100 },
        join(dataDir, "long-term-memory"),
      );
      assert.equal(characterPreview.samples[0]?.importMode, "roleplay");
      const explicitCharacter = await importPackageInterop(
        {
          source: "characters",
          sourceIds: ["character-import"],
          destinationScope: { characterIds: ["character-import"] },
          mode: "game",
          extract: false,
          limit: 100,
        },
        join(dataDir, "long-term-memory"),
        new AbortController().signal,
      );
      assert.equal(explicitCharacter.imported[0]?.note.modes[0], "game");

      const lorebookPreview = await previewPackageLorebooks(
        { query: "Imported", limit: 100 },
        join(dataDir, "long-term-memory"),
      );
      const limitedLorebookPreview = await previewPackageLorebooks(
        { query: "Imported", limit: 1 },
        join(dataDir, "long-term-memory"),
      );
      assert.equal(lorebookPreview.books[0]?.entries[0]?.candidates[0]?.importMode, "roleplay");
      const lorebookGamePreview = await previewPackageLorebooks(
        { query: "Imported", limit: 100, mode: "game" },
        join(dataDir, "long-term-memory"),
      );
      assert.equal(lorebookGamePreview.books[0]?.entries[0]?.candidates[0]?.importMode, "game");
      const lorebookSourceId = lorebookPreview.books[0]?.entries[0]?.candidates[0]?.sourceId;
      assert.ok(lorebookSourceId, "lorebook preview must expose an importable candidate");
      assert.equal(lorebookPreview.books[0]?.counts.candidates, 2);
      assert.equal(lorebookGamePreview.books[0]?.counts.candidates, 2);
      assert.equal(lorebookPreview.totals.books, 1);
      assert.equal(lorebookPreview.totals.candidates, 2);
      assert.equal(lorebookPreview.truncated, false);
      assert.equal(limitedLorebookPreview.counts.candidates, 1);
      assert.equal(limitedLorebookPreview.totals.candidates, 2);
      assert.equal(limitedLorebookPreview.truncated, true);
      const largeLorebookPreview = ltmLorebookPreviewResponseSchema.parse(
        await previewPackageLorebooks({ query: "Large", limit: 100 }, join(dataDir, "long-term-memory")),
      );
      assert.equal(largeLorebookPreview.books[0]?.counts.entries, 100);
      assert.equal(largeLorebookPreview.books[0]?.counts.candidates, 100);
      assert.equal(largeLorebookPreview.books[0]?.counts.pending, 100);
      assert.equal(largeLorebookPreview.totals.entries, 101);
      assert.equal(largeLorebookPreview.totals.candidates, 101);
      assert.equal(largeLorebookPreview.truncated, true);
      const sharedPaginationPreview = ltmLorebookPreviewResponseSchema.parse(
        await previewPackageLorebooks({ query: "pagination", limit: 100 }, join(dataDir, "long-term-memory")),
      );
      assert.equal(sharedPaginationPreview.books.length, 2);
      assert.equal(sharedPaginationPreview.books[1]?.counts.candidates, 1);
      assert.equal(sharedPaginationPreview.books[1]?.totals.candidates, 1);
      assert.equal(sharedPaginationPreview.totals.candidates, 102);
      assert.equal(sharedPaginationPreview.truncated, true);
      const manyBooksPreview = ltmLorebookPreviewResponseSchema.parse(
        await previewPackageLorebooks({ query: "Many books", limit: 100 }, join(dataDir, "long-term-memory")),
      );
      assert.equal(manyBooksPreview.books.length, 100);
      assert.equal(manyBooksPreview.counts.candidates, 100);
      assert.equal(manyBooksPreview.totals.books, 101);
      assert.equal(manyBooksPreview.totals.candidates, 101);
      assert.equal(manyBooksPreview.truncated, true);
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

      for (const [chat, expectedMode] of [
        [roleplayChat, "roleplay"],
        [gameChat, "game"],
      ] as const) {
        const nativePreview = await previewPackageInterop(
          { source: "chats", chatId: chat.id, limit: 100 },
          join(dataDir, "long-term-memory"),
        );
        assert.ok(nativePreview.samples.length > 0);
        assert.ok(nativePreview.samples.every((candidate) => candidate.importMode === expectedMode));
        const nativeImport = await importPackageInterop(
          {
            source: "chats",
            chatId: chat.id,
            sourceIds: nativePreview.samples.map((candidate) => candidate.sourceId),
            extract: false,
            limit: 100,
          },
          join(dataDir, "long-term-memory"),
          new AbortController().signal,
        );
        assert.ok(nativeImport.imported.every((item) => item.note.modes[0] === expectedMode));
      }

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
      assert.equal(notes.length, 7);
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
      assert.equal((await storage.listNotes({ type: "source" })).length, 7);
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
