// ──────────────────────────────────────────────
// Rock-Paper-Scissors — State, Moves, Config
// ──────────────────────────────────────────────
// Hidden-information game: each round is two SEQUENTIAL moves (seatA throws,
// then seatB throws) so it fits the single-`currentSeat()` turn contract, but
// the engine never reveals a pending throw to the other seat's prompt/view
// until both have thrown and the round resolves — from the outside it plays
// like simultaneous rock-paper-scissors.

import { z } from "zod";
import type { GameEvent } from "../engine.types.js";

export type RpsChoice = "rock" | "paper" | "scissors";

export interface RockPaperScissorsConfig {
  /** Wins needed to take the match. 2 = best-of-3, 3 = best-of-5, 4 = best-of-7. */
  roundsToWin: 2 | 3 | 4;
}

export interface RockPaperScissorsMove {
  type: "throw";
  choice: RpsChoice;
}

export type RockPaperScissorsStatus = "active" | "finished";

export interface RpsResolvedRound {
  round: number;
  throws: Record<string, RpsChoice>;
  /** null when the round was a tie (replayed with no score change). */
  winnerSeatId: string | null;
}

export interface RockPaperScissorsState {
  config: RockPaperScissorsConfig;
  /** Fixed seat order for the match; seatIds[0] always throws first each round (no informational advantage). */
  seatIds: [string, string];
  seatNames: Record<string, string>;
  seats: Array<{ seatId: string; displayName: string; kind: "human" | "bot" }>;
  status: RockPaperScissorsStatus;
  winnerSeatId: string | null;
  scores: Record<string, number>;
  roundNumber: number;
  /** The in-progress round's throws — server-private until both seats have thrown. */
  pendingThrows: Record<string, RpsChoice | null>;
  /** Resolved rounds, oldest first (both throws revealed once a round resolves). */
  rounds: RpsResolvedRound[];
  seed: number;
  lastAction: { seatId: string; summary: string } | null;
  log: GameEvent[];
}

// ── Public (per-viewer) view rendered by the client board ───────────────────

export interface RockPaperScissorsPublicSeat {
  seatId: string;
  displayName: string;
  kind: "human" | "bot";
  isCurrent: boolean;
  score: number;
}

export interface RockPaperScissorsPublicView {
  gameType: "rock-paper-scissors";
  status: RockPaperScissorsStatus;
  seats: RockPaperScissorsPublicSeat[];
  currentSeatId: string | null;
  winnerSeatId: string | null;
  roundNumber: number;
  roundsToWin: number;
  rounds: RpsResolvedRound[];
  yourSeatId: string | null;
  /** Your own throw for the in-progress round, once you've made it (never the opponent's). */
  yourPendingChoice: RpsChoice | null;
  /** Whether the opponent has already thrown this round (never reveals what). */
  opponentHasThrown: boolean;
  /** Populated only when it's your turn to throw. */
  legalMovesForYou: RpsChoice[];
  lastAction: { seatId: string; summary: string } | null;
  config: RockPaperScissorsConfig;
  recentLog: GameEvent[];
}

// ── Zod schemas (validate untrusted config + move payloads at the boundary) ──

export const rockPaperScissorsConfigSchema = z.object({
  roundsToWin: z.union([z.literal(2), z.literal(3), z.literal(4)]),
});

export const rockPaperScissorsMoveSchema: z.ZodType<RockPaperScissorsMove> = z.object({
  type: z.literal("throw"),
  choice: z.enum(["rock", "paper", "scissors"]),
});

export const DEFAULT_ROCK_PAPER_SCISSORS_CONFIG: RockPaperScissorsConfig = {
  roundsToWin: 2,
};

export const ROCK_PAPER_SCISSORS_MIN_PLAYERS = 2;
export const ROCK_PAPER_SCISSORS_MAX_PLAYERS = 2;
export const ROCK_PAPER_SCISSORS_LOG_CAP = 24;

export const RPS_CHOICES: readonly RpsChoice[] = ["rock", "paper", "scissors"];

/** What beats what: RPS_BEATS[a] === b means a beats b. */
export const RPS_BEATS: Record<RpsChoice, RpsChoice> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};
