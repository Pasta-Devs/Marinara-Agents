// ──────────────────────────────────────────────
// Otome Forge: what the tracker, the caring message and Remind Me keep in this browser, and nowhere else (plan §1.9)
// ──────────────────────────────────────────────
// `otome-forge:cycle:v1`      the period tracker (C/lib/cycle.ts CycleData)
// `otome-forge:care-note:v1`  today's caring messages, dropped when the day changes
// `otome-forge:profile:v1`    the player's own birthday, if they add one
// None of it is ever written to a package document, a memory, a ledger or a log. Browser storage may be missing or
// throw (private windows, blocked site data, a full quota), so every access is guarded: a read falls back to the
// defaults and a write reports whether it was kept. Each function takes the storage to use, so tests pass their own.
import { cleanStarts, isDayKey, normalizeCycle, type CycleData } from "./cycle";

export const CYCLE_STORAGE_KEY = "otome-forge:cycle:v1";
export const CARE_NOTE_STORAGE_KEY = "otome-forge:care-note:v1";
export const PROFILE_STORAGE_KEY = "otome-forge:profile:v1";

/** The part of the Web Storage API used here. */
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** This browser's localStorage, or null where it can't even be reached. */
export function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readJson(key: string, storage: StorageLike | null): unknown {
  try {
    const stored = storage?.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown, storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(key: string, storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

// ── The tracker ──

export function readCycle(storage: StorageLike | null = browserStorage()): CycleData {
  return normalizeCycle(readJson(CYCLE_STORAGE_KEY, storage));
}

/** False when this browser would not keep it (the change then lasts only while the screen is open). */
export function writeCycle(data: CycleData, storage: StorageLike | null = browserStorage()): boolean {
  return writeJson(CYCLE_STORAGE_KEY, normalizeCycle(data), storage);
}

/**
 * Applies `change` to the tracker as this browser holds it now, not to what a screen read earlier, so a change made in
 * another tab (the mode, Delete all) is never overwritten with old data, and writes the result. `held` is the screen's
 * own copy: it is changed instead only while `heldOnly` (this browser kept none of the screen's changes, so the copy
 * exists nowhere else). A change that changes nothing writes nothing, so Delete all is never undone by an empty write.
 */
export function updateCycle(
  held: CycleData,
  heldOnly: boolean,
  change: (data: CycleData) => CycleData,
  storage: StorageLike | null = browserStorage(),
): { data: CycleData; kept: boolean } {
  const base = heldOnly ? held : readCycle(storage);
  const next = change(base);
  if (next === base) return { data: base, kept: !heldOnly };
  const data = normalizeCycle(next);
  return { data, kept: writeCycle(data, storage) };
}

let deletions = 0;
/**
 * How many times Delete all has run on this page: a caring message or an import still on its way when it does is not
 * kept. Another tab's Delete all is invisible here; it shows as the cycle key gone (readCycle().enabled false).
 */
export const deletionCount = () => deletions;

/**
 * Delete all cycle data: the tracker and every caring message, in one go. True once neither is left; false when this
 * browser refused (blocked storage), and the page says so.
 */
export function deleteAllCycleData(storage: StorageLike | null = browserStorage()): boolean {
  deletions += 1;
  const cycle = remove(CYCLE_STORAGE_KEY, storage);
  const notes = remove(CARE_NOTE_STORAGE_KEY, storage);
  return cycle && notes;
}

// ── Export and import (a JSON file the player moves between devices themselves) ──

const EXPORT_FORMAT = "otome-forge-cycle";

export interface CycleExport {
  format: typeof EXPORT_FORMAT;
  version: 1;
  exportedAt: string;
  cycleLength: number;
  periodLength: number;
  irregular: boolean;
  starts: string[];
}

/** The file's text: lengths, irregular and the logged starts. The mode and the on switch stay with each device. */
export function exportCycle(data: CycleData, now: Date = new Date()): string {
  const file: CycleExport = {
    format: EXPORT_FORMAT,
    version: 1,
    exportedAt: now.toISOString(),
    cycleLength: data.cycleLength,
    periodLength: data.periodLength,
    irregular: data.irregular,
    starts: cleanStarts(data.starts),
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function exportFileName(todayKey: string): string {
  return `otome-forge-cycle-${isDayKey(todayKey) ? todayKey : "export"}.json`;
}

export type ImportResult = { ok: true; data: CycleData } | { ok: false; reason: "unreadable" | "not-cycle" };

/** The largest file read: an export of every start fits in well under 20 kB. */
export const IMPORT_BYTES_MAX = 100_000;

/**
 * Reads an exported file into `current`: its lengths, irregular and starts replace this device's, while the on switch
 * and the mode stay as they are, so an import never loosens "Keep it off the model".
 */
export function importCycle(text: string, current: CycleData): ImportResult {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  if (!isRecord(file) || file.format !== EXPORT_FORMAT || file.version !== 1 || !Array.isArray(file.starts)) {
    return { ok: false, reason: "not-cycle" };
  }
  const read = normalizeCycle({ ...file, enabled: current.enabled, mode: current.mode });
  return { ok: true, data: read };
}

// ── Today's caring messages ──

export interface CareNoteEntry {
  text: string;
  /** "model": written for today from the one line; "pool": one of their comfort lines. */
  source: "model" | "pool";
  /** Why this browser sent nothing and picked a comfort line itself; absent when the server answered. */
  reason?: "kept-off" | "debug";
  /** The day it answers (C/lib/cycle.ts careStateKey): a start logged later the same day makes it stale. */
  state: string;
  at: string;
}

interface CareNoteStore {
  version: 1;
  dayKey: string;
  /** `${runKey} ${li}` → today's note from that love interest. */
  notes: Record<string, CareNoteEntry>;
}

export const careNoteKey = (runKey: string, li: string) => `${runKey} ${li}`;

function readCareNotes(todayKey: string, storage: StorageLike | null): Record<string, CareNoteEntry> {
  const stored = readJson(CARE_NOTE_STORAGE_KEY, storage);
  if (!isRecord(stored)) return {};
  if (stored.dayKey !== todayKey || !isRecord(stored.notes)) {
    // Another day's notes (or a damaged entry) go as soon as they are seen.
    remove(CARE_NOTE_STORAGE_KEY, storage);
    return {};
  }
  const notes: Record<string, CareNoteEntry> = {};
  for (const [key, entry] of Object.entries(stored.notes)) {
    if (!isRecord(entry) || typeof entry.text !== "string" || !entry.text.trim()) continue;
    const source = entry.source === "model" ? "model" : "pool";
    const reason: CareNoteEntry["reason"] =
      entry.reason === "kept-off" || entry.reason === "debug" ? entry.reason : undefined;
    notes[key] = {
      text: entry.text,
      source,
      ...(reason ? { reason } : {}),
      state: typeof entry.state === "string" ? entry.state : "",
      at: typeof entry.at === "string" ? entry.at : "",
    };
  }
  return notes;
}

/** Today's caring message from one love interest, or null. Notes from another day are removed here. */
export function readCareNote(
  todayKey: string,
  key: string,
  storage: StorageLike | null = browserStorage(),
): CareNoteEntry | null {
  return readCareNotes(todayKey, storage)[key] ?? null;
}

export function writeCareNote(
  todayKey: string,
  key: string,
  entry: CareNoteEntry,
  storage: StorageLike | null = browserStorage(),
): boolean {
  const store: CareNoteStore = {
    version: 1,
    dayKey: todayKey,
    notes: { ...readCareNotes(todayKey, storage), [key]: entry },
  };
  return writeJson(CARE_NOTE_STORAGE_KEY, store, storage);
}

/** Drops caring messages kept for any day but `todayKey` (as Otome Forge opens, and as Home sees the day change). */
export function dropStaleCareNotes(todayKey: string, storage: StorageLike | null = browserStorage()): void {
  readCareNotes(todayKey, storage);
}

// ── The player's own birthday (opt-in, this device only) ──

const MONTH_DAY = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/u;
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** "MM-DD" for a day some year has (02-29 included). */
export function isMonthDay(value: unknown): value is string {
  const match = typeof value === "string" ? MONTH_DAY.exec(value) : null;
  return !!match && Number(match[2]) <= DAYS_IN_MONTH[Number(match[1]) - 1]!;
}

export interface PlayerProfile {
  version: 1;
  /** "MM-DD", or null when not given. */
  birthday: string | null;
}

export function readProfile(storage: StorageLike | null = browserStorage()): PlayerProfile {
  const stored = readJson(PROFILE_STORAGE_KEY, storage);
  const birthday = isRecord(stored) && isMonthDay(stored.birthday) ? stored.birthday : null;
  return { version: 1, birthday };
}

/** A profile with nothing in it is removed rather than kept. */
export function writeProfile(profile: PlayerProfile, storage: StorageLike | null = browserStorage()): boolean {
  if (!isMonthDay(profile.birthday)) return remove(PROFILE_STORAGE_KEY, storage);
  return writeJson(PROFILE_STORAGE_KEY, { version: 1, birthday: profile.birthday }, storage);
}
