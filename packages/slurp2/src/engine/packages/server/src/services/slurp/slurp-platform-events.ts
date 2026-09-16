/**
 * Platform events: holidays and site-wide happenings that colour what Creators post and say.
 *
 * Pure, like the other Slurp rule modules. An event recurs every year on a month and day and runs
 * for a number of days. While one is running, its guidance rides into post and message prompts.
 * Day boundaries are UTC, matching every other dated key in Slurp.
 */
import { z } from "zod";

/** Longest guidance an event may carry. It rides in every post and reply prompt while active. */
export const SLURP_PLATFORM_EVENT_GUIDANCE_MAX = 600;

export const slurpPlatformEventSchema = z.object({
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(60),
  enabled: z.boolean().default(true),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  durationDays: z.number().int().min(1).max(31).default(1),
  guidance: z.string().trim().max(SLURP_PLATFORM_EVENT_GUIDANCE_MAX).default(""),
});

export type SlurpPlatformEvent = z.infer<typeof slurpPlatformEventSchema>;

export const slurpPlatformEventsSchema = z.array(slurpPlatformEventSchema).max(100);

const event = (id: string, name: string, month: number, day: number, durationDays: number, guidance: string) =>
  slurpPlatformEventSchema.parse({ id, name, month, day, durationDays, guidance });

export function slurpPlatformEventsDefault(): SlurpPlatformEvent[] {
  return [
    event(
      "new-year",
      "New Year",
      1,
      1,
      1,
      "It is New Year's Day. Resolutions, fresh starts, and a slow morning after the party.",
    ),
    event(
      "valentines",
      "Valentine's Day",
      2,
      14,
      1,
      "It is Valentine's Day. Romance, gifts, and fans hoping for something special.",
    ),
    event(
      "april-fools",
      "April Fools' Day",
      4,
      1,
      1,
      "It is April Fools' Day. Playful teasing and harmless pranks fit today.",
    ),
    event(
      "summer-kickoff",
      "Summer kickoff",
      6,
      21,
      3,
      "Summer has just started. Heat, sun, outdoor plans, and lighter outfits.",
    ),
    event(
      "halloween",
      "Halloween",
      10,
      25,
      7,
      "Halloween week. Costumes, spooky themes, and dressing up are on everybody's mind.",
    ),
    event(
      "black-friday",
      "Black Friday sale",
      11,
      27,
      4,
      "The site-wide Black Friday promo is running. Creators mention deals and discounts.",
    ),
    event(
      "christmas",
      "Christmas",
      12,
      20,
      7,
      "The Christmas holidays. Festive outfits, gifts, cosy nights, and family plans.",
    ),
    event(
      "new-years-eve",
      "New Year's Eve",
      12,
      31,
      1,
      "It is New Year's Eve. Parties, countdowns, and looking back on the year.",
    ),
  ];
}

/** Parse leniently: drop broken entries instead of losing the whole list. */
export function slurpNormalizePlatformEvents(raw: unknown): SlurpPlatformEvent[] {
  if (!Array.isArray(raw)) return slurpPlatformEventsDefault();
  return raw.flatMap((entry) => {
    const parsed = slurpPlatformEventSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

const DAY = 86_400_000;

/** Events running on `at`. An event that starts late in December runs on into January. */
export function slurpActivePlatformEvents(events: readonly SlurpPlatformEvent[], at: Date): SlurpPlatformEvent[] {
  const today = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  return events.filter((item) => {
    if (!item.enabled) return false;
    // Check this year's and last year's start, so a wrap across New Year still matches.
    return [0, -1].some((offset) => {
      const start = Date.UTC(at.getUTCFullYear() + offset, item.month - 1, item.day);
      return today >= start && today < start + item.durationDays * DAY;
    });
  });
}

/** One prompt block for the running events. Null when nothing is on, because a normal day is not news. */
export function slurpPlatformEventInstruction(events: readonly SlurpPlatformEvent[], at: Date): string | null {
  const active = slurpActivePlatformEvents(events, at);
  if (active.length === 0) return null;
  const lines = active.map((item) => `- ${item.name}${item.guidance ? `: ${item.guidance}` : ""}`);
  return [
    "Platform events running today. Let them colour the content where it fits the Creator; do not force them into every line.",
    ...lines,
  ].join("\n");
}
