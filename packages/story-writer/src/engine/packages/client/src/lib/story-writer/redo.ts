// ──────────────────────────────────────────────
// Story Writer: the latest generation, and whether Redo may take it back and write it again
// ──────────────────────────────────────────────
import type { StoryChapter, StoryWithChapters } from "./model";

/** What Redo puts back in a chapter it did not create. */
export type ChapterState = Pick<StoryChapter, "text" | "summary" | "status" | "request">;

/** A generation that wrote something, as Redo needs it. */
export interface LatestGeneration {
  storyId: string;
  /** What the generation was asked for, so Redo sends the same instruction again. */
  requested: "next" | "continue" | "rewrite";
  /** The quick reply it was sent with. */
  override?: string;
  chapterId: string;
  /** The chapter before the run, or null when the run created it. */
  before: ChapterState | null;
  /** The chapter text the run saved. */
  after: string;
  /** The chapter's summary as the run left it: empty for a created or rewritten chapter, unchanged when continued. */
  afterSummary: string;
  /** The author's note the run cleared after the chapter ("Clear after the next chapter"), which Redo puts back. */
  clearedNote?: string;
}

/** The record of a run that saved `after` into `chapterId`; `story` is the story as the run found it. */
export function recordGeneration(
  story: StoryWithChapters,
  run: Pick<LatestGeneration, "requested" | "override" | "chapterId" | "after">,
): LatestGeneration {
  const chapter = story.chapters.find((candidate) => candidate.id === run.chapterId);
  const before = chapter
    ? { text: chapter.text, summary: chapter.summary, status: chapter.status, request: chapter.request }
    : null;
  // A rewrite empties the summary along with the text; a continued chapter keeps its own.
  const afterSummary = chapter && run.requested !== "rewrite" ? chapter.summary : "";
  return { storyId: story.story.id, ...run, before, afterSummary };
}

/**
 * The chapter number Redo would write again, or null when Redo is not offered. Every generation writes the last
 * chapter, so the recorded one must still be last, with its text and summary exactly as the run left them: an edit
 * or a delete withdraws Redo, which never throws away the author's own writing.
 */
export function redoOffer(record: LatestGeneration | null, story: StoryWithChapters | null): number | null {
  if (!record || !story || story.story.id !== record.storyId) return null;
  const last = story.chapters[story.chapters.length - 1];
  if (!last || last.id !== record.chapterId || last.text !== record.after) return null;
  // ponytail: any summary change withdraws Redo, Summarize or an auto-summary of this chapter included (only when
  // "Keep the last chapters in full" is 0). Upgrade path: update afterSummary when the run's own follow-up writes it.
  if (last.summary !== record.afterSummary) return null;
  return story.chapters.length;
}
