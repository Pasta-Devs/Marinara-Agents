// ──────────────────────────────────────────────
// Story Writer: Illustrate (a picture of a passage, painted by the Engine's image connection)
// ──────────────────────────────────────────────
// One text call to the story's own connection writes the picture prompt from the passage and the story's cast and
// setting, and the story's prompt prefix goes in front of it. The writer reviews it when the Engine's "Expose media
// prompts before sending" is on, and Story Writer's server paints it with the story's image connection (with the
// pictures of the cast it names, unless the story turned that off) and keeps it in the Global Gallery and in the
// chapter. Without an image connection nothing is sent, so nothing is paid for.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api, getApiErrorMessage } from "../lib/api-client";
import { anchorText } from "../lib/story-writer/markdown";
import {
  withPrefix,
  type IllustrationCreate,
  type StoryChapter,
  type StoryIllustration,
  type StoryRecord,
} from "../lib/story-writer/model";
import {
  buildIllustrationMessages,
  cleanPicturePrompt,
  createClientId,
  PICTURE_PROMPT_MAX_TOKENS,
  tokenBudget,
} from "../lib/story-writer/prompt";
import {
  loadPromptCharacters,
  loadPromptLore,
  loadPromptPersonas,
  resolveDefaultConnectionId,
  resolveImageConnectionId,
  type ConnectionOption,
} from "./use-engine-resources";
import { applyChapterPictures, type StoryDocumentApi } from "./use-story-writer";

/** The passage Illustrate paints: where the author's caret or selection is in a chapter's text. */
export interface PassageAt {
  chapterId: string;
  /** The selected text, else the whole block the caret is in. */
  passage: string;
  /** The blocks just before it, so the prompt knows who is there and where. */
  before: string;
  /** The block the picture goes beside (where the selection starts), and its opening words. */
  paragraph: number;
  anchor: string;
}

/** The selection's passage, or null when it is not in a chapter's text (a heading, the title page, the ghost page). */
export function passageAtSelection(selection: Selection | null): PassageAt | null {
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const start = range.startContainer;
  const element = start.nodeType === Node.ELEMENT_NODE ? (start as Element) : start.parentElement;
  const body = element?.closest(".sw-body");
  const chapterId = body?.closest(".sw-block--chapter")?.getAttribute("data-sw-block");
  // A selection on the body itself is what a re-render leaves behind, not the author's.
  if (!body || !chapterId || start === body) return null;
  const blocks = Array.from(body.children).filter((child) => child.tagName !== "FIGURE");
  const paragraph = blocks.findIndex((block) => block.contains(start));
  const block = blocks[paragraph];
  if (!block) return null;
  const blockText = block.textContent ?? "";
  // A selection that runs on past this chapter's text keeps only the block it starts in.
  const selected = !selection.isCollapsed && body.contains(range.endContainer) ? selection.toString().trim() : "";
  const passage = (selected || blockText).trim();
  if (!passage) return null;
  const before = blocks
    .slice(Math.max(0, paragraph - 6), paragraph)
    .map((item) => item.textContent ?? "")
    .join("\n\n");
  return { chapterId, passage, before, paragraph, anchor: anchorText(blockText) };
}

export type IllustrationPhase = "idle" | "prompting" | "reviewing" | "painting";

/** The prompt review: "writing" while the text call runs, then the prompt to edit. */
export interface PictureReview {
  status: "writing" | "ready";
  prompt: string;
  /** Illustrate again: the prompt is the picture's own, so no text call ran. */
  again: boolean;
}

export interface StoryIllustrationApi {
  phase: IllustrationPhase;
  review: PictureReview | null;
  /** Illustrates the passage at the author's caret or selection. */
  illustrate(): Promise<void>;
  /** Paints a picture again from its own prompt, in its place. */
  illustrateAgain(chapterId: string, illustrationId: string): Promise<void>;
  /** Takes a picture out of its chapter; its gallery image goes too unless something else uses it. */
  remove(chapterId: string, illustrationId: string): Promise<void>;
  /** The review's Paint (with the edited prompt) or Cancel (null). */
  finishReview(prompt: string | null): void;
  /** Stops a prompt still being written, or a review. A picture being painted is already paid for and finishes. */
  cancel(): void;
}

interface Run {
  controller: AbortController;
  runId: string | null;
  resolveReview: ((prompt: string | null) => void) | null;
}

const TOAST_ID = "story-writer-illustration";

function isAbortError(error: unknown): boolean {
  return !!error && typeof error === "object" && (error as { name?: unknown }).name === "AbortError";
}

const chapterPath = (storyId: string, chapterId: string) =>
  `/story-writer/stories/${encodeURIComponent(storyId)}/chapters/${encodeURIComponent(chapterId)}/illustrations`;

export function useStoryIllustration(args: {
  doc: StoryDocumentApi;
  connections: ConnectionOption[];
  imageConnections: ConnectionOption[];
  debugMode: boolean;
  /** The Engine's "Expose media prompts before sending"; null when this Engine does not say, which reviews. */
  reviewPrompts: boolean | null;
  /** The chapter the author is on: the passage must be in it. */
  selectedChapterId: string | null;
  /** No image connection is chosen: explain how to choose one. */
  onNeedsConnection(): void;
  confirmRemove(): Promise<boolean>;
}): StoryIllustrationApi {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<IllustrationPhase>("idle");
  const [review, setReview] = useState<PictureReview | null>(null);
  const latest = useRef({ ...args, t });
  const runRef = useRef<Run | null>(null);
  const passageRef = useRef<PassageAt | null>(null);

  useLayoutEffect(() => {
    latest.current = { ...args, t };
  });

  // The caret or selection the author last had in a chapter's text. Clicking Illustrate takes focus from the text, and
  // the text renders again without it, so it is kept as it was.
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const at = passageAtSelection(document.getSelection());
      if (at) passageRef.current = at;
    };
    const onChange = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", onChange);
    };
  }, []);

  const cancel = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    run.controller.abort();
    if (run.runId) void api.post("/generate/raw/abort", { runId: run.runId }).catch(() => undefined);
    run.resolveReview?.(null);
  }, []);

  const finishReview = useCallback((prompt: string | null) => runRef.current?.resolveReview?.(prompt), []);

  // A story switch, or leaving the page, stops a prompt still being written.
  const storyId = args.doc.data?.story.id ?? null;
  useEffect(() => cancel, [storyId, cancel]);

  const paint = useCallback(
    async (target: { chapterId: string; paragraph: number; anchor: string }, source: PassageAt | StoryIllustration) => {
      const {
        doc,
        connections,
        imageConnections,
        debugMode,
        reviewPrompts,
        onNeedsConnection,
        t: translate,
      } = latest.current;
      const story = doc.data;
      if (runRef.current || !story) return;
      const settings = story.story.settings;
      // No image connection, no call of any kind: not even the text call that writes the prompt.
      const imageConnectionId = resolveImageConnectionId(imageConnections, settings.imageConnectionId);
      if (!imageConnectionId) {
        onNeedsConnection();
        return;
      }
      const again = "image" in source ? source : null;
      const textConnection = connections.find(
        (connection) => connection.id === resolveDefaultConnectionId(connections, settings.connectionId),
      );
      if (!again && !textConnection) {
        toast.error(translate("generation.errors.noConnection"));
        return;
      }
      const run: Run = { controller: new AbortController(), runId: null, resolveReview: null };
      runRef.current = run;
      const signal = run.controller.signal;
      const reviewing = reviewPrompts !== false;
      let toastShown = false;
      const progress = (key: string, cancellable: boolean) => {
        toastShown = true;
        toast.loading(translate(key), {
          id: TOAST_ID,
          action: cancellable ? { label: translate("illustrate.cancel"), onClick: () => cancel() } : undefined,
        });
      };
      try {
        let prompt = again?.prompt ?? "";
        if (!again && textConnection && "passage" in source) {
          setPhase("prompting");
          if (reviewing) setReview({ status: "writing", prompt: "", again: false });
          else progress("illustrate.writingPrompt", true);
          const [characters, personas, lore] = await Promise.all([
            loadPromptCharacters(queryClient, settings.characterIds),
            loadPromptPersonas(queryClient, settings.personaIds),
            loadPromptLore(settings.lorebookIds, `${source.before}\n\n${source.passage}`),
          ]);
          if (signal.aborted) return;
          const messages = buildIllustrationMessages({
            settings,
            characters,
            personas,
            lore,
            passage: source.passage,
            before: source.before,
          });
          run.runId = createClientId("story-picture");
          const result = await api.post<{ content?: unknown; aborted?: unknown }>(
            "/generate/raw",
            {
              connectionId: textConnection.id,
              messages,
              streaming: false,
              runId: run.runId,
              parameters: { maxTokens: tokenBudget(PICTURE_PROMPT_MAX_TOKENS, textConnection.savedMaxTokens) },
              // Older Engines reject unknown keys, so the field is only sent when debug mode is on.
              ...(debugMode ? { debugMode: true } : {}),
            },
            { signal },
          );
          if (signal.aborted || result.aborted === true) return;
          prompt = cleanPicturePrompt(typeof result.content === "string" ? result.content : "");
          if (!prompt) {
            toastShown = false;
            toast.error(translate("illustrate.emptyPrompt"), { id: TOAST_ID });
            return;
          }
          // The review shows the prefix too: the image connection paints exactly what it shows.
          prompt = withPrefix(settings.picturePromptPrefix, prompt);
        }
        if (reviewing) {
          setPhase("reviewing");
          const reviewed = await new Promise<string | null>((resolve) => {
            run.resolveReview = resolve;
            setReview({ status: "ready", prompt, again: !!again });
          });
          run.resolveReview = null;
          setReview(null);
          if (signal.aborted || !reviewed?.trim()) return;
          prompt = reviewed.trim();
        }
        // The chapter may have been started on the page a moment ago: the server must have it first.
        await doc.flush();
        setPhase("painting");
        progress("illustrate.painting", false);
        const body: IllustrationCreate = {
          connectionId: imageConnectionId,
          prompt,
          paragraph: target.paragraph,
          anchor: target.anchor,
          ...(again ? { replace: again.id } : {}),
          ...(debugMode ? { debugMode: true } : {}),
        };
        const saved = await api.post<{ story: StoryRecord; chapter: StoryChapter }>(
          chapterPath(story.story.id, target.chapterId),
          body,
        );
        applyChapterPictures(queryClient, story.story.id, saved);
        toastShown = false;
        toast.success(translate("illustrate.done"), { id: TOAST_ID });
      } catch (error) {
        if (!signal.aborted && !isAbortError(error)) {
          toastShown = false;
          toast.error(getApiErrorMessage(error, translate("illustrate.failed")), { id: TOAST_ID });
        }
      } finally {
        if (toastShown) toast.dismiss(TOAST_ID);
        if (runRef.current === run) runRef.current = null;
        setPhase("idle");
        setReview(null);
      }
    },
    [queryClient, cancel],
  );

  const illustrate = useCallback(async () => {
    const { doc, selectedChapterId, t: translate } = latest.current;
    const at = passageRef.current;
    // Only a passage in the chapter the author is on: one they left behind in another chapter is not it.
    if (!at || at.chapterId !== selectedChapterId || !doc.data?.chapters.some((item) => item.id === at.chapterId)) {
      toast.info(translate("illustrate.pickPassage"));
      return;
    }
    await paint(at, at);
  }, [paint]);

  const illustrateAgain = useCallback(
    async (chapterId: string, illustrationId: string) => {
      const chapter = latest.current.doc.data?.chapters.find((item) => item.id === chapterId);
      const illustration = chapter?.illustrations.find((item) => item.id === illustrationId);
      if (!illustration) return;
      await paint({ chapterId, paragraph: illustration.paragraph, anchor: illustration.anchor }, illustration);
    },
    [paint],
  );

  const remove = useCallback(
    async (chapterId: string, illustrationId: string) => {
      const { doc, confirmRemove, t: translate } = latest.current;
      const story = doc.data;
      if (!story || runRef.current || !(await confirmRemove())) return;
      try {
        const saved = await api.delete<{ story: StoryRecord; chapter: StoryChapter }>(
          `${chapterPath(story.story.id, chapterId)}/${encodeURIComponent(illustrationId)}`,
        );
        applyChapterPictures(queryClient, story.story.id, saved);
      } catch (error) {
        toast.error(getApiErrorMessage(error, translate("illustrate.removeFailed")));
      }
    },
    [queryClient],
  );

  return { phase, review, illustrate, illustrateAgain, remove, finishReview, cancel };
}
