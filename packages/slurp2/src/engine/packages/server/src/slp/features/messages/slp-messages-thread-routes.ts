import { z } from "zod";
import { logger } from "../../../lib/logger.js";
import { type SlurpCommissionPricing, slurpCommissionQuote } from "../../modules/economy/slp-creator-pricing.js";
import { selectSlurpAttentionCommissions } from "./slp-inbox-attention.js";
import { activeSlurpStrikes, slurpDmPictureVerdict } from "../../modules/world/slp-stance.js";
import { slurpAdultRiseBlock, slurpCreatorStateMediaBlock } from "../../modules/creators/slp-creator-state.js";
import { isSlurpSupportThread } from "../../modules/messages/slp-support.js";
import { resolveSlurpThreadStance } from "./slp-thread-stance.js";
import { describeSlurpDayVibe } from "../world/slp-world-contract.js";
import { readSlurpAudienceTone } from "../../../../../shared/src/slp/slp-tone.js";
import { isSlurpViewerActorAccount } from "../../modules/settings/slp-settings.js";
import {
  SLURP_NOTE_MAX_LENGTH,
  SLURP_WORKING_NOTE_LIMIT,
  SLURP_LONGTERM_NOTE_LIMIT,
} from "../../modules/messages/slp-thread-notes.js";
import type { FastifyInstance } from "fastify";
import { SLURP_SUPPORT_ACCOUNT_ID } from "../../../../../shared/src/slp/slp-support.js";
import { SLURP_SUPPORT_NAME } from "../../modules/messages/slp-dm-roles.js";
import { personaQuerySchema } from "../../modules/messages/slp-messages-schemas.js";
import { slurpIsCouplePage } from "../../modules/projects/slp-creator-couples.js";
import { readSlurpPlayerCoupleView } from "../projects/slp-projects-contract.js";
import type { SlpMessagesContext } from "./slp-messages-context.js";
import { readSlurpSupportDesk } from "../../data/creators/slp-support-desk-storage.js";
import { reconcileSlpThreadScene } from "./scenes/slp-roleplay-scene-origin.js";
import { slpScenesAvailable } from "../../base/host/slp-scene-host.js";

const messagePageSchema = personaQuerySchema.extend({
  cursorAt: z.string().datetime().optional(),
  cursorId: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(120).default(120),
  search: z.string().trim().max(200).optional(),
});

/** The quote each open brief would get from the Creator's own pricing, for the quote form. */
const withSuggestedQuotes = <T extends { brief: string }>(commissions: T[], pricing: SlurpCommissionPricing) =>
  commissions.map((commission) => ({ ...commission, suggestedPrice: slurpCommissionQuote(commission.brief, pricing) }));
export async function slpMessagesThreadRoutes(app: FastifyInstance, messaging: SlpMessagesContext) {
  const {
    creatorPresence,
    freshView,
    maskForViewer,
    messages,
    ownsCreator,
    population,
    requireViewer,
    seatIn,
    slurp,
    visibleMessages,
  } = messaging;
  type Thread = NonNullable<Awaited<ReturnType<typeof messages.getThreadById>>>;
  type Creator = NonNullable<Awaited<ReturnType<typeof slurp.getNoodlerAccountById>>>;

  /**
   * What the Details panel shows, for the thread route and the compose route alike. "Pictures" and
   * "blocked by" are the server's verdicts, read off the stance the reply itself is written from,
   * not a second copy of its thresholds on the client (R1-012).
   */
  const relationshipFor = async (
    thread: Thread,
    creator: Creator,
    side: "viewer" | "creator",
    availability: Awaited<ReturnType<typeof creatorPresence>>["creatorAvailability"],
  ) => {
    // Slurp Support is not a fan: no rapport, mood, strikes, pictures or fees. Its Details panel
    // shows where the Creator stands with Slurp (docs/SUPPORT-DESK.md).
    if (isSlurpSupportThread(thread))
      return {
        side,
        desk: await readSlurpSupportDesk(app.db, thread.creatorAccountId),
        availability,
        notes: thread.notes,
        coolUntil: null,
        scheduledFollowUps: thread.scheduledFollowUps,
      };
    const details = await messages.getDetailsOverrides(thread.id);
    const settings = await slurp.getSettings();
    const dayVibe =
      details.dayVibe !== undefined ? details.dayVibe : await describeSlurpDayVibe(app.db, thread.creatorAccountId);
    const creatorState = await slurp.getCreatorState(thread.creatorAccountId);
    const strikes = activeSlurpStrikes(thread.strikes, thread.lastStrikeAt);
    const stance = await resolveSlurpThreadStance(app.db, {
      creator,
      viewerId: thread.viewerAccountId,
      rapport: thread.rapport,
      mood: thread.mood,
      moodUpdatedAt: thread.moodUpdatedAt,
      dayVibe,
      availability,
      subscribed: (await slurp.listSubscriptionsForViewer(thread.viewerAccountId)).some(
        (entry: { creatorAccountId: string }) => entry.creatorAccountId === thread.creatorAccountId,
      ),
      isRequest: thread.state === "request",
      coolingOff: Boolean(thread.coolUntil && thread.coolUntil > new Date().toISOString()),
      strikes,
      details,
      settings,
    });
    return {
      side,
      tier: thread.rapport.tier,
      score: thread.rapport.score,
      contributions: thread.rapport.contributions,
      mood: thread.mood,
      strikes,
      notes: thread.notes,
      spentCoins: await messages.spentWithCreator(thread.viewerAccountId, thread.creatorAccountId),
      coolUntil: thread.coolUntil,
      dayVibe,
      availability,
      audienceTone: details.audienceTone ?? readSlurpAudienceTone(settings.audienceTone),
      imageMode: stance.imageMode,
      pictures: slurpDmPictureVerdict({
        stance,
        support: isSlurpSupportThread(thread),
        imagesEnabled: creator.settings.scheduler.autoPosting?.imagesEnabled === true,
        stateBlock: slurpCreatorStateMediaBlock(creatorState, thread.threadState),
      }),
      escalation: { blockedBy: slurpAdultRiseBlock(thread.threadState) },
      creatorState,
      threadState: thread.threadState,
      // The same list on both routes, so a chat opened from a profile lists its follow-ups (R1-008).
      scheduledFollowUps: thread.scheduledFollowUps,
      // The player's own side: her and the player's page as a couple (Details › You two), or null.
      couple:
        side === "viewer"
          ? await readSlurpPlayerCoupleView(app.db, thread.creatorAccountId, thread.viewerAccountId)
          : null,
    };
  };
  app.get("/messages/unread-count", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const accounts = await slurp.listNoodlerAccounts();
    const operatedCreatorAccountIds = accounts
      .filter((account) => account.sourceKind === "persona" && account.sourceEntityId === viewer.id)
      .map((account) => account.id);
    const own = await messages.countUnread(
      viewer.id,
      operatedCreatorAccountIds,
      accounts.map((account) => account.id),
    );
    // Slurp Support's threads live on the Stir desk, not in the inbox (docs/SUPPORT-DESK.md): their
    // unread is counted apart, for the desk and the inbox's one link row.
    const support = await messages.countUnread(
      SLURP_SUPPORT_ACCOUNT_ID,
      [],
      accounts.filter((account) => !operatedCreatorAccountIds.includes(account.id)).map((account) => account.id),
    );
    return { ...own, deskUnread: support.unread };
  });
  app.get("/messages/threads", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    // Slurp Support's threads are the player's from every persona (`slp-support.ts`), but they live on
    // the Stir desk (docs/SUPPORT-DESK.md); the inbox gets one link row with their count. With a
    // Creator this persona runs, Support is someone writing to them: that stays in the inbound list.
    const accounts = await slurp.listNoodlerAccounts();
    const operatedIds = new Set(
      accounts
        .filter((account) => account.sourceKind === "persona" && account.sourceEntityId === viewer.id)
        .map((account) => account.id),
    );
    const threads = (await messages.listThreadsForViewer(viewer.id)).sort((left, right) =>
      right.lastMessageAt.localeCompare(left.lastMessageAt),
    );
    const deskThreads = (await messages.listThreadsForViewer(SLURP_SUPPORT_ACCOUNT_ID)).filter(
      (thread) => !operatedIds.has(thread.creatorAccountId),
    );
    // Threads written *to* the Creators this persona operates. Without these the inbox showed only
    // conversations the player started, and anything a fan or the world opened was unreachable.
    const operated = [...operatedIds];
    const inbound = await messages.listThreadsForCreators(operated);
    // The counterpart is the fan here, not the Creator, so name them or the row is a blank. Looked up
    // once per fan: this list polls every 30 s and used to make five lookups per thread.
    const accountById = new Map(accounts.map((account) => [account.id, account]));
    const counterparts = new Map<string, Promise<{ name: string | null; handle: string | null }>>();
    const counterpartOf = (id: string) => {
      let found = counterparts.get(id);
      if (!found) {
        found = (async () => {
          const fan = await population.get(id);
          const account = accountById.get(id) ?? (await slurp.getNoodlerAccountById(id));
          const name =
            (id === SLURP_SUPPORT_ACCOUNT_ID ? SLURP_SUPPORT_NAME : null) ??
            fan?.displayName ??
            account?.displayName ??
            (await slurp.getViewer(id).catch(() => null))?.displayName ??
            null;
          return { name, handle: fan?.handle ?? account?.handle ?? null };
        })();
        counterparts.set(id, found);
      }
      return found;
    };
    const inboundViews = await Promise.all(
      inbound.map(async (thread) => {
        const counterpart = await counterpartOf(thread.viewerAccountId);
        return {
          ...thread,
          side: "creator" as const,
          counterpartName: counterpart.name,
          counterpartHandle: counterpart.handle,
        };
      }),
    );
    const [viewerCommissionLists, creatorCommissionLists] = await Promise.all([
      Promise.all(threads.map((thread) => messages.listCommissionsForThread(thread.id))),
      Promise.all(operated.map((creatorAccountId) => messages.listOpenCommissionsForCreator(creatorAccountId))),
    ]);
    const attentionCommissions = selectSlurpAttentionCommissions({
      viewerThreadIds: new Set(threads.map((thread) => thread.id)),
      operatedCreatorIds: new Set(operated),
      viewerCommissions: viewerCommissionLists.flat(),
      creatorCommissions: creatorCommissionLists.flat(),
    });
    return {
      threads: threads
        .filter((thread) => thread.state !== "declined")
        .map((thread) => ({ ...thread, side: "viewer" as const })),
      inbound: inboundViews.filter((thread) => thread.state !== "declined"),
      // Counted over the threads the list shows, like the nav badge: a closed thread is hidden, so
      // its unread never cleared (R1-007).
      unread: threads
        .filter((thread) => thread.state !== "declined")
        .reduce((sum, thread) => sum + thread.viewerUnread, 0),
      // Unread on the Creator side is what the player owes an answer to.
      inboundUnread: inboundViews
        .filter((thread) => thread.state !== "declined")
        .reduce((sum, thread) => sum + thread.creatorUnread, 0),
      attentionCommissions,
      desk: {
        threads: deskThreads.length,
        unread: deskThreads.reduce((sum, thread) => sum + thread.viewerUnread, 0),
        lastMessageAt: deskThreads.reduce<string | null>(
          (latest, thread) => (!latest || thread.lastMessageAt > latest ? thread.lastMessageAt : latest),
          null,
        ),
      },
    };
  });

  app.get("/messages/threads/:threadId", async (req, reply) => {
    const parsed = messagePageSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (Boolean(parsed.data.cursorAt) !== Boolean(parsed.data.cursorId)) {
      return reply.code(400).send({ error: "cursorAt and cursorId must be provided together" });
    }
    const { threadId } = req.params as { threadId: string };
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const thread = await messages.getThreadById(threadId);
    // Scoped to the requesting persona: a thread id must never be enough to read someone
    // else's inbox, even on a single-user install. Slurp Support's threads are every persona's.
    const side = thread ? await seatIn(viewer.id, thread) : null;
    if (!thread || !side) return reply.code(404).send({ error: "Thread not found" });
    // A scene that ended while Slurp could not hear it: settle the lock and bring the recap in.
    if (thread.sceneChatId)
      await reconcileSlpThreadScene(app.db, thread).catch((error) => {
        logger.warn({ err: error, threadId: thread.id }, "[slurp-message] Could not reconcile the scene");
      });
    await messages.markRead(thread.id, side);
    const creator = await slurp.getNoodlerAccountById(thread.creatorAccountId);
    if (!creator) return reply.code(404).send({ error: "Creator not found" });
    const presence = await creatorPresence(creator, thread.id);
    const counterpart =
      side === "creator"
        ? ((await population.get(thread.viewerAccountId)) ??
          (await slurp.getNoodlerAccountById(thread.viewerAccountId)) ??
          (await slurp.getViewer(thread.viewerAccountId).catch(() => null)))
        : creator;
    // When the creator last posted, so the thread header can show the same online/away/offline
    // status the profile header does. The status rule is derived from posting activity, and the
    // thread view had no way to see it, which is why it showed nothing.
    const page = await messages.listMessagePage(
      thread.id,
      parsed.data.limit,
      parsed.data.cursorAt && parsed.data.cursorId
        ? { createdAt: parsed.data.cursorAt, id: parsed.data.cursorId }
        : null,
      parsed.data.search,
    );
    return {
      thread: await freshView(thread.id, side),
      messages: side === "viewer" ? page.messages.map(maskForViewer) : page.messages,
      nextCursor: page.nextCursor,
      creator,
      counterpart,
      ...presence,
      messaging: await messages.getCreatorMessaging(thread.creatorAccountId),
      commissions: withSuggestedQuotes(
        await messages.listCommissionsForThread(thread.id),
        await messages.getCreatorMessaging(thread.creatorAccountId),
      ),
      relationship: await relationshipFor(thread, creator, side, presence.creatorAvailability),
      // Roleplay scenes (docs/SCENES.md): the player's own thread with an Engine character's page.
      scenes:
        slpScenesAvailable() && side === "viewer" && creator.sourceKind === "character" && thread.state === "active",
    };
  });

  app.get("/messages/compose-targets", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    await slurp.ensureAudienceCharacterAccounts().catch(() => undefined);
    const accounts = await slurp.listNoodlerAccounts();
    // A shared couple page is not someone to write to: the two partners are listed on their own.
    const couplePages = new Set(accounts.filter(slurpIsCouplePage).map((account: { id: string }) => account.id));
    const profiles = (await slurp.listNoodlerStageProfiles()).filter(
      (profile: { id: string }) => !couplePages.has(profile.id),
    );
    const operatedAccounts = accounts.filter(
      (account) => account.sourceKind === "persona" && account.sourceEntityId === viewer.id,
    );
    const creatorAccount = operatedAccounts.find((account) => !isSlurpViewerActorAccount(account));
    const inbound = creatorAccount ? await messages.listThreadsForCreators([creatorAccount.id]) : [];
    const inboundByViewer = new Map(inbound.map((thread) => [thread.viewerAccountId, thread]));
    const characterTargets = creatorAccount ? await slurp.listAudienceCharacterAccounts() : [];
    return {
      targets: [
        ...profiles.map((profile) => ({
          id: profile.id,
          kind: "creator" as const,
          displayName: profile.displayName,
          handle: profile.handle,
          avatarUrl: profile.avatarUrl,
          threadId: null,
          creatorAccountId: null,
        })),
        ...characterTargets.map(({ account }) => ({
          id: account.id,
          kind: "character" as const,
          displayName: account.displayName,
          handle: account.handle,
          avatarUrl: account.avatarUrl,
          threadId: inboundByViewer.get(account.id)?.id ?? null,
          creatorAccountId: creatorAccount.id,
        })),
      ],
    };
  });

  app.post("/messages/compose", async (req, reply) => {
    const parsed = z
      .object({
        personaId: z.string().trim().min(1),
        creatorAccountId: z.string().trim().min(1),
        viewerAccountId: z.string().trim().min(1),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await ownsCreator(parsed.data.personaId, parsed.data.creatorAccountId))) {
      return reply.code(403).send({ error: "Only the Creator's owner can open this conversation." });
    }
    const target = await slurp.getNoodlerAccountById(parsed.data.viewerAccountId, { includeHidden: true });
    if (!target) return reply.code(404).send({ error: "Audience member not found" });
    const opened = await messages.openThread(parsed.data.viewerAccountId, parsed.data.creatorAccountId, "creator");
    if (opened.status !== "ok") return reply.code(404).send({ error: "Could not open conversation" });
    return { thread: await freshView(opened.thread.id, "creator") };
  });

  /**
   * Empty this conversation and start it over.
   *
   * Scoped exactly like reading the thread: either side of this pair may do it, a thread id alone
   * may not. Destructive and deliberate, so it is its own endpoint rather than a flag on send.
   */
  app.post("/messages/threads/:threadId/reset", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId } = req.params as { threadId: string };
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const thread = await messages.getThreadById(threadId);
    const side = thread ? await seatIn(viewer.id, thread) : null;
    if (!thread || !side) return reply.code(404).send({ error: "Thread not found" });
    if (thread.sceneChatId && (await reconcileSlpThreadScene(app.db, thread)))
      return reply.code(409).send({ error: "You are in a scene together. End it first." });
    await messages.resetThread(thread.id);
    // Empty, but read back through the masking helper all the same: every route that returns a
    // thread's messages goes through one door.
    return { thread: await freshView(thread.id, side), messages: await visibleMessages(thread.id, side) };
  });

  /**
   * Rewrite what the creator remembers about this fan.
   *
   * Scoped exactly like reading and clearing the thread: either side of this pair may do it. The
   * fan is allowed in because the memories are already shown to them in the conversation panel,
   * and a memory the player can read but never correct is worse than none — a creator who has
   * misremembered your job keeps saying it forever.
   *
   * The body is the whole list rather than a patch. It is short, capped, and read back through
   * the same normalizer the model's own writes use, so there is one shape of stored memory.
   */
  app.put("/messages/threads/:threadId/notes", async (req, reply) => {
    const parsed = z
      .object({
        personaId: z.string().min(1),
        notes: z
          .array(
            z.object({
              id: z.string().trim().max(32).optional(),
              text: z.string().trim().min(1).max(SLURP_NOTE_MAX_LENGTH),
              tier: z.enum(["working", "longterm"]),
            }),
          )
          .max(SLURP_WORKING_NOTE_LIMIT + SLURP_LONGTERM_NOTE_LIMIT),
        /** The note ids the editor was showing. Anything else was written since, and stays. */
        baseNoteIds: z.array(z.string().max(32)).max(64).optional(),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId } = req.params as { threadId: string };
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const thread = await messages.getThreadById(threadId);
    if (!thread || !(await seatIn(viewer.id, thread))) return reply.code(404).send({ error: "Thread not found" });
    return { notes: await messages.mergeThreadNotes(thread.id, parsed.data.notes, parsed.data.baseNoteIds) };
  });

  /**
   * The conversation with one creator, whether or not it has started.
   *
   * Returns a null thread rather than creating one, so opening a Creator's chat from their
   * profile never charges a request fee or leaves an empty thread behind when the player
   * changes their mind. The fee is taken on the first send, which is where it belongs.
   */
  app.get("/messages/compose", async (req, reply) => {
    const parsed = personaQuerySchema
      .extend({
        creatorAccountId: z.string().trim().min(1),
        support: z.enum(["1", "true"]).optional(),
        peek: z.enum(["1", "true"]).optional(),
      })
      .safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const creator = await slurp.getNoodlerAccountById(parsed.data.creatorAccountId);
    if (!creator) return reply.code(404).send({ error: "Creator not found" });
    // Writing as Slurp Support opens Support's one thread with this Creator, from any persona.
    const thread = await messages.getThread(parsed.data.support ? SLURP_SUPPORT_ACCOUNT_ID : viewer.id, creator.id);
    if (thread?.sceneChatId)
      await reconcileSlpThreadScene(app.db, thread).catch((error) => {
        logger.warn({ err: error, threadId: thread.id }, "[slurp-message] Could not reconcile the scene");
      });
    // A profile peeks for prices and policy; only an opened chat reads the thread.
    if (thread && !parsed.data.peek) await messages.markRead(thread.id, "viewer");
    const page = thread ? await messages.listMessagePage(thread.id) : { messages: [], nextCursor: null };
    const presence = await creatorPresence(creator, thread?.id);
    return {
      thread: thread ? await freshView(thread.id) : null,
      messages: page.messages.map(maskForViewer),
      nextCursor: page.nextCursor,
      commissions: thread ? await messages.listCommissionsForThread(thread.id) : [],
      creator,
      ...presence,
      relationship: thread ? await relationshipFor(thread, creator, "viewer", presence.creatorAvailability) : undefined,
      // The client shows the gate before the first message is written, so it must know the
      // policy even when no thread exists yet.
      messaging: await messages.getCreatorMessaging(creator.id),
      subscribed: (await slurp.listSubscriptionsForViewer(viewer.id)).some(
        (entry) => entry.creatorAccountId === creator.id,
      ),
      // Roleplay scenes (docs/SCENES.md): only once the thread exists, and never in Support's thread.
      scenes:
        slpScenesAvailable() &&
        !parsed.data.support &&
        thread?.state === "active" &&
        creator.sourceKind === "character",
    };
  });
}
