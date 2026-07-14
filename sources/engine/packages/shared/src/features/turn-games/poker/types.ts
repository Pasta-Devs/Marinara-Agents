// ──────────────────────────────────────────────
// Poker (No-Limit Texas Hold'em) — State, Moves, Config
// ──────────────────────────────────────────────

import { z } from "zod";
import type { GameEvent } from "../engine.types.js";
import type { Card } from "./deck.js";

// ── Config ───────────────────────────────────────────────────────────────────

export interface PokerConfig {
  /** Chips each seat starts (and re-buys, if ever added) with. */
  startingStack: number;
  /**
   * The small blind. The big blind is ALWAYS 2x this value — derived at setup
   * time (`state.blinds.bigBlind`), never stored in config, so the two can
   * never drift apart.
   */
  smallBlind: number;
  /** Blinds double after every N completed hands. 0 disables escalation. */
  blindIncreaseEveryHands: number;
  /** Session ends after this many completed hands (chip leader wins). 0 = unlimited. */
  handLimit: number;
  /**
   * Character that voices dealer announcements (hand start, street deals,
   * showdown, blinds-up, game over) — narration only. `null` = a silent
   * "house" dealer; the engine still queues the same announcements either way,
   * it's the runner's choice whether/how to voice them. NEVER affects dealing,
   * shuffling, or any rule — see `pokerEngine.announcerCharacterId`.
   */
  dealerCharacterId: string | null;
}

export const pokerConfigSchema = z.object({
  startingStack: z.number(),
  smallBlind: z.number(),
  blindIncreaseEveryHands: z.number(),
  handLimit: z.number(),
  dealerCharacterId: z.string().nullable(),
});

export const DEFAULT_POKER_CONFIG: PokerConfig = {
  startingStack: 1000,
  smallBlind: 10,
  blindIncreaseEveryHands: 0,
  handLimit: 0,
  dealerCharacterId: null,
};

/** Integer-clamp a raw config into house-rule bounds. `smallBlind`'s ceiling depends
 * on the (already-clamped) `startingStack`, so the two fields must be clamped in order. */
export function clampPokerConfig(raw: Partial<PokerConfig> | Record<string, unknown> | null | undefined): PokerConfig {
  const r = (raw ?? {}) as Partial<PokerConfig>;
  const intOr = (v: unknown, fallback: number): number => {
    const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : fallback;
    return n;
  };
  const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

  const startingStack = clamp(intOr(r.startingStack, DEFAULT_POKER_CONFIG.startingStack), 100, 1_000_000);
  const smallBlind = clamp(intOr(r.smallBlind, DEFAULT_POKER_CONFIG.smallBlind), 1, Math.max(1, Math.floor(startingStack / 4)));
  const blindIncreaseEveryHands = Math.max(0, intOr(r.blindIncreaseEveryHands, DEFAULT_POKER_CONFIG.blindIncreaseEveryHands));
  const handLimit = Math.max(0, intOr(r.handLimit, DEFAULT_POKER_CONFIG.handLimit));
  const dealerCharacterId = typeof r.dealerCharacterId === "string" && r.dealerCharacterId.trim() ? r.dealerCharacterId : null;

  return { startingStack, smallBlind, blindIncreaseEveryHands, handLimit, dealerCharacterId };
}

export const POKER_MIN_PLAYERS = 2;
export const POKER_MAX_PLAYERS = 8;
export const POKER_LOG_CAP = 30;

// ── Moves ────────────────────────────────────────────────────────────────────

export type PokerMove =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  /** `amount` is the chips put in (this street's bet total, since currentBets[seat] was 0). */
  | { type: "bet"; amount: number }
  /** `toAmount` is the TOTAL this street's bet becomes (not the increment). */
  | { type: "raise"; toAmount: number }
  /** Push the entire remaining stack in — resolves to a bet/raise/call for the full stack. */
  | { type: "all_in" }
  /** Human-only pacing move: legal only in `hand_over`, only for the seat `currentSeat` points to. */
  | { type: "next_hand" };

export const pokerMoveSchema: z.ZodType<PokerMove> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("fold") }),
  z.object({ type: z.literal("check") }),
  z.object({ type: z.literal("call") }),
  z.object({ type: z.literal("bet"), amount: z.number() }),
  z.object({ type: z.literal("raise"), toAmount: z.number() }),
  z.object({ type: z.literal("all_in") }),
  z.object({ type: z.literal("next_hand") }),
]);

// ── State ────────────────────────────────────────────────────────────────────

export type PokerStatus = "active" | "hand_over" | "finished";
export type PokerStreet = "preflop" | "flop" | "turn" | "river";

export interface PokerPotAward {
  seatId: string;
  amount: number;
  /** "main pot" / "side pot 1" / "side pot 2" ... */
  label: string;
}

export interface PokerReveal {
  seatId: string;
  holeCards: Card[];
  /** e.g. "Full house, kings over nines". */
  label: string;
  /** The best 5 cards used, as compact codes (e.g. ["Kh","Kc","Kd","9s","9h"]). */
  bestFiveCodes: string[];
}

/** Outcome of the last completed hand — drives the board recap and dealer narration. */
export interface PokerHandResults {
  potAwards: PokerPotAward[];
  /** Every non-folded seat at showdown. Empty when the hand ended by everyone-folds
   * (no reveal happens in that case — the last seat standing wins uncontested). */
  reveals: PokerReveal[];
}

export interface PokerState {
  config: PokerConfig;
  /** Seeded RNG root. Each hand's deck is `deterministicShuffle(buildDeck(), seed, handNumber)`
   * — reproducible and rewind-safe without persisting the deck itself. */
  seed: number;
  seats: Array<{ seatId: string; displayName: string; kind: "human" | "bot" }>;
  /** Table seating order (fixed for the session). Framework-compatibility name: the
   * bot runner and context builder duck-type on this exact field name. */
  seatOrder: string[];
  /** Framework-compatibility name: duck-typed by the bot runner / context builder. */
  seatNames: Record<string, string>;
  stacks: Record<string, number>;
  status: PokerStatus;
  /** 1-based. */
  handNumber: number;
  buttonSeatId: string;
  /** Current blinds (may have escalated from config via `blindIncreaseEveryHands`). */
  blinds: { smallBlind: number; bigBlind: number };

  // ── per-hand fields (reset by setup / dealNewHand) ──
  holeCards: Record<string, Card[]>;
  community: Card[];
  street: PokerStreet;
  /** Cards consumed so far from this hand's derived deck (see `seed` above). */
  deckCursor: number;

  // ── betting (per-street unless noted) ──
  /** This street's bet-so-far per seat. Reset to {} at the start of each street. */
  currentBets: Record<string, number>;
  /** This HAND's total committed per seat (all streets) — the source for side-pot math. */
  committedTotal: Record<string, number>;
  betToMatch: number;
  /** Size of the last FULL raise this street (bigBlind at the start of every street). */
  lastRaiseSize: number;
  currentSeatId: string | null;
  /**
   * Seats that have acted (check/call/bet/raise/fold/all-in) since the last FULL
   * bet/raise this street. Cleared and reseeded with just the aggressor on every
   * FULL bet/raise; deliberately NOT cleared by an incomplete (short all-in) raise
   * — that's what stops an incomplete raise from reopening full raising rights for
   * seats that already acted (see `engine.ts`'s raise handler). The betting round
   * closes once every seat still in the hand and not all-in is BOTH in this set
   * AND has `currentBets[seat] === betToMatch`. Starting a street (or the blinds
   * at hand setup) does NOT put anyone in this set — that's what gives the big
   * blind its preflop option even when everyone else has limped to it.
   */
  actedSeatIds: string[];
  foldedSeatIds: string[];
  allInSeatIds: string[];
  /** Seats out of future hands (busted to 0 chips). */
  bustedSeatIds: string[];
  handsCompleted: number;
  winnerSeatId: string | null;
  /** The last completed hand's outcome, for the board recap. Null before the first hand ends. */
  handResults: PokerHandResults | null;
  /** Queued dealer narration events, drained by `drainAnnouncements`. */
  pendingAnnouncements: GameEvent[];
  lastAction: { seatId: string; summary: string } | null;
  /** Capped ring buffer of recent events (newest last) for the board log. */
  log: GameEvent[];
}

// ── Public (per-viewer) view rendered by the client board ───────────────────

export interface PokerPublicSeat {
  seatId: string;
  displayName: string;
  kind: "human" | "bot";
  stack: number;
  /** This street's bet so far. */
  streetBet: number;
  /** This hand's total committed (all streets). */
  committed: number;
  folded: boolean;
  allIn: boolean;
  busted: boolean;
  isButton: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isCurrent: boolean;
}

export interface PokerYourActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  /** Chips it costs to call (0 when check is available). */
  callAmount: number;
  canBet: boolean;
  minBet: number;
  canRaise: boolean;
  minRaiseTo: number;
  /** The maximum you can put your street total to, for either a bet or a raise
   * (i.e. your full stack, expressed as a street-total). */
  maxTo: number;
  canAllIn: boolean;
  canNextHand: boolean;
}

export interface PokerPublicView {
  gameType: "poker";
  status: PokerStatus;
  handNumber: number;
  street: PokerStreet;
  communityCodes: string[];
  communityShort: string[];
  /** Sum of `committedTotal` across all seats. */
  potTotal: number;
  blinds: { smallBlind: number; bigBlind: number };
  /** In `seatOrder` order. */
  seats: PokerPublicSeat[];
  currentSeatId: string | null;
  yourSeatId: string | null;
  /** The viewer's own hole cards only — never another seat's. */
  yourHoleCards: Array<{ code: string; short: string; label: string }>;
  /** The viewer's current best hand using the visible community cards, or null
   * before the flop (evaluateBest needs >= 5 cards, so it's only meaningful
   * once `community.length >= 3`). */
  yourHandLabel: string | null;
  yourActions: PokerYourActions;
  /** The last completed hand's outcome (reveals + pot awards). Public — the whole
   * table sees showdown reveals once a hand concludes. */
  handResults: PokerHandResults | null;
  winnerSeatId: string | null;
  lastAction: { seatId: string; summary: string } | null;
  recentLog: GameEvent[];
  config: PokerConfig;
  dealerCharacterId: string | null;
  hasPendingAnnouncements: boolean;
}
