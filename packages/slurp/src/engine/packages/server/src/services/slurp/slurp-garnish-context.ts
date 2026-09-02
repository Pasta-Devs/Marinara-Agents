/**
 * The seam between Slurp and garnish-ads.
 *
 * garnish-ads never reads Slurp data. Slurp maps its own domain onto the
 * neutral shape here and pushes it in. This is the one file that knows both
 * worlds, and it is the file that stays behind if garnish-ads ever moves out
 * into its own agent.
 */
import type { GarnishAdContext, GarnishPlatform } from "../garnish-ads/garnish-ads.types.js";

export const SLURP_GARNISH_PLATFORM: GarnishPlatform = "slurp";

const KNOWN_AD_TAGS = [
  "coffee",
  "late-night",
  "work",
  "beauty",
  "luxury",
  "nightlife",
  "night",
  "private",
  "fashion",
] as const;

/**
 * Derive targeting tags from a Slurp persona's own words.
 *
 * ponytail: whole-word match over a fixed 9-tag list. Substring matching used
 * to fire "night" inside "nightlife" and "work" inside "network"; the word
 * boundaries fix that. Replace the fixed list with generation-supplied tags
 * once the pool grows past the shipped base ads.
 */
export function garnishTagsFromPersona(persona: {
  name?: string | null;
  description?: string | null;
  personality?: string | null;
}): string[] {
  const text = [persona.name, persona.description, persona.personality].filter(Boolean).join(" ").toLowerCase();
  return KNOWN_AD_TAGS.filter((tag) => new RegExp(`\\b${tag}\\b`, "u").test(text));
}

/** Build the neutral targeting context garnish-ads consumes. */
export function garnishContextForViewer(input: {
  persona: { name?: string | null; description?: string | null; personality?: string | null } | null;
  creator: { id: string; handle: string } | null;
  contextTags: string[];
  preferredTags: string[];
  steering: GarnishAdContext["steering"];
}): GarnishAdContext {
  return {
    subjectTags: input.persona ? garnishTagsFromPersona(input.persona) : [],
    currentCreatorId: input.creator?.id,
    currentCreatorHandle: input.creator?.handle,
    contextTags: input.contextTags,
    preferredTags: input.preferredTags,
    steering: input.steering,
  };
}
