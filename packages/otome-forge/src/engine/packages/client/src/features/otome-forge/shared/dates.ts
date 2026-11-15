// ──────────────────────────────────────────────
// Otome Forge: Date Night's shapes and numbers (plan M5 "Date Night"), shared by the server and the client
// ──────────────────────────────────────────────
// A date is a chapter `date-<n>` of kind "date": a place, the looks they wear, beats of choices that the love interests
// on it score against their likes and dislikes, and an outcome from the total over the first-play picks. Every outcome
// pays (SH/economy.ts, within the daily activity caps). #2128: the protagonist may bring one gift bought in the Shop
// (SH/shop.ts), given in the date's first scene (GIFT_BEAT); it earns its own affection when the date is counted.
// #2303: dates are won from Wish's Dates banner (SH/wish.ts date5, date4) and played with whoever the player takes, one
// love interest or several. A date is written once per love interest: once someone has been on it, it only replays for
// them, and a group with someone new writes a new playthrough (another `date-<n>`). Only a new playthrough pays, and
// its affection is split among those on that date for the first time. Date Night (a date planned from a place picked
// on the day, Make it right during a rupture, an evening to clear the air, a double date) is no longer started; the
// ones a story already has stay readable and can be finished.
// Pure TypeScript: types, constants and pure functions.
import type { ActivityGrant, Grievance, LiId, LiState, Paint } from "./api-types";
import type { MusicMood } from "./faces";
import type { GiftId } from "./shop";
import type { ItemView } from "./wish";

/** Date Night's dates were three beats, each with one scored choice; a pulled date has its item's scenes. */
export const DATE_BEATS = 3;
/** #2128: the scene (node index) a gift brought on the date is given in: the first, as the evening opens. */
export const GIFT_BEAT = 0;

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
/** #2303: a pulled date's own place (its item's). */
export const PULLED_PLACE = "pulled";
export type DatePlace = DatePlaceId | typeof PARTNER_CHOICE | typeof STORY_PLACE | typeof PULLED_PLACE;
/** The picker's own cards, in order (the story's painted places follow them). */
export const DATE_PLACES: readonly DatePlace[] = [...DATE_PLACE_IDS, PARTNER_CHOICE];
/** Every kind of place a date can be at. */
export const DATE_PLACE_KINDS: readonly DatePlace[] = [...DATE_PLACES, STORY_PLACE, PULLED_PLACE];

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
  [PULLED_PLACE]: "date",
};

/**
 * The look each of them wears: the base look until the Wardrobe (M4) owns more.
 * ponytail: only "base" exists; the ceiling is one look each, and the upgrade path is M4's owned looks by id.
 */
export const BASE_LOOK = "base";

/** How the love interest takes an option: 1 loves it, 0 lets it pass, −1 it grates. Hidden until the date ends. */
export type DateScore = -1 | 0 | 1;
export type DateOutcome = "great" | "good" | "awkward";
/** The total over a three-scene date's first-play picks at which it is great (0 and 1 are good; below 0 awkward). */
export const GREAT_DATE_AT = 2;

/**
 * The outcome of a date of `scenes` scenes whose picks scored `total` in all. #2303: a won date has 1 to 6 scenes, one
 * scored choice each, so great takes the same share of its best total as two of three does: 1 of 1, 2 of 2 or 3, 3 of
 * 4, 4 of 5 or 6.
 */
export function dateOutcome(total: number, scenes = DATE_BEATS): DateOutcome {
  const great = Math.max(1, Math.ceil((scenes * GREAT_DATE_AT) / DATE_BEATS));
  return total >= great ? "great" : total >= 0 ? "good" : "awkward";
}

/** The grievance a rupture with them stands on while it is unresolved (open or festering), or null. */
export function standingRupture(liState: Pick<LiState, "rupture" | "grievances"> | undefined): Grievance | null {
  const id = liState?.rupture?.grievanceId;
  const grievance = id ? liState.grievances.find((item) => item.id === id) : undefined;
  return grievance && (grievance.status === "open" || grievance.status === "festering") ? grievance : null;
}

/**
 * #2156: his grievance with her stands (a rupture he holds): he can't lead a chapter, earns no affection, and his
 * dates wait until his repair clears it.
 */
export function heldAgainst(liState: Pick<LiState, "rupture" | "grievances"> | undefined): boolean {
  return standingRupture(liState)?.by === "li";
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
  /** #2128: the gift the protagonist brought and gives in scene GIFT_BEAT; absent on a date without one. */
  gift?: GiftId;
  /** #2156: the evening he asked her out on to clear the air, after she told him she was upset with him (Date Night). */
  clearAir?: true;
  /** A double date: the second love interest invited along. The evening is written for the three of them. */
  second?: LiId;
  /** #2303: a pulled date's item id. */
  item?: string;
  /** #2303: everyone the protagonist took, `li` first. */
  cast?: LiId[];
  /** #2303: those on this date for the first time when it was planned: its affection is theirs. */
  newcomers?: LiId[];
  /** #2303: a 5★ date: one of its scenes holds its key image. */
  grand?: true;
}

/** Everyone on a date: a pulled date's cast, else Date Night's love interest and, on a double date, the second. */
export const dateCast = (plan: Pick<DatePlan, "li" | "second" | "cast">): LiId[] =>
  plan.cast?.length ? plan.cast : plan.second ? [plan.li, plan.second] : [plan.li];

/** Who a counted date pays: a pulled date's first-timers, else everyone on it. */
export const datePayees = (plan: Pick<DatePlan, "li" | "second" | "cast" | "newcomers">): LiId[] =>
  plan.newcomers ?? dateCast(plan);

/** #2303: the scene of a 5★ date that holds its key image: the one before its last (the first of a short one). */
export const keyImageScene = (scenes: number) => Math.max(0, scenes - 2);

/** One date as the client sees it. */
export interface DateEntry {
  key: string;
  li: LiId;
  /** The second love interest a double date invited, or undefined for a date for two. */
  second?: LiId;
  /** #2303: a pulled date's item id, and everyone on it. */
  item?: string;
  cast?: LiId[];
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
  /** #2128: the gift the protagonist gave on it, when there was one. */
  gift?: GiftId;
}

/** GET /runs/:run/dates */
export interface DatesView {
  /** Finished dates, newest first. */
  dates: DateEntry[];
  /** #2303: every date not counted yet (one read to its end included), newest first. */
  open: DateEntry[];
  /** #2303: each date won from Wish, newest first, with its playthroughs. */
  pulled: PulledDate[];
}

/** #2303: a date won from Wish: the item, its playthroughs (newest first), and everyone who has been on it. */
export interface PulledDate {
  item: ItemView;
  plays: DateEntry[];
  playedBy: LiId[];
  /** Won and not looked at yet (0.21.0's unseen items): the Album's Dates tab shows a dot until it is opened. */
  new?: true;
}

/** POST /runs/:run/dates/pulled: whom to take on an owned date, her look, and a gift if she brings one. */
export interface PulledDateInput {
  item: string;
  /** One love interest or several, each once. */
  cast: LiId[];
  herLook: string;
  gift?: GiftId;
}

/**
 * #2303: the chapter key of the `n`th scene to clear the air with a love interest: a Character Story (`story-`) with no
 * item behind it, opened when the protagonist accepts his invitation (S/phone/upset.ts).
 */
export const clearAirSceneKey = (li: LiId, n: number) => `story-clear-air-${li}-${n}`;

const CLEAR_AIR = /^story-clear-air-(li-[a-z0-9-]+)-([1-9]\d{0,5})$/;

/** The love interest and number a clear-the-air scene's key names, or null for any other chapter. */
export function clearAirOfKey(key: string): { li: LiId; n: number } | null {
  const match = CLEAR_AIR.exec(key);
  return match ? { li: match[1]!, n: Number(match[2]) } : null;
}

/** #2303: the love interests of `cast` who have not been on this date yet (`playedBy`): a new playthrough is theirs. */
export const newcomersOf = (cast: readonly LiId[], playedBy: readonly LiId[]) =>
  cast.filter((li) => !playedBy.includes(li));

/** POST /runs/:run/dates */
export interface DateStartInput {
  li: LiId;
  place: DatePlace;
  /** With place "story": the painted place's key in `world.places`. */
  storyPlace?: string;
  herLook: string;
  hisLook: string;
  /** #2128: one gift she owns (and the story's Heat offers) to give on the date; spent once the date is planned. */
  gift?: GiftId;
  /** A double date: a second love interest at level 10 (DOUBLE_DATE_LEVEL) to invite; affection is split between them. */
  second?: LiId;
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
