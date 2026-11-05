// ──────────────────────────────────────────────
// Big Cheese: Layer The strange (modules.md section 2)
// ──────────────────────────────────────────────
// Artefacts in the drawer, a curse thread, an odd machine that wears like any equipment, and an AI crew member.
// A curse is a personal_arc with layer "strange" and stakes "strange:curse:<person>".
import { pick, roll } from "./rng.js";
import { newId } from "./run.js";
import { addThing } from "./things.js";
import { openThread } from "./threads.js";
import type { Person, Run, Thread } from "./types.js";

const dialOf = (s: Run) => s.layers?.strange ?? 0; // opt-in layer
const CHANCE = 0.5;
const MAX = 3; // artefacts, and odd machines, per run
const ARTEFACTS = [
  "A cracked mirror",
  "A stopped pocket watch",
  "A jar that hums",
  "A map that changes",
  "A bell with no tongue",
];
const MACHINES = ["A humming machine", "A radio that hears tomorrow", "A lamp that never burns down"];
export const AI_CREW = "ai crew";
export const isAiCrew = (p: Person) => !!p.traits?.includes(AI_CREW);

/** Monday: a dial above 0 may bring one strange thing. */
export function strangeSeeds(s: Run) {
  const d = dialOf(s);
  if (!d || roll(s) >= (d / 100) * CHANCE) return;
  const live = Object.keys(s.people).filter((id) => s.people[id]!.status === "active");
  if (!live.length) return;
  const kinds = ["artefact", "curse", "machine"];
  if (!s.tally["strange.crew"]) kinds.push("crew");
  const kind = pick(s, kinds);
  const id = pick(s, live);
  if (kind === "crew") {
    s.tally["strange.crew"] = 1;
    (s.people[id]!.traits ??= []).push(AI_CREW);
  } else if (kind === "curse") {
    if (Object.values(s.threads).some((t) => t.layer === "strange")) return;
    const t = openThread(s, {
      kind: "personal_arc",
      title: `A curse on ${s.people[id]!.name ?? id}`,
      origin: "arc",
      people: [id],
      need: "people",
      severity: 2,
      stakes: `strange:curse:${id}`,
    });
    t.layer = "strange";
    t.beats.push({
      id: newId(s, "b"),
      type: "card",
      planned: { week: s.clock.week, day: s.clock.day + 1 },
      seed: { need: "people", severity: 1 },
    });
  } else if (kind === "machine") {
    const own = s.things.equipment.filter((e) => e.id.startsWith("strange-"));
    if (own.length < MAX)
      s.things.equipment.push({
        id: newId(s, "strange-"),
        name: pick(s, MACHINES),
        room: pick(s, Object.keys(s.rooms)),
        condition: 100,
      });
  } else if (s.things.drawer.filter((x) => x.kind === "artefact").length < MAX) {
    addThing(s, { id: newId(s, "strange-"), kind: "artefact", name: pick(s, ARTEFACTS) });
  }
}

/** A curse thread has ended: the person is fine again (won) or ill (lost). */
export function strangeClosed(s: Run, t: Thread, state: Thread["state"]) {
  const id = t.stakes?.startsWith("strange:curse:") ? t.stakes.slice(14) : "";
  if (id && s.people[id]) s.people[id].mood = state === "won" ? "fine" : "sick";
}
