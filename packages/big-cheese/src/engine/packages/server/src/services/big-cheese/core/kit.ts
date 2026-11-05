import { newClock } from "./clock.js";
import { movePeople } from "./people.js";
import { openGuided } from "./threads.js";
import type { Authority, Letter, Member, Meter, Meters, Relation, Run, Storyteller } from "./types.js";

export interface Kit {
  authority: Authority;
  storyteller: Storyteller;
  meters: Meters;
  people: { id: string; trust?: number }[];
  deputy: string;
  rooms: { id: string; condition: number }[];
  relations: Relation[];
  letters?: Letter[]; // "Letters from the last boss", kit data
  hearing: { members: Member[]; ending: string };
  extras?: { id: string; main: Meter; value: number }[];
}

// Hafenkai Logistics start values (content.md 2.1).
export const HAFENKAI: Kit = {
  authority: "manager",
  storyteller: "classic",
  meters: { money: 55, output: 50, people: 60, standing: 65 },
  people: [
    "henrike",
    "tomasz",
    "dilek",
    "gunnar",
    "mira",
    "jonas",
    "sven",
    "olga",
    "bernd",
    "leila",
    "finn",
    "marlene",
  ].map((id) => ({ id, trust: 50 })),
  deputy: "henrike",
  rooms: [
    ["dock-a", 70],
    ["dock-b", 45],
    ["high-bay", 60],
    ["pack-line", 65],
    ["cold-store", 55],
    ["garage", 50],
    ["dispatch", 75],
    ["kantine", 50],
    ["fence", 40],
    ["office", 80],
    ["archive", 35],
    ["roof", 30],
  ].map(([id, condition]) => ({ id: id as string, condition: condition as number })),
  relations: [
    { a: "henrike", b: "sven", kind: "friend", level: 55 },
    { a: "tomasz", b: "jonas", kind: "friend", level: 60 },
    { a: "tomasz", b: "sven", kind: "rival", level: 35 },
    { a: "gunnar", b: "leila", kind: "rival", level: 45 },
    { a: "gunnar", b: "marlene", kind: "enemy", level: 50 },
    { a: "mira", b: "olga", kind: "friend", level: 65 },
    { a: "bernd", b: "finn", kind: "mentor", level: 60 },
    { a: "dilek", b: "leila", kind: "rival", level: 30 },
    { a: "jonas", b: "leila", kind: "crush", level: 25 },
  ],
  hearing: {
    members: [
      { id: "marlene", fit: 0, faction: 0 },
      { id: "leila", fit: 0, faction: 0 },
      { id: "gunnar", fit: 0, faction: 0 },
    ],
    ending: "Fired",
  },
};

export function newRun(kit: Kit, seed: number): Run {
  const s: Run = {
    saveVersion: 2,
    rng: seed | 0,
    nextId: 0,
    storyteller: kit.storyteller,
    authority: kit.authority,
    clock: newClock(),
    meters: { ...kit.meters },
    low: { money: 0, output: 0, people: 0, standing: 0 },
    rooms: Object.fromEntries(kit.rooms.map((r) => [r.id, { condition: r.condition, people: [] }])),
    relations: structuredClone(kit.relations),
    grapevine: [],
    story: { tension: 0, lastSurprise: null, wave: 0 },
    bigScenes: { week: 1, used: 0 },
    extras: structuredClone(kit.extras ?? []),
    people: Object.fromEntries(
      kit.people.map((p) => [
        p.id,
        {
          trust: p.trust ?? 50,
          stress: 20,
          mood: "fine" as const,
          memories: [],
          room: "home",
          ambition: 0,
          status: "active" as const,
        },
      ]),
    ),
    deputy: kit.deputy,
    deputyAmbition: 0,
    threads: {},
    closed: [],
    inbox: [],
    lastWarning: false,
    hearing: null,
    hearingBody: structuredClone(kit.hearing.members),
    lastHearing: null,
    endingName: kit.hearing.ending,
    status: "playing",
    ending: null,
    report: null,
    meterHistory: [],
  };
  movePeople(s);
  if (kit.letters?.length) openGuided(s, kit.letters);
  return s;
}

/** Save v1 to v2: fills the M2 fields with the defaults a fresh run gets. Pure. */
export function migrate(v1: Run | Record<string, any>, kit: Kit): Run {
  const fresh = newRun(kit, 0);
  const people = Object.fromEntries(
    Object.entries(v1.people).map(([id, p]) => [id, { room: "home", ambition: 0, status: "active", ...(p as object) }]),
  );
  return { ...fresh, ...v1, saveVersion: 2, people, rooms: fresh.rooms, relations: fresh.relations } as Run;
}
