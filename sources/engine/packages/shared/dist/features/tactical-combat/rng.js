// ──────────────────────────────────────────────
// Tactical Combat — deterministic seeded RNG
// ──────────────────────────────────────────────
// Same seeded-PRNG pattern as the turn-games (poker/uno/eightball each keep
// their own copy — this is the tactical-combat copy, kept local so the combat
// randomness stream stays trivially auditable in isolation). ALL randomness in
// the engine is drawn via `deriveSubSeed(state.seed, state.actionCounter++)`:
// every resolved sub-roll (one attack, one counter, one AI decision, one grid
// blob) costs exactly one cursor tick, so the same seed + same action sequence
// always reproduces the identical battle — rewind-safe and refresh-safe.
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
 * stream, so one "randomness draw" costs exactly one cursor tick regardless of
 * how many random numbers it internally consumes.
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
/** Deterministically shuffle `items` from (seed, cursor). Pure. */
export function deterministicShuffle(items, seed, cursor) {
    return shuffleWith(items, mulberry32(deriveSubSeed(seed, cursor)));
}
/** The per-draw rng stream: keyed on the action cursor. */
export function deterministicRng(seed, actionCounter) {
    return mulberry32(deriveSubSeed(seed, actionCounter));
}
//# sourceMappingURL=rng.js.map