// ──────────────────────────────────────────────
// Otome Hearth: the story's timeline (#2066), the one summary every story prompt carries
// ──────────────────────────────────────────────
// The kit keeps one record per chapter (its detail summary, written once) and asks Otome to fold each new record into
// its overview (S/memory/memory.ts summarize). Otome's overview is this timeline: a condensed head plus the chapter
// summaries added since, each kept whole and in story order. A new summary is only appended, which costs no model call;
// once a new summary takes the timeline past TIMELINE_CEILING and its HEADROOM_TOKENS of leeway, everything before the
// newest main chapter's entry is condensed into a new head of about 5000 words (half that size), and appending goes on.
// That entry and every one after it stay apart (#2091): the main story's plans and scenes send that chapter in full and
// leave its entry out of the timeline (S/story/canon.ts recallText), so its summary does not go in beside it (the
// ponytail below names when it still can). With nothing before it to condense, everything but the newest entry is.
// ponytail: only the main story's previous chapter is kept apart, and not always. A route chapter's previous one (his
// last route or repair chapter) older than the newest main chapter may be condensed; so is the newest main chapter's
// entry once enough side chapters follow it to cross the ceiling again before the next main one (the fallback); each
// then goes in beside its chapter in full as part of the head until a newer chapter of its storyline completes. A
// condensing that has only a few short entries before the newest main chapter's frees little, so the next summary may
// condense again. The upgrade path is keeping each storyline's newest entry apart, with a bound on what that holds back.
// Stored in the kit's overview content as JSON. Anything else (an overview of an earlier form) reads as a head alone.
// Every story prompt reads it as saved (savedStory: the timeline, the sources it covers and each one's summary),
// whatever state the memory is in (S/story/canon.ts recallText). Its size never follows a model's context: it grows
// and is condensed at the same sizes whatever the memory model; the context that model reports only splits the
// condensing into as many calls as it needs (one call when it reports none; S/memory/memory.ts summaryJob), or fails
// it, saying so, when not even one entry fits.
import { estimateTextTokens } from "@forge-kit/shared-token-estimator.mjs";

/**
 * The timeline's size, in estimated tokens, that a new summary must cross (with HEADROOM_TOKENS) before the timeline
 * is condensed: with its leeway at most 14k, about ten chapter summaries of the longest (1000 words, some 1350
 * tokens). With the recalls' 6k at most (S/memory/memory.ts RECALL_TOKENS), a prompt's memory beside the previous
 * chapter stays within 20k (the maintainer's).
 */
export const TIMELINE_CEILING = 13_000;
/**
 * The leeway past each memory size before anything is condensed or left out (the maintainer's ~1k of border tokens):
 * the timeline condenses only past TIMELINE_CEILING plus this (14k), the recalls (S/memory/memory.ts RECALL_TOKENS)
 * drop their oldest only past their size plus this (6k).
 */
export const HEADROOM_TOKENS = 1000;

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

/** Whether an entry is a main chapter's (key JSON ["chapter", "main-<n>"]). */
const isMainEntry = ({ key }: TimelineEntry) => /^\["chapter","main-\d+"\]$/u.test(key);

/** How many of the oldest entries condensing folds (see the header): those before the newest main chapter's. */
const foldedCount = ({ entries }: Timeline) => {
  const main = entries.map(isMainEntry).lastIndexOf(true);
  return main > 0 ? main : Math.max(entries.length - 1, 0);
};

/**
 * Whether the timeline went past its ceiling and its leeway, with an entry to condense. A head alone is what condensing
 * wrote, so it is never condensed again by itself, even when it came back long.
 */
export const crossedCeiling = (timeline: Timeline) =>
  foldedCount(timeline) > 0 && estimateTextTokens(renderTimeline(timeline)) > TIMELINE_CEILING + HEADROOM_TOKENS;

/** The part a condensing call folds: the head and every entry before the newest main chapter's (see the header). */
export const foldedPart = (timeline: Timeline): Timeline => ({
  head: timeline.head,
  entries: timeline.entries.slice(0, foldedCount(timeline)),
});

/** The entries condensing leaves apart: the newest main chapter's and every one after it (see the header). */
export const keptPart = (timeline: Timeline): TimelineEntry[] => timeline.entries.slice(foldedCount(timeline));

/**
 * The overview's form, kept on the memory document: 4 is #2066's timeline with Character Stories in it (0.7.3; 3 left
 * them out, 2 was 0.6.19's prose timeline, rewritten whole with every chapter). A document without it
 * is read with no overview, so the kit's next maintenance folds a new one from the saved records, one at a time; with
 * no overview every source is owed, so recall reports the memory lagging and queues that (S/story/canon.ts recallText).
 * Records, detail summaries and status are read as saved. Every overview the kit writes after that was folded over the
 * empty one, so its write stamps the form, and the reads after it use the overview again: one rebuild, never a second.
 * Until then the earlier overview is kept beside it as `legacyOverview` (the kit carries fields it does not know), so
 * What happened so far… can still show it when a fold fails before the first new one lands; the stamp drops it.
 */
export const OVERVIEW_STYLE = 4;

/** What the story memory has saved for a run, as every story prompt reads it (see the header). */
export interface SavedStory {
  /** The timeline (the kit's overview content); "" before the first one, or while one of an earlier form waits. */
  timeline: string;
  /** The kit's source keys (JSON [kind, id]) the timeline covers: a date's too, though a date is never in its text. */
  covered: ReadonlySet<string>;
  /** Each source's saved summary by its key: its first record, as the kit's keepFirstCanon keeps it. */
  summaries: ReadonlyMap<string, string>;
}

/**
 * The saved memory document's data (the kit's v1 store, `${R}:memory`) as a SavedStory. An overview of an earlier form
 * is no timeline (OVERVIEW_STYLE), so what it covered counts as not covered until the rebuild folds it again.
 * ponytail: reads the kit's v1 store and, unlike the kit's own recall, trusts the saved overview without checking that
 * every source it covers is still canon: Otome never takes a completed chapter back. The upgrade path is the kit
 * returning its overview and records in every phase.
 */
export function savedStory(data: unknown): SavedStory {
  const saved = data as {
    overview?: { content?: unknown; sources?: unknown } | null;
    overviewStyle?: unknown;
    records?: unknown;
  } | null;
  const content = saved?.overviewStyle === OVERVIEW_STYLE ? saved.overview?.content : undefined;
  const stamps = typeof content === "string" && Array.isArray(saved?.overview?.sources) ? saved.overview.sources : [];
  const covered = new Set<string>();
  for (const stamp of stamps) if (Array.isArray(stamp) && typeof stamp[0] === "string") covered.add(stamp[0]);
  const summaries = new Map<string, string>();
  for (const record of Array.isArray(saved?.records) ? (saved.records as unknown[]) : []) {
    const { key, content: summary } = (record ?? {}) as { key?: unknown; content?: unknown };
    if (typeof key === "string" && !summaries.has(key) && typeof summary === "string" && summary.trim()) {
      summaries.set(key, summary.trim());
    }
  }
  return { timeline: typeof content === "string" ? content : "", covered, summaries };
}
