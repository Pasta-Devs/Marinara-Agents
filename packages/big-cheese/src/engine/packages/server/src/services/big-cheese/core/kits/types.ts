import type { Authority, Letter, Meter, Severity, Storyteller } from "../types.js";

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
  routine: { morning: string; afternoon: string }; // room ids
  voice: { style: string; phrases: string[] }; // phrases[0] is the signature line
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
  outside: { id: string; name: string; kind: string; text: string }[];
  meetings: { id: string; name: string; type: string; every: "week" | "month" | "quarter"; attendees: string }[];
  rituals: { id: string; name: string; text: string }[];
  houseRules: { id: string; text: string; options: string[]; touches: Meter[] }[];
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
