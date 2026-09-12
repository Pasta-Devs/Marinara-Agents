/**
 * garnish-ads — the sponsored-content pool.
 *
 * This directory is written so it can later move out of Slurp into its own
 * agent package that serves Slurp, Noodle, and anything else. Extraction works
 * because of the dependency direction, not because of any abstraction layer, so
 * four rules hold it together:
 *
 *   1. No file in `garnish-ads/` imports from `../slurp`. Host apps push their
 *      context in; garnish-ads never reaches back out.
 *   2. No `slurp`, `noodler`, or `persona` in any identifier here. A viewer is
 *      a `subjectId`. A creator is a plain `{ id, handle, bio }`.
 *   3. No `garnish_*` table carries a foreign key pointing out of this module.
 *      Creator handles are stored as text, never as a reference.
 *   4. Host apps call `garnish-ads.service.ts` and nothing else in here.
 *
 * `tests/slurp-garnish-ads-boundary.regression.ts` enforces rules 1 and 2.
 *
 * The Slurp-side mapping lives in `../slurp/slurp-garnish-context.ts`. That is
 * the seam: it is the one file that knows both worlds, and it stays behind when
 * the rest of this directory moves.
 */

/** Host surface an ad belongs to. Pools are partitioned hard, never merged. */
export type GarnishPlatform = "slurp" | "noodle";

export type GarnishAdKind = "creator" | "inline";

/** Where an ad came from. Automatic retirement never touches `user` ads. */
export type GarnishAdOrigin = "builtin" | "user" | "generated";

/**
 * A gate, never a score. Hosts differ in what they may show, so this filters
 * before ranking and never competes with relevance.
 */
export type GarnishContentRating = "tame" | "suggestive" | "explicit";

export const GARNISH_CONTENT_RATINGS: readonly GarnishContentRating[] = ["tame", "suggestive", "explicit"];

/** True when `rating` is allowed under `ceiling`. */
export function garnishRatingAllowed(rating: GarnishContentRating, ceiling: GarnishContentRating): boolean {
  return GARNISH_CONTENT_RATINGS.indexOf(rating) <= GARNISH_CONTENT_RATINGS.indexOf(ceiling);
}

export type GarnishAd = {
  id: string;
  platform: GarnishPlatform;
  kind: GarnishAdKind;
  brand: string;
  product: string;
  copy: string;
  categories: string[];
  contextTags: string[];
  creatorAccountId?: string;
  creatorHandle?: string;
  imageUrl?: string | null;
  actionLabel?: string;
  contentRating: GarnishContentRating;
  origin: GarnishAdOrigin;
  createdAt?: string;
  /** Set when the ad is withdrawn from selection. The row stays so ids are never reused. */
  retiredAt?: string | null;
};

export type GarnishAdState = { hiddenAdIds: string[]; recentAdIds: string[]; hiddenBrands: string[] };

/**
 * Everything garnish-ads needs to target. Host apps map their own domain onto
 * this; nothing here names a host concept.
 */
export type GarnishAdContext = {
  subjectTags?: string[];
  currentCreatorId?: string | null;
  currentCreatorHandle?: string | null;
  contextTags?: string[];
  preferredTags?: string[];
  steering?: "balanced" | "personalized" | "random";
  /** Highest rating this subject may be shown. Applied before ranking. */
  contentCeiling?: GarnishContentRating;
};

/** A creator, reduced to the fields garnish-ads may know about. */
export type GarnishCreatorProfile = { id: string; handle: string; bio?: string | null };
