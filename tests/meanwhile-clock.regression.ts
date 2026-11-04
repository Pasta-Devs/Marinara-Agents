import assert from "node:assert/strict";
import {
  DAY,
  HOUR,
  LEASE_MS,
  backoffMs,
  circleNowMs,
  claimLease,
  dueReason,
  emptyMark,
  msToWall,
  normalizeSpeed,
  runWindow,
  setSpeed,
  setTime,
  wallToMs,
  type Clock,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/clock.ts";

const T0 = Date.parse("2026-11-05T12:00:00Z");
const clock: Clock = { anchorCircle: "2026-11-05T12:00:00.000Z", anchorReal: T0, speed: 1, timezone: "UTC" };

// Speed changes re-anchor: no jump at the change, new rate after it.
assert.equal(circleNowMs(clock, T0 + HOUR), T0 + HOUR);
const fast = setSpeed(clock, 24, T0 + HOUR);
assert.equal(circleNowMs(fast, T0 + HOUR), T0 + HOUR);
assert.equal(circleNowMs(fast, T0 + 2 * HOUR), T0 + HOUR + 24 * HOUR);

// Speed 0 pauses.
const paused = setSpeed(fast, 0, T0 + 2 * HOUR);
assert.equal(circleNowMs(paused, T0 + 50 * HOUR), circleNowMs(paused, T0 + 2 * HOUR));
assert.deepEqual([0, 1, 24, 7.5, 1440].map(normalizeSpeed), [0, 1, 24, 7.5, 1440]);
assert.deepEqual([-1, 1441, NaN, "2", null].map(normalizeSpeed), [null, null, null, null, null]);

// Set time re-anchors and keeps the speed.
const set = setTime(fast, Date.parse("2026-12-24T18:00:00Z"), T0 + 3 * HOUR);
assert.equal(circleNowMs(set, T0 + 3 * HOUR), Date.parse("2026-12-24T18:00:00Z"));
assert.equal(set.speed, 24);

// Wall time in a zone, both ways (Berlin is UTC+1 in November, UTC+2 in July).
assert.equal(wallToMs("2026-11-05T18:00", "Europe/Berlin"), Date.parse("2026-11-05T17:00:00Z"));
assert.equal(wallToMs("2026-07-05T18:00", "Europe/Berlin"), Date.parse("2026-07-05T16:00:00Z"));
assert.equal(msToWall(Date.parse("2026-11-05T17:00:00Z"), "Europe/Berlin"), "2026-11-05T18:00");
assert.equal(wallToMs("nonsense", "UTC"), null);
assert.equal(wallToMs("2026-02-31T10:00", "UTC"), null);
assert.equal(wallToMs("2026-11-05T25:99", "UTC"), null);
assert.equal(wallToMs("2026-02-28T10:00", "UTC"), Date.parse("2026-02-28T10:00:00Z"));

// Window: short gap is one span, long absence keeps the last 3 days and summarises the rest.
assert.equal(runWindow(T0, T0), null);
const short = runWindow(T0, T0 + 2 * DAY)!;
assert.equal(short.summary, null);
assert.equal(short.from, new Date(T0).toISOString());
const long = runWindow(T0, T0 + 10 * DAY)!;
assert.equal(long.to, new Date(T0 + 10 * DAY).toISOString());
assert.equal(long.from, new Date(T0 + 7 * DAY).toISOString());
assert.deepEqual(long.summary, { from: new Date(T0).toISOString(), to: new Date(T0 + 7 * DAY).toISOString() });
assert.equal(runWindow(T0, T0 + 3 * DAY)!.summary, null);

// Backoff: 5, 10, 20, then 30 min.
assert.deepEqual(
  [0, 1, 2, 3, 4, 9].map(backoffMs),
  [5, 10, 20, 30, 30, 30].map((m) => m * 60_000),
);

// Lease: two claims, one wins; an expired lease can be claimed again.
const mark = emptyMark("c1");
const first = claimLease(mark, T0)!;
assert.equal(first.leaseUntil, T0 + LEASE_MS);
assert.equal(claimLease(first, T0 + 1), null);
assert.equal(claimLease(first, T0 + LEASE_MS - 1), null);
assert.notEqual(claimLease(first, T0 + LEASE_MS), null);

// Due: needs a model, a trigger and 6 Circle hours of unseen time; respects lease and backoff.
const base = {
  hasConnection: true,
  mark: { ...mark, trigger: "tab" as const },
  now: T0,
  circleNow: T0 + 7 * HOUR,
  lastRunCircle: T0,
  chatNewer: false,
  backgroundTimer: false,
};
assert.equal(dueReason(base), "tab");
assert.equal(dueReason({ ...base, hasConnection: false }), null);
assert.equal(dueReason({ ...base, circleNow: T0 + 5 * HOUR }), null);
assert.equal(dueReason({ ...base, mark: { ...mark, nextAt: T0 + 1 }, chatNewer: true }), null);
assert.equal(dueReason({ ...base, mark: first }), null);
assert.equal(dueReason({ ...base, mark, chatNewer: true }), "chat");
assert.equal(dueReason({ ...base, mark, backgroundTimer: true }), "background");
assert.equal(dueReason({ ...base, mark: { ...mark, lastRunAt: T0 - HOUR }, backgroundTimer: true }), null);

console.log("meanwhile clock regression passed");
