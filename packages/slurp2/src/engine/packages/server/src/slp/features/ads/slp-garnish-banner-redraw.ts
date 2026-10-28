/**
 * The one-time wide banner for older ads (V): which ad is next and how the pace is kept. Pure; the
 * image service draws it and stores the record.
 */
import type { GarnishAd } from "../../../services/garnish-ads/garnish-ads.types.js";

export const GARNISH_BANNER_REDRAW_KEY = "slurp2.ad-banner-redraw";
/** ponytail: a fixed pace for the one-time banner redraw; make it a setting if players want it faster. */
export const GARNISH_BANNER_REDRAWS_PER_DAY = 6;

export type GarnishBannerRedrawState = { tried: string[]; day: string; count: number };

export function readGarnishBannerRedrawState(raw: string | null | undefined, at: Date): GarnishBannerRedrawState {
  let parsed: Partial<GarnishBannerRedrawState> = {};
  try {
    parsed = raw ? (JSON.parse(raw) as Partial<GarnishBannerRedrawState>) : {};
  } catch {
    parsed = {};
  }
  const day = at.toISOString().slice(0, 10);
  return {
    tried: Array.isArray(parsed.tried) ? parsed.tried.filter((id): id is string => typeof id === "string") : [],
    day,
    count: parsed.day === day && typeof parsed.count === "number" && parsed.count > 0 ? Math.floor(parsed.count) : 0,
  };
}

/**
 * The next older ad to get its wide banner (V, user: redraw old ad pictures once in the 1.91:1
 * format). Only an ad whose feed picture Slurp drew (`drawnBySlurp`: a file in its own folder, never
 * a player's picture link), with no banner yet, tried at most once, and only a few a day. "paced"
 * when today's share is used, null when none is left.
 */
export function nextGarnishBannerRedraw(
  ads: readonly GarnishAd[],
  state: GarnishBannerRedrawState,
  drawnBySlurp: (ad: GarnishAd) => boolean,
): GarnishAd | "paced" | null {
  const tried = new Set(state.tried);
  const ad = ads.find((entry) => !entry.wideImageUrl && !tried.has(entry.id) && drawnBySlurp(entry));
  if (!ad) return null;
  return state.count >= GARNISH_BANNER_REDRAWS_PER_DAY ? "paced" : ad;
}
