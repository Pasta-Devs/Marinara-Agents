// ──────────────────────────────────────────────
// Otome Forge: phone threads (plan M3 "Phone server", design: Phone, Private memory)
// ──────────────────────────────────────────────
// One private thread per love interest, `${R}:chat:${li}`, in the shape the kit's forgeChatHistoryPage reads:
//   messages     every message, oldest first: {id, who: "player" | "li", text, sticker?, at, quote?}
//   sessions     the closed conversations in order; session n covers `count` messages from `start`, and holds what he
//                remembers of it (S/phone/memory.ts). The messages after the last one are the open conversation.
//   seenAt       when the newest message the player has seen was sent; his messages after it are unread
// No replies are suggested to the player: they write their own (#2066). A thread saved with suggestions reads without
// them.
// A thread is private: only its own love interest's prompts read it, and its closed sessions reach memory only with
// `audience: [li]` (S/phone/memory.ts phoneMemorySources). His replies (P17) recall as his own reader, and read the
// ledger lines and his grievances and disclosures his own reader may know (S/prompts.ts ownView), so another love
// interest's route, repair or date chapter never reaches him here.
//
// Send (P17) and close (P18) each hold the thread's one write in flight (the kit's withForgeChatSend): a second while
// one runs is a 409 `busy`, and forgeChatReplyBusy shows it on the history page. 0.47.1: a close holds it only while it
// is accepted; its summary runs in the background, and while the thread's `closing` mark says it is remembered, a send
// is a 409 `busy` too (S/phone/memory.ts), and so is a message he would write first (writeFirstIn), so nothing joins a
// conversation once it is being remembered. Her next message after a close that failed clears its mark: the next close
// covers that conversation too. A send saves the player's message
// first, then writes his reply in the run's foreground queue (generation.ts) and appends it only while no reply to that
// message exists yet, so a reply lands once. The client may name its message (`id`): sending the same id again returns
// what was saved, or answers it if its reply never landed. A reply that fails keeps the player's message, and the
// history page offers Retry. Nothing a message says changes the story or the state, but for one thing (#2424): his
// reply to her may say what she wrote hurt him, and once that reply lands the hurt is his grievance with her
// (applyHurts, S/state/relationship.ts applyMessageHurts), which a serious hurt may make his grievance of #2156. A daily message (S/phone/daily.ts,
// he writes first) holds the same lock while it is written in the background lane, so the thread shows him typing.
// Stickers (#2044): a message names a sticker by id (SH/stickers.ts); one saved before names his face and still reads.
// The player may send the protagonist's five and, with images on, his painted ones (S/art/stickers.ts
// sendableStickers; #2477: a friend's in their thread); P17 offers him the same, and his bracketed sticker becomes the
// message's id.
// The group chat (#2154, S/phone/group.ts) is one more thread of this shape, `${R}:chat:group`: its messages name their
// speaker (`li`) and its sessions their members, both display fields. It sends, answers and pages through the same
// helpers (sendIn, answerIn, historyPage, saveSeen) with its own checks and its own prompt.
// #2156: while she is upset with him (LiState.upset, S/phone/upset.ts), P17 tells him so, and offers him once, until
// she takes it back and tells him again, to ask her out to clear the air (inviteOffered): only while he holds no
// grievance of his own and no evening she accepted waits. Whether he asks is his; his invitation rides on his last
// message (`invite`, pending until she answers it in the thread).
// #2424: he may also write first to ask her on a date of his own choosing (reason "date", S/phone/invite.ts): that
// message always carries the invitation, `kind` "date", and is never written while he holds a grievance with her or an
// invitation of his still waits.
// #2504: in his own thread (never a friend's) his messages may hold [note: …] and [selfie: …] (S/phone/replies.ts). His
// notes are kept on his state once his messages land (keepNotes, the newest HIS_NOTES_KEPT); a selfie rides on its
// message (`selfie`). A reply to her saved while his world paints by itself (scene art, Ask before painting off and no
// prompt review) holds it pending, and the send route paints it right after (S/phone/selfie.ts paintSelfies); any
// other waits for the player's Paint. ponytail: a message he writes first is written by a job with no request to say
// whether the player reviews image prompts, so its selfie waits for Paint; the upgrade path is the heartbeat passing
// its review mode to the jobs.
import { randomBytes } from "node:crypto";
import { forgeChatHistoryPage, forgeChatReplyBusy, withForgeChatSend } from "@forge-kit/chat-continuity-server.mjs";
import { forgeChatRecallQuery } from "@forge-kit/story-memory-integration.mjs";
import { z, type ZodType } from "zod";
import type {
  LiId,
  LiState,
  PhoneCloseView,
  PhoneClosing,
  PhoneHistoryPage,
  PhoneListView,
  PhoneMessage,
  PhoneSendResult,
  PhoneSession,
  PhoneThread,
  Unit,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { LIS_MAX } from "../../../../../client/src/features/otome-forge/shared/cast.js";
import { heldAgainst } from "../../../../../client/src/features/otome-forge/shared/dates.js";
import {
  friendHeld,
  friendRankOf,
  type FriendState,
} from "../../../../../client/src/features/otome-forge/shared/friends.js";
import { FACES } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { hapticsOn } from "../../../../../client/src/features/otome-forge/shared/haptics.js";
import { GROUP_THREAD } from "../../../../../client/src/features/otome-forge/shared/home.js";
import { STICKER_ID } from "../../../../../client/src/features/otome-forge/shared/stickers.js";
import { imageConnectionFor } from "../art/image-client.js";
import { sendableStickers, stickerBook, stickerLookup } from "../art/stickers.js";
import { generateJson, runForeground, type GenerationDeps } from "../generation.js";
import type { OtomeHaptics } from "../haptics.js";
import { OtomeForgeError } from "../http.js";
import { chatId, isLiId, runDocTarget, stateId, worldId } from "../ids.js";
import { PaintSchema, isRecord, readFields, validItems } from "../schemas/common.js";
import { HapticCuesSchema } from "../schemas/story.js";
import { defaultLiState, keepNewest, normalizeState, readRun, type RunDocuments } from "../schemas/state.js";
import { normalizeWorld } from "../schemas/world.js";
import type { OtomeStore } from "../store.js";
import { applyFriendHurts } from "../state/friends.js";
import { applyMessageHurts, type MessageHurt } from "../state/relationship.js";
import { listArcs } from "../story/arc.js";
import { recallText, type StoryMemory } from "../story/canon.js";
import { chatReplyMessages, ownView, type ChatFriend } from "../prompts.js";
import { ChatReplySchema, HIS_NOTES_KEPT, normalizeChatReply, type ChatReply, type ReplyStickers } from "./replies.js";

// ── The thread document (its wire shapes are in SH/api-types.ts) ──

/** The `{id, kind, name}` his thread is created with. */
export const chatTarget = (runId: string, li: LiId) => runDocTarget("chat", chatId(runId, li));

/** Messages a history page holds (the plan's page size). */
export const PAGE_SIZE = 80;
/** The open conversation's newest messages P17 reads (GF's chat window). */
export const TAIL_MESSAGES = 16;
/** His newest closed conversations P17 lists in full (and recall leaves out). */
export const LISTED_SESSIONS = 6;
/** A client message id, or one this file makes. */
export const MESSAGE_ID = /^[a-z0-9][a-z0-9-]{7,59}$/;
// What a stored thread may hold: generous beside the prompt limits (S/phone/replies.ts), so a later change of those
// never drops a saved message.
const STORED_TEXT_MAX = 4000;
const STORED_QUOTE_MAX = 1200;

/** The name a session keeps of him (as written then): at most this many characters. */
export const SESSION_NAME_MAX = 200;

// The display fields: one that fails its schema is left out on its own (dropBadFields), so a message or a session is
// never lost to one. A lost message or session would move the closed conversations' boundary, reopen what was
// remembered and forget it.
const LI = z.string().refine(isLiId);
const MESSAGE_DISPLAY = {
  sticker: z.union([z.enum(FACES), z.string().regex(STICKER_ID)]),
  quote: z.string().max(STORED_QUOTE_MAX),
  li: LI,
  invite: z.object({
    status: z.enum(["pending", "accepted", "declined", "lapsed"]),
    scene: z.string().max(120).optional(),
    kind: z.enum(["date", "hangout"]).optional(),
  }),
  haptic: HapticCuesSchema,
  selfie: z.object({ brief: z.string().max(STORED_TEXT_MAX), art: PaintSchema.optional() }),
};
const SESSION_DISPLAY = {
  name: z.string().max(SESSION_NAME_MAX),
  members: z.array(LI).max(LIS_MAX),
  affection: z.number().int().min(1).max(1000),
};

const MessageSchema: ZodType<PhoneMessage> = z.object({
  id: z.string().min(1).max(60),
  who: z.enum(["player", "li"]),
  text: z.string().max(STORED_TEXT_MAX),
  sticker: MESSAGE_DISPLAY.sticker.optional(),
  at: z.string().min(1),
  quote: MESSAGE_DISPLAY.quote.optional(),
  li: MESSAGE_DISPLAY.li.optional(),
  invite: MESSAGE_DISPLAY.invite.optional(),
  haptic: MESSAGE_DISPLAY.haptic.optional(),
  selfie: MESSAGE_DISPLAY.selfie.optional(),
});

const SessionSchema: ZodType<PhoneSession> = z.object({
  start: z.number().int().min(0),
  count: z.number().int().min(1),
  memory: z.object({ text: z.string().max(STORED_TEXT_MAX), quote: z.string().max(STORED_QUOTE_MAX) }),
  closedAt: z.string(),
  name: SESSION_DISPLAY.name.optional(),
  members: SESSION_DISPLAY.members.optional(),
  affection: SESSION_DISPLAY.affection.optional(),
});

/** 0.47.1: the close being remembered (S/phone/memory.ts); one that fails this schema reads as none. */
const ClosingSchema: ZodType<PhoneClosing> = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(1),
  at: z.string().min(1),
  tries: z.number().int().min(0),
  day: z.string().min(1).max(20),
  members: SESSION_DISPLAY.members.optional(),
  error: z.string().max(40).optional(),
});

/** Each stored item without the display fields that fail their schema (common.ts keeps to zod 3 and 4's shared API). */
function dropBadFields(value: unknown, fields: Record<string, { safeParse(raw: unknown): { success: boolean } }>) {
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (!isRecord(item)) return item;
    const kept = { ...item };
    for (const [key, schema] of Object.entries(fields)) {
      if (key in kept && !schema.safeParse(kept[key]).success) delete kept[key];
    }
    return kept;
  });
}

export const emptyThread = (li: LiId = ""): PhoneThread => ({
  version: 1,
  li,
  messages: [],
  sessions: [],
  seenAt: null,
});

/**
 * A stored thread in its full shape. ponytail: every message stays in the one document; the ceiling is a few thousand
 * messages a thread, and the upgrade path is moving closed sessions' messages to documents of their own.
 */
export function normalizeThread(data: unknown): PhoneThread {
  return readFields<PhoneThread>(
    {
      version: () => 1,
      li: z.string(),
      messages: (value) => validItems(MessageSchema, dropBadFields(value, MESSAGE_DISPLAY)),
      sessions: (value) => validItems(SessionSchema, dropBadFields(value, SESSION_DISPLAY)),
      seenAt: z.string().nullable(),
      closing: ClosingSchema.optional(),
    },
    emptyThread,
    isRecord(data) ? data : undefined,
  );
}

/** How many messages the closed conversations hold (forgeChatHistoryPage's archived count). */
export function archivedCount(thread: Pick<PhoneThread, "messages" | "sessions">): number {
  const sum = thread.sessions.reduce((total, session) => total + session.count, 0);
  return Math.min(thread.messages.length, sum);
}

/** The open conversation's messages. */
export const openMessages = (thread: PhoneThread) => thread.messages.slice(archivedCount(thread));

/** 0.47.1: its open conversation is being remembered right now (a close that failed is not). */
export const remembering = (thread: Pick<PhoneThread, "closing"> | null) => !!thread?.closing && !thread.closing.error;

/** 0.47.1: what the list row and the history page say of Close and remember (SH/api-types.ts PhoneCloseView). */
export function closeView(thread: Pick<PhoneThread, "closing" | "sessions">): PhoneCloseView {
  const newest = thread.sessions.at(-1);
  return {
    ...(thread.closing ? { closing: thread.closing.error ? { error: thread.closing.error } : {} } : {}),
    ...(newest
      ? { remembered: { start: newest.start, ...(newest.affection ? { affection: newest.affection } : {}) } }
      : {}),
  };
}

/** His messages the player has not seen. */
export function unreadCount(thread: Pick<PhoneThread, "messages" | "seenAt">): number {
  const seen = thread.seenAt ? Date.parse(thread.seenAt) : Number.NEGATIVE_INFINITY;
  return thread.messages.filter((message) => message.who === "li" && Date.parse(message.at) > seen).length;
}

/** The memory source id of a closed session (S/phone/memory.ts), which P17 lists so recall leaves it out. */
export const sessionSourceId = (li: LiId, session: Pick<PhoneSession, "start">) => `phone-${li}-${session.start}`;

export const readThread = (store: Pick<OtomeStore, "readDoc">, runId: string, li: LiId) =>
  store.readDoc(chatId(runId, li), normalizeThread);

export const newMessageId = (now = Date.now()) => `m-${now.toString(36)}-${randomBytes(4).toString("hex")}`;

const later = (a: string | null, b: string) => (a && Date.parse(a) >= Date.parse(b) ? a : b);

// ── Loading and saving ──

export interface PhoneDeps extends GenerationDeps {
  store: OtomeStore;
  memory?: StoryMemory;
  /** 0.34.0: the toys (S/haptics.ts), whose connected list his reply's prompt names while he holds the remote. */
  haptics?: Pick<OtomeHaptics, "devicesText">;
}

const notFound = (what: string) => new OtomeForgeError(404, `No such ${what}.`, "not-found");
export const conflict = (message: string) => new OtomeForgeError(409, message, "conflict");

/** The run and his unit, or a 404; with `forged`, a 409 while the world is still being forged. */
export async function loadThreadRun(
  deps: Pick<PhoneDeps, "store">,
  runId: string,
  li: LiId,
  { forged = true }: { forged?: boolean } = {},
): Promise<{ run: RunDocuments; unit: Unit; friend?: true }> {
  const run = await readRun(deps.store, runId);
  if (!run) throw notFound("Otome Hearth story");
  // #2458: one of her friends has a thread of their own too.
  const friend = run.state.friends[li] ? run.friends?.find((entry) => entry.id === li) : undefined;
  const unit = friend ?? run.units.find((entry) => entry.id === li);
  if (!unit || (!friend && !run.state.lis[li])) throw notFound("love interest");
  if (forged && run.world.forge.phase !== "ready") throw conflict("The world is still being forged.");
  return friend ? { run, unit, friend: true } : { run, unit };
}

/** #2458: a friend's thread as P17 reads them: their bible and level, and what stands between you. */
function chatFriend(run: RunDocuments, unit: Unit): ChatFriend | undefined {
  const state = run.state.friends[unit.id];
  if (!state || !unit.friend) return undefined;
  return {
    bible: unit.friend,
    level: friendRankOf(state.points, run.state.chapters, unit.id),
    lis: run.units.map(({ id, name }) => ({ id, name })),
    ...(state.grievance ? { grievance: state.grievance.text } : {}),
    ...(state.upset ? { upset: true } : {}),
  };
}

/** #2458: a friend's state as the invitation to clear the air reads a love interest's (inviteOffered). */
const friendInviteState = (friend: FriendState): Parameters<typeof inviteOffered>[0] => ({
  upset: friend.upset,
  asked: friend.asked,
  rupture: friend.grievance ? { grievanceId: "friend", since: friend.grievance.opened } : null,
  // Their grievance stands as a love interest's does, so a held friend never asks her to clear the air.
  grievances: friend.grievance
    ? [
        {
          id: "friend",
          li: "",
          by: "li",
          text: friend.grievance.text,
          severity: "rupture",
          opened: friend.grievance.opened,
          status: "open",
        },
      ]
    : [],
});

/**
 * Applies `change` to his thread, creating it on the first message. A run deleted while this was written may have
 * been swept before the thread was created: the thread is removed again and the request is a 404.
 */
export async function saveThread(
  deps: Pick<PhoneDeps, "store">,
  runId: string,
  li: LiId,
  change: (current: PhoneThread) => PhoneThread,
): Promise<PhoneThread> {
  const gone = async () => !(await deps.store.readDoc(worldId(runId), normalizeWorld));
  let saved: PhoneThread;
  try {
    saved = await deps.store.mutateDoc(chatTarget(runId, li), normalizeThread, (current) => change({ ...current, li }));
  } catch (error) {
    // A change refused because the thread vanished: the run was deleted under it.
    if (await gone()) throw notFound("Otome Hearth story");
    throw error;
  }
  if (await gone()) {
    await deps.store.removeDoc(chatId(runId, li)).catch(() => false);
    throw notFound("Otome Hearth story");
  }
  return saved;
}

/** Runs `operation` as the thread's one send or close in flight; another while it runs is a 409 `busy`. */
export async function inThreadLock<T>(runId: string, li: LiId, operation: () => Promise<T>): Promise<T> {
  const result = await withForgeChatSend(runId, li, async () => ({ done: true as const, value: await operation() }));
  if ("done" in result) return result.value;
  throw new OtomeForgeError(409, "A reply in this thread is still being written.", "busy");
}

// ── Reading ──

/**
 * GET /runs/:run/phone: each love interest's thread in cast order, with its last message and unread count (the route
 * adds the group chat's, S/phone/group.ts groupList).
 */
export async function phoneList(
  deps: Pick<PhoneDeps, "store">,
  runId: string,
): Promise<Pick<PhoneListView, "threads">> {
  const run = await readRun(deps.store, runId);
  if (!run) throw notFound("Otome Hearth story");
  const cast = Object.keys(run.state.lis).filter((li) => run.units.some((unit) => unit.id === li));
  // #2458: her friends' threads follow the love interests'.
  const friends = (run.friends ?? []).map((unit) => unit.id);
  const threads = await Promise.all(
    [...cast, ...friends].map(async (li) => {
      const thread = (await readThread(deps.store, runId, li)) ?? emptyThread(li);
      return {
        li,
        last: thread.messages.at(-1) ?? null,
        unread: unreadCount(thread),
        busy: forgeChatReplyBusy(runId, li),
        ...closeView(thread),
        ...(friends.includes(li) ? { friend: true as const } : {}),
      };
    }),
  );
  return { threads };
}

/** GET /runs/:run/phone/:li?page= */
export async function threadPage(
  deps: Pick<PhoneDeps, "store">,
  runId: string,
  li: LiId,
  page: unknown,
): Promise<PhoneHistoryPage> {
  await loadThreadRun(deps, runId, li, { forged: false });
  return historyPage(deps, runId, li, page);
}

/** A history page of thread `key` (a love interest's, or the group chat's), once its caller has checked it. */
export async function historyPage(
  deps: Pick<PhoneDeps, "store">,
  runId: string,
  key: string,
  page: unknown,
): Promise<PhoneHistoryPage> {
  const thread = (await readThread(deps.store, runId, key)) ?? emptyThread(key);
  const view = forgeChatHistoryPage(thread, page, PAGE_SIZE, forgeChatReplyBusy(runId, key));
  const end = thread.messages.length - (view.page - 1) * PAGE_SIZE;
  return {
    ...view,
    from: Math.max(0, end - PAGE_SIZE),
    sessions: thread.sessions,
    seenAt: thread.seenAt,
    ...closeView(thread),
  };
}

/** POST .../seen {last?}: marks his messages up to `last` (default: the newest) seen. Never moves back. */
export async function markSeen(deps: Pick<PhoneDeps, "store">, runId: string, li: LiId, last?: string): Promise<void> {
  await loadThreadRun(deps, runId, li, { forged: false });
  await saveSeen(deps, runId, li, last);
}

/** markSeen's write on thread `key`, once its caller has checked it. */
export async function saveSeen(deps: Pick<PhoneDeps, "store">, runId: string, key: string, last?: string) {
  await deps.store.updateDoc(chatTarget(runId, key), normalizeThread, (current) => {
    const message = last ? current.messages.find((entry) => entry.id === last) : current.messages.at(-1);
    if (!message) return current;
    const seenAt = later(current.seenAt, message.at);
    return seenAt === current.seenAt ? current : { ...current, seenAt };
  });
}

// ── Sending ──

export interface SendInput {
  text?: string;
  /** The note of the day this replies to. */
  quote?: string;
  /** A sticker id she may send in this thread (S/art/stickers.ts sendableStickers). */
  sticker?: string;
  /** The client's id for this message: sending it again returns what was saved instead of a second message. */
  id?: string;
  /** Answer the messages still waiting for his reply (after one failed) without a new message. */
  retry?: boolean;
  /**
   * 0.34.0: he holds the remote of her toys for about this many more minutes (the client keeps it): his reply may drive
   * them. Read only while the story's haptics are on.
   */
  remote?: number;
}

/** His reply to message `index`: the run of his messages after it, past any more of hers. */
export function replyAfter(thread: PhoneThread, index: number): PhoneMessage[] {
  const rest = thread.messages.slice(index + 1);
  const first = rest.findIndex((message) => message.who === "li");
  if (first < 0) return [];
  const next = rest.findIndex((message, at) => at > first && message.who === "player");
  return rest.slice(first, next < 0 ? undefined : next);
}

/** The stickers P17 offers in his thread, and the names its thread's stickers render with. */
export function replyStickers(runId: string, run: RunDocuments, li: LiId): ReplyStickers {
  const name = stickerLookup(run);
  const { his, yours } = sendableStickers(stickerBook(runId, run), run.world, li);
  const listed = (sticker: { id: string }) => ({ id: sticker.id, ...name(sticker.id)! });
  return { his: his.map(listed), yours: yours.map(listed), name };
}

/**
 * #2156: whether P17 offers him the invitation to clear the air: she is upset with him, he holds no grievance of his
 * own, no evening she accepted waits, and he has not asked since she told him (once an upset: a decline ends it).
 */
export function inviteOffered(
  liState: Pick<LiState, "upset" | "asked" | "rupture" | "grievances">,
  thread: PhoneThread,
) {
  const since = liState.upset ? Date.parse(liState.upset.since) : NaN;
  if (Number.isNaN(since) || liState.asked || heldAgainst(liState)) return false;
  // #2424: only an invitation to clear the air counts; a date he asked her on is another matter.
  return !thread.messages.some((message) => message.invite && !message.invite.kind && Date.parse(message.at) >= since);
}

/** #2424: an invitation of his waiting for her answer in `thread`, of either kind. */
export const inviteWaiting = (thread: PhoneThread) =>
  thread.messages.some((message) => message.who === "li" && message.invite?.status === "pending");

/**
 * #2424: a reply as written: its messages, and the hurts her message gave, which land with the reply (applyHurts).
 * #2504: and his notes, kept once it lands (keepNotes).
 */
export interface Written {
  messages: PhoneMessage[];
  hurt?: MessageHurt[];
  notes?: string[];
}

/**
 * P17 for his thread as read (`thread`, with `run` and his `unit`): his messages, not saved yet, and (#2424) what her
 * message hurt in him, for a reply to her only. The reply to her waits in the run's foreground queue (answer); a daily
 * message (`first`) runs in a background job on that job's connection (`connectionId`, S/phone/daily.ts). Both recall
 * as his own reader, with his knowledge boundary. `reason` "date" (#2424) is his invitation on a date, refused with a
 * 409 `locked` before any call while he holds a grievance with her or an invitation of his waits. `review` (#2504): the
 * player reviews image prompts, so a selfie in a reply to her waits for Paint (see the header).
 */
async function writeReply(
  deps: PhoneDeps,
  runId: string,
  li: LiId,
  { run, unit, thread }: { run: RunDocuments; unit: Unit; thread: PhoneThread },
  {
    debugMode,
    first = false,
    connectionId,
    reason,
    remote: heldFor,
    review = false,
  }: {
    debugMode: boolean;
    first?: boolean;
    connectionId?: string;
    reason?: ChatReason;
    remote?: number;
    review?: boolean;
  },
): Promise<Written> {
  const names = { li: unit.name, player: run.player.name || "the protagonist" };
  const friendState = run.state.friends[li];
  const friend = friendState ? chatFriend(run, unit) : undefined;
  const dating = reason === "date" || reason === "hangout";
  if (
    (dating && (friendState ? friendHeld(friendState) : heldAgainst(run.state.lis[li]))) ||
    (dating && inviteWaiting(thread))
  ) {
    // `locked`, not `conflict`: nothing was written, so the invitation job may try the next one (S/phone/invite.ts).
    throw new OtomeForgeError(409, "He holds a grievance with her, or an invitation of his still waits.", "locked");
  }
  // A date invitation is his whole message: it never also asks her out to clear the air.
  const invite = !dating && inviteOffered(friendState ? friendInviteState(friendState) : run.state.lis[li]!, thread);
  // 0.34.0: only her reply while he holds the remote, never a message he writes first, may drive her toys. Never a
  // friend's (#2458).
  const remote = !first && !friend && heldFor && hapticsOn(run.world) ? Math.round(heldFor) : 0;
  const tail = openMessages(thread).slice(-TAIL_MESSAGES);
  const memories = thread.sessions.slice(-LISTED_SESSIONS);
  const story = await recallText(deps, runId, {
    job: "chat",
    reader: li,
    // #2430: older memories chosen by meaning go after the cached part, which stays the same through a conversation.
    apart: true,
    query: forgeChatRecallQuery(tail, { speakers: [unit.name, run.player.name] }),
    listed: memories.map((session) => sessionSourceId(li, session)),
    debugMode,
  });
  const { liState, offscreen, bondPlayed } = friend
    ? { liState: defaultLiState(), offscreen: "", bondPlayed: 0 }
    : ownView(run.state, li);
  const stickers = replyStickers(runId, run, li);
  const { value } = await generateJson(deps, {
    runId,
    job: "chat",
    label: first ? `phone-daily/${li}` : `phone/${li}`,
    messages: chatReplyMessages({
      world: run.world,
      player: run.player,
      unit,
      liState,
      bondPlayed,
      tail,
      memories,
      story: story.text,
      recalls: story.recalls?.text ?? "",
      offscreen,
      first,
      stickers,
      invite,
      reason,
      ...(remote ? { remote, toys: deps.haptics?.devicesText() ?? "" } : {}),
      ...(friend ? { friend } : {}),
    }),
    memory: story,
    // A conversation's replies come minutes apart, so the five-minute cache, at a cheaper write, carries it (0.20.2).
    cacheTtl: "5m",
    schema: ChatReplySchema,
    normalize: (raw) =>
      normalizeChatReply(raw, names, [...stickers.his, ...stickers.yours], invite, remote > 0, !first, !friend),
    maxTokens: 1200,
    debugMode,
    ...(connectionId ? { lane: "background" as const, connectionId } : { lane: "foreground" as const }),
  });
  // generateJson returns what normalizeChatReply made of the reply.
  const written = value as ChatReply;
  const at = new Date().toISOString();
  const asks = dating
    ? { status: "pending" as const, kind: reason === "hangout" ? ("hangout" as const) : ("date" as const) }
    : { status: "pending" as const };
  // #2504: a selfie in a reply to her is painted right after it lands while his world paints by itself.
  const paints = !first && !review && !run.world.images.ask && !!imageConnectionFor(run.world.images, "scene");
  const messages = written.messages.map((message, index, all): PhoneMessage => ({
    id: newMessageId(),
    who: "li",
    text: message.text,
    ...(message.sticker ? { sticker: message.sticker } : {}),
    at,
    ...((dating || written.invite) && index === all.length - 1 ? { invite: asks } : {}),
    ...(message.haptic?.length ? { haptic: message.haptic } : {}),
    ...(message.selfie
      ? { selfie: { ...message.selfie, ...(paints ? { art: { state: "pending" as const, at } } : {}) } }
      : {}),
  }));
  return {
    messages,
    ...(written.hurt ? { hurt: [{ li, ...written.hurt }] } : {}),
    ...(written.notes ? { notes: written.notes } : {}),
  };
}

/**
 * Why he writes first: she told him she is upset with him (#2156), or he asks her on a date (#2424); #2458: a friend
 * asks her to hang out.
 */
export type ChatReason = "upset" | "date" | "hangout";

/**
 * #2424: the hurts a landed reply named, kept in one revision-checked write of the state (applyMessageHurts) against
 * her message `messageId` in thread `key`: those a hurt was kept for, and those whose grievance with her (#2156) they
 * opened. A write
 * that fails after the reply is saved is logged and lost, as Close and remember's grant is (S/phone/memory.ts): the
 * reply is never written again for it.
 */
async function applyHurts(
  deps: PhoneDeps,
  runId: string,
  key: string,
  messageId: string,
  hurts: readonly MessageHurt[],
): Promise<Pick<Answered, "hurt" | "held">> {
  if (!hurts.length) return { hurt: [], held: [] };
  const ref = `${key === GROUP_THREAD ? "group" : "chat"}/${messageId}`;
  try {
    const arc = (await listArcs(deps.store, runId)).at(-1)?.number ?? 0;
    const at = new Date().toISOString();
    let kept: Pick<Answered, "hurt" | "held"> = { hurt: [], held: [] };
    await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
      const outcome = applyMessageHurts(current, hurts, { ref, at, arc });
      // #2458: a friend's hurt follows a friend's rules (S/state/friends.ts).
      const friends = applyFriendHurts(outcome.state, hurts, { at, arc });
      kept = { hurt: [...outcome.hurt, ...friends.hurt], held: [...outcome.opened, ...friends.opened] };
      return friends.state;
    });
    return kept;
  } catch (error) {
    deps.runtime.logger.warn(
      "[otome-forge] A hurt from her message in %s was not kept: %s",
      key,
      error instanceof Error ? error.message : String(error),
    );
    return { hurt: [], held: [] };
  }
}

/**
 * #2504: the notes his messages wrote, kept on his state once they landed in thread `key` (his own): appended, the
 * newest HIS_NOTES_KEPT kept. A write that fails is logged and lost, as a hurt's is (applyHurts).
 */
async function keepNotes(deps: PhoneDeps, runId: string, key: string, notes: readonly string[]): Promise<void> {
  if (!notes.length) return;
  try {
    const at = new Date().toISOString();
    await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
      const his = current.lis[key];
      if (!his) return current;
      const kept = keepNewest([...(his.notes ?? []), ...notes.map((text) => ({ text, at }))], HIS_NOTES_KEPT);
      return { ...current, lis: { ...current.lis, [key]: { ...his, notes: kept } } };
    });
  } catch (error) {
    deps.runtime.logger.warn(
      "[otome-forge] A note from %s was not kept: %s",
      key,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Writes the reply to the open conversation of thread `key` (`write`, with what `load` read) in the run's foreground
 * queue and appends it, unless a reply to the same message landed first (then that one is returned). The open
 * conversation must end on the player's message. #2424: the hurts a reply that landed names are kept (applyHurts), and
 * `held` names those whose grievance with her they opened; #2504: its notes too (keepNotes).
 */
export function answerIn<T>(
  deps: PhoneDeps,
  runId: string,
  key: string,
  load: () => Promise<T>,
  write: (loaded: T, thread: PhoneThread) => Promise<Written>,
): Promise<Answered> {
  // ponytail: the reply waits behind the run's story writes (the plan's one foreground lane per run); the ceiling is a
  // reply that waits for a lookahead beat, and the upgrade path is a lane of the phone's own.
  return runForeground(runId, async () => {
    // Read once it is this task's turn: his stage or a rupture may have changed while it waited.
    const loaded = await load();
    const thread = (await readThread(deps.store, runId, key)) ?? emptyThread(key);
    const last = openMessages(thread).at(-1);
    if (!last || last.who !== "player") throw conflict("Nothing in this thread is waiting for a reply.");
    const { messages: written, hurt = [], notes = [] } = await write(loaded, thread);
    let kept = written;
    await saveThread(deps, runId, key, (current) => {
      const index = current.messages.findIndex((message) => message.id === last.id);
      if (index < 0 || index < archivedCount(current))
        throw conflict("The thread changed while the reply was written.");
      const theirs = replyAfter(current, index);
      if (theirs.length) {
        kept = theirs;
        return current;
      }
      kept = written;
      return { ...current, messages: [...current.messages, ...written] };
    });
    // Only this request's reply brings its hurts: one that lost to another reply keeps that one's.
    const hurts = kept === written ? await applyHurts(deps, runId, key, last.id, hurt) : { hurt: [], held: [] };
    if (kept === written) await keepNotes(deps, runId, key, notes);
    return { messages: kept, ...hurts };
  });
}

/** What answerIn appended or found, and (#2424) whom the reply's hurts were kept for and whose grievance they opened. */
export interface Answered {
  messages: PhoneMessage[];
  hurt: LiId[];
  held: LiId[];
}

/** His reply (P17) to the open conversation, through answerIn. */
const answer = (deps: PhoneDeps, runId: string, li: LiId, debugMode: boolean, review: boolean, remote?: number) =>
  answerIn(
    deps,
    runId,
    li,
    () => loadThreadRun(deps, runId, li),
    ({ run, unit }, thread) =>
      writeReply(deps, runId, li, { run, unit, thread }, { debugMode, review, ...(remote ? { remote } : {}) }),
  );

/**
 * A daily message (S/phone/daily.ts): he writes first, in a background job on `connectionId`, inside the thread's lock
 * (the caller's inThreadLock). Null, before anything is sent, when the open conversation waits on her message. The
 * message lands after his newest one only while the thread still ends where it was read (a 409 `conflict` drops it),
 * and the player's seenAt is left alone, so it counts as unread. `reason` "upset" (#2156, S/phone/upset.ts): his
 * answer to her telling him she is upset with him, the same way; "date" (#2424, S/phone/invite.ts): his invitation on a
 * date. #2504: his notes are kept once it lands (keepNotes).
 */
export async function writeFirstMessage(
  deps: PhoneDeps,
  runId: string,
  li: LiId,
  { connectionId, debugMode, reason }: { connectionId: string; debugMode: boolean; reason?: ChatReason },
): Promise<PhoneMessage[] | null> {
  let notes: string[] = [];
  const written = await writeFirstIn(
    deps,
    runId,
    li,
    () => loadThreadRun(deps, runId, li),
    async ({ run, unit }, thread) => {
      const reply = await writeReply(
        deps,
        runId,
        li,
        { run, unit, thread },
        { debugMode, first: true, connectionId, reason },
      );
      notes = reply.notes ?? [];
      return reply.messages;
    },
  );
  if (written) await keepNotes(deps, runId, li, notes);
  return written;
}

/**
 * writeFirstMessage's rule for thread `key` (the group chat's squabbles too, S/phone/group.ts): a 409 `busy` while its
 * conversation is being remembered (0.47.1), null when the open conversation waits on her message; otherwise what
 * `write` wrote, appended only while the thread still ends where it was read.
 */
export async function writeFirstIn<T>(
  deps: PhoneDeps,
  runId: string,
  key: string,
  load: () => Promise<T>,
  write: (loaded: T, thread: PhoneThread) => Promise<PhoneMessage[]>,
): Promise<PhoneMessage[] | null> {
  // #2459: a job queued before the story ended writes nothing once it has (no model call, nothing saved).
  if ((await deps.store.readDoc(stateId(runId), normalizeState))?.ended) return null;
  const loaded = await load();
  const thread = (await readThread(deps.store, runId, key)) ?? emptyThread(key);
  // Closed while the job waited: no close is accepted while this holds the thread's lock, so one read is enough.
  if (remembering(thread)) throw stillRemembering();
  if (openMessages(thread).at(-1)?.who === "player") return null;
  const newest = thread.messages.at(-1)?.id ?? null;
  const written = await write(loaded, thread);
  await saveThread(deps, runId, key, (current) => {
    if ((current.messages.at(-1)?.id ?? null) !== newest) {
      throw conflict("The thread changed while his message was written.");
    }
    return { ...current, messages: [...current.messages, ...written] };
  });
  return written;
}

async function send(
  deps: PhoneDeps,
  runId: string,
  li: LiId,
  input: SendInput,
  debugMode: boolean,
  review: boolean,
): Promise<PhoneSendResult> {
  const { run } = await loadThreadRun(deps, runId, li);
  return sendIn(deps, runId, li, input, {
    stickers: () => {
      const { his, yours } = sendableStickers(stickerBook(runId, run), run.world, li);
      return [...his, ...yours].map((sticker) => sticker.id);
    },
    answer: () => answer(deps, runId, li, debugMode, review, input.remote),
  });
}

/** What a send to thread `key` may carry and how it is answered (the group chat's, S/phone/group.ts, too). */
export interface SendTo {
  /** The sticker ids the player may send there. */
  stickers: () => readonly string[];
  /** Writes the reply to the open conversation (answerIn). */
  answer: () => Promise<Answered>;
}

/**
 * The player's message in thread `key`, once its caller has checked the thread, then its reply (`answer`); the same id
 * again returns what was saved, or answers it if its reply never landed.
 */
export async function sendIn(
  deps: PhoneDeps,
  runId: string,
  key: string,
  input: SendInput,
  { stickers, answer }: SendTo,
): Promise<PhoneSendResult> {
  const thread = (await readThread(deps.store, runId, key)) ?? emptyThread(key);
  const named = input.id ? thread.messages.findIndex((message) => message.id === input.id) : -1;
  if (named >= 0) {
    // The same message again (a retried request): what was saved, or his reply now if it never landed.
    const message = thread.messages[named]!;
    if (message.who !== "player") throw conflict("That message id belongs to another message.");
    const reply = replyAfter(thread, named);
    if (reply.length || named < archivedCount(thread)) return { messages: [message, ...reply] };
    if (remembering(thread)) throw stillRemembering();
    return answered([message], await answer());
  }
  // 0.47.1: nothing new goes in, or is answered, while the last conversation is remembered.
  if (remembering(thread)) throw stillRemembering();
  if (input.retry) return answered([], await answer());
  const text = (input.text ?? "").trim();
  if (!text && !input.sticker) throw new OtomeForgeError(400, "Write a message or pick a sticker.", "bad-request");
  if (input.sticker && !stickers().includes(input.sticker))
    throw new OtomeForgeError(400, "That sticker is not one you can send here.", "bad-request");
  const quote = input.quote?.trim();
  const message: PhoneMessage = {
    id: input.id ?? newMessageId(),
    who: "player",
    text,
    ...(input.sticker ? { sticker: input.sticker } : {}),
    at: new Date().toISOString(),
    ...(quote ? { quote } : {}),
  };
  await saveThread(deps, runId, key, (current) => {
    if (current.messages.some((entry) => entry.id === message.id)) return current;
    if (remembering(current)) throw stillRemembering();
    // A close that failed is let go: the conversation goes on, and the next close remembers all of it.
    const { closing: _failed, ...rest } = current;
    return { ...rest, messages: [...current.messages, message], seenAt: later(current.seenAt, message.at) };
  });
  return answered([message], await answer());
}

const stillRemembering = () =>
  new OtomeForgeError(409, "The last conversation in this thread is still being remembered.", "busy");

/** The send's result: what it saved, then the reply, and (#2424) whose grievance with her the reply opened. */
const answered = (before: PhoneMessage[], { messages, hurt, held }: Answered): PhoneSendResult => ({
  messages: [...before, ...messages],
  ...(hurt.length ? { hurt } : {}),
  ...(held.length ? { held } : {}),
});

/**
 * POST .../send: the player's message, then his reply (P17). One send or close per thread at a time (409 `busy`).
 * `review` (#2504): the player reviews image prompts (writeReply).
 */
export function sendMessage(
  deps: PhoneDeps,
  runId: string,
  li: LiId,
  input: SendInput,
  { debugMode = false, review = false }: { debugMode?: boolean; review?: boolean } = {},
): Promise<PhoneSendResult> {
  return inThreadLock(runId, li, () => send(deps, runId, li, input, debugMode, review));
}
