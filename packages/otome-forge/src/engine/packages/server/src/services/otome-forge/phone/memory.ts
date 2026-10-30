// ──────────────────────────────────────────────
// Otome Forge: Close and remember, and the phone's memory sources (plan M3 "Phone server", design: Private memory)
// ──────────────────────────────────────────────
// Close and remember turns the open conversation into a session: P18 writes what he will remember of it (a few
// sentences and one line quoted from it), the session is appended once, and he earns Close and remember's affection
// (SH/economy.ts, within the per-LI daily cap for everything outside the story; S/state/rewards.ts grant).
// - It holds the thread's one write in flight, as a send does (S/phone/chat.ts inThreadLock), so no reply lands while
//   it is summarized.
// - The session covers the messages that were summarized, and only a request whose write appended it earns the
//   affection: a replay (nothing left open) returns the newest memory with no grant. A conversation with nothing from
//   one of them earns nothing. The grant is the state's own revision-checked write; one that still fails after the
//   session is saved is logged and lost, never paid twice.
// - New sessions start memory upkeep in the background, which records them for recall.
// phoneMemorySources turns every closed session into a `chat` memory source with `audience: [li]`: only his own
// readers, and scenes he is in, recall it, and it never reaches the shared overview. Its title says it is private, so a
// scene with others in it knows they were not there. S/memory/sources.ts adds it to the run's sources. Care data is
// never a source.
import type { ForgeMemorySource } from "@forge-kit/story-memory.mjs";
import type {
  LiId,
  PhoneCloseResult,
  PhoneGrant,
  PhoneMessage,
  PhoneSession,
  RunState,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { AFFECTION_EARNINGS } from "../../../../../client/src/features/otome-forge/shared/economy.js";
import { generateJson, runForeground } from "../generation.js";
import { chatId, runDocTarget, stateId } from "../ids.js";
import { normalizeState } from "../schemas/state.js";
import { grant } from "../state/rewards.js";
import type { OtomeStore } from "../store.js";
import {
  archivedCount,
  conflict,
  inThreadLock,
  loadThreadRun,
  normalizeThread,
  readThread,
  SESSION_NAME_MAX,
  saveThread,
  sessionSourceId,
  type PhoneDeps,
} from "./chat.js";
import { ChatMemorySchema, chatMemoryMessages, normalizeChatMemory, renderThread } from "./prompts.js";

const said = (message: PhoneMessage) => !!message.text.trim() || !!message.sticker;

async function close(deps: PhoneDeps, runId: string, li: LiId, debugMode: boolean): Promise<PhoneCloseResult> {
  const { run, unit } = await loadThreadRun(deps, runId, li);
  const thread = await readThread(deps.store, runId, li);
  const start = thread ? archivedCount(thread) : 0;
  const open = thread?.messages.slice(start) ?? [];
  if (!open.some(said)) {
    // Nothing open: a Close sent again after it landed gets the memory it made, and earns nothing.
    const newest = thread?.sessions.at(-1);
    if (!newest) throw conflict("There is no conversation to remember yet.");
    return { memory: newest.memory, grants: [] };
  }
  const end = start + open.length;
  const names = { li: unit.name, player: run.player.name || "the protagonist" };
  const conversation = renderThread(open, names, "told");
  const { value } = await runForeground(runId, () =>
    generateJson(deps, {
      runId,
      job: "compress",
      label: `phone-memory/${li}`,
      messages: chatMemoryMessages({ world: run.world, names, conversation }),
      schema: ChatMemorySchema,
      normalize: (raw) => normalizeChatMemory(raw, names, conversation),
      temperature: 0.5,
      maxTokens: 600,
      debugMode,
      lane: "foreground",
    }),
  );
  // generateJson returns what normalizeChatMemory made of the reply.
  const memory = { text: value.memory, quote: value.quote ?? "" };
  const session: PhoneSession = {
    start,
    count: end - start,
    memory,
    closedAt: new Date().toISOString(),
    // A card's name has no length limit; the session keeps what its schema reads back.
    name: [...unit.name].slice(0, SESSION_NAME_MAX).join(""),
  };
  // Set by the write that was saved (mutateDoc applies the change again after a stale revision).
  let appended = false as boolean;
  let saved = session;
  await saveThread(deps, runId, li, (current) => {
    const at = archivedCount(current);
    if (at === start && current.messages.length >= end) {
      appended = true;
      saved = session;
      return { ...current, sessions: [...current.sessions, session], suggestions: [] };
    }
    // Another writer closed it first: its session is the one that counts.
    const theirs = current.sessions.find((entry) => entry.start === start);
    if (!theirs) throw conflict("The thread changed while it was being remembered.");
    appended = false;
    saved = theirs;
    return current;
  });
  if (!appended) return { memory: saved.memory, grants: [] };

  const grants: PhoneGrant[] = [];
  const exchange =
    open.some((message) => message.who === "player" && said(message)) && open.some((m) => m.who === "li");
  if (exchange) {
    let affection = 0;
    try {
      await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
        const result = grant(current, {
          source: "close-and-remember",
          li,
          affection: AFFECTION_EARNINGS.closeAndRemember,
        });
        affection = result.granted.affection;
        return result.state;
      });
    } catch (error) {
      // The session is saved; its affection is not paid twice by a retry, so a grant that cannot land is let go.
      affection = 0;
      deps.runtime.logger.warn(
        "[otome-forge] Close and remember for %s kept no affection: %s",
        li,
        error instanceof Error ? error.message : String(error),
      );
    }
    if (affection) grants.push({ source: "close-and-remember", li, affection });
  }
  void Promise.resolve(deps.memory?.maintain({ runId, debugMode })).catch(() => undefined);
  return { memory: saved.memory, grants };
}

/** POST .../close: Close and remember (P18). One send or close per thread at a time (409 `busy`). */
export function closeAndRemember(
  deps: PhoneDeps,
  runId: string,
  li: LiId,
  { debugMode = false }: { debugMode?: boolean } = {},
): Promise<PhoneCloseResult> {
  return inThreadLock(runId, li, () => close(deps, runId, li, debugMode));
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
  const threads = await Promise.all(
    Object.keys(state.lis).map(async (li) => ({ li, thread: await store.readDoc(chatId(runId, li), normalizeThread) })),
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
  return sources;
}
