import { AsyncLocalStorage as ForgeTimeZoneStorage } from "node:async_hooks";

const forgeTimeZones = new ForgeTimeZoneStorage();
const forgeTimeFormatters = new Map();

export function forgeValidTimeZone(value) {
  if (typeof value !== "string" || value.length > 100) return "UTC";
  try {
    return new Intl.DateTimeFormat("en", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export function forgeTimeZoneRoutes(routes) {
  const result = Object.create(routes);
  for (const method of ["get", "post"]) {
    result[method] = (...args) => {
      const handler = args.at(-1);
      if (typeof handler !== "function") throw new Error("Missing Gacha Forge route handler");
      args[args.length - 1] = function (request, ...rest) {
        const zone = forgeValidTimeZone(request?.body?.timeZone ?? request?.query?.timeZone);
        return forgeTimeZones.run(zone, () => handler.call(this, request, ...rest));
      };
      return routes[method](...args);
    };
  }
  return result;
}

export function forgeWallDate(value, timeZone = forgeTimeZones.getStore() || "UTC") {
  const stamp = Number(value);
  const time = Number.isFinite(stamp) ? stamp : Date.now();
  let formatter = forgeTimeFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    forgeTimeFormatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(time).map(({ type, value }) => [type, Number(value)]));
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      ((time % 1000) + 1000) % 1000,
    ),
  );
}

export function forgeDayKey(value) {
  return forgeWallDate(value).toISOString().slice(0, 10);
}

export function forgeWeekday(value) {
  return (forgeWallDate(value).getUTCDay() + 6) % 7;
}

export function forgeWeekKey(value) {
  const date = forgeWallDate(value);
  date.setUTCDate(date.getUTCDate() - forgeWeekday(value));
  return date.toISOString().slice(0, 10);
}

export function forgeMonthKey(value) {
  return forgeWallDate(value).toISOString().slice(0, 7);
}

export function forgeResetIn(value, period = "day") {
  const time = Number.isFinite(Number(value)) ? Number(value) : Date.now();
  const date = forgeWallDate(time);
  date.setUTCHours(0, 0, 0, 0);
  if (period === "month") date.setUTCMonth(date.getUTCMonth() + 1, 1);
  else date.setUTCDate(date.getUTCDate() + (period === "week" ? 7 - forgeWeekday(time) : 1));
  const target = date.toISOString().slice(0, 10);
  // Search real instants for the local date boundary. A local day can be 23 or
  // 25 hours, and some zones move their clocks at midnight itself.
  let low = time;
  let high = time + (period === "month" ? 35 : period === "week" ? 9 : 3) * 86400000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (forgeDayKey(middle) >= target) high = middle;
    else low = middle;
  }
  return high - time;
}

export function forgeCalendarDaysBetween(start, end) {
  const from = Number(start);
  const to = Number(end);
  if (!Number.isFinite(from) || !from || !Number.isFinite(to) || to < from) return 0;
  const day = (time) => {
    const date = forgeWallDate(time);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  };
  return Math.max(0, Math.floor((day(to) - day(from)) / 86400000));
}

export function forgeAddCalendarDays(value, days) {
  const time = Number.isFinite(Number(value)) ? Number(value) : Date.now();
  const target = forgeWallDate(time);
  target.setUTCDate(target.getUTCDate() + days);
  let candidate = target.getTime();
  const tried = [];
  for (let step = 0; step < 4; step += 1) {
    tried.push(candidate);
    const difference = target.getTime() - forgeWallDate(candidate).getTime();
    if (difference === 0) return candidate;
    candidate += difference;
  }
  // A skipped wall-clock time moves forwards by the clock change.
  return Math.max(candidate, ...tried.slice(-2));
}
