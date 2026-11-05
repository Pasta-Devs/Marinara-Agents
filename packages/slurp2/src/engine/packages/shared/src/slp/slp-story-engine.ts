import { z } from "zod";
import { slpDramaSchema, slpSituationSchema } from "./slp-drama.js";
import { slpWardrobeLookInputSchema } from "./slp-wardrobe.js";

export const SLP_STORY_PACK_FORMAT = "marinara-slurp-story-pack" as const;
export const SLP_STORY_PACK_SCHEMA_VERSION = 1 as const;
export const SLP_STORY_PACK_MAX_BYTES = 1_048_576;
export const SLP_STORY_PACK_MAX_ENTRIES = 100;

const id = (max = 128) => z.string().trim().min(1).max(max);
const tag = z.string().trim().min(1).max(64);
const tags = z.array(tag).max(50).default([]);

export const slpStoryAutomationSchema = z.enum(["inherit", "manual", "suggest", "auto"]);
export type SlpStoryAutomation = z.infer<typeof slpStoryAutomationSchema>;

export const slpStoryProvenanceSchema = z
  .object({
    packId: id(),
    contentId: id(),
    packVersion: id(32),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict();
export type SlpStoryProvenance = z.infer<typeof slpStoryProvenanceSchema>;

export const SLP_INFLUENCE_TARGETS = [
  "audience.growth",
  "economy.creator-earnings",
  "audience.loyalty",
  "economy.subscription-price",
  "feed.reach",
  "feed.posting-rate",
  "audience.activity",
  "messages.reply-delay",
] as const;
export const slpInfluenceTargetSchema = z.enum(SLP_INFLUENCE_TARGETS);
export type SlpInfluenceTarget = z.infer<typeof slpInfluenceTargetSchema>;

export const slpInfluenceDraftSchema = z
  .object({
    target: slpInfluenceTargetSchema,
    operation: z.enum(["multiply", "add"]),
    value: z.number().finite(),
  })
  .strict()
  .superRefine((effect, context) => {
    const multiplyMinimum = effect.target === "economy.subscription-price" ? 0 : 0.25;
    if (effect.operation === "multiply" && (effect.value < multiplyMinimum || effect.value > 4)) {
      context.addIssue({ code: "custom", path: ["value"], message: `Use a multiplier from ${multiplyMinimum} to 4.` });
    }
    if (effect.operation === "add") {
      const price = effect.target === "economy.subscription-price";
      if (!price || effect.value < -9999 || effect.value > 9999)
        context.addIssue({
          code: "custom",
          path: ["value"],
          message: price
            ? "Use a flat price change from -9999 to 9999."
            : "Only subscription price supports a flat change.",
        });
    }
  });
export type SlpInfluenceDraft = z.infer<typeof slpInfluenceDraftSchema>;

/**
 * What a Creator's life is like right now, on one track (docs/STORYLINES.md, "State"). A track holds
 * one condition at a time; a fact without a track is only a tag, as before.
 */
export const SLP_STORY_TRACKS = ["body", "love", "family", "home", "work", "public"] as const;
export type SlpStoryTrack = (typeof SLP_STORY_TRACKS)[number];
export const SLP_STORY_LINE_MAX = 160;
export const SLP_STORY_LOOK_MAX = 120;
export const SLP_STORY_DECK_MAX = 12;
export const SLP_STORY_SHARE_MAX = 0.5;
export const SLP_STORY_DEFAULT_SHARE = 0.25;

/** The optional condition parts a creator fact may carry. Stored facts without them stay valid. */
export const slpStoryConditionFields = {
  track: z.enum(SLP_STORY_TRACKS).optional(),
  /** For the writer, in second person: "You are six months pregnant." */
  line: z.string().trim().min(1).max(SLP_STORY_LINE_MAX).optional(),
  /** For pictures: "visibly pregnant, about six months". */
  look: z.string().trim().min(1).max(SLP_STORY_LOOK_MAX).optional(),
  /** Wardrobe tags to prefer and to leave out while it lasts. */
  wardrobe: z
    .object({ prefer: z.array(tag).max(6).default([]), avoid: z.array(tag).max(6).default([]) })
    .strict()
    .optional(),
  /** Small moments a post may be about while it lasts. */
  deck: z
    .array(
      z
        .object({ line: z.string().trim().min(1).max(SLP_STORY_LINE_MAX), withPartner: z.boolean().optional() })
        .strict(),
    )
    .max(SLP_STORY_DECK_MAX)
    .optional(),
  /** The chance an ordinary post takes a deck moment. */
  share: z.number().min(0).max(SLP_STORY_SHARE_MAX).optional(),
};

export const slpStoryOutcomeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("add-creator-fact"),
      tag,
      label: id(120),
      expiresAfterDays: z.number().int().min(1).max(3650).optional(),
      ...slpStoryConditionFields,
    })
    .strict(),
  z.object({ kind: z.literal("remove-creator-fact"), tag }).strict(),
  z
    .object({
      kind: z.literal("add-world-fact"),
      tag,
      label: id(120),
      expiresAfterDays: z.number().int().min(1).max(3650).optional(),
    })
    .strict(),
  z.object({ kind: z.literal("remove-world-fact"), tag }).strict(),
  z
    .object({
      kind: z.literal("grant-arc-opportunity"),
      storyTags: z.array(tag).min(1).max(20),
      weight: z.number().min(0.1).max(10).default(2),
      expiresAfterDays: z.number().int().min(1).max(3650).optional(),
      consume: z.enum(["on-start", "never"]).default("on-start"),
    })
    .strict(),
  /** A look joins the Creator's closet, with the storyline as its source (docs/STORYLINES.md, PR 5c). */
  z.object({ kind: z.literal("add-look"), look: slpWardrobeLookInputSchema }).strict(),
  /** Takes away a look a storyline gave, by name; the player's own looks stay. */
  z.object({ kind: z.literal("remove-look"), name: z.string().trim().min(1).max(80) }).strict(),
  /** A brand whose name, category or product shares these words offers the Creator a deal (PR 6). */
  z
    .object({ kind: z.literal("brand-offer"), words: z.array(z.string().trim().min(1).max(40)).min(1).max(12) })
    .strict(),
]);
export type SlpStoryOutcome = z.infer<typeof slpStoryOutcomeSchema>;

export const slpArcOpportunitySchema = z
  .object({ storyTags: z.array(tag).min(1).max(20), weight: z.number().min(0.1).max(10).default(2) })
  .strict();

const arcBranchChapterSchema = z
  .object({ label: id(200), minDays: z.number().int().min(0).max(90), maxDays: z.number().int().min(0).max(90) })
  .strict();
const arcChoiceSchema = z
  .object({
    question: id(240),
    options: z
      .array(z.object({ label: id(120), chapters: z.array(arcBranchChapterSchema).max(4) }).strict())
      .min(2)
      .max(4),
  })
  .strict();
const arcEffectsSchema = z
  .object({
    growth: z.number().int().min(-50).max(50).optional(),
    earnings: z.number().int().min(-50).max(50).optional(),
    loyalty: z.number().int().min(-50).max(50).optional(),
  })
  .strict();

export const slpArcBlueprintSchema = z
  .object({
    id: id(),
    contentId: id().optional(),
    name: id(80),
    description: z.string().trim().max(2000),
    chapters: z
      .array(
        z
          .object({
            label: id(200),
            minDays: z.number().int().min(0).max(90),
            maxDays: z.number().int().min(0).max(90),
            choice: arcChoiceSchema.optional(),
            mood: z
              .enum([
                "just_posted",
                "post_landed",
                "post_flopped",
                "afterglow",
                "overexposed",
                "paid_well",
                "goal_hit",
                "lapse_sting",
                "tipsy",
                "tired",
                "rattled",
              ])
              .optional(),
            effects: arcEffectsSchema.optional(),
            profile: z
              .object({ bio: z.string().trim().max(500).optional(), location: z.string().trim().max(120).optional() })
              .strict()
              .optional(),
            storyTags: tags.optional(),
            influences: z.array(slpInfluenceDraftSchema).max(16).default([]),
            outcomes: z.array(slpStoryOutcomeSchema).max(16).default([]),
            opportunities: z.array(slpArcOpportunitySchema).max(8).default([]),
          })
          .strict(),
      )
      .max(12),
    revertProfileAtEnd: z.boolean().optional(),
    /** A life event a Creator has only once (moving, a new job): never started automatically again. */
    once: z.boolean().optional(),
    tags,
    storyTags: tags,
    tone: z.string().trim().max(80).default(""),
    durationDays: z.number().int().min(1).max(365).default(14),
    enabled: z.boolean().default(true),
    builtin: z.boolean().default(false),
    hidden: z.boolean().default(false),
    automation: slpStoryAutomationSchema.default("inherit"),
    provenance: slpStoryProvenanceSchema.optional(),
  })
  .strict();
export type SlpArcBlueprint = z.infer<typeof slpArcBlueprintSchema>;

export const slpEventActivationSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("annual"),
      month: z.number().int().min(1).max(12),
      day: z.number().int().min(1).max(31),
      durationDays: z.number().int().min(1).max(31),
    })
    .strict(),
  z
    .object({
      kind: z.literal("window"),
      startsAt: z.string().datetime({ offset: true }),
      endsAt: z.string().datetime({ offset: true }),
    })
    .strict(),
  z.object({ kind: z.literal("manual"), durationDays: z.number().int().min(1).max(365) }).strict(),
  z
    .object({
      kind: z.literal("creator-milestone"),
      metric: z.enum(["followers", "subscribers", "lifetime-earnings"]),
      threshold: z.number().int().min(1),
      durationDays: z.number().int().min(1).max(365),
      cooldownDays: z.number().int().min(0).max(3650).default(0),
    })
    .strict(),
  z
    .object({
      kind: z.literal("notable-post"),
      reach: z.number().int().min(1),
      durationDays: z.number().int().min(1).max(365),
      cooldownDays: z.number().int().min(0).max(3650).default(0),
    })
    .strict(),
  z
    .object({
      kind: z.literal("arc-lifecycle"),
      phase: z.enum(["start", "chapter", "complete"]),
      storyTags: z.array(tag).min(1).max(20),
      durationDays: z.number().int().min(1).max(365),
      cooldownDays: z.number().int().min(0).max(3650).default(0),
    })
    .strict(),
  z
    .object({
      kind: z.literal("periodic"),
      period: z.enum(["daily", "weekly"]),
      chancePercent: z.number().min(0.1).max(100),
      durationDays: z.number().int().min(1).max(365),
      cooldownDays: z.number().int().min(0).max(3650).default(0),
    })
    .strict(),
]);
export type SlpEventActivation = z.infer<typeof slpEventActivationSchema>;

const tagFilterSchema = z
  .object({ mode: z.enum(["any", "all"]), tags: z.array(tag).min(1).max(50) })
  .strict()
  .optional();
export const slpEventTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }).strict(),
  z.object({ kind: z.literal("tags"), mode: z.enum(["any", "all"]), tags: z.array(tag).min(1).max(50) }).strict(),
  z.object({ kind: z.literal("selected"), creatorIds: z.array(id()).min(1).max(100) }).strict(),
  z
    .object({
      kind: z.literal("random"),
      min: z.number().int().min(1).max(100),
      max: z.number().int().min(1).max(100),
      filter: tagFilterSchema,
    })
    .strict(),
]);
export type SlpEventTarget = z.infer<typeof slpEventTargetSchema>;

export const slpEventBlueprintSchema = z
  .object({
    id: id(64),
    contentId: id().optional(),
    name: id(60),
    enabled: z.boolean().default(true),
    guidance: z.string().trim().max(600).default(""),
    storyTags: tags,
    activation: slpEventActivationSchema,
    target: slpEventTargetSchema.default({ kind: "all" }),
    influences: z.array(slpInfluenceDraftSchema).max(16).default([]),
    arcOpportunities: z.array(slpArcOpportunitySchema).max(8).default([]),
    outcomes: z.array(slpStoryOutcomeSchema).max(16).default([]),
    automation: slpStoryAutomationSchema.default("inherit"),
    builtin: z.boolean().default(false),
    hidden: z.boolean().default(false),
    provenance: slpStoryProvenanceSchema.optional(),
  })
  .strict();
export type SlpEventBlueprint = z.infer<typeof slpEventBlueprintSchema>;

export const slpStoryPackSchema = z
  .object({
    format: z.literal(SLP_STORY_PACK_FORMAT),
    schemaVersion: z.literal(SLP_STORY_PACK_SCHEMA_VERSION),
    id: id(),
    version: id(32),
    name: id(100),
    description: z.string().trim().max(1000),
    author: z.string().trim().min(1).max(100).optional(),
    arcs: z.array(slpArcBlueprintSchema).max(SLP_STORY_PACK_MAX_ENTRIES).default([]),
    events: z.array(slpEventBlueprintSchema).max(SLP_STORY_PACK_MAX_ENTRIES).default([]),
    /** Drama (`docs/DRAMA.md`): standing situations and dramas with a cast. Optional; older packs have none. */
    situations: z.array(slpSituationSchema).max(20).default([]),
    dramas: z.array(slpDramaSchema).max(40).default([]),
  })
  .strict()
  .superRefine((pack, context) => {
    if (
      pack.arcs.length + pack.events.length + pack.situations.length + pack.dramas.length >
      SLP_STORY_PACK_MAX_ENTRIES
    )
      context.addIssue({
        code: "custom",
        path: ["arcs"],
        message: `A pack may contain at most ${SLP_STORY_PACK_MAX_ENTRIES} entries.`,
      });
  });
export type SlpStoryPack = z.infer<typeof slpStoryPackSchema>;

export const slpEventOccurrenceSchema = z
  .object({
    id: id(),
    blueprintId: id(64),
    activationKey: id(256),
    blueprint: slpEventBlueprintSchema,
    participantIds: z.array(id()).max(100),
    status: z.enum(["suggested", "active", "completed", "dismissed", "cancelled"]),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    createdAt: z.string().datetime({ offset: true }),
    triggerEvidence: z.string().trim().max(500).default(""),
  })
  .strict();
export type SlpEventOccurrence = z.infer<typeof slpEventOccurrenceSchema>;

/** A condition the player sets by hand in the Life panel: one track, until removed or for some days. */
export const slpStoryConditionInputSchema = z
  .object({
    label: id(120),
    tag: tag.optional(),
    days: z.number().int().min(1).max(3650).nullable().default(null),
    ...slpStoryConditionFields,
    track: z.enum(SLP_STORY_TRACKS),
  })
  .strict();
export type SlpStoryConditionInput = z.input<typeof slpStoryConditionInputSchema>;

export const slpStoryFactSchema = z
  .object({
    id: id(),
    scope: z.enum(["creator", "world"]),
    creatorId: id().optional(),
    tag,
    label: id(120),
    /** `player`: set by hand in the Life panel. */
    sourceKind: z.enum(["arc", "event", "drama", "player"]),
    sourceId: id(),
    createdAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }).nullable(),
    ...slpStoryConditionFields,
  })
  .strict();
export type SlpStoryFact = z.infer<typeof slpStoryFactSchema>;

export const slpArcOpportunityRecordSchema = z
  .object({
    id: id(),
    creatorId: id(),
    storyTags: z.array(tag).min(1).max(20),
    weight: z.number().min(0.1).max(10),
    consume: z.enum(["on-start", "never"]),
    sourceKind: z.enum(["arc", "event", "drama"]),
    sourceId: id(),
    createdAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();
export type SlpArcOpportunityRecord = z.infer<typeof slpArcOpportunityRecordSchema>;

export type SlpStoryCalendarItem = {
  id: string;
  kind: "occasion" | "plan" | "occurrence";
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "suggested" | "active" | "paused" | "completed" | "dismissed" | "cancelled";
  sourceId: string;
};

export type SlpInfluenceSourceRef = { kind: "platform-event" | "arc-chapter"; id: string; label: string };
export type SlpInfluence = SlpInfluenceDraft & { source: SlpInfluenceSourceRef };
export type SlpInfluenceSubject = { creatorId: string; tags?: readonly string[] };
export type SlpActiveInfluenceProvider = {
  influencesFor(target: SlpInfluenceTarget, at: Date, subject: SlpInfluenceSubject): SlpInfluence[];
};
