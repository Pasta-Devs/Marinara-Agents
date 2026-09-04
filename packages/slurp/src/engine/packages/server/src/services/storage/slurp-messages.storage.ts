// ──────────────────────────────────────────────
// Storage: Slurp direct messages
// ──────────────────────────────────────────────
//
// Its own module rather than more of `slurp.storage.ts`, which is already past five thousand
// lines. It composes that storage for accounts, subscriptions, and the wallet instead of
// reimplementing them, so a DM tip and a profile tip move coins through exactly one code path.
import { and, asc, desc, eq } from "../../db/file-query.js";
import { newId } from "../../utils/id-generator.js";
import type { DB } from "../../db/connection.js";
import { isFileUniqueConstraintError } from "../../db/file-schema.js";
import { slurpCommissions, slurpMessageClaims, slurpMessages, slurpThreads } from "../../db/schema/slurp.js";
import { createAppSettingsStorage } from "./app-settings.storage.js";
import { createSlurpStorage } from "./slurp.storage.js";
import {
  admitSlurpThread,
  readSlurpCreatorMessaging,
  slurpMessagePreview,
  SLURP_CREATOR_MESSAGING_KEY,
  SLURP_DEFAULT_CREATOR_MESSAGING,
  type SlurpCreatorMessaging,
  type SlurpMessageKind,
  type SlurpThreadState,
} from "../slurp/slurp-messaging.js";
import {
  emptySlurpRapportFacts,
  scoreSlurpRapport,
  type SlurpRapport,
  type SlurpRapportFacts,
} from "../slurp/slurp-rapport.js";

export type SlurpMessage = {
  id: string;
  threadId: string;
  senderAccountId: string;
  role: "viewer" | "creator";
  kind: SlurpMessageKind;
  content: string;
  imageUrl: string | null;
  price: number;
  unlockedAt: string | null;
  readAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type SlurpThread = {
  id: string;
  viewerAccountId: string;
  creatorAccountId: string;
  state: SlurpThreadState;
  openedBy: "viewer" | "creator";
  requestFeePaid: number;
  lastMessageAt: string;
  lastMessagePreview: string;
  viewerUnread: number;
  creatorUnread: number;
  replyNotBeforeAt: string | null;
  rapport: SlurpRapport;
  createdAt: string;
  updatedAt: string;
};

/** A thread as the inbox renders it: the row plus the creator it belongs to. */
export type SlurpThreadView = SlurpThread & {
  creatorHandle: string;
  creatorDisplayName: string;
  creatorAvatarUrl: string | null;
  subscribed: boolean;
};

export type SlurpCommission = {
  id: string;
  threadId: string;
  viewerAccountId: string;
  creatorAccountId: string;
  state: "brief" | "quoted" | "accepted" | "declined" | "delivered";
  brief: string;
  price: number;
  deliveryMessageId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SlurpSendResult =
  | { status: "sent"; thread: SlurpThread; message: SlurpMessage }
  | { status: "closed" }
  | { status: "insufficient_funds"; required: number }
  | { status: "not_found" };

const now = () => new Date().toISOString();
const messageUnlocks = new Map<string, Promise<SlurpMessage | null>>();
const int = (value: string | null | undefined, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
};
const json = (value: string | null | undefined): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const DAY = 86_400_000;

export function createSlurpMessagesStorage(db: DB) {
  const slurp = createSlurpStorage(db);
  const settingsStore = createAppSettingsStorage(db);

  const readMessagingBlob = async (): Promise<Record<string, unknown>> =>
    json(await settingsStore.get(SLURP_CREATOR_MESSAGING_KEY));

  const mapMessage = (row: Record<string, unknown>): SlurpMessage => ({
    id: String(row.id),
    threadId: String(row.threadId),
    senderAccountId: String(row.senderAccountId),
    role: row.role === "creator" ? "creator" : "viewer",
    kind: String(row.kind) as SlurpMessageKind,
    content: String(row.content ?? ""),
    imageUrl: (row.imageUrl as string | null) ?? null,
    price: int(row.price as string),
    unlockedAt: (row.unlockedAt as string | null) ?? null,
    readAt: (row.readAt as string | null) ?? null,
    metadata: json(row.metadata as string),
    createdAt: String(row.createdAt),
  });

  const mapThread = (row: Record<string, unknown>): SlurpThread => ({
    id: String(row.id),
    viewerAccountId: String(row.viewerAccountId),
    creatorAccountId: String(row.creatorAccountId),
    state: String(row.state) as SlurpThreadState,
    openedBy: row.openedBy === "creator" ? "creator" : "viewer",
    requestFeePaid: int(row.requestFeePaid as string),
    lastMessageAt: String(row.lastMessageAt),
    lastMessagePreview: String(row.lastMessagePreview ?? ""),
    viewerUnread: int(row.viewerUnread as string),
    creatorUnread: int(row.creatorUnread as string),
    replyNotBeforeAt: (row.replyNotBeforeAt as string | null) ?? null,
    rapport: readStoredRapport(json(row.rapport as string)),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  });
  const mapCommission = (row: Record<string, unknown>): SlurpCommission => ({
    id: String(row.id),
    threadId: String(row.threadId),
    viewerAccountId: String(row.viewerAccountId),
    creatorAccountId: String(row.creatorAccountId),
    state: String(row.state) as SlurpCommission["state"],
    brief: String(row.brief),
    price: int(row.price as string),
    deliveryMessageId: (row.deliveryMessageId as string | null) ?? null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  });

  /**
   * The cached rapport is a display convenience. A blob written by an older build, or by hand,
   * must render as a cold thread rather than throw the whole inbox away.
   */
  function readStoredRapport(raw: Record<string, unknown>): SlurpRapport {
    const score = typeof raw.score === "number" ? raw.score : 0;
    return {
      score,
      tier: (typeof raw.tier === "string" ? raw.tier : "stranger") as SlurpRapport["tier"],
      contributions: Array.isArray(raw.contributions) ? (raw.contributions as SlurpRapport["contributions"]) : [],
    };
  }

  const storage = {
    /** Per-creator messaging settings, falling back to the shipped defaults. */
    async getCreatorMessaging(creatorAccountId: string): Promise<SlurpCreatorMessaging> {
      return readSlurpCreatorMessaging((await readMessagingBlob())[creatorAccountId]);
    },

    async setCreatorMessaging(
      creatorAccountId: string,
      patch: Partial<SlurpCreatorMessaging>,
    ): Promise<SlurpCreatorMessaging> {
      const blob = await readMessagingBlob();
      const next = readSlurpCreatorMessaging({ ...readSlurpCreatorMessaging(blob[creatorAccountId]), ...patch });
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
     * Rebuild the rapport for one pair from the ledger and the thread itself.
     *
     * Computed rather than incremented: a counter that drifts is a counter nobody can debug, and
     * the inputs are all small reads the send path already pays for.
     */
    async rapportFor(viewerAccountId: string, creatorAccountId: string): Promise<SlurpRapport> {
      const [messaging, creator] = await Promise.all([
        storage.getCreatorMessaging(creatorAccountId),
        slurp.getNoodlerAccountById(creatorAccountId),
      ]);
      const facts = await storage.rapportFactsFor(viewerAccountId, creatorAccountId, creator?.handle ?? null);
      return scoreSlurpRapport(facts, messaging.rapportWeights);
    },

    async rapportFactsFor(
      viewerAccountId: string,
      creatorAccountId: string,
      creatorHandle: string | null,
    ): Promise<SlurpRapportFacts> {
      const facts = emptySlurpRapportFacts();
      const wallet = await slurp.getWallet(viewerAccountId);
      const subscription = wallet.subscriptions[creatorAccountId];
      const subscriptions = await slurp.listSubscriptionsForViewer(viewerAccountId);
      const active = subscriptions.find((entry) => entry.creatorAccountId === creatorAccountId);
      facts.subscribed = Boolean(active);
      facts.subscribedDays = active ? Math.max(0, (Date.now() - Date.parse(active.createdAt)) / DAY) : 0;

      // The ledger notes carry the creator handle, which is what makes per-creator totals possible
      // without a second table. A creator with no handle can only be scored on thread history.
      for (const entry of wallet.ledger) {
        if (!creatorHandle || !entry.note || !entry.note.includes(creatorHandle)) continue;
        if (entry.kind === "tip") facts.tippedCoins += Math.abs(entry.amount);
        if (entry.kind === "unlock") facts.unlockedCoins += Math.abs(entry.amount);
      }

      const thread = await storage.getThread(viewerAccountId, creatorAccountId);
      if (thread) {
        const messages = await storage.listMessages(thread.id, 500);
        const fromViewer = messages.filter((message) => message.role === "viewer" && message.kind !== "tip");
        facts.viewerMessages = fromViewer.length;
        facts.creatorMessages = messages.filter((message) => message.role === "creator").length;
        facts.averageViewerMessageLength =
          fromViewer.length === 0
            ? 0
            : fromViewer.reduce((sum, message) => sum + message.content.length, 0) / fromViewer.length;
        const last = fromViewer[fromViewer.length - 1];
        facts.daysSinceViewerMessage = last ? Math.max(0, (Date.now() - Date.parse(last.createdAt)) / DAY) : null;
        for (const message of messages) {
          if (message.kind === "tip" && message.role === "viewer") facts.tippedCoins += message.price;
          if (message.kind === "ppv" && message.unlockedAt) facts.unlockedCoins += message.price;
          if (message.kind === "commission_delivery") facts.commissionsDelivered += 1;
        }
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
        senderAccountId: string;
        role: "viewer" | "creator";
        kind?: SlurpMessageKind;
        content?: string;
        imageUrl?: string | null;
        price?: number;
        unlockedAt?: string | null;
        metadata?: Record<string, unknown>;
      },
    ): Promise<SlurpMessage | null> {
      const thread = await storage.getThreadById(threadId);
      if (!thread) return null;
      const kind = input.kind ?? "text";
      const content = input.content ?? "";
      const price = Math.max(0, Math.trunc(input.price ?? 0));
      const timestamp = now();
      const message = {
        id: newId(),
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
        createdAt: timestamp,
      };
      await db.insert(slurpMessages).values(message);
      const rapport = await storage.rapportFor(thread.viewerAccountId, thread.creatorAccountId);
      await db
        .update(slurpThreads)
        .set({
          lastMessageAt: timestamp,
          lastMessagePreview: slurpMessagePreview(kind, content, price),
          // The reader is whoever did not send. A creator reply clears nothing the viewer owes.
          viewerUnread: input.role === "creator" ? String(thread.viewerUnread + 1) : String(thread.viewerUnread),
          creatorUnread: input.role === "viewer" ? String(thread.creatorUnread + 1) : String(thread.creatorUnread),
          replyNotBeforeAt: input.role === "creator" ? null : thread.replyNotBeforeAt,
          rapport: JSON.stringify(rapport),
          updatedAt: timestamp,
        })
        .where(eq(slurpThreads.id, threadId));
      return mapMessage(message);
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
      if (!thread || thread.viewerAccountId !== viewerAccountId || Number(row.price ?? 0) <= 0) return null;
      if (row.unlockedAt) return mapMessage(row);
      const price = int(row.price as string);
      const settings = await slurp.getSettings();
      if (settings.walletEnabled) {
        const charged = await slurp.spendCoins(viewerAccountId, "ppv", price, thread.creatorAccountId);
        if (!charged) return null;
        try {
          await slurp.creditCreatorIncome(thread.creatorAccountId, price, "ppv");
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
      input: { content: string; kind?: SlurpMessageKind; price?: number; metadata?: Record<string, unknown> },
    ): Promise<SlurpMessage | null> {
      if (!(await slurp.getViewer(viewerAccountId))) return null;
      const opened = await storage.openThread(viewerAccountId, creatorAccountId, "creator");
      if (opened.status !== "ok") return null;
      return storage.appendMessage(opened.thread.id, {
        senderAccountId: creatorAccountId,
        role: "creator",
        content: input.content,
        kind: input.kind,
        price: input.price,
        metadata: input.metadata,
      });
    },

    async createCommission(
      viewerAccountId: string,
      creatorAccountId: string,
      brief: string,
    ): Promise<SlurpCommission | null> {
      const opened = await storage.openThread(viewerAccountId, creatorAccountId, "viewer");
      if (opened.status !== "ok") return null;
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

    async getCommission(id: string): Promise<SlurpCommission | null> {
      const rows = await db.select().from(slurpCommissions).where(eq(slurpCommissions.id, id));
      return rows[0] ? mapCommission(rows[0]) : null;
    },

    async quoteCommission(id: string, price: number): Promise<SlurpCommission | null> {
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
      await slurp.creditCreatorIncome(commission.creatorAccountId, commission.price, "commission");
      await db.update(slurpCommissions).set({ state: "accepted", updatedAt: now() }).where(eq(slurpCommissions.id, id));
      return storage.getCommission(id);
    },

    async deliverCommission(id: string, content: string): Promise<SlurpCommission | null> {
      const commission = await storage.getCommission(id);
      if (!commission || commission.state !== "accepted") return commission;
      const message = await storage.sendCreatorMessage(commission.creatorAccountId, commission.viewerAccountId, {
        content,
        kind: "commission_delivery",
      });
      if (!message) {
        const settings = await slurp.getSettings();
        if (settings.walletEnabled) {
          await slurp.refundCoins(commission.viewerAccountId, commission.price, "failed commission delivery");
          await slurp.reverseCreatorIncome(commission.creatorAccountId, commission.price, "failed commission delivery");
        }
        return null;
      }
      await db
        .update(slurpCommissions)
        .set({ state: "delivered", deliveryMessageId: message.id, updatedAt: now() })
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
    ): Promise<SlurpSendResult> {
      const opened = await storage.openThread(viewerAccountId, creatorAccountId, "viewer");
      if (opened.status !== "ok") return opened;
      const message = await storage.appendMessage(opened.thread.id, {
        senderAccountId: viewerAccountId,
        role: "viewer",
        content,
      });
      if (!message) return { status: "not_found" };
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
    ): Promise<SlurpSendResult> {
      const opened = await storage.openThread(viewerAccountId, creatorAccountId, "viewer");
      if (opened.status !== "ok") return opened;
      const settings = await slurp.getSettings();
      if (settings.walletEnabled) {
        const charged = await slurp.tipCreator(viewerAccountId, creatorAccountId, amount);
        if (!charged) return { status: "insufficient_funds", required: amount };
      }
      const message = await storage.appendMessage(opened.thread.id, {
        senderAccountId: viewerAccountId,
        role: "viewer",
        kind: "tip",
        content: note,
        price: amount,
      });
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
    async claimReply(
      threadId: string,
      triggerMessageId: string,
      creatorAccountId: string,
    ): Promise<{ status: "claimed"; claimId: string } | { status: "busy" }> {
      const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();
      const stale = await db
        .select()
        .from(slurpMessageClaims)
        .where(
          and(eq(slurpMessageClaims.threadId, threadId), eq(slurpMessageClaims.creatorAccountId, creatorAccountId)),
        );
      for (const row of stale) {
        if (row.claimedAt < staleBefore) await db.delete(slurpMessageClaims).where(eq(slurpMessageClaims.id, row.id));
      }
      try {
        const id = newId();
        await db
          .insert(slurpMessageClaims)
          .values({ id, threadId, triggerMessageId, creatorAccountId, replyMessageId: null, claimedAt: now() });
        return { status: "claimed", claimId: id };
      } catch (error) {
        if (!isFileUniqueConstraintError(error, "slurp_message_claims", ["threadId"])) throw error;
        return { status: "busy" };
      }
    },

    async releaseReplyClaim(claimId: string): Promise<void> {
      await db.delete(slurpMessageClaims).where(eq(slurpMessageClaims.id, claimId));
    },

    async setReplyNotBefore(threadId: string, value: string | null): Promise<void> {
      await db
        .update(slurpThreads)
        .set({ replyNotBeforeAt: value, updatedAt: now() })
        .where(eq(slurpThreads.id, threadId));
    },

    /** Threads waiting on a queued reply, oldest first, for the scheduler. */
    async listThreadsAwaitingReply(limit = 20): Promise<SlurpThread[]> {
      const rows = await db
        .select()
        .from(slurpThreads)
        .where(eq(slurpThreads.state, "active"))
        .orderBy(asc(slurpThreads.lastMessageAt))
        .limit(limit);
      const nowMs = Date.now();
      return rows
        .map(mapThread)
        .filter(
          (thread) =>
            thread.creatorUnread > 0 && (!thread.replyNotBeforeAt || Date.parse(thread.replyNotBeforeAt) <= nowMs),
        );
    },
  };

  return storage;
}

export { SLURP_DEFAULT_CREATOR_MESSAGING };
