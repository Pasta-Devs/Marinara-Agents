// ──────────────────────────────────────────────
// Otome Forge: the Claw Machine's prizes, numbers and wire shapes, shared by both bundles (plan M5 "Claw Machine")
// ──────────────────────────────────────────────
// Pure TypeScript. The client plays the round (C/lib/claw-physics.ts) and the server checks the catch list and pays it
// (S/minigames/claw.ts). Nothing here, and nothing in a round, calls a model or paints an image: the prizes are six
// drawn plushes plus each love interest's own, the animal that fits them, drawn once in the background (#1954,
// S/minigames/plush.ts), or until then their look (cut out once Home has made it) or their initials in a round frame.
import type { ActivityGrant, ClawCheat, LiId, LinesView } from "./api-types";

/** The outline every plush is drawn with, the series' and the love interests' own (S/minigames/plush.ts). */
export const PLUSH_INK = "#3b2a40";

/** The generic plush series, in shelf order. Weight (0 light … 1 heavy) makes a plush harder to hold. */
export const PLUSH_SERIES = ["chick", "bunny", "kitty", "star", "bear", "whale"] as const;
export type PlushSeries = (typeof PLUSH_SERIES)[number];

export const PLUSH_WEIGHT: Readonly<Record<PlushSeries, number>> = {
  chick: 0.1,
  bunny: 0.3,
  kitty: 0.4,
  star: 0.5,
  bear: 0.7,
  whale: 0.9,
};
/** A love interest's own plush weighs in the middle. */
export const LI_PLUSH_WEIGHT = 0.6;

/** `li:<li id>`: a love interest's own plush. */
export const liPlushId = (li: LiId) => `li:${li}`;
/** The love interest a plush id belongs to, or null for a series plush (or anything else). */
export function plushLi(prize: string): LiId | null {
  return prize.startsWith("li:") && prize.length > 3 ? prize.slice(3) : null;
}

export function isPlushSeries(value: unknown): value is PlushSeries {
  return typeof value === "string" && (PLUSH_SERIES as readonly string[]).includes(value);
}

/** The prizes in a machine played with `li`: the six series plushes and his own. The server accepts only these. */
export const clawPrizeIds = (li: LiId): string[] => [...PLUSH_SERIES, liPlushId(li)];

/** Drops in a round, alternating between the player and the partner. */
export const CLAW_DROPS = 6;
/** The most a round can catch: six drops and the one extra a cheat can add (a bonus drop or a nudged prize). */
export const CLAW_MAX_CATCHES = CLAW_DROPS + 1;
/** Cheers on the partner's turns that set off the cheat, once a round. */
export const CHEER_GOAL = 8;
/** The player's move timer, in seconds; a slowed swing (freeze) adds FREEZE_BONUS_SECONDS. */
export const CLAW_MOVE_SECONDS = 10;
export const FREEZE_BONUS_SECONDS = 5;
/**
 * Finished rounds the state keeps for each love interest (and each one's first-plush round beside them): enough to
 * answer a repeated finish, and his private memory of his newest rounds. One LI's play never evicts another's.
 */
export const CLAW_ROUNDS_KEPT = 40;

/** `c-<time base36>-<6 [a-z0-9]>`: made by the client when a round starts; a finish sent again names the same one. */
export const CLAW_ROUND_ID = /^c-[0-9a-z]{1,12}-[0-9a-z]{6}$/;

/** Who took a drop: the player, or the love interest she plays with. */
export type ClawPlayer = "me" | "partner";

export interface ClawCatch {
  prize: string;
  by: ClawPlayer;
}

/** POST /runs/:run/claw/finish. `cheered`: the cheer meter filled and his cheat went off this round. */
export interface ClawFinishInput {
  li: LiId;
  round: string;
  first: ClawPlayer;
  caught: ClawCatch[];
  cheered: boolean;
}

/** One finished round as `state.claw.rounds` keeps it: what was caught and what it paid, answered again on a replay. */
export interface ClawRound {
  id: string;
  li: LiId;
  /** His name when it was played, so his memory of it keeps its first wording after a rename. */
  name: string;
  at: string;
  first: ClawPlayer;
  caught: ClawCatch[];
  /** His cheat, when the cheer meter filled. */
  cheat: ClawCheat | null;
  paid: { starlight: number; affection: number };
  /** The daily cap took some of what the round would have paid. */
  capped: boolean;
  newPlush: string[];
  /** His own plush joined the shelf for the first time. */
  firstPlush: boolean;
  /** His plush line for that first time, from his fixed pack; absent until his pack exists (the client's fallback). */
  line?: string;
}

/** What POST .../claw/finish answers, the same again for a round already paid (`replay`). */
export interface ClawFinishResult {
  grants: ActivityGrant[];
  newPlush: string[];
  firstPlush: boolean;
  line?: string;
  capped: boolean;
  replay: boolean;
  /** The shelf and the wallet after the round. */
  plush: Record<string, number>;
  starlight: number;
}

/** GET /runs/:run/play: what the Dates hub and the Claw Machine show before a game. */
export interface PlayView {
  /** The request's local day, "YYYY-MM-DD". */
  dayKey: string;
  /** Activity Starlight earned today, and the day's cap. */
  starlight: { earned: number; cap: number };
  /** Affection from outside the story earned today per love interest, and the per-LI cap. */
  affection: { earned: Record<LiId, number>; cap: number };
  /** The plush shelf: prize id → how many. */
  plush: Record<string, number>;
  /**
   * How each love interest plays (bible.play), whether a rupture stands between them, and whether Date Night with them
   * is Make it right: the open date's own plan while its rupture stands when one is open (a date keeps the kind it was
   * planned with), else whether a rupture stands. `plush`: the picture their plush wears (their look, cut out once Home
   * has made the cut-out), absent without a look. `animal`: their own plush, the animal that fits them drawn as SVG
   * (#1954), as a data URL; absent until it is drawn, and it replaces the framed look when present. `lines`: the Claw Machine's lines, their fixed claw lines and the
   * cold ones a rupture uses (as GET /lis/:li/lines gives them, read here so the machine never queues a pack's write).
   */
  lis: Record<
    LiId,
    {
      cheat: ClawCheat;
      style: string;
      rupture: boolean;
      makeItRight: boolean;
      plush?: string;
      animal?: string;
      lines: Pick<LinesView, "claw" | "cold">;
    }
  >;
}
