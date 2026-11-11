import { eq, like } from "../../../db/file-query.js";
import type { DB } from "../../../db/connection.js";
import {
  slpAccounts,
  slpCreatorReserveState,
  slpRefreshRuns,
  slurpAudienceTies,
  slurpCommissions,
  slurpContentCampaignStages,
  slurpContentCampaigns,
  slurpContentOpportunities,
  slurpContinuityEvents,
  slurpContinuityFacts,
  slurpDemandTrends,
  slurpFollowUps,
  slurpLiveShows,
  slurpPopulation,
  slurpReplyBubbles,
  slurpThreads,
} from "../../../db/schema/slurp.js";
import { appSettings } from "../../../db/schema/app-settings.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import {
  setSlurpWorldEpoch,
  setSlurpWorldOffsetMs,
  slurpWorldEpoch,
  slurpWorldNowMs,
  slurpWorldOffsetMs,
} from "../../../../../shared/src/slp/slp-world-clock.js";
import { isSlurpPreferenceSettingKey } from "../../modules/maintenance/slp-backup.js";
import { shiftSlurpDueJson, shiftSlurpIso } from "../../modules/maintenance/slp-timeline.js";
import { SLURP_SETTINGS_NAMESPACE } from "../host/slp-storage-constants.js";

export const WORLD_OFFSET_KEY = "slurp2.world.clockOffsetMs";
export const WORLD_EPOCH_KEY = "slurp2.world.epoch";
// Same keys as features/world/slp-world-tick-state.ts, which sits above this layer.
const TICK_KEY = "slurp2.world.tick";
const MAINTENANCE_KEY = "slurp2.world.maintenance";
const PULSE_KEY = "slurp2.world.pulse";

/** Load the persisted offset and epoch into the process. Call at startup and after a restore. */
export async function loadSlurpWorldClock(db: DB): Promise<void> {
  const settings = createAppSettingsStorage(db);
  setSlurpWorldOffsetMs(Number(await settings.get(WORLD_OFFSET_KEY)) || 0);
  // Never lower the epoch: a restored archive carries an older value, and the fence must hold.
  setSlurpWorldEpoch(Math.max(slurpWorldEpoch(), Number(await settings.get(WORLD_EPOCH_KEY)) || 0));
}

export async function setSlurpWorldOffset(db: DB, offsetMs: number): Promise<void> {
  await createAppSettingsStorage(db).set(WORLD_OFFSET_KEY, String(Math.trunc(offsetMs)));
  setSlurpWorldOffsetMs(offsetMs);
}

/** Bump the restore epoch. Work that started before it drops its write (`assertSlurpWorldEpoch`). */
export async function bumpSlurpWorldEpoch(db: DB): Promise<number> {
  const next = slurpWorldEpoch() + 1;
  await createAppSettingsStorage(db).set(WORLD_EPOCH_KEY, String(next));
  setSlurpWorldEpoch(next);
  return next;
}

/**
 * Persisted "when is this due / when did this end" columns. A forward skip moves
 * each by the skipped span, so a queued reply still waits the same time it had
 * left and nothing expires because the date jumped. Content stamps (createdAt,
 * publishedAt, sentAt) stay where they were: history keeps its dates.
 */
// ponytail: explicit list; a new due-style column must be added here.
const SHIFTED_COLUMNS: ReadonlyArray<[table: any, columns: readonly string[]]> = [
  [slpCreatorReserveState, ["preparationNotBefore"]],
  [slpRefreshRuns, ["nextAttemptAt"]],
  [slurpThreads, ["replyNotBeforeAt", "coolUntil", "extendedOnlineUntil"]],
  [slurpFollowUps, ["scheduledAt", "firstDueAt"]],
  [slurpCommissions, ["deliverAt"]],
  [slurpReplyBubbles, ["deliverAt"]],
  [slurpContentOpportunities, ["dueAt"]],
  [slurpContentCampaigns, ["expiresAt"]],
  [slurpContentCampaignStages, ["dueAt"]],
  [slurpContinuityFacts, ["expiresAt"]],
  [slurpContinuityEvents, ["expiresAt"]],
  [slurpDemandTrends, ["firstSeenAt", "lastSeenAt", "expiresAt"]],
  [slurpLiveShows, ["endsAt"]],
  // Renewal and churn read these against "now": a skip must neither bill nor lapse anyone.
  [slurpAudienceTies, ["paidThroughAt", "lastSeenAt"]],
  [slurpPopulation, ["lastActiveAt"]],
];

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Keys that hold clock state themselves or must never be rewritten by a skip. */
const UNSHIFTED_KEYS = new Set([WORLD_OFFSET_KEY, WORLD_EPOCH_KEY, TICK_KEY, MAINTENANCE_KEY, PULSE_KEY]);

/**
 * Move the world forward to `target` without running anything: every mark that
 * measures elapsed time is set to the new date, every due time moves with it.
 * The caller makes the checkpoint first and holds the schedulers.
 */
export async function applySlurpWorldSkip(db: DB, target: Date): Promise<void> {
  const deltaMs = target.getTime() - slurpWorldNowMs();

  for (const [table, columns] of SHIFTED_COLUMNS) {
    for (const row of (await db.select().from(table)) as Array<Record<string, unknown>>) {
      const patch: Record<string, string> = {};
      for (const column of columns) {
        const value = row[column];
        if (typeof value === "string" && ISO.test(value)) patch[column] = shiftSlurpIso(value, deltaMs) as string;
      }
      if (Object.keys(patch).length > 0)
        await db
          .update(table)
          .set(patch)
          .where(eq(table.id, row.id as string));
    }
  }

  const rows = await db
    .select()
    .from(appSettings)
    .where(like(appSettings.key, `${SLURP_SETTINGS_NAMESPACE}%`));
  const settings = createAppSettingsStorage(db);
  for (const row of rows) {
    // Preferences (settings, connections, guidance) hold choices, not run state.
    if (UNSHIFTED_KEYS.has(row.key) || isSlurpPreferenceSettingKey(row.key)) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(row.value));
    } catch {
      continue;
    }
    const shifted = JSON.stringify(shiftSlurpDueJson(parsed, deltaMs));
    if (shifted !== JSON.stringify(parsed)) await settings.set(row.key, shifted);
  }

  // Creator profiles keep their arcs/projects (chapter start, poll close) in the settings JSON.
  for (const row of await db.select().from(slpAccounts)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.settings);
    } catch {
      continue;
    }
    const shifted = JSON.stringify(shiftSlurpDueJson(parsed, deltaMs));
    if (shifted !== JSON.stringify(parsed))
      await db.update(slpAccounts).set({ settings: shifted }).where(eq(slpAccounts.id, row.id));
  }

  // Last, so nothing that reads the clock sees a new date before the due times have moved with it.
  const marks = createAppSettingsStorage(db);
  for (const key of [TICK_KEY, MAINTENANCE_KEY, PULSE_KEY]) await marks.set(key, target.toISOString());
  await setSlurpWorldOffset(db, slurpWorldOffsetMs() + deltaMs);
}
