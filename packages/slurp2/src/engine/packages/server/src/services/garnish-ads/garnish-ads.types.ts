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

/** How a product's price reads: a treat anyone grabs, an everyday buy, or a splurge. */
export type GarnishPriceFeel = "budget" | "everyday" | "premium";
export const GARNISH_PRICE_FEELS: readonly GarnishPriceFeel[] = ["budget", "everyday", "premium"];

/**
 * An ad is one product of a brand. `brand` is the brand's display name (kept on every row, so an ad
 * still reads on its own); `brandId` ties it to a `GarnishBrand`. Older rows have no `brandId`: their
 * brand is the one named like them (`garnishAdBrandId`), so nothing had to be rewritten.
 */
export type GarnishAd = {
  id: string;
  platform: GarnishPlatform;
  kind: GarnishAdKind;
  brand: string;
  brandId?: string;
  product: string;
  /** The one-line pitch. */
  copy: string;
  priceFeel?: GarnishPriceFeel;
  /** What the product looks like, for its pictures and for a Creator showing it. */
  look?: string;
  categories: string[];
  contextTags: string[];
  creatorAccountId?: string;
  creatorHandle?: string;
  /** The feed picture, 4:5 like a post. */
  imageUrl?: string | null;
  /** A 1.91:1 banner for wide slots. Absent on older ads: those slots crop `imageUrl` from the top. */
  wideImageUrl?: string | null;
  actionLabel?: string;
  contentRating: GarnishContentRating;
  origin: GarnishAdOrigin;
  createdAt?: string;
  /** Set when the ad is withdrawn from selection. The row stays so ids are never reused. */
  retiredAt?: string | null;
};

/**
 * A brand: who is paying. Its products are the ads that carry its id. `contentRating` on each product
 * is its spice fit; the brand only holds what is true of all of them.
 */
export type GarnishBrand = {
  id: string;
  platform: GarnishPlatform;
  name: string;
  /** One word or two: drinks, gaming, lingerie. */
  category: string;
  /** How the brand talks, one line. */
  tone: string;
  /** What the logo looks like, for drawing it. */
  logoPrompt: string;
  logoUrl?: string | null;
  origin: GarnishAdOrigin;
  createdAt?: string;
  /** Switched off: none of its products show or sponsor anyone. The row stays. */
  disabledAt?: string | null;
};

const brandSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 60);

/** The id a brand named like this has. Base brands use it too, so an old ad finds its shipped brand. */
export const garnishBrandId = (name: string) => `brand-${brandSlug(name) || "unnamed"}`;

/** The brand an ad belongs to. */
export const garnishAdBrandId = (ad: Pick<GarnishAd, "brand" | "brandId">) => ad.brandId || garnishBrandId(ad.brand);

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

/**
 * The two shapes an ad is shown in. The feed card is 4:5 like a post (the old 1024×640 picture lost
 * both sides in that frame); Discover and other wide slots show a 1.91:1 banner, the usual social
 * ad banner ratio. Each is drawn for its own frame, so nothing important is cut. Sizes are multiples
 * of 64, which every provider accepts.
 */
export const GARNISH_AD_IMAGE_FORMATS = [
  {
    field: "imageUrl",
    width: 1024,
    height: 1280,
    framing: "Vertical 4:5 picture: the product or person fills the frame, centred, with a little room at the top.",
  },
  {
    field: "wideImageUrl",
    width: 1216,
    height: 640,
    framing:
      "Wide banner picture, about twice as wide as tall: the product or person sits in the left or right third, the rest is calm open background, nothing important near the top or bottom edge.",
  },
] as const;
export type GarnishAdImageField = (typeof GARNISH_AD_IMAGE_FORMATS)[number]["field"];
