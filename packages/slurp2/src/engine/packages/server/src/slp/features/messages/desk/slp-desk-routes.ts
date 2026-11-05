/**
 * The Slurp Support desk (docs/SUPPORT-DESK.md): the case files for the Stir tab, internal notes,
 * resolving a ticket, and answering an Offer that AI Support sent to a Creator the player runs.
 */
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { logger } from "../../../../lib/logger.js";
import type { SlpMessagesContext } from "../slp-messages-context.js";
import { readSlurpSupportDesk, updateSlurpSupportDesk } from "../../../data/creators/slp-support-desk-storage.js";
import { appendSlurpDeskLine } from "../../../data/messages/slp-support-desk-thread.js";
import { replyToSlurpMessage } from "../slp-message-operation.js";
import { runSlpAction } from "../../assist/slp-assist-contract.js";
import { readSlurpDeskOffer, slurpDeskAcceptedInput } from "../../../modules/messages/slp-support-desk-talk.js";
import { isSlurpViewerActorAccount } from "../../../modules/settings/slp-settings.js";
import { slpDeskAdjust } from "../../../../../../shared/src/slp/slp-support-desk.js";
import { SLURP_SUPPORT_ACCOUNT_ID } from "../../../../../../shared/src/slp/slp-support.js";
import { slpExtensionOn } from "../../../../../../shared/src/slp/slp-extensions.js";

export const SLP_DESK_OFF = "The Support desk is switched off in Backstage.";

const personaBody = z.object({ personaId: z.string().trim().min(1), creatorAccountId: z.string().trim().min(1) });

export async function slpDeskRoutes(app: FastifyInstance, messaging: SlpMessagesContext) {
  const { messages, ownsCreator, requireViewer, slurp } = messaging;
  // ponytail: one process; two tabs answering the same Offer at once get one run. A row claim if multi-process.
  const answering = new Set<string>();
  const deskOff = async () => !slpExtensionOn(await slurp.getSettings(), "supportDesk");

  /** Every Creator the player can write to as Support, with their case file and Support thread. */
  app.get("/slurp/desk", async (req, reply) => {
    if (await deskOff()) return reply.code(409).send({ error: SLP_DESK_OFF });
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const accounts = (await slurp.listNoodlerAccounts()).filter(
      (account) =>
        !isSlurpViewerActorAccount(account) &&
        !(account.sourceKind === "persona" && account.sourceEntityId === viewer.id),
    );
    const threads = new Map(
      (await messages.listThreadsForViewer(SLURP_SUPPORT_ACCOUNT_ID)).map((thread) => [
        thread.creatorAccountId,
        thread,
      ]),
    );
    const cases = await Promise.all(
      accounts.map(async (account) => {
        const thread = threads.get(account.id) ?? null;
        return {
          creator: {
            id: account.id,
            name: account.displayName,
            handle: account.handle,
            avatarUrl: account.avatarUrl ?? null,
          },
          desk: await readSlurpSupportDesk(app.db, account.id),
          thread: thread
            ? {
                id: thread.id,
                unread: thread.viewerUnread,
                lastMessageAt: thread.lastMessageAt,
                lastMessagePreview: thread.lastMessagePreview,
              }
            : null,
        };
      }),
    );
    return { cases, unread: cases.reduce((sum, entry) => sum + (entry.thread?.unread ?? 0), 0) };
  });

  /** An internal note: the player's own line in the thread. Never in a prompt, never seen by the Creator. */
  app.post("/slurp/desk/note", async (req, reply) => {
    if (await deskOff()) return reply.code(409).send({ error: SLP_DESK_OFF });
    const parsed = personaBody
      .extend({ text: z.string().trim().min(1).max(1000) })
      .strict()
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    if (await ownsCreator(viewer.id, parsed.data.creatorAccountId))
      return reply.code(403).send({ error: "Support writes to Creators you do not run." });
    const message = await appendSlurpDeskLine(app.db, parsed.data.creatorAccountId, {
      as: "notice",
      content: parsed.data.text,
      metadata: { deskNotice: false, deskNote: true },
    });
    if (!message) return reply.code(404).send({ error: "Creator not found" });
    return { message };
  });

  /** Support marks the open ticket resolved; the Creator answers and rates it. */
  app.post("/slurp/desk/ticket/resolve", async (req, reply) => {
    if (await deskOff()) return reply.code(409).send({ error: SLP_DESK_OFF });
    const parsed = personaBody.strict().safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    if (await ownsCreator(viewer.id, parsed.data.creatorAccountId))
      return reply.code(403).send({ error: "Support writes to Creators you do not run." });
    const current = await readSlurpSupportDesk(app.db, parsed.data.creatorAccountId);
    if (!current.ticket || current.ticket.status === "resolved")
      return reply.code(409).send({ error: "There is no open ticket." });
    const at = new Date();
    const settings = (await slurp.getSettings()).supportDesk;
    await updateSlurpSupportDesk(app.db, parsed.data.creatorAccountId, (desk) =>
      desk.ticket && desk.ticket.status !== "resolved"
        ? slpDeskAdjust(
            { ...desk, ticket: { ...desk.ticket, status: "resolved", resolvedAt: at.toISOString(), rating: null } },
            { text: `Ticket resolved: ${desk.ticket.topic}` },
            settings,
            at,
          )
        : desk,
    );
    const line = await appendSlurpDeskLine(app.db, parsed.data.creatorAccountId, {
      as: "support",
      content: `Slurp Support marked your ticket "${current.ticket.topic}" as resolved. How did we do?`,
      metadata: { deskTicketResolved: true },
    });
    if (!line) return reply.code(404).send({ error: "Creator not found" });
    const outcome = await replyToSlurpMessage(app.db, { threadId: line.threadId, triggerMessageId: line.id }).catch(
      (error: unknown) => {
        logger.warn(error, "[slurp-desk] The Creator could not answer the resolved ticket");
        return { status: "failed" as const };
      },
    );
    return { message: line, replyStatus: outcome.status };
  });

  /** The player, as a Creator they run, answers an Offer AI Support sent them. */
  app.post("/slurp/desk/offer/answer", async (req, reply) => {
    if (await deskOff()) return reply.code(409).send({ error: SLP_DESK_OFF });
    const parsed = z
      .object({
        personaId: z.string().trim().min(1),
        messageId: z.string().trim().min(1),
        answer: z.enum(["accept", "decline"]),
      })
      .strict()
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const message = await messages.getMessageById(parsed.data.messageId);
    const thread = message ? await messages.getThreadById(message.threadId) : null;
    const offer = message ? readSlurpDeskOffer(message.metadata) : null;
    if (!message || !thread || !offer || thread.viewerAccountId !== SLURP_SUPPORT_ACCOUNT_ID)
      return reply.code(404).send({ error: "Offer not found" });
    if (!(await ownsCreator(viewer.id, thread.creatorAccountId)))
      return reply.code(403).send({ error: "This offer is for someone else's Creator." });
    if (offer.status !== "pending" || answering.has(message.id))
      return reply.code(409).send({ error: "This offer was already answered." });
    answering.add(message.id);
    try {
      let status: "accepted" | "declined" | "failed" = parsed.data.answer === "accept" ? "accepted" : "declined";
      let error: string | undefined;
      if (status === "accepted") {
        const ran = await runSlpAction(app.db, offer.action, slurpDeskAcceptedInput(offer));
        if (!ran.ok) {
          status = "failed";
          error = ran.error;
        }
      }
      await messages.mergeMessageMetadata(message.id, { deskOffer: { ...offer, status, ...(error ? { error } : {}) } });
      await updateSlurpSupportDesk(app.db, thread.creatorAccountId, async (desk) =>
        slpDeskAdjust(
          desk,
          {
            trust: status === "accepted" ? 2 : 0,
            text: `${status === "accepted" ? "Took" : status === "declined" ? "Turned down" : "Could not take"} Slurp's offer: ${offer.summary.slice(0, 120)}`,
          },
          (await slurp.getSettings()).supportDesk,
        ),
      );
      return { status, error: error ?? null };
    } finally {
      answering.delete(message.id);
    }
  });
}
