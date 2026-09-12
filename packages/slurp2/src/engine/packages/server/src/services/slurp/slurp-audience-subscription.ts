/**
 * When somebody in the audience starts paying, keeps paying, or stops.
 *
 * Pure and deterministic, like the other Slurp rule modules beside it.
 *
 * The funnel already carried a `subscriber` stage and nothing could ever reach it. `subscribe()`
 * in the storage begins with `getViewer(...)`, so only a player persona — an account row — could
 * hold a subscription, and the generated audience is deliberately account-less. The result was a
 * platform where the six ambient profiles were the only people who could ever pay.
 *
 * An audience member holds no wallet. They are not a viewer and they buy nothing else, so there is
 * no balance to debit and none is invented here: the money they pay is credited to the Creator and
 * that is the whole of the transaction. The audience commission path already settles money this
 * way for the same reason.
 *
 * This module decides only. Writing rows, crediting earnings, and recording events belong to the
 * world tick, which is the one place allowed to advance time.
 */

import type { SlurpSpendTier } from "./slurp-population.js";
import { SLURP_FUNNEL_STAGES, type SlurpFunnelStage } from "./slurp-population.js";

/**
 * What one person will spend on one Creator in a week, by appetite.
 *
 * The same appetite the commission settlement reads, and for the same reason: a crowd where
 * everybody pays is neither believable nor interesting, because then the few who do pay stop
 * meaning anything. `none` is the majority of the population and never subscribes.
 */
export const SLURP_AUDIENCE_WEEKLY_BUDGET: Record<SlurpSpendTier, number> = {
  none: 0,
  light: 20,
  regular: 60,
  whale: 200,
};

/** A subscription is billed a week at a time, matching the viewer-side subscription period. */
export const SLURP_AUDIENCE_SUBSCRIPTION_DAYS = 7;

/**
 * How likely a follower who can afford the price is to convert in one day.
 *
 * Low on purpose. A follower list that empties into the subscriber list within a week is not a
 * funnel, it is a queue, and the movement is what the player is supposed to be able to read.
 */
const DAILY_CONVERSION_CHANCE: Record<SlurpSpendTier, number> = {
  none: 0,
  light: 0.02,
  regular: 0.05,
  whale: 0.12,
};

export type SlurpAudienceSubscriptionSubject = {
  memberId: string;
  creatorAccountId: string;
  stage: SlurpFunnelStage;
  spendTier: SlurpSpendTier;
  /** The Creator's weekly price, in coins. */
  price: number;
  /** When the current subscription is paid up to, or null for somebody who has never paid. */
  paidThroughAt: string | null;
};

export type SlurpAudienceSubscriptionDecision = "subscribe" | "renew" | "lapse" | "none";

const FOLLOWER_INDEX = SLURP_FUNNEL_STAGES.indexOf("follower");
const SUBSCRIBER_INDEX = SLURP_FUNNEL_STAGES.indexOf("subscriber");

/**
 * The whole decision, from state the caller already holds.
 *
 * Deterministic in `(memberId, creatorAccountId, day)`. The catch-up path advances the world on
 * every notifications read, so an undecided roll would flip this person's answer between two page
 * loads of the same day — the jitter the plan forbids, and here it would mean money appearing and
 * disappearing.
 */
export function slurpAudienceSubscriptionDecision(
  subject: SlurpAudienceSubscriptionSubject,
  at: Date,
): SlurpAudienceSubscriptionDecision {
  const budget = SLURP_AUDIENCE_WEEKLY_BUDGET[subject.spendTier] ?? 0;
  const price = Math.max(0, Math.floor(subject.price));
  const affordable = budget > 0 && price <= budget;
  const paidThrough = subject.paidThroughAt ? Date.parse(subject.paidThroughAt) : NaN;
  const subscribed = Number.isFinite(paidThrough);

  if (subscribed) {
    // Still inside the paid week. Nothing is owed and nothing is decided.
    if (at.getTime() < paidThrough) return "none";
    // The price went past what this person will pay, or they were priced in and are not any more.
    // Somebody leaving because the Creator raised the price is a readable reason to leave.
    return affordable ? "renew" : "lapse";
  }

  if (!affordable) return "none";
  // Only a follower converts. Somebody who has liked one post is not about to start paying, and a
  // stage is never skipped: the funnel is the thing the player reads.
  const stageIndex = SLURP_FUNNEL_STAGES.indexOf(subject.stage as (typeof SLURP_FUNNEL_STAGES)[number]);
  if (stageIndex < FOLLOWER_INDEX || stageIndex >= SUBSCRIBER_INDEX) return "none";
  const chance = DAILY_CONVERSION_CHANCE[subject.spendTier] ?? 0;
  return roll(`${subject.memberId}:${subject.creatorAccountId}:${dayKey(at)}`) < chance ? "subscribe" : "none";
}

/** The UTC day, so every read inside one day rolls the same answer. */
function dayKey(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * FNV-1a with the murmur3 finalizer, as `slurp-reach.ts` uses and for its reason: plain FNV-1a
 * barely avalanches its last byte, and these keys differ only in their last few characters, so
 * without the mix a whole cast would roll nearly the same number on the same day.
 */
function roll(key: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

/** When a payment made now runs out. */
export function slurpAudiencePaidThrough(at: Date): string {
  return new Date(at.getTime() + SLURP_AUDIENCE_SUBSCRIPTION_DAYS * 86_400_000).toISOString();
}
