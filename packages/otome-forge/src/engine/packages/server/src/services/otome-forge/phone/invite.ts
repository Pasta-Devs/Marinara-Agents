// ──────────────────────────────────────────────
// Otome Forge: love interests ask the protagonist on dates (#2424), Settings → Connections' "Date invitations each
// week" (world.dateInvites, 0 to DATE_INVITES_MAX; absent or 0, the default, is off)
// ──────────────────────────────────────────────
// - The daily messages' heartbeat (POST /runs/:run/phone/due) answers for it too (inviteDue), by their own rule
//   (S/phone/daily.ts dailyDecision with `week`): a quota per local week from Monday, on world.inviteWeekly, attempts
//   spread over the week (7 days / the limit apart, or the number met if that is smaller) and never past the next
//   Monday, armed a minute after a visit starts, each spent before any provider work and never retried. As with daily
//   messages, the limit counts love interests: one who asked this week is not picked again until the next.
// - Who may ask: a love interest she has met, whose thread is not open, busy, being remembered (0.47.1) or waiting on
//   her message, who holds no grievance with her (#2156: his dates wait) and has no invitation of his still waiting, of
//   either kind.
// - Who asks: the one she has spent the least time with (the maintainer's, 2026-11-20): the fewest scenes with him in
//   the main story and Character Stories she finished in the last 7 days (main, route and repair chapters, item and
//   bond stories, extra stories; never a date or his side, where she is not), a tie going to the one she was with
//   longest ago, then cast order. The job orders them once it is admitted, so the heartbeat reads no chapter.
// - The job is a background job on the Messages connection: P17 with reason "date" (S/phone/chat.ts writeFirstMessage)
//   inside the thread's lock, so his thread shows him typing, and his last message carries the invitation
//   (`invite.kind` "date", pending). It lands unread.
// - Her answer: Decline in the thread (POST /runs/:run/phone/:li/invite {accept: false}, S/phone/upset.ts), which calls
//   no model; or Accept, which opens the date's looks step: POST /runs/:run/dates/invited {li, message, herLook, gift?}
//   (S/routes/dates.ts) wears her look, then plans the date (startInvitedDate, P26 through S/minigames/date-night.ts
//   planDate: he chooses the place and what they do, DATE_BEATS scenes) and accepts the invitation with the date as its
//   scene. It is a `date-<n>` like any other, finished and paid as dates are (120 Starlight and 100 affection, within
//   the day's caps), and listed with the earlier evenings. While his grievance with her stands it is a 409 `locked`.
import { forgeChatReplyBusy } from "@forge-kit/chat-continuity-server.mjs";
import { forgeWeekKey } from "@forge-kit/time-zone-server.mjs";
import type {
  Chapter,
  LiId,
  PhoneDueResult,
  PhoneMessage,
  RunState,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { heldAgainst, type DateEntry } from "../../../../../client/src/features/otome-forge/shared/dates.js";
import type { GiftId } from "../../../../../client/src/features/otome-forge/shared/shop.js";
import { resolveConnectionId, runForeground } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { runDocTarget, stateId, worldId } from "../ids.js";
import { assertNotHeld, entryOf, giveGift, partnerOf, planDate, type DateDeps } from "../minigames/date-night.js";
import { normalizeState, readRun, type RunDocuments } from "../schemas/state.js";
import { normalizeWorld } from "../schemas/world.js";
import type { OtomeStore } from "../store.js";
import { readChapter } from "../story/canon.js";
import { inThreadLock, inviteWaiting, readThread, writeFirstMessage } from "./chat.js";
import {
  dailyCandidates,
  dailyDecision,
  metLis,
  noteOpenThread,
  openThread,
  type DailyDecision,
  type DailyDeps,
} from "./daily.js";
import { settleInvites } from "./upset.js";

export const inviteJobKey = (runId: string) => `${runId}:phone-invite`;

/** How far back the scenes she spent with each of them count. */
const RECENT_MS = 7 * 86_400_000;
/** The chapters that count as time with him, by key (the kind is checked on the chapter): see the header. */
const TIME_WITH = /^(?:main|route|repair|story|prestige)-/;
const TIME_KINDS = new Set<Chapter["kind"]>(["main", "route", "repair", "story"]);

/** Each run's last heartbeat for the invitations (epoch ms), and the runs whose heartbeat is being answered. */
const heartbeats = new Map<string, number>();
const answering = new Set<string>();

const notFound = (what: string) => new OtomeForgeError(404, `No such ${what}.`, "not-found");
const runNotFound = () => notFound("Otome Hearth story");
const conflict = (message: string) => new OtomeForgeError(409, message, "conflict");

/**
 * `candidates`, the one she has spent the least time with first (see the header): reads the chapters she finished in
 * the last RECENT_MS, newest first, and older ones only until each candidate's latest is found.
 */
export async function leastSeenFirst(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  state: Pick<RunState, "chapters">,
  candidates: readonly LiId[],
  now: number,
): Promise<LiId[]> {
  const since = now - RECENT_MS;
  const finished = Object.entries(state.chapters)
    .flatMap(([key, progress]) => (progress.completed && TIME_WITH.test(key) ? [{ key, at: progress.completed }] : []))
    .sort((a, b) => b.at.localeCompare(a.at));
  const scenes = new Map(candidates.map((li) => [li, 0]));
  const latest = new Map<LiId, string>();
  for (const { key, at } of finished) {
    const recent = Date.parse(at) >= since;
    if (!recent && candidates.every((li) => latest.has(li))) break;
    const chapter = await readChapter(store, runId, key);
    if (!chapter || !TIME_KINDS.has(chapter.kind)) continue;
    for (const li of candidates) {
      const count = chapter.nodes.filter((node) => node.cast.includes(li)).length;
      if (!count) continue;
      if (recent) scenes.set(li, scenes.get(li)! + count);
      if (!latest.has(li)) latest.set(li, at);
    }
  }
  // Stable: cast order settles what is left. Never with her sorts as longest ago.
  return [...candidates].sort(
    (a, b) => scenes.get(a)! - scenes.get(b)! || (latest.get(a) ?? "").localeCompare(latest.get(b) ?? ""),
  );
}

/** Those who may ask her now (see the header), in cast order. */
const inviteCandidates = (deps: Pick<DailyDeps, "store">, runId: string, run: RunDocuments, week: string) =>
  dailyCandidates(
    deps,
    runId,
    run,
    run.world.inviteWeekly?.days[week]?.wrote,
    (li, thread) => !heldAgainst(run.state.lis[li]) && !inviteWaiting(thread),
  );

/**
 * The invitations' half of POST /runs/:run/phone/due {open?} (see the header): one heartbeat, which may spend this
 * week's next attempt and queue its job.
 */
export async function inviteDue(
  deps: DailyDeps,
  runId: string,
  { open, debugMode = false, now = Date.now() }: { open?: LiId | null; debugMode?: boolean; now?: number } = {},
): Promise<NonNullable<PhoneDueResult["invite"]>> {
  if (open !== undefined) noteOpenThread(runId, open);
  const run = await readRun(deps.store, runId);
  if (!run) throw runNotFound();
  const latest = run.world.inviteWeekly?.last ?? null;
  const result = (status: PhoneDueResult["status"]) => ({ status, latest });
  const limit = run.world.dateInvites ?? 0;
  const { background } = deps;
  if (!limit || !background) return result("disabled");
  const connectionId = resolveConnectionId(run.world, "chat");
  if (!connectionId) return result("no-connection");
  const key = inviteJobKey(runId);
  if (answering.has(runId) || background.has(key)) return result("busy");
  answering.add(runId);
  try {
    const week = forgeWeekKey(now);
    const candidates = await inviteCandidates(deps, runId, run, week);
    if (!candidates.length) return result("no-eligible");
    const seen = heartbeats.get(runId);
    heartbeats.set(runId, now);
    const spread = (setting: number) => Math.min(setting, metLis(run).length);
    const first = dailyDecision(run.world.inviteWeekly, { now, seen, limit: spread(limit), week: true });
    if (!("next" in first)) return result(first.status);
    // Decided again on the stored world, so a write that landed meanwhile (a settings save) counts.
    let decided: DailyDecision = first;
    const saved = await deps.store.updateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (current) => {
      decided = dailyDecision(current.inviteWeekly, {
        now,
        seen,
        limit: spread(current.dateInvites ?? 0),
        week: true,
      });
      return "next" in decided ? { ...current, inviteWeekly: decided.next } : current;
    });
    if (!saved) throw runNotFound();
    if (decided.status !== "queued") return result(decided.status);
    background.ensure({
      key,
      connectionId,
      run: () => writeInvite(deps, runId, candidates, { connectionId, debugMode, week, now }),
    });
    return result("queued");
  } finally {
    answering.delete(runId);
  }
}

/** The job: the first one still free, least seen first, asks her; one attempt pays for one invitation at most. */
async function writeInvite(
  deps: DailyDeps,
  runId: string,
  candidates: readonly LiId[],
  { connectionId, debugMode, week, now }: { connectionId: string; debugMode: boolean; week: string; now: number },
): Promise<void> {
  const state = await deps.store.readDoc(stateId(runId), normalizeState);
  if (!state) return;
  const order = await leastSeenFirst(deps.store, runId, state, candidates, now);
  for (const li of order) {
    // While the job waited the player may have opened his thread, a reply there may have started, or he may have come
    // to hold a grievance with her.
    if (openThread(runId) === li || forgeChatReplyBusy(runId, li) || heldAgainst(state.lis[li])) continue;
    let sent: PhoneMessage[] | null;
    try {
      sent = await inThreadLock(runId, li, () =>
        writeFirstMessage(deps, runId, li, { connectionId, debugMode, reason: "date" }),
      );
    } catch (error) {
      // Busy, or no longer free to ask (an invitation of his started waiting meanwhile): the next one may ask.
      if (error instanceof OtomeForgeError && (error.code === "busy" || error.code === "locked")) continue;
      if (error instanceof OtomeForgeError && error.code === "conflict") {
        deps.runtime.logger.info("[otome-forge] A date invitation from %s was dropped: %s", li, error.message);
        return;
      }
      throw error;
    }
    // Her message was waiting there after all: nothing was sent, so the next one may ask.
    if (!sent?.length) continue;
    const at = sent.at(-1)!.at;
    await deps.store.updateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (current) => {
      const weeks = current.inviteWeekly?.days ?? {};
      const thisWeek = weeks[week] ?? { attempts: 1 };
      const wrote = [...new Set([...(thisWeek.wrote ?? []), li])];
      return {
        ...current,
        inviteWeekly: { ...current.inviteWeekly, days: { ...weeks, [week]: { ...thisWeek, wrote } }, last: { li, at } },
      };
    });
    return;
  }
}

// ── Accepting: the date he asked her on ──

/** POST /runs/:run/dates/invited's body: his invitation (his message's id), her look, and a gift she brings. */
export interface InvitedDateInput {
  li: LiId;
  message: string;
  herLook: string;
  gift?: GiftId;
}

/**
 * His date invitation as the run has it now, before anything is worn, given or planned, and again inside the run's
 * queue: a love interest the story has (404), holding no grievance with her (409 `locked`), an invitation on a date
 * of his in his thread (404), still waiting (409 `conflict`), and a gift she may give (S/minigames/date-night.ts
 * giveGift). One accepted already answers with its date (`open`). `invitation` is what he wrote to ask: the messages
 * of his reply that carried it (they share its time), so the date keeps to anything he promised.
 */
async function checkInvited(
  store: Pick<OtomeStore, "readDoc">,
  run: RunDocuments,
  runId: string,
  input: InvitedDateInput,
) {
  const unit = partnerOf(run, input.li);
  assertNotHeld(run.state, input.li);
  const thread = await readThread(store, runId, input.li);
  const asked = thread?.messages.find(
    (message) => message.id === input.message && message.who === "li" && message.invite?.kind === "date",
  );
  const invite = asked?.invite;
  if (!asked || !invite) throw notFound("invitation");
  if (invite.status === "accepted" && invite.scene) {
    const open = await readChapter(store, runId, invite.scene);
    if (open?.date) return { unit, open, invitation: "" };
  }
  if (invite.status !== "pending") throw conflict("That invitation was answered already.");
  if (input.gift) giveGift(run.state, run.world.content, input.gift);
  const invitation = thread!.messages
    .filter((message) => message.who === "li" && message.at === asked.at)
    .map((message) => message.text.trim())
    .filter(Boolean)
    .join("\n");
  return { unit, open: null, invitation };
}

/** POST /dates/invited's first check: a refusal before the route wears her look or anything is planned. */
export async function checkInvitedDate(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  input: InvitedDateInput,
): Promise<void> {
  const run = await readRun(store, runId);
  if (!run) throw runNotFound();
  await checkInvited(store, run, runId, input);
}

/**
 * POST /runs/:run/dates/invited (see the header): plans the date he asked her on and accepts his invitation with it,
 * or returns the one it already opened (`resumed`). The route wears her look first; he comes as he is dressed now.
 */
export async function startInvitedDate(
  deps: DateDeps,
  runId: string,
  input: InvitedDateInput,
  { debugMode, signal }: { debugMode: boolean; signal?: AbortSignal },
): Promise<{ chapter: Chapter; date: DateEntry; resumed: boolean }> {
  const first = await readRun(deps.store, runId);
  if (!first) throw runNotFound();
  if (first.world.forge.phase !== "ready") throw conflict("The world is still being forged.");
  const resume = async (chapter: Chapter) => {
    const state = (await deps.store.readDoc(stateId(runId), normalizeState)) ?? normalizeState(undefined);
    return { chapter, date: entryOf(runId, chapter, state, null), resumed: true };
  };
  const checked = await checkInvited(deps.store, first, runId, input);
  if (checked.open) return resume(checked.open);
  return runForeground(runId, async () => {
    signal?.throwIfAborted();
    // Read again inside the queue: a request queued behind the one that planned it goes on with that date.
    const run = await readRun(deps.store, runId);
    if (!run) throw runNotFound();
    const { unit, open, invitation } = await checkInvited(deps.store, run, runId, input);
    if (open) return resume(open);
    const planned = await planDate(
      deps,
      runId,
      run,
      {
        units: [unit],
        cast: [unit.id],
        herLook: input.herLook,
        gift: input.gift,
        invited: { message: input.message, text: invitation },
      },
      { debugMode, signal },
    );
    // ponytail: a Decline that lands while the date is planned leaves the date planned (she still has it to read); the
    // invitation keeps her Decline. The upgrade path is the decline waiting in the run's queue too.
    await settleInvites(deps, runId, input.li, "accepted", input.message, planned.chapter.key);
    return { chapter: planned.chapter, date: entryOf(runId, planned.chapter, planned.state, null), resumed: false };
  });
}
