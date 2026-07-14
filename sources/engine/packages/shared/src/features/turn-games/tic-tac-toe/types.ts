// ──────────────────────────────────────────────
// Tic-Tac-Toe — State, Moves, Config
// ──────────────────────────────────────────────

import { z } from "zod";
import type { GameEvent } from "../engine.types.js";

export type TicTacToeMark = "X" | "O";

export interface TicTacToeConfig {
  /** Which mark the human plays. "random" resolves deterministically from the setup seed. X always moves first. */
  humanMark: TicTacToeMark | "random";
}

export type TicTacToeDrawReason = "board_full";

export interface TicTacToeMove {
  type: "move";
  /** Board index 0-8, row-major (0,1,2 / 3,4,5 / 6,7,8). */
  cell: number;
}

export type TicTacToeStatus = "active" | "finished";

export interface TicTacToeState {
  config: TicTacToeConfig;
  /** 9 cells, row-major; null = empty. */
  cells: Array<TicTacToeMark | null>;
  xSeatId: string;
  oSeatId: string;
  seatNames: Record<string, string>;
  seats: Array<{ seatId: string; displayName: string; kind: "human" | "bot" }>;
  status: TicTacToeStatus;
  winnerSeatId: string | null;
  /** The three winning cell indices, when `winnerSeatId` is set. */
  winningLine: number[] | null;
  drawReason: TicTacToeDrawReason | null;
  seed: number;
  lastMove: { cell: number; mark: TicTacToeMark; seatId: string } | null;
  lastAction: { seatId: string; summary: string } | null;
  log: GameEvent[];
}

// ── Public (per-viewer) view rendered by the client board ───────────────────

export interface TicTacToePublicSeat {
  seatId: string;
  displayName: string;
  mark: TicTacToeMark;
  kind: "human" | "bot";
  isCurrent: boolean;
}

export interface TicTacToePublicView {
  gameType: "tic-tac-toe";
  status: TicTacToeStatus;
  cells: Array<TicTacToeMark | null>;
  seats: TicTacToePublicSeat[];
  currentSeatId: string | null;
  winnerSeatId: string | null;
  winningLine: number[] | null;
  drawReason: TicTacToeDrawReason | null;
  yourSeatId: string | null;
  yourMark: TicTacToeMark | null;
  lastMove: { cell: number; mark: TicTacToeMark; seatId: string } | null;
  /** Populated only when the viewer IS the current seat — drives click-to-move. */
  legalMovesForYou: number[];
  lastAction: { seatId: string; summary: string } | null;
  config: TicTacToeConfig;
  recentLog: GameEvent[];
}

// ── Zod schemas (validate untrusted config + move payloads at the boundary) ──

export const ticTacToeConfigSchema = z.object({
  humanMark: z.enum(["X", "O", "random"]),
});

export const ticTacToeMoveSchema: z.ZodType<TicTacToeMove> = z.object({
  type: z.literal("move"),
  cell: z.number().int().min(0).max(8),
});

export const DEFAULT_TIC_TAC_TOE_CONFIG: TicTacToeConfig = {
  humanMark: "random",
};

export const TIC_TAC_TOE_MIN_PLAYERS = 2;
export const TIC_TAC_TOE_MAX_PLAYERS = 2;
export const TIC_TAC_TOE_LOG_CAP = 24;

/** The 8 winning lines: 3 rows, 3 columns, 2 diagonals. */
export const TIC_TAC_TOE_LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];
