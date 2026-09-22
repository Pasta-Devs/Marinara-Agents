/**
 * Turn whatever the model sent back into an editable Creator draft.
 *
 * A draft is a suggestion the user edits before saving, so one field over its limit, a gender
 * spelled "woman", or tags sent as one string must not fail the whole draft. Each field is
 * repaired on its own, and every repair leaves a note the user can read. Only an answer with no
 * usable object or no display name is unusable.
 *
 * Standalone and pure so the rules can be tested without an Engine checkout.
 */
import type { SlpCreatorStageFacts } from "../../../../../shared/src/slp/slp-social.types.js";
import { normalizeSlurpDiscoveryTags, SLURP_DISCOVERY_MIN_TAGS } from "../discovery/slp-discovery-profile.js";
import { normalizeCreatorStageProfileDraft } from "./slp-stage-profile-normalize.js";

/** The same limits the shared stage-profile schema and the create form enforce. */
export const SLURP_STAGE_PROFILE_LIMITS = { displayName: 120, handle: 40, bio: 500, stagePersonality: 1000 } as const;

/**
 * How long one stage fact may be.
 *
 * Generous, because an appearance that has to stay identical across hundreds of pictures needs
 * room for the details that actually identify a person, not just hair and build.
 */
export const SLURP_STAGE_FACT_MAX_LENGTH = 2000;

export type SlurpRepairedStageProfileDraft = {
  displayName: string;
  handle: string;
  bio: string;
  stagePersonality: string;
  gender: "male" | "female" | "other" | null;
  tags: string[];
};

const GENDER_WORDS: Record<string, "male" | "female" | "other"> = {
  female: "female",
  woman: "female",
  girl: "female",
  f: "female",
  feminine: "female",
  male: "male",
  man: "male",
  boy: "male",
  m: "male",
  masculine: "male",
  other: "other",
  nonbinary: "other",
  "non-binary": "other",
  nb: "other",
  enby: "other",
  agender: "other",
  genderfluid: "other",
};

/** Cut text to `max` characters, at the last sentence end when one is near, never inside a surrogate pair. */
export function clampSlurpDraftText(value: string, max: number): string {
  const text = value.trim();
  if (text.length <= max) return text;
  let cut = text.slice(0, max);
  if (/[\uD800-\uDBFF]$/u.test(cut)) cut = cut.slice(0, -1);
  const sentenceEnd = Math.max(
    cut.lastIndexOf(". "),
    cut.lastIndexOf("! "),
    cut.lastIndexOf("? "),
    cut.lastIndexOf("\n"),
  );
  // Only prefer the sentence break when it keeps most of the text.
  return (sentenceEnd >= max * 0.6 ? cut.slice(0, sentenceEnd + 1) : cut).trimEnd();
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter((entry) => typeof entry === "string").join(" ");
  return "";
}

export function repairSlurpStageProfileDraft(
  value: unknown,
  allowedTags?: readonly string[],
): { draft: SlurpRepairedStageProfileDraft; notes: string[] } | null {
  const raw = normalizeCreatorStageProfileDraft(value);
  if (!raw) return null;
  const notes: string[] = [];
  const limited = (field: keyof typeof SLURP_STAGE_PROFILE_LIMITS, label: string, input: string) => {
    const max = SLURP_STAGE_PROFILE_LIMITS[field];
    const clamped = clampSlurpDraftText(input, max);
    if (clamped.length < input.trim().length) notes.push(`${label} was shortened to fit ${max} characters.`);
    return clamped;
  };

  const displayName = limited("displayName", "Display name", text(raw.displayName));
  if (!displayName) return null;

  let handle = text(raw.handle).trim().replace(/^@+/u, "").replace(/\s+/gu, "_");
  if (!handle) {
    handle = displayName
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}_]+/gu, "_")
      .replace(/^_+|_+$/gu, "");
    if (handle) notes.push("The handle was made from the display name.");
  }
  handle = limited("handle", "Handle", handle || "creator");

  const bio = limited("bio", "Bio", text(raw.bio));
  const stagePersonality = limited("stagePersonality", "Stage personality", text(raw.stagePersonality));

  const genderWord = typeof raw.gender === "string" ? raw.gender.trim().toLocaleLowerCase() : "";
  const gender = GENDER_WORDS[genderWord] ?? null;
  if (!gender) notes.push("Pick a gender before saving.");

  const tagInput = Array.isArray(raw.tags) ? raw.tags : typeof raw.tags === "string" ? raw.tags.split(/[,;|]/u) : [];
  const offered = tagInput.filter((tag): tag is string => typeof tag === "string" && tag.trim() !== "");
  const tags = normalizeSlurpDiscoveryTags(offered, allowedTags);
  // `normalizeSlurpDiscoveryTags` also drops duplicates and stops at the tag limit, so count the
  // ones the tag list refused on their own rather than blaming the list for every removal.
  const disallowed = allowedTags
    ? offered.filter((tag) => normalizeSlurpDiscoveryTags([tag], allowedTags).length === 0).length
    : 0;
  if (disallowed > 0) {
    notes.push(`${disallowed} suggested tag(s) were not in your tag list and were left out.`);
  } else if (offered.length > tags.length) {
    notes.push("Repeated or extra tags were left out.");
  }
  if (tags.length < SLURP_DISCOVERY_MIN_TAGS)
    notes.push(`Add at least ${SLURP_DISCOVERY_MIN_TAGS} tags before saving.`);

  return { draft: { displayName, handle, bio, stagePersonality, gender, tags }, notes };
}

/**
 * The stage facts out of a stage-profile input, or undefined when it carries none.
 *
 * `sourceAppearance` seeds an empty appearance on create only. A Creator drafted from a character
 * card already has a face written down; requiring the user to copy it across by hand is the reason
 * the field stayed empty, and an empty appearance is what let the image model invent a new person
 * for every post.
 */
export function slurpStageFacts(
  input: { appearance?: string; wardrobe?: string; locations?: string },
  sourceAppearance?: string,
): SlpCreatorStageFacts | undefined {
  const fact = (value: string | undefined) => value?.trim().slice(0, SLURP_STAGE_FACT_MAX_LENGTH) || undefined;
  const facts: SlpCreatorStageFacts = {
    ...((fact(input.appearance) ?? fact(sourceAppearance)) !== undefined && {
      appearance: (fact(input.appearance) ?? fact(sourceAppearance))!,
    }),
    ...(fact(input.wardrobe) !== undefined && { wardrobe: fact(input.wardrobe)! }),
    ...(fact(input.locations) !== undefined && { locations: fact(input.locations)! }),
  };
  return Object.keys(facts).length > 0 ? facts : undefined;
}
