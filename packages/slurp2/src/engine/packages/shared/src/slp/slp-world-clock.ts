/**
 * The Slurp world clock (docs/WORLD-CLOCK.md). Simulation time is real time
 * plus one offset. The offset starts at zero, so existing installs read the
 * real clock. It only grows: a skip adds to it, and a checkpoint restore brings
 * the stored offset (and every mark) back. Infrastructure timing (locks, job
 * ages, timeouts, rate limits) keeps `Date.now()`; only simulation code reads
 * this clock.
 *
 * ponytail: one process-wide offset and epoch; the Engine runs one Slurp per
 * process. Per-install state would move both into the DB read path.
 */
let offsetMs = 0;
let epoch = 0;

/** World "now" in epoch milliseconds. */
export const slurpWorldNowMs = (): number => Date.now() + offsetMs;

/** World "now" as a Date, the drop-in for `new Date()` in simulation code. */
export const slurpWorldNow = (): Date => new Date(slurpWorldNowMs());

export const slurpWorldOffsetMs = (): number => offsetMs;

export function setSlurpWorldOffsetMs(value: number): void {
  offsetMs = Number.isFinite(value) ? Math.trunc(value) : 0;
}

/**
 * Restore epoch. A restore bumps it; a job that read it before it awaited
 * slow work (a model call) compares afterwards and drops its write.
 */
export const slurpWorldEpoch = (): number => epoch;

export function setSlurpWorldEpoch(value: number): void {
  epoch = Number.isFinite(value) ? Math.trunc(value) : 0;
}

export class SlurpWorldEpochChangedError extends Error {
  constructor() {
    super("The Slurp timeline was restored while this work ran.");
    this.name = "SlurpWorldEpochChangedError";
  }
}

/** Throws if a restore happened since `startedAt` (an earlier `slurpWorldEpoch()` read). */
export function assertSlurpWorldEpoch(startedAt: number): void {
  if (startedAt !== epoch) throw new SlurpWorldEpochChangedError();
}
