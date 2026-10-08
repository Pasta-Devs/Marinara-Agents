import type { SlurpFanType } from "../../../../../shared/src/slp/slp-fan-types.js";
import type { SlurpModelBudget } from "../../../../../shared/src/slp/slp-model-budget.js";
import type { SlpSupportDeskSettings } from "../../../../../shared/src/slp/slp-support-desk.js";
import type { SlpDramaSettings } from "../../../../../shared/src/slp/slp-drama.js";
import type { SlurpPlatformEvent } from "../../../../../shared/src/slp/slp-platform-events.js";
import type { SlurpSimulationTuning } from "../../../../../shared/src/slp/slp-tuning.js";
import type { SlurpPromptPreset } from "./slp-prompt-presets.js";
import type {
  SlurpContentRating,
  SlurpPromptBlockOverride,
  SlurpReusablePromptInstruction,
} from "../../base/state/slp-state-types.js";
import type { SlurpArcType } from "../projects/slp-projects-contract.js";

export type SlurpSettings = {
  inlineAdsEnabled: boolean;
  inlineAdsFrequency: "light" | "standard" | "frequent";
  brandDealsPace: "off" | "rare" | "normal" | "often";
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
  pictureReuse: "off" | "rare" | "regular";
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
  storyAutomation: "manual" | "suggest" | "auto";
  arcLibrary: SlurpArcType[];
  /** Content packs switched on or off (Backstage › Packs). A pack missing here uses its default. */
  contentPacks: Record<string, boolean>;
  discoveryTags: Array<{ tag: string; group: string }>;
  storyImageWidth: number;
  storyImageHeight: number;
  refreshesPerDay: number;
  generationGuidance: string;
  audienceTone: "warm" | "mixed" | "unfiltered";
  worldActivity: "off" | "quiet" | "normal" | "busy";
  platformScale: "intimate" | "normal" | "large";
  postsPerDay: number;
  /** The player set "Posts per day" by hand; otherwise it grows with the active Creators (F). */
  postsPerDayCustom: boolean;
  autoPostingScheduleEnabled: boolean;
  autoPostGenerationMode: "pre_generate" | "on_demand";
  fanActivityEnabled: boolean;
  generationConnectionId: string | null;
  imageContextMode: "auto" | "imagePrompt" | "vision";
  imageContextConnectionId: string | null;
  pageConnectionId: string | null;
  imagePromptConnectionId: string | null;
  imageStyleProfileId: string | null;
  imageGenerationPrompt: string;
  imagePromptInterpretation: string;
  enableImageInterpretation: boolean;
  imageGenerationUseAvatarReferences: boolean;
  imageGenerationIncludeDescriptions: boolean;
  /** How the look reaches the picture prompt: the prompt writer words it, Slurp inserts it, or both. */
  imageAppearanceMode: "writer" | "insert" | "both";
  appearanceProfileMode: "ask" | "high_confidence" | "always";
  autoPostingImagesEnabled: boolean;
  allowRandomUsers: boolean;
  allowProfessorMari: boolean;
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
  /** Per Creator: false turns off "The image model knows this character". */
  creatorImageNames: Record<string, boolean>;
  promptPresets: SlurpPromptPreset[];
  promptBlocks: Record<string, SlurpPromptBlockOverride[]>;
  /** Prompt edits from before Classic generation was removed. Source of the Classic prompt preset. */
  classicPromptBlocks: Record<string, SlurpPromptBlockOverride[]>;
  promptInstructions: SlurpReusablePromptInstruction[];
  professorMariCreatorSource: boolean;
  enableLorebookContext: boolean;
  flavourFromAgents: boolean;
  postPlanner: "classic" | "beats";
  lifeMomentRate: "rarely" | "sometimes" | "often";
  /** One weight per Story job (0-10, 0 = never); `SLURP_STORY_JOB_DEFAULTS` is balanced. */
  storyJobs: { countdown: number; newPost: number; comment: number; poll: number; earlier: number; plain: number };
  sharedPreseed: boolean;
  sharedWorldEvents: boolean;
  enableImagePrompts: boolean;
  maxImagesPerRefresh: number;
  maxGeneratedPostsPerRefresh: number;
  maxLikesPerRefresh: number;
  maxRepliesPerRefresh: number;
  allowGalleryImageAttachments: boolean;
  previewOpensPost: boolean;
  previewWholePictures: boolean;
  /** Every Slurp picture and video stays blurred until it is tapped. */
  blurPictures: boolean;
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
  /** Minutes between two pictures you draw into one chat; 0 = no wait. */
  messagesViewerImageCooldownMinutes: number;
  /** Minutes a Creator stays away after they have had enough; 0 = they do not step away. */
  messagesCoolOffMinutes: number;
  /** Minutes a fan thinks over a quote before answering it; 0 = the next world tick. */
  messagesQuoteAnswerMinutes: number;
  /** The player's own first lines for fan DMs; empty = the built-in ones. */
  messagesFanOpeners: string[];
  /** The player's own first words for commission requests; empty = the built-in ones. */
  messagesCommissionOpeners: string[];
  /** Creator replies to comments in any 24 hours (1–200). */
  creatorRepliesPerDay: number;
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
  /** Settings › Stir: the Slurp Support desk. */
  supportDesk: SlpSupportDeskSettings;
  /** Settings › Stir: a couple may grow to four people. */
  polyamory: boolean;
  /** Settings › Overview › Pause all: no AI calls, no ticks, nothing, until switched back on. */
  paused: boolean;
  /** Backstage › Drama: level, the situations and dramas switched on, situation dials. */
  drama: SlpDramaSettings;
  onboarding: "not_started" | "in_progress" | "completed";
};
export type SlurpSettingsUpdate = Partial<SlurpSettings>;
export type SlurpPromptBlockDefinition = {
  id: string;
  kind: "editable" | "required" | "context";
  optional: boolean;
  defaultText: string;
};
/** The prompt-blocks response. Named rather than inline: the client-hook scanner cannot read a
 * generic argument containing a semicolon, so an inline object type hides the call from it. */
export type SlurpPromptBlocksResponse = {
  /** A layout the builder can load into its draft. Prompt text only. */
  classicPreset: Record<string, SlurpPromptBlockOverride[]>;
  prompts: SlurpPromptDefinition[];
};
export type SlurpPromptBlockPreview = {
  id: string;
  text: string;
};
export type SlurpPromptPreviewResponse = {
  supported: boolean;
  blocks: SlurpPromptBlockPreview[];
  compiledText: string;
};
export type SlurpPromptResultPreviewResponse = {
  title: string | null;
  content: string;
  imagePrompt: string | null;
  compiledPrompt: string;
  scene: {
    wardrobeId?: string | null;
    setting: string;
    action: string;
    expression: string;
    visualDirection: string;
    outfit?: string;
  } | null;
  wardrobeSelection: { selectedId: string | null; requestedId: string | null; fallback: boolean };
  visualBrief: {
    subject: string;
    action: string;
    setting: string;
    company: string;
    clothing: string | null;
    camera: string;
    mood: string | null;
    sexualLevel: "none" | "suggestive" | "nudity" | "explicit";
  } | null;
  imageBrief: string | null;
  providerPrompt: string | null;
};
export type SlurpPromptResultPreviewInput = {
  promptId: "post";
  creatorAccountId: string;
  promptBlocks?: unknown;
  promptInstructions?: SlurpReusablePromptInstruction[];
  access?: "public" | "locked";
  format?: "caption" | "announcement" | "long_form";
  direction?: string;
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
