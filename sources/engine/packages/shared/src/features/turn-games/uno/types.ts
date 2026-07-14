// ──────────────────────────────────────────────
// UNO — State, Cards, Moves, Config
// ──────────────────────────────────────────────

import { z } from "zod";
import type { GameEvent } from "../engine.types.js";

/** The four playable colors. Wild cards carry `color: "wild"` until played. */
export type UnoColor = "red" | "yellow" | "green" | "blue";
export const UNO_COLORS: readonly UnoColor[] = ["red", "yellow", "green", "blue"];

export type UnoCardColor = UnoColor | "wild";

/** Number cards "0".."9" plus the action/wild faces. */
export type UnoValue =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "skip"
  | "reverse"
  | "draw2"
  | "wild"
  | "wild4";

export interface UnoCard {
  /** Stable per-deck id (e.g. "red-7-12") so the UI and moves can reference an exact card. */
  id: string;
  color: UnoCardColor;
  value: UnoValue;
}

/** House rules. Defaults model "standard UNO" with the popular optional rules off. */
export interface UnoConfig {
  startingHandSize: number;
  /** +2/+4 may be stacked to pass an accumulating draw penalty to the next player. */
  stacking: boolean;
  /** With no playable card, keep drawing until one is playable (vs draw exactly one). */
  drawToMatch: boolean;
  /** 7 = swap hands with a chosen player; 0 = everyone passes hands in play direction. */
  sevenZero: boolean;
  /** A player may play an identical card (same color AND value) out of turn. */
  jumpIn: boolean;
  /** If the drawn card is playable, the player MUST play it (vs may keep it). */
  forcePlay: boolean;
  /** Cards drawn when caught not declaring UNO. 0 disables the catch rule. */
  unoPenalty: number;
}

/** A card face used to select a card by (color, value) when an exact id isn't known (model tool calls). */
export interface UnoCardFace {
  color: UnoCardColor;
  value: UnoValue;
}

/**
 * Discriminated move union. `sayUno` is a flag on a play, not a separate move.
 * `play`/`jump_in` may target a card by exact `cardId` (board UI) OR by `card`
 * face (model tool calls); at least one must be present.
 */
export type UnoMove =
  /** Play a card from hand. `declaredColor` is required iff the card is wild/wild4. */
  | { type: "play"; cardId?: string; card?: UnoCardFace; declaredColor?: UnoColor; sayUno?: boolean; swapTargetSeatId?: string }
  /** Draw from the pile (one card, or to-match per config). */
  | { type: "draw" }
  /** After a voluntary draw produced a playable card, play it instead of keeping it. */
  | { type: "play_drawn"; declaredColor?: UnoColor; sayUno?: boolean; swapTargetSeatId?: string }
  /** After a voluntary draw, keep the drawn card and end the turn. */
  | { type: "pass" }
  /** Resolve an accumulated +2/+4 penalty by drawing the whole stack. */
  | { type: "draw_penalty" }
  /** Out-of-turn: play an identical card (jump-in). */
  | { type: "jump_in"; cardId?: string; card?: UnoCardFace; declaredColor?: UnoColor; sayUno?: boolean }
  /** Out-of-turn: catch a player who reached one card without declaring UNO. */
  | { type: "call_out"; targetSeatId: string }
  /** Declare UNO while at one card (clears your catchable flag). Allowed out of turn. */
  | { type: "declare_uno" };

export type UnoStatus =
  /** Normal: the current seat must play, draw, or resolve a penalty. */
  | "awaiting_move"
  /** The current seat drew voluntarily and may play the drawn card or pass. */
  | "awaiting_post_draw"
  | "finished";

export interface UnoState {
  config: UnoConfig;
  seatOrder: string[];
  seatNames: Record<string, string>;
  drawPile: UnoCard[];
  /** Last element is the top of the discard. */
  discardPile: UnoCard[];
  /** The currently-active color (a wild overrides the top card's printed color). */
  activeColor: UnoColor;
  hands: Record<string, UnoCard[]>;
  /** Index into `seatOrder` of whose turn it is. */
  turnIndex: number;
  direction: 1 | -1;
  /** Accumulated draw penalty waiting to be drawn or stacked. */
  pendingDraw: number;
  /** Which draw card built the pending stack (governs stacking legality). */
  pendingDrawType: null | "draw2" | "wild4";
  /** Seats currently at one card who have NOT declared UNO (catchable). */
  mustCallUno: Record<string, boolean>;
  /** The card the current seat just drew voluntarily (only set while awaiting_post_draw). */
  drawnCardId: string | null;
  status: UnoStatus;
  winnerSeatId?: string;
  /** Seeded RNG state — `seed` is the original seed, `rngCursor` advances on every draw of randomness. */
  seed: number;
  rngCursor: number;
  /** Monotonic turn counter (for the UI + debugging). */
  turnCount: number;
  /** A short summary of the most recent resolved action (for the board). */
  lastAction: { seatId: string; summary: string } | null;
  /** Capped ring buffer of recent events (newest last) for the board log. */
  log: GameEvent[];
}

// ── Public (per-viewer) view rendered by the client board ───────────────────

export interface UnoPublicSeat {
  seatId: string;
  displayName: string;
  /** Number of cards held (other seats' hands are never revealed). */
  handCount: number;
  /** True while this seat is at one card and hasn't said UNO (catchable). */
  vulnerable: boolean;
  isCurrent: boolean;
}

export interface UnoPublicView {
  gameType: "uno";
  status: UnoStatus;
  activeColor: UnoColor;
  topCard: UnoCard | null;
  direction: 1 | -1;
  pendingDraw: number;
  drawPileCount: number;
  seats: UnoPublicSeat[];
  currentSeatId: string | null;
  winnerSeatId: string | null;
  /** The viewer's own hand, with per-card legality so the board can gate clicks. */
  yourSeatId: string | null;
  yourHand: Array<{ card: UnoCard; playable: boolean }>;
  /** Whether the viewer may draw / draw-penalty / pass right now. */
  yourActions: { canDraw: boolean; canDrawPenalty: boolean; canPass: boolean; mustDeclareUno: boolean };
  /** Seats the viewer can currently catch for failing to call UNO. */
  catchableSeatIds: string[];
  /** Whether the viewer may jump in right now, and with which cards. */
  jumpInCardIds: string[];
  lastAction: { seatId: string; summary: string } | null;
  config: UnoConfig;
  recentLog: GameEvent[];
}

// ── Zod schemas (validate untrusted config + move payloads at the boundary) ──

export const unoColorSchema = z.enum(["red", "yellow", "green", "blue"]);

const unoCardColorSchema = z.enum(["red", "yellow", "green", "blue", "wild"]);
const unoValueSchema = z.enum([
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "skip", "reverse", "draw2", "wild", "wild4",
]);
const unoCardFaceSchema = z.object({ color: unoCardColorSchema, value: unoValueSchema });

export const unoConfigSchema = z.object({
  startingHandSize: z.number().int().min(1).max(10),
  stacking: z.boolean(),
  drawToMatch: z.boolean(),
  sevenZero: z.boolean(),
  jumpIn: z.boolean(),
  forcePlay: z.boolean(),
  unoPenalty: z.number().int().min(0).max(10),
});

export const unoMoveSchema: z.ZodType<UnoMove> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("play"),
    cardId: z.string().optional(),
    card: unoCardFaceSchema.optional(),
    declaredColor: unoColorSchema.optional(),
    sayUno: z.boolean().optional(),
    swapTargetSeatId: z.string().optional(),
  }),
  z.object({ type: z.literal("draw") }),
  z.object({
    type: z.literal("play_drawn"),
    declaredColor: unoColorSchema.optional(),
    sayUno: z.boolean().optional(),
    swapTargetSeatId: z.string().optional(),
  }),
  z.object({ type: z.literal("pass") }),
  z.object({ type: z.literal("draw_penalty") }),
  z.object({
    type: z.literal("jump_in"),
    cardId: z.string().optional(),
    card: unoCardFaceSchema.optional(),
    declaredColor: unoColorSchema.optional(),
    sayUno: z.boolean().optional(),
  }),
  z.object({ type: z.literal("call_out"), targetSeatId: z.string() }),
  z.object({ type: z.literal("declare_uno") }),
]).superRefine((move, ctx) => {
  // `play` / `jump_in` must target a card by exact `cardId` OR by `card` face —
  // never neither (the move contract requires one or the other).
  if ((move.type === "play" || move.type === "jump_in") && move.cardId === undefined && move.card === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Specify the card to play by `cardId` or by `card` (color + value).",
      path: ["cardId"],
    });
  }
});

export const DEFAULT_UNO_CONFIG: UnoConfig = {
  startingHandSize: 7,
  stacking: false,
  drawToMatch: false,
  sevenZero: false,
  jumpIn: false,
  forcePlay: false,
  unoPenalty: 2,
};

export const UNO_MIN_PLAYERS = 2;
export const UNO_MAX_PLAYERS = 10;
export const UNO_LOG_CAP = 24;
