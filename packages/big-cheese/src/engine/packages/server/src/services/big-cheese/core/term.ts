import { legacyTerm } from "./legacy.js";
import { endTermGoals } from "./goals.js";
import { startReview } from "./reviews.js"; // T10
import type { PlaceKit } from "./kits/types.js";
import type { Run } from "./types.js";

/** Runs once on the last Friday of every term, after the week settles (modules.md onTermEnd). T6, T8, T9 and T10 append one call each, in that order. */
export function endTerm(s: Run, kit?: PlaceKit): void {
  legacyTerm(s); // T6: drop an heir who has left
  endTermGoals(s, kit); // T8: check the goals, offer the next goals and a perk
  startReview(s, kit); // T10: open the term review (key people, award, yearbook facts)
}
