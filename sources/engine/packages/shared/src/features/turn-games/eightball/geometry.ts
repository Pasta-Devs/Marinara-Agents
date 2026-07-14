// ──────────────────────────────────────────────
// 8-Ball Pool — Pure Table Geometry
// ──────────────────────────────────────────────
// Everything here is a PURE function of ball positions: no state mutation, no
// randomness. `generateCandidates` is the heart of the hybrid model — it turns
// real ball positions into the finite, difficulty-scored shot menu the LLM
// picks from (engine.ts does the seeded resolution once a candidate is chosen).
// Kept rng-free on purpose so the whole menu is trivially unit-testable and
// reproducible: same balls in, same candidates out, every time.

import {
  BALL_R,
  BANK_SUCCESS_PCT,
  BASE_SUCCESS_PCT,
  EPS,
  HANGER_DISTANCE,
  HANGER_SCORE_BIAS,
  MAX_BANK_CANDIDATES,
  MAX_CUT_ANGLE_DEG,
  MAX_POT_BANK_CANDIDATES,
  MAX_SAFETY_CANDIDATES,
  OBSTRUCTION_FACTOR,
  OVERLAP_EPS,
  POCKETS,
  POCKET_IDS,
  SAFETY_SUCCESS_PCT,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  type BallPos,
  type PocketId,
  type Point,
  type ShotCandidate,
  type ShotTier,
} from "./types.js";

// ── vector helpers ───────────────────────────────────────────────────────────

export function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}
export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}
export function scale(a: Point, k: number): Point {
  return { x: a.x * k, y: a.y * k };
}
export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}
export function length(a: Point): number {
  return Math.hypot(a.x, a.y);
}
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
export function unit(a: Point): Point {
  const len = length(a);
  return len < EPS ? { x: 0, y: 0 } : scale(a, 1 / len);
}

/** Angle between two vectors in degrees, 0..180. Degenerate (near-zero-length)
 * inputs return 0 rather than NaN — callers treat that as "no cut". */
export function angleBetweenDeg(v1: Point, v2: Point): number {
  const l1 = length(v1);
  const l2 = length(v2);
  if (l1 < EPS || l2 < EPS) return 0;
  const cos = Math.min(1, Math.max(-1, dot(v1, v2) / (l1 * l2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

// ── bounds / obstruction ─────────────────────────────────────────────────────

export function inBounds(p: Point, margin = BALL_R): boolean {
  return p.x >= margin && p.x <= TABLE_WIDTH - margin && p.y >= margin && p.y <= TABLE_HEIGHT - margin;
}

export function clampToBounds(p: Point, margin = BALL_R): Point {
  return {
    x: Math.min(TABLE_WIDTH - margin, Math.max(margin, p.x)),
    y: Math.min(TABLE_HEIGHT - margin, Math.max(margin, p.y)),
  };
}

/** Shortest distance from point `p` to segment `a`-`b`. */
export function pointSegmentDistance(p: Point, a: Point, b: Point): number {
  const ab = sub(b, a);
  const lenSq = dot(ab, ab);
  const t = lenSq > EPS ? Math.min(1, Math.max(0, dot(sub(p, a), ab) / lenSq)) : 0;
  const closest = add(a, scale(ab, t));
  return distance(p, closest);
}

/** True if any ball NOT in `excludeIds` sits close enough to segment `a`-`b`
 * to physically block a ball traveling along it. */
export function segmentObstructed(a: Point, b: Point, balls: readonly BallPos[], excludeIds: ReadonlySet<number>): boolean {
  const threshold = 2 * BALL_R * OBSTRUCTION_FACTOR;
  for (const ball of balls) {
    if (excludeIds.has(ball.id)) continue;
    if (pointSegmentDistance(ball.pos, a, b) < threshold) return true;
  }
  return false;
}

/**
 * True if a point sits inside any pocket's capture radius — the "cue is
 * resting in a pocket" check (see POCKET_IDS/POCKETS' doc: capture radius is
 * ONLY meaningful for the cue).
 */
export function pointScratches(p: Point): boolean {
  return POCKET_IDS.some((id) => distance(p, POCKETS[id].pos) < POCKETS[id].captureRadius);
}

/**
 * True if the straight-line travel from `a` to `b` passes through any
 * pocket's capture radius anywhere along the way — not just at the final
 * rest point. This matters because `reflectOnce`'s single-rail bounce can
 * send an overshooting corner shot far from the corner it just overshot (a
 * diagonal overshoot near a corner isn't a single-rail bounce in reality —
 * the ball just falls in). Checking the pre-reflection path is what makes a
 * "cue follows the ball into the pocket" scratch reachable at all for corner
 * pockets, not just side pockets.
 */
export function segmentScratches(a: Point, b: Point): boolean {
  return POCKET_IDS.some((id) => pointSegmentDistance(POCKETS[id].pos, a, b) < POCKETS[id].captureRadius);
}

function tooCloseToAny(p: Point, balls: readonly BallPos[]): boolean {
  const minDist = 2 * BALL_R - OVERLAP_EPS;
  return balls.some((b) => distance(p, b.pos) < minDist);
}

// ── overlap resolution ───────────────────────────────────────────────────────

/**
 * Deterministically nudge apart any balls closer than 2*BALL_R (touching is
 * fine — a fresh rack is exactly touching everywhere — only true
 * interpenetration is resolved). Fixed pass count + fixed id-ascending pair
 * order make this reproducible regardless of engine call site. Re-clamps to
 * table bounds after every nudge so a resolved position can never end up
 * off-table — which is also why convergence isn't exact: a ball pinned
 * against a rail can only give up half its share of an overlap, so clusters
 * near the cushions take more passes than an isolated pair. 40 passes is
 * comfortably enough for a 16-ball table (see OVERLAP_EPS's doc for the
 * matching "good enough" tolerance callers should check against).
 */
export function resolveOverlaps(balls: readonly BallPos[], passes = 40): BallPos[] {
  const arr = balls.map((b) => ({ id: b.id, pos: { ...b.pos } }));
  const minDist = 2 * BALL_R - OVERLAP_EPS;
  for (let pass = 0; pass < passes; pass++) {
    let moved = false;
    arr.sort((a, b) => a.id - b.id);
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i]!;
        const b = arr[j]!;
        const d = distance(a.pos, b.pos);
        if (d >= minDist) continue;
        moved = true;
        const overlap = 2 * BALL_R - d;
        // Degenerate (identical centers) direction fallback keyed on id parity —
        // deterministic and never divides by zero.
        const dir = d > EPS ? unit(sub(b.pos, a.pos)) : a.id % 2 === 0 ? { x: 1, y: 0 } : { x: 0, y: 1 };
        a.pos = clampToBounds(sub(a.pos, scale(dir, overlap / 2)));
        b.pos = clampToBounds(add(b.pos, scale(dir, overlap / 2)));
      }
    }
    if (!moved) break;
  }
  return arr.map((b) => ({ id: b.id, pos: b.pos }));
}

// ── ghost ball / cut angle ───────────────────────────────────────────────────

/** The point the cue ball's CENTER must reach to send `ballPos` toward `pocketPos`. */
export function ghostBallPoint(ballPos: Point, pocketPos: Point): Point {
  const dir = unit(sub(pocketPos, ballPos));
  return sub(ballPos, scale(dir, 2 * BALL_R));
}

/** Angle between the cue's travel line (cue->ghost) and the object ball's
 * intended travel line (ball->pocket). 0 = dead straight, 90 = impossible cut. */
export function cutAngleDeg(cuePos: Point, ghost: Point, ballPos: Point, pocketPos: Point): number {
  return angleBetweenDeg(sub(ghost, cuePos), sub(pocketPos, ballPos));
}

// ── difficulty scoring ───────────────────────────────────────────────────────

const TABLE_DIAGONAL = Math.hypot(TABLE_WIDTH, TABLE_HEIGHT);

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export interface Difficulty {
  tier: ShotTier;
  successPct: number;
}

/**
 * theta (cut angle, deg) dominates (0.65 weight) over combined travel distance
 * (0.35 weight, normalized against the table diagonal) — a straight long shot
 * is still easier than a short thin cut. A hanging ball (`d2 < HANGER_DISTANCE`)
 * gets a flat bias toward easy regardless of angle, since a ball sitting on the
 * lip is forgiving even when the cut is awkward.
 */
export function classifyDifficulty(thetaDeg: number, d1: number, d2: number): Difficulty {
  const angleFactor = clamp01(thetaDeg / MAX_CUT_ANGLE_DEG);
  const distFactor = clamp01((d1 + d2) / TABLE_DIAGONAL);
  let score = angleFactor * 0.65 + distFactor * 0.35;
  if (d2 < HANGER_DISTANCE) score -= HANGER_SCORE_BIAS;
  score = clamp01(score);
  const tier: ShotTier = score <= 0.25 ? "easy" : score <= 0.5 ? "medium" : score <= 0.75 ? "hard" : "very_hard";
  return { tier, successPct: BASE_SUCCESS_PCT[tier] };
}

// ── ball-in-hand virtual cue placement ───────────────────────────────────────

/** Candidate cue-ball distances (inches) behind the object ball to try, in
 * preference order — a fixed, deterministic search, not an optimization. */
const BALL_IN_HAND_DISTANCES: readonly number[] = [22, 18, 26, 15, 30];

/**
 * Places a virtual cue ball on the line from `pocketPos` through `ballPos`,
 * extended beyond the ball — i.e. a dead-straight shot on that ball into that
 * pocket — at the nearest of a few fixed distances that lands in-bounds,
 * doesn't overlap another ball, and has a clear line to the ghost point.
 * Returns null if no distance in the search list works (candidate is dropped).
 */
export function pickCuePlacementForBallInHand(ballPos: Point, pocketPos: Point, otherBalls: readonly BallPos[]): Point | null {
  const dir = unit(sub(ballPos, pocketPos));
  if (dir.x === 0 && dir.y === 0) return null; // degenerate: ball sits on the pocket point
  const ghost = ghostBallPoint(ballPos, pocketPos);
  for (const dist of BALL_IN_HAND_DISTANCES) {
    const candidate = add(ballPos, scale(dir, dist));
    if (!inBounds(candidate)) continue;
    if (tooCloseToAny(candidate, otherBalls)) continue;
    if (segmentObstructed(candidate, ghost, otherBalls, new Set())) continue;
    return candidate;
  }
  return null;
}

// ── bank (one-cushion mirror) math ───────────────────────────────────────────

export type Rail = "top" | "bottom" | "left" | "right";
const RAILS: readonly Rail[] = ["top", "bottom", "left", "right"];

/** Mirror `p` across the given rail line. */
export function reflectAcrossRail(p: Point, rail: Rail): Point {
  switch (rail) {
    case "top":
      return { x: p.x, y: -p.y };
    case "bottom":
      return { x: p.x, y: 2 * TABLE_HEIGHT - p.y };
    case "left":
      return { x: -p.x, y: p.y };
    case "right":
      return { x: 2 * TABLE_WIDTH - p.x, y: p.y };
  }
}

/**
 * Where the ball-to-virtual-pocket line actually crosses the physical rail, or
 * null if the geometry doesn't produce a valid bounce (parallel travel, the
 * crossing falls outside the ball->virtualPocket segment, or the crossing
 * point is off the end of the table).
 */
export function railContactPoint(ballPos: Point, virtualPocket: Point, rail: Rail): Point | null {
  const horizontal = rail === "top" || rail === "bottom";
  const railCoord = rail === "top" ? 0 : rail === "bottom" ? TABLE_HEIGHT : rail === "left" ? 0 : TABLE_WIDTH;
  const a = horizontal ? ballPos.y : ballPos.x;
  const b = horizontal ? virtualPocket.y : virtualPocket.x;
  if (Math.abs(b - a) < EPS) return null;
  const t = (railCoord - a) / (b - a);
  if (t <= 0.02 || t >= 0.98) return null; // contact must be strictly between ball and virtual pocket
  const point: Point = { x: ballPos.x + t * (virtualPocket.x - ballPos.x), y: ballPos.y + t * (virtualPocket.y - ballPos.y) };
  if (horizontal && (point.x < 0 || point.x > TABLE_WIDTH)) return null;
  if (!horizontal && (point.y < 0 || point.y > TABLE_HEIGHT)) return null;
  return point;
}

// ── zone naming (for describeForModel board summaries) ──────────────────────

/** Coarse 3x3 zone label for a position — used to describe ball clusters in
 * plain English without leaking exact coordinates into the prompt. */
export function zoneName(pos: Point): string {
  const col = pos.x < TABLE_WIDTH / 3 ? 0 : pos.x < (2 * TABLE_WIDTH) / 3 ? 1 : 2;
  const row = pos.y < TABLE_HEIGHT / 3 ? 0 : pos.y < (2 * TABLE_HEIGHT) / 3 ? 1 : 2;
  const rowNames = ["top", "middle", "bottom"];
  const colNames = ["left", "center", "right"];
  if (row === 1 && col === 1) return "center";
  if (row === 1) return `${colNames[col]} rail`;
  if (col === 1) return `${rowNames[row]} rail`;
  return `${rowNames[row]}-${colNames[col]} corner`;
}

// ── deterministic phrase table (candidate `desc`) ────────────────────────────

/** Exported for reuse by engine.ts's board summaries / narration text. */
export function ballLabel(ballId: number): string {
  return ballId === 8 ? "the 8" : `the ${ballId}`;
}

export function pocketLabel(id: PocketId): string {
  switch (id) {
    case "NW":
      return "the top-left corner";
    case "N":
      return "the top side";
    case "NE":
      return "the top-right corner";
    case "SW":
      return "the bottom-left corner";
    case "S":
      return "the bottom side";
    case "SE":
      return "the bottom-right corner";
  }
}

function proximityPhrase(d2: number): string {
  if (d2 < HANGER_DISTANCE) return "hanging on the lip";
  if (d2 < 20) return "sitting close";
  if (d2 < 45) return "a workable distance out";
  return "clear across the table";
}

function anglePhrase(theta: number): string {
  if (theta <= 12) return "dead straight";
  if (theta <= 30) return "a gentle angle";
  if (theta <= 55) return "a real cut";
  return "a thin cut";
}

function describePot(ballId: number, pocketId: PocketId, tier: ShotTier, theta: number, d2: number): string {
  if (tier === "very_hard") return `long thin cut on ${ballLabel(ballId)} into ${pocketLabel(pocketId)} — showoff territory`;
  return `${ballLabel(ballId)} into ${pocketLabel(pocketId)} — ${anglePhrase(theta)}, ${proximityPhrase(d2)}`;
}

function describeBank(ballId: number, pocketId: PocketId): string {
  return `bank ${ballLabel(ballId)} off the rail into ${pocketLabel(pocketId)} — a real gamble`;
}

function describeSafety(ballId: number): string {
  return `tuck the cue behind ${ballLabel(ballId)} and leave them nothing`;
}

// ── rack layout ───────────────────────────────────────────────────────────────

/** Row spacing for a triangle rack: sqrt(3)*r between row apexes so every ball
 * touches its two below-row neighbors exactly (standard billiards geometry). */
const RACK_ROW_DX = 2 * BALL_R * Math.cos(Math.PI / 6);
/** Ascending id fill order for every rack slot except the dead-center one (the
 * 8-ball's traditional spot). Flavor only — groups are assigned dynamically
 * during play, never inferred from rack position. */
const RACK_FILL_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
const EIGHT_SLOT_INDEX = 4;

export function standardRackPositions(footSpot: Point): BallPos[] {
  const slots: Point[] = [];
  for (let row = 0; row < 5; row++) {
    const count = row + 1;
    const x = footSpot.x + row * RACK_ROW_DX;
    const spread = row * BALL_R;
    for (let col = 0; col < count; col++) {
      slots.push({ x, y: footSpot.y - spread + col * 2 * BALL_R });
    }
  }
  const balls: BallPos[] = [];
  let orderIdx = 0;
  for (let i = 0; i < slots.length; i++) {
    const id = i === EIGHT_SLOT_INDEX ? 8 : RACK_FILL_ORDER[orderIdx++]!;
    balls.push({ id, pos: slots[i]! });
  }
  return balls.sort((a, b) => a.id - b.id);
}

// ── candidate generation ─────────────────────────────────────────────────────

/** Internal scoring companion to a candidate, stripped before returning. */
type Scored = ShotCandidate & { distSum: number };

const TIER_ORDER: Readonly<Record<ShotTier, number>> = { easy: 0, medium: 1, hard: 2, very_hard: 3 };

export interface GenerateCandidatesInput {
  /** Null means ball-in-hand: every candidate computes its own optimal virtual
   * cue placement instead of using a fixed position (see `pickCuePlacementForBallInHand`). */
  cuePos: Point | null;
  /** On-table OBJECT balls only (ids 1-15) — never includes the cue. */
  balls: readonly BallPos[];
  /** Ball ids the shooter may legally target right now, in a stable (ascending)
   * order — insertion order feeds the deterministic cap/sort tiebreak. */
  legalTargets: readonly number[];
}

/**
 * The full candidate shot menu for the current shooter: every unobstructed
 * direct pot, a bank fallback when a ball has no direct line to any pocket,
 * one safety per (capped) legal target ball. Pure function of the inputs —
 * same balls + same legal targets always produce the identical menu.
 */
export function generateCandidates(input: GenerateCandidatesInput): ShotCandidate[] {
  const { cuePos, balls, legalTargets } = input;
  if (legalTargets.length === 0) return [];

  const potsAndBanks: Scored[] = [];

  for (const targetId of legalTargets) {
    const ball = balls.find((b) => b.id === targetId);
    if (!ball) continue; // defensive: legalTargets should always reference on-table balls
    const others = balls.filter((b) => b.id !== targetId);
    let hasDirect = false;

    for (const pocketId of POCKET_IDS) {
      const pocket = POCKETS[pocketId];
      const effectiveCue = cuePos ?? pickCuePlacementForBallInHand(ball.pos, pocket.pos, others);
      if (!effectiveCue) continue;
      const ghost = ghostBallPoint(ball.pos, pocket.pos);
      const theta = cutAngleDeg(effectiveCue, ghost, ball.pos, pocket.pos);
      if (theta > MAX_CUT_ANGLE_DEG) continue;
      if (segmentObstructed(effectiveCue, ghost, others, new Set([targetId]))) continue;
      if (segmentObstructed(ball.pos, pocket.pos, others, new Set([targetId]))) continue;

      hasDirect = true;
      const d1 = distance(effectiveCue, ghost);
      const d2 = distance(ball.pos, pocket.pos);
      const { tier, successPct } = classifyDifficulty(theta, d1, d2);
      potsAndBanks.push({
        id: `pot-${targetId}-${pocketId}`,
        kind: "pot",
        ballId: targetId,
        pocketId,
        tier,
        successPct,
        desc: describePot(targetId, pocketId, tier, theta, d2),
        distSum: d1 + d2,
        ...(cuePos === null ? { virtualCuePos: effectiveCue } : {}),
      });
    }

    // Banks are spice, not a substitute: only offered when NOTHING direct exists
    // for this ball (spec: capped 2 total, always very_hard).
    if (!hasDirect) {
      for (const pocketId of POCKET_IDS) {
        const pocket = POCKETS[pocketId];
        let found: { effectiveCue: Point; contact: Point; virtualPocket: Point } | null = null;
        for (const rail of RAILS) {
          const virtualPocket = reflectAcrossRail(pocket.pos, rail);
          const contact = railContactPoint(ball.pos, virtualPocket, rail);
          if (!contact) continue;
          const effectiveCue = cuePos ?? pickCuePlacementForBallInHand(ball.pos, virtualPocket, others);
          if (!effectiveCue) continue;
          const ghost = ghostBallPoint(ball.pos, virtualPocket);
          const theta = cutAngleDeg(effectiveCue, ghost, ball.pos, virtualPocket);
          if (theta > MAX_CUT_ANGLE_DEG) continue;
          if (segmentObstructed(effectiveCue, ghost, others, new Set([targetId]))) continue;
          if (segmentObstructed(ball.pos, contact, others, new Set([targetId]))) continue;
          if (segmentObstructed(contact, pocket.pos, others, new Set([targetId]))) continue;
          found = { effectiveCue, contact, virtualPocket };
          break; // first valid rail wins — deterministic fixed rail order
        }
        if (!found) continue;
        const d1 = distance(found.effectiveCue, ghostBallPoint(ball.pos, found.virtualPocket));
        const d2 = distance(ball.pos, found.contact) + distance(found.contact, pocket.pos);
        potsAndBanks.push({
          id: `bank-${targetId}-${pocketId}`,
          kind: "bank",
          ballId: targetId,
          pocketId,
          tier: "very_hard",
          successPct: BANK_SUCCESS_PCT,
          desc: describeBank(targetId, pocketId),
          distSum: d1 + d2,
          ...(cuePos === null ? { virtualCuePos: found.effectiveCue } : {}),
        });
      }
    }
  }

  potsAndBanks.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.distSum - b.distSum || a.id.localeCompare(b.id));
  // Enforce the bank cap AFTER sorting so the 2 banks kept are the best ones —
  // a single ball with no direct route can otherwise flood the menu with up to
  // 6 near-identical bank variants (one per pocket).
  let bankCount = 0;
  const bankCapped = potsAndBanks.filter((c) => c.kind !== "bank" || ++bankCount <= MAX_BANK_CANDIDATES);
  const cappedPotsAndBanks = bankCapped.slice(0, MAX_POT_BANK_CANDIDATES).map(({ distSum: _distSum, ...rest }) => rest);

  const safetyTargets = [...legalTargets].sort((a, b) => a - b).slice(0, MAX_SAFETY_CANDIDATES);
  const safeties: ShotCandidate[] = safetyTargets.map((ballId) => ({
    id: `safety-${ballId}`,
    kind: "safety",
    ballId,
    // Nominal difficulty label — safety execute-chance is fixed (SAFETY_SUCCESS_PCT),
    // not scored from cut angle/distance the way pots are (see engine.ts resolution).
    tier: "medium",
    successPct: SAFETY_SUCCESS_PCT,
    desc: describeSafety(ballId),
  }));

  return [...cappedPotsAndBanks, ...safeties];
}
