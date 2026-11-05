// Otome Forge's Love Timeline never loses a first (M7 playtest, "nothing expires"): once the timeline is full, the
// oldest Snapshot and couple-set lines make room, and every stage reached and every first (a first date, the first
// Read Him, the first plush) stays, on the Album's timeline and as a yearly anniversary on the calendar.
import assert from "node:assert/strict";
import test from "node:test";
import type { TimelineEntry } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { calendarView } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/care.ts";
import {
  STATE_LIMITS,
  keepTimeline,
  normalizeState,
  readRun,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { KAI, storyWorld } from "./fixtures/otome-forge-story.ts";

const day = (n: number) => new Date(Date.UTC(2025, 0, 1) + n * 3_600_000).toISOString();
const first = (kind: string, n: number): TimelineEntry => ({ at: day(n), li: KAI, kind, text: `${kind} ${n}` });
const snapshot = (n: number): TimelineEntry => ({
  at: day(n),
  li: KAI,
  kind: "snapshot",
  text: `Snapshot ${n}`,
  ref: `s${n}`,
});

/** A full timeline: the firsts come first (the oldest entries), then Snapshot lines up to the cap. */
function fullTimeline(): TimelineEntry[] {
  const firsts = [first("first-date", 0), first("stage-2", 1), first("first-read-him", 2), first("first-plush", 3)];
  return [...firsts, ...Array.from({ length: STATE_LIMITS.timeline - firsts.length }, (_, k) => snapshot(10 + k))];
}

test("a full Love Timeline lets the oldest Snapshot lines go, never a stage or a first", () => {
  const full = fullTimeline();
  assert.deepEqual(keepTimeline(full), full, "at the cap nothing goes");

  const added = [...full, snapshot(9000), { ...first("stage-3", 9001) }, { ...snapshot(9002), kind: "couple" }];
  const kept = keepTimeline(added);
  assert.equal(kept.length, STATE_LIMITS.timeline);
  assert.deepEqual(
    kept.slice(0, 4).map((entry) => entry.kind),
    ["first-date", "stage-2", "first-read-him", "first-plush"],
    "every first stays, oldest included",
  );
  assert.deepEqual(
    kept.slice(4, 6).map((entry) => entry.text),
    ["Snapshot 13", "Snapshot 14"],
    "the three oldest Snapshot lines made room",
  );
  assert.deepEqual(
    kept.slice(-3).map((entry) => entry.kind),
    ["snapshot", "stage-3", "couple"],
    "and the new entries are all kept, in order",
  );
  // Read back as stored: the same rule.
  assert.deepEqual(normalizeState({ timeline: added }).timeline, kept);
});

test("a year on, the calendar still has the first date of a story whose timeline filled up", async () => {
  const t = await storyWorld({ runKey: "r-tline1-aaaaaa" });
  const run = (await readRun(t.store, t.runId))!;
  const timeline = keepTimeline([...fullTimeline(), ...Array.from({ length: 40 }, (_, k) => snapshot(9000 + k))]);
  const view = calendarView({ ...run, state: { ...run.state, timeline } }, [], "2026-01-01");
  assert.ok(
    view.anniversaries.some((row) => row.label === "first-date 0" && row.year === 2025),
    "the first date is still an anniversary",
  );
  assert.ok(
    view.anniversaries.some((row) => row.label === "stage-2 1"),
    "and the first stage reached",
  );
});
