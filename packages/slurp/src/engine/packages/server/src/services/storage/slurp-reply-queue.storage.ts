import { asc, eq, lte } from "../../db/file-query.js";
import { slurpReplyBubbles } from "../../db/schema/slurp.js";
import type { DB } from "../../db/connection.js";
import { newId } from "../../utils/id-generator.js";
import { isFileUniqueConstraintError } from "../../db/file-schema.js";
import { tolerateMissingTables } from "./slurp-host-tables.js";

export type SlurpReplyBubble = {
  id: string;
  batchId: string;
  sequence: number;
  threadId: string;
  senderAccountId: string;
  messageId: string;
  content: string;
  deliverAt: string;
  createdAt: string;
};

export function createSlurpReplyQueueStorage(db: DB) {
  const map = (row: typeof slurpReplyBubbles.$inferSelect): SlurpReplyBubble => ({
    id: row.id,
    batchId: row.batchId,
    sequence: Number(row.sequence),
    threadId: row.threadId,
    senderAccountId: row.senderAccountId,
    messageId: row.messageId,
    content: row.content,
    deliverAt: row.deliverAt,
    createdAt: row.createdAt,
  });
  const storage = {
    async enqueueMany(
      inputs: Array<Omit<SlurpReplyBubble, "id" | "messageId" | "sequence"> & { sequence: number }>,
    ): Promise<SlurpReplyBubble[]> {
      if (inputs.length === 0) return [];
      const rows = inputs.map((input) => ({
        id: newId(),
        ...input,
        sequence: String(input.sequence),
        messageId: newId(),
      }));
      const inserted: typeof rows = [];
      await db.transaction(async (tx) => {
        for (const row of rows) {
          try {
            await tx.insert(slurpReplyBubbles).values(row);
            inserted.push(row);
          } catch (error) {
            if (!isFileUniqueConstraintError(error, "slurp_reply_bubbles")) throw error;
          }
        }
      });
      return inserted.map(map);
    },
    async listDue(at = new Date(), limit = 40): Promise<SlurpReplyBubble[]> {
      const rows = await db
        .select()
        .from(slurpReplyBubbles)
        .where(lte(slurpReplyBubbles.deliverAt, at.toISOString()))
        .orderBy(asc(slurpReplyBubbles.deliverAt), asc(slurpReplyBubbles.batchId), asc(slurpReplyBubbles.sequence))
        .limit(limit);
      return rows.map(map);
    },
    async remove(id: string): Promise<void> {
      await db.delete(slurpReplyBubbles).where(eq(slurpReplyBubbles.id, id));
    },
    async removeForThread(threadId: string): Promise<void> {
      await db.delete(slurpReplyBubbles).where(eq(slurpReplyBubbles.threadId, threadId));
    },
    async hasPending(threadId: string): Promise<boolean> {
      return (
        (await db.select().from(slurpReplyBubbles).where(eq(slurpReplyBubbles.threadId, threadId)).limit(1)).length > 0
      );
    },
  };
  return tolerateMissingTables(storage, {
    listDue: () => [],
    enqueueMany: () => [],
    hasPending: () => false,
  });
}
