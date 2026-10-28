import { z } from "zod";

const percent = z.number().int().min(0).max(100);
export const slpCreatorDetailsSchema = z
  .object({
    updatedAt: z.string().datetime(),
    emotion: z.enum([
      "content",
      "warm",
      "playful",
      "excited",
      "curious",
      "proud",
      "lonely",
      "anxious",
      "embarrassed",
      "irritated",
      "jealous",
      "hurt",
      "angry",
      "withdrawn",
    ]),
    intent: z.enum([
      "none",
      "invite_attention",
      "be_desired",
      "tease",
      "build_tension",
      "share",
      "sell_access",
      "promote_content",
      "request_custom",
      "reward_loyalty",
      "withdraw",
    ]),
    energy: percent,
    arousal: percent,
    exposure: percent,
    emotionIntensity: percent,
    modifiers: z
      .array(
        z
          .object({
            kind: z.enum([
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
            ]),
            until: z.string().datetime(),
            source: z.string().max(500),
          })
          .strict(),
      )
      .max(4),
  })
  .strict()
  .partial();
export const slpConversationDetailsSchema = z
  .object({
    updatedAt: z.string().datetime(),
    posture: z.enum([
      "open",
      "friendly",
      "playful",
      "teasing",
      "professional",
      "guarded",
      "distant",
      "defensive",
      "rejecting",
    ]),
    adultLevel: z.enum(["ordinary", "suggestive", "provocative", "intimate", "explicit"]),
    familiarity: percent,
    sexualComfort: percent,
    emotionalTrust: percent,
    respect: percent,
    resentment: percent,
    threadDesire: percent,
  })
  .strict()
  .partial();
export const slpMessageDetailsSchema = z
  .object({
    creatorState: slpCreatorDetailsSchema.optional(),
    threadState: slpConversationDetailsSchema.optional(),
    coolUntil: z.string().datetime().nullable().optional(),
    mood: z.number().int().min(-100).max(100).optional(),
    score: z.number().min(0).max(100).optional(),
    tier: z.enum(["stranger", "acquaintance", "regular", "favourite", "whale"]).optional(),
    strikes: z.number().int().min(0).max(100).optional(),
    spentCoins: z.number().int().min(0).max(1000000000).optional(),
    dayVibe: z.string().max(2000).nullable().optional(),
    audienceTone: z.enum(["warm", "mixed", "unfiltered"]).optional(),
    imageMode: z.enum(["friendly", "hostile", "none"]).optional(),
    availability: z
      .object({
        online: z.boolean().optional(),
        activity: z.string().max(500).nullable().optional(),
        minutesUntilOnline: z.number().int().min(0).max(10080).nullable().optional(),
      })
      .strict()
      .optional(),
    contributionPoints: z
      .record(z.string().min(1).max(100), z.number().min(-100).max(100))
      .refine((value) => Object.keys(value).length <= 30)
      .optional(),
  })
  .strict();
export type SlpMessageDetailsPatch = z.infer<typeof slpMessageDetailsSchema>;

export const slpDetailsOverridesSchema = slpMessageDetailsSchema.pick({
  score: true,
  tier: true,
  spentCoins: true,
  dayVibe: true,
  audienceTone: true,
  imageMode: true,
  availability: true,
  contributionPoints: true,
});
export type SlpDetailsOverrides = z.infer<typeof slpDetailsOverridesSchema>;

export function slpOverrideRapport<
  T extends { score: number; tier: string; contributions: Array<{ key: string; points: number }> },
>(rapport: T, overrides: SlpDetailsOverrides): T {
  return {
    ...rapport,
    ...(overrides.score === undefined ? {} : { score: overrides.score }),
    ...(overrides.tier === undefined ? {} : { tier: overrides.tier }),
    contributions: rapport.contributions.map((entry) => ({
      ...entry,
      points: overrides.contributionPoints?.[entry.key] ?? entry.points,
    })),
  };
}
