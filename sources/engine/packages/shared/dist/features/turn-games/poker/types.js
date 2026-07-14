// ──────────────────────────────────────────────
// Poker (No-Limit Texas Hold'em) — State, Moves, Config
// ──────────────────────────────────────────────
import { z } from "zod";
export const pokerConfigSchema = z.object({
    startingStack: z.number(),
    smallBlind: z.number(),
    blindIncreaseEveryHands: z.number(),
    handLimit: z.number(),
    dealerCharacterId: z.string().nullable(),
});
export const DEFAULT_POKER_CONFIG = {
    startingStack: 1000,
    smallBlind: 10,
    blindIncreaseEveryHands: 0,
    handLimit: 0,
    dealerCharacterId: null,
};
/** Integer-clamp a raw config into house-rule bounds. `smallBlind`'s ceiling depends
 * on the (already-clamped) `startingStack`, so the two fields must be clamped in order. */
export function clampPokerConfig(raw) {
    const r = (raw ?? {});
    const intOr = (v, fallback) => {
        const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : fallback;
        return n;
    };
    const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
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
export const pokerMoveSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("fold") }),
    z.object({ type: z.literal("check") }),
    z.object({ type: z.literal("call") }),
    z.object({ type: z.literal("bet"), amount: z.number() }),
    z.object({ type: z.literal("raise"), toAmount: z.number() }),
    z.object({ type: z.literal("all_in") }),
    z.object({ type: z.literal("next_hand") }),
]);
//# sourceMappingURL=types.js.map