import type { SlurpSettings } from "../../hooks/use-slurp";

export const SLURP_BACKSTAGE_SECTIONS = ["overview", "creators", "world", "automation", "maintenance"] as const;
export type SlurpBackstageSection = (typeof SLURP_BACKSTAGE_SECTIONS)[number];

export const SLURP_BACKSTAGE_TARGETS = [
  "overview",
  "creators",
  "improve",
  "tags",
  "arcs",
  "messaging",
  "audience",
  "ads",
  "wallet",
  "general",
  "images",
  "autopurge",
  "advanced",
] as const;
export type SlurpBackstageTarget = (typeof SLURP_BACKSTAGE_TARGETS)[number];

export const SLURP_BACKSTAGE_TARGETS_BY_SECTION: Record<SlurpBackstageSection, readonly SlurpBackstageTarget[]> = {
  overview: ["overview"],
  creators: ["creators", "improve"],
  world: ["tags", "arcs", "audience", "messaging", "ads", "wallet"],
  automation: ["general", "images"],
  maintenance: ["autopurge", "advanced"],
};

export const SLURP_BACKSTAGE_DEFAULT_TARGET: Record<SlurpBackstageSection, SlurpBackstageTarget> = {
  overview: "overview",
  creators: "creators",
  world: "tags",
  automation: "general",
  maintenance: "autopurge",
};

export const SLURP_BACKSTAGE_SECTION_LABELS: Record<SlurpBackstageSection, string> = {
  overview: "Overview",
  creators: "Creators",
  world: "Slurp world",
  automation: "Automation",
  maintenance: "Maintenance",
};

export const SLURP_BACKSTAGE_TARGET_LABELS: Record<SlurpBackstageTarget, string> = {
  overview: "Overview",
  creators: "Creator management",
  improve: "Improve with AI",
  tags: "Discovery",
  arcs: "Stories",
  messaging: "Messaging rules",
  audience: "Audience",
  ads: "Ads",
  wallet: "Coins and access",
  general: "Publishing",
  images: "Image generation",
  autopurge: "Storage and cleanup",
  advanced: "Backup and data",
};

export function destinationForTarget(target: SlurpBackstageTarget): SlurpBackstageSection {
  return (
    SLURP_BACKSTAGE_SECTIONS.find((section) => SLURP_BACKSTAGE_TARGETS_BY_SECTION[section].includes(target)) ??
    "overview"
  );
}

export const SLURP_LEGACY_SETTINGS_DESTINATION = {
  overview: { section: "overview", target: "overview" },
  creators: { section: "creators", target: "creators" },
  tags: { section: "world", target: "tags" },
  arcs: { section: "world", target: "arcs" },
  messaging: { section: "world", target: "messaging" },
  audience: { section: "world", target: "audience" },
  ads: { section: "world", target: "ads" },
  wallet: { section: "world", target: "wallet" },
  general: { section: "automation", target: "general" },
  images: { section: "automation", target: "images" },
  autopurge: { section: "maintenance", target: "autopurge" },
  advanced: { section: "maintenance", target: "advanced" },
} as const satisfies Record<string, { section: SlurpBackstageSection; target: SlurpBackstageTarget }>;

export type SlurpBackstageScope = "all-slurp" | "this-viewer" | "new-creators" | "creator";
export type SlurpBackstagePlacement = {
  section: SlurpBackstageSection;
  target: SlurpBackstageTarget;
  scope: SlurpBackstageScope;
  searchTerms: readonly string[];
};

const place = (
  section: SlurpBackstageSection,
  target: SlurpBackstageTarget,
  scope: SlurpBackstageScope,
  ...searchTerms: string[]
): SlurpBackstagePlacement => ({ section, target, scope, searchTerms });
const world = (target: SlurpBackstageTarget, ...terms: string[]) => place("world", target, "all-slurp", ...terms);
const automation = (target: SlurpBackstageTarget, ...terms: string[]) =>
  place("automation", target, "all-slurp", ...terms);
const maintenance = (...terms: string[]) => place("maintenance", "autopurge", "all-slurp", ...terms);

/** One searchable, canonical Backstage home for every persisted setting. */
export const SLURP_BACKSTAGE_SETTING_PLACEMENT: Record<keyof SlurpSettings, SlurpBackstagePlacement> = {
  inlineAdsEnabled: world("ads", "ads", "promotions", "feed"),
  inlineAdsFrequency: world("ads", "ad frequency", "promotions"),
  inlineAdsSteering: world("ads", "personalized ads", "random ads"),
  inlineAdsPreferredTags: world("ads", "ad tags", "interests"),
  inlineAdsContentCeiling: world("ads", "ad rating", "content ceiling"),
  inlineAdsTone: world("ads", "ad voice", "tone"),
  inlineAdsEra: world("ads", "ad era", "style"),
  inlineAdsWorldContext: world("ads", "ad world", "context"),
  inlineAdsImagesEnabled: world("ads", "ad images", "pictures"),
  inlineAdsLorebookId: world("ads", "ad lorebook"),
  inlineAdsLorebookRevision: world("ads", "ad lorebook revision"),
  walletEnabled: world("wallet", "coins", "wallet", "economy"),
  walletUnlockCost: world("wallet", "post price", "unlock cost"),
  walletSubscriptionCost: world("wallet", "subscription price"),
  pricingDynamicCharacters: world("wallet", "dynamic pricing"),
  pricingMaxWeeklyChangePercent: world("wallet", "weekly price change"),
  walletStipendFloor: world("wallet", "stipend", "balance floor"),
  walletDayStartHour: world("wallet", "wallet day", "reset hour"),
  walletAdReward: world("wallet", "ad reward"),
  walletAdDailyCap: world("wallet", "daily ad cap"),
  walletEngagementReward: world("wallet", "engagement reward"),
  walletEngagementDailyCap: world("wallet", "engagement cap"),
  walletCreatorRevenueSharePercent: world("wallet", "creator revenue share"),
  imageWidth: automation("images", "post image width", "resolution"),
  imageHeight: automation("images", "post image height", "resolution"),
  storyRate: automation("general", "stories", "story rate"),
  projectRate: automation("general", "projects", "project rate"),
  arcPace: automation("general", "arc pace", "story speed"),
  arcAffectsMood: automation("general", "arc mood"),
  arcFanReactions: automation("general", "arc fan reactions"),
  arcAutoMode: automation("general", "automatic arcs", "story suggestions"),
  arcCooldownWeeks: automation("general", "arc cooldown"),
  arcSource: automation("general", "arc source", "generated stories"),
  arcMaxConcurrentAuto: automation("general", "concurrent arcs"),
  arcDirectorMode: automation("general", "arc director"),
  arcPollHours: automation("general", "arc polling"),
  arcStatEffects: automation("general", "arc stat effects"),
  arcCrossovers: automation("general", "arc crossovers"),
  arcLibrary: world("arcs", "arc library", "stories"),
  discoveryTags: world("tags", "tags", "discovery", "categories"),
  storyImageWidth: automation("images", "story image width", "resolution"),
  storyImageHeight: automation("images", "story image height", "resolution"),
  refreshesPerDay: automation("general", "refreshes per day", "generation"),
  generationGuidance: automation("general", "writing guidance", "prompt"),
  audienceTone: world("audience", "audience tone", "comments"),
  worldActivity: world("audience", "world activity", "crowd activity"),
  platformScale: world("audience", "platform scale", "audience size"),
  postsPerDay: automation("general", "posts per day", "publishing pace"),
  autoPostingScheduleEnabled: automation("general", "automatic publishing", "schedule"),
  autoPostGenerationMode: automation("general", "prepare posts", "on demand"),
  fanActivityEnabled: automation("general", "fan activity", "background audience"),
  generationConnectionId: automation("general", "text connection", "model"),
  imageContextMode: automation("images", "image context", "vision"),
  imageContextConnectionId: automation("images", "vision connection", "image description"),
  imageGenerationConnectionId: automation("images", "image connection", "image model"),
  imageGenerationPrompt: automation("images", "image guidance", "image prompt"),
  imagePromptInterpretation: automation("images", "image prompt interpretation"),
  enableImageInterpretation: automation("images", "interpret image prompts"),
  imageGenerationUseAvatarReferences: automation("images", "avatar references"),
  imageGenerationIncludeDescriptions: automation("images", "image descriptions"),
  autoPostingImagesEnabled: automation("images", "automatic post images"),
  allowRandomUsers: world("audience", "random users", "ambient fans"),
  allowProfessorMari: automation("general", "Professor Mari", "participants"),
  participantSelectionMode: automation("general", "participants", "creator selection"),
  participantMin: automation("general", "minimum participants"),
  participantMax: automation("general", "maximum participants"),
  invitedCharacterGroupIds: place("creators", "creators", "new-creators", "invited groups", "creator groups"),
  carryoverModes: automation("general", "carryover", "Engine chats"),
  carryoverHours: automation("general", "carryover hours"),
  carryoverMaxItems: automation("general", "carryover limit"),
  characterImageInstructions: place("creators", "creators", "creator", "character image instructions"),
  promptPresets: automation("general", "prompt presets", "writing presets"),
  professorMariCreatorSource: automation("general", "Professor Mari creator"),
  enableEnhancedTimelineWriting: automation("general", "enhanced timeline writing"),
  includeCharacterSchedules: automation("general", "character schedules"),
  enableLorebookContext: automation("general", "lorebook context"),
  enableImagePrompts: automation("images", "image prompts"),
  maxImagesPerRefresh: automation("images", "images per refresh"),
  maxGeneratedPostsPerRefresh: automation("general", "posts per refresh"),
  maxLikesPerRefresh: automation("general", "likes per refresh"),
  maxRepliesPerRefresh: automation("general", "replies per refresh"),
  allowGalleryImageAttachments: automation("images", "gallery attachments"),
  fanActivityRunsPerDay: automation("general", "audience runs per day"),
  audienceReactionBank: world("audience", "reaction bank", "fan replies"),
  fanLikesPerRefresh: automation("general", "fan likes per refresh"),
  fanRepliesPerRefresh: automation("general", "fan replies per refresh"),
  fanArchetypeWeights: world("audience", "fan type weights", "audience mix"),
  fanTypes: world("audience", "fan types", "audience personas"),
  messagesAwayRepliesEnabled: automation("general", "away replies", "automatic messages"),
  messagesReplyBubbleLimit: world("messaging", "reply bubbles", "message length"),
  messagesDefaultDmPolicy: world("messaging", "DM policy", "message access"),
  messagesDefaultRequestFee: world("messaging", "message request fee"),
  messagesDefaultPpvPrice: world("messaging", "message image price", "PPV"),
  messagesUnscheduledAlwaysReachable: automation("general", "always reachable", "message schedule"),
  messagesHighRapportDelayMinMinutes: automation("general", "close fan reply minimum"),
  messagesHighRapportDelayMaxMinutes: automation("general", "close fan reply maximum"),
  messagesMediumRapportDelayMinMinutes: automation("general", "regular fan reply minimum"),
  messagesMediumRapportDelayMaxMinutes: automation("general", "regular fan reply maximum"),
  messagesUnknownReturnDelayMinutes: automation("general", "unknown return delay"),
  messagesMaxReplyDelayMinutes: automation("general", "maximum reply delay"),
  messagesRecentPostAwayMinMinutes: automation("general", "recent post away minimum"),
  messagesRecentPostAwayMaxMinutes: automation("general", "recent post away maximum"),
  messagesStalePostAwayMinMinutes: automation("general", "stale post away minimum"),
  messagesStalePostAwayMaxMinutes: automation("general", "stale post away maximum"),
  autopurgeEnabled: maintenance("automatic cleanup", "autopurge"),
  autopurgeRetentionValue: maintenance("retention", "keep media"),
  autopurgeRetentionUnit: maintenance("retention unit"),
  autopurgeKeepPosts: maintenance("keep posts", "media only"),
  autopurgeIncludeMessageMedia: maintenance("message media cleanup"),
  autopurgeNextRunAt: maintenance("next cleanup"),
  nightQuiet: automation("general", "quiet hours", "night"),
  simulationTuning: automation("general", "simulation tuning", "fine tune audience"),
  modelBudget: automation("general", "AI budget", "model calls"),
  onboarding: place("creators", "creators", "new-creators", "setup", "onboarding"),
};

export function isSlurpBackstageSection(value: unknown): value is SlurpBackstageSection {
  return typeof value === "string" && SLURP_BACKSTAGE_SECTIONS.includes(value as SlurpBackstageSection);
}

export function isSlurpBackstageTarget(value: unknown): value is SlurpBackstageTarget {
  return typeof value === "string" && SLURP_BACKSTAGE_TARGETS.includes(value as SlurpBackstageTarget);
}

export function targetBelongsToSection(section: SlurpBackstageSection, target: SlurpBackstageTarget): boolean {
  return SLURP_BACKSTAGE_TARGETS_BY_SECTION[section].includes(target);
}
