/**
 * #1436: Slurp reads the Engine's Conversation Schedule. The Engine stores each block's time as a
 * range ("06:00-08:00") with a status; Slurp only read a bare "06:00", dropped every block, and fell
 * back to a guess that could keep a Creator away all day, postponing promised follow-ups forever.
 */
import assert from "node:assert/strict";
import {
  resolveSlurpCreatorAvailability,
  resolveSlurpCreatorScheduleBlocks,
  slurpCreatorAvailability,
  slurpTimelineMoment,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-schedule-context";
import {
  isFollowUpPastAwayLimit,
  SLURP_FOLLOW_UP_AWAY_LIMIT_MS,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-follow-up";
import { slurp2Source } from "./slurp2-source";

// Local wall-clock times: 18 October 2026 is a Sunday, the 19th a Monday, the 20th a Tuesday.
const at = (day: number, hours: number, minutes = 0) => new Date(2026, 9, day, hours, minutes);
const sunday = [
  { time: "08:00-12:00", activity: "brunch with friends", status: "online" },
  { time: "22:00-07:00", activity: "Sleeping", status: "offline" },
];
const monday = [
  { time: "07:00-08:00", activity: "breakfast", status: "online" },
  // The status decides over the activity: dnd is away although nothing in the words says so...
  { time: "09:00-12:00", activity: "Answering fans", status: "dnd" },
  // ...and idle answers although "bed" is an away word.
  { time: "12:00-13:00", activity: "lunch nap in bed", status: "idle" },
  // No status, or one the Engine never writes: the activity words decide, as before.
  { time: "14:00-16:00", activity: "Filming a set" },
  { time: "16:00-17:00", activity: "editing clips", status: "busy" },
  { time: "23:00-06:30", activity: "Sleeping", status: "offline" },
];
const tuesday = [{ time: "06:30-09:00", activity: "gym", status: "online" }];
const week = { weekStart: "2026-10-19T00:00:00.000Z", days: { Sunday: sunday, Monday: monday, Tuesday: tuesday } };
const availability = (date: Date) => slurpCreatorAvailability(week as never, date);

// ── Ranges parse, including one that crosses midnight ─────────────────────
assert.deepEqual(availability(at(19, 7, 30)), { online: true, activity: "breakfast", minutesUntilOnline: 0 });
assert.deepEqual(
  availability(at(19, 2)),
  { online: false, activity: "Sleeping", minutesUntilOnline: 300 },
  "Monday 02:00 is still inside Sunday's 22:00-07:00, which ends at Monday's breakfast",
);
assert.deepEqual(
  availability(at(19, 23, 30)),
  { online: false, activity: "Sleeping", minutesUntilOnline: 420 },
  "the wait runs across midnight to Tuesday's first block",
);

// ── A gap between blocks is free time, online, as in the Engine ───────────
assert.deepEqual(availability(at(19, 8, 30)), { online: true, activity: "free time", minutesUntilOnline: 0 });
assert.deepEqual(availability(at(19, 13, 30)), { online: true, activity: "free time", minutesUntilOnline: 0 });
assert.deepEqual(
  availability(at(19, 17, 30)),
  { online: true, activity: "free time", minutesUntilOnline: 0 },
  "a block no longer keeps running into the gap after it",
);

// ── The status decides: offline and dnd are away, online and idle answer ──
assert.deepEqual(availability(at(19, 10)), { online: false, activity: "Answering fans", minutesUntilOnline: 120 });
assert.deepEqual(availability(at(19, 12, 30)), { online: true, activity: "lunch nap in bed", minutesUntilOnline: 0 });

// ── Without a usable status, the activity words still decide ──────────────
assert.deepEqual(availability(at(19, 15)), { online: false, activity: "Filming a set", minutesUntilOnline: 60 });
assert.deepEqual(availability(at(19, 16, 30)), { online: true, activity: "editing clips", minutesUntilOnline: 0 });

// Malformed ranges are skipped the way the Engine skips them, never read as something else.
assert.equal(
  slurpCreatorAvailability(
    { weekStart: week.weekStart, days: { Monday: [{ time: "6am-8am", activity: "breakfast" }] } } as never,
    at(19, 7),
  ),
  null,
  "a schedule with no readable block today is no schedule",
);

// ── The post brief's day plan reads the same ranges ───────────────────────
assert.deepEqual(slurpTimelineMoment(monday, at(19, 10), { yesterday: sunday, tomorrow: tuesday }), {
  current: "Answering fans",
  previous: "free time",
  queued: false,
});
const asleep = slurpTimelineMoment(monday, at(19, 2), { yesterday: sunday, tomorrow: tuesday });
assert.equal(asleep?.queued, true, "a post due in the night was written before Sunday's sleep");
assert.equal(asleep?.current, "free time");
assert.equal(asleep?.previous, "brunch with friends");
// A routine without neighbours repeats daily, so its night block reaches back from yesterday.
assert.deepEqual(
  slurpTimelineMoment(
    [
      { time: "07:00-12:00", activity: "working the bar" },
      { time: "12:00-23:00", activity: "painting at home" },
      { time: "23:00-07:00", activity: "asleep" },
    ],
    at(19, 3),
  ),
  { current: "painting at home", previous: "working the bar", queued: true },
);

// ── The issue's own shape, end to end: no more guessing ───────────────────
async function engineSchedule() {
  // A day without blocks still has yesterday's night block running into it.
  const nightOnly = {
    getById: async () => ({
      data: {
        extensions: {
          conversationSchedule: {
            weekStart: "2026-10-19T00:00:00.000Z",
            days: {
              Monday: [
                { time: "18:00-23:00", activity: "streaming", status: "online" },
                { time: "23:00-06:30", activity: "Sleeping", status: "offline" },
              ],
            },
          },
        },
      },
    }),
  };
  const nightSource = { kind: "character", entityId: "c2", displayName: "Rin" };
  const tuesdayNight = await resolveSlurpCreatorScheduleBlocks(nightOnly, nightSource, at(20, 1));
  assert.deepEqual(tuesdayNight?.blocks, [], "Tuesday has no blocks of its own");
  assert.deepEqual(
    tuesdayNight && slurpTimelineMoment(tuesdayNight.blocks, tuesdayNight.localNow, tuesdayNight),
    { current: "streaming", previous: "free time", queued: true },
    "the post brief still places Tuesday 01:00 inside Monday's night",
  );
  assert.equal(
    await resolveSlurpCreatorScheduleBlocks(nightOnly, nightSource, at(20, 9)),
    null,
    "once the night block ends, an empty day is still no schedule",
  );

  const character = {
    getById: async () => ({
      data: {
        extensions: {
          conversationSchedule: {
            weekStart: "2026-10-19T00:00:00.000Z",
            days: {
              Monday: [
                { time: "00:00-07:00", activity: "Sleeping", status: "offline" },
                { time: "07:00-23:00", activity: "streaming", status: "online" },
              ],
            },
            inactivityThresholdMinutes: 120,
            talkativeness: 50,
          },
        },
      },
    }),
  };
  const source = { kind: "character", entityId: "c1", displayName: "Mika" };
  const night = await resolveSlurpCreatorAvailability(
    character,
    source,
    "UTC",
    new Date("2026-10-19T03:00:00.000Z"),
    new Date("2026-10-19T00:00:00.000Z").toISOString(),
  );
  assert.equal(night.estimated, undefined, "a schedule in the Engine's format is read, not guessed around");
  assert.deepEqual(night, { online: false, activity: "Sleeping", minutesUntilOnline: 240 });
  const day = await resolveSlurpCreatorAvailability(character, source, "UTC", new Date("2026-10-19T12:00:00.000Z"));
  assert.deepEqual(day, { online: true, activity: "streaming", minutesUntilOnline: 0 });
}

// ── More than 12 hours past its first due time, a follow-up stops waiting ─
const due = "2026-10-19T00:00:00.000Z";
const after = (ms: number) => new Date(Date.parse(due) + ms);
assert.equal(SLURP_FOLLOW_UP_AWAY_LIMIT_MS, 12 * 60 * 60_000);
assert.equal(isFollowUpPastAwayLimit(due, after(SLURP_FOLLOW_UP_AWAY_LIMIT_MS)), false, "12 hours exactly still waits");
assert.equal(isFollowUpPastAwayLimit(due, after(SLURP_FOLLOW_UP_AWAY_LIMIT_MS + 60_000)), true);
assert.equal(isFollowUpPastAwayLimit(undefined, after(SLURP_FOLLOW_UP_AWAY_LIMIT_MS * 3)), false);
const scheduler = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/messages/slp-follow-up-scheduler-service.ts",
);
// The limit counts from the pinned first due time, which no postponement moves.
assert.match(
  scheduler,
  /const availability = \{\s*\.\.\.naturalAvailability,\s*\.\.\.details\.availability,[^}]*\.\.\.\(isFollowUpPastAwayLimit\(followUp\.firstDueAt \?\? followUp\.scheduledAt\) \? \{ online: true \} : \{\}\),\s*\};/u,
  "past the limit, the away check lets the follow-up through",
);
// Only the away check gives way: an unanswered fan, a cool-off and night quiet still postpone it.
assert.match(scheduler, /if \(thread\.needsReply\) \{\s*await messages\.postponeScheduledFollowUp\(/u);
assert.match(
  scheduler,
  /if \(coolingOff \|\| quiet \|\| \(!availability\.online && availability\.minutesUntilOnline !== null\)\) \{/u,
);
assert.equal(scheduler.match(/isFollowUpPastAwayLimit\(/gu)?.length, 1, "the limit touches the away check only");

void engineSchedule().then(() => console.log("slurp2 schedule ranges regression passed"));
