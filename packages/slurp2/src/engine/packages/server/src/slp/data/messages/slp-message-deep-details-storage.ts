import type { DB } from "../../../db/connection.js";
import { desc, eq, inArray } from "../../../db/file-query.js";
import { slpMessageDeepDetails } from "../../../db/schema/slurp.js";
import { logger } from "../../../lib/logger.js";
import {
  slpMessageDeepDetailsId,
  type SlpMessageDeepDetailsRecord,
} from "../../../../../shared/src/slp/slp-deep-details.js";

/** A chat keeps the records of its newest replies only, so a long conversation cannot grow the store. */
export const SLP_MESSAGE_DEEP_DETAILS_LIMIT = 50;

/**
 * Saves a reply's record and drops the thread's oldest beyond the limit. Best effort: a failed
 * write costs the reply its Deep details, never the reply.
 */
export async function saveSlurpMessageDeepDetails(
  db: DB,
  input: { messageId: string; threadId: string; creatorAccountId: string; record: SlpMessageDeepDetailsRecord },
): Promise<void> {
  try {
    await db.insert(slpMessageDeepDetails).values({
      id: input.messageId,
      threadId: input.threadId,
      creatorAccountId: input.creatorAccountId,
      record: JSON.stringify(input.record),
      createdAt: input.record.generatedAt,
    });
    const kept = await db
      .select({ id: slpMessageDeepDetails.id })
      .from(slpMessageDeepDetails)
      .where(eq(slpMessageDeepDetails.threadId, input.threadId))
      .orderBy(desc(slpMessageDeepDetails.createdAt), desc(slpMessageDeepDetails.id));
    const old = kept.slice(SLP_MESSAGE_DEEP_DETAILS_LIMIT).map((row) => String(row.id));
    if (old.length > 0) await db.delete(slpMessageDeepDetails).where(inArray(slpMessageDeepDetails.id, old));
  } catch (error) {
    logger.warn(error, "[slurp] Could not record deep details for a message");
  }
}

/** One message's record with the thread it belongs to, or null when none is kept. */
export async function getSlurpMessageDeepDetails(
  db: DB,
  messageId: string,
): Promise<{ threadId: string; record: SlpMessageDeepDetailsRecord } | null> {
  const [row] = await db
    .select()
    .from(slpMessageDeepDetails)
    .where(eq(slpMessageDeepDetails.id, slpMessageDeepDetailsId(messageId)));
  if (!row) return null;
  try {
    return { threadId: String(row.threadId), record: JSON.parse(String(row.record)) as SlpMessageDeepDetailsRecord };
  } catch {
    return null;
  }
}

/** The record ids a thread still keeps: what decides which replies offer Deep details. */
export async function listSlurpMessageDeepDetailIds(db: DB, threadId: string): Promise<string[]> {
  const rows = await db
    .select({ id: slpMessageDeepDetails.id })
    .from(slpMessageDeepDetails)
    .where(eq(slpMessageDeepDetails.threadId, threadId));
  return rows.map((row) => String(row.id));
}

/** A cleared or deleted chat takes its records with it: they hold the prompt and its private notes. */
export async function deleteSlurpThreadMessageDeepDetails(tx: Pick<DB, "delete">, threadIds: string[]): Promise<void> {
  if (threadIds.length > 0)
    await tx.delete(slpMessageDeepDetails).where(inArray(slpMessageDeepDetails.threadId, threadIds));
}
