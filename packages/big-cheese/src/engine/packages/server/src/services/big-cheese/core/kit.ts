import { startSystems } from "./blocks.js";
import { newClock } from "./clock.js";
import { startAuthority } from "./authority.js";
import { movePeople } from "./people.js";
import { HAFENKAI_PLACE } from "./kits/hafenkai.js";
import type { PlaceKit } from "./kits/types.js";
import { openGuided } from "./threads.js";
import { WISH_POINTS_PER_TERM } from "./types.js";
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
  layers?: { drama: number; romance: number };
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

/** The M4 fields a fresh run starts with. The place kit seeds the drawer, equipment, culture, depth and traditions. A v3 save gets them too. */
export const m4Defaults = (place?: PlaceKit) => ({
  things: {
    drawer: (place?.things ?? []).map((t) => ({ ...t })),
    equipment: (place?.equipment ?? []).map((e) => ({ ...e })),
  },
  culture: { ...place?.culture } as Record<string, number>,
  cultureLog: [] as Run["cultureLog"],
  traditions: (place?.traditions ?? []).map((t) => ({ id: t.id, text: t.text, count: 0, active: false })),
  goals: [] as Run["goals"],
  perks: [] as string[],
  perkOffer: null as string[] | null,
  achievements: [] as string[],
  tally: {} as Record<string, number>,
  favours: [] as Run["favours"],
  leverage: [] as Run["leverage"],
  informants: [] as Run["informants"],
  delegated: {} as Record<string, string>,
  depth: { money: !!place?.depth?.money, building: !!place?.depth?.building },
  ledger: { salaries: 0, loans: [], quarter: 0 } as Run["ledger"],
  buildOrders: [] as Run["buildOrders"],
  legacy: null as Run["legacy"],
  yearbook: [] as string[],
  pendingTerm: null as Run["pendingTerm"],
  openedRooms: [] as string[],
  boss: { stress: 20, energy: 100, peak: 20, weeksAt100: 0 }, // core/boss.ts
  lastTerm: 0,
});

/** The M3 fields a fresh run starts with. Also what a v2 save gets. */
const m3Defaults = () => ({
  mode: "normal" as const,
  cheeseMark: false,
  difficulty: "normal" as const,
  mutators: [] as Run["mutators"],
  power: { fear: 0, love: 0 },
  adult: null,
  systems: {},
  advisors: [] as string[],
  houseRules: {},
  officeHours: { day: 2, slot: "afternoon" as const, visitors: [] as string[] }, // Wednesday afternoon
  wishPoints: { term: 1, left: WISH_POINTS_PER_TERM },
});

export function newRun(kit: Kit, seed: number, place: PlaceKit = HAFENKAI_PLACE): Run {
  const s: Run = {
    saveVersion: 4,
    ...m3Defaults(),
    ...m4Defaults(place),
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
    ...(kit.layers && { layers: { ...kit.layers } }),
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
          traits: [...(place.people.find((q) => q.id === p.id)?.traits ?? [])],
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
  movePeople(s, place);
  startAuthority(s, place); // T7
  startSystems(s, place); // T4
  if (kit.letters?.length) openGuided(s, kit.letters);
  return s;
}

/** Save v1 to v2: fills the M2 fields with the defaults a fresh run gets. Pure. */
export function migrate(v1: Run | Record<string, any>, kit: Kit): Run {
  const fresh = newRun(kit, 0);
  const people = Object.fromEntries(
    Object.entries(v1.people).map(([id, p]) => [id, { room: "home", ambition: 0, status: "active", ...(p as object) }]),
  );
  return { ...fresh, ...v1, saveVersion: 2, people, rooms: fresh.rooms, relations: fresh.relations } as unknown as Run; // still v2, migrate3 finishes it
}

/** Save v2 to v3: fills the M3 fields with the defaults a fresh run gets. Pure. */
export function migrate3(v2: Run | Record<string, any>): Run {
  return { ...m3Defaults(), ...v2, saveVersion: 3 } as unknown as Run; // still v3, migrate4 finishes it
}

/** Save v3 to v4: fills the M4 fields (the place kit seeds the drawer and the rest). Pure. */
export function migrate4(v3: Run | Record<string, any>, place?: PlaceKit): Run {
  return { ...m4Defaults(place), ...v3, saveVersion: 4 } as Run;
}
