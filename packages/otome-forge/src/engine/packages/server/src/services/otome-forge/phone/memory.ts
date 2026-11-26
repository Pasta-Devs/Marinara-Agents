// ──────────────────────────────────────────────
// Otome Forge: Close and remember, and the phone's memory sources (plan M3 "Phone server", design: Private memory)
// ──────────────────────────────────────────────
// Close and remember turns the open conversation into a session: P18 writes what he will remember of it (2 to 4
// sentences, for his prompts; the thread shows only that he remembers it and the line quoted from it), the session is
// appended once, and he earns Close and remember's affection (SH/economy.ts, within the per-LI daily cap for
// everything outside the story; S/state/rewards.ts grant).
// 0.47.1: the summary runs in the background, so the player goes back to Messages at once (the maintainer's request).
// - The close is accepted in the thread's one write in flight, as a send is (S/phone/chat.ts inThreadLock): its checks,
//   then the thread's `closing` mark (the open conversation's range, when, the player's local day, and in the group
//   its members), saved before it answers `{remembering: true}`. While the mark stands, a send is a 409 `busy`, and so
//   is a message written first there (S/phone/chat.ts writeFirstIn; the heartbeat arms none for that thread meanwhile),
//   and Close again answers the same.
// - The summary is a background-queue job keyed by the thread, under foreground admission (the player's own request,
//   which never waits for an idle connection), on the connection P18 has always used (job `compress`). It reads the
//   run when it starts, so it never waits in the run's foreground queue behind a lookahead beat, and the next beat never
//   waits behind it. Its writes are revision-checked and applied again to the latest thread or state, so a seen mark or
//   a story write meanwhile is never lost.
// - Each summary started is counted on the mark before its call. The queue lives in this process, so a read of the list
//   or the thread finds a mark with no job here (a restart) and queues it again (resumeClose): it summarizes once more,
//   and a mark that two summaries never landed fails as "stopped". A session already there is only unmarked, even with
//   no connection, so a conversation is never remembered twice. A read whose requeue fails still answers.
// - It lands in three writes: the session, then the affection (the state's own revision-checked write), then the mark
//   comes off with the affection kept on the session, which the page that sent the close shows once. A grant that
//   fails, or a restart between them, loses the affection and never pays it twice. Taking the mark off is tried
//   SETTLE_TRIES times; if it still fails, the mark stays with no error, and the next read only unmarks it.
// - A summary that fails before its session is saved leaves the conversation open and the mark with its error code,
//   which the list and the thread show with Try again (Close again). Her next message lets it go (S/phone/chat.ts
//   sendIn). A saved session is never marked failed, even when the write that saved it rejects afterwards (saveThread's
//   check that the story is still there): the close goes on and is paid as usual.
// - P18 is a summary: like every summary it gets generateJson's output room (at least 10240 tokens when the connection
//   allows it); its wanted length is in its prompt's wording.
// - With nothing open, Close returns the newest memory and earns nothing. A conversation with nothing from one of them
//   earns nothing. A story that has ended is refused by S/routes/ended.ts; a job that finds it ended calls no model and
//   leaves the conversation as it was.
// - New sessions start memory upkeep in the background, which records them for recall, and so does a session a restart
//   left marked, when its job takes the mark off.
// phoneMemorySources turns every closed session into a `chat` memory source with `audience: [li]`: only his own
// readers, and scenes he is in, recall it, and it never reaches the shared overview. Its title says it is private, so a
// scene with others in it knows they were not there. S/memory/sources.ts adds it to the run's sources. Care data is
// never a source.
// The group chat (#2154, S/phone/group.ts) closes the same way, with P18's group wording, and earns nothing. Its
// sessions are `chat` sources with `audience: [...members, "group"]`: each member's own readers and scenes with a
// member in them recall it, and so does the group's own prompt (reader "group"), never anyone else.
import { forgeDayKey } from "@forge-kit/time-zone-server.mjs";
import type { ForgeMemorySource } from "@forge-kit/story-memory.mjs";
import type {
  LiId,
  PhoneCloseResult,
  PhoneCloseView,
  PhoneClosing,
  PhoneMessage,
  PhoneSession,
  PhoneThread,
  RunState,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { AFFECTION_EARNINGS } from "../../../../../client/src/features/otome-forge/shared/economy.js";
import { GROUP_THREAD } from "../../../../../client/src/features/otome-forge/shared/home.js";
import type { BackgroundQueue } from "../background-queue.js";
import { generateJson, resolveConnectionId, type OtomeMessage } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { chatId, runDocTarget, stateId, worldId } from "../ids.js";
import { normalizeState } from "../schemas/state.js";
import { normalizeWorld } from "../schemas/world.js";
import { grant } from "../state/rewards.js";
import type { OtomeStore } from "../store.js";
import {
  archivedCount,
  conflict,
  emptyThread,
  inThreadLock,
  loadThreadRun,
  normalizeThread,
  readThread,
  remembering,
  SESSION_NAME_MAX,
  saveThread,
  sessionSourceId,
  type PhoneDeps,
} from "./chat.js";
import { chatMemoryMessages, renderThread } from "../prompts.js";
import { ChatMemorySchema, normalizeChatMemory, type ChatMemoryRaw } from "./replies.js";
import { stickerLookup } from "../art/stickers.js";

const said = (message: PhoneMessage) => !!message.text.trim() || !!message.sticker;

/** The summaries one close may start: its own, and one more after a restart (see the header). */
export const CLOSE_TRIES = 2;

/** The writes that may take a saved close's mark off before a read is left to (see the header). */
const SETTLE_TRIES = 2;

/** The background job remembering thread `key`'s close. */
export const closeJobKey = (runId: string, key: string) => `${runId}:phone-close:${key}`;

/** A close's dependencies: the phone's, and the background lane its summary runs in. */
export interface CloseDeps extends PhoneDeps {
  background?: Pick<BackgroundQueue, "ensure" | "has">;
}

/** A name as a session keeps it: at most SESSION_NAME_MAX characters. */
export const sessionName = (name: string) => [...name].slice(0, SESSION_NAME_MAX).join("");

/** How a close summarizes its thread's open conversation: P18's wording, and what its session keeps. */
export interface Summarizing {
  label: string;
  render: (open: PhoneMessage[]) => string;
  messages: (conversation: string) => OtomeMessage[];
  normalize: (raw: ChatMemoryRaw, conversation: string) => { memory: string; quote: string } | string;
  session: Pick<PhoneSession, "name" | "members">;
}

/**
 * What a thread's close needs once its job runs, read from the run then (and its mark): P18's wording, and (a love
 * interest's or a friend's thread) the affection the conversation earns on `day`.
 */
export interface Remembering {
  how: Summarizing;
  earn?: (open: PhoneMessage[], day: string) => Promise<number>;
}

/** His thread's close: P18's one-to-one wording, and Close and remember's affection. */
export async function liRemembering(deps: PhoneDeps, runId: string, li: LiId): Promise<Remembering> {
  const { run, unit } = await loadThreadRun(deps, runId, li, { forged: false });
  const names = { li: unit.name, player: run.player.name || "the protagonist" };
  return {
    how: {
      label: `phone-memory/${li}`,
      render: (open) => renderThread(open, names, "told", stickerLookup(run)),
      messages: (conversation) => chatMemoryMessages({ world: run.world, names, conversation }),
      normalize: (raw, conversation) => normalizeChatMemory(raw, names, conversation),
      // A card's name has no length limit; the session keeps what its schema reads back.
      session: { name: sessionName(unit.name) },
    },
    earn: (open, day) => earnClose(deps, runId, li, open, day),
  };
}

/** Close and remember's affection for a conversation with something from each of them, within `day`'s cap. */
async function earnClose(deps: PhoneDeps, runId: string, li: LiId, open: PhoneMessage[], day: string) {
  const exchange =
    open.some((message) => message.who === "player" && said(message)) && open.some((m) => m.who === "li");
  if (!exchange) return 0;
  try {
    let affection = 0;
    await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
      // A close that lands after the next day's first activity counts against that newer day's cap, so the daily
      // tally never goes back to the day it was closed on (keys are YYYY-MM-DD).
      const result = grant(
        current,
        { source: "close-and-remember", li, affection: AFFECTION_EARNINGS.closeAndRemember },
        current.daily.dayKey > day ? current.daily.dayKey : day,
      );
      affection = result.granted.affection;
      return result.state;
    });
    return affection;
  } catch (error) {
    // The session is saved; its affection is not paid twice by a retry, so a grant that cannot land is let go.
    deps.runtime.logger.warn(
      "[otome-forge] Close and remember for %s kept no affection: %s",
      li,
      error instanceof Error ? error.message : String(error),
    );
    return 0;
  }
}

/** Queues memory upkeep, which records a saved session for recall (see the header); it never rejects. */
const upkeep = (deps: PhoneDeps, runId: string, debugMode: boolean) =>
  void Promise.resolve(deps.memory?.maintain({ runId, debugMode })).catch(() => undefined);

/** Whether `thread` already holds the session close `mark` makes (its mark did not come off, or a restart came first). */
const landed = (thread: PhoneThread, mark: PhoneClosing) => thread.sessions.some((entry) => entry.start === mark.start);

/**
 * Thread `key` without close `mark` (with `affection` kept on its session), or with `error` on it unless its session
 * is saved; only that close.
 */
function settleClose(
  deps: PhoneDeps,
  runId: string,
  key: string,
  mark: PhoneClosing,
  end: { error?: string; affection?: number } = {},
) {
  return saveThread(deps, runId, key, (current) => {
    if (current.closing?.at !== mark.at) return current;
    if (end.error && !landed(current, mark)) return { ...current, closing: { ...current.closing, error: end.error } };
    const { closing: _done, ...rest } = current;
    const affection = end.affection ?? 0;
    return {
      ...rest,
      sessions: affection
        ? rest.sessions.map((session) => (session.start === mark.start ? { ...session, affection } : session))
        : rest.sessions,
    };
  });
}

/** The close's prepare: what its job needs, from its mark. */
type Prepare = (mark: PhoneClosing) => Promise<Remembering>;

/**
 * Takes the mark off a close whose session is saved, with `affection` kept on it: SETTLE_TRIES writes, then the mark is
 * left with no error for the next read to take off (see the header). It never rejects.
 */
async function settleSaved(deps: PhoneDeps, runId: string, key: string, mark: PhoneClosing, affection: number) {
  for (let attempt = 1; attempt <= SETTLE_TRIES; attempt += 1) {
    try {
      return void (await settleClose(deps, runId, key, mark, { affection }));
    } catch (error) {
      if (attempt === SETTLE_TRIES)
        deps.runtime.logger.warn(
          "[otome-forge] Close and remember in %s is saved, but its mark stays until the next read: %s",
          key,
          error instanceof Error ? error.message : String(error),
        );
    }
  }
}

/** The job (see the header): remembers thread `key`'s close, if it still stands. */
async function remember(
  deps: CloseDeps,
  runId: string,
  key: string,
  { connectionId, debugMode, prepare }: { connectionId: string; debugMode: boolean; prepare: Prepare },
): Promise<void> {
  const thread = await readThread(deps.store, runId, key);
  const mark = thread?.closing;
  if (!thread || !mark || mark.error) return;
  // Landed before a restart: only its mark is left, and upkeep is queued for its session, as below.
  if (landed(thread, mark)) {
    await settleSaved(deps, runId, key, mark, 0);
    return upkeep(deps, runId, debugMode);
  }
  try {
    // #2459: an ended story calls no model; its conversation stays as it was.
    if ((await deps.store.readDoc(stateId(runId), normalizeState))?.ended)
      return void (await settleClose(deps, runId, key, mark));
    if (mark.tries >= CLOSE_TRIES) return void (await settleClose(deps, runId, key, mark, { error: "stopped" }));
    const { how, earn } = await prepare(mark);
    let started = false as boolean;
    await saveThread(deps, runId, key, (current) => {
      started = current.closing?.at === mark.at && !current.closing.error;
      return started ? { ...current, closing: { ...current.closing!, tries: current.closing!.tries + 1 } } : current;
    });
    if (!started) return;
    const open = thread.messages.slice(mark.start, mark.end);
    const conversation = how.render(open);
    const { value } = await generateJson(deps, {
      runId,
      job: "compress",
      label: how.label,
      messages: how.messages(conversation),
      schema: ChatMemorySchema,
      normalize: (raw) => how.normalize(raw, conversation),
      maxTokens: 600,
      debugMode,
      lane: "background",
      connectionId,
    });
    // generateJson returns what normalizeChatMemory made of the reply.
    const session: PhoneSession = {
      start: mark.start,
      count: mark.end - mark.start,
      memory: { text: value.memory, quote: value.quote ?? "" },
      closedAt: new Date().toISOString(),
      ...how.session,
    };
    // Set by the write that was saved (mutateDoc applies the change again after a stale revision).
    let appended = false as boolean;
    await saveThread(deps, runId, key, (current) => {
      appended = false;
      if (landed(current, mark)) return current;
      if (archivedCount(current) !== mark.start || current.messages.length < mark.end) {
        throw conflict("The thread changed while it was being remembered.");
      }
      appended = true;
      return { ...current, sessions: [...current.sessions, session] };
    }).catch(async (error: unknown) => {
      // It can reject after its write (the check that the story is still there): a session it saved stands.
      const saved = appended && (await readThread(deps.store, runId, key));
      if (!saved || !landed(saved, mark)) throw error;
    });
    // The session is saved: neither the grant nor settleSaved rejects, so it is never marked failed or paid twice.
    const affection = appended && earn ? await earn(open, mark.day) : 0;
    await settleSaved(deps, runId, key, mark, affection);
    if (appended) upkeep(deps, runId, debugMode);
  } catch (error) {
    // No session was saved: the conversation stays open; the list and the thread say why, with Try again.
    const code = (error instanceof OtomeForgeError && error.code) || "failed";
    deps.runtime.logger.warn(
      "[otome-forge] Close and remember in %s failed: %s",
      key,
      error instanceof Error ? error.message : String(error),
    );
    await settleClose(deps, runId, key, mark, { error: code }).catch(() => undefined);
  }
}

/**
 * Queues thread `key`'s close job unless one is queued already. Without a connection for it, its mark fails as
 * `no-connection` (the accept refuses first, so only a resume finds that), unless its session is saved: then it only
 * comes off.
 */
async function queueClose(
  deps: CloseDeps,
  runId: string,
  key: string,
  world: Pick<World, "connections">,
  debugMode: boolean,
  prepare: Prepare,
) {
  const background = deps.background;
  const jobKey = closeJobKey(runId, key);
  if (!background || background.has(jobKey)) return;
  const connectionId = resolveConnectionId(world, "compress");
  if (!connectionId) {
    const thread = await readThread(deps.store, runId, key);
    const mark = thread?.closing;
    if (!mark || mark.error) return;
    await settleClose(deps, runId, key, mark, { error: "no-connection" });
    return;
  }
  background.ensure({
    key: jobKey,
    connectionId,
    // The player's own close: it never waits for an idle connection.
    foreground: true,
    run: () => remember(deps, runId, key, { connectionId, debugMode, prepare }),
  });
}

/**
 * POST .../close for thread `key` (see the header), once its caller has checked the thread and holds its lock: marks
 * the open conversation (with the group's `members` now) and queues its summary, or with nothing open returns the
 * newest memory. Close again while it is remembered answers the same, and queues its job again if a restart lost it.
 */
export async function acceptClose(
  deps: CloseDeps,
  runId: string,
  key: string,
  world: Pick<World, "connections">,
  debugMode: boolean,
  prepare: Prepare,
  members?: LiId[],
): Promise<PhoneCloseResult> {
  if (!deps.background)
    throw new OtomeForgeError(503, "Messages cannot remember a conversation right now.", "no-connection");
  const thread = (await readThread(deps.store, runId, key)) ?? emptyThread(key);
  if (thread.closing && remembering(thread)) {
    await queueClose(deps, runId, key, world, debugMode, prepare);
    return { remembering: true, start: thread.closing.start };
  }
  const start = archivedCount(thread);
  if (!thread.messages.slice(start).some(said)) {
    // Nothing open: a Close sent again after it landed gets the memory it made, and earns nothing.
    const newest = thread.sessions.at(-1);
    if (!newest) throw conflict("There is no conversation to remember yet.");
    if (thread.closing) await settleClose(deps, runId, key, thread.closing);
    return { memory: newest.memory };
  }
  if (!resolveConnectionId(world, "compress")) {
    throw new OtomeForgeError(503, "No connection is set for the compress job.", "no-connection");
  }
  const at = new Date().toISOString();
  const day = forgeDayKey(Date.now());
  await saveThread(deps, runId, key, (current) => {
    if (archivedCount(current) !== start) throw conflict("The thread changed while it was being closed.");
    return {
      ...current,
      closing: { start, end: current.messages.length, at, tries: 0, day, ...(members ? { members } : {}) },
    };
  });
  await queueClose(deps, runId, key, world, debugMode, prepare);
  return { remembering: true, start };
}

/**
 * 0.47.1: thread `key`'s close, when its mark stands with no job for it in this process (a restart), queued again from
 * a read of the list or the thread (see the header).
 */
export async function resumeClose(
  deps: CloseDeps,
  runId: string,
  key: string,
  { closing }: PhoneCloseView,
  debugMode: boolean,
  prepare: Prepare,
): Promise<void> {
  if (!closing || closing.error || !deps.background || deps.background.has(closeJobKey(runId, key))) return;
  const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
  if (world) await queueClose(deps, runId, key, world, debugMode, prepare);
}

/** POST .../close: Close and remember (P18, in the background). One send or close per thread at a time (409 `busy`). */
export function closeAndRemember(
  deps: CloseDeps,
  runId: string,
  li: LiId,
  { debugMode = false }: { debugMode?: boolean } = {},
): Promise<PhoneCloseResult> {
  return inThreadLock(runId, li, async () => {
    const { run } = await loadThreadRun(deps, runId, li);
    return acceptClose(deps, runId, li, run.world, debugMode, () => liRemembering(deps, runId, li));
  });
}

/**
 * Where a closed session sits in story order: after the main chapters completed before it closed, among the side
 * stories opened after them by time (the order S/story/canon.ts gives side chapters).
 */
function orderOf(state: RunState, closedAt: string): number {
  const mainDone = Object.entries(state.chapters).filter(
    ([key, progress]) => key.startsWith("main-") && progress.completed && progress.completed < closedAt,
  ).length;
  return mainDone * 10000 + 5000 + (Date.parse(closedAt) || 0) / 1e13;
}

/**
 * Every closed phone session of the run as a `chat` memory source with `audience: [li]` (S/memory/sources.ts adds
 * these to the run's sources): only his own readers and scenes he is in recall it. Threads of love interests the run no
 * longer has are not read.
 */
export async function phoneMemorySources(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  state: RunState,
): Promise<ForgeMemorySource[]> {
  // #2458: her friends' sessions are theirs alone, as a love interest's are.
  const threads = await Promise.all(
    [...Object.keys(state.lis), ...Object.keys(state.friends)].map(async (li) => ({
      li,
      thread: await store.readDoc(chatId(runId, li), normalizeThread),
    })),
  );
  const sources: ForgeMemorySource[] = [];
  for (const { li, thread } of threads) {
    for (const session of thread?.sessions ?? []) {
      if (!session.memory.text.trim()) continue;
      // Private, as S/story/canon.ts titles a love interest's own chapter: a scene with others in it recalls it as
      // something they do not know.
      const who = session.name || "its love interest";
      sources.push({
        id: sessionSourceId(li, session),
        kind: "chat",
        title: `${session.name ? `${who}'s` : "A"} message exchange (private: only ${who} and the protagonist know what was said)`,
        content: [session.memory.text, session.memory.quote ? `"${session.memory.quote}"` : ""]
          .filter(Boolean)
          .join("\n"),
        order: orderOf(state, session.closedAt),
        audience: [li],
      });
    }
  }
  // #2154: the group chat's, private to the members it had when it closed (and the group's own prompt).
  const group = await store.readDoc(chatId(runId, GROUP_THREAD), normalizeThread);
  for (const session of group?.sessions ?? []) {
    if (!session.memory.text.trim() || !session.members?.length) continue;
    const who = session.name || "the love interests in it";
    sources.push({
      id: sessionSourceId(GROUP_THREAD, session),
      kind: "chat",
      title: `A group chat with ${who} (private: only they and the protagonist know what was said)`,
      content: [session.memory.text, session.memory.quote ? `"${session.memory.quote}"` : ""]
        .filter(Boolean)
        .join("\n"),
      order: orderOf(state, session.closedAt),
      audience: [...session.members, GROUP_THREAD],
    });
  }
  return sources;
}
