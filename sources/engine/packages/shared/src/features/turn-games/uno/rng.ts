// ──────────────────────────────────────────────
// Deterministic seeded RNG
// ──────────────────────────────────────────────
// All UNO randomness flows through here so deals/reshuffles are reproducible
// from (seed, cursor). This is what lets message edits / regenerations rewind
// the game correctly — replaying from a snapshot yields the identical deck.
// Intentionally independent of dice.service.ts (which uses unseeded Math.random).

/** mulberry32: tiny, fast, well-distributed 32-bit PRNG. Returns a [0,1) stream. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derive an independent 32-bit sub-seed from a base seed and a cursor position,
 * via splitmix32 finalization. Each distinct cursor yields an uncorrelated
 * stream, so one "randomness draw" (a full shuffle) costs exactly one cursor
 * tick regardless of how many random numbers it internally consumes.
 */
export function deriveSubSeed(seed: number, cursor: number): number {
  let z = (seed + Math.imul(cursor + 1, 0x9e3779b9)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
  return (z ^ (z >>> 15)) >>> 0;
}

/** Fisher-Yates using the supplied [0,1) generator. Returns a NEW array; does not mutate input. */
export function shuffleWith<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** Deterministically shuffle `items` from (seed, cursor). Pure. */
export function deterministicShuffle<T>(items: readonly T[], seed: number, cursor: number): T[] {
  return shuffleWith(items, mulberry32(deriveSubSeed(seed, cursor)));
}
