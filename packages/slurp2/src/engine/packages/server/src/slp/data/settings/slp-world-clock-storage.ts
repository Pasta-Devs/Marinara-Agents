import { eq, like } from "../../../db/file-query.js";
import type { DB } from "../../../db/connection.js";
import {
  slpAccounts,
  slpCreatorPreparedPosts,
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
import {
  EXTRAS_OFFER_DUE_KEY,
  WALLET_DUE_KEY,
  setSlurpMarkJson,
  shiftSlurpDueJson,
  shiftSlurpIso,
} from "../../modules/maintenance/slp-timeline.js";
import { SLURP_CREATOR_STATE_KEY, SLURP_SETTINGS_NAMESPACE } from "../host/slp-storage-constants.js";

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
  // A prepared post publishes when `publishAt` passes: it moves with the skip (`generatedAt` is history and stays).
  [slpCreatorPreparedPosts, ["publishAt"]],
  [slpRefreshRuns, ["nextAttemptAt"]],
  [
    slurpThreads,
    ["replyNotBeforeAt", "coolUntil", "extendedOnlineUntil", "moodUpdatedAt", "lastStrikeAt", "lastMessageAt"],
  ],
  [slurpFollowUps, ["scheduledAt", "firstDueAt"]],
  [slurpCommissions, ["deliverAt"]],
  [slurpReplyBubbles, ["deliverAt"]],
  [slurpContentOpportunities, ["dueAt"]],
  [slurpContentCampaigns, ["expiresAt"]],
  [slurpContentCampaignStages, ["dueAt"]],
  [slurpContinuityFacts, ["expiresAt"]],
  [slurpContinuityEvents, ["expiresAt"]],
  [slurpDemandTrends, ["firstSeenAt", "lastSeenAt", "expiresAt"]],
  [slurpLiveShows, ["startedAt", "watchedAt", "endsAt"]],
  // Renewal and churn read these against "now": a skip must neither bill nor lapse anyone.
  [slurpAudienceTies, ["paidThroughAt", "lastSeenAt", "audienceArcSince"]],
  [slurpPopulation, ["lastActiveAt"]],
];

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Settings keys whose "last advanced" stamps are set to the skip target (zero elapsed). */
const MARK_KEYS: Record<string, ReadonlySet<string>> = {
  "slurp2.creator-ties": new Set(["advancedAt"]),
  "slurp2.drama.state": new Set(["advancedAt"]),
  [SLURP_CREATOR_STATE_KEY]: new Set(["updatedAt"]),
};
const THREAD_STATE_MARK_KEYS: ReadonlySet<string> = new Set(["updatedAt"]);
const EXTRAS_OFFER_KEY = "slurp2.extrasOffer";
// Support desk JSON (`slurp2.creator.<id>.desk`): its `tickedAt` is the last pass, so decay and risk see no elapsed span.
const DESK_KEY = /^slurp2\.creator\.[^.]+\.desk$/u;
const DESK_MARK_KEYS: ReadonlySet<string> = new Set(["tickedAt"]);
// A bare ISO value (a cooldown): moved with the skip.
const BARE_ISO_KEY = /\.arcAutoAt$/u;
const WALLET_KEY = /^slurp2\.viewer\.[^.]+\.wallet$/u;

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

  // A thread's mood decays from its `updatedAt`: set it to the skip target so the skipped span is not counted.
  // A paid sexting session (`sexting` JSON) keeps its remaining minutes: its window moves with the skip.
  for (const row of await db.select().from(slurpThreads)) {
    const patch: Record<string, string> = {};
    try {
      const state: unknown = JSON.parse(row.threadState);
      // A state without a stored `updatedAt` decays from the thread's own dates, so write one.
      const base =
        state && typeof state === "object" && !Array.isArray(state)
          ? { updatedAt: target.toISOString(), ...state }
          : state;
      const marked = JSON.stringify(setSlurpMarkJson(base, target.toISOString(), THREAD_STATE_MARK_KEYS));
      if (marked !== JSON.stringify(state)) patch.threadState = marked;
    } catch {
      /* malformed state: left as it is */
    }
    try {
      const moved = JSON.stringify(shiftSlurpDueJson(JSON.parse(row.sexting), deltaMs));
      if (moved !== JSON.stringify(JSON.parse(row.sexting))) patch.sexting = moved;
    } catch {
      /* no session, or malformed: left as it is */
    }
    if (Object.keys(patch).length > 0) await db.update(slurpThreads).set(patch).where(eq(slurpThreads.id, row.id));
  }

  // An opener that waits in the queue ages from `createdAt`: shift it for rows still waiting, so a postpone is not cancelled.
  // Sent, failed and cancelled rows are history and keep their dates.
  for (const row of await db.select().from(slurpFollowUps)) {
    if (
      (row.status === "pending" || row.status === "claimed") &&
      typeof row.createdAt === "string" &&
      ISO.test(row.createdAt)
    ) {
      await db
        .update(slurpFollowUps)
        .set({ createdAt: shiftSlurpIso(row.createdAt, deltaMs) as string })
        .where(eq(slurpFollowUps.id, row.id));
    }
  }

  // A quote waits for the fan's answer from its last update: shift it for quotes still open, so the wait keeps its remainder.
  for (const row of await db.select().from(slurpCommissions)) {
    if (row.state === "quoted" && typeof row.updatedAt === "string" && ISO.test(row.updatedAt)) {
      await db
        .update(slurpCommissions)
        .set({ updatedAt: shiftSlurpIso(row.updatedAt, deltaMs) as string })
        .where(eq(slurpCommissions.id, row.id));
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
    if (BARE_ISO_KEY.test(row.key) && ISO.test(String(row.value))) {
      await settings.set(row.key, shiftSlurpIso(String(row.value), deltaMs) as string);
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(row.value));
    } catch {
      continue;
    }
    let next = shiftSlurpDueJson(
      parsed,
      deltaMs,
      "",
      WALLET_KEY.test(row.key) ? WALLET_DUE_KEY : row.key === EXTRAS_OFFER_KEY ? EXTRAS_OFFER_DUE_KEY : undefined,
    );
    const markKeys =
      MARK_KEYS[row.key] ??
      (DESK_KEY.test(row.key) ? DESK_MARK_KEYS : undefined) ??
      (row.key.startsWith(`${SLURP_CREATOR_STATE_KEY}.`) ? MARK_KEYS[SLURP_CREATOR_STATE_KEY] : undefined);
    if (markKeys) next = setSlurpMarkJson(next, target.toISOString(), markKeys);
    const shifted = JSON.stringify(next);
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
