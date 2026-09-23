/** Stable offer placement keeps one post eligible across reloads and viewer personas. */
export function slpHasGambleOffer(postId: string): boolean {
  let hash = 0x811c9dc5;
  for (let index = 0; index < postId.length; index += 1) {
    hash ^= postId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) % 3 === 0;
}

/** Each gamble unlocks this post, for free or for three times its normal price. */
export function slpGambleUnlockPrice(basePrice: number, free: boolean): number {
  return free ? 0 : basePrice * 3;
}

/** Price display data for future creator-feed events. Callbacks stay owned by the host feature. */
export type SlpDiscountOffer = {
  oldPrice: number;
  newPrice: number;
  label: string;
};
