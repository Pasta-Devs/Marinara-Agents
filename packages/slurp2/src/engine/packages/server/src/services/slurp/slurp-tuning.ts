/**
 * Simulation Tuning: every number the audience simulation runs on, in one stored object.
 *
 * Pure, like the other Slurp rule modules. The rules take their slice of this as an optional
 * argument that defaults to `realistic`, so a caller that passes nothing behaves exactly as the
 * constants did before tuning existed.
 *
 * Every number is clamped to its range rather than rejected, so an out-of-range import or a hand
 * edit lands on the nearest legal value instead of throwing the whole object away. A few ranges
 * are held by hard code ceilings that no setting can raise, because they bound how much one tick
 * may write.
 */
import { z } from "zod";
import { SLURP_AUDIENCE_TONE_INSTRUCTIONS } from "./slurp-tone.js";

/** Most world events one tick may produce, whatever the settings say. */
export const SLURP_TUNING_EVENTS_PER_TICK_CEILING = 60;
/** Most world actions (commissions, messages, questions) one tick may produce. */
export const SLURP_TUNING_ACTIONS_PER_TICK_CEILING = 20;
/** Most pulse reactions one tick may produce. */
export const SLURP_TUNING_PULSE_PER_TICK_CEILING = 40;

const num = (min: number, max: number, fallback: number) =>
  z
    .preprocess(
      (value) => (typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : value),
      z.number().min(min).max(max),
    )
    .default(fallback);
const int = (min: number, max: number, fallback: number) =>
  z
    .preprocess(
      (value) =>
        typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : value,
      z.number().int().min(min).max(max),
    )
    .default(fallback);
const text = (max: number, fallback: string) => z.string().max(max).default(fallback);
const curve = (floor: number, cap: number, coef: number, capMax: number) =>
  z.object({ floor: int(0, 1_000_000, floor), cap: num(0, capMax, cap), curve: num(0, capMax, coef) }).default({});

export const SLURP_TUNING_PRESETS = ["quiet", "realistic", "lively", "generous", "custom"] as const;

export const slurpSimulationTuningSchema = z.object({
  preset: z.enum(SLURP_TUNING_PRESETS).default("realistic"),
  clock: z
    .object({
      tickMinutes: int(1, 240, 5),
      backgroundTimer: z.boolean().default(false),
      catchUpHours: int(1, 24 * 14, 72),
      maxEventsPerTick: int(1, SLURP_TUNING_EVENTS_PER_TICK_CEILING, 14),
    })
    .default({}),
  reach: z
    .object({
      floor: int(0, 1_000_000, 240),
      ceiling: int(1, 10_000_000, 34_000),
      growthDays: num(1, 3650, 45),
      realFollowerWeight: num(0, 1000, 25),
    })
    .default({}),
  pulse: z
    .object({
      minutesPerReaction: num(0.1, 1440, 3),
      referenceReach: int(1, 10_000_000, 3_000),
      maxPerTick: int(0, SLURP_TUNING_PULSE_PER_TICK_CEILING, 6),
      likeBudgetScale: num(0, 20, 1),
      postMaxAgeHours: int(1, 24 * 60, 48),
      oldPostTrickle: num(0, 1, 0),
      poolSize: int(1, 500, 24),
    })
    .default({}),
  world: z
    .object({
      maxActionsPerTick: int(0, SLURP_TUNING_ACTIONS_PER_TICK_CEILING, 4),
      maxOpenRequests: int(0, 50, 3),
      commission: curve(40, 0.5, 0.09, 10),
      message: curve(60, 0.3, 0.07, 10),
      question: curve(10, 2.5, 0.45, 20),
      questionNeedsRecentPost: z.boolean().default(true),
    })
    .default({}),
  funnel: z
    .object({
      rollCadence: z.enum(["daily", "hourly"]).default("daily"),
      churnDays: num(0.01, 30, 0.5),
      ambientCanPay: z.boolean().default(false),
      conversionGrowth: num(0, 10, 0),
    })
    .default({}),
  economy: z.object({ audienceCommissionPrice: int(0, 99_999, 40) }).default({}),
  prompts: z
    .object({
      tones: z
        .object({
          warm: text(2000, SLURP_AUDIENCE_TONE_INSTRUCTIONS.warm),
          mixed: text(2000, SLURP_AUDIENCE_TONE_INSTRUCTIONS.mixed),
          unfiltered: text(2000, SLURP_AUDIENCE_TONE_INSTRUCTIONS.unfiltered),
        })
        .default({}),
      fanActivityExtra: text(4000, ""),
      replyMaxChars: int(20, 2000, 180),
      scheduleExtra: text(4000, ""),
    })
    .default({}),
});

export type SlurpSimulationTuning = z.infer<typeof slurpSimulationTuningSchema>;
export type SlurpTuningPreset = (typeof SLURP_TUNING_PRESETS)[number];

/** Today's constants, exactly. Every schema default above is this preset. */
export const SLURP_REALISTIC_TUNING: SlurpSimulationTuning = slurpSimulationTuningSchema.parse({});

const R = SLURP_REALISTIC_TUNING;
const scaleCurves = (world: SlurpSimulationTuning["world"], factor: number): SlurpSimulationTuning["world"] => ({
  ...world,
  commission: { ...world.commission, curve: world.commission.curve * factor },
  message: { ...world.message, curve: world.message.curve * factor },
  question: { ...world.question, curve: world.question.curve * factor },
});

const PRESETS: Record<Exclude<SlurpTuningPreset, "custom">, SlurpSimulationTuning> = {
  realistic: R,
  // Half the activity: reactions cost twice the time, half the actions, half the request curves.
  quiet: {
    ...R,
    preset: "quiet",
    pulse: { ...R.pulse, minutesPerReaction: 6, maxPerTick: 3, likeBudgetScale: 0.5, poolSize: 16 },
    world: { ...scaleCurves(R.world, 0.5), maxActionsPerTick: 2, maxOpenRequests: 2 },
  },
  // Two to three times the events: reactions arrive two and a half times as fast against a cap
  // that is not the thing holding them back, and old posts keep a small trickle.
  lively: {
    ...R,
    preset: "lively",
    pulse: {
      ...R.pulse,
      minutesPerReaction: 1.2,
      maxPerTick: 15,
      likeBudgetScale: 1.5,
      oldPostTrickle: 0.1,
      poolSize: 48,
    },
    world: { ...scaleCurves(R.world, 2.5), maxActionsPerTick: 8, maxOpenRequests: 5 },
  },
  // Lively, plus a crowd that pays: ambient accounts have a budget, engagement raises conversion
  // to its ceiling, and commissions are worth twice what they are elsewhere.
  generous: {
    ...R,
    preset: "generous",
    pulse: {
      ...R.pulse,
      minutesPerReaction: 1.2,
      maxPerTick: 15,
      likeBudgetScale: 2,
      oldPostTrickle: 0.1,
      poolSize: 48,
    },
    world: { ...scaleCurves(R.world, 2.5), maxActionsPerTick: 8, maxOpenRequests: 5 },
    funnel: { ...R.funnel, rollCadence: "hourly", ambientCanPay: true, conversionGrowth: 3 },
    economy: { audienceCommissionPrice: 80 },
  },
};

/** The tuning a preset stands for. `custom` has no values of its own, so it reads as realistic. */
export function slurpTuningForPreset(preset: SlurpTuningPreset): SlurpSimulationTuning {
  return structuredClone(preset === "custom" ? R : PRESETS[preset]);
}

/** The background world pass when `clock.backgroundTimer` is off: a few catch-ups a day. */
export const SLURP_WORLD_IDLE_POLL_MS = 6 * 60 * 60 * 1000;

/**
 * Whether the world timer should tick now. It wakes every `tickMinutes` either way, so toggling
 * `backgroundTimer` takes effect without a restart; off keeps the old four-a-day cadence.
 */
export function slurpWorldTimerDue(
  clock: Pick<SlurpSimulationTuning["clock"], "backgroundTimer">,
  lastRunMs: number,
  nowMs: number,
): boolean {
  return clock.backgroundTimer || nowMs - lastRunMs >= SLURP_WORLD_IDLE_POLL_MS;
}

/**
 * The same storage with `recordCreatorEvent` capped at `max` calls (never past the hard ceiling).
 * Storage methods call `this.recordCreatorEvent`, so arc events written inside the storage count too.
 */
export function slurpCapTickEvents<T extends { recordCreatorEvent: (...args: never[]) => Promise<void> }>(
  storage: T,
  max: number,
): T {
  let left = Math.min(max, SLURP_TUNING_EVENTS_PER_TICK_CEILING);
  return {
    ...storage,
    recordCreatorEvent: (...args: Parameters<T["recordCreatorEvent"]>) =>
      left-- > 0 ? storage.recordCreatorEvent(...args) : Promise.resolve(),
  };
}
