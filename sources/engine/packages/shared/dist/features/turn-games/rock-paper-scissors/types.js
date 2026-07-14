// ──────────────────────────────────────────────
// Rock-Paper-Scissors — State, Moves, Config
// ──────────────────────────────────────────────
// Hidden-information game: each round is two SEQUENTIAL moves (seatA throws,
// then seatB throws) so it fits the single-`currentSeat()` turn contract, but
// the engine never reveals a pending throw to the other seat's prompt/view
// until both have thrown and the round resolves — from the outside it plays
// like simultaneous rock-paper-scissors.
import { z } from "zod";
// ── Zod schemas (validate untrusted config + move payloads at the boundary) ──
export const rockPaperScissorsConfigSchema = z.object({
    roundsToWin: z.union([z.literal(2), z.literal(3), z.literal(4)]),
});
export const rockPaperScissorsMoveSchema = z.object({
    type: z.literal("throw"),
    choice: z.enum(["rock", "paper", "scissors"]),
});
export const DEFAULT_ROCK_PAPER_SCISSORS_CONFIG = {
    roundsToWin: 2,
};
export const ROCK_PAPER_SCISSORS_MIN_PLAYERS = 2;
export const ROCK_PAPER_SCISSORS_MAX_PLAYERS = 2;
export const ROCK_PAPER_SCISSORS_LOG_CAP = 24;
export const RPS_CHOICES = ["rock", "paper", "scissors"];
/** What beats what: RPS_BEATS[a] === b means a beats b. */
export const RPS_BEATS = {
    rock: "scissors",
    paper: "rock",
    scissors: "paper",
};
//# sourceMappingURL=types.js.map