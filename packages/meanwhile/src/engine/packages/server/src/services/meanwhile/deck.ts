/** The seed deck. Pure: same input, same cards. Slice 3 turns each seed into a beat with the model. */
import { DAY, hhmm, shiftDay } from "./clock.js";

/** A block of one character's day, in minutes since midnight. `end` may pass 1440. */
export interface DayBlock {
  start: number;
  end: number;
  activity: string;
  place: string;
}

export interface Seed {
  id: string;
  circleId: string;
  day: string;
  kind: string;
  cast: string[];
  place: string;
  time: string;
  status: "dealt";
}

export const KINDS = ["work", "friends", "family", "romance", "conflict", "health", "luck", "hobbies"];
export const BIG_KINDS = ["death", "breakup", "pregnancy", "moving away", "job loss", "serious injury"];
const SOLO = new Set(["health", "luck", "hobbies", ...BIG_KINDS.filter((kind) => kind !== "breakup")]);
const MEET_PLACES = ["cafe", "bar", "park", "shop", "gym"];
const COOLDOWN_DAYS = 7;

// Seeds per day, chance of a big kind per seed, and kind weights (default 1).
const PACE: Record<string, { min: number; max: number; big: number; weights: Record<string, number> }> = {
  cozy: { min: 2, max: 3, big: 0.01, weights: { conflict: 0.3, health: 0.3 } },
  eventful: { min: 3, max: 4, big: 0.03, weights: {} },
  dramatic: { min: 4, max: 5, big: 0.06, weights: { conflict: 2, romance: 1.5 } },
};

// Same generator as slurp2's world plan (slp-world.ts), copied because packages cannot import each other.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(value: string): number {
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

interface Option {
  cast: string[];
  place: string;
  time: string;
}

/** Pairs whose blocks overlap for 30 minutes or more at the same place. Home and unknown never count. */
function meetings(blocks: Record<string, DayBlock[]>): Option[] {
  const ids = Object.keys(blocks);
  const out: Option[] = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      for (const a of blocks[ids[i]!]!) {
        for (const b of blocks[ids[j]!]!) {
          if (a.place !== b.place || a.place === "home" || a.place === "unknown") continue;
          const start = Math.max(a.start, b.start);
          if (Math.min(a.end, b.end) - start < 30) continue;
          out.push({ cast: [ids[i]!, ids[j]!], place: a.place, time: hhmm(start) });
        }
      }
    }
  }
  return out;
}

export function dealDay(input: {
  circle: { id: string; pace: string; allowedKinds: string[]; bigKindsAllowed: string[] };
  day: string;
  blocks: Record<string, DayBlock[]>;
  recent: readonly Seed[];
}): Seed[] {
  const { circle, day, blocks } = input;
  const rng = mulberry32(hashSeed(`${circle.id}:${day}`));
  const pace = PACE[circle.pace] ?? PACE.cozy!;
  // Empty means every plain kind. Spicy only runs when the user picks it.
  const kinds = (circle.allowedKinds.length ? circle.allowedKinds : KINDS).filter((k) => !BIG_KINDS.includes(k));
  const big = circle.bigKindsAllowed.filter((k) => BIG_KINDS.includes(k));
  const ids = Object.keys(blocks);
  const keyOf = (kind: string, o: Option) => `${kind}|${[...o.cast].sort().join(",")}|${o.place}`;
  const cutoff = shiftDay(day, -COOLDOWN_DAYS);
  const seen = new Set(
    input.recent.filter((s) => s.circleId === circle.id && s.day >= cutoff).map((s) => keyOf(s.kind, s)),
  );
  const out: Seed[] = [];
  const add = (kind: string, o: Option, id = `${circle.id}:${day}:${out.length}`) => {
    seen.add(keyOf(kind, o));
    out.push({ id, circleId: circle.id, day, kind, ...o, status: "dealt" });
  };

  const pairs = meetings(blocks);
  const count = pace.min + Math.floor(rng() * (pace.max - pace.min + 1));
  for (let i = 0; i < count; i += 1) {
    let kind: string | undefined;
    if (big.length && rng() < pace.big) kind = big[Math.floor(rng() * big.length)];
    else if (kinds.length) {
      const weights = kinds.map((k) => pace.weights[k] ?? 1);
      let roll = rng() * weights.reduce((a, b) => a + b, 0);
      kind = kinds.find((_, n) => (roll -= weights[n]!) < 0) ?? kinds[kinds.length - 1];
    }
    if (!kind) continue;
    const options = SOLO.has(kind)
      ? ids.flatMap((id) =>
          blocks[id]!.filter((b) => !/sleep/.test(b.activity)).map((b) => ({
            cast: [id],
            place: b.place,
            time: hhmm(b.start),
          })),
        )
      : pairs;
    const usable = options.filter((o) => !seen.has(keyOf(kind!, o)));
    if (usable.length) add(kind, usable[Math.floor(rng() * usable.length)]!);
  }

  // One extra random pair per Circle week, on a weekday picked from the week number.
  const dayIndex = Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY);
  const wildcardKind = kinds.find((k) => !SOLO.has(k));
  if (
    ids.length >= 2 &&
    wildcardKind &&
    hashSeed(`${circle.id}:w${Math.floor((dayIndex + 3) / 7)}`) % 7 === (dayIndex + 3) % 7
  ) {
    const r = mulberry32(hashSeed(`${circle.id}:${day}:w`));
    const a = Math.floor(r() * ids.length);
    let b = Math.floor(r() * (ids.length - 1));
    if (b >= a) b += 1;
    const o = { cast: [ids[a]!, ids[b]!], place: MEET_PLACES[Math.floor(r() * MEET_PLACES.length)]!, time: "18:00" };
    if (!seen.has(keyOf(wildcardKind, o))) add(wildcardKind, o, `${circle.id}:${day}:w`);
  }
  return out;
}
