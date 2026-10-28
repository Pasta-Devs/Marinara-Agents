/**
 * Lines the Support desk writes into Slurp Support's one thread with a Creator: Slurp's notices, the
 * desk's own moves, and the Creator's lines the world tick starts (a ticket, a confrontation). The
 * thread is opened when missing, like the sign-up keep does.
 */
import type { DB } from "../../../db/connection.js";
import { createSlurpMessagesStorage } from "../slp-storage.js";
import { SLURP_SUPPORT_ACCOUNT_ID } from "../../../../../shared/src/slp/slp-support.js";

const SUPPORT_NAME = "Slurp Support";

export async function openSlurpSupportThread(db: DB, creatorAccountId: string): Promise<string | null> {
  const opened = await createSlurpMessagesStorage(db).openThread(
    SLURP_SUPPORT_ACCOUNT_ID,
    creatorAccountId,
    "creator",
    "waive",
  );
  return opened.status === "ok" ? opened.thread.id : null;
}

/**
 * One line in the Support thread. `notice`: Slurp's own system line. `support`: a line Support says
 * (marked like the player's Support lines). `creator`: the Creator speaks (a ticket, being caught).
 */
export async function appendSlurpDeskLine(
  db: DB,
  creatorAccountId: string,
  line: { as: "notice" | "support" | "creator"; content: string; metadata?: Record<string, unknown>; id?: string },
) {
  const threadId = await openSlurpSupportThread(db, creatorAccountId);
  if (!threadId) return null;
  const messages = createSlurpMessagesStorage(db);
  if (line.as === "creator")
    return messages.appendMessage(threadId, {
      id: line.id,
      senderAccountId: creatorAccountId,
      role: "creator",
      content: line.content,
      metadata: { desk: true, ...line.metadata },
    });
  return messages.appendMessage(threadId, {
    id: line.id,
    senderAccountId: SLURP_SUPPORT_ACCOUNT_ID,
    role: "viewer",
    kind: line.as === "notice" ? "system" : "text",
    content: line.content,
    metadata:
      line.as === "notice"
        ? // Quiet: a notice or a note asks nobody for an answer (no reply flag, no unread).
          { desk: true, deskNotice: true, deskQuiet: true, ...line.metadata }
        : { desk: true, sceneSpeaker: SUPPORT_NAME, supportVoice: true, ...line.metadata },
  });
}
