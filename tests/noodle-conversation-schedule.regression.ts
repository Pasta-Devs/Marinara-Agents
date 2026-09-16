import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import {
  getTodaySchedule,
  scheduleNeedsRefresh,
} from "../sources/engine/packages/server/src/services/conversation/schedule.service.js";
import {
  normalizePromptTimeZone,
  resolveConversationTimeZone,
  toZonedWallClockDate,
} from "../sources/engine/packages/server/src/services/conversation/timezone.js";
import { areConversationSchedulesEnabled } from "../sources/engine/packages/server/src/services/generation/conversation-context-utils.js";

const slurpScheduleGenerationSource = readFileSync(
  new URL(
    "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-conversation-schedule-generation.ts",
    import.meta.url,
  ),
  "utf8",
);
const slurpRoutesSource = readFileSync(
  new URL("../packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts", import.meta.url),
  "utf8",
);
assert.match(slurpScheduleGenerationSource, /attempt < 2/u, "invalid generated schedules must receive one retry");
assert.match(
  slurpScheduleGenerationSource,
  /responseFormat: \{ type: "json_object" \}/u,
  "schedule generation must request structured JSON output",
);
assert.match(
  slurpRoutesSource,
  /reply\.code\(502\)[\s\S]*did not return a complete schedule/u,
  "invalid model output must produce a recoverable response instead of a generic 500",
);

// Run the owned function with its real captured schedule helpers. Importing the
// whole prompt service would require unrelated storage, provider and image setup.
const promptSource = readFileSync(
  new URL(
    "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-public-prompt.service.ts",
    import.meta.url,
  ),
  "utf8",
);
const supportSource = readFileSync(
  new URL(
    "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-public-support.ts",
    import.meta.url,
  ),
  "utf8",
);
const scheduleSource = promptSource.slice(
  promptSource.indexOf("function parseWeekSchedule("),
  promptSource.indexOf("/**", promptSource.indexOf("export async function buildGeneratedCharacterScheduleContext(")),
);
const recordSource = supportSource.slice(
  supportSource.indexOf("export function parseRecord("),
  supportSource.indexOf("export function parseStringArray("),
);
assert.ok(scheduleSource.includes("export async function buildGeneratedCharacterScheduleContext("));
assert.ok(recordSource.includes("export function parseRecord("));
const buildGeneratedCharacterScheduleContext = runInNewContext(
  stripTypeScriptTypes(
    `${recordSource}\n${scheduleSource}\nbuildGeneratedCharacterScheduleContext;`.replace(/^export /gmu, ""),
  ),
  {
    getTodaySchedule,
    scheduleNeedsRefresh,
    normalizePromptTimeZone,
    resolveConversationTimeZone,
    toZonedWallClockDate,
    areConversationSchedulesEnabled,
  },
) as typeof import("../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-public-prompt.service.js").buildGeneratedCharacterScheduleContext;

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

  // PDT is UTC-7: these instants are Monday 18:00 and 08:00 locally.
  assert.equal(
    await contextAt(
      "2026-08-17T01:00:00.000Z",
      [enabledChat(schedule, { conversationTimeZone: "America/Los_Angeles" })],
      "UTC",
    ),
    "No generated schedules are available for today.",
    "The Sunday local date must not read Monday’s schedule",
  );
  assert.match(
    await contextAt(
      "2026-08-18T01:00:00.000Z",
      [enabledChat(schedule, { conversationTimeZone: "America/Los_Angeles" })],
      "UTC",
    ),
    /asleep and unavailable/u,
  );
  assert.match(
    await contextAt(
      "2026-08-17T15:00:00.000Z",
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
