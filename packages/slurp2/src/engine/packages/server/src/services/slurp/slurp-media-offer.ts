import type { SlurpRapportTier } from "./slurp-rapport.js";

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
}): SlurpMediaOffer {
  if (input.intent === "hostile") return { visibility: "free", price: 0, reason: "hostile_free" };
  if (
    input.intent === "premium" ||
    (input.requestedVisibility === "locked" && input.rapportTier !== "whale" && !input.subscribed)
  ) {
    return {
      visibility: "locked",
      price: Math.max(1, Math.min(9999, Math.trunc(input.configuredPrice || 10))),
      reason: input.intent === "premium" ? "premium_content" : "creator_choice",
    };
  }
  return { visibility: "free", price: 0, reason: "relationship_reward" };
}
