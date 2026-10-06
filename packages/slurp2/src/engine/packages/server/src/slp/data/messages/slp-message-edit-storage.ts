/**
 * Writes for editing a DM thread by hand (R9, `modules/messages/slp-message-edit.ts`). Deleting
 * clears the thread's reply bubbles and claims and moves the generation epoch, so an answer that
 * was being written to the old messages is dropped instead of landing after them.
 */
import { and, desc, eq, inArray } from "../../../db/file-query.js";
import type { DB } from "../../../db/connection.js";
import { slurpMessageClaims, slurpMessages, slurpReplyBubbles, slurpThreads } from "../../../db/schema/slurp.js";
import { mapMessage } from "./slp-messages-storage-helpers.js";
import type { SlurpMessage } from "./slp-messages-storage-types.js";

const now = () => new Date().toISOString();

/** Keep the inbox preview in step with the newest message that is left. */
async function refreshPreview(tx: DB, threadId: string) {
  const [last] = await tx
    .select()
    .from(slurpMessages)
    .where(eq(slurpMessages.threadId, threadId))
    .orderBy(desc(slurpMessages.createdAt))
    .limit(1);
  await tx
    .update(slurpThreads)
    .set({ lastMessagePreview: last ? String(last.content ?? "").slice(0, 160) : "", updatedAt: now() })
    .where(eq(slurpThreads.id, threadId));
}

export async function editSlurpMessage(db: DB, message: SlurpMessage, content: string): Promise<SlurpMessage> {
  const metadata = { ...message.metadata, editedAt: now() };
  await db.transaction(async (tx) => {
    await tx
      .update(slurpMessages)
      .set({ content, metadata: JSON.stringify(metadata) })
      .where(eq(slurpMessages.id, message.id));
    await refreshPreview(tx as unknown as DB, message.threadId);
  });
  return { ...message, content, metadata };
}

export async function deleteSlurpMessages(db: DB, threadId: string, ids: readonly string[]): Promise<void> {
  if (!ids.length) return;
  // ponytail: a deleted DM picture's file stays on disk. DMs can reuse a post's picture
  // (slp-media-reuse.ts), so unlinking could break the post; the autopurge sweep is the upgrade path.
  await db.transaction(async (tx) => {
    const [thread] = await tx.select().from(slurpThreads).where(eq(slurpThreads.id, threadId)).limit(1);
    await tx.delete(slurpReplyBubbles).where(eq(slurpReplyBubbles.threadId, threadId));
    await tx.delete(slurpMessageClaims).where(eq(slurpMessageClaims.threadId, threadId));
    await tx
      .delete(slurpMessages)
      .where(and(eq(slurpMessages.threadId, threadId), inArray(slurpMessages.id, [...ids])));
    await tx
      .update(slurpThreads)
      .set({ generationEpoch: String(Number(thread?.generationEpoch ?? 0) + 1) })
      .where(eq(slurpThreads.id, threadId));
    await refreshPreview(tx as unknown as DB, threadId);
  });
}

export async function readSlurpThreadMessage(db: DB, threadId: string, messageId: string) {
  const [row] = await db
    .select()
    .from(slurpMessages)
    .where(and(eq(slurpMessages.threadId, threadId), eq(slurpMessages.id, messageId)))
    .limit(1);
  return row ? mapMessage(row) : null;
}
