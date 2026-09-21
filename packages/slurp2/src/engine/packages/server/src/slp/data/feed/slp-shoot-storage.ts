import type { DB } from "../../../db/connection.js";
import { desc, eq } from "../../../db/file-query.js";
import { slurpShootSessions } from "../../../db/schema/slurp.js";
import { newId } from "../../../utils/id-generator.js";
import type { SlurpCameraSource } from "../../modules/feed/slp-camera-source.js";
import type { SlurpPostEffort } from "../../modules/creators/slp-production-profile.js";
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
  shotsTaken: number;
  shotsSelected: number;
  effort: SlurpPostEffort;
  theme: string;
  status: "active" | "exhausted";
  campaignId: string | null;
  capturedAt: string;
  /** See the schema. Empty when unknown. */
  brief: string;
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
    shotsTaken: Number.parseInt(String(row.shotsTaken ?? "1"), 10) || 1,
    shotsSelected: Number.parseInt(String(row.shotsSelected ?? "1"), 10) || 1,
    effort: (["low", "medium", "high"].includes(String(row.effort)) ? row.effort : "medium") as SlurpPostEffort,
    theme: String(row.theme ?? "set"),
    status: row.status === "exhausted" ? "exhausted" : "active",
    campaignId: typeof row.campaignId === "string" ? row.campaignId : null,
    capturedAt: String(row.capturedAt || row.createdAt),
    brief: String(row.brief ?? ""),
    createdAt: String(row.createdAt),
  };
}

/** Open a shoot. The drop that opens it counts as its first shot. */
export async function openSlurpShoot(
  db: DB,
  input: {
    creatorAccountId: string;
    place: string;
    company: string;
    cameraSource: SlurpCameraSource;
    brief?: string | null;
    effort: SlurpPostEffort;
    theme: string;
    campaignId?: string | null;
    shotsTaken?: number;
    at: Date;
  },
): Promise<SlurpShootSession> {
  const row = {
    id: newId(),
    creatorAccountId: input.creatorAccountId,
    place: input.place,
    company: input.company,
    cameraSource: input.cameraSource,
    shotsUsed: "1",
    shotsTaken: String(input.shotsTaken ?? 1),
    shotsSelected: "1",
    effort: input.effort,
    theme: input.theme.trim().slice(0, 120) || "set",
    status: "active",
    campaignId: input.campaignId ?? null,
    capturedAt: input.at.toISOString(),
    // Bounded: the brief is a prompt, not a document, and it rides into every later brief.
    brief: (input.brief ?? "").trim().slice(0, 1200),
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
  const next = shoot.shotsUsed + 1;
  await db
    .update(slurpShootSessions)
    .set({ shotsUsed: String(next), status: next >= SLURP_SHOOT_MAX_SHOTS ? "exhausted" : "active" })
    .where(eq(slurpShootSessions.id, shoot.id));
}

export async function recordSlurpShootSelection(db: DB, shootId: string, selected: number): Promise<void> {
  const rows = await db.select().from(slurpShootSessions).where(eq(slurpShootSessions.id, shootId));
  const shoot = rows[0] ? mapShoot(rows[0] as Record<string, unknown>) : null;
  if (!shoot) return;
  await db
    .update(slurpShootSessions)
    .set({
      shotsTaken: String(Math.max(shoot.shotsTaken, selected)),
      shotsSelected: String(Math.max(shoot.shotsSelected, selected)),
    })
    .where(eq(slurpShootSessions.id, shootId));
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
