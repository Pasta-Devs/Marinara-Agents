import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runRegressionToCompletion } from "./regression-helpers.ts";

// Issue #1433 proof: Engine copies the summary entries a branch shares with its parent, ids included.
// A branch therefore also recalls a memory saved to another branch of its conversation when every
// chat summary the memory was extracted from is one of the branch's own. Recall only: nothing is written.
// A branch also recalls a memory whose every source piece ends within the messages it copied, and the
// parent recalls the branch's; Engine's fork metadata places the fork, `createdAt` covers older branches.
async function main() {
  const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
  const { LongTermMemoryStorage } = await import(`${source}/persistence/storage.ts`);
  const { configurePackageRuntime } = await import(`${source}/package-runtime.ts`);
  const { prepareGenerationLongTermMemory } = await import(`${source}/recall/generation-injection.ts`);
  const { inheritedBranchLtmNoteIds, sharedLtmMessageCounts } = await import(`${source}/identity/chat-scope.ts`);
  const { registerNotesRoutes } = await import(`${source}/routes/notes.ts`);
  const engineRoot =
    process.env.MARINARA_ENGINE_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "../../Marinara-Engine");
  const Fastify = (
    await import(pathToFileURL(join(engineRoot, "packages/server/node_modules/fastify/fastify.js")).href)
  ).default;

  const timestamp = "2026-10-17T00:00:00.000Z";
  const recallMetadata = {
    enableLongTermMemory: true,
    longTermMemoryMaxChunks: 20,
    longTermMemoryBudgetTokens: 4096,
    longTermMemoryScoreThreshold: 0,
  };
  const summaryEntry = (id: string, content: string) => ({
    id,
    kind: "rolling",
    origin: "automated",
    title: id,
    content,
    enabled: true,
    sourceMode: "range",
    rangeStartIndex: 1,
    rangeEndIndex: 4,
  });
  const chat = (
    id: string,
    groupId: string | null,
    summaryEntries: unknown[],
    extra: Record<string, unknown> = {},
  ) => ({
    id,
    name: id,
    mode: "roleplay",
    characterIds: [],
    groupId,
    personaId: null,
    connectionId: null,
    metadata: { ...recallMetadata, summaryEntries, ...extra },
    lastMessageAt: null,
    updatedAt: timestamp,
  });
  // A and its branch B share E1 (Engine copied it with its id); E2 and E3 were written after the split.
  // Each also numbered its own next game session 1, so that id proves no shared history.
  // C is another conversation whose summary happens to reuse E1's id.
  const chats = [
    chat("chat-a", "group-g", [summaryEntry("entry-e1", "First stretch."), summaryEntry("entry-e2", "A later.")], {
      gamePreviousSessionSummaries: [{ sessionNumber: 1, summary: "A's own first session." }],
    }),
    chat("chat-b", "group-g", [summaryEntry("entry-e1", "First stretch."), summaryEntry("entry-e3", "B later.")], {
      branchName: "Branch B",
      branchParentChatId: "chat-a",
      gamePreviousSessionSummaries: [{ sessionNumber: 1, summary: "B's own first session." }],
    }),
    chat("chat-c", "group-h", [summaryEntry("entry-e1", "Another story.")]),
    chat("chat-solo", null, [summaryEntry("entry-e1", "First stretch.")]),
    chat("chat-unsummarized", "group-g", []),
    // River has 45 messages; its branch copied the first 20 and wrote 3 more. Both keep entry R1.
    chat("chat-river", "group-river", [summaryEntry("entry-r1", "The ferry stretch.")]),
    chat("chat-river-fork", "group-river", [summaryEntry("entry-r1", "The ferry stretch.")], {
      branchParentChatId: "chat-river",
      branchParentMessageId: "chat-river-20",
      branchMessageId: "chat-river-fork-20",
    }),
    // An older branch without fork metadata whose first 15 messages are River's.
    chat("chat-river-old", "group-river", []),
    // Ember was empty when it was branched; both wrote their own messages afterwards.
    chat("chat-ember", "group-ember", []),
    chat("chat-ember-fork", "group-ember", [], {
      branchParentChatId: "chat-ember",
      branchParentMessageId: null,
      branchMessageId: null,
    }),
  ];
  const range = (first: number, last: number) => Array.from({ length: last - first + 1 }, (_, index) => first + index);
  const messagesAt = (chatId: string, minutes: number[]) =>
    minutes.map((minute, index) => ({
      id: `${chatId}-${index + 1}`,
      chatId,
      role: "user",
      characterId: null,
      content: `Message ${index + 1}.`,
      activeSwipeIndex: 0,
      extra: {},
      createdAt: new Date(Date.parse(timestamp) + minute * 60_000).toISOString(),
    }));
  const messages: Record<string, ReturnType<typeof messagesAt>> = {
    "chat-river": messagesAt("chat-river", range(1, 45)),
    "chat-river-fork": messagesAt("chat-river-fork", [...range(1, 20), ...range(101, 103)]),
    "chat-river-old": messagesAt("chat-river-old", [...range(1, 15), ...range(201, 205)]),
    "chat-ember": messagesAt("chat-ember", range(301, 320)),
    "chat-ember-fork": messagesAt("chat-ember-fork", range(401, 410)),
  };
  const listMessagesCalls: string[] = [];
  let failListMessages = false;
  let listChatsCalls = 0;
  let failListChats = false;
  const warnings: unknown[][] = [];
  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-branch-recall-"));
  const releaseHost = configurePackageRuntime({
    isDebugAgentsEnabled: () => false,
    logger: { debug() {}, info() {}, warn: (...args: unknown[]) => warnings.push(args), error() {} },
    dataDir,
    resources: {
      listCharacters: async () => [],
      listPersonas: async () => [],
      listLorebooks: async () => [],
    },
    persistence: {
      getChat: async (chatId: string) => chats.find((item) => item.id === chatId) ?? null,
      listChats: async () => {
        listChatsCalls += 1;
        if (failListChats) throw new Error("listChats unavailable");
        return chats;
      },
      listMessages: async (chatId: string) => {
        listMessagesCalls.push(chatId);
        if (failListMessages) throw new Error("listMessages unavailable");
        return messages[chatId] ?? [];
      },
      updateChatMetadata: async () => {},
    },
  });
  const root = join(dataDir, "long-term-memory");
  const chatOnly = (chatId: string) => ({ chatId, chatIds: [chatId] });
  const note = (input: {
    id: string;
    type: string;
    text: string;
    scope: Record<string, unknown>;
    sources?: string[];
    provenance?: { kind: string; sourceId: string; entryId?: string };
    evidence?: string[];
  }) => ({
    id: input.id,
    title: input.id,
    type: input.type,
    status: "active",
    modes: ["roleplay"],
    scope: input.scope,
    tags: [],
    keywords: [],
    links: (input.sources ?? []).map((target) => ({ target, relation: "extracted_from" })),
    sections: {
      [input.type === "source" ? "source" : "facts"]: {
        text: input.text,
        ...(input.evidence ? { evidence: input.evidence } : {}),
        updatedAt: timestamp,
      },
    },
    ...(input.provenance ? { provenance: input.provenance } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  });
  const summarySource = (id: string, chatId: string, entryId: string, messageRange?: string) =>
    note({
      id,
      type: "source",
      text: `Summary ${entryId} of ${chatId}.`,
      scope: chatOnly(chatId),
      provenance: { kind: "chat_summary", sourceId: chatId, entryId },
      ...(messageRange
        ? { evidence: [`chat:${chatId}`, `summary_entry:${entryId}`, `message_range:${messageRange}`] }
        : {}),
    });
  const pieceSource = (id: string, chatId: string, messageRange: string) =>
    note({
      id,
      type: "source",
      text: `Messages ${messageRange} of ${chatId}.`,
      scope: chatOnly(chatId),
      provenance: { kind: "chat_transcript", sourceId: chatId, entryId: `message-${messageRange}` },
      evidence: [`chat:${chatId}`, `message_entry:message-${messageRange}`, `message_range:${messageRange}`],
    });
  const memory = (id: string, scope: Record<string, unknown>, sources: string[]) =>
    note({ id, type: "world", text: `The lanternfall vow is kept, as ${id} records.`, scope, sources });

  try {
    const storage = new LongTermMemoryStorage(root);
    for (const input of [
      summarySource("source_a_e1", "chat-a", "entry-e1"),
      summarySource("source_a_e2", "chat-a", "entry-e2"),
      summarySource("source_b_e3", "chat-b", "entry-e3"),
      summarySource("source_c_e1", "chat-c", "entry-e1"),
      summarySource("source_a_game_1", "chat-a", "game-session-1"),
      note({
        id: "source_lorebook_vows",
        type: "source",
        text: "Lorebook entry about vows.",
        scope: chatOnly("chat-a"),
        provenance: { kind: "lorebook", sourceId: "lorebook-vows", entryId: "entry-1" },
      }),
      memory("world_m1", chatOnly("chat-a"), ["source_a_e1"]),
      memory("world_m2", chatOnly("chat-a"), ["source_a_e1", "source_a_e2"]),
      memory("world_m3", chatOnly("chat-a"), ["source_lorebook_vows"]),
      memory("world_m4", chatOnly("chat-b"), ["source_b_e3"]),
      memory("world_m5", { groupId: "group-g", chatIds: ["chat-a", "chat-b"] }, ["source_a_e1"]),
      // Assigned by hand with the availability editor's Branch tab.
      memory("world_m6", { chatIds: ["chat-b"] }, ["source_b_e3"]),
      memory("world_m7", chatOnly("chat-c"), ["source_c_e1"]),
      memory("world_m8", chatOnly("chat-a"), ["source_a_game_1"]),
      pieceSource("source_river_1_12", "chat-river", "1-12"),
      pieceSource("source_river_12_25", "chat-river", "12-25"),
      pieceSource("source_river_30_45", "chat-river", "30-45"),
      pieceSource("source_fork_1_8", "chat-river-fork", "1-8"),
      summarySource("source_river_r1", "chat-river", "entry-r1"),
      pieceSource("source_ember_1_8", "chat-ember", "1-8"),
      memory("world_m9", chatOnly("chat-river"), ["source_river_1_12"]),
      memory("world_m10", chatOnly("chat-river"), ["source_river_12_25"]),
      memory("world_m11", chatOnly("chat-river"), ["source_river_30_45"]),
      memory("world_m12", chatOnly("chat-river-fork"), ["source_fork_1_8"]),
      memory("world_m13", chatOnly("chat-river"), ["source_river_r1", "source_river_1_12"]),
      memory("world_m14", chatOnly("chat-river"), ["source_river_r1", "source_river_12_25"]),
      memory("world_m15", chatOnly("chat-river"), ["source_river_1_12", "source_gone"]),
      memory("world_m16", chatOnly("chat-ember"), ["source_ember_1_8"]),
      memory("world_m17", chatOnly("chat-river"), ["source_river_r1"]),
      // River's own later summaries, which its branch does not have, of messages 1-12 and 21-30.
      summarySource("source_river_r2", "chat-river", "entry-r2", "1-12"),
      summarySource("source_river_r3", "chat-river", "entry-r3", "21-30"),
      memory("world_m18", chatOnly("chat-river"), ["source_river_r2"]),
      memory("world_m19", chatOnly("chat-river"), ["source_river_r3"]),
    ])
      await storage.createNote(input as never);

    const memoryIds = (chunks: Array<{ chunk: { noteId: string } }>) =>
      chunks
        .map((candidate) => candidate.chunk.noteId)
        .filter((noteId) => noteId.startsWith("world_m"))
        .sort();
    const recalled = async (chatId: string) => {
      const result = await prepareGenerationLongTermMemory({
        root,
        chatId,
        chatMode: "roleplay",
        characterIds: [],
        messages: [{ role: "user", content: "Is the lanternfall vow kept?" }],
      });
      return memoryIds(result?.receipt.artifact.chunks ?? []);
    };

    // The first recall builds the index; the snapshot after it must survive every later recall.
    assert.deepEqual(await recalled("chat-a"), ["world_m1", "world_m2", "world_m3", "world_m5", "world_m8"]);
    const vaultFiles = async () => {
      const files = new Map<string, string>();
      const vault = join(root, "vault");
      for (const entry of await readdir(vault, { recursive: true, withFileTypes: true }))
        if (entry.isFile()) {
          const path = join(entry.parentPath, entry.name);
          files.set(path, await readFile(path, "utf8"));
        }
      files.set("recall.json", await readFile(join(root, "indexes", "recall.json"), "utf8"));
      return files;
    };
    const before = await vaultFiles();
    assert.ok(before.size > 1, "the snapshot must hold the note files and recall.json");

    assert.deepEqual(
      await recalled("chat-b"),
      ["world_m1", "world_m4", "world_m5", "world_m6"],
      "branch B recalls A's memories built only from the shared E1, and keeps its own, but not A's game session 1",
    );
    assert.deepEqual(
      await recalled("chat-a"),
      ["world_m1", "world_m2", "world_m3", "world_m5", "world_m8"],
      "A never gains B's memories from E3, which A does not have",
    );
    assert.deepEqual(await recalled("chat-c"), ["world_m7"], "a reused entry id never crosses conversations");
    assert.deepEqual(await vaultFiles(), before, "recall must not change note files or recall.json");

    // Issue #1442: the search route resolves a chat-only scope like a reply, shared history included.
    const app = Fastify();
    registerNotesRoutes(app, { root, storage, draftStore: undefined as never });
    try {
      const searched = await app.inject({
        method: "POST",
        url: "/search",
        payload: { queryText: "Is the lanternfall vow kept?", scope: chatOnly("chat-b") },
      });
      assert.equal(searched.statusCode, 200, searched.body);
      assert.deepEqual(
        memoryIds(searched.json().chunks),
        ["world_m1", "world_m4", "world_m5", "world_m6"],
        "search in branch B returns what a reply in branch B recalls",
      );
      // Chat Settings and the Vault name what a branch recalls from other branches: recall's inherited set,
      // grouped by the branch it is saved to, without what the chat's own place already holds (m5).
      const branchMemories = async (chatId: string) => {
        const response = await app.inject({ method: "GET", url: `/branch-memories/${chatId}` });
        assert.equal(response.statusCode, 200, response.body);
        return (response.json().branches as Array<{ chatId: string; name: string; noteIds: string[] }>).map(
          (branch) => ({ ...branch, noteIds: [...branch.noteIds].sort() }),
        );
      };
      assert.deepEqual(await branchMemories("chat-b"), [{ chatId: "chat-a", name: "chat-a", noteIds: ["world_m1"] }]);
      assert.deepEqual(await branchMemories("chat-river-fork"), [
        { chatId: "chat-river", name: "chat-river", noteIds: ["world_m13", "world_m17", "world_m18", "world_m9"] },
      ]);
      assert.deepEqual(await branchMemories("chat-solo"), [], "an unbranched chat shares nothing");
      assert.equal((await app.inject({ method: "GET", url: "/branch-memories/missing" })).statusCode, 404);
    } finally {
      await app.close();
    }

    // Issue #1442: a failed shared-history lookup still recalls the branch's own memories, with a warning.
    failListChats = true;
    warnings.length = 0;
    assert.deepEqual(await recalled("chat-b"), ["world_m4", "world_m5", "world_m6"]);
    assert.ok(
      warnings.some((args) => String(args[0]).includes("Shared-history lookup failed")),
      JSON.stringify(warnings.map((args) => args[0])),
    );
    failListChats = false;

    // An unbranched chat never looks up other chats. A grouped chat without summaries now does, since
    // message pieces can be shared too (before: no lookup); group G has no pieces, so no messages are read.
    listChatsCalls = 0;
    listMessagesCalls.length = 0;
    assert.deepEqual(await recalled("chat-solo"), []);
    assert.equal(listChatsCalls, 0, "a chat without a group must build no inherited set");
    assert.deepEqual(await recalled("chat-unsummarized"), ["world_m5"], "a whole-chat memory still reaches it");
    assert.equal(listChatsCalls, 1, "a grouped chat without summaries looks up its conversation");
    assert.deepEqual(listMessagesCalls, [], "no chat of group G has a numbered source to place");

    // A branch forked after message 20 recalls the memories from pieces and summaries that end by then:
    // 1-12 alone, with the shared summary R1, or River's later summary of 1-12, but not 12-25, 30-45,
    // River's summary of 21-30, or a piece next to a missing source.
    assert.deepEqual(await recalled("chat-river-fork"), [
      "world_m12",
      "world_m13",
      "world_m17",
      "world_m18",
      "world_m9",
    ]);
    assert.ok(
      listMessagesCalls.every((chatId, index) => listMessagesCalls.indexOf(chatId) === index),
      `each chat's messages are listed at most once per reply: ${listMessagesCalls}`,
    );
    assert.deepEqual(
      await recalled("chat-river"),
      [
        "world_m10",
        "world_m11",
        "world_m12",
        "world_m13",
        "world_m14",
        "world_m15",
        "world_m17",
        "world_m18",
        "world_m19",
        "world_m9",
      ],
      "the parent recalls the branch's memory from its copied messages 1-8",
    );
    assert.deepEqual(
      await recalled("chat-river-old"),
      ["world_m12", "world_m18", "world_m9"],
      "a branch without fork metadata shares the messages whose createdAt matches, 15 here",
    );
    listMessagesCalls.length = 0;
    assert.deepEqual(await recalled("chat-ember-fork"), [], "a branch of an empty chat shares no messages");
    assert.deepEqual(await recalled("chat-ember"), ["world_m16"]);
    assert.deepEqual(listMessagesCalls, [], "Engine's empty-fork metadata needs no messages");

    // A failed message lookup still shares the summary R1, with a warning.
    failListMessages = true;
    warnings.length = 0;
    assert.deepEqual(await recalled("chat-river-fork"), ["world_m12", "world_m17"]);
    assert.ok(
      warnings.some((args) => String(args[0]).includes("Shared-message lookup failed")),
      JSON.stringify(warnings.map((args) => args[0])),
    );
    failListMessages = false;
    assert.deepEqual(await vaultFiles(), before, "recall must not change note files or recall.json");

    // Siblings and grandchildren share the smallest copied count on the way to their common ancestor;
    // an unknown fork message falls back to createdAt.
    const tree: Record<string, ReturnType<typeof messagesAt>> = {
      p: messagesAt("p", range(1, 30)),
      b: messagesAt("b", [...range(1, 20), ...range(501, 505)]),
      g: messagesAt("g", [...range(1, 5), ...range(601, 603)]),
      s: messagesAt("s", [...range(1, 8), 701]),
      u: messagesAt("u", [...range(1, 12), 801]),
      o: messagesAt("o", [...range(1, 6), 901]),
    };
    const treeChats = [
      { id: "p", metadata: {} },
      { id: "b", metadata: { branchParentChatId: "p", branchMessageId: "b-20" } },
      { id: "g", metadata: JSON.stringify({ branchParentChatId: "b", branchMessageId: "g-5" }) },
      { id: "s", metadata: { branchParentChatId: "p", branchMessageId: "s-8" } },
      { id: "u", metadata: { branchParentChatId: "p", branchMessageId: "missing" } },
      { id: "o", metadata: { branchParentChatId: "p" } },
    ];
    const treeCalls: string[] = [];
    const shared = (chatId: string, otherChatIds: string[]) =>
      sharedLtmMessageCounts({
        chatId,
        chats: treeChats,
        otherChatIds,
        listMessages: async (id: string) => (treeCalls.push(id), tree[id] ?? []),
      }).then((counts: Map<string, number>) => Object.fromEntries(counts));
    assert.deepEqual(await shared("g", ["p", "b", "s", "g", "s"]), { p: 5, b: 5, s: 5 });
    assert.deepEqual(treeCalls.sort(), ["b", "g", "s"], "fork metadata needs only the branches' own messages");
    assert.deepEqual(await shared("p", ["b", "g", "s", "u", "o"]), { b: 20, g: 5, s: 8, u: 12, o: 6 });
    assert.deepEqual(await shared("s", ["b"]), { b: 8 });

    // A link to a missing source note, or to another conversation's summary reusing E1's id, fails the test.
    const notes = await storage.listNotes();
    const inherit = (extra: unknown[]) =>
      inheritedBranchLtmNoteIds({
        chatId: "chat-b",
        branchChatIds: ["chat-a", "chat-b"],
        summaryEntryIds: new Set(["entry-e1", "entry-e3"]),
        notes: [...notes, ...extra],
      });
    assert.deepEqual([...inherit([])].sort(), ["world_m1", "world_m5"]);
    assert.equal(
      inherit([memory("world_missing_source", chatOnly("chat-a"), ["source_a_e1", "source_gone"])]).has(
        "world_missing_source",
      ),
      false,
    );
    assert.equal(inherit([memory("world_cross", chatOnly("chat-a"), ["source_c_e1"])]).has("world_cross"), false);
    process.stdout.write(
      "Long-Term Memory branch recall regression: shared summaries and copied messages inherited, writes none ok\n",
    );
  } finally {
    releaseHost();
    await rm(dataDir, { recursive: true, force: true });
  }
}

void runRegressionToCompletion("long-term-memory-branch-recall", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
