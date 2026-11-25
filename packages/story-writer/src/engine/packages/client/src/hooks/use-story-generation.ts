// ──────────────────────────────────────────────
// Story Writer: chapter, summary and timeline generation through the Engine's raw route
// ──────────────────────────────────────────────
// Every operation reads the story from the React Query cache when it needs it, never from a render's closure: a
// chapter streams for minutes while the author keeps editing settings and the sticky note.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api, getApiErrorMessage } from "../lib/api-client";
import {
  countWords,
  LIMITS,
  type StoryChapter,
  type StorySettings,
  type StoryWithChapters,
} from "../lib/story-writer/model";
import {
  buildSummaryMessages,
  buildTimelineMessages,
  createClientId,
  endsMidSentence,
  findBannedPhrases,
  joinContinuation,
  parseTimelineResponse,
  planChapter,
  tokenBudget,
  visibleStreamingText,
  type ChatMessage,
  type PromptSources,
} from "../lib/story-writer/prompt";
import { recordGeneration, redoOffer, type LatestGeneration } from "../lib/story-writer/redo";
import {
  loadPromptCharacters,
  loadPromptLore,
  loadPromptPersonas,
  resolveDefaultConnectionId,
  type ConnectionOption,
} from "./use-engine-resources";
import { storyWriterKeys, type StoryDocumentApi } from "./use-story-writer";

export type GenerationStatus = "idle" | "writing" | "summarizing" | "timeline";

/** The prompt the Engine would send for the primary Write button, as its raw route answers `returnPrompt`. */
export interface PromptPeek {
  /** "generate": the Generate button of Chapter length "Off", which continues the chapter the author is on. */
  mode: "next" | "continue" | "generate";
  chapterNumber: number;
  model: string;
  maxTokens: number | null;
  messages: Array<{ role: string; content: string }>;
}

export interface StoryGenerationApi {
  status: GenerationStatus;
  generatingChapterId: string | null;
  /** Words in the chapter being written so far. */
  liveWords: number;
  /** A connection is selected or available and nothing is running. */
  canWrite: boolean;
  /**
   * `request` (a quick reply) is sent in place of the continue message; a new chapter stores it as its request.
   * "generate" continues the selected chapter (see generateTarget) and never creates one.
   */
  write(mode: "next" | "continue" | "rewrite" | "generate", request?: string): Promise<void>;
  /** The chapter Redo would write again, or null when Redo is not offered (see redoOffer). */
  redoChapter: number | null;
  /** Takes back what the latest generation wrote and writes it again with the same instruction. */
  redo(): Promise<void>;
  /**
   * What the primary Write button would send right now, without writing: no run, no status, no chapter change.
   * Null when there is no story or no connection.
   */
  peekPrompt(signal: AbortSignal): Promise<PromptPeek | null>;
  stop(): void;
  summarizeChapter(chapterId: string): Promise<void>;
  summarizeOlderChapters(): Promise<void>;
  fillTimeline(): Promise<void>;
}

const SUMMARY_MAX_TOKENS = 1_200;
const TIMELINE_MAX_TOKENS = 3_000;
const SAVE_EVERY_MS = 3_000;

interface Run {
  storyId: string;
  /** The document API of the story the run started on; a story switch stops the run. */
  doc: StoryDocumentApi;
  controller: AbortController;
  runId: string | null;
}

type Translate = ReturnType<typeof useTranslation>["t"];

interface OperationContext {
  run: Run;
  connection: ConnectionOption;
  streaming: boolean;
  debugMode: boolean;
  queryClient: QueryClient;
  t: Translate;
  readStory(): StoryWithChapters | null;
  setStatus(status: GenerationStatus): void;
  setLive(chapterId: string | null, words: number): void;
}

interface Completion {
  content: string;
  aborted: boolean;
  /** The route reported the whole reply (a `result` event, or the non-streaming JSON). */
  finished: boolean;
}

function isAbortError(error: unknown): boolean {
  return !!error && typeof error === "object" && (error as { name?: unknown }).name === "AbortError";
}

function scheduleFrame(callback: () => void): () => void {
  if (typeof requestAnimationFrame === "function") {
    const frame = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(frame);
  }
  const timer = setTimeout(callback, 16);
  return () => clearTimeout(timer);
}

function pickConnection(connections: ConnectionOption[], settings: StorySettings): ConnectionOption | null {
  const id = resolveDefaultConnectionId(connections, settings.connectionId);
  return connections.find((connection) => connection.id === id) ?? null;
}

function promptSources(queryClient: QueryClient): PromptSources {
  return {
    characters: (ids) => loadPromptCharacters(queryClient, ids),
    personas: (ids) => loadPromptPersonas(queryClient, ids),
    lore: loadPromptLore,
  };
}

function rowOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** The raw route's `returnPrompt` answer: `{ prompt: { messages }, parameters: { model, maxTokens, ... } }`. */
function readPromptPeek(value: unknown): Pick<PromptPeek, "model" | "maxTokens" | "messages"> {
  const parameters = rowOf(rowOf(value).parameters);
  const list = rowOf(rowOf(value).prompt).messages;
  return {
    model: typeof parameters.model === "string" ? parameters.model : "",
    maxTokens: typeof parameters.maxTokens === "number" ? parameters.maxTokens : null,
    messages: (Array.isArray(list) ? list : []).flatMap((item) => {
      const { role, content } = rowOf(item);
      return typeof role === "string" && typeof content === "string" ? [{ role, content }] : [];
    }),
  };
}

/** Older chapters (outside the last N the next chapter sees in full) that have text but no summary yet. */
export function chaptersToSummarize(chapters: StoryChapter[], keepFullChapters: number): StoryChapter[] {
  const prior = chapters[chapters.length - 1]?.status === "draft" ? chapters.slice(0, -1) : chapters;
  return prior
    .slice(0, Math.max(0, prior.length - keepFullChapters))
    .filter((chapter) => chapter.text.trim() && !chapter.summary.trim());
}

async function complete(
  context: OperationContext,
  messages: ChatMessage[],
  maxTokens: number,
  onText?: (raw: string) => void,
): Promise<Completion> {
  const { run, connection } = context;
  const runId = createClientId("story-run");
  run.runId = runId;
  const signal = run.controller.signal;
  const body = {
    connectionId: connection.id,
    messages,
    streaming: !!onText,
    runId,
    parameters: { maxTokens },
    // Older Engines reject unknown keys, so the field is only sent when debug mode is on.
    ...(context.debugMode ? { debugMode: true } : {}),
  };

  if (!onText) {
    try {
      const result = await api.post<{ content?: unknown; aborted?: unknown }>("/generate/raw", body, { signal });
      if (result.aborted === true) return { content: "", aborted: true, finished: false };
      return { content: typeof result.content === "string" ? result.content : "", aborted: false, finished: true };
    } catch (error) {
      if (signal.aborted || isAbortError(error)) return { content: "", aborted: true, finished: false };
      throw error;
    }
  }

  let raw = "";
  let final: string | null = null;
  try {
    for await (const event of api.streamEvents("/generate/raw", body, signal)) {
      if (event.type === "token" && typeof event.data === "string") {
        raw += event.data;
        onText(raw);
      } else if (event.type === "result") {
        const content = (event.data as { content?: unknown } | null)?.content;
        if (typeof content === "string") final = content;
      } else if (event.type === "error") {
        throw Object.assign(
          new Error(typeof event.data === "string" && event.data ? event.data : "Generation failed"),
          {
            partial: raw,
          },
        );
      } else if (event.type === "aborted") {
        return { content: raw, aborted: true, finished: false };
      } else if (event.type === "done") {
        break;
      }
    }
  } catch (error) {
    if (signal.aborted || isAbortError(error)) return { content: raw, aborted: true, finished: false };
    throw error;
  }
  if (signal.aborted) return { content: raw, aborted: true, finished: false };
  return { content: final || raw, aborted: false, finished: final !== null };
}

async function summarizeOne(context: OperationContext, chapterId: string): Promise<boolean> {
  const story = context.readStory();
  const index = story?.chapters.findIndex((chapter) => chapter.id === chapterId) ?? -1;
  const chapter = story?.chapters[index];
  if (!story || !chapter?.text.trim()) return false;
  context.setStatus("summarizing");
  const chapterNumber = index + 1;
  const messages = buildSummaryMessages({ settings: story.story.settings, chapter, chapterNumber });
  const result = await complete(context, messages, tokenBudget(SUMMARY_MAX_TOKENS, context.connection.savedMaxTokens));
  if (result.aborted) return false;
  const summary = visibleStreamingText(result.content).trim().slice(0, LIMITS.summary);
  if (!summary) {
    toast.error(context.t("generation.errors.summaryEmpty", { number: chapterNumber }));
    return false;
  }
  // The author may have written a summary while this one was being made: theirs wins.
  const current = context.readStory()?.chapters.find((candidate) => candidate.id === chapter.id);
  if (!current || current.summary !== chapter.summary) return false;
  await context.run.doc.saveChapter(chapter.id, { summary }, { immediate: true });
  return true;
}

/** Summarizes the given chapters one at a time; returns how many got a summary. */
async function summarizeAll(context: OperationContext, chapterIds: string[]): Promise<number> {
  let done = 0;
  for (const chapterId of chapterIds) {
    if (context.run.controller.signal.aborted) break;
    if (await summarizeOne(context, chapterId)) done += 1;
  }
  return done;
}

/** Plans or refreshes the timeline; returns the new event count, or null when nothing changed. */
async function refreshTimeline(context: OperationContext): Promise<number | null> {
  const story = context.readStory();
  if (!story) return null;
  context.setStatus("timeline");
  const settings = story.story.settings;
  const messages = buildTimelineMessages({ settings, chapters: story.chapters });
  const result = await complete(context, messages, tokenBudget(TIMELINE_MAX_TOKENS, context.connection.savedMaxTokens));
  if (result.aborted) return null;
  const events = parseTimelineResponse(result.content, settings.timeline);
  if (events.length === 0) {
    toast.error(context.t("generation.errors.timelineUnreadable"));
    return null;
  }
  // The author edited the timeline while it was being planned: keep their version rather than overwrite it.
  const current = context.readStory()?.story.settings.timeline;
  if (JSON.stringify(current) !== JSON.stringify(settings.timeline)) {
    toast.info(context.t("generation.timelineChanged"));
    return null;
  }
  context.run.doc.updateSettings({ timeline: events }, { immediate: true });
  return events.length;
}

async function writeChapter(
  context: OperationContext,
  requested: "next" | "continue" | "rewrite" | "generate",
  override: string | undefined,
  /** Called once the run has saved what it wrote, before any follow-up. */
  onWritten: (record: LatestGeneration) => void,
  /** Generate: the chapter the author is on. */
  selectedChapterId: string | null = null,
): Promise<void> {
  const { run, connection, t } = context;
  const doc = run.doc;
  const story = context.readStory();
  if (!story) return;
  const settings = story.story.settings;
  // Cast and lore load before the story changes, so a failure here leaves it as it was.
  const plan = await planChapter({
    settings,
    chapters: story.chapters,
    requested,
    selectedChapterId,
    quickReply: override,
    savedMaxTokens: connection.savedMaxTokens,
    sources: promptSources(context.queryClient),
  });
  if (!plan) {
    toast.error(t("generation.errors.noChapter"));
    return;
  }
  const { mode, original, writer, chapterNumber, request, messages, maxTokens } = plan;
  if (run.controller.signal.aborted) return;

  let target: StoryChapter;
  if (mode === "next") {
    try {
      target = await doc.createChapter({ id: createClientId("chapter"), text: "", status: "draft", request });
    } catch {
      return; // The document hook has already reported it.
    }
  } else if (original) {
    // When the writer decides, the status stays theirs here too.
    const emptied = writer
      ? { text: "", summary: "", request }
      : { text: "", summary: "", status: "draft" as const, request };
    await doc.saveChapter(original.id, emptied, { immediate: true });
    target = original;
  } else {
    target = plan.target!;
  }
  const chapterId = target.id;
  const base = mode === "continue" && !original ? target.text : "";
  const baseWords = countWords(base);
  const render = (raw: string) => {
    const visible = visibleStreamingText(raw);
    return base ? joinContinuation(base, visible) : visible.trimStart();
  };
  context.setLive(chapterId, baseWords);

  let pendingRaw = "";
  let cancelFrame = null as (() => void) | null;
  let lastSave = Date.now();
  const onText = (raw: string) => {
    pendingRaw = raw;
    // One cache write per frame keeps React from re-rendering the book for every token.
    cancelFrame ??= scheduleFrame(() => {
      cancelFrame = null;
      doc.setChapterTextLocal(chapterId, render(pendingRaw));
      context.setLive(chapterId, baseWords + countWords(visibleStreamingText(pendingRaw)));
    });
    if (Date.now() - lastSave >= SAVE_EVERY_MS) {
      lastSave = Date.now();
      void doc.saveChapter(chapterId, { text: render(raw) }, { immediate: true }).catch(() => undefined);
    }
  };

  let result: Completion;
  let failure: unknown = null;
  try {
    result = await complete(context, messages, maxTokens, context.streaming ? onText : undefined);
  } catch (error) {
    failure = error;
    const partial = (error as { partial?: unknown } | null)?.partial;
    result = { content: typeof partial === "string" ? partial : pendingRaw, aborted: false, finished: false };
  } finally {
    cancelFrame?.();
  }

  // An unclosed reasoning block (cut off by the token limit) is not prose: it counts as nothing written.
  const stripped = visibleStreamingText(result.content);
  const addition = base ? stripped.trimEnd() : stripped.trim();
  if (!addition.trim()) {
    // Nothing was written: put the story back the way it was.
    if (mode === "next") {
      await doc.deleteChapter(chapterId);
    } else if (original) {
      const { text, summary, status, request: originalRequest } = original;
      await doc.saveChapter(chapterId, { text, summary, status, request: originalRequest }, { immediate: true });
    } else {
      // Saving (not only a cache write) also settles the chapter's edit counter that streamed frames raised.
      await doc.saveChapter(chapterId, { text: base }, { immediate: true });
    }
    if (failure) throw failure;
    if (!result.aborted) toast.error(t("generation.errors.empty"));
    return;
  }

  const finalText = (base ? joinContinuation(base, addition) : addition).slice(0, LIMITS.chapterText);
  // A stopped, failed or cut-off chapter stays a draft, so Write continues it instead of starting the next one. When
  // the writer decides, the status is theirs: nothing here marks a chapter finished.
  const finished = result.finished && !result.aborted && !failure && !endsMidSentence(finalText);
  const status = finished ? "complete" : "draft";
  await doc.saveChapter(chapterId, writer ? { text: finalText } : { text: finalText, status }, { immediate: true });
  const record = recordGeneration(story, { requested, override, chapterId, after: finalText });
  onWritten(record);

  const banned = findBannedPhrases(addition, settings.bannedPhrases);
  if (banned.length) toast.warning(t("generation.bannedPhrases", { phrases: banned.join(", ") }));
  if (failure) throw failure;
  if (!finished) {
    if (!result.aborted)
      toast.info(t(writer ? "generation.cutOffGenerate" : "generation.cutOff", { number: chapterNumber }));
    return;
  }

  // Follow-ups read the latest settings: the author may have changed them while the chapter streamed.
  const latest = context.readStory();
  if (!latest) return;
  const now = latest.story.settings;
  // Clear only the note this chapter was written with; a note typed during the stream is meant for the next one.
  if (now.clearNoteAfterChapter && now.authorNote && now.authorNote === settings.authorNote) {
    doc.updateSettings({ authorNote: "" }, { immediate: true });
    onWritten({ ...record, clearedNote: settings.authorNote });
  }
  context.setLive(null, 0);
  if (now.autoSummarize) {
    const pending = chaptersToSummarize(latest.chapters, now.keepFullChapters).map((chapter) => chapter.id);
    await summarizeAll(context, pending);
  }
  if (now.autoTimeline && !run.controller.signal.aborted) await refreshTimeline(context);
}

export function useStoryGeneration(args: {
  doc: StoryDocumentApi;
  streaming: boolean;
  debugMode: boolean;
  connections: ConnectionOption[];
  /** The chapter the author is on, which Generate continues (see generateTarget). */
  selectedChapterId: string | null;
}): StoryGenerationApi {
  const { doc, streaming, debugMode, connections, selectedChapterId } = args;
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [generatingChapterId, setGeneratingChapterId] = useState<string | null>(null);
  const [liveWords, setLiveWords] = useState(0);
  // ponytail: one record per mounted Story Writer, for the open story, in memory: a reload or opening another story
  // forgets it. Upgrade path: keep it on the story document.
  const [latestGeneration, setLatestGeneration] = useState<LatestGeneration | null>(null);
  const activeStoryId = doc.data?.story.id ?? null;
  if (latestGeneration && latestGeneration.storyId !== activeStoryId) setLatestGeneration(null);
  const latest = useRef({ doc, streaming, debugMode, connections, selectedChapterId, t });
  const runRef = useRef<Run | null>(null);

  useLayoutEffect(() => {
    latest.current = { doc, streaming, debugMode, connections, selectedChapterId, t };
  });

  const stop = useCallback(() => {
    const run = runRef.current;
    if (!run || run.controller.signal.aborted) return;
    run.controller.abort();
    if (run.runId) void api.post("/generate/raw/abort", { runId: run.runId }).catch(() => undefined);
  }, []);

  const operate = useCallback(
    async (initial: GenerationStatus, task: (context: OperationContext) => Promise<void>) => {
      const current = latest.current;
      const storyId = current.doc.data?.story.id;
      // One operation at a time; the ref answers synchronously, before any state update lands.
      if (runRef.current || !storyId) return;
      const run: Run = { storyId, doc: current.doc, controller: new AbortController(), runId: null };
      runRef.current = run;
      setStatus(initial);
      const readStory = () => {
        const cached = queryClient.getQueryData<StoryWithChapters>(storyWriterKeys.story(storyId));
        if (cached) return cached;
        const data = latest.current.doc.data;
        return data?.story.id === storyId ? data : null;
      };
      try {
        await run.doc.flush();
        const story = readStory();
        if (!story || run.controller.signal.aborted) return;
        const connection = pickConnection(latest.current.connections, story.story.settings);
        if (!connection) {
          toast.error(current.t("generation.errors.noConnection"));
          return;
        }
        await task({
          run,
          connection,
          streaming: latest.current.streaming,
          debugMode: latest.current.debugMode,
          queryClient,
          t: current.t,
          readStory,
          setStatus,
          setLive: (chapterId, words) => {
            setGeneratingChapterId(chapterId);
            setLiveWords(words);
          },
        });
      } catch (error) {
        if (!run.controller.signal.aborted && !isAbortError(error)) {
          toast.error(getApiErrorMessage(error, current.t("generation.errors.failed")));
        }
      } finally {
        runRef.current = null;
        setStatus("idle");
        setGeneratingChapterId(null);
        setLiveWords(0);
      }
    },
    [queryClient],
  );

  const write = useCallback(
    (mode: "next" | "continue" | "rewrite" | "generate", request?: string) => {
      // The chapter the author was on when they clicked.
      const selected = latest.current.selectedChapterId;
      return operate("writing", (context) => writeChapter(context, mode, request, setLatestGeneration, selected));
    },
    [operate],
  );

  const redo = useCallback(
    () =>
      operate("writing", async (context) => {
        const record = latestGeneration;
        // The story as it is now, with every edit saved: one made since Redo was shown withdraws it.
        if (!record || redoOffer(record, context.readStory()) === null) return;
        const { chapterId, before, requested, override, clearedNote } = record;
        const runDoc = context.run.doc;
        // Put the chapter back as it was before that generation. A restore that fails has been reported; nothing
        // is written over it.
        if (before) {
          await runDoc.saveChapter(chapterId, before, { immediate: true });
          if (!(await runDoc.flush())) {
            toast.warning(context.t("stories.saveFailed"));
            return;
          }
        } else if (!(await runDoc.deleteChapter(chapterId))) {
          return;
        }
        // The note that generation cleared comes back too, so it is sent again, unless the author has written another.
        if (clearedNote && !context.readStory()?.story.settings.authorNote) {
          runDoc.updateSettings({ authorNote: clearedNote }, { immediate: true });
        }
        await writeChapter(context, requested, override, setLatestGeneration, chapterId);
      }),
    [operate, latestGeneration],
  );

  // Outside operate(): a peek takes no run, sets no status and never touches a chapter.
  const peekPrompt = useCallback(
    async (signal: AbortSignal): Promise<PromptPeek | null> => {
      const { doc: current, connections: options, selectedChapterId: selected, t: translate } = latest.current;
      const storyId = current.data?.story.id;
      const story = storyId
        ? (queryClient.getQueryData<StoryWithChapters>(storyWriterKeys.story(storyId)) ?? current.data)
        : null;
      if (!story) return null;
      const connection = pickConnection(options, story.story.settings);
      if (!connection) return null;
      // The primary button: Write (the next chapter, or the draft it continues), or Generate when the writer decides.
      const generate = story.story.settings.writerDecides;
      const plan = await planChapter({
        settings: story.story.settings,
        chapters: story.chapters,
        requested: generate ? "generate" : "next",
        selectedChapterId: selected,
        savedMaxTokens: connection.savedMaxTokens,
        sources: promptSources(queryClient),
      });
      if (!plan) throw new Error(translate("generation.errors.noChapter"));
      // returnPrompt (Engine 2.2.0+) answers with the merged, context-fitted messages before any provider call.
      const result = await api.post<unknown>(
        "/generate/raw",
        {
          connectionId: connection.id,
          messages: plan.messages,
          parameters: { maxTokens: plan.maxTokens },
          returnPrompt: true,
        },
        { signal },
      );
      return { mode: generate ? "generate" : plan.mode, chapterNumber: plan.chapterNumber, ...readPromptPeek(result) };
    },
    [queryClient],
  );

  const summarizeChapter = useCallback(
    (chapterId: string) =>
      operate("summarizing", async (context) => {
        if (!(await summarizeOne(context, chapterId))) return;
        const chapterNumber = (context.readStory()?.chapters.findIndex((chapter) => chapter.id === chapterId) ?? 0) + 1;
        toast.success(context.t("generation.summaries.done", { number: chapterNumber }));
      }),
    [operate],
  );

  const summarizeOlderChapters = useCallback(
    () =>
      operate("summarizing", async (context) => {
        const story = context.readStory();
        if (!story) return;
        const pending = chaptersToSummarize(story.chapters, story.story.settings.keepFullChapters);
        if (pending.length === 0) {
          toast.info(context.t("generation.summaries.nothingToSummarize"));
          return;
        }
        const count = await summarizeAll(
          context,
          pending.map((chapter) => chapter.id),
        );
        if (count > 0) toast.success(context.t("generation.summaries.olderDone", { count }));
      }),
    [operate],
  );

  const fillTimeline = useCallback(
    () =>
      operate("timeline", async (context) => {
        const count = await refreshTimeline(context);
        if (count !== null) toast.success(context.t("generation.timeline.updated", { count }));
      }),
    [operate],
  );

  // A run belongs to the story it started on: switching or deleting that story, or leaving the page, stops it.
  useEffect(() => {
    if (runRef.current && runRef.current.storyId !== activeStoryId) stop();
  }, [activeStoryId, stop]);
  useEffect(() => stop, [stop]);

  const canWrite = status === "idle" && !!doc.data && !!pickConnection(connections, doc.data.story.settings);
  const redoChapter = canWrite ? redoOffer(latestGeneration, doc.data) : null;

  return {
    status,
    generatingChapterId,
    liveWords,
    canWrite,
    write,
    redoChapter,
    redo,
    peekPrompt,
    stop,
    summarizeChapter,
    summarizeOlderChapters,
    fillTimeline,
  };
}
