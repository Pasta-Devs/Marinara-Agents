import {
  noodleGeneratedProfileSchema,
  noodleGeneratedProfilesSchema,
  type NoodleGeneratedProfile,
} from "@marinara-engine/shared";

export type RejectedNoodleGeneratedProfile = {
  index: number;
  issueCount: number;
};

/**
 * Parse model-generated profile rows independently so one malformed account
 * cannot discard valid profiles from the same Noodle setup batch.
 */
export function parseNoodleGeneratedProfiles(value: unknown): {
  profiles: NoodleGeneratedProfile[];
  rejected: RejectedNoodleGeneratedProfile[];
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
    noodleGeneratedProfilesSchema.parse(normalizedValue);
    return { profiles: [], rejected: [] };
  }

  const profiles: NoodleGeneratedProfile[] = [];
  const rejected: RejectedNoodleGeneratedProfile[] = [];
  rawProfiles.forEach((rawProfile, index) => {
    const parsed = noodleGeneratedProfileSchema.safeParse(rawProfile);
    if (parsed.success) profiles.push(parsed.data);
    else rejected.push({ index, issueCount: parsed.error.issues.length });
  });
  return { profiles, rejected };
}
