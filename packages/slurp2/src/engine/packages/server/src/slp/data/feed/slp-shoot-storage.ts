import type { DB } from "../../../db/connection.js";
import { desc, eq } from "../../../db/file-query.js";
import { slurpShootSessions } from "../../../db/schema/slurp.js";
import { newId } from "../../../utils/id-generator.js";
import type { SlurpCameraSource } from "../../modules/feed/slp-camera-source.js";
import {
  SLURP_SHOOT_MAX_SHOTS,
  SLURP_SHOOT_MAX_AGE_MS,
  SLURP_SHOOT_KEEP_PER_CREATOR,
} from "../../modules/feed/slp-shoot.js";

export type SlurpShootSession = {
  id: string;
  creatorAccountId: string;
  place: string;
  company: string;
  cameraSource: SlurpCameraSource;
  shotsUsed: number;
  createdAt: string;
};

function mapShoot(row: Record<string, unknown>): SlurpShootSession {
  const shots = Number.parseInt(String(row.shotsUsed ?? "1"), 10);
  return {
    id: String(row.id),
    creatorAccountId: String(row.creatorAccountId),
    place: String(row.place ?? ""),
    company: String(row.company ?? ""),
    cameraSource: String(row.cameraSource) as SlurpCameraSource,
    // A stored count that will not parse must not make a shoot immortal, so an unreadable value
    // is treated as exhausted rather than as zero.
    shotsUsed: Number.isFinite(shots) ? shots : SLURP_SHOOT_MAX_SHOTS,
    createdAt: String(row.createdAt),
  };
}

/** Open a shoot. The drop that opens it counts as its first shot. */
export async function openSlurpShoot(
  db: DB,
  input: { creatorAccountId: string; place: string; company: string; cameraSource: SlurpCameraSource; at: Date },
): Promise<SlurpShootSession> {
  const row = {
    id: newId(),
    creatorAccountId: input.creatorAccountId,
    place: input.place,
    company: input.company,
    cameraSource: input.cameraSource,
    shotsUsed: "1",
    createdAt: input.at.toISOString(),
  };
  await db.insert(slurpShootSessions).values(row);
  await pruneSlurpShoots(db, input.creatorAccountId);
  return mapShoot(row);
}

/**
 * The shoot a later post may draw from, or null.
 *
 * A shoot runs out two ways: it has been posted from enough times, or it is simply too old. A
 * Creator posting "one more from yesterday" three weeks later is its own kind of wrong.
 */
export async function findReusableSlurpShoot(
  db: DB,
  creatorAccountId: string,
  at: Date,
): Promise<SlurpShootSession | null> {
  const rows = await db
    .select()
    .from(slurpShootSessions)
    .where(eq(slurpShootSessions.creatorAccountId, creatorAccountId))
    .orderBy(desc(slurpShootSessions.createdAt))
    .limit(1);
  const shoot = rows[0] ? mapShoot(rows[0] as Record<string, unknown>) : null;
  if (!shoot || shoot.shotsUsed >= SLURP_SHOOT_MAX_SHOTS) return null;
  const started = Date.parse(shoot.createdAt);
  if (!Number.isFinite(started) || at.getTime() - started > SLURP_SHOOT_MAX_AGE_MS) return null;
  return shoot;
}

/** Record that one more post drew from this shoot. */
export async function useSlurpShoot(db: DB, shoot: SlurpShootSession): Promise<void> {
  await db
    .update(slurpShootSessions)
    .set({ shotsUsed: String(shoot.shotsUsed + 1) })
    .where(eq(slurpShootSessions.id, shoot.id));
}

/**
 * Keep a Creator's recent shoots and drop the rest.
 *
 * Shoots are written on a schedule nobody watches, so without this the table grows for the life of
 * the save. Only the newest is ever read, so the cap is small.
 */
export async function pruneSlurpShoots(db: DB, creatorAccountId: string): Promise<void> {
  const rows = await db
    .select()
    .from(slurpShootSessions)
    .where(eq(slurpShootSessions.creatorAccountId, creatorAccountId))
    .orderBy(desc(slurpShootSessions.createdAt));
  for (const row of rows.slice(SLURP_SHOOT_KEEP_PER_CREATOR)) {
    await db.delete(slurpShootSessions).where(eq(slurpShootSessions.id, String((row as { id: unknown }).id)));
  }
}
