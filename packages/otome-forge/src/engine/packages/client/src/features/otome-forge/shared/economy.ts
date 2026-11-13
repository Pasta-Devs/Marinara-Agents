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
  /** A finished Tarot night reading (#2151, proposal: as Read Them). */
  tarot: 40,
  /** proposal */
  clawRound: 20,
  /** Per plush caught (proposal). */
  clawPlush: 30,
} as const;
/** Starlight from activities (dates, Read Him, Read Me, Tarot night, Claw, Show him) per local day. */
export const ACTIVITY_STARLIGHT_DAILY_CAP = 400;

/** Affection points for each prestige point past level 10 (the maintainer's, 2026-11-04: kept at 300). */
export const POINTS_PER_LEVEL = 300;
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 10;
/**
 * The points each level up to 10 costs, from level 1→2 to 9→10: 200, then 50 more per level, up to 600 (the
 * maintainer's, 2026-11-04). Level n is reached at the sum of the first n − 1 costs.
 */
export const LEVEL_COSTS: readonly number[] = Array.from({ length: 9 }, (_, i) => 200 + 50 * i);
/**
 * 0.23.0, the bond ranks: levels 11–20 continue the same curve past the finale, 50 more per level (650 … 1,100), so the
 * ladder is one rule and a choice loss stops where it always did. Rank n is reached at the sum of every cost before it:
 * rank 11 at 4,250 (level 10's 3,600 plus 650) and rank 20 at 12,350. They open only for a love interest past his finale
 * (S/schemas/state.ts bondOpen) and one rank at a time, each rank's story played first (bondRankOf).
 * The maintainer's, 2026-11-11: "let's not make it easy to reach".
 */
export const BOND_COSTS: readonly number[] = Array.from({ length: 10 }, (_, i) => 650 + 50 * i);
const LEVEL_FLOORS: readonly number[] = [...LEVEL_COSTS, ...BOND_COSTS].reduce<number[]>(
  (floors, cost) => [...floors, floors.at(-1)! + cost],
  [0],
);

/** The highest affection level, the last bond rank. */
export const BOND_MAX_LEVEL = LEVEL_COSTS.length + BOND_COSTS.length + MIN_LEVEL;
/** The points at which level 20 is reached. */
export const BOND_MAX_POINTS = LEVEL_FLOORS.at(-1)!;

/** The affection points at which `level` (1–20) is reached; above 20 it stays at the last rank. */
export function levelFloor(level: number): number {
  return LEVEL_FLOORS[Math.min(BOND_MAX_LEVEL, Math.max(MIN_LEVEL, Math.trunc(level))) - MIN_LEVEL]!;
}

/** Affection points per earning. Story earnings are never capped; the rest share OUTSIDE_AFFECTION_DAILY_CAP. */
export const AFFECTION_EARNINGS = {
  /** The chapter's Foil, when its last node is read (the maintainer's, 2026-11-13: 50, was 60). The Lead's: LEAD_AFFECTION. */
  foil: 50,
  date: 100,
  readHim: 40,
  /** A finished Read Me set (#1945, proposal), plus readMeRight per guess they got right and readMeClose per close one. */
  readMe: 20,
  readMeRight: 10,
  readMeClose: 5,
  /** A finished Tarot night reading (#2151, proposal: as Read Them). */
  tarot: 40,
  /** proposal */
  clawRound: 30,
  /** A phone thread closed with "Close and remember", for an exchange with words from both of them (the maintainer's). */
  closeAndRemember: 5,
  /** The first Show him for a look (the maintainer's, 2026-11-03: 5, was 20). */
  showHim: 5,
} as const;
/**
 * The Lead of a main, route or repair chapter, when its last node is read, by how the chapter's climax ended (the
 * maintainer's, 2026-11-13; it was 150 whatever happened): a win (the truth, or Opened up), a tie (a standoff, or
 * Almost), or a loss (a walkout, or Shut out). A chapter with no Confrontation or Closer, or whose climax was eased off
 * before its ending, pays the tie.
 */
export const LEAD_AFFECTION = { won: 150, tie: 100, lost: 50 } as const;

/**
 * Affection from outside the story, per love interest per local day (the maintainer's, 2026-11-06, #2133: 150, was
 * 300): one Date Night's 100 and a little more.
 */
export const OUTSIDE_AFFECTION_DAILY_CAP = 150;

/**
 * #2156 (the maintainer's): what clearing his grievance with her pays, once, as a story earning: his repair chapter
 * read to its end pays this in place of its Lead's affection. While it stands, he earns no affection at all.
 */
export const GRIEVANCE_CLEARED_AFFECTION = 300;

/**
 * #2046: what siding with one love interest in an argument moves (proposal). The one backed gains, as a story earning
 * (never capped; twice what a hostile pick costs); each one passed over loses less than a hostile pick, since backing
 * someone else is not hostile, and never below the level reached.
 */
export const SIDE_WITH_AFFECTION = { backed: 30, passedOver: 10 } as const;

/**
 * `total` split into `parts` whole shares as evenly as it goes: each share is the floor, and the first `total % parts`
 * shares carry one more, so a split never invents or loses a point. A double date's affection is shared this way.
 */
export function splitEvenly(total: number, parts: number): number[] {
  const count = Math.max(1, Math.trunc(parts) || 1);
  const whole = Math.max(0, Math.trunc(total) || 0);
  const base = Math.floor(whole / count);
  const extra = whole % count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Affection level 1–10 from points. Choice losses stop at the current level's floor. */
export function levelOf(points: number): number {
  const safe = Number.isFinite(points) ? Math.max(0, points) : 0;
  let level = MIN_LEVEL;
  while (level < MAX_LEVEL && safe >= levelFloor(level + 1)) level += 1;
  return level;
}

/**
 * The level he stands at, 1–20 (0.23.0). Below the finale's gate (`open`: LiState.stage is the last stage) it is his
 * affection level, 1–10, exactly as before. Past it, the bond ranks open one at a time: his points buy ranks, but only
 * one beyond the bond stories he has played (`played`), so a story already under way cannot bank its way to 20.
 */
export function bondRankOf(points: number, open: boolean, played: number): number {
  if (!open) return levelOf(points);
  const safe = Number.isFinite(points) ? Math.max(0, points) : 0;
  // From wherever his points stand, never from 10: below level 10 the gate changes nothing at all.
  let bought = levelOf(safe);
  while (bought < BOND_MAX_LEVEL && safe >= levelFloor(bought + 1)) bought += 1;
  const earned = Math.max(0, Math.min(BOND_COSTS.length, Math.trunc(played) || 0)) + 1;
  return Math.min(bought, MAX_LEVEL + earned);
}

/**
 * Public progress within the current level (1–20). Level 10 keeps the old reading (600 of 600) while the gate is shut;
 * with it open it counts toward rank 11 (0 of 650). The last rank is complete, with no level 21 implied.
 */
export function affectionProgressOf(points: number, open = false, played = 0): { current: number; required: number } {
  const safe = Number.isFinite(points) ? Math.max(0, points) : 0;
  const level = bondRankOf(safe, open, played);
  // Level 10 with the gate shut is what level 10 always was: a finished ladder, never a step toward 11.
  if (level === BOND_MAX_LEVEL || (level === MAX_LEVEL && !open))
    return { current: LEVEL_COSTS.at(-1)!, required: LEVEL_COSTS.at(-1)! };
  const cost = [...LEVEL_COSTS, ...BOND_COSTS][level - MIN_LEVEL]!;
  // A rank held back by its unplayed story shows a full bar, never more than it needs: the points past it wait there.
  return { current: Math.min(cost, Math.max(0, safe - levelFloor(level))), required: cost };
}

// ── Prestige (#2025): past level 20, affection keeps counting. Every POINTS_PER_LEVEL is a prestige point, and every
// PRESTIGE_POINTS_PER_STORY of them unlocks one extra story with him (S/items/prestige.ts); the pips then start again.
// All of it is derived from his points, which are never capped, so no affection is lost and nothing is stored but
// the stories written (their chapter keys `prestige-<li>-<n>`). 0.23.0: the origin moves from level 10 to level 20
// (BOND_MAX_POINTS) and needs the finale's gate, so the bond ranks come first and the infinite loop opens last. ──

/** The affection points at which level 10 is reached: where the bond ranks begin. */
export const MAX_LEVEL_POINTS = levelFloor(MAX_LEVEL);
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

/** His prestige from his affection points: all zero without the gate, below level 20, and at exactly level 20. */
export function prestigeOf(points: number, open = false): Prestige {
  const safe = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  const over = open ? Math.max(0, safe - BOND_MAX_POINTS) : 0;
  return {
    unlocked: Math.floor(over / PRESTIGE_CYCLE),
    points: Math.floor(over / POINTS_PER_LEVEL) % PRESTIGE_POINTS_PER_STORY,
    current: over % POINTS_PER_LEVEL,
    required: POINTS_PER_LEVEL,
  };
}

/** The number of the extra story to write next (from 1), or null while none is unlocked beyond the `written` ones. */
export function nextPrestige(points: number, written: number, open = false): number | null {
  return prestigeOf(points, open).unlocked > written ? written + 1 : null;
}

/**
 * Where a choice loss stops: the floor of the level reached, and at the last rank the last extra story unlocked, so a
 * loss never takes an unlocked story back (prestige points within the cycle may fall, as points within a level do).
 */
export function affectionFloorOf(points: number, open = false, played = 0): number {
  const safe = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  const level = bondRankOf(safe, open, played);
  return level < BOND_MAX_LEVEL
    ? levelFloor(level)
    : BOND_MAX_POINTS + prestigeOf(safe, open).unlocked * PRESTIGE_CYCLE;
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
  "tarot",
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
