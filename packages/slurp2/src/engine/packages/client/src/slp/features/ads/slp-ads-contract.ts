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
  imageUrl?: string | null;
  actionLabel?: string;
};
