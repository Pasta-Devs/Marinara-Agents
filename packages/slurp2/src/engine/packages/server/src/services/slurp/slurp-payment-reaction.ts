import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createSlurpMessagesStorage } from "../storage/slurp-messages.storage.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { replyToSlurpMessage } from "./slurp-message.operation.js";

/** What the fan just paid for. The wording the Creator reacts to. */
export type SlurpPaymentReactionKind = "tip" | "unlock" | "ppv" | "commission";

const REACTION_TEXT: Record<SlurpPaymentReactionKind, (amount: number) => string> = {
  tip: (amount) => `[tipped ${amount} coins on your profile]`,
  unlock: (amount) => `[unlocked one of your posts for ${amount} coins]`,
  ppv: (amount) => `[unlocked your locked photo for ${amount} coins]`,
  commission: (amount) => `[paid ${amount} coins for a commission]`,
};

/**
 * Say something back when somebody pays you.
 *
 * A DM tip has always produced an answer. Every other payment produced silence, which read as a
 * vending machine rather than a person. The payment is written into the thread as a viewer event
 * and answered through the normal reply path, so pacing, mood and the schedule still apply.
 *
 * Only automatic (character-backed) Creators react: a persona Creator is operated by hand.
 * Best effort — the payment already succeeded, so a failure here must never surface.
 */
export async function reactToSlurpPayment(
  db: DB,
  input: { viewerAccountId: string; creatorAccountId: string; kind: SlurpPaymentReactionKind; amount: number },
): Promise<void> {
  try {
    const slurp = createSlurpStorage(db);
    const creator = await slurp.getNoodlerAccountById(input.creatorAccountId);
    if (!creator || creator.sourceKind !== "character") return;
    const messages = createSlurpMessagesStorage(db);
    const thread = await messages.getThread(input.viewerAccountId, input.creatorAccountId);
    // No thread means no conversation to react in. Opening one uninvited is a different feature.
    if (!thread || thread.state !== "active") return;
    const event = await messages.appendMessage(thread.id, {
      id: `payment-reaction:${input.kind}:${input.viewerAccountId}:${input.creatorAccountId}:${Date.now()}`,
      senderAccountId: input.viewerAccountId,
      role: "viewer",
      content: REACTION_TEXT[input.kind](input.amount),
      metadata: { paymentReaction: input.kind },
    });
    if (!event) return;
    await replyToSlurpMessage(db, { threadId: thread.id, triggerMessageId: event.id });
  } catch (error) {
    logger.warn(error, "[slurp-payment-reaction] Could not react to a %s payment", input.kind);
  }
}
