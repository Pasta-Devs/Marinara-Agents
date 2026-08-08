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
  ],
  records: [{ type: "listing-cache", ownership: "phone-local" }],
  actions: [{ id: "refresh-listings", tier: "ambient" }],
  content: { listings: { fields: { listings: "string[]" } } },
  notifications: null,
};

export interface Listing {
  title: string;
  price: string;
  seller: string;
  description: string;
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
