/**
 * Generate and store one creator reply in a direct-message thread.
 *
 * Mirrors `slurp-creator-reply.operation.ts`: claim, resolve a connection, generate, store,
 * release on every exit. The claim is what stops the live send path and the offline scheduler
 * from both answering the same message.
 */
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { resolveSlurpTextConnection } from "./slurp-connection.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { createSlurpMessagesStorage, type SlurpMessage } from "../storage/slurp-messages.storage.js";
import { tryNoodlerAccountOperation } from "./slurp-account-operation-lock.js";
import { generateSlurpMessageReply } from "./slurp-message-generation.service.js";
import { resolveSlurpCreatorAvailability } from "./slurp-creator-schedule-context.js";
import { slurpReplyPacing, type SlurpReplyPacing } from "./slurp-messaging.js";

export type SlurpReplyOutcome =
  | { status: "replied"; message: SlurpMessage; pacing: SlurpReplyPacing }
  | { status: "queued"; pacing: SlurpReplyPacing }
  | { status: "busy" }
  | { status: "ineligible" }
  | { status: "connection_not_found" }
  | { status: "failed"; error: string };

/**
 * Decide when the creator answers, and answer now if the answer is "now".
 *
 * `force` is the scheduler's entry point: the wait has already elapsed, so pacing only shapes
 * the typing indicator and never sends the work back to the queue a second time.
 */
export async function replyToSlurpMessage(
  db: DB,
  input: { threadId: string; triggerMessageId: string; force?: boolean; debugMode?: boolean },
): Promise<SlurpReplyOutcome> {
  const messagesStore = createSlurpMessagesStorage(db);
  const slurp = createSlurpStorage(db);
  const thread = await messagesStore.getThreadById(input.threadId);
  // A request the creator has not accepted gets no reply. That is the whole point of the tray.
  if (!thread || thread.state !== "active") return { status: "ineligible" };

  const [creator, viewer] = await Promise.all([
    slurp.getNoodlerAccountById(thread.creatorAccountId),
    slurp.getViewer(thread.viewerAccountId),
  ]);
  if (!creator || !viewer) return { status: "ineligible" };

  const source = await slurp.resolveAccountSource(creator);
  const availability = source
    ? await resolveSlurpCreatorAvailability(createCharactersStorage(db), source, undefined, new Date())
    : { online: true, activity: null, minutesUntilOnline: 0 };
  const history = await messagesStore.listMessages(thread.id, 60);
  const trigger = history.find((message) => message.id === input.triggerMessageId) ?? history[history.length - 1];
  const subscriptions = await slurp.listSubscriptionsForViewer(thread.viewerAccountId);
  const subscribed = subscriptions.some((entry) => entry.creatorAccountId === thread.creatorAccountId);
  const pacing = slurpReplyPacing({
    online: availability.online,
    rapport: thread.rapport,
    subscribed,
    messageLength: trigger?.content.length ?? 0,
    minutesUntilOnline: availability.minutesUntilOnline,
  });
  if (pacing.mode === "queued" && input.force !== true) {
    await messagesStore.setReplyNotBefore(thread.id, new Date(Date.now() + pacing.notBeforeMs).toISOString());
    return { status: "queued", pacing };
  }

  const claim = await messagesStore.claimReply(thread.id, input.triggerMessageId, thread.creatorAccountId);
  if (claim.status !== "claimed") return { status: "busy" };
  const release = async () => {
    try {
      await messagesStore.releaseReplyClaim(claim.claimId);
    } catch (error) {
      logger.error(error, "[slurp-message] Failed to release the reply claim %s", claim.claimId);
    }
  };

  try {
    const locked = await tryNoodlerAccountOperation(thread.creatorAccountId, async () => {
      const settings = await slurp.getSettings();
      const connection = await resolveSlurpTextConnection(
        createConnectionsStorage(db),
        settings.generationConnectionId,
      );
      if (!connection) return { status: "connection_not_found" } as const;
      const messaging = await messagesStore.getCreatorMessaging(thread.creatorAccountId);
      const content = await generateSlurpMessageReply({
        db,
        creator,
        viewer,
        history,
        rapport: thread.rapport,
        subscribed,
        dmPolicy: messaging.dmPolicy,
        isRequest: false,
        connection,
        debugMode: input.debugMode,
      });
      const stored = await messagesStore.appendMessage(thread.id, {
        senderAccountId: thread.creatorAccountId,
        role: "creator",
        content,
      });
      return stored ? ({ status: "replied", message: stored } as const) : ({ status: "ineligible" } as const);
    });
    // The account lock is already held by another Slurp operation on this creator. Nothing was
    // generated, so the caller may simply try again rather than treat this as a failure.
    if (!locked.acquired) return { status: "busy" };
    if (locked.value.status === "replied") return { status: "replied", message: locked.value.message, pacing };
    return locked.value;
  } catch (error) {
    logger.error(error, "[slurp-message] Reply generation failed for thread %s", thread.id);
    return { status: "failed", error: error instanceof Error ? error.message : "Reply generation failed." };
  } finally {
    await release();
  }
}
