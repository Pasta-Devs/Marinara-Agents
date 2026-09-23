import assert from "node:assert/strict";

import {
  slurpActivePlatformEvents,
  slurpNormalizePlatformEvents,
  slurpPlatformEventInstruction,
  slurpPlatformEventsDefault,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-platform-events.js";

const events = slurpPlatformEventsDefault();
const names = (at: string) => slurpActivePlatformEvents(events, new Date(at)).map((item) => item.name);

assert.deepEqual(names("2026-10-25T12:00:00Z"), ["Halloween"]);
assert.deepEqual(names("2026-10-31T23:59:00Z"), ["Halloween"]);
assert.deepEqual(names("2026-11-01T00:00:00Z"), []);
// Christmas starts Dec 20 for 7 days; New Year's Eve overlaps nothing but itself.
assert.deepEqual(names("2026-12-26T08:00:00Z"), ["Christmas"]);
assert.deepEqual(names("2026-12-27T08:00:00Z"), []);
// A wrap across New Year still matches from last year's start.
const wrap = [
  {
    ...events[0]!,
    id: "w",
    name: "Wrap",
    activation: { kind: "annual" as const, month: 12, day: 30, durationDays: 5 },
  },
];
assert.equal(slurpActivePlatformEvents(wrap, new Date("2027-01-02T10:00:00Z")).length, 1);
assert.equal(slurpActivePlatformEvents(wrap, new Date("2027-01-04T10:00:00Z")).length, 0);
// Disabled events never run.
assert.equal(slurpActivePlatformEvents([{ ...wrap[0]!, enabled: false }], new Date("2026-12-31T00:00:00Z")).length, 0);

assert.equal(slurpPlatformEventInstruction(events, new Date("2026-03-03T00:00:00Z")), null);
assert.match(slurpPlatformEventInstruction(events, new Date("2026-02-14T00:00:00Z")) ?? "", /Valentine's Day: /);

// One broken entry must not lose the rest; a non-array falls back to the defaults.
assert.equal(slurpNormalizePlatformEvents([events[0], { id: "x" }]).length, 1);
// A saved world from before the story engine keeps its calendar rows as annual blueprints.
const legacy = slurpNormalizePlatformEvents([
  { id: "halloween", name: "Halloween", enabled: true, guidance: "Spooky.", month: 10, day: 25, durationDays: 7 },
  { id: "mine", kind: "calendar", name: "Mine", enabled: false, guidance: "", month: 3, day: 1, durationDays: 2 },
]);
assert.deepEqual(
  legacy.map((item) => item.activation),
  [
    { kind: "annual", month: 10, day: 25, durationDays: 7 },
    { kind: "annual", month: 3, day: 1, durationDays: 2 },
  ],
);
assert.deepEqual(
  legacy.map((item) => item.builtin),
  [true, false],
  "a stock id keeps its built-in identity; a custom one does not become built-in",
);
assert.deepEqual(names("2026-10-25T12:00:00Z"), ["Halloween"], "migration must not disturb the shipped calendar");
assert.equal(slurpNormalizePlatformEvents(undefined).length, events.length);

console.log("slurp2 platform events regression passed");
