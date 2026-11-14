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
// A parent whose pieces p1 (p1, p2), p3 (p3, p4) and p5 (p5, p6) are all hidden, and its branch forked at p5.
const parentChat = { ...chat, id: "chat-hide-parent", name: "Hide parent", metadata: { summaryTailMessages: 0 } };
const branchChat = {
  ...chat,
  id: "chat-hide-branch",
  name: "Hide branch",
  metadata: {
    summaryTailMessages: 0,
    branchParentChatId: parentChat.id,
    branchParentMessageId: "p5",
    branchMessageId: "b5",
  },
};

async function main() {
  const [
    { configurePackageRuntime },
    {
      previewPackageInterop,
      importPackageInterop,
      hideImportedChatMessages,
      hideImportedMessagesAfterReview,
      readLtmMessagesJustHidden,
      hideBranchCopiesOnce,
      hideBranchCopiesWhenBranched,
      branchHandHiddenTail,
    },
    { ltmSetMessagesHiddenFromAI, readLtmHiddenMessages, showLtmHiddenMessages, writeLtmHiddenMessages },
    { LongTermMemoryStorage },
    { updateLtmGlobalSettings, getLtmGlobalSettings },
    { LongTermMemoryDraftStore },
  ] = await Promise.all([
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/package-runtime.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/sources/interop.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/persistence/hidden-messages.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/persistence/storage.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/settings.ts"),
    import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/drafts/draft-store.ts"),
  ]);

  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-hide-imported-"));
  const root = join(dataDir, "long-term-memory");
  const messages: FixtureMessage[] = ["m1", "m2", "m3", "m4", "m5", "m6"].map((id) => message(chat.id, id));
  // m2 was hidden by the summary before any import, so it is never this package's.
  messages[1]!.extra = { hiddenFromAI: true };
  const calls: Array<{ ids: string[]; hidden: boolean }> = [];
  const chats: Array<typeof chat> = [chat],
    messagesByChat = new Map([[chat.id, messages]]);
  // Mirrors the Engine: skips messages the user set by hand and returns the ids it changed.
  const setMessagesHiddenFromAI = async (chatId: string, ids: string[], hidden: boolean) => {
    const rows = messagesByChat.get(chatId);
    if (!rows) throw new Error(`Chat ${chatId} was not found.`);
    calls.push({ ids, hidden });
    const changed: string[] = [];
    for (const row of rows)
      if (ids.includes(row.id) && row.extra.visibilityManual !== true && (row.extra.hiddenFromAI === true) !== hidden) {
        row.extra = { ...row.extra, hiddenFromAI: hidden };
        changed.push(row.id);
      }
    return changed;
  };
  const persistence: Record<string, unknown> = {
    async getChat(chatId: string) {
      return chats.find((row) => row.id === chatId) ?? (chatId === "chat-broken" ? { ...chat, id: chatId } : null);
    },
    async listChats() {
      return chats;
    },
    async listMessages(chatId: string) {
      if (chatId === "chat-broken") throw new Error("broken chat");
      return messagesByChat.get(chatId) ?? [];
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
      // The chat card says which messages an import just hid: positions of the changed ids, not of the already hidden m2.
      assert.equal(readLtmMessagesJustHidden(root, "chat-never-hidden"), null);
      const justHidden = readLtmMessagesJustHidden(root, chat.id);
      assert.deepEqual({ from: justHidden?.from, to: justHidden?.to }, { from: 1, to: 4 });
      assert.ok(Number.isFinite(Date.parse(justHidden?.at ?? "")), "and when");

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
      assert.deepEqual(
        { ...readLtmMessagesJustHidden(root, chat.id), at: undefined },
        { from: 5, to: 6, at: undefined },
        "the next hide replaces the last one",
      );

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

      // 9. A piece with suggestions waiting in review stays visible until they are accepted, skipped or deleted.
      // Two new messages close the m7 piece (m7, m8); importing it with the setting off then turning it on mirrors
      // an import whose extraction left a pending draft.
      messages.push(message(chat.id, "m9"), message(chat.id, "m10"));
      await updateLtmGlobalSettings({ longTermMemoryHideImportedMessages: false }, root);
      await importIds(["chat-hide:messages:m7"]);
      await updateLtmGlobalSettings({ longTermMemoryHideImportedMessages: true }, root);
      const reviewNote = await sourceNote("m7");
      const draftStore = new LongTermMemoryDraftStore(root);
      const reviewDraft = await draftStore.createDraft({
        source: { sourceNoteId: reviewNote.id, chatId: chat.id },
        modes: ["roleplay"],
        response: {
          summary: "One suggestion waiting in review.",
          mutations: [
            {
              id: "00000000-0000-4000-8000-000000000009",
              kind: "add_link",
              claimKind: "static",
              risk: "medium",
              confidence: 0.9,
              summary: "Link the piece",
              evidence: [`source_note:${reviewNote.id}`],
              noteId: "world_lantern_house",
              link: { target: "timeline_harbor_closing", relation: "evidenced_by" },
            },
          ],
        } as never,
      });
      await hideImportedChatMessages(root);
      assert.ok(!hiddenIds().includes("m7"), "a piece waiting in review keeps its messages visible");
      await draftStore.deleteDraft(reviewDraft.id);
      await hideImportedMessagesAfterReview(root, reviewNote.id);
      assert.ok(hiddenIds().includes("m7") && hiddenIds().includes("m8"), "once the review is done its messages hide");
      assert.ok(!hiddenIds().includes("m9") && !hiddenIds().includes("m10"), "the latest messages stay visible");

      // 10. A branch takes over its copies of what the parent hid. The parent hides its three pieces; the branch copies
      // p1-p5 hidden under new ids, and the user hid the copy b3 by hand. The copies of the shared pieces p1 and p3
      // are recorded under the branch and the parent's source notes; b5, of the piece p5-p6 that crosses the fork,
      // shows again, and the adopted copies stay out of the branch's own pieces.
      const parentMessages = ["p1", "p2", "p3", "p4", "p5", "p6"].map((id, index) => ({
        ...message(parentChat.id, id),
        createdAt: `2026-10-31T00:00:0${index}.000Z`,
      }));
      chats.push(parentChat);
      messagesByChat.set(parentChat.id, parentMessages);
      await importPackageInterop(
        {
          source: "messages",
          chatId: parentChat.id,
          sourceIds: ["p1", "p3", "p5"].map((id) => `${parentChat.id}:messages:${id}`),
          extract: true,
          limit: 100,
        },
        root,
        new AbortController().signal,
      );
      assert.ok(
        parentMessages.every((row) => row.extra.hiddenFromAI === true),
        "the parent hides all of its pieces",
      );
      const branchMessages = parentMessages.slice(0, 5).map((row, index) => ({
        ...row,
        id: `b${index + 1}`,
        chatId: branchChat.id,
        extra: index === 2 ? { hiddenFromAI: true, visibilityManual: true } : { ...row.extra },
      }));
      chats.push(branchChat);
      messagesByChat.set(branchChat.id, branchMessages);
      const branchHiddenIds = () =>
        branchMessages.filter((row) => row.extra.hiddenFromAI === true).map((row) => row.id);
      const [p1Note, p3Note] = await Promise.all([sourceNote("p1"), sourceNote("p3")]);
      await hideImportedChatMessages(root, [branchChat.id]);
      await hideImportedChatMessages(root, [branchChat.id]);
      assert.deepEqual(
        (await readLtmHiddenMessages(root))[branchChat.id],
        { [p1Note.id]: ["b1", "b2"], [p3Note.id]: ["b4"] },
        "the copies of the shared pieces are recorded under the parent's source notes, once",
      );
      assert.deepEqual(branchHiddenIds(), ["b1", "b2", "b3", "b4"], "b5 shows again and the hand-hidden b3 stays");
      const branchPreview = await previewPackageInterop(
        { source: "messages", chatId: branchChat.id, limit: 100 },
        root,
      );
      assert.deepEqual(
        branchPreview.samples.map(({ messageRange }) => [messageRange?.first, messageRange?.last]),
        [[5, 5]],
        "the branch's own pieces leave out the adopted copies",
      );
      // Once the branch imports b5 it hides it under its own note, and a later pass keeps it so.
      await importPackageInterop(
        {
          source: "messages",
          chatId: branchChat.id,
          sourceIds: [`${branchChat.id}:messages:b5`],
          extract: true,
          limit: 100,
        },
        root,
        new AbortController().signal,
      );
      await hideImportedChatMessages(root, [branchChat.id]);
      const b5Note = await sourceNote("b5");
      assert.deepEqual(
        (await readLtmHiddenMessages(root))[branchChat.id],
        { [p1Note.id]: ["b1", "b2"], [p3Note.id]: ["b4"], [b5Note.id]: ["b5"] },
        "the branch's own piece is recorded under its own note, once",
      );
      assert.deepEqual(branchHiddenIds(), ["b1", "b2", "b3", "b4", "b5"], "b5 hides under the branch's note");
      // The branch keeps its own last messages visible, though its copies arrived hidden. With a tail of 2 its first
      // recall shows b4 and b5 (the hand-hidden b3 does not count). Two new messages push them out again: b4 hides
      // under the parent's note and b5 under the branch's. b6 is long enough to start its own piece.
      branchChat.metadata.summaryTailMessages = 2;
      await hideBranchCopiesOnce(root, branchChat);
      assert.deepEqual(branchHiddenIds(), ["b1", "b2", "b3"], "the branch's tail shows its last two messages");
      assert.deepEqual(
        (await readLtmHiddenMessages(root))[branchChat.id],
        { [p1Note.id]: ["b1", "b2"] },
        "and they leave the record",
      );
      branchMessages.push(
        { ...message(branchChat.id, "b6"), content: `b6 ${"x".repeat(13_000)}`, createdAt: "2026-10-31T00:00:06.000Z" },
        { ...message(branchChat.id, "b7"), createdAt: "2026-10-31T00:00:07.000Z" },
      );
      await hideImportedChatMessages(root);
      assert.deepEqual(branchHiddenIds(), ["b1", "b2", "b3", "b4", "b5"], "b4 and b5 hide again once b6 and b7 follow");
      assert.deepEqual(
        (await readLtmHiddenMessages(root))[branchChat.id],
        { [p1Note.id]: ["b1", "b2"], [p3Note.id]: ["b4"], [b5Note.id]: ["b5"] },
        "each under the note it hid for",
      );
      assert.ok(
        parentMessages.every((row) => row.extra.hiddenFromAI === true),
        "the parent keeps all of its pieces hidden",
      );

      // 11. The Engine's branch hook: a new branch shows its tail before any recall, then a later pass changes nothing,
      // and an unknown chat or a chat that is no branch does nothing.
      const hookBranch = {
        ...branchChat,
        id: "chat-hide-hook-branch",
        name: "Hide hook branch",
        metadata: { ...branchChat.metadata, summaryTailMessages: 2 },
      };
      const hookMessages = parentMessages.slice(0, 5).map((row, index) => ({
        ...row,
        id: `h${index + 1}`,
        chatId: hookBranch.id,
        extra: { ...row.extra },
      }));
      chats.push(hookBranch);
      messagesByChat.set(hookBranch.id, hookMessages);
      const hookHiddenIds = () => hookMessages.filter((row) => row.extra.hiddenFromAI === true).map((row) => row.id);
      assert.deepEqual(
        hookHiddenIds(),
        ["h1", "h2", "h3", "h4", "h5"],
        "the new branch arrives with every copy hidden",
      );
      await hideBranchCopiesWhenBranched(root, hookBranch.id);
      assert.deepEqual(hookHiddenIds(), ["h1", "h2", "h3"], "the hook shows the branch's last two messages");
      const afterHook = JSON.stringify(await readLtmHiddenMessages(root));
      // A pass that ran again would hide h3 once more, so showing it proves the once-per-branch guard.
      hookMessages[2].extra.hiddenFromAI = false;
      await hideBranchCopiesOnce(root, hookBranch);
      await hideBranchCopiesWhenBranched(root, hookBranch.id);
      assert.deepEqual(hookHiddenIds(), ["h1", "h2"], "the first recall after the hook does not run the pass again");
      assert.equal(JSON.stringify(await readLtmHiddenMessages(root)), afterHook, "and the record stays as it was");
      const hiddenBefore = JSON.stringify([...messagesByChat.values()].map((rows) => rows.map((row) => row.extra)));
      await hideBranchCopiesWhenBranched(root, "chat-that-does-not-exist");
      await hideBranchCopiesWhenBranched(root, chat.id);
      assert.equal(
        JSON.stringify([...messagesByChat.values()].map((rows) => rows.map((row) => row.extra))),
        hiddenBefore,
        "an unknown chat and a chat with no parent change nothing",
      );

      // 12. Chat Settings' offer: a branch's latest copies hidden by hand in its parent too, past the pieces it shares.
      // With p4 and p5 hidden by hand and a tail of 3, x4 is covered by the shared piece p3-p4 and x5 is not (p5-p6
      // crosses the fork); x3 was hidden by this package, not by hand.
      const handBranch = {
        ...branchChat,
        id: "chat-hide-hand-branch",
        metadata: { ...branchChat.metadata, summaryTailMessages: 3, branchMessageId: "x5" },
      };
      const parentExtras = parentMessages.map((row) => ({ ...row.extra }));
      for (const index of [3, 4]) parentMessages[index]!.extra = { hiddenFromAI: true, visibilityManual: true };
      messagesByChat.set(
        handBranch.id,
        parentMessages.slice(0, 5).map((row, index) => ({
          ...row,
          id: `x${index + 1}`,
          chatId: handBranch.id,
          extra: { ...row.extra },
        })),
      );
      assert.deepEqual(await branchHandHiddenTail(root, handBranch), ["x5"], "only the uncovered hand-hidden copy");
      assert.deepEqual(
        await branchHandHiddenTail(root, {
          ...handBranch,
          metadata: { ...handBranch.metadata, summaryTailMessages: 0 },
        }),
        [],
        "a tail of 0 keeps none visible, so nothing is offered",
      );
      // A chat without its own tail uses Memory Settings' tail; the chat's own value wins when set.
      const { summaryTailMessages: _ownTail, ...noOwnTail } = handBranch.metadata;
      await updateLtmGlobalSettings({ longTermMemoryHideTailMessages: 0 }, root);
      assert.deepEqual(
        await branchHandHiddenTail(root, { ...handBranch, metadata: noOwnTail }),
        [],
        "the global tail of 0 applies when the chat has none",
      );
      assert.deepEqual(await branchHandHiddenTail(root, handBranch), ["x5"], "the chat's own tail of 3 wins over it");
      await updateLtmGlobalSettings({ longTermMemoryHideTailMessages: 3 }, root);
      assert.deepEqual(
        await branchHandHiddenTail(root, { ...handBranch, metadata: noOwnTail }),
        ["x5"],
        "the global tail of 3 applies too",
      );
      await updateLtmGlobalSettings({ longTermMemoryHideTailMessages: 10 }, root);
      parentMessages[4]!.extra = { hiddenFromAI: true };
      assert.deepEqual(await branchHandHiddenTail(root, handBranch), [], "a hand hide made only in the branch stays");
      parentExtras.forEach((extra, index) => (parentMessages[index]!.extra = extra));
      messagesByChat.delete(handBranch.id);

      // 13. A branch of a branch. A records four pieces (a1-a2, a3-a4, a5-a6, a7-a8) hidden; someone else hid a2, so the
      // record lacks it. B was forked at a8 before any pass (its copies arrived hidden, no record), and C forked from B
      // at q5 (c1-c5, with c3 hidden by hand). C's pass reads A's record through B (no record, so not passed): c1 and c4 are recorded under A's
      // notes, c2 (not in A's record) and c3 (by hand) stay hidden and unrecorded, and c5 (piece a5-a6 crosses the
      // fork) shows.
      const aChat = { ...chat, id: "chat-hide-a", name: "Hide a", metadata: { summaryTailMessages: 0 } };
      const aMessages = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"].map((id, index) => ({
        ...message(aChat.id, id),
        createdAt: `2026-11-01T00:00:0${index}.000Z`,
      }));
      chats.push(aChat);
      messagesByChat.set(aChat.id, aMessages);
      await importPackageInterop(
        {
          source: "messages",
          chatId: aChat.id,
          sourceIds: ["a1", "a3", "a5", "a7"].map((id) => `${aChat.id}:messages:${id}`),
          extract: true,
          limit: 100,
        },
        root,
        new AbortController().signal,
      );
      assert.ok(
        aMessages.every((row) => row.extra.hiddenFromAI === true),
        "A hides all of its pieces",
      );
      const [aNote1, aNote2, aNote3] = await Promise.all([sourceNote("a1"), sourceNote("a3"), sourceNote("a5")]);
      const aRecord = (await readLtmHiddenMessages(root))[aChat.id]!;
      await writeLtmHiddenMessages(
        {
          ...(await readLtmHiddenMessages(root)),
          [aChat.id]: { ...aRecord, [aNote1.id]: aRecord[aNote1.id]!.filter((id) => id !== "a2") },
        },
        root,
      );
      const copyChat = (from: typeof aChat, id: string, prefix: string, count: number, forkId: string) => {
        const next = {
          ...from,
          id,
          name: id,
          metadata: {
            summaryTailMessages: 0,
            branchParentChatId: from.id,
            branchParentMessageId: forkId,
            branchMessageId: `${prefix}${count}`,
          },
        };
        const rows = messagesByChat
          .get(from.id)!
          .slice(0, count)
          .map((row, index) => ({
            ...row,
            id: `${prefix}${index + 1}`,
            chatId: id,
            extra: { ...row.extra },
          }));
        chats.push(next as never);
        messagesByChat.set(id, rows);
        return {
          chat: next,
          rows,
          hidden: () => rows.filter((row) => row.extra.hiddenFromAI === true).map((row) => row.id),
        };
      };
      const bBranch = copyChat(aChat, "chat-hide-b", "q", 8, "a8");
      const cBranch = copyChat(bBranch.chat as never, "chat-hide-c", "c", 5, "q5");
      cBranch.rows[2]!.extra = { hiddenFromAI: true, visibilityManual: true };
      assert.deepEqual(cBranch.hidden(), ["c1", "c2", "c3", "c4", "c5"], "C arrives with every copy hidden");
      assert.equal((await readLtmHiddenMessages(root))[bBranch.chat.id], undefined, "B has no record");
      await hideBranchCopiesOnce(root, cBranch.chat);
      assert.deepEqual(
        (await readLtmHiddenMessages(root))[cBranch.chat.id],
        { [aNote1.id]: ["c1"], [aNote2.id]: ["c4"] },
        "C records its copies of A's shared pieces under A's notes, though B has no record",
      );
      assert.deepEqual(cBranch.hidden(), ["c1", "c2", "c3", "c4"], "c5 of the piece crossing the fork shows");
      // A full pass reaches the grandchildren of a recorded chat: B heals from A, and a new branch D of B (forked at
      // q4, copies hidden) takes over from B, the nearest record. A second pass changes nothing.
      const dBranch = copyChat(bBranch.chat as never, "chat-hide-d", "d", 4, "q4");
      await hideImportedChatMessages(root);
      const afterFull = JSON.stringify(await readLtmHiddenMessages(root));
      const full = await readLtmHiddenMessages(root);
      assert.deepEqual(
        full[bBranch.chat.id],
        {
          [aNote1.id]: ["q1"],
          [aNote2.id]: ["q3", "q4"],
          [aNote3.id]: ["q5", "q6"],
          [(await sourceNote("a7")).id]: ["q7", "q8"],
        },
        "a full pass records B's copies of everything A recorded",
      );
      assert.deepEqual(full[dBranch.chat.id], { [aNote1.id]: ["d1"], [aNote2.id]: ["d3", "d4"] }, "and D's too");
      assert.deepEqual(full[cBranch.chat.id], { [aNote1.id]: ["c1"], [aNote2.id]: ["c4"] }, "C is as it was");
      assert.deepEqual(dBranch.hidden(), ["d1", "d2", "d3", "d4"], "d2 stays hidden, as only A's record lacks a2");
      await hideImportedChatMessages(root);
      assert.equal(JSON.stringify(await readLtmHiddenMessages(root)), afterFull, "a second full pass changes nothing");
      // The nearest record decides: B's pass left q4 out of its record (say the Engine's summary hid it again), so a
      // branch E of B at q4 keeps its hidden e4 unrecorded, though A's record still lists a4.
      const fullNow = await readLtmHiddenMessages(root);
      await writeLtmHiddenMessages(
        { ...fullNow, [bBranch.chat.id]: { ...fullNow[bBranch.chat.id]!, [aNote2.id]: ["q3"] } },
        root,
      );
      const eBranch = copyChat(bBranch.chat as never, "chat-hide-e", "e", 4, "q4");
      // (A pass for E alone: `hideBranchCopiesOnce` runs B's pass first, which would adopt q4 from A again.)
      await hideImportedChatMessages(root, [eBranch.chat.id]);
      assert.deepEqual(
        (await readLtmHiddenMessages(root))[eBranch.chat.id],
        { [aNote1.id]: ["e1"], [aNote2.id]: ["e3"] },
        "E reads B's record, not A's behind it",
      );
      assert.deepEqual(eBranch.hidden(), ["e1", "e2", "e3", "e4"], "e4 stays hidden and unrecorded");

      // A chain whose middle records an older build wrote: A (record) -> B (no record) -> C -> D, where C and D each
      // passed under the old parent-only code, so their records hold only their own piece. A pass for D must run the
      // passes of A, B and C first, oldest first, or it reads C's own-only record and heals nothing.
      const oldBuildFamily = async (p: string) => {
        const fA = { ...chat, id: `chat-hide-${p}a`, name: `Hide ${p}a`, metadata: { summaryTailMessages: 0 } };
        const fAMessages = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
          ...message(fA.id, `${p}a${n}`),
          createdAt: `2026-11-02T00:00:0${n}.000Z`,
        }));
        chats.push(fA);
        messagesByChat.set(fA.id, fAMessages);
        await importPackageInterop(
          {
            source: "messages",
            chatId: fA.id,
            sourceIds: [1, 3, 5, 7].map((n) => `${fA.id}:messages:${p}a${n}`),
            extract: true,
            limit: 100,
          },
          root,
          new AbortController().signal,
        );
        const notes = await Promise.all([1, 3, 5].map((n) => sourceNote(`${p}a${n}`)));
        const fB = copyChat(fA, `chat-hide-${p}b`, `${p}b`, 8, `${p}a8`);
        // C and D each have two messages of their own after their copies, and a record of only that piece.
        const withOwnPiece = async (
          from: { chat: any; rows: FixtureMessage[] },
          id: string,
          prefix: string,
          forkId: string,
        ) => {
          const next = copyChat(from.chat, id, prefix, 6, forkId);
          next.rows.push(
            ...[7, 8].map((n) => ({ ...message(id, `${prefix}${n}`), createdAt: `2026-11-03T00:00:0${n}.000Z` })),
          );
          await importPackageInterop(
            { source: "messages", chatId: id, sourceIds: [`${id}:messages:${prefix}7`], extract: true, limit: 100 },
            root,
            new AbortController().signal,
          );
          const own = await sourceNote(`${prefix}7`),
            all = await readLtmHiddenMessages(root);
          assert.deepEqual(all[id]?.[own.id], [`${prefix}7`, `${prefix}8`], "the chat hides its own piece");
          await writeLtmHiddenMessages({ ...all, [id]: { [own.id]: all[id]![own.id]! } }, root);
          for (const row of next.rows.slice(0, 6)) row.extra = { hiddenFromAI: true };
          return { ...next, own };
        };
        const fC = await withOwnPiece(fB, `chat-hide-${p}c`, `${p}c`, `${p}b6`);
        const fD = await withOwnPiece(fC, `chat-hide-${p}d`, `${p}d`, `${p}c6`);
        const ids = (prefix: string, a: number, b: number) => [a, b].map((n) => `${prefix}${n}`);
        assert.deepEqual(
          (await readLtmHiddenMessages(root))[fD.chat.id],
          { [fD.own.id]: [`${p}d7`, `${p}d8`] },
          "D's record holds only its own piece, as an older build left it",
        );
        const healed = (prefix: string, own?: { id: string }) => ({
          ...(own ? { [own.id]: ids(prefix, 7, 8) } : {}),
          [notes[0]!.id]: ids(prefix, 1, 2),
          [notes[1]!.id]: ids(prefix, 3, 4),
          [notes[2]!.id]: ids(prefix, 5, 6),
        });
        const expectHealed = async (message: string, passesB: boolean) => {
          const record = await readLtmHiddenMessages(root);
          // B has no record, so a branch's pass reads through it to A and never runs B's own first pass (which would
          // show B's tail before its branches read what B hid); a full pass runs it.
          if (passesB)
            assert.deepEqual(
              record[fB.chat.id],
              { ...healed(`${p}b`), [(await sourceNote(`${p}a7`)).id]: ids(`${p}b`, 7, 8) },
              `${message}: B adopts from A`,
            );
          else assert.equal(record[fB.chat.id], undefined, `${message}: B is read through, not passed`);
          assert.deepEqual(record[fC.chat.id], healed(`${p}c`, fC.own), `${message}: C adopts from A through B`);
          assert.deepEqual(record[fD.chat.id], healed(`${p}d`, fD.own), `${message}: D adopts from C`);
          assert.deepEqual(
            fD.hidden().slice(0, 6),
            fD.rows.slice(0, 6).map((row) => row.id),
            `${message}: D's copies stay hidden`,
          );
        };
        return { fA, fB, fC, fD, expectHealed };
      };
      const oneBranch = await oldBuildFamily("f");
      await hideBranchCopiesOnce(root, oneBranch.fD.chat);
      await oneBranch.expectHealed("a pass for D alone", false);
      // A full pass heals in one go, B included. The order is not set here: `wanted` follows the vault scan, which
      // lists G's pieces by their hashed note ids and puts gD's before gC's, so only the depth sort puts gC first.
      const fullFamily = await oldBuildFamily("g");
      await hideImportedChatMessages(root);
      await fullFamily.expectHealed("a single full pass", true);

      // A copy the nearest record no longer lists can still be one its ancestor showed itself after the branch copied
      // it hidden. A (record, pieces 1-2, 3-4, 5-6, 7-8, all hidden) -> B (own record of the first three pieces, copies
      // of 7 and 8 set per case) -> C (copies of B, 7 and 8 hidden).
      const walkBase = async (p: string, copies: number, bExtra: Record<string, unknown>[]) => {
        const wA = { ...chat, id: `chat-hide-${p}a`, name: `Hide ${p}a`, metadata: { summaryTailMessages: 0 } };
        chats.push(wA);
        messagesByChat.set(
          wA.id,
          [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
            ...message(wA.id, `${p}a${n}`),
            createdAt: `2026-11-04T00:00:0${n}.000Z`,
          })),
        );
        await importPackageInterop(
          {
            source: "messages",
            chatId: wA.id,
            sourceIds: [1, 3, 5, 7].map((n) => `${wA.id}:messages:${p}a${n}`),
            extract: true,
            limit: 100,
          },
          root,
          new AbortController().signal,
        );
        const notes = await Promise.all([1, 3, 5, 7].map((n) => sourceNote(`${p}a${n}`)));
        const wB = copyChat(wA, `chat-hide-${p}b`, `${p}b`, copies, `${p}a${copies}`);
        wB.rows.slice(6).forEach((row, index) => (row.extra = bExtra[index] ?? {}));
        const firstThree = (prefix: string) => ({
          [notes[0]!.id]: [`${prefix}1`, `${prefix}2`],
          [notes[1]!.id]: [`${prefix}3`, `${prefix}4`],
          [notes[2]!.id]: [`${prefix}5`, `${prefix}6`],
        });
        const record = async (id: string, prefix: string) =>
          writeLtmHiddenMessages({ ...(await readLtmHiddenMessages(root)), [id]: firstThree(prefix) }, root);
        await record(wB.chat.id, `${p}b`);
        return { notes, wB, firstThree, record };
      };
      const hiddenOf = (rows: FixtureMessage[]) =>
        rows.filter((row) => row.extra.hiddenFromAI === true).map((row) => row.id);
      // (a) Tail release: B showed 7 and 8 (and dropped them from its record) before C was branched while they were hidden.
      const tailBase = await walkBase("t", 8, [{}, {}]);
      const tailC = copyChat(tailBase.wB.chat as never, "chat-hide-tc", "tc", 8, "tb8");
      tailC.rows.slice(6).forEach((row) => (row.extra = { hiddenFromAI: true }));
      await hideImportedChatMessages(root, [tailC.chat.id]);
      assert.deepEqual(
        (await readLtmHiddenMessages(root))[tailC.chat.id],
        { ...tailBase.firstThree("tc"), [tailBase.notes[3]!.id]: ["tc7", "tc8"] },
        "C adopts the copies B showed under A's note, reading past B's visible copies",
      );
      assert.equal(hiddenOf(tailC.rows).length, 8, "and they stay hidden");
      // With a tail of 2 the adopted 7 and 8 are the ones that show, not the older 5 and 6 a stuck copy would push in.
      tailC.chat.metadata = { ...tailC.chat.metadata, summaryTailMessages: 2 };
      await hideImportedChatMessages(root, [tailC.chat.id]);
      assert.deepEqual(hiddenOf(tailC.rows), ["tc1", "tc2", "tc3", "tc4", "tc5", "tc6"], "C's tail counts them");
      // (Cases b and c pass for C alone: `hideBranchCopiesOnce` would run B's pass first, which adopts B's hidden copies from A.)
      // (b) Safety: B's copies are hidden and unrecorded (the Engine hid them again), so someone else owns them.
      const keepBase = await walkBase("k", 8, [{ hiddenFromAI: true }, { hiddenFromAI: true }]);
      const keepC = copyChat(keepBase.wB.chat as never, "chat-hide-kc", "kc", 8, "kb8");
      await hideImportedChatMessages(root, [keepC.chat.id]);
      assert.deepEqual(
        (await readLtmHiddenMessages(root))[keepC.chat.id],
        keepBase.firstThree("kc"),
        "a hidden copy in B stops the walk: C records only what B's record lists",
      );
      assert.equal(hiddenOf(keepC.rows).length, 8, "kc7 and kc8 stay hidden");
      // (c) Hand-set copies are never touched, in B (hidden or shown) or in C.
      const handBase = await walkBase("h", 8, [
        { hiddenFromAI: true, visibilityManual: true },
        { hiddenFromAI: false, visibilityManual: true },
      ]);
      const handC = copyChat(handBase.wB.chat as never, "chat-hide-hc", "hc", 8, "hb8");
      handC.rows.slice(6).forEach((row) => (row.extra = { hiddenFromAI: true }));
      await hideImportedChatMessages(root, [handC.chat.id]);
      assert.deepEqual(
        (await readLtmHiddenMessages(root))[handC.chat.id],
        handBase.firstThree("hc"),
        "B's hand-set copies stop the walk",
      );
      assert.equal(hiddenOf(handC.rows).length, 8, "hc7 and hc8 stay hidden");
      const ownBase = await walkBase("o", 8, [{}, {}]);
      const ownC = copyChat(ownBase.wB.chat as never, "chat-hide-oc", "oc", 8, "ob8");
      ownC.rows[6]!.extra = { hiddenFromAI: true, visibilityManual: true };
      ownC.rows[7]!.extra = { hiddenFromAI: false, visibilityManual: true };
      await hideImportedChatMessages(root, [ownC.chat.id]);
      assert.deepEqual(
        hiddenOf(ownC.rows),
        ["oc1", "oc2", "oc3", "oc4", "oc5", "oc6", "oc7"],
        "C's hand-set copies stay",
      );
      assert.deepEqual((await readLtmHiddenMessages(root))[ownC.chat.id], ownBase.firstThree("oc"), "and unrecorded");
      // (e) Visible copies: B showed 7 and 8 as its tail and dropped them from its record, and C was branched from B
      // with them visible. C's pass offers them from A's record, read past B's visible copies, so they hide again
      // under A's note once the tail no longer covers them.
      const seenBase = await walkBase("v", 8, [{}, {}]);
      const seenC = copyChat(seenBase.wB.chat as never, "chat-hide-vc", "vc", 8, "vb8");
      await hideImportedChatMessages(root, [seenC.chat.id]);
      assert.deepEqual(
        (await readLtmHiddenMessages(root))[seenC.chat.id],
        { ...seenBase.firstThree("vc"), [seenBase.notes[3]!.id]: ["vc7", "vc8"] },
        "C records the copies B showed under A's note",
      );
      assert.equal(hiddenOf(seenC.rows).length, 8, "and hides them");
      // A hand-shown copy in B stops the walk for that position only.
      const shownBase = await walkBase("w", 8, [{ hiddenFromAI: false, visibilityManual: true }, {}]);
      const shownC = copyChat(shownBase.wB.chat as never, "chat-hide-wc", "wc", 8, "wb8");
      shownC.rows.slice(6).forEach((row) => (row.extra = {}));
      await hideImportedChatMessages(root, [shownC.chat.id]);
      assert.deepEqual(
        (await readLtmHiddenMessages(root))[shownC.chat.id],
        { ...shownBase.firstThree("wc"), [shownBase.notes[3]!.id]: ["wc8"] },
        "only the copy B did not set by hand is offered",
      );
      assert.deepEqual(hiddenOf(shownC.rows), [..."123456"].map((n) => `wc${n}`).concat("wc8"), "wc7 stays visible");
      // Inside C's own tail the copies stay visible.
      const tailSeenBase = await walkBase("y", 8, [{}, {}]);
      const tailSeenC = copyChat(tailSeenBase.wB.chat as never, "chat-hide-yc", "yc", 8, "yb8");
      tailSeenC.chat.metadata = { ...tailSeenC.chat.metadata, summaryTailMessages: 2 };
      await hideImportedChatMessages(root, [tailSeenC.chat.id]);
      assert.deepEqual(
        (await readLtmHiddenMessages(root))[tailSeenC.chat.id],
        tailSeenBase.firstThree("yc"),
        "a copy in C's tail is not recorded",
      );
      assert.deepEqual(
        hiddenOf(tailSeenC.rows),
        [..."123456"].map((n) => `yc${n}`),
        "and stays visible",
      );
      // (d) Crossing show: A's last piece (7-8) crosses the fork at 7. B showed its copy 7 itself; C (of B) and D (of C)
      // were copied while it was hidden, and each holds an older build's record of the first three pieces. One pass for
      // D's chain shows it in C and then in D.
      const crossBase = await walkBase("x", 7, [{}]);
      const crossC = copyChat(crossBase.wB.chat as never, "chat-hide-xc", "xc", 7, "xb7");
      crossC.rows[6]!.extra = { hiddenFromAI: true };
      const crossD = copyChat(crossC.chat as never, "chat-hide-xd", "xd", 7, "xc7");
      await crossBase.record(crossC.chat.id, "xc");
      await crossBase.record(crossD.chat.id, "xd");
      await hideBranchCopiesOnce(root, crossD.chat);
      assert.deepEqual(hiddenOf(crossC.rows), ["xc1", "xc2", "xc3", "xc4", "xc5", "xc6"], "C shows its copy of 7");
      assert.deepEqual(hiddenOf(crossD.rows), ["xd1", "xd2", "xd3", "xd4", "xd5", "xd6"], "and so does D");
      assert.deepEqual(
        (await readLtmHiddenMessages(root))[crossD.chat.id],
        crossBase.firstThree("xd"),
        "the show records nothing",
      );

      // 4. Turning the setting off shows exactly the owned messages; m2 and the user's m4 stay hidden, and so does
      // the branch's hand-hidden b3.
      await updateLtmGlobalSettings({ longTermMemoryHideImportedMessages: false }, root);
      await showLtmHiddenMessages(root);
      assert.deepEqual(cBranch.hidden(), ["c2", "c3"], "C's recorded copies show; the unrecorded and hand-hidden stay");
      assert.deepEqual(hiddenIds(), ["m2", "m4"], "only the owned messages show again");
      assert.deepEqual(branchHiddenIds(), ["b3"], "the branch's adopted copies show again too");
      assert.deepEqual(await readLtmHiddenMessages(root), {}, "and the record is empty");
    },
    [() => releaseRuntime?.(), () => rm(dataDir, { recursive: true, force: true })],
  );
  process.stdout.write(
    "Long-Term Memory hide imported messages regression: off by default, tail, ownership, re-preview, tail drift, manual choices, archive and delete, waiting for review, branch copies and tail, branch hook, hand-hidden branch tail, branches of branches, records an older build wrote, copies an ancestor showed itself, global tail, and missing host method ok\n",
  );
}

void runRegressionToCompletion("long-term-memory-hide-imported-messages", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
