import type { SlurpFanType } from "../../../../../shared/src/slp/slp-fan-types.js";
import type { SlurpModelBudget } from "../../../../../shared/src/slp/slp-model-budget.js";
import type { SlurpPlatformEvent } from "../../../../../shared/src/slp/slp-platform-events.js";
import type { SlurpSimulationTuning } from "../../../../../shared/src/slp/slp-tuning.js";
import type { SlurpPromptPreset } from "./slp-prompt-presets.js";
import type { SlurpContentRating, SlurpPromptBlockOverride } from "../../base/state/slp-state-types.js";
import type { SlurpArcType } from "../projects/slp-projects-contract.js";

export type SlurpSettings = {
  inlineAdsEnabled: boolean;
  inlineAdsFrequency: "light" | "standard" | "frequent";
  inlineAdsSteering: "balanced" | "personalized" | "random";
  inlineAdsPreferredTags: string[];
  inlineAdsContentCeiling: SlurpContentRating;
  inlineAdsTone: "corporate" | "scammy" | "local" | "luxury" | "unhinged";
  inlineAdsEra: "present" | "nineties" | "cyberpunk" | "retrofuture";
  inlineAdsWorldContext: string;
  inlineAdsImagesEnabled: boolean;
  inlineAdsImageConnectionId: string | null;
  inlineAdsLorebookId: string | null;
  inlineAdsLorebookRevision: string | null;
  walletEnabled: boolean;
  walletUnlockCost: number;
  walletSubscriptionCost: number;
  pricingDynamicCharacters: boolean;
  pricingMaxWeeklyChangePercent: number;
  walletStipendFloor: number;
  walletDayStartHour: number;
  walletAdReward: number;
  walletAdDailyCap: number;
  walletEngagementReward: number;
  walletEngagementDailyCap: number;
  walletCreatorRevenueSharePercent: number;
  imageWidth: number;
  imageHeight: number;
  storyRate: "off" | "rare" | "regular" | "often";
  storyImagesEnabled: boolean;
  storyLifetimeHours: number;
  teaserRate: "off" | "rare" | "regular" | "often";
  projectRate: "off" | "rare" | "regular" | "often";
  arcPace: "slow" | "normal" | "fast";
  arcAffectsMood: boolean;
  arcFanReactions: boolean;
  arcAutoMode: "off" | "suggest" | "auto";
  arcCooldownWeeks: number;
  arcSource: "library" | "generated" | "mixed";
  arcMaxConcurrentAuto: number;
  arcDirectorMode: boolean;
  arcPollHours: number;
  arcStatEffects: "off" | "small" | "big";
  arcCrossovers: boolean;
  arcLibrary: SlurpArcType[];
  discoveryTags: Array<{ tag: string; group: string }>;
  storyImageWidth: number;
  storyImageHeight: number;
  refreshesPerDay: number;
  generationGuidance: string;
  audienceTone: "warm" | "mixed" | "unfiltered";
  worldActivity: "off" | "quiet" | "normal" | "busy";
  platformScale: "intimate" | "normal" | "large";
  postsPerDay: number;
  autoPostingScheduleEnabled: boolean;
  autoPostGenerationMode: "pre_generate" | "on_demand";
  fanActivityEnabled: boolean;
  generationConnectionId: string | null;
  imageContextMode: "auto" | "imagePrompt" | "vision";
  imageContextConnectionId: string | null;
  imageGenerationConnectionId: string | null;
  imageGenerationPrompt: string;
  imagePromptInterpretation: string;
  enableImageInterpretation: boolean;
  imageGenerationUseAvatarReferences: boolean;
  imageGenerationIncludeDescriptions: boolean;
  autoPostingImagesEnabled: boolean;
  allowRandomUsers: boolean;
  allowProfessorMari: boolean;
  participantSelectionMode: "all" | "random" | "exact";
  participantMin: number;
  participantMax: number;
  invitedCharacterGroupIds: string[];
  /** Characters the user put in the audience. Value is a Fan Type id, or true to derive one. */
  audienceCharacters: Record<string, string | boolean>;
  /** Character groups whose members join the audience. Per-character entries win. */
  audienceCharacterGroupIds: string[];
  /** Most character fans that may act at once. Each one costs prompt space in every fan run. */
  audienceCharacterLimit: number;
  carryoverModes: Array<"conversation" | "roleplay" | "game">;
  carryoverHours: number;
  carryoverMaxItems: number;
  postMaxLength: number;
  postShowMoreLength: number;
  characterImageInstructions: Record<string, boolean>;
  promptPresets: SlurpPromptPreset[];
  promptBlocks: Record<string, SlurpPromptBlockOverride[]>;
  professorMariCreatorSource: boolean;
  enableEnhancedTimelineWriting: boolean;
  includeCharacterSchedules: boolean;
  enableLorebookContext: boolean;
  enableImagePrompts: boolean;
  maxImagesPerRefresh: number;
  maxGeneratedPostsPerRefresh: number;
  maxLikesPerRefresh: number;
  maxRepliesPerRefresh: number;
  allowGalleryImageAttachments: boolean;
  fanActivityRunsPerDay: number;
  audienceReactionBank: { shared: string[]; byType: Record<string, string[]> };
  fanLikesPerRefresh: number;
  fanRepliesPerRefresh: number;
  fanArchetypeWeights: Record<string, number>;
  /** Editable audience personas and their numeric behavior. */
  fanTypes: SlurpFanType[];
  platformEvents: SlurpPlatformEvent[];
  creatorCollabs: { creatorIds: [string, string]; content: string }[];
  /** Creators answer while you are away. Off leaves the background reply loop asleep. */
  messagesAwayRepliesEnabled: boolean;
  messagesReplyBubbleLimit: number;
  messagesDefaultDmPolicy: "open" | "subscribers" | "paid" | "closed";
  messagesDefaultRequestFee: number;
  messagesDefaultPpvPrice: number;
  /** Reply timing, in minutes. */
  messagesUnscheduledAlwaysReachable: boolean;
  messagesHighRapportDelayMinMinutes: number;
  messagesHighRapportDelayMaxMinutes: number;
  messagesMediumRapportDelayMinMinutes: number;
  messagesMediumRapportDelayMaxMinutes: number;
  messagesUnknownReturnDelayMinutes: number;
  messagesMaxReplyDelayMinutes: number;
  messagesRecentPostAwayMinMinutes: number;
  messagesRecentPostAwayMaxMinutes: number;
  messagesStalePostAwayMinMinutes: number;
  messagesStalePostAwayMaxMinutes: number;
  autopurgeEnabled: boolean;
  autopurgeRetentionValue: number;
  autopurgeRetentionUnit: "days" | "weeks" | "months";
  autopurgeKeepPosts: boolean;
  autopurgeIncludeMessageMedia: boolean;
  autopurgeNextRunAt: string | null;
  nightQuiet: boolean;
  /** Every number the audience simulation runs on. The server fills anything missing from Realistic. */
  simulationTuning: SlurpSimulationTuning;
  /** When model-written audience text may run and how many calls it may spend. */
  modelBudget: SlurpModelBudget;
  onboarding: "not_started" | "in_progress" | "completed";
};
export type SlurpSettingsUpdate = Partial<SlurpSettings>;
export type SlurpPromptBlockDefinition = {
  id: string;
  kind: "editable" | "required" | "context";
  optional: boolean;
  defaultText: string;
};
export type SlurpPromptDefinition = {
  id: string;
  group: "writing" | "messages" | "images" | "profiles" | "world" | "audience";
  blocks: SlurpPromptBlockDefinition[];
};

// The settings read hook is the only part of this feature other features consume. Exposing it here
// keeps Discovery (and any later reader) on the contract instead of reaching into the hook file.
export { useSlurpSettings } from "./slp-settings-hooks.js";

// The Projects arc library resets an arc type back to its shipped default.
export { useResetSlurpArcType } from "./slp-settings-hooks.js";

// Messages and Onboarding write settings directly from their own panels.
export { useUpdateSlurpSettings } from "./slp-settings-hooks.js";
