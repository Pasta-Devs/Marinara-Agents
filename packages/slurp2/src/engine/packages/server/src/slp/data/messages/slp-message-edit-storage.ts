/**
 * Writes for editing a DM thread by hand (R9, `shared/src/slp/slp-message-edit.ts`). Deleting the
 * fan's newest line drops the answer owed to it (bubbles, a generation in flight); deleting anything
 * else leaves the other answers and their claims alone.
 */
import { and, desc, eq, inArray, or } from "../../../db/file-query.js";
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
  const gone = [...ids];
  // ponytail: a deleted DM picture's file stays on disk. DMs can reuse a post's picture
  // (slp-media-reuse.ts), so unlinking could break the post; the autopurge sweep is the upgrade path.
  await db.transaction(async (tx) => {
    const newest = async (role?: "viewer") => {
      const rows = await tx
        .select()
        .from(slurpMessages)
        .where(
          role
            ? and(eq(slurpMessages.threadId, threadId), eq(slurpMessages.role, role))
            : eq(slurpMessages.threadId, threadId),
        )
        .orderBy(desc(slurpMessages.createdAt))
        .limit(1);
      return rows[0];
    };
    const owed = await newest("viewer");
    // Only the claims of these messages go: another trigger's claim is what stops a second answer to it.
    await tx
      .delete(slurpMessageClaims)
      .where(
        and(
          eq(slurpMessageClaims.threadId, threadId),
          or(inArray(slurpMessageClaims.triggerMessageId, gone), inArray(slurpMessageClaims.replyMessageId, gone)),
        ),
      );
    await tx.delete(slurpMessages).where(and(eq(slurpMessages.threadId, threadId), inArray(slurpMessages.id, gone)));
    // The fan's newest line is gone: the answer owed to it is dropped (queued bubbles, a generation in
    // flight), and nothing is owed unless the thread now ends on another line of theirs.
    if (owed && gone.includes(String(owed.id))) {
      const [thread] = await tx.select().from(slurpThreads).where(eq(slurpThreads.id, threadId)).limit(1);
      const last = await newest();
      await tx.delete(slurpReplyBubbles).where(eq(slurpReplyBubbles.threadId, threadId));
      await tx
        .update(slurpThreads)
        .set({
          generationEpoch: String(Number(thread?.generationEpoch ?? 0) + 1),
          ...(last?.role === "viewer" ? {} : { needsReply: "false", replyNotBeforeAt: null }),
        })
        .where(eq(slurpThreads.id, threadId));
    }
    await refreshPreview(tx as unknown as DB, threadId);
  });
}

/** "Write it again" could not write: the answer is owed again, so the scheduler writes it later. */
export async function oweSlurpReplyAgain(db: DB, threadId: string): Promise<void> {
  await db
    .update(slurpThreads)
    .set({ needsReply: "true", replyNotBeforeAt: null, updatedAt: now() })
    .where(eq(slurpThreads.id, threadId));
}

export async function readSlurpThreadMessage(db: DB, threadId: string, messageId: string) {
  const [row] = await db
    .select()
    .from(slurpMessages)
    .where(and(eq(slurpMessages.threadId, threadId), eq(slurpMessages.id, messageId)))
    .limit(1);
  return row ? mapMessage(row) : null;
}
