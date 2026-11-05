// ──────────────────────────────────────────────
// Story Writer: stories, chapters and preferences in the package's document store
// ──────────────────────────────────────────────
// Chapters are separate documents, so listing stories never loads their text. Writes to one story run one at a time
// in this process, and every revisioned update re-reads and re-applies its change when another writer got there first.
import { randomUUID } from "node:crypto";
import {
  CLIENT_ID_PATTERN,
  LIMITS,
  PREFERENCES_DOCUMENT_ID,
  STORY_WRITER_PACKAGE_ID,
  chapterDocumentId,
  countWords,
  defaultPreferences,
  normalizeChapterPatch,
  normalizePreferences,
  normalizeStorySettings,
  storyDocumentId,
  type StoryChapter,
  type StoryRecord,
  type StorySummary,
  type StoryWithChapters,
  type StoryWriterPreferences,
} from "../../../../client/src/lib/story-writer/model.js";

export interface StoryDocument {
  id: string;
  packageId: string;
  kind: string;
  name: string;
  description: string;
  data: unknown;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryDocumentUpdate {
  id: string;
  packageId: string;
  expectedRevision: number;
  name: string;
  description: string;
  data: unknown;
  updatedAt: string;
}

/** The part of the Engine's `persistence.documents` the store uses (tests pass an in-memory fake). */
export interface StoryDocumentStore {
  list(packageId: string, kind: string): Promise<StoryDocument[]>;
  getById(packageId: string, id: string): Promise<StoryDocument | null>;
  create(input: Omit<StoryDocument, "revision">): Promise<StoryDocument>;
  /** Resolves null when `expectedRevision` is stale. */
  update(input: StoryDocumentUpdate): Promise<StoryDocument | null>;
  remove(packageId: string, id: string, expectedRevision: number): Promise<boolean>;
}

export interface StoryPersistence {
  documents: StoryDocumentStore;
  transaction?<T>(operation: (session: { documents: StoryDocumentStore }) => Promise<T>): Promise<T>;
}

/** An error the routes may show the client as is. */
export class StoryWriterError extends Error {
  readonly statusCode: 400 | 404 | 409;

  constructor(statusCode: 400 | 404 | 409, message: string) {
    super(message);
    this.name = "StoryWriterError";
    this.statusCode = statusCode;
  }
}

const PACKAGE_ID = STORY_WRITER_PACKAGE_ID;
const STORY_PREFIX = storyDocumentId("");
const CHAPTER_PREFIX = chapterDocumentId("");
const MAX_ATTEMPTS = 3;
const STORY_NOT_FOUND = "Story not found.";
const CHAPTER_NOT_FOUND = "Chapter not found.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

function requireId(value: unknown, label: "Story" | "Chapter"): string {
  if (typeof value !== "string" || !CLIENT_ID_PATTERN.test(value)) {
    throw new StoryWriterError(400, `${label} id is invalid.`);
  }
  return value;
}

function requireObject(value: unknown, message: string): Record<string, unknown> {
  if (!isRecord(value)) throw new StoryWriterError(400, message);
  return value;
}

function conflict(): StoryWriterError {
  return new StoryWriterError(409, "Story Writer data changed while saving. Try again.");
}

// Stored data is normalized on every read, so a document from an older version or a hand edit still has the full shape.
function parseStory(document: StoryDocument): StoryRecord {
  const data = isRecord(document.data) ? document.data : {};
  const chapterIds = Array.isArray(data.chapterIds)
    ? [...new Set(data.chapterIds.filter((id): id is string => typeof id === "string" && CLIENT_ID_PATTERN.test(id)))]
    : [];
  const wordCount = typeof data.wordCount === "number" && Number.isFinite(data.wordCount) ? data.wordCount : 0;
  return {
    id: document.id.slice(STORY_PREFIX.length),
    settings: normalizeStorySettings(data.settings),
    chapterIds,
    wordCount: Math.max(0, Math.round(wordCount)),
    chapterCount: chapterIds.length,
    createdAt: stringOr(data.createdAt, document.createdAt),
    updatedAt: stringOr(data.updatedAt, document.updatedAt),
  };
}

function parseChapter(document: StoryDocument): StoryChapter {
  const data = isRecord(document.data) ? document.data : {};
  const fields = normalizeChapterPatch(data);
  return {
    id: document.id.slice(CHAPTER_PREFIX.length),
    storyId: stringOr(data.storyId, ""),
    text: fields.text ?? "",
    summary: fields.summary ?? "",
    status: fields.status ?? "draft",
    request: fields.request ?? "",
    createdAt: stringOr(data.createdAt, document.createdAt),
    updatedAt: stringOr(data.updatedAt, document.updatedAt),
  };
}

interface DocumentType<T> {
  kind: "preferences" | "story" | "chapter";
  parse(document: StoryDocument): T;
  describe(value: T): { name: string; description: string };
}

const PREFERENCES: DocumentType<StoryWriterPreferences> = {
  kind: "preferences",
  parse: (document) => normalizePreferences(document.data),
  describe: () => ({ name: "Story Writer preferences", description: "Reading and layout preferences" }),
};

const STORY: DocumentType<StoryRecord> = {
  kind: "story",
  parse: parseStory,
  describe: (story) => ({
    name: story.settings.title.trim().slice(0, 200) || "Untitled story",
    description: "Story Writer story",
  }),
};

const CHAPTER: DocumentType<StoryChapter> = {
  kind: "chapter",
  parse: parseChapter,
  describe: (chapter) => ({ name: "Story Writer chapter", description: chapter.storyId }),
};

function createDocument<T>(documents: StoryDocumentStore, type: DocumentType<T>, id: string, value: T, at: string) {
  return documents.create({
    id,
    packageId: PACKAGE_ID,
    kind: type.kind,
    ...type.describe(value),
    data: value,
    createdAt: at,
    updatedAt: at,
  });
}

/** Optimistic update: on a revision conflict, re-read the document and apply `change` again. */
async function updateDocument<T>(
  documents: StoryDocumentStore,
  type: DocumentType<T>,
  id: string,
  change: (current: T) => T,
  missing: string,
  at: string,
): Promise<{ previous: T; next: T }> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const document = await documents.getById(PACKAGE_ID, id);
    if (!document) throw new StoryWriterError(404, missing);
    const previous = type.parse(document);
    const next = change(previous);
    const saved = await documents.update({
      id,
      packageId: PACKAGE_ID,
      expectedRevision: document.revision,
      ...type.describe(next),
      data: next,
      updatedAt: at,
    });
    if (saved) return { previous, next };
  }
  throw conflict();
}

async function removeDocument(documents: StoryDocumentStore, id: string) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const document = await documents.getById(PACKAGE_ID, id);
    if (!document || (await documents.remove(PACKAGE_ID, id, document.revision))) return;
  }
  throw conflict();
}

async function readStory(documents: StoryDocumentStore, storyId: string): Promise<StoryRecord> {
  const document = await documents.getById(PACKAGE_ID, storyDocumentId(storyId));
  if (!document) throw new StoryWriterError(404, STORY_NOT_FOUND);
  return parseStory(document);
}

/** The story's chapters in `chapterIds` order, skipping missing documents and chapters of another story. */
async function readChapters(documents: StoryDocumentStore, story: StoryRecord): Promise<StoryChapter[]> {
  const found = await Promise.all(story.chapterIds.map((id) => documents.getById(PACKAGE_ID, chapterDocumentId(id))));
  return found.flatMap((document) => {
    const chapter = document ? parseChapter(document) : null;
    return chapter?.storyId === story.id ? [chapter] : [];
  });
}

function totalsOf(chapters: StoryChapter[]) {
  return {
    chapterIds: chapters.map((chapter) => chapter.id),
    chapterCount: chapters.length,
    wordCount: chapters.reduce((sum, chapter) => sum + countWords(chapter.text), 0),
  };
}

export function createStoryStore(persistence: StoryPersistence, options: { now?: () => string } = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const queues = new Map<string, Promise<unknown>>();

  // One promise chain per story (and one for preferences): writes and the reads that may repair a story never overlap.
  function serialized<T>(key: string, task: () => Promise<T>): Promise<T> {
    const result = (queues.get(key) ?? Promise.resolve()).then(task);
    const tail = result.catch(() => undefined);
    queues.set(key, tail);
    void tail.then(() => {
      if (queues.get(key) === tail) queues.delete(key);
    });
    return result;
  }

  // Without host transactions each step still retries on its own, and loadStory repairs what a half-finished write left.
  function inTransaction<T>(operation: (documents: StoryDocumentStore) => Promise<T>): Promise<T> {
    return persistence.transaction
      ? persistence.transaction((session) => operation(session.documents))
      : operation(persistence.documents);
  }

  async function loadStory(storyId: string): Promise<StoryWithChapters> {
    const documents = persistence.documents;
    const story = await readStory(documents, storyId);
    const chapters = await readChapters(documents, story);
    const totals = totalsOf(chapters);
    if (totals.chapterCount === story.chapterIds.length && totals.wordCount === story.wordCount) {
      return { story, chapters };
    }
    // A missing chapter or stale totals: store what the chapters really hold. Not an edit, so updatedAt stays.
    const { next } = await updateDocument(
      documents,
      STORY,
      storyDocumentId(storyId),
      (current) => ({ ...current, ...totals }),
      STORY_NOT_FOUND,
      now(),
    );
    return { story: next, chapters };
  }

  return {
    async getPreferences(): Promise<StoryWriterPreferences> {
      const document = await persistence.documents.getById(PACKAGE_ID, PREFERENCES_DOCUMENT_ID);
      return document ? PREFERENCES.parse(document) : defaultPreferences();
    },

    async patchPreferences(patch: unknown): Promise<StoryWriterPreferences> {
      const input = requireObject(patch, "Preferences must be an object.");
      return serialized(PREFERENCES_DOCUMENT_ID, async () => {
        const documents = persistence.documents;
        const at = now();
        if (!(await documents.getById(PACKAGE_ID, PREFERENCES_DOCUMENT_ID))) {
          const preferences = normalizePreferences(input);
          try {
            await createDocument(documents, PREFERENCES, PREFERENCES_DOCUMENT_ID, preferences, at);
            return preferences;
          } catch (error) {
            // Another writer created it first: update theirs below.
            if (!(await documents.getById(PACKAGE_ID, PREFERENCES_DOCUMENT_ID))) throw error;
          }
        }
        const { next } = await updateDocument(
          documents,
          PREFERENCES,
          PREFERENCES_DOCUMENT_ID,
          (current) => normalizePreferences(input, current),
          "Preferences not found.",
          at,
        );
        return next;
      });
    },

    async listStories(): Promise<StorySummary[]> {
      const documents = await persistence.documents.list(PACKAGE_ID, STORY.kind);
      return documents
        .filter((document) => document.id.startsWith(STORY_PREFIX))
        .map(parseStory)
        .map(({ id, settings, wordCount, chapterCount, createdAt, updatedAt }) => ({
          id,
          title: settings.title,
          wordCount,
          chapterCount,
          createdAt,
          updatedAt,
        }))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },

    async createStory(settings?: unknown): Promise<StoryWithChapters> {
      if (settings !== undefined && settings !== null) requireObject(settings, "Story settings must be an object.");
      const at = now();
      const story: StoryRecord = {
        id: randomUUID(),
        settings: normalizeStorySettings(settings),
        chapterIds: [],
        wordCount: 0,
        chapterCount: 0,
        createdAt: at,
        updatedAt: at,
      };
      await createDocument(persistence.documents, STORY, storyDocumentId(story.id), story, at);
      return { story, chapters: [] };
    },

    async getStory(storyId: unknown): Promise<StoryWithChapters> {
      const id = requireId(storyId, "Story");
      return serialized(storyDocumentId(id), () => loadStory(id));
    },

    async patchStorySettings(storyId: unknown, settings: unknown): Promise<StoryRecord> {
      const id = requireId(storyId, "Story");
      const patch = requireObject(settings, "Story settings must be an object.");
      return serialized(storyDocumentId(id), async () => {
        const at = now();
        const { next } = await updateDocument(
          persistence.documents,
          STORY,
          storyDocumentId(id),
          (current) => ({ ...current, settings: normalizeStorySettings(patch, current.settings), updatedAt: at }),
          STORY_NOT_FOUND,
          at,
        );
        return next;
      });
    },

    async duplicateStory(storyId: unknown): Promise<StoryWithChapters> {
      const id = requireId(storyId, "Story");
      return serialized(storyDocumentId(id), async () => {
        const source = await loadStory(id);
        const at = now();
        const copyId = randomUUID();
        const chapters = source.chapters.map((chapter) => ({
          ...chapter,
          id: randomUUID(),
          storyId: copyId,
          createdAt: at,
          updatedAt: at,
        }));
        // Titles stop at 300 characters; keep room for the suffix.
        const title = `${source.story.settings.title.slice(0, 293)} (copy)`.trim();
        const story: StoryRecord = {
          id: copyId,
          settings: normalizeStorySettings({ title }, source.story.settings),
          ...totalsOf(chapters),
          createdAt: at,
          updatedAt: at,
        };
        await inTransaction(async (documents) => {
          for (const chapter of chapters) {
            await createDocument(documents, CHAPTER, chapterDocumentId(chapter.id), chapter, at);
          }
          await createDocument(documents, STORY, storyDocumentId(copyId), story, at);
        });
        return { story, chapters };
      });
    },

    async deleteStory(storyId: unknown): Promise<{ ok: true }> {
      const id = requireId(storyId, "Story");
      return serialized(storyDocumentId(id), async () => {
        await inTransaction(async (documents) => {
          const story = await readStory(documents, id);
          // Chapters first: a story left behind by a failed delete still lists them; orphaned chapters would not be.
          for (const chapterId of story.chapterIds) {
            const document = await documents.getById(PACKAGE_ID, chapterDocumentId(chapterId));
            if (document && parseChapter(document).storyId === id) await removeDocument(documents, document.id);
          }
          await removeDocument(documents, storyDocumentId(id));
        });
        return { ok: true as const };
      });
    },

    async createChapter(storyId: unknown, input: unknown): Promise<StoryWithChapters> {
      const id = requireId(storyId, "Story");
      const body = input === undefined || input === null ? {} : requireObject(input, "Chapter must be an object.");
      const chapterId = body.id === undefined || body.id === null ? randomUUID() : requireId(body.id, "Chapter");
      const fields = normalizeChapterPatch(body);
      return serialized(storyDocumentId(id), async () => {
        const at = now();
        const chapter: StoryChapter = {
          id: chapterId,
          storyId: id,
          text: fields.text ?? "",
          summary: fields.summary ?? "",
          status: fields.status ?? "draft",
          request: fields.request ?? "",
          createdAt: at,
          updatedAt: at,
        };
        await inTransaction(async (documents) => {
          const story = await readStory(documents, id);
          if (story.chapterIds.length >= LIMITS.chaptersPerStory) {
            throw new StoryWriterError(400, `A story can have at most ${LIMITS.chaptersPerStory} chapters.`);
          }
          const existing = await documents.getById(PACKAGE_ID, chapterDocumentId(chapterId));
          let stored = chapter;
          if (existing) {
            // A chapter of this story that is stored but not listed was left by a create whose story update failed
            // (a host without transactions): adopt it with what was sent now. A listed chapter, or another story's,
            // keeps its id.
            const previous = parseChapter(existing);
            if (previous.storyId !== id || story.chapterIds.includes(chapterId)) {
              throw new StoryWriterError(409, "A chapter with this id already exists.");
            }
            ({ next: stored } = await updateDocument(
              documents,
              CHAPTER,
              chapterDocumentId(chapterId),
              (current) => ({ ...current, ...fields, updatedAt: at }),
              "Chapter not found.",
              at,
            ));
          } else {
            await createDocument(documents, CHAPTER, chapterDocumentId(chapterId), chapter, at);
          }
          const words = countWords(stored.text);
          await updateDocument(
            documents,
            STORY,
            storyDocumentId(id),
            (current) => {
              const chapterIds = [...current.chapterIds, chapterId];
              return {
                ...current,
                chapterIds,
                chapterCount: chapterIds.length,
                wordCount: current.wordCount + words,
                updatedAt: at,
              };
            },
            STORY_NOT_FOUND,
            at,
          );
        });
        return loadStory(id);
      });
    },

    async patchChapter(storyId: unknown, chapterId: unknown, patch: unknown) {
      const id = requireId(storyId, "Story");
      const targetId = requireId(chapterId, "Chapter");
      const fields = normalizeChapterPatch(requireObject(patch, "Chapter changes must be an object."));
      if (Object.keys(fields).length === 0) throw new StoryWriterError(400, "No chapter field to update.");
      return serialized(storyDocumentId(id), () =>
        inTransaction(async (documents): Promise<{ story: StoryRecord; chapter: StoryChapter }> => {
          const at = now();
          const story = await readStory(documents, id);
          if (!story.chapterIds.includes(targetId)) throw new StoryWriterError(404, CHAPTER_NOT_FOUND);
          const { previous, next: chapter } = await updateDocument(
            documents,
            CHAPTER,
            chapterDocumentId(targetId),
            (current) => {
              if (current.storyId !== id) throw new StoryWriterError(404, CHAPTER_NOT_FOUND);
              return { ...current, ...fields, updatedAt: at };
            },
            CHAPTER_NOT_FOUND,
            at,
          );
          const delta = countWords(chapter.text) - countWords(previous.text);
          const { next } = await updateDocument(
            documents,
            STORY,
            storyDocumentId(id),
            (current) => ({
              ...current,
              wordCount: Math.max(0, current.wordCount + delta),
              chapterCount: current.chapterIds.length,
              updatedAt: at,
            }),
            STORY_NOT_FOUND,
            at,
          );
          return { story: next, chapter };
        }),
      );
    },

    async deleteChapter(storyId: unknown, chapterId: unknown): Promise<StoryWithChapters> {
      const id = requireId(storyId, "Story");
      const targetId = requireId(chapterId, "Chapter");
      return serialized(storyDocumentId(id), async () => {
        await inTransaction(async (documents) => {
          const at = now();
          const story = await readStory(documents, id);
          if (!story.chapterIds.includes(targetId)) throw new StoryWriterError(404, CHAPTER_NOT_FOUND);
          const document = await documents.getById(PACKAGE_ID, chapterDocumentId(targetId));
          const chapter = document ? parseChapter(document) : null;
          if (chapter && chapter.storyId !== id) throw new StoryWriterError(404, CHAPTER_NOT_FOUND);
          if (document) await removeDocument(documents, document.id);
          const words = chapter ? countWords(chapter.text) : 0;
          await updateDocument(
            documents,
            STORY,
            storyDocumentId(id),
            (current) => {
              const chapterIds = current.chapterIds.filter((candidate) => candidate !== targetId);
              return {
                ...current,
                chapterIds,
                chapterCount: chapterIds.length,
                wordCount: Math.max(0, current.wordCount - words),
                updatedAt: at,
              };
            },
            STORY_NOT_FOUND,
            at,
          );
        });
        return loadStory(id);
      });
    },
  };
}

export type StoryStore = ReturnType<typeof createStoryStore>;
