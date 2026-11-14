// ──────────────────────────────────────────────
// Wordle: each chat's daily results, kept in package storage
// ──────────────────────────────────────────────
// One document per chat holds every seat's board for each day. The engine
// wrapper in server-entry.ts writes a seat's board after every accepted guess,
// so the record comes from the server's own game, never from the browser.

const PACKAGE_ID = "wordle";
const KIND = "wordle-chat";
const MAX_ATTEMPTS = 3;
/** Days kept per chat; older days only matter to a streak longer than this. */
const KEEP_DAYS = 400;
const DAY_MS = 86_400_000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface WordleDocument {
  id: string;
  packageId: string;
  kind: string;
  name: string;
  description: string;
  data: unknown;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

/** The part of the Engine's `persistence.documents` the store uses (tests pass an in-memory fake). */
export interface WordleDocumentStore {
  getById(packageId: string, id: string): Promise<WordleDocument | null>;
  create(input: Omit<WordleDocument, "revision">): Promise<WordleDocument>;
  /** Resolves null when `expectedRevision` is stale. */
  update(input: {
    id: string;
    packageId: string;
    expectedRevision: number;
    name: string;
    description: string;
    data: unknown;
    updatedAt: string;
  }): Promise<WordleDocument | null>;
}

export interface WordlePersistence {
  documents: WordleDocumentStore;
}

export type WordleResultStatus = "playing" | "solved" | "failed";

export interface WordleDayResult {
  name: string;
  status: WordleResultStatus;
  guesses: number;
}

export interface WordleStanding {
  /** Solved days in a row, ending today or yesterday. */
  current: number;
  /** Solved days in a row ending yesterday: the streak going into today's game. */
  before: number;
  best: number;
  played: number;
  solved: number;
}

export interface WordleDaily {
  day: string;
  /** Today's result per seat. Any entry, even an unfinished one, means that seat has had its go today. */
  results: Record<string, WordleDayResult>;
  standings: Record<string, WordleStanding>;
}

type DayResults = Record<string, WordleDayResult>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function documentId(chatId: string): string {
  return `wordle-chat:${chatId}`;
}

function dayNumber(day: string): number {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
}

// Stored data is normalized on every read, so an older or hand-edited document still has the full shape.
function parseDays(document: WordleDocument | null): Record<string, DayResults> {
  const days: Record<string, DayResults> = {};
  const raw = document && isRecord(document.data) && isRecord(document.data.days) ? document.data.days : {};
  for (const [day, seats] of Object.entries(raw)) {
    if (!DAY_PATTERN.test(day) || !isRecord(seats)) continue;
    const results: DayResults = {};
    for (const [seatId, value] of Object.entries(seats)) {
      if (!isRecord(value)) continue;
      const status = value.status;
      if (status !== "playing" && status !== "solved" && status !== "failed") continue;
      const guesses = typeof value.guesses === "number" && Number.isFinite(value.guesses) ? value.guesses : 0;
      results[seatId] = {
        name: typeof value.name === "string" ? value.name : seatId,
        status,
        guesses: Math.max(0, Math.min(6, Math.floor(guesses))),
      };
    }
    days[day] = results;
  }
  return days;
}

function standingFor(days: Record<string, DayResults>, seatId: string, today: string): WordleStanding {
  const solvedOn = new Set<number>();
  let played = 0;
  for (const [day, results] of Object.entries(days)) {
    const result = results[seatId];
    if (!result) continue;
    played++;
    if (result.status === "solved") solvedOn.add(dayNumber(day));
  }
  const runEnding = (end: number) => {
    let length = 0;
    while (solvedOn.has(end - length)) length++;
    return length;
  };
  let best = 0;
  let run = 0;
  let previous = Number.NaN;
  for (const day of [...solvedOn].sort((a, b) => a - b)) {
    run = day === previous + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  const todayNumber = dayNumber(today);
  const before = runEnding(todayNumber - 1);
  return {
    current: solvedOn.has(todayNumber) ? before + 1 : before,
    before,
    best,
    played,
    solved: solvedOn.size,
  };
}

export function createWordleStore(persistence: WordlePersistence, options: { now?: () => string } = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  // One write at a time per chat, so a burst of bot guesses never races itself on the document revision.
  const queues = new Map<string, Promise<unknown>>();
  const serialized = <T>(chatId: string, operation: () => Promise<T>): Promise<T> => {
    const previous = queues.get(chatId) ?? Promise.resolve();
    const run = previous.then(operation, operation);
    const settled = run.catch(() => undefined);
    queues.set(chatId, settled);
    void settled.then(() => {
      if (queues.get(chatId) === settled) queues.delete(chatId);
    });
    return run;
  };

  async function change(chatId: string, apply: (days: Record<string, DayResults>) => boolean): Promise<void> {
    const id = documentId(chatId);
    const documents = persistence.documents;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const current = await documents.getById(PACKAGE_ID, id);
      const days = parseDays(current);
      if (!apply(days)) return;
      const kept = Object.keys(days).sort().slice(-KEEP_DAYS);
      const data = { days: Object.fromEntries(kept.map((day) => [day, days[day]])) };
      const at = now();
      const description = `Wordle results for ${kept.length} day${kept.length === 1 ? "" : "s"}`;
      if (!current) {
        try {
          await documents.create({
            id,
            packageId: PACKAGE_ID,
            kind: KIND,
            name: `Wordle: ${chatId}`,
            description,
            data,
            createdAt: at,
            updatedAt: at,
          });
          return;
        } catch (error) {
          // Another writer created it first: apply the change to theirs on the next attempt.
          if (!(await documents.getById(PACKAGE_ID, id))) throw error;
          continue;
        }
      }
      const saved = await documents.update({
        id,
        packageId: PACKAGE_ID,
        expectedRevision: current.revision,
        name: current.name,
        description,
        data,
        updatedAt: at,
      });
      if (saved) return;
    }
    throw new Error("Wordle results changed while saving.");
  }

  return {
    /** Keep a seat's board for the day. A finished result is final; an unfinished one follows the game. */
    recordBoard(chatId: string, day: string, seatId: string, result: WordleDayResult): Promise<void> {
      if (!chatId || !DAY_PATTERN.test(day)) return Promise.resolve();
      return serialized(chatId, () =>
        change(chatId, (days) => {
          const results = (days[day] ??= {});
          const previous = results[seatId];
          if (previous && (previous.status !== "playing" || previous.guesses > result.guesses)) return false;
          results[seatId] = result;
          return true;
        }),
      );
    },

    async getDaily(chatId: string, day: string): Promise<WordleDaily> {
      const document = chatId ? await persistence.documents.getById(PACKAGE_ID, documentId(chatId)) : null;
      const days = parseDays(document);
      const seatIds = new Set(Object.values(days).flatMap((results) => Object.keys(results)));
      return {
        day,
        results: days[day] ?? {},
        standings: Object.fromEntries([...seatIds].map((seatId) => [seatId, standingFor(days, seatId, day)])),
      };
    },
  };
}

export type WordleStore = ReturnType<typeof createWordleStore>;
