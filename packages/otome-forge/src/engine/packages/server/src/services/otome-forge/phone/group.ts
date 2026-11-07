// ──────────────────────────────────────────────
// Otome Forge: the group chat (#2154), one thread with every love interest the protagonist has met
// ──────────────────────────────────────────────
// `${R}:chat:group` is a phone thread of the usual shape (S/phone/chat.ts) whose messages name their speaker (`li`) and
// whose closed sessions name their members. It sends, answers, pages and closes through the DM thread's helpers, with
// its own checks, its own prompt (P17g, S/prompts.ts groupChatMessages) and P18's group wording.
// - Who is in it: the love interests met, in cast order. One of the starting cast (their unit was written with the
//   world, so it shares the world's createdAt) is met once any chapter but the prologue is read, as daily messages
//   count it; a newcomer once the first chapter of the arc that brings them in (`newcomer.li`) is read, so one who
//   arrives again after a failed arrival, or whose arc is still being planned, is not in it yet. Nobody else is ever
//   named in its prompt, its contract or its sessions. It opens with two members: until then the list's `group` is
//   null and its routes are a 409 `conflict`. A love interest in a rupture stays in it; their card says how they are.
// - The player's message is always answered (the maintainer's, 2026-11-07): whoever it is addressed to answers, anyone
//   named answers, the others join when it is in character, and at least one answers (a reply with nothing in it, or
//   with nothing from a member the newest message names, gets the repair turn). No quota counts it. A failed reply
//   keeps the message, and the page offers Ask again. Only the protagonist's five stickers can be sent there, and no
//   note is quoted (Home's Reply stays in his own thread).
// - Squabbles: Settings → Connections sets how many times a day the members may start squabbling there on their own
//   (world.groupSquabbles, 0 to DAILY_MESSAGES_MAX; absent or 0, the default, is off). The daily-message heartbeat
//   (POST /runs/:run/phone/due) answers for it too (groupDue), by daily messages' own rule (dailyDecision: armed a
//   minute after a visit starts, spread 24 h / limit apart, reset at local midnight, an attempt spent before any
//   provider work and never retried), on world.groupDaily, with heartbeats of its own. None is armed or written while
//   the group is open, a reply or a close is being written there, the open conversation ends on the player's message,
//   or it has fewer than two members; the job checks all of that again once it is admitted, and drops (the slot stays
//   spent). The job is a background job on the Messages connection, inside the thread's lock (so the thread shows
//   someone typing), and lands unread, only while the thread still ends where it was read. Two members picked at random
//   start it; the others may join.
// - Close and remember: one P18 call with the group wording, one session with its members, and no affection.
//   ponytail: the group remembers only through Close and remember, so squabbles pile up in the open conversation and
//   only its newest GROUP_TAIL_MESSAGES reach P17g, and none reaches a DM or a scene until it is closed. The upgrade
//   path is one background compress call at the first heartbeat of a new local day while the group has an open
//   conversation.
// - Privacy: a closed group session is a `chat` source with `audience: [...members, "group"]` (S/phone/memory.ts
//   phoneMemorySources): each member's own readers (their DMs, daily messages, Home notes, games with them) and scenes
//   with a member in them recall it, as private between its members and the protagonist; never a later member, anyone
//   else's reader, or the overview. P17g recalls as reader "group": the shared story and the group's own sessions,
//   never a DM, a date, a Read Him or Claw round, a Snapshot, a notebook or a love interest's own chapter. What stands
//   between each member and the protagonist is what the whole cast may know (S/prompts.ts sharedState): no grievance
//   or disclosure from a love interest's own chapter, since one call writes every member and all of them read it. The
//   open conversation reaches only P17g.
import { forgeChatReplyBusy } from "@forge-kit/chat-continuity-server.mjs";
import { forgeChatRecallQuery } from "@forge-kit/story-memory-integration.mjs";
import type {
  LiId,
  PhoneCloseResult,
  PhoneDueResult,
  PhoneHistoryPage,
  PhoneListView,
  PhoneMessage,
  PhoneSendResult,
  PhoneThread,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { GROUP_THREAD } from "../../../../../client/src/features/otome-forge/shared/home.js";
import { sendableStickers, stickerBook, stickerLookup } from "../art/stickers.js";
import { generateJson, resolveConnectionId } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { PROLOGUE_KEY, mainChapterKey, runDocTarget, worldId } from "../ids.js";
import { groupChatMessages, nameList, renderThread, chatMemoryMessages, sharedState } from "../prompts.js";
import { defaultLiState, readRun, type RunDocuments } from "../schemas/state.js";
import { normalizeWorld } from "../schemas/world.js";
import { listArcs } from "../story/arc.js";
import { recallText } from "../story/canon.js";
import {
  answerIn,
  conflict,
  emptyThread,
  historyPage,
  inThreadLock,
  newMessageId,
  openMessages,
  readThread,
  saveSeen,
  sendIn,
  sessionSourceId,
  unreadCount,
  writeFirstIn,
  LISTED_SESSIONS,
  type PhoneDeps,
  type SendInput,
} from "./chat.js";
import {
  dailyDecision,
  metLis,
  noteOpenThread,
  openThread,
  shuffled,
  type DailyDecision,
  type DailyDeps,
} from "./daily.js";
import { sessionName, summarizeOpen } from "./memory.js";
import {
  GroupReplySchema,
  normalizeChatMemory,
  normalizeGroupReply,
  type GroupSpeaker,
  type ReplySticker,
} from "./replies.js";

/** The open conversation's newest messages P17g reads. */
export const GROUP_TAIL_MESSAGES = 24;
/** The group opens with this many members. */
export const GROUP_MIN_MEMBERS = 2;
/** P17g's room: a reply, and a squabble of up to eight messages. */
const REPLY_TOKENS = 2000;
const SQUABBLE_TOKENS = 2400;

export const groupJobKey = (runId: string) => `${runId}:group-squabble`;

/** The love interests in the group chat now, in cast order (see the header). */
export async function groupMembers(deps: Pick<PhoneDeps, "store">, runId: string, run: RunDocuments) {
  if (run.world.forge.phase !== "ready") return [];
  const { chapters } = run.state;
  const read = (key: string) => !!chapters[key]?.completed;
  const anyRead = Object.keys(chapters).some((key) => key !== PROLOGUE_KEY && read(key));
  const cast = metLis(run);
  const original = (li: LiId) => run.units.find((unit) => unit.id === li)?.createdAt === run.world.createdAt;
  if (!anyRead) return [];
  const arcs = cast.every(original) ? [] : await listArcs(deps.store, runId);
  return cast.filter((li) => {
    if (original(li)) return true;
    const arc = arcs.filter((entry) => entry.newcomer?.li === li).at(-1);
    return !!arc && read(mainChapterKey(arc.from));
  });
}

/** The run and the group's members, or a 404; a 409 while the world is forged or until two are met. */
async function loadGroup(deps: Pick<PhoneDeps, "store">, runId: string) {
  const run = await readRun(deps.store, runId);
  if (!run) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
  if (run.world.forge.phase !== "ready") throw conflict("The world is still being forged.");
  const members = await groupMembers(deps, runId, run);
  if (members.length < GROUP_MIN_MEMBERS) throw conflict("The group chat opens once you have met two love interests.");
  return { run, members };
}

const unitsOf = (run: RunDocuments, members: readonly LiId[]) =>
  members.flatMap((li) => run.units.filter((unit) => unit.id === li));

// ── Reading ──

/** GET /runs/:run/phone: the threads (S/phone/chat.ts phoneList's), and the group chat's row once it is open. */
export async function groupList(
  deps: Pick<PhoneDeps, "store">,
  runId: string,
  threads: PhoneListView["threads"],
): Promise<PhoneListView> {
  const run = await readRun(deps.store, runId);
  const members = run ? await groupMembers(deps, runId, run) : [];
  if (members.length < GROUP_MIN_MEMBERS) return { threads, group: null };
  const thread = (await readThread(deps.store, runId, GROUP_THREAD)) ?? emptyThread(GROUP_THREAD);
  return {
    threads,
    group: {
      members,
      last: thread.messages.at(-1) ?? null,
      unread: unreadCount(thread),
      busy: forgeChatReplyBusy(runId, GROUP_THREAD),
    },
  };
}

/** GET /runs/:run/phone/group?page= : its history page, with its members. Marks it open (no squabble starts there). */
export async function groupPage(
  deps: Pick<PhoneDeps, "store">,
  runId: string,
  page: unknown,
): Promise<PhoneHistoryPage> {
  const { members } = await loadGroup(deps, runId);
  noteOpenThread(runId, GROUP_THREAD);
  return { ...(await historyPage(deps, runId, GROUP_THREAD, page)), members };
}

/** POST /runs/:run/phone/group/seen {last?} */
export async function groupSeen(deps: Pick<PhoneDeps, "store">, runId: string, last?: string): Promise<void> {
  await loadGroup(deps, runId);
  await saveSeen(deps, runId, GROUP_THREAD, last);
}

// ── Writing (P17g) ──

/** The stickers P17g offers each member (their own sendable ones) and everyone (the protagonist's). */
function groupStickers(runId: string, run: RunDocuments, members: readonly LiId[]) {
  const name = stickerLookup(run);
  const book = stickerBook(runId, run);
  const listed = (sticker: { id: string }): ReplySticker => ({ id: sticker.id, ...name(sticker.id)! });
  return {
    name,
    yours: sendableStickers(book, run.world).yours.map(listed),
    own: new Map(members.map((li) => [li, sendableStickers(book, run.world, li).his.map(listed)])),
  };
}

/**
 * The members' messages for the group as read (`thread`, with `run` and its `members`), not saved yet: a reply to the
 * player in the run's foreground queue, or a squabble (`squabble`, the two who start it) in a background job on
 * `connectionId`.
 */
async function writeGroup(
  deps: PhoneDeps,
  runId: string,
  { run, members, thread }: { run: RunDocuments; members: readonly LiId[]; thread: PhoneThread },
  { debugMode, squabble, connectionId }: { debugMode: boolean; squabble?: readonly LiId[]; connectionId?: string },
): Promise<PhoneMessage[]> {
  const units = unitsOf(run, members);
  const player = run.player.name || "the protagonist";
  const tail = openMessages(thread).slice(-GROUP_TAIL_MESSAGES);
  const memories = thread.sessions.slice(-LISTED_SESSIONS);
  const story = await recallText(deps, runId, {
    job: "chat",
    reader: GROUP_THREAD,
    query: forgeChatRecallQuery(tail, { speakers: [...units.map((unit) => unit.name), run.player.name] }),
    listed: memories.map((session) => sessionSourceId(GROUP_THREAD, session)),
    debugMode,
  });
  const stickers = groupStickers(runId, run, members);
  const speakers: GroupSpeaker[] = units.map((unit) => ({
    id: unit.id,
    name: unit.name,
    stickers: stickers.own.get(unit.id) ?? [],
  }));
  const name = (li: LiId) => units.find((unit) => unit.id === li)?.name ?? "";
  const { value } = await generateJson(deps, {
    runId,
    job: "chat",
    label: squabble ? "phone-group/squabble" : "phone-group/reply",
    messages: groupChatMessages({
      world: run.world,
      player: run.player,
      members: units.map((unit) => ({
        unit,
        // Everyone in the group reads all of it, so as the whole cast may know it (see the header).
        liState: sharedState(run.state.lis[unit.id] ?? defaultLiState()),
        stickers: stickers.own.get(unit.id) ?? [],
      })),
      yours: stickers.yours,
      stickerName: stickers.name,
      tail,
      memories,
      story: story.text,
      ...(squabble ? { squabble: squabble.map(name) } : {}),
    }),
    memory: story,
    schema: GroupReplySchema,
    normalize: (raw) =>
      normalizeGroupReply(
        raw,
        { player, members: speakers, yours: stickers.yours },
        squabble ? { squabble: true } : { answering: tail.at(-1)?.text ?? "" },
      ),
    maxTokens: squabble ? SQUABBLE_TOKENS : REPLY_TOKENS,
    debugMode,
    ...(connectionId ? { lane: "background" as const, connectionId } : { lane: "foreground" as const }),
  });
  // generateJson returns what normalizeGroupReply made of the reply.
  const written = value as unknown as { messages: Array<{ li: LiId; text: string; sticker?: string }> };
  const at = new Date().toISOString();
  return written.messages.map((message) => ({
    id: newMessageId(),
    who: "li",
    text: message.text,
    ...(message.sticker ? { sticker: message.sticker } : {}),
    at,
    li: message.li,
  }));
}

/** POST /runs/:run/phone/group/send {text?, sticker?, id?, retry?}: the player's message, then the members' reply. */
export function sendToGroup(
  deps: PhoneDeps,
  runId: string,
  input: Omit<SendInput, "quote">,
  { debugMode = false }: { debugMode?: boolean } = {},
): Promise<PhoneSendResult> {
  return inThreadLock(runId, GROUP_THREAD, async () => {
    const { run } = await loadGroup(deps, runId);
    return sendIn(deps, runId, GROUP_THREAD, input, {
      stickers: () => sendableStickers(stickerBook(runId, run), run.world).yours.map((sticker) => sticker.id),
      answer: () =>
        answerIn(
          deps,
          runId,
          GROUP_THREAD,
          () => loadGroup(deps, runId),
          ({ run: now, members }, thread) => writeGroup(deps, runId, { run: now, members, thread }, { debugMode }),
        ),
    });
  });
}

/** POST /runs/:run/phone/group/close: Close and remember with the group wording; it earns nothing. */
export function closeGroup(
  deps: PhoneDeps,
  runId: string,
  { debugMode = false }: { debugMode?: boolean } = {},
): Promise<PhoneCloseResult> {
  return inThreadLock(runId, GROUP_THREAD, async () => {
    const { run, members } = await loadGroup(deps, runId);
    const units = unitsOf(run, members);
    const group = units.map((unit) => unit.name);
    const names = { li: "Someone", player: run.player.name || "the protagonist" };
    const speaker = (message: PhoneMessage) => units.find((unit) => unit.id === message.li)?.name;
    const closed = await summarizeOpen(deps, runId, GROUP_THREAD, debugMode, {
      label: "phone-group-memory",
      render: (open) => renderThread(open, names, "told", stickerLookup(run), speaker),
      messages: (conversation) => chatMemoryMessages({ world: run.world, names, conversation, group }),
      normalize: (raw, conversation) => normalizeChatMemory(raw, names, conversation, group),
      session: { name: sessionName(nameList(group)), members: [...members] },
    });
    if (closed.open) void Promise.resolve(deps.memory?.maintain({ runId, debugMode })).catch(() => undefined);
    return { memory: closed.memory, grants: [] };
  });
}

// ── Squabbles ──

/** Each run's last heartbeat for the group (epoch ms), and the runs whose heartbeat is being answered. */
const heartbeats = new Map<string, number>();
const answering = new Set<string>();

/** Whether a squabble may start in the group now (see the header): its members when it may, else null. */
async function squabbleFree(deps: Pick<PhoneDeps, "store">, runId: string, run: RunDocuments) {
  if (openThread(runId) === GROUP_THREAD || forgeChatReplyBusy(runId, GROUP_THREAD)) return null;
  const members = await groupMembers(deps, runId, run);
  if (members.length < GROUP_MIN_MEMBERS) return null;
  const thread = await readThread(deps.store, runId, GROUP_THREAD);
  return thread && openMessages(thread).at(-1)?.who === "player" ? null : members;
}

/**
 * The squabbles' half of POST /runs/:run/phone/due {open?} (see the header): one heartbeat, which may spend today's next
 * attempt and queue its job.
 */
export async function groupDue(
  deps: DailyDeps,
  runId: string,
  {
    open,
    debugMode = false,
    now = Date.now(),
    random = Math.random,
  }: { open?: LiId | null; debugMode?: boolean; now?: number; random?: () => number } = {},
): Promise<NonNullable<PhoneDueResult["group"]>> {
  if (open !== undefined) noteOpenThread(runId, open);
  const run = await readRun(deps.store, runId);
  if (!run) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
  const latest = run.world.groupDaily?.last ?? null;
  const result = (status: PhoneDueResult["status"]) => ({ status, latest });
  const limit = run.world.groupSquabbles ?? 0;
  const { background } = deps;
  if (!limit || !background) return result("disabled");
  const connectionId = resolveConnectionId(run.world, "chat");
  if (!connectionId) return result("no-connection");
  const key = groupJobKey(runId);
  if (answering.has(runId) || background.has(key)) return result("busy");
  answering.add(runId);
  try {
    if (!(await squabbleFree(deps, runId, run))) return result("no-eligible");
    const seen = heartbeats.get(runId);
    heartbeats.set(runId, now);
    const first = dailyDecision(run.world.groupDaily, { now, seen, limit });
    if (!("next" in first)) return result(first.status);
    // Decided again on the stored world, so a write that landed meanwhile (a settings save) counts.
    let decided: DailyDecision = first;
    const saved = await deps.store.updateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (current) => {
      decided = dailyDecision(current.groupDaily, { now, seen, limit: current.groupSquabbles ?? 0 });
      return "next" in decided ? { ...current, groupDaily: decided.next } : current;
    });
    if (!saved) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
    if (decided.status !== "queued") return result(decided.status);
    background.ensure({
      key,
      connectionId,
      run: () => writeSquabble(deps, runId, { connectionId, debugMode, random }),
    });
    return result("queued");
  } finally {
    answering.delete(runId);
  }
}

/** The job: checks again (see the header), then two members start squabbling; a dropped one keeps its slot spent. */
async function writeSquabble(
  deps: DailyDeps,
  runId: string,
  { connectionId, debugMode, random }: { connectionId: string; debugMode: boolean; random: () => number },
): Promise<void> {
  const drop = (why: string) => deps.runtime.logger.info("[otome-forge] A group chat squabble was dropped: %s", why);
  let sent: PhoneMessage[] | null;
  try {
    sent = await inThreadLock(runId, GROUP_THREAD, () =>
      writeFirstIn(
        deps,
        runId,
        GROUP_THREAD,
        async () => {
          const run = await readRun(deps.store, runId);
          // Opened, or answered, while the job waited for admission (the lock is this job's own now).
          const members = run && openThread(runId) !== GROUP_THREAD ? await groupMembers(deps, runId, run) : [];
          if (!run || members.length < GROUP_MIN_MEMBERS) throw conflict("the group is open or has too few members");
          return { run, members };
        },
        ({ run, members }, thread) =>
          writeGroup(
            deps,
            runId,
            { run, members, thread },
            { debugMode, connectionId, squabble: shuffled(members, random).slice(0, 2) },
          ),
      ),
    );
  } catch (error) {
    if (error instanceof OtomeForgeError && (error.code === "busy" || error.code === "conflict")) {
      drop(error.message);
      return;
    }
    throw error;
  }
  if (!sent?.length) {
    drop("the player's message is waiting for a reply");
    return;
  }
  const at = sent.at(-1)!.at;
  await deps.store.updateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (current) => ({
    ...current,
    groupDaily: { days: current.groupDaily?.days ?? {}, last: { li: GROUP_THREAD, at } },
  }));
}
