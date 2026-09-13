import { z } from "zod";
import type { NoodleStageProfileInput } from "@marinara-engine/shared";

export const SLURP_DISCOVERY_GENDERS = ["male", "female", "other"] as const;
export type SlurpDiscoveryGender = (typeof SLURP_DISCOVERY_GENDERS)[number];

export const SLURP_DISCOVERY_TAGS = [
  "art",
  "cosplay",
  "fashion",
  "fantasy",
  "fitness",
  "gaming",
  "music",
  "outdoors",
  "sci-fi",
  "dominant",
  "flirty",
  "mysterious",
  "playful",
  "romantic",
  "submissive",
  "wholesome",
  "bdsm",
  "exhibitionism",
  "feet",
  "lingerie",
  "roleplay",
  "toys",
] as const;

export const SLURP_DISCOVERY_TAG_LIMIT = 8;
export const SLURP_DISCOVERY_TAG_MAX_LENGTH = 24;

export type SlurpStageProfileInput = NoodleStageProfileInput & {
  gender: SlurpDiscoveryGender | null;
  tags: string[];
};

export const slurpDiscoveryGenderSchema = z.enum(SLURP_DISCOVERY_GENDERS).nullable().default(null);

export function normalizeSlurpDiscoveryTag(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export function normalizeSlurpDiscoveryTags(value: unknown, curatedOnly = false): string[] {
  if (!Array.isArray(value)) return [];
  const curated = new Map<string, string>(SLURP_DISCOVERY_TAGS.map((tag) => [tag.toLocaleLowerCase(), tag]));
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
    .transform((value) => normalizeSlurpDiscoveryTags(value, true)),
});

export function slurpDiscoveryFields(value: unknown): Pick<SlurpStageProfileInput, "gender" | "tags"> {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const gender = slurpDiscoveryGenderSchema.safeParse(record.gender);
  return {
    gender: gender.success ? gender.data : null,
    tags: normalizeSlurpDiscoveryTags(record.tags),
  };
}
