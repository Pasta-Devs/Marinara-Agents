// ──────────────────────────────────────────────
// Tic-Tac-Toe — State, Moves, Config
// ──────────────────────────────────────────────
import { z } from "zod";
// ── Zod schemas (validate untrusted config + move payloads at the boundary) ──
export const ticTacToeConfigSchema = z.object({
    humanMark: z.enum(["X", "O", "random"]),
});
export const ticTacToeMoveSchema = z.object({
    type: z.literal("move"),
    cell: z.number().int().min(0).max(8),
});
export const DEFAULT_TIC_TAC_TOE_CONFIG = {
    humanMark: "random",
};
export const TIC_TAC_TOE_MIN_PLAYERS = 2;
export const TIC_TAC_TOE_MAX_PLAYERS = 2;
export const TIC_TAC_TOE_LOG_CAP = 24;
/** The 8 winning lines: 3 rows, 3 columns, 2 diagonals. */
export const TIC_TAC_TOE_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
];
//# sourceMappingURL=types.js.map