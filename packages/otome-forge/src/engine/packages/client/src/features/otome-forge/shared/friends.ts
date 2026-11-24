// ──────────────────────────────────────────────
// Otome Hearth: friends (#2458), the protagonist's close platonic friends, Persona's confidants in spirit
// ──────────────────────────────────────────────
// Pure TypeScript shared by both bundles. A friend has five levels, shown as stars, bought with affection on the love
// interests' first four steps (200, 250, 300, 350: level 5 at 1,100). A story holds as many friends as love interests,
// and at most one joins in each story arc (the arc number they joined in, 0 before the first arc). A friend who speaks
// in a main chapter read to its end earns FRIEND_CHAPTER_AFFECTION, as a story earning (never capped).
// Friends are kept apart from the love interests (`state.friends`, never `state.lis`), so no love-interest mechanic
// reaches them: no stage, confession, intimacy, date, Read Them or Claw.
import type { LiId } from "./api-types";
import { LEVEL_COSTS } from "./economy";
import type { Arcana } from "./tarot";

export const FRIEND_MAX_LEVEL = 5;
/** The points each friend level costs, from level 1→2 to 4→5: the love interests' first four steps. */
export const FRIEND_LEVEL_COSTS: readonly number[] = LEVEL_COSTS.slice(0, FRIEND_MAX_LEVEL - 1);
/** What a friend earns for speaking in a main chapter read to its end (as a Foil does). */
export const FRIEND_CHAPTER_AFFECTION = 50;
/** How a friend feels about the protagonist being with one love interest. */
export const FRIEND_STANCES = ["ships", "supports", "wary", "against"] as const;
export type FriendStance = (typeof FRIEND_STANCES)[number];

/** `${R}:state` friends[id]: their affection and the story arc they joined in. */
export interface FriendState {
  points: number;
  /** The story arc they joined in (0 before the first arc): one friend joins per arc. */
  arc: number;
  joinedAt: string;
}

/** A friend's bible (`unit.friend`): who they are, their growth over five ranks and their part in her love life. */
export interface FriendBible {
  /** 18 or older, always. */
  age: number;
  role: string;
  /** How they and the protagonist know each other. */
  howWeMet: string;
  publicFace: string;
  personality: string;
  wound: string;
  want: string;
  need: string;
  fear: string;
  flaws: string[];
  virtues: string[];
  voice: { register: string; tics: string[]; samples: { warm: string; teasing: string; worried: string } };
  likes: string[];
  dislikes: string[];
  /** What each rank of the friendship explores, "1" to "5"; "5" is their finale. */
  growth: Record<"1" | "2" | "3" | "4" | "5", string>;
  /** How they feel about her with each love interest, by id; one written later joins as they arrive. */
  onLis: Record<LiId, { stance: FriendStance; why: string }>;
  /** How they feel about her love life as a whole: worried, cheering her on, protective… */
  onHer: string;
  /** Their card in the Tarot deck (a rank-5 reward). */
  arcana: Arcana;
  /** English, visual-only tags. */
  look: { identityLine: string; outfitLine: string; presentation: "man" | "woman" | "person" };
}

const floors: readonly number[] = FRIEND_LEVEL_COSTS.reduce<number[]>(
  (sums, cost) => [...sums, sums.at(-1)! + cost],
  [0],
);

/** The friend level, 1–5, that `points` reach. */
export function friendLevelOf(points: number): number {
  const safe = Number.isFinite(points) ? Math.max(0, points) : 0;
  let level = 1;
  while (level < FRIEND_MAX_LEVEL && safe >= floors[level]!) level += 1;
  return level;
}

/** Progress within the current level; a full bar at level 5. */
export function friendProgressOf(points: number): { current: number; required: number } {
  const safe = Number.isFinite(points) ? Math.max(0, points) : 0;
  const level = friendLevelOf(safe);
  if (level === FRIEND_MAX_LEVEL) return { current: FRIEND_LEVEL_COSTS.at(-1)!, required: FRIEND_LEVEL_COSTS.at(-1)! };
  const cost = FRIEND_LEVEL_COSTS[level - 1]!;
  return { current: Math.min(cost, safe - floors[level - 1]!), required: cost };
}

/**
 * Why no friend may join now, or null when one may: the story holds as many friends as love interests (`full`), and
 * one joins per story arc (`arc`, while someone already joined in `arc`).
 */
export function friendBlock(
  loveInterests: number,
  friends: ReadonlyArray<Pick<FriendState, "arc">>,
  arc: number,
): "full" | "arc" | null {
  if (friends.length >= loveInterests) return "full";
  if (friends.some((friend) => friend.arc === arc)) return "arc";
  return null;
}
