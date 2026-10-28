/** What a brand deal play shows before it runs (R): the fit and the preview card. */
/** Whether a product fits a Creator (the Stir brand picker): both spice and brand words, R's two fit rules. */
export type SlpBrandFit = "fits" | "spice" | "offBrand";

/**
 * What `offer-brand-deal` would do (R). Shaped like a Stir preview card (who, detail, notes, error,
 * when, refusable, summary), so Stir can show it as one. `notes[].kind`: notAutomatic (the player's
 * own page answers in the Dashboard), spice (the product is spicier than the page), noAds / offBrand (the
 * card will likely say no), mayDecline. `error`: notFound, noProduct, busy (an offer is open), adsOff.
 */
export type SlpBrandDealPreview = {
  who: { id: string; name: string }[];
  detail: {
    brand: string | null;
    product: string | null;
    productId: string | null;
    brandId: string | null;
    fee: number | null;
    pitch: string | null;
    logoUrl: string | null;
  };
  notes: { kind: string; name: string }[];
  error: "notFound" | "noProduct" | "busy" | "adsOff" | null;
  when: "nextPost" | "now";
  refusable: boolean;
  summary: string;
};
