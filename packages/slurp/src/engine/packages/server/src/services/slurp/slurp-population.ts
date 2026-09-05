/**
 * The audience, generated as data.
 *
 * Pure, deterministic, and free. This is the module that answers the finding the whole plan
 * started from: Slurp's entire background cast was **twelve accounts** — six ambient profiles and
 * six fan identities with placeholder handles like `quiet_regular`. Every like, reply, and repost
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

/**
 * How a member behaves. These are the Engine's existing fan archetypes, so the population plugs
 * into `NoodlerFanIdentityProvider` without touching the Engine.
 */
const ARCHETYPES: readonly NoodlerFanArchetype[] = [
  "ordinary",
  "eccentric",
  "crossFandom",
  "raider",
  "organicDiscovery",
  "freeResource",
] as const;

/** Shown on a fan card, and used later to colour what a member says. */
const TRAITS = [
  "night owl",
  "early riser",
  "lurker",
  "over-sharer",
  "collector",
  "bargain hunter",
  "completionist",
  "first to comment",
  "quiet tipper",
  "gif replier",
  "long-form commenter",
  "emoji only",
  "asks questions",
  "never reads captions",
  "screenshots everything",
  "recommends you to everyone",
] as const;

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

/**
 * The player can only keep track of about thirty people. Materialising more as individuals costs
 * more and reads worse than a number, so the named cast is capped and the rest stays as reach.
 */
export const SLURP_NAMED_CAST_LIMIT = 30;

/** How much a member is willing to spend. Most people spend nothing; a few spend a lot. */
export type SlurpSpendTier = "none" | "light" | "regular" | "whale";

/**
 * Weighted so the population looks like a real audience: mostly free readers, a thin tail of
 * paying regulars. A crowd where everyone pays is neither believable nor interesting, because the
 * few who do pay stop meaning anything.
 */
const SPEND_TIERS: readonly { tier: SlurpSpendTier; weight: number }[] = [
  { tier: "none", weight: 62 },
  { tier: "light", weight: 25 },
  { tier: "regular", weight: 11 },
  { tier: "whale", weight: 2 },
];

export type SlurpPopulationMember = {
  id: string;
  handle: string;
  displayName: string;
  archetype: NoodlerFanArchetype;
  traits: string[];
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

const unit = (seed: string, salt: string): number => hash(`${salt}:${seed}`) / 0x100000000;

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function spendTierFor(seed: string): SlurpSpendTier {
  const total = SPEND_TIERS.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = unit(seed, "spend") * total;
  for (const entry of SPEND_TIERS) {
    roll -= entry.weight;
    if (roll < 0) return entry.tier;
  }
  return "none";
}

/**
 * Build one member from a seed.
 *
 * Everything derives from the seed, so the same seed always produces the same person and a member
 * can be regenerated from their id alone rather than needing a row before they are interesting.
 */
export function generateSlurpPopulationMember(seed: string, joinedAt: Date): SlurpPopulationMember {
  const first = pick(FIRST, seed, "first");
  const second = pick(SECOND, seed, "second");
  const suffix = pick(SUFFIXES, seed, "suffix");
  const traitCount = 1 + (hash(`count:${seed}`) % 2);
  const traits: string[] = [];
  for (let index = 0; index < traitCount; index += 1) {
    const trait = pick(TRAITS, `${seed}:${index}`, "trait");
    if (!traits.includes(trait)) traits.push(trait);
  }
  return {
    id: `slurp-fan:${seed}`,
    handle: `${first}_${second}${suffix}`,
    displayName: `${titleCase(first)} ${titleCase(second)}`,
    archetype: pick(ARCHETYPES, seed, "archetype"),
    traits,
    spendTier: spendTierFor(seed),
    activeHour: hash(`hour:${seed}`) % 24,
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
