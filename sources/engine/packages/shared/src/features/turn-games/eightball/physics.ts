// ──────────────────────────────────────────────
// 8-Ball Pool — Pure 2D Physics Simulation (v2)
// ──────────────────────────────────────────────
// Replaces the hybrid seeded-RNG resolution model: a shot's outcome is now
// whatever the balls actually do under a deterministic swept-circle-CCD
// simulation. No Math.random, no Date.now, no I/O, no imports from
// engine.ts — same input always produces the identical SimResult (verified
// by an explicit determinism test in eightball-physics.test.ts).
//
// Model summary (see 8ball-physics-v2-spec.md for the full design doc):
//  - Equal-mass circles (BALL_R), constant rolling-friction deceleration.
//  - Ball-ball collisions: elastic impulse along the center line with
//    restitution; tangential components untouched (no spin/english).
//  - Rails: inset lines at BALL_R from each table edge, reflecting the
//    normal velocity component with restitution — except inside a pocket's
//    "mouth" region, where the cushion doesn't exist (the ball passes
//    through toward the pocket or gets safety-net force-captured).
//  - Pockets: circular capture zones; a ball potted the instant its center
//    enters the radius is removed from the sim immediately.
//  - Integration: fixed DT=1/240s outer step, but within each step we do
//    swept-circle CCD — find the earliest analytic event (ball-ball via
//    quadratic on relative motion, cushion crossing via linear time, pocket
//    capture via quadratic distance), advance exactly to it, resolve,
//    repeat with the remaining step time. This is what kills tunneling at
//    break speeds (~350 u/s) while staying fully deterministic (no fixed
//    substep count that could miss a fast-moving pair).

import {
  distance,
  dot,
  sub,
  unit,
  type Rail,
} from "./geometry.js";
import { BALL_R, CUE_ID, POCKETS, POCKET_IDS, TABLE_HEIGHT, TABLE_WIDTH, type PocketId } from "./types.js";

// ── physics constants (spec-fixed values — see 8ball-physics-v2-spec.md § Model) ──

/**
 * Constant deceleration, u/s^2 (u = inches, matching TABLE_WIDTH/HEIGHT).
 * Deliberately far above real pure-rolling friction (~4 u/s^2): this single
 * constant stands in for rolling + sliding friction + cloth drag combined,
 * since the sim has no sliding phase. Tuned so a max-power shot (360 u/s)
 * settles naturally in ~7s and a medium shot in ~3-4s, keeping MAX_SIM_TIME
 * a pure safety net rather than the common stop path.
 */
export const FRICTION_DECEL = 50;
/** A ball's speed snaps to exactly 0 once friction decays it below this, u/s. */
export const STOP_SPEED = 1.5;
/** Ball-ball elastic collision restitution (normal component only). */
export const BALL_RESTITUTION = 0.94;
/** Rail-bounce restitution (normal component only; tangential unchanged). */
export const RAIL_RESTITUTION = 0.75;
/** power=0 maps to this cue speed, u/s. */
export const MIN_SHOT_SPEED = 30;
/** power=1 maps to this cue speed, u/s (break shots use the full range). */
export const MAX_SHOT_SPEED = 360;
/** Fixed outer integration step, seconds. Chosen so FRAME_DT is an exact 8x multiple. */
export const DT = 1 / 240;
/** Frame-sampling interval, seconds (client animation transport). */
export const FRAME_DT = 1 / 30;
/** Hard sim-time cap; anything still moving is force-stopped at this point. */
export const MAX_SIM_TIME = 12;
/**
 * Half-width (u) of a pocket's "mouth" region measured along its rail from
 * the pocket point. Inside this span the cushion does not reflect — the
 * ball may cross the inset cushion line toward the pocket funnel.
 */
export const MOUTH_HALF = 3.2;

/**
 * Safety cap on CCD substep iterations within a single outer DT step. A
 * correctly-nudged simulation should never need more than a handful of
 * events per 1/240s slice; this exists purely so a pathological/adversarial
 * input (or a future physics bug) can't hang the sim. On overflow every
 * still-active ball's velocity is zeroed (see `runOuterStep`) — the 200-shot
 * seeded fuzz in eightball-physics.test.ts exercises a wide variety of
 * inputs and never observes this path in practice. Sized generously above
 * the worst observed case: the first step of a break resolves a burst of
 * immediate contact events as the impulse chains through the touching rack.
 */
export const MAX_EVENTS_PER_STEP = 256;

/**
 * Tiny positional separation applied after resolving a ball-ball or rail
 * contact, along the collision normal, so the very next CCD search doesn't
 * re-detect the same contact at t=0 due to floating-point noise.
 */
export const COLLISION_NUDGE = 1e-6;

/** Frame de-dup threshold, u: a ball that moved less than this since its
 * last emitted frame is omitted from the next one (spec: "moved ≤0.005"). */
const FRAME_MOVE_EPS = 0.005;
/** Exact integer ratio FRAME_DT/DT (240/30 = 8) — hardcoded rather than
 * computed at runtime so frame timing is pure integer step-counting, never
 * subject to floating-point division drift. */
const FRAME_STEP_INTERVAL = 8;
/** Minimum forward-time an event/loop-remainder must clear to be acted on —
 * guards against infinite substep loops from floating-point noise at t~0. */
const MIN_EVENT_T = 1e-9;
/** Below this squared relative speed, two objects are treated as never
 * meeting (parallel/no relative motion) — guards a divide-by-~0 in the
 * ball-ball and pocket-capture quadratics. */
const MIN_REL_SPEED_SQ = 1e-12;

const RAIL_ORDER: readonly Rail[] = ["top", "bottom", "left", "right"];

/** Which pockets sit on each rail, precomputed once — used to test whether
 * a cushion-crossing point falls inside that pocket's mouth region. */
const POCKETS_ON_RAIL: Readonly<Record<Rail, readonly PocketId[]>> = {
  top: POCKET_IDS.filter((id) => POCKETS[id].pos.y === 0),
  bottom: POCKET_IDS.filter((id) => POCKETS[id].pos.y === TABLE_HEIGHT),
  left: POCKET_IDS.filter((id) => POCKETS[id].pos.x === 0),
  right: POCKET_IDS.filter((id) => POCKETS[id].pos.x === TABLE_WIDTH),
};

// ── public API ───────────────────────────────────────────────────────────────

/** Ball state, units/sec velocities. `id === 0` is always the cue. */
export interface SimBall {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface ShotInput {
  /** Every ball currently on the table (cue included), at rest unless noted. */
  balls: SimBall[];
  /** The impulse applied to the cue ball at t=0 — authoritative over whatever
   * vx/vy the cue's entry in `balls` carries (see `powerToSpeed`). */
  cueVelocity: { vx: number; vy: number };
}

export interface SimEvents {
  potted: Array<{ ballId: number; pocketId: PocketId; t: number }>;
  /** First object ball the cue contacts, or null if the cue never touches anything. */
  firstContactBallId: number | null;
  /** Any cushion reflection (any ball, any rail) occurring after the first
   * cue->object contact. Recorded for future rule use; unused by v2 rules. */
  railContact: boolean;
  /** True if the cue ends up potted (capture or mouth-escape force-capture). */
  cueScratched: boolean;
}

/** A sampled animation keyframe. Only balls that moved (see FRAME_MOVE_EPS)
 * since their previously emitted frame are included. */
export interface SimFrame {
  t: number;
  balls: Array<{ id: number; x: number; y: number }>;
}

export interface SimResult {
  /** Balls still on the table at sim end (potted balls are NOT included here
   * — see `events.potted`). Full precision (frames/finalBalls differ: only
   * frames are rounded). */
  finalBalls: SimBall[];
  events: SimEvents;
  frames: SimFrame[];
  /** Sim time (seconds) when everything stopped, or MAX_SIM_TIME if capped. */
  duration: number;
}

/**
 * Maps a caller-facing 0..1 power dial to a cue speed (u/s). Out-of-range
 * input is clamped rather than rejected — callers (human aim UI, bot menu
 * jitter) are trusted to send 0..1 but this keeps the mapping total.
 */
export function powerToSpeed(power: number): number {
  const clamped = Math.min(1, Math.max(0, power));
  return MIN_SHOT_SPEED + clamped * (MAX_SHOT_SPEED - MIN_SHOT_SPEED);
}

/**
 * Dev-time numeric-hygiene check: throws if any coordinate/velocity/time in
 * a SimResult is NaN or +/-Infinity. Exported so tests (and any caller that
 * wants defense-in-depth) can assert the "no NaN/Infinity ever" contract
 * without re-walking the result shape themselves.
 */
export function assertFiniteSimResult(result: SimResult): void {
  const check = (n: number, label: string): void => {
    if (!Number.isFinite(n)) throw new Error(`physics: non-finite ${label}: ${n}`);
  };
  for (const b of result.finalBalls) {
    check(b.x, `finalBalls[${b.id}].x`);
    check(b.y, `finalBalls[${b.id}].y`);
    check(b.vx, `finalBalls[${b.id}].vx`);
    check(b.vy, `finalBalls[${b.id}].vy`);
  }
  for (const f of result.frames) {
    check(f.t, "frame.t");
    for (const b of f.balls) {
      check(b.x, `frame ball ${b.id}.x`);
      check(b.y, `frame ball ${b.id}.y`);
    }
  }
  for (const p of result.events.potted) check(p.t, `potted[${p.ballId}].t`);
  check(result.duration, "duration");
}

/** Runs a full shot to completion (all balls stopped/potted, or MAX_SIM_TIME
 * cap) and returns the final state, event log, and animation frames. Pure:
 * no randomness, no I/O, no wall-clock reads — see module header. */
export function simulateShot(input: ShotInput): SimResult {
  const active = new Map<number, SimBall>();
  for (const b of input.balls) active.set(b.id, { id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy });
  const cue = active.get(CUE_ID);
  if (cue) {
    cue.vx = input.cueVelocity.vx;
    cue.vy = input.cueVelocity.vy;
  }

  const ctx: SimCtx = {
    simTime: 0,
    potted: [],
    firstContactBallId: null,
    railContact: false,
    cueScratched: false,
    pendingPotForFrame: [],
    lastEmitted: new Map(),
    frames: [],
  };
  for (const ball of active.values()) ctx.lastEmitted.set(ball.id, { x: ball.x, y: ball.y });

  // Defensive: force-capture any already-out-of-bounds starting position
  // (should never happen with valid input; costs nothing when it doesn't).
  forceCaptureOutOfBounds(active, ctx);

  let stepCount = 0;
  while (ctx.simTime < MAX_SIM_TIME - MIN_EVENT_T && active.size > 0 && anyMoving(active)) {
    runOuterStep(active, DT, ctx);
    applyFriction(active);
    captureStoppedJawBalls(active, ctx);
    stepCount++;
    maybeEmitFrame(active, ctx, stepCount);
  }
  if (ctx.simTime >= MAX_SIM_TIME - MIN_EVENT_T) {
    for (const ball of active.values()) {
      ball.vx = 0;
      ball.vy = 0;
    }
  }
  const duration = Math.min(ctx.simTime, MAX_SIM_TIME);

  const finalBallsArr = [...active.values()].sort((a, b) => a.id - b.id);
  const finalFrameBalls: Array<{ id: number; x: number; y: number }> = finalBallsArr.map((b) => ({
    id: b.id,
    x: round2(b.x),
    y: round2(b.y),
  }));
  // Any potted ball that never reached its scheduled frame boundary (sim
  // ended early) still needs to appear somewhere so the client can animate
  // its sink — fold it into the mandatory final frame.
  for (const p of ctx.pendingPotForFrame) finalFrameBalls.push({ id: p.id, x: round2(p.x), y: round2(p.y) });
  finalFrameBalls.sort((a, b) => a.id - b.id);
  const finalFrame: SimFrame = { t: round2(duration), balls: finalFrameBalls };
  // If the last regularly-sampled frame already landed on this exact
  // (rounded) timestamp, replace it rather than appending a second frame
  // with a tied t — keeps `frames` strictly monotonic in t while still
  // guaranteeing the last entry is the full "every on-table ball" final frame.
  const prevFrame = ctx.frames[ctx.frames.length - 1];
  if (prevFrame && prevFrame.t === finalFrame.t) {
    ctx.frames[ctx.frames.length - 1] = finalFrame;
  } else {
    ctx.frames.push(finalFrame);
  }

  const finalBalls: SimBall[] = finalBallsArr.map((b) => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy }));

  return {
    finalBalls,
    events: {
      potted: ctx.potted,
      firstContactBallId: ctx.firstContactBallId,
      railContact: ctx.railContact,
      cueScratched: ctx.cueScratched,
    },
    frames: ctx.frames,
    duration,
  };
}

// ── internal simulation state ────────────────────────────────────────────────

interface SimCtx {
  simTime: number;
  potted: SimEvents["potted"];
  firstContactBallId: number | null;
  railContact: boolean;
  cueScratched: boolean;
  /** Potted balls awaiting inclusion in their first post-capture sampled
   * frame (see `maybeEmitFrame` / spec: "include potted balls through their
   * capture frame"). */
  pendingPotForFrame: Array<{ id: number; x: number; y: number; frameIdx: number }>;
  /** Last position at which each ball was actually emitted into a frame —
   * seeded with starting positions so the first frame's "did it move" check
   * is relative to the shot's initial layout. */
  lastEmitted: Map<number, { x: number; y: number }>;
  frames: SimFrame[];
}

type Event =
  | { kind: "ball"; t: number; a: number; b: number }
  | { kind: "rail"; t: number; id: number; rail: Rail }
  | { kind: "pocket"; t: number; id: number; pocketId: PocketId };

// ── outer-step / CCD substep loop ────────────────────────────────────────────

function runOuterStep(active: Map<number, SimBall>, dt: number, ctx: SimCtx): void {
  let remaining = dt;
  let iterations = 0;
  while (remaining > MIN_EVENT_T && iterations < MAX_EVENTS_PER_STEP) {
    iterations++;
    const ev = findEarliestEvent(active);
    if (!ev || ev.t > remaining) {
      advanceAll(active, remaining);
      ctx.simTime += remaining;
      remaining = 0;
      forceCaptureOutOfBounds(active, ctx);
      break;
    }
    advanceAll(active, ev.t);
    ctx.simTime += ev.t;
    remaining -= ev.t;
    forceCaptureOutOfBounds(active, ctx);
    resolveEvent(ev, active, ctx);
  }
  if (iterations >= MAX_EVENTS_PER_STEP) {
    // Safety valve (see MAX_EVENTS_PER_STEP doc): halt everything rather
    // than risk hanging on a thrashing pair. Not "the offending ball"
    // specifically — zeroing every active ball is a strictly safer
    // superset and this path is unreachable in the fuzz suite.
    for (const ball of active.values()) {
      ball.vx = 0;
      ball.vy = 0;
    }
  }
}

function advanceAll(active: Map<number, SimBall>, t: number): void {
  if (t <= 0) return;
  for (const ball of active.values()) {
    ball.x += ball.vx * t;
    ball.y += ball.vy * t;
  }
}

function anyMoving(active: Map<number, SimBall>): boolean {
  for (const ball of active.values()) if (ball.vx !== 0 || ball.vy !== 0) return true;
  return false;
}

function applyFriction(active: Map<number, SimBall>): void {
  for (const ball of active.values()) {
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed === 0) continue;
    const decayed = Math.max(0, speed - FRICTION_DECEL * DT);
    if (decayed < STOP_SPEED) {
      ball.vx = 0;
      ball.vy = 0;
    } else {
      const s = decayed / speed;
      ball.vx *= s;
      ball.vy *= s;
    }
  }
}

// ── event search ──────────────────────────────────────────────────────────────

function findEarliestEvent(active: Map<number, SimBall>): Event | null {
  const ids = [...active.keys()].sort((x, y) => x - y);
  let best: Event | null = null;
  const consider = (candidate: Event | null): void => {
    if (!candidate) return;
    if (!best || candidate.t < best.t - MIN_EVENT_T) best = candidate;
  };

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      consider(ballCollisionTime(active.get(ids[i]!)!, active.get(ids[j]!)!));
    }
  }
  for (const id of ids) {
    const ball = active.get(id)!;
    for (const rail of RAIL_ORDER) consider(railCrossingTime(ball, rail));
  }
  for (const id of ids) {
    const ball = active.get(id)!;
    for (const pid of POCKET_IDS) consider(pocketCaptureTime(ball, pid));
  }
  return best;
}

/** Earliest t>=0 at which two circles' centers reach distance 2*BALL_R,
 * solved analytically on their relative motion. Returns null if they never
 * meet (parallel/diverging motion) or are already separated at t=0 by more
 * than 2*BALL_R with no future convergence root. */
function ballCollisionTime(a: SimBall, b: SimBall): Event | null {
  const p = sub(b, a); // relative position, B from A
  const v = { x: b.vx - a.vx, y: b.vy - a.vy }; // relative velocity, B from A
  const aCoef = v.x * v.x + v.y * v.y;
  if (aCoef < MIN_REL_SPEED_SQ) return null;
  const sumR = 2 * BALL_R;
  const cCoef = p.x * p.x + p.y * p.y - sumR * sumR;
  const bCoef = 2 * (p.x * v.x + p.y * v.y);
  if (cCoef <= 0) {
    // Already at/inside contact distance. This is the normal state of a fresh
    // triangle rack (every neighbor pair starts at exactly 2*BALL_R), not just
    // post-collision noise — so a touching pair that is CLOSING must collide
    // immediately, or the break would slide balls through their neighbors and
    // leave overlapping finals. A touching pair that isn't closing (resting
    // rack, or separating after a resolved contact + nudge) has no event.
    if (bCoef < -MIN_EVENT_T) return { kind: "ball", t: MIN_EVENT_T, a: a.id, b: b.id };
    return null;
  }
  const disc = bCoef * bCoef - 4 * aCoef * cCoef;
  if (disc < 0) return null;
  const t = (-bCoef - Math.sqrt(disc)) / (2 * aCoef);
  if (t < MIN_EVENT_T) return null;
  return { kind: "ball", t, a: a.id, b: b.id };
}

/** Earliest t>=0 at which `ball`'s center crosses the inset cushion line for
 * `rail`, moving toward it — or null if it's moving away/parallel, or the
 * crossing point falls inside a pocket's mouth region (no cushion there). */
function railCrossingTime(ball: SimBall, rail: Rail): Event | null {
  let t: number;
  let horizontal: boolean;
  switch (rail) {
    case "top":
      if (ball.vy >= -MIN_EVENT_T) return null;
      t = (BALL_R - ball.y) / ball.vy;
      horizontal = true;
      break;
    case "bottom":
      if (ball.vy <= MIN_EVENT_T) return null;
      t = (TABLE_HEIGHT - BALL_R - ball.y) / ball.vy;
      horizontal = true;
      break;
    case "left":
      if (ball.vx >= -MIN_EVENT_T) return null;
      t = (BALL_R - ball.x) / ball.vx;
      horizontal = false;
      break;
    case "right":
      if (ball.vx <= MIN_EVENT_T) return null;
      t = (TABLE_WIDTH - BALL_R - ball.x) / ball.vx;
      horizontal = false;
      break;
  }
  if (t < MIN_EVENT_T) return null;
  const alongCoord = horizontal ? ball.x + ball.vx * t : ball.y + ball.vy * t;
  for (const pid of POCKETS_ON_RAIL[rail]) {
    const pocketAlong = horizontal ? POCKETS[pid].pos.x : POCKETS[pid].pos.y;
    if (Math.abs(alongCoord - pocketAlong) < MOUTH_HALF) {
      // Crossing inside this pocket's mouth. Only pocket-BOUND balls may pass
      // the cushion line here; a ball that would merely graze the jaws (its
      // path never enters the capture radius, or friction stops it short)
      // reflects off the jaw like a normal cushion instead. Without this, a
      // grazing ball wanders the strip between the cushion line and the true
      // table edge and can come to rest visually embedded in the rail —
      // MOUTH_HALF (3.2) is wider than any captureRadius (2.0/2.2), so that
      // dead zone is reachable at shallow approach angles.
      if (willReachPocket(ball, pid)) return null;
      return { kind: "rail", t, id: ball.id, rail };
    }
  }
  return { kind: "rail", t, id: ball.id, rail };
}

/** True if `ball`'s straight-line path (friction is colinear, so the path IS
 * a straight line) enters `pocketId`'s capture radius before friction stops
 * it. Used to decide pass-through vs jaw-reflection at a pocket mouth. */
function willReachPocket(ball: SimBall, pocketId: PocketId): boolean {
  const capture = pocketCaptureTime(ball, pocketId);
  if (!capture) return false;
  const speed = Math.hypot(ball.vx, ball.vy);
  const captureDist = speed * capture.t;
  // Continuous-friction stopping distance; the per-step discrete decay only
  // differs from this by a hair, and the stopped-in-jaws capture net in
  // simulateShot covers any ball that stops just short anyway.
  const stopDist = (speed * speed - STOP_SPEED * STOP_SPEED) / (2 * FRICTION_DECEL);
  return captureDist <= stopDist;
}

/** Earliest t>=0 at which `ball`'s center enters `pocketId`'s capture
 * radius, solved analytically. Null if the ball never reaches it (moving
 * away, stationary, or already captured — which shouldn't reach here since
 * capture removes the ball from `active` immediately). */
function pocketCaptureTime(ball: SimBall, pocketId: PocketId): Event | null {
  const pocket = POCKETS[pocketId];
  const d = { x: ball.x - pocket.pos.x, y: ball.y - pocket.pos.y }; // ball relative to pocket
  const v = { x: ball.vx, y: ball.vy };
  const aCoef = v.x * v.x + v.y * v.y;
  if (aCoef < MIN_REL_SPEED_SQ) return null;
  const cCoef = d.x * d.x + d.y * d.y - pocket.captureRadius * pocket.captureRadius;
  if (cCoef <= 0) return null;
  const bCoef = 2 * (d.x * v.x + d.y * v.y);
  const disc = bCoef * bCoef - 4 * aCoef * cCoef;
  if (disc < 0) return null;
  const t = (-bCoef - Math.sqrt(disc)) / (2 * aCoef);
  if (t < MIN_EVENT_T) return null;
  return { kind: "pocket", t, id: ball.id, pocketId };
}

// ── event resolution ──────────────────────────────────────────────────────────

function resolveEvent(ev: Event, active: Map<number, SimBall>, ctx: SimCtx): void {
  if (ev.kind === "ball") resolveBallCollision(ev.a, ev.b, active, ctx);
  else if (ev.kind === "rail") resolveRailReflection(ev.id, ev.rail, active, ctx);
  else capturePot(ev.id, ev.pocketId, ctx.simTime, active, ctx);
}

/** Equal-mass elastic impulse along the center-line normal, scaled by
 * BALL_RESTITUTION; tangential components are untouched (no spin/throw
 * modeling — documented non-goal). Positions are nudged apart afterward so
 * the next CCD search doesn't immediately re-detect this contact. */
function resolveBallCollision(idA: number, idB: number, active: Map<number, SimBall>, ctx: SimCtx): void {
  const a = active.get(idA)!;
  const b = active.get(idB)!;
  const n = unit(sub(b, a));
  const relVel = { x: b.vx - a.vx, y: b.vy - a.vy };
  const vn = dot(relVel, n);
  if (vn < 0) {
    const j = (-(1 + BALL_RESTITUTION) * vn) / 2; // equal unit masses
    a.vx -= j * n.x;
    a.vy -= j * n.y;
    b.vx += j * n.x;
    b.vy += j * n.y;
  }
  a.x -= n.x * COLLISION_NUDGE;
  a.y -= n.y * COLLISION_NUDGE;
  b.x += n.x * COLLISION_NUDGE;
  b.y += n.y * COLLISION_NUDGE;

  if (idA === CUE_ID || idB === CUE_ID) {
    const other = idA === CUE_ID ? idB : idA;
    if (ctx.firstContactBallId === null) ctx.firstContactBallId = other;
  }
}

/** Reflects the cushion-normal velocity component with RAIL_RESTITUTION,
 * tangential unchanged, and nudges the ball back inside the inset line. */
function resolveRailReflection(id: number, rail: Rail, active: Map<number, SimBall>, ctx: SimCtx): void {
  const ball = active.get(id)!;
  switch (rail) {
    case "top":
      ball.vy = -RAIL_RESTITUTION * ball.vy;
      ball.y = BALL_R + COLLISION_NUDGE;
      break;
    case "bottom":
      ball.vy = -RAIL_RESTITUTION * ball.vy;
      ball.y = TABLE_HEIGHT - BALL_R - COLLISION_NUDGE;
      break;
    case "left":
      ball.vx = -RAIL_RESTITUTION * ball.vx;
      ball.x = BALL_R + COLLISION_NUDGE;
      break;
    case "right":
      ball.vx = -RAIL_RESTITUTION * ball.vx;
      ball.x = TABLE_WIDTH - BALL_R - COLLISION_NUDGE;
      break;
  }
  if (ctx.firstContactBallId !== null) ctx.railContact = true;
}

/** Removes a ball from the sim at capture (normal pocket entry, or the
 * mouth-escape safety net), records the pot event, and schedules it to
 * appear in its first post-capture sampled frame. */
function capturePot(ballId: number, pocketId: PocketId, t: number, active: Map<number, SimBall>, ctx: SimCtx): void {
  const ball = active.get(ballId);
  if (!ball) return; // already removed (defensive; shouldn't occur)
  ctx.potted.push({ ballId, pocketId, t });
  const frameIdx = Math.max(1, Math.ceil(t / FRAME_DT - MIN_EVENT_T));
  ctx.pendingPotForFrame.push({ id: ballId, x: ball.x, y: ball.y, frameIdx });
  if (ballId === CUE_ID) ctx.cueScratched = true;
  active.delete(ballId);
  ctx.lastEmitted.delete(ballId);
}

/**
 * Mouth-escape safety net (spec § Pockets): a ball that crosses a cushion
 * line inside a pocket's mouth region without being captured by the normal
 * pocket-capture event will, if it keeps going, eventually cross the TRUE
 * table edge (center x/y outside [0,W]/[0,H]) — which is exactly "more than
 * BALL_R past the cushion line" (the cushion line sits BALL_R inside the
 * true edge). Force-capture into the nearest pocket the instant that
 * happens, so a ball can never physically escape the table.
 */
function forceCaptureOutOfBounds(active: Map<number, SimBall>, ctx: SimCtx): void {
  for (const ball of [...active.values()]) {
    if (ball.x < 0 || ball.x > TABLE_WIDTH || ball.y < 0 || ball.y > TABLE_HEIGHT) {
      capturePot(ball.id, nearestPocketTo(ball), ctx.simTime, active, ctx);
    }
  }
}

function nearestPocketTo(ball: SimBall): PocketId {
  let bestId: PocketId = "NW";
  let bestD = Infinity;
  for (const pid of POCKET_IDS) {
    const d = distance(ball, POCKETS[pid].pos);
    if (d < bestD) {
      bestD = d;
      bestId = pid;
    }
  }
  return bestId;
}

/**
 * Capture net for balls that come to rest INSIDE a pocket's jaws — i.e.
 * stopped with their center beyond a cushion line (only reachable through a
 * mouth region, since cushions reflect everywhere else). Physically the ball
 * is hanging in the pocket opening; treat it as falling in. With the
 * jaw-reflection check in railCrossingTime this is nearly unreachable (a
 * ball only passes the line when its path reaches the capture radius), but
 * discrete per-step friction can stop a slow roller a hair short, and a
 * mid-mouth collision can strand one — either way it must not rest embedded
 * in the rail.
 */
function captureStoppedJawBalls(active: Map<number, SimBall>, ctx: SimCtx): void {
  // Tolerance well above COLLISION_NUDGE (1e-6): a ball legitimately resting
  // AGAINST a cushion sits at exactly BALL_R±nudge from the edge and must not
  // be swallowed; a genuinely jaw-stranded ball is far deeper than 1e-3.
  const eps = 1e-3;
  for (const ball of [...active.values()]) {
    if (ball.vx !== 0 || ball.vy !== 0) continue;
    if (
      ball.x < BALL_R - eps ||
      ball.x > TABLE_WIDTH - BALL_R + eps ||
      ball.y < BALL_R - eps ||
      ball.y > TABLE_HEIGHT - BALL_R + eps
    ) {
      capturePot(ball.id, nearestPocketTo(ball), ctx.simTime, active, ctx);
    }
  }
}

// ── frame sampling ────────────────────────────────────────────────────────────

function round2(n: number): number {
  const r = Math.round(n * 100) / 100;
  return r === 0 ? 0 : r; // normalize -0 so JSON/deepStrictEqual comparisons are stable
}

function maybeEmitFrame(active: Map<number, SimBall>, ctx: SimCtx, stepCount: number): void {
  if (stepCount % FRAME_STEP_INTERVAL !== 0) return;
  const frameIdx = stepCount / FRAME_STEP_INTERVAL;
  const frameT = round2(frameIdx * FRAME_DT);
  const ballsOut: Array<{ id: number; x: number; y: number }> = [];
  for (const ball of active.values()) {
    const last = ctx.lastEmitted.get(ball.id);
    if (!last || Math.hypot(ball.x - last.x, ball.y - last.y) > FRAME_MOVE_EPS) {
      ballsOut.push({ id: ball.id, x: round2(ball.x), y: round2(ball.y) });
      ctx.lastEmitted.set(ball.id, { x: ball.x, y: ball.y });
    }
  }
  for (let i = ctx.pendingPotForFrame.length - 1; i >= 0; i--) {
    const p = ctx.pendingPotForFrame[i]!;
    if (p.frameIdx === frameIdx) {
      ballsOut.push({ id: p.id, x: round2(p.x), y: round2(p.y) });
      ctx.pendingPotForFrame.splice(i, 1);
    }
  }
  if (ballsOut.length > 0) {
    ballsOut.sort((x, y) => x.id - y.id);
    ctx.frames.push({ t: frameT, balls: ballsOut });
  }
}
