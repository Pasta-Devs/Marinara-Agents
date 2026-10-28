const timeFormatters = new Map<string, Intl.DateTimeFormat>();
const browserHour12 = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12;

export function formatTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const cacheKey = `${locale}:${browserHour12}`;
  let formatter = timeFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: browserHour12,
    });
    timeFormatters.set(cacheKey, formatter);
  }
  return formatter.format(date);
}

export function formatClockTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: browserHour12,
  }).format(date);
}

export function formatDateTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { hour12: browserHour12 }).format(date);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const relativeFormatters = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>();
function cached<T extends Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>(
  key: string,
  make: () => T,
): T {
  let formatter = relativeFormatters.get(key) as T | undefined;
  if (!formatter) {
    formatter = make();
    relativeFormatters.set(key, formatter);
  }
  return formatter;
}

/**
 * The list and feed time (design language §7 Timestamp): "now", "4m", "2h", "Tue", "Sep 12", and
 * "Sep 12, 2025" for another year. A time in the future (scheduled) reads as the full date.
 */
export function formatRelativeTime(value: string, locale: string, now = Date.now()) {
  const date = new Date(value);
  const at = date.getTime();
  if (Number.isNaN(at)) return "";
  const ago = now - at;
  if (ago < 0) return formatTime(value, locale);
  if (ago < MINUTE)
    return cached(`${locale}:now`, () => new Intl.RelativeTimeFormat(locale, { numeric: "auto" })).format(0, "second");
  const unit = (name: "minute" | "hour", amount: number) =>
    cached(
      `${locale}:${name}`,
      () => new Intl.NumberFormat(locale, { style: "unit", unit: name, unitDisplay: "narrow" }),
    ).format(amount);
  if (ago < HOUR) return unit("minute", Math.floor(ago / MINUTE));
  if (ago < DAY) return unit("hour", Math.floor(ago / HOUR));
  if (ago < 6 * DAY)
    return cached(`${locale}:weekday`, () => new Intl.DateTimeFormat(locale, { weekday: "short" })).format(date);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return cached(
    `${locale}:date:${sameYear}`,
    () => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) }),
  ).format(date);
}

/** The full date and time a relative time stands for (hover / tap). */
export function formatFullTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return cached(
    `${locale}:full:${browserHour12}`,
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", hour12: browserHour12 }),
  ).format(date);
}

/**
 * A day ahead, as short as it can be said: "Fri" inside the next six days, "Oct 2" after that,
 * "Oct 2, 2027" in another year. For "renews Fri" / "ends Fri" on a subscription.
 */
export function formatUpcomingDay(value: string, locale: string, now = Date.now()) {
  const date = new Date(value);
  const at = date.getTime();
  if (Number.isNaN(at)) return "";
  if (at >= now && at - now < 6 * DAY)
    return cached(`${locale}:weekday`, () => new Intl.DateTimeFormat(locale, { weekday: "short" })).format(date);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return cached(
    `${locale}:date:${sameYear}`,
    () => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) }),
  ).format(date);
}

/** A clock time ahead: "4:30 PM" today, "Fri 4:30 PM" on a later day ("Next refill …", "Draw again at …"). */
export function formatUpcomingClock(value: string, locale: string, now = Date.now()) {
  const clock = formatClockTime(value, locale);
  if (!clock || slpDayKey(value) === slpDayKey(now)) return clock;
  return `${formatUpcomingDay(value, locale, now)} ${clock}`;
}

/** The local calendar day of a time, as a sortable key ("2026-09-27"). */
export function slpDayKey(value: string | number | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * A day heading for a list grouped by day (wallet ledger): "Today", "Yesterday", then "Tue, Sep 23",
 * with the year only for another year. Today / Yesterday come from Intl, so every locale gets its word.
 */
export function formatDayHeading(value: string, locale: string, now = Date.now()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date(now);
  const midnight = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const daysAgo = Math.round((midnight(today) - midnight(date)) / DAY);
  if (daysAgo === 0 || daysAgo === 1) {
    const word = cached(`${locale}:day-auto`, () => new Intl.RelativeTimeFormat(locale, { numeric: "auto" })).format(
      -daysAgo,
      "day",
    );
    return word.charAt(0).toLocaleUpperCase(locale) + word.slice(1);
  }
  const sameYear = date.getFullYear() === today.getFullYear();
  return cached(
    `${locale}:day-heading:${sameYear}`,
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
        ...(sameYear ? {} : { year: "numeric" }),
      }),
  ).format(date);
}

/** Runs of items that share a local day, newest first as given (the list must already be sorted). */
export function groupSlpByDay<T extends { at: string }>(items: readonly T[]): { day: string; items: T[] }[] {
  const groups: { day: string; items: T[] }[] = [];
  for (const item of items) {
    const day = slpDayKey(item.at);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}
