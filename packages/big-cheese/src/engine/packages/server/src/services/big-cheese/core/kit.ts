import { newClock } from "./clock.js";
import { openGuided } from "./threads.js";
import type { Authority, Letter, Member, Meter, Meters, Run, Storyteller } from "./types.js";

export interface Kit {
  authority: Authority;
  storyteller: Storyteller;
  meters: Meters;
  people: { id: string; trust?: number }[];
  deputy: string;
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
    saveVersion: 1,
    rng: seed | 0,
    nextId: 0,
    storyteller: kit.storyteller,
    authority: kit.authority,
    clock: newClock(),
    meters: { ...kit.meters },
    low: { money: 0, output: 0, people: 0, standing: 0 },
    extras: structuredClone(kit.extras ?? []),
    people: Object.fromEntries(
      kit.people.map((p) => [p.id, { trust: p.trust ?? 50, stress: 20, mood: "fine" as const, memories: [] }]),
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
  if (kit.letters?.length) openGuided(s, kit.letters);
  return s;
}
