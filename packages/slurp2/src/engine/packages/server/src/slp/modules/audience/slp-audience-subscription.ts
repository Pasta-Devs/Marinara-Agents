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

import { slurpBuiltinFanTypeForTier } from "./slp-fan-types.js";
import type { SlurpSpendTier } from "./slp-population.js";
import { SLURP_FUNNEL_STAGES, type SlurpFunnelStage } from "./slp-population.js";
import { SLURP_REALISTIC_TUNING, type SlurpSimulationTuning } from "../../base/model/slp-tuning.js";

/**
 * What one person will spend on one Creator in a week, by appetite.
 *
 * The same appetite the commission settlement reads, and for the same reason: a crowd where
 * everybody pays is neither believable nor interesting, because then the few who do pay stop
 * meaning anything. `none` is the majority of the population and never subscribes.
 */
export const SLURP_AUDIENCE_WEEKLY_BUDGET: Record<SlurpSpendTier, number> = tierTable((type) => {
  const [low, high] = type.spend.weeklyBudget;
  return (low + high) / 2;
});

/** A subscription is billed a week at a time, matching the viewer-side subscription period. */
export const SLURP_AUDIENCE_SUBSCRIPTION_DAYS = 7;

/**
 * How likely a follower who can afford the price is to convert in one day.
 *
 * Low on purpose. A follower list that empties into the subscriber list within a week is not a
 * funnel, it is a queue, and the movement is what the player is supposed to be able to read.
 */
const DAILY_CONVERSION_CHANCE: Record<SlurpSpendTier, number> = tierTable((type) => type.funnel.subConversionPerDay);

/**
 * A tier table read off the built-in Fan Types rather than written out again.
 *
 * These numbers used to be two literals here. They are a Fan Type's business now, and a caller
 * that knows the member's type passes its values directly; this only answers for a caller that
 * still has nothing but a tier, so it must not drift from the built-ins it stands for.
 */
function tierTable(read: (type: NonNullable<ReturnType<typeof slurpBuiltinFanTypeForTier>>) => number) {
  const table = { none: 0, light: 0, regular: 0, whale: 0 } as Record<SlurpSpendTier, number>;
  for (const tier of Object.keys(table) as SlurpSpendTier[]) {
    const type = slurpBuiltinFanTypeForTier(tier);
    if (type) table[tier] = read(type);
  }
  return table;
}

export type SlurpAudienceSubscriptionSubject = {
  memberId: string;
  creatorAccountId: string;
  stage: SlurpFunnelStage;
  spendTier: SlurpSpendTier;
  /**
   * This member's own weekly budget, from their Fan Type. Falls back to the tier's built-in value
   * for a caller that has not resolved a type — ambient accounts, and the older tests.
   */
  weeklyBudget?: number;
  /** This member's own daily conversion chance, from their Fan Type. */
  subConversionPerDay?: number;
  /** The Creator's weekly price, in coins. */
  price: number;
  /** When the current subscription is paid up to, or null for somebody who has never paid. */
  paidThroughAt: string | null;
  /** Engagement with this Creator, for `funnel.conversionGrowth`. Missing reads as none. */
  interactions?: number;
  /** When they became a follower. Null for a tie that predates the column. */
  followedAt?: string | null;
  /** The Fan Type's `funnel.renewChance`. Missing reads as 1: everybody affordable renews. */
  renewChance?: number;
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
  funnel: Pick<SlurpSimulationTuning["funnel"], "rollCadence" | "conversionGrowth"> = SLURP_REALISTIC_TUNING.funnel,
): SlurpAudienceSubscriptionDecision {
  const budget = subject.weeklyBudget ?? SLURP_AUDIENCE_WEEKLY_BUDGET[subject.spendTier] ?? 0;
  const price = Math.max(0, Math.floor(subject.price));
  const affordable = budget > 0 && price <= budget;
  const paidThrough = subject.paidThroughAt ? Date.parse(subject.paidThroughAt) : NaN;
  const subscribed = Number.isFinite(paidThrough);

  if (subscribed) {
    // Still inside the paid week. Nothing is owed and nothing is decided.
    if (at.getTime() < paidThrough) return "none";
    // The price went past what this person will pay, or they were priced in and are not any more.
    // Somebody leaving because the Creator raised the price is a readable reason to leave.
    if (!affordable) return "lapse";
    // Not everybody renews just because they can. Rolled on the same key as the conversion roll, so
    // the answer is stable inside a bucket rather than flipping between two page loads.
    const renewChance = subject.renewChance ?? 1;
    if (renewChance >= 1) return "renew";
    const renewKey = slurpAudienceRollKey(at, funnel.rollCadence);
    return roll(`renew:${subject.memberId}:${subject.creatorAccountId}:${renewKey}`) < renewChance ? "renew" : "lapse";
  }

  if (!affordable) return "none";
  // Only a follower converts. Somebody who has liked one post is not about to start paying, and a
  // stage is never skipped: the funnel is the thing the player reads.
  const stageIndex = SLURP_FUNNEL_STAGES.indexOf(subject.stage as (typeof SLURP_FUNNEL_STAGES)[number]);
  if (stageIndex < FOLLOWER_INDEX || stageIndex >= SUBSCRIBER_INDEX) return "none";
  const followedAt = subject.followedAt ? Date.parse(subject.followedAt) : NaN;
  const chance = slurpAudienceConversionChance(
    subject.spendTier,
    funnel.conversionGrowth,
    subject.interactions ?? 0,
    Number.isFinite(followedAt) ? (at.getTime() - followedAt) / 86_400_000 : 0,
    subject.subConversionPerDay,
  );
  const key = slurpAudienceRollKey(at, funnel.rollCadence);
  return roll(`${subject.memberId}:${subject.creatorAccountId}:${key}`) < chance ? "subscribe" : "none";
}

/**
 * The chance for one roll. `growth` 0 is the flat tier chance; above that, engagement and time
 * following raise it, up to three times the tier chance and never past 0.95.
 */
export function slurpAudienceConversionChance(
  spendTier: SlurpSpendTier,
  growth: number,
  interactions: number,
  daysFollowing: number,
  subConversionPerDay?: number,
): number {
  const base = subConversionPerDay ?? DAILY_CONVERSION_CHANCE[spendTier] ?? 0;
  if (!(growth > 0) || base === 0) return base;
  const engaged = Math.min(1, Math.max(0, interactions) / 20 + Math.max(0, daysFollowing) / 30);
  return Math.min(0.95, base * Math.min(3, 1 + growth * engaged));
}

/** The UTC day (or hour), so every read inside one bucket rolls the same answer. */
export function slurpAudienceRollKey(at: Date, cadence: "daily" | "hourly"): string {
  return at.toISOString().slice(0, cadence === "hourly" ? 13 : 10);
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

/** Reserve one payment inside a fan's rolling seven-day spending window. */
export function slurpAudienceWeeklySpend(
  current: { spent: number; startedAt: string | null },
  amount: number,
  budget: number,
  at: Date,
): { spent: number; startedAt: string } | null {
  if (!Number.isInteger(amount) || amount <= 0 || !Number.isFinite(budget) || amount > budget) return null;
  const started = current.startedAt ? Date.parse(current.startedAt) : Number.NaN;
  const fresh = !Number.isFinite(started) || at.getTime() - started >= SLURP_AUDIENCE_SUBSCRIPTION_DAYS * 86_400_000;
  const spent = fresh ? 0 : Math.max(0, Math.floor(current.spent));
  if (spent + amount > budget) return null;
  return { spent: spent + amount, startedAt: fresh ? at.toISOString() : current.startedAt! };
}

/**
 * Why this person stopped paying.
 *
 * Pure, and deliberately the same three answers the copy bank writes lines for. Price comes first
 * because it is the one the player can act on: somebody who left because the subscription got
 * expensive is a different fact from somebody who drifted away, and a loss with no reason on it is
 * a number, not an event.
 */
export function slurpLapseReason(input: {
  weeklyBudget: number;
  price: number;
  /** Days since this person last did anything with this Creator. */
  daysSinceSeen: number;
}): "price" | "quiet" | "drift" {
  if (input.weeklyBudget > 0 && Math.max(0, Math.floor(input.price)) > input.weeklyBudget) return "price";
  return input.daysSinceSeen >= 7 ? "quiet" : "drift";
}
