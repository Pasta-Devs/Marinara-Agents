// ──────────────────────────────────────────────
// 8-Ball Pool — deterministic engine (server-authoritative)
// ──────────────────────────────────────────────
// PHYSICS model (v2). Every turn the engine still computes a finite,
// difficulty-scored candidate shot menu from live ball positions
// (geometry.ts) — bots pick from it in character, never aiming directly.
// Humans aim directly (`aimed`: angleDeg + power). EITHER WAY, resolution now
// runs through physics.ts's deterministic simulation: the engine converts a
// bot's menu pick into an aim vector + power (with skill/style jitter), then
// both move kinds build a `SimBall[]` + cue velocity and call `simulateShot`.
// A shot's outcome is whatever the balls actually do — never a seeded-RNG
// roll against the candidate's difficulty. `deterministicRng(seed,
// shotCounter)` is now used ONLY to jitter a bot's aim angle.
//
// DOCUMENTED SIMPLIFICATIONS (bar-rules, not tournament rules — see the v2
// design spec for the full list):
//  - Foul = cue scratch OR wrong/no first-contact ball. No rail-after-contact
//    foul (a shot that legally contacts an object ball but never sends
//    anything to a cushion afterward is NOT a foul here).
//  - No called shots / no called pockets beyond what the candidate implies —
//    "slop" counts: any ball that legally drops counts for whoever's group
//    it's in, called or not.
//  - The break is exempt from the group-legality check for first contact
//    (the table is open, pre-groups): only a total whiff (no contact at all)
//    is a break foul. Break pots never assign groups; the table is ALWAYS
//    open immediately after the break regardless of what dropped.
//  - The 8 on the break is a rack WIN for the breaker unless they also
//    scratch (then a loss) — a deliberate, documented bar-rules choice, not
//    "re-rack and re-break".
//
// ACCOUNTING INVARIANT (read before touching resolution code): every object
// ball (1-15) has EXACTLY ONE entry in `state.balls`, always, with
// `onTable: true` (still in play) xor `onTable: false` (+ `pocketId`, fell in
// a pocket) — see `EightBallBallState`'s doc in types.ts. The cue is in
// EXACTLY ONE of `state.cuePos` (non-null, on table) or
// `state.awaitingPlacement` (true, awaiting the next `place` move) — never
// both, never neither. This is what "all 16 balls accounted for" means in
// the test suite, and every resolution path below must preserve it.

import type { GameEvent, ModelTurnView, MoveResult, Seat, TerminalResult, TurnGameEngine } from "../engine.types.js";
import {
  ballLabel,
  distance,
  generateCandidates,
  ghostBallPoint,
  inBounds,
  pocketLabel,
  railContactPoint,
  reflectAcrossRail,
  standardRackPositions,
  zoneName,
  type Rail,
} from "./geometry.js";
import { powerToSpeed, simulateShot, type SimBall, type SimResult } from "./physics.js";
import { deterministicRng } from "./rng.js";
import { EIGHTBALL_TOOL_MANIFESTS, parseEightBallToolCall } from "./tools.js";
import {
  BREAK_NOMINAL_SUCCESS_PCT,
  BALL_R,
  CUE_ID,
  DEFAULT_EIGHTBALL_CONFIG,
  EIGHTBALL_LOG_CAP,
  EIGHTBALL_MAX_PLAYERS,
  EIGHTBALL_MIN_PLAYERS,
  EIGHT_ID,
  FOOT_SPOT,
  KITCHEN_SPOT,
  POCKETS,
  POCKET_IDS,
  SOLID_IDS,
  STRIPE_IDS,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  clampEightBallConfig,
  eightBallConfigSchema,
  type BallGroup,
  type BallPos,
  type EightBallBallState,
  type EightBallConfig,
  type EightBallMove,
  type EightBallPublicBall,
  type EightBallPublicCandidate,
  type EightBallPublicSeat,
  type EightBallPublicView,
  type EightBallState,
  type PocketId,
  type Point,
  type ShotCandidate,
  type ShotStyle,
  type ShotTier,
} from "./types.js";

// ── small helpers ───────────────────────────────────────────────────────────

function clone(state: EightBallState): EightBallState {
  return JSON.parse(JSON.stringify(state)) as EightBallState;
}

function nameOf(state: EightBallState, seatId: string): string {
  return state.seatNames[seatId] ?? seatId;
}

/** The only other seat — 8-ball is strictly 2-player. */
function otherSeat(state: EightBallState, seatId: string): string {
  return state.seatOrder.find((id) => id !== seatId) ?? seatId;
}

function fail(error: string, legalMoves: EightBallMove[] = []): MoveResult<EightBallState, EightBallMove> {
  return { ok: false, error, legalMoves };
}

/** Append `event` to both the returned move-events list and the capped board log. */
function record(state: EightBallState, events: GameEvent[], event: GameEvent): void {
  events.push(event);
  state.log.push(event);
  if (state.log.length > EIGHTBALL_LOG_CAP) state.log.splice(0, state.log.length - EIGHTBALL_LOG_CAP);
}

/** Like `record`, but also queues the event for the announcer. Used ONLY for the
 * milestone categories: break, group assignment, foul, on-the-8, great shot, rack over, game over. */
function announce(state: EightBallState, events: GameEvent[], event: GameEvent): void {
  record(state, events, event);
  state.pendingAnnouncements.push(event);
}

function setLast(state: EightBallState, seatId: string, summary: string): void {
  state.lastAction = { seatId, summary };
}

// ── group / ball-count helpers ───────────────────────────────────────────────

function remainingIdsForGroup(state: EightBallState, group: BallGroup): number[] {
  const ids = group === "solids" ? SOLID_IDS : STRIPE_IDS;
  return state.balls
    .filter((b) => b.onTable && ids.includes(b.id))
    .map((b) => b.id)
    .sort((a, b) => a - b);
}

/** The shooter's legal FIRST-CONTACT / target set right now (empty during break
 * — the break is exempted from this check entirely, see `isLegalFirstContact`).
 * Table-open rule and group-cleared -> 8-only rule live here, matching the
 * design spec exactly, and are shared by both the candidate menu (what a bot
 * may pick) and foul detection (what a human's free aim is allowed to hit). */
function legalTargetIdsFor(state: EightBallState, seatId: string): number[] {
  if (state.phase === "break") return [];
  const group = state.groups[seatId] ?? null;
  if (!group) {
    return state.balls
      .filter((b) => b.onTable && b.id !== EIGHT_ID)
      .map((b) => b.id)
      .sort((a, b) => a - b);
  }
  const remaining = remainingIdsForGroup(state, group);
  if (remaining.length > 0) return remaining;
  return state.balls.some((b) => b.onTable && b.id === EIGHT_ID) ? [EIGHT_ID] : [];
}

const BREAK_CANDIDATE: ShotCandidate = {
  id: "break",
  kind: "break",
  tier: "medium",
  successPct: BREAK_NOMINAL_SUCCESS_PCT,
  desc: "Break the rack open.",
};

/** Convert the engine's flat on-table ball state into the `{id, pos}` shape
 * geometry.ts's (untouched) candidate/placement functions expect. */
function toBallPos(state: EightBallState): BallPos[] {
  return state.balls.filter((b) => b.onTable).map((b) => ({ id: b.id, pos: { x: b.x, y: b.y } }));
}

/**
 * LEAD ADDITION: a placement is only legal if it's fully on-table, doesn't
 * overlap any on-table ball, and sits outside every pocket's capture zone —
 * physics.ts's pocket-capture quadratic returns null (never captures) for a
 * ball that STARTS inside a pocket's `captureRadius` (see physics.ts's
 * `pocketCaptureTime` doc), so a cue placed inside one would behave
 * nonsensically (immune to being sunk from where it sits). Also enforces the
 * kitchen boundary for a "kitchen"-zoned placement (break-foul ball-in-hand,
 * or the optional pre-break reposition) — the head string sits at
 * `KITCHEN_SPOT.x` (the table's standard 1/4-length spot), so kitchen means
 * "at or behind that x".
 */
function isValidCuePlacement(p: Point, onTableBalls: readonly EightBallBallState[], zone: "kitchen" | "anywhere"): boolean {
  if (!inBounds(p, BALL_R)) return false;
  for (const b of onTableBalls) {
    if (distance(p, { x: b.x, y: b.y }) < 2 * BALL_R + 0.05) return false;
  }
  for (const id of POCKET_IDS) {
    const pocket = POCKETS[id];
    if (distance(p, pocket.pos) < pocket.captureRadius + BALL_R) return false;
  }
  if (zone === "kitchen" && p.x > KITCHEN_SPOT.x) return false;
  return true;
}

/** The current shot menu for `seatId`, or [] if it isn't their turn. Pure
 * function of state — regenerated fresh on every call rather than cached, so
 * it can never drift from the live ball positions. */
function buildCandidateMenu(state: EightBallState, seatId: string): ShotCandidate[] {
  if (state.status !== "active" || state.currentSeatId !== seatId) return [];
  if (state.phase === "break") return [BREAK_CANDIDATE];
  const legalTargets = legalTargetIdsFor(state, seatId);
  const raw = generateCandidates({ cuePos: state.cuePos, balls: toBallPos(state), legalTargets });
  if (state.cuePos !== null) return raw;
  // Ball-in-hand: geometry.ts's pickCuePlacementForBallInHand (untouched,
  // used internally by generateCandidates for the null-cuePos branch) checks
  // bounds/overlap/obstruction but NOT the pocket-zone margin above — filter
  // its output through the same validator rather than ever offering a
  // candidate whose assumed placement would land inside a pocket's capture
  // zone (this is what actually places the cue for a bot's ball-in-hand
  // `menu` move — see applyMove).
  const zone = state.placementZone ?? "anywhere";
  const onTable = state.balls.filter((b) => b.onTable);
  const validated = raw.filter((c) => !c.virtualCuePos || isValidCuePlacement(c.virtualCuePos, onTable, zone));
  // geometry.ts's `safety` candidates NEVER carry a `virtualCuePos` (it only
  // computes one for pot/bank) — without this, resolving a ball-in-hand
  // `menu` move on a safety candidate would try to read the (null) real
  // `state.cuePos`. Give every safety a validated default placement here so
  // ball-in-hand always has a real position to aim a safety from, and so the
  // "menu is never empty" invariant survives even if the pocket-zone filter
  // above drops every pot/bank candidate.
  const fallbackPos = defaultPlacementPoint(state, zone);
  return validated.map((c) => (c.kind === "safety" ? { ...c, virtualCuePos: fallbackPos } : c));
}

/** A single canonical legal placement — NOT an enumeration of the (continuous)
 * legal space, just a deterministic, always-valid representative used by
 * `legalMoves`/`pickFallbackMove` for a human awaiting placement. Bots never
 * reach this path: their ball-in-hand resolves via `menu` (see
 * `buildCandidateMenu`'s ball-in-hand branch). */
function defaultPlacementPoint(state: EightBallState, zone: "kitchen" | "anywhere"): Point {
  const onTable = state.balls.filter((b) => b.onTable);
  const candidates: Point[] =
    zone === "kitchen"
      ? [KITCHEN_SPOT, { x: 15, y: 15 }, { x: 15, y: 35 }, { x: 10, y: 25 }, { x: 20, y: 10 }, { x: 20, y: 40 }]
      : [
          { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT / 2 },
          { x: 60, y: 15 },
          { x: 40, y: 35 },
          { x: 60, y: 35 },
          { x: 40, y: 15 },
          { x: 25, y: 25 },
        ];
  for (const p of candidates) if (isValidCuePlacement(p, onTable, zone)) return p;
  return KITCHEN_SPOT; // last-resort; unreachable with at most 15 balls on a real table
}

/** Whether — and where — `seatId` may legally `place` the cue right now: true
 * ball-in-hand (awaitingPlacement), or the optional pre-break reposition
 * within the kitchen. Shared by `applyMove` and `legalMovesFor`. */
function placementZoneFor(state: EightBallState, seatId: string): "kitchen" | "anywhere" | null {
  if (state.status !== "active" || state.currentSeatId !== seatId) return null;
  if (state.awaitingPlacement) return state.placementZone;
  if (state.phase === "break" && state.cuePos !== null) return "kitchen";
  return null;
}

function legalMovesFor(state: EightBallState, seatId: string): EightBallMove[] {
  if (state.status === "rack_over") {
    return state.currentSeatId === seatId ? [{ kind: "next_rack" }] : [];
  }
  if (state.status !== "active" || state.currentSeatId !== seatId) return [];
  const candidates = buildCandidateMenu(state, seatId);
  const moves: EightBallMove[] = [];
  for (const c of candidates) {
    moves.push({ kind: "menu", shotId: c.id, style: "controlled" });
    moves.push({ kind: "menu", shotId: c.id, style: "aggressive" });
  }
  const zone = placementZoneFor(state, seatId);
  if (zone) {
    // See `defaultPlacementPoint`'s doc: (x, y) is a continuous legal space,
    // so this is a representative sample, not a full enumeration.
    const p = defaultPlacementPoint(state, zone);
    moves.push({ kind: "place", x: p.x, y: p.y });
  }
  return moves;
}

// ── sim plumbing ─────────────────────────────────────────────────────────────

/** Build physics.ts's `SimBall[]` input from the engine's on-table balls +
 * cue (which must be on the table — callers only reach this once `cuePos` is
 * non-null). Initial velocities are all zero; `simulateShot` overwrites the
 * cue's from `cueVelocity` regardless of what's passed here. */
function buildSimBalls(s: EightBallState): SimBall[] {
  const balls: SimBall[] = s.balls.filter((b) => b.onTable).map((b) => ({ id: b.id, x: b.x, y: b.y, vx: 0, vy: 0 }));
  balls.push({ id: CUE_ID, x: s.cuePos!.x, y: s.cuePos!.y, vx: 0, vy: 0 });
  return balls;
}

function angleDegToVelocity(angleDeg: number, power: number): { vx: number; vy: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const speed = powerToSpeed(power);
  return { vx: Math.cos(rad) * speed, vy: Math.sin(rad) * speed };
}

/** Apply a completed sim's result onto the engine's ball bookkeeping: moves
 * every still-on-table object ball to its final resting spot, flips any newly
 * potted object ball to `onTable: false` (parked at its pocket's point), and
 * sets `cuePos` from the cue's final position (or null if it never appears in
 * `finalBalls`, i.e. it was potted/scratched). Callers that need to react to
 * a foul (which discards the cue regardless of where physics left it) do so
 * AFTER calling this, by overwriting `cuePos` again — see `resolveShot`. */
function applySimToBalls(s: EightBallState, sim: SimResult): void {
  const finalById = new Map(sim.finalBalls.map((b) => [b.id, b]));
  for (const ball of s.balls) {
    if (!ball.onTable) continue;
    const f = finalById.get(ball.id);
    if (f) {
      ball.x = f.x;
      ball.y = f.y;
    }
  }
  for (const p of sim.events.potted) {
    if (p.ballId === CUE_ID) continue;
    const ball = s.balls.find((b) => b.id === p.ballId);
    if (!ball) continue;
    ball.onTable = false;
    ball.pocketId = p.pocketId;
    const pos = POCKETS[p.pocketId].pos;
    ball.x = pos.x;
    ball.y = pos.y;
  }
  const cueFinal = finalById.get(CUE_ID);
  s.cuePos = cueFinal ? { x: cueFinal.x, y: cueFinal.y } : null;
}

function objectPottedFrom(sim: SimResult): Array<{ ballId: number; pocketId: PocketId }> {
  return sim.events.potted.filter((p) => p.ballId !== CUE_ID).map((p) => ({ ballId: p.ballId, pocketId: p.pocketId }));
}

/** First-contact legality (spec: own group required; any ball while the table
 * is open; the 8 only once your group is cleared). The break is exempted
 * entirely — the table's still open and pre-groups, so only a total whiff
 * (no contact) is a break foul; this is the "no rail-after-contact foul"
 * simplification's break-specific cousin, both documented in the file header. */
function isLegalFirstContact(state: EightBallState, seatId: string, isBreakShot: boolean, firstContactBallId: number | null): boolean {
  if (firstContactBallId === null) return false;
  if (isBreakShot) return true;
  return legalTargetIdsFor(state, seatId).includes(firstContactBallId);
}

// ── menu -> aim conversion (bot shots) ───────────────────────────────────────
// Sigma values and power heuristics below are the v2 design spec's exact
// numbers — see the spec's "Engine rework" § move schema. `rng` (aim jitter)
// is the ONLY randomness consumer left in the engine.

const JITTER_SIGMA_DEG: Readonly<Record<ShotTier, number>> = { easy: 0.6, medium: 1.4, hard: 2.6, very_hard: 4.2 };
const STYLE_JITTER_MULT: Readonly<Record<ShotStyle, number>> = { controlled: 0.7, aggressive: 1.35 };
const BREAK_JITTER_SIGMA = 1.0;
const TABLE_DIAGONAL = Math.hypot(TABLE_WIDTH, TABLE_HEIGHT);
/**
 * Fixed rail search order, mirroring geometry.ts's internal (unexported)
 * `RAILS` constant used by `generateCandidates` when it built this same bank
 * candidate. Duplicated here (rather than exported from geometry.ts, which
 * this rework must not touch) purely to re-derive AIM geometry for a bank
 * candidate that's already known to exist — this does NOT re-decide whether
 * the bank is offered (that already happened this same turn), just picks a
 * concrete ghost point/travel distance to aim at and jitter around.
 */
const BANK_RAIL_ORDER: readonly Rail[] = ["top", "bottom", "left", "right"];

function findBankAimGeometry(ballPos: Point, pocketPos: Point): { ghost: Point; contact: Point } | null {
  for (const rail of BANK_RAIL_ORDER) {
    const virtualPocket = reflectAcrossRail(pocketPos, rail);
    const contact = railContactPoint(ballPos, virtualPocket, rail);
    if (!contact) continue;
    return { ghost: ghostBallPoint(ballPos, virtualPocket), contact };
  }
  return null;
}

/**
 * Converts a chosen bot candidate into a concrete aim + power, exactly per
 * the design spec: target point = ghost-ball point (pot/bank) or the ball
 * itself (safety); base angle = atan2 to that target; jitter the angle by
 * `(rng()*2-1) * sigmaDeg * styleMult`; power from a deterministic distance
 * heuristic (never rng-derived — jitter is the only randomness here).
 * `effectiveCuePos` is `candidate.virtualCuePos` when this is a ball-in-hand
 * candidate (becomes the ACTUAL `state.cuePos` in `applyMove`) or the
 * already-real `state.cuePos` otherwise.
 */
function convertMenuToAim(
  s: EightBallState,
  candidate: ShotCandidate,
  style: ShotStyle,
  isBreakShot: boolean,
): { angleDeg: number; power: number; effectiveCuePos: Point } {
  const rng = deterministicRng(s.seed, s.shotCounter);
  const effectiveCuePos = candidate.virtualCuePos ?? s.cuePos!;
  const mult = STYLE_JITTER_MULT[style];
  const jitter = (sigma: number): number => (rng() * 2 - 1) * sigma * mult;
  const angleTo = (target: Point): number => (Math.atan2(target.y - effectiveCuePos.y, target.x - effectiveCuePos.x) * 180) / Math.PI;

  if (isBreakShot) {
    const power = style === "aggressive" ? 1.0 : 0.95;
    return { angleDeg: angleTo(FOOT_SPOT) + jitter(BREAK_JITTER_SIGMA), power, effectiveCuePos };
  }

  if (candidate.kind === "safety") {
    const ball = s.balls.find((b) => b.id === candidate.ballId && b.onTable)!;
    const target: Point = { x: ball.x, y: ball.y };
    const d1 = distance(effectiveCuePos, target);
    const power = Math.min(0.35, Math.max(0.18, 0.18 + 0.17 * Math.min(1, d1 / TABLE_WIDTH)));
    return { angleDeg: angleTo(target) + jitter(JITTER_SIGMA_DEG[candidate.tier]), power, effectiveCuePos };
  }

  // pot / bank
  const ball = s.balls.find((b) => b.id === candidate.ballId && b.onTable)!;
  const pocket = POCKETS[candidate.pocketId!];
  let target: Point;
  let d1: number;
  let d2: number;
  if (candidate.kind === "bank") {
    const bankGeo = findBankAimGeometry({ x: ball.x, y: ball.y }, pocket.pos);
    if (bankGeo) {
      target = bankGeo.ghost;
      d1 = distance(effectiveCuePos, bankGeo.ghost);
      d2 = distance({ x: ball.x, y: ball.y }, bankGeo.contact) + distance(bankGeo.contact, pocket.pos);
    } else {
      // Degenerate fallback (shouldn't occur — the candidate wouldn't exist
      // without a valid rail found at generation time): aim direct-pocket
      // rather than fail.
      target = ghostBallPoint({ x: ball.x, y: ball.y }, pocket.pos);
      d1 = distance(effectiveCuePos, target);
      d2 = distance({ x: ball.x, y: ball.y }, pocket.pos);
    }
  } else {
    target = ghostBallPoint({ x: ball.x, y: ball.y }, pocket.pos);
    d1 = distance(effectiveCuePos, target);
    d2 = distance({ x: ball.x, y: ball.y }, pocket.pos);
  }
  const travelFactor = Math.min(1, Math.max(0, (d1 + d2) / TABLE_DIAGONAL));
  let power = 0.25 + 0.65 * travelFactor + (style === "aggressive" ? 0.15 : -0.05);
  power = Math.min(0.9, Math.max(0.25, power));
  return { angleDeg: angleTo(target) + jitter(JITTER_SIGMA_DEG[candidate.tier]), power, effectiveCuePos };
}

// ── group assignment / narration triggers ───────────────────────────────────

/** First LEGAL (non-foul) shot that pots on an OPEN table assigns groups by
 * majority of what dropped this shot; a tie goes to the lowest-numbered
 * potted ball's group. Fouled pots never reach here (see `resolveShot`). */
function assignGroupsFromPotted(s: EightBallState, events: GameEvent[], seatId: string, potted: Array<{ ballId: number; pocketId: PocketId }>): void {
  let solids = 0;
  let stripes = 0;
  for (const p of potted) {
    if (SOLID_IDS.includes(p.ballId)) solids++;
    else if (STRIPE_IDS.includes(p.ballId)) stripes++;
  }
  let group: BallGroup;
  if (solids !== stripes) {
    group = solids > stripes ? "solids" : "stripes";
  } else {
    const lowest = Math.min(...potted.map((p) => p.ballId));
    group = SOLID_IDS.includes(lowest) ? "solids" : "stripes";
  }
  const opp = otherSeat(s, seatId);
  s.groups[seatId] = group;
  s.groups[opp] = group === "solids" ? "stripes" : "solids";
  announce(s, events, {
    type: "group_assignment",
    seatId,
    message: `${nameOf(s, seatId)} is ${group.toUpperCase()}, ${nameOf(s, opp)} is ${(group === "solids" ? "stripes" : "solids").toUpperCase()}.`,
  });
}

/** v2: fires for any LEGAL shot that pots 2+ of the shooter's own balls, or
 * any successful bank pot (spec, updated from v1's tier/kind-based trigger —
 * "great" is now about what actually happened, not what was attempted). */
function maybeAnnounceGreatShot(s: EightBallState, events: GameEvent[], seatId: string, reason: "multi" | "bank"): void {
  announce(s, events, {
    type: "great_shot",
    seatId,
    message:
      reason === "bank"
        ? `${nameOf(s, seatId)} nails the bank — incredible shot!`
        : `${nameOf(s, seatId)} runs multiple balls in one shot — incredible!`,
  });
}

/** Fires exactly once — the shot that pots the shooter's LAST non-8 ball —
 * since every subsequent shot for that seat targets the 8 (a different
 * resolution path). */
function maybeAnnounceOnTheEight(s: EightBallState, events: GameEvent[], seatId: string): void {
  const group = s.groups[seatId];
  if (group && remainingIdsForGroup(s, group).length === 0) {
    announce(s, events, { type: "on_the_8", seatId, message: `${nameOf(s, seatId)} is on the 8!` });
  }
}

function describePottedList(potted: Array<{ ballId: number; pocketId: PocketId }>): string {
  if (potted.length === 1) return `${ballLabel(potted[0]!.ballId)} into ${pocketLabel(potted[0]!.pocketId)}`;
  return potted.map((p) => ballLabel(p.ballId)).join(" and ");
}

// ── rack lifecycle ──────────────────────────────────────────────────────────

/** Awards the rack, checks the raceTo, and either ends the match or hands
 * pacing to the human for `next_rack` (poker `hand_over` pattern). */
function finishRack(s: EightBallState, events: GameEvent[], winnerSeatId: string, wasScratch: boolean): void {
  s.rackScore[winnerSeatId] = (s.rackScore[winnerSeatId] ?? 0) + 1;
  const loserSeatId = otherSeat(s, winnerSeatId);
  s.currentSeatId = null;

  const reachedRaceTo = (s.rackScore[winnerSeatId] ?? 0) >= s.config.raceTo;
  if (reachedRaceTo) {
    s.status = "finished";
    s.winnerSeatId = winnerSeatId;
    announce(s, events, {
      type: "game_over",
      seatId: winnerSeatId,
      message: `${nameOf(s, winnerSeatId)} wins the match ${s.rackScore[winnerSeatId]}-${s.rackScore[loserSeatId] ?? 0}!`,
    });
    return;
  }

  s.status = "rack_over";
  s.breakerSeatId = otherSeat(s, s.breakerSeatId); // alternate breaks every rack
  const humanSeatId = s.seats.find((x) => x.kind === "human")?.seatId ?? s.seatOrder[0]!;
  s.currentSeatId = humanSeatId;
  announce(s, events, {
    type: "rack_over",
    seatId: winnerSeatId,
    message:
      `${nameOf(s, winnerSeatId)} takes rack ${s.rackNumber}${wasScratch ? " — opponent scratched on the 8" : ""}. ` +
      `Score: ${s.rackScore[winnerSeatId]}-${s.rackScore[loserSeatId] ?? 0}.`,
  });
}

function freshRackBalls(): EightBallBallState[] {
  return standardRackPositions(FOOT_SPOT).map((b) => ({ id: b.id, x: b.pos.x, y: b.pos.y, onTable: true }));
}

function startNewRack(s: EightBallState, events: GameEvent[]): void {
  s.rackNumber += 1;
  s.phase = "break";
  s.status = "active";
  s.balls = freshRackBalls();
  s.cuePos = { ...KITCHEN_SPOT };
  s.awaitingPlacement = false;
  s.placementZone = null;
  s.lastShot = null;
  for (const id of s.seatOrder) s.groups[id] = null;
  s.ballInHandFor = null;
  s.currentSeatId = s.breakerSeatId; // already toggled by finishRack for the upcoming rack
  announce(s, events, {
    type: "rack_started",
    seatId: s.breakerSeatId,
    message: `Rack ${s.rackNumber} — ${nameOf(s, s.breakerSeatId)} breaks.`,
  });
}

// ── resolution: the ONE path every sim-backed move (aimed or menu) runs through ──

/**
 * Turns a completed `SimResult` into rule consequences: foul detection, the
 * 8-ball win/loss branches, open-table group assignment, and turn
 * continuation — all derived from what physics actually did, never a roll.
 * `candidate` is present only for `menu` moves (used for the bank-success
 * great_shot clause); `aimed` moves have no candidate to reference.
 */
function resolveShot(
  s: EightBallState,
  seatId: string,
  isBreakShot: boolean,
  moveKind: "aimed" | "menu",
  sim: SimResult,
  events: GameEvent[],
  candidate?: ShotCandidate,
): void {
  const opp = otherSeat(s, seatId);
  const cueScratched = sim.events.cueScratched;
  const legalContact = isLegalFirstContact(s, seatId, isBreakShot, sim.events.firstContactBallId);
  const foul = cueScratched || !legalContact;

  // Facts we need "as of before this shot" — captured BEFORE applySimToBalls
  // mutates onTable flags (remainingIdsForGroup reads live ball state).
  const groupBeforeShot = s.groups[seatId] ?? null;
  const groupClearedBeforeShot = !!groupBeforeShot && remainingIdsForGroup(s, groupBeforeShot).length === 0;
  const bothOpenBeforeShot = s.groups[seatId] === null && s.groups[opp] === null;

  applySimToBalls(s, sim);
  const potted = objectPottedFrom(sim);
  s.lastShot = { frames: sim.frames, shooterSeatId: seatId, moveKind, potted, cueScratched, foul };

  const eightPotted = potted.some((p) => p.ballId === EIGHT_ID);

  if (eightPotted) {
    let winner: string;
    let earlyOrFoul = false;
    if (isBreakShot) {
      // Bar-rules choice (documented, deliberate — see design spec): the 8 on
      // the break is a win for the breaker unless they also scratch.
      winner = cueScratched ? opp : seatId;
    } else {
      // Timing/contact legality is checked INDEPENDENTLY of the scratch —
      // otherwise a legally-timed pot that merely scratched would get
      // mislabeled as "early" (both are a loss, but for different reasons,
      // and the narration must say which).
      const legalTiming = groupClearedBeforeShot && legalContact;
      earlyOrFoul = !legalTiming;
      winner = !legalTiming ? opp : cueScratched ? opp : seatId;
    }
    setLast(s, seatId, winner === seatId ? "pots the 8 clean" : earlyOrFoul ? "pots the 8 early" : "pots the 8 but scratches");
    record(s, events, {
      type: winner === seatId ? "eight_ball_win" : "foul",
      seatId,
      message:
        winner === seatId
          ? `${nameOf(s, seatId)} pots the 8 clean — racks it up!`
          : earlyOrFoul
            ? `${nameOf(s, seatId)} pots the 8 too early — rack goes to ${nameOf(s, winner)}!`
            : `${nameOf(s, seatId)} scratches while potting the 8 — rack goes to ${nameOf(s, winner)}!`,
    });
    if (cueScratched) {
      // The rack is over either way (finishRack below) and nobody is ever
      // asked to `place` at rack_over, so a scratch here must NOT leave the
      // cue in the null/no-one-awaiting-placement state applySimToBalls just
      // set — reset it to any valid neutral spot instead (startNewRack
      // overwrites it for real once the next rack begins; `defaultPlacementPoint`
      // already searches for one that can't overlap a remaining ball).
      s.cuePos = defaultPlacementPoint(s, "anywhere");
    }
    finishRack(s, events, winner, cueScratched);
    return;
  }

  if (foul) {
    s.cuePos = null; // discard wherever physics left it — ball-in-hand always picks the cue UP
    s.awaitingPlacement = true;
    s.placementZone = isBreakShot ? "kitchen" : "anywhere";
    s.ballInHandFor = opp;
    s.currentSeatId = opp;
    if (isBreakShot) s.phase = "play"; // the break always resolves the phase, foul or not
    setLast(s, seatId, isBreakShot ? "fouls on the break" : cueScratched ? "scratches" : "fouls (wrong ball first)");
    announce(s, events, {
      type: "foul",
      seatId,
      message: isBreakShot
        ? `${nameOf(s, seatId)} fouls on the break — ${nameOf(s, opp)} gets ball in hand behind the head string.`
        : cueScratched
          ? `${nameOf(s, seatId)} scratches — ${nameOf(s, opp)} gets ball in hand.`
          : `${nameOf(s, seatId)} fouls (wrong ball first) — ${nameOf(s, opp)} gets ball in hand.`,
    });
    return;
  }

  // Legal, non-8 shot.
  if (isBreakShot) {
    s.phase = "play";
    // Table is ALWAYS open after the break regardless of what dropped — break
    // pots never assign groups (spec, explicit). Continuation is its OWN rule
    // here (not the general "own group potted" rule below, which can't apply
    // yet since no group exists): any drop at all keeps the breaker shooting.
    s.currentSeatId = potted.length > 0 ? seatId : opp;
    const dropText = potted.length === 0 ? "nothing drops" : potted.length === 1 ? "1 ball drops" : `${potted.length} balls drop`;
    setLast(s, seatId, "breaks");
    announce(s, events, {
      type: "break_result",
      seatId,
      message: `${nameOf(s, seatId)} breaks — ${dropText}.`,
      data: { droppedIds: potted.map((p) => p.ballId) },
    });
    return;
  }

  if (bothOpenBeforeShot && potted.length > 0) {
    assignGroupsFromPotted(s, events, seatId, potted);
  }

  const myGroup = s.groups[seatId] ?? null;
  const ownGroupIds = myGroup === "solids" ? SOLID_IDS : myGroup === "stripes" ? STRIPE_IDS : [];
  const pottedOwn = potted.filter((p) => ownGroupIds.includes(p.ballId));

  if (potted.length > 0) {
    setLast(s, seatId, `pots ${describePottedList(potted)}`);
    record(s, events, {
      type: "pot",
      seatId,
      message: `${nameOf(s, seatId)} pots ${describePottedList(potted)}.`,
      data: { potted },
    });
  } else {
    setLast(s, seatId, "plays a shot");
  }

  if (pottedOwn.length > 0) {
    s.currentSeatId = seatId; // continue shooting on any own-group pot
    const bankSuccess = candidate?.kind === "bank" && candidate.ballId !== undefined && potted.some((p) => p.ballId === candidate.ballId);
    if (pottedOwn.length >= 2) maybeAnnounceGreatShot(s, events, seatId, "multi");
    else if (bankSuccess) maybeAnnounceGreatShot(s, events, seatId, "bank");
    maybeAnnounceOnTheEight(s, events, seatId);
  } else {
    // Nothing dropped, or only the opponent's balls dropped (still counts for
    // them — "slop", no called shots) — turn passes either way.
    s.currentSeatId = opp;
  }
}

// ── prompt + summary builders ────────────────────────────────────────────────

function recentActionLines(state: EightBallState, max: number): string[] {
  return state.log
    .filter((e) => typeof e.message === "string" && e.message.trim().length > 0)
    .slice(-max)
    .map((e) => `  • ${e.message}`);
}

function buildBoardSummary(state: EightBallState, seatId: string): string {
  const opp = otherSeat(state, seatId);
  const lines: string[] = [
    `8-Ball Pool — rack #${state.rackNumber}, race to ${state.config.raceTo}. ` +
      `Score: ${nameOf(state, seatId)} ${state.rackScore[seatId] ?? 0} - ${state.rackScore[opp] ?? 0} ${nameOf(state, opp)}.`,
  ];

  if (state.phase === "break") {
    lines.push("It's the break — the rack is fresh, all 15 object balls on the table.");
  } else {
    const myGroup = state.groups[seatId];
    if (!myGroup) {
      lines.push("Table is OPEN — no groups assigned yet. Pot anything except the 8 to claim your group.");
    } else {
      const remaining = remainingIdsForGroup(state, myGroup);
      const oppGroup: BallGroup = myGroup === "solids" ? "stripes" : "solids";
      const oppRemaining = remainingIdsForGroup(state, oppGroup);
      if (remaining.length === 0) {
        lines.push(`You are ${myGroup.toUpperCase()} — cleared! You're shooting for the 8.`);
      } else {
        const zones = remaining.map((id) => `${ballLabel(id)} (${zoneName(state.balls.find((b) => b.id === id)!)})`).join(", ");
        lines.push(`You are ${myGroup.toUpperCase()} — ${remaining.length} left: ${zones}.`);
      }
      lines.push(`${nameOf(state, opp)} is ${oppGroup.toUpperCase()} with ${oppRemaining.length} left.`);
    }
    if (state.ballInHandFor === seatId) lines.push("You have BALL IN HAND — your shot choice places it for you.");
  }

  const recent = recentActionLines(state, 5);
  if (recent.length) lines.push("What just happened:", ...recent);
  return lines.join("\n");
}

function buildInstructions(state: EightBallState, seatId: string, candidates: ShotCandidate[]): string {
  const header = state.ballInHandFor === seatId ? "Ball in hand — your shot menu (each choice places the cue for you):" : "Your shot menu:";
  const menuLines = candidates.map((c) => `  • ${c.id} [${c.tier}, ${c.successPct}% estimated odds]: ${c.desc}`);
  return [
    header,
    ...menuLines,
    "",
    'Call eightball_action with `shotId` copied EXACTLY from the menu above (plus optional `style`: "controlled" or "aggressive").',
    "The odds above are ESTIMATES, not a dice roll — your aim gets executed with skill/style-based accuracy and the physics " +
      "decides what actually happens. Pick like YOUR character, not like a pro solver. Daredevils attempt the showoff bank; " +
      "cold tacticians play the safety and leave them nothing; hotheads smash aggressive. Trash-talk is chat, not moves.",
  ].join("\n");
}

function buildSpectatorSummary(state: EightBallState): string {
  const [a, b] = state.seatOrder as [string, string];
  if (state.status === "finished") {
    const winner = state.winnerSeatId;
    const loser = winner ? otherSeat(state, winner) : null;
    return winner && loser
      ? `The 8-ball match just finished — ${nameOf(state, winner)} won it ${state.rackScore[winner]}-${state.rackScore[loser] ?? 0}.`
      : "The 8-ball match just finished.";
  }
  const lines: string[] = [
    `A game of 8-ball pool is in progress — rack #${state.rackNumber}, race to ${state.config.raceTo}. ` +
      `Score: ${nameOf(state, a)} ${state.rackScore[a] ?? 0} - ${state.rackScore[b] ?? 0} ${nameOf(state, b)}.`,
  ];
  if (state.phase === "break") {
    lines.push("The table is freshly racked, about to break.");
  } else {
    for (const id of state.seatOrder) {
      const group = state.groups[id];
      lines.push(group ? `${nameOf(state, id)} is ${group}.` : `${nameOf(state, id)}'s group is not yet decided.`);
    }
  }
  if (state.status === "rack_over") lines.push("The rack just ended — waiting on the next rack.");
  else if (state.currentSeatId) lines.push(`It's currently ${nameOf(state, state.currentSeatId)}'s shot.`);
  const recent = recentActionLines(state, 6);
  if (recent.length) lines.push("Recent action:", ...recent);
  return lines.join("\n");
}

function buildParticipantSummary(state: EightBallState, seatId: string): string {
  const base = buildSpectatorSummary(state);
  if (!state.seatOrder.includes(seatId)) return base;
  const lines: string[] = [base, `You are ${nameOf(state, seatId)} in this game.`];
  if (state.status !== "finished") {
    const group = state.groups[seatId];
    if (group) lines.push(`Your group: ${group}, ${remainingIdsForGroup(state, group).length} left.`);
    if (state.currentSeatId === seatId) {
      lines.push(state.status === "rack_over" ? "It's your turn to start the next rack." : "It's YOUR shot.");
    }
  }
  return lines.join("\n");
}

// ── deterministic fallback ──────────────────────────────────────────────────

const TIER_ORDER: Readonly<Record<ShotTier, number>> = { easy: 0, medium: 1, hard: 2, very_hard: 3 };

function pickFallback(state: EightBallState, seatId: string): EightBallMove {
  if (state.status === "rack_over") return { kind: "next_rack" };
  const legal = legalMovesFor(state, seatId);
  const menuMoves = legal.filter((m): m is Extract<EightBallMove, { kind: "menu" }> => m.kind === "menu");
  if (menuMoves.length === 0) {
    const placeMove = legal.find((m): m is Extract<EightBallMove, { kind: "place" }> => m.kind === "place");
    if (placeMove) return placeMove;
    return { kind: "next_rack" }; // unreachable while active + it's their turn; total fallback
  }
  const candidates = buildCandidateMenu(state, seatId);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const nonSafetyIds = candidates.filter((c) => c.kind !== "safety").map((c) => c.id);
  const poolIds = nonSafetyIds.length ? nonSafetyIds : candidates.map((c) => c.id);
  const bestId = [...poolIds].sort((a, b) => {
    const ca = byId.get(a)!;
    const cb = byId.get(b)!;
    return TIER_ORDER[ca.tier] - TIER_ORDER[cb.tier] || cb.successPct - ca.successPct || a.localeCompare(b);
  })[0]!;
  return { kind: "menu", shotId: bestId, style: "controlled" };
}

// ── the engine object ────────────────────────────────────────────────────────

export const eightBallEngine: TurnGameEngine<EightBallState, EightBallMove, EightBallConfig, EightBallPublicView> = {
  gameType: "eightball",
  schemaVersion: 1,
  label: "8-Ball Pool",
  minPlayers: EIGHTBALL_MIN_PLAYERS,
  maxPlayers: EIGHTBALL_MAX_PLAYERS,
  hiddenInformation: false,

  defaultConfig() {
    return { ...DEFAULT_EIGHTBALL_CONFIG };
  },

  normalizeConfig(config) {
    const direct = eightBallConfigSchema.safeParse(config);
    const merged = direct.success
      ? direct.data
      : { ...DEFAULT_EIGHTBALL_CONFIG, ...(config && typeof config === "object" ? (config as object) : {}) };
    return clampEightBallConfig(merged as Partial<EightBallConfig>);
  },

  setup(config, seatsIn: Seat[], seed) {
    const seatOrder = seatsIn.map((s) => s.seatId);
    const seatNames: Record<string, string> = {};
    for (const s of seatsIn) seatNames[s.seatId] = s.displayName;

    const humanSeat = seatsIn.find((s) => s.kind === "human") ?? seatsIn[0]!;
    const otherSeatObj = seatsIn.find((s) => s.seatId !== humanSeat.seatId) ?? seatsIn[seatsIn.length - 1]!;
    const breakerSeatId =
      config.humanBreaks === "you"
        ? humanSeat.seatId
        : config.humanBreaks === "opponent"
          ? otherSeatObj.seatId
          : Math.abs(seed) % 2 === 0
            ? humanSeat.seatId
            : otherSeatObj.seatId;

    const state: EightBallState = {
      config,
      seed,
      shotCounter: 0,
      seats: seatsIn.map((s) => ({ seatId: s.seatId, displayName: s.displayName, kind: s.kind })),
      seatOrder,
      seatNames,
      status: "active",
      phase: "break",
      balls: freshRackBalls(),
      cuePos: { ...KITCHEN_SPOT },
      awaitingPlacement: false,
      placementZone: null,
      lastShot: null,
      groups: Object.fromEntries(seatOrder.map((id) => [id, null])),
      rackScore: Object.fromEntries(seatOrder.map((id) => [id, 0])),
      rackNumber: 1,
      breakerSeatId,
      currentSeatId: breakerSeatId,
      ballInHandFor: null,
      winnerSeatId: null,
      lastAction: null,
      pendingAnnouncements: [],
      log: [],
    };

    const events: GameEvent[] = [];
    announce(state, events, {
      type: "game_started",
      seatId: breakerSeatId,
      message: `Rack 1 — ${nameOf(state, breakerSeatId)} breaks. Race to ${config.raceTo}.`,
    });
    return state;
  },

  currentSeat(state) {
    return state.status === "finished" ? null : state.currentSeatId;
  },

  interruptibleSeats() {
    return [];
  },

  legalMoves(state, seatId) {
    return legalMovesFor(state, seatId);
  },

  applyMove(state, seatId, move): MoveResult<EightBallState, EightBallMove> {
    if (state.status === "finished") return fail("The match is already over.");

    if (move?.kind === "next_rack") {
      if (state.status !== "rack_over" || state.currentSeatId !== seatId) {
        return { ok: false, error: "It's not time for the next rack yet.", legalMoves: legalMovesFor(state, seatId) };
      }
      const s = clone(state);
      const events: GameEvent[] = [];
      startNewRack(s, events);
      return { ok: true, state: s, events };
    }

    if (state.status !== "active" || state.currentSeatId !== seatId) {
      return { ok: false, error: "It's not your turn.", legalMoves: legalMovesFor(state, seatId) };
    }

    if (move?.kind === "place") {
      const zone = placementZoneFor(state, seatId);
      if (!zone) return fail("You don't have ball in hand right now.", legalMovesFor(state, seatId));
      if (!Number.isFinite(move.x) || !Number.isFinite(move.y)) {
        return fail("Placement coordinates must be finite numbers.", legalMovesFor(state, seatId));
      }
      const p: Point = { x: move.x, y: move.y };
      const onTable = state.balls.filter((b) => b.onTable);
      if (!isValidCuePlacement(p, onTable, zone)) {
        return fail(
          "That placement isn't legal — off the table, overlapping a ball, inside a pocket's zone, or outside the kitchen.",
          legalMovesFor(state, seatId),
        );
      }
      const s = clone(state);
      s.cuePos = p;
      if (s.awaitingPlacement) {
        s.awaitingPlacement = false;
        s.placementZone = null;
        s.ballInHandFor = null;
      }
      const events: GameEvent[] = [];
      record(s, events, { type: "cue_placed", seatId, message: `${nameOf(s, seatId)} places the cue ball.` });
      return { ok: true, state: s, events };
    }

    if (move?.kind === "aimed") {
      if (state.cuePos === null) {
        return fail("You have ball in hand — place the cue first.", legalMovesFor(state, seatId));
      }
      const isBreakShot = state.phase === "break";
      const s = clone(state);
      const power = Number.isFinite(move.power) ? move.power : 0;
      const angleDeg = Number.isFinite(move.angleDeg) ? move.angleDeg : 0;
      const sim = simulateShot({ balls: buildSimBalls(s), cueVelocity: angleDegToVelocity(angleDeg, power) });
      s.shotCounter += 1;
      const events: GameEvent[] = [];
      resolveShot(s, seatId, isBreakShot, "aimed", sim, events);
      return { ok: true, state: s, events };
    }

    if (move?.kind === "menu") {
      const candidates = buildCandidateMenu(state, seatId);
      const candidate = candidates.find((c) => c.id === move.shotId);
      if (!candidate) {
        return { ok: false, error: `Unknown or no-longer-legal shot "${move.shotId}".`, legalMoves: legalMovesFor(state, seatId) };
      }
      const style: ShotStyle = move.style === "aggressive" ? "aggressive" : "controlled";
      const isBreakShot = state.phase === "break";
      const s = clone(state);
      const aim = convertMenuToAim(s, candidate, style, isBreakShot);
      s.shotCounter += 1;
      if (s.cuePos === null) {
        // Ball-in-hand for this (possibly bot) seat: the chosen candidate's
        // assumed placement becomes the real cue position (v1 behavior kept —
        // see ShotCandidate.virtualCuePos's doc).
        s.cuePos = { x: aim.effectiveCuePos.x, y: aim.effectiveCuePos.y };
        s.awaitingPlacement = false;
        s.placementZone = null;
        s.ballInHandFor = null;
      }
      const sim = simulateShot({ balls: buildSimBalls(s), cueVelocity: angleDegToVelocity(aim.angleDeg, aim.power) });
      const events: GameEvent[] = [];
      resolveShot(s, seatId, isBreakShot, "menu", sim, events, candidate);
      return { ok: true, state: s, events };
    }

    return { ok: false, error: "Unknown move.", legalMoves: legalMovesFor(state, seatId) };
  },

  isTerminal(state): TerminalResult {
    return state.status === "finished"
      ? { done: true, ...(state.winnerSeatId ? { winnerSeatId: state.winnerSeatId } : {}) }
      : { done: false };
  },

  describeForModel(state, seatId): ModelTurnView<EightBallMove> {
    const candidates = buildCandidateMenu(state, seatId);
    return {
      boardSummary: buildBoardSummary(state, seatId),
      legalMoves: legalMovesFor(state, seatId),
      instructions: buildInstructions(state, seatId, candidates),
    };
  },

  spectatorSummary(state): string {
    return buildSpectatorSummary(state);
  },

  participantSummary(state, seatId): string {
    return buildParticipantSummary(state, seatId);
  },

  publicView(state, viewerSeatId): EightBallPublicView {
    const seats: EightBallPublicSeat[] = state.seatOrder.map((id) => {
      const seat = state.seats.find((x) => x.seatId === id)!;
      return {
        seatId: id,
        displayName: nameOf(state, id),
        kind: seat.kind,
        group: state.groups[id] ?? null,
        racksWon: state.rackScore[id] ?? 0,
        isCurrent: state.currentSeatId === id,
      };
    });

    const balls: EightBallPublicBall[] = state.balls.map((b) => ({ id: b.id, x: b.x, y: b.y, pocketed: !b.onTable }));
    if (state.cuePos) balls.push({ id: CUE_ID, x: state.cuePos.x, y: state.cuePos.y, pocketed: false });
    balls.sort((a, b) => a.id - b.id);

    const pocketedByGroup: Record<BallGroup, number> = { solids: 0, stripes: 0 };
    for (const b of state.balls) {
      if (b.onTable) continue;
      if (SOLID_IDS.includes(b.id)) pocketedByGroup.solids += 1;
      else if (STRIPE_IDS.includes(b.id)) pocketedByGroup.stripes += 1;
    }

    let yourShots: EightBallPublicCandidate[] | null = null;
    if (viewerSeatId && viewerSeatId === state.currentSeatId && state.status === "active") {
      yourShots = buildCandidateMenu(state, viewerSeatId).map(({ virtualCuePos: _virtualCuePos, ...rest }) => rest);
    }

    const onTheEightSeat = state.currentSeatId;
    const onTheEightGroup = onTheEightSeat ? state.groups[onTheEightSeat] : null;
    const onTheEight = !!onTheEightGroup && remainingIdsForGroup(state, onTheEightGroup).length === 0;

    return {
      gameType: "eightball",
      status: state.status,
      phase: state.phase,
      shotCounter: state.shotCounter,
      balls,
      pocketedByGroup,
      groups: { ...state.groups },
      seats,
      currentSeatId: state.currentSeatId,
      yourSeatId: viewerSeatId,
      ballInHandFor: state.ballInHandFor,
      awaitingPlacement: state.awaitingPlacement,
      placementZone: state.placementZone,
      lastShot: state.lastShot,
      onTheEight,
      raceTo: state.config.raceTo,
      rackNumber: state.rackNumber,
      winnerSeatId: state.winnerSeatId,
      lastAction: state.lastAction,
      yourShots,
      recentLog: state.log.slice(-8),
      hasPendingAnnouncements: state.pendingAnnouncements.length > 0,
      config: state.config,
    };
  },

  pickFallbackMove(state, seatId) {
    return pickFallback(state, seatId);
  },

  toolManifests() {
    return [...EIGHTBALL_TOOL_MANIFESTS];
  },

  parseToolCall(name, args) {
    return parseEightBallToolCall(name, args);
  },

  announcerCharacterId(state) {
    return state.config.announcerCharacterId;
  },

  drainAnnouncements(state) {
    if (state.pendingAnnouncements.length === 0) return null;
    const s = clone(state);
    const announcements = s.pendingAnnouncements;
    s.pendingAnnouncements = [];
    return { state: s, announcements };
  },
};
