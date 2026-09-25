/**
 * Level 1 of the beats planner: shared ideas that many Creators can use.
 *
 * Pure. The feature layer makes the calls and stores the results; this decides what they ask for,
 * what an answer may contain, and which ideas a Creator can use today.
 *
 * A shared idea is a template with one `{a}` slot, never a finished moment. The selector fills the
 * slot with the Creator's own canon anchor, so a world moment ("the first autumn storm") becomes
 * this Creator's moment ("…while you are at the bar"). Shared decks without that step made every
 * Creator post the same thing, which is the failure this whole planner exists to fix. Each idea is
 * also capped per day across the feed.
 */
import { SLURP_ANCHOR_KINDS, SLURP_BEAT_TYPES, type SlurpAnchorKind, type SlurpBeatType } from "./slp-post-beat.js";

export type SlurpSharedIdea = {
  id: string;
  type: SlurpBeatType;
  anchorKind: SlurpAnchorKind;
  /** One sentence in the second person with exactly one `{a}`. */
  template: string;
  source: "world" | "niche";
};

/** A generated Slurp-wide event, before it becomes a platform event. */
export type SlurpSharedWorldEvent = { name: string; guidance: string; days: number };

/** How many Creators may use one shared idea per day. */
export const SLURP_SHARED_IDEA_DAILY_CAP = 2;
export const SLURP_NICHE_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

const IDEAS_MAX = 6;
const TEMPLATE_MAX = 160;
/** Tag groups that describe a mood or an adult interest, not a line of work or a hobby. */
const NON_TOPICAL_GROUPS = new Set(["vibe", "adult"]);

const IDEA_RULES = [
  `Each idea is one sentence in the second person ("you"), with exactly one {a} slot that the app fills with something from the Creator's own life. anchorKind says what fills it: ${SLURP_ANCHOR_KINDS.join(", ")}.`,
  `type is one of: ${SLURP_BEAT_TYPES.filter((type) => type !== "callback").join(", ")}. Use a mix of types; at most one mishap.`,
  "A small, concrete, postable moment happening today. No earlier events, no named people, no life changes, no dates.",
].join("\n");

/** The daily world tick: seasonal and platform moments for everyone, and optionally one event. */
export function slurpWorldTickPrompt(input: { date: string; withEvent: boolean }): { system: string; user: string } {
  return {
    system: [
      "You plan shared moments for a simulated creator platform, one day at a time.",
      `Return JSON only: {"ideas":[{"type":"","anchorKind":"","template":""}]${input.withEvent ? ',"event":{"name":"","guidance":"","days":3}' : ""}}.`,
      `ideas: up to ${IDEAS_MAX} moments that fit this date for anybody: season, weather, a holiday, or a light platform trend.`,
      IDEA_RULES,
      ...(input.withEvent
        ? [
            "event: one short platform-wide theme for the next days (a challenge or themed week) with a name of at most 60 characters, one or two sentences of guidance for creators, and days from 1 to 7. Use null when nothing fits.",
          ]
        : []),
    ].join("\n"),
    user: `Date: ${input.date}`,
  };
}

/** The weekly niche patterns for one topic tag. */
export function slurpNichePatternsPrompt(tag: string): { system: string; user: string } {
  return {
    system: [
      "You list typical moments for one kind of creator on a simulated creator platform.",
      'Return JSON only: {"ideas":[{"type":"","anchorKind":"","template":""}]}.',
      `ideas: up to ${IDEAS_MAX} moments that are typical for creators with this topic: their tools, problems, routines, and wins.`,
      IDEA_RULES,
    ].join("\n"),
    user: `Topic tag: ${tag}`,
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** The ideas in a model answer. A template without exactly one `{a}` cannot be made personal. */
export function normalizeSlurpSharedIdeas(
  raw: unknown,
  source: SlurpSharedIdea["source"],
  idPrefix: string,
): SlurpSharedIdea[] {
  const value = Array.isArray(raw) && raw.length === 1 ? raw[0] : raw;
  const ideas = Array.isArray(record(value).ideas) ? (record(value).ideas as unknown[]) : [];
  return ideas
    .map(record)
    .map((entry) => ({
      type: entry.type as SlurpBeatType,
      anchorKind: entry.anchorKind as SlurpAnchorKind,
      template: String(entry.template ?? "")
        .replace(/\s+/gu, " ")
        .trim(),
    }))
    .filter(
      (entry) =>
        // A callback needs a real earlier post, which no shared idea has.
        SLURP_BEAT_TYPES.includes(entry.type) &&
        entry.type !== "callback" &&
        SLURP_ANCHOR_KINDS.includes(entry.anchorKind) &&
        entry.template.length <= TEMPLATE_MAX &&
        entry.template.split("{a}").length === 2,
    )
    .slice(0, IDEAS_MAX)
    .map((entry, index) => ({ ...entry, id: `${idPrefix}:${index}`, source }));
}

/** The optional event in a world-tick answer, or null. */
export function normalizeSlurpSharedWorldEvent(raw: unknown): SlurpSharedWorldEvent | null {
  const value = Array.isArray(raw) && raw.length === 1 ? raw[0] : raw;
  const event = record(record(value).event);
  const name = String(event.name ?? "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 60);
  const guidance = String(event.guidance ?? "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 600);
  const days = Number(event.days);
  if (!name || !guidance) return null;
  return { name, guidance, days: Number.isFinite(days) ? Math.min(7, Math.max(1, Math.round(days))) : 3 };
}

/** A Creator's topic tags: their tags minus curated mood and adult tags. Custom tags count as topics. */
export function slurpTopicalTags(
  creatorTags: readonly string[],
  curated: readonly { tag: string; group: string }[],
): string[] {
  const groups = new Map(curated.map((entry) => [entry.tag.toLocaleLowerCase(), entry.group]));
  return creatorTags
    .map((tag) => tag.toLocaleLowerCase())
    .filter((tag) => !NON_TOPICAL_GROUPS.has(groups.get(tag) ?? ""));
}

/** The ideas this Creator may draw from today: world ideas and their topics' patterns, under the cap. */
export function slurpUsableSharedIdeas(input: {
  world: readonly SlurpSharedIdea[];
  niche: Readonly<Record<string, readonly SlurpSharedIdea[]>>;
  topics: readonly string[];
  usedToday: Readonly<Record<string, number>>;
}): SlurpSharedIdea[] {
  return [...input.world, ...input.topics.flatMap((topic) => input.niche[topic] ?? [])].filter(
    (idea) => (input.usedToday[idea.id] ?? 0) < SLURP_SHARED_IDEA_DAILY_CAP,
  );
}
