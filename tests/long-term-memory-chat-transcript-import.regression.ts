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
    { armLtmAutoImport, isLtmAutoImportArmed, retryLtmAutoImport, LTM_AUTO_IMPORT_QUIET_MS, LTM_AUTO_IMPORT_RETRY_MS },
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
  // "length" answers as a model that hit its output limit.
  let finishReason = "stop";
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
                return { content: JSON.stringify({ summary: "", units: respond(prompt) }), finishReason };
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
          { sourceId: "chat-roleplay:messages:r5", status: "imported", freshness: "current" },
        ],
        "deleting an earlier message keeps a later imported piece's cut, renumbered, instead of pulling it into the earlier one; its text did not change, so it is not read again",
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

      // Each of these runs on its own chat, so one scenario's committed memories cannot change another's prompt.
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

      // World and tone memories: a later piece lists the chat's existing ones, and reusing a listed subjectId grows
      // that note instead of saving the same rule again. A different subjectId still creates a note.
      let worldMode: "reuse" | "new" = "reuse";
      respond = (prompt) => {
        const from = { target: prompt.sourceNote.id, relation: "extracted_from" };
        if (prompt.sourceText.includes("The seal cracks")) {
          return [
            unit({
              bucket: "world_fact",
              subjectId: "front_rule",
              sectionKey: "facts",
              title: "Rule of the Front",
              text: "Nobody crosses the Front after dark.",
              links: [from],
            }),
            unit({
              bucket: "tone",
              subjectId: "dread",
              sectionKey: "observations",
              title: "Creeping Dread",
              text: "The story keeps a creeping dread.",
              links: [from],
            }),
          ];
        }
        const listed = prompt.existingWorld?.[0];
        return [
          unit({
            bucket: "world_fact",
            subjectId: worldMode === "reuse" ? listed.subjectId : "salt_roads",
            sectionKey: "facts",
            title: worldMode === "reuse" ? "Rule of the Front" : "The Salt Roads",
            text: worldMode === "reuse" ? "Patrols enforce the Front's curfew." : "The salt roads belong to the guild.",
            links: [from],
          }),
          unit({
            bucket: "tone",
            subjectId: prompt.existingTone[0].subjectId,
            sectionKey: "observations",
            title: "Creeping Dread",
            text: "The dread deepens near the Front.",
            links: [from],
          }),
        ];
      };
      for (const mode of ["reuse", "new"] as const) {
        worldMode = mode;
        const chatId = `chat-world-${mode}`;
        prompts.length = 0;
        // Its own store, so no other scenario's world or tone memories sit in the scope.
        const worldRoot = join(dataDir, `world-${mode}`, "long-term-memory");
        await importPieces(chatId, `${mode}-1`, `${mode}-2`, true, worldRoot);
        assert.equal("existingWorld" in prompts[0], false, "a scope with no world memories omits the list");
        assert.equal("existingTone" in prompts[0], false, "a scope with no tone memories omits the list");
        assert.deepEqual(
          prompts[1].existingWorld.map((item: { title: string }) => item.title),
          ["Rule of the Front"],
          "the second piece lists the world memory the first saved",
        );
        assert.deepEqual(
          prompts[1].existingTone.map((item: { title: string }) => item.title),
          ["Creeping Dread"],
          "the second piece lists the tone memory the first saved",
        );
        const added = await new LongTermMemoryStorage(worldRoot).listNotes();
        const worlds = added.filter((note) => note.type === "world");
        const tones = added.filter((note) => note.type === "tone");
        assert.equal(tones.length, 1, "the tone memory is updated, not repeated");
        assert.equal(
          worlds.length,
          mode === "reuse" ? 1 : 2,
          mode === "reuse"
            ? "reusing the listed world subjectId adds no world note"
            : "a different rule still creates one",
        );
        if (mode === "reuse") {
          assert.ok(
            JSON.stringify(worlds[0]!.sections).includes("curfew"),
            "the reused world note carries the second piece's claim",
          );
        }
      }

      // A model with nothing to add must not leave a placeholder memory. Each answer runs on its own store, and a
      // real sentence that merely contains "ignore" is kept.
      const respondBeforePlaceholders = respond;
      for (const [index, placeholder] of ["- ignore", "None."].entries()) {
        respond = (prompt) => {
          const from = { target: prompt.sourceNote.id, relation: "extracted_from" };
          if (prompt.sourceText.includes("The seal cracks")) return [];
          return [
            unit({
              bucket: "timeline_event",
              subjectId: "seal_nothing",
              sectionKey: "event",
              title: "Nothing new",
              text: placeholder,
              claimKind: "change",
              links: [from],
            }),
            unit({
              bucket: "timeline_event",
              subjectId: "guards_ignore",
              sectionKey: "event",
              title: "The guards ignore the warning",
              text: "The guards ignore the warning at the gate.",
              claimKind: "change",
              links: [from],
            }),
          ];
        };
        const placeholderRoot = join(dataDir, `placeholder-${index}`, "long-term-memory");
        const placeholderRun = await importPieces(
          `chat-placeholder-${index}`,
          `p${index}a`,
          `p${index}b`,
          true,
          placeholderRoot,
        );
        const placeholderPiece = placeholderRun.imported[1];
        assert.equal(placeholderPiece.extractionStatus, "succeeded", "a placeholder unit does not fail its piece");
        assert.ok(
          placeholderPiece.diagnostics.some(
            (item: { code: string }) => item.code === "candidate_dropped_placeholder_output",
          ),
          `"${placeholder}" is reported as dropped placeholder output`,
        );
        assert.equal(
          JSON.stringify(placeholderPiece.outcome.droppedCandidates).includes("placeholder_output"),
          true,
          "the unit is dropped as placeholder output",
        );
        const derived = JSON.stringify(
          (await new LongTermMemoryStorage(placeholderRoot).listNotes()).filter((note) => note.type !== "source"),
        );
        assert.equal(derived.includes(placeholder), false, `"${placeholder}" is saved in no memory`);
        assert.equal(derived.includes("The guards ignore the warning at the gate."), true, "a real sentence is kept");
      }

      // A model that answers with nothing but a placeholder says the same as an empty list: the source is read.
      respond = () => [
        unit({
          bucket: "timeline_event",
          subjectId: "nothing_new",
          sectionKey: "event",
          title: "Nothing new",
          text: "- ignore",
          claimKind: "change",
          links: [{ target: "unused", relation: "extracted_from" }],
        }),
      ];
      const onlyPlaceholderRun = await importPieces(
        "chat-only-placeholder",
        "o1",
        "o2",
        true,
        join(dataDir, "only-placeholder", "long-term-memory"),
      );
      assert.deepEqual(
        onlyPlaceholderRun.imported.map((item: any) => [item.extractionStatus, item.markedCurrent]),
        [
          ["succeeded", true],
          ["succeeded", true],
        ],
        "an answer of only placeholders marks the source read instead of failing it every pass",
      );

      // An empty units list is a valid answer: the piece succeeds and its source is marked read with the new
      // fingerprint, which now carries a text-only hash.
      respond = () => [];
      const emptyRoot = join(dataDir, "empty-units", "long-term-memory");
      const emptyRun = await importPieces("chat-empty", "e1", "e2", true, emptyRoot);
      assert.deepEqual(
        emptyRun.imported.map((item: any) => [item.extractionStatus, item.markedCurrent, item.outcome.state]),
        [
          ["succeeded", true, "no_suggestions_created"],
          ["succeeded", true, "no_suggestions_created"],
        ],
        "an empty answer is a successful reading",
      );
      const emptyStorage = new LongTermMemoryStorage(emptyRoot);
      const savedFingerprint = async () =>
        (await emptyStorage.listNotes()).find((note) => note.id === emptyRun.imported[0].note.id)!
          .extractionFingerprint!;
      assert.match(
        (await savedFingerprint()).textHash ?? "",
        /^[a-f0-9]{64}$/,
        "the saved fingerprint keeps a text hash",
      );

      // A source cut again with the same text but another title or message range is not read again, and its
      // fingerprint is refreshed. Changed text is, and so is a fingerprint saved before the text hash existed.
      const { extractionFingerprintForLtmSourceNote } =
        await import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/extraction/source-hash.ts");
      const staleFingerprint = async (options: { text?: string; keepTextHash?: boolean }) => {
        const note = (await emptyStorage.listNotes()).find((item) => item.id === emptyRun.imported[0].note.id)!;
        const source = note.sections.source!;
        const read = {
          ...note,
          title: "An older cut",
          sections: {
            ...note.sections,
            source: {
              ...source,
              text: options.text ?? source.text,
              evidence: [...(source.evidence ?? []), "message_range:99-100"],
            },
          },
        };
        const { textHash, ...withoutTextHash } = extractionFingerprintForLtmSourceNote(read, {
          extractionMode: note.extractionFingerprint!.extractionMode,
        });
        await emptyStorage.updateNote(note.id, {
          extractionFingerprint: options.keepTextHash === false ? withoutTextHash : { ...withoutTextHash, textHash },
        });
      };
      const freshnessOfFirst = async () =>
        (await previewPackageInterop({ source: "messages", chatId: "chat-empty", limit: 100 }, emptyRoot)).samples.find(
          (sample: any) => sample.sourceId === "chat-empty:messages:e1",
        )!.freshness;
      const readFirstPiece = (options: { keepPendingDrafts?: boolean } = { keepPendingDrafts: true }) => {
        prompts.length = 0;
        return importPackageInterop(
          {
            source: "messages",
            chatId: "chat-empty",
            sourceIds: ["chat-empty:messages:e1"],
            destinationScope: { characterIds: ["character-kirei"] },
            extract: true,
            applyLowRisk: true,
            limit: 100,
          },
          emptyRoot,
          new AbortController().signal,
          options,
        );
      };
      await staleFingerprint({});
      assert.equal(await freshnessOfFirst(), "current", "a re-cut piece with the same text is not listed as updated");
      const recut = await readFirstPiece();
      assert.equal(prompts.length, 0, "a re-cut piece with the same text makes no model call");
      assert.equal(recut.imported[0].extractionStatus, "not_started");
      assert.equal(recut.batchStatus, "success");
      const refreshed = await savedFingerprint();
      assert.equal(
        refreshed.sourceHash,
        extractionFingerprintForLtmSourceNote(
          (await emptyStorage.listNotes()).find((note) => note.id === emptyRun.imported[0].note.id)!,
          { extractionMode: refreshed.extractionMode },
        ).sourceHash,
        "the fingerprint is refreshed to the piece's current labels",
      );
      // A manual import is an explicit read: it extracts even when only the labels moved.
      await staleFingerprint({});
      const manualRecut = await readFirstPiece({});
      assert.equal(prompts.length, 1, "a manual import reads a re-cut piece");
      assert.equal(manualRecut.imported[0].extractionStatus, "succeeded");
      await staleFingerprint({});
      await staleFingerprint({ text: "The seal held, an older telling." });
      assert.equal(await freshnessOfFirst(), "source_updated", "changed text is still listed as updated");
      await readFirstPiece();
      assert.equal(prompts.length, 1, "changed text is read again");
      await staleFingerprint({ keepTextHash: false });
      assert.equal(await freshnessOfFirst(), "source_updated", "a fingerprint without a text hash behaves as before");
      await readFirstPiece();
      assert.equal(prompts.length, 1, "a fingerprint without a text hash is read again");
      const { textHash: _unused, ...legacyFingerprint } = await savedFingerprint();
      await emptyStorage.updateNote(emptyRun.imported[0].note.id, { extractionFingerprint: legacyFingerprint });
      assert.equal(await freshnessOfFirst(), "current", "an unchanged piece with an old fingerprint stays current");
      respond = respondBeforePlaceholders;

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

      // Hands-off import: a reply arms a quiet-period run that imports the chat's closed message pieces. Its summary is a
      // manual import from Sources, because it describes the same beats and would save each event twice.
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
        [{ source: "messages", status: "ok", imported: 2 }],
        "both closed pieces import and are logged in Activity; the chat's summary is not read in the background",
      );
      assert.equal(prompts.length, 2, "each closed piece is extracted once, and the summary is not");
      assert.deepEqual(
        (await new LongTermMemoryStorage(autoRoot).listNotes({ type: "source" }))
          .filter((note) => note.provenance?.sourceId === autoChat.id)
          .map((note) => note.provenance?.kind)
          .sort(),
        ["chat_transcript", "chat_transcript"],
        "a chat with both a summary and messages auto-imports only message pieces: no `chats` source note",
      );
      assert.equal(
        (await previewPackageInterop({ source: "chats", chatId: autoChat.id, limit: 100 }, autoRoot)).samples.find(
          (sample) => sample.sourceId.startsWith(`${autoChat.id}:`),
        )?.status,
        "pending",
        "and the summary still waits for a manual import from Sources",
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
      assert.equal(prompts.length, 2, "a reply with nothing new makes no model call");

      // "Newest messages to leave for later": a finished piece waits until that many newer messages follow it.
      await updateLtmExtractionConfig({ autoImportLeaveMessages: 2 }, autoRoot);
      const leaveChat = { ...roleplayChat, id: "chat-auto-leave", name: "Leave" };
      chats.push(leaveChat);
      messages.set(leaveChat.id, [
        message(leaveChat.id, "l1", "user", "x".repeat(23_990)),
        message(leaveChat.id, "l2", "assistant", "y".repeat(23_990)),
        message(leaveChat.id, "l3", "user", "The tail is still being written."),
      ]);
      const leaveStatuses = async () =>
        (await previewPackageInterop({ source: "messages", chatId: leaveChat.id, limit: 100 }, autoRoot)).samples.map(
          ({ status }) => status,
        );
      prompts.length = 0;
      await autoImport(leaveChat.id);
      assert.deepEqual(
        [prompts.length, await leaveStatuses()],
        [1, ["imported", "pending", "pending"]],
        "with 2 left, the piece ending at message 2 of 3 waits and the one ending at message 1 imports",
      );
      messages.get(leaveChat.id)!.push(message(leaveChat.id, "l4", "assistant", "One more reply."));
      await autoImport(leaveChat.id);
      assert.deepEqual(
        [prompts.length, await leaveStatuses()],
        [2, ["imported", "imported", "pending"]],
        "and imports once two newer messages follow it",
      );
      await updateLtmExtractionConfig({ autoImportLeaveMessages: 0 }, autoRoot);

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
      assert.ok(
        (await readLtmDebugLog({}, autoRoot)).filter((event) => event.chatId === failingChat.id).at(-1)?.error?.code,
        "the event keeps the failed piece's reason (a model's own text stays in the server log)",
      );
      // Retry in Chat Settings forgets the failed selection and runs it again.
      const retryOnce = async () => {
        mock.timers.enable({ apis: ["setTimeout"] });
        try {
          retryLtmAutoImport(autoRoot, failingChat.id, "roleplay");
          mock.timers.tick(LTM_AUTO_IMPORT_QUIET_MS);
        } finally {
          mock.timers.reset();
        }
        for (let tries = 0; isLtmAutoImportArmed(autoRoot, failingChat.id) && tries < 500; tries += 1)
          await new Promise((resolveWait) => setTimeout(resolveWait, 10));
      };
      await retryOnce();
      assert.equal(prompts.length, 2 * attempts, "Retry runs the failed selection again");
      // A passing provider error heals on its own: a reply after the retry window tries the selection once more.
      const realNow = Date.now;
      Date.now = () => realNow() + LTM_AUTO_IMPORT_RETRY_MS;
      try {
        await autoImport(failingChat.id);
      } finally {
        Date.now = realNow;
      }
      assert.equal(prompts.length, 3 * attempts, "the failed selection is retried after the window");
      respond = () => [];

      // A branch imports its own message pieces, not the ones its siblings wrote after the split, and no summaries.
      const autoEvents = async (chatId: string) =>
        (await readLtmDebugLog({}, autoRoot)).filter(
          (event) => event.action === "auto_import" && event.chatId === chatId,
        );
      const autoBranch = { ...roleplayChat, id: "chat-auto-branch", name: "Branch", groupId: "group-auto" };
      const autoSibling = {
        ...autoBranch,
        id: "chat-auto-sibling",
        name: "Sibling",
      };
      chats.push(autoBranch, autoSibling);
      messages.set(autoBranch.id, [message(autoBranch.id, "g1", "user", "The tail.")]);
      messages.set(autoSibling.id, [
        message(autoSibling.id, "g1-other", "user", "x".repeat(23_990)),
        message(autoSibling.id, "g2-other", "user", "Another tail."),
      ]);
      prompts.length = 0;
      await autoImport(autoBranch.id);
      assert.deepEqual(await autoEvents(autoBranch.id), [], "a sibling's pieces are not imported into the branch");
      assert.equal(prompts.length, 0);

      // An extraction that drops a unit but keeps others is finished: the kept memory is saved by the chat's choice, the
      // dropped one waits in Review, and the next reply does not read the piece again.
      const droppingChat = {
        ...roleplayChat,
        id: "chat-auto-dropping",
        name: "Dropping",
        metadata: { longTermMemoryChatMemories: "save" },
      };
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
      const droppingEvent = (await autoEvents(droppingChat.id)).at(-1);
      assert.equal(droppingEvent?.status, "ok", "a dropped unit no longer leaves the piece unfinished");
      assert.equal(droppingEvent?.counts?.applied, 1, "the kept memory is saved");
      assert.equal(
        (await previewPackageInterop({ source: "messages", chatId: droppingChat.id, limit: 100 }, autoRoot)).samples[0]
          ?.freshness,
        "current",
      );
      await autoImport(droppingChat.id);
      assert.equal(prompts.length, 1, "the finished piece is not extracted again");

      // The same for an edited source: its note takes the fingerprint of the new text.
      const dropping = respond;
      respond = () => [];
      const editedChat = {
        ...roleplayChat,
        id: "chat-auto-edited",
        name: "Edited",
      };
      chats.push(editedChat);
      const editedMessages = [
        message(editedChat.id, "e1", "user", "a".repeat(23_990)),
        message(editedChat.id, "e2", "user", "The tail."),
      ];
      messages.set(editedChat.id, editedMessages);
      const editedFreshness = async () =>
        (await previewPackageInterop({ source: "messages", chatId: editedChat.id, limit: 100 }, autoRoot)).samples.find(
          (sample) => sample.sourceId === `${editedChat.id}:messages:e1`,
        )?.freshness;
      prompts.length = 0;
      await autoImport(editedChat.id);
      assert.equal(prompts.length, 1, "the closed piece is imported");
      assert.equal(await editedFreshness(), "current");
      editedMessages[0]!.content = "b".repeat(23_990);
      assert.equal(await editedFreshness(), "source_updated");
      respond = dropping;
      await autoImport(editedChat.id);
      assert.equal(prompts.length, 2, "the edited piece is extracted again");
      assert.equal((await autoEvents(editedChat.id)).at(-1)?.status, "ok", "a dropped unit is not a failure");
      assert.equal(await editedFreshness(), "current", "the source is up to date");
      await autoImport(editedChat.id);
      assert.equal(prompts.length, 2, "the finished edit is not extracted again");
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

      // A reading cut off by the model's output limit is unfinished, and its memories wait in Review. A later pass must
      // not read the same text again: that would replace the waiting draft with a second attempt.
      const cutChat = {
        ...roleplayChat,
        id: "chat-auto-cut",
        name: "Cut",
      };
      chats.push(cutChat);
      const cutMessages = [
        message(cutChat.id, "c1", "user", "a".repeat(23_990)),
        message(cutChat.id, "c2", "user", "The tail."),
      ];
      messages.set(cutChat.id, cutMessages);
      respond = (prompt) => [
        unit({
          bucket: "timeline_event",
          subjectId: "bridge_falls",
          sectionKey: "event",
          title: "The bridge falls",
          // Each reading words it differently, so no attempt deduplicates against another.
          text: `The bridge falls, reading ${prompts.length}.`,
          claimKind: "change",
          links: [{ target: prompt.sourceNote.id, relation: "extracted_from" }],
        }),
      ];
      const cutPending = async () => draftStore.listDrafts({ status: "pending", chatId: cutChat.id });
      finishReason = "length";
      try {
        await autoImport(cutChat.id);
      } finally {
        finishReason = "stop";
      }
      assert.equal(prompts.length, 1, "the closed piece is read");
      assert.equal((await autoEvents(cutChat.id)).at(-1)?.status, "error", "a cut-off reading is logged as unfinished");
      const [cutDraft] = await cutPending();
      assert.ok(cutDraft?.mutations.length, "its memories wait in Review");
      const cutEvents = (await autoEvents(cutChat.id)).length;
      mock.timers.enable({ apis: ["setTimeout"] });
      try {
        retryLtmAutoImport(autoRoot, cutChat.id, "roleplay");
        mock.timers.tick(LTM_AUTO_IMPORT_QUIET_MS);
      } finally {
        mock.timers.reset();
      }
      for (let tries = 0; isLtmAutoImportArmed(autoRoot, cutChat.id) && tries < 500; tries += 1)
        await new Promise((resolveWait) => setTimeout(resolveWait, 10));
      assert.equal(prompts.length, 1, "a later pass does not read the same text while its draft waits");
      assert.deepEqual(
        (await cutPending()).map((draft) => draft.id),
        [cutDraft!.id],
        "and the waiting draft is kept",
      );
      const restEvents = (await autoEvents(cutChat.id)).slice(cutEvents);
      assert.deepEqual(
        restEvents.map((event) => [event.status, event.counts?.waiting]),
        [["ok", 1]],
        "Retry logs once that the memories wait in Review, which clears the unfinished reading",
      );
      // Changed text is read again and replaces the draft, as before.
      cutMessages[0]!.content = "b".repeat(23_990);
      await autoImport(cutChat.id);
      assert.equal(prompts.length, 2, "changed text is read again");
      assert.equal((await draftStore.getDraft(cutDraft!.id))?.status, "superseded", "and replaces the waiting draft");
      // A manual import still reads the same text again and replaces its draft.
      const [readAgain] = await cutPending();
      const cutSourceId = (
        await previewPackageInterop({ source: "messages", chatId: cutChat.id, limit: 100 }, autoRoot)
      ).samples.find((sample) => sample.sourceId === `${cutChat.id}:messages:c1`)!.sourceId;
      await importPackageInterop(
        {
          source: "messages",
          sourceIds: [cutSourceId],
          chatId: cutChat.id,
          mode: "roleplay",
          extract: true,
          limit: 100,
        },
        autoRoot,
        new AbortController().signal,
      );
      assert.equal(prompts.length, 3, "a manual import reads the same text again");
      assert.equal((await draftStore.getDraft(readAgain!.id))?.status, "superseded", "and replaces its draft");
      // A changed reading context makes the waiting draft stale, so a background pass reads the same text again.
      const [staleDraft] = await cutPending();
      await importPackageInterop(
        {
          source: "messages",
          sourceIds: [cutSourceId],
          chatId: cutChat.id,
          mode: "roleplay",
          modes: ["roleplay", "game"],
          extract: true,
          limit: 100,
        },
        autoRoot,
        new AbortController().signal,
        { keepPendingDrafts: true },
      );
      assert.equal(prompts.length, 4, "a background pass reads text whose waiting draft went stale");
      assert.equal((await draftStore.getDraft(staleDraft!.id))?.status, "superseded", "and replaces the stale draft");
      // A background read of the same text that keeps far fewer memories than the last read waits in Review, and the
      // last read's waiting draft stays.
      const bridgeFacts = [
        "The ferry runs only at dawn.",
        "Toll keepers wear copper masks.",
        "The river smells of iron after rain.",
        "Lanterns on the east bank are green.",
        "Fishermen avoid the third pier.",
        "The old mill grinds salt, not grain.",
        "Bells ring twice when the tide turns.",
        "Every bridge stone carries a carved number.",
      ];
      const bridgeFact = (text: string, index: number) =>
        unit({ bucket: "world_fact", subjectId: `bridge_fact_${index}`, sectionKey: "facts", text });
      respond = () => bridgeFacts.map(bridgeFact);
      await importPackageInterop(
        {
          source: "messages",
          sourceIds: [cutSourceId],
          chatId: cutChat.id,
          mode: "roleplay",
          extract: true,
          limit: 100,
        },
        autoRoot,
        new AbortController().signal,
      );
      const [fullRead] = await cutPending();
      assert.equal(fullRead?.extractionOutcome?.keptUnits, 8, "the full read keeps every memory");
      respond = () => [bridgeFact(bridgeFacts[0]!, 0)];
      const shortImport = await importPackageInterop(
        {
          source: "messages",
          sourceIds: [cutSourceId],
          chatId: cutChat.id,
          mode: "roleplay",
          modes: ["roleplay", "game"],
          extract: true,
          applyLowRisk: true,
          limit: 100,
        },
        autoRoot,
        new AbortController().signal,
        { keepPendingDrafts: true },
      );
      assert.equal(prompts.length, 6, "a background pass reads the text again once the full read went stale");
      const [shortResult] = shortImport.imported;
      assert.equal(shortResult?.outcome?.keptUnits, 1);
      assert.deepEqual(shortResult?.appliedMutationIds, [], "the short read is not saved automatically");
      assert.equal(shortResult?.draft?.reviewRequired, true, "it waits in Review");
      assert.equal(shortResult?.draft?.status, "pending");
      assert.equal((await draftStore.getDraft(fullRead!.id))?.status, "pending", "the full read's draft stays");
      // A manual read keeps today's behaviour: it replaces both and needs no review.
      await importPackageInterop(
        {
          source: "messages",
          sourceIds: [cutSourceId],
          chatId: cutChat.id,
          mode: "roleplay",
          extract: true,
          limit: 100,
        },
        autoRoot,
        new AbortController().signal,
      );
      const [manualShort] = await cutPending();
      assert.equal(manualShort?.reviewRequired, false, "a manual short read needs no extra review");
      for (const id of [fullRead!.id, shortResult!.draft!.id])
        assert.equal((await draftStore.getDraft(id))?.status, "superseded", "a manual read replaces both drafts");
      // Once a full read is saved, reading the same answer again finds the saved memories: that is not a short read.
      respond = () => bridgeFacts.map(bridgeFact);
      const savedRead = await importPackageInterop(
        {
          source: "messages",
          sourceIds: [cutSourceId],
          chatId: cutChat.id,
          mode: "roleplay",
          extract: true,
          applyLowRisk: true,
          limit: 100,
        },
        autoRoot,
        new AbortController().signal,
      );
      assert.equal(savedRead.imported[0]?.appliedMutationIds.length, 8, "the full read is saved");
      const reread = await importPackageInterop(
        {
          source: "messages",
          sourceIds: [cutSourceId],
          chatId: cutChat.id,
          mode: "roleplay",
          modes: ["roleplay", "game"],
          extract: true,
          applyLowRisk: true,
          limit: 100,
        },
        autoRoot,
        new AbortController().signal,
        { keepPendingDrafts: true },
      );
      assert.equal(reread.imported[0]?.extractionStatus, "succeeded", "a changed context reads the saved text again");
      assert.ok((reread.imported[0]?.outcome?.keptUnits ?? 0) < 3, "the saved memories are not kept twice");
      assert.equal(reread.imported[0]?.draft?.reviewRequired, false, "so the re-read does not wait in Review");
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
