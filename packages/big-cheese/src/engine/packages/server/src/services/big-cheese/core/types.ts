// Run state for Big Cheese M1 (design.md section 14, trimmed). Plain JSON only, so a snapshot is a
// structuredClone and the Cheese Board can rewind by swapping the object back.
export const METERS = ["money", "output", "people", "standing"] as const;
export type Meter = (typeof METERS)[number];
export type Meters = Record<Meter, number>;
export type Severity = 1 | 2 | 3;
export type Authority = "manager" | "strong_leader" | "absolute";
export type Tier = "strong" | "middle" | "weak";
export type Storyteller = "calm" | "classic" | "chaos";

/** Story layers (README, Story layers); drama and romance are M2, the rest come with M3. */
export type Layer =
  | "drama"
  | "romance"
  | "press"
  | "rivals"
  | "family"
  | "adult"
  | "crime"
  | "politics"
  | "mystery"
  | "horror"
  | "legacy"
  | "strange";
export type Mode = "normal" | "honest" | "sandbox" | "ironman";
export const DIFFICULTIES = ["easy", "normal", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
/** Easy 0.75, Normal 1, Hard 1.25 on all negative deltas (design.md section 4.1). */
export const DIFFICULTY_FACTOR: Record<Difficulty, number> = { easy: 0.75, normal: 1, hard: 1.25 };
export const MUTATORS = [
  "ironman",
  "everyone_hates_you",
  "double_drama",
  "inherited_mess",
  "speed_run",
  "silent_boss",
] as const;
export type Mutator = (typeof MUTATORS)[number];
export const WISH_POINTS_PER_TERM = 3;
export const OFFICE_HOURS_CAP = 4;

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
  influence?: number; // advisors only, rises when the boss follows their advice
  advisedWeek?: number; // advisors only, the last week the boss followed their advice (or joined)
  romance?: number; // 0-100, how they feel about the boss
  attraction?: number; // 0-100, how the boss feels about them
  traits?: string[]; // from the kit or the cast card; the adult layer reads them (who strays)
  name?: string; // set when a cast card replaces or adds this person
  routine?: Record<Slot, string>; // hired people and visitors are not in the kit
  until?: number; // visitors: the day index on which they go home
  status: "active" | "on_leave" | "sick" | "quit" | "fired" | "banished" | "imprisoned" | "dead" | "missing";
}

export const SLOTS = ["morning", "midday", "afternoon", "evening", "night"] as const;
export type Slot = (typeof SLOTS)[number];

export interface Relation {
  a: string;
  b: string;
  kind: "friend" | "rival" | "crush" | "couple" | "mentor" | "enemy" | "family" | "secret_affair";
  level: number; // 0-100
  attraction?: number; // romance layer, 0-100
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
  swing?: string[]; // M4 T12: the one attendee a favour or leverage swung
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
    | "revolt"
    | "audit"; // M4 T15: detailed money, opened by a missed loan or a failed audit
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
  rule?: { id: string; option: string }; // T7: a Manager proposal waiting for a vote
  promise?: { to: string; what: string; due: { week: number; day: number }; kept: boolean };
  layer?: Layer; // set when a story layer opened it (layers.ts)
  system?: string; // the kit system (position as text) that opened it (blocks.ts)
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
  favour?: string; // M4 T12: a person who owed the boss spoke for them (one witness)
}

export interface Report {
  week: number;
  income: number;
  before: Meters;
  after: Meters;
}

export interface Run {
  saveVersion: 4;
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
  closed: {
    id: string;
    state: Thread["state"];
    title?: string;
    need?: Meter;
    layer?: Layer | null;
    secret?: boolean;
  }[];
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
  endingId?: string; // M4 T9: the id in core/endings.ts when the code ended the run itself
  report: Report | null;
  meterHistory: ({ week: number } & Meters)[];
  rooms: Record<string, { condition: number; people: string[] }>;
  relations: Relation[];
  grapevine: string[]; // ids of lines in a child document
  story: { tension: number; lastSurprise: { week: number; day: number } | null; wave: number };
  bigScenes: { week: number; used: number }; // the weekly big-scene budget
  reasons?: { person: string; text: string }[]; // Board reason seeds for the next ambient batch (cheese-board.md §6)
  layers?: { drama: number; romance: number } & Partial<Record<Layer, number>>; // story layer dials 0-100; missing = 50 (layers.ts)
  // M3 state (modules.md section 1, cheese-board.md section 7). Filled by migrate, read by later tickets.
  mode: Mode;
  cheeseMark: boolean; // an honest or ironman run, shown on the title card
  difficulty: Difficulty; // stored only; the factor is applied by core where deltas land
  mutators: Mutator[]; // switched on
  power: { fear: number; love: number }; // legitimacy stays in extras (the tier is `authority`)
  adult: { intensity: number; themes: string[] } | null; // null = module off
  systems: Record<
    string,
    // kind, name and text are the kit's block, copied at the start (blocks.ts); fixtures are the season table
    {
      on: boolean;
      kind?: "project" | "event" | "season";
      name?: string;
      text?: string;
      fixtures?: { week: number; won?: boolean }[];
    }
  >;
  advisors: string[]; // person ids in the inner circle
  houseRules: Record<string, string>; // rule id -> chosen option
  officeHours: { day: number; slot: Slot; visitors: string[] }; // one booked hour, up to OFFICE_HOURS_CAP visitors
  wishPoints: { term: number; left: number }; // in-run wishes, WISH_POINTS_PER_TERM per term
  // M4 state (all default empty, see kit.ts m4Defaults)
  things: {
    drawer: {
      id: string;
      kind: "key" | "gift" | "document" | "evidence" | "artefact";
      name: string;
      about?: string;
      thread?: string;
    }[];
    equipment: { id: string; name: string; room?: string; condition: number }[];
  };
  culture: Record<string, number>; // tag -> points
  cultureLog: { stance: string; week: number }[]; // last 8 weeks only
  traditions: { id: string; text: string; count: number; active: boolean }[];
  goals: { term: number; offered: string[]; picked: string[]; met: string[] }[];
  perks: string[];
  perkOffer: string[] | null;
  achievements: string[];
  tally: Record<string, number>; // counters the achievements read
  favours: { from: string; to?: string; why: string; week: number; used: boolean }[];
  leverage: { about: string; thread?: string; used: boolean; found: boolean }[];
  informants: { person: string; target: string; kind: "room" | "group"; paid: boolean }[];
  eyes?: { week: number; text: string }[]; // T13: what the informants and rumours reported, last 8
  rumours?: { id: string; line: string; starter: string; target: string; day: number; reached: string[] }[]; // T13: planted, settled on a Friday
  delegated: Record<string, string>; // area id -> person id
  delegateLog?: { week: number; who: string; need: Meter; stance: string }[]; // T11: cards a delegate answered, last 25
  depth: { money: boolean; building: boolean };
  ledger: {
    salaries: number;
    loans: { id: string; amount: number; due: number; repaid: boolean; missed?: boolean }[];
    budget?: Record<Meter, number>; // T15: this quarter's 100 points, missing = 25 each
    auditWeek?: number; // T15: the week of this quarter's audit, hidden from the player
    quarter: number;
    audit?: number;
  };
  buildOrders: { room: string; kind: "upgrade" | "decor" | "new"; doneWeek: number }[];
  legacy: { generation: number; heir?: string; from?: string; next?: string } | null; // from = the run id of the boss before
  yearbook: string[]; // child document ids, one per term
  pendingTerm: {
    term: number;
    review: string[];
    award?: string;
    done?: { who: string; pick: string }[]; // T10: reviews already given
    from?: number; // T10: s.closed range of this term, for the yearbook page
    closed?: number;
  } | null;
  openedRooms: string[]; // hidden rooms the boss has opened
  boss: { stress: number; energy: number; peak: number; weeksAt100: number }; // see core/boss.ts
  lastTerm: number; // the last term whose end ran (endTerm fires once per term)
}
