/**
 * The posting schedule as a day list: slots grouped by the viewer's local day, and edits that
 * change only the time (or only the day) of a slot. Pure, so the time-zone rules are testable.
 */

/** `YYYY-MM-DD` of an instant in the viewer's time zone. */
export function slpLocalDay(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `HH:MM` of an instant in the viewer's time zone. */
export function slpLocalTime(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Slots grouped by local day, days and slots in time order. */
export function slpScheduleDays<T extends { publishAt: string }>(slots: readonly T[]): { day: string; slots: T[] }[] {
  const days = new Map<string, T[]>();
  for (const slot of [...slots].sort((a, b) => Date.parse(a.publishAt) - Date.parse(b.publishAt))) {
    const day = slpLocalDay(slot.publishAt);
    days.set(day, [...(days.get(day) ?? []), slot]);
  }
  return [...days].map(([day, daySlots]) => ({ day, slots: daySlots }));
}

/**
 * The instant at `day` (`YYYY-MM-DD`) and `time` (`HH:MM`) in the viewer's time zone, or null for
 * malformed input. A wall time skipped by a DST change resolves the way `Date` does (forward).
 */
export function slpLocalInstant(day: string, time: string): string | null {
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(day);
  const timeMatch = /^(\d{2}):(\d{2})$/u.exec(time);
  if (!dayMatch || !timeMatch) return null;
  const [year, month, date] = dayMatch.slice(1).map(Number) as [number, number, number];
  const [hours, minutes] = timeMatch.slice(1).map(Number) as [number, number];
  if (month < 1 || month > 12 || date < 1 || date > 31 || hours > 23 || minutes > 59) return null;
  const local = new Date(year, month - 1, date, hours, minutes);
  return local.getDate() === date ? local.toISOString() : null;
}

/** A new time for a slot: same local day, or null when invalid or not in the future. */
export function slpSlotAtTime(publishAt: string, time: string, now = Date.now()): string | null {
  const next = slpLocalInstant(slpLocalDay(publishAt), time);
  return next && Date.parse(next) > now ? next : null;
}

/** A new day for a slot: same local time, or null when invalid or not in the future. */
export function slpSlotOnDay(publishAt: string, day: string, now = Date.now()): string | null {
  const next = slpLocalInstant(day, slpLocalTime(publishAt));
  return next && Date.parse(next) > now ? next : null;
}

const pad = (value: number) => String(value).padStart(2, "0");
