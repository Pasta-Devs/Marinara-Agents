import { DEFAULT_NOODLE_SETTINGS, type NoodleSettings, type NoodleSettingsUpdateInput } from "@marinara-engine/shared";

export type PackageNoodleSettings = NoodleSettings & {
  enableImageInterpretation: boolean;
  promptPresets: import("./noodle-prompt-presets").NoodlePromptPreset[];
};
export type PackageNoodleSettingsUpdateInput = NoodleSettingsUpdateInput &
  Partial<Pick<PackageNoodleSettings, "enableImageInterpretation">> &
  Partial<Pick<PackageNoodleSettings, "promptPresets">>;
const PACKAGE_NOODLE_SETTINGS_DEFAULTS: PackageNoodleSettings = {
  ...DEFAULT_NOODLE_SETTINGS,
  enableImageInterpretation: true,
  promptPresets: [],
};

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
export type NoodleSettingsSectionId = "general" | "timeline" | "images" | "participants" | "advanced";

export const NOODLE_SETTINGS_SECTION_KEYS: Record<NoodleSettingsSectionId, readonly (keyof PackageNoodleSettings)[]> = {
  general: ["generationConnectionId", "refreshesPerDay", "theme"],
  timeline: ["maxGeneratedPostsPerRefresh", "maxRepliesPerRefresh", "maxRepostsPerRefresh", "maxLikesPerRefresh"],
  images: [
    "enableImagePrompts",
    "imageGenerationConnectionId",
    "imageGenerationPrompt",
    "imageGenerationUseAvatarReferences",
    "imageGenerationIncludeDescriptions",
    "enableImageInterpretation",
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
    "promptPresets",
  ],
};

/**
 * Setup, not preference. These are excluded from the changed-count and from resets, whatever
 * section they belong to.
 *
 * Their defaults describe an unconfigured profile rather than a chosen behaviour: the connection
 * IDs all default to null and nothing works until you pick one. Counting them made the General
 * tab show a permanent badge for every user, which tells you nothing. A reset of the Images
 * section would also clear the image connections it depends on.
 */
const NOODLE_SETTINGS_RESET_EXCLUDED: ReadonlySet<keyof PackageNoodleSettings> = new Set([
  "generationConnectionId",
  "imageGenerationConnectionId",
  "imageCaptioningConnectionId",
  "promptPresets",
]);

function isDefault(settings: PackageNoodleSettings, key: keyof PackageNoodleSettings): boolean {
  const current = settings[key];
  const shipped = PACKAGE_NOODLE_SETTINGS_DEFAULTS[key];
  // Arrays and the archetype-weight record need a value comparison; the rest are primitives.
  if (typeof current === "object" && current !== null) {
    return JSON.stringify(current) === JSON.stringify(shipped);
  }
  return current === shipped;
}

/** Keys in this section whose value differs from the shipped default. */
export function changedNoodleSettingKeys(
  settings: PackageNoodleSettings | undefined,
  section: NoodleSettingsSectionId,
): (keyof PackageNoodleSettings)[] {
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
  settings: PackageNoodleSettings | undefined,
  section: NoodleSettingsSectionId,
): Partial<PackageNoodleSettings> {
  const patch: Record<string, unknown> = {};
  for (const key of changedNoodleSettingKeys(settings, section)) {
    patch[key] = PACKAGE_NOODLE_SETTINGS_DEFAULTS[key];
  }
  return patch as Partial<PackageNoodleSettings>;
}
