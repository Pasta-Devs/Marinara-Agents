import {
  DEFAULT_NOODLE_SETTINGS,
  type NoodleSettings,
} from "@marinara-engine/shared";

/**
 * Which settings each section owns.
 *
 * Every edit saves instantly, with no undo, and nothing shows which values differ from the
 * shipped defaults. This map is the minimum needed to answer both questions per section — it
 * holds keys only, deliberately. Labels, help text, ranges, and control types stay in the JSX
 * that renders them, so this does not become a second place to maintain a setting.
 *
 * The structure test asserts every key of `NoodleSettings` appears here exactly once, so a new
 * setting cannot silently escape the changed-count and the reset action.
 */
export type NoodleSettingsSectionId =
  | "general"
  | "timeline"
  | "images"
  | "participants"
  | "advanced"
  | "noodler";

export const NOODLE_SETTINGS_SECTION_KEYS: Record<
  NoodleSettingsSectionId,
  readonly (keyof NoodleSettings)[]
> = {
  general: ["generationConnectionId", "refreshesPerDay", "theme"],
  timeline: [
    "maxGeneratedPostsPerRefresh",
    "maxRepliesPerRefresh",
    "maxRepostsPerRefresh",
    "maxLikesPerRefresh",
  ],
  images: [
    "enableImagePrompts",
    "imageGenerationConnectionId",
    "imageGenerationPrompt",
    "imageGenerationUseAvatarReferences",
    "imageGenerationIncludeDescriptions",
    "allowGalleryImageAttachments",
    "maxImagesPerRefresh",
    "imageCaptioningEnabled",
    "imageCaptioningConnectionId",
    "imageCaptioningUseConnectionDefault",
  ],
  participants: [
    "participantSelectionMode",
    "participantMin",
    "participantMax",
    "allowProfessorMari",
    "allowRandomUsers",
    "invitedCharacterGroupIds",
  ],
  advanced: [
    "enableLorebookContext",
    "includeCharacterSchedules",
    "enableEnhancedTimelineWriting",
    "carryoverMode",
    "carryoverModes",
    "carryoverHours",
    "carryoverMaxItems",
  ],
  noodler: [
    "enableNoodler",
    "noodlerGenerationGuidance",
    "autoPostingScheduleEnabled",
    "postsPerDay",
    "noodlerNightQuiet",
    "fanActivityEnabled",
    "fanActivityRunsPerDay",
    "fanLikesPerRefresh",
    "fanRepliesPerRefresh",
    "fanRepostsPerRefresh",
    "fanArchetypeWeights",
    // Onboarding progress, not a preference. Listed so the completeness check passes, but
    // excluded from resets below: resetting a section must never reopen the wizard.
    "noodlerOnboardingComplete",
    "noodlerOnboardingState",
  ],
};

/**
 * Never restored by a reset, whatever section they belong to. These record what the player has
 * already done rather than how they want things to behave.
 */
const NOODLE_SETTINGS_RESET_EXCLUDED: ReadonlySet<keyof NoodleSettings> =
  new Set(["noodlerOnboardingComplete", "noodlerOnboardingState"]);

function isDefault(settings: NoodleSettings, key: keyof NoodleSettings): boolean {
  const current = settings[key];
  const shipped = DEFAULT_NOODLE_SETTINGS[key];
  // Arrays and the archetype-weight record need a value comparison; the rest are primitives.
  if (typeof current === "object" && current !== null) {
    return JSON.stringify(current) === JSON.stringify(shipped);
  }
  return current === shipped;
}

/** Keys in this section whose value differs from the shipped default. */
export function changedNoodleSettingKeys(
  settings: NoodleSettings | undefined,
  section: NoodleSettingsSectionId,
): (keyof NoodleSettings)[] {
  if (!settings) return [];
  return NOODLE_SETTINGS_SECTION_KEYS[section].filter(
    (key) => !NOODLE_SETTINGS_RESET_EXCLUDED.has(key) && !isDefault(settings, key),
  );
}

/**
 * The patch that returns one section to its defaults, and only that section. Excluded keys and
 * keys that already match are left out, so a reset writes nothing when there is nothing to undo.
 */
export function noodleSettingsResetPatch(
  settings: NoodleSettings | undefined,
  section: NoodleSettingsSectionId,
): Partial<NoodleSettings> {
  const patch: Record<string, unknown> = {};
  for (const key of changedNoodleSettingKeys(settings, section)) {
    patch[key] = DEFAULT_NOODLE_SETTINGS[key];
  }
  return patch as Partial<NoodleSettings>;
}
