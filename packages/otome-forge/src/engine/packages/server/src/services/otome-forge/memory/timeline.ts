// ──────────────────────────────────────────────
// Otome Hearth: the story's timeline (#2066), the one summary every story prompt carries
// ──────────────────────────────────────────────
// The kit keeps one record per chapter (its detail summary, written once) and asks Otome to fold each new record into
// its overview (S/memory/memory.ts summarize). Otome's overview is this timeline: a condensed head plus the chapter
// summaries added since, each kept whole and in story order. A new summary is only appended, which costs no model call;
// once a new summary takes the timeline past TIMELINE_CEILING and its HEADROOM_TOKENS of leeway, everything but the
// KEPT_ENTRIES newest entries is condensed into a new head of at most about 5000 words, and appending goes on.
// 0.34.0, the maintainer's rule: the newest chapter goes to the next prompt in full (S/story/canon.ts recallText leaves
// its entry out of the timeline), and the two before it stay as their summaries, so the last three chapters are always
// remembered better than the head. A head that comes back longer than it may be is refused (S/memory/memory.ts).
// ponytail: a prompt's previous chapter in full is its storyline's (the main story's for a main scene), which need not be
// the newest entry; once three or more chapters follow it, its entry is condensed and it goes in beside its chapter in
// full until a newer chapter of its storyline completes. The upgrade path is keeping each storyline's newest entry
// apart, with a bound on what that holds back.
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

/** The timeline as prompt text: the head, then each entry under its title, leaving out the entries for `without`. */
export function renderTimeline({ head, entries }: Timeline, ...without: Array<string | undefined>): string {
  return [
    head.trim(),
    ...entries
      .filter((entry) => !without.includes(entry.key))
      .map((entry) => (entry.title ? `${entry.title}\n${entry.text.trim()}` : entry.text.trim())),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The timeline as a recollection to read: the head and every entry's text, no titles. */
export const timelineParagraphs = ({ head, entries }: Timeline) =>
  [head, ...entries.map((entry) => entry.text)].map((text) => text.trim()).filter(Boolean);

/** 0.34.0: the newest entries condensing never touches: the newest chapter and the two before it (see the header). */
export const KEPT_ENTRIES = 3;

/** How many of the oldest entries condensing folds (see the header): all but the KEPT_ENTRIES newest. */
const foldedCount = ({ entries }: Timeline) => Math.max(entries.length - KEPT_ENTRIES, 0);

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

/** The entries condensing leaves apart: the KEPT_ENTRIES newest (see the header). */
export const keptPart = (timeline: Timeline): TimelineEntry[] => timeline.entries.slice(foldedCount(timeline));

/**
 * The overview's form, kept on the memory document: 4 is #2066's timeline with Character Stories in it (0.7.3; 3 left
 * them out, 2 was 0.6.19's prose timeline, rewritten whole with every chapter). A document without it
 * is read with no overview, so the kit's next maintenance folds a new one from the saved records, one at a time; with
 * no overview every source is owed, so recall reports the memory lagging and queues that (S/story/canon.ts recallText).
 * Records, detail summaries and status are read as saved. Every overview the kit writes after that was folded over the
 * empty one, so its write stamps the form, and the reads after it use the overview again: one rebuild, never a second.
 * Until then the earlier overview is kept beside it as `legacyOverview` (the kit carries fields it does not know), so
 * What happened so far… can still show it when a fold fails before the first new one lands. 5 (0.34.0) is the timeline
 * condensed by the newest three entries with its head's length checked: a rebuild that brings back what a long head lost.
 * Since 5 the earlier overview stays until the rebuild's status is ready (S/memory/memory.ts stampedForm), so
 * `rebuilding` says the whole of it, its later folds included.
 */
export const OVERVIEW_STYLE = 5;

/** What the story memory has saved for a run, as every story prompt reads it (see the header). */
export interface SavedStory {
  /** The timeline (the kit's overview content), the earlier one while a rebuild runs; "" before the first one. */
  timeline: string;
  /** The kit's source keys (JSON [kind, id]) the timeline covers: a date's too, though a date is never in its text. */
  covered: ReadonlySet<string>;
  /** Each source's saved summary by its key: its first record, as the kit's keepFirstCanon keeps it. */
  summaries: ReadonlyMap<string, string>;
  /**
   * 0.34.0: an overview of an earlier form waits for its rebuild, or the rebuild has not finished: a chapter's saved
   * story context is not replaced from what the story holds meanwhile (S/story/beats.ts).
   */
  rebuilding: boolean;
}

/**
 * The saved memory document's data (the kit's v1 store, `${R}:memory`) as a SavedStory.
 * 0.34.2 (the maintainer's): while a rebuild runs, prompts read the earlier timeline and what it covered, never the
 * half-rebuilt one. A half-rebuilt timeline covers only its first chapters, so every later chapter went in as its own
 * summary: a 94-chapter story's chapter plan reached 168,875 tokens. The earlier one is `legacyOverview`, or the
 * overview itself before the rebuild's first fold; one with no text leaves the half-rebuilt one in use.
 * ponytail: reads the kit's v1 store and, unlike the kit's own recall, trusts the saved overview without checking that
 * every source it covers is still canon: Otome never takes a completed chapter back. The upgrade path is the kit
 * returning its overview and records in every phase.
 */
export function savedStory(data: unknown): SavedStory {
  type Overview = { content?: unknown; sources?: unknown } | null | undefined;
  const saved = data as {
    overview?: Overview;
    overviewStyle?: unknown;
    legacyOverview?: Overview;
    records?: unknown;
  } | null;
  const rebuilding = !!saved?.legacyOverview || (!!saved?.overview && saved.overviewStyle !== OVERVIEW_STYLE);
  const earlier = saved?.legacyOverview ?? (rebuilding ? saved?.overview : undefined);
  const read: Overview =
    rebuilding && typeof earlier?.content === "string" && earlier.content.trim()
      ? earlier
      : saved?.overviewStyle === OVERVIEW_STYLE
        ? saved.overview
        : undefined;
  const content = read?.content;
  const stamps = typeof content === "string" && Array.isArray(read?.sources) ? read.sources : [];
  const covered = new Set<string>();
  for (const stamp of stamps) if (Array.isArray(stamp) && typeof stamp[0] === "string") covered.add(stamp[0]);
  const summaries = new Map<string, string>();
  for (const record of Array.isArray(saved?.records) ? (saved.records as unknown[]) : []) {
    const { key, content: summary } = (record ?? {}) as { key?: unknown; content?: unknown };
    if (typeof key === "string" && !summaries.has(key) && typeof summary === "string" && summary.trim()) {
      summaries.set(key, summary.trim());
    }
  }
  return { timeline: typeof content === "string" ? content : "", covered, summaries, rebuilding };
}
