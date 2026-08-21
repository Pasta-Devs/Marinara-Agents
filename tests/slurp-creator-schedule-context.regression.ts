import assert from "node:assert/strict";
import {
  parseSlurpWeekSchedule,
  resolveSlurpCreatorScheduleContext,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-creator-schedule-context";

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

const source = { kind: "character", entityId: "character-1", displayName: "Ari" };
const fixed = new Date("2026-08-18T05:30:00.000Z");
const character = { data: JSON.stringify({ extensions: { conversationSchedule: schedule } }) };
const chats = (enabled: boolean, zone = "America/New_York") => ({
  list: async () => [
    {
      mode: "conversation",
      characterIds: JSON.stringify([source.entityId]),
      metadata: JSON.stringify({ conversationSchedulesEnabled: enabled, conversationTimeZone: zone }),
    },
  ],
});
const characters = (value: typeof character | null) => ({ getById: async () => value });

async function main() {
  const context = await resolveSlurpCreatorScheduleContext(chats(true), characters(character), source, "UTC", fixed);
  assert.match(context, /busy at work and slow to reply/u);
  assert.match(context, /Tuesday/u);
  assert.match(context, /America\/New_York/u);

  const disabled = await resolveSlurpCreatorScheduleContext(chats(false), characters(character), source, "UTC", fixed);
  assert.match(disabled, /No active Conversation Schedule/u);

  const staleCharacter = {
    data: JSON.stringify({
      extensions: { conversationSchedule: { ...schedule, weekStart: "2026-08-10T00:00:00.000Z" } },
    }),
  };
  const stale = await resolveSlurpCreatorScheduleContext(chats(true), characters(staleCharacter), source, "UTC", fixed);
  assert.match(stale, /No active Conversation Schedule/u);

  const missing = await resolveSlurpCreatorScheduleContext(chats(true), characters(null), source, "UTC", fixed);
  assert.match(missing, /No active Conversation Schedule/u);

  const persona = await resolveSlurpCreatorScheduleContext(
    chats(true),
    characters(character),
    { ...source, kind: "persona" },
    "UTC",
    fixed,
  );
  assert.match(persona, /No active Conversation Schedule/u);

  assert.equal(
    parseSlurpWeekSchedule({ ...schedule, days: { Monday: [{ time: "08:00" }] } }),
    null,
    "Malformed schedule blocks must not reach generation",
  );

  console.log("Slurp Creator schedule context regression passed");
}

void main();
