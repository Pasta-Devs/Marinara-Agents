import type { AppManifest } from "../../platform/app-manifest";

export const marketplaceManifest: AppManifest = {
  id: "marketplace",
  name: "Marketplace",
  version: "1.0.0",
  icon: "marketplace",
  category: "lifestyle",
  capabilities: ["storage.local", "context.read"],
  modelUse: "heavy",
  removable: true,
  routes: [
    { id: "listings", path: "/", title: "Marketplace" },
    { id: "listing", path: "/listing", title: "Listing" },
    { id: "yours", path: "/yours", title: "Your stuff" },
  ],
  records: [
    { type: "listing-cache", ownership: "phone-local" },
    { type: "purchase", ownership: "phone-local" },
    { type: "own-listing", ownership: "phone-local" },
  ],
  actions: [
    { id: "refresh-listings", tier: "ambient" },
    { id: "buy", tier: "story" },
    { id: "haggle", tier: "ambient" },
    { id: "sell", tier: "story" },
  ],
  content: { listings: { fields: { listings: "string[]" } } },
  notifications: null,
};

export interface Listing {
  title: string;
  price: string;
  seller: string;
  description: string;
}

/** Stable enough to key saved items and message threads across a refresh. */
export function listingKey(listing: Listing) {
  return `${listing.seller}::${listing.title}`.toLowerCase();
}

/** Free-text prices ("40 marks", "5 coins/month", "offers"). 0 means it is not a number. */
export function priceValue(price: string) {
  const found = price.match(/\d[\d,]*/u);
  return found ? Number.parseInt(found[0].replace(/,/gu, ""), 10) : 0;
}

export interface OwnListing {
  id: string;
  title: string;
  price: string;
  description: string;
  offer: { from: string; amount: number; message: string } | null;
  sold: boolean;
}

export interface HaggleTurn {
  from: "you" | "seller";
  text: string;
}

/** "Seller | Price | Title | description". */
export function parseListing(line: string): Listing {
  const parts = line.split(" | ");
  return {
    seller: parts[0]?.trim() || "Someone",
    price: parts[1]?.trim() || "Offers",
    title: parts[2]?.trim() || "Unnamed item",
    description: parts.slice(3).join(" | ").trim() || "No description given.",
  };
}

/**
 * Step 11.2(b) — with no image connection, a listing keeps its title, price and seller and only the
 * picture is missing, exactly as a real marketplace page reads with the network cut. The model
 * picks a grey glyph to match what the photo would have shown, so the empty slot is deliberate
 * rather than broken. This is the permanent state for the many users who never configure images.
 */
const GLYPHS: Array<[RegExp, string]> = [
  [/\b(car|van|truck|bike|bicycle|scooter)\b/iu, "▤"],
  [/\b(phone|laptop|computer|camera|radio)\b/iu, "▣"],
  [/\b(chair|table|desk|sofa|couch|bed|lamp)\b/iu, "▥"],
  [/\b(coat|jacket|dress|boots|shoes|shirt)\b/iu, "▧"],
  [/\b(book|map|letter|record|vinyl)\b/iu, "▨"],
  [/\b(sword|knife|gun|armour|armor|shield)\b/iu, "▩"],
  [/\b(dog|cat|horse|bird|fish)\b/iu, "❖"],
];

export function glyphFor(listing: Listing) {
  const haystack = `${listing.title} ${listing.description}`;
  for (const [pattern, glyph] of GLYPHS) {
    if (pattern.test(haystack)) return glyph;
  }
  return "▢";
}
