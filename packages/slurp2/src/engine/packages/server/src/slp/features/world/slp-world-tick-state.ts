import type { DB } from "../../../db/connection.js";
import { and, eq } from "../../../db/file-query.js";
import { slurpWorldClaims } from "../../../db/schema/slurp.js";
import { newId } from "../../../utils/id-generator.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import { isSlurpFileUniqueConstraintError } from "../../base/host/slp-file-errors.js";

const TICK_KEY = "slurp2.world.tick";
const MAINTENANCE_KEY = "slurp2.world.maintenance";
const WORLD_CLAIM_ID = "world";
const WORLD_CLAIM_STALE_MS = 30 * 60_000;

/**
 * The pulse keeps its own mark, and this is why.
 *
 * The tick advances on every notifications read, which the client polls every 30 seconds. So a
 * pulse saw `elapsedMinutes` of about 0.5, `slurpPulseBudget` floored that to zero at every
 * audience size, and `writeLastTick` then consumed the half-minute anyway. The layer whose whole
 * stated purpose is "likes must arrive while the player watches" produced nothing for as long as
 * the player was watching, and only fired if Slurp had been closed for five minutes or more.
 *
 * Holding a separate mark lets the unspent time accumulate until it is worth at least one
 * reaction, instead of being rounded away several thousand times a day.
 */
export const PULSE_KEY = "slurp2.world.pulse";

export async function readLastTick(db: DB): Promise<Date | null> {
  const raw = await createAppSettingsStorage(db).get(TICK_KEY);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

export async function writeLastTick(db: DB, at: Date): Promise<void> {
  await createAppSettingsStorage(db).set(TICK_KEY, at.toISOString());
}

export async function readMaintenanceMark(db: DB): Promise<Date | null> {
  const raw = await createAppSettingsStorage(db).get(MAINTENANCE_KEY);
  const parsed = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

export async function writeMaintenanceMark(db: DB, at: Date): Promise<void> {
  await createAppSettingsStorage(db).set(MAINTENANCE_KEY, at.toISOString());
}

export async function readPulseMark(db: DB): Promise<Date | null> {
  const raw = await createAppSettingsStorage(db).get(PULSE_KEY);
  const parsed = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

/** Claim the world tick across processes until the current pass finishes. */
export async function claimWorldTick(db: DB, at: Date): Promise<(() => Promise<void>) | null> {
  const token = newId();
  try {
    await db.transaction(async (tx) => {
      const rows = await tx.select().from(slurpWorldClaims).where(eq(slurpWorldClaims.id, WORLD_CLAIM_ID));
      const current = rows[0] as Record<string, unknown> | undefined;
      const claimedAt = current?.claimedAt ? Date.parse(String(current.claimedAt)) : Number.NaN;
      if (current && Number.isFinite(claimedAt) && at.getTime() - claimedAt < WORLD_CLAIM_STALE_MS) {
        throw new Error("slurp world tick is already claimed");
      }
      if (current) await tx.delete(slurpWorldClaims).where(eq(slurpWorldClaims.id, WORLD_CLAIM_ID));
      await tx.insert(slurpWorldClaims).values({ id: WORLD_CLAIM_ID, token, claimedAt: at.toISOString() });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "slurp world tick is already claimed") return null;
    if (isSlurpFileUniqueConstraintError(error, "slurp2_world_claims", ["id"])) return null;
    throw error;
  }
  return async () => {
    await db
      .delete(slurpWorldClaims)
      .where(and(eq(slurpWorldClaims.id, WORLD_CLAIM_ID), eq(slurpWorldClaims.token, token)));
  };
}
