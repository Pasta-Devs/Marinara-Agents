// ──────────────────────────────────────────────
// Big Cheese: mutators (modules.md section 4)
// ──────────────────────────────────────────────
// A mutator changes one run for fun. The Cheese Board switches them. Ironman is a run mode, so it is
// not switched here. Pure code: randomness only from the run's seeded rng.
import { TERM_WEEKS } from "./clock.js";
import { pick } from "./rng.js";
import { openStory } from "./threads.js";
import type { Meter, Mutator, Run } from "./types.js";

export const START_TRUST = 20;
export const MESS_THREADS = 5;
export const SPEED_TERM_WEEKS = 4;

/** The mutators a player may switch on a run. Ironman starts with the run. */
export const SWITCHABLE: readonly Mutator[] = [
  "everyone_hates_you",
  "double_drama",
  "inherited_mess",
  "speed_run",
  "silent_boss",
];

const MESS: { title: string; need: Meter }[] = [
  { title: "The last boss left unpaid bills", need: "money" },
  { title: "Nobody knows who owns the old plans", need: "output" },
  { title: "Half the staff were promised a raise", need: "people" },
  { title: "A letter from the regulator sits unopened", need: "standing" },
  { title: "The old budget does not add up", need: "money" },
];

export const hasMutator = (s: Run, m: Mutator) => (s.mutators ?? []).includes(m);

/** A term has 8 weeks, or 4 with Speed run. */
export const termWeeks = (s: Run) => (hasMutator(s, "speed_run") ? SPEED_TERM_WEEKS : TERM_WEEKS);

/** Double drama doubles the odds of a crisis and of a surprise. */
export const dramaFactor = (s: Run) => (hasMutator(s, "double_drama") ? 2 : 1);

/** Silent boss: the boss answers only with the offered answers. */
export const silentBoss = (s: Run) => hasMutator(s, "silent_boss");

/**
 * Switch one mutator on or off. The start effects happen once, when it goes on: trust drops to 20,
 * and open threads fill up to 5.
 */
export function setMutator(s: Run, m: Mutator, on: boolean): void {
  if (!SWITCHABLE.includes(m)) throw new Error("Ironman starts with a new run.");
  if (hasMutator(s, m) === on) throw new Error(on ? "That mutator is already on." : "That mutator is already off.");
  s.mutators = on ? [...(s.mutators ?? []), m] : s.mutators.filter((x) => x !== m);
  if (!on) return;
  if (m === "everyone_hates_you") for (const p of Object.values(s.people)) p.trust = Math.min(p.trust, START_TRUST);
  if (m === "inherited_mess") {
    const open = () => Object.values(s.threads).filter((t) => t.state === "open").length;
    while (open() < MESS_THREADS) {
      const item = pick(s, MESS);
      openStory(s, "mystery", {
        title: item.title,
        people: [],
        need: item.need,
        severity: 2,
        stakes: "",
        origin: "arc",
      });
    }
  }
}
