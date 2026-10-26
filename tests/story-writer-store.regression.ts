import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  DEFAULT_SYSTEM_PROMPT,
  chapterDocumentId,
  countWords,
  defaultPreferences,
  storyDocumentId,
} from "../packages/story-writer/src/engine/packages/client/src/lib/story-writer/model.ts";
import { storyWriterRoutes } from "../packages/story-writer/src/engine/packages/server/src/services/story-writer/routes.ts";
import {
  createStoryStore,
  type StoryDocument,
  type StoryDocumentStore,
  type StoryPersistence,
} from "../packages/story-writer/src/engine/packages/server/src/services/story-writer/story-store.ts";

// An in-memory documents store with revisions like the Engine's. `interfere` simulates another writer: the next update
// of that document first bumps its revision (optionally changing its data), so the caller's expectedRevision is stale.
function memoryPersistence({ transactions = false } = {}) {
  let rows = new Map<string, StoryDocument>();
  const interference: Array<{ id: string; change?: (data: any) => unknown }> = [];
  const failures = new Set<string>();
  const documents: StoryDocumentStore = {
    async list(packageId, kind) {
      return [...rows.values()]
        .filter((row) => row.packageId === packageId && row.kind === kind)
        .map((row) => structuredClone(row));
    },
    async getById(packageId, id) {
      const row = rows.get(id);
      return row && row.packageId === packageId ? structuredClone(row) : null;
    },
    async create(input) {
      if (rows.has(input.id)) throw Object.assign(new Error("duplicate id"), { code: "FILE_UNIQUE_CONSTRAINT" });
      const row = { ...structuredClone(input), revision: 1 };
      rows.set(input.id, row);
      return structuredClone(row);
    },
    async update(input) {
      if (failures.delete(input.id)) throw new Error("The disk is full.");
      const index = interference.findIndex((entry) => entry.id === input.id);
      const stale = rows.get(input.id);
      if (index >= 0 && stale) {
        const [entry] = interference.splice(index, 1);
        const data = entry?.change ? entry.change(structuredClone(stale.data)) : stale.data;
        rows.set(input.id, { ...stale, data, revision: stale.revision + 1 });
      }
      const current = rows.get(input.id);
      if (!current || current.packageId !== input.packageId || current.revision !== input.expectedRevision) return null;
      const next = {
        ...current,
        name: input.name,
        description: input.description,
        data: structuredClone(input.data),
        revision: current.revision + 1,
        updatedAt: input.updatedAt,
      };
      rows.set(input.id, next);
      return structuredClone(next);
    },
    async remove(packageId, id, expectedRevision) {
      const current = rows.get(id);
      if (!current || current.packageId !== packageId || current.revision !== expectedRevision) return false;
      rows.delete(id);
      return true;
    },
  };
  const persistence: StoryPersistence = { documents };
  if (transactions) {
    persistence.transaction = async <T>(operation: (session: { documents: StoryDocumentStore }) => Promise<T>) => {
      const snapshot = new Map(rows);
      try {
        return await operation({ documents });
      } catch (error) {
        rows = snapshot;
        throw error;
      }
    };
  }
  return {
    persistence,
    row: (id: string) => rows.get(id),
    setData: (id: string, data: unknown) => rows.set(id, { ...rows.get(id)!, data }),
    interfere: (id: string, change?: (data: any) => unknown) => interference.push({ id, change }),
    failNextUpdate: (id: string) => failures.add(id),
  };
}

function setup(options?: { transactions?: boolean }) {
  const memory = memoryPersistence(options);
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString();
  return { ...memory, store: createStoryStore(memory.persistence, { now }) };
}

test("preferences start at the defaults and every patch is normalized over the saved values", async () => {
  const { store } = setup();
  assert.deepEqual(await store.getPreferences(), defaultPreferences());
  const saved = await store.patchPreferences({
    theme: "ebook",
    fontSize: 99,
    fontColor: "red",
    sidebarSide: "right",
    x: 1,
  });
  assert.equal(saved.theme, "ebook");
  assert.equal(saved.fontSize, 36);
  assert.equal(saved.fontColor, "");
  assert.equal(saved.sidebarSide, "right");
  assert.equal("x" in saved, false);
  const next = await store.patchPreferences({ noteSide: "left", fontColor: "#AABBCC" });
  assert.equal(next.theme, "ebook");
  assert.equal(next.noteSide, "left");
  assert.equal(next.fontColor, "#AABBCC");
  assert.deepEqual(await store.getPreferences(), next);
  await assert.rejects(store.patchPreferences("dark"), { statusCode: 400 });
});

test("stories are created normalized, listed newest first and patched without losing settings", async () => {
  const { store } = setup();
  const first = await store.createStory({ title: "First", chapterWords: 5, unknown: true });
  assert.equal(first.story.settings.chapterWords, 100);
  assert.equal(first.story.settings.systemPrompt, DEFAULT_SYSTEM_PROMPT);
  assert.equal("unknown" in first.story.settings, false);
  assert.deepEqual(first.chapters, []);
  const second = await store.createStory();
  assert.deepEqual(
    (await store.listStories()).map((story) => story.id),
    [second.story.id, first.story.id],
  );

  const patched = await store.patchStorySettings(first.story.id, { title: "Renamed", targetWords: 50_000 });
  assert.equal(patched.settings.title, "Renamed");
  assert.equal(patched.settings.targetWords, 50_000);
  assert.equal(patched.settings.chapterWords, 100);
  const [newest] = await store.listStories();
  assert.deepEqual(newest, {
    id: first.story.id,
    title: "Renamed",
    wordCount: 0,
    chapterCount: 0,
    createdAt: first.story.createdAt,
    updatedAt: patched.updatedAt,
  });
  assert.deepEqual((await store.getStory(first.story.id)).story, patched);

  await assert.rejects(store.getStory("../../etc/passwd"), { statusCode: 400 });
  await assert.rejects(store.getStory(randomUUID()), { statusCode: 404 });
  await assert.rejects(store.patchStorySettings(first.story.id, null), { statusCode: 400 });
  await assert.rejects(store.createStory("title"), { statusCode: 400 });
});

test("chapters keep the client id, refuse a taken id and keep the story's word count current", async () => {
  const { store, row } = setup();
  const { story } = await store.createStory({ title: "Book" });
  const clientId = "draft-0001abcd";
  const created = await store.createChapter(story.id, { id: clientId, text: "One two three.", status: "maybe" });
  assert.deepEqual(
    created.chapters.map((chapter) => [chapter.id, chapter.status, chapter.storyId]),
    [[clientId, "draft", story.id]],
  );
  assert.equal(created.story.wordCount, 3);
  assert.equal(created.story.chapterCount, 1);
  await assert.rejects(store.createChapter(story.id, { id: clientId }), { statusCode: 409 });
  await assert.rejects(store.createChapter(story.id, { id: "Not An Id" }), { statusCode: 400 });

  const withSecond = await store.createChapter(story.id, { text: "Four five.", request: "Continue." });
  const secondId = withSecond.chapters[1]!.id;
  assert.deepEqual(
    withSecond.chapters.map((chapter) => chapter.id),
    [clientId, secondId],
  );
  assert.equal(withSecond.story.wordCount, 5);

  const text = "# The Title\n\nOne *two* three four.\n\n***\n\nFive.";
  const updated = await store.patchChapter(story.id, clientId, { text, status: "complete", storyId: "elsewhere" });
  assert.equal(updated.chapter.text, text);
  assert.equal(updated.chapter.status, "complete");
  assert.equal(updated.chapter.storyId, story.id);
  assert.equal(updated.story.wordCount, countWords(text) + 2);
  assert.equal(updated.story.updatedAt, updated.chapter.updatedAt);
  await assert.rejects(store.patchChapter(story.id, clientId, { storyId: "x" }), { statusCode: 400 });
  await assert.rejects(store.patchChapter(story.id, randomUUID(), { text: "x" }), { statusCode: 404 });

  // A chapter of another story is not reachable through this one.
  const other = await store.createStory({ title: "Other" });
  await assert.rejects(store.patchChapter(other.story.id, secondId, { text: "x" }), { statusCode: 404 });
  await assert.rejects(store.deleteChapter(other.story.id, secondId), { statusCode: 404 });

  const afterDelete = await store.deleteChapter(story.id, clientId);
  assert.deepEqual(
    afterDelete.chapters.map((chapter) => chapter.id),
    [secondId],
  );
  assert.equal(afterDelete.story.wordCount, 2);
  assert.equal(afterDelete.story.chapterCount, 1);
  assert.equal(row(chapterDocumentId(clientId)), undefined);
});

test("parallel chapter writes to one story are all kept", async () => {
  const { store } = setup();
  const { story } = await store.createStory();
  await Promise.all(Array.from({ length: 5 }, (_, index) => store.createChapter(story.id, { text: `word ${index}` })));
  const loaded = await store.getStory(story.id);
  assert.equal(loaded.chapters.length, 5);
  assert.equal(loaded.story.wordCount, 10);
});

test("a duplicate copies settings and chapters under new ids; deleting a story removes its chapters", async () => {
  const { store, row } = setup({ transactions: true });
  const { story } = await store.createStory({ title: "Saga", overview: "Dragons." });
  await store.createChapter(story.id, { text: "Chapter one text.", summary: "One." });
  const source = await store.createChapter(story.id, { text: "Chapter two." });

  const copy = await store.duplicateStory(story.id);
  assert.notEqual(copy.story.id, story.id);
  assert.equal(copy.story.settings.title, "Saga (copy)");
  assert.equal(copy.story.settings.overview, "Dragons.");
  assert.equal(copy.story.wordCount, source.story.wordCount);
  assert.deepEqual(
    copy.chapters.map((chapter) => [chapter.text, chapter.summary, chapter.storyId]),
    source.chapters.map((chapter) => [chapter.text, chapter.summary, copy.story.id]),
  );
  const sourceIds = new Set(source.chapters.map((chapter) => chapter.id));
  assert.equal(
    copy.chapters.some((chapter) => sourceIds.has(chapter.id)),
    false,
  );
  await store.patchChapter(copy.story.id, copy.chapters[0]!.id, { text: "Changed." });
  assert.equal((await store.getStory(story.id)).chapters[0]!.text, "Chapter one text.");

  assert.deepEqual(await store.deleteStory(story.id), { ok: true });
  assert.equal(row(storyDocumentId(story.id)), undefined);
  for (const id of sourceIds) assert.equal(row(chapterDocumentId(id)), undefined);
  await assert.rejects(store.getStory(story.id), { statusCode: 404 });
  assert.equal((await store.getStory(copy.story.id)).chapters.length, 2);
});

test("a revision conflict re-reads and re-applies the change, and gives up after three tries", async () => {
  const { store, interfere } = setup({ transactions: true });
  const { story } = await store.createStory({ title: "Draft" });
  const documentId = storyDocumentId(story.id);
  interfere(documentId, (data) => ({ ...data, settings: { ...data.settings, notes: "From another writer." } }));
  const patched = await store.patchStorySettings(story.id, { title: "Mine" });
  assert.equal(patched.settings.title, "Mine");
  assert.equal(patched.settings.notes, "From another writer.");

  for (let index = 0; index < 3; index++) interfere(documentId);
  await assert.rejects(store.patchStorySettings(story.id, { title: "Lost" }), { statusCode: 409 });

  // In a transaction the chapter written before the failed story update is rolled back with it.
  for (let index = 0; index < 3; index++) interfere(documentId);
  await assert.rejects(store.createChapter(story.id, { id: "chapter-rolled-back", text: "Gone." }), {
    statusCode: 409,
  });
  const loaded = await store.getStory(story.id);
  assert.deepEqual(loaded.chapters, []);
  await assert.doesNotReject(store.createChapter(story.id, { id: "chapter-rolled-back" }));
});

test("reading a story repairs a missing chapter and stale totals left by an interrupted write", async () => {
  const { store, row, setData } = setup();
  const { story } = await store.createStory();
  const created = await store.createChapter(story.id, { text: "Three small words." });
  const documentId = storyDocumentId(story.id);
  const stored = row(documentId)!.data as Record<string, unknown>;
  setData(documentId, { ...stored, chapterIds: [...created.story.chapterIds, "missing-chapter-id"], wordCount: 99 });
  const loaded = await store.getStory(story.id);
  assert.deepEqual(loaded.story.chapterIds, created.story.chapterIds);
  assert.equal(loaded.story.wordCount, 3);
  assert.equal(loaded.story.updatedAt, created.story.updatedAt);
  assert.equal((row(documentId)!.data as { wordCount: number }).wordCount, 3);
});

test("routes answer known failures with { error } and hide unexpected ones behind a logged 500", async () => {
  const routes = new Map<
    string,
    { options: unknown; handler: (request: unknown, reply: unknown) => Promise<unknown> }
  >();
  const register =
    (method: string) =>
    (path: string, ...rest: any[]) => {
      routes.set(`${method} ${path}`, { options: rest.length > 1 ? rest[0] : null, handler: rest.at(-1) });
    };
  const router = { get: register("GET"), post: register("POST"), patch: register("PATCH"), delete: register("DELETE") };
  const logged: unknown[] = [];
  const logger = { error: (error: unknown) => logged.push(error) };
  const call = async (key: string, request: { params?: unknown; body?: unknown }) => {
    const sent = { code: 200, payload: undefined as unknown };
    const reply = {
      status(code: number) {
        sent.code = code;
        return reply;
      },
      send(payload: unknown) {
        sent.payload = payload;
        return reply;
      },
    };
    const result = await routes.get(key)!.handler({ params: {}, body: undefined, ...request }, reply);
    return result === reply ? sent : { code: 200, payload: result };
  };

  const { store } = setup();
  await storyWriterRoutes(store, logger)(router);
  assert.deepEqual(routes.get("PATCH /stories/:storyId/chapters/:chapterId")!.options, { bodyLimit: 4 * 1024 * 1024 });
  assert.equal(routes.get("GET /stories/:storyId")!.options, null);
  const created = await call("POST /stories", { body: { settings: { title: "Via route" } } });
  const storyId = (created.payload as { story: { id: string; settings: { title: string } } }).story.id;
  assert.equal(created.code, 200);
  assert.deepEqual(await call("GET /stories/:storyId", { params: { storyId: "no" } }), {
    code: 400,
    payload: { error: "Story id is invalid." },
  });
  assert.equal((await call("GET /stories/:storyId", { params: { storyId: randomUUID() } })).code, 404);
  assert.equal((await call("PATCH /stories/:storyId", { params: { storyId }, body: { title: "x" } })).code, 400);

  const failing = memoryPersistence();
  failing.persistence.documents.list = async () => {
    throw new Error("disk failed at /private/data/path");
  };
  routes.clear();
  await storyWriterRoutes(createStoryStore(failing.persistence), logger)(router);
  assert.deepEqual(await call("GET /stories", {}), {
    code: 500,
    payload: { error: "Story Writer could not complete the request." },
  });
  assert.equal(logged.length, 1);
  assert.match(String(logged[0]), /disk failed/);
});

test("a chapter left unlisted by a failed story update is adopted by the retry, with the latest text", async () => {
  const { store, failNextUpdate } = setup();
  const { story } = await store.createStory({ title: "Unlucky" });
  const chapterId = "chapter-retry-0001";
  failNextUpdate(storyDocumentId(story.id));
  await assert.rejects(store.createChapter(story.id, { id: chapterId, text: "First try" }));
  assert.deepEqual((await store.getStory(story.id)).chapters, [], "the half-made chapter is not listed");

  const retried = await store.createChapter(story.id, { id: chapterId, text: "Second try, longer" });
  assert.deepEqual(
    retried.chapters.map((chapter) => [chapter.id, chapter.text]),
    [[chapterId, "Second try, longer"]],
  );
  assert.equal(retried.story.wordCount, 3);
  assert.equal(retried.story.chapterCount, 1);

  await assert.rejects(store.createChapter(story.id, { id: chapterId, text: "Again" }), { statusCode: 409 });
  const other = await store.createStory({ title: "Other" });
  await assert.rejects(store.createChapter(other.story.id, { id: chapterId, text: "Theft" }), { statusCode: 409 });
  assert.equal((await store.getStory(story.id)).chapters[0]?.text, "Second try, longer");
});
