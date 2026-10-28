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
  /** proposal */
  clawRound: 30,
  /** A phone thread closed with "Close and remember" (proposal). */
  closeAndRemember: 20,
  /** The first Show him for a look (proposal). */
  showHim: 20,
} as const;
/** Affection from outside the story, per love interest per local day (proposal: the design's cap read as per LI). */
export const OUTSIDE_AFFECTION_DAILY_CAP = 300;

/** Affection level 1–10 from points. It only rises, because points only rise. */
export function levelOf(points: number): number {
  const safe = Number.isFinite(points) ? Math.max(0, points) : 0;
  return Math.min(MAX_LEVEL, MIN_LEVEL + Math.floor(safe / POINTS_PER_LEVEL));
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
