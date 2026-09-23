/** Portable event blueprints plus legacy calendar migration helpers. */
import { z } from "zod";

import {
  slpEventBlueprintSchema,
  slpInfluenceDraftSchema,
  type SlpEventBlueprint,
  type SlpInfluence,
} from "./slp-story-engine.js";
import type { SlpModifier, SlpModifierSource } from "./slp-modifier.types.js";

export const SLURP_PLATFORM_EVENT_GUIDANCE_MAX = 600;
export const slurpPlatformEventSchema = slpEventBlueprintSchema;
export const slurpPlatformEventsSchema = z.array(slpEventBlueprintSchema).max(100);
export type SlurpPlatformEvent = SlpEventBlueprint;

const coreProvenance = (contentId: string) => ({
  packId: "slurp-core-calendar",
  contentId,
  packVersion: "1.0.0",
  contentHash: "0".repeat(64),
});

const annual = (id: string, name: string, month: number, day: number, durationDays: number, guidance: string) =>
  slpEventBlueprintSchema.parse({
    id,
    contentId: id,
    name,
    guidance,
    enabled: true,
    builtin: true,
    activation: { kind: "annual", month, day, durationDays },
    target: { kind: "all" },
    provenance: coreProvenance(id),
  });

export function slurpPlatformEventsDefault(): SlurpPlatformEvent[] {
  return [
    annual(
      "new-year",
      "New Year",
      1,
      1,
      1,
      "It is New Year's Day. Resolutions, fresh starts, and a slow morning after the party.",
    ),
    annual(
      "valentines",
      "Valentine's Day",
      2,
      14,
      1,
      "It is Valentine's Day. Romance, gifts, and fans hoping for something special.",
    ),
    annual(
      "april-fools",
      "April Fools' Day",
      4,
      1,
      1,
      "It is April Fools' Day. Playful teasing and harmless pranks fit today.",
    ),
    annual(
      "summer-kickoff",
      "Summer kickoff",
      6,
      21,
      3,
      "Summer has just started. Heat, sun, outdoor plans, and lighter outfits.",
    ),
    annual(
      "halloween",
      "Halloween",
      10,
      25,
      7,
      "Halloween week. Costumes, spooky themes, and dressing up are on everybody's mind.",
    ),
    annual(
      "black-friday",
      "Black Friday sale",
      11,
      27,
      4,
      "The site-wide Black Friday promo is running. Creators mention deals and discounts.",
    ),
    annual(
      "christmas",
      "Christmas",
      12,
      20,
      7,
      "The Christmas holidays. Festive outfits, gifts, cosy nights, and family plans.",
    ),
    annual(
      "new-years-eve",
      "New Year's Eve",
      12,
      31,
      1,
      "It is New Year's Eve. Parties, countdowns, and looking back on the year.",
    ),
  ];
}

function migrateLegacyEvent(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const raw = value as Record<string, unknown>;
  if (raw.activation) return raw;
  if (raw.kind !== "calendar" && raw.month === undefined) return raw;
  const builtin = slurpPlatformEventsDefault().some((item) => item.id === raw.id);
  return {
    id: raw.id,
    contentId: raw.id,
    name: raw.name,
    enabled: raw.enabled,
    guidance: raw.guidance,
    activation: { kind: "annual", month: raw.month, day: raw.day, durationDays: raw.durationDays },
    target: { kind: "all" },
    influences: Array.isArray(raw.modifiers) ? raw.modifiers : [],
    storyTags: [],
    arcOpportunities: [],
    outcomes: [],
    automation: "inherit",
    builtin,
    hidden: false,
    ...(builtin ? { provenance: coreProvenance(String(raw.id)) } : {}),
  };
}

/**
 * Saved settings are repaired, not rejected: one influence the current build no longer understands
 * must not delete the player's whole event. Pack import stays strict — it parses the blueprint
 * schema directly, so an unknown target there is still an error the preview reports.
 */
function dropUnknownInfluences(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.influences)) return raw;
  return { ...raw, influences: raw.influences.filter((item) => slpInfluenceDraftSchema.safeParse(item).success) };
}

export function slurpNormalizePlatformEvents(raw: unknown): SlurpPlatformEvent[] {
  if (!Array.isArray(raw)) return slurpPlatformEventsDefault();
  return raw.flatMap((entry) => {
    const migrated = migrateLegacyEvent(entry);
    const parsed = slpEventBlueprintSchema.safeParse(migrated);
    if (parsed.success) return [parsed.data];
    const repaired = slpEventBlueprintSchema.safeParse(dropUnknownInfluences(migrated));
    return repaired.success ? [repaired.data] : [];
  });
}

const DAY = 86_400_000;

function isAnnualActive(item: SlurpPlatformEvent, at: Date): boolean {
  if (item.activation.kind !== "annual") return false;
  const today = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  return [0, -1].some((offset) => {
    const start = Date.UTC(at.getUTCFullYear() + offset, item.activation.month - 1, item.activation.day);
    return today >= start && today < start + item.activation.durationDays * DAY;
  });
}

function isWindowActive(item: SlurpPlatformEvent, at: Date): boolean {
  return (
    item.activation.kind === "window" &&
    Date.parse(item.activation.startsAt) <= at.getTime() &&
    at.getTime() < Date.parse(item.activation.endsAt)
  );
}

/** Derived date events. Triggered/manual events become active through stored occurrences. */
export function slurpActivePlatformEvents(events: readonly SlurpPlatformEvent[], at: Date): SlurpPlatformEvent[] {
  return events.filter((item) => item.enabled && (isAnnualActive(item, at) || isWindowActive(item, at)));
}

/**
 * Whether an occasion applies to one Creator. Only "all" used to count, so an occasion aimed at
 * selected Creators, tags, or a random subset reached no prompt while its row said "Running now".
 * ponytail: "random" is a stable coin flip per occasion and Creator, not an exact min–max count;
 * pick exact members from the Creator list if the count ever matters.
 */
function slurpPlatformEventTargets(
  item: SlurpPlatformEvent,
  creator: { id: string; tags?: readonly string[] } | undefined,
): boolean {
  const target = item.target;
  if (target.kind === "all") return true;
  if (!creator) return false;
  if (target.kind === "selected") return target.creatorIds.includes(creator.id);
  const tags = new Set((creator.tags ?? []).map((value) => value.toLowerCase()));
  const matches = (filter: { mode: "any" | "all"; tags: readonly string[] }) =>
    filter.mode === "all"
      ? filter.tags.every((value) => tags.has(value.toLowerCase()))
      : filter.tags.some((value) => tags.has(value.toLowerCase()));
  if (target.kind === "tags") return matches(target);
  if (target.filter && !matches(target.filter)) return false;
  let hash = 0;
  for (const char of `${item.id}:${creator.id}`) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return (hash & 1) === 0;
}

/** Story-engine state the prompt reads. Structural, so this shared module needs no server types. */
export type SlurpStoryPromptState = {
  occurrences: readonly {
    blueprintId: string;
    status: string;
    startsAt: string;
    endsAt: string;
    participantIds: readonly string[];
    blueprint: { name: string; guidance?: string };
  }[];
  facts: readonly { scope: "creator" | "world"; creatorId?: string; label: string; expiresAt: string | null }[];
};

/**
 * Occasions and story facts running for one Creator, as prompt text.
 *
 * An occasion with an occurrence is decided by that occurrence: its status carries the automation
 * choice (suggested, dismissed, and manual ones do not run until started) and its participant list
 * carries the target. Only occasions the story engine has not scheduled yet fall back to their date
 * and target, so a fresh install still gets its holidays.
 */
export function slurpPlatformEventInstruction(
  events: readonly SlurpPlatformEvent[],
  at: Date,
  creator?: { id: string; tags?: readonly string[] },
  story?: SlurpStoryPromptState,
): string | null {
  const now = at.getTime();
  const current = (story?.occurrences ?? []).filter(
    (item) => Date.parse(item.startsAt) <= now && now < Date.parse(item.endsAt),
  );
  const decided = new Set(current.map((item) => item.blueprintId));
  const lines = [
    ...slurpActivePlatformEvents(events, at)
      .filter((item) => !decided.has(item.id) && slurpPlatformEventTargets(item, creator))
      .map((item) => `- ${item.name}${item.guidance ? `: ${item.guidance}` : ""}`),
    ...current
      .filter(
        (item) =>
          item.status === "active" &&
          (item.participantIds.length === 0 || (creator && item.participantIds.includes(creator.id))),
      )
      .map((item) => `- ${item.blueprint.name}${item.blueprint.guidance ? `: ${item.blueprint.guidance}` : ""}`),
  ];
  const facts = (story?.facts ?? [])
    .filter(
      (fact) =>
        (fact.expiresAt === null || now < Date.parse(fact.expiresAt)) &&
        (fact.scope === "world" || (creator && fact.creatorId === creator.id)),
    )
    .slice(0, 12)
    .map((fact) => `- ${fact.label}`);
  if (lines.length === 0 && facts.length === 0) return null;
  return [
    ...(lines.length > 0
      ? [
          "Platform events running today. Let them colour the content where it fits the Creator; do not force them into every line.",
          ...lines,
        ]
      : []),
    ...(facts.length > 0 ? ["What has happened in this story world (facts to stay consistent with):", ...facts] : []),
  ].join("\n");
}

export function slurpActivePlatformInfluences(events: readonly SlurpPlatformEvent[], at: Date): SlpInfluence[] {
  return slurpActivePlatformEvents(events, at).flatMap((item) =>
    item.influences.map((effect) => ({
      ...effect,
      source: { kind: "platform-event" as const, id: item.id, label: item.name },
    })),
  );
}

/**
 * Product of the active "multiply" influences on one target. Occasions could set reply delay,
 * audience activity, and other targets in the editor, but only subscription price was ever read.
 */
export function slurpInfluenceMultiplier(
  events: readonly SlurpPlatformEvent[],
  at: Date,
  target: SlpInfluence["target"],
): number {
  return slurpActivePlatformInfluences(events, at)
    .filter((effect) => effect.target === target && effect.operation === "multiply")
    .reduce((product, effect) => product * effect.value, 1);
}

/** Compatibility adapter for the original subscription-price modifier seam. */
export function slurpActivePlatformEventModifiers(events: readonly SlurpPlatformEvent[], at: Date): SlpModifier[] {
  return slurpActivePlatformInfluences(events, at).flatMap((effect) =>
    effect.target === "economy.subscription-price"
      ? [
          {
            target: effect.target,
            operation: effect.operation,
            value: effect.value,
            source: { kind: "platform-event" as const, id: effect.source.id },
          },
        ]
      : [],
  );
}

export function slurpPlatformEventModifierSource(events: readonly SlurpPlatformEvent[]): SlpModifierSource {
  return (at) => slurpActivePlatformEventModifiers(events, at);
}
