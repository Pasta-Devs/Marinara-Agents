import type { SlurpContentRating } from "../../base/state/slp-state-types";

/** One promotion as the ads feature publishes it to the feed, Backstage preview and inline ad card. */
export type SlurpPromotion = {
  id: string;
  platform?: "slurp" | "noodle";
  kind: "creator" | "inline";
  contentRating?: SlurpContentRating;
  origin?: "builtin" | "user" | "generated";
  retiredAt?: string | null;
  brand: string;
  product: string;
  copy: string;
  categories: string[];
  contextTags: string[];
  creatorAccountId?: string;
  creatorHandle?: string;
  /** The feed picture, 4:5 like a post. */
  imageUrl?: string | null;
  /** A 1.91:1 banner for wide slots; older ads have none and wide slots crop `imageUrl` from the top. */
  wideImageUrl?: string | null;
  actionLabel?: string;
  /** R: the brand it belongs to, its logo (the ad's avatar), and the product's price feel and look. */
  brandId?: string;
  brandLogoUrl?: string | null;
  priceFeel?: "budget" | "everyday" | "premium";
  look?: string;
};

// The Backstage ads preview renders a real inline ad, so the tile is part of the Ads contract.
export { SlurpInlineAd } from "./SlpInlineAd.js";
