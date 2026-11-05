// Big Cheese: in-run wishes (design.md 3.7). A wish costs 1-3 points, 3 points per term, no limit in
// Sandbox. The code opens a `wish` thread with `cost` card beats; the model only wrote the words.
import { WEEKS } from "./clock.js";
import { pure, newId } from "./run.js";
import { pick } from "./rng.js";
import { openStory } from "./threads.js";
import type { Meter, Run, Severity } from "./types.js";

export interface WishPlan {
  cost: number; // 1-3
  title: string;
  stakes: string;
  people: string[];
  need: Meter;
  severity: Severity;
}

/** The people the wish may name: active ones in this run. The first one asks on the cards. */
export function wishPeople(s: Run, ids: string[]): string[] {
  const active = (id: string) => Object.hasOwn(s.people, id) && s.people[id]!.status === "active";
  const named = [...new Set(ids)].filter(active).slice(0, 3);
  const any = Object.keys(s.people).filter(active);
  return named.length || !any.length ? named : [pick(s, any)];
}

/** Spends the points and plans one card per point, one a week from next week. */
export function openWish(s: Run, w: WishPlan) {
  if (s.status !== "playing") throw new Error("This run is over.");
  if (!(w.cost >= 1 && w.cost <= 3)) throw new Error("A wish costs 1 to 3 points.");
  if (!w.people.length) throw new Error("Nobody is here to ask.");
  if (s.mode !== "sandbox") {
    if (s.wishPoints.left < w.cost) throw new Error("Not enough wish points.");
    s.wishPoints.left -= w.cost;
  }
  const t = openStory(s, "wish", {
    title: w.title,
    stakes: w.stakes,
    people: w.people,
    need: w.need,
    severity: w.severity,
    origin: "wish",
  });
  const week = (i: number) => Math.min(WEEKS, s.clock.week + 1 + i);
  t.beats = Array.from({ length: w.cost }, (_, i) => ({
    id: newId(s, "b"),
    type: "card" as const,
    planned: { week: week(i), day: s.clock.day },
    seed: { need: w.need, severity: w.severity },
  }));
  // The wish is won when its time is up (the storyteller's wish expiry).
  t.clock = { dueWeek: week(w.cost - 1), pressure: "quiet" };
  return t;
}
export const pureOpenWish = pure(openWish);
