import { clamp } from "./run.js";
import type { Run } from "./types.js";

/** Thick skin (perk id `thick_skin`) makes the boss's stress rise 30% slower. */
export const bossStressRate = (s: Run) => (s.perks.includes("thick_skin") ? 0.7 : 1);

/** Raises the boss's stress by `n` (after the rate), or lowers it. Always use this to change boss stress. */
export function bossStress(s: Run, n: number) {
  s.boss.stress = clamp(Math.round(s.boss.stress + (n > 0 ? n * bossStressRate(s) : n)));
}

/** Friday settle (design.md 7.1). Stress rises with workload, open crises, a low People meter and a bad room, then falls at the weekend. `peak` is the week's top before the fall and `weeksAt100` counts weeks in a row that peaked at 100 (Burnout: 2). Energy is stored only: the modules.md "bad night costs an hour" rule is not built. */
export function bossWeek(s: Run) {
  const crises = Object.values(s.threads).filter((t) => t.kind === "crisis" && t.state === "open").length;
  const badRoom = Object.values(s.rooms).some((r) => r.condition < 20);
  bossStress(s, 2 + 3 * Math.min(crises, 3) + (s.meters.people < 40 ? 5 : 0) + (badRoom ? 3 : 0));
  s.boss.peak = s.boss.stress;
  s.boss.weeksAt100 = s.boss.peak >= 100 ? s.boss.weeksAt100 + 1 : 0;
  bossStress(s, -6); // the weekend
}
