import type { Clock } from "./types.js";

export const WEEKS = 24;
export const DAYS = 5;
export const HOURS = 5;
export const TERM_WEEKS = 8;
export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
export const SLOTS = ["morning", "midday", "afternoon", "evening", "night"] as const;

export const newClock = (): Clock => ({ week: 1, day: 0, hoursLeft: HOURS });
export const term = (c: Clock) => Math.ceil(c.week / TERM_WEEKS);
export const dayName = (c: Clock) => DAY_NAMES[c.day]!;
export const slot = (c: Clock) => SLOTS[Math.min(HOURS - c.hoursLeft, SLOTS.length - 1)]!;
export const isFriday = (c: Clock) => c.day === DAYS - 1;
export const dayIndex = (c: { week: number; day: number }) => (c.week - 1) * DAYS + c.day;

export function spendHours(c: Clock, n = 1): Clock {
  if (c.hoursLeft < n) throw new Error("Not enough hours left today");
  return { ...c, hoursLeft: c.hoursLeft - n };
}

export function nextDay(c: Clock): Clock {
  return isFriday(c) ? { week: c.week + 1, day: 0, hoursLeft: HOURS } : { ...c, day: c.day + 1, hoursLeft: HOURS };
}
