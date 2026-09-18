/**
 * Fan Types: what kind of person somebody in the audience is.
 *
 * Pure, like the other Slurp rule modules. The population used to scatter a person across three
 * places — an Engine archetype that only weighted actor selection, a spend tier from a private
 * weight table, traits from a flat bank, an active hour from a hash — and none of it was editable
 * or even visible. A Fan Type is all of that in one object the player owns.
 *
 * The eight built-ins reproduce the old behaviour in aggregate: their shares and budget ranges
 * average out to the 62/25/11/2 spend mix and the 0 / 0.02 / 0.05 / 0.12 daily conversion the
 * constants hard-coded. Nothing about a fresh install changes; everything about it becomes tunable.
 *
 * Every number is clamped to its range rather than rejected, as `slurp-tuning.ts` does and for the
 * same reason: a hand-edited or imported type lands on the nearest legal value instead of throwing
 * the whole audience away.
 */
import { z } from "zod";

import type { NoodlerFanArchetype } from "@marinara-engine/shared";
import type { SlurpSpendTier } from "./slurp-population.js";

const num = (min: number, max: number, fallback: number) =>
  z
    .preprocess(
      (value) => (typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : value),
      z.number().min(min).max(max),
    )
    .default(fallback);
const int = (min: number, max: number, fallback: number) =>
  z
    .preprocess(
      (value) =>
        typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : value,
      z.number().int().min(min).max(max),
    )
    .default(fallback);

/** A coin range, low end first. Reversed input is sorted rather than rejected. */
const range = (max: number) =>
  z
    .preprocess(
      (value) => (Array.isArray(value) ? [...value].slice(0, 2) : value),
      z.tuple([int(0, max, 0), int(0, max, 0)]),
    )
    .transform(([low, high]) => [Math.min(low, high), Math.max(low, high)] as [number, number]);

/** A behaviour dial. 1 is "as often as anybody"; 0 is never. */
const weight = () => num(0, 5, 1);

/** Longest a voice may be. It rides in every fan-activity prompt, once per actor. */
export const SLURP_FAN_VOICE_MAX = 600;

/** How much of a voice a prompt carries. Shorter than the stored value on purpose. */
export const SLURP_FAN_VOICE_PROMPT_MAX = 240;

export const slurpFanTypeSchema = z.object({
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(48),
  builtIn: z.boolean().default(false),
  enabled: z.boolean().default(true),
  /** Population weight. Relative to every other enabled type, not a percentage. */
  share: num(0, 1000, 10),
  engineArchetype: z
    .enum(["ordinary", "eccentric", "crossFandom", "raider", "organicDiscovery", "freeResource"])
    .default("ordinary"),
  voice: z.string().max(SLURP_FAN_VOICE_MAX).default(""),
  traits: z.array(z.string().trim().min(1).max(48)).max(12).default([]),
  activeHours: z.object({ peak: int(0, 23, 12), spread: int(1, 12, 6) }).default({}),
  behavior: z
    .object({
      activity: weight(),
      like: weight(),
      follow: weight(),
      comment: weight(),
      question: weight(),
      dm: weight(),
      commission: weight(),
      tip: weight(),
      unlock: weight(),
    })
    .default({}),
  spend: z
    .object({
      /** What this person will pay for one Creator in a week. Zero means they never subscribe. */
      weeklyBudget: range(99_999).default([0, 0]),
      /** What they will pay for one commissioned piece. */
      commissionBudget: range(99_999).default([0, 0]),
      tipChance: num(0, 1, 0),
    })
    .default({}),
  funnel: z
    .object({
      /** Share of this person's reactions that are a follow rather than a like or a comment. */
      followChance: num(0, 1, 0.16),
      subConversionPerDay: num(0, 1, 0),
      loyaltyDays: int(1, 3650, 60),
      renewChance: num(0, 1, 1),
    })
    .default({}),
  tone: z.string().trim().max(48).optional(),
  bank: z.object({ targetSize: int(0, 500, 24) }).default({}),
});

export type SlurpFanType = z.infer<typeof slurpFanTypeSchema>;

/**
 * The eight built-ins.
 *
 * Shares are chosen so the derived spend mix is the old 62 / 25 / 11 / 2 and every Engine
 * archetype still holds more than a tenth of the crowd — the population regression asserts both,
 * and they were the only two distributions anything downstream depended on.
 */
export const SLURP_BUILTIN_FAN_TYPES: readonly SlurpFanType[] = [
  {
    id: "regular",
    name: "Regular",
    engineArchetype: "ordinary",
    share: 25,
    voice: "Friendly and unremarkable. Short, warm comments about the post itself, no in-jokes.",
    traits: ["first to comment", "quiet tipper"],
    activeHours: { peak: 19, spread: 6 },
    spend: { weeklyBudget: [12, 28], commissionBudget: [30, 50], tipChance: 0.04 },
    funnel: { followChance: 0.16, subConversionPerDay: 0.02, loyaltyDays: 90, renewChance: 0.9 },
  },
  {
    id: "night-owl",
    name: "Night Owl",
    engineArchetype: "eccentric",
    share: 11,
    voice: "Turns up at three in the morning. Oblique, funny, slightly too honest. Lowercase.",
    traits: ["night owl", "over-sharer"],
    activeHours: { peak: 2, spread: 4 },
    behavior: { comment: 1.6 },
    funnel: { followChance: 0.16, loyaltyDays: 45 },
  },
  {
    id: "crossover-fan",
    name: "Crossover Fan",
    engineArchetype: "crossFandom",
    share: 11,
    voice: "Arrived from somewhere else and says so. Compares things, recommends things, rarely pays.",
    traits: ["recommends you to everyone", "long-form commenter"],
    activeHours: { peak: 16, spread: 8 },
    behavior: { comment: 1.8, follow: 1.2 },
    funnel: { followChance: 0.2, loyaltyDays: 30 },
  },
  {
    id: "troll",
    name: "Troll",
    engineArchetype: "raider",
    share: 11,
    voice: "Blunt, unimpressed, never cruel about anything real. Never pays and says so.",
    traits: ["never reads captions"],
    activeHours: { peak: 23, spread: 6 },
    behavior: { like: 0.4, follow: 0.3, comment: 2 },
    funnel: { followChance: 0.05, loyaltyDays: 14 },
  },
  {
    id: "newcomer",
    name: "Newcomer",
    engineArchetype: "organicDiscovery",
    share: 11,
    voice: "Just found this account. Enthusiastic, a little awkward, asks obvious questions.",
    traits: ["asks questions", "screenshots everything"],
    activeHours: { peak: 13, spread: 8 },
    behavior: { follow: 2, comment: 1.2 },
    funnel: { followChance: 0.35, loyaltyDays: 10 },
  },
  {
    id: "lurker",
    name: "Lurker",
    engineArchetype: "freeResource",
    share: 18,
    voice: "Reads everything, says almost nothing. A like is the whole of their contribution.",
    traits: ["lurker", "emoji only"],
    activeHours: { peak: 21, spread: 10 },
    behavior: { like: 1.5, comment: 0.15, question: 0.2, dm: 0.2 },
    funnel: { followChance: 0.08, loyaltyDays: 120 },
  },
  {
    id: "superfan",
    name: "Superfan",
    engineArchetype: "ordinary",
    share: 11,
    voice: "Has been here a long time and remembers. Long, specific comments. Pays without being asked.",
    traits: ["completionist", "long-form commenter", "quiet tipper"],
    activeHours: { peak: 20, spread: 7 },
    behavior: { comment: 2, dm: 1.5, tip: 2 },
    spend: { weeklyBudget: [40, 80], commissionBudget: [90, 150], tipChance: 0.2 },
    funnel: { followChance: 0.25, subConversionPerDay: 0.05, loyaltyDays: 240, renewChance: 0.97 },
  },
  {
    id: "whale",
    name: "Whale",
    engineArchetype: "ordinary",
    share: 2,
    voice: "Rare and quiet about it. Commissions things, tips well, expects nothing in return.",
    traits: ["collector", "quiet tipper"],
    activeHours: { peak: 22, spread: 8 },
    behavior: { commission: 3, tip: 3, unlock: 2.5, comment: 0.8 },
    spend: { weeklyBudget: [140, 260], commissionBudget: [300, 500], tipChance: 0.35 },
    funnel: { followChance: 0.2, subConversionPerDay: 0.12, loyaltyDays: 365, renewChance: 0.98 },
  },
].map((entry) => slurpFanTypeSchema.parse({ builtIn: true, ...entry }));

export const slurpFanTypesSchema = z
  .array(slurpFanTypeSchema)
  .min(1)
  .max(60)
  .default(() => structuredClone(SLURP_BUILTIN_FAN_TYPES) as SlurpFanType[]);

/** A fresh copy of the built-ins. Cloned: settings are mutated by the editor, these are not. */
export function slurpFanTypesDefault(): SlurpFanType[] {
  return structuredClone(SLURP_BUILTIN_FAN_TYPES) as SlurpFanType[];
}

/**
 * Fill and repair a stored list.
 *
 * An unknown or disabled id resolves to a fallback at read time, so no data migration pass is
 * needed. All-disabled is the one state the simulation cannot run in — there would be nobody to
 * pick — so built-in Regular comes back on rather than the tick silently doing nothing.
 */
export function slurpNormalizeFanTypes(raw: unknown): SlurpFanType[] {
  const parsed = z.array(z.unknown()).safeParse(raw);
  if (!parsed.success) return slurpFanTypesDefault();
  const seen = new Set<string>();
  const types: SlurpFanType[] = [];
  for (const entry of parsed.data.slice(0, 60)) {
    const type = slurpFanTypeSchema.safeParse(entry);
    if (!type.success || seen.has(type.data.id)) continue;
    seen.add(type.data.id);
    types.push(type.data);
  }
  if (types.length === 0) return slurpFanTypesDefault();
  if (types.every((type) => !type.enabled)) {
    const regular = types.find((type) => type.id === "regular");
    if (regular) regular.enabled = true;
    else types.push(slurpFanTypesDefault()[0]!);
  }
  return types;
}

const ARCHETYPE_FALLBACK: Record<NoodlerFanArchetype, string> = {
  ordinary: "regular",
  eccentric: "night-owl",
  crossFandom: "crossover-fan",
  raider: "troll",
  organicDiscovery: "newcomer",
  freeResource: "lurker",
};

/** The type a member with no usable `fanTypeId` falls back to. Never undefined. */
export function slurpFallbackFanType(types: readonly SlurpFanType[], archetype?: string): SlurpFanType {
  const usable = types.filter((type) => type.enabled);
  const pool = usable.length > 0 ? usable : types;
  const byArchetype = archetype ? ARCHETYPE_FALLBACK[archetype as NoodlerFanArchetype] : undefined;
  return (
    (byArchetype ? pool.find((type) => type.id === byArchetype) : undefined) ??
    (archetype ? pool.find((type) => type.engineArchetype === archetype) : undefined) ??
    pool.find((type) => type.id === "regular") ??
    pool[0] ??
    slurpFanTypesDefault()[0]!
  );
}

/**
 * Which type this member is.
 *
 * A row written before Fan Types existed carries no `fanTypeId`, and a type the player deleted or
 * switched off leaves a live row pointing at nothing. Both resolve through the member's archetype,
 * which every row has had since the population shipped — so upgrading needs no migration pass and
 * deleting a type cannot crash a tick.
 */
export function slurpResolveFanType(
  types: readonly SlurpFanType[],
  member: { fanTypeId?: string | null; archetype?: string },
): SlurpFanType {
  const direct = member.fanTypeId ? types.find((type) => type.id === member.fanTypeId) : undefined;
  if (direct?.enabled) return direct;
  return slurpFallbackFanType(types, member.archetype);
}

/** FNV-1a with the murmur3 finalizer, as the other Slurp rule modules use. */
function hash(value: string): number {
  let out = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 0x01000193);
  }
  out ^= out >>> 16;
  out = Math.imul(out, 0x85ebca6b);
  out ^= out >>> 13;
  out = Math.imul(out, 0xc2b2ae35);
  out ^= out >>> 16;
  return out >>> 0;
}

const unit = (seed: string, salt: string): number => hash(`${salt}:${seed}`) / 0x100000000;

/** Weighted pick by `share`, deterministic in the seed. Disabled types are not in the draw. */
export function slurpPickFanType(types: readonly SlurpFanType[], seed: string): SlurpFanType {
  const pool = types.filter((type) => type.enabled && type.share > 0);
  if (pool.length === 0) return slurpFallbackFanType(types);
  const total = pool.reduce((sum, type) => sum + type.share, 0);
  let roll = unit(seed, "fanType") * total;
  for (const type of pool) {
    roll -= type.share;
    if (roll < 0) return type;
  }
  return pool[pool.length - 1]!;
}

/**
 * The Fan Type for somebody who has no population row: the pinned one, else derived from a seed.
 *
 * An audience member who is an account rather than a generated member — an ambient profile, or a
 * character the user invited — carries no `fanTypeId`, so `slurpResolveFanType` has nothing to read.
 * Both the world tick and the fan-activity draw need the same answer for the same member, or the
 * weights the simulation runs on would disagree with the voice the prompt describes.
 *
 * A pinned type that has been deleted or disabled falls through to the seed rather than failing, so
 * removing a Fan Type never strands a member.
 */
export function slurpFanTypeForPinnedOrSeed(
  types: readonly SlurpFanType[],
  pinnedId: string | null,
  seed: string,
): SlurpFanType {
  const pinned = pinnedId ? types.find((type) => type.id === pinnedId && type.enabled) : undefined;
  return pinned ?? slurpPickFanType(types, seed);
}

/** A whole-coin value inside a range, deterministic in the seed. */
function inRange([low, high]: readonly [number, number], seed: string, salt: string): number {
  if (high <= low) return low;
  return low + (hash(`${salt}:${seed}`) % (high - low + 1));
}

/** What this member will pay this week, for one Creator. Stable for the life of the member. */
export function slurpFanTypeWeeklyBudget(type: SlurpFanType, memberId: string): number {
  return inRange(type.spend.weeklyBudget, memberId, "weeklyBudget");
}

/** What this member will pay for one commissioned piece. */
export function slurpFanTypeCommissionBudget(type: SlurpFanType, memberId: string): number {
  return inRange(type.spend.commissionBudget, memberId, "commissionBudget");
}

/**
 * The legacy spend tier a budget stands for.
 *
 * The tier is still the vocabulary of the commission settlement, the fan card, and the prompts, so
 * it is derived rather than dropped. The thresholds are the old fixed budgets: 20 was light, 60
 * was regular, 200 was a whale.
 */
export function slurpFanTypeSpendTier(weeklyBudget: number): SlurpSpendTier {
  if (!(weeklyBudget > 0)) return "none";
  if (weeklyBudget < 40) return "light";
  if (weeklyBudget < 140) return "regular";
  return "whale";
}

/** The built-in whose budget midpoint lands on this tier. The source of the old constants. */
export function slurpBuiltinFanTypeForTier(tier: SlurpSpendTier): SlurpFanType | undefined {
  return SLURP_BUILTIN_FAN_TYPES.find((type) => {
    const [low, high] = type.spend.weeklyBudget;
    return slurpFanTypeSpendTier((low + high) / 2) === tier;
  });
}

/** The active hour this member keeps, drawn around their type's peak. */
export function slurpFanTypeActiveHour(type: SlurpFanType, seed: string): number {
  const { peak, spread } = type.activeHours;
  const offset = (hash(`activeHour:${seed}`) % (spread * 2 + 1)) - spread;
  return (((peak + offset) % 24) + 24) % 24;
}

/** One or two traits from the type's own list. Falls back to the type name when it has none. */
export function slurpFanTypeTraits(type: SlurpFanType, seed: string): string[] {
  if (type.traits.length === 0) return [type.name.toLowerCase()];
  const count = Math.min(type.traits.length, 1 + (hash(`traitCount:${seed}`) % 2));
  const traits: string[] = [];
  for (let index = 0; traits.length < count && index < type.traits.length * 3; index += 1) {
    const trait = type.traits[hash(`trait:${index}:${seed}`) % type.traits.length]!;
    if (!traits.includes(trait)) traits.push(trait);
  }
  return traits;
}

/** A voice, cut to what a prompt should carry. Defensive: stored values are player-editable. */
export function slurpFanVoiceForPrompt(voice: string | null | undefined): string | undefined {
  const trimmed = String(voice ?? "")
    .replace(/\s+/gu, " ")
    .trim();
  return trimmed ? trimmed.slice(0, SLURP_FAN_VOICE_PROMPT_MAX) : undefined;
}

/** Longest a memory may be. It rides next to the voice in the same prompts, so it stays short. */
export const SLURP_FAN_MEMORY_MAX = 200;

/** What one tie remembers. Every field is already on the tie row; none of it costs a query. */
export type SlurpFanMemorySubject = {
  stage?: string;
  spent?: number;
  interactions?: number;
  followedAt?: string | null;
  lastSeenAt?: string | null;
  audienceArc?: string | null;
};

/**
 * A few lines of shared history, in the fan's file rather than in a model call.
 *
 * A tie holds counters and nothing ever said them out loud, so every fan wrote as though they had
 * arrived that minute. This is the cheapest possible fix: the counters, in words, derived where
 * the prompt is built. No column, no call, no state to keep in step.
 */
export function slurpFanMemoryForPrompt(
  tie: SlurpFanMemorySubject | null | undefined,
  at: Date = new Date(),
): string | undefined {
  if (!tie) return undefined;
  const days = (value: string | null | undefined): number | null => {
    const parsed = value ? Date.parse(value) : Number.NaN;
    if (!Number.isFinite(parsed)) return null;
    const out = Math.floor((at.getTime() - parsed) / 86_400_000);
    return out >= 0 ? out : null;
  };
  const following = days(tie.followedAt);
  const quiet = days(tie.lastSeenAt);
  const spent = Math.max(0, Math.round(tie.spent ?? 0));
  const interactions = Math.max(0, Math.round(tie.interactions ?? 0));
  const lines = [
    following !== null && following >= 1 ? `Has followed for ${following} days.` : "",
    tie.stage === "subscriber" ? "Subscribes." : tie.stage === "lapsed" ? "Used to pay, stopped." : "",
    spent > 0 ? `Has paid ${spent} coins in total.` : "",
    interactions >= 3 ? `Has turned up ${interactions} times.` : "",
    tie.audienceArc && tie.audienceArc !== "steady" ? `Lately: ${tie.audienceArc}.` : "",
    quiet !== null && quiet >= 14 ? `Last seen ${quiet} days ago.` : "",
  ].filter(Boolean);
  // Four short lines is a memory; a paragraph is a biography nobody asked the model to read.
  return lines.length > 0 ? lines.slice(0, 4).join(" ").slice(0, SLURP_FAN_MEMORY_MAX) : undefined;
}

/** One member, as much of them as a rebalance needs. */
export type SlurpRebalanceMember = { id: string; fanTypeId?: string | null; archetype?: string };

export type SlurpFanTypeRebalance = {
  /** Only the members whose type actually changes. */
  changes: Array<{ memberId: string; from: string; to: string }>;
  /** Per type id: how many members hold it now, and how many would after. */
  counts: Record<string, { before: number; after: number }>;
};

/**
 * Reassign the existing population to the current shares.
 *
 * Shares only ever applied to new members, so a player who moved a slider watched nothing happen
 * to the crowd they already had. This is the same weighted draw generation uses, over the member
 * id, so it is deterministic: the preview a player approves is exactly what the apply writes, and
 * running it twice changes nothing the second time.
 */
export function planSlurpFanTypeRebalance(
  members: readonly SlurpRebalanceMember[],
  types: readonly SlurpFanType[],
): SlurpFanTypeRebalance {
  const counts: Record<string, { before: number; after: number }> = {};
  const bump = (id: string, key: "before" | "after") => {
    counts[id] ??= { before: 0, after: 0 };
    counts[id][key] += 1;
  };
  const changes: SlurpFanTypeRebalance["changes"] = [];
  for (const member of members) {
    const from = slurpResolveFanType(types, member).id;
    const to = slurpPickFanType(types, member.id).id;
    bump(from, "before");
    bump(to, "after");
    // Compare what is stored: a stale id resolves to the fallback now but could come back later.
    if (member.fanTypeId !== to) changes.push({ memberId: member.id, from, to });
  }
  return { changes, counts };
}
