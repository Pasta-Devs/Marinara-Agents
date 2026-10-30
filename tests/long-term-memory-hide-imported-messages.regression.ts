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
  extra: Record<string, unknown>;
  createdAt: string;
};

// 11,000 characters: two visible messages fill a 24,000 character piece. With m2 hidden the pieces are m1 (m1, m3),
// m4 (m4, m5) and m6 (m6, then m7 once it arrives).
function message(chatId: string, id: string, extra: Record<string, unknown> = {}): FixtureMessage {
  return {
    id,
    chatId,
    role: "user",
    characterId: null,
    content: `${id} ${"x".repeat(11_000)}`,
    activeSwipeIndex: 0,
    extra,
    createdAt: "2026-10-30T00:00:00.000Z",
  };
}

const chat = {
  id: "chat-hide",
  name: "Hide",
  mode: "roleplay",
  characterIds: [] as string[],
  groupId: null,
  personaId: null,
  connectionId: null,
  metadata: { summaryTailMessages: 2 } as Record<string, unknown>,
  lastMessageAt: null,
  updatedAt: "2026-10-30T00:00:00.000Z",
};

async function main() {
  const [
    { configurePackageRuntime },
    { previewPackageInterop, importPackageInterop, hideImportedChatMessages },
    { ltmSetMessagesHiddenFromAI, readLtmHiddenMessages, showLtmHiddenMessages },
    { LongTermMemoryStorage },
    { updateLtmGlobalSettings, getLtmGlobalSettings },
  ] = await Promise.all([
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/package-runtime.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/sources/interop.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/persistence/hidden-messages.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/persistence/storage.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/settings.ts"),
  ]);

  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-hide-imported-"));
  const root = join(dataDir, "long-term-memory");
  const messages: FixtureMessage[] = ["m1", "m2", "m3", "m4", "m5", "m6"].map((id) => message(chat.id, id));
  // m2 was hidden by the summary before any import, so it is never this package's.
  messages[1]!.extra = { hiddenFromAI: true };
  const calls: Array<{ ids: string[]; hidden: boolean }> = [];
  // Mirrors the Engine: skips messages the user set by hand and returns the ids it changed.
  const setMessagesHiddenFromAI = async (chatId: string, ids: string[], hidden: boolean) => {
    if (chatId !== chat.id) throw new Error(`Chat ${chatId} was not found.`);
    calls.push({ ids, hidden });
    const changed: string[] = [];
    for (const row of messages)
      if (ids.includes(row.id) && row.extra.visibilityManual !== true && (row.extra.hiddenFromAI === true) !== hidden) {
        row.extra = { ...row.extra, hiddenFromAI: hidden };
        changed.push(row.id);
      }
    return changed;
  };
  const persistence: Record<string, unknown> = {
    async getChat(chatId: string) {
      return chatId === chat.id ? chat : chatId === "chat-broken" ? { ...chat, id: chatId } : null;
    },
    async listChats() {
      return [chat];
    },
    async listMessages(chatId: string) {
      if (chatId === "chat-broken") throw new Error("broken chat");
      return chatId === chat.id ? messages : [];
    },
  };
  let releaseRuntime: (() => void) | undefined;
  await runWithSafeCleanup(
    "Long-Term Memory hide imported messages",
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
        persistence: persistence as any,
        resources: {
          async listCharacters() {
            return [];
          },
          async listPersonas() {
            return [];
          },
          async listLorebooks() {
            return [];
          },
        },
      });
      const rows = async () =>
        (await previewPackageInterop({ source: "messages", chatId: chat.id, limit: 100 }, root)).samples.map(
          ({ sourceId, status, freshness }) => ({ sourceId, status, freshness }),
        );
      const importIds = (sourceIds: string[]) =>
        importPackageInterop(
          { source: "messages", chatId: chat.id, sourceIds, extract: true, limit: 100 },
          root,
          new AbortController().signal,
        );
      const hiddenIds = () => messages.filter((row) => row.extra.hiddenFromAI === true).map((row) => row.id);
      const owned = async () =>
        Object.values((await readLtmHiddenMessages(root))[chat.id] ?? {})
          .flat()
          .sort();

      // 8. No host method: unavailable, and an import is unchanged.
      assert.equal(ltmSetMessagesHiddenFromAI(), null, "the settings page reports the setting unavailable");
      await updateLtmGlobalSettings({ longTermMemoryHideImportedMessages: true }, root);
      await importIds(["chat-hide:messages:m1"]);
      assert.deepEqual(hiddenIds(), ["m2"], "an Engine without the method hides nothing");
      assert.deepEqual(await owned(), [], "and records nothing");
      await updateLtmGlobalSettings({ longTermMemoryHideImportedMessages: false }, root);

      persistence.setMessagesHiddenFromAI = setMessagesHiddenFromAI;
      assert.ok(ltmSetMessagesHiddenFromAI(), "an Engine with the method makes it available");

      // 1. Setting off: an import calls nothing new.
      assert.equal((await getLtmGlobalSettings(root)).longTermMemoryHideImportedMessages, false, "off by default");
      await importIds(["chat-hide:messages:m4"]);
      assert.equal(calls.length, 0, "with the setting off an import never calls the host");
      const before = await rows();

      // 2. Setting on: hides the committed pieces except the last two visible messages, and records what changed,
      // even when a later chat in the same pass fails.
      await updateLtmGlobalSettings({ longTermMemoryHideImportedMessages: true }, root);
      await assert.rejects(hideImportedChatMessages(root, [chat.id, "chat-broken"]), /broken chat/);
      assert.deepEqual(hiddenIds(), ["m1", "m2", "m3", "m4"], "the imported pieces hide, the tail m5-m6 stays");
      assert.deepEqual(await owned(), ["m1", "m3", "m4"], "the already hidden m2 is not recorded");

      // 3. Re-preview keeps the same pieces, nothing outdated, and someone else's hidden message is still skipped.
      assert.deepEqual(await rows(), before, "a re-preview after hiding returns the same pieces and freshness");
      const preview = await previewPackageInterop({ source: "messages", chatId: chat.id, limit: 100 }, root);
      assert.equal(preview.outdated?.length ?? 0, 0, "no source note is reported outdated");

      // 5. Tail drift: new messages push m5-m6 out of the tail, so the next import hides m5 and its own m6.
      messages.push(message(chat.id, "m7"), message(chat.id, "m8"));
      calls.length = 0;
      await importIds(["chat-hide:messages:m6"]);
      assert.deepEqual(hiddenIds(), ["m1", "m2", "m3", "m4", "m5", "m6"], "messages that left the tail hide");
      assert.deepEqual(calls, [{ ids: ["m5", "m6"], hidden: true }], "only the new ids are sent");

      // 6. A user's choice wins: shown by hand stays shown; hidden by hand leaves its piece.
      messages[2]!.extra = { hiddenFromAI: false, visibilityManual: true };
      await hideImportedChatMessages(root);
      assert.equal(messages[2]!.extra.hiddenFromAI, false, "a message the user showed is not hidden again");
      assert.ok(!(await owned()).includes("m3"), "and leaves the record");
      messages[3]!.extra = { hiddenFromAI: true, visibilityManual: true };
      await hideImportedChatMessages(root);
      assert.ok(!(await owned()).includes("m4"), "a message the user hid leaves the record");
      const after = await previewPackageInterop({ source: "messages", chatId: chat.id, limit: 100 }, root);
      assert.equal(
        after.samples.find((sample) => sample.sourceId === "chat-hide:messages:m4")?.freshness,
        "source_updated",
        "and leaves its piece, which shows as updated",
      );

      // 7. Archiving a piece's source note keeps its messages hidden; deleting it permanently shows them.
      const storage = new LongTermMemoryStorage(root);
      const sourceNote = (entryId: string) =>
        storage.listNotes().then((notes) => notes.find((note) => note.provenance?.entryId === entryId)!);
      const m6Note = await sourceNote("m6");
      await storage.archiveSourceNoteWithDerived(m6Note.id);
      await hideImportedChatMessages(root);
      assert.ok(hiddenIds().includes("m6"), "an archived note's messages stay hidden");
      await storage.deleteNotesPermanently([m6Note.id], {
        retractExtracted: true,
        lineageSourceNoteId: m6Note.id,
        expectedLineageNoteIds: [m6Note.id],
      });
      assert.ok(!hiddenIds().includes("m6"), "a permanently deleted note's messages show again");
      assert.deepEqual(await owned(), ["m1", "m5"], "and its record is dropped");

      // 4. Turning the setting off shows exactly the owned messages; m2 and the user's m4 stay hidden.
      await updateLtmGlobalSettings({ longTermMemoryHideImportedMessages: false }, root);
      await showLtmHiddenMessages(root);
      assert.deepEqual(hiddenIds(), ["m2", "m4"], "only the owned messages show again");
      assert.deepEqual(await readLtmHiddenMessages(root), {}, "and the record is empty");
    },
    [() => releaseRuntime?.(), () => rm(dataDir, { recursive: true, force: true })],
  );
  process.stdout.write(
    "Long-Term Memory hide imported messages regression: off by default, tail, ownership, re-preview, tail drift, manual choices, archive and delete, and missing host method ok\n",
  );
}

void runRegressionToCompletion("long-term-memory-hide-imported-messages", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
