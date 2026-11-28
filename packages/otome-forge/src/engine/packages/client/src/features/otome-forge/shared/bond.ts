// ──────────────────────────────────────────────
// Otome Forge: the bond ranks, 11–20 (0.23.0)
// ──────────────────────────────────────────────
// After his finale (stage 6), affection keeps opening ranks, one at a time, each with a Character Story of its own
// (S/story/bond.ts writes it) that reveals how the relationship grows once the confession is behind them. A rank's
// story must be played before the next opens; the last one opens the prestige loop (#2025, C/shared/economy.ts).
// The names are fixed (the maintainer left the naming here, 2026-11-11) and one word each, so they fit the Story
// screen and read as a run of beats: Named, Kept, Told, Hungry, Tested, Afraid, Chosen, Ahead, Home, Always.
// `focus` is what the rank's story is about, and `reveal` what its bible entry holds (S/bond.ts generates it).
import type { LiId } from "./api-types";

/** One rank: the level, the name the UI shows, and what its story and its reveal are about. */
export interface BondRank {
  level: number;
  /** The rank's name, one word, not translated (like the stage names). */
  name: string;
  /** What this rank teaches her about him, for the story planner and the reveal generator. */
  focus: string;
  /** What its bible entry holds, one or two sentences, in the bible's voice. */
  reveal: string;
}

export const BOND_RANKS: readonly BondRank[] = [
  {
    level: 11,
    name: "named",
    focus: "What they are to each other now, said out loud: the first ordinary day of being together.",
    reveal: "what being with the protagonist is, in their own words",
  },
  {
    level: 12,
    name: "kept",
    focus: "Learning her habits and tells, and what she needs without having to ask.",
    reveal: "the small things they have learned about her, and the one they noticed first",
  },
  {
    level: 13,
    name: "told",
    focus: "A secret they have never told anyone, given to her because she is safe.",
    reveal: "a secret they have never told anyone",
  },
  {
    level: 14,
    name: "hungry",
    focus:
      "What they want in bed, told plainly and without shame; under SFW Heat, what they want and have never asked for.",
    reveal: "what they want, said plainly for the first time",
  },
  {
    level: 15,
    name: "tested",
    focus: "Their first real fight as a couple, and the hurt that lands before either of them explains it.",
    reveal: "the fault line between them, and how they come back from it",
  },
  {
    level: 16,
    name: "afraid",
    focus: "The drama at its height: the thought of leaving her to keep her safe, and what almost makes them do it.",
    reveal: "what frightens them about being loved, and the danger they think they bring her",
  },
  {
    level: 17,
    name: "chosen",
    focus: "Staying on purpose, and saying why, even knowing the cost.",
    reveal: "why they stay, in their own words",
  },
  {
    level: 18,
    name: "ahead",
    focus: "The life after this: marriage, children, growing old, and which of those they want with her.",
    reveal: "the future they want with her",
  },
  {
    level: 19,
    name: "home",
    focus: "Ordinary days; being known and staying anyway.",
    reveal: "what home means to them now",
  },
  {
    level: 20,
    name: "always",
    focus: "Settled, at rest in it; what forever looks like when neither of them is running any more.",
    reveal: "what forever means to them, and what they will do with it",
  },
] as const;

/** The rank for a level, or undefined below 11 and above 20. */
export const bondRankAt = (level: number): BondRank | undefined => BOND_RANKS[Math.trunc(level) - BOND_RANKS[0]!.level];

/** `story-bond-<li>-<level>`: the bond story that opens `level`. Its key needs no new chapter regex (S/ids.ts). */
export const bondStoryKey = (li: LiId, level: number) => `story-bond-${li}-${level}`;

/** The level a bond story key opens, or null for any other key. */
export function bondStoryLevel(key: string, li: LiId): number | null {
  const prefix = `story-bond-${li}-`;
  if (!key.startsWith(prefix)) return null;
  const level = Number(key.slice(prefix.length));
  return Number.isInteger(level) && bondRankAt(level) ? level : null;
}

/**
 * How many of his bond stories are played (read to their end). Derived from the chapters, never stored, so a rank cannot
 * be skipped by banking affection and an older story needs no new state field.
 */
export function bondStoriesPlayed(
  chapters: Record<string, { completed: string | null } | undefined>,
  li: LiId,
): number {
  // A bare state (a prompt built from a partial one) reads as no story played.
  return Object.entries(chapters ?? {}).filter(
    ([key, progress]) => !!progress?.completed && bondStoryLevel(key, li) !== null,
  ).length;
}

/**
 * 0.24.5: what his route shows past his finale (Story → Routes): the rank he stands at while its story waits, else the
 * next rank (rank 11 before he has one), else nothing at the last rank, where the route is complete. `bond` is his
 * view's (RunLiView.bond), absent below rank 11.
 */
export function bondStepOf(
  bond: { level: number; next: number | null } | undefined,
  waits: boolean,
): { waiting: BondRank } | { next: BondRank } | null {
  const reached = bond && bondRankAt(bond.level);
  if (reached && waits) return { waiting: reached };
  const next = bondRankAt(bond ? (bond.next ?? 0) : BOND_RANKS[0]!.level);
  return next ? { next } : null;
}
