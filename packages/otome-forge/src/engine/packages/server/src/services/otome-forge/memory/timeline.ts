// ──────────────────────────────────────────────
// Otome Hearth: the story's timeline (#2066), the one summary every story prompt carries
// ──────────────────────────────────────────────
// The kit keeps one record per chapter (its detail summary, written once) and asks Otome to fold each new record into
// its overview (S/memory/memory.ts summarize). Otome's overview is this timeline: a condensed head plus the chapter
// summaries added since, each kept whole and in story order. A new summary is only appended, which costs no model call;
// once the timeline crosses TIMELINE_CEILING, everything but the newest entry is condensed into a new head of at most
// 3000 words (one call), and appending goes on. The newest entry stays apart so a prompt that sends that chapter in full
// can leave it out of the timeline (S/story/canon.ts recallText).
// Stored in the kit's overview content as JSON. Anything else (an overview of an earlier form) reads as a head alone.
import { estimateTextTokens } from "@forge-kit/shared-token-estimator.mjs";

/** The timeline's size, in estimated tokens, that a new summary must cross before the timeline is condensed. */
export const TIMELINE_CEILING = 10_000;

export interface TimelineEntry {
  /** The kit's source key, JSON [kind, id]. */
  key: string;
  title: string;
  text: string;
}

export interface Timeline {
  /** What earlier condensing left: the story before the entries, as one recollection. */
  head: string;
  entries: TimelineEntry[];
}

const FORM = 3;

export function parseTimeline(content: string | null | undefined): Timeline {
  const text = (content ?? "").trim();
  if (!text) return { head: "", entries: [] };
  try {
    const value = JSON.parse(text) as { v?: unknown; head?: unknown; entries?: unknown };
    if (value?.v === FORM && typeof value.head === "string" && Array.isArray(value.entries)) {
      const entries = value.entries.flatMap((entry) =>
        entry && typeof entry.key === "string" && typeof entry.text === "string"
          ? [{ key: entry.key, title: typeof entry.title === "string" ? entry.title : "", text: entry.text }]
          : [],
      );
      return { head: value.head, entries };
    }
  } catch {
    // Not a timeline: an earlier overview's prose.
  }
  return { head: text, entries: [] };
}

export const serializeTimeline = ({ head, entries }: Timeline) => JSON.stringify({ v: FORM, head, entries });

/**
 * A summary as the timeline holds it: trimmed, with markdown headings turned into plain lines so nothing in it reads as
 * the start of another entry.
 */
export const cleanSummary = (text: string) => text.trim().replace(/^#{1,6}\s+/gmu, "");

/** The timeline as prompt text: the head, then each entry under its title, leaving out the entry for `without`. */
export function renderTimeline({ head, entries }: Timeline, without?: string): string {
  return [
    head.trim(),
    ...entries
      .filter((entry) => entry.key !== without)
      .map((entry) => (entry.title ? `${entry.title}\n${entry.text.trim()}` : entry.text.trim())),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The timeline as a recollection to read: the head and every entry's text, no titles. */
export const timelineParagraphs = ({ head, entries }: Timeline) =>
  [head, ...entries.map((entry) => entry.text)].map((text) => text.trim()).filter(Boolean);

/** Whether the timeline crossed the ceiling and has something older than its newest entry to condense. */
export const crossedCeiling = (timeline: Timeline) =>
  (timeline.head.trim() !== "" || timeline.entries.length > 1) &&
  estimateTextTokens(renderTimeline(timeline)) > TIMELINE_CEILING;

/** The part a condensing call folds: the head and every entry but the newest. */
export const foldedPart = (timeline: Timeline): Timeline => ({
  head: timeline.head,
  entries: timeline.entries.slice(0, -1),
});
