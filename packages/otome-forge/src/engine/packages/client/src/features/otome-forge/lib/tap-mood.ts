// ──────────────────────────────────────────────
// Otome Forge: which pre-written line a tap on Home plays (plan M3). The zone, the time of day in the player's zone
// (SH/home.ts timeOfDayOf, as the server writes the packs) and his mood pick the pool: more than 5 taps in 20 s and he
// is annoyed; during a rupture every line is cold. His own lines (GET .../lis/:li/lines) are used once they exist,
// the catalog's fallback lines until then. Pure: a tap never waits for a request.
// ──────────────────────────────────────────────
import type { LinesView } from "../shared/api-types";
import type { Face } from "../shared/faces";
import { soundsMedical, type TapZone, type TimeOfDay } from "../shared/home";

/** Home's time-of-day tint, a little finer than the packs' three parts of the day. */
export type SkyPhase = "dawn" | "day" | "dusk" | "night";

/** How he takes a tap: fondly, annoyed after too many, or coldly while a rupture is open. */
export type TapMode = "fond" | "annoyed" | "cold";

export const ANNOYED_AFTER_TAPS = 5;
export const ANNOYED_WINDOW_MS = 20_000;

const inWindow = (taps: readonly number[], now: number) =>
  taps.filter((at) => at <= now && now - at < ANNOYED_WINDOW_MS);

/** The taps still inside the window, then this one. */
export function recordTap(taps: readonly number[], now: number): number[] {
  return [...inWindow(taps, now), now];
}

/** More than five taps in the last twenty seconds. */
export function isAnnoyed(taps: readonly number[], now: number): boolean {
  return inWindow(taps, now).length > ANNOYED_AFTER_TAPS;
}

export function tapMode(taps: readonly number[], now: number, rupture: boolean): TapMode {
  return rupture ? "cold" : isAnnoyed(taps, now) ? "annoyed" : "fond";
}

/** The face he shows while a tap's line is on screen (one of his five, SH/faces.ts). */
export const TAP_FACES: Record<TapMode, Face> = { fond: "tender", annoyed: "flustered", cold: "cold" };

/**
 * His face on Home: the tap's while its line shows, else the one his note was written with, else cold while a rupture
 * stands, else his plain look (""). Home shows it painted once M2b has painted it, and names it either way.
 */
export function homeFace(note: Face | "", tap: TapMode | null, rupture: boolean): Face | "" {
  return tap ? TAP_FACES[tap] : note || (rupture ? "cold" : "");
}

/** The hour (0–23) in `timeZone`; the device's own hour when the zone can't be read. */
export function localHour(timeZone: string, now: Date): number {
  try {
    const hour = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" })
      .formatToParts(now)
      .find((part) => part.type === "hour")?.value;
    const value = Number(hour);
    if (Number.isInteger(value)) return value % 24;
  } catch {
    // An unknown zone falls through to the device's hour.
  }
  return now.getHours();
}

/** The player's local date in `timeZone` (YYYY-MM-DD), so Home notices when a new day starts; the device's own date when the zone can't be read. */
export function localDay(timeZone: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      now,
    );
  } catch {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
}

export function skyPhase(hour: number): SkyPhase {
  return hour >= 5 && hour < 9 ? "dawn" : hour >= 9 && hour < 17 ? "day" : hour >= 17 && hour < 20 ? "dusk" : "night";
}

const usable = (pool: unknown): string[] =>
  Array.isArray(pool) ? pool.filter((line): line is string => typeof line === "string" && line.trim() !== "") : [];

/** His own lines for this tap, or [] while he has none for it (no pack yet, or a pool it lacks). */
export function tapPool(lines: LinesView | null, zone: TapZone, part: TimeOfDay, mode: TapMode): string[] {
  if (!lines) return [];
  return usable(mode === "cold" ? lines.cold : mode === "annoyed" ? lines.annoyed : lines.tap?.[zone]?.[part]);
}

/**
 * His comfort lines for Rough day? and the Caring message, or [] until his fixed lines exist. A line that prescribes or
 * diagnoses is left out (the comfort rule), so the catalog's lines stand in when none is left.
 */
export function comfortPool(lines: LinesView | null): string[] {
  return usable(lines?.comfort).filter((line) => !soundsMedical(line));
}

// The catalog's lines (ui.otomeForge.fallback.*) until his own exist, as many as a pack holds (SH/home.ts
// LINE_COUNTS). Written for anyone: no pronouns, no question that waits for an answer, nothing about time apart.
// Literal keys, so the locale validator sees each one.
const FALLBACK_TAP_KEYS: Record<TapZone, readonly string[]> = {
  head: ["ui.otomeForge.fallback.tapHead1", "ui.otomeForge.fallback.tapHead2", "ui.otomeForge.fallback.tapHead3"],
  hand: ["ui.otomeForge.fallback.tapHand1", "ui.otomeForge.fallback.tapHand2", "ui.otomeForge.fallback.tapHand3"],
  heart: ["ui.otomeForge.fallback.tapHeart1", "ui.otomeForge.fallback.tapHeart2", "ui.otomeForge.fallback.tapHeart3"],
};
const FALLBACK_ANNOYED_KEYS = [
  "ui.otomeForge.fallback.annoyed1",
  "ui.otomeForge.fallback.annoyed2",
  "ui.otomeForge.fallback.annoyed3",
  "ui.otomeForge.fallback.annoyed4",
] as const;
const FALLBACK_COLD_KEYS = [
  "ui.otomeForge.fallback.cold1",
  "ui.otomeForge.fallback.cold2",
  "ui.otomeForge.fallback.cold3",
  "ui.otomeForge.fallback.cold4",
  "ui.otomeForge.fallback.cold5",
  "ui.otomeForge.fallback.cold6",
] as const;
export const FALLBACK_COMFORT_KEYS = [
  "ui.otomeForge.fallback.comfort1",
  "ui.otomeForge.fallback.comfort2",
  "ui.otomeForge.fallback.comfort3",
  "ui.otomeForge.fallback.comfort4",
  "ui.otomeForge.fallback.comfort5",
  "ui.otomeForge.fallback.comfort6",
  "ui.otomeForge.fallback.comfort7",
  "ui.otomeForge.fallback.comfort8",
] as const;

export function fallbackTapKeys(zone: TapZone, mode: TapMode): readonly string[] {
  return mode === "cold" ? FALLBACK_COLD_KEYS : mode === "annoyed" ? FALLBACK_ANNOYED_KEYS : FALLBACK_TAP_KEYS[zone];
}

/** One line of the pool, never the one just shown while there is another; null for an empty pool. */
export function pickLine(pool: readonly string[], last: string | null, random: () => number = Math.random) {
  const choices = pool.length > 1 ? pool.filter((line) => line !== last) : pool;
  if (choices.length === 0) return null;
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]!;
}
