/** Readers for stored or model JSON that several Slurp modules share. */

/** A plain object, or null for anything else (arrays included). */
export const slpRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/** A string `Date.parse` accepts, as written, or null. */
export const slpDate = (value: unknown): string | null =>
  typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;

/** An integer, or null. */
export const slpIntOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) ? value : null;
