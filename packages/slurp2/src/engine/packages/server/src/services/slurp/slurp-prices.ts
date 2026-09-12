/**
 * Fictional NoodleR prices. They are presentation only: nothing is debited, no balance is shown,
 * and access is never gated on funds. Both were affordability gates until 1.0.12 — an exhausted
 * wallet made unlock and subscribe silently return null — which is the opposite of the intended
 * roleplay, where unlocking is a character moment rather than a budget decision.
 *
 * Kept in its own module so the price rules can be unit-tested without an Engine checkout;
 * noodle.storage.ts pulls in the file-native DB layer and cannot be imported standalone.
 */

export const NOODLER_UNLOCK_COST = 1;
export const NOODLER_SUBSCRIPTION_COST = 5;

/** Post metadata key holding a post's own unlock price, so an edited price survives a refresh. */
const NOODLER_UNLOCK_PRICE_METADATA_KEY = "noodlerUnlockPrice";

/**
 * A post's unlock price. Stored on the post at creation; posts written before the field existed
 * read the shipped default, so no backfill pass is needed and an explicit price always wins.
 * Imported or hand-edited state can carry anything, so a non-integer or negative value falls
 * back rather than rendering as NaN.
 */
export function noodlerUnlockPriceFromMetadata(metadata: Record<string, unknown> | null | undefined): number {
  const stored = metadata?.[NOODLER_UNLOCK_PRICE_METADATA_KEY];
  return typeof stored === "number" && Number.isInteger(stored) && stored >= 0 ? stored : NOODLER_UNLOCK_COST;
}

/** Metadata patch that stores the current default price on a newly created locked post. */
export function noodlerUnlockPriceMetadata(price: number = NOODLER_UNLOCK_COST): Record<string, unknown> {
  return { [NOODLER_UNLOCK_PRICE_METADATA_KEY]: price };
}
