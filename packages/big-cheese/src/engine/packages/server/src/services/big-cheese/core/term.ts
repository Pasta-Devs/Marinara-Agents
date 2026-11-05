import { endTermGoals } from "./goals.js";
import type { PlaceKit } from "./kits/types.js";
import type { Run } from "./types.js";

/** Runs once on the last Friday of every term, after the week settles (modules.md onTermEnd). T6, T8, T9 and T10 append one call each, in that order. */
export function endTerm(s: Run, kit?: PlaceKit): void {
  endTermGoals(s, kit); // T8: check the goals, offer the next goals and a perk
}
