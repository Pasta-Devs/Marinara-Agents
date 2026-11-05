/** Pure clock, window, lease and backoff math. No I/O, so tests can run it without an Engine. */

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const SPEEDS = [0, 1, 24] as const;
export const SPEED_MAX = 1440; // custom speeds: 0 to 1440 (one real minute = one Circle day)
export const LONG_ABSENCE_DAYS = 3;
export const RUN_AHEAD_MS = 6 * HOUR; // a run needs this much unseen Circle time
export const BACKGROUND_EVERY_MS = 6 * HOUR; // real time, for the background-timer switch
export const POLL_MS = 5 * 60_000;
export const FIRST_POLL_MS = 90_000;
export const LEASE_MS = 30 * 60_000;
export const BACKOFF_BASE_MS = 5 * 60_000;
export const BACKOFF_MAX_MS = 30 * 60_000;

export interface Clock {
  anchorCircle: string; // ISO instant
  anchorReal: number; // epoch ms
  speed: number;
  timezone: string; // IANA name, for display and day edges
}

export interface RunWindow {
  from: string;
  to: string;
  /** Part of a long absence before the last 3 days. Becomes one summary event later. */
  summary: { from: string; to: string } | null;
}

export type DueReason = "manual" | "tab" | "chat" | "background";

export interface RunMark {
  circleId: string;
  leaseUntil: number;
  failures: number;
  nextAt: number;
  trigger: "tab" | null;
  lastRunAt: number; // real ms of the last finished run, 0 = never
  lastWindow: RunWindow | null;
  lastError: string | null;
}

export function emptyMark(circleId: string): RunMark {
  return {
    circleId,
    leaseUntil: 0,
    failures: 0,
    nextAt: 0,
    trigger: null,
    lastRunAt: 0,
    lastWindow: null,
    lastError: null,
  };
}

/** A finite speed in 0..SPEED_MAX, else null. */
export function normalizeSpeed(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= SPEED_MAX ? value : null;
}

export function circleNowMs(clock: Clock, realNow: number): number {
  return Date.parse(clock.anchorCircle) + (realNow - clock.anchorReal) * clock.speed;
}

/** Changing the speed re-anchors, so the Circle time does not jump. */
export function setSpeed(clock: Clock, speed: number, realNow: number): Clock {
  return { ...clock, anchorCircle: new Date(circleNowMs(clock, realNow)).toISOString(), anchorReal: realNow, speed };
}

export function setTime(clock: Clock, circleMs: number, realNow: number): Clock {
  return { ...clock, anchorCircle: new Date(circleMs).toISOString(), anchorReal: realNow };
}

export function validTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Wall clock parts of an instant in a zone, as a "YYYY-MM-DDTHH:mm" string. */
export function msToWall(ms: number, tz: string): string {
  const p = wallParts(ms, tz);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${String(p.y).padStart(4, "0")}-${two(p.mo)}-${two(p.d)}T${two(p.h)}:${two(p.mi)}`;
}

/** A "YYYY-MM-DDTHH:mm" wall time in a zone to an instant. Null when it does not parse. */
export function wallToMs(wall: string, tz: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(wall);
  if (!m) return null;
  const asUtc = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!);
  if (!Number.isFinite(asUtc)) return null;
  // Two passes settle zones whose offset changes between the guess and the answer.
  let guess = asUtc - offsetMs(asUtc, tz);
  guess = asUtc - offsetMs(guess, tz);
  // 2026-02-31 or 25:99 roll over in Date.UTC, so only an exact round trip is a real time.
  return msToWall(guess, tz) === wall.slice(0, 16) ? guess : null;
}

function wallParts(ms: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(ms));
  const n = (t: string) => Number(parts.find((x) => x.type === t)?.value);
  return { y: n("year"), mo: n("month"), d: n("day"), h: n("hour"), mi: n("minute"), s: n("second") };
}

function offsetMs(ms: number, tz: string): number {
  const p = wallParts(ms, tz);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}

/** What a run covers. Null when no Circle time has passed since the last run. */
export function runWindow(lastRunMs: number, nowMs: number, keepMs = LONG_ABSENCE_DAYS * DAY): RunWindow | null {
  if (!(nowMs > lastRunMs)) return null;
  const cut = nowMs - keepMs;
  const iso = (ms: number) => new Date(ms).toISOString();
  if (lastRunMs >= cut) return { from: iso(lastRunMs), to: iso(nowMs), summary: null };
  return { from: iso(cut), to: iso(nowMs), summary: { from: iso(lastRunMs), to: iso(cut) } };
}

/**
 * Fast forward: every day of the span gets beats, so a long span never turns into a summary. A Circle that
 * was already behind keeps the long-absence summary for the days before the span (a gap under one day is
 * not worth a call).
 */
export function fastForwardWindow(lastRunMs: number, nowMs: number, spanMs: number): RunWindow | null {
  const window = runWindow(lastRunMs, nowMs, Math.max(spanMs, LONG_ABSENCE_DAYS * DAY));
  return window?.summary && Date.parse(window.summary.to) - lastRunMs < DAY ? { ...window, summary: null } : window;
}

/** Same shape as Slurp2's poll backoff: 5 min, 10, 20, then 30 min. */
export function backoffMs(failures: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, failures));
}

/** A claimed mark, or null when another run holds a live lease. */
export function claimLease(mark: RunMark, now: number): RunMark | null {
  return mark.leaseUntil > now ? null : { ...mark, leaseUntil: now + LEASE_MS };
}

export function dueReason(input: {
  hasConnection: boolean;
  mark: RunMark;
  now: number;
  circleNow: number;
  lastRunCircle: number;
  chatNewer: boolean;
  backgroundTimer: boolean;
}): DueReason | null {
  const { mark, now } = input;
  if (!input.hasConnection || mark.leaseUntil > now || mark.nextAt > now) return null;
  const reason: DueReason | null = mark.trigger
    ? "tab"
    : input.chatNewer
      ? "chat"
      : input.backgroundTimer && now - mark.lastRunAt >= BACKGROUND_EVERY_MS
        ? "background"
        : null;
  return reason && input.circleNow - input.lastRunCircle >= RUN_AHEAD_MS ? reason : null;
}

/** "HH:mm" for minutes since midnight. */
export function hhmm(minutes: number): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(Math.floor(minutes / 60) % 24)}:${two(minutes % 60)}`;
}

/** The newest Monday-to-Monday week (Circle days, `end` exclusive) that is over at `ms`. */
export function lastWeek(ms: number, tz: string): { start: string; end: string } {
  const today = msToWall(ms, tz).slice(0, 10);
  const end = shiftDay(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
  return { start: shiftDay(end, -7), end };
}

/** Moves a "YYYY-MM-DD" day by whole days. */
export function shiftDay(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}
