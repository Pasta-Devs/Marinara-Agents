// ──────────────────────────────────────────────
// Storage: Slurp direct messages
// ──────────────────────────────────────────────
//
// Its own module rather than more of `slurp.storage.ts`, which is already past five thousand
// lines. It composes that storage for accounts, subscriptions, and the wallet instead of
// reimplementing them, so a DM tip and a profile tip move coins through exactly one code path.
import { tolerateMissingTables } from "./slurp-host-tables.js";
import { and, asc, desc, eq, gt } from "../../db/file-query.js";
import { newId } from "../../utils/id-generator.js";
import type { DB } from "../../db/connection.js";
import { isFileUniqueConstraintError } from "../../db/file-schema.js";
import {
  slurpCommissions,
  slurpMessageClaims,
  slurpMessages,
  slurpReplyBubbles,
  slurpThreads,
} from "../../db/schema/slurp.js";
import { applySlurpMood, type SlurpMoodShift } from "../slurp/slurp-mood.js";
import {
  applySlurpThreadNotes,
  readStoredNotes,
  type SlurpNoteOperation,
  type SlurpThreadNote,
} from "../slurp/slurp-thread-notes.js";
import {
  SLURP_THREAD_STATE_DEFAULT,
  applySlurpThreadStateSignals,
  type SlurpCreatorStateSignal,
} from "../slurp/slurp-creator-state.js";
import { activeSlurpStrikes } from "../slurp/slurp-stance.js";
import { createAppSettingsStorage } from "./app-settings.storage.js";
import { createSlurpStorage } from "./slurp.storage.js";
import { createSlurpPopulationStorage } from "./slurp-population.storage.js";
import {
  admitSlurpThread,
  readSlurpCreatorMessaging,
  slurpMessagePreview,
  SLURP_CREATOR_MESSAGING_KEY,
  SLURP_DEFAULT_CREATOR_MESSAGING,
  type SlurpCreatorMessaging,
  type SlurpMessageKind,
} from "../slurp/slurp-messaging.js";
import {
  emptySlurpRapportFacts,
  scoreSlurpRapport,
  type SlurpRapport,
  type SlurpRapportFacts,
} from "../slurp/slurp-rapport.js";
import { createSlurpReplyQueueStorage } from "./slurp-reply-queue.storage.js";
import { DAY, int, json, mapCommission, mapMessage, mapThread, now } from "./slurp-messages.helpers.js";
import type {
  SlurpCommission,
  SlurpMessage,
  SlurpSendResult,
  SlurpThread,
  SlurpThreadView,
} from "./slurp-messages.types.js";
import { createSlurpReplyMethods } from "./slurp-reply-methods.js";
export type {
  SlurpCommission,
  SlurpMessage,
  SlurpSendResult,
  SlurpThread,
  SlurpThreadView,
} from "./slurp-messages.types.js";

export { SLURP_LONGTERM_NOTE_LIMIT, SLURP_WORKING_NOTE_LIMIT } from "../slurp/slurp-thread-notes.js";

const messageUnlocks = new Map<string, Promise<SlurpMessage | null>>();
const directMessageTips = new Map<string, Promise<SlurpSendResult>>();
const commissionAccepts = new Map<string, Promise<SlurpCommission | null>>();
const commissionSettlements = new Map<string, Promise<SlurpCommission | null>>();
const commissionDeliveries = new Map<string, Promise<SlurpCommission | null>>();

export function createSlurpMessagesStorage(db: DB) {
  const slurp = createSlurpStorage(db);
  const settingsStore = createAppSettingsStorage(db);

  const readMessagingBlob = async (): Promise<Record<string, unknown>> =>
    json(await settingsStore.get(SLURP_CREATOR_MESSAGING_KEY));

  /** Where a creator nobody has configured by hand starts. Settings owns it, not a constant. */
  const messagingDefaults = async (): Promise<SlurpCreatorMessaging> => {
    const settings = await slurp.getSettings();
    return {
      ...SLURP_DEFAULT_CREATOR_MESSAGING,
      dmPolicy: settings.messagesDefaultDmPolicy as SlurpCreatorMessaging["dmPolicy"],
      requestFee: settings.messagesDefaultRequestFee,
      ppvPrice: settings.messagesDefaultPpvPrice,
    };
  };

  // `mediaPath` is deliberately absent from `SlurpCommission`: it is a path on the host's disk,
  // and the mapped row is sent to the client.

  /**
   * The cached rapport is a display convenience. A blob written by an older build, or by hand,
   * must render as a cold thread rather than throw the whole inbox away.
   */
  const storage = {
    ...createSlurpReplyMethods(db, () => storage),
    /** Per-creator messaging settings, falling back to the defaults Settings holds. */
    async getCreatorMessaging(creatorAccountId: string): Promise<SlurpCreatorMessaging> {
      return readSlurpCreatorMessaging((await readMessagingBlob())[creatorAccountId], await messagingDefaults());
    },

    async setCreatorMessaging(
      creatorAccountId: string,
      patch: Partial<SlurpCreatorMessaging>,
    ): Promise<SlurpCreatorMessaging> {
      const blob = await readMessagingBlob();
      const defaults = await messagingDefaults();
      const next = readSlurpCreatorMessaging(
        { ...readSlurpCreatorMessaging(blob[creatorAccountId], defaults), ...patch },
        defaults,
      );
      await settingsStore.set(SLURP_CREATOR_MESSAGING_KEY, JSON.stringify({ ...blob, [creatorAccountId]: next }));
      return next;
    },

    async getThreadById(threadId: string): Promise<SlurpThread | null> {
      const rows = await db.select().from(slurpThreads).where(eq(slurpThreads.id, threadId));
      return rows[0] ? mapThread(rows[0]) : null;
    },

    async getThread(viewerAccountId: string, creatorAccountId: string): Promise<SlurpThread | null> {
      const rows = await db
        .select()
        .from(slurpThreads)
        .where(
          and(eq(slurpThreads.viewerAccountId, viewerAccountId), eq(slurpThreads.creatorAccountId, creatorAccountId)),
        );
      return rows[0] ? mapThread(rows[0]) : null;
    },

    async listMessages(threadId: string, limit = 120): Promise<SlurpMessage[]> {
      const rows = await db
        .select()
        .from(slurpMessages)
        .where(eq(slurpMessages.threadId, threadId))
        .orderBy(desc(slurpMessages.createdAt))
        .limit(limit);
      return rows.map(mapMessage).reverse();
    },

    /**
     * One thread with its creator and the viewer's subscription state joined in.
     *
     * Every route that hands a thread to the client goes through here. The inbox and the open
     * conversation must agree about whether the viewer is subscribed — when only the inbox knew,
     * an open chat told a paying subscriber their message was going to the request tray.
     */
    async viewThread(thread: SlurpThread): Promise<SlurpThreadView | null> {
      const creator = await slurp.getNoodlerAccountById(thread.creatorAccountId);
      if (!creator) return null;
      const subscriptions = await slurp.listSubscriptionsForViewer(thread.viewerAccountId);
      return {
        ...thread,
        creatorHandle: creator.handle,
        creatorDisplayName: creator.displayName,
        creatorAvatarUrl: creator.avatarUrl ?? null,
        subscribed: subscriptions.some((entry) => entry.creatorAccountId === thread.creatorAccountId),
      };
    },

    /**
     * Every thread addressed **to** one of these Creators, newest first.
     *
     * Without this the inbox only ever showed threads the player opened, so a fan who wrote to
     * your Creator — or a commission the world opened on their behalf — created a thread nobody
     * could ever reach. The obligation layer produced obligations that were invisible.
     */
    async listThreadsForCreators(creatorAccountIds: readonly string[]): Promise<SlurpThreadView[]> {
      if (creatorAccountIds.length === 0) return [];
      const wanted = new Set(creatorAccountIds);
      const rows = await db.select().from(slurpThreads).orderBy(desc(slurpThreads.lastMessageAt));
      const out: SlurpThreadView[] = [];
      for (const row of rows) {
        const thread = mapThread(row);
        if (!wanted.has(thread.creatorAccountId)) continue;
        // A thread the player opened with their own Creator would otherwise appear on both sides.
        if (wanted.has(thread.viewerAccountId)) continue;
        const view = await storage.viewThread(thread);
        if (view) out.push(view);
      }
      return out;
    },

    /**
     * Every thread this viewer has, newest first, with the creator joined in.
     *
     * A thread whose creator is gone is dropped rather than rendered blank: a deleted source
     * already pauses its Slurp profile, and a nameless row in the inbox is only confusing.
     */
    async listThreadsForViewer(viewerAccountId: string): Promise<SlurpThreadView[]> {
      const rows = await db
        .select()
        .from(slurpThreads)
        .where(eq(slurpThreads.viewerAccountId, viewerAccountId))
        .orderBy(desc(slurpThreads.lastMessageAt));
      const subscribed = new Set(
        (await slurp.listSubscriptionsForViewer(viewerAccountId)).map((entry) => entry.creatorAccountId),
      );
      const views: SlurpThreadView[] = [];
      for (const row of rows) {
        const thread = mapThread(row);
        const creator = await slurp.getNoodlerAccountById(thread.creatorAccountId);
        if (!creator) continue;
        views.push({
          ...thread,
          creatorHandle: creator.handle,
          creatorDisplayName: creator.displayName,
          creatorAvatarUrl: creator.avatarUrl ?? null,
          subscribed: subscribed.has(thread.creatorAccountId),
        });
      }
      return views;
    },

    /**
     * Rebuild the rapport for one pair from the audience tie and the thread itself.
     *
     * Computed rather than incremented: a counter that drifts is a counter nobody can debug, and
     * the inputs are all small reads the send path already pays for.
     */
    async rapportFor(viewerAccountId: string, creatorAccountId: string): Promise<SlurpRapport> {
      const messaging = await storage.getCreatorMessaging(creatorAccountId);
      const facts = await storage.rapportFactsFor(viewerAccountId, creatorAccountId);
      // Apply subscriber boost: subscribers gain rapport 1.5x faster from conversation and effort
      return scoreSlurpRapport(facts, messaging.rapportWeights, { subscriberBoost: true });
    },

    /**
     * The facts behind one pair's rapport.
     *
     * Money comes from the audience tie, which is per pair and keeps a lifetime total. It used to
     * come from the wallet ledger, which was wrong three ways at once: the ledger is capped at 60
     * entries across every creator, so a whale's history aged out of their own score; entries were
     * matched by `note.includes(handle)`, so a creator named `mia` collected every tip sent to
     * `miamoon`; and a tip sent inside a thread was counted twice, once from the ledger and once
     * from the message row it also wrote.
     */
    async rapportFactsFor(viewerAccountId: string, creatorAccountId: string): Promise<SlurpRapportFacts> {
      const facts = emptySlurpRapportFacts();
      const wallet = await slurp.getWallet(viewerAccountId);
      const subscription = wallet.subscriptions[creatorAccountId];
      const subscriptions = await slurp.listSubscriptionsForViewer(viewerAccountId);
      const active = subscriptions.find((entry) => entry.creatorAccountId === creatorAccountId);
      facts.subscribed = Boolean(active);
      facts.subscribedDays = active ? Math.max(0, (Date.now() - Date.parse(active.createdAt)) / DAY) : 0;

      const tie = (await createSlurpPopulationStorage(db).listTiesForCreator(creatorAccountId)).find(
        (entry) => entry.memberId === viewerAccountId,
      );
      if (tie) {
        facts.tippedCoins = tie.tipped;
        facts.unlockedCoins = tie.unlocked;
      }

      const thread = await storage.getThread(viewerAccountId, creatorAccountId);
      if (thread) {
        const messages = await storage.listMessages(thread.id, 500);
        const fromViewer = messages.filter((message) => message.role === "viewer" && message.kind !== "tip");
        facts.viewerMessages = fromViewer.length;
        // A broadcast went to everybody, so counting it here let a mass send buy the reciprocity
        // score, which exists to measure whether this creator answers *you*.
        facts.creatorMessages = messages.filter(
          (message) => message.role === "creator" && message.kind !== "broadcast",
        ).length;
        facts.averageViewerMessageLength =
          fromViewer.length === 0
            ? 0
            : fromViewer.reduce((sum, message) => sum + message.content.length, 0) / fromViewer.length;
        const last = fromViewer[fromViewer.length - 1];
        facts.daysSinceViewerMessage = last ? Math.max(0, (Date.now() - Date.parse(last.createdAt)) / DAY) : null;
        facts.commissionsDelivered = messages.filter((message) => message.kind === "commission_delivery").length;
      }
      // Paid through a period that has ended, with no live subscription row, is a lapse.
      facts.lapsed = !facts.subscribed && subscription !== undefined;
      return facts;
    },

    /**
     * Open a thread if the creator's policy allows it, charging the request fee first.
     *
     * The fee is taken before the row exists so a refused payment leaves no half-open thread.
     */
    async openThread(
      viewerAccountId: string,
      creatorAccountId: string,
      openedBy: "viewer" | "creator" = "viewer",
    ): Promise<
      | { status: "ok"; thread: SlurpThread }
      | { status: "closed" }
      | { status: "insufficient_funds"; required: number }
      | { status: "not_found" }
    > {
      if (viewerAccountId === creatorAccountId) return { status: "not_found" };
      const creator = await slurp.getNoodlerAccountById(creatorAccountId);
      if (!creator) return { status: "not_found" };
      const existing = await storage.getThread(viewerAccountId, creatorAccountId);
      // A creator writing first always gets through: it is their own inbox, and a welcome message
      // that the creator's own policy blocked would be an absurdity.
      if (existing && (openedBy === "creator" || existing.state !== "request")) {
        if (existing.state === "declined" && openedBy !== "creator") return { status: "closed" };
        return { status: "ok", thread: existing };
      }
      if (existing) return { status: "ok", thread: existing };

      const messaging = await storage.getCreatorMessaging(creatorAccountId);
      const subscriptions = await slurp.listSubscriptionsForViewer(viewerAccountId);
      const subscribed = subscriptions.some((entry) => entry.creatorAccountId === creatorAccountId);
      const admission =
        openedBy === "creator"
          ? ({ allowed: true, state: "active", fee: 0 } as const)
          : admitSlurpThread(messaging, { subscribed, existingState: null });
      if (!admission.allowed) return { status: "closed" };

      const settings = await slurp.getSettings();
      let feePaid = 0;
      if (settings.walletEnabled && admission.fee > 0) {
        const charged = await slurp.spendCoins(viewerAccountId, "messageRequest", admission.fee, creator.handle);
        if (!charged) return { status: "insufficient_funds", required: admission.fee };
        await slurp.creditCreatorIncome(creatorAccountId, admission.fee, "messageRequest");
        await slurp.notifyCreatorIncome(creatorAccountId, "messageRequest", admission.fee, viewerAccountId);
        feePaid = admission.fee;
      }

      const timestamp = now();
      const row = {
        id: newId(),
        viewerAccountId,
        creatorAccountId,
        state: admission.state,
        openedBy,
        requestFeePaid: String(feePaid),
        lastMessageAt: timestamp,
        lastMessagePreview: "",
        viewerUnread: "0",
        creatorUnread: "0",
        replyNotBeforeAt: null,
        rapport: "{}",
        threadState: "{}",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      try {
        await db.insert(slurpThreads).values(row);
      } catch (error) {
        if (!isFileUniqueConstraintError(error, "slurp_threads", ["viewerAccountId", "creatorAccountId"])) throw error;
        const raced = await storage.getThread(viewerAccountId, creatorAccountId);
        if (feePaid > 0) {
          await slurp.refundCoins(viewerAccountId, feePaid, "duplicate message request");
          await slurp.reverseCreatorIncome(creatorAccountId, feePaid, "duplicate message request");
        }
        return raced ? { status: "ok", thread: raced } : { status: "not_found" };
      }
      const thread = await storage.getThread(viewerAccountId, creatorAccountId);
      return thread ? { status: "ok", thread } : { status: "not_found" };
    },

    /** Append one message and roll the thread's preview, unread counts, and cached rapport. */
    async appendMessage(
      threadId: string,
      input: {
        id?: string;
        senderAccountId: string;
        role: "viewer" | "creator";
        kind?: SlurpMessageKind;
        content?: string;
        imageUrl?: string | null;
        price?: number;
        unlockedAt?: string | null;
        metadata?: Record<string, unknown>;
        createdAt?: string;
        replyObligationCreatedAt?: string;
      },
    ): Promise<SlurpMessage | null> {
      const thread = await storage.getThreadById(threadId);
      if (!thread) return null;
      const kind = input.kind ?? "text";
      const content = input.content ?? "";
      const price = Math.max(0, Math.trunc(input.price ?? 0));
      const timestamp = now();
      const message = {
        id: input.id ?? newId(),
        threadId,
        senderAccountId: input.senderAccountId,
        role: input.role,
        kind,
        content,
        imageUrl: input.imageUrl ?? null,
        imagePrompt: null,
        imageClaimToken: null,
        imageClaimLeaseUntil: null,
        price: String(price),
        unlockedAt: input.unlockedAt ?? null,
        readAt: null,
        metadata: JSON.stringify(input.metadata ?? {}),
        senderSnapshot: "{}",
        createdAt: input.createdAt ?? timestamp,
      };
      const rapport = await storage.rapportFor(thread.viewerAccountId, thread.creatorAccountId);
      try {
        await db.transaction(async (tx) => {
          await tx.insert(slurpMessages).values(message);
          const currentRows = await tx.select().from(slurpThreads).where(eq(slurpThreads.id, threadId));
          const current = currentRows[0];
          if (!current) return;
          const newerViewer =
            input.role === "creator" && input.replyObligationCreatedAt
              ? (
                  await tx
                    .select()
                    .from(slurpMessages)
                    .where(
                      and(
                        eq(slurpMessages.threadId, threadId),
                        eq(slurpMessages.role, "viewer"),
                        gt(slurpMessages.createdAt, input.replyObligationCreatedAt),
                      ),
                    )
                    .limit(1)
                ).length > 0
              : false;
          await tx
            .update(slurpThreads)
            .set({
              state: input.role === "creator" && thread.state === "request" ? "active" : thread.state,
              lastMessageAt: message.createdAt > current.lastMessageAt ? message.createdAt : current.lastMessageAt,
              lastMessagePreview:
                message.createdAt >= current.lastMessageAt
                  ? slurpMessagePreview(kind, content, price)
                  : current.lastMessagePreview,
              viewerUnread: input.role === "creator" ? String(Number(current.viewerUnread) + 1) : current.viewerUnread,
              creatorUnread:
                input.role === "viewer" ? String(Number(current.creatorUnread) + 1) : current.creatorUnread,
              replyNotBeforeAt: input.role === "creator" && !newerViewer ? null : current.replyNotBeforeAt,
              rapport: JSON.stringify(rapport),
              updatedAt: timestamp,
            })
            .where(eq(slurpThreads.id, threadId));
        });
      } catch (error) {
        if (input.id && isFileUniqueConstraintError(error, "slurp_messages", ["id"]))
          return storage.getMessageById(input.id);
        throw error;
      }
      return mapMessage(message);
    },

    /** Persist the visible bubble and its delayed siblings as one recoverable unit. */
    async appendReplyBatch(
      threadId: string,
      input: {
        first: { id?: string; senderAccountId: string; content: string };
        delayed: Array<{
          id: string;
          batchId: string;
          sequence: number;
          senderAccountId: string;
          content: string;
          deliverAt: string;
          createdAt: string;
        }>;
      },
    ): Promise<SlurpMessage | null> {
      const thread = await storage.getThreadById(threadId);
      if (!thread) return null;
      const rapport = await storage.rapportFor(thread.viewerAccountId, thread.creatorAccountId);
      const timestamp = now();
      const first = {
        id: input.first.id ?? newId(),
        threadId,
        senderAccountId: input.first.senderAccountId,
        role: "creator" as const,
        kind: "text" as const,
        content: input.first.content,
        imageUrl: null,
        imagePrompt: null,
        imageClaimToken: null,
        imageClaimLeaseUntil: null,
        price: "0",
        unlockedAt: null,
        readAt: null,
        metadata: "{}",
        senderSnapshot: "{}",
        createdAt: timestamp,
      };
      const rows = input.delayed.map((bubble) => ({
        id: bubble.id,
        batchId: bubble.batchId,
        sequence: String(bubble.sequence),
        threadId,
        senderAccountId: bubble.senderAccountId,
        messageId: bubble.id,
        content: bubble.content,
        deliverAt: bubble.deliverAt,
        createdAt: bubble.createdAt,
      }));
      let stored = false;
      await db.transaction(async (tx) => {
        const currentRows = await tx.select().from(slurpThreads).where(eq(slurpThreads.id, threadId));
        const current = currentRows[0];
        if (!current) return;
        const claimRows = await tx
          .select()
          .from(slurpMessageClaims)
          .where(eq(slurpMessageClaims.id, input.first.id ?? "__missing_claim__"));
        const latestRows = await tx
          .select()
          .from(slurpMessages)
          .where(eq(slurpMessages.threadId, threadId))
          .orderBy(desc(slurpMessages.createdAt))
          .limit(1);
        const newerViewerMessage =
          latestRows[0]?.role === "viewer" && latestRows[0].id !== claimRows[0]?.triggerMessageId;
        await tx.insert(slurpMessages).values(first);
        if (rows.length > 0) await tx.insert(slurpReplyBubbles).values(rows);
        // Answering is reading. Nothing cleared this before, so `listThreadsAwaitingReply` kept
        // handing the same answered message back to the queued-reply scheduler and the creator
        // re-answered it once a minute, forever, until the fan spoke again. A message that landed
        // while this reply was being written is a fresh obligation and stays unread.
        if (!newerViewerMessage) {
          for (const row of await tx
            .select()
            .from(slurpMessages)
            .where(and(eq(slurpMessages.threadId, threadId), eq(slurpMessages.role, "viewer")))) {
            if (row.readAt) continue;
            await tx.update(slurpMessages).set({ readAt: timestamp }).where(eq(slurpMessages.id, row.id));
          }
        }
        await tx
          .update(slurpMessageClaims)
          .set({ replyMessageId: first.id })
          .where(eq(slurpMessageClaims.id, input.first.id ?? "__missing_claim__"));
        await tx
          .update(slurpThreads)
          .set({
            state: current.state === "request" ? "active" : current.state,
            lastMessageAt: timestamp,
            lastMessagePreview: slurpMessagePreview("text", first.content, 0),
            viewerUnread: String(Number(current.viewerUnread) + 1),
            creatorUnread: newerViewerMessage ? current.creatorUnread : "0",
            replyNotBeforeAt: newerViewerMessage ? current.replyNotBeforeAt : null,
            rapport: JSON.stringify(rapport),
            updatedAt: timestamp,
          })
          .where(eq(slurpThreads.id, threadId));
        stored = true;
      });
      return stored ? mapMessage(first) : null;
    },

    async unlockMessage(viewerAccountId: string, messageId: string): Promise<SlurpMessage | null> {
      const previous = messageUnlocks.get(messageId) ?? Promise.resolve(null);
      const current = previous.catch(() => null).then(() => storage.unlockMessageUnlocked(viewerAccountId, messageId));
      messageUnlocks.set(messageId, current);
      try {
        return await current;
      } finally {
        if (messageUnlocks.get(messageId) === current) messageUnlocks.delete(messageId);
      }
    },

    async unlockMessageUnlocked(viewerAccountId: string, messageId: string): Promise<SlurpMessage | null> {
      const rows = await db.select().from(slurpMessages).where(eq(slurpMessages.id, messageId));
      const row = rows[0];
      if (!row) return null;
      const thread = await storage.getThreadById(String(row.threadId));
      // Only a PPV message is content-locked. Without the kind check a tip or a commission quote —
      // both stored with a price and no `unlockedAt` — could be "unlocked" and charged a second time.
      if (String(row.kind) !== "ppv") return null;
      if (!thread || thread.viewerAccountId !== viewerAccountId || Number(row.price ?? 0) <= 0) return null;
      if (row.unlockedAt) return mapMessage(row);
      const price = int(row.price as string);
      const settings = await slurp.getSettings();
      if (settings.walletEnabled) {
        const charged = await slurp.spendCoins(viewerAccountId, "ppv", price, thread.creatorAccountId);
        if (!charged) return null;
        try {
          await slurp.creditCreatorIncome(thread.creatorAccountId, price, "ppv");
          await slurp.notifyCreatorIncome(thread.creatorAccountId, "ppv", price, viewerAccountId, messageId);
          // Paying to see something is the strongest signal in a thread, and it reached the funnel
          // nowhere: only profile unlocks did, so the same coins counted or not by where they were spent.
          await slurp.advanceAudienceTie(viewerAccountId, thread.creatorAccountId, {
            stage: "regular",
            spent: price,
            unlocked: price,
          });
          const unlockedAt = now();
          await db.update(slurpMessages).set({ unlockedAt }).where(eq(slurpMessages.id, messageId));
          return mapMessage({ ...row, unlockedAt });
        } catch (error) {
          await slurp.refundCoins(viewerAccountId, price, "failed PPV unlock");
          await slurp.reverseCreatorIncome(thread.creatorAccountId, price, "failed PPV unlock");
          throw error;
        }
      }
      const unlockedAt = now();
      await db.update(slurpMessages).set({ unlockedAt }).where(eq(slurpMessages.id, messageId));
      return mapMessage({ ...row, unlockedAt });
    },

    async sendCreatorMessage(
      creatorAccountId: string,
      viewerAccountId: string,
      input: {
        content: string;
        kind?: SlurpMessageKind;
        price?: number;
        unlockedAt?: string | null;
        imageUrl?: string | null;
        metadata?: Record<string, unknown>;
      },
    ): Promise<SlurpMessage | null> {
      // A counterpart is a persona, an ambient Slurp account, or a generated population member.
      // Gating on personas alone meant a fan the world sent could write to a Creator and never be
      // answered — an obligation with no way to discharge it.
      const counterpartExists =
        Boolean(await slurp.getViewer(viewerAccountId).catch(() => null)) ||
        Boolean(await slurp.getNoodlerAccountById(viewerAccountId)) ||
        Boolean(await createSlurpPopulationStorage(db).get(viewerAccountId));
      if (!counterpartExists) return null;
      const opened = await storage.openThread(viewerAccountId, creatorAccountId, "creator");
      if (opened.status !== "ok") return null;
      return storage.appendMessage(opened.thread.id, {
        senderAccountId: creatorAccountId,
        role: "creator",
        content: input.content,
        kind: input.kind,
        price: input.price,
        unlockedAt: input.unlockedAt,
        imageUrl: input.imageUrl ?? null,
        metadata: input.metadata,
      });
    },

    /**
     * Open a commission request.
     *
     * `"open_request"` means this thread already has one waiting on the Creator. Nothing capped
     * this, so a fan — or the world, ticking on a Creator nobody answers — could stack unlimited
     * briefs in one conversation. The queue this is meant to protect is the same one
     * `listOpenCommissionsForCreator` exists to keep short.
     */
    async createCommission(
      viewerAccountId: string,
      creatorAccountId: string,
      brief: string,
    ): Promise<SlurpCommission | "open_request" | null> {
      const opened = await storage.openThread(viewerAccountId, creatorAccountId, "viewer");
      if (opened.status !== "ok") return null;
      const open = await storage.listCommissionsForThread(opened.thread.id);
      if (open.some((row) => row.state === "brief" || row.state === "quoted")) return "open_request";
      const timestamp = now();
      const row = {
        id: newId(),
        threadId: opened.thread.id,
        viewerAccountId,
        creatorAccountId,
        state: "brief",
        brief,
        price: "0",
        deliveryMessageId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.insert(slurpCommissions).values(row);
      await storage.appendMessage(opened.thread.id, {
        senderAccountId: viewerAccountId,
        role: "viewer",
        kind: "commission_brief",
        content: brief,
        metadata: { commissionId: row.id },
      });
      // Somebody asking you to make something is the strongest thing the world can do, so it
      // outranks every other event kind.
      await slurp.recordCreatorEvent(creatorAccountId, "commission_requested", {
        subjectId: opened.thread.id,
        actorLabel: viewerAccountId,
      });
      return mapCommission(row);
    },

    /** Every commission in one thread, oldest first, so the chat can render them beside the messages. */
    async listCommissionsForThread(threadId: string): Promise<SlurpCommission[]> {
      const rows = await db
        .select()
        .from(slurpCommissions)
        .where(eq(slurpCommissions.threadId, threadId))
        .orderBy(asc(slurpCommissions.createdAt));
      return rows.map(mapCommission);
    },

    /**
     * Commissions still waiting on the Creator: a brief with no quote, or a quote not yet
     * delivered. The world reads this to avoid piling requests onto a queue nobody answered.
     */
    async listOpenCommissionsForCreator(creatorAccountId: string): Promise<SlurpCommission[]> {
      const rows = await db
        .select()
        .from(slurpCommissions)
        .where(eq(slurpCommissions.creatorAccountId, creatorAccountId));
      return rows.map(mapCommission).filter((row) => row.state === "brief" || row.state === "accepted");
    },

    async getMessageById(id: string): Promise<SlurpMessage | null> {
      const rows = await db.select().from(slurpMessages).where(eq(slurpMessages.id, id));
      return rows[0] ? mapMessage(rows[0]) : null;
    },

    /** Replace a placeholder brief with the model's rewrite. Text only; nothing else moves. */
    async rewriteCommissionBrief(id: string, brief: string): Promise<void> {
      await db.update(slurpCommissions).set({ brief, updatedAt: now() }).where(eq(slurpCommissions.id, id));
      const rows = await db.select().from(slurpCommissions).where(eq(slurpCommissions.id, id));
      const commission = rows[0];
      if (!commission) return;
      const messages = await db.select().from(slurpMessages).where(eq(slurpMessages.threadId, commission.threadId));
      const linked = messages.find((message) => {
        try {
          return JSON.parse(String(message.metadata ?? "{}"))?.commissionId === id;
        } catch {
          return false;
        }
      });
      if (!linked) return;
      await db.update(slurpMessages).set({ content: brief }).where(eq(slurpMessages.id, linked.id));
      const latest = messages.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
      if (latest?.id === linked.id) {
        await db
          .update(slurpThreads)
          .set({ lastMessagePreview: brief.slice(0, 160), updatedAt: now() })
          .where(eq(slurpThreads.id, commission.threadId));
      }
    },

    /** Replace a placeholder message with the model's rewrite, and keep the inbox preview in step. */
    async rewriteMessageContent(id: string, content: string): Promise<void> {
      const rows = await db.select().from(slurpMessages).where(eq(slurpMessages.id, id));
      const row = rows[0];
      if (!row) return;
      await db.update(slurpMessages).set({ content }).where(eq(slurpMessages.id, id));
      const thread = await storage.getThreadById(String(row.threadId));
      // The inbox row caches the last message, so rewriting the message without this leaves the
      // list showing the placeholder next to a conversation that no longer contains it.
      const latest = (await storage.listMessages(String(row.threadId), 1))[0];
      if (thread && latest?.id === id) {
        await db
          .update(slurpThreads)
          .set({ lastMessagePreview: content.slice(0, 160), updatedAt: now() })
          .where(eq(slurpThreads.id, thread.id));
      }
    },

    async getCommission(id: string): Promise<SlurpCommission | null> {
      const rows = await db.select().from(slurpCommissions).where(eq(slurpCommissions.id, id));
      return rows[0] ? mapCommission(rows[0]) : null;
    },

    /** Every commission waiting on the fan's answer, for the world tick to settle. */
    async listQuotedCommissions(): Promise<SlurpCommission[]> {
      // Filtered in the query rather than after it: these run every world tick, and the table
      // only ever grows.
      const rows = await db.select().from(slurpCommissions).where(eq(slurpCommissions.state, "quoted"));
      return rows.map(mapCommission);
    },

    /** Briefs opened by generated audience members, which the world can quote automatically. */
    async listAudienceBriefCommissions(): Promise<SlurpCommission[]> {
      const rows = await db.select().from(slurpCommissions).where(eq(slurpCommissions.state, "brief"));
      const population = createSlurpPopulationStorage(db);
      const generated = new Map<string, boolean>();
      const commissions: SlurpCommission[] = [];
      for (const row of rows) {
        const viewerAccountId = String(row.viewerAccountId);
        if (!generated.has(viewerAccountId))
          generated.set(viewerAccountId, Boolean(await population.get(viewerAccountId)));
        if (generated.get(viewerAccountId)) commissions.push(mapCommission(row));
      }
      return commissions;
    },

    /** Briefs addressed to character-controlled Creators. Their world tick supplies the first quote. */
    async listAutomatedBriefCommissions(): Promise<SlurpCommission[]> {
      const rows = await db.select().from(slurpCommissions).where(eq(slurpCommissions.state, "brief"));
      // One read per Creator, not one per brief. A Creator with a stacked queue used to be
      // fetched once for every row in it.
      const automated = new Map<string, boolean>();
      const commissions: SlurpCommission[] = [];
      for (const row of rows) {
        const creatorAccountId = String(row.creatorAccountId);
        if (!automated.has(creatorAccountId)) {
          const creator = await slurp.getNoodlerAccountById(creatorAccountId);
          automated.set(creatorAccountId, Boolean(creator && creator.sourceKind !== "persona"));
        }
        if (automated.get(creatorAccountId)) commissions.push(mapCommission(row));
      }
      return commissions;
    },

    /**
     * Settle a quote on behalf of a fan the world invented.
     *
     * The accept route requires the commission's viewer to be the player's persona, and a
     * generated population member is not one and has no wallet. So every commission the world
     * opened — the only path by which the audience ever pays the Creator anything — sat at
     * `quoted` forever: the player named a price and nothing could ever answer.
     *
     * No wallet is debited, because there is no wallet to debit: this fan is not spending the
     * player's coins. The Creator is credited and the tie records what was paid, which is what
     * makes the funnel's paying stages reachable by anyone other than the player.
     */
    async settleAudienceCommission(id: string, decision: "accept" | "decline"): Promise<SlurpCommission | null> {
      const previous = commissionSettlements.get(id) ?? Promise.resolve(null);
      const current = previous.catch(() => null).then(() => storage.settleAudienceCommissionUnlocked(id, decision));
      commissionSettlements.set(id, current);
      try {
        return await current;
      } finally {
        if (commissionSettlements.get(id) === current) commissionSettlements.delete(id);
      }
    },

    async settleAudienceCommissionUnlocked(
      id: string,
      decision: "accept" | "decline",
    ): Promise<SlurpCommission | null> {
      const commission = await storage.getCommission(id);
      if (!commission || commission.state !== "quoted") return commission;
      if (!(await createSlurpPopulationStorage(db).get(commission.viewerAccountId))) return commission;
      if (decision === "decline") {
        await db
          .update(slurpCommissions)
          .set({ state: "declined", updatedAt: now() })
          .where(eq(slurpCommissions.id, id));
        return storage.getCommission(id);
      }
      await slurp.creditCreatorIncome(commission.creatorAccountId, commission.price, "commission");
      await slurp.notifyCreatorIncome(
        commission.creatorAccountId,
        "commission",
        commission.price,
        commission.viewerAccountId,
        commission.id,
      );
      await slurp.advanceAudienceTie(commission.viewerAccountId, commission.creatorAccountId, {
        stage: "subscriber",
        spent: commission.price,
      });
      await db.update(slurpCommissions).set({ state: "accepted", updatedAt: now() }).where(eq(slurpCommissions.id, id));
      await storage.appendMessage(commission.threadId, {
        senderAccountId: commission.viewerAccountId,
        role: "viewer",
        kind: "system",
        content: `Accepted the quote and paid ${commission.price} coins.`,
        metadata: { commissionId: id },
      });
      return storage.getCommission(id);
    },

    async quoteCommission(id: string, price: number): Promise<SlurpCommission | null> {
      // Re-quoting an accepted or delivered commission used to reset it to `quoted`, which made it
      // payable a second time.
      const existing = await storage.getCommission(id);
      if (!existing || (existing.state !== "brief" && existing.state !== "quoted")) return existing;
      const timestamp = now();
      await db
        .update(slurpCommissions)
        .set({ state: "quoted", price: String(price), updatedAt: timestamp })
        .where(eq(slurpCommissions.id, id));
      const commission = await storage.getCommission(id);
      if (commission) {
        await storage.appendMessage(commission.threadId, {
          senderAccountId: commission.creatorAccountId,
          role: "creator",
          kind: "commission_quote",
          content: `Commission quote: ${price} coins`,
          price,
          metadata: { commissionId: id },
        });
      }
      return storage.getCommission(id);
    },

    async acceptCommission(id: string): Promise<SlurpCommission | null> {
      // Serialized like `unlockMessage`: the check-then-spend span is the invariant, and the
      // financial queue only serializes each individual wallet write. Two concurrent accepts both
      // read `quoted` and both paid.
      const previous = commissionAccepts.get(id) ?? Promise.resolve(null);
      const current = previous.catch(() => null).then(() => storage.acceptCommissionUnlocked(id));
      commissionAccepts.set(id, current);
      try {
        return await current;
      } finally {
        if (commissionAccepts.get(id) === current) commissionAccepts.delete(id);
      }
    },

    async acceptCommissionUnlocked(id: string): Promise<SlurpCommission | null> {
      const commission = await storage.getCommission(id);
      if (!commission || commission.state !== "quoted") return commission;
      const settings = await slurp.getSettings();
      if (
        settings.walletEnabled &&
        !(await slurp.spendCoins(
          commission.viewerAccountId,
          "commission",
          commission.price,
          commission.creatorAccountId,
        ))
      )
        return null;
      try {
        await slurp.creditCreatorIncome(commission.creatorAccountId, commission.price, "commission");
        await slurp.advanceAudienceTie(commission.viewerAccountId, commission.creatorAccountId, {
          stage: "regular",
          spent: commission.price,
        });
        await slurp.notifyCreatorIncome(
          commission.creatorAccountId,
          "commission",
          commission.price,
          commission.viewerAccountId,
          commission.id,
        );
        await db
          .update(slurpCommissions)
          .set({ state: "accepted", updatedAt: now() })
          .where(eq(slurpCommissions.id, id));
      } catch (error) {
        // Same compensation as `unlockMessageUnlocked`: a failure after the debit used to strand the
        // coins while leaving the commission payable again.
        if (settings.walletEnabled) {
          await slurp.refundCoins(commission.viewerAccountId, commission.price, "failed commission accept");
          await slurp.reverseCreatorIncome(commission.creatorAccountId, commission.price, "failed commission accept");
        }
        throw error;
      }
      return storage.getCommission(id);
    },

    /**
     * End a commission before it is paid for.
     *
     * The same call for both sides: a Creator declining a brief and a fan taking one back are the
     * same state change, and `declined` is the state the schema and the localized labels already
     * ship. Only an unpaid commission may be ended — once it is accepted the coins have moved, so
     * ending it there would need a refund path rather than a state change.
     */
    /**
     * Attach generated media to a message after it exists.
     *
     * The serving URL contains the message id, and `appendMessage` mints that id, so the image can
     * only be bound once the row is written.
     */
    async setMessageMedia(messageId: string, imageUrl: string, mediaPath: string): Promise<void> {
      const rows = await db.select().from(slurpMessages).where(eq(slurpMessages.id, messageId));
      const row = rows[0];
      if (!row) return;
      const metadata = { ...(json(row.metadata as string) ?? {}), noodlerMediaPath: mediaPath };
      await db
        .update(slurpMessages)
        .set({ imageUrl, metadata: JSON.stringify(metadata) })
        .where(eq(slurpMessages.id, messageId));
    },

    async setMessageReaction(
      messageId: string,
      viewerAccountId: string,
      reaction: string | null,
    ): Promise<SlurpMessage | null> {
      const message = await storage.getMessageById(messageId);
      if (!message) return null;
      const thread = await storage.getThreadById(message.threadId);
      if (!thread || thread.viewerAccountId !== viewerAccountId) return null;
      const metadata = { ...message.metadata, reaction: reaction === "heart" ? "heart" : null };
      await db
        .update(slurpMessages)
        .set({ metadata: JSON.stringify(metadata) })
        .where(eq(slurpMessages.id, messageId));
      return storage.getMessageById(messageId);
    },

    async declineCommission(id: string, by: "creator" | "viewer"): Promise<SlurpCommission | null> {
      const previous = commissionAccepts.get(id) ?? Promise.resolve(null);
      const current = previous.catch(() => null).then(() => storage.declineCommissionUnlocked(id, by));
      commissionAccepts.set(id, current);
      try {
        return await current;
      } finally {
        if (commissionAccepts.get(id) === current) commissionAccepts.delete(id);
      }
    },

    async declineCommissionUnlocked(id: string, by: "creator" | "viewer"): Promise<SlurpCommission | null> {
      const commission = await storage.getCommission(id);
      if (!commission || (commission.state !== "brief" && commission.state !== "quoted")) return commission;
      await db.update(slurpCommissions).set({ state: "declined", updatedAt: now() }).where(eq(slurpCommissions.id, id));
      await storage.appendMessage(commission.threadId, {
        senderAccountId: by === "creator" ? commission.creatorAccountId : commission.viewerAccountId,
        role: by === "creator" ? "creator" : "viewer",
        kind: "system",
        content:
          by === "creator" ? "The Creator declined this commission." : "The fan withdrew this commission request.",
        metadata: { commissionId: id },
      });
      return storage.getCommission(id);
    },

    /**
     * Hold a finished automatic commission until its delivery is due.
     *
     * The picture is already drawn and promoted, so nothing is being waited on but the clock. The
     * path lives on the row rather than in memory: the wait has to outlive a restart, because the
     * fan has already paid for what is at the end of it.
     */
    async scheduleCommissionDelivery(
      id: string,
      input: { deliverAt: string; mediaPath: string },
    ): Promise<SlurpCommission | null> {
      const commission = await storage.getCommission(id);
      if (!commission || commission.state !== "accepted") return null;
      await db
        .update(slurpCommissions)
        .set({ deliverAt: input.deliverAt, mediaPath: input.mediaPath, updatedAt: now() })
        .where(eq(slurpCommissions.id, id));
      return storage.getCommission(id);
    },

    /**
     * Automatic commissions whose wait is over.
     *
     * `mediaPath` is returned beside the commission rather than on it, so the host path stays out
     * of everything that reaches the client.
     */
    async listDueCommissionDeliveries(
      at: string,
    ): Promise<Array<{ commission: SlurpCommission; mediaPath: string | null }>> {
      const rows = await db.select().from(slurpCommissions).where(eq(slurpCommissions.state, "accepted"));
      return rows
        .filter((row) => {
          const deliverAt = row.deliverAt as string | null;
          return Boolean(deliverAt) && String(deliverAt) <= at;
        })
        .map((row) => ({
          commission: mapCommission(row),
          mediaPath: (row.mediaPath as string | null) ?? null,
        }));
    },

    async deliverCommission(
      id: string,
      content: string,
      imageUrl: string | null = null,
    ): Promise<SlurpCommission | null> {
      const previous = commissionDeliveries.get(id) ?? Promise.resolve(null);
      const current = previous.catch(() => null).then(() => storage.deliverCommissionUnlocked(id, content, imageUrl));
      commissionDeliveries.set(id, current);
      try {
        return await current;
      } finally {
        if (commissionDeliveries.get(id) === current) commissionDeliveries.delete(id);
      }
    },

    async deliverCommissionUnlocked(
      id: string,
      content: string,
      imageUrl: string | null = null,
    ): Promise<SlurpCommission | null> {
      const commission = await storage.getCommission(id);
      if (!commission || commission.state !== "accepted") return commission;
      const message = await storage.sendCreatorMessage(commission.creatorAccountId, commission.viewerAccountId, {
        content,
        kind: "commission_delivery",
        imageUrl,
      });
      if (!message) {
        const settings = await slurp.getSettings();
        if (settings.walletEnabled) {
          await slurp.refundCoins(commission.viewerAccountId, commission.price, "failed commission delivery");
          await slurp.reverseCreatorIncome(commission.creatorAccountId, commission.price, "failed commission delivery");
        }
        // Close it in the same breath as the refund. Leaving it `accepted` left a scheduled
        // delivery due in the past, which the scheduler would retry — and refund — on every poll.
        await db
          .update(slurpCommissions)
          .set({ state: "declined", deliverAt: null, updatedAt: now() })
          .where(eq(slurpCommissions.id, id));
        await storage.appendMessage(commission.threadId, {
          senderAccountId: commission.creatorAccountId,
          role: "creator",
          kind: "system",
          content: "This commission could not be delivered. The payment was refunded.",
          metadata: { commissionId: id },
        });
        return null;
      }
      await db
        .update(slurpCommissions)
        .set({ state: "delivered", deliveryMessageId: message.id, deliverAt: null, updatedAt: now() })
        .where(eq(slurpCommissions.id, id));
      return storage.getCommission(id);
    },

    /**
     * Send as the viewer. Opens the thread when there is none, so the caller never has to know
     * whether this is a first contact or the fortieth message.
     */
    async sendViewerMessage(
      viewerAccountId: string,
      creatorAccountId: string,
      content: string,
      requestId?: string,
    ): Promise<SlurpSendResult> {
      const opened = await storage.openThread(viewerAccountId, creatorAccountId, "viewer");
      if (opened.status !== "ok") return opened;
      if (requestId) {
        const existing = (await storage.listMessages(opened.thread.id)).find(
          (message) => message.role === "viewer" && message.metadata.requestId === requestId,
        );
        if (existing) return { status: "sent", thread: opened.thread, message: existing };
      }
      const message = await storage.appendMessage(opened.thread.id, {
        id: requestId ? `dm:${requestId}:message` : undefined,
        senderAccountId: viewerAccountId,
        role: "viewer",
        content,
        metadata: requestId ? { requestId } : undefined,
      });
      if (!message) return { status: "not_found" };
      await slurp.recordCreatorEvent(creatorAccountId, "message", {
        subjectId: opened.thread.id,
        actorLabel: viewerAccountId,
      });
      // Writing to somebody is engagement, and it reached the funnel nowhere. Every other action
      // advanced the tie, so a fan who wrote daily kept a `lastSeenAt` that never moved and was
      // marked `cooling`, then `burnout`, for doing the most engaged thing available.
      await slurp.advanceAudienceTie(viewerAccountId, creatorAccountId, { stage: "viewer", interactions: 1 });
      const thread = await storage.getThreadById(opened.thread.id);
      return { status: "sent", thread: thread ?? opened.thread, message };
    },

    /**
     * Tip inside a thread. The coins move through the same `tipCreator` the profile page uses,
     * so a DM tip lands in the ledger and in rapport identically to one sent from a profile.
     */
    async tipInThread(
      viewerAccountId: string,
      creatorAccountId: string,
      amount: number,
      note: string,
      requestId?: string,
    ): Promise<SlurpSendResult> {
      if (requestId) {
        const key = `${viewerAccountId}:${creatorAccountId}:${requestId}`;
        const previous = directMessageTips.get(key) ?? Promise.resolve(null);
        const current = previous
          .catch(() => null)
          .then(() => storage.tipInThreadUnlocked(viewerAccountId, creatorAccountId, amount, note, requestId));
        directMessageTips.set(key, current);
        try {
          return await current;
        } finally {
          if (directMessageTips.get(key) === current) directMessageTips.delete(key);
        }
      }
      return storage.tipInThreadUnlocked(viewerAccountId, creatorAccountId, amount, note);
    },

    async tipInThreadUnlocked(
      viewerAccountId: string,
      creatorAccountId: string,
      amount: number,
      note: string,
      requestId?: string,
    ): Promise<SlurpSendResult> {
      const opened = await storage.openThread(viewerAccountId, creatorAccountId, "viewer");
      if (opened.status !== "ok") return opened;
      if (requestId) {
        const existing = (await storage.listMessages(opened.thread.id)).find(
          (message) => message.kind === "tip" && message.metadata.requestId === requestId,
        );
        if (existing) return { status: "sent", thread: opened.thread, message: existing };
      }
      const settings = await slurp.getSettings();
      if (settings.walletEnabled) {
        const charged = await slurp.tipCreator(viewerAccountId, creatorAccountId, amount);
        if (!charged) return { status: "insufficient_funds", required: amount };
      }
      let message: SlurpMessage | null;
      try {
        message = await storage.appendMessage(opened.thread.id, {
          id: requestId ? `dm:${requestId}:tip` : undefined,
          senderAccountId: viewerAccountId,
          role: "viewer",
          kind: "tip",
          content: note,
          price: amount,
          metadata: requestId ? { requestId } : undefined,
        });
      } catch (error) {
        if (settings.walletEnabled) {
          await slurp.refundCoins(viewerAccountId, amount, "failed direct-message tip");
          await slurp.reverseCreatorIncome(creatorAccountId, amount, "failed direct-message tip");
        }
        throw error;
      }
      if (!message) {
        if (settings.walletEnabled) {
          await slurp.refundCoins(viewerAccountId, amount, "failed direct-message tip");
          await slurp.reverseCreatorIncome(creatorAccountId, amount, "failed direct-message tip");
        }
        return { status: "not_found" };
      }
      const thread = await storage.getThreadById(opened.thread.id);
      return { status: "sent", thread: thread ?? opened.thread, message };
    },

    /** Accept or decline a pending request. Only the creator side calls this. */
    async resolveRequest(threadId: string, decision: "accept" | "decline"): Promise<SlurpThread | null> {
      const thread = await storage.getThreadById(threadId);
      if (!thread || thread.state !== "request") return thread;
      await db
        .update(slurpThreads)
        .set({ state: decision === "accept" ? "active" : "declined", updatedAt: now() })
        .where(eq(slurpThreads.id, threadId));
      const resolved = await storage.getThreadById(threadId);
      return resolved;
    },

    /**
     * Record what one generated reply did to the conversation.
     *
     * Mood and notes are written together because they arrive together, on the reply that already
     * ran. Neither costs an extra model call, and neither may fail the reply: a message with good
     * words and no mood is still the thing the fan asked for.
     */
    async recordReplyOutcome(
      threadId: string,
      input: { moodShift: SlurpMoodShift; remember: SlurpNoteOperation[]; stateSignals?: SlurpCreatorStateSignal[] },
    ): Promise<void> {
      const thread = await storage.getThreadById(threadId);
      if (!thread) return;
      const timestamp = now();
      const minutesSinceUpdate = thread.moodUpdatedAt
        ? Math.max(0, (Date.parse(timestamp) - Date.parse(thread.moodUpdatedAt)) / 60_000)
        : 0;
      const mood = applySlurpMood({
        mood: thread.mood,
        shift: input.moodShift,
        rapportScore: thread.rapport.score,
        minutesSinceUpdate,
      });
      await db
        .update(slurpThreads)
        .set({
          mood: String(mood),
          moodUpdatedAt: timestamp,
          notes: JSON.stringify(applySlurpThreadNotes(thread.notes, input.remember)),
          threadState: JSON.stringify(
            applySlurpThreadStateSignals(thread.threadState, input.stateSignals ?? [], timestamp),
          ),
          updatedAt: timestamp,
        })
        .where(eq(slurpThreads.id, threadId));
    },

    /** Coins this fan has put into this Creator: tips, unlocks and commissions together. */
    async spentWithCreator(viewerAccountId: string, creatorAccountId: string): Promise<number> {
      const facts = await storage.rapportFactsFor(viewerAccountId, creatorAccountId);
      return Math.max(0, Math.round(facts.tippedCoins + facts.unlockedCoins));
    },

    /**
     * The thread as the fan is allowed to see it.
     *
     * `slurp-rapport.ts` states the rule this keeps: "The score is never shown in a thread." A
     * number turns a person into a progress bar and teaches the player to farm it. The mood is the
     * same hazard and worse, because it moves fast enough to be tested against.
     *
     * So the fan's copy carries neither, nor the notes, nor the strike count. Stripping it here
     * rather than in the client is what stops the next endpoint leaking it by default.
     */
    forViewer(thread: SlurpThread): SlurpThread {
      return {
        ...thread,
        mood: 0,
        moodUpdatedAt: null,
        strikes: 0,
        lastStrikeAt: null,
        notes: [],
        threadState: { ...SLURP_THREAD_STATE_DEFAULT, updatedAt: thread.updatedAt },
        rapport: { ...thread.rapport, score: 0, contributions: [] },
      };
    },

    /**
     * Carry what happened in public into the conversation.
     *
     * A creator who forgave in the comments what she would not forgive in a direct message would
     * not read as one person, so a comment moves the same number a DM does.
     *
     * ponytail: only lands when a thread already exists. Being rude to somebody you have never
     * written to is dropped; carry it on the audience tie if that gap starts to matter.
     */
    async applyExternalMoodShift(
      viewerAccountId: string,
      creatorAccountId: string,
      shift: SlurpMoodShift,
    ): Promise<void> {
      if (shift === "same") return;
      const thread = await storage.getThread(viewerAccountId, creatorAccountId);
      if (!thread) return;
      await storage.recordReplyOutcome(thread.id, { moodShift: shift, remember: [] });
    },

    /**
     * The creator steps away from this conversation.
     *
     * A strike is recorded at the same time. Two inside `SLURP_STRIKE_WINDOW_DAYS` is what closes
     * the thread for good, so the count and the clock have to move together or a pattern could
     * never be told apart from a bad afternoon.
     */
    async beginCoolOff(threadId: string, hours: number): Promise<void> {
      const thread = await storage.getThreadById(threadId);
      if (!thread) return;
      const timestamp = now();
      await db
        .update(slurpThreads)
        .set({
          coolUntil: new Date(Date.now() + hours * 3_600_000).toISOString(),
          strikes: String(activeSlurpStrikes(thread.strikes, thread.lastStrikeAt) + 1),
          lastStrikeAt: timestamp,
          updatedAt: timestamp,
        })
        .where(eq(slurpThreads.id, threadId));
      await createSlurpReplyQueueStorage(db).removeForThread(threadId);
    },

    /**
     * The creator ends the conversation.
     *
     * `declined` is the state the schema, the localized labels and `admitSlurpThread` already
     * ship, and that guard already refuses to reopen a declined thread even if the fan subscribes.
     * So the hard part was built long before anything could reach it.
     */
    async closeThreadByCreator(threadId: string): Promise<void> {
      const timestamp = now();
      await db
        .update(slurpThreads)
        .set({ state: "declined", coolUntil: null, updatedAt: timestamp })
        .where(eq(slurpThreads.id, threadId));
      await createSlurpReplyQueueStorage(db).removeForThread(threadId);
    },

    /**
     * Wipe the conversation and leave the pair where they started.
     *
     * Everything derived from the messages goes with them: the queued bubbles, the reply claim,
     * the unread counts, the mood and the per-fan state.
     *
     * Memory stays. A clear is the player tidying a chat window, not the creator being made to
     * forget a person they know, and wiping the notes made every clear cost the relationship its
     * whole history. What money bought stays too: spend, unlocks and commissions are ledgered
     * outside this thread and rapport is computed from them.
     *
     * An unfinished commission is closed instead, because nobody is left to deliver against a
     * brief whose conversation is gone, and `clearedAt` hides every commission the chat already
     * showed. The rows remain readable from the commissions panel.
     */
    async resetThread(threadId: string): Promise<void> {
      const timestamp = now();
      await createSlurpReplyQueueStorage(db).removeForThread(threadId);
      for (const row of await db.select().from(slurpMessageClaims).where(eq(slurpMessageClaims.threadId, threadId))) {
        await db.delete(slurpMessageClaims).where(eq(slurpMessageClaims.id, row.id));
      }
      for (const row of await db.select().from(slurpMessages).where(eq(slurpMessages.threadId, threadId))) {
        await db.delete(slurpMessages).where(eq(slurpMessages.id, row.id));
      }
      for (const row of await db.select().from(slurpCommissions).where(eq(slurpCommissions.threadId, threadId))) {
        if (row.state !== "brief" && row.state !== "quoted") continue;
        await db
          .update(slurpCommissions)
          .set({ state: "declined", updatedAt: timestamp })
          .where(eq(slurpCommissions.id, String(row.id)));
      }
      await db
        .update(slurpThreads)
        .set({
          lastMessageAt: timestamp,
          lastMessagePreview: "",
          viewerUnread: "0",
          creatorUnread: "0",
          replyNotBeforeAt: null,
          mood: "0",
          moodUpdatedAt: null,
          coolUntil: null,
          clearedAt: timestamp,
          threadState: "{}",
          strikes: "0",
          lastStrikeAt: null,
          updatedAt: timestamp,
        })
        .where(eq(slurpThreads.id, threadId));
    },

    /**
     * Replace what the creator remembers about this fan.
     *
     * The list is normalized and capped by `readStoredNotes`, the same door the model's own
     * memory writes go through, so a hand-edited memory cannot be longer, more numerous or
     * shaped differently than one the creator wrote herself.
     */
    async setThreadNotes(threadId: string, notes: unknown): Promise<SlurpThreadNote[]> {
      const next = readStoredNotes(notes);
      await db
        .update(slurpThreads)
        .set({ notes: JSON.stringify(next), updatedAt: now() })
        .where(eq(slurpThreads.id, threadId));
      return next;
    },

    /** Clear one side's unread count and stamp the messages the other side sent. */
    async markRead(threadId: string, side: "viewer" | "creator"): Promise<void> {
      const timestamp = now();
      await db
        .update(slurpThreads)
        .set(
          side === "viewer"
            ? { viewerUnread: "0", updatedAt: timestamp }
            : { creatorUnread: "0", updatedAt: timestamp },
        )
        .where(eq(slurpThreads.id, threadId));
      const unread = await db
        .select()
        .from(slurpMessages)
        .where(
          and(eq(slurpMessages.threadId, threadId), eq(slurpMessages.role, side === "viewer" ? "creator" : "viewer")),
        )
        .orderBy(asc(slurpMessages.createdAt));
      for (const row of unread) {
        if (row.readAt) continue;
        await db.update(slurpMessages).set({ readAt: timestamp }).where(eq(slurpMessages.id, row.id));
      }
    },

    /**
     * Claim the right to generate one reply in a thread.
     *
     * At most one reply may be in flight per thread, so a scheduler pass and a live send cannot
     * both answer the same message. Mirrors the creator-reply claim on posts.
     */
  };

  // Messaging tables are newer than some hosts. Reads become empty and writes become no-ops there,
  // so the inbox shows nothing rather than failing; see slurp-host-tables.
  return tolerateMissingTables(storage, {
    getThreadById: () => null,
    getThread: () => null,
    getMessageById: () => null,
    getCommission: () => null,
    listMessages: () => [],
    listThreadsForCreators: () => [],
    listThreadsForViewer: () => [],
    listCommissionsForThread: () => [],
    listOpenCommissionsForCreator: () => [],
    listAutomatedBriefCommissions: () => [],
    listThreadsAwaitingReply: () => [],
    rapportFactsFor: () => emptySlurpRapportFacts(),
    claimReply: () => ({ status: "busy" as const }),
    appendReplyBatch: () => null,
  });
}

export { SLURP_DEFAULT_CREATOR_MESSAGING };
