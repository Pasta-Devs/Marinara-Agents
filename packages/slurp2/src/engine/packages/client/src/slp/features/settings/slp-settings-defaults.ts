import type { SlurpSettings } from "./slp-settings-contract";

/**
 * Which settings each Settings section owns, for the changed count and the section reset.
 *
 * Keys only. Labels, ranges and controls stay in the JSX that renders them, so this is not a
 * second place to maintain a setting. The regression test asserts that every shipped setting is
 * either here or in `SLURP_SETTINGS_NOT_RESET`, so a new setting cannot silently escape.
 */
export type SlurpResettableSection =
  | "general"
  | "engine"
  | "images"
  | "prompts"
  | "audience"
  | "storylines"
  | "messaging"
  | "wallet"
  | "ads"
  | "autopurge"
  | "stir"
  | "drama"
  | "live";

export const SLURP_SETTINGS_SECTION_KEYS: Record<SlurpResettableSection, readonly (keyof SlurpSettings)[]> = {
  general: [
    "storyRate",
    "professorMariCreatorSource",
    "storyImagesEnabled",
    "storyLifetimeHours",
    "postMaxLength",
    "postShowMoreLength",
    "postsPerDay",
    "postsPerDayCustom",
    "autoPostingScheduleEnabled",
    "autoPostGenerationMode",
    "nightQuiet",
    "postPlanner",
    "lifeMomentRate",
    "storyJobs",
    "teaserRate",
    "pictureReuse",
  ],
  // Everything that crosses into Engine chats resets with the Engine link page it lives on.
  engine: ["carryoverModes", "carryoverHours", "carryoverMaxItems", "enableLorebookContext", "flavourFromAgents"],
  images: [
    "imageWidth",
    "imageHeight",
    "storyImageWidth",
    "storyImageHeight",
    "imageContextMode",
    "imageCaptionPrompt",
    "imageStyleProfileId",
    "enableImageInterpretation",
    "imageGenerationUseAvatarReferences",
    "imageKeepOriginalFiles",
    "imageGenerationIncludeDescriptions",
    "imageAppearanceMode",
    "appearanceProfileMode",
    "autoPostingImagesEnabled",
    "autoCreatorArtworkEnabled",
    "allowGalleryImageAttachments",
    "previewOpensPost",
    "previewWholePictures",
    "blurPictures",
  ],
  prompts: ["generationGuidance", "imageGenerationPrompt", "imagePromptInterpretation", "promptBlocks"],
  audience: [
    "audienceTone",
    "worldActivity",
    "platformScale",
    "allowRandomUsers",
    "fanActivityEnabled",
    "fanActivityRunsPerDay",
    "fanLikesPerRefresh",
    "fanRepliesPerRefresh",
    "creatorRepliesPerDay",
    "fanArchetypeWeights",
    "audienceCharacterLimit",
    "simulationTuning",
    "modelBudget",
  ],
  storylines: [
    "sharedPreseed",
    "sharedWorldEvents",
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
    "storyAutomation",
  ],
  messaging: [
    "messagesAwayRepliesEnabled",
    "messagesPauseFollowUpsUntilReply",
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
    "messagesViewerImageCooldownMinutes",
    "messagesCoolOffMinutes",
    "messagesQuoteAnswerMinutes",
    "messagesFanOpeners",
    "messagesCommissionOpeners",
    "messagesCommissionAsks",
  ],
  wallet: [
    "walletEnabled",
    "walletUnlockCost",
    "walletSubscriptionCost",
    "pricingDynamicCharacters",
    "pricingMaxWeeklyChangePercent",
    "walletStipendFloor",
    "walletDayStartHour",
    "walletPayoutDailyLimit",
    "walletAdReward",
    "walletAdDailyCap",
    "walletEngagementReward",
    "walletEngagementDailyCap",
    "walletCreatorRevenueSharePercent",
  ],
  ads: [
    "inlineAdsEnabled",
    "inlineAdsFrequency",
    "brandDealsPace",
    "inlineAdsSteering",
    "inlineAdsPreferredTags",
    "inlineAdsContentCeiling",
    "inlineAdsTone",
    "inlineAdsEra",
    "inlineAdsWorldContext",
    "inlineAdsImagesEnabled",
  ],
  stir: ["supportDesk"],
  drama: ["polyamory", "drama"],
  live: ["live"],
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
  // Which extensions are on is the shape of the player's Slurp, not a tuning of one section.
  "extAds",
  "extStorylines",
  "extWorld",
  "extStir",
  "extSupportDesk",
  "extEngineLink",
  "extLive",
  // Living world's own sub-switch, the same kind of choice.
  "trendsEnabled",
  // "Pause all" is a switch, not a tuning: resetting a section must never pause or resume Slurp.
  "paused",
  // Who is browsing, not a tuning (#103).
  "viewerPersonaId",
  // Saved presets and reusable instructions are the player's own writing (R1-121).
  "promptPresets",
  "promptInstructions",
  "classicPromptBlocks",
  "fanTypes",
  "platformEvents",
  "creatorCollabs",
  "generationConnectionId",
  "imageContextConnectionId",
  "pageConnectionId",
  "imagePromptConnectionId",
  "inlineAdsImageConnectionId",
  "inlineAdsLorebookId",
  "inlineAdsLorebookRevision",
  "autopurgeNextRunAt",
  "audienceReactionBank",
  "arcLibrary",
  // The player's pack choices, like the libraries they fill (Backstage › Packs).
  "contentPacks",
  "discoveryTags",
  "characterImageInstructions",
  "creatorImageNames",
  "creatorImagePrefixes",
  "onboarding",
  "audienceCharacters",
  "audienceCharacterGroupIds",
  "refreshesPerDay",
  "allowProfessorMari",
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
