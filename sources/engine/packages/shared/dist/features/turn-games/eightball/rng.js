// ──────────────────────────────────────────────
// Deterministic seeded RNG
// ──────────────────────────────────────────────
// Post-v2 physics rewrite, `deterministicRng` is used ONLY for bot aim
// jitter (see engine.ts's `convertMenuToAim`) — shot outcomes come from the
// physics simulation, not a roll. It's still keyed on (seed, shotCounter) so
// that jitter is reproducible: the cursor is `state.shotCounter`, incremented
// on every applyMove, so rewinding to shot N and replaying from the same seed
// resolves the identical jitter for that shot — this is what lets message
// edits / regenerations rewind the game correctly. Intentionally independent
// of dice.service.ts (which uses unseeded Math.random).
//
// This is a copy of poker/rng.ts (uno/rng.ts is the 2nd copy) — the 3rd
// instance of this exact seeded-PRNG pattern. Kept as a copy rather than a
// shared util so each game's randomness stream stays trivially auditable in
// isolation (see poker/rng.ts for the same note).
/** mulberry32: tiny, fast, well-distributed 32-bit PRNG. Returns a [0,1) stream. */
export function mulberry32(seed) {
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
 * stream, so one "randomness draw" (a full shot's resolution) costs exactly one
 * cursor tick regardless of how many random numbers it internally consumes.
 */
export function deriveSubSeed(seed, cursor) {
    let z = (seed + Math.imul(cursor + 1, 0x9e3779b9)) >>> 0;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    return (z ^ (z >>> 15)) >>> 0;
}
/** Fisher-Yates using the supplied [0,1) generator. Returns a NEW array; does not mutate input. */
export function shuffleWith(items, rng) {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
    }
    return out;
}
/** Deterministically shuffle `items` from (seed, cursor). Pure. Unused by 8-ball
 * today (there's no deck to shuffle) but kept for parity with the poker/uno
 * copies of this file — a future house rule (e.g. randomized rack fill order)
 * can reach for it without adding a 4th copy elsewhere. */
export function deterministicShuffle(items, seed, cursor) {
    return shuffleWith(items, mulberry32(deriveSubSeed(seed, cursor)));
}
/** The per-shot rng stream: one call per applyMove, keyed on the shot cursor. */
export function deterministicRng(seed, shotCounter) {
    return mulberry32(deriveSubSeed(seed, shotCounter));
}
//# sourceMappingURL=rng.js.map