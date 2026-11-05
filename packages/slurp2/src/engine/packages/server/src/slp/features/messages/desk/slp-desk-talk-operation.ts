/**
 * After a Creator answers Slurp Support (docs/SUPPORT-DESK.md): the talk moves their trust, an Offer
 * waiting in the thread is accepted (and runs), countered or declined, something they let slip becomes
 * intel, and a resolved ticket gets its rating.
 */
import type { DB } from "../../../../db/connection.js";
import { logger } from "../../../../lib/logger.js";
import { newId } from "../../../../utils/id-generator.js";
import { createSlurpMessagesStorage, createSlurpStorage } from "../../../data/slp-storage.js";
import { updateSlurpSupportDesk } from "../../../data/creators/slp-support-desk-storage.js";
import { runSlpAction } from "../../assist/slp-assist-contract.js";
import {
  findPendingSlurpDeskOffer,
  slurpDeskAcceptedInput,
  readSlurpDeskReply,
  slurpDeskOfferOutcome,
  slurpDeskTalkTrust,
} from "../../../modules/messages/slp-support-desk-talk.js";
import {
  slpDeskAdjust,
  slpDeskAsk,
  slpDeskRatingTrust,
  slpDeskSeed,
  slpDeskTier,
} from "../../../../../../shared/src/slp/slp-support-desk.js";
import { slpExtensionOn } from "../../../../../../shared/src/slp/slp-extensions.js";

export async function applySlurpDeskTalk(
  db: DB,
  input: {
    threadId: string;
    creatorAccountId: string;
    /** The Creator's stored reply. */
    replyId: string;
    desk: unknown;
    at?: Date;
  },
): Promise<void> {
  const at = input.at ?? new Date();
  const messages = createSlurpMessagesStorage(db);
  const allSettings = await createSlurpStorage(db).getSettings();
  // Support desk off: Support's talk changes no case file (the prompt asks for no "desk" answer either).
  if (!slpExtensionOn(allSettings, "supportDesk")) return;
  const settings = allSettings.supportDesk;
  const reply = readSlurpDeskReply(input.desk);
  const history = (await messages.listMessages(input.threadId, 40)) as {
    id: string;
    role: string;
    createdAt: string;
    metadata?: Record<string, unknown> | null;
  }[];
  const ordered = [...history].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const pending = findPendingSlurpDeskOffer(ordered.filter((line) => line.id !== input.replyId));
  const outcome = pending ? slurpDeskOfferOutcome(reply, settings.refusals) : null;
  const resolvedTicket = ordered.some(
    (line) => line.metadata?.deskTicketResolved === true && line.metadata?.deskTicketRated !== true,
  );

  // The Offer: record the answer on its message, and run it when they said yes.
  let offerStatus: "accepted" | "countered" | "declined" | "failed" | null = outcome;
  let offerError: string | undefined;
  if (pending && outcome === "accepted") {
    const ran = await runSlpAction(db, pending.offer.action, slurpDeskAcceptedInput(pending.offer)).catch(
      (error: unknown) => ({
        ok: false as const,
        status: 500,
        error: error instanceof Error ? error.message : "The offer could not run.",
      }),
    );
    if (!ran.ok) {
      offerStatus = "failed";
      offerError = ran.error;
    }
  }
  if (pending && offerStatus)
    await messages.mergeMessageMetadata(pending.messageId, {
      deskOffer: {
        ...pending.offer,
        status: offerStatus,
        ...(offerStatus === "countered" && reply?.counter ? { counter: reply.counter } : {}),
        ...(offerError ? { error: offerError } : {}),
      },
    });

  await updateSlurpSupportDesk(db, input.creatorAccountId, (current) => {
    let desk = slpDeskSeed(current, { signedUpBySupport: false, at });
    const talk = reply ? slurpDeskTalkTrust(reply) : 0;
    if (talk)
      desk = slpDeskAdjust(
        desk,
        { trust: talk, text: talk > 0 ? "A good talk with Support" : "A bad talk with Support" },
        settings,
        at,
      );
    if (pending && offerStatus) {
      desk = slpDeskAsk(desk, settings, at);
      if (offerStatus === "accepted")
        desk = slpDeskAdjust(
          desk,
          { trust: 2, text: `Took Slurp's offer: ${pending.offer.summary.slice(0, 120)}` },
          settings,
          at,
        );
      else if (offerStatus === "declined")
        desk = slpDeskAdjust(desk, { text: `Turned down: ${pending.offer.summary.slice(0, 120)}` }, settings, at);
      else if (offerStatus === "countered")
        desk = slpDeskAdjust(
          desk,
          { text: `Asked for something else: ${reply?.counter || "a better offer"}` },
          settings,
          at,
        );
    }
    // Intel only comes from a Creator who trusts Slurp; anything else was the model being chatty.
    if (reply?.intel && (slpDeskTier(desk.trust) === "cooperative" || slpDeskTier(desk.trust) === "partner"))
      desk = {
        ...desk,
        intel: [
          ...desk.intel,
          { id: newId(), text: reply.intel, aboutAccountId: null, at: at.toISOString(), used: false },
        ],
      };
    if (
      resolvedTicket &&
      desk.ticket &&
      desk.ticket.status === "resolved" &&
      desk.ticket.rating === null &&
      reply?.rating
    ) {
      desk = slpDeskAdjust(
        { ...desk, ticket: { ...desk.ticket, rating: reply.rating } },
        { trust: slpDeskRatingTrust(reply.rating), text: `Rated Support ${reply.rating}/5` },
        settings,
        at,
      );
    }
    // The Creator answered: an open ticket is back with Support.
    if (desk.ticket?.status === "waiting") desk = { ...desk, ticket: { ...desk.ticket, status: "open" } };
    return desk;
  });
  if (resolvedTicket)
    for (const line of ordered.filter(
      (entry) => entry.metadata?.deskTicketResolved === true && entry.metadata?.deskTicketRated !== true,
    ))
      await messages
        .mergeMessageMetadata(line.id, { deskTicketRated: true })
        .catch((error: unknown) => logger.warn(error, "[slurp-desk] Could not mark the ticket rating"));
}
