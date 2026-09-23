import { z } from "zod";
import { generateSlurpCommissionImage } from "./slp-commission-image-operation.js";
import { logger } from "../../../../lib/logger.js";
import { reactToSlurpPayment } from "../../economy/slp-economy-contract.js";
import { slurpCommissionDeliveryDelayMs } from "../../../modules/messages/slp-messaging.js";
import { deliverAutomaticSlurpCommission } from "./slp-commission-delivery-service.js";
import { slurpMessageMediaUrl } from "../../../base/media/slp-media.js";
import type { FastifyInstance } from "fastify";
import { personaQuerySchema } from "../../../modules/messages/slp-messages-schemas.js";
import type { SlpMessagesContext } from "../slp-messages-context.js";

const commissionBriefSchema = z.object({
  personaId: z.string().trim().min(1),
  creatorAccountId: z.string().trim().min(1),
  brief: z.string().trim().min(10).max(2000),
});
const commissionQuoteSchema = z.object({
  personaId: z.string().trim().min(1),
  price: z.number().int().min(1).max(99999),
});
const commissionDeliverySchema = z.object({
  personaId: z.string().trim().min(1),
  content: z.string().trim().min(1).max(5000),
  imageUrl: z.null().optional(),
  /** Draw the commissioned piece from the brief instead of attaching one. */
  generateImage: z.boolean().optional(),
});

// Image generation happens before the storage write, so the storage-level delivery queue cannot
// stop two rapid requests from drawing the same commission at once. Hold the whole route per
// commission and make the second request retry after the first one finishes.
const commissionDeliveryRequests = new Set<string>();
const commissionAcceptRequests = new Set<string>();
export async function slpCommissionsRoutes(app: FastifyInstance, messaging: SlpMessagesContext) {
  const { messages, ownsCreator, requireViewer, slurp } = messaging;
  app.post("/messages/commissions", async (req, reply) => {
    const parsed = commissionBriefSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const commission = await messages.createCommission(viewer.id, parsed.data.creatorAccountId, parsed.data.brief);
    if (commission === "open_request")
      return reply.code(409).send({ error: "You already have a commission request open with this Creator." });
    if (!commission) return reply.code(403).send({ error: "This Creator is not accepting commissions." });
    // A commission needs a review step. Character Creators quote from the world tick, while a
    // persona-owned Creator can review and negotiate it here without charging the fan first.
    return { commission };
  });

  app.post("/messages/commissions/:commissionId/quote", async (req, reply) => {
    const parsed = commissionQuoteSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const commission = await messages.getCommission((req.params as { commissionId: string }).commissionId);
    if (!commission) return reply.code(404).send({ error: "Commission not found" });
    if (!(await ownsCreator(parsed.data.personaId, commission.creatorAccountId)))
      return reply.code(403).send({ error: "Creator ownership required" });
    const updated = await messages.quoteCommission(commission.id, parsed.data.price);
    if (!updated) return reply.code(409).send({ error: "This commission is no longer open for a quote." });
    return { commission: updated };
  });

  /** The fan offers a lower price. A character Creator answers at once; a persona Creator answers by hand. */
  app.post("/messages/commissions/:commissionId/counter", async (req, reply) => {
    const parsed = commissionQuoteSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const commission = await messages.getCommission((req.params as { commissionId: string }).commissionId);
    if (!commission || commission.viewerAccountId !== parsed.data.personaId)
      return reply.code(404).send({ error: "Commission not found" });
    const countered = await messages.counterCommission(commission.id, parsed.data.price);
    if (!countered) return reply.code(409).send({ error: "This quote is not open to an offer." });
    const creator = await slurp.getNoodlerAccountById(commission.creatorAccountId);
    if (!creator || creator.sourceKind === "persona") return { commission: countered };
    const pricing = await messages.getCreatorMessaging(commission.creatorAccountId);
    return { commission: (await messages.answerCommissionCounter(commission.id, pricing.commissionMin)) ?? countered };
  });

  app.post("/messages/commissions/:commissionId/accept", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const commission = await messages.getCommission((req.params as { commissionId: string }).commissionId);
    if (!commission || commission.viewerAccountId !== parsed.data.personaId)
      return reply.code(404).send({ error: "Commission not found" });
    if (commission.state !== "quoted") {
      return reply.code(409).send({ error: "This commission is not waiting for payment." });
    }
    if (commissionAcceptRequests.has(commission.id)) {
      return reply.code(409).send({ error: "This commission is already being accepted." });
    }
    commissionAcceptRequests.add(commission.id);
    let drawn: Awaited<ReturnType<typeof generateSlurpCommissionImage>> | null = null;
    try {
      const creator = await slurp.getNoodlerAccountById(commission.creatorAccountId);
      const automatic = Boolean(creator && creator.sourceKind !== "persona");
      // Stage the character Creator's work before taking payment. A missing or failed image
      // connection must leave the quote payable later, not charge the fan for an empty delivery.
      if (automatic) {
        // Drawing is the expensive part, so a fan who cannot pay must not get one drawn and thrown
        // away on every retry. acceptCommission still checks again under the lock.
        if ((await slurp.getSettings()).walletEnabled) {
          const wallet = await slurp.getWallet(commission.viewerAccountId);
          if (wallet.coins < commission.price) return reply.code(402).send({ error: "Not enough coins." });
        }
        try {
          drawn = await generateSlurpCommissionImage(app.db, {
            creatorAccountId: commission.creatorAccountId,
            brief: commission.brief,
          });
        } catch (error) {
          logger.warn(error, "[slurp-commission] Could not draw an automatic commission");
          return reply.code(502).send({ error: "Could not create that commission yet. Try again later." });
        }
        if (drawn === "unavailable") {
          return reply.code(404).send({ error: "No image generation connection is configured." });
        }
      }

      const accepted = await messages.acceptCommission(commission.id);
      if (!accepted || accepted.state !== "accepted") {
        if (drawn && drawn !== "unavailable") drawn.compensate();
        // Only a failed charge is a coins problem. A commission that was already accepted or
        // declined meanwhile is a conflict, and "Not enough coins" there sent fans to top up.
        if (accepted && accepted.state !== "quoted")
          return reply.code(409).send({ error: "This commission was already answered." });
        return reply.code(402).send({ error: "Not enough coins." });
      }
      // The thanks is a full model reply. It runs after the drawing is kept and its delivery
      // scheduled, so a slow reply or a crash in it cannot leave a paid commission with no delivery.
      const thank = () =>
        reactToSlurpPayment(app.db, {
          viewerAccountId: commission.viewerAccountId,
          creatorAccountId: commission.creatorAccountId,
          kind: "commission",
          amount: accepted.price,
        });
      if (!automatic || !drawn || drawn === "unavailable") {
        await thank();
        return { commission: accepted };
      }

      // Keep the drawing. It is finished, it is paid for, and it now has to survive until the
      // delivery is due — which may be after a restart, so the file cannot stay staged.
      drawn.promote();
      const deliverAt = new Date(
        Date.now() + slurpCommissionDeliveryDelayMs({ price: accepted.price, briefLength: commission.brief.length }),
      ).toISOString();
      const scheduled = await messages.scheduleCommissionDelivery(commission.id, {
        deliverAt,
        mediaPath: drawn.mediaPath,
      });
      if (scheduled) {
        await thank();
        return { commission: scheduled };
      }

      // Nothing could be scheduled, so the wait is dropped rather than the delivery. The fan has
      // paid; handing them the piece now is worse pacing but it is not a loss.
      const outcome = await deliverAutomaticSlurpCommission(app.db, accepted, drawn.mediaPath);
      if (outcome.status === "delivered") {
        await thank();
        return { commission: outcome.commission };
      }
      return reply.code(500).send({
        error:
          outcome.status === "refunded"
            ? "Could not deliver that commission. Your payment was refunded."
            : "Could not deliver that commission. It is paid for and still in progress.",
      });
    } finally {
      commissionAcceptRequests.delete(commission.id);
    }
  });

  /** Either side may end an unpaid commission: the Creator declines it, the fan takes it back. */
  app.post("/messages/commissions/:commissionId/decline", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const commission = await messages.getCommission((req.params as { commissionId: string }).commissionId);
    if (!commission) return reply.code(404).send({ error: "Commission not found" });
    const isCreator = await ownsCreator(parsed.data.personaId, commission.creatorAccountId);
    const isViewer = commission.viewerAccountId === parsed.data.personaId;
    if (!isCreator && !isViewer) return reply.code(403).send({ error: "Commission not found" });
    const canCancel =
      commission.state === "brief" ||
      commission.state === "quoted" ||
      (commission.state === "cancellation_pending" && isViewer) ||
      (commission.state === "accepted" &&
        isViewer &&
        (!commission.deliverAt || commission.deliverAt <= new Date().toISOString()));
    if (!canCancel) {
      return reply.code(409).send({ error: "This commission can no longer be called off." });
    }
    return { commission: await messages.declineCommission(commission.id, isCreator ? "creator" : "viewer") };
  });

  app.post("/messages/commissions/:commissionId/deliver", async (req, reply) => {
    const parsed = commissionDeliverySchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const commissionId = (req.params as { commissionId: string }).commissionId;
    const commission = await messages.getCommission(commissionId);
    if (!commission || !(await ownsCreator(parsed.data.personaId, commission.creatorAccountId)))
      return reply.code(404).send({ error: "Commission not found" });
    if (commission.state !== "accepted") {
      return reply.code(409).send({ error: "This commission is not ready for delivery." });
    }
    if (commissionDeliveryRequests.has(commissionId)) {
      return reply.code(409).send({ error: "This commission is already being delivered." });
    }
    commissionDeliveryRequests.add(commissionId);
    try {
      // A commission is somebody paying for a picture, so the delivery can draw it. Generate before
      // the message is written: a failed drawing must not leave a delivered commission with nothing
      // in it, and the fan's coins are already spent.
      let drawn: Awaited<ReturnType<typeof generateSlurpCommissionImage>> | null = null;
      if (parsed.data.generateImage) {
        try {
          drawn = await generateSlurpCommissionImage(app.db, {
            creatorAccountId: commission.creatorAccountId,
            brief: commission.brief,
          });
        } catch (error) {
          logger.warn(error, "[slurp-commission] Could not draw the commissioned piece");
          return reply
            .code(502)
            .send({ error: "Could not draw that commission. Try again, or proceed without a generated image." });
        }
        if (drawn === "unavailable") {
          return reply.code(404).send({ error: "No image generation connection is configured." });
        }
      }
      const delivered = await messages.deliverCommission(
        commission.id,
        parsed.data.content,
        parsed.data.imageUrl ?? null,
      );
      if (!delivered || delivered.state !== "delivered" || !delivered.deliveryMessageId) {
        if (drawn && drawn !== "unavailable") drawn.compensate();
        // This used to answer 200 with a null commission after silently refunding the fan.
        return reply.code(500).send({
          error: delivered
            ? "This commission is no longer ready for delivery."
            : "Could not deliver that commission. The fan's payment was refunded.",
        });
      }
      if (drawn && drawn !== "unavailable") {
        drawn.promote();
        await messages.setMessageMedia(
          delivered.deliveryMessageId,
          slurpMessageMediaUrl(delivered.deliveryMessageId),
          drawn.mediaPath,
          commission.brief,
        );
      }
      return { commission: delivered };
    } finally {
      commissionDeliveryRequests.delete(commissionId);
    }
  });
}
