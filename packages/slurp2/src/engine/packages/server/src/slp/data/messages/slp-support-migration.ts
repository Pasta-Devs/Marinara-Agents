/**
 * Storage side of moving Slurp Support's lines into Support's one thread per Creator.
 *
 * The rules (which lines, idempotency) live in `modules/messages/slp-support.ts`; this is the one
 * transaction per persona thread that moves them and puts both threads' summaries right.
 */
import type { DB } from "../../../db/connection.js";
import { eq } from "../../../db/file-query.js";
import { logger } from "../../../lib/logger.js";
import {
  slurpCommissions,
  slurpFollowUps,
  slurpMessageClaims,
  slurpMessages,
  slurpReplyBubbles,
  slurpThreads,
} from "../../../db/schema/slurp.js";
import { slurpMessagePreview } from "../../modules/messages/slp-messaging.js";
import { migrateSlurpSupportLines, type SlurpSupportMigrationStore } from "../../modules/messages/slp-support.js";
import { SLURP_SUPPORT_ACCOUNT_ID } from "../../../../../shared/src/slp/slp-support.js";
import { int, mapMessage } from "./slp-messages-storage-helpers.js";
import { createSlurpMessagesStorage } from "../slp-storage.js";

type Row = Record<string, unknown>;
const byTime = (left: Row, right: Row) =>
  String(left.createdAt) === String(right.createdAt)
    ? String(left.id).localeCompare(String(right.id))
    : String(left.createdAt).localeCompare(String(right.createdAt));

export function createSlurpSupportMigrationStore(db: DB): SlurpSupportMigrationStore {
  const messages = createSlurpMessagesStorage(db);
  return {
    listThreads: async () =>
      (await db.select().from(slurpThreads)).map((row) => ({
        id: String(row.id),
        viewerAccountId: String(row.viewerAccountId),
        creatorAccountId: String(row.creatorAccountId),
      })),
    listMessages: async (threadId) =>
      (await db.select().from(slurpMessages).where(eq(slurpMessages.threadId, threadId))).map((row) =>
        mapMessage(row as Row),
      ),
    openSupportThread: async (creatorAccountId) => {
      const opened = await messages.openThread(SLURP_SUPPORT_ACCOUNT_ID, creatorAccountId, "creator", "waive");
      return opened.status === "ok" ? opened.thread.id : null;
    },
    moveMessages: async (sourceThreadId, targetThreadId, messageIds) => {
      const moving = new Set(messageIds);
      await db.transaction(async (tx) => {
        const [source] = await tx.select().from(slurpThreads).where(eq(slurpThreads.id, sourceThreadId)).limit(1);
        const [target] = await tx.select().from(slurpThreads).where(eq(slurpThreads.id, targetThreadId)).limit(1);
        if (!source || !target) return;
        const sourceRows = (await tx.select().from(slurpMessages).where(eq(slurpMessages.threadId, sourceThreadId)))
          .map((row) => row as Row)
          .sort(byTime);
        for (const row of sourceRows) {
          if (!moving.has(String(row.id))) continue;
          await tx
            .update(slurpMessages)
            .set({
              threadId: targetThreadId,
              ...(row.role === "creator" ? {} : { senderAccountId: SLURP_SUPPORT_ACCOUNT_ID }),
            })
            .where(eq(slurpMessages.id, String(row.id)));
        }
        const summary = (rows: Row[], fallbackAt: unknown) => {
          const last = rows.at(-1);
          return {
            lastMessageAt: last ? String(last.createdAt) : String(fallbackAt),
            lastMessagePreview: last
              ? slurpMessagePreview(last.kind as never, String(last.content ?? ""), int(last.price as string))
              : "",
          };
        };
        const kept = sourceRows.filter((row) => !moving.has(String(row.id)));
        const commissions = await tx
          .select()
          .from(slurpCommissions)
          .where(eq(slurpCommissions.threadId, sourceThreadId));
        if (kept.length === 0 && commissions.length === 0) {
          // Only Support ever spoke here (a kept Support sign-up chat): an empty chat would sit in the
          // persona's inbox as a blank row.
          await tx.delete(slurpReplyBubbles).where(eq(slurpReplyBubbles.threadId, sourceThreadId));
          await tx.delete(slurpMessageClaims).where(eq(slurpMessageClaims.threadId, sourceThreadId));
          await tx.delete(slurpFollowUps).where(eq(slurpFollowUps.threadId, sourceThreadId));
          await tx.delete(slurpThreads).where(eq(slurpThreads.id, sourceThreadId));
        } else {
          await tx
            .update(slurpThreads)
            .set({
              ...summary(kept, source.lastMessageAt),
              viewerUnread: String(
                Math.min(int(source.viewerUnread as string), kept.filter((row) => row.role === "creator").length),
              ),
              needsReply: source.needsReply === "true" && kept.at(-1)?.role === "viewer" ? "true" : "false",
            })
            .where(eq(slurpThreads.id, sourceThreadId));
        }
        const targetRows = (await tx.select().from(slurpMessages).where(eq(slurpMessages.threadId, targetThreadId)))
          .map((row) => row as Row)
          .sort(byTime);
        const lastIsViewer = targetRows.at(-1)?.role === "viewer";
        await tx
          .update(slurpThreads)
          .set({
            ...summary(targetRows, target.lastMessageAt),
            // An unanswered Support line stays owed; moved history is not new to the player.
            needsReply:
              lastIsViewer && (target.needsReply === "true" || source.needsReply === "true") ? "true" : "false",
          })
          .where(eq(slurpThreads.id, targetThreadId));
      });
    },
  };
}

/** Run the migration; never fails the caller (start-up, restore). */
export async function migrateSlurpSupportThreads(db: DB): Promise<void> {
  try {
    const moved = await migrateSlurpSupportLines(createSlurpSupportMigrationStore(db));
    if (moved.messages > 0)
      logger.info(
        "[slurp] Moved %d Slurp Support line(s) from %d chat(s) into Support's own threads",
        moved.messages,
        moved.threads,
      );
  } catch (error) {
    logger.warn(error, "[slurp] Could not move Slurp Support lines into Support's own threads");
  }
}
