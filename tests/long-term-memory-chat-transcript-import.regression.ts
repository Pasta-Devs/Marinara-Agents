import assert from "node:assert/strict";
import { mock } from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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
    { getLtmExtractionConfig, ltmExtractionConfigPath, updateLtmExtractionConfig },
    { armLtmAutoImport, isLtmAutoImportArmed, LTM_AUTO_IMPORT_QUIET_MS },
    { readLtmDebugLog },
    { LongTermMemoryDraftStore },
  ] = await Promise.all([
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/package-runtime.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/sources/interop.ts"),
    import("../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/persistence/storage.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/extraction/extraction-config.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/sources/auto-import-job.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/maintenance/debug-log.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/drafts/draft-store.ts"),
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
  const detailedPieces = transcriptPieces(
    [
      message("c", "h1", "user", "Hello."),
      message("c", "h2", "user", "x".repeat(11_990)),
      message("c", "h3", "user", "y".repeat(30_000)),
    ],
    speaker,
    () => false,
    12_000,
  );
  assert.deepEqual(
    detailedPieces.map(({ entryId }) => entryId),
    ["h1", "h2", "h3", "h3:part:2", "h3:part:3"],
    "a 12,000 cap starts pieces sooner and splits an oversized message into parts",
  );
  assert.ok(
    detailedPieces.every((piece) => piece.content.length <= 12_000),
    "no piece exceeds the 12,000 character cap",
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
  // An Engine that lists Advanced Memory scene recaps: this package no longer reads them, so a chat using Advanced
  // Memory still imports its own rolling summaries and messages.
  const advancedMemoryHost = {
    async listChatSummaries() {
      return {
        advancedMemory: [
          {
            id: "scene-1",
            kind: "scene",
            title: "Scene 1",
            content: "Recap prose.",
            startMessageId: "u1",
            endMessageId: "u2",
            audienceCharacterIds: [],
            sourceFingerprint: "fp-1",
            updatedAt: "2026-10-31T00:00:00.000Z",
            memory: "## world_fact\nFact: The Moon Vault hums at night.",
          },
        ],
      };
    },
  };
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
          ...advancedMemoryHost,
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
      assert.ok(
        !note.sections.source?.evidence?.some((item) => item.startsWith("piece_size:")),
        "a Standard piece records no size, so its evidence and fingerprint stay as before",
      );

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
      const importPieces = (
        chatId: string,
        first: string,
        second: string,
        applyLowRisk: boolean | "unset" = true,
        importRoot = root,
        metadata: Record<string, unknown> = {},
      ): Promise<any> => {
        chats.push({ ...sealChat, id: chatId, metadata });
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
            applyLowRisk: applyLowRisk === "unset" ? undefined : applyLowRisk,
            limit: 100,
          },
          importRoot,
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

      // Hands-off: with no explicit request, "Accept safe changes automatically" decides whether safe work applies.
      // Each run uses its own store, so earlier fixtures cannot make its proposals ambiguous.
      const appliedBy = (result: any) => result.imported.flatMap((item: any) => item.appliedMutationIds);
      const handsOff = async (
        name: string,
        applyLowRisk: boolean | "unset",
        setting: boolean,
        metadata: Record<string, unknown> = {},
      ) => {
        const importRoot = join(dataDir, name, "long-term-memory");
        await updateLtmExtractionConfig({ autoImportChatSources: true, autoAcceptSafeChanges: setting }, importRoot);
        return appliedBy(
          await importPieces(`chat-${name}`, `${name}-1`, `${name}-2`, applyLowRisk, importRoot, metadata),
        );
      };
      assert.deepEqual(await handsOff("review-first", "unset", false), [], "by default an import waits for review");
      assert.ok(
        (await handsOff("hands-off", "unset", true)).length > 0,
        "with the setting on, an import accepts its safe proposals",
      );
      assert.deepEqual(
        await handsOff("chat-review", "unset", true, { longTermMemoryChatMemories: "review" }),
        [],
        "an import of a chat set to review waits for review with the global setting on",
      );
      assert.deepEqual(
        await handsOff("explicit-off", false, true),
        [],
        "an explicit applyLowRisk: false still wins over the setting",
      );

      // Chat import detail: each chat keeps the piece size of its first import.
      respond = () => [];
      const half = (id: string, chatId: string, letter: string) => message(chatId, id, "user", letter.repeat(11_000));
      const importChat = (chatId: string, sourceIds: string[]) =>
        importPackageInterop(
          { source: "messages", chatId, sourceIds, extract: true, limit: 100 },
          root,
          new AbortController().signal,
        );
      const rows = async (request: Record<string, unknown>) =>
        (await previewPackageInterop({ source: "messages", limit: 100, ...request } as any, root)).samples.map(
          ({ sourceId, status, freshness }) => ({ sourceId, status, freshness }),
        );
      const standardChat = { ...roleplayChat, id: "chat-standard", name: "Standard", groupId: "group-standard" };
      const detailedChat = { ...roleplayChat, id: "chat-detailed", name: "Detailed", groupId: "group-detailed" };
      chats.push(standardChat, detailedChat);
      messages.set(standardChat.id, [half("a1", standardChat.id, "a"), half("a2", standardChat.id, "b")]);
      messages.set(detailedChat.id, [half("d1", detailedChat.id, "a"), half("d2", detailedChat.id, "b")]);
      await importChat(standardChat.id, ["chat-standard:messages:a1"]);

      await updateLtmExtractionConfig({ chatImportDetail: "detailed" }, root);
      assert.deepEqual(
        await rows({ chatId: detailedChat.id }),
        [
          { sourceId: "chat-detailed:messages:d1", status: "pending", freshness: "new" },
          { sourceId: "chat-detailed:messages:d2", status: "pending", freshness: "new" },
        ],
        "Detailed cuts a new chat at 12,000 characters",
      );
      const detailedImport = ltmImportSourceNotesResponseSchema.parse(
        await importChat(detailedChat.id, ["chat-detailed:messages:d1", "chat-detailed:messages:d2"]),
      );
      assert.ok(
        detailedImport.imported.every((row) => row.note?.sections.source?.evidence?.includes("piece_size:12000")),
        "a Detailed piece records its size",
      );

      messages.get(standardChat.id)!.push(half("a3", standardChat.id, "c"), half("a4", standardChat.id, "d"));
      assert.deepEqual(
        await rows({ chatId: standardChat.id }),
        [
          { sourceId: "chat-standard:messages:a1", status: "imported", freshness: "current" },
          { sourceId: "chat-standard:messages:a3", status: "pending", freshness: "new" },
        ],
        "a chat imported at Standard keeps its pieces current after the setting changes, and new messages extend at 24,000",
      );
      const standardBranch = { ...standardChat, id: "chat-standard-branch", name: "Standard branch" };
      chats.push(standardBranch);
      messages.set(
        standardBranch.id,
        ["a", "b", "c", "d"].map((letter, index) => half(`a${index + 1}-copy`, standardBranch.id, letter)),
      );
      assert.deepEqual(
        await rows({ sourceScope: { groupIds: ["group-standard"] }, branchChatId: standardBranch.id }),
        [
          { sourceId: "chat-standard:messages:a1", status: "imported", freshness: "current" },
          { sourceId: "chat-standard:messages:a3", status: "pending", freshness: "new" },
        ],
        "a never-imported branch of a Standard chat cuts at 24,000 under Detailed, so its pieces merge with the parent's",
      );

      await updateLtmExtractionConfig({ chatImportDetail: "standard" }, root);
      messages.get(detailedChat.id)!.push(half("d3", detailedChat.id, "e"));
      assert.deepEqual(
        await rows({ chatId: detailedChat.id }),
        [
          { sourceId: "chat-detailed:messages:d1", status: "imported", freshness: "current" },
          { sourceId: "chat-detailed:messages:d2", status: "imported", freshness: "current" },
          { sourceId: "chat-detailed:messages:d3", status: "pending", freshness: "new" },
        ],
        "a chat imported at Detailed stays at 12,000 after the setting changes back",
      );

      const detailedBranch = { ...detailedChat, id: "chat-detailed-branch", name: "Detailed branch" };
      chats.push(detailedBranch);
      messages.set(detailedBranch.id, [
        half("d1-copy", detailedBranch.id, "a"),
        half("d2-copy", detailedBranch.id, "b"),
        half("f1", detailedBranch.id, "f"),
      ]);
      assert.deepEqual(
        await rows({ sourceScope: { groupIds: ["group-detailed"] }, branchChatId: detailedBranch.id }),
        [
          { sourceId: "chat-detailed:messages:d1", status: "imported", freshness: "current" },
          { sourceId: "chat-detailed:messages:d2", status: "imported", freshness: "current" },
          { sourceId: "chat-detailed-branch:messages:f1", status: "pending", freshness: "new" },
        ],
        "a never-imported branch cuts at its chat's 12,000, so its shared pieces merge with the parent's",
      );

      // A settings file saved while the Advanced Memory import existed still loads, and its switch is dropped.
      const legacyRoot = join(dataDir, "legacy", "long-term-memory");
      await mkdir(dirname(ltmExtractionConfigPath(legacyRoot)), { recursive: true });
      await writeFile(
        ltmExtractionConfigPath(legacyRoot),
        JSON.stringify({ version: 1, useAdvancedMemory: true, autoImportChatSources: true }),
      );
      const legacyConfig = await getLtmExtractionConfig(legacyRoot);
      assert.equal(legacyConfig.autoImportChatSources, true, "the rest of an old settings file is kept");
      assert.equal("useAdvancedMemory" in legacyConfig, false, "the retired switch is not part of the settings");
      const resaved = await updateLtmExtractionConfig({ useAdvancedMemory: true }, legacyRoot);
      assert.equal("useAdvancedMemory" in resaved, false);
      assert.equal(
        "useAdvancedMemory" in JSON.parse(await readFile(ltmExtractionConfigPath(legacyRoot), "utf8")),
        false,
        "and the next save removes it from the file",
      );

      // Hands-off import: a reply arms a quiet-period run that imports the chat's summaries and closed pieces.
      const autoRoot = join(dataDir, "auto", "long-term-memory");
      await updateLtmExtractionConfig({ autoImportChatSources: true, useAdvancedMemory: true }, autoRoot);
      const autoChat = {
        ...roleplayChat,
        id: "chat-auto",
        name: "Auto",
        metadata: {
          summaryEntries: [{ id: "sum-1", content: "The vault opened.", rangeStartIndex: 1, rangeEndIndex: 2 }],
        },
      };
      chats.push(autoChat);
      messages.set(autoChat.id, [
        message(autoChat.id, "u1", "user", "x".repeat(23_990)),
        message(autoChat.id, "u2", "assistant", "y".repeat(23_990)),
        message(autoChat.id, "u3", "user", "The tail is still being written."),
      ]);
      const autoImport = async (chatId: string) => {
        mock.timers.enable({ apis: ["setTimeout"] });
        try {
          armLtmAutoImport(autoRoot, chatId, "roleplay");
          mock.timers.tick(LTM_AUTO_IMPORT_QUIET_MS);
        } finally {
          mock.timers.reset();
        }
        for (let tries = 0; isLtmAutoImportArmed(autoRoot, chatId) && tries < 500; tries += 1)
          await new Promise((resolveWait) => setTimeout(resolveWait, 10));
        assert.equal(isLtmAutoImportArmed(autoRoot, chatId), false, "the background run finishes");
      };
      prompts.length = 0;
      await autoImport(autoChat.id);
      assert.deepEqual(
        (await readLtmDebugLog({}, autoRoot))
          .filter((event) => event.action === "auto_import")
          .map(({ source, status, counts }) => ({ source, status, imported: counts?.imported })),
        [
          { source: "chats", status: "ok", imported: 1 },
          { source: "messages", status: "ok", imported: 2 },
        ],
        "the summary and both closed pieces import, each source logged in Activity",
      );
      assert.equal(prompts.length, 3, "each imported source is extracted once");
      assert.deepEqual(
        (await new LongTermMemoryStorage(autoRoot).listNotes({ type: "source" }))
          .filter((note) => note.provenance?.sourceId === autoChat.id)
          .map((note) => note.provenance?.kind)
          .sort(),
        ["chat_summary", "chat_transcript", "chat_transcript"],
        "a host's Advanced Memory scene recaps are not a source; the chat's own summary and messages are",
      );
      assert.deepEqual(
        (await previewPackageInterop({ source: "messages", chatId: autoChat.id, limit: 100 }, autoRoot)).samples.map(
          ({ sourceId, status }) => ({ sourceId, status }),
        ),
        [
          { sourceId: "chat-auto:messages:u1", status: "imported" },
          { sourceId: "chat-auto:messages:u2", status: "imported" },
          { sourceId: "chat-auto:messages:u3", status: "pending" },
        ],
        "the open tail waits until it closes",
      );
      await autoImport(autoChat.id);
      assert.equal(prompts.length, 3, "a reply with nothing new makes no model call");

      // A failing selection is not retried on every reply.
      const failingChat = { ...roleplayChat, id: "chat-auto-failing", name: "Failing" };
      chats.push(failingChat);
      messages.set(failingChat.id, [
        message(failingChat.id, "f1", "user", "x".repeat(23_990)),
        message(failingChat.id, "f2", "user", "The tail."),
      ]);
      respond = () => {
        throw new Error("fixture model is down");
      };
      prompts.length = 0;
      await autoImport(failingChat.id);
      const attempts = prompts.length;
      assert.ok(attempts > 0, "the closed piece is attempted");
      assert.equal(
        (await readLtmDebugLog({}, autoRoot)).filter((event) => event.chatId === failingChat.id).at(-1)?.status,
        "error",
        "a failed background import is logged as an error",
      );
      await autoImport(failingChat.id);
      assert.equal(prompts.length, attempts, "the same failed selection is not retried");
      respond = () => [];

      // A branch imports its own summaries, not the ones its siblings wrote after the split.
      const autoEvents = async (chatId: string) =>
        (await readLtmDebugLog({}, autoRoot)).filter(
          (event) => event.action === "auto_import" && event.chatId === chatId,
        );
      const autoBranch = { ...roleplayChat, id: "chat-auto-branch", name: "Branch", groupId: "group-auto" };
      const autoSibling = {
        ...autoBranch,
        id: "chat-auto-sibling",
        name: "Sibling",
        metadata: { summaryEntries: [{ id: "sum-sibling", content: "Only the sibling saw this." }] },
      };
      chats.push(autoBranch, autoSibling);
      messages.set(autoBranch.id, [message(autoBranch.id, "g1", "user", "The tail.")]);
      messages.set(autoSibling.id, [message(autoSibling.id, "g1-other", "user", "Another tail.")]);
      prompts.length = 0;
      await autoImport(autoBranch.id);
      assert.deepEqual(await autoEvents(autoBranch.id), [], "a sibling's summary is not imported into the branch");
      assert.equal(prompts.length, 0);

      // An extraction that drops units leaves its source unfinished, so the next reply does not extract it again.
      const droppingChat = { ...roleplayChat, id: "chat-auto-dropping", name: "Dropping" };
      chats.push(droppingChat);
      messages.set(droppingChat.id, [
        message(droppingChat.id, "p1", "user", "x".repeat(23_990)),
        message(droppingChat.id, "p2", "user", "The tail."),
      ]);
      respond = (prompt) => [
        unit({
          bucket: "timeline_event",
          subjectId: "vault_opens",
          sectionKey: "event",
          title: "The vault opens",
          text: "The vault opens.",
          claimKind: "change",
          links: [{ target: prompt.sourceNote.id, relation: "extracted_from" }],
        }),
        { bucket: "not_a_bucket" },
      ];
      prompts.length = 0;
      await autoImport(droppingChat.id);
      assert.equal(prompts.length, 1, "the closed piece is extracted");
      assert.equal(
        (await autoEvents(droppingChat.id)).at(-1)?.status,
        "error",
        "a dropped unit is logged as unfinished",
      );
      await autoImport(droppingChat.id);
      assert.equal(prompts.length, 1, "the unfinished selection is not extracted on every reply");

      // The same for an edited source, whose note keeps the fingerprint of the text it was imported from.
      const dropping = respond;
      respond = () => [];
      const editedChat = {
        ...roleplayChat,
        id: "chat-auto-edited",
        name: "Edited",
        metadata: { summaryEntries: [{ id: "sum-edit", content: "The gate is shut." }] },
      };
      chats.push(editedChat);
      messages.set(editedChat.id, [message(editedChat.id, "e1", "user", "The tail.")]);
      const editedFreshness = async () =>
        (await previewPackageInterop({ source: "chats", chatId: editedChat.id, limit: 100 }, autoRoot)).samples.find(
          (sample) => sample.sourceId.startsWith(`${editedChat.id}:`),
        )?.freshness;
      prompts.length = 0;
      await autoImport(editedChat.id);
      assert.equal(prompts.length, 1, "the summary is imported");
      assert.equal(await editedFreshness(), "current");
      editedChat.metadata.summaryEntries[0]!.content = "The gate is open.";
      assert.equal(await editedFreshness(), "source_updated");
      respond = dropping;
      await autoImport(editedChat.id);
      assert.equal(prompts.length, 2, "the edited summary is extracted again");
      assert.equal((await autoEvents(editedChat.id)).at(-1)?.status, "error", "a dropped unit is logged as unfinished");
      assert.equal(await editedFreshness(), "source_updated", "the source still shows as edited");
      await autoImport(editedChat.id);
      assert.equal(prompts.length, 2, "the unfinished edit is not extracted on every reply");
      respond = () => [];
      prompts.length = 0;

      // "Memories from this chat": the chat's choice beats the global one for the run's re-check and its accept step.
      const memoriesChat = (id: string, choice?: string) => {
        const chat = { ...roleplayChat, id, name: id, metadata: choice ? { longTermMemoryChatMemories: choice } : {} };
        chats.push(chat);
        messages.set(id, [message(id, `${id}-1`, "user", "x".repeat(23_990)), message(id, `${id}-2`, "user", "Tail.")]);
        return chat;
      };
      respond = (prompt) => [
        unit({
          bucket: "timeline_event",
          subjectId: `gate_${prompt.sourceNote.id.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`,
          sectionKey: "event",
          title: "The gate opens",
          text: "The gate opens.",
          claimKind: "change",
          links: [{ target: prompt.sourceNote.id, relation: "extracted_from" }],
        }),
      ];
      const draftStore = new LongTermMemoryDraftStore(autoRoot);
      const applied = async (chatId: string) => (await autoEvents(chatId)).at(-1)?.counts?.applied;
      const pendingFor = async (chatId: string) =>
        (await draftStore.listDrafts({ status: "pending", chatId })).filter((draft) => draft.mutations.length).length;
      // Global: import on, accept off.
      const inherits = memoriesChat("chat-memories-global");
      const saves = memoriesChat("chat-memories-save", "save");
      const manual = memoriesChat("chat-memories-manual", "manual");
      prompts.length = 0;
      await autoImport(inherits.id);
      assert.equal(await applied(inherits.id), 0, "no chat choice: the global accept-off leaves changes for review");
      assert.equal(await pendingFor(inherits.id), 1, "and they wait in review");
      await autoImport(saves.id);
      assert.ok(((await applied(saves.id)) ?? 0) > 0, "a chat set to save accepts safe changes with the global off");
      assert.equal(await pendingFor(saves.id), 0, "and nothing waits for it");
      const promptsBeforeManual = prompts.length;
      await autoImport(manual.id);
      assert.equal(prompts.length, promptsBeforeManual, "a chat set to manual imports nothing with the global on");
      assert.deepEqual(await autoEvents(manual.id), [], "and logs nothing");
      // Global: import off, accept on.
      await updateLtmExtractionConfig({ autoImportChatSources: false, autoAcceptSafeChanges: true }, autoRoot);
      const reviews = memoriesChat("chat-memories-review", "review");
      const inheritsOff = memoriesChat("chat-memories-global-off");
      await autoImport(reviews.id);
      assert.equal(
        await applied(reviews.id),
        0,
        "a chat set to review leaves changes for review with global accept on",
      );
      assert.equal(await pendingFor(reviews.id), 1);
      const promptsBeforeOff = prompts.length;
      await autoImport(inheritsOff.id);
      assert.equal(prompts.length, promptsBeforeOff, "no chat choice falls back to the global import off");
      await updateLtmExtractionConfig({ autoImportChatSources: true, autoAcceptSafeChanges: false }, autoRoot);
      respond = () => [];
      prompts.length = 0;

      // Turning the setting off cancels a run that is already waiting.
      messages.get(failingChat.id)!.push(message(failingChat.id, "f3", "user", "y".repeat(23_990)));
      const failingEvents = (await autoEvents(failingChat.id)).length;
      mock.timers.enable({ apis: ["setTimeout"] });
      try {
        armLtmAutoImport(autoRoot, failingChat.id, "roleplay");
        await updateLtmExtractionConfig({ autoImportChatSources: false }, autoRoot);
        mock.timers.tick(LTM_AUTO_IMPORT_QUIET_MS);
      } finally {
        mock.timers.reset();
      }
      for (let tries = 0; isLtmAutoImportArmed(autoRoot, failingChat.id) && tries < 500; tries += 1)
        await new Promise((resolveWait) => setTimeout(resolveWait, 10));
      assert.equal(prompts.length, 0, "a run armed before the setting was turned off makes no model call");
      assert.equal((await autoEvents(failingChat.id)).length, failingEvents, "and logs nothing");
    },
    [() => releaseRuntime?.(), () => rm(dataDir, { recursive: true, force: true })],
  );
  process.stdout.write(
    "Long-Term Memory chat transcript import regression: pieces, speakers, scope, mode, branches, append freshness, kept piece cuts, previous-piece context, and chat import detail ok\n",
  );
}

void runRegressionToCompletion("long-term-memory-chat-transcript-import", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
