import { spendHours } from "./clock.js";
import { METERS } from "./types.js";
import type { Meters, Run } from "./types.js";

export const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function applyDelta(m: Meters, delta: Partial<Meters>): Meters {
  const out = { ...m };
  for (const k of METERS) out[k] = clamp(out[k] + (delta[k] ?? 0));
  return out;
}

// Public functions are pure: they edit a copy and return it. `fn` mutates the draft.
export const pure =
  <A extends unknown[]>(fn: (s: Run, ...a: A) => void) =>
  (state: Run, ...a: A): Run => {
    const s = structuredClone(state);
    fn(s, ...a);
    return s;
  };

export const newId = (s: Run, prefix: string) => `${prefix}${++s.nextId}`;
export const spendHour = (s: Run, n = 1) => void (s.clock = spendHours(s.clock, n));

export function addTrust(s: Run, id: string, d: number) {
  const p = s.people[id];
  if (p) p.trust = clamp(p.trust + d);
}
