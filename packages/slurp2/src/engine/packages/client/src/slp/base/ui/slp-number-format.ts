const formatters = new Map<string, Intl.NumberFormat>();
function formatter(locale: string, options: Intl.NumberFormatOptions) {
  const key = `${locale}:${JSON.stringify(options)}`;
  let found = formatters.get(key);
  if (!found) {
    found = new Intl.NumberFormat(locale, options);
    formatters.set(key, found);
  }
  return found;
}

/** Creator earnings are platform dollars (0.3.7), never cents: "$1,284", "1.284 $". */
export function formatSlpDollars(value: number, locale: string) {
  return formatter(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Money and counts with the reader's separators: "1,284" in English, "1.284" in German. */
export function formatSlpNumber(value: number, locale: string) {
  return formatter(locale, { maximumFractionDigits: 0 }).format(value);
}

/**
 * A coin amount as a caller hands it over: numbers and plain whole-number strings ("1284", "+25")
 * get separators, anything else ("…", a label) passes through unchanged.
 */
export function formatSlpAmount(amount: number | string, locale: string) {
  if (typeof amount === "number") return formatSlpNumber(amount, locale);
  const match = /^([+-]?)(\d+)$/u.exec(amount.trim());
  return match ? `${match[1]}${formatSlpNumber(Number(match[2]), locale)}` : amount;
}

/** A share from 0 to 1 as a percent in the reader's style: "42%", "42 %". */
export function formatSlpPercent(ratio: number, locale: string) {
  return formatter(locale, { style: "percent", maximumFractionDigits: 0 }).format(ratio);
}
