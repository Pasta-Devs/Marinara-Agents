import { z } from "zod";
import { SLURP_DEFAULT_RAPPORT_WEIGHTS } from "../../modules/messages/slp-rapport.js";
import { SLURP_DM_POLICIES } from "../../modules/messages/slp-messaging.js";
import { replyToSlurpMessage } from "./slp-message-operation.js";
import { slurpDynamicPriceTarget } from "../../modules/economy/slp-creator-pricing.js";
import { isDebugAgentsEnabled } from "../../../config/runtime-config.js";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { buildSlurpMessagePrompt } from "./slp-message-generation-service.js";
import { describeSlurpDayVibe } from "../world/slp-world-contract.js";
import type { FastifyInstance } from "fastify";
import { personaQuerySchema } from "../../modules/messages/slp-messages-schemas.js";
import type { SlpMessagesContext } from "./slp-messages-context.js";

/**
 * An image a paid message carries.
 *
 * A same-origin Marinara path only. The message stores the reference rather than downloading the
 * bytes, so accepting a remote URL here would let a Creator point the app at anything and would
 * leak the viewer's IP to it on render.
 */
const creatorMessageSchema = z.object({
  personaId: z.string().trim().min(1),
  viewerAccountId: z.string().trim().min(1),
  content: z.string().trim().min(1).max(4000),
  price: z.number().int().min(0).max(9999).default(0),
  // Attachments are created by the server after the message exists. Client-supplied paths could
  // point at unrelated protected API resources.
  imageUrl: z.null().optional(),
});

const broadcastSchema = creatorMessageSchema.omit({ viewerAccountId: true });

const rapportWeightsSchema = z
  .object(
    Object.fromEntries(
      Object.keys(SLURP_DEFAULT_RAPPORT_WEIGHTS).map((key) => [key, z.number().min(0).max(100)]),
    ) as Record<keyof typeof SLURP_DEFAULT_RAPPORT_WEIGHTS, z.ZodNumber>,
  )
  .partial();

const messagingPatchSchema = z.object({
  personaId: z.string().trim().min(1),
  dmPolicy: z.enum(SLURP_DM_POLICIES as unknown as [string, ...string[]]).optional(),
  requestFee: z.number().int().min(0).max(9999).optional(),
  ppvPrice: z.number().int().min(0).max(9999).optional(),
  rapportWeights: rapportWeightsSchema.optional(),
  proactiveMessages: z.boolean().optional(),
  unlockPrice: z.number().int().min(0).max(9999).nullable().optional(),
  commissionBase: z.number().int().min(1).max(99999).optional(),
  commissionMin: z.number().int().min(1).max(99999).optional(),
  commissionMax: z.number().int().min(1).max(99999).optional(),
  autoQuote: z.boolean().optional(),
});
export async function slpMessagesCreatorRoutes(app: FastifyInstance, messaging: SlpMessagesContext) {
  const { freshView, messages, ownsCreator, population, requireViewer, slurp } = messaging;
  /**
   * Write as the Creator, in your own words.
   *
   * The Creator's side of a conversation was generated and only generated. There was no way to
   * answer a fan yourself, and once Creator-side threads became visible the only composer on
   * screen sent as the viewer — the wrong direction entirely.
   */
  app.post("/messages/creators/:creatorAccountId/reply", async (req, reply) => {
    const parsed = z
      .object({
        personaId: z.string().trim().min(1),
        viewerAccountId: z.string().trim().min(1),
        content: z.string().trim().min(1).max(2000),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    if (!(await ownsCreator(parsed.data.personaId, creatorAccountId))) {
      return reply.code(403).send({ error: "Only the Creator's owner can write as them." });
    }
    const message = await messages.sendCreatorMessage(creatorAccountId, parsed.data.viewerAccountId, {
      content: parsed.data.content,
    });
    if (!message) return reply.code(404).send({ error: "Conversation not found" });
    const thread = await messages.getThread(parsed.data.viewerAccountId, creatorAccountId);
    return { message, thread: thread ? await freshView(thread.id, "creator") : null };
  });

  /**
   * Have the Creator draft their own reply, for the player to send or rewrite.
   *
   * The generator is the fallback here rather than the default: the maintainer wants to write as
   * their Creator, with the model available when they would rather not.
   */
  app.post("/messages/creators/:creatorAccountId/draft-reply", async (req, reply) => {
    const parsed = z
      .object({ personaId: z.string().trim().min(1), threadId: z.string().trim().min(1) })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    if (!(await ownsCreator(parsed.data.personaId, creatorAccountId))) {
      return reply.code(403).send({ error: "Only the Creator's owner can draft as them." });
    }
    const thread = await messages.getThreadById(parsed.data.threadId);
    if (!thread || thread.creatorAccountId !== creatorAccountId) {
      return reply.code(404).send({ error: "Conversation not found" });
    }
    const latest = (await messages.listMessages(thread.id, 1))[0];
    if (!latest) return reply.code(400).send({ error: "Nothing to reply to yet." });
    const outcome = await replyToSlurpMessage(app.db, {
      threadId: thread.id,
      triggerMessageId: latest.id,
      force: true,
    });
    if (outcome.status !== "replied") {
      return reply.code(502).send({ error: "Could not draft a reply.", status: outcome.status });
    }
    return { message: outcome.message, thread: await freshView(thread.id, "creator") };
  });

  app.post("/messages/creators/:creatorAccountId/ppv", async (req, reply) => {
    const parsed = creatorMessageSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    if (!(await ownsCreator(parsed.data.personaId, creatorAccountId)))
      return reply.code(403).send({ error: "Only the Creator's owner can send PPV messages." });
    if (parsed.data.price <= 0) return reply.code(400).send({ error: "A PPV message needs a price." });
    const message = await messages.sendCreatorMessage(creatorAccountId, parsed.data.viewerAccountId, {
      content: parsed.data.content,
      kind: "ppv",
      price: parsed.data.price,
      imageUrl: parsed.data.imageUrl ?? null,
    });
    if (!message) return reply.code(404).send({ error: "Viewer or thread not found" });
    return { message };
  });

  app.post("/messages/creators/:creatorAccountId/broadcast", async (req, reply) => {
    const parsed = broadcastSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    if (!(await ownsCreator(parsed.data.personaId, creatorAccountId)))
      return reply.code(403).send({ error: "Only the Creator's owner can broadcast messages." });
    const subscribers = await slurp.listSubscriptionsForCreator(creatorAccountId);
    const activeSubscribers = [];
    for (const subscription of subscribers) {
      const wallet = await slurp.getWallet(subscription.viewerAccountId);
      if (wallet.subscriptions[creatorAccountId]) activeSubscribers.push(subscription);
    }
    const sent = [];
    for (const subscription of activeSubscribers) {
      const message = await messages.sendCreatorMessage(creatorAccountId, subscription.viewerAccountId, {
        content: parsed.data.content,
        kind: "broadcast",
      });
      if (message) sent.push(message.id);
    }
    return { sent: sent.length };
  });

  app.get("/messages/creators/:creatorAccountId/settings", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    if (!(await slurp.getNoodlerAccountById(creatorAccountId)))
      return reply.code(404).send({ error: "Creator not found" });
    // No ownership gate, for the same reason the weekly price has none: Slurp is single-player and
    // Backstage manages every Creator, world-run ones included. The gate is still enforced on the
    // creator-side conversation routes, where acting *as* a Creator is what must stay restricted.
    if (!(await requireViewer(parsed.data.personaId)))
      return reply.code(404).send({ error: "Slurp persona not found" });
    // The weekly price rides along: it is already public on every profile, and the Creator's own
    // settings panel needs it beside the message prices rather than through a second request.
    const settings = await slurp.getSettings();
    const demand = {
      followers: (await population.countFollowersForCreators([creatorAccountId])).get(creatorAccountId) ?? 0,
      subscribers: (await population.countSubscribersForCreators([creatorAccountId])).get(creatorAccountId) ?? 0,
    };
    return {
      messaging: await messages.getCreatorMessaging(creatorAccountId),
      subscriptionPrice: await slurp.getCreatorSubscriptionPrice(creatorAccountId),
      // What the market would bear at this audience size. Shown beside the fields, never applied.
      suggested: {
        subscriptionPrice: slurpDynamicPriceTarget(settings.walletSubscriptionCost, demand),
        unlockPrice: slurpDynamicPriceTarget(settings.walletUnlockCost, demand),
        commissionBase: slurpDynamicPriceTarget(settings.simulationTuning.economy.audienceCommissionPrice, demand),
      },
    };
  });

  app.patch("/messages/creators/:creatorAccountId/settings", async (req, reply) => {
    const parsed = messagingPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    if (!(await slurp.getNoodlerAccountById(creatorAccountId)))
      return reply.code(404).send({ error: "Creator not found" });
    // See the GET above: every Creator's prices are the player's to set from Backstage.
    if (!(await requireViewer(parsed.data.personaId)))
      return reply.code(404).send({ error: "Slurp persona not found" });
    const { personaId: _personaId, ...patch } = parsed.data;
    return {
      messaging: await messages.setCreatorMessaging(
        creatorAccountId,
        patch as Parameters<typeof messages.setCreatorMessaging>[1],
      ),
    };
  });

  /**
   * Exactly what the creator is about to be shown, and why.
   *
   * The prompt is produced by `buildSlurpMessagePrompt`, which is the same function the reply
   * itself runs. A debug view that rebuilds the prompt separately drifts, and then reports
   * something the model never received — worse than having no debug view.
   *
   * Nothing is generated. This is assembly only, so reading it costs nothing.
   *
   * The text is redacted exactly as the model sees it. There is deliberately no unprotected mode:
   * that would leak a concealed Creator's source identity through the debug door and undo
   * `noodlerConcealedSourceText`.
   */
  app.get("/messages/threads/:threadId/prompt", async (req, reply) => {
    if (!isDebugAgentsEnabled()) return reply.code(404).send({ error: "Not Found", code: "debug_disabled" });
    const parsed = personaQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId } = req.params as { threadId: string };
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const thread = await messages.getThreadById(threadId);
    if (!thread || !(await ownsCreator(viewer.id, thread.creatorAccountId)))
      return reply.code(404).send({ error: "Thread not found" });
    const creator = await slurp.getNoodlerAccountById(thread.creatorAccountId);
    const fan = await slurp.getViewer(thread.viewerAccountId);
    if (!creator || !fan) return reply.code(404).send({ error: "Thread not found" });
    const settings = await slurp.getSettings();
    const connection = await resolveSlurpTextConnection(
      createConnectionsStorage(app.db),
      settings.generationConnectionId,
    );
    if (!connection) return reply.code(409).send({ error: "No text connection is configured." });
    const subscriptions = await slurp.listSubscriptionsForViewer(thread.viewerAccountId);
    const messaging = await messages.getCreatorMessaging(thread.creatorAccountId);
    const built = await buildSlurpMessagePrompt({
      db: app.db,
      creator,
      viewer: fan,
      history: await messages.listMessages(thread.id, 60),
      rapport: thread.rapport,
      subscribed: subscriptions.some((entry) => entry.creatorAccountId === thread.creatorAccountId),
      dmPolicy: messaging.dmPolicy,
      isRequest: thread.state === "request",
      mood: thread.mood,
      moodUpdatedAt: thread.moodUpdatedAt,
      notes: thread.notes,
      threadState: thread.threadState,
      creatorState: await slurp.getCreatorState(thread.creatorAccountId),
      dayVibe: await describeSlurpDayVibe(app.db, thread.creatorAccountId),
      coolingOff: Boolean(thread.coolUntil && thread.coolUntil > new Date().toISOString()),
      strikes: thread.strikes,
      connection,
    });
    return {
      // The layers first. This is the section that answers "why did she say that".
      stance: built.stance,
      thread: {
        mood: thread.mood,
        moodUpdatedAt: thread.moodUpdatedAt,
        coolUntil: thread.coolUntil,
        strikes: thread.strikes,
        threadState: thread.threadState,
        notes: thread.notes,
        rapport: thread.rapport,
        state: thread.state,
      },
      audienceTone: settings.audienceTone,
      prompt: built.messages,
    };
  });

  /**
   * The rapport breakdown for one pair. Read by the creator edit panel only: the score is
   * deliberately absent from the thread UI, so the fiction is not broken by a visible meter.
   */
  app.get("/messages/creators/:creatorAccountId/rapport", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { creatorAccountId } = req.params as { creatorAccountId: string };
    const creator = await slurp.getNoodlerAccountById(creatorAccountId);
    if (!creator) return reply.code(404).send({ error: "Creator not found" });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    if (!(await ownsCreator(parsed.data.personaId, creatorAccountId)))
      return reply.code(403).send({ error: "Only the Creator's owner can read rapport." });
    const messaging = await messages.getCreatorMessaging(creatorAccountId);
    return {
      messaging,
      rapport: await messages.rapportFor(viewer.id, creatorAccountId),
      facts: await messages.rapportFactsFor(viewer.id, creatorAccountId),
    };
  });

  app.post("/messages/threads/:threadId/cancel-follow-up", async (req, reply) => {
    const parsed = z
      .object({
        threadId: z.string().trim().min(1),
        followUpId: z.string().trim().min(1),
        personaId: z.string().trim().min(1),
      })
      .safeParse({ ...req.params, ...req.body });
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request" });

    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });

    const thread = await messages.getThreadById(parsed.data.threadId);
    if (!thread) return reply.code(404).send({ error: "Thread not found" });

    // Only the creator's owner can cancel follow-ups
    if (!(await ownsCreator(parsed.data.personaId, thread.creatorAccountId))) {
      return reply.code(403).send({ error: "Only the Creator's owner can cancel follow-ups." });
    }

    await messages.cancelScheduledFollowUp(parsed.data.threadId, parsed.data.followUpId);
    return { success: true };
  });

  app.get("/messages/creators/:creatorAccountId/follow-up-analytics", async (req, reply) => {
    const parsed = z
      .object({
        creatorAccountId: z.string().trim().min(1),
        personaId: z.string().trim().min(1),
      })
      .safeParse({ ...req.params, ...req.query });
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request" });

    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });

    // Only the creator's owner can view analytics
    if (!(await ownsCreator(parsed.data.personaId, parsed.data.creatorAccountId))) {
      return reply.code(403).send({ error: "Only the Creator's owner can view analytics." });
    }

    const analytics = await messages.getFollowUpAnalytics(parsed.data.creatorAccountId);
    return analytics;
  });
}
