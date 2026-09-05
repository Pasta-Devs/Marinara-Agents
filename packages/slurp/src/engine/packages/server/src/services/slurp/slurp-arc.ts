/**
 * What is happening to somebody, as opposed to where they are.
 *
 * Pure and deterministic, like the other Slurp rule modules.
 *
 * The funnel says where a person stands: liker, follower, subscriber, whale. It says nothing about
 * direction, so every regular looked permanent and every lapse arrived without warning. A review
 * called this out — the cast had states and no trajectories, and a trajectory is what turns a row
 * in a list into somebody you can notice something about.
 *
 * An arc is cheap. It is one column and a transition rule; it costs no generation. What it buys is
 * a readable story beat: "Moth Hour has gone quiet lately" is a sentence about a person, where
 * "Moth Hour: liker" is a database row.
 */

import { SLURP_FUNNEL_STAGES, type SlurpFunnelStage } from "./slurp-population.js";

export const SLURP_ARCS = ["steady", "rising", "cooling", "burnout", "returning"] as const;

export type SlurpArc = (typeof SLURP_ARCS)[number];

/** Days an arc runs before it is reconsidered. Long enough to be noticed, short enough to move. */
export const SLURP_ARC_DAYS = 21;

/** Below this, somebody has not been around enough for a direction to mean anything. */
const MIN_INTERACTIONS_FOR_ARC = 3;

export type SlurpArcSubject = {
  stage: SlurpFunnelStage;
  interactions: number;
  spent: number;
  /** Days since this person last did anything with this Creator. */
  daysSinceSeen: number;
  /** Days since their arc was last set. */
  daysOnArc: number;
  arc: SlurpArc;
};

/**
 * Decide the arc somebody should be on.
 *
 * Reads their state rather than rolling dice, so an arc is always explicable: a whale who stopped
 * showing up is burning out because that is what the numbers say, not because a random number
 * chose it. No seed, and deliberately so — a trajectory the player cannot account for is worse
 * than no trajectory, because they would learn to distrust the ones that are real.
 */
export function slurpNextArc(subject: SlurpArcSubject): SlurpArc {
  const stageIndex = SLURP_FUNNEL_STAGES.indexOf(subject.stage as (typeof SLURP_FUNNEL_STAGES)[number]);
  const interactions = Math.max(0, subject.interactions);
  const daysSinceSeen = Math.max(0, subject.daysSinceSeen);

  // Somebody who drifted away and came back is the strongest beat available, so it wins outright.
  if (subject.stage === "lapsed") return daysSinceSeen < 7 ? "returning" : "steady";

  // Too new to have a direction. Calling somebody's second visit a trend is noise.
  if (interactions < MIN_INTERACTIONS_FOR_ARC) return "steady";

  // Burnout is specific: somebody who invested heavily and then stopped. A quiet spell from a
  // casual reader is not a story; the same silence from a whale is.
  if (subject.spent >= 100 && daysSinceSeen >= 14) return "burnout";

  if (daysSinceSeen >= 10) return "cooling";

  // Rising needs both recency and a real relationship behind it, or every active liker reads as
  // being on the way up.
  if (daysSinceSeen <= 3 && interactions >= 8 && stageIndex >= SLURP_FUNNEL_STAGES.indexOf("follower")) {
    return "rising";
  }

  // An arc that has run its course returns to steady rather than persisting forever. Without this
  // the first arc somebody was ever given would describe them permanently.
  if (subject.arc !== "steady" && subject.daysOnArc >= SLURP_ARC_DAYS) return "steady";

  return subject.arc === "returning" && subject.daysOnArc >= 7 ? "steady" : subject.arc;
}

/**
 * Whether a change of arc is worth telling the player about.
 *
 * Only transitions a person would actually notice. Sliding back to steady is the absence of news,
 * and reporting it would spend the readable-handful budget on nothing happening.
 */
export function isNotableArcChange(from: SlurpArc, to: SlurpArc): boolean {
  if (from === to) return false;
  return to === "burnout" || to === "returning" || to === "rising";
}

/** One clause describing the direction, for the relationship line in a prompt. */
export function slurpArcDescription(arc: SlurpArc): string | null {
  switch (arc) {
    case "rising":
      return "getting more into you lately";
    case "cooling":
      return "has been drifting off lately";
    case "burnout":
      return "used to be one of your biggest supporters and has gone quiet";
    case "returning":
      return "drifted away for a while and has just come back";
    default:
      return null;
  }
}
