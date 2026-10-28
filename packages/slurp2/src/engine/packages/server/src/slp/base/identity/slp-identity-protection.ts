import type { SlpStageProfileInput } from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import type {
  SlpCreatorSourceSnapshot,
  SlpIdentityDisclosure,
} from "../../../../../shared/src/slp/slp-social.types.js";

/**
 * The privacy core of Slurp's disclosure tiers, kept in a leaf module on purpose.
 *
 * These functions decide what a Hinted or Secret creator may say and what leaks out of generated
 * text. They used to live inside slurp-generation.service.ts, which pulls in the database, storage,
 * and LLM providers, so nothing could import them and every test that covered them had to grep the
 * source instead of running it. A grep passes forever regardless of runtime behaviour, which is how
 * the highest-consequence logic in the feature ended up with no behavioural coverage at all.
 *
 * Only `import type` here: type imports are erased, so this module stays importable on its own.
 */

export type PublicIdentity = {
  displayName: string;
  handle: string;
  sourceIdentifiers?: readonly string[];
};

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function containsIdentity(value: string, identifier: string): boolean {
  if (!identifier.trim()) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}_])@?${escapeRegExp(identifier.trim())}(?=$|[^\\p{L}\\p{N}_])`, "iu").test(value);
}

/** Longest first, so "Mari Vale" is replaced before the "Mari" inside it. */
export function protectedIdentityValues(publicIdentity: PublicIdentity): string[] {
  return [publicIdentity.displayName, publicIdentity.handle, ...(publicIdentity.sourceIdentifiers ?? [])]
    .map((value) => value.trim())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index)
    .sort((left, right) => right.length - left.length);
}

export function protectCreatorGeneratedIdentity(
  value: string | null | undefined,
  mode: SlpIdentityDisclosure,
  publicIdentity: PublicIdentity | null,
): string | null {
  if (!value?.trim()) return null;
  if (mode === "open" || !publicIdentity) return value.trim();
  const protectedValues = protectedIdentityValues(publicIdentity);
  // A hinted slip is rewritten into something a creator would actually type, not a label.
  const replacement = mode === "hinted" ? "you-know-who" : "someone";
  return protectedValues
    .reduce(
      (current, identifier) =>
        current.replace(
          new RegExp(`(^|[^\\p{L}\\p{N}_])@?${escapeRegExp(identifier)}(?=$|[^\\p{L}\\p{N}_])`, "giu"),
          (_match, prefix: string) => `${prefix}${replacement}`,
        ),
      value,
    )
    .replace(new RegExp(`(?:${replacement})(?:\\s*\\(@?${replacement}\\))?`, "giu"), replacement)
    .trim();
}

export function stageProfileContainsPublicIdentity(
  profile: SlpStageProfileInput & { tags?: readonly string[] },
  publicIdentity: PublicIdentity,
): boolean {
  return stageProfilePublicIdentityLeak(profile, publicIdentity) !== null;
}

/**
 * Words shorter than four characters are dropped before the overlap check below, so the rule the
 * model is given must be worded as "distinctive words, ignoring short connecting words" rather than
 * "four consecutive words". See the concealment briefs in slurp-stage-profile-draft.service.ts.
 */
export function normalizedDisclosureWords(value: string): string[] {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/u)
    .filter((word) => word.length >= 4);
}

/** Whether `text` copies a source field: a whole short field, or a run of four distinctive words. */
function textCopiesSourceDetails(text: string, source: SlpCreatorSourceSnapshot): boolean {
  const normalizedText = ` ${normalizedDisclosureWords(text).join(" ")} `;
  // Personality is deliberately part of the seed both concealed modes receive: "body, voice, and
  // everyday texture are inseparable from the person and stay in" (slurp-prompt-safety.ts). Checking
  // Secret against it punished that mode for using material it was handed, and made Secret the tier
  // most likely to fail creation. Both modes are now held to the same field set.
  const sourceFields = [source.name, source.description, source.scenario, source.appearance, source.backstory];
  return sourceFields.some((field) => {
    const words = normalizedDisclosureWords(field);
    if (words.length === 0) return false;
    if (words.length <= 3) {
      return words.every((word) => normalizedText.includes(` ${word} `));
    }
    for (let index = 0; index <= words.length - 4; index += 1) {
      if (normalizedText.includes(` ${words.slice(index, index + 4).join(" ")} `)) {
        return true;
      }
    }
    return false;
  });
}

/**
 * The tag that gives a concealed profile away, `""` when the profile text does, or null.
 *
 * Tags are separate labels, so each one is checked on its own: joined with the bio, words from
 * different fields completed a short source field ("long silver hair") that no field copied, and
 * the editor could not say which tag to change (#73).
 */
export function stageProfileSourceDetailLeak(
  profile: SlpStageProfileInput & { tags?: readonly string[] },
  source: SlpCreatorSourceSnapshot,
): string | null {
  if (profile.disclosureMode === "open") return null;
  const tag = (profile.tags ?? []).find((value) => textCopiesSourceDetails(value, source));
  if (tag) return tag;
  const profileText = [profile.displayName, profile.handle, profile.bio, profile.stagePersonality].join(" ");
  return textCopiesSourceDetails(profileText, source) ? "" : null;
}

export function stageProfileContainsSourceDetails(
  profile: SlpStageProfileInput & { tags?: readonly string[] },
  source: SlpCreatorSourceSnapshot,
): boolean {
  return stageProfileSourceDetailLeak(profile, source) !== null;
}

/** The tag that names the source, `""` when the profile text does, or null. */
export function stageProfilePublicIdentityLeak(
  profile: SlpStageProfileInput & { tags?: readonly string[] },
  publicIdentity: PublicIdentity,
): string | null {
  if (profile.disclosureMode === "open") return null;
  const protectedValues = protectedIdentityValues(publicIdentity);
  const names = (value: string) => protectedValues.some((identifier) => containsIdentity(value, identifier));
  const tag = (profile.tags ?? []).find(names);
  if (tag) return tag;
  return [profile.displayName, profile.handle, profile.bio, profile.stagePersonality].some(names) ? "" : null;
}
