// ──────────────────────────────────────────────
// Otome Forge: daily messages from love interests (#2044), Settings → Connections' "Love interests who message you
// each day" (world.dailyMessages, 0 to 24; absent or 0 is off)
// ──────────────────────────────────────────────
// ponytail: a port of Gacha Forge's createForgeProactiveMessages (packages/gacha-forge/src/proactive-messages-server.mjs)
// rather than a shared kit module: GF's is bound to its index, session and roster documents, its transaction and its
// generator, and moving it into sources/forge-kit would change GF's pinned bundle. The upgrade path is one kit module
// both packages adapt, shipped with a GF rebuild. GF's rules, kept:
// - The client asks POST /runs/:run/phone/due every 60 s while Otome Hearth is open and visible (PhoneScreen.tsx
//   useDailyMessages); nothing is sent otherwise.
// - The quota is per local day in the request's time zone (forgeDayKey; every route runs in it): at most `limit`
//   attempts a day, max(60 s, 24 h / limit) apart and never past the next local midnight (forgeResetIn), so they
//   spread over the day and the count starts again each day. world.phoneDaily keeps four local days, as GF does.
// - The limit is how many love interests write first a day, not how many messages (the maintainer's, 2026-11-03):
//   one who wrote first today is not picked again until tomorrow, and each writes one to REPLY_MESSAGES_MAX messages
//   (S/phone/replies.ts). The day's `wrote` lists them; an attempt that sent nothing names no one. Attempts are spread
//   by the limit or the number met, whichever is smaller, so a limit above the cast still spreads over the day.
// - The first heartbeat of a visit (none within 120 s) arms the next attempt at least 60 s away, never sooner than one
//   already set, so opening the app never delivers at once and re-arming never shortens an interval.
// - An attempt is spent when it is reserved, before any provider work, and never retried: a failed or dropped message
//   costs that day's slot, and a crash never pays twice.
// - The writer is picked at random (Fisher–Yates) among the love interests the player has met, never the one whose
//   thread she has open, whose reply is being written, or whose open conversation ends on her unanswered message.
//   ponytail: "met" is a cast member once any chapter but the prologue is read (the prologue meets no one, chapter 1
//   brings the cast in), so a newcomer may write before the scene they are met in is read; the upgrade path is the
//   arc's newcomer chapter.
// Otome's own: the message is written by a background-queue job (the Engine's background admission on the chat
// connection), never in the run's foreground queue, so no story write or phone reply waits on it. The job writes P17
// with `first` (S/phone/chat.ts writeFirstMessage) inside the thread's lock, so his thread shows him typing and a send
// there meanwhile is a 409 busy. The message lands unread. The heartbeat and the open thread live in this process: a
// restart re-arms (+60 s, never sooner).
import { forgeChatReplyBusy } from "@forge-kit/chat-continuity-server.mjs";
import { forgeDayKey, forgeResetIn } from "@forge-kit/time-zone-server.mjs";
import type {
  LiId,
  PhoneDaily,
  PhoneDueResult,
  PhoneMessage,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import type { BackgroundQueue } from "../background-queue.js";
import { resolveConnectionId } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { PROLOGUE_KEY, runDocTarget, worldId } from "../ids.js";
import { readRun, type RunDocuments } from "../schemas/state.js";
import { normalizeWorld } from "../schemas/world.js";
import { emptyThread, inThreadLock, openMessages, readThread, writeFirstMessage, type PhoneDeps } from "./chat.js";

/** Attempts are never closer than this, whatever the limit (GF). */
export const DAILY_MIN_INTERVAL_MS = 60_000;
/** The first heartbeat of a visit arms the next attempt this far away (GF). */
export const DAILY_ARM_MS = 60_000;
/** A heartbeat gap longer than this starts a new visit (GF). */
export const DAILY_HEARTBEAT_GAP_MS = 120_000;
const DAY_MS = 86_400_000;
/** Local days kept: neighbouring dates cover a change of time zone without resetting today's count (GF). */
const DAYS_KEPT = 4;

export interface DailyDeps extends PhoneDeps {
  background?: Pick<BackgroundQueue, "ensure" | "has">;
}

export const dailyJobKey = (runId: string) => `${runId}:phone-daily`;

/** Each run's last heartbeat (epoch ms). */
const heartbeats = new Map<string, number>();
/** The thread each run's player has open (null: none), as the heartbeat or a thread read said last. */
const openThreads = new Map<string, LiId | null>();
/** Runs whose heartbeat is being answered: two at once never reserve twice. */
const answering = new Set<string>();

/** Remembers the thread the player has open (null: none). */
export function noteOpenThread(runId: string, li: LiId | null): void {
  openThreads.set(runId, li);
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}

/** The love interests the player has met, in cast order (see the header). */
const metLis = (run: RunDocuments) =>
  Object.keys(run.state.lis).filter((li) => run.units.some((unit) => unit.id === li && !!unit.bible));

/** The love interests who may write first now, in cast order (see the header). */
export async function dailyCandidates(
  deps: Pick<PhoneDeps, "store">,
  runId: string,
  run: RunDocuments,
  day: string,
): Promise<LiId[]> {
  if (run.world.forge.phase !== "ready") return [];
  if (!Object.entries(run.state.chapters).some(([key, chapter]) => key !== PROLOGUE_KEY && !!chapter.completed)) {
    return [];
  }
  const open = openThreads.get(runId) ?? null;
  const wrote = new Set(run.world.phoneDaily?.days[day]?.wrote);
  const cast = metLis(run).filter((li) => li !== open && !wrote.has(li) && !forgeChatReplyBusy(runId, li));
  const waiting = await Promise.all(
    cast.map(
      async (li) => openMessages((await readThread(deps.store, runId, li)) ?? emptyThread(li)).at(-1)?.who === "player",
    ),
  );
  return cast.filter((_, index) => !waiting[index]);
}

export type DailyDecision = { status: "quota" | "waiting" } | { status: "scheduled" | "queued"; next: PhoneDaily };

/** GF's rule for a heartbeat at `now` (the run's last one at `seen`): see the header. Pure but for the time zone. */
export function dailyDecision(
  daily: PhoneDaily | undefined,
  { now, seen, limit }: { now: number; seen: number | undefined; limit: number },
): DailyDecision {
  const day = forgeDayKey(now);
  const days = { ...daily?.days };
  const quota: PhoneDaily["days"][string] = { ...days[day], attempts: days[day]?.attempts ?? 0 };
  const older = Object.keys(days)
    .filter((key) => key !== day)
    .sort();
  for (const old of older.slice(0, Math.max(0, older.length - (DAYS_KEPT - 1)))) delete days[old];
  days[day] = quota;
  const next = (): PhoneDaily => ({ ...daily, days });
  if (quota.attempts >= limit) return { status: "quota" };
  if (quota.nextAt === undefined || seen === undefined || now < seen || now - seen > DAILY_HEARTBEAT_GAP_MS) {
    quota.nextAt = Math.max(now + DAILY_ARM_MS, quota.nextAt ?? now);
    return { status: "scheduled", next: next() };
  }
  if (now < quota.nextAt) return { status: "waiting" };
  quota.attempts += 1;
  quota.nextAt = Math.min(now + Math.max(DAILY_MIN_INTERVAL_MS, DAY_MS / limit), now + Math.max(1, forgeResetIn(now)));
  return { status: "queued", next: next() };
}

/** POST /runs/:run/phone/due {open?}: one heartbeat, which may spend today's next attempt and queue its job. */
export async function phoneDue(
  deps: DailyDeps,
  runId: string,
  {
    open,
    debugMode = false,
    now = Date.now(),
    random = Math.random,
  }: { open?: LiId | null; debugMode?: boolean; now?: number; random?: () => number } = {},
): Promise<PhoneDueResult> {
  if (open !== undefined) noteOpenThread(runId, open);
  const run = await readRun(deps.store, runId);
  if (!run) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
  const latest = run.world.phoneDaily?.last ?? null;
  const result = (status: PhoneDueResult["status"]): PhoneDueResult => ({ status, latest });
  const limit = run.world.dailyMessages ?? 0;
  const { background } = deps;
  if (!limit || !background) return result("disabled");
  const connectionId = resolveConnectionId(run.world, "chat");
  if (!connectionId) return result("no-connection");
  const key = dailyJobKey(runId);
  if (answering.has(runId) || background.has(key)) return result("busy");
  answering.add(runId);
  try {
    const day = forgeDayKey(now);
    const candidates = await dailyCandidates(deps, runId, run, day);
    if (!candidates.length) return result("no-eligible");
    const seen = heartbeats.get(runId);
    heartbeats.set(runId, now);
    const spread = (setting: number) => Math.min(setting, metLis(run).length);
    const first = dailyDecision(run.world.phoneDaily, { now, seen, limit: spread(limit) });
    if (!("next" in first)) return result(first.status);
    // Decided again on the stored world, so a write that landed meanwhile (a settings save) counts.
    let decided: DailyDecision = first;
    const saved = await deps.store.updateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (current) => {
      decided = dailyDecision(current.phoneDaily, { now, seen, limit: spread(current.dailyMessages ?? 0) });
      return "next" in decided ? { ...current, phoneDaily: decided.next } : current;
    });
    if (!saved) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
    if (decided.status !== "queued") return result(decided.status);
    const order = shuffled(candidates, random);
    background.ensure({
      key,
      connectionId,
      run: () => writeDaily(deps, runId, order, { connectionId, debugMode, day }),
    });
    return result("queued");
  } finally {
    answering.delete(runId);
  }
}

/** The job: the first love interest still free writes first, so one attempt pays for one of them at most. */
async function writeDaily(
  deps: DailyDeps,
  runId: string,
  order: readonly LiId[],
  { connectionId, debugMode, day }: { connectionId: string; debugMode: boolean; day: string },
): Promise<void> {
  for (const li of order) {
    // While the job waited the player may have opened his thread, or a reply there may have started.
    if (openThreads.get(runId) === li || forgeChatReplyBusy(runId, li)) continue;
    let sent: PhoneMessage[] | null;
    try {
      sent = await inThreadLock(runId, li, () => writeFirstMessage(deps, runId, li, { connectionId, debugMode }));
    } catch (error) {
      if (error instanceof OtomeForgeError && error.code === "busy") continue;
      if (error instanceof OtomeForgeError && error.code === "conflict") {
        deps.runtime.logger.info("[otome-forge] A daily message from %s was dropped: %s", li, error.message);
        return;
      }
      throw error;
    }
    // Her message was waiting there after all: nothing was sent, so the next one may write.
    if (!sent?.length) continue;
    const at = sent.at(-1)!.at;
    await deps.store.updateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (current) => {
      const days = current.phoneDaily?.days ?? {};
      // The day the attempt was spent on.
      // ponytail: a message reserved before local midnight that lands after it counts on that earlier day, so the
      // same love interest may write first again just after midnight. The job cannot read the request's time zone;
      // the upgrade path is passing the day's end (forgeResetIn) into the job and counting the day it lands on.
      const today = days[day] ?? { attempts: 1 };
      const wrote = [...new Set([...(today.wrote ?? []), li])];
      return {
        ...current,
        phoneDaily: { ...current.phoneDaily, days: { ...days, [day]: { ...today, wrote } }, last: { li, at } },
      };
    });
    return;
  }
}
