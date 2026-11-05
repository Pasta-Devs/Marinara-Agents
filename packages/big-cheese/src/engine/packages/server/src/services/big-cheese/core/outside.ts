// Big Cheese: out of the office (modules.md section 4, design.md 10.1, M4 plan T14).
// After-work invitations are free evening scenes, a walk costs 1 hour, a trip 2 hours and one a week.
// The scenes are the big-scene blueprints trip, after_work and walk; this file picks the people and
// settles the outcome. Scene ids tell which scene it was, so a run needs no new field.
import { dayIndex, slot } from "./clock.js";
import { addTrust } from "./run.js";
import type { Run, Thread } from "./types.js";

export const WALK_HOURS = 1;
export const TRIP_HOURS = 2;
const TRUST = 4;

export const tripId = (c: { week: number }) => `out-trip-${c.week}`;
export const afterId = (c: { week: number; day: number }) => `out-after-${c.week}-${c.day}`;
export const walkId = (c: { week: number; day: number; hoursLeft: number }) =>
  `out-walk-${c.week}-${c.day}-${c.hoursLeft}`;

/** The blueprints read their people and room from a thread; this one is only a carrier. */
export const stage = (people: string[], room: string) => ({ people, title: room }) as Thread;

/** Tonight's invitation: every third evening, from a host and up to 2 guests. Null when none. */
export function invitation(s: Run, scenes: Record<string, unknown>): { host: string; people: string[] } | null {
  const ids = Object.keys(s.people).sort();
  const idx = dayIndex(s.clock);
  if (ids.length < 2 || idx % 3 !== 1) return null;
  if (slot(s.clock) !== "evening" && slot(s.clock) !== "night") return null;
  if (Object.hasOwn(scenes, afterId(s.clock))) return null;
  const people = Array.from(new Set([0, 1, 2].map((i) => ids[(idx + i) % ids.length]!)));
  return { host: people[0]!, people };
}

/** The scene is over: going gives the host and guests trust, declining gives nothing and costs nothing. */
export function finishOutside(s: Run, scene: { blueprint: string; people: string[]; parts: { chosen?: string }[] }) {
  const pick = scene.parts[scene.parts.length - 1]?.chosen;
  if (scene.blueprint === "after_work") {
    if (pick !== "go") return "You decline and go home. Nobody holds it against you.";
    for (const p of scene.people) addTrust(s, p, TRUST);
    return "You went along. The people at the table trust you a little more.";
  }
  const d = scene.blueprint === "trip" ? (pick === "easy" ? TRUST : 2) : pick === "listen" ? 3 : 2;
  for (const p of scene.people) addTrust(s, p, d);
  return scene.blueprint === "trip" ? "The trip is over. People talk about it for days." : "The walk is over.";
}
