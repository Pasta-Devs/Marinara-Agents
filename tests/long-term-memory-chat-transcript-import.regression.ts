import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRegressionToCompletion, runWithSafeCleanup } from "./regression-helpers.ts";

type FixtureMessage = {
  id: string;
  chatId: string;
  role: string;
  characterId: string | null;
  content: string;
  activeSwipeIndex: number;
  extra: unknown;
  createdAt: string;
  agentContent?: string;
};

function message(chatId: string, id: string, role: string, content: string, extra: unknown = {}): FixtureMessage {
  return {
    id,
    chatId,
    role,
    characterId: role === "assistant" ? "character-kirei" : null,
    content,
    activeSwipeIndex: 0,
    extra,
    createdAt: "2026-10-27T00:00:00.000Z",
  };
}

const roleplayChat = {
  id: "chat-roleplay",
  name: "Moon Vault",
  mode: "roleplay",
  characterIds: ["character-kirei"],
  groupId: null as string | null,
  personaId: null,
  connectionId: null,
  metadata: {},
  lastMessageAt: null,
  updatedAt: "2026-10-27T00:00:00.000Z",
};
const conversationChat = { ...roleplayChat, id: "chat-conversation", name: "Kitchen", mode: "conversation" };
const mariChat = { ...roleplayChat, id: "chat-mari", name: "Lesson", characterIds: ["__professor_mari__"] };
const branchChat = { ...roleplayChat, id: "chat-branch", name: "Branch", groupId: "group-branches" };
const branchSiblingChat = { ...branchChat, id: "chat-branch-sibling", name: "Branch sibling" };
const divergedChatA = { ...roleplayChat, id: "chat-diverged-a", name: "Draft A", groupId: "group-diverged" };
const divergedChatB = { ...divergedChatA, id: "chat-diverged-b", name: "Draft B" };

async function main() {
  const [
    { configurePackageRuntime },
    { previewPackageInterop, sourcePackageDetails, importPackageInterop, transcriptPieces },
    { ltmImportSourceNotesResponseSchema, ltmInteropPreviewRequestSchema, ltmInteropPreviewResponseSchema },
  ] = await Promise.all([
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/package-runtime.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/sources/interop.ts"),
    import("../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts"),
  ]);

  const speaker = (row: FixtureMessage) => row.role;
  const pieces = transcriptPieces(
    [
      message("c", "m1", "user", "Hello."),
      message("c", "m2", "assistant", "Hidden reply.", { hiddenFromAI: true }),
      { ...message("c", "m3", "assistant", "Shown text."), agentContent: "[Private whisper to Kirei: a secret]" },
      message("c", "m4", "user", "x".repeat(23_990)),
      message("c", "m5", "user", "y".repeat(50_000)),
      message("c", "m6", "user", "   "),
      message("c", "m7", "narrator", "After."),
      message("c", "m8", "assistant", "Only some see this.", { hiddenFromAICharacterIds: ["character-kirei"] }),
      message("c", "m9", "user", "/roll", { commandOnly: true }),
    ],
    speaker,
  );
  assert.deepEqual(
    pieces.map(({ entryId, first, last }) => ({ entryId, first, last })),
    [
      { entryId: "m1", first: 1, last: 3 },
      { entryId: "m4", first: 4, last: 4 },
      { entryId: "m5", first: 5, last: 5 },
      { entryId: "m5:part:2", first: 5, last: 5 },
      { entryId: "m5:part:3", first: 5, last: 5 },
      { entryId: "m7", first: 7, last: 7 },
    ],
    "pieces start at their first message, number every message and split an oversized one",
  );
  assert.equal(
    pieces[0]?.content,
    "user: Hello.\n\nassistant: Shown text.",
    "the public content wins over agentContent's whispers and hidden messages are skipped",
  );
  assert.ok(
    pieces.every((piece) => piece.content.length <= 24_000),
    "no piece exceeds the 24,000 character cap",
  );
  assert.equal(
    pieces
      .slice(2, 5)
      .map((piece) => piece.content)
      .join(""),
    `user: ${"y".repeat(50_000)}`,
  );
  const short = ["s1", "s2", "s3"].map((id) => message("c", id, "user", id));
  assert.deepEqual(
    transcriptPieces(short, speaker, (id) => id === "s3").map(({ entryId, first, last }) => ({ entryId, first, last })),
    [
      { entryId: "s1", first: 1, last: 2 },
      { entryId: "s3", first: 3, last: 3 },
    ],
    "an imported piece's first message starts its piece again",
  );
  short[1] = message("c", "s2", "user", "s2", { hiddenFromAI: true });
  assert.deepEqual(
    transcriptPieces(short, speaker, (id) => id === "s2").map(({ entryId, first, last }) => ({ entryId, first, last })),
    [
      { entryId: "s1", first: 1, last: 1 },
      { entryId: "s2", first: 3, last: 3 },
    ],
    "a hidden first message still names the piece its next visible message starts",
  );

  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-chat-transcript-"));
  const root = join(dataDir, "long-term-memory");
  const chats = [roleplayChat, conversationChat, mariChat, branchChat, branchSiblingChat, divergedChatA, divergedChatB];
  // A first message this long closes its piece, so each ending below is a piece of its own.
  const sharedOpening = "x".repeat(23_990);
  const messages = new Map<string, FixtureMessage[]>([
    [
      roleplayChat.id,
      [
        message(roleplayChat.id, "r1", "user", "I open the Moon Vault.", { personaSnapshot: { name: "Aster" } }),
        message(roleplayChat.id, "r2", "assistant", "The Moon Vault hums."),
        message(roleplayChat.id, "r3", "narrator", "Dust settles."),
        message(roleplayChat.id, "r4", "system", "Scene note."),
      ],
    ],
    [conversationChat.id, [message(conversationChat.id, "k1", "user", "I like nikujaga.")]],
    [mariChat.id, [message(mariChat.id, "p1", "user", "Teach me.")]],
    [branchChat.id, [message(branchChat.id, "b1", "user", "The shared beginning.")]],
    [branchSiblingChat.id, [message(branchSiblingChat.id, "b1-copy", "user", "The shared beginning.")]],
    [
      divergedChatA.id,
      [
        message(divergedChatA.id, "d1", "user", sharedOpening),
        message(divergedChatA.id, "d2", "assistant", "Ending A."),
      ],
    ],
    [
      divergedChatB.id,
      [
        message(divergedChatB.id, "d1-copy", "user", sharedOpening),
        message(divergedChatB.id, "d2-b", "assistant", "Ending B."),
      ],
    ],
  ]);
  let releaseRuntime: (() => void) | undefined;
  let messageReads = 0;
  await runWithSafeCleanup(
    "Long-Term Memory chat transcript import",
    async () => {
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
              fitContext(fitMessages: any[], options: { maxTokens?: number }) {
                return {
                  messages: fitMessages,
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
          async listMessages(chatId: string) {
            messageReads += 1;
            return messages.get(chatId) ?? [];
          },
        },
        resources: {
          async listCharacters() {
            return [{ id: "character-kirei", data: { name: "Kirei" }, comment: "" }];
          },
          async listPersonas() {
            return [];
          },
          async listLorebooks() {
            return [];
          },
        },
      });

      const preview = ltmInteropPreviewResponseSchema.parse(
        await previewPackageInterop({ source: "messages", chatId: roleplayChat.id, limit: 100 }, root),
      );
      assert.deepEqual(
        preview.samples.map(({ sourceId, title, importMode, status }) => ({ sourceId, title, importMode, status })),
        [
          {
            sourceId: "chat-roleplay:messages:r1",
            title: "Moon Vault, messages 1-4",
            importMode: "roleplay",
            status: "pending",
          },
        ],
        "a chat's messages preview in that chat's mode",
      );
      const details = await sourcePackageDetails(
        { source: "messages", sourceIds: ["chat-roleplay:messages:r1"], sourceScope: { chatId: roleplayChat.id } },
        root,
      );
      assert.equal(
        details.details[0]?.content,
        "Aster: I open the Moon Vault.\n\nKirei: The Moon Vault hums.\n\nNarrator: Dust settles.\n\nSystem: Scene note.",
        "speakers use the persona snapshot, character names and fixed labels",
      );

      const allChats = await previewPackageInterop({ source: "messages", includeOutOfScope: true, limit: 100 }, root);
      assert.ok(
        allChats.samples.every((sample) => !sample.sourceId.startsWith("chat-mari:")),
        "Professor Mari chats are never a source",
      );
      assert.equal(
        allChats.samples.find((sample) => sample.sourceId.startsWith("chat-conversation:"))?.importMode,
        "conversation",
      );
      messageReads = 0;
      const scoped = await previewPackageInterop(
        { source: "messages", sourceScope: { chatId: conversationChat.id }, limit: 100 },
        root,
      );
      assert.deepEqual(
        scoped.samples.map((sample) => sample.sourceId),
        ["chat-conversation:messages:k1"],
        "a source scope limits messages to its chats",
      );
      assert.equal(messageReads, 1, "a scoped preview reads only its chat's messages");

      const branchPreview = await previewPackageInterop(
        { source: "messages", sourceScope: { groupIds: ["group-branches"] }, limit: 100 },
        root,
      );
      assert.equal(branchPreview.samples.length, 1, "identical branch messages preview once per chat group");

      const diverged = (branchChatId?: string, extra: { cursor?: string; limit?: number } = {}) =>
        previewPackageInterop(
          ltmInteropPreviewRequestSchema.parse({
            source: "messages",
            sourceScope: { groupIds: ["group-diverged"] },
            branchChatId,
            ...extra,
          }),
          root,
        );
      const sharedRow = "chat-diverged-a:messages:d1";
      assert.deepEqual(
        (await diverged()).samples.map((sample) => sample.sourceId),
        [sharedRow, "chat-diverged-a:messages:d2", "chat-diverged-b:messages:d2-b"],
        "without a branch the group lists the shared piece once and both endings",
      );
      const branchA = await diverged(divergedChatA.id);
      assert.deepEqual(
        branchA.samples.map((sample) => sample.sourceId),
        [sharedRow, "chat-diverged-a:messages:d2"],
        "a branch lists the shared piece and its own ending only",
      );
      assert.deepEqual(branchA.totals, { matches: 2, ready: 2, imported: 0 }, "totals follow the branch filter");
      assert.deepEqual(
        (await diverged(divergedChatB.id)).samples.map((sample) => sample.sourceId),
        [sharedRow, "chat-diverged-b:messages:d2-b"],
        "the shared piece also lists under the other branch, next to that branch's own ending",
      );
      assert.equal((await diverged(conversationChat.id)).totals.matches, 0, "a chat outside the group has no rows");
      const firstPage = await diverged(divergedChatA.id, { limit: 1 });
      assert.deepEqual(
        firstPage.samples.map((sample) => sample.sourceId),
        [sharedRow],
      );
      assert.ok(firstPage.nextCursor, "a branch page that has more returns a cursor");
      await assert.rejects(
        diverged(divergedChatB.id, { limit: 1, cursor: firstPage.nextCursor! }),
        /cursor is invalid/,
        "a cursor belongs to the branch it was issued for",
      );
      assert.deepEqual(
        (await diverged(divergedChatA.id, { limit: 1, cursor: firstPage.nextCursor! })).samples.map(
          (sample) => sample.sourceId,
        ),
        ["chat-diverged-a:messages:d2"],
        "the same branch continues from its cursor",
      );

      const imported = ltmImportSourceNotesResponseSchema.parse(
        await importPackageInterop(
          {
            source: "messages",
            chatId: roleplayChat.id,
            sourceIds: ["chat-roleplay:messages:r1"],
            destinationScope: { characterIds: ["character-kirei"] },
            extract: true,
            limit: 100,
          },
          root,
          new AbortController().signal,
        ),
      );
      const note = imported.imported[0]?.note;
      assert.ok(note, "the message piece becomes a source note");
      assert.deepEqual(note.provenance, { kind: "chat_transcript", sourceId: roleplayChat.id, entryId: "r1" });
      assert.deepEqual(note.modes, ["roleplay"], "a chat source keeps its chat's mode");
      assert.ok(note.scope.chatIds?.includes(roleplayChat.id), "the source note stays attached to its chat");
      assert.ok(note.scope.characterIds?.includes("character-kirei"), "the destination scope is linked");
      assert.ok(note.tags.includes("imported_chat_messages"));

      const roleplayMessages = messages.get(roleplayChat.id)!;
      roleplayMessages.push(message(roleplayChat.id, "r5", "user", "z".repeat(23_960)));
      roleplayMessages.push(message(roleplayChat.id, "r6", "assistant", "The vault closes."));
      const grown = await previewPackageInterop({ source: "messages", chatId: roleplayChat.id, limit: 100 }, root);
      assert.deepEqual(
        grown.samples.map(({ sourceId, status, freshness }) => ({ sourceId, status, freshness })),
        [
          { sourceId: "chat-roleplay:messages:r1", status: "imported", freshness: "current" },
          { sourceId: "chat-roleplay:messages:r5", status: "pending", freshness: "new" },
        ],
        "new messages that overflow the last piece start a new one and keep the earlier piece current",
      );
      roleplayMessages.splice(4);
      roleplayMessages.push(message(roleplayChat.id, "r5", "assistant", "The vault closes."));
      const appended = await previewPackageInterop({ source: "messages", chatId: roleplayChat.id, limit: 100 }, root);
      assert.deepEqual(
        appended.samples.map(({ sourceId, status, freshness }) => ({ sourceId, status, freshness })),
        [{ sourceId: "chat-roleplay:messages:r1", status: "imported", freshness: "source_updated" }],
        "a message that fits the last piece marks only that piece updated",
      );

      roleplayMessages.splice(4);
      roleplayMessages.push(message(roleplayChat.id, "r5", "user", "z".repeat(23_900)));
      roleplayMessages.push(message(roleplayChat.id, "r6", "assistant", "The vault closes."));
      await importPackageInterop(
        {
          source: "messages",
          chatId: roleplayChat.id,
          sourceIds: ["chat-roleplay:messages:r5"],
          destinationScope: { characterIds: ["character-kirei"] },
          extract: true,
          limit: 100,
        },
        root,
        new AbortController().signal,
      );
      roleplayMessages.splice(1, 1);
      const deleted = await previewPackageInterop({ source: "messages", chatId: roleplayChat.id, limit: 100 }, root);
      assert.deepEqual(
        deleted.samples.map(({ sourceId, status, freshness }) => ({ sourceId, status, freshness })),
        [
          { sourceId: "chat-roleplay:messages:r1", status: "imported", freshness: "source_updated" },
          { sourceId: "chat-roleplay:messages:r5", status: "imported", freshness: "source_updated" },
        ],
        "deleting an earlier message keeps a later imported piece's cut, renumbered, instead of pulling it into the earlier one",
      );
      roleplayMessages[3] = message(roleplayChat.id, "r5", "user", "z".repeat(23_900), { hiddenFromAI: true });
      const hidden = await previewPackageInterop({ source: "messages", chatId: roleplayChat.id, limit: 100 }, root);
      assert.deepEqual(
        hidden.samples.map(({ sourceId, status, freshness }) => ({ sourceId, status, freshness })),
        [
          { sourceId: "chat-roleplay:messages:r1", status: "imported", freshness: "source_updated" },
          { sourceId: "chat-roleplay:messages:r5", status: "imported", freshness: "source_updated" },
        ],
        "hiding an imported piece's first message keeps the piece under its name",
      );
    },
    [() => releaseRuntime?.(), () => rm(dataDir, { recursive: true, force: true })],
  );
  process.stdout.write(
    "Long-Term Memory chat transcript import regression: pieces, speakers, scope, mode, branches, append freshness, and kept piece cuts ok\n",
  );
}

void runRegressionToCompletion("long-term-memory-chat-transcript-import", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
