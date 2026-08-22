import assert from "node:assert/strict";
import {
  buildSlurpCreatorScheduleContext,
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
const characters = (value: typeof character | null) => ({ getById: async () => value });

async function main() {
  const context = await resolveSlurpCreatorScheduleContext(characters(character), source, "America/New_York", fixed);
  assert.match(context, /busy at work and slow to reply/u);
  assert.match(context, /Tuesday/u);
  assert.match(context, /America\/New_York/u);

  const utcDateOnPreviousLocalDay = new Date("2026-08-18T02:30:00.000Z");
  const localDay = await resolveSlurpCreatorScheduleContext(
    characters(character),
    source,
    "America/Los_Angeles",
    utcDateOnPreviousLocalDay,
  );
  assert.match(localDay, /Monday/u);
  assert.match(localDay, /eating breakfast and preparing for work/u);

  const disabled = buildSlurpCreatorScheduleContext(false, schedule, source, fixed, "UTC");
  assert.equal(disabled, null);
  const disabledCharacter = {
    data: JSON.stringify({ extensions: { conversationSchedulesEnabled: false, conversationSchedule: schedule } }),
  };
  assert.match(
    await resolveSlurpCreatorScheduleContext(characters(disabledCharacter), source, "UTC", fixed),
    /No active Conversation Schedule/u,
  );

  const staleCharacter = {
    data: JSON.stringify({
      extensions: { conversationSchedule: { ...schedule, weekStart: "2026-08-10T00:00:00.000Z" } },
    }),
  };
  const stale = await resolveSlurpCreatorScheduleContext(characters(staleCharacter), source, "America/New_York", fixed);
  assert.match(stale, /No active Conversation Schedule/u);

  const missing = await resolveSlurpCreatorScheduleContext(characters(null), source, "UTC", fixed);
  assert.match(missing, /No active Conversation Schedule/u);

  const persona = await resolveSlurpCreatorScheduleContext(
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
  assert.equal(parseSlurpWeekSchedule({ ...schedule, enabled: "yes" }), null);

  console.log("Slurp Creator schedule context regression passed");
}

void main();
