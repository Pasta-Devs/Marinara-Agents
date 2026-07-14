// ──────────────────────────────────────────────
// Chess — State, Moves, Config
// ──────────────────────────────────────────────
import { z } from "zod";
// ── Zod schemas (validate untrusted config + move payloads at the boundary) ──
export const chessConfigSchema = z.object({
    humanColor: z.enum(["white", "black", "random"]),
});
export const chessMoveSchema = z.object({
    type: z.literal("move"),
    san: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    promotion: z.enum(["q", "r", "b", "n"]).optional(),
});
export const DEFAULT_CHESS_CONFIG = {
    humanColor: "random",
};
export const CHESS_MIN_PLAYERS = 2;
export const CHESS_MAX_PLAYERS = 2;
export const CHESS_LOG_CAP = 24;
//# sourceMappingURL=types.js.map