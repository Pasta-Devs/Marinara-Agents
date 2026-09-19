export type SlurpAutopurgeRetentionUnit = "days" | "weeks" | "months";

/** Calendar-aware retention math. Months clamp to the last valid day instead of rolling over. */
export function moveSlurpAutopurgeDate(
  from: Date,
  value: number,
  unit: SlurpAutopurgeRetentionUnit,
  direction: -1 | 1,
): Date {
  const result = new Date(from);
  if (unit === "days" || unit === "weeks") {
    result.setUTCDate(result.getUTCDate() + direction * value * (unit === "weeks" ? 7 : 1));
    return result;
  }
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + direction * value);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function nextSlurpAutopurgeRunAt(
  settings: { autopurgeRetentionValue: number; autopurgeRetentionUnit: SlurpAutopurgeRetentionUnit },
  from = new Date(),
): string {
  return moveSlurpAutopurgeDate(
    from,
    settings.autopurgeRetentionValue,
    settings.autopurgeRetentionUnit,
    1,
  ).toISOString();
}
