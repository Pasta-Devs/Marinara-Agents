// Run state for Big Cheese M1 (design.md section 14, trimmed). Plain JSON only, so a snapshot is a
// structuredClone and the Cheese Board can rewind by swapping the object back.
export const METERS = ["money", "output", "people", "standing"] as const;
export type Meter = (typeof METERS)[number];
export type Meters = Record<Meter, number>;
export type Severity = 1 | 2 | 3;
export type Authority = "manager" | "strong_leader" | "absolute";
export type Tier = "strong" | "middle" | "weak";
export type Storyteller = "calm" | "classic" | "chaos";

export interface Clock {
  week: number; // 1-24, 3 terms of 8
  day: number; // 0-4 = Mon-Fri
  hoursLeft: number; // 5 per day
}

export interface Memory {
  week: number;
  about: string; // card id
  thread: string;
  stance: string;
  weight: 1 | 2 | 3;
}

export interface Person {
  trust: number; // 0-100
  stress: number;
  mood: "great" | "fine" | "low" | "sick" | "away";
  memories: Memory[];
  room: string; // a room id, or "home"
  ambition: number; // 0-100, progress toward their own goal
  name?: string; // set when a cast card replaces or adds this person
  routine?: Record<Slot, string>; // hired people and visitors are not in the kit
  until?: number; // visitors: the day index on which they go home
  status: "active" | "on_leave" | "sick" | "quit" | "fired" | "banished" | "imprisoned" | "dead";
}

export const SLOTS = ["morning", "midday", "afternoon", "evening", "night"] as const;
export type Slot = (typeof SLOTS)[number];

export interface Relation {
  a: string;
  b: string;
  kind: "friend" | "rival" | "crush" | "couple" | "mentor" | "enemy" | "family" | "secret_affair";
  level: number; // 0-100
}

export interface Answer {
  tier: Tier;
  stance: string;
}

export interface Card {
  id: string;
  thread: string;
  asker: string;
  need: Meter;
  severity: Severity;
  age: number; // days waited
  answers: Answer[];
}

export interface Letter {
  day: number; // -1 = Sunday before week 1, 0-4 = Mon-Fri of week 1
  person: string;
  text: string;
  screen: string;
}

export interface MeetingItem {
  id: string;
  title: string;
  thread?: string;
  deputy?: boolean; // the deputy challenge
  need: Meter;
  severity: Severity;
  offer: Answer[]; // the three stances the code picked
  base: Record<string, number>; // each attendee's score before the boss speaks
  lines: { who: string; text: string }[];
  suggestions: { stance: string; text: string }[];
  chosen?: string;
  scores?: Record<string, number>;
  passed?: boolean;
}

export interface Meeting {
  kind: string;
  mode: "vote" | "agreement";
  title: string;
  people: string[];
  items: MeetingItem[];
  done: boolean;
}

export interface Beat {
  id: string;
  type: "card" | "check" | "letter" | "meeting_item" | "big_scene" | "scene";
  blueprint?: string; // big_scene: the blueprint id (core/bigscenes.ts)
  planned?: { week: number; day: number };
  seed?: { need: Meter; severity: Severity };
  card?: string;
  result?: string;
  letter?: Letter;
  read?: boolean;
}

export interface Thread {
  id: string;
  kind:
    | "follow_up"
    | "personal_arc"
    | "crisis"
    | "promise"
    | "cover_up"
    | "mystery"
    | "project"
    | "wish"
    | "guided"
    | "hearing"
    | "revolt";
  secret?: boolean; // the boss does not know it yet
  title: string;
  people: string[];
  need?: Meter;
  severity?: Severity;
  stakes: string;
  clock: { dueWeek: number | "open"; pressure: string };
  origin: "deck" | "arc" | "block" | "own_answer" | "action" | "wish" | "guided" | "board";
  beats: Beat[];
  state: "open" | "won" | "lost" | "dropped";
  promise?: { to: string; what: string; due: { week: number; day: number }; kept: boolean };
  layer?: "drama" | "romance"; // set when a story layer opened it (layers.ts)
}

export interface Member {
  id: string; // a person id
  fit: number; // stance fit -3..3
  faction: number; // faction bonus -2..2
}

export interface Hearing {
  meter: Meter;
  thread: string;
  week: number; // hearing week
  day: number; // hearing day (1 = second working day)
  witnesses: string[];
  evidence: string[]; // evidence cards played, at most 2 count
}

export interface Report {
  week: number;
  income: number;
  before: Meters;
  after: Meters;
}

export interface Run {
  saveVersion: 2;
  rng: number;
  nextId: number;
  storyteller: Storyteller;
  authority: Authority;
  clock: Clock;
  meters: Meters;
  low: Meters; // Fridays in a row below 10
  extras: { id: string; main: Meter; value: number }[]; // an extra meter below 20 hurts its main meter
  people: Record<string, Person>;
  deputy: string;
  deputyAmbition: number;
  threads: Record<string, Thread>; // open threads
  closed: { id: string; state: Thread["state"]; title?: string; need?: Meter }[];
  inbox: Card[];
  away?: Card[]; // cards a skip set aside at a day end; Start the day puts them back unaged
  lastWarning: boolean; // whole run
  hearing: Hearing | null;
  hearingBody: Member[];
  lastHearing: { won: boolean; backing: number; of: number } | null;
  meeting?: Meeting | null; // the open (or last finished) meeting, design.md section 7
  endingName: string;
  status: "playing" | "complete" | "ended";
  ending: string | null;
  report: Report | null;
  meterHistory: ({ week: number } & Meters)[];
  rooms: Record<string, { condition: number; people: string[] }>;
  relations: Relation[];
  grapevine: string[]; // ids of lines in a child document
  story: { tension: number; lastSurprise: { week: number; day: number } | null; wave: number };
  bigScenes: { week: number; used: number }; // the weekly big-scene budget
  reasons?: { person: string; text: string }[]; // Board reason seeds for the next ambient batch (cheese-board.md §6)
  layers?: { drama: number; romance: number }; // story layer dials 0-100; missing = 50 (layers.ts)
}
