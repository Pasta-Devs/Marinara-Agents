/**
 * "Pause all" (Settings › Overview): Slurp stops. No model or image call, no world tick, no posting,
 * no fan activity, no messages of its own. The app stays readable; everything picks up where it was
 * when the player switches it back on.
 *
 * The switch lives in the settings, and every settings read and write keeps this flag in step, so the
 * provider and image wrappers can check it without a database. The schedulers read it fresh
 * (`slurpPausedNow`) before each pass, so a restart while paused stays paused.
 *
 * ponytail: one process-wide flag. The Engine runs one Slurp per process; per-install state if that changes.
 */
let paused = false;

export class SlurpPausedError extends Error {
  constructor() {
    super("Slurp is paused (Settings › Overview › Pause all).");
    this.name = "SlurpPausedError";
  }
}

export const slurpPaused = () => paused;

export function setSlurpPaused(value: boolean): void {
  paused = value;
}

/** Throws while Slurp is paused: the one gate every model and image call passes. */
export function assertSlurpNotPaused(): void {
  if (paused) throw new SlurpPausedError();
}
