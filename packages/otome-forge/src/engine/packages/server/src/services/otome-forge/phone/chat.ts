// ──────────────────────────────────────────────
// Otome Forge: phone threads (plan M3 "Phone server", design: Phone, Private memory)
// ──────────────────────────────────────────────
// One private thread per love interest, `${R}:chat:${li}`, in the shape the kit's forgeChatHistoryPage reads:
//   messages     every message, oldest first: {id, who: "player" | "li", text, sticker?, at, quote?}
//   sessions     the closed conversations in order; session n covers `count` messages from `start`, and holds what he
//                remembers of it (S/phone/memory.ts). The messages after the last one are the open conversation.
//   seenAt       when the newest message the player has seen was sent; his messages after it are unread
//   suggestions  the replies offered after his latest message (cleared by the next send or close)
// A thread is private: only its own love interest's prompts read it, and its closed sessions reach memory only with
// `audience: [li]` (S/phone/memory.ts phoneMemorySources). His replies (P17) recall as his own reader, and read the
// ledger lines and his grievances and disclosures his own reader may know (story/prompts.ts ownView), so another love
// interest's route, repair or date chapter never reaches him here.
//
// Send (P17) and close (P18) each hold the thread's one write in flight (the kit's withForgeChatSend): a second while
// one runs is a 409 `busy`, and forgeChatReplyBusy shows it on the history page. A send saves the player's message
// first, then writes his reply in the run's foreground queue (generation.ts) and appends it only while no reply to that
// message exists yet, so a reply lands once. The client may name its message (`id`): sending the same id again returns
// what was saved, or answers it if its reply never landed. A reply that fails keeps the player's message, and the
// history page offers Retry. Nothing a message says changes the story or the state.
import { randomBytes } from "node:crypto";
import { forgeChatHistoryPage, forgeChatReplyBusy, withForgeChatSend } from "@forge-kit/chat-continuity-server.mjs";
import { forgeChatRecallQuery } from "@forge-kit/story-memory-integration.mjs";
import { z, type ZodType } from "zod";
import type {
  LiId,
  PhoneHistoryPage,
  PhoneListView,
  PhoneMessage,
  PhoneSendResult,
  PhoneSession,
  PhoneThread,
  Unit,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { FACES, type Face } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { generateJson, runForeground, type GenerationDeps } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { chatId, runDocTarget, worldId } from "../ids.js";
import { isRecord, readFields, validItems } from "../schemas/common.js";
import { readRun, type RunDocuments } from "../schemas/state.js";
import { normalizeWorld } from "../schemas/world.js";
import type { OtomeStore } from "../store.js";
import { recallText, type CanonBudget, type StoryMemory } from "../story/canon.js";
import { ownView } from "../story/prompts.js";
import { ChatReplySchema, SUGGESTIONS_MAX, chatReplyMessages, normalizeChatReply, type ChatReply } from "./prompts.js";

// ── The thread document (its wire shapes are in SH/api-types.ts) ──

/** The `{id, kind, name}` his thread is created with. */
export const chatTarget = (runId: string, li: LiId) => runDocTarget("chat", chatId(runId, li));

/** Messages a history page holds (the plan's page size). */
export const PAGE_SIZE = 80;
/** The open conversation's newest messages P17 reads (GF's chat window). */
export const TAIL_MESSAGES = 16;
/** His newest closed conversations P17 lists in full (and recall leaves out). */
export const LISTED_SESSIONS = 6;
/**
 * The canon P17 reads in full: the latest chapter's end, and the canon before it when memory cannot answer; his newest
 * route, repair or date chapter goes in even when it is longer, as its end (S/story/canon.ts newestWithin). The
 * overview, the recalled details (older conversations among them) and the decisions always go in whole: the kit sizes
 * recall to the connection's context, as GF's chat fits its memory by dropping details, never by cutting the text.
 */
export const CHAT_CANON_BUDGET: CanonBudget = { latest: 2000, earlier: 2000 };
/** A client message id, or one this file makes. */
export const MESSAGE_ID = /^[a-z0-9][a-z0-9-]{7,59}$/;
// What a stored thread may hold: generous beside the prompt limits (S/phone/prompts.ts), so a later change of those
// never drops a saved message.
const STORED_TEXT_MAX = 4000;
const STORED_QUOTE_MAX = 1200;

/** The name a session keeps of him (as written then): at most this many characters. */
export const SESSION_NAME_MAX = 200;

// The display fields: one that fails its schema is left out on its own (dropBadFields), so a message or a session is
// never lost to one. A lost message or session would move the closed conversations' boundary, reopen what was
// remembered and forget it.
const MESSAGE_DISPLAY = { sticker: z.enum(FACES), quote: z.string().max(STORED_QUOTE_MAX) };
const SESSION_DISPLAY = { name: z.string().max(SESSION_NAME_MAX) };

const MessageSchema: ZodType<PhoneMessage> = z.object({
  id: z.string().min(1).max(60),
  who: z.enum(["player", "li"]),
  text: z.string().max(STORED_TEXT_MAX),
  sticker: MESSAGE_DISPLAY.sticker.optional(),
  at: z.string().min(1),
  quote: MESSAGE_DISPLAY.quote.optional(),
});

const SessionSchema: ZodType<PhoneSession> = z.object({
  start: z.number().int().min(0),
  count: z.number().int().min(1),
  memory: z.object({ text: z.string().max(STORED_TEXT_MAX), quote: z.string().max(STORED_QUOTE_MAX) }),
  closedAt: z.string(),
  name: SESSION_DISPLAY.name.optional(),
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
  suggestions: [],
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
      suggestions: (value) => validItems(z.string().max(200), value, SUGGESTIONS_MAX),
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
}

const notFound = (what: string) => new OtomeForgeError(404, `No such ${what}.`, "not-found");
export const conflict = (message: string) => new OtomeForgeError(409, message, "conflict");

/** The run and his unit, or a 404; with `forged`, a 409 while the world is still being forged. */
export async function loadThreadRun(
  deps: Pick<PhoneDeps, "store">,
  runId: string,
  li: LiId,
  { forged = true }: { forged?: boolean } = {},
): Promise<{ run: RunDocuments; unit: Unit }> {
  const run = await readRun(deps.store, runId);
  if (!run) throw notFound("Otome Forge run");
  const unit = run.units.find((entry) => entry.id === li);
  if (!unit || !run.state.lis[li]) throw notFound("love interest");
  if (forged && run.world.forge.phase !== "ready") throw conflict("The world is still being forged.");
  return { run, unit };
}

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
    if (await gone()) throw notFound("Otome Forge run");
    throw error;
  }
  if (await gone()) {
    await deps.store.removeDoc(chatId(runId, li)).catch(() => false);
    throw notFound("Otome Forge run");
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

/** GET /runs/:run/phone: each love interest's thread in cast order, with its last message and unread count. */
export async function phoneList(deps: Pick<PhoneDeps, "store">, runId: string): Promise<PhoneListView> {
  const run = await readRun(deps.store, runId);
  if (!run) throw notFound("Otome Forge run");
  const cast = Object.keys(run.state.lis).filter((li) => run.units.some((unit) => unit.id === li));
  const threads = await Promise.all(
    cast.map(async (li) => {
      const thread = (await readThread(deps.store, runId, li)) ?? emptyThread(li);
      return {
        li,
        last: thread.messages.at(-1) ?? null,
        unread: unreadCount(thread),
        busy: forgeChatReplyBusy(runId, li),
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
  const thread = (await readThread(deps.store, runId, li)) ?? emptyThread(li);
  const view = forgeChatHistoryPage(thread, page, PAGE_SIZE, forgeChatReplyBusy(runId, li));
  const end = thread.messages.length - (view.page - 1) * PAGE_SIZE;
  return {
    ...view,
    from: Math.max(0, end - PAGE_SIZE),
    sessions: thread.sessions,
    suggestions: thread.suggestions,
    seenAt: thread.seenAt,
  };
}

/** POST .../seen {last?}: marks his messages up to `last` (default: the newest) seen. Never moves back. */
export async function markSeen(deps: Pick<PhoneDeps, "store">, runId: string, li: LiId, last?: string): Promise<void> {
  await loadThreadRun(deps, runId, li, { forged: false });
  await deps.store.updateDoc(chatTarget(runId, li), normalizeThread, (current) => {
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
  sticker?: Face;
  /** The client's id for this message: sending it again returns what was saved instead of a second message. */
  id?: string;
  /** Answer the messages still waiting for his reply (after one failed) without a new message. */
  retry?: boolean;
}

/** His reply to message `index`: the run of his messages after it, past any more of hers. */
function replyAfter(thread: PhoneThread, index: number): PhoneMessage[] {
  const rest = thread.messages.slice(index + 1);
  const first = rest.findIndex((message) => message.who === "li");
  if (first < 0) return [];
  const next = rest.findIndex((message, at) => at > first && message.who === "player");
  return rest.slice(first, next < 0 ? undefined : next);
}

/**
 * Writes his reply to the open conversation (P17) in the run's foreground queue and appends it, unless a reply to the
 * same message landed first (then that one is returned). The open conversation must end on the player's message.
 */
async function answer(
  deps: PhoneDeps,
  runId: string,
  li: LiId,
  debugMode: boolean,
): Promise<{ reply: PhoneMessage[]; suggestions: string[] }> {
  // ponytail: the reply waits behind the run's story writes (the plan's one foreground lane per run); the ceiling is a
  // reply that waits for a lookahead beat, and the upgrade path is a lane of the phone's own.
  return runForeground(runId, async () => {
    // Read once it is this task's turn: his stage or a rupture may have changed while it waited.
    const { run, unit } = await loadThreadRun(deps, runId, li);
    const thread = (await readThread(deps.store, runId, li)) ?? emptyThread(li);
    const open = openMessages(thread);
    const last = open.at(-1);
    if (!last || last.who !== "player") throw conflict("Nothing in this thread is waiting for a reply.");
    const names = { li: unit.name, player: run.player.name || "the protagonist" };
    const tail = open.slice(-TAIL_MESSAGES);
    const memories = thread.sessions.slice(-LISTED_SESSIONS);
    const story = await recallText(deps, runId, {
      job: "chat",
      reader: li,
      query: forgeChatRecallQuery(tail, { speakers: [unit.name, run.player.name] }),
      listed: memories.map((session) => sessionSourceId(li, session)),
      debugMode,
      budget: CHAT_CANON_BUDGET,
    });
    const { liState, offscreen } = ownView(run.state, li);
    const { value } = await generateJson(deps, {
      runId,
      job: "chat",
      label: `phone/${li}`,
      messages: chatReplyMessages({
        world: run.world,
        player: run.player,
        unit,
        liState,
        tail,
        memories,
        story,
        offscreen,
      }),
      schema: ChatReplySchema,
      normalize: (raw) => normalizeChatReply(raw, names),
      temperature: 0.95,
      maxTokens: 1200,
      debugMode,
      lane: "foreground",
    });
    // generateJson returns what normalizeChatReply made of the reply.
    const written = value as ChatReply;
    const at = new Date().toISOString();
    const reply: PhoneMessage[] = written.messages.map((message) => ({
      id: newMessageId(),
      who: "li",
      text: message.text,
      ...(message.sticker ? { sticker: message.sticker } : {}),
      at,
    }));
    let kept = { reply, suggestions: written.suggestions };
    await saveThread(deps, runId, li, (current) => {
      const index = current.messages.findIndex((message) => message.id === last.id);
      if (index < 0 || index < archivedCount(current))
        throw conflict("The thread changed while the reply was written.");
      const theirs = replyAfter(current, index);
      if (theirs.length) {
        kept = { reply: theirs, suggestions: current.suggestions };
        return current;
      }
      kept = { reply, suggestions: written.suggestions };
      return { ...current, messages: [...current.messages, ...reply], suggestions: written.suggestions };
    });
    return kept;
  });
}

async function send(
  deps: PhoneDeps,
  runId: string,
  li: LiId,
  input: SendInput,
  debugMode: boolean,
): Promise<PhoneSendResult> {
  await loadThreadRun(deps, runId, li);
  const thread = (await readThread(deps.store, runId, li)) ?? emptyThread(li);
  const named = input.id ? thread.messages.findIndex((message) => message.id === input.id) : -1;
  if (named >= 0) {
    // The same message again (a retried request): what was saved, or his reply now if it never landed.
    const message = thread.messages[named]!;
    if (message.who !== "player") throw conflict("That message id belongs to another message.");
    const reply = replyAfter(thread, named);
    const newest = reply.length > 0 && reply.at(-1) === thread.messages.at(-1);
    if (reply.length || named < archivedCount(thread)) {
      return { messages: [message, ...reply], suggestions: newest ? thread.suggestions : [] };
    }
    const answered = await answer(deps, runId, li, debugMode);
    return { messages: [message, ...answered.reply], suggestions: answered.suggestions };
  }
  if (input.retry) {
    const answered = await answer(deps, runId, li, debugMode);
    return { messages: answered.reply, suggestions: answered.suggestions };
  }
  const text = (input.text ?? "").trim();
  if (!text && !input.sticker) throw new OtomeForgeError(400, "Write a message or pick a sticker.", "bad-request");
  const quote = input.quote?.trim();
  const message: PhoneMessage = {
    id: input.id ?? newMessageId(),
    who: "player",
    text,
    ...(input.sticker ? { sticker: input.sticker } : {}),
    at: new Date().toISOString(),
    ...(quote ? { quote } : {}),
  };
  await saveThread(deps, runId, li, (current) =>
    current.messages.some((entry) => entry.id === message.id)
      ? current
      : {
          ...current,
          messages: [...current.messages, message],
          suggestions: [],
          seenAt: later(current.seenAt, message.at),
        },
  );
  const answered = await answer(deps, runId, li, debugMode);
  return { messages: [message, ...answered.reply], suggestions: answered.suggestions };
}

/** POST .../send: the player's message, then his reply (P17). One send or close per thread at a time (409 `busy`). */
export function sendMessage(
  deps: PhoneDeps,
  runId: string,
  li: LiId,
  input: SendInput,
  { debugMode = false }: { debugMode?: boolean } = {},
): Promise<PhoneSendResult> {
  return inThreadLock(runId, li, () => send(deps, runId, li, input, debugMode));
}
