/**
 * Whether a Creator posts in this slot at all.
 *
 * Pure and deterministic, like the other Slurp rule modules.
 *
 * ## The problem
 *
 * Every scheduled slot produced a post. A phone call, a glass of water, and a load of laundry all
 * became a caption and a picture, because the only thing that could stop a slot was a failure.
 * A real page has quiet afternoons, and a Creator who posts through every single one of them is
 * the clearest signal that nobody is choosing anything.
 *
 * ## The approach
 *
 * The skip is drawn before anything is generated and stored as its own decision, so it costs no
 * model call, no image, no retry, and no failure mark. It is deliberately independent of what the
 * post would have been about: the Creator is not skipping because the draw was boring, they are
 * skipping because they did not feel like posting.
 *
 * Two quiet slots in a row are refused. A page that goes silent for a day reads as broken rather
 * than as human, and at four posts a day two skips is most of an afternoon and an evening.
 */

import { slurpWeightedPick } from "./slp-weighted.js";

/** Out of 100. The default when a caller has no Creator strategy; see `slp-creator-strategy.ts`. */
const SKIP_RATE = 12;

export const SLURP_SKIP_REASONS = ["quiet_day", "nothing_worth_posting", "busy_elsewhere", "resting"] as const;
export type SlurpSkipReason = (typeof SLURP_SKIP_REASONS)[number];

export type SlurpSlotDecision = { skip: false } | { skip: true; reason: SlurpSkipReason };

export function slurpPlanSlot(
  creatorAccountId: string,
  sequence: number,
  context: { skippedLast?: boolean; skipRate?: number } = {},
): SlurpSlotDecision {
  if (context.skippedLast) return { skip: false };
  const rate = Math.min(100, Math.max(0, context.skipRate ?? SKIP_RATE));
  const skip = slurpWeightedPick("slot", creatorAccountId, sequence, [
    { value: true, weight: rate },
    { value: false, weight: 100 - rate },
  ]);
  if (!skip) return { skip: false };
  return {
    skip: true,
    reason: slurpWeightedPick(
      "skipReason",
      creatorAccountId,
      sequence,
      SLURP_SKIP_REASONS.map((value) => ({ value, weight: 1 })),
    ),
  };
}
