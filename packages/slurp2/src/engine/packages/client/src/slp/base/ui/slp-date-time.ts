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
