// ──────────────────────────────────────────────
// Otome Forge: Read Him's numbers and wire shapes, shared by both bundles (plan M5 "Read Him", P25)
// ──────────────────────────────────────────────
// Pure TypeScript. A set is five rounds: a moment, what the love interest says, the face worn saying it, and three or
// four readings of what is really felt. The true reading, the thought and the tell stay on the server
// (`${R}:readhim:${setId}`) until that round is answered; a round's answer is fixed by the first pick. Finishing pays
// Read Him's Starlight and affection (SH/economy.ts, within the day's activity caps) however many were read right,
// and the tells read right join the love interest's `tellsLearned`, which every later scene card carries.
import type { ActivityGrant, LiId } from "./api-types";
import type { Face } from "./faces";

export const READ_HIM_ROUNDS = 5;
export const READINGS_MIN = 3;
export const READINGS_MAX = 4;

/** `rh-<time base36>-<6 [a-z0-9]>`: a set's id, the `:set` param. */
export const READ_HIM_SET_ID = /^rh-[0-9a-z]{1,12}-[0-9a-z]{6}$/;

export function isReadHimSetId(value: unknown): value is string {
  return typeof value === "string" && READ_HIM_SET_ID.test(value);
}

/** What answering a round reveals. `pick` is the first pick made for it, which later answers return unchanged. */
export interface ReadHimAnswer {
  pick: number;
  correct: boolean;
  trueIndex: number;
  /** His thought in that moment, in his own words. */
  thought: string;
  /** The tell that gave him away, when it was read right. */
  tellLearned?: string;
}

/** A round as the client sees it: never the true reading, the thought or the tell until `answer` is there. */
export interface ReadHimRoundView {
  context: string;
  line: string;
  /** The face worn saying the line; "" for a plain look. It may contradict the words. */
  face: Face | "";
  readings: string[];
  answer?: ReadHimAnswer;
}

/** POST /runs/:run/read-him {li}: his unfinished set at this stage, or a new one. */
export interface ReadHimSetView {
  setId: string;
  li: LiId;
  rounds: ReadHimRoundView[];
  /** Set once the set is finished: what it earned then ([] after the day's caps). */
  grants: ActivityGrant[] | null;
}

/**
 * A finished set's pay as `${R}:state` keeps it (`readHim.paid`): its id is the once-only mark of the state write that
 * paid it, learned its tells and put the first Read Him on the timeline, and its pay answers a finish sent again.
 */
export interface ReadHimPaid {
  setId: string;
  li: LiId;
  starlight: number;
  affection: number;
}
/** The newest paid sets the state keeps. */
export const READ_HIM_PAID_KEPT = 100;

/** POST .../read-him/:set/finish */
export interface ReadHimFinishResult {
  /** What finishing earned; [] when the day's caps were reached. The same on every later call. */
  grants: ActivityGrant[];
  /** The wallet after it. */
  starlight: number;
}
