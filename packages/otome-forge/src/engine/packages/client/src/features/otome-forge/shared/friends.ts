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

/** A friend's grievance with her (#2458): opened by something that truly hurt them, cleared by a make-up story. */
export interface FriendGrievance {
  text: string;
  severity: "major" | "rupture";
  /** When it opened. */
  opened: string;
  /** Main chapters read to their end since it opened: their make-up story waits for FRIEND_SPACE_CHAPTERS of them. */
  space: number;
}

/** `${R}:state` friends[id]: their affection, the story arc they joined in, and what stands between you. */
export interface FriendState {
  points: number;
  /** The story arc they joined in (0 before the first arc): one friend joins per arc. */
  arc: number;
  joinedAt: string;
  /** Their grievance with her; null while none stands. While it stands they earn nothing and hangouts with them wait. */
  grievance: FriendGrievance | null;
  /** The story arc their last grievance opened in: at most one an arc. */
  grievanceArc: number | null;
  /** She told them she is upset with them (Story → Friends), since when; null while she isn't. */
  upset: { since: string } | null;
  /** When she accepted their invitation to clear the air; null again once its scene is read to its end. */
  asked: string | null;
  /** The story arc she last asked them to talk to a love interest for her (the rank-5 Wingman): once an arc. */
  wingmanArc: number | null;
}

/** Main chapters read to their end before a friend's make-up story opens. */
export const FRIEND_SPACE_CHAPTERS = 1;
/** What a friend's make-up story pays once it clears their grievance (as a love interest's repair does). */
export const FRIEND_CLEARED_AFFECTION = 300;
/** What a rank story pays when read to its end (as a route chapter does). */
export const FRIEND_RANK_STARLIGHT = 300;
/** A milder hurt in Messages costs this, never below the level reached. */
export const FRIEND_HURT_COST = 15;

/** A friend's grievance with her stands: they earn nothing, and hangouts with them wait. */
export const friendHeld = (friend: Pick<FriendState, "grievance"> | undefined | null): boolean => !!friend?.grievance;

/** A new friend's state. */
export const defaultFriendState = (arc: number, joinedAt: string): FriendState => ({
  points: 0,
  arc,
  joinedAt,
  grievance: null,
  grievanceArc: null,
  upset: null,
  asked: null,
  wingmanArc: null,
});

/**
 * The kinds of a friend's own story (#2458, kind "story"): a rank story at each level from 2 to 5 (level 5's is their
 * finale), a make-up story while their grievance stands, a scene to clear the air while she is upset with them, and a
 * hangout with one friend or several.
 */
export const FRIEND_STORY_KINDS = ["rank", "mend", "clear-air", "hangout"] as const;
export type FriendStoryKind = (typeof FRIEND_STORY_KINDS)[number];

/** A friend's rank story for `level` (2–5). */
export const friendRankKey = (id: LiId, level: number) => `story-friend-${id}-${level}`;
/** A friend's make-up story, the `n`th. */
export const friendMendKey = (id: LiId, n: number) => `story-friend-mend-${id}-${n}`;
/** A friend's scene to clear the air, the `n`th. */
export const friendAirKey = (id: LiId, n: number) => `story-friend-air-${id}-${n}`;
/** A hangout, the `n`th. */
export const hangoutKey = (n: number) => `story-hangout-${n}`;
/** #2459: the story's epilogue. */
export const EPILOGUE_KEY = "story-epilogue";

const FRIEND_AIR = /^story-friend-air-(li-[a-z0-9-]+)-([1-9]\d{0,5})$/;
/** The friend and number a clear-the-air scene's key names, or null for any other chapter. */
export function friendAirOfKey(key: string): { id: LiId; n: number } | null {
  const match = FRIEND_AIR.exec(key);
  return match ? { id: match[1]!, n: Number(match[2]) } : null;
}

/** The points at which friend level `level` (1–5) is reached. */
export function friendLevelFloor(level: number): number {
  return floors[Math.min(FRIEND_MAX_LEVEL, Math.max(1, Math.trunc(level))) - 1]!;
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

/**
 * The rank the story has reached with a friend, as the prompts tell it: their level, but no further than their rank
 * stories read (rank n is reached once its story is), as a love interest's bond rank follows his bond stories.
 */
export function friendRankOf(
  points: number,
  chapters: Readonly<Record<string, { completed: unknown } | undefined>>,
  id: LiId,
): number {
  let played = 1;
  while (played < FRIEND_MAX_LEVEL && chapters[friendRankKey(id, played + 1)]?.completed) played += 1;
  return Math.min(friendLevelOf(points), played);
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
