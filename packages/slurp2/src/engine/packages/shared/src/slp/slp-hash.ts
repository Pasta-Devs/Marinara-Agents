/**
 * The string hashes Slurp's rule modules share. Picks, rotations and seeds are stored or compared across
 * versions, so each function must keep its exact output: change one and old picks move.
 */

/** FNV-1a with a final avalanche, as the older rotations use. */
export function slpHashMix(value: string): number {
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

/**
 * FNV-1a with the full murmur3 finalizer. Plain FNV-1a barely avalanches its last byte, and seeds here are
 * sequential, so without it consecutive members would come out nearly identical.
 */
export function slpHashFmix(value: string): number {
  let out = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 0x01000193);
  }
  out ^= out >>> 16;
  out = Math.imul(out, 0x85ebca6b);
  out ^= out >>> 13;
  out = Math.imul(out, 0xc2b2ae35);
  out ^= out >>> 16;
  return out >>> 0;
}

/** The Java-style string hash, made positive. Not cryptographic; it only needs to be stable per input. */
export function slpStringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
