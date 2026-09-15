/**
 * The audience, generated as data.
 *
 * Pure, deterministic, and free. This is the module that answers the finding the whole plan
 * started from: Slurp's entire background cast was **twelve accounts** — six ambient profiles and
 * six fan identities with placeholder handles like `quiet_regular`. Every like and reply
 * any Creator ever received came from those twelve, which is why the world read as repetitive,
 * incoherent, thin, and lifeless all at once.
 *
 * You cannot generate a population with a model. It is too slow and too expensive. So the
 * population is combinatorial: name parts crossed with archetypes crossed with traits. The banks
 * below produce hundreds of thousands of distinct people at zero cost, and a member is only ever
 * written to the database once they act somewhere the player can see.
 *
 * Nobody here has a profile, a post grid, or an avatar to generate. That is the maintainer's
 * constraint and it is what makes an audience affordable where synthetic creators were not.
 */

import type { NoodlerFanArchetype } from "@marinara-engine/shared";
import {
  SLURP_BUILTIN_FAN_TYPES,
  slurpFanTypeActiveHour,
  slurpFanTypeSpendTier,
  slurpFanTypeTraits,
  slurpFanTypeWeeklyBudget,
  slurpPickFanType,
  type SlurpFanType,
} from "./slurp-fan-types.js";

/**
 * Handle stems. Chosen to read as usernames a person picked rather than as generated strings:
 * concrete nouns, slightly off-kilter, no adjectives that sound like a brand.
 */
const FIRST = [
  "moth",
  "brine",
  "orbit",
  "packet",
  "glass",
  "thread",
  "salt",
  "ember",
  "static",
  "velvet",
  "copper",
  "hollow",
  "pale",
  "iron",
  "amber",
  "quiet",
  "lunar",
  "rust",
  "wax",
  "cinder",
  "fern",
  "tidal",
  "opal",
  "grain",
  "vapor",
  "slate",
  "plum",
  "harbor",
  "cobalt",
  "birch",
  "willow",
  "flint",
  "ochre",
  "murmur",
  "gilded",
  "sable",
  "thistle",
  "cedar",
  "marrow",
  "dusk",
  "sorrel",
  "clay",
  "vellum",
  "onyx",
  "juniper",
  "frost",
  "tallow",
  "myrrh",
  "bramble",
] as const;

const SECOND = [
  "hour",
  "index",
  "notice",
  "soup",
  "bulletin",
  "countess",
  "drift",
  "signal",
  "hymn",
  "ledger",
  "market",
  "season",
  "study",
  "wire",
  "chorus",
  "district",
  "lantern",
  "record",
  "tide",
  "window",
  "circuit",
  "garden",
  "parlour",
  "current",
  "almanac",
  "kettle",
  "atlas",
  "orchard",
  "gazette",
  "quarry",
  "wharf",
  "vigil",
  "pantry",
  "cinema",
  "postcard",
  "compass",
  "lecture",
  "terrace",
  "canteen",
  "observatory",
  "footnote",
  "junction",
  "aviary",
  "hollow",
  "reverie",
  "switchboard",
  "cassette",
  "verandah",
] as const;

/** Appended when a handle collides, so two people can share a name without sharing a handle. */
const SUFFIXES = ["", "_", "01", "x", "77", "_ii", "23", "9"] as const;

/** Funnel stages, in order. The index is meaningful: a higher index is a closer relationship. */
export const SLURP_FUNNEL_STAGES = [
  "stranger",
  "viewer",
  "liker",
  "follower",
  "subscriber",
  "regular",
  "whale",
] as const;

export type SlurpFunnelStage = (typeof SLURP_FUNNEL_STAGES)[number] | "lapsed";

export function slurpReactivationStage(stage: unknown, hasSubscription = false): SlurpFunnelStage {
  if (!SLURP_FUNNEL_STAGES.includes(stage as (typeof SLURP_FUNNEL_STAGES)[number])) return "follower";
  if (stage === "subscriber" && !hasSubscription) return "follower";
  return stage as (typeof SLURP_FUNNEL_STAGES)[number];
}

/**
 * The player can only keep track of about thirty people. Materialising more as individuals costs
 * more and reads worse than a number, so the named cast is capped and the rest stays as reach.
 */
export const SLURP_NAMED_CAST_LIMIT = 30;

/** How much a member is willing to spend. Most people spend nothing; a few spend a lot. */
export type SlurpSpendTier = "none" | "light" | "regular" | "whale";

export type SlurpPopulationMember = {
  id: string;
  handle: string;
  displayName: string;
  /**
   * Kept in step with the Fan Type's `engineArchetype`, so the Engine fan-identity interface is
   * unchanged and a row written before Fan Types existed can still resolve back to a type.
   */
  archetype: NoodlerFanArchetype;
  /** Which Fan Type this person is. Null on a row written before Fan Types existed. */
  fanTypeId: string | null;
  traits: string[];
  /** Derived from the Fan Type's weekly budget. Still the vocabulary of prompts and settlement. */
  spendTier: SlurpSpendTier;
  /** UTC hour this member is usually around. The world clock reads this so a feed has a rhythm. */
  activeHour: number;
  joinedAt: string;
};

function hash(value: string): number {
  let out = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 0x01000193);
  }
  // The finalizer is load-bearing. Plain FNV-1a barely avalanches its last byte, and seeds here
  // are sequential, so without it consecutive members would come out nearly identical.
  out ^= out >>> 16;
  out = Math.imul(out, 0x85ebca6b);
  out ^= out >>> 13;
  out = Math.imul(out, 0xc2b2ae35);
  out ^= out >>> 16;
  return out >>> 0;
}

const pick = <T>(list: readonly T[], seed: string, salt: string): T => list[hash(`${salt}:${seed}`) % list.length]!;

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Build one member from a seed.
 *
 * Everything derives from the seed, so the same seed always produces the same person and a member
 * can be regenerated from their id alone rather than needing a row before they are interesting.
 */
export function generateSlurpPopulationMember(
  seed: string,
  joinedAt: Date,
  fanTypes: readonly SlurpFanType[] = SLURP_BUILTIN_FAN_TYPES,
): SlurpPopulationMember {
  const first = pick(FIRST, seed, "first");
  const second = pick(SECOND, seed, "second");
  const suffix = pick(SUFFIXES, seed, "suffix");
  // Who they are comes first: traits, hour, archetype and appetite all hang off the Fan Type now,
  // rather than being four unrelated hashes of the same seed.
  const fanType = slurpPickFanType(fanTypes, seed);
  const id = `slurp-fan:${seed}`;
  return {
    id,
    handle: `${first}_${second}${suffix}`,
    // The numeric suffixes carry into the display name, the symbol ones do not. Without this the
    // 18,816 handles collapsed into 2,352 display names, and a named cast of thirty is well inside
    // the birthday bound for that — two different people read as one person in the same list.
    // "Moth Hour 77" is how a real handle collision reads; "Moth Hour _ii" is not.
    // ponytail: five name buckets per stem pair, not eight. Add a display-name bank if a cast ever
    // grows past thirty.
    displayName: `${titleCase(first)} ${titleCase(second)}${/^\d+$/.test(suffix) ? ` ${suffix}` : ""}`,
    archetype: fanType.engineArchetype,
    fanTypeId: fanType.id,
    traits: slurpFanTypeTraits(fanType, seed),
    spendTier: slurpFanTypeSpendTier(slurpFanTypeWeeklyBudget(fanType, id)),
    activeHour: slurpFanTypeActiveHour(fanType, seed),
    joinedAt: joinedAt.toISOString(),
  };
}

/**
 * The size of the pool this generator can draw from before names must repeat.
 *
 * Exported so a test can assert it stays far above any population Slurp would ever materialise —
 * the whole point is that the cast never runs out.
 */
export const SLURP_POPULATION_NAME_SPACE = FIRST.length * SECOND.length * SUFFIXES.length;

/**
 * How likely this person is to be around at a given hour.
 *
 * `activeHour` has been stored on every member since the population shipped and read by nothing,
 * so a night owl and an early riser were equally likely to turn up at four in the morning. A feed
 * with no daily rhythm reads as a machine emitting events rather than as people with lives.
 *
 * Returns a weight rather than a yes or no: somebody can always be up late, just less often.
 */
export function slurpMemberActivityWeight(activeHour: number, hour: number): number {
  if (!Number.isFinite(activeHour) || !Number.isFinite(hour)) return 1;
  const distance = Math.min(Math.abs(activeHour - hour), 24 - Math.abs(activeHour - hour));
  // Full weight within a couple of hours of their usual time, tapering to a fifth on the far side
  // of the clock. Never zero — people surprise you.
  return Math.max(0.2, 1 - (distance / 12) * 0.8);
}

/** Pick the members most likely to be around now, keeping the list deterministic. */
export function slurpMembersActiveAt<T extends { id: string; activeHour: number }>(
  members: readonly T[],
  hour: number,
  limit: number,
): T[] {
  return [...members]
    .map((member) => ({
      member,
      // Weight, then a stable tiebreak on id, so "who is around" does not reshuffle between two
      // reads of the same hour.
      weight: slurpMemberActivityWeight(member.activeHour, hour),
    }))
    .sort((left, right) => right.weight - left.weight || (left.member.id < right.member.id ? -1 : 1))
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.member);
}
