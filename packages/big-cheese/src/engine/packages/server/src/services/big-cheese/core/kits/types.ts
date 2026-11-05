import type { Authority, Layer, Letter, Meter, Relation, Severity, Slot, Storyteller } from "../types.js";

// Place Kit shape (design.md section 14) with the fields the M1 screens need. Plain data only.
export interface KitPerson {
  id: string;
  name: string;
  role: string;
  colour: string; // name plate colour, hex
  deputy?: boolean;
  traits: string[];
  ambition: string;
  secret: string;
  routine: Record<Slot, string>; // room ids
  voice: { style: string; phrases: string[] }; // phrases[0] is the signature line
  core?: string; // a cast person's short card summary, added to prompts
}

export interface KitRoom {
  id: string;
  name: string;
  kind: "work" | "social" | "outside" | "private" | "hidden";
  condition: number;
  feeds: Meter | null;
  text: string; // one-line description
}

export interface KitThread {
  title: string;
  kind: "mystery" | "personal" | "guided";
  people: string[];
  need?: Meter;
  text: string;
}

// Lite-mode text for one card: the asker's line plus one answer line per tier.
export interface CardTemplate {
  ask: string;
  strong: string;
  middle: string;
  weak: string;
}

export interface PlaceKit {
  kitVersion: 1;
  boss?: { name: string; about: string }; // the player's persona, set by cast.ts
  id: string;
  name: string;
  family: string;
  premise: string;
  authority: Authority;
  bossTitle: string;
  storyteller: Storyteller;
  meters: Record<Meter, { label: string; start: number }>;
  rooms: KitRoom[];
  people: KitPerson[];
  groups: { id: string; name: string; spokesperson?: string; text: string }[];
  relations: Relation[];
  systems: { kind: "project" | "event" | "season"; name: string; text: string }[];
  layers: { drama: number; romance: number } & Partial<Record<Layer, number>>; // 0-100
  smallMoments: string[]; // {person} {room} {place} are filled by the code
  surprises: string[];
  outside: { id: string; name: string; kind: string; text: string }[];
  meetings: { id: string; name: string; type: string; every: "week" | "month" | "quarter"; attendees: string }[];
  rituals: { id: string; name: string; text: string }[];
  houseRules: {
    id: string;
    text: string;
    options: string[];
    touches: (Meter | "fear" | "love" | "legitimacy")[];
    decree?: boolean;
  }[];
  // M3 additions, all optional so older kits stay valid
  extras?: { id: string; label: string; main: Meter; value: number }[]; // T2: up to 2 extra meters
  scenario?: { goal: string }; // fixed start meters, a fixed opening thread and one set goal
  adult?: { intensity: number; themes: string[] }; // start values when the adult module is switched on
  officeHours?: { day: number; slot: Slot }; // 0-4 = Mon-Fri; default Wednesday afternoon (2, "afternoon")
  authorityStart?: { fear: number; love: number; legitimacy: number };
  court?: string[]; // advisor roles in an absolute place (chancellor, marshal, spymaster)
  roles?: { id: string; name: string; about: string }[]; // role list the AI makes up for the place
  traditions: { id: string; tag: string; text: string }[];
  crisisDeck: { id: string; name: string; text: string; meters: Meter[]; stances: string[] }[];
  openingThreads: KitThread[];
  guidedLetters: Letter[];
  hearing: { body: string; members: string[]; ending: string };
  termGoals: {
    id: string;
    text: string;
    when: "end" | "always";
    min: Partial<Record<Meter, number>>;
    forbid?: string;
  }[];
  templates: {
    cards: Record<Meter, Record<Severity, CardTemplate[]>>;
    feeling: Record<"cold" | "wary" | "neutral" | "warm" | "loyal", string[]>;
    arrival: string[];
  };
}
