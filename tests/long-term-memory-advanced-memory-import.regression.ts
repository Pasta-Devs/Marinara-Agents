import assert from "node:assert/strict";
import { mock } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRegressionToCompletion, runWithSafeCleanup } from "./regression-helpers.ts";

// Issue #1964: Advanced Memory scene records reach Long-Term Memory through the host's
// `listChatSummaries(chatId).advancedMemory` (Capability API 1.391). The fake host below carries that field.

function message(chatId: string, id: string, role: string, content: string) {
  return {
    id,
    chatId,
    role,
    characterId: role === "assistant" ? "character-kirei" : null,
    content,
    activeSwipeIndex: 0,
    extra: {},
    createdAt: "2026-10-31T00:00:00.000Z",
  };
}

const BLOCK = [
  "## timeline_event\nSummary: Kirei opened the Moon Vault.\nWhen: the first night",
  "## character_fact\nCharacter: kirei\nFact: Kirei keeps the vault key.",
  "## character_fact\nCharacter: Stranger\nFact: A stranger watched from the dunes.",
  "## relationship_state\nBetween: Kirei and Aster\nState: They trust each other with the vault.",
  "## relationship_state\nBetween: Kirei, Stranger\nState: Wary.",
  "## thread\nSummary: Not a recap bucket.",
  "## world_fact\nFact: The Moon Vault hums at night.",
].join("\n\n");

function scene(id: string, start: string, end: string, audience: string[], memory?: string) {
  return {
    id,
    kind: "scene",
    title: `Scene ${id}`,
    content: `Recap prose for ${id}.`,
    timeline: "Day 1",
    startMessageId: start,
    endMessageId: end,
    audienceCharacterIds: audience,
    sourceFingerprint: `fp-${id}`,
    updatedAt: "2026-10-31T00:00:00.000Z",
    ...(memory ? { memory } : {}),
  };
}

const amChat = {
  id: "chat-am",
  name: "Moon Vault",
  mode: "roleplay",
  characterIds: ["character-kirei", "character-aster"],
  groupId: null,
  personaId: null,
  connectionId: null,
  metadata: {
    summaryEntries: [{ id: "sum-1", content: "The vault opened.", rangeStartIndex: 1, rangeEndIndex: 2 }],
  },
  lastMessageAt: null,
  updatedAt: "2026-10-31T00:00:00.000Z",
};
const oldHostChat = {
  ...amChat,
  id: "chat-old-host",
  name: "Old host",
  metadata: { summaryEntries: [{ id: "old-1", content: "An older summary." }] },
};

async function main() {
  const [
    { configurePackageRuntime },
    { previewPackageInterop, importPackageInterop, advancedMemoryBackfillBatch },
    { advancedMemoryUnits },
    { advancedMemoryEchoNoteIds },
    { LongTermMemoryStorage },
    { LongTermMemoryDraftStore },
    { updateLtmExtractionConfig },
    { armLtmAutoImport, isLtmAutoImportArmed, LTM_AUTO_IMPORT_QUIET_MS },
    { ltmAdvancedMemoryBackfillRequestSchema },
  ] = await Promise.all([
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/package-runtime.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/sources/interop.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/extraction/source-processing.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/identity/chat-scope.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/persistence/storage.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/drafts/draft-store.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/extraction/extraction-config.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/sources/auto-import-job.ts"),
    import("../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts"),
  ]);

  // The block parser: four buckets, names matched case-insensitively against the chat's known names, anything else dropped.
  const known = new Map([
    ["kirei", "Kirei"],
    ["aster", "Aster"],
  ]);
  const units = advancedMemoryUnits(
    { id: "source-am", sections: { source: { evidence: ["chat:chat-am"] } } } as any,
    BLOCK,
    "hash",
    known,
  );
  assert.deepEqual(
    units.map(({ bucket, text, subjectNames, sectionKey }) => ({ bucket, text, subjectNames, sectionKey })),
    [
      {
        bucket: "timeline_event",
        text: "Kirei opened the Moon Vault. (the first night)",
        subjectNames: undefined,
        sectionKey: "event",
      },
      { bucket: "character_fact", text: "Kirei keeps the vault key.", subjectNames: ["Kirei"], sectionKey: "facts" },
      {
        bucket: "relationship_state",
        text: "They trust each other with the vault.",
        subjectNames: ["Aster", "Kirei"],
        sectionKey: "state",
      },
      { bucket: "world_fact", text: "The Moon Vault hums at night.", subjectNames: undefined, sectionKey: "facts" },
    ],
    "unknown names and buckets outside the four are dropped, never guessed",
  );

  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-advanced-memory-"));
  const root = join(dataDir, "long-term-memory");
  const chats = [amChat, oldHostChat];
  const messages = new Map([
    [
      amChat.id,
      [
        message(amChat.id, "m1", "user", "We open the vault."),
        message(amChat.id, "m2", "assistant", "The vault hums."),
        message(amChat.id, "m3", "user", "We walk into the dunes."),
        message(amChat.id, "m4", "assistant", "Sand everywhere."),
      ],
    ],
    [oldHostChat.id, [message(oldHostChat.id, "o1", "user", "Hello.")]],
  ]);
  const records = new Map<string, unknown[]>([
    [
      amChat.id,
      [
        scene("scene-1", "m1", "m2", ["character-kirei"], BLOCK),
        scene("scene-2", "m3", "m4", []),
        scene("scene-3", "m1", "m2", ["character-kirei", "character-aster"]),
        { ...scene("scene-off", "m1", "m1", []), enabled: false },
        { ...scene("chapter-1", "m1", "m4", []), kind: "chapter" },
      ],
    ],
  ]);
  const prompts: unknown[] = [];
  let releaseRuntime: (() => void) | undefined;
  await runWithSafeCleanup(
    "Long-Term Memory Advanced Memory import",
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
                prompts.push(promptMessages.at(-1)!.content);
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
            return messages.get(chatId) ?? [];
          },
          // An Engine before 1.391 returns summaries without the field; the old-host chat stands in for it.
          async listChatSummaries(chatId: string) {
            return records.has(chatId) ? { advancedMemory: records.get(chatId) } : {};
          },
        },
        resources: {
          async listCharacters() {
            return [
              { id: "character-kirei", data: { name: "Kirei" }, comment: "" },
              { id: "character-aster", data: { name: "Aster" }, comment: "" },
            ];
          },
          async listPersonas() {
            return [];
          },
          async listLorebooks() {
            return [];
          },
        },
      } as any);

      const rows = async (source: "chats" | "messages", chatId: string, extra: Record<string, unknown> = {}) =>
        (await previewPackageInterop({ source, chatId, limit: 100, ...extra } as any, root)).samples.map(
          ({ sourceId, status, freshness }) => ({ sourceId, status, freshness }),
        );

      // Switch off: today's sources, no Advanced Memory rows.
      assert.deepEqual(
        await rows("chats", amChat.id),
        [{ sourceId: "chat-am:sum-1", status: "pending", freshness: "new" }],
        "with the switch off a chat lists its summaries only",
      );
      // An earlier import of the rolling summary covers messages 1-2 for the backfill below.
      await importPackageInterop(
        { source: "chats", chatId: amChat.id, sourceIds: ["chat-am:sum-1"], extract: false, limit: 100 },
        root,
        new AbortController().signal,
      );
      assert.equal((await rows("messages", amChat.id)).length, 1, "the transcript piece lists while the switch is off");

      await updateLtmExtractionConfig(
        { useAdvancedMemory: true, autoImportChatSources: true, autoAcceptSafeChanges: true },
        root,
      );
      const switchedOn = await previewPackageInterop({ source: "chats", chatId: amChat.id, limit: 100 }, root);
      assert.deepEqual(
        switchedOn.samples.map(({ sourceId, status }) => ({ sourceId, status })),
        [
          { sourceId: "chat-am:am-scene-1", status: "pending" },
          { sourceId: "chat-am:am-scene-2", status: "pending" },
          { sourceId: "chat-am:am-scene-3", status: "pending" },
        ],
        "a chat with scene records lists only them; disabled records and other kinds are left out",
      );
      assert.equal(switchedOn.outdatedNotes?.length ?? 0, 0, "the hidden rolling summary is not reported gone");
      assert.deepEqual(await rows("messages", amChat.id), [], "a chat with scene records lists no transcript pieces");
      assert.deepEqual(
        await rows("chats", oldHostChat.id),
        [{ sourceId: "chat-old-host:old-1", status: "pending", freshness: "new" }],
        "a host without the field keeps today's summaries",
      );

      // The background job imports the recap that carries a block, with no model call; blockless recaps wait.
      const autoImport = async () => {
        mock.timers.enable({ apis: ["setTimeout"] });
        try {
          armLtmAutoImport(root, amChat.id, "roleplay");
          mock.timers.tick(LTM_AUTO_IMPORT_QUIET_MS);
        } finally {
          mock.timers.reset();
        }
        for (let tries = 0; isLtmAutoImportArmed(root, amChat.id) && tries < 500; tries += 1)
          await new Promise((resolveWait) => setTimeout(resolveWait, 10));
        assert.equal(isLtmAutoImportArmed(root, amChat.id), false, "the background run finishes");
      };
      await autoImport();
      assert.equal(prompts.length, 0, "a recap with a block is ingested without a model call");
      assert.deepEqual(
        await rows("chats", amChat.id),
        [
          { sourceId: "chat-am:am-scene-1", status: "imported", freshness: "current" },
          { sourceId: "chat-am:am-scene-2", status: "pending", freshness: "new" },
          { sourceId: "chat-am:am-scene-3", status: "pending", freshness: "new" },
        ],
        "only the recap with a block is imported in the background",
      );
      await autoImport();
      assert.equal(prompts.length, 0, "an unchanged recap changes nothing on the next reply");

      const storage = new LongTermMemoryStorage(root);
      const sourceNotes = (await storage.listNotes({ type: "source" })).filter(
        (note) => note.provenance?.kind === "advanced_memory",
      );
      assert.deepEqual(
        sourceNotes.map((note) => ({ provenance: note.provenance, characterIds: note.scope.characterIds })),
        [
          {
            provenance: { kind: "advanced_memory", sourceId: amChat.id, entryId: "scene-1" },
            characterIds: ["character-kirei"],
          },
        ],
        "the recap's audience narrows the note's characters",
      );
      const notes = await storage.listNotes();
      const texts = notes.filter((note) => note.type !== "source").map((note) => JSON.stringify(note.sections));
      for (const text of [
        "Kirei opened the Moon Vault.",
        "Kirei keeps the vault key.",
        "The Moon Vault hums at night.",
      ])
        assert.ok(
          texts.some((sections) => sections.includes(text)),
          `the block's "${text}" becomes a memory`,
        );
      // A new relationship is not a safe change, so it waits for review, linked to both characters.
      const relationship = (await new LongTermMemoryDraftStore(root).listDrafts())
        .flatMap((draft: any) => draft.mutations)
        .find((mutation: any) => mutation.kind === "create_note" && mutation.note?.type === "relationship");
      assert.ok(
        JSON.stringify(relationship?.note.sections).includes("They trust each other with the vault."),
        "the relationship entry is proposed for review",
      );
      assert.deepEqual(
        relationship.note.subjects.map((subject: any) => subject.ref.id).sort(),
        ["character-aster", "character-kirei"],
        "the relationship names both chat characters",
      );
      assert.ok(
        !JSON.stringify([...notes, relationship])
          .toLowerCase()
          .includes("stranger"),
        "an unknown name never becomes a memory",
      );

      // Echo filter: this chat's recap notes stay out of its own recall; another chat still recalls them.
      const echoes = advancedMemoryEchoNoteIds({ chatId: amChat.id, notes });
      assert.ok(echoes.has(sourceNotes[0]!.id), "the recap's source note is an echo in its own chat");
      const timeline = notes.find((note) => JSON.stringify(note.sections).includes("Kirei opened the Moon Vault."));
      assert.ok(timeline && echoes.has(timeline.id), "a memory extracted only from the recap is an echo too");
      assert.equal(advancedMemoryEchoNoteIds({ chatId: "chat-elsewhere", notes }).size, 0, "other chats recall it");

      // Backfill: scene-1 is current and scene-3's messages 1-2 are covered by the imported summary; scene-2 remains.
      const backfill = await advancedMemoryBackfillBatch(
        ltmAdvancedMemoryBackfillRequestSchema.parse({ chatId: amChat.id }),
        root,
      );
      assert.deepEqual(backfill, { sourceIds: ["chat-am:am-scene-2"], remaining: 0 });
      const extracted = await importPackageInterop(
        { source: "chats", chatId: amChat.id, sourceIds: backfill.sourceIds, extract: true, limit: 100 },
        root,
        new AbortController().signal,
      );
      assert.equal(prompts.length, 1, "a blockless recap goes through the summary extractor");
      assert.deepEqual(
        extracted.imported[0]?.note.scope.characterIds?.slice().sort(),
        ["character-aster", "character-kirei"],
        "an empty audience keeps the chat's characters",
      );
      assert.deepEqual(
        await advancedMemoryBackfillBatch(ltmAdvancedMemoryBackfillRequestSchema.parse({ chatId: amChat.id }), root),
        { sourceIds: [], remaining: 0 },
        "pressing Backfill again finds nothing left",
      );

      // A regenerated scene with a wider audience moves its note instead of failing as a destination conflict.
      records.set(amChat.id, [
        { ...scene("scene-1", "m1", "m2", ["character-kirei", "character-aster"], BLOCK), sourceFingerprint: "fp-2" },
        ...(records.get(amChat.id) ?? []).slice(1),
      ]);
      const moved = await importPackageInterop(
        { source: "chats", chatId: amChat.id, sourceIds: ["chat-am:am-scene-1"], extract: true, limit: 100 },
        root,
        new AbortController().signal,
      );
      assert.deepEqual(moved.writeFailures, [], "a changed audience is not a destination conflict");
      assert.deepEqual(
        moved.imported[0]?.note.scope.characterIds?.slice().sort(),
        ["character-aster", "character-kirei"],
        "the note follows the record's new audience",
      );
      assert.equal(prompts.length, 1, "a regenerated recap with a block still needs no model call");

      // Switch off: today's behaviour returns everywhere.
      await updateLtmExtractionConfig({ useAdvancedMemory: false }, root);
      assert.deepEqual(
        (await rows("chats", amChat.id)).map(({ sourceId }) => sourceId),
        ["chat-am:sum-1"],
        "with the switch off again the scene records are not listed",
      );
      assert.deepEqual(
        await advancedMemoryBackfillBatch(ltmAdvancedMemoryBackfillRequestSchema.parse({ chatId: amChat.id }), root),
        { sourceIds: [], remaining: 0 },
        "Backfill does nothing with the switch off",
      );
    },
    [() => releaseRuntime?.(), () => rm(dataDir, { recursive: true, force: true })],
  );
  process.stdout.write(
    "Long-Term Memory Advanced Memory import regression: block parse, precedence, audience scope, background import, echo filter, backfill skip and switch-off ok\n",
  );
}

void runRegressionToCompletion("long-term-memory-advanced-memory-import", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
