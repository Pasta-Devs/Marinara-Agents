// ──────────────────────────────────────────────
// Storage: Slurp direct messages
// ──────────────────────────────────────────────
//
// Its own module rather than more of `slurp.storage.ts`, which is already past five thousand
// lines. It composes that storage for accounts, subscriptions, and the wallet instead of
// reimplementing them, so a DM tip and a profile tip move coins through exactly one code path.
import { tolerateMissingTables } from "./slurp-host-tables.js";
import { and, asc, desc, eq, inArray } from "../../db/file-query.js";
import { newId } from "../../utils/id-generator.js";
import type { DB } from "../../db/connection.js";
import { isFileUniqueConstraintError } from "../../db/file-schema.js";
import { slurpCommissions, slurpMessageClaims, slurpMessages, slurpThreads } from "../../db/schema/slurp.js";
import { applySlurpMood, type SlurpMoodShift } from "../slurp/slurp-mood.js";
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
  /** How this conversation is going, -100 to 100. See `slurp-mood.ts`. */
  mood: number;
  moodUpdatedAt: string | null;
  /** While in the future, the creator has stepped away from this conversation. */
  coolUntil: string | null;
  strikes: number;
  lastStrikeAt: string | null;
  /** Short facts the creator knows about this fan, oldest first. */
  notes: string[];
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
  /** When the automatic delivery is due, when one is scheduled. Null on a hand-delivered piece. */
  deliverAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SlurpSendResult =
  | { status: "sent"; thread: SlurpThread; message: SlurpMessage }
  | { status: "closed" }
  | { status: "insufficient_funds"; required: number }
  | { status: "not_found" };

/**
 * How many facts one thread keeps.
 *
 * A prompt has a budget, and a dossier that grows without limit spends all of it on trivia from
 * eighteen months ago instead of the conversation in front of it.
 */
export const SLURP_THREAD_NOTE_LIMIT = 24;

const now = () => new Date().toISOString();
const messageUnlocks = new Map<string, Promise<SlurpMessage | null>>();
const commissionAccepts = new Map<string, Promise<SlurpCommission | null>>();
const commissionSettlements = new Map<string, Promise<SlurpCommission | null>>();
const commissionDeliveries = new Map<string, Promise<SlurpCommission | null>>();
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
    mood: Number.isFinite(Number(row.mood)) ? Number(row.mood) : 0,
    moodUpdatedAt: (row.moodUpdatedAt as string | null) ?? null,
    coolUntil: (row.coolUntil as string | null) ?? null,
    strikes: int(row.strikes as string),
    lastStrikeAt: (row.lastStrikeAt as string | null) ?? null,
    notes: readStoredNotes(row.notes),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  });

  /**
   * Notes are generated text written by an earlier reply. A blob written by an older build, or by
   * hand, must render as a thread with no notes rather than throw the whole inbox away.
   */
  function readStoredNotes(raw: unknown): string[] {
    if (typeof raw !== "string" || !raw.trim()) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }
  const mapCommission = (row: Record<string, unknown>): SlurpCommission => ({
    id: String(row.id),
    threadId: String(row.threadId),
    viewerAccountId: String(row.viewerAccountId),
    creatorAccountId: String(row.creatorAccountId),
    state: String(row.state) as SlurpCommission["state"],
    brief: String(row.brief),
    price: int(row.price as string),
    deliveryMessageId: (row.deliveryMessageId as string | null) ?? null,
    deliverAt: (row.deliverAt as string | null) ?? null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  });
  // `mediaPath` is deliberately absent from `SlurpCommission`: it is a path on the host's disk,
  // and the mapped row is sent to the client.

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
      return scoreSlurpRapport(facts, messaging.rapportWeights);
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
          // A reply is an acceptance in practice. This matters most for "Let them answer": the
          // model may write the Creator's first reply from the request tray, and leaving the row
          // pending after that reply made the next fan turn look open while automation refused to
          // continue it. Admission policy gates the first contact, not a conversation the Creator
          // has already joined.
          state: input.role === "creator" && thread.state === "request" ? "active" : thread.state,
          lastMessageAt: timestamp,
          lastMessagePreview: slurpMessagePreview(kind, content, price),
          // The reader is whoever did not send. A creator reply clears nothing the viewer owes.
          viewerUnread: input.role === "creator" ? String(thread.viewerUnread + 1) : String(thread.viewerUnread),
          // Writing a reply means having read what it answers, so a creator message clears the
          // creator's own count. This used to leave it standing, and nothing else clears it
          // server-side — `markRead` is only ever called from the routes the player's own UI hits.
          // So a thread the creator had already answered stayed "awaiting reply" forever:
          // `listThreadsAwaitingReply` returned it every minute, the scheduler then skipped it
          // because the newest message was the creator's own, and the creator-side badge never
          // cleared. A production thread sat at five unread with the creator's reply on top.
          creatorUnread: input.role === "viewer" ? String(thread.creatorUnread + 1) : "0",
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
    ): Promise<SlurpSendResult> {
      const opened = await storage.openThread(viewerAccountId, creatorAccountId, "viewer");
      if (opened.status !== "ok") return opened;
      const message = await storage.appendMessage(opened.thread.id, {
        senderAccountId: viewerAccountId,
        role: "viewer",
        content,
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

    /**
     * Record what one generated reply did to the conversation.
     *
     * Mood and notes are written together because they arrive together, on the reply that already
     * ran. Neither costs an extra model call, and neither may fail the reply: a message with good
     * words and no mood is still the thing the fan asked for.
     */
    async recordReplyOutcome(
      threadId: string,
      input: { moodShift: SlurpMoodShift; remember: string[] },
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
      // Oldest first, deduplicated, capped. A conversation that runs for months would otherwise
      // grow an unbounded dossier and push everything else out of the prompt.
      // ponytail: FIFO cap, swap for relevance ranking or decay if threads get long enough to need it.
      const notes = [...thread.notes];
      for (const note of input.remember) {
        if (!notes.some((existing) => existing.toLowerCase() === note.toLowerCase())) notes.push(note);
      }
      await db
        .update(slurpThreads)
        .set({
          mood: String(mood),
          moodUpdatedAt: timestamp,
          notes: JSON.stringify(notes.slice(-SLURP_THREAD_NOTE_LIMIT)),
          updatedAt: timestamp,
        })
        .where(eq(slurpThreads.id, threadId));
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

    /** Active conversations and pending requests waiting on a queued reply, oldest first. */
    async listThreadsAwaitingReply(limit = 20): Promise<SlurpThread[]> {
      const rows = await db
        .select()
        .from(slurpThreads)
        .where(inArray(slurpThreads.state, ["active", "request"]))
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
  });
}

export { SLURP_DEFAULT_CREATOR_MESSAGING };
