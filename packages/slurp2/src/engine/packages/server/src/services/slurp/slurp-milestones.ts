/**
 * Follower milestones: the thing a Creator is aiming at.
 *
 * Pure, like `slurp-wallet.ts` and `slurp-earnings.ts` beside it.
 *
 * A review of the live-world plan found it had systems and no goals. Numbers moved and nothing
 * marked progress, so "more followers" was not something a player could aim at. A milestone is
 * the cheapest possible goal: it is derived, stores nothing, and costs no generation.
 *
 * The ladder is coarse on purpose. Milestones every hundred would fire constantly and stop meaning
 * anything; the readable-handful rule applies to goals as much as to notifications.
 */

/** Round numbers a person would actually celebrate. Ascending, and never dense enough to nag. */
const MILESTONES = [
  100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000,
] as const;

export type SlurpMilestone = {
  /** The last milestone passed, or null before the first one. */
  reached: number | null;
  /** The next target, or null once the ladder is finished. */
  next: number | null;
  /** Progress toward `next`, in [0, 1]. 1 when the ladder is finished. */
  progress: number;
  /** Followers still needed. 0 when the ladder is finished. */
  remaining: number;
};

export function slurpFollowerMilestone(followers: number): SlurpMilestone {
  const count = Math.max(0, Math.floor(followers));
  const next = MILESTONES.find((target) => target > count) ?? null;
  const reached = [...MILESTONES].reverse().find((target) => target <= count) ?? null;
  if (next === null) return { reached, next: null, progress: 1, remaining: 0 };
  // Progress runs from the previous milestone, not from zero. Measuring from zero makes every
  // step past the first look almost finished, which reads as progress the player did not make.
  const floor = reached ?? 0;
  return {
    reached,
    next,
    progress: Math.min(1, Math.max(0, (count - floor) / (next - floor))),
    remaining: next - count,
  };
}

/**
 * Milestones crossed by moving from one follower count to another.
 *
 * Returned oldest first, so a catch-up panel can report a quiet week that passed two of them
 * without inventing an order. Empty when the count fell or did not cross anything.
 */
export function slurpMilestonesCrossed(from: number, to: number): number[] {
  const start = Math.max(0, Math.floor(from));
  const end = Math.max(0, Math.floor(to));
  if (end <= start) return [];
  return MILESTONES.filter((target) => target > start && target <= end);
}
