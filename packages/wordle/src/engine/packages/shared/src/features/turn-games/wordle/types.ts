// ──────────────────────────────────────────────
// Wordle — State, Moves, Config
// ──────────────────────────────────────────────
// A daily word race: every seat guesses the same word on its own board, one
// guess per turn. Seats see each other's colors, never each other's letters.

import { z } from "zod";
import type { GameEvent } from "../engine.types.js";

export const WORDLE_WORD_LENGTH = 5;
export const WORDLE_MAX_GUESSES = 6;
export const WORDLE_MIN_PLAYERS = 1;
export const WORDLE_MAX_PLAYERS = 8;
export const WORDLE_LOG_CAP = 24;

export interface WordleConfig {
  /** The player's local calendar day (YYYY-MM-DD). With the chat it picks the word, and it keys the daily record. */
  day: string;
  /** The chat the game is played in, so each chat has its own word of the day. */
  chatId: string;
  /** Each seat's daily streak going into today, from the package's record. Only flavors what characters know. */
  streaks: Record<string, number>;
  /** The characters to seat beside the human (null = every seat the Engine offers; empty = a solo game). */
  players: string[] | null;
}

/** correct = right letter, right spot; present = in the word elsewhere; absent = not in the word (or no more of it). */
export type WordleMark = "correct" | "present" | "absent";

export interface WordleGuess {
  word: string;
  marks: WordleMark[];
}

export type WordleBoardStatus = "playing" | "solved" | "failed";

export interface WordleBoard {
  guesses: WordleGuess[];
  status: WordleBoardStatus;
}

export interface WordleMove {
  type: "guess";
  word: string;
}

export type WordleStatus = "active" | "finished";

export interface WordleState {
  config: WordleConfig;
  /** The day's word. Server-private: publicView shows it only to a viewer who is done, or once the game is over. */
  answer: string;
  /** Seat ids in turn order (the human first). */
  order: string[];
  /** Index into `order` of the seat to guess next; always a seat that is still playing while the game is active. */
  turn: number;
  boards: Record<string, WordleBoard>;
  seatNames: Record<string, string>;
  seats: Array<{ seatId: string; displayName: string; kind: "human" | "bot" }>;
  status: WordleStatus;
  /** Everyone who solved it in the fewest guesses (a tie shares the win). */
  winnerSeatIds: string[];
  seed: number;
  lastAction: { seatId: string; summary: string } | null;
  log: GameEvent[];
}

// ── Public (per-viewer) view rendered by the client board ───────────────────

export interface WordlePublicRow {
  /** The guessed word, or null where the viewer may not see it (another player's row mid-game). */
  word: string | null;
  marks: WordleMark[];
}

export interface WordlePublicSeat {
  seatId: string;
  displayName: string;
  kind: "human" | "bot";
  isCurrent: boolean;
  status: WordleBoardStatus;
  rows: WordlePublicRow[];
}

export interface WordlePublicView {
  gameType: "wordle";
  status: WordleStatus;
  day: string;
  wordLength: number;
  maxGuesses: number;
  seats: WordlePublicSeat[];
  currentSeatId: string | null;
  yourSeatId: string | null;
  /** The best mark the viewer has seen for each letter they have guessed, for the on-screen keyboard. */
  yourLetters: Record<string, WordleMark>;
  /** The day's word, once the viewer's own board is done or the game is over; otherwise null. */
  answer: string | null;
  winnerSeatIds: string[];
  lastAction: { seatId: string; summary: string } | null;
  recentLog: GameEvent[];
}

// ── Zod schemas (validate untrusted config at the boundary) ─────────────────

export const wordleConfigSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  chatId: z.string().max(200),
  streaks: z.record(z.string(), z.number().int().min(0)),
  players: z.array(z.string()).nullable(),
});
