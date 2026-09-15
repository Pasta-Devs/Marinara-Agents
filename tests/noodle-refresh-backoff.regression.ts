import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  exponentialNoodleRefreshRetryDelayMs,
  markNoodleRefreshFailure,
  markNoodleRefreshSuccess,
  parsePersistedNoodleRefreshSchedule,
  reconcileNoodleRefreshSchedule,
  type PersistedNoodleRefreshSchedule,
} from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-refresh-schedule";

const failedAt = new Date("2026-08-26T23:55:00.000Z");
const retryAt = new Date("2026-08-27T00:35:00.000Z");
const failed: PersistedNoodleRefreshSchedule = {
  version: 1,
  scheduleDate: "2026-08-26",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "local",
  refreshesPerDay: 2,
  scheduledTimes: ["2026-08-26T08:00:00.000Z", "2026-08-26T20:00:00.000Z"],
  completedTimes: [],
  successfulRefreshes: 0,
  failureAttempts: 4,
  nextAttemptAt: retryAt.toISOString(),
  lastAutomaticRefreshAt: null,
  lastAttemptAt: failedAt.toISOString(),
  lastError: "Provider unavailable",
};

const restored = parsePersistedNoodleRefreshSchedule(JSON.parse(JSON.stringify(failed)));
assert.ok(restored);
const nextDay = reconcileNoodleRefreshSchedule(restored, 2, new Date("2026-08-27T00:05:00.000Z"), () => 0.5);
assert.equal(nextDay.failureAttempts, 4, "restart reconciliation must preserve consecutive failures");
assert.equal(nextDay.nextAttemptAt, retryAt.toISOString(), "restart reconciliation must preserve the retry time");
assert.equal(nextDay.lastError, "Provider unavailable");

assert.deepEqual(
  [0, 1, 2, 3, 4, 20].map(exponentialNoodleRefreshRetryDelayMs),
  [5, 10, 20, 40, 60, 60].map((minutes) => minutes * 60_000),
  "provider retry delay must increase exponentially and stop at one hour",
);
const repeatedFailure = markNoodleRefreshFailure(
  nextDay,
  "Provider still unavailable",
  retryAt,
  exponentialNoodleRefreshRetryDelayMs(nextDay.failureAttempts),
);
assert.equal(repeatedFailure.failureAttempts, 5);
assert.equal(repeatedFailure.nextAttemptAt, "2026-08-27T01:35:00.000Z");

const disabled = reconcileNoodleRefreshSchedule(repeatedFailure, 0, retryAt, () => 0.5);
assert.equal(disabled.failureAttempts, 0);
assert.equal(disabled.nextAttemptAt, null);
assert.equal(disabled.lastError, null);
const staleDisabled = reconcileNoodleRefreshSchedule(
  { ...disabled, ...repeatedFailure, refreshesPerDay: 0, scheduledTimes: [] },
  0,
  retryAt,
);
assert.equal(staleDisabled.failureAttempts, 0, "an existing disabled schedule must clear stale failures");
assert.equal(staleDisabled.nextAttemptAt, null);
assert.equal(staleDisabled.lastError, null);

const succeeded = markNoodleRefreshSuccess(repeatedFailure, [], retryAt);
assert.equal(succeeded.failureAttempts, 0);
assert.equal(succeeded.nextAttemptAt, null);
assert.equal(succeeded.lastError, null);

async function main() {
  const schedulerSource = await readFile(
    new URL(
      "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-refresh-scheduler.service.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(schedulerSource, /await active\?\.catch\(\(\) => \{\}\)/u, "scheduler shutdown must await active work");

  console.info("Noodle durable refresh backoff regressions passed.");
}

void main();
