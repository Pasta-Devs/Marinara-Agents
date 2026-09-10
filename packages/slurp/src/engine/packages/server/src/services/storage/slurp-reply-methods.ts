import { and, asc, desc, eq, inArray } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { isFileUniqueConstraintError } from "../../db/file-schema.js";
import { slurpMessageClaims, slurpMessages, slurpThreads } from "../../db/schema/slurp.js";
import { newId } from "../../utils/id-generator.js";
import { createSlurpReplyQueueStorage } from "./slurp-reply-queue.storage.js";
import { mapThread, now } from "./slurp-messages.helpers.js";
import type { SlurpThread } from "./slurp-messages.types.js";

type ReplyStorage = {
  listMessages(threadId: string, limit?: number): Promise<Array<{ id: string; role: "viewer" | "creator" }>>;
};

export function createSlurpReplyMethods(db: DB, storage: () => ReplyStorage) {
  return {
    async claimReply(
      threadId: string,
      triggerMessageId: string,
      creatorAccountId: string,
    ): Promise<
      { status: "claimed"; claimId: string } | { status: "completed"; messageId: string } | { status: "busy" }
    > {
      const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();
      const stale = await db
        .select()
        .from(slurpMessageClaims)
        .where(
          and(eq(slurpMessageClaims.threadId, threadId), eq(slurpMessageClaims.creatorAccountId, creatorAccountId)),
        );
      let completedClaimId: string | null = null;
      for (const row of stale) {
        if (row.replyMessageId) {
          const completed = await db.select().from(slurpMessages).where(eq(slurpMessages.id, row.replyMessageId));
          if (completed.length > 0) {
            if (row.triggerMessageId === triggerMessageId) {
              return { status: "completed", messageId: String(row.replyMessageId) };
            }
            completedClaimId = String(row.id);
            continue;
          }
        }
        if (row.claimedAt < staleBefore) await db.delete(slurpMessageClaims).where(eq(slurpMessageClaims.id, row.id));
      }
      const threadRows = await db.select().from(slurpThreads).where(eq(slurpThreads.id, threadId));
      const thread = threadRows[0];
      if (!thread || (thread.state !== "active" && thread.state !== "request")) return { status: "busy" };
      const newestRows = await db
        .select()
        .from(slurpMessages)
        .where(and(eq(slurpMessages.threadId, threadId), eq(slurpMessages.role, "viewer")))
        .orderBy(desc(slurpMessages.createdAt), desc(slurpMessages.id))
        .limit(1);
      if (newestRows[0]?.id !== triggerMessageId) return { status: "busy" };
      try {
        const id = newId();
        if (completedClaimId) {
          await db.delete(slurpMessageClaims).where(eq(slurpMessageClaims.id, completedClaimId));
        }
        await db.insert(slurpMessageClaims).values({
          id,
          threadId,
          triggerMessageId,
          creatorAccountId,
          replyMessageId: null,
          generationEpoch: String(thread.generationEpoch ?? "0"),
          claimedAt: now(),
        });
        return { status: "claimed", claimId: id };
      } catch (error) {
        if (!isFileUniqueConstraintError(error, "slurp_message_claims", ["threadId"])) throw error;
        return { status: "busy" };
      }
    },

    async getCompletedReply(threadId: string, triggerMessageId: string): Promise<string | null> {
      const rows = await db
        .select({ replyMessageId: slurpMessageClaims.replyMessageId })
        .from(slurpMessageClaims)
        .where(
          and(eq(slurpMessageClaims.threadId, threadId), eq(slurpMessageClaims.triggerMessageId, triggerMessageId)),
        );
      return rows[0]?.replyMessageId ? String(rows[0].replyMessageId) : null;
    },

    async releaseReplyClaim(claimId: string): Promise<void> {
      const rows = await db.select().from(slurpMessageClaims).where(eq(slurpMessageClaims.id, claimId));
      if (rows[0] && !rows[0].replyMessageId) {
        await db.delete(slurpMessageClaims).where(eq(slurpMessageClaims.id, claimId));
      }
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
            thread.needsReply &&
            (!thread.coolUntil || thread.coolUntil <= nowIso) &&
            (!thread.replyNotBeforeAt || Date.parse(thread.replyNotBeforeAt) <= nowMs),
        );
      const queue = createSlurpReplyQueueStorage(db);
      const ready: SlurpThread[] = [];
      for (const thread of candidates) {
        if (ready.length >= limit) break;
        if (await queue.hasPending(thread.id)) continue;
        const [newest] = await storage().listMessages(thread.id, 1);
        if (newest?.role === "viewer") ready.push(thread);
      }
      return ready;
    },
  };
}
