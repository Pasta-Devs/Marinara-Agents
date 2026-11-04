// Seeded RNG (mulberry32 step, same as the balance sim). The seed lives in the run state (`rng`),
// so a snapshot replays exactly. `roll` advances the handle: call it only on a draft copy.
export function roll(h: { rng: number }): number {
  h.rng = (h.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(h.rng ^ (h.rng >>> 15), 1 | h.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const pick = <T>(h: { rng: number }, list: readonly T[]): T => list[Math.floor(roll(h) * list.length)]!;
