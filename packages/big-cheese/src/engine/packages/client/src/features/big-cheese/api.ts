// ──────────────────────────────────────────────
// Big Cheese: requests to the package's routes, through the Engine's API client
// ──────────────────────────────────────────────
import { api, ApiError } from "../../lib/api-client";

const PREFIX = "/big-cheese";

export type RunMode = "normal" | "honest" | "sandbox" | "ironman";
export interface RunSummary {
  adult?: boolean; // the run has the adult module on: the title card shows "18+"
  mode?: RunMode;
  cheeseMark?: boolean;
  generation?: number; // M4 T6: 2 or more on a legacy run
  id: string;
  newer: boolean;
  kitId?: string;
  week?: number;
  day?: number;
  updatedAt: string;
}

// The client's view of the run document (server core/types.ts), only the fields the screens read.
export type Meter = "money" | "output" | "people" | "standing";
export type Meters = Record<Meter, number>;

export interface Card {
  id: string;
  thread: string;
  asker: string;
  need: Meter;
  age: number;
  answers: { tier: string; stance: string }[];
}

export interface Person {
  trust: number;
  stress: number;
  mood: string;
  influence?: number; // T11: advisors only
  status?: string; // T11: "active", "quit", ...
  room: string; // a room id, or "home"
  memories: { week: number; thread: string; stance: string }[];
}

export interface Thread {
  id: string;
  kind: string;
  title: string;
  need?: Meter;
  people: string[];
  stakes: string;
  clock: { dueWeek: number | "open"; pressure: string };
  secret?: boolean;
  layer?: string; // T5: the story layer that opened it
  system?: string; // the kit system that opened it
  beats: {
    read?: boolean;
    type?: string;
    planned?: { week: number; day: number };
    blueprint?: string;
    result?: string;
  }[];
  promise?: { to: string; what: string; due: { week: number; day: number }; kept: boolean };
}

export interface MeetingItem {
  id: string;
  title: string;
  thread?: string; // T5: the thread the item came from
  deputy?: boolean;
  base: Record<string, number>; // each attendee's score before the boss speaks
  lines: { who: string; text: string }[];
  suggestions: { stance: string; text: string }[];
  chosen?: string;
  scores?: Record<string, number>;
  passed?: boolean;
  swing?: string[]; // M4 T12
}

export interface Meeting {
  kind: string;
  mode: "vote" | "agreement";
  people: string[];
  items: MeetingItem[];
  done: boolean;
}

export interface Hearing {
  meter: Meter;
  week: number;
  day: number;
  witnesses: string[];
  evidence: string[];
  favour?: string; // M4 T12
}

export interface Game {
  mode?: RunMode;
  // T13: what the Board's settings groups read
  authority?: "manager" | "strong_leader" | "absolute";
  layers?: Record<string, number>;
  legacy?: { generation: number; heir?: string; from?: string; next?: string } | null; // M4 T6
  tally?: Record<string, number>; // M4: counters; `clear.<thread>.<person>` marks a cleared suspect
  culture?: Record<string, number>; // M4 T1: tag -> points
  traditions?: { id: string; text: string; count: number; active: boolean }[];
  perkOffer?: string[] | null; // M4 T8
  depth?: { money: boolean; building: boolean }; // M4 T15
  difficulty?: string;
  storyteller?: string;
  mutators?: string[];
  wishPoints?: { term: number; left: number }; // in-run wishes (design.md 3.7)
  cheeseMark?: boolean;
  clock: { week: number; day: number; hoursLeft: number };
  meters: Meters;
  people: Record<string, Person>;
  threads: Record<string, Thread>;
  closed: { id: string; state: string; title?: string; need?: Meter }[];
  systems?: Record<string, { on: boolean; fixtures?: { week: number; won?: boolean }[] }>; // the season table
  inbox: Card[];
  rooms: Record<string, { condition: number; people: string[] }>;
  relations: { a: string; b: string; kind: string; level: number }[];
  grapevine: string[]; // ids of rumour lines in `text.place.grapevine`
  informants?: { person: string; target: string; kind: "room" | "group"; paid: boolean }[]; // M4 T13
  eyes?: { week: number; text: string }[]; // M4 T13
  delegated?: Record<string, string>; // M4 T11: area (meter, room or group id) -> person
  favours?: { from: string; to?: string; why: string; week: number; used: boolean }[]; // M4 T12
  leverage?: { about: string; thread?: string; used: boolean; found: boolean }[]; // M4 T12
  delegateLog?: { week: number; who: string; need: Meter; stance: string }[]; // M4 T11
  advisors?: string[]; // T11: person ids in the inner circle (up to 3)
  officeHours?: { day: number; slot: string; visitors: string[] }; // T11: one booked hour, up to 4 visitors
  pendingTerm?: { term: number; review: string[]; award?: string } | null; // T10: the term review that is open
  hearing: Hearing | null;
  hearingBody: { id: string }[];
  meeting?: Meeting | null;
  status: "playing" | "complete" | "ended";
  adult?: { intensity: number; themes: string[] } | null;
  things?: {
    drawer: { id: string; kind: string; name: string; about?: string; thread?: string }[];
    equipment: { id: string; name: string; room?: string; condition: number }[];
  }; // M4 T2
  openedRooms?: string[];
  minigame?: MiniGame | null; // M4 T17
  ending: string | null;
  report: { week: number; income: number; before: Meters; after: Meters } | null;
}

export interface ScenePart {
  lines: { who: string; text: string }[];
  suggestions: { stance: string; text: string }[];
  summary: string;
  chosen?: string;
}

export interface SceneText {
  blueprint: string;
  title: string;
  room: string;
  people: string[];
  parts: ScenePart[];
  total: number;
  done: boolean;
  outcome?: string;
}

// What the rooms and the grapevine wrote (server place.ts).
export interface PlaceText {
  day: number;
  evening: number;
  morning: { room: string; person: string; text: string }[];
  visit?: { room: string; lines: { person: string; text: string }[] };
  known: string[];
  grapevine: Record<string, { source: string; text: string }>;
}

/** M4 T9: the ending card of a finished run (server endings.ts), sent in `run.end`. */
export interface EndCard {
  id: string | null;
  title: string;
  text: string;
  achievements: { id: string; name: string }[];
}
export interface RunDoc {
  end?: EndCard;
  id: string;
  revision: number;
  kitId: string;
  lite: boolean;
  game: Game;
  text: {
    cards: Record<
      string,
      { line: string; answers: { stance: string; text: string }[]; advice?: { who: string; text: string }[] }
    >;
    scenes: Record<string, SceneText>;
    feelings: Record<string, { person: string; band: string; line: string }[]>;
    place?: PlaceText;
  };
  scene: string | null;
  /** Added people and visitors: a visitor leaves on day number `until`. */
  cast?: { people: Record<string, { until?: number }> };
}

export interface KitPerson {
  id: string;
  name: string;
  role: string;
  hue: string | number;
  deputy?: boolean;
  traits: string[];
  library?: boolean; // cast from the player's Engine library
  avatar?: string;
}

export interface KitView {
  id: string;
  name: string;
  premise: string;
  bossTitle: string;
  boss?: { name: string; avatar: string }; // the player's persona
  meters: Record<Meter, { label: string }>;
  people: KitPerson[];
  rooms: { id: string; name: string; text: string; kind?: string }[];
  groups?: { id: string; name: string }[]; // M4 T13
  letters: { day: number; person: string; screen: string; text: string }[];
}

export interface RunState {
  run: RunDoc;
  kit: KitView;
}

// Each key is a literal, so the locale validator finds it.
const ERROR_KEYS: Record<string, string> = {
  "bad-request": "ui.bigCheese.errors.badRequest",
  "bad-kit": "ui.bigCheese.errors.badKit",
  "not-found": "ui.bigCheese.errors.notFound",
  conflict: "ui.bigCheese.errors.conflict",
  "newer-save": "ui.bigCheese.errors.newerSave",
  "under-age": "ui.bigCheese.errors.underAge",
  "wrong-phase": "ui.bigCheese.errors.wrongPhase",
  "no-hours": "ui.bigCheese.errors.noHours",
  "stale-preview": "ui.bigCheese.errors.stalePreview",
  "confirm-later": "ui.bigCheese.errors.confirmLater",
  ironman: "ui.bigCheese.errors.ironman",
  "honest-first": "ui.bigCheese.errors.honestFirst",
};
export const CONFLICT_KEY = ERROR_KEYS.conflict;

/** The localized message key for a failed request. */
export function errorKey(error: unknown): string {
  if (error instanceof ApiError) {
    const code = (error.payload as { code?: unknown } | undefined)?.code;
    if (typeof code === "string" && Object.hasOwn(ERROR_KEYS, code)) return ERROR_KEYS[code];
    if (error.status === 403) return "ui.bigCheese.errors.adminAccess";
  }
  return "ui.bigCheese.errors.unknown";
}

const runPath = (id: string) => `${PREFIX}/runs/${encodeURIComponent(id)}`;

export const listRuns = () => api.get<{ runs: RunSummary[] }>(`${PREFIX}/runs`).then((r) => r.runs);
export const createRun = (kitId: string, cast: StartBody = {}, savedKit?: string) =>
  api.post<{ run: { id: string } }>(`${PREFIX}/runs`, { kitId, ...cast, savedKit });

// The cast picker (server cast.ts): library lists, one casting sheet per picked card, and the run's cast.
export interface CastItem {
  id: string;
  name: string;
  line: string;
  avatar: string;
}
export interface CastList {
  characters: CastItem[];
  personas: CastItem[];
  traits: string[];
}
export interface CastSheet {
  role: string;
  traits: string[];
  tone: string;
  lines: string[];
  core: string;
}
export interface CastRead {
  slots: { id: string; role: string; name: string }[];
  sheet: CastSheet;
}
export interface StartBody {
  mode?: RunMode;
  systems?: SystemEdit[];
  boss?: string;
  staff?: { characterId: string; replaces: string; sheet: CastSheet }[];
}
export const listCast = () => api.get<CastList>(`${PREFIX}/cast`);
export const readCast = (kitId: string, characterId: string) =>
  api.post<CastRead>(`${PREFIX}/cast/read`, { kitId, characterId });
export const deleteRun = (id: string) => api.delete<{ ok: true }>(runPath(id));
export const getRun = (id: string) => api.get<RunState>(runPath(id));
/** One game action: `path` is relative to the run, e.g. `day/start` or `cards/c3/answer`. */
export const postAction = (run: RunDoc, path: string, body: object = {}) =>
  api.post<RunState>(`${runPath(run.id)}/${path}`, { ...body, expectedRevision: run.revision });

// M4 T17: mini-games (Speech and Interview). T18 reuses the same shape.
export interface MiniGame {
  kind: string;
  people: string[];
  need: number;
  min?: number;
  options: { id: string; tag: string; text: string }[];
  week: number;
  done: {
    picks: string[];
    steps: { id: string; tag: string; text: string; value: number; trait?: string }[];
    score: number;
    outcome: "great" | "good" | "flat" | "bad";
    revealed: string[];
    lines: { who: string; text: string }[];
  } | null;
}

// T3: the wish and the kit draft (design.md section 13). `kit` is the whole draft; the client only holds it.
export type DraftPart = "all" | "people" | "rooms" | "name";
export interface WishBody {
  wish: string;
  size: "small" | "medium" | "large";
  storyteller: "calm" | "classic" | "chaos";
  authority: "manager" | "strong_leader" | "absolute";
  fixed?: string[];
  part?: DraftPart;
  kit?: unknown;
}
export const draftPlace = (body: WishBody) =>
  api.post<{ kit: unknown; view: PreviewKit; lite: boolean }>(`${PREFIX}/place/draft`, body);

// T6: the Preview screen (ui.md section 5.3).
export interface SystemEdit {
  index: number;
  name?: string;
  remove?: true;
}
export type PreviewKit = KitView & { systems: { kind: string; name: string; text: string }[] };
export const previewKit = (kitId: string, cast: StartBody = {}) =>
  api.post<{ kit: PreviewKit }>(`${PREFIX}/preview`, { kitId, ...cast }).then((r) => r.kit);

// T7: house rules and decrees (server rules.ts).
export interface RulesState {
  authority: string;
  power: { fear: number; love: number };
  legitimacy: number | null;
  enforcer: boolean;
  rules: { id: string; text: string; options: string[]; decree: boolean; current: string }[];
  proposals: string[];
}
export const getRules = (id: string) => api.get<RulesState>(`${runPath(id)}/rules`);

/** The model call debug log: task name, outcome and time only (server ai/tasks.ts). */
export type CallEntry = { task: string; outcome: "ok" | "retry" | "refusal" | "lite"; ms: number };
export const getCalls = (id: string) => api.get<{ calls: CallEntry[] }>(`${runPath(id)}/calls`);

// T1: the saved kits library (design.md section 13 step 4).
export interface KitSummary {
  id: string;
  name: string;
  family: string;
  premise: string;
  updatedAt: string;
}
export const listKits = () => api.get<{ kits: KitSummary[] }>(`${PREFIX}/kits`).then((r) => r.kits);
// T13: the kit a running place plays now, for the Board's "Edit the kit".
export const getRunKit = (runId: string) => api.get<unknown>(`${runPath(runId)}/kit`);
export const getKit = (id: string) => api.get<unknown>(`${PREFIX}/kits/${encodeURIComponent(id)}`);
export const importKit = (kit: unknown) =>
  api.post<{ kit: { id: string; name: string }; fixes: string[] }>(`${PREFIX}/kits/import`, { kit });
// T2: the Kit editor saves the same way an import does, with the same checks.
export const saveKit = (kit: unknown) =>
  api.post<{ kit: { id: string; name: string }; fixes: string[] }>(`${PREFIX}/kits`, { kit });

// T14: save to the Engine library (cast.md section 8). `preview` builds without writing.
export interface ExportBody {
  adult?: boolean;
  preview?: boolean;
}
export interface ExportEntry {
  name: string;
  content: string;
}
export const exportLorebook = (id: string, kind: "memories" | "place", body: ExportBody) =>
  api.post<{ entries?: ExportEntry[]; name?: string; count?: number }>(`${runPath(id)}/export/lorebook`, {
    kind,
    ...body,
  });
export const exportNote = (id: string, body: ExportBody) =>
  api.post<{ description?: string; saved?: boolean }>(`${runPath(id)}/export/persona-note`, { kind: "note", ...body });

/** M4 T21: a V2 character card for one generated person, and a call line with one person. */
export const exportCard = (id: string, personId: string, adult: boolean) =>
  api.post<{ card: { data: { name: string } } }>(`${runPath(id)}/export/character`, { personId, adult });
export interface CallLine {
  who: "you" | "them";
  text: string;
}
export const callSomeone = (
  id: string,
  personId: string,
  body: { expectedRevision: number; topic: string; earlier: CallLine[] },
) => api.post<{ line: string }>(`${runPath(id)}/people/${encodeURIComponent(personId)}/call`, body);

// T14: out of the office (server outside.ts).
export interface OutsideState {
  invitation: { host: string; people: string[] } | null;
  tripUsed: boolean;
  tripRooms: { id: string; name: string }[];
}
export const getOutside = (id: string) => api.get<OutsideState>(`${runPath(id)}/outside`);

// M4 T8: term goals and perks (server goals.ts).
export interface PerkInfo {
  id: string;
  name: string;
  text: string;
}
export interface GoalsState {
  term: number;
  set: boolean;
  offered: { id: string; text: string; meter?: Meter }[];
  picked: { id: string; text: string; ok: boolean }[];
  history: { term: number; picked: string[]; met: string[] }[];
  perks: PerkInfo[];
  perkOffer: PerkInfo[];
}
export const getGoals = (id: string) => api.get<GoalsState>(`${runPath(id)}/goals`);

// M4 T10: term reviews, the award and the yearbook (server chronicle.ts).
export interface ChronicleState {
  pending: { term: number; review: string[]; award?: string; done?: { who: string; pick: string }[] } | null;
  pages: { term: number; title: string; text: string; source: "model" | "lite" }[];
}
export const getChronicle = (id: string) => api.get<ChronicleState>(`${runPath(id)}/chronicle`);

// M4 T15: detailed money (server ledger.ts). The audit week stays hidden.
export interface LedgerState {
  on: boolean;
  week: number;
  quarter: number;
  revenue: number;
  salaries: number;
  upkeep: number;
  audit: number | null;
  loans: { id: string; amount: number; due: number; repaid: boolean; missed?: boolean; owed: number }[];
  budget: Record<Meter, number>;
  even: Record<Meter, number>;
  offers: { amounts: number[]; weeks: number[] };
}
export const getLedger = (id: string) => api.get<LedgerState>(`${runPath(id)}/ledger`);

/** M4 T16: detailed building (server building.ts). */
export interface BuildingState {
  on: boolean;
  week: number;
  money: number;
  maxOpen: number;
  maxUpgrades: number;
  prices: Record<string, number>;
  weeks: Record<string, number>;
  open: { room: string; kind: "upgrade" | "decor" | "new"; doneWeek: number }[];
  rooms: { id: string; condition: number; cap: number; upgrades: number; decor: boolean; name?: string }[];
}
export const getBuilding = (id: string) => api.get<BuildingState>(`${runPath(id)}/building`);

/** T19: a line of the relationship map. The server sends only the relations the boss knows. */
export interface MapRelation {
  a: string;
  b: string;
  kind: string;
  secret: boolean;
}
export const getRelations = (id: string) => api.get<{ relations: MapRelation[] }>(`${runPath(id)}/relations`);
