/**
 * Creator prices that move: commission quotes read from the brief, haggling on both sides, and the
 * weekly drift of a character Creator's prices.
 *
 * Pure and standalone, like `slurp-prices.ts`, so the rules can be tested without an Engine checkout.
 */
import { slpApplyModifiers } from "../../base/modifiers/slp-modifier-resolver.js";
import type { SlpActiveModifierProvider } from "../../base/modifiers/slp-modifier.types.js";

export type SlurpCommissionPricing = {
  commissionBase: number;
  commissionMin: number;
  commissionMax: number;
};

/** Offers each side may make before the price is final. */
export const SLURP_COMMISSION_MAX_HAGGLE_ROUNDS = 3;

const PRICE_SIGNALS: readonly { pattern: RegExp; weight: number }[] = [
  { pattern: /\b(sketch|doodle|quick|simple|small|headshot|icon|rough)\b/iu, weight: -0.35 },
  { pattern: /\b(full[- ]body|detailed|background|scene|colou?red|painted|polished)\b/iu, weight: 0.4 },
  { pattern: /\b(two|three|couple|group|pair|together)\b/iu, weight: 0.5 },
  { pattern: /\b(set|series|several|multiple|pack|collection)\b/iu, weight: 0.6 },
  { pattern: /\b(asap|urgent|rush|tonight|today)\b/iu, weight: 0.3 },
  { pattern: /\b(exclusive|private|just for me|only for me)\b/iu, weight: 0.2 },
];

/**
 * How much work a brief asks for, as a multiplier on the base price. A sketch costs less than the
 * base, a detailed scene with two people costs more, and a long brief is more work than a short one.
 *
 * ponytail: keyword signals. A model estimate would read nuance, but quoting runs on the free tick.
 */
export function slurpCommissionComplexity(brief: string): number {
  const words = brief.trim().split(/\s+/u).filter(Boolean).length;
  let factor = 1 + Math.min(0.5, Math.max(0, words - 20) / 160);
  for (const signal of PRICE_SIGNALS) if (signal.pattern.test(brief)) factor += signal.weight;
  return Math.max(0.5, factor);
}

/** The Creator's asking price for one brief, inside its own min–max range. */
export function slurpCommissionQuote(brief: string, pricing: SlurpCommissionPricing): number {
  const min = Math.max(1, Math.min(pricing.commissionMin, pricing.commissionMax));
  const max = Math.max(min, pricing.commissionMax);
  return Math.min(max, Math.max(min, Math.round(pricing.commissionBase * slurpCommissionComplexity(brief))));
}

export type SlurpCreatorHaggleAnswer = { kind: "accept" } | { kind: "meet"; price: number } | { kind: "hold" };

/**
 * A Creator's answer to a counter-offer. Close enough is taken, a lowball or a last round holds the
 * price, and anything between meets the fan halfway without going under the Creator's minimum.
 */
export function slurpCreatorHaggle(input: {
  quote: number;
  offer: number;
  floor: number;
  round: number;
}): SlurpCreatorHaggleAnswer {
  if (input.offer >= input.quote * 0.9 && input.offer >= input.floor) return { kind: "accept" };
  if (input.round >= SLURP_COMMISSION_MAX_HAGGLE_ROUNDS || input.offer < input.floor * 0.75) return { kind: "hold" };
  return { kind: "meet", price: Math.max(input.floor, Math.round((input.quote + input.offer) / 2)) };
}

export type SlurpFanHaggleAnswer = { kind: "accept" } | { kind: "counter"; price: number } | { kind: "decline" };

/**
 * A generated fan's answer to a quote: pay what fits the budget, push back on what is close, and
 * walk away from what is far out of reach. A counter never exceeds the budget, so an accepted
 * counter is always affordable.
 */
export function slurpFanHaggle(input: { quote: number; budget: number; round: number }): SlurpFanHaggleAnswer {
  if (!(input.budget > 0)) return { kind: "decline" };
  if (input.quote <= input.budget) return { kind: "accept" };
  if (input.round >= SLURP_COMMISSION_MAX_HAGGLE_ROUNDS || input.quote > input.budget * 1.8) return { kind: "decline" };
  return { kind: "counter", price: Math.max(1, Math.round(input.budget * (0.85 + 0.05 * input.round))) };
}

/**
 * Where a Creator's price is heading. Popularity lifts it; a paying share of the audience that is
 * high lifts it further, and one that is thin pulls it back.
 *
 * ponytail: fixed 0.5x–3x band around the Settings default. Per-Creator bounds if players ask.
 */
export function slurpDynamicPriceTarget(base: number, demand: { followers: number; subscribers: number }): number {
  const popularity = 0.7 + 0.3 * Math.log10(1 + Math.max(0, demand.followers));
  const conversion = demand.followers > 0 ? demand.subscribers / demand.followers : 0;
  const pull = conversion >= 0.15 ? 1.15 : conversion < 0.03 ? 0.9 : 1;
  return Math.round(Math.min(base * 3, Math.max(base * 0.5, base * popularity * pull)));
}

/** One weekly step toward a target, never more than `maxChangePercent` of the current price. */
export function slurpStepPrice(current: number, target: number, maxChangePercent: number): number {
  if (maxChangePercent <= 0 || current === target) return current;
  const step = Math.max(1, Math.round((current * maxChangePercent) / 100));
  return target > current ? Math.min(target, current + step) : Math.max(target, current - step);
}

/** The range a subscription price may occupy, matching `walletSubscriptionCost` in Settings. */
export const SLURP_SUBSCRIPTION_PRICE_MIN = 0;
export const SLURP_SUBSCRIPTION_PRICE_MAX = 9999;

/**
 * What a *new* subscription costs right now: the Creator's price with the modifiers active at `at`
 * applied, rounded once and clamped back into the allowed range.
 *
 * Economy's whole side of the modifier seam. It depends on the provider interface, never on World,
 * so it neither knows nor cares that platform events are what is currently moving the number.
 *
 * Rounding happens once, at the end, so two modifiers cannot compound two rounding errors. An
 * existing subscription never comes through here: it keeps the price it agreed to and renews at
 * that stored price.
 */
export function slurpSubscriptionCharge(basePrice: number, modifiers: SlpActiveModifierProvider, at: Date): number {
  const modified = slpApplyModifiers(
    basePrice,
    modifiers.modifiersFor("economy.subscription-price", at),
    "economy.subscription-price",
  );
  if (!Number.isFinite(modified)) return basePrice;
  return Math.min(SLURP_SUBSCRIPTION_PRICE_MAX, Math.max(SLURP_SUBSCRIPTION_PRICE_MIN, Math.round(modified)));
}
