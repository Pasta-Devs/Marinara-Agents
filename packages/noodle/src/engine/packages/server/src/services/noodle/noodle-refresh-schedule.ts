import type { NoodleRefreshSchedulerStatus } from "@marinara-engine/shared";

export const NOODLE_REFRESH_SCHEDULE_VERSION = 1 as const;

export interface PersistedNoodleRefreshSchedule {
  version: typeof NOODLE_REFRESH_SCHEDULE_VERSION;
  scheduleDate: string;
  timezone: string;
  refreshesPerDay: number;
  scheduledTimes: string[];
  completedTimes: string[];
  successfulRefreshes: number;
  failureAttempts: number;
  nextAttemptAt: string | null;
  lastAutomaticRefreshAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
}

type RandomSource = () => number;

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function nullableIsoTimestamp(value: unknown): string | null {
  return isIsoTimestamp(value) ? value : null;
}

function integerInRange(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function normalizedRandom(random: RandomSource): number {
  const value = random();
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(0.999_999, Math.max(0, value));
}

export function localScheduleDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localScheduleTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
}

export function generateNoodleRefreshTimes(
  date: Date,
  refreshesPerDay: number,
  random: RandomSource = Math.random,
): string[] {
  const count = Math.max(0, Math.min(24, Math.floor(refreshesPerDay)));
  if (count === 0) return [];

  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  const windowSize = (dayEnd - dayStart) / count;

  return Array.from({ length: count }, (_, index) => {
    const windowStart = dayStart + windowSize * index;
    // Keep each refresh away from the exact window boundaries. This still feels
    // organic while preventing adjacent slots from clustering around one instant.
    const positionWithinWindow = 0.15 + normalizedRandom(random) * 0.7;
    return new Date(windowStart + windowSize * positionWithinWindow).toISOString();
  });
}

export function parsePersistedNoodleRefreshSchedule(value: unknown): PersistedNoodleRefreshSchedule | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.version !== NOODLE_REFRESH_SCHEDULE_VERSION) return null;
  if (typeof record.scheduleDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(record.scheduleDate)) return null;
  if (typeof record.timezone !== "string" || !record.timezone) return null;
  const refreshesPerDay = integerInRange(record.refreshesPerDay, 0, 24);
  const successfulRefreshes = integerInRange(record.successfulRefreshes, 0, 24);
  const failureAttempts = integerInRange(record.failureAttempts, 0, 10_000);
  if (refreshesPerDay === null || successfulRefreshes === null || failureAttempts === null) return null;
  if (!Array.isArray(record.scheduledTimes) || !record.scheduledTimes.every(isIsoTimestamp)) return null;
  if (!Array.isArray(record.completedTimes) || !record.completedTimes.every(isIsoTimestamp)) return null;

  const scheduledTimes = Array.from(new Set(record.scheduledTimes)).sort();
  const scheduledSet = new Set(scheduledTimes);
  const completedTimes = Array.from(new Set(record.completedTimes))
    .filter((time) => scheduledSet.has(time))
    .sort();
  if (scheduledTimes.length !== refreshesPerDay) return null;

  return {
    version: NOODLE_REFRESH_SCHEDULE_VERSION,
    scheduleDate: record.scheduleDate,
    timezone: record.timezone,
    refreshesPerDay,
    scheduledTimes,
    completedTimes,
    successfulRefreshes: Math.min(successfulRefreshes, completedTimes.length),
    failureAttempts,
    nextAttemptAt: nullableIsoTimestamp(record.nextAttemptAt),
    lastAutomaticRefreshAt: nullableIsoTimestamp(record.lastAutomaticRefreshAt),
    lastAttemptAt: nullableIsoTimestamp(record.lastAttemptAt),
    lastError: typeof record.lastError === "string" && record.lastError ? record.lastError.slice(0, 500) : null,
  };
}

export function reconcileNoodleRefreshSchedule(
  current: PersistedNoodleRefreshSchedule | null,
  refreshesPerDay: number,
  at: Date,
  random: RandomSource = Math.random,
): PersistedNoodleRefreshSchedule {
  const count = Math.max(0, Math.min(24, Math.floor(refreshesPerDay)));
  const scheduleDate = localScheduleDate(at);
  const timezone = localScheduleTimezone();
  if (
    current &&
    current.scheduleDate === scheduleDate &&
    current.timezone === timezone &&
    current.refreshesPerDay === count &&
    current.scheduledTimes.length === count
  ) {
    return current;
  }

  const sameLocalDay = current?.scheduleDate === scheduleDate && current.timezone === timezone;
  const scheduledTimes = generateNoodleRefreshTimes(at, count, random);
  const preservedCompletedCount = sameLocalDay ? Math.min(current?.completedTimes.length ?? 0, count) : 0;
  return {
    version: NOODLE_REFRESH_SCHEDULE_VERSION,
    scheduleDate,
    timezone,
    refreshesPerDay: count,
    scheduledTimes,
    completedTimes: scheduledTimes.slice(0, preservedCompletedCount),
    successfulRefreshes: sameLocalDay ? Math.min(current?.successfulRefreshes ?? 0, preservedCompletedCount) : 0,
    failureAttempts: 0,
    nextAttemptAt: null,
    lastAutomaticRefreshAt: current?.lastAutomaticRefreshAt ?? null,
    lastAttemptAt: sameLocalDay ? (current?.lastAttemptAt ?? null) : null,
    lastError: null,
  };
}

export function dueNoodleRefreshTimes(schedule: PersistedNoodleRefreshSchedule, at: Date): string[] {
  const completed = new Set(schedule.completedTimes);
  const now = at.getTime();
  return schedule.scheduledTimes.filter((time) => !completed.has(time) && Date.parse(time) <= now);
}

export function nextNoodleRefreshTime(schedule: PersistedNoodleRefreshSchedule): string | null {
  const completed = new Set(schedule.completedTimes);
  return schedule.scheduledTimes.find((time) => !completed.has(time)) ?? null;
}

function localClockTime(value: string): string {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function rescheduleNoodleRefreshTime(
  schedule: PersistedNoodleRefreshSchedule,
  scheduledTime: string,
  time: string,
  at: Date,
): PersistedNoodleRefreshSchedule {
  if (!schedule.scheduledTimes.includes(scheduledTime)) {
    throw new Error("That automatic refresh slot no longer exists.");
  }
  if (schedule.completedTimes.includes(scheduledTime)) {
    throw new Error("Completed automatic refresh slots cannot be rescheduled.");
  }
  const timeMatch = /^(\d{2}):(\d{2})$/u.exec(time);
  if (!timeMatch) throw new Error("Choose a valid time.");
  if (schedule.scheduledTimes.some((candidate) => candidate !== scheduledTime && localClockTime(candidate) === time)) {
    throw new Error("Another automatic refresh is already planned for that time.");
  }

  const dateParts = schedule.scheduleDate.split("-").map(Number);
  const year = dateParts[0];
  const month = dateParts[1];
  const day = dateParts[2];
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (!year || !month || !day || !Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error("Choose a valid time.");
  }
  const replacement = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (localScheduleDate(replacement) !== schedule.scheduleDate) {
    throw new Error("That time is not available on today's local schedule.");
  }
  if (replacement.getTime() <= at.getTime()) {
    throw new Error("Choose a future time for the planned refresh.");
  }

  return {
    ...schedule,
    scheduledTimes: schedule.scheduledTimes
      .map((candidate) => (candidate === scheduledTime ? replacement.toISOString() : candidate))
      .sort(),
    failureAttempts: 0,
    nextAttemptAt: null,
    lastError: null,
  };
}

export function markNoodleRefreshAttempt(
  schedule: PersistedNoodleRefreshSchedule,
  at: Date,
): PersistedNoodleRefreshSchedule {
  return {
    ...schedule,
    lastAttemptAt: at.toISOString(),
    nextAttemptAt: null,
  };
}

export function markNoodleRefreshSuccess(
  schedule: PersistedNoodleRefreshSchedule,
  consumedTimes: string[],
  at: Date,
): PersistedNoodleRefreshSchedule {
  const scheduled = new Set(schedule.scheduledTimes);
  const alreadyCompleted = new Set(schedule.completedTimes);
  const matchedTimes = consumedTimes.filter((time) => scheduled.has(time));
  const fallbackTime = schedule.scheduledTimes.find((time) => !alreadyCompleted.has(time));
  const completedTimes = Array.from(
    new Set([
      ...schedule.completedTimes,
      ...matchedTimes,
      ...(matchedTimes.length === 0 && fallbackTime ? [fallbackTime] : []),
    ]),
  ).sort();
  return {
    ...schedule,
    completedTimes,
    successfulRefreshes: Math.min(schedule.refreshesPerDay, schedule.successfulRefreshes + 1),
    failureAttempts: 0,
    nextAttemptAt: null,
    lastAutomaticRefreshAt: at.toISOString(),
    lastAttemptAt: at.toISOString(),
    lastError: null,
  };
}

export function markNoodleRefreshFailure(
  schedule: PersistedNoodleRefreshSchedule,
  error: string,
  at: Date,
  retryDelayMs: number,
): PersistedNoodleRefreshSchedule {
  return {
    ...schedule,
    failureAttempts: schedule.failureAttempts + 1,
    nextAttemptAt: new Date(at.getTime() + Math.max(1_000, retryDelayMs)).toISOString(),
    lastAttemptAt: at.toISOString(),
    lastError: error.slice(0, 500),
  };
}

export function clearNoodleRefreshFailure(schedule: PersistedNoodleRefreshSchedule): PersistedNoodleRefreshSchedule {
  return {
    ...schedule,
    failureAttempts: 0,
    nextAttemptAt: null,
    lastError: null,
  };
}

export function noodleRefreshSchedulerStatus(
  schedule: PersistedNoodleRefreshSchedule,
  at: Date,
): NoodleRefreshSchedulerStatus {
  const nextRefreshAt = nextNoodleRefreshTime(schedule);
  const retryAt = schedule.nextAttemptAt ? Date.parse(schedule.nextAttemptAt) : null;
  const due = dueNoodleRefreshTimes(schedule, at).length > 0;
  const state: NoodleRefreshSchedulerStatus["state"] =
    schedule.refreshesPerDay === 0
      ? "disabled"
      : schedule.lastError && retryAt !== null && retryAt > at.getTime()
        ? "retrying"
        : due
          ? "due"
          : nextRefreshAt
            ? "scheduled"
            : "completed";
  return {
    state,
    scheduleDate: schedule.scheduleDate,
    timezone: schedule.timezone,
    refreshesPerDay: schedule.refreshesPerDay,
    scheduledTimes: schedule.scheduledTimes,
    completedTimes: schedule.completedTimes,
    completedSlots: schedule.completedTimes.length,
    successfulRefreshes: schedule.successfulRefreshes,
    skippedSlots: Math.max(0, schedule.completedTimes.length - schedule.successfulRefreshes),
    nextRefreshAt,
    nextAttemptAt: schedule.nextAttemptAt,
    lastAutomaticRefreshAt: schedule.lastAutomaticRefreshAt,
    lastAttemptAt: schedule.lastAttemptAt,
    lastError: schedule.lastError,
  };
}
