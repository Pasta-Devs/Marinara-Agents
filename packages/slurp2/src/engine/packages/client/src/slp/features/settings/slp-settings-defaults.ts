import type { SlurpSettings } from "./slp-settings-contract";

/**
 * Which settings each Settings section owns, for the changed count and the section reset.
 *
 * Keys only. Labels, ranges and controls stay in the JSX that renders them, so this is not a
 * second place to maintain a setting. The regression test asserts that every shipped setting is
 * either here or in `SLURP_SETTINGS_NOT_RESET`, so a new setting cannot silently escape.
 */
export type SlurpResettableSection =
  "general" | "images" | "prompts" | "audience" | "arcs" | "messaging" | "wallet" | "ads" | "autopurge";

export const SLURP_SETTINGS_SECTION_KEYS: Record<SlurpResettableSection, readonly (keyof SlurpSettings)[]> = {
  general: [
    "storyRate",
    "professorMariCreatorSource",
    "carryoverModes",
    "carryoverHours",
    "carryoverMaxItems",
    "postMaxLength",
    "postShowMoreLength",
    "postsPerDay",
    "autoPostingScheduleEnabled",
    "autoPostGenerationMode",
    "nightQuiet",
  ],
  images: [
    "imageWidth",
    "imageHeight",
    "storyImagesEnabled",
    "storyLifetimeHours",
    "storyImageWidth",
    "storyImageHeight",
    "imageContextMode",
    "imageGenerationUseAvatarReferences",
    "imageGenerationIncludeDescriptions",
    "autoPostingImagesEnabled",
    "allowGalleryImageAttachments",
  ],
  prompts: [
    "generationGuidance",
    "enableLorebookContext",
    "imageGenerationPrompt",
    "enableImageInterpretation",
    "imagePromptInterpretation",
    "promptPresets",
    "promptBlocks",
  ],
  audience: [
    "audienceTone",
    "worldActivity",
    "platformScale",
    "allowRandomUsers",
    "fanActivityEnabled",
    "fanActivityRunsPerDay",
    "fanLikesPerRefresh",
    "fanRepliesPerRefresh",
    "fanArchetypeWeights",
    "audienceCharacterLimit",
    "simulationTuning",
    "modelBudget",
  ],
  arcs: [
    "projectRate",
    "arcPace",
    "arcAffectsMood",
    "arcFanReactions",
    "arcAutoMode",
    "arcCooldownWeeks",
    "arcSource",
    "arcMaxConcurrentAuto",
    "arcDirectorMode",
    "arcPollHours",
    "arcStatEffects",
    "arcCrossovers",
  ],
  messaging: [
    "messagesAwayRepliesEnabled",
    "messagesReplyBubbleLimit",
    "messagesDefaultDmPolicy",
    "messagesDefaultRequestFee",
    "messagesDefaultPpvPrice",
    "messagesUnscheduledAlwaysReachable",
    "messagesHighRapportDelayMinMinutes",
    "messagesHighRapportDelayMaxMinutes",
    "messagesMediumRapportDelayMinMinutes",
    "messagesMediumRapportDelayMaxMinutes",
    "messagesUnknownReturnDelayMinutes",
    "messagesMaxReplyDelayMinutes",
    "messagesRecentPostAwayMinMinutes",
    "messagesRecentPostAwayMaxMinutes",
    "messagesStalePostAwayMinMinutes",
    "messagesStalePostAwayMaxMinutes",
  ],
  wallet: [
    "teaserRate",
    "walletEnabled",
    "walletUnlockCost",
    "walletSubscriptionCost",
    "pricingDynamicCharacters",
    "pricingMaxWeeklyChangePercent",
    "walletStipendFloor",
    "walletDayStartHour",
    "walletAdReward",
    "walletAdDailyCap",
    "walletEngagementReward",
    "walletEngagementDailyCap",
    "walletCreatorRevenueSharePercent",
  ],
  ads: [
    "inlineAdsEnabled",
    "inlineAdsFrequency",
    "inlineAdsSteering",
    "inlineAdsPreferredTags",
    "inlineAdsContentCeiling",
    "inlineAdsTone",
    "inlineAdsEra",
    "inlineAdsWorldContext",
    "inlineAdsImagesEnabled",
  ],
  autopurge: [
    "autopurgeEnabled",
    "autopurgeRetentionValue",
    "autopurgeRetentionUnit",
    "autopurgeKeepPosts",
    "autopurgeIncludeMessageMedia",
  ],
};

/**
 * Never counted and never reset. Connections are setup, not preference: they default to nothing,
 * and resetting a section must not disconnect it. The rest is the player's own content (fan types,
 * reaction banks, arc library, tags, prompt presets, per-character choices), runtime state, or has
 * no control in Settings.
 */
export const SLURP_SETTINGS_NOT_RESET: readonly (keyof SlurpSettings)[] = [
  "fanTypes",
  "platformEvents",
  "creatorCollabs",
  "generationConnectionId",
  "imageGenerationConnectionId",
  "imageContextConnectionId",
  "inlineAdsImageConnectionId",
  "inlineAdsLorebookId",
  "inlineAdsLorebookRevision",
  "autopurgeNextRunAt",
  "audienceReactionBank",
  "arcLibrary",
  "discoveryTags",
  "characterImageInstructions",
  "onboarding",
  "invitedCharacterGroupIds",
  "audienceCharacters",
  "audienceCharacterGroupIds",
  "refreshesPerDay",
  "allowProfessorMari",
  "participantSelectionMode",
  "participantMin",
  "participantMax",
  "enableEnhancedTimelineWriting",
  "includeCharacterSchedules",
  "enableImagePrompts",
  "maxImagesPerRefresh",
  "maxGeneratedPostsPerRefresh",
  "maxLikesPerRefresh",
  "maxRepliesPerRefresh",
];

export function isSlurpResettableSection(section: string): section is SlurpResettableSection {
  return Object.hasOwn(SLURP_SETTINGS_SECTION_KEYS, section);
}

function sameValue(current: unknown, shipped: unknown): boolean {
  // Arrays and records need a value comparison; the rest are primitives.
  return typeof current === "object" && current !== null
    ? JSON.stringify(current) === JSON.stringify(shipped)
    : current === shipped;
}

/** Keys in this section whose value differs from the shipped default. */
export function changedSlurpSettingKeys(
  settings: SlurpSettings,
  defaults: SlurpSettings,
  section: SlurpResettableSection,
): (keyof SlurpSettings)[] {
  return SLURP_SETTINGS_SECTION_KEYS[section].filter((key) => !sameValue(settings[key], defaults[key]));
}

/** The patch that returns one section to its defaults. Keys that already match are left out. */
export function slurpSettingsResetPatch(
  settings: SlurpSettings,
  defaults: SlurpSettings,
  section: SlurpResettableSection,
): Partial<SlurpSettings> {
  return Object.fromEntries(
    changedSlurpSettingKeys(settings, defaults, section).map((key) => [key, defaults[key]]),
  ) as Partial<SlurpSettings>;
}
