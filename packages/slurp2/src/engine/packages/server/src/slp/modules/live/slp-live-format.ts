import { slurpLiveTipOffset } from "./slp-live.js";

/** Goal Striptease: once the tip goal is hit, the room gets a second goal at twice the first. */
export function slurpLiveGoalTarget(goal: number, raised: number): number {
  return raised >= goal ? goal * 2 : goal;
}

/** A whale shows up with p = 0.15 per 5 show minutes; one tipping fan of the room is it. */
export function slurpLiveIsWhale(showId: string, fanId: string, durationMs: number, fans: number): boolean {
  const showChance = 1 - 0.85 ** (durationMs / 300_000);
  return slurpLiveTipOffset(showId, `whale:${fanId}`, 1_000_000) / 1_000_000 < showChance / Math.max(1, fans);
}

/** A whale tips at least five normal tips, and at least a quarter of the goal. */
export function slurpLiveWhaleAmount(amount: number, goal: number): number {
  return Math.max(amount * 5, Math.round(goal * 0.25));
}
