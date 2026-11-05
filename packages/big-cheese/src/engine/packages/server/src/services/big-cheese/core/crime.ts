// ──────────────────────────────────────────────
// Big Cheese M4 T4: Crime layer (modules.md section 2)
// ──────────────────────────────────────────────
// Once a term (dial-scaled) a bribe, fraud or blackmail comes up as a cover-up thread. A won one,
// or one the boss investigated, leaves an evidence item in the drawer (T2).
import { term } from "./clock.js";
import { pick, roll } from "./rng.js";
import { addThing } from "./things.js";
import { openStory } from "./threads.js";
import type { Meter, Run } from "./types.js";

const CHANCE = 0.5;
const CRIMES: { title: string; need: Meter }[] = [
  { title: "Someone took a bribe", need: "standing" },
  { title: "The books do not add up", need: "money" },
  { title: "Someone is being blackmailed", need: "people" },
];

/** Puts the evidence for a crime thread in the drawer, once. */
export function crimeEvidence(s: Run, id: string, name: string, about?: string) {
  const key = `crime.ev.${id}`;
  if (s.tally[key]) return;
  s.tally[key] = 1;
  addThing(s, { id: `crime-${id}`, kind: "evidence", name, about, thread: id });
}

/** Monday: evidence for crimes the boss won, then maybe a new crime thread (one per term). */
export function crimeSeeds(s: Run) {
  for (const c of s.closed) if (c.layer === "crime" && c.state === "won") crimeEvidence(s, c.id, c.title ?? "");
  const d = s.layers?.crime ?? 0; // opt-in: no dial, no crime
  const key = `crime.${term(s.clock)}`;
  if (!d || s.tally[key] || Object.values(s.threads).some((t) => t.layer === "crime" && t.kind === "cover_up")) return;
  if (roll(s) >= (d / 100) * CHANCE) return;
  const live = Object.keys(s.people).filter((id) => s.people[id]!.status === "active");
  if (!live.length) return;
  s.tally[key] = 1;
  const c = pick(s, CRIMES);
  const who = pick(s, live);
  const t = openStory(s, "cover_up", { title: c.title, need: c.need, people: [who], severity: 2, origin: "arc" });
  t.layer = "crime";
}
