// ──────────────────────────────────────────────
// Otome Forge: the economy's numbers (plan §1.11): Starlight, affection, and the bounds of trust and tension
// ──────────────────────────────────────────────
// Pure TypeScript shared by both bundles: the server grants by these numbers (S/state/rewards.ts) and moves trust and
// tension within these bounds (S/state/relationship.ts); the client shows levels and costs from them. A regression pins
// every value (tests/otome-forge-state-caps.regression.ts), so a change here is always on purpose.
// Items marked "proposal" are numbers the design left open; the plan proposes them to the maintainer.

/** A new world's Starlight. Starlight is earned only; there is no real money. */
export const STARTING_STARLIGHT = 2000;
export const WISH_COST = 100;
/** Ten pulls cost ten wishes: no discount. */
export const TEN_WISH_COST = 10 * WISH_COST;

/** Starlight per earning. Story earnings are never capped; activity earnings share ACTIVITY_STARLIGHT_DAILY_CAP. */
export const STARLIGHT_EARNINGS = {
  /** The first time a beat is read to its end. */
  beat: 30,
  /** A main chapter (also a repair chapter) read to its last node. */
  chapter: 160,
  routeChapter: 300,
  date: 120,
  readHim: 40,
  /** A finished Read Me set, whatever was guessed (#1945, proposal). */
  readMe: 40,
  /** proposal */
  clawRound: 20,
  /** Per plush caught (proposal). */
  clawPlush: 30,
} as const;
/** Starlight from activities (dates, Read Him, Claw, Show him) per local day. */
export const ACTIVITY_STARLIGHT_DAILY_CAP = 400;

export const POINTS_PER_LEVEL = 300;
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 10;

/** Affection points per earning. Story earnings are never capped; the rest share OUTSIDE_AFFECTION_DAILY_CAP. */
export const AFFECTION_EARNINGS = {
  /** The chapter's Lead, when its last node is read. */
  lead: 150,
  /** The chapter's Foil, when its last node is read. */
  foil: 60,
  date: 100,
  readHim: 40,
  /** A finished Read Me set (#1945, proposal), plus readMeRight per guess they got right and readMeClose per close one. */
  readMe: 20,
  readMeRight: 10,
  readMeClose: 5,
  /** proposal */
  clawRound: 30,
  /** A phone thread closed with "Close and remember" (proposal). */
  closeAndRemember: 20,
  /** The first Show him for a look (proposal). */
  showHim: 20,
} as const;
/** Affection from outside the story, per love interest per local day (proposal: the design's cap read as per LI). */
export const OUTSIDE_AFFECTION_DAILY_CAP = 300;

/** Affection level 1–10 from points. Choice losses stop at the current level's floor. */
export function levelOf(points: number): number {
  const safe = Number.isFinite(points) ? Math.max(0, points) : 0;
  return Math.min(MAX_LEVEL, MIN_LEVEL + Math.floor(safe / POINTS_PER_LEVEL));
}

/** Public progress within the current level; the maximum level is complete, with no level 11 implied. */
export function affectionProgressOf(points: number): { current: number; required: number } {
  const safe = Number.isFinite(points) ? Math.max(0, points) : 0;
  const level = levelOf(safe);
  return {
    current: level === MAX_LEVEL ? POINTS_PER_LEVEL : safe - (level - MIN_LEVEL) * POINTS_PER_LEVEL,
    required: POINTS_PER_LEVEL,
  };
}

// ── Prestige (#2025): past level 10, affection keeps counting. Every POINTS_PER_LEVEL is a prestige point, and every
// PRESTIGE_POINTS_PER_STORY of them unlocks one extra story with him (S/items/prestige.ts); the pips then start again.
// All of it is derived from his points, which are never capped, so no affection is lost and nothing is stored but
// the stories written (their chapter keys `prestige-<li>-<n>`). ──

/** The affection points at which level 10 is reached. */
export const MAX_LEVEL_POINTS = (MAX_LEVEL - MIN_LEVEL) * POINTS_PER_LEVEL;
export const PRESTIGE_POINTS_PER_STORY = 3;
const PRESTIGE_CYCLE = PRESTIGE_POINTS_PER_STORY * POINTS_PER_LEVEL;

/** An extra story's kind: a kink explored together (NSFW Heat only), a what-if of their future, or a mini AU. */
export const PRESTIGE_KINDS = ["kink", "what-if", "au"] as const;
export type PrestigeKind = (typeof PRESTIGE_KINDS)[number];

export interface Prestige {
  /** Extra stories unlocked so far (each one is written once, on the player's tap). */
  unlocked: number;
  /** Prestige points toward the next extra story, 0 to PRESTIGE_POINTS_PER_STORY - 1. */
  points: number;
  /** Affection toward the next prestige point. */
  current: number;
  required: number;
}

/** His prestige from his affection points: all zero below level 10 and at exactly level 10. */
export function prestigeOf(points: number): Prestige {
  const safe = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  const over = Math.max(0, safe - MAX_LEVEL_POINTS);
  return {
    unlocked: Math.floor(over / PRESTIGE_CYCLE),
    points: Math.floor(over / POINTS_PER_LEVEL) % PRESTIGE_POINTS_PER_STORY,
    current: over % POINTS_PER_LEVEL,
    required: POINTS_PER_LEVEL,
  };
}

/** The number of the extra story to write next (from 1), or null while none is unlocked beyond the `written` ones. */
export function nextPrestige(points: number, written: number): number | null {
  return prestigeOf(points).unlocked > written ? written + 1 : null;
}

/**
 * Where a choice loss stops: the floor of the level reached, and at level 10 the last extra story unlocked, so a loss
 * never takes an unlocked story back (prestige points within the cycle may fall, as points within a level do).
 */
export function affectionFloorOf(points: number): number {
  const safe = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  const level = levelOf(safe);
  return level < MAX_LEVEL
    ? (level - MIN_LEVEL) * POINTS_PER_LEVEL
    : MAX_LEVEL_POINTS + prestigeOf(safe).unlocked * PRESTIGE_CYCLE;
}

/**
 * Where an earning comes from. Story sources (a beat, a chapter, a route chapter, and its Lead and Foil affection) are
 * never capped; every other source is an activity, capped per local day.
 */
export const REWARD_SOURCES = [
  "beat",
  "chapter",
  "route-chapter",
  "date",
  "read-him",
  "read-me",
  "claw",
  "close-and-remember",
  "show-him",
] as const;
export type RewardSource = (typeof REWARD_SOURCES)[number];

const STORY_SOURCES: ReadonlySet<RewardSource> = new Set<RewardSource>(["beat", "chapter", "route-chapter"]);

/** True for story earnings, which no daily cap applies to. */
export function isStoryReward(source: RewardSource): boolean {
  return STORY_SOURCES.has(source);
}

// ── Trust and tension: never shown, moved only by first-play choices (and, from M2b, Confrontations) ──

export const TRUST_MIN = -3;
export const TRUST_MAX = 3;
export const TENSION_MIN = 0;
export const TENSION_MAX = 3;
/** How far trust, and tension, may move within one beat, either way. */
export const BEAT_SHIFT_MAX = 1;
/** How far trust, and tension, may move within one chapter, either way. */
export const CHAPTER_SHIFT_MAX = 2;
