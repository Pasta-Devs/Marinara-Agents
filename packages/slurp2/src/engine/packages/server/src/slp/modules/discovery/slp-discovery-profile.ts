import { z } from "zod";
import type { SlpStageProfileInput } from "../../../../../shared/src/slp/slp-social-generation.schema.js";

export const SLURP_DISCOVERY_GENDERS = ["male", "female", "other"] as const;
export type SlurpDiscoveryGender = (typeof SLURP_DISCOVERY_GENDERS)[number];

/** Seed for the `discoveryTags` setting only. Read the setting, not this list. */
export const SLURP_DISCOVERY_TAG_SEED: ReadonlyArray<{ tag: string; group: string }> = [
  ...["art", "cosplay", "fashion", "fantasy", "fitness", "gaming", "music", "outdoors", "sci-fi"].map((tag) => ({
    tag,
    group: "themes",
  })),
  ...["dominant", "flirty", "mysterious", "playful", "romantic", "submissive", "wholesome"].map((tag) => ({
    tag,
    group: "vibe",
  })),
  ...["bdsm", "exhibitionism", "feet", "lingerie", "roleplay", "toys"].map((tag) => ({ tag, group: "adult" })),
];

export const SLURP_DISCOVERY_MIN_TAGS = 3;

export const SLURP_DISCOVERY_TAG_LIMIT = 8;
export const SLURP_DISCOVERY_TAG_MAX_LENGTH = 24;

export type SlurpStageProfileInput = SlpStageProfileInput & {
  gender: SlurpDiscoveryGender | null;
  tags: string[];
};

export const slurpDiscoveryGenderSchema = z.enum(SLURP_DISCOVERY_GENDERS).nullable().default(null);

export function normalizeSlurpDiscoveryTag(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

/** With `allowed`, only tags in that list survive (the `discoveryTags` setting). */
export function normalizeSlurpDiscoveryTags(value: unknown, allowed?: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  const curatedOnly = allowed !== undefined;
  const curated = new Map<string, string>(
    (allowed ?? SLURP_DISCOVERY_TAG_SEED.map((entry) => entry.tag)).map((tag) => [tag.toLocaleLowerCase(), tag]),
  );
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (typeof candidate !== "string") continue;
    const enteredTag = normalizeSlurpDiscoveryTag(candidate);
    const key = enteredTag.toLocaleLowerCase();
    const tag = curated.get(key) ?? enteredTag;
    if (!tag || tag.length > SLURP_DISCOVERY_TAG_MAX_LENGTH || (curatedOnly && !curated.has(key)) || seen.has(key))
      continue;
    seen.add(key);
    normalized.push(tag);
    if (normalized.length === SLURP_DISCOVERY_TAG_LIMIT) break;
  }
  return normalized;
}

export const slurpDiscoveryTagsSchema = z
  .array(z.string().max(100))
  .max(SLURP_DISCOVERY_TAG_LIMIT)
  .transform((value) => normalizeSlurpDiscoveryTags(value));

export const slurpDiscoveryProfileSchema = z.object({
  gender: slurpDiscoveryGenderSchema,
  tags: slurpDiscoveryTagsSchema.default([]),
});

export const slurpGeneratedDiscoveryProfileSchema = z.object({
  gender: z.enum(SLURP_DISCOVERY_GENDERS).nullable(),
  tags: z
    .array(z.string())
    .max(SLURP_DISCOVERY_TAG_LIMIT)
    .transform((value) => normalizeSlurpDiscoveryTags(value)),
});

/** Creation needs a gender and at least three tags; editing an existing Creator does not. */
export function slurpDiscoveryProfileComplete(profile: { gender: unknown; tags: readonly string[] }): boolean {
  return profile.gender !== null && profile.tags.length >= SLURP_DISCOVERY_MIN_TAGS;
}

/** Rename (`to` set) or delete (`to` null) one tag in a Creator's tag list, matched case-insensitively. */
export function replaceSlurpDiscoveryTag(tags: readonly string[], from: string, to: string | null): string[] {
  const key = normalizeSlurpDiscoveryTag(from).toLocaleLowerCase();
  return normalizeSlurpDiscoveryTags(
    tags.flatMap((tag) => (tag.toLocaleLowerCase() === key ? (to ? [to] : []) : [tag])),
  );
}

export function slurpDiscoveryFields(value: unknown): Pick<SlurpStageProfileInput, "gender" | "tags"> {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const gender = slurpDiscoveryGenderSchema.safeParse(record.gender);
  return {
    gender: gender.success ? gender.data : null,
    tags: normalizeSlurpDiscoveryTags(record.tags),
  };
}
