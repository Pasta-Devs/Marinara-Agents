// ──────────────────────────────────────────────
// Otome Hearth: Read Me's numbers and wire shapes, and the notebook it fills, shared by both bundles (#1945)
// ──────────────────────────────────────────────
// Pure TypeScript. Read Me is Read Him in reverse: a love interest studies the protagonist and makes READ_ME_GUESSES
// guesses about them, each in a notebook category. The player answers each with a verdict (Spot on, Close, Not at
// all), and may add the truth in their own words. A guess's reactions stay on the server (`${R}:readme:${setId}`) until
// it is answered; the first answer is final.
//
// The notebook (`LiState.known`) is what that love interest has come to know about the protagonist. Finishing a set
// writes one entry per answered guess, in the same state write as its pay. The player can read every entry, change
// the words they gave, and delete it. It is that love interest's alone: only prompts about them carry it (story/
// prompts.ts knowsAboutYou), never another love interest's, a planner's view of others, a banner or a care note, and
// it is never a story-memory source, so a delete is final. Nothing from the period tracker ever reaches it.
import type { ActivityGrant, LiId } from "./api-types";
import type { Face } from "./faces";

export const READ_ME_GUESSES = 4;

/** `rm-<time base36>-<6 [a-z0-9]>`: a set's id, the `:set` param. */
export const READ_ME_SET_ID = /^rm-[0-9a-z]{1,12}-[0-9a-z]{6}$/;

export function isReadMeSetId(value: unknown): value is string {
  return typeof value === "string" && READ_ME_SET_ID.test(value);
}

/** What a guess is about, and the notebook's sections, in their order. */
export const NOTEBOOK_CATEGORIES = ["likes", "dislikes", "habits", "fears", "dreams", "other"] as const;
export type NotebookCategory = (typeof NOTEBOOK_CATEGORIES)[number];

/** Spot on, Close, Not at all. */
export const READ_ME_VERDICTS = ["right", "close", "wrong"] as const;
export type ReadMeVerdict = (typeof READ_ME_VERDICTS)[number];

/** The longest answer in the player's own words, in characters (after whitespace is collapsed). */
export const READ_ME_WORDS_MAX = 200;

/** One thing a love interest knows about the protagonist (`LiState.known`). */
export interface NotebookEntry {
  /** `${setId}/${guess index}`: from a Read Me answer; the edit and delete key. */
  id: string;
  category: NotebookCategory;
  /** The guess, as the love interest put it: one short sentence about the protagonist. */
  text: string;
  verdict: ReadMeVerdict;
  /** The truth in the player's own words, when they gave it (or wrote it later). */
  words?: string;
  at: string;
}
/** The newest entries each love interest keeps. */
export const NOTEBOOK_MAX = 60;

/** What answering a guess reveals: the love interest's reaction to that verdict. The first answer is final. */
export interface ReadMeAnswer {
  verdict: ReadMeVerdict;
  /** Their reaction, in their own words. */
  reaction: string;
  /** The face they make reacting; "" for a plain look. */
  face: Face | "";
  words?: string;
}

/** A guess as the client sees it: never the reactions until `answer` is there. */
export interface ReadMeGuessView {
  category: NotebookCategory;
  /** The guess, in the love interest's voice, said to the protagonist. */
  line: string;
  /** The face worn saying it. */
  face: Face | "";
  answer?: ReadMeAnswer;
}

/** POST /runs/:run/read-me {li}: their unfinished set, or a new one. */
export interface ReadMeSetView {
  setId: string;
  li: LiId;
  /** Where and how they sit down to study the protagonist (narration). */
  context: string;
  guesses: ReadMeGuessView[];
  /** Set once the set is finished: what it earned then ([] after the day's caps). */
  grants: ActivityGrant[] | null;
}

/**
 * A finished set's pay as `${R}:state` keeps it (`readMe.paid`): its id is the once-only mark of the state write that
 * paid it and wrote its notebook entries, and its pay answers a finish sent again.
 */
export interface ReadMePaid {
  setId: string;
  li: LiId;
  starlight: number;
  affection: number;
}
/** The newest paid sets the state keeps. */
export const READ_ME_PAID_KEPT = 100;

/** POST .../read-me/:set/finish */
export interface ReadMeFinishResult {
  /** What finishing earned; [] when the day's caps were reached. The same on every later call. */
  grants: ActivityGrant[];
  /** The wallet after it. */
  starlight: number;
  /** The love interest's notebook after it. */
  known: NotebookEntry[];
}

/** GET /runs/:run/lis/:li/notebook, and the answer to every edit or delete. */
export interface NotebookView {
  li: LiId;
  entries: NotebookEntry[];
}
