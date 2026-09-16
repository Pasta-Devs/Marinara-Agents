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
export const SLURP_POST_GUIDANCE_MAX_LENGTH = 4000;

export type SlurpPostAccess = "public" | "locked";
export type SlurpPostGuidanceEntry = { public: string; locked: string };
export type SlurpPostGuidance = {
  /** Applies to every Creator that has no override of its own. */
  defaults: SlurpPostGuidanceEntry;
  creators: Record<string, SlurpPostGuidanceEntry>;
};

/**
 * Used when neither the Creator nor the global field says anything, so access is differentiated
 * on a fresh install without anybody opening Settings.
 */
export const SLURP_BUILT_IN_POST_GUIDANCE: SlurpPostGuidanceEntry = {
  public:
    "This post is public and may be a reader's first impression. Make it complete and worthwhile on its own: share a specific moment, thought, update, or image that expresses who you are and gives people something real to react to. When paid material is relevant, create honest curiosity by saving only the genuinely premium continuation for it; do not withhold the meaning of this post or turn every public post into a repetitive subscription pitch.",
  locked:
    "This post is the premium continuation for someone who already subscribed or paid to unlock it. Deliver the promised extra value immediately through greater intimacy, candor, access, detail, or exclusivity that fits who you are and what led here; do not give them another sales pitch or another layer of artificial withholding. Premium does not have to mean sexual, but it must feel more personal or substantial than a public post and end as a satisfying payoff rather than a preview.",
};

const emptyEntry = (): SlurpPostGuidanceEntry => ({ public: "", locked: "" });
const defaults = (): SlurpPostGuidance => ({ defaults: emptyEntry(), creators: {} });

function readText(value: unknown): string {
  return typeof value === "string" ? value.slice(0, SLURP_POST_GUIDANCE_MAX_LENGTH) : "";
}

function readEntry(value: unknown): SlurpPostGuidanceEntry {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return { public: readText(record.public), locked: readText(record.locked) };
}

/** An override that says nothing is not an override; storing it would only hide the global value. */
function hasText(entry: SlurpPostGuidanceEntry): boolean {
  return Boolean(entry.public.trim() || entry.locked.trim());
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

/** Model answers arrive wrapped in quotes or a fence often enough to be worth undoing here. */
export function cleanSlurpPostGuidanceDraft(content: string): string {
  const fenced = content.trim().match(/^```[\w-]*\n([\s\S]*?)\n?```$/u);
  const body = (fenced?.[1] ?? content).trim();
  const unquoted = body.match(/^"([\s\S]+)"$/u)?.[1] ?? body;
  return unquoted.trim().slice(0, SLURP_POST_GUIDANCE_MAX_LENGTH);
}
