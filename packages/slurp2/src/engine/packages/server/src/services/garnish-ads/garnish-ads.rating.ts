import type { GarnishAdEvent } from "./garnish-ads.storage.js";

/** How many impressions a new ad is guaranteed before quality can retire it. */
export const TRIAL_IMPRESSIONS = 8;

/**
 * Quality per ad, from behaviour rather than a rating widget: an action is a
 * strong positive, a hide a strong negative, an impression mild evidence of
 * neither. Ads still inside their trial return 0 so a new ad is never buried
 * before anyone has seen it.
 */
export function qualityScores(events: readonly GarnishAdEvent[]): Map<string, number> {
  const tally = new Map<string, { impressions: number; hides: number; actions: number }>();
  for (const event of events) {
    const row = tally.get(event.adId) ?? { impressions: 0, hides: 0, actions: 0 };
    if (event.type === "impression") row.impressions += 1;
    if (event.type === "hide") row.hides += 1;
    if (event.type === "action") row.actions += 1;
    tally.set(event.adId, row);
  }
  const scores = new Map<string, number>();
  for (const [adId, row] of tally) {
    if (row.impressions < TRIAL_IMPRESSIONS) {
      scores.set(adId, 0);
      continue;
    }
    scores.set(adId, ((row.actions * 3 - row.hides * 4) / row.impressions) * 10);
  }
  return scores;
}
