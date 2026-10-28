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
    { LongTermMemoryStorage },
  ] = await Promise.all([
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/package-runtime.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/sources/interop.ts"),
    import("../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/persistence/storage.ts"),
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
  // Each extraction prompt, and the units the fixture model answers it with.
  const prompts: any[] = [];
  let respond: (prompt: any) => unknown[] = () => [];
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
              async chatComplete(promptMessages: Array<{ content: string }>) {
                const prompt = JSON.parse(promptMessages.at(-1)!.content);
                prompts.push(prompt);
                return { content: JSON.stringify({ summary: "", units: respond(prompt) }), finishReason: "stop" };
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
        preview.samples.map(({ sourceId, title, importMode, status, messageRange }) => ({
          sourceId,
          title,
          importMode,
          status,
          messageRange,
        })),
        [
          {
            sourceId: "chat-roleplay:messages:r1",
            title: "Moon Vault, messages 1-4",
            importMode: "roleplay",
            status: "pending",
            messageRange: { chatName: "Moon Vault", first: 1, last: 4 },
          },
        ],
        "a chat's messages preview in that chat's mode, with its range as data for the row",
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
      assert.deepEqual(
        scoped.samples[0]?.messageRange,
        { chatName: "Kitchen", first: 1, last: 1 },
        "a single-message piece has first equal to last",
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

      // A chat's second piece starts from the first piece's tail, events and open thread.
      const sealChat = { ...roleplayChat, id: "chat-pieces", name: "Seal" };
      chats.push(sealChat);
      messages.set(sealChat.id, [
        message(sealChat.id, "s1", "user", `${"x".repeat(23_950)} The seal cracks at dawn.`),
        message(sealChat.id, "s2", "assistant", "The seal holds."),
      ]);
      const unit = (fields: Record<string, unknown>) => ({
        claimKind: "static",
        importance: "major",
        confidence: 0.9,
        salience: 0.8,
        status: "active",
        links: [],
        subjectNames: [],
        ...fields,
      });
      let scenario: "seal" | "leak" | "carry" = "seal";
      respond = (prompt) => {
        const from = { target: prompt.sourceNote.id, relation: "extracted_from" };
        return prompt.sourceText.includes("The seal cracks")
          ? [
              unit({
                bucket: "timeline_event",
                subjectId: "seal_cracks",
                sectionKey: "event",
                title: "The seal cracks",
                text: "The seal cracks at dawn.",
                claimKind: "change",
                links: [from],
              }),
              unit({
                bucket: "thread",
                subjectId: `${scenario}_mystery`,
                sectionKey: "status",
                title: `The ${scenario} mystery`,
                text:
                  scenario === "carry"
                    ? `Nobody knows why the carry began. ${"The elders argue over it. ".repeat(30)}`.trim()
                    : `Nobody knows why the ${scenario} began.`,
              }),
            ]
          : [
              unit({
                bucket: "timeline_event",
                subjectId: "seal_holds",
                sectionKey: "event",
                title: "The seal holds",
                text: "The seal holds despite the crack.",
                claimKind: "change",
                links: [from, { target: prompt.previousPiece.events[0].id, relation: "caused_by" }],
              }),
              ...(scenario === "leak"
                ? [
                    unit({
                      bucket: "timeline_event",
                      subjectId: "seal_leaks",
                      sectionKey: "event",
                      title: "The seal leaks",
                      text: "Light leaks through the seal.",
                      claimKind: "change",
                      links: [from, { target: "timeline_unlisted", relation: "caused_by" }],
                    }),
                  ]
                : []),
              ...(scenario === "carry"
                ? [
                    unit({
                      bucket: "thread",
                      subjectId: prompt.previousPiece.threads[0].subjectId,
                      sectionKey: "status",
                      title: `The ${scenario} mystery`,
                      text: "The crack was made from the inside.",
                    }),
                  ]
                : []),
            ];
      };
      prompts.length = 0;
      await importPackageInterop(
        {
          source: "messages",
          chatId: sealChat.id,
          sourceIds: ["chat-pieces:messages:s1", "chat-pieces:messages:s2"],
          destinationScope: { characterIds: ["character-kirei"] },
          extract: true,
          applyLowRisk: true,
          limit: 100,
        },
        root,
        new AbortController().signal,
      );
      assert.equal(prompts.length, 2, "each piece is extracted once");
      assert.ok(prompts[0].sourceText.includes("The seal cracks"), "the first piece is prepared first");
      assert.equal("previousPiece" in prompts[0], false, "a chat's first piece keeps its prompt");
      const previous = prompts[1].previousPiece;
      assert.ok(previous.tail.endsWith("The seal cracks at dawn."), "the second piece sees the end of the first");
      assert.ok(previous.tail.length <= 3_000, "the tail is bounded");
      assert.deepEqual(
        previous.events.map((event: { id: string; title: string }) => [
          event.id.startsWith("timeline_seal_cracks"),
          event.title,
        ]),
        [[true, "The seal cracks"]],
        "the first piece's events are listed with their ids",
      );
      assert.deepEqual(
        previous.threads.map((thread: { id: string; subjectId: string }) => thread.id.endsWith(thread.subjectId)),
        [true],
        "the first piece's open thread is listed with the subjectId to reuse",
      );
      const sealNotes = await new LongTermMemoryStorage(root).listNotes();
      const linksOf = (id: string) => sealNotes.find((note) => note.id === id)?.links ?? [];
      assert.ok(
        linksOf(sealNotes.find((note) => note.id.startsWith("timeline_seal_holds"))!.id).some(
          (link) => link.target === previous.events[0].id && link.relation === "caused_by",
        ),
        "a cause listed from the previous piece is linked and committed",
      );

      // Each of these runs on its own chat: a dropped candidate keeps a piece out of auto-apply, so the rejection
      // cannot share a chat with the committed link.
      const importPieces = (chatId: string, first: string, second: string): Promise<any> => {
        chats.push({ ...sealChat, id: chatId });
        messages.set(chatId, [
          message(chatId, first, "user", `${"x".repeat(23_950)} The seal cracks at dawn.`),
          message(chatId, second, "assistant", "The seal holds."),
        ]);
        return importPackageInterop(
          {
            source: "messages",
            chatId,
            sourceIds: [`${chatId}:messages:${first}`, `${chatId}:messages:${second}`],
            destinationScope: { characterIds: ["character-kirei"] },
            extract: true,
            applyLowRisk: true,
            limit: 100,
          },
          root,
          new AbortController().signal,
        );
      };
      scenario = "leak";
      const leaked = await importPieces("chat-leak", "l1", "l2");
      assert.equal(
        leaked.imported[1].diagnostics.some(
          (item: { details?: { linkTarget?: string } }) => item.details?.linkTarget === "timeline_unlisted",
        ),
        true,
        "a link to an id the prompt did not list is still rejected",
      );
      // Continuing a listed thread rewrites it in place, which apply will not do beside other changes: the piece
      // keeps its draft for review instead of failing.
      scenario = "carry";
      const continued = await importPieces("chat-thread", "t1", "t2");
      assert.equal(continued.imported[1].extractionStatus, "succeeded", "a continued thread does not fail its piece");
      const listedThread = prompts.at(-1).previousPiece.threads[0].id;
      const listedText = prompts.at(-1).previousPiece.threads[0].text;
      assert.ok(listedText.length > 600 && listedText.endsWith("argue over it."), "a listed thread is shown whole");
      assert.deepEqual(
        continued.imported[1].draft.mutations
          .filter((mutation: any) => (mutation.noteId ?? mutation.note?.id)?.startsWith("thread_"))
          .map((mutation: any) => [mutation.kind, mutation.noteId ?? mutation.note.id]),
        [["update_section", listedThread]],
        "reusing the listed subjectId updates that thread instead of adding another",
      );
    },
    [() => releaseRuntime?.(), () => rm(dataDir, { recursive: true, force: true })],
  );
  process.stdout.write(
    "Long-Term Memory chat transcript import regression: pieces, speakers, scope, mode, branches, append freshness, kept piece cuts, and previous-piece context ok\n",
  );
}

void runRegressionToCompletion("long-term-memory-chat-transcript-import", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
