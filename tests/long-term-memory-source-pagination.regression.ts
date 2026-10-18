import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configurePackageRuntime } from "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/package-runtime.ts";
import {
  previewPackageInterop,
  previewPackageLorebooks,
  importPackageInterop,
} from "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/sources/interop.ts";
import {
  ltmInteropPreviewResponseSchema,
  ltmLorebookPreviewResponseSchema,
  ltmImportSourceNotesRequestSchema,
} from "../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts";
import {
  errorMessage,
  failedResponseError,
  mergeSourcePreviewPages,
  mergeLorebookPreviewPages,
  fetchSourceDetails,
  request,
} from "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/api.ts";

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-source-pages-"));
  const root = join(dataDir, "long-term-memory");
  const characters = Array.from({ length: 205 }, (_, index) => ({
    id: `character-${String(index).padStart(3, "0")}`,
    data: { name: `Navigator ${index}`, description: "Keeps the charts." },
    comment: "",
  }));
  const chats = ["roleplay", "conversation"].map((mode) => ({
    id: `chat-${mode}`,
    name: mode,
    mode,
    characterIds: [],
    groupId: null,
    personaId: null,
    connectionId: null,
    metadata:
      mode === "roleplay"
        ? {
            summaryEntries: Array.from({ length: 205 }, (_, index) => ({
              id: `summary-${String(index).padStart(3, "0")}`,
              content: `Voyage ${index}.`,
            })),
          }
        : { daySummaries: { "2026-09-01": "A separate conversation." } },
    lastMessageAt: null,
    updatedAt: "2026-09-13T00:00:00.000Z",
  }));
  const books = [
    {
      id: "book-a",
      data: { name: "Atlas", category: "World" },
      entries: [{ id: "long-entry", name: "Long Entry", content: "A coast worth remembering. ".repeat(210_000) }],
    },
    ...Array.from({ length: 105 }, (_, index) => ({
      id: `book-${String(index).padStart(3, "0")}`,
      data: { name: `Empty atlas ${index}` },
      entries: [],
    })),
  ];
  const release = configurePackageRuntime({
    dataDir,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    resources: {
      async listCharacters() {
        return [...characters].reverse();
      },
      async listPersonas() {
        return [];
      },
      async listLorebooks() {
        return [...books].reverse();
      },
    },
    persistence: {
      async listChats() {
        return chats;
      },
      async getChat(id) {
        return chats.find((chat) => chat.id === id) ?? null;
      },
      async updateChatMetadata() {},
    },
  });
  try {
    const first = ltmInteropPreviewResponseSchema.parse(
      await previewPackageInterop({ source: "characters", query: "Navigator", limit: 100 }, root),
    );
    assert.equal(first.samples.length, 100);
    assert.equal(first.hasMore, true);
    assert.ok(first.nextCursor);
    assert.equal(first.samples[0]?.sourceId, "character-000");
    // Remove an earlier item and insert one before the cursor: continuation neither
    // skips existing later records nor returns the earlier records a second time.
    characters.shift();
    characters.unshift({
      id: "character-000-new",
      data: { name: "Navigator new", description: "New chart." },
      comment: "",
    });
    const second = ltmInteropPreviewResponseSchema.parse(
      await previewPackageInterop(
        { source: "characters", query: "  NAVIGATOR  ", limit: 100, cursor: first.nextCursor },
        root,
      ),
    );
    const third = ltmInteropPreviewResponseSchema.parse(
      await previewPackageInterop(
        { source: "characters", query: "Navigator", limit: 100, cursor: second.nextCursor! },
        root,
      ),
    );
    assert.equal(second.samples[0]?.sourceId, "character-100");
    assert.equal(third.samples.length, 5);
    assert.equal(third.hasMore, false);
    assert.equal(third.nextCursor, null);
    const merged = mergeSourcePreviewPages([first, second, third])!;
    assert.equal(merged.samples.length, 205);
    assert.equal(new Set(merged.samples.map((sample) => sample.sourceId)).size, 205);
    for (const changed of [
      { source: "chats" as const },
      { mode: "game" as const },
      { query: "different" },
      { sourceScope: { chatId: "other" } },
      { cursor: "not-a-cursor" },
    ]) {
      await assert.rejects(
        previewPackageInterop(
          { source: "characters", query: "Navigator", limit: 100, cursor: first.nextCursor, ...changed },
          root,
        ),
        (error: any) => error.code === "ltm_invalid_source_cursor" && error.statusCode === 400,
      );
    }
    const importedId = second.samples[0]!.sourceId;
    await importPackageInterop(
      {
        source: "characters",
        sourceIds: [importedId],
        destinationScope: { characterIds: [importedId] },
        limit: 100,
        extract: false,
      },
      root,
      new AbortController().signal,
    );
    const refreshedSecond = await previewPackageInterop(
      { source: "characters", query: "Navigator", limit: 100, cursor: first.nextCursor },
      root,
    );
    assert.equal(refreshedSecond.samples[0]?.status, "imported");
    assert.equal(
      mergeSourcePreviewPages([first, second, refreshedSecond])?.samples.find((row) => row.sourceId === importedId)
        ?.status,
      "imported",
    );
    assert.equal(
      ltmImportSourceNotesRequestSchema.safeParse({
        source: "characters",
        sourceIds: characters.slice(0, 101).map((row) => row.id),
      }).success,
      false,
    );

    const scopedPages = [];
    let cursor: string | undefined;
    do {
      const page = ltmInteropPreviewResponseSchema.parse(
        await previewPackageInterop(
          { source: "chats", sourceScope: { chatId: "chat-roleplay" }, mode: "roleplay", limit: 100, cursor },
          root,
        ),
      );
      scopedPages.push(page);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    assert.equal(mergeSourcePreviewPages(scopedPages)?.samples.length, 205);
    assert.ok(scopedPages.every((page) => page.samples.every((row) => row.sourceId.startsWith("chat-roleplay:"))));

    const lorePages = [];
    cursor = undefined;
    do {
      const page = ltmLorebookPreviewResponseSchema.parse(await previewPackageLorebooks({ limit: 100, cursor }, root));
      assert.ok(page.books.length <= 100 && page.counts.candidates <= 100);
      lorePages.push(page);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    const normalizedLoreContinuation = await previewPackageLorebooks(
      { limit: 100, query: "   ", cursor: lorePages[0]!.nextCursor! },
      root,
    );
    assert.deepEqual(normalizedLoreContinuation, lorePages[1], "blank search keeps empty-book pagination unchanged");
    const lore = mergeLorebookPreviewPages(lorePages)!;
    assert.equal(lore.books.length, 106, "all empty books and the large book remain reachable");
    assert.equal(lore.counts.candidates, lore.totals.candidates, "a large entry continues until every chunk is loaded");
    const entry = lore.books.find((book) => book.id === "book-a")!.entries[0]!;
    assert.ok(entry.candidates.length > 100);
    assert.equal(entry.candidateCount, entry.candidates.length);
    assert.equal(new Set(entry.candidates.map((candidate) => candidate.sourceId)).size, entry.candidates.length);
    assert.equal(
      mergeLorebookPreviewPages([...lorePages, lorePages.at(-1)!])?.counts.candidates,
      lore.counts.candidates,
      "append deduplicates repeated pages",
    );
    await assert.rejects(
      previewPackageLorebooks({ limit: 100, query: "Atlas", cursor: lorePages[0]!.nextCursor! }, root),
      (error: any) => error.code === "ltm_invalid_source_cursor",
    );
    const originalFetch = globalThis.fetch;
    const detailBatches: string[][] = [];
    const detailIds = Array.from({ length: 205 }, (_, index) => `detail-${index}`);
    const detailSignal = new AbortController().signal;
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(init?.signal, detailSignal);
      assert.equal(body.source, "lorebooks");
      assert.deepEqual(body.sourceScope, { chatId: "chat-roleplay" });
      assert.equal(body.mode, "roleplay");
      assert.ok(body.sourceIds.length <= 100);
      detailBatches.push(body.sourceIds);
      return Response.json({
        source: "lorebooks",
        details: body.sourceIds.filter((id: string) => id !== "detail-204").map((sourceId: string) => ({ sourceId })),
        missingSourceIds: body.sourceIds.filter((id: string) => id === "detail-204"),
      });
    };
    try {
      const details = await fetchSourceDetails(
        {
          source: "lorebooks",
          sourceIds: [...detailIds, detailIds[0]!],
          mode: "roleplay",
          sourceScope: { chatId: "chat-roleplay" },
        },
        detailSignal,
      );
      assert.deepEqual(
        detailBatches.map((batch) => batch.length),
        [100, 100, 5],
      );
      assert.deepEqual(
        details.details.map((detail) => detail.sourceId),
        detailIds.slice(0, -1),
      );
      assert.deepEqual(details.missingSourceIds, ["detail-204"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
    // #1375: an HTTP status line is not a message for the user; the caller's localized fallback shows instead.
    globalThis.fetch = async (url) =>
      String(url).endsWith("/locked")
        ? Response.json({ error: "Memory is locked." }, { status: 409 })
        : new Response("", { status: 404, statusText: "Not Found" });
    try {
      const statusOnly = await request("/missing").catch((error: unknown) => error);
      assert.equal((statusOnly as { status?: number }).status, 404);
      assert.equal(errorMessage(statusOnly, "Could not load."), "Could not load.");
      assert.equal(
        errorMessage(await request("/locked").catch((error: unknown) => error), "Could not load."),
        "Memory is locked.",
      );
      // The raw-Response export paths read the body themselves and share the same error construction.
      assert.equal(
        errorMessage(
          await failedResponseError(new Response("", { status: 500, statusText: "Internal Server Error" })),
          "Could not export.",
        ),
        "Could not export.",
      );
      assert.equal(
        errorMessage(
          await failedResponseError(Response.json({ error: "Export blocked." }, { status: 409 })),
          "Could not export.",
        ),
        "Export blocked.",
      );
      assert.equal(errorMessage(new Error("Plain failure"), "Could not load."), "Plain failure");
      assert.equal(errorMessage("not an error", "Could not load."), "Could not load.");
    } finally {
      globalThis.fetch = originalFetch;
    }
    console.log(
      "Long-Term Memory source pagination passed: scoped cursors, mutation-safe continuation, import status, limits, empty books, split entries, status-only request errors and export failures.",
    );
  } finally {
    release();
    await rm(dataDir, { recursive: true, force: true });
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
