// ──────────────────────────────────────────────
// 8-Ball Pool — State, Moves, Config, Table Constants
// ──────────────────────────────────────────────
// PHYSICS model (v2): real 2D ball positions on a real table. Every shot that
// actually fires (human `aimed`, bot `menu`) is executed through physics.ts's
// deterministic simulation — a shot's outcome is whatever the balls actually
// do, not a seeded-RNG roll against a difficulty score. The candidate-shot
// menu (see geometry.ts) still exists and is still generated every turn —
// bots pick from it in character, and the engine converts that pick into an
// aim vector + power with skill/style-based jitter, then runs the SAME sim a
// human's `aimed` move would. `successPct` on a candidate is now an advisory
// estimate for the bot prompt, not a resolution mechanism. See
// packages/shared/src/features/turn-games/poker for the sibling pattern this
// still mirrors for seats/announcements/tool shape (seeded rng keyed on a
// counter — now used ONLY for aim jitter — pendingAnnouncements queue, flat
// tool).
import { z } from "zod";
// ── Table geometry constants ────────────────────────────────────────────────
// A real 9-ft table expressed in inches: 100×50 playfield, origin top-left,
// ball radius 1.125 (a 2.25" ball). Every geometry/engine function measures
// distances in these units.
export const TABLE_WIDTH = 100;
export const TABLE_HEIGHT = 50;
export const BALL_R = 1.125;
/** Floating-point slack for vector-degeneracy checks (near-zero-length vectors,
 * near-parallel segments) — kept tight since it only guards division-by-zero. */
export const EPS = 1e-6;
/**
 * Slack for "touching" vs. "overlapping" ball positions. `resolveOverlaps`'s
 * pairwise relaxation converges asymptotically (not exactly) when 3+ balls are
 * mutually close — as on a fresh rack or right after a break scatter — so a
 * residual sub-thousandth-inch overlap after the fixed pass count is expected
 * numerical noise, not a real interpenetration. Two orders of magnitude looser
 * than EPS on purpose; this constant is ONLY for ball-vs-ball distance checks.
 */
export const OVERLAP_EPS = 1e-3;
export const POCKET_IDS = ["NW", "N", "NE", "SW", "S", "SE"];
export const POCKETS = {
    NW: { id: "NW", pos: { x: 0, y: 0 }, captureRadius: 2.2 },
    N: { id: "N", pos: { x: 50, y: 0 }, captureRadius: 2.0 },
    NE: { id: "NE", pos: { x: 100, y: 0 }, captureRadius: 2.2 },
    SW: { id: "SW", pos: { x: 0, y: 50 }, captureRadius: 2.2 },
    S: { id: "S", pos: { x: 50, y: 50 }, captureRadius: 2.0 },
    SE: { id: "SE", pos: { x: 100, y: 50 }, captureRadius: 2.2 },
};
/** Apex-ball spot for every fresh rack (break is a MOVE — see engine.ts). */
export const FOOT_SPOT = { x: 75, y: 25 };
/** Cue's resting spot at the start of every rack (behind the head string). */
export const KITCHEN_SPOT = { x: 25, y: 25 };
// ── Ball identity ────────────────────────────────────────────────────────────
export const CUE_ID = 0;
export const EIGHT_ID = 8;
export const SOLID_IDS = [1, 2, 3, 4, 5, 6, 7];
export const STRIPE_IDS = [9, 10, 11, 12, 13, 14, 15];
export const ALL_OBJECT_IDS = [...SOLID_IDS, EIGHT_ID, ...STRIPE_IDS];
/** Base success chance per tier before style/hand modifiers — spec-fixed values. */
export const BASE_SUCCESS_PCT = {
    easy: 82,
    medium: 62,
    hard: 42,
    very_hard: 24,
};
export const BANK_SUCCESS_PCT = 18;
export const SAFETY_SUCCESS_PCT = 90;
export const BREAK_NOMINAL_SUCCESS_PCT = 35;
export const MAX_CUT_ANGLE_DEG = 80;
/** A ball this close to a pocket is a "hanger" — biases the difficulty score easier. */
export const HANGER_DISTANCE = 6;
export const HANGER_SCORE_BIAS = 0.15;
/** Obstruction test threshold: another ball's center within this distance of the
 * travel segment blocks the shot (2r would be "just touching", 0.9 leaves margin). */
export const OBSTRUCTION_FACTOR = 0.9;
export const MAX_POT_BANK_CANDIDATES = 12;
/** Banks are spice, not a strategy menu — never more than this many per menu. */
export const MAX_BANK_CANDIDATES = 2;
export const MAX_SAFETY_CANDIDATES = 3;
export const eightBallConfigSchema = z.object({
    raceTo: z.union([z.literal(1), z.literal(3), z.literal(5)]),
    humanBreaks: z.enum(["you", "opponent", "random"]),
    announcerCharacterId: z.string().nullable(),
});
export const DEFAULT_EIGHTBALL_CONFIG = {
    raceTo: 1,
    humanBreaks: "random",
    announcerCharacterId: null,
};
/** Clamp an untrusted config into house-rule bounds. */
export function clampEightBallConfig(raw) {
    const r = (raw ?? {});
    const raceTo = r.raceTo === 3 || r.raceTo === 5 ? r.raceTo : 1;
    const humanBreaks = r.humanBreaks === "you" || r.humanBreaks === "opponent" || r.humanBreaks === "random" ? r.humanBreaks : "random";
    const announcerCharacterId = typeof r.announcerCharacterId === "string" && r.announcerCharacterId.trim() ? r.announcerCharacterId : null;
    return { raceTo, humanBreaks, announcerCharacterId };
}
export const EIGHTBALL_MIN_PLAYERS = 2;
export const EIGHTBALL_MAX_PLAYERS = 2;
export const EIGHTBALL_LOG_CAP = 30;
export const eightBallMoveSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("aimed"), angleDeg: z.number(), power: z.number() }),
    z.object({ kind: z.literal("menu"), shotId: z.string(), style: z.enum(["controlled", "aggressive"]).optional() }),
    z.object({ kind: z.literal("place"), x: z.number(), y: z.number() }),
    z.object({ kind: z.literal("next_rack") }),
]);
//# sourceMappingURL=types.js.map