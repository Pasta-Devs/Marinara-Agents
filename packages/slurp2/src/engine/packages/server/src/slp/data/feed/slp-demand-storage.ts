import type { DB } from "../../../db/connection.js";
import { and, eq } from "../../../db/file-query.js";
import { slurpDemandTrends } from "../../../db/schema/slurp.js";
import { newId } from "../../../utils/id-generator.js";
import { normalizeSlurpDemandTopic, SLURP_DEMAND_MAX_AGE_MS } from "../../modules/feed/slp-demand.js";

export type SlurpDemandTrend = { topic: string; count: number; lastSeenAt: string };

/** Count one more ask for a topic. Returns the new count, or 0 for an empty topic. */
export async function bumpSlurpDemandTrend(
  db: DB,
  creatorAccountId: string,
  rawTopic: string,
  at = new Date(),
): Promise<number> {
  const topic = normalizeSlurpDemandTopic(rawTopic);
  if (!topic) return 0;
  const expiresAt = new Date(at.getTime() + SLURP_DEMAND_MAX_AGE_MS).toISOString();
  const [row] = await db
    .select()
    .from(slurpDemandTrends)
    .where(and(eq(slurpDemandTrends.creatorAccountId, creatorAccountId), eq(slurpDemandTrends.topic, topic)));
  if (row && Date.parse(String(row.expiresAt)) > at.getTime()) {
    const count = (Number.parseInt(String(row.count), 10) || 0) + 1;
    await db
      .update(slurpDemandTrends)
      .set({ count: String(count), lastSeenAt: at.toISOString(), expiresAt })
      .where(eq(slurpDemandTrends.id, String(row.id)));
    return count;
  }
  if (row) await db.delete(slurpDemandTrends).where(eq(slurpDemandTrends.id, String(row.id)));
  await db.insert(slurpDemandTrends).values({
    id: newId(),
    creatorAccountId,
    topic,
    count: "1",
    firstSeenAt: at.toISOString(),
    lastSeenAt: at.toISOString(),
    expiresAt,
  });
  return 1;
}

/** The live trend asked for most, or null. Ties go to the most recent. */
export async function topSlurpDemandTrend(
  db: DB,
  creatorAccountId: string,
  at = new Date(),
): Promise<SlurpDemandTrend | null> {
  const rows = await db
    .select()
    .from(slurpDemandTrends)
    .where(eq(slurpDemandTrends.creatorAccountId, creatorAccountId));
  const live = rows
    .filter((row) => Date.parse(String(row.expiresAt)) > at.getTime())
    .map((row) => ({
      topic: String(row.topic),
      count: Number.parseInt(String(row.count), 10) || 0,
      lastSeenAt: String(row.lastSeenAt),
    }))
    .sort((left, right) => right.count - left.count || right.lastSeenAt.localeCompare(left.lastSeenAt));
  return live[0] ?? null;
}
