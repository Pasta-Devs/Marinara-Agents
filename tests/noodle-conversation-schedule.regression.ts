import assert from "node:assert/strict";
import { buildGeneratedCharacterScheduleContext } from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-public-prompt.service";

const characterId = "character-breakfast";
const schedule = {
  weekStart: "2026-08-17T00:00:00.000Z",
  days: {
    Monday: [
      { time: "07:00-12:00", activity: "eating breakfast and preparing for work", status: "idle" },
      { time: "12:00-18:00", activity: "busy at work and slow to reply", status: "dnd" },
      { time: "18:00-07:00", activity: "asleep and unavailable", status: "offline" },
    ],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  },
};

function chat(id: string, metadata: Record<string, unknown>, characterIds = [characterId]) {
  return { id, mode: "conversation", metadata, characterIds };
}

function fixtureChats(chats: ReturnType<typeof chat>[]) {
  return {
    list: async () => chats,
    resolveConversationPresenceState: async (id: string) => {
      const current = chats.find((item) => item.id === id);
      if (current?.metadata.conversationSchedulesEnabled === false) return { schedules: {} };
      const cardSchedule = current?.metadata.characterScheduleOnCard;
      if (cardSchedule) return { schedules: { [characterId]: cardSchedule } };
      return { schedules: (current?.metadata.characterSchedules as Record<string, unknown>) ?? {} };
    },
  } as never;
}

function legacyFixtureChats(chats: ReturnType<typeof chat>[]) {
  return { list: async () => chats } as never;
}

async function contextAt(instant: string, chats: ReturnType<typeof chat>[], timeZone?: string) {
  return buildGeneratedCharacterScheduleContext(
    fixtureChats(chats),
    new Map([[characterId, "Breakfast Character"]]),
    timeZone,
    new Date(instant),
  );
}

async function legacyContextAt(instant: string, chats: ReturnType<typeof chat>[], timeZone?: string) {
  return buildGeneratedCharacterScheduleContext(
    legacyFixtureChats(chats),
    new Map([[characterId, "Breakfast Character"]]),
    timeZone,
    new Date(instant),
  );
}

function enabledChat(scheduleValue: unknown = schedule, metadata: Record<string, unknown> = {}) {
  return chat("chat-1", {
    conversationSchedulesEnabled: true,
    characterSchedules: { [characterId]: scheduleValue },
    ...metadata,
  });
}

async function main() {
  assert.match(await contextAt("2026-08-17T08:00:00.000Z", [enabledChat()], "UTC"), /eating breakfast/u);
  assert.match(await contextAt("2026-08-17T13:00:00.000Z", [enabledChat()], "UTC"), /busy at work/u);
  assert.match(await contextAt("2026-08-17T23:00:00.000Z", [enabledChat()], "UTC"), /asleep and unavailable/u);

  assert.equal(
    await contextAt(
      "2026-08-17T08:00:00.000Z",
      [chat("chat-1", { conversationSchedulesEnabled: false, characterSchedules: { [characterId]: schedule } })],
      "UTC",
    ),
    "No generated schedules are available for today.",
  );
  assert.equal(
    await contextAt("2026-08-17T08:00:00.000Z", [chat("chat-1", {})], "UTC"),
    "No generated schedules are available for today.",
  );
  assert.match(await legacyContextAt("2026-08-17T08:00:00.000Z", [enabledChat()], "UTC"), /eating breakfast/u);
  assert.equal(
    await legacyContextAt(
      "2026-08-17T08:00:00.000Z",
      [chat("chat-1", { conversationSchedulesEnabled: false, characterSchedules: { [characterId]: schedule } })],
      "UTC",
    ),
    "No generated schedules are available for today.",
  );
  assert.match(
    await contextAt("2026-08-17T08:00:00.000Z", [chat("chat-1", { characterScheduleOnCard: schedule })], "UTC"),
    /eating breakfast/u,
  );
  assert.equal(
    await contextAt(
      "2026-08-17T08:00:00.000Z",
      [enabledChat({ ...schedule, weekStart: "2026-08-10T00:00:00.000Z" })],
      "UTC",
    ),
    "No generated schedules are available for today.",
  );

  assert.match(
    await contextAt(
      "2026-08-17T01:00:00.000Z",
      [enabledChat(schedule, { conversationTimeZone: "America/Los_Angeles" })],
      "UTC",
    ),
    /asleep and unavailable/u,
  );
  assert.match(
    await contextAt(
      "2026-08-17T06:00:00.000Z",
      [enabledChat(schedule, { conversationTimeZone: "America/Los_Angeles" })],
      "UTC",
    ),
    /eating breakfast/u,
  );

  const valid = enabledChat();
  valid.characterIds = [characterId, "other"];
  const invalid = chat("chat-2", {
    conversationSchedulesEnabled: true,
    characterSchedules: { [characterId]: { days: schedule.days } },
  });
  assert.match(await contextAt("2026-08-17T08:00:00.000Z", [invalid, valid], "UTC"), /eating breakfast/u);

  const beforeRefresh = await contextAt("2026-08-17T08:00:00.000Z", [enabledChat()], "UTC");
  const changedSchedule = {
    ...schedule,
    days: {
      ...schedule.days,
      Monday: [{ time: "00:00-00:00", activity: "schedule changed before refresh", status: "online" }],
    },
  };
  const afterRefresh = await contextAt("2026-08-17T08:00:00.000Z", [enabledChat(changedSchedule)], "UTC");
  assert.match(beforeRefresh, /eating breakfast/u);
  assert.match(afterRefresh, /schedule changed before refresh/u);

  console.log("Noodle conversation schedule regression fixture passed.");
}

void main();
