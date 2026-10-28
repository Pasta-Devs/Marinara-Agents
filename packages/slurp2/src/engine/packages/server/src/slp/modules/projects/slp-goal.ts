/**
 * Tip goals: the thing a Creator asks their audience for.
 *
 * Pure, like `slurp-wallet.ts`, `slurp-earnings.ts`, and `slurp-milestones.ts` beside it.
 *
 * A milestone is a goal the player aims at. A tip goal is a goal the player shows *other people*,
 * which is a different job: it gives the audience a reason to tip and turns a balance into a
 * shared target. It is core to the genre and Slurp had neither.
 *
 * Progress is measured from the lifetime earnings recorded when the goal opened, not from the
 * current balance. A balance falls when money is withdrawn, and a goal that slid backwards
 * because the Creator was paid would be nonsense.
 */

import { SLURP_EARNINGS_LEGACY_SCALE } from "../economy/slp-earnings.js";

/** Longest goal label. Long enough for "new set on Friday", short enough for one line. */
export const SLURP_GOAL_LABEL_MAX_LENGTH = 80;

/** A goal below this is not worth showing; above it, nobody believes the target. */
export const SLURP_GOAL_MIN_TARGET = 1;
export const SLURP_GOAL_MAX_TARGET = 1_000_000;

/** Storage key for one Creator's tip goal. Mirrors the earnings key shape. */
export const slurpGoalKey = (creatorAccountId: string) => `slurp2.creator.${creatorAccountId}.goal`;

export type SlurpGoal = {
  label: string;
  target: number;
  /** Lifetime earnings when the goal opened. Progress is measured from here. */
  startLifetime: number;
  startedAt: string;
  /** Target and start in platform dollars (0.3.7), like the earnings they are measured against. */
  platform?: true;
};

export type SlurpGoalProgress = {
  label: string;
  target: number;
  /** Coins earned since the goal opened, clamped to the target. */
  raised: number;
  /** In [0, 1]. */
  progress: number;
  remaining: number;
  met: boolean;
  startedAt: string;
};

const intOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) ? value : null;

/** Read stored JSON back into a goal, or null when there is not a usable one. */
export function readSlurpGoal(raw: string | null): SlurpGoal | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SlurpGoal>;
    if (!parsed || typeof parsed !== "object") return null;
    const target = intOrNull(parsed.target);
    const startLifetime = intOrNull(parsed.startLifetime);
    if (typeof parsed.label !== "string" || !parsed.label.trim()) return null;
    // A goal converted from coins (0.3.7) may sit above the limit for new goals; it keeps its full target.
    const maxTarget = SLURP_GOAL_MAX_TARGET * SLURP_EARNINGS_LEGACY_SCALE;
    if (target === null || target < SLURP_GOAL_MIN_TARGET || target > maxTarget) return null;
    if (startLifetime === null || startLifetime < 0) return null;
    if (typeof parsed.startedAt !== "string" || Number.isNaN(Date.parse(parsed.startedAt))) return null;
    // A goal opened before 0.3.7 counted coins; earnings are now dollars, so both ends scale alike.
    const scale = parsed.platform === true ? 1 : SLURP_EARNINGS_LEGACY_SCALE;
    return {
      label: parsed.label.trim().slice(0, SLURP_GOAL_LABEL_MAX_LENGTH),
      target: Math.min(maxTarget, target * scale),
      startLifetime: startLifetime * scale,
      startedAt: parsed.startedAt,
      platform: true,
    };
  } catch {
    return null;
  }
}

/** Open a goal against the Creator's current lifetime earnings. */
export function openSlurpGoal(label: string, target: number, lifetimeEarnings: number, at: Date): SlurpGoal | null {
  const trimmed = label.trim().slice(0, SLURP_GOAL_LABEL_MAX_LENGTH);
  if (!trimmed) return null;
  if (!Number.isInteger(target) || target < SLURP_GOAL_MIN_TARGET || target > SLURP_GOAL_MAX_TARGET) return null;
  return {
    label: trimmed,
    target,
    startLifetime: Math.max(0, Math.floor(lifetimeEarnings)),
    startedAt: at.toISOString(),
    platform: true,
  };
}

/**
 * Progress toward a goal.
 *
 * `raised` is clamped at the target so a goal that was passed reads as complete rather than as
 * 340%, and it never goes negative if lifetime earnings were reversed after the goal opened.
 */
export function slurpGoalProgress(goal: SlurpGoal, lifetimeEarnings: number): SlurpGoalProgress {
  const earned = Math.max(0, Math.floor(lifetimeEarnings) - goal.startLifetime);
  const raised = Math.min(goal.target, earned);
  return {
    label: goal.label,
    target: goal.target,
    raised,
    progress: goal.target > 0 ? raised / goal.target : 1,
    remaining: Math.max(0, goal.target - earned),
    met: earned >= goal.target,
    startedAt: goal.startedAt,
  };
}
