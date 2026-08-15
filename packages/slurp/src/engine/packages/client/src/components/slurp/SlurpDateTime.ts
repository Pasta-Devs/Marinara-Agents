const timeFormatters = new Map<string, Intl.DateTimeFormat>();

export function formatTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  let formatter = timeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    timeFormatters.set(locale, formatter);
  }
  return formatter.format(date);
}
