import type { SlurpSettings } from "../settings/slp-settings-contract";
import {
  SLP_EXTENSION_KEYS,
  slpExtensionOn,
  type SlpExtensionId,
} from "../../../../../shared/src/slp/slp-extensions.js";
import {
  destinationForTarget,
  type SlpBackstageSection,
  type SlpBackstageTarget,
} from "../../base/navigation/slp-backstage-target";

export type SlpBackstageScope = "all-slurp" | "this-viewer" | "new-creators" | "creator";
export type SlpBackstagePlacement = {
  section: SlpBackstageSection;
  target: SlpBackstageTarget;
  scope: SlpBackstageScope;
  searchTerms: readonly string[];
  /** Runtime or setup state with no Backstage control; hidden from search and exempt from anchors. */
  internal?: true;
};

// The page decides the section (`destinationForTarget`), so a page that moves needs no edit here.
const place = (
  target: SlpBackstageTarget,
  scope: SlpBackstageScope,
  ...searchTerms: string[]
): SlpBackstagePlacement => ({
  section: destinationForTarget(target),
  target,
  scope,
  searchTerms,
});
const slurp = (target: SlpBackstageTarget, ...terms: string[]) => place(target, "all-slurp", ...terms);
const internal = (placement: SlpBackstagePlacement): SlpBackstagePlacement => ({ ...placement, internal: true });
const prompts = (...terms: string[]) => place("prompts", "all-slurp", ...terms);
const maintenance = (...terms: string[]) => place("autopurge", "all-slurp", ...terms);

/**
 * Pages whose controls are not `SlurpSettings` keys (they have their own stores), so the settings
 * table above cannot make them searchable. Search lists them as a page, with no anchor to scroll to.
 */
export const SLP_BACKSTAGE_PAGE_PLACEMENT: Record<string, SlpBackstagePlacement> = {
  spice: slurp("spice", "spice", "spicy", "adult", "heat", "level", "tastes", "language"),
};

/** One searchable, canonical Backstage home for every persisted setting. */
export const SLP_BACKSTAGE_SETTING_PLACEMENT: Record<keyof SlurpSettings, SlpBackstagePlacement> = {
  extAds: slurp("ads", "brands", "ads", "extension", "brand deals"),
  extStorylines: slurp("storylines", "storylines", "extension", "arcs", "drama", "couples", "collabs"),
  extWorld: slurp("events", "living world", "extension", "events", "trends"),
  extStir: slurp("stir", "stir", "extension", "levers", "planner"),
  extSupportDesk: slurp("stir", "support desk", "extension", "tickets", "trust"),
  extEngineLink: internal(slurp("engine", "engine link")),
  extLive: slurp("live", "live shows", "extension", "go live", "cam", "stream"),
  live: slurp("live", "live shows", "cam show", "private show", "live pictures", "tips"),
  inlineAdsEnabled: slurp("ads", "ads", "promotions", "feed"),
  inlineAdsFrequency: slurp("ads", "ad frequency", "promotions"),
  brandDealsPace: slurp("ads", "brand deals", "sponsored posts", "paid partnership"),
  inlineAdsSteering: slurp("ads", "personalized ads", "random ads"),
  inlineAdsPreferredTags: slurp("ads", "ad tags", "interests"),
  inlineAdsContentCeiling: slurp("ads", "ad rating", "content ceiling"),
  inlineAdsTone: slurp("ads", "ad voice", "tone"),
  inlineAdsEra: slurp("ads", "ad era", "style"),
  inlineAdsWorldContext: slurp("ads", "ad world", "context"),
  inlineAdsImagesEnabled: slurp("ads", "ad images", "pictures"),
  inlineAdsImageConnectionId: slurp("ads", "ad image connection", "image model"),
  inlineAdsLorebookId: slurp("ads", "ad lorebook"),
  inlineAdsLorebookRevision: internal(slurp("ads", "ad lorebook revision")),
  walletEnabled: slurp("wallet", "coins", "wallet", "economy"),
  walletUnlockCost: slurp("wallet", "post price", "unlock cost"),
  walletSubscriptionCost: slurp("wallet", "subscription price"),
  pricingDynamicCharacters: slurp("wallet", "dynamic pricing"),
  pricingMaxWeeklyChangePercent: slurp("wallet", "weekly price change"),
  walletStipendFloor: slurp("wallet", "stipend", "balance floor"),
  walletDayStartHour: slurp("wallet", "wallet day", "reset hour"),
  walletPayoutDailyLimit: slurp("wallet", "collect", "payout", "redeem", "cooldown", "daily limit"),
  walletAdReward: slurp("wallet", "ad reward"),
  walletAdDailyCap: slurp("wallet", "daily ad cap"),
  walletEngagementReward: slurp("wallet", "engagement reward"),
  walletEngagementDailyCap: slurp("wallet", "engagement cap"),
  walletCreatorRevenueSharePercent: slurp("wallet", "creator revenue share"),
  imageWidth: slurp("images", "post image width", "resolution"),
  imageHeight: slurp("images", "post image height", "resolution"),
  storyRate: slurp("general", "story posts", "story rate"),
  storyImagesEnabled: slurp("general", "story posts", "image stories"),
  storyLifetimeHours: slurp("general", "story lifetime", "moments"),
  teaserRate: slurp("general", "teaser", "free posts", "fish for subscribers"),
  pictureReuse: slurp("general", "picture reuse", "repost", "old photo", "recycle"),
  projectRate: slurp("storylines", "storyline", "plans", "plan rate"),
  arcPace: slurp("storylines", "storyline", "plan pace", "story speed"),
  arcAffectsMood: slurp("storylines", "storyline", "plan mood"),
  arcFanReactions: slurp("storylines", "storyline", "plan fan reactions"),
  arcAutoMode: slurp("storylines", "storyline", "automatic plans", "story suggestions"),
  arcCooldownWeeks: slurp("storylines", "storyline", "plan cooldown"),
  arcSource: slurp("storylines", "storyline", "plan source", "generated stories"),
  arcMaxConcurrentAuto: slurp("storylines", "storyline", "concurrent plans"),
  arcDirectorMode: slurp("storylines", "storyline", "plan director"),
  arcPollHours: slurp("storylines", "storyline", "plan polling"),
  arcStatEffects: slurp("storylines", "storyline", "plan stat effects"),
  arcCrossovers: slurp("storylines", "storyline", "plan crossovers"),
  arcLibrary: slurp("arcs", "plan templates", "stories"),
  contentPacks: slurp("packs", "content packs", "slurpcon", "awards", "birthday", "pride", "exam week", "spicy firsts"),
  discoveryTags: slurp("tags", "tags", "discovery", "categories"),
  storyImageWidth: slurp("images", "story image width", "resolution"),
  storyImageHeight: slurp("images", "story image height", "resolution"),
  refreshesPerDay: internal(slurp("general", "refreshes per day", "generation")),
  generationGuidance: prompts("writing guidance", "spice", "tone"),
  audienceTone: slurp("audience", "audience tone", "comments"),
  worldActivity: slurp("audience", "world activity", "crowd activity"),
  platformScale: slurp("audience", "platform scale", "audience size"),
  postsPerDay: slurp("general", "posts per day", "publishing pace"),
  autoPostingScheduleEnabled: slurp("general", "automatic publishing", "schedule"),
  autoPostGenerationMode: slurp("general", "prepare posts", "on demand"),
  fanActivityEnabled: slurp("audience", "fan activity", "background audience"),
  generationConnectionId: place("connections", "all-slurp", "text connection", "model"),
  imageContextMode: slurp("images", "image context", "vision"),
  imageContextConnectionId: slurp("images", "vision connection", "image description"),
  imageCaptionPrompt: slurp("images", "caption instructions", "captioning prompt", "image description"),
  pageConnectionId: place("connections", "all-slurp", "creator pages connection", "page builder"),
  imageStyleProfileId: slurp("images", "image style", "style profile"),
  imageGenerationPrompt: prompts("image instructions", "image prompt"),
  imagePromptInterpretation: prompts("image prompt interpretation", "image prompt style", "Danbooru"),
  enableImageInterpretation: slurp("images", "enhance image prompts", "interpret image prompts"),
  imagePromptConnectionId: slurp("images", "prompt model", "enhance image prompts"),
  imageGenerationUseAvatarReferences: slurp("images", "avatar references"),
  imageKeepOriginalFiles: slurp("images", "original files"),
  appearanceProfileMode: slurp("images", "appearance profiles", "auto accept appearance"),
  imageGenerationIncludeDescriptions: slurp("images", "image descriptions"),
  imageAppearanceMode: slurp("images", "look in prompts", "appearance twice", "insert appearance"),
  autoPostingImagesEnabled: slurp("images", "automatic post images"),
  autoCreatorArtworkEnabled: slurp("images", "automatic avatars", "automatic banners", "creator artwork"),
  allowRandomUsers: slurp("audience", "random users", "ambient fans"),
  allowProfessorMari: internal(slurp("general", "Professor Mari", "participants")),
  audienceCharacters: slurp("audience", "audience characters", "invited characters", "characters as fans"),
  audienceCharacterGroupIds: slurp("audience", "audience character groups", "invited character groups"),
  audienceCharacterLimit: slurp("audience", "audience character limit", "invited character limit"),
  carryoverModes: place("engine", "all-slurp", "carryover", "Engine chats"),
  carryoverHours: place("engine", "all-slurp", "carryover hours"),
  carryoverMaxItems: place("engine", "all-slurp", "carryover limit"),
  postMaxLength: slurp("general", "post length", "maximum post length"),
  postShowMoreLength: slurp("general", "show more", "post preview length"),
  characterImageInstructions: place("creators", "creator", "character image instructions"),
  creatorImageNames: place("creators", "creator", "image model knows", "character name in pictures"),
  creatorImagePrefixes: place("creators", "creator", "image prompt prefix", "always in pictures"),
  creatorCollabs: place("creators", "creator", "collabs", "collab partners", "crossover"),
  promptPresets: prompts("prompt presets", "writing presets"),
  promptInstructions: prompts("saved instructions", "reusable instructions"),
  classicPromptBlocks: internal(prompts("classic prompt preset", "classic prompts")),
  promptBlocks: prompts("prompt block builder", "prompt order", "prompt blocks"),
  professorMariCreatorSource: slurp("general", "Professor Mari creator", "new creators"),
  enableLorebookContext: place("engine", "all-slurp", "lorebook context"),
  flavourFromAgents: place(
    "engine",
    "all-slurp",
    "other agents",
    "long-term memory",
    "character tracker",
    "world state",
    "persona stats",
  ),
  memoryRecall: place("engine", "all-slurp", "long-term memory", "whole memories", "memory parts"),
  postPlanner: slurp("general", "post ideas", "post planner", "beats", "subjects"),
  lifeMomentRate: slurp("general", "daily life", "life moments", "everyday"),
  storyJobs: slurp("general", "story jobs", "what stories do", "countdown", "poll", "story mix"),
  sharedPreseed: slurp("storylines", "shared ideas", "world tick", "niche"),
  sharedWorldEvents: slurp("storylines", "slurp-wide events", "platform events"),
  enableImagePrompts: internal(slurp("images", "image prompts")),
  maxImagesPerRefresh: internal(slurp("images", "images per refresh")),
  maxGeneratedPostsPerRefresh: internal(slurp("general", "posts per refresh")),
  maxLikesPerRefresh: internal(slurp("general", "likes per refresh")),
  maxRepliesPerRefresh: internal(slurp("general", "replies per refresh")),
  allowGalleryImageAttachments: slurp("images", "gallery attachments"),
  previewOpensPost: slurp("images", "tap preview", "open post", "cropped"),
  previewWholePictures: slurp("images", "whole pictures", "crop", "cropped", "fit"),
  blurPictures: slurp("images", "blur pictures", "safe for work", "sfw", "hide images", "work"),
  fanActivityRunsPerDay: slurp("audience", "audience runs per day"),
  audienceReactionBank: slurp("audience", "reaction bank", "fan replies"),
  fanLikesPerRefresh: slurp("audience", "fan likes per refresh"),
  fanRepliesPerRefresh: slurp("audience", "fan replies per refresh"),
  creatorRepliesPerDay: slurp("audience", "creator replies per day", "comment reply limit", "cooldown"),
  fanArchetypeWeights: slurp("audience", "fan type weights", "audience mix"),
  fanTypes: slurp("audience", "fan types", "audience personas"),
  platformEvents: slurp("events", "occasions", "holidays", "christmas", "halloween", "special dates"),
  trendsEnabled: slurp("events", "viral trends", "trends", "trending", "trendsetters"),
  storyAutomation: slurp("storylines", "occasion automation", "suggestions", "automatic occasions", "start events"),
  messagesAwayRepliesEnabled: slurp("messaging", "away replies", "automatic messages"),
  messagesPauseFollowUpsUntilReply: slurp(
    "messaging",
    "stop after one unanswered text",
    "left on read",
    "opener",
    "follow-up",
  ),
  messagesReplyBubbleLimit: slurp("messaging", "reply bubbles", "message length"),
  messagesDefaultDmPolicy: slurp("messaging", "DM policy", "message access"),
  messagesDefaultRequestFee: slurp("messaging", "message request fee"),
  messagesDefaultPpvPrice: slurp("messaging", "message image price", "PPV"),
  messagesUnscheduledAlwaysReachable: slurp("messaging", "always reachable", "message schedule"),
  messagesHighRapportDelayMinMinutes: slurp("messaging", "close fan reply minimum"),
  messagesHighRapportDelayMaxMinutes: slurp("messaging", "close fan reply maximum"),
  messagesMediumRapportDelayMinMinutes: slurp("messaging", "regular fan reply minimum"),
  messagesMediumRapportDelayMaxMinutes: slurp("messaging", "regular fan reply maximum"),
  messagesUnknownReturnDelayMinutes: slurp("messaging", "unknown return delay"),
  messagesMaxReplyDelayMinutes: slurp("messaging", "maximum reply delay"),
  messagesRecentPostAwayMinMinutes: slurp("messaging", "recent post away minimum"),
  messagesRecentPostAwayMaxMinutes: slurp("messaging", "recent post away maximum"),
  messagesStalePostAwayMinMinutes: slurp("messaging", "stale post away minimum"),
  messagesStalePostAwayMaxMinutes: slurp("messaging", "stale post away maximum"),
  messagesViewerImageCooldownMinutes: slurp("messaging", "picture cooldown", "draw a picture", "cooldown"),
  messagesCoolOffMinutes: slurp("messaging", "cool-off", "steps away", "cooldown"),
  messagesQuoteAnswerMinutes: slurp("messaging", "quote", "commission", "answer delay", "thinking time"),
  messagesFanOpeners: slurp("messaging", "fan openers", "first message", "templates"),
  messagesCommissionOpeners: slurp("messaging", "commission openers", "request", "templates"),
  messagesCommissionAsks: slurp("messaging", "commission asks", "request", "fan wants", "templates"),
  autopurgeEnabled: maintenance("automatic cleanup", "autopurge"),
  autopurgeRetentionValue: maintenance("retention", "keep media"),
  autopurgeRetentionUnit: maintenance("retention unit"),
  autopurgeKeepPosts: maintenance("keep posts", "media only"),
  autopurgeIncludeMessageMedia: maintenance("message media cleanup"),
  autopurgeNextRunAt: maintenance("next cleanup"),
  nightQuiet: slurp("general", "quiet hours", "night"),
  simulationTuning: slurp("audience", "simulation tuning", "fine tune audience"),
  modelBudget: slurp("audience", "AI budget", "model calls"),
  supportDesk: place("stir", "all-slurp", "Slurp Support", "support desk", "tickets", "trust", "stir"),
  paused: place("overview", "all-slurp", "pause all", "pause slurp", "stop", "off", "resume"),
  polyamory: place("drama", "all-slurp", "polyamory", "throuple", "couples", "love"),
  drama: place("drama", "all-slurp", "drama", "packs", "situations", "storylines", "friends"),
  postsPerDayCustom: internal(slurp("general", "posts per day", "grows with creators")),
  onboarding: internal(place("creators", "new-creators", "setup", "onboarding")),
  viewerPersonaId: internal(place("overview", "all-slurp", "viewer persona", "browse as")),
};

/** The pages an extension owns. Each gate adds its pages here (slice 3). */
const SLP_EXTENSION_TARGETS: Partial<Record<SlpBackstageTarget, SlpExtensionId>> = {
  ads: "ads",
  events: "world",
  calendar: "world",
  arcs: "storylines",
  drama: "storylines",
  // The Stir page holds both switches; its other settings are the Support desk's.
  stir: "supportDesk",
  live: "live",
};
/** Settings an extension owns that live on another page. */
const SLP_EXTENSION_SETTINGS: Partial<Record<keyof SlurpSettings, SlpExtensionId>> = {
  sharedWorldEvents: "world",
  storyAutomation: "world",
  extStir: "stir",
  // The Storylines page also holds shared ideas (Basic) and event automation (Living world).
  projectRate: "storylines",
  arcPace: "storylines",
  arcAffectsMood: "storylines",
  arcFanReactions: "storylines",
  arcAutoMode: "storylines",
  arcCooldownWeeks: "storylines",
  arcSource: "storylines",
  arcMaxConcurrentAuto: "storylines",
  arcDirectorMode: "storylines",
  arcPollHours: "storylines",
  arcStatEffects: "storylines",
  arcCrossovers: "storylines",
  creatorCollabs: "storylines",
};

/** Search skips the settings of a switched-off extension; its own switch stays findable. */
export function slpPlacementSwitchedOff(
  key: string,
  placement: SlpBackstagePlacement,
  settings: Pick<SlurpSettings, (typeof SLP_EXTENSION_KEYS)[SlpExtensionId]> | undefined,
): boolean {
  const extension = SLP_EXTENSION_SETTINGS[key as keyof SlurpSettings] ?? SLP_EXTENSION_TARGETS[placement.target];
  return Boolean(
    settings && extension && key !== SLP_EXTENSION_KEYS[extension] && !slpExtensionOn(settings, extension),
  );
}

/** A page whose extension is off shows only its switch, which saves at once. */
export function slpTargetSwitchedOff(
  target: SlpBackstageTarget,
  settings: Pick<SlurpSettings, (typeof SLP_EXTENSION_KEYS)[SlpExtensionId]>,
): boolean {
  const extension = SLP_EXTENSION_TARGETS[target];
  return Boolean(extension && !slpExtensionOn(settings, extension));
}
