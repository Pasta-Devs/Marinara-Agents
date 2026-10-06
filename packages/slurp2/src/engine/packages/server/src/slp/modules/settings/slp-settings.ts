import { SlpBootstrap } from "../../../../../shared/src/slp/slp-social.types.js";
import { z } from "zod";
import { slpArcBlueprintSchema, type SlpArcBlueprint } from "../../../../../shared/src/slp/slp-story-engine.js";

const SLURP_ARC_LIBRARY_MAX = 200;
import {
  LEGACY_SLURP_DISCOVERY_TAG_SEED,
  SLURP_DISCOVERY_TAG_MAX_LENGTH,
  SLURP_DISCOVERY_TAG_SEED,
} from "../discovery/slp-discovery-profile.js";
import {
  normalizeSlurpPromptBlockOverrides,
  slurpLegacyClassicPromptBlocks,
  SlurpPromptBlockOverrides,
  SlurpReusablePromptInstruction,
} from "../../base/prompting/slp-prompt-blocks.js";
import { SLURP_DEFAULT_ECONOMY } from "../economy/slp-wallet.js";
import {
  slurpCreatorCollabsSchema,
  SLURP_ARC_STAT_EFFECTS,
  SLURP_ARC_PACES,
  SLURP_DEFAULT_ARC_PACE,
} from "../projects/slp-project.js";
import {
  slurpArcLibraryFromLegacy,
  slurpNormalizeArcLibrary,
  SLURP_ARC_AUTO_MODES,
  SLURP_ARC_SOURCES,
  SLURP_DEFAULT_ARC_AUTO_MODE,
} from "../projects/slp-arc-library.js";
import { SLURP_AUDIENCE_TONES, SLURP_DEFAULT_AUDIENCE_TONE } from "../../../../../shared/src/slp/slp-tone.js";
import { SLURP_REALISTIC_TUNING, slurpSimulationTuningSchema } from "../../../../../shared/src/slp/slp-tuning.js";
import {
  slurpFanTypesDefault,
  slurpFanTypesSchema,
  slurpNormalizeFanTypes,
} from "../../../../../shared/src/slp/slp-fan-types.js";
import {
  slurpNormalizePlatformEvents,
  slurpPlatformEventsDefault,
  slurpPlatformEventsSchema,
  SLURP_PLATFORM_EVENTS_MAX,
  type SlurpPlatformEvent,
} from "../../../../../shared/src/slp/slp-platform-events.js";
import { readSlurpContentPackToggles, slurpApplyContentPacks } from "../world/events/slp-content-packs.js";
import { slurpNormalizeReactionBanks, SlurpReactionBanks } from "../world/slp-reaction-bank.js";
import { slurpModelBudgetSchema, slurpPostsPerDayIsCustom } from "../../../../../shared/src/slp/slp-model-budget.js";
import {
  normalizeSlpSupportDeskSettings,
  slpSupportDeskSettingsSchema,
  SLP_DEFAULT_SUPPORT_DESK_SETTINGS,
} from "../../../../../shared/src/slp/slp-support-desk.js";
import { slpDramaSettingsSchema } from "../../../../../shared/src/slp/slp-drama.js";
import { SLURP_STORY_JOB_DEFAULTS, type SlurpStoryJobWeights } from "../../../../../shared/src/slp/slp-post-purpose.js";
import { DEFAULT_SLP_CREATOR_REPLIES_PER_24_HOURS } from "../../../../../shared/src/slp/slp-social.schema.js";
import { SLURP_COOL_OFF_HOURS } from "../world/slp-stance.js";
import { SLURP_CUSTOM_OPENER_MAX_LENGTH, SLURP_CUSTOM_OPENERS_MAX } from "../../../../../shared/src/slp/slp-world.js";
import {
  SLURP_DEFAULT_PLATFORM_SCALE,
  SLURP_DEFAULT_WORLD_ACTIVITY,
  SLURP_PLATFORM_SCALE,
  SLURP_WORLD_ACTIVITY,
} from "../../../../../shared/src/slp/slp-scale.js";
import {
  SLURP_DEFAULT_PROJECT_RATE,
  SLURP_DEFAULT_STORY_RATE,
  SLURP_PROJECT_RATE,
  SLURP_STORY_RATE,
  SLURP_DEFAULT_TEASER_RATE,
  SLURP_TEASER_RATE,
} from "../feed/slp-post-variation.js";
import { logger } from "../../../lib/logger.js";
import { SLURP_DEFAULT_CREATOR_MESSAGING, SLURP_DM_POLICIES } from "../messages/slp-messaging.js";
import { SLURP_DEFAULT_REPLY_DELAYS } from "../messages/slp-messaging.js";
import { NOODLER_CONTENT_HARD_MAX_LENGTH } from "../../base/prompting/slp-content-format.js";
import { parseRecord, type SlurpAccount } from "../records/slp-storage-model.js";
export const slpCreatorFanArchetypeWeightsSchema = z
  .object({
    ordinary: z.number().finite().min(0),
    eccentric: z.number().finite().min(0),
    crossFandom: z.number().finite().min(0),
    raider: z.number().finite().min(0),
    organicDiscovery: z.number().finite().min(0),
    freeResource: z.number().finite().min(0),
  })
  .partial()
  .refine((value) => Object.values(value).some((weight) => (weight ?? 0) > 0), {
    message: "At least one fan archetype weight must be greater than zero.",
  });

/**
 * Creator settings are owned by Slurp. Keep this deliberately narrow: public Noodle settings
 * must not become an implicit dependency of Creator scheduling or generation.
 */
export const slurpSettingsSchema = z.object({
  inlineAdsEnabled: z.boolean(),
  inlineAdsFrequency: z.enum(["light", "standard", "frequent"]),
  /** How often brands offer Creators a paid partnership (R). "normal" is the pace before R. */
  brandDealsPace: z.enum(["off", "rare", "normal", "often"]),
  inlineAdsSteering: z.enum(["balanced", "personalized", "random"]),
  inlineAdsPreferredTags: z.array(z.string().trim().min(1).max(32)).max(8),
  inlineAdsContentCeiling: z.enum(["tame", "suggestive", "explicit"]),
  inlineAdsTone: z.enum(["corporate", "scammy", "local", "luxury", "unhinged"]),
  inlineAdsEra: z.enum(["present", "nineties", "cyberpunk", "retrofuture"]),
  inlineAdsWorldContext: z.string().trim().max(1200),
  inlineAdsImagesEnabled: z.boolean(),
  /** Image connection for ad artwork. Null falls back to the Slurp image connection. */
  inlineAdsImageConnectionId: z.string().trim().min(1).nullable(),
  /** Lorebook whose entries feed the ad generator as world context. */
  inlineAdsLorebookId: z.string().trim().min(1).nullable(),
  /** Fingerprint of the synced lorebook, so a changed book can resync itself. */
  inlineAdsLorebookRevision: z.string().trim().max(64).nullable(),
  imageWidth: z.number().int().min(64).max(4096),
  imageHeight: z.number().int().min(64).max(4096),
  /** Share of a Creator's automatic posts published as Stories. */
  storyRate: z.enum(SLURP_STORY_RATE),
  /** Whether automatic Story slots may publish image Stories. Manual Stories remain available. */
  storyImagesEnabled: z.boolean(),
  /** How long image Stories remain in the Moments shelf. */
  storyLifetimeHours: z.number().int().min(1).max(168),
  /** How often an automatic post goes out free as a teaser. See `slurpTeaserPost`. */
  teaserRate: z.enum(SLURP_TEASER_RATE),
  /** Share of a Creator's automatic posts that continue a project rather than standing alone. */
  projectRate: z.enum(SLURP_PROJECT_RATE),
  /** Multiplies every arc chapter's day range. */
  arcPace: z.enum(SLURP_ARC_PACES),
  /** The Creator's running arc reaches their direct messages. */
  arcAffectsMood: z.boolean(),
  /** The Creator's running arc reaches the audience that comments on their posts. */
  arcFanReactions: z.boolean(),
  /** Whether the world tick starts or suggests arcs for Creators with none running. */
  arcAutoMode: z.enum(SLURP_ARC_AUTO_MODES),
  arcCooldownWeeks: z.number().int().min(1).max(8),
  /** Where automatic arcs come from: the library, the model, or both. */
  arcSource: z.enum(SLURP_ARC_SOURCES),
  /** Most Creators with an automatic arc active or suggested at once. Manual arcs do not count. */
  arcMaxConcurrentAuto: z.number().int().min(1).max(20),
  /** Off: arcs run by themselves. On: the Arcs panel may pause, skip, go back, relabel, twist, and end arcs. */
  arcDirectorMode: z.boolean(),
  /** How long an arc's fan poll stays open before the world tick settles it. */
  arcPollHours: z.number().int().min(1).max(168),
  /** Cap on arc chapter effects on follower growth, earnings, and fan loyalty: off, ±10%, or ±50%. */
  arcStatEffects: z.enum(SLURP_ARC_STAT_EFFECTS),
  /** Whether the world tick may start automatic arcs shared by two Creators. */
  arcCrossovers: z.boolean(),
  /** Default event behavior. Imported blueprints inherit this safe suggestion policy. */
  storyAutomation: z.enum(["manual", "suggest", "auto"]),
  /** Arc types Slurp and the player start arcs from. Replaces the v1 `arcAllowedKinds`. */
  arcLibrary: z.array(slpArcBlueprintSchema).max(SLURP_ARC_LIBRARY_MAX),
  /** Content packs switched on or off (Backstage › Packs). A pack missing here uses its default. */
  contentPacks: z.record(z.string(), z.boolean()),
  /** The curated Discover tags and the group each is shown under. Creators may still carry custom tags. */
  discoveryTags: z
    .array(
      z.object({
        tag: z.string().trim().min(1).max(SLURP_DISCOVERY_TAG_MAX_LENGTH),
        group: z.string().trim().min(1).max(40),
      }),
    )
    .max(200),
  /** Stories are shown in their own tall frame, so they carry their own size. */
  storyImageWidth: z.number().int().min(64).max(4096),
  storyImageHeight: z.number().int().min(64).max(4096),
  refreshesPerDay: z.number().int().min(0).max(24),
  generationGuidance: z.string().max(20_000),
  audienceTone: z.enum(SLURP_AUDIENCE_TONES),
  /**
   * Extra bodies for the free audience comment bank, merged with the shipped ones.
   *
   * The free tier writes the highest-volume text on the platform and must never call the model to
   * do it, so it draws from a fixed bank. A fixed bank of any size eventually repeats, and the
   * body is the part a reader notices. Storing the bank here makes it two things at once: a list
   * the player can edit or clear in Settings, and somewhere a rare, cheap generation can leave new
   * lines behind. One call buys hundreds of comments.
   */
  audienceReactionBank: z.unknown().transform(slurpNormalizeReactionBanks),
  worldActivity: z.enum(SLURP_WORLD_ACTIVITY),
  platformScale: z.enum(SLURP_PLATFORM_SCALE),
  generationConnectionId: z.string().nullable(),
  imageContextMode: z.enum(["auto", "imagePrompt", "vision"]),
  /** Describes pictures for image context. Null uses the Creator text connection. */
  imageContextConnectionId: z.string().nullable(),
  /** Builds Creator Pages (a long structured answer); null = the AI writing connection. */
  pageConnectionId: z.string().nullable().default(null),
  /** The LLM connection that enhances picture prompts; null = Slurp's text connection. */
  imagePromptConnectionId: z.string().nullable(),
  /**
   * Engine image style profile for Slurp pictures. Null uses the connection's profile, then the
   * Engine default. When set, the connection's own prompt prefixes are left out: a chosen style
   * replaces them rather than stacking on top of them.
   */
  imageStyleProfileId: z.string().nullable(),
  imageGenerationPrompt: z.string(),
  imagePromptInterpretation: z.string().max(20_000),
  enableImageInterpretation: z.boolean(),
  imageGenerationUseAvatarReferences: z.boolean(),
  imageGenerationIncludeDescriptions: z.boolean(),
  /** How the look reaches the picture prompt: `slurpApplyImageLook`. */
  imageAppearanceMode: z.enum(["writer", "insert", "both"]),
  appearanceProfileMode: z.enum(["ask", "high_confidence", "always"]),
  autoPostingImagesEnabled: z.boolean(),
  allowRandomUsers: z.boolean(),
  /** Ambient roster entity ids the user deleted; the seeder never recreates these. */
  dismissedAmbientProfileIds: z.array(z.string()),
  allowProfessorMari: z.boolean(),
  /**
   * Characters the user put in the audience.
   *
   * Key is the Engine character id. Value is the Fan Type id that shapes the character's
   * behaviour, or true to let the id pick one, as an ambient account does today.
   */
  audienceCharacters: z.record(z.string(), z.union([z.string(), z.boolean()])),
  /** Character groups whose members join the audience. Per-character entries above win. */
  audienceCharacterGroupIds: z.array(z.string()).max(20),
  /**
   * Most character fans that may act at once.
   *
   * The user sets this because the cost is theirs: each character fan in a cast adds up to
   * `SLURP_FAN_VOICE_PROMPT_MAX` characters to that prompt. The default keeps a fresh install
   * bounded; a user with a long context window may raise it.
   */
  audienceCharacterLimit: z.number().int().min(0).max(10),
  carryoverModes: z.array(z.enum(["conversation", "roleplay", "game"])),
  carryoverHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 365),
  carryoverMaxItems: z.number().int().min(1).max(100),
  /** Longest generated post body. Formats only aim for a length; this is where text is cut. */
  postMaxLength: z.number().int().min(300).max(NOODLER_CONTENT_HARD_MAX_LENGTH),
  /** Post bodies longer than this collapse behind Show more. */
  postShowMoreLength: z.number().int().min(100).max(NOODLER_CONTENT_HARD_MAX_LENGTH),
  /** Per source character: apply its conversation image instructions to Slurp images. Unset uses the Engine checkbox. */
  /** Whether Professor Mari, the Engine's built-in character, may be picked as a new Creator source. */
  professorMariCreatorSource: z.boolean(),
  characterImageInstructions: z.record(z.string(), z.boolean()),
  /** Per Creator: false turns off "The image model knows this character" (the card name in picture prompts). */
  creatorImageNames: z.record(z.string(), z.boolean()),
  /** Saved sets of generation guidance and image prompt, switched from Settings. */
  promptPresets: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        generationGuidance: z.string().max(20_000),
        imageGenerationPrompt: z.string().max(20_000),
      }),
    )
    .max(20),
  /** User changes to the prompt block layouts. Defaults stay in source. */
  promptBlocks: z.unknown().transform(normalizeSlurpPromptBlockOverrides),
  /**
   * The player's prompt edits from before the Classic runtime was removed, kept so the Classic
   * prompt preset can restore them. Written once by migration; never by generation.
   */
  classicPromptBlocks: z.unknown().transform(normalizeSlurpPromptBlockOverrides),
  promptInstructions: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        name: z.string().trim().min(1).max(120),
        text: z.string().trim().max(20_000),
        builtin: z.boolean().optional(),
      }),
    )
    .max(100),
  enableLorebookContext: z.boolean(),
  /**
   * Let the flavour brief read what the player's other Agents know about a Creator (Long-Term
   * Memory, Character Tracker, World State, Persona Stats). Read-only. See `slp-agent-memory-source.ts`.
   */
  flavourFromAgents: z.boolean(),
  /**
   * How ordinary posts are planned. `classic` lets the model pick the subject; `beats` picks a
   * concrete beat from the Creator's card first. See `modules/feed/slp-post-beat.ts`.
   */
  postPlanner: z.enum(["classic", "beats"]),
  /** "Daily life": how often an ordinary post is a day-to-day life moment. See `slp-life-moments.ts`. */
  lifeMomentRate: z.enum(["rarely", "sometimes", "often"]),
  /** What automatic Stories are for: one weight per job, 0 = never. See `slurpStoryPurpose`. */
  storyJobs: z
    .object(
      Object.fromEntries(
        Object.keys(SLURP_STORY_JOB_DEFAULTS).map((key) => [key, z.number().int().min(0).max(10)]),
      ) as Record<keyof SlurpStoryJobWeights, z.ZodNumber>,
    )
    .strict(),
  /**
   * Beats only: a daily world tick and weekly niche patterns per topical tag add shared beat ideas.
   * See `modules/feed/slp-shared-preseed.ts`.
   */
  sharedPreseed: z.boolean(),
  /** With the shared preseed on, the world tick may also start a real Slurp-wide platform event. */
  sharedWorldEvents: z.boolean(),
  enableImagePrompts: z.boolean(),
  maxImagesPerRefresh: z.number().int().min(0).max(24),
  maxGeneratedPostsPerRefresh: z.number().int().min(0).max(24),
  maxLikesPerRefresh: z.number().int().min(0).max(24),
  maxRepliesPerRefresh: z.number().int().min(0).max(24),
  allowGalleryImageAttachments: z.boolean(),
  /** Tap a cropped picture preview to open the full post (locked posts still open their unlock options). */
  previewOpensPost: z.boolean(),
  /** Previews show the whole picture fitted instead of cropping it (top centre). Display only. */
  previewWholePictures: z.boolean(),
  /** Every Slurp picture and video stays blurred until it is tapped (for using Slurp in public). */
  blurPictures: z.boolean(),
  /**
   * Posts a day across the whole Creator cast, and now actually that number: the reserve used to
   * lay down twice as many slots as this asked for. The ceiling is well above the old 24 so a
   * player who liked the accidental rate can ask for it outright.
   */
  postsPerDay: z.number().int().min(1).max(96),
  /** The player set "Posts per day" by hand. Otherwise it grows with the active Creators (F). */
  postsPerDayCustom: z.boolean(),
  autoPostingScheduleEnabled: z.boolean(),
  autoPostGenerationMode: z.enum(["pre_generate", "on_demand"]),
  fanActivityEnabled: z.boolean(),
  fanActivityRunsPerDay: z.number().int().min(1).max(96),
  fanLikesPerRefresh: z.number().int().min(0).max(24),
  fanRepliesPerRefresh: z.number().int().min(0).max(12),
  fanArchetypeWeights: slpCreatorFanArchetypeWeightsSchema,
  /**
   * Wallet economy. Off by default: an existing install keeps the presentation-only prices it
   * has always had, and nothing starts refusing an unlock because a stored balance ran dry.
   */
  walletEnabled: z.boolean(),
  walletUnlockCost: z.number().int().min(0).max(9999),
  walletSubscriptionCost: z.number().int().min(0).max(9999),
  /** Character Creators move their own prices once a week from popularity and demand. */
  pricingDynamicCharacters: z.boolean(),
  /** Largest change one weekly price adjustment may make, as a percentage of the current price. */
  pricingMaxWeeklyChangePercent: z.number().int().min(0).max(100),
  /** Daily stipend tops the balance up to this floor. Zero disables the stipend. */
  walletStipendFloor: z.number().int().min(0).max(99_999),
  walletDayStartHour: z.number().int().min(0).max(23),
  walletAdReward: z.number().int().min(0).max(999),
  walletAdDailyCap: z.number().int().min(0).max(9999),
  walletEngagementReward: z.number().int().min(0).max(999),
  walletEngagementDailyCap: z.number().int().min(0).max(9999),
  /** Share of a fan's payment that reaches the viewer's own creator, as a percentage. */
  walletCreatorRevenueSharePercent: z.number().int().min(0).max(100),
  /**
   * Creators answer a message you left unanswered while you were away.
   *
   * On by default, because a chat nobody ever answers is not a chat. Off leaves the whole
   * background reply loop asleep: a creator then answers only while you are in the conversation.
   * Commissions and the later bubbles of a reply already sent still arrive — those are owed.
   */
  messagesAwayRepliesEnabled: z.boolean(),
  /** Messages one reply is broken into. One keeps a reply in a single bubble. */
  messagesReplyBubbleLimit: z.number().int().min(1).max(4),
  /** Where a creator nobody has configured by hand starts. */
  messagesDefaultDmPolicy: z.enum(SLURP_DM_POLICIES as unknown as [string, ...string[]]),
  messagesDefaultRequestFee: z.number().int().min(0).max(9999),
  messagesDefaultPpvPrice: z.number().int().min(0).max(9999),
  /** Reply timing, in minutes. See `SlurpReplyDelays` in slurp-messaging.ts. */
  messagesUnscheduledAlwaysReachable: z.boolean(),
  messagesHighRapportDelayMinMinutes: z.number().int().min(0).max(1440),
  messagesHighRapportDelayMaxMinutes: z.number().int().min(0).max(1440),
  messagesMediumRapportDelayMinMinutes: z.number().int().min(0).max(1440),
  messagesMediumRapportDelayMaxMinutes: z.number().int().min(0).max(1440),
  messagesUnknownReturnDelayMinutes: z.number().int().min(0).max(1440),
  messagesMaxReplyDelayMinutes: z.number().int().min(0).max(1440),
  messagesRecentPostAwayMinMinutes: z.number().int().min(0).max(1440),
  messagesRecentPostAwayMaxMinutes: z.number().int().min(0).max(1440),
  messagesStalePostAwayMinMinutes: z.number().int().min(0).max(1440),
  messagesStalePostAwayMaxMinutes: z.number().int().min(0).max(1440),
  /** Minutes between two pictures you draw into one chat. 0 turns the wait off. */
  messagesViewerImageCooldownMinutes: z.number().int().min(0).max(10080),
  /** Minutes a Creator stays away after they have had enough. 0 = they do not step away (the strike still counts). */
  messagesCoolOffMinutes: z.number().int().min(0).max(10080),
  /** Minutes a fan thinks over a quote before answering it. 0 = the next world tick. */
  messagesQuoteAnswerMinutes: z.number().int().min(0).max(10080),
  /** The player's own first lines for fan DMs. Empty = the built-in ones. */
  messagesFanOpeners: z
    .array(z.string().trim().min(1).max(SLURP_CUSTOM_OPENER_MAX_LENGTH))
    .max(SLURP_CUSTOM_OPENERS_MAX),
  /** The player's own first words for commission requests. Empty = the built-in ones. */
  messagesCommissionOpeners: z
    .array(z.string().trim().min(1).max(SLURP_CUSTOM_OPENER_MAX_LENGTH))
    .max(SLURP_CUSTOM_OPENERS_MAX),
  /**
   * Creator replies to comments in any 24 hours, installation-wide (your comments and the
   * audience's share it). No "off": the audience drain runs on page loads and this is its only cap.
   */
  creatorRepliesPerDay: z.number().int().min(1).max(200),
  autopurgeEnabled: z.boolean(),
  autopurgeRetentionValue: z.number().int().min(1).max(365),
  autopurgeRetentionUnit: z.enum(["days", "weeks", "months"]),
  autopurgeKeepPosts: z.boolean(),
  autopurgeIncludeMessageMedia: z.boolean(),
  autopurgeNextRunAt: z.string().datetime({ offset: true }).nullable(),
  /** Every number the audience simulation runs on. See `slurp-tuning.ts`; a partial object fills from Realistic. */
  simulationTuning: slurpSimulationTuningSchema,
  /** Who is in the audience. See `slurp-fan-types.ts`; an empty or broken list falls back to the built-ins. */
  fanTypes: slurpFanTypesSchema,
  /** Holidays and site-wide events. See `slurp-platform-events.ts`. */
  platformEvents: slurpPlatformEventsSchema,
  /** Creator pairs allowed to collab, with what each pair makes. See `slurp-project.ts`. */
  creatorCollabs: slurpCreatorCollabsSchema,
  /** Which visible text may call a model, and the hard hourly/daily budget for it. */
  modelBudget: slurpModelBudgetSchema,
  /** Settings › Stir: the Slurp Support desk (tickets, notices, refusals, shady moves, leaving). */
  supportDesk: slpSupportDeskSettingsSchema,
  drama: slpDramaSettingsSchema,
  /** Settings › Stir: a couple may grow to four people (0.3.5). Off by default. */
  polyamory: z.boolean(),
  /** Settings › Overview › Pause all: no model or image call, no tick, nothing (`slp-pause.ts`). */
  paused: z.boolean(),
  nightQuiet: z.boolean(),
  onboarding: z.enum(["not_started", "in_progress", "completed"]),
});

export type SlurpSettings = z.infer<typeof slurpSettingsSchema>;

export type { SlurpPromptBlockOverrides, SlurpReusablePromptInstruction };

export type SlurpSettingsUpdateInput = Partial<SlurpSettings>;

export type SlurpBootstrap = Omit<SlpBootstrap, "settings"> & { settings: SlurpSettings };

// Package-owned default for the editable Slurp generation guidance. This is the
// single tone prompt: creator personality, mood balance, and the adult flirty lean
// all live here so they are visible and editable in Slurp settings, not hardcoded.
// Keep this value aligned with the Slurp settings surface.
const LEGACY_SLP_CREATOR_DEFAULT_GENERATION_GUIDANCE =
  "All NoodleR creators and viewers are adults (18+). This is an adult creator page: flirty, suggestive, teasing, and sensual posts are common, and explicit posts appear regularly when they suit the creator — but they are not required and need not be the majority. Tease the locked posts and answer flirty comments in kind. Keep each creator's personality intact: a shy creator flirts shyly, a blunt one bluntly, a funny one filthily. Ordinary posts — updates, humor, behind the scenes, project news — matter just as much and keep both the page and the character human. Keep low mood or conflict uncommon and character-specific, and do not let recent posts set the default mood.";

export const LEGACY_SLURP_DEFAULT_GENERATION_GUIDANCE =
  "All Slurp creators and viewers are adults (18+). This is an adult creator page: flirty, suggestive, teasing, and sensual posts are common, and explicit posts appear regularly when they suit the creator — but they are not required and need not be the majority. Tease the locked posts and answer flirty comments in kind. Keep each creator's personality intact: a shy creator flirts shyly, a blunt one bluntly, a funny one filthily. Ordinary posts — updates, humor, behind the scenes, project news — matter just as much and keep both the page and the character human. Keep low mood or conflict uncommon and character-specific, and do not let recent posts set the default mood.";

/** The old Writing spice presets (before 0.3.17), written verbatim into `generationGuidance`. */
export const SLURP_GUIDANCE_PRESETS = {
  mild: "All Slurp creators and viewers are adults (18+). This is an adult creator page, but a restrained one: posts are flirty, teasing, and suggestive rather than graphic. Innuendo, charm, and anticipation do the work, and locked posts are teased instead of described. Do not write explicit sexual detail. Keep each creator's personality intact: a shy creator flirts shyly, a blunt one flirts bluntly. Ordinary posts about their day, work, and mood stay just as important as the flirty ones.",
  steamy:
    "All Slurp creators and viewers are adults (18+). This is an adult creator page. Posts are normally sexually suggestive to outright NSFW. Creators will use Slurp to often excite their readers with their posts. The level of NSFW of a post is dependent on the creator's personality, a shy, innocent person will be suggestive, but still overall tame. On the other end of the spectrum, an outgoing personality who has no problems with sex, will often post very explicit material. When a post is explicit or shows nudity, always use thorough, graphic, horny descriptions. Name the body in dirty everyday words, not clinical ones: tits, nipples, ass, pussy, clit, cock, balls, cum, wet, dripping, hard, leaking. Describe how it looks, feels, and moves. Keep each creator's personality intact.",
  explicit:
    "All Slurp creators and viewers are adults (18+). This is an explicit adult creator page. Sexual content is the norm here rather than the exception, and creators describe it directly and in detail when it suits them. Tease the locked posts hard and answer flirty comments in kind. Always use thorough, graphic, horny descriptions for nudity and sex. Name the body in dirty everyday words, not clinical ones: tits, nipples, ass, pussy, clit, cock, balls, cum, wet, dripping, hard, leaking. Describe how it looks, feels, and moves. Keep each creator's personality intact: a shy creator is explicit shyly, a blunt one is explicit bluntly. Ordinary posts about their day, work, and mood still appear and keep the feed believable.",
} as const;

export type SlurpGuidanceLevel = keyof typeof SLURP_GUIDANCE_PRESETS;

// House style (0.3.17), no spice: level and Language reach the prompt as their own lines. The presets
// above stay only so `readSlurpSpice` can recognise and migrate them.
export const SLURP_HOUSE_STYLE_GUIDANCE =
  "All Slurp creators and viewers are adults (18+). This is an adult creator page. How far each creator goes is set by their spice level; their personality decides how: a shy creator stays tamer and flirts shyly, an outgoing one is bolder and blunter. Tease the locked posts and answer flirty comments in kind. Ordinary posts about their day, work, and mood matter just as much and keep the feed believable. Keep each creator's personality intact.";

export const SLP_CREATOR_DEFAULT_GENERATION_GUIDANCE: string = SLURP_HOUSE_STYLE_GUIDANCE;

/** The middle level shipped with a typo before the levels existed; migrate it forward. */
export const LEGACY_TYPO_SLURP_DEFAULT_GENERATION_GUIDANCE =
  "All Slurp creators and viewers are adults (18+). This is an adult creator page. Posts are normallly sexually suggestive to outright NSFW. Creators will use Slurp to often excite its readers with their posts. The level of NSFW of a post is dependent on the creator's personality, a shy, innocent person will be suggestive, but still overall tame. On the other end of the spectrum, an outgoing personality who has no problems with sex, will often post very explicit material.";

export const LEGACY_STEAMY_SLURP_DEFAULT_GENERATION_GUIDANCE =
  "All Slurp creators and viewers are adults (18+). This is an adult creator page. Posts are normally sexually suggestive to outright NSFW. Creators will use Slurp to often excite their readers with their posts. The level of NSFW of a post is dependent on the creator's personality, a shy, innocent person will be suggestive, but still overall tame. On the other end of the spectrum, an outgoing personality who has no problems with sex, will often post very explicit material.";

export const LEGACY_EXPLICIT_SLURP_DEFAULT_GENERATION_GUIDANCE =
  "All Slurp creators and viewers are adults (18+). This is an explicit adult creator page. Sexual content is the norm here rather than the exception, and creators describe it directly and in detail when it suits them. Tease the locked posts hard and answer flirty comments in kind. Keep each creator's personality intact: a shy creator is explicit shyly, a blunt one is explicit bluntly. Ordinary posts about their day, work, and mood still appear and keep the feed believable.";

export const LEGACY_SLP_CREATOR_DEFAULT_IMAGE_GENERATION_PROMPT =
  "Create a polished social-media image for an adult Creator post. Match the creator's identity, personality, body, clothing, and established visual details. Follow the post's mood and subject. Describe the pose, expression, setting, lighting, camera angle, composition, and visible details clearly. Flirty, suggestive, sensual, or explicit imagery is allowed when it fits the post and creator, but do not force sexual content into ordinary updates. Keep the image coherent, intentional, and suitable for a public or locked Creator feed.";

export const LEGACY_GRAPHIC_SLP_CREATOR_DEFAULT_IMAGE_GENERATION_PROMPT =
  "Create a polished social-media image for an adult Creator post. Match the creator's identity, personality, body, clothing, and established visual details. Follow the post's mood and subject. Describe the pose, expression, setting, lighting, camera angle, composition, and visible details clearly. Flirty, suggestive, sensual, or explicit imagery is allowed when it fits the post and creator, but do not force sexual content into ordinary updates. When the image shows nudity or sex, always use thorough, graphic descriptions. Name the body in dirty everyday words, not clinical ones: tits, nipples, ass, pussy, clit, cock, balls, cum, wet, dripping, hard, leaking. Describe how it looks, how it sits, how it catches the light. Keep the image coherent, intentional, and suitable for a public or locked Creator feed.";

export const SLP_CREATOR_DEFAULT_IMAGE_GENERATION_PROMPT =
  "Create a provider-ready image prompt for the supplied adult Creator post. Preserve the post's subject, action, setting, mood, clothing, and established appearance. Use the Creator's personality to shape expression and presentation, not to invent a new event or sexualize an ordinary moment. Add nudity, explicit anatomy, or sexual activity only when the post or an explicit trusted instruction already requires it. Keep the image coherent, believable, and suitable for the post's public or locked access level. Use only the visual details needed for this scene.";

export const LEGACY_SLP_CREATOR_DEFAULT_IMAGE_PROMPT_INTERPRETATION =
  "Edit this image prompt into a provider-ready image prompt. Preserve the original subject, action, setting, composition, and visual style. Preserve any explicit style in the original prompt, character context, image instructions, or style guidance. Do not add realistic, photorealistic, photographic, camera, lens, or natural-lighting language unless the supplied context clearly requests that style. Do not convert an anime, cartoon, game, manga, comic, illustration, painterly, fantasy, or stylized character into a realistic image. When no style is specified, keep the prompt style-neutral. Do not invent an art style. Treat image instructions as guidance, not text to copy into the result. Return only the provider-ready image prompt.";

export const SLP_CREATOR_DEFAULT_IMAGE_PROMPT_INTERPRETATION =
  "Edit this image prompt into a concise provider-ready image prompt. Preserve the original subject, action, setting, clothing, composition, visual style, and sexual intensity. Preserve explicit style from the original prompt, character context, image instructions, or style guidance. Do not add a new event, person, pose, outfit, viewpoint, nudity, explicit anatomy, or sexual activity. Do not turn an ordinary update into a fashion shoot or erotic image. Do not add realistic, photographic, camera, lens, or natural-lighting language unless the supplied context requests it. Do not convert a stylized character into a realistic image. Treat image instructions as guidance, not text to copy. Return only the provider-ready image prompt.";

/**
 * The LEGACY_* guidance constants above are every previously shipped default. An install that
 * never edited the guidance stored one of them verbatim, so it is migrated to the current default
 * instead of being kept as if the user had chosen it. Comparison is exact: an edited string
 * differs by at least one character and is preserved as the user's own.
 */

export const DEFAULT_SLURP_SETTINGS: SlurpSettings = {
  inlineAdsEnabled: true,
  inlineAdsFrequency: "standard",
  brandDealsPace: "normal",
  inlineAdsSteering: "personalized",
  inlineAdsPreferredTags: [],
  inlineAdsContentCeiling: "explicit",
  inlineAdsTone: "corporate",
  inlineAdsEra: "present",
  inlineAdsWorldContext: "",
  inlineAdsImagesEnabled: false,
  inlineAdsImageConnectionId: null,
  walletEnabled: true,
  walletUnlockCost: SLURP_DEFAULT_ECONOMY.unlockCost,
  walletSubscriptionCost: SLURP_DEFAULT_ECONOMY.subscriptionCost,
  pricingDynamicCharacters: true,
  pricingMaxWeeklyChangePercent: 15,
  walletStipendFloor: SLURP_DEFAULT_ECONOMY.stipendFloor,
  walletDayStartHour: SLURP_DEFAULT_ECONOMY.dayStartHour,
  walletAdReward: SLURP_DEFAULT_ECONOMY.adReward,
  walletAdDailyCap: SLURP_DEFAULT_ECONOMY.adDailyCap,
  walletEngagementReward: SLURP_DEFAULT_ECONOMY.engagementReward,
  walletEngagementDailyCap: SLURP_DEFAULT_ECONOMY.engagementDailyCap,
  walletCreatorRevenueSharePercent: SLURP_DEFAULT_ECONOMY.creatorRevenueSharePercent,
  inlineAdsLorebookId: null,
  inlineAdsLorebookRevision: null,
  // Exact 4:5, the feed's own frame: 2:3 was cropped in the feed and cut in half on profiles
  // (R1-062). A default only; a stored size is never rewritten.
  imageWidth: 1024,
  imageHeight: 1280,
  storyRate: SLURP_DEFAULT_STORY_RATE,
  storyImagesEnabled: true,
  storyLifetimeHours: 72,
  teaserRate: SLURP_DEFAULT_TEASER_RATE,
  projectRate: SLURP_DEFAULT_PROJECT_RATE,
  arcPace: SLURP_DEFAULT_ARC_PACE,
  discoveryTags: SLURP_DISCOVERY_TAG_SEED.map((entry) => ({ ...entry })),
  arcAffectsMood: true,
  arcFanReactions: true,
  arcAutoMode: SLURP_DEFAULT_ARC_AUTO_MODE,
  arcCooldownWeeks: 3,
  arcSource: "mixed",
  arcMaxConcurrentAuto: 2,
  arcDirectorMode: false,
  arcPollHours: 24,
  arcStatEffects: "small",
  arcCrossovers: true,
  storyAutomation: "suggest",
  arcLibrary: slurpArcLibraryFromLegacy(undefined),
  contentPacks: {},
  // 4:5. The composer crops an uploaded Story to whatever ratio is configured here, so the two
  // halves of the feature stay one shape.
  storyImageWidth: 1024,
  storyImageHeight: 1280,
  refreshesPerDay: 0,
  generationGuidance: SLP_CREATOR_DEFAULT_GENERATION_GUIDANCE,
  promptInstructions: [],
  audienceTone: SLURP_DEFAULT_AUDIENCE_TONE,
  worldActivity: SLURP_DEFAULT_WORLD_ACTIVITY,
  platformScale: SLURP_DEFAULT_PLATFORM_SCALE,
  generationConnectionId: null,
  imageContextMode: "auto",
  imageContextConnectionId: null,
  pageConnectionId: null,
  imagePromptConnectionId: null,
  imageStyleProfileId: null,
  imageGenerationPrompt: SLP_CREATOR_DEFAULT_IMAGE_GENERATION_PROMPT,
  imagePromptInterpretation: SLP_CREATOR_DEFAULT_IMAGE_PROMPT_INTERPRETATION,
  enableImageInterpretation: true,
  // On by default. Off, no avatar ever reached the image model and the linked card's Appearance
  // was never read, so a Creator's likeness rested entirely on the Appearance text written on the
  // Creator — blank for anyone drafted from a card without one, and a blank appearance is what let
  // the image model invent a different person for every post. A provider that cannot take a
  // reference image simply ignores the references.
  imageGenerationUseAvatarReferences: true,
  imageGenerationIncludeDescriptions: true,
  imageAppearanceMode: "writer",
  appearanceProfileMode: "high_confidence",
  autoPostingImagesEnabled: false,
  allowRandomUsers: false,
  dismissedAmbientProfileIds: [],
  allowProfessorMari: false,
  audienceCharacters: {},
  audienceCharacterGroupIds: [],
  audienceCharacterLimit: 5,
  carryoverModes: [],
  carryoverHours: 24,
  carryoverMaxItems: 20,
  postMaxLength: NOODLER_CONTENT_HARD_MAX_LENGTH,
  postShowMoreLength: 300,
  characterImageInstructions: {},
  creatorImageNames: {},
  promptPresets: [],
  promptBlocks: {} satisfies SlurpPromptBlockOverrides,
  classicPromptBlocks: {} satisfies SlurpPromptBlockOverrides,
  professorMariCreatorSource: true,
  enableLorebookContext: false,
  flavourFromAgents: true,
  // Beats by default since 0.2.55: the fixes for same-y, canon-less, tame posts live there.
  postPlanner: "beats",
  lifeMomentRate: "sometimes",
  storyJobs: { ...SLURP_STORY_JOB_DEFAULTS },
  sharedPreseed: false,
  sharedWorldEvents: false,
  enableImagePrompts: false,
  maxImagesPerRefresh: 0,
  maxGeneratedPostsPerRefresh: 4,
  maxLikesPerRefresh: 4,
  maxRepliesPerRefresh: 4,
  allowGalleryImageAttachments: false,
  previewOpensPost: true,
  previewWholePictures: false,
  blurPictures: false,
  postsPerDay: 4,
  postsPerDayCustom: false,
  autoPostingScheduleEnabled: false,
  autoPostGenerationMode: "on_demand",
  // On by default, and at a volume that reads as a comment section rather than a rumour of one.
  // At the old defaults this was off, and switching it on bought one reply per run across up to
  // twelve Creators: roughly one comment per Creator every three days.
  //
  // This does not breach the readable-handful rule. That rule caps *notable* events, and a comment
  // weighs 25 against a notable threshold of 40 (`slurp-event-weight.ts`), so comments group into
  // a single line instead of filling the notification list.
  fanActivityEnabled: true,
  fanActivityRunsPerDay: 8,
  // Likes belong to the pulse, which produces them free and continuously; spending a generated
  // batch slot on "who tapped like" buys nothing an RNG cannot. A couple are kept so somebody who
  // just wrote a comment can also be seen liking the post.
  fanLikesPerRefresh: 2,
  // A run is one batched model call however many rows it returns, so replies per run are close to
  // free. Six across up to twelve Creators is about 24 readable comments a day, which sits at
  // roughly the same like-to-comment ratio the displayed counts in `slurp-reach.ts` already claim.
  fanRepliesPerRefresh: 6,
  // Ships empty: the shipped bodies carry a new install on their own, and a bank the player never
  // asked for should not arrive pre-filled with lines they did not choose.
  audienceReactionBank: { shared: [], byType: {} } as SlurpReactionBanks,
  fanArchetypeWeights: {
    ordinary: 1,
    eccentric: 1,
    crossFandom: 1,
    raider: 1,
    organicDiscovery: 1,
    freeResource: 1,
  },
  messagesAwayRepliesEnabled: true,
  messagesReplyBubbleLimit: 3,
  messagesDefaultDmPolicy: SLURP_DEFAULT_CREATOR_MESSAGING.dmPolicy,
  messagesDefaultRequestFee: SLURP_DEFAULT_CREATOR_MESSAGING.requestFee,
  messagesDefaultPpvPrice: SLURP_DEFAULT_CREATOR_MESSAGING.ppvPrice,
  ...SLURP_DEFAULT_REPLY_DELAYS,
  messagesViewerImageCooldownMinutes: 180,
  messagesCoolOffMinutes: SLURP_COOL_OFF_HOURS * 60,
  messagesQuoteAnswerMinutes: 1440,
  messagesFanOpeners: [],
  messagesCommissionOpeners: [],
  creatorRepliesPerDay: DEFAULT_SLP_CREATOR_REPLIES_PER_24_HOURS,
  autopurgeEnabled: false,
  autopurgeRetentionValue: 4,
  autopurgeRetentionUnit: "weeks",
  autopurgeKeepPosts: true,
  autopurgeIncludeMessageMedia: false,
  autopurgeNextRunAt: null,
  simulationTuning: SLURP_REALISTIC_TUNING,
  fanTypes: slurpFanTypesDefault(),
  platformEvents: slurpPlatformEventsDefault(),
  creatorCollabs: [],
  modelBudget: slurpModelBudgetSchema.parse({}),
  supportDesk: { ...SLP_DEFAULT_SUPPORT_DESK_SETTINGS },
  drama: slpDramaSettingsSchema.parse({}),
  polyamory: false,
  paused: false,
  nightQuiet: false,
  onboarding: "not_started",
};

/**
 * A persona's own Slurp identity, provisioned so its likes and replies have an author.
 *
 * It is not a Creator: it has no stage profile, no disclosure mode, and nobody authored it. Listing
 * it as one put every persona that ever tapped a heart into the Creator profiles list as "Setup
 * Needed", and into every other viewer's Discover as a browsable Creator. A Creator stage profile
 * is always written with `invited: false`; only these actor accounts are an invited persona.
 */
export function isSlurpViewerActorAccount(account: Pick<SlurpAccount, "invited" | "kind">): boolean {
  return account.invited === true && account.kind === "persona";
}

// The world tick reads settings many times per pass; a full zod parse each time held the Engine's
// event loop for seconds. Stored settings arrive as a JSON string (null before the first save), so
// the last one is the cache key. Callers get a clone because some of them build on the result.
let cachedSettingsRaw: string | null = null;
let cachedSettings: SlurpSettings | null = null;

/**
 * Keys retired in fix phase 1b (R1-136): nothing read them. Stored copies are safe: the normalizer
 * takes only known keys, the PATCH schema strips unknown ones, and the next save drops them. Listed
 * so a test can prove old data still loads.
 */
export const SLURP_RETIRED_SETTINGS_KEYS = [
  "imageGenerationConnectionId",
  "invitedCharacterGroupIds",
  "includeCharacterSchedules",
  "enableEnhancedTimelineWriting",
  "participantSelectionMode",
  "participantMin",
  "participantMax",
] as const;

export function normalizeSlurpSettings(raw: unknown): SlurpSettings {
  if (typeof raw !== "string" && raw !== null) return normalizeSlurpSettingsUncached(raw);
  if (raw !== cachedSettingsRaw || !cachedSettings) {
    cachedSettings = normalizeSlurpSettingsUncached(raw);
    cachedSettingsRaw = raw;
  }
  return structuredClone(cachedSettings);
}

function normalizeSlurpSettingsUncached(raw: unknown): SlurpSettings {
  const rawRecord = parseRecord(raw);
  const candidate = Object.fromEntries(
    Object.entries(DEFAULT_SLURP_SETTINGS).map(([key, value]) => [key, rawRecord[key] ?? value]),
  ) as Record<keyof SlurpSettings, unknown>;
  candidate.generationGuidance =
    rawRecord.generationGuidance === LEGACY_SLP_CREATOR_DEFAULT_GENERATION_GUIDANCE ||
    rawRecord.generationGuidance === LEGACY_TYPO_SLURP_DEFAULT_GENERATION_GUIDANCE ||
    rawRecord.generationGuidance === LEGACY_SLURP_DEFAULT_GENERATION_GUIDANCE ||
    rawRecord.generationGuidance === LEGACY_STEAMY_SLURP_DEFAULT_GENERATION_GUIDANCE
      ? SLP_CREATOR_DEFAULT_GENERATION_GUIDANCE
      : rawRecord.generationGuidance === LEGACY_EXPLICIT_SLURP_DEFAULT_GENERATION_GUIDANCE
        ? SLURP_GUIDANCE_PRESETS.explicit
        : (rawRecord.generationGuidance ?? SLP_CREATOR_DEFAULT_GENERATION_GUIDANCE);
  candidate.imageGenerationPrompt =
    rawRecord.imageGenerationPrompt === undefined ||
    rawRecord.imageGenerationPrompt === "" ||
    rawRecord.imageGenerationPrompt === LEGACY_SLP_CREATOR_DEFAULT_IMAGE_GENERATION_PROMPT ||
    rawRecord.imageGenerationPrompt === LEGACY_GRAPHIC_SLP_CREATOR_DEFAULT_IMAGE_GENERATION_PROMPT
      ? SLP_CREATOR_DEFAULT_IMAGE_GENERATION_PROMPT
      : rawRecord.imageGenerationPrompt;
  const storedPromptInstructions = Array.isArray(rawRecord.promptInstructions) ? rawRecord.promptInstructions : null;
  candidate.promptInstructions = storedPromptInstructions
    ? storedPromptInstructions.map((instruction) => {
        if (!instruction || typeof instruction !== "object" || Array.isArray(instruction)) return instruction;
        const record = instruction as Record<string, unknown>;
        const isBuiltInImageInstruction =
          record.id === "image-style" &&
          (record.text === LEGACY_SLP_CREATOR_DEFAULT_IMAGE_GENERATION_PROMPT ||
            record.text === LEGACY_GRAPHIC_SLP_CREATOR_DEFAULT_IMAGE_GENERATION_PROMPT);
        return isBuiltInImageInstruction
          ? { ...record, text: SLP_CREATOR_DEFAULT_IMAGE_GENERATION_PROMPT }
          : instruction;
      })
    : [
        {
          id: "creator-voice",
          name: "Creator voice",
          text: candidate.generationGuidance as string,
          builtin: true,
        },
        {
          id: "image-style",
          name: "Image style",
          text: candidate.imageGenerationPrompt as string,
          builtin: true,
        },
      ];
  candidate.imagePromptInterpretation =
    rawRecord.imagePromptInterpretation === undefined ||
    rawRecord.imagePromptInterpretation === "" ||
    rawRecord.imagePromptInterpretation === LEGACY_SLP_CREATOR_DEFAULT_IMAGE_PROMPT_INTERPRETATION
      ? SLP_CREATOR_DEFAULT_IMAGE_PROMPT_INTERPRETATION
      : rawRecord.imagePromptInterpretation;
  // Present once migrated, even when empty. Until then the stored layouts are the Classic edits.
  candidate.classicPromptBlocks =
    rawRecord.classicPromptBlocks ?? slurpLegacyClassicPromptBlocks(rawRecord.promptBlocks);
  candidate.nightQuiet = rawRecord.nightQuiet ?? DEFAULT_SLURP_SETTINGS.nightQuiet;
  candidate.paused = rawRecord.paused === true;
  // Repaired rather than replaced: a player who edited one type must not lose the other seven
  // because a single field went out of range. An all-disabled list re-enables built-in Regular,
  // which is the one state the tick cannot run in — there would be nobody to pick.
  candidate.fanTypes = slurpNormalizeFanTypes(rawRecord.fanTypes ?? DEFAULT_SLURP_SETTINGS.fanTypes);
  // An empty list is a real choice; only a missing or non-array value falls back to the defaults.
  candidate.platformEvents = slurpNormalizePlatformEvents(rawRecord.platformEvents);
  // An untouched tag list gains the "look" group; an edited one is the player's and stays as it is.
  candidate.discoveryTags =
    JSON.stringify(rawRecord.discoveryTags) === JSON.stringify(LEGACY_SLURP_DISCOVERY_TAG_SEED)
      ? DEFAULT_SLURP_SETTINGS.discoveryTags
      : (rawRecord.discoveryTags ?? DEFAULT_SLURP_SETTINGS.discoveryTags);
  candidate.arcLibrary = slurpNormalizeArcLibrary(rawRecord.arcLibrary, rawRecord.arcAllowedKinds);
  // Packs that are on join both libraries, packs that are off leave them (Backstage › Packs).
  candidate.contentPacks = readSlurpContentPackToggles(rawRecord.contentPacks);
  ({ arcs: candidate.arcLibrary, events: candidate.platformEvents } = slurpApplyContentPacks({
    arcs: candidate.arcLibrary as SlpArcBlueprint[],
    events: candidate.platformEvents as SlurpPlatformEvent[],
    toggles: candidate.contentPacks as Record<string, boolean>,
    maxArcs: SLURP_ARC_LIBRARY_MAX,
    maxEvents: SLURP_PLATFORM_EVENTS_MAX,
  }));
  candidate.onboarding = rawRecord.onboarding ?? DEFAULT_SLURP_SETTINGS.onboarding;
  candidate.postsPerDayCustom = slurpPostsPerDayIsCustom(rawRecord);
  // A partial or older value keeps the balanced weight for every job it does not name.
  candidate.storyJobs = { ...DEFAULT_SLURP_SETTINGS.storyJobs, ...parseRecord(rawRecord.storyJobs) };
  // A partial or older value keeps the default for every field it does not name.
  candidate.supportDesk = normalizeSlpSupportDeskSettings(rawRecord.supportDesk);
  candidate.fanArchetypeWeights = {
    ...DEFAULT_SLURP_SETTINGS.fanArchetypeWeights,
    ...parseRecord(rawRecord.fanArchetypeWeights),
  };
  const settings: Record<string, unknown> = { ...DEFAULT_SLURP_SETTINGS };
  for (const key of Object.keys(DEFAULT_SLURP_SETTINGS) as Array<keyof SlurpSettings>) {
    const parsed = slurpSettingsSchema.shape[key].safeParse(candidate[key]);
    if (parsed.success) settings[key] = parsed.data;
    else logger.warn("Slurp setting %s was invalid; using its default", key);
  }
  return slurpSettingsSchema.parse(settings);
}
