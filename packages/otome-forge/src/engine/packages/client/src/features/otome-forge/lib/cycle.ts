// ──────────────────────────────────────────────
// Otome Forge: the period tracker's arithmetic (plan M6), for anyone who has periods. Pure: no storage, no DOM.
// ──────────────────────────────────────────────
// What the player logs stays in this browser (C/lib/cycle-storage.ts). A prompt only ever receives `careLine`: one
// templated line about today, never the history. "Late" is never computed: a predicted start that passes without a
// logged one simply gives way to the next prediction. With `irregular` on, nothing is predicted and only logged starts
// count. Day keys are local dates ("YYYY-MM-DD") in the conversation's time zone (C/lib/tap-mood.ts localDay); the
// arithmetic below treats them as plain calendar dates, so no clock or zone can shift a day.

export const CYCLE_LENGTH = { min: 21, max: 45, fallback: 28 } as const;
export const PERIOD_LENGTH = { min: 2, max: 8, fallback: 5 } as const;
/** "Due in N days" is said only this close to a predicted start. */
export const DUE_SOON_DAYS = 3;
/** Logged starts kept: about fifteen years of monthly cycles. */
export const STARTS_MAX = 200;

export const CYCLE_MODES = ["send-today", "keep-off-model"] as const;
export type CycleMode = (typeof CYCLE_MODES)[number];

/** `otome-forge:cycle:v1`. Off by default; once on, today's line may be sent unless the stricter mode is chosen. */
export interface CycleData {
  version: 1;
  enabled: boolean;
  mode: CycleMode;
  cycleLength: number;
  periodLength: number;
  irregular: boolean;
  /** Logged first days, "YYYY-MM-DD", oldest first, no repeats. */
  starts: string[];
}

/** Today, as far as the tracker says anything: day `n` of a logged period, a predicted start soon, or around today. */
export type CycleToday = { kind: "day"; n: number } | { kind: "due"; inDays: number } | { kind: "due-today" };

/** A day on the calendar: part of a logged period (up to today), or a predicted one (from today on). */
export type CycleMark = "logged" | "predicted";

export function defaultCycle(): CycleData {
  return {
    version: 1,
    enabled: false,
    mode: "send-today",
    cycleLength: CYCLE_LENGTH.fallback,
    periodLength: PERIOD_LENGTH.fallback,
    irregular: false,
    starts: [],
  };
}

// ── Day keys ──

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/u;
const MS_PER_DAY = 86_400_000;

/** Days since 1970-01-01 for a real calendar date, else NaN. */
export function dayNumber(dayKey: string): number {
  const match = DAY_KEY.exec(dayKey);
  if (!match) return Number.NaN;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  // Date.UTC rolls 02-30 over into March; a real date reads back unchanged.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return Number.NaN;
  }
  return time / MS_PER_DAY;
}

export function isDayKey(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(dayNumber(value));
}

export function dayKeyOf(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(dayKey: string, days: number): string {
  return dayKeyOf(dayNumber(dayKey) + days);
}

// ── Reading stored or imported data, field by field ──

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

function wholeIn(value: unknown, { min, max, fallback }: { min: number; max: number; fallback: number }): number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

/** Real dates only, each once, oldest first, the newest STARTS_MAX kept. */
export function cleanStarts(value: unknown): string[] {
  const days = Array.isArray(value) ? value.filter(isDayKey) : [];
  return [...new Set(days)].sort().slice(-STARTS_MAX);
}

/** Stored or imported tracker data with every field checked; anything missing or damaged takes its default. */
export function normalizeCycle(value: unknown): CycleData {
  const fallback = defaultCycle();
  if (!isRecord(value)) return fallback;
  return {
    version: 1,
    enabled: value.enabled === true,
    mode: CYCLE_MODES.includes(value.mode as CycleMode) ? (value.mode as CycleMode) : fallback.mode,
    cycleLength: wholeIn(value.cycleLength, CYCLE_LENGTH),
    periodLength: wholeIn(value.periodLength, PERIOD_LENGTH),
    irregular: value.irregular === true,
    starts: cleanStarts(value.starts),
  };
}

/** Logs `dayKey` as a first day. A day after today, or one already logged, changes nothing. */
export function logStart(data: CycleData, dayKey: string, todayKey: string): CycleData {
  const day = dayNumber(dayKey);
  if (!Number.isFinite(day) || day > dayNumber(todayKey) || data.starts.includes(dayKey)) return data;
  return { ...data, starts: cleanStarts([...data.starts, dayKey]) };
}

export function removeStart(data: CycleData, dayKey: string): CycleData {
  return data.starts.includes(dayKey) ? { ...data, starts: data.starts.filter((start) => start !== dayKey) } : data;
}

// ── Today and the calendar ──

/** The newest logged start on or before `today`, as a day number, or null. */
function lastStart(data: CycleData, today: number): number | null {
  let last: number | null = null;
  for (const start of data.starts) {
    const day = dayNumber(start);
    if (day <= today && (last === null || day > last)) last = day;
  }
  return last;
}

/** The first predicted start on or after `from` (counting whole cycles on from the last logged start), or null. */
function nextPredicted(data: CycleData, last: number | null, from: number): number | null {
  if (data.irregular || last === null) return null;
  const cycles = Math.max(1, Math.ceil((from - last) / data.cycleLength));
  return last + cycles * data.cycleLength;
}

/**
 * What the tracker says about `todayKey`, or null: off, nothing logged, an ordinary day, or a predicted start that has
 * passed (never "late"). Day `n` comes only from a logged start; "due" only from a prediction.
 */
export function cycleToday(data: CycleData, todayKey: string): CycleToday | null {
  const today = dayNumber(todayKey);
  if (!data.enabled || !Number.isFinite(today)) return null;
  const last = lastStart(data, today);
  if (last !== null && today - last < data.periodLength) return { kind: "day", n: today - last + 1 };
  const next = nextPredicted(data, last, today);
  if (next === null) return null;
  const inDays = next - today;
  if (inDays === 0) return { kind: "due-today" };
  return inDays <= DUE_SOON_DAYS ? { kind: "due", inDays } : null;
}

/**
 * The marked days from `fromKey` to `toKey` (inclusive): each logged period's days up to today, the rest of the
 * current one from tomorrow as predicted, and every predicted period that starts today or later. A prediction that
 * has passed is never drawn (that would read as "late"). Irregular predicts nothing, the rest of the current period
 * included, so only logged days are marked. Off: none.
 */
export function cycleMarks(data: CycleData, fromKey: string, toKey: string, todayKey: string): Map<string, CycleMark> {
  const marks = new Map<string, CycleMark>();
  const [from, to, today] = [dayNumber(fromKey), dayNumber(toKey), dayNumber(todayKey)];
  if (!data.enabled || ![from, to, today].every(Number.isFinite) || to < from) return marks;
  const mark = (day: number, kind: CycleMark) => {
    if (day < from || day > to) return;
    const key = dayKeyOf(day);
    if (marks.get(key) !== "logged") marks.set(key, kind);
  };
  for (const start of data.starts) {
    const first = dayNumber(start);
    if (first > today) continue;
    for (let day = first; day < first + data.periodLength && (day <= today || !data.irregular); day += 1) {
      mark(day, day <= today ? "logged" : "predicted");
    }
  }
  const last = lastStart(data, today);
  for (let next = nextPredicted(data, last, today); next !== null && next <= to; next += data.cycleLength) {
    for (let day = next; day < next + data.periodLength; day += 1) mark(day, "predicted");
  }
  return marks;
}

/** The next predicted first day on or after today ("YYYY-MM-DD"), for Remind Me's "coming up"; null when none. */
export function nextPredictedStart(data: CycleData, todayKey: string): string | null {
  const today = dayNumber(todayKey);
  if (!data.enabled || !Number.isFinite(today)) return null;
  const next = nextPredicted(data, lastStart(data, today), today);
  return next === null ? null : dayKeyOf(next);
}

// ── The care line: the only thing about the cycle a prompt may ever receive ──

export interface CareProtagonist {
  name: string;
  pronouns?: { possessive?: string } | null;
}

/** Her possessive pronoun from her profile, "their" when there is none. */
export function possessiveOf(protagonist: CareProtagonist): string {
  return protagonist.pronouns?.possessive?.trim() || "their";
}

/**
 * "{Name} has told you: today is day {n} of their period." (or "…their period is due in {n} days." / "…due around
 * today."). In English whatever the locale: it is prompt text, which is never localized. Because she told him, he may
 * know it. S/care/prompts.ts accepts exactly these (allowedCareLines mirrors careLines; a regression pins the two).
 */
export function careLine(state: CycleToday, protagonist: CareProtagonist): string {
  const name = protagonist.name.trim() || "The protagonist";
  const their = possessiveOf(protagonist);
  if (state.kind === "day") return `${name} has told you: today is day ${state.n} of ${their} period.`;
  if (state.kind === "due-today") return `${name} has told you: ${their} period is due around today.`;
  return `${name} has told you: ${their} period is due in ${state.inDays} ${state.inDays === 1 ? "day" : "days"}.`;
}

/** Today's state in a few characters ("day:2", "due:1", "due-today"): a kept caring message answers only this one. */
export function careStateKey(state: CycleToday): string {
  return state.kind === "day" ? `day:${state.n}` : state.kind === "due" ? `due:${state.inDays}` : "due-today";
}

/** Every line careLine can give for this protagonist: day 1..8, due in 1..3 days, due around today. */
export function careLines(protagonist: CareProtagonist): string[] {
  const states: CycleToday[] = [{ kind: "due-today" }];
  for (let n = 1; n <= PERIOD_LENGTH.max; n += 1) states.push({ kind: "day", n });
  for (let inDays = 1; inDays <= DUE_SOON_DAYS; inDays += 1) states.push({ kind: "due", inDays });
  return states.map((state) => careLine(state, protagonist));
}

/** True only for one of careLine's own lines, character for character: free text never passes. */
export function isCareLine(line: unknown, protagonist: CareProtagonist): boolean {
  return typeof line === "string" && careLines(protagonist).includes(line);
}

/**
 * How a caring message is voiced (M2b's OtomeAudioController.speak): with no `cacheKey`, so its audio never lands in
 * the Engine's audio cache (plan §1.9).
 */
export function careSpeakOptions(): { cache: false } {
  return { cache: false };
}
