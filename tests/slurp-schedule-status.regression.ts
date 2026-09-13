import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

import { resolveSlurpCreatorScheduleStatus } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-creator-schedule-context.js";
import {
  reconcileNoodleRefreshSchedule,
  type PersistedNoodleRefreshSchedule,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-refresh-schedule.js";

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

  // Execute the actual legacy storage method: its disabled refresh schedule must
  // not depend on reading unrelated settings or write again when already current.
  const legacyStorage = readFileSync(
    new URL("../packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts", import.meta.url),
    "utf8",
  );
  const scheduleMethod = legacyStorage.slice(
    legacyStorage.indexOf("async ensureRefreshSchedule("),
    legacyStorage.indexOf("async listAccounts()"),
  );
  let stored: PersistedNoodleRefreshSchedule | null = null;
  let scheduleWrites = 0;
  const storage = {
    getSettings: async () => {
      throw new Error("The disabled legacy refresh schedule does not need settings");
    },
    getRefreshSchedule: async () => stored,
    saveRefreshSchedule: async (value: PersistedNoodleRefreshSchedule) => {
      stored = value;
      scheduleWrites += 1;
    },
  };
  const ensureRefreshSchedule = runInNewContext(stripTypeScriptTypes(`({${scheduleMethod}})`), {
    reconcileNoodleRefreshSchedule,
  }).ensureRefreshSchedule as (this: typeof storage, at: Date) => Promise<PersistedNoodleRefreshSchedule>;
  const initialized = await ensureRefreshSchedule.call(storage, now);
  assert.equal(initialized.refreshesPerDay, 0);
  assert.deepEqual(initialized.scheduledTimes, []);
  assert.equal(await ensureRefreshSchedule.call(storage, now), initialized);
  assert.equal(scheduleWrites, 1);
}

void main();

// ── Wiring ──────────────────────────────────────────────────────────────────
const root = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => readFileSync(join(root, path), "utf8");

assert.match(read("server/src/services/storage/slurp.storage.ts"), /scheduleStatus: publicAccount/u);
const settings = read("client/src/components/slurp/SlurpSettings.tsx");
// Only the stale case earns a warning in the list. The others are stated on the Creator itself,
// where somebody is already deciding what to do about them.
assert.match(settings, /creator\.scheduleStatus\?\.state === "stale"/u);
assert.match(settings, /ui\.slurp\.settings\.creators\.schedule\.\$\{selectedCreator\.scheduleStatus\.state\}/u);

console.log("slurp schedule status regression passed");
