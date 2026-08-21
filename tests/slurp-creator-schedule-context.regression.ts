import assert from "node:assert/strict";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { buildSlurpCreatorScheduleContext } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-creator-schedule-context";

const root = join(import.meta.dirname, "..");

const schedule = {
  weekStart: "2026-08-17T00:00:00.000Z",
  days: {
    Monday: [{ time: "08:00", activity: "eating breakfast and preparing for work" }],
    Tuesday: [{ time: "13:00", activity: "busy at work and slow to reply" }],
    Wednesday: [{ time: "22:00", activity: "asleep and unavailable" }],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  },
};

const chats = {
  list: async () => [
    {
      mode: "conversation",
      characterIds: JSON.stringify(["character-1"]),
      metadata: JSON.stringify({
        conversationSchedulesEnabled: true,
        conversationTimeZone: "America/New_York",
        characterSchedules: { "character-1": schedule },
      }),
    },
  ],
} as never;

const source = { kind: "character", entityId: "character-1", displayName: "Ari" };
const fixed = new Date("2026-08-18T03:30:00.000Z");
const enabledMetadata = {
  conversationSchedulesEnabled: true,
  conversationTimeZone: "America/New_York",
  characterSchedules: { "character-1": schedule },
};

async function main() {
  const context = buildSlurpCreatorScheduleContext(
    true,
    schedule,
    source,
    new Date("2026-08-18T05:30:00.000Z"),
    "America/New_York",
    new Date("2026-08-17T00:00:00.000Z"),
  );
  assert.ok(context);
  assert.match(context, /busy at work and slow to reply/u);
  assert.match(context, /Tuesday/u);
  assert.match(context, /America\/New_York/u);
  assert.match(
    readFileSync(
      join(root, "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-creator-schedule.ts"),
      "utf8",
    ),
    /conversationSchedule/u,
    "Slurp must read the character-owned schedule field",
  );

  // This is the exact block added to post and reply generation requests.
  assert.match(context, /Current Conversation Schedule for Ari/u);

  const disabledChats = {
    list: async () => [
      {
        mode: "conversation",
        characterIds: JSON.stringify(["character-1"]),
        metadata: JSON.stringify({
          conversationSchedulesEnabled: false,
          characterSchedules: { "character-1": schedule },
        }),
      },
    ],
  } as never;
  assert.equal(buildSlurpCreatorScheduleContext(false, schedule, source, fixed), null);

  const stale = { ...schedule, weekStart: "2026-08-10T00:00:00.000Z" };
  const staleChats = {
    list: async () => [
      {
        mode: "conversation",
        characterIds: JSON.stringify(["character-1"]),
        metadata: JSON.stringify({
          conversationSchedulesEnabled: true,
          characterSchedules: { "character-1": stale },
        }),
      },
    ],
  } as never;
  assert.equal(
    buildSlurpCreatorScheduleContext(true, stale, source, fixed, "UTC", new Date("2026-08-17T00:00:00.000Z")),
    null,
  );

  console.log("Slurp Creator schedule context regression passed");
}

void main();
