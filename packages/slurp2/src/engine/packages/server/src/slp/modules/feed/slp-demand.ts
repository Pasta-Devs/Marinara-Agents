/**
 * Aggregate demand: how often subscribers asked for the same kind of thing.
 *
 * Pure. A trend is a label and a count. The fan and their wording never come with it, which is
 * what lets demand shape Creator-wide planning without exposing anyone's private request.
 */

/** A trend nobody has added to in two weeks no longer says anything about demand. */
export const SLURP_DEMAND_MAX_AGE_MS = 14 * 24 * 60 * 60_000;
/** Topics are labels, not requests. Long ones would start carrying private wording. */
export const SLURP_DEMAND_TOPIC_MAX = 60;

export function normalizeSlurpDemandTopic(topic: string): string {
  return topic.trim().toLocaleLowerCase().replace(/\s+/gu, " ").slice(0, SLURP_DEMAND_TOPIC_MAX);
}
