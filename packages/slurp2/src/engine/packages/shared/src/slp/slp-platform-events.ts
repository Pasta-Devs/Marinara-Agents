/**
 * Platform events: holidays and site-wide happenings that colour what Creators post and say.
 *
 * Pure, like the other Slurp rule modules. An event recurs every year on a month and day and runs
 * for a number of days. While one is running, its guidance rides into post and message prompts.
 * Day boundaries are UTC, matching every other dated key in Slurp.
 */
import { z } from "zod";

import { slpModifierDraftsSchema, slpNormalizeModifierDrafts } from "./slp-modifier-schema.js";
import type { SlpModifier, SlpModifierSource } from "./slp-modifier.types.js";

/** Longest guidance an event may carry. It rides in every post and reply prompt while active. */
export const SLURP_PLATFORM_EVENT_GUIDANCE_MAX = 600;

/**
 * How an event decides whether it is running. Only a calendar event exists today; the kind is on
 * the record so a later kind (a one-off dated window, say) does not have to reinterpret
 * `month`/`day`/`durationDays`, and so an old saved row keeps meaning what it meant.
 */
export const slurpPlatformEventKindSchema = z.enum(["calendar"]);
export type SlurpPlatformEventKind = z.infer<typeof slurpPlatformEventKindSchema>;

export const slurpPlatformEventSchema = z.object({
  id: z.string().trim().min(1).max(64),
  kind: slurpPlatformEventKindSchema.default("calendar"),
  name: z.string().trim().min(1).max(60),
  enabled: z.boolean().default(true),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  durationDays: z.number().int().min(1).max(31).default(1),
  guidance: z.string().trim().max(SLURP_PLATFORM_EVENT_GUIDANCE_MAX).default(""),
  // Defaulted, so every event saved before this field existed still parses, with no effect.
  modifiers: slpModifierDraftsSchema.default([]),
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

/**
 * Parse leniently: drop broken entries instead of losing the whole list.
 *
 * A broken modifier is dropped on its own, before the event is parsed, so one bad modifier costs
 * neither its event nor the list. A broken event is still dropped whole, as before.
 */
export function slurpNormalizePlatformEvents(raw: unknown): SlurpPlatformEvent[] {
  if (!Array.isArray(raw)) return slurpPlatformEventsDefault();
  return raw.flatMap((entry) => {
    const cleaned =
      entry && typeof entry === "object" && "modifiers" in entry
        ? { ...entry, modifiers: slpNormalizeModifierDrafts((entry as { modifiers?: unknown }).modifiers) }
        : entry;
    const parsed = slurpPlatformEventSchema.safeParse(cleaned);
    return parsed.success ? [parsed.data] : [];
  });
}

const DAY = 86_400_000;

/** A calendar event recurs every year on its month and day. The arithmetic is unchanged. */
function isCalendarEventActive(item: SlurpPlatformEvent, at: Date): boolean {
  const today = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  // Check this year's and last year's start, so a wrap across New Year still matches.
  return [0, -1].some((offset) => {
    const start = Date.UTC(at.getUTCFullYear() + offset, item.month - 1, item.day);
    return today >= start && today < start + item.durationDays * DAY;
  });
}

/**
 * One activation rule per kind. A new kind adds a row here and nothing else: the callers below,
 * the prompt guidance, and the modifier source all go through this table.
 */
const ACTIVATION_BY_KIND: Record<SlurpPlatformEventKind, (item: SlurpPlatformEvent, at: Date) => boolean> = {
  calendar: isCalendarEventActive,
};

/** Events running on `at`. An event that starts late in December runs on into January. */
export function slurpActivePlatformEvents(events: readonly SlurpPlatformEvent[], at: Date): SlurpPlatformEvent[] {
  return events.filter((item) => item.enabled && ACTIVATION_BY_KIND[item.kind](item, at));
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

/**
 * The modifiers the running events ask for, each stamped with the event that owns it.
 *
 * Nothing is written anywhere. An event that starts does not rewrite a Creator's price or anyone's
 * wallet, and an event that ends needs no cleanup — the answer is simply re-derived from the current
 * settings and the current time, which is what makes it restart-safe and makes two overlapping
 * events resolve the same way every time.
 */
export function slurpActivePlatformEventModifiers(events: readonly SlurpPlatformEvent[], at: Date): SlpModifier[] {
  return slurpActivePlatformEvents(events, at).flatMap((item) =>
    item.modifiers.map((effect) => ({ ...effect, source: { kind: "platform-event" as const, id: item.id } })),
  );
}

/**
 * World's side of the modifier seam: the source a provider is built from. The event list is bound
 * once, and the evaluation time still arrives per call, so the caller keeps control of the clock.
 */
export function slurpPlatformEventModifierSource(events: readonly SlurpPlatformEvent[]): SlpModifierSource {
  return (at) => slurpActivePlatformEventModifiers(events, at);
}
