// ──────────────────────────────────────────────
// Big Cheese M4 T6: Legacy layer and legacy runs (modules.md section 2, README "legacy runs")
// ──────────────────────────────────────────────
// The boss names an heir. When the run is over, the next run keeps the place, the people and what
// the old boss left behind, and the heir becomes deputy. Meters reset to the kit start.
import { dial } from "./layers.js";
import { newRun } from "./kit.js";
import { rulesOf } from "./kits/index.js";
import type { PlaceKit } from "./kits/types.js";
import { pure } from "./run.js";
import type { Run } from "./types.js";

const GONE: readonly string[] = ["quit", "fired", "banished", "imprisoned", "dead"];

/** Names a person as the heir. It costs no hour. A new name replaces the old one. */
export function nameHeir(s: Run, id: string): void {
  if (dial(s, "legacy") <= 0) throw new Error("The Legacy layer is off.");
  if (!Object.hasOwn(s.people, id) || GONE.includes(s.people[id]!.status)) throw new Error("Not a person here.");
  s.legacy = { ...s.legacy, generation: s.legacy?.generation ?? 1, heir: id };
}
export const pureNameHeir = pure(nameHeir);

/** Last Friday of a term: an heir who has left is dropped, so the goal needs a new name. */
export function legacyTerm(s: Run): void {
  const l = s.legacy;
  if (l?.heir && GONE.includes(s.people[l.heir]?.status ?? "quit")) {
    s.legacy = { generation: l.generation, ...(l.from ? { from: l.from } : {}) };
  }
}

/**
 * The next boss's run (decision 11): same place, layers and dials, kept traits and relations, one memory of
 * the old boss per person, active traditions and the culture. The old ending is the memory line.
 * `from` is the id of the old run.
 */
export function legacyRun(old: Run, kit: PlaceKit, seed: number, from?: string): Run {
  const heir = old.legacy?.heir;
  if (old.status === "playing") throw new Error("Finish this run first.");
  if (!heir || !Object.hasOwn(old.people, heir) || GONE.includes(old.people[heir]!.status))
    throw new Error("Name an heir first.");
  const s = newRun(rulesOf(kit), seed, kit);
  s.layers = structuredClone(old.layers);
  s.mode = old.mode;
  s.cheeseMark = old.cheeseMark;
  s.difficulty = old.difficulty;
  s.mutators = [...old.mutators];
  s.adult = structuredClone(old.adult);
  const line = `The last ${kit.bossTitle}: ${old.ending ?? "a full year"}.`;
  for (const [id, p] of Object.entries(s.people)) {
    const o = old.people[id];
    if (!o) continue;
    if (o.name) p.name = o.name; // keeps cast names
    if (o.traits) p.traits = [...o.traits];
    p.memories.push({
      week: 0,
      about: line,
      thread: "",
      stance: old.status === "ended" ? "refuse" : "invest",
      weight: 2,
    });
  }
  s.relations = structuredClone(old.relations).filter((r) => s.people[r.a] && s.people[r.b]);
  if (Object.hasOwn(s.people, heir)) {
    s.deputy = heir;
    s.deputyAmbition = 0;
  }
  const kept = old.traditions.filter((t) => t.active).map((t) => ({ ...t }));
  s.traditions = [...kept, ...s.traditions.filter((t) => !kept.some((k) => k.id === t.id))];
  s.culture = { ...s.culture, ...old.culture };
  s.legacy = { generation: (old.legacy?.generation ?? 1) + 1, ...(from ? { from } : {}) };
  return s;
}
