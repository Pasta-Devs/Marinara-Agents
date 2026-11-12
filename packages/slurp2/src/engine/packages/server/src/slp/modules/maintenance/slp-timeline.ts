/**
 * Pure rules for the world clock's skip and checkpoints (docs/WORLD-CLOCK.md).
 * No database, no files: the storage and job layers call these.
 */
export type TimelineCheckpointRef = { id: string; kind: "manual" | "auto" | "safety"; createdAt: string };

const DAY_MS = 86_400_000;
const DUE_KEY =
  /(until|due|notbefore|nextattempt|nextrun|expires|startsat|endsat|startedat|chapterstarted|pollclosesat|scheduledat|deliverat|askedat|offeredat|plannedat|dropat|stageat|changedat|since|answeredat|pricedat|weekstart)/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Move one ISO timestamp, or return the value as it was when it is not one. */
export function shiftSlurpIso(value: unknown, deltaMs: number): unknown {
  return typeof value === "string" && ISO.test(value) ? new Date(Date.parse(value) + deltaMs).toISOString() : value;
}

/**
 * Shift the due-style ISO strings inside a JSON value (keys such as `coolUntil`,
 * `dueAt`, `expiresAt`, `startedAt`). Content stamps (`createdAt`, `publishedAt`,
 * `sentAt`) are left alone: history keeps its dates.
 */
export function shiftSlurpDueJson(value: unknown, deltaMs: number, key = "", pattern: RegExp = DUE_KEY): unknown {
  if (typeof value === "string") return pattern.test(key) ? shiftSlurpIso(value, deltaMs) : value;
  if (Array.isArray(value)) return value.map((item) => shiftSlurpDueJson(item, deltaMs, key, pattern));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shiftSlurpDueJson(v, deltaMs, k, pattern)]));
  }
  return value;
}

/** The wallet's subscription ends (`paidThroughAt`) move with a skip too, so no renewal is billed for skipped days. */
export const WALLET_DUE_KEY = new RegExp(`${DUE_KEY.source}|paidthroughat`, "i");

/** The Support extras offer compares these with "now": first seen (3-day trigger), last offer (1-day cooldown), pending offer. */
export const EXTRAS_OFFER_DUE_KEY = new RegExp(`${DUE_KEY.source}|firstseenat|lastofferat|^at$`, "i");

/**
 * Set every `markKeys` timestamp in a JSON value to `iso`. Elapsed-time gates (ties, drama, Creator mood decay)
 * read these as "last advanced", so they are set to the skip target instead of shifted: the gap is zero.
 */
export function setSlurpMarkJson(value: unknown, iso: string, markKeys: ReadonlySet<string>, key = ""): unknown {
  if (typeof value === "string") return markKeys.has(key) && ISO.test(value) ? iso : value;
  if (Array.isArray(value)) return value.map((item) => setSlurpMarkJson(item, iso, markKeys, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, setSlurpMarkJson(v, iso, markKeys, k)]));
  }
  return value;
}

/** The world time a skip of `days` whole days lands on: same time of day, later date. */
export function slurpSkipTarget(worldNowMs: number, days: number, maxDays: number): number {
  if (!Number.isInteger(days) || days < 1) throw new Error("A skip moves the world forward by at least one day.");
  if (days > maxDays) throw new Error(`A skip moves the world at most ${maxDays} days.`);
  return worldNowMs + days * DAY_MS;
}

/**
 * Which checkpoints to delete: auto and safety keep their newest `keep`/`safetyKeep`,
 * manual ones are never chosen.
 */
export function selectCheckpointsToPrune<T extends TimelineCheckpointRef>(
  all: readonly T[],
  keep: number,
  safetyKeep: number,
): T[] {
  const newestFirst = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return [
    ...newestFirst.filter((meta) => meta.kind === "auto").slice(keep),
    ...newestFirst.filter((meta) => meta.kind === "safety").slice(safetyKeep),
  ];
}
