/**
 * Deterministic weighted choice, seeded per post.
 *
 * ## The problem this replaces
 *
 * The shipped rotations stepped through a fixed list one place at a time. That guarantees
 * consecutive posts differ, which is what it was built for, but it has two consequences nobody
 * wanted.
 *
 * The first is that a rare thing cannot be rare. `PLACES` has six entries, so "in the room they
 * spend the least time in" fires every sixth post, forever. A Creator who is supposedly never in
 * that room is in it constantly, and on a fixed schedule. The same arithmetic made every Creator
 * "alone and not glad of it" every fifth post. Putting something unusual in a short rotation turns
 * it into a habit.
 *
 * The second is that guaranteeing difference is itself artificial. Real people post two selfies in
 * a row, and two dull days in a row. Forced alternation reads as a schedule as clearly as
 * repetition does.
 *
 * ## The approach
 *
 * Draw instead of rotate. The draw is seeded on the creator and the post count, so it is fully
 * deterministic and reproducible, but the sequence has no period: consecutive posts are unrelated
 * rather than adjacent. Weights then say how often each option should actually appear, so the
 * ordinary stays ordinary and the rare stays rare no matter how long a Creator runs.
 */

/** FNV-1a with a final avalanche, matching the hash the older rotations use. */
function hash(value: string): number {
  let out = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 0x01000193);
  }
  out ^= out >>> 16;
  out = Math.imul(out, 0x85ebca6b);
  out ^= out >>> 13;
  return out >>> 0;
}

export type SlurpWeighted<T> = { value: T; weight: number };

/**
 * One option, chosen by weight.
 *
 * `axis` keeps two different decisions about the same post from moving together: seeded on the
 * post count alone, the camera and the content type would be perfectly correlated for the life of
 * the account.
 *
 * A bad post count is floored to zero at the boundary rather than trusted, as the rotations did:
 * `Math.floor(NaN)` indexes nothing and would hand the caller `undefined`.
 */
export function slurpWeightedPick<T>(
  axis: string,
  seed: string,
  sequence: number,
  options: readonly SlurpWeighted<T>[],
): T {
  const usable = options.filter((option) => option.weight > 0);
  if (usable.length === 0) throw new Error(`slurpWeightedPick: no options with weight on axis "${axis}"`);
  const step = Number.isFinite(sequence) ? Math.max(0, Math.floor(sequence)) : 0;
  const total = usable.reduce((sum, option) => sum + option.weight, 0);
  // Scaled before the modulus so that weights finer than the bucket count still separate.
  let ticket = ((hash(`${axis}#${seed}#${step}`) % 1_000_000) / 1_000_000) * total;
  for (const option of usable) {
    ticket -= option.weight;
    if (ticket < 0) return option.value;
  }
  return usable[usable.length - 1]!.value;
}
