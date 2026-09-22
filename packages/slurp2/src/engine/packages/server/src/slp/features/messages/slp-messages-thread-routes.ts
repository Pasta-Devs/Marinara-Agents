import { z } from "zod";
import { type SlurpCommissionPricing, slurpCommissionQuote } from "../../modules/economy/slp-creator-pricing.js";
import { selectSlurpAttentionCommissions } from "./slp-inbox-attention.js";
import { activeSlurpStrikes } from "../../modules/world/slp-stance.js";
import { describeSlurpDayVibe } from "../world/slp-world-contract.js";
import { readSlurpAudienceTone } from "../../../../../shared/src/slp/slp-tone.js";
import { isSlurpViewerActorAccount } from "../../modules/settings/slp-settings.js";
import {
  SLURP_NOTE_MAX_LENGTH,
  SLURP_WORKING_NOTE_LIMIT,
  SLURP_LONGTERM_NOTE_LIMIT,
} from "../../modules/messages/slp-thread-notes.js";
import type { FastifyInstance } from "fastify";
import { personaQuerySchema } from "../../modules/messages/slp-messages-schemas.js";
import type { SlpMessagesContext } from "./slp-messages-context.js";

const messagePageSchema = personaQuerySchema.extend({
  cursorAt: z.string().datetime().optional(),
  cursorId: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(120).default(120),
});

/** The quote each open brief would get from the Creator's own pricing, for the quote form. */
const withSuggestedQuotes = <T extends { brief: string }>(commissions: T[], pricing: SlurpCommissionPricing) =>
  commissions.map((commission) => ({ ...commission, suggestedPrice: slurpCommissionQuote(commission.brief, pricing) }));
export async function slpMessagesThreadRoutes(app: FastifyInstance, messaging: SlpMessagesContext) {
  const { creatorPresence, freshView, messages, ownsCreator, population, requireViewer, slurp, visibleMessages } =
    messaging;
  app.get("/messages/unread-count", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const accounts = await slurp.listNoodlerAccounts();
    const operatedCreatorAccountIds = accounts
      .filter((account) => account.sourceKind === "persona" && account.sourceEntityId === viewer.id)
      .map((account) => account.id);
    return messages.countUnread(
      viewer.id,
      operatedCreatorAccountIds,
      accounts.map((account) => account.id),
    );
  });
  app.get("/messages/threads", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const threads = await messages.listThreadsForViewer(viewer.id);
    // Threads written *to* the Creators this persona operates. Without these the inbox showed only
    // conversations the player started, and anything a fan or the world opened was unreachable.
    const operated = (await slurp.listNoodlerAccounts())
      .filter((account) => account.sourceKind === "persona" && account.sourceEntityId === viewer.id)
      .map((account) => account.id);
    const inbound = await messages.listThreadsForCreators(operated);
    const inboundViews = await Promise.all(
      inbound.map(async (thread) => ({
        ...thread,
        side: "creator" as const,
        // The counterpart is the fan here, not the Creator, so name them or the row is a blank.
        counterpartName:
          (await population.get(thread.viewerAccountId))?.displayName ??
          (await slurp.getNoodlerAccountById(thread.viewerAccountId))?.displayName ??
          (await slurp.getViewer(thread.viewerAccountId).catch(() => null))?.displayName ??
          null,
        counterpartHandle:
          (await population.get(thread.viewerAccountId))?.handle ??
          (await slurp.getNoodlerAccountById(thread.viewerAccountId))?.handle ??
          null,
      })),
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
      unread: threads.reduce((sum, thread) => sum + thread.viewerUnread, 0),
      // Unread on the Creator side is what the player owes an answer to.
      inboundUnread: inboundViews.reduce((sum, thread) => sum + thread.creatorUnread, 0),
      attentionCommissions,
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
    // else's inbox, even on a single-user install.
    if (!thread || (thread.viewerAccountId !== viewer.id && !(await ownsCreator(viewer.id, thread.creatorAccountId))))
      return reply.code(404).send({ error: "Thread not found" });
    const side = thread.viewerAccountId === viewer.id ? "viewer" : "creator";
    await messages.markRead(thread.id, side);
    const creator = await slurp.getNoodlerAccountById(thread.creatorAccountId);
    if (!creator) return reply.code(404).send({ error: "Creator not found" });
    const presence = await creatorPresence(creator, thread.id);
    const audienceTone = readSlurpAudienceTone((await slurp.getSettings()).audienceTone);
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
    );
    return {
      thread: await freshView(thread.id, side),
      messages: page.messages.map((message) =>
        side === "viewer" && message.kind === "ppv" && !message.unlockedAt
          ? {
              ...message,
              content: "",
              imageUrl: null,
              metadata: { ...message.metadata, imagePrompt: undefined, imageDescription: undefined },
            }
          : side === "viewer" && message.kind === "post_preview" && message.metadata.previewLocked === true
            ? {
                ...message,
                content: "",
                imageUrl: null,
                metadata: { ...message.metadata, content: "", imageUrl: null },
              }
            : message,
      ),
      nextCursor: page.nextCursor,
      creator,
      counterpart,
      ...presence,
      messaging: await messages.getCreatorMessaging(thread.creatorAccountId),
      commissions: withSuggestedQuotes(
        await messages.listCommissionsForThread(thread.id),
        await messages.getCreatorMessaging(thread.creatorAccountId),
      ),
      relationship: {
        side,
        tier: thread.rapport.tier,
        score: thread.rapport.score,
        contributions: thread.rapport.contributions,
        mood: thread.mood,
        strikes: activeSlurpStrikes(thread.strikes, thread.lastStrikeAt),
        notes: thread.notes,
        spentCoins: await messages.spentWithCreator(thread.viewerAccountId, thread.creatorAccountId),
        coolUntil: thread.coolUntil,
        dayVibe: await describeSlurpDayVibe(app.db, thread.creatorAccountId),
        availability: presence.creatorAvailability,
        audienceTone,
        imageMode:
          thread.mood <= -40 && audienceTone === "unfiltered" ? "hostile" : thread.mood >= 20 ? "friendly" : "none",
        creatorState: await slurp.getCreatorState(thread.creatorAccountId),
        threadState: thread.threadState,
        scheduledFollowUps: thread.scheduledFollowUps,
      },
    };
  });

  app.get("/messages/compose-targets", async (req, reply) => {
    const parsed = personaQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    await slurp.ensureAudienceCharacterAccounts().catch(() => undefined);
    const profiles = await slurp.listNoodlerStageProfiles();
    const operatedAccounts = (await slurp.listNoodlerAccounts()).filter(
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
    if (!thread || (thread.viewerAccountId !== viewer.id && !(await ownsCreator(viewer.id, thread.creatorAccountId))))
      return reply.code(404).send({ error: "Thread not found" });
    await messages.resetThread(thread.id);
    const side = thread.viewerAccountId === viewer.id ? "viewer" : "creator";
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
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { threadId } = req.params as { threadId: string };
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const thread = await messages.getThreadById(threadId);
    if (!thread || (thread.viewerAccountId !== viewer.id && !(await ownsCreator(viewer.id, thread.creatorAccountId))))
      return reply.code(404).send({ error: "Thread not found" });
    return { notes: await messages.setThreadNotes(thread.id, parsed.data.notes) };
  });

  /**
   * The conversation with one creator, whether or not it has started.
   *
   * Returns a null thread rather than creating one, so opening a Creator's chat from their
   * profile never charges a request fee or leaves an empty thread behind when the player
   * changes their mind. The fee is taken on the first send, which is where it belongs.
   */
  app.get("/messages/compose", async (req, reply) => {
    const parsed = personaQuerySchema.extend({ creatorAccountId: z.string().trim().min(1) }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await requireViewer(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const creator = await slurp.getNoodlerAccountById(parsed.data.creatorAccountId);
    if (!creator) return reply.code(404).send({ error: "Creator not found" });
    const thread = await messages.getThread(viewer.id, creator.id);
    if (thread) await messages.markRead(thread.id, "viewer");
    const page = thread ? await messages.listMessagePage(thread.id) : { messages: [], nextCursor: null };
    const presence = await creatorPresence(creator, thread?.id);
    const audienceTone = thread ? readSlurpAudienceTone((await slurp.getSettings()).audienceTone) : null;
    return {
      thread: thread ? await freshView(thread.id) : null,
      messages: page.messages.map((message) =>
        message.kind === "ppv" && !message.unlockedAt
          ? {
              ...message,
              content: "",
              imageUrl: null,
              metadata: { ...message.metadata, imagePrompt: undefined, imageDescription: undefined },
            }
          : message.kind === "post_preview" && message.metadata.previewLocked === true
            ? {
                ...message,
                content: "",
                imageUrl: null,
                metadata: { ...message.metadata, content: "", imageUrl: null },
              }
            : message,
      ),
      nextCursor: page.nextCursor,
      commissions: thread ? await messages.listCommissionsForThread(thread.id) : [],
      creator,
      ...presence,
      relationship: thread
        ? {
            side: "viewer" as const,
            tier: thread.rapport.tier,
            score: thread.rapport.score,
            contributions: thread.rapport.contributions,
            mood: thread.mood,
            strikes: activeSlurpStrikes(thread.strikes, thread.lastStrikeAt),
            notes: thread.notes,
            spentCoins: await messages.spentWithCreator(thread.viewerAccountId, thread.creatorAccountId),
            coolUntil: thread.coolUntil,
            dayVibe: await describeSlurpDayVibe(app.db, thread.creatorAccountId),
            availability: presence.creatorAvailability,
            audienceTone,
            imageMode:
              thread.mood <= -40 && audienceTone === "unfiltered" ? "hostile" : thread.mood >= 20 ? "friendly" : "none",
            creatorState: await slurp.getCreatorState(thread.creatorAccountId),
            threadState: thread.threadState,
          }
        : undefined,
      // The client shows the gate before the first message is written, so it must know the
      // policy even when no thread exists yet.
      messaging: await messages.getCreatorMessaging(creator.id),
      subscribed: (await slurp.listSubscriptionsForViewer(viewer.id)).some(
        (entry) => entry.creatorAccountId === creator.id,
      ),
    };
  });
}
