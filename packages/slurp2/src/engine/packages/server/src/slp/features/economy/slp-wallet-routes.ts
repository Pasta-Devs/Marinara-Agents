import {
  slpCreatorSubscriptionSchema,
  slpCreatorUnlockSchema,
} from "../../../../../shared/src/slp/slp-social.schema.js";
import { type SlpCreatorSubscriber } from "../../../../../shared/src/slp/slp-social.types.js";
import { z } from "zod";
import { slurpDayKey, SLURP_DEV_CHEAT_MAX_COINS } from "../../modules/economy/slp-wallet.js";
import {
  claimSlurpPaymentIntentForDatabase,
  applySlurpTipEffectsForDatabase,
  compensateSlurpPaymentForDatabase,
  resetSlurpPaymentIntentForDatabase,
  settleSlurpPaymentIntentForDatabase,
} from "../../data/messages/slp-messages-storage-context.js";
import { reactToSlurpPayment } from "./slp-payment-reaction.js";
import { slurpPayoutAllowance } from "../../modules/economy/slp-earnings.js";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";
import { SLURP_NAMED_CAST_LIMIT } from "../../../../../shared/src/slp/slp-population.js";
import { slpCreatorUnlockPriceFromMetadata } from "../../modules/economy/slp-prices.js";
import type { FastifyInstance } from "fastify";
import { slpCreatorPageCursorSchema, SLP_CREATOR_FEED_PAGE_SIZE } from "../../modules/requests/slp-request-schemas.js";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";

/**
 * A subscriber row, widened for the generated audience.
 *
 * `SlpCreatorSubscriber` lives in the Engine's shared package and describes an account-backed viewer.
 * The audience has no account, so the extra fields are added here rather than in the Engine — a
 * package must not need an Engine change to show its own data.
 */
type SlurpSubscriberRow = SlpCreatorSubscriber & {
  /** True for somebody from the generated population, who has no profile to open. */
  audience?: boolean;
  stage?: string;
  spent?: number;
};

const slpCreatorSubscriberPageQuerySchema = slpCreatorPageCursorSchema.and(
  z.object({
    limit: z.coerce.number().int().min(1).max(SLP_CREATOR_FEED_PAGE_SIZE).default(SLP_CREATOR_FEED_PAGE_SIZE),
  }),
);
export async function slpWalletRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { buildViewerContext, buildViewerShell, characters, creatorBelongsToViewer, noodle, resolveViewerPersona } =
    deps;
  /**
   * One viewer's wallet: balance, recent ledger, and paid-through dates. Reading it is what pays
   * the daily stipend and charges due renewals, so the wallet page is also the economy's clock.
   */
  app.get("/slurp/viewer/wallet", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const [wallet, settings] = await Promise.all([noodle.getWallet(viewer.id), noodle.getSettings()]);
    // The same day boundary the refill itself uses. This duplicated the UTC date and would have
    // drifted from the configured start hour.
    const now = new Date();
    const today = slurpDayKey(now, settings.walletDayStartHour);
    const nextRefillAt = new Date(now);
    nextRefillAt.setHours(settings.walletDayStartHour, 0, 0, 0);
    if (nextRefillAt.getTime() <= now.getTime()) nextRefillAt.setDate(nextRefillAt.getDate() + 1);
    return {
      ...wallet,
      cheatsEnabled: process.env.NODE_ENV === "development" && process.env.CHEATS_ENABLED === "true",
      refillFloor: settings.walletStipendFloor,
      nextRefillAt: nextRefillAt.toISOString(),
      refillAvailable:
        settings.walletEnabled && wallet.stipendOn !== today && wallet.coins < settings.walletStipendFloor,
    };
  });

  app.post("/slurp/viewer/wallet/daily-refill", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    return noodle.claimWalletRefill(viewer.id);
  });

  app.post("/slurp/viewer/wallet/dev-set", async (req, reply) => {
    if (process.env.NODE_ENV !== "development" || process.env.CHEATS_ENABLED !== "true")
      return reply.code(404).send({ error: "Not found" });
    const parsed = z
      .object({ personaId: z.string().trim().min(1), coins: z.number().int().min(0).max(SLURP_DEV_CHEAT_MAX_COINS) })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    return noodle.setWalletCoinsForDevelopment(viewer.id, parsed.data.coins);
  });

  app.post("/slurp/accounts/:id/tip", async (req, reply) => {
    const parsed = z
      .object({
        personaId: z.string().trim().min(1),
        amount: z.number().int().min(1).max(9999),
        requestId: z.string().trim().min(8).max(100).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const tipOperationId = `profile-tip:${parsed.data.requestId ?? req.id}`;
    const creatorAccountId = (req.params as { id: string }).id;
    const settings = await noodle.getSettings();
    if (settings.walletEnabled) {
      const paymentIntent = await claimSlurpPaymentIntentForDatabase(
        app.db,
        {
          viewerAccountId: viewer.id,
          creatorAccountId,
          price: parsed.data.amount,
          note: "profile tip",
          creditOperationId: tipOperationId,
        },
        tipOperationId,
      );
      if (paymentIntent === "settled") {
        await applySlurpTipEffectsForDatabase(app.db, tipOperationId).catch((error) =>
          app.log.error({ err: error }, "[slurp] profile tip effects failed"),
        );
        return noodle.getWallet(viewer.id);
      }
      if (paymentIntent !== "claimed") return reply.code(409).send({ error: "Tip payment is still processing." });
    }
    let wallet;
    try {
      wallet = await noodle.tipCreator(viewer.id, creatorAccountId, parsed.data.amount, tipOperationId);
    } catch (error) {
      if (settings.walletEnabled && (await noodle.hasWalletSpendOperation(viewer.id, tipOperationId))) {
        await compensateSlurpPaymentForDatabase(
          app.db,
          {
            viewerAccountId: viewer.id,
            creatorAccountId,
            price: parsed.data.amount,
            note: "failed profile tip",
            creditOperationId: tipOperationId,
          },
          error,
          tipOperationId,
        );
      } else if (settings.walletEnabled) {
        await resetSlurpPaymentIntentForDatabase(app.db, tipOperationId);
      }
      throw error;
    }
    if (!wallet) {
      if (settings.walletEnabled) await resetSlurpPaymentIntentForDatabase(app.db, tipOperationId);
      return reply.code(402).send({ error: "Unable to send tip" });
    }
    if (settings.walletEnabled)
      await settleSlurpPaymentIntentForDatabase(app.db, tipOperationId, creatorAccountId, tipOperationId);
    if (settings.walletEnabled)
      await applySlurpTipEffectsForDatabase(app.db, tipOperationId).catch((error) =>
        app.log.error({ err: error }, "[slurp] profile tip effects failed"),
      );
    await reactToSlurpPayment(app.db, {
      viewerAccountId: viewer.id,
      creatorAccountId,
      kind: "tip",
      amount: parsed.data.amount,
    });
    return wallet;
  });

  /** A creator's own weekly price. `null` clears it back to the Slurp-wide default. */
  app.put("/slurp/accounts/:id/subscription-price", async (req, reply) => {
    const parsed = z
      .object({ personaId: z.string().trim().min(1), price: z.number().int().min(0).max(9999).nullable() })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const { id } = req.params as { id: string };
    const creator = await noodle.getNoodlerAccountById(id);
    if (!creator) return reply.code(404).send({ error: "Stage profile not found" });
    // The price other personas pay to subscribe. Single-player, so no ownership gate: the one
    // player manages every Creator.
    await noodle.setCreatorSubscriptionPrice(id, parsed.data.price);
    return { price: await noodle.getCreatorSubscriptionPrice(id) };
  });

  app.get("/slurp/viewer-wallets", async (_req, reply) => {
    const personas = await characters.listPersonas();
    return noodle.listViewerWallets(personas.map((persona) => persona.id));
  });

  /**
   * Withdraw earnings into spending money.
   *
   * The circuit only closes here: without a payout, earnings are a scoreboard attached to nothing
   * and being a successful Creator does not change your life as a fan.
   */
  app.post("/slurp/accounts/:id/payout", async (req, reply) => {
    const parsed = z
      .object({ personaId: z.string().trim().min(1), amount: z.number().int().min(1).max(100_000) })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const { id } = req.params as { id: string };
    const creator = await noodle.getNoodlerAccountById(id);
    if (!creator) return reply.code(404).send({ error: "Creator account not found" });
    const result = await noodle.payOutEarnings(creator.id, parsed.data.amount);
    if (result.status !== "paid") {
      const earnings = await noodle.getEarnings(creator.id);
      return reply.code(400).send({
        error: "That is more than today's payout allows.",
        allowance: slurpPayoutAllowance(earnings, new Date()),
      });
    }
    return {
      earnings: result.earnings,
      allowance: slurpPayoutAllowance(result.earnings, new Date()),
      wallet: result.wallet,
    };
  });

  app.post("/slurp/accounts/:id/subscribe", async (req, reply) => {
    const parsed = slpCreatorSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const [viewer, creator] = await Promise.all([
      resolveViewerPersona(parsed.data.personaId),
      noodle.getNoodlerAccountById(id),
    ]);
    if (!viewer || !creator || creatorBelongsToViewer(creator, viewer)) {
      return reply.code(404).send({ error: "Slurp stage profile not found" });
    }
    const subscription = await noodle.subscribe(viewer.id, creator.id);
    if (!subscription) {
      const [wallet, price] = await Promise.all([
        noodle.getWallet(viewer.id),
        noodle.getCreatorSubscriptionPrice(creator.id),
      ]);
      if (wallet.coins < price) return reply.code(402).send({ error: "Not enough coins", price, coins: wallet.coins });
      return reply.code(400).send({ error: "Could not subscribe to this stage profile" });
    }
    const freshViewer = await resolveViewerPersona(parsed.data.personaId);
    return reply.code(201).send(buildViewerShell(await buildViewerContext(freshViewer ?? viewer)));
  });

  app.delete("/slurp/accounts/:id/subscribe", async (req, reply) => {
    const parsed = slpCreatorSubscriptionSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const { id } = req.params as { id: string };
    await noodle.unsubscribe(viewer.id, id);
    const freshViewer = await resolveViewerPersona(parsed.data.personaId);
    return buildViewerShell(await buildViewerContext(freshViewer ?? viewer));
  });

  app.get("/slurp/accounts/:id/subscribers", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = slpCreatorSubscriberPageQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await noodle.getNoodlerAccountById(id))) {
      return reply.code(404).send({ error: "Slurp stage profile not found" });
    }
    const page = await noodle.listSubscriptionsForCreatorPage(
      id,
      parsed.data.cursorAt && parsed.data.cursorId
        ? { createdAt: parsed.data.cursorAt, id: parsed.data.cursorId }
        : null,
      parsed.data.limit,
    );
    const population = createSlurpPopulationStorage(app.db);
    const subscribers = (
      await Promise.all(
        page.items.map(async (subscription): Promise<SlurpSubscriberRow | null> => {
          const account =
            (await noodle.getSlurpAccountForEntity("persona", subscription.viewerAccountId, "viewer")) ??
            (await noodle.getViewer(subscription.viewerAccountId));
          // A subscriber with no account row is somebody from the generated audience. Dropping
          // them here is why an audience subscription could never be seen: the row existed and the
          // list threw it away.
          const member = account ? null : await population.get(subscription.viewerAccountId).catch(() => null);
          if (!account && !member) return null;
          return {
            id: account?.id ?? member!.id,
            displayName: account?.displayName ?? member!.displayName,
            handle: account?.handle ?? member!.handle,
            avatarUrl: account?.avatarUrl ?? null,
            avatarCrop: account?.avatarCrop ?? null,
            subscribedAt: subscription.createdAt,
            ...(member ? { audience: true } : {}),
          };
        }),
      )
    ).filter((subscriber): subscriber is SlurpSubscriberRow => subscriber !== null);

    // The audience pays through the funnel rather than through a subscription row, because an
    // audience member is not a viewer and holds no wallet. They are named on the first page only:
    // the named cast is capped at thirty by design, and everybody below it stays a number.
    const named =
      parsed.data.cursorAt || parsed.data.cursorId
        ? []
        : // Drawn wider than the cast limit and cut after filtering: the cast is ranked by spend,
          // and cutting to thirty before the filter would hide subscribers behind free likers.
          (await population.listNamedCast(id, SLURP_NAMED_CAST_LIMIT * 3))
            .filter((entry) => entry.tie.stage === "subscriber" || entry.tie.paidThroughAt)
            .slice(0, SLURP_NAMED_CAST_LIMIT)
            .map((entry): SlurpSubscriberRow => ({
              id: entry.tie.memberId,
              displayName: entry.member.displayName,
              handle: entry.member.handle,
              avatarUrl: null,
              avatarCrop: null,
              subscribedAt: entry.tie.firstSeenAt,
              audience: true,
              stage: entry.tie.stage,
              spent: entry.tie.spent,
            }));
    const audienceTotal = (await population.countSubscribersForCreators([id])).get(id) ?? 0;
    return {
      items: [...named, ...subscribers],
      total: page.total + audienceTotal,
      nextCursor: page.nextCursor,
    };
  });

  app.post("/slurp/posts/:id/unlock", async (req, reply) => {
    const parsed = slpCreatorUnlockSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const [viewer, post] = await Promise.all([
      resolveViewerPersona(parsed.data.personaId),
      noodle.getNoodlerPostById(id),
    ]);
    const creator = post ? await noodle.getNoodlerAccountById(post.authorAccountId) : null;
    if (!viewer || !post || !creator || post.access !== "locked" || creatorBelongsToViewer(creator, viewer)) {
      return reply.code(404).send({ error: "Slurp post not found" });
    }
    const unlock = await noodle.unlockPost(viewer.id, post.id);
    // An affordable post that still fails is a different problem from an unaffordable one, so
    // the client can tell "top up" apart from "this post is gone".
    if (!unlock) {
      const wallet = await noodle.getWallet(viewer.id);
      const price = slpCreatorUnlockPriceFromMetadata(post.metadata);
      if (wallet.coins < price) return reply.code(402).send({ error: "Not enough coins", price, coins: wallet.coins });
      return reply.code(400).send({ error: "Could not unlock this post" });
    }
    await reactToSlurpPayment(app.db, {
      viewerAccountId: viewer.id,
      creatorAccountId: creator.id,
      kind: "unlock",
      amount: slpCreatorUnlockPriceFromMetadata(post.metadata),
    });
    return reply.code(201).send(buildViewerShell(await buildViewerContext(viewer)));
  });
}
