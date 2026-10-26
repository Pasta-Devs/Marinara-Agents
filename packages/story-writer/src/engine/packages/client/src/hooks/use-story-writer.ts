// ──────────────────────────────────────────────
// Story Writer: package REST hooks and the open story's local document state
// ──────────────────────────────────────────────
// Every edit lands in the React Query cache at once and reaches the server through one request chain per document:
// writes to a document never overlap, and a slow response never replaces text typed after its request was sent.
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api, getApiErrorMessage } from "../lib/api-client";
import { generateClientId } from "../lib/utils";
import {
  CLIENT_ID_PATTERN,
  normalizeChapterPatch,
  normalizePreferences,
  normalizeStorySettings,
  type ChapterCreate,
  type ChapterPatch,
  type StoryChapter,
  type StoryRecord,
  type StorySettings,
  type StorySummary,
  type StoryWithChapters,
  type StoryWriterPreferences,
} from "../lib/story-writer/model";

export const storyWriterKeys = {
  preferences: ["story-writer", "preferences"] as const,
  stories: ["story-writer", "stories"] as const,
  story: (id: string) => ["story-writer", "story", id] as const,
};

const SETTINGS_SAVE_DELAY = 600;
const CHAPTER_SAVE_DELAY = 800;
const RETRY_DELAY = 5_000;
const PREFERENCES_KEY = "preferences";

type Timer = ReturnType<typeof setTimeout>;
type Patch = Record<string, unknown>;

interface SaveTarget {
  qc: QueryClient;
  storyId: string;
  errorKey: string;
  request(storyId: string, patch: Patch): Promise<unknown>;
  apply(qc: QueryClient, storyId: string, result: unknown): void;
  /** Undoes a write the server refused. Without it, the document loads again. */
  refuse?(): void;
}

interface PendingSave extends SaveTarget {
  patch: Patch;
  timer: Timer | null;
  waiters: Array<() => void>;
  /** Waiting for this key's request in flight; it sends everything that piled up once that one settles. */
  queued: boolean;
}

// ── Save bookkeeping. Module state, because the cache it guards is the Engine's one QueryClient and outlives the view.
// Keys: "preferences", "settings:<storyId>" and "chapter:<chapterId>".

/** Local edits per key, and the edit the server has acknowledged. A key is dirty while edits > confirmed. */
const edits = new Map<string, number>();
const confirmed = new Map<string, number>();
const queues = new Map<string, Promise<void>>();
/** Requests queued per key so far, so a failed request can tell whether a later one waits behind it. */
const requestCounts = new Map<string, number>();
/** The patch of a failed request with a later one queued behind it: that one sends it under its own patch. */
const carried = new Map<string, Patch>();
const pendingSaves = new Map<string, PendingSave>();
/** Keys whose last save failed with a network or server error: reported once until a save succeeds. */
const failing = new Set<string>();
/** Chapters the server may not have yet, by save key: until one is created, its key's requests create it. */
const creatingChapters = new Map<string, SaveTarget>();
const deletingChapters = new Set<string>();
/** Stories being deleted or deleted: a save that finds one gone is not an error. */
const removedStories = new Set<string>();
const savingListeners = new Set<() => void>();
let requestsInFlight = 0;
let translate: (key: string) => string = (key) => key;

const settingsKey = (storyId: string) => `settings:${storyId}`;
const chapterKey = (chapterId: string) => `chapter:${chapterId}`;
const storyPath = (storyId: string) => `/story-writer/stories/${encodeURIComponent(storyId)}`;

function bump(key: string): number {
  const next = (edits.get(key) ?? 0) + 1;
  edits.set(key, next);
  return next;
}

function confirmEdit(key: string, sent: number) {
  if ((confirmed.get(key) ?? 0) < sent) confirmed.set(key, sent);
}

function isDirty(key: string): boolean {
  return (edits.get(key) ?? 0) > (confirmed.get(key) ?? 0);
}

function isSaving(): boolean {
  return requestsInFlight > 0 || pendingSaves.size > 0;
}

function notifySaving() {
  for (const listener of savingListeners) listener();
}

function subscribeSaving(listener: () => void) {
  savingListeners.add(listener);
  return () => {
    savingListeners.delete(listener);
  };
}

function reportError(error: unknown, key: string) {
  toast.error(getApiErrorMessage(error, translate(key)));
}

const errorStatus = (error: unknown) => (error as { status?: unknown } | null)?.status;

// A refusal the author cannot fix by waiting. 408 and 429 come from proxies and limits, and 409 is the server's
// "data changed while saving": those are retried like a dropped connection.
function isClientError(error: unknown): boolean {
  const status = errorStatus(error);
  return (
    typeof status === "number" && status >= 400 && status < 500 && status !== 408 && status !== 409 && status !== 429
  );
}

function pickKeys(source: object, keys: object): Patch {
  const values = source as Patch;
  return Object.fromEntries(Object.keys(keys).map((key) => [key, values[key]]));
}

/** Runs `task` after every earlier request for `key`, with its number in that line. Rejects when the task does. */
function enqueue<T>(key: string, task: (request: number) => Promise<T>): Promise<T> {
  const request = (requestCounts.get(key) ?? 0) + 1;
  requestCounts.set(key, request);
  const run = (queues.get(key) ?? Promise.resolve()).then(() => task(request));
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  queues.set(key, settled);
  requestsInFlight += 1;
  notifySaving();
  void settled.then(() => {
    requestsInFlight -= 1;
    if (queues.get(key) === settled) queues.delete(key);
    notifySaving();
  });
  return run;
}

/** Merges `patch` into the key's pending save. `delay: null` sends it now (after a request already in flight). */
function scheduleSave(key: string, target: SaveTarget, patch: Patch, delay: number | null): Promise<void> {
  const save: PendingSave = pendingSaves.get(key) ?? {
    ...target,
    patch: {},
    timer: null,
    waiters: [],
    queued: false,
  };
  save.patch = { ...save.patch, ...patch };
  if (save.timer) clearTimeout(save.timer);
  save.timer = delay === null ? null : setTimeout(() => void flushSave(key), delay);
  pendingSaves.set(key, save);
  const done = new Promise<void>((resolve) => save.waiters.push(resolve));
  notifySaving();
  if (delay === null) void flushSave(key);
  return done;
}

/** Sends the key's pending patch. Unless `now`, a request in flight for the key goes first and this one coalesces. */
function flushSave(key: string, now = false): Promise<void> {
  const save = pendingSaves.get(key);
  if (!save) return queues.get(key) ?? Promise.resolve();
  const busy = queues.get(key);
  if (busy && !now) {
    if (save.timer) clearTimeout(save.timer);
    save.timer = null;
    if (!save.queued) {
      save.queued = true;
      void busy.then(() => {
        save.queued = false;
        void flushSave(key);
      });
    }
    return busy;
  }
  pendingSaves.delete(key);
  if (save.timer) clearTimeout(save.timer);
  const sent = edits.get(key) ?? 0;
  const done = enqueue(key, async (request) => {
    // A failed earlier request's patch goes out under this newer one, never after it.
    const patch = { ...carried.get(key), ...save.patch };
    carried.delete(key);
    // A chapter the server may not have yet is created by whichever of its saves goes out first.
    const target = creatingChapters.get(key) ?? save;
    try {
      const result = await target.request(target.storyId, patch);
      confirmEdit(key, sent);
      failing.delete(key);
      target.apply(target.qc, target.storyId, result);
    } catch (error) {
      if (isClientError(error)) {
        // The server refused this write: show its version again instead of retrying forever.
        confirmEdit(key, sent);
        failing.delete(key);
        // The story was deleted meanwhile: nothing is left to save or to show.
        if (removedStories.has(target.storyId)) return;
        reportError(error, target.errorKey);
        if (target.refuse) target.refuse();
        else
          void target.qc.invalidateQueries({
            queryKey: key === PREFERENCES_KEY ? storyWriterKeys.preferences : storyWriterKeys.story(target.storyId),
          });
        return;
      }
      if (!failing.has(key)) reportError(error, target.errorKey);
      failing.add(key);
      // Keep the edit and try again under anything newer: a request queued behind this one, else what was typed since.
      const newer = pendingSaves.get(key);
      if ((requestCounts.get(key) ?? 0) > request) carried.set(key, patch);
      else if (newer) newer.patch = { ...patch, ...newer.patch };
      else void scheduleSave(key, save, patch, RETRY_DELAY);
    }
  });
  void done.then(() => {
    for (const resolve of save.waiters) resolve();
  });
  return done;
}

function dropSaves(match: (key: string, save: PendingSave) => boolean) {
  for (const [key, save] of pendingSaves) {
    if (!match(key, save)) continue;
    if (save.timer) clearTimeout(save.timer);
    pendingSaves.delete(key);
    failing.delete(key);
    for (const resolve of save.waiters) resolve();
  }
  notifySaving();
}

/**
 * Sends every pending save now. Resolves to false while a save is failing (it keeps retrying); edits made while this
 * runs are not failures.
 */
async function flushAllSaves(): Promise<boolean> {
  for (const key of [...pendingSaves.keys()]) void flushSave(key, true);
  await Promise.all([...queues.values()]);
  return failing.size === 0;
}

// ── Cache helpers ──

function updateStoryCache(qc: QueryClient, storyId: string, update: (doc: StoryWithChapters) => StoryWithChapters) {
  qc.setQueryData<StoryWithChapters>(storyWriterKeys.story(storyId), (current) =>
    current ? update(current) : current,
  );
}

/** A server record over the local one. Local settings stay while they have unsaved edits; so does the chapter order. */
function mergeRecord(local: StoryRecord, server: StoryRecord): StoryRecord {
  const settings = isDirty(settingsKey(server.id)) ? local.settings : server.settings;
  return { ...server, settings, chapterIds: local.chapterIds };
}

/** A whole server document over the local one, keeping chapters with unsaved edits and chapters still being created. */
function mergeDocument(local: StoryWithChapters | undefined, server: StoryWithChapters): StoryWithChapters {
  if (!local || local.story.id !== server.story.id) return server;
  const localChapters = new Map(local.chapters.map((chapter) => [chapter.id, chapter]));
  const chapters = server.chapters
    .filter((chapter) => !deletingChapters.has(chapter.id))
    .map((chapter) => {
      const mine = localChapters.get(chapter.id);
      return mine && isDirty(chapterKey(chapter.id)) ? mine : chapter;
    });
  const known = new Set(chapters.map((chapter) => chapter.id));
  for (const chapter of local.chapters) {
    if (!known.has(chapter.id) && creatingChapters.has(chapterKey(chapter.id))) chapters.push(chapter);
  }
  const story = mergeRecord(local.story, server.story);
  return { story: { ...story, chapterIds: chapters.map((chapter) => chapter.id) }, chapters };
}

function removeChapter(doc: StoryWithChapters, chapterId: string): StoryWithChapters {
  return {
    story: { ...doc.story, chapterIds: doc.story.chapterIds.filter((id) => id !== chapterId) },
    chapters: doc.chapters.filter((chapter) => chapter.id !== chapterId),
  };
}

/** The story that holds a chapter, so a save started before the author switched stories still goes to the right one. */
function chapterStoryId(qc: QueryClient, chapterId: string): string | null {
  for (const [, doc] of qc.getQueriesData<StoryWithChapters>({ queryKey: ["story-writer", "story"] })) {
    if (doc?.chapters.some((chapter) => chapter.id === chapterId)) return doc.story.id;
  }
  return null;
}

/** Copies the cached story's title and totals into the story list, newest first. */
function syncStorySummary(qc: QueryClient, storyId: string) {
  const doc = qc.getQueryData<StoryWithChapters>(storyWriterKeys.story(storyId));
  if (!doc) return;
  const { story } = doc;
  const summary: StorySummary = {
    id: story.id,
    title: story.settings.title,
    wordCount: story.wordCount,
    chapterCount: story.chapterCount,
    createdAt: story.createdAt,
    updatedAt: story.updatedAt,
  };
  qc.setQueryData<StorySummary[]>(storyWriterKeys.stories, (list) =>
    list
      ? [summary, ...list.filter((item) => item.id !== storyId)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      : list,
  );
}

function settingsTarget(qc: QueryClient, storyId: string): SaveTarget {
  return {
    qc,
    storyId,
    errorKey: "errors.saveSettings",
    request: (id, patch) => api.patch<StoryRecord>(storyPath(id), { settings: patch }),
    apply: (client, id, result) => {
      updateStoryCache(client, id, (doc) => ({ ...doc, story: mergeRecord(doc.story, result as StoryRecord) }));
      syncStorySummary(client, id);
    },
  };
}

function chapterTarget(qc: QueryClient, storyId: string, chapterId: string): SaveTarget {
  const key = chapterKey(chapterId);
  return {
    qc,
    storyId,
    errorKey: "errors.saveChapter",
    request: (id, patch) =>
      api.patch<{ story: StoryRecord; chapter: StoryChapter }>(
        `${storyPath(id)}/chapters/${encodeURIComponent(chapterId)}`,
        patch,
      ),
    apply: (client, id, result) => {
      const saved = result as { story: StoryRecord; chapter: StoryChapter };
      updateStoryCache(client, id, (doc) => ({
        story: mergeRecord(doc.story, saved.story),
        chapters: isDirty(key)
          ? doc.chapters
          : doc.chapters.map((chapter) => (chapter.id === chapterId ? saved.chapter : chapter)),
      }));
      syncStorySummary(client, id);
    },
  };
}

/** Saves for a chapter the server may not have yet. Each attempt creates it as it is now, so it carries every edit. */
function chapterCreateTarget(qc: QueryClient, storyId: string, chapter: StoryChapter): SaveTarget {
  const key = chapterKey(chapter.id);
  const saves = chapterTarget(qc, storyId, chapter.id);
  let attempts = 0;
  return {
    ...saves,
    errorKey: "errors.createChapter",
    request: async (id) => {
      const doc = qc.getQueryData<StoryWithChapters>(storyWriterKeys.story(id));
      const local = doc?.chapters.find((item) => item.id === chapter.id) ?? chapter;
      const fields = normalizeChapterPatch(local);
      attempts += 1;
      try {
        const result = await api.post<StoryWithChapters>(`${storyPath(id)}/chapters`, { ...fields, id: chapter.id });
        creatingChapters.delete(key);
        return { story: result.story, chapter: result.chapters.find((item) => item.id === chapter.id) ?? local };
      } catch (error) {
        // "Already exists" on a retry: an earlier attempt got through and only its response was lost.
        if (attempts === 1 || errorStatus(error) !== 409) throw error;
        creatingChapters.delete(key);
        return saves.request(id, { ...fields });
      }
    },
    refuse: () => {
      creatingChapters.delete(key);
      dropSaves((saveKey) => saveKey === key);
      updateStoryCache(qc, storyId, (doc) => removeChapter(doc, chapter.id));
    },
  };
}

const preferencesTarget = (qc: QueryClient): SaveTarget => ({
  qc,
  storyId: "",
  errorKey: "errors.savePreferences",
  request: (_id, patch) => api.patch<StoryWriterPreferences>("/story-writer/preferences", patch),
  apply: (client, _id, result) => {
    if (!isDirty(PREFERENCES_KEY)) client.setQueryData(storyWriterKeys.preferences, normalizePreferences(result));
  },
});

/** Error toasts are written outside React; this keeps them in the package's current language. */
function useErrorText() {
  const { t } = useTranslation();
  useEffect(() => {
    translate = (key) => t(key);
  }, [t]);
}

function useReportQueryError(error: unknown, key: string) {
  useEffect(() => {
    if (error) reportError(error, key);
  }, [error, key]);
}

// ── Hooks ──

export function usePreferences(): {
  preferences: StoryWriterPreferences;
  isLoading: boolean;
  update(patch: Partial<StoryWriterPreferences>): void;
} {
  useErrorText();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: storyWriterKeys.preferences,
    // Merged here, not in structuralSharing: that also runs for setQueryData and would undo optimistic updates.
    queryFn: async () => {
      const server = await api.get<StoryWriterPreferences>("/story-writer/preferences");
      const local = qc.getQueryData<StoryWriterPreferences>(storyWriterKeys.preferences);
      return local && isDirty(PREFERENCES_KEY) ? local : server;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  useReportQueryError(query.error, "errors.loadPreferences");
  const preferences = useMemo(() => normalizePreferences(query.data ?? {}), [query.data]);
  const update = useCallback(
    (patch: Partial<StoryWriterPreferences>) => {
      const next = normalizePreferences(
        patch,
        normalizePreferences(qc.getQueryData(storyWriterKeys.preferences) ?? {}),
      );
      bump(PREFERENCES_KEY);
      qc.setQueryData(storyWriterKeys.preferences, next);
      void scheduleSave(PREFERENCES_KEY, preferencesTarget(qc), pickKeys(next, patch), null);
    },
    [qc],
  );
  return { preferences, isLoading: query.isLoading, update };
}

export function useStoryList(): {
  stories: StorySummary[];
  isLoading: boolean;
  /** The list could not be loaded (the view must not auto-create a story then). */
  isError: boolean;
  create(settings?: Partial<StorySettings>): Promise<StoryWithChapters>;
  duplicate(storyId: string): Promise<StoryWithChapters>;
  remove(storyId: string): Promise<void>;
} {
  useErrorText();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: storyWriterKeys.stories,
    queryFn: () => api.get<StorySummary[]>("/story-writer/stories"),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  useReportQueryError(query.error, "errors.loadStories");
  const adopt = useCallback(
    (result: StoryWithChapters) => {
      qc.setQueryData(storyWriterKeys.story(result.story.id), result);
      syncStorySummary(qc, result.story.id);
      return result;
    },
    [qc],
  );
  const create = useCallback(
    async (settings?: Partial<StorySettings>) => {
      try {
        return adopt(await api.post<StoryWithChapters>("/story-writer/stories", settings ? { settings } : {}));
      } catch (error) {
        reportError(error, "errors.createStory");
        throw error;
      }
    },
    [adopt],
  );
  const duplicate = useCallback(
    async (storyId: string) => {
      try {
        // The copy is made on the server, so it must have every edit first.
        await flushAllSaves();
        // A save of this story that keeps failing would be missing from the copy. Other stories do not matter here.
        const doc = qc.getQueryData<StoryWithChapters>(storyWriterKeys.story(storyId));
        const keys = [settingsKey(storyId), ...(doc?.chapters ?? []).map((chapter) => chapterKey(chapter.id))];
        if (keys.some((key) => failing.has(key))) throw new Error(translate("errors.duplicateUnsaved"));
        return adopt(await api.post<StoryWithChapters>(`${storyPath(storyId)}/duplicate`));
      } catch (error) {
        reportError(error, "errors.duplicateStory");
        throw error;
      }
    },
    [adopt, qc],
  );
  const remove = useCallback(
    async (storyId: string) => {
      await Promise.all([...queues.values()]);
      // The story's saves stay until the delete succeeds, so a failed delete keeps every edit.
      removedStories.add(storyId);
      try {
        await api.delete<{ ok: true }>(storyPath(storyId));
      } catch (error) {
        removedStories.delete(storyId);
        reportError(error, "errors.deleteStory");
        throw error;
      }
      dropSaves((_key, save) => save.storyId === storyId);
      qc.setQueryData<StorySummary[]>(storyWriterKeys.stories, (list) => list?.filter((item) => item.id !== storyId));
      qc.removeQueries({ queryKey: storyWriterKeys.story(storyId) });
    },
    [qc],
  );
  return {
    stories: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    create,
    duplicate,
    remove,
  };
}

export interface StoryDocumentApi {
  data: StoryWithChapters | null;
  isLoading: boolean;
  /** Any save in flight or pending. */
  saving: boolean;
  /** The story could not be loaded. */
  isError?: boolean;
  /** Loads the story again after an error. */
  reload?: () => void;
  updateSettings(patch: Partial<StorySettings>, options?: { immediate?: boolean }): void;
  setChapterTextLocal(chapterId: string, text: string): void;
  saveChapter(chapterId: string, patch: ChapterPatch, options?: { immediate?: boolean }): Promise<void>;
  createChapter(create: ChapterCreate): Promise<StoryChapter>;
  deleteChapter(chapterId: string): Promise<void>;
  /** Sends every pending save now; resolves to false while a save is failing (it keeps retrying). */
  flush(): Promise<boolean>;
}

export function useStoryDocument(storyId: string | null): StoryDocumentApi {
  useErrorText();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: storyWriterKeys.story(storyId ?? ""),
    // A (re)load keeps unsaved local edits. Merged here, not in structuralSharing: that also runs for setQueryData.
    queryFn: async () => {
      const id = storyId ?? "";
      const server = await api.get<StoryWithChapters>(storyPath(id));
      return mergeDocument(qc.getQueryData<StoryWithChapters>(storyWriterKeys.story(id)), server);
    },
    enabled: !!storyId,
    // Every write goes through this cache, so a refetch could only lose local edits.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const saving = useSyncExternalStore(subscribeSaving, isSaving, isSaving);

  // Send pending edits when the author switches stories, leaves the tab or hides the app.
  useEffect(() => {
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") void flushAllSaves();
    };
    const flushNow = () => void flushAllSaves();
    window.addEventListener("pagehide", flushNow);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pagehide", flushNow);
      document.removeEventListener("visibilitychange", flushWhenHidden);
      void flushAllSaves();
    };
  }, [storyId]);

  const updateSettings = useCallback(
    (patch: Partial<StorySettings>, options?: { immediate?: boolean }) => {
      if (!storyId) return;
      const doc = qc.getQueryData<StoryWithChapters>(storyWriterKeys.story(storyId));
      const next = normalizeStorySettings(patch, doc?.story.settings);
      const key = settingsKey(storyId);
      bump(key);
      updateStoryCache(qc, storyId, (current) => ({ ...current, story: { ...current.story, settings: next } }));
      if ("title" in patch) syncStorySummary(qc, storyId);
      // Send the normalized values, so the server stores exactly what the author sees.
      void scheduleSave(
        key,
        settingsTarget(qc, storyId),
        pickKeys(next, patch),
        options?.immediate ? null : SETTINGS_SAVE_DELAY,
      );
    },
    [qc, storyId],
  );

  const setChapterTextLocal = useCallback(
    (chapterId: string, text: string) => {
      const owner = chapterStoryId(qc, chapterId) ?? storyId;
      if (!owner) return;
      bump(chapterKey(chapterId));
      updateStoryCache(qc, owner, (doc) => ({
        ...doc,
        chapters: doc.chapters.map((chapter) => (chapter.id === chapterId ? { ...chapter, text } : chapter)),
      }));
    },
    [qc, storyId],
  );

  const saveChapter = useCallback(
    (chapterId: string, patch: ChapterPatch, options?: { immediate?: boolean }) => {
      const owner = chapterStoryId(qc, chapterId) ?? storyId;
      if (!owner) return Promise.resolve();
      const fields = normalizeChapterPatch(patch);
      const key = chapterKey(chapterId);
      bump(key);
      updateStoryCache(qc, owner, (doc) => ({
        ...doc,
        chapters: doc.chapters.map((chapter) => (chapter.id === chapterId ? { ...chapter, ...fields } : chapter)),
      }));
      return scheduleSave(
        key,
        chapterTarget(qc, owner, chapterId),
        { ...fields },
        options?.immediate ? null : CHAPTER_SAVE_DELAY,
      );
    },
    [qc, storyId],
  );

  const createChapter = useCallback(
    async (create: ChapterCreate): Promise<StoryChapter> => {
      if (!storyId) throw new Error("No story is open.");
      const owner = storyId;
      const id = create.id && CLIENT_ID_PATTERN.test(create.id) ? create.id : generateClientId();
      const fields = normalizeChapterPatch(create);
      const now = new Date().toISOString();
      const chapter: StoryChapter = {
        id,
        storyId: owner,
        text: fields.text ?? "",
        summary: fields.summary ?? "",
        status: fields.status ?? "draft",
        request: fields.request ?? "",
        createdAt: now,
        updatedAt: now,
      };
      const key = chapterKey(id);
      bump(key);
      creatingChapters.set(key, chapterCreateTarget(qc, owner, chapter));
      updateStoryCache(qc, owner, (doc) => ({
        story: { ...doc.story, chapterIds: [...doc.story.chapterIds, id] },
        chapters: [...doc.chapters, chapter],
      }));
      // The create is this key's first save: saves made while it runs queue behind it, so typing on never reaches a
      // missing chapter. A network or server error keeps the chapter and retries it like any other save.
      await scheduleSave(key, chapterTarget(qc, owner, id), {}, null);
      const saved = qc
        .getQueryData<StoryWithChapters>(storyWriterKeys.story(owner))
        ?.chapters.find((item) => item.id === id);
      // Already reported by the save queue.
      if (!saved || creatingChapters.has(key)) throw new Error("The chapter is not stored yet.");
      return saved;
    },
    [qc, storyId],
  );

  const deleteChapter = useCallback(
    async (chapterId: string) => {
      const owner = chapterStoryId(qc, chapterId) ?? storyId;
      if (!owner) return;
      const key = chapterKey(chapterId);
      dropSaves((saveKey) => saveKey === key);
      const uncreated = creatingChapters.delete(key);
      deletingChapters.add(chapterId);
      updateStoryCache(qc, owner, (doc) => removeChapter(doc, chapterId));
      try {
        const result = await enqueue(key, () => {
          // A save that failed before the delete goes with the chapter.
          carried.delete(key);
          failing.delete(key);
          return api.delete<StoryWithChapters>(`${storyPath(owner)}/chapters/${encodeURIComponent(chapterId)}`);
        });
        deletingChapters.delete(chapterId);
        qc.setQueryData<StoryWithChapters>(storyWriterKeys.story(owner), (current) => mergeDocument(current, result));
        syncStorySummary(qc, owner);
      } catch (error) {
        deletingChapters.delete(chapterId);
        // Its create never got through, so there is nothing to delete.
        if (uncreated && errorStatus(error) === 404) return;
        reportError(error, "errors.deleteChapter");
        void qc.invalidateQueries({ queryKey: storyWriterKeys.story(owner) });
      }
    },
    [qc, storyId],
  );

  const flush = useCallback(() => flushAllSaves(), []);
  const { data, isLoading, isError, refetch } = query;
  const reload = useCallback(() => void refetch(), [refetch]);

  return useMemo(
    () => ({
      data: storyId ? (data ?? null) : null,
      isLoading: !!storyId && isLoading,
      saving,
      isError,
      reload,
      updateSettings,
      setChapterTextLocal,
      saveChapter,
      createChapter,
      deleteChapter,
      flush,
    }),
    [
      storyId,
      data,
      isLoading,
      saving,
      isError,
      reload,
      updateSettings,
      setChapterTextLocal,
      saveChapter,
      createChapter,
      deleteChapter,
      flush,
    ],
  );
}
