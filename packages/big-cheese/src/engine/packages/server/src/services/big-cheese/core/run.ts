import { spendHours } from "./clock.js";
import { METERS } from "./types.js";
import type { Meters, Run } from "./types.js";

export const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** `hard` is the run's difficulty factor (design.md 4.1); it scales losses only, so Easy never shrinks a gain. */
export function applyDelta(m: Meters, delta: Partial<Meters>, hard = 1): Meters {
  const out = { ...m };
  for (const k of METERS) {
    const d = delta[k] ?? 0;
    out[k] = clamp(out[k] + (d < 0 ? Math.round(d * hard) : d));
  }
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
  const p = Object.hasOwn(s.people, id) ? s.people[id] : undefined;
  if (p) p.trust = clamp(p.trust + d);
}
