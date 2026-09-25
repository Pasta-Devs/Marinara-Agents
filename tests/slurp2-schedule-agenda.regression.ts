import assert from "node:assert/strict";

import {
  slpLocalDay,
  slpLocalInstant,
  slpLocalTime,
  slpScheduleDays,
  slpSlotAtTime,
  slpSlotOnDay,
} from "../packages/slurp2/src/engine/packages/client/src/slp/modules/settings/slp-schedule-agenda";

// Wall-clock rules are checked in a zone with DST, so a skipped hour and a day change are real.
process.env.TZ = "Europe/Berlin";
const now = Date.parse("2026-03-28T10:00:00Z");

// Slots group by local day and sort by time: 23:30 local on the 28th stays on the 28th.
const late = "2026-03-28T22:30:00Z"; // 23:30 in Berlin (UTC+1)
const early = "2026-03-29T06:00:00Z"; // 08:00 in Berlin (UTC+2 after the switch)
const days = slpScheduleDays([
  { id: "b", publishAt: early },
  { id: "a", publishAt: late },
]);
assert.deepEqual(
  days.map((entry) => [entry.day, entry.slots.map((slot) => slot.id)]),
  [
    ["2026-03-28", ["a"]],
    ["2026-03-29", ["b"]],
  ],
);
assert.equal(slpLocalTime(late), "23:30");
assert.equal(slpLocalDay(late), "2026-03-28");

// Changing the time keeps the local day, across midnight in UTC.
assert.equal(slpSlotAtTime(late, "23:55", now), "2026-03-28T22:55:00.000Z");
// 00:15 on the 28th is 2026-03-27T23:15Z, before `now`.
assert.equal(slpSlotAtTime(late, "00:15", now), null, "a time already past is rejected");
// The DST day: 08:00 local on the 29th is UTC+2.
assert.equal(slpSlotAtTime(early, "09:00", now), "2026-03-29T07:00:00.000Z");
// A skipped wall time (02:30 does not exist on the 29th) resolves forward, never to a wrong day.
assert.equal(slpLocalDay(slpSlotAtTime(early, "02:30", now)!), "2026-03-29");

// Changing the day keeps the local time, across the DST switch.
assert.equal(slpSlotOnDay(late, "2026-03-30", now), "2026-03-30T21:30:00.000Z", "23:30 local, now UTC+2");
assert.equal(slpSlotOnDay(late, "2026-03-01", now), null, "a past day is rejected");

// Malformed input is rejected, not guessed.
assert.equal(slpLocalInstant("2026-02-30", "10:00"), null);
assert.equal(slpLocalInstant("2026-03-28", "24:00"), null);
assert.equal(slpLocalInstant("28.03.2026", "10:00"), null);

console.log("slurp2 schedule agenda ok");
