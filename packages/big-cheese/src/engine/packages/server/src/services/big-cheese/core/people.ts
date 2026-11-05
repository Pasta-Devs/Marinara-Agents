// Big Cheese: who is where, who knows whom and who leaves (design.md section 6 and 8.2).
// Plain functions that edit the run they get, like the rest of the core.
import { dayIndex, slot } from "./clock.js";
import { HAFENKAI_PLACE } from "./kits/hafenkai.js";
import type { PlaceKit } from "./kits/types.js";
import { clamp } from "./run.js";
import { closeThread, openThread } from "./threads.js";
import type { Relation, Run, Slot } from "./types.js";

// shortcut: one built-in place, add the next one here (a kit is found by its people); not via kits/index (import cycle)
const PLACES: PlaceKit[] = [HAFENKAI_PLACE];
export const kitOf = (s: Run) => PLACES.find((k) => k.people.some((p) => Object.hasOwn(s.people, p.id))) ?? PLACES[0];

const WANDER = 0.1; // share of slots a person is somewhere else than the routine says
const STRESSED = 70;
const LOW_ROOM = 30;
const LEAVE_BELOW = 15;
const HIDDEN: Relation["kind"][] = ["crush", "secret_affair"];

// A fixed roll in 0..1 per person and slot. It never moves the run's rng (the balance sim and the
// snapshots keep their numbers) and gives the same answer each time the slot is placed again.
// shortcut: the same wander for every run, add a run seed to the key when that shows.
const dice = (s: Run, key: string, at: Slot) => {
  let h = 2166136261;
  for (const c of `${s.clock.week}|${s.clock.day}|${at}|${key}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};

/** Where a person is at a slot: sick or gone is home, then stress, then 10% wander, else the routine. */
function roomFor(s: Run, kit: PlaceKit, id: string, at: Slot): string {
  const p = s.people[id];
  const routine = (kit.people.find((x) => x.id === id)?.routine ?? p.routine)?.[at] ?? "home";
  if (p.status !== "active" || p.mood === "sick" || p.mood === "away" || routine === "home") return "home";
  if (p.stress > STRESSED) return kit.rooms.find((r) => r.kind === "social")?.id ?? routine;
  const open = kit.rooms.filter((r) => r.kind === "work" || r.kind === "social" || r.kind === "outside");
  return dice(s, id, at) < WANDER ? open[Math.floor(dice(s, `${id}w`, at) * open.length)].id : routine;
}

/** Puts everyone where they are at the clock's slot, and rebuilds each room's list. */
export function movePeople(s: Run) {
  const kit = kitOf(s);
  const at = slot(s.clock);
  const where = Object.fromEntries(Object.keys(s.people).map((id) => [id, roomFor(s, kit, id, at)]));
  // A working person with a strong crush goes where the crush is (a crush at home does not count).
  for (const r of s.relations)
    if (r.kind === "crush" && r.level >= 50 && where[r.a] !== "home" && s.people[r.a].stress <= STRESSED)
      if (where[r.b] !== "home") where[r.a] = where[r.b];
  for (const r of Object.values(s.rooms)) r.people = [];
  for (const id of Object.keys(s.people)) {
    const p = s.people[id];
    p.room = where[id];
    if (Object.hasOwn(s.rooms, p.room)) s.rooms[p.room].people.push(id);
  }
}

/** Moves a relation's level by `d`, kept in 0-100. No relation, no change. */
export function shiftRelation(s: Run, a: string, b: string, d: number) {
  const r = s.relations.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  if (r) r.level = clamp(r.level + d);
}

export const relKey = (r: { a: string; b: string }) => [r.a, r.b].sort().join("|");
/** The boss knows a crush or an affair only after he heard of it (`known` holds the keys). */
export const isKnown = (r: Relation, known: readonly string[]) => !HIDDEN.includes(r.kind) || known.includes(relKey(r));

/** Up to 2 related pairs in a room (else any 2 people): the ones the boss overhears. */
export function overheard(s: Run, room: string) {
  const here = Object.hasOwn(s.rooms, room) ? s.rooms[room].people : [];
  const pairs = s.relations.filter((r) => here.includes(r.a) && here.includes(r.b)).slice(0, 2);
  const people = new Set(pairs.flatMap((r) => [r.a, r.b]));
  for (const id of here) if (people.size < 2) people.add(id);
  return { people: [...people], pairs };
}

const PAIR_FACTS: Partial<Record<Relation["kind"], string>> = {
  friend: "{a} and {b} are good friends.",
  rival: "{a} and {b} compete for everything.",
  couple: "{a} and {b} are together.",
  mentor: "{a} is teaching {b} the trade.",
  enemy: "{a} and {b} are not on speaking terms.",
  family: "{a} and {b} are family.",
  crush: "{a} cannot stop looking at {b}.",
};

/** The day's moments for the grapevine batch: plain sentences from the state, 8 at most. */
export function dayFacts(s: Run, kit: PlaceKit, known: readonly string[]) {
  const name = (id: string) => kit.people.find((p) => p.id === id)?.name ?? id;
  const out: { person: string; text: string }[] = [];
  for (const [id, p] of Object.entries(s.people)) {
    const n = name(id);
    if (p.status !== "active") continue;
    if (p.stress > STRESSED) out.push({ person: id, text: `${n} looks worn out.` });
    if (p.mood === "sick") out.push({ person: id, text: `${n} is out sick.` });
    if (p.mood === "low") out.push({ person: id, text: `${n} is in a bad mood.` });
    if (p.trust >= 80) out.push({ person: id, text: `${n} speaks well of the boss.` });
    if (p.trust < LEAVE_BELOW + 10) out.push({ person: id, text: `${n} talks about leaving.` });
  }
  for (const r of s.relations) {
    const text = PAIR_FACTS[r.kind];
    if (text && isKnown(r, known))
      out.push({ person: r.a, text: text.replace("{a}", name(r.a)).replace("{b}", name(r.b)) });
  }
  const at = "evening";
  return out.sort((x, y) => dice(s, x.text, at) - dice(s, y.text, at)).slice(0, 8);
}

/** A person with trust under 15 gets a warning thread. A second week under 15 and they quit. */
function leaveCheck(s: Run, kit: PlaceKit) {
  for (const [id, p] of Object.entries(s.people)) {
    if (p.status !== "active") continue;
    const title = `${p.name ?? kit.people.find((x) => x.id === id)?.name ?? id} may leave`;
    const warning = Object.values(s.threads).find((t) => t.kind === "crisis" && t.title === title);
    if (p.trust >= LEAVE_BELOW) {
      if (warning) closeThread(s, warning.id, "won");
    } else if (!warning) {
      openThread(s, {
        kind: "crisis",
        origin: "arc",
        title,
        people: [id],
        stakes: "They will hand in notice if nothing changes.",
        dueWeek: s.clock.week + 1,
      });
    } else if (warning.clock.dueWeek !== "open" && s.clock.week >= warning.clock.dueWeek) {
      closeThread(s, warning.id, "lost");
      for (const t of Object.values(s.threads)) if (t.people.includes(id)) closeThread(s, t.id, "dropped");
      p.status = "quit";
    }
  }
}

/** Once a week: use wears rooms, a worn room costs the meter it feeds 1 point (the worst one, at most 1), people leave. */
function weekTurn(s: Run) {
  const kit = kitOf(s);
  for (const r of Object.values(s.rooms)) if (r.people.length >= 3) r.condition = clamp(r.condition - 1);
  const fed = kit.rooms
    .filter((r) => r.feeds && s.rooms[r.id]?.condition < LOW_ROOM)
    .sort((a, b) => s.rooms[a.id].condition - s.rooms[b.id].condition)[0]?.feeds;
  if (fed) s.meters[fed] = clamp(s.meters[fed] - 1);
  leaveCheck(s, kit);
}

/** The end-of-day call: a new week first runs its checks, then the new day's people go to their rooms. */
export function dayTurn(s: Run) {
  for (const [id, p] of Object.entries(s.people)) {
    if (p.until === undefined || p.status !== "active" || dayIndex(s.clock) < p.until) continue;
    for (const t of Object.values(s.threads)) if (t.people.includes(id)) closeThread(s, t.id, "dropped");
    p.status = "quit"; // a visitor goes home
  }
  if (s.clock.day === 0) weekTurn(s);
  movePeople(s);
}
