// ──────────────────────────────────────────────
// Otome Hearth: Tarot night's cards, numbers and wire shapes, shared by both bundles (#2151)
// ──────────────────────────────────────────────
// Pure TypeScript. A reading lays out TAROT_CARDS of the 22 Major Arcana, each upright or reversed, as Past, Present
// and Future. In "reads-you" the love interest reads the protagonist's cards; in "you-read" the protagonist reads
// theirs, picking one of TAROT_READINGS readings for each card, and the love interest reacts. A reaction stays on the
// server (`${R}:tarot:<id>`) until its card is answered, and the first answer is final.
//
// The deck: with an image connection, each card is painted once, the first time it is drawn, and kept
// (`${R}:deck`). The protagonist's cards and the cards with nobody in them are one set for the story; the love
// interest's cards and the cards of the two of them are painted for each love interest (deckKey), so his card shows
// him. Without an image connection, or until a card is painted, the client draws our own SVG card.
import type { ActivityGrant, LiId, Paint } from "./api-types";
import type { Face } from "./faces";

/** The 22 Major Arcana; a card's index is its number (0, the Fool, to 21, the World). */
export const ARCANA = [
  "fool",
  "magician",
  "high-priestess",
  "empress",
  "emperor",
  "hierophant",
  "lovers",
  "chariot",
  "strength",
  "hermit",
  "wheel",
  "justice",
  "hanged-man",
  "death",
  "temperance",
  "devil",
  "tower",
  "star",
  "moon",
  "sun",
  "judgement",
  "world",
] as const;
export type Arcana = (typeof ARCANA)[number];

/** Who a card's picture shows: the protagonist, the love interest, the two of them, or nobody (scenery only). */
export type ArcanaFigure = "you" | "him" | "both" | "none";

export const ARCANA_FIGURES: Record<Arcana, ArcanaFigure> = {
  fool: "you",
  magician: "him",
  "high-priestess": "you",
  empress: "you",
  emperor: "him",
  hierophant: "him",
  lovers: "both",
  chariot: "him",
  strength: "you",
  hermit: "him",
  wheel: "none",
  justice: "you",
  "hanged-man": "him",
  death: "none",
  temperance: "both",
  devil: "him",
  tower: "none",
  star: "you",
  moon: "none",
  sun: "both",
  judgement: "both",
  world: "you",
};

/**
 * A card's place in the deck: the card itself for one of the protagonist or of nobody (one set for the story), and
 * `<card>@<li>` for one that shows the love interest (painted for each love interest).
 */
export function deckKey(card: Arcana, li: LiId): string {
  const figure = ARCANA_FIGURES[card];
  return figure === "him" || figure === "both" ? `${card}@${li}` : card;
}

/** How many cards a reading lays out, and how many readings the protagonist chooses from for each in "you-read". */
export const TAROT_CARDS = 3;
export const TAROT_READINGS = 3;

export const TAROT_POSITIONS = ["past", "present", "future"] as const;
export type TarotPosition = (typeof TAROT_POSITIONS)[number];

/** "reads-you": the love interest reads the protagonist's cards; "you-read": the protagonist reads theirs. */
export const TAROT_MODES = ["reads-you", "you-read"] as const;
export type TarotMode = (typeof TAROT_MODES)[number];

/** The question chips (the server words each in English for the prompt and memory; the UI shows its own label). */
export const TAROT_QUESTIONS = ["us", "coming", "heart"] as const;
export type TarotChip = (typeof TAROT_QUESTIONS)[number];
/** A question in the protagonist's own words, in characters. */
export const TAROT_QUESTION_MAX = 200;
/** A reading's question in "reads-you": a chip, or the protagonist's own words. */
export type TarotQuestion = { chip: TarotChip } | { own: string };

/** `tr-<time base36>-<6 [a-z0-9]>`: a reading's id, the `:reading` param. */
export const TAROT_READING_ID = /^tr-[0-9a-z]{1,12}-[0-9a-z]{6}$/;

export function isTarotReadingId(value: unknown): value is string {
  return typeof value === "string" && TAROT_READING_ID.test(value);
}

/** A line the love interest says, with the face they wear. */
export interface TarotLine {
  line: string;
  face: Face | "";
}

/** The protagonist's answer to a card ("you-read"): which reading, and the love interest's reaction to it. */
export interface TarotAnswer {
  pick: number;
  /** The reading the protagonist chose, in their own voice. */
  reading: string;
  reaction: string;
  face: Face | "";
}

/** A card as the client sees it: never a reaction before it is answered. */
export interface TarotCardView {
  card: Arcana;
  reversed: boolean;
  /** "reads-you": the love interest's reading of the card; "you-read": what they say as it turns. */
  line: string;
  face: Face | "";
  /** "you-read": the TAROT_READINGS readings the protagonist chooses from, in their voice. */
  readings?: string[];
  answer?: TarotAnswer;
}

/** POST /runs/:run/tarot, and GET's `open`: a reading. */
export interface TarotReadingView {
  id: string;
  li: LiId;
  mode: TarotMode;
  /** The protagonist's question ("reads-you"), or null (none asked, or "you-read", where the love interest asks it). */
  question: TarotQuestion | null;
  /** Where and how the cards are laid out (narration): it opens the reading and is its Love Timeline line. */
  context: string;
  /** The love interest's opening line ("you-read": the question they ask the cards). */
  opening: TarotLine;
  /** Past, Present and Future, in that order. */
  cards: TarotCardView[];
  closing: TarotLine;
  /** Set once it is finished: what it earned then ([] after the day's caps). */
  grants: ActivityGrant[] | null;
}

/** A painted card of the deck, as the client sees it (a pending one nothing paints here reads as stopped). */
export interface TarotDeckCard {
  card: Arcana;
  art: Paint;
}

/** GET /runs/:run/lis/:li/tarot */
export interface TarotView {
  /** Their unfinished reading, which Tarot night opens straight at; null for none. */
  open: TarotReadingView | null;
  /** The deck's cards claimed for painting that this love interest's readings show, by deckKey. */
  deck: Record<string, TarotDeckCard>;
}

/** POST .../tarot/:reading/finish */
export interface TarotFinishResult {
  grants: ActivityGrant[];
  starlight: number;
}

/** A finished reading's pay as `${R}:state` keeps it (`tarot.paid`): the once-only mark of the write that paid it. */
export interface TarotPaid {
  id: string;
  li: LiId;
  starlight: number;
  affection: number;
}
/** The newest paid readings the state keeps. */
export const TAROT_PAID_KEPT = 100;
