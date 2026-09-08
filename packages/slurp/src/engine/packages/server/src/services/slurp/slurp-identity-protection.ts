import type { NoodleIdentityDisclosure, NoodleStageProfileInput, NoodlerSourceSnapshot } from "@marinara-engine/shared";

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

export function protectNoodlerGeneratedIdentity(
  value: string | null | undefined,
  mode: NoodleIdentityDisclosure,
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
  profile: NoodleStageProfileInput,
  publicIdentity: PublicIdentity,
): boolean {
  if (profile.disclosureMode === "open") return false;
  const values = [profile.displayName, profile.handle, profile.bio, profile.stagePersonality];
  const protectedValues = protectedIdentityValues(publicIdentity);
  return values.some((value) => protectedValues.some((identifier) => containsIdentity(value, identifier)));
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

export function stageProfileContainsSourceDetails(
  profile: NoodleStageProfileInput,
  source: NoodlerSourceSnapshot,
): boolean {
  if (profile.disclosureMode === "open") return false;
  const profileText = [profile.displayName, profile.handle, profile.bio, profile.stagePersonality].join(" ");
  const normalizedProfile = ` ${normalizedDisclosureWords(profileText).join(" ")} `;
  // Personality is deliberately part of the seed both concealed modes receive: "body, voice, and
  // everyday texture are inseparable from the person and stay in" (slurp-prompt-safety.ts). Checking
  // Secret against it punished that mode for using material it was handed, and made Secret the tier
  // most likely to fail creation. Both modes are now held to the same field set.
  const sourceFields = [source.name, source.description, source.scenario, source.appearance, source.backstory];
  return sourceFields.some((field) => {
    const words = normalizedDisclosureWords(field);
    if (words.length === 0) return false;
    if (words.length <= 3) {
      return words.every((word) => normalizedProfile.includes(` ${word} `));
    }
    for (let index = 0; index <= words.length - 4; index += 1) {
      if (normalizedProfile.includes(` ${words.slice(index, index + 4).join(" ")} `)) {
        return true;
      }
    }
    return false;
  });
}
