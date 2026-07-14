// ──────────────────────────────────────────────
// UNO — State, Cards, Moves, Config
// ──────────────────────────────────────────────
import { z } from "zod";
export const UNO_COLORS = ["red", "yellow", "green", "blue"];
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
export const unoMoveSchema = z.discriminatedUnion("type", [
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
export const DEFAULT_UNO_CONFIG = {
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
//# sourceMappingURL=types.js.map