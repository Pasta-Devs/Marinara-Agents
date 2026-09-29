import assert from "node:assert/strict";
import { join } from "node:path";

import {
  resolveSlurpCreatorAvailability,
  resolveSlurpCreatorScheduleContext,
  resolveSlurpCreatorScheduleStatus,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-schedule-context.js";
import { slurp2BackstageSource } from "./slurp2-backstage-source";
import { slurp2Source } from "./slurp2-source";

async function main() {
  // A Tuesday, so "this week" starts on the Monday before it.
  const now = new Date("2026-09-08T12:00:00.000Z");
  const thisMonday = "2026-09-07T00:00:00.000Z";
  const lastMonday = "2026-08-31T00:00:00.000Z";

  const character = (extensions: Record<string, unknown>) => ({
    getById: async () => ({ data: { extensions } }),
  });
  const characterSource = { kind: "character", entityId: "c1", displayName: "Mika" };
  const week = (weekStart: string, days: Record<string, Array<{ time: string; activity: string }>>) => ({
    weekStart,
    days,
  });
  const tuesdayBlocks = { Tuesday: [{ time: "09:00", activity: "at the studio" }] };

  // ── The one that was invisible ──────────────────────────────────────────────
  // Engine schedules are keyed to a Monday. One that was not regenerated this week stops applying
  // entirely: the Creator loses their daily rhythm and their message pacing, and every prompt path
  // simply says "no active schedule". It looked like the writing got worse.
  assert.deepEqual(
    await resolveSlurpCreatorScheduleStatus(
      character({ conversationSchedule: week(lastMonday, tuesdayBlocks) }),
      characterSource,
      undefined,
      now,
    ),
    { state: "stale" },
  );

  // Writers store Monday at *local* midnight. East of UTC that instant is Sunday in UTC, which used
  // to read as last week: a schedule regenerated a minute ago still warned "Needs attention".
  for (const [zone, weekStart] of [
    ["Europe/Berlin", "2026-09-06T22:00:00.000Z"],
    ["Asia/Tokyo", "2026-09-06T15:00:00.000Z"],
    ["America/Los_Angeles", "2026-09-07T07:00:00.000Z"],
    ["Pacific/Auckland", "2026-09-06T11:00:00.000Z"],
    ["Pacific/Kiritimati", "2026-09-06T10:00:00.000Z"],
    ["UTC", "2026-09-07T00:00:00.000Z"],
  ] as const) {
    // Far-east zones are already on Wednesday at `now`, so assert only that this week still counts.
    assert.notEqual(
      (
        await resolveSlurpCreatorScheduleStatus(
          character({ conversationSchedule: week(weekStart, tuesdayBlocks) }),
          characterSource,
          zone,
          now,
        )
      ).state,
      "stale",
      zone,
    );
  }
  assert.deepEqual(
    await resolveSlurpCreatorScheduleStatus(
      character({ conversationSchedule: week("2026-08-30T22:00:00.000Z", tuesdayBlocks) }),
      characterSource,
      "Europe/Berlin",
      now,
    ),
    { state: "stale" },
  );

  // Second line of defence: whatever makes a week look old (time zones, the Engine editor keeping the
  // original weekStart on save), the routine keeps applying, as Engine chats use it.
  const oldWeek = character({ conversationSchedule: week(lastMonday, tuesdayBlocks) });
  assert.match(await resolveSlurpCreatorScheduleContext(oldWeek, characterSource, "UTC", now), /at the studio/u);
  assert.equal((await resolveSlurpCreatorAvailability(oldWeek, characterSource, "UTC", now)).estimated, undefined);

  // ── Every other reason is reported as itself ────────────────────────────────
  // The prompt paths collapse all of these into one sentence, which is right for a prompt and
  // useless for a person deciding what to do about it.
  assert.deepEqual(
    await resolveSlurpCreatorScheduleStatus(
      character({ conversationSchedule: week(thisMonday, tuesdayBlocks) }),
      characterSource,
      undefined,
      now,
    ),
    { state: "active", blocks: 1 },
  );
  assert.deepEqual(
    await resolveSlurpCreatorScheduleStatus(
      character({ conversationSchedule: week(thisMonday, { Monday: [{ time: "09:00", activity: "asleep" }] }) }),
      characterSource,
      undefined,
      now,
    ),
    { state: "empty-today" },
    "a schedule with nothing for today is not the same as no schedule",
  );
  assert.deepEqual(await resolveSlurpCreatorScheduleStatus(character({}), characterSource, undefined, now), {
    state: "missing",
  });
  assert.deepEqual(
    await resolveSlurpCreatorScheduleStatus(
      character({ conversationSchedulesEnabled: false, conversationSchedule: week(thisMonday, tuesdayBlocks) }),
      characterSource,
      undefined,
      now,
    ),
    { state: "disabled" },
  );
  assert.deepEqual(
    await resolveSlurpCreatorScheduleStatus(
      character({ conversationSchedule: { ...week(thisMonday, tuesdayBlocks), enabled: false } }),
      characterSource,
      undefined,
      now,
    ),
    { state: "disabled" },
  );

  // A persona-backed Creator — the kind the player operates — has no schedule to report, because
  // Conversation Schedules are a character feature. Saying "missing" there would be a false alarm on
  // every Creator the player runs.
  assert.deepEqual(
    await resolveSlurpCreatorScheduleStatus(
      character({ conversationSchedule: week(thisMonday, tuesdayBlocks) }),
      { kind: "persona", entityId: "p1", displayName: "You" },
      undefined,
      now,
    ),
    { state: "not-applicable" },
  );

  // Nonsense in the extension must read as missing rather than throw.
  for (const bad of [null, "nonsense", 42, { days: {} }]) {
    const status = await resolveSlurpCreatorScheduleStatus(
      character({ conversationSchedule: bad }),
      characterSource,
      undefined,
      now,
    );
    assert.equal(status.state, "missing", `unexpected status for ${JSON.stringify(bad)}`);
  }
}

void main();

// ── Wiring ──────────────────────────────────────────────────────────────────
const root = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => slurp2Source(join(root, path));

assert.match(read("server/src/services/storage/slurp.storage.ts"), /scheduleStatus: publicAccount/u);
const settings = slurp2BackstageSource();
// An older schedule keeps repeating, so it is a note on the Creator, never a "Needs attention" warning.
assert.doesNotMatch(settings, /function needsAttention\([^)]*\) \{[^}]*scheduleStatus/u);
assert.match(settings, /creator\.scheduleStatus\?\.state === "stale"/u);
assert.match(settings, /ui\.slurp\.settings\.creators\.schedule\.\$\{selectedCreator\.scheduleStatus\.state\}/u);

console.log("slurp schedule status regression passed");
