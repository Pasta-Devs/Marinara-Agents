/**
 * What a post is *for*, by who can read it.
 *
 * A public post and a paid post were written from the same instructions, so a locked post sold a
 * subscription to somebody who had already bought one, and a public post gave away the payoff it
 * was supposed to advertise. The two now carry their own direction.
 *
 * This half is the shape and the precedence, with no database behind it, so the rules can be run
 * in a test. `slurp-post-guidance.storage.ts` holds the reading and writing.
 *
 * An empty string means "use the text one level up", which is why nothing here is defaulted to the
 * built-in copy: a Creator must be able to fall back to the global value, and the global value
 * must be able to fall back to the built-in one.
 */
import { SLURP_VISUAL_SEXUAL_LEVELS, type SlurpVisualSexualLevel } from "../../base/media/slp-visual-brief.js";

export const SLURP_POST_GUIDANCE_MAX_LENGTH = 4000;

/**
 * How far a Creator's pictures go, as a typed value rather than a sentence.
 *
 * It has to be typed because the visual brief is typed: a free-text menu can tell the writer what
 * a Creator offers, but it cannot set `sexualLevel`, so the brief was stuck on a hardcoded
 * `intent === "teaser" ? "suggestive" : "none"`. That made four posts in five carry an explicit
 * "this scene is non-sexual" instruction, including every locked post — on a platform whose whole
 * premise is that the locked post is the one worth paying for.
 *
 * An empty string means "use the level one level up", exactly like the guidance text beside it.
 */
export type SlurpExplicitLevel = SlurpVisualSexualLevel;

/**
 * The shipped level when nobody has chosen one.
 *
 * `suggestive` rather than something stronger: a fresh install should not surprise anyone, and the
 * dial is one field away in Backstage. Raising the global level there lifts every Creator that has
 * no override of its own.
 */
export const SLURP_BUILT_IN_EXPLICIT_LEVEL: SlurpExplicitLevel = "suggestive";

export type SlurpPostAccess = "public" | "locked";

/**
 * The one statement of how far this post goes, for the caption call. Only the picture used to be
 * told; the text was steered by five softer blocks that disagreed, and paid posts came out tame.
 */
const LEVEL_TEXT: Record<SlurpExplicitLevel, string> = {
  none: "This post is not sexual.",
  suggestive: "This post may be flirty and suggestive, teasing rather than explicit.",
  nudity: "This post may show and talk about you nude, the way this page's paid posts do.",
  explicit: "This post may be fully explicit, the way this page's paid posts are. Write it that way when it fits.",
};

export function slurpPostLevelInstruction(level: SlurpExplicitLevel): string {
  return `How far this post goes: ${LEVEL_TEXT[level]}`;
}
/**
 * `menu` is the Creator's private content menu: what they offer and what they will not do. It
 * rides along in this blob because it is the same kind of per-Creator direction, but it has no
 * global level; only a Creator's own entry is ever read.
 */
export type SlurpPostGuidanceEntry = {
  public: string;
  locked: string;
  menu: string;
  /** How far this Creator's pictures go. Empty means inherit. */
  level: SlurpExplicitLevel | "";
};
export type SlurpPostGuidance = {
  /** Applies to every Creator that has no override of its own. */
  defaults: SlurpPostGuidanceEntry;
  creators: Record<string, SlurpPostGuidanceEntry>;
};

/**
 * Used when neither the Creator nor the global field says anything, so access is differentiated
 * on a fresh install without anybody opening Settings.
 */
export const SLURP_BUILT_IN_POST_GUIDANCE: Omit<SlurpPostGuidanceEntry, "level"> = {
  public:
    "This post is public and may be a reader's first impression. Make it complete and worthwhile on its own: share a specific moment, thought, update, or image that expresses who you are and gives people something real to react to. When paid material is relevant, create honest curiosity by saving only the genuinely premium continuation for it; do not withhold the meaning of this post or turn every public post into a repetitive subscription pitch.",
  menu: "",
  locked:
    "This post is the premium continuation for someone who already subscribed or paid to unlock it. Deliver the promised extra value immediately through greater intimacy, candor, access, detail, or exclusivity that fits who you are and what led here; do not give them another sales pitch or another layer of artificial withholding. It must feel more personal, revealing, or substantial than a public post, at the level this Creator offers, and end as a satisfying payoff rather than a preview.",
};

const emptyEntry = (): SlurpPostGuidanceEntry => ({ public: "", locked: "", menu: "", level: "" });
const defaults = (): SlurpPostGuidance => ({ defaults: emptyEntry(), creators: {} });

function readText(value: unknown): string {
  return typeof value === "string" ? value.slice(0, SLURP_POST_GUIDANCE_MAX_LENGTH) : "";
}

function readLevel(value: unknown): SlurpExplicitLevel | "" {
  return typeof value === "string" && (SLURP_VISUAL_SEXUAL_LEVELS as readonly string[]).includes(value)
    ? (value as SlurpExplicitLevel)
    : "";
}

function readEntry(value: unknown): SlurpPostGuidanceEntry {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    public: readText(record.public),
    locked: readText(record.locked),
    menu: readText(record.menu),
    level: readLevel(record.level),
  };
}

/** An override that says nothing is not an override; storing it would only hide the global value. */
function hasText(entry: SlurpPostGuidanceEntry): boolean {
  return Boolean(entry.public.trim() || entry.locked.trim() || entry.menu.trim() || entry.level);
}

export function sanitizeSlurpPostGuidance(value: unknown): SlurpPostGuidance {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawCreators = record.creators && typeof record.creators === "object" ? record.creators : {};
  const creators: Record<string, SlurpPostGuidanceEntry> = {};
  for (const [creatorId, entry] of Object.entries(rawCreators as Record<string, unknown>)) {
    const parsed = readEntry(entry);
    if (creatorId && hasText(parsed)) creators[creatorId] = parsed;
  }
  return { defaults: readEntry(record.defaults), creators };
}

/** Creator override, then the global field, then the built-in text. */
export function selectSlurpPostGuidance(
  guidance: SlurpPostGuidance,
  creatorId: string,
  access: SlurpPostAccess,
): string {
  return (
    guidance.creators[creatorId]?.[access].trim() ||
    guidance.defaults[access].trim() ||
    SLURP_BUILT_IN_POST_GUIDANCE[access]
  );
}

/** Creator override, then the global field, then the shipped level. */
export function selectSlurpExplicitLevel(guidance: SlurpPostGuidance, creatorId: string): SlurpExplicitLevel {
  return guidance.creators[creatorId]?.level || guidance.defaults.level || SLURP_BUILT_IN_EXPLICIT_LEVEL;
}

/** Intents whose job is housekeeping. A schedule notice is not a nude whatever the dial says. */
const NON_SEXUAL_INTENTS = new Set(["business", "appreciation"]);

/**
 * How far one post goes, from the Creator's ceiling.
 *
 * A locked post delivers the ceiling: it is the thing somebody paid for, and a paid post that
 * withholds what the free feed already showed is the complaint this whole module exists to answer.
 * Everything public sits one step under it, so the free feed advertises the paid one instead of
 * replacing it. A teaser is public, so it lands on the same step — which is the correct reading of
 * "show enough that somebody wants the rest".
 */
export function slurpPostSexualLevel(input: {
  level: SlurpExplicitLevel;
  access: SlurpPostAccess;
  intent?: string;
}): SlurpExplicitLevel {
  if (input.intent && NON_SEXUAL_INTENTS.has(input.intent)) return "none";
  if (input.access === "locked") return input.level;
  const index = SLURP_VISUAL_SEXUAL_LEVELS.indexOf(input.level);
  return SLURP_VISUAL_SEXUAL_LEVELS[Math.max(0, index - 1)] ?? "none";
}

/** The Creator's own content menu. Empty when they have none; there is no global fallback. */
export function selectSlurpCreatorMenu(guidance: SlurpPostGuidance, creatorId: string): string {
  return guidance.creators[creatorId]?.menu.trim() ?? "";
}

/** Model answers arrive wrapped in quotes or a fence often enough to be worth undoing here. */
export function cleanSlurpPostGuidanceDraft(content: string): string {
  const fenced = content.trim().match(/^```[\w-]*\n([\s\S]*?)\n?```$/u);
  const body = (fenced?.[1] ?? content).trim();
  const unquoted = body.match(/^"([\s\S]+)"$/u)?.[1] ?? body;
  return unquoted.trim().slice(0, SLURP_POST_GUIDANCE_MAX_LENGTH);
}
