// ──────────────────────────────────────────────
// Big Cheese: requests to the package's routes, through the Engine's API client
// ──────────────────────────────────────────────
import { api, ApiError } from "../../lib/api-client";

const PREFIX = "/big-cheese";

export interface RunSummary {
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
  mood: string;
  memories: { week: number; thread: string; stance: string }[];
}

export interface Thread {
  id: string;
  kind: string;
  title: string;
  people: string[];
  stakes: string;
  beats: { read?: boolean }[];
  promise?: { to: string; what: string; due: { week: number; day: number }; kept: boolean };
}

export interface Hearing {
  meter: Meter;
  week: number;
  day: number;
  witnesses: string[];
  evidence: string[];
}

export interface Game {
  clock: { week: number; day: number; hoursLeft: number };
  meters: Meters;
  people: Record<string, Person>;
  threads: Record<string, Thread>;
  closed: { id: string; state: string }[];
  inbox: Card[];
  hearing: Hearing | null;
  hearingBody: { id: string }[];
  status: "playing" | "complete" | "ended";
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

export interface RunDoc {
  id: string;
  revision: number;
  kitId: string;
  lite: boolean;
  game: Game;
  text: {
    cards: Record<string, { line: string; answers: { stance: string; text: string }[] }>;
    scenes: Record<string, SceneText>;
    feelings: Record<string, { person: string; band: string; line: string }[]>;
  };
  scene: string | null;
}

export interface KitPerson {
  id: string;
  name: string;
  role: string;
  hue: string | number;
  deputy?: boolean;
  traits: string[];
}

export interface KitView {
  id: string;
  name: string;
  premise: string;
  bossTitle: string;
  meters: Record<Meter, { label: string }>;
  people: KitPerson[];
  rooms: { id: string; name: string; text: string }[];
  letters: { day: number; person: string; screen: string; text: string }[];
}

export interface RunState {
  run: RunDoc;
  kit: KitView;
}

// Each key is a literal, so the locale validator finds it.
const ERROR_KEYS: Record<string, string> = {
  "bad-request": "ui.bigCheese.errors.badRequest",
  "not-found": "ui.bigCheese.errors.notFound",
  conflict: "ui.bigCheese.errors.conflict",
  "newer-save": "ui.bigCheese.errors.newerSave",
  "wrong-phase": "ui.bigCheese.errors.wrongPhase",
  "no-hours": "ui.bigCheese.errors.noHours",
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
export const createRun = (kitId: string) => api.post<{ run: { id: string } }>(`${PREFIX}/runs`, { kitId });
export const deleteRun = (id: string) => api.delete<{ ok: true }>(runPath(id));
export const getRun = (id: string) => api.get<RunState>(runPath(id));
/** One game action: `path` is relative to the run, e.g. `day/start` or `cards/c3/answer`. */
export const postAction = (run: RunDoc, path: string, body: object = {}) =>
  api.post<RunState>(`${runPath(run.id)}/${path}`, { ...body, expectedRevision: run.revision });
