import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runRegressionToCompletion } from "./regression-helpers.ts";

// Issue #1433 proof: Engine copies the summary entries a branch shares with its parent, ids included.
// A branch therefore also recalls a memory saved to another branch of its conversation when every
// chat summary the memory was extracted from is one of the branch's own. Recall only: nothing is written.
async function main() {
  const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
  const { LongTermMemoryStorage } = await import(`${source}/persistence/storage.ts`);
  const { configurePackageRuntime } = await import(`${source}/package-runtime.ts`);
  const { prepareGenerationLongTermMemory } = await import(`${source}/recall/generation-injection.ts`);
  const { inheritedBranchLtmNoteIds } = await import(`${source}/identity/chat-scope.ts`);
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
  ];
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
    sections: { [input.type === "source" ? "source" : "facts"]: { text: input.text, updatedAt: timestamp } },
    ...(input.provenance ? { provenance: input.provenance } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  });
  const summarySource = (id: string, chatId: string, entryId: string) =>
    note({
      id,
      type: "source",
      text: `Summary ${entryId} of ${chatId}.`,
      scope: chatOnly(chatId),
      provenance: { kind: "chat_summary", sourceId: chatId, entryId },
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

    // An unbranched chat, and a branch without summaries, never look up the other branches.
    listChatsCalls = 0;
    assert.deepEqual(await recalled("chat-solo"), []);
    assert.deepEqual(await recalled("chat-unsummarized"), ["world_m5"], "a whole-chat memory still reaches it");
    assert.equal(listChatsCalls, 0, "chats without a group or summary entries must build no inherited set");

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
    process.stdout.write("Long-Term Memory branch recall regression: shared summaries inherited, writes none ok\n");
  } finally {
    releaseHost();
    await rm(dataDir, { recursive: true, force: true });
  }
}

void runRegressionToCompletion("long-term-memory-branch-recall", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
