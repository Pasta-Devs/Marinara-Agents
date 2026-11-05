// ──────────────────────────────────────────────
// Otome Forge: the Claw Machine's rules and physics (plan M5 "Claw Machine"). Pure, and deterministic for a seed.
// ──────────────────────────────────────────────
// A round is a value: createRound lays the seven prizes out from the seed, and every random draw after that (the
// partner's aim, each grip roll, a prize nudged aside) is the next number of one mulberry32 stream, counted in
// `round.draws`. The same seed and the same drop positions always give the same round, whatever the frame rate.
//
// Positions run 0 (left wall) … 1 (right wall) across the glass. The chute is on the left: the claw rests above it and
// carries every catch back to it. The claw hangs from a gantry on a cable, so moving it makes it sway: it lands where
// its tip is (gantry + sway) when it drops. A freeze cheat slows that swing; reduced motion turns it off.
//
// Grip: clamp(0.85 − |offset|·8 − weight·0.1), and nothing at all beyond the claw's reach. Turns alternate, six drops.
// On the partner's turns the player can cheer; the eighth cheer sets off his cheat (bible.play.cheat), once a round:
//   steady     his grip this turn is certain
//   nudge      the prize nearest the chute tumbles in
//   extra      the player gets a bonus drop, next
//   freeze     the player's next swing is slowed (and her timer runs longer)
//   calculate  the player's next drop shows where it will land
// A freeze or calculate with no turn of hers left adds one, so no cheat is wasted. A round catches at most seven.
import type { ClawCheat } from "../shared/api-types";
import {
  CHEER_GOAL,
  LI_PLUSH_WEIGHT,
  PLUSH_WEIGHT,
  clawPrizeIds,
  isPlushSeries,
  liPlushId,
  type ClawCatch,
  type ClawPlayer,
} from "../shared/claw";

/** mulberry32: a small, fast, seeded generator of numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Numbers `from` … `from + count − 1` of the seed's stream. */
function draws(seed: number, from: number, count: number): number[] {
  const next = mulberry32(seed);
  for (let index = 0; index < from; index += 1) next();
  return Array.from({ length: count }, next);
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const GEOMETRY = {
  /** The chute's opening. */
  chute: { from: 0.02, to: 0.2 },
  /** Where the claw rests between drops, over the chute. */
  home: 0.11,
  rail: { min: 0.06, max: 0.95 },
  /** Where the prizes lie. */
  pile: { from: 0.31, to: 0.92 },
  /** How far from a prize's centre the claw still closes on it. */
  reach: 0.085,
} as const;

export const GRIP = { base: 0.85, perOffset: 8, perWeight: 0.1 } as const;

/** The chance the claw holds a prize `offset` from its centre: 0 beyond its reach. */
export function gripChance(offset: number, weight: number): number {
  if (!Number.isFinite(offset) || Math.abs(offset) > GEOMETRY.reach) return 0;
  return clamp(GRIP.base - Math.abs(offset) * GRIP.perOffset - weight * GRIP.perWeight, 0, 1);
}

export function prizeWeight(id: string): number {
  return isPlushSeries(id) ? PLUSH_WEIGHT[id] : LI_PLUSH_WEIGHT;
}

export interface Prize {
  id: string;
  x: number;
  weight: number;
  /** Back (0) or front (1) of the pile. */
  row: 0 | 1;
  /** How it lies, in degrees. */
  tilt: number;
}

/** The prize the claw closes on when it lands at `x`: the nearest within reach, or null. */
export function targetAt(prizes: readonly Prize[], x: number): Prize | null {
  let best: Prize | null = null;
  for (const prize of prizes) {
    const distance = Math.abs(prize.x - x);
    if (distance <= GEOMETRY.reach && (!best || distance < Math.abs(best.x - x))) best = prize;
  }
  return best;
}

// ── The claw on its cable ──

/** The gantry (x, velocity, where it is heading) and the claw's sway under it. */
export interface ClawBody {
  x: number;
  v: number;
  target: number;
  sway: number;
  swayV: number;
  /** Time not yet stepped, in seconds (less than one step): carried to the next frame. */
  rest: number;
}

export const BODY = {
  /** Fixed physics step, in seconds. */
  step: 1 / 120,
  /** The most steps one call takes, so a stalled tab never jumps the claw (the time beyond them is dropped). */
  maxSteps: 30,
  /** Top speed and acceleration of the gantry, in glass widths per second (squared). */
  speed: 0.5,
  accel: 6,
  /** How hard the gantry chases its target. */
  follow: 30,
  /** How far a step of the move buttons (or an arrow key's press) moves the target. */
  nudge: 0.04,
  /** How far the target may run ahead of a held gantry. */
  lead: 0.02,
  swing: { hz: 0.85, damping: 0.07, coupling: 0.45 },
  /** A freeze cheat's swing: slower, settling sooner, and moving more gently. */
  slowed: { hz: 0.42, damping: 0.3, coupling: 0.1, speed: 0.6 },
} as const;

export const restingBody = (x: number = GEOMETRY.home): ClawBody => ({
  x,
  v: 0,
  target: x,
  sway: 0,
  swayV: 0,
  rest: 0,
});

export interface StepOptions {
  /** A freeze cheat is on: the slowed swing. */
  slowed?: boolean;
  /** Reduced motion: the claw hangs straight. */
  still?: boolean;
  /** The partner's own pace (STYLE_PLAY speed). */
  pace?: number;
}

/**
 * The body `dt` seconds on, in fixed steps of BODY.step. The time short of a whole step is carried in `rest` to the
 * next call, so the claw moves and swings the same at any frame rate (60, 90, 144 or 360 Hz); at most BODY.maxSteps a
 * call, so a stalled tab never jumps the claw.
 */
export function stepBody(body: ClawBody, dt: number, options: StepOptions = {}): ClawBody {
  let { x, v, sway, swayV } = body;
  const swing = options.slowed ? BODY.slowed : BODY.swing;
  const speed = BODY.speed * (options.slowed ? BODY.slowed.speed : 1) * (options.pace ?? 1);
  const target = clamp(body.target, GEOMETRY.rail.min, GEOMETRY.rail.max);
  const omega = 2 * Math.PI * swing.hz;
  const time = (Number.isFinite(body.rest) ? body.rest : 0) + Math.max(0, Number.isFinite(dt) ? dt : 0);
  // The tiny allowance keeps a sum of frames that lands on a whole step (float rounding) from losing it.
  const whole = Math.floor(time / BODY.step + 1e-6);
  const steps = Math.min(BODY.maxSteps, whole);
  const rest = whole > BODY.maxSteps ? 0 : Math.max(0, time - whole * BODY.step);
  for (let index = 0; index < steps; index += 1) {
    const desired = clamp((target - x) * BODY.follow, -speed, speed);
    const a = clamp((desired - v) / BODY.step, -BODY.accel, BODY.accel);
    v += a * BODY.step;
    x = clamp(x + v * BODY.step, GEOMETRY.rail.min, GEOMETRY.rail.max);
    if ((x === GEOMETRY.rail.min && v < 0) || (x === GEOMETRY.rail.max && v > 0)) v = 0;
    if (options.still) {
      sway = 0;
      swayV = 0;
      continue;
    }
    swayV += (-omega * omega * sway - 2 * swing.damping * omega * swayV - swing.coupling * a) * BODY.step;
    sway += swayV * BODY.step;
  }
  return { x, v, target, sway, swayV, rest };
}

/** Holding a move control: the target runs ahead of the gantry in `direction`, at most BODY.lead ahead. */
export function steerBody(body: ClawBody, direction: -1 | 0 | 1, dt: number, options: StepOptions = {}): ClawBody {
  if (!direction) return body;
  const speed = BODY.speed * (options.slowed ? BODY.slowed.speed : 1);
  const target = clamp(body.target + direction * speed * dt, body.x - BODY.lead, body.x + BODY.lead);
  return { ...body, target: clamp(target, GEOMETRY.rail.min, GEOMETRY.rail.max) };
}

/** One press of a move control: the target steps over. */
export function nudgeBody(body: ClawBody, direction: -1 | 1): ClawBody {
  const target = clamp(body.target + direction * BODY.nudge, GEOMETRY.rail.min, GEOMETRY.rail.max);
  return { ...body, target };
}

/** Where the claw would land if it dropped now: its tip, the gantry plus the sway. */
export const landingX = (body: Pick<ClawBody, "x" | "sway">) => clamp(body.x + body.sway, 0, 1);

// ── How the partner plays (bible.play.style) ──

export const CLAW_STYLES = ["careful", "clinical", "showy", "reckless"] as const;
export type ClawStyle = (typeof CLAW_STYLES)[number];

// English words a bible's one-sentence style is likely to use; a style that matches none (or another language) gets a
// stable style from its text, so each love interest always plays the same way.
const STYLE_WORDS: Record<ClawStyle, RegExp> = {
  careful: /careful|patien|cautious|slow|gentle|deliberat|lines? (?:it|them|up)|takes? (?:his|her|their) time|wait/giu,
  clinical: /calculat|clinical|analy|angle|physics|measur|precis|exact|logic|method|geometr|strateg|math|odds/giu,
  showy: /show|flourish|drama|flash|swagger|perform|theatric|grand|cock|confiden|flair|style|wink|audience|spin/giu,
  reckless: /reckless|impatien|wild|bold|fast|chao|slam|smash|rush|impulsiv|aggress|brute|yank|bang|hurr|frantic/giu,
};

/** The partner's play style from bible.play.style. */
export function clawStyleOf(text: string): ClawStyle {
  let best: ClawStyle | null = null;
  let bestCount = 0;
  for (const style of CLAW_STYLES) {
    const count = text.match(STYLE_WORDS[style])?.length ?? 0;
    if (count > bestCount) {
      best = style;
      bestCount = count;
    }
  }
  if (best) return best;
  let hash = 0;
  for (const char of text.trim().toLocaleLowerCase()) hash = (Math.imul(hash, 31) + (char.codePointAt(0) ?? 0)) >>> 0;
  return CLAW_STYLES[hash % CLAW_STYLES.length]!;
}

/** Each style's hand: aim error (σ), pause to let the swing settle, thinking time, pace, and a showy overshoot. */
export const STYLE_PLAY: Readonly<
  Record<ClawStyle, { aim: number; settleMs: number; thinkMs: number; pace: number; overshoot: number }>
> = {
  careful: { aim: 0.028, settleMs: 1300, thinkMs: 900, pace: 0.7, overshoot: 0 },
  clinical: { aim: 0.012, settleMs: 900, thinkMs: 1300, pace: 0.85, overshoot: 0 },
  showy: { aim: 0.036, settleMs: 450, thinkMs: 500, pace: 1.25, overshoot: 0.09 },
  reckless: { aim: 0.06, settleMs: 0, thinkMs: 250, pace: 1.5, overshoot: 0 },
};

// ── A round ──

export interface ClawRoundState {
  seed: number;
  /** His plush (`li:<li>`). */
  partner: string;
  cheat: ClawCheat;
  style: ClawStyle;
  first: ClawPlayer;
  /** Who takes each drop, in order (a cheat may add one of hers). */
  turns: ClawPlayer[];
  /** The drop being played; the round is over at turns.length, or when the machine is empty. */
  turn: number;
  /** The prizes still in the machine. */
  prizes: Prize[];
  caught: ClawCatch[];
  cheers: number;
  /** His cheat went off this round. */
  cheated: boolean;
  /** The index in `turns` of the drop a cheat added (hers), or null. */
  bonusAt: number | null;
  /** What a cheat left waiting: a certain grip on his drop; a slowed swing and the landing guide on her next. */
  effects: { guaranteed: boolean; slowed: boolean; guide: boolean };
  /** How many numbers of the seed's stream are spent. */
  draws: number;
}

export interface NewRound {
  seed: number;
  first: ClawPlayer;
  li: string;
  cheat: ClawCheat;
  style: ClawStyle;
}

export const turnOrder = (first: ClawPlayer, drops = 6): ClawPlayer[] =>
  Array.from({ length: drops }, (_, index) => ((index % 2 === 0) === (first === "me") ? "me" : "partner"));

/** The machine for a seed: the seven prizes shuffled into the pile, alternately at the back and the front. */
export function createRound({ seed, first, li, cheat, style }: NewRound): ClawRoundState {
  const ids = clawPrizeIds(li);
  const count = ids.length;
  // Shuffle (count − 1 draws), then a jitter and a tilt for each prize (2 × count draws).
  const numbers = draws(seed, 0, count - 1 + 2 * count);
  const order = [...ids];
  for (let index = count - 1; index > 0; index -= 1) {
    const pick = Math.floor(numbers[count - 1 - index]! * (index + 1));
    [order[index], order[pick]] = [order[pick]!, order[index]!];
  }
  const span = GEOMETRY.pile.to - GEOMETRY.pile.from;
  const prizes = order.map((id, index): Prize => {
    const jitter = (numbers[count - 1 + 2 * index]! - 0.5) * 0.03;
    return {
      id,
      x: clamp(GEOMETRY.pile.from + (index * span) / (count - 1) + jitter, GEOMETRY.pile.from, GEOMETRY.pile.to),
      weight: prizeWeight(id),
      row: index % 2 === 0 ? 0 : 1,
      tilt: Math.round((numbers[count + 2 * index]! - 0.5) * 24),
    };
  });
  return {
    seed: seed >>> 0,
    partner: liPlushId(li),
    cheat,
    style,
    first,
    turns: turnOrder(first),
    turn: 0,
    prizes,
    caught: [],
    cheers: 0,
    cheated: false,
    bonusAt: null,
    effects: { guaranteed: false, slowed: false, guide: false },
    draws: count - 1 + 2 * count,
  };
}

export const isRoundOver = (round: ClawRoundState) => round.turn >= round.turns.length || round.prizes.length === 0;

/** Who plays the current drop; null once the round is over. */
export const currentPlayer = (round: ClawRoundState): ClawPlayer | null =>
  isRoundOver(round) ? null : round.turns[round.turn]!;

/** Drop `index` is the one a cheat added (her bonus drop), wherever in the round it was put. */
export const isBonusTurn = (round: Pick<ClawRoundState, "bonusAt">, index: number) => round.bonusAt === index;

/** Her next drop is still to come after the current one; otherwise a freeze or calculate adds one. */
function withHerNextTurn(round: ClawRoundState): ClawRoundState {
  if (round.turns.slice(round.turn + 1).includes("me")) return round;
  return { ...round, turns: [...round.turns, "me"], bonusAt: round.turns.length };
}

/** His cheat, set off now (by the eighth cheer). `nudged` is the prize a nudge tipped into the chute. */
export function fireCheat(round: ClawRoundState): { round: ClawRoundState; nudged: Prize | null } {
  const next: ClawRoundState = { ...round, cheated: true, effects: { ...round.effects } };
  switch (round.cheat) {
    case "steady":
      next.effects.guaranteed = true;
      return { round: next, nudged: null };
    case "nudge": {
      const nudged = [...round.prizes].sort((a, b) => a.x - b.x)[0] ?? null;
      if (!nudged) return { round: next, nudged: null };
      return {
        round: {
          ...next,
          prizes: round.prizes.filter((prize) => prize.id !== nudged.id),
          caught: [...round.caught, { prize: nudged.id, by: "partner" }],
        },
        nudged,
      };
    }
    case "extra": {
      const turns = [...round.turns];
      turns.splice(round.turn + 1, 0, "me");
      return { round: { ...next, turns, bonusAt: round.turn + 1 }, nudged: null };
    }
    case "freeze":
      next.effects.slowed = true;
      return { round: withHerNextTurn(next), nudged: null };
    case "calculate":
      next.effects.guide = true;
      return { round: withHerNextTurn(next), nudged: null };
  }
}

/**
 * One cheer. Only the partner's turn counts, and only until his cheat has gone off; the CHEER_GOAL-th sets it off.
 * `fired` is the cheat that went off with this cheer.
 */
export function cheer(round: ClawRoundState): { round: ClawRoundState; fired: ClawCheat | null; nudged: Prize | null } {
  if (currentPlayer(round) !== "partner" || round.cheated) return { round, fired: null, nudged: null };
  const cheers = Math.min(CHEER_GOAL, round.cheers + 1);
  const counted = { ...round, cheers };
  if (cheers < CHEER_GOAL) return { round: counted, fired: null, nudged: null };
  const { round: cheated, nudged } = fireCheat(counted);
  return { round: cheated, fired: round.cheat, nudged };
}

/** How a drop that does not catch goes: closing on air, grazing past, slipping on the way up, or off the chute's rim. */
export type DropFail = "air" | "graze" | "slip" | "rim";

export interface DropOutcome {
  player: ClawPlayer;
  /** Where the claw landed. */
  x: number;
  target: Prize | null;
  chance: number;
  caught: boolean;
  fail: DropFail | null;
  /** Where a prize the claw failed to hold ended up. */
  movedTo: number | null;
}

/** Draws each drop spends, whatever happens, so later drops never depend on how an earlier one went. */
const DROP_DRAWS = 3;

/** The current drop, landing at `x`: the grip roll, the catch or the miss, and the next turn. */
export function landDrop(round: ClawRoundState, x: number): { round: ClawRoundState; outcome: DropOutcome } {
  const player = currentPlayer(round) ?? "me";
  const [grip, flavor, shift] = draws(round.seed, round.draws, DROP_DRAWS) as [number, number, number];
  const guaranteed = player === "partner" && round.effects.guaranteed;
  const landing = clamp(x, 0, 1);
  // A steadied claw is guided onto the nearest prize by hand.
  const target =
    targetAt(round.prizes, landing) ??
    (guaranteed
      ? ([...round.prizes].sort((a, b) => Math.abs(a.x - landing) - Math.abs(b.x - landing))[0] ?? null)
      : null);
  const chance = !target ? 0 : guaranteed ? 1 : gripChance(landing - target.x, target.weight);
  const caught = !!target && grip < chance;
  const fail: DropFail | null = caught
    ? null
    : !target
      ? "air"
      : chance < 0.25
        ? "graze"
        : flavor < 0.5
          ? "slip"
          : "rim";
  // A prize the claw let go lands somewhere new: pushed aside by a graze, dropped near where it was by a slip, or at
  // the near edge of the pile after bouncing off the chute's rim (an easier one next time).
  const movedTo =
    !target || caught
      ? null
      : clamp(
          fail === "rim"
            ? GEOMETRY.pile.from + shift * 0.04
            : target.x + (shift - 0.5) * (fail === "graze" ? 0.05 : 0.08),
          GEOMETRY.pile.from - 0.02,
          GEOMETRY.pile.to + 0.02,
        );
  const prizes = caught
    ? round.prizes.filter((prize) => prize.id !== target!.id)
    : movedTo !== null
      ? round.prizes.map((prize) => (prize.id === target!.id ? { ...prize, x: movedTo } : prize))
      : round.prizes;
  const effects =
    player === "me" ? { ...round.effects, slowed: false, guide: false } : { ...round.effects, guaranteed: false };
  return {
    round: {
      ...round,
      prizes,
      caught: caught ? [...round.caught, { prize: target!.id, by: player }] : round.caught,
      effects,
      turn: round.turn + 1,
      draws: round.draws + DROP_DRAWS,
    },
    outcome: { player, x: landing, target, chance, caught, fail, movedTo },
  };
}

/** How the partner takes his drop: where he aims (with his style's error), and how he gets there. */
export interface PartnerPlan {
  target: Prize;
  /** Where his claw will land. */
  aimX: number;
  /** A showy pass beyond the aim before coming back. */
  overshoot: number;
  thinkMs: number;
  settleMs: number;
  pace: number;
}

const PLAN_DRAWS = 3;

/** His plan for the current drop, by his style. Spends PLAN_DRAWS numbers of the stream; null with no prizes left. */
export function planPartnerTurn(round: ClawRoundState): { round: ClawRoundState; plan: PartnerPlan | null } {
  const [choice, u1, u2] = draws(round.seed, round.draws, PLAN_DRAWS) as [number, number, number];
  const spent = { ...round, draws: round.draws + PLAN_DRAWS };
  if (!round.prizes.length) return { round: spent, plan: null };
  const play = STYLE_PLAY[round.style];
  const byChance = [...round.prizes].sort((a, b) => a.weight - b.weight || a.x - b.x);
  const target =
    round.style === "reckless"
      ? round.prizes[Math.min(round.prizes.length - 1, Math.floor(choice * round.prizes.length))]!
      : round.style === "showy"
        ? (round.prizes.find((prize) => prize.id === round.partner) ?? byChance.at(-1)!)
        : byChance[0]!;
  // Box–Muller: one normal number from two uniform ones.
  const normal = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-9))) * Math.cos(2 * Math.PI * u2);
  const aimX = clamp(target.x + normal * play.aim, GEOMETRY.rail.min, GEOMETRY.rail.max);
  return {
    round: spent,
    plan: {
      target,
      aimX,
      overshoot: play.overshoot * (aimX > GEOMETRY.home ? 1 : -1),
      thinkMs: play.thinkMs,
      settleMs: play.settleMs,
      pace: play.pace,
    },
  };
}

/**
 * His plan after a nudge cheat tipped `nudged` into the chute: one aimed at that prize follows to the nearest prize
 * left, keeping the aim error he had rolled (so it spends no draws). Any other plan, or one with no prize left, stands.
 */
export function retargetPlan(plan: PartnerPlan, nudged: Prize, prizes: readonly Prize[]): PartnerPlan {
  if (plan.target.id !== nudged.id) return plan;
  let target: Prize | null = null;
  for (const prize of prizes) {
    if (!target || Math.abs(prize.x - nudged.x) < Math.abs(target.x - nudged.x)) target = prize;
  }
  if (!target) return plan;
  const aimX = clamp(target.x + (plan.aimX - nudged.x), GEOMETRY.rail.min, GEOMETRY.rail.max);
  return { ...plan, target, aimX, overshoot: Math.abs(plan.overshoot) * (aimX > GEOMETRY.home ? 1 : -1) };
}
