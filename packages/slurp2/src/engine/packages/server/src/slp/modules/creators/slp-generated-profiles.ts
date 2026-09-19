import {
  slpGeneratedProfileSchema,
  slpGeneratedProfilesSchema,
  type SlpGeneratedProfile,
} from "../../../../../shared/src/slp/slp-social-generation.schema.js";

export type RejectedSlpGeneratedProfile = {
  index: number;
  issueCount: number;
};

/**
 * Parse model-generated profile rows independently so one malformed account
 * cannot discard valid profiles from the same Noodle setup batch.
 */
export function parseSlpGeneratedProfiles(value: unknown): {
  profiles: SlpGeneratedProfile[];
  rejected: RejectedSlpGeneratedProfile[];
} {
  const wrappedValue =
    Array.isArray(value) &&
    value.length === 1 &&
    value[0] &&
    typeof value[0] === "object" &&
    !Array.isArray(value[0]) &&
    Object.prototype.hasOwnProperty.call(value[0], "profiles")
      ? (value[0] as Record<string, unknown>)
      : null;
  const normalizedValue = wrappedValue ?? value;
  const record =
    normalizedValue && typeof normalizedValue === "object" && !Array.isArray(normalizedValue)
      ? (normalizedValue as Record<string, unknown>)
      : null;
  const rawProfiles = Array.isArray(value) ? (wrappedValue ? wrappedValue.profiles : value) : record?.profiles;
  if (!Array.isArray(rawProfiles)) {
    // Preserve the useful top-level validation error for a wholly malformed
    // response. Only a single object wrapper and individual profile failures
    // are recoverable.
    slpGeneratedProfilesSchema.parse(normalizedValue);
    return { profiles: [], rejected: [] };
  }

  const profiles: SlpGeneratedProfile[] = [];
  const rejected: RejectedSlpGeneratedProfile[] = [];
  rawProfiles.forEach((rawProfile, index) => {
    const parsed = slpGeneratedProfileSchema.safeParse(rawProfile);
    if (parsed.success) profiles.push(parsed.data);
    else rejected.push({ index, issueCount: parsed.error.issues.length });
  });
  return { profiles, rejected };
}
