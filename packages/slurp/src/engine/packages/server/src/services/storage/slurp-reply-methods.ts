import { and, asc, eq, inArray } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { isFileUniqueConstraintError } from "../../db/file-schema.js";
import { slurpMessageClaims, slurpMessages, slurpThreads } from "../../db/schema/slurp.js";
import { newId } from "../../utils/id-generator.js";
import { createSlurpReplyQueueStorage } from "./slurp-reply-queue.storage.js";
import { mapThread, now } from "./slurp-messages.helpers.js";
import type { SlurpThread } from "./slurp-messages.types.js";

type ReplyStorage = {
  listMessages(threadId: string, limit?: number): Promise<Array<{ role: "viewer" | "creator" }>>;
};

export function createSlurpReplyMethods(db: DB, storage: () => ReplyStorage) {
  return {
    async claimReply(
      threadId: string,
      triggerMessageId: string,
      creatorAccountId: string,
    ): Promise<{ status: "claimed"; claimId: string } | { status: "busy" }> {
      const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();
      const stale = await db
        .select()
        .from(slurpMessageClaims)
        .where(
          and(eq(slurpMessageClaims.threadId, threadId), eq(slurpMessageClaims.creatorAccountId, creatorAccountId)),
        );
      for (const row of stale) {
        if (row.replyMessageId) {
          const completed = await db.select().from(slurpMessages).where(eq(slurpMessages.id, row.replyMessageId));
          if (completed.length > 0) {
            await db.delete(slurpMessageClaims).where(eq(slurpMessageClaims.id, row.id));
            continue;
          }
        }
        if (row.claimedAt < staleBefore) await db.delete(slurpMessageClaims).where(eq(slurpMessageClaims.id, row.id));
      }
      try {
        const id = newId();
        await db
          .insert(slurpMessageClaims)
          .values({ id, threadId, triggerMessageId, creatorAccountId, replyMessageId: null, claimedAt: now() });
        return { status: "claimed", claimId: id };
      } catch (error) {
        if (!isFileUniqueConstraintError(error, "slurp_message_claims", ["threadId"])) throw error;
        return { status: "busy" };
      }
    },

    async releaseReplyClaim(claimId: string): Promise<void> {
      await db.delete(slurpMessageClaims).where(eq(slurpMessageClaims.id, claimId));
    },

    async setReplyNotBefore(threadId: string, value: string | null): Promise<void> {
      await db
        .update(slurpThreads)
        .set({ replyNotBeforeAt: value, updatedAt: now() })
        .where(eq(slurpThreads.id, threadId));
    },

    async setExtendedOnline(threadId: string, value: string | null): Promise<void> {
      await db
        .update(slurpThreads)
        .set({ extendedOnlineUntil: value, updatedAt: now() })
        .where(eq(slurpThreads.id, threadId));
    },

    async listThreadsAwaitingReply(limit = 20): Promise<SlurpThread[]> {
      const rows = await db
        .select()
        .from(slurpThreads)
        .where(inArray(slurpThreads.state, ["active", "request"]))
        .orderBy(asc(slurpThreads.lastMessageAt));
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const candidates = rows
        .map(mapThread)
        .filter(
          (thread) =>
            thread.creatorUnread > 0 &&
            (!thread.coolUntil || thread.coolUntil <= nowIso) &&
            (!thread.replyNotBeforeAt || Date.parse(thread.replyNotBeforeAt) <= nowMs),
        );
      const queue = createSlurpReplyQueueStorage(db);
      const ready = await Promise.all(
        candidates.map(async (thread) => {
          if (await queue.hasPending(thread.id)) return null;
          const [newest] = await storage().listMessages(thread.id, 1);
          return newest?.role === "viewer" ? thread : null;
        }),
      );
      return ready.filter((thread): thread is SlurpThread => thread !== null).slice(0, limit);
    },
  };
}
