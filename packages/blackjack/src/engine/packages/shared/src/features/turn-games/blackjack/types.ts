// ──────────────────────────────────────────────
// Blackjack — State, Moves, Config
// ──────────────────────────────────────────────
// Every seated player plays their own hands against one house dealer. The
// engine plays the dealer itself; a Conversation character may VOICE the
// dealer (announcements only) and, when that character is also seated, sits
// out of the betting as the house.

import { z } from "zod";
import type { GameEvent } from "../engine.types.js";
import type { Card } from "../poker/deck.js";

// ── Config ───────────────────────────────────────────────────────────────────

export interface BlackjackConfig {
  /** Chips each player starts with. */
  startingBankroll: number;
  /** Smallest bet a round accepts. A player whose bankroll falls below it is out. */
  minBet: number;
  /** Decks in the shoe. The shoe is reshuffled before every round. */
  decks: number;
  /** House rule: the dealer hits a soft 17 (H17) instead of standing on it (S17). */
  dealerHitsSoft17: boolean;
  /** Session ends after this many rounds (richest player wins). 0 = until you are out of chips. */
  roundLimit: number;
  /**
   * Character that voices the dealer's announcements. `null` = a silent house
   * dealer. Narration only: it never changes the shoe or any rule.
   */
  dealerCharacterId: string | null;
}

export const blackjackConfigSchema = z.object({
  startingBankroll: z.number(),
  minBet: z.number(),
  decks: z.number(),
  dealerHitsSoft17: z.boolean(),
  roundLimit: z.number(),
  dealerCharacterId: z.string().nullable(),
});

export const DEFAULT_BLACKJACK_CONFIG: BlackjackConfig = {
  startingBankroll: 1000,
  minBet: 10,
  decks: 6,
  dealerHitsSoft17: false,
  roundLimit: 0,
  dealerCharacterId: null,
};

/** Integer-clamp an untrusted config into house-rule bounds. `minBet` is capped by the clamped bankroll. */
export function clampBlackjackConfig(
  raw: Partial<BlackjackConfig> | Record<string, unknown> | null | undefined,
): BlackjackConfig {
  const r = (raw ?? {}) as Partial<BlackjackConfig>;
  const intOr = (v: unknown, fallback: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : fallback;
  const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

  const startingBankroll = clamp(intOr(r.startingBankroll, DEFAULT_BLACKJACK_CONFIG.startingBankroll), 100, 1_000_000);
  const minBet = clamp(intOr(r.minBet, DEFAULT_BLACKJACK_CONFIG.minBet), 1, Math.floor(startingBankroll / 4));
  const decks = clamp(intOr(r.decks, DEFAULT_BLACKJACK_CONFIG.decks), 1, 8);
  const dealerHitsSoft17 = r.dealerHitsSoft17 === true;
  const roundLimit = clamp(intOr(r.roundLimit, DEFAULT_BLACKJACK_CONFIG.roundLimit), 0, 1000);
  const dealerCharacterId =
    typeof r.dealerCharacterId === "string" && r.dealerCharacterId.trim() ? r.dealerCharacterId : null;

  return { startingBankroll, minBet, decks, dealerHitsSoft17, roundLimit, dealerCharacterId };
}

export const BLACKJACK_MIN_PLAYERS = 2;
/** Seven spots at the table. A seated character dealer takes one of them. */
export const BLACKJACK_MAX_PLAYERS = 7;
export const BLACKJACK_LOG_CAP = 30;

// ── Moves ────────────────────────────────────────────────────────────────────

export type BlackjackAction = "hit" | "stand" | "double" | "split";

export type BlackjackMove =
  /** Betting phase: chips staked on this round's hand. */
  | { type: "bet"; amount: number }
  | { type: "hit" }
  | { type: "stand" }
  /** Double the stake on a two-card hand, take exactly one more card, then stand. */
  | { type: "double" }
  /** Split a pair into two hands (once per round), each with its own stake. */
  | { type: "split" }
  /** Human-only pacing move: legal only in `round_over`, only for the seat `currentSeat` points to. */
  | { type: "next_round" };

export const blackjackMoveSchema: z.ZodType<BlackjackMove> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bet"), amount: z.number() }),
  z.object({ type: z.literal("hit") }),
  z.object({ type: z.literal("stand") }),
  z.object({ type: z.literal("double") }),
  z.object({ type: z.literal("split") }),
  z.object({ type: z.literal("next_round") }),
]);

// ── State ────────────────────────────────────────────────────────────────────

export type BlackjackStatus = "betting" | "playing" | "round_over" | "finished";
export type BlackjackHandStatus = "playing" | "stood" | "busted" | "blackjack";
export type BlackjackOutcome = "blackjack" | "win" | "push" | "lose";

export interface BlackjackHand {
  cards: Card[];
  /** Chips staked on this hand (doubled hands carry the doubled stake). */
  bet: number;
  doubled: boolean;
  /** Came from a split: a two-card 21 here is a plain 21, not a blackjack. */
  fromSplit: boolean;
  status: BlackjackHandStatus;
  /** Set when the round settles. */
  outcome: BlackjackOutcome | null;
  /** Net chips won (+) or lost (-) on this hand once settled. */
  net: number;
}

export interface BlackjackState {
  config: BlackjackConfig;
  /** Seeded RNG root. Round N's shoe is `deterministicShuffle(shoe, seed, N)`, so a rewind redeals identically. */
  seed: number;
  seats: Array<{ seatId: string; displayName: string; kind: "human" | "bot" }>;
  /** Framework-compatibility name: the bot runner and context builder duck-type on it. Every seat, in table order. */
  seatOrder: string[];
  /** Framework-compatibility name: duck-typed by the bot runner / context builder. */
  seatNames: Record<string, string>;
  /** Seats that bet and play hands, in table order. Excludes a seated dealer character. */
  playerSeatIds: string[];
  bankrolls: Record<string, number>;
  /** Players who can no longer cover the minimum bet. They sit out every later round. */
  outSeatIds: string[];
  status: BlackjackStatus;
  /** 1-based. */
  roundNumber: number;
  roundsCompleted: number;
  /** Cards dealt so far from this round's shoe. */
  shoeCursor: number;
  /** This round's stakes; a player without an entry has not bet yet. */
  bets: Record<string, number>;
  hands: Record<string, BlackjackHand[]>;
  /** Index of the hand each player is acting on (only meaningful while splitting). */
  activeHandIndex: Record<string, number>;
  dealerCards: Card[];
  /** False while the hole card is face down. */
  dealerRevealed: boolean;
  currentSeatId: string | null;
  winnerSeatId: string | null;
  /** Queued dealer narration events, drained by `drainAnnouncements`. */
  pendingAnnouncements: GameEvent[];
  lastAction: { seatId: string; summary: string } | null;
  /** Capped ring buffer of recent events (newest last) for the board log. */
  log: GameEvent[];
}

// ── Public (per-viewer) view rendered by the client board ───────────────────

export interface BlackjackPublicHand {
  /** Compact codes, e.g. ["Ah", "Td"]. */
  cards: string[];
  total: number;
  soft: boolean;
  bet: number;
  doubled: boolean;
  status: BlackjackHandStatus;
  outcome: BlackjackOutcome | null;
  net: number;
}

export interface BlackjackPublicSeat {
  seatId: string;
  displayName: string;
  kind: "human" | "bot";
  /** True for a seated character who deals instead of playing. */
  isDealer: boolean;
  bankroll: number;
  /** This round's stake, or null before they bet. */
  bet: number | null;
  out: boolean;
  isCurrent: boolean;
  hands: BlackjackPublicHand[];
  activeHandIndex: number;
}

export interface BlackjackYourActions {
  canBet: boolean;
  minBet: number;
  maxBet: number;
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  canSplit: boolean;
  canNextRound: boolean;
}

export interface BlackjackPublicView {
  gameType: "blackjack";
  status: BlackjackStatus;
  roundNumber: number;
  roundLimit: number;
  /** Face-down hole card shows as null until the dealer reveals it. */
  dealerCards: Array<string | null>;
  /** The total of the dealer's visible cards. */
  dealerTotal: number | null;
  dealerRevealed: boolean;
  seats: BlackjackPublicSeat[];
  currentSeatId: string | null;
  yourSeatId: string | null;
  yourActions: BlackjackYourActions;
  winnerSeatId: string | null;
  lastAction: { seatId: string; summary: string } | null;
  recentLog: GameEvent[];
  config: BlackjackConfig;
  dealerCharacterId: string | null;
  hasPendingAnnouncements: boolean;
}
