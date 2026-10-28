// ──────────────────────────────────────────────
// Otome Forge: Date Night's shapes and numbers (plan M5 "Date Night"), shared by the server and the client
// ──────────────────────────────────────────────
// A date is a chapter `date-<n>` of kind "date": a place, two looks, three beats of choices that the date's love
// interest scores against their likes and dislikes, and an outcome from the total over the first-play picks. Every
// outcome pays (SH/economy.ts, within the daily activity caps). During a rupture the date is "Make it right": a good or
// great outcome with every scene's choice made mends it. Pure TypeScript: types, constants and pure functions.
import type { ActivityGrant, Grievance, LiId, LiState, Paint } from "./api-types";
import type { MusicMood } from "./faces";

/** A date is three beats, each with one scored choice. */
export const DATE_BEATS = 3;

/** The places the player can pick; the planner adapts each to the world while keeping its spirit. */
export const DATE_PLACE_IDS = [
  "aquarium",
  "rooftop",
  "bookshop",
  "night-market",
  "observatory",
  "seaside",
  "cafe",
  "fairground",
] as const;
export type DatePlaceId = (typeof DATE_PLACE_IDS)[number];
/** The love interest picks the place (the plan names it). */
export const PARTNER_CHOICE = "partner-choice";
/** A place the story has painted (M2b's `world.places`): the date goes there, under its own name, before its art. */
export const STORY_PLACE = "story";
export type DatePlace = DatePlaceId | typeof PARTNER_CHOICE | typeof STORY_PLACE;
/** The picker's own cards, in order (the story's painted places follow them). */
export const DATE_PLACES: readonly DatePlace[] = [...DATE_PLACE_IDS, PARTNER_CHOICE];
/** Every kind of place a date can be at. */
export const DATE_PLACE_KINDS: readonly DatePlace[] = [...DATE_PLACES, STORY_PLACE];

export function isDatePlace(value: unknown): value is DatePlace {
  return typeof value === "string" && (DATE_PLACE_KINDS as readonly string[]).includes(value);
}

/** The scene each place opens in: its card's gradient and the reader's (SH/faces.ts MUSIC_MOODS). */
export const DATE_PLACE_MOODS: Record<DatePlace, MusicMood> = {
  aquarium: "tender",
  rooftop: "date",
  bookshop: "home",
  "night-market": "date",
  observatory: "confession",
  seaside: "tender",
  cafe: "home",
  fairground: "date",
  [PARTNER_CHOICE]: "confession",
  [STORY_PLACE]: "date",
};

/**
 * The look each of them wears: the base look until the Wardrobe (M4) owns more.
 * ponytail: only "base" exists; the ceiling is one look each, and the upgrade path is M4's owned looks by id.
 */
export const BASE_LOOK = "base";

/** How the love interest takes an option: 1 loves it, 0 lets it pass, −1 it grates. Hidden until the date ends. */
export type DateScore = -1 | 0 | 1;
export type DateOutcome = "great" | "good" | "awkward";
/** The total over the first-play picks at which a date is great (0 and 1 are good; below 0 is awkward). */
export const GREAT_DATE_AT = 2;

/** The outcome of a date whose picks scored `total` in all. */
export function dateOutcome(total: number): DateOutcome {
  return total >= GREAT_DATE_AT ? "great" : total >= 0 ? "good" : "awkward";
}

/** The grievance a rupture with them stands on while it is unresolved (open or festering), or null. */
export function standingRupture(liState: Pick<LiState, "rupture" | "grievances"> | undefined): Grievance | null {
  const id = liState?.rupture?.grievanceId;
  const grievance = id ? liState.grievances.find((item) => item.id === id) : undefined;
  return grievance && (grievance.status === "open" || grievance.status === "festering") ? grievance : null;
}

/**
 * The rupture a Make it right date still tries to mend: its grievance while the rupture stands on it, else null. A
 * date's scenes are written as they are read, so one whose rupture was mended (or moved on) elsewhere since it was
 * planned goes on as an ordinary date: its later scenes, the hub and its finish all follow this.
 */
export function stillToMend(
  plan: Pick<DatePlan, "li" | "makeItRight">,
  lis: Readonly<Record<LiId, Pick<LiState, "rupture" | "grievances">>>,
): Grievance | null {
  const rupture = plan.makeItRight ? standingRupture(lis[plan.li]) : null;
  return rupture?.id === plan.makeItRight ? rupture : null;
}

/** `chapter.date`: a date's own plan. The client never sees it whole (only a DateEntry). */
export interface DatePlan {
  li: LiId;
  place: DatePlace;
  /** Where it happens, named by the plan in the world's language (a story place keeps the name the story gave it). */
  placeName: string;
  herLook: string;
  hisLook: string;
  /** The evening may stumble: one of its choices may open a minor grievance (hidden). */
  goesWrong: boolean;
  /** The rupture grievance this date tries to mend ("Make it right"), or null. */
  makeItRight: string | null;
  /** The keepsake image: an English brief, and its paint once the player asks for it. */
  keepsake: { brief: string; art?: Paint };
}

/** One date as the client sees it. */
export interface DateEntry {
  key: string;
  li: LiId;
  title: string;
  place: DatePlace;
  placeName: string;
  /**
   * Make it right: an open date while the rupture it was planned for still stands (stillToMend); a finished one when
   * that rupture still stood as the date was counted.
   */
  makeItRight: boolean;
  /** reading: scenes still to read; done: read through, its outcome not counted yet; finished: counted. */
  state: "reading" | "done" | "finished";
  /** Once finished. */
  outcome: DateOutcome | null;
  plannedAt: string;
  /** When its last scene was read, or null. */
  completedAt: string | null;
  /** The keepsake's paint (a pending one no paint here owns reads as stopped), or null before any was asked for. */
  keepsake: Paint | null;
}

/** GET /runs/:run/dates */
export interface DatesView {
  /** Each love interest with a bible, in cast order: a rupture makes the next date "Make it right". */
  lis: Array<{ li: LiId; rupture: boolean; open: DateEntry | null }>;
  /** Finished dates, newest first. */
  dates: DateEntry[];
}

/** POST /runs/:run/dates */
export interface DateStartInput {
  li: LiId;
  place: DatePlace;
  /** With place "story": the painted place's key in `world.places`. */
  storyPlace?: string;
  herLook: string;
  hisLook: string;
}

/** A first-play pick of the date and how it landed, shown once the date is over. */
export interface DatePick {
  text: string;
  score: DateScore;
}

/** POST /runs/:run/dates/:key/finish */
export interface DateFinishResult {
  date: DateEntry;
  outcome: DateOutcome;
  picks: DatePick[];
  /** The love interest's last spoken line of the evening, or "". */
  line: string;
  /** Empty when nothing was earned: the day's caps, or a finish counted before (`replay`). */
  grants: ActivityGrant[];
  starlight: number;
  /** True when this request counted the date (false for a replay). */
  counted: boolean;
  /** This request mended the rupture: no rupture is left with them (false for a replay). */
  repaired: boolean;
  /**
   * A Make it right date that mended the rupture when it was counted: every scene's choice made, a good or great
   * outcome, and no rupture left with them after it (another rupture still owed keeps one standing, as M2b's repair
   * does). The same on a replay; false for an ordinary date and for one whose rupture was mended elsewhere first.
   */
  mends: boolean;
  keepsake: { offer: boolean };
}
