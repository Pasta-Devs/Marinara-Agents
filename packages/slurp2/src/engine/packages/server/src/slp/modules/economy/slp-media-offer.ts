import type { SlurpRapportTier } from "../messages/slp-rapport.js";

export const SLURP_MEDIA_INTENTS = ["friendly", "hostile", "premium", "preview"] as const;
export type SlurpMediaIntent = (typeof SLURP_MEDIA_INTENTS)[number];
export type SlurpMediaVisibility = "free" | "locked";

export type SlurpMediaOffer = {
  visibility: SlurpMediaVisibility;
  price: number;
  reason: "relationship_reward" | "premium_content" | "creator_choice" | "hostile_free";
};

export function resolveSlurpMediaOffer(input: {
  intent: SlurpMediaIntent;
  rapportTier: SlurpRapportTier;
  subscribed: boolean;
  configuredPrice: number;
  requestedVisibility?: SlurpMediaVisibility;
  /** A chat picture's heat (slice I, user): for a subscriber a casual one is free and a spicy one is PPV. */
  spicy?: boolean;
  /** She is with the viewer (Drama, "your relationship"): what she sends her partner is never sold. */
  partner?: boolean;
  /** A favourite's spicy picture, now and then a gift "just for you" (rapport ladder). */
  gift?: boolean;
}): SlurpMediaOffer {
  if (input.intent === "hostile") return { visibility: "free", price: 0, reason: "hostile_free" };
  if (input.partner) return { visibility: "free", price: 0, reason: "relationship_reward" };
  if (input.gift && input.spicy && input.intent === "friendly") {
    return { visibility: "free", price: 0, reason: "relationship_reward" };
  }
  if (input.subscribed && input.spicy !== undefined && input.intent !== "premium")
    return input.spicy
      ? { visibility: "locked", price: slurpPpvPrice(input.configuredPrice), reason: "premium_content" }
      : { visibility: "free", price: 0, reason: "relationship_reward" };
  if (
    input.intent === "premium" ||
    // A picture to somebody she hardly knows yet is sold, not given: the PPV of a creator site.
    input.rapportTier === "acquaintance" ||
    input.rapportTier === "stranger" ||
    (input.requestedVisibility === "locked" && input.rapportTier !== "whale" && !input.subscribed)
  ) {
    return {
      visibility: "locked",
      price: slurpPpvPrice(input.configuredPrice),
      reason: input.intent === "premium" ? "premium_content" : "creator_choice",
    };
  }
  return { visibility: "free", price: 0, reason: "relationship_reward" };
}

export const slurpPpvPrice = (configured: number | undefined) =>
  Math.max(1, Math.min(9999, Math.trunc(configured || 10)));

// Nudity or sex in a picture prompt. Only the fallback for a reply that did not say whether its
// picture is spicy; the model's own "spicy" flag decides first.
const SPICY_PICTURE =
  /\b(nude|naked|topless|bottomless|nipples?|breasts?|boobs?|tits|lingerie|underwear|panties|bra|thong|nsfw|explicit|sex|sexy|sexual|masturbat\w*|sex toys?|dildo|vibrator|aroused|bare (?:skin|chest|body)|undress\w*|stripping|shower)\b/iu;

/** Whether a chat picture is spicy: the reply says so, or its prompt is about nudity or sex. */
export function slurpDmPictureSpicy(image: { prompt: string; spicy?: boolean }): boolean {
  return image.spicy ?? SPICY_PICTURE.test(image.prompt);
}
