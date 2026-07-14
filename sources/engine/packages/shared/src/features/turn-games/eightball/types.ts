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
import type { GameEvent } from "../engine.types.js";
import type { SimFrame } from "./physics.js";

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

export type PocketId = "NW" | "N" | "NE" | "SW" | "S" | "SE";
export const POCKET_IDS: readonly PocketId[] = ["NW", "N", "NE", "SW", "S", "SE"];

export interface Point {
  x: number;
  y: number;
}

export interface PocketDef {
  id: PocketId;
  pos: Point;
  /** The physical capture radius physics.ts uses to decide when a ball's
   * center has fallen in (see physics.ts § Pockets). Also used by the engine
   * for cue-placement validation: a placed/auto-placed cue must sit outside
   * `captureRadius + BALL_R` of every pocket (a ball starting inside a
   * pocket's capture zone would never be captured by the sim's quadratic —
   * see physics.ts's `pocketCaptureTime` — and would behave nonsensically). */
  captureRadius: number;
}

export const POCKETS: Readonly<Record<PocketId, PocketDef>> = {
  NW: { id: "NW", pos: { x: 0, y: 0 }, captureRadius: 2.2 },
  N: { id: "N", pos: { x: 50, y: 0 }, captureRadius: 2.0 },
  NE: { id: "NE", pos: { x: 100, y: 0 }, captureRadius: 2.2 },
  SW: { id: "SW", pos: { x: 0, y: 50 }, captureRadius: 2.2 },
  S: { id: "S", pos: { x: 50, y: 50 }, captureRadius: 2.0 },
  SE: { id: "SE", pos: { x: 100, y: 50 }, captureRadius: 2.2 },
};

/** Apex-ball spot for every fresh rack (break is a MOVE — see engine.ts). */
export const FOOT_SPOT: Point = { x: 75, y: 25 };
/** Cue's resting spot at the start of every rack (behind the head string). */
export const KITCHEN_SPOT: Point = { x: 25, y: 25 };

// ── Ball identity ────────────────────────────────────────────────────────────

export const CUE_ID = 0;
export const EIGHT_ID = 8;
export const SOLID_IDS: readonly number[] = [1, 2, 3, 4, 5, 6, 7];
export const STRIPE_IDS: readonly number[] = [9, 10, 11, 12, 13, 14, 15];
export const ALL_OBJECT_IDS: readonly number[] = [...SOLID_IDS, EIGHT_ID, ...STRIPE_IDS];

export type BallGroup = "solids" | "stripes";

export interface BallPos {
  id: number;
  pos: Point;
}

// ── Candidate shot menu (produced by geometry.ts, consumed by engine + client) ─

export type ShotTier = "easy" | "medium" | "hard" | "very_hard";
export type ShotKind = "pot" | "bank" | "safety" | "break";

export interface ShotCandidate {
  /** Deterministic: "pot-<ballId>-<pocketId>" | "bank-<ballId>-<pocketId>" | "safety-<ballId>" | "break". */
  id: string;
  kind: ShotKind;
  ballId?: number;
  pocketId?: PocketId;
  tier: ShotTier;
  /**
   * ADVISORY ESTIMATE ONLY (v2): a difficulty-derived odds figure shown in the
   * bot prompt so personality (not this number) decides what's worth the
   * risk. The actual outcome is never rolled against this — the engine
   * converts the chosen candidate into an aim + power and runs it through
   * physics.ts's real simulation, same as a human's `aimed` move.
   */
  successPct: number;
  /** Plain-English tactical color, generated from a deterministic phrase table. */
  desc: string;
  /**
   * Set ONLY for candidates generated while the shooter has ball-in-hand: the
   * optimal virtual cue placement this specific candidate assumes. Becomes
   * the ACTUAL `state.cuePos` at resolution time if this candidate is the one
   * chosen (see engine.ts's `menu` move handling) — this is how ball-in-hand
   * placement happens for bots, which never issue a `place` move themselves.
   * Internal to the engine — stripped from the client-facing public view.
   */
  virtualCuePos?: Point;
}

/** Base success chance per tier before style/hand modifiers — spec-fixed values. */
export const BASE_SUCCESS_PCT: Readonly<Record<ShotTier, number>> = {
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

// NOTE (v2): the old CONTROLLED_SUCCESS_BONUS / AGGRESSIVE_SUCCESS_PENALTY
// success-roll modifiers are gone — style now only perturbs the bot's AIM
// JITTER SIGMA and POWER HEURISTIC in engine.ts's menu->aim conversion
// (STYLE_JITTER_MULT / the aggressive/controlled power deltas), never a
// resolution roll. See engine.ts § menu -> aim conversion.

// ── Config ───────────────────────────────────────────────────────────────────

export interface EightBallConfig {
  /** First to this many rack wins takes the match. */
  raceTo: 1 | 3 | 5;
  /** Who breaks the FIRST rack. "random" resolves deterministically from the setup
   * seed (mirrors chess's `humanColor: "random"` pattern). Later racks alternate. */
  humanBreaks: "you" | "opponent" | "random";
  /** Character that voices break/foul/win narration — narration only, never affects
   * rules. `null` = silent. See `eightballEngine.announcerCharacterId`. */
  announcerCharacterId: string | null;
}

export const eightBallConfigSchema = z.object({
  raceTo: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  humanBreaks: z.enum(["you", "opponent", "random"]),
  announcerCharacterId: z.string().nullable(),
});

export const DEFAULT_EIGHTBALL_CONFIG: EightBallConfig = {
  raceTo: 1,
  humanBreaks: "random",
  announcerCharacterId: null,
};

/** Clamp an untrusted config into house-rule bounds. */
export function clampEightBallConfig(raw: Partial<EightBallConfig> | Record<string, unknown> | null | undefined): EightBallConfig {
  const r = (raw ?? {}) as Partial<EightBallConfig>;
  const raceTo = r.raceTo === 3 || r.raceTo === 5 ? r.raceTo : 1;
  const humanBreaks = r.humanBreaks === "you" || r.humanBreaks === "opponent" || r.humanBreaks === "random" ? r.humanBreaks : "random";
  const announcerCharacterId = typeof r.announcerCharacterId === "string" && r.announcerCharacterId.trim() ? r.announcerCharacterId : null;
  return { raceTo, humanBreaks, announcerCharacterId };
}

export const EIGHTBALL_MIN_PLAYERS = 2;
export const EIGHTBALL_MAX_PLAYERS = 2;
export const EIGHTBALL_LOG_CAP = 30;

// ── Moves ────────────────────────────────────────────────────────────────────

export type ShotStyle = "controlled" | "aggressive";

/**
 * Discriminated on `kind` (not `type`, unlike v1's lone "shoot"/"next_rack"
 * union) — chosen to match the design spec's move pseudo-code exactly and to
 * give every move a single consistent discriminant field, `next_rack`
 * included, rather than mixing two discriminant names in one union.
 */
export type EightBallMove =
  /** Human aim-and-shoot (covers the break too): built into a cue velocity via
   * `powerToSpeed(power)` and run through `simulateShot`. Legal whenever it's
   * your turn and the cue is on the table (not awaiting placement). */
  | { kind: "aimed"; angleDeg: number; power: number }
  /** Bot shot pick — `shotId` selects a candidate (see `ShotCandidate.id`);
   * the engine converts it to an aim + power with jitter, then runs the same
   * simulation an `aimed` move would. Style defaults to "controlled". */
  | { kind: "menu"; shotId: string; style?: ShotStyle }
  /** Ball-in-hand placement. Legal only when the shooter has ball in hand (or,
   * pre-break, as an optional reposition within the kitchen). Does NOT
   * consume the turn or the shot counter — the same seat then aims/shoots. */
  | { kind: "place"; x: number; y: number }
  /** Human-only pacing move: legal only in `rack_over`, only for `currentSeat`. */
  | { kind: "next_rack" };

export const eightBallMoveSchema: z.ZodType<EightBallMove> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("aimed"), angleDeg: z.number(), power: z.number() }),
  z.object({ kind: z.literal("menu"), shotId: z.string(), style: z.enum(["controlled", "aggressive"]).optional() }),
  z.object({ kind: z.literal("place"), x: z.number(), y: z.number() }),
  z.object({ kind: z.literal("next_rack") }),
]);

// ── State ────────────────────────────────────────────────────────────────────

export type EightBallStatus = "active" | "rack_over" | "finished";
export type EightBallPhase = "break" | "play";

/**
 * One OBJECT ball's live state (ids 1-15; the cue, id 0, is tracked
 * separately via `cuePos` because ball-in-hand needs a "not currently
 * anywhere" state this shape can't represent). ALWAYS 15 entries in
 * `EightBallState.balls`, for the lifetime of a rack — a potted ball stays in
 * the array with `onTable: false` rather than moving to a side dict, so "is
 * every object ball accounted for" is a single length check, not a
 * cross-structure invariant.
 */
export interface EightBallBallState {
  id: number;
  x: number;
  y: number;
  onTable: boolean;
  /** Set iff `onTable` is false — which pocket it dropped into. Positions the
   * ball at that pocket's point for display once potted. */
  pocketId?: PocketId;
}

/** One shot's animation + outcome payload, overwritten every time a sim runs
 * (`aimed` or `menu` — never `place`, which doesn't run a sim). Fully
 * JSON-serializable so it survives persistence/replay; exposed as-is in the
 * public view for client animation (see `physics.ts`'s `SimFrame`). */
export interface EightBallLastShot {
  frames: SimFrame[];
  shooterSeatId: string;
  moveKind: "aimed" | "menu";
  potted: Array<{ ballId: number; pocketId: PocketId }>;
  cueScratched: boolean;
  foul: boolean;
}

export interface EightBallState {
  config: EightBallConfig;
  /** Seeded RNG root. Bot aim jitter is `deterministicRng(seed, shotCounter)`
   * — reproducible and rewind-safe without persisting any jitter draws. This
   * is the ONLY rng consumer left in the engine (v2): shot OUTCOMES come from
   * physics.ts's deterministic simulation, never a roll. */
  seed: number;
  /** Increments on every applyMove that runs a sim (`aimed`/`menu`, break
   * included; NOT `place` or `next_rack`) — the per-shot rng cursor (poker
   * deck-cursor pattern). */
  shotCounter: number;
  seats: Array<{ seatId: string; displayName: string; kind: "human" | "bot" }>;
  seatOrder: string[];
  seatNames: Record<string, string>;
  status: EightBallStatus;
  phase: EightBallPhase;
  /** All 15 object balls, always present (see `EightBallBallState`'s doc). */
  balls: EightBallBallState[];
  /** Null while a ball-in-hand placement is pending (i.e. `awaitingPlacement`
   * is true) — the sole source of truth physics.ts's sim reads the cue's
   * position from. */
  cuePos: Point | null;
  /** True iff `cuePos` is null — the current seat must `place` before they can
   * `aimed`/`menu` (bots resolve this transparently via `menu`; see engine.ts). */
  awaitingPlacement: boolean;
  /** Where a pending placement must land: "kitchen" for a break-shot foul (or
   * the optional pre-break reposition), "anywhere" for every other foul. Null
   * whenever `awaitingPlacement` is false. */
  placementZone: "kitchen" | "anywhere" | null;
  /** The most recent sim's frames + outcome, for client animation. Null before
   * the first shot of the match. */
  lastShot: EightBallLastShot | null;
  /** seatId -> assigned group. Both null = table open. */
  groups: Record<string, BallGroup | null>;
  /** seatId -> racks won this match. */
  rackScore: Record<string, number>;
  rackNumber: number;
  /** Who breaks the CURRENT (or, during rack_over, the NEXT) rack. Alternates every rack. */
  breakerSeatId: string;
  currentSeatId: string | null;
  /** seatId who has ball-in-hand right now (kept in lockstep with
   * `awaitingPlacement`/`cuePos === null`) — redundant with `currentSeatId`
   * while true, but kept as its own field so the client doesn't have to infer
   * "who" from "is anyone awaiting placement". */
  ballInHandFor: string | null;
  winnerSeatId: string | null;
  lastAction: { seatId: string; summary: string } | null;
  /** Queued narration events, drained by `drainAnnouncements`. */
  pendingAnnouncements: GameEvent[];
  /** Capped ring buffer of recent events (newest last) for the board log. */
  log: GameEvent[];
}

// ── Public (per-viewer) view rendered by the client board ───────────────────

export interface EightBallPublicSeat {
  seatId: string;
  displayName: string;
  kind: "human" | "bot";
  group: BallGroup | null;
  racksWon: number;
  isCurrent: boolean;
}

export interface EightBallPublicBall {
  id: number;
  x: number;
  y: number;
  pocketed: boolean;
}

/** Client/model-facing candidate — identical to `ShotCandidate` minus the
 * internal-only virtual cue placement (that's an engine resolution detail). */
export type EightBallPublicCandidate = Omit<ShotCandidate, "virtualCuePos">;

export interface EightBallPublicView {
  gameType: "eightball";
  status: EightBallStatus;
  phase: EightBallPhase;
  /** Mirrors `EightBallState.shotCounter` — increments once per executed sim
   * (`aimed`/`menu`), never for `place`/`next_rack`. The client keys its
   * shot-animation bookkeeping on this ("have I already animated the shot
   * `lastShot` describes?"), which needs a monotonic per-sim identity rather
   * than object identity on `lastShot` (snapshots are re-fetched/re-sent). */
  shotCounter: number;
  /** All 16 balls, cue included when it's on the table (omitted while ball-in-hand). */
  balls: EightBallPublicBall[];
  pocketedByGroup: Record<BallGroup, number>;
  groups: Record<string, BallGroup | null>;
  seats: EightBallPublicSeat[];
  currentSeatId: string | null;
  yourSeatId: string | null;
  ballInHandFor: string | null;
  /** True iff the cue is off-table awaiting a `place` move. */
  awaitingPlacement: boolean;
  /** Where that placement must land; null unless `awaitingPlacement`. */
  placementZone: "kitchen" | "anywhere" | null;
  /** The most recent shot's animation frames + outcome, for the client to
   * animate. Null before the first shot of the match. */
  lastShot: EightBallLastShot | null;
  /** Whether `currentSeatId`'s group is fully cleared, so the 8 is their legal target. */
  onTheEight: boolean;
  raceTo: number;
  rackNumber: number;
  winnerSeatId: string | null;
  lastAction: { seatId: string; summary: string } | null;
  /** The current shot menu, populated ONLY when the viewer is the current seat
   * (chess `legalMovesForYou` pattern). Bots always need this to pick a `menu`
   * move; kept for humans too as a possible future hint overlay (not consumed
   * by the v2 human board UI, which aims/shoots directly). */
  yourShots: EightBallPublicCandidate[] | null;
  recentLog: GameEvent[];
  hasPendingAnnouncements: boolean;
  config: EightBallConfig;
}
